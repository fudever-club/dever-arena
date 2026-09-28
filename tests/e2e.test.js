import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { db, ensureSeeded } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { api } from '../src/db/api.js';
import { ContestManager, CONTEST_PHASES } from '../src/core/contestStateMachine.js';
import { calculateProblemScore } from '../src/core/scoring.js';

// E2E flow test không cần browser, chỉ dùng db/api + core
// (a) user đăng ký → nộp bài → standings thay đổi
// (b) admin publish problem → DB có → getProblems filter
// (c) contest lifecycle REGISTRATION→CODING→FINISHED qua ContestManager (3 phase — ADR-005)

describe('E2E Flow (a) — user đăng ký → nộp bài → standings thay đổi', () => {
  before(async () => {
    await ensureSeeded(seedDatabase);
  });

  it('register → submit → standings delta (db/api + calculateProblemScore)', async () => {
    await ensureSeeded(seedDatabase);
    const contestId = 'contest_dever_round1';
    const submitterId = 'e2e_submitter_flowA';

    // đảm bảo user tồn tại (memStore)
    await db.put('users', { id: submitterId, username: submitterId, email: submitterId + '@fpt.edu.vn', password_hash: 'mock', full_name: 'E2E Submitter', clan_id: null, rating: 1400, max_rating: 1400, rank_tier: 'Specialist', role: 'PARTICIPANT' });

    // cleanup submissions cũ của user để test deterministic
    const oldSubs = await db.query('submissions', s => s.user_id === submitterId);
    for (const s of oldSubs) await db.delete('submissions', s.id);
    await api.registerForContest(contestId, submitterId);

    // verify calculateProblemScore baseline
    const expectFloor = Math.floor(0.3 * 1000);
    assert.equal(calculateProblemScore(1000, 9999, 0), expectFloor);
    assert.equal(calculateProblemScore(500, 0, 0), 500);

    // nộp bài AC → được điểm
    const source = '#include <iostream>\nusing namespace std;\nint main(){ long long n; cin>>n; cout<<n*2; }';
    const sub = await api.createSubmission({ contest_id: contestId, problem_id: 'p102', language: 'CPP20', source_code: source, user_id: submitterId });
    assert.ok(sub.id, 'submission phải có id');
    assert.equal(sub.verdict, 'AC');
    // points phải khớp scoring engine (cho phép sai lệch 1 phút do elapsed)
    const contest = await api.getContest(contestId);
    let elapsed = 0;
    try { elapsed = Math.max(0, Math.floor((Date.now() - new Date(contest.start_time).getTime()) / 60000)); } catch { elapsed = 0; }
    elapsed = Math.min(elapsed, contest.duration_minutes || 120);
    const expectedScore = calculateProblemScore(1000, elapsed, 0);
    // chấp nhận lệch do timing 1 phút (max 4 điểm với 1000 base)
    assert.ok(Math.abs(sub.points_awarded - expectedScore) <= 4, `points_awarded ${sub.points_awarded} vs expected ${expectedScore} elapsed ${elapsed}`);
    assert.ok(sub.points_awarded >= expectFloor);

    // standings phản ánh điểm
    const standings = await api.getStandings(contestId);
    const mine = standings.find(s => s.user_id === submitterId);
    assert.ok(mine, 'submitter phải có trong standings sau khi nộp');
    assert.equal(mine.total_score, sub.points_awarded, 'total phải bằng điểm submission');

    // verify standings vẫn sorted giảm dần
    for (let i = 1; i < standings.length; i++) {
      assert.ok(standings[i - 1].total_score >= standings[i].total_score);
    }

    // cleanup: xóa submission + participants + user tạo ra, giữ seed sạch
    try { await db.delete('submissions', sub.id); } catch {}
    try { await db.delete('contest_participants', `${contestId}:${submitterId}`); } catch {}
    try { await db.delete('users', submitterId); } catch {}
  });
});

describe('E2E Flow (b) — admin publish problem → DB có → getProblems filter', () => {
  before(async () => { await ensureSeeded(seedDatabase); });

  it('publish via db.put và verify getProblems filter (tag/rating/search/contest_id)', async () => {
    await ensureSeeded(seedDatabase);
    const contestId = 'contest_dever_round1';
    const probId = 'p_e2e_pub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const adminProb = {
      id: probId,
      contest_id: contestId,
      code: 'Z',
      title: 'E2E Published Problem Omega',
      statement_markdown: 'Statement Omega cho E2E test — tìm max xor',
      editorial_markdown: 'Editorial Omega',
      time_limit_ms: 1000,
      memory_limit_kb: 262144,
      base_points: 1800,
      tags: ['e2e', 'graphs'],
      solved_count: 0
    };

    // simulate Polygon CMS publish
    await db.put('problems', adminProb);
    const got = await db.get('problems', probId);
    assert.ok(got, 'DB phải có problem sau publish');
    assert.equal(got.title, adminProb.title);
    assert.equal(got.base_points, 1800);
    assert.deepEqual(got.tags, ['e2e', 'graphs']);

    // filter theo contest_id
    let byContest = await api.getProblems({ contest_id: contestId });
    assert.ok(byContest.some(p => p.id === probId), 'getProblems contest_id phải chứa bài mới');
    const beforeCountContest = byContest.length;

    // filter tag e2e
    let byTag = await api.getProblems({ tag: 'e2e' });
    assert.ok(byTag.some(p => p.id === probId));
    // tag không tồn tại
    let byTagMiss = await api.getProblems({ tag: 'nonexist_e2e_xyz' });
    assert.ok(!byTagMiss.some(p => p.id === probId));

    // rating filters: base_points 1800 duy nhất, nên min/max 1800 trả về đúng 1
    let exactRating = await api.getProblems({ min_rating: 1800, max_rating: 1800 });
    assert.ok(exactRating.some(p => p.id === probId), 'exact rating 1800 phải chứa bài mới');
    assert.equal(exactRating.length, 1, 'chỉ có bài E2E có 1800 điểm');

    let min1900 = await api.getProblems({ min_rating: 1900 });
    assert.ok(!min1900.some(p => p.id === probId), 'min_rating 1900 phải loại bài 1800');

    let max1700 = await api.getProblems({ max_rating: 1700 });
    assert.ok(!max1700.some(p => p.id === probId), 'max_rating 1700 phải loại bài 1800');

    let min1700 = await api.getProblems({ min_rating: 1700 });
    assert.ok(min1700.some(p => p.id === probId), 'min_rating 1700 phải chứa 1800');

    // search theo title/code/tag
    let bySearchTitle = await api.getProblems({ search: 'Omega' });
    assert.ok(bySearchTitle.some(p => p.id === probId));
    let bySearchCode = await api.getProblems({ search: 'Z' });
    // code Z có thể trùng nhưng phải chứa bài mới
    assert.ok(bySearchCode.some(p => p.id === probId));
    let bySearchTag = await api.getProblems({ search: 'e2e' });
    assert.ok(bySearchTag.some(p => p.id === probId));
    let bySearchMiss = await api.getProblems({ search: '__no_match_e2e__' });
    assert.ok(!bySearchMiss.some(p => p.id === probId));

    // getProblem detail
    const detail = await api.getProblem(probId);
    assert.equal(detail.id, probId);
    assert.equal(detail.title, adminProb.title);

    // cleanup
    await db.delete('problems', probId);
    const after = await db.get('problems', probId);
    assert.equal(after, null, 'sau khi delete phải null');
    let afterContest = await api.getProblems({ contest_id: contestId });
    assert.equal(afterContest.length, beforeCountContest - 1);
  });

  it('admin publish không ảnh hưởng seed problems (A-E) và filter kết hợp', async () => {
    await ensureSeeded(seedDatabase);
    // đảm bảo 5 bài seed vẫn tồn tại
    const all = await api.getProblems();
    assert.ok(all.length >= 5);
    const pA = all.find(p => p.code === 'A');
    const pB = all.find(p => p.code === 'B');
    assert.ok(pA); assert.ok(pB);
    assert.equal(pA.base_points, 500);
    assert.equal(pB.base_points, 1000);
    // filter kết hợp contest_id + tag
    const combined = await api.getProblems({ contest_id: 'contest_dever_round1', tag: 'math' });
    assert.ok(combined.length >= 1);
    // math tag có ở p101 và p102
    assert.ok(combined.every(p => p.tags.includes('math')));
  });
});

describe('E2E Flow (c) — contest lifecycle REGISTRATION→CODING→FINISHED qua ContestManager (3 phase)', () => {
  it('lifecycle đầy đủ và enforce phase rules (ContestManager)', async () => {
    const cm = new ContestManager({ id: 'e2e_cm_' + Date.now(), title: 'E2E Lifecycle Contest', codingDurationMinutes: 120 });
    assert.equal(cm.currentPhase, CONTEST_PHASES.REGISTRATION);
    assert.equal(cm.canSubmitSolution(), false);

    // đăng ký 3 user ở REGISTRATION
    cm.registerUser('e2e_alice');
    cm.registerUser('e2e_bob');
    cm.registerUser('e2e_carol');
    assert.equal(cm.registeredUsers.size, 3);

    // không được nhảy cóc phase
    assert.throws(() => cm.finishContest(), /Chỉ có thể kết thúc contest/);

    // chuyển sang CODING
    cm.startCodingPhase();
    assert.equal(cm.currentPhase, CONTEST_PHASES.CODING);
    assert.equal(cm.canSubmitSolution(), true);
    // đã qua REGISTRATION nên register phải throw
    assert.throws(() => cm.registerUser('e2e_dave'), /Chỉ có thể đăng ký/);
    // trong CODING: cấm xem code người khác
    assert.equal(cm.canViewSourceCode('e2e_alice', 'e2e_alice'), true);
    assert.equal(cm.canViewSourceCode('e2e_alice', 'e2e_bob'), false);
    // scoring vẫn tính được trong CODING
    const s1 = calculateProblemScore(1000, 10, 0); // 1000 -40 =960
    assert.equal(s1, 960);

    // không được nhảy CODING → REGISTRATION (không có API)
    assert.throws(() => cm.startCodingPhase(), /Chỉ có thể bắt đầu Coding Phase/);

    // chốt: CODING → FINISHED
    cm.finishContest();
    assert.equal(cm.currentPhase, CONTEST_PHASES.FINISHED);
    assert.equal(cm.canSubmitSolution(), false);
    // FINISHED: ai cũng xem được code (upsolving)
    assert.equal(cm.canViewSourceCode('e2e_alice', 'e2e_bob'), true);
    assert.equal(cm.canViewSourceCode('e2e_bob', 'e2e_alice'), true);
  });

  it('ContestManager tính điểm với calculateProblemScore trong suốt lifecycle', async () => {
    const cm = new ContestManager({ id: 'e2e_score_' + Date.now(), title: 'Score Lifecycle' });
    cm.registerUser('scorer');
    cm.startCodingPhase();
    // mô phỏng nộp bài ở phút 50, 1 lần sai, base 1500 -> timePenalty 300 + 50 =1150
    const score = calculateProblemScore(1500, 50, 1);
    assert.equal(score, 1150);
    // phút 119 sai 10 lần với 500 điểm -> sàn 150
    assert.equal(calculateProblemScore(500, 119, 10), 150);
    cm.finishContest();
    assert.equal(cm.currentPhase, CONTEST_PHASES.FINISHED);
  });
});

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { db, ensureSeeded } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { api } from '../src/db/api.js';
import { ContestManager, CONTEST_PHASES } from '../src/core/contestStateMachine.js';
import { calculateProblemScore, calculateHackScore } from '../src/core/scoring.js';

// E2E flow test không cần browser, chỉ dùng db/api + core
// (a) user đăng ký → nộp bài → hack thành công → standings thay đổi
// (b) admin publish problem → DB có → getProblems filter
// (c) contest lifecycle REGISTRATION→CODING→HACK→FINISHED qua ContestManager

describe('E2E Flow (a) — user đăng ký → nộp bài → hack thành công → standings thay đổi', () => {
  before(async () => {
    await ensureSeeded(seedDatabase);
  });

  it('register → submit vulnerable → successful hack → standings delta (db/api + calculateProblemScore)', async () => {
    await ensureSeeded(seedDatabase);
    const contestId = 'contest_dever_round1';
    const victimId = 'e2e_victim_flowA';
    const hackerId = 'e2e_hacker_flowA';

    // đảm bảo users tồn tại (memStore)
    await db.put('users', { id: victimId, username: victimId, email: victimId + '@fpt.edu.vn', password_hash: 'mock', full_name: 'E2E Victim', clan_id: null, rating: 1400, max_rating: 1400, rank_tier: 'Specialist', role: 'PARTICIPANT' });
    await db.put('users', { id: hackerId, username: hackerId, email: hackerId + '@fpt.edu.vn', password_hash: 'mock', full_name: 'E2E Hacker', clan_id: null, rating: 1500, max_rating: 1500, rank_tier: 'Specialist', role: 'PARTICIPANT' });

    // cleanup submissions/hacks cũ của 2 user để test deterministic
    const oldSubs = await db.query('submissions', s => s.user_id === victimId || s.user_id === hackerId);
    for (const s of oldSubs) await db.delete('submissions', s.id);
    const oldHacks = await db.query('hack_events', h => h.hacker_id === hackerId || h.hacker_id === victimId);
    for (const h of oldHacks) await db.delete('hack_events', h.id);
    // ensure participants in same room
    await api.registerForContest(contestId, victimId, 'Room #1');
    await api.registerForContest(contestId, hackerId, 'Room #1');
    // also clear any prior hacks for deterministic standings
    // (không clear toàn bộ hack_events để tránh vỡ test khác, chỉ clear của 2 user)
    // verify calculateProblemScore baseline
    const expectFloor = Math.floor(0.3 * 1000);
    assert.equal(calculateProblemScore(1000, 9999, 0), expectFloor);
    assert.equal(calculateProblemScore(500, 0, 0), 500);

    // victim nộp bài vulnerable (int total + vector<int> + không long long) → sẽ AC và hackable
    const vulnerableSource = '#include <iostream>\n#include <vector>\nusing namespace std;\nint main(){ int n; cin>>n; vector<int> a(n); for(int i=0;i<n;i++)cin>>a[i]; int total=0; for(int i=0;i<n;i++) for(int j=i+1;j<n;j++) total+=a[i]*a[j]; cout<<total; }';
    const sub = await api.createSubmission({ contest_id: contestId, problem_id: 'p102', language: 'CPP20', source_code: vulnerableSource, user_id: victimId });
    assert.ok(sub.id, 'submission phải có id');
    assert.equal(sub.verdict, 'AC');
    assert.equal(sub.is_hacked, false);
    // points phải khớp scoring engine (cho phép sai lệch 1 phút do elapsed)
    const contest = await api.getContest(contestId);
    let elapsed = 0;
    try { elapsed = Math.max(0, Math.floor((Date.now() - new Date(contest.start_time).getTime()) / 60000)); } catch { elapsed = 0; }
    elapsed = Math.min(elapsed, contest.duration_minutes || 135);
    const expectedScore = calculateProblemScore(1000, elapsed, 0);
    // api createSubmission đếm wrongAttempts 0 lần đầu nên phải bằng expected hoặc gần
    // chấp nhận lệch do timing 1 phút (max 4 điểm với 1000 base)
    assert.ok(Math.abs(sub.points_awarded - expectedScore) <= 4, `points_awarded ${sub.points_awarded} vs expected ${expectedScore} elapsed ${elapsed}`);
    assert.ok(sub.points_awarded >= expectFloor);

    // standings trước hack
    let standingsBefore = await api.getStandings(contestId);
    let victimBefore = standingsBefore.find(s => s.user_id === victimId);
    let hackerBefore = standingsBefore.find(s => s.user_id === hackerId);
    assert.ok(victimBefore, 'victim phải có trong standings sau khi nộp');
    assert.ok(hackerBefore, 'hacker phải có trong standings sau khi register');
    const victimScoreBefore = victimBefore.total_score;
    const hackerScoreBefore = hackerBefore.total_score;
    assert.equal(victimScoreBefore, sub.points_awarded, 'victim total trước hack phải bằng điểm submission');
    assert.equal(hackerBefore.hack_score, 0);
    // hack_score theo core
    assert.equal(calculateHackScore(1, 0), 100);
    assert.equal(calculateHackScore(0, 1), -50);

    // thực hiện hack thành công: dùng test lớn chứa 1000000/200000 để trigger isBigTest + vulnerable heuristic
    const bigPayload = '200000\n' + '1000000 '.repeat(10) + '100000 ';
    const hackRes = await api.executeHack({ contest_id: contestId, hacker_id: hackerId, target_submission_id: sub.id, test_payload: bigPayload });
    assert.equal(hackRes.success, true);
    assert.equal(hackRes.verdict, 'SUCCESSFUL_HACK');
    assert.equal(hackRes.points_delta, 100);
    assert.equal(hackRes.points_earned, 100);
    assert.equal(hackRes.is_successful, true);
    // DB phản ánh hacked
    const afterSub = await db.get('submissions', sub.id);
    assert.equal(afterSub.is_hacked, true);
    assert.equal(afterSub.verdict, 'HACKED');
    const hacks = await db.getAll('hack_events');
    assert.ok(hacks.some(h => h.target_submission_id === sub.id && h.is_successful === true && h.hacker_id === hackerId));

    // standings sau hack phải thay đổi
    const standingsAfter = await api.getStandings(contestId);
    const victimAfter = standingsAfter.find(s => s.user_id === victimId);
    const hackerAfter = standingsAfter.find(s => s.user_id === hackerId);
    assert.ok(victimAfter);
    assert.ok(hackerAfter);
    // victim bị mất điểm (submission hacked bị loại)
    assert.ok(victimAfter.total_score < victimScoreBefore, `victim after ${victimAfter.total_score} phải < before ${victimScoreBefore}`);
    assert.equal(victimAfter.total_score, 0, 'victim sau hack phải 0 vì chỉ có 1 bài và đã bị hacked');
    // hacker tăng 100
    assert.equal(hackerAfter.hack_score, (hackerBefore.hack_score || 0) + 100);
    assert.equal(hackerAfter.total_score, hackerScoreBefore + 100);
    assert.equal(hackerAfter.hack_success, (hackerBefore.hack_success || 0) + 1);

    // verify standings vẫn sorted giảm dần
    for (let i = 1; i < standingsAfter.length; i++) {
      assert.ok(standingsAfter[i - 1].total_score >= standingsAfter[i].total_score);
    }

    console.log(`[E2E A] victim ${victimId} before=${victimScoreBefore} after=${victimAfter.total_score} hacker before=${hackerScoreBefore} after=${hackerAfter.total_score} hack=${hackRes.hack.id}`);

    // cleanup: xóa submission + hack event tạo ra, giữ users/participants để không vỡ seed khác
    // nếu fail ở trên vẫn cleanup
    try { await db.delete('submissions', sub.id); } catch {}
    try { if (hackRes.hack?.id) await db.delete('hack_events', hackRes.hack.id); } catch {}
    // optional: xóa participants của e2e để standings sau không còn 2 user lạ (giữ sạch)
    try { await db.delete('contest_participants', `${contestId}:${victimId}`); } catch {}
    try { await db.delete('contest_participants', `${contestId}:${hackerId}`); } catch {}
    // xóa users e2e (không ảnh hưởng seed chính)
    try { await db.delete('users', victimId); } catch {}
    try { await db.delete('users', hackerId); } catch {}
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

    // simulate Polygon CMS publish (js/app.js: db.put problems)
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

    console.log(`[E2E B] published ${probId} base_points=1800 tags=e2e countContest=${beforeCountContest} searchOmega=${bySearchTitle.length}`);

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
    console.log(`[E2E B2] seed problems ok, combined math filter=${combined.length}`);
  });
});

describe('E2E Flow (c) — contest lifecycle REGISTRATION→CODING→HACK→FINISHED qua ContestManager', () => {
  it('lifecycle đầy đủ và enforce phase rules (ContestManager)', async () => {
    const cm = new ContestManager({ id: 'e2e_cm_' + Date.now(), title: 'E2E Lifecycle Contest', codingDurationMinutes: 120, hackDurationMinutes: 15 });
    assert.equal(cm.currentPhase, CONTEST_PHASES.REGISTRATION);
    assert.equal(cm.canSubmitSolution(), false);

    // đăng ký 3 user ở REGISTRATION
    cm.registerUser('e2e_alice');
    cm.registerUser('e2e_bob');
    cm.registerUser('e2e_carol');
    assert.equal(cm.registeredUsers.size, 3);

    // không được nhảy cóc phase
    assert.throws(() => cm.startHackPhase(), /Chỉ có thể chuyển sang Hack Phase/);
    assert.throws(() => cm.startSystemTesting(), /Chỉ có thể chạy System Testing/);
    assert.throws(() => cm.finishContest(), /Chỉ có thể kết thúc contest/);

    // chuyển sang CODING
    cm.startCodingPhase();
    assert.equal(cm.currentPhase, CONTEST_PHASES.CODING);
    assert.equal(cm.canSubmitSolution(), true);
    // đã qua REGISTRATION nên register phải throw
    assert.throws(() => cm.registerUser('e2e_dave'), /Chỉ có thể đăng ký/);
    // trong CODING: cấm hack, cấm xem code người khác
    assert.equal(cm.canViewSourceCode('e2e_alice', 'e2e_alice'), true);
    assert.equal(cm.canViewSourceCode('e2e_alice', 'e2e_bob'), false);
    assert.equal(cm.canPerformHack('e2e_alice', 'e2e_bob').allowed, false);
    // scoring vẫn tính được trong CODING
    const s1 = calculateProblemScore(1000, 10, 0); // 1000 -40 =960
    assert.equal(s1, 960);
    assert.equal(calculateHackScore(0, 0), 0);

    // chuyển sang HACK
    cm.startHackPhase();
    assert.equal(cm.currentPhase, CONTEST_PHASES.HACK_PHASE);
    assert.equal(cm.canSubmitSolution(), false, 'HACK phase cấm submit');
    // rooms đã chia: 3 user với max 25 => 1 room
    assert.equal(cm.rooms.size, 1);
    assert.equal(cm.getRoomForUser('e2e_alice'), 'Room #1');
    assert.equal(cm.getRoomForUser('e2e_bob'), 'Room #1');
    // cùng room được hack và xem code
    assert.equal(cm.canViewSourceCode('e2e_alice', 'e2e_bob'), true);
    assert.deepEqual(cm.canPerformHack('e2e_alice', 'e2e_bob'), { allowed: true });
    // tự hack bị cấm
    const selfHack = cm.canPerformHack('e2e_alice', 'e2e_alice');
    assert.equal(selfHack.allowed, false);
    assert.match(selfHack.reason, /Không thể tự hack/);
    // khác room bị cấm: tạo contest 30 user để có 2 rooms
    const cm2 = new ContestManager({ id: 'e2e_cm2_' + Date.now(), title: 'E2E Room Split' });
    for (let i = 1; i <= 30; i++) cm2.registerUser('u_' + i);
    cm2.startCodingPhase();
    assert.equal(cm2.rooms.size, 2, '30 user với 25/room phải ra 2 rooms');
    assert.equal(cm2.getRoomForUser('u_1'), 'Room #1');
    assert.equal(cm2.getRoomForUser('u_26'), 'Room #2');
    cm2.startHackPhase();
    const diffRoom = cm2.canPerformHack('u_1', 'u_26');
    assert.equal(diffRoom.allowed, false);
    assert.match(diffRoom.reason, /cùng một Room/);
    assert.equal(cm2.canPerformHack('u_1', 'u_2').allowed, true);

    // không được nhảy từ HACK sang FINISHED
    assert.throws(() => cm.finishContest(), /Chỉ có thể kết thúc contest/);
    // đúng trình tự: HACK -> SYSTEM_TESTING -> FINISHED
    cm.startSystemTesting();
    assert.equal(cm.currentPhase, CONTEST_PHASES.SYSTEM_TESTING);
    assert.equal(cm.canSubmitSolution(), false);
    assert.throws(() => cm.startHackPhase(), /Chỉ có thể chuyển sang Hack Phase/);
    cm.finishContest();
    assert.equal(cm.currentPhase, CONTEST_PHASES.FINISHED);
    // FINISHED: ai cũng xem được code, vẫn cấm submit
    assert.equal(cm.canViewSourceCode('e2e_alice', 'e2e_bob'), true);
    assert.equal(cm.canViewSourceCode('e2e_bob', 'e2e_alice'), true);
    assert.equal(cm.canSubmitSolution(), false);
    assert.equal(cm.canPerformHack('e2e_alice', 'e2e_bob').allowed, false);

    // distributeRooms edge: 0 user -> 0 rooms
    const cmEmpty = new ContestManager({ id: 'e2e_empty', title: 'Empty' });
    cmEmpty.startCodingPhase();
    assert.equal(cmEmpty.rooms.size, 0);

    console.log(`[E2E C] lifecycle ${CONTEST_PHASES.REGISTRATION}→${CONTEST_PHASES.CODING}→${CONTEST_PHASES.HACK_PHASE}→${CONTEST_PHASES.SYSTEM_TESTING}→${CONTEST_PHASES.FINISHED} rooms=${cm.rooms.size} cm2_rooms=${cm2.rooms.size}`);
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
    cm.startHackPhase();
    // hack score trong HACK phase
    assert.equal(calculateHackScore(2, 1), 150);
    cm.startSystemTesting();
    cm.finishContest();
    assert.equal(cm.currentPhase, CONTEST_PHASES.FINISHED);
    console.log(`[E2E C2] scoring lifecycle ok score=${score}`);
  });
});

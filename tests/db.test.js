import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db, ensureSeeded } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { api } from '../src/db/api.js';

describe('DEVER Arena DB (IndexedDB fallback)', () => {
  it('seed tạo đủ bảng và dữ liệu mẫu', async () => {
    for (const t of ['users','contests','problems','submissions','discussions','clans']) {
      await db.clear(t);
    }
    for (const t of ['testcases','contest_participants','analytics','virtual_sessions']) {
      await db.clear(t);
    }
    const seeded = await ensureSeeded(seedDatabase);
    assert.equal(seeded, true);
    const contests = await db.getAll('contests');
    assert.ok(contests.length >= 1);
    assert.equal(contests[0].slug, 'dever-round-1-div3');
    const problems = await db.getAll('problems');
    assert.ok(problems.length >= 5);
    const clanStore = await db.getAll('clans');
    assert.ok(Array.isArray(clanStore));
  });

  it('CRUD submissions: put → get → query → delete', async () => {
    const sub = { id: 'sub_test_1', user_id: 'user_me', problem_id: 'p101', contest_id: 'contest_dever_round1', language: 'CPP20', source_code: 'int main(){}', verdict: 'AC', execution_time_ms: 10, memory_used_kb: 1000, points_awarded: 500, submitted_at: new Date().toISOString() };
    await db.put('submissions', sub);
    const got = await db.get('submissions', 'sub_test_1');
    assert.equal(got.verdict, 'AC');
    const q = await db.query('submissions', s => s.problem_id === 'p101');
    assert.ok(q.length >= 1);
    await db.delete('submissions', 'sub_test_1');
    const after = await db.get('submissions', 'sub_test_1');
    assert.equal(after, null);
  });

  it('problems query theo contest_id', async () => {
    const list = await db.query('problems', p => p.contest_id === 'contest_dever_round1');
    assert.ok(list.length >= 5);
  });

  it('ensureSeeded không seed lại khi đã có data', async () => {
    const second = await ensureSeeded(seedDatabase);
    assert.equal(second, false);
  });
});

describe('DEVER Arena Mock API — api.getStandings', () => {
  it('returns sorted standings (điểm chỉ từ bài AC, không còn hack score)', async () => {
    await ensureSeeded(seedDatabase);
    const standings = await api.getStandings('contest_dever_round1');
    assert.ok(Array.isArray(standings));
    assert.ok(standings.length >= 3);
    for (let i = 1; i < standings.length; i++) {
      assert.ok(standings[i-1].total_score >= standings[i].total_score, `standings not sorted at ${i}`);
    }
    const c1 = standings.find(s => s.user_id === 'c1');
    assert.ok(c1, 'c1 should be in standings');
    // c1 có 1 bài AC 872 → total đúng bằng điểm bài nộp
    assert.equal(c1.total_score, c1.problem_score);
    assert.equal(c1.hack_score, undefined, 'không còn trường hack_score (ADR-005)');
  });

  it('wrappers getContests/getProblems/createSubmission + seed integrity', async () => {
    const contests = await api.getContests();
    assert.ok(contests.length >= 1);
    assert.ok(contests.some(c => c.slug === 'dever-round-1-div3'));
    const problems = await api.getProblems();
    assert.ok(problems.length >= 5);
    const pA = problems.find(p => p.code === 'A');
    const pB = problems.find(p => p.code === 'B');
    const pC = problems.find(p => p.code === 'C');
    const pD = problems.find(p => p.code === 'D');
    const pE = problems.find(p => p.code === 'E');
    assert.equal(pA.base_points, 500);
    assert.equal(pB.base_points, 1000);
    assert.equal(pC.base_points, 1500);
    assert.equal(pD.base_points, 1900);
    assert.equal(pE.base_points, 2400);
    const tcs = await db.query('testcases', tc => tc.problem_id === 'p101');
    assert.equal(tcs.length, 3);
    assert.ok(tcs.some(tc => tc.is_sample === true));
    assert.ok(tcs.some(tc => tc.is_sample === false));
    const newSub = await api.createSubmission({ contest_id: 'contest_dever_round1', problem_id: 'p101', language: 'CPP20', source_code: 'int main(){return 0;}', user_id: 'user_me' });
    assert.ok(newSub.id);
    assert.equal(newSub.problem_id, 'p101');
    assert.ok(['AC','WA'].includes(newSub.verdict));
    assert.equal(newSub.is_hacked, undefined, 'submission không còn is_hacked (ADR-005)');
    await db.delete('submissions', newSub.id);
  });
});

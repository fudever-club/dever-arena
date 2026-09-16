import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db, ensureSeeded } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { api } from '../src/db/api.js';

describe('DEVER Arena DB (IndexedDB fallback)', () => {
  it('seed tạo đủ bảng và dữ liệu mẫu', async () => {
    for (const t of ['users','contests','problems','submissions','hack_events','discussions','clans']) {
      await db.clear(t);
    }
    // also clear new stores introduced for Crew-A task
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
    const clans = await db.getAll('clans');
    assert.equal(clans.length, 6);
  });

  it('CRUD submissions: put → get → query → delete', async () => {
    const sub = { id: 'sub_test_1', user_id: 'user_me', problem_id: 'p101', contest_id: 'contest_dever_round1', language: 'CPP20', source_code: 'int main(){}', verdict: 'AC', execution_time_ms: 10, memory_used_kb: 1000, points_awarded: 500, is_hacked: false, submitted_at: new Date().toISOString() };
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

describe('DEVER Arena Mock API — api.executeHack', () => {
  it('SUCCESSFUL_HACK marks submission HACKED and rewards +100', async () => {
    await ensureSeeded(seedDatabase);
    // reset hacks for determinism but keep contest
    await db.clear('hack_events');
    let vuln = await db.get('submissions', 'sub_vuln_c3_b');
    if (!vuln) {
      vuln = { id: 'sub_vuln_c3_b', user_id: 'c3', problem_id: 'p102', contest_id: 'contest_dever_round1', language: 'CPP20', source_code: '#include <iostream>\n#include <vector>\nusing namespace std;\nint main(){ int n; cin>>n; vector<int> a(n); for(int i=0;i<n;i++)cin>>a[i]; int total=0; for(int i=0;i<n;i++) for(int j=i+1;j<n;j++) total+=a[i]*a[j]; cout<<total; }', verdict: 'AC', execution_time_ms: 120, memory_used_kb: 2900, points_awarded: 808, is_hacked: false, submitted_at: new Date().toISOString() };
      await db.put('submissions', vuln);
    } else if (vuln.is_hacked) {
      vuln.is_hacked = false; vuln.verdict = 'AC'; await db.put('submissions', vuln);
    }
    const res = await api.executeHack({ contest_id: 'contest_dever_round1', hacker_id: 'c1', target_submission_id: 'sub_vuln_c3_b', test_payload: '200000\n1000000 1000000 ...' });
    assert.equal(res.success, true);
    assert.equal(res.verdict, 'SUCCESSFUL_HACK');
    assert.equal(res.points_delta, 100);
    assert.equal(res.points_earned, 100);
    const after = await db.get('submissions', 'sub_vuln_c3_b');
    assert.equal(after.is_hacked, true);
    assert.equal(after.verdict, 'HACKED');
    const hacks = await db.getAll('hack_events');
    assert.ok(hacks.length >= 1);
    assert.ok(hacks.some(h => h.target_submission_id === 'sub_vuln_c3_b' && h.is_successful === true));
  });

  it('UNSUCCESSFUL_HACK penalizes -50 and keeps submission intact', async () => {
    const safeSub = { id: 'sub_safe_test', user_id: 'c2', problem_id: 'p102', contest_id: 'contest_dever_round1', language: 'CPP20', source_code: '#include <bits/stdc++.h>\nusing namespace std; int main(){ long long sum=0; long long x; }', verdict: 'AC', execution_time_ms: 45, memory_used_kb: 2450, points_awarded: 780, is_hacked: false, submitted_at: new Date().toISOString() };
    await db.put('submissions', safeSub);
    const res = await api.executeHack({ contest_id: 'contest_dever_round1', hacker_id: 'user_me', target_submission_id: 'sub_safe_test', test_payload: '3\n1 2 3' });
    assert.equal(res.success, false);
    assert.equal(res.verdict, 'UNSUCCESSFUL_HACK');
    assert.equal(res.penalty, -50);
    assert.equal(res.points_delta, -50);
    const after = await db.get('submissions', 'sub_safe_test');
    assert.equal(after.is_hacked, false);
    await db.delete('submissions', 'sub_safe_test');
  });
});

describe('DEVER Arena Mock API — api.getStandings', () => {
  it('returns sorted standings with hack scores', async () => {
    await ensureSeeded(seedDatabase);
    const standings = await api.getStandings('contest_dever_round1');
    assert.ok(Array.isArray(standings));
    assert.ok(standings.length >= 3);
    for (let i = 1; i < standings.length; i++) {
      assert.ok(standings[i-1].total_score >= standings[i].total_score, `standings not sorted at ${i}`);
    }
    const c1 = standings.find(s => s.user_id === 'c1');
    assert.ok(c1, 'c1 should be in standings');
    // c1 has AC 872 + successful hack 100 = 972 minimum
    assert.ok(c1.total_score >= 972, `c1 total ${c1.total_score} expected >=972`);
    const c3 = standings.find(s => s.user_id === 'c3');
    if (c3) {
      // c3 vulnerable submission was hacked, so should have 0 from that problem (filtered)
      assert.ok(c3.total_score < 808, `c3 total ${c3.total_score} should be <808 after hacked`);
    }
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
    assert.ok(tcs.some(tc => tc.is_sample === true && tc.is_pretest === true));
    assert.ok(tcs.some(tc => tc.is_sample === false));
    const newSub = await api.createSubmission({ contest_id: 'contest_dever_round1', problem_id: 'p101', language: 'CPP20', source_code: 'int main(){return 0;}', user_id: 'user_me' });
    assert.ok(newSub.id);
    assert.equal(newSub.problem_id, 'p101');
    assert.ok(['AC','WA'].includes(newSub.verdict));
    await db.delete('submissions', newSub.id);
  });
});

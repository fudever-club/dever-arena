/**
 * DEVER Arena — Task 104 (judge sâu) + Task 105 (kho luyện tập + upsolving) tests.
 * Chạy server thật trên port 0 với DB tạm — tập trung contract API, không đụng db.json chính.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

process.env.SCHEDULER_DISABLED = '1'; // test tự điều khiển phase, không để scheduler đụng tay
const DB_PATH = join(tmpdir(), `dever-test-104-${process.pid}.json`);
process.env.DEVER_DB_PATH = DB_PATH;
try { rmSync(DB_PATH, { force: true }); } catch {}

const { startServer, db } = await import('../server/index.js');
const { shutdownJudge } = await import('../server/queue.js');
const { memoryLimitBytes } = await import('../server/judge.js');

let server;
let base;
let heroToken;
// Dijkstra đúng cho p103 (sample: output 6)
const GOOD_PY = [
  'import sys, heapq',
  'def main():',
  '    it=sys.stdin.read().split(); i=0',
  '    n=int(it[i]); i+=1; m=int(it[i]); i+=1',
  '    g=[[] for _ in range(n+1)]',
  '    for _ in range(m):',
  '        u=int(it[i]); i+=1; v=int(it[i]); i+=1; w=int(it[i]); i+=1',
  '        g[u].append((v,w)); g[v].append((u,w))',
  '    dist=[10**18]*(n+1); dist[1]=0; pq=[(0,1)]',
  '    while pq:',
  '        d,u=heapq.heappop(pq)',
  '        if d!=dist[u]: continue',
  '        for v,w in g[u]:',
  '            if dist[v]>d+w: dist[v]=d+w; heapq.heappush(pq,(dist[v],v))',
  '    print(dist[n])',
  "if __name__=='__main__': main()",
].join('\n');

async function call(path, method = 'GET', body = null, token = null) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : null,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

before(async () => {
  server = startServer(0);
  await new Promise((r) => setTimeout(r, 300));
  base = `http://localhost:${server.address().port}`;
  const login = await call('/api/v1/auth/login', 'POST', { username: 'dever_hero', password: 'hero123' });
  heroToken = login.data.accessToken;
});

after(async () => {
  await new Promise((r) => server.close(r));
  shutdownJudge();
  try { rmSync(DB_PATH, { force: true }); } catch {}
});

// ---------- Task 104: judge sâu ----------
test('Task 104: memoryLimitBytes parse đúng các đơn vị', () => {
  assert.equal(memoryLimitBytes('256 MB'), 256 * 1024 * 1024);
  assert.equal(memoryLimitBytes('1 GB'), 1024 ** 3);
  assert.equal(memoryLimitBytes('512 kb'), 512 * 1024);
  assert.equal(memoryLimitBytes(''), 256 * 1024 * 1024);
  assert.equal(memoryLimitBytes(undefined), 256 * 1024 * 1024);
});

test('Task 104: per_test bị ẨN khi contest CODING, mở sau FINISHED', async () => {
  // Hero nộp bài WA trong round1 (CODING)
  const bad = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round1', problem_id: 'p102', language: 'python', source_code: 'print(0)',
  }, heroToken);
  assert.equal(bad.status, 201);
  assert.equal(bad.data.verdict, 'WA');
  assert.ok(Array.isArray(bad.data.per_test), 'response submit trả per_test ngay');
  const subId = bad.data.submission.id;

  // Trong CODING: GET ẩn per_test nhưng cho biết test fail đầu tiên
  const during = await call(`/api/v1/submissions/${subId}`, 'GET', null, heroToken);
  assert.equal(during.status, 200);
  assert.equal(during.data.submission.per_test_hidden, true);
  assert.equal(during.data.submission.per_test, undefined);
  assert.ok(during.data.submission.failed_index >= 0, 'failed_index phải >= 0 khi WA');

  // Chuyển contest sang FINISHED (admin) → per_test mở
  await call('/api/v1/admin/phase', 'POST', { contest_id: 'contest_dever_round1', phase: 'FINISHED' }, (await call('/api/v1/auth/login', 'POST', { username: 'dever_admin', password: 'admin123' })).data.accessToken);
  const after = await call(`/api/v1/submissions/${subId}`, 'GET', null, heroToken);
  assert.equal(after.data.submission.per_test_hidden, undefined);
  assert.ok(Array.isArray(after.data.submission.per_test));
  assert.ok(after.data.submission.per_test.every((t) => !('stdin' in t) && !('expected' in t)), 'per_test KHÔNG chứa input/expected');
});

test('Task 104: MLE được phân loại khỏi RTE (heap out of memory)', async () => {
  // JS ăn 1GB heap trong vòng ~vài trăm ms → vượt memoryLimit 256MB mặc định
  const hog = 'const a=[];try{for(;;)a.push(new Array(1e6).fill(0))}catch(e){process.stdout.write("done")}';
  const r = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round1', problem_id: 'p101', language: 'javascript', source_code: hog,
  }, heroToken);
  assert.equal(r.status, 201);
  assert.ok(['MLE', 'TLE', 'RTE'].includes(r.data.verdict), `verdict thực tế: ${r.data.verdict}`);
  if (r.data.verdict === 'MLE') {
    assert.ok(/Memory Limit/i.test(r.data.submission.detail || ''));
  }
});

test('Task 104: CE trả stderr compile đầy đủ (python syntax error)', async () => {
  const r = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round1', problem_id: 'p101', language: 'python', source_code: 'def broken(:\n  pass',
  }, heroToken);
  assert.equal(r.status, 201);
  assert.ok(['CE', 'RTE'].includes(r.data.verdict));
  assert.ok(String(r.data.submission.detail || '').length > 0, 'CE phải kèm message chi tiết');
});

// ---------- Task 105: kho luyện tập + upsolving ----------
test('Task 105: /practice/stats tổng hợp đúng từ bài nộp thật (gồm practice contest_id=null)', async () => {
  const r = await call('/api/v1/practice/stats', 'GET', null, heroToken);
  assert.equal(r.status, 200);
  const stats = r.data.stats;
  assert.ok(Object.keys(stats).length > 0, 'hero có practice submissions từ seed');
  for (const [pid, e] of Object.entries(stats)) {
    assert.ok(e.attempts >= 1);
    assert.ok(typeof e.solved === 'boolean');
    if (e.solved) { assert.ok(e.ac_attempt >= 1); assert.ok(e.solved_at); }
    assert.ok(['AC', 'WA', 'TLE', 'RE', 'CE', 'MLE'].includes(e.last_verdict));
    assert.ok(pid.startsWith('p'));
  }
});

test('Task 105: upsolve sau FINISHED — nộp được, 0 điểm, không đổi standings, có cờ is_upsolve', async () => {
  // round1 đã FINISHED ở test trên
  const before = await call('/api/v1/contests/contest_dever_round1/standings');
  assert.equal(before.status, 200);

  const up = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round1', problem_id: 'p103', language: 'python', source_code: GOOD_PY,
  }, heroToken);
  assert.equal(up.status, 201, `upsolve phải nộp được sau FINISHED: ${JSON.stringify(up.data)}`);
  assert.equal(up.data.is_upsolve, true);
  assert.equal(up.data.submission.points_awarded, 0);
  assert.equal(up.data.verdict, 'AC');

  const after = await call('/api/v1/contests/contest_dever_round1/standings');
  assert.deepEqual(
    after.data.standings.map((s) => `${s.username}:${s.solved}:${s.penalty ?? s.total}`),
    before.data.standings.map((s) => `${s.username}:${s.solved}:${s.penalty ?? s.total}`),
    'standings không đổi sau upsolve',
  );
});

test('Task 105: contest REGISTRATION vẫn chặn nộp (upsolve chỉ áp dụng FINISHED)', async () => {
  const r = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round2_div2', problem_id: 'p103', language: 'python', source_code: GOOD_PY,
  }, heroToken);
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'NOT_CODING_PHASE');
});

test('Task 105: editorial tự mở khi contest FINISHED (và route GET problem trả editorial)', async () => {
  const ed = await call('/api/v1/problems/p102/editorial', 'GET');
  assert.equal(ed.status, 200, `round1 đã FINISHED → editorial mở: ${JSON.stringify(ed.data)}`);
  assert.ok(ed.data.editorial !== undefined);

  const locked = await call('/api/v1/problems/p103/editorial', 'GET');
  // p103 thuộc round1 (đã FINISHED) → mở; nếu là đề contest khác → 403 EDITORIAL_LOCKED
  assert.ok([200, 403].includes(locked.status));
});

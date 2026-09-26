/**
 * DEVER Arena — Polygon stress + blind-tester workflow tests.
 * Server thật trên port ngẫu nhiên, DB file tạm riêng.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

const DB_PATH = join(tmpdir(), `dever-stress-${process.pid}.json`);
process.env.DEVER_DB_PATH = DB_PATH;
try { rmSync(DB_PATH, { force: true }); } catch {}

const { startServer } = await import('../server/index.js');
const { shutdownJudge } = await import('../server/queue.js');

let server;
let base;
let adminToken;
let heroToken;
let hackerToken;
let problemId;

const MODEL = ['import sys', 'def solve():', '    d=sys.stdin.read().strip().split()', '    if not d: return', '    n=int(d[0]); a=list(map(int,d[1:1+n]))', '    print(sum(a))', "if __name__=='__main__': solve()"].join('\n');
const BRUTE = ['import sys', 'def solve():', '    d=sys.stdin.read().strip().split()', '    if not d: return', '    n=int(d[0])', '    t=0', '    for x in d[1:1+n]: t+=int(x)', '    print(t)', "if __name__=='__main__': solve()"].join('\n');
const WRONG = ['print(0)'].join('\n');

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
async function login(username, password) {
  const r = await call('/api/v1/auth/login', 'POST', { username, password });
  assert.equal(r.status, 200);
  return r.data.accessToken;
}

before(async () => {
  server = startServer(0);
  await new Promise((r) => setTimeout(r, 300));
  base = `http://localhost:${server.address().port}`;
  adminToken = await login('dever_admin', 'admin123');
  heroToken = await login('dever_hero', 'hero123');
  hackerToken = await login('hacker_pro', 'dever123');
  const c = await call('/api/v1/admin/problems', 'POST', {
    contest_id: 'contest_dever_round1', code: 'ST', title: 'Stress Fixture',
    statement: 'Tính tổng.', sampleInput: '3\n1 2 3\n', sampleOutput: '6\n',
  }, adminToken);
  assert.equal(c.status, 201);
  problemId = c.data.problem.id;
  assert.equal(c.data.problem.workflow_status, 'DRAFT');
});

after(async () => {
  await new Promise((r) => server.close(r));
  shutdownJudge();
  try { rmSync(DB_PATH, { force: true }); } catch {}
});

test('stress PASS: model vs brute cùng đáp án + gợi ý time limit', async () => {
  const r = await call('/api/v1/admin/stress', 'POST', {
    language: 'python', model_source: MODEL, brute_source: BRUTE,
    count: 5, seed: 'fixture', rules: { maxN: 200 },
  }, adminToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.verdict, 'PASS');
  assert.equal(r.data.ran, 5);
  assert.equal(r.data.passed, 5);
  assert.equal(r.data.failed, 0);
  assert.equal(r.data.outputs.length, 5);
  assert.ok(r.data.suggestedTimeLimitS >= 1);
});

test('stress FAIL: brute sai → mismatches chi tiết', async () => {
  const r = await call('/api/v1/admin/stress', 'POST', {
    language: 'python', model_source: MODEL, brute_source: WRONG,
    count: 5, seed: 'fixture', rules: { maxN: 50 },
  }, adminToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.verdict, 'FAIL');
  assert.ok(r.data.failed > 0);
  assert.ok(r.data.mismatches.length > 0);
  assert.ok(r.data.mismatches[0].stdin);
});

test('stress validate: thiếu source 422, non-admin 403', async () => {
  const missing = await call('/api/v1/admin/stress', 'POST', { language: 'python' }, adminToken);
  assert.equal(missing.status, 422);
  const forbidden = await call('/api/v1/admin/stress', 'POST', { language: 'python', model_source: MODEL, brute_source: BRUTE }, heroToken);
  assert.equal(forbidden.status, 403);
});

test('testcases: lưu → liệt kê → cấm xóa mẫu → xóa được', async () => {
  const created = await call('/api/v1/admin/testcases', 'POST', {
    problem_id: problemId, stdin: '2\n4 6\n', expected_stdout: '10\n', is_pretest: true, strategy: 'manual',
  }, adminToken);
  assert.equal(created.status, 201);
  const list = await call(`/api/v1/admin/testcases?problem_id=${problemId}`, 'GET', null, adminToken);
  assert.equal(list.status, 200);
  assert.ok(list.data.testcases.some((t) => t.id === created.data.testcase.id));
  const sample = list.data.testcases.find((t) => t.is_sample);
  const delSample = await call(`/api/v1/admin/testcases/${sample.id}`, 'DELETE', null, adminToken);
  assert.equal(delSample.status, 409);
  const del = await call(`/api/v1/admin/testcases/${created.data.testcase.id}`, 'DELETE', null, adminToken);
  assert.equal(del.status, 200);
});

test('workflow: gửi kiểm duyệt → queue blind (ẩn editorial) → báo cáo → duyệt', async () => {
  const noTester = await call(`/api/v1/admin/problems/${problemId}/submit-testing`, 'POST', {}, adminToken);
  assert.equal(noTester.status, 422);
  // hero id: lấy từ users
  const users = await call('/api/v1/admin/users', 'GET', null, adminToken);
  const hero = users.data.users.find((u) => u.username === 'dever_hero');
  const sub = await call(`/api/v1/admin/problems/${problemId}/submit-testing`, 'POST', { tester_id: hero.id }, adminToken);
  assert.equal(sub.status, 200);
  assert.equal(sub.data.problem.workflow_status, 'IN_TESTING');

  const qHero = await call('/api/v1/testing/queue', 'GET', null, heroToken);
  assert.equal(qHero.status, 200);
  assert.ok(qHero.data.queue.some((p) => p.id === problemId));
  assert.ok(!('editorial' in qHero.data.queue[0]), 'queue phải ẩn editorial (blind)');

  const qHacker = await call('/api/v1/testing/queue', 'GET', null, hackerToken);
  assert.ok(!qHacker.data.queue.some((p) => p.id === problemId));

  const repForbidden = await call('/api/v1/testing/report', 'POST', { problem_id: problemId, solved: true }, hackerToken);
  assert.equal(repForbidden.status, 403);
  const rep = await call('/api/v1/testing/report', 'POST', { problem_id: problemId, solved: true, minutes_spent: 25, feedback: 'Đề rõ, test mẫu đủ.' }, heroToken);
  assert.equal(rep.status, 201);

  const badReview = await call(`/api/v1/admin/problems/${problemId}/review`, 'POST', { decision: 'MAYBE' }, adminToken);
  assert.equal(badReview.status, 422);
  const ok = await call(`/api/v1/admin/problems/${problemId}/review`, 'POST', { decision: 'APPROVED', note: 'Đạt.' }, adminToken);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.problem.workflow_status, 'APPROVED');
  assert.equal(ok.data.problem.test_reports.length, 1);

  const again = await call(`/api/v1/admin/problems/${problemId}/review`, 'POST', { decision: 'APPROVED' }, adminToken);
  assert.equal(again.status, 409);
});

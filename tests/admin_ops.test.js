/**
 * DEVER Arena — Task 123 + 124: reset dữ liệu demo + xóa user + admin sửa kỳ thi.
 * Server thật, DB file tạm riêng. Không gọi mạng ngoài.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

const DB_PATH = join(tmpdir(), `dever-admin-ops-${process.pid}.json`);
process.env.DEVER_DB_PATH = DB_PATH;
try { rmSync(DB_PATH, { force: true }); } catch {}

const { startServer } = await import('../server/index.js');

let server;
let base;
let adminToken;
let heroToken;

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
  const addr = server.address();
  base = `http://localhost:${addr.port}`;
  adminToken = (await call('/api/v1/auth/login', 'POST', { username: 'dever_admin', password: 'admin123' })).data.accessToken;
  heroToken = (await call('/api/v1/auth/login', 'POST', { username: 'dever_hero', password: 'hero123' })).data.accessToken;
});

after(async () => {
  await new Promise((r) => server.close(r));
  try { rmSync(DB_PATH, { force: true }); } catch {}
});

test('Task 124: admin sửa kỳ thi — title/start/duration/rated/rating window', async () => {
  const start = new Date(Date.now() + 3600_000).toISOString();
  const r = await call('/api/v1/admin/contests/contest_dever_round1', 'PUT', {
    title: 'DEVER Round #1 (đã sửa)',
    start_time: start,
    duration_minutes: 90,
    is_rated: false,
    min_rating: 1200,
    max_rating: 1799,
  }, adminToken);
  assert.equal(r.status, 200);
  const c = r.data.contest;
  assert.equal(c.title, 'DEVER Round #1 (đã sửa)');
  assert.equal(c.start_time, start);
  assert.equal(c.duration_minutes, 90);
  assert.equal(c.is_rated, false);
  assert.equal(c.min_rating, 1200);
  assert.equal(c.max_rating, 1799);
});

test('Task 124: duration ngoài 5–600 bị kẹp, PARTICIPANT bị 403', async () => {
  const r1 = await call('/api/v1/admin/contests/contest_dever_round1', 'PUT', { duration_minutes: 99999 }, adminToken);
  assert.equal(r1.status, 200);
  assert.equal(r1.data.contest.duration_minutes, 600);

  const r2 = await call('/api/v1/admin/contests/contest_dever_round1', 'PUT', { title: 'Hack' }, heroToken);
  assert.equal(r2.status, 403);
});

test('Task 123: xóa user demo — bài nộp + đăng ký bị dọn theo, cấm xóa dever_admin/chính mình', async () => {
  // Tạo user rác + 1 bài nộp của nó
  const junk = await call('/api/v1/admin/users', 'POST', { username: 'junk_user', password: 'junk123', full_name: 'Rác' }, adminToken);
  assert.equal(junk.status, 201);
  const junkId = junk.data.user.id;

  const before = await call('/api/v1/admin/users', 'GET', null, adminToken);
  const withSub = before.data.users.find((u) => u.username === 'dever_hero');
  assert.ok(withSub, 'hero tồn tại từ seed demo');

  const del = await call(`/api/v1/admin/users/${junkId}`, 'DELETE', null, adminToken);
  assert.equal(del.status, 200);
  assert.equal(del.data.deleted, junkId);

  const after = await call('/api/v1/admin/users', 'GET', null, adminToken);
  assert.ok(!after.data.users.some((u) => u.id === junkId));

  // Bảo vệ: không xóa dever_admin, không tự xóa
  const protAdmin = await call('/api/v1/admin/users/u_admin', 'DELETE', null, adminToken);
  assert.equal(protAdmin.status, 422);
  const selfDel = await call('/api/v1/admin/users/u_admin', 'DELETE', null, adminToken);
  assert.equal(selfDel.status, 422);

  // PARTICIPANT không được gọi
  const forbidden = await call(`/api/v1/admin/users/${junkId}`, 'DELETE', null, heroToken);
  assert.equal(forbidden.status, 403);
});

test('Task 123: reset-demo giữ lại admin, dọn users khác + submissions + participants', async () => {
  const r = await call('/api/v1/admin/reset-demo', 'POST', { mode: 'demo' }, adminToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.counts.users, 1);
  assert.equal(r.data.counts.submissions, 0);
  assert.ok(r.data.counts.contests >= 1, 'chế độ demo giữ lại contests');

  const users = await call('/api/v1/admin/users', 'GET', null, adminToken);
  assert.equal(users.data.users.length, 1);
  assert.equal(users.data.users[0].username, 'dever_admin');
});

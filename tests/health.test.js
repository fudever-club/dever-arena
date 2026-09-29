/**
 * DEVER Arena — health/readiness contract tests (khóa Goal 2 vào `npm run test`).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

const DB_PATH = join(tmpdir(), `dever-health-${process.pid}.json`);
process.env.DEVER_DB_PATH = DB_PATH;
try { rmSync(DB_PATH, { force: true }); } catch {}

const { startServer } = await import('../server/index.js');
const { shutdownJudge } = await import('../server/queue.js');

let server;
let base;
before(async () => {
  server = startServer(0);
  await new Promise((r) => setTimeout(r, 300));
  base = `http://localhost:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  shutdownJudge();
  try { rmSync(DB_PATH, { force: true }); } catch {}
});

test('GET /api/health trả ok + uptime + store', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.status, 'ok');
  assert.ok(typeof j.uptime_s === 'number');
  assert.ok(typeof j.store === 'string');
});

test('GET /api/v1/health (alias) trả ok', async () => {
  const r = await fetch(`${base}/api/v1/health`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.status, 'ok');
});

test('GET /api/ready kiểm tra được store', async () => {
  const r = await fetch(`${base}/api/ready`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ready, true);
  assert.ok(typeof j.users === 'number');
});

test('GET /api/health có khối flush (persist) — lỗi không âm thầm (Vòng 36.5)', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.flush, 'thiếu khối flush trong /health');
  assert.equal(j.flush.ok, true);
  assert.equal(typeof j.flush.stale, 'boolean');
  assert.equal(j.flush.consecutive_failures, 0);
});

test('GET /api/ready có khối flush khi ổn định', async () => {
  const r = await fetch(`${base}/api/ready`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.flush);
  assert.equal(j.flush.ok, true);
  assert.equal(j.flush.stale, false);
});

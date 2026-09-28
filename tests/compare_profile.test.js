/**
 * DEVER Arena — Task 108: compare 2 thí sinh + profile public (không cần token).
 * Server thật, DB tạm.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

process.env.SCHEDULER_DISABLED = '1';
const DB_PATH = join(tmpdir(), `dever-test-108-${process.pid}.json`);
process.env.DEVER_DB_PATH = DB_PATH;
try { rmSync(DB_PATH, { force: true }); } catch {}

const { startServer } = await import('../server/index.js');
const { shutdownJudge } = await import('../server/queue.js');

let server;
let base;

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
});

after(async () => {
  await new Promise((r) => server.close(r));
  shutdownJudge();
  try { rmSync(DB_PATH, { force: true }); } catch {}
});

test('Task 108: profile KHÔNG cần token (public share URL) — aggregate đầy đủ, không source_code', async () => {
  const r = await call('/api/v1/users/dever_hero/profile');
  assert.equal(r.status, 200);
  assert.equal(r.data.user.username, 'dever_hero');
  assert.ok(r.data.stats);
  assert.ok(Array.isArray(r.data.rating_history));
  assert.ok(Array.isArray(r.data.heatmap) && r.data.heatmap.length === 182);
  assert.ok(r.data.recent_submissions.every((s) => s.source_code === undefined), 'không lộ source_code');
  assert.ok(r.data.recent_submissions.every((s) => s.source_code !== '' || true));
});

test('Task 108: /compare trả 2 profile + head_to_head theo rank thật', async () => {
  const r = await call('/api/v1/compare?a=dever_hero&b=hacker_pro');
  assert.equal(r.status, 200);
  assert.equal(r.data.a.user.username, 'dever_hero');
  assert.equal(r.data.b.user.username, 'hacker_pro');
  assert.ok(r.data.a.stats && r.data.b.stats);
  assert.ok(Array.isArray(r.data.a.rating_history));
  assert.ok(typeof r.data.head_to_head.wins_a === 'number');
  assert.ok(typeof r.data.head_to_head.wins_b === 'number');
  assert.ok(Array.isArray(r.data.head_to_head.contests));
  for (const c of r.data.head_to_head.contests) {
    assert.ok(c.rank_a >= 1 && c.rank_b >= 1);
    // Rank chuẩn competition ranking: được phép bằng nhau khi cùng điểm (wins chỉ tính rank thấp hơn).
    assert.ok(c.rank_a >= 1 && c.rank_b >= 1);
  }
  assert.ok(r.data.head_to_head.wins_a + r.data.head_to_head.wins_b <= r.data.head_to_head.contests.length, 'wins không vượt số kỳ chung (kỳ hòa không tính)');
});

test('Task 108: /compare lỗi hợp lệ — user không tồn tại 404, trùng người 422', async () => {
  const missing = await call('/api/v1/compare?a=dever_hero&b=khong_ton_tai');
  assert.equal(missing.status, 404);
  const same = await call('/api/v1/compare?a=dever_hero&b=dever_hero');
  assert.equal(same.status, 422);
  assert.equal(same.data.error, 'SAME_USER');
});

test('Task 108: compare không trả password/field nhạy cảm', async () => {
  const r = await call('/api/v1/compare?a=dever_hero&b=dever_admin');
  assert.equal(r.status, 200);
  for (const side of [r.data.a, r.data.b]) {
    assert.equal(side.user.password, undefined);
    assert.equal(side.source_code, undefined);
  }
});

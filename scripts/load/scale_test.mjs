/**
 * DEVER Arena — load test quy mô contest (mục tiêu 100 concurrent).
 *
 * Tự boot server riêng (DB temp + port 0), KHÔNG đụng server dev của ai.
 * Kịch bản: N user login đồng loạt → mỗi user nộp M vòng Python đúng (chia batch).
 *
 * Chạy:
 *   node scripts/load/scale_test.mjs
 *   USERS=100 CONCURRENCY=20 ROUNDS=2 node scripts/load/scale_test.mjs
 *
 * Env:
 *   USERS (mặc định 10) — số user đồng loạt
 *   CONCURRENCY (mặc định 5) — độ đồng thời tối đa mỗi pha
 *   ROUNDS (mặc định 2) — số vòng nộp / user (tổng submit = USERS * ROUNDS)
 *   CONTEST_ID (mặc định contest_dever_round1)
 *   PROBLEM_ID (mặc định p102 — DEVER Big Product Challenge, sample 3/1 2 3 → 11)
 *
 * Gate: exit 1 khi AC rate < 95% hoặc p95 submit > 15s.
 */
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

const USERS = Math.max(1, Number(process.env.USERS || 10));
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 5));
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || 2));
const CONTEST_ID = process.env.CONTEST_ID || 'contest_dever_round1';
const PROBLEM_ID = process.env.PROBLEM_ID || 'p102';
const AC_THRESHOLD = 0.95;
const P95_BUDGET_MS = 15000;

// Bài Python đúng cho p102: S = ((sum)^2 - sum(x^2)) / 2. Đọc robust mọi whitespace.
const CODE = [
  'import sys',
  'def solve():',
  '    data = sys.stdin.read().strip().split()',
  '    if not data:',
  '        return',
  '    n = int(data[0])',
  '    a = list(map(int, data[1:1 + n]))',
  '    s = sum(a)',
  '    sq = sum(x * x for x in a)',
  '    print((s * s - sq) // 2)',
  "if __name__ == '__main__':",
  '    solve()',
].join('\n');

// Seed participant dùng cho load (rating ≤1599 hoặc đã là participant sẵn của
// contest_dever_round1; tránh k20_veteran 1620 chưa join + vượt max_rating → 403).
const SEED_PARTICIPANTS = [
  { username: 'dever_hero', password: 'hero123' },
  { username: 'hacker_pro', password: 'dever123' },
  { username: 'alice_ninja', password: 'dever123' },
  { username: 'buggy_coder', password: 'dever123' },
  { username: 'newbie_fpt', password: 'dever123' },
];

// DB temp riêng + port 0 — giống mẫu tests/stress_workflow.test.js
const DB_PATH = join(tmpdir(), `dever-scale-${process.pid}.json`);
process.env.DEVER_DB_PATH = DB_PATH;
try { rmSync(DB_PATH, { force: true }); } catch { /* ignore */ }

const { startServer } = await import('../../server/index.js');
const { shutdownJudge } = await import('../../server/queue.js');

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

async function runPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const n = Math.min(Math.max(1, limit), items.length);
  async function worker() {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

let server;
let base;
const cleanup = async () => {
  if (server) {
    await new Promise((r) => server.close(r));
    server = null;
  }
  shutdownJudge();
  try { rmSync(DB_PATH, { force: true }); } catch { /* ignore */ }
};

try {
  server = startServer(0);
  await new Promise((r) => setTimeout(r, 300));
  base = `http://localhost:${server.address().port}`;

  async function call(path, method = 'GET', body = null, token = null) {
    const t0 = Date.now();
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : null,
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, data, ms: Date.now() - t0 };
  }

  // 1) Admin login (tuần tự) để seed thêm user khi USERS > seed có sẵn.
  const adminLogin = await call('/api/v1/auth/login', 'POST', { username: 'dever_admin', password: 'admin123' });
  if (adminLogin.status !== 200) {
    console.error(`[scale] FAIL: admin login ${adminLogin.status} ${JSON.stringify(adminLogin.data)}`);
    await cleanup();
    process.exit(1);
  }
  const adminToken = adminLogin.data.accessToken;

  const creds = [...SEED_PARTICIPANTS];
  const extra = Math.max(0, USERS - creds.length);
  for (let i = 0; i < extra; i += 1) {
    const username = `load_u${String(i).padStart(3, '0')}`;
    const created = await call('/api/v1/admin/users', 'POST', {
      username, password: 'load1234', full_name: `Load User ${i}`, role: 'PARTICIPANT', rating: 1200,
    }, adminToken);
    if (created.status !== 201) {
      console.error(`[scale] FAIL: tạo user ${username} → ${created.status} ${JSON.stringify(created.data)}`);
      await cleanup();
      process.exit(1);
    }
    creds.push({ username, password: 'load1234' });
  }
  const targets = creds.slice(0, USERS);

  // 2) Login đồng loạt (chia batch theo CONCURRENCY).
  const loginResults = await runPool(targets, CONCURRENCY, async (c) => {
    const r = await call('/api/v1/auth/login', 'POST', { username: c.username, password: c.password });
    return { username: c.username, status: r.status, token: r.data?.accessToken || null, ms: r.ms };
  });
  const login429 = loginResults.filter((r) => r.status === 429).length;
  const authed = loginResults.filter((r) => r.token);
  console.log(`[scale] login: ${authed.length}/${targets.length} ok, 429=${login429}`);
  if (authed.length === 0) {
    console.error('[scale] FAIL: không login được user nào (toàn 429?).');
    await cleanup();
    process.exit(1);
  }

  // 3) Register vào contest (best-effort: seed đã là participant; lỗi vẫn cho nộp tiếp).
  await runPool(authed, CONCURRENCY, async (u) => {
    const r = await call(`/api/v1/contests/${CONTEST_ID}/register`, 'POST', {}, u.token);
    return { username: u.username, status: r.status };
  });

  // 4) M vòng nộp Python đúng — tổng submit = authed * ROUNDS, batch theo CONCURRENCY.
  const tasks = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    for (const u of authed) tasks.push({ user: u, round });
  }
  const submitLat = [];
  const verdicts = {};
  let acCount = 0;
  let submit429 = 0;
  let httpFail = 0;

  await runPool(tasks, CONCURRENCY, async (t) => {
    const r = await call('/api/v1/submissions', 'POST', {
      contest_id: CONTEST_ID, problem_id: PROBLEM_ID, language: 'python', source_code: CODE,
    }, t.user.token);
    if (r.status === 429) {
      submit429 += 1;
      verdicts['RATE_LIMITED'] = (verdicts['RATE_LIMITED'] || 0) + 1;
      return;
    }
    if (r.status !== 201) {
      httpFail += 1;
      const key = `HTTP_${r.status}`;
      verdicts[key] = (verdicts[key] || 0) + 1;
      return;
    }
    const verdict = r.data?.submission?.verdict || 'UNKNOWN';
    verdicts[verdict] = (verdicts[verdict] || 0) + 1;
    submitLat.push(r.ms);
    if (verdict === 'AC') acCount += 1;
  });

  const totalSubmits = tasks.length;
  const acRate = totalSubmits > 0 ? acCount / totalSubmits : 0;
  const sorted = [...submitLat].sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const max = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
  const avg = sorted.length > 0 ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length) : 0;
  const totalRequests = 1 + extra + targets.length + authed.length + totalSubmits;

  const report = {
    users: authed.length,
    users_requested: USERS,
    concurrency: CONCURRENCY,
    rounds: ROUNDS,
    contest_id: CONTEST_ID,
    problem_id: PROBLEM_ID,
    total_requests: totalRequests,
    logins: { attempted: targets.length, ok: authed.length, http_429: login429 },
    submits: {
      total: totalSubmits,
      ac: acCount,
      ac_rate: Number(acRate.toFixed(4)),
      p50_ms: p50,
      p95_ms: p95,
      max_ms: max,
      avg_ms: avg,
      http_429: submit429,
      http_fail: httpFail,
      verdicts,
    },
  };
  console.log(`[scale] users=${report.users} conc=${CONCURRENCY} rounds=${ROUNDS} total_req=${totalRequests}`);
  console.log(`[scale] submit total=${totalSubmits} ac=${acCount} ac_rate=${(acRate * 100).toFixed(1)}% p50=${p50}ms p95=${p95}ms max=${max}ms avg=${avg}ms 429=${submit429} verdicts=${JSON.stringify(verdicts)}`);
  console.log(JSON.stringify(report));

  const pass = acRate >= AC_THRESHOLD && p95 <= P95_BUDGET_MS;
  if (!pass) {
    if (acRate < AC_THRESHOLD) console.error(`[scale] FAIL: AC rate ${(acRate * 100).toFixed(1)}% < 95%`);
    if (p95 > P95_BUDGET_MS) console.error(`[scale] FAIL: p95 ${p95}ms vượt 15000ms`);
  } else {
    console.log('[scale] PASS');
  }
  await cleanup();
  process.exit(pass ? 0 : 1);
} catch (e) {
  console.error(`[scale] ERROR: ${e.stack || e}`);
  await cleanup();
  process.exit(1);
}

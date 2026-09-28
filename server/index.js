/**
 * DEVER Arena — Backend API thật (Node thuần, zero dependency).
 * Thực thi đúng API_SPECIFICATION: REST + SSE, JWT auth, judge chạy code thật,
 * vòng đời 3 phase chuẩn quốc tế (REGISTRATION→CODING→FINISHED) + chấm full-suite + Elo — tái dùng src/core & src/engine.
 *
 * Chạy: npm run server  (PORT mặc định 8787)
 */
import { createServer } from 'node:http';
import { hashPassword, signToken, bearerUser } from './auth.js';
import { normalizeLanguage, languageReady } from './judge.js';
import { judgeQueue, shutdownJudge } from './queue.js';
import { PROBLEMS_DB } from '../src/data/problems.js';
import { createScheduler } from './scheduler.js';
import { calculateProblemScore } from '../src/core/scoring.js';
import { calculateContestRatingChanges, getRatingTier } from '../src/core/rating.js';
import { CONTEST_PHASES } from '../src/core/contestStateMachine.js';
import { createVirtualSession, getVirtualElapsedMinutes } from '../src/core/virtualContest.js';
import { applyFreeze, computeIcpcStandings } from '../src/core/contestResults.js';
import { compareOutputs } from '../src/engine/isolateRunner.js';
import { generateSuite } from '../src/engine/testGenerator.js';
import { checkOutput, validateInput } from '../src/engine/testlibValidator.js';

// Validator bounds theo từng đề (hợp đồng UI đã chốt, frontend gửi/đọc các field này).
// Defaults: minN=1 / maxN=200000 / minVal=-1e9 / maxVal=1e9. Luật: minN>=1, maxN<=1e6.
const DEFAULT_BOUNDS = { minN: 1, maxN: 200000, minVal: -1000000000, maxVal: 1000000000 };
function boundsOf(problem) {
  return { ...DEFAULT_BOUNDS, ...(problem?.bounds || {}) };
}
function parseBounds(raw, base = DEFAULT_BOUNDS) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'bounds phải là object {minN,maxN,minVal,maxVal}.' };
  }
  const merged = { ...base };
  for (const key of ['minN', 'maxN', 'minVal', 'maxVal']) {
    if (raw[key] === undefined) continue;
    const v = Number(raw[key]);
    if (!Number.isFinite(v)) return { error: `bounds.${key} phải là số hợp lệ.` };
    merged[key] = v;
  }
  if (!Number.isInteger(merged.minN) || !Number.isInteger(merged.maxN)) {
    return { error: 'bounds.minN/maxN phải là số nguyên.' };
  }
  if (merged.minN < 1) return { error: 'bounds.minN phải >= 1.' };
  if (merged.maxN > 1000000) return { error: 'bounds.maxN phải <= 1000000.' };
  if (merged.minN > merged.maxN) return { error: 'bounds.minN phải <= bounds.maxN.' };
  if (merged.minVal > merged.maxVal) return { error: 'bounds.minVal phải <= bounds.maxVal.' };
  return { bounds: merged };
}

const PORT = Number(process.env.PORT || 8787);
// Store: DEVER_DATABASE_URL → Postgres (đa máy), không thì JSON file (mặc định server/data/db.json).
// DEVER_DB_PATH cho phép test dùng DB file riêng.
import { openStore } from './pg.js';
import { putObject as s3Put, getObject as s3Get, objectStoreActive } from './objectStore.js';
const { store: db, kind: storeKind } = await openStore();
console.log(`[dever-api] store: ${storeKind}`);

// ============================ SECURITY ============================
const CORS_ORIGIN = process.env.DEVER_CORS_ORIGIN || '*';
if (CORS_ORIGIN === '*' && process.env.NODE_ENV === 'production') {
  console.warn('[api] CORS đang mở * ở production — nên đặt DEVER_CORS_ORIGIN theo domain web.');
}

function secureHeaders() {
  return {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  };
}

// Rate limit in-memory: key → [timestamps]. Hạn mức theo nhóm route.
const RATE_BUCKETS = new Map();
const RATE_RULES = [
  { match: (m, p) => m === 'POST' && p === '/api/v1/auth/login', limit: 60, windowMs: 60000, scope: 'ip' },
  { match: (m, p) => m === 'POST' && p === '/api/v1/submissions', limit: 30, windowMs: 60000, scope: 'user' },
];
function rateKey(req, rule, user) {
  const ip = req.socket?.remoteAddress || 'unknown';
  const who = rule.scope === 'user' && user ? `u:${user.id}` : `ip:${ip}`;
  return `${rule.limit}:${who}:${req.method}:${new URL(req.url, 'http://localhost').pathname}`;
}
function checkRateLimit(req, user) {
  const path = new URL(req.url, 'http://localhost').pathname;
  for (const rule of RATE_RULES) {
    if (!rule.match(req.method, path)) continue;
    const key = rateKey(req, rule, user);
    const now = Date.now();
    const hits = (RATE_BUCKETS.get(key) || []).filter((t) => now - t < rule.windowMs);
    if (hits.length >= rule.limit) return false;
    hits.push(now);
    RATE_BUCKETS.set(key, hits);
    if (RATE_BUCKETS.size > 10000) RATE_BUCKETS.clear();
  }
  return true;
}

// ============================ SEED ============================
function seed() {
  if (db.data.users.length > 0) return;
  const users = [
    { id: 'u_hero', username: 'dever_hero', full_name: 'Nguyễn Anh Tuấn (K19)', role: 'PARTICIPANT', rating: 1742, max_rating: 1742, team: null, members: [], password: hashPassword('hero123'), rating_history: [] },
    { id: 'u_admin', username: 'dever_admin', full_name: 'Ban Chuyên Môn FU-DEVER', role: 'ADMIN', rating: 2450, max_rating: 2450, team: null, members: [], password: hashPassword('admin123'), rating_history: [] },
    { id: 'u_c1', username: 'hacker_pro', full_name: 'Lê Hoàng Nam', role: 'PARTICIPANT', rating: 1680, max_rating: 1680, team: null, members: [], password: hashPassword('dever123'), rating_history: [] },
    { id: 'u_c2', username: 'alice_ninja', full_name: 'Trần Thị Mai', role: 'PARTICIPANT', rating: 1540, max_rating: 1540, team: null, members: [], password: hashPassword('dever123'), rating_history: [] },
    { id: 'u_c3', username: 'buggy_coder', full_name: 'Phạm Quốc Bảo', role: 'PARTICIPANT', rating: 1490, max_rating: 1490, team: null, members: [], password: hashPassword('dever123'), rating_history: [] },
    { id: 'u_c4', username: 'newbie_fpt', full_name: 'Đặng Minh Khôi', role: 'PARTICIPANT', rating: 1180, max_rating: 1180, team: null, members: [], password: hashPassword('dever123'), rating_history: [] },
    { id: 'u_c5', username: 'k20_veteran', full_name: 'Trần Văn Kiên', role: 'PARTICIPANT', rating: 1620, max_rating: 1620, team: null, members: [], password: hashPassword('dever123'), rating_history: [] },
  ];
  users.forEach((u) => db.insert('users', u));
  // NOTE: rating_history demo + bài nộp luyện tập được seed ở cuối seed() (sau khi có `now`).

  const now = Date.now();
  const contests = [
    { id: 'contest_dever_round1', title: 'DEVER Round #1 (Div. 3)', slug: 'dever-round-1-div3', contest_format: 'ICPC', start_time: new Date(now - 38 * 60000).toISOString(), duration_minutes: 120, status: 'CODING', is_rated: true, min_rating: null, max_rating: 1599 },
    { id: 'contest_dever_archive', title: 'DEVER Round #0 (Archive)', slug: 'dever-round-0-archive', contest_format: 'ICPC', start_time: new Date(now - 7 * 86400000).toISOString(), duration_minutes: 120, status: 'FINISHED', is_rated: true, min_rating: null, max_rating: null },
    { id: 'contest_dever_round2_div1', title: 'DEVER Round #2 (Div. 1)', slug: 'dever-round-2-div1', contest_format: 'ICPC', start_time: new Date(now + 2 * 86400000).toISOString(), duration_minutes: 120, status: 'REGISTRATION', is_rated: true, min_rating: 1900, max_rating: null },
    { id: 'contest_dever_round2_div2', title: 'DEVER Round #2 (Div. 2)', slug: 'dever-round-2-div2', contest_format: 'ICPC', start_time: new Date(now + 2 * 86400000).toISOString(), duration_minutes: 120, status: 'REGISTRATION', is_rated: true, min_rating: null, max_rating: 1899 },
  ];
  contests.forEach((c) => db.insert('contests', c));

  PROBLEMS_DB.forEach((p) => {
    db.insert('problems', { ...p, contest_id: 'contest_dever_round1', base_points: p.rating || 1000 });
    db.insert('testcases', { id: `tc_${p.id}_sample`, problem_id: p.id, order_index: 0, stdin: p.sampleInput, expected_stdout: p.sampleOutput, is_sample: true });
  });

  // Ghost submissions cho archive (virtual replay) — đã chấm sẵn
  const ghostAt = (min) => new Date(now - 7 * 86400000 + min * 60000).toISOString();
  const ghosts = [
    { user_id: 'u_c1', problem_id: 'p101', at: 10, pts: 480 }, { user_id: 'u_c1', problem_id: 'p102', at: 35, pts: 940 },
    { user_id: 'u_c3', problem_id: 'p101', at: 22, pts: 440 }, { user_id: 'u_c2', problem_id: 'p101', at: 15, pts: 490 },
    { user_id: 'u_c5', problem_id: 'p102', at: 70, pts: 910 },
  ];
  ghosts.forEach((g, i) => db.insert('submissions', {
    id: `sub_ghost_${i}`, user_id: g.user_id, problem_id: g.problem_id, contest_id: 'contest_dever_archive',
    language: 'python', source_code: '# ghost submission (archive)', verdict: 'AC', points_awarded: g.pts,
    time_ms: 20, submitted_at: ghostAt(g.at),
  }));

  // Hero tham gia round1
  db.insert('participants', { contest_id: 'contest_dever_round1', user_id: 'u_hero', registered_at: new Date(now - 38 * 60000).toISOString() });
  ['u_c1', 'u_c2', 'u_c3'].forEach((uid) => db.insert('participants', { contest_id: 'contest_dever_round1', user_id: uid, registered_at: new Date(now - 38 * 60000).toISOString() }));
  // Rating history demo — dãy deterministic kết thúc đúng rating hiện tại (không random mỗi lần seed).
  const RATING_SEQ = {
    u_hero: [1320, 1455, 1602, 1742],
    u_c1: [1402, 1519, 1580, 1680],
    u_c2: [1310, 1401, 1488, 1540],
    u_c3: [1245, 1338, 1402, 1490],
    u_c4: [1080, 1125, 1180],
    u_c5: [1440, 1502, 1556, 1620],
  };
  Object.entries(RATING_SEQ).forEach(([uid, seq]) => {
    const u = db.find('users', (x) => x.id === uid);
    if (!u) return;
    u.rating_history = seq.map((value, i) => {
      const old = i === 0 ? Math.max(0, value - 130) : seq[i - 1];
      return { contest_id: 'contest_dever_archive', old, new: value, delta: value - old, at: new Date(now - (seq.length - i) * 12 * 86400000).toISOString() };
    });
  });

  // Bài nộp luyện tập (contest_id = null) — LCG seeded 42 để dữ liệu nhất quán giữa các lần seed.
  const PRACTICE = [
    { uid: 'u_hero', n: 26 }, { uid: 'u_c1', n: 14 }, { uid: 'u_c2', n: 12 },
    { uid: 'u_c3', n: 10 }, { uid: 'u_c4', n: 8 }, { uid: 'u_c5', n: 11 },
  ];
  const pids = PROBLEMS_DB.map((p) => p.id);
  const langs = ['python', 'cpp20', 'java', 'js'];
  const VERDICT_POOL = ['AC', 'AC', 'AC', 'AC', 'AC', 'WA', 'WA', 'TLE', 'RE', 'CE'];
  let lcg = 42;
  const rand = () => { lcg = (lcg * 1103515245 + 12345) % 2147483648; return lcg / 2147483648; };
  let pseq = 0;
  PRACTICE.forEach(({ uid, n }) => {
    for (let i = 0; i < n; i++) {
      pseq += 1;
      db.insert('submissions', {
        id: `sub_practice_${pseq}`,
        user_id: uid,
        problem_id: pids[Math.floor(rand() * pids.length)],
        contest_id: null,
        language: langs[Math.floor(rand() * langs.length)],
        source_code: '# practice submission (seed)',
        verdict: VERDICT_POOL[Math.floor(rand() * VERDICT_POOL.length)],
        points_awarded: 0,
        time_ms: Math.floor(rand() * 700) + 12,
        submitted_at: new Date(now - Math.floor(rand() * 70) * 86400000 - (Math.floor(rand() * 14) + 7) * 3600000).toISOString(),
      });
    }
  });

  db.save();
  console.log('[seed] database khởi tạo xong');
}
seed();

// ============================ HELPERS ============================
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', ...secureHeaders() });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1024 * 1024) { reject(new Error('Body quá lớn')); req.destroy(); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('JSON không hợp lệ')); } });
    req.on('error', reject);
  });
}

const sseClients = new Map(); // contestId -> Set<res>
function broadcast(contestId, event, payload) {
  const set = sseClients.get(contestId);
  if (!set) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) { try { res.write(msg); } catch {} }
}

function findContest(slugOrId) {
  return db.find('contests', (c) => c.slug === slugOrId || c.id === slugOrId) || null;
}
function elapsedMinutes(contest) {
  return Math.max(0, Math.floor((Date.now() - new Date(contest.start_time).getTime()) / 60000));
}
function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return { ...rest, rank_tier: getRatingTier(u.rating) };
}
function problemTests(problemId) {
  return db.filter('testcases', (t) => t.problem_id === problemId).sort((a, b) => a.order_index - b.order_index);
}
// Chuẩn quốc tế: chấm trên TOÀN BỘ test suite ngay khi nộp — verdict trả về là verdict cuối cùng
// (không chia pretest/system test; không ghép hack payload vào suite — ADR-005).
function judgeSuiteOf(problemId) {
  return problemTests(problemId).map((t) => ({ stdin: t.stdin, expected: t.expected_stdout }));
}

function computeStandings(contest) {
  const parts = db.filter('participants', (p) => p.contest_id === contest.id);
  const t0 = new Date(contest.start_time).getTime();
  const minuteOf = (iso) => Math.max(0, Math.floor((new Date(iso).getTime() - t0) / 60000));
  const rows = parts.map((p) => {
    const user = db.find('users', (u) => u.id === p.user_id);
    if (!user) return null;
    const subs = db.filter('submissions', (s) => s.contest_id === contest.id && s.user_id === p.user_id && !s.is_upsolve)
      .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    const perProblem = {};
    let problemScore = 0;
    const probs = db.filter('problems', (pr) => pr.contest_id === contest.id);
    for (const prob of probs) {
      const ps = subs.filter((s) => s.problem_id === prob.id);
      const ac = [...ps].reverse().find((s) => s.verdict === 'AC');
      if (ac) {
        perProblem[prob.code] = { points: ac.points_awarded, status: 'AC', attempts: ps.length, minute: minuteOf(ac.submitted_at) };
        problemScore += ac.points_awarded;
      } else if (ps.length > 0) {
        perProblem[prob.code] = { points: 0, status: ps[ps.length - 1].verdict, attempts: ps.length };
      } else {
        perProblem[prob.code] = { points: 0, status: 'UNATTEMPTED', attempts: 0 };
      }
    }
    return { user_id: user.id, username: user.username, team: user.team || null, rating: user.rating, total: problemScore, problems: perProblem };
  }).filter(Boolean).sort((a, b) => b.total - a.total);
  let rank = 0; let prev = null;
  rows.forEach((r, i) => { if (r.total !== prev) { rank = i + 1; prev = r.total; } r.rank = rank; });
  return rows;
}

const PHASE_ORDER = ['REGISTRATION', 'CODING', 'FINISHED'];

/**
 * Chốt 1 kỳ thi: cộng Elo (nếu rated) rồi set FINISHED — dùng chung cho admin phase
 * và auto-phase scheduler (Task 103) để hai đường đi luôn nhất quán.
 */
function finishContest(c) {
  if (c.is_rated) {
    const rows = computeStandings(c);
    const changes = calculateContestRatingChanges(rows.map((r) => ({ id: r.user_id, name: r.username, oldRating: r.rating, points: r.total })));
    for (const ch of changes) {
      const u = db.find('users', (x) => x.id === ch.id);
      if (!u) continue;
      u.rating_history = u.rating_history || [];
      u.rating_history.push({ contest_id: c.id, old: u.rating, new: ch.newRating, delta: ch.delta, at: new Date().toISOString() });
      u.rating = ch.newRating;
      u.max_rating = Math.max(u.max_rating || 0, ch.newRating);
    }
    db.save();
  }
  db.update('contests', (x) => x.id === c.id, { status: 'FINISHED' });
}

// ============================ OBSERVABILITY ============================
const BOOT_TIME = Date.now();
function logReq(req, code, ms) {
  try {
    const url = new URL(req.url, 'http://localhost');
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: code >= 500 ? 'error' : 'info', method: req.method, path: url.pathname, status: code, ms }));
  } catch {}
}

// ============================ ROUTER ============================
const routes = [];

function route(method, pattern, handler, opts = {}) {
  routes.push({ method, pattern: new RegExp(pattern), handler, ...opts });
}

async function handle(req, res) {
  const t0 = Date.now();
  // Log cấu trúc JSON khi response kết thúc (SSE long-lived sẽ log lúc client ngắt).
  res.on('finish', () => {
    try {
      const u = new URL(req.url, 'http://localhost');
      if (u.pathname.startsWith('/api/v1/stream/')) return; // tránh spam log SSE
      logReq(req, res.statusCode || 200, Date.now() - t0);
    } catch {}
  });
  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }
  const url = new URL(req.url, 'http://localhost');
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.pathname.match(r.pattern);
    if (!m) continue;
    try {
      let user = null;
      // Lưới an toàn: handler khai báo tham số user (arity>=5) mà quên auth → enforce auth
      const needAuth = r.auth || r.handler.length >= 5;
      if (needAuth) {
        // Cho phép token qua query ?token= cho SSE
        if (url.searchParams.get('token')) {
          const { verifyToken } = await import('./auth.js');
          const payload = verifyToken(url.searchParams.get('token'));
          user = payload ? db.find('users', (u) => u.id === payload.sub) : null;
        } else {
          user = bearerUser(req, db);
        }
        if (!user) { send(res, 401, { error: 'UNAUTHORIZED', message: 'Thiếu hoặc sai token. Đăng nhập tại POST /api/v1/auth/login.' }); return; }
      } else if (req.headers['authorization']) {
        // Parse token để rate-limit theo user khi có (không bắt buộc ở route public)
        try { user = bearerUser(req, db); } catch { user = null; }
      }
      if (!checkRateLimit(req, user)) { send(res, 429, { error: 'RATE_LIMITED', message: 'Gửi quá nhiều yêu cầu, hãy chậm lại một chút.' }); return; }
      if (r.admin && user.role !== 'ADMIN') { send(res, 403, { error: 'FORBIDDEN', message: 'Chỉ ADMIN.' }); return; }
      await r.handler(req, res, url, m, user);
    } catch (e) {
      console.error(`[api] ${req.method} ${url.pathname}:`, e.stack || e);
      send(res, 500, { error: 'INTERNAL', message: String(e.message || e) });
    }
    return;
  }
  send(res, 404, { error: 'NOT_FOUND', message: `Không có route ${req.method} ${url.pathname}` });
}

// ---- OpenAPI spec (Task 110): phục vụ docs/openapi.json cho dev CLB tự tích hợp ----
import { readFileSync as _rf, existsSync as _es } from 'node:fs';
import { dirname as _dn, join as _jn } from 'node:path';
import { fileURLToPath as _fu } from 'node:url';
const OPENAPI_PATH = _jn(_dn(_fu(import.meta.url)), '..', 'docs', 'openapi.json');
route('GET', '^/api/v1/openapi\.json$', async (req, res) => {
  if (!_es(OPENAPI_PATH)) { send(res, 404, { error: 'SPEC_NOT_FOUND', message: 'Chạy `npm run gen:openapi` để sinh spec.' }); return; }
  const body = JSON.stringify(JSON.parse(_rf(OPENAPI_PATH, 'utf8')));
  res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
  res.end(body);
});

// ---- Health & readiness (public, rẻ, không auth) ----
route('GET', '^/api/(v1/)?health$', async (req, res) => {
  send(res, 200, { status: 'ok', uptime_s: Math.floor((Date.now() - BOOT_TIME) / 1000), store: storeKind, time: new Date().toISOString() });
});
route('GET', '^/api/(v1/)?ready$', async (req, res) => {
  try {
    const users = db.filter('users', () => true).length;
    const contests = db.filter('contests', () => true).length;
    send(res, 200, { ready: true, store: storeKind, users, contests });
  } catch (e) {
    send(res, 503, { ready: false, error: String(e.message || e) });
  }
});

// ---- Auth ----
route('POST', '^/api/v1/auth/login$', async (req, res) => {
  const { username, password } = await readBody(req);
  const user = db.find('users', (u) => u.username === String(username || '').trim());
  if (!user || user.password !== hashPassword(String(password || ''))) {
    send(res, 401, { error: 'INVALID_CREDENTIALS', message: 'Sai tài khoản hoặc mật khẩu.' }); return;
  }
  const token = signToken({ sub: user.id, role: user.role });
  send(res, 200, { accessToken: token, token, user: publicUser(user) });
});

// ---- Users ----
route('GET', '^/api/v1/users/([^/]+)$', async (req, res, url, m) => {
  const user = db.find('users', (u) => u.username === decodeURIComponent(m[1]));
  if (!user) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  send(res, 200, { user: publicUser(user), rating_history: user.rating_history || [] });
}, { auth: true });

// ---- User profile aggregate (skill: dever-profile-analytics) ----
// Mọi số liệu aggregate từ DB thật; source code KHÔNG BAO GIỜ trả qua profile.
// contest_id = null là bài nộp luyện tập ngoài kỳ thi (vẫn tính solved/heatmap).
// Aggregate profile dùng chung cho route profile và /compare (Task 108) — một code path.
function profileAggregate(user) {
  const subs = db.filter('submissions', (s) => s.user_id === user.id)
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));

  const verdicts = {};
  const languages = {};
  const solvedProblems = new Set();
  let totalTimeMs = 0;
  for (const s of subs) {
    const v = String(s.verdict || 'PENDING').toUpperCase();
    verdicts[v] = (verdicts[v] || 0) + 1;
    const lang = String(s.language || 'unknown');
    languages[lang] = (languages[lang] || 0) + 1;
    totalTimeMs += Number(s.time_ms || 0);
    if (v === 'AC') solvedProblems.add(s.problem_id);
  }

  // Tag strength: solved/attempted là số bài DISTINCT theo tag (không đếm lượt nộp).
  const tagsMap = new Map();
  for (const s of subs) {
    const prob = db.find('problems', (pr) => pr.id === s.problem_id);
    const probTags = prob && Array.isArray(prob.tags) ? prob.tags : [];
    for (const t of probTags) {
      if (!tagsMap.has(t)) tagsMap.set(t, { solved: new Set(), attempted: new Set() });
      const e = tagsMap.get(t);
      e.attempted.add(s.problem_id);
      if (s.verdict === 'AC') e.solved.add(s.problem_id);
    }
  }
  const tags = [...tagsMap.entries()]
    .map(([tag, e]) => ({ tag, solved: e.solved.size, attempted: e.attempted.size }))
    .sort((a, b) => b.solved - a.solved || b.attempted - a.attempted)
    .slice(0, 12);

  // Heatmap 26 tuần: ô = 1 ngày, count = số bài nộp ngày đó (từ submitted_at thật).
  const counts = new Map();
  for (const s of subs) {
    const d = new Date(s.submitted_at);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const heatmap = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 181; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    heatmap.push({ date: key, count: counts.get(key) || 0 });
  }

  // per_contest: mỗi kỳ thi đã đăng ký hoặc có nộp bài — rank lấy từ bảng standings thật.
  const participatedIds = new Set(db.filter('participants', (p) => p.user_id === user.id).map((p) => p.contest_id));
  const contestIds = new Set([...subs.map((s) => s.contest_id), ...participatedIds].filter(Boolean));
  const per_contest = [...contestIds].map((cid) => {
    const c = db.find('contests', (x) => x.id === cid);
    if (!c) return null;
    const csubs = subs.filter((s) => s.contest_id === cid);
    const solvedIds = new Set(csubs.filter((s) => s.verdict === 'AC').map((s) => s.problem_id));
    let total = 0;
    for (const pid of solvedIds) {
      const ac = [...csubs].reverse().find((s) => s.problem_id === pid && s.verdict === 'AC');
      total += Number(ac?.points_awarded || 0);
    }
    let rank = null;
    let entrants = null;
    try {
      const rows = computeStandings(c);
      const me = rows.find((r) => r.user_id === user.id);
      if (me) { rank = me.rank; entrants = rows.length; }
    } catch { /* contest thiếu dữ liệu → rank ẩn */ }
    return {
      contest_id: cid, title: c.title, slug: c.slug, status: c.status,
      contest_format: c.contest_format || 'ICPC', start_time: c.start_time,
      submissions: csubs.length, solved: solvedIds.size, total,
      registered: participatedIds.has(cid), rank, entrants,
    };
  }).filter(Boolean).sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  const ranks = per_contest.map((c) => c.rank).filter((r) => typeof r === 'number');
  const stats = {
    submissions: subs.length,
    accepted: verdicts.AC || 0,
    solved: solvedProblems.size,
    acceptance_rate: subs.length ? Math.round(((verdicts.AC || 0) / subs.length) * 1000) / 10 : 0,
    avg_time_ms: subs.length ? Math.round(totalTimeMs / subs.length) : 0,
    contests_played: per_contest.length,
    best_rank: ranks.length ? Math.min(...ranks) : null,
  };

  const recent = subs.slice(-20).reverse().map((s) => {
    const prob = db.find('problems', (p) => p.id === s.problem_id);
    const { source_code, ...pub } = s;
    return { ...pub, problem_code: prob?.code || null, problem_title: prob?.title || null };
  });

  return {
    stats,
    rating_history: user.rating_history || [],
    heatmap,
    verdicts,
    tags,
    languages: Object.entries(languages).map(([language, count]) => ({ language, count })).sort((a, b) => b.count - a.count),
    per_contest,
    recent_submissions: recent,
  };
}

route('GET', '^/api/v1/users/([^/]+)/profile$', async (req, res, url, m) => {
  const user = db.find('users', (u) => u.username === decodeURIComponent(m[1]));
  if (!user) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  // Public profile (Task 108): share URL cho khách — aggregate KHÔNG bao giờ chứa source_code.
  send(res, 200, { user: publicUser(user), ...profileAggregate(user) });
});

// ---- So sánh 2 thí sinh (Task 108): stats + Elo + head-to-head theo rank thật ----
route('GET', '^/api/v1/compare$', async (req, res, url) => {
  const nameA = url.searchParams.get('a') || '';
  const nameB = url.searchParams.get('b') || '';
  const a = db.find('users', (u) => u.username === nameA);
  const b = db.find('users', (u) => u.username === nameB);
  if (!a || !b) { send(res, 404, { error: 'USER_NOT_FOUND', message: 'Thiếu hoặc sai tham số ?a=username&b=username.' }); return; }
  if (a.id === b.id) { send(res, 422, { error: 'SAME_USER', message: 'Chọn 2 thí sinh khác nhau.' }); return; }
  const pa = profileAggregate(a);
  const pb = profileAggregate(b);
  // Head-to-head: các kỳ thi CẢ HAI đều có rank thật trong standings.
  const rankA = new Map(pa.per_contest.filter((c) => typeof c.rank === 'number').map((c) => [c.contest_id, c]));
  const rankB = new Map(pb.per_contest.filter((c) => typeof c.rank === 'number').map((c) => [c.contest_id, c]));
  const shared = [...rankA.keys()].filter((id) => rankB.has(id));
  let wins_a = 0;
  let wins_b = 0;
  const contests = shared.map((id) => {
    const ra = rankA.get(id).rank;
    const rb = rankB.get(id).rank;
    if (ra < rb) wins_a += 1; else if (rb < ra) wins_b += 1;
    return { contest_id: id, title: rankA.get(id).title, rank_a: ra, rank_b: rb };
  });
  send(res, 200, {
    a: { user: publicUser(a), stats: pa.stats, rating_history: pa.rating_history, verdicts: pa.verdicts, tags: pa.tags },
    b: { user: publicUser(b), stats: pb.stats, rating_history: pb.rating_history, verdicts: pb.verdicts, tags: pb.tags },
    head_to_head: { contests, wins_a, wins_b },
  });
});

// ---- Contests ----
route('GET', '^/api/v1/contests$', async (req, res) => {
  send(res, 200, { contests: db.data.contests });
});
route('GET', '^/api/v1/contests/([^/]+)$', async (req, res, url, m) => {
  const c = findContest(decodeURIComponent(m[1]));
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND' }); return; }
  const problems = db.filter('problems', (p) => p.contest_id === c.id).map((p) => {
    const { ...rest } = p;
    if (c.status !== 'FINISHED') delete rest.editorial;
    return rest;
  });
  send(res, 200, { contest: c, problems, elapsedMinutes: elapsedMinutes(c) });
});
route('POST', '^/api/v1/contests/([^/]+)/register$', async (req, res, url, m, user) => {
  const c = findContest(decodeURIComponent(m[1]));
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND' }); return; }
  if (!['REGISTRATION', 'CODING'].includes(c.status)) { send(res, 409, { error: 'REGISTRATION_CLOSED' }); return; }
  if (c.min_rating != null && user.rating < c.min_rating) { send(res, 403, { error: 'RATING_INELIGIBLE', message: `Cần rating ≥ ${c.min_rating}.` }); return; }
  if (c.max_rating != null && user.rating > c.max_rating) { send(res, 403, { error: 'RATING_INELIGIBLE', message: `Chỉ dành cho rating ≤ ${c.max_rating}.` }); return; }
  const existed = db.find('participants', (p) => p.contest_id === c.id && p.user_id === user.id);
  if (existed) { send(res, 200, { participant: existed }); return; }
  const part = db.insert('participants', { contest_id: c.id, user_id: user.id, registered_at: new Date().toISOString() });
  send(res, 201, { participant: part });
}, { auth: true });
route('GET', '^/api/v1/contests/([^/]+)/standings$', async (req, res, url, m) => {
  const c = findContest(decodeURIComponent(m[1]));
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND' }); return; }
  const explicitFormat = url.searchParams.get('format');
  const format = (explicitFormat || c.contest_format || 'ICPC').toUpperCase();
  let rows = computeStandings(c);
  let frozen = null;
  if (url.searchParams.get('frozen') === '1' && format === 'CODEFORCES') {
    const fm = url.searchParams.get('freeze_minute');
    const freezeMinute = fm != null && fm !== '' ? Math.max(0, Number(fm) || 0) : Math.max(0, (c.duration_minutes || 135) - 30);
    rows = applyFreeze(rows, { freezeMinute, elapsedMinute: elapsedMinutes(c) });
    frozen = { freezeMinute };
  }
  if (format === 'ICPC') {
    const icpc = computeIcpcStandings(rows.map((r) => ({
      user_id: r.user_id,
      username: r.username,
      solves: Object.entries(r.problems || {}).map(([code, p]) => ({
        code, minute: p.minute ?? 0, wrongAttempts: Math.max(0, (p.attempts || 0) - (p.status === 'AC' ? 1 : 0)), solved: p.status === 'AC',
      })),
    })));
    return send(res, 200, { contest_id: c.id, status: c.status, format: 'ICPC', total: icpc.length, standings: icpc });
  }
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));
  send(res, 200, { contest_id: c.id, status: c.status, format: 'CODEFORCES', frozen, total: rows.length, standings: rows.slice((page - 1) * limit, page * limit) });
});

// ---- Virtual ----
route('POST', '^/api/v1/contests/([^/]+)/virtual$', async (req, res, url, m, user) => {
  const c = findContest(decodeURIComponent(m[1]));
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND' }); return; }
  if (c.status !== 'FINISHED') { send(res, 409, { error: 'NOT_ARCHIVED', message: 'Chỉ contest FINISHED mới thi ảo được.' }); return; }
  const body = await readBody(req).catch(() => ({}));
  const session = createVirtualSession(c.id, user.id, body.duration_minutes || c.duration_minutes || 120);
  const row = db.insert('virtual_sessions', { ...session, id: `vs_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}` });
  send(res, 201, { session_id: row.id, start_time: row.startTime || row.start_time, duration_minutes: row.durationMinutes || row.duration_minutes });
}, { auth: true });
route('GET', '^/api/v1/contests/([^/]+)/virtual$', async (req, res, url, m) => {
  const c = findContest(decodeURIComponent(m[1]));
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND' }); return; }
  const s = db.find('virtual_sessions', (x) => x.id === url.searchParams.get('session_id'));
  if (!s) { send(res, 404, { error: 'SESSION_NOT_FOUND' }); return; }
  // at_minute: time-travel cho demo/test (mặc định đồng hồ thật của phiên)
  const atMinute = url.searchParams.get('at_minute');
  const elapsed = atMinute != null && atMinute !== ''
    ? Math.min(Number(atMinute) || 0, s.durationMinutes || s.duration_minutes || 120)
    : getVirtualElapsedMinutes({ startTime: s.startTime || s.start_time, durationMinutes: s.durationMinutes || s.duration_minutes });
  const t0 = new Date(c.start_time).getTime();
  const ghosts = db.filter('submissions', (x) => x.contest_id === c.id && (new Date(x.submitted_at).getTime() - t0) <= elapsed * 60000);
  // Tính standings chỉ từ ghost submissions trong elapsed (không chạm participants thật)
  const probs = db.filter('problems', (pr) => pr.contest_id === c.id);
  const ghostUserIds = [...new Set(ghosts.map((g) => g.user_id))];
  const partUserIds = db.filter('participants', (p) => p.contest_id === c.id).map((p) => p.user_id);
  const userIds = [...new Set([...ghostUserIds, ...partUserIds])];
  const all = userIds.map((uid) => {
    const user = db.find('users', (u) => u.id === uid);
    if (!user) return null;
    const mine = ghosts.filter((g) => g.user_id === uid);
    let score = 0;
    const per = {};
    for (const prob of probs) {
      const g = mine.filter((x) => x.problem_id === prob.id).sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
      const ac = [...g].reverse().find((x) => x.verdict === 'AC');
      per[prob.code] = ac ? { points: ac.points_awarded, status: 'AC', attempts: g.length } : { points: 0, status: g.length ? 'WA' : 'UNATTEMPTED', attempts: g.length };
      if (ac) score += ac.points_awarded;
    }
    return { user_id: user.id, username: user.username, rating: user.rating, total: score, problems: per };
  }).filter(Boolean).sort((a, b) => b.total - a.total);
  send(res, 200, { session_id: s.id, elapsedMinutes: elapsed, standings: all });
}, { auth: true });

// ---- Problems ----
// ---- Kho bài luyện tập (Task 105): stats per problem cho user đang login ----
// Trả về { solved, attempts, ac_attempt, last_verdict, solved_at, is_upsolve } theo problem_id từ BÀI NỘP THẬT
// (gồm cả trong contest lẫn practice contest_id=null). Problem không có nộp → không nằm trong map.
route('GET', '^/api/v1/practice/stats$', async (req, res, url, m, user) => {
  const mine = db.filter('submissions', (s) => s.user_id === user.id);
  const map = {};
  for (const s of mine.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))) {
    const e = map[s.problem_id] || { solved: false, attempts: 0, ac_attempt: null, last_verdict: null, solved_at: null, is_upsolve: false };
    e.attempts += 1;
    e.last_verdict = s.verdict;
    if (s.verdict === 'AC' && !e.solved) { e.solved = true; e.ac_attempt = e.attempts; e.solved_at = s.submitted_at; }
    if (s.is_upsolve) e.is_upsolve = true;
    map[s.problem_id] = e;
  }
  send(res, 200, { stats: map });
}, { auth: true });

route('GET', '^/api/v1/problems$', async (req, res, url) => {
  let list = [...db.data.problems];
  const tag = url.searchParams.get('tag');
  const q = (url.searchParams.get('search') || '').toLowerCase();
  const cid = url.searchParams.get('contest_id');
  if (tag) list = list.filter((p) => (p.tags || []).includes(tag));
  if (q) list = list.filter((p) => (p.title + ' ' + p.code).toLowerCase().includes(q));
  if (cid) list = list.filter((p) => p.contest_id === cid);
  send(res, 200, { problems: list.map((p) => { const { editorial, ...rest } = p; return rest; }) });
});
route('GET', '^/api/v1/problems/([^/]+)/editorial$', async (req, res, url, m) => {
  const p = db.find('problems', (x) => x.id === decodeURIComponent(m[1]));
  if (!p) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  const c = db.find('contests', (x) => x.id === p.contest_id);
  if (!c || c.status !== 'FINISHED') { send(res, 403, { error: 'EDITORIAL_LOCKED', message: 'Editorial chỉ mở sau khi contest FINISHED.' }); return; }
  send(res, 200, { problem_id: p.id, editorial: p.editorial || '' });
});
route('GET', '^/api/v1/problems/([^/]+)$', async (req, res, url, m) => {
  const p = db.find('problems', (x) => x.id === decodeURIComponent(m[1]));
  if (!p) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  const c = db.find('contests', (x) => x.id === p.contest_id);
  const { editorial, ...rest } = p;
  send(res, 200, { problem: (c && c.status === 'FINISHED') ? p : rest });
});

// ---- Submissions ----
// Upsolve (Task 105): nộp sau khi contest FINISHED — chấm thật nhưng không tính điểm, không vào standings.
function subView(s, { withSource = false } = {}) {
  // Task 118: source_key là chi tiết storage nội bộ — không bao giờ lộ ra API.
  const { source_code, source_key, per_test, ...pub } = s;
  return withSource
    ? { ...pub, source_code, per_test }
    : { ...pub, has_source: Boolean(source_code != null || source_key) };
}

route('POST', '^/api/v1/submissions$', async (req, res, url, m, user) => {
  const { contest_id, problem_id, language, source_code } = await readBody(req);
  const c = db.find('contests', (x) => x.id === contest_id);
  const prob = db.find('problems', (x) => x.id === problem_id);
  if (!c || !prob) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  const isUpsolve = c.status === 'FINISHED'; // Task 105: upsolving sau contest
  if (c.status !== 'CODING' && !isUpsolve) { send(res, 409, { error: 'NOT_CODING_PHASE', message: 'Chỉ nộp bài trong Coding Phase (hoặc upsolve sau khi kết thúc).' }); return; }
  const part = db.find('participants', (p) => p.contest_id === c.id && p.user_id === user.id);
  if (!part) { send(res, 403, { error: 'NOT_REGISTERED' }); return; }
  if (!normalizeLanguage(language)) { send(res, 422, { error: 'UNSUPPORTED_LANGUAGE', message: `Ngôn ngữ ${language} không được hỗ trợ. Dùng: javascript, python, java, cpp.` }); return; }
  const notReady = languageReady(normalizeLanguage(language));
  if (notReady) { send(res, 422, { error: 'TOOLCHAIN_MISSING', message: notReady }); return; }
  const priorWA = db.filter('submissions', (s) => s.contest_id === c.id && s.user_id === user.id && s.problem_id === prob.id && s.verdict !== 'AC').length;
  const timeLimitMs = parseFloat(prob.timeLimit) * 1000 || 1000;
  // Chuẩn quốc tế: chấm full-suite ngay — verdict trả về là kết quả cuối cùng (ADR-005).
  // Task 104: truyền memoryLimit của đề để ràng buộc heap/rlimit.
  const judged = await judgeQueue.judgeTests({ language, source: source_code, tests: judgeSuiteOf(prob.id), timeLimitMs, memoryLimit: prob.memoryLimit || '256 MB' });
  if (judged.verdict === 'SKIP') { send(res, 422, { error: 'UNSUPPORTED_LANGUAGE', message: judged.message }); return; }
  const passed = judged.verdict === 'AC';
  // Upsolve: luôn 0 điểm; trong contest: công thức decay + penalty như cũ.
  const pts = isUpsolve ? 0 : (passed ? calculateProblemScore(prob.base_points || prob.rating || 1000, elapsedMinutes(c), priorWA) : 0);
  // Task 104: lưu per-test (verdict + time) để mở feedback sau FINISHED — KHÔNG lưu input/expected (chống lộ test).
  const per_test = (judged.results || []).map((r) => ({ index: r.index, verdict: r.verdict, time_ms: r.timeMs || 0 }));
  // Task 118: source_code lưu object store (S3 trên Specific) — KV chỉ giữ metadata + key.
  const subId = db.nextId('sub');
  let sourceKey = null;
  if (objectStoreActive && source_code != null) {
    sourceKey = `submissions/${subId}.txt`;
    if ((await s3Put(sourceKey, source_code)) === null) sourceKey = null; // lỗi tạm → fallback KV
  }
  const subRow = {
    id: subId, user_id: user.id, problem_id: prob.id, contest_id: c.id,
    language: normalizeLanguage(language), verdict: passed ? 'AC' : judged.verdict,
    points_awarded: pts, time_ms: judged.results[0]?.timeMs ?? null,
    elapsed_min: elapsedMinutes(c), detail: judged.message, submitted_at: new Date().toISOString(),
    is_upsolve: isUpsolve || undefined, per_test,
  };
  if (sourceKey) subRow.source_key = sourceKey;
  else subRow.source_code = source_code;
  const sub = db.insert('submissions', subRow);
  if (!isUpsolve) broadcast(c.id, 'EVENT_STANDINGS_UPDATE', { standings: computeStandings(c) });
  send(res, 201, { submission: subView(sub), verdict: judged.verdict, is_upsolve: isUpsolve, per_test });
}, { auth: true });
route('GET', '^/api/v1/submissions/([^/]+)$', async (req, res, url, m, user) => {
  const s = db.find('submissions', (x) => x.id === decodeURIComponent(m[1]));
  if (!s) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  const c = s.contest_id ? db.find('contests', (x) => x.id === s.contest_id) : null;
  const isPractice = s.contest_id == null;
  const isUpsolve = Boolean(s.is_upsolve);
  // Feedback per-test (Task 104): chỉ mở khi contest FINISHED / upsolve / practice — không bao giờ kèm input/expected.
  const revealPerTest = isPractice || isUpsolve || (c && c.status === 'FINISHED');
  const showSource = s.user_id === user.id || user.role === 'ADMIN' || (c && c.status === 'FINISHED');
  const firstFail = (s.per_test || []).findIndex((t) => t.verdict !== 'AC');
  let base = subView(s, { withSource: showSource });
  if (showSource && base.source_code === undefined && s.source_key) {
    base = { ...base, source_code: (await s3Get(s.source_key)) ?? undefined };
  }
  send(res, 200, {
    submission: revealPerTest ? base : { ...base, per_test: undefined, per_test_hidden: true, failed_index: firstFail >= 0 ? firstFail : undefined },
  });
}, { auth: true });
route('GET', '^/api/v1/submissions$', async (req, res, url, m, user) => {
  const cid = url.searchParams.get('contest_id');
  const uid = url.searchParams.get('user_id');
  let list = [...db.data.submissions].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)).slice(0, 100);
  if (cid) list = list.filter((s) => s.contest_id === cid);
  if (uid) list = list.filter((s) => s.user_id === uid);
  const c = cid ? db.find('contests', (x) => x.id === cid) : null;
  const showSource = user.role === 'ADMIN' || (c && c.status === 'FINISHED');
  const contestDone = !cid || (c && c.status === 'FINISHED');
  send(res, 200, {
    submissions: await Promise.all(list.map(async (s) => {
      const withSource = showSource || s.user_id === user.id;
      let base = withSource ? subView(s, { withSource: true }) : subView(s);
      // Task 118: fetch source từ object store khi được phép xem.
      if (withSource && base.source_code === undefined && s.source_key) {
        base = { ...base, source_code: (await s3Get(s.source_key)) ?? undefined };
      }
      // Khi contest còn CODING: ẩn per_test của người khác (chống dò test), giữ của chính mình.
      if (!contestDone && s.user_id !== user.id && s.per_test) return { ...base, per_test: undefined, per_test_hidden: true };
      return base;
    })),
  });
}, { auth: true });

// ---- Admin: users (admin cấp tài khoản cá nhân / đội thi) ----
route('GET', '^/api/v1/admin/users$', async (req, res) => {
  send(res, 200, { users: db.data.users.map(publicUser) });
}, { auth: true, admin: true });
route('POST', '^/api/v1/admin/users$', async (req, res, url, m, user) => {
  const { username, password, full_name = '', role = 'PARTICIPANT', rating = 1200, team = null, members = [] } = await readBody(req);
  const name = String(username || '').trim();
  if (!name || !/^[a-zA-Z0-9_.]{3,30}$/.test(name)) { send(res, 422, { error: 'BAD_USERNAME', message: 'Username 3-30 ký tự (chữ, số, _ .).' }); return; }
  if (db.find('users', (u) => u.username === name)) { send(res, 409, { error: 'USERNAME_TAKEN' }); return; }
  if (!password || String(password).length < 6) { send(res, 422, { error: 'WEAK_PASSWORD', message: 'Mật khẩu tối thiểu 6 ký tự.' }); return; }
  if (!['PARTICIPANT', 'ADMIN'].includes(role)) { send(res, 422, { error: 'BAD_ROLE' }); return; }
  const r = Math.max(0, Number(rating) || 1200);
  const created = db.insert('users', {
    id: db.nextId('u'), username: name, full_name: String(full_name || name),
    role, rating: r, max_rating: r,
    team: team ? String(team) : null,
    members: Array.isArray(members) ? members.map(String).slice(0, 10) : [],
    password: hashPassword(String(password)), rating_history: [],
  });
  void user;
  send(res, 201, { user: publicUser(created) });
}, { auth: true, admin: true });
route('POST', '^/api/v1/admin/users/([^/]+)/password$', async (req, res, url, m) => {
  const u = db.find('users', (x) => x.id === decodeURIComponent(m[1]));
  if (!u) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  const { password } = await readBody(req);
  if (!password || String(password).length < 6) { send(res, 422, { error: 'WEAK_PASSWORD', message: 'Mật khẩu tối thiểu 6 ký tự.' }); return; }
  db.update('users', (x) => x.id === u.id, { password: hashPassword(String(password)) });
  send(res, 200, { ok: true, username: u.username });
}, { auth: true, admin: true });

// ---- Admin: phase ----
route('POST', '^/api/v1/admin/phase$', async (req, res, url, m, user) => {
  const { contest_id, phase } = await readBody(req);
  const c = db.find('contests', (x) => x.id === contest_id);
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND' }); return; }
  if (!PHASE_ORDER.includes(phase)) { send(res, 422, { error: 'BAD_PHASE' }); return; }
  const cur = PHASE_ORDER.indexOf(c.status);
  const nxt = PHASE_ORDER.indexOf(phase);
  if (nxt !== cur + 1 && !(cur === 0 && nxt === 1)) {
    // Cho phép REGISTRATION->CODING trực tiếp; còn lại phải tuần tự (3 phase: ADR-005)
    if (!(c.status === 'REGISTRATION' && phase === 'CODING')) {
      send(res, 409, { error: 'ILLEGAL_TRANSITION', message: `Không thể chuyển ${c.status} → ${phase}.` }); return;
    }
  }
  if (phase === 'FINISHED') finishContest(c); // đã check is_rated bên trong
  db.update('contests', (x) => x.id === c.id, { status: phase });
  broadcast(c.id, 'EVENT_PHASE_CHANGED', { phase });
  broadcast(c.id, 'EVENT_STANDINGS_UPDATE', { standings: computeStandings(c) });
  send(res, 200, { contest_id: c.id, phase });
}, { auth: true, admin: true });

// ---- Admin: contests (tạo kỳ thi mới) ----
route('POST', '^/api/v1/admin/contests$', async (req, res) => {
  const body = await readBody(req);
  const title = String(body.title || '').trim();
  if (!title) { send(res, 422, { error: 'BAD_TITLE', message: 'Thiếu tên kỳ thi.' }); return; }
  const format = String(body.contest_format || 'ICPC').toUpperCase();
  if (!['CODEFORCES', 'ICPC', 'IOI'].includes(format)) { send(res, 422, { error: 'BAD_FORMAT' }); return; }
  let slug = String(body.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) slug = `contest-${Date.now().toString(36)}`;
  if (findContest(slug)) { send(res, 409, { error: 'SLUG_TAKEN' }); return; }
  const start = new Date(body.start_time || Date.now());
  if (Number.isNaN(start.getTime())) { send(res, 422, { error: 'BAD_START_TIME' }); return; }
  const created = db.insert('contests', {
    id: db.nextId('contest'),
    title,
    slug,
    contest_format: format,
    start_time: start.toISOString(),
    duration_minutes: Math.max(15, Number(body.duration_minutes) || 120),
    status: 'REGISTRATION',
    is_rated: body.is_rated !== false,
    min_rating: body.min_rating ?? null,
    max_rating: body.max_rating ?? null,
  });
  send(res, 201, { contest: created });
}, { auth: true, admin: true });

// ---- Admin: rejudge (chấm lại 1 bài nộp) ----
route('POST', '^/api/v1/admin/rejudge$', async (req, res) => {
  const { submission_id } = await readBody(req);
  const s = db.find('submissions', (x) => x.id === submission_id);
  if (!s) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  const c = db.find('contests', (x) => x.id === s.contest_id);
  const prob = db.find('problems', (p) => p.id === s.problem_id);
  if (!c || !prob) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  // Rejudge dùng đúng một code path với submit: full-suite, verdict cuối (ADR-005)
  const timeLimitMs = parseFloat(prob?.timeLimit) * 1000 || 1000;
  // Task 118: source có thể nằm trên object store (S3) — fetch khi cần.
  let src = s.source_code;
  if (src === undefined && s.source_key) src = await s3Get(s.source_key);
  const r = await judgeQueue.judgeTests({ language: s.language, source: src, tests: judgeSuiteOf(s.problem_id), timeLimitMs });
  if (r.verdict === 'SKIP') { send(res, 422, { error: 'TOOLCHAIN_MISSING', message: r.message }); return; }
  const passed = r.verdict === 'AC';
  const priorWA = db.filter('submissions', (x) => x.contest_id === c.id && x.user_id === s.user_id && x.problem_id === s.problem_id && x.id !== s.id && x.verdict !== 'AC').length;
  const pts = passed ? calculateProblemScore(prob.base_points || prob.rating || 1000, s.elapsed_min ?? elapsedMinutes(c), priorWA) : 0;
  db.update('submissions', (x) => x.id === s.id, {
    verdict: r.verdict,
    points_awarded: pts, time_ms: r.results[0]?.timeMs ?? s.time_ms,
    detail: `Rejudge: ${r.message}`, rejudged_at: new Date().toISOString(),
  });
  broadcast(c.id, 'EVENT_STANDINGS_UPDATE', { standings: computeStandings(c) });
  send(res, 200, { submission: db.find('submissions', (x) => x.id === s.id) });
}, { auth: true, admin: true });
// ---- Admin: problems (soạn đề trên máy chủ) ----
route('POST', '^/api/v1/admin/problems$', async (req, res) => {
  const body = await readBody(req);
  const contest_id = body.contest_id;
  const c = db.find('contests', (x) => x.id === contest_id);
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND', message: 'Contest không tồn tại.' }); return; }
  const code = String(body.code || '').trim().toUpperCase();
  const title = String(body.title || '').trim();
  const statement = String(body.statement || '').trim();
  if (!code || !title || !statement) { send(res, 422, { error: 'MISSING_FIELD', message: 'Thiếu code/title/statement.' }); return; }
  if (db.find('problems', (p) => p.contest_id === contest_id && p.code === code)) { send(res, 409, { error: 'CODE_TAKEN', message: `Mã ${code} đã tồn tại trong contest.` }); return; }
  const ratingVal = Number(body.rating ?? body.base_points ?? 1000) || 1000;
  const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t)) : String(body.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
  let bounds = { ...DEFAULT_BOUNDS };
  if (body.bounds !== undefined) {
    const parsed = parseBounds(body.bounds, DEFAULT_BOUNDS);
    if (parsed.error) { send(res, 422, { error: 'BAD_BOUNDS', message: parsed.error }); return; }
    bounds = parsed.bounds;
  }
  const problem = db.insert('problems', {
    id: db.nextId('p'),
    contest_id,
    code,
    title,
    rating: ratingVal,
    base_points: ratingVal,
    tags,
    bounds,
    timeLimit: body.timeLimit || '1.0s',
    memoryLimit: body.memoryLimit || '256 MB',
    statement: body.statement,
    sampleInput: body.sampleInput || '',
    sampleOutput: body.sampleOutput || '',
    editorial: body.editorial || '',
    solvedCount: 0,
    workflow_status: 'DRAFT',
    tester_id: null,
    review_note: '',
    test_reports: [],
  });
  db.insert('testcases', { id: `tc_${problem.id}_sample`, problem_id: problem.id, order_index: 0, stdin: problem.sampleInput, expected_stdout: problem.sampleOutput, is_sample: true, is_pretest: true });
  send(res, 201, { problem });
}, { auth: true, admin: true });
route('PUT', '^/api/v1/admin/problems/([^/]+)$', async (req, res, url, m) => {
  const p = db.find('problems', (x) => x.id === decodeURIComponent(m[1]));
  if (!p) { send(res, 404, { error: 'NOT_FOUND', message: 'Không tìm thấy đề.' }); return; }
  const body = await readBody(req);
  const patch = {};
  if (body.code !== undefined) {
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) { send(res, 422, { error: 'MISSING_FIELD', message: 'Thiếu code.' }); return; }
    const dup = db.find('problems', (x) => x.contest_id === p.contest_id && x.code === code && x.id !== p.id);
    if (dup) { send(res, 409, { error: 'CODE_TAKEN', message: `Mã ${code} đã tồn tại trong contest.` }); return; }
    patch.code = code;
  }
  if (body.title !== undefined) patch.title = String(body.title || '').trim() || p.title;
  if (body.rating !== undefined || body.base_points !== undefined) {
    const v = Number(body.rating ?? body.base_points ?? p.rating ?? 1000) || 1000;
    patch.rating = v;
    patch.base_points = v;
  }
  if (body.tags !== undefined) patch.tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t)) : String(body.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (body.timeLimit !== undefined) patch.timeLimit = body.timeLimit;
  if (body.memoryLimit !== undefined) patch.memoryLimit = body.memoryLimit;
  if (body.statement !== undefined) patch.statement = body.statement;
  if (body.sampleInput !== undefined) patch.sampleInput = body.sampleInput;
  if (body.sampleOutput !== undefined) patch.sampleOutput = body.sampleOutput;
  if (body.editorial !== undefined) patch.editorial = body.editorial;
  if (body.bounds !== undefined) {
    const parsed = parseBounds(body.bounds, boundsOf(p));
    if (parsed.error) { send(res, 422, { error: 'BAD_BOUNDS', message: parsed.error }); return; }
    patch.bounds = parsed.bounds;
  }
  db.update('problems', (x) => x.id === p.id, patch);
  const updated = db.find('problems', (x) => x.id === p.id);
  const samples = db.filter('testcases', (t) => t.problem_id === p.id && t.is_sample);
  if (samples.length > 0) {
    for (const t of samples) {
      db.update('testcases', (x) => x.id === t.id, { stdin: updated.sampleInput || '', expected_stdout: updated.sampleOutput || '' });
    }
  } else if (body.sampleInput !== undefined || body.sampleOutput !== undefined) {
    db.insert('testcases', { id: `tc_${p.id}_sample`, problem_id: p.id, order_index: 0, stdin: updated.sampleInput || '', expected_stdout: updated.sampleOutput || '', is_sample: true, is_pretest: true });
  }
  send(res, 200, { problem: updated });
}, { auth: true, admin: true });
route('DELETE', '^/api/v1/admin/problems/([^/]+)$', async (req, res, url, m) => {
  const p = db.find('problems', (x) => x.id === decodeURIComponent(m[1]));
  if (!p) { send(res, 404, { error: 'NOT_FOUND', message: 'Không tìm thấy đề.' }); return; }
  if (db.filter('submissions', (s) => s.problem_id === p.id).length > 0) { send(res, 409, { error: 'HAS_SUBMISSIONS', message: 'Đề đã có bài nộp, không thể xóa.' }); return; }
  db.data.problems = db.data.problems.filter((x) => x.id !== p.id);
  db.data.testcases = db.data.testcases.filter((t) => t.problem_id !== p.id);
  db.save();
  send(res, 200, { deleted: p.id });
}, { auth: true, admin: true });
// ============================ POLYGON: STRESS + TESTCASES + WORKFLOW ============================
// Stress test chuẩn Polygon: chạy model vs brute-force trên cùng bộ test seeded,
// lệch nhau là FAIL. Kèm gợi ý time limit = max(1s, 2x thời gian model chậm nhất).
route('POST', '^/api/v1/admin/stress$', async (req, res) => {
  const body = await readBody(req);
  const language = String(body.language || 'python');
  const model_source = String(body.model_source || '');
  const brute_source = String(body.brute_source || '');
  if (!model_source.trim() || !brute_source.trim()) {
    send(res, 422, { error: 'MISSING_FIELD', message: 'Thiếu model_source/brute_source.' }); return;
  }
  const count = Math.max(1, Math.min(30, Number(body.count) || 12));
  const seed = String(body.seed ?? `stress-${Date.now()}`);
  const timeLimitMs = Math.max(500, Math.min(5000, Number(body.timeLimitMs) || 2000));
  const rules = { minN: 1, maxN: 100000, minVal: -1000000000, maxVal: 1000000000, ...(body.rules || {}) };
  const checker = body.checker === 'float' ? 'float' : 'exact';
  const epsilon = Number(body.epsilon) || 1e-6;
  const suite = generateSuite({ count, seed, ...rules });

  let modelMaxMs = 0;
  let passed = 0;
  const mismatches = [];
  const outputs = [];
  const BATCH = 4;
  for (let i = 0; i < suite.length; i += BATCH) {
    const results = await Promise.all(suite.slice(i, i + BATCH).map(async (c) => {
      const [m, b] = await Promise.all([
        judgeQueue.executeOne({ language, source: model_source, stdin: c.stdin, timeLimitMs }),
        judgeQueue.executeOne({ language, source: brute_source, stdin: c.stdin, timeLimitMs }),
      ]);
      return { c, m, b };
    }));
    for (const { c, m, b } of results) {
      if (m.verdict === 'SKIP' || b.verdict === 'SKIP') {
        send(res, 422, { error: 'LANGUAGE_UNAVAILABLE', message: `Ngôn ngữ ${language} chưa có toolchain (giống luật judge).` }); return;
      }
      modelMaxMs = Math.max(modelMaxMs, Number(m.timeMs) || 0);
      const ok = checker === 'float'
        ? checkOutput(m.stdout || '', b.stdout || '', 'float_tolerance', { epsilon }).isCorrect
        : compareOutputs(m.stdout || '', b.stdout || '');
      if (ok) {
        passed++;
        outputs.push({ stdin: c.stdin, expected_stdout: b.stdout || '', strategy: c.strategy });
      } else if (mismatches.length < 5) {
        mismatches.push({
          stdin: c.stdin.slice(0, 2000), strategy: c.strategy,
          model_verdict: m.verdict, brute_verdict: b.verdict,
          model_stdout: (m.stdout || '').slice(0, 1000), brute_stdout: (b.stdout || '').slice(0, 1000),
        });
      }
    }
  }
  const failed = suite.length - passed;
  const suggestedTimeLimitS = Math.max(1, Math.ceil(((2 * modelMaxMs) / 1000) * 2) / 2);
  send(res, 200, {
    ran: suite.length, passed, failed, mismatches, outputs,
    modelMaxMs, suggestedTimeLimitS, seed,
    verdict: failed === 0 ? 'PASS' : 'FAIL',
  });
}, { auth: true, admin: true });

// Lưu 1 testcase chấm (pretest/system) cho đề — dùng sau khi stress PASS.
route('POST', '^/api/v1/admin/testcases$', async (req, res) => {
  const body = await readBody(req);
  const p = db.find('problems', (x) => x.id === String(body.problem_id || ''));
  if (!p) { send(res, 404, { error: 'PROBLEM_NOT_FOUND', message: 'Không tìm thấy đề.' }); return; }
  const stdin = String(body.stdin ?? '');
  if (!stdin) { send(res, 422, { error: 'MISSING_FIELD', message: 'Thiếu stdin.' }); return; }
  // Validate stdin bằng bounds CỦA ĐỀ (không dùng defaults cứng của validator).
  const v = validateInput(stdin, boundsOf(p));
  if (!v.isValid) { send(res, 422, { error: 'VALIDATOR_REJECT', message: v.error }); return; }
  const existing = db.filter('testcases', (t) => t.problem_id === p.id);
  const order_index = existing.reduce((mx, t) => Math.max(mx, Number(t.order_index) || 0), 0) + 1;
  const tc = db.insert('testcases', {
    id: db.nextId('tc'), problem_id: p.id, order_index,
    stdin, expected_stdout: String(body.expected_stdout ?? ''),
    is_sample: false,
    strategy: String(body.strategy || 'manual'),
  });
  send(res, 201, { testcase: tc });
}, { auth: true, admin: true });
route('GET', '^/api/v1/admin/testcases$', async (req, res, url) => {
  const problem_id = url.searchParams.get('problem_id') || '';
  const rows = db.filter('testcases', (t) => !problem_id || t.problem_id === problem_id)
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    .map((t) => ({ ...t, stdin: String(t.stdin || '').slice(0, 2000), expected_stdout: String(t.expected_stdout || '').slice(0, 2000) }));
  send(res, 200, { testcases: rows });
}, { auth: true, admin: true });
route('DELETE', '^/api/v1/admin/testcases/([^/]+)$', async (req, res, url, m) => {
  const t = db.find('testcases', (x) => x.id === decodeURIComponent(m[1]));
  if (!t) { send(res, 404, { error: 'NOT_FOUND', message: 'Không tìm thấy testcase.' }); return; }
  if (t.is_sample) { send(res, 409, { error: 'IS_SAMPLE', message: 'Test mẫu sửa qua đề bài (PUT problem), không xóa lẻ.' }); return; }
  db.data.testcases = db.data.testcases.filter((x) => x.id !== t.id);
  db.save();
  send(res, 200, { deleted: t.id });
}, { auth: true, admin: true });

// --- Blind-tester workflow: DRAFT → IN_TESTING → APPROVED (REJECTED về DRAFT) ---
const WORKFLOW = ['DRAFT', 'IN_TESTING', 'APPROVED'];
function workflowOf(p) { return WORKFLOW.includes(p.workflow_status) ? p.workflow_status : 'DRAFT'; }
route('POST', '^/api/v1/admin/problems/([^/]+)/submit-testing$', async (req, res, url, m, user) => {
  const p = db.find('problems', (x) => x.id === decodeURIComponent(m[1]));
  if (!p) { send(res, 404, { error: 'NOT_FOUND', message: 'Không tìm thấy đề.' }); return; }
  if (workflowOf(p) === 'IN_TESTING') { send(res, 409, { error: 'ALREADY_TESTING', message: 'Đề đang kiểm duyệt.' }); return; }
  const body = await readBody(req);
  const tester = db.find('users', (u) => u.id === String(body.tester_id || ''));
  if (!tester) { send(res, 422, { error: 'TESTER_NOT_FOUND', message: 'Chọn tester (tài khoản có thật).' }); return; }
  if (tester.id === user.id) { send(res, 422, { error: 'SELF_TEST', message: 'Không tự kiểm duyệt đề của mình (blind).' }); return; }
  db.update('problems', (x) => x.id === p.id, { workflow_status: 'IN_TESTING', tester_id: tester.id, review_note: '' });
  send(res, 200, { problem: db.find('problems', (x) => x.id === p.id) });
}, { auth: true, admin: true });
route('POST', '^/api/v1/admin/problems/([^/]+)/review$', async (req, res, url, m) => {
  const p = db.find('problems', (x) => x.id === decodeURIComponent(m[1]));
  if (!p) { send(res, 404, { error: 'NOT_FOUND', message: 'Không tìm thấy đề.' }); return; }
  if (workflowOf(p) !== 'IN_TESTING') { send(res, 409, { error: 'NOT_TESTING', message: 'Đề chưa ở phase kiểm duyệt.' }); return; }
  const body = await readBody(req);
  const decision = String(body.decision || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(decision)) { send(res, 422, { error: 'BAD_DECISION', message: 'decision phải là APPROVED hoặc REJECTED.' }); return; }
  db.update('problems', (x) => x.id === p.id, {
    workflow_status: decision === 'APPROVED' ? 'APPROVED' : 'DRAFT',
    review_note: String(body.note || ''),
  });
  send(res, 200, { problem: db.find('problems', (x) => x.id === p.id) });
}, { auth: true, admin: true });
// Hàng chờ kiểm duyệt: ADMIN thấy hết, tester chỉ thấy bài giao cho mình. ẨN editorial (blind).
route('GET', '^/api/v1/testing/queue$', async (req, res, url, m, user) => {
  const rows = db.filter('problems', (p) => workflowOf(p) === 'IN_TESTING' && (user.role === 'ADMIN' || p.tester_id === user.id));
  send(res, 200, {
    queue: rows.map((p) => ({
      id: p.id, contest_id: p.contest_id, code: p.code, title: p.title,
      rating: p.rating, tags: p.tags, timeLimit: p.timeLimit, memoryLimit: p.memoryLimit,
      statement: p.statement, sampleInput: p.sampleInput, sampleOutput: p.sampleOutput,
      tester_id: p.tester_id, reports: p.test_reports || [],
    })),
  });
}, { auth: true });
// Báo cáo tester: tự giải độc lập rồi nộp (solved?/bao lâu/nhận xét).
route('POST', '^/api/v1/testing/report$', async (req, res, url, m, user) => {
  const body = await readBody(req);
  const p = db.find('problems', (x) => x.id === String(body.problem_id || ''));
  if (!p) { send(res, 404, { error: 'NOT_FOUND', message: 'Không tìm thấy đề.' }); return; }
  if (workflowOf(p) !== 'IN_TESTING') { send(res, 409, { error: 'NOT_TESTING', message: 'Đề không ở phase kiểm duyệt.' }); return; }
  if (user.role !== 'ADMIN' && p.tester_id !== user.id) { send(res, 403, { error: 'FORBIDDEN', message: 'Đề này không giao cho bạn.' }); return; }
  const report = {
    id: db.nextId('tr'), tester_id: user.id, solved: Boolean(body.solved),
    minutes_spent: Math.max(0, Number(body.minutes_spent) || 0),
    feedback: String(body.feedback || '').slice(0, 2000), at: new Date().toISOString(),
  };
  db.update('problems', (x) => x.id === p.id, { test_reports: [...(p.test_reports || []), report] });
  send(res, 201, { report });
}, { auth: true });

// ---- Clarifications (hỏi đáp jury, chuẩn ICPC) ----
route('POST', '^/api/v1/clarifications$', async (req, res, url, m, user) => {
  const { contest_id, problem_id = null, question } = await readBody(req);
  const c = db.find('contests', (x) => x.id === contest_id);
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND', message: 'Contest không tồn tại.' }); return; }
  const q = String(question || '').trim();
  if (!q) { send(res, 422, { error: 'EMPTY_QUESTION', message: 'Câu hỏi không được để trống.' }); return; }
  let pid = null;
  if (problem_id !== null && problem_id !== undefined && String(problem_id).trim() !== '') {
    const prob = db.find('problems', (p) => p.id === String(problem_id));
    if (!prob) { send(res, 404, { error: 'PROBLEM_NOT_FOUND', message: 'Không tìm thấy đề.' }); return; }
    pid = prob.id;
  }
  void url; void m;
  const clar = db.insert('clarifications', {
    id: db.nextId('clr'), contest_id: c.id, problem_id: pid, asker_id: user.id,
    question: q, answer: null, answered_by: null, answered_at: null, created_at: new Date().toISOString(),
  });
  send(res, 201, { clarification: clar });
}, { auth: true });
route('GET', '^/api/v1/clarifications$', async (req, res, url, m, user) => {
  const contest_id = url.searchParams.get('contest_id') || '';
  if (!contest_id) { send(res, 422, { error: 'MISSING_CONTEST_ID', message: 'Thiếu contest_id.' }); return; }
  void req; void m;
  const rows = db.filter('clarifications', (x) => x.contest_id === contest_id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (user.role === 'ADMIN') {
    send(res, 200, { clarifications: rows });
    return;
  }
  const visible = rows.filter((x) => x.answer != null || x.asker_id === user.id);
  send(res, 200, {
    clarifications: visible.map((x) => {
      const { asker_id, ...rest } = x;
      return { ...rest, asker: asker_id === user.id ? 'me' : null };
    }),
  });
}, { auth: true });
route('POST', '^/api/v1/admin/clarifications/([^/]+)/answer$', async (req, res, url, m, user) => {
  const clar = db.find('clarifications', (x) => x.id === decodeURIComponent(m[1]));
  if (!clar) { send(res, 404, { error: 'NOT_FOUND', message: 'Không tìm thấy câu hỏi.' }); return; }
  void url;
  const { answer } = await readBody(req);
  const a = String(answer || '').trim();
  if (!a) { send(res, 422, { error: 'EMPTY_ANSWER', message: 'Câu trả lời không được để trống.' }); return; }
  db.update('clarifications', (x) => x.id === clar.id, { answer: a, answered_by: user.id, answered_at: new Date().toISOString() });
  send(res, 200, { clarification: db.find('clarifications', (x) => x.id === clar.id) });
}, { auth: true, admin: true });

// ---- Announcements (thông báo toàn contest) ----
route('POST', '^/api/v1/admin/announcements$', async (req, res, url, m, user) => {
  const { contest_id, message } = await readBody(req);
  const c = db.find('contests', (x) => x.id === contest_id);
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND', message: 'Contest không tồn tại.' }); return; }
  void url; void m;
  const msg = String(message || '').trim();
  if (!msg) { send(res, 422, { error: 'EMPTY_MESSAGE', message: 'Thông báo không được để trống.' }); return; }
  const ann = db.insert('announcements', {
    id: db.nextId('ann'), contest_id: c.id, message: msg, created_by: user.id, created_at: new Date().toISOString(),
  });
  broadcast(c.id, 'EVENT_ANNOUNCEMENT', { announcement: ann });
  send(res, 201, { announcement: ann });
}, { auth: true, admin: true });
route('GET', '^/api/v1/announcements$', async (req, res, url, m, user) => {
  const contest_id = url.searchParams.get('contest_id') || '';
  void req; void m; void user;
  let rows = [...db.data.announcements];
  if (contest_id) rows = rows.filter((x) => x.contest_id === contest_id);
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  send(res, 200, { announcements: rows });
}, { auth: true });

route('GET', '^/api/v1/stream/contests/([^/]+)$', async (req, res, url, m) => {
  const c = findContest(decodeURIComponent(m[1]));
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND' }); return; }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive',
    ...secureHeaders(),
  });
  res.write(`event: CONNECTED\ndata: {"contest_id":"${c.id}","phase":"${c.status}"}\n\n`);
  if (!sseClients.has(c.id)) sseClients.set(c.id, new Set());
  sseClients.get(c.id).add(res);
  const beat = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
  req.on('close', () => { clearInterval(beat); sseClients.get(c.id)?.delete(res); });
}, { auth: true });

// ============================ BOOT ============================
// Auto-phase scheduler (Task 103): REGISTRATION→CODING→FINISHED theo giờ thật.
// SCHEDULER_DISABLED=1 để tắt (test tự điều khiển tick).
export const scheduler = createScheduler({ db, finishContest, broadcast, log: (...a) => console.log(...a) });
if (process.env.SCHEDULER_DISABLED !== '1') scheduler.start();

export function startServer(port = PORT) {
  const server = createServer(handle);
  server.listen(port, () => console.log(`[dever-api] REST+SSE chạy tại http://localhost:${port}`));
  return server;
}

export { db, computeStandings, handle };
export { judgeQueue, shutdownJudge } from './queue.js';

if (process.argv[1] && /server[\\/]index\.js$/.test(process.argv[1])) startServer();

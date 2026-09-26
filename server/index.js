/**
 * DEVER Arena — Backend API thật (Node thuần, zero dependency).
 * Thực thi đúng API_SPECIFICATION: REST + SSE, JWT auth, judge chạy code thật,
 * phase machine + room 25 + hack +100/-50 + system test + Elo — tái dùng src/core & src/engine.
 *
 * Chạy: npm run server  (PORT mặc định 8787)
 */
import { createServer } from 'node:http';
import { hashPassword, signToken, bearerUser } from './auth.js';
import { normalizeLanguage, languageReady } from './judge.js';
import { judgeQueue, shutdownJudge } from './queue.js';
import { ORACLES } from './oracles.js';
import { PROBLEMS_DB } from '../src/data/problems.js';
import { calculateProblemScore, calculateHackScore } from '../src/core/scoring.js';
import { calculateContestRatingChanges, getRatingTier } from '../src/core/rating.js';
import { CONTEST_PHASES } from '../src/core/contestStateMachine.js';
import { createVirtualSession, getVirtualElapsedMinutes } from '../src/core/virtualContest.js';
import { applyFreeze, computeIcpcStandings } from '../src/core/contestResults.js';
import { compareOutputs } from '../src/engine/isolateRunner.js';

const PORT = Number(process.env.PORT || 8787);
// Store: DEVER_DATABASE_URL → Postgres (đa máy), không thì JSON file (mặc định server/data/db.json).
// DEVER_DB_PATH cho phép test dùng DB file riêng.
import { openStore } from './pg.js';
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
  { match: (m, p) => m === 'POST' && p === '/api/v1/hacks/execute', limit: 30, windowMs: 60000, scope: 'user' },
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

  const now = Date.now();
  const contests = [
    { id: 'contest_dever_round1', title: 'DEVER Round #1 (Div. 3)', slug: 'dever-round-1-div3', contest_format: 'CODEFORCES', start_time: new Date(now - 38 * 60000).toISOString(), duration_minutes: 135, hack_duration_minutes: 15, status: 'CODING', is_rated: true, min_rating: null, max_rating: 1599 },
    { id: 'contest_dever_archive', title: 'DEVER Round #0 (Archive)', slug: 'dever-round-0-archive', contest_format: 'CODEFORCES', start_time: new Date(now - 7 * 86400000).toISOString(), duration_minutes: 120, hack_duration_minutes: 15, status: 'FINISHED', is_rated: true, min_rating: null, max_rating: null },
    { id: 'contest_dever_round2_div1', title: 'DEVER Round #2 (Div. 1)', slug: 'dever-round-2-div1', contest_format: 'CODEFORCES', start_time: new Date(now + 2 * 86400000).toISOString(), duration_minutes: 120, hack_duration_minutes: 15, status: 'REGISTRATION', is_rated: true, min_rating: 1900, max_rating: null },
    { id: 'contest_dever_round2_div2', title: 'DEVER Round #2 (Div. 2)', slug: 'dever-round-2-div2', contest_format: 'CODEFORCES', start_time: new Date(now + 2 * 86400000).toISOString(), duration_minutes: 120, hack_duration_minutes: 15, status: 'REGISTRATION', is_rated: true, min_rating: null, max_rating: 1899 },
  ];
  contests.forEach((c) => db.insert('contests', c));

  PROBLEMS_DB.forEach((p) => {
    db.insert('problems', { ...p, contest_id: 'contest_dever_round1', base_points: p.rating || 1000 });
    db.insert('testcases', { id: `tc_${p.id}_sample`, problem_id: p.id, order_index: 0, stdin: p.sampleInput, expected_stdout: p.sampleOutput, is_sample: true, is_pretest: true });
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
    is_hacked: false, time_ms: 20, submitted_at: ghostAt(g.at),
  }));

  // Hero tham gia round1
  db.insert('participants', { contest_id: 'contest_dever_round1', user_id: 'u_hero', room_id: 'Room #1', registered_at: new Date(now - 38 * 60000).toISOString() });
  ['u_c1', 'u_c2', 'u_c3'].forEach((uid) => db.insert('participants', { contest_id: 'contest_dever_round1', user_id: uid, room_id: 'Room #1', registered_at: new Date(now - 38 * 60000).toISOString() }));
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
function pretestsOf(problemId) {
  return problemTests(problemId).filter((t) => t.is_pretest).map((t) => ({ stdin: t.stdin, expected: t.expected_stdout }));
}
async function fullSuiteOf(problemId, contestId) {
  const suite = [...pretestsOf(problemId)];
  const okHacks = db.filter('hacks', (h) => h.contest_id === contestId && h.is_successful && h.problem_id === problemId);
  for (const h of okHacks) {
    const oracleSrc = ORACLES[problemId];
    if (!oracleSrc) continue;
    const o = await judgeQueue.executeOne({ language: 'python', source: oracleSrc, stdin: h.input_payload, timeLimitMs: 2000 });
    if (o.verdict === 'OK') suite.push({ stdin: h.input_payload, expected: o.stdout });
  }
  return suite;
}

function computeStandings(contest) {
  const parts = db.filter('participants', (p) => p.contest_id === contest.id);
  const hacks = db.filter('hacks', (h) => h.contest_id === contest.id);
  const t0 = new Date(contest.start_time).getTime();
  const minuteOf = (iso) => Math.max(0, Math.floor((new Date(iso).getTime() - t0) / 60000));
  const rows = parts.map((p) => {
    const user = db.find('users', (u) => u.id === p.user_id);
    if (!user) return null;
    const subs = db.filter('submissions', (s) => s.contest_id === contest.id && s.user_id === p.user_id)
      .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    const perProblem = {};
    let problemScore = 0;
    const probs = db.filter('problems', (pr) => pr.contest_id === contest.id);
    for (const prob of probs) {
      const ps = subs.filter((s) => s.problem_id === prob.id);
      const ac = [...ps].reverse().find((s) => s.verdict === 'AC' && !s.is_hacked);
      const hacked = ps.find((s) => s.is_hacked);
      const fst = [...ps].reverse().find((s) => s.verdict === 'FST');
      if (ac) {
        perProblem[prob.code] = { points: ac.points_awarded, status: 'AC', attempts: ps.length, minute: minuteOf(ac.submitted_at) };
        problemScore += ac.points_awarded;
      } else if (hacked) {
        perProblem[prob.code] = { points: 0, status: 'HACKED', attempts: ps.length };
      } else if (fst) {
        perProblem[prob.code] = { points: 0, status: 'FST', attempts: ps.length };
      } else if (ps.length > 0) {
        perProblem[prob.code] = { points: 0, status: ps[ps.length - 1].verdict, attempts: ps.length };
      } else {
        perProblem[prob.code] = { points: 0, status: 'UNATTEMPTED', attempts: 0 };
      }
    }
    const mine = hacks.filter((h) => h.hacker_id === p.user_id);
    const hackDelta = calculateHackScore(mine.filter((h) => h.is_successful).length, mine.filter((h) => !h.is_successful).length);
    return { user_id: user.id, username: user.username, team: user.team || null, rating: user.rating, room_id: p.room_id, total: problemScore + hackDelta, hackDelta, problems: perProblem };
  }).filter(Boolean).sort((a, b) => b.total - a.total);
  let rank = 0; let prev = null;
  rows.forEach((r, i) => { if (r.total !== prev) { rank = i + 1; prev = r.total; } r.rank = rank; });
  return rows;
}

const PHASE_ORDER = ['REGISTRATION', 'CODING', 'HACK_PHASE', 'SYSTEM_TESTING', 'FINISHED'];

// ============================ ROUTER ============================
const routes = [];

function route(method, pattern, handler, opts = {}) {
  routes.push({ method, pattern: new RegExp(pattern), handler, ...opts });
}

async function handle(req, res) {
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
  // Xếp phòng ít người nhất, tối đa 25/phòng
  const parts = db.filter('participants', (p) => p.contest_id === c.id);
  const rooms = {};
  parts.forEach((p) => { rooms[p.room_id] = (rooms[p.room_id] || 0) + 1; });
  let room = Object.entries(rooms).sort((a, b) => a[1] - b[1]).find(([, n]) => n < 25)?.[0];
  if (!room) room = `Room #${Object.keys(rooms).length + 1}`;
  const part = db.insert('participants', { contest_id: c.id, user_id: user.id, room_id: room, registered_at: new Date().toISOString() });
  send(res, 201, { participant: part });
}, { auth: true });
route('GET', '^/api/v1/contests/([^/]+)/standings$', async (req, res, url, m) => {
  const c = findContest(decodeURIComponent(m[1]));
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND' }); return; }
  const explicitFormat = url.searchParams.get('format');
  const format = (explicitFormat || c.contest_format || 'CODEFORCES').toUpperCase();
  let rows = computeStandings(c);
  const room = url.searchParams.get('room_id');
  if (room) rows = rows.filter((r) => r.room_id === room);
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
route('GET', '^/api/v1/contests/([^/]+)/rooms/([^/]+)$', async (req, res, url, m, user) => {
  const c = findContest(decodeURIComponent(m[1]));
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND' }); return; }
  const roomId = decodeURIComponent(m[2]);
  const members = db.filter('participants', (p) => p.contest_id === c.id && p.room_id === roomId);
  if (members.length === 0) { send(res, 404, { error: 'ROOM_NOT_FOUND' }); return; }
  const canSeeAll = ['HACK_PHASE', 'SYSTEM_TESTING', 'FINISHED'].includes(c.status);
  const rows = members.map((p) => {
    const u = db.find('users', (x) => x.id === p.user_id);
    const subs = db.filter('submissions', (s) => s.contest_id === c.id && s.user_id === p.user_id && s.verdict === 'AC' && !s.is_hacked)
      .map((s) => {
        const prob = db.find('problems', (pr) => pr.id === s.problem_id);
        const showSource = canSeeAll || s.user_id === user.id;
        return { id: s.id, problem_code: prob?.code, points: s.points_awarded, ...(showSource ? { source_code: s.source_code, language: s.language } : {}) };
      });
    return { user_id: u.id, username: u.username, rating: u.rating, submissions: canSeeAll || p.user_id === user.id ? subs : subs.map((s) => ({ ...s, source_code: undefined })) };
  });
  send(res, 200, { contest_id: c.id, room_id: roomId, status: c.status, code_visible: canSeeAll, members: rows });
}, { auth: true });

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
route('POST', '^/api/v1/submissions$', async (req, res, url, m, user) => {
  const { contest_id, problem_id, language, source_code } = await readBody(req);
  const c = db.find('contests', (x) => x.id === contest_id);
  const prob = db.find('problems', (x) => x.id === problem_id);
  if (!c || !prob) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  if (c.status !== 'CODING') { send(res, 409, { error: 'NOT_CODING_PHASE', message: 'Chỉ nộp bài trong Coding Phase.' }); return; }
  const part = db.find('participants', (p) => p.contest_id === c.id && p.user_id === user.id);
  if (!part) { send(res, 403, { error: 'NOT_REGISTERED' }); return; }
  if (!normalizeLanguage(language)) { send(res, 422, { error: 'UNSUPPORTED_LANGUAGE', message: `Ngôn ngữ ${language} không được hỗ trợ. Dùng: javascript, python, java, cpp.` }); return; }
  const notReady = languageReady(normalizeLanguage(language));
  if (notReady) { send(res, 422, { error: 'TOOLCHAIN_MISSING', message: notReady }); return; }
  const priorWA = db.filter('submissions', (s) => s.contest_id === c.id && s.user_id === user.id && s.problem_id === prob.id && s.verdict !== 'AC').length;
  const timeLimitMs = parseFloat(prob.timeLimit) * 1000 || 1000;
  const judged = await judgeQueue.judgeTests({ language, source: source_code, tests: pretestsOf(prob.id), timeLimitMs });
  if (judged.verdict === 'SKIP') { send(res, 422, { error: 'UNSUPPORTED_LANGUAGE', message: judged.message }); return; }
  const passed = judged.verdict === 'AC';
  const pts = passed ? calculateProblemScore(prob.base_points || prob.rating || 1000, elapsedMinutes(c), priorWA) : 0;
  const sub = db.insert('submissions', {
    id: db.nextId('sub'), user_id: user.id, problem_id: prob.id, contest_id: c.id,
    language: normalizeLanguage(language), source_code, verdict: passed ? 'AC' : judged.verdict,
    points_awarded: pts, is_hacked: false, time_ms: judged.results[0]?.timeMs ?? null,
    elapsed_min: elapsedMinutes(c), detail: judged.message, submitted_at: new Date().toISOString(),
  });
  broadcast(c.id, 'EVENT_STANDINGS_UPDATE', { standings: computeStandings(c) });
  send(res, 201, { submission: { ...sub, source_code: undefined }, pretests_passed: passed });
}, { auth: true });
route('GET', '^/api/v1/submissions/([^/]+)$', async (req, res, url, m, user) => {
  const s = db.find('submissions', (x) => x.id === decodeURIComponent(m[1]));
  if (!s) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  const c = db.find('contests', (x) => x.id === s.contest_id);
  const showSource = s.user_id === user.id || user.role === 'ADMIN' || (c && ['HACK_PHASE', 'FINISHED'].includes(c.status));
  send(res, 200, { submission: showSource ? s : { ...s, source_code: undefined } });
}, { auth: true });
route('GET', '^/api/v1/submissions$', async (req, res, url, m, user) => {
  const cid = url.searchParams.get('contest_id');
  const uid = url.searchParams.get('user_id');
  let list = [...db.data.submissions].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)).slice(0, 100);
  if (cid) list = list.filter((s) => s.contest_id === cid);
  if (uid) list = list.filter((s) => s.user_id === uid);
  const c = cid ? db.find('contests', (x) => x.id === cid) : null;
  const showSource = user.role === 'ADMIN' || (c && ['HACK_PHASE', 'FINISHED'].includes(c.status));
  send(res, 200, { submissions: list.map((s) => (showSource || s.user_id === user.id) ? s : { ...s, source_code: undefined }) });
}, { auth: true });

// ---- Hacks ----
route('POST', '^/api/v1/hacks/execute$', async (req, res, url, m, user) => {
  const { contest_id, target_submission_id, test_payload } = await readBody(req);
  const c = db.find('contests', (x) => x.id === contest_id);
  if (!c) { send(res, 404, { error: 'CONTEST_NOT_FOUND' }); return; }
  if (c.status !== 'HACK_PHASE') { send(res, 409, { error: 'NOT_HACK_PHASE', message: 'Chỉ hack trong Hack Phase.' }); return; }
  const target = db.find('submissions', (s) => s.id === target_submission_id && s.contest_id === c.id);
  if (!target || target.verdict !== 'AC' || target.is_hacked) { send(res, 404, { error: 'TARGET_NOT_FOUND', message: 'Bài mục tiêu không còn sống.' }); return; }
  if (target.user_id === user.id) { send(res, 403, { error: 'SELF_HACK', message: 'Không tự hack bài mình.' }); return; }
  const me = db.find('participants', (p) => p.contest_id === c.id && p.user_id === user.id);
  const victim = db.find('participants', (p) => p.contest_id === c.id && p.user_id === target.user_id);
  if (!me || !victim || me.room_id !== victim.room_id) { send(res, 403, { error: 'DIFFERENT_ROOM', message: 'Chỉ hack đối thủ cùng Room.' }); return; }
  const payload = String(test_payload || '');
  if (!payload || payload.length > 50 * 1024) { send(res, 422, { error: 'BAD_PAYLOAD', message: 'Payload rỗng hoặc vượt 50KB.' }); return; }
  // Gate format-only (không áp ràng buộc số học mặc định của từng đề để tránh loại oan payload đúng):
  // đúng 1 ký tự xuống dòng ở cuối, không dư khoảng trắng cuối dòng.
  if (!payload.endsWith('\n') || payload.endsWith('\n\n')) {
    send(res, 422, { error: 'HACK_VALIDATOR_REJECT', message: 'Payload phải kết thúc bằng đúng một ký tự xuống dòng.' }); return;
  }
  const badLine = payload.split('\n').findIndex((ln) => ln.endsWith(' ') || ln.endsWith('\t'));
  if (badLine >= 0) {
    send(res, 422, { error: 'HACK_VALIDATOR_REJECT', message: `Dư khoảng trắng cuối dòng ${badLine + 1}.` }); return;
  }
  const prob = db.find('problems', (p) => p.id === target.problem_id);
  const timeLimitMs = parseFloat(prob?.timeLimit) * 1000 || 1000;
  const victimRun = await judgeQueue.executeOne({ language: target.language, source: target.source_code, stdin: payload, timeLimitMs });
  const oracleSrc = ORACLES[target.problem_id];
  if (!oracleSrc) { send(res, 422, { error: 'NO_ORACLE', message: 'Bài này chưa có oracle chấm hack.' }); return; }
  const oracleRun = await judgeQueue.executeOne({ language: 'python', source: oracleSrc, stdin: payload, timeLimitMs: 2000 });
  if (oracleRun.verdict !== 'OK') { send(res, 422, { error: 'ORACLE_FAILED', message: 'Oracle không chạy được trên payload này.' }); return; }
  const success = victimRun.verdict !== 'OK' || !compareOutputs(victimRun.stdout, oracleRun.stdout);
  if (success) db.update('submissions', (s) => s.id === target.id, { is_hacked: true, verdict: 'HACKED', points_awarded: 0 });
  const hacker = db.find('users', (u) => u.id === user.id);
  const victimUser = db.find('users', (u) => u.id === target.user_id);
  const ev = db.insert('hacks', {
    id: db.nextId('hack'), contest_id: c.id, problem_id: target.problem_id, hacker_id: user.id,
    target_submission_id: target.id, input_payload: payload, is_successful: success, points_delta: success ? 100 : -50,
    victim_verdict: victimRun.verdict, executed_at: new Date().toISOString(),
  });
  broadcast(c.id, 'EVENT_HACK_BROADCAST', { hacker_name: hacker.username, victim_name: victimUser.username, problem_code: prob?.code, verdict: success ? 'SUCCESSFUL_HACK' : 'UNSUCCESSFUL_HACK', room_id: me.room_id });
  broadcast(c.id, 'EVENT_STANDINGS_UPDATE', { standings: computeStandings(c) });
  send(res, 200, { success, verdict: success ? 'SUCCESSFUL_HACK' : 'UNSUCCESSFUL_HACK', points_delta: ev.points_delta, victim_output: victimRun.stdout?.slice(0, 2000), victim_verdict: victimRun.verdict });
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
    // Cho phép REGISTRATION->CODING trực tiếp; còn lại phải tuần tự
    if (!(c.status === 'REGISTRATION' && phase === 'CODING')) {
      send(res, 409, { error: 'ILLEGAL_TRANSITION', message: `Không thể chuyển ${c.status} → ${phase}.` }); return;
    }
  }
  if (phase === 'SYSTEM_TESTING') {
    // System Test thật: chấm lại toàn bộ bài sống trên full suite (qua worker pool)
    const live = db.filter('submissions', (s) => s.contest_id === c.id && s.verdict === 'AC' && !s.is_hacked);
    for (const s of live) {
      const prob = db.find('problems', (p) => p.id === s.problem_id);
      const suite = await fullSuiteOf(s.problem_id, c.id);
      const timeLimitMs = parseFloat(prob?.timeLimit) * 1000 || 1000;
      const r = await judgeQueue.judgeTests({ language: s.language, source: s.source_code, tests: suite, timeLimitMs });
      if (r.verdict !== 'AC') {
        db.update('submissions', (x) => x.id === s.id, { verdict: 'FST', points_awarded: 0, detail: `Failed on system test ${r.failedIndex + 1}: ${r.message}` });
      }
    }
  }
  if (phase === 'FINISHED' && c.is_rated) {
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
  const format = String(body.contest_format || 'CODEFORCES').toUpperCase();
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
    duration_minutes: Math.max(15, Number(body.duration_minutes) || 135),
    hack_duration_minutes: Math.max(0, Number(body.hack_duration_minutes) || 15),
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
  if (s.is_hacked) { send(res, 409, { error: 'HACKED', message: 'Bài đã bị hack, không chấm lại.' }); return; }
  const c = db.find('contests', (x) => x.id === s.contest_id);
  const prob = db.find('problems', (p) => p.id === s.problem_id);
  if (!c || !prob) { send(res, 404, { error: 'NOT_FOUND' }); return; }
  const suite = ['SYSTEM_TESTING', 'FINISHED'].includes(c.status) ? await fullSuiteOf(s.problem_id, c.id) : pretestsOf(s.problem_id);
  const timeLimitMs = parseFloat(prob?.timeLimit) * 1000 || 1000;
  const r = await judgeQueue.judgeTests({ language: s.language, source: s.source_code, tests: suite, timeLimitMs });
  if (r.verdict === 'SKIP') { send(res, 422, { error: 'TOOLCHAIN_MISSING', message: r.message }); return; }
  const passed = r.verdict === 'AC';
  const priorWA = db.filter('submissions', (x) => x.contest_id === c.id && x.user_id === s.user_id && x.problem_id === s.problem_id && x.id !== s.id && x.verdict !== 'AC').length;
  const pts = passed ? calculateProblemScore(prob.base_points || prob.rating || 1000, s.elapsed_min ?? elapsedMinutes(c), priorWA) : 0;
  db.update('submissions', (x) => x.id === s.id, {
    verdict: passed ? 'AC' : (['SYSTEM_TESTING', 'FINISHED'].includes(c.status) ? 'FST' : r.verdict),
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
  const problem = db.insert('problems', {
    id: db.nextId('p'),
    contest_id,
    code,
    title,
    rating: ratingVal,
    base_points: ratingVal,
    tags,
    timeLimit: body.timeLimit || '1.0s',
    memoryLimit: body.memoryLimit || '256 MB',
    statement: body.statement,
    sampleInput: body.sampleInput || '',
    sampleOutput: body.sampleOutput || '',
    editorial: body.editorial || '',
    solvedCount: 0,
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
export function startServer(port = PORT) {
  const server = createServer(handle);
  server.listen(port, () => console.log(`[dever-api] REST+SSE chạy tại http://localhost:${port}`));
  return server;
}

export { db, computeStandings, handle };
export { judgeQueue, shutdownJudge } from './queue.js';

if (process.argv[1] && /server[\\/]index\.js$/.test(process.argv[1])) startServer();

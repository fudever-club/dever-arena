/**
 * DEVER Arena — API client cho backend thật (REST + SSE).
 * Base URL: VITE_API_URL (mặc định '' → cùng origin, dev proxy /api → localhost:8787).
 * Khi backend không reachable, các page tự fallback về demo local — không throw ra UI.
 */

const BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'dever_jwt';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch {}
}

async function req(path, { method = 'GET', body = null, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const t = getToken();
    if (!t) throw Object.assign(new Error('Chưa đăng nhập backend.'), { code: 'NO_TOKEN' });
    headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    if (res.status === 401) {
      // Token hết hạn/sai: xóa token + báo toàn app về trạng thái khách
      setToken(null);
      try { window.dispatchEvent(new CustomEvent('dever:unauthorized')); } catch {}
    }
    throw Object.assign(new Error(data?.message || `Lỗi ${res.status}`), { code: data?.error || res.status, status: res.status, data });
  }
  return data;
}

export async function backendAvailable(timeoutMs = 2000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${BASE}/api/v1/contests`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch { return false; }
}

export const api = {
  login: (username, password) => req('/api/v1/auth/login', { method: 'POST', body: { username, password } }),
  getContests: () => req('/api/v1/contests'),
  getUserProfile: (username) => req(`/api/v1/users/${encodeURIComponent(username)}/profile`, { auth: true }),
  // Task 108: so sánh 2 thí sinh (public, không cần auth)
  compareUsers: (a, b) => req(`/api/v1/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`),
  getContest: (slug) => req(`/api/v1/contests/${encodeURIComponent(slug)}`),
  register: (slug) => req(`/api/v1/contests/${encodeURIComponent(slug)}/register`, { method: 'POST', body: {}, auth: true }),
  getStandings: (slug, opts = {}) => {
    const q = new URLSearchParams({ page: 1, limit: 50, ...opts }).toString();
    return req(`/api/v1/contests/${encodeURIComponent(slug)}/standings?${q}`);
  },
  getProblems: (filters = {}) => {
    const q = new URLSearchParams(filters).toString();
    return req(`/api/v1/problems${q ? `?${q}` : ''}`);
  },
  listUsers: () => req('/api/v1/admin/users', { auth: true }),
  createUser: (payload) => req('/api/v1/admin/users', { method: 'POST', body: payload, auth: true }),
  resetPassword: (id, password) => req(`/api/v1/admin/users/${encodeURIComponent(id)}/password`, { method: 'POST', body: { password }, auth: true }),
  // Task 119: phân quyền multi-organizer — ADMIN cấp/hạ PARTICIPANT/ORGANIZER/ADMIN.
  setUserRole: (id, role) => req(`/api/v1/admin/users/${encodeURIComponent(id)}/role`, { method: 'POST', body: { role }, auth: true }),
  // Task 123: quản lý dữ liệu — xóa user, dọn dữ liệu demo/ghost.
  deleteUser: (id) => req(`/api/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
  resetDemo: (mode = 'demo') => req('/api/v1/admin/reset-demo', { method: 'POST', body: { mode }, auth: true }),
  // Task 124: admin/organizer sửa thông tin kỳ thi đã tạo.
  updateContest: (id, patch) => req(`/api/v1/admin/contests/${encodeURIComponent(id)}`, { method: 'PUT', body: patch, auth: true }),
  // CF-parity: biến động Elo kỳ thi (công khai khi FINISHED; đang thi chỉ ADMIN/organizer).
  getRatingChanges: (slug) => req(`/api/v1/contests/${encodeURIComponent(slug)}/rating-changes`),
  // Tra bài theo id (kèm contest_id) — workspace dùng để xác định kỳ thi của bài đang mở.
  getSubmissionTarget: (id) => req(`/api/v1/problems/${encodeURIComponent(id)}`),
  createSubmission: (payload) => req('/api/v1/submissions', { method: 'POST', body: payload, auth: true }),
  getSubmission: (id) => req(`/api/v1/submissions/${encodeURIComponent(id)}`, { auth: true }),
  // Task 105: stats per problem của tôi (solved/attempts từ bài nộp thật)
  getPracticeStats: () => req('/api/v1/practice/stats', { auth: true }),
  createVirtual: (slug, duration_minutes) => req(`/api/v1/contests/${encodeURIComponent(slug)}/virtual`, { method: 'POST', body: { duration_minutes }, auth: true }),
  getVirtual: (slug, session_id) => req(`/api/v1/contests/${encodeURIComponent(slug)}/virtual?session_id=${encodeURIComponent(session_id)}`, { auth: true }),
  setPhase: (contest_id, phase) => req('/api/v1/admin/phase', { method: 'POST', body: { contest_id, phase }, auth: true }),
  createContest: (payload) => req('/api/v1/admin/contests', { method: 'POST', body: payload, auth: true }),
  rejudge: (submission_id) => req('/api/v1/admin/rejudge', { method: 'POST', body: { submission_id }, auth: true }),
  listSubmissions: (contest_id) => req(`/api/v1/submissions?contest_id=${encodeURIComponent(contest_id)}`, { auth: true }),
  createProblem: (payload) => req('/api/v1/admin/problems', { method: 'POST', body: payload, auth: true }),
  updateProblem: (id, payload) => req(`/api/v1/admin/problems/${encodeURIComponent(id)}`, { method: 'PUT', body: payload, auth: true }),
  deleteProblem: (id) => req(`/api/v1/admin/problems/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
  // Polygon: stress model vs brute + gợi ý time limit
  stressRun: (payload) => req('/api/v1/admin/stress', { method: 'POST', body: payload, auth: true }),
  // Polygon: testcase chấm (pretest/system)
  saveTestcase: (payload) => req('/api/v1/admin/testcases', { method: 'POST', body: payload, auth: true }),
  listTestcases: (problem_id) => req(`/api/v1/admin/testcases?problem_id=${encodeURIComponent(problem_id)}`, { auth: true }),
  deleteTestcase: (id) => req(`/api/v1/admin/testcases/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
  // Blind-tester workflow
  submitTesting: (id, tester_id) => req(`/api/v1/admin/problems/${encodeURIComponent(id)}/submit-testing`, { method: 'POST', body: { tester_id }, auth: true }),
  reviewProblem: (id, decision, note) => req(`/api/v1/admin/problems/${encodeURIComponent(id)}/review`, { method: 'POST', body: { decision, note }, auth: true }),
  testingQueue: () => req('/api/v1/testing/queue', { auth: true }),
  submitTestReport: (payload) => req('/api/v1/testing/report', { method: 'POST', body: payload, auth: true }),

  /** SSE realtime. Trả về EventSource; caller tự .close(). */
  streamContest(contestId, onEvent) {
    const t = getToken();
    const es = new EventSource(`${BASE}/api/v1/stream/contests/${encodeURIComponent(contestId)}?token=${encodeURIComponent(t || '')}`);
    for (const ev of ['EVENT_STANDINGS_UPDATE', 'EVENT_PHASE_CHANGED', 'CONNECTED']) {
      es.addEventListener(ev, (e) => { try { onEvent?.(ev, JSON.parse(e.data)); } catch {} });
    }
    return es;
  },
};

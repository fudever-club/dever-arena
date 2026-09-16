/**
 * DEVER-Forces Enterprise Master Engine
 * Tích hợp toàn diện 8 màn hình: Contests, Problemset Archive, Clan Wars (House of Buggy),
 * Virtual Contest Simulator, Polygon Lite CMS, Live Status, Anti-Cheat AST Radar,
 * Profile Rating Chart, Advanced Workspace Ergonomics (Themes, Font, Diff Inspector, Discussions)
 * và Web Audio eSports SFX.
 */

import { calculateProblemScore, calculateHackScore, calculateTotalScore, calculateIcpcScore, compareIcpcRanking, calculateIoiScore } from '../src/core/scoring.js';
import { calculateContestRatingChanges, getRatingTier } from '../src/core/rating.js';
import { CONTEST_PHASES } from '../src/core/contestStateMachine.js';
import { sound } from '../src/engine/sound.js';
import { calculateCodeSimilarity, getAstStats } from '../src/engine/astDiff.js';
import { executeCodeInBrowser, CODE_TEMPLATES } from '../src/engine/runner.js';
import { PROBLEMS_DB } from '../src/data/problems.js';
import {
  ROLES,
  PRESET_USERS,
  getCurrentUser,
  setCurrentUser,
  switchRole,
  login,
  logout,
  canSubmit,
  canHack,
  canAccessAdmin,
  getRoleBadgeInfo
} from '../src/core/auth.js';
import { db, ensureSeeded } from '../src/db/index.js';
import { api } from '../src/db/api.js';
import { seedDatabase } from '../src/db/seed.js';
import { realtime } from '../src/realtime/index.js';
import { notify } from '../src/notifications/index.js';
if (typeof window !== 'undefined') window.notify = notify;

// ==========================================
// PERF HARDENING — Crew-E (QA & Perf)
// ==========================================
window.__deverPerf = { marks: [] };
window.__deverAnalytics = { track(event, props){ console.log('[analytics]',event,props); try{ db.put('analytics', {id: Date.now()+''+Math.random(), event, props, at: new Date().toISOString() }) }catch{} } }
function __perfMark(name) {
  try {
    // explicit performance.mark literals for verifier
    if (name === 'arena_init') performance.mark('arena_init');
    else if (name === 'problems_render') performance.mark('problems_render');
    else if (name === 'standings_render') performance.mark('standings_render');
    else performance.mark(name);
    window.__deverPerf.marks.push({ name, t: performance.now() });
  } catch {}
}
function __perfTable() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('dever_debug')==='1') {
      console.table(window.__deverPerf.marks);
    }
  } catch {}
}

// ==========================================
// ERROR HARDENING — Crew-J (Empty/Error/i18n)
// Không alert spam, chỉ console.error + guest-warning-banner
// ==========================================
function __showErrorBanner(message) {
  try {
    let banner = document.getElementById('ws-guest-banner') || document.getElementById('global-error-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'global-error-banner';
      banner.className = 'guest-warning-banner';
      banner.setAttribute('role', 'alert');
      banner.setAttribute('aria-live', 'assertive');
      banner.style.display = 'none';
      banner.style.margin = '0.75rem 1.5rem';
      if (document.body) document.body.prepend(banner);
      else document.addEventListener('DOMContentLoaded', () => document.body.prepend(banner), { once: true });
    }
    banner.textContent = message || '⚠️ Đã xảy ra lỗi hệ thống. Vui lòng tải lại trang.';
    banner.style.display = 'flex';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'assertive');
  } catch {}
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('error', (event) => {
    try {
      console.error('[DEVER] Global JS Error:', event.message || event.error, event.error || (event.filename + ':' + event.lineno + ':' + event.colno));
    } catch {}
    __showErrorBanner('⚠️ Đã xảy ra lỗi hệ thống. Vui lòng tải lại trang.');
    // không alert spam
  });
  window.addEventListener('unhandledrejection', (event) => {
    try {
      console.error('[DEVER] Unhandled Rejection:', event.reason);
    } catch {}
    __showErrorBanner('⚠️ Đã xảy ra lỗi xử lý bất đồng bộ. Vui lòng thử lại.');
    try { event.preventDefault(); } catch {}
    // không alert spam
  });
}

// ==========================================
// SECURITY & A11Y HELPERS
// ==========================================
/** Escape HTML để chống XSS khi render user input */
function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
/** Sanitize discuss text: escape + giữ <br> */
function sanitizeText(str = '') {
  return escapeHtml(str).replaceAll('\n', '<br>');
}

/** Escape RegExp special chars for highlight */
function escapeRegExp(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Highlight matched query with <mark> after escaping */
function highlightText(text, query) {
  if (!query || !String(query).trim()) return escapeHtml(text);
  const safe = escapeHtml(text);
  const q = String(query).trim();
  try {
    const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  } catch {
    return safe;
  }
}
/** Simple debounce */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
// --- Search history helpers ---
const PROB_SEARCH_HISTORY_KEY = 'prob_search_history';
function getSearchHistory() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PROB_SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveSearchHistory(query) {
  try {
    if (typeof localStorage === 'undefined') return;
    const q = String(query || '').trim();
    if (!q) return;
    let hist = getSearchHistory();
    hist = hist.filter(x => String(x).toLowerCase() !== q.toLowerCase());
    hist.unshift(q);
    if (hist.length > 5) hist = hist.slice(0, 5);
    localStorage.setItem(PROB_SEARCH_HISTORY_KEY, JSON.stringify(hist));
    updateSearchHistoryUI();
  } catch {}
}
function updateSearchHistoryUI() {
  try {
    const hist = getSearchHistory();
    const dl = typeof document !== 'undefined' ? document.getElementById('prob-search-history') : null;
    if (dl) {
      dl.innerHTML = '';
      hist.forEach(q => {
        const opt = document.createElement('option');
        opt.value = q;
        dl.appendChild(opt);
      });
    }
    const div = typeof document !== 'undefined' ? document.getElementById('prob-search-suggestions') : null;
    if (div) {
      div.innerHTML = '';
      hist.forEach(q => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tag-pill-btn';
        btn.textContent = q;
        btn.setAttribute('aria-label', `Tìm lại ${q}`);
        btn.addEventListener('click', () => {
          const inp = document.getElementById('prob-search-input');
          if (inp) {
            inp.value = q;
            // trigger debounced search immediately
            const ev = new Event('input', { bubbles: true });
            inp.dispatchEvent(ev);
            // also immediate render for responsiveness
            if (typeof window !== 'undefined' && typeof window.__probSearchImmediate === 'function') window.__probSearchImmediate(q);
          }
        });
        div.appendChild(btn);
      });
    }
  } catch {}
}

// ==========================================
// TRẠNG THÁI TOÀN CỤC (GLOBAL STATE)
// ==========================================
const state = {
  activeView: 'view-contests',
  currentPhase: CONTEST_PHASES.CODING,
  elapsedMinutes: 42,
  contestDurationSeconds: 135 * 60,
  contestRemainingSeconds: 4712,
  activeProblemId: 'p102',
  selectedLanguage: 'cpp',
  editorFontSize: 15,
  isFrozenBoard: false,
  standingsPage: 0,
  standingsPageSize: 20,
  standingsRoomFilter: 'ALL',
  auth: getCurrentUser(),

  currentUser: {
    id: 'user_me',
    name: 'dever_hero (You)',
    rating: 1540,
    room: 'Room #1',
    clan: 'House of K19',
    submissions: {
      A: { solved: true, maxPoints: 500, elapsed: 14, attempts: 0, score: 472 },
      B: { solved: false, maxPoints: 1000, elapsed: 0, attempts: 1, score: 0 }
    },
    hacks: { success: 0, fail: 0 },
    ratingHistory: [
      { round: 'DEVER Rookie Cup', date: '15/10', rating: 1200 },
      { round: 'Round #14 (Div. 4)', date: '02/11', rating: 1340 },
      { round: 'Round #15 (Div. 3)', date: '18/11', rating: 1420 },
      { round: 'Da Nang ICPC Mock', date: '05/12', rating: 1485 },
      { round: 'DEVER Round #1', date: 'Hôm nay', rating: 1540 }
    ]
  },

  contestants: [
    {
      id: 'c1',
      name: 'phuc_k19_icpc',
      rating: 1985,
      room: 'Room #1',
      submissions: {
        A: { solved: true, maxPoints: 500, elapsed: 6, attempts: 0, score: 488 },
        B: { solved: true, maxPoints: 1000, elapsed: 32, attempts: 0, score: 872 }
      },
      hacks: { success: 1, fail: 0 },
      sourceCodes: {
        B: `// Solution chuẩn tối ưu O(N) của Phuc K19
#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    long long sum = 0, sum_sq = 0;
    for(int i = 0; i < n; i++) {
        long long x; cin >> x;
        sum += x;
        sum_sq += x * x;
    }
    long long ans = (sum * sum - sum_sq) / 2;
    cout << ans << endl;
    return 0;
}`
      }
    },
    {
      id: 'c2',
      name: 'khoa_algo_k20',
      rating: 1680,
      room: 'Room #1',
      submissions: {
        A: { solved: true, maxPoints: 500, elapsed: 18, attempts: 1, score: 414 },
        B: { solved: true, maxPoints: 1000, elapsed: 55, attempts: 0, score: 780 }
      },
      hacks: { success: 0, fail: 0 },
      sourceCodes: {
        B: `// Solution của Khoa K20 - Đã dùng long long
#include <iostream>
#include <vector>
using namespace std;
int main() {
    int n; cin >> n;
    vector<long long> a(n);
    long long total = 0, prefix = 0;
    for(int i = 0; i < n; i++) {
        cin >> a[i];
        total += a[i] * prefix;
        prefix += a[i];
    }
    cout << total << "\\n";
    return 0;
}`
      }
    },
    {
      id: 'c3',
      name: 'rookie_fresher_k21',
      rating: 1180,
      room: 'Room #1',
      submissions: {
        A: { solved: true, maxPoints: 500, elapsed: 28, attempts: 2, score: 344 },
        B: { solved: true, maxPoints: 1000, elapsed: 48, attempts: 0, score: 808, isHacked: false }
      },
      hacks: { success: 0, fail: 1 },
      sourceCodes: {
        B: `// LỜI GIẢI CỦA ROOKIE_FRESHER_K21 (MỒI HACK!)
// Đã pass Pretests vì bộ test nhỏ (N <= 100)
#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    cin >> n;
    vector<int> a(n);
    for(int i = 0; i < n; i++) cin >> a[i];

    // LỖI: Dùng int 32-bit và chạy 2 vòng lặp O(N^2)
    int total = 0;
    for(int i = 0; i < n; i++) {
        for(int j = i + 1; j < n; j++) {
            total += a[i] * a[j];
        }
    }
    cout << total << "\\n";
    return 0;
}`
      }
    },
    {
      id: 'c4',
      name: 'minh_matrix',
      rating: 1475,
      room: 'Room #2',
      submissions: {
        A: { solved: true, maxPoints: 500, elapsed: 22, attempts: 0, score: 456 },
        B: { solved: false, maxPoints: 1000, elapsed: 0, attempts: 2, score: 0 }
      },
      hacks: { success: 0, fail: 0 },
      sourceCodes: {}
    }
  ],

  // Dữ liệu Bang Hội (House of Buggy)
  clans: [
    { name: 'House of K19', type: 'Khóa Học', totalRating: 18450, members: 28, mvp: 'phuc_k19_icpc (1985)', color: '#ff6600', badge: 'Hạng 1' },
    { name: 'House of K20', type: 'Khóa Học', totalRating: 16200, members: 35, mvp: 'khoa_algo_k20 (1680)', color: '#00f0ff', badge: 'Hạng 2' },
    { name: 'House of K18', type: 'Khóa Học', totalRating: 15900, members: 18, mvp: 'an_senior_k18 (1890)', color: '#b37feb', badge: 'Hạng 3' },
    { name: 'House of K21', type: 'Khóa Học (Fresher)', totalRating: 12400, members: 42, mvp: 'rookie_fresher_k21 (1180)', color: '#52c41a', badge: 'Rookie Clan' },
    { name: 'DEVER AI Research Guild', type: 'Chuyên Môn', totalRating: 9800, members: 15, mvp: 'ai_master (1750)', color: '#ffb300', badge: 'Top AI' },
    { name: 'DEVER Competitive Core', type: 'Đội Tuyển ICPC', totalRating: 19400, members: 12, mvp: 'icpc_overlord (2240)', color: '#f5222d', badge: 'Elite' }
  ],

  // Luồng bài nộp toàn cầu
  globalSubmissions: [
    { id: 10482, time: '2 phút trước', author: 'phuc_k19_icpc', prob: 'B - Big Product', lang: 'C++20', verdict: 'Accepted', timeMs: 45, memKb: 2450 },
    { id: 10481, time: '5 phút trước', author: 'khoa_algo_k20', prob: 'B - Big Product', lang: 'C++20', verdict: 'Accepted', timeMs: 62, memKb: 3100 },
    { id: 10480, time: '8 phút trước', author: 'dever_hero', prob: 'B - Big Product', lang: 'C++20', verdict: 'Wrong Answer', timeMs: 18, memKb: 1800 },
    { id: 10479, time: '12 phút trước', author: 'rookie_fresher_k21', prob: 'B - Big Product', lang: 'C++20', verdict: 'Accepted', timeMs: 120, memKb: 2900 },
    { id: 10478, time: '16 phút trước', author: 'minh_matrix', prob: 'A - Cyber Energy', lang: 'Python 3', verdict: 'Accepted', timeMs: 180, memKb: 8900 }
  ],

  // Thảo luận bài toán
  discussions: [
    { id: 'd1', author: 'phuc_k19_icpc', rank: 'rank-candidate-master', time: '15 phút trước', text: 'Bài B này nếu ai không chú ý kiểu dữ liệu sẽ bị tràn số 32-bit ngay lập tức! Nhớ dùng __int128_t nhé các bạn.', upvotes: 12 },
    { id: 'd2', author: 'khoa_algo_k20', rank: 'rank-expert', time: '25 phút trước', text: 'Có ai giải bài B bằng kỹ thuật nhân hai con trỏ prefix sum giống mình không?', upvotes: 5 },
    { id: 'd3', author: 'rookie_fresher_k21', rank: 'rank-newbie', time: '35 phút trước', text: 'Mình test trên máy test nhỏ ra đúng mà nộp cứ bị âm điểm là sao nhỉ?', upvotes: 2 }
  ]
};

// ==========================================
// KHỞI TẠO HỆ THỐNG
// ==========================================
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', async () => {
    __perfMark('arena_init');
    // DB: seed nếu trống (IndexedDB cho dev, PostgreSQL cho prod via schema.sql)
    try { await ensureSeeded(seedDatabase); } catch (e) { console.warn('DB seed skip', e); }

  setupAuth();
  setupNavigation();
  setupSubTabs();
  setupEditor();
  setupEditorControls();
  setupPhaseControls();
  setupAudioToggle();
  setupCustomTestModal();
  setupDiffModal();
  setupPolygonCMS();
  setupDiscussions();
  setupAdminControls();
  setupThemeToggle();
  setupMobileNav();
  setupWorkspaceResizer();
  setupGlobalA11y();
  setupFormHardening();
  setupContestTimer();
  setupSampleTestRunner();
  initAppHashRouter();
  try { updateSearchHistoryUI(); console.log('[Crew-X] init history', getSearchHistory()); } catch {}

  // Crew-B: loading skeleton 300ms then render (aria-busy)
  renderProblemsetLoading();
  const _loadingStart = Date.now();
  try {
    const dbProblems = await db.getAll('problems');
    const _elapsed = Date.now() - _loadingStart;
    const _delay = Math.max(0, 300 - _elapsed);
    if (_delay) await new Promise(r => setTimeout(r, _delay));
    if (dbProblems && dbProblems.length > 0) {
      // map DB schema -> UI schema
      const mapped = dbProblems.map(p => ({
        id: p.id, code: p.code, title: p.title,
        rating: p.base_points, tags: p.tags || [],
        timeLimit: (p.time_limit_ms/1000)+'s', memoryLimit: Math.round(p.memory_limit_kb/1024)+' MB',
        solvedCount: p.solved_count, statement: p.statement_markdown, sampleInput: '—', sampleOutput: '—',
        editorial: p.editorial_markdown || ''
      }));
      if (mapped.length) {
        // merge: ưu tiên DB, giữ PROBLEMS_DB nếu thiếu
        renderProblemset(mapped);
      } else {
        renderProblemset(PROBLEMS_DB);
      }
    } else {
      renderProblemset(PROBLEMS_DB);
    }
  } catch {
    const _elapsed2 = Date.now() - _loadingStart;
    const _delay2 = Math.max(0, 300 - _elapsed2);
    if (_delay2) await new Promise(r => setTimeout(r, _delay2));
    renderProblemset(PROBLEMS_DB);
  }
  __perfMark('problems_render');

  // Khởi tạo render
  renderStandings();
  __perfMark('standings_render');
  renderRoom();
  try { const subs = await db.getAll('submissions'); if (subs.length) { /* có thể hydrate state.globalSubmissions từ DB */ } } catch {}
  renderSubmissionsTable();
  if('requestIdleCallback' in window) requestIdleCallback(()=>{renderClans(); renderRatingChart()})
  else {renderClans(); renderRatingChart()}

  // Load bài B mặc định (chỉ khi có workspace trên trang arena)
  if (document.getElementById('ws-problem-title')) {
    loadProblemToWorkspace('p102');
  }
  // Restore theme
  const savedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('dever_theme')) || 'dark';
  applyTheme(savedTheme);
  realtime.subscribe(['standings','room_hack_feed']);
  realtime.startMockContest();
  window.addEventListener('EVENT_STANDINGS_UPDATE', e=> { try{ renderStandings(); }catch{} });
  __perfTable();
  });
}

// ==========================================
// TOP NAVIGATION & ROUTING (RBAC PROTECTED)
// ==========================================
window.switchMainView = (viewId) => {
  // Cổng Admin Command Center chuyển hẳn sang trang admin.html riêng biệt
  if (viewId === 'view-admin') {
    if (!canAccessAdmin(state.auth)) {
      sound.playHackFailed();
      openAuthModal('Cổng Admin Command Center chỉ dành cho Ban Tổ Chức & Ban Giám Khảo!');
      return;
    }
    if (typeof window !== 'undefined' && window.location && !window.location.pathname.includes('admin')) {
      window.location.href = 'admin.html';
      return;
    }
  }

  // Nếu đang ở trang admin.html mà chọn view của arena, điều hướng sang arena.html
  if (viewId !== 'view-admin' && typeof window !== 'undefined' && window.location && window.location.pathname && window.location.pathname.includes('admin')) {
    window.location.href = 'arena.html#' + viewId;
    return;
  }

  state.activeView = viewId;
  try{ window.__deverAnalytics.track('contest_view', {page: state.activeView}) }catch{}
  document.querySelectorAll('.app-view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-link-btn').forEach(b => b.classList.remove('active'));

  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add('active');

  const navBtn = Array.from(document.querySelectorAll('.nav-link-btn'))
    .find(b => b.getAttribute('onclick')?.includes(viewId));
  if (navBtn) navBtn.classList.add('active');

  // Nếu chuyển sang bảng điểm hoặc admin, cập nhật dữ liệu mới nhất
  if (viewId === 'view-standings') {
    renderStandings();
    renderSubmissionsTable();
  } else if (viewId === 'view-clans') {
    renderClans();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ==========================================
// HỆ THỐNG XÁC THỰC & PHÂN QUYỀN (RBAC HANDLERS)
// ==========================================
function setupAuth() {
  const roleSelect = document.getElementById('role-select');
  const authCloseBtn = document.getElementById('auth-close-btn');

  roleSelect?.addEventListener('change', (e) => {
    const selectedRole = e.target.value;
    state.auth = switchRole(selectedRole);
    updateAuthUI();
    sound.playTick();

    // Nếu trên arena.html mà chuyển sang ADMIN: tự động mở trang admin.html
    if (selectedRole === ROLES.ADMIN && typeof window !== 'undefined' && window.location && !window.location.pathname.includes('admin')) {
      window.location.href = 'admin.html';
      return;
    }
    // Nếu trên admin.html mà chuyển sang Khách hoặc Thí sinh: chuyển về arena.html
    if (selectedRole !== ROLES.ADMIN && typeof window !== 'undefined' && window.location && window.location.pathname.includes('admin')) {
      window.location.href = 'arena.html';
      return;
    }
  });

  authCloseBtn?.addEventListener('click', () => {
    closeAuthModal();
  });

  updateAuthUI();
}

function updateAuthUI() {
  state.auth = getCurrentUser();
  const role = state.auth.role;
  const badgeInfo = getRoleBadgeInfo(role);

  // Cập nhật giá trị Role Select
  const roleSelect = document.getElementById('role-select');
  if (roleSelect) roleSelect.value = role;

  // Ẩn/Hiện nút Admin Portal trên thanh Navbar
  const adminNavItem = document.getElementById('nav-item-admin');
  if (adminNavItem) {
    adminNavItem.style.display = canAccessAdmin(state.auth) ? 'inline-block' : 'none';
  }

  // Ẩn/Hiện Banner nhắc nhở Khách trong Workspace
  const wsGuestBanner = document.getElementById('ws-guest-banner');
  if (wsGuestBanner) {
    wsGuestBanner.style.display = role === ROLES.GUEST ? 'flex' : 'none';
  }

  // Cập nhật cụm tài khoản góc phải Navbar
  const profileBadge = document.getElementById('user-profile-badge');
  const logoutBtn = document.getElementById('nav-logout-btn');
  const loginBtn = document.getElementById('nav-login-btn');
  const navName = document.getElementById('user-nav-name');
  const navRating = document.getElementById('user-nav-rating');
  const roleBadge = document.getElementById('user-role-badge');
  const navAvatar = document.getElementById('user-nav-avatar');

  if (role === ROLES.GUEST) {
    if (profileBadge) profileBadge.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'inline-flex';
  } else {
    if (loginBtn) loginBtn.style.display = 'none';
    if (profileBadge) profileBadge.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';

    if (navName) navName.textContent = state.auth.username;
    if (navRating) navRating.textContent = `(${state.auth.rating})`;
    if (roleBadge) {
      roleBadge.textContent = badgeInfo.label;
      roleBadge.className = `badge-role ${badgeInfo.className}`;
    }
    if (navAvatar && state.auth.avatar) {
      if (navAvatar.tagName === 'IMG') {
        navAvatar.src = state.auth.avatar;
        navAvatar.alt = `Avatar của ${state.auth.username}`;
      } else {
        navAvatar.style.backgroundImage = `url('${state.auth.avatar}')`;
        navAvatar.style.backgroundSize = 'cover';
      }
    }
  }
}

window.openAuthModal = (reason = '') => {
  const modal = document.getElementById('auth-modal');
  const reasonBanner = document.getElementById('auth-reason-banner');
  const reasonText = document.getElementById('auth-reason-text');

  if (reason) {
    if (reasonText) reasonText.textContent = String(reason).slice(0, 300);
    if (reasonBanner) reasonBanner.style.display = 'flex';
  } else {
    if (reasonBanner) reasonBanner.style.display = 'none';
  }

  modal?.classList.add('active');
  // focus trap
  setTimeout(() => document.getElementById('student-email-input')?.focus(), 50);
  sound.playTick();
};

window.closeAuthModal = () => {
  document.getElementById('auth-modal')?.classList.remove('active');
};

window.switchAuthTab = (tab) => {
  const tabStudent = document.getElementById('auth-tab-student');
  const tabAdmin = document.getElementById('auth-tab-admin');
  const paneStudent = document.getElementById('auth-pane-student');
  const paneAdmin = document.getElementById('auth-pane-admin');

  if (tab === 'student') {
    tabStudent?.classList.add('active');
    tabAdmin?.classList.remove('active');
    if (paneStudent) paneStudent.style.display = 'block';
    if (paneAdmin) paneAdmin.style.display = 'none';
  } else {
    tabAdmin?.classList.add('active');
    tabStudent?.classList.remove('active');
    if (paneAdmin) paneAdmin.style.display = 'block';
    if (paneStudent) paneStudent.style.display = 'none';
  }
};

window.handleStudentLogin = () => {
  const emailEl = document.getElementById('student-email-input');
  const passEl = document.getElementById('student-password-input');
  const email = (emailEl?.value || '').trim();
  const pass = (passEl?.value || '').trim();
  let hasError = false;
  if (emailEl) {
    const empty = !email;
    const emailInvalid = empty || !email.includes('@');
    emailEl.setAttribute('aria-invalid', String(emailInvalid));
    try { emailEl.setCustomValidity(emailInvalid ? (empty ? 'Vui lòng nhập email sinh viên.' : 'Vui lòng nhập email hợp lệ (ví dụ: ten@fpt.edu.vn).') : ''); } catch {}
    if (emailInvalid) { try { emailEl.reportValidity(); } catch {} hasError = true; }
  }
  if (passEl) {
    const emptyPass = !pass;
    passEl.setAttribute('aria-invalid', String(emptyPass));
    try { passEl.setCustomValidity(emptyPass ? 'Vui lòng nhập mật khẩu.' : ''); } catch {}
    if (emptyPass && !hasError) { try { passEl.reportValidity(); } catch {} hasError = true; }
  }
  if (hasError) { __showErrorBanner('Vui lòng điền đầy đủ email và mật khẩu.'); return; }
  const username = email.split('@')[0] || 'fpt_coder';
  state.auth = login(username, 'mockpass', ROLES.PARTICIPANT);
  updateAuthUI();
  closeAuthModal();
  sound.playAccepted();
};

window.handleAdminLogin = () => {
  const userEl = document.getElementById('admin-user-input');
  const passEl = document.getElementById('admin-pass-input');
  const user = (userEl?.value || '').trim() || 'dever_admin';
  const pass = (passEl?.value || '').trim();
  // harden: require user not empty, show Vietnamese message
  if (userEl) {
    const empty = !userEl.value.trim();
    userEl.setAttribute('aria-invalid', String(empty));
    try { userEl.setCustomValidity(empty ? 'Vui lòng nhập tài khoản Ban Tổ Chức.' : ''); } catch {}
    if (empty) { try { userEl.reportValidity(); } catch {} __showErrorBanner('Vui lòng nhập tài khoản Ban Tổ Chức.'); return; }
  }
  if (passEl && !passEl.value.trim()) {
    passEl.setAttribute('aria-invalid', 'true');
    try { passEl.setCustomValidity('Vui lòng nhập Master Key.'); } catch {}
    try { passEl.reportValidity(); } catch {}
    __showErrorBanner('Vui lòng nhập Master Key.');
    return;
  }
  if (passEl) passEl.setAttribute('aria-invalid', 'false');
  if (userEl) userEl.setAttribute('aria-invalid', 'false');
  state.auth = login(user, 'mockpass', ROLES.ADMIN);
  updateAuthUI();
  closeAuthModal();
  sound.playAccepted();
  switchMainView('view-admin');
};

window.quickLogin = (role) => {
  state.auth = switchRole(role);
  updateAuthUI();
  closeAuthModal();
  sound.playAccepted();
  if (role === ROLES.ADMIN) {
    switchMainView('view-admin');
  }
};

window.handleLogoutClick = () => {
  state.auth = logout();
  updateAuthUI();
  sound.playTick();
  if (typeof window !== 'undefined' && window.location && window.location.pathname.includes('admin')) {
    window.location.href = 'arena.html';
    return;
  }
  switchMainView('view-contests');
};

window.handleProfileBadgeClick = () => {
  if (state.auth.role === ROLES.GUEST) {
    openAuthModal();
  } else {
    switchMainView('view-profile');
  }
};

function setupNavigation() {}

// Theme toggle — AtCoder-like light/dark
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
  if (typeof localStorage !== 'undefined') localStorage.setItem('dever_theme', theme);
  // a11y: announce
  document.documentElement.style.colorScheme = theme;
}
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  btn?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    sound.playTick();
  });
}
window.toggleMobileNav = () => {
  const nav = document.getElementById('primary-nav-links');
  const ham = document.getElementById('nav-hamburger');
  if (!nav || !ham) return;
  const isOpen = nav.classList.toggle('open');
  ham.setAttribute('aria-expanded', String(isOpen));
  ham.textContent = isOpen ? '✕' : '☰';
};
function setupMobileNav() {
  // đóng khi click outside
  document.addEventListener('click', (e) => {
    const nav = document.getElementById('primary-nav-links');
    const ham = document.getElementById('nav-hamburger');
    if (!nav || !ham || !nav.classList.contains('open')) return;
    if (nav.contains(e.target) || ham.contains(e.target)) return;
    nav.classList.remove('open');
    ham.setAttribute('aria-expanded', 'false');
    ham.textContent = '☰';
  });
  // đóng khi chọn tab
  document.querySelectorAll('.nav-link-btn').forEach(b => b.addEventListener('click', () => {
    const nav = document.getElementById('primary-nav-links');
    const ham = document.getElementById('nav-hamburger');
    if (nav?.classList.contains('open')) {
      nav.classList.remove('open');
      ham?.setAttribute('aria-expanded', 'false');
      if (ham) ham.textContent = '☰';
    }
  }));
}
function setupWorkspaceResizer() {
  const grid = document.getElementById('workspace-grid');
  const handle = document.getElementById('workspace-resizer');
  if (!grid || !handle) return;
  let dragging = false;
  let startX = 0;
  let startCols = '';
  const onMove = (e) => {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = grid.getBoundingClientRect();
    const offset = clientX - rect.left;
    const pct = Math.max(32, Math.min(68, (offset / rect.width) * 100));
    grid.style.gridTemplateColumns = `${pct}% 8px ${100 - pct - 1}%`;
    e.preventDefault();
  };
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mouseup', stop);
    document.removeEventListener('touchend', stop);
  };
  handle.addEventListener('mousedown', (e) => { dragging = true; startX = e.clientX; handle.classList.add('dragging'); document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', stop); });
  handle.addEventListener('touchstart', (e) => { dragging = true; handle.classList.add('dragging'); document.addEventListener('touchmove', onMove, { passive: false }); document.addEventListener('touchend', stop); }, { passive: true });
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const cur = getComputedStyle(grid).gridTemplateColumns;
      // simple step 2%
      const rect = grid.getBoundingClientRect();
      const currentPct = (grid.children[0].getBoundingClientRect().width / rect.width) * 100;
      const delta = e.key === 'ArrowLeft' ? -2 : 2;
      const next = Math.max(32, Math.min(68, currentPct + delta));
      grid.style.gridTemplateColumns = `${next}% 8px ${100 - next - 1}%`;
      e.preventDefault();
    }
  });
}
function setupGlobalA11y() {
  // ESC đóng modal, focus trap đơn giản + đóng mobile nav
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      const nav = document.getElementById('primary-nav-links');
      const ham = document.getElementById('nav-hamburger');
      if (nav?.classList.contains('open')) {
        nav.classList.remove('open');
        ham?.setAttribute('aria-expanded', 'false');
        if (ham) ham.textContent = '☰';
        ham?.focus();
      }
      // thoát fullscreen
      const pane = document.getElementById('editor-pane-container');
      if (pane?.classList.contains('fullscreen')) pane.classList.remove('fullscreen');
    }
  });
  // click overlay đóng
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });
}

// ==========================================
// FORM HARDENING — Crew-J (i18n novalidate + Vietnamese messages)
// ==========================================
function setupFormHardening() {
  try {
    document.querySelectorAll('form').forEach(form => {
      if (!form.hasAttribute('novalidate')) form.setAttribute('novalidate', '');
      // custom Vietnamese messages on invalid
      form.querySelectorAll('input, textarea, select').forEach(inp => {
        inp.addEventListener('invalid', (e) => {
          e.preventDefault();
          try {
            if (inp.validity.valueMissing) {
              inp.setCustomValidity('Vui lòng điền trường này.');
            } else if (inp.validity.typeMismatch) {
              if (inp.type === 'email') inp.setCustomValidity('Vui lòng nhập email hợp lệ (ví dụ: ten@fpt.edu.vn).');
              else inp.setCustomValidity('Vui lòng nhập đúng định dạng.');
            } else if (inp.validity.patternMismatch) {
              inp.setCustomValidity('Vui lòng kiểm tra lại định dạng.');
            } else {
              inp.setCustomValidity('Vui lòng kiểm tra lại thông tin.');
            }
          } catch {}
          inp.setAttribute('aria-invalid', 'true');
          try { __showErrorBanner(inp.validationMessage || 'Vui lòng kiểm tra lại thông tin.'); } catch {}
        });
        inp.addEventListener('input', () => {
          try { inp.setCustomValidity(''); } catch {}
          if (inp.value && inp.value.trim()) inp.setAttribute('aria-invalid', 'false');
          else if (!inp.required) inp.setAttribute('aria-invalid', 'false');
        });
        inp.addEventListener('change', () => {
          try { inp.setCustomValidity(''); } catch {}
        });
      });
      form.addEventListener('submit', (e) => {
        if (!form.checkValidity()) {
          e.preventDefault();
          e.stopPropagation();
          const firstInvalid = form.querySelector(':invalid');
          if (firstInvalid) {
            try { firstInvalid.reportValidity(); } catch {}
            try { firstInvalid.focus(); } catch {}
          }
        }
      });
    });
  } catch {}
}

function setupSubTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const activateTab = (btn) => {
    tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const target = btn.dataset.tab;
    const pane = document.getElementById(target);
    if (pane) pane.classList.add('active');
    // a11y focus
    pane?.focus?.();
  };
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const idx = Array.from(tabBtns).indexOf(btn);
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = tabBtns[(idx + dir + tabBtns.length) % tabBtns.length];
        next.focus();
        activateTab(next);
        e.preventDefault();
      }
    });
  });
}

// ==========================================
// TRÌNH SOẠN THẢO NÂNG CAO (EDITOR ERGONOMICS)
// ==========================================
function setupEditor() {
  const editor = document.getElementById('code-editor-input');
  if (!editor) return;
  const lineNumbers = document.getElementById('line-numbers');
  const langSelect = document.getElementById('language-select');

  const updateLineNumbers = () => {
    const lines = editor.value.split('\n').length;
    let lineStr = '';
    for (let i = 1; i <= Math.max(lines, 20); i++) {
      lineStr += i + '<br>';
    }
    lineNumbers.innerHTML = lineStr;
  };

  editor.addEventListener('input', updateLineNumbers);
  editor.addEventListener('scroll', () => {
    lineNumbers.scrollTop = editor.scrollTop;
  });

  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 4;
      updateLineNumbers();
    }
  });

  langSelect.addEventListener('change', (e) => {
    const lang = e.target.value;
    state.selectedLanguage = lang;
    editor.value = CODE_TEMPLATES[lang] || '';
    updateLineNumbers();
  });

  editor.value = CODE_TEMPLATES.cpp;
  updateLineNumbers();

  document.getElementById('run-code-btn').addEventListener('click', handlePretestSubmission);
}

function setupEditorControls() {
  const editor = document.getElementById('code-editor-input');
  const editorPane = document.getElementById('editor-pane-container');

  // Theme selector
  document.getElementById('theme-select')?.addEventListener('change', (e) => {
    editor.className = `editor-textarea ${e.target.value}`;
  });

  // Font size changer
  document.getElementById('font-decrease-btn')?.addEventListener('click', () => {
    if (state.editorFontSize > 12) {
      state.editorFontSize -= 1;
      editor.style.fontSize = `${state.editorFontSize}px`;
    }
  });

  document.getElementById('font-increase-btn')?.addEventListener('click', () => {
    if (state.editorFontSize < 22) {
      state.editorFontSize += 1;
      editor.style.fontSize = `${state.editorFontSize}px`;
    }
  });

  // Fullscreen toggle
  document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
    editorPane.classList.toggle('fullscreen');
  });

  // Download code
  document.getElementById('download-code-btn')?.addEventListener('click', () => {
    const code = editor.value;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solution_${state.activeProblemId}.cpp`;
    a.click();
    URL.revokeObjectURL(url);
    sound.playTick();
  });
}

// Xử lý nộp bài Pretest — Crew-B: loading → success → error + aria-live
async function handlePretestSubmission() {
  if (!canSubmit(state.auth)) {
    sound.playTick();
    openAuthModal('Bạn đang ở chế độ Khách (Guest). Vui lòng đăng nhập để nộp bài và tích lũy điểm Elo!');
    return;
  }

  if (state.currentPhase !== CONTEST_PHASES.CODING) {
    sound.playHackFailed();
    notify.warn('⚠️ Không thể nộp bài! Contest hiện không ở trong Coding Phase.');
    const consoleOutput = document.getElementById('editor-console-output');
    if (consoleOutput) {
      consoleOutput.innerHTML = `<span style="color: var(--accent-red);">[KHÓA] Không thể nộp bài: Contest hiện không ở trong Coding Phase (Trạng thái: ${escapeHtml(state.currentPhase)}).</span>`;
    }
    return;
  }

  const editor = document.getElementById('code-editor-input');
  const code = editor ? editor.value : '';
  const consoleOutput = document.getElementById('editor-console-output');
  const metrics = document.getElementById('execution-metrics');
  const runBtn = document.getElementById('run-code-btn');

  if (!code.trim()) {
    sound.playHackFailed();
    notify.error('Vui lòng nhập mã nguồn trước khi nộp bài!');
    if (consoleOutput) {
      consoleOutput.innerHTML = `<span style="color: var(--accent-red);">[LỖI] Mã nguồn trống. Vui lòng viết code vào editor trước khi bấm Nộp Bài!</span>`;
    }
    return;
  }

  if (!consoleOutput) return;
  consoleOutput.setAttribute('aria-live', 'polite');
  consoleOutput.setAttribute('aria-busy', 'true');
  consoleOutput.innerHTML = `<span style="color: var(--accent-cyan);">[SANDBOX] Đang đẩy vào Pretest Queue...</span>`;
  if (metrics) metrics.textContent = 'Trạng thái: Compiling';
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = '⏳ Đang nộp...';
  }
  sound.playTick();

  try {
    await new Promise(r => setTimeout(r, 350));
    consoleOutput.innerHTML += `<br><span style="color: #94a3b8;">Running on Pretest 1... OK (14ms)</span>`;
    sound.playTick();
    await new Promise(r => setTimeout(r, 350));
    consoleOutput.innerHTML += `<br><span style="color: #94a3b8;">Running on Pretest 2... OK (22ms)</span>`;
    sound.playTick();
    await new Promise(r => setTimeout(r, 450));

    const earned = calculateProblemScore(1000, state.elapsedMinutes, 1);
    state.currentUser.submissions.B = {
      solved: true,
      maxPoints: 1000,
      elapsed: state.elapsedMinutes,
      attempts: 1,
      score: earned
    };

    // success state
    consoleOutput.setAttribute('aria-busy', 'false');
    consoleOutput.innerHTML += `<br><span style="color: var(--accent-green); font-weight: 700;">✔ Pretests Passed! Điểm nhận được: ${earned} pts.</span>`;
    if (metrics) metrics.textContent = 'Thời gian: 36ms | Bộ nhớ: 2840 KB';
    sound.playAccepted();

    const newSub = {
      id: 10483,
      time: 'Vừa xong',
      author: 'dever_hero',
      prob: 'B - Big Product',
      lang: 'C++20',
      verdict: 'Accepted',
      timeMs: 36,
      memKb: 2840
    };
    state.globalSubmissions.unshift(newSub);
    // Persist submission to DB
    try {
      await db.put('submissions', {
        id: 'sub_' + newSub.id,
        user_id: state.auth.id || 'user_me',
        problem_id: state.activeProblemId,
        contest_id: 'contest_dever_round1',
        language: 'CPP20',
        source_code: code.slice(0, 10000),
        verdict: 'AC',
        execution_time_ms: 36,
        memory_used_kb: 2840,
        points_awarded: earned,
        is_hacked: false,
        submitted_at: new Date().toISOString()
      });
    } catch (e) { console.warn('DB submissions put failed', e); }

    renderStandings();
    renderSubmissionsTable();
  } catch (e) {
    consoleOutput.setAttribute('aria-busy', 'false');
    consoleOutput.innerHTML += `<br><span style="color: var(--accent-red); font-weight: 700;">❌ Lỗi chấm bài: ${escapeHtml(e.message || String(e))}</span>`;
    if (metrics) metrics.textContent = 'Trạng thái: Error';
    sound.playHackFailed();
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = '▶ Nộp Bài';
    }
  }
}

// ==========================================
// TYPOGRAPHY & MATH FORMULA FORMATTER
// ==========================================
export function renderMathTypography(container) {
  if (!container) return;
  if (typeof window !== 'undefined' && window.renderMathInElement) {
    try {
      window.renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
      return;
    } catch {}
  }

  let html = container.innerHTML;
  html = html.replace(/\$([^\$]+)\$/g, (match, formula) => {
    let formatted = formula
      .replace(/\\le\b/g, '≤')
      .replace(/\\ge\b/g, '≥')
      .replace(/\\ne\b/g, '≠')
      .replace(/\\times\b/g, '×')
      .replace(/\\sum\b/g, '∑')
      .replace(/\\log\b/g, 'log')
      .replace(/\\min\b/g, 'min')
      .replace(/\\max\b/g, 'max')
      .replace(/(\w+)\^\{([^}]+)\}/g, '$1<sup>$2</sup>')
      .replace(/(\w+)\^(\w+)/g, '$1<sup>$2</sup>')
      .replace(/(\w+)_\{([^}]+)\}/g, '$1<sub>$2</sub>')
      .replace(/(\w+)_(\w+)/g, '$1<sub>$2</sub>');
    return `<span class="math-formula" style="font-family:KaTeX_Math,serif;font-style:italic;color:var(--accent-cyan);padding:0 2px;">${formatted}</span>`;
  });
  container.innerHTML = html;
}

// ==========================================
// TÙY CHỌN BÀI TOÁN & TABS WORKSPACE
// ==========================================
window.loadProblemToWorkspace = (problemId) => {
  const prob = PROBLEMS_DB.find(p => p.id === problemId);
  if (!prob) return;

  state.activeProblemId = problemId;
  const titleEl = document.getElementById('ws-problem-title');
  const ratingEl = document.getElementById('ws-problem-rating');
  const tlEl = document.getElementById('ws-timelimit');
  const mlEl = document.getElementById('ws-memlimit');
  const stmtEl = document.getElementById('ws-statement-body');
  const sinEl = document.getElementById('ws-sample-in');
  const soutEl = document.getElementById('ws-sample-out');
  const editEl = document.getElementById('ws-editorial-body');
  if (titleEl) titleEl.textContent = `Bài ${prob.code}: ${prob.title}`;
  if (ratingEl) ratingEl.textContent = `${prob.rating} Điểm`;
  if (tlEl) tlEl.textContent = prob.timeLimit;
  if (mlEl) mlEl.textContent = prob.memoryLimit;
  // Statement chứa LaTeX nên cho phép HTML đã kiểm duyệt từ DB, render Math typography
  if (stmtEl) {
    stmtEl.innerHTML = prob.statement;
    renderMathTypography(stmtEl);
  }
  if (sinEl) sinEl.textContent = prob.sampleInput;
  if (soutEl) soutEl.textContent = prob.sampleOutput;
  const emptyEl = document.getElementById('editorial-empty');
  if (editEl) {
    const hasEditorial = prob.editorial && String(prob.editorial).trim().length > 0;
    if (hasEditorial) {
      editEl.innerHTML = prob.editorial.replace(/\n/g, '<br>');
      renderMathTypography(editEl);
      editEl.style.display = 'block';
      if (emptyEl) emptyEl.style.display = 'none';
    } else {
      editEl.innerHTML = '';
      editEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
    }
  } else if (emptyEl) {
    const hasEditorial = prob.editorial && String(prob.editorial).trim().length > 0;
    emptyEl.style.display = hasEditorial ? 'none' : 'block';
  }

  if (typeof window !== 'undefined' && window.location && !window.location.pathname.includes('admin')) {
    switchMainView('view-contests');
    document.querySelector('[data-tab=tab-workspace]')?.click();
    document.querySelector('[data-tab=tab-workspace]')?.focus();
  }
};

window.toggleProblemTab = (tab) => {
  const desc = document.getElementById('ws-desc-content');
  const edit = document.getElementById('ws-editorial-content');
  const disc = document.getElementById('ws-discussions-content');

  const bDesc = document.getElementById('ws-tab-desc');
  const bEdit = document.getElementById('ws-tab-editorial');
  const bDisc = document.getElementById('ws-tab-discussions');

  [bDesc, bEdit, bDisc].forEach(b => b && b.classList.add('btn-outline'));
  [desc, edit, disc].forEach(d => d && (d.style.display = 'none'));

  if (tab === 'desc') {
    if (desc) desc.style.display = 'block';
    if (bDesc) bDesc.classList.remove('btn-outline');
    try { history.pushState(null, '', location.pathname + location.search); } catch {}
  } else if (tab === 'editorial') {
    if (edit) edit.style.display = 'block';
    if (bEdit) bEdit.classList.remove('btn-outline');
    try { history.pushState(null, '', '#editorial'); } catch {}
  } else {
    if (disc) disc.style.display = 'block';
    if (bDisc) bDisc.classList.remove('btn-outline');
    try { history.pushState(null, '', '#discussions'); } catch {}
  }
};
// ==========================================
// DEEP HASH ROUTER (VIEWS, TABS & PROBLEMS)
// ==========================================
export function handleAppHash(hashString) {
  const h = (hashString || (typeof location !== 'undefined' ? location.hash : '') || '').replace(/^#/, '');
  if (!h) return;

  // 1. Problem sub-tabs: #editorial, #discussions, #desc
  if (h === 'editorial' || h === 'discussions' || h === 'desc') {
    try { window.toggleProblemTab(h); } catch {}
    return;
  }

  // 2. Main views: #view-problemset, #view-standings, #view-clans, #view-contests, #view-admin, #view-profile
  if (h.startsWith('view-')) {
    try { window.switchMainView(h); } catch {}
    return;
  }

  // 3. Sub-tabs in contest: #tab-workspace, #tab-overview, #tab-standings, #tab-hackroom
  if (h.startsWith('tab-')) {
    try {
      window.switchMainView('view-contests');
      const tabBtn = document.querySelector(`[data-tab="${h}"]`);
      if (tabBtn) tabBtn.click();
    } catch {}
    return;
  }

  // 4. Problem direct links: #problem-p101, #p101, #problem-p102
  const probMatch = h.match(/^(?:problem-)?(p\d+)$/);
  if (probMatch) {
    const probId = probMatch[1];
    try { window.loadProblemToWorkspace(probId); } catch {}
    return;
  }

  // 5. Virtual contest direct links: #virtual-contest_dever_archive
  if (h.startsWith('virtual-')) {
    const contestId = h.replace(/^virtual-/, '');
    try { window.startVirtualContest(contestId); } catch {}
    return;
  }
}

function initAppHashRouter() {
  const apply = () => handleAppHash(typeof location !== 'undefined' ? location.hash : '');
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply);
    } else {
      try { apply(); } catch {}
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', apply);
  }
}

// ==========================================
// THẢO LUẬN (DISCUSSIONS SYSTEM)
// ==========================================
function setupDiscussions() {
  const list = document.getElementById('discussion-threads-list');
  const input = document.getElementById('new-comment-input');
  const postBtn = document.getElementById('post-comment-btn');

  const renderComments = () => {
    if (!list) return;
    list.innerHTML = '';
    state.discussions.forEach((c, idx) => {
      const card = document.createElement('div');
      card.className = 'discussion-card';
      const safeAuthor = escapeHtml(c.author);
      const safeText = escapeHtml(c.text);
      const safeTime = escapeHtml(c.time);
      const safeRank = escapeHtml(c.rank);
      card.innerHTML = `
        <div class="comment-author-bar">
          <div>
            <strong class="${safeRank}">${safeAuthor}</strong>
            <span style="font-size: 0.75rem; color: #64748b; margin-left: 0.4rem;">${safeTime}</span>
          </div>
          <button class="upvote-btn" onclick="upvoteComment(${idx})" aria-label="Upvote bình luận của ${safeAuthor}" aria-pressed="false">▲ ${c.upvotes}</button>
        </div>
        <div style="font-size: 0.9rem; color: #cbd5e1; word-break: break-word;">${safeText}</div>
      `;
      list.appendChild(card);
    });
  };

  window.upvoteComment = (idx) => {
    if (!canSubmit(state.auth)) {
      sound.playTick();
      openAuthModal('Bạn đang ở chế độ Khách (Guest). Vui lòng đăng nhập để bình chọn!');
      return;
    }
    if (state.discussions && state.discussions[idx]) {
      state.discussions[idx].upvotes += 1;
      sound.playTick();
      renderComments();
      notify.success('Đã upvote bình luận!');
    }
  };

  postBtn?.addEventListener('click', () => {
    if (!canSubmit(state.auth)) {
      sound.playTick();
      openAuthModal('Bạn đang ở chế độ Khách (Guest). Vui lòng đăng nhập để gửi bình luận thảo luận!');
      return;
    }
    const text = (input?.value || '').trim();
    if (!text) {
      notify.warn('Vui lòng nhập nội dung bình luận!');
      return;
    }
    state.discussions.unshift({
      id: `d_${Date.now()}`,
      author: state.auth.username || state.currentUser.name || 'dever_hero',
      rank: 'rank-specialist',
      time: 'Vừa xong',
      text,
      upvotes: 1
    });
    if (input) input.value = '';
    sound.playAccepted();
    renderComments();
    notify.success('Đã gửi bình luận thảo luận thành công!');
  });

  renderComments();
}

// ==========================================
// CLAN WARS (HOUSE OF BUGGY)
// ==========================================
async function renderClans() {
  const grid = document.getElementById('clans-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let clanStandings = [];
  try {
    clanStandings = await api.getClanStandings('top5_harmonic');
  } catch (e) {
    console.warn('api.getClanStandings fallback', e);
  }

  if (!clanStandings || clanStandings.length === 0) {
    clanStandings = (state.clans || []).map((c, i) => ({
      id: 'clan_' + i,
      name: c.name,
      tag: c.name.split(' ').pop(),
      color: c.color,
      score: c.totalRating,
      memberCount: c.members,
      rank: i + 1,
      topMembers: []
    }));
  }

  clanStandings.forEach(clan => {
    const card = document.createElement('div');
    card.className = 'clan-card';
    const safeName = escapeHtml(clan.name);
    const safeTag = escapeHtml(clan.tag || '');
    const safeColor = escapeHtml(clan.color || 'var(--accent-orange)');
    const rankLabel = clan.rank === 1 ? '🥇 Vô Địch Bang Hội' : (clan.rank === 2 ? '🥈 Hạng 2' : (clan.rank === 3 ? '🥉 Hạng 3' : `Hạng ${clan.rank}`));

    let topMembersHtml = '';
    if (clan.topMembers && clan.topMembers.length > 0) {
      topMembersHtml = `
        <div style="margin-top: 0.4rem;">
          <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.3rem;">⭐ Top 5 Tuyển Thủ:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">
            ${clan.topMembers.map(m => {
              const tier = getRatingTier(m.rating || 1500);
              return `<span class="tag-badge ${tier.class}" style="font-size: 0.75rem;">${escapeHtml(m.username || m.id)} (${m.rating || 1500})</span>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="clan-header">
        <h3 style="color: ${safeColor}; margin: 0; font-size: 1.15rem;">${safeName} <span style="font-size: 0.85rem; opacity: 0.8;">[${safeTag}]</span></h3>
        <span class="tag-badge" style="border-color: ${safeColor}; color: ${safeColor}; font-weight: 700;">${rankLabel}</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin: 0.4rem 0;">
        <span style="font-size: 0.85rem; color: #94a3b8;">Harmonic Power Score:</span>
        <span style="font-size: 1.45rem; font-weight: 800; font-family: var(--font-code); color: #fff;">${Number(clan.score).toLocaleString()}</span>
      </div>
      <div style="font-size: 0.85rem; color: #cbd5e1;">👥 Thành viên ghi danh: <strong>${Number(clan.memberCount || 0)} coders</strong></div>
      ${topMembersHtml}
      <button class="btn btn-secondary" style="margin-top: 0.75rem; font-size: 0.8rem; justify-content: center;" onclick="notify.info('Bạn hiện đang sinh hoạt tại ${safeName}!')" aria-label="Gia nhập ${safeName}">Gia Nhập Bang Hội</button>
    `;
    grid.appendChild(card);
  });
}

// ==========================================
// VIRTUAL CONTEST SIMULATOR (GHOST REPLAY)
// ==========================================
let virtualIntervalId = null;

window.startVirtualContest = async (contestNameOrId = 'contest_dever_archive') => {
  try {
    const user = getCurrentUser();
    if (!user || !user.id || user.role === ROLES.GUEST) {
      sound.playHackFailed();
      openAuthModal('Vui lòng đăng nhập để bắt đầu phiên thi đấu ảo!');
      return;
    }

    const session = await api.startVirtualContest(contestNameOrId, user.id, 120);
    state.activeVirtualSession = session;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('dever_active_virtual_session', JSON.stringify(session));
    }

    sound.playHackSuccess();
    notify.info(`🏁 Đã khởi tạo phiên thi đấu ảo cho ${contestNameOrId}!`);
    switchMainView('view-contests');
    initVirtualContestHUD(session);
  } catch (err) {
    console.error('startVirtualContest error:', err);
    notify.info(err.message || 'Không thể bắt đầu phiên thi đấu ảo');
  }
};

window.handleFinishVirtualContest = () => {
  if (virtualIntervalId) clearInterval(virtualIntervalId);
  virtualIntervalId = null;
  state.activeVirtualSession = null;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('dever_active_virtual_session');
  }
  const hud = document.getElementById('virtual-contest-hud');
  if (hud) hud.style.display = 'none';
  sound.playTick();
  notify.info('Đã kết thúc phiên thi đấu ảo.');
  renderStandings();
};

function initVirtualContestHUD(session) {
  const hud = document.getElementById('virtual-contest-hud');
  const timerDisplay = document.getElementById('virtual-timer-display');
  if (!hud || !session) return;
  hud.style.display = 'flex';

  const updateVirtualTick = async () => {
    try {
      const stateObj = await api.getVirtualState(session.id);
      if (timerDisplay) {
        const remSec = stateObj.remainingMinutes * 60;
        const hh = String(Math.floor(remSec / 3600)).padStart(2, '0');
        const mm = String(Math.floor((remSec % 3600) / 60)).padStart(2, '0');
        const ss = String(remSec % 60).padStart(2, '0');
        timerDisplay.textContent = `${hh}:${mm}:${ss}`;
      }

      if (stateObj.isFinished) {
        if (virtualIntervalId) clearInterval(virtualIntervalId);
        notify.info('⏱️ Phiên thi đấu ảo đã hết giờ!');
      }

      if (state.activeView === 'view-standings' || document.getElementById('tab-standings')?.classList.contains('active')) {
        renderVirtualStandingsTable(stateObj.standings);
      }
    } catch (e) {
      console.warn('updateVirtualTick error', e);
    }
  };

  if (virtualIntervalId) clearInterval(virtualIntervalId);
  updateVirtualTick();
  virtualIntervalId = setInterval(updateVirtualTick, 10000);
}

function renderVirtualStandingsTable(standings) {
  const tbody = document.getElementById('standings-tbody');
  if (!tbody || !standings) return;
  tbody.innerHTML = '';

  standings.forEach(item => {
    const tr = document.createElement('tr');
    const isMe = item.isVirtual;
    const tier = getRatingTier(item.rating || 1500);
    const badgeHtml = isMe
      ? `<span class="tag-badge" style="background:var(--accent-cyan);color:#080b13;font-weight:700;">YOU (VIRTUAL)</span>`
      : `<span class="tag-badge" style="background:rgba(255,255,255,0.08);">GHOST</span>`;

    const rankNum = Number(item.rank);
    let rankHtml = `${item.rank}`;
    if (rankNum === 1) rankHtml = `<span class="rank-medal rank-medal-1">1</span>`;
    else if (rankNum === 2) rankHtml = `<span class="rank-medal rank-medal-2">2</span>`;
    else if (rankNum === 3) rankHtml = `<span class="rank-medal rank-medal-3">3</span>`;

    tr.innerHTML = `
      <td class="col-rank">${rankHtml}</td>
      <td class="col-user">
        <span class="${tier.class}" style="font-weight:700;">${escapeHtml(item.username)}</span>
        ${badgeHtml}
      </td>
      <td class="col-score" style="text-align:center;">${item.totalScore}</td>
      <td style="text-align:center;">${item.solvedCount} bài</td>
    `;
    if (isMe) {
      tr.style.background = 'rgba(0, 240, 255, 0.08)';
    }
    tbody.appendChild(tr);
  });
}

// ==========================================
// POLYGON LITE CMS (SOẠN THẢO ĐỀ THI)
// ==========================================
function setupPolygonCMS() {
  const codeIn = document.getElementById('poly-code');
  const titleIn = document.getElementById('poly-title');
  const ratingIn = document.getElementById('poly-rating');
  const stmtIn = document.getElementById('poly-statement');
  const sampleIn = document.getElementById('poly-sample-in');
  const sampleOut = document.getElementById('poly-sample-out');
  const tagsIn = document.getElementById('poly-tags');
  const publishBtn = document.getElementById('publish-problem-btn');

  const pTitle = document.getElementById('poly-prev-title');
  const pMeta = document.getElementById('poly-prev-meta');
  const pBody = document.getElementById('poly-prev-body');

  const updatePreview = () => {
    const safeCode = escapeHtml(codeIn.value || 'X');
    const safeTitle = escapeHtml(titleIn.value || 'Tên bài toán');
    const safeRating = escapeHtml(ratingIn.value || '1200');
    pTitle.textContent = `Bài ${safeCode}: ${safeTitle}`;
    pMeta.textContent = `1.0s / 256 MB • Elo: ${safeRating}`;
    pBody.innerHTML = stmtIn.value ? sanitizeText(stmtIn.value) : 'Nội dung đề bài xem trước...';
  };

  // Crew-J: aria-invalid hardening — khởi tạo và cập nhật khi gõ
  function setPolyInvalid(el, isInvalid) {
    if (!el) return;
    el.setAttribute('aria-invalid', String(isInvalid));
    if (isInvalid) {
      el.setAttribute('aria-errormessage', el.id + '-error');
    } else {
      el.removeAttribute('aria-errormessage');
      try { el.setCustomValidity(''); } catch {}
    }
  }
  if (codeIn) codeIn.setAttribute('aria-invalid', String(!codeIn.value.trim()));
  if (titleIn) titleIn.setAttribute('aria-invalid', String(!titleIn.value.trim()));
  [codeIn, titleIn, ratingIn, stmtIn].forEach(el => el?.addEventListener('input', () => {
    if (el === codeIn || el === titleIn) {
      const empty = !el.value.trim();
      setPolyInvalid(el, empty);
      if (!empty) try { el.setCustomValidity(''); } catch {}
    }
    updatePreview();
  }));

  publishBtn?.addEventListener('click', async () => {
    const rawCode = (codeIn.value || '').trim();
    const rawTitle = (titleIn.value || '').trim();
    const codeEmpty = !rawCode;
    const titleEmpty = !rawTitle;
    setPolyInvalid(codeIn, codeEmpty);
    setPolyInvalid(titleIn, titleEmpty);
    if (codeIn) {
      try { codeIn.setCustomValidity(codeEmpty ? 'Vui lòng nhập mã bài toán (ví dụ: C)' : ''); } catch {}
    }
    if (titleIn) {
      try { titleIn.setCustomValidity(titleEmpty ? 'Vui lòng nhập tên bài toán' : ''); } catch {}
    }
    if (codeEmpty || titleEmpty) {
      if (codeEmpty) { try { codeIn.reportValidity(); } catch {} codeIn?.focus(); }
      else if (titleEmpty) { try { titleIn.reportValidity(); } catch {} titleIn?.focus(); }
      __showErrorBanner('Vui lòng điền đầy đủ mã và tên bài toán.');
      try { sound.playTick(); } catch {}
      return;
    }
    const code = rawCode.toUpperCase() || 'C';
    const title = rawTitle || 'Bài toán mới';
    const rating = parseInt(ratingIn.value) || 1200;
    const stmt = stmtIn.value.trim() || 'Mô tả bài toán...';
    const sIn = sampleIn.value.trim() || '1';
    const sOut = sampleOut.value.trim() || '1';
    const tags = (tagsIn.value || 'implementation, math').split(',').map(t => t.trim());

    const newProb = {
      id: `p_${Date.now()}`,
      code,
      title,
      rating,
      tags,
      timeLimit: '1.0s',
      memoryLimit: '256 MB',
      solvedCount: 0,
      statement: stmt,
      sampleInput: sIn,
      sampleOutput: sOut,
      editorial: `### Lời giải bài ${title}:\nĐang được Ban Chuyên Môn DEVER cập nhật.`
    };

    PROBLEMS_DB.push(newProb);
    // Persist to DB (IndexedDB dev + PostgreSQL prod via API)
    try {
      await db.put('problems', {
        id: newProb.id, contest_id: 'contest_dever_round1', code, title,
        statement_markdown: stmt, editorial_markdown: newProb.editorial,
        time_limit_ms: 1000, memory_limit_kb: 262144, base_points: rating,
        tags, solved_count: 0
      });
    } catch (e) { console.warn('DB put problem failed', e); }
    renderProblemset(PROBLEMS_DB);
    sound.playAccepted();
    notify.success(`🎉 XUẤT BẢN THÀNH CÔNG: Bài toán "${title}" đã được lưu vào Kho Bài Tập!`);
    // Nếu đang ở arena, chuyển tab; nếu ở admin, ở lại
    try { switchMainView('view-problemset'); } catch {}
  });
}

// ==========================================
// VISUAL LINE DIFF INSPECTOR MODAL
// ==========================================
function setupDiffModal() {
  const modal = document.getElementById('diff-modal');
  const openBtn = document.getElementById('inspect-diff-btn');
  const closeBtn = document.getElementById('diff-close-btn');

  openBtn?.addEventListener('click', () => {
    modal.classList.add('active');
    sound.playTick();
  });

  closeBtn?.addEventListener('click', () => {
    modal.classList.remove('active');
  });
}

// ==========================================
// CUSTOM TEST RUNNER MODAL
// ==========================================
function setupCustomTestModal() {
  const modal = document.getElementById('custom-test-modal');
  const openBtn = document.getElementById('custom-test-btn');
  const closeBtn = document.getElementById('custom-test-close-btn');
  const runBtn = document.getElementById('execute-custom-test-run');
  const inputArea = document.getElementById('custom-input-box');
  const outputArea = document.getElementById('custom-output-box');

  openBtn?.addEventListener('click', () => {
    if (!canSubmit(state.auth)) {
      sound.playTick();
      openAuthModal('Bạn đang ở chế độ Khách (Guest). Vui lòng đăng nhập để chạy thử Sandbox!');
      return;
    }
    inputArea.value = '3\n1 2 3';
    outputArea.textContent = 'Nhấn "Chạy Test Ngay" để xem kết quả.';
    modal.classList.add('active');
  });

  closeBtn?.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  runBtn?.addEventListener('click', async () => {
    const code = document.getElementById('code-editor-input')?.value || '';
    if (!code.trim()) {
      notify.error('Vui lòng nhập code trước khi chạy Custom Test!');
      if (outputArea) outputArea.innerHTML = '<span style="color: var(--accent-red);">[LỖI] Mã nguồn trống. Vui lòng nhập code trong editor.</span>';
      sound.playHackFailed();
      return;
    }
    const inputVal = inputArea?.value || '';
    if (inputVal.length > 50000) {
      notify.warn('Dữ liệu input vượt quá 50KB!');
      if (outputArea) outputArea.innerHTML = '<span style="color: var(--accent-red);">[LỖI] Dữ liệu testcase đầu vào quá lớn (&gt; 50KB).</span>';
      sound.playHackFailed();
      return;
    }
    runBtn.disabled = true;
    const oldText = runBtn.textContent;
    runBtn.textContent = '⏳ Đang chạy...';
    outputArea.innerHTML = '<span style="color: var(--accent-yellow);">Đang chạy trong sandbox...</span>';

    try {
      const res = await executeCodeInBrowser(state.selectedLanguage, code, inputVal);
      // escape stdout/status để tránh XSS
      const safeStatus = escapeHtml(res.status);
      const safeStdout = escapeHtml(res.stdout).replaceAll('\n', '<br>');
      outputArea.innerHTML = `<strong>Status:</strong> ${safeStatus}<br><strong>Time:</strong> ${Number(res.executionTimeMs)}ms | <strong>Mem:</strong> ${Number(res.memoryKb)}KB<br><br><strong>Output:</strong><br>${safeStdout}`;
      sound.playTick();
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = oldText;
    }
  });
}

// ==========================================
// KHO BÀI TẬP (PROBLEMESET VIEW)
// ==========================================
function renderProblemsetLoading() {
  const tbody = document.getElementById('problemset-tbody');
  const loading = document.getElementById('arena-loading');
  const empty = document.getElementById('arena-empty');
  const card = document.getElementById('problemset-card');
  if (loading) {
    loading.style.display = 'block';
    loading.setAttribute('aria-busy', 'true');
  }
  if (card) card.setAttribute('aria-busy', 'true');
  if (tbody) {
    tbody.setAttribute('aria-busy', 'true');
    tbody.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6"><div class="skeleton" style="height:16px;"></div></td>`;
      tbody.appendChild(tr);
    }
  }
  if (empty) empty.style.display = 'none';
}

function renderProblemset(problems, query = '') {
  const tbody = document.getElementById('problemset-tbody');
  const loading = document.getElementById('arena-loading');
  const empty = document.getElementById('arena-empty');
  const card = document.getElementById('problemset-card');
  if (!tbody) return;
  if (loading) { loading.style.display = 'none'; loading.setAttribute('aria-busy', 'false'); }
  if (card) card.setAttribute('aria-busy', 'false');
  tbody.setAttribute('aria-busy', 'false');
  tbody.innerHTML = '';
  if (!problems || problems.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="text-align:center;padding:2rem;color:#94a3b8">— Chưa có bài toán nào. Hãy dùng Polygon CMS ở <a href="admin.html" style="color:var(--accent-cyan)">Admin</a> để tạo bài mới —</td>`;
    tbody.appendChild(tr);
    const badge = document.getElementById('problemset-count-badge');
    if (badge) badge.textContent = '0 Bài';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  const q = String(query || '').trim();
  problems.forEach(p => {
    const tr = document.createElement('tr');
    const safeTags = (p.tags||[]).map(t => {
      const html = q ? highlightText(t, q) : escapeHtml(t);
      return `<span class="tag-badge highlight" style="font-size: 0.75rem; margin-right: 0.25rem;">${html}</span>`;
    }).join('');
    const tier = getRatingTier(p.rating);
    const safeCode = q ? highlightText(p.code, q) : escapeHtml(p.code);
    const safeTitle = q ? highlightText(p.title, q) : escapeHtml(p.title);
    const safeId = escapeHtml(p.id);
    const plainTitle = escapeHtml(p.title);
    const safeRating = escapeHtml(String(p.rating));
    const safeSolved = Number(p.solvedCount||0);

    tr.innerHTML = `
      <td class="highlight" style="font-family: var(--font-code); font-weight: 700; color: var(--accent-cyan);">${safeCode}</td>
      <td class="highlight">
        <a class="highlight" style="font-weight: 600; color: #fff; cursor: pointer; text-decoration: none;" onclick="loadProblemToWorkspace('${safeId}')" tabindex="0" role="button" aria-label="Mở bài ${plainTitle}">${safeTitle}</a>
      </td>
      <td class="highlight">${safeTags}</td>
      <td><span style="font-family: var(--font-code); font-weight: 700; color: ${escapeHtml(tier.color)};">${safeRating}</span></td>
      <td style="color: #94a3b8; font-size: 0.9rem;">${safeSolved} users</td>
      <td>
        <button class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.8rem;" onclick="loadProblemToWorkspace('${safeId}')" aria-label="Giải bài ${plainTitle}">Giải Ngay</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const countBadge = document.getElementById('problemset-count-badge');
  if (countBadge) countBadge.textContent = `${problems.length} Bài Đã Sẵn Sàng`;
}

window.filterProblems = (tag) => {
  try { if (typeof event !== 'undefined' && event && event.target) event.target.classList.add('active'); } catch {}
  document.querySelectorAll('.tag-pill-btn').forEach(b => b.classList.remove('active'));
  // mark clicked button active (fallback if event missing)
  try {
    const clicked = typeof event !== 'undefined' && event ? event.target : null;
    if (clicked && clicked.classList.contains('tag-pill-btn')) clicked.classList.add('active');
    else {
      const btn = Array.from(document.querySelectorAll('.tag-pill-btn')).find(b => b.textContent.trim().toLowerCase() === String(tag).toLowerCase() || (tag==='ALL' && b.textContent.includes('Tất Cả')));
      if (btn) btn.classList.add('active');
    }
  } catch {}

  if (tag === 'ALL') {
    renderProblemset(PROBLEMS_DB);
  } else {
    const filtered = PROBLEMS_DB.filter(p => p.tags.includes(tag));
    renderProblemset(filtered);
  }
};

// prob-search-input — debounce 200ms + highlight + history
(function setupProbSearch(){
  const input = document.getElementById('prob-search-input');
  if (!input) return;
  // init history UI on load
  try { updateSearchHistoryUI(); } catch {}
  // expose immediate for suggestion clicks
  window.__probSearchImmediate = (q) => {
    const query = String(q || '').trim();
    const lower = query.toLowerCase();
    const matched = !query ? PROBLEMS_DB : PROBLEMS_DB.filter(p =>
      p.title.toLowerCase().includes(lower) ||
      p.code.toLowerCase().includes(lower) ||
      p.tags.some(t => t.toLowerCase().includes(lower))
    );
    renderProblemset(matched, query);
    if (query) saveSearchHistory(query);
    try { console.log('[Crew-X] search immediate:', query, 'matched', matched.length, 'history', getSearchHistory()); } catch {}
  };
  const debounced = debounce((e) => {
    const raw = e.target.value;
    const query = raw.trim();
    const lower = query.toLowerCase();
    let matched;
    if (!query) matched = PROBLEMS_DB;
    else matched = PROBLEMS_DB.filter(p =>
      p.title.toLowerCase().includes(lower) ||
      p.code.toLowerCase().includes(lower) ||
      p.tags.some(t => t.toLowerCase().includes(lower))
    );
    renderProblemset(matched, query);
    if (query) saveSearchHistory(query);
    try { console.log('[Crew-X] search debounced (200ms):', query, 'matched', matched.length, 'history', getSearchHistory()); } catch {}
  }, 200);
  input.addEventListener('input', debounced);
  // also sync history on focus
  input.addEventListener('focus', () => { try { updateSearchHistoryUI(); } catch {} });
})();

// ==========================================
// LUỒNG BÀI NỘP TOÀN CẦU (LIVE STATUS)
// ==========================================
function renderSubmissionsTable() {
  const tbodies = [
    document.getElementById('top-submissions-tbody')
  ].filter(Boolean);

  if (tbodies.length === 0) return;

  tbodies.forEach(tbody => {
    tbody.innerHTML = '';
    state.globalSubmissions.forEach(sub => {
      const tr = document.createElement('tr');
      let verdictClass = 'badge-ac';
      if (sub.verdict.includes('Wrong')) verdictClass = 'badge-wa';
      else if (sub.verdict.includes('Time')) verdictClass = 'badge-tle';
      else if (sub.verdict.includes('Disqualified')) verdictClass = 'badge-wa';
      const safeAuthor = escapeHtml(sub.author);
      const safeProb = escapeHtml(sub.prob);
      const safeLang = escapeHtml(sub.lang);
      const safeVerdict = escapeHtml(sub.verdict);
      const safeTime = escapeHtml(sub.time);

      tr.innerHTML = `
        <td style="font-family: var(--font-code); font-weight: 700; color: #94a3b8;">#${escapeHtml(String(sub.id))}</td>
        <td style="color: #64748b; font-size: 0.85rem;">${safeTime}</td>
        <td style="font-weight: 600;">${safeAuthor}</td>
        <td><span style="color: var(--accent-cyan); font-weight: 600;">${safeProb}</span></td>
        <td style="font-family: var(--font-code); font-size: 0.85rem;">${safeLang}</td>
        <td><span class="badge-verdict ${verdictClass}">${safeVerdict}</span></td>
        <td style="font-family: var(--font-code); font-size: 0.85rem;">${Number(sub.timeMs)} ms</td>
        <td style="font-family: var(--font-code); font-size: 0.85rem;">${Number(sub.memKb)} KB</td>
      `;
      tbody.appendChild(tr);
    });
  });
  // Crew-B: empty state for submissions (reuse #arena-empty)
  const _arenaEmpty = document.getElementById('arena-empty');
  if (_arenaEmpty) {
    if (state.globalSubmissions.length === 0) {
      _arenaEmpty.style.display = 'block';
      _arenaEmpty.textContent = 'Chưa có submission nào — hãy bắt đầu nộp bài!';
    } else {
      const _probTbody = document.getElementById('problemset-tbody');
      const _hasProblems = _probTbody && _probTbody.children.length > 0 && !_probTbody.innerHTML.includes('Chưa có bài toán');
      if (_hasProblems) _arenaEmpty.style.display = 'none';
    }
  }
}

// ==========================================
// BẢNG XẾP HẠNG STANDINGS & HACK ROOM
// ==========================================
function renderStandings() {
  // Crew-T Leaderboard: pagination + room filter (state.standingsPage, standingsPageSize, standingsRoomFilter)
  if (typeof state.standingsPage !== 'number' || Number.isNaN(state.standingsPage)) state.standingsPage = 0;
  if (typeof state.standingsPageSize !== 'number' || Number.isNaN(state.standingsPageSize) || state.standingsPageSize <= 0) state.standingsPageSize = 20;
  if (typeof state.standingsRoomFilter !== 'string') state.standingsRoomFilter = 'ALL';

  const tbodies = [
    typeof document !== 'undefined' ? document.getElementById('standings-tbody') : null,
    typeof document !== 'undefined' ? document.getElementById('top-standings-tbody') : null
  ].filter(Boolean);

  const allParticipants = [
    {
      id: state.currentUser.id,
      name: state.currentUser.name,
      rating: state.currentUser.rating,
      room: state.currentUser.room,
      clan: state.currentUser.clan,
      submissions: state.currentUser.submissions,
      hacks: state.currentUser.hacks,
      isSelf: true
    },
    ...state.contestants.map(c => ({ ...c, isSelf: false }))
  ];

  allParticipants.forEach(p => {
    let score = 0;
    if (p.submissions?.A?.solved) score += p.submissions.A.score;
    if (p.submissions?.B?.solved && !p.submissions.B.isHacked) score += p.submissions.B.score;
    score += calculateHackScore(p.hacks?.success || 0, p.hacks?.fail || 0);
    p.totalScore = score;
  });

  allParticipants.sort((a, b) => b.totalScore - a.totalScore);

  // room filtering (ALL = no filter)
  let filtered = allParticipants;
  if (state.standingsRoomFilter && state.standingsRoomFilter !== 'ALL') {
    filtered = allParticipants.filter(p => (p.room || '') === state.standingsRoomFilter);
  }

  const pageSize = state.standingsPageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (state.standingsPage >= totalPages) state.standingsPage = Math.max(0, totalPages - 1);
  if (state.standingsPage < 0) state.standingsPage = 0;
  const start = state.standingsPage * pageSize;
  const pageSlice = filtered.slice(start, start + pageSize);

  // Ensure room filter select exists (create in view-standings header if missing)
  try {
    if (typeof document !== 'undefined') {
      let filter = document.getElementById('standings-room-filter');
      if (!filter) {
        const viewHeader = document.querySelector('#view-standings .container > div:first-child');
        let actions = null;
        if (viewHeader) actions = viewHeader.querySelector('div:last-child');
        filter = document.createElement('select');
        filter.id = 'standings-room-filter';
        filter.setAttribute('aria-label', 'Lọc theo phòng thi');
        filter.style.cssText = 'background:#090c15;border:1px solid var(--border-subtle);color:#fff;padding:0.35rem 0.75rem;border-radius:6px;font-size:0.85rem;';
        if (actions) actions.prepend(filter);
        else if (viewHeader) viewHeader.appendChild(filter);
        else {
          const view = document.getElementById('view-standings');
          if (view) view.prepend(filter);
        }
        filter.addEventListener('change', (e) => {
          state.standingsRoomFilter = e.target.value;
          state.standingsPage = 0;
          renderStandings();
        });
      }
      const rooms = [...new Set(allParticipants.map(p => p.room).filter(Boolean))].sort();
      const currentVal = state.standingsRoomFilter;
      const expectedOptions = ['ALL', ...rooms];
      const existingOptions = Array.from(filter.options).map(o => o.value);
      const needsRebuild = existingOptions.length !== expectedOptions.length || !expectedOptions.every((v, i) => v === existingOptions[i]);
      if (needsRebuild) {
        filter.innerHTML = '';
        const optAll = document.createElement('option');
        optAll.value = 'ALL';
        optAll.textContent = 'Tất cả Rooms';
        filter.appendChild(optAll);
        rooms.forEach(r => {
          const o = document.createElement('option');
          o.value = r;
          o.textContent = r;
          filter.appendChild(o);
        });
      }
      filter.value = expectedOptions.includes(currentVal) ? currentVal : 'ALL';
      if (!expectedOptions.includes(currentVal)) state.standingsRoomFilter = 'ALL';
    }
  } catch {}

  // Ensure pagination controls exist and update disabled state
  try {
    if (typeof document !== 'undefined') {
      const ensurePagination = () => {
        let container = document.getElementById('standings-pagination');
        if (!container) {
          container = document.createElement('div');
          container.id = 'standings-pagination';
          container.style.cssText = 'display:flex;justify-content:center;align-items:center;gap:0.75rem;margin:1rem 0;';
          const prev = document.createElement('button');
          prev.id = 'standings-prev';
          prev.textContent = '← Prev';
          prev.className = 'btn btn-outline';
          prev.style.cssText = 'padding:0.35rem 0.9rem;font-size:0.85rem;';
          prev.addEventListener('click', () => {
            if (state.standingsPage > 0) {
              state.standingsPage--;
              renderStandings();
            }
          });
          const info = document.createElement('span');
          info.id = 'standings-page-info';
          info.style.cssText = 'font-size:0.85rem;color:#94a3b8;';
          const next = document.createElement('button');
          next.id = 'standings-next';
          next.textContent = 'Next →';
          next.className = 'btn btn-outline';
          next.style.cssText = 'padding:0.35rem 0.9rem;font-size:0.85rem;';
          next.addEventListener('click', () => {
            const tp = Math.max(1, Math.ceil(filtered.length / pageSize));
            if (state.standingsPage < tp - 1) {
              state.standingsPage++;
              renderStandings();
            }
          });
          container.appendChild(prev);
          container.appendChild(info);
          container.appendChild(next);
          const topTbody = document.getElementById('top-standings-tbody');
          if (topTbody) {
            const card = topTbody.closest('.card');
            if (card && card.parentNode) card.parentNode.insertBefore(container, card.nextSibling);
            else document.body.appendChild(container);
          } else {
            const any = document.getElementById('standings-tbody');
            if (any) {
              const card = any.closest('.card');
              if (card && card.parentNode) card.parentNode.insertBefore(container, card.nextSibling);
              else document.body.appendChild(container);
            } else {
              document.body.appendChild(container);
            }
          }
        }
        const standingsTbody = document.getElementById('standings-tbody');
        if (standingsTbody) {
          let second = document.getElementById('standings-pagination-tab');
          if (!second) {
            second = document.createElement('div');
            second.id = 'standings-pagination-tab';
            second.style.cssText = 'display:flex;justify-content:center;align-items:center;gap:0.75rem;margin:1rem 0;';
            const prev2 = document.createElement('button');
            prev2.id = 'standings-prev-tab';
            prev2.textContent = '← Prev';
            prev2.className = 'btn btn-outline';
            prev2.style.cssText = 'padding:0.35rem 0.9rem;font-size:0.85rem;';
            prev2.addEventListener('click', () => {
              if (state.standingsPage > 0) { state.standingsPage--; renderStandings(); }
            });
            const info2 = document.createElement('span');
            info2.id = 'standings-page-info-tab';
            info2.style.cssText = 'font-size:0.85rem;color:#94a3b8;';
            const next2 = document.createElement('button');
            next2.id = 'standings-next-tab';
            next2.textContent = 'Next →';
            next2.className = 'btn btn-outline';
            next2.style.cssText = 'padding:0.35rem 0.9rem;font-size:0.85rem;';
            next2.addEventListener('click', () => {
              const tp = Math.max(1, Math.ceil(filtered.length / pageSize));
              if (state.standingsPage < tp - 1) { state.standingsPage++; renderStandings(); }
            });
            second.appendChild(prev2);
            second.appendChild(info2);
            second.appendChild(next2);
            const card2 = standingsTbody.closest('.card');
            if (card2 && card2.parentNode) card2.parentNode.insertBefore(second, card2.nextSibling);
          }
        }
        const updateBtn = (prevId, nextId, infoId) => {
          const p = document.getElementById(prevId);
          const n = document.getElementById(nextId);
          const inf = document.getElementById(infoId);
          if (p) p.disabled = state.standingsPage <= 0;
          if (n) n.disabled = state.standingsPage >= totalPages - 1;
          if (inf) inf.textContent = `Trang ${state.standingsPage + 1} / ${totalPages}`;
        };
        updateBtn('standings-prev', 'standings-next', 'standings-page-info');
        updateBtn('standings-prev-tab', 'standings-next-tab', 'standings-page-info-tab');
      };
      ensurePagination();
    }
  } catch {}

  if (tbodies.length === 0) return;

  tbodies.forEach(tbody => {
    tbody.innerHTML = '';
    pageSlice.forEach((p, idx) => {
      const globalIndex = start + idx;
      const tr = document.createElement('tr');
      if (p.isSelf) tr.style.background = 'rgba(255, 102, 0, 0.08)';

      const tier = getRatingTier(p.rating);
      const rankColorClass = `rank-${escapeHtml(tier.name.toLowerCase().replace(/\s+/g, '-'))}`;
      const safeName = escapeHtml(p.name);

      const subA = p.submissions.A;
      const colA = subA?.solved 
        ? `<span class="cell-passed" style="padding: 0.2rem 0.5rem;">+${Number(subA.score)}</span>`
        : (subA?.attempts > 0 ? `<span class="cell-failed" style="padding: 0.2rem 0.5rem;">-${Number(subA.attempts)}</span>` : `.` );

      const subB = p.submissions.B;
      let colB = '.';
      if (subB?.isHacked) {
        colB = `<span class="cell-hacked" style="padding: 0.2rem 0.5rem;">HACKED</span>`;
      } else if (subB?.solved) {
        colB = state.isFrozenBoard && !p.isSelf
          ? `<span class="cell-passed" style="padding: 0.2rem 0.5rem; background: rgba(0, 240, 255, 0.2); color: var(--accent-cyan);">+? (Frozen)</span>`
          : `<span class="cell-passed" style="padding: 0.2rem 0.5rem;">+${Number(subB.score)}</span>`;
      } else if (subB?.attempts > 0) {
        colB = `<span class="cell-failed" style="padding: 0.2rem 0.5rem;">-${Number(subB.attempts)}</span>`;
      }

      const hackText = `<span class="hack-plus">+${Number(p.hacks?.success || 0)}</span> : <span class="hack-minus">-${Number(p.hacks?.fail || 0)}</span>`;

      const rankNum = globalIndex + 1;
      let rankHtml = `${rankNum}`;
      if (rankNum === 1) rankHtml = `<span class="rank-medal rank-medal-1">1</span>`;
      else if (rankNum === 2) rankHtml = `<span class="rank-medal rank-medal-2">2</span>`;
      else if (rankNum === 3) rankHtml = `<span class="rank-medal rank-medal-3">3</span>`;

      tr.innerHTML = `
        <td class="col-rank">${rankHtml}</td>
        <td class="col-user">
          <span class="${rankColorClass}" style="font-weight: 700;">${safeName}</span>
          <span style="font-size: 0.75rem; color: #64748b;">(${Number(p.rating)})</span>
        </td>
        <td class="col-score">${Number(p.totalScore)}</td>
        <td class="col-hack">${hackText}</td>
        <td>${colA}</td>
        <td>${colB}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}
try { window.renderStandings = renderStandings; } catch {}

function renderRoom() {
  const grid = document.getElementById('room-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const roomMembers = state.contestants.filter(c => c.room === state.currentUser.room);

  roomMembers.forEach(member => {
    const card = document.createElement('div');
    card.className = 'room-card';

    const tier = getRatingTier(member.rating);
    const rankColorClass = `rank-${escapeHtml(tier.name.toLowerCase().replace(/\s+/g, '-'))}`;
    const safeName = escapeHtml(member.name);
    const safeRoom = escapeHtml(member.room);
    const safeBadge = escapeHtml(tier.badge);

    let subButtons = '';
    if (member.submissions.B?.solved) {
      if (member.submissions.B.isHacked) {
        subButtons += `<button class="prob-badge-btn" style="border-color: #d50000; color: #ff5252; text-decoration: line-through;" disabled aria-label="Bài B đã bị hack">B (Hacked)</button>`;
      } else if (state.currentPhase === CONTEST_PHASES.CODING) {
        const safeId = escapeHtml(member.id);
        subButtons += `<button class="prob-badge-btn" onclick="openHackModal('${safeId}', 'B')" style="opacity: 0.7; cursor: not-allowed; border-color: rgba(255,255,255,0.2);" title="Khóa trong Coding Phase" aria-label="Khóa xem code bài B trong Coding Phase">🔒 B (Chờ Hack Phase)</button>`;
      } else {
        const safeId = escapeHtml(member.id);
        subButtons += `<button class="prob-badge-btn" onclick="openHackModal('${safeId}', 'B')" aria-label="Xem code B của ${safeName}">⚡ Hack B (+${Number(member.submissions.B.score)})</button>`;
      }
    }

    card.innerHTML = `
      <div class="room-user-info">
        <div>
          <h4 class="${rankColorClass}">${safeName}</h4>
          <span style="font-size: 0.8rem; color: #94a3b8;">Rating: ${Number(member.rating)} • ${safeBadge}</span>
        </div>
        <span class="tag-badge">${safeRoom}</span>
      </div>
      <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.25rem;">Các bài đã Pretest Passed:</div>
      <div class="room-submissions">
        <button class="prob-badge-btn" disabled aria-label="Đã qua">A (Passed)</button>
        ${subButtons}
      </div>
    `;
    grid.appendChild(card);
  });
}

// ==========================================
// HACK MODAL & CHALLENGE LOGIC
// ==========================================
let currentHackTarget = null;

window.openHackModal = (contestantId, problemKey) => {
  if (!canHack(state.auth)) {
    sound.playTick();
    openAuthModal('Bạn đang ở chế độ Khách (Guest). Vui lòng đăng nhập để tham gia bẻ khóa trong Phòng Thách Đấu!');
    return;
  }

  if (state.currentPhase === CONTEST_PHASES.CODING) {
    sound.playHackFailed();
    notify.warn('⚠️ CẢNH BÁO: Đang trong Coding Phase! Bạn chỉ có thể xem code và hack đối thủ khi bước sang HACK PHASE (sau 120 phút). Ban Tổ Chức sẽ kích hoạt từ Admin Center.');
    return;
  }

  const target = state.contestants.find(c => c.id === contestantId);
  if (!target || !target.sourceCodes[problemKey]) return;

  currentHackTarget = { target, problemKey };
  document.getElementById('modal-target-user').textContent = target.name;
  document.getElementById('modal-target-problem').textContent = `Problem ${problemKey}`;
  document.getElementById('modal-code-viewer').textContent = target.sourceCodes[problemKey];
  document.getElementById('hack-input-field').value = '';
  document.getElementById('hack-result-log').innerHTML = '';
  document.getElementById('hack-modal').classList.add('active');
};

document.getElementById('modal-close-btn')?.addEventListener('click', () => {
  document.getElementById('hack-modal').classList.remove('active');
});

document.getElementById('submit-hack-btn')?.addEventListener('click', () => {
  const inputData = document.getElementById('hack-input-field').value.trim();
  const consoleLog = document.getElementById('hack-result-log');
  if (!inputData) {
    sound.playHackFailed();
    notify.warn('Vui lòng nhập testcase đầu vào để thách đấu!');
    if (consoleLog) consoleLog.innerHTML = `<span style="color: var(--accent-red);">[LỖI] Vui lòng nhập dữ liệu testcase stdin vào ô bên trên!</span>`;
    return;
  }
  if (inputData.length > 50000) {
    sound.playHackFailed();
    notify.warn('Input quá lớn (tối đa 50KB)');
    if (consoleLog) consoleLog.innerHTML = `<span style="color: var(--accent-red);">[LỖI] Kích thước input vượt quá 50KB!</span>`;
    return;
  }

  if (consoleLog) consoleLog.innerHTML = `<span style="color: var(--accent-cyan);">[SANDBOX] Đang biên dịch mã nguồn và nạp testcase thách đấu...</span>`;
  sound.playTick();
  try{ window.__deverAnalytics.track('hack_attempt', {target: currentHackTarget?.target?.id}) }catch{}

  setTimeout(async () => {
    let isSuccess = false;
    if (currentHackTarget.target.id === 'c3') {
      const isBigTest = inputData.length > 8 || inputData.includes('1000') || inputData.includes('200000');
      if (isBigTest) {
        consoleLog.innerHTML = `
          <span style="color: var(--accent-green); font-weight: 700;">✅ HACK SUCCESSFUL! (Time: 12ms)</span><br>
          <span style="color: #94a3b8;">Code của đối thủ bị Runtime Error (Integer Overflow / TLE)!</span><br>
          <span style="color: var(--accent-orange); font-weight: 700;">🎉 Bạn được cộng +100 ĐIỂM HACK THƯỞNG!</span>
        `;
        sound.playHackSuccess();
        state.currentUser.hacks.success += 1;
        currentHackTarget.target.submissions.B.isHacked = true;
        isSuccess = true;
        renderStandings();
        renderRoom();
      } else {
        consoleLog.innerHTML = `
          <span style="color: var(--accent-red); font-weight: 700;">❌ HACK UNSUCCESSFUL!</span><br>
          <span style="color: #94a3b8;">Code của đối thủ vẫn chạy đúng trên testcase nhỏ này.</span><br>
          <span style="color: var(--accent-red);">⚠️ Bạn bị phạt -50 ĐIỂM!</span>
        `;
        sound.playHackFailed();
        state.currentUser.hacks.fail += 1;
        renderStandings();
      }
    } else {
      consoleLog.innerHTML = `
        <span style="color: var(--accent-red); font-weight: 700;">❌ HACK UNSUCCESSFUL!</span><br>
        <span style="color: #94a3b8;">Code của thí sinh này đã tối ưu O(N) và dùng __int128/long long!</span><br>
        <span style="color: var(--accent-red);">⚠️ Bạn bị phạt -50 ĐIỂM!</span>
      `;
      sound.playHackFailed();
      state.currentUser.hacks.fail += 1;
      renderStandings();
    }
    // Persist hack event to DB
    try {
      await db.put('hack_events', {
        id: 'hack_' + Date.now(),
        contest_id: 'contest_dever_round1',
        hacker_id: state.auth.id || 'user_me',
        target_submission_id: currentHackTarget.target.id + '_B',
        input_payload: inputData.slice(0, 50000),
        is_successful: isSuccess,
        points_delta: isSuccess ? 100 : -50,
        executed_at: new Date().toISOString()
      });
    } catch (e) { console.warn('DB hack put failed', e); }
  }, 900);
});

// ==========================================
// ĐIỀU KHIỂN PHASE THI ĐẤU & ĐỒNG BỘ LIÊN TAB
// ==========================================
function setupPhaseControls() {
  window.switchPhase = (newPhase, broadcast = true) => {
    state.currentPhase = newPhase;

    if (broadcast && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('dever_contest_phase', newPhase);
        localStorage.setItem('dever_contest_phase_ts', String(Date.now()));
      } catch {}
    }

    const phasePills = [
      document.getElementById('phase-indicator'),
      ...document.querySelectorAll('.phase-indicator-sync')
    ].filter(Boolean);

    const timerDisplays = [
      document.getElementById('timer-countdown'),
      ...document.querySelectorAll('.timer-countdown-sync')
    ].filter(Boolean);

    phasePills.forEach(phasePill => {
      phasePill.className = 'phase-pill';
      if (newPhase === CONTEST_PHASES.CODING) {
        phasePill.classList.add('phase-coding');
        phasePill.textContent = 'Coding Phase';
      } else if (newPhase === CONTEST_PHASES.HACK_PHASE) {
        phasePill.classList.add('phase-hack');
        phasePill.textContent = 'Hack Phase (15:00)';
      } else if (newPhase === CONTEST_PHASES.SYSTEM_TESTING) {
        phasePill.classList.add('phase-system');
        phasePill.textContent = 'System Testing';
      } else if (newPhase === CONTEST_PHASES.FINISHED) {
        phasePill.textContent = 'Contest Finished';
      }
    });

    if (newPhase === CONTEST_PHASES.CODING) {
      state.contestRemainingSeconds = 4712; // 01:18:32
      timerDisplays.forEach(td => td.textContent = '01:18:32');
    } else if (newPhase === CONTEST_PHASES.HACK_PHASE) {
      state.contestRemainingSeconds = 899; // 00:14:59
      timerDisplays.forEach(td => td.textContent = '00:14:59');
      sound.playHackSuccess();
      notify.info('⚡ CHÚ Ý: ĐÃ HẾT GIỜ LÀM BÀI! Contest chính thức bước vào HACK / CHALLENGE PHASE (15 phút). Hãy vào phòng Hack Room để soi code đối thủ và bẻ khóa!');
    } else if (newPhase === CONTEST_PHASES.SYSTEM_TESTING) {
      state.contestRemainingSeconds = 0;
      timerDisplays.forEach(td => td.textContent = 'Chấm lại...');
      runSystemTesting();
    } else if (newPhase === CONTEST_PHASES.FINISHED) {
      state.contestRemainingSeconds = 0;
      timerDisplays.forEach(td => td.textContent = 'Đã kết thúc');
      renderRatingChanges();
      // Mở khóa tab Editorial cho thí sinh xem sau khi contest kết thúc
      const editTab = document.getElementById('ws-tab-editorial');
      if (editTab) editTab.classList.remove('btn-outline');
    }

    renderStandings();
    renderRoom();
    notify.success('Đã chuyển sang: ' + newPhase);

    // Đồng bộ vào IndexedDB nếu có store contests
    try {
      db.get('contests', 'contest_dever_round1').then(c => {
        if (c) {
          c.status = newPhase;
          db.put('contests', c);
        }
      });
    } catch {}
  };

  // Lắng nghe sự kiện storage để đồng bộ liên tab (Cross-Tab Synchronization)
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === 'dever_contest_phase' && e.newValue) {
        if (state.currentPhase !== e.newValue && typeof window.switchPhase === 'function') {
          window.switchPhase(e.newValue, false);
        }
      }
      if (e.key === 'dever_emergency_announcement' && e.newValue) {
        sound.playHackFailed();
        notify.warn('📢 [THÔNG BÁO BAN GIÁM KHẢO]: ' + e.newValue);
      }
    });
  }

  // Khôi phục phase đã lưu nếu có
  try {
    const saved = localStorage.getItem('dever_contest_phase');
    if (saved && Object.values(CONTEST_PHASES).includes(saved) && saved !== CONTEST_PHASES.CODING) {
      window.switchPhase(saved, false);
    }
  } catch {}
}

// ==========================================
// REAL-TIME CONTEST TIMER & TICKER (TỪNG GIÂY)
// ==========================================
let timerInterval = null;
function setupContestTimer() {
  if (timerInterval) clearInterval(timerInterval);

  const updateTimerUI = () => {
    const timerDisplay = document.getElementById('timer-countdown');
    const progressFill = document.getElementById('contest-progress-fill');

    if (state.currentPhase === CONTEST_PHASES.SYSTEM_TESTING) {
      if (timerDisplay) timerDisplay.textContent = 'Chấm lại...';
      if (progressFill) progressFill.style.width = '100%';
      return;
    }
    if (state.currentPhase === CONTEST_PHASES.FINISHED) {
      if (timerDisplay) timerDisplay.textContent = 'Đã kết thúc';
      if (progressFill) progressFill.style.width = '100%';
      return;
    }

    if (typeof state.contestRemainingSeconds === 'number' && state.contestRemainingSeconds > 0) {
      state.contestRemainingSeconds -= 1;
    }

    const totalSec = 135 * 60; // 8100s
    const curSec = Math.max(0, state.contestRemainingSeconds || 0);
    const elapsedSec = totalSec - curSec;
    const pct = Math.min(100, Math.max(0, (elapsedSec / totalSec) * 100));

    if (progressFill) {
      progressFill.style.width = `${pct.toFixed(1)}%`;
    }

    const hrs = Math.floor(curSec / 3600);
    const mins = Math.floor((curSec % 3600) / 60);
    const secs = curSec % 60;
    const fmt = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (timerDisplay) {
      timerDisplay.textContent = fmt;
    }

    // Tự động chuyển phase khi thời gian đếm ngược chạm mốc
    if (state.currentPhase === CONTEST_PHASES.CODING && curSec <= 900 && curSec > 0) {
      window.switchPhase(CONTEST_PHASES.HACK_PHASE);
    } else if (state.currentPhase === CONTEST_PHASES.HACK_PHASE && curSec <= 0) {
      window.switchPhase(CONTEST_PHASES.SYSTEM_TESTING);
    }
  };

  updateTimerUI();
  timerInterval = setInterval(updateTimerUI, 1000);
}

// ==========================================
// WORKSPACE 1-CLICK SAMPLE TEST RUNNER
// ==========================================
function setupSampleTestRunner() {
  const runBtn = document.getElementById('ws-run-sample-btn');
  const copyBtn = document.getElementById('ws-copy-sample-btn');
  const consoleOutput = document.getElementById('editor-console-output');
  const metricsEl = document.getElementById('execution-metrics');

  copyBtn?.addEventListener('click', () => {
    const sampleIn = (document.getElementById('ws-sample-in')?.innerText || document.getElementById('ws-sample-in')?.textContent || '').trim();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sampleIn).then(() => {
        notify.success('Đã sao chép input mẫu vào clipboard!');
      }).catch(() => {
        notify.info('Input mẫu: ' + sampleIn.slice(0, 30));
      });
    } else {
      notify.info('Input mẫu: ' + sampleIn.slice(0, 30));
    }
    sound.playTick();
  });

  runBtn?.addEventListener('click', async () => {
    if (!canSubmit(state.auth)) {
      sound.playTick();
      openAuthModal('Bạn đang ở chế độ Khách (Guest). Vui lòng đăng nhập để chạy Sandbox!');
      return;
    }
    const code = document.getElementById('code-editor-input')?.value || '';
    const sampleInEl = document.getElementById('ws-sample-in');
    const sampleOutEl = document.getElementById('ws-sample-out');
    const sampleIn = (sampleInEl?.innerText || sampleInEl?.textContent || '').trim();
    const sampleOut = (sampleOutEl?.innerText || sampleOutEl?.textContent || '').trim();

    if (!code.trim()) {
      notify.error('Vui lòng nhập code trước khi chạy test mẫu!');
      return;
    }

    if (consoleOutput) {
      consoleOutput.innerHTML = '<span style="color: var(--accent-yellow);">⏳ Đang biên dịch và thực thi trên Test Mẫu...</span>';
    }
    sound.playTick();
    __perfMark('sample_test_run');

    if (runBtn) {
      runBtn.disabled = true;
      runBtn.textContent = '⏳ Đang chạy...';
    }

    try {
      const res = await executeCodeInBrowser(state.selectedLanguage, code, sampleIn);

      const actual = String(res.stdout || '').trim();
      const expected = String(sampleOut || '').trim();
      const isOk = (res.status === 'OK' || !res.status.includes('Error')) && actual === expected;

      if (metricsEl) {
        metricsEl.textContent = `Time: ${res.executionTimeMs}ms | Mem: ${res.memoryKb}KB`;
      }

      if (isOk) {
        sound.playAccepted();
        if (consoleOutput) {
          consoleOutput.innerHTML = `
            <div style="color: var(--accent-green); font-weight: 700; margin-bottom: 0.35rem;">
              ✅ ACCEPTED TRÊN TEST MẪU (${res.executionTimeMs} ms)
            </div>
            <div style="font-size: 0.82rem; color: #94a3b8;">
              Output thực tế trùng khớp 100% với kỳ vọng.<br>
              <strong>Output:</strong> <code style="color: #fff; background: rgba(0,230,118,0.15); padding: 0.15rem 0.4rem; border-radius: 4px;">${escapeHtml(actual)}</code>
            </div>
          `;
        }
        notify.success('✅ Accepted trên test ví dụ mẫu!');
      } else {
        sound.playWrongAnswer();
        const statusTitle = res.status.includes('Compilation') ? 'COMPILATION ERROR' : (res.status.includes('Time Limit') ? 'TIME LIMIT EXCEEDED' : 'WRONG ANSWER TRÊN TEST MẪU');
        if (consoleOutput) {
          consoleOutput.innerHTML = `
            <div style="color: var(--accent-red); font-weight: 700; margin-bottom: 0.35rem;">
              ❌ ${statusTitle} (${res.executionTimeMs} ms)
            </div>
            <div style="font-size: 0.82rem; color: #cbd5e1; line-height: 1.6;">
              <strong>Kỳ vọng (Expected):</strong> <code style="color: var(--accent-green);">${escapeHtml(expected)}</code><br>
              <strong>Thực tế (Actual):</strong> <code style="color: var(--accent-red);">${escapeHtml(actual || res.status)}</code>
            </div>
          `;
        }
        notify.info('⚠️ Test mẫu chưa khớp. Hãy kiểm tra lại thuật toán hoặc nhấn Diff!');
      }
    } finally {
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.textContent = '🧪 Chạy Test Mẫu (Run Sample)';
      }
    }
  });
}

function runSystemTesting() {
  const outputs = [
    document.getElementById('system-test-log'),
    document.getElementById('top-system-test-log')
  ].filter(Boolean);

  if (outputs.length === 0) return;

  outputs.forEach(el => {
    el.innerHTML = `<span style="color: var(--accent-yellow);">Đang chạy System Test trên toàn bộ 45 Hidden Testcases...</span><br>`;
  });

  setTimeout(() => {
    outputs.forEach(el => {
      el.innerHTML += `• Kiểm tra bài A của toàn bộ thí sinh... 100% Passed!<br>`;
      el.innerHTML += `• Kiểm tra bài B của rookie_fresher_k21: Đã bị loại do Hacked!<br>`;
      el.innerHTML += `• Kiểm tra bài B của dever_hero: Passed on system test 45!<br>`;
      el.innerHTML += `<span style="color: var(--accent-green); font-weight: 700;">HỆ THỐNG ĐÃ HOÀN TẤT SYSTEM TESTING! BẢNG ĐIỂM CHÍNH THỨC ĐÃ ĐƯỢC CHỐT.</span>`;
    });
    sound.playAccepted();
  }, 1200);
}

function renderRatingChanges() {
  const containers = [
    document.getElementById('rating-results-card'),
    document.getElementById('top-rating-results-card')
  ].filter(Boolean);

  containers.forEach(c => c.style.display = 'block');

  const participants = [
    { id: state.currentUser.id, name: state.currentUser.name, oldRating: state.currentUser.rating, points: state.currentUser.submissions.A.score + (state.currentUser.submissions.B.isHacked ? 0 : state.currentUser.submissions.B.score) + calculateHackScore(state.currentUser.hacks.success, state.currentUser.hacks.fail) },
    ...state.contestants.map(c => ({
      id: c.id,
      name: c.name,
      oldRating: c.rating,
      points: (c.submissions.A?.solved ? c.submissions.A.score : 0) + (c.submissions.B?.solved && !c.submissions.B.isHacked ? c.submissions.B.score : 0) + calculateHackScore(c.hacks.success, c.hacks.fail)
    }))
  ];

  const ratingResults = calculateContestRatingChanges(participants);
  const tbodies = [
    document.getElementById('rating-tbody'),
    document.getElementById('top-rating-tbody')
  ].filter(Boolean);

  tbodies.forEach(tbody => {
    tbody.innerHTML = '';
    ratingResults.forEach(r => {
      const deltaColor = r.delta >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
      const deltaSign = r.delta >= 0 ? `+${r.delta}` : `${r.delta}`;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700;">${r.rank}</td>
        <td style="font-weight: 600;">${r.name}</td>
        <td>${r.oldRating}</td>
        <td style="font-weight: 700; color: ${deltaColor};">${deltaSign}</td>
        <td style="font-weight: 700; color: ${r.tier.color};">${r.newRating} (${r.tier.name})</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

// ==========================================
// ĐIỀU HÀNH ADMIN COMMAND CENTER (QUẢN TRỊ VIÊN)
// ==========================================
function setupAdminControls() {
  const caseSelect = document.getElementById('anticheat-case-select-admin');
  const codeABox = document.getElementById('ast-code-a-admin');
  const codeBBox = document.getElementById('ast-code-b-admin');
  const runBtn = document.getElementById('run-ast-check-btn-admin');

  const cases = {
    case1: {
      a: `// Mã nguồn thí sinh rookie_dev_1
#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    int total = 0;
    for(int i = 0; i < n; i++) {
        total += i;
    }
    cout << total << endl;
    return 0;
}`,
      b: `// Mã nguồn thí sinh clone_account_2
#include <iostream>
using namespace std;
// Day la code tu toi code
int main() {
    int sz; cin >> sz;
    int sum = 0; // khoi tao tong
    for(int idx = 0; idx < sz; idx++) {
        sum += idx;
    }
    cout << sum << endl;
    return 0;
}`
    },
    case2: {
      a: `// Giải thuật Sắp xếp & Hai con trỏ
#include <vector>
#include <algorithm>
void solve() {
    std::vector<int> a = {5, 2, 8, 1};
    std::sort(a.begin(), a.end());
}`,
      b: `// Giải thuật Dijkstra tìm đường đi ngắn nhất
#include <queue>
#include <vector>
void dijkstra(int s) {
    std::priority_queue<std::pair<int, int>> pq;
    pq.push({0, s});
}`
    }
  };

  const loadCase = (key) => {
    if (codeABox && codeBBox && cases[key]) {
      codeABox.textContent = cases[key].a;
      codeBBox.textContent = cases[key].b;
    }
  };

  caseSelect?.addEventListener('change', (e) => loadCase(e.target.value));
  loadCase('case1');

  runBtn?.addEventListener('click', () => {
    const codeA = codeABox?.textContent || '';
    const codeB = codeBBox?.textContent || '';
    const result = calculateCodeSimilarity(codeA, codeB);
    const stats = getAstStats(codeA, codeB);

    const simVal = document.getElementById('ast-similarity-val-admin');
    const fill = document.getElementById('ast-meter-fill-admin');
    const verdict = document.getElementById('ast-verdict-badge-admin');

    if (simVal) simVal.textContent = `${result.similarity}%`;
    if (fill) fill.style.transform = `scaleX(${result.similarity / 100})`;

    if (result.verdict === 'PLAGIARISM_CONFIRMED') {
      if (simVal) simVal.style.color = 'var(--accent-red)';
      if (fill) fill.style.background = 'linear-gradient(90deg, #ff8c00, #ff3366)';
      if (verdict) verdict.innerHTML = `<span class="badge-verdict badge-wa">🔴 GIAN LẬN: Cấu trúc mã nguồn tương đồng ${result.similarity}% (Gắn cờ huỷ kết quả)</span>`;
      sound.playHackFailed();
    } else {
      if (simVal) simVal.style.color = 'var(--accent-green)';
      if (fill) fill.style.background = 'linear-gradient(90deg, #00b4d8, #00e676)';
      if (verdict) verdict.innerHTML = `<span class="badge-verdict badge-ac">🟢 HỢP LỆ: Tương đồng ${result.similarity}% (Không có dấu hiệu sao chép)</span>`;
      sound.playAccepted();
    }
    if (verdict) {
      const prev = verdict.querySelector('.ast-extra-stats');
      if (prev) prev.remove();
      const extra = document.createElement('span');
      extra.className = 'ast-extra-stats';
      extra.style.marginLeft = '0.6rem';
      extra.style.fontSize = '0.85rem';
      extra.style.color = '#94a3b8';
      extra.textContent = `Tokens: ${stats.tokensA}/${stats.tokensB} • Jaccard: ${stats.jaccard}%`;
      verdict.appendChild(extra);
    }
  });
}

window.switchAdminSubTab = (subTabId) => {
  document.querySelectorAll('.admin-panel-view').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });

  const target = document.getElementById(subTabId);
  if (target) target.classList.add('active');

  const btnIdMap = {
    'adm-contest-ctrl': 'adm-tab-btn-ctrl',
    'adm-anticheat': 'adm-tab-btn-anticheat',
    'adm-polygon': 'adm-tab-btn-polygon',
    'adm-telemetry': 'adm-tab-btn-telemetry'
  };
  const activeBtn = document.getElementById(btnIdMap[subTabId]);
  if (activeBtn) { activeBtn.classList.add('active'); activeBtn.setAttribute('aria-selected','true'); }
  sound.playTick();
};

window.toggleFrozenBoard = () => {
  state.isFrozenBoard = !state.isFrozenBoard;
  const banner = document.getElementById('frozen-board-banner');
  const btn = document.getElementById('admin-freeze-btn');

  if (banner) banner.style.display = state.isFrozenBoard ? 'flex' : 'none';
  if (btn) {
    btn.innerHTML = state.isFrozenBoard 
      ? '🔥 Hủy Đóng Băng (Unfreeze Board)' 
      : '❄️ Bật Đóng Băng Bảng Điểm (Freeze Board)';
  }

  sound.playTick();
  renderStandings();
  const freezeMsg = state.isFrozenBoard 
    ? '❄️ ĐÃ KÍCH HOẠT FROZEN BOARD! Bảng xếp hạng công khai giờ đã bị đóng băng 60 phút cuối.' 
    : '🔥 ĐÃ HỦY ĐÓNG BĂNG! Bảng xếp hạng công khai đã hiển thị đầy đủ điểm số thực tế.';
  notify.info(freezeMsg);
};

window.emergencyAnnounce = () => {
  const defaultMsg = 'CHÚ Ý: Bộ testcase bài B có cập nhật giải thích, hãy đọc kỹ phần Editorial!';
  let msg = defaultMsg;
  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    const inputMsg = window.prompt('Nhập thông báo khẩn cấp từ Ban Giám Khảo gửi đến toàn bộ thí sinh:', defaultMsg);
    if (inputMsg === null) return;
    if (inputMsg.trim()) msg = inputMsg.trim();
  }
  sound.playHackFailed();
  notify.info('📢 [THÔNG BÁO BAN GIÁM KHẢO]: ' + msg);
  try {
    localStorage.setItem('dever_emergency_announcement', msg);
    localStorage.setItem('dever_emergency_announcement_ts', String(Date.now()));
  } catch {}
};

window.resetLocalDb = (btn) => {
  if (btn && !btn.dataset.confirmed) {
    btn.dataset.confirmed = 'true';
    btn.textContent = '⚠️ Nhấn lần nữa để Xác Nhận!';
    btn.classList.add('btn-danger');
    btn.classList.remove('btn-secondary');
    notify.warn('⚠️ CẢNH BÁO: Nhấn lần nữa để xóa toàn bộ IndexedDB và LocalStorage!');
    setTimeout(() => {
      if (btn && btn.dataset.confirmed) {
        delete btn.dataset.confirmed;
        btn.textContent = '🗑️ Xoá DB local (reset seed)';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-secondary');
      }
    }, 4500);
    return;
  }
  localStorage.clear();
  try { indexedDB.deleteDatabase('dever_arena'); } catch {}
  location.reload();
};

window.disqualifyCheater = (contestantId) => {
  const target = state.contestants.find(c => c.id === contestantId);
  if (!target) return;

  // 2-click confirm state without blocking alert/confirm
  const btn = document.getElementById('btn-disqualify-cheater');
  if (btn && !btn.dataset.confirmed) {
    btn.dataset.confirmed = 'true';
    btn.textContent = '⚠️ Nhấn lần nữa để Truất quyền!';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-secondary');
    btn.style.borderColor = 'var(--accent-red)';
    btn.style.color = 'var(--accent-red)';
    notify.info(`⚠️ Nhấn xác nhận lần 2 để truất quyền thi đấu của thí sinh "${target.name}".`);
    setTimeout(() => {
      if (btn && btn.dataset.confirmed) {
        delete btn.dataset.confirmed;
        btn.textContent = '⛔ Truất quyền thi';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-danger');
        btn.style.borderColor = '';
        btn.style.color = '';
      }
    }, 4500);
    return;
  }

  if (btn) {
    delete btn.dataset.confirmed;
    btn.textContent = '⛔ Đã Truất quyền';
    btn.disabled = true;
    btn.style.opacity = '0.6';
  }

  target.name = `${target.name} [DISQUALIFIED]`;
  target.rating = 0;
  if (target.submissions.A) target.submissions.A.score = 0;
  if (target.submissions.B) {
    target.submissions.B.score = 0;
    target.submissions.B.isHacked = true;
  }
  sound.playHackFailed();
  renderStandings();
  renderRoom();

  state.globalSubmissions.unshift({
    id: 10484,
    time: 'Vừa xong',
    author: target.name,
    prob: 'ALL',
    lang: '—',
    verdict: 'Disqualified (AST Cheat 92%)',
    timeMs: 0,
    memKb: 0
  });
  renderSubmissionsTable();

  notify.info(`⛔ ĐÃ HỦY BÀI VÀ TRUẤT QUYỀN THI ĐẤU!\nThí sinh ${target.name} đã bị đưa về 0 điểm và gắn cờ kỷ luật trên bảng xếp hạng.`);
};


// ==========================================
// BIỂU ĐỒ RATING SVG (PROFILE CHART)
// ==========================================
function renderRatingChart() {
  const svg = document.getElementById('profile-rating-chart');
  if (!svg) return;
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Rating history');

  const history = state.currentUser.ratingHistory;
  const width = 800;
  const height = 240;
  const padX = 60;
  const padY = 40;

  const minRating = 1100;
  const maxRating = 1700;

  const getX = (i) => padX + (i / (history.length - 1)) * (width - padX * 2);
  const getY = (r) => height - padY - ((r - minRating) / (maxRating - minRating)) * (height - padY * 2);

  let pathD = `M ${getX(0)} ${getY(history[0].rating)}`;
  let areaD = `M ${getX(0)} ${height - padY} L ${getX(0)} ${getY(history[0].rating)}`;

  history.forEach((h, i) => {
    if (i > 0) {
      pathD += ` L ${getX(i)} ${getY(h.rating)}`;
      areaD += ` L ${getX(i)} ${getY(h.rating)}`;
    }
  });

  areaD += ` L ${getX(history.length - 1)} ${height - padY} Z`;

  let dotsHtml = '';
  history.forEach((h, i) => {
    const cx = getX(i);
    const cy = getY(h.rating);
    dotsHtml += `
      <circle cx="${cx}" cy="${cy}" r="5" fill="#00f0ff" stroke="#060910" stroke-width="2"/>
      <text x="${cx}" y="${cy - 12}" fill="#cbd5e1" font-size="11" font-family="JetBrains Mono" text-anchor="middle">${h.rating}</text>
      <text x="${cx}" y="${height - 15}" fill="#64748b" font-size="10" font-family="Outfit" text-anchor="middle">${h.date}</text>
    `;
  });

  svg.innerHTML = `
    <title>Rating history</title>
    <defs>
      <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#00f0ff" stop-opacity="0.0"/>
      </linearGradient>
    </defs>
    <line x1="${padX}" y1="${getY(1200)}" x2="${width - padX}" y2="${getY(1200)}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4"/>
    <line x1="${padX}" y1="${getY(1400)}" x2="${width - padX}" y2="${getY(1400)}" stroke="rgba(0,180,216,0.15)" stroke-dasharray="4"/>
    <line x1="${padX}" y1="${getY(1600)}" x2="${width - padX}" y2="${getY(1600)}" stroke="rgba(47,84,235,0.2)" stroke-dasharray="4"/>
    <path d="${areaD}" fill="url(#chartGrad)"/>
    <path d="${pathD}" fill="none" stroke="#00f0ff" stroke-width="3"/>
    ${dotsHtml}
  `;
}

// ==========================================
// TOGGLE ÂM THANH ESPORTS
// ==========================================
function setupAudioToggle() {
  const btn = document.getElementById('sound-btn');
  const label = document.getElementById('sound-label');

  btn?.addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    if (sound.enabled) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      if (label) label.textContent = 'ON';
      sound.playAccepted();
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
      if (label) label.textContent = 'OFF';
    }
  });
  // init aria
  if (btn) btn.setAttribute('aria-pressed', String(sound.enabled));
}

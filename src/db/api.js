/**
 * DEVER Arena — Mock REST API layer (maps docs/API_SPECIFICATION.md)
 * Uses IndexedDB wrapper `db` for persistence. No real network.
 * Endpoints covered: auth/login, contests, problems, submissions, standings
 *
 * Contract: Mỗi method là 1:1 với REST endpoint — sau này thay body bằng `fetch`
 * mà không đổi chữ ký hàm. JSDoc ghi rõ endpoint để grep/replace tự động.
 */
import { db } from './index.js';
import { calculateProblemScore } from '../core/scoring.js';
import { createVirtualSession, getVirtualElapsedMinutes, calculateVirtualStandings } from '../core/virtualContest.js';

// helper uuid
function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + Math.random().toString(36).slice(2);
}

// Resolve contest by id or slug
async function resolveContest(contestIdOrSlug) {
  if (!contestIdOrSlug) throw new Error('contest_id/slug required');
  let c = await db.get('contests', contestIdOrSlug);
  if (c) return c;
  const all = await db.getAll('contests');
  c = all.find(x => x.slug === contestIdOrSlug || x.id === contestIdOrSlug);
  if (!c) throw new Error('Contest not found: ' + contestIdOrSlug);
  return c;
}

export const api = {
  /**
   * Đăng nhập — mock cho `POST /api/v1/auth/login`
   * Real impl: `fetch('/api/v1/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username,password})})`
   * @endpoint POST /api/v1/auth/login
   * @param {{username: string, password?: string}} credentials
   * @returns {Promise<{token: string, refreshToken: string, user: object, accessToken: string}>}
   */
  async login({ username, password } = {}) {
    if (!username) throw new Error('username required');
    const users = await db.getAll('users');
    let user = users.find(u => u.username === username);
    // fallback: if not found but username resembles admin/participant, synthesize via role logic
    if (!user) {
      // try case-insensitive
      user = users.find(u => u.username.toLowerCase() === String(username).toLowerCase());
    }
    if (!user) {
      // mock: auto-create ephemeral user for login if not exists (to not fail demo)
      const isAdmin = String(username).toLowerCase().includes('admin');
      user = {
        id: 'user_' + String(username).replace(/\W/g,'_'),
        username,
        email: username + '@fpt.edu.vn',
        password_hash: 'mock',
        full_name: username,
        clan_id: null,
        rating: isAdmin ? 2450 : 1500,
        max_rating: isAdmin ? 2450 : 1500,
        rank_tier: isAdmin ? 'Grandmaster' : 'Specialist',
        role: isAdmin ? 'ADMIN' : 'PARTICIPANT'
      };
      await db.put('users', user);
    }
    // password check mock: accept 'mock' or any if password omitted
    const token = 'mock_jwt_' + user.id + '_' + Date.now();
    const refreshToken = 'mock_refresh_' + user.id;
    return { token, refreshToken, user, accessToken: token };
  },

  /**
   * Lấy thông tin user — mock cho `GET /api/v1/users/{username}`
   * Real: `fetch('/api/v1/users/' + username, {headers: getAuthHeaders()})`
   * @endpoint GET /api/v1/users/{username}
   * @param {string} username
   * @returns {Promise<object>}
   */
  async getUser(username) {
    const users = await db.getAll('users');
    const u = users.find(x => x.username === username);
    if (!u) throw new Error('User not found');
    return u;
  },

  /**
   * Lấy danh sách kỳ thi — mock cho `GET /api/v1/contests`
   * Real: `fetch('/api/v1/contests', {headers: getAuthHeaders()})`
   * @endpoint GET /api/v1/contests
   * @param {object} [filters]
   * @returns {Promise<object[]>}
   */
  async getContests(/* filters */) {
    return db.getAll('contests');
  },

  /**
   * Lấy contest đang ở phase CODING — mock cho `GET /api/v1/contests?status=CODING`
   * (spec: GET /api/v1/contests trả về Upcoming/Running/Past — client filter CODING)
   * Real: `fetch('/api/v1/contests?status=CODING', {headers: getAuthHeaders()}).then(r=>r.json()).then(list=>list.find(c=>c.status==='CODING'))`
   * @endpoint GET /api/v1/contests — filter status=CODING (convenience: getCurrentContest)
   * @returns {Promise<object|null>} contest có status CODING hoặc null nếu không có
   */
  async getCurrentContest() {
    const contests = await db.getAll('contests');
    // Ưu tiên status CODING (seed dùng field này); fallback phase CODING hoặc RUNNING
    const cur = contests.find(c => c.status === 'CODING' || c.phase === 'CODING' || c.status === 'RUNNING');
    return cur || null;
  },

  /**
   * Lấy chi tiết contest — mock cho `GET /api/v1/contests/{slug}`
   * Real: `fetch('/api/v1/contests/' + slug, {headers: getAuthHeaders()})`
   * @endpoint GET /api/v1/contests/{slug}
   * @param {string} slugOrId
   * @returns {Promise<object>}
   */
  async getContest(slugOrId) {
    return resolveContest(slugOrId);
  },

  /**
   * Đăng ký tham gia contest (legacy) — mock cho `POST /api/v1/contests/{slug}/register`
   * Real: `fetch('/api/v1/contests/'+slug+'/register', {method:'POST', headers:{...getAuthHeaders(),'Content-Type':'application/json'}, body:JSON.stringify({userId})})`
   * @endpoint POST /api/v1/contests/{slug}/register
   * @param {string} slugOrId - contest id hoặc slug
   * @param {string} userId
   * @returns {Promise<object>} contest_participants record
   */
  async registerForContest(slugOrId, userId) {
    const contest = await resolveContest(slugOrId);
    if (!userId) throw new Error('userId required');

    // Division eligibility check
    const user = await db.get('users', userId);
    if (user && typeof user.rating === 'number') {
      if (typeof contest.min_rating === 'number' && user.rating < contest.min_rating) {
        throw new Error(`Rating ${user.rating} không đủ điều kiện cho ${contest.title} (yêu cầu >= ${contest.min_rating})`);
      }
      if (typeof contest.max_rating === 'number' && user.rating > contest.max_rating) {
        throw new Error(`Rating ${user.rating} vượt quá giới hạn cho ${contest.title} (yêu cầu <= ${contest.max_rating})`);
      }
    }

    const id = `${contest.id}:${userId}`;
    // check existing
    const existing = await db.get('contest_participants', id);
    if (existing) return existing;
    const rec = { id, contest_id: contest.id, user_id: userId, registered_at: new Date().toISOString() };
    await db.put('contest_participants', rec);
    return rec;
  },

  /**
   * Đăng ký tham gia contest (contract mới) — mock cho `POST /api/v1/contests/{contestId}/register`
   * Alias chuẩn hoá của registerForContest với tên tham số đúng spec `contestId`
   * Real: `fetch('/api/v1/contests/'+contestId+'/register', {method:'POST', headers:{...getAuthHeaders(),'Content-Type':'application/json'}, body:JSON.stringify({user_id:userId})})`
   * @endpoint POST /api/v1/contests/{slug}/register
   * @param {string} contestId - contest id hoặc slug (alias contestId thay vì slugOrId)
   * @param {string} userId
   * @returns {Promise<object>} contest_participants record
   */
  async registerContest(contestId, userId) {
    if (!contestId) throw new Error('contestId required');
    if (!userId) throw new Error('userId required');
    // Delegate to canonical registerForContest để giữ single source of truth
    return this.registerForContest(contestId, userId);
  },

  /**
   * Lấy danh sách participants của contest — mock cho `GET /api/v1/contests/{slug}/participants`
   * (mở rộng từ spec GET /api/v1/contests/{slug}/rooms/{roomId}; filter client-side)
   * Real: `fetch('/api/v1/contests/'+contestId+'/participants', {headers: getAuthHeaders()})`
   * Hoặc: `fetch('/api/v1/contests/'+contestId+'/rooms', {headers: getAuthHeaders()})` rồi flat
   * @endpoint GET /api/v1/contests/{slug}/participants
   * @param {string} contestId - contest id hoặc slug
   * @returns {Promise<object[]>} danh sách contest_participants
   */
  async getContestParticipants(contestId) {
    if (!contestId) throw new Error('contestId required');
    let targetId = contestId;
    try {
      const contest = await resolveContest(contestId);
      targetId = contest.id;
    } catch {
      // fallback: contestId is raw id not yet resolvable — keep as is
    }
    return db.query('contest_participants', p => p.contest_id === targetId);
  },


  /**
   * Lấy danh sách bài — mock cho `GET /api/v1/problems` (hỗ trợ filter tag/min_rating/max_rating/search/contest_id)
   * Real: `fetch('/api/v1/problems?tag='+tag+'&min_rating='+... , {headers: getAuthHeaders()})`
   * @endpoint GET /api/v1/problems
   * @param {object} [filters]
   * @param {string} [filters.tag]
   * @param {number} [filters.min_rating]
   * @param {number} [filters.max_rating]
   * @param {string} [filters.search]
   * @param {string} [filters.contest_id]
   * @returns {Promise<object[]>}
   */
  async getProblems(filters = {}) {
    let list = await db.getAll('problems');
    if (filters.tag) list = list.filter(p => (p.tags||[]).includes(filters.tag));
    if (filters.min_rating) list = list.filter(p => p.base_points >= Number(filters.min_rating));
    if (filters.max_rating) list = list.filter(p => p.base_points <= Number(filters.max_rating));
    if (filters.search) {
      const q = String(filters.search).toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || (p.tags||[]).some(t => t.toLowerCase().includes(q)));
    }
    if (filters.contest_id) list = list.filter(p => p.contest_id === filters.contest_id);
    return list;
  },

  /**
   * Lấy chi tiết đề bài — mock cho `GET /api/v1/problems/{id}`
   * Real: `fetch('/api/v1/problems/'+id, {headers: getAuthHeaders()})`
   * @endpoint GET /api/v1/problems/{id}
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getProblem(id) {
    const p = await db.get('problems', id);
    if (!p) throw new Error('Problem not found');
    // attach sample testcases
    const tcs = await db.query('testcases', tc => tc.problem_id === id && tc.is_sample);
    return { ...p, sampleTestcases: tcs };
  },

  /**
   * Lấy editorial — mock cho `GET /api/v1/problems/{id}/editorial`
   * Real: `fetch('/api/v1/problems/'+id+'/editorial', {headers: getAuthHeaders()})`
   * @endpoint GET /api/v1/problems/{id}/editorial
   * @param {string} id
   * @returns {Promise<string>}
   */
  async getEditorial(id) {
    const p = await db.get('problems', id);
    if (!p) throw new Error('Problem not found');
    return p.editorial_markdown || '';
  },

  /**
   * Nộp bài — mock cho `POST /api/v1/submissions`
   * Real: `fetch('/api/v1/submissions', {method:'POST', headers:{...getAuthHeaders(),'Content-Type':'application/json'}, body:JSON.stringify({contest_id,problem_id,language,source_code})})`
   * @endpoint POST /api/v1/submissions
   * @param {{contest_id: string, problem_id: string, language?: string, source_code: string, user_id?: string}} payload
   * @returns {Promise<object>} submission
   */
  async createSubmission({ contest_id, problem_id, language = 'CPP20', source_code = '', user_id = 'user_me' } = {}) {
    if (!contest_id) throw new Error('contest_id required');
    if (!problem_id) throw new Error('problem_id required');
    if (!source_code || source_code.trim().length === 0) throw new Error('source_code required');
    const contest = await resolveContest(contest_id);
    const problem = await db.get('problems', problem_id);
    if (!problem) throw new Error('problem not found');
    const langNorm = String(language).toUpperCase();
    const allowed = ['CPP20','PYTHON3','JAVA17','JS'];
    const finalLang = allowed.includes(langNorm) ? langNorm : 'CPP20';
    // compute elapsedMinutes from contest start_time (mock 42 if no start)
    let elapsedMinutes = 10;
    try {
      const start = new Date(contest.start_time).getTime();
      if (!isNaN(start)) elapsedMinutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
      // cap to contest duration for decay formula realism
      elapsedMinutes = Math.min(elapsedMinutes, contest.duration_minutes || 135);
    } catch {}
    // count wrongAttempts before this AC for same user+problem (WA in this contest)
    const prevSubs = await db.query('submissions', s => s.contest_id === contest.id && s.user_id === user_id && s.problem_id === problem_id);
    const wrongAttempts = prevSubs.filter(s => s.verdict !== 'AC').length;
    // simplistic verdict simulation: if code contains 'Wrong' keyword -> WA else AC
    const isWA = source_code.includes('__WA__') || source_code.includes('WA_TRIGGER');
    const verdict = isWA ? 'WA' : 'AC';
    const points_awarded = verdict === 'AC' ? calculateProblemScore(problem.base_points, elapsedMinutes, wrongAttempts) : 0;
    const sub = {
      id: 'sub_' + uuid(),
      user_id,
      problem_id,
      contest_id: contest.id,
      language: finalLang,
      source_code: String(source_code).slice(0, 50000),
      verdict,
      execution_time_ms: verdict === 'AC' ? 45 : 18,
      memory_used_kb: 2450,
      points_awarded,
      submitted_at: new Date().toISOString()
    };
    sub.user_id = user_id;
    await db.put('submissions', sub);
    return sub;
  },

  /**
   * Lấy submission — mock cho `GET /api/v1/submissions/{id}`
   * Real: `fetch('/api/v1/submissions/'+id, {headers: getAuthHeaders()})`
   * @endpoint GET /api/v1/submissions/{id}
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getSubmission(id) {
    const s = await db.get('submissions', id);
    if (!s) throw new Error('Submission not found');
    return s;
  },

  /**
   * Liệt kê submissions — mock cho `GET /api/v1/submissions?contest_id=&user_id=&problem_id=`
   * Real: `fetch('/api/v1/submissions?contest_id='+filter.contest_id, {headers: getAuthHeaders()})`
   * @endpoint GET /api/v1/submissions
   * @param {{contest_id?: string, user_id?: string, problem_id?: string}} [filter]
   * @returns {Promise<object[]>}
   */
  async listSubmissions(filter = {}) {
    let all = await db.getAll('submissions');
    if (filter.contest_id) all = all.filter(s => s.contest_id === filter.contest_id);
    if (filter.user_id) all = all.filter(s => s.user_id === filter.user_id);
    if (filter.problem_id) all = all.filter(s => s.problem_id === filter.problem_id);
    return all.sort((a,b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  },


  /**
   * Lấy bảng xếp hạng — mock cho `GET /api/v1/contests/{slug}/standings`
   * Real: `fetch('/api/v1/contests/'+contestId+'/standings?room_id=&clan_id=&page=&limit=&room=&clan=&pageSize=', {headers: getAuthHeaders()})`
   * @endpoint GET /api/v1/contests/{slug}/standings
   * @param {string} contestIdOrSlug
   * @param {object} [opts]
   * @param {string} [opts.room_id] - legacy
   * @param {string} [opts.room] - alias mới cho room_id (Crew-T pagination)
   * @param {string} [opts.clan_id] - legacy
   * @param {string} [opts.clan] - alias mới cho clan_id
   * @param {number} [opts.page] - 1-based page index (0 cũng được, sẽ map về 1)
   * @param {number} [opts.limit] - legacy page size
   * @param {number} [opts.pageSize] - alias mới cho limit (mặc định 20)
   * @returns {Promise<object[]>}
   */
  async getStandings(contestIdOrSlug, opts = {}) {
    const contest = await resolveContest(contestIdOrSlug);
    const submissions = await db.query('submissions', s => s.contest_id === contest.id);
    const users = await db.getAll('users');
    const userMap = new Map(users.map(u => [u.id, u]));
    let participants = [];
    try { participants = await db.getAll('contest_participants'); } catch {}
    const partByUser = new Map(participants.filter(p=>p.contest_id===contest.id).map(p=>[p.user_id, p]));

    // Build standings for all relevant users (participants + submitters)
    // If contest_participants empty, fallback to all users.
    let candidateIds = new Set();
    if (partByUser.size > 0) {
      for (const uid of partByUser.keys()) candidateIds.add(uid);
    }
    for (const s of submissions) candidateIds.add(s.user_id);
    if (candidateIds.size === 0) {
      for (const u of users) candidateIds.add(u.id);
    }

    const standings = [];
    for (const uid of candidateIds) {
      const user = userMap.get(uid);
      if (!user) continue;
      // sum points from AC submissions
      const userSubs = submissions.filter(s => s.user_id === uid && s.verdict === 'AC');
      let probScore = 0;
      for (const s of userSubs) probScore += (s.points_awarded || 0);
      const total_score = probScore;
      standings.push({
        user_id: uid,
        username: user.username,
        rating: user.rating,
        total_score,
        totalScore: total_score,
        problem_score: probScore,
        submissions: userSubs,
        clan_id: user.clan_id
      });
    }

    // sort descending total_score, tie-breaker lower penalty? For now rating descending as secondary
    standings.sort((a,b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return (b.rating||0) - (a.rating||0);
    });
    // assign rank (1-based, dense with ties)
    let rank = 1;
    for (let i=0;i<standings.length;i++) {
      if (i>0 && standings[i].total_score < standings[i-1].total_score) rank = i+1;
      standings[i].rank = rank;
      standings[i].new_rank = rank;
    }

    // pagination — hỗ trợ page/pageSize (mới) + page/limit (legacy), mặc định pageSize 20
    let filtered = standings;
    const hasPage = opts.page !== undefined && opts.page !== null && opts.page !== '';
    const hasPageSize = opts.pageSize !== undefined && opts.pageSize !== null && opts.pageSize !== '';
    const hasLimit = opts.limit !== undefined && opts.limit !== null && opts.limit !== '';
    const effectiveSizeRaw = hasPageSize ? opts.pageSize : (hasLimit ? opts.limit : null);
    const shouldPaginate = hasPage || hasPageSize || hasLimit;
    if (shouldPaginate) {
      let pageNum = hasPage ? Number(opts.page) : 1;
      // treat page 0 as 1 for 0-based compatibility (state.standingsPage = 0 => first page)
      if (!Number.isFinite(pageNum) || pageNum < 1) {
        if (pageNum === 0) pageNum = 1;
        else pageNum = 1;
      }
      let limitNum = effectiveSizeRaw !== null ? Number(effectiveSizeRaw) : 20;
      if (!Number.isFinite(limitNum) || limitNum <= 0) limitNum = 20;
      const start = (pageNum - 1) * limitNum;
      filtered = filtered.slice(start, start + limitNum);
    }
    return filtered;
  },

  /**
   * Bắt đầu phiên thi ảo — mock cho `POST /api/v1/contests/{slug}/virtual`
   * @endpoint POST /api/v1/contests/{slug}/virtual
   * @param {string} slugOrId
   * @param {string} userId
   * @param {number} [durationMinutes=120]
   * @returns {Promise<object>} session
   */
  async startVirtualContest(slugOrId, userId, durationMinutes = 120) {
    const contest = await resolveContest(slugOrId);
    if (!userId) throw new Error('userId required');
    const session = createVirtualSession(contest.id, userId, durationMinutes);
    await db.put('virtual_sessions', session);
    return session;
  },

  /**
   * Lấy trạng thái và bảng xếp hạng phiên thi ảo
   * @endpoint GET /api/v1/virtual-sessions/{sessionId}
   * @param {string} sessionId
   * @returns {Promise<object>}
   */
  async getVirtualState(sessionId) {
    if (!sessionId) throw new Error('sessionId required');
    const session = await db.get('virtual_sessions', sessionId);
    if (!session) throw new Error('Virtual session not found: ' + sessionId);

    const elapsed = getVirtualElapsedMinutes(session);
    const contest = await db.get('contests', session.contestId);
    const user = await db.get('users', session.userId);
    const allSubs = await db.getAll('submissions');
    const ghostSubs = allSubs.filter(s => s.contest_id === session.contestId && s.user_id !== session.userId);
    const virtualSubs = allSubs.filter(s => s.contest_id === session.contestId && s.user_id === session.userId);
    const problems = await db.query('problems', p => p.contest_id === session.contestId);

    const standings = calculateVirtualStandings({
      virtualUser: user,
      virtualSubmissions: virtualSubs,
      ghostSubmissions: ghostSubs,
      elapsedMinutes: elapsed,
      problems
    });

    const isFinished = elapsed >= session.durationMinutes;
    if (isFinished && !session.isFinished) {
      session.isFinished = true;
      await db.put('virtual_sessions', session);
    }

    return {
      session,
      contest,
      elapsedMinutes: elapsed,
      remainingMinutes: Math.max(0, session.durationMinutes - elapsed),
      isFinished,
      standings
    };
  },
};

export default api;

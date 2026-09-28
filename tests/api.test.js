import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/db/api.js';
import { db, ensureSeeded } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import {
  ROLES,
  PRESET_USERS,
  getCurrentUser,
  setCurrentUser,
  switchRole,
  getAuthHeaders
} from '../src/core/auth.js';

async function resetSeed() {
  for (const t of ['users','contests','problems','submissions','discussions','clans','testcases','contest_participants','analytics','virtual_sessions']) {
    await db.clear(t);
  }
  await ensureSeeded(seedDatabase);
}

describe('Crew-G Contract — api.getCurrentContest (GET /api/v1/contests filter CODING)', () => {
  beforeEach(async () => {
    await resetSeed();
  });

  it('trả về contest đang CODING', async () => {
    const cur = await api.getCurrentContest();
    assert.ok(cur, 'getCurrentContest should return a contest');
    assert.equal(cur.status, 'CODING');
    assert.equal(cur.id, 'contest_dever_round1');
    assert.equal(cur.slug, 'dever-round-1-div3');
  });

  it('trả về null khi không có contest CODING', async () => {
    const contest = await db.get('contests', 'contest_dever_round1');
    const origStatus = contest.status;
    contest.status = 'FINISHED';
    await db.put('contests', contest);
    const cur = await api.getCurrentContest();
    assert.equal(cur, null);
    // restore
    contest.status = origStatus;
    await db.put('contests', contest);
    const cur2 = await api.getCurrentContest();
    assert.ok(cur2, 'should restore CODING');
  });

  it('alias tương đương với GET /api/v1/contests filter', async () => {
    const all = await api.getContests();
    const cur = await api.getCurrentContest();
    assert.ok(all.find(c => c.id === cur.id));
  });
});

describe('Crew-G Contract — api.registerContest & api.getContestParticipants (POST /api/v1/contests/{slug}/register)', () => {
  beforeEach(async () => {
    await resetSeed();
  });

  it('registerContest ghi contest_participants với id = contestId:userId', async () => {
    const newUserId = 'user_test_register_1';
    await db.put('users', { id: newUserId, username: 'test_reg_1', email: 't1@fpt.edu.vn', password_hash:'mock', full_name:'Test 1', clan_id:null, rating:1500, max_rating:1500, rank_tier:'Specialist', role:'PARTICIPANT' });
    const rec = await api.registerContest('contest_dever_round1', newUserId);
    assert.equal(rec.contest_id, 'contest_dever_round1');
    assert.equal(rec.user_id, newUserId);
    assert.equal(rec.id, 'contest_dever_round1:'+newUserId);
    // verify persisted
    const fromDb = await db.get('contest_participants', rec.id);
    assert.deepEqual(fromDb, rec);
    // also via getContestParticipants
    const list = await api.getContestParticipants('contest_dever_round1');
    assert.ok(list.some(p => p.user_id === newUserId));
    await db.delete('contest_participants', rec.id);
    await db.delete('users', newUserId);
  });

  it('registerContest hỗ trợ slug thay vì id', async () => {
    const uid = 'user_slug_test';
    await db.put('users', { id: uid, username: 'slug_test', email:'s@fpt.edu.vn', password_hash:'mock', full_name:'Slug', clan_id:null, rating:1500, max_rating:1500, rank_tier:'Specialist', role:'PARTICIPANT'});
    const rec = await api.registerContest('dever-round-1-div3', uid);
    assert.equal(rec.contest_id, 'contest_dever_round1');
    assert.ok(!('room_id' in rec), 'không còn phân phòng (ADR-005)');
    await db.delete('contest_participants', rec.id);
    await db.delete('users', uid);
  });

  it('registerContest idempotent khi đăng ký lại', async () => {
    const uid = 'user_autoroom_test';
    await db.put('users', { id: uid, username:'autoroom', email:'a@fpt.edu.vn', password_hash:'mock', full_name:'Auto', clan_id:null, rating:1500, max_rating:1500, rank_tier:'Specialist', role:'PARTICIPANT'});
    const first = await api.registerContest('contest_dever_round1', uid);
    const second = await api.registerContest('contest_dever_round1', uid);
    // idempotent: trả về cùng record
    assert.equal(second.id, first.id);
    await db.delete('contest_participants', first.id);
    await db.delete('users', uid);
  });

  it('registerContest throw khi thiếu contestId hoặc userId', async () => {
    await assert.rejects(() => api.registerContest(null, 'u1'), /contestId required/);
    await assert.rejects(() => api.registerContest('contest_dever_round1', null), /userId required/);
    await assert.rejects(() => api.registerContest('', 'u1'), /contestId required/);
  });

  it('getContestParticipants trả về danh sách participants theo contestId và hỗ trợ slug', async () => {
    const listById = await api.getContestParticipants('contest_dever_round1');
    assert.ok(Array.isArray(listById));
    assert.ok(listById.length >= 4, 'seed has 4 participants');
    assert.ok(listById.every(p => p.contest_id === 'contest_dever_round1'));
    const listBySlug = await api.getContestParticipants('dever-round-1-div3');
    assert.equal(listBySlug.length, listById.length);
    // compare ids
    const ids1 = listById.map(p=>p.id).sort();
    const ids2 = listBySlug.map(p=>p.id).sort();
    assert.deepEqual(ids1, ids2);
  });

  it('getContestParticipants throw khi thiếu contestId', async () => {
    await assert.rejects(() => api.getContestParticipants(null), /contestId required/);
    await assert.rejects(() => api.getContestParticipants(''), /contestId required/);
  });

  it('registerContest tương thích với registerForContest (cùng storage)', async () => {
    const uid = 'user_compat_test';
    await db.put('users', { id: uid, username:'compat', email:'c@fpt.edu.vn', password_hash:'mock', full_name:'Compat', clan_id:null, rating:1500, max_rating:1500, rank_tier:'Specialist', role:'PARTICIPANT'});
    const viaNew = await api.registerContest('contest_dever_round1', uid);
    // old method should find existing
    const viaOld = await api.registerForContest('contest_dever_round1', uid);
    assert.equal(viaOld.id, viaNew.id);
    await db.delete('contest_participants', viaNew.id);
    await db.delete('users', uid);
  });
});

describe('Crew-G Contract — auth.getAuthHeaders (Authorization: Bearer mock-*)', () => {
  beforeEach(() => {
    switchRole(ROLES.PARTICIPANT);
  });

  it("trả về { Authorization: 'Bearer mock-'+user.id } cho user hiện tại", () => {
    switchRole(ROLES.PARTICIPANT);
    const user = getCurrentUser();
    const headers = getAuthHeaders();
    assert.deepEqual(headers, { Authorization: `Bearer mock-${user.id}` });
    assert.equal(headers.Authorization, 'Bearer mock-usr_participant');
  });

  it('trả về header đúng cho user truyền vào (ADMIN/GUEST)', () => {
    const admin = PRESET_USERS[ROLES.ADMIN];
    assert.deepEqual(getAuthHeaders(admin), { Authorization: `Bearer mock-${admin.id}` });
    assert.equal(getAuthHeaders(admin).Authorization, 'Bearer mock-usr_admin');

    const guest = PRESET_USERS[ROLES.GUEST];
    assert.deepEqual(getAuthHeaders(guest), { Authorization: `Bearer mock-${guest.id}` });
    assert.equal(getAuthHeaders(guest).Authorization, 'Bearer mock-usr_guest');

    const custom = { id: 'user_hoang_nam_se18000', username: 'hoang_nam', role: 'PARTICIPANT' };
    assert.deepEqual(getAuthHeaders(custom), { Authorization: 'Bearer mock-user_hoang_nam_se18000' });
  });

  it('fallback dùng getCurrentUser khi không truyền param và trả {} nếu user không có id', () => {
    const headers = getAuthHeaders(getCurrentUser());
    assert.ok(headers.Authorization.startsWith('Bearer mock-'));
    // user không có id -> {}
    assert.deepEqual(getAuthHeaders({ username:'no_id', role:'PARTICIPANT' }), {});
    assert.deepEqual(getAuthHeaders(null), { Authorization: `Bearer mock-${getCurrentUser().id}` });
  });

  it('header sẵn sàng để thay bằng JWT thật (chỉ đổi body)', () => {
    // simulate future JWT replacement: frontend sẽ làm
    // const token = localStorage.getItem('access_token')
    // getAuthHeaders should mirror that pattern
    const user = getCurrentUser();
    const mockHeaders = getAuthHeaders(user);
    // check format exactly "Bearer mock-<id>"
    assert.match(mockHeaders.Authorization, /^Bearer mock-/);
    // ensure no extra keys
    assert.equal(Object.keys(mockHeaders).length, 1);
  });
});

describe('Crew-G Contract — Division Eligibility Gate (Rating Constraints)', () => {
  beforeEach(async () => {
    await resetSeed();
  });

  it('từ chối thí sinh rating < 1900 khi đăng ký Div. 1', async () => {
    // user_me có rating 1540
    await assert.rejects(
      () => api.registerContest('contest_dever_round2_div1', 'user_me'),
      /Rating 1540 không đủ điều kiện/
    );
  });

  it('cho phép thí sinh rating >= 1900 đăng ký Div. 1', async () => {
    // c1 (phuc_k19_icpc) có rating 1985
    const rec = await api.registerContest('contest_dever_round2_div1', 'c1');
    assert.equal(rec.contest_id, 'contest_dever_round2_div1');
    assert.equal(rec.user_id, 'c1');
  });

  it('từ chối thí sinh rating > 1899 khi đăng ký Div. 2', async () => {
    // c1 có rating 1985 > 1899
    await assert.rejects(
      () => api.registerContest('contest_dever_round2_div2', 'c1'),
      /Rating 1985 vượt quá giới hạn/
    );
  });
});

describe('Crew-G Contract — Virtual Contest API', () => {
  beforeEach(async () => {
    await resetSeed();
  });

  it('api.startVirtualContest tạo phiên thi ảo và lưu vào DB', async () => {
    const session = await api.startVirtualContest('contest_dever_archive', 'user_me', 120);
    assert.ok(session);
    assert.equal(session.contestId, 'contest_dever_archive');
    assert.equal(session.userId, 'user_me');
    assert.equal(session.durationMinutes, 120);

    const saved = await db.get('virtual_sessions', session.id);
    assert.ok(saved);
    assert.equal(saved.id, session.id);
  });

  it('api.getVirtualState trả về trạng thái phiên ảo và standings lọc ghost submissions', async () => {
    const session = await api.startVirtualContest('contest_dever_archive', 'user_me', 120);
    const state = await api.getVirtualState(session.id);

    assert.ok(state);
    assert.equal(state.session.id, session.id);
    assert.equal(state.isFinished, false);
    assert.ok(Array.isArray(state.standings));
  });
});


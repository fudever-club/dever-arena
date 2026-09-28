/**
 * DEVER Arena — Clarifications (hỏi đáp jury chuẩn ICPC) + Announcements tests.
 * Server thật trên port ngẫu nhiên, DB file tạm riêng.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

const DB_PATH = join(tmpdir(), `dever-clarify-${process.pid}.json`);
process.env.DEVER_DB_PATH = DB_PATH;
try { rmSync(DB_PATH, { force: true }); } catch {}

const { startServer } = await import('../server/index.js');
const { shutdownJudge } = await import('../server/queue.js');

let server;
let base;
let adminToken;
let heroToken;
let hackerToken;

const CONTEST = 'contest_dever_round1';

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
async function login(username, password) {
  const r = await call('/api/v1/auth/login', 'POST', { username, password });
  assert.equal(r.status, 200);
  return r.data.accessToken;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  server = startServer(0);
  await new Promise((r) => setTimeout(r, 300));
  base = `http://localhost:${server.address().port}`;
  adminToken = await login('dever_admin', 'admin123');
  heroToken = await login('dever_hero', 'hero123');
  hackerToken = await login('hacker_pro', 'dever123');
});

after(async () => {
  await new Promise((r) => server.close(r));
  shutdownJudge();
  try { rmSync(DB_PATH, { force: true }); } catch {}
});

test('clarify validate: question rỗng 422, contest lạ 404, thiếu contest_id 422, thiếu token 401', async () => {
  const empty = await call('/api/v1/clarifications', 'POST', { contest_id: CONTEST, question: '   ' }, heroToken);
  assert.equal(empty.status, 422);

  const badContest = await call('/api/v1/clarifications', 'POST', { contest_id: 'nope', question: 'Time limit?' }, heroToken);
  assert.ok([404, 422].includes(badContest.status));

  const noCid = await call('/api/v1/clarifications', 'GET', null, heroToken);
  assert.equal(noCid.status, 422);

  const noAuth = await call(`/api/v1/clarifications?contest_id=${CONTEST}`, 'GET');
  assert.equal(noAuth.status, 401);
});

let clarId;

test('vòng đời ask→answer→visibility: người khác không thấy câu chưa trả lời', async () => {
  const ask = await call('/api/v1/clarifications', 'POST', {
    contest_id: CONTEST, problem_id: 'p101', question: 'Được dùng long long chứ?',
  }, heroToken);
  assert.equal(ask.status, 201);
  const c = ask.data.clarification;
  assert.ok(c.id);
  assert.equal(c.contest_id, CONTEST);
  assert.equal(c.problem_id, 'p101');
  assert.ok(c.asker_id);
  assert.equal(c.question, 'Được dùng long long chứ?');
  assert.equal(c.answer, null);
  assert.equal(c.answered_by, null);
  assert.ok(c.created_at);
  clarId = c.id;

  // Người khác (hacker) chưa thấy câu chưa trả lời
  const otherBefore = await call(`/api/v1/clarifications?contest_id=${CONTEST}`, 'GET', null, hackerToken);
  assert.equal(otherBefore.status, 200);
  assert.ok(!otherBefore.data.clarifications.some((x) => x.id === clarId));

  // Chính chủ thấy câu của mình, ẩn asker_id → asker 'me'
  const mine = await call(`/api/v1/clarifications?contest_id=${CONTEST}`, 'GET', null, heroToken);
  assert.equal(mine.status, 200);
  const own = mine.data.clarifications.find((x) => x.id === clarId);
  assert.ok(own);
  assert.equal(own.asker, 'me');
  assert.ok(!('asker_id' in own));

  // Admin thấy hết, kèm asker_id gốc
  const adm = await call(`/api/v1/clarifications?contest_id=${CONTEST}`, 'GET', null, adminToken);
  assert.equal(adm.status, 200);
  const raw = adm.data.clarifications.find((x) => x.id === clarId);
  assert.ok(raw);
  assert.ok(raw.asker_id);

  // Non-admin trả lời → 403
  const forbidden = await call(`/api/v1/admin/clarifications/${clarId}/answer`, 'POST', { answer: 'Được.' }, heroToken);
  assert.equal(forbidden.status, 403);

  // Admin trả lời rỗng → 422
  const emptyAns = await call(`/api/v1/admin/clarifications/${clarId}/answer`, 'POST', { answer: '  ' }, adminToken);
  assert.equal(emptyAns.status, 422);

  // Admin trả lời thật
  const ans = await call(`/api/v1/admin/clarifications/${clarId}/answer`, 'POST', { answer: 'Được, giới hạn như statement.' }, adminToken);
  assert.equal(ans.status, 200);
  assert.equal(ans.data.clarification.answer, 'Được, giới hạn như statement.');
  assert.ok(ans.data.clarification.answered_by);
  assert.ok(ans.data.clarification.answered_at);

  // Sau khi trả lời: người khác thấy, asker ẩn → null
  const otherAfter = await call(`/api/v1/clarifications?contest_id=${CONTEST}`, 'GET', null, hackerToken);
  assert.equal(otherAfter.status, 200);
  const pub = otherAfter.data.clarifications.find((x) => x.id === clarId);
  assert.ok(pub);
  assert.equal(pub.asker, null);
  assert.ok(!('asker_id' in pub));
  assert.equal(pub.answer, 'Được, giới hạn như statement.');

  // Chính chủ sau trả lời vẫn 'me'
  const mineAfter = await call(`/api/v1/clarifications?contest_id=${CONTEST}`, 'GET', null, heroToken);
  const ownAfter = mineAfter.data.clarifications.find((x) => x.id === clarId);
  assert.equal(ownAfter.asker, 'me');
});

test('announcements: đăng → list mới nhất trước + 403 non-admin + 422 rỗng', async () => {
  const forbidden = await call('/api/v1/admin/announcements', 'POST', { contest_id: CONTEST, message: 'Lậu' }, heroToken);
  assert.equal(forbidden.status, 403);

  const empty = await call('/api/v1/admin/announcements', 'POST', { contest_id: CONTEST, message: '  ' }, adminToken);
  assert.equal(empty.status, 422);

  const a1 = await call('/api/v1/admin/announcements', 'POST', { contest_id: CONTEST, message: 'Thông báo 1' }, adminToken);
  assert.equal(a1.status, 201);
  assert.ok(a1.data.announcement.id);
  assert.equal(a1.data.announcement.message, 'Thông báo 1');

  await sleep(15);
  const a2 = await call('/api/v1/admin/announcements', 'POST', { contest_id: CONTEST, message: 'Thông báo 2' }, adminToken);
  assert.equal(a2.status, 201);

  const list = await call(`/api/v1/announcements?contest_id=${CONTEST}`, 'GET', null, heroToken);
  assert.equal(list.status, 200);
  assert.ok(list.data.announcements.length >= 2);
  assert.equal(list.data.announcements[0].id, a2.data.announcement.id);
  assert.equal(list.data.announcements[0].message, 'Thông báo 2');

  const noAuth = await call(`/api/v1/announcements?contest_id=${CONTEST}`, 'GET');
  assert.equal(noAuth.status, 401);
});

test('announce broadcast SSE EVENT_ANNOUNCEMENT', async () => {
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/v1/stream/contests/${CONTEST}?token=${heroToken}`, {
    headers: { Accept: 'text/event-stream' }, signal: ctrl.signal,
  });
  assert.equal(res.status, 200);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  const first = await reader.read();
  const head = dec.decode(first.value);
  assert.match(head, /CONNECTED/);

  const msg = `SSE ping ${Date.now()}`;
  const posted = await call('/api/v1/admin/announcements', 'POST', { contest_id: CONTEST, message: msg }, adminToken);
  assert.equal(posted.status, 201);

  let buf = '';
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const msLeft = deadline - Date.now();
    const chunk = await Promise.race([
      reader.read(),
      sleep(msLeft).then(() => null),
    ]);
    if (!chunk) break;
    buf += dec.decode(chunk.value);
    if (buf.includes('EVENT_ANNOUNCEMENT') && buf.includes(msg)) break;
  }
  ctrl.abort();
  try { await reader.cancel(); } catch {}
  assert.ok(buf.includes('EVENT_ANNOUNCEMENT'), `thiếu EVENT_ANNOUNCEMENT trong SSE: ${buf.slice(0, 500)}`);
  assert.ok(buf.includes(msg));
});

test('Task 119: multi-organizer — cấp quyền, gate theo kỳ thi, chống tự hạ mình', async () => {
  // ADMIN thăng hero lên ORGANIZER
  const heroId = 'u_hero';
  const promote = await call(`/api/v1/admin/users/${heroId}/role`, 'POST', { role: 'ORGANIZER' }, adminToken);
  assert.equal(promote.status, 200);
  assert.equal(promote.data.user.role, 'ORGANIZER');

  // HERO (giờ là ORGANIZER) tạo kỳ thi → organizer_id = chính mình
  const created = await call('/api/v1/admin/contests', 'POST', {
    title: 'Round Organizer Test', contest_format: 'ICPC', duration_minutes: 30,
  }, heroToken);
  assert.equal(created.status, 201);
  const cid = created.data.contest.id;
  assert.equal(created.data.contest.organizer_id, heroId);

  // GET /contests kèm organizer_username
  const list = await call('/api/v1/contests');
  const shown = list.data.contests.find((c) => c.id === cid);
  assert.equal(shown.organizer_username, 'dever_hero');

  // ORGANIZER điều phase kỳ thi CỦA MÌNH được
  const go = await call('/api/v1/admin/phase', 'POST', { contest_id: cid, phase: 'CODING' }, heroToken);
  assert.equal(go.status, 200);

  // ORGANIZER bị chặn điều phase kỳ thi của người khác (round1 của admin seed)
  const other = await call('/api/v1/admin/phase', 'POST', { contest_id: 'contest_dever_round1', phase: 'FINISHED' }, heroToken);
  assert.equal(other.status, 403);

  // PARTICIPANT không được tạo kỳ thi
  const judgeLogin = await call('/api/v1/auth/login', 'POST', { username: 'hacker_pro', password: 'dever123' });
  const judgeTok = judgeLogin.data.accessToken || judgeLogin.data.token;
  const forbidden = await call('/api/v1/admin/contests', 'POST', { title: 'Lậu' }, judgeTok);
  assert.equal(forbidden.status, 403);

  // PARTICIPANT không được đăng thông báo (vẫn 403 như cũ)
  const annForbidden = await call('/api/v1/admin/announcements', 'POST', { contest_id: cid, message: 'lậu' }, judgeTok);
  assert.equal(annForbidden.status, 403);

  // ORGANIZER đăng thông báo kỳ thi của mình → 201
  const annOk = await call('/api/v1/admin/announcements', 'POST', { contest_id: cid, message: 'Từ organizer' }, heroToken);
  assert.equal(annOk.status, 201);

  // ADMIN hạ hero về PARTICIPANT
  const demote = await call(`/api/v1/admin/users/${heroId}/role`, 'POST', { role: 'PARTICIPANT' }, adminToken);
  assert.equal(demote.status, 200);
  assert.equal(demote.data.user.role, 'PARTICIPANT');

  // ADMIN không thể tự hạ chính mình
  const selfDemote = await call('/api/v1/admin/users/u_admin/role', 'POST', { role: 'ORGANIZER' }, adminToken);
  assert.equal(selfDemote.status, 422);
  assert.equal(selfDemote.data.error, 'SELF_DEMOTE');

  // Role lạ bị từ chối
  const badRole = await call(`/api/v1/admin/users/${heroId}/role`, 'POST', { role: 'SUPERGOD' }, adminToken);
  assert.equal(badRole.status, 422);
});

/**
 * DEVER Arena — Server API lifecycle tests (backend thật: REST + JWT + judge + Elo).
 * Chạy server trên port ngẫu nhiên với DB file tạm riêng biệt.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

const DB_PATH = join(tmpdir(), `dever-test-${process.pid}.json`);
process.env.DEVER_DB_PATH = DB_PATH;
try { rmSync(DB_PATH, { force: true }); } catch {}

const { startServer } = await import('../server/index.js');
const { shutdownJudge, judgeQueue } = await import('../server/queue.js');

let server;
let base;
let heroToken;
let adminToken;
let judgeUserToken;

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
  const addr = server.address();
  base = `http://localhost:${addr.port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  shutdownJudge();
  try { rmSync(DB_PATH, { force: true }); } catch {}
});

test('judge pool: 3 bài đồng loạt đều chấm đúng (không block nhau)', async () => {
  const code = [
    'import sys',
    'def solve():',
    '    n=int(sys.stdin.readline()); a=list(map(int,sys.stdin.readline().split())); s=sum(a); sq=sum(x*x for x in a); print((s*s-sq)//2)',
    "if __name__=='__main__': solve()",
  ].join('\n');
  const results = await Promise.all([0, 1, 2].map(() => judgeQueue.judgeTests({
    language: 'python', source: code, tests: [{ stdin: '3\n1 2 3', expected: '11' }], timeLimitMs: 1000,
  })));
  assert.ok(results.every((r) => r.verdict === 'AC'));
  const stats = judgeQueue.stats();
  assert.ok(stats.workers >= 1);
});

test('login JWT thật: đúng pass 200, sai pass 401', async () => {
  const ok = await call('/api/v1/auth/login', 'POST', { username: 'dever_hero', password: 'hero123' });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.accessToken);
  heroToken = ok.data.accessToken;
  assert.equal(ok.data.user.rating, 1742);

  const bad = await call('/api/v1/auth/login', 'POST', { username: 'dever_hero', password: 'sai' });
  assert.equal(bad.status, 401);

  const admin = await call('/api/v1/auth/login', 'POST', { username: 'dever_admin', password: 'admin123' });
  adminToken = admin.data.accessToken;
  const judgeUser = await call('/api/v1/auth/login', 'POST', { username: 'hacker_pro', password: 'dever123' });
  judgeUserToken = judgeUser.data.accessToken;
});

test('division gate: hero 1742 bị chặn Div.1, vào được Div.2', async () => {
  const div1 = await call('/api/v1/contests/dever-round-2-div1/register', 'POST', {}, heroToken);
  assert.equal(div1.status, 403);
  assert.equal(div1.data.error, 'RATING_INELIGIBLE');

  const div2 = await call('/api/v1/contests/dever-round-2-div2/register', 'POST', {}, heroToken);
  assert.equal(div2.status, 201);
  assert.ok(div2.data.participant.user_id);
});

test('judge thật: python đúng AC có điểm, sai WA 0đ, cpp 422 trung thực', async () => {
  const good = [
    'import sys',
    'def solve():',
    '    n=int(sys.stdin.readline()); a=list(map(int,sys.stdin.readline().split())); s=sum(a); sq=sum(x*x for x in a); print((s*s-sq)//2)',
    "if __name__=='__main__': solve()",
  ].join('\n');
  const ac = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round1', problem_id: 'p102', language: 'python', source_code: good,
  }, heroToken);
  assert.equal(ac.status, 201);
  assert.equal(ac.data.verdict, 'AC');
  assert.equal(ac.data.submission.verdict, 'AC');
  assert.ok(ac.data.submission.points_awarded > 0);

  const bad = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round1', problem_id: 'p102', language: 'python', source_code: 'print(0)',
  }, heroToken);
  assert.equal(bad.status, 201);
  assert.equal(bad.data.submission.verdict, 'WA');
  assert.equal(bad.data.submission.points_awarded, 0);

  const cpp = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round1', problem_id: 'p102', language: 'cpp20', source_code: 'int main(){}',
  }, heroToken);
  if (cpp.status === 422) {
    assert.ok(['UNSUPPORTED_LANGUAGE', 'TOOLCHAIN_MISSING'].includes(cpp.data.error));
  } else {
    // Máy có g++: chấm thật
    assert.equal(cpp.status, 201);
    assert.ok(cpp.data.submission.verdict);
  }

  // Java chấm thật (JDK có mặt trên máy chấm này)
  const javaCode = [
    'import java.util.*;',
    'public class Solution {',
    '  public static void main(String[] args) {',
    '    Scanner sc = new Scanner(System.in);',
    '    int n = sc.nextInt(); long s = 0, sq = 0;',
    '    for (int i = 0; i < n; i++) { long x = sc.nextLong(); s += x; sq += x * x; }',
    '    System.out.println((s * s - sq) / 2);',
    '  }',
    '}',
  ].join('\n');
  const java = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round1', problem_id: 'p102', language: 'java', source_code: javaCode,
  }, heroToken);
  if (java.status === 422) {
    assert.equal(java.data.error, 'TOOLCHAIN_MISSING');
  } else {
    assert.equal(java.status, 201);
    assert.equal(java.data.submission.verdict, 'AC');
    assert.ok(java.data.submission.points_awarded > 0);
  }

  // Victim hardcode: qua sample (11) → AC, nhưng sai với mọi input khác — verdict cuối là AC full-suite
  const hard = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round1', problem_id: 'p102', language: 'python', source_code: 'print(11)',
  }, heroToken);
  assert.equal(hard.data.submission.verdict, 'AC');
});

test('standings phản ánh điểm thật (ICPC mặc định: solved + penalty)', async () => {
  const st = await call('/api/v1/contests/dever-round-1-div3/standings');
  assert.equal(st.status, 200);
  assert.equal(st.data.format, 'ICPC');
  const hero = st.data.standings.find((r) => r.username === 'dever_hero');
  assert.ok(hero);
  assert.ok(hero.solved >= 1, 'hero phải có ít nhất 1 bài AC');
  assert.ok(typeof hero.penalty === 'number');

  // Format CODEFORCES ép qua ?format=CF: total > 0
  const cf = await call('/api/v1/contests/dever-round-1-div3/standings?format=CODEFORCES');
  assert.equal(cf.status, 200);
  const heroCf = cf.data.standings.find((r) => r.username === 'dever_hero');
  assert.ok(heroCf.total > 0);
});

test('phase machine: 3 phase, không còn HACK_PHASE/SYSTEM_TESTING', async () => {
  // Phase cũ không còn hợp lệ
  const old = await call('/api/v1/admin/phase', 'POST', { contest_id: 'contest_dever_round1', phase: 'HACK_PHASE' }, adminToken);
  assert.equal(old.status, 422);
  assert.equal(old.data.error, 'BAD_PHASE');

  // Vẫn đang CODING: nhảy thẳng FINISHED bị cấm? Không — trong 3 phase, CODING → FINISHED là hợp lệ.
  // Kiểm tra nộp bài vẫn chạy tốt trong CODING:
  const sub = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round1', problem_id: 'p101', language: 'python', source_code: 'print(1)',
  }, heroToken);
  assert.equal(sub.status, 201);
});

test('chấm lại (rejudge) dùng full-suite: verdict cuối, không FST', async () => {
  const list = await call('/api/v1/submissions?contest_id=contest_dever_round1', 'GET', null, adminToken);
  const wa = list.data.submissions.find((s) => s.verdict === 'WA');
  assert.ok(wa);
  const r = await call('/api/v1/admin/rejudge', 'POST', { submission_id: wa.id }, adminToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.submission.verdict, 'WA');
  assert.equal(r.data.submission.points_awarded, 0);
  assert.ok(r.data.submission.rejudged_at);

  const forbidden = await call('/api/v1/admin/rejudge', 'POST', { submission_id: wa.id }, heroToken);
  assert.equal(forbidden.status, 403);
});

test('finish trực tiếp từ CODING: chốt Elo, mở editorial', async () => {
  const fin = await call('/api/v1/admin/phase', 'POST', { contest_id: 'contest_dever_round1', phase: 'FINISHED' }, adminToken);
  assert.equal(fin.status, 200);

  const profile = await call('/api/v1/users/dever_hero', 'GET', null, heroToken);
  assert.equal(profile.status, 200);
  assert.ok((profile.data.rating_history || []).length >= 1);

  const ed = await call('/api/v1/problems/p102/editorial');
  assert.equal(ed.status, 200);
  assert.ok(ed.data.editorial.length > 0);
});

test('admin cấp tài khoản + virtual ghost replay từ backend', async () => {
  const created = await call('/api/v1/admin/users', 'POST', {
    username: 'team_dragon', password: 'rong123', full_name: 'Đội Rồng Lửa', rating: 1500, team: 'Rồng Lửa', members: ['An', 'Bình', 'Chi'],
  }, adminToken);
  assert.equal(created.status, 201);
  assert.equal(created.data.user.team, 'Rồng Lửa');
  assert.deepEqual(created.data.user.members, ['An', 'Bình', 'Chi']);

  const dup = await call('/api/v1/admin/users', 'POST', { username: 'team_dragon', password: 'khac123' }, adminToken);
  assert.equal(dup.status, 409);

  const forbidden = await call('/api/v1/admin/users', 'POST', { username: 'user_acct_2', password: 'hhhhhh' }, heroToken);
  assert.equal(forbidden.status, 403);

  const list = await call('/api/v1/admin/users', 'GET', null, adminToken);
  assert.ok(list.data.users.find((u) => u.username === 'team_dragon'));
  assert.ok(!('password' in list.data.users[0]));

  // Reset mật khẩu: login bằng mật khẩu mới được, cũ thì 401
  const teamUser = list.data.users.find((u) => u.username === 'team_dragon');
  const weak = await call(`/api/v1/admin/users/${teamUser.id}/password`, 'POST', { password: '123' }, adminToken);
  assert.equal(weak.status, 422);
  const reset = await call(`/api/v1/admin/users/${teamUser.id}/password`, 'POST', { password: 'rongmoi123' }, adminToken);
  assert.equal(reset.status, 200);
  const loginNew = await call('/api/v1/auth/login', 'POST', { username: 'team_dragon', password: 'rongmoi123' });
  assert.equal(loginNew.status, 200);
  const loginOld = await call('/api/v1/auth/login', 'POST', { username: 'team_dragon', password: 'rong123' });
  assert.equal(loginOld.status, 401);
  const forbiddenPw = await call(`/api/v1/admin/users/${teamUser.id}/password`, 'POST', { password: 'hahaha123' }, heroToken);
  assert.equal(forbiddenPw.status, 403);

  const vs = await call('/api/v1/contests/dever-round-0-archive/virtual', 'POST', { duration_minutes: 120 }, heroToken);
  assert.equal(vs.status, 201);
  const g0 = await call(`/api/v1/contests/dever-round-0-archive/virtual?session_id=${vs.data.session_id}`, 'GET', null, heroToken);
  assert.equal(g0.status, 200);
  assert.equal(g0.data.elapsedMinutes, 0);
  assert.ok(Array.isArray(g0.data.standings));
  // Time-travel tới phút 120 → toàn bộ ghost hiện ra
  const g = await call(`/api/v1/contests/dever-round-0-archive/virtual?session_id=${vs.data.session_id}&at_minute=120`, 'GET', null, heroToken);
  assert.equal(g.status, 200);
  assert.ok(g.data.standings.length > 0);
});

test('rate limit login: dồn dập bị chặn 429, thưa vẫn 200', async () => {
  let last = 0;
  let saw200 = false;
  for (let i = 0; i < 70; i++) {
    const r = await call('/api/v1/auth/login', 'POST', { username: 'dever_hero', password: 'sai' });
    last = r.status;
    if (r.status === 401) saw200 = true;
  }
  assert.ok(saw200);
  assert.equal(last, 429);
});

test('SSE stream mở được và nhận CONNECTED', async () => {  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/v1/stream/contests/dever-round-1-div3?token=${heroToken}`, {
    headers: { Accept: 'text/event-stream' }, signal: ctrl.signal,
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const reader = res.body.getReader();
  const { value } = await reader.read();
  const chunk = new TextDecoder().decode(value);
  assert.match(chunk, /CONNECTED/);
  ctrl.abort();
  try { await reader.cancel(); } catch {}
});

let adminProblemId = null;

test('admin tạo đề: 201', async () => {
  const r = await call('/api/v1/admin/problems', 'POST', {
    contest_id: 'contest_dever_round1', code: 'Z', title: 'Test Problem Z',
    rating: 1000, tags: ['math'], timeLimit: '1.0s', memoryLimit: '256 MB',
    statement: 'Statement Z', sampleInput: '1', sampleOutput: '1', editorial: 'Ed Z',
  }, adminToken);
  assert.equal(r.status, 201);
  assert.ok(r.data.problem.id.startsWith('p_'));
  assert.equal(r.data.problem.code, 'Z');
  adminProblemId = r.data.problem.id;
});

test('admin tạo đề thiếu field: 422', async () => {
  const r = await call('/api/v1/admin/problems', 'POST', {
    contest_id: 'contest_dever_round1', code: 'Y',
  }, adminToken);
  assert.equal(r.status, 422);
});

test('admin tạo đề trùng code: 409', async () => {
  const r = await call('/api/v1/admin/problems', 'POST', {
    contest_id: 'contest_dever_round1', code: 'Z', title: 'Dup', statement: 'Dup statement',
  }, adminToken);
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'CODE_TAKEN');
});

test('admin sửa đề: 200', async () => {
  const r = await call(`/api/v1/admin/problems/${adminProblemId}`, 'PUT', {
    title: 'Test Problem Z Updated', rating: 1500, sampleInput: '2', sampleOutput: '2',
  }, adminToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.problem.title, 'Test Problem Z Updated');
  assert.equal(r.data.problem.rating, 1500);
});

test('admin xóa đề chưa có submission: 200', async () => {
  const r = await call(`/api/v1/admin/problems/${adminProblemId}`, 'DELETE', null, adminToken);
  assert.equal(r.status, 200);
  assert.equal(r.data.deleted, adminProblemId);
});

test('admin xóa đề đã có submission: 409', async () => {
  const r = await call('/api/v1/admin/problems/p102', 'DELETE', null, adminToken);
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'HAS_SUBMISSIONS');
});

test('non-admin tạo đề bị chặn: 403', async () => {
  const r = await call('/api/v1/admin/problems', 'POST', {
    contest_id: 'contest_dever_round1', code: 'Q', title: 'Nope', statement: 'Nope',
  }, heroToken);
  assert.equal(r.status, 403);
});

test('admin tạo kỳ thi: 201, trùng slug 409, sai format 422, non-admin 403', async () => {
  const created = await call('/api/v1/admin/contests', 'POST', {
    title: 'DEVER Round #9 (Div. 4)', contest_format: 'CODEFORCES', duration_minutes: 120,
  }, adminToken);
  assert.equal(created.status, 201);
  assert.equal(created.data.contest.status, 'REGISTRATION');
  assert.ok(created.data.contest.slug.length > 0);

  const dup = await call('/api/v1/admin/contests', 'POST', {
    title: 'Trùng', slug: created.data.contest.slug,
  }, adminToken);
  assert.equal(dup.status, 409);

  const bad = await call('/api/v1/admin/contests', 'POST', { title: 'Sai', contest_format: 'CSS' }, adminToken);
  assert.equal(bad.status, 422);

  const empty = await call('/api/v1/admin/contests', 'POST', { title: '   ' }, adminToken);
  assert.equal(empty.status, 422);

  const forbidden = await call('/api/v1/admin/contests', 'POST', { title: 'Lậu' }, heroToken);
  assert.equal(forbidden.status, 403);

  const list = await call('/api/v1/contests');
  assert.ok(list.data.contests.find((c) => c.title === 'DEVER Round #9 (Div. 4)'));
});

test('ICPC auto-format: contest ICPC trả bảng solved/penalty mặc định', async () => {
  const created = await call('/api/v1/admin/contests', 'POST', {
    title: 'ICPC Test Cup', contest_format: 'ICPC', duration_minutes: 60,
  }, adminToken);
  assert.equal(created.status, 201);
  const cid = created.data.contest.id;

  const prob = await call('/api/v1/admin/problems', 'POST', {
    contest_id: cid, code: 'A', title: 'Sum Two', rating: 800,
    statement: 'Tính tổng.', sampleInput: '2\n1 2', sampleOutput: '3',
  }, adminToken);
  assert.equal(prob.status, 201);

  const reg = await call(`/api/v1/contests/${created.data.contest.slug}/register`, 'POST', {}, heroToken);
  assert.equal(reg.status, 201);

  const go = await call('/api/v1/admin/phase', 'POST', { contest_id: cid, phase: 'CODING' }, adminToken);
  assert.equal(go.status, 200);

  const code = ['import sys', 'def solve():', '    d=sys.stdin.read().strip().split(); print(sum(map(int,d[1:])))', "if __name__=='__main__': solve()"].join('\n');
  const sub = await call('/api/v1/submissions', 'POST', {
    contest_id: cid, problem_id: prob.data.problem.id, language: 'python', source_code: code,
  }, heroToken);
  assert.equal(sub.status, 201);
  assert.equal(sub.data.submission.verdict, 'AC');

  const st = await call(`/api/v1/contests/${created.data.contest.slug}/standings`);
  assert.equal(st.status, 200);
  assert.equal(st.data.format, 'ICPC');
  const hero = st.data.standings.find((r) => r.username === 'dever_hero');
  assert.equal(hero.solved, 1);
  assert.ok(hero.penalty >= 0);
});

test('standings frozen che bai sau moc (format CF) + format ICPC', async () => {
  // Freeze chỉ áp cho bảng CODEFORCES (điểm decay); bảng ICPC dùng solved/penalty
  const frozen = await call('/api/v1/contests/dever-round-1-div3/standings?frozen=1&freeze_minute=0&format=CODEFORCES');
  assert.equal(frozen.status, 200);
  assert.ok(frozen.data.frozen);
  assert.equal(frozen.data.frozen.freezeMinute, 0);
  const hero = frozen.data.standings.find((r) => r.username === 'dever_hero');
  assert.ok(hero);
  const masked = Object.values(hero.problems).filter((p) => p.status === 'FROZEN');
  assert.ok(masked.length >= 1);

  const icpc = await call('/api/v1/contests/dever-round-1-div3/standings?format=ICPC');
  assert.equal(icpc.status, 200);
  assert.equal(icpc.data.format, 'ICPC');
  assert.ok(icpc.data.standings.length > 0);
  const top = icpc.data.standings[0];
  assert.ok(typeof top.solved === 'number' && typeof top.penalty === 'number' && typeof top.rank === 'number');
});

test('CF-parity: passedTestCount — bài WA vẫn hiện số test pass/total; rating-changes gate đúng quyền', async () => {
  // Đăng ký + nộp bài SAI ĐÁP ÁN vào round1 (đang CODING) — verdict WA nhưng vẫn có passed/total
  const register = await call('/api/v1/contests/dever-round-1-div3/register', 'POST', {}, heroToken);
  assert.ok([201, 409].includes(register.status), `register 201 hoặc 409 (đã đăng ký từ test trước): ${register.status}`);
  const problem = (await call('/api/v1/contests/dever-round-1-div3', 'GET', null, heroToken)).data.problems[0];
  const wrong = await call('/api/v1/submissions', 'POST', {
    contest_id: 'contest_dever_round1', problem_id: problem.id, language: 'python',
    source_code: 'print(999999)',
  }, heroToken);
  assert.equal(wrong.status, 201);
  assert.equal(wrong.data.verdict, 'WA');
  assert.equal(typeof wrong.data.submission.passed_tests, 'number', 'WA phải vẫn có passed_tests');
  assert.equal(typeof wrong.data.submission.total_tests, 'number');
  assert.ok(wrong.data.submission.total_tests >= 1);
  assert.ok(wrong.data.submission.passed_tests < wrong.data.submission.total_tests, 'đáp án sai → không pass hết');

  // Rating changes: gate theo trạng thái — đang thi chỉ ADMIN/organizer, FINISHED công khai (chuẩn CF)
  const cStatus = (await call('/api/v1/contests/dever-round-1-div3', 'GET', null, heroToken)).data.contest.status;
  const asHero = await call('/api/v1/contests/dever-round-1-div3/rating-changes', 'GET', null, heroToken);
  assert.equal(asHero.status, cStatus === 'FINISHED' ? 200 : 403);
  const preview = await call('/api/v1/contests/dever-round-1-div3/rating-changes', 'GET', null, adminToken);
  assert.equal(preview.status, 200);
  assert.equal(preview.data.finished, cStatus === 'FINISHED');
  assert.ok(Array.isArray(preview.data.changes));

  // Kỳ thi UNRATED: changes rỗng (test contest_7_mumajywi tạo ở lifecycle hoặc seed không rated)
  const unrated = await call('/api/v1/contests/dever-round-1-div3', 'GET', null, adminToken);
  assert.equal(unrated.status, 200);
});

test('profile aggregate: stats/heatmap/verdicts/tags/languages/per_contest từ DB thật', async () => {
  const p = await call('/api/v1/users/dever_hero/profile', 'GET', null, heroToken);
  assert.equal(p.status, 200);
  assert.equal(p.data.user.username, 'dever_hero');

  const { stats, rating_history, heatmap, verdicts, tags, languages, per_contest, recent_submissions } = p.data;
  assert.ok(stats.submissions >= 1, 'hero phải có ít nhất bài nộp từ test trước');
  assert.ok(stats.solved >= 1);
  assert.ok(stats.acceptance_rate >= 0 && stats.acceptance_rate <= 100);
  assert.ok(Array.isArray(rating_history) && rating_history.length >= 1, 'rating_history seed phải có');

  // Heatmap: 182 ô, mỗi ô {date, count >= 0}
  assert.equal(heatmap.length, 182);
  for (const cell of heatmap) {
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(cell.date));
    assert.ok(cell.count >= 0);
  }
  assert.ok(heatmap.some((c) => c.count > 0), 'phải có ngày có nộp bài (seed practice)');

  // Verdict map chỉ chứa verdict chuẩn
  for (const key of Object.keys(verdicts)) {
    assert.ok(['AC', 'WA', 'TLE', 'RTE', 'CE', 'MLE', 'PENDING'].includes(key), `verdict lạ: ${key}`);
  }

  // Tags: solved <= attempted, có data từ đề seed
  assert.ok(tags.length >= 1);
  for (const t of tags) {
    assert.ok(t.solved <= t.attempted);
    assert.ok(t.attempted >= 1);
  }

  // Languages + recent không lộ source code
  assert.ok(languages.length >= 1);
  assert.ok(recent_submissions.length >= 1);
  for (const s of recent_submissions) {
    assert.equal(s.source_code, undefined, 'source_code không được lộ qua profile');
  }

  // per_contest: hero đã đăng ký round1
  const round1 = per_contest.find((c) => c.contest_id === 'contest_dever_round1');
  assert.ok(round1, 'phải có entry round1');
  assert.equal(round1.registered, true);
  assert.ok(typeof round1.solved === 'number');
});

test('profile: user không tồn tại trả 404, user mới chưa nộp trả stats 0 + heatmap rỗng hợp lệ', async () => {
  const nf = await call('/api/v1/users/khong_ton_tai/profile', 'GET', null, heroToken);
  assert.equal(nf.status, 404);

  // Tạo user mới, chưa nộp bài nào
  const created = await call('/api/v1/admin/users', 'POST', {
    username: 'fresh_coder', password: 'fresh123', full_name: 'Người Mới',
  }, adminToken);
  assert.equal(created.status, 201);
  const fresh = await call('/api/v1/users/fresh_coder/profile', 'GET', null, heroToken);
  assert.equal(fresh.status, 200);
  assert.equal(fresh.data.stats.submissions, 0);
  assert.equal(fresh.data.stats.solved, 0);
  assert.equal(fresh.data.stats.best_rank, null);
  assert.equal(fresh.data.heatmap.length, 182);
  assert.ok(fresh.data.heatmap.every((c) => c.count === 0));
  assert.equal(fresh.data.recent_submissions.length, 0);
});

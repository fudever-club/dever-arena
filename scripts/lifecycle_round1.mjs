/**
 * Vòng đời DEVER Round #1 trên prod schema v2 (chạy sau khi contest sang CODING/FINISHED).
 * Dùng: node scripts/lifecycle_round1.mjs submit | check | standings
 */
const BASE = 'https://api-elegant-horse.spcf.app/api/v1';
const CONTEST = 'contest_7_mumajywi';
const A = 'p_8_mumc6zwq'; // TỔNG HAI SỐ — AC: "3 4" → 7, WA: "10 20" → 7 (đáp án sai)
const B = 'p_9_mumc70do'; // CHẮN HAY LẺ — AC: "12" → CHAN

const login = (u, p) => fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) }).then(r => r.json());
const post = (tok, path, body) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) }).then(r => r.json());
const get = (path) => fetch(BASE + path).then(r => r.json());

if (process.argv[2] === 'submit') {
  const s1 = await login('thi_sinh_01', 'dever-ts01');
  const s2 = await login('thi_sinh_02', 'dever-ts02');
  const py = (code) => code;
  const plan = [
    { tok: s1.accessToken, name: 's1/A AC', problem_id: A, source: py('print(sum(map(int, input().split())))'), input_note: '3 4' },
    { tok: s2.accessToken, name: 's2/A WA', problem_id: A, source: py('print(7)'), input_note: '10 20' },
    { tok: s2.accessToken, name: 's2/A AC lần 2', problem_id: A, source: py('print(sum(map(int, input().split())))'), input_note: '10 20' },
    { tok: s1.accessToken, name: 's1/B AC', problem_id: B, source: py("print('CHAN' if int(input()) % 2 == 0 else 'LE')"), input_note: '12' },
  ];
  for (const step of plan) {
    const r = await post(step.tok, '/submissions', { contest_id: CONTEST, problem_id: step.problem_id, language: 'python', source_code: step.source });
    console.log(step.name, '→', r.submission ? `${r.verdict} (${r.submission.id})` : JSON.stringify(r));
  }
} else if (process.argv[2] === 'check') {
  const st = await get('/contests/' + CONTEST + '/standings');
  console.log('status:', st.status, '| format:', st.format);
  for (const row of st.standings || []) {
    console.log(`#${row.rank} ${row.username || row.user_id} solved=${row.solved} penalty=${row.penalty}`);
    for (const p of row.problems || []) console.log('   ', JSON.stringify(p));
  }
} else {
  console.log('Dùng: node scripts/lifecycle_round1.mjs submit|check');
}

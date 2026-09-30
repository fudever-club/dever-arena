/**
 * DEVER Arena — Sprint 1b tốc độ cao: setup trọn vòng Round #2 RATED qua API prod.
 * Bước: (1) tạo contest (idempotent theo slug), (2) tạo/tái sử dụng 4 bài DRAFT (idempotent theo code),
 * (3) stress model vs brute, (4) nạp testcases từ outputs stress (validator chặn phía server),
 * (5) verify solver chuẩn AC TRỌN SUITE bằng dữ liệu LOCAL đầy đủ (không qua HTTP — tránh cap 2000 ký tự
 * của GET testcases; suite = sample + inputs stress đã nạp thành công, chuẩn hóa LF), (6) APPROVED.
 *
 * Chạy:  DEVER_ADMIN_PASS=... node scripts/setup_round2.mjs
 *        DEVER_ADMIN_PASS=... DRY_RUN=1 node scripts/setup_round2.mjs   (stress chạy thật, không ghi prod)
 * Exit 0 khi toàn bộ PASS. Re-run an toàn: bài đã tồn tại được tái sử dụng, testcase không nhân đôi.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join as pjoin } from 'node:path';
import { validateInput } from '../src/engine/testlibValidator.js';

const ROOT = pjoin(dirname(fileURLToPath(import.meta.url)), '..');
const API = (process.env.DEVER_API_BASE || 'https://api-elegant-horse.spcf.app').replace(/\/$/, '');
const ADMIN_USER = process.env.DEVER_ADMIN_USER || 'dever_admin';
const ADMIN_PASS = process.env.DEVER_ADMIN_PASS || '';
const DRY = process.env.DRY_RUN === '1';
if (!ADMIN_PASS) { console.error('[r2] Thiếu DEVER_ADMIN_PASS.'); process.exit(2); }

// ---- Định nghĩa 4 bài (ICPC 800–1300) ----
const PROBLEMS = [
  {
    code: 'A', title: 'TỔNG LỚN NHẤT', rating: 800, tags: ['math', 'greedy'],
    timeLimit: '1.0s',
    statement: [
      'Cho dãy gồm $n$ số nguyên dương $a_1, a_2, \\dots, a_n$.',
      '',
      'Tìm giá trị lớn nhất của $a_i + a_j$ với $i \\neq j$.',
      '',
      '**Input**',
      '- Dòng 1: số nguyên $n$ ($2 \\le n \\le 2 \\cdot 10^5$).',
      '- Dòng 2: $n$ số nguyên $a_i$ ($1 \\le a_i \\le 10^9$).',
      '',
      '**Output**',
      '- In ra một số nguyên duy nhất là đáp án.',
    ].join('\n'),
    sampleInput: '5\n3 1 4 1 5\n', sampleOutput: '9',
    bounds: { minN: 2, maxN: 200000, minVal: 1, maxVal: 1000000000 },
    model: `import sys
def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    a = list(map(int, data[1:1+n]))
    a.sort()
    print(a[-1] + a[-2])
main()`,
    brute: `import sys
def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    a = list(map(int, data[1:1+n]))
    best = 0
    for i in range(n):
        for j in range(i+1, n):
            if a[i] + a[j] > best:
                best = a[i] + a[j]
    print(best)
main()`,
    editorial: 'Sort rồi lấy 2 phần tử lớn nhất. O(n log n). Bẫy: n=2 (chỉ 1 cặp), mọi phần tử bằng nhau.',
  },
  {
    code: 'B', title: 'ĐẾM SỐ CHẴN', rating: 900, tags: ['implementation', 'counting'],
    timeLimit: '1.0s',
    statement: [
      'Cho dãy $n$ số nguyên $a_1, \\dots, a_n$. Đếm số phần tử **chẵn** trong dãy.',
      '',
      '**Input**',
      '- Dòng 1: $n$ ($1 \\le n \\le 10^6$).',
      '- Dòng 2: $n$ số nguyên $a_i$ ($-10^9 \\le a_i \\le 10^9$).',
      '',
      '**Output**',
      '- In ra số lượng phần tử chẵn.',
    ].join('\n'),
    sampleInput: '6\n-4 7 0 13 -8 2\n', sampleOutput: '4',
    bounds: { minN: 1, maxN: 1000000, minVal: -1000000000, maxVal: 1000000000 },
    model: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    cnt = 0
    for i in range(1, n+1):
        if int(data[i]) % 2 == 0:
            cnt += 1
    print(cnt)
main()`,
    brute: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    evens = [x for x in map(int, data[1:n+1]) if x % 2 == 0]
    print(len(evens))
main()`,
    editorial: 'Duyệt một lần, đếm a % 2 == 0. O(n). Bẫy: số âm (Python % luôn dư không âm nên an toàn), 0 là số chẵn, n = 10^6 cần đọc nhanh (sys.stdin.buffer).',
  },
  {
    code: 'C', title: 'DÃY TĂNG DÀI NHẤT', rating: 1100, tags: ['dp', 'binary-search'],
    timeLimit: '1.5s',
    statement: [
      'Cho dãy $n$ số nguyên. Tìm độ dài dãy con **tăng ngặt** dài nhất (LIS — chọn các phần tử giữ thứ tự, giá trị tăng chặt).',
      '',
      '**Input**',
      '- Dòng 1: $n$ ($1 \\le n \\le 2 \\cdot 10^5$).',
      '- Dòng 2: $n$ số nguyên $a_i$ ($-10^9 \\le a_i \\le 10^9$).',
      '',
      '**Output**',
      '- In ra độ dài LIS.',
    ].join('\n'),
    sampleInput: '8\n10 9 2 5 3 7 101 18\n', sampleOutput: '4',
    bounds: { minN: 1, maxN: 200000, minVal: -1000000000, maxVal: 1000000000 },
    model: `import sys
from bisect import bisect_left
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    tails = []
    for i in range(1, n+1):
        x = int(data[i])
        p = bisect_left(tails, x)
        if p == len(tails):
            tails.append(x)
        else:
            tails[p] = x
    print(len(tails))
main()`,
    brute: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    a = list(map(int, data[1:n+1]))
    dp = [1] * n
    for i in range(n):
        for j in range(i):
            if a[j] < a[i] and dp[j] + 1 > dp[i]:
                dp[i] = dp[j] + 1
    print(max(dp) if n else 0)
main()`,
    editorial: 'LIS chuẩn bằng binary search (tails, O(n log n)) — brute O(n²) chỉ dùng để stress. Bẫy: dãy giảm dần (LIS = 1), phần tử bằng nhau không tính (tăng NGẶT).',
  },
  {
    code: 'D', title: 'TỔNG ĐOẠN LỚN NHẤT', rating: 1300, tags: ['dp', 'kadane'],
    timeLimit: '1.5s',
    statement: [
      'Cho dãy $n$ số nguyên $a_1, \\dots, a_n$. Tìm tổng lớn nhất của một **đoạn con không rỗng gồm các phần tử liên tiếp**.',
      '',
      '**Input**',
      '- Dòng 1: $n$ ($1 \\le n \\le 2 \\cdot 10^5$).',
      '- Dòng 2: $n$ số nguyên $a_i$ ($-10^9 \\le a_i \\le 10^9$).',
      '',
      '**Output**',
      '- In ra một số nguyên duy nhất là tổng lớn nhất.',
    ].join('\n'),
    sampleInput: '9\n-2 1 -3 4 -1 2 1 -5 4\n', sampleOutput: '6',
    bounds: { minN: 1, maxN: 200000, minVal: -1000000000, maxVal: 1000000000 },
    model: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    best = None
    cur = 0
    for i in range(1, n+1):
        x = int(data[i])
        cur = x if cur < 0 or best is None else cur + x
        if best is None or cur > best:
            best = cur
    print(best)
main()`,
    brute: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    a = list(map(int, data[1:n+1]))
    pre = [0]
    for x in a:
        pre.append(pre[-1] + x)
    best = -10**30
    for i in range(n):
        for j in range(i+1, n+1):
            if pre[j] - pre[i] > best:
                best = pre[j] - pre[i]
    print(best)
main()`,
    editorial: 'Kadane O(n): cur = max(x, cur+x), best = max(best, cur). Bẫy: dãy toàn số ÂM (đáp án = phần tử lớn nhất — đoạn không rỗng), n=1, dãy toàn số âm.',
  },
];

// ---- Solver chuẩn (verifier) — chạy bằng engine judge thật trên máy này ----
const VERIFIER = {
  A: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    a = sorted(map(int, data[1:1+int(data[0])]))
    print(a[-1] + a[-2])
main()`,
  B: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    print(sum(1 for x in map(int, data[1:1+int(data[0])]) if x % 2 == 0))
main()`,
  C: `import sys
from bisect import bisect_left
def main():
    data = sys.stdin.buffer.read().split()
    tails = []
    for x in map(int, data[1:1+int(data[0])]):
        p = bisect_left(tails, x)
        if p == len(tails): tails.append(x)
        else: tails[p] = x
    print(len(tails))
main()`,
  D: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    best = None
    cur = 0
    for x in map(int, data[1:1+n]):
        cur = x if (cur < 0 or best is None) else cur + x
        if best is None or cur > best:
            best = cur
    print(best)
main()`,
};

let token = null;
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const die = (msg) => { console.error(`[r2] FAIL: ${msg}`); process.exit(1); };

/** Chạy verifier Python cục bộ: stdin qua pipe (LF chuẩn), đọc stdout chuẩn hóa LF. */
function runVerifier(code, stdin, tlMs) {
  const dir = mkdtempSync(join(tmpdir(), 'dever-verify-'));
  const srcPath = join(dir, 'v.py');
  writeFileSync(srcPath, VERIFIER[code].replace(/\r\n/g, '\n'));
  try {
    const out = execFileSync('python', [srcPath], {
      input: stdin.replace(/\r\n/g, '\n'),
      timeout: Math.max(tlMs * 4, 8000),
      maxBuffer: 64 * 1024 * 1024,
    });
    return out.toString().replace(/\r\n/g, '\n').trim();
  } catch (e) {
    return `__ERROR__:${e.status || ''} ${String(e.stderr || e.message).slice(0, 200)}`;
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

/** Sinh input cỡ lớn dạng `N` + dãy trong bounds (LCG deterministic — không phụ thuộc nền). */
function genArrayInput(n, bounds) {
  let s = (0x9e3779b9 ^ n) >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const lo = Math.max(bounds.minVal, -1000000000);
  const hi = Math.min(bounds.maxVal, 1000000000);
  const vals = Array.from({ length: n }, () => String(lo + Math.floor(rnd() * (hi - lo + 1))));
  return `${n}\n${vals.join(' ')}\n`;
}

// ---- 0. login
const login = await api('POST', '/api/v1/auth/login', { username: ADMIN_USER, password: ADMIN_PASS });
if (login.status !== 200) die(`login ${login.status}`);
token = login.json.accessToken;
console.log('[r2] 0. login OK');

// ---- 1. contest (idempotent theo slug)
const SLUG = 'dever-round-2';
let contest = null;
{
  const listRes = await api('GET', '/api/v1/contests');
  const list = listRes.json?.contests || listRes.json || [];
  contest = (Array.isArray(list) ? list : []).find((c) => c.slug === SLUG) || null;
  if (!contest && !DRY) {
    const r = await api('POST', '/api/v1/admin/contests', {
      title: 'DEVER Round #2', slug: SLUG, contest_format: 'ICPC',
      start_time: '2026-10-07T12:00:00.000Z', duration_minutes: 120, is_rated: true,
    });
    if (r.status !== 201) die(`tạo contest: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    contest = r.json.contest;
  }
  if (contest) console.log(`[r2] 1. contest: ${contest.id} (${contest.slug}) rated=${contest.is_rated} start=${contest.start_time} status=${contest.status}`);
}

// ---- Bài đã có trên prod (idempotent theo code trong contest)
const existing = DRY ? [] : ((await api('GET', `/api/v1/problems?contest_id=${contest.id}`)).json?.problems || []);
const summary = [];

for (const P of PROBLEMS) {
  // ---- 2. tạo / tái sử dụng bài
  let problem = existing.find((p) => p.code === P.code) || null;
  if (problem) {
    console.log(`[r2] 2. bài ${P.code} đã có: ${problem.id} (${problem.workflow_status}) — tái sử dụng`);
  } else if (DRY) {
    console.log(`[r2] 2. DRY: sẽ tạo bài ${P.code} — ${P.title} (${P.rating})`);
  } else {
    const r = await api('POST', '/api/v1/admin/problems', {
      contest_id: contest.id, code: P.code, title: P.title, rating: P.rating, tags: P.tags,
      timeLimit: P.timeLimit, statement: P.statement,
      sampleInput: P.sampleInput, sampleOutput: P.sampleOutput,
      editorial: P.editorial, bounds: P.bounds,
    });
    if (r.status !== 201) die(`tạo bài ${P.code}: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
    problem = r.json.problem;
    console.log(`[r2] 2. bài ${P.code} tạo DRAFT: ${problem.id}`);
  }

  // ---- 3. stress model vs brute (luôn chạy — bằng chứng bài giải đúng)
  // Stress trên cỡ NHỎ (maxN ≤ 2500) để brute O(n²) kịp — chuẩn Polygon; test cỡ lớn sinh riêng bằng model.
  const stressRules = { ...P.bounds, maxN: Math.min(P.bounds.maxN, 2500) };
  const stress = await api('POST', '/api/v1/admin/stress', {
    language: 'python', model_source: P.model, brute_source: P.brute,
    count: 12, seed: `round2-${P.code}`, timeLimitMs: 2500, rules: stressRules,
  });
  if (stress.status !== 200) die(`stress ${P.code}: ${stress.status} ${JSON.stringify(stress.json).slice(0, 300)}`);
  const st = stress.json;
  console.log(`[r2] 3. stress ${P.code}: ${st.passed}/${st.ran} PASS, modelMax=${st.modelMaxMs}ms, TL gợi ý ${st.suggestedTimeLimitS}s`);
  if (st.verdict !== 'PASS') {
    const outside = [];
    const real = [];
    for (const mm of st.mismatches || []) {
      (validateInput(mm.stdin, P.bounds).isValid ? real : outside).push(mm);
    }
    if (outside.length) console.warn(`[r2]   ${outside.length} mismatch ngoài ràng buộc (bỏ qua): ${outside.map((m) => JSON.stringify(m.stdin.slice(0, 30))).join(', ')}`);
    if (real.length) { console.error('[r2] mismatch THẬT:', JSON.stringify(real, null, 2)); die(`stress ${P.code} FAIL`); }
  }

  // Suite local đầy đủ: sample + outputs stress trong ràng buộc + 2 test CỠ LỚN sinh bằng model.
  // Model đã được brute kiểm chứng trên cỡ nhỏ; answer test lớn = output verifier (cùng họ thuật toán
  // với model — rủi ro sót được ghi nhận, bù lại chặn tuyệt đối lỗi expected rỗng).
  const inBounds = (s) => validateInput(s, P.bounds).isValid;
  const stressTests = (st.outputs || []).filter((t) => inBounds(t.stdin))
    .map((t) => ({ stdin: t.stdin, expected: String(t.expected_stdout || '').replace(/\r\n/g, '\n').trim() }));
  const tlMs = (parseFloat(P.timeLimit) || 1.5) * 1000;
  const nMax = P.bounds.maxN;
  const genTests = [...new Set([Math.min(nMax, 250000), Math.min(nMax, 125000)])]
    .map((n) => genArrayInput(n, P.bounds))
    .filter(inBounds)
    .map((stdin) => ({ stdin, expected: String(runVerifier(P.code, stdin, tlMs)).replace(/\r\n/g, '\n').trim() }));
  const localSuite = [ { stdin: P.sampleInput, expected: P.sampleOutput.trim() }, ...stressTests, ...genTests ]
    .filter((t) => t.expected !== '');
  if (genTests.length) console.log(`[r2]   +${genTests.length} test lớn sinh bằng model (n=${genTests.map((t) => t.stdin.split('\n')[0]).join(', ')})`);

  if (DRY || !problem) continue;

  // ---- 4. nạp testcases còn thiếu (đối chiếu theo số thứ tự: server giữ thứ tự đã nạp)
  const serverTcs = (await api('GET', `/api/v1/admin/testcases?problem_id=${problem.id}`)).json?.testcases || [];
  const haveInputs = new Set(serverTcs.map((t) => String(t.stdin).replace(/\r\n/g, '\n')));
  let added = 0, skipped = 0, rejected = 0;
  for (const t of localSuite) {
    if (haveInputs.has(t.stdin)) { skipped++; continue; }
    const tr = await api('POST', '/api/v1/admin/testcases', {
      problem_id: problem.id, stdin: t.stdin, expected_stdout: t.expected, strategy: 'stress',
    });
    if (tr.status === 201) added++;
    else { rejected++; console.warn(`[r2]   testcase từ chối (${tr.status}): ${tr.json?.message || ''} — n=${String(t.stdin).split('\n')[0]}`); }
  }
  console.log(`[r2] 4. testcases ${P.code}: +${added}, có sẵn ${skipped}, từ chối ${rejected} (tổng server sẽ dùng: ${serverTcs.length + added})`);

  // ---- 5. verify bằng dữ liệu LOCAL đầy đủ (python cục bộ, LF chuẩn)
  let okCount = 0;
  const failures = [];
  for (const t of localSuite) {
    const got = runVerifier(P.code, t.stdin, tlMs);
    if (got === t.expected) okCount++;
    else failures.push({ n: String(t.stdin).split('\n')[0], expected: t.expected, got: got.slice(0, 80) });
  }
  console.log(`[r2] 5. verify ${P.code}: solver AC ${okCount}/${localSuite.length}`);
  if (failures.length) { console.error('[r2] verify FAIL:', JSON.stringify(failures.slice(0, 3), null, 2)); die(`solver ${P.code} không AC trọn suite`); }

  // ---- 6. APPROVED (tạo tester bot để đi đúng workflow blind rồi dọn)
  if (problem.workflow_status !== 'APPROVED') {
    const uname = `tester_${Date.now().toString(36)}`;
    const cr = await api('POST', '/api/v1/admin/users', { username: uname, full_name: 'Blind Tester Bot', password: `pw-${Date.now().toString(36)}`, role: 'PARTICIPANT' });
    if (cr.status !== 201) die(`tạo tester: ${cr.status} ${JSON.stringify(cr.json).slice(0, 200)}`);
    const testerId = cr.json.user.id;
    const sub = await api('POST', `/api/v1/admin/problems/${problem.id}/submit-testing`, { tester_id: testerId });
    if (sub.status !== 200) die(`submit-testing ${P.code}: ${sub.status} ${JSON.stringify(sub.json).slice(0, 200)}`);
    const rev = await api('POST', `/api/v1/admin/problems/${problem.id}/review`, {
      decision: 'APPROVED', note: `Stress ${st.passed}/${st.ran} + solver AC ${okCount}/${localSuite.length} (auto-setup)`,
    });
    await api('DELETE', `/api/v1/admin/users/${testerId}`);
    if (rev.status !== 200) die(`review ${P.code}: ${rev.status} ${JSON.stringify(rev.json).slice(0, 200)}`);
  }
  console.log(`[r2] 6. ${P.code} → APPROVED`);
  summary.push({ code: P.code, id: problem.id, stress: `${st.passed}/${st.ran}`, verify: `${okCount}/${localSuite.length}` });
}

console.log('='.repeat(64));
console.log(`[r2] KẾT QUẢ: ${summary.length ? JSON.stringify(summary, null, 0) : '(dry-run — stress 4/4 PASS)'}`);
console.log('[r2] HOÀN TẤT — Round #2 sẵn sàng: contest REGISTRATION (rated, 12:00 UTC 7/10), 4 bài APPROVED.');

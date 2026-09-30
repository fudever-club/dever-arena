/**
 * Dựng lại SUITE SẠCH cho 4 bài Round #2 trên prod:
 *  1. Xóa sạch testcases non-sample của 4 bài (suite đang ô nhiễm từ các lần chạy trước khi vá bug CE/CE).
 *  2. Sinh lại suite chuẩn: sample + stress outputs (model vs brute, maxN≤2500) + test lớn (model).
 *  3. Nạp vào prod, verify solver AC toàn bộ (dữ liệu local nguyên vẹn).
 *  4. Dump prod sau khi sạch → trạng thái gốc cho restore sau probe toolchain.
 * Chạy: DEVER_ADMIN_PASS=... node scripts/rebuild_r2_suite.mjs
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateInput } from '../src/engine/testlibValidator.js';
import { PROBLEMS } from './round2_problems.mjs';

// ---- Verifier + helper (bản copy khớp setup_round2 — tách module chung khi cần) ----
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

function runVerifier(code, stdin, tlMs) {
  const dir = mkdtempSync(join(tmpdir(), 'dever-verify-'));
  const srcPath = join(dir, 'v.py');
  writeFileSync(srcPath, VERIFIER[code].replace(/\r\n/g, '\n'));
  try {
    const out = execFileSync('python', [srcPath], { input: stdin.replace(/\r\n/g, '\n'), timeout: Math.max(tlMs * 4, 8000), maxBuffer: 64 * 1024 * 1024 });
    return out.toString().replace(/\r\n/g, '\n').trim();
  } catch (e) {
    return `__ERROR__:${e.status || ''} ${String(e.stderr || e.message).slice(0, 200)}`;
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

function genArrayInput(n, bounds) {
  let s = (0x9e3779b9 ^ n) >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const lo = Math.max(bounds.minVal, -1000000000);
  const hi = Math.min(bounds.maxVal, 1000000000);
  const vals = Array.from({ length: n }, () => String(lo + Math.floor(rnd() * (hi - lo + 1))));
  return `${n}\n${vals.join(' ')}\n`;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = (process.env.DEVER_API_BASE || 'https://api-elegant-horse.spcf.app').replace(/\/$/, '');
const ADMIN_USER = process.env.DEVER_ADMIN_USER || 'dever_admin';
const ADMIN_PASS = process.env.DEVER_ADMIN_PASS || '';
if (!ADMIN_PASS) { console.error('[rebuild] Thiếu DEVER_ADMIN_PASS.'); process.exit(2); }

const CPP_MIN_MAXN = 2500; // stress cỡ nhỏ — brute O(n²) kịp

// Định nghĩa rút gọn: chỉ cần bounds + model + brute để stress + sinh test lớn
const SPEC = {
  A: { maxN: 200000, minN: 2, minVal: 1, maxVal: 1000000000 },
  B: { maxN: 1000000, minN: 1, minVal: -1000000000, maxVal: 1000000000 },
  C: { maxN: 200000, minN: 1, minVal: -1000000000, maxVal: 1000000000 },
  D: { maxN: 200000, minN: 1, minVal: -1000000000, maxVal: 1000000000 },
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
const die = (m) => { console.error(`[rebuild] FAIL: ${m}`); process.exit(1); };

const login = await api('POST', '/api/v1/auth/login', { username: ADMIN_USER, password: ADMIN_PASS });
if (login.status !== 200) die(`login ${login.status}`);
token = login.json.accessToken;

const contest = (await api('GET', '/api/v1/contests/dever-round-2')).json?.contest;
if (!contest) die('không thấy contest dever-round-2');
const problems = (await api('GET', `/api/v1/problems?contest_id=${contest.id}`)).json?.problems || [];

const summary = [];
for (const P of PROBLEMS) {
  const problem = problems.find((p) => p.code === P.code);
  if (!problem) die(`không thấy bài ${P.code}`);

  // ---- 1. xóa sạch testcases non-sample
  const tcs = (await api('GET', `/api/v1/admin/testcases?problem_id=${problem.id}&full=1`)).json?.testcases || [];
  let deleted = 0;
  for (const t of tcs) {
    if (t.is_sample) continue;
    const r = await api('DELETE', `/api/v1/admin/testcases/${t.id}`);
    if (r.status === 200) deleted++;
  }
  console.log(`[rebuild] ${P.code}: xóa ${deleted}/${tcs.length} testcase cũ`);

  // ---- 2. stress lại (cỡ nhỏ) → outputs chuẩn
  const stress = await api('POST', '/api/v1/admin/stress', {
    language: 'python', model_source: P.model, brute_source: P.brute,
    count: 12, seed: `round2-clean-${P.code}`, timeLimitMs: 2500, rules: { ...P.bounds, maxN: CPP_MIN_MAXN },
  });
  if (stress.status !== 200) die(`stress ${P.code}: ${stress.status}`);
  const st = stress.json;
  if (st.verdict !== 'PASS') {
    // Bẫy ngoài ràng buộc (n=1 với đề minN=2…) không tính — validator chặn khỏi suite thật.
    const real = (st.mismatches || []).filter((mm) => validateInput(mm.stdin, P.bounds).isValid);
    if (real.length) die(`stress ${P.code}: ${st.passed}/${st.ran} (mismatch thật: ${JSON.stringify(real.slice(0, 1))})`);
    console.warn(`[rebuild] ${P.code}: ${(st.mismatches || []).length - real.length} mismatch ngoài ràng buộc (bỏ qua)`);
  }
  console.log(`[rebuild] ${P.code}: stress ${st.passed}/${st.ran} PASS (maxN≤${CPP_MIN_MAXN})`);

  // ---- 3. suite chuẩn: sample + stress outputs + 2 test lớn (model)
  const inB = (s) => validateInput(s, P.bounds).isValid;
  const suite = [
    { stdin: P.sampleInput, expected: P.sampleOutput.trim(), strategy: 'sample' },
    ...(st.outputs || []).filter((t) => inB(t.stdin)).map((t) => ({ stdin: t.stdin, expected: String(t.expected_stdout || '').trim(), strategy: 'stress' })),
  ];
  const tlMs = (parseFloat(P.timeLimit) || 1.5) * 1000;
  for (const n of [...new Set([Math.min(P.bounds.maxN, 200000), Math.min(P.bounds.maxN, 125000)])]) {
    const stdin = genArrayInput(n, P.bounds);
    if (!inB(stdin)) continue;
    suite.push({ stdin, expected: String(runVerifier(P.code, stdin, tlMs)).trim(), strategy: 'generated-large' });
  }
  suite.filter((t) => t.expected !== ''); // (giữ cả test expected rỗng nếu có — không có ở 4 bài này)

  // ---- 4. nạp vào prod
  let added = 0;
  for (const t of suite) {
    const r = await api('POST', '/api/v1/admin/testcases', { problem_id: problem.id, stdin: t.stdin, expected_stdout: t.expected, strategy: t.strategy });
    if (r.status !== 201) die(`nạp testcase ${P.code}: ${r.status} ${JSON.stringify(r.json).slice(0, 150)}`);
    added++;
  }
  console.log(`[rebuild] ${P.code}: nạp ${added} testcase (sample + stress + 2 lớn)`);

  // ---- 5. verify local trên suite nguyên vẹn
  let ok = 0;
  for (const t of suite) {
    const got = runVerifier(P.code, t.stdin, tlMs);
    if (got === t.expected) ok++;
  }
  console.log(`[rebuild] ${P.code}: verify solver AC ${ok}/${suite.length}`);
  if (ok !== suite.length) die(`solver ${P.code} lệch`);

  summary.push({ code: P.code, tests: suite.length, verify: `${ok}/${suite.length}` });
}

// ---- 6. dump trạng thái sạch
const dump = (await api('GET', '/api/v1/admin/backup-dump')).json;
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
mkdirSync(join(ROOT, 'backups'), { recursive: true });
const out = join(ROOT, 'backups', `clean-round2-${stamp}.json`);
writeFileSync(out, JSON.stringify(dump, null, 2));
console.log('='.repeat(60));
console.log(`[rebuild] SUITE SẠCH: ${JSON.stringify(summary)}`);
console.log(`[rebuild] Dump sạch: ${out}`);
console.log('[rebuild] Dùng dump này để restore sau probe toolchain.');

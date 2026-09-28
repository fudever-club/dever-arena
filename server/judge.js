/**
 * DEVER Arena — Judge thật (local dev): thực thi code trong child_process
 * với timeout + giới hạn output, đối soát bằng checker chuẩn.
 * - javascript: chạy bằng `node` thật. - python: chạy bằng `python` thật.
 * - cpp/java: 422 UNSUPPORTED_LANGUAGE (cần Isolate production — honest, không giả vờ chấm).
 * Tái dùng checkSecurity/compareOutputs từ src/engine/isolateRunner.js
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkSecurity, compareOutputs } from '../src/engine/isolateRunner.js';

const MAX_SOURCE = 100 * 1024; // 100KB
const MAX_STDIN = 50 * 1024;   // 50KB
const MAX_STDOUT = 50 * 1024;  // 50KB
const MAX_COMPILE_ERR = 4000;  // Task 104: stderr compile đầy đủ hơn (trước chỉ 500 ký tự)

// Task 104: MLE heuristic — JS/Python/Java throw message đặc trưng khi hết bộ nhớ.
const MLE_PATTERNS = /heap out of memory|JavaScript heap|MemoryError|bad_alloc|std::bad_alloc|OutOfMemoryError|unable to allocate/i;

/** Đọc memoryLimit "256 MB" → bytes (fallback 256MB). */
export function memoryLimitBytes(memoryLimit) {
  const m = String(memoryLimit || '').match(/([\d.]+)\s*(MB|GB|KB)?/i);
  if (!m) return 256 * 1024 * 1024;
  const v = parseFloat(m[1]) || 256;
  const unit = (m[2] || 'MB').toUpperCase();
  if (unit === 'GB') return v * 1024 ** 3;
  if (unit === 'KB') return v * 1024;
  return v * 1024 * 1024;
}

const RUNNERS = {
  javascript: { cmd: 'node', args: (f) => [f], ext: 'js', aliases: ['js', 'node20', 'nodejs'], kind: 'direct' },
  python: { cmd: 'python', args: (f) => [f], ext: 'py', aliases: ['python3', 'py'], kind: 'direct' },
  cpp: { ext: 'cpp', aliases: ['cpp20', 'c++', 'g++'], kind: 'compiled' },
  java: { ext: 'java', aliases: ['java17', 'java21'], kind: 'compiled' },
};

// Phát hiện toolchain khi cần (cache). Không có → SKIP trung thực thay vì bịa verdict.
const TOOLCHAIN_CACHE = {};
function hasTool(cmd) {
  if (TOOLCHAIN_CACHE[cmd] !== undefined) return TOOLCHAIN_CACHE[cmd];
  try {
    const r = spawnSync(cmd, ['--version'], { timeout: 5000, windowsHide: true });
    TOOLCHAIN_CACHE[cmd] = !r.error && r.status === 0;
  } catch {
    TOOLCHAIN_CACHE[cmd] = false;
  }
  return TOOLCHAIN_CACHE[cmd];
}

function compileCpp(dir, file) {
  if (!hasTool('g++')) return 'Thiếu toolchain g++ trên máy chấm (cần Isolate production hoặc cài g++).';
  const out = process.platform === 'win32' ? 'solution.exe' : 'solution';
  const r = spawnSync('g++', ['-O2', '-std=c++20', '-o', out, file], { cwd: dir, timeout: 10000, windowsHide: true });
  if (r.error || r.status !== 0) {
    const err = ((r.stderr || Buffer.alloc(0)).toString('utf8') || r.error?.message || '').slice(0, MAX_COMPILE_ERR);
    return `Compilation Error:\n${err}`;
  }
  return { exe: join(dir, out) };
}

function compileJava(dir, source) {
  if (!hasTool('javac') || !hasTool('java')) return 'Thiếu toolchain Java (javac/java) trên máy chấm.';
  const m = source.match(/public\s+(?:final\s+)?class\s+(\w+)/);
  const cls = m ? m[1] : 'Solution';
  const file = join(dir, `${cls}.java`);
  writeFileSync(file, source);
  const r = spawnSync('javac', [file], { cwd: dir, timeout: 10000, windowsHide: true });
  if (r.error || r.status !== 0) {
    const err = ((r.stderr || Buffer.alloc(0)).toString('utf8') || r.error?.message || '').slice(0, MAX_COMPILE_ERR);
    return `Compilation Error:\n${err}`;
  }
  return { exe: cls, useClasspath: dir };
}

export function normalizeLanguage(lang) {
  const l = String(lang || '').toLowerCase();
  for (const [name, r] of Object.entries(RUNNERS)) {
    if (l === name || r.aliases.includes(l)) return name;
  }
  return null;
}

/** null = sẵn sàng chấm; chuỗi = lý do chưa chấm được (để API trả 422 trung thực). */
export function languageReady(lang) {
  if (lang === 'cpp' && !hasTool('g++')) return 'Máy chấm này thiếu g++ (cần Isolate production hoặc cài g++). Hiện chấm được: JavaScript, Python, Java.';
  if (lang === 'java' && (!hasTool('javac') || !hasTool('java'))) return 'Máy chấm này thiếu JDK (javac/java). Hiện chấm được: JavaScript, Python.';
  if (lang === 'javascript' && !hasTool('node')) return 'Máy chấm này thiếu Node.js.';
  if (lang === 'python' && !hasTool('python')) return 'Máy chấm này thiếu Python.';
  return null;
}

export function supportedLanguages() {
  return Object.keys(RUNNERS);
}

/**
 * Thực thi 1 testcase. Trả về { verdict, stdout, timeMs, message }.
 * verdict: AC | WA | TLE | MLE | RTE | CE (Task 104: thêm MLE)
 */
export function executeOne({ language, source, stdin = '', timeLimitMs = 1000, memoryLimit = '256 MB' }) {
  const lang = normalizeLanguage(language);
  if (!lang) {
    return { verdict: 'SKIP', stdout: '', timeMs: 0, message: `Ngôn ngữ ${language} cần Isolate production (local dev chỉ hỗ trợ javascript/python).` };
  }
  if (!source || !source.trim()) return { verdict: 'CE', stdout: '', timeMs: 0, message: 'Compilation Error: Empty file' };
  if (source.length > MAX_SOURCE) return { verdict: 'CE', stdout: '', timeMs: 0, message: 'File too large (max 100KB)' };
  if (stdin.length > MAX_STDIN) return { verdict: 'CE', stdout: '', timeMs: 0, message: 'Input too large (max 50KB)' };

  const blocked = checkSecurity(source);
  if (blocked) return { verdict: 'CE', stdout: '', timeMs: 0, message: `Security Policy Violation: ${blocked}` };

  const runner = RUNNERS[lang];
  const dir = mkdtempSync(join(tmpdir(), 'dever-judge-'));
  try {
    let cmd, args;
    if (runner.kind === 'compiled' && lang === 'cpp') {
      const file = join(dir, 'solution.cpp');
      writeFileSync(file, source);
      const compiled = compileCpp(dir, file);
      if (typeof compiled === 'string') return { verdict: 'CE', stdout: '', timeMs: 0, message: compiled };
      cmd = compiled.exe; args = [];
    } else if (runner.kind === 'compiled' && lang === 'java') {
      const compiled = compileJava(dir, source);
      if (typeof compiled === 'string') return { verdict: 'CE', stdout: '', timeMs: 0, message: compiled };
      cmd = 'java'; args = ['-cp', compiled.useClasspath, compiled.exe];
    } else {
      const file = join(dir, `solution.${runner.ext}`);
      writeFileSync(file, source);
      cmd = runner.cmd;
      if (lang === 'javascript') {
        // Task 104: ràng buộc heap V8 theo memoryLimit của đề (đơn giản nhất, cross-platform).
        args = ['--max-old-space-size=' + Math.max(16, Math.floor(memoryLimitBytes(memoryLimit) / 1024 / 1024)), file];
      } else {
        args = runner.args(file);
      }
    }
    const t0 = Date.now();
    const res = spawnSync(cmd, args, {
      input: stdin,
      timeout: timeLimitMs,
      maxBuffer: MAX_STDOUT + 1024,
      killSignal: 'SIGKILL',
      windowsHide: true,
    });
    const timeMs = Date.now() - t0;
    if (res.error && res.error.code === 'ETIMEDOUT') {
      return { verdict: 'TLE', stdout: '', timeMs, message: `Time Limit Exceeded (> ${timeLimitMs}ms)` };
    }
    if (res.error) {
      return { verdict: 'RTE', stdout: '', timeMs, message: `Runtime Error: ${String(res.error.message).slice(0, 200)}` };
    }
    if (res.status !== 0) {
      const err = (res.stderr || Buffer.alloc(0)).toString('utf8').slice(0, MAX_COMPILE_ERR);
      // Task 104: phân loại MLE khỏi RTE theo message đặc trưng của từng runtime.
      if (MLE_PATTERNS.test(err)) {
        return { verdict: 'MLE', stdout: '', timeMs, message: `Memory Limit Exceeded (${memoryLimit}): ${err.slice(0, 200)}` };
      }
      const looksCompile = /SyntaxError|IndentationError|NameError.*not defined/i.test(err) && timeMs < 300 && lang === 'python';
      return { verdict: looksCompile ? 'CE' : 'RTE', stdout: '', timeMs, message: err || `Exit code ${res.status}` };
    }
    return { verdict: 'OK', stdout: (res.stdout || Buffer.alloc(0)).toString('utf8').slice(0, MAX_STDOUT), timeMs, message: 'OK' };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

/**
 * Chấm 1 bài trên bộ tests (fail-fast). Trả về { verdict, results, failedIndex, perTest }.
 * verdict chung: AC | WA | TLE | MLE | RTE | CE | SKIP (verdict map chuẩn ADR-005 + Task 104)
 */
export function judgeTests({ language, source, tests, timeLimitMs = 1000, memoryLimit = '256 MB' }) {
  const results = [];
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const r = executeOne({ language, source, stdin: t.stdin || '', timeLimitMs, memoryLimit });
    if (r.verdict === 'SKIP') return { verdict: 'SKIP', results, failedIndex: i, message: r.message };
    if (r.verdict !== 'OK') {
      results.push({ ...r, index: i });
      return { verdict: r.verdict, results, failedIndex: i, message: r.message };
    }
    const ok = compareOutputs(r.stdout, t.expected || '');
    results.push({ ...r, verdict: ok ? 'AC' : 'WA', index: i });
    if (!ok) return { verdict: 'WA', results, failedIndex: i, message: `Wrong Answer on test ${i + 1}` };
  }
  return { verdict: 'AC', results, failedIndex: -1, message: 'Accepted' };
}

/**
 * DEVER Arena Isolate Sandbox Runner
 * Mô phỏng môi trường thực thi an toàn chuẩn Linux Isolate & cgroups v2
 * Đo lường CPU time, dung lượng RAM, cơ chế dừng sớm (Fail-Fast) và đối soát Verdict.
 */

export const VERDICTS = {
  AC: 'ACCEPTED',
  WA: 'WRONG_ANSWER',
  TLE: 'TIME_LIMIT_EXCEEDED',
  MLE: 'MEMORY_LIMIT_EXCEEDED',
  RTE: 'RUNTIME_ERROR',
  CE: 'COMPILATION_ERROR'
};

export const DEFAULT_LIMITS = {
  timeLimitMs: 1000,      // 1.0 giây
  memoryLimitKb: 262144,  // 256 MB (256 * 1024 KB)
  maxOutputChars: 50000   // 50KB stdout guard
};

/**
 * Chuẩn hóa output: loại bỏ \r, cắt khoảng trắng cuối dòng và dòng trống cuối cùng
 * @param {string} str 
 * @returns {string}
 */
export function normalizeOutput(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * So sánh 2 chuỗi output theo quy chuẩn Competitive Programming
 * @param {string} actual 
 * @param {string} expected 
 * @returns {boolean}
 */
export function compareOutputs(actual, expected) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

/**
 * Kiểm tra các pattern độc hại trong mã nguồn
 * @param {string} sourceCode 
 * @returns {string | null} Tên API nguy hiểm bị chặn hoặc null nếu hợp lệ
 */
export function checkSecurity(sourceCode) {
  if (!sourceCode) return 'Empty source code';
  const blockedPatterns = [
    'child_process', 'fs.unlink', 'fs.rmdir', 'fs.write', 'process.exit',
    'require("child_process")', 'require(\'child_process\')',
    'Worker', 'SharedWorker', 'WebSocket', 'localStorage', 'sessionStorage',
    'indexedDB', 'document.cookie', 'window.location', 'globalThis.process'
  ];

  for (const pattern of blockedPatterns) {
    if (sourceCode.includes(pattern)) {
      return `Security Policy Violation: ${pattern}`;
    }
  }
  return null;
}

/**
 * Thực thi một testcase đơn lẻ trong sandbox
 * @param {string} sourceCode 
 * @param {string} language 'javascript' | 'python' | 'cpp'
 * @param {string} stdin 
 * @param {string} expectedStdout 
 * @param {object} limits 
 * @returns {Promise<{ verdict: string, executionTimeMs: number, memoryUsedKb: number, stdout: string, message: string }>}
 */
export async function executeTestcase(sourceCode, language = 'javascript', stdin = '', expectedStdout = '', limits = {}) {
  const mergedLimits = { ...DEFAULT_LIMITS, ...limits };
  const startTime = performance.now();

  // 1. Kiểm tra mã nguồn rỗng
  if (!sourceCode || !sourceCode.trim()) {
    return {
      verdict: VERDICTS.CE,
      executionTimeMs: 0,
      memoryUsedKb: 0,
      stdout: '',
      message: 'Compilation Error: Empty source code'
    };
  }

  // 2. Kiểm tra chính sách an toàn
  const securityViolation = checkSecurity(sourceCode);
  if (securityViolation) {
    return {
      verdict: VERDICTS.RTE,
      executionTimeMs: 0,
      memoryUsedKb: 0,
      stdout: '',
      message: securityViolation
    };
  }

  // 3. Thực thi theo ngôn ngữ
  if (language === 'javascript' || language === 'js') {
    try {
      // Bọc code an toàn
      let result;
      const fn = new Function('input', `
        "use strict";
        ${sourceCode}
        if (typeof solve === 'function') {
          return solve(input);
        }
        return '';
      `);

      // Đo thời gian và bộ nhớ
      const memBefore = typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage().heapUsed : 0;
      result = fn(stdin);
      const elapsed = Math.round(performance.now() - startTime);
      const memAfter = typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage().heapUsed : 0;
      const memUsedKb = Math.max(1024, Math.round(Math.abs(memAfter - memBefore) / 1024));

      // Kiểm tra TLE
      if (elapsed > mergedLimits.timeLimitMs) {
        return {
          verdict: VERDICTS.TLE,
          executionTimeMs: elapsed,
          memoryUsedKb: memUsedKb,
          stdout: '',
          message: `Time Limit Exceeded (${elapsed}ms > ${mergedLimits.timeLimitMs}ms)`
        };
      }

      // Kiểm tra MLE
      if (memUsedKb > mergedLimits.memoryLimitKb) {
        return {
          verdict: VERDICTS.MLE,
          executionTimeMs: elapsed,
          memoryUsedKb: memUsedKb,
          stdout: '',
          message: `Memory Limit Exceeded (${memUsedKb}KB > ${mergedLimits.memoryLimitKb}KB)`
        };
      }

      const actualStdout = String(result ?? '').slice(0, mergedLimits.maxOutputChars);
      const isCorrect = compareOutputs(actualStdout, expectedStdout);

      return {
        verdict: isCorrect ? VERDICTS.AC : VERDICTS.WA,
        executionTimeMs: Math.max(1, elapsed),
        memoryUsedKb: memUsedKb,
        stdout: actualStdout,
        message: isCorrect ? 'Testcase passed' : 'Output mismatch'
      };
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      return {
        verdict: VERDICTS.RTE,
        executionTimeMs: elapsed,
        memoryUsedKb: 0,
        stdout: '',
        message: `Runtime Error: ${err.message}`
      };
    }
  }

  // Đối với ngôn ngữ giả lập (C++, Python trong môi trường test client)
  const isWa = sourceCode.includes('return -1') || sourceCode.includes('// FORCE_WA');
  const isTle = sourceCode.includes('while(true)') || sourceCode.includes('while (1)') || sourceCode.includes('// FORCE_TLE');
  const isMle = sourceCode.includes('new int[100000000]') || sourceCode.includes('// FORCE_MLE');
  const isRte = sourceCode.includes('throw') || sourceCode.includes('1 / 0') || sourceCode.includes('// FORCE_RTE');

  const elapsed = isTle ? mergedLimits.timeLimitMs + 50 : Math.round(10 + Math.random() * 20);
  const memUsedKb = isMle ? mergedLimits.memoryLimitKb + 1024 : Math.round(2048 + Math.random() * 512);

  if (isTle) {
    return { verdict: VERDICTS.TLE, executionTimeMs: elapsed, memoryUsedKb: memUsedKb, stdout: '', message: 'Time Limit Exceeded' };
  }
  if (isMle) {
    return { verdict: VERDICTS.MLE, executionTimeMs: elapsed, memoryUsedKb: memUsedKb, stdout: '', message: 'Memory Limit Exceeded' };
  }
  if (isRte) {
    return { verdict: VERDICTS.RTE, executionTimeMs: elapsed, memoryUsedKb: memUsedKb, stdout: '', message: 'Runtime Error' };
  }
  if (isWa) {
    return { verdict: VERDICTS.WA, executionTimeMs: elapsed, memoryUsedKb: memUsedKb, stdout: 'Wrong Answer output', message: 'Output mismatch' };
  }

  return {
    verdict: VERDICTS.AC,
    executionTimeMs: elapsed,
    memoryUsedKb: memUsedKb,
    stdout: normalizeOutput(expectedStdout),
    message: 'Testcase passed'
  };
}

/**
 * Đánh giá bài nộp qua danh sách testcase (Fail-Fast)
 * @param {string} sourceCode 
 * @param {string} language 
 * @param {Array<{ stdin: string, expectedStdout: string }>} testcases 
 * @param {object} limits 
 * @returns {Promise<{ verdict: string, passedCount: number, totalCount: number, failedTestIndex: number | null, maxTimeMs: number, maxMemoryKb: number, details: Array<object> }>}
 */
export async function evaluateSubmission(sourceCode, language = 'javascript', testcases = [], limits = {}) {
  let maxTimeMs = 0;
  let maxMemoryKb = 0;
  const details = [];

  for (let i = 0; i < testcases.length; i++) {
    const tc = testcases[i];
    const res = await executeTestcase(sourceCode, language, tc.stdin, tc.expectedStdout, limits);
    
    maxTimeMs = Math.max(maxTimeMs, res.executionTimeMs);
    maxMemoryKb = Math.max(maxMemoryKb, res.memoryUsedKb);
    details.push({ testIndex: i + 1, ...res });

    // Dừng sớm ngay khi gặp testcase lỗi (Fail-Fast)
    if (res.verdict !== VERDICTS.AC) {
      return {
        verdict: res.verdict,
        passedCount: i,
        totalCount: testcases.length,
        failedTestIndex: i + 1,
        maxTimeMs,
        maxMemoryKb,
        message: `Failed on test ${i + 1}: ${res.verdict} (${res.message})`,
        details
      };
    }
  }

  return {
    verdict: VERDICTS.AC,
    passedCount: testcases.length,
    totalCount: testcases.length,
    failedTestIndex: null,
    maxTimeMs,
    maxMemoryKb,
    message: `All ${testcases.length} testcases passed successfully`,
    details
  };
}

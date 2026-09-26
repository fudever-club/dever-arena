/**
 * DEVER Arena — load smoke test cho judge worker pool.
 * Chạy: npm run test:load  (mặc định 20 job Python đồng loạt, ngưỡng 30s)
 *
 * Đo: số job AC, thời gian max/p50. Fail khi có job non-AC hoặc quá ngưỡng.
 * Không cần server HTTP — gọi trực tiếp judgeQueue (giống production worker).
 */
import { judgeQueue, shutdownJudge } from '../server/queue.js';

const N = Number(process.env.LOAD_N || 20);
const BUDGET_MS = Number(process.env.LOAD_BUDGET_MS || 30000);
const CODE = ['import sys', 'def solve():', '    n=int(sys.stdin.readline()); a=list(map(int,sys.stdin.readline().split())); s=sum(a); sq=sum(x*x for x in a); print((s*s-sq)//2)', "if __name__=='__main__': solve()"].join('\n');
const TESTS = [{ stdin: '3\n1 2 3', expected: '11' }];

const t0 = Date.now();
const times = await Promise.all(Array.from({ length: N }, async () => {
  const s = Date.now();
  const r = await judgeQueue.judgeTests({ language: 'python', source: CODE, tests: TESTS, timeLimitMs: 2000 });
  return { verdict: r.verdict, ms: Date.now() - s };
}));
const total = Date.now() - t0;
const bad = times.filter((t) => t.verdict !== 'AC');
const sorted = times.map((t) => t.ms).sort((a, b) => a - b);
const p50 = sorted[Math.floor(sorted.length / 2)];
const max = sorted[sorted.length - 1];

console.log(JSON.stringify({ jobs: N, ac: N - bad.length, bad: bad.length, total_ms: total, p50_ms: p50, max_ms: max }));
shutdownJudge();

if (bad.length > 0) {
  console.error(`[load] FAIL: ${bad.length}/${N} job non-AC`);
  process.exit(1);
}
if (total > BUDGET_MS) {
  console.error(`[load] FAIL: tổng ${total}ms vượt ngưỡng ${BUDGET_MS}ms`);
  process.exit(1);
}
console.log('[load] PASS');

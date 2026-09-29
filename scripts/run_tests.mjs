/**
 * DEVER Arena — test runner cross-platform cho CI.
 * Chạy toàn bộ tests/*.test.js TRỪ 2 bộ browser (spa_e2e, a11y_axe) —
 * các bộ đó cần Chromium, CI chạy riêng sau `npx playwright install chromium`.
 * Zero-dep, chạy được trên Windows (cmd) lẫn Linux (sh).
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const BROWSER_TESTS = new Set(['spa_e2e.test.js', 'a11y_axe.test.js']);

const files = readdirSync('tests')
  .filter((f) => f.endsWith('.test.js') && !BROWSER_TESTS.has(f))
  .sort()
  .map((f) => join('tests', f));

console.log(`[run_tests] ${files.length} file test (không gồm browser):`);
for (const f of files) console.log(`  - ${f}`);

const res = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(res.status ?? 1);

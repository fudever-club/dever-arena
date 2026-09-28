#!/usr/bin/env node
/**
 * DEVER Arena — a11y scan standalone (Task 113 helper): chạy server+Vite, quét axe,
 * dump CHI TIẾT từng node vi phạm (selector + html snippet + contrast ratio) để fix chính xác.
 * Chạy: node scripts/a11y_scan.mjs [hash1 hash2 ...]  (mặc định: tất cả trang)
 */
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const DB_PATH = join(tmpdir(), `dever-a11y-scan.json`);
process.env.DEVER_DB_PATH = DB_PATH;
process.env.PORT = '8787';
process.env.SCHEDULER_DISABLED = '1';
try { rmSync(DB_PATH, { force: true }); } catch {}

const { startServer, shutdownJudge } = await import('../server/index.js');
const AXE_SRC = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const API_PORT = 18789;
const WEB = 'http://localhost:5176/app.html#/';

async function waitFor(url, timeoutMs = 45000) {
  const t0 = Date.now();
  for (;;) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    if (Date.now() - t0 > timeoutMs) throw new Error(`Timeout ${url}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

const server = startServer(API_PORT);
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5176', '--strictPort'], {
  cwd: process.cwd(), stdio: 'ignore',
  env: { ...process.env, BROWSER: 'none', DEVER_API_PORT: String(API_PORT) },
});
await waitFor(WEB);
const exePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || join(
  process.env.USERPROFILE || process.env.HOME || tmpdir(),
  'AppData', 'Local', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'
);
let browser;
try { browser = await chromium.launch({ executablePath: exePath }); } catch { browser = await chromium.launch(); }

const pages = process.argv.slice(2).length ? process.argv.slice(2)
  : ['', 'login', 'arena', 'standings', 'problemset', 'problem/p102', 'profile', 'compare?a=dever_hero&b=hacker_pro', 'contest/dever-round-0-archive/summary'];

const page = await browser.newPage();

// Đăng nhập 1 lần nếu cần
await page.goto(`${WEB}login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const heroBtn = page.locator('button', { hasText: 'dever_hero' }).first();
if (await heroBtn.count()) {
  await heroBtn.click();
  await page.waitForFunction(() => localStorage.getItem('dever_jwt'), null, { timeout: 15000 }).catch(() => {});
}

const all = {};
for (const hash of pages) {
  await page.goto(`${WEB}${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.evaluate(AXE_SRC);
  const results = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
  const sc = (results.violations || []).filter((v) => ['critical', 'serious'].includes(v.impact));
  if (sc.length) {
    all[`#/${hash}`] = sc.map((v) => ({
      id: v.id, impact: v.impact, help: v.help,
      nodes: v.nodes.slice(0, 12).map((n) => {
        const cc = (n.any || []).find((x) => x.id === 'color-contrast');
        return {
          target: n.target.join(' '),
          html: n.html.slice(0, 160),
          contrast: cc?.data ? `${cc.data.fgColor} on ${cc.data.bgColor} = ${cc.data.contrastRatio}` : undefined,
        };
      }),
    }));
  }
}

console.log(JSON.stringify(all, null, 1));

try { await browser.close(); } catch {}
try { execSync(`taskkill /PID ${vite.pid} /T /F`, { stdio: 'ignore' }); } catch {}
try { await new Promise((r) => server.close(r)); } catch {}
shutdownJudge();
try { rmSync(DB_PATH, { force: true }); } catch {}
process.exit(0);

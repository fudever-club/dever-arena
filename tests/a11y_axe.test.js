/**
 * DEVER Arena — Task 113: a11y audit toàn app với axe-core chạy trong E2E (Chromium thật).
 * Quét 9 trang chính (guest + đã đăng nhập), gate mức **serious/critical = 0**.
 * moderate/minor chỉ ghi nhận trong output để lần sau nâng gate — không fail CI.
 * Dựng server + Vite y hệt spa_e2e.test.js (port riêng, kill cây process).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const DB_PATH = join(tmpdir(), `dever-a11y-${process.pid}.json`);
process.env.DEVER_DB_PATH = DB_PATH;
process.env.PORT = '8787';
process.env.SCHEDULER_DISABLED = '1';
try { rmSync(DB_PATH, { force: true }); } catch {}

const { startServer } = await import('../server/index.js');
const { shutdownJudge } = await import('../server/queue.js');

const AXE_SRC = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

let server;
let vite;
let browser;
const API_PORT = 18788;
const WEB = 'http://localhost:5175/app.html#/';

async function waitFor(url, timeoutMs = 45000) {
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    if (Date.now() - t0 > timeoutMs) throw new Error(`Timeout chờ ${url}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

before(async () => {
  try { rmSync(DB_PATH, { force: true }); } catch {}
  server = startServer(API_PORT);
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5175', '--strictPort'], {
    cwd: process.cwd(), stdio: 'ignore',
    env: { ...process.env, BROWSER: 'none', DEVER_API_PORT: String(API_PORT) },
  });
  await waitFor('http://localhost:5175/app.html');
  const exePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || join(
    process.env.USERPROFILE || process.env.HOME || tmpdir(),
    'AppData', 'Local', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'
  );
  try {
    browser = await chromium.launch({ executablePath: exePath });
  } catch {
    browser = await chromium.launch();
  }
});

function killTree(proc) {
  if (!proc || proc.exitCode !== null) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' });
    } else {
      proc.kill('SIGKILL');
    }
  } catch {
    try { proc.kill(); } catch {}
  }
}

after(async () => {
  try { await browser?.close(); } catch {}
  killTree(vite);
  try { await new Promise((r) => server.close(r)); } catch {}
  shutdownJudge();
  try { rmSync(DB_PATH, { force: true }); } catch {}
});

/** Đăng nhập bằng UI fast-switch (JWT thật) — tái dùng cho nhóm trang cần auth. */
async function loginHero(page) {
  await page.goto(`${WEB}login`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(document.querySelector('button')), null, { timeout: 15000 });
  const btn = page.locator('button', { hasText: 'dever_hero' }).first();
  await btn.click();
  await page.waitForFunction(() => localStorage.getItem('dever_jwt'), null, { timeout: 15000 });
}

/**
 * Chạy axe trên 1 trang. Trả về { seriousCritical, moderateMinor, report }.
 * Chỉ quét lỗi có thể sửa từ code của ta (disable rule phụ thuộc third-party như katex/svg nội bộ).
 */
async function axeScan(page, hash) {
  await page.goto(`${WEB}${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900); // SPA render xong (lazy load + fetch)
  await page.evaluate(AXE_SRC);
  const results = await page.evaluate(() => window.axe.run(document, {
    resultTypes: ['violations'],
    rules: {
      // Region/main là best-practice mức moderate — ghi nhận nhưng không chặn gate serious.
      'region': { enabled: false },
    },
  }));
  const violations = results.violations || [];
  const seriousCritical = violations.filter((v) => ['critical', 'serious'].includes(v.impact));
  const moderateMinor = violations.filter((v) => !['critical', 'serious'].includes(v.impact));
  const fmt = (list) => list.map((v) => `${v.id}[${v.impact}] ×${v.nodes.length}: ${v.help}`).join('; ');
  return {
    seriousCritical,
    moderateMinor,
    report: { serious: fmt(seriousCritical), minor: fmt(moderateMinor) },
  };
}

const GUEST_PAGES = ['', 'login'];
const AUTH_PAGES = ['arena', 'standings', 'problemset', 'problem/p102', 'profile', 'compare?a=dever_hero&b=hacker_pro', 'contest/dever-round-0-archive/summary'];

test('a11y: trang guest (landing, login) — 0 serious/critical', async () => {
  const page = await browser.newPage();
  for (const hash of GUEST_PAGES) {
    const { seriousCritical, report } = await axeScan(page, hash);
    assert.deepEqual(
      seriousCritical.map((v) => v.id),
      [],
      `Trang #/${hash} còn lỗi serious/critical: ${report.serious}`,
    );
    if (report.minor) console.log(`[a11y] #/${hash} → moderate/minor: ${report.minor}`);
  }
  await page.close();
});

test('a11y: đăng nhập + 7 trang thí sinh — 0 serious/critical', async () => {
  const page = await browser.newPage();
  await loginHero(page);
  for (const hash of AUTH_PAGES) {
    const { seriousCritical, report } = await axeScan(page, hash);
    assert.deepEqual(
      seriousCritical.map((v) => v.id),
      [],
      `Trang #/${hash} còn lỗi serious/critical: ${report.serious}`,
    );
    if (report.minor) console.log(`[a11y] #/${hash} → moderate/minor: ${report.minor}`);
  }
  await page.close();
});

test('a11y: focus-visible ring hoạt động trên input đầu trang login', async () => {
  const page = await browser.newPage();
  await page.goto(`${WEB}login`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const hasRing = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    return (s.outlineStyle !== 'none' && s.outlineWidth !== '0px') || (s.boxShadow !== 'none' && s.boxShadow !== '');
  });
  assert.equal(hasRing, true, 'Phần tử focus đầu tiên phải có outline hoặc ring hiển thị');
  await page.close();
});

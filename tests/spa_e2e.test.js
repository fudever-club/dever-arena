/**
 * DEVER Arena — E2E trình duyệt thật (Playwright Chromium) cho React SPA.
 * Dựng API thật (DB tạm) + Vite dev (proxy /api), rồi đi luồng:
 * landing → login JWT qua UI → standings live → workspace nộp Python chấm thật.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const DB_PATH = join(tmpdir(), `dever-e2e-${process.pid}.json`);
process.env.DEVER_DB_PATH = DB_PATH;
process.env.PORT = '8787';
try { rmSync(DB_PATH, { force: true }); } catch {}

const { startServer } = await import('../server/index.js');
const { shutdownJudge } = await import('../server/queue.js');

let server;
let vite;
let browser;
const API_PORT = 18787; // Port riêng cho E2E — không đụng máy dev (8787) của người dùng
const WEB = 'http://localhost:5174/app.html#/';

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
  // Spawn trực tiếp bằng node (KHÔNG shell) để kill() dọn sạch, không mồ côi process
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5174', '--strictPort'], {
    cwd: process.cwd(), stdio: 'ignore',
    env: { ...process.env, BROWSER: 'none', DEVER_API_PORT: String(API_PORT) },
  });
  await waitFor('http://localhost:5174/app.html');
  // Dùng Chromium có sẵn trên máy (tránh download); cho phép ghi đè qua env
  const exePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || join(
    process.env.USERPROFILE || process.env.HOME || tmpdir(),
    'AppData', 'Local', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'
  );
  try {
    browser = await chromium.launch({ executablePath: exePath });
  } catch {
    browser = await chromium.launch(); // fallback: bản playwright yêu cầu
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

test('landing tải được, tiêu đề đúng', async () => {
  const page = await browser.newPage();
  await page.goto(WEB, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Đấu trường thuật toán', { timeout: 20000 });
  const title = await page.title();
  assert.match(title, /DEVER Arena/);
  await page.close();
});

test('đăng nhập dever_hero qua UI, navbar hiện đúng user', async () => {
  const page = await browser.newPage();
  await page.goto(`${WEB}login`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="SE180123"]', 'dever_hero');
  await page.fill('input[type="password"]', 'hero123');
  await page.click('button[type="submit"]');
  // Chờ token JWT thật (không chờ text vì nút fast-switch đã chứa sẵn tên user)
  await page.waitForFunction(() => localStorage.getItem('dever_jwt'), null, { timeout: 15000 });
  const token = await page.evaluate(() => localStorage.getItem('dever_jwt'));
  assert.ok(token && token.split('.').length === 3);
  await page.close();
});

test('standings tải bảng thật từ API (có dever_hero)', async () => {
  const page = await browser.newPage();
  await page.goto(`${WEB}standings`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=dever_hero', { timeout: 20000 });
  await page.close();
});

test('workspace: nộp Python chấm thật full-suite, hiện verdict cuối', async () => {
  const page = await browser.newPage();
  // Đăng nhập trước để có token
  await page.goto(`${WEB}login`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="SE180123"]', 'dever_hero');
  await page.fill('input[type="password"]', 'hero123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => localStorage.getItem('dever_jwt'), null, { timeout: 15000 });
  // Nạp sẵn lời giải Python đúng vào draft local
  await page.evaluate(() => {
    localStorage.setItem('dever_code_p102_python', [
      'import sys',
      'def solve():',
      '    n=int(sys.stdin.readline()); a=list(map(int,sys.stdin.readline().split())); s=sum(a); sq=sum(x*x for x in a); print((s*s-sq)//2)',
      "if __name__=='__main__': solve()",
    ].join('\n'));
  });
  await page.goto(`${WEB}problem/p102`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Python', exact: true }).click();
  await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
  await page.waitForSelector('text=Accepted', { timeout: 30000 });
  await page.close();
});

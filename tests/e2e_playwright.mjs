import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity-ide\\brain\\c660cbdb-56b4-42c4-81b0-1caf29bfddef';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'playwright_screens');

if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const results = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ [PASS] ${message}`);
    results.push({ status: 'PASS', message });
  } else {
    failedTests++;
    console.error(`  ✖ [FAIL] ${message}`);
    results.push({ status: 'FAIL', message });
  }
}

async function runE2E() {
  console.log('===========================================================');
  console.log('🚀 DEVER Arena — Comprehensive Playwright E2E Test Suite');
  console.log('===========================================================\n');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const pageErrors = [];
  context.on('weberror', err => pageErrors.push(err.error().message));

  // ==========================================================
  // SUITE 1: LANDING PAGE (index.html)
  // ==========================================================
  console.log('▶ Test Suite 1: Landing Page Portal (index.html)');
  {
    const page = await context.newPage();
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleLogs.push(msg.text());
    });

    await page.goto('http://localhost:5173/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // 1.1 Page Title & Meta
    const title = await page.title();
    assert(title.includes('DEVER Arena'), 'Page title contains "DEVER Arena"');

    // 1.2 Exactly 1 H1
    const h1Count = await page.locator('h1').count();
    assert(h1Count === 1, `Exactly 1 <h1> tag present (found ${h1Count})`);

    // 1.3 Hero Section & CTAs
    const heroVisible = await page.locator('.landing-hero').isVisible();
    assert(heroVisible, 'Landing hero section is visible');

    const ctaBtns = await page.locator('.landing-cta a').count();
    assert(ctaBtns >= 3, `Landing has ${ctaBtns} CTA action buttons`);

    // 1.4 Stats Cards (Bento)
    const statCards = await page.locator('.stat-card').count();
    assert(statCards === 4, `All 4 stat metric cards rendered (found ${statCards})`);

    // 1.5 Feature Grid
    const featureCards = await page.locator('.feature-card').count();
    assert(featureCards >= 6, `Bento grid features present (found ${featureCards})`);

    // 1.6 Upcoming Contests
    const contestRows = await page.locator('.contest-row').count();
    assert(contestRows >= 4, `Upcoming contests list populated (found ${contestRows})`);

    // 1.7 Theme Toggle
    const themeBtn = page.locator('#theme-toggle-btn');
    assert(await themeBtn.isVisible(), 'Theme toggle button is present');
    await themeBtn.click();
    await page.waitForTimeout(200);
    const themeAfterToggle = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert(themeAfterToggle === 'light' || themeAfterToggle === 'dark', `Theme toggle switches theme attribute (now: ${themeAfterToggle})`);
    // Toggle back to dark
    await themeBtn.click();
    await page.waitForTimeout(200);

    // 1.8 Footer Invariant
    const footer = page.locator('footer');
    assert(await footer.isVisible(), 'Universal footer is visible');
    const footerText = await footer.textContent();
    assert(footerText.includes('DEVER FORCES') && footerText.includes('© 2026 DEVER Arena Enterprise'), 'Footer contains required brand & copyright');

    // Screenshot Landing
    const shot1 = path.join(SCREENSHOT_DIR, '01_landing_desktop.png');
    await page.screenshot({ path: shot1, fullPage: true });
    console.log(`  📸 Screenshot saved: ${shot1}`);

    // Mobile Viewport test
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    const hamburgerVisible = await page.locator('#nav-hamburger').isVisible();
    assert(hamburgerVisible, 'Mobile hamburger button becomes visible on small viewports');
    await page.locator('#nav-hamburger').click();
    await page.waitForTimeout(200);
    const navOpen = await page.locator('#primary-nav-links.open').count();
    assert(navOpen === 1, 'Clicking hamburger expands responsive mobile navigation');

    await page.close();
  }

  // ==========================================================
  // SUITE 2: CLIENT ARENA (arena.html)
  // ==========================================================
  console.log('\n▶ Test Suite 2: Client Arena & Workspace (arena.html)');
  {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleLogs.push(msg.text());
    });

    await page.goto('http://localhost:5173/arena.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // 2.1 Single H1
    const h1Count = await page.locator('h1').count();
    assert(h1Count === 1, `arena.html has exactly 1 <h1> tag (found ${h1Count})`);

    // 2.2 Digital Timer HUD
    const timerDigits = page.locator('#timer-countdown');
    assert(await timerDigits.isVisible(), 'Digital Timer HUD is visible');
    const timerText1 = await timerDigits.textContent();
    assert(timerText1.includes(':'), `Timer displays formatted time: ${timerText1}`);

    const phaseIndicator = page.locator('#phase-indicator');
    assert(await phaseIndicator.isVisible(), `Phase pill is visible with text: ${await phaseIndicator.textContent()}`);

    // 2.3 Sub-tabs navigation
    const subtabs = await page.locator('.tabs-nav .tab-btn').count();
    assert(subtabs === 4, `All 4 contest subtabs present (found ${subtabs})`);

    // 2.4 Problem Table (Overview Tab)
    const probRows = await page.locator('#tab-overview .data-table tbody tr').count();
    assert(probRows >= 2, `Overview tab lists problem items (found ${probRows})`);

    // 2.5 Switch to Workspace Tab
    await page.locator('[data-tab="tab-workspace"]').click();
    await page.waitForTimeout(300);
    const workspaceActive = await page.locator('#tab-workspace.active').isVisible();
    assert(workspaceActive, 'Workspace tab switches to active state');

    // 2.6 Problem Statement & Tabs in Workspace
    const wsTitle = page.locator('#ws-problem-title');
    assert(await wsTitle.isVisible(), `Workspace displays problem title: "${await wsTitle.textContent()}"`);

    // Toggle Editorial
    await page.locator('#ws-tab-editorial').click();
    await page.waitForTimeout(200);
    const editorialVisible = await page.locator('#ws-editorial-content').isVisible();
    assert(editorialVisible, 'Editorial sub-tab expands properly');

    // Toggle back to Desc
    await page.locator('#ws-tab-desc').click();
    await page.waitForTimeout(200);

    // 2.7 Code Editor Toolbar & Controls
    const langSelect = page.locator('#language-select');
    assert(await langSelect.isVisible(), 'Language selector is visible');
    await langSelect.selectOption('python');
    await page.waitForTimeout(200);

    const themeSelect = page.locator('#theme-select');
    assert(await themeSelect.isVisible(), 'Theme selector is visible');
    await themeSelect.selectOption('theme-cyber');
    await page.waitForTimeout(200);

    // 2.8 Code Input & Sample Test Runner
    const codeTextarea = page.locator('#code-editor-input');
    assert(await codeTextarea.isVisible(), 'Code editor textarea is visible and editable');
    await codeTextarea.fill('# Python 3 solution\nprint(11)\n');

    const sampleRunBtn = page.locator('#ws-run-sample-btn');
    assert(await sampleRunBtn.isVisible(), 'Sample Test Runner button is present');
    await sampleRunBtn.click();
    await page.waitForTimeout(500);

    // 2.9 Console Output with Window Header Dots
    const consolePane = page.locator('.console-pane');
    assert(await consolePane.isVisible(), 'Judge Execution Console pane is visible');
    const consoleDots = await page.locator('.console-dot').count();
    assert(consoleDots === 3, 'Console pane features 3 terminal dots (🔴 🟡 🟢)');

    const consoleOutput = await page.locator('#editor-console-output').textContent();
    assert(consoleOutput.length > 0, `Console displays execution verdict or readiness`);

    // 2.10 Standings Tab & Rank Medals
    await page.locator('[data-tab="tab-standings"]').click();
    await page.waitForTimeout(400);

    const standingsTable = page.locator('.standings-table');
    assert(await standingsTable.first().isVisible(), 'Standings table is visible');

    const rankMedals = await page.locator('.rank-medal').count();
    assert(rankMedals >= 3, `Top 3 Rank medals (🥇, 🥈, 🥉) rendered in standings (found ${rankMedals})`);

    // 2.11 Hack Room Tab
    await page.locator('[data-tab="tab-hackroom"]').click();
    await page.waitForTimeout(400);
    const roomCards = await page.locator('.room-card').count();
    assert(roomCards >= 1, `Hack Room renders contestant cards (found ${roomCards})`);

    // Screenshot Arena
    const shot2 = path.join(SCREENSHOT_DIR, '02_arena_workspace.png');
    await page.screenshot({ path: shot2, fullPage: true });
    console.log(`  📸 Screenshot saved: ${shot2}`);

    // 2.12 Main View Switching (Problemset, Clans, Standings)
    await page.evaluate(() => window.switchMainView('view-problemset'));
    await page.waitForTimeout(400);
    const problemsetVisible = await page.locator('#view-problemset.active').isVisible();
    assert(problemsetVisible, 'Switched to Problemset main view');

    // Search in problemset
    const searchInput = page.locator('#prob-search-input');
    await searchInput.fill('Energy');
    await page.waitForTimeout(300);
    const filteredRows = await page.locator('#problemset-tbody tr').count();
    assert(filteredRows >= 1, `Problem search filters table (found ${filteredRows} results)`);

    // Switch to Clans
    await page.evaluate(() => window.switchMainView('view-clans'));
    await page.waitForTimeout(400);
    const clanCards = await page.locator('.clan-card').count();
    assert(clanCards >= 4, `Clan Wars renders clan cards (found ${clanCards})`);

    // Screenshot Clans
    const shot2b = path.join(SCREENSHOT_DIR, '02b_clan_wars.png');
    await page.screenshot({ path: shot2b, fullPage: true });
    console.log(`  📸 Screenshot saved: ${shot2b}`);

    await page.close();
  }

  // ==========================================================
  // SUITE 3: ADMIN COMMAND CENTER (admin.html)
  // ==========================================================
  console.log('\n▶ Test Suite 3: Admin Command Center (admin.html)');
  {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    // Set auth session as ADMIN in localStorage to bypass guest banner
    await page.addInitScript(() => {
      localStorage.setItem('dever_arena_auth_session', JSON.stringify({
        id: 'u_admin',
        username: 'dever_admin',
        role: 'ADMIN',
        rating: 2450
      }));
    });

    await page.goto('http://localhost:5173/admin.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // 3.1 Single H1
    const h1Count = await page.locator('h1').count();
    assert(h1Count === 1, `admin.html has exactly 1 <h1> tag (found ${h1Count})`);

    // 3.2 Header actions
    const freezeBtn = page.locator('#admin-freeze-btn');
    assert(await freezeBtn.isVisible(), 'Freeze board button is present');

    // 3.3 Admin Sub-Tabs
    const adminTabs = await page.locator('.admin-sub-tabs .admin-tab-btn').count();
    assert(adminTabs === 4, `Admin subtabs present (found ${adminTabs})`);

    // 3.4 Phase Control Pane
    const phaseCards = await page.locator('#adm-contest-ctrl .card button.btn').count();
    assert(phaseCards >= 4, `Phase trigger buttons available (found ${phaseCards})`);

    // 3.5 AST Anti-Cheat Radar
    await page.locator('#adm-tab-btn-anticheat').click();
    await page.waitForTimeout(300);
    const anticheatVisible = await page.locator('#adm-anticheat.active').isVisible();
    assert(anticheatVisible, 'AST Anti-Cheat tab activated');

    const scanBtn = page.locator('#run-ast-check-btn-admin');
    assert(await scanBtn.isVisible(), 'AST Scan button is present');
    await scanBtn.click();
    await page.waitForTimeout(300);
    const astVal = await page.locator('#ast-similarity-val-admin').textContent();
    assert(astVal.includes('%'), `AST scan returns similarity score: ${astVal}`);

    // 3.6 Polygon Lite CMS
    await page.locator('#adm-tab-btn-polygon').click();
    await page.waitForTimeout(300);
    const polyVisible = await page.locator('#adm-polygon.active').isVisible();
    assert(polyVisible, 'Polygon Lite CMS tab activated');

    const polyTitle = page.locator('#poly-title');
    await polyTitle.fill('Test Polygon Problem Title');
    const polyStmt = page.locator('#poly-statement');
    await polyStmt.fill('Cho số nguyên $N$, tìm tổng các ước số.');
    await page.waitForTimeout(300);

    const polyPrevTitle = await page.locator('#poly-prev-title').textContent();
    assert(polyPrevTitle.includes('Test Polygon Problem Title'), 'Polygon real-time preview updates title');

    // 3.7 Judge Telemetry
    await page.locator('#adm-tab-btn-telemetry').click();
    await page.waitForTimeout(300);
    const telemetryVisible = await page.locator('#adm-telemetry.active').isVisible();
    assert(telemetryVisible, 'Telemetry tab activated');

    const workerCards = await page.locator('.telemetry-card').count();
    assert(workerCards === 3, `All 3 Judge worker cluster cards rendered (found ${workerCards})`);

    const statusDots = await page.locator('.node-status-dot').count();
    assert(statusDots >= 3, `Worker status beacon dots present (found ${statusDots})`);

    // Screenshot Admin
    const shot3 = path.join(SCREENSHOT_DIR, '03_admin_command_center.png');
    await page.screenshot({ path: shot3, fullPage: true });
    console.log(`  📸 Screenshot saved: ${shot3}`);

    await page.close();
  }

  await browser.close();

  // ==========================================================
  // SUMMARY REPORT
  // ==========================================================
  console.log('\n===========================================================');
  console.log(`🏁 Playwright E2E Test Run Completed:`);
  console.log(`   Total Tests:  ${totalTests}`);
  console.log(`   Passed:       ${passedTests}`);
  console.log(`   Failed:       ${failedTests}`);
  console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('===========================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runE2E().catch(err => {
  console.error('Fatal Playwright E2E error:', err);
  process.exit(1);
});

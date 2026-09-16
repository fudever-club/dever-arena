import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

console.log('===========================================================');
console.log('🧪 COMPREHENSIVE BUTTONS, FORBIDDEN STATES & STRUCTURE AUDIT');
console.log('===========================================================');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    failedChecks++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runAudit() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`    ⚠️ Browser Error: "${msg.text()}"`);
    }
  });

  // Handle native alerts automatically so tests don't hang
  page.on('dialog', async (dialog) => {
    console.log(`    💬 Dialog intercepted: [${dialog.type()}] "${dialog.message().slice(0, 50)}..."`);
    await dialog.accept();
  });

  // ==========================================
  // 1. AUDIT INDEX.HTML (LANDING)
  // ==========================================
  console.log('\n▶ Step 1: Testing all buttons on index.html');
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });

  // Test Theme Toggle
  const themeBtn = page.locator('#theme-toggle-btn');
  assert(await themeBtn.isVisible(), 'Theme toggle button is visible');
  await themeBtn.click();
  const themeAfterClick = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  assert(themeAfterClick === 'light', `Theme switched to light (got ${themeAfterClick})`);
  await themeBtn.click(); // revert to dark

  // Test CTA buttons
  const ctaArena = page.locator('a.btn:has-text("Vào Arena thi đấu")');
  assert(await ctaArena.isVisible(), 'CTA "Vào Arena thi đấu" is visible');
  assert(await ctaArena.getAttribute('href') === 'arena.html', 'CTA Arena points to arena.html');

  const ctaAdmin = page.locator('a.btn-secondary:has-text("Cổng Admin")');
  assert(await ctaAdmin.isVisible(), 'CTA "Cổng Admin" is visible');
  assert(await ctaAdmin.getAttribute('href') === 'admin.html', 'CTA Admin points to admin.html');

  const ctaProblemset = page.locator('a.btn-outline:has-text("Kho bài tập")');
  assert(await ctaProblemset.isVisible(), 'CTA "Kho bài tập" is visible');

  // Test Contest List Links
  const contestLinks = await page.locator('.contest-row a.btn').all();
  assert(contestLinks.length >= 2, `Found ${contestLinks.length} contest entry buttons`);

  // ==========================================
  // 2. AUDIT ARENA.HTML (CLIENT & WORKSPACE)
  // ==========================================
  console.log('\n▶ Step 2: Testing all buttons & forbidden states on arena.html');
  await page.goto(`${BASE_URL}/arena.html`, { waitUntil: 'networkidle' });

  // 2.1 Sound Toggle Button
  const soundBtn = page.locator('#sound-btn');
  assert(await soundBtn.isVisible(), 'Sound toggle button visible');
  await soundBtn.click();
  assert((await soundBtn.textContent()).includes('OFF'), 'Sound toggle switched to OFF');
  await soundBtn.click();
  assert((await soundBtn.textContent()).includes('ON'), 'Sound toggle switched back to ON');

  // 2.2 Sub-tabs Buttons
  const tabBtns = await page.locator('.tabs-nav .tab-btn').all();
  assert(tabBtns.length === 4, `All 4 subtabs exist (found ${tabBtns.length})`);
  for (const tab of tabBtns) {
    await tab.click();
    assert(await tab.evaluate(el => el.classList.contains('active')), `Subtab "${(await tab.textContent()).trim().slice(0, 15)}" activated on click`);
  }

  // 2.3 Workspace Problem Subtabs (Đề bài, Editorial, Thảo luận)
  await page.locator('.tabs-nav .tab-btn:has-text("Workspace")').click();
  
  const descTab = page.locator('#ws-tab-desc');
  const editTab = page.locator('#ws-tab-editorial');
  const discTab = page.locator('#ws-tab-discussions');
  
  assert(await descTab.isVisible(), 'Tab "Đề Bài" visible');
  assert(await editTab.isVisible(), 'Tab "Lời Giải (Editorial)" visible');
  assert(await discTab.isVisible(), 'Tab "Thảo Luận" visible');

  await editTab.click();
  assert(await page.locator('#ws-editorial-content').isVisible(), 'Editorial content rendered upon tab click');
  
  await discTab.click();
  assert(await page.locator('#ws-discussions-content').isVisible(), 'Discussions content rendered upon tab click');
  
  await descTab.click();
  assert(await page.locator('#ws-desc-content').isVisible(), 'Statement content active again');

  // 2.4 Workspace Action Buttons: Font size, Fullscreen, Download
  const fontPlus = page.locator('#font-increase-btn');
  const fontMinus = page.locator('#font-decrease-btn');
  assert(await fontPlus.isVisible() && await fontMinus.isVisible(), 'Font scaling buttons visible');
  await fontPlus.click();
  await fontMinus.click();

  const dlBtn = page.locator('#download-code-btn');
  assert(await dlBtn.isVisible(), 'Download code button visible');

  // 2.5 Run Sample Button
  const runSampleBtn = page.locator('#ws-run-sample-btn');
  assert(await runSampleBtn.isVisible(), 'Run Sample Test button visible');
  await runSampleBtn.click();
  await page.waitForTimeout(600);
  const consoleOutput = await page.locator('#editor-console-output').textContent();
  assert(consoleOutput.includes('[SANDBOX]') || consoleOutput.includes('ACCEPTED') || consoleOutput.includes('PASSED') || consoleOutput.includes('READY') || consoleOutput.includes('Output'), 'Console output updated after Run Sample click');

  // 2.6 Custom Test Modal
  const customTestBtn = page.locator('#custom-test-btn');
  assert(await customTestBtn.isVisible(), 'Custom Test button visible');
  await customTestBtn.click();
  assert(await page.locator('#custom-test-modal').isVisible(), 'Custom Test modal opened');
  const customCloseBtn = page.locator('#custom-test-close-btn');
  await customCloseBtn.click();
  assert(!await page.locator('#custom-test-modal').isVisible(), 'Custom Test modal closed cleanly');

  // 2.7 Diff Inspector Modal
  const diffBtn = page.locator('#inspect-diff-btn');
  assert(await diffBtn.isVisible(), 'Diff Inspector button visible');
  await diffBtn.click();
  assert(await page.locator('#diff-modal').isVisible(), 'Visual Diff modal opened');
  const diffCloseBtn = page.locator('#diff-close-btn');
  await diffCloseBtn.click();
  assert(!await page.locator('#diff-modal').isVisible(), 'Visual Diff modal closed cleanly');

  // 2.8 FORBIDDEN STATE TEST: Hack in Coding Phase
  console.log('\n▶ Step 2.8: Testing Forbidden Button States in Hack Room');
  await page.locator('.tabs-nav .tab-btn:has-text("Hack Room")').click();
  const hackBadges = await page.locator('.room-submissions .prob-badge-btn').all();
  assert(hackBadges.length >= 3, `Found ${hackBadges.length} problem badge buttons in Hack Room`);
  
  // Test locked button in Coding Phase
  const lockedBadge = page.locator('.prob-badge-btn:has-text("Khóa")').first();
  if (await lockedBadge.count() > 0) {
    assert(await lockedBadge.isVisible(), 'Locked hack button is displayed in Coding Phase');
    await lockedBadge.click(); // Should trigger non-blocking toast
  }

  // 2.9 Problemset Tag Filter Buttons
  console.log('\n▶ Step 2.9: Testing Problemset Filter Buttons');
  await page.locator('button.nav-link-btn:has-text("Kho Bài Tập")').click();
  assert(await page.locator('#view-problemset').isVisible(), 'Problemset view is now active');
  const filterPills = await page.locator('.tag-pill-btn').all();
  assert(filterPills.length >= 5, `Found ${filterPills.length} problemset filter pills`);
  for (const pill of filterPills.slice(0, 3)) {
    await pill.click();
    assert(await pill.evaluate(el => el.classList.contains('active')), `Filter pill "${await pill.textContent()}" activated on click`);
  }

  // 2.10 Discussions: Post comment & Upvote
  console.log('\n▶ Step 2.10: Testing Discussion & Upvote Functionality');
  await page.locator('button.nav-link-btn:has-text("Kỳ Thi")').click();
  await page.locator('.tabs-nav .tab-btn:has-text("Workspace")').click();
  await page.locator('#ws-tab-discussions').click();
  const upvoteBtn = page.locator('.upvote-btn').first();
  if (await upvoteBtn.isVisible()) {
    const prevText = await upvoteBtn.textContent();
    await upvoteBtn.click();
    assert(await upvoteBtn.isVisible(), 'Upvote button clicked successfully');
  }
  const commentInput = page.locator('#new-comment-input');
  const postCommentBtn = page.locator('#post-comment-btn');
  await commentInput.fill('Giải thuật tối ưu O(N) hoàn toàn chính xác!');
  await postCommentBtn.click();
  const discList = await page.locator('#discussion-threads-list').textContent();
  assert(discList.includes('Giải thuật tối ưu O(N)'), 'Newly posted comment appears in discussion list');

  // 2.11 FORBIDDEN STATE TEST: Empty Code Submission
  console.log('\n▶ Step 2.11: Testing Forbidden State — Empty Code Submission');
  await page.locator('#ws-tab-desc').click();
  const codeEditor = page.locator('#code-editor-input');
  const savedCode = await codeEditor.inputValue();
  await codeEditor.fill(''); // clear code
  const pretestBtn = page.locator('#run-code-btn');
  await pretestBtn.click();
  const consoleAfterEmpty = await page.locator('#editor-console-output').textContent();
  assert(consoleAfterEmpty.includes('[LỖI]') || consoleAfterEmpty.includes('trống'), 'Empty code submission is forbidden with error log');

  // 2.12 Pretest Submission with valid code
  console.log('\n▶ Step 2.12: Testing Pretest Submission Flow with Valid Code');
  await codeEditor.fill(savedCode || '#include <iostream>\nusing namespace std;\nint main() { cout << 11; return 0; }');
  await pretestBtn.click();
  await page.waitForTimeout(1400);
  const consoleAfterValid = await page.locator('#editor-console-output').textContent();
  assert(consoleAfterValid.includes('Pretests Passed') || consoleAfterValid.includes('AC') || consoleAfterValid.includes('✔'), 'Valid submission successfully passes pretests');

  // 2.13 Custom Test execution in modal
  console.log('\n▶ Step 2.13: Testing Custom Test Modal Execution');
  await page.locator('#custom-test-btn').click();
  const execCustomBtn = page.locator('#execute-custom-test-run');
  await execCustomBtn.click();
  await page.waitForTimeout(500);
  const customOut = await page.locator('#custom-output-box').textContent();
  assert(customOut.includes('Status') || customOut.includes('Output'), 'Custom test executed and returned output in modal');
  await page.locator('#custom-test-close-btn').click();

  // ==========================================
  // 3. AUDIT ADMIN.HTML (COMMAND CENTER)
  // ==========================================
  console.log('\n▶ Step 3: Testing all buttons on admin.html');
  await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'networkidle' });

  // 3.1 Freeze Board Button
  const freezeBtn = page.locator('#admin-freeze-btn');
  assert(await freezeBtn.isVisible(), 'Admin Freeze Board button visible');
  await freezeBtn.click();
  assert((await freezeBtn.textContent()).includes('Hủy Đóng Băng'), 'Button text switched to "Hủy Đóng Băng" upon Freeze click');
  await freezeBtn.click(); // unfreeze
  assert((await freezeBtn.textContent()).includes('Đóng Băng') || (await freezeBtn.textContent()).includes('Freeze'), 'Button text reverted upon Unfreeze click');

  // 3.2 Admin Sub-tabs
  const admSubtabs = [
    { id: 'adm-tab-btn-ctrl', panel: '#adm-contest-ctrl' },
    { id: 'adm-tab-btn-anticheat', panel: '#adm-anticheat' },
    { id: 'adm-tab-btn-polygon', panel: '#adm-polygon' },
    { id: 'adm-tab-btn-telemetry', panel: '#adm-telemetry' }
  ];

  for (const tab of admSubtabs) {
    const btn = page.locator(`#${tab.id}`);
    assert(await btn.isVisible(), `Admin subtab "${tab.id}" is visible`);
    await btn.click();
    assert(await page.locator(tab.panel).isVisible(), `Admin panel "${tab.panel}" became visible`);
  }

  // 3.3 Phase Control Buttons
  await page.locator('#adm-tab-btn-ctrl').click();
  const phaseBtns = await page.locator('#adm-contest-ctrl .btn').all();
  assert(phaseBtns.length >= 4, `Found ${phaseBtns.length} phase control action buttons`);

  // 3.4 AST Scan Button
  await page.locator('#adm-tab-btn-anticheat').click();
  const astScanBtn = page.locator('#run-ast-check-btn-admin');
  assert(await astScanBtn.isVisible(), 'AST Scan button visible');
  await astScanBtn.click();
  const simValue = await page.locator('#ast-similarity-val-admin').textContent();
  assert(simValue.includes('%'), `AST Scan executed and computed similarity: ${simValue}`);

  // 3.5 Disqualify Cheater 2-Click Button
  const dqBtn = page.locator('#btn-disqualify-cheater');
  assert(await dqBtn.isVisible(), 'Disqualify Cheater button visible');
  assert((await dqBtn.textContent()).includes('Truất quyền thi'), 'Initial state text is "Truất quyền thi"');
  await dqBtn.click();
  assert((await dqBtn.textContent()).includes('Nhấn lần nữa'), 'After 1st click, button asks for 2nd click confirmation');

  // 3.6 Polygon CMS Live Preview & Publish
  await page.locator('#adm-tab-btn-polygon').click();
  const publishBtn = page.locator('#publish-problem-btn');
  assert(await publishBtn.isVisible(), 'Polygon Publish Problem button visible');
  const titleInput = page.locator('#poly-title');
  await titleInput.fill('Problem Testlib Invariant X');
  const previewTitle = await page.locator('#poly-prev-title').textContent();
  assert(previewTitle.includes('Problem Testlib Invariant X'), 'Polygon live preview title dynamically updated');

  // 3.7 Emergency Announce Button
  const announceBtn = page.locator('button:has-text("📢 Thông báo khẩn")');
  assert(await announceBtn.isVisible(), 'Emergency Announce button is visible');

  // 3.8 FORBIDDEN / DESTRUCTIVE STATE TEST: Database Reset 2-Step Confirmation
  console.log('\n▶ Step 3.8: Testing Database Reset 2-Step Confirmation');
  await page.locator('#adm-tab-btn-telemetry').click();
  const resetDbBtn = page.locator('#reset-db-btn');
  assert(await resetDbBtn.isVisible(), 'Database reset button visible in Telemetry panel');
  await resetDbBtn.click();
  assert((await resetDbBtn.textContent()).includes('Nhấn lần nữa'), 'Database reset button requires 2nd click confirmation');

  // ==========================================
  // 4. FORMAT & STRUCTURE VERIFICATION
  // ==========================================
  console.log('\n▶ Step 4: HTML Format & Structural Validation');
  
  // Verify <h1> tag uniqueness
  for (const p of ['index.html', 'arena.html', 'admin.html']) {
    await page.goto(`${BASE_URL}/${p}`, { waitUntil: 'networkidle' });
    const h1Count = await page.locator('h1').count();
    assert(h1Count === 1, `${p} has exactly 1 <h1> tag (found ${h1Count})`);
  }

  // Verify console errors during all user interactions
  assert(consoleErrors.length === 0, `No unhandled console errors during button clicks (found ${consoleErrors.length})`);

  await browser.close();

  console.log('\n===========================================================');
  console.log(`🏁 BUTTONS & FORBIDDEN STATES AUDIT RESULTS:`);
  console.log(`   Total Checks:  ${totalChecks}`);
  console.log(`   Passed:        ${passedChecks}`);
  console.log(`   Failed:        ${failedChecks}`);
  console.log(`   Success Rate:  ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);
  console.log('===========================================================');

  if (failedChecks > 0) process.exit(1);
}

runAudit().catch(err => {
  console.error('Fatal Audit Error:', err);
  process.exit(1);
});

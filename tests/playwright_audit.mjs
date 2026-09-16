import { chromium } from 'playwright';

async function test() {
  console.log('Testing Playwright browser launch from workspace...');
  // 1. Try msedge (built into Windows)
  try {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    console.log('msedge launched successfully!');
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/index.html');
    const title = await page.title();
    console.log('Page title:', title);
    await browser.close();
    return 'msedge';
  } catch (err) {
    console.log('msedge failed:', err.message);
  }

  // 2. Try chrome
  try {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    console.log('chrome launched successfully!');
    await browser.close();
    return 'chrome';
  } catch (err) {
    console.log('chrome failed:', err.message);
  }

  // 3. Try default chromium
  try {
    const browser = await chromium.launch({ headless: true });
    console.log('Default Chromium launched successfully!');
    await browser.close();
    return 'chromium';
  } catch (err) {
    console.log('Default chromium failed:', err.message);
  }

  return 'none';
}

test().then(res => console.log('Final Result:', res));

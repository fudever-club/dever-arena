import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity-ide\\brain\\c660cbdb-56b4-42c4-81b0-1caf29bfddef\\devtools_reports';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

console.log('===========================================================');
console.log('🔬 Chrome DevTools Protocol & Browser Audit (DEVER Arena)');
console.log('===========================================================');

const pagesToAudit = [
  { name: 'Landing Portal', url: `${BASE_URL}/index.html`, screen: 'devtools_landing.png' },
  { name: 'Client Arena', url: `${BASE_URL}/arena.html`, screen: 'devtools_arena.png' },
  { name: 'Admin Center', url: `${BASE_URL}/admin.html`, screen: 'devtools_admin.png' }
];

const auditResults = [];

async function runDevToolsAudit() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const target of pagesToAudit) {
    console.log(`\n▶ Auditing: ${target.name} (${target.url})`);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    // Attach Chrome DevTools Protocol session
    const client = await context.newCDPSession(page);
    await client.send('Performance.enable');

    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];
    const networkRequests = [];
    const failedRequests = [];

    // 1. Console Listener
    page.on('console', (msg) => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log(`    ⚠️ Console Error: "${msg.text()}" at ${JSON.stringify(msg.location())}`);
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // 2. Network Listener
    page.on('request', (req) => {
      networkRequests.push({ url: req.url(), method: req.method(), resourceType: req.resourceType() });
    });

    page.on('response', (res) => {
      // Log any response status >= 400
      if (res.status() >= 400) {
        failedRequests.push({ url: res.url(), status: res.status() });
        console.log(`    ⚠️ HTTP ${res.status()} on: ${res.url()}`);
      }
    });

    page.on('requestfailed', (req) => {
      console.log(`    ⚠️ Request failed: ${req.url()} (${req.failure()?.errorText})`);
    });

    // Navigate to page
    const navStartTime = Date.now();
    await page.goto(target.url, { waitUntil: 'networkidle', timeout: 15000 });
    const navDuration = Date.now() - navStartTime;

    // 3. Performance Metrics via Navigation Timing & CDP
    const perfTiming = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const paint = performance.getEntriesByType('paint');
      const fp = paint.find(p => p.name === 'first-paint')?.startTime || 0;
      const fcp = paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0;

      return {
        dnsTime: Math.round(nav.domainLookupEnd - nav.domainLookupStart || 0),
        tcpTime: Math.round(nav.connectEnd - nav.connectStart || 0),
        ttfb: Math.round(nav.responseStart - nav.requestStart || 0),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime || 0),
        loadEvent: Math.round(nav.loadEventEnd - nav.startTime || 0),
        firstPaint: Math.round(fp),
        firstContentfulPaint: Math.round(fcp)
      };
    });

    // CDP Performance Metrics
    const cdpMetrics = await client.send('Performance.getMetrics');
    const metricMap = {};
    cdpMetrics.metrics.forEach(m => { metricMap[m.name] = m.value; });

    const nodesCount = metricMap['Nodes'] || 0;
    const jsHeapUsedSizeMB = ((metricMap['JSHeapUsedSize'] || 0) / (1024 * 1024)).toFixed(2);
    const jsHeapTotalSizeMB = ((metricMap['JSHeapTotalSize'] || 0) / (1024 * 1024)).toFixed(2);

    // 4. Accessibility Tree Inspection via CDP
    await client.send('Accessibility.enable');
    const axTree = await client.send('Accessibility.getFullAXTree');
    const a11yNodeCount = axTree.nodes ? axTree.nodes.length : 0;

    // Heading hierarchy check
    const headings = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(el => ({
        tag: el.tagName.toLowerCase(),
        text: el.innerText.trim().slice(0, 40)
      }));
    });

    const h1Count = headings.filter(h => h.tag === 'h1').length;

    // Screenshot capture
    const screenshotPath = path.join(ARTIFACT_DIR, target.screen);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const result = {
      name: target.name,
      url: target.url,
      navDurationMs: navDuration,
      consoleErrorsCount: consoleErrors.length + pageErrors.length,
      consoleErrors: [...consoleErrors, ...pageErrors],
      networkRequestsCount: networkRequests.length,
      failedRequestsCount: failedRequests.length,
      failedRequests,
      perfTiming,
      cdp: {
        nodesCount,
        jsHeapUsedSizeMB,
        jsHeapTotalSizeMB
      },
      a11y: {
        totalNodes: a11yNodeCount,
        h1Count,
        headingsCount: headings.length
      },
      screenshot: screenshotPath
    };

    auditResults.push(result);

    // Console output for this target
    console.log(`  ✔ Load Duration: ${navDuration}ms | FCP: ${perfTiming.firstContentfulPaint}ms | DOM Content Loaded: ${perfTiming.domContentLoaded}ms`);
    console.log(`  ✔ Memory & DOM: ${nodesCount} DOM nodes | JS Heap: ${jsHeapUsedSizeMB}MB / ${jsHeapTotalSizeMB}MB`);
    console.log(`  ✔ Console Errors: ${result.consoleErrorsCount} error(s) | Network Failures: ${result.failedRequestsCount}`);
    console.log(`  ✔ Accessibility Tree: ${a11yNodeCount} accessible nodes | H1 count: ${h1Count} (required: 1)`);
    console.log(`  📸 Screenshot: ${target.screen}`);

    await context.close();
  }

  await browser.close();

  // Save full JSON report
  const reportPath = path.join(ARTIFACT_DIR, 'devtools_audit_summary.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2), 'utf-8');

  console.log('\n===========================================================');
  console.log('🏁 Chrome DevTools Audit Completed Successfully');
  console.log(`📑 Summary Report saved: ${reportPath}`);
  console.log('===========================================================');
}

function countA11yNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countA11yNodes(child);
    }
  }
  return count;
}

runDevToolsAudit().catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});

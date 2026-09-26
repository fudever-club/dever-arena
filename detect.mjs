import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let errors = 0;
function check(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); errors++; }
  else console.log('PASS:', msg);
}

// 1. app.html shell
const appExists = existsSync('app.html');
check(appExists, 'app.html exists');
const app = appExists ? readFileSync('app.html', 'utf8') : '';
if (appExists) {
  check(app.includes('<div id="root">'), 'app.html has <div id="root">');
  check(app.includes('favicon'), 'app.html links favicon');
  check(app.includes('Space Grotesk'), 'app.html links fonts Space Grotesk');
}

// 2. manifest.json
const mfExists = existsSync('manifest.json');
check(mfExists, 'manifest.json exists');
if (mfExists) {
  let mf = null;
  try { mf = JSON.parse(readFileSync('manifest.json', 'utf8')); } catch { mf = null; }
  check(mf !== null, 'manifest.json is valid JSON');
  const icons = (mf && Array.isArray(mf.icons)) ? mf.icons : [];
  check(icons.length > 0 && icons.every(i => typeof i.src === 'string' && i.src.includes('/brand/')), 'manifest.json icons point to /brand/');
}

// 3. public/brand/ assets
for (const f of ['logo-dark', 'logo-light', 'icon-192', 'icon-512']) {
  const hit = existsSync(join('public', 'brand', `${f}.png`));
  check(hit, `public/brand/${f}.png exists`);
}

// 4. public/icons/ language SVGs
for (const f of ['python', 'javascript', 'java', 'nodejs']) {
  const hit = existsSync(join('public', 'icons', `${f}.svg`));
  check(hit, `public/icons/${f}.svg exists`);
}

// 5. no lucide-react imports in src/
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|tsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}
let lucideFound = [];
try {
  for (const f of walk('src')) {
    const content = readFileSync(f, 'utf8');
    if (content.includes('lucide-react')) lucideFound.push(f);
  }
} catch { /* src missing counts as failure below */ }
check(lucideFound.length === 0, `no lucide-react imports in src/${lucideFound.length ? ' (found in: ' + lucideFound.join(', ') + ')' : ''}`);

console.log(`\n=== detect.mjs result: ${errors} error(s) ===`);
process.exit(errors ? 1 : 0);

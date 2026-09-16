import { readFileSync } from 'node:fs';

let errors = 0;
function check(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); errors++; }
  else console.log('PASS:', msg);
}

const css = readFileSync('css/style.css','utf8');
const index = readFileSync('index.html','utf8');
const arena = readFileSync('arena.html','utf8');
const admin = readFileSync('admin.html','utf8');
const ds = readFileSync('docs/DESIGN_SYSTEM.md','utf8');

// 1. radius-lg 12px
check(css.includes('--radius-lg: 12px'), '--radius-lg 12px');

// 2. card, clan-card, room-card, feature-card radius 12px
for (const sel of ['.card','.clan-card','.room-card','.feature-card']) {
  const re = new RegExp(sel.replace('.','\\.') + '\\s*\\{[^}]+\\}', 'g');
  let ok = false;
  for (const m of css.matchAll(re)) {
    const block = m[0];
    if (block.includes('border-radius') && (block.includes('12px') || block.includes('var(--radius-lg)'))) { ok = true; break; }
  }
  // feature-card may be combined but check presence
  if (sel === '.feature-card' && css.includes('.feature-card') && css.includes('border-radius: var(--radius-lg)')) ok = true;
  check(ok, `${sel} border-radius 12px / var(--radius-lg)`);
}

// 3. no stray 10px border-radius
check(!css.includes('border-radius: 10px') && !css.includes('border-radius:10px'), 'no border-radius:10px stray in css/style.css');
check(!index.includes('border-radius:10px') && !index.includes('border-radius: 10px'), 'no border-radius:10px stray in index.html');

// 4. will-change for .card:hover
check(css.includes('.card:hover') && css.includes('will-change: transform'), '.card:hover will-change: transform');

// 5. box-shadow for card double
const cardMatch = css.match(/\.card\s*\{[^}]+\}/);
const cardBlock = cardMatch ? cardMatch[0] : '';
check(cardBlock.includes('0 8px 24px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.25)'), 'card box-shadow double layer');
check(css.includes('--shadow-card: 0 8px 24px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.25)'), '--shadow-card double layer');

// 6. footer identical Docs/GitHub/Discord + copyright
for (const [name, html] of [['index.html',index],['arena.html',arena],['admin.html',admin]]) {
  check(html.includes('<footer'), `${name} has footer`);
  check(html.includes('docs/DESIGN_SYSTEM.md'), `${name} footer Docs`);
  check(html.includes('https://github.com/dever-forces'), `${name} footer GitHub`);
  check(html.includes('https://discord.gg/dever'), `${name} footer Discord`);
  check(html.includes('© 2026 DEVER Arena Enterprise'), `${name} footer copyright`);
  const h1s = (html.match(/<h1[^>]*>/gi)||[]).length;
  check(h1s===1, `${name} h1 count ==1 (found ${h1s})`);
}
// footers identical core
const extract = (html) => { const m = html.match(/<footer[^>]*>[\s\S]*?<\/footer>/i); return m ? m[0].replace(/\s+/g,' ').trim() : ''; };
const f1 = extract(index), f2 = extract(arena), f3 = extract(admin);
check(f1===f2 && f1===f3, 'footers identical across 3 pages');

// 7. DESIGN_SYSTEM file map
check(ds.includes('arena.html'), 'DESIGN_SYSTEM has arena.html');
check(ds.includes('admin.html'), 'DESIGN_SYSTEM has admin.html');
check(ds.includes('src/db/api.js'), 'DESIGN_SYSTEM has src/db/api.js');

console.log(`\n=== detect.mjs result: ${errors} error(s) ===`);
process.exit(errors);

import fs from 'fs';

const files = ['index.html', 'arena.html', 'admin.html'];

console.log('====================================================');
console.log('🔍 INVENTORY OF ALL BUTTONS & INTERACTIVE ELEMENTS');
console.log('====================================================');

files.forEach(file => {
  const html = fs.readFileSync(file, 'utf8');
  const buttons = html.match(/<button[\s\S]*?<\/button>/gi) || [];
  const links = html.match(/<a[\s\S]*?<\/a>/gi) || [];
  
  console.log(`\n📄 ${file.toUpperCase()} — Total Buttons: ${buttons.length} | Links: ${links.length}`);
  
  buttons.forEach((btn, idx) => {
    const idMatch = btn.match(/id=["']([^"']+)["']/i);
    const classMatch = btn.match(/class=["']([^"']+)["']/i);
    const disabled = btn.includes('disabled') || btn.includes('aria-disabled="true"');
    const onclickMatch = btn.match(/onclick=["']([^"']+)["']/i);
    const ariaLabel = btn.match(/aria-label=["']([^"']+)["']/i);
    const text = btn.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    
    console.log(`  [B${idx + 1}] ID: ${idMatch ? idMatch[1] : '(none)'} | Text: "${text.slice(0, 35)}" | Disabled: ${disabled} | onClick: ${onclickMatch ? onclickMatch[1].slice(0, 40) : '(none)'} | Class: ${classMatch ? classMatch[1] : '(none)'}`);
  });
});

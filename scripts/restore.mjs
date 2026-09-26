/**
 * DEVER Arena — restore DB JSON từ file backup.
 * Chạy: npm run restore -- backups/db-YYYYMMDD-HHmmss.json
 * An toàn: tự backup bản hiện tại thành db.pre-restore-<stamp>.json trước khi ghi đè.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = process.env.DEVER_DB_PATH || join(ROOT, 'server', 'data', 'db.json');
const src = process.argv[2];
if (!src || !existsSync(src)) {
  console.error('Dùng: npm run restore -- <file-backup.json>');
  process.exit(1);
}
mkdirSync(dirname(dest), { recursive: true });
if (existsSync(dest)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  copyFileSync(dest, join(dirname(dest), `db.pre-restore-${stamp}.json`));
  console.log('[restore] đã lưu bản hiện tại (.pre-restore) trước khi ghi đè');
}
copyFileSync(src, dest);
console.log(`[restore] ${src} -> ${dest}`);
console.log('[restore] khởi động lại API (docker compose restart api) để nạp dữ liệu.');

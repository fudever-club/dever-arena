/**
 * DEVER Arena — backup DB JSON (+ Postgres dump nếu có DEVER_DATABASE_URL).
 * Chạy: npm run backup  (tạo backups/db-YYYYMMDD-HHmmss.json)
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.env.DEVER_DB_PATH || join(ROOT, 'server', 'data', 'db.json');
const dir = join(ROOT, 'backups');
mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dest = join(dir, `db-${stamp}.json`);
if (!existsSync(src)) {
  console.error(`[backup] không thấy DB nguồn: ${src}`);
  process.exit(1);
}
copyFileSync(src, dest);
console.log(`[backup] JSON -> ${dest}`);

const pgUrl = process.env.DEVER_DATABASE_URL || '';
if (pgUrl) {
  try {
    const out = join(dir, `pg-${stamp}.dump`);
    execSync(`pg_dump --format=custom --file="${out}" "${pgUrl}"`, { stdio: 'inherit' });
    console.log(`[backup] Postgres -> ${out}`);
  } catch (e) {
    console.warn('[backup] pg_dump thất bại (bỏ qua, JSON vẫn giữ):', e.message);
  }
} else {
  console.log('[backup] (bỏ qua pg_dump: chưa đặt DEVER_DATABASE_URL)');
}

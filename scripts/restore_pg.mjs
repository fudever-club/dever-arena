/**
 * DEVER Arena — Task 128: phục hồi Postgres schema v2 từ dump JSON (backup_cron/backup.mjs/pre-migration).
 * Chạy: node scripts/restore_pg.mjs backups/db-2026-09-29T04-53-52-406Z.json
 * Cần DEVER_DATABASE_URL. Snapshot pre-restore đẩy S3 trước khi TRUNCATE (nếu đủ env S3_*).
 * Trên prod có thể dùng route POST /admin/restore-backup (không cần terminal DB).
 */
import { readFileSync, existsSync } from 'node:fs';
import { Pool } from 'pg';
import { restoreFromDump } from '../server/pg_migrate.js';

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error('Dùng: node scripts/restore_pg.mjs <file-backup.json>  (cần DEVER_DATABASE_URL)');
  process.exit(1);
}
if (!process.env.DEVER_DATABASE_URL) {
  console.error('[restore-pg] Thiếu DEVER_DATABASE_URL. Thoát 1.');
  process.exit(1);
}

const dump = JSON.parse(readFileSync(file, 'utf8'));
const pool = new Pool({ connectionString: process.env.DEVER_DATABASE_URL });
try {
  let s3Backup = null;
  if (process.env.S3_BUCKET) {
    const { putObject } = await import('../server/objectStore.js');
    s3Backup = putObject;
  } else {
    console.warn('[restore-pg] Không có S3_BUCKET — bỏ qua pre-restore snapshot.');
  }
  const report = await restoreFromDump(pool, dump, { s3Backup });
  console.log('[restore-pg] Kết quả:', JSON.stringify(report, null, 2));
  console.log('[restore-pg] Restart API (hoặc deploy) để mirror bộ nhớ nạp lại dữ liệu mới.');
} catch (e) {
  console.error('[restore-pg] THẤT BẠI:', e?.message || e);
  process.exitCode = 1;
} finally {
  await pool.end();
}

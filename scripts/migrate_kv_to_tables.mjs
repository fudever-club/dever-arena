/**
 * DEVER Arena — Task 127 (Phase 36): CLI migration KV → 10 bảng typed.
 * Chạy: node scripts/migrate_kv_to_tables.mjs   (cần DEVER_DATABASE_URL; S3 backup nếu đủ env S3_*)
 * Trên prod: dùng route POST /api/v1/admin/migrate-schema (specific exec không chạy trên Windows);
 * script này dùng cho môi trường có terminal truy cập DB (Linux/CI).
 */
import { Pool } from 'pg';
import { migrateKvToTables } from '../server/pg_migrate.js';

const url = process.env.DEVER_DATABASE_URL;
if (!url) {
  console.error('[migrate] Thiếu DEVER_DATABASE_URL — không có Postgres để migrate. Thoát 1.');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
try {
  let s3Backup = null;
  if (process.env.S3_BUCKET) {
    const { putObject } = await import('../server/objectStore.js');
    s3Backup = putObject;
  } else {
    console.warn('[migrate] Không có S3_BUCKET — bỏ qua backup S3 (dever_store vẫn giữ nguyên làm archive).');
  }
  const report = await migrateKvToTables(pool, { s3Backup });
  console.log('[migrate] Kết quả:', JSON.stringify(report, null, 2));
  if (report.status === 'migrated') {
    console.log('[migrate] OK — khởi động lại API (hoặc gọi POST /admin/migrate-schema reload) để chạy mode tables.');
  }
} catch (e) {
  console.error('[migrate] THẤT BẠI:', e?.message || e);
  process.exitCode = 1;
} finally {
  await pool.end();
}

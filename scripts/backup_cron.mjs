/**
 * DEVER Arena — cron backup hằng ngày (Task 120).
 * Dump toàn bộ dever_store + dever_meta (Postgres KV) → JSON → đẩy lên object store (S3).
 * Chạy trên Specific qua cron "db-backup" (same build với api, có pg + S3 env).
 * Không có DEVER_DATABASE_URL → thoát 0 với thông báo (chạy local JSON mode không cần backup này).
 *
 * Cũng chạy tay được để kiểm chứng: node scripts/backup_cron.mjs
 */
import { Pool } from 'pg';

const url = process.env.DEVER_DATABASE_URL;
if (!url) {
  console.log('[backup-cron] Không có DEVER_DATABASE_URL — chế độ JSON local không cần backup Postgres. Thoát.');
  process.exit(0);
}
if (!process.env.S3_BUCKET) {
  console.error('[backup-cron] Thiếu S3_BUCKET — không có nơi lưu dump. Thoát 1.');
  process.exit(1);
}

const { putObject } = await import('../server/objectStore.js');
const pool = new Pool({ connectionString: url });

const dump = {};
try {
  const { rows } = await pool.query('SELECT collection, id, payload FROM dever_store');
  for (const r of rows) {
    (dump[r.collection] = dump[r.collection] || []).push(r.payload);
  }
  const meta = await pool.query('SELECT key, value FROM dever_meta');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `backups/db-${stamp}.json`;
  const body = JSON.stringify({ at: new Date().toISOString(), meta: meta.rows, data: dump }, null, 2);
  const out = await putObject(key, body);
  if (out === 'ok') {
    const collections = Object.keys(dump).map((c) => `${c}:${dump[c].length}`).join(', ');
    console.log(`[backup-cron] OK ${key} (${(body.length / 1024).toFixed(1)} KB; ${collections})`);
  } else {
    console.error('[backup-cron] PUT object store thất bại.');
    process.exitCode = 1;
  }
} catch (e) {
  console.error('[backup-cron] Lỗi:', e?.message || e);
  process.exitCode = 1;
} finally {
  await pool.end();
}

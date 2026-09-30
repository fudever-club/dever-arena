/**
 * DEVER Arena — cron backup hằng ngày (Task 120, schema-aware từ Phase 36).
 * Dump toàn bộ DB → JSON → đẩy lên object store (S3).
 *  - Mode tables (schema v2): dùng readTablesDump() chung với backup.mjs / restore.
 *  - Mode kv (schema v1, legacy): dump dever_store + dever_meta.
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

try {
  const meta = await pool.query(`SELECT key, value FROM dever_meta`);
  const ver = Number(meta.rows.find((r) => r.key === 'schema_version')?.value) || 1;
  const mode = ver >= 2 ? 'tables' : 'kv';

  let dump, data;
  if (mode === 'tables') {
    const { readTablesDump } = await import('../server/pg_migrate.js');
    ({ data } = await readTablesDump(pool));
    dump = data;
  } else {
    const { rows } = await pool.query('SELECT collection, id, payload FROM dever_store');
    data = {};
    for (const r of rows) {
      (data[r.collection] = data[r.collection] || []).push(r.payload);
    }
    dump = data;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `backups/db-${stamp}.json`;
  const body = JSON.stringify({ at: new Date().toISOString(), schema_mode: mode, meta: meta.rows, data: dump }, null, 2);
  const out = await putObject(key, body);
  if (out === 'ok') {
    const collections = Object.keys(dump).map((c) => `${c}:${dump[c].length}`).join(', ');
    console.log(`[backup-cron] OK ${key} (mode=${mode}, ${(body.length / 1024).toFixed(1)} KB; ${collections})`);
    // A1 (Sprint 1b): ghi dấu vết backup vào DB — verify_cron_backup.mjs đọc marker này
    // để kiểm chứng cron đã chạy S3 thành công mà không cần đọc S3 trực tiếp.
    const counts = Object.fromEntries(Object.entries(dump).map(([c, rows]) => [c, rows.length]));
    await pool.query(
      `INSERT INTO dever_meta (key, value) VALUES ('last_cron_backup_at', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify({ at: new Date().toISOString(), key, bytes: body.length, counts })]
    );
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

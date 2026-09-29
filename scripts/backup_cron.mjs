/**
 * DEVER Arena — cron backup hằng ngày (Task 120, schema-aware từ Phase 36).
 * Dump toàn bộ DB → JSON → đẩy lên object store (S3).
 *  - Mode kv (schema v1): dump dever_store + dever_meta.
 *  - Mode tables (schema v2): dump 10 bảng thật + dever_meta.
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
  // Xác định schema mode: dever_meta.schema_version >= 2 → tables, ngược lại kv.
  const meta = await pool.query(`SELECT key, value FROM dever_meta`);
  const ver = Number(meta.rows.find((r) => r.key === 'schema_version')?.value) || 1;
  const mode = ver >= 2 ? 'tables' : 'kv';

  const dump = { users: [], contests: [], problems: [], testcases: [], submissions: [], participants: [], virtual_sessions: [], clans: [], clarifications: [], announcements: [] };

  if (mode === 'tables') {
    for (const table of Object.keys(dump)) {
      const { rows } = await pool.query(`SELECT * FROM ${table}`);
      // row → payload gần shape bộ nhớ: ts ISO, jsonb là object sẵn (pg tự parse).
      dump[table] = rows.map((r) => ({
        ...r,
        submitted_at: iso(r.submitted_at), start_time: iso(r.start_time),
        registered_at: iso(r.registered_at), answered_at: iso(r.answered_at),
        created_at: iso(r.created_at),
      }));
    }
  } else {
    const { rows } = await pool.query('SELECT collection, id, payload FROM dever_store');
    for (const r of rows) {
      if (dump[r.collection]) dump[r.collection].push(r.payload);
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `backups/db-${stamp}.json`;
  const body = JSON.stringify({ at: new Date().toISOString(), schema_mode: mode, meta: meta.rows, data: dump }, null, 2);
  const out = await putObject(key, body);
  if (out === 'ok') {
    const collections = Object.keys(dump).map((c) => `${c}:${dump[c].length}`).join(', ');
    console.log(`[backup-cron] OK ${key} (mode=${mode}, ${(body.length / 1024).toFixed(1)} KB; ${collections})`);
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

function iso(v) {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

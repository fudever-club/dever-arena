/**
 * DEVER Arena — Task 127 (Phase 36): migration KV (dever_store) → 10 bảng typed (schema v2).
 *
 * Module thuần (pool inject) để test được; CLI scripts/migrate_kv_to_tables.mjs bọc ngoài,
 * và route admin POST /admin/migrate-schema gọi trực tiếp trên prod (specific exec không
 * chạy được trên Windows).
 *
 * An toàn:
 *  - Backup JSON đẩy S3 (backups/pre-migration-<stamp>.json) TRƯỚC khi ghi bảng (nếu có S3).
 *  - Idempotent: schema_version >= 2 → không làm gì, trả report "already".
 *  - Ghi bảng theo từng collection, UPSERT ON CONFLICT (id) DO UPDATE — chạy lại không nhân đôi.
 *  - Đối chiếu số rows KV vs bảng theo từng collection — lệch → ném lỗi (exit 1 / HTTP 500).
 *  - KHÔNG xóa dever_store (giữ làm archive — dọn ở Task 130 khi prod ổn định).
 */
import { TABLES_SQL, rowToValues } from './pg_schema.js';
import { COLLECTIONS } from './pg.js';

const BOOT_META_SQL = [
  `CREATE TABLE IF NOT EXISTS dever_meta (
     key TEXT PRIMARY KEY,
     value JSONB NOT NULL
   )`,
  `INSERT INTO dever_meta (key, value) VALUES ('seq', '1')
   ON CONFLICT (key) DO NOTHING`,
];

export async function migrateKvToTables(pool, { s3Backup = null } = {}) {
  for (const sql of BOOT_META_SQL) await pool.query(sql);

  const { rows: verRows } = await pool.query(`SELECT value FROM dever_meta WHERE key = 'schema_version'`);
  const version = Number(verRows?.[0]?.value) || 1;
  if (version >= 2) {
    return { status: 'already', version, message: 'Schema đã ở v2 — không cần migrate.' };
  }

  // Đọc toàn bộ KV + seq.
  const { rows: kvRows } = await pool.query('SELECT collection, id, payload FROM dever_store');
  const byCollection = {};
  for (const col of COLLECTIONS) byCollection[col] = [];
  for (const r of kvRows) {
    if (byCollection[r.collection]) byCollection[r.collection].push(r.payload);
  }
  const { rows: seqRows } = await pool.query(`SELECT value FROM dever_meta WHERE key = 'seq'`);
  const seq = Number(seqRows?.[0]?.value) || 1;
  const totalKv = kvRows.length;

  // Backup TRƯỚC khi ghi bảng (best-effort: S3 thiếu env → cảnh báo nhưng vẫn migrate,
  // vì KV giữ nguyên làm archive nên vẫn có thể phục hồi).
  let backupKey = null;
  if (s3Backup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupKey = `backups/pre-migration-${stamp}.json`;
    const body = JSON.stringify({
      at: new Date().toISOString(), schema_mode: 'kv', phase: 'pre-migration',
      meta: [{ key: 'seq', value: String(seq) }, { key: 'schema_version', value: String(version) }],
      data: byCollection,
    }, null, 2);
    const out = await s3Backup(backupKey, body);
    if (out !== 'ok') {
      console.warn('[migrate] S3 backup không thành công — vẫn tiếp tục (dever_store giữ nguyên làm archive).');
      backupKey = null;
    }
  }

  // Tạo bảng v2 + ghi per-row upsert.
  for (const sql of TABLES_SQL) await pool.query(sql);
  const counts = {};
  for (const col of COLLECTIONS) {
    let n = 0;
    for (const row of byCollection[col]) {
      const id = String(row.id ?? JSON.stringify(row).slice(0, 64));
      const { cols, extra } = rowToValues(col, row);
      const names = ['id', ...Object.keys(cols), 'extra'];
      const vals = [id, ...Object.values(cols), JSON.stringify(extra)];
      const ph = names.map((_, i) => `$${i + 1}`).join(', ');
      const updates = names.slice(1).map((nm, i) => `${nm} = $${i + 2}`).join(', ');
      await pool.query(
        `INSERT INTO ${col} (${names.join(', ')}) VALUES (${ph})
         ON CONFLICT (id) DO UPDATE SET ${updates}`,
        vals
      );
      n += 1;
    }
    // Đối chiếu: rows trong bảng phải == số row KV của collection.
    const { rows: cntRows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${col}`);
    const tableN = Number(cntRows?.[0]?.n) || 0;
    if (tableN !== n) {
      throw new Error(`ĐỐI CHIẾU LỆCH ${col}: ghi ${n} nhưng bảng có ${tableN}. DỪNG — schema_version chưa flip, KV nguyên vẹn.`);
    }
    counts[col] = tableN;
  }

  // Flip schema_version — từ đây boot chọn mode tables.
  await pool.query(
    `INSERT INTO dever_meta (key, value) VALUES ('schema_version', '2')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  );
  await pool.query(
    `INSERT INTO dever_meta (key, value) VALUES ('seq', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [seq]
  );

  return { status: 'migrated', from: totalKv, counts, backupKey, seq };
}

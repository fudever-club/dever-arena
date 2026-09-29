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
import { TABLES_SQL, rowToPayload, buildUpsert } from './pg_schema.js';
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
      const { names, vals, ph, setSql } = buildUpsert(col, { ...row, id });
      await pool.query(
        `INSERT INTO ${col} (${names.join(', ')}) VALUES (${ph})
         ON CONFLICT (id) DO UPDATE SET ${setSql}`,
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

/**
 * Task 128: dump toàn bộ 10 bảng (row shape, ts → ISO) + dever_meta — dùng chung cho
 * backup_cron (S3), backup.mjs (file) và pre-restore snapshot.
 */
const TS_COLS = ['submitted_at', 'start_time', 'registered_at', 'answered_at', 'created_at'];

function isoVal(v) {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export async function readTablesDump(pool) {
  const data = {};
  for (const col of COLLECTIONS) {
    const { rows } = await pool.query(`SELECT * FROM ${col}`);
    data[col] = (rows || []).map((r) => {
      const o = { ...r };
      for (const k of TS_COLS) if (k in o) o[k] = isoVal(o[k]);
      return o;
    });
  }
  const { rows: metaRows } = await pool.query('SELECT key, value FROM dever_meta');
  return { data, meta: metaRows || [] };
}

/**
 * Task 128: phục hồi DB từ dump JSON (định dạng backup_cron/pre-migration/backup.mjs):
 *   { schema_mode: 'tables'|'kv', meta: [{key,value}], data: { <collection>: [row|payload] } }
 * TRUNCATE từng bảng rồi nạp lại (restore là thay thế toàn bộ — rows không có trong dump bị bỏ).
 * Chuẩn hóa: dump 'tables' là row shape (SELECT *) → rowToPayload; dump 'kv' là payload memory → dùng trực tiếp.
 * Idempotent: chạy lại cho cùng kết quả. Pre-restore snapshot đẩy S3 TRƯỚC khi TRUNCATE (nếu có S3).
 * Không bọc transaction (pool query có thể đổi connection) — lỗi giữa chừng thì chạy lại sau khi sửa nguyên nhân.
 */
export async function restoreFromDump(pool, dump, { s3Backup = null } = {}) {
  const mode = String(dump?.schema_mode || 'tables');
  const data = dump?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Dump thiếu trường data (object {<collection>: [...]}).');
  }
  for (const k of Object.keys(data)) {
    if (!COLLECTIONS.includes(k)) throw new Error(`Collection lạ trong dump: ${k}`);
    if (!Array.isArray(data[k])) throw new Error(`data.${k} phải là mảng.`);
  }

  // Snapshot hiện trạng TRƯỚC khi TRUNCATE — an toàn phục hồi ngược.
  let preRestoreKey = null;
  if (s3Backup) {
    const current = await readTablesDump(pool);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    preRestoreKey = `backups/pre-restore-${stamp}.json`;
    const body = JSON.stringify({
      at: new Date().toISOString(), schema_mode: 'tables', phase: 'pre-restore',
      meta: current.meta, data: current.data,
    }, null, 2);
    const out = await s3Backup(preRestoreKey, body);
    if (out !== 'ok') {
      console.warn('[restore] S3 pre-restore snapshot không thành công — vẫn tiếp tục restore.');
      preRestoreKey = null;
    }
  }

  const counts = {};
  for (const col of COLLECTIONS) {
    await pool.query(`TRUNCATE ${col}`);
    let n = 0;
    for (const raw of data[col] || []) {
      const payload = mode === 'tables' ? rowToPayload(col, raw) : raw;
      const id = String(payload.id ?? JSON.stringify(payload).slice(0, 64));
      const { names, vals, ph, setSql } = buildUpsert(col, { ...payload, id });
      await pool.query(
        `INSERT INTO ${col} (${names.join(', ')}) VALUES (${ph})
         ON CONFLICT (id) DO UPDATE SET ${setSql}`,
        vals
      );
      n += 1;
    }
    counts[col] = n;
  }
  const meta = Array.isArray(dump?.meta) ? dump.meta : [];
  const seqRow = meta.find((m) => m?.key === 'seq');
  if (seqRow) {
    await pool.query(
      `INSERT INTO dever_meta (key, value) VALUES ('seq', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [Number(seqRow.value) || 1]
    );
  }
  return { status: 'restored', mode, counts, preRestoreKey };
}

/**
 * Task 130: dọn KV archive — DROP dever_store SAU khi schema v2 chạy ổn định.
 * Guard: chỉ cho phép khi schema_version >= 2 (chưa migrate thì từ chối).
 * An toàn: dữ liệu KV vẫn còn nguyên trong backup S3 pre-migration (Task 127 đã dump).
 */
export async function dropLegacyKv(pool) {
  const { rows: verRows } = await pool.query(`SELECT value FROM dever_meta WHERE key = 'schema_version'`);
  const version = Number(verRows?.[0]?.value) || 1;
  if (version < 2) {
    throw new Error('Schema chưa ở v2 — chạy migrate-schema trước khi dọn KV archive.');
  }
  const { rows: exists } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'dever_store') AS ok`
  );
  if (!exists?.[0]?.ok) {
    return { status: 'already', message: 'dever_store không tồn tại — đã dọn trước đó.' };
  }
  await pool.query('DROP TABLE dever_store');
  return { status: 'dropped', message: 'Đã DROP dever_store (dữ liệu còn trong backup pre-migration trên S3).' };
}

/**
 * DEVER Arena — Postgres store (dùng khi có DEVER_DATABASE_URL, production đa máy).
 * Cùng hình dạng với server/db.js (sync reads trên mirror memory),
 * khác ở persist: write-through bất đồng bộ + flush định kỳ.
 *
 * Phase 36 (Task 126) — 2 schema mode, chọn tự động theo `dever_meta.schema_version`:
 *  - 'kv' (v1): 1 bảng dever_store(collection, id, payload JSONB) — legacy. DB còn
 *    dữ liệu KV (chưa migrate) chạy mode này, hành vi giữ nguyên 100%.
 *  - 'tables' (v2, Task 125): 10 bảng typed thật (server/pg_schema.js) — flush ghi
 *    per-row upsert + mirror DELETE; boot nạp từ bảng. DB mới (không có dữ liệu KV)
 *    bật v2 ngay. Chuyển mode bằng scripts/migrate_kv_to_tables.mjs (Task 127) hoặc
 *    env DEVER_PG_SCHEMA=v2 (ép, dùng khi biết chắc KV rỗng/đã chuyển).
 *
 * Facade (data/save/nextId/find/filter/insert/update/flush/stop) KHÔNG ĐỔI ở cả 2 mode
 * — server/index.js không phải sửa gì.
 */
import { SCHEMA_VERSION, TABLES_SQL, rowToValues, rowToPayload, buildUpsert } from './pg_schema.js';

export const COLLECTIONS = ['users', 'contests', 'problems', 'testcases', 'submissions', 'participants', 'virtual_sessions', 'clans', 'clarifications', 'announcements'];

/** Schema v1 (KV) — giữ để tạo bảng legacy khi DB chưa có gì. */
export const MIGRATE_SQL = [
  `CREATE TABLE IF NOT EXISTS dever_store (
     collection TEXT NOT NULL,
     id TEXT NOT NULL,
     payload JSONB NOT NULL,
     PRIMARY KEY (collection, id)
   )`,
  `CREATE TABLE IF NOT EXISTS dever_meta (
     key TEXT PRIMARY KEY,
     value JSONB NOT NULL
   )`,
  `INSERT INTO dever_meta (key, value) VALUES ('seq', '1')
   ON CONFLICT (key) DO NOTHING`,
];

const BOOT_META_SQL = [
  `CREATE TABLE IF NOT EXISTS dever_meta (
     key TEXT PRIMARY KEY,
     value JSONB NOT NULL
   )`,
  `INSERT INTO dever_meta (key, value) VALUES ('seq', '1')
   ON CONFLICT (key) DO NOTHING`,
  `INSERT INTO dever_meta (key, value) VALUES ('schema_version', '1')
   ON CONFLICT (key) DO NOTHING`,
];

export async function createPgStore(pool, opts = {}) {
  const flushMs = opts.flushMs ?? 5000;
  const schemaOpt = opts.schema || process.env.DEVER_PG_SCHEMA;
  const forceV2 = schemaOpt === 'tables' || schemaOpt === 'v2';
  const forceKv = schemaOpt === 'kv';

  for (const sql of BOOT_META_SQL) await pool.query(sql);
  const { rows: verRows } = await pool.query(`SELECT value FROM dever_meta WHERE key = 'schema_version'`);
  let version = Number(verRows?.[0]?.value) || 1;

  // DB còn dữ liệu KV (chưa migrate) → giữ mode kv cho tới Task 127 chuyển.
  const { rows: existsRows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'dever_store') AS ok`
  );
  let legacyCount = 0;
  if (existsRows?.[0]?.ok) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM dever_store');
    legacyCount = Number(rows?.[0]?.n) || 0;
  }

  let mode;
  if (forceKv) {
    mode = 'kv';
  } else if (forceV2 || version >= SCHEMA_VERSION) {
    mode = 'tables';
  } else if (legacyCount > 0) {
    mode = 'kv'; // có dữ liệu legacy — không tự nâng, chờ migration script
  } else {
    mode = 'tables'; // DB mới/trống — bật v2 luôn
  }

  const data = { seq: 1 };
  for (const col of COLLECTIONS) data[col] = [];

  /** Nạp mirror bộ nhớ từ 10 bảng thật (thay thế nội dung data[col], giữ tham chiếu object data). */
  async function loadTables() {
    for (const col of COLLECTIONS) {
      const { rows } = await pool.query(`SELECT * FROM ${col}`);
      data[col] = (rows || []).map((row) => rowToPayload(col, row));
    }
    const { rows: seqRows2 } = await pool.query(`SELECT value FROM dever_meta WHERE key = 'seq'`);
    if (seqRows2?.[0]) data.seq = Number(seqRows2[0].value) || 1;
  }

  if (mode === 'tables') {
    for (const sql of TABLES_SQL) await pool.query(sql);
    await pool.query(
      `INSERT INTO dever_meta (key, value) VALUES ('schema_version', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [SCHEMA_VERSION]
    );
    await loadTables();
  } else {
    for (const sql of MIGRATE_SQL) await pool.query(sql);
    const { rows } = await pool.query('SELECT collection, id, payload FROM dever_store');
    for (const r of rows || []) {
      if (data[r.collection]) data[r.collection].push(r.payload);
    }
    console.log(`[pg] mode=kv (legacy) — dever_store có ${legacyCount} rows. Chạy scripts/migrate_kv_to_tables.mjs để chuyển schema v2 (Task 127).`);
  }
  if (mode === 'tables') console.log(`[pg] mode=tables (schema v${SCHEMA_VERSION}) — ${COLLECTIONS.length} bảng thật.`);

  const { rows: seqRows } = await pool.query(`SELECT value FROM dever_meta WHERE key = 'seq'`);
  if (seqRows?.[0]) data.seq = Number(seqRows[0].value) || 1;

  let dirty = false;
  let stopped = false;
  const markDirty = () => { dirty = true; };

  /** Mode kv: upsert payload JSONB vào dever_store + mirror DELETE (hành vi cũ). */
  async function flushKv() {
    for (const col of COLLECTIONS) {
      const ids = [];
      for (const row of data[col]) {
        const id = String(row.id ?? JSON.stringify(row).slice(0, 64));
        ids.push(id);
        await pool.query(
          `INSERT INTO dever_store (collection, id, payload) VALUES ($1, $2, $3)
           ON CONFLICT (collection, id) DO UPDATE SET payload = EXCLUDED.payload`,
          [col, id, row]
        );
      }
      if (ids.length > 0) {
        await pool.query(`DELETE FROM dever_store WHERE collection = $1 AND NOT (id = ANY($2))`, [col, ids]);
      } else {
        await pool.query(`DELETE FROM dever_store WHERE collection = $1`, [col]);
      }
    }
  }

  /** Mode tables: upsert per-row với cột typed + extra JSONB catch-all + mirror DELETE. */
  async function flushTables() {
    for (const col of COLLECTIONS) {
      const ids = [];
      for (const row of data[col]) {
        const id = String(row.id ?? JSON.stringify(row).slice(0, 64));
        ids.push(id);
        const { names, vals, ph, setSql } = buildUpsert(col, { ...row, id });
        await pool.query(
          `INSERT INTO ${col} (${names.join(', ')}) VALUES (${ph})
           ON CONFLICT (id) DO UPDATE SET ${setSql}`,
          vals
        );
      }
      // Mirror DELETE — row xóa khỏi memory phải biến mất khỏi Postgres.
      if (ids.length > 0) {
        await pool.query(`DELETE FROM ${col} WHERE NOT (id = ANY($1))`, [ids]);
      } else {
        await pool.query(`DELETE FROM ${col}`);
      }
    }
  }

  async function flush() {
    if (!dirty || stopped) return;
    dirty = false;
    try {
      if (mode === 'tables') await flushTables();
      else await flushKv();
      await pool.query(`INSERT INTO dever_meta (key, value) VALUES ('seq', $1)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [data.seq]);
    } catch (e) {
      dirty = true; // thử lại kỳ sau, không mất dữ liệu memory
      console.error('[pg] flush thất bại, sẽ thử lại:', e.message);
    }
  }
  const timer = setInterval(flush, flushMs);
  if (timer.unref) timer.unref();

  return {
    data,
    mode,
    /** Task 127: server đang chạy nạp lại mirror từ bảng thật + chuyển mode tables (sau migration). */
    reloadFromTables: async () => {
      if (mode !== 'tables') {
        for (const sql of TABLES_SQL) await pool.query(sql);
        await pool.query(
          `INSERT INTO dever_meta (key, value) VALUES ('schema_version', $1)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [SCHEMA_VERSION]
        );
        mode = 'tables';
      }
      await loadTables();
      return { mode };
    },
    save: () => { markDirty(); },
    nextId: (prefix) => { const id = `${prefix}_${data.seq++}_${Date.now().toString(36)}`; markDirty(); return id; },
    find: (col, pred) => (data[col] || []).find(pred),
    filter: (col, pred) => (data[col] || []).filter(pred),
    insert: (col, row) => { (data[col] = data[col] || []).push(row); markDirty(); return row; },
    update: (col, pred, patch) => {
      const row = (data[col] || []).find(pred);
      if (row) { Object.assign(row, patch); markDirty(); }
      return row || null;
    },
    flush,
    stop: async () => { stopped = true; clearInterval(timer); await flush(); try { await pool.end(); } catch {} },
  };
}

/** Mở store: có DEVER_DATABASE_URL → Postgres (retry), không → JSON file (server/db.js). */
export async function openStore() {
  const url = process.env.DEVER_DATABASE_URL;
  if (!url) {
    const { openDatabase } = await import('./db.js');
    return { store: openDatabase(process.env.DEVER_DB_PATH || undefined), kind: 'json' };
  }
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: url });
  let lastErr = null;
  for (let i = 0; i < 10; i++) {
    try {
      const store = await createPgStore(pool);
      console.log('[pg] đã kết nối Postgres.');
      return { store, kind: 'pg' };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(`Không kết nối được Postgres sau 10 lần thử: ${lastErr?.message}`);
}

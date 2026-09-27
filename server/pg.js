/**
 * DEVER Arena — Postgres store (dùng khi có DEVER_DATABASE_URL, production đa máy).
 * Cùng hình dạng với server/db.js (sync reads trên mirror memory),
 * khác ở persist: write-through bất đồng bộ + flush định kỳ, migrate tự động.
 *
 * Schema tối giản trung thực (1 bảng KV + meta), không giả vờ relational đầy đủ:
 *   dever_store(collection TEXT, id TEXT, payload JSONB, PRIMARY KEY(collection, id))
 *   dever_meta(key TEXT PRIMARY KEY, value JSONB)   -- seq
 *
 * poolFactory được inject để unit-test không cần server Postgres thật.
 */
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

const COLLECTIONS = ['users', 'contests', 'problems', 'testcases', 'submissions', 'hacks', 'participants', 'virtual_sessions', 'clans', 'clarifications', 'announcements'];

export async function createPgStore(pool, opts = {}) {
  const flushMs = opts.flushMs ?? 5000;

  for (const sql of MIGRATE_SQL) {
    await pool.query(sql);
  }

  const data = { seq: 1 };
  for (const col of COLLECTIONS) data[col] = [];
  const rows = await pool.query('SELECT collection, id, payload FROM dever_store');
  for (const r of rows.rows || []) {
    if (data[r.collection]) data[r.collection].push(r.payload);
  }
  const seqRow = await pool.query("SELECT value FROM dever_meta WHERE key = 'seq'");
  if (seqRow.rows?.[0]) data.seq = Number(seqRow.rows[0].value) || 1;

  let dirty = false;
  let stopped = false;
  const markDirty = () => { dirty = true; };
  async function flush() {
    if (!dirty || stopped) return;
    dirty = false;
    try {
      for (const col of COLLECTIONS) {
        for (const row of data[col]) {
          const id = row.id ?? JSON.stringify(row).slice(0, 64);
          await pool.query(
            `INSERT INTO dever_store (collection, id, payload) VALUES ($1, $2, $3)
             ON CONFLICT (collection, id) DO UPDATE SET payload = EXCLUDED.payload`,
            [col, String(id), row]
          );
        }
      }
      await pool.query(`INSERT INTO dever_meta (key, value) VALUES ('seq', $1)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [data.seq]);
    } catch (e) {
      dirty = true; // thử lại kỳ sau, không mất dữ liệu memory
      console.error('[pg] flush thất bại, sẽ thử lại:', e.message);
    }
  }
  const timer = setInterval(flush, flushMs);
  if (timer.unref) timer.unref();

  const nextId = (prefix) => `${prefix}_${data.seq++}_${Date.now().toString(36)}`;

  return {
    data,
    save: () => { markDirty(); },
    nextId: (prefix) => { const id = nextId(prefix); markDirty(); return id; },
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

/**
 * DEVER Arena — Task 127 tests: migration KV → bảng typed (pool giả).
 * Kiểm tra: idempotent (already), migrated + đối chiếu rows per-table,
 * backup S3 được gọi, lệch số rows → throw và KHÔNG flip schema.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateKvToTables, dropLegacyKv, readTablesDump, restoreFromDump } from '../server/pg_migrate.js';

/** Pool giả: dever_store đầu vào → ghi vào "bảng" in-memory, COUNT theo nội dung đã ghi. */
function fakePool(kvRows = [], { countOverride = null, hasKvTable = true } = {}) {
  const tables = {};   // table -> [{id, ...}]
  const queries = [];
  let schemaVersion = 1;
  return {
    queries, tables,
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("dever_meta WHERE key = 'schema_version'")) {
        return { rows: [{ value: String(schemaVersion) }] };
      }
      if (sql.includes('information_schema.tables')) return { rows: [{ ok: hasKvTable }] };
      if (/^DROP TABLE/.test(sql)) {
        delete tables.dever_store;
        return { rows: [] };
      }
      if (sql.startsWith('SELECT collection')) return { rows: kvRows };
      if (sql.includes("dever_meta WHERE key = 'seq'")) return { rows: [{ value: 7 }] };
      const m = sql.match(/^INSERT INTO (\w+) \(/);
      if (m && m[1] !== 'dever_meta') {
        const t = m[1];
        (tables[t] = tables[t] || []);
        const idx = tables[t].findIndex((r) => r.id === params[0]);
        if (idx >= 0) tables[t][idx] = { id: params[0] };
        else tables[t].push({ id: params[0] });
        return { rows: [] };
      }
      if (/^INSERT INTO dever_meta/.test(sql)) {
        if (sql.includes("'schema_version'")) schemaVersion = Number(params?.[0]) || 2;
        return { rows: [] };
      }
      if (/^SELECT COUNT\(\*\)/.test(sql)) {
        const t = sql.match(/FROM (\w+)$/)[1];
        const n = countOverride ? countOverride(t) : (tables[t] || []).length;
        return { rows: [{ n }] };
      }
      return { rows: [] };
    },
    async end() {},
  };
}

const KV = [
  { collection: 'users', id: 'u_1', payload: { id: 'u_1', username: 'hero', role: 'ADMIN', rating: 1500, password: 'h' } },
  { collection: 'contests', id: 'c_1', payload: { id: 'c_1', slug: 'r1', title: 'Round 1', start_time: '2026-09-29T02:00:00.000Z', duration_minutes: 90 } },
  { collection: 'submissions', id: 's_1', payload: { id: 's_1', user_id: 'u_1', problem_id: 'p_1', verdict: 'AC', per_test: [{ index: 0, verdict: 'AC' }] } },
];

test('migrate: KV rỗng → migrated với counts 0 và flip schema', async () => {
  const pool = fakePool([]);
  const report = await migrateKvToTables(pool);
  assert.equal(report.status, 'migrated');
  assert.equal(report.from, 0);
  assert.equal(report.seq, 7);
  assert.deepEqual(report.counts.users, 0);
  const flip = pool.queries.find((q) => q.sql.includes("'schema_version', '2'"));
  assert.ok(flip, 'phải flip schema_version = 2');
});

test('migrate: KV có dữ liệu → ghi đủ 3 bảng đúng số rows', async () => {
  const pool = fakePool(KV);
  const report = await migrateKvToTables(pool);
  assert.equal(report.status, 'migrated');
  assert.equal(report.from, 3);
  assert.equal(report.counts.users, 1);
  assert.equal(report.counts.contests, 1);
  assert.equal(report.counts.submissions, 1);
  // Users upsert với cột typed: username có trong INSERT, password vào extra
  const up = pool.queries.find((q) => q.sql.includes('INSERT INTO users ('));
  assert.match(up.sql, /username/);
  const names = up.sql.match(/INSERT INTO users \(([^)]+)\)/)[1].split(', ');
  const extra = JSON.parse(up.params[names.indexOf('extra')]);
  assert.equal(extra.password, 'h');
});

test('migrate: backup S3 được gọi trước khi ghi bảng, key pre-migration', async () => {
  const pool = fakePool(KV);
  const calls = [];
  const s3Backup = async (key, body) => {
    calls.push({ key, wroteTableBefore: Object.keys(pool.tables).some((t) => (pool.tables[t] || []).length > 0) });
    assert.ok(body.includes('"hero"'), 'backup phải chứa dữ liệu KV');
    return 'ok';
  };
  await migrateKvToTables(pool, { s3Backup });
  assert.equal(calls.length, 1);
  assert.match(calls[0].key, /^backups\/pre-migration-/);
  assert.equal(calls[0].wroteTableBefore, false, 'backup phải xảy ra TRƯỚC ghi bảng');
});

test('migrate: idempotent — schema_version 2 → already, không ghi gì', async () => {
  const pool = fakePool(KV);
  // Mô phỏng DB đã migrate: hack qua flip ở lần chạy giả đầu tiên
  await pool.query(`INSERT INTO dever_meta (key, value) VALUES ('schema_version', '2') ON CONFLICT (key) DO UPDATE`, ['2']);
  pool.queries.length = 0;
  const report = await migrateKvToTables(pool);
  assert.equal(report.status, 'already');
  assert.equal(pool.queries.filter((q) => q.sql.startsWith('INSERT INTO users')).length, 0);
});

test('migrate: đối chiếu lệch → throw và KHÔNG flip schema_version', async () => {
  const pool = fakePool(KV, { countOverride: (t) => (t === 'users' ? 99 : undefined) });
  await assert.rejects(
    () => migrateKvToTables(pool),
    /ĐỐI CHIẾU LỆCH users/
  );
  const flip = pool.queries.find((q) => q.sql.includes("'schema_version', '2'"));
  assert.equal(flip, undefined, 'lệch rows thì không được flip');
});

test('migrate: re-run sau khi migrated thành công → already (idempotent end-to-end)', async () => {
  const pool = fakePool(KV);
  await migrateKvToTables(pool);
  pool.queries.length = 0;
  const report = await migrateKvToTables(pool);
  assert.equal(report.status, 'already');
});

// ---------- Task 130: dropLegacyKv ----------

test('dropLegacyKv: schema chưa v2 → throw, không DROP', async () => {
  const pool = fakePool(KV, { hasKvTable: true });
  await assert.rejects(() => dropLegacyKv(pool), /chưa ở v2/);
  assert.equal(pool.queries.some((q) => q.sql.startsWith('DROP TABLE')), false);
});

test('dropLegacyKv: v2 + dever_store tồn tại → dropped', async () => {
  const pool = fakePool(KV, { hasKvTable: true });
  await pool.query(`INSERT INTO dever_meta (key, value) VALUES ('schema_version', '2') ON CONFLICT (key) DO UPDATE`, ['2']);
  const report = await dropLegacyKv(pool);
  assert.equal(report.status, 'dropped');
  assert.ok(pool.queries.some((q) => q.sql === 'DROP TABLE dever_store'));
});

test('dropLegacyKv: v2 + dever_store không tồn tại → already', async () => {
  const pool = fakePool([], { hasKvTable: false });
  await pool.query(`INSERT INTO dever_meta (key, value) VALUES ('schema_version', '2') ON CONFLICT (key) DO UPDATE`, ['2']);
  const report = await dropLegacyKv(pool);
  assert.equal(report.status, 'already');
});

// ---------- Task 128: readTablesDump + restoreFromDump ----------

/** Pool giả v2: lưu row vào bảng, SELECT * trả về row đã ghi; TRUNCATE xóa trắng. */
function fakePoolV2(seed = {}) {
  const tables = Object.fromEntries(['users', 'contests', 'problems', 'testcases', 'submissions', 'participants', 'virtual_sessions', 'clans', 'clarifications', 'announcements'].map((c) => [c, seed[c] ? [...seed[c]] : []]));
  const meta = [{ key: 'seq', value: 9 }, { key: 'schema_version', value: 2 }];
  const queries = [];
  return {
    queries, tables,
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql === 'SELECT key, value FROM dever_meta') return { rows: meta.map((m) => ({ ...m })) };
      if (sql.includes("dever_meta WHERE key = 'schema_version'")) return { rows: [{ value: '2' }] };
      if (sql.startsWith('SELECT * FROM ')) {
        const t = sql.slice('SELECT * FROM '.length);
        return { rows: (tables[t] || []).map((r) => ({ ...r })) };
      }
      if (/^TRUNCATE (\w+)$/.test(sql)) {
        tables[sql.slice('TRUNCATE '.length)] = [];
        return { rows: [] };
      }
      const m = sql.match(/^INSERT INTO (\w+) \(/);
      if (m && m[1] !== 'dever_meta') {
        const t = m[1];
        const idx = tables[t].findIndex((r) => r.id === params[0]);
        const row = { id: params[0] };
        if (idx >= 0) tables[t][idx] = row;
        else tables[t].push(row);
        return { rows: [] };
      }
      if (/^INSERT INTO dever_meta/.test(sql)) {
        // Key có thể là literal trong SQL (VALUES ('seq', $1)) hoặc param (VALUES ($1, $2))
        const keyMatch = sql.match(/VALUES \('([^']+)',/);
        const key = keyMatch ? keyMatch[1] : params?.[0];
        const value = keyMatch ? params?.[0] : params?.[1];
        const i = meta.findIndex((x) => x.key === key);
        if (i >= 0) meta[i] = { key, value };
        else meta.push({ key, value });
        return { rows: [] };
      }
      if (/^SELECT COUNT\(\*\)/.test(sql)) {
        const t = sql.match(/FROM (\w+)$/)[1];
        return { rows: [{ n: (tables[t] || []).length }] };
      }
      return { rows: [] };
    },
    async end() {},
  };
}

test('readTablesDump: dump 10 collection với ts → ISO, kèm meta', async () => {
  const pool = fakePoolV2({
    users: [{ id: 'u_1', username: 'hero', created_at: new Date('2026-09-29T00:00:00Z') }],
  });
  const { data, meta } = await readTablesDump(pool);
  assert.equal(Object.keys(data).length, 10);
  assert.equal(data.users[0].created_at, '2026-09-29T00:00:00.000Z');
  assert.ok(meta.some((m) => m.key === 'seq'));
});

test('restoreFromDump: round-trip tables dump → TRUNCATE + nạp lại đúng số rows', async () => {
  const pool = fakePoolV2({
    users: [{ id: 'u_1', username: 'hero', rating: 1500, extra: { password: 'h' } }],
    contests: [{ id: 'c_1', slug: 'r1' }],
    submissions: [],
  });
  const { data, meta } = await readTablesDump(pool);
  // Thêm 1 row lạ sau dump — restore phải xóa nó (TRUNCATE thay thế toàn bộ)
  pool.tables.users.push({ id: 'u_ghost' });
  const s3Calls = [];
  const report = await restoreFromDump(pool, { schema_mode: 'tables', meta, data }, {
    s3Backup: async (key) => { s3Calls.push(key); return 'ok'; },
  });
  assert.equal(report.status, 'restored');
  assert.equal(report.counts.users, 1);
  assert.equal(report.counts.contests, 1);
  assert.equal(pool.tables.users.length, 1); // ghost bị xóa
  assert.equal(pool.tables.users[0].id, 'u_1');
  assert.match(s3Calls[0], /^backups\/pre-restore-/);
  // seq được phục hồi từ meta (key literal 'seq', value = params[0])
  const seq = pool.queries.find((q) => q.sql.includes("VALUES ('seq', $1)"));
  assert.equal(seq.params[0], 9);
});

test('restoreFromDump: dump mode kv (payload memory) → nạp trực tiếp', async () => {
  const pool = fakePoolV2();
  const report = await restoreFromDump(pool, {
    schema_mode: 'kv',
    meta: [{ key: 'seq', value: '3' }],
    data: { users: [{ id: 'u_old', username: 'legacy', password: 'h' }], contests: [] },
  });
  assert.equal(report.mode, 'kv');
  assert.equal(report.counts.users, 1);
  assert.equal(pool.tables.users[0].id, 'u_old');
});

test('restoreFromDump: dump sai cấu trúc → throw, không TRUNCATE gì', async () => {
  const pool = fakePoolV2({ users: [{ id: 'u_1' }] });
  await assert.rejects(() => restoreFromDump(pool, { data: { users: 'không-phải-mảng' } }), /phải là mảng/);
  await assert.rejects(() => restoreFromDump(pool, { data: { khong_la_collection: [] } }), /Collection lạ/);
  await assert.rejects(() => restoreFromDump(pool, {}), /thiếu trường data/);
  assert.equal(pool.tables.users.length, 1, 'dữ liệu gốc không bị đụng đến');
  assert.equal(pool.queries.some((q) => q.sql.startsWith('TRUNCATE')), false);
});

/**
 * DEVER Arena — Task 127 tests: migration KV → bảng typed (pool giả).
 * Kiểm tra: idempotent (already), migrated + đối chiếu rows per-table,
 * backup S3 được gọi, lệch số rows → throw và KHÔNG flip schema.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateKvToTables } from '../server/pg_migrate.js';

/** Pool giả: dever_store đầu vào → ghi vào "bảng" in-memory, COUNT theo nội dung đã ghi. */
function fakePool(kvRows = [], { countOverride = null } = {}) {
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

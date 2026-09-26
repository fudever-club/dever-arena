/**
 * DEVER Arena — Postgres store tests (pool giả, KHÔNG cần server Postgres thật).
 * Kiểm tra: migrate SQL, nạp dữ liệu, insert/update/nextId + flush upsert.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPgStore, MIGRATE_SQL } from '../server/pg.js';

function fakePool(seedRows = [], seedSeq = 1) {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('SELECT collection')) return { rows: seedRows };
      if (sql.includes('dever_meta WHERE')) return { rows: [{ value: seedSeq }] };
      return { rows: [] };
    },
    async end() {},
  };
}

test('migrate chạy đủ 3 câu lệnh tạo bảng', async () => {
  const pool = fakePool();
  await createPgStore(pool, { flushMs: 60000 });
  const ddl = pool.queries.map((q) => q.sql).filter((s) => s.startsWith('CREATE') || s.includes('ON CONFLICT (key) DO NOTHING'));
  assert.equal(ddl.length, 3);
  assert.ok(ddl[0].includes('CREATE TABLE IF NOT EXISTS dever_store'));
  assert.ok(ddl[1].includes('CREATE TABLE IF NOT EXISTS dever_meta'));
  assert.ok(ddl[2].includes("ON CONFLICT (key) DO NOTHING"));
});

test('nạp rows + seq từ Postgres vào đúng collections', async () => {
  const pool = fakePool(
    [{ collection: 'users', id: 'u1', payload: { id: 'u1', username: 'a' } }],
    42
  );
  const store = await createPgStore(pool, { flushMs: 60000 });
  assert.equal(store.data.users.length, 1);
  assert.equal(store.data.users[0].username, 'a');
  assert.equal(store.data.seq, 42);
  assert.deepEqual(store.filter('users', (u) => u.id === 'u1').length, 1);
  await store.stop();
});

test('insert/update/nextId rồi flush ghi upsert đúng SQL', async () => {
  const pool = fakePool();
  const store = await createPgStore(pool, { flushMs: 60000 });
  const id = store.nextId('sub');
  assert.match(id, /^sub_/);
  store.insert('submissions', { id, verdict: 'AC' });
  store.update('submissions', (s) => s.id === id, { points_awarded: 500 });
  assert.equal(store.find('submissions', (s) => s.id === id).points_awarded, 500);
  await store.flush();
  const upserts = pool.queries.filter((q) => q.sql.includes('ON CONFLICT (collection, id)'));
  assert.ok(upserts.length >= 1);
  assert.equal(upserts[0].params[0], 'submissions');
  const meta = pool.queries.filter((q) => q.sql.includes('dever_meta'));
  assert.ok(meta.length >= 1);
  await store.stop();
});

test('MIGRATE_SQL export đủ để review', () => {
  assert.equal(MIGRATE_SQL.length, 3);
});

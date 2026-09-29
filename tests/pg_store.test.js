/**
 * DEVER Arena — Postgres store tests (pool giả, KHÔNG cần server Postgres thật).
 * Phase 36: 2 mode — 'kv' (legacy dever_store) và 'tables' (schema v2, Task 125–126).
 * Kiểm tra: DDL, nạp dữ liệu, upsert per-table với cột typed + extra JSONB,
 * mirror DELETE, round-trip rowToValues/rowToPayload, tự chọn mode khi boot.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPgStore, MIGRATE_SQL, COLLECTIONS } from '../server/pg.js';
import { TABLES_SQL, TABLE_COLUMNS, rowToValues, rowToPayload, buildUpsert, SCHEMA_VERSION } from '../server/pg_schema.js';

/** Pool giả: trả lời đúng các query boot của pg.js, ghi nhận mọi SQL + params. */
function fakePool({ legacyRows = [], hasLegacyTable = false, seedSeq = 1, tableRows = {} } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("dever_meta WHERE key = 'schema_version'")) return { rows: [{ value: 1 }] };
      if (sql.includes('information_schema.tables')) return { rows: [{ ok: hasLegacyTable }] };
      if (sql.includes('COUNT(*)') && sql.includes('dever_store')) {
        return { rows: [{ n: legacyRows.length }] };
      }
      if (sql.startsWith('SELECT collection')) return { rows: legacyRows };
      const m = sql.match(/^SELECT \* FROM (\w+)$/);
      if (m) return { rows: tableRows[m[1]] || [] };
      if (sql.includes("dever_meta WHERE key = 'seq'")) return { rows: [{ value: seedSeq }] };
      return { rows: [] };
    },
    async end() {},
  };
}

// ---------- Mode kv (legacy) — hành vi cũ giữ nguyên ----------

test('[kv] migrate chạy đủ 3 câu lệnh tạo bảng legacy', async () => {
  const pool = fakePool();
  const store = await createPgStore(pool, { flushMs: 60000, schema: 'kv' });
  assert.equal(store.mode, 'kv');
  // Boot luôn chạy BOOT_META_SQL (3) trước MIGRATE_SQL (3) — cần key schema_version kể cả mode kv.
  const ddl = pool.queries.map((q) => q.sql).filter((s) => s.startsWith('CREATE') || s.includes('ON CONFLICT (key) DO NOTHING'));
  assert.equal(ddl.length, 6);
  assert.ok(pool.queries.some((q) => q.sql.includes('CREATE TABLE IF NOT EXISTS dever_store')));
  await store.stop();
});

test('[kv] nạp rows + seq từ dever_store vào đúng collections', async () => {
  const pool = fakePool({
    hasLegacyTable: true,
    legacyRows: [{ collection: 'users', id: 'u1', payload: { id: 'u1', username: 'a' } }],
    seedSeq: 42,
  });
  const store = await createPgStore(pool, { flushMs: 60000, schema: 'kv' });
  assert.equal(store.mode, 'kv');
  assert.equal(store.data.users.length, 1);
  assert.equal(store.data.users[0].username, 'a');
  assert.equal(store.data.seq, 42);
  assert.deepEqual(store.filter('users', (u) => u.id === 'u1').length, 1);
  await store.stop();
});

test('[kv] insert/update/nextId rồi flush ghi upsert JSONB + meta seq', async () => {
  const pool = fakePool();
  const store = await createPgStore(pool, { flushMs: 60000, schema: 'kv' });
  const id = store.nextId('sub');
  assert.match(id, /^sub_/);
  store.insert('submissions', { id, verdict: 'AC' });
  store.update('submissions', (s) => s.id === id, { points_awarded: 500 });
  assert.equal(store.find('submissions', (s) => s.id === id).points_awarded, 500);
  await store.flush();
  const upserts = pool.queries.filter((q) => q.sql.includes('ON CONFLICT (collection, id)'));
  assert.ok(upserts.length >= 1);
  assert.equal(upserts[0].params[0], 'submissions');
  assert.ok(pool.queries.some((q) => q.sql.includes('dever_meta')));
  await store.stop();
});

test('[kv] flush mirror DELETE — row bị xóa khỏi memory biến mất khỏi DB', async () => {
  const pool = fakePool();
  const store = await createPgStore(pool, { flushMs: 60000, schema: 'kv' });
  store.insert('users', { id: 'u_a' });
  store.insert('users', { id: 'u_b' });
  await store.flush();
  store.data.users = store.data.users.filter((u) => u.id !== 'u_a');
  store.save();
  await store.flush();
  const del = pool.queries.filter((q) => q.sql.startsWith('DELETE FROM dever_store') && q.params?.[0] === 'users' && q.params.length === 2).pop();
  assert.deepEqual(del.params[1], ['u_b']);
  await store.stop();
});

test('[kv] DB còn dữ liệu legacy → boot tự chọn mode kv (không tự nâng schema)', async () => {
  const pool = fakePool({ hasLegacyTable: true, legacyRows: [{ collection: 'users', id: 'x', payload: { id: 'x' } }] });
  const store = await createPgStore(pool, { flushMs: 60000 });
  assert.equal(store.mode, 'kv');
  await store.stop();
});

// ---------- Mode tables (schema v2) ----------

test('[tables] boot DB mới → mode tables, DDL đủ 10 bảng + index + ghi schema_version', async () => {
  const pool = fakePool();
  const store = await createPgStore(pool, { flushMs: 60000 });
  assert.equal(store.mode, 'tables');
  const creates = pool.queries.map((q) => q.sql).filter((s) => s.includes('CREATE TABLE IF NOT EXISTS'));
  for (const col of COLLECTIONS) {
    assert.ok(creates.some((s) => s.includes(`CREATE TABLE IF NOT EXISTS ${col} (`)), `thiếu bảng ${col}`);
  }
  const idx = pool.queries.map((q) => q.sql).filter((s) => s.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username'));
  assert.equal(idx.length, 1);
  assert.ok(pool.queries.some((q) => q.sql.includes("'schema_version', $1") && q.params?.[0] === SCHEMA_VERSION));
  await store.stop();
});

test('[tables] nạp rows từ bảng thật qua rowToPayload (Date → ISO, extra gộp lại)', async () => {
  const submitted = new Date('2026-09-29T03:00:00.000Z');
  const pool = fakePool({
    tableRows: {
      users: [{ id: 'u_1', username: 'hero', role: 'ADMIN', rating: 1500, email: null, extra: { password: 'hashxyz', rating_history: [1200, 1500] } }],
      submissions: [{ id: 's_1', user_id: 'u_1', problem_id: 'p_1', contest_id: null, verdict: 'AC', submitted_at: submitted, per_test: [{ index: 0, verdict: 'AC' }], extra: {} }],
    },
  });
  const store = await createPgStore(pool, { flushMs: 60000 });
  assert.equal(store.data.users.length, 1);
  const u = store.data.users[0];
  assert.equal(u.username, 'hero');
  assert.equal(u.password, 'hashxyz'); // trường lạ trong extra được trả về đúng shape cũ
  assert.deepEqual(u.rating_history, [1200, 1500]);
  const s = store.data.submissions[0];
  assert.equal(s.submitted_at, '2026-09-29T03:00:00.000Z');
  assert.deepEqual(s.per_test, [{ index: 0, verdict: 'AC' }]);
  assert.equal('source_code' in s, false); // NULL → khóa không tồn tại (giống KV stringify)
  await store.stop();
});

test('[tables] flush upsert per-table: cột typed đúng vị trí, trường lạ vào extra JSONB', async () => {
  const pool = fakePool();
  const store = await createPgStore(pool, { flushMs: 60000 });
  store.insert('contests', {
    id: 'contest_x', slug: 'round-1', title: 'Round 1', contest_format: 'ICPC',
    start_time: '2026-09-29T02:00:00.000Z', duration_minutes: 120, is_rated: true,
    organizer_id: 'u_admin', rating_history: [1, 2], // trường lạ → extra
  });
  await store.flush();
  const up = pool.queries.find((q) => q.sql.includes('INSERT INTO contests'));
  assert.ok(up);
  assert.match(up.sql, /ON CONFLICT \(id\) DO UPDATE/);
  const names = up.sql.match(/INSERT INTO contests \(([^)]+)\)/)[1].split(', ');
  assert.deepEqual(names.slice(0, 4), ['id', 'slug', 'title', 'contest_format']);
  const startIdx = names.indexOf('start_time');
  assert.equal(up.params[startIdx], '2026-09-29T02:00:00.000Z');
  const extraIdx = names.indexOf('extra');
  const extra = JSON.parse(up.params[extraIdx]);
  assert.deepEqual(extra.rating_history, [1, 2]);
  assert.equal(extra.id, undefined);
  await store.stop();
});

test('[tables] flush mirror DELETE per-table với danh sách id còn lại', async () => {
  const pool = fakePool();
  const store = await createPgStore(pool, { flushMs: 60000 });
  store.insert('problems', { id: 'p_a', contest_id: 'c1' });
  store.insert('problems', { id: 'p_b', contest_id: 'c1' });
  await store.flush();
  store.data.problems = store.data.problems.filter((p) => p.id !== 'p_a');
  store.save();
  await store.flush();
  const dels = pool.queries.filter((q) => q.sql.startsWith('DELETE FROM problems'));
  const last = dels[dels.length - 1];
  assert.match(last.sql, /WHERE NOT \(id = ANY\(\$1\)\)/);
  assert.deepEqual(last.params[0], ['p_b']);
  // Collection rỗng → DELETE toàn bảng
  store.data.problems = [];
  store.save();
  await store.flush();
  const lastDel = pool.queries.filter((q) => q.sql.startsWith('DELETE FROM problems')).pop();
  assert.equal(lastDel.sql, 'DELETE FROM problems');
  await store.stop();
});

test('[tables] cập nhật verdict bài nộp giữ nguyên id — upsert ghi đè đúng hàng', async () => {
  const pool = fakePool();
  const store = await createPgStore(pool, { flushMs: 60000 });
  const id = store.nextId('sub');
  store.insert('submissions', { id, user_id: 'u_1', problem_id: 'p_1', verdict: 'PENDING', submitted_at: '2026-09-29T03:00:00.000Z' });
  store.update('submissions', (s) => s.id === id, { verdict: 'AC', points_awarded: 450.5, per_test: [{ index: 0, verdict: 'AC', time_ms: 12 }] });
  await store.flush();
  const up = pool.queries.filter((q) => q.sql.includes('INSERT INTO submissions')).pop();
  const names = up.sql.match(/INSERT INTO submissions \(([^)]+)\)/)[1].split(', ');
  const v = (n) => up.params[names.indexOf(n)];
  assert.equal(v('id'), id);
  assert.equal(v('verdict'), 'AC');
  assert.equal(v('points_awarded'), 450.5);
  // jsonb luôn gửi chuỗi JSON (mảng trực tiếp → pg biến thành array literal {…} → lỗi)
  assert.equal(v('per_test'), '[{"index":0,"verdict":"AC","time_ms":12}]');
  await store.stop();
});

// ---------- Converter rowToValues / rowToPayload (unit thuần) ----------

test('rowToValues: ts/jsonb/int/bool coerce + undefined → NULL + null giữ null', () => {
  const { cols, extra } = rowToValues('submissions', {
    id: 's_1', submitted_at: '2026-09-29T00:00:00.000Z', per_test: '[1,2]', // chuỗi jsonb hợp lệ → parse
    time_ms: '123', is_upsolve: 1, detail: null, source_code: undefined, weird_field: { a: 1 },
  });
  assert.equal(cols.submitted_at, '2026-09-29T00:00:00.000Z');
  // jsonb LUÔN là chuỗi JSON — mảng truyền trực tiếp bị pg driver biến thành {1,2} (invalid json)
  assert.equal(cols.per_test, '[1,2]');
  assert.equal(cols.time_ms, 123);
  assert.equal(cols.is_upsolve, true);
  assert.equal(cols.detail, null);
  assert.equal(cols.source_code, null); // undefined → NULL cột
  assert.deepEqual(extra.weird_field, { a: 1 });
  assert.equal(extra.id, undefined);
});

test('rowToValues: REGRESSION — mảng/object cho cột jsonb phải ra chuỗi JSON (không phải Postgres array literal)', () => {
  const { cols } = rowToValues('problems', { id: 'p_1', tags: ['math', 'implementation'] });
  assert.equal(cols.tags, '["math","implementation"]');
  const { cols: c2 } = rowToValues('submissions', { id: 's_2', per_test: [{ index: 0, verdict: 'AC', time_ms: 12 }] });
  assert.equal(c2.per_test, '[{"index":0,"verdict":"AC","time_ms":12}]');
});

test('buildUpsert: bool thiếu → false, cột NULL bị bỏ khỏi INSERT nhưng SET NULL', () => {
  // is_upsolve không có trong payload — flush cũ truyền NULL → vi phạm NOT NULL trên prod
  const { names, vals, ph, setSql } = buildUpsert('submissions', {
    id: 's_9', user_id: 'u_1', problem_id: 'p_1', verdict: 'AC', is_upsolve: undefined, detail: null,
  });
  assert.ok(names.includes('is_upsolve'));
  assert.equal(vals[names.indexOf('is_upsolve')], false);
  // detail = null: không nằm trong INSERT (DEFAULT) nhưng được SET NULL khi update
  assert.equal(names.includes('detail'), false);
  assert.match(setSql, /detail = NULL/);
  assert.match(setSql, /is_upsolve = \$\d+/);
  assert.equal(ph.split(',').length, names.length);
  assert.equal(vals.length, names.length);
});

test('rowToValues: ts không hợp lệ → NULL, int NaN → NULL', () => {
  const { cols } = rowToValues('contests', { id: 'c', start_time: 'không-phải-ngày', duration_minutes: 'abc' });
  assert.equal(cols.start_time, null);
  assert.equal(cols.duration_minutes, null);
});

test('rowToPayload: round-trip ngược — ts ISO, extra gộp, created_at bỏ qua', () => {
  const row = {
    id: 'a_1', contest_id: 'c1', message: 'hi', created_at: new Date('2026-09-29T00:00:00Z'),
    extra: { pinned: true },
  };
  const payload = rowToPayload('announcements', row);
  assert.deepEqual(payload, { id: 'a_1', contest_id: 'c1', message: 'hi', pinned: true });
});

test('rowToPayload: NULL có bản gốc trong extra → trả lại giá trị gốc (chống truncate)', () => {
  const row = { id: 'u_1', username: 'x', email: null, extra: { email: 'old@fpt.edu.vn' } };
  const payload = rowToPayload('users', row);
  assert.equal(payload.email, 'old@fpt.edu.vn');
});

// ---------- Export đối chiếu ----------

test('schema exports đầy đủ để review', () => {
  assert.equal(MIGRATE_SQL.length, 3);
  assert.equal(TABLES_SQL.filter((s) => s.includes('CREATE TABLE')).length, COLLECTIONS.length);
  assert.deepEqual(Object.keys(TABLE_COLUMNS).sort(), [...COLLECTIONS].sort());
  assert.equal(SCHEMA_VERSION, 2);
});

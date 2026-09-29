/**
 * DEVER Arena — Task 125 (Phase 36): DDL schema bảng PostgreSQL thật.
 *
 * Thay 1 bảng KV generic `dever_store(collection, id, payload JSONB)` bằng 10 bảng
 * relational thật. Nguyên tắc (đã chốt với chủ dự án — ADR Phase 36):
 *  - Cột typed thật cho mọi trường cần lọc/join/unique (username, contest_id, verdict…).
 *  - JSONB giữ cho blob động ít cấu trúc (per_test, statistics, settings, bounds…).
 *  - `id` giữ TEXT — tương thích id hiện tại (`u_1_x`, `sub_2_y`), không chuyển UUID.
 *  - Mỗi bảng có cột `extra JSONB NOT NULL DEFAULT '{}'` — catch-all mọi trường lạ
 *    (dữ liệu cũ, trường mới chưa migrate) nên flush KHÔNG BAO GIỜ mất dữ liệu.
 *  - Không FK/CHECK ở v2: mirror bộ nhớ là nguồn sự thật, FK sẽ thêm ở Phase sau
 *    khi dữ liệu sạch; tránh ràng buộc làm vỡ mirror load từ dữ liệu cũ.
 *  - Idempotent: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS — chạy lại an toàn.
 */

export const SCHEMA_VERSION = 2;

/** DDL tạo 10 bảng + index. Chạy tuần tự (pool.query từng câu). */
export const TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     username TEXT NOT NULL,
     email TEXT,
     password_hash TEXT,
     full_name TEXT,
     role TEXT NOT NULL DEFAULT 'PARTICIPANT',
     rating INTEGER NOT NULL DEFAULT 1200,
     max_rating INTEGER NOT NULL DEFAULT 1200,
     team TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     extra JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username)`,

  `CREATE TABLE IF NOT EXISTS contests (
     id TEXT PRIMARY KEY,
     slug TEXT NOT NULL,
     title TEXT NOT NULL,
     contest_format TEXT NOT NULL DEFAULT 'ICPC',
     start_time TIMESTAMPTZ,
     duration_minutes INTEGER NOT NULL DEFAULT 120,
     status TEXT NOT NULL DEFAULT 'REGISTRATION',
     is_rated BOOLEAN NOT NULL DEFAULT true,
     min_rating INTEGER,
     max_rating INTEGER,
     organizer_id TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     extra JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_contests_slug ON contests (slug)`,

  `CREATE TABLE IF NOT EXISTS problems (
     id TEXT PRIMARY KEY,
     contest_id TEXT,
     code TEXT,
     title TEXT,
     rating INTEGER NOT NULL DEFAULT 1000,
     base_points INTEGER NOT NULL DEFAULT 1000,
     tags JSONB NOT NULL DEFAULT '[]'::jsonb,
     solved_count INTEGER NOT NULL DEFAULT 0,
     workflow_status TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     extra JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS idx_problems_contest ON problems (contest_id)`,
  `CREATE INDEX IF NOT EXISTS idx_problems_rating ON problems (base_points)`,

  `CREATE TABLE IF NOT EXISTS testcases (
     id TEXT PRIMARY KEY,
     problem_id TEXT NOT NULL,
     order_index INTEGER NOT NULL DEFAULT 0,
     stdin TEXT,
     expected_stdout TEXT,
     is_sample BOOLEAN NOT NULL DEFAULT false,
     is_pretest BOOLEAN NOT NULL DEFAULT false,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     extra JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS idx_testcases_problem ON testcases (problem_id, order_index)`,

  `CREATE TABLE IF NOT EXISTS submissions (
     id TEXT PRIMARY KEY,
     user_id TEXT,
     contest_id TEXT,
     problem_id TEXT NOT NULL,
     language TEXT,
     verdict TEXT,
     points_awarded DOUBLE PRECISION NOT NULL DEFAULT 0,
     time_ms INTEGER,
     elapsed_min INTEGER,
     submitted_at TIMESTAMPTZ,
     source_code TEXT,
     source_key TEXT,
     per_test JSONB,
     passed_tests INTEGER,
     total_tests INTEGER,
     detail TEXT,
     is_upsolve BOOLEAN NOT NULL DEFAULT false,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     extra JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sub_contest_user_problem ON submissions (contest_id, user_id, problem_id, submitted_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_sub_submitted_at ON submissions (submitted_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_sub_user ON submissions (user_id)`,
  // Nâng cấp CF-parity: passedTestCount cho cả bài WA (bảng Status của CF hiển thị "passed X/Y") — idempotent cho bảng có sẵn.
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS passed_tests INTEGER`,
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS total_tests INTEGER`,

  `CREATE TABLE IF NOT EXISTS participants (
     id TEXT PRIMARY KEY,
     contest_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     registered_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     extra JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS idx_part_contest_user ON participants (contest_id, user_id)`,

  `CREATE TABLE IF NOT EXISTS virtual_sessions (
     id TEXT PRIMARY KEY,
     contest_id TEXT,
     user_id TEXT,
     start_time TIMESTAMPTZ,
     duration_minutes INTEGER NOT NULL DEFAULT 120,
     status TEXT NOT NULL DEFAULT 'ACTIVE',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     extra JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS idx_vs_user ON virtual_sessions (user_id)`,

  // Di sản frozen (Phase 15 đã xóa tính năng) — bảng tối giản chỉ để dump/restore.
  `CREATE TABLE IF NOT EXISTS clans (
     id TEXT PRIMARY KEY,
     name TEXT,
     tag TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     extra JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,

  `CREATE TABLE IF NOT EXISTS clarifications (
     id TEXT PRIMARY KEY,
     contest_id TEXT NOT NULL,
     problem_id TEXT,
     asker_id TEXT,
     question TEXT NOT NULL,
     answer TEXT,
     answered_by TEXT,
     answered_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     extra JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS idx_clar_contest ON clarifications (contest_id, created_at)`,

  `CREATE TABLE IF NOT EXISTS announcements (
     id TEXT PRIMARY KEY,
     contest_id TEXT NOT NULL,
     message TEXT NOT NULL,
     created_by TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     extra JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS idx_ann_contest ON announcements (contest_id, created_at)`,
];

/**
 * Map cột mỗi bảng: giá trị = { col: kiểu }. Kiểu:
 *  - 'jsonb'      → payload trường đó là JSON (array/object)
 *  - 'text'/'int'/'bool'/'float'/'ts' → coerce tương ứng; null/undefined → NULL
 * Trường KHÔNG có trong map → gom vào cột `extra` (JSONB). `id` luôn là PK.
 */
export const TABLE_COLUMNS = {
  users: {
    username: 'text', email: 'text', password_hash: 'text', full_name: 'text',
    role: 'text', rating: 'int', max_rating: 'int', team: 'text',
  },
  contests: {
    slug: 'text', title: 'text', contest_format: 'text', start_time: 'ts',
    duration_minutes: 'int', status: 'text', is_rated: 'bool',
    min_rating: 'int', max_rating: 'int', organizer_id: 'text',
  },
  problems: {
    contest_id: 'text', code: 'text', title: 'text', rating: 'int',
    base_points: 'int', tags: 'jsonb', solved_count: 'int', workflow_status: 'text',
  },
  testcases: {
    problem_id: 'text', order_index: 'int', stdin: 'text', expected_stdout: 'text',
    is_sample: 'bool', is_pretest: 'bool',
  },
  submissions: {
    user_id: 'text', contest_id: 'text', problem_id: 'text', language: 'text',
    verdict: 'text', points_awarded: 'float', time_ms: 'int', elapsed_min: 'int',
    submitted_at: 'ts', source_code: 'text', source_key: 'text', per_test: 'jsonb',
    passed_tests: 'int', total_tests: 'int',
    detail: 'text', is_upsolve: 'bool',
  },
  participants: {
    contest_id: 'text', user_id: 'text', registered_at: 'ts',
  },
  virtual_sessions: {
    contest_id: 'text', user_id: 'text', start_time: 'ts',
    duration_minutes: 'int', status: 'text',
  },
  clans: {
    name: 'text', tag: 'text',
  },
  clarifications: {
    contest_id: 'text', problem_id: 'text', asker_id: 'text', question: 'text',
    answer: 'text', answered_by: 'text', answered_at: 'ts',
  },
  announcements: {
    contest_id: 'text', message: 'text', created_by: 'text',
  },
};

/**
 * Chuyển 1 payload (row bộ nhớ) → { cols, vals, extra } cho INSERT/UPDATE.
 * - 'ts': ISO string / timestamp → Date (pg serialize ISO); null → NULL.
 * - 'jsonb': object/array giữ nguyên; string hợp lệ → parse trước (dữ liệu cũ có thể lưu chuỗi).
 * - 'int'/'float': Number(); NaN → NULL. 'bool': Boolean. 'text': String.
 * - Trường không khai báo → extra (JSONB); id không bao giờ vào extra.
 */
export function rowToValues(table, payload) {
  const colMap = TABLE_COLUMNS[table] || {};
  const cols = {};
  const extra = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'id') continue;
    const type = colMap[key];
    if (type === undefined) { extra[key] = value; continue; }
    if (value === null || value === undefined) {
      // Cột bool NOT NULL DEFAULT false: thiếu giá trị → false (không bao giờ NULL).
      cols[key] = type === 'bool' ? false : null;
      continue;
    }
    switch (type) {
      case 'ts': {
        const d = value instanceof Date ? value : new Date(value);
        cols[key] = Number.isNaN(d.getTime()) ? null : d.toISOString();
        break;
      }
      case 'jsonb': {
        // QUAN TRỌNG: luôn gửi CHUỖI JSON cho cột jsonb — nếu truyền mảng/object trực tiếp,
        // driver pg biến mảng thành Postgres array literal {a,b} → "invalid input syntax for type json".
        const parsed = typeof value === 'string' ? safeParse(value, value) : value;
        cols[key] = JSON.stringify(parsed);
        break;
      }
      case 'int': {
        const n = Number(value);
        cols[key] = Number.isFinite(n) ? Math.trunc(n) : null;
        break;
      }
      case 'float': {
        const n = Number(value);
        cols[key] = Number.isFinite(n) ? n : null;
        break;
      }
      case 'bool':
        // Mọi cột bool trong schema đều NOT NULL — undefined/null → false (giống DEFAULT).
        cols[key] = value == null ? false : Boolean(value);
        break;
      default: // 'text'
        cols[key] = typeof value === 'string' ? value : String(value);
    }
  }
  return { cols, extra };
}

function safeParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

/**
 * Dựng 1 câu upsert dùng chung cho flush/migrate/restore:
 *  - Cột có giá trị NULL được BỎ KHỎI INSERT (DEFAULT của bảng áp dụng — tránh vi phạm
 *    NOT NULL như is_upsolve/is_pretest/is_rated) nhưng vẫn SET NULL trong UPDATE (mirror đúng).
 *  - extra JSONB luôn là chuỗi JSON.
 * Trả { names, vals, ph, setSql } cho: INSERT INTO t (names) VALUES (ph) ON CONFLICT (id) DO UPDATE setSql.
 */
export function buildUpsert(table, payload) {
  const { cols, extra } = rowToValues(table, payload);
  const nnKeys = [];
  const nullKeys = [];
  for (const [k, v] of Object.entries(cols)) (v === null ? nullKeys : nnKeys).push(k);
  const names = ['id', ...nnKeys, 'extra'];
  const vals = [String(payload.id), ...nnKeys.map((k) => cols[k]), JSON.stringify(extra)];
  const ph = names.map((_, i) => `$${i + 1}`).join(', ');
  const sets = [
    ...nnKeys.map((k, i) => `${k} = $${i + 2}`),
    ...nullKeys.map((k) => `${k} = NULL`),
    `extra = $${nnKeys.length + 2}`,
  ];
  return { names, vals, ph, setSql: sets.join(', ') };
}

/**
 * Chuyển 1 row Postgres (từ SELECT) → payload bộ nhớ đúng shape cũ.
 * Ngược với rowToValues: gộp extra vào, ts trả ISO string, jsonb trả object.
 */
export function rowToPayload(table, row) {
  const colMap = TABLE_COLUMNS[table] || {};
  const out = { id: row.id };
  const extras = row.extra && typeof row.extra === 'object' ? row.extra : {};
  const seen = new Set();
  for (const [key, value] of Object.entries(row)) {
    if (key === 'id' || key === 'extra' || key === 'created_at') { seen.add(key); continue; }
    seen.add(key);
    if (value === null || value === undefined) {
      // NULL có nghĩa "không có / bị truncate" — chỉ khôi phục nếu extra giữ bản gốc.
      if (key in extras) out[key] = extras[key];
      continue;
    }
    if (colMap[key] === 'jsonb') out[key] = typeof value === 'string' ? safeParse(value, value) : value;
    else if (colMap[key] === 'bool') out[key] = Boolean(value);
    else if (colMap[key] === 'ts') out[key] = value instanceof Date ? value.toISOString() : String(value);
    else out[key] = value;
  }
  // Trường chỉ tồn tại trong extra (trường lạ/cũ) → trả lại đúng shape cũ.
  for (const [key, value] of Object.entries(extras)) {
    if (!seen.has(key) || out[key] === undefined) out[key] = value;
  }
  return out;
}

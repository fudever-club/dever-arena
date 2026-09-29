---
name: dever-db-schema
description: Quy ước schema PostgreSQL v2 của DEVER Arena — 10 bảng typed, extra JSONB, buildUpsert, mirror flush, migration. Dùng khi sửa schema, viết query mới, migrate dữ liệu.
---

# DEVER DB Schema v2 (Postgres thật)

## Nguồn sự thật
- DDL + map cột: `server/pg_schema.js` (TABLES_SQL, TABLE_COLUMNS, rowToValues, rowToPayload, buildUpsert).
- Adapter: `server/pg.js` (2 mode: kv legacy / tables v2 — boot tự chọn theo `dever_meta.schema_version` + dữ liệu KV còn lại).
- Tài liệu: `docs/DATABASE_SCHEMA.md` (nguồn sự thật mô tả).

## Kiến trúc mirror + flush
- Server đọc/ghi bộ nhớ đồng bộ (`db.data.*` qua facade `find/filter/insert/update/nextId`); flush mỗi 5s upsert per-row + **mirror DELETE** (row xóa khỏi memory phải biến mất khỏi DB).
- Facade KHÔNG ĐỔI giữa 2 mode — `server/index.js` không bao giờ viết SQL trực tiếp.

## Quy tắc khi sửa schema
1. Thêm cột: sửa `TABLES_SQL` + `TABLE_COLUMNS` + **`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`** riêng (bảng có sẵn tự nâng).
2. Mọi ghi phải qua `buildUpsert(table, payload)` — KHÔNG tựINSERT thủ công (3 chỗ dùng chung: flush/migrate/restore).
3. jsonb LUÔN gửi CHUỖI JSON (`JSON.stringify`) — mảng JS trực tiếp bị pg driver biến Postgres array literal → `invalid input syntax for type json` (bug prod 29/9).
4. bool undefined/null → `false` (cột bool đều NOT NULL DEFAULT false); cột NULL bị buildUpsert bỏ khỏi INSERT để DB áp DEFAULT.
5. `id` giữ TEXT, không chuyển UUID. Trường lạ tự rơi vào `extra JSONB` — không mất dữ liệu.
6. NULL khi load → khóa bị bỏ (giữ nghĩa `source_code === undefined` mà API dựa vào).
7. Migration: viết vào `server/pg_migrate.js` (pool inject, idempotent, backup S3 trước, đối chiếu COUNT, flip schema_version cuối).

## Checklist mọi PR đụng DB
- [ ] `tests/pg_store.test.js` + `tests/pg_migrate.test.js` có test mới cho thay đổi
- [ ] Chạy local: `npm test` xanh (212+)
- [ ] Verify prod thật sau deploy: `specific query --db main` đối chiếu rows
- [ ] `docs/DATABASE_SCHEMA.md` cập nhật nếu đổi cấu trúc

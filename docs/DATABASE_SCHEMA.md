# THIẾT KẾ CƠ SỞ DỮ LIỆU — SCHEMA v2 (NGUỒN SỰ THẬT)
> **Tài liệu này mô tả đúng schema PostgreSQL đang chạy trên production** (Phase 36, schema v2 từ 29/9/2026).
> Nguồn sự thật kỹ thuật: `server/pg_schema.js` (DDL + map cột) và `server/pg.js` (adapter).
> Lịch sử: v1 là 1 bảng KV generic `dever_store(collection, id, payload JSONB)` — đã migrate sang v2 ngày 29/9/2026 và **DROP** (bản dump trước migration nằm trên S3: `backups/pre-migration-*.json`). ERD "chuẩn doanh nghiệp" 12 bảng (UUID, hack_events, discussions…) cũ của tài liệu này là thiết kế tham chiếu, đã thay bằng schema thực tế dưới đây.

---

## 1. KIẾN TRÚC LƯU TRỮ (PHIÊN BẢN ĐANG CHẠY)

- **Mirror bộ nhớ + flush write-through:** server giữ toàn bộ dữ liệu trong mirror đồng bộ (`db.data.*`), facade `find/filter/insert/update/nextId` đọc/ghi bộ nhớ tức thì; mỗi 5 giây `flush()` upsert per-row vào Postgres + **mirror DELETE** (row bị xóa khỏi memory biến mất khỏi DB — chống "hồi sinh" dữ liệu).
- **Cột typed + `extra JSONB`:** mọi trường cần lọc/join/unique là cột thật; mỗi bảng có cột `extra JSONB DEFAULT '{}'` làm catch-all cho trường lạ (dữ liệu cũ, trường tương lai) — **flush không bao giờ mất dữ liệu**.
- **Không FK/CHECK ở v2:** mirror bộ nhớ là nguồn sự thật; ràng buộc chặt sẽ thêm ở phase sau khi dữ liệu sạch.
- **`id` là TEXT** (`u_1_lx3k`, `sub_2_abc`…): tương thích id hiện có, không chuyển UUID.
- **JSONB giữ cho blob động:** `submissions.per_test`, `problems.tags/bounds`, `users.rating_history/password` (trong extra).
- **`dever_meta`:** bảng meta (`seq` — counter ID, `schema_version` — cờ mode adapter). Boot tự chọn mode: `schema_version >= 2` → bảng thật; còn dữ liệu KV → mode legacy (không còn relevant sau khi đã drop).

## 2. 10 BẢNG DOMAIN

### 2.1. `users` — tài khoản (thí sinh / organizer / admin)
| Cột | Kiểu | Ghi chú |
| :-- | :-- | :-- |
| `id` | TEXT PK | |
| `username` | TEXT NOT NULL | **UNIQUE** (`idx_users_username`) |
| `email` | TEXT | nullable |
| `password_hash` | TEXT | bcrypt-style hash (`hashPassword`) |
| `full_name` | TEXT | |
| `role` | TEXT | `PARTICIPANT \| ORGANIZER \| ADMIN` |
| `rating` / `max_rating` | INTEGER | Elo, default 1200 |
| `team` | TEXT | tên đội (nullable) |
| `created_at` | TIMESTAMPTZ | default now() |
| `extra` | JSONB | `members[]`, `rating_history[]`, `password` (legacy seed)… |

### 2.2. `contests` — kỳ thi
| Cột | Kiểu | Ghi chú |
| :-- | :-- | :-- |
| `id` | TEXT PK | |
| `slug` | TEXT NOT NULL | **UNIQUE** (`idx_contests_slug`) |
| `title` | TEXT NOT NULL | |
| `contest_format` | TEXT | `ICPC \| CODEFORCES \| IOI` |
| `start_time` | TIMESTAMPTZ | |
| `duration_minutes` | INTEGER | 15–600 (kẹp ở API) |
| `status` | TEXT | `REGISTRATION → CODING → FINISHED` (ADR-005) |
| `is_rated` | BOOLEAN | |
| `min_rating` / `max_rating` | INTEGER | cửa sổ phân hạng (nullable) |
| `organizer_id` | TEXT | tham chiếu logic `users.id` (multi-organizer Task 119) |
| `extra` | JSONB | trường mở rộng |

### 2.3. `problems` — đề bài
`id` PK · `contest_id` (tham chiếu logic contests) · `code` (A/B/C…) · `title` · `rating`/`base_points` INTEGER · `tags JSONB` · `solved_count` · `workflow_status` (`DRAFT→IN_TESTING→APPROVED`) · `extra` (statement, editorial, sampleInput/Output, bounds, timeLimit, memoryLimit, tester_id, test_reports…)
Index: `idx_problems_contest (contest_id)`, `idx_problems_rating (base_points)`.

### 2.4. `testcases` — bộ test
`id` PK · `problem_id` NOT NULL · `order_index` · `stdin` · `expected_stdout` · `is_sample` · `is_pretest` · `extra`. Index: `idx_testcases_problem (problem_id, order_index)`.

### 2.5. `submissions` — bài nộp (bảng lớn nhất)
| Cột | Kiểu | Ghi chú |
| :-- | :-- | :-- |
| `id` | TEXT PK | |
| `user_id` / `contest_id` / `problem_id` | TEXT | tham chiếu logic; `contest_id NULL` = bài luyện tập |
| `language` | TEXT | `js \| python \| java \| cpp20` |
| `verdict` | TEXT | `AC \| WA \| TLE \| MLE \| RTE \| CE \| PENDING \| SKIP` |
| `points_awarded` | DOUBLE PRECISION | |
| `time_ms` / `elapsed_min` | INTEGER | |
| `submitted_at` | TIMESTAMPTZ | |
| `source_code` | TEXT | fallback KV; prod lưu S3 (object store `sources`) |
| `source_key` | TEXT | key S3 `submissions/<id>.txt` (Task 118) |
| `per_test` | JSONB | `[{index, verdict, time_ms}]` — mở sau FINISHED |
| `detail` | TEXT | thông điệp judge |
| `is_upsolve` | BOOLEAN | upsolve sau FINISHED, 0 điểm |
| `extra` | JSONB | trường mở rộng |

Index: `idx_sub_contest_user_problem (contest_id, user_id, problem_id, submitted_at DESC)` cho standings · `idx_sub_submitted_at DESC` cho live stream · `idx_sub_user` cho profile.

### 2.6. `participants` — đăng ký kỳ thi
`id` PK · `contest_id` NOT NULL · `user_id` NOT NULL · `registered_at` · `extra`. Index: `idx_part_contest_user (contest_id, user_id)`. (Tính duy nhất theo cặp do API kiểm tra — thêm UNIQUE constraint ở phase sau.)

### 2.7. `virtual_sessions` — thi ảo
`id` PK (`vs_…`) · `contest_id` · `user_id` · `start_time` · `duration_minutes` · `status` (`ACTIVE|FINISHED`) · `extra`. Index: `idx_vs_user`.

### 2.8. `clans` — di sản frozen
Tính năng Clan Wars đã xóa từ Phase 15; bảng tối giản (`id`, `name`, `tag`, `extra`) chỉ để dump/restore dữ liệu cũ. Không có tính năng mới ghi vào đây.

### 2.9. `clarifications` — hỏi đáp thi
`id` PK · `contest_id` NOT NULL · `problem_id` (nullable) · `asker_id` · `question` NOT NULL · `answer` · `answered_by` · `answered_at` · `extra`. Index: `idx_clar_contest (contest_id, created_at)`.

### 2.10. `announcements` — thông báo
`id` PK · `contest_id` NOT NULL · `message` NOT NULL · `created_by` · `extra`. Index: `idx_ann_contest (contest_id, created_at)`. Push real-time qua SSE `EVENT_ANNOUNCEMENT`.

## 3. QUAN HỆ (LOGICAL — KHÔNG FK Ở v2)

```
users 1─n contests (organizer_id)
users 1─n participants n─1 contests
contests 1─n problems 1─n testcases
users 1─n submissions n─1 problems, n─1 contests (NULL = practice)
users 1─n virtual_sessions n─1 contests
contests 1─n clarifications / announcements (users = asker/answerer/creator)
```

## 4. VẬN HÀNH

- **Migration v1→v2 (đã chạy trên prod 29/9/2026):** `POST /admin/migrate-schema` (ADMIN) hoặc `node scripts/migrate_kv_to_tables.mjs` — backup S3 trước, đối chiếu COUNT per-table, flip `schema_version=2`, reload không restart. Idempotent.
- **Dọn KV archive (đã chạy 29/9/2026):** `POST /admin/drop-legacy-kv` — guard: chỉ DROP khi schema v2; dữ liệu còn trong backup pre-migration trên S3.
- **Backup hằng ngày:** cron `db-backup` 02:00 UTC (09:00 VN) — `scripts/backup_cron.mjs` dump theo mode (v2: SELECT * từ 10 bảng) → JSON → bucket S3 `backups/db-<stamp>.json`.
- **Tạo bảng cho DB mới:** tự động lần đầu kết nối (`CREATE TABLE IF NOT EXISTS`) — không cần script tay.

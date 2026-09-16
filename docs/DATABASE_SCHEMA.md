# THIẾT KẾ CƠ SỞ DỮ LIỆU CHUẨN DOANH NGHIỆP (DATABASE ARCHITECTURE & ERD)
> **Hệ quản trị CSDL đề xuất:** PostgreSQL 16+ với các phần mở rộng `uuid-ossp`, `pg_trgm` (Full-Text Search) và `btree_gist`.

---

## 1. SƠ ĐỒ THỰC THỂ MỐI QUAN HỆ (DATABASE ERD)

```mermaid
erDiagram
    CLANS ||--o{ USERS : "belongs_to"
    USERS ||--o{ CONTEST_PARTICIPANTS : "registers"
    CONTESTS ||--o{ CONTEST_PARTICIPANTS : "has_members"
    CONTESTS ||--o{ PROBLEMS : "contains"
    PROBLEMS ||--o{ TESTCASES : "has"
    USERS ||--o{ SUBMISSIONS : "submits"
    PROBLEMS ||--o{ SUBMISSIONS : "target_of"
    SUBMISSIONS ||--o{ SUBMISSION_TEST_RESULTS : "evaluated_by"
    USERS ||--o{ HACK_EVENTS : "initiator_of"
    SUBMISSIONS ||--o{ HACK_EVENTS : "target_of"
    PROBLEMS ||--o{ DISCUSSIONS : "has_threads"
    USERS ||--o{ DISCUSSIONS : "creates"
    DISCUSSIONS ||--o{ DISCUSSION_COMMENTS : "contains"
    USERS ||--o{ DISCUSSION_COMMENTS : "authors"

    USERS {
        uuid id PK
        varchar username UK
        varchar email UK
        varchar password_hash
        varchar full_name
        uuid clan_id FK
        int rating
        int max_rating
        varchar rank_tier
        jsonb statistics
        timestamptz created_at
    }

    CLANS {
        uuid id PK
        varchar name UK
        varchar tag UK
        varchar clan_type "cohort_or_specialty"
        int total_rating
        uuid leader_id FK
    }

    CONTESTS {
        uuid id PK
        varchar title
        varchar slug UK
        varchar contest_format "CODEFORCES | ICPC | IOI"
        timestamptz start_time
        int duration_minutes
        int hack_duration_minutes
        varchar status "PENDING | CODING | HACK | SYSTEM_TEST | FINISHED"
        boolean is_rated
        int min_rating "Division constraint"
        int max_rating "Division constraint"
        jsonb settings
    }

    VIRTUAL_SESSIONS {
        varchar id PK
        uuid contest_id FK
        uuid user_id FK
        timestamptz start_time
        int duration_minutes
        varchar status "ACTIVE | FINISHED"
    }

    ANALYTICS {
        varchar id PK
        varchar event_type
        timestamptz timestamp
        jsonb metadata
    }

    PROBLEMS {
        uuid id PK
        uuid contest_id FK
        varchar code "A, B, C, D"
        varchar title
        text statement_markdown
        text editorial_markdown
        int time_limit_ms
        int memory_limit_kb
        int base_points
        varchar[] tags
        int solved_count
    }

    TESTCASES {
        uuid id PK
        uuid problem_id FK
        int order_index
        text stdin
        text expected_stdout
        boolean is_sample
        boolean is_pretest
        int subtask_id
    }

    SUBMISSIONS {
        uuid id PK
        uuid user_id FK
        uuid problem_id FK
        uuid contest_id FK
        varchar language "CPP20 | PYTHON3 | JAVA17 | JS"
        text source_code
        varchar verdict "AC | WA | TLE | MLE | RTE | CE | HACKED"
        int execution_time_ms
        int memory_used_kb
        int points_awarded
        boolean is_hacked
        timestamptz submitted_at
    }

    HACK_EVENTS {
        uuid id PK
        uuid contest_id FK
        uuid hacker_id FK
        uuid target_submission_id FK
        text input_payload
        boolean is_successful
        int points_delta
        timestamptz executed_at
    }

    DISCUSSIONS {
        uuid id PK
        uuid problem_id FK
        uuid author_id FK
        varchar title
        text content
        int upvotes
        timestamptz created_at
    }

    DISCUSSION_COMMENTS {
        uuid id PK
        uuid discussion_id FK
        uuid author_id FK
        text content
        int upvotes
        timestamptz created_at
    }
```

---

## 2. ĐẶC TẢ CHI TIẾT CÁC BẢNG & RÀNG BUỘC (DATA DICTIONARY)

### 2.1. Bảng `users` (Tài khoản & Hồ sơ Coder)
| Trường dữ liệu | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Khóa chính |
| `username` | `VARCHAR(50)` | `UNIQUE, NOT NULL` | Tên tài khoản hiển thị |
| `email` | `VARCHAR(255)` | `UNIQUE, NOT NULL` | Email sinh viên FPT (`@fpt.edu.vn`) |
| `clan_id` | `UUID` | `REFERENCES clans(id) ON DELETE SET NULL` | Khóa học hoặc ban chuyên môn |
| `rating` | `INTEGER` | `DEFAULT 1200, CHECK (rating >= 0)` | Điểm Elo hiện tại |
| `max_rating` | `INTEGER` | `DEFAULT 1200` | Điểm Elo cao nhất từng đạt |
| `rank_tier` | `VARCHAR(30)` | `DEFAULT 'Newbie'` | Tên cấp bậc (Pupil, Specialist,...) |

### 2.2. Bảng `contests` (Quản lý Kỳ thi)
* Hỗ trợ 3 thể thức qua cột `contest_format`:
  * `CODEFORCES`: Điểm giảm theo phút + 15p Hack Phase + System Test.
  * `ICPC`: Tính điểm theo số bài AC + Penalty time (thời gian AC + $20 \times W$).
  * `IOI`: Điểm thành phần theo từng Subtask (0-100).
* Cột `status`: `REGISTRATION` ➔ `CODING` ➔ `HACK_PHASE` ➔ `SYSTEM_TESTING` ➔ `FINISHED`.
* Cột `min_rating` & `max_rating`: Ràng buộc điều kiện tham gia phân hạng (Division Eligibility Gate - Div.1, Div.2, Div.3, Beginner Cup).

### 2.3. Bảng `submissions` & `hack_events`
* `submissions` lưu trữ mã nguồn, kết quả chấm, CPU time, Memory và cờ `is_hacked`.
* `hack_events` lưu lịch sử bẻ khóa: Input độc hại, kết quả hack (`is_successful`), điểm thưởng/phạt.

### 2.4. Bảng `virtual_sessions` (Phiên Thi Đấu Ảo)
| Trường dữ liệu | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(100)` | `PRIMARY KEY` | Khóa chính phiên thi ảo (`vs_<uuid>`) |
| `contest_id` | `VARCHAR(100)` | `NOT NULL, REFERENCES contests(id)` | Mã kỳ thi quá khứ được thi lại |
| `user_id` | `VARCHAR(100)` | `NOT NULL, REFERENCES users(id)` | Thí sinh tham gia thi ảo |
| `start_time` | `TIMESTAMPTZ` | `NOT NULL` | Thời điểm bắt đầu phiên thi ảo cá nhân |
| `duration_minutes` | `INTEGER` | `NOT NULL, DEFAULT 120` | Thời lượng làm bài (phút) |
| `status` | `VARCHAR(20)` | `DEFAULT 'ACTIVE'` | Trạng thái: `ACTIVE` hoặc `FINISHED` |

### 2.5. Bảng `analytics` (Giám Sát & Đo Lường Nền Tảng)
| Trường dữ liệu | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(100)` | `PRIMARY KEY` | Khóa chính sự kiện |
| `event_type` | `VARCHAR(50)` | `NOT NULL` | Loại sự kiện (`PAGE_VIEW`, `SUBMISSION`, `HACK_ATTEMPT`) |
| `timestamp` | `TIMESTAMPTZ` | `NOT NULL` | Thời điểm ghi nhận |
| `metadata` | `JSONB` | `DEFAULT '{}'` | Chi tiết payload telemetry |

---

## 3. CHIẾN LƯỢC CHỈ MỤC & TỐI ƯU HÓA TRUY VẤN (INDEXING STRATEGY)

```sql
-- Tối ưu hóa truy vấn Bảng xếp hạng Contest thời gian thực (Standings)
CREATE INDEX idx_submissions_contest_user ON submissions (contest_id, user_id, problem_id, submitted_at DESC);

-- Tối ưu hóa tìm kiếm bài toán theo Tags và Độ khó Elo
CREATE INDEX idx_problems_tags ON problems USING GIN (tags);
CREATE INDEX idx_problems_rating ON problems (base_points);

-- Tối ưu hóa truy vấn luồng nộp bài toàn hệ thống (Live Status Stream)
CREATE INDEX idx_submissions_live_stream ON submissions (submitted_at DESC) INCLUDE (verdict, execution_time_ms);

-- Tối ưu hóa truy vấn phòng Hack Room
CREATE INDEX idx_hack_events_contest_room ON hack_events (contest_id, executed_at DESC);
```

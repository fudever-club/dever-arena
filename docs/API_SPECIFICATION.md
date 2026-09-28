# ĐẶC TẢ GIAO DIỆN LẬP TRÌNH ỨNG DỤNG (API & REALTIME SPECIFICATION)
> **Kiến trúc:** RESTful API (JSON) + SSE realtime (Standings & Phase alerts). Triển khai thật tại `server/` (Node thuần, 0 dependency), chạy bằng `npm run server` (port 8787). **Vòng đời 3 phase chuẩn quốc tế theo ADR-005 — nhóm endpoint Hack đã gỡ.**
> **Xác thực:** JWT HS256 qua header `Authorization: Bearer <token>` (hết hạn 1h). SSE nhận token qua query `?token=`.

---

## 1. TỔNG QUAN CÁC NHÓM ENDPOINTS RESTFUL

### 1.1. Nhóm Xác Thực & Người Dùng (`/api/v1/auth`, `/api/v1/users`, `/api/v1/admin/users`)
* `POST /api/v1/auth/login`: Đăng nhập, trả về Access Token (1h). Tài khoản do admin cấp, không có đăng ký công khai.
* `GET /api/v1/users/{username}`: Lấy thông tin cá nhân, Elo Rating, `rating_history`.
* `GET /api/v1/users/{username}/profile`: **Profile aggregate** (auth) — `{ user, stats: {submissions, solved, acceptance_rate, avg_time_ms, contests_played, best_rank}, rating_history, heatmap: [{date, count}] × 182 ngày, verdicts: {AC/WA/TLE/RE/CE/MLE: n}, tags: [{tag, solved, attempted}] top 12, languages: [{language, count}], per_contest: [{contest_id, title, slug, status, contest_format, solved, submissions, total, registered, rank, entrants}], recent_submissions (20 mới nhất, không source_code) }`. Mọi số liệu aggregate từ DB thật; heatmap gồm cả bài nộp luyện tập (`contest_id = null`); rank per_contest lấy từ bảng standings thật.
* `GET /api/v1/admin/users` (ADMIN): Liệt kê toàn bộ tài khoản (không lộ password).
* `POST /api/v1/admin/users` (ADMIN): Cấp tài khoản cá nhân hoặc đội thi `{ username, password≥6, full_name, role, rating, team|null, members[] }`. Lỗi: `409 USERNAME_TAKEN`, `422 BAD_USERNAME/WEAK_PASSWORD`.

### 1.2. Nhóm Kỳ Thi (`/api/v1/contests`)
* `GET /api/v1/contests`: Lấy danh sách kỳ thi (Upcoming, Running, Past).
* `GET /api/v1/contests/{slug}`: Lấy chi tiết contest, danh sách bài toán, phase hiện tại.
* `POST /api/v1/contests/{slug}/register`: Đăng ký tham gia contest (Kiểm tra Division Eligibility Gate; trả về lỗi `403 RATING_INELIGIBLE` nếu vượt quá hoặc không đạt rating yêu cầu).
* `POST /api/v1/admin/contests` (ADMIN): Mở kỳ thi mới ở trạng thái REGISTRATION `{ title, slug?, contest_format (mặc định ICPC), start_time, duration_minutes, min_rating, max_rating }`. Lỗi: `422 BAD_TITLE/BAD_FORMAT/BAD_START_TIME`, `409 SLUG_TAKEN`.
* `GET /api/v1/contests/{slug}/standings`: Lấy bảng xếp hạng thời gian thực (hỗ trợ phân trang; mặc định `contest_format` của kỳ thi — ICPC trả solved/penalty; `?format=CODEFORCES` ép bảng điểm decay; `?frozen=1&freeze_minute=N` chỉ áp cho bảng CF, mặc định che 30 phút cuối).
* `POST /api/v1/contests/{slug}/virtual`: Khởi tạo phiên thi đấu ảo cá nhân cho contest đã kết thúc (`{ "session_id": "vs_...", "start_time": ... }`).
* `GET /api/v1/contests/{slug}/virtual?session_id={id}[&at_minute=N]`: Lấy trạng thái phiên ảo, số phút đã trôi qua và bảng xếp hạng đã lọc ghost submissions theo mốc thời gian ảo (`at_minute` để xem lại mốc giờ cũ).

### 1.3. Nhóm Bài Toán & Chấm Điểm (`/api/v1/problems`, `/api/v1/submissions`)
* `GET /api/v1/problems`: Lấy danh sách bài trong Kho bài tập (hỗ trợ filter `tag`, `min_rating`, `max_rating`, `search`).
* `POST /api/v1/admin/problems` (ADMIN): Tạo đề thi mới (validate 422, trùng mã 409).
* `PUT /api/v1/admin/problems/{id}` (ADMIN): Sửa đề thi, đồng bộ testcase mẫu.
* `DELETE /api/v1/admin/problems/{id}` (ADMIN): Xóa đề chưa có submission (đã có → 409).
* `GET /api/v1/problems/{id}`: Lấy chi tiết đề bài, giới hạn thời gian/bộ nhớ, testcase ví dụ.
* `GET /api/v1/problems/{id}/editorial`: Lấy lời giải chính thức (chỉ mở sau khi contest kết thúc).
* `POST /api/v1/submissions`: Nộp mã nguồn (chỉ trong Coding Phase, phải đã đăng ký). Chấm **full-suite ngay** — response `{ submission, verdict }` với verdict cuối cùng (không còn `pretests_passed`; ADR-005). Ngôn ngữ chấm thật: `javascript`, `python`, `java`, `cpp` (tự phát hiện toolchain; thiếu tool → `422 TOOLCHAIN_MISSING`, không bịa verdict).
* `GET /api/v1/submissions/{id}`: Kiểm tra kết quả chấm bài.
* `POST /api/v1/admin/phase` (ADMIN): Chuyển phase tuần tự 3 bước (`REGISTRATION → CODING → FINISHED`). Phase cũ (`HACK_PHASE`, `SYSTEM_TESTING`) trả `422 BAD_PHASE`. Sang `FINISHED` chốt Elo và mở editorial.
* `POST /api/v1/admin/rejudge` (ADMIN): Chấm lại một bài nộp, tính lại điểm.
  ```json
  {
    "contest_id": "contest_dever_round1",
    "problem_id": "p102",
    "language": "python",
    "source_code": "n=int(input())\n..."
  }
  ```

### 1.4. Nhóm Bẻ Khóa Hack (`/api/v1/hacks`) — ĐÃ GỠ
> Nhóm endpoint này đã bị loại bỏ theo ADR-005 (vòng đời thi đấu chuẩn quốc tế, không còn Hack Phase). Yêu cầu tới `/api/v1/hacks/execute` giờ trả `404 NOT_FOUND`.

### 1.5. Nhóm Quản Trị (`/api/v1/admin`)
* Xem mục 1.1 (cấp tài khoản), 1.3 (phase, rejudge).
* **Polygon stress:** `POST /api/v1/admin/stress` (ADMIN) `{language, model_source, brute_source, count≤30, seed, rules, checker, timeLimitMs}` → `{ran, passed, failed, mismatches[≤5], outputs[{stdin, expected_stdout, strategy}], modelMaxMs, suggestedTimeLimitS, verdict}`.
* **Testcases:** `POST /api/v1/admin/testcases` `{problem_id, stdin, expected_stdout, strategy}` → 201; `GET /api/v1/admin/testcases?problem_id=` (nội dung cắt 2000 ký tự); `DELETE /api/v1/admin/testcases/{id}` (cấm xóa test mẫu → 409). Mọi testcase đều thuộc full-suite chấm khi nộp.
* **Blind-tester workflow:** `POST /api/v1/admin/problems/{id}/submit-testing` `{tester_id}` (DRAFT→IN_TESTING, cấm tự giao); `POST /api/v1/admin/problems/{id}/review` `{decision: APPROVED|REJECTED, note}`; `GET /api/v1/testing/queue` (tester chỉ thấy bài giao cho mình, **ẩn editorial**); `POST /api/v1/testing/report` `{problem_id, solved, minutes_spent, feedback}`.

> Ghi chú: nhóm Clan Wars (`/api/v1/clans`) đã gỡ khỏi nền tảng. Tài khoản thi đấu là cá nhân hoặc đội (`team`, `members`), do admin cấp.

---

## 2. REALTIME BẰNG SSE (SERVER-SIDE EVENTS)

* **URL Kết nối:** `GET /api/v1/stream/contests/{contest_id}?token=<jwt>` — header `Accept: text/event-stream`.
* **Sự kiện:** `CONNECTED`, `EVENT_STANDINGS_UPDATE` (kèm toàn bộ `standings`), `EVENT_PHASE_CHANGED`, `EVENT_ANNOUNCEMENT`. (Event `EVENT_HACK_BROADCAST` đã gỡ theo ADR-005.)
* Frontend dùng `EventSource` qua `src/lib/apiClient.js` (`api.streamContest`), Vite proxy `/api` về backend ở dev.

#### Sự kiện cập nhật bảng điểm (`EVENT_STANDINGS_UPDATE`):
```json
{
  "event": "EVENT_STANDINGS_UPDATE",
  "payload": {
    "user_id": "usr-102",
    "problem_code": "B",
    "points": 872,
    "status": "ACCEPTED_PRETESTS",
    "total_score": 1360,
    "new_rank": 2
  }
}
```

#### Sự kiện thông báo jury (`EVENT_ANNOUNCEMENT`):
```json
{
  "event": "EVENT_ANNOUNCEMENT",
  "payload": {
    "announcement": {
      "id": "ann_1",
      "contest_id": "contest_dever_round1",
      "message": "Đề B đã cập nhật giới hạn N ≤ 2·10^5.",
      "created_at": "2026-09-27T10:00:00.000Z"
    }
  }
}
```
*Banner thí sinh hiện thông báo ngay khi jury phát (xem `AnnouncementBanner`).*

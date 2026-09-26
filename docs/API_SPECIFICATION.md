# ĐẶC TẢ GIAO DIỆN LẬP TRÌNH ỨNG DỤNG (API & REALTIME SPECIFICATION)
> **Kiến trúc:** RESTful API (JSON) + SSE realtime (Standings & Hack alerts). Triển khai thật tại `server/` (Node thuần, 0 dependency), chạy bằng `npm run server` (port 8787).
> **Xác thực:** JWT HS256 qua header `Authorization: Bearer <token>` (hết hạn 1h). SSE nhận token qua query `?token=`.

---

## 1. TỔNG QUAN CÁC NHÓM ENDPOINTS RESTFUL

### 1.1. Nhóm Xác Thực & Người Dùng (`/api/v1/auth`, `/api/v1/users`, `/api/v1/admin/users`)
* `POST /api/v1/auth/login`: Đăng nhập, trả về Access Token (1h). Tài khoản do admin cấp, không có đăng ký công khai.
* `GET /api/v1/users/{username}`: Lấy thông tin cá nhân, Elo Rating, `rating_history`.
* `GET /api/v1/admin/users` (ADMIN): Liệt kê toàn bộ tài khoản (không lộ password).
* `POST /api/v1/admin/users` (ADMIN): Cấp tài khoản cá nhân hoặc đội thi `{ username, password≥6, full_name, role, rating, team|null, members[] }`. Lỗi: `409 USERNAME_TAKEN`, `422 BAD_USERNAME/WEAK_PASSWORD`.

### 1.2. Nhóm Kỳ Thi (`/api/v1/contests`)
* `GET /api/v1/contests`: Lấy danh sách kỳ thi (Upcoming, Running, Past).
* `GET /api/v1/contests/{slug}`: Lấy chi tiết contest, danh sách bài toán, phase hiện tại.
* `POST /api/v1/contests/{slug}/register`: Đăng ký tham gia contest (Kiểm tra Division Eligibility Gate; trả về lỗi `403 RATING_INELIGIBLE` nếu vượt quá hoặc không đạt rating yêu cầu).
* `POST /api/v1/admin/contests` (ADMIN): Mở kỳ thi mới ở trạng thái REGISTRATION `{ title, slug?, contest_format, start_time, duration_minutes, hack_duration_minutes, min_rating, max_rating }`. Lỗi: `422 BAD_TITLE/BAD_FORMAT/BAD_START_TIME`, `409 SLUG_TAKEN`.
* `GET /api/v1/contests/{slug}/standings`: Lấy bảng xếp hạng thời gian thực (hỗ trợ phân trang, lọc theo Room; `?frozen=1&freeze_minute=N` che bài sau mốc — mặc định 30 phút cuối; `?format=ICPC` xếp theo số bài giải + penalty).
* `GET /api/v1/contests/{slug}/rooms/{roomId}`: Lấy danh sách thành viên và các bài nộp đã qua pretest trong Room (source code chỉ mở trong Hack Phase/Finished).
* `POST /api/v1/contests/{slug}/virtual`: Khởi tạo phiên thi đấu ảo cá nhân cho contest đã kết thúc (`{ "session_id": "vs_...", "start_time": ... }`).
* `GET /api/v1/contests/{slug}/virtual?session_id={id}[&at_minute=N]`: Lấy trạng thái phiên ảo, số phút đã trôi qua và bảng xếp hạng đã lọc ghost submissions theo mốc thời gian ảo (`at_minute` để xem lại mốc giờ cũ).

### 1.3. Nhóm Bài Toán & Chấm Điểm (`/api/v1/problems`, `/api/v1/submissions`)
* `GET /api/v1/problems`: Lấy danh sách bài trong Kho bài tập (hỗ trợ filter `tag`, `min_rating`, `max_rating`, `search`).
* `POST /api/v1/admin/problems` (ADMIN): Tạo đề thi mới (validate 422, trùng mã 409).
* `PUT /api/v1/admin/problems/{id}` (ADMIN): Sửa đề thi, đồng bộ testcase mẫu.
* `DELETE /api/v1/admin/problems/{id}` (ADMIN): Xóa đề chưa có submission (đã có → 409).
* `GET /api/v1/problems/{id}`: Lấy chi tiết đề bài, giới hạn thời gian/bộ nhớ, testcase ví dụ.
* `GET /api/v1/problems/{id}/editorial`: Lấy lời giải chính thức (chỉ mở sau khi contest kết thúc).
* `POST /api/v1/submissions`: Nộp mã nguồn (chỉ trong Coding Phase, phải đã đăng ký). Ngôn ngữ chấm thật: `javascript`, `python`, `java`, `cpp` (tự phát hiện toolchain; thiếu tool → `422 TOOLCHAIN_MISSING`, không bịa verdict).
* `GET /api/v1/submissions/{id}`: Kiểm tra kết quả chấm bài.
* `POST /api/v1/admin/phase` (ADMIN): Chuyển phase tuần tự (`REGISTRATION → CODING → HACK_PHASE → SYSTEM_TESTING → FINISHED`). Sang `SYSTEM_TESTING` tự chấm lại toàn bộ bài sống trên full suite; sang `FINISHED` chốt Elo và mở editorial.
* `POST /api/v1/admin/rejudge` (ADMIN): Chấm lại một bài nộp, tính lại điểm.
  ```json
  {
    "contest_id": "contest_dever_round1",
    "problem_id": "p102",
    "language": "python",
    "source_code": "n=int(input())\n..."
  }
  ```

### 1.4. Nhóm Bẻ Khóa Hack (`/api/v1/hacks`)
* `POST /api/v1/hacks/execute`: Thực hiện hack bài nộp đối thủ:
  ```json
  {
    "contest_id": "c660cbdb-56b4-42c4-81b0-1caf29bfddef",
    "target_submission_id": "sub-9081",
    "test_payload": "200000\n1000000 1000000 ..."
  }
  ```
  * *Phản hồi tức thì:* `{ "success": true, "verdict": "SUCCESSFUL_HACK", "points_delta": 100 }` hoặc `{ "success": false, "verdict": "UNSUCCESSFUL_HACK", "points_delta": -50 }`. Máy chủ chạy code victim và oracle trên cùng payload để phân thắng thua (không heuristic).

### 1.5. Nhóm Quản Trị (`/api/v1/admin`)
* Xem mục 1.1 (cấp tài khoản), 1.3 (phase, rejudge).
* **Polygon stress:** `POST /api/v1/admin/stress` (ADMIN) `{language, model_source, brute_source, count≤30, seed, rules, checker, timeLimitMs}` → `{ran, passed, failed, mismatches[≤5], outputs[{stdin, expected_stdout, strategy}], modelMaxMs, suggestedTimeLimitS, verdict}`.
* **Testcases:** `POST /api/v1/admin/testcases` `{problem_id, stdin, expected_stdout, is_pretest}` → 201; `GET /api/v1/admin/testcases?problem_id=` (nội dung cắt 2000 ký tự); `DELETE /api/v1/admin/testcases/{id}` (cấm xóa test mẫu → 409).
* **Blind-tester workflow:** `POST /api/v1/admin/problems/{id}/submit-testing` `{tester_id}` (DRAFT→IN_TESTING, cấm tự giao); `POST /api/v1/admin/problems/{id}/review` `{decision: APPROVED|REJECTED, note}`; `GET /api/v1/testing/queue` (tester chỉ thấy bài giao cho mình, **ẩn editorial**); `POST /api/v1/testing/report` `{problem_id, solved, minutes_spent, feedback}`.

> Ghi chú: nhóm Clan Wars (`/api/v1/clans`) đã gỡ khỏi nền tảng. Tài khoản thi đấu là cá nhân hoặc đội (`team`, `members`), do admin cấp.

---

## 2. REALTIME BẰNG SSE (SERVER-SIDE EVENTS)

* **URL Kết nối:** `GET /api/v1/stream/contests/{contest_id}?token=<jwt>` — header `Accept: text/event-stream`.
* **Sự kiện:** `CONNECTED`, `EVENT_STANDINGS_UPDATE` (kèm toàn bộ `standings`), `EVENT_HACK_BROADCAST`, `EVENT_PHASE_CHANGED`.
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

#### Sự kiện Hack thành công trong Room (`EVENT_HACK_BROADCAST`):
```json
{
  "event": "EVENT_HACK_BROADCAST",
  "payload": {
    "hacker_name": "dever_hero",
    "victim_name": "rookie_fresher_k21",
    "problem_code": "B",
    "verdict": "SUCCESSFUL_HACK",
    "room_id": "Room #1"
  }
}
```
*Giao diện nhận event này sẽ kích hoạt ngay hiệu ứng âm thanh Fanfare và gạch bỏ điểm bài B của nạn nhân trên bảng điểm.*

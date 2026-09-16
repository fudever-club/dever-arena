# ĐẶC TẢ GIAO DIỆN LẬP TRÌNH ỨNG DỤNG (API & WEBSOCKET SPECIFICATION)
> **Kiến trúc:** RESTful API (JSON) + WebSocket Server (Realtime Standings & Instant Hack Alerts).  
> **Xác thực:** JWT (JSON Web Token) qua header `Authorization: Bearer <token>`.

---

## 1. TỔNG QUAN CÁC NHÓM ENDPOINTS RESTFUL

### 1.1. Nhóm Xác Thực & Người Dùng (`/api/v1/auth`, `/api/v1/users`)
* `POST /api/v1/auth/login`: Đăng nhập, trả về Access Token (1h) và Refresh Token (30 ngày).
* `GET /api/v1/users/{username}`: Lấy thông tin cá nhân, Elo Rating, lịch sử thi đấu và thống kê theo Tag.
* `GET /api/v1/users/{username}/rating-history`: Lấy danh sách biến động Rating theo thời gian để vẽ biểu đồ SVG.

### 1.2. Nhóm Kỳ Thi (`/api/v1/contests`)
* `GET /api/v1/contests`: Lấy danh sách kỳ thi (Upcoming, Running, Past).
* `GET /api/v1/contests/{slug}`: Lấy chi tiết contest, danh sách bài toán, phase hiện tại.
* `POST /api/v1/contests/{slug}/register`: Đăng ký tham gia contest (Kiểm tra Division Eligibility Gate; trả về lỗi `403 RATING_INELIGIBLE` nếu vượt quá hoặc không đạt rating yêu cầu).
* `GET /api/v1/contests/{slug}/standings`: Lấy bảng xếp hạng thời gian thực (hỗ trợ phân trang, lọc theo Room, lọc theo Clan).
* `GET /api/v1/contests/{slug}/rooms/{roomId}`: Lấy danh sách thành viên và các bài nộp đã pass Pretest trong Room (chỉ mở trong Hack Phase).
* `POST /api/v1/contests/{slug}/virtual`: Khởi tạo phiên thi đấu ảo cá nhân cho contest đã kết thúc (`{ "session_id": "vs_...", "start_time": ... }`).
* `GET /api/v1/contests/{slug}/virtual?session_id={id}`: Lấy trạng thái phiên ảo, số phút đã trôi qua và bảng xếp hạng đã lọc ghost submissions theo mốc thời gian ảo.

### 1.3. Nhóm Bài Toán & Chấm Điểm (`/api/v1/problems`, `/api/v1/submissions`)
* `GET /api/v1/problems`: Lấy danh sách bài trong Kho bài tập (hỗ trợ filter `tag`, `min_rating`, `max_rating`, `search`).
* `GET /api/v1/problems/{id}`: Lấy chi tiết đề bài, giới hạn thời gian/bộ nhớ, testcase ví dụ.
* `GET /api/v1/problems/{id}/editorial`: Lấy lời giải chính thức (chỉ mở sau khi contest kết thúc).
* `POST /api/v1/submissions`: Nộp mã nguồn giải bài:
  ```json
  {
    "contest_id": "c660cbdb-56b4-42c4-81b0-1caf29bfddef",
    "problem_id": "p102",
    "language": "cpp20",
    "source_code": "#include <iostream>..."
  }
  ```
* `GET /api/v1/submissions/{id}`: Kiểm tra kết quả chấm bài (polling nếu không dùng WebSocket).

### 1.4. Nhóm Bẻ Khóa Hack (`/api/v1/hacks`)
* `POST /api/v1/hacks/execute`: Thực hiện hack bài nộp đối thủ:
  ```json
  {
    "contest_id": "c660cbdb-56b4-42c4-81b0-1caf29bfddef",
    "target_submission_id": "sub-9081",
    "test_payload": "200000\n1000000 1000000 ..."
  }
  ```
  * *Phản hồi tức thì:* `{ "success": true, "verdict": "SUCCESSFUL_HACK", "points_earned": 100 }` hoặc `{ "success": false, "verdict": "UNSUCCESSFUL_HACK", "penalty": -50 }`.

### 1.5. Nhóm Bang Hội & Clan Wars (`/api/v1/clans`)
* `GET /api/v1/clans`: Lấy danh sách toàn bộ các Clan trong hệ thống.
* `GET /api/v1/clans/standings`: Lấy bảng xếp hạng Clan Wars tính toán theo công thức Top-5 Harmonic Sum $S = \sum_{i=1}^5 \frac{R_i}{\sqrt{i}}$ kèm danh sách tuyển thủ chủ lực.

---

## 2. GIAO THỨC WEBSOCKET THỜI GIAN THỰC (REALTIME CHANNELS)

* **URL Kết nối:** `wss://arena.fu-dever.com/ws/v1/contests/{contest_id}`

### 2.1. Client Đăng Ký Lắng Nghe Kênh (Subscription)
```json
{
  "action": "subscribe",
  "channels": ["standings", "room_hack_feed", "my_submissions"]
}
```

### 2.2. Các Sự Kiện Hệ Thống Phát Xuống (Server Events)

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

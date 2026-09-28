# ADR-005: Đơn giản hóa vòng đời thi đấu chuẩn quốc tế (bỏ Hack Phase & Pretest/System-Testing)

- **Trạng thái:** Accepted
- **Ngày:** 2026-09-27
- **Supersedes:** các phần mô tả Hack Phase/Room 25/System Testing trong `ADR-001` (kiến trúc legacy) và mọi quy tắc hack trong rulebook; bổ sung phạm vi cho `ADR-003` (core thuần giữ nguyên).

## Bối cảnh

DEVER Arena ban đầu tái hiện trung thực mô hình Codeforces: Hack Phase (+100/−50), phòng thi 25 người, Pretest → System Testing. Khi đối chiếu với định hướng thực tế — nền tảng thi đấu **nội bộ CLB** theo chuẩn thi đấu quốc tế (ICPC, AtCoder, CSES, DMOJ) — các cơ chế này không còn phù hợp:

- **Hack Phase** là cơ chế riêng của Codeforces; ICPC/AtCoder không có. Chi phí duy trì (oracle, room, UI, tests) lớn hơn giá trị sư phạm.
- **Pretest → System Testing** chỉ tồn tại để bảo vệ máy chấm trước hàng chục nghìn bài nộp đồng loạt; quy mô CLB không cần — chấm full-suite ngay và trả verdict cuối cùng chuẩn xác hơn cho thí sinh.
- **Phân phòng 25 người** chỉ phục vụ hack.
- **Điểm suy giảm theo phút** chỉ đúng trong round chuẩn Codeforces; hạ thành lựa chọn, không phải mặc định.

## Quyết định

1. **Vòng đời 3 phase:** `REGISTRATION → CODING → FINISHED`. Freeze bảng điểm là cửa sổ 30 phút cuối của CODING (xử lý bởi `contestResults.js`), không phải phase riêng.
2. **Chấm full-suite:** mọi bài nộp được chấm trên toàn bộ testcase ngay khi nộp; response trả `verdict` cuối cùng. Bỏ khái niệm pretest, bỏ verdict `FST` (Failed System Test). Rejudge dùng đúng một code path.
3. **Gỡ Hack toàn stack:** xóa route `/api/v1/hacks/execute`, `server/oracles.js`, store `hacks`/`hack_events` (IndexedDB v5 tự xóa store cũ), `HackRoomPage`, route `/hack-room`, `calculateHackScore`, SSE event `EVENT_HACK_BROADCAST`, panel Rooms phía admin.
4. **ICPC là thể thức mặc định** khi tạo kỳ thi và khi render standings (solved + penalty 20′). Thể thức Codeforces (điểm decay) giữ làm lựa chọn `?format=CODEFORCES`; freeze chỉ áp cho bảng CF.
5. **Hướng phát triển sâu** (Phase 31+): scheduler tự động theo giờ thật, judge sâu (compile error chi tiết, feedback per-test sau FINISHED), kho bài luyện tập + upsolving.

## Hệ quả

- Standings mặc định là bảng ICPC; UI thí sinh hiển thị verdict cuối ("Accepted") thay vì "Qua pretest".
- `ContestManager` không còn `startHackPhase`/`startSystemTesting`/`distributeRooms`/`canPerformHack`.
- `PHASE_ORDER` server = `['REGISTRATION', 'CODING', 'FINISHED']`; phase cũ gửi lên trả `422 BAD_PHASE`.
- Anti-cheat AST (ADR-004) giữ nguyên — đối soát mã nguồn vẫn là công cụ BTC, không liên quan Hack Phase.
- Số kiểm thử chuẩn mới: **152 tests / 24 suites** (giảm do gỡ các test hack/room; tăng chất lượng bằng test vòng đời 3 phase).

## Tuân thủ

- `tests/contest.test.js` khóa enum 3 phase; `tests/platform_quality.test.js` chặn route `/hack-room` quay lại; `tests/server_api.test.js` khóa `BAD_PHASE` cho phase cũ.
- Mọi thay đổi luật contest sau này phải cập nhật `docs/CONTEST_RULEBOOK.md` cùng PR.

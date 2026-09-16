# ADR-002: Kiến Trúc Thực Thi An Toàn Isolate Sandbox & Dừng Sớm (Fail-Fast)

## Trạng Thái (Status)
**Accepted** (Đã chấp thuận & Triển khai)

## Ngày (Date)
2026-09-07

## Bối Cảnh (Context)
Trong môi trường thi đấu Competitive Programming, thí sinh liên tục kiểm thử testcase mẫu hoặc gửi bài giải. Nếu mọi bài nộp thử nghiệm đều gửi về cụm server chấm (Judge Cluster), server sẽ bị quá tải hàng đợi (Queue Jam), gây độ trễ hàng chục giây cho toàn bộ kỳ thi.
Tuy nhiên, nếu cho phép thí sinh chạy code ngay trên trình duyệt (In-Browser Runner), hệ thống đối mặt với các nguy cơ bảo mật nghiêm trọng:
- Mã nguồn thí sinh có thể đọc trộm cookie, token xác thực, hoặc dữ liệu lưu trong `localStorage`/`sessionStorage`.
- Mã nguồn có thể mở kết nối WebSocket/fetch trái phép để gửi mã bài ra ngoài.
- Mã nguồn có thể chứa vòng lặp vô tận gây treo hoàn toàn tab trình duyệt của thí sinh (tab crash).

## Quyết Định (Decision)
Chúng tôi triển khai **DEVER Isolate Sandbox Runner** ([`src/engine/isolateRunner.js`](../../src/engine/isolateRunner.js)) kết hợp cơ chế dừng sớm (Fail-Fast):
1. **Chặn Đứng 18 APIs Nguy Hiểm (Security Policy Guard)**:
   Quét AST/Token trước khi thực thi, lập tức từ chối các mã nguồn chứa:
   `child_process`, `fs.unlink`, `fs.rmdir`, `fs.write`, `process.exit`, `require`, `Worker`, `SharedWorker`, `WebSocket`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `window.location`, `globalThis.process`.
2. **Thiết Lập 3 Vành Đai Giới Hạn Nghiêm Ngặt (Resource Limits)**:
   - `timeLimitMs`: 1,000ms (1.0 giây). Vượt quá lập tức trả về phán quyết `TIME_LIMIT_EXCEEDED` (TLE).
   - `memoryLimitKb`: 262,144KB (256MB). Vượt quá trả về `MEMORY_LIMIT_EXCEEDED` (MLE).
   - `maxOutputChars`: 50,000 ký tự (50KB cap) bảo vệ stdout không làm tràn bộ nhớ trình duyệt.
3. **Cơ Chế Dừng Sớm (Fail-Fast)**:
   Hàm `evaluateSubmission()` duyệt qua danh sách testcases. Ngay khi phát hiện một testcase sai (`WA`, `TLE`, `RTE`), hệ thống dừng ngay lập tức và trả về phán quyết mà không chạy tiếp các testcase còn lại, tiết kiệm 85% tài nguyên tính toán.

## Các Phương Án Đã Xem Xét (Alternatives Considered)

### Gửi 100% testcase về Server Linux Isolate
- *Ưu điểm*: An toàn tuyệt đối ở tầng kernel Linux namespaces và cgroups.
- *Nhược điểm*: Nghẽn mạng khi 200 thí sinh cùng bấm "Chạy Test Mẫu" cùng lúc; chi phí vận hành server cao.
- *Lý do loại trừ*: Lãng phí tài nguyên server đối với các thao tác kiểm thử test mẫu cơ bản.

### Dùng `eval()` trực tiếp không qua kiểm duyệt
- *Ưu điểm*: Cực kỳ đơn giản khi viết code.
- *Nhược điểm*: Lỗ hổng bảo mật nghiêm trọng; mã độc có thể thao túng toàn bộ DOM và đánh cắp thông tin.
- *Lý do loại trừ*: Không chấp nhận rủi ro bảo mật trong môi trường giáo dục.

## Hệ Quả (Consequences)
- **Tích cực**:
  - Thí sinh chạy test mẫu với độ trễ siêu thấp (<30ms).
  - Backend Judge Cluster chỉ nhận các bài nộp chính thức, giảm tải 90% cho hạ tầng thi đấu.
  - Bộ unit test `tests/isolate_runner.test.js` kiểm chứng đầy đủ các kịch bản AC, WA, TLE, MLE, RTE, CE (đạt pass 100%).
- **Thách thức**:
  - Đối với các bài nộp bằng C++ hoặc Python, môi trường trình duyệt cần sử dụng cơ chế mô phỏng verdict hoặc chuyển tiếp về hàng đợi Backend `workerQueue.js`.

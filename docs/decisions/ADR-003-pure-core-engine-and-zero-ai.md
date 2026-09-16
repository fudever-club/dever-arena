# ADR-003: Kiến Trúc Core Engine Hàm Thuần (Pure Functions) & Cam Kết Không Tích Hợp AI Trong Web Client

## Trạng Thái (Status)
**Accepted** (Đã chấp thuận & Triển khai)

## Ngày (Date)
2026-09-07

## Bối Cảnh (Context)
Các hệ thống thi đấu lập trình thuật toán (Competitive Programming) thường gặp lỗi phân định điểm số, bất đồng bộ bảng xếp hạng hoặc crash hệ thống khi giao diện (DOM) bị gắn chặt với logic nghiệp vụ.
Đồng thời, trong quá trình phát triển, có thử nghiệm tích hợp AI Gateway (9Router) làm trợ lý lập trình. Tuy nhiên, người dùng đã chỉ đạo rõ ràng: **Trong trang web không cần tích hợp tính năng AI, hãy hoàn nguyên mã nguồn (revert code)** để đảm bảo tính công bằng và bảo mật tuyệt đối cho kỳ thi sinh viên.

## Quyết Định (Decision)
1. **Kiến Trúc Hàm Thuần (Pure Functions Architecture)**:
   Toàn bộ logic tính toán cốt lõi trong thư mục `src/core/` ([`scoring.js`](../../src/core/scoring.js), [`rating.js`](../../src/core/rating.js), [`contestStateMachine.js`](../../src/core/contestStateMachine.js), [`virtualContest.js`](../../src/core/virtualContest.js), [`clanRating.js`](../../src/core/clanRating.js), [`scoreboardFreeze.js`](../../src/core/scoreboardFreeze.js)) được thiết kế theo chuẩn:
   - **Zero DOM Dependency**: Không tham chiếu tới `window`, `document`, `HTMLElement`.
   - **Deterministic Output**: Cùng dữ liệu đầu vào luôn sinh ra kết quả đầu ra giống nhau 100%.
   - **Độc lập nền tảng**: Có thể import và chạy trực tiếp cả trong môi trường Node.js (test runner, CLI) lẫn trình duyệt web (ES Modules).
2. **Loại Bỏ Hoàn Toàn Tính Năng AI Trong Web Client (Zero-AI Constraint)**:
   - Loại bỏ triệt để các module AI chat, AI code hints, API router ra khỏi ứng dụng web.
   - Tập trung 100% vào năng lực tự tư duy giải thuật của thí sinh, liêm chính học thuật và trải nghiệm thi đấu thể thao điện tử (eSports).

## Các Phương Án Đã Xem Xét (Alternatives Considered)

### Giữ AI Coach làm gợi ý giải thuật (Algorithmic Hint Generator)
- *Ưu điểm*: Hỗ trợ người học khi gặp bế tắc trong quá trình luyện tập.
- *Nhược điểm*: Vi phạm thể lệ thi đấu Olympic & ICPC; tiềm ẩn rủi ro lộ testcase hoặc gian lận; tăng bề mặt tấn công prompt injection; trái với chỉ thị của người dùng.
- *Lý do loại trừ*: Người dùng yêu cầu dứt khoát loại bỏ tính năng AI.

### Gắn logic tính điểm trực tiếp vào Event Listener của giao diện DOM
- *Ưu điểm*: Code nhanh trong giai đoạn đầu.
- *Nhược điểm*: Không thể viết unit test độc lập; dễ phát sinh race condition khi cập nhật bảng điểm thời gian thực.
- *Lý do loại trừ*: Vi phạm nguyên lý thiết kế phần mềm bền vững.

## Hệ Quả (Consequences)
- **Tích cực**:
  - Tỷ lệ kiểm thử tự động đạt mức hoàn hảo: **98/98 unit tests PASS 100%** trong thời gian chỉ ~140ms.
  - Loại bỏ hoàn toàn bề mặt tấn công liên quan đến LLM (OWASP Top 10 for LLM: prompt injection, insecure output handling, data leakage).
  - Tốc độ tải và độ mượt của giao diện tăng đáng kể vì không phải tải SDK AI hay duy trì streaming chat.
- **Thách thức**:
  - Đòi hỏi đội ngũ Problemsetter phải biên soạn Editorial thuật toán thủ công chất lượng cao cho từng bài tập (đã hoàn thiện chuẩn Polygon trong `src/data/problems.js`).

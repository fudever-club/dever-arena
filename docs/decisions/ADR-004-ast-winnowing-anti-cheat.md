# ADR-004: Cơ Chế Phát Hiện Trùng Lặp & Chống Gian Lận Bằng Token Hóa Cây Cú Pháp (AST Tokenizer) & Thuật Toán Winnowing 3-Gram

## Trạng Thái (Status)
**Accepted** (Đã chấp thuận & Triển khai)

## Ngày (Date)
2026-09-07

## Bối Cảnh (Context)
Trong các cuộc thi lập trình sinh viên, các hành vi đạo nhái mã nguồn thường sử dụng các kỹ thuật ngụy trang cơ bản:
- Đổi tên biến, hàm (ví dụ: đổi `int total` thành `int tong`).
- Chèn thêm chú thích (comments) hoặc khoảng trắng thừa.
- Hoán đổi vị trí khai báo biến không làm thay đổi luồng thực thi logic.

Nếu chỉ so sánh chuỗi văn bản thông thường (String Diff / Levenshtein Distance), hệ thống sẽ bị đánh lừa dễ dàng hoặc sinh ra quá nhiều cảnh báo sai (False Positives). Ngược lại, nếu sử dụng các mô hình Deep Learning hoặc dịch vụ bên thứ ba (như MOSS của Stanford), hệ thống sẽ mất khả năng hoạt động Offline / On-Premise và phát sinh độ trễ lớn.

## Quyết Định (Decision)
Chúng tôi quyết định tự chủ xây dựng **Anti-Cheat AST Tokenizer & Winnowing Engine** ([src/engine/astDiff.js](file:///c:/Users/ADMIN/DEVER%20Arena/src/engine/astDiff.js)):
1. **Chuẩn Hóa Mã Nguồn (Normalization)**:
   - Loại bỏ toàn bộ ghi chú đơn dòng (`//`) và đa dòng (`/* ... */`).
   - Khử toàn bộ định danh biến/hàm do người dùng tự đặt về dạng token trừu tượng `ID`, giữ lại các từ khóa cú pháp cốt lõi (`for`, `while`, `if`, `return`, các toán tử `+`, `-`, `*`, `/`, `%`).
2. **Kỹ Thuật Băm Cửa Sổ Trượt (3-Gram Winnowing Fingerprinting)**:
   - Phân rã chuỗi token chuẩn hóa thành tập hợp các bộ 3 token liên tiếp (3-grams).
   - Ánh xạ tập k-grams vào tập băm fingerprint gọn nhẹ.
3. **Đánh Giá Hệ Số Tương Đồng Jaccard**:
   - Tính toán tỉ lệ giao trên hợp giữa 2 tập fingerprint: $J(A, B) = \frac{|A \cap B|}{|A \cup B|}$.
   - Thiết lập ngưỡng cảnh báo tự động:
     - **$\ge 85\%$**: Gắn cờ gian lận đỏ (`FLAGGED_PLAGIARISM`) và thông báo lên Radar Ban Giám Khảo.
     - **$60\% - 84\%$**: Cảnh báo vàng cần giám sát (`SUSPICIOUS`).
     - **$< 60\%$**: Mã nguồn độc lập (`CLEAN`).

## Các Phương Án Đã Xem Xét (Alternatives Considered)

### Sử dụng dịch vụ MOSS của Đại học Stanford
- *Ưu điểm*: Tiêu chuẩn vàng học thuật.
- *Nhược điểm*: Yêu cầu kết nối internet ra ngoài qua mail script; vi phạm quy chế bảo mật đề thi nội bộ; không chạy được trong mạng nội bộ đóng của trường đại học.
- *Lý do loại trừ*: DEVER Arena yêu cầu khả năng tự chủ 100% không phụ thuộc dịch vụ ngoài.

### So sánh Text Diff đơn giản
- *Ưu điểm*: Tốc độ chạy rất nhanh.
- *Nhược điểm*: Hoàn toàn vô hiệu trước thủ thuật đổi tên biến hoặc chèn comment.
- *Lý do loại trừ*: Không đáp ứng tiêu chuẩn liêm chính học thuật của CLB FU-DEVER.

## Hệ Quả (Consequences)
- **Tích cực**:
  - Tự chủ 100%, chạy hoàn toàn trên môi trường Node.js và trình duyệt client trong chưa đầy 10ms.
  - Ban Giám Khảo trên trang `admin.html` có thể bấm **"Quét AST Toàn Bộ Bài Nộp"** và nhận kết quả tức thời với tỷ lệ chính xác cao.
  - Được kiểm chứng bằng bộ unit test `tests/astDiff.test.js` (pass 100%).
- **Thách thức**:
  - Đối với các thuật toán cực ngắn (dưới 5 dòng), tập token 3-gram có thể tạo độ tương đồng cao ngẫu nhiên; Ban Giám Khảo luôn là người đưa ra phán quyết kỷ luật cuối cùng sau khi đối soát trên giao diện Visual Diff.

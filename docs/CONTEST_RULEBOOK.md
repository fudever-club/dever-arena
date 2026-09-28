# QUY CHẾ THI ĐẤU GIẢI THUẬT DEVER-FORCES
> **Ban hành bởi Ban Chuyên Môn & Kỹ Thuật CLB Lập Trình FU-DEVER**  
> **Áp dụng cho toàn bộ các kỳ thi xếp hạng (Rated Rounds) và tuyển quân nội bộ.**
> **Phiên bản 2 (2026-09-27): Cập nhật theo ADR-005 — vòng đời thi đấu chuẩn quốc tế, gỡ Hack Phase & Pretest/System Testing.**

---

## ĐIỀU 1: ĐỐI TƯỢNG & PHÂN HẠNG THI ĐẤU (DIVISIONS)

DEVER-Forces tổ chức các kỳ thi theo hệ thống phân cấp độ khó nhằm tối ưu tính sư phạm và cọ xát công bằng:

1. **Division 4 (Fresher & Rookie):**
   * Đối tượng: Thí sinh có Rating $< 1400$ (Newbie, Pupil) hoặc tân sinh viên K19/K20 mới tiếp cận giải thuật.
   * Cấu trúc đề: 5–6 bài tập trung vào tư duy thuật toán cơ bản, kỹ năng cài đặt (Implementation), cấu trúc dữ liệu nền tảng (Array, String, Map/Set, Sorting, Binary Search, Two Pointers).

2. **Division 3 (Standard Club Round):**
   * Đối tượng: Thí sinh có Rating $< 1600$.
   * Cấu trúc đề: Bài A, B (dễ); Bài C, D (tư duy tham lam, quy hoạch động cơ bản, BFS/DFS đồ thị); Bài E, F (Dijkstra, Segment Tree cơ bản, Math/Number Theory).

3. **Division 2 (Advanced / ICPC Qualifier):**
   * Đối tượng: Thí sinh có Rating từ $1400$ đến $2199$.
   * Cấu trúc đề: Tiệm cận đề thi vòng Quốc gia và ICPC Regional. Đòi hỏi cấu trúc dữ liệu nâng cao, hình học tính toán, quy hoạch động trên cây, luồng cực đại.

4. **Division 1 (Overlords):**
   * Đối tượng: Thí sinh có Rating $\ge 1900$. Sân chơi dành cho các ứng viên đội tuyển ICPC World Finals và Grandmasters.

---

## ĐIỀU 2: THỜI GIAN & QUY TRÌNH DIỄN RA KỲ THI

Một kỳ thi chuẩn kéo dài **2 giờ**, theo vòng đời 3 phase nghiêm ngặt `REGISTRATION → CODING → FINISHED` (ADR-005):

### 2.1. Giai đoạn Đăng ký (REGISTRATION)
* Tài khoản thi đấu do BTC cấp trước giờ thi; đăng ký qua nền tảng. Kiểm tra điều kiện phân hạng Div theo Elo.
* Không chấp nhận đăng ký sau khi contest bắt đầu.

### 2.2. Giai đoạn Làm bài (CODING - 120 phút)
* Thí sinh làm việc độc lập. Các bài toán được mở đồng thời từ khi đồng hồ đếm ngược về $00:00:00$.
* **Chấm full-suite:** mỗi lần nộp bài được chấm trên **toàn bộ testcase** của đề; verdict trả về là **kết quả cuối cùng** (AC/WA/TLE/MLE/RE/CE) — không có pretest, không có System Testing, không có verdict tạm thời.
* **Scoreboard Freeze (chuẩn ICPC):** trong 30 phút cuối, bảng điểm đóng băng — các bài nộp mới chỉ hiển thị dấu hỏi `?` kèm số lần nộp, giữ kịch tính đến khi chốt.
* **Quyền riêng tư:** Trong suốt Coding Phase, thí sinh **tuyệt đối không được xem** mã nguồn của người khác.

### 2.3. Giai đoạn Chốt & Upsolving (FINISHED)
* Hết giờ: chốt bảng xếp hạng chung cuộc; kỳ thi Rated tự cập nhật Elo.
* Mở editorial và toàn bộ mã nguồn đã nộp để thí sinh học hỏi lẫn nhau (upsolving).

### 2.4. Hỏi đáp Jury (Clarifications — chuẩn ICPC)
* Trong giờ thi, thí sinh gửi câu hỏi cho ban giám khảo ngay trong đấu trường.
* Câu trả lời của jury được công bố công khai cho toàn bộ thí sinh; câu hỏi riêng tư chỉ người hỏi và jury thấy.

> **Ghi chú phiên bản 2:** Hack Phase (+100/−50), Hack Room 25 người, Pretest và System Testing đã được loại bỏ toàn bộ khỏi quy chế, máy chủ và giao diện theo ADR-005.

---

## ĐIỀU 3: CƠ CHẾ TÍNH ĐIỂM & XẾP HẠNG

### 3.1. Thể thức mặc định: ICPC
* Xếp hạng theo **số bài giải được (solved)**, secondary là **penalty**.
* Penalty = $\sum (\text{Phút AC} + 20 \times W)$ — chỉ tính trên bài **đã AC**; bài không AC không bị cộng penalty.
* Freeze 30 phút cuối như Điều 2.2.

### 3.2. Thể thức tùy chọn: Codeforces (Dynamic Score Decay)
Điểm của mỗi bài giảm dần theo từng phút trôi qua kể từ đầu contest:

$$\text{Points} = \max\left( \lfloor 0.3 \times P_{\max} \rfloor, \; P_{\max} - \lfloor \frac{P_{\max} \times t}{250} \rfloor - 50 \times W \right)$$

* $P_{\max}$: Điểm gốc của bài (500, 1000, 1500, 2000,...).
* $t$: Phút nộp bài thành công (0 đến 120).
* $W$: Số lần nộp sai trước khi Accepted.
* Sàn điểm: Thí sinh luôn nhận được tối thiểu $30\%$ điểm gốc nếu bài giải đúng.
* Freeze chỉ áp dụng cho bảng hiển thị này khi bật `?frozen=1`.

### 3.3. Tiêu chí Xếp hạng (thể thức Codeforces)
1. Tổng điểm cao hơn xếp trên (Tổng điểm = tổng điểm các bài AC).
2. Nếu bằng điểm: Thí sinh có thời điểm nộp bài cuối cùng sớm hơn sẽ xếp trên.

---

## ĐIỀU 4: ĐIỀU KHOẢN THI HÀNH
Mọi thí sinh đăng ký tham gia contest trên nền tảng DEVER-Forces mặc nhiên đồng ý tuân thủ toàn bộ quy định trong Quy chế này và [Chính Sách Chống Gian Lận (ANTI_CHEAT_POLICY.md)](./ANTI_CHEAT_POLICY.md).

> Cập nhật: DB schema và API contract tại db/schema.sql và src/db/api.js (2026-09-07). Vòng đời 3 phase + chấm full-suite theo ADR-005 (2026-09-27).

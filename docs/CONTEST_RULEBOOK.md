# QUY CHẾ THI ĐẤU GIẢI THUẬT DEVER-FORCES
> **Ban hành bởi Ban Chuyên Môn & Kỹ Thuật CLB Lập Trình FU-DEVER**  
> **Áp dụng cho toàn bộ các kỳ thi xếp hạng (Rated Rounds) và tuyển quân nội bộ.**

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

Một kỳ thi chuẩn kéo dài **2 giờ 15 phút**, gồm 3 giai đoạn liên hoàn:

### 2.1. Giai đoạn Làm bài (Coding Phase - 120 phút)
* Thí sinh làm việc độc lập. Các bài toán được mở đồng thời từ khi đồng hồ đếm ngược về $00:00:00$.
* Khi nộp bài, hệ thống chấm code trên **Tập Pretests** (thường từ 5 đến 15 testcases cơ bản).
* Nếu vượt qua toàn bộ Pretests: Thí sinh nhận verdict `Pretests Passed` và được tạm tính điểm theo công thức suy giảm.
* **Quyền riêng tư:** Trong suốt Coding Phase, thí sinh **tuyệt đối không được xem** mã nguồn của người khác.

### 2.2. Giai đoạn Thách đấu & Bẻ khóa (Hack / Challenge Phase - 15 phút)
* Bắt đầu ngay khi hết 120 phút làm bài. Thí sinh không thể nộp thêm lời giải mới.
* Thí sinh được phân vào các **Room** (mỗi phòng 20–25 người).
* Trong Room, thí sinh được phép mở xem mã nguồn của các thí sinh khác đối với những bài đã `Pretests Passed`.
* Thí sinh có quyền nộp một bộ dữ liệu đầu vào (Input) hoặc file test để chứng minh code đối thủ bị sai (HACK):
  * **Hack thành công (Successful Hack):** Code đối thủ bị TLE, MLE, WA hoặc RTE trên testcase của bạn. Bạn được **+100 điểm**, bài của đối thủ chuyển trạng thái `Hacked` (0 điểm).
  * **Hack thất bại (Unsuccessful Hack):** Code đối thủ vẫn chạy đúng và ra kết quả chính xác. Bạn bị phạt **-50 điểm**.
* *Lưu ý:* Input dùng để hack phải tuân thủ nghiêm ngặt giới hạn đề bài (được kiểm tra tự động qua Validator).

### 2.3. Giai đoạn Kiểm tra Toàn diện (System Testing)
* Sau khi kết thúc Hack Phase, toàn bộ các bài nộp còn sống (chưa bị hack) sẽ được chấm lại trên **Full Test Suite** (gồm tất cả các hidden tests và các testcase hack thành công trong contest).
* Bài nộp không vượt qua sẽ nhận verdict `Failed on system test X` và mất toàn bộ điểm của bài đó.

---

## ĐIỀU 3: CƠ CHẾ TÍNH ĐIỂM & XẾP HẠNG

### 3.1. Điểm số bài toán (Dynamic Score Decay)
Điểm của mỗi bài giảm dần theo từng phút trôi qua kể từ đầu contest:

$$\text{Points} = \max\left( \lfloor 0.3 \times P_{\max} \rfloor, \; P_{\max} - \lfloor \frac{P_{\max} \times t}{250} \rfloor - 50 \times W \right)$$

* $P_{\max}$: Điểm gốc của bài (500, 1000, 1500, 2000,...).
* $t$: Phút nộp bài thành công (0 đến 120).
* $W$: Số lần nộp sai trên Pretest trước khi Accepted.
* Sàn điểm: Thí sinh luôn nhận được tối thiểu $30\%$ điểm gốc nếu bài giải đúng.

### 3.2. Tiêu chí Xếp hạng
1. Tổng điểm cao hơn xếp trên (Tổng điểm = Điểm bài thi + Điểm Hack ròng).
2. Nếu bằng điểm: Thí sinh có thời điểm nộp bài cuối cùng sớm hơn sẽ xếp trên.

---

## ĐIỀU 4: ĐIỀU KHOẢN THI HÀNH
Mọi thí sinh đăng ký tham gia contest trên nền tảng DEVER-Forces mặc nhiên đồng ý tuân thủ toàn bộ quy định trong Quy chế này và [Chính Sách Chống Gian Lận (ANTI_CHEAT_POLICY.md)](file:///c:/Users/ADMIN/DEVER%20Arena/docs/ANTI_CHEAT_POLICY.md).

> Cập nhật: DB schema và API contract tại db/schema.sql và src/db/api.js (2026-09-07)

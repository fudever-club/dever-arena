# DEVER Arena — Unified Design System & Architecture Specification (`design.md`)

> **Phiên bản:** 2.0.0 (LeetCode Ergonomics & Multi-Agent Consensus Edition)  
> **Trạng thái:** Approved by Multi-Agent Council & User Intent Gate  
> **Mục tiêu:** Nâng cấp toàn diện DEVER Arena từ HTML/CSS tĩnh sang nền tảng chuẩn mực **React + Vite + Tailwind CSS**, ứng dụng 100% công thái học (ergonomics) của **LeetCode** kết hợp trung thực với thể thức thi đấu **Codeforces** (Coding → Hack → System Test → Elo) và bản sắc thương hiệu CLB FU-DEVER.

---

## 1. Biên Bản Phiên Họp Hội Đồng Multi-Agent (Council Proceedings)

Hội đồng gồm 5 chuyên gia đại diện cho các góc nhìn độc lập đã tiến hành audit toàn bộ hệ thống hiện tại (`index.html`, `arena.html`, `admin.html`, `js/app.js`, `css/style.css`):

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          HỘI ĐỒNG MULTI-AGENT DEVER ARENA                        │
├─────────────────┬─────────────────┬──────────────────┬─────────────────┬─────────┤
│ Agent 1: GUEST  │ Agent 2: MEMBER │ Agent 3: ADMIN   │ Agent 4: AUTH   │ Agent 5:│
│ Experience &    │ Contestant & CP │ Operations &     │ Security & Sync │ LEETCODE│
│ Landing Funnel  │ UX Specialist   │ Security Center  │ Specialist      │ ARCH    │
└─────────────────┴─────────────────┴──────────────────┴─────────────────┴─────────┘
```

### 1.1. Báo Cáo Agent 1: Guest Experience Specialist
- **Hiện trạng:**
  - `index.html` có giao diện marketing khá tốt nhưng phân mảnh với ứng dụng chính. Khi khách muốn thử làm bài tập, link chuyển hướng sang `arena.html#view-problemset` gây cảm giác lạc vào giữa một kỳ thi đang chạy.
  - Không có trang Đăng nhập / Đăng ký chuyên biệt; khách chỉ thấy nút "Bắt đầu thi đấu" hoặc popup modal thô ráp khi nhấn vào các hành động bị khóa.
  - Khách chưa có chế độ "Scratchpad / Sandbox dùng thử" để chạy thử code trực tiếp trên Landing page mà không cần đăng nhập.
- **Đề xuất nâng cấp:**
  - Bổ sung Interactive Code Runner Widget ngay trên Hero của Landing Page: khách có thể chọn ngôn ngữ (C++, Python, JS), nhấn `Run` và thấy code thực thi tức thì (<50ms).
  - Tích hợp luồng CTA rõ ràng: Nút `Khám phá kho bài tập` dẫn tới danh mục bài tập công khai (`/problems`) và nút `Đăng nhập / Đăng ký` dẫn tới `/login`.
  - Khách truy cập vào bất kỳ bài tập nào đều có thể xem đề, xem testcase mẫu và code thử trong sandbox, chỉ khi bấm `Submit` (Nộp bài thi đấu) thì hệ thống mới yêu cầu đăng nhập và lưu lại tiến độ code vừa viết.

### 1.2. Báo Cáo Agent 2: Member / Contestant UX Specialist
- **Hiện trạng:**
  - `arena.html` đang chứa chung toàn bộ màn hình (Contest Hero, Problemset, Standings, Clan Wars, Workspace, Hack Room). Giao diện quá tải (overloaded DOM) làm giảm hiệu năng.
  - **Code Editor:** Đang dùng thẻ `<textarea>` HTML thông thường kết hợp script tự đếm dòng. Thiếu hoàn toàn các tính năng cơ bản của một IDE lập trình thi đấu: không có tô màu cú pháp theo ngữ cảnh (syntax highlighting), không có tự đóng ngoặc, không có thụt dòng thông minh (smart indentation), phím tắt `Tab` bị xung đột với trình duyệt.
  - **Workspace Split-Pane:** Phân chia giữa khung đề bài và khung soạn thảo code bằng script kéo chuột thủ công, thường xuyên bị giật khi kéo nhanh và không nhớ được kích thước chia cột khi người dùng đổi bài.
  - **Testcase Console (Bảng Chạy Thử):** Cố định một input/output thô sơ. Thí sinh không thể thêm nhiều testcase tùy biến như LeetCode (`Case 1`, `Case 2`, `+ Add Case`), không có bảng so sánh trực quan (Diff View) giữa Expected Output và Actual Output.
  - **Hack Room:** Hiển thị code của đối thủ trong một Modal che toàn màn hình, gây khó khăn cho việc đối chiếu với đề bài và không có công cụ sinh testcase biên để bẻ khóa (overflow detector, edge generator).
- **Đề xuất nâng cấp:**
  - Chuẩn hóa Layout theo LeetCode: Tách riêng route `/problem/:id` với 3 phân vùng chuẩn mực (Problem Pane, Monaco Code Editor, Testcase Console Drawer).
  - Tích hợp **Monaco Editor** (trình soạn thảo của VS Code) hỗ trợ C++20, Python 3, Java, JavaScript với Dark Theme tối ưu, font `JetBrains Mono`, phím tắt `Ctrl + Enter` (Submit) và `Ctrl + '` (Run Code).
  - Bảng Testcase đa tab chuẩn LeetCode: Cho phép chuyển đổi giữa các testcase mẫu, tự nhập custom testcase, chạy thử nghiệm tức thì và hiển thị diff chi tiết từng byte output.

### 1.3. Báo Cáo Agent 3: Admin & Operations Specialist
- **Hiện trạng:**
  - `admin.html` là một file tách biệt hoàn toàn nhưng không có cơ chế Route Guard ở cấp độ điều hướng. Người dùng bình thường gõ thẳng `admin.html` trên trình duyệt vẫn tải toàn bộ DOM và chỉ bị che bởi một banner cảnh báo.
  - **Polygon CMS:** Khung soạn thảo đề bài, nhập validator testlib và custom checker chỉ là các ô input nhỏ, thiếu cửa sổ xem trước Markdown + LaTeX Math (KaTeX) theo thời gian thực.
  - **Phase Control & Telemetry:** Việc chuyển phase kỳ thi (Coding → Hack → System Testing → Finished) ghi vào `localStorage`, nhưng các tab của thí sinh không tự động phản ứng ngay lập tức nếu không có sự kiện can thiệp.
- **Đề xuất nâng cấp:**
  - Xây dựng component `<AdminProtectedRoute>` kiểm tra quyền `ADMIN`. Nếu không có quyền, tự động lưu URL hiện tại và redirect về `/login?redirect=/admin&error=unauthorized`.
  - Xây dựng **Admin Command Center** dạng Dashboard hiện đại:
    - *Phase Controller Bar*: Có thanh tiến trình (Contest Scrubber) hiển thị trực quan thời gian còn lại của từng Phase, nút kích hoạt khẩn cấp và chuông cảnh báo.
    - *AST Anti-Cheat Radar*: Ma trận tương đồng nhiệt (Heatmap Matrix) giữa các bài nộp, cho phép xem diff cây AST song song 2 bài nộp bị nghi vấn và nút truất quyền (Disqualify) 1-click.
    - *Polygon Problem Studio*: Trình soạn đề 2 cột (Editor Markdown bên trái, Live Preview KaTeX chuẩn IEEE bên phải), tích hợp trình kiểm tra Testlib Validator báo lỗi định dạng testcase ngay khi gõ.

### 1.4. Báo Cáo Agent 4: Auth, Security & State Synchronization Specialist
- **Hiện trạng:**
  - Hoàn toàn **chưa có trang Đăng nhập (`/login`) chuyên biệt**. Hiện tại người dùng đổi vai trò qua một thẻ `<select>` thô sơ trên navbar hoặc bật một modal mờ mịt khi bị chặn hành động.
  - **Bất đồng bộ giữa các trang (Cross-page Inconsistency):**
    - `index.html`, `arena.html` và `admin.html` mỗi trang tự quản lý navbar, tự có một đoạn script toggle Dark/Light theme riêng biệt. Nếu đổi theme ở trang này, trang kia mở ở tab khác không tự đổi giao diện theo.
    - Trạng thái đăng nhập/vai trò (`GUEST`, `PARTICIPANT`, `ADMIN`) không được quản lý qua một Single Source of Truth; dữ liệu người dùng bị rải rác giữa `localStorage`, biến toàn cục trong `app.js` và memory.
- **Đề xuất nâng cấp:**
  - Xây dựng trang `/login` và `/register` chuyên nghiệp với thiết kế Split-Screen hiện đại phong cách LeetCode / GitHub Dark.
  - Hỗ trợ tính năng **"1-Click Fast Switch"** (Đăng nhập nhanh cho kiểm thử viên & giảng viên): Các nút bấm chọn nhanh vai trò (`Khách`, `Thí sinh dever_hero (Rating 1742)`, `Admin dever_admin (Rating 2450)`), đồng thời có form đăng nhập email/mật khẩu truyền thống cho người dùng thực.
  - **Cơ chế Đồng Bộ Trạng Thái Realtime Đa Tab:**
    - Sử dụng `BroadcastChannel('dever_arena_bus')` của trình duyệt. Mọi hành vi: Đăng nhập, Đăng xuất, Đổi Theme, Chuyển Phase kỳ thi, hay Cập nhật Điểm số đều được phát sóng (broadcast) tức thời đến tất cả các tab đang mở.
    - Xây dựng `AuthContext` và `ContestContext` quản lý state tập trung trong React, đảm bảo toàn bộ navbar, nút bấm, avatar và quyền hạn luôn đồng bộ 100%.

### 1.5. Báo Cáo Agent 5: Lead UI/UX Architect (LeetCode Benchmark Synthesis)
- **Tổng hợp chuẩn LeetCode:**
  - Giao diện LeetCode thành công nhờ vào:
    1. **Tỷ lệ hiển thị nội dung (Content-to-Chrome Ratio) cực cao:** Thanh điều hướng trên cùng chỉ cao 48px, tối giản mọi viền và khoảng trống thừa, dành trọn 95% diện tích cho bài tập và code.
    2. **Cấu trúc 3-Pane Ergonomic Workspace:** 
       - Trái: Cụm đề bài (Tabs: Description, Editorial/Solution, Submissions, Discussion).
       - Phải - Trên: Trình soạn thảo Code (Monaco Editor với toolbar tinh gọn: Language, Font size, Reset, Fullscreen).
       - Phải - Dưới: Console Testcase có thể thu gọn / kéo rộng (Tabs: TestCase, Test Result, Console Log).
    3. **Thanh Thao Tác Pinned Action Bar:** Nút `Run Code` và `Submit` đặt cố định ở góc dưới cùng bên phải, vừa tầm mắt sau khi viết xong code, không bắt mắt phải đảo lên thanh menu trên cùng.
- **Kết luận đồng thuận của Hội đồng:**
  - Phối hợp triết lý công thái học của LeetCode với bộ quy chuẩn thi đấu Codeforces và nhận diện FPTU.
  - Nâng cấp dự án lên **React 18 + Vite + Tailwind CSS**.

---

## 2. Hệ Thống Design Tokens & Visual Identity

### 2.1. Bảng Màu Thống Nhất (Color Palette)
Giao diện áp dụng bảng màu **Slate Dark Mode** kết hợp màu thương hiệu đặc trưng của FU-DEVER:

| Token Name | Hex Code | Ứng Dụng | Ý Nghĩa / Chuẩn |
|---|---|---|---|
| `--bg-base` | `#0b0f19` | Nền chính của ứng dụng | Slate sâu, chống mỏi mắt khi code đêm |
| `--bg-surface` | `#111827` | Nền card, navbar, sidebar | Tách biệt nhẹ nhàng với nền chính |
| `--bg-card` | `#1f2937` | Nền của panel code editor, console | Đậm chất IDE chuyên nghiệp |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Đường viền các panel, tabs | Viền mảnh sắc sảo kiểu LeetCode |
| `--border-active` | `rgba(255, 102, 0, 0.4)` | Viền khi focus, active panel | Nhận diện FPT Orange |
| `--accent-orange` | `#ff6600` | Nút hành động chính, brand badge | Màu cam FPT University truyền thống |
| `--accent-cyan` | `#00f0ff` | Telemetry, ghost replay, queue status | Phong cách Cyber Arena hiện đại |
| `--status-ac` | `#10b981` | Accepted, Hack thành công | Xanh lục chuẩn LeetCode / CF |
| `--status-wa` | `#ef4444` | Wrong Answer, Bị Hack, Cheater | Đỏ cảnh báo |
| `--status-tle` | `#f59e0b` | Time Limit Exceeded, System Testing | Vàng hổ phách |

### 2.2. Bảng Xếp Hạng 7 Bậc Rating Codeforces (CF Rank Colors)
| Bậc Rating | Tên Hạng | Màu Ký Hiệu | Dải Điểm Rating |
|---|---|---|---|
| **Newbie** | Tân thủ | `#9e9e9e` (Xám) | < 1200 |
| **Pupil** | Tập sự | `#4caf50` (Xanh lá) | 1200 – 1399 |
| **Specialist** | Chuyên viên | `#00b8a9` (Xanh lam ngọc) | 1400 – 1599 |
| **Expert** | Chuyên gia | `#3b5bdb` (Xanh dương) | 1600 – 1899 |
| **Candidate Master** | Dự bị kiện tướng | `#aa00aa` (Tím) | 1900 – 2199 |
| **Master** | Kiện tướng | `#ff8c00` (Cam đậm) | 2200 – 2399 |
| **Grandmaster** | Đại kiện tướng | `#e53935` (Đỏ rực) | ≥ 2400 |

### 2.3. Quy Chuẩn Typography & Spacing
- **Giao diện & Tiêu đề:** `Outfit, -apple-system, sans-serif` — hiện đại, độ cong mềm mại, tính nhận diện cao.
- **Mã nguồn & Bảng số liệu:** `JetBrains Mono, Menlo, Consolas, monospace` — font lập trình chuẩn mực với tính năng hiển thị chữ số có độ rộng đồng đều (tabular numbers), hỗ trợ đọc code chính xác.
- **Thang đo Spacing:** Base 4px (`p-1`: 4px, `p-2`: 8px, `p-3`: 12px, `p-4`: 16px, `p-6`: 24px).
- **Bo góc (Border Radius):** 
  - Nút bấm & Input: `rounded-lg` (8px).
  - Thẻ Card & Khung Panel: `rounded-xl` (12px).
  - Badge & Tag: `rounded-md` (4px).

---

## 3. Bản Thiết Kế Chi Tiết Từng Trang (Page Specifications)

### 3.1. Trang Chủ / Khách (`/` - Landing Page)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [DEVER FORCES]   Kỳ Thi   Kho Bài Tập   Standings   Clan         [Đăng Nhập]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    🔴 Vòng thi DEVER Round #1 đang diễn ra                                  │
│    Đấu Trường Thuật Toán Chuẩn Codeforces & ICPC                            │
│    Coding Phase 120' • Hack Phase 15' • System Test • Elo Rating            │
│                                                                             │
│    [ 🏆 Vào Thi Đấu Ngay ]          [ 📚 Khám Phá Kho Bài ]                 │
│                                                                             │
│    ┌───────────────────────────────────────────────────────────────────┐    │
│    │ Interactive Sandbox Preview (Thử nghiệm trực tiếp trên web)       │    │
│    │ C++20 | Python 3 | JS                               [ ▶ Run Code ]│    │
│    │ 1 #include <iostream>                                             │    │
│    │ 2 int main() { std::cout << "Hello FU-DEVER!"; return 0; }        │    │
│    │ > Output: Hello FU-DEVER! (Execution: 12ms)                       │    │
│    └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  [1,240+ Thí sinh]     [48 Contests]     [5 Bài/Round]     [92% Chống Hack] │
└─────────────────────────────────────────────────────────────────────────────┘
```
- **Mục tiêu:** Thu hút sinh viên, giải thích rõ thể thức thi đấu, tạo ấn tượng chuyên nghiệp với live sandbox.
- **Thành phần cốt lõi:**
  - Header Navbar đồng bộ trạng thái đăng nhập.
  - Hero Section với Badge nhấp nháy báo hiệu trạng thái vòng thi đang diễn ra.
  - Interactive Sandbox Demo: Trình biên dịch nhanh cho khách trải nghiệm trước khi đăng ký.
  - Danh sách kỳ thi sắp diễn ra (Upcoming Rounds) với thẻ phân hạng Div.1 / Div.2 / Div.3 / Div.4.

---

### 3.2. Trang Đăng Nhập & Đăng Ký Chuyên Biệt (`/login` & `/register`)
```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│       DEVER FORCES ECOSYSTEM         │          CHÀO MỪNG TRỞ LẠI           │
│                                      │                                      │
│   🚀 Nền tảng thi đấu giải thuật     │  Email / Username:                   │
│      nội bộ CLB FU-DEVER.            │  [________________________________]  │
│                                      │                                      │
│   ⚔️ Trải nghiệm cảm giác Hack code   │  Mật khẩu:                           │
│      đối thủ trong Room 25 người.    │  [________________________________]  │
│                                      │                                      │
│   🛡️ Chấm điểm Isolate Sandbox       │  [          ĐĂNG NHẬP           ]    │
│      bảo vệ tính toàn vẹn 100%.      │                                      │
│                                      │  ──────── Hoặc đăng nhập nhanh ───── │
│   [ Minh họa đồ họa Cyber Code ]     │  [ 👤 Khách (Guest)                ] │
│                                      │  [ ⚡ Thí sinh: dever_hero (1742)   ] │
│                                      │  [ 👑 Admin: dever_admin (2450)    ] │
│                                      │                                      │
│                                      │  Chưa có tài khoản? [ Đăng ký ngay ] │
└──────────────────────────────────────┴──────────────────────────────────────┘
```
- **Cấu trúc Split-Screen:**
  - Nửa trái: Hero Branding với các giá trị cốt lõi của CLB FU-DEVER và đồ họa trực quan.
  - Nửa phải: Form xác thực gọn gàng, hỗ trợ cả tài khoản cá nhân và cụm nút **1-Click Fast Switch** dành riêng cho demo, chấm thi thử và đánh giá dự án.
- **Route Query Redirect:** Hỗ trợ tham số `/login?redirect=/arena` để tự động điều hướng người dùng trở lại trang họ đang truy cập dang dở sau khi đăng nhập thành công.

---

### 3.3. Không Gian Làm Bài Chuẩn LeetCode (`/problem/:id` - The Pro Workspace)
Đây là màn hình cốt lõi nhất của DEVER Arena, được thiết kế theo đúng mô hình 3 phân vùng công thái học của LeetCode:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Bài trước   [ Bài B: Big Product ]   Bài tiếp →        ⏱️ 01:24:15 | +450đ│
├──────────────────────────────┬──────────────────────────────────────────────┤
│ 📑 Đề Bài | 💡 Hướng Dẫn | 📜│ ⚙️ C++20 ▼   Theme ▼   A- A+   ⛶   [ ↺ Reset ]│
│                              ├──────────────────────────────────────────────┤
│ B. Big Product               │ 1  #include <bits/stdc++.h>                  │
│ Time: 1.0s | Memory: 256MB   │ 2  using namespace std;                      │
│                              │ 3  int main() {                              │
│ Cho mảng A gồm N số nguyên.  │ 4      long long n, prod = 1;                │
│ Tính tích các phần tử...     │ 5      cin >> n;                             │
│                              │ 6      // Code here...                       │
│ Ví dụ 1:                     ├──────────────────────────────────────────────┤
│ Input:                       │ 🧪 Testcase  |  📊 Run Result  |  Terminal ▲ │
│ 3                            ├──────────────────────────────────────────────┤
│ 1 2 3                        │ [Case 1]  [Case 2]  [+ Add Case]             │
│ Output:                      │ Input: 3 \n 1 2 3                            │
│ 6                            │ Expected: 6                                  │
│                              │ Actual:   6 (Diff: 0)  Time: 12ms | Mem: 2MB │
├──────────────────────────────┴──────────────────────────────────────────────┤
│ ⚡ Điểm hiện tại: 450 (Giảm -2đ sau 30s)          [ ▶ Chạy Thử ]  [ 🚀 NỘP BÀI ]│
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Chi tiết các phân vùng:
1. **Phân vùng 1 (Trái): Problem Statement Tabs:**
   - Tab `Đề bài`: Đề bài chuẩn LaTeX Math, định dạng I/O rõ ràng, khối Copy input tiện lợi.
   - Tab `Hướng dẫn (Editorial)`: Lời giải thuật toán (chỉ mở sau khi contest kết thúc hoặc ở bài tập luyện tập).
   - Tab `Submissions`: Lịch sử các lần nộp bài của thí sinh đối với bài này (Pretest Passed, WA, TLE, điểm số).
   - Tab `Thảo luận`: Nơi các thành viên trao đổi ý tưởng và phân tích độ phức tạp.
2. **Phân vùng 2 (Phải - Trên): Monaco Code Editor:**
   - Bộ chọn ngôn ngữ: C++20, Python 3.11, Java 17, Node.js 20.
   - Tự động lưu bản thảo (Auto-save draft) vào LocalStorage theo từng mã bài.
   - Các tiện ích: Tăng giảm cỡ chữ, phím tắt `Ctrl + S`, `Ctrl + /` (comment), Fullscreen mode.
3. **Phân vùng 3 (Phải - Dưới): Testcase Console Drawer:**
   - Kéo mở hoặc thu gọn linh hoạt bằng con trượt chuột.
   - Tabs danh sách Testcase: Thí sinh có thể thêm testcase tự do để thử các trường hợp biên (số âm, mảng rỗng, giá trị lớn đến $10^{18}$).
   - Run Result: So sánh song song (Diff View) kết quả thực tế và kết quả mong đợi, hiển thị màu xanh lá khi khớp và màu đỏ chỉ rõ vị trí ký tự sai khác.
4. **Thanh Thao Tác Cố Định Dưới Cùng (Ergonomic Pinned Footer):**
   - Góc trái: Đồng hồ đếm ngược điểm suy giảm theo thời gian (`Dynamic Score Decay Tracker`).
   - Góc phải: Hai nút bấm lớn kề nhau:
     - `Chạy thử (Run Code)`: Phím tắt `Ctrl + '` — chạy testcase mẫu hoặc custom testcase trong Isolate Sandbox.
     - `NỘP BÀI (Submit)`: Phím tắt `Ctrl + Enter` — gửi bài chấm Pretests chính thức.

---

### 3.4. Phòng Thách Đấu (`/hack-room` - The Codeforces Hack Chamber)
- Thí sinh chỉ được mở code của các đấu thủ nằm cùng **Room 25 người** (được bốc thăm theo rank tương đồng khi bắt đầu contest).
- **Giao diện Split-View đối kháng:**
  - Khung trái: Mã nguồn của đối thủ với định dạng số dòng rõ ràng, hiển thị kết quả Pretest Passed (ví dụ: `Passed Pretest (500 pts)`).
  - Khung phải: Trình tạo testcase bẻ khóa (Counter-Test Generator):
    - Ô nhập dữ liệu testcase hack.
    - Bộ lọc tự động chạy qua **Testlib Validator**: Nếu testcase hack sai format (thừa dấu cách cuối dòng, thiếu newline, $N$ vượt quá giới hạn đề), hệ thống báo lỗi cú pháp ngay lập tức và từ chối gửi để bảo vệ thí sinh không bị mất oan 50 điểm phạt.
    - Nút `Tung Đòn Hack (-50đ / +100đ)`: Gửi testcase vào hàng đợi ưu tiên cao nhất của Worker Queue. Hiển thị thông báo kịch tính khi hack thành công.

---

### 3.5. Cổng Điều Hành Ban Tổ Chức (`/admin` - Admin Command Center)
Được bảo vệ nghiêm ngặt bằng `<AdminProtectedRoute>`, chia làm 4 module:
1. **Contest Phase Orchestrator:**
   - Nút chuyển trạng thái 1-chạm: `REGISTRATION` → `CODING (120')` → `HACK_PHASE (15')` → `SYSTEM_TESTING` → `FINISHED`.
   - Cơ chế phát sóng `BroadcastChannel` đẩy thông báo chuyển phase tức thời đến toàn bộ màn hình của tất cả thí sinh mà không cần tải lại trang.
   - Tính năng `Scoreboard Freeze`: Đóng băng bảng điểm trong 30 phút cuối kỳ thi và công cụ `ICPC Dramatic Unfreeze` giải mã từng bài nộp từ dưới lên trên.
2. **AST Anti-Cheat Sentinel:**
   - Hệ thống quét Winnowing 3-gram: Phát hiện các mã nguồn gian lận, lọc bỏ hoàn toàn thủ thuật đổi tên biến, tráo hàm, thêm comment rác.
   - Bảng radar cảnh báo các cặp bài nộp có độ tương đồng $>80\%$.
   - Trình so sánh cây cú pháp AST trực quan cho Ban Giám khảo kèm nút truất quyền thi đấu (`Disqualify Cheater`).
3. **Polygon Problemsetter Studio:**
   - Trình tạo đề bài chuẩn Polygon: Viết đề Markdown + KaTeX Math preview thời gian thực.
   - Nhập Testcases (Input, Output, Description).
   - Tích hợp trình biên dịch Testlib Input Validator và Custom Checker (Float tolerance, token matching, multi-solution checker).
4. **Isolate Worker Queue Telemetry:**
   - Thống kê realtime: Số lượng worker đang chạy, hàng đợi ưu tiên (P1: Hack, P2: Pretest, P3: System Test), thời gian phản hồi trung bình (ms).

---

## 4. Cơ Chế Đồng Bộ Trạng Thái Toàn Cục (State Synchronization Architecture)

Để giải quyết triệt để vấn đề bất đồng bộ giữa các trang mà Hội đồng đã chỉ ra, hệ thống áp dụng kiến trúc đồng bộ 2 tầng:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REACT APP ROOT CONTAINER                         │
│                                                                             │
│   ┌────────────────────────┐         ┌──────────────────────────────────┐   │
│   │      AuthContext       │         │          ContestContext          │   │
│   │ (user, role, rating)   │         │ (phase, remainingTime, freeze)   │   │
│   └───────────┬────────────┘         └────────────────┬─────────────────┘   │
│               │                                       │                     │
│               └───────────────────┬───────────────────┘                     │
│                                   ▼                                         │
│                 BROWSER BROADCAST CHANNEL BUS                               │
│                    `dever_arena_bus`                                        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
  [ Tab 1: /arena ]          [ Tab 2: /problem/2 ]        [ Tab 3: /admin ]
  - Nhận Event LOGIN         - Nhận Event LOGIN           - Nhận Event LOGOUT
  - Tự đổi avatar, điểm      - Mở khóa nút Nộp bài        - Redirect về /login
  - Nhận Event PHASE_CHANGE  - Khóa Editor nếu hết giờ    - Cập nhật số thí sinh
```

### 4.1. Sự Kiện Kênh Phát Sóng (`BroadcastChannel Events`)
Tất cả các cửa sổ/tab của ứng dụng lắng nghe kênh `new BroadcastChannel('dever_arena_bus')`:

| Tên Sự Kiện | Dữ Liệu Kèm Theo | Phản Ứng Trên Toàn Bộ Ứng Dụng |
|---|---|---|
| `AUTH_STATE_CHANGED` | `{ user, role, token }` | Cập nhật Navbar ở mọi tab; nếu logout lập tức khóa quyền trang `/admin`. |
| `THEME_CHANGED` | `{ theme: 'dark' \| 'light' }` | Đổi thuộc tính `data-theme` trên thẻ `<html>` của tất cả các tab đang mở. |
| `CONTEST_PHASE_CHANGED` | `{ phase, timestamp }` | Cập nhật đồng hồ đếm ngược, chuyển chế độ giao diện (ví dụ từ Coding sang Hack Phase thì tự mở khóa tab Hack Room). |
| `SCOREBOARD_UPDATED` | `{ standings, lastHack }` | Cập nhật bảng xếp hạng live và phát âm thanh SFX kịch tính nếu người dùng bật âm thanh. |

---

## 5. Cấu Trúc Cây Thư Mục Dự Án (React + Vite Structure)

Dự án sẽ được cấu trúc theo chuẩn mực công nghiệp hiện đại, bảo toàn 100% logic thuật toán đã được kiểm thử:

```
DEVER Arena/
├── index.html                     # Vite Entry HTML
├── package.json                   # React 18, Vite, Tailwind CSS, Lucide-React
├── vite.config.js                 # Vite bundler configuration
├── tailwind.config.js             # Hệ thống design tokens & colors
│
├── docs/                          # Tài liệu kiến trúc & quy chuẩn
│   ├── design.md                  # [NÀY] Bản thiết kế hệ thống thống nhất
│   ├── CAPABILITY_MAP.md          # Bản đồ năng lực hệ thống
│   ├── CONTEST_RULEBOOK.md        # Luật thi đấu chuẩn Codeforces
│   └── ANTI_CHEAT_POLICY.md       # Chính sách chống gian lận AST
│
├── src/
│   ├── core/                      # GIỮ NGUYÊN 100% (Thuật toán đã có 98 tests)
│   │   ├── scoring.js             # Dynamic score decay & penalty
│   │   ├── rating.js              # Elo CF rating calculation
│   │   ├── contestStateMachine.js # Contest lifecycle engine
│   │   ├── scoreboardFreeze.js    # ICPC freeze & dramatic unfreeze
│   │   └── clanRating.js          # Harmonic sum clan ranking
│   │
│   ├── engine/                    # GIỮ NGUYÊN 100% (Bộ máy thực thi & Sandbox)
│   │   ├── astDiff.js             # Winnowing AST anti-cheat
│   │   ├── isolateRunner.js       # Client sandbox executor
│   │   ├── testlibValidator.js    # Polygon input validator
│   │   ├── workerQueue.js         # Priority judge queue
│   │   └── sound.js               # Web Audio SFX synthesizer
│   │
│   ├── db/                        # IndexedDB Database Engine (11 stores)
│   │   ├── index.js               # IndexedDB wrapper
│   │   └── api.js                 # Unified Data Access Layer
│   │
│   ├── context/                   # Quản lý trạng thái toàn cục & BroadcastChannel
│   │   ├── AuthContext.jsx        # User profile, role, 1-Click Fast Switch
│   │   ├── ContestContext.jsx     # Phase, countdown, timer sync
│   │   └── ThemeContext.jsx       # Dark / Light theme synchronization
│   │
│   ├── components/                # Thư viện Components tái sử dụng
│   │   ├── layout/                # Navbar, Footer, AppShell, ProtectedRoute
│   │   ├── workspace/             # MonacoEditor, SplitPane, TestcaseConsole
│   │   ├── contest/               # ContestHero, PhasePill, StandingsTable
│   │   ├── hack/                  # HackRoomCard, CounterTestModal
│   │   └── common/                # Button, Badge, Modal, Toast, Avatar
│   │
│   ├── pages/                     # Các trang theo URL Route
│   │   ├── LandingPage.jsx        # Route: / (Trang chủ & Sandbox demo)
│   │   ├── LoginPage.jsx          # Route: /login (Form & 1-Click Fast Switch)
│   │   ├── ArenaPage.jsx          # Route: /arena (Contest Hub & Overview)
│   │   ├── ProblemWorkspace.jsx   # Route: /problem/:id (LeetCode 3-Pane)
│   │   ├── StandingsPage.jsx      # Route: /standings (Live Rank & Freeze)
│   │   ├── HackRoomPage.jsx       # Route: /hack-room (Room Defense)
│   │   ├── ClansPage.jsx          # Route: /clans (Clan Wars)
│   │   └── AdminDashboard.jsx     # Route: /admin (Command Center)
│   │
│   └── App.jsx                    # React Router Setup & Provider tree
│
└── tests/                         # 98 Unit & E2E Tests (Tiếp tục duy trì 100% PASS)
```

---

## 6. Lộ Trình Triển Khai (Migration Roadmap)

1. **Giai đoạn 1 (Đã Hoàn Thành):**
   - Phỏng vấn định hướng (/grill-me) xác lập ý định người dùng.
   - Họp Hội đồng Multi-Agent (5 chuyên gia) phân tích toàn diện 4 luồng người dùng và lỗ hổng bất đồng bộ.
   - Khảo sát chuẩn LeetCode và ban hành tài liệu thiết kế kiến trúc chuẩn mực [`docs/design.md`](./design.md).

2. **Giai đoạn 2 (Đã Hoàn Thành):**
   - Khởi tạo môi trường Vite + React, tích hợp Tailwind CSS v4 và Lucide Icons.
   - Thiết lập cấu trúc `App.jsx`, định tuyến `HashRouter` phân tách 2 layout độc lập (`MemberLayout` và `AdminLayout`).
   - Xây dựng trang `/login` với chế độ 1-Click Fast Switch, tự động định tuyến thông minh (Admin vào `/admin`, Member vào `/arena`).
   - Xây dựng `ProblemWorkspace` chuẩn LeetCode 3 phân vùng với Monaco Code Editor, Auto-Save LocalStorage và Testcase Diff Console.
   - Xây dựng `AdminLayout` với Dark Sidebar chuyên dụng và chế độ "Contestant Preview Mode" cho Ban Giám Khảo.
   - Xác minh 98 automated tests và `detect.mjs` đạt 100% PASS.

---

## 7. Kiến Trúc Phân Tách Độc Lập Giữa Member Portal & Admin Portal

Nhằm đảm bảo trải nghiệm thi đấu thuần túy cho thí sinh và bảo mật quyền lực tối cao cho Ban Tổ Chức, hệ thống phân tách thành 2 Portal riêng biệt:

```
                                  [ /login ]
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        (Role: PARTICIPANT / GUEST)                (Role: ADMIN)
                   │                                     │
                   ▼                                     ▼
      ┌─────────────────────────┐           ┌─────────────────────────┐
      │      MEMBER PORTAL      │           │   ADMIN COMMAND CENTER  │
      │  (Layout: MemberLayout) │           │  (Layout: AdminLayout)  │
      ├─────────────────────────┤           ├─────────────────────────┤
      │ • Navbar thi đấu chuẩn  │           │ • Dark Sidebar 5 Module │
      │ • Không có nút admin    │           │ • Phase Orchestrator    │
      │ • /arena (Contest Hub)  │           │ • AST Anti-Cheat Radar  │
      │ • /problem/:id (LeetCode│           │ • Polygon Studio        │
      │   3-Pane Workspace)     │           │ • Worker Queue Telemetry│
      │ • Focus 100% làm bài    │           │ • Phân phối 25 người/phòng│
      └────────────┬────────────┘           └────────────┬────────────┘
                   ▲                                     │
                   └────── [ Contestant Preview Mode ] ──┘
                           (Hiện banner cảnh báo vàng)
```

1. **Member Portal (`MemberLayout`)**:
   - Chỉ hiển thị các thành phần phục vụ thi đấu: Tên kỳ thi, không gian làm bài, đồng hồ đếm ngược, avatar thí sinh và Elo.
   - Tuyệt đối không hiển thị bất kỳ nút phân quyền, nút chuyển phase hay menu admin nào.
   - Nếu thí sinh cố truy cập `/admin`, component Route Guard lập tức chuyển hướng về `/login?redirect=/admin`.
2. **Admin Command Center (`AdminLayout`)**:
   - Sử dụng layout độc lập với Dark Sidebar bên trái (5 module tác chiến).
   - Tích hợp nút **"👁️ Xem góc nhìn Thí sinh"**: Cho phép Ban Giám Khảo sang xem giao diện làm bài của thí sinh. Khi ở chế độ này, hệ thống bật một thanh banner màu vàng trên cùng (`Contestant Preview Mode`) kèm nút bấm nhanh để quay lại Admin Portal bất cứ lúc nào.

---

*Tài liệu này là cam kết kỹ thuật tối cao được thống nhất bởi Hội đồng Multi-Agent và Người dùng để chỉ dẫn cho toàn bộ quá trình phát triển tiếp theo của DEVER Arena.*


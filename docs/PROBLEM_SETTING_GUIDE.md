# HƯỚNG DẪN BIÊN SOẠN ĐỀ THI CHUẨN POLYGON & TESTLIB.H
> **Tài liệu chuẩn hóa dành cho Ban Đề Thi (Problemsetters), Ban Kiểm Duyệt (Coordinators) và Đội Thử Đề (Testers) CLB FU-DEVER.**

---

## 1. CẤU TRÚC MỘT GÓI BÀI TOÁN CHUẨN (PROBLEM PACKAGE ARCHITECTURE)

Mỗi bài toán trên DEVER-Forces bắt buộc phải có cấu trúc thư mục độc lập:

```
problem_package/
├── statement.md             # Đề bài song ngữ, công thức Toán LaTeX, giải thích test ví dụ
├── editorial.md             # Lời giải chính thức, thuật toán, phân tích độ phức tạp O()
├── solution.cpp             # Lời giải chuẩn tối ưu của tác giả (Model Solution - AC)
├── slow_solution.cpp        # Lời giải ngây thơ Brute-force (dùng để đối soát test nhỏ)
├── buggy_solution.cpp       # Lời giải chứa bẫy sai phổ biến (đảm bảo pretest/hack bắt được)
├── files/
│   ├── testlib.h            # Thư viện chuẩn quốc tế của Mike Mirzayanov (Codeforces)
│   ├── validator.cpp        # Kiểm tra tính hợp lệ của dữ liệu đầu vào (Input format & limits)
│   ├── generator.cpp        # Sinh các bộ test ngẫu nhiên và test cực biên (Edge cases)
│   └── checker.cpp          # Kiểm tra tính chính xác của Output (đặc biệt khi có nhiều đáp án)
└── tests/
    ├── 01.in / 01.ans       # Test ví dụ 1
    ├── 02.in / 02.ans       # Test ví dụ 2
    ├── 03.in - 10.in        # Tập Pretests (chạy trong 120 phút thi)
    └── 11.in - 50.in        # Tập Hidden System Tests & Hack Tests
```

---

## 2. QUY CHUẨN VIẾT CÁC THÀNH PHẦN BẰNG TESTLIB.H

### 2.1. Bộ Kiểm Duyệt Dữ Liệu Vào (Validator)
Mục tiêu: Đảm bảo **100% testcase** (kể cả testcase do thí sinh tự nhập để Hack đối thủ) không được vượt quá giới hạn đề bài:

```cpp
#include "testlib.h"

int main(int argc, char* argv[]) {
    registerValidation(argc, argv);
    
    // Đọc số nguyên N trong khoảng [1, 200000]
    int n = inf.readInt(1, 200000, "n");
    inf.readSpace();
    // Đọc số nguyên K trong khoảng [1, n]
    int k = inf.readInt(1, n, "k");
    inf.readEoln();

    // Đọc mảng A
    for (int i = 0; i < n; i++) {
        inf.readInt(-1000000000, 1000000000, "a_i");
        if (i + 1 < n) inf.readSpace();
    }
    inf.readEoln();
    inf.readEof(); // Bắt buộc kết thúc bằng EOF

    return 0;
}
```

### 2.2. Bộ Sinh Testcase Ngẫu Nhiên & Cực Biên (Generator)
Mục tiêu: Không chỉ sinh số ngẫu nhiên mà phải chủ động tạo các **Corner Cases**:
* Trường hợp cực tiểu: $N = 1, N = 2$, tất cả phần tử bằng 0 hoặc số âm.
* Trường hợp cực đại: $N = 2 \times 10^5$, các phần tử đạt ngưỡng $10^9$ hoặc $10^{18}$ để kiểm tra tràn số (Overflow).
* Trường hợp đồ thị đặc biệt: Đồ thị đường thẳng, đồ thị sao, đồ thị vòng, cây nhị phân suy biến thành đường thẳng.
* Chống thuật toán Hash: Sinh mảng có các chuỗi/số dễ gây xung đột bảng băm (Anti-hash tests).

---

## 3. QUY TRÌNH KIỂM THỬ ĐỘC LẬP (TESTING & COORDINATION WORKFLOW)

1. **Giai đoạn 1 (Ra đề):** Problemsetter chuẩn bị `statement.md`, `solution.cpp`, `validator.cpp`, `generator.cpp`.
2. **Giai đoạn 2 (Thẩm định kín - Blind Testing):**
   * Coordinator giao đề cho 2 Tester giải độc lập mà không xem solution của tác giả.
   * Đo lường thời gian giải thực tế để điều chỉnh thứ tự bài: A (Dễ) ➔ B (Trung bình) ➔ C (Khá) ➔ D (Khó) ➔ E/F (Rất khó).
3. **Giai đoạn 3 (Cân chỉnh Time Limit & Memory Limit):**
   * Giới hạn thời gian (Time Limit) phải đặt gấp **tối thiểu 2 lần** thời gian chạy của Lời giải chuẩn C++ tối ưu (để hỗ trợ các thí sinh dùng Python / Java vẫn có cơ hội AC nếu giải thuật đúng).
   * Lời giải $O(N^2)$ phải bị TLE dứt khoát trên các testcase $N \ge 10^5$.

---

## 4. TRIỂN KHAI TRÊN DEVER ARENA (POLYGON STUDIO)

1. **Sinh test (`src/engine/testGenerator.js`):** seeded (mulberry32) → cùng seed cùng bộ test. Mọi suite gồm 5 bẫy: N min, N=1, toàn bằng nhau, tràn số, N max; còn lại xoay pattern random/sorted/alternating.
2. **Stress (`POST /api/v1/admin/stress`):** chạy model vs brute-force trên cùng suite qua worker pool; `verdict: PASS/FAIL` + `mismatches` (tối đa 5) + `modelMaxMs` + `suggestedTimeLimitS = max(1s, 2× model chậm nhất)`. Trong Studio: xem trước strategies → Chạy stress → Áp dụng TL → Lưu outputs thành pretests.
3. **Kiểm duyệt mù:** `DRAFT → IN_TESTING → APPROVED` (từ chối về `DRAFT`). Admin giao tester (cấm tự giao); tester nhận queue tại ContestHub (**ẩn editorial**), giải độc lập rồi nộp báo cáo (solved?/số phút/nhận xét); coordinator duyệt kèm ghi chú.

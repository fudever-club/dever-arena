# KIẾN TRÚC HỆ THỐNG MÁY CHẤM AN TOÀN (JUDGE ARCHITECTURE & SANDBOX SPEC)
> **Thiết kế kỹ thuật đảm bảo tính bảo mật, độ chính xác microsecond và khả năng chịu tải đồng thời của DEVER-Forces.**

---

## 1. TỔNG QUAN LUỒNG XỬ LÝ (JUDGING PIPELINE)

```mermaid
sequenceDiagram
    autonumber
    actor Coder as Thí sinh
    participant Web as Web Frontend & API Gateway
    participant Redis as Redis Queue (Priority Queues)
    participant Worker as Judge Worker Node
    participant Box as Isolate / Docker Sandbox
    
    Coder->>Web: Nộp mã nguồn (C++, Python, Java, Go)
    Web->>Redis: Đẩy Submission vào Queue (Priority: Pretest > Hack > Batch)
    Redis-->>Worker: Worker lấy job có độ ưu tiên cao nhất
    Worker->>Box: Biên dịch mã nguồn (g++ -O3, javac, etc.)
    alt Lỗi biên dịch (CE)
        Worker-->>Web: Trả về Compilation Error
    else Biên dịch thành công
        Worker->>Box: Thực thi với từng testcase (Chặn CPU, RAM, Network)
        Box-->>Worker: Kết quả từng test (Time, Memory, Exit Code, Stdout)
        Worker->>Worker: So khớp kết quả bằng Custom Checker / Token Diff
        Worker-->>Web: Gửi cập nhật trạng thái thời gian thực qua WebSocket
        Web-->>Coder: Hiển thị Verdict: AC / WA / TLE / MLE / RTE
    end
```

---

## 2. PHÂN TẦNG HÀNG ĐỢI ƯU TIÊN (THREE-TIER PRIORITY QUEUE)

Hệ thống điều phối job qua Redis Streams với 3 mức ưu tiên khác nhau nhằm đảm bảo tính phản hồi tức thì:

1. **Queue 1 — Instant Hack Queue (Ưu tiên Cao nhất):**
   * Phục vụ các lượt Hack trong 15 phút Hack Phase.
   * Yêu cầu thời gian trả kết quả dưới 3 giây để người hack biết ngay mình được $+100$ hay bị phạt $-50$ điểm.
2. **Queue 2 — Pretest Queue (Ưu tiên Trung bình):**
   * Phục vụ các bài nộp trong Coding Phase.
   * Chỉ chạy trên tập Pretests (5–15 tests) để thí sinh không phải chờ đợi lâu giữa các lần sửa code.
3. **Queue 3 — System Test Queue (Ưu tiên Thấp / Chạy hàng loạt):**
   * Kích hoạt sau khi kết thúc Hack Phase.
   * Chạy hàng nghìn bài nộp qua toàn bộ bộ test ẩn để chốt bảng xếp hạng cuối cùng.

---

## 3. MÔ HÌNH CÔ LẬP MÃ NGUỒN AN TOÀN (SANDBOX ISOLATION)

Để đảm bảo máy chấm không bị tấn công mã độc hoặc tài nguyên bị chiếm dụng, DEVER-Forces áp dụng mô hình Sandbox chuẩn **Isolate** (công cụ chấm chuẩn của IOI và ICPC) hoặc **Docker Hardened Container**:

### Các rào chắn bảo mật bắt buộc:
* **Network Isolation (`--net=none`):** Cấm hoàn toàn mọi kết nối mạng ra vào máy chấm. Code thí sinh không thể gửi request ra ngoài hoặc tải mã độc.
* **Process Limit (`pids-limit = 64`):** Ngăn chặn các cuộc tấn công Fork Bomb làm tràn bảng tiến trình của hệ điều hành (`while(1) fork();`).
* **Memory Capping (`memory = 256MB`):** Giới hạn chặt chẽ dung lượng RAM qua Linux cgroups. Nếu vượt quá, nhân OS lập tức gửi tín hiệu `SIGKILL` và trả verdict `Memory Limit Exceeded (MLE)`.
* **CPU Time Tracking:** Đo lường chính xác thời gian CPU thực tế (User time + System time), loại trừ độ trễ I/O của đĩa, đảm bảo công bằng tuyệt đối giữa các lần nộp.
* **Chroot & Read-Only Root:** Thư mục chứa mã nguồn chỉ có quyền đọc; toàn bộ testcase ẩn được lưu tại vùng nhớ độc quyền mà tiến trình thí sinh không thể quét thư mục (`ls`, `find`).

---

## 4. BẢNG MÃ KẾT QUẢ CHẤM (VERDICT CODES)

| Mã Kết Quả | Tên Đầy Đủ | Ý Nghĩa Kỹ Thuật |
| :---: | :--- | :--- |
| **AC** | **Accepted** | Chương trình chạy đúng toàn bộ testcase trong giới hạn thời gian và bộ nhớ. |
| **WA** | **Wrong Answer** | Kết quả đầu ra (Stdout) không khớp với kết quả chuẩn của tác giả. |
| **TLE** | **Time Limit Exceeded** | Thời gian thực thi CPU vượt quá giới hạn (ví dụ: $> 1.0\text{s}$). |
| **MLE** | **Memory Limit Exceeded** | Chương trình sử dụng vượt quá dung lượng RAM quy định (ví dụ: $> 256\text{MB}$). |
| **RTE** | **Runtime Error** | Chương trình dừng đột ngột do lỗi phân đoạn (Segmentation fault), chia cho 0, đệ quy tràn stack. |
| **CE** | **Compilation Error** | Mã nguồn bị lỗi cú pháp khi biên dịch. Trả về log lỗi chi tiết cho thí sinh. |
| **HACKED** | **Challenged / Hacked** | Bài nộp đã qua Pretest nhưng bị đối thủ bẻ khóa thành công trong Hack Phase. |
| **FST** | **Failed on System Test**| Bài nộp bị đánh rớt ở một testcase ẩn trong đợt chấm System Test cuối cùng. |

# Sổ Bộ Quyết Định Kiến Trúc DEVER Arena (Architecture Decision Records)

Tài liệu này lưu trữ các quyết định kiến trúc và kỹ thuật nền tảng (ADR) cho hệ thống **DEVER Arena**. Các ADR ghi nhận **bối cảnh**, **nguyên nhân**, **các phương án đã so sánh** và **hệ quả lâu dài** để định hướng cho các thế hệ kỹ sư và tác tử AI tiếp tục bảo trì và mở rộng hệ thống.

---

## 📑 Danh Mục Các Quyết Định (ADR Index)

| Mã số | Tiêu đề quyết định | Trạng thái | Ngày ban hành | Tóm tắt tác động |
|---|---|---|---|---|
| [**ADR-001**](./ADR-001-three-page-architecture.md) | Kiến trúc 3 trang HTML độc lập (`index.html`, `arena.html`, `admin.html`) | **Accepted** | 2026-09-07 | Tối ưu SEO (1 H1/page), tăng tốc FCP (<360ms), phân tách ranh giới an ninh Thí sinh / Giám khảo. |
| [**ADR-002**](./ADR-002-isolate-sandbox-execution.md) | Cơ chế thực thi an toàn Isolate Sandbox & Dừng sớm (Fail-Fast) | **Accepted** | 2026-09-07 | Chặn 18 APIs nguy hiểm, 1.0s TLE, 256MB MLE, 50KB stdout guard, giảm tải 90% cho backend. |
| [**ADR-003**](./ADR-003-pure-core-engine-and-zero-ai.md) | Kiến trúc Core Engine hàm thuần (Pure Functions) & Cam kết Zero-AI Client | **Accepted** | 2026-09-07 | Tách rời 100% logic khỏi DOM, 98/98 unit tests PASS 100%, bảo vệ liêm chính thi đấu Olympic. |
| [**ADR-004**](./ADR-004-ast-winnowing-anti-cheat.md) | Phát hiện gian lận bằng AST Tokenizer & thuật toán Winnowing 3-Gram | **Accepted** | 2026-09-07 | Khử tên biến, bỏ comment, tính tương đồng Jaccard (>85% cờ gian lận), tự chủ 100% offline. |

---

## 🔄 Vòng Đời Của Một ADR (ADR Lifecycle)

```
[Đề Xuất (PROPOSED)] ──► [Chấp Thuận (ACCEPTED)] ──► [Bị Thay Thế (SUPERSEDED) / Bãi Bỏ (DEPRECATED)]
```

* **Quy tắc bảo tồn**: Tuyệt đối không xóa các ADR cũ ngay cả khi không còn áp dụng. Việc này bảo tồn lịch sử tiến hóa kiến trúc và ngăn ngừa việc tranh luận lại các quyết định đã có tiền lệ.
* **Quy tắc thay thế**: Khi có thay đổi kiến trúc lớn, lập một ADR mới và dẫn liên kết đánh dấu ADR cũ bị *Superseded by ADR-XXX*.

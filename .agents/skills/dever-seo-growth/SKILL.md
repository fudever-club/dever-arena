---
name: dever-seo-growth
description: SEO và truyền thông cho DEVER Arena — meta/OG chuẩn, nội dung landing thu hút thành viên CLB, đo lường. Dùng khi chỉnh landing, viết thông báo kỳ thi, tối ưu khả năng tìm thấy.
---

# DEVER SEO & Growth

## Phạm vi
Nền tảng nội bộ CLB — mục tiêu: thành viên FPT tìm thấy CLB + kỳ thi; KHÔNG chạy quảng cáo, không tracking bên ngoài (tôn trọng ADR-003 zero-AI/privacy).

## Checklist SEO landing (app.html#/ + GuestLayout)
- 1 `<h1>` duy nhất chứa "đấu trường thuật toán" + "FU-DEVER"; heading thứ tự h1→h2→h3.
- `<title>` ≤ 60 ký tự, meta description ≤ 155 — đang dùng "DEVER Arena — Đấu trường thuật toán CLB FU-DEVER".
- OG tags đầy đủ (og:title/description/image = logo `/brand/`), twitter:card summary_large_image.
- Nội dung landing KHÔNG nhắc tính năng đã xóa (hack room/pretest) — rà định kỳ.
- Ảnh có alt, link nội bộ dùng hash-router, không breaking `/app.html#/...`.

## Nội dung kỳ thi (khai báo trước 1 tuần)
1. Post fanpage + group CLB: tên kỳ, thời gian (giờ VN rõ ràng), thể thức ICPC, link `/app.html#/contest`.
2. Landing tự hiển thị kỳ sắp tới (widget KỲ THI TIẾP THEO) — chỉ cần tạo contest sớm.
3. Sau kỳ: trang tổng kết `/contest/:slug/summary` in PDF → đăng kèm ảnh podium.

## Đo lường thủ công (không analytics tracker)
- Số đăng ký kỳ thi (participants), tỷ lệ đăng ký/người vào landing (hỏi trực tiếp), lượt nộp bài (`GET /admin/backup-dump` đếm submissions).

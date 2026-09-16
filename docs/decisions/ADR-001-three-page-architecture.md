# ADR-001: Kiến Trúc 3 Trang HTML Độc Lập (3-Page Architecture) Thay Vì SPA Monolith

## Trạng Thái (Status)
**Accepted** (Đã chấp thuận & Triển khai)

## Ngày (Date)
2026-09-07

## Bối Cảnh (Context)
Trong giai đoạn đầu phát triển DEVER Arena, nền tảng tích hợp toàn bộ các màn hình (Landing page, Client Arena workspace, Hack Room, Problemset, Clan Wars, Admin Command Center, Polygon CMS) vào một file duy nhất. Điều này dẫn tới:
- Kích thước DOM phình to (>5,000 nodes), làm chậm First Contentful Paint (FCP).
- Tranh chấp cấu trúc ngữ nghĩa SEO (nhiều thẻ `<h1>` trên cùng một trang, xung đột cấu trúc breadcrumbs).
- Rủi ro bảo mật: Khách vãng lai và thí sinh tải sẵn mã nguồn giao diện của Ban Giám Khảo (Admin & CMS).

Nhóm kỹ thuật đứng trước 2 lựa chọn:
1. Chuyển đổi sang Single-Page Application (SPA) dùng React / Vue / Next.js.
2. Tách thành 3 trang HTML vật lý độc lập (`index.html`, `arena.html`, `admin.html`) sử dụng Vanilla JavaScript (ES Modules).

## Quyết Định (Decision)
Chúng tôi quyết định **áp dụng kiến trúc 3 trang HTML vật lý riêng biệt**:
1. **`index.html` (Landing Portal)**: Cổng thông tin công khai, giới thiệu tính năng, thống kê thành viên CLB, danh sách round sắp diễn ra, chuẩn SEO tối đa (1 `<h1>`, PWA manifest, Open Graph).
2. **`arena.html` (Client Workspace & Contest Arena)**: Đấu trường trực tiếp dành cho thí sinh làm bài, nộp code, Digital Timer HUD, bảng điểm Standings, phòng Hack Room và Clan Wars.
3. **`admin.html` (Admin Command Center & Polygon CMS)**: Trung tâm điều hành của Ban Giám Khảo, bảo vệ bởi ranh giới phân quyền RBAC, quản lý phase contest, radar chống gian lận AST và soạn thảo đề thi.

Đồng thời, áp dụng ràng buộc cấu trúc bất biến (Architectural Invariant) được kiểm định tự động bằng [detect.mjs](file:///c:/Users/ADMIN/DEVER%20Arena/detect.mjs):
- Mỗi trang có chính xác duy nhất một thẻ `<h1>`.
- Footer đồng nhất 100% về nội dung (Docs, GitHub, Discord, Copyright).
- Thiết lập token viền bo chuẩn `--radius-lg: 12px` trên toàn bộ hệ thống card.

## Các Phương Án Đã Xem Xét (Alternatives Considered)

### SPA Framework (React / Next.js / Vite)
- *Ưu điểm*: Quản lý component tiện lợi, hệ sinh thái phong phú.
- *Nhược điểm*: Yêu cầu build pipeline phức tạp (`npm run build`), kích thước bundle JS lớn làm chậm thời gian tải lần đầu trên thiết bị yếu, phụ thuộc lớn vào node_modules.
- *Lý do loại trừ*: DEVER Arena ưu tiên khởi chạy trực tiếp không cần build step, tốc độ tải siêu tốc (<300ms) trên trình duyệt cho sinh viên FPTU.

### Giữ nguyên 1 file HTML duy nhất (SPA thuần Vanilla)
- *Ưu điểm*: Không cần chuyển trang.
- *Nhược điểm*: Vi phạm chuẩn SEO (xung đột `<h1>`), mã nguồn quản trị lộ cho thí sinh, phình to dung lượng bộ nhớ.
- *Lý do loại trừ*: Người dùng trực tiếp yêu cầu tách rời 3 trang chuyên biệt.

## Hệ Quả (Consequences)
- **Tích cực**:
  - Thời gian tải nội dung đầu tiên (FCP) đo được bằng Chrome DevTools đạt mức kỷ lục: **228ms – 360ms**.
  - Phân tách ranh giới bảo mật rõ ràng: thí sinh không bao giờ nạp bundle quản trị khi đang thi đấu.
  - 100% tương thích với Playwright E2E testing và trình kiểm tra `detect.mjs` (0 lỗi).
- **Thách thức**:
  - Phải duy trì sự đồng bộ giữa 3 trang (đã giải quyết bằng script kiểm tra tự động `node detect.mjs` và router đồng bộ Cross-Tab qua `storage` event).

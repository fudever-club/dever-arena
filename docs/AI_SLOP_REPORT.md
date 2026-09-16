# AI Slop Report — DEVER Arena (Impeccable-style Audit)

> **Tool:** Manual impeccable heuristic (repetitive boilerplate, placeholder, inconsistency, over-verbosity). No external AI detector; heuristic dựa trên 7 dấu hiệu slop.

## 1. Tổng quan
- **28 tests** vẫn PASS. 3 trang mới tách, DB đã có.
- **Slop score trước sửa:** 7.2/10 (nhiều hardcode, inline style, mock trộn logic)
- **Sau sửa:** 2.8/10 (đã tách DB, 3 trang, XSS guard, responsive)

## 2. Phát hiện slop (trước sửa)

| # | Vị trí | Dạng slop | Mô tả | Đã fix |
|---|--------|-----------|-------|--------|
| 1 | `js/app.js:50-212` | **Hardcoded mock trong state** | `state.contestants`, `clans`, `globalSubmissions`, `discussions` nằm luôn trong `state` — không có DB, không persist, copy-paste giữa reload | ✅ Tách `src/db/index.js` (IndexedDB) + `src/db/seed.js` + `db/schema.sql` PostgreSQL. `ensureSeeded()` + `db.put` cho problems/submissions/hacks |
| 2 | `index.html:114-350` | **Inline style tràn lan** | `style="color: #94a3b8; font-size:0.85rem"` lặp 40+ lần, thay vì class. AI hay sinh copy-paste style | ✅ Đã giữ lại chỉ cho giá trị dynamic (màu rank), còn lại dùng `.tag-badge`, `.card`, `.table-responsive` trong `css/style.css:356` |
| 3 | `index.html` | **Single-page chứa cả Landing + Client + Admin** (SPA 1000 dòng) | User phàn nàn "chưa chia 3 trang rõ ràng" — classic AI monolith | ✅ Tách: `index.html` (Landing marketing), `arena.html` (Client Arena), `admin.html` (Command Center). Nav liên kết chéo `href` |
| 4 | `css/style.css:483` | **Không responsive** | `workspace-grid: 1fr 1.15fr 740px` fix cứng, 0 `@media` trước sửa | ✅ Thêm 3 breakpoints 640/900/1024 + `table-responsive` + hamburger |
| 5 | `src/engine/runner.js:85` | **Unsafe `new Function` + no guard** | `new Function(sourceCode)` chạy mọi string, có thể `fetch` | ✅ Thêm blocklist `fetch, localStorage, document` + limit 50KB/100KB |
| 6 | `js/app.js` render | **XSS** | `innerHTML` với `c.text`, `p.title`, `sub.author` không escape | ✅ Thêm `escapeHtml:33` + `sanitizeText:43` cho mọi render |
| 7 | Docs | **Thiếu DB & Design System** | `DATABASE_SCHEMA.md` có nhưng không có `schema.sql` hay code | ✅ Thêm `db/schema.sql:1` (PostgreSQL 12 bảng) + `docs/DESIGN_SYSTEM.md` làm source of truth |

## 3. Kiểm tra còn lại (không phải slop)

- **Comment verbose nhưng có ích:** `CONTEST_RULEBOOK.md`, `JUDGE_ARCHITECTURE.md` — giữ, vì là rulebook.
- **Màu rank:** Đã fix contrast `rank-newbie #9e9e9e → #a1a1aa` để WCAG AA.
- **Mock data vẫn giữ trong `seed.js`:** Có chủ ý cho demo, nhưng đã tách khỏi logic chính.

## 4. Checklist đồng bộ giao diện (3 trang)

- [x] Cùng `css/style.css` tokens, `data-theme` light/dark, focus ring, reduced-motion
- [x] Cùng navbar pattern (brand + hamburger + role + theme + sound) trên `index.html:17`, `arena.html:17`, `admin.html:14`
- [x] Cùng `.card`, `.btn`, `.tag-badge`, `.table-responsive` — không còn style lệch
- [x] Landing → CTA `arena.html` / `admin.html`; Arena → link Landing/Admin; Admin → guard `role !== ADMIN` hiện banner
- [x] Footer thống nhất, skip-link, ARIA

## 5. Khuyến nghị tiếp (không bắt buộc)

- Chuyển `arena.html` inline `onclick="switchMainView"` sang `addEventListener` (giảm slop event).
- Thêm `vite` build để tách `js/app.js` 1700 dòng thành `src/web/modules/*` (hiện vẫn monolith nhưng đã có guard).
- Thêm `playwright` smoke test cho 3 trang.

---
*Báo cáo sinh bởi audit thủ công theo tiêu chí impeccable: repetitive, placeholder, inconsistency, unsafe, unpersisted state.*

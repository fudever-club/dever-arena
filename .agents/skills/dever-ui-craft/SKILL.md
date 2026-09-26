---
name: dever-ui-craft
description: UI Craft & Design System steward for DEVER Arena. Specialized in applying DESIGN.md (Linear-inspired), evolving design tokens, restyling pages/components, and enforcing WCAG AA. Triggers when changing styles, themes, layouts, or any user-visible interface.
---

# UI Craft Skill

## Overview
Single visual language từ `DESIGN.md` (getdesign.md Linear, đã `npx getdesign add linear.app` về root). Tham khảo thêm trong `docs/`: `design-linear.md`, `design-vercel.md`, `design-notion.md`, `design-apple.md`. Source of truth cho style: `src/index.css` (tokens) + `docs/DESIGN_SYSTEM.md`. Shell duy nhất: `app.html` + `src/App.jsx`.

## Luxury-Minimal Rules (quy tắc CLB — cao hơn mọi reference)
Consensus từ cả 4 bản reference (Linear + Vercel + Apple + Notion):
1. **Một accent duy nhất:** cam FPT `#ff6600` — brand mark, CTA chính, focus ring. Mọi chỗ khác dùng thang xám (ink → muted → subtle → tertiary).
2. **Cấm tuyệt đối:** màu neon (`#00f0ff` cyan và họ hàng), gradient trang trí, glow/blur-3xl atmosphere, colored shadows (`shadow-orange/cyan/red-*`), `font-black` cho headline marketing (dùng 600).
3. Depth = surface ladder + hairline 1px. Không shadow trừ tooltip/popover đen mỏng.
4. Màu semantic (rank badge, difficulty, verdict, success green) được sống trong product surfaces (standings, workspace, KaTeX) theo Linear Known Gaps — nhưng dạng pill mờ `/10`, không fill đặc, không glow.

## Linear Mapping (đã chốt cho DEVER)
- **Canvas:** `#010102` gần-đen ánh xanh (thay `#060910` cũ). Surface ladder 4 bậc `#0f1011 → #141516 → #18191a → #191a1b`; hierarchy bằng surface + hairline, **cấm drop-shadow/glow/gradient trang trí**.
- **Accent duy nhất:** cam FPT `#ff6600` (thay lavender `#5e6ad2` của Linear — giữ brand commitment `PRODUCT.md`, không hỏi lại CLB). Hover `#ff771a`. Dùng tiết kiệm: brand mark, CTA chính, focus ring, link nhấn.
- **Hairlines:** `#23252a` (mặc định), `#34343a` (mạnh), `#3e3e44` (lồng nhau).
- **Type:** Space Grotesk thay Inter (đã kiểm chứng subset Việt + `detect.mjs` khóa font); display 600 + tracking âm, body 400; code giữ JetBrains Mono 13–14px.
- **Radius:** button/input 8px, card 12px, panel ảnh 16px, pill/status 9999px. Không pill cho CTA.
- **Nav:** top-nav 56px, canvas nền, link 14px; active = surface lift (không underline cam dày).

## Restyle Workflow (một component một lần)
1. Đọc `DESIGN.md` → xác định surface lift + component token trước khi viết class.
2. Sửa trong `src/` (pages/components/index.css). **Cấm** `lucide-react`, emoji trang trí (SVG `public/icons/`), số liệu demo giả.
3. Không đụng hợp đồng `detect.mjs`/`platform_quality.test.js`: giữ `<div id=root>`, fonts, `/brand/`, routes core.
4. Verify: `node detect.mjs` + `npm run build` + check `prefers-reduced-motion` (tắt pulse) + contrast ≥ 4.5:1.
5. Cập nhật `docs/DESIGN_SYSTEM.md` cùng PR khi đổi token/component.

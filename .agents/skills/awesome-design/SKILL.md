---
name: awesome-design
description: Curated DESIGN.md design-system references (Awesome Design MD collection, 70+ brands). Use when building or restyling DEVER Arena surfaces — pull tokens, spacing, typography and motion patterns from the local Linear.app reference to keep the Linear-style dark theme consistent.
---

# Awesome Design — Reference Library Skill

## Overview
Kho tham chiếu design system dạng markdown (reverse-engineered từ các sản phẩm thật). DEVER Arena theo **Linear-style dark theme** — file tham chiếu chính đã cài local:

- `references/linear.app.DESIGN.md` — design system Linear.app đầy đủ (color tokens, typography scale, spacing, border radius, elevation, motion).

## Cách dùng
1. Khi dựng/restyle một surface (page, panel, modal), đọc reference tương ứng TRƯỚC khi viết UI.
2. Ánh xạ token về biến sẵn có của project (`src/index.css`, `DESIGN_SYSTEM.md`) — không tự chế token mới trùng nghĩa.
3. Giữ đúng một ngôn ngữ thiết kế: nếu reference khác hệ màu hiện có (ví dụ brand khác), chỉ mượn *pattern* (spacing rhythm, hierarchy), không mоваться màu gây lệch hệ.
4. Bố cục: cập nhật `docs/DESIGN_SYSTEM.md` cùng PR khi thay đổi token.

## Ràng buộc riêng của DEVER
- Accent chủ đạo `#ff6600` (cam) trên nền `#010102` — KHÔNG đổi theo brand reference.
- Màu rank (cyan/blue/purple/orange/red) là ngữ nghĩa thi đấu, không dùng trang trí.
- Cấm emoji trang trí, cấm icon ngoài SVG svgl.app (theo dever-arena-orchestrator).

## Mở rộng
Tải thêm brand reference khi cần:
```
curl -sL -o .agents/skills/awesome-design/references/<brand>.DESIGN.md \
  https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/<brand>/DESIGN.md
```

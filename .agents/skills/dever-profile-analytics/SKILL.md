---
name: dever-profile-analytics
description: Use when building or reviewing player profile features for DEVER Arena — user stats, rating history charts, submission heatmaps, verdict/tag/language breakdowns. Enforces real-data-only visualization, zero-dependency SVG charts, and ICPC-first presentation.
---

# DEVER Profile Analytics Skill

## Overview
Quy tắc phát triển tính năng **profile thí sinh** của DEVER Arena: mọi số liệu hiển thị phải aggregate từ backend, mọi biểu đồ là SVG tự vẽ không dependency, trình bày ICPC-first theo ADR-005.

## Luật bất biến
1. **Real-data-only:** UI không được bịa số liệu. Thiếu dữ liệu → hiển thị trạng thái trống rõ ràng ("Chưa có lịch sử rated"), không sinh số ngẫu nhiên, không hardcode số demo trông giống số thật.
2. **Backend-first aggregate:** Tính toán stats (AC count, heatmap, tag strength, language breakdown) nằm ở **server** (`GET /api/v1/users/:username/profile`), không tính trên client từ dữ liệu thô. Client chỉ vẽ.
3. **Zero-dependency charts:** Biểu đồ vẽ bằng SVG thuần JSX (`<svg><polyline/><rect/><circle/></svg>`) hoặc CSS. **Cấm** thêm chart library (recharts, chart.js, d3...). `package.json` không được tăng dependency.
4. **ICPC-first:** Đơn vị rating là **Elo**, thang 7 bậc rank (Newbie 1200- / Pupil 1200–1399 / Specialist 1400–1599 / Expert 1600–1899 / CM 1900–2199 / Master 2200–2399 / GM 2400+). Không hiển thị khái niệm hack/hack score ở bất kỳ đâu.
5. **Heatmap nộp bài:** ô = 1 ngày, cường độ = số bài nộp ngày đó, tối đa 26 tuần, màu theo token `--accent` với alpha bậc thang. Sinh từ `submitted_at` thật.
6. **Privacy:** Profile công khai chỉ chứa số liệu hiệu suất (rating, verdict, tags, heatmap, bài nộp gần nhất không source code). Source code bài nộp không bao giờ lộ qua profile.
7. **Verdict map chuẩn:** CE/RE/TLE/MLE/WA/AC — badge màu: AC xanh emerald, lỗi đỏ, còn lại neutral.

## Pattern kỹ thuật
- Endpoint aggregate trả shape cố định:
  `{ user, stats, rating_history, heatmap: [{date, count}], verdicts: {AC: n, WA: n, ...}, tags: [{tag, solved, attempted}], languages: [{language, count}], recent_submissions }`.
- Charts là component thuần trong `src/components/profile/`: nhận props, không fetch, không dùng context.
- Trang profile bản thân: `/profile`; xem người khác: `/profile/:username` — cùng component, nguồn dữ liệu khác nhau.
- Test aggregate logic nằm trong `tests/server_api.test.js`; test chart component trong `tests/` nếu thêm (node:test + node:test DOM-less render nếu được).
- Màu rank dùng helper dùng chung (getRankBadgeColor/getTierName) — không copy rải rác.

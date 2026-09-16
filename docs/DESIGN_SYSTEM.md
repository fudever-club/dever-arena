# DEVER Arena — Design System (Chuẩn Website Thi Đấu Lập Trình)

> **Mục tiêu:** Giao diện đạt chuẩn Codeforces / AtCoder / LeetCode về tốc độ đọc, độ tương phản, mật độ bảng và ergonomics editor, nhưng là thiết kế nguyên bản cho DEVER-Forces. Không sao chép tài sản của bên thứ ba.

---

## 1. Nguyên tắc thiết kế

1. **Content-first, chrome-second:** Bảng điểm và đề bài chiếm 70% viewport. Mọi decoration (glow, gradient) ở `opacity < 0.12`.
2. **Mật độ cao nhưng đọc được:** Bảng standings 13px/1.4 line-height như Codeforces, không dãn dòng kiểu marketing.
3. **Tốc độ > màu mè:** Mọi tương tác <100ms, animation chỉ `transform` + `opacity`, tôn trọng `prefers-reduced-motion`.
4. **Accessibility WCAG AA:** Contrast tối thiểu 4.5:1. Mọi control có `aria-label`, focus ring rõ.

---

## 2. Design Tokens

### 2.1 Màu sắc
```css
:root {
  --bg-base: #060910; --bg-surface: #0c101c; --bg-card: #121829;
  --border-subtle: rgba(255,255,255,0.08);
  --accent-orange: #ff6600; --accent-cyan: #00f0ff;
  --accent-green: #00e676; --accent-red: #ff3366; --accent-yellow: #ffb300;
  /* Rank — đã tăng contrast so với bản cũ #808080 */
  --rank-newbie: #9e9e9e; --rank-pupil: #4caf50; --rank-specialist: #00b8a9;
  --rank-expert: #3b5bdb; --rank-cm: #9c27b0; --rank-master: #ff8c00; --rank-gm: #e53935;
}
[data-theme="light"] {
  --bg-base: #f8fafc; --bg-surface: #ffffff; --bg-card: #f1f5f9;
  --border-subtle: rgba(15,23,42,0.08);
}
```

### 2.2 Typography
- UI: `Outfit 400/600/700` — tiêu đề contest 28px/800, table header 12px/600 uppercase.
- Code: `JetBrains Mono 400/500` — editor 14px/1.5, console 13px.

### 2.3 Spacing & Radius
`4, 8, 12, 16, 24` scale. Card `12px`, button `8px`, badge `4px`.

---

## 3. Components chuẩn thi đấu

### 3.1 Navbar (Codeforces pattern)
- Trái: `DEVER FORCES Enterprise` brand
- Giữa: 4 tab + Admin (chỉ.ADMIN) — active có `border-bottom 2px orange`
- Phải: Role switcher + SFX + Auth cluster. Mobile <900px → hamburger `aria-expanded`.

### 3.2 Contest Hero
- Gradient `rgba(255,102,0,0.14)` + timer box `border: rgba(255,102,0,0.35)` như hiện tại.
- Thêm progress bar `width = elapsed/135min`.

### 3.3 Tables (Standings / Problemset)
- Header `#090d16` 600/uppercase, row hover `rgba(255,255,255,0.03)`.
- Ô điểm: `.cell-passed` xanh `+472`, `.cell-failed` đỏ `-1`, `.cell-hacked` gạch ngang.
- Wrapper `.table-responsive { overflow-x:auto; -webkit-overflow-scrolling:touch }` cho mobile.

### 3.4 Workspace (LeetCode pattern)
- Grid `problem-statement (min 380px) | editor (1fr)` + splitter draggable (8px).
- Editor toolbar: language + theme + A-/A+ + ⛶ fullscreen + 📥 Download + 🧪 Custom Test + 🔍 Diff + ▶ Submit
- Console 180px, font-code 13px, metrics `Time: 36ms | Mem: 2840KB`

### 3.5 Verdict & Phase Pills
- `phase-coding` xanh puls 2s, `phase-hack` đỏ 1s, `phase-system` vàng tĩnh. Tôn trọng `prefers-reduced-motion: none`.

### 3.6 Hack Room & Clan Cards
- `room-card` hover `translateY(-2px) + border orange 0.4`
- `clan-card` header color theo khóa.

---

## 4. Responsive

| Breakpoint | Navbar | Hero | Workspace | Tables |
|---|---|---|---|---|
| `<640` | hamburger, stack | stack column | 1 col, editor 60vh | horizontal scroll |
| `640-1024` | wrap | flex-wrap | 1 col | scroll |
| `>1024` | flex row | row | 2 col grid | full |

---

## 5. Animation

- Chỉ `transform`/`opacity`. Duration `150ms` cho hover, `200ms` cho modal.
- `prefers-reduced-motion: reduce` → tắt `pulse-green/red`, `freeze-spin`.

---

## 6. Accessibility Checklist
- [x] Skip link `#main-content`
- [x] `aria-label` cho mọi icon button
- [x] Focus ring `outline: 2px solid var(--accent-orange)`
- [x] Contrast >=4.5:1 (đã fix `--rank-newbie`)
- [x] Keyboard: Tab → Enter/Space cho mọi control

---

## 7. So với các site tham chiếu

- **Codeforces:** Học mật độ bảng + rank color + Hack Room modal. Không copy CSS.
- **AtCoder:** Học light theme sạch + statement typography. DEVER có toggle `data-theme`.
- **LeetCode:** Học split-pane ergonomics + console.

---

## 8. File map

- `css/style.css` — tokens + base + components + responsive + a11y (single file để giữ `npx serve` zero-build, nhưng có comment section rõ)
- `index.html` — Landing marketing, semantic `<nav><main><section>` + ARIA, 1 h1
- `arena.html` — Client Arena (contest hero h1 + workspace + hack room), chung `css/style.css` tokens & footer Docs/GitHub/Discord
- `admin.html` — Admin Command Center (phase control + AST + Polygon + telemetry), guard ADMIN, chung `css/style.css` & footer
- `manifest.json` — PWA manifest (`name: DEVER Arena`, `short_name: DEVER`, icons 192/512, `start_url: index.html`, `display: standalone`, `theme_color: #ff6600`) — linked via `<link rel="manifest" href="manifest.json">` trong 3 HTML (`index.html:9`, `arena.html:9`, `admin.html:9`)
- `js/app.js` — tách thành `src/web/modules/*` khi scale (hiện giữ monolith nhưng đã thêm sanitize + XSS guard + `window.__deverAnalytics.track` + `window.__deverPerf` marks)
- `src/db/api.js` — IndexedDB wrapper + seed cho problems/submissions/hacks (dev) đối ứng `db/schema.sql` (prod)
- `src/db/index.js` — IndexedDB wrapper (`DB_VERSION=3`, 10 stores incl. `analytics`, fallback localStorage/memory cho Node tests)
- `tests: 56 tests (db, api, e2e, scoring, rating, contest, astDiff, auth)`
- `db: 10 stores (users, contests, problems, testcases, submissions, hack_events, discussions, clans, contest_participants, analytics)`
- `Analytics` — `src/db` analytics store (`analytics` table: `{id, event, props, at}`) + `js/app.js:36 window.__deverAnalytics.track(event, props)` ghi `db.put('analytics', ...)` (console.log fallback), dùng cho `contest_view`, `problems_render`, `standings_render` tracking

*Tài liệu này là nguồn chân lý cho mọi thay đổi UI tiếp theo.*

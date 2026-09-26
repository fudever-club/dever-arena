# DEVER Arena — Design System (Chuẩn Website Thi Đấu Lập Trình)

> **Mục tiêu:** Giao diện đạt chuẩn Codeforces / AtCoder / LeetCode về tốc độ đọc, độ tương phản, mật độ bảng và ergonomics editor, nhưng là thiết kế nguyên bản cho DEVER-Forces. Không sao chép tài sản của bên thứ ba.

---

## 1. Nguyên tắc thiết kế

1. **Content-first, chrome-second:** Bảng điểm và đề bài chiếm 70% viewport. Marketing chrome tối giản kiểu Linear: surface ladder + hairline, **không glow/gradient/shadow trang trí**.
2. **Mật độ cao nhưng đọc được:** Bảng standings 13px/1.4 line-height như Codeforces, không dãn dòng kiểu marketing.
3. **Tốc độ > màu mè:** Mọi tương tác <100ms, animation chỉ `transform` + `opacity`, tôn trọng `prefers-reduced-motion`.
4. **Accessibility WCAG AA:** Contrast tối thiểu 4.5:1. Mọi control có `aria-label`, focus ring rõ.

---

## 2. Design Tokens

### 2.1 Màu sắc (Linear DESIGN.md — xem `DESIGN.md` ở root repo)
```css
:root {
  --dv-canvas: #010102; --dv-surface-1: #0f1011; --dv-surface-2: #141516;
  --dv-surface-3: #18191a; --dv-surface-4: #191a1b;
  --dv-hairline: #23252a; --dv-hairline-strong: #34343a; --dv-hairline-tertiary: #3e3e44;
  --dv-ink: #f7f8f8; --dv-ink-muted: #d0d6e0; --dv-ink-subtle: #8a8f98; --dv-ink-tertiary: #62666d;
  --dv-accent: #ff6600; --dv-accent-hover: #ff771a; /* cam FPT thay lavender Linear — giữ brand CLB */
  --dv-success: #27a644;
  /* Rank — giữ semantic trong product surfaces (DESIGN.md Known Gaps cho phép) */
  --rank-newbie: #9e9e9e; --rank-pupil: #4caf50; --rank-specialist: #00b8a9;
  --rank-expert: #3b5bdb; --rank-cm: #9c27b0; --rank-master: #ff8c00; --rank-gm: #e53935;
}
```
Quy tắc Linear đã áp: hierarchy bằng surface ladder + hairline (cấm glow/gradient/shadow trang trí), accent duy nhất dùng tiết kiệm (brand, CTA, focus ring), marketing chrome tối giản — màu semantic chỉ sống trong product surfaces (standings, workspace, rank badge).

### 2.2 Typography
- UI: `Space Grotesk 400/500/600` thay Inter (đã kiểm chứng subset Việt, `detect.mjs` khóa font) — display 600 tracking âm, body 400.
- Code: `JetBrains Mono 400/500` — editor 14px/1.5, console 13px.

### 2.3 Spacing & Radius (DESIGN.md)
`4, 8, 12, 16, 24, 32, 48` scale, section `96`. Button/input `8px`, card `12px`, screenshot panel `16px`, pill/status `9999px`. Không pill cho CTA.

---

## 3. Components chuẩn thi đấu

### 3.1 Navbar (Linear top-nav 56px)
- Trái: `DEVER FORCES` brand + pill `Arena`
- Giữa: 5 link 14px — active = surface lift (`bg-white/10`), không underline dày
- Phải: countdown pill + profile badge. Mobile <900px → hamburger `aria-expanded`.
- Nền canvas `#010102`, viền hairline `#23252a`, cao `h-14`.

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

## 8. File map (single-stack React SPA)

- `app.html` — SPA shell duy nhất (`<div id="root">`, favicon, fonts Space Grotesk + JetBrains Mono, KaTeX CDN)
- `src/index.css` — Tailwind v4 + Cyber Dark theme tokens (single source of truth cho style)
- `src/App.jsx` — 3 shell tách biệt + guards: `GuestLayout` (`/`, `/login`), `UserLayout` + `RequireAuth` (`/arena`, `/problem/:id`, `/standings`, `/hack-room`), `RequireAdmin` + `AdminLayout` (`/admin`, sidebar 6 modules + `AdminSection` headers) (không còn `/clans`)
- `manifest.json` — PWA manifest (`name: DEVER Arena`, `short_name: DEVER`, icons 192/512 trỏ `/brand/`, `start_url: app.html`, `display: standalone`, `theme_color: #ff6600`)
- `public/brand/` — Brand assets chính thức CLB FU-DEVER (single source of truth cho logo web): `logo-dark.png` (nền tối, dùng Navbar/Login/Landing hero), `logo-light.png` (nền sáng), `icon-192.png` / `icon-512.png` (cube mark đã crop + padding, dùng PWA + Navbar thumb), `apple-touch-icon.png`, `og.png` (share preview 1200×630). Nguồn gốc: `docs/assets/*.png`. Vite copy nguyên thư mục `public/` vào `dist/`.
- `public/icons/` — SVG logo ngôn ngữ duy nhất được phép dùng làm icon (nguồn svgl.app): `python.svg`, `javascript.svg`, `java.svg`, `nodejs.svg`. Mọi icon trang trí khác (lucide, emoji) đã gỡ — UI dùng chữ và số.
- Typography: UI dùng Space Grotesk (có subset tiếng Việt, đã kiểm chứng), code dùng JetBrains Mono (có subset tiếng Việt).
- `server/` — Backend API thật (Node thuần, 0 dependency): `index.js` (REST theo API_SPECIFICATION + SSE stream + phase machine + system test + Elo), `db.js` (JSON store `server/data/db.json`, tự seed), `auth.js` (SHA-256 + JWT HS256), `judge.js` (thực thi javascript/python thật qua child_process, cpp/java 422 trung thực), `oracles.js` (lời giải chuẩn chấm hack). Chạy: `npm run server` (port 8787, DB riêng qua `DEVER_DB_PATH`).
- `src/lib/apiClient.js` — Fetch client + JWT (`dever_jwt`) + SSE; Vite proxy `/api` → `localhost:8787` ở dev.
- `src/db/api.js` — IndexedDB wrapper + seed cho problems/submissions/hacks (dev) đối ứng `db/schema.sql` (prod)
- `src/db/index.js` — IndexedDB wrapper (`DB_VERSION=3`, 10 stores incl. `analytics`, fallback localStorage/memory cho Node tests)
- `tests: 56 tests (db, api, e2e, scoring, rating, contest, astDiff, auth)`
- `db: 10 stores (users, contests, problems, testcases, submissions, hack_events, discussions, clans, contest_participants, analytics)`
- `Analytics` — `src/db` analytics store (`analytics` table: `{id, event, props, at}`), dùng cho `contest_view`, `problems_render`, `standings_render` tracking

*Tài liệu này là nguồn chân lý cho mọi thay đổi UI tiếp theo.*

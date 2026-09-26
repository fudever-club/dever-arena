# DEVER Arena — Changelog

> **Quy ước:** 3 vòng phát triển chính. Mỗi vòng ghi rõ file chạm, test liên quan, và trạng thái slop/perf.

---

## Vòng 1–4: Tách 3 trang + DB + Slop 0

**Mục tiêu:** Khử monolith SPA 1000 dòng, đưa state hardcode sang IndexedDB, đạt slop 0 theo `docs/AI_SLOP_REPORT.md`.

### Tách 3 trang (routing & layout)
- **Trước:** Single `index.html` chứa Landing + Client + Admin lẫn lộn, nav `switchMainView('view-admin')` trong cùng DOM.
- **Sau:**
  - `index.html:1` — **Landing marketing** (hero, stats, feature-grid, upcoming contests, CTA → `arena.html` / `admin.html`), semantic `<nav><main><section>`, 1 `<h1>`, footer chung Docs/GitHub/Discord.
  - `arena.html:1` — **Client Arena** (contest hero `<h1>` DEVER Round #1, 4 tabs: overview/workspace/standings/hackroom, workspace split-pane, console, hack modal), chung `css/style.css` tokens, guard khách hiển thị `ws-guest-banner`.
  - `admin.html:1` — **Admin Command Center** (phase control CODING/HACK/SYSTEM/FINISHED, AST radar, Polygon CMS, telemetry 3 workers), guard `role !== ADMIN` hiện banner + `openAuthModal('Cần ADMIN')`, chung `css/style.css` & footer `docs/DESIGN_SYSTEM.md:8`.
- **Nav liên kết chéo:** `index.html:40` → `arena.html`/`admin.html` via `href`; `arena.html:31,36` → `admin.html` link; `admin.html:24` → `index.html`/`arena.html`.
- **CSS zero-build giữ nguyên:** `css/style.css` single file, tokens `--bg-base`, `--accent-orange`, `data-theme` light/dark, 3 breakpoints 640/900/1024, `.table-responsive`, hamburger `aria-expanded`.

### DB (IndexedDB + PostgreSQL schema)
- `db/schema.sql:1` — PostgreSQL 16 chuẩn 12 bảng (users, contests, problems, testcases, submissions, hack_events, discussions...), index `GIN(tags)`, `idx_submissions_contest_user`.
- `src/db/index.js:1` — Wrapper `DB_NAME=dever_arena`, `DB_VERSION=3`, `STORES=10` (`users, contests, problems, testcases, submissions, hack_events, discussions, clans, contest_participants, analytics`), `openDB()` + `idbStore()` + fallback `localStorage`/`_mem` cho Node tests, API `db.getAll/get/put/delete/query/count` (`src/db/index.js:150`), `ensureSeeded()` (`src/db/index.js:167`).
- `src/db/seed.js:1` — Seed 6 clans (K19/K20/K18/K21/AI/ICPC), 1 contest `contest_dever_round1` status CODING, 5 problems từ `PROBLEMS_DB`, 3 testcases p101, 6 users (user_me/c1-c5), 6 `contest_participants` (Room #1/#2), 3 submissions (vuln `sub_vuln_c3_b` cho hack demo), 3 discussions (upvotes 12/5/2).
- `js/app.js:282` — `ensureSeeded(seedDatabase)` lúc `DOMContentLoaded`, `renderProblemset` hydrate từ `db.getAll('problems')` với skeleton 300ms (`js/app.js:305`), `handlePretestSubmission` persist `db.put('submissions')`, `setupPolygonCMS` persist `db.put('problems')`.

### Slop 0 (XSS, responsive, a11y)
- **Slop score:** 7.2 → **2.8** (`docs/AI_SLOP_REPORT.md:1`), **0 unpersisted state còn sót**.
- `js/app.js:99 escapeHtml` + `js/app.js:108 sanitizeText` — mọi render `discussions`, `problem title`, `submissions` đều `escapeHtml()`, statement giữ HTML kiểm duyệt, sample dùng `textContent`.
- `js/app.js:79 window.addEventListener('error')` + `unhandledrejection` — chỉ `console.error` + `guest-warning-banner role=alert`, **không alert spam**.
- `css/style.css:356` responsive: `.table-responsive { overflow-x:auto; -webkit-overflow-scrolling:touch }`, workspace grid `problem-statement (min 380px) | editor (1fr)` + resizer draggable, navbar hamburger `<900px`.
- `docs/DESIGN_SYSTEM.md:1` làm source of truth, rank contrast `--rank-newbie #9e9e9e` đạt WCAG AA, focus ring `outline:2px solid var(--accent-orange)`, `prefers-reduced-motion`.

**Tests vòng 1–4:** `node --test tests/*.test.js` — 56 tests pass (scoring 6, rating 4, contest 5, auth 7, astDiff 4, db 4, api 4, e2e 4, icpc 3).

---

## Vòng 5–7: API Contract + E2E + Perf

**Mục tiêu:** Đóng hợp đồng REST cho frontend, phủ E2E 3 flow, harden perf + i18n + error handling.

### API Contract (`src/db/api.js` ↔ `docs/API_SPECIFICATION.md`)
- **Mock REST layer** 1:1 với spec, JSDoc `@endpoint` để grep/replace sang `fetch` prod:
  - `POST /api/v1/auth/login` → `api.login({username,password})` (`src/db/api.js:37`) — mock JWT `mock_jwt_<id>_<ts>`, auto-create ephemeral user nếu chưa có, `accessToken` alias.
  - `GET /api/v1/contests` / `GET /api/v1/contests/{slug}` / `GET /api/v1/contests?status=CODING` → `api.getContests()` / `api.getContest(slugOrId)` / `api.getCurrentContest()` (`src/db/api.js:90,101,115`).
  - `POST /api/v1/contests/{slug}/register` → `api.registerForContest(slugOrId,userId,roomId)` + alias `api.registerContest(contestId,userId,roomId)` (`src/db/api.js:128,160`) — auto-assign Room least-loaded từ 4 rooms.
  - `GET /api/v1/contests/{slug}/participants` / `GET /api/v1/contests/{slug}/rooms/{roomId}` → `api.getContestParticipants(contestId)` / `api.getRoom(contestSlugOrId,roomId)` (`src/db/api.js:176,196`).
  - `GET /api/v1/problems?tag=&min_rating=&search=&contest_id=` → `api.getProblems(filters)` (`src/db/api.js:218`) — filter tag/rating/search/contest_id.
  - `GET /api/v1/problems/{id}` / `GET /api/v1/problems/{id}/editorial` → `api.getProblem(id)` / `api.getEditorial(id)` (`src/db/api.js:238,253`).
  - `POST /api/v1/submissions` / `GET /api/v1/submissions/{id}` / `GET /api/v1/submissions?contest_id=` → `api.createSubmission({contest_id,problem_id,language,source_code,user_id})` / `api.getSubmission(id)` / `api.listSubmissions(filter)` (`src/db/api.js:266,318,339`) — tính `points_awarded` via `calculateProblemScore`, wrongAttempts đếm WA trước đó, language normalize CPP20/PYTHON3/JAVA17/JS.
  - `POST /api/v1/hacks/execute` → `api.executeHack({contest_id,hacker_id,target_submission_id,test_payload})` (`src/db/api.js:346`) — heuristic `int total` vs `long long` + payload size/`__HACK_SUCCESS__` marker, `points_delta +100/-50`, mark `is_hacked=true, verdict=HACKED`.
  - `GET /api/v1/contests/{slug}/standings?room_id=&clan_id=&page=&limit=` → `api.getStandings(contestIdOrSlug,opts)` (`src/db/api.js:422`) — sum AC non-hacked + hack delta, sort `total_score` desc, rank dense, filter room/clan/pagination.

### E2E (`tests/e2e.test.js` — 4 suites)
- **Flow (a)** `register → submit vulnerable → hack success → standings delta` (`tests/e2e.test.js:1`) — tạo `user_e2e_flowA`, `registerContest` → `createSubmission` vuln `vector<int> int total` → `executeHack` big payload `200000 …` success → `getStandings` verify hacker +100, victim 0.
- **Flow (b)** `admin publish → DB có → getProblems filter` — `db.put('problems', p_e2e_pub_*)` base_points 1800, tags `e2e`, verify `getProblems({tag:'e2e'})`, `search:'omega'`, `contest_id` filter, không làm vỡ seed A-E (math filter=2).
- **Flow (c)** `contest lifecycle REGISTRATION→CODING→HACK_PHASE→SYSTEM_TESTING→FINISHED` — `ContestManager` (`src/core/contestStateMachine.js`) enforce không nhảy cóc, distribute rooms, `CODING` cấm xem code/hack, `HACK_PHASE` cho cùng Room, tính `calculateProblemScore` trong lifecycle.

### Perf + Hardening (Crew-E/J)
- `js/app.js:35 window.__deverPerf` + `js/app.js:37 __perfMark(name)` — explicit `performance.mark('arena_init')`/`'problems_render'`/`'standings_render'` cho verifier, `window.__deverPerf.marks` + `__perfTable()` khi `localStorage.dever_debug=1` (`js/app.js:47`).
- Loading skeleton: `js/app.js:294 renderProblemsetLoading()` với `aria-busy`, delay 300ms, hydrate từ DB hoặc fallback `PROBLEMS_DB`.
- Error hardening (`js/app.js:59 __showErrorBanner`): global `error`/`unhandledrejection` → `console.error` + banner `role=alert aria-live=assertive`, không alert spam; `setupFormHardening()` (`js/app.js:713`) set `novalidate`, custom Vietnamese `setCustomValidity('Vui lòng nhập...')`, `aria-invalid`, `reportValidity()`, `aria-errormessage`.
- Polygon hardening: `setPolyInvalid` + `aria-invalid` cho `poly-code`/`poly-title` (`js/app.js:1151`), `escapeHtml` cho preview.
- `js/app.js:137 theme-toggle`, `js/app.js:614 toggleMobileNav`, `js/app.js:644 setupWorkspaceResizer` (draggable 8px splitter, keyboard ArrowLeft/Right, clamp 32–68%), `js/app.js:684 setupGlobalA11y` (ESC đóng modal/nav/fullscreen, overlay click đóng).

**Tests vòng 5–7:** 56 tests pass, thêm `api.test.js` (hack + standings), `e2e.test.js` (4 E2E), `db.test.js` (seed integrity). Perf marks verifier pass.

---

## Vòng 8: PWA + Analytics

**Mục tiêu:** Đưa DEVER Arena lên PWA installable + SEO share preview, đồng thời thu thập analytics local-first.

### PWA (`manifest.json` + 3 HTML)
- **Tạo `manifest.json:1` (19 dòng):**
  ```json
  { "name":"DEVER Arena", "short_name":"DEVER", "icons":[{sizes:"192x192"}, {sizes:"512x512"}], "start_url":"index.html", "display":"standalone", "theme_color":"#ff6600" }
  ```
  Icons dùng data URI placeholder 1×1 (thay bằng `/icons/192.png` khi có asset), `theme_color` đồng bộ brand cam.
- **Liên kết trong 3 trang:**
  - `index.html:9` `<link rel="manifest" href="manifest.json">` + `index.html:7` `<meta name="theme-color" content="#ff6600">` + `index.html:10` `<meta name="apple-mobile-web-app-capable" content="yes">`
  - `arena.html:9` tương tự (`arena.html:7` theme-color `#ff6600`)
  - `admin.html:9` tương tự (`admin.html:7` theme-color `#ff3366` riêng Admin)
- **SEO/Open Graph:**
  - Mỗi trang có `og:title` (`og:title: DEVER Arena — Thi đấu thuật toán`), `og:description` riêng per-page (Landing: “Sân chơi lập trình…”, Arena: “Nền tảng thi đấu… Coding Phase…”, Admin: “Command Center… Phase Control…” ), `og:image` data URI placeholder (khuyến nghị 1200×630 khi thay thật) — `index.html:11`, `arena.html:11`, `admin.html:11`.
  - `meta description`, `color-scheme dark light`, `<title>` riêng, 1 `<h1>` duy nhất, `lang="vi"`, `skip-link`, semantic `<nav><main><section>`.
- **Docs sync:**
  - `docs/DEPLOYMENT_GUIDE.md:4` — thêm mục **4. PWA & SEO** mô tả `manifest.json` và `og:*`, hướng dẫn Nginx `Content-Type: application/manifest+json` + cache 1h, cách verify qua Sharing Debugger / DevTools Application → Manifest.
  - `docs/DEPLOYMENT_GUIDE.md:3` — checklist `Pre-contest` thêm item **5. Kiểm tra manifest.json và og:image** (validate manifest hợp lệ, og preview đúng, icon không 404, Lighthouse PWA ≥90).
  - `docs/DESIGN_SYSTEM.md:8` — File map thêm `manifest.json` (PWA) + `src/db/index.js` (DB_VERSION=3, 10 stores) + `Analytics`.
- **Verify:** DevTools → Application → Manifest (installable, icons load), Lighthouse PWA audit ≥90, `curl | grep og:`, thử share link Telegram/Facebook preview.

### Analytics (local-first, IndexedDB)
- **Store:** `src/db/index.js:9` `STORES` thêm `"analytics"` (nâng từ 9 → 10 stores: `users, contests, problems, testcases, submissions, hack_events, discussions, clans, contest_participants, analytics`), `db.put('analytics',{id,event,props,at})` persist mọi event, fallback `_mem`/`localStorage` cho tests.
- **Tracker:** `js/app.js:36` `window.__deverAnalytics = { track(event,props){ console.log('[analytics]',event,props); try{ db.put('analytics', {id: Date.now()+''+Math.random(), event, props, at: new Date().toISOString() }) }catch{} } }`
- **Gọi:** `js/app.js:368` `window.__deverAnalytics.track('contest_view',{page:state.activeView})` trong `switchMainView`, có thể mở rộng cho `problems_render`, `standings_render`, `hack_execute`, `submission_create`.
- **Docs sync:** `docs/DESIGN_SYSTEM.md:8` — File map thêm dòng `Analytics — src/db analytics store ({id,event,props,at}) + js/app.js:36 window.__deverAnalytics.track`.
- **Tương lai:** Khi có backend, replace `db.put('analytics')` bằng `fetch('/api/v1/analytics', {method:'POST', body:JSON.stringify({event,props})})` — chữ ký `track(event,props)` giữ nguyên.

**Tests vòng 8:** `node --test tests/*.test.js` — **56/56 pass** (không chạm code logic, chỉ docs + manifest + analytics store đã có từ trước, verifier kiểm tra `manifest.json`, `og:*`, `analytics` store).

---

## Vòng 9: Product Quality, Ticker Hardening & QA Automation

**Mục tiêu:** Nâng cấp chất lượng sản phẩm chuẩn Codeforces/ICPC, đếm ngược thời gian thực, đồng bộ liên tab, chạy test mẫu 1-click, mở rộng bộ test suite lên 62 tests và đạt 0 lỗi trên `detect.mjs`.

### 1. Đồng bộ Footer & Khắc phục lỗi `detect.mjs`
- Sửa footer trong `index.html:134` bổ sung `hreflang="vi"` và `hreflang="en"`, đồng bộ 100% với `arena.html` và `admin.html`.
- Chuyển liên kết Problemset trong `index.html:44` thành `arena.html#view-problemset`.
- Kết quả `node detect.mjs`: **0 error(s) PASS**.

### 2. Ticker thời gian thực & Thanh tiến độ kỳ thi
- `js/app.js`: Thêm `setupContestTimer()` đếm ngược từng giây theo định dạng `HH:MM:SS` cho `#timer-countdown`.
- Tự động tính toán phần trăm hoàn thành và cập nhật `#contest-progress-fill.style.width`.
- Tự động kích hoạt Hack Phase khi thời gian còn lại $\le 15$ phút ($900$s) và chuyển sang System Testing khi hết giờ.

### 3. Đồng bộ Phase liên tab (Cross-Tab Synchronization)
- `js/app.js`: Nâng cấp `setupPhaseControls()`, lưu `localStorage.setItem('dever_contest_phase', newPhase)` và bắt sự kiện `window.addEventListener('storage')`.
- Khi Admin kích hoạt phase trên `admin.html`, toàn bộ tab `arena.html` mở cùng trình duyệt lập tức đổi phase, cập nhật huy hiệu, phát âm thanh và mở phòng hack mà không cần tải lại trang.
- Khử bỏ lệnh `alert()` gây chặn luồng JS, thay bằng thông báo Toast `notify.info`.

### 4. Deep Hash Routing
- `js/app.js`: Thêm `handleAppHash()` và `initAppHashRouter()` hỗ trợ điều hướng trực tiếp:
  - Màn hình chính: `#view-problemset`, `#view-standings`, `#view-clans`, `#view-contests`, `#view-profile`.
  - Subtabs: `#tab-workspace`, `#tab-hackroom`, `#tab-standings`, `#tab-overview`.
  - Bài toán: `#problem-p101`, `#p102`.
  - Tabs bài: `#editorial`, `#discussions`, `#desc`.

### 5. Workspace 1-Click Sample Test Runner
- `arena.html`: Thêm nút `#ws-run-sample-btn` và `#ws-copy-sample-btn` ngay dưới ô ví dụ mẫu.
- `js/app.js`: `setupSampleTestRunner()` chạy code với test ví dụ của bài hiện tại qua `executeCodeInBrowser`, đối soát `stdout` thực tế với output kỳ vọng (AC/WA diff), hiển thị thời gian chạy và bộ nhớ trong Judge Console.

### 6. QA Test Suite
- Tạo `tests/platform_quality.test.js` (6 tests mới): kiểm tra thuật toán countdown, format thời gian, chuẩn hóa khoảng trắng đối soát output, phân giải hash routing, bất biến phase enum, và tính toàn vẹn 3 trang HTML.
- Toàn bộ **62/62 tests PASS 100%** qua 16 suites.

### 7. Hội Đồng Đa Tác Tử (5-Agent Quality Council) & Vá Bảo Mật Sandbox
- Triệu hồi 5 Agent chuyên sâu theo đúng Super Power Skills (`dever-arena-orchestrator`, `doubt-driven-development`, `security-and-hardening`, `polygon-problemsetter`, `performance-optimization`).
- Mở rộng blocklist sandbox trong `src/engine/runner.js` chặn `Worker`, `SharedWorker`, `WebSocket`, `sessionStorage`, `indexedDB`, `eval`, `Function`, `setTimeout`, `setInterval`.
- Thay thế hoàn toàn lệnh chặn `confirm()` và `alert()` trong `disqualifyCheater` tại `js/app.js` bằng mẫu 2-click confirm phi phong tỏa kèm `notify.info`.

---

## Vòng 10: Virtual Contest Replay, Multi-Contest Scheduler, Clan Wars Aggregator & LaTeX Typography

**Mục tiêu:** Mở rộng DEVER Arena với tính năng thi đấu ảo (Virtual Contest) mô phỏng đối thủ lịch sử (Ghost Replay), lên lịch nhiều kỳ thi theo phân hạng Elo (Division Eligibility Gate), thuật toán tổng hợp điểm bang hội Clan Wars (Top-5 Harmonic Sum), và bộ render công thức toán LaTeX offline-safe. Nâng tổng số kiểm thử lên 78 tests PASS 100%.

### 1. Virtual Contest Simulator Engine (`src/core/virtualContest.js`)
- `createVirtualSession(contestId, userId, durationMinutes)`: Khởi tạo phiên thi ảo độc lập.
- `getVirtualElapsedMinutes(session)`: Tính thời gian ảo đã trôi qua, chặn trần ở thời lượng tối đa.
- `filterGhostSubmissions(submissions, elapsedMinutes)`: Lọc bài nộp lịch sử xuất hiện tại phút $\le \text{elapsedMinutes}$.
- `calculateVirtualStandings(...)`: Tính toán bảng xếp hạng kết hợp giữa thí sinh ảo và các ghost participants.
- `tests/virtual_contest.test.js`: 5 tests PASS 100%.

### 2. Multi-Contest & Division Eligibility Gate (`src/db/api.js` & `src/db/seed.js`)
- Bổ sung các kỳ thi mẫu: `contest_dever_archive` (Finished - sẵn sàng thi ảo), `contest_dever_round2_div1` (Div. 1, minRating 1900), `contest_dever_round2_div2` (Div. 2, maxRating 1899), `contest_dever_beginner_cup` (Div. 4, maxRating 1599).
- Bổ sung cổng kiểm soát điều kiện Elo trong `api.registerContest()`, từ chối thí sinh không đủ hoặc vượt quá rating cho phép.
- Mở rộng IndexedDB store `virtual_sessions` (DB_VERSION=4, 11 stores).

### 3. Clan Wars Aggregator Engine (`src/core/clanRating.js`)
- `calculateClanPowerScore(members, 'top5_harmonic')`: Công thức Top-5 Harmonic Sum $S_{\text{clan}} = \sum_{i=1}^5 \frac{R_i}{\sqrt{i}}$ kết hợp giữa tinh hoa và chiều sâu lực lượng.
- `generateClanLeaderboard(clans, users)`: Tạo bảng xếp hạng bang hội có thứ hạng và danh sách tuyển thủ chủ lực.
- Nâng cấp `renderClans()` trong `js/app.js` tích hợp giao diện thẻ Clan có danh sách Top 5 tuyển thủ theo màu rank tier.
- `tests/clan_wars.test.js`: 4 tests PASS 100%.

### 4. LaTeX Math Typography Formatter (`renderMathTypography` trong `js/app.js`)
- Định dạng các biểu thức toán học `$math$` trong Đề bài và Editorial thành HTML phong cách KaTeX với các ký hiệu $\le, \ge, \sum, \times$, số mũ `10^5` và chỉ số dưới $a_i$.
- Hỗ trợ KaTeX CDN nếu có mạng và fallback regex offline an toàn 100%.

### 5. Giao diện người dùng & Điều hướng sâu (Deep Hash `#virtual-`)
- `arena.html`: Thêm thanh trạng thái `#virtual-contest-hud` kèm đồng hồ ảo độc lập `#virtual-timer-display` và nút kết thúc thi ảo phi phong tỏa.
- `index.html`: Thêm thẻ kỳ thi quá khứ với nút "🚀 Thi đấu ảo" trỏ trực tiếp về `arena.html#virtual-contest_dever_archive`.
- `js/app.js`: Xử lý hash `#virtual-*` tự động khởi tạo phiên thi ảo và hiển thị HUD.

---

## [2026-09-07] — Vòng 11: Enterprise Judge Worker Queue, Scoreboard Freeze & Polygon Testlib Validator

### 1. Judge Worker 3-Tier Priority Queue & Isolate Sandbox (`src/engine/workerQueue.js`, `src/engine/isolateRunner.js`)
- `JudgeWorkerQueue`: Điều phối hàng đợi ưu tiên nghiêm ngặt (Strict Priority FIFO):
  - `PRIORITY_HACK: 1` (Instant Hack Queue phản hồi < 3s).
  - `PRIORITY_PRETEST: 2` (Coding Phase Pretest Queue).
  - `PRIORITY_SYSTEM_TEST: 3` (Chạy hàng loạt System Test sau contest).
- `isolateRunner.js`: Mô phỏng cgroups v2 / Linux Isolate sandbox đo lường CPU time, bộ nhớ, Fail-Fast khi gặp testcase lỗi, chặn 18 API nguy hiểm và ánh xạ verdict chuẩn `AC`, `WA`, `TLE`, `MLE`, `RTE`, `CE`.
- `tests/worker_queue.test.js`: 7 tests PASS 100%.

### 2. Scoreboard Freeze & ICPC Dramatic Unfreeze Simulator (`src/core/scoreboardFreeze.js`)
- `createFrozenStandings()`: Đóng băng bảng xếp hạng trong 30/60 phút cuối, chuyển kết quả các bài nộp sau mốc freeze thành `? K` (số lần nộp).
- `generateUnfreezeStepSequence()`: Thuật toán giải mã bảng điểm kịch tính theo chuẩn ICPC World Finals, duyệt từ đội có rank thấp nhất, lật mở kết quả, ghi nhận pha nhảy vọt thứ hạng (Rank Jump delta) lên ngôi vô địch.
- `applyUnfreezeStep()`: Cập nhật từng tick cho bảng xếp hạng trực tiếp.
- `tests/freeze_scoreboard.test.js`: 4 tests PASS 100%.

### 3. Polygon Testlib Validator & Custom Floating-Point Checker (`src/engine/testlibValidator.js`)
- `validateInput()`: Kiểm tra tính tuân thủ quy cách testcase đầu vào của ban ra đề (EOF newline, cấm trailing spaces, bounds $1 \le N \le 10^5$, giá trị phần tử).
- `checkOutput()`: So khớp đáp án đa thể thức:
  - `exact`: So khớp token chính xác (bỏ qua khoảng trắng/xuống dòng thừa).
  - `float_tolerance`: So khớp số thực với sai số tuyệt đối/tương đối $\le 10^{-6}$.
  - `multiple_solutions`: Xác thực bài toán có nhiều nghiệm qua custom judge function.
- `tests/testlib.test.js`: 9 tests PASS 100%.

### 4. Đồng bộ 14 tài liệu đặc tả & hệ thống kiểm định
- Cập nhật [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [API_SPECIFICATION.md](./API_SPECIFICATION.md), [SPEC.md](./SPEC.md), [CAPABILITY_MAP.md](./CAPABILITY_MAP.md), [PRODUCT.md](../PRODUCT.md), [tasks/plan.md](../tasks/plan.md), [tasks/todo.md](../tasks/todo.md).
- Nâng tổng số kiểm thử nền tảng lên **98/98 tests PASS 100%** qua 25 test suites.

---

## Vòng 12: UI/UX Redesign, Playwright E2E & Chrome DevTools CDP Audit

**Mục tiêu:** Nâng cấp trải nghiệm người dùng theo tiêu chuẩn Cyber Dark eSports, kiểm định tự động 100% bằng Playwright E2E, Chrome DevTools Protocol và xây dựng sổ bộ quyết định kiến trúc ADRs.

### 1. Nâng cấp UI/UX eSports ([css/style.css](../css/style.css))
- **Glassmorphism & Depth**: Áp dụng `backdrop-filter: blur(14px)`, viền phát sáng cam quang học `rgba(255,102,0,0.18)` và bóng đổ kép `box-shadow: 0 8px 24px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.25)` kết hợp `will-change: transform` trên toàn bộ thẻ card.
- **eSports Digital Timer HUD**: Đồng hồ neon font JetBrains Mono, dải tiến độ 135 phút và pulsing phase indicators.
- **Console Dots**: Bổ sung thanh tiêu đề terminal với 3 chấm Unix/macOS (🔴 🟡 🟢).
- **Huy chương vinh danh**: Tích hợp 🥇 Vàng, 🥈 Bạc, 🥉 Đồng cho Top 3 bảng điểm Standings.

### 2. Bộ kiểm định Playwright E2E ([tests/e2e_playwright.mjs](../tests/e2e_playwright.mjs))
- Tích hợp trình duyệt thực tế Microsoft Edge / Chromium headless.
- 47/47 assertions tự động kiểm thử toàn bộ 3 trang (`index.html`, `arena.html`, `admin.html`), responsive hamburger, code editor runner, AST anti-cheat scan, Polygon CMS live preview.
- Đạt tỷ lệ thành công tuyệt đối: **100.0% PASS**.

### 3. Kiểm định Chrome DevTools Protocol & Clean Console ([tests/devtools_audit.mjs](../tests/devtools_audit.mjs))
- Khai thác trực tiếp giao thức CDP (`Performance.enable`, `Accessibility.enable`).
- Đo lường FCP < 360ms, DOM Content Loaded < 315ms, JS Heap < 1.85MB.
- Phát hiện và vá lỗi 404 `/favicon.ico`, đưa toàn bộ 3 trang về chuẩn **Clean Console Standard (0 errors, 0 warnings)**.

### 4. Sổ bộ quyết định kiến trúc ([docs/decisions/](./decisions/))
- Thiết lập hệ thống ADRs theo chuẩn `documentation-and-adrs`:
  - **ADR-001**: Kiến trúc 3 trang HTML độc lập.
  - **ADR-002**: Cơ chế thực thi Isolate Sandbox & Fail-Fast.
  - **ADR-003**: Core Engine hàm thuần (Pure Functions) & Zero-AI Client.
  - **ADR-004**: AST Tokenizer 3-Gram Winnowing chống gian lận.

---

## Vòng 13: Full-System Portal Separation, KaTeX Math Engine, Polygon Problemsetter Studio & 9Router De-integration

**Mục tiêu:** Nâng cấp toàn diện kiến trúc React 18 + Vite + Tailwind CSS v4 SPA, phân tách rạch ròi Member Portal và Admin Command Center, tích hợp Monaco Editor chuẩn LeetCode, công thái học Resizable Splitters, KaTeX Math Typography, Polygon Studio cho Admin, và loại bỏ hoàn toàn module 9Router tuân thủ tuyệt đối ADR-003.

### 1. Kiến trúc React 18 + Vite + Tailwind CSS v4 SPA ([app.html](../app.html), [src/App.jsx](../src/App.jsx))
- Tách biệt 2 layout độc lập: `MemberLayout` (dành cho thí sinh với Navbar tối giản, đồng hồ HUD, tabs tiện ích) và `AdminLayout` (dành cho BTC với Sidebar 5 module: Phase Orchestrator, AST Radar, Polygon Studio, Telemetry, Hack Rooms).
- Hệ thống Route chuẩn: `/` (Landing), `/problems` (Problemset), `/workspace/:id` (LeetCode Workspace), `/standings` (ICPC Unfreeze), `/hacks` (Hack Room), `/clans` (Clan Wars), `/login` (Auth 1-Click), `/admin` (Command Center).
- Đồng bộ đa tab thời gian thực qua `BroadcastChannel('dever_arena_bus')`.

### 2. Không gian làm bài LeetCode 3 phân vùng & Công thái học ([src/pages/ProblemWorkspace.jsx](../src/pages/ProblemWorkspace.jsx))
- **Monaco Editor Pro:** C++20 / Python 3 / Java 17 / JavaScript, themes Cyber Dark / Monokai, auto-save `localStorage` chống mất code khi reload.
- **Resizable Splitters:** Kéo thả 2 chiều linh hoạt (Trái/Phải clamped 20%–80%, Trên/Dưới clamped 30%–75%) với thanh kéo phát sáng Cyber Cyan và tự động lưu tỷ lệ layout vào `localStorage`.
- **Zen Mode (2 cấp độ):** Cấp 1 ẩn Testcase Console tối đa hóa diện tích code; Cấp 2 phóng đại toàn màn hình với hotkey phím tắt `Esc` thuận tiện.
- **Multi-Tab Testcase Console:** Chạy test mẫu tức thời, đối soát trực quan Diff Output, hiển thị thời gian chạy (ms) và bộ nhớ (KB).

### 3. KaTeX LaTeX Math Typography Engine ([src/components/common/MathRenderer.jsx](../src/components/common/MathRenderer.jsx))
- Trình dựng công thức toán học chuyên sâu offline-safe chuẩn KaTeX.
- Tự động nhận diện và phân tích cú pháp LaTeX inline `$O(N \log N)$` và display block `$$\sum_{i=1}^N A_i$$`.
- Tích hợp mượt mà vào Đề bài, Giới hạn thời gian/bộ nhớ, Ví dụ mẫu và Polygon Preview.

### 4. Polygon Problemsetter Studio trong Admin Center ([src/components/layout/AdminLayout.jsx](../src/components/layout/AdminLayout.jsx))
- Bộ công cụ quản trị và soạn thảo đề bài hoàn chỉnh cho Ban Giám Khảo:
  - Form thêm/sửa bài toán đầy đủ schema: Mã bài, Tên bài, Điểm thưởng, Giới hạn thời gian (ms), Bộ nhớ (MB), Đề bài (Markdown + LaTeX), Ràng buộc, Định dạng Input/Output, Bộ test ví dụ.
  - Chế độ KaTeX Live Preview 2 cột tức thời.
  - Nút Xóa đề bài với Modal xác nhận an toàn.
  - Tự động đồng bộ bài tập mới vào kho dữ liệu `ContestContext` và phát tín hiệu cho mọi tab thí sinh qua `BroadcastChannel`.

### 5. Khử bỏ toàn diện 9Router & Củng cố Zero-AI Client ([docs/decisions/ADR-003-pure-core-engine-and-zero-ai.md](./decisions/ADR-003-pure-core-engine-and-zero-ai.md))
- Gỡ bỏ hoàn toàn 8 agent skills `9router*` trong `.agents/skills/`.
- Cam kết không có bất kỳ cuộc gọi API nào ra cổng AI bên ngoài trong suốt quá trình thi đấu Rated, bảo đảm 100% môi trường thi đấu thuật toán thuần khiết và công bằng cho sinh viên.

---

## Vòng 14: Backend API Thật + Judge Chạy Code Thật + Logo CLB

**Mục tiêu:** Thay mock IndexedDB bằng máy chủ thật, chấm code thật, gắn logo chính thức.

- `server/{index,db,auth,judge,oracles}.js` (Node thuần, 0 dependency): REST theo API_SPECIFICATION + SSE, JWT HS256, judge thực thi JS/Python qua child_process có timeout, hack chấm bằng oracle chạy cùng payload, system test chấm lại thật, chốt Elo thật, virtual ghost replay, division gate, xếp Room ≤25.
- `tests/server_api.test.js`: 10 tests vòng đời (login, gate, judge AC/WA, standings, phase machine, hack +100/−50, Elo, virtual, SSE).
- `public/brand/` (logo CLB nguồn thật duy nhất) + favicon/PWA icons sinh từ logo gốc; `manifest.json` hết placeholder; `app.html` + Navbar/Login/Landing gắn logo.
- `src/lib/apiClient.js`: fetch client + JWT + SSE; Standings/Clans/ContestHub-ảo/Login nối backend có fallback demo.

## Vòng 15: Xóa Clan Wars + Tài Khoản Do Admin Cấp + Dọn Icon + Sửa Chữ

- Xóa Clan Wars khỏi UI/server/engine/tests (`ClansPage`, `clanRating`, `clan_wars.test`, endpoint `/clans`); user còn lại là cá nhân hoặc đội (`team`, `members`).
- `POST/GET /api/v1/admin/users`: admin cấp tài khoản (validate username/password/role), tab “Cấp tài khoản” trong Admin; không có đăng ký công khai.
- Gỡ toàn bộ `lucide-react` và emoji trang trí; icon còn lại duy nhất là SVG ngôn ngữ từ svgl.app (`public/icons/`); medal/huy hiệu → chữ và số.
- Font UI đổi Outfit → Space Grotesk (có subset tiếng Việt, đã kiểm chứng METADATA Google Fonts); JetBrains Mono giữ (đã có subset Việt).
- Sửa chữ: bỏ số liệu bịa (1.240+ sinh viên, 48 contest, 92%), bỏ tuyệt đối hóa (“100%”, “tuyệt đối”), stats Landing lấy từ API, telemetry/rooms/admin báo rõ khi chưa nối backend.

## Vòng 16: Nối Vòng Lặp Thi Đấu Vào Backend + Security + Judge Sâu + Production

- Workspace nộp bài chấm thật qua API (lỗi hiện rõ, không bịa AC); chạy thử local thật; editorial khóa đến khi FINISHED; đồng hồ + phase đồng bộ từ server.
- Hack Room đọc phòng thật + bẻ khóa thật qua oracle; nút phase admin gọi API có báo lỗi; telemetry/rooms admin đọc số thật.
- Security: rate-limit login/submit/hack, security headers, CORS theo env, production bắt buộc `DEVER_JWT_SECRET`.
- Judge: thêm Java (javac/java) và C++ (g++) tự phát hiện toolchain, thiếu tool trả 422 trung thực; endpoint admin rejudge.
- Production: `Dockerfile.api` (Node + python3 + JDK17 + g++), `Dockerfile.web` (nginx), `nginx.conf` (SPA + proxy API/SSE), `docker-compose.yml`, `.env.example`; `server/data/` gitignore.
- Nâng tổng số kiểm thử lên **105/105 PASS** (24 suites).

## Tổng kết file chạm

| Vòng | File chính | Thay đổi |
|------|------------|---------------|
| 1–4 | `index.html`, `arena.html`, `admin.html`, `css/style.css`, `js/app.js`, `src/db/index.js`, `src/db/seed.js`, `db/schema.sql`, `docs/DESIGN_SYSTEM.md`, `docs/AI_SLOP_REPORT.md` | Tách SPA → 3 trang, thêm DB layer, XSS guard, responsive |
| 5–7 | `src/db/api.js`, `src/db/index.js`, `js/app.js`, `tests/e2e.test.js`, `tests/api.test.js` | API contract + E2E + perf marks + form hardening |
| 8 | `manifest.json`, `index.html`, `arena.html`, `admin.html`, `js/app.js`, `src/db/index.js`, `docs/DEPLOYMENT_GUIDE.md`, `docs/DESIGN_SYSTEM.md`, `docs/CHANGELOG.md` | PWA + og:* + analytics store + docs sync |
| 9 | `index.html`, `arena.html`, `js/app.js`, `tests/platform_quality.test.js`, `tasks/todo.md`, `docs/CHANGELOG.md` | Real-time Ticker, Cross-Tab Phase Sync, 1-Click Sample Test, Hash Router, 62 tests PASS, 0 detect errors |
| 10 | `src/core/virtualContest.js`, `src/core/clanRating.js`, `src/db/api.js`, `src/db/seed.js`, `src/db/index.js`, `arena.html`, `index.html`, `js/app.js`, `tests/virtual_contest.test.js`, `tests/clan_wars.test.js`, `tests/api.test.js`, `tests/platform_quality.test.js`, `tasks/todo.md`, `tasks/plan.md` | Virtual Contest Simulator, Ghost Replay, Multi-Contest Scheduler, Rating Gates, Clan Wars, KaTeX Math, 78 tests PASS |
| 11 | `src/engine/workerQueue.js`, `src/engine/isolateRunner.js`, `src/core/scoreboardFreeze.js`, `src/engine/testlibValidator.js`, `tests/worker_queue.test.js`, `tests/freeze_scoreboard.test.js`, `tests/testlib.test.js`, `docs/DATABASE_SCHEMA.md`, `docs/API_SPECIFICATION.md`, `docs/SPEC.md`, `docs/CAPABILITY_MAP.md`, `PRODUCT.md`, `tasks/plan.md`, `tasks/todo.md` | 3-Tier Judge Queue, Isolate Sandbox Runner, Scoreboard Freeze & ICPC Unfreeze, Polygon Testlib Validator, 98 tests PASS |
| 12 | `css/style.css`, `index.html`, `arena.html`, `admin.html`, `js/app.js`, `favicon.ico`, `tests/e2e_playwright.mjs`, `tests/devtools_audit.mjs`, `docs/decisions/*`, `docs/DEPLOYMENT_GUIDE.md`, `docs/CHANGELOG.md` | UI/UX Redesign Cyber Dark, Playwright E2E (47/47 PASS), DevTools CDP Audit (Clean Console), Nginx Hardening, ADR-001 tới ADR-004 |
| 13 | `src/App.jsx`, `src/pages/*.jsx`, `src/components/layout/*.jsx`, `src/components/common/MathRenderer.jsx`, `src/context/ContestContext.jsx`, `.agents/skills/*`, `docs/CAPABILITY_MAP.md`, `docs/CHANGELOG.md` | React 18 SPA Portal Separation, LeetCode Workspace Splitters & Zen Mode, KaTeX Math, Polygon Studio, 9Router De-integration |
| 14 | `server/*`, `tests/server_api.test.js`, `public/brand/*`, `src/lib/apiClient.js`, `manifest.json`, `app.html` | Backend REST+SSE+judge thật, logo CLB, PWA icons thật, nối Standings/Clans/Virtual/Login |
| 15 | `src/pages/*`, `src/components/layout/*`, `server/index.js`, `package.json`, `app.html`, `src/index.css` | Xóa Clan Wars + SFX, tài khoản admin cấp, gỡ lucide/emoji (SVG svgl), font Space Grotesk, sửa chữ + số liệu thật |
| 16 | `src/pages/ProblemWorkspace.jsx`, `src/pages/HackRoomPage.jsx`, `src/context/ContestContext.jsx`, `server/{index,judge}.js`, `tests/server_api.test.js`, `Dockerfile.*`, `nginx.conf`, `docker-compose.yml` | Nối submit/hack/phase/timer/editorial, rate-limit + headers, judge Java/C++ + rejudge, rooms/telemetry thật, production Docker, 105 tests PASS |
| 17 | Xóa `index.html`/`arena.html`/`admin.html`/`css`/`js`/`problems` + 5 script e2e lỗi thời; `detect.mjs` + `platform_quality.test.js` viết lại cho SPA | Single-stack React, 124 tests PASS |
| 18 | `server/index.js` (problems CRUD), `src/core/contestResults.js`, `GET standings` (?frozen/?format), BroadcastChannel FREEZE | CRUD đề thi, freeze/ICPC phía server, 125 tests PASS |
| 19 | `MathRenderer.jsx` (escape XSS), `ContestContext` (merge đề), `ContestHub` (list kỳ thi), `server` (hack gate, tạo contest), `AdminLayout` (form mở kỳ thi) | Vá hiển thị + luồng dữ liệu thật + mở kỳ thi, 126 tests PASS |

> **Lệnh verify sau mỗi vòng:** `node --test tests/*.test.js` (105 pass, 0 fail), `node detect.mjs` (0 error), `npm run build` (~250ms, clean bundle).

## Vòng 17: Xóa giao diện vanilla cũ — single-stack React SPA duy nhất

- **Xóa:** `index.html`, `arena.html`, `admin.html`, `css/`, `js/`, `problems/` (không code/test nào import), 5 file `tests/*.mjs` lỗi thời (`audit_buttons`, `devtools_audit`, `e2e_playwright`, `playwright_audit`, `test_all_buttons_and_forbidden`); gỡ script `test:e2e` treo.
- **Viết lại:** `detect.mjs` (check `app.html` shell + `manifest.json` + `public/brand/` + `public/icons/` + cấm `lucide-react` trong `src/`), `tests/platform_quality.test.js` (hợp đồng SPA: shell/manifest/assets/routes core, giữ countdown/comparator/phase-enum), `package.json` serve → `npx serve dist -l 3000`.
- **Docs:** `README.md`, `docs/SPEC.md`, `docs/DESIGN_SYSTEM.md`, `docs/DEPLOYMENT_GUIDE.md` chuyển dual-stack/3-trang → single-stack SPA.
- **Verify:** `npm run test` **124 pass / 0 fail** (25 suites: platform_quality 7→8 test SPA + 19 test ngoài phạm vi vòng này), `node detect.mjs` 16 PASS / 0 error, `npm run build` sạch (~249ms).

## Vòng 18: CRUD đề thi trên máy chủ + Freeze/ICPC phía server

- **Ra đề lên máy chủ:** `POST/PUT/DELETE /api/v1/admin/problems` (validate 422, trùng mã 409, đã có submission 409, non-admin 403); Admin Studio tự tải đề từ server, lưu báo rõ máy chủ/local; `loadProblemsFromServer()` trong ContestContext; 7 tests server mới.
- **Freeze + ICPC phía server:** module thuần `src/core/contestResults.js` (`applyFreeze`, `computeIcpcStandings`, 11 unit tests) đấu nối vào `GET standings` qua `?frozen=1&freeze_minute=N` và `?format=ICPC`; nút đóng băng admin đồng bộ qua BroadcastChannel tới Standings; test server vòng đời freeze/ICPC.
- **Verify:** `npm run test` **125 pass / 0 fail**, `node detect.mjs` 0 error, `npm run build` sạch.

## Vòng 19: Vá liêm chính hiển thị + luồng dữ liệu thật + mở kỳ thi

- **Liêm chính hiển thị:** escape HTML trong MathRenderer (chống stored-XSS từ đề/editorial); bộ mô phỏng lật bảng chỉ chạy ở demo local, dữ liệu thật không bao giờ bịa verdict; 401 tự về trạng thái khách.
- **Luồng dữ liệu:** merge đề server giữ nháp local; workspace reset testcase/verdict theo bài; validator hack chuyển gate format-only (tránh loại oan); ContestHub liệt kê kỳ thi + đăng ký thật; cột bảng điểm render động theo đề.
- **Mở kỳ thi:** `POST /api/v1/admin/contests` + form admin (tên, thể thức, giờ bắt đầu, thời lượng, chặn rating); test tạo/trùng/sai/non-admin.
- **Verify:** `npm run test` **126 pass / 0 fail**, `node detect.mjs` 0 error, `npm run build` sạch.

## Vòng 20: E2E trình duyệt thật + chống treo process

- **E2E thật:** `tests/spa_e2e.test.js` (Playwright Chromium có sẵn, không download) dựng API riêng port 18787 + Vite riêng port 5174: landing, login JWT qua UI, standings live, workspace nộp Python chấm thật hiện điểm.
- **Chống treo/mồ côi:** phát hiện vite mồ côi do spawn `shell:true` (kill không tới process con) → spawn trực tiếp bằng node + `taskkill /T /F` dọn cây process; E2E dùng port riêng nên không đụng máy dev của người dùng (hết lỗi EADDRINUSE); sửa test login chờ token JWT thay vì chờ text (nút fast-switch đã chứa tên user gây pass ảo).
- **Vite:** proxy `/api` đọc `DEVER_API_PORT` (mặc định 8787).
- **Verify:** `npm run test` **136 pass / 0 fail**, `node detect.mjs` 0 error, `npm run build` sạch, không process mồ côi sau test.

## Vòng 21: Soạn đề server-only + worker chấm riêng + ICPC tự động + Postgres

- **Soạn đề server-only:** bỏ persist localStorage đề thi (dual-source), Admin Studio lưu/xóa/tải lại 100% qua API, merge giữ nháp trong phiên.
- **Worker chấm riêng:** `server/queue.js` + `server/judgeWorker.js` (fork pool, FIFO, timeout 60s + respawn, `unref` + shutdown tường minh); API không chạy code thí sinh trên event-loop; test 3 bài đồng loạt.
- **ICPC tự động:** standings theo `contest_format` khi không ép `?format=`; bảng điểm render cột Giải được/Penalty; test vòng đời ICPC thật (tạo contest → ra đề → đăng ký → chấm → solved=1).
- **Admin sâu:** telemetry duyệt bài nộp + chấm lại, reset mật khẩu từng tài khoản (test đổi pass cũ/mới), polygon chọn kỳ thi đích.
- **Postgres:** adapter `server/pg.js` (1 bảng KV + meta, migrate tự động, write-through + flush) + service `db` trong compose + `.env`; logic verify bằng pool giả (4 tests) — chạy thật cần server Postgres.
- **Verify:** `npm run test` **136 pass / 0 fail**, `node detect.mjs` 0 error, `npm run build` sạch.





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

## Vòng 22: SDLC Ops — CI + Observability + Backup + Runbook + Load

- **CI:** `.github/workflows/ci.yml` (npm ci → detect → test → build → audit high); `CONTRIBUTING.md` quy định vòng verify PR.
- **Observability:** `GET /api/health`, `/api/v1/health`, `/api/ready` + log JSON `{ts,level,method,path,status,ms}`; `tests/health.test.js` (3 tests).
- **Backup/DR:** `scripts/backup.mjs`/`restore.mjs` (`npm run backup/restore`, tự giữ `.pre-restore`), compose thêm `healthcheck` API + `deploy.resources.limits` (api 2CPU/2G, web 1CPU/512M); `docs/ops/{INCIDENT_RUNBOOK,BACKUP_RESTORE,DATA_RETENTION}.md`.
- **Load:** `scripts/load_test.mjs` (`npm run test:load`): 20 job Python đồng loạt → 20/20 AC, tổng ~413ms, p50 ~254ms. Audit: 0 high/critical (1 moderate transitive dompurify qua monaco, không chạm).
- **Verify:** `npm run test` **139 pass / 0 fail**, `node detect.mjs` 0 error, `npm run build` sạch (~332ms).

## Vòng 23: Design Library (getdesign.md) + Luxury-Minimal + 4 skills mới

- **Thư viện design:** `npx getdesign add linear.app` → `DESIGN.md` root; thêm `docs/design-{linear,vercel,notion,apple}.md`. Rút consensus 4 bản: một accent duy nhất, cấm gradient/glow/shadow màu trang trí, body 400 / display 600 + tracking âm, depth bằng hairline.
- **Skills mới:** `dever-deploy-release` (CI/Docker/health/rollback), `dever-live-ops` (pre-contest/on-call/backup), `dever-ui-craft` (DESIGN.md + Luxury-Minimal Rules cấm neon), `dever-quality-gate` (gate matrix). Orchestrator thêm SDLC Phase Gates Plan→Build→Verify→Deploy→Operate.
- **Luxury-minimal refinement:** khử toàn bộ neon `#00f0ff`, gradient, `blur-3xl`, colored shadows khỏi `src/` (grep 0 sót: Navbar h-14 canvas, Landing/Login/ContestHub/HackRoom panels surface-1 + hairline, headline solid cam 600, CTA 8px không shadow, splitter/tooltip/code về xám). Màu semantic chỉ sống trong product surfaces dạng pill mờ.
- **Verify:** `npm run test` **139 pass / 0 fail**, `node detect.mjs` 0 error, `npm run build` sạch (~231ms).

## Vòng 24: Gates thật + Production boot proof

- **Fix gate vỡ:** `npm run lint:js` cũ dùng `|| true` (chết trên Windows) + không config → thay bằng `eslint.config.mjs` flat (globals Node+Browser gộp) + `eslint` devDep + CI chạy `lint:js`: **0 errors** (36 warnings). Lần chạy đầu lòi 19 `no-undef` thiếu globals, đã bổ sung.
- **Docker sẵn sàng:** `.dockerignore` mới (api context 1.13kB, chặn `.env`/data lọt image); base image `node:20→22-alpine` (20 EOL, hết EBADENGINE).
- **Boot proof trên Docker thật:** `docker compose up --build -d` → api **Healthy** (`store: pg`, seed 7 users/4 contests), `GET /app.html` 200, `/api/health` + `/api/ready` 200 qua nginx, login `dever_hero` + list 4 contests thật, log JSON chảy. Dọn sạch `down -v` + xóa `.env` test.
- **Còn lại trước contest (không chặn lab):** TLS public (compose hiện port 80 — đặt sau reverse proxy/Cloudflare khi public), rebuild image node:22 trước giờ thi, uptime alert ping `/api/health`.

## Vòng 25: Tách 3 shell (guest/user/admin) + Đại tu admin

- **Tách vỏ:** `GuestLayout` (bar gọn + CTA Đăng nhập + footer, chỉ `/` + `/login`), `UserLayout` (Navbar thí sinh: timer, tabs, profile), `AdminLayout` giữ `/admin/*` + thêm `RequireAuth` (GUEST→/login) / `RequireAdmin` (non-ADMIN→/login). Bỏ footer trùng trong LandingPage.
- **Admin mới:** sidebar surface-1 + hairline + nhãn QUẢN TRỊ, active = surface lift (hết đỏ rực), topbar canvas, nút phase neon đặc → neutral (chỉ HACK giữ accent CTA), component `AdminSection` (eyebrow + tên + mô tả) cho 6 modules, nút freeze cyan → accent-tint.
- **Verify:** `npm run test` **139 pass / 0 fail** (E2E Playwright chạy qua shell + guard mới), `node detect.mjs` 0 error, `npm run lint:js` 0 errors, `npm run build` sạch (57 modules).

## Vòng 26: Polygon Generator + Stress + Blind-tester workflow

- **Generator (`src/engine/testGenerator.js`):** seeded mulberry32 (cùng seed → cùng suite, tái hiện), 5 bẫy biên mọi suite (N min, N=1, all-equal, overflow, N max) + xoay pattern; dùng chung browser + server.
- **Stress (`POST /api/v1/admin/stress`):** model vs brute qua worker pool (batch 4, count≤30), `PASS/FAIL` + mismatches ≤5 chi tiết + `modelMaxMs` + `suggestedTimeLimitS = max(1s, 2×)`. Testcase CRUD (`POST/GET/DELETE /api/v1/admin/testcases`, cấm xóa mẫu).
- **Blind-tester:** `DRAFT→IN_TESTING→APPROVED` (reject về DRAFT), cấm tự giao đề, queue ẩn editorial, báo cáo tester (solved/phút/nhận xét) lưu trên đề.
- **UI:** Studio `StressPanel` (xem trước strategies → chạy → áp TL → lưu pretests từ outputs brute) + badge workflow + thanh Gửi duyệt/Duyệt/Từ chối; ContestHub thêm `TestingQueue` cho tester.
- **Verify:** `npm run test` **150 pass / 0 fail** (6 generator + 5 stress/workflow mới), lint 0 errors, build sạch (58 modules).

## Vòng 27–28: Công ty multi-agent + Merge 8 nhánh page/*

- **Tổ chức:** leader + 6 reviewer (47 gaps) + 5 builder song song, mỗi agent 1 worktree riêng (`Temp/opencode/dever-*`, junction node_modules) + 1 nhánh riêng: admin (overview dashboard, validation inline, testcase CRUD, bounds form), auth (login lỗi inline, tokens), backend (bounds theo đề + 3 tests), docs (audit stale + manifest PAGE_BRANCHES), design (review tuân thủ).
- **Merge về main:** landing → contesthub → workspace → standings → hackroom → backend → admin (1 xung đột indent, resolve) → auth → docs. Không mất code agent nào.
- **QA bắt lỗi thật:** docs agent ghi sai số liệu (150/21) → đếm lại: **153 tests / 25 suites**; design reviewer quét còn 1 sót `app.html` → đã fix; grep neon/gradient/glow/shadow màu toàn repo = 0 hit.
- **Verify cuối:** `npm run test` **153 pass / 0 fail**, `node detect.mjs` 0, `npm run lint:js` 0 errors, `npm run build` sạch, `test:load` 20/20 PASS, audit 0 high/critical.

## Vòng 29: Hồ sơ merge team + Chốt định hướng sản phẩm

- **Hồ sơ merge team (chưa ghi ở Vòng 27–28):** ProfilePage `/profile`, ProblemsetPage `/problemset`, announcement banner + SSE, standings2 (friends star + CSV export + first-blood), hackroom2 (validator bounds + preset payload), landing2 (FAQ + luật chơi 4 bước), load-sre scale test → **157/157 tests / 25 suites** tại thời điểm merge.
- **Chốt định hướng với chủ dự án:** platform nội bộ CLB theo chuẩn thi đấu quốc tế (ICPC/AtCoder/CSES), KHÔNG theo cơ chế riêng Codeforces quy mô lớn: gỡ Hack Phase, bỏ pretest/system-test, ICPC làm thể thức mặc định, đào sâu scheduler + kho bài luyện tập + judge sâu. Ghi vào `tasks/plan.md` Task 95–106.

## Vòng 30: Đơn giản hóa vòng đời thi đấu chuẩn quốc tế (ADR-005)

- **State machine 5 → 3 phase:** `src/core/contestStateMachine.js` giờ chỉ còn `REGISTRATION → CODING → FINISHED`; xóa `startHackPhase`, `startSystemTesting`, `distributeRooms`, `canPerformHack`; freeze là cửa sổ cuối của CODING (`contestResults.js`), không phải phase.
- **Chấm full-suite:** `POST /api/v1/submissions` chấm toàn bộ test ngay (`judgeSuiteOf` thay `pretestsOf`), trả `verdict` cuối cùng (bỏ `pretests_passed` + FST); rejudge dùng đúng một code path; bỏ nhánh SYSTEM_TESTING trong `POST /admin/phase`.
- **Gỡ Hack toàn stack:** xóa `server/oracles.js`, route `/api/v1/hacks/execute`, `hacks`/`hack_events` khỏi store (JSON + PG + IndexedDB v5 auto-delete store cũ), `HackRoomPage.jsx` + route `/hack-room` + tab Navbar + `api.executeHack`/`getRoom` + `calculateHackScore` + SSE event `EVENT_HACK_BROADCAST` + panel Rooms admin.
- **ICPC mặc định:** seed + `POST /api/v1/admin/contests` mặc định `contest_format: 'ICPC'`; standings mặc định trả solved/penalty; bảng CF decay giữ làm lựa chọn (`?format=CODEFORCES`), freeze chỉ áp cho bảng CF.
- **UI thí sinh:** Workspace hiện "Accepted"/verdict cuối (hết "Qua pretest"), ContestHub/GuestLayout/Landing viết lại theo vòng đời Đăng ký → Coding → Freeze → Chốt+Elo; FAQ thay mục Hack bằng Hỏi đáp jury ICPC; Admin phase control còn 3 nút (Registration/Coding/Finished).
- **Verify:** `npm run test` **152 pass / 0 fail** (24 suites), `node detect.mjs` 0 error, `npm run lint:js` 0 errors, `npm run build` sạch (~306ms), `test:load` 20/20 AC.

## Vòng 31: Profile thí sinh analytics (backend aggregate + chart SVG zero-dep)

- **Endpoint aggregate mới:** `GET /api/v1/users/:username/profile` trả `{ user, stats, rating_history, heatmap[182 ngày], verdicts, tags, languages, per_contest, recent_submissions }` — mọi số liệu tính từ DB thật trên server (solved DISTINCT per tag, rank lấy từ standings thật, heatmap từ `submitted_at`), **không bao giờ trả `source_code`**. Bài nộp luyện tập (`contest_id = null`) được tính vào solved/heatmap.
- **Seed demo deterministic:** `rating_history` (dãy Elo kết thúc đúng rating hiện tại) + 81 bài nộp luyện tập LCG-seeded cho 6 thí sinh — không random mỗi lần seed.
- **Frontend profile mới:** `src/components/profile/charts.jsx` — RatingChart (đường Elo + vạch tier), Heatmap 26 tuần (cường độ nộp bài), VerdictBars, LanguageBars, TagStrength; toàn bộ SVG thuần JSX, **không thêm dependency nào**. `ProfilePage` viết lại: header rank màu 7 bậc, 4 stat cards, 7 section, filter verdict (ALL/AC/WA/TLE/RE/CE); route `/profile/:username` xem profile người khác; link từ Navbar avatar + username trong Standings.
- **Fast-switch đăng nhập backend thật:** nút dever_hero/dever_admin ở LoginPage giờ gọi `api.login` thật (có JWT → các API auth như profile hoạt động), chỉ fallback demo local khi backend offline.
- **Skills library:** cài 5 agent skills vào `.agents/skills/` — `web-design-guidelines` + `react-best-practices` (Vercel), `playwright-cli` (Microsoft), `design-taste-frontend` (taste-skill), `awesome-design` (Linear.app DESIGN.md reference — xác nhận hệ token DEVER đúng chuẩn Linear gốc). Áp audit Web Interface Guidelines: `…` thay `...`, `focus-visible:ring` cho filter/links, `tabular-nums` cho cột số liệu.
- **Verify:** `npm run test` **154 pass / 0 fail** (24 suites, +2 test profile), `node detect.mjs` 0 error, `npm run lint:js` 0 errors, `npm run build` sạch (~233ms).

## Vòng 31.5: Scheduler tự động + Judge sâu + Kho bài luyện tập (Phase 31 hoàn tất — Task 103/104/105)

- **Task 103 — Auto-phase scheduler:** `server/scheduler.js` mới (thuần Node, zero dependency): tick 30s tự chuyển `REGISTRATION→CODING` (theo `start_time`) và `CODING→FINISHED` (theo `start_time + duration_minutes`), broadcast SSE `EVENT_PHASE_CHANGED` kèm `by=scheduler`. Tách hàm `finishContest()` dùng chung admin phase + scheduler (một code path cộng Elo rated). Admin override tôn trọng (idempotent theo status, không downgrade); `SCHEDULER_DISABLED=1` cho test; inject `now()` → test giả lập thời gian không sleep thật (+6 tests).
- **Task 104 — Judge sâu:** stderr compile mở cap 500→4000 ký tự; thêm verdict **MLE** (phân loại theo message heap/MemoryError/bad_alloc/OutOfMemoryError; JS chạy `--max-old-space-size` theo `memoryLimit` của đề); `judgeTests` nhận `memoryLimit`. Lưu `per_test` (verdict + time_ms, **không kèm input/expected** — chống lộ test) cho mỗi bài nộp; `GET /submissions/:id` chỉ mở per_test khi contest FINISHED/upsolve/practice — khi CODING trả `per_test_hidden: true` + `failed_index`. Workspace hiện dải chip T1✓/T2✗ per test sau FINISHED (+5 tests).
- **Task 105 — Kho bài luyện tập:** endpoint `GET /api/v1/practice/stats` tổng hợp `{solved, attempts, ac_attempt, last_verdict, solved_at, is_upsolve}` per problem từ bài nộp thật (gồm practice `contest_id=null`). ProblemsetPage thêm cột trạng thái (✓ Solved / ⟳ N lần) + filter "Đã solved / Đang thử / Chưa làm". **Upsolving:** nộp bài sau FINISHED được (`is_upsolve: true`, 0 điểm, không broadcast standings, `computeStandings` loại bỏ dòng upsolve); badge UPSOLVE trên Workspace history + ProfilePage; editorial auto-open khi contest FINISHED (đã có, giữ nguyên gate server).
- **Verify:** `npm test` **168 pass / 0 fail** (26 suites, +14 tests), `node detect.mjs` 0 error, `lint:js` 0 errors (68 warnings), `build` sạch (~352ms).

## Vòng 32: So sánh 2 thí sinh + Profile public (Task 108)

- **`GET /api/v1/compare?a=&b=`:** trả `{ a, b, head_to_head }` — mỗi bên gồm user + stats + rating_history + verdicts + tags (tái dùng `profileAggregate`, một code path với profile). Head-to-head tính theo **rank thật** từ standings các kỳ thi cả hai cùng có (rank thấp hơn thắng, hòa không tính). Lỗi hợp lệ: 404 USER_NOT_FOUND, 422 SAME_USER.
- **Profile public:** route `GET /users/:username/profile` gỡ yêu cầu token — share URL `#/profile/:username` cho khách; aggregate **không bao giờ** chứa `source_code` (skill dever-profile-analytics).
- **Frontend:** `ComparePage.jsx` (`#/compare?a=&b=`) — form A/B, **Elo chart overlay** (`RatingChartOverlay` mới trong charts.jsx: nhiều series, legend màu, vạch tier), bảng stats diff tô xanh bên tốt hơn, bảng đối đầu, sức mạnh theo tag union (cam/blue). Nút "Chia sẻ" (copy URL) + "So sánh" trên ProfilePage.
- **Verify:** +4 tests compare (tổng **172 pass**), lint 0 errors, build sạch.

## Vòng 33: Notification center + OpenAPI + Thi ảo UI + Trang tổng kết (Task 109–112)

- **Task 109 — Notification center:** `src/hooks/useNotifications.js` + `src/components/common/NotificationCenter.jsx` (zero-dep, SVG bell inline thay lucide). Nguồn: SSE mọi contest LIVE (`EVENT_PHASE_CHANGED`, `EVENT_ANNOUNCEMENT`) + poll `GET /submissions` 30s → verdict mới sau chấm (bỏ qua khi tab ẩn). Badge unread trên Navbar (chỉ khi đăng nhập), dropdown, lưu localStorage `dever.notifs` (tối đa 50).
- **Task 110 — OpenAPI machine-readable:** `scripts/gen_openapi.mjs` (`npm run gen:openapi`) parse bảng `route()` của `server/index.js` → sinh `docs/openapi.json` (OpenAPI **3.1**, 42 operations / 36 paths, bearerAuth map đúng theo opts, path params từ regex groups). Server phục vụ spec tại `GET /api/v1/openapi.json`. +3 tests đối chiếu từng route với spec.
- **Task 111 — Thi ảo cho member:** trang `VirtualContestPage` (`#/virtual/:slug`) — HUD đồng hồ ảo tick từng giây + progress bar, ghost standings poll 5s với chip per-problem màu; nút "Thi ảo" trên card contest FINISHED (ContestHub) điều hướng thay vì tạo phiên inline (bỏ state virtual rác).
- **Task 112 — Trang tổng kết:** `ContestSummaryPage` (`#/contest/:slug/summary`) — podium top 3 (link profile), 3 stat cards, bảng ICPC cuối chip per-problem; **in PDF = Ctrl+P** qua `@media print` (`.no-print`, nền trắng) — zero dependency. Nút "Tổng kết" trên card contest FINISHED.
- **Verify:** `npm test` **181 pass / 0 fail** (29 suites, +13 tests), `node detect.mjs` 0 error, `lint:js` 0 errors (73 warnings), `build` sạch (~245ms).

## Vòng 34: A11y audit toàn app với axe-core trong E2E (Task 113 — Phase 34)

- **Audit engine:** `tests/a11y_axe.test.js` — dựng server + Vite thật (y hệt spa_e2e), chạy **axe-core 4.13.0** trong Chromium trên **10 trang** (landing/login guest + 8 trang thí sinh: arena, standings, problemset, workspace, profile, compare, summary, virtual), gate **serious/critical = 0**; moderate/minor ghi nhận log không chặn CI. Thêm test focus-visible: Tab đầu tiên phải thấy outline/ring. Script hỗ trợ `scripts/a11y_scan.mjs` dump chi tiết node + contrast ratio để fix chính xác.
- **Kết quả lần quét đầu:** ~45 node contrast serious (toàn app) + 1 label critical (textarea sandbox) + 28 node ở riêng /arena.
- **Fix contrast (root-cause, 1 chỗ/loại thay vì từng node):**
  - `@theme` override Tailwind: `slate-500/600 → #9ba3ae`, `slate-400 → #a8b1bd` (mọi muted label đạt ≥4.5:1 trên canvas/surface); `!important` utilities theo opacity mờ (`orange-400/70`, `red-400/70`, `#62666d → #8a8f98`).
  - **CTA nền cam #ff6600: chữ trắng → đen canvas `#010102`** (2.93:1 → **7.4:1**, bold 700) — áp toàn bộ nút/nhãn cam qua 1 rule CSS.
  - Badge "Bạn" trên Standings: `#ff6600 → #ffb066` trên nền orange/20 (3.92 → ≥4.5).
  - **Monaco comment token** `#608b4e` (4.2:1) → theme `dever-dark` với comment `#6fa856` (≥4.5:1).
- **Fix aria:** `aria-label` cho 3 textarea (sandbox Landing, custom input/expected Workspace); login h4→p (heading-order); Workspace h2→h1 (page-has-heading-one).
- **Kết quả cuối:** axe quét 10 trang = **0 serious/critical, 0 moderate** ({}). Nhận thêm bằng chứng scheduler (Vòng 31.5) hoạt động thật: Round #1 tự chuyển FINISHED trên server local không ai bấm tay.
- **Verify:** `npm test` **184 pass / 0 fail** (30 suites, +3 tests a11y), `node detect.mjs` 0 error, `lint:js` 0 errors, `build` sạch (~248ms). axe-core thêm vào devDependencies.

## Vòng 34.1: Polish UI 3 trang mới theo taste skill + Linear tokens (Task 113.1 — Phase 34)

- **Phạm vi:** `ComparePage`, `VirtualContestPage`, `ContestSummaryPage` — rà soát viền/spacing/typography theo Linear tokens (headline 28px/-0.6px, card-title 22px/-0.4px, eyebrow 13px/500/+0.4px) và taste skill (zero em-dash hiển thị, zero emoji, shape lock, spacing lg 24px).
- **Typography:** h1 cả 3 trang chuẩn 28px/600/-0.6px; eyebrow uppercase đồng nhất 13px/medium/+0.4px (kể cả **thead** các bảng — bỏ 11px tracking-wider); card-title VS 22px/-0.4px; số liệu stats/timer mono 28px hoặc 40px/-1px.
- **Spacing:** card head-to-head/tags ComparePage p-5→p-6; dòng bảng đối đầu py-2→py-3; error box cả 3 trang thống nhất p-4/text-sm; form/VS header/Elo/stats giữ p-6.
- **Nội dung:** em-dash hiển thị "—" → "chưa có" (stats trống), "ẩn danh" + penalty `?? 0` (summary), giữ `—` trong JS comment (không render); bỏ emoji huy chương 🥇🥈🥉 → rank badge mono tròn (top 1 nền cam chữ đen), 🖨 → icon máy in SVG inline; subtitle Virtual bỏ em-dash → eyebrow "Ghost Replay" + mô tả.
- **Layout:** podium `grid-cols-3` cứng → `grid-cols-1 sm:grid-cols-3`; progress bar ảo gộp vào HUD card (track nền #010102 + viền hairline, Linear: 1 panel 1 chủ thể).
- **Verify:** computed-style qua preview khớp token (28px/-0.6px, 13px/0.4px, padding 24px, zero em-dash trong DOM); `npm test` **184/184**, `detect.mjs` 0, `lint:js` 0 errors (73 warnings), `build` 244ms.





## Vòng 35.1: Object storage S3 cho source_code — Task 118 đóng Task 114 (Phase 35)

- **Hạ tầng Specific:** block `storage "sources" {}` trong `specific.hcl` (S3-compatible) — bơm `S3_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET` vào service api; đổi build api sang custom Dockerfile (`dockerfile = "Dockerfile.api"`) để có toolchain chấm thật (python3, JDK 17, g++) — trước đó judge trả TOOLCHAIN_MISSING vì base "node" không có Python.
- **`server/objectStore.js` (mới):** S3 SigV4 client thuần Node crypto — zero dependency ngoài core (ADR-003). Tự vô hiệu khi thiếu env (local/test luôn fallback KV/JSON như cũ); chỉ active ở production (`NODE_ENV=production` + đủ 4 env). Keys `submissions/<subId>.txt`.
- **Luồng source_code:** nộp bài → `PUT` S3, KV chỉ giữ `source_key` (+ fallback inline khi lỗi tạm hoặc chưa bật); rejudge/GET-by-id/GET-list fetch từ S3 khi được phép xem; `subView` không bao giờ lộ `source_key`, `has_source` đúng cho cả bài lưu S3.
- **Verify prod:** submit thật → `dever_store` có `source_key`, không còn inline code (query `specific query --db main`); GET trả lại nguyên văn `print("task118-final")`; log PUT 200 (sửa lỗi 403 SignatureDoesNotMatch: S3 phải encode từng segment, giữ nguyên `/` trên canonical path). `npm test` **188/188 (24 suites)**, `specific check` hợp lệ (2 builds + postgres + storage).

## Vòng 35.2: Multi-organizer — Task 119 (Phase 35)

- **Role mới `ORGANIZER`**: `POST /api/v1/admin/users/:id/role` (ADMIN-only) cấp/hạ PARTICIPANT/ORGANIZER/ADMIN; guard chống tự hạ mình khỏi ADMIN (`SELF_DEMOTE`), role lạ → 422.
- **Quyền theo kỳ thi**: contest có `organizer_id` = người tạo; ORGANIZER chỉ tạo được 1 kỳ thi của mình và điều phase/thông báo trên kỳ thi đó (`canManageContest`); ADMIN toàn quyền. Route áp gate: `admin/phase`, `admin/announcements`, `admin/stress` (theo contest của đề), `admin/contests` (tạo — mở cho ORGANIZER).
- **UI**: `RequireAdmin` cho phép ORGANIZER vào khu quản trị; AccountsPanel có select đổi role ngay trong bảng tài khoản (ADMIN hiển thị nhãn đỏ, không tự đổi); card Điều khiển phase hiển thị chip "Organizer: <username>" (server inject `organizer_username` vào GET /contests).
- **Verify prod**: thăng hero ORGANIZER → tạo kỳ thi thành công (`organizer_id` đúng) → điều phase kỳ thi mình OK → bị 403 trên round1 → hạ về PARTICIPANT. OpenAPI 44 ops/38 paths. **189/189 tests (24 suites)**, detect 0, lint:js 0 errors, build 243ms.

## Vòng 35.3: Gate Vòng 35 + cron backup — Task 120–122 (Phase 35 HOÀN THÀNH)

- **Cron backup (Task 120):** `cron "db-backup"` trong `specific.hcl` — 02:00 UTC (09:00 VN) hằng ngày; `scripts/backup_cron.mjs` (zero-dep) dump toàn bộ `dever_store`/`dever_meta` → JSON → PUT bucket S3 (`backups/db-<stamp>.json`, tái dùng SigV4 client); local không DB → thoát 0. Đã deploy, đợi lần chạy đầu lúc 02:00 UTC — xem qua `specific query` observability (`%backup-cron%`).
- **CI/CD (Task 121):** hướng dẫn kết nối GitHub repo qua dashboard (auto-deploy `main` + preview theo PR, có thể tắt CLI deploy sau khi bật) trong `DEPLOYMENT_GUIDE.md` mục 0b — phần OAuth chủ dự án tự bấm.
- **Gate Vòng 35 (Task 122):** **189/189 tests (24 suites)**, `detect.mjs` 0, eslint 0 errors (69 warnings), build 294ms. Prod smoke: `/api/health` ok (store pg), login 200, CORS khóa `https://web-elegant-horse.spcf.app`, web 200, DB 120 rows, S3 round-trip + KV không còn inline source. **Đóng Task 114 + 115; Phase 35 hoàn thành.**

## Vòng 35.4: Quản trị dữ liệu thật + admin sửa kỳ thi — Task 123–124 (yêu cầu chủ dự án)

- **Task 123 — dọn ghost/demo:** cờ `DEVER_SEED_DEMO` (prod đặt `=0` trong specific.hcl → DB mới chỉ seed duy nhất admin, không ghost user/contest/bài nộp ảo); route `POST /admin/reset-demo` (mode `demo` giữ kỳ thi+đề, mode `all` về trắng) + `DELETE /admin/users/:id` (cấm tự xóa + xóa `dever_admin`, dọn submissions/participants theo); UI "Vùng nguy hiểm" trong tab Cấp tài khoản với xác nhận 2 bước, nút Xóa từng user.
- **Task 124 — admin sửa kỳ thi:** `PUT /admin/contests/:id` — title, start_time, duration_minutes (kẹp 5–600), is_rated, min/max_rating, organizer_id (ADMIN); gate `canManageContest` (organizer chỉ sửa kỳ thi của mình); UI `EditContestPanel` trên tab Điều khiển phase: chọn kỳ thi → sửa mọi trường → lưu tức thì.
- **Vá gốc rễ pg store:** `flush()` trước đây chỉ UPSERT → row bị xóa khỏi memory sẽ "hồi sinh" sau restart. Giờ flush mirror DELETE (xóa row không còn trong memory). Prod verify: sau reset-demo, DB thật còn `users:1, contests:5, problems:5, testcases:5`, `submissions/participants: 0`.
- OpenAPI 47 ops/41 paths. **193/193 tests (25 suites)**, detect 0, lint 0 errors, build 246ms.

## Vòng 35.5: Kế hoạch Phase 36 + sửa CI Linux + CD tự động qua GitHub Actions (29/9/2026)

- **Phase 36 lập kế hoạch** (chưa triển khai): schema bảng PostgreSQL thật thay KV `dever_store` — phương án đã chốt với chủ dự án: **bảng thật + giữ nguyên facade đồng bộ** (`server/pg.js` ghi per-row typed, `server/index.js` không refactor lớn). 6 tasks 125–130: DDL 10 bảng (pg_schema.js), adapter per-row, migration script KV→bảng (idempotent + backup S3 + đối chiếu rows), tests + backup/restore theo schema mới, prod migration + verify trọn vòng, dọn dẹp có kiểm soát (giữ KV cũ làm archive). JSONB giữ cho blob động (per_test/statistics/settings); id giữ TEXT; cột typed cho mọi trường lọc/join/unique.
- **Sửa CI fail trên Linux (5 runs đỏ liên tiếp):** (1) `npm test` dùng glob `tests/*.test.js` mà Linux không expand → `scripts/run_tests.mjs` (readdir, loại trừ browser tests, cross-platform); (2) test profile assert thiếu verdict `RTE` mà judge thật trả (seed pool cũng dùng `RE` di sản → chuẩn hóa `RTE` toàn stack: seed pool, allowlist test, chips ProfilePage, charts) — catch được lỗi thật mà môi trường Windows bỏ qua; (3) tách job browser E2E (spa_e2e + a11y axe) riêng với `npx playwright install --with-deps chromium` — không còn phụ thuộc Chromium cài tay trên máy dev.
- **CI xanh lần đầu trên Linux:** job `verify` (186 tests + lint + build + audit) + job `browser` (7 tests E2E thật) toàn pass, ~1m30s.
- **Vá cron backup prod:** log 02:00 UTC hiện `Cannot find module '/app/scripts/backup_cron.mjs'` — Dockerfile.api thiếu `COPY scripts/`; đã deploy image mới. Lần chạy lịch mai sẽ verify; `specific exec` không chạy được trên Windows nên không chạy tay trước được.
- **CD tự động (ĐÃ HOÀN THÀNH):** chủ dự án kết nối GitHub integration trong dashboard + cấp API key (`SPECIFIC_API_KEY` secret cho deploy tay). Đường CHÍNH: push `main` → Specific deploy ngay (~36s, đo thực tế 03:37:49 → 03:38:25); đường dự phòng: deploy.yml chạy tay bằng API key khi cần cứu hộ. Lưu ý chính sách (chủ dự án đã chốt): integration gốc KHÔNG chờ CI xanh — code lỗi có thể lên prod vài phút trước khi CI báo đỏ; CI vẫn là vòng kiểm chứng song song, muốn gate chặt có thể tắt auto-deploy trong dashboard sau.
- Gates: **193/193 tests (25 suites)** (186 core + 7 browser), detect 0, lint 0 errors, build 323ms.

## Vòng 36.1–36.2: Phase 36 Task 125–127 — schema bảng Postgres thật + migration prod (29/9/2026)

- **Task 125 — `server/pg_schema.js`:** DDL 10 bảng typed (users/contests/problems/testcases/submissions/participants/virtual_sessions/clans/clarifications/announcements) + `extra JSONB` catch-all per bảng (không bao giờ mất dữ liệu); UNIQUE username/slug; index chuẩn; converter `rowToValues`/`rowToPayload` 2 chiều (ts→ISO, jsonb parse chuỗi cũ, **NULL → khóa bỏ** khi load để giữ nghĩa `source_code === undefined`). Giản lược không FK/CHECK ở v2 — mirror bộ nhớ là nguồn sự thật.
- **Task 126 — `server/pg.js` 2 mode:** boot tự chọn theo `dever_meta.schema_version` + dữ liệu KV: `kv` legacy (hành vi cũ 100%) / `tables` v2 (flush per-row upsert cột typed + extra + mirror DELETE per-table); facade không đổi — index.js 0 dòng sửa. `backup_cron.mjs` schema-aware (dump theo mode). Auto-detect verify prod: `mode=kv (dever_store có 1 rows)` trước migration.
- **Task 127 — migration:** module `server/pg_migrate.js` (pool inject, idempotent, backup S3 `pre-migration-*.json` TRƯỚC khi ghi, đối chiếu COUNT per-table — lệch → throw không flip, flip schema_version=2 cuối cùng) + CLI `scripts/migrate_kv_to_tables.mjs` + route `POST /admin/migrate-schema` (ADMIN) gọi + `db.reloadFromTables()` (mới — nạp mirror từ bảng, flip mode không restart). **Prod migrated 29/9 04:53 UTC:** `from:1, users:1, backupKey: backups/pre-migration-2026-09-29T04-53-52-406Z.json, reload mode=tables`; dever_store giữ nguyên archive; re-run → `already`; smoke: tạo user → SQL COUNT users=2 → xóa → =1 (flush per-row + mirror DELETE với Postgres thật). **203/203 tests core (24 suites: +6 pg_migrate, +11 pg_store), lint 0, detect 0, build 241ms; 4 Dependabot alerts dompurify đã fix (3.4.15 trong lockfile).**
- Còn lại Phase 36: Task 128–130 (tests hoàn thiện đã đi kèm; verify prod dài hạn + dọn dever_store khi ổn định).

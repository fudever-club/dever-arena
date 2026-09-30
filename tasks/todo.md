# Task List: DEVER-Forces Enterprise Platform

## Phase 1: Core Calculation Engines & Logic (TDD)
- [x] Task 1: Xây dựng `src/core/scoring.js` (Codeforces Dynamic Decay) kèm Unit Test `tests/scoring.test.js` (PASSED 6/6)
- [x] Task 2: Xây dựng `src/core/rating.js` (Thuật toán Elo Codeforces) kèm Unit Test `tests/rating.test.js` (PASSED 4/4)
- [x] Task 3: Xây dựng `src/core/contestStateMachine.js` kèm Unit Test `tests/contest.test.js` (PASSED 5/5)
- [x] Task 3.1: Mở rộng thể thức ICPC (20-min penalty) & IOI Subtasks kèm Unit Test `tests/icpc_scoring.test.js` (PASSED 3/3)
- [x] Task 3.2: Xây dựng Anti-Cheat AST Tokenizer `src/engine/astDiff.js` kèm Unit Test `tests/astDiff.test.js` (PASSED 3/3)

## Checkpoint 1: Core Engines PASS (21/21 Unit Tests PASS 100%)

## Phase 2: Enterprise Documentation Suite
- [x] Task 4: Soạn thảo `docs/CONTEST_RULEBOOK.md` (Quy chế thi đấu 4 Division, Hack phase)
- [x] Task 5: Soạn thảo `docs/ANTI_CHEAT_POLICY.md` (Chính sách liêm chính, cấm AI, xử phạt)
- [x] Task 6: Soạn thảo `docs/JUDGE_ARCHITECTURE.md` (Kiến trúc Isolate sandbox, queue 3 tầng)
- [x] Task 6.1: Soạn thảo `docs/DATABASE_SCHEMA.md` (12 bảng PostgreSQL, ERD, Indexing)
- [x] Task 6.2: Soạn thảo `docs/API_SPECIFICATION.md` (RESTful endpoints, WebSocket protocols)
- [x] Task 6.3: Soạn thảo `docs/PROBLEM_SETTING_GUIDE.md` (Chuẩn Polygon & testlib.h)
- [x] Task 6.4: Soạn thảo `docs/DEPLOYMENT_GUIDE.md` (Docker Compose, Nginx SSL, cgroups)

## Phase 3: Problemset & Sandbox Engines
- [x] Task 7: Tạo bộ bài toán chuẩn `src/data/problems.js` và `problems/` (5 bài toán đa dạng kèm Editorial)
- [x] Task 7.1: Xây dựng Web Audio Synthesizer `src/engine/sound.js`
- [x] Task 7.2: Xây dựng In-Browser Runner & Templates `src/engine/runner.js`

## Phase 4: Full Enterprise Web Application
- [x] Task 8: Thiết kế Design System Cyber Dark & FPT Orange Pro `css/style.css` (8 màn hình, Theme Obsidian/Monokai/Cyber, Clan cards, Diff styling)
- [x] Task 9: Xây dựng cấu trúc HTML `index.html` (Contests, Problemset, Clan Wars, Virtual Simulator, Polygon CMS, Live Status, Anti-Cheat Radar, Profile, Visual Line Diff Modal)
- [x] Task 10: Xây dựng tương tác Master Controller `js/app.js` (Điều hướng 8 view, thảo luận discussion upvote, xuất bản bài mới trong Polygon, Custom test, Hack room, Visual Diff, tải file code)

## Phase 5: Product Quality & Ticker Hardening (Looping & QA)
- [x] Task 11: Chuẩn hóa Footer & Contract 3 trang qua `detect.mjs` (0 errors PASS 100%)
- [x] Task 12: Xây dựng Real-time Contest Ticker & Progress Bar đếm ngược từng giây (`setupContestTimer`)
- [x] Task 13: Xây dựng Cơ chế đồng bộ Phase liên tab (Cross-Tab Phase Synchronization via `storage` event)
- [x] Task 14: Xây dựng Deep Hash Router (`handleAppHash` & `initAppHashRouter` cho views, subtabs, problem direct links)
- [x] Task 15: Xây dựng 1-Click Sample Test Runner & Output Diff trong Workspace (`setupSampleTestRunner`)
- [x] Task 16: Bổ sung Test Suite chất lượng nền tảng `tests/platform_quality.test.js` (6 tests mới)
- [x] Task 17: Hội đồng Đa Tác Tử (5-Agent Council) giám định & vá bảo mật Sandbox Browser (`runner.js` blocked APIs) + 2-Click Non-blocking DQ Modal

## Checkpoint 3: Complete QA Verification
- [x] Toàn bộ 62/62 unit & E2E tests PASS 100% (16 suites).
- [x] Script kiểm tra cấu trúc `node detect.mjs` đạt 0 error (PASS 100%).
- [x] Toàn bộ endpoint web HTTP phản hồi 200/301 sẵn sàng trên `http://localhost:5173`.

---

## Phase 6: Virtual Contest Simulator & Multi-Contest System (Completed)
- [x] Task 18: Xây dựng Virtual Contest Engine `src/core/virtualContest.js` (Ghost Submissions Replay theo thời gian ảo, Dynamic Standings)
- [x] Task 19: Mở rộng `src/db/api.js` & `seed.js` hỗ trợ Multi-Contest (Div.1, Div.2, Div.3, Division eligibility gate theo Elo)
- [x] Task 20: Tích hợp giao diện Virtual Contest trên `arena.html` & `index.html` (Virtual Timer HUD, nút tham gia thi ảo, deep hash `#virtual-`)
- [x] Task 21: Viết bộ kiểm thử `tests/virtual_contest.test.js` (5 tests PASS 100%)

## Phase 7: Clan Wars Leaderboard & KaTeX Math Rendering (Completed)
- [x] Task 22: Xây dựng Engine xếp hạng bang hội `src/core/clanRating.js` (Top 5 thành viên power score, Harmonic Sum formula)
- [x] Task 23: Tích hợp bộ render KaTeX / LaTeX typography offline-safe cho Đề bài & Editorial (`renderMathTypography`)
- [x] Task 24: Viết bộ kiểm thử `tests/clan_wars.test.js` và nâng tổng số kiểm thử lên 78 tests PASS 100%

## Checkpoint 4: Phase 6 & 7 QA Verification
- [x] Toàn bộ 78/78 unit & E2E tests PASS 100% (20 suites).
- [x] Script kiểm tra cấu trúc `node detect.mjs` đạt 0 error (PASS 100%).
- [x] Toàn bộ 5 endpoint web HTTP phản hồi 200 OK trên `http://localhost:5173`.

---

## Phase 8: Offline Judge Sandbox Engine & 3-Tier Priority Queue (Completed)
- [x] Task 25: Xây dựng `src/engine/workerQueue.js` (Hàng đợi ưu tiên 3 cấp: Hack > Pretest > System Test)
- [x] Task 26: Xây dựng `src/engine/isolateRunner.js` (Thực thi sandbox an toàn, fail-fast, timeout, verdicts AC/WA/TLE/MLE/RTE/CE)
- [x] Task 27: Viết bộ kiểm thử `tests/worker_queue.test.js` (7 tests PASS)

## Phase 9: Scoreboard Freeze & ICPC Dramatic Reveal Unfreeze Simulator (Completed)
- [x] Task 28: Xây dựng `src/core/scoreboardFreeze.js` (Đóng băng bảng điểm, trạng thái `?`, thuật toán sinh chuỗi unfreeze từ đáy bảng)
- [x] Task 29: Viết bộ kiểm thử `tests/freeze_scoreboard.test.js` (4 tests PASS)

## Phase 10: Polygon Problemsetter Testlib Validator & Custom Checker (Completed)
- [x] Task 30: Xây dựng `src/engine/testlibValidator.js` (Input validator, float checker với sai số $10^{-6}$, exact token checker)
- [x] Task 31: Viết bộ kiểm thử `tests/testlib.test.js` (9 tests PASS)

## Checkpoint 5: Phase 8, 9, 10 QA Verification & Production Readiness
- [x] Toàn bộ 98/98 unit & E2E tests PASS 100% (25 suites).
- [x] Script kiểm tra cấu trúc `node detect.mjs` đạt 0 error (PASS 100%).
## Phase 11: UI/UX Redesign — Cyber Dark & FPT Orange Pro (Completed)
- [x] Task 32: Nâng cấp Glassmorphism đa lớp (`backdrop-filter: blur(14px)`), viền sáng quang học cam và bóng đổ kép cho toàn bộ cards.
- [x] Task 33: Nâng cấp Digital Clock HUD eSports (neon glow, vạch kẻ đa sắc progress bar, phase pulse indicators).
- [x] Task 34: Nâng cấp hệ thống nút bấm (shimmer, hover lift `-2px`, active scale `0.98`, cyan secondary glow).
- [x] Task 35: Tích hợp huy chương vinh danh 🥇🥈🥉 Top 3 trên bảng điểm Standings và Virtual Standings.
- [x] Task 36: Thiết kế Console Header Bar 3 chấm Unix/macOS (🔴 🟡 🟢) và chip chỉ số thực thi tương phản cao.
- [x] Task 37: Kiểm định toàn bộ 98/98 unit/E2E tests PASS và `node detect.mjs` 0 errors PASS 100%.

## Phase 12: Comprehensive Playwright E2E Testing Suite (Completed)
- [x] Task 38: Xây dựng bộ test Playwright E2E `tests/e2e_playwright.mjs` tích hợp trình duyệt thực tế Microsoft Edge / Chromium headless.
- [x] Task 39: Kiểm thử trọn vẹn Landing Page Portal `index.html` (SEO, Duy nhất 1 H1, Hero, CTA, Bento grid, Theme switch, Mobile Hamburger responsive).
- [x] Task 40: Kiểm thử trọn vẹn Client Arena `arena.html` (Timer HUD, Subtabs navigation, Workspace problem loading, Code editor & runner, Console dots, Standings medals, Problemset search, Clan Wars).
- [x] Task 41: Kiểm thử trọn vẹn Admin Command Center `admin.html` (Freeze board, Phase transition, AST Anti-cheat similarity scanner, Polygon live preview, Telemetry judge cluster).
- [x] Task 42: Đạt 100% tỷ lệ vượt qua: 47/47 tests PASS, chụp 4 ảnh bằng chứng giao diện HD tại thư mục artifacts.

## Phase 13: Modern React SPA, Workspace Ergonomics, KaTeX Typography, Polygon Problemsetter Studio & 9Router De-integration (Completed)
- [x] Task 43: Tách biệt hoàn toàn Member Portal (`MemberLayout`) và Admin Command Center (`AdminLayout`) trên React 18 + Vite + Tailwind CSS v4.
- [x] Task 44: Xây dựng Không gian làm bài 3 phân vùng với Monaco Editor Pro (`ProblemWorkspace.jsx`).
- [x] Task 45: Tích hợp Resizable Splitters kéo thả 2 chiều (20-80%) và lưu cấu hình vào `localStorage`.
- [x] Task 46: Xây dựng Zen Mode 2 cấp độ (ẩn testcase & toàn màn hình phóng đại) kích hoạt nhanh bằng phím tắt `Esc`.
- [x] Task 47: Tích hợp KaTeX Math Typography Engine (`MathRenderer.jsx`) cho công thức toán học inline `$x$` và block `$$\sum$$`.
- [x] Task 48: Xây dựng Polygon Problemsetter Studio trong Admin Center: Thêm/Sửa/Xóa bài toán, KaTeX Live Preview và BroadcastChannel sync đa tab.
- [x] Task 49: Loại bỏ hoàn toàn 8 agent skills `9router*`, tuân thủ tuyệt đối triết lý Zero-AI Client theo `ADR-003`.
- [x] Task 50: Kiểm tra toàn diện chất lượng: 98/98 unit tests PASS, `detect.mjs` 0 errors, Vite production build hoàn tất sạch sẽ trong ~340ms.

## Phase 14: Backend API Thật + Judge Thật + Logo CLB (Completed)
- [x] Task 51: Xây dựng `server/` Node thuần (REST + SSE + JWT + judge JS/Python + hack oracle + Elo + virtual + division gate + Room 25)
- [x] Task 52: `tests/server_api.test.js` vòng đời đầy đủ (10 tests)
- [x] Task 53: `public/brand/` + favicon/PWA icons từ logo gốc, gắn Navbar/Login/Landing, `src/lib/apiClient.js` + nối 4 màn hình

## Phase 15: Xóa Clan Wars + Tài Khoản Admin Cấp + Dọn Icon + Sửa Chữ (Completed)
- [x] Task 54: Xóa Clan Wars (UI/server/engine/tests), user còn cá nhân/đội (`team`, `members`)
- [x] Task 55: `POST/GET /api/v1/admin/users` + tab Cấp tài khoản, không đăng ký công khai
- [x] Task 56: Gỡ `lucide-react` + emoji trang trí, SVG ngôn ngữ từ svgl.app, font Space Grotesk (subset Việt), sửa chữ + số liệu thật

## Phase 16: Nối Vòng Lặp Thi Đấu + Security + Judge Sâu + Production (Completed)
- [x] Task 57: Nối submit/hack/phase/timer/editorial vào backend (lỗi hiện rõ, khóa editorial đến FINISHED)
- [x] Task 58: Rate-limit + security headers + CORS env + production bắt buộc JWT secret
- [x] Task 59: Judge Java/C++ tự phát hiện toolchain + endpoint rejudge, rooms/telemetry admin đọc số thật
- [x] Task 60: `Dockerfile.api/web`, `nginx.conf`, `docker-compose.yml`, `.env.example`; verify 105/105 tests, lint 0, build sạch

## Phase 17: Xóa giao diện vanilla cũ — single-stack React SPA (Completed)
- [x] Task 61: Xóa `index.html`/`arena.html`/`admin.html`/`css`/`js`/`problems` + script e2e lỗi thời, viết lại `detect.mjs` + `platform_quality.test.js` cho SPA, docs chuyển single-stack.

## Phase 18: CRUD đề thi trên máy chủ + Freeze/ICPC phía server (Completed)
- [x] Task 62: `POST/PUT/DELETE /api/v1/admin/problems` + Admin Studio publish lên server + 7 tests.
- [x] Task 63: Module thuần `contestResults` (freeze/ICPC, 11 tests) đấu nối vào `GET standings` (`?frozen=1`, `?format=ICPC`) + nút đóng băng admin đồng bộ Standings + test vòng đời.

## Phase 19: Vá liêm chính hiển thị + luồng dữ liệu thật + mở kỳ thi (Completed)
- [x] Task 64: Escape HTML MathRenderer (chống stored-XSS), unfreeze demo-only, 401 auto-logout.
- [x] Task 65: Merge đề server giữ nháp, reset testcase theo bài, hack gate format-only, ContestHub list + đăng ký, standings cột động.
- [x] Task 66: `POST /api/v1/admin/contests` + form mở kỳ thi, test đầy đủ; verify 126/126 tests, lint 0, build sạch.

## Phase 20: E2E trình duyệt thật + chống treo process (Completed)
- [x] Task 67: `tests/spa_e2e.test.js` (landing, login JWT, standings live, submit Python chấm thật) + port riêng + kill cây process + proxy theo env; verify 130/130 tests, không mồ côi.

## Phase 21: Soạn đề server-only + worker riêng + ICPC tự động + Postgres (Completed)
- [x] Task 68: Bỏ persist đề localStorage, Studio 100% qua API, merge giữ nháp phiên.
- [x] Task 69: `server/queue.js` + `judgeWorker.js` (fork pool, timeout + respawn), test đồng loạt.
- [x] Task 70: ICPC auto theo `contest_format` + bảng điểm 2 chế độ, test vòng đời ICPC thật.
- [x] Task 71: Telemetry duyệt + chấm lại bài nộp, reset mật khẩu từng tài khoản, polygon chọn kỳ thi đích.
- [x] Task 72: Adapter Postgres (`server/pg.js`, service compose) + 4 tests pool giả; verify 136/136 tests, lint 0, build sạch.

## Phase 22: SDLC Ops — CI + Observability + Backup + Runbook + Load (Completed)
- [x] Task 73: `.github/workflows/ci.yml` (npm ci + detect + test + build + audit high), `CONTRIBUTING.md`.
- [x] Task 74: `GET /api/health`, `/api/v1/health`, `/api/ready` + log JSON mỗi request (`server/index.js`), `tests/health.test.js` (3 tests).
- [x] Task 75: `scripts/backup.mjs` / `restore.mjs` + `npm run backup/restore`, compose `healthcheck` + resource limits, `docs/ops/{INCIDENT_RUNBOOK,BACKUP_RESTORE,DATA_RETENTION}.md`.
- [x] Task 76: `scripts/load_test.mjs` (`npm run test:load`: 20 job đồng loạt, 20/20 AC ~413ms) + `lint:js`/`audit:high`; verify 139/139 tests, lint 0, build sạch.

## Phase 23: Design Library + Luxury-Minimal + Skills mới (Completed)
- [x] Task 77: `npx getdesign add` → `DESIGN.md` (Linear) + `docs/design-{linear,vercel,notion,apple}.md`; consensus 4 bản: 1 accent, cấm gradient/glow/shadow màu, body 400/display 600.
- [x] Task 78: 4 skills mới `dever-deploy-release`, `dever-live-ops`, `dever-ui-craft`, `dever-quality-gate` + SDLC Phase Gates vào orchestrator (Plan→Build→Verify→Deploy→Operate).
- [x] Task 79: Luxury-minimal refinement: khử neon `#00f0ff`/gradient/blur/colored-shadow toàn `src/` (grep 0 sót), canvas `#010102` + hairline, headline 600, CTA 8px không shadow; verify 139/139 tests, lint 0, build sạch.

## Phase 24: Gates thật + Production boot proof (Completed)
- [x] Task 80: Fix `lint:js` (script `|| true` vỡ trên Windows + thiếu config): `eslint.config.mjs` flat + `eslint` devDep + CI chạy `lint:js` → 0 errors (36 warnings).
- [x] Task 81: `.dockerignore` (chặn `.env`/data lọt image, context api 1.13kB), base `node:20→22-alpine` (20 EOL + EBADENGINE).
- [x] Task 82: Boot proof `docker compose up --build -d`: api **Healthy** (store **pg**, seed 7 users/4 contests), web 200, login `dever_hero` + 4 contests qua nginx; dọn `down -v` + xóa `.env` test.

## Phase 25: Tách 3 shell + Đại tu admin (Completed)
- [x] Task 83: `GuestLayout` (/, /login — bar gọn + footer) / `UserLayout` (Navbar thí sinh) / `AdminLayout` riêng + `RequireAuth`/`RequireAdmin` trong `App.jsx` (giữ đủ route strings hợp đồng).
- [x] Task 84: Admin luxury-minimal: sidebar surface-1 + hairline + nhãn QUẢN TRỊ, topbar canvas, nút phase neon đặc → neutral/accent, `AdminSection` header cho 6 modules, bỏ footer trùng Landing; verify 139/139 tests (E2E chạy trên shell mới), lint 0, build sạch.

## Phase 26: Polygon Generator + Stress + Blind-tester workflow (Completed)
- [x] Task 85: `src/engine/testGenerator.js` (seeded mulberry32, 5 bẫy biên, patterns) + `tests/test_generator.test.js` (6 tests).
- [x] Task 86: `POST /api/v1/admin/stress` (model vs brute qua worker pool, mismatches ≤5, gợi ý TL = 2× model max) + testcase CRUD + workflow DRAFT→IN_TESTING→APPROVED (queue ẩn editorial, cấm tự giao) + `tests/stress_workflow.test.js` (5 tests).
- [x] Task 87: Studio `StressPanel` (xem trước → chạy → áp TL → lưu pretests) + badge/nút Gửi duyệt/Duyệt/Từ chối + `TestingQueue` ở ContestHub; verify 150/150 tests, lint 0, build sạch.

## Phase 27: Page-Branch Program (page/* song song → main)
- [x] Task 88: Viết `docs/PAGE_BRANCHES.md` (manifest nhánh page/* + quy trình merge).
- [x] Task 89: Merge hạ tầng chung (`eslint.config.mjs` jsx coverage + `ContestContext.jsx`) — đi kèm merge page/landing đầu tiên, các nhánh còn lại mang diff giống hệt nên merge sạch.
- [x] Task 90: Merge nhánh lá `landing → contesthub → workspace → hackroom → standings` (mỗi nhánh file page riêng, không xung đột).
- [x] Task 91: 5 agent song song (admin/auth/backend/docs/design, worktree riêng): admin (overview dashboard, inline validation, testcase CRUD, bounds form), auth (login inline errors, tokens), backend (per-problem bounds + 3 tests), docs (audit stale + manifest), design (review tuân thủ).
- [x] Task 92: Merge `page/backend`, `page/admin` (1 xung đột indent, đã resolve), `page/auth`, `page/docs`. Sửa số liệu sai của docs agent: thực tế 153 tests / 25 suites (không phải 150/21).

## Phase 28: Merge integration + QA cuối (Completed)
- [x] Task 93: Sweep design toàn repo: chỉ còn 1 sót `app.html` body bg → canvas `#010102`; grep neon/gradient/glow/shadow màu = 0 hit.
- [x] Task 94: Full gate: 153/153 tests (25 suites), detect 0, lint:js 0 errors, build sạch, load 20/20 PASS, audit 0 high/critical.

## Phase 29: Hồ sơ Vòng 29 + Chốt định hướng sản phẩm (Completed)
- [x] Task 95: Ghi Vòng 29 vào `docs/CHANGELOG.md` (8 merge team: profile, problemset, banner, standings2, hackroom2, landing2, load-sre).
- [x] Task 96: Chốt định hướng với chủ dự án: platform nội bộ theo chuẩn quốc tế (ICPC/AtCoder/CSES) — gỡ Hack Phase + pretest/system-test, ICPC mặc định, đào sâu scheduler + kho bài + judge sâu.

## Phase 30: Đơn giản hóa vòng đời thi đấu chuẩn quốc tế (Completed — ADR-005)
- [x] Task 98: State machine 5 → 3 phase (REGISTRATION→CODING→FINISHED, freeze là cửa sổ cuối CODING) + unit test mới.
- [x] Task 99: Chấm full-suite trả verdict cuối ngay (bỏ pretests_passed/FST), rejudge một code path; server_api tests cập nhật (21/21).
- [x] Task 100: Gỡ Hack toàn stack: route hacks/execute + oracles.js + HackRoomPage + route /hack-room + stores hack (IndexedDB v5 auto-delete) + calculateHackScore + RoomsPanel.
- [x] Task 101: UI thí sinh bỏ nhắc hack/room/pretest; seed + tạo kỳ thi mặc định ICPC; Admin phase control 3 nút (Registration/Coding/Finished).
- [x] Task 102: Full gate: **152/152 tests (24 suites)**, detect 0, lint 0 errors, build sạch (~306ms), load 20/20 AC; CHANGELOG Vòng 29–30.

## Phase 31: Scheduler tự động + Judge sâu + Kho bài luyện tập (Completed)
- [x] Task 103: Auto-phase scheduler `server/scheduler.js` (tick 30s, inject now(), finishContest dùng chung, admin override tôn trọng) + `tests/scheduler.test.js` (6 tests).
- [x] Task 104: Judge sâu — stderr 4000 ký tự, verdict MLE + `--max-old-space-size` theo memoryLimit, `per_test` không kèm input/expected, mở sau FINISHED (`per_test_hidden`/`failed_index` khi CODING), chip per-test trên Workspace (+5 tests).
- [x] Task 105: `GET /practice/stats`, filter trạng thái ProblemsetPage, upsolve sau FINISHED (0 điểm, không vào standings, badge UPSOLVE), editorial auto-open (+3 tests).
- [x] Task 106: Gate Vòng 31+31.5: **168/168 tests (26 suites)**, detect 0, lint 0 errors, build ~352ms; CHANGELOG Vòng 31.5; README/SPEC 168 tests.

## Phase 31b: Profile thí sinh analytics (Completed 28/9/2026)
- [x] Task 107: `GET /users/:username/profile` aggregate (stats/heatmap/verdicts/tags/languages/per_contest, không lộ source_code) + seed rating_history + 81 practice submissions LCG; charts SVG zero-dep (RatingChart/Heatmap/VerdictBars/LanguageBars/TagStrength); ProfilePage mới + `/profile/:username` + link Navbar/Standings; fast-switch login backend thật; gate: **154/154 tests (24 suites)**, detect 0, lint 0 errors, build ~233ms.
- [x] Task 108: `GET /compare?a=&b=` + `ComparePage` (Elo overlay `RatingChartOverlay`, stats diff, head-to-head rank thật, tags union); profile public không token; nút Chia sẻ/So sánh trên ProfilePage (+4 tests).

## Phase 33: Nền tảng mở (Completed)
- [x] Task 109: Notification center — `src/hooks/useNotifications.js` + `src/components/common/NotificationCenter.jsx` (SSE + poll verdict, badge Navbar, localStorage `dever.notifs`, zero-dep SVG bell).
- [x] Task 110: OpenAPI 3.1 — `scripts/gen_openapi.mjs` + `npm run gen:openapi` → `docs/openapi.json` (42 ops/36 paths, bearerAuth map đúng) + route `GET /api/v1/openapi.json`; `tests/openapi.test.js` đối chiếu từng route (+3 tests).
- [x] Task 111: Virtual Contest UI member — `src/pages/VirtualContestPage.jsx` (`/virtual/:slug`) HUD timer + ghost standings poll 5s; nút Thi ảo trên ContestHub card FINISHED.
- [x] Task 112: Trang tổng kết — `src/pages/ContestSummaryPage.jsx` (`/contest/:slug/summary`) podium top 3 + bảng ICPC + `@media print` in PDF; `tests/phase33_ui.test.js` (+6 tests).
- [x] Task 117: Gate Vòng 32+33: **181/181 tests (29 suites)**, detect 0, lint 0 errors (73 warnings), build ~245ms; CHANGELOG Vòng 32/33; README/SPEC 181 tests.

## Phase 34: Backlog sau khi CLB dùng thật (Task 113–113.1 done; 114 half-done qua Specific; 114–115 → Phase 35)
- [x] Task 113: A11y audit — `tests/a11y_axe.test.js` (axe-core 4.13 trong Chromium, quét 10 trang, gate serious/critical = 0 + test focus-visible) + `scripts/a11y_scan.mjs` dump node/contrast; fix: @theme override slate-400/500/600 ≥4.5:1, CTA nền cam chữ đen #010102 (2.93→7.4:1) + badge Standings #ffb066 + Monaco theme dever-dark comment #6fa856, aria-label 3 textarea, h4→p login, h2→h1 workspace; +3 tests → **184/184 (30 suites)**.- [x] Task 113.1: Polish 3 trang compare/virtual/summary theo taste skill + Linear tokens: typography (h1 28px/-0.6px, card-title 22px/-0.4px, eyebrow 13px/+0.4px uppercase, thead cùng style), spacing p-6/py-3 px-4, viền hairline #23252a + surface ladder, em-dash hiển thị → text thay thế, emoji → badge mono/SVG, podium responsive, error box p-4; verify computed-style qua preview + **184/184 tests**, detect 0, lint 0 errors, build 244ms.
- [x] Task 114: Postgres production thật (bỏ store JSON, migration script) + object storage cho source_code. — ĐÓNG trong Phase 35 (Task 118 + 122): postgres "main" + storage "sources" trên Specific, prod live.
- [x] Task 115: Phân quyền multi-organizer (admin tạo admin, quản lý kỳ thi theo người phụ trách). — ĐÓNG trong Phase 35 (Task 119).


## Phase 35: Hoàn thiện hạ tầng Specific + phân quyền organizer (Completed 28/9/2026)
- [x] Task 118: Object storage S3 cho source_code (hoàn tất Task 114) — `server/objectStore.js` SigV4 zero-dep, `storage "sources"` trong specific.hcl, nộp bài PUT S3 / KV giữ source_key, rejudge + GET fetch từ S3, subView ẩn source_key, api build qua Dockerfile.api (toolchain chấm thật); prod verify round-trip `print("task118-final")` + KV không còn inline code; **188/188 tests (28 suites)**.
- [x] Task 119: Multi-organizer (nội dung Task 115) — role `ORGANIZER` + `POST /admin/users/:id/role` (chống tự hạ mình); contest có `organizer_id`, gate `canManageContest` trên phase/announcements/stress; ORGANIZER tạo được kỳ thi của mình; UI: select role trong AccountsPanel + chip organizer trên card phase + RequireAdmin mở cho ORGANIZER; prod verify trọn vòng; **189/189 tests**.
- [x] Task 120: Ops trên Specific — cron `db-backup` 02:00 UTC + `scripts/backup_cron.mjs` (dump KV → JSON → S3); hướng dẫn custom domain + alerts trong DEPLOYMENT_GUIDE (DNS/dashboard chủ dự án tự bật).
- [x] Task 121: CI/CD — hướng dẫn kết nối GitHub repo qua dashboard (auto-deploy main + PR preview, tắt CLI deploy sau khi bật) đã ghi trong DEPLOYMENT_GUIDE mục 0b; phần OAuth chủ dự án tự bấm.
- [x] Task 122: Gate Vòng 35 — 189/189 tests (24 suites), detect 0, lint 0 errors, build 294ms; prod smoke health/login/CORS/web/DB(120 rows)/S3 round-trip toàn xanh; CHANGELOG Vòng 35.1–35.3; đóng Task 114 + 115.
- [x] Task 123: Quản trị dữ liệu thật — DEVER_SEED_DEMO=0 trên prod, POST /admin/reset-demo + DELETE /admin/users/:id, UI Vùng nguy hiểm 2 bước; vá pg flush mirror DELETE (chống hồi sinh dữ liệu); prod verify users:1, submissions:0.
- [x] Task 124: Admin sửa kỳ thi — PUT /admin/contests/:id (title/start/duration/rated/rating window/organizer) + EditContestPanel UI; OpenAPI 47 ops/41 paths; 193/193 tests (25 suites).

## Phase 36: Schema bảng PostgreSQL thật + migration từ KV (Planned)
- [x] Task 125: DDL schema `server/pg_schema.js` — 10 bảng thật với cột typed; mỗi bảng cột `extra JSONB` catch-all (chống mất dữ liệu cũ/trường lạ); UNIQUE username + slug contests; index submissions(contest_id, user_id, problem_id, submitted_at DESC) + submitted_at DESC + per-table; idempotent. Giản lược theo payload thật: không FK/CHECK ở v2 (mirror bộ nhớ là nguồn sự thật), password/rating_history của users ở extra JSONB, converter rowToValues/rowToPayload 2 chiều (ts→ISO, NULL→khóa bỏ để giữ nghĩa `source_code === undefined`).
- [x] Task 126: Adapter 2 mode trong `server/pg.js` — boot tự chọn theo `dever_meta.schema_version` + tồn tại dữ liệu KV: mode `kv` legacy (DB còn dữ liệu — hành vi cũ 100%, prod hiện tại) và mode `tables` v2 (DB mới/trống bật ngay; flush per-row upsert cột typed + extra + mirror DELETE per-table); giữ nguyên facade + shape `data.*`; `backup_cron.mjs` schema-aware dump theo mode. **197/197 tests core (15 pg_store tests: kv 5 + tables 5 + converter 5)**.
- [x] Task 127: Migration `server/pg_migrate.js` + CLI `scripts/migrate_kv_to_tables.mjs` + route `POST /admin/migrate-schema` (ADMIN, gọi + reload ngay trên server đang sống — specific exec không chạy trên Windows); idempotent (already khi v2), backup S3 `backups/pre-migration-*.json` TRƯỚC khi ghi, đối chiếu COUNT per-table (lệch → throw KHÔNG flip), dever_store giữ nguyên làm archive. **PROD MIGRATED 29/9: users:1, schema_version=2, reload mode=tables không restart; re-run → already; tạo/xóa user → COUNT bảng thật 2→1**. 6 tests mới (203/203 core).
- [x] Task 128: Tooling backup/restore v2 hoàn chỉnh — `readTablesDump()` + `restoreFromDump()` (validate, pre-restore snapshot S3, TRUNCATE + nạp per-row typed, phục hồi seq, nhận cả dump kv); `backup.mjs` v2 dump JSON cùng định dạng backup_cron; `scripts/restore_pg.mjs` CLI; routes `GET /admin/backup-dump` (backup on-demand) + `POST /admin/restore-backup` (restore + reload mirror không restart); +4 tests → **210/210 core**. **E2E verify trên prod thật: dump → tạo restore_probe → restore → probe biến mất (401), users COUNT = 1, pre-restore snapshot lên S3.**
- [x] Task 129: Prod migration + verify — ĐÃ CHẠY 29/9/2026 04:53 UTC: backup S3 pre-migration, migrate `from:1 → users:1` schema_version=2, reload không restart; smoke trọn vòng (health/login/users/contests, tạo+xóa user COUNT 2→1); dever_store giữ archive rồi DROP ở Task 130. Verify cron backup hằng ngày theo dõi sau lần chạy lịch đầu 02:00 UTC 30/9.
- [x] Task 130 (sớm theo yêu cầu chủ dự án): `POST /admin/drop-legacy-kv` (guard schema v2, 3 tests) — **DROP dever_store trên prod 29/9 05:01 UTC** (chỉ còn dever_admin, backup S3 pre-migration là phương án phục hồi); DB còn 11 bảng (10 domain + dever_meta); `docs/DATABASE_SCHEMA.md` viết lại thành nguồn sự thật schema v2 (kiến trúc mirror+flush, 10 bảng, quan hệ logic, vận hành).
- [x] Bổ sung — 2 bug prod lộ khi chạy thử vòng đời thật (unit tests không bắt được vì fake pool không serialize như Postgres thật): (1) mảng JS cho cột jsonb → pg driver serialize Postgres array literal → `invalid input syntax for type json` → problems/testcases/participants không bao giờ ghi DB; vá jsonb luôn JSON.stringify; (2) bool undefined → INSERT NULL vi phạm NOT NULL; vá bool undefined→false + `buildUpsert()` bỏ cột NULL khỏi INSERT (DEFAULT áp dụng) dùng chung flush/migrate/restore. Cả 2 kèm regression test.
- [x] Nâng cấp CF-parity (tham khảo schema Codeforces của chủ dự án): `submissions.passed_tests/total_tests` (passedTestCount — bài WA vẫn hiện pass X/Y; ALTER IF NOT EXISTS tự áp dụng bảng có sẵn; submit+rejudge đều ghi) + `GET /contests/:slug/rating-changes` (engine rating.js; đang thi chỉ ADMIN/organizer preview, FINISHED công khai; unrated → rỗng). **213/213 core**; prod verify WA `passed 0/1`.

## Phase 36.5: Sprint 1 Ops — QA load test + SRE restore-drill (Completed 29/9/2026)
- [x] QA load test trên schema v2: 20/20 AC tổng 724ms (p50 451, max 713); 50/50 AC tổng 1676ms (p50 885, max 1665) — không suy hao so baseline ~413ms trước migration.
- [x] SRE restore-drill trên prod: script `scripts/restore_drill.mjs` 5 bước (FRESH dump/đối chiếu → DAMAGE reset-demo+probe → RESTORE từ dump → VERIFY row-by-row 10 bảng + probe biến mất → SMOKE login/health/rating). PASS 5/5 trên prod thật; pre-restore snapshot S3 hoạt động.
- [x] Bug drill bắt được: restore mất `created_at` (rowToPayload bỏ cột) → mọi đường restore/migrate ghi NOW() thay timestamp gốc. Fix: `created_at` thành cột typed 'ts' cả 10 bảng (`server/pg_schema.js`), flush thường không đổi; +2 regression tests → **215/215 tests (24 suites)**, detect 0, lint 0, build sạch; commit `bc82bf6` + `35b7edc` đã push/deploy.
- [x] Quirk ghi nhận: mirror đổi trong RAM, flush định kỳ (~1s trên prod) mới persist — drill phải poll chờ (`waitUntil`); cũng là bài test pipeline flush thật.
- [x] Alert flush DB thất bại — `flushStatus()` 2 store + log JSON `db_flush_failed`/`db_flush_recovered` + `/health` khối `flush` + `/ready` 503 khi degraded (DB_FLUSH_STALE > 60s); E2E prod verify 15:35 UTC; **219/219 tests**.
- [ ] Verify cron backup lần chạy lịch đầu 02:00 UTC 30/9 (09:00 VN) — chờ giờ chạy.

## Phase 37: Sprint 1b — Ra mắt Round #2 RATED (Planned, CEO duyệt 29/9/2026)
> Quyết định CEO: (1) Round #2 **RATED** — kích hoạt Elo thật; (2) lịch thi **Tối T4 7/10/2026, 19:00–21:00 VN (12:00–14:00 UTC)**, 120 phút; (3) scope **trọn gói A1–A8**; hạn sprint 2/10.
- [ ] A1: Verify cron backup lần chạy lịch 02:00 UTC 30/9 — dump lên S3, đối chiếu khớp prod bằng drill script (SRE-Backup). **PREP XONG 30/9:** backup_cron ghi marker `last_cron_backup_at` vào dever_meta; `node scripts/verify_cron_backup.mjs` (tuổi < 26h + đối chiếu counts) — chạy lúc 09:00 VN.
- [x] A2: Reset trắng prod — reset-demo mode `all` 30/9 02:10 UTC: users:1 (dever_admin), 0 contests/problems/submissions; Round #1 lưu trong `backups/pre-reset-round1-*.json` + snapshot S3 restore-drill (SRE + PO-Contest).
- [x] A3: Soạn bộ bài Round #2 — 4 bài ICPC rating 800–1300, workflow DRAFT→IN_TESTING→APPROVED, stress test + testcases đầy đủ (PO-Contest + Eng-Judge). XONG 30/9: 4 bài APPROVED, 59 testcases, solver AC toàn bộ.
- [x] A4: Mở kỳ Round #2 — contest is_rated=true, start 2026-10-07T12:00:00Z, 120 phút, REGISTRATION mở sớm; verify đăng ký hoạt động (PO-Contest). XONG 30/9: contest_25_munhjlk5 REGISTRATION; diễn tập trọn vòng thí sinh thật (Vòng 37.4).
- [x] A5: Bài đăng fanpage — draft 2 đợt đăng + checklist truyền thông: `docs/marketing/round2-fanpage.md`, chờ Design banner + CEO duyệt (PM + Design).
- [x] A6: Probe monitor — `scripts/probe_monitor.mjs` + cron Specific `probe-monitor` (* * * * *): /health + /ready + web, alert khi flush.stale / 503 / api xuống; probe xanh trên prod (SRE-Lead).
- [x] A7: Runbook prod 1 trang `docs/ops/PROD_RUNBOOK.md` (restore đã kiểm chứng, flush fail, cron, live ops 7/10) + **XOAY SECRET ADMIN 30/9** (`scripts/rotate_admin_password.mjs` tự kiểm chứng cũ-401/mới-200; credentials trong `dever-admin-credentials.secret` gitignored) + drill định kỳ hằng tháng + `backups/` gitignored (dump chứa hash, repo public).
- [x] A8: Verify toolbar nowrap 390px — DOM thật trên prod: 0 wrap/overflow; kèm fix bug 7–8 (hero/timer/phase lấy từ kỳ thi thật, 5 bài legacy ma biến mất — verify DOM sau deploy).
- [ ] A1: Verify cron backup 09:00 VN 1/10 (cron 30/9 chạy trước khi có marker → lần đầu verify được là 1/10).

### Bổ sung Vòng 37.5 — Audit bundle + repair chuỗi deploy (30/9)
- [x] Audit legacy/demo khỏi source: 12 pattern 18 hit → 0 (AuthContext GUEST-first + preset backend thật, StandingsPage bỏ 5 user ma, AdminLayout bỏ id kỳ cứng, ContestContext bỏ slug/id cứng, ProblemWorkspace bỏ fallback p102, Navbar/Landing/app.html hết chữ Round #1/Hack Room) — verified prod sau deploy: **0 hit trên 5 asset JS + app.html**.
- [x] Repair deploy fail 3 lớp (git exit 127 → MODULE_NOT_FOUND → generic web build của platform): postinstall `node -e` try/catch skip khi thiếu script (an toàn mọi image); Dockerfile.api COPY `setup_git_hooks.mjs` trước `npm ci`; vá 2 lỗi lint chặn CI (judge.js no-redeclare, AdminLayout `contestTitle` → `activeContest?.title`). Deploy `cce51e6` ACTIVE, probe xanh.

### Giai đoạn B — Ngày thi 7/10 + hậu kỳ (đã lên lịch)
- [ ] Live ops: dashboard real-time, freeze 20' cuối, announcements, trực SRE trong 2 giờ thi.
- [ ] Sau FINISHED: tổng kết tự động, podium/summary, RATING CHANGES lần đầu chạy thật (rated), luồng upsolve.
- [ ] Retro 24h sau thi; drill lại restore với khối lượng dữ liệu thật (100+ submissions).

### Giai đoạn C — Backlog sau Round #2 (PM ưu tiên)
- [x] Verify chấm C++/Java trong container prod — probe prod: cpp AC 9.6s / java AC 16.1s (Vòng 37.2, sớm hơn kế hoạch).
- [ ] Backup retention 30 ngày + drill khối lượng thật.
- [ ] Multi-organizer thật: cấp tài khoản BTC CLB, bỏ phụ thuộc dever_admin (key-person risk).
- [ ] Anti-cheat AST diff chạy đại trà trên bài nộp thật.

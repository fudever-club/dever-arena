# Implementation Plan: DEVER-Forces Platform

## Overview
Xây dựng nền tảng thi đấu giải thuật nội bộ của CLB FU-DEVER chuẩn phong cách Codeforces & ICPC, bao gồm:
1. Bộ Core Algorithm Engine (Scoring decay, Hack scoring, Elo rating recalculator, Contest state machine, AST plagiarism detection) với 62 Unit tests bảo đảm tính chính xác 100%.
2. Bộ quy chế & kiến trúc hoàn chỉnh: Contest Rulebook, Anti-cheat policy, Polygon problem authoring standard, Judge architecture, 12-table DB schema, REST API spec, Deployment guide.
3. Web Arena 3 trang hiện đại: Landing Portal, Client Arena, Admin Command Center với Real-time Ticker, Cross-tab phase sync, 1-Click sample test runner, PWA manifest, đạt 0 lỗi `detect.mjs`.
4. Lộ trình tương lai: Virtual Contest Replay Engine (Ghost submissions), Multi-Contest Scheduler, và Clan Wars Aggregator.

## Architecture Decisions
- **Modularity:** Core calculations (Scoring, Elo, State Machine, Virtual Replay) đóng gói độc lập chuẩn ES Modules, dùng chung giữa Node.js backend và Web frontend.
- **Zero Heavy Framework Lock-in for Web Arena:** Thiết kế theo chuẩn Vanilla Web Components & ES Modules hiện đại với hiệu ứng Cyber Glow & Glassmorphism. Tốc độ load dưới 50ms, không phụ thuộc bundler cồng kềnh, PWA installable.
- **Local-First & Offline Resilience:** Lưu trữ 10 object stores qua IndexedDB với fallback bộ nhớ cho headless test runner.
- **Codeforces Fidelity:** Tái hiện trung thực: Pretest vs System test, Hack phase trong Room, điểm giảm theo phút, phân hạng tên màu, đồng bộ phase thời gian thực.

## Roadmap & Phases

### Phase 1: Core Calculation Engines & Logic (Completed)
- [x] Task 1: Xây dựng `src/core/scoring.js` (công thức suy giảm điểm theo thời gian & Hack score) kèm Unit Test `tests/scoring.test.js`.
- [x] Task 2: Xây dựng `src/core/rating.js` (thuật toán tính biến động Elo rating chuẩn Codeforces) kèm Unit Test `tests/rating.test.js`.
- [x] Task 3: Xây dựng `src/core/contestStateMachine.js` (quản lý 5 trạng thái vòng thi) kèm Unit Test `tests/contest.test.js`.
- [x] Task 3.1: Mở rộng thể thức ICPC & IOI Subtasks `tests/icpc_scoring.test.js`.
- [x] Task 3.2: Xây dựng Anti-Cheat AST Tokenizer `src/engine/astDiff.js` kèm `tests/astDiff.test.js`.

### Phase 2: Enterprise Documentation & Specifications (Completed)
- [x] Task 4: Soạn thảo 14 tài liệu đặc tả chuẩn trong `docs/` (`CONTEST_RULEBOOK.md`, `ANTI_CHEAT_POLICY.md`, `JUDGE_ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `API_SPECIFICATION.md`, `PROBLEM_SETTING_GUIDE.md`, `DEPLOYMENT_GUIDE.md`, `DESIGN_SYSTEM.md`, `AGENT_SYSTEM_PLAYBOOK.md`, `AI_SLOP_REPORT.md`, `SPEC.md`, `CAPABILITY_MAP.md`, `CHANGELOG.md`).

### Phase 3: Problemset & Sandbox Engines (Completed)
- [x] Task 5: Tạo bộ bài toán chuẩn `src/data/problems.js` và `problems/` (5 bài toán đa dạng kèm Editorial).
- [x] Task 6: Xây dựng Web Audio Synthesizer `src/engine/sound.js` và In-Browser Sandbox `src/engine/runner.js`.

### Phase 4: Full Web Application (3 Pages) & REST Layer (Completed)
- [x] Task 7: Tách cấu trúc 3 trang chuyên biệt: Landing `index.html`, Client Arena `arena.html`, Admin `admin.html`.
- [x] Task 8: Thiết kế Design System `css/style.css` chuẩn WCAG AA, light/dark mode, responsive 640/900/1024.
- [x] Task 9: Xây dựng IndexedDB layer 10 stores (`src/db/index.js`, `seed.js`) và REST Mock layer (`src/db/api.js`).
- [x] Task 10: Xây dựng bộ kiểm thử E2E 4 luồng người dùng `tests/e2e.test.js` & `tests/api.test.js`.

### Phase 5: Product Quality, Ticker Hardening & PWA (Completed)
- [x] Task 11: Chuẩn hóa Footer & Contract 3 trang qua `detect.mjs` (0 errors PASS 100%).
- [x] Task 12: Xây dựng Real-time Contest Ticker & Progress Bar đếm ngược từng giây (`setupContestTimer`).
- [x] Task 13: Xây dựng Cơ chế đồng bộ Phase liên tab (Cross-Tab Phase Synchronization via `storage` event).
- [x] Task 14: Xây dựng Deep Hash Router (`handleAppHash` & `initAppHashRouter`).
- [x] Task 15: Xây dựng 1-Click Sample Test Runner & Output Diff trong Workspace (`setupSampleTestRunner`).
- [x] Task 16: Bổ sung PWA `manifest.json` và test suite `tests/platform_quality.test.js` (62 tests PASS).
- [x] Task 17: Hội đồng 5 Agent vá bảo mật Sandbox Browser (`runner.js` 18 blocked APIs) + 2-Click Non-blocking DQ Modal.

---

### Phase 6: Virtual Contest Simulator & Multi-Contest System (Completed)
- [x] Task 18: Xây dựng Engine mô phỏng Virtual Contest `src/core/virtualContest.js`:
  - Cho phép người dùng bắt đầu thi lại một contest đã kết thúc với đồng hồ cá nhân (ví dụ: 120 phút).
  - Tái tạo trạng thái bảng xếp hạng động theo thời gian trôi qua của Virtual Contest (Ghost Submissions Replay).
  - Tự động chèn bài nộp của đối thủ vào Standings tại đúng số phút trong lịch sử contest thực tế.
- [x] Task 19: Mở rộng `src/db/api.js` & `seed.js` hỗ trợ Multi-Contest:
  - Bổ sung nhiều contest: Div.1, Div.2, Div.3, Beginner Cup với thời gian bắt đầu, kết thúc, điều kiện Elo rating.
  - Lọc danh sách contest theo trạng thái: `UPCOMING`, `LIVE`, `PAST`, `VIRTUAL`.
  - Kiểm tra điều kiện phân hạng (Division eligibility gate) khi đăng ký tham gia.
- [x] Task 20: Tích hợp giao diện Virtual Contest trên `arena.html` và `index.html`:
  - Nút "Thi đấu ảo (Virtual Contest)" trong danh sách contest quá khứ.
  - Chế độ Virtual HUD hiển thị thời gian ảo và Ghost Leaderboard cập nhật từng phút.
- [x] Task 21: Viết bộ kiểm thử `tests/virtual_contest.test.js` (kiểm tra tính toán replay submissions và standings theo timeline ảo).

### Phase 7: Clan Wars Leaderboard & KaTeX Math Rendering (Completed)
- [x] Task 22: Xây dựng Engine xếp hạng bang hội `src/core/clanRating.js`:
  - Tính điểm sức mạnh Clan dựa trên Top 5 thành viên có điểm/rating cao nhất theo công thức Top-5 Harmonic Sum.
  - Bảng xếp hạng Clan Wars tự động tổng hợp từ IndexedDB và REST mock API.
- [x] Task 23: Tích hợp thư viện hiển thị công thức toán học KaTeX/LaTeX offline-safe `renderMathTypography` cho Đề bài & Editorial (`$O(N \log N)$`, `$\sum A_i$`).
- [x] Task 24: Viết bộ kiểm thử `tests/clan_wars.test.js` và xác thực toàn diện, nâng tổng số kiểm thử lên 78/78 tests PASS 100%.

### Phase 8: Offline Judge Sandbox Engine & 3-Tier Priority Queue (Completed)
- [x] Task 25: Xây dựng Hàng đợi điều phối máy chấm 3 cấp `src/engine/workerQueue.js` (HACK=1, PRETEST=2, SYSTEM_TEST=3).
- [x] Task 26: Xây dựng Bộ thực thi sandbox an toàn `src/engine/isolateRunner.js` (Fail-fast, cgroups timeout, resource limits, verdict mapping AC/WA/TLE/MLE/RTE/CE).
- [x] Task 27: Viết bộ kiểm thử `tests/worker_queue.test.js` xác thực tính ưu tiên hàng đợi và độ tin cậy của máy chấm (7 tests PASS).

### Phase 9: Scoreboard Freeze & ICPC Dramatic Reveal Unfreeze Simulator (Completed)
- [x] Task 28: Xây dựng Engine đóng băng bảng điểm `src/core/scoreboardFreeze.js`:
  - Ẩn điểm các bài nộp trong 30 phút cuối, hiển thị `?` và số lần submit `+K`.
  - Thuật toán sinh chuỗi hành động mở bài (Unfreeze Sequence) từ đáy bảng lên ngôi vương kèm Rank Jump delta.
- [x] Task 29: Viết bộ kiểm thử `tests/freeze_scoreboard.test.js` đảm bảo bảng điểm freeze và unfreeze chính xác 100% (4 tests PASS).

### Phase 10: Polygon Problemsetter Testlib Validator & Custom Checker (Completed)
- [x] Task 30: Xây dựng bộ công cụ Polygon `src/engine/testlibValidator.js` (Input validator kiểm tra bounds, Token diff checker, Float checker dung sai $\epsilon = 10^{-6}$, Multiple solutions validator).
- [x] Task 31: Viết bộ kiểm thử `tests/testlib.test.js` xác thực các trường hợp biên của bài toán (9 tests PASS).

### Checkpoint 5: 98/98 Tests PASS across 25 Suites, 0 Detect Errors (Production Ready Pure CP Platform)

### Phase 11: UI/UX Redesign — Cyber Dark & FPT Orange Pro (Completed)
- [x] Task 32: Nâng cấp Glassmorphism đa tầng (`backdrop-filter: blur(14px)`), viền phát sáng cam và bóng đổ kép chuẩn eSports CP.
- [x] Task 33: Tinh chỉnh HUD đồng hồ đếm giờ kỹ thuật số (neon glow, thanh tiến độ đa sắc, vạch nhấp nháy radar theo Phase).
- [x] Task 34: Hoàn thiện hệ thống nút tương tác siêu mượt (hover lift, active scale, vầng sáng quang học).
- [x] Task 35: Tích hợp huy chương vinh danh 🥇 Top 1 Vàng, 🥈 Top 2 Bạc, 🥉 Top 3 Đồng trên bảng xếp hạng Standings.
- [x] Task 36: Tinh chỉnh cửa sổ Terminal / Judge Console với 3 nút Unix/macOS (🔴 🟡 🟢) và chip chỉ số tương phản cao.
- [x] Task 37: Xác minh toàn bộ 98/98 unit & E2E tests PASS và `node detect.mjs` đạt 0 lỗi cấu trúc.

### Phase 12: Comprehensive Playwright E2E Testing Suite (Completed)
- [x] Task 38: Xây dựng bộ test Playwright E2E `tests/e2e_playwright.mjs` tích hợp trình duyệt thực tế Microsoft Edge / Chromium headless.
- [x] Task 39: Kiểm thử trọn vẹn Landing Page Portal `index.html` (SEO, Duy nhất 1 H1, Hero, CTA, Bento grid, Theme switch, Mobile Hamburger responsive).
- [x] Task 40: Kiểm thử trọn vẹn Client Arena `arena.html` (Timer HUD, Subtabs navigation, Workspace problem loading, Code editor & runner, Console dots, Standings medals, Problemset search, Clan Wars).
- [x] Task 41: Kiểm thử trọn vẹn Admin Command Center `admin.html` (Freeze board, Phase transition, AST Anti-cheat similarity scanner, Polygon live preview, Telemetry judge cluster).
- [x] Task 42: Đạt 100% tỷ lệ vượt qua: 47/47 tests PASS, chụp 4 ảnh bằng chứng giao diện HD tại thư mục artifacts.

### Phase 13: Full-System React SPA, LeetCode Workspace Ergonomics, KaTeX Typography & Polygon Studio (Completed)
- [x] Task 43: Kiến trúc React 18 + Vite + Tailwind CSS v4 phân tách Member Portal (`MemberLayout`) và Admin Command Center (`AdminLayout`).
- [x] Task 44: LeetCode 3-Pane Workspace với Monaco Editor Pro (`ProblemWorkspace.jsx`).
- [x] Task 45: Resizable Splitters kéo thả 2 chiều (20-80%) và lưu cấu hình vào `localStorage`.
- [x] Task 46: Zen Mode 2 cấp độ (ẩn testcase & toàn màn hình phóng đại) kích hoạt nhanh bằng phím tắt `Esc`.
- [x] Task 47: KaTeX Math Typography Engine (`MathRenderer.jsx`) cho công thức toán học inline `$x$` và block `$$\sum$$`.
- [x] Task 48: Polygon Problemsetter Studio trong Admin Center: Thêm/Sửa/Xóa bài toán, KaTeX Live Preview và BroadcastChannel sync đa tab.
- [x] Task 49: Loại bỏ hoàn toàn 8 agent skills `9router*`, tuân thủ tuyệt đối triết lý Zero-AI Client theo `ADR-003`.
- [x] Task 50: Kiểm tra toàn diện chất lượng: 98/98 unit tests PASS, `detect.mjs` 0 errors, Vite production build hoàn tất sạch sẽ trong ~340ms.

### Phase 14: Backend API Thật + Judge Thật + Logo CLB (Completed)
- [x] Task 51-53: `server/` Node thuần (REST + SSE + JWT + judge thật + hack oracle + Elo + virtual + division gate), 10 tests vòng đời, logo CLB + PWA icons thật, nối 4 màn hình qua `src/lib/apiClient.js`.

### Phase 15: Xóa Clan Wars + Tài Khoản Admin Cấp + Dọn Icon + Sửa Chữ (Completed)
- [x] Task 54-56: Xóa Clan Wars toàn diện, tài khoản cá nhân/đội do admin cấp, gỡ lucide/emoji (SVG svgl), font Space Grotesk, sửa chữ + số liệu thật.

### Phase 16: Nối Vòng Lặp Thi Đấu + Security + Judge Sâu + Production (Completed)
- [x] Task 57-60: Nối submit/hack/phase/timer/editorial, rate-limit + headers + CORS, judge Java/C++ + rejudge, rooms/telemetry thật, Docker + nginx + compose, 105/105 tests PASS.

### Phase 17: Xóa giao diện vanilla cũ — single-stack React SPA (Completed)
- [x] Task 61: Xóa legacy + viết lại detect/platform_quality + docs single-stack, 124 tests PASS.

### Phase 18: CRUD đề thi trên máy chủ + Freeze/ICPC phía server (Completed)
- [x] Task 62-63: Problem CRUD API + publish, module contestResults + đấu nối standings + nút freeze đồng bộ, 125 tests PASS.

### Phase 19: Vá liêm chính hiển thị + luồng dữ liệu thật + mở kỳ thi (Completed)
- [x] Task 64-66: Vá XSS/unfreeze/401, merge đề + contest list + standings động, API tạo contest + form admin, 126 tests PASS.

### Phase 20: E2E trình duyệt thật + chống treo process (Completed)
- [x] Task 67: Playwright Chromium có sẵn, port riêng, kill cây process, sửa pass ảo, proxy theo env, 130 tests PASS.### Phase 21: Soạn đề server-only + worker riêng + ICPC tự động + Postgres (Completed)
- [x] Task 68-72: Bỏ dual-source đề, worker chấm riêng, ICPC auto, duyệt + rejudge + reset pass, polygon đa kỳ thi, adapter PG, 136 tests PASS.

### Phase 22–28: SDLC Ops + Design + Gates + 3-shell + Polygon + Page-branches (Completed)
- [x] Task 73–94: Xem chi tiết `tasks/todo.md` (đã đồng bộ 2 chiều đến Vòng 28, 153/153 tests).

### Phase 29: Hồ sơ Vòng 29 + Chốt định hướng sản phẩm (Completed)
- [x] Task 95: Ghi Vòng 29 vào `docs/CHANGELOG.md`: 8 merge nhánh team (ProfilePage `/profile`, ProblemsetPage `/problemset`, announcement banner + SSE, standings2: friends star + CSV + first-blood, hackroom2: validator bounds + preset payload, landing2: FAQ + luật chơi 4 bước, load-sre scale test).
- [x] Task 96: Chốt định hướng với chủ dự án — platform nội bộ CLB theo chuẩn thi đấu quốc tế (ICPC/AtCoder/CSES), KHÔNG theo cơ chế riêng Codeforces quy mô lớn: (1) Gỡ hoàn toàn Hack Phase + hack room + oracle + phân phòng 25; (2) Bỏ pretest vs system testing — chấm full suite trả verdict cuối; (3) Thể thức mặc định ICPC, giữ CF scoring làm lựa chọn; (4) Đào sâu: scheduler tự động + kho bài luyện tập + judge sâu.

### Phase 30: Đơn giản hóa vòng đời thi đấu chuẩn quốc tế (Completed — ADR-005)
- [x] Task 98: State machine 5 → 3 phase (`REGISTRATION → CODING → FINISHED`, freeze = cửa sổ cuối của CODING): `contestStateMachine.js` viết lại + unit test; bỏ distributeRooms/canPerformHack.
- [x] Task 99: Server chấm full-suite: `POST submissions` trả verdict cuối (bỏ `pretests_passed`/FST), rejudge một code path (`judgeSuiteOf`), bỏ nhánh SYSTEM_TESTING trong admin phase.
- [x] Task 100: Gỡ Hack toàn stack: route `/api/v1/hacks/execute` + `server/oracles.js` + `HackRoomPage.jsx` + route `/hack-room` + `hack_events`/`hacks` stores (IndexedDB v5 auto-delete) + `calculateHackScore` + RoomsPanel admin.
- [x] Task 101: UI thí sinh: Workspace/ContestHub/Landing/GuestLayout bỏ nhắc hack/room/pretest; tạo kỳ thi + seed mặc định ICPC; Admin phase control 3 nút.
- [x] Task 102: Full gate: **152/152 tests (24 suites)**, detect 0, lint 0 errors, build sạch, load 20/20 AC; CHANGELOG Vòng 29–30; ADR-005.

### Phase 31: Scheduler tự động + Judge sâu + Kho bài luyện tập (Completed)
- [x] Task 103: Auto-phase scheduler server thuần (`server/scheduler.js`, tick 30s, inject `now()` cho test): kỳ thi tự REGISTRATION→CODING→FINISHED theo `start_time` + `duration_minutes`; tách `finishContest()` dùng chung với admin phase; admin override tôn trọng; `SCHEDULER_DISABLED=1` cho test; +6 tests.
- [x] Task 104: Judge sâu: stderr compile 4000 ký tự, verdict **MLE** (JS `--max-old-space-size` theo memoryLimit), `per_test` lưu không kèm input/expected, chỉ mở sau FINISHED/upsolve/practice (`per_test_hidden` + `failed_index` khi CODING); chip T1✓/T2✗ trên Workspace; +5 tests.
- [x] Task 105: Kho bài luyện tập: `GET /practice/stats` (solved/attempts/ac_attempt từ bài nộp thật gồm practice), filter trạng thái trên ProblemsetPage, **upsolving** sau FINISHED (0 điểm, không vào standings, badge UPSOLVE), editorial auto-open khi FINISHED.
- [x] Task 106: Full quality gate + sync docs + ghi entry CHANGELOG Vòng 31 (và 31.5).

### Phase 31b: Profile thí sinh analytics (Completed 28/9/2026)
- [x] Task 107: Endpoint `GET /users/:username/profile` aggregate (stats/heatmap 182 ngày/verdicts/tags distinct/languages/per_contest + rank thật, không lộ source_code); seed rating_history + 81 practice submissions LCG deterministic; charts SVG zero-dep (RatingChart/Heatmap/VerdictBars/LanguageBars/TagStrength); ProfilePage viết lại + route `/profile/:username` + link Navbar/Standings; fast-switch login backend thật; **154/154 tests**.
- [x] Task 108: So sánh 2 thí sinh `GET /compare?a=&b=` + `ComparePage` (Elo overlay, stats diff, head-to-head theo rank thật, tags union); profile public không cần token; nút Chia sẻ/So sánh trên ProfilePage. (+4 tests → 172).

### Phase 33: Nền tảng mở (Completed)
- [x] Task 109: Notification center — `useNotifications` + `NotificationCenter` (SSE phase/announcement + poll verdict 30s, badge Navbar, localStorage).
- [x] Task 110: OpenAPI 3.1 — `scripts/gen_openapi.mjs` (`npm run gen:openapi`) sinh `docs/openapi.json` từ route table (42 ops/36 paths) + `GET /api/v1/openapi.json`; +3 tests đối chiếu.
- [x] Task 111: Virtual Contest UI member — `VirtualContestPage` (`/virtual/:slug`) HUD timer + ghost standings poll; nút Thi ảo trên ContestHub.
- [x] Task 112: Trang tổng kết — `ContestSummaryPage` (`/contest/:slug/summary`) podium + bảng ICPC + `@media print` in PDF zero-dep.
- [x] Task 117: Gate Vòng 32+33: **181/181 tests (29 suites)**, detect 0, lint 0 errors, build ~245ms; CHANGELOG Vòng 32/33.

### Phase 34: Backlog sau khi CLB dùng thật (Task 113 done; 114–115 planned)
- [x] Task 113: A11y audit toàn app — axe-core 4.13 trong E2E Chromium quét 10 trang, gate serious/critical=0: fix contrast root-cause (@theme override slate palette, CTA cam chữ đen 7.4:1, badge Standings #ffb066, Monaco comment theme dever-dark), aria-label 3 textarea, heading order login/workspace; `tests/a11y_axe.test.js` (+3 tests) + `scripts/a11y_scan.mjs`; **184/184 tests**.- [x] Task 113.1: Polish UI 3 trang mới (compare/virtual/summary) theo taste skill + Linear tokens — headline 28px/-0.6px, card-title 22px/-0.4px, eyebrow 13px/500/+0.4px uppercase thống nhất (kể cả thead), spacing card p-6/bảng py-3 px-4, zero em-dash hiển thị ("chưa có"/"ẩn danh"/"?? 0"), zero emoji (podium rank badge mono, icon in SVG), podium sm:grid-cols-3, progress bar gộp vào HUD card, error box thống nhất p-4.
- [ ] Task 114: Postgres production thật (bỏ store JSON, migration script) + object storage cho source_code.
- [ ] Task 115: Phân quyền multi-organizer (admin tạo admin, quản lý kỳ thi theo người phụ trách).





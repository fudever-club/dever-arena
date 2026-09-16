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

## Phase 13: Modern React SPA, LeetCode Workspace Ergonomics, KaTeX Typography, Polygon Problemsetter Studio & 9Router De-integration (Completed)
- [x] Task 43: Tách biệt hoàn toàn Member Portal (`MemberLayout`) và Admin Command Center (`AdminLayout`) trên React 18 + Vite + Tailwind CSS v4.
- [x] Task 44: Xây dựng Không gian làm bài LeetCode 3 phân vùng với Monaco Editor Pro (`ProblemWorkspace.jsx`).
- [x] Task 45: Tích hợp Resizable Splitters kéo thả 2 chiều (20-80%) và lưu cấu hình vào `localStorage`.
- [x] Task 46: Xây dựng Zen Mode 2 cấp độ (ẩn testcase & toàn màn hình phóng đại) kích hoạt nhanh bằng phím tắt `Esc`.
- [x] Task 47: Tích hợp KaTeX Math Typography Engine (`MathRenderer.jsx`) cho công thức toán học inline `$x$` và block `$$\sum$$`.
- [x] Task 48: Xây dựng Polygon Problemsetter Studio trong Admin Center: Thêm/Sửa/Xóa bài toán, KaTeX Live Preview và BroadcastChannel sync đa tab.
- [x] Task 49: Loại bỏ hoàn toàn 8 agent skills `9router*`, tuân thủ tuyệt đối triết lý Zero-AI Client theo `ADR-003`.
- [x] Task 50: Kiểm tra toàn diện chất lượng: 98/98 unit tests PASS, `detect.mjs` 0 errors, Vite production build hoàn tất sạch sẽ trong ~340ms.


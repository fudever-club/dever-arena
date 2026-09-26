# Spec: DEVER-Forces Platform

## 1. Objective
Xây dựng nền tảng thi đấu giải thuật độc lập cho CLB FU-DEVER theo đúng mô hình thi đấu của Codeforces & ICPC:
- Tổ chức các vòng thi (Div.1, Div.2, Div.3, Div.4) với bảng xếp hạng phân hạng Elo động.
- Cơ chế tính điểm suy giảm theo thời gian (Dynamic Point Decay) và thể thức ICPC penalty / IOI subtasks.
- Cơ chế Hack/Challenge trong Room (mở mã nguồn đối thủ để tìm testcase phản ví dụ).
- Hệ thống System Testing sau contest để tái kiểm tra toàn bộ bài nộp bằng test suite đầy đủ.
- Giao diện single-stack React SPA (`app.html` + `src/App.jsx`: 3 shell `GuestLayout` `/,/login` + `UserLayout` `/arena,/problem/:id,/standings,/hack-room` + `AdminLayout` `/admin`, guards `RequireAuth`/`RequireAdmin`), phong cách Luxury-Minimal + FPT Orange Pro.
- Hệ thống Virtual Contest Simulator (thi lại contest quá khứ với cơ chế Ghost Submissions Replay theo từng phút thực tế).

## 2. Tech Stack & Environment
- **Core Algorithms & Logic:** JavaScript (ESM / Node.js standard) for deterministic testable engines.
- **Testing:** Node.js built-in `node:test` and `node:assert` for zero-overhead, ultra-fast test execution (150 tests across 21 suites).
- **Design System & Linter:** Design tokens trong `src/index.css` (Tailwind v4), automated architectural linter `detect.mjs` (0 errors required).
- **Frontend Web Arena:** React 19 SPA (`app.html` shell + `<div id="root">`), build bằng Vite, PWA installable with `manifest.json`.
- **Client Storage & Offline:** IndexedDB with 11 object stores (`users`, `contests`, `problems`, `testcases`, `submissions`, `hack_events`, `discussions`, `clans` [frozen Phase 15], `contest_participants`, `analytics`, `virtual_sessions`) and local in-memory fallback for headless Node.js tests.
- **Documentation:** Markdown với sơ đồ Mermaid, công thức LaTeX và hệ thống 14 tài liệu chi tiết trong `docs/`.

## 3. Commands
- Chạy toàn bộ test suites kiểm tra thuật toán & nền tảng: `node --test tests/*.test.js`
- Chạy linter kiểm tra tính toàn vẹn kiến trúc & CSS: `node detect.mjs`
- Phục vụ bản build SPA: `npm run build && npm run serve` (phục vụ `dist/` tại port 3000).

## 4. Project Structure
```
DEVER Arena/
├── docs/                          # 14 enterprise markdown specifications
│   ├── SPEC.md                    # System specification & invariants
│   ├── CAPABILITY_MAP.md          # Module responsibility & dependencies
│   ├── DESIGN_SYSTEM.md           # Tokens, component specs & WCAG contracts
│   ├── DEVER_FORCES_SPECIFICATION.md # Mathematical formulas & Elo rules
│   ├── CONTEST_RULEBOOK.md        # Official contest rules & Division tiers
│   ├── ANTI_CHEAT_POLICY.md       # Plagiarism detection, AST token rules
│   ├── JUDGE_ARCHITECTURE.md      # Isolate sandbox, queue protocol & cgroups
│   ├── DATABASE_SCHEMA.md         # 12 PostgreSQL tables + 11 IndexedDB stores
│   ├── API_SPECIFICATION.md       # RESTful contracts & WebSocket specs
│   ├── PROBLEM_SETTING_GUIDE.md   # Polygon & testlib.h authoring standard
│   ├── DEPLOYMENT_GUIDE.md        # Production Docker, Nginx, SSL & PWA setup
│   ├── AGENT_SYSTEM_PLAYBOOK.md   # Multi-agent orchestrator roles
│   ├── AI_SLOP_REPORT.md          # Quality audit & anti-slop score (2.8/10)
│   └── CHANGELOG.md               # Version history & iteration audit trail
├── app.html                     # React SPA shell duy nhất (<div id="root">)
├── detect.mjs                     # Automated architectural & design system linter
├── manifest.json                  # PWA Web App Manifest (standalone, theme #ff6600)
├── server/                         # Backend API thật (Node thuần, 0 dependency)
│   ├── index.js                    # REST + SSE + phase machine + system test + Elo + rate-limit
│   ├── judge.js                    # Thực thi JS/Python/Java/C++ thật (tự phát hiện toolchain)
│   ├── queue.js + judgeWorker.js   # Fork pool chấm riêng (FIFO, timeout 60s + respawn)
│   ├── oracles.js                  # Lời giải chuẩn chấm hack
│   ├── auth.js                     # SHA-256 + JWT HS256
│   ├── pg.js                       # Adapter Postgres (KV + meta, write-through + flush)
│   └── db.js                       # JSON store + seed
├── public/brand/                   # Logo CLB (nguồn thật duy nhất)
├── public/icons/                   # SVG ngôn ngữ từ svgl.app
├── src/
│   ├── core/                      # rating.js, scoring.js, contestStateMachine.js, auth.js, virtualContest.js, scoreboardFreeze.js, contestResults.js
│   ├── engine/                    # runner.js, astDiff.js, workerQueue.js, isolateRunner.js, testlibValidator.js, testGenerator.js
│   ├── db/                        # index.js (11 stores), seed.js, api.js (mock REST)
│   ├── components/                # layouts (GuestLayout, UserLayout, AdminLayout + StressPanel, Navbar) and common/MathRenderer
│   ├── pages/                     # LandingPage, LoginPage, ContestHub (+TestingQueue), ProblemWorkspace, StandingsPage, HackRoomPage
│   └── context/                   # AuthContext, ContestContext (BroadcastChannel sync)
│   └── data/problems.js           # Built-in problems database & editorials
├── tests/                         # 150 tests across 21 test suites (Node.js test runner)
│   ├── scoring.test.js            # Codeforces dynamic decay tests
│   ├── rating.test.js             # Elo rating engine tests
│   ├── contest.test.js            # Contest state machine transitions
│   ├── icpc_scoring.test.js       # ICPC & IOI subtask scoring
│   ├── astDiff.test.js            # AST token plagiarism similarity
│   ├── auth.test.js               # RBAC & authentication badges
│   ├── db.test.js                 # IndexedDB fallback CRUD & seed integrity
│   ├── api.test.js                # REST mock API hack, standings & division gates
│   ├── e2e.test.js                # 4 end-to-end user & admin flows
│   ├── platform_quality.test.js   # SPA shell/manifest/assets/routes + ticker/diff/router
│   ├── virtual_contest.test.js    # Virtual simulator & ghost replay tests
│   ├── worker_queue.test.js       # 3-tier priority judge queue tests
│   ├── freeze_scoreboard.test.js  # Scoreboard freeze & ICPC unfreeze tests
│   ├── testlib.test.js            # Polygon testlib validator & custom checkers
│   ├── test_generator.test.js     # Seeded generator + edge-case traps
│   ├── stress_workflow.test.js    # Stress + blind-tester workflow
│   ├── server_api.test.js         # Backend lifecycle (judge thật, hack oracle, Elo, SSE)
│   ├── health.test.js             # /api/health, /api/v1/health, /api/ready
│   ├── pg_store.test.js           # Postgres adapter (pool giả)
│   ├── contest_results.test.js    # Freeze/ICPC phía server
│   └── spa_e2e.test.js            # Playwright Chromium E2E (port riêng, kill cây process)
├── package.json                   # Scripts: test, lint, dev, build
└── tasks/
    ├── plan.md                    # Roadmap & engineering phase plans
    └── todo.md                    # Actionable task checklists
```

## 5. Testing Strategy
- **Scoring Engine:** Kiểm tra công thức suy giảm điểm $P_{decay}$, chặn sàn $0.3 \times P_{\max}$, trừ 50 điểm/lần sai, điểm cộng +100 khi hack đúng, -50 khi hack sai.
- **Rating Engine:** Kiểm tra tính biến động rating bảo toàn, xử lý thí sinh mới (Newbie calibration), tính expected rank và delta.
- **Contest State Machine:** Đảm bảo chuyển trạng thái nghiêm ngặt (`REGISTRATION` ➔ `CODING` ➔ `HACK_PHASE` ➔ `SYSTEM_TESTING` ➔ `FINISHED`). Cấm hack trong lúc đang coding phase, cấm nộp code trong lúc hack phase.
- **Security & Sandbox:** Kiểm tra `runner.js` chặn 18 API nguy hiểm (`Worker`, `WebSocket`, `indexedDB`, `eval`, v.v.).
- **Judge Worker Queue & Isolate:** Kiểm tra xử lý hàng đợi ưu tiên 3 cấp và fail-fast sandbox.
- **Scoreboard Freeze:** Xác thực trạng thái `?` và thuật toán sinh bước unfreeze từ đáy bảng.
- **Platform Quality & Integrity:** Kiểm tra đồng hồ đếm ngược, chuẩn hóa khoảng trắng đối soát output, phase enum, và hợp đồng SPA shell (`app.html`, `manifest.json`, brand assets, routes).

## 6. Completed Strategic Capabilities (Phases 8–13)
1. **Offline Judge Sandbox Engine & 3-Tier Priority Worker Queue (Phase 8):** Quản lý điều phối máy chấm ngoại tuyến với 3 cấp độ ưu tiên (Hack > Pretest > System Test) và cgroups v2 resource capping.
2. **Scoreboard Freeze & ICPC Dramatic Reveal Unfreeze (Phase 9):** Đóng băng bảng xếp hạng 30 phút cuối kỳ thi và sinh kịch bản giải mã kết quả ngoạn mục từ đáy bảng lên ngôi vương.
3. **Polygon Testlib Validator & Custom Floating-Point Checker (Phase 10):** Bộ xác thực input đề bài chuẩn Polygon và so khớp nghiệm thực số với dung sai sai số $\le 10^{-6}$.
4. **UI/UX Redesign Cyber Dark & Playwright E2E Testing (Phases 11–12):** Thẩm mỹ eSports hiện đại và kiểm thử trình duyệt thực tế 47/47 assertions pass.
5. **Full-System React SPA & LeetCode Workspace Ergonomics (Phase 13):** Không gian làm bài 3 phân vùng Monaco Editor, Resizable Splitters (20-80%), Zen Mode (Esc), KaTeX Math Typography, Polygon Studio trong Admin, và triệt tiêu hoàn toàn 9Router (Zero-AI).

> **Phases 14–26:** xem `docs/CHANGELOG.md` (Vòng 14–26: backend thật + judge thật, xóa Clan Wars, single-stack React SPA, CRUD đề + freeze server, worker pool `queue.js`/`judgeWorker.js` + Postgres `pg.js`, CI/observability/backup/load, Luxury-Minimal, 3-shell `GuestLayout/UserLayout/AdminLayout`, Polygon generator + stress + blind-tester) và `tasks/todo.md` (Phase 14–26, tổng **150/150 tests PASS / 21 suites**). Chi tiết chương trình nhánh song song: `docs/PAGE_BRANCHES.md`.

## 7. Boundaries & Invariants
- **Always:** Giữ nguyên các quy tắc cốt lõi của Codeforces (Hack phase, System test, Elo distribution).
- **Always:** Đảm bảo 100% test suites vượt qua `node --test tests/*.test.js` và `node detect.mjs` đạt 0 lỗi.
- **Ask First:** Bất kỳ sự thay đổi nào đối với cấu trúc điểm số hoặc phân hạng.
- **Never:** Bỏ qua kiểm tra biên (boundary tests) hoặc viết code sơ sài không có test.

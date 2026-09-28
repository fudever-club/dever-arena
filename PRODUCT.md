# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Single-Stack Architecture (Phase 17+):
- **React 19 SPA duy nhất:** `app.html` shell + `src/App.jsx` (3 shell `GuestLayout` `/,/login` + `UserLayout` `/arena,/problem/:id,/standings,/hack-room` + `AdminLayout` `/admin`, guards `RequireAuth`/`RequireAdmin`), React 19 + Vite + Tailwind CSS v4, Monaco Editor Pro, KaTeX Math Typography Engine (`MathRenderer.jsx`, escape XSS), BroadcastChannel cross-tab sync (`src/context/ContestContext.jsx`). Clean production build (57–58 modules).
- Legacy vanilla (`index.html`, `arena.html`, `admin.html`, `css/`, `js/`, `problems/`) đã xóa Phase 17 — không phát triển song song.

## Users
- **Primary:** Sinh viên FPTU, thành viên CLB FU-DEVER (K18-K21, ban AI/Web/Mobile) thi đấu cá nhân trong contest Rated.
- **Situation:** Trong phòng lab hoặc online, contest 120 phút chuẩn quốc tế: làm bài độc lập, nộp bài chấm full-suite nhận verdict cuối, xem standings live (freeze 30 phút cuối), tích Elo; hỏi đáp jury qua clarifications ICPC.
- **Secondary:** Ban Tổ Chức & Giám khảo (ADMIN) điều khiển phase, quét AST anti-cheat, soạn đề Polygon, xem telemetry.

## Product Purpose
Nền tảng thi đấu giải thuật tự chủ của CLB FU-DEVER, tái hiện trung thực vòng đời Codeforces (Pretests → Hack Room → System Test → Elo). Thành công = tổ chức được Round định kỳ, chống gian lận, tính điểm suy giảm theo thời gian công bằng, và là nơi luyện ICPC/Olympic.

## Positioning
Khác Codeforces/VNOI ở chỗ: (1) vòng đời tối giản 3 phase + chấm full-suite trả verdict cuối ngay (không pretest/system-test) đúng chuẩn ICPC/AtCoder, (2) AST Winnowing anti-cheat khử đổi tên biến/comment, (3) Judge fork pool + queue 3 tầng ưu tiên (`server/queue.js` + `judgeWorker.js`) — tất cả gói trong một web arena mà CLB tự vận hành. (Clan Wars đã xóa Phase 15; Hack Phase đã gỡ theo ADR-005.)

## Operating Context
Workflows: Đăng ký → phân Room → Coding (chỉ Pretests) → Hack (mở code cùng Room, +100/-50) → System Testing (45 hidden tests) → Elo recalc. Môi trường: lab FPT, browser, C++20/Python/Java/JS. Tài liệu: CONTEST_RULEBOOK.md, ANTI_CHEAT_POLICY.md, JUDGE_ARCHITECTURE.md, API_SPECIFICATION.md.

## Capabilities and Constraints
- **Capabilities:** Vòng đời 3 phase chuẩn quốc tế `REGISTRATION→CODING→FINISHED` (ADR-005), chấm full-suite trả verdict cuối ngay, ICPC scoring mặc định (solved + penalty 20′), Dynamic decay `max(0.3*Pmax, Pmax - Pmax*t/250 -50*W)` giữ làm tùy chọn (`?format=CODEFORCES`), Elo seed/geometric mean, Scoreboard Freeze 30 phút cuối, Polygon CMS & Admin Problemsetter Studio + `StressPanel`, `TestingQueue` blind-tester (`DRAFT→IN_TESTING→APPROVED`), seeded generator `src/engine/testGenerator.js`, Live standings/SSE, AST similarity (ADR-004), Virtual Contest (Ghost Replay), Multi-Contest (Div.1-4 rating gates), KaTeX (`MathRenderer.jsx`), Clarifications hỏi đáp jury ICPC + Announcements, Workspace Monaco + Splitters + Zen Mode. **Đã gỡ (ADR-005):** Hack Phase, Hack Room, phân phòng 25, pretest/system-test, FST.
- **Constraints:** Hoàn toàn không dùng LLM/AI trong nền tảng và Rated contest (Zero-AI Client theo ADR-003, loại bỏ hoàn toàn 9Router); input hack phải qua validator; sandbox cgroups/pids/network none; time 1.0-2.5s / mem 256-512MB.
- **Undecided:** Redis Streams + judge cluster đa máy (hợp đồng trong JUDGE_ARCHITECTURE/DEPLOYMENT_GUIDE; compose hiện tại `web + api + db` Postgres, judge mặc định là fork pool nội bộ).

## Brand Commitments
Tên `DEVER-Forces` / `DEVER Arena Enterprise`, màu FPT Orange `#ff6600` accent duy nhất trên canvas `#010102` (Luxury-Minimal Phase 23: cấm neon `#00f0ff`/gradient/glow/shadow màu trang trí), font Space Grotesk (subset Việt) + JetBrains Mono, rank colors 7 bậc (chỉ trong product surfaces). Không đổi tên/voice mà không hỏi CLB.

## Evidence on Hand
- Code: `server/{index,queue,judgeWorker,judge,auth,db,pg}.js` (REST + SSE + fork pool judge JS/Python/Java/C++ + Elo + ICPC auto + stress + testcase CRUD + blind-tester), `src/core/{scoring,rating,contestStateMachine,auth,virtualContest,scoreboardFreeze,contestResults}.js`, `src/engine/{astDiff,runner,workerQueue,isolateRunner,testlibValidator,testGenerator}.js`, `src/pages/{LandingPage,LoginPage,ContestHub(+TestingQueue),ProblemWorkspace,StandingsPage,ProfilePage,ProblemsetPage}.jsx`, `src/components/layout/{GuestLayout,UserLayout,AdminLayout(+StressPanel),Navbar}.jsx` (không còn Clan Wars/Hack Room, icon chữ + SVG svgl, không lucide/emoji trang trí)
- Docs: SPEC.md, CAPABILITY_MAP.md, DEVER_FORCES_SPECIFICATION.md, DATABASE_SCHEMA.md, API_SPECIFICATION.md, CONTEST_RULEBOOK.md, ANTI_CHEAT_POLICY.md, JUDGE_ARCHITECTURE.md, DESIGN_SYSTEM.md (+ DESIGN.md Linear consensus), DEPLOYMENT_GUIDE.md, PROBLEM_SETTING_GUIDE.md (generator + stress + blind-tester), PAGE_BRANCHES.md (page/* program), CHANGELOG.md (Vòng 1–26), ADR-001 tới ADR-004, docs/ops (runbook/backup/retention)
- Sản phẩm chạy: `app.html` React SPA duy nhất (vanilla `index/arena/admin.html` + `css/`/`js/` đã xóa Phase 17), `db/schema.sql` + `server/pg.js` (Postgres prod), IndexedDB 11 stores (`DB_VERSION=4`, `clans` frozen)
- Hạ tầng kiểm thử: tests: **154 pass 100% (24 suites)**, backend API thật (`npm run server`) + E2E Playwright Chromium (`spa_e2e`, port riêng, kill cây process) + load 20/20 AC, linter `detect.mjs` 0 error + `lint:js` 0 errors, build Vite sạch


## Product Principles
1. **Fidelity trước tiện nghi** — Giữ đúng luật Codeforces (Pretest/Hack/System Test/Elo) dù UI phức tạp hơn.
2. **Công bằng & minh bạch** — Mọi điểm suy giảm, hack +/-, AST 80% đều giải thích được bằng công thức.
3. **Tự chủ CLB** — Zero heavy framework, host tĩnh được, CLB tự ra đề Polygon và tự chấm Isolate.
4. **Sư phạm qua hack** — Hack không phải trừng phạt mà là bài học tràn số/TLE, hiển thị rõ trong diff.

## Accessibility & Inclusion
WCAG AA (contrast ≥4.5:1, focus ring cam, keyboard nav, `prefers-reduced-motion`, skip-link). Tiếng Việt là chính, code/comments tiếng Anh cho quốc tế.

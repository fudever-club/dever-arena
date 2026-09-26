# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Dual-Stack Architecture:
1. **Lightweight Zero-Build Baseline:** Static HTML5/CSS3 + Vanilla JS ES Modules (`index.html`, `arena.html`, `admin.html`, `css/style.css`, `js/app.js`), Node.js `node:test` for core logic, hostable on any static web server or Nginx without build steps.
2. **Modern Enterprise SPA:** React 18 + Vite + Tailwind CSS v4 (`app.html`, `src/App.jsx`, `src/pages/*.jsx`, `src/components/layout/*.jsx`), Monaco Editor Pro, KaTeX Math Typography Engine (`MathRenderer.jsx`), BroadcastChannel cross-tab synchronization (`src/context/ContestContext.jsx`). Clean production build in ~340ms.

## Users
- **Primary:** Sinh viên FPTU, thành viên CLB FU-DEVER (K18-K21, ban AI/Web/Mobile) thi đấu cá nhân trong contest Rated.
- **Situation:** Trong phòng lab hoặc online, 2h15′ contest gồm Coding 120′ → Hack 15′ → System Testing, cần nộp code, hack code đối thủ cùng Room, xem standings live, tích Elo.
- **Secondary:** Ban Tổ Chức & Giám khảo (ADMIN) điều khiển phase, quét AST anti-cheat, soạn đề Polygon, xem telemetry.

## Product Purpose
Nền tảng thi đấu giải thuật tự chủ của CLB FU-DEVER, tái hiện trung thực vòng đời Codeforces (Pretests → Hack Room → System Test → Elo). Thành công = tổ chức được Round định kỳ, chống gian lận, tính điểm suy giảm theo thời gian công bằng, và là nơi luyện ICPC/Olympic.

## Positioning
Khác Codeforces/VNOI ở chỗ: (1) Room 25 người theo rank để hack có ý nghĩa sư phạm, (2) chế độ Clan Wars House of Buggy (K19/K20...), (3) AST Winnowing anti-cheat khử đổi tên biến/comment, (4) Judge Isolate queue 3 tầng — tất cả gói trong một web arena mà CLB tự vận hành.

## Operating Context
Workflows: Đăng ký → phân Room → Coding (chỉ Pretests) → Hack (mở code cùng Room, +100/-50) → System Testing (45 hidden tests) → Elo recalc. Môi trường: lab FPT, browser, C++20/Python/Java/JS. Tài liệu: CONTEST_RULEBOOK.md, ANTI_CHEAT_POLICY.md, JUDGE_ARCHITECTURE.md, API_SPECIFICATION.md.

## Capabilities and Constraints
- **Capabilities:** Dynamic decay `max(0.3*Pmax, Pmax - Pmax*t/250 -50*W)` (Codeforces), Elo seed/geometric mean, Contest State Machine 5 phases, Hack Room (+100/-50, chấm bằng oracle), Polygon CMS & Admin Problemsetter Studio, Live standings/SSE, AST similarity, Virtual Contest (Ghost Replay), Multi-Contest Scheduler (Div.1-4 rating gates), KaTeX Math Typography (`MathRenderer.jsx`), Scoreboard Freeze & ICPC Dramatic Reveal (`scoreboardFreeze.js`), Testlib Input Validator & Custom Checkers (`testlibValidator.js`), Workspace với Monaco Editor, Resizable Splitters, và Zen Mode.
- **Constraints:** Hoàn toàn không dùng LLM/AI trong nền tảng và Rated contest (Zero-AI Client theo ADR-003, loại bỏ hoàn toàn 9Router); input hack phải qua validator; sandbox cgroups/pids/network none; time 1.0-2.5s / mem 256-512MB.
- **Undecided:** Deploy target (Docker Compose đã spec nhưng chưa lock), backend API chưa implement (hiện IndexedDB dev + schema.sql prod).

## Brand Commitments
Tên `DEVER-Forces` / `DEVER Arena Enterprise`, màu FPT Orange `#ff6600` + Cyan `#00f0ff`, phong cách Cyber Dark, font Outfit + JetBrains Mono, rank colors 7 bậc. Không đổi tên/voice mà không hỏi CLB.

## Evidence on Hand
- Code: `server/{index,judge,oracles,auth,db}.js` (REST + SSE + judge JS/Python/Java/C++ + hack oracle + Elo, 18 tests server + 4 tests E2E + 4 tests PG), `src/core/{scoring,rating,contestStateMachine,auth,virtualContest,scoreboardFreeze}.js`, `src/engine/{astDiff,runner,workerQueue,isolateRunner,testlibValidator}.js` (105 tests PASS), `src/data/problems.js` 5 bài, `src/db/{index,seed,api}.js` (mock layer), `src/lib/apiClient.js`, `src/pages/*.jsx` (không còn Clan Wars, icon thuần text + SVG svgl)
- Docs: SPEC.md, CAPABILITY_MAP.md, DEVER_FORCES_SPECIFICATION.md, DATABASE_SCHEMA.md, API_SPECIFICATION.md, CONTEST_RULEBOOK.md, ANTI_CHEAT_POLICY.md, JUDGE_ARCHITECTURE.md, DESIGN_SYSTEM.md, CHANGELOG.md, ADR-001 tới ADR-004 (15+ docs synced)
- Sản phẩm chạy: `index.html` landing, `arena.html` client, `admin.html` admin, `app.html` React SPA, `css/style.css`, `db/schema.sql` (IndexedDB: 11 stores)
- Hạ tầng kiểm thử: tests: 150 pass 100% (27 suites), backend API thật (`npm run server`) + test vòng đời đầy đủ trong 18 tests server + 4 tests E2E + 4 tests PG, linter `detect.mjs` đạt 0 error, build Vite production sạch (~250ms, main ~88KB)


## Product Principles
1. **Fidelity trước tiện nghi** — Giữ đúng luật Codeforces (Pretest/Hack/System Test/Elo) dù UI phức tạp hơn.
2. **Công bằng & minh bạch** — Mọi điểm suy giảm, hack +/-, AST 80% đều giải thích được bằng công thức.
3. **Tự chủ CLB** — Zero heavy framework, host tĩnh được, CLB tự ra đề Polygon và tự chấm Isolate.
4. **Sư phạm qua hack** — Hack không phải trừng phạt mà là bài học tràn số/TLE, hiển thị rõ trong diff.

## Accessibility & Inclusion
WCAG AA (contrast ≥4.5:1, focus ring cam, keyboard nav, `prefers-reduced-motion`, skip-link). Tiếng Việt là chính, code/comments tiếng Anh cho quốc tế.

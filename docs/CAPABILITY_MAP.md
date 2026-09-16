# Capability Map: DEVER-Forces Platform

| Module ID | Responsibility | Depends On | Status |
| :--- | :--- | :--- | :--- |
| `core-engine` | Elo rating algorithm (`rating.js`), dynamic point decay (`scoring.js`), contest state machine (`contestStateMachine.js`), RBAC auth (`auth.js`), ICPC & IOI scoring (`icpc_scoring.js`) | — | **Completed (20 suites, 78 tests PASS)** |
| `rulebook-docs` | Contest regulations, Anti-cheat policy, Polygon problem standards, System Architecture ADRs, `DESIGN_SYSTEM.md`, `DEPLOYMENT_GUIDE.md` | — | **Completed (14 docs synced)** |
| `storage-db` | IndexedDB local-first storage with 11 object stores (`src/db/index.js`), seed data (`seed.js`), REST mock layer (`api.js`) | `core-engine` | **Completed (11 stores, verified)** |
| `problem-suite` | Standard problem packages (Markdown + LaTeX statement, reference solution, test generator, test validator, editorials) | `rulebook-docs` | **Completed (5 problems built-in + Polygon)** |
| `web-arena` | Modern, responsive, accessible (WCAG AA) Cyber Dark / Light 3-page architecture (`index.html`, `arena.html`, `admin.html`), Live Standings, Hack Room, 1-Click Sample Runner, Cross-tab Phase Sync, Real-time Ticker, PWA manifest | `core-engine`, `storage-db`, `problem-suite` | **Completed (PWA, 0 detect errors)** |
| `sandbox-judge-spec`| Docker/Isolate sandbox execution contract, security constraints (cgroups, pids, network isolation), judge queue protocol, browser sandbox guard (`runner.js` with 18 blocked APIs) | `core-engine` | **Completed (Hardened)** |
| `virtual-contest` | Virtual Contest Engine: asynchronous ghost replay of historical submissions, personal contest countdown timer, dynamic standings at elapsed virtual time | `core-engine`, `storage-db` | **Completed (Phase 6)** |
| `multi-contest-sched` | Multi-contest scheduler, Division eligibility gate (Elo-based), upcoming/live/archive contest roster | `core-engine`, `storage-db` | **Completed (Phase 6)** |
| `clan-wars-aggregator`| Automated Clan Elo aggregator, Top-5 member power score, inter-clan battle log and trophy tracking, LaTeX math rendering | `core-engine`, `storage-db` | **Completed (Phase 7)** |
| `judge-worker-queue` | 3-Tier Priority Queue dispatch (Instant Hack > Pretests > Batch System Test) & Isolate process simulator | `core-engine`, `sandbox-judge-spec` | **Completed (Phase 8)** |
| `scoreboard-freeze` | Scoreboard Freeze at $T_{\text{freeze}}$, anonymous '?' pending verdicts, and dramatic ICPC unfreeze step unroller | `core-engine`, `storage-db` | **Completed (Phase 9)** |
| `testlib-validator` | Polygon problemsetter testcase input validator & float tolerance custom checker | `problem-suite` | **Completed (Phase 10)** |
| `leetcode-design-consensus` | Multi-Agent Review Council (5 chuyên gia: Guest, Member, Admin, Auth, LeetCode Lead), bản đặc tả LeetCode 3-Pane Workspace, trang /login chuyên biệt, BroadcastChannel cross-tab state sync & lộ trình React + Vite | `web-arena`, `rulebook-docs` | **Completed (`docs/design.md`)** |
| `react-vite-leetcode-workspace` | Kiến trúc React 18 + Vite + Tailwind CSS SPA: Không gian làm bài LeetCode 3 phân vùng (Monaco Editor, Multi-Tab Testcase Diff Console, Auto-Save chống mất code), Trang Đăng nhập (/login) với 1-Click Fast Switch, Kênh đồng bộ BroadcastChannel đa tab | `leetcode-design-consensus`, `core-engine`, `problem-suite` | **Completed (`npm run dev` & `npm run build` in 286ms)** |
| `full-system-portal-separation` | Hệ Thống Toàn Diện Tách Biệt Member & Admin: Member Portal (`MemberLayout` với Navbar CP thanh thoát, Standings ICPC Dramatic Unfreeze, Hack Room Split-Screen, Clan Wars Harmonics) và Admin Portal (`AdminLayout` với Sidebar 5 module: Phase Orchestrator, AST Radar, Polygon Studio, Telemetry, Hack Rooms) | `react-vite-leetcode-workspace` | **Completed (8 full pages, 100% routes wired)** |
| `workspace-ergonomics-resizable` | Tiện ích Công thái học Không gian làm bài: Resizable Splitters kéo thả 2 chiều (Problem Statement vs Editor 20–80%, Editor vs Testcase Console 30–75%), LocalStorage persistence tự ghi nhớ tỷ lệ, Zen Mode 2 cấp độ (ẩn testcase / toàn màn hình phóng đại) với phím tắt `Esc` | `react-vite-leetcode-workspace` | **Completed (`ProblemWorkspace.jsx`)** |
| `katex-math-and-polygon-studio` | Công cụ Soạn thảo Đề & Hiển thị Toán học: KaTeX Math Typography Engine (`MathRenderer.jsx` hỗ trợ inline `$x$` và display block `$$\sum$$`), Polygon Problemsetter Studio trong Admin Command Center (thêm/sửa/xóa đề thi, live preview 2 cột, validation bounds, đồng bộ thời gian thực đa tab qua `BroadcastChannel`) | `full-system-portal-separation`, `problem-suite` | **Completed (`AdminLayout.jsx`, `ContestContext.jsx`)** |

### Build Order:
`core-engine` & `rulebook-docs` ➔ `storage-db` ➔ `problem-suite` ➔ `web-arena` ➔ `sandbox-judge-spec` ➔ `virtual-contest` & `multi-contest-sched` ➔ `clan-wars-aggregator` ➔ `judge-worker-queue` ➔ `scoreboard-freeze` ➔ `testlib-validator` ➔ `leetcode-design-consensus` ➔ `react-vite-leetcode-workspace` ➔ `full-system-portal-separation` ➔ `workspace-ergonomics-resizable` ➔ `katex-math-and-polygon-studio`

### Verification Standard:
- **Unit & Integration:** `node --test tests/*.test.js` (98 tests across 25 suites PASS 100%)
- **Architecture & Design:** `node detect.mjs` (0 errors)
- **Vite Production Build:** `npm run build` (Clean production bundle in ~340ms)
- **Source of truth:** `docs/design.md`, `docs/DESIGN_SYSTEM.md`, `docs/SPEC.md`, `docs/decisions/ADR-003-pure-core-engine-and-zero-ai.md`
- **Implementation:** `src/App.jsx`, `src/pages/*.jsx`, `src/components/layout/*.jsx`, `src/context/*.jsx`, `src/components/common/MathRenderer.jsx`




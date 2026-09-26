# Chương trình nhánh `page/*` — Manifest + Quy trình merge về `main`

> Nguồn sự thật cho mọi PR song song theo trang/mảng. Nhánh `page/docs` (nhánh hiện tại) chỉ chạm `docs/**`, `tasks/**`, `README.md`, `PRODUCT.md`, `CONTRIBUTING.md` — không chạm `src/`/`server/`/`tests/`.

## 1. Manifest (tại thời điểm `main` = `b9f3871`)

| Nhánh | Mục tiêu | Files sở hữu (không nhánh khác được chạm) | Trạng thái |
|---|---|---|---|
| `page/landing` | Landing: next-contest card, contests table, problemset preview, legal footer | `src/pages/LandingPage.jsx`, `src/components/layout/GuestLayout.jsx` (phần landing) | **Đã tách** — 1 commit `ba0331a` trên `main`, + `ContestContext.jsx` + `eslint.config.mjs` dùng chung |
| `page/contesthub` | ContestHub: CF grouping live/upcoming/past, countdown từng contest, virtual per finished, progress bar | `src/pages/ContestHub.jsx` (gồm `TestingQueue`) | **Đã tách** — 1 commit `1067e01` trên `main`, + 2 file dùng chung |
| `page/workspace` | Workspace: limits box, copy output, verdict pills, run-all, history API, mobile tabs | `src/pages/ProblemWorkspace.jsx`, `src/index.css` (phần workspace) | **Đã tách** — 1 commit `6b4e6ec` trên `main`, + 2 file dùng chung |
| `page/hackroom` | HackRoom: phase gate, history, self-block, open count, live refresh, a11y | `src/pages/HackRoomPage.jsx` | **Đã tách** — 1 commit `76a2700` trên `main`, + 2 file dùng chung |
| `page/standings` | Standings: rank colors, solved col, cell details, room filter, pagination, 30s refresh, freeze pill | `src/pages/StandingsPage.jsx` | **Đã tách** — 1 commit `4b421d0` trên `main`, + 2 file dùng chung |
| `page/auth` | Auth: login/JWT, `RequireAuth`/`RequireAdmin`, `AuthContext`, cấp tài khoản admin | `src/pages/LoginPage.jsx`, `src/context/AuthContext.jsx`, `src/core/auth.js`, `server/auth.js`, guards trong `src/App.jsx` | **Chưa tách** — đang trùng `main` (`b9f3871`), giữ chỗ cho hardening auth tiếp theo |
| `page/admin` | Admin Command Center: sidebar 6 modules, `AdminSection`, `StressPanel`, phase/freeze/telemetry | `src/components/layout/AdminLayout.jsx`, routes `/admin` trong `src/App.jsx`, `server/` routes admin (problems/contests/users/stress/testcases/phase/rejudge) | **Chưa tách** — đang trùng `main`, giữ chỗ cho đại tu admin tiếp theo |
| `page/backend` | Backend + judge: REST/SSE, fork pool, oracles, Postgres adapter, Docker/compose | `server/**`, `docker-compose.yml`, `Dockerfile.*`, `nginx.conf`, `scripts/{backup,restore,load_test}.mjs`, `tests/server_api.test.js`, `tests/health.test.js`, `tests/pg_store.test.js` | **Chưa tách** — đang trùng `main`, giữ chỗ cho judge/scale tiếp theo |
| `page/docs` | Docs: audit stale, manifest này, Phase 27 | `docs/**`, `tasks/todo.md` (chỉ append Phase 27), `README.md`, `PRODUCT.md`, `CONTRIBUTING.md` | **Đang làm** — nhánh hiện tại |

### File dùng chung (xung đột đã biết trước)
- `src/context/ContestContext.jsx` — cả 5 nhánh đã tách đều mang **cùng 1 diff** (gỡ dòng `// eslint-disable-next-line react-hooks/exhaustive-deps`). Merge 1 lần, các nhánh sau rebase là hết xung đột.
- `eslint.config.mjs` — cả 5 nhánh đều mang **cùng 1 diff** (mở `src/**/*.{js,jsx}` + `parserOptions.jsx` + globals `atob/btoa/FileReader/DOMParser`). Merge 1 lần tương tự.
- `src/context/ContestContext.jsx` + `src/App.jsx` + `src/index.css` về lâu dài là **sở hữu chung có kiểm soát**: mọi thay đổi phải là additive (thêm provider/giá trị, không đổi chữ ký đang dùng) và phải báo trong PR.

## 2. Quy trình merge về `main`

### Thứ tự merge (khuyến nghị)
1. **Hạ tầng chung trước:** lấy diff `eslint.config.mjs` + `ContestContext.jsx` từ `page/landing` (hoặc bất kỳ nhánh đã tách nào — chúng giống hệt nhau) merge vào `main` trước, rồi rebase 4 nhánh còn lại.
2. **Nhánh lá không giao nhau (thứ tự nào cũng được):** `page/landing` → `page/contesthub` → `page/workspace` → `page/hackroom` → `page/standings`. Mỗi nhánh chỉ sở hữu 1 file page riêng nên sau bước 1 sẽ merge sạch.
3. **Nhánh giữ chỗ:** `page/auth`, `page/admin`, `page/backend` hiện trùng `main` — khi có commit thật mới merge, tuân thủ files sở hữu ở bảng trên.
4. **`page/docs` cuối cùng (hoặc bất kỳ lúc nào):** chỉ chạm docs — không xung đột code với các nhánh trên. Nếu chạm `README.md`/`PRODUCT.md`/`CONTRIBUTING.md` cùng lúc với nhánh khác thì lấy bản `page/docs` (docs là nguồn sự thật).

### Giải quyết xung đột
- **Nguyên tắc:** file thuộc nhánh nào thì nhánh đó thắng (theo bảng sở hữu). File dùng chung (`ContestContext.jsx`, `App.jsx`, `index.css`, `eslint.config.mjs`) ưu tiên **giữ cả hai** (union), không xóa code của nhánh đã merge.
- **Tuyệt đối không:** checkout/chuyển nhánh bừa bãi trong worktree người khác; force-push `main`; mang code `src/`/`server/`/`tests/` vào PR `page/docs` (và ngược lại, không mang docs-spec vào PR code trừ `CHANGELOG`/`todo` theo orchestrator).
- **Khi xung đột khó:** dừng merge, rebase nhánh con lên `main` mới, chạy gate (mục 3), nhờ owner nhánh còn lại review.

### Gate bắt buộc trước merge (theo orchestrator + `CONTRIBUTING.md`)
```bash
npm run test    # 150 tests / 21 suites, phải 150 pass
node detect.mjs # 0 error
npm run build   # bundle sạch (57–58 modules)
npm run lint:js # 0 errors (eslint.config.mjs flat)
npm run test:load  # 20 job đồng loạt → 20/20 AC (cho PR chạm judge/server)
npm run audit:high # 0 high/critical
```
- PR đổi hành vi contest: cập nhật `docs/` + `PRODUCT.md` + `tasks/todo.md` cùng PR (quy ước chạm code).
- PR thêm endpoint server: cập nhật `docs/API_SPECIFICATION.md` + test trong `tests/server_api.test.js`.
- Sau merge mỗi nhánh: cập nhật `docs/CHANGELOG.md` + số liệu tests trong `README.md`/`PRODUCT.md`/`docs/SPEC.md` (hiện tại: **150/150, 21 suites**).
- Mỗi worktree chỉ commit **trên đúng nhánh của mình** (`git branch --show-current` trước `git add -A && git commit`).

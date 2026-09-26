# Contributing — DEVER Arena (CLB FU-DEVER)

## 1. Chuẩn bị (5 phút)
```bash
git clone https://github.com/fudever-club/dever-arena.git
cd dever-arena
npm install
npm run server   # terminal 1 — API :8787, DB tự seed
npm run dev      # terminal 2 — SPA http://localhost:5173/app.html
```
Seed: `dever_hero/hero123` (thí sinh), `dever_admin/admin123` (giám khảo).

## 2. Vòng verify bắt buộc trước mọi PR
```bash
npm run test    # 136 tests, phải 136 pass
node detect.mjs # 0 error
npm run build   # bundle sạch
```
CI (`.github/workflows/ci.yml`) chạy đúng 3 lệnh trên + `npm audit --audit-level=high`.

## 3. Quy ước chạm code
- Core (`src/core/`, `src/engine/`): hàm thuần, không động DOM — mọi luật điểm/hack/Elo/AST phải có unit test.
- Server (`server/`): route mới phải có test vòng đời trong `tests/server_api.test.js`; không log `source_code`/password.
- Frontend (`src/pages/`): không `lucide-react`, không emoji trang trí (SVG `public/icons/`), check `detect.mjs`.
- Docs: đổi hành vi contest → cập nhật `docs/` + `PRODUCT.md` + `tasks/todo.md` cùng PR.

## 4. An toàn contest
- Không gửi code thí sinh ra ngoài (Zero-AI, ADR-003).
- Không bịa verdict/điểm ở frontend — mọi số phải từ API (`/api/health`, `/api/ready` để kiểm tra).
- Backup trước Round Rated: `npm run backup` (xem `docs/ops/BACKUP_RESTORE.md`).

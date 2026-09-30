# LIVE OPS — DEVER Round #2 (RATED) · Thứ Tư 07/10/2026

> Contest: `contest_25_munhjlk5` · slug `dever-round-2` · ICPC · 120' · start **12:00 UTC = 19:00 VN**
> Scheduler tự chuyển pha: REGISTRATION→CODING khi tới giờ, CODING→FINISHED khi hết 120' + tự chấm Elo (rated). **BTC không cần bấm pha** — nhiệm vụ là giám sát + xử lý sự cố.
> Credentials: `dever-admin-credentials.secret` (admin chính `dever_admin` + backup `dever_btc`). Runbook sự cố: `docs/ops/PROD_RUNBOOK.md`.

## Trước giờ G (18:00–18:55 VN)

| Giờ VN | Việc | Cách kiểm tra |
|---|---|---|
| 18:00 | Probe tổng: `node scripts/probe_monitor.mjs` | verdict OK, flush ok |
| 18:10 | Health + uptime + judge worker: curl `/api/health` | `status:ok`, uptime không restart lạ |
| 18:20 | Đếm đăng ký + list participant (admin token) | đối chiếu kỳ vọng CLB |
| 18:25 | Xem 4 bài vẫn APPROVED + 59 testcases | admin panel problemset |
| 18:30 | Login thử `ts_test` (thí sinh) — không nộp bài | login 200, thấy Round #2 |
| 18:40 | Toolchain probe (tùy chọn, không khuyến khích sát giờ nếu tải cao): `node scripts/probe_toolchain.mjs` | cpp/java AC |
| 18:50 | Mở 2 kênh trực: dashboard Specific (logs/metrics) + tab Standings; công bố link fanpage | — |
| 18:55 | Chốt: KHÔNG deploy gì từ giờ tới sau thi; mọi thay đổi code cấm (freeze code) | — |

## Trong thi (19:00–21:00 VN)

- **19:00** — scheduler tự REGISTRATION→CODING. Xác nhận trong 1 phút: GET contest → `status:"CODING"`, web hero đếm ngược đúng, thí sinh nộp được (theo dõi submissions đầu tiên).
- **Mỗi 10–15 phút:** probe_monitor + dashboard logs (lỗi 5xx, `db_flush_failed`), số submission tăng đều, standings ICPC cập nhật.
- **Sự cố thường gặp → xử lý:** api 503 → xem logs + `specific deployment show`; flush stale → đừng restart vội, xem log `db_flush_failed` (thường tự hồi phục, /ready 503 chỉ khi >60s); thí sinh báo không nộp được → check toolchain của ngôn ngữ đó bằng `scripts/diag_toolchain.mjs`.
- **Freeze 20' cuối (20:40 VN):** ⚠️ freeze standings hiện chỉ hỗ trợ format CODEFORCES (`/standings?frozen=1`), Round #2 là ICPC → freeze ICPC chưa có. Phương án BTC: không công bố standings 20' cuối (đọc API riêng, không share), hoặc chấp nhận không freeze như Round #1. **Quyết định trước 19:00, ghi vào đây.**
- **20:55** — thông báo 5 phút cuối cho thí sinh.

## Sau thi (21:00 VN)

- **21:00** — scheduler tự CODING→FINISHED + chấm Elo (rated lần đầu chạy thật). Xác nhận: contest `FINISHED`, standings chốt, `GET /contests/dever-round-2/rating-changes` trả dữ liệu.
- Podium/tổng kết + đăng fanpage cảm ơn (draft sẵn `docs/marketing/round2-fanpage.md`).
- Upsolve mở (bài vẫn xem được sau FINISHED).
- **+24h (8/10):** retro — số liệu (số thí sinh, submissions, verdict distribution, sự cố), drill restore với dữ liệu thật (100+ submissions), checklist bài học → cập nhật runbook.

## Trực sự cố — liên hệ

- Admin chính: `dever_admin` (secret file) · Backup: `dever_btc`
- Nền tảng: dashboard https://dashboard.specific.dev (logs, DB browser, restart, scale)
- Khôi phục khẩn: runbook `docs/ops/PROD_RUNBOOK.md` (restore + cảnh báo xoay mật khẩu)

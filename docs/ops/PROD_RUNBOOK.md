# DEVER Arena — PROD Runbook (Specific Cloud) — 1 trang

> Bổ sung cho `INCIDENT_RUNBOOK.md` (bản docker local). Bản này cho PROD thật trên Specific.
> Prod: web `https://web-elegant-horse.spcf.app` · api `https://api-elegant-horse.spcf.app`
> Deploy tự động khi push `main` (~40s) — KHÔNG đợi CI. CI song song kiểm chứng.
> Mật khẩu admin: file `dever-admin-credentials.secret` (gitignored, KHÔNG commit).

## 0. Kiểm tra nhanh 30 giây
```bash
node scripts/probe_monitor.mjs            # 1 dòng JSON, exit 0 = OK
curl -s https://api-elegant-horse.spcf.app/api/ready   # ready:true + users/contests
```
`/ready` trả **503 + `reason:DB_FLUSH_STALE`** = ghi DB chờ persist > 60s — SỰ CỐ THẬT, xem §2.

## 1. Web hoặc API down
1. Dashboard Specific → service `api`/`web` → Logs.
2. Deploy lại bằng push mới (hoặc dashboard → Redeploy).
3. Nếu DB lỗi: kiểm tra `postgres "main"` status; server tự retry kết nối khi boot.

## 2. Persist DB lỗi (flush thất bại / /ready 503)
- Dấu hiệu: log JSON `{"event":"db_flush_failed",...}`, `flush.ok:false` trên `/health`.
- Dữ liệu KHÔNG mất trong lúc process còn sống (mirror RAM giữ, tự retry) — nhưng không nên để quá 15 phút:
  1. Log api: tìm `db_flush_failed` → `error` field là nguyên nhân (thường DB restart/timeout).
  2. Khi Postgres khỏe lại: flush tự phục hồi + log `db_flush_recovered`.
  3. Không phục hồi sau 15': Redeploy api (mirror nạp lại từ DB — dữ liệu đã persist an toàn).
- ⚠️ **Bug 12 (Vòng 37.7):** nếu flush kẹt vô hạn VÀ container restart, batch trong RAM MẤT. Đã vá 2 tầng:
  flushTables xóa-trước-upsert (không còn kẹt replace-by-unique `idx_users_username`) + SIGTERM flush tường minh trước khi thoát.
- ⚠️ **Blind spot monitor:** `/health` `ok:true` nhưng `last_success_at:null` + uptime lớn = flush chưa TỪNG thành công sau boot — coi như degraded, kiểm tra logs `db_flush_failed` dù `/ready` xanh.

## 3. Restore DB (quy trình ĐÃ KIỂM CHỨNG — drill PASS 5/5 29/9)
```bash
# 1. Dump hiện tại (an toàn trước, khuyến khích)
curl -s -H "authorization: Bearer $TOKEN" https://api-elegant-horse.spcf.app/api/v1/admin/backup-dump -o backups/now.json
# 2. Chuẩn bị dump muốn phục hồi (từ S3 backups/ hoặc file local), rồi:
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('backups/<file>.json','utf8'));fs.writeFileSync('restore.json',JSON.stringify({dump:d.data?d:d}))" 2>/dev/null || true
curl -s -X POST https://api-elegant-horse.spcf.app/api/v1/admin/restore-backup \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  --data-binary @backups/<file>.json
# 3. Server tự reload mirror — không restart. Snapshot pre-restore tự đẩy S3 (luôn đảo ngược được).
```

> ⚠️ **SAU MỌI RESTORE VỀ DUMP CŨ — XOAY LẠI MẬT KHẨU ADMIN NGAY** (bug 11, Vòng 37.4):
> dump cũ chứa password hash cũ → restore làm mật khẩu hiện hành TRỞ VỀ CŨ (secret xoay bị hoàn nguyên).
> Cách xử lý: chạy lại `node scripts/rotate_admin_password.mjs "<mật-khẩu-hiện-hành>"` (đổi sang secret file
> đang có) HOẶC cập nhật `extra.password` của user admin trong dump về hash hiện hành trước khi restore.
> Dấu hiệu nhận biết: script/tooling đột nhiên 401 sau khi restore.
```
- Dump JSON > ~2MB có thể bị proxy chặn 502 → restore theo phần (dùng `rebuild_r2_suite.mjs` cho testcases) hoặc dump nhỏ.
- Drill định kỳ: hằng tháng chạy `node scripts/restore_drill.mjs backups/prod-dump-drill.json` (tự động 5 bước, an toàn prod).

## 4. Xoay secret admin (đã làm 30/9 — làm lại mỗi 90 ngày hoặc khi nghi lộ)
```bash
node scripts/rotate_admin_password.mjs "<mật-khẩu-mới>"
# script tự: đổi qua API → thử login mật khẩu cũ (phải 401) → mới (phải 200) → ghi .secret file
```
- JWT secret đổi trên Specific dashboard (service api → env `DEVER_JWT_SECRET`) — làm ngoài giờ thi, mọi token cũ hết hạn ngay.

## 5. Kỳ thi LIVE (7/10 19:00–21:00 VN)
- Checklist chi tiết từng mốc: `docs/ops/LIVE_OPS_ROUND2.md`.
- Trước 30': `node scripts/probe_monitor.mjs` xanh + dashboard telemetry.
- Trong thi: theo dõi `/api/ready` mỗi 5'; standings qua UI. Freeze ICPC CHƯA có (chỉ CODEFORCES — gap Phase 39): phương án không công bố standings 20' cuối.
- Sự cố chấm: `POST /api/v1/admin/rejudge {submission_id}`; toolchain probe: `node scripts/probe_toolchain.mjs <slug>`.
- Sự cố nghiêm trọng: KHÔNG restore trong giờ thi — ghi nhận, xử lý sau FINISHED.

## 6. Cron tự động trên Specific
| Cron | Lịch | Việc | Kiểm chứng |
|---|---|---|---|
| `db-backup` | 02:00 UTC (09:00 VN) | dump → S3 + marker `last_cron_backup_at` | tự động bởi `backup-verify` |
| `backup-verify` | 02:30 UTC (09:30 VN) | đọc marker trực tiếp Postgres, FAIL → exit 1 | logs cron trên dashboard (A1 tự động hóa, Vòng 37.6) |
| `probe-monitor` | mỗi phút | health/ready/web + flush | log JSON `verdict:OK/ALERT` |

## 7. Liên hệ leo thang
- COO (Buffy) → chủ dự án CEO. Dashboard Specific: chủ dự án tự thao tác (DNS/domain/env secret).

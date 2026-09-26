# DEVER Arena — Incident Runbook (khi contest đang LIVE)

> Mục tiêu: mọi sự cố trong 135' contest đều có người chịu trách nhiệm + lệnh copy-paste được.
> On-call: 1 Admin trực phase + 1 Judge trực kỹ thuật. Kênh duy nhất: nhóm chat CLB + tab Admin Telemetry.

## 0. Kiểm tra nhanh (30 giây)
```bash
curl -s http://localhost:8787/api/health | head -c 300
curl -s http://localhost:8787/api/ready | head -c 300
docker compose ps
```

## 1. API treo / 5xx
1. `docker compose logs --tail=100 api`
2. Log JSON có `level:"error"` kèm `method/path/status` (xem server/index.js `logReq`).
3. Restart nhẹ, không mất dữ liệu (volume `dever-data`):
```bash
docker compose restart api
```
4. Nếu vẫn lỗi: `docker compose up -d --build api`, kiểm tra `DEVER_JWT_SECRET` trong `.env`.

## 2. Judge tắc / submissions kẹt
1. Tab Admin → Telemetry: xem hàng đợi + worker.
2. `POST /api/v1/admin/rejudge` cho bài kẹt (endpoint đã có từ Phase 16).
3. Nếu worker fork chết: restart api (queue.js tự respawn worker, timeout 60s).
4. Trường hợp xấu: pause contest (chuyển phase về CODING giữ nguyên giờ), chấm bù sau giờ thi.

## 3. DB đầy / mất dữ liệu
1. Kiểm tra dung lượng: `docker compose exec api du -sh /app/server/data`.
2. Backup khẩn trước mọi thao tác:
```bash
npm run backup
```
3. Restore bản gần nhất:
```bash
npm run restore -- backups/db-<mới-nhất>.json
docker compose restart api
```

## 4. Sai phase / lộ đề
1. Phase machine chỉ cho đi tới (`REGISTRATION→CODING→HACK→SYSTEM→FINISHED`); không nhảy cóc.
2. Editorial chỉ mở ở FINISHED (server gate). Nếu lộ: đổi đề dự phòng qua Admin Studio (publish lên server), rejudge.
3. Mọi đổi phase đều broadcast SSE + log — ghi lại giờ + người bấm để hậu kiểm.

## 5. Sau sự cố (trong 24h)
- Ghi `docs/ops/INCIDENTS.md` entry: giờ, triệu chứng, lệnh đã chạy, kết quả.
- Nếu mất điểm thí sinh: chạy system test lại + recalc Elo rồi mới công bố standings cuối.

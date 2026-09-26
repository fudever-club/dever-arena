# DEVER Arena — Backup & Restore

## Backup tự động trước giờ thi (bắt buộc)
```bash
cp .env.example .env   # lần đầu
npm run backup          # tạo backups/db-YYYYMMDD-HHmmss.json
```
- JSON là source of truth khi chạy single-node (`server/data/db.json`, volume `dever-data`).
- Nếu đặt `DEVER_DATABASE_URL`, script tự `pg_dump` thêm `backups/pg-<stamp>.dump`.
- Giữ ít nhất 3 bản: trước contest, sau system test, sau recalc Elo.

## Restore
```bash
npm run restore -- backups/db-2026-09-26T07-00-00.json
docker compose restart api
curl -s http://localhost:8787/api/ready
```
Script tự lưu bản hiện tại thành `db.pre-restore-<stamp>.json` trước khi ghi đè.

## Postgres (compose service `db`)
- Volume `dever-pgdata` giữ dữ liệu qua restart.
- Sao lưu ngoài giờ thi: `pg_dump` via `npm run backup` (cần `DEVER_DATABASE_URL`).
- Kiểm chứng restore ở môi trường staging trước khi đụng production.

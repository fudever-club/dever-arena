---
name: dever-live-ops
description: Live Round Operations & On-call for DEVER Arena. Specialized in pre-contest checklists, real-time monitoring, incident response during live rounds, backup/restore drills, and post-round Elo finalization. Triggers when running, monitoring, or recovering a live contest.
---

# Live Ops Skill

## Overview
Owns the 135' live window: `CODING 120'` → `HACK 15'` → `SYSTEM_TESTING` → Elo. Docs: `docs/ops/INCIDENT_RUNBOOK.md`, `docs/ops/BACKUP_RESTORE.md`, `docs/ops/DATA_RETENTION.md`.

## Pre-Contest Checklist (T-60')
1. `npm run backup` — giữ bản trước giờ thi.
2. `curl /api/health` + `/api/ready` — cả hai 200.
3. `docker compose ps` — api healthy, web up.
4. Kiểm tra NTP/đồng hồ máy chủ (lệch < 10ms), dung lượng `/app/server/data` còn trống.
5. Warm-up: đăng nhập seed `dever_admin`, mở Admin Telemetry, xác nhận judge worker répond qua 1 submission thử.

## During Contest (on-call 2 người)
- **Admin trực phase:** bấm chuyển phase đúng thứ tự, ghi giờ + người bấm mỗi lần đổi phase.
- **Judge trực kỹ thuật:** theo dõi log JSON `{level,method,path,status,ms}`; `level:error` + `status:5xx` → xử lý theo runbook.
- Sự cố judge kẹt: Admin → Telemetry → `POST /api/v1/admin/rejudge` bài kẹt; worker fork tự respawn (timeout 60s).
- Không bao giờ sửa DB tay giữa giờ thi khi chưa `npm run backup`.

## Post-Round
1. Chạy system test hết → recalc Elo → `npm run backup` (bản sau chốt).
2. Mở editorial (server tự mở ở FINISHED), công bố standings cuối.
3. Ghi entry sự cố (nếu có) vào runbook trong 24h.
4. Áp retention: sau 12 tháng xóa `source_code`, chỉ giữ verdict + điểm.

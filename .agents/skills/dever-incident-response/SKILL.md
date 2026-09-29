---
name: dever-incident-response
description: Quy trình phản hồi sự cố production của DEVER Arena trên Specific Cloud — phát hiện, phân cấp, khắc phục, post-mortem. Dùng khi prod down, dữ liệu lỗi, deploy hỏng.
---

# DEVER Incident Response

## Phân cấp
- **SEV1** — prod down / mất dữ liệu: báo CEO trong 15 phút, khắc phục ngay, post-mortem 24h.
- **SEV2** — tính năng chính lỗi (nộp bài, chấm, standings): báo CEO trong 1 giờ.
- **SEV3** — lỗi phụ (UI, thông báo): sửa trong sprint, ghi changelog.

## Runbook chuẩn
1. **Đánh giá:** `specific status` (deployment state) + `specific query "SELECT ... observability.logs ..."` + `curl /api/health`.
2. **Deploy hỏng:** `specific deployment show` (+`--output` xem log build lỗi) → `specific deployment retry` hoặc deploy commit tốt trước đó (`git revert` + push — pipeline tự deploy).
3. **DB lỗi:** KHÔNG BAO GIỜ sửa tay data khi server đang chạy mirror (flush 5s sẽ ghi đè) — mọi sửa data phải qua API admin hoặc dừng server trước.
4. **Backup:** dumps hằng ngày trên S3 `backups/db-*.json`; restore qua `POST /admin/restore-backup` (snapshot pre-restore tự đẩy S3 trước khi TRUNCATE).
5. **Migration kẹt:** schema_version chưa flip → KV/archive nguyên vẹn, sửa nguyên nhân rồi chạy lại `POST /admin/migrate-schema` (idempotent).

## Bài học đã trả giá (29/9/2026)
- jsonb + mảng JS → flush nổ NGẦM (API vẫn 200) — luôn kiểm tra `observability.logs WHERE Body LIKE '%flush thất bại%'` khi nghi dữ liệu lệch.
- Đổi data prod qua SQL tay là sai — flush mirror sẽ ghi đè trong 5s.
- Deploy tự động KHÔNG chờ CI xanh (chính sách đã chốt) — commit lỗi lên prod trước khi CI báo đỏ; bù lại CI song song kiểm chứng.

## Sau sự cố
Post-mortem 1 trang: timeline / gốc rễ / ảnh hưởng / hành động phòng ngừa — lưu `docs/ops/INCIDENT_RUNBOOK.md`.

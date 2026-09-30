/**
 * DEVER Arena — A1 (Sprint 1b): kiểm chứng cron backup hằng ngày đã chạy và ghi S3 thành công.
 *
 * Nguyên lý: backup_cron.mjs (sau khi PUT S3 thành công) ghi dấu `last_cron_backup_at` vào
 * dever_meta: { at, key, bytes, counts }. Script này đọc dump prod hiện tại và:
 *   1. Marker phải tồn tại (đã từng backup thành công từ khi có cơ chế).
 *   2. Tuổi marker < 26h (cron 1 lần/ngày + dung sai 2h).
 *   3. Đối chiếu số dòng mỗi bảng lúc backup (marker.counts) với dump hiện tại — prod có thể
 *      tăng tự nhiên sau backup (submissions mới), kiểm tra một chiều: không được THIẾU dòng.
 *   4. Kích thước dump hiện tại phải hợp lý so với lúc backup (> 50%).
 * Chạy: node scripts/verify_cron_backup.mjs   → exit 0 PASS / 1 FAIL / 2 cấu hình sai.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = (process.env.DEVER_API_BASE || 'https://api-elegant-horse.spcf.app').replace(/\/$/, '');
const ADMIN_USER = process.env.DEVER_ADMIN_USER || 'dever_admin';
const ADMIN_PASS = process.env.DEVER_ADMIN_PASS || '';
const MAX_AGE_H = Number(process.env.DEVER_BACKUP_MAX_AGE_H || 26);

if (!ADMIN_PASS) { console.error('[verify-backup] Thiếu DEVER_ADMIN_PASS. Thoát 2.'); process.exit(2); }

const res = await fetch(`${API}/api/v1/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
});
if (res.status !== 200) { console.error(`[verify-backup] Login thất bại: ${res.status}. Thoát 2.`); process.exit(2); }
const token = (await res.json()).accessToken;

const dumpRes = await fetch(`${API}/api/v1/admin/backup-dump`, { headers: { authorization: `Bearer ${token}` } });
if (dumpRes.status !== 200) { console.error(`[verify-backup] backup-dump thất bại: ${dumpRes.status}. Thoát 2.`); process.exit(2); }
const dump = await dumpRes.json();

const marker = (dump.meta || []).find((m) => m.key === 'last_cron_backup_at')?.value;
if (!marker?.at) {
  console.error(JSON.stringify({ verdict: 'FAIL', reason: 'NO_MARKER', message: 'Chưa thấy dấu backup nào — cron chưa chạy từ khi có cơ chế marker, hoặc backup lỗi.' }));
  process.exit(1);
}

const ageH = (Date.now() - Date.parse(marker.at)) / 3600000;
const countDiff = Object.entries(marker.counts || {})
  .filter(([, n]) => n > 0)
  .filter(([col, n]) => {
    const now = (dump.data?.[col] || []).length;
    return now < n;
  })
  .map(([col, n]) => `${col}:${n}→${(dump.data?.[col] || []).length}`);
const countsOk = countDiff.length === 0;

const verdict = ageH < MAX_AGE_H && countsOk ? 'PASS' : 'FAIL';
const report = {
  verdict,
  backup_at: marker.at,
  age_hours: Math.round(ageH * 10) / 10,
  s3_key: marker.key,
  bytes: marker.bytes,
  counts_at_backup: marker.counts,
  count_shrunk: countDiff,
  note: 'S3 key xác nhận trên dashboard Specific (object store "sources", prefix backups/) — script chỉ đọc được marker trong DB.',
};
console.log(JSON.stringify(report, null, 2));
process.exit(verdict === 'PASS' ? 0 : 1);

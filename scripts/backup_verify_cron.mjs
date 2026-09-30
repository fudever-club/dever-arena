/**
 * DEVER Arena — cron verify backup (tự động hóa A1, Vòng 37.6).
 * Chạy 30 phút sau cron db-backup (03:30 UTC hằng ngày) — kiểm chứng marker
 * `last_cron_backup_at` trong dever_meta do backup_cron.mjs ghi sau khi PUT S3 OK.
 *
 * Đọc TRỰC TIẾP Postgres (cùng môi trường cron với backup) — không cần mật khẩu admin,
 * không gọi API. FAIL → exit 1 → thấy ngay trong logs cron trên dashboard Specific.
 *
 * Kiểm tra: (1) marker tồn tại; (2) tuổi < 26h; (3) counts lúc backup không được lớn hơn
 * COUNT bảng thật hiện tại (one-way: prod chỉ được tăng, không được mất dòng).
 *
 * Không có DEVER_DATABASE_URL → thoát 0 (chạy local JSON mode không liên quan).
 */
import { Pool } from 'pg';

const url = process.env.DEVER_DATABASE_URL;
if (!url) {
  console.log('[backup-verify] Không có DEVER_DATABASE_URL — bỏ qua (local JSON mode). Thoát.');
  process.exit(0);
}

const MAX_AGE_H = 26;
const pool = new Pool({ connectionString: url });

try {
  const meta = await pool.query(`SELECT value FROM dever_meta WHERE key = 'last_cron_backup_at'`);
  let marker = meta.rows[0]?.value;
  if (typeof marker === 'string') {
    try { marker = JSON.parse(marker); } catch { /* giữ nguyên */ }
  }
  if (!marker?.at) {
    console.error(JSON.stringify({ verdict: 'FAIL', reason: 'NO_MARKER', message: 'Chưa có dấu backup nào — cron backup chưa chạy thành công từ khi có cơ chế marker.' }));
    process.exit(1);
  }

  const ageH = (Date.now() - Date.parse(marker.at)) / 3600000;
  const shrunk = [];
  for (const [col, n] of Object.entries(marker.counts || {})) {
    if (!(n > 0)) continue;
    // col là tên bảng thật (schema v2) —marker do chính server ghi, không phải input ngoài.
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${col}`);
    if ((rows[0]?.n ?? 0) < n) shrunk.push(`${col}:${n}->${rows[0]?.n}`);
  }

  const verdict = ageH < MAX_AGE_H && shrunk.length === 0 ? 'PASS' : 'FAIL';
  console.log(JSON.stringify({
    verdict,
    backup_at: marker.at,
    age_hours: Math.round(ageH * 10) / 10,
    s3_key: marker.key,
    bytes: marker.bytes,
    count_shrunk: shrunk,
  }));
  if (verdict === 'FAIL') process.exit(1);
} catch (e) {
  console.error('[backup-verify] Lỗi:', e?.message || e);
  process.exit(1);
} finally {
  await pool.end();
}

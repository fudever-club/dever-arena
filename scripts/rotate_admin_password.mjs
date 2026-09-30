/**
 * DEVER Arena — xoay mật khẩu admin PROD (an toàn, tự kiểm chứng).
 *  1. Login mật khẩu CŨ → token.
 *  2. Đổi mật khẩu qua POST /admin/users/:id/password.
 *  3. Login bằng mật khẩu CŨ → PHẢI 401 (nếu còn dùng được = thất bại, báo cáo và dừng).
 *  4. Login bằng mật khẩu MỚI → PHẢI 200.
 *  5. Ghi dever-admin-credentials.secret (gitignored).
 * Chạy: node scripts/rotate_admin_password.mjs "<mật-khẩu-mới>"
 * (mặc định mật khẩu cũ đọc từ env DEVER_ADMIN_PASS hoặc file .secret hiện có)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = (process.env.DEVER_API_BASE || 'https://api-elegant-horse.spcf.app').replace(/\/$/, '');
const ADMIN_USER = process.env.DEVER_ADMIN_USER || 'dever_admin';
const SECRET_FILE = join(ROOT, 'dever-admin-credentials.secret');

const newPass = process.argv[2];
if (!newPass || String(newPass).length < 12) {
  console.error('Dùng: node scripts/rotate_admin_password.mjs "<mật-khẩu-mới>" (≥ 12 ký tự)');
  process.exit(2);
}

function readOldPass() {
  if (process.env.DEVER_ADMIN_PASS) return process.env.DEVER_ADMIN_PASS;
  if (existsSync(SECRET_FILE)) {
    try {
      const c = JSON.parse(readFileSync(SECRET_FILE, 'utf8'));
      if (c.dever_admin?.password) return c.dever_admin.password;
    } catch {}
  }
  return null;
}

async function login(password) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const oldPass = readOldPass();
if (!oldPass) { console.error('[rotate] Không tìm thấy mật khẩu cũ (env DEVER_ADMIN_PASS hoặc file .secret).'); process.exit(2); }

const step1 = await login(oldPass);
if (step1.status !== 200) { console.error('[rotate] Login mật khẩu cũ thất bại — dừng, không đổi gì.'); process.exit(1); }
const userId = step1.json.user.id;
const token = step1.json.accessToken;
console.log('[rotate] 1. login mật khẩu cũ OK');

const chRes = await fetch(`${API}/api/v1/admin/users/${userId}/password`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ password: newPass }),
});
if (chRes.status !== 200) { console.error(`[rotate] Đổi mật khẩu thất bại: ${chRes.status}`); process.exit(1); }
console.log('[rotate] 2. đổi mật khẩu OK');

const oldStill = await login(oldPass);
if (oldStill.status === 200) {
  console.error('[rotate] NGHIÊM TRỌNG: mật khẩu cũ VẪN LOGIN ĐƯỢC sau khi đổi — kiểm tra ngay! (không ghi file mới)');
  process.exit(1);
}
console.log('[rotate] 3. mật khẩu cũ đã chết (401) ✓');

const newOk = await login(newPass);
if (newOk.status !== 200) { console.error('[rotate] Mật khẩu mới KHÔNG login được — khẩn cấp dùng mật khẩu cũ!'); process.exit(1); }
console.log('[rotate] 4. mật khẩu mới OK ✓');

writeFileSync(SECRET_FILE, JSON.stringify({
  dever_admin: { username: ADMIN_USER, password: newPass, rotated_at: new Date().toISOString() },
}, null, 2));
console.log(`[rotate] 5. đã ghi ${SECRET_FILE} (gitignored)`);
console.log('[rotate] XOAY THÀNH CÔNG — cập nhật mật khẩu mới cho các script/drill/tooling.');

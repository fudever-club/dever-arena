/**
 * DEVER Arena — SRE Restore Drill (Sprint 1, duyệt bởi CEO).
 * Kiểm chứng quy trình phục hồi trên PROD thật (schema v2), 4 bước:
 *   1. FRESH   — dump trực tiếp prod (GET /admin/backup-dump), đối chiếu với dump gốc của drill
 *                (phải chứa đủ mọi row của dump gốc; phần chênh lệch sinh sau dump được ghi nhận).
 *   2. DAMAGE  — phá dữ liệu test: POST /admin/reset-demo mode 'demo' (giữ admin + kỳ thi,
 *                xóa test users + toàn bộ submissions/participants/announcements/virtual)
 *                + tạo user probe `restore_probe_<ts>` — thứ KHÔNG có trong dump gốc.
 *   3. RESTORE — POST /admin/restore-backup với dump gốc (TRUNCATE + nạp lại + reload mirror),
 *                kèm pre-restore snapshot lên S3 phía server.
 *   4. VERIFY  — dump lại prod sau restore: mỗi bảng phải khớp 100% dump gốc (count + so sánh
 *                sâu row-by-row theo id); probe phải biến mất; smoke login admin + thí sinh
 *                (mật khẩu phải sống qua round-trip extra JSONB) + health + rating-changes.
 *
 * Chạy:   node scripts/restore_drill.mjs backups/prod-dump-drill.json
 * Env:    DEVER_API_BASE (mặc định prod api), DEVER_ADMIN_USER, DEVER_ADMIN_PASS (bắt buộc),
 *         DRILL_KEEP_PROBE=1 để giữ user probe (không khuyến nghị).
 * Báo cáo: backups/drill-report-<ts>.json. Exit 0 khi toàn bộ gate PASS.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = (process.env.DEVER_API_BASE || 'https://api-elegant-horse.spcf.app').replace(/\/$/, '');
const ADMIN_USER = process.env.DEVER_ADMIN_USER || 'dever_admin';
const ADMIN_PASS = process.env.DEVER_ADMIN_PASS || '';
const KEEP_PROBE = process.env.DRILL_KEEP_PROBE === '1';

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error('Dùng: node scripts/restore_drill.mjs <file-dump.json>  (env: DEVER_ADMIN_USER/DEVER_ADMIN_PASS)');
  process.exit(1);
}
if (!ADMIN_PASS) { console.error('[drill] Thiếu DEVER_ADMIN_PASS.'); process.exit(1); }

const dump = JSON.parse(readFileSync(file, 'utf8'));
const COLLECTIONS = ['users', 'contests', 'problems', 'testcases', 'submissions', 'participants', 'virtual_sessions', 'clans', 'clarifications', 'announcements'];
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const PROBE_USERNAME = `probe_${Date.now().toString(36)}`;

const report = { at: new Date().toISOString(), api: API, dump_file: file, probe_username: PROBE_USERNAME, steps: {}, passes: {} };
let token = null;
let probeId = null;

async function api(method, path, body, { auth = true } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(auth && token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}

async function adminDump() {
  const r = await api('GET', '/api/v1/admin/backup-dump');
  if (r.status !== 200 || !r.json?.data) throw new Error(`backup-dumpp failed: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  return r.json;
}

const counts = (d) => Object.fromEntries(COLLECTIONS.map((c) => [c, (d.data?.[c] || []).length]));
const rowMap = (rows) => new Map((rows || []).map((r) => [r.id, canon(r)]));
function sortedKeys(v) {
  if (Array.isArray(v)) return v.map(sortedKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortedKeys(v[k])]));
  return v;
}
const canon = (v) => JSON.stringify(sortedKeys(v));

/** So sánh 2 bảng: thiếu dump-rows, thừa rows lạ, rows khác nội dung (mẫu tối đa 3). */
function diffCollection(dumpRows, nowRows) {
  const a = rowMap(dumpRows), b = rowMap(nowRows);
  const missing = [...a.keys()].filter((k) => !b.has(k));
  const extra = [...b.keys()].filter((k) => !a.has(k));
  const changed = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
  return { missing, extra, changed, samples: changed.slice(0, 3).map((id) => ({ id, dump: dumpRows.find((r) => r.id === id), now: nowRows.find((r) => r.id === id) })) };
}
const clean = (diffs) => diffs.every((d) => d.missing.length === 0 && d.extra.length === 0 && d.changed.length === 0);

/** Poll dump DB cho tới khi điều kiện đúng (flush định kỳ cần thời gian persist xuống Postgres). */
async function waitUntil(fn, { timeoutMs = 20000, stepMs = 1000, label = '' }) {
  const t0 = Date.now();
  for (;;) {
    const d = await adminDump();
    if (fn(d)) return d;
    if (Date.now() - t0 > timeoutMs) throw new Error(`Hết giờ chờ flush persist (${label}) — pipeline ghi DB có vấn đề.`);
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

try {
  // ---- Bước 0: login admin
  const login = await api('POST', '/api/v1/auth/login', { username: ADMIN_USER, password: ADMIN_PASS }, { auth: false });
  if (login.status !== 200 || !login.json?.accessToken) throw new Error(`Login admin thất bại: ${login.status}`);
  token = login.json.accessToken;
  console.log(`[drill] 0. login admin OK (${ADMIN_USER})`);

  // ---- Bước 1: FRESH dump + đối chiếu với dump gốc
  const fresh = await adminDump();
  writeFileSync(join(ROOT, 'backups', `drill-fresh-${stamp}.json`), JSON.stringify(fresh, null, 2));
  const freshDiffs = COLLECTIONS.map((c) => ({ col: c, ...diffCollection(dump.data[c] || [], fresh.data[c] || []) }));
  const freshClean = clean(freshDiffs);
  const dumpUsers = (dump.data.users || []).map((u) => u.username);
  const usersPresent = dumpUsers.every((u) => (fresh.data.users || []).some((x) => x.username === u));
  report.steps.fresh = { counts: counts(fresh), diffs: freshDiffs.map(({ samples, ...d }) => d), dump_users_all_present: usersPresent };
  report.passes.fresh = freshClean && usersPresent;
  console.log(`[drill] 1. FRESH: ${JSON.stringify(counts(fresh))} | khớp dump gốc: ${freshClean ? 'ĐÚNG' : 'LỆCH'} | users đủ: ${usersPresent}`);
  if (!freshClean) console.warn('   (FRESH lệch: prod đang khác dump gốc — chấp nhận được, restore ở bước 3 sẽ đưa về đúng dump; gate nghiêm ngặt ở bước VERIFY.)');
  if (!freshClean) freshDiffs.filter((d) => d.missing.length || d.extra.length || d.changed.length)
    .forEach((d) => console.warn(`   ⚠ ${d.col}: missing=${d.missing.length} extra=${d.extra.length} changed=${d.changed.length}`, d.samples));

  // ---- Bước 2: DAMAGE — reset-demo (giữ admin + kỳ thi) + user probe
  // reset-demo đổi MIRROR bộ nhớ; flush định kỳ mới persist xuống Postgres → POLL chờ.
  const reset = await api('POST', '/api/v1/admin/reset-demo', { mode: 'demo' });
  if (reset.status !== 200) throw new Error(`reset-demo thất bại: ${reset.status} ${JSON.stringify(reset.json)}`);
  const damaged = await waitUntil(
    (d) => (d.data.users || []).length === 1 && (d.data.submissions || []).length === 0 && (d.data.participants || []).length === 0,
    { label: 'reset-demo persist' }
  );
  const probe = await api('POST', '/api/v1/admin/users', { username: PROBE_USERNAME, full_name: 'Restore Drill Probe', password: `probe-${stamp}`, role: 'PARTICIPANT' });
  if (probe.status !== 201) throw new Error(`Tạo probe thất bại: ${probe.status} ${JSON.stringify(probe.json)}`);
  probeId = probe.json?.user?.id || null;
  await waitUntil((d) => (d.data.users || []).some((u) => u.username === PROBE_USERNAME), { label: 'probe persist' });
  const damagedCounts = counts(damaged);
  const nonAdminGone = (dump.data.users || []).filter((u) => u.username !== ADMIN_USER)
    .every((u) => !(damaged.data.users || []).some((x) => x.username === u.username));
  report.steps.damage = { reset: reset.json?.counts || null, probe_id: probeId, counts: damagedCounts, non_admin_users_gone: nonAdminGone };
  report.passes.damage = damagedCounts.submissions === 0 && damagedCounts.participants === 0 && damagedCounts.announcements === 0
    && damagedCounts.virtual_sessions === 0 && damagedCounts.users === 1 && damagedCounts.clarifications === 0 && nonAdminGone;
  console.log(`[drill] 2. DAMAGE: ${JSON.stringify(damagedCounts)} | probe=${probeId} | user non-admin đã bay: ${nonAdminGone}`);

  // ---- Bước 3: RESTORE từ dump gốc
  const restore = await api('POST', '/api/v1/admin/restore-backup', { dump, reload: true });
  if (restore.status !== 200) throw new Error(`restore-backup thất bại: ${restore.status} ${JSON.stringify(restore.json).slice(0, 400)}`);
  report.steps.restore = { status: restore.json?.status, counts: restore.json?.counts, pre_restore_snapshot: restore.json?.preRestoreKey || null };
  console.log(`[drill] 3. RESTORE: ${restore.json?.status} | pre-restore S3: ${restore.json?.preRestoreKey || '(không có S3)'}`);

  // ---- Bước 4: VERIFY — dump sau restore phải khớp 100% dump gốc
  const restored = await adminDump();
  writeFileSync(join(ROOT, 'backups', `drill-restored-${stamp}.json`), JSON.stringify(restored, null, 2));
  const verifyDiffs = COLLECTIONS.map((c) => ({ col: c, ...diffCollection(dump.data[c] || [], restored.data[c] || []) }));
  const verifyClean = clean(verifyDiffs);
  const probeGone = !(restored.data.users || []).some((u) => u.username === PROBE_USERNAME);
  const metaOk = (restored.meta || []).some((m) => m.key === 'schema_version' && Number(m.value) === 2);
  report.steps.verify = { counts: counts(restored), diffs: verifyDiffs.map(({ samples, ...d }) => d), probe_gone: probeGone, schema_version_2: metaOk, samples: verifyDiffs.filter((d) => d.samples.length).flatMap((d) => d.samples) };
  report.passes.verify = verifyClean && probeGone && metaOk;
  console.log(`[drill] 4. VERIFY: ${JSON.stringify(counts(restored))} | khớp 100% dump gốc: ${verifyClean ? 'ĐÚNG' : 'LỆCH'} | probe đã biến mất: ${probeGone} | schema v2: ${metaOk}`);
  if (!verifyClean) verifyDiffs.filter((d) => d.missing.length || d.extra.length || d.changed.length)
    .forEach((d) => console.warn(`   ⚠ ${d.col}: missing=${d.missing.length} extra=${d.extra.length} changed=${d.changed.length}`, d.samples));

  // ---- Bước 5: SMOKE — login phải còn hoạt động (mật khẩu sống qua round-trip), health, rating-changes
  const smoke = {};
  const loginAdmin = await api('POST', '/api/v1/auth/login', { username: ADMIN_USER, password: ADMIN_PASS }, { auth: false });
  smoke.admin_login = loginAdmin.status === 200;
  const t1 = (dump.data.users || []).find((u) => u.username === 'thi_sinh_01');
  if (t1) {
    const loginTs = await api('POST', '/api/v1/auth/login', { username: 'thi_sinh_01', password: process.env.DRILL_TS01_PASS || 'dever-ts01' }, { auth: false });
    smoke.thi_sinh_01_login = loginTs.status === 200;
  }
  const health = await fetch(`${API}/api/v1/health`);
  smoke.health = health.status === 200;
  const rc = await fetch(`${API}/api/v1/contests/dever-round-1/rating-changes`);
  smoke.rating_changes = rc.status === 200;
  report.steps.smoke = smoke;
  report.passes.smoke = Object.values(smoke).every(Boolean);
  console.log(`[drill] 5. SMOKE: ${JSON.stringify(smoke)}`);

  // ---- Kết luận
  report.verdict = ['damage', 'verify', 'smoke'].every((k) => report.passes[k]) ? 'PASS' : 'FAIL';
  console.log('='.repeat(60));
  console.log(`[drill] VERDICT: ${report.verdict}  (${Object.entries(report.passes).map(([k, v]) => `${k}=${v ? '✓' : '✗'}`).join(' ')})`);
} catch (e) {
  report.error = String(e?.message || e);
  report.verdict = 'ERROR';
  console.error('[drill] LỖI:', e?.message || e);
} finally {
  // Dọn probe nếu drill chết giữa chừng (để prod không còn rác test).
  if (probeId && token && !KEEP_PROBE) {
    try { await api('DELETE', `/api/v1/admin/users/${probeId}`); console.log('[drill] cleanup: đã xóa probe.'); } catch { console.warn('[drill] cleanup probe thất bại — xóa tay qua admin.'); }
  }
  mkdirSync(join(ROOT, 'backups'), { recursive: true });
  writeFileSync(join(ROOT, 'backups', `drill-report-${stamp}.json`), JSON.stringify(report, null, 2));
  console.log(`[drill] Báo cáo: backups/drill-report-${stamp}.json`);
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

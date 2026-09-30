/**
 * DEVER Arena — A6 (Sprint 1b): probe monitor prod, chạy mỗi phút qua Specific cron.
 * Cảnh báo khi persist DB có vấn đề (bài học Vòng 36.5: flush thất bại không được âm thầm).
 *
 * Kiểm tra (đều HTTP đọc-only, không cần DB env):
 *   1. API  GET /api/health → 200 + flush.ok + !flush.stale
 *   2. API  GET /api/ready  → 200 (503 = degraded: DB_FLUSH_STALE)
 *   3. WEB  GET /           → 200
 * Kết quả: 1 dòng JSON (grep/log được) + exit 0 = khỏe, 1 = có vấn đề, 2 = cấu hình sai.
 *
 * Env: DEVER_API_BASE (mặc định prod api), DEVER_WEB_BASE (mặc định prod web),
 *      DEVER_PROBE_TIMEOUT_MS (mặc định 8000).
 */
const API = (process.env.DEVER_API_BASE || 'https://api-elegant-horse.spcf.app').replace(/\/$/, '');
const WEB = (process.env.DEVER_WEB_BASE || 'https://web-elegant-horse.spcf.app').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.DEVER_PROBE_TIMEOUT_MS || 8000);

async function get(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    let json = null;
    try { json = await res.json(); } catch { /* html/binary */ }
    return { status: res.status, json };
  } catch (e) {
    return { status: 0, error: String(e?.cause?.code || e?.message || e) };
  }
}

const health = await get(`${API}/api/health`);
const ready = await get(`${API}/api/ready`);
const web = await get(`${WEB}/`);

const checks = {
  api_health: health.status === 200,
  api_ready: ready.status === 200,
  web_home: web.status === 200,
  flush_ok: health.json?.flush ? health.json.flush.ok === true && health.json.flush.stale === false : null, // null = chưa có khối flush (api cũ)
};

const problems = [];
if (!checks.api_health) problems.push(`api_health:${health.status || health.error}`);
if (!checks.api_ready) problems.push(`api_ready:${ready.status || ready.error}${ready.json?.reason ? `(${ready.json.reason})` : ''}`);
if (!checks.web_home) problems.push(`web_home:${web.status || web.error}`);
if (checks.flush_ok === false) problems.push(`flush_degraded:${health.json?.flush?.last_error || 'stale'}`);
if (checks.flush_ok === null) problems.push('flush_missing:api chưa expose khối flush — cần deploy Vòng 36.5');

const result = {
  ts: new Date().toISOString(),
  verdict: problems.length === 0 ? 'OK' : 'ALERT',
  checks,
  ready_users: ready.json?.users ?? null,
  problems,
};

console.log(JSON.stringify(result));
process.exit(problems.length === 0 ? 0 : 1);

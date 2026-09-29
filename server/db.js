/**
 * DEVER Arena — JSON file store (local dev backend).
 * Zero dependency. Persist vào server/data/db.json, seed từ PROBLEMS_DB khi khởi tạo.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'data');

export function openDatabase(dbPath = join(ROOT, 'db.json')) {
  mkdirSync(dirname(dbPath), { recursive: true });
  let data = null;
  if (existsSync(dbPath)) {
    try {
      data = JSON.parse(readFileSync(dbPath, 'utf8'));
    } catch { data = null; }
  }
  if (!data || typeof data !== 'object') {
    data = null;
  }
  const DEFAULTS = { users: [], contests: [], problems: [], testcases: [], submissions: [], participants: [], virtual_sessions: [], clans: [], clarifications: [], announcements: [], seq: 1 };
  data = { ...DEFAULTS, ...(data || {}) };
  for (const k of Object.keys(DEFAULTS)) {
    if (!Array.isArray(data[k]) && k !== 'seq') data[k] = [];
  }
  if (typeof data.seq !== 'number') data.seq = 1;

  // ---- Flush health (đồng bộ shape với server/pg.js — bài học restore-drill 29/9/2026) ----
  const flushHealth = {
    ok: true, lastAttemptAt: null, lastSuccessAt: null, lastFailureAt: null,
    lastError: null, consecutiveFailures: 0, pendingWrites: false,
  };
  const save = () => {
    flushHealth.lastAttemptAt = new Date().toISOString();
    try {
      writeFileSync(dbPath, JSON.stringify(data, null, 2));
      const recovered = !flushHealth.ok;
      flushHealth.ok = true;
      flushHealth.lastSuccessAt = flushHealth.lastAttemptAt;
      flushHealth.lastError = null;
      flushHealth.consecutiveFailures = 0;
      flushHealth.pendingWrites = false;
      if (recovered) console.log(JSON.stringify({ ts: flushHealth.lastSuccessAt, level: 'INFO', event: 'db_flush_recovered', mode: 'json' }));
    } catch (e) {
      flushHealth.ok = false;
      flushHealth.lastFailureAt = flushHealth.lastAttemptAt;
      flushHealth.lastError = String(e?.message || e);
      flushHealth.consecutiveFailures += 1;
      flushHealth.pendingWrites = true;
      console.error(JSON.stringify({ ts: flushHealth.lastFailureAt, level: 'ERROR', event: 'db_flush_failed', attempt: flushHealth.consecutiveFailures, mode: 'json', error: flushHealth.lastError, pending_writes: true }));
      throw e; // giữ hành vi cũ: route gọi save() thấy lỗi
    }
  };
  const flushStatus = () => {
    const ageS = flushHealth.lastSuccessAt
      ? Math.round((Date.now() - Date.parse(flushHealth.lastSuccessAt)) / 1000)
      : null;
    return { ...flushHealth, age_since_success_s: ageS, stale: flushHealth.pendingWrites && (ageS === null || ageS > 60) };
  };

  const nextId = (prefix) => `${prefix}_${data.seq++}_${Date.now().toString(36)}`;

  return {
    data,
    save,
    nextId,
    find: (col, pred) => data[col].find(pred),
    filter: (col, pred) => data[col].filter(pred),
    insert: (col, row) => { data[col].push(row); save(); return row; },
    update: (col, pred, patch) => {
      const row = data[col].find(pred);
      if (row) { Object.assign(row, patch); save(); }
      return row || null;
    },
    flushStatus,
  };
}

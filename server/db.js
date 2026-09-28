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
  const save = () => writeFileSync(dbPath, JSON.stringify(data, null, 2));

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
  };
}

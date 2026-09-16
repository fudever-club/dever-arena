/**
 * DEVER Arena — Browser Database (IndexedDB + localStorage fallback)
 * Production: PostgreSQL (db/schema.sql). Dev/preview: IndexedDB wrapper này.
 * API thống nhất để js/app.js không còn hardcode state.
 */

const DB_NAME = 'dever_arena';
const DB_VERSION = 4;
const STORES = ['users','contests','problems','testcases','submissions','hack_events','discussions','clans','contest_participants','analytics','virtual_sessions'];

// helper: promisify IDB
function openDB() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          // contest_participants technically has composite PK (contest_id, user_id) in PG,
          // but for IndexedDB mock we use single keyPath 'id' with composite string value.
          db.createObjectStore(s, { keyPath: 'id' });
        }
      }
      // indexes
      try {
        const ps = req.transaction.objectStore('problems');
        if (!ps.indexNames.contains('contest_id')) ps.createIndex('contest_id', 'contest_id', { unique: false });
      } catch {}
      try {
        const tc = req.transaction.objectStore('testcases');
        if (!tc.indexNames.contains('problem_id')) tc.createIndex('problem_id', 'problem_id', { unique: false });
      } catch {}
      try {
        const ss = req.transaction.objectStore('submissions');
        if (!ss.indexNames.contains('contest_id')) ss.createIndex('contest_id', 'contest_id', { unique: false });
      } catch {}
      try {
        const hs = req.transaction.objectStore('hack_events');
        if (!hs.indexNames.contains('contest_id')) hs.createIndex('contest_id', 'contest_id', { unique: false });
      } catch {}
      try {
        const cp = req.transaction.objectStore('contest_participants');
        if (!cp.indexNames.contains('contest_id')) cp.createIndex('contest_id', 'contest_id', { unique: false });
      } catch {}
      try {
        const vs = req.transaction.objectStore('virtual_sessions');
        if (!vs.indexNames.contains('contest_id')) vs.createIndex('contest_id', 'contest_id', { unique: false });
        if (!vs.indexNames.contains('user_id')) vs.createIndex('user_id', 'user_id', { unique: false });
      } catch {}
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// localStorage fallback store (Map per table) + in-memory for Node tests
const LS_PREFIX = 'dever_arena:';
const _mem = new Map(); // table -> Map(id->obj)
function memStore(table) {
  if (!_mem.has(table)) _mem.set(table, new Map());
  const m = _mem.get(table);
  return {
    async getAll() { return Array.from(m.values()); },
    async put(obj) { m.set(obj.id, obj); return obj; },
    async get(id) { return m.get(id) || null; },
    async delete(id) { m.delete(id); },
    async clear() { m.clear(); },
    async query(fn) { return Array.from(m.values()).filter(fn); }
  };
}
function lsStore(table) {
  // Node: no window/localStorage → use mem
  if (typeof localStorage === 'undefined' || typeof window === 'undefined') return memStore(table);
  const key = LS_PREFIX + table;
  return {
    async getAll() {
      try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return Array.from(_mem.get(table)?.values() || []); }
    },
    async put(obj) {
      try {
        const all = await this.getAll();
        const idx = all.findIndex(x => x.id === obj.id);
        if (idx >= 0) all[idx] = obj; else all.push(obj);
        localStorage.setItem(key, JSON.stringify(all));
        return obj;
      } catch { const s = memStore(table); return s.put(obj); }
    },
    async get(id) { const all = await this.getAll(); return all.find(x => x.id === id) || null; },
    async delete(id) {
      try {
        const all = await this.getAll();
        const next = all.filter(x => x.id !== id);
        localStorage.setItem(key, JSON.stringify(next));
      } catch { const s = memStore(table); return s.delete(id); }
    },
    async clear() { try { localStorage.removeItem(key); } catch {} const s = memStore(table); return s.clear(); },
    async query(fn) { const all = await this.getAll(); return all.filter(fn); }
  };
}

async function idbStore(table, mode = 'readonly') {
  const db = await openDB();
  if (!db) return lsStore(table);
  return {
    _db: db, _table: table, _mode: mode,
    async getAll() {
      return new Promise((res, rej) => {
        const tx = db.transaction(table, 'readonly');
        const req = tx.objectStore(table).getAll();
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    },
    async get(id) {
      return new Promise((res, rej) => {
        const tx = db.transaction(table, 'readonly');
        const req = tx.objectStore(table).get(id);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => rej(req.error);
      });
    },
    async put(obj) {
      return new Promise((res, rej) => {
        const tx = db.transaction(table, 'readwrite');
        tx.objectStore(table).put(obj);
        tx.oncomplete = () => res(obj);
        tx.onerror = () => rej(tx.error);
      });
    },
    async delete(id) {
      return new Promise((res, rej) => {
        const tx = db.transaction(table, 'readwrite');
        tx.objectStore(table).delete(id);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
    async clear() {
      return new Promise((res, rej) => {
        const tx = db.transaction(table, 'readwrite');
        tx.objectStore(table).clear();
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
    async query(fn) {
      const all = await this.getAll();
      return all.filter(fn);
    }
  };
}

// Public API
export const db = {
  async getAll(table) { const s = await idbStore(table); return s.getAll(); },
  async get(table, id) { const s = await idbStore(table); return s.get(id); },
  async put(table, obj) {
    if (!obj.id) obj.id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
    const s = await idbStore(table);
    return s.put(obj);
  },
  async delete(table, id) { const s = await idbStore(table); return s.delete(id); },
  async clear(table) { const s = await idbStore(table); return s.clear(); },
  async query(table, fn) { const s = await idbStore(table); return s.query(fn); },
  // convenience
  async upsert(table, obj) { return this.put(table, obj); },
  async count(table) { const all = await this.getAll(table); return all.length; }
};

// Migration check
export async function ensureSeeded(seedFn) {
  const c = await db.count('contests');
  if (c === 0 && typeof seedFn === 'function') {
    await seedFn(db);
    return true;
  }
  return false;
}

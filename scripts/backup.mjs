/**
 * DEVER Arena — backup DB JSON (+ Postgres dump nếu có DEVER_DATABASE_URL).
 * Chạy: npm run backup  (tạo backups/db-YYYYMMDD-HHmmss.json)
 * Postgres schema v2: dump 10 bảng ra JSON (cùng định dạng với backup_cron — restore được qua
 * POST /admin/restore-backup); schema v1 (KV): vẫn pg_dump binary.
 */
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.env.DEVER_DB_PATH || join(ROOT, 'server', 'data', 'db.json');
const dir = join(ROOT, 'backups');
mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dest = join(dir, `db-${stamp}.json`);
if (!existsSync(src)) {
  console.error(`[backup] không thấy DB nguồn: ${src}`);
  process.exit(1);
}
copyFileSync(src, dest);
console.log(`[backup] JSON -> ${dest}`);

const pgUrl = process.env.DEVER_DATABASE_URL || '';
if (pgUrl) {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: pgUrl });
  try {
    const { rows } = await pool.query(`SELECT value FROM dever_meta WHERE key = 'schema_version'`);
    const ver = Number(rows?.[0]?.value) || 1;
    if (ver >= 2) {
      const { readTablesDump } = await import('../server/pg_migrate.js');
      const { data, meta } = await readTablesDump(pool);
      const out = join(dir, `pg-tables-${stamp}.json`);
      writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), schema_mode: 'tables', meta, data }, null, 2));
      console.log(`[backup] Postgres (tables v2) -> ${out}`);
    } else {
      const out = join(dir, `pg-${stamp}.dump`);
      execSync(`pg_dump --format=custom --file="${out}" "${pgUrl}"`, { stdio: 'inherit' });
      console.log(`[backup] Postgres (KV v1) -> ${out}`);
    }
  } catch (e) {
    console.warn('[backup] Postgres dump thất bại (bỏ qua, JSON vẫn giữ):', e.message);
  } finally {
    await pool.end();
  }
} else {
  console.log('[backup] (bỏ qua pg_dump: chưa đặt DEVER_DATABASE_URL)');
}

/**
 * DEVER Arena — Task 110: OpenAPI machine-readable.
 * 1) docs/openapi.json sinh từ route table — mọi route thật phải xuất hiện, auth map đúng.
 * 2) GET /api/v1/openapi.json trả spec.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

process.env.SCHEDULER_DISABLED = '1';
const DB_PATH = join(tmpdir(), `dever-test-110-${process.pid}.json`);
process.env.DEVER_DB_PATH = DB_PATH;
try { rmSync(DB_PATH, { force: true }); } catch {}

// Sinh spec tươi từ source hiện tại trước khi import server
execFileSync(process.execPath, ['scripts/gen_openapi.mjs'], { stdio: 'pipe' });

const { startServer } = await import('../server/index.js');
const { shutdownJudge } = await import('../server/queue.js');

let server;
let base;

before(async () => {
  server = startServer(0);
  await new Promise((r) => setTimeout(r, 300));
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  shutdownJudge();
  try { rmSync(DB_PATH, { force: true }); } catch {}
});

test('Task 110: openapi.json hợp lệ 3.1 + mọi route thật xuất hiện', () => {
  const spec = JSON.parse(readFileSync('docs/openapi.json', 'utf8'));
  assert.equal(spec.openapi, '3.1.0');
  assert.ok(Object.keys(spec.paths).length >= 30, `có ${Object.keys(spec.paths).length} paths`);

  const src = readFileSync('server/index.js', 'utf8');
  const re = /route\(\s*'([A-Z]+)'\s*,\s*'([^']+)'/g;
  let m;
  let checked = 0;
  const seen = new Set();
  while ((m = re.exec(src)) !== null) {
    const method = m[1].toLowerCase();
    const path = m[2].replace(/^\^/, '').replace(/\$$/, '').replace(/\(\[\^\/\]\+\)/g, '{p}').replace(/\\([/._-])/g, '$1').replace(/\(\?:v1\/\)\?/g, 'v1/').replace(/[^a-zA-Z0-9/{}_.-]/g, '');
    const key = `${method} ${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Tìm path tương ứng trong spec (thay {p} bằng bất kỳ param nào)
    const specPath = Object.keys(spec.paths).find((p) => p.replace(/\{param\d+\}/g, '{p}') === path.replace(/\{param\d+\}/g, '{p}'));
    assert.ok(specPath, `route ${key} phải có trong openapi.json`);
    assert.ok(spec.paths[specPath][method], `${key} phải có method ${method}`);
    checked += 1;
  }
  assert.ok(checked >= 35, `đã đối chiếu ${checked} routes`);
});

test('Task 110: auth map đúng — admin/phase cần bearer, login/health public', () => {
  const spec = JSON.parse(readFileSync('docs/openapi.json', 'utf8'));
  assert.ok(spec.paths['/api/v1/admin/phase'].post.security, 'admin/phase cần bearerAuth');
  assert.equal(spec.paths['/api/v1/auth/login'].post.security, undefined, 'login public');
  assert.equal(spec.paths['/api/v1/health'].get.security, undefined, 'health public');
  assert.equal(spec.components.securitySchemes.bearerAuth.type, 'http');
});

test('Task 110: GET /api/v1/openapi.json trả spec', async () => {
  const res = await fetch(`${base}/api/v1/openapi.json`);
  assert.equal(res.status, 200);
  const spec = await res.json();
  assert.equal(spec.info.title, 'DEVER Arena API');
  assert.ok(spec.paths['/api/v1/compare']);
});

#!/usr/bin/env node
/**
 * DEVER Arena — Task 110: sinh docs/openapi.json (OpenAPI 3.1) từ bảng route() của server/index.js.
 * Zero dependency: đọc source, regex signature `route('METHOD', '^/api/...$', ...)`,
 * suy path + params từ regex group, auth từ opts `{ auth: true }` / `{ admin: true }`.
 * Chạy: npm run gen:openapi
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'server', 'index.js');
const OUT = join(HERE, '..', 'docs', 'openapi.json');

const source = readFileSync(SRC, 'utf8');

// Bắt toàn bộ lệnh route(...) — đủ 3 đối số, kể cả handler nhiều dòng và opts phía sau.
const routeRe = /route\(\s*'([A-Z]+)'\s*,\s*'([^']+)'\s*,/g;

/** Regex pattern → OpenAPI path template + tham số. Ví dụ ^/api/v1/users/([^/]+)/profile$ → /api/v1/users/{param1}/profile */
function toPath(pattern) {
  const body = pattern.replace(/^\^/, '').replace(/\$$/, '');
  let n = 0;
  const path = body
    .replace(/\(\?\:v1\/\)\?/g, 'v1/') // (?:v1/)? → v1/ (nhóm optional của health/ready)
    .replace(/\(\[\^\/\]\+\)/g, () => `{param${++n}}`)
    .replace(/\\([/._-])/g, '$1')
    .replace(/[^a-zA-Z0-9/{}_.-]/g, '');
  const params = [];
  for (let i = 1; i <= n; i++) params.push(`param${i}`);
  return { path, params };
}

const secSchemes = {};
const paths = {};
// Chỉ số bắt đầu của từng route để khoanh vùng slice đúng (không lụm opts của route kế tiếp).
const starts = [];
let m0;
while ((m0 = routeRe.exec(source)) !== null) starts.push(m0.index);
routeRe.lastIndex = 0;
let m;
let i = 0;
while ((m = routeRe.exec(source)) !== null) {
  const method = m[1].toLowerCase();
  const { path, params } = toPath(m[2]);
  if (!paths[path]) paths[path] = {};
  // opts nằm cuối route: khớp `, { auth: true, admin: true });` cuối cùng trong slice của CHÍNH route này.
  const sliceEnd = i + 1 < starts.length ? starts[i + 1] : source.length;
  const slice = source.slice(m.index, sliceEnd);
  const optMatches = [...slice.matchAll(/,\s*\{\s*(?:auth|admin)[^{}]*\}\s*\);/g)];
  const opts = optMatches.length ? optMatches[optMatches.length - 1][0] : '';
  const needAuth = /auth:\s*true/.test(opts);
  const needAdmin = /admin:\s*true/.test(opts);
  i += 1;

  const op = {
    summary: `${method.toUpperCase()} ${path}`,
    tags: [path.startsWith('/api/v1/admin') ? 'admin' : 'public'],
    responses: {
      '200': { description: 'Thành công' },
      '401': { description: 'Thiếu/sai token (nếu route yêu cầu auth)' },
    },
  };
  if (params.length) {
    op.parameters = params.map((name) => ({ name, in: 'path', required: true, schema: { type: 'string' } }));
  }
  if (needAuth || needAdmin) {
    op.security = [{ bearerAuth: [] }];
    secSchemes.bearerAuth = {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Đăng nhập POST /api/v1/auth/login lấy accessToken.',
    };
  }
  if (needAdmin) op.description = 'Yêu cầu quyền ADMIN.';
  if (['post', 'put'].includes(method)) {
    op.requestBody = {
      required: false,
      content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
    };
  }
  paths[path][method] = op;
}

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'DEVER Arena API',
    version: '1.0.0',
    description: 'REST API nền tảng thi đấu thuật toán CLB FU-DEVER. Sinh tự động từ server/index.js bằng `npm run gen:openapi`.',
  },
  servers: [{ url: 'http://localhost:8787', description: 'Local dev' }],
  components: { securitySchemes: secSchemes },
  paths,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(spec, null, 2) + '\n');
const opCount = Object.values(paths).reduce((s, o) => s + Object.keys(o).length, 0);
console.log(`[gen:openapi] ${opCount} operations / ${Object.keys(paths).length} paths → docs/openapi.json`);

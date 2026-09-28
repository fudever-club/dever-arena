/**
 * DEVER Arena — Object store cho source_code thí sinh (Task 118).
 * Viết S3 SigV4 client thuần Node (crypto) — zero dependency ngoài core (ADR-003).
 *
 * Bật khi có đủ 4 env (Specific cấp qua block `storage "sources" {}`):
 *   S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
 * Không đủ env → object store = null, mọi caller tự fallback KV/JSON như cũ.
 *
 * API:
 *   putObject(key, body)  → 'ok' | null (null = chưa cấu hình / lỗi tạm)
 *   getObject(key)        → string | null
 */

import { createHash, createHmac } from 'node:crypto';

const ENDPOINT = process.env.S3_ENDPOINT || '';
const ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const SECRET_KEY = process.env.S3_SECRET_KEY || '';
const BUCKET = process.env.S3_BUCKET || '';

export const objectStoreEnabled = Boolean(ENDPOINT && ACCESS_KEY && SECRET_KEY && BUCKET);

// Chỉ kích hoạt khi chạy thật trong Specific (NODE_ENV=production) — local/test luôn fallback KV.
export const objectStoreActive = objectStoreEnabled && process.env.NODE_ENV === 'production';

console.log(`[objectStore] enabled=${objectStoreEnabled} active=${objectStoreActive} endpoint=${ENDPOINT ? 'set' : 'MISSING'} key=${ACCESS_KEY ? 'set' : 'MISSING'} secret=${SECRET_KEY ? 'set' : 'MISSING'} bucket=${BUCKET || 'MISSING'}`);

// ---- SigV4 helpers ----
const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

function amzDate(d = new Date()) {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amz: iso, short: iso.slice(0, 8) };
}

function uriEncode(str, encodeSlash = true) {
  let out = '';
  for (const ch of String(str)) {
    if (/[A-Za-z0-9\-._~]/.test(ch)) out += ch;
    else if (ch === '/') out += encodeSlash ? '%2F' : '/';
    else out += [...Buffer.from(ch, 'utf8')].map((b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join('');
  }
  return out;
}

/** PUT object (body: string). Trả 'ok' hoặc null khi lỗi (caller fallback). */
export async function putObject(key, body) {
  if (!objectStoreActive) return null;
  try {
    const res = await s3Request('PUT', key, Buffer.from(body, 'utf8'), { 'content-type': 'text/plain; charset=utf-8' });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.warn(`[objectStore] PUT ${key} -> ${res.status}: ${errBody.slice(0, 800)}`);
      return null;
    }
    return 'ok';
  } catch (e) {
    console.warn(`[objectStore] PUT ${key} lỗi: ${e?.message}`);
    return null;
  }
}

/** GET object. Trả string hoặc null khi chưa cấu hình/không có/lỗi. */
export async function getObject(key) {
  if (!objectStoreActive) return null;
  try {
    const res = await s3Request('GET', key);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function s3Request(method, key, body = null, extraHeaders = {}) {
  // S3 chuẩn: encode từng segment, giữ nguyên "/" (cả trên URL lẫn canonical path) — %2F làm lệch chữ ký.
  const url = new URL(`${ENDPOINT.replace(/\/$/, '')}/${BUCKET}/${uriEncode(key, false)}`);
  const { amz, short } = amzDate();
  const payloadHash = sha256Hex(body || '');
  const host = url.host;

  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amz,
    ...extraHeaders,
  };

  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((h) => `${h}:${String(headers[h]).trim()}\n`).join('');
  const signedHeaders = sortedKeys.join(';');
  const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${short}/us-east-1/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amz, scope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${SECRET_KEY}`, short);
  const kRegion = hmac(kDate, 'us-east-1');
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, { method, headers, body: body && method !== 'GET' ? body : undefined });
  return res;
}

export const _test = { amzDate, uriEncode, sha256Hex };

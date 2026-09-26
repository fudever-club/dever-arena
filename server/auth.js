/**
 * DEVER Arena — Auth thật: SHA-256 password + JWT HS256 (node:crypto, zero dependency).
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.DEVER_JWT_SECRET || 'dever-dev-secret-change-in-production';
if (!process.env.DEVER_JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[auth] FATAL: production yêu cầu DEVER_JWT_SECRET. Từ chối khởi động.');
    process.exit(1);
  }
  console.warn('[auth] DEVER_JWT_SECRET chưa đặt — dùng secret dev, KHÔNG dùng production.');
}

export function hashPassword(password, salt = 'dever-arena') {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function signToken(payload, ttlSeconds = 3600) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expect = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  } catch { return null; }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export function bearerUser(req, db) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  const payload = m ? verifyToken(m[1].trim()) : null;
  if (!payload) return null;
  return db.find('users', (u) => u.id === payload.sub) || null;
}

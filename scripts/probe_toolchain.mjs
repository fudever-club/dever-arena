/**
 * DEVER Arena — Phase 39 sớm: probe toolchain C++/Java trên PROD.
 * Nộp solver chuẩn của bài A (sort + 2 số lớn nhất) bằng cpp/java vào contest đang CODING,
 * in verdict. Máy chấm thiếu toolchain → 422 TOOLCHAIN_MISSING (trung thực, không giả verdict).
 *
 * Chạy: DEVER_ADMIN_PASS=... node scripts/probe_toolchain.mjs [slug] (mặc định dever-round-2)
 * Sau probe: prod được RESTORE về dump chụp trước đó (dọn bài nộp probe) — script in lệnh restore.
 */
const API = (process.env.DEVER_API_BASE || 'https://api-elegant-horse.spcf.app').replace(/\/$/, '');
const ADMIN_USER = process.env.DEVER_ADMIN_USER || 'dever_admin';
const ADMIN_PASS = process.env.DEVER_ADMIN_PASS || '';
const SLUG = process.argv[2] || 'dever-round-2';
if (!ADMIN_PASS) { console.error('[probe-tc] Thiếu DEVER_ADMIN_PASS.'); process.exit(2); }

const CPP = `#include <bits/stdc++.h>
using namespace std;
int main(){int n; if(!(cin>>n))return 0; vector<long long>a(n); for(auto&x:a)cin>>x; sort(a.rbegin(),a.rend()); cout<<a[0]+a[1]<<endl; return 0;}`;
const JAVA = `import java.util.*;
public class Solution{
  public static void main(String[] args){
    Scanner s=new Scanner(System.in);
    int n=s.nextInt();
    long[] a=new long[n];
    for(int i=0;i<n;i++)a[i]=s.nextLong();
    Arrays.sort(a);
    System.out.println(a[n-1]+a[n-2]);
  }
}`;

let token = null;
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const login = await api('POST', '/api/v1/auth/login', { username: ADMIN_USER, password: ADMIN_PASS });
if (login.status !== 200) { console.error(`[probe-tc] login ${login.status}`); process.exit(2); }
token = login.json.accessToken;

const c = (await api('GET', `/api/v1/contests/${SLUG}`)).json?.contest;
if (!c) { console.error('[probe-tc] không thấy contest'); process.exit(2); }
const probs = (await api('GET', `/api/v1/problems?contest_id=${c.id}`)).json?.problems || [];
const pA = probs.find((p) => p.code === 'A');
if (!pA) { console.error('[probe-tc] không thấy bài A'); process.exit(2); }
console.log(`[probe-tc] contest=${c.id} status=${c.status} problemA=${pA.id}`);

const results = [];
for (const [lang, src] of [['cpp', CPP], ['java', JAVA]]) {
  const t0 = Date.now();
  const r = await api('POST', '/api/v1/submissions', { contest_id: c.id, problem_id: pA.id, language: lang, source_code: src });
  const ms = Date.now() - t0;
  const j = r.json || {};
  const verdict = j.submission?.verdict || j.error || `HTTP ${r.status}`;
  const detail = j.submission?.detail || j.message || '';
  console.log(`[probe-tc] ${lang}: ${verdict} (${ms}ms) ${String(detail).slice(0, 120)}`);
  results.push({ lang, verdict, detail: String(detail).slice(0, 200) });
}
console.log(JSON.stringify(results));
console.log('[probe-tc] SAU PROBE: chạy restore về dump chụp trước probe để dọn bài nộp thử (restore-backup).');

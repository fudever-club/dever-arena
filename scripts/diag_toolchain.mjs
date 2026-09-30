/**
 * Chẩn đoán WA toolchain: dump suite thật của 1 bài từ prod, chạy solver C++/Java/Python
 * local trên từng test, so kết quả với expected → tìm test lệch.
 * Chạy: DEVER_ADMIN_PASS=... node scripts/diag_toolchain.mjs <problem_id> [code=A]
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = (process.env.DEVER_API_BASE || 'https://api-elegant-horse.spcf.app').replace(/\/$/, '');
const ADMIN_USER = process.env.DEVER_ADMIN_USER || 'dever_admin';
const ADMIN_PASS = process.env.DEVER_ADMIN_PASS || '';
const PID = process.argv[2];
const CODE = process.argv[3] || 'A';
if (!ADMIN_PASS || !PID) { console.error('Dùng: DEVER_ADMIN_PASS=... node scripts/diag_toolchain.mjs <problem_id>'); process.exit(2); }

const login = await fetch(`${API}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }) });
const token = (await login.json()).accessToken;
const tcs = (await (await fetch(`${API}/api/v1/admin/testcases?problem_id=${PID}`, { headers: { authorization: `Bearer ${token}` } })).json()).testcases || [];
console.log(`[diag] ${tcs.length} testcases (server trả tối đa 2000 ký tự/test — đủ chẩn đoán test nhỏ)`);

const CPP = `#include <bits/stdc++.h>
using namespace std;
int main(){int n; if(!(cin>>n))return 0; vector<long long>a(n); for(auto&x:a)cin>>x; sort(a.rbegin(),a.rend()); cout<<a[0]+a[1]<<endl; return 0;}`;

const dir = mkdtempSync(join(tmpdir(), 'dever-diag-'));
const cppPath = join(dir, 'sol.cpp');
writeFileSync(cppPath, CPP);
const exe = join(dir, process.platform === 'win32' ? 'sol.exe' : 'sol');
execFileSync('g++', ['-O2', '-std=c++20', '-o', exe, cppPath], { timeout: 60000 });

for (const t of tcs) {
  const stdin = String(t.stdin || '').replace(/\r\n/g, '\n');
  if (stdin.length > 2000) continue; // server cắt 2000 ký tự — test lớn không chẩn đoán được qua API
  let cppOut = '';
  try { cppOut = execFileSync(exe, { input: stdin, timeout: 10000 }).toString().trim(); } catch (e) { cppOut = `ERR:${String(e.stderr || e.message).slice(0, 80)}`; }
  const expected = String(t.expected_stdout || '').replace(/\r\n/g, '\n').trim();
  const ok = cppOut === expected;
  console.log(`[diag] tc ${t.id} n=${stdin.split('\n')[0]} expected=${expected} cpp=${cppOut} ${ok ? 'OK' : '<<< LECH'}`);
}
try { rmSync(dir, { recursive: true, force: true }); } catch {}

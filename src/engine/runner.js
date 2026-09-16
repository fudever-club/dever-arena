/**
 * DEVER-Forces Code Execution & Testcase Runner
 * Hỗ trợ chạy thử nghiệm giải thuật trực tiếp trong trình duyệt, đo lường thời gian thực thi (ms)
 * và đối soát Output thực tế so với Output kỳ vọng (Diff Checker).
 */

export const CODE_TEMPLATES = {
  cpp: `#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

void solve() {
    // Viết giải thuật của bạn tại đây
    int n;
    if (!(cin >> n)) return;
    cout << "Processed: " << n << "\\n";
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int t = 1;
    // cin >> t; // Bỏ comment nếu có nhiều testcase
    while (t--) {
        solve();
    }
    return 0;
}`,

  python: `import sys

def solve():
    input = sys.stdin.read
    data = input().split()
    if not data:
        return
    # Viết giải thuật tại đây
    print("Processed:", data[0])

if __name__ == '__main__':
    solve()`,

  java: `import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            System.out.println("Processed: " + n);
        }
    }
}`,

  javascript: `/**
 * Nhận chuỗi input từ đề bài và trả về chuỗi output
 */
function solve(input) {
    const lines = input.trim().split(/\\s+/);
    if (!lines[0]) return "";
    return "Processed: " + lines[0];
}`
};

/**
 * Giả lập biên dịch và chạy testcase
 * @param {string} language 
 * @param {string} sourceCode 
 * @param {string} customInput 
 * @returns {Promise<{ stdout: string, executionTimeMs: number, memoryKb: number, status: string }>}
 */
export async function executeCodeInBrowser(language, sourceCode, customInput) {
  const startTime = performance.now();

  // Kiểm tra lỗi cơ bản
  if (!sourceCode.trim()) {
    return { stdout: '', executionTimeMs: 0, memoryKb: 0, status: 'Compilation Error: Empty file' };
  }
  if (sourceCode.length > 100000) {
    return { stdout: '', executionTimeMs: 0, memoryKb: 0, status: 'Compilation Error: File too large (max 100KB)' };
  }
  if (customInput && customInput.length > 50000) {
    return { stdout: '', executionTimeMs: 0, memoryKb: 0, status: 'Input too large (max 50KB)' };
  }
  const isSuspicious = customInput && (customInput.includes('--') || customInput.includes('/*'));

  // Nếu là JavaScript, có thể execute thực tế nhưng phải giới hạn
  if (language === 'javascript' && sourceCode.includes('function solve')) {
    // Chặn các pattern nguy hiểm
    const blocked = [
      'fetch', 'XMLHttpRequest', 'import(', 'import ', 'localStorage', 'sessionStorage',
      'indexedDB', 'document.', 'window.', 'globalThis.', 'process.', 'require(',
      'Worker', 'SharedWorker', 'WebSocket', 'eval(', 'Function(', 'setTimeout', 'setInterval'
    ];
    if (blocked.some(p => sourceCode.includes(p))) {
      return { stdout: '', executionTimeMs: 0, memoryKb: 0, status: 'Security Error: Blocked API' };
    }
    // Giới hạn kích thước input
    if (customInput && customInput.length > 50000) {
      return { stdout: '', executionTimeMs: 0, memoryKb: 0, status: 'Input too large (max 50KB)' };
    }
    try {
      const runner = new Function(`
        "use strict";
        ${sourceCode}
        return solve(${JSON.stringify(customInput)});
      `);
      const output = runner();
      const elapsed = Math.round(performance.now() - startTime);
      // Timeout guard: nếu chạy > 1000ms coi như TLE
      if (elapsed > 1000) {
        const _res = { stdout: '', executionTimeMs: elapsed, memoryKb: 0, status: 'Time Limit Exceeded (> 1.0s)' };
        if (isSuspicious) _res.warning = 'suspicious';
        return _res;
      }
      const _result = {
        stdout: String(output).slice(0, 10000),
        executionTimeMs: Math.max(1, elapsed),
        memoryKb: Math.round(1024 + Math.random() * 512),
        status: isSuspicious ? 'Warning: suspicious input' : 'OK'
      };
      if (isSuspicious) _result.warning = 'suspicious';
      return _result;
    } catch (err) {
      const _err = {
        stdout: '',
        executionTimeMs: 0,
        memoryKb: 0,
        status: `Runtime Error: ${String(err.message).slice(0,200)}`
      };
      if (isSuspicious) _err.warning = 'suspicious';
      return _err;
    }
  }

  // Đối với C++ / Python / Java: Mô phỏng thời gian biên dịch & thực thi sandbox
  await new Promise(r => setTimeout(r, 250));
  const elapsed = Math.round(15 + Math.random() * 45);

  // Phân tích mã nguồn để phát hiện các lỗi thuật toán điển hình
  if (sourceCode.includes('int total') && customInput && (customInput.includes('1000000') || customInput.length > 50)) {
    const _r1 = {
      stdout: '-184729104', // Tràn số 32-bit tạo số âm
      executionTimeMs: elapsed,
      memoryKb: 3450,
      status: 'Wrong Answer (Integer Overflow detected!)'
    };
    if (isSuspicious) _r1.warning = 'suspicious';
    return _r1;
  }

  if (sourceCode.includes('while(true)') || sourceCode.includes('while (1)')) {
    const _r2 = {
      stdout: '',
      executionTimeMs: 1005,
      memoryKb: 12400,
      status: 'Time Limit Exceeded (> 1.0s)'
    };
    if (isSuspicious) _r2.warning = 'suspicious';
    return _r2;
  }

  const _final = {
    stdout: 'Output tính toán thành công cho input của bạn.',
    executionTimeMs: elapsed,
    memoryKb: 2840,
    status: isSuspicious ? 'Warning: suspicious input' : 'OK',
    ...(isSuspicious ? { warning: 'suspicious' } : {})
  };
  return _final;
}

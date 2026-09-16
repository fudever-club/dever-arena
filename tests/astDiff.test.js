import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCodeSimilarity, tokenizeCode, getAstStats } from '../src/engine/astDiff.js';

describe('DEVER Anti-Cheat AST Engine Tests', () => {
  test('Tokenize code loại bỏ comment và chuẩn hóa tên biến', () => {
    const code1 = `// Test comment
int n;
cin >> n;
`;
    const tokens = tokenizeCode(code1);
    assert.ok(tokens.includes('TOK_INT'));
    assert.ok(tokens.includes('TOK_CIN'));
    assert.ok(tokens.includes('OP_>>'));
  });

  test('Phát hiện 2 đoạn code đổi tên biến và comment giả là đạo văn (> 80%)', () => {
    const codeA = `
#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    int total = 0;
    for(int i = 0; i < n; i++) {
        total += i;
    }
    cout << total << endl;
    return 0;
}
`;

    // Code B: Đổi n thành sz, total thành sum, i thành idx, thêm comment ngụy trang
    const codeB = `
#include <iostream>
using namespace std;
// Day la code tu viet nha
int main() {
    int sz; cin >> sz;
    int sum = 0; // khoi tao tong
    for(int idx = 0; idx < sz; idx++) {
        sum += idx;
    }
    cout << sum << endl;
    return 0;
}
`;

    const result = calculateCodeSimilarity(codeA, codeB);
    assert.ok(result.similarity >= 85, `Độ tương đồng phải >= 85%, thực tế: ${result.similarity}%`);
    assert.equal(result.verdict, 'PLAGIARISM_CONFIRMED');
  });

  test('Hai giải thuật hoàn toàn khác nhau phải có độ tương đồng thấp (< 40%)', () => {
    const codeSort = `
#include <vector>
#include <algorithm>
void solve() {
    std::vector<int> a = {5, 2, 8, 1};
    std::sort(a.begin(), a.end());
}
`;

    const codeDijkstra = `
#include <queue>
#include <vector>
void dijkstra(int s) {
    std::priority_queue<std::pair<int, int>> pq;
    pq.push({0, s});
}
`;

    const result = calculateCodeSimilarity(codeSort, codeDijkstra);
    assert.ok(result.similarity < 40, `Độ tương đồng thuật toán khác nhau phải thấp, thực tế: ${result.similarity}%`);
    assert.equal(result.verdict, 'CLEAR');
  });

  test('getAstStats trả về tokens/ngrams/jaccard khớp với calculateCodeSimilarity', () => {
    const codeA = `
#include <iostream>
using namespace std;
int main(){int n; cin>>n; int total=0; for(int i=0;i<n;i++) total+=i; cout<<total<<endl; return 0;}
`;
    const codeB = `
#include <iostream>
using namespace std;
int main(){int sz; cin>>sz; int sum=0; for(int idx=0; idx<sz; idx++) sum+=idx; cout<<sum<<endl; return 0;}
`;
    const stats = getAstStats(codeA, codeB);
    const sim = calculateCodeSimilarity(codeA, codeB);
    assert.equal(typeof stats.tokensA, 'number');
    assert.equal(typeof stats.tokensB, 'number');
    assert.equal(typeof stats.jaccard, 'number');
    assert.equal(typeof stats.ngramsA, 'number');
    assert.equal(typeof stats.ngramsB, 'number');
    assert.ok(stats.tokensA > 0 && stats.tokensB > 0);
    assert.ok(stats.jaccard >= 0 && stats.jaccard <= 100);
    assert.equal(stats.jaccard, sim.similarity);
  });
});

/**
 * Định nghĩa bộ bài DEVER Round #2 (dùng chung setup_round2 + rebuild_r2_suite).
 * 4 bài ICPC 800–1300: A sort/greedy, B counting, C LIS, D Kadane.
 */
export const PROBLEMS = [
  {
    code: 'A', title: 'TỔNG LỚN NHẤT', rating: 800, tags: ['math', 'greedy'],
    timeLimit: '1.0s',
    statement: [
      'Cho dãy gồm $n$ số nguyên dương $a_1, a_2, \\dots, a_n$.',
      '',
      'Tìm giá trị lớn nhất của $a_i + a_j$ với $i \\neq j$.',
      '',
      '**Input**',
      '- Dòng 1: số nguyên $n$ ($2 \\le n \\le 2 \\cdot 10^5$).',
      '- Dòng 2: $n$ số nguyên $a_i$ ($1 \\le a_i \\le 10^9$).',
      '',
      '**Output**',
      '- In ra một số nguyên duy nhất là đáp án.',
    ].join('\n'),
    sampleInput: '5\n3 1 4 1 5\n', sampleOutput: '9',
    bounds: { minN: 2, maxN: 200000, minVal: 1, maxVal: 1000000000 },
    model: `import sys
def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    a = list(map(int, data[1:1+n]))
    a.sort()
    print(a[-1] + a[-2])
main()`,
    brute: `import sys
def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    a = list(map(int, data[1:1+n]))
    best = 0
    for i in range(n):
        for j in range(i+1, n):
            if a[i] + a[j] > best:
                best = a[i] + a[j]
    print(best)
main()`,
    editorial: 'Sort rồi lấy 2 phần tử lớn nhất. O(n log n). Bẫy: n=2 (chỉ 1 cặp), mọi phần tử bằng nhau.',
  },
  {
    code: 'B', title: 'ĐẾM SỐ CHẴN', rating: 900, tags: ['implementation', 'counting'],
    timeLimit: '1.0s',
    statement: [
      'Cho dãy $n$ số nguyên $a_1, \\dots, a_n$. Đếm số phần tử **chẵn** trong dãy.',
      '',
      '**Input**',
      '- Dòng 1: $n$ ($1 \\le n \\le 10^6$).',
      '- Dòng 2: $n$ số nguyên $a_i$ ($-10^9 \\le a_i \\le 10^9$).',
      '',
      '**Output**',
      '- In ra số lượng phần tử chẵn.',
    ].join('\n'),
    sampleInput: '6\n-4 7 0 13 -8 2\n', sampleOutput: '4',
    bounds: { minN: 1, maxN: 1000000, minVal: -1000000000, maxVal: 1000000000 },
    model: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    cnt = 0
    for i in range(1, n+1):
        if int(data[i]) % 2 == 0:
            cnt += 1
    print(cnt)
main()`,
    brute: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    evens = [x for x in map(int, data[1:n+1]) if x % 2 == 0]
    print(len(evens))
main()`,
    editorial: 'Duyệt một lần, đếm a % 2 == 0. O(n). Bẫy: số âm (Python % luôn dư không âm nên an toàn), 0 là số chẵn, n = 10^6 cần đọc nhanh (sys.stdin.buffer).',
  },
  {
    code: 'C', title: 'DÃY TĂNG DÀI NHẤT', rating: 1100, tags: ['dp', 'binary-search'],
    timeLimit: '1.5s',
    statement: [
      'Cho dãy $n$ số nguyên. Tìm độ dài dãy con **tăng ngặt** dài nhất (LIS — chọn các phần tử giữ thứ tự, giá trị tăng chặt).',
      '',
      '**Input**',
      '- Dòng 1: $n$ ($1 \\le n \\le 2 \\cdot 10^5$).',
      '- Dòng 2: $n$ số nguyên $a_i$ ($-10^9 \\le a_i \\le 10^9$).',
      '',
      '**Output**',
      '- In ra độ dài LIS.',
    ].join('\n'),
    sampleInput: '8\n10 9 2 5 3 7 101 18\n', sampleOutput: '4',
    bounds: { minN: 1, maxN: 200000, minVal: -1000000000, maxVal: 1000000000 },
    model: `import sys
from bisect import bisect_left
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    tails = []
    for i in range(1, n+1):
        x = int(data[i])
        p = bisect_left(tails, x)
        if p == len(tails):
            tails.append(x)
        else:
            tails[p] = x
    print(len(tails))
main()`,
    brute: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    a = list(map(int, data[1:n+1]))
    dp = [1] * n
    for i in range(n):
        for j in range(i):
            if a[j] < a[i] and dp[j] + 1 > dp[i]:
                dp[i] = dp[j] + 1
    print(max(dp) if n else 0)
main()`,
    editorial: 'LIS chuẩn bằng binary search (tails, O(n log n)) — brute O(n²) chỉ dùng để stress. Bẫy: dãy giảm dần (LIS = 1), phần tử bằng nhau không tính (tăng NGẶT).',
  },
  {
    code: 'D', title: 'TỔNG ĐOẠN LỚN NHẤT', rating: 1300, tags: ['dp', 'kadane'],
    timeLimit: '1.5s',
    statement: [
      'Cho dãy $n$ số nguyên $a_1, \\dots, a_n$. Tìm tổng lớn nhất của một **đoạn con không rỗng gồm các phần tử liên tiếp**.',
      '',
      '**Input**',
      '- Dòng 1: $n$ ($1 \\le n \\le 2 \\cdot 10^5$).',
      '- Dòng 2: $n$ số nguyên $a_i$ ($-10^9 \\le a_i \\le 10^9$).',
      '',
      '**Output**',
      '- In ra một số nguyên duy nhất là tổng lớn nhất.',
    ].join('\n'),
    sampleInput: '9\n-2 1 -3 4 -1 2 1 -5 4\n', sampleOutput: '6',
    bounds: { minN: 1, maxN: 200000, minVal: -1000000000, maxVal: 1000000000 },
    model: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    best = None
    cur = 0
    for i in range(1, n+1):
        x = int(data[i])
        cur = x if cur < 0 or best is None else cur + x
        if best is None or cur > best:
            best = cur
    print(best)
main()`,
    brute: `import sys
def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    a = list(map(int, data[1:n+1]))
    pre = [0]
    for x in a:
        pre.append(pre[-1] + x)
    best = -10**30
    for i in range(n):
        for j in range(i+1, n+1):
            if pre[j] - pre[i] > best:
                best = pre[j] - pre[i]
    print(best)
main()`,
    editorial: 'Kadane O(n): cur = max(x, cur+x), best = max(best, cur). Bẫy: dãy toàn số ÂM (đáp án = phần tử lớn nhất — đoạn không rỗng), n=1, dãy toàn số âm.',
  },
];

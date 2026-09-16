/**
 * DEVER-Forces Problemset Database
 * Danh mục bài toán phong phú từ cơ bản (800) đến thi đấu đỉnh cao (2400)
 */

export const PROBLEMS_DB = [
  {
    id: 'p101',
    code: 'A',
    title: 'Cyber Energy Array',
    rating: 800,
    tags: ['implementation', 'two-pointers', 'math'],
    timeLimit: '1.0s',
    memoryLimit: '256 MB',
    solvedCount: 142,
    statement: `Trong thành phố số của CLB DEVER, các kỹ sư quản lý $N$ viên pin năng lượng cyber, viên pin thứ $i$ có mức năng lượng $A_i$.
Bạn cần chọn một đoạn con liên tiếp có độ dài đúng bằng $K$ sao cho tổng năng lượng là lớn nhất.`,
    sampleInput: `2\n5 3\n2 -1 4 8 -3\n4 1\n-5 -2 -8 -1`,
    sampleOutput: `11\n-1`,
    editorial: `### Ý tưởng giải thuật:
Sử dụng kỹ thuật **Cửa sổ trượt (Sliding Window)** độ phức tạp $O(N)$.
1. Tính tổng $K$ phần tử đầu tiên: $S = \\sum_{i=1}^K A_i$.
2. Với mỗi bước dịch chuyển từ vị trí $i$ từ $K+1$ đến $N$, cập nhật: $S = S + A_i - A_{i-K}$.
3. Lấy giá trị lớn nhất của $S$ qua các bước.
* Độ phức tạp thời gian: $O(N)$.
* Độ phức tạp bộ nhớ: $O(1)$.`
  },

  {
    id: 'p102',
    code: 'B',
    title: 'DEVER Big Product Challenge',
    rating: 1200,
    tags: ['math', 'prefix-sums', 'big-integer'],
    timeLimit: '1.0s',
    memoryLimit: '256 MB',
    solvedCount: 89,
    statement: `Cho dãy gồm $N$ số nguyên $A_1, A_2, \\dots, A_N$.
Tính tổng tích của tất cả các cặp phần tử phân biệt:
$$S = \\sum_{1 \\le i < j \\le N} (A_i \\times A_j)$$
In ra giá trị $S$ chính xác. Chú ý giá trị có thể vượt quá kiểu số nguyên 32-bit thông thường.`,
    sampleInput: `3\n1 2 3`,
    sampleOutput: `11`,
    editorial: `### Ý tưởng giải thuật:
Áp dụng hằng đẳng thức đại số:
$$\\left(\\sum A_i\\right)^2 = \\sum A_i^2 + 2 \\sum_{i < j} A_i A_j$$
Suy ra:
$$S = \\frac{(\\sum A_i)^2 - \\sum A_i^2}{2}$$
Chỉ cần tính tổng mảng và tổng bình phương mảng trong một vòng lặp $O(N)$.
* Chú ý: Cần sử dụng kiểu dữ liệu lớn như \`__int128_t\` trong C++ hoặc Python để tránh tràn số.

### Phân tích độ phức tạp:
Thuật toán chỉ duyệt mảng một lần để tính \`sum\` và \`sumSq\`, độ phức tạp thời gian $O(N)$ và bộ nhớ $O(1)$ ngoài mảng đầu vào. So với cách $O(N^2)$ duyệt mọi cặp, cách này dễ dàng vượt $N \\le 2\\cdot 10^5$. Khi $|A_i| \\le 10^9$, $(\\sum A_i)^2$ có thể tới $4\\cdot 10^{28}$ nên bắt buộc dùng 64/128-bit.

### Edge cases & lưu ý hack:
- $N=1$: không có cặp nào, $S=0$ (công thức vẫn đúng vì $(A_1^2 - A_1^2)/2 = 0$).
- Giá trị âm: công thức vẫn giữ nguyên, $S$ có thể âm.
- Tràn số 32-bit: testcase hack thường dùng $N=2\\cdot 10^5$ với $A_i=10^6$ để bẻ code dùng \`int\` hoặc $O(N^2)$ gây TLE.

### Code mẫu ngắn (Python 5 dòng):
\`\`\`python
n=int(input())
a=list(map(int,input().split()))
s=sum(a)
sq=sum(x*x for x in a)
print((s*s - sq)//2)
\`\`\``
  },

  {
    id: 'p103',
    code: 'C',
    title: 'Graph of Da Nang Bridges',
    rating: 1600,
    tags: ['graphs', 'shortest-paths', 'dijkstra'],
    timeLimit: '1.5s',
    memoryLimit: '256 MB',
    solvedCount: 54,
    statement: `Đà Nẵng có $N$ nút giao thông và $M$ cây cầu nối 2 chiều. Cầu thứ $i$ nối giữa $U_i$ và $V_i$ với trọng số thời gian di chuyển $W_i$.
Tìm đường đi ngắn nhất từ trụ sở CLB DEVER (nút 1) đến Trung tâm Hội nghị ICPC (nút $N$).`,
    sampleInput: `4 4\n1 2 2\n2 3 3\n3 4 1\n1 3 6`,
    sampleOutput: `6`,
    editorial: `### Ý tưởng giải thuật:
Đây là bài toán tìm đường đi ngắn nhất đồ thị có trọng số không âm chuẩn mực.
* Sử dụng thuật toán **Dijkstra** kết hợp hàng đợi ưu tiên \`std::priority_queue<pair<long long, int>>\`.
* Độ phức tạp: $O((N + M) \\log N)$.

### Phân tích độ phức tạp:
Với $N \\le 10^5$, $M \\le 2\\cdot 10^5$, Dijkstra dùng heap cho $O((N+M)\\log N)$, đủ nhanh trong 1.5s. Mỗi đỉnh được relax tối đa một lần khi pop khỏi heap, mỗi cạnh xét một lần. Bộ nhớ $O(N+M)$ để lưu danh sách kề. Dùng \`long long\` cho khoảng cách vì tổng $W$ có thể vượt $2^{31}$.

### Edge cases & lưu ý:
- $N=1$: khoảng cách $0$ (điểm xuất phát trùng đích).
- Đồ thị không liên thông: không có đường từ $1$ tới $N$, trả về $-1$ hoặc \`INF\` tùy đề.
- Cạnh bội / tự khuyên: Dijkstra vẫn đúng vì trọng số không âm; cần khởi tạo \`dist[*]=INF\` và bỏ qua đỉnh đã visit.
- Tràn số: $W_i \\le 10^9$, đường đi dài có thể $>4\\cdot10^{14}$, không dùng \`int\`.

### Code mẫu ngắn (Python 5 dòng — lõi Dijkstra):
\`\`\`python
import heapq
dist=[10**18]* (n+1); dist[1]=0; pq=[(0,1)]
while pq:
 d,u=heapq.heappop(pq)
 if d!=dist[u]: continue
 for v,w in g[u]:
  if dist[v]>d+w: dist[v]=d+w; heapq.heappush(pq,(dist[v],v))
\`\`\``
  },

  {
    id: 'p104',
    code: 'D',
    title: "Buggy's Dynamic Coin Pyramid",
    rating: 1900,
    tags: ['dp', 'matrix-exponentiation', 'combinatorics'],
    timeLimit: '2.0s',
    memoryLimit: '256 MB',
    solvedCount: 28,
    statement: `Buggy the Beaver leo một kim tự tháp gồm $N$ bậc thang ($N \\le 10^{18}$). Mỗi bước, Buggy có thể bước 1, 2 hoặc 3 bậc.
Có bao nhiêu cách khác nhau để leo đến đỉnh? In kết quả theo modulo $10^9 + 7$.`,
    sampleInput: `4`,
    sampleOutput: `7`,
    editorial: `### Ý tưởng giải thuật:
Công thức truy hồi: $F(N) = F(N-1) + F(N-2) + F(N-3)$.
Vì $N \\le 10^{18}$, ta không thể dùng quy hoạch động $O(N)$ thông thường mà phải dùng **Nhân ma trận nhị phân (Matrix Exponentiation)** với ma trận chuyển tiếp kích thước $3 \\times 3$.
* Độ phức tạp: $O(3^3 \\log N) = O(\\log N)$.`
  },

  {
    id: 'p105',
    code: 'E',
    title: 'Bitwise Portal Overlord',
    rating: 2400,
    tags: ['data-structures', 'bitmasks', 'trees'],
    timeLimit: '2.5s',
    memoryLimit: '512 MB',
    solvedCount: 11,
    statement: `Cho một cây gồm $N$ đỉnh. Mỗi cạnh có một giá trị mặt nạ bit $W_i$.
Truy vấn: Cho 2 đỉnh $U, V$, tìm giá trị XOR lớn nhất của một tập con các cạnh trên đường đi đơn từ $U$ đến $V$.`,
    sampleInput: `3\n1 2 5\n2 3 3\n1 3`,
    sampleOutput: `6`,
    editorial: `### Ý tưởng giải thuật:
* Kết hợp thuật toán **LCA (Lowest Common Ancestor)** bằng Binary Lifting với cấu trúc **Linear Basis (Cơ sở tuyến tính XOR)**.
* Độ phức tạp: $O((N + Q) \\log N \\times \\text{bits})$.`
  }
];

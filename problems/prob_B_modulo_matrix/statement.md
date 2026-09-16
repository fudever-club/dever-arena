# Bài B: DEVER Big Product Challenge
* **Giới hạn thời gian:** $1.0\text{ giây}$
* **Giới hạn bộ nhớ:** $256\text{ MB}$
* **Độ khó:** Div. 3 / Div. 2 (Specialist) — $1000\text{ điểm}$

---

## Đề bài
Trong kỳ huấn luyện thuật toán của CLB DEVER, Buggy the Beaver đưa ra một dãy số gồm $N$ số nguyên $A_1, A_2, \dots, A_N$.

Buggy yêu cầu bạn tính tổng tích của tất cả các cặp phần tử phân biệt:
$$S = \sum_{1 \le i < j \le N} (A_i \times A_j)$$

Vì giá trị $S$ có thể rất lớn, hãy in ra giá trị $S$ chính xác (không lấy modulo).

## Dữ liệu vào (Input)
* Dòng đầu tiên chứa số nguyên $N$ ($2 \le N \le 2 \times 10^5$).
* Dòng thứ hai chứa $N$ số nguyên $A_1, A_2, \dots, A_N$ ($0 \le A_i \le 10^6$).

## Dữ liệu ra (Output)
* In ra một số nguyên duy nhất — giá trị tổng $S$.

## Ví dụ
### Input
```
3
1 2 3
```
### Output
```
11
```
*(Giải thích: $1 \times 2 + 1 \times 3 + 2 \times 3 = 2 + 3 + 6 = 11$)*

---

## 🎯 CƠ HỘI HACK ĐẶC TRƯNG CỦA CODEFORCES
* Chú ý: Với $N = 2 \times 10^5$ và các phần tử lên đến $10^6$, giá trị $S$ có thể đạt tới xấp xỉ $\frac{(2 \times 10^5 \times 10^6)^2}{2} \approx 2 \times 10^{22}$ (vượt quá cả số nguyên 64-bit `long long` nếu nhân ngây thơ không tối ưu hoặc vượt quá `int` 32-bit).
* Trong pretest: $N \le 100, A_i \le 10$, các bạn nộp dùng kiểu dữ liệu 32-bit `int` vẫn được **Pretests Passed**!
* Khi sang **Hack Phase**: Ai phát hiện đối thủ dùng `int` có thể nộp test $N = 2 \times 10^5, A_i = 10^6$ để **HACK thành công và ẵm ngay +100 điểm**!

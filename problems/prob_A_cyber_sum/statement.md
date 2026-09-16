# Bài A: Cyber Energy Array
* **Giới hạn thời gian:** $1.0\text{ giây}$
* **Giới hạn bộ nhớ:** $256\text{ MB}$
* **Độ khó:** Div. 3 / Div. 4 (Newbie) — $500\text{ điểm}$

---

## Đề bài
Trong thành phố số của CLB DEVER, các kỹ sư đang quản lý một chuỗi gồm $N$ viên pin năng lượng cyber. Viên pin thứ $i$ mang mức năng lượng nguyên $A_i$.

Để khởi động siêu máy tính, bạn cần chọn ra một đoạn con liên tiếp các viên pin có độ dài đúng bằng $K$ sao cho tổng năng lượng của đoạn này là lớn nhất có thể.

Hãy giúp các kỹ sư DEVER tìm giá trị tổng năng lượng cực đại đó.

## Dữ liệu vào (Input)
* Dòng đầu tiên chứa số nguyên dương $T$ ($1 \le T \le 10^4$) — số lượng bộ test.
* Mỗi testcase gồm 2 dòng:
  * Dòng thứ nhất chứa hai số nguyên $N$ và $K$ ($1 \le K \le N \le 2 \times 10^5$).
  * Dòng thứ hai chứa $N$ số nguyên $A_1, A_2, \dots, A_N$ ($-10^9 \le A_i \le 10^9$).
* Đảm bảo tổng của $N$ qua tất cả các testcase không vượt quá $2 \times 10^5$.

## Dữ liệu ra (Output)
* Với mỗi testcase, in ra một số nguyên duy nhất — tổng năng lượng lớn nhất của đoạn con có độ dài $K$.

## Ví dụ
### Input
```
2
5 3
2 -1 4 8 -3
4 1
-5 -2 -8 -1
```

### Output
```
11
-1
```

### Giải thích
* Ở testcase 1: Đoạn con độ dài 3 có tổng lớn nhất là $[-1, 4, 8]$ với tổng là $-1 + 4 + 8 = 11$.
* Ở testcase 2: Đoạn con độ dài 1 có tổng lớn nhất là $[-1]$.

// LỜI GIẢI CỦA THÍ SINH ROOKIE (DỄ BỊ HACK!)
// Thí sinh này dùng kiểu "int" 32-bit cho biến tổng và nhân O(N^2)
// Sẽ PASS Pretest vì test nhỏ, nhưng khi bị HACK với số lớn sẽ bị Overflow và TLE!

#include <iostream>
#include <vector>

using namespace std;

int main() {
    int n;
    cin >> n;
    vector<int> a(n);
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }

    // LỖI NGUY HIỂM: Dùng int 32-bit và chạy 2 vòng for O(N^2)
    int total = 0;
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            total += a[i] * a[j]; // Tràn số nghiêm trọng!
        }
    }

    cout << total << "\n";
    return 0;
}

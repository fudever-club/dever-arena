#include <iostream>
#include <vector>
#include <numeric>

using namespace std;

// In số __int128_t ra màn hình
void print128(__int128_t n) {
    if (n == 0) {
        cout << 0 << "\n";
        return;
    }
    string s = "";
    while (n > 0) {
        s += (char)('0' + (n % 10));
        n /= 10;
    }
    for (int i = (int)s.size() - 1; i >= 0; i--) {
        cout << s[i];
    }
    cout << "\n";
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int n;
    if (!(cin >> n)) return 0;

    __int128_t sum = 0;
    __int128_t sum_squares = 0;

    for (int i = 0; i < n; i++) {
        long long x;
        cin >> x;
        sum += x;
        sum_squares += (__int128_t)x * x;
    }

    // Công thức: S = ( (sum)^2 - sum_squares ) / 2
    __int128_t ans = (sum * sum - sum_squares) / 2;
    print128(ans);

    return 0;
}

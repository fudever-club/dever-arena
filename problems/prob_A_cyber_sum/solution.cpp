#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

void solve() {
    int n, k;
    if (!(cin >> n >> k)) return;
    vector<long long> a(n);
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }

    long long current_sum = 0;
    for (int i = 0; i < k; i++) {
        current_sum += a[i];
    }

    long long max_sum = current_sum;
    for (int i = k; i < n; i++) {
        current_sum += a[i] - a[i - k];
        max_sum = max(max_sum, current_sum);
    }

    cout << max_sum << "\n";
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int t;
    if (cin >> t) {
        while (t--) {
            solve();
        }
    }
    return 0;
}

import sys

def validate():
    lines = sys.stdin.read().strip().split()
    if not lines:
        sys.exit("Empty input")
    t = int(lines[0])
    assert 1 <= t <= 10000, "T out of range"
    idx = 1
    total_n = 0
    for _ in range(t):
        n = int(lines[idx]); idx += 1
        k = int(lines[idx]); idx += 1
        assert 1 <= k <= n <= 200000, "N or K out of bounds"
        total_n += n
        for _ in range(n):
            a_i = int(lines[idx]); idx += 1
            assert -10**9 <= a_i <= 10**9, "A_i out of bounds"
    assert total_n <= 200000, "Total N exceeded"
    print("VALIDATION SUCCESS")

if __name__ == "__main__":
    validate()

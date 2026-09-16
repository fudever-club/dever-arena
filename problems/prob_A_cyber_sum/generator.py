import random
import sys

def generate_test(num_cases=5, max_n=1000):
    print(num_cases)
    for _ in range(num_cases):
        n = random.randint(1, max_n)
        k = random.randint(1, n)
        print(f"{n} {k}")
        a = [random.randint(-10**9, 10**9) for _ in range(n)]
        print(*(a))

if __name__ == "__main__":
    generate_test()

# DEVER Arena — Load Testing (quy mô contest)

Script: `scripts/load/scale_test.mjs`. Tự boot server **riêng** (DB temp `DEVER_DB_PATH`,
port 0, tự `shutdownJudge` + xóa DB khi xong) — **không đụng server dev của ai**.

## Cách chạy

```bash
node scripts/load/scale_test.mjs
USERS=30 CONCURRENCY=10 ROUNDS=2 node scripts/load/scale_test.mjs
USERS=100 CONCURRENCY=20 ROUNDS=1 node scripts/load/scale_test.mjs
```

| Env | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `USERS` | 10 | Số user login đồng loạt (CI-safe) |
| `CONCURRENCY` | 5 | Độ đồng thời tối đa mỗi pha (login / register / submit) |
| `ROUNDS` | 2 | Số vòng nộp / user (tổng submit = user đăng nhập thành công × ROUNDS) |
| `CONTEST_ID` / `PROBLEM_ID` | `contest_dever_round1` / `p102` | Contest + bài Python đúng (`3 / 1 2 3 → 11`) |

Kịch bản: admin seed thêm user thiếu → login đồng loạt (chia batch) → register
contest (best-effort) → `ROUNDS` vòng nộp Python đúng, đo latency từng submit.

## Đọc số liệu

Script in 3 dòng `[scale]` + 1 JSON:

- `total_req` = admin login (1) + tạo user + login + register + submit.
- `ac_rate` = AC / tổng submit đã thử (**429 tính là fail**).
- `p50/p95/max/avg` = phân vị latency trên submit HTTP 201 (ms).
- `429` tách riêng login vs submit; `verdicts` = phân bố verdict (`AC`, `HTTP_403`, `RATE_LIMITED`...).
- **Gate: exit 1 khi AC rate < 95% hoặc p95 > 15s.**

## Số liệu thực tế (27/09/2026, máy dev, `DEVER_JUDGE_WORKERS` mặc định = 2)

| Cấu hình | total_req | Submit (AC rate) | p50 / p95 / max | 429 | Kết quả |
| --- | --- | --- | --- | --- | --- |
| `10/5/2` (mặc định CI) | 46 | 20/20 (100%) | 111 / 150 / 190 ms | 0 | PASS |
| `30/10/2` | 146 | 60/60 (100%) | 196 / 225 / 265 ms | 0 | PASS |
| `100/20/1` (target contest) | 314 | 59/59 (100%) | 393 / 467 / 472 ms | login 41, submit 0 | PASS* |

\* Ở 100 user: chỉ 59/100 login thành công, 41 login dính 429 (bucket login
60/phút/IP trong `server/index.js` `RATE_RULES`). 59 user vào được nộp **100% AC**,
p95 467ms — còn xa ngưỡng 15s.

## Khuyến nghị tuning

1. **Rate-limit login là nút thắt đầu tiên, không phải judge.** Phòng thi dùng chung
   NAT/IP sẽ đụng trần `POST /api/v1/auth/login: 60/phút/IP` ngay khi ~100 thí sinh
   login đồng loạt (đo được 41% login rớt ở 100 concurrent). Trước giờ thi: nâng tạm
   bucket login (ví dụ 200–300/phút/IP) hoặc scope theo username, và cho thí sinh
   login rải (stagger) 2–3 phút. Bucket submit (`30/phút/user`) vẫn dư dả — 100-run
   ghi nhận **0 submit 429**.
2. **`DEVER_JUDGE_WORKERS` giữ 2 cho dev/CI, lên 4 khi thi thật.** p50 tăng tuyến tính
   theo độ đồng thời (111 → 196 → 393ms ở conc 5 → 10 → 20) — dấu hiệu xếp hàng ở pool
   2 worker, nhưng p95 ở 59 submit đồng thời mới 467ms, cách xa budget 15s. Local cap
   là 4 worker; vượt quy mô đó phải tách hàng đợi Redis/RabbitMQ theo
   `docs/JUDGE_ARCHITECTURE.md`.
3. **Gate CI giữ `10/5/2`; chạy đêm/trước contest `100/20/1`.** `10/5/2` chạy <5s,
   không chạm trần rate-limit, đủ bắt regression judge. `100/20/1` là bài kiểm tra
   login-bucket + hàng đợi judge, kỳ vọng: submit AC 100%, p95 < 2s, login 429 = 0
   sau khi đã nới bucket login.

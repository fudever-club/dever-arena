---
name: dever-judge-deep
description: Kiến thức chuyên sâu về máy chấm DEVER Arena — sandbox, toolchain, verdict, queue, các bẫy prod đã gặp. Dùng khi sửa/tuning judge, thêm ngôn ngữ, xử lý TOOLCHAIN_MISSING/TLE/MLE.
---

# DEVER Judge Deep Knowledge

## Kiến trúc
- `server/judge.js` — `executeOne()`: chạy 1 testcase qua `spawnSync`, timeout=TL, SIGKILL, `windowsHide`.
- `server/queue.js` + `judgeWorker.js` — fork pool (DEVER_JUDGE_WORKERS, prod=2), timeout + respawn, FIFO 1 mức (hack/pretest đã bỏ theo ADR-005).
- Image prod: `Dockerfile.api` (node:22-alpine + python3 + openjdk17 + g++). **Bắt buộc COPY scripts/ nếu thêm script cron.**

## Verdict mapping
AC · WA (output lệch) · TLE (ETIMEDOUT) · MLE (pattern stderr từng runtime) · RTE (exit ≠ 0) · CE (compile fail / file rỗng / security block) · SKIP (thiếu toolchain local).

## Quy tắc vàng
1. Không bao giờ chạy code người dùng ngoài spawnSync sandbox; chặn network/file system qua `checkSecurity`.
2. `memoryLimit` → JS dùng `--max-old-space-size`; Python/Java chỉ warn (không rlimit cứng ở Windows dev).
3. Mọi thay đổi judge phải có test `judge_depth_practice.test.js` + test vòng đời nộp bài thật.
4. per_test KHÔNG được chứa input/expected (chỉ index/verdict/time_ms) — chống lộ test.

## Bẫy prod đã gặp
- Base image "node" không có python3/g++ → TOOLCHAIN_MISSING (Task 118).
- Quên COPY scripts/ → cron backup nổ `Cannot find module` (29/9).
- Mảng JS truyền thẳng cột jsonb → pg serialize array literal → flush nổ (29/9).

## Việc phổ biến
Thêm ngôn ngữ: thêm RUNNERS entry + test chấm thật + cập nhật `normalizeLanguage`. Tuning TL: đọc bounds của đề, không hardcode.

---
name: dever-quality-gate
description: Quality Gates & Load Testing authority for DEVER Arena. Specialized in test strategy, architecture contracts, judge load benchmarks, dependency audits, and release readiness verdicts. Triggers when verifying, load-testing, auditing, or certifying a release.
---

# Quality Gate Skill

## Overview
Cửa chặn cuối trước mọi release/contest. Chuẩn hiện tại: **139 tests / 26 suites PASS 100%**, `detect.mjs` 0 error, build sạch, load 20 job 20/20 AC.

## Gate Matrix (tất cả phải xanh)
| Gate | Lệnh | Ngưỡng |
|---|---|---|
| Unit + integration + E2E | `npm run test` | 100% pass, 0 fail |
| Architecture contract | `node detect.mjs` | 0 error |
| Production bundle | `npm run build` | sạch, không error |
| Judge load smoke | `npm run test:load` | 20/20 AC trong 30s (`LOAD_N`, `LOAD_BUDGET_MS` chỉnh được) |
| Dependency audit | `npm run audit:high` | 0 high/critical |

## Rules
- Core (`src/core/`, `src/engine/`): hàm thuần + unit test cho mọi luật điểm/hack/Elo/AST/freeze.
- Endpoint server mới: thêm test vòng đời vào `tests/server_api.test.js` (không test tay thay thế).
- Health/readiness đổi: khóa bằng `tests/health.test.js`.
- Load fail (non-AC hoặc vượt budget) = **chặn release**, ưu tiên fix worker (`server/queue.js`, `judgeWorker.js`) trước.
- Audit moderate trở xuống: ghi nhận, không chặn; high/critical: fix hoặc nâng cấp dependency trước khi ship.
- Sau mỗi đợt: cập nhật số liệu tests trong `README.md` / `PRODUCT.md` / `docs/CAPABILITY_MAP.md` + entry `docs/CHANGELOG.md`.

---
name: dever-arena-orchestrator
description: Master Multi-Agent Orchestrator for developing, maintaining, and scaling the DEVER Arena competitive programming platform for CLB FU-DEVER. Triggers when managing contest lifecycles, integrating judge sandboxes, running live rounds, calculating Elo ratings, or expanding web features.
---

# DEVER Arena Orchestrator Skill

## Overview
This skill governs the end-to-end development, operations, and feature scaling of **DEVER Arena** (the ICPC-style algorithmic competition platform for CLB FU-DEVER at FPT University Da Nang).

## Core Responsibilities
1. **Contest Lifecycle Orchestration (ADR-005, phiên bản 2):**
   - Manage the 3 strict contest phases: `REGISTRATION` ➔ `CODING` ➔ `FINISHED`.
   - ICPC là thể thức mặc định (`contest_format: 'ICPC'`). Codeforces decay và IOI subtask chỉ là lựa chọn phụ khi tạo kỳ thi.
   - Không tồn tại Hack Phase, Hack Room, pretest, system test: mọi bài nộp được chấm **full-suite** ngay khi gửi và verdict trả về là **verdict cuối cùng**.
   - Freeze bảng điểm 30 phút cuối chỉ áp dụng với bảng Codeforces; bảng ICPC không freeze.
2. **Scoring Rules (theo contest_format):**
   - **ICPC (mặc định):** solved count primary, total penalty secondary ($t + 20 \times W$ cho bài đã AC).
   - **Codeforces:** decay $P = \max(0.3 P_{\max}, P_{\max}(1 - t/250) - 50W)$; **không** có hack score (đã gỡ).
   - **IOI:** subtask partial scoring (0–100).
3. **Judge Worker & Queue Management:**
   - Priority queue 3 bậc: `HIGH: 1` (nộp live), `DEFAULT: 2`, `BATCH: 3` (rejudge/replay). Stat keys: `high/default/batch`.
   - Cgroups v2 resource capping (CPU time, RAM 256MB, zero network `--net=none`, max 64 pids).
   - Full-suite judging: chạy toàn bộ testcases của bài, trả verdict cuối + tổng thời gian.
4. **Rating Engine Calibration:**
   - Elo rating recalculation with expected seed, geometric mean rank, and anti-inflation zero-sum balancing (7 bậc rank).

## Agent Workflows
* **Before modifying core logic:** Always run `npm run test` (152 tests / 24 suites — cập nhật số liệu khi thêm test). Also run `node detect.mjs` (0 errors) and `npm run build` (clean).
* **Single-stack rule:** React SPA (`app.html`, `src/`) là UI duy nhất được phát triển. Legacy vanilla (`index.html`, `arena.html`, `admin.html`, `js/app.js`) đã freeze — không thêm tính năng, không đồng bộ sang đó.
* **Backend first:** Mọi tính năng contest (submit, phase, standings, accounts, profile) phải đi qua `server/` (REST + SSE + JWT). UI không được bịa verdict/điểm/số liệu — lỗi phải hiện rõ.
* **Khi thêm endpoint server:** cập nhật `docs/API_SPECIFICATION.md` + thêm test vào `tests/server_api.test.js`.
* **Khi xong một đợt:** cập nhật `docs/CHANGELOG.md`, `tasks/todo.md`, số liệu tests trong `README.md`/`PRODUCT.md`/`docs/SPEC.md`.
* **Env vận hành:** server API chạy `PORT=8787 npm run server` (shell cha có thể mang `PORT=0`); health check `GET /api/health`.
* **Cấm:** Clan Wars (đã xóa), Hack/Room/pretest/system-test (đã gỡ theo ADR-005), icon ngoài SVG svgl.app, emoji trang trí, số liệu demo giả danh số thật.
* **Zero-AI Guarantee:** Strictly adhere to `docs/decisions/ADR-003-pure-core-engine-and-zero-ai.md`. Do not introduce external AI gateways, LLM APIs, or opaque machine generation into contest environments.

## SDLC Phase Gates (Plan ➔ Build ➔ Verify ➔ Deploy ➔ Operate)
Không phase nào được bỏ qua — mỗi phase có skill chủ trì và cửa chặn rõ ràng:
1. **Plan:** Viết spec/ADR trước code (`docs/decisions/`, `tasks/plan.md`). Đổi luật contest → cập nhật `CONTEST_RULEBOOK.md` cùng PR.
2. **Build:** Backend first (`server/` REST + SSE + JWT), UI single-stack (`src/`). Style đi qua `dever-ui-craft` (DESIGN.md Linear, tokens `src/index.css`).
3. **Verify:** Ủy quyền `dever-quality-gate` — full gate matrix xanh (test 100%, detect 0, build sạch, load 20/20 AC, audit 0 high) mới được sang Deploy.
4. **Deploy:** Ủy quyền `dever-deploy-release` — CI xanh → semver → `docker compose up --build -d` → `/api/health` + `/api/ready` 200.
5. **Operate:** Ủy quyền `dever-live-ops` — backup trước giờ thi, on-call 2 người trong live window, hậu kiểm + retention sau Round.

## Sub-skills cùng hệ
- `dever-ui-craft` — design system Linear-style, tokens, dark theme.
- `dever-quality-gate` — gate matrix trước merge.
- `dever-profile-analytics` — luật dữ liệu profile thật (chart SVG zero-dep, không bịa số).
- `polygon-problemsetter` — quy trình soạn đề chuẩn quốc tế.

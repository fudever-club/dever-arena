---
name: dever-arena-orchestrator
description: Master Multi-Agent Orchestrator for developing, maintaining, and scaling the DEVER Arena competitive programming platform for CLB FU-DEVER. Triggers when managing contest lifecycles, integrating judge sandboxes, running live rounds, calculating Elo ratings, or expanding web features.
---

# DEVER Arena Orchestrator Skill

## Overview
This skill governs the end-to-end development, operations, and feature scaling of **DEVER Arena** (the Codeforces & ICPC-inspired algorithmic competition platform for CLB FU-DEVER at FPT University Da Nang).

## Core Responsibilities
1. **Contest Lifecycle Orchestration:**
   - Manage the 5 strict contest phases: `REGISTRATION` ➔ `CODING` ➔ `HACK_PHASE` ➔ `SYSTEM_TESTING` ➔ `FINISHED`.
   - Ensure boundary invariants: No hacking outside Hack Phase, room segregation (25 coders/room), dynamic score decay clamping (minimum 30%).
2. **Multi-Format Scoring Rules:**
   - **Codeforces:** $P_{decay} = \max(0.3 P_{\max}, P_{\max}(1 - t/250) - 50W)$, $+100$ per valid hack, $-50$ per invalid hack.
   - **ICPC:** Solved count primary, Total penalty secondary ($t + 20 \times W$ for AC problems only).
   - **IOI:** Subtask partial scoring (0–100).
3. **Judge Sandbox & Worker Management:**
   - Monitor priority queue dispatch (Instant Hack Queue > Pretests > Batch System Test).
   - Ensure cgroups v2 resource capping (CPU time, RAM 256MB, zero network `--net=none`, max 64 pids).
4. **Rating Engine Calibration:**
   - Elo rating recalculation with expected seed, geometric mean rank, and anti-inflation zero-sum balancing.

## Agent Workflows
* **Before modifying core logic:** Always run `node --test tests/*.test.js` to ensure zero regressions (139 tests across 26 suites). Also run `node detect.mjs` (0 errors) and `npm run build` (clean).
* **Single-stack rule:** React SPA (`app.html`, `src/`) là UI duy nhất được phát triển. Legacy vanilla (`index.html`, `arena.html`, `admin.html`, `js/app.js`) đã freeze — không thêm tính năng, không đồng bộ sang đó.
* **Backend first:** Mọi tính năng contest (submit, hack, phase, standings, accounts) phải đi qua `server/` (REST + SSE + JWT). UI không được bịa verdict/điểm/số liệu — lỗi phải hiện rõ.
* **Khi thêm endpoint server:** cập nhật `docs/API_SPECIFICATION.md` + thêm test vào `tests/server_api.test.js`.
* **Khi xong một đợt:** cập nhật `docs/CHANGELOG.md`, `tasks/todo.md`, số liệu tests trong `README.md`/`PRODUCT.md`/`docs/SPEC.md`.
* **Cấm:** Clan Wars (đã xóa), icon ngoài SVG svgl.app, emoji trang trí, số liệu demo giả danh số thật.
* **Zero-AI Guarantee:** Strictly adhere to `docs/decisions/ADR-003-pure-core-engine-and-zero-ai.md`. Do not introduce external AI gateways, LLM APIs, or opaque machine generation into contest environments.

## SDLC Phase Gates (Plan ➔ Build ➔ Verify ➔ Deploy ➔ Operate)
Không phase nào được bỏ qua — mỗi phase có skill chủ trì và cửa chặn rõ ràng:
1. **Plan:** Viết spec/ADR trước code (`docs/decisions/`, `tasks/plan.md`). Đổi luật contest → cập nhật `CONTEST_RULEBOOK.md` cùng PR.
2. **Build:** Backend first (`server/` REST + SSE + JWT), UI single-stack (`src/`). Style đi qua `dever-ui-craft` (DESIGN.md Linear, tokens `src/index.css`).
3. **Verify:** Ủy quyền `dever-quality-gate` — full gate matrix xanh (test 100%, detect 0, build sạch, load 20/20 AC, audit 0 high) mới được sang Deploy.
4. **Deploy:** Ủy quyền `dever-deploy-release` — CI xanh → semver → `docker compose up --build -d` → `/api/health` + `/api/ready` 200.
5. **Operate:** Ủy quyền `dever-live-ops` — backup trước giờ thi, on-call 2 người trong live window, hậu kiểm + retention sau Round.


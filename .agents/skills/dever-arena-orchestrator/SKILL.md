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
* **Before modifying core logic:** Always run `node --test tests/*.test.js` to ensure zero regressions (98 tests across 25 suites).
* **When authoring new contest features:** 
  - Update backend calculation engines in `src/core/` and offline runners in `src/engine/`.
  - Maintain synchronization across both UI implementations:
    1. Vanilla Web Arena: `index.html`, `arena.html`, `admin.html`, `css/style.css`, and `js/app.js`.
    2. Enterprise React SPA: `app.html`, `src/App.jsx`, `src/pages/*.jsx`, and `src/components/layout/*.jsx`.
* **Zero-AI Guarantee:** Strictly adhere to `docs/decisions/ADR-003-pure-core-engine-and-zero-ai.md`. Do not introduce external AI gateways, LLM APIs, or opaque machine generation into contest environments.


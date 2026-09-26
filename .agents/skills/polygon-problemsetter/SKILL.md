---
name: polygon-problemsetter
description: Master Problemsetting & Polygon Engineering Engine. Specialized in authoring publication-grade competitive programming problems, drafting LaTeX mathematical statements, writing testlib.h validators, edge-case generators, special checkers, and calibrated test suites.
---

# Polygon Problemsetter Skill

## Overview
This skill guides the authoring, formatting, validation, and test generation for algorithmic problems on **DEVER Arena**, adhering strictly to the **Codeforces Polygon & testlib.h** international standards.

## Mandatory Components of a Problem Package
1. `statement.md`: Problem description, formal mathematical definitions in LaTeX ($...$ and $$...$$), constraints, input/output specifications, sample test explanation.
2. `solution.cpp`: Model reference solution (C++20 with optimal time and memory complexity).
3. `validator.cpp`: Uses `testlib.h` to validate 100% of inputs against limits (guarantees hackers cannot inject malformed inputs).
4. `generator.cpp`: Generates pseudo-random and adversarial edge cases (`rnd.next()`).
5. `checker.cpp`: Special judge when multiple valid outputs exist (or default token diff).
6. `editorial.md`: Step-by-step mathematical proof, intuition, complexity analysis, and clean reference code.

## Edge-Case Checklist (Must Include in Testcases)
* $N = 1, N = 2$, minimal constraints.
* Maximal constraints ($N = 2 \times 10^5$, elements $10^9$ or $10^{18}$ to catch 32-bit `int` overflow).
* Degenerate graph structures: Line graphs, star graphs, cycles, trees with height $N$.
* Anti-hash tests for hash tables (`unordered_map`).
* Floating point precision traps ($10^{-6}$ vs $10^{-9}$).

## Admin Problemsetter Studio Integration
* When authoring or publishing problems via Admin Command Center:
  - Utilize KaTeX LaTeX syntax: `$inline$` and `$$display$$` for mathematical notation.
  - Test statement rendering with live split-screen preview.
  - Verify sample test inputs/outputs against the testcase schema.
  - Real-time publish automatically propagates to all contestant sessions via `BroadcastChannel`.

## Generator + Stress + Blind-Tester Workflow (Phase 26)
* **Generator** (`src/engine/testGenerator.js`, shared browser + server): seeded mulberry32 — same seed → same suite. Every suite opens with 5 traps (N min, N=1, all-equal, overflow, N max), then rotates random/sorted/alternating. Preview strategies in Studio before running.
* **Stress** (`POST /api/v1/admin/stress`): run model vs brute-force on the same suite through the judge worker pool (batch 4, count ≤ 30). `FAIL` with ≤5 detailed mismatches means the tests (or model) are wrong — fix before publishing. On `PASS`: apply `suggestedTimeLimitS` (= 2× slowest model run, min 1s) and save brute outputs as pretests (`POST /api/v1/admin/testcases`).
* **Blind review** (status on problem row, no schema change): `DRAFT → IN_TESTING → APPROVED` (reject → `DRAFT`). Never self-assign (`SELF_TEST` 422). Testers see the queue at ContestHub with the statement only — editorial stays hidden. Reports (solved/minutes/feedback) accumulate on the problem for the coordinator's approve/reject decision.


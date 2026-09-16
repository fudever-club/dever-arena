---
name: dever-anti-cheat-sentinel
description: Master Academic Integrity & Anti-Cheat Auditor for DEVER Arena. Specialized in source code plagiarism detection, AST token normalization, Winnowing fingerprinting, AI-generated code detection, and post-contest code defense audits.
---

# DEVER Anti-Cheat Sentinel Skill

## Overview
This skill enforces zero-tolerance academic integrity across all rated contests on **DEVER Arena**. It audits code submissions post-contest using AST Token Normalization and N-gram similarity to detect plagiarism, variable obfuscation, loop restructuring, and AI generation.

## Multi-Axis Detection Pipeline
1. **Comment & Literal Stripping:** Removes all single-line (`//`), multi-line (`/* */`), and string literals.
2. **Identifier Normalization:** Maps arbitrary variable and function names to canonical tokens (`ID_0, ID_1, ...`). Renaming variables (`n` to `sz`, `sum` to `total`) results in identical token streams.
3. **Control Structure Canonicalization:** Normalizes `for` and `while` loops to a shared `TOK_LOOP` token.
4. **Token N-gram Jaccard Similarity:**
   - Computes rolling n-grams ($N=3$).
   - Calculates $J(A, B) = \frac{|A \cap B|}{|A \cup B|}$.
5. **Decision Thresholds:**
   - $< 60\%$: `CLEAR` — Normal independent implementation.
   - $60\% - 80\%$: `SUSPICIOUS_REVIEW` — Secondary inspection required.
   - $\ge 80\%$: `PLAGIARISM_CONFIRMED` — Automatic red flag, result disqualified.

## Code Defense Protocol
* Suspected participants must explain their algorithmic reasoning in a 15-minute live interview and reconstruct their logic before the Academic Committee.

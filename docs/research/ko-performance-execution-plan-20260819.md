# Korean diagnosis performance completion plan — 2026-08-19

Branch: `bot/ko-diagnosis-performance`  
Base: `dev` (`f0457e3`)

## Objective

Finish the existing research-only Korean diagnosis implementation without changing the production default until the preregistered promotion gates pass.

## Constraints

- Preserve all current modified and untracked work; do not reset, stash, or overwrite it.
- Keep `src/features/*` deterministic and LLM-free.
- Keep treatment behind `PATINA_KO_DIAGNOSIS_RESEARCH=1` until promotion evidence passes.
- Detector scores remain diagnostics and cannot select candidates or veto promotion.
- Do not weaken MPS/fidelity, exact-number, cohesion, latency, cost, accounting, or stopping gates.
- Do not inspect confirmatory outcomes until the apparatus and eligibility checks are fixed.

## Execution

1. Establish the baseline: inspect the worktree diff and run focused tests for the changed runtime, diagnosis, invariants, fingerprint, live-quality, and A/B harness.
2. Audit implementation against the preregistration: corpus path/SHA, complete 120-row accounting, producer/judge separation, AB/BA consistency, safety filtering, lower-tail/cohesion/budget calculations, and fail-closed behavior.
3. Reproduce the reported live blockers on a debugging fixture only: MPS/fidelity regression and Gemini scorer timeout. Fix their root causes without relaxing gates.
4. Re-run focused tests and the 11-fixture shadow A/B. Proceed only when safety and scorer reliability are eligible.
5. Freeze the apparatus, verify the locked corpus SHA, then run the 120-item `--confirmatory` comparison once. Do not replace failed rows or alter thresholds after inspection.
6. Analyze every promotion gate. Keep production baseline on any failure; promote only if every preregistered gate passes.
7. Run `npm test`, `npm run lint`, benchmark/report, dogfood, and relevant live-quality checks. Run an independent read-only review over the final diff.
8. Update the handoff with observed evidence, commit the branch, and open a PR into `dev`. Merge only after CI and independent review are green.

## Completion evidence

- Focused and full verification outputs are recorded.
- The confirmatory report accounts for exactly 120 rows and carries the locked corpus SHA, or records a fail-closed reason the run was not eligible.
- Production remains on the baseline unless all promotion gates pass.
- Independent review and CI status are recorded before integration.

## Current status

- Steps 1–3 completed as far as available credentials permit.
- Focused tests, full tests, lint, deterministic benchmark, and dogfood pass.
- Corpus binding verified: 120 unique rows and the preregistered SHA-256.
- Harness error-row eligibility, paired aggregation, candidate-only cost
  accounting with separate input/output rates, zero-cost rejection, and
  floor-failure invariant evidence fixed.
- **2026-08-31: credential block resolved by amendment v2** (gemini key
  dedicated to production free tier; deepseek added to the judge family map,
  owner-approved). Pair: producer deepseek-v4-flash (low reasoning) +
  judge codex-cli (gpt-5.5).
- **Step 4 complete**: 11-fixture shadow eligible (0 errors, 0 inconsistent,
  scorer stable) — evidence in `ko-shadow-ab-evidence-20260831.md`.
- **Steps 5–6 complete (2026-09-01)**: the single confirmatory run finished
  with 120/120 rows accounted and the verdict **NOT PROMOTED** (7 gates
  failed; 83/105 order-inconsistent pairs; treatment ×2.46 cost for
  identical outcomes on a mostly-clean corpus). Production stays
  `iterative-baseline`. Full analysis:
  `ko-confirmatory-verdict-20260901.md` and
  `artifacts/ko-performance/confirmatory-report-20260831.json`.

# KO confirmatory verdict — 2026-09-01 (run started 2026-08-31)

Preregistration (verbatim, do not edit): [`ko-performance-preregistration-20260818.md`](./ko-performance-preregistration-20260818.md). Executed plan: [`ko-performance-execution-plan-20260819.md`](./ko-performance-execution-plan-20260819.md).

The single preregistered `--confirmatory` run completed (120/120 rows
accounted; corpus SHA `23c546ab…fee3` verified frozen before launch).
Producer `deepseek-v4-flash` + `reasoning_effort: low`; judge `codex-cli`
(gpt-5.5) under amendment v2. Report:
`artifacts/ko-performance/confirmatory-report-20260831.json`.

## Verdict: NOT PROMOTED — production stays `iterative-baseline`

Seven preregistered gates failed:

| Gate | Required | Observed | Result |
|---|---|---|---|
| consistent judgments | ≥ 80 of 120 | **22** (83 inconsistent, 6 error, 9 none) | FAIL |
| preference CI95 lower | > 0.50 | treatment 14/22 = 0.636, CI95 **[0.430, 0.803]** | FAIL |
| mean cohesion | ≥ baseline + 0.2 | 5.0 vs 4.9 (+0.1) | FAIL |
| p10 MPS / fidelity non-regression | ≥ baseline − 2 | 100/100 vs 100/100 (pass) | pass |
| cost per rewrite | ≤ baseline × 1.2 | **$0.00917 vs $0.00373 (×2.46)** | FAIL |
| token budget | within bound | exceeded | FAIL |
| call failure rate | ≤ 5% | 6 hard failures (treatment arm) + 12 vs 9 number-safety | FAIL |

## Why the shadow picture did not transfer

The 11-fixture shadow (AI-heavy live-quality text) showed baseline echoing
while the treatment rewrote hard — preference 9/10, naturalness 4.9 vs 2.5.
The confirmatory corpus (8 real-world registers × 15) is mostly already
natural text: **both arms preserved it almost untouched** (mean ai_delta ≈ 0,
after-score ≈ 0.7–0.8, MPS/fidelity ≈ 100 on both sides). With two
near-identical candidates the blind judge was order-inconsistent on 83 of
105 eligible pairs — the preregistration's AB/BA consistency rule correctly
refused to mint preference evidence from indistinguishable pairs.

Structural readings, recorded honestly:

1. **No discriminating power on clean text.** A humanizer should not rewrite
   clean prose; on this corpus neither config did, and preference comparison
   degenerates. The 9/10 shadow was an artifact of AI-heavy fixtures plus a
   degenerate (echo) control arm, not a transferable quality signal.
2. **Treatment costs 2.46× for identical outcomes.** The diagnosis payload
   (~21.5k extra prompt tokens per call) bought nothing on clean text.
3. **Treatment tail risk is real.** 6 hard failures and 12 number-safety
   regressions vs the baseline's 9 — the safety-relevant asymmetry the
   shadow also hinted at (p10 dips on `public-docs`/`social`).

## Consequences

- Production default remains `iterative-baseline` — no action needed; the
  treatment was never shipped (`PATINA_KO_DIAGNOSIS_RESEARCH` stays
  research-only, unset in production).
- Per preregistration, this one-shot result stands; no re-run, no threshold
  change. Any future treatment (e.g. EA-derived texture-diversity and
  tail-preservation constraints) requires a new preregistration version and
  a fresh corpus binding.
- The measurement itself succeeded: amendment v2 (deepseek family map)
  produced a clean end-to-end run (0 harness errors, full 120-row
  accounting, gate evaluation exact).

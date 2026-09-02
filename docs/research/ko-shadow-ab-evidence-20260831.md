# KO shadow A/B evidence — 2026-08-31

> **Status note (2026-09-02, index pass):** advisory-only shadow evidence; the confirmatory run found the shadow picture did not transfer (`ko-confirmatory-verdict-20260901.md`, §"Why the shadow picture did not transfer").

Producer `deepseek-v4-flash` (HTTP, `reasoning_effort: low`, matching the
production free-tier setting at flip time) · Judge `codex-cli` (gpt-5.5,
independent family per amendment v2) · 11 KO live-quality fixtures ·
configs `iterative-baseline,ko-diagnosis-v1` · amendment v2 (deepseek family
map) applied before any result inspection.

## Apparatus eligibility (execution-plan step 4)

- outcomes: 10 judged / 0 inconsistent / 0 error / 1 none — error rate 0% (< 5%)
- scorer reliability: all grading calls completed inside the 300 s judge budget
- corpus binding verified: `23c546ab…fee3`, 120 rows (confirmatory set untouched)

**Eligible.** The confirmatory run may proceed under plan step 5.

## Shadow numbers (advisory only)

| | iterative-baseline | ko-diagnosis-v1 |
|---|---:|---:|
| blind preference | 1/10 | **9/10** (Wilson 95% 0.596–0.982) |
| naturalness (judge, 5pt) | 2.5 | **4.9** |
| register fit | 3.5 | 4.4 |
| AI-likeness after (mean) | 26.7 | **9.4** |
| MPS mean / p10 | 100 / 100 | 97.7 / 90 |
| fidelity mean / p10 | 100 / 100 | 96.2 / 83.3 |
| mean churn | 0.0 | 0.60 |
| cohort structure distance | 0.2 | 0.1 |
| p95 candidate latency | 172.7 s | 60.6 s |
| cost / rewrite | $0.0097 | $0.0109 (+12.5%, < 20% bound) |

## Two structural findings

1. **Baseline echo.** `iterative-baseline` on deepseek+low returned the input
   byte-identical (churn 0, untouched ratio 1.0) on 10 of 11 fixtures — only
   `public-docs` changed (churn 0.23). The preference comparison on this
   producer is therefore "real rewrite vs no rewrite". An echo preserves
   meaning perfectly, which makes the preregistered p10 non-regression gates
   structurally hard for any genuine rewriter on this engine.
2. **Tail regressions already visible.** Treatment's worst MPS/fidelity rows
   (`public-docs` 90/83.3, `social` 85/83.3) drive p10 below the +2-point
   non-regression band, and cohort structure distance fell (0.2 → 0.1),
   i.e. diagnosis-guided outputs converge on a house style. The harness's
   `promotion.failures` honestly lists `p10-mps`, `p10-fidelity`, and
   `cohort-structure` on this shadow.

## Decision

Proceed to the single preregistered `--confirmatory` run (plan step 5).
Shadow evidence predicts the preference gate passes and the p10/cohort gates
fail; if so, production stays on `iterative-baseline` per preregistration,
and the recorded answer is "treatment not promoted on this engine". The
baseline-echo caveat is recorded here so the confirmatory report is read
with the correct frame: on deepseek+low the control arm barely rewrites.

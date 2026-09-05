# Live rebaseline score distributions — September 5, 2026

All **85 approved texts produced valid score observations**, with zero observed errors. The complete captured-input replay passed without another model call.

This is the rebaseline companion to the [49-fixture live scorer report](live-scorer-20260905.md). It exercises production `scoreText` with an explicit Gemini 3.7 route through the loopback OpenCodex proxy. The [JSON companion](live-rebaseline-20260905.json) preserves full-precision statistics and integrity commitments.

## Input and measurement scope

The private intake contains 35 recorded model outputs and 50 publisher excerpts whose human authorship remains unverified. There are 17 English and 68 Korean texts. Selection and exact-text processing approvals preceded scoring. Source rights and quality labels remain unresolved; approval did not create human-negative or AI-positive ground truth.

Document type comes from the pinned configuration or an explicit intake declaration. Dataset genre is kept separate from the CLI delivery-register axis. No generator identity, source URL, old receipt, or quality label was sent as scoring evidence.

| Language | Valid / attempted | Overall mean / median / p95 | Raw LLM mean / median / p95 | Deterministic mean / median / p95 |
|---|---:|---:|---:|---:|
| ko | 68/68 | 1.717 / 0.000 / 11.110 | 1.717 / 0.000 / 11.110 | 5.882 / 0.000 / 50.000 |
| en | 17/17 | 1.205 / 0.000 / 4.760 | 1.205 / 0.000 / 4.760 | 3.024 / 0.000 / 50.000 |

## Pattern-pack distributions

These are recorded category scores, not individual-pattern accuracy. Missing values are counted rather than replaced with zero.

| Language | Pack | n | Missing | Mean | Median | p95 | Maximum |
|---|---|---:|---:|---:|---:|---:|---:|
| ko | communication | 68 | 0 | 0.000 | 0.000 | 0.000 | 0.000 |
| ko | content | 68 | 0 | 3.758 | 0.000 | 27.780 | 33.330 |
| ko | filler | 68 | 0 | 1.062 | 0.000 | 5.560 | 16.670 |
| ko | language | 68 | 0 | 1.962 | 0.000 | 16.670 | 16.670 |
| ko | structure | 68 | 0 | 1.569 | 0.000 | 6.700 | 26.670 |
| ko | style | 68 | 0 | 0.315 | 0.000 | 0.000 | 7.140 |
| ko | viral-hook | 68 | 0 | 3.105 | 0.000 | 22.220 | 27.800 |
| en | communication | 17 | 0 | 0.000 | 0.000 | 0.000 | 0.000 |
| en | content | 17 | 0 | 2.615 | 0.000 | 11.110 | 11.110 |
| en | filler | 17 | 0 | 1.308 | 0.000 | 5.560 | 5.560 |
| en | language | 17 | 0 | 0.327 | 0.000 | 5.560 | 5.560 |
| en | structure | 17 | 0 | 0.000 | 0.000 | 0.000 | 0.000 |
| en | style | 17 | 0 | 1.260 | 0.000 | 7.140 | 7.140 |
| en | viral-hook | 17 | 0 | 2.615 | 0.000 | 11.110 | 11.110 |

## Evidence and reproduction

Protocol: `9a7910f04362a408106e90d319ecb1242dde12b5776789ba7ed1855521e90e09`. Source commit: `a5bef6d20d4767b54757a4c338276f01ebfa7573`.

The frozen snapshot contains the exact configuration, patterns, lexicons, deterministic analyses, approved texts, expected prompts and request controls. Each observation has a bound wire record, scorer journal and complete production result. All 85 rows were replayed against those captured inputs; labels remained null and no replacement requests were issued.

The original approval and review bytes are retained privately. The public JSON exposes hashes and counts only. Raw texts, URLs, source records, prompts, responses and credentials are not published.

Use the [private collection runbook](../research/rebaseline-score-collection-20260905.md) from the recorded source commit with the frozen private output. `--replay` reads existing snapshots and receipts without a provider call; `--live` is a separate explicit opt-in.

## Limits

- No human ratings or authenticated authorship labels are present. FNR, FPR, AUC and human-quality metrics remain undefined.
- Texts from a shared source are dependent. These distributions support no population-confidence or independent-sample claim.
- A low score means fewer measured writing patterns under this configuration, not proof of human authorship.
- The recorded proxy route does not establish the upstream model revision, applied effort, internal retry count or actual charge.
- Public reproduction of the private text collection is not authorized by this report. Operators with the approved frozen bundle can replay the exact observations.
- This diagnostic run is not a mandatory CI score gate or a replacement for the deterministic benchmark.

Issue #412 now has actual fixture and rebaseline score distributions. The genuine-human and labelled short-form requirements tracked in #159 and #643 remain separate and unfinished.

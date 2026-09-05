# Live scorer diagnostics — September 5, 2026

930/931 valid rows across 6 completed matrices, 11 observed model identifiers, and 49 unique regression fixtures.

Partial evidence for #412. The fixture diagnostic deliverable is complete; do not claim its rebaseline scope is complete.

The production `src/scoring.js` `scoreText` path was used by the opt-in collector. This publication reads completed artifacts offline. It makes no provider calls.

## Reading the results

- **overall:** Recorded production scoreText overall, after deterministic reconciliation; valid rows only.
- **rawLLM:** Receipt-validated raw_overall; equals llm_overall on valid rows. Invalid schema values are excluded.
- **deterministic:** Recorded deterministic_overall on all observed rows, including scorer errors. No recomputation from hash-only resolved inputs.
- **patternPack:** Recorded category.score; omissions counted, never filled with zero. A pack score is not an individual pattern accuracy.
- **distribution:** Finite values only; median averages the middle pair; p95 is nearest-rank ceil(0.95*n); unrounded JSON statistics.

Scores range from 0 to 100; larger values mean more detected writing patterns. A candidate mean is not a measure of scorer quality.

The JSON companion preserves full-precision distributions, per-repeat and fixture-control slices, paired repeat differences, original protocol IDs, and source/receipt integrity commitments. All model names below are observed OpenCodex identifiers.

## Validity and score distributions

| Cohort | Candidate | Valid / expected | Errors | Overall median / mean | Raw LLM median / mean | Deterministic n / mean | Adjusted rows |
|---|---|---:|---:|---:|---:|---:|---:|
| A/scorer-openai | openai-astra | 49/49 | 0 | 0.44 / 6.57 | 0.44 / 4.67 | 49 / 53.06 | 1 |
| A/scorer-openai | openai-sol | 49/49 | 0 | 3.70 / 11.18 | 3.70 / 9.42 | 49 / 53.06 | 1 |
| A/scorer-openai | openai-terra | 49/49 | 0 | 2.00 / 7.99 | 2.00 / 6.04 | 49 / 53.06 | 1 |
| A/scorer-openai | openai-luna | 48/49 | 1 | 2.41 / 7.30 | 2.41 / 5.35 | 49 / 53.06 | 1 |
| A/scorer-openai | openai-5.5 | 49/49 | 0 | 6.00 / 11.60 | 6.00 / 9.84 | 49 / 53.06 | 1 |
| A/scorer-openai | openai-mini | 49/49 | 0 | 1.00 / 5.27 | 1.00 / 3.28 | 49 / 53.06 | 1 |
| A/scorer-gemini | gemini-pro | 49/49 | 0 | 3.55 / 10.70 | 3.55 / 8.86 | 49 / 53.06 | 1 |
| A/scorer-gemini | gemini-3.7 | 49/49 | 0 | 0.00 / 5.09 | 0.00 / 3.21 | 49 / 53.06 | 1 |
| A/scorer-gemini | gemini-3.8-low | 49/49 | 0 | 0.00 / 6.55 | 0.00 / 4.75 | 49 / 53.06 | 1 |
| A/scorer-gemini | gemini-3.8-medium | 49/49 | 0 | 0.00 / 5.34 | 0.00 / 3.50 | 49 / 53.06 | 1 |
| A/scorer-gemini | gemini-3.8-high | 49/49 | 0 | 0.00 / 5.36 | 0.00 / 3.51 | 49 / 53.06 | 1 |
| A/scorer-gemini-low-confirm | gemini-3.8-low | 98/98 | 0 | 0.00 / 5.28 | 0.00 / 3.44 | 98 / 53.06 | 2 |
| A/scorer-gemini-pro-confirm | gemini-pro | 98/98 | 0 | 3.04 / 10.81 | 3.04 / 9.00 | 98 / 53.06 | 2 |
| C/scorer-openai-terra-confirm | openai-terra | 98/98 | 0 | 2.00 / 7.92 | 2.00 / 5.95 | 98 / 53.06 | 2 |
| C/scorer-openai-5.5-confirm | openai-5.5 | 98/98 | 0 | 4.20 / 10.83 | 4.20 / 9.05 | 98 / 53.06 | 2 |

## Errors and arithmetic diagnostics

Validity uses the original collector schema. The arithmetic checks count category scores differing from `100 × sum / max`, and overall scores differing from the sum of category weights, by more than 0.11 points. They do not reclassify valid rows. These are diagnostic counts, not model rankings.

| Cohort | Schema-failed rows | Transport-failed rows | Category arithmetic mismatches | Overall weighted-sum mismatches |
|---|---:|---:|---:|---:|
| scorer-openai | 1 | 0 | 2 | 0 |
| scorer-gemini | 0 | 0 | 4 | 1 |
| scorer-gemini-low-confirm | 0 | 0 | 0 | 0 |
| scorer-gemini-pro-confirm | 0 | 0 | 32 | 7 |
| scorer-openai-terra-confirm | 0 | 0 | 0 | 0 |
| scorer-openai-5.5-confirm | 0 | 0 | 0 | 0 |

## Language distributions

| Cohort / candidate | Language | Valid / observed | Overall n / mean / median / p95 | Raw LLM n / mean / median / p95 | Deterministic n / mean / median / p95 |
|---|---|---:|---:|---:|---:|
| scorer-openai/openai-astra | en | 13/13 | 13 / 8.25 / 0.00 / 100.00 | 13 / 1.08 / 0.00 / 6.76 | 13 / 53.85 / 100.00 / 100.00 |
| scorer-openai/openai-astra | ko | 12/12 | 12 / 3.87 / 1.50 / 12.02 | 12 / 3.87 / 1.50 / 12.02 | 12 / 58.33 / 100.00 / 100.00 |
| scorer-openai/openai-astra | zh | 12/12 | 12 / 7.35 / 0.56 / 29.81 | 12 / 7.35 / 0.56 / 29.81 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-openai/openai-astra | ja | 12/12 | 12 / 6.68 / 0.50 / 25.24 | 12 / 6.68 / 0.50 / 25.24 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-openai/openai-sol | en | 13/13 | 13 / 12.25 / 2.40 / 100.00 | 13 / 5.64 / 2.40 / 19.30 | 13 / 53.85 / 100.00 / 100.00 |
| scorer-openai/openai-sol | ko | 12/12 | 12 / 10.37 / 10.10 / 29.10 | 12 / 10.37 / 10.10 / 29.10 | 12 / 58.33 / 100.00 / 100.00 |
| scorer-openai/openai-sol | zh | 12/12 | 12 / 11.83 / 5.85 / 33.40 | 12 / 11.83 / 5.85 / 33.40 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-openai/openai-sol | ja | 12/12 | 12 / 10.18 / 2.50 / 35.50 | 12 / 10.18 / 2.50 / 35.50 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-openai/openai-terra | en | 13/13 | 13 / 9.95 / 1.70 / 100.00 | 13 / 2.59 / 1.70 / 7.90 | 13 / 53.85 / 100.00 / 100.00 |
| scorer-openai/openai-terra | ko | 12/12 | 12 / 5.67 / 3.00 / 20.60 | 12 / 5.67 / 3.00 / 20.60 | 12 / 58.33 / 100.00 / 100.00 |
| scorer-openai/openai-terra | zh | 12/12 | 12 / 7.30 / 1.83 / 24.90 | 12 / 7.30 / 1.83 / 24.90 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-openai/openai-terra | ja | 12/12 | 12 / 8.90 / 2.00 / 29.90 | 12 / 8.90 / 2.00 / 29.90 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-openai/openai-luna | en | 13/13 | 13 / 10.67 / 3.30 / 100.00 | 13 / 3.49 / 3.30 / 11.30 | 13 / 53.85 / 100.00 / 100.00 |
| scorer-openai/openai-luna | ko | 11/12 | 11 / 4.36 / 2.11 / 18.48 | 11 / 4.36 / 2.11 / 18.48 | 12 / 58.33 / 100.00 / 100.00 |
| scorer-openai/openai-luna | zh | 12/12 | 12 / 6.46 / 1.79 / 22.30 | 12 / 6.46 / 1.79 / 22.30 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-openai/openai-luna | ja | 12/12 | 12 / 7.18 / 3.20 / 21.90 | 12 / 7.18 / 3.20 / 21.90 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-openai/openai-5.5 | en | 13/13 | 13 / 13.95 / 5.90 / 100.00 | 13 / 7.34 / 5.90 / 23.80 | 13 / 53.85 / 100.00 / 100.00 |
| scorer-openai/openai-5.5 | ko | 12/12 | 12 / 12.06 / 8.87 / 34.50 | 12 / 12.06 / 8.87 / 34.50 | 12 / 58.33 / 100.00 / 100.00 |
| scorer-openai/openai-5.5 | zh | 12/12 | 12 / 10.54 / 4.10 / 37.10 | 12 / 10.54 / 4.10 / 37.10 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-openai/openai-5.5 | ja | 12/12 | 12 / 9.63 / 4.50 / 31.60 | 12 / 9.63 / 4.50 / 31.60 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-openai/openai-mini | en | 13/13 | 13 / 9.54 / 1.11 / 100.00 | 13 / 2.04 / 1.11 / 7.40 | 13 / 53.85 / 100.00 / 100.00 |
| scorer-openai/openai-mini | ko | 12/12 | 12 / 4.42 / 4.14 / 17.30 | 12 / 4.42 / 4.14 / 17.30 | 12 / 58.33 / 100.00 / 100.00 |
| scorer-openai/openai-mini | zh | 12/12 | 12 / 4.61 / 0.50 / 18.60 | 12 / 4.61 / 0.50 / 18.60 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-openai/openai-mini | ja | 12/12 | 12 / 2.17 / 0.00 / 9.90 | 12 / 2.17 / 0.00 / 9.90 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-gemini/gemini-pro | en | 13/13 | 13 / 10.82 / 0.00 / 100.00 | 13 / 3.88 / 0.00 / 18.00 | 13 / 53.85 / 100.00 / 100.00 |
| scorer-gemini/gemini-pro | ko | 12/12 | 12 / 9.33 / 4.88 / 31.81 | 12 / 9.33 / 4.88 / 31.81 | 12 / 58.33 / 100.00 / 100.00 |
| scorer-gemini/gemini-pro | zh | 12/12 | 12 / 13.29 / 5.07 / 40.58 | 12 / 13.29 / 5.07 / 40.58 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-gemini/gemini-pro | ja | 12/12 | 12 / 9.35 / 4.70 / 35.24 | 12 / 9.35 / 4.70 / 35.24 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-gemini/gemini-3.7 | en | 13/13 | 13 / 7.91 / 0.00 / 100.00 | 13 / 0.83 / 0.00 / 7.86 | 13 / 53.85 / 100.00 / 100.00 |
| scorer-gemini/gemini-3.7 | ko | 12/12 | 12 / 2.68 / 0.00 / 13.01 | 12 / 2.68 / 0.00 / 13.01 | 12 / 58.33 / 100.00 / 100.00 |
| scorer-gemini/gemini-3.7 | zh | 12/12 | 12 / 5.15 / 0.00 / 21.92 | 12 / 5.15 / 0.00 / 21.92 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-gemini/gemini-3.7 | ja | 12/12 | 12 / 4.40 / 0.00 / 15.93 | 12 / 4.40 / 0.00 / 15.93 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-gemini/gemini-3.8-low | en | 13/13 | 13 / 7.79 / 0.00 / 100.00 | 13 / 1.01 / 0.00 / 11.74 | 13 / 53.85 / 100.00 / 100.00 |
| scorer-gemini/gemini-3.8-low | ko | 12/12 | 12 / 2.92 / 0.00 / 12.50 | 12 / 2.92 / 0.00 / 12.50 | 12 / 58.33 / 100.00 / 100.00 |
| scorer-gemini/gemini-3.8-low | zh | 12/12 | 12 / 9.11 / 0.28 / 38.04 | 12 / 9.11 / 0.28 / 38.04 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-gemini/gemini-3.8-low | ja | 12/12 | 12 / 6.26 / 0.00 / 31.35 | 12 / 6.26 / 0.00 / 31.35 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-gemini/gemini-3.8-medium | en | 13/13 | 13 / 8.00 / 0.00 / 100.00 | 13 / 1.08 / 0.00 / 10.08 | 13 / 53.85 / 100.00 / 100.00 |
| scorer-gemini/gemini-3.8-medium | ko | 12/12 | 12 / 2.68 / 0.00 / 9.60 | 12 / 2.68 / 0.00 / 9.60 | 12 / 58.33 / 100.00 / 100.00 |
| scorer-gemini/gemini-3.8-medium | zh | 12/12 | 12 / 5.46 / 0.00 / 27.47 | 12 / 5.46 / 0.00 / 27.47 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-gemini/gemini-3.8-medium | ja | 12/12 | 12 / 4.98 / 0.00 / 21.79 | 12 / 4.98 / 0.00 / 21.79 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-gemini/gemini-3.8-high | en | 13/13 | 13 / 7.83 / 0.00 / 100.00 | 13 / 0.83 / 0.00 / 9.00 | 13 / 53.85 / 100.00 / 100.00 |
| scorer-gemini/gemini-3.8-high | ko | 12/12 | 12 / 2.96 / 0.00 / 11.00 | 12 / 2.96 / 0.00 / 11.00 | 12 / 58.33 / 100.00 / 100.00 |
| scorer-gemini/gemini-3.8-high | zh | 12/12 | 12 / 4.94 / 0.00 / 20.48 | 12 / 4.94 / 0.00 / 20.48 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-gemini/gemini-3.8-high | ja | 12/12 | 12 / 5.53 / 0.00 / 24.46 | 12 / 5.53 / 0.00 / 24.46 | 12 / 50.00 / 50.00 / 100.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | en | 26/26 | 26 / 7.74 / 0.00 / 100.00 | 26 / 0.78 / 0.00 / 7.86 | 26 / 53.85 / 100.00 / 100.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | ko | 24/24 | 24 / 2.73 / 0.00 / 9.01 | 24 / 2.73 / 0.00 / 9.01 | 24 / 58.33 / 100.00 / 100.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | zh | 24/24 | 24 / 5.31 / 0.00 / 25.36 | 24 / 5.31 / 0.00 / 25.36 | 24 / 50.00 / 50.00 / 100.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | ja | 24/24 | 24 / 5.14 / 0.00 / 20.00 | 24 / 5.14 / 0.00 / 20.00 | 24 / 50.00 / 50.00 / 100.00 |
| scorer-gemini-pro-confirm/gemini-pro | en | 26/26 | 26 / 11.17 / 2.38 / 100.00 | 26 / 4.36 / 2.38 / 16.00 | 26 / 53.85 / 100.00 / 100.00 |
| scorer-gemini-pro-confirm/gemini-pro | ko | 24/24 | 24 / 8.41 / 6.07 / 21.81 | 24 / 8.41 / 6.07 / 21.81 | 24 / 58.33 / 100.00 / 100.00 |
| scorer-gemini-pro-confirm/gemini-pro | zh | 24/24 | 24 / 13.07 / 1.65 / 41.83 | 24 / 13.07 / 1.65 / 41.83 | 24 / 50.00 / 50.00 / 100.00 |
| scorer-gemini-pro-confirm/gemini-pro | ja | 24/24 | 24 / 10.55 / 3.65 / 36.25 | 24 / 10.55 / 3.65 / 36.25 | 24 / 50.00 / 50.00 / 100.00 |
| scorer-openai-terra-confirm/openai-terra | en | 26/26 | 26 / 10.27 / 2.40 / 100.00 | 26 / 2.84 / 2.40 / 8.44 | 26 / 53.85 / 100.00 / 100.00 |
| scorer-openai-terra-confirm/openai-terra | ko | 24/24 | 24 / 5.26 / 2.00 / 17.30 | 24 / 5.26 / 2.00 / 17.30 | 24 / 58.33 / 100.00 / 100.00 |
| scorer-openai-terra-confirm/openai-terra | zh | 24/24 | 24 / 8.51 / 1.60 / 30.25 | 24 / 8.51 / 1.60 / 30.25 | 24 / 50.00 / 50.00 / 100.00 |
| scorer-openai-terra-confirm/openai-terra | ja | 24/24 | 24 / 7.44 / 1.50 / 26.40 | 24 / 7.44 / 1.50 / 26.40 | 24 / 50.00 / 50.00 / 100.00 |
| scorer-openai-5.5-confirm/openai-5.5 | en | 26/26 | 26 / 12.26 / 3.65 / 100.00 | 26 / 5.56 / 3.65 / 15.00 | 26 / 53.85 / 100.00 / 100.00 |
| scorer-openai-5.5-confirm/openai-5.5 | ko | 24/24 | 24 / 9.88 / 7.15 / 27.50 | 24 / 9.88 / 7.15 / 27.50 | 24 / 58.33 / 100.00 / 100.00 |
| scorer-openai-5.5-confirm/openai-5.5 | zh | 24/24 | 24 / 10.27 / 1.55 / 31.80 | 24 / 10.27 / 1.55 / 31.80 | 24 / 50.00 / 50.00 / 100.00 |
| scorer-openai-5.5-confirm/openai-5.5 | ja | 24/24 | 24 / 10.80 / 4.65 / 31.10 | 24 / 10.80 / 4.65 / 31.10 | 24 / 50.00 / 50.00 / 100.00 |

## Pattern-pack distributions

Each value is the category score from a valid response. Missing packs remain missing. Repeated rows do not increase the unique fixture count.

| Cohort / candidate | Language / pack | n / valid rows | Missing | Min | Median | Mean | p95 | Max |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| scorer-openai/openai-astra | en/communication | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-astra | en/content | 13/13 | 0 | 0.00 | 0.00 | 1.71 | 11.11 | 11.11 |
| scorer-openai/openai-astra | en/filler | 13/13 | 0 | 0.00 | 0.00 | 1.71 | 16.67 | 16.67 |
| scorer-openai/openai-astra | en/language | 13/13 | 0 | 0.00 | 0.00 | 1.28 | 11.11 | 11.11 |
| scorer-openai/openai-astra | en/structure | 13/13 | 0 | 0.00 | 0.00 | 1.03 | 6.67 | 6.67 |
| scorer-openai/openai-astra | en/style | 13/13 | 0 | 0.00 | 0.00 | 0.55 | 7.14 | 7.14 |
| scorer-openai/openai-astra | en/viral-hook | 13/13 | 0 | 0.00 | 0.00 | 1.28 | 11.11 | 11.11 |
| scorer-openai/openai-astra | ko/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-astra | ko/content | 12/12 | 0 | 0.00 | 0.00 | 3.24 | 11.11 | 11.11 |
| scorer-openai/openai-astra | ko/filler | 12/12 | 0 | 0.00 | 0.00 | 1.39 | 5.56 | 5.56 |
| scorer-openai/openai-astra | ko/language | 12/12 | 0 | 0.00 | 0.00 | 4.17 | 11.11 | 11.11 |
| scorer-openai/openai-astra | ko/structure | 12/12 | 0 | 0.00 | 0.00 | 8.33 | 33.33 | 33.33 |
| scorer-openai/openai-astra | ko/style | 12/12 | 0 | 0.00 | 0.00 | 6.55 | 21.43 | 21.43 |
| scorer-openai/openai-astra | ko/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-astra | zh/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-astra | zh/content | 12/12 | 0 | 0.00 | 0.00 | 10.19 | 55.56 | 55.56 |
| scorer-openai/openai-astra | zh/filler | 12/12 | 0 | 0.00 | 0.00 | 12.04 | 50.00 | 50.00 |
| scorer-openai/openai-astra | zh/language | 12/12 | 0 | 0.00 | 0.00 | 13.43 | 50.00 | 50.00 |
| scorer-openai/openai-astra | zh/structure | 12/12 | 0 | 0.00 | 0.00 | 3.33 | 20.00 | 20.00 |
| scorer-openai/openai-astra | zh/style | 12/12 | 0 | 0.00 | 0.00 | 8.33 | 28.57 | 28.57 |
| scorer-openai/openai-astra | zh/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 1.39 | 11.11 | 11.11 |
| scorer-openai/openai-astra | ja/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-astra | ja/content | 12/12 | 0 | 0.00 | 0.00 | 16.67 | 61.11 | 61.11 |
| scorer-openai/openai-astra | ja/filler | 12/12 | 0 | 0.00 | 0.00 | 8.80 | 44.44 | 44.44 |
| scorer-openai/openai-astra | ja/language | 12/12 | 0 | 0.00 | 0.00 | 6.48 | 44.44 | 44.44 |
| scorer-openai/openai-astra | ja/structure | 12/12 | 0 | 0.00 | 3.33 | 7.78 | 33.33 | 33.33 |
| scorer-openai/openai-astra | ja/style | 12/12 | 0 | 0.00 | 0.00 | 3.57 | 14.29 | 14.29 |
| scorer-openai/openai-astra | ja/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-sol | en/communication | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-sol | en/content | 13/13 | 0 | 0.00 | 0.00 | 7.70 | 33.30 | 33.30 |
| scorer-openai/openai-sol | en/filler | 13/13 | 0 | 0.00 | 5.60 | 7.70 | 44.40 | 44.40 |
| scorer-openai/openai-sol | en/language | 13/13 | 0 | 0.00 | 5.60 | 8.13 | 27.80 | 27.80 |
| scorer-openai/openai-sol | en/structure | 13/13 | 0 | 0.00 | 13.30 | 12.30 | 46.70 | 46.70 |
| scorer-openai/openai-sol | en/style | 13/13 | 0 | 0.00 | 0.00 | 1.65 | 14.30 | 14.30 |
| scorer-openai/openai-sol | en/viral-hook | 13/13 | 0 | 0.00 | 0.00 | 3.00 | 11.10 | 11.10 |
| scorer-openai/openai-sol | ko/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-sol | ko/content | 12/12 | 0 | 0.00 | 5.55 | 9.72 | 38.90 | 38.90 |
| scorer-openai/openai-sol | ko/filler | 12/12 | 0 | 0.00 | 0.00 | 5.55 | 33.30 | 33.30 |
| scorer-openai/openai-sol | ko/language | 12/12 | 0 | 0.00 | 8.35 | 13.42 | 44.40 | 44.40 |
| scorer-openai/openai-sol | ko/structure | 12/12 | 0 | 0.00 | 16.65 | 18.32 | 53.30 | 53.30 |
| scorer-openai/openai-sol | ko/style | 12/12 | 0 | 0.00 | 10.70 | 14.88 | 42.90 | 42.90 |
| scorer-openai/openai-sol | ko/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 3.25 | 11.10 | 11.10 |
| scorer-openai/openai-sol | zh/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-sol | zh/content | 12/12 | 0 | 0.00 | 0.00 | 12.96 | 44.40 | 44.40 |
| scorer-openai/openai-sol | zh/filler | 12/12 | 0 | 0.00 | 0.00 | 14.35 | 61.10 | 61.10 |
| scorer-openai/openai-sol | zh/language | 12/12 | 0 | 0.00 | 11.15 | 20.83 | 61.10 | 61.10 |
| scorer-openai/openai-sol | zh/structure | 12/12 | 0 | 0.00 | 6.65 | 14.43 | 53.30 | 53.30 |
| scorer-openai/openai-sol | zh/style | 12/12 | 0 | 0.00 | 7.15 | 11.92 | 28.60 | 28.60 |
| scorer-openai/openai-sol | zh/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 2.78 | 11.10 | 11.10 |
| scorer-openai/openai-sol | ja/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-sol | ja/content | 12/12 | 0 | 0.00 | 0.00 | 15.74 | 72.20 | 72.20 |
| scorer-openai/openai-sol | ja/filler | 12/12 | 0 | 0.00 | 0.00 | 12.04 | 55.60 | 55.60 |
| scorer-openai/openai-sol | ja/language | 12/12 | 0 | 0.00 | 5.60 | 13.42 | 44.40 | 44.40 |
| scorer-openai/openai-sol | ja/structure | 12/12 | 0 | 0.00 | 10.00 | 15.00 | 46.70 | 46.70 |
| scorer-openai/openai-sol | ja/style | 12/12 | 0 | 0.00 | 0.00 | 5.96 | 28.60 | 28.60 |
| scorer-openai/openai-sol | ja/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 6.47 | 33.30 | 33.30 |
| scorer-openai/openai-terra | en/communication | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-terra | en/content | 13/13 | 0 | 0.00 | 0.00 | 2.58 | 11.10 | 11.10 |
| scorer-openai/openai-terra | en/filler | 13/13 | 0 | 0.00 | 0.00 | 3.42 | 33.30 | 33.30 |
| scorer-openai/openai-terra | en/language | 13/13 | 0 | 0.00 | 5.60 | 5.15 | 22.20 | 22.20 |
| scorer-openai/openai-terra | en/structure | 13/13 | 0 | 0.00 | 0.00 | 6.15 | 20.00 | 20.00 |
| scorer-openai/openai-terra | en/style | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-terra | en/viral-hook | 13/13 | 0 | 0.00 | 0.00 | 1.72 | 11.10 | 11.10 |
| scorer-openai/openai-terra | ko/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-terra | ko/content | 12/12 | 0 | 0.00 | 0.00 | 5.57 | 16.70 | 16.70 |
| scorer-openai/openai-terra | ko/filler | 12/12 | 0 | 0.00 | 0.00 | 2.32 | 16.70 | 16.70 |
| scorer-openai/openai-terra | ko/language | 12/12 | 0 | 0.00 | 2.80 | 6.48 | 22.20 | 22.20 |
| scorer-openai/openai-terra | ko/structure | 12/12 | 0 | 0.00 | 3.35 | 10.00 | 33.30 | 33.30 |
| scorer-openai/openai-terra | ko/style | 12/12 | 0 | 0.00 | 0.00 | 9.53 | 42.90 | 42.90 |
| scorer-openai/openai-terra | ko/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.93 | 5.60 | 5.60 |
| scorer-openai/openai-terra | zh/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-terra | zh/content | 12/12 | 0 | 0.00 | 0.00 | 9.26 | 50.00 | 50.00 |
| scorer-openai/openai-terra | zh/filler | 12/12 | 0 | 0.00 | 0.00 | 5.55 | 22.20 | 22.20 |
| scorer-openai/openai-terra | zh/language | 12/12 | 0 | 0.00 | 0.00 | 12.50 | 44.44 | 44.44 |
| scorer-openai/openai-terra | zh/structure | 12/12 | 0 | 0.00 | 0.00 | 6.11 | 26.70 | 26.70 |
| scorer-openai/openai-terra | zh/style | 12/12 | 0 | 0.00 | 7.14 | 10.72 | 28.60 | 28.60 |
| scorer-openai/openai-terra | zh/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.92 | 11.10 | 11.10 |
| scorer-openai/openai-terra | ja/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-terra | ja/content | 12/12 | 0 | 0.00 | 0.00 | 15.74 | 66.67 | 66.67 |
| scorer-openai/openai-terra | ja/filler | 12/12 | 0 | 0.00 | 0.00 | 9.26 | 38.89 | 38.89 |
| scorer-openai/openai-terra | ja/language | 12/12 | 0 | 0.00 | 2.80 | 11.12 | 55.60 | 55.60 |
| scorer-openai/openai-terra | ja/structure | 12/12 | 0 | 0.00 | 3.35 | 10.56 | 40.00 | 40.00 |
| scorer-openai/openai-terra | ja/style | 12/12 | 0 | 0.00 | 0.00 | 7.15 | 28.60 | 28.60 |
| scorer-openai/openai-terra | ja/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 4.63 | 22.22 | 22.22 |
| scorer-openai/openai-luna | en/communication | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-luna | en/content | 13/13 | 0 | 0.00 | 0.00 | 5.56 | 33.30 | 33.30 |
| scorer-openai/openai-luna | en/filler | 13/13 | 0 | 0.00 | 5.56 | 4.29 | 22.20 | 22.20 |
| scorer-openai/openai-luna | en/language | 13/13 | 0 | 0.00 | 3.70 | 4.98 | 22.20 | 22.20 |
| scorer-openai/openai-luna | en/structure | 13/13 | 0 | 0.00 | 0.00 | 4.63 | 26.70 | 26.70 |
| scorer-openai/openai-luna | en/style | 13/13 | 0 | 0.00 | 0.00 | 2.01 | 9.50 | 9.50 |
| scorer-openai/openai-luna | en/viral-hook | 13/13 | 0 | 0.00 | 0.00 | 1.85 | 11.10 | 11.10 |
| scorer-openai/openai-luna | ko/communication | 11/11 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-luna | ko/content | 11/11 | 0 | 0.00 | 0.00 | 3.54 | 16.70 | 16.70 |
| scorer-openai/openai-luna | ko/filler | 11/11 | 0 | 0.00 | 5.56 | 4.55 | 16.67 | 16.67 |
| scorer-openai/openai-luna | ko/language | 11/11 | 0 | 0.00 | 3.70 | 5.90 | 33.33 | 33.33 |
| scorer-openai/openai-luna | ko/structure | 11/11 | 0 | 0.00 | 0.00 | 8.48 | 33.33 | 33.33 |
| scorer-openai/openai-luna | ko/style | 11/11 | 0 | 0.00 | 0.00 | 5.19 | 28.57 | 28.57 |
| scorer-openai/openai-luna | ko/viral-hook | 11/11 | 0 | 0.00 | 0.00 | 0.85 | 5.60 | 5.60 |
| scorer-openai/openai-luna | zh/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-luna | zh/content | 12/12 | 0 | 0.00 | 0.00 | 6.48 | 38.90 | 38.90 |
| scorer-openai/openai-luna | zh/filler | 12/12 | 0 | 0.00 | 0.00 | 5.56 | 27.80 | 27.80 |
| scorer-openai/openai-luna | zh/language | 12/12 | 0 | 0.00 | 0.00 | 10.18 | 44.44 | 44.44 |
| scorer-openai/openai-luna | zh/structure | 12/12 | 0 | 0.00 | 3.33 | 7.78 | 26.70 | 26.70 |
| scorer-openai/openai-luna | zh/style | 12/12 | 0 | 0.00 | 3.57 | 9.53 | 28.60 | 28.60 |
| scorer-openai/openai-luna | zh/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 1.39 | 11.11 | 11.11 |
| scorer-openai/openai-luna | ja/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-luna | ja/content | 12/12 | 0 | 0.00 | 0.00 | 12.03 | 44.40 | 44.40 |
| scorer-openai/openai-luna | ja/filler | 12/12 | 0 | 0.00 | 0.00 | 8.80 | 33.33 | 33.33 |
| scorer-openai/openai-luna | ja/language | 12/12 | 0 | 0.00 | 5.60 | 12.50 | 33.30 | 33.30 |
| scorer-openai/openai-luna | ja/structure | 12/12 | 0 | 0.00 | 3.33 | 8.88 | 33.30 | 33.30 |
| scorer-openai/openai-luna | ja/style | 12/12 | 0 | 0.00 | 0.00 | 3.57 | 14.30 | 14.30 |
| scorer-openai/openai-luna | ja/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 1.39 | 11.10 | 11.10 |
| scorer-openai/openai-5.5 | en/communication | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-5.5 | en/content | 13/13 | 0 | 0.00 | 5.60 | 10.28 | 50.00 | 50.00 |
| scorer-openai/openai-5.5 | en/filler | 13/13 | 0 | 0.00 | 5.56 | 5.99 | 22.20 | 22.20 |
| scorer-openai/openai-5.5 | en/language | 13/13 | 0 | 0.00 | 11.10 | 11.12 | 38.90 | 38.90 |
| scorer-openai/openai-5.5 | en/structure | 13/13 | 0 | 0.00 | 6.70 | 11.80 | 46.70 | 46.70 |
| scorer-openai/openai-5.5 | en/style | 13/13 | 0 | 0.00 | 0.00 | 4.38 | 21.40 | 21.40 |
| scorer-openai/openai-5.5 | en/viral-hook | 13/13 | 0 | 0.00 | 5.56 | 5.14 | 16.70 | 16.70 |
| scorer-openai/openai-5.5 | ko/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-5.5 | ko/content | 12/12 | 0 | 0.00 | 2.80 | 14.82 | 50.00 | 50.00 |
| scorer-openai/openai-5.5 | ko/filler | 12/12 | 0 | 0.00 | 5.60 | 8.81 | 27.80 | 27.80 |
| scorer-openai/openai-5.5 | ko/language | 12/12 | 0 | 0.00 | 11.11 | 14.35 | 38.90 | 38.90 |
| scorer-openai/openai-5.5 | ko/structure | 12/12 | 0 | 0.00 | 16.65 | 20.55 | 60.00 | 60.00 |
| scorer-openai/openai-5.5 | ko/style | 12/12 | 0 | 0.00 | 10.71 | 16.08 | 42.90 | 42.90 |
| scorer-openai/openai-5.5 | ko/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 1.40 | 5.60 | 5.60 |
| scorer-openai/openai-5.5 | zh/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-5.5 | zh/content | 12/12 | 0 | 0.00 | 0.00 | 10.18 | 44.40 | 44.40 |
| scorer-openai/openai-5.5 | zh/filler | 12/12 | 0 | 0.00 | 0.00 | 12.50 | 55.60 | 55.60 |
| scorer-openai/openai-5.5 | zh/language | 12/12 | 0 | 0.00 | 8.35 | 19.91 | 77.80 | 77.80 |
| scorer-openai/openai-5.5 | zh/structure | 12/12 | 0 | 0.00 | 6.65 | 12.78 | 40.00 | 40.00 |
| scorer-openai/openai-5.5 | zh/style | 12/12 | 0 | 0.00 | 7.15 | 10.72 | 28.60 | 28.60 |
| scorer-openai/openai-5.5 | zh/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 2.78 | 11.10 | 11.10 |
| scorer-openai/openai-5.5 | ja/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-5.5 | ja/content | 12/12 | 0 | 0.00 | 0.00 | 16.20 | 66.70 | 66.70 |
| scorer-openai/openai-5.5 | ja/filler | 12/12 | 0 | 0.00 | 0.00 | 9.72 | 38.90 | 38.90 |
| scorer-openai/openai-5.5 | ja/language | 12/12 | 0 | 0.00 | 8.35 | 15.28 | 55.60 | 55.60 |
| scorer-openai/openai-5.5 | ja/structure | 12/12 | 0 | 0.00 | 6.65 | 13.33 | 33.30 | 33.30 |
| scorer-openai/openai-5.5 | ja/style | 12/12 | 0 | 0.00 | 0.00 | 4.75 | 21.40 | 21.40 |
| scorer-openai/openai-5.5 | ja/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 3.25 | 16.70 | 16.70 |
| scorer-openai/openai-mini | en/communication | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-mini | en/content | 13/13 | 0 | 0.00 | 0.00 | 2.57 | 22.22 | 22.22 |
| scorer-openai/openai-mini | en/filler | 13/13 | 0 | 0.00 | 0.00 | 2.56 | 16.67 | 16.67 |
| scorer-openai/openai-mini | en/language | 13/13 | 0 | 0.00 | 0.00 | 5.56 | 27.80 | 27.80 |
| scorer-openai/openai-mini | en/structure | 13/13 | 0 | 0.00 | 0.00 | 2.05 | 13.30 | 13.30 |
| scorer-openai/openai-mini | en/style | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-mini | en/viral-hook | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-mini | ko/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-mini | ko/content | 12/12 | 0 | 0.00 | 0.00 | 1.86 | 11.11 | 11.11 |
| scorer-openai/openai-mini | ko/filler | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-mini | ko/language | 12/12 | 0 | 0.00 | 5.56 | 7.40 | 22.20 | 22.20 |
| scorer-openai/openai-mini | ko/structure | 12/12 | 0 | 0.00 | 9.98 | 8.33 | 20.00 | 20.00 |
| scorer-openai/openai-mini | ko/style | 12/12 | 0 | 0.00 | 0.00 | 8.33 | 57.10 | 57.10 |
| scorer-openai/openai-mini | ko/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-mini | zh/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-mini | zh/content | 12/12 | 0 | 0.00 | 0.00 | 5.09 | 27.80 | 27.80 |
| scorer-openai/openai-mini | zh/filler | 12/12 | 0 | 0.00 | 0.00 | 4.63 | 22.22 | 22.22 |
| scorer-openai/openai-mini | zh/language | 12/12 | 0 | 0.00 | 0.00 | 7.86 | 33.30 | 33.30 |
| scorer-openai/openai-mini | zh/structure | 12/12 | 0 | 0.00 | 0.00 | 5.56 | 20.00 | 20.00 |
| scorer-openai/openai-mini | zh/style | 12/12 | 0 | 0.00 | 0.00 | 5.95 | 23.80 | 23.80 |
| scorer-openai/openai-mini | zh/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-mini | ja/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai/openai-mini | ja/content | 12/12 | 0 | 0.00 | 0.00 | 4.64 | 22.22 | 22.22 |
| scorer-openai/openai-mini | ja/filler | 12/12 | 0 | 0.00 | 0.00 | 4.63 | 22.20 | 22.20 |
| scorer-openai/openai-mini | ja/language | 12/12 | 0 | 0.00 | 0.00 | 2.32 | 11.11 | 11.11 |
| scorer-openai/openai-mini | ja/structure | 12/12 | 0 | 0.00 | 0.00 | 2.23 | 13.30 | 13.30 |
| scorer-openai/openai-mini | ja/style | 12/12 | 0 | 0.00 | 0.00 | 1.19 | 14.29 | 14.29 |
| scorer-openai/openai-mini | ja/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-pro | en/communication | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-pro | en/content | 13/13 | 0 | 0.00 | 0.00 | 4.27 | 38.89 | 38.89 |
| scorer-gemini/gemini-pro | en/filler | 13/13 | 0 | 0.00 | 0.00 | 3.42 | 16.67 | 16.67 |
| scorer-gemini/gemini-pro | en/language | 13/13 | 0 | 0.00 | 0.00 | 8.12 | 27.78 | 27.78 |
| scorer-gemini/gemini-pro | en/structure | 13/13 | 0 | 0.00 | 0.00 | 8.20 | 33.33 | 33.33 |
| scorer-gemini/gemini-pro | en/style | 13/13 | 0 | 0.00 | 0.00 | 1.10 | 14.29 | 14.29 |
| scorer-gemini/gemini-pro | en/viral-hook | 13/13 | 0 | 0.00 | 0.00 | 0.85 | 11.11 | 11.11 |
| scorer-gemini/gemini-pro | ko/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-pro | ko/content | 12/12 | 0 | 0.00 | 0.00 | 6.95 | 44.44 | 44.44 |
| scorer-gemini/gemini-pro | ko/filler | 12/12 | 0 | 0.00 | 2.78 | 9.26 | 44.44 | 44.44 |
| scorer-gemini/gemini-pro | ko/language | 12/12 | 0 | 0.00 | 0.11 | 8.04 | 33.33 | 33.33 |
| scorer-gemini/gemini-pro | ko/structure | 12/12 | 0 | 0.00 | 3.63 | 16.72 | 53.33 | 53.33 |
| scorer-gemini/gemini-pro | ko/style | 12/12 | 0 | 0.00 | 7.14 | 9.52 | 28.57 | 28.57 |
| scorer-gemini/gemini-pro | ko/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 4.18 | 22.22 | 22.22 |
| scorer-gemini/gemini-pro | zh/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-pro | zh/content | 12/12 | 0 | 0.00 | 0.00 | 11.11 | 50.00 | 50.00 |
| scorer-gemini/gemini-pro | zh/filler | 12/12 | 0 | 0.00 | 0.00 | 16.67 | 77.78 | 77.78 |
| scorer-gemini/gemini-pro | zh/language | 12/12 | 0 | 0.00 | 5.55 | 22.69 | 66.67 | 66.67 |
| scorer-gemini/gemini-pro | zh/structure | 12/12 | 0 | 0.00 | 16.66 | 20.55 | 53.33 | 53.33 |
| scorer-gemini/gemini-pro | zh/style | 12/12 | 0 | 0.00 | 7.14 | 11.91 | 42.86 | 42.86 |
| scorer-gemini/gemini-pro | zh/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 6.48 | 22.22 | 22.22 |
| scorer-gemini/gemini-pro | ja/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-pro | ja/content | 12/12 | 0 | 0.00 | 0.00 | 14.35 | 66.67 | 66.67 |
| scorer-gemini/gemini-pro | ja/filler | 12/12 | 0 | 0.00 | 0.00 | 11.57 | 44.44 | 44.44 |
| scorer-gemini/gemini-pro | ja/language | 12/12 | 0 | 0.00 | 2.78 | 11.11 | 44.44 | 44.44 |
| scorer-gemini/gemini-pro | ja/structure | 12/12 | 0 | 0.00 | 10.00 | 16.11 | 53.33 | 53.33 |
| scorer-gemini/gemini-pro | ja/style | 12/12 | 0 | 0.00 | 0.00 | 5.36 | 14.30 | 14.30 |
| scorer-gemini/gemini-pro | ja/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 4.63 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.7 | en/communication | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.7 | en/content | 13/13 | 0 | 0.00 | 0.00 | 0.43 | 5.56 | 5.56 |
| scorer-gemini/gemini-3.7 | en/filler | 13/13 | 0 | 0.00 | 0.00 | 0.85 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.7 | en/language | 13/13 | 0 | 0.00 | 0.00 | 1.28 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.7 | en/structure | 13/13 | 0 | 0.00 | 0.00 | 1.54 | 13.33 | 13.33 |
| scorer-gemini/gemini-3.7 | en/style | 13/13 | 0 | 0.00 | 0.00 | 1.10 | 14.29 | 14.29 |
| scorer-gemini/gemini-3.7 | en/viral-hook | 13/13 | 0 | 0.00 | 0.00 | 0.43 | 5.56 | 5.56 |
| scorer-gemini/gemini-3.7 | ko/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.7 | ko/content | 12/12 | 0 | 0.00 | 0.00 | 2.78 | 22.22 | 22.22 |
| scorer-gemini/gemini-3.7 | ko/filler | 12/12 | 0 | 0.00 | 0.00 | 0.93 | 5.60 | 5.60 |
| scorer-gemini/gemini-3.7 | ko/language | 12/12 | 0 | 0.00 | 0.00 | 3.24 | 16.70 | 16.70 |
| scorer-gemini/gemini-3.7 | ko/structure | 12/12 | 0 | 0.00 | 0.00 | 4.44 | 20.00 | 20.00 |
| scorer-gemini/gemini-3.7 | ko/style | 12/12 | 0 | 0.00 | 0.00 | 4.76 | 14.30 | 14.30 |
| scorer-gemini/gemini-3.7 | ko/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.7 | zh/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.7 | zh/content | 12/12 | 0 | 0.00 | 0.00 | 4.63 | 22.22 | 22.22 |
| scorer-gemini/gemini-3.7 | zh/filler | 12/12 | 0 | 0.00 | 0.00 | 7.41 | 33.33 | 33.33 |
| scorer-gemini/gemini-3.7 | zh/language | 12/12 | 0 | 0.00 | 0.00 | 8.33 | 33.33 | 33.33 |
| scorer-gemini/gemini-3.7 | zh/structure | 12/12 | 0 | 0.00 | 0.00 | 6.11 | 26.67 | 26.67 |
| scorer-gemini/gemini-3.7 | zh/style | 12/12 | 0 | 0.00 | 0.00 | 5.95 | 28.57 | 28.57 |
| scorer-gemini/gemini-3.7 | zh/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 2.31 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.7 | ja/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.7 | ja/content | 12/12 | 0 | 0.00 | 0.00 | 7.41 | 33.33 | 33.33 |
| scorer-gemini/gemini-3.7 | ja/filler | 12/12 | 0 | 0.00 | 0.00 | 6.94 | 38.89 | 38.89 |
| scorer-gemini/gemini-3.7 | ja/language | 12/12 | 0 | 0.00 | 0.00 | 5.09 | 22.22 | 22.22 |
| scorer-gemini/gemini-3.7 | ja/structure | 12/12 | 0 | 0.00 | 0.00 | 5.55 | 26.67 | 26.67 |
| scorer-gemini/gemini-3.7 | ja/style | 12/12 | 0 | 0.00 | 0.00 | 3.17 | 14.29 | 14.29 |
| scorer-gemini/gemini-3.7 | ja/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 1.85 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.8-low | en/communication | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-low | en/content | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-low | en/filler | 13/13 | 0 | 0.00 | 0.00 | 1.28 | 16.67 | 16.67 |
| scorer-gemini/gemini-3.8-low | en/language | 13/13 | 0 | 0.00 | 0.00 | 1.71 | 22.22 | 22.22 |
| scorer-gemini/gemini-3.8-low | en/structure | 13/13 | 0 | 0.00 | 0.00 | 2.56 | 20.00 | 20.00 |
| scorer-gemini/gemini-3.8-low | en/style | 13/13 | 0 | 0.00 | 0.00 | 1.10 | 14.29 | 14.29 |
| scorer-gemini/gemini-3.8-low | en/viral-hook | 13/13 | 0 | 0.00 | 0.00 | 0.85 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.8-low | ko/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-low | ko/content | 12/12 | 0 | 0.00 | 0.00 | 2.31 | 22.20 | 22.20 |
| scorer-gemini/gemini-3.8-low | ko/filler | 12/12 | 0 | 0.00 | 0.00 | 1.85 | 11.10 | 11.10 |
| scorer-gemini/gemini-3.8-low | ko/language | 12/12 | 0 | 0.00 | 0.00 | 2.78 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.8-low | ko/structure | 12/12 | 0 | 0.00 | 0.00 | 6.67 | 20.00 | 20.00 |
| scorer-gemini/gemini-3.8-low | ko/style | 12/12 | 0 | 0.00 | 0.00 | 4.76 | 14.30 | 14.30 |
| scorer-gemini/gemini-3.8-low | ko/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-low | zh/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-low | zh/content | 12/12 | 0 | 0.00 | 0.00 | 10.19 | 38.89 | 38.89 |
| scorer-gemini/gemini-3.8-low | zh/filler | 12/12 | 0 | 0.00 | 0.00 | 11.58 | 55.56 | 55.56 |
| scorer-gemini/gemini-3.8-low | zh/language | 12/12 | 0 | 0.00 | 0.00 | 14.35 | 61.11 | 61.11 |
| scorer-gemini/gemini-3.8-low | zh/structure | 12/12 | 0 | 0.00 | 0.00 | 12.22 | 53.33 | 53.33 |
| scorer-gemini/gemini-3.8-low | zh/style | 12/12 | 0 | 0.00 | 0.00 | 8.93 | 42.86 | 42.86 |
| scorer-gemini/gemini-3.8-low | zh/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 3.24 | 22.22 | 22.22 |
| scorer-gemini/gemini-3.8-low | ja/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-low | ja/content | 12/12 | 0 | 0.00 | 0.00 | 10.19 | 55.56 | 55.56 |
| scorer-gemini/gemini-3.8-low | ja/filler | 12/12 | 0 | 0.00 | 0.00 | 10.18 | 44.44 | 44.44 |
| scorer-gemini/gemini-3.8-low | ja/language | 12/12 | 0 | 0.00 | 0.00 | 9.26 | 38.89 | 38.89 |
| scorer-gemini/gemini-3.8-low | ja/structure | 12/12 | 0 | 0.00 | 0.00 | 8.89 | 40.00 | 40.00 |
| scorer-gemini/gemini-3.8-low | ja/style | 12/12 | 0 | 0.00 | 0.00 | 2.38 | 14.29 | 14.29 |
| scorer-gemini/gemini-3.8-low | ja/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 1.85 | 22.22 | 22.22 |
| scorer-gemini/gemini-3.8-medium | en/communication | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-medium | en/content | 13/13 | 0 | 0.00 | 0.00 | 0.85 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.8-medium | en/filler | 13/13 | 0 | 0.00 | 0.00 | 1.28 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.8-medium | en/language | 13/13 | 0 | 0.00 | 0.00 | 1.28 | 16.67 | 16.67 |
| scorer-gemini/gemini-3.8-medium | en/structure | 13/13 | 0 | 0.00 | 0.00 | 2.05 | 13.33 | 13.33 |
| scorer-gemini/gemini-3.8-medium | en/style | 13/13 | 0 | 0.00 | 0.00 | 1.10 | 14.29 | 14.29 |
| scorer-gemini/gemini-3.8-medium | en/viral-hook | 13/13 | 0 | 0.00 | 0.00 | 1.28 | 16.67 | 16.67 |
| scorer-gemini/gemini-3.8-medium | ko/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-medium | ko/content | 12/12 | 0 | 0.00 | 0.00 | 1.85 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.8-medium | ko/filler | 12/12 | 0 | 0.00 | 0.00 | 0.93 | 5.60 | 5.60 |
| scorer-gemini/gemini-3.8-medium | ko/language | 12/12 | 0 | 0.00 | 0.00 | 2.78 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.8-medium | ko/structure | 12/12 | 0 | 0.00 | 0.00 | 6.11 | 20.00 | 20.00 |
| scorer-gemini/gemini-3.8-medium | ko/style | 12/12 | 0 | 0.00 | 0.00 | 4.77 | 14.30 | 14.30 |
| scorer-gemini/gemini-3.8-medium | ko/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-medium | zh/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-medium | zh/content | 12/12 | 0 | 0.00 | 0.00 | 5.55 | 44.44 | 44.44 |
| scorer-gemini/gemini-3.8-medium | zh/filler | 12/12 | 0 | 0.00 | 0.00 | 7.41 | 33.33 | 33.33 |
| scorer-gemini/gemini-3.8-medium | zh/language | 12/12 | 0 | 0.00 | 0.00 | 7.87 | 44.44 | 44.44 |
| scorer-gemini/gemini-3.8-medium | zh/structure | 12/12 | 0 | 0.00 | 0.00 | 7.22 | 26.67 | 26.67 |
| scorer-gemini/gemini-3.8-medium | zh/style | 12/12 | 0 | 0.00 | 0.00 | 6.55 | 28.57 | 28.57 |
| scorer-gemini/gemini-3.8-medium | zh/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 1.85 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.8-medium | ja/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-medium | ja/content | 12/12 | 0 | 0.00 | 0.00 | 9.72 | 38.89 | 38.89 |
| scorer-gemini/gemini-3.8-medium | ja/filler | 12/12 | 0 | 0.00 | 0.00 | 8.79 | 44.40 | 44.40 |
| scorer-gemini/gemini-3.8-medium | ja/language | 12/12 | 0 | 0.00 | 0.00 | 5.55 | 33.30 | 33.30 |
| scorer-gemini/gemini-3.8-medium | ja/structure | 12/12 | 0 | 0.00 | 0.00 | 6.67 | 26.70 | 26.70 |
| scorer-gemini/gemini-3.8-medium | ja/style | 12/12 | 0 | 0.00 | 0.00 | 2.38 | 14.30 | 14.30 |
| scorer-gemini/gemini-3.8-medium | ja/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.93 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.8-high | en/communication | 13/13 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-high | en/content | 13/13 | 0 | 0.00 | 0.00 | 0.43 | 5.56 | 5.56 |
| scorer-gemini/gemini-3.8-high | en/filler | 13/13 | 0 | 0.00 | 0.00 | 0.85 | 11.10 | 11.10 |
| scorer-gemini/gemini-3.8-high | en/language | 13/13 | 0 | 0.00 | 0.00 | 1.28 | 16.70 | 16.70 |
| scorer-gemini/gemini-3.8-high | en/structure | 13/13 | 0 | 0.00 | 0.00 | 1.54 | 13.30 | 13.30 |
| scorer-gemini/gemini-3.8-high | en/style | 13/13 | 0 | 0.00 | 0.00 | 1.10 | 14.30 | 14.30 |
| scorer-gemini/gemini-3.8-high | en/viral-hook | 13/13 | 0 | 0.00 | 0.00 | 0.43 | 5.60 | 5.60 |
| scorer-gemini/gemini-3.8-high | ko/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-high | ko/content | 12/12 | 0 | 0.00 | 0.00 | 1.85 | 22.20 | 22.20 |
| scorer-gemini/gemini-3.8-high | ko/filler | 12/12 | 0 | 0.00 | 0.00 | 2.32 | 16.70 | 16.70 |
| scorer-gemini/gemini-3.8-high | ko/language | 12/12 | 0 | 0.00 | 0.00 | 3.24 | 11.11 | 11.11 |
| scorer-gemini/gemini-3.8-high | ko/structure | 12/12 | 0 | 0.00 | 0.00 | 6.66 | 33.30 | 33.30 |
| scorer-gemini/gemini-3.8-high | ko/style | 12/12 | 0 | 0.00 | 0.00 | 4.76 | 14.30 | 14.30 |
| scorer-gemini/gemini-3.8-high | ko/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-high | zh/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-high | zh/content | 12/12 | 0 | 0.00 | 0.00 | 5.55 | 22.22 | 22.22 |
| scorer-gemini/gemini-3.8-high | zh/filler | 12/12 | 0 | 0.00 | 0.00 | 6.48 | 27.78 | 27.78 |
| scorer-gemini/gemini-3.8-high | zh/language | 12/12 | 0 | 0.00 | 0.00 | 6.94 | 33.33 | 33.33 |
| scorer-gemini/gemini-3.8-high | zh/structure | 12/12 | 0 | 0.00 | 0.00 | 6.11 | 26.67 | 26.67 |
| scorer-gemini/gemini-3.8-high | zh/style | 12/12 | 0 | 0.00 | 0.00 | 5.95 | 28.57 | 28.57 |
| scorer-gemini/gemini-3.8-high | zh/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 1.85 | 5.56 | 5.56 |
| scorer-gemini/gemini-3.8-high | ja/communication | 12/12 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini/gemini-3.8-high | ja/content | 12/12 | 0 | 0.00 | 0.00 | 9.72 | 38.90 | 38.90 |
| scorer-gemini/gemini-3.8-high | ja/filler | 12/12 | 0 | 0.00 | 0.00 | 7.87 | 33.30 | 33.30 |
| scorer-gemini/gemini-3.8-high | ja/language | 12/12 | 0 | 0.00 | 0.00 | 7.10 | 38.89 | 38.89 |
| scorer-gemini/gemini-3.8-high | ja/structure | 12/12 | 0 | 0.00 | 0.00 | 7.22 | 26.70 | 26.70 |
| scorer-gemini/gemini-3.8-high | ja/style | 12/12 | 0 | 0.00 | 0.00 | 3.57 | 14.30 | 14.30 |
| scorer-gemini/gemini-3.8-high | ja/viral-hook | 12/12 | 0 | 0.00 | 0.00 | 1.39 | 16.67 | 16.67 |
| scorer-gemini-low-confirm/gemini-3.8-low | en/communication | 26/26 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | en/content | 26/26 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | en/filler | 26/26 | 0 | 0.00 | 0.00 | 1.07 | 11.11 | 16.67 |
| scorer-gemini-low-confirm/gemini-3.8-low | en/language | 26/26 | 0 | 0.00 | 0.00 | 1.28 | 11.11 | 22.22 |
| scorer-gemini-low-confirm/gemini-3.8-low | en/structure | 26/26 | 0 | 0.00 | 0.00 | 1.54 | 13.33 | 13.33 |
| scorer-gemini-low-confirm/gemini-3.8-low | en/style | 26/26 | 0 | 0.00 | 0.00 | 1.10 | 14.29 | 14.29 |
| scorer-gemini-low-confirm/gemini-3.8-low | en/viral-hook | 26/26 | 0 | 0.00 | 0.00 | 0.64 | 5.56 | 11.11 |
| scorer-gemini-low-confirm/gemini-3.8-low | ko/communication | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | ko/content | 24/24 | 0 | 0.00 | 0.00 | 2.08 | 11.11 | 11.11 |
| scorer-gemini-low-confirm/gemini-3.8-low | ko/filler | 24/24 | 0 | 0.00 | 0.00 | 0.93 | 5.56 | 5.60 |
| scorer-gemini-low-confirm/gemini-3.8-low | ko/language | 24/24 | 0 | 0.00 | 0.00 | 3.47 | 11.11 | 16.67 |
| scorer-gemini-low-confirm/gemini-3.8-low | ko/structure | 24/24 | 0 | 0.00 | 0.00 | 5.00 | 13.33 | 26.67 |
| scorer-gemini-low-confirm/gemini-3.8-low | ko/style | 24/24 | 0 | 0.00 | 0.00 | 5.06 | 14.30 | 21.43 |
| scorer-gemini-low-confirm/gemini-3.8-low | ko/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | zh/communication | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | zh/content | 24/24 | 0 | 0.00 | 0.00 | 5.32 | 27.78 | 33.33 |
| scorer-gemini-low-confirm/gemini-3.8-low | zh/filler | 24/24 | 0 | 0.00 | 0.00 | 9.03 | 38.89 | 50.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | zh/language | 24/24 | 0 | 0.00 | 0.00 | 8.80 | 38.89 | 55.56 |
| scorer-gemini-low-confirm/gemini-3.8-low | zh/structure | 24/24 | 0 | 0.00 | 0.00 | 5.83 | 33.33 | 33.33 |
| scorer-gemini-low-confirm/gemini-3.8-low | zh/style | 24/24 | 0 | 0.00 | 0.00 | 5.36 | 28.57 | 28.57 |
| scorer-gemini-low-confirm/gemini-3.8-low | zh/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 2.08 | 11.11 | 11.11 |
| scorer-gemini-low-confirm/gemini-3.8-low | ja/communication | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | ja/content | 24/24 | 0 | 0.00 | 0.00 | 9.26 | 44.44 | 44.44 |
| scorer-gemini-low-confirm/gemini-3.8-low | ja/filler | 24/24 | 0 | 0.00 | 0.00 | 8.10 | 38.89 | 50.00 |
| scorer-gemini-low-confirm/gemini-3.8-low | ja/language | 24/24 | 0 | 0.00 | 0.00 | 7.64 | 33.33 | 33.33 |
| scorer-gemini-low-confirm/gemini-3.8-low | ja/structure | 24/24 | 0 | 0.00 | 0.00 | 7.50 | 26.67 | 26.67 |
| scorer-gemini-low-confirm/gemini-3.8-low | ja/style | 24/24 | 0 | 0.00 | 0.00 | 1.79 | 14.29 | 14.29 |
| scorer-gemini-low-confirm/gemini-3.8-low | ja/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini-pro-confirm/gemini-pro | en/communication | 26/26 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini-pro-confirm/gemini-pro | en/content | 26/26 | 0 | 0.00 | 0.00 | 3.42 | 27.78 | 33.33 |
| scorer-gemini-pro-confirm/gemini-pro | en/filler | 26/26 | 0 | 0.00 | 0.00 | 4.27 | 27.78 | 27.78 |
| scorer-gemini-pro-confirm/gemini-pro | en/language | 26/26 | 0 | 0.00 | 2.84 | 9.41 | 33.33 | 33.33 |
| scorer-gemini-pro-confirm/gemini-pro | en/structure | 26/26 | 0 | 0.00 | 0.00 | 8.21 | 33.33 | 46.67 |
| scorer-gemini-pro-confirm/gemini-pro | en/style | 26/26 | 0 | 0.00 | 0.00 | 1.37 | 14.29 | 14.29 |
| scorer-gemini-pro-confirm/gemini-pro | en/viral-hook | 26/26 | 0 | 0.00 | 0.00 | 1.92 | 16.67 | 22.22 |
| scorer-gemini-pro-confirm/gemini-pro | ko/communication | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini-pro-confirm/gemini-pro | ko/content | 24/24 | 0 | 0.00 | 0.00 | 5.10 | 27.78 | 27.78 |
| scorer-gemini-pro-confirm/gemini-pro | ko/filler | 24/24 | 0 | 0.00 | 0.00 | 6.72 | 33.33 | 38.89 |
| scorer-gemini-pro-confirm/gemini-pro | ko/language | 24/24 | 0 | 0.00 | 0.14 | 7.65 | 27.78 | 33.33 |
| scorer-gemini-pro-confirm/gemini-pro | ko/structure | 24/24 | 0 | 0.00 | 6.67 | 18.08 | 53.33 | 60.00 |
| scorer-gemini-pro-confirm/gemini-pro | ko/style | 24/24 | 0 | 0.00 | 3.69 | 8.65 | 28.57 | 28.57 |
| scorer-gemini-pro-confirm/gemini-pro | ko/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 2.32 | 11.11 | 11.11 |
| scorer-gemini-pro-confirm/gemini-pro | zh/communication | 24/24 | 0 | 0.00 | 0.00 | 1.04 | 0.00 | 25.00 |
| scorer-gemini-pro-confirm/gemini-pro | zh/content | 24/24 | 0 | 0.00 | 0.00 | 10.66 | 50.00 | 61.11 |
| scorer-gemini-pro-confirm/gemini-pro | zh/filler | 24/24 | 0 | 0.00 | 0.00 | 15.31 | 66.67 | 83.33 |
| scorer-gemini-pro-confirm/gemini-pro | zh/language | 24/24 | 0 | 0.00 | 0.06 | 19.24 | 61.11 | 66.67 |
| scorer-gemini-pro-confirm/gemini-pro | zh/structure | 24/24 | 0 | 0.00 | 0.17 | 16.69 | 60.00 | 66.67 |
| scorer-gemini-pro-confirm/gemini-pro | zh/style | 24/24 | 0 | 0.00 | 0.07 | 9.24 | 28.57 | 28.57 |
| scorer-gemini-pro-confirm/gemini-pro | zh/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 4.87 | 22.22 | 22.22 |
| scorer-gemini-pro-confirm/gemini-pro | ja/communication | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-gemini-pro-confirm/gemini-pro | ja/content | 24/24 | 0 | 0.00 | 0.00 | 13.23 | 66.67 | 66.67 |
| scorer-gemini-pro-confirm/gemini-pro | ja/filler | 24/24 | 0 | 0.00 | 0.00 | 9.97 | 50.00 | 50.00 |
| scorer-gemini-pro-confirm/gemini-pro | ja/language | 24/24 | 0 | 0.00 | 0.03 | 11.13 | 44.44 | 50.00 |
| scorer-gemini-pro-confirm/gemini-pro | ja/structure | 24/24 | 0 | 0.00 | 0.17 | 13.92 | 40.00 | 60.00 |
| scorer-gemini-pro-confirm/gemini-pro | ja/style | 24/24 | 0 | 0.00 | 0.04 | 5.97 | 28.57 | 28.57 |
| scorer-gemini-pro-confirm/gemini-pro | ja/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 2.79 | 11.11 | 11.11 |
| scorer-openai-terra-confirm/openai-terra | en/communication | 26/26 | 0 | 0.00 | 0.00 | 0.96 | 8.30 | 16.70 |
| scorer-openai-terra-confirm/openai-terra | en/content | 26/26 | 0 | 0.00 | 0.00 | 3.21 | 16.67 | 27.80 |
| scorer-openai-terra-confirm/openai-terra | en/filler | 26/26 | 0 | 0.00 | 0.00 | 2.57 | 16.70 | 27.80 |
| scorer-openai-terra-confirm/openai-terra | en/language | 26/26 | 0 | 0.00 | 5.60 | 4.93 | 16.67 | 16.67 |
| scorer-openai-terra-confirm/openai-terra | en/structure | 26/26 | 0 | 0.00 | 0.00 | 5.12 | 20.00 | 20.00 |
| scorer-openai-terra-confirm/openai-terra | en/style | 26/26 | 0 | 0.00 | 0.00 | 0.55 | 7.10 | 7.14 |
| scorer-openai-terra-confirm/openai-terra | en/viral-hook | 26/26 | 0 | 0.00 | 0.00 | 2.79 | 11.11 | 11.11 |
| scorer-openai-terra-confirm/openai-terra | ko/communication | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai-terra-confirm/openai-terra | ko/content | 24/24 | 0 | 0.00 | 0.00 | 6.03 | 16.70 | 22.22 |
| scorer-openai-terra-confirm/openai-terra | ko/filler | 24/24 | 0 | 0.00 | 0.00 | 2.09 | 11.10 | 11.10 |
| scorer-openai-terra-confirm/openai-terra | ko/language | 24/24 | 0 | 0.00 | 5.58 | 4.64 | 16.70 | 16.70 |
| scorer-openai-terra-confirm/openai-terra | ko/structure | 24/24 | 0 | 0.00 | 3.35 | 10.55 | 40.00 | 53.30 |
| scorer-openai-terra-confirm/openai-terra | ko/style | 24/24 | 0 | 0.00 | 0.00 | 8.33 | 28.60 | 42.90 |
| scorer-openai-terra-confirm/openai-terra | ko/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 0.93 | 5.60 | 11.10 |
| scorer-openai-terra-confirm/openai-terra | zh/communication | 24/24 | 0 | 0.00 | 0.00 | 0.70 | 0.00 | 16.70 |
| scorer-openai-terra-confirm/openai-terra | zh/content | 24/24 | 0 | 0.00 | 0.00 | 9.26 | 33.33 | 44.40 |
| scorer-openai-terra-confirm/openai-terra | zh/filler | 24/24 | 0 | 0.00 | 0.00 | 8.10 | 33.33 | 38.89 |
| scorer-openai-terra-confirm/openai-terra | zh/language | 24/24 | 0 | 0.00 | 2.78 | 15.97 | 61.10 | 61.11 |
| scorer-openai-terra-confirm/openai-terra | zh/structure | 24/24 | 0 | 0.00 | 0.00 | 9.16 | 33.33 | 46.67 |
| scorer-openai-terra-confirm/openai-terra | zh/style | 24/24 | 0 | 0.00 | 0.00 | 9.53 | 28.60 | 28.60 |
| scorer-openai-terra-confirm/openai-terra | zh/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 1.39 | 11.10 | 11.11 |
| scorer-openai-terra-confirm/openai-terra | ja/communication | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai-terra-confirm/openai-terra | ja/content | 24/24 | 0 | 0.00 | 0.00 | 13.20 | 50.00 | 55.60 |
| scorer-openai-terra-confirm/openai-terra | ja/filler | 24/24 | 0 | 0.00 | 0.00 | 6.72 | 27.80 | 38.90 |
| scorer-openai-terra-confirm/openai-terra | ja/language | 24/24 | 0 | 0.00 | 2.80 | 10.27 | 38.90 | 50.00 |
| scorer-openai-terra-confirm/openai-terra | ja/structure | 24/24 | 0 | 0.00 | 0.00 | 8.89 | 33.30 | 40.00 |
| scorer-openai-terra-confirm/openai-terra | ja/style | 24/24 | 0 | 0.00 | 0.00 | 6.85 | 28.60 | 28.60 |
| scorer-openai-terra-confirm/openai-terra | ja/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 1.16 | 11.10 | 11.10 |
| scorer-openai-5.5-confirm/openai-5.5 | en/communication | 26/26 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai-5.5-confirm/openai-5.5 | en/content | 26/26 | 0 | 0.00 | 0.00 | 8.55 | 33.30 | 33.30 |
| scorer-openai-5.5-confirm/openai-5.5 | en/filler | 26/26 | 0 | 0.00 | 0.00 | 4.07 | 33.30 | 38.90 |
| scorer-openai-5.5-confirm/openai-5.5 | en/language | 26/26 | 0 | 0.00 | 8.35 | 9.83 | 27.80 | 33.30 |
| scorer-openai-5.5-confirm/openai-5.5 | en/structure | 26/26 | 0 | 0.00 | 6.70 | 7.94 | 20.00 | 20.00 |
| scorer-openai-5.5-confirm/openai-5.5 | en/style | 26/26 | 0 | 0.00 | 0.00 | 2.19 | 14.30 | 14.30 |
| scorer-openai-5.5-confirm/openai-5.5 | en/viral-hook | 26/26 | 0 | 0.00 | 0.00 | 3.21 | 11.10 | 27.80 |
| scorer-openai-5.5-confirm/openai-5.5 | ko/communication | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai-5.5-confirm/openai-5.5 | ko/content | 24/24 | 0 | 0.00 | 2.80 | 9.50 | 27.80 | 38.90 |
| scorer-openai-5.5-confirm/openai-5.5 | ko/filler | 24/24 | 0 | 0.00 | 5.60 | 6.03 | 22.20 | 22.20 |
| scorer-openai-5.5-confirm/openai-5.5 | ko/language | 24/24 | 0 | 0.00 | 11.10 | 13.65 | 33.30 | 33.30 |
| scorer-openai-5.5-confirm/openai-5.5 | ko/structure | 24/24 | 0 | 0.00 | 16.65 | 16.95 | 46.70 | 46.70 |
| scorer-openai-5.5-confirm/openai-5.5 | ko/style | 24/24 | 0 | 0.00 | 7.10 | 13.99 | 42.90 | 42.90 |
| scorer-openai-5.5-confirm/openai-5.5 | ko/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 1.63 | 5.60 | 11.10 |
| scorer-openai-5.5-confirm/openai-5.5 | zh/communication | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai-5.5-confirm/openai-5.5 | zh/content | 24/24 | 0 | 0.00 | 0.00 | 10.42 | 38.90 | 38.90 |
| scorer-openai-5.5-confirm/openai-5.5 | zh/filler | 24/24 | 0 | 0.00 | 0.00 | 9.49 | 38.90 | 44.40 |
| scorer-openai-5.5-confirm/openai-5.5 | zh/language | 24/24 | 0 | 0.00 | 2.78 | 21.45 | 63.00 | 66.70 |
| scorer-openai-5.5-confirm/openai-5.5 | zh/structure | 24/24 | 0 | 0.00 | 3.33 | 10.83 | 33.30 | 40.00 |
| scorer-openai-5.5-confirm/openai-5.5 | zh/style | 24/24 | 0 | 0.00 | 0.00 | 10.42 | 28.60 | 28.60 |
| scorer-openai-5.5-confirm/openai-5.5 | zh/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 2.78 | 11.10 | 11.11 |
| scorer-openai-5.5-confirm/openai-5.5 | ja/communication | 24/24 | 0 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| scorer-openai-5.5-confirm/openai-5.5 | ja/content | 24/24 | 0 | 0.00 | 0.00 | 17.60 | 61.10 | 61.10 |
| scorer-openai-5.5-confirm/openai-5.5 | ja/filler | 24/24 | 0 | 0.00 | 0.00 | 10.18 | 44.40 | 50.00 |
| scorer-openai-5.5-confirm/openai-5.5 | ja/language | 24/24 | 0 | 0.00 | 13.90 | 17.60 | 50.00 | 50.00 |
| scorer-openai-5.5-confirm/openai-5.5 | ja/structure | 24/24 | 0 | 0.00 | 10.00 | 15.56 | 46.70 | 46.70 |
| scorer-openai-5.5-confirm/openai-5.5 | ja/style | 24/24 | 0 | 0.00 | 0.00 | 5.65 | 14.30 | 21.40 |
| scorer-openai-5.5-confirm/openai-5.5 | ja/viral-hook | 24/24 | 0 | 0.00 | 0.00 | 3.01 | 22.20 | 22.22 |

## Evidence and identity

| Cohort | Source commit | Original protocol | Rows / calls / transport attempts |
|---|---|---|---:|
| A/scorer-openai | `66a19b79e68e0e7df00d0c5da0aa94dac3c51e1c` | `7c79c2edf1b86407a5279eff9dc0f14d02e1e8e24e75b73f1f2a4e3dbc60706a` | 294 / 294 / 294 |
| A/scorer-gemini | `66a19b79e68e0e7df00d0c5da0aa94dac3c51e1c` | `c175a0f7e1c3495d4b95c0a5f6bd5efb81ceb794c5dda95a58b55ceed1023d2c` | 245 / 245 / 245 |
| A/scorer-gemini-low-confirm | `66a19b79e68e0e7df00d0c5da0aa94dac3c51e1c` | `94dbaa1798640081212148bbdd484436ffc17eb74dd969eb530c7e3940144755` | 98 / 98 / 98 |
| A/scorer-gemini-pro-confirm | `66a19b79e68e0e7df00d0c5da0aa94dac3c51e1c` | `980a3d6501f47cafb02a12a3c0c94f1aaf7d5ca3c8583a25207ec9ccef516fda` | 98 / 98 / 98 |
| C/scorer-openai-terra-confirm | `7de2d0b6d78d905804e8e863392df11d3048265e` | `583b9f6ac3f7e1d7effd6da0ab99abad065cc7f91271bc893f46eccb818936a3` | 98 / 98 / 98 |
| C/scorer-openai-5.5-confirm | `7de2d0b6d78d905804e8e863392df11d3048265e` | `f07aff116b48a289aa3acaa16934ac4f643a84c94318fd504e37a3f27c0aa502` | 98 / 98 / 98 |

| Candidate | Exact requested and returned model | Transport | Requested reasoning effort |
|---|---|---|---|
| openai-astra | `gpt-6-astra` | opencodex | low |
| openai-sol | `gpt-5.6-sol` | opencodex | low |
| openai-terra | `gpt-5.6-terra` | opencodex | low |
| openai-luna | `gpt-5.6-luna` | opencodex | low |
| openai-5.5 | `gpt-5.5` | opencodex | low |
| openai-mini | `gpt-5.4-mini` | opencodex | low |
| gemini-pro | `google-antigravity/gemini-3.1-pro` | opencodex | unspecified |
| gemini-3.7 | `google-antigravity/gemini-3.7-flash` | opencodex | unspecified |
| gemini-3.8-low | `google-antigravity/gemini-3.8-flash-low` | opencodex | unspecified |
| gemini-3.8-medium | `google-antigravity/gemini-3.8-flash-medium` | opencodex | unspecified |
| gemini-3.8-high | `google-antigravity/gemini-3.8-flash-high` | opencodex | unspecified |

Hashes in the JSON companion cover the source rows, semantics, summary, original protocol document, terminal job record, and private receipt set. Source and fixture bytes were checked against the two pinned commits. A uses legacy directories without `study-protocol.json`; C has that binding. Neither source directory is modified.

The earlier audit (2026-09-05T01:09:19.300Z; SHA-256 `4a0b6c81d8b9195e417571d123164c806b07129924d02d4a36f85d373e061190`) agrees for scorer-openai, scorer-gemini, scorer-gemini-low-confirm. The other matrices were checked independently for this publication.

## Limits and remaining work

- The 49 suspect-zones inputs are curated regression controls (26 expected_hot, 23 expected_not_hot), not authenticated real-world human-vs-AI truth or human preference ratings.
- No rebaseline corpus was collected in these six datasets. Its runner support is not evidence of a completed rebaseline experiment.
- A and C retain separate protocol and effective-input hashes. Lexicon fingerprints include absolute paths; different hashes alone do not prove different lexical content. Repeats are the same 49 inputs, not additional independent samples.
- Resolved configuration and complete deterministic analyses were not archived, only hashed. Protocol IDs are preserved and cross-bound to rows/receipts; they cannot be fully recomputed here. Prompt hashes bind requests but do not independently reconstruct prompt text.
- Overall and deterministic scalars are source-bound collector observations, not independently replayed production outputs. Receipt schema, raw scores, categories, model metadata, matrix membership, and committed source/fixture bytes are independently checked.
- Original raw-score validation permits partial packs and does not enforce arithmetic consistency. Reported arithmetic diagnostics do not change original validity or repair model outputs.
- Model names are exact requested/returned OpenCodex identifiers observed in these calls. Metadata equality does not authenticate upstream model weights, current catalog availability, reasoning execution, or provider-wide reliability.
- Serial call timing, one initial pass and selected two-repeat cohorts cannot establish a winner, calibrated threshold, or default model. No live score CI gate, cost estimate, rewrite-quality claim, or human label is introduced.
- Only the six explicitly selected terminal A/C matrices are included. Other study lanes are outside this completed comparison.

## Reproduce offline

From a checkout containing the assembler, with read-only access to the pinned A and C worktrees:

```sh
node scripts/research/publish-scorer-report.mjs \
  --source-a /path/to/frozen-A --source-c /path/to/frozen-C \
  --audit /path/to/patina-model-journal-audit-20260905.json --check
```

Use `--write` to regenerate only this Markdown file and its JSON companion. Without either flag, the assembler prints a compact validation summary. Bounds reject unexpected matrices, nonterminal receipts, model mismatches, changed sources, symlinks, and oversized input. No provider credentials are read.

The existing opt-in runner is `tests/quality/live-scorer-benchmark.mjs` (`npm run benchmark:scorer:live -- --help`). Its `--manifest`/`--texts` path can collect a separately authorized rebaseline study. This report does not start or imply that study.

# Full rewrite confirmation — September 5, 2026

612 generations and 1224/1224 judgments form the complete six-finalist join. Each candidate has 34 fixtures × 3 repeats. All 18 jobs ended with exit code 0.

New derivation protocol: `4713d6af4dfc4c32e03b6fdde7a49c2e5b55f01067b895536f33b8a211761c89`. Historical evaluator protocol IDs and raw flags remain unchanged.

## Observed ranking

| Rank | Candidate | Safe / attempted | Safe rate, 95% fixture CI | Pair naturalness median | Generation median ms | Canonical judgment errors |
|---:|---|---:|---|---:|---:|---:|
| 1 | openai-astra | 58/102 | 0.57 [0.42, 0.72] | 2.50 | 13531.00 | 38/204 |
| 2 | openai-terra | 45/102 | 0.44 [0.29, 0.59] | 3.00 | 5320.00 | 36/204 |
| 3 | anthropic-sonnet | 42/102 | 0.41 [0.27, 0.55] | 3.50 | 8357.50 | 32/204 |
| 4 | anthropic-fable | 36/102 | 0.35 [0.23, 0.49] | 3.50 | 17961.00 | 39/204 |
| 5 | gemini-3.8-medium | 18/102 | 0.18 [0.08, 0.28] | 2.50 | 8702.00 | 50/204 |
| 6 | gemini-3.8-high | 10/102 | 0.10 [0.03, 0.18] | 2.50 | 8492.00 | 38/204 |

Same existing rule: safe rate descending, median of per-generation mean naturalness from fully valid judge pairs descending, generation latency median ascending, ID ascending. The ranking compares these six finalists only.

Numerator: numeric proxy pass and two configured different-family valid judgments with MPS/fidelity >=90 and zero hard failures. Denominator: all 102 generation attempts per candidate, including failed judgment cases.

## Historical versus canonical validity

Valid judgments: 1029 → 991. Counts below cover every original valid and invalid row.

| Transition | Judgments |
|---|---:|
| ok->ok | 978 |
| ok->error | 51 |
| error->ok | 13 |
| error->error | 182 |

## Language coverage and diagnostics

| Candidate | Language | Gen / fixtures | Numeric pass / assessed | Valid judge pairs / gen | Judge errors / rows | Safe / gen | Safe 95% fixture CI | MPS n / median | Fidelity n / median | Naturalness n / median |
|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|
| openai-astra | en | 33 / 11 | 21/33 | 32/33 | 1/66 | 21/33 | [0.36, 0.91] | 65 / 100.00 | 66 / 100.00 | 66 / 2.50 |
| openai-astra | ko | 33 / 11 | 29/33 | 27/33 | 6/66 | 24/33 | [0.48, 0.91] | 60 / 100.00 | 66 / 100.00 | 66 / 3.00 |
| openai-astra | zh | 18 / 6 | 17/18 | 6/18 | 20/36 | 5/18 | [0.00, 0.61] | 16 / 100.00 | 36 / 100.00 | 35 / 3.00 |
| openai-astra | ja | 18 / 6 | 14/18 | 12/18 | 11/36 | 8/18 | [0.11, 0.83] | 25 / 100.00 | 36 / 100.00 | 36 / 3.00 |
| openai-terra | en | 33 / 11 | 20/33 | 31/33 | 2/66 | 17/33 | [0.24, 0.76] | 64 / 100.00 | 66 / 100.00 | 66 / 3.00 |
| openai-terra | ko | 33 / 11 | 28/33 | 27/33 | 6/66 | 15/33 | [0.18, 0.73] | 60 / 100.00 | 66 / 100.00 | 66 / 3.00 |
| openai-terra | zh | 18 / 6 | 18/18 | 9/18 | 16/36 | 8/18 | [0.11, 0.78] | 20 / 100.00 | 36 / 100.00 | 36 / 3.00 |
| openai-terra | ja | 18 / 6 | 12/18 | 12/18 | 12/36 | 5/18 | [0.00, 0.61] | 24 / 100.00 | 36 / 100.00 | 36 / 3.00 |
| gemini-3.8-high | en | 33 / 11 | 14/33 | 29/33 | 5/66 | 4/33 | [0.00, 0.30] | 61 / 100.00 | 66 / 91.70 | 66 / 3.00 |
| gemini-3.8-high | ko | 33 / 11 | 27/33 | 23/33 | 11/66 | 4/33 | [0.00, 0.27] | 55 / 90.00 | 66 / 91.70 | 66 / 3.00 |
| gemini-3.8-high | zh | 18 / 6 | 17/18 | 8/18 | 13/36 | 1/18 | [0.00, 0.17] | 23 / 100.00 | 36 / 91.70 | 36 / 3.00 |
| gemini-3.8-high | ja | 18 / 6 | 10/18 | 12/18 | 9/36 | 1/18 | [0.00, 0.17] | 27 / 100.00 | 36 / 100.00 | 36 / 3.00 |
| gemini-3.8-medium | en | 33 / 11 | 19/33 | 29/33 | 5/66 | 8/33 | [0.03, 0.48] | 61 / 100.00 | 66 / 91.70 | 66 / 3.00 |
| gemini-3.8-medium | ko | 33 / 11 | 25/33 | 25/33 | 9/66 | 6/33 | [0.03, 0.33] | 57 / 100.00 | 66 / 83.30 | 66 / 3.00 |
| gemini-3.8-medium | zh | 18 / 6 | 16/18 | 6/18 | 21/36 | 2/18 | [0.00, 0.33] | 18 / 100.00 | 36 / 91.70 | 32 / 3.00 |
| gemini-3.8-medium | ja | 18 / 6 | 10/18 | 8/18 | 15/36 | 2/18 | [0.00, 0.33] | 21 / 100.00 | 36 / 91.70 | 36 / 3.00 |
| anthropic-sonnet | en | 33 / 11 | 20/33 | 28/33 | 5/66 | 13/33 | [0.15, 0.64] | 61 / 100.00 | 66 / 100.00 | 66 / 4.00 |
| anthropic-sonnet | ko | 33 / 11 | 26/33 | 26/33 | 7/66 | 14/33 | [0.18, 0.67] | 59 / 100.00 | 66 / 100.00 | 66 / 4.00 |
| anthropic-sonnet | zh | 18 / 6 | 17/18 | 9/18 | 13/36 | 8/18 | [0.11, 0.78] | 23 / 100.00 | 36 / 100.00 | 36 / 3.00 |
| anthropic-sonnet | ja | 18 / 6 | 14/18 | 12/18 | 7/36 | 7/18 | [0.11, 0.72] | 29 / 100.00 | 36 / 100.00 | 36 / 3.00 |
| anthropic-fable | en | 33 / 11 | 13/33 | 28/33 | 5/66 | 10/33 | [0.09, 0.55] | 61 / 100.00 | 66 / 100.00 | 66 / 3.50 |
| anthropic-fable | ko | 33 / 11 | 22/33 | 25/33 | 8/66 | 16/33 | [0.24, 0.73] | 58 / 100.00 | 66 / 100.00 | 66 / 3.00 |
| anthropic-fable | zh | 18 / 6 | 15/18 | 6/18 | 15/36 | 4/18 | [0.00, 0.56] | 21 / 100.00 | 36 / 100.00 | 36 / 3.00 |
| anthropic-fable | ja | 18 / 6 | 12/18 | 12/18 | 11/36 | 6/18 | [0.11, 0.61] | 25 / 100.00 | 36 / 100.00 | 36 / 3.00 |

MPS/fidelity/naturalness distributions use canonically valid final stage responses even if another stage failed. Fidelity is replayed through production scoreFidelity, including its deterministic length component. Separate row errors remain errors; no model counts or scores are repaired.

Existing deterministic numeric proxy; not a proof of full meaning preservation.

## Fixture-clustered uncertainty

5000 deterministic resamples use seed 20260905. Resample whole fixtures within language, with replacement, using shared draws for all six candidates. Retain every repeat and judge pair inside each sampled fixture. Intervals are conditional on these selected fixtures and observed judgments; they are not population or human-quality confidence claims.

The JSON report also includes naturalness-median intervals and finite/missing replicate counts. The following paired safe-rate differences use the same sampled fixtures for both candidates; intervals containing zero do not resolve an ordering.

| Left minus right | Observed difference | 95% paired fixture CI |
|---|---:|---|
| openai-astra − openai-terra | 0.127 | [0.03, 0.24] |
| openai-astra − gemini-3.8-high | 0.471 | [0.31, 0.62] |
| openai-astra − gemini-3.8-medium | 0.392 | [0.26, 0.52] |
| openai-astra − anthropic-sonnet | 0.157 | [0.02, 0.28] |
| openai-astra − anthropic-fable | 0.216 | [0.10, 0.33] |
| openai-terra − gemini-3.8-high | 0.343 | [0.21, 0.48] |
| openai-terra − gemini-3.8-medium | 0.265 | [0.17, 0.37] |
| openai-terra − anthropic-sonnet | 0.029 | [-0.11, 0.17] |
| openai-terra − anthropic-fable | 0.088 | [-0.05, 0.23] |
| gemini-3.8-high − gemini-3.8-medium | -0.078 | [-0.16, 0.00] |
| gemini-3.8-high − anthropic-sonnet | -0.314 | [-0.43, -0.20] |
| gemini-3.8-high − anthropic-fable | -0.255 | [-0.37, -0.13] |
| gemini-3.8-medium − anthropic-sonnet | -0.235 | [-0.36, -0.12] |
| gemini-3.8-medium − anthropic-fable | -0.176 | [-0.26, -0.10] |
| anthropic-sonnet − anthropic-fable | 0.059 | [-0.06, 0.20] |

## Evidence and limits

Bound receipts: 612 generation and 3672 judgment receipts. The private ledger hash is `a2aea213c1d5abcb3918198425be0ee3b9c3222ae129e679e92978ad4a3cd5eb`. Source commits, terminal job records, original snapshots, evaluator protocols and file/receipt hashes are retained in the JSON companion.

Observed generation wall time under shared concurrent load and different transports. No causal speed claim, provider cost claim, or isolated latency benchmark.

- The 34 curated regression source fixtures have no authenticated human-vs-AI authorship or human-quality labels. Naturalness and semantic verdicts are model-rated. Three repeats do not make 102 independent fixture samples.
- OpenCodex response.model echoes a requested alias. Identity admission checks recorded response, assistant-message or profile evidence only. Configured provider families do not prove different upstream models or weights.
- Old E and corrected G evaluator runtimes/protocols remain separate. Every old valid and invalid response is revalidated unchanged; the original rows, schema flags, protocols and receipts are preserved.
- All selected jobs and matrices must be terminal and complete before ranking. A successful job exit alone is insufficient; row matrices, public/private parity, snapshots and receipt sequences are checked too.
- The language mix is fixed at 11 EN, 11 KO, 6 ZH and 6 JA fixtures. Bootstrap intervals do not correct selection bias, shared judge bias, changed model aliases, or uncertainty in whether anchor verdicts are true. Pairwise intervals are unadjusted descriptive comparisons.
- The score order is a rule-based confirmation result, not a deployment recommendation. No defaults, score gates, core skill, or transport behavior are changed. No additional model call was made.
- Public files contain summaries, recorded identifiers and integrity hashes. Source/rewritten text, anchors, rationales and raw responses remain private.

## Reproduce offline

```sh
node scripts/research/confirm-model-results.mjs --check
```

The default sources are the frozen sibling E, D and G worktrees. `--workspace DIR` changes only their common parent. `--write` writes this Markdown/JSON pair and a gitignored private ledger under `/tmp/patina-full-rewrite-confirmation-20260905`. `--check` reproduces both public files and the private ledger. The command makes no network request or model call and never writes to a source study.

# Number-safety failures: measured, then found to be a probe artifact

> **Corrected.** An earlier version of this note was titled "number-bearing
> documents fail the safety gate, and Pro pays for it" and treated the gate as a
> live customer-harm path. Follow-up measurement on customer-shaped drafts does
> not support that. The failures were real but the probes were not
> representative. The retraction is below, kept in place rather than deleted so
> the reasoning error stays visible.

## What actually happens on customer-shaped input

Production runs against `https://patina.vibetip.help/api/rewrite`, free tier,
drafts written as a product-update post with ordinary numeric density:

| draft | chars | numerals | runs | terminal | numerals dropped |
|---|---:|---:|---:|---|---|
| product update, short | 1,190 | 6 | 3 | **done** ×3 | **none** |
| product update, long | 2,400 | 14 | 3 | **done** ×3 | **none** |

Six for six, with every numeral preserved in the output. The gate does not fire
on this material at either length.

## What the failing probes actually were

Every failure reproduced only on input that no customer would paste:

| probe family | why it is not representative |
|---|---|
| `examples/*.md` (1,270–1,624 chars) | patina's own before/after documents — dense with scores, percentages, version strings, and table data. Numeric density far above prose. |
| concatenated fixture paragraphs (2,301–19,540 chars) | unrelated paragraphs joined to hit a length target. The topic jumps invite compression, and compression is what drops a claim. |

Raw results retained for the record:

| probe | chars | digits | terminal | rewrite attempts |
|---|---:|---|---|---:|
| digit-free fixture prose | 900 | no | done | 1 |
| digit-free fixture prose | 2,301 | no | `number_safety_failed` | 2 |
| digit-free fixture prose | 2,693 | no | `number_safety_failed` | 2 |
| digit-free fixture prose | 2,806 | no | done — rescued by the retry | 2 |
| digit-free fixture prose | 7,560 | no | `number_safety_failed` | 2 |
| digit-free fixture prose | 19,540 | no | `number_safety_failed` | 2 |
| `round3-gemini-3-casual-full.md` | 1,624 | yes | `number_safety_failed` | 2 |
| `round3-claude-casual-full.md` | 1,489 | yes | `number_safety_failed` | 2 |
| `sample-rewritten-claude.md` | 1,270 | yes | `number_safety_failed` | 2 |

Every failure reported `numeric_claim_changed` from `numeric-safety-v2`. One
diagnosed case had the original carrying claim `number:1/1` and the rewrite
carrying none — the gate refusing a dropped number-word, which is the gate
working as designed.

## The reasoning error

Two probe families both failed, which looked like corroboration. It was not:
they share the property of being unlike customer prose, and neither was tested
against the alternative before the alarm was written. The correct move — testing
a customer-shaped draft — was named in the first version as future work and
should have been the first step instead.

## What remains true and worth fixing

`src/rewrite-handler.js` charges the daily and monthly counters with, in its own
words, "no refund path". So when the gate does fire on a Pro request, the
customer still spends one of 100 monthly requests plus its characters against
the 50,000 total, and receives an error. That is wrong on its own terms — our
gate rejected our own rewrite — independently of how often it happens.

On this evidence it is a correctness issue rather than an emergency: the trigger
rate on realistic input is low enough that six consecutive production runs never
hit it. A refund path still needs a bound, because the rule exists to stop
crafted always-failing input from buying unlimited free inference.

## What this evidence does **not** justify

Changing the rewrite prompt. The earlier note named reducing the rewriter's
numeral drift as "the real fix"; on customer-shaped input there is no measured
drift to reduce. Touching the rewrite prompt on this basis would be a change
made against an artifact.

## Cost, measured on the production path

A trap worth naming: the scoring reasoning cut is scoped to
`request.provider === 'gemini'`, and omitting that field silently serves the
pre-cut cost. Isolated on the same 518-character input:

| `request.provider` | scorer thinking (MPS / fidelity) | full pipeline |
|---|---|---:|
| unset | 923 / 497 | $0.0573 |
| `'gemini'` | **0 / 0** | **$0.0311** |

So the production-path cost of a 518-character English request is **$0.0311** —
about $3.11 of COGS for a full 100-request month against $8.49 net revenue,
roughly **63% margin**, better than the ~55% on record. A failed request costs
rewrite attempts only, measured at $0.069–$0.089 on the 19,540-character probe.

## Reproduction

Local probes used `runWebRewriteStream` directly with `GEMINI_API_KEY`, reading
`result.numberSafety` and `result.attempts.rewrite[].usage`. The
customer-shaped drafts ran against production on the free tier. No customer data
was involved.

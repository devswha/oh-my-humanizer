# Resolved: the register failures were a scoring bug (2026-07-26 → 07-27)

**Status: closed on 2026-07-27.** The premise of this document — five registers
failing on every engine, unmovable by engine choice — was an artifact of the
measuring apparatus. Two defects in it, once fixed, took the same engine on the
same 22 fixtures from 9/22 to 20/22, and Korean from 2/11 to 11/11. What
remains is two English fixtures, described at the end.

## Outcome after both fixes

| | broken rubric | fidelity fixed | + prompt parity |
|---|---:|---:|---:|
| pass | 9/22 (41%) | 17/22 (77%) | **20/22 (91%)** |
| MPS mean | 76.3 | 80.5 | **90.4** |
| ko | 2/11 | 5/11 | **11/11** |

Two defects, both in the measuring apparatus rather than the product:

1. **The fidelity rubric** charged removal of marketing hype as omitted claims,
   required the rewritten register to match the original, and penalized the
   shortening filler removal causes. It was failing correct rewrites in
   production, not only in the harness.
2. **The harness prompt** omitted the persona. v6.2 made the persona the sole
   voice owner and both shipping surfaces moved with it; the harness did not,
   so for Korean it dropped the directive ordering the model to preserve every
   claim, figure, and quotation. Meaning was being measured on rewrites that
   were never told to preserve meaning.

Every register this document called systematically broken now passes:
`ko-instructional` MPS 20 → 100, `ko-marketing` 50 → 100, `ko-social` 40 → 100,
`ko-blog` 45 → 70, `ko-product` 50 → 80. Final run used the subscription seats
(`gemini-3.6-flash` rewriting, `gpt-5.5` judging) and cost nothing.

## What is actually left

Two fixtures, both English, and they fail in opposite directions:

| fixture | status | MPS | fidelity | AI score |
|---|---|---:|---:|---|
| en-marketing-01 | fail | 60 | 75 | 35.6 → 5.7 |
| en-public-docs-01 | warn | 70 | 91.7 | 15.6 → 16.5 |

`en-marketing-01` strips hype thoroughly — the AI score falls from 35.6 to 5.7
— but loses anchors doing it. `en-public-docs-01` is the reverse: meaning
holds, and the AI score does not improve, so the rewrite is too timid there.

Neither is a register-wide failure and both are single fixtures. Add a second
fixture per register before treating either as a pattern; this document is
itself the record of what happens when one fixture is read as a trend.

## Historical record: the original observation

Everything below is the 2026-07-26 analysis, kept because it shows how the
rubric bug presented and how it was traced. Its conclusions are superseded.

## The observation

Two unrelated frontier engines were run over all 22 live-quality fixtures with
the same fixed independent judge (`gpt-5.3-chat-latest`, calibrated AUC 0.99).
They fail the same 11 fixtures:

| fixture | gemini-3.6-flash | claude-sonnet-5 |
|---|---|---|
| en-blog-01 | mps 85 / fid 58.3 | mps 20 / fid 25 |
| en-instructional-01 | mps 83.3 / fid 41.7 | mps 100 / fid 58.3 |
| en-marketing-01 | mps 80 / fid 50 | mps 60 / fid 33.3 |
| en-product-01 | mps 40 / fid 41.7 | mps 40 / fid 41.7 |
| en-public-docs-01 | mps 66.7 / fid 58.3 | mps 85.7 / fid 66.7 |
| en-social-01 | scoring error | mps 76 / fid 66.7 |
| ko-blog-01 | mps 50 / fid 50 | mps 64 / fid 66.7 |
| ko-instructional-01 | mps 20 / fid 58.3 | mps 64 / fid 50 |
| ko-marketing-01 | mps 75 / fid 41.7 | mps 48 / fid 50 |
| ko-product-01 | mps 66.7 / fid 66.7 | mps 80 / fid 50 |
| ko-social-01 | mps 40 / fid 75 | mps 42 / fid 58.3 |

Both pass the same 6: `en-chat-01`, `en-howto-01`, `en-news-01`, `ko-chat-01`,
`ko-email-01`, `ko-public-docs-01`.

Read the failing set by register and the shape is obvious: blog, instructional,
marketing, product, and social all fail on both engines, while everything that
passes is either conversational or documentary. It is register-shaped, not
model-shaped.

## Why this is the bigger lever

Every engine measured on 2026-07-25 and 07-26 lands between 36% and 45% pass on
these fixtures. That range holds across a twentyfold price spread, from
deepseek-v4-flash at $0.003 per rewrite up to claude-sonnet-5 at $0.156. When a
ceiling ignores both price and model family that completely, whatever sets it
is not the engine — it is the prompt, or the gate that scores the prompt's
output.

**Fidelity is the blocker, not meaning loss.** Of the 11 shared failures, 9
sit below the fidelity floor. In 7 of those, MPS is 66.7 or higher. One case
is plainly self-contradictory: sonnet-5 on `en-instructional-01` scored MPS
100 with fidelity 58.3. Meaning fully preserved, yet judged unfaithful.

## What would overturn this

One run, one judge, 22 fixtures, one fixture per register. That is thin enough
that a single mis-specified fixture can look like a register-wide failure, so
treat the register grouping as a lead rather than a finding. Two checks would
settle it. Add a second fixture for each failing register and see whether the
failures follow the register or stay stuck to the individual file. Then rerun
the same 22 under a different fixed judge — if the failures move, the problem
lives in the judge, and hypothesis 1 below is already most of the answer.

Worth remembering how the earlier reads went wrong this week. A 6-fixture pass
suggested gemini-3.6-flash never dropped below MPS 80, and the 22-fixture rerun
put its floor at 20. Small samples in this harness have produced confident,
wrong conclusions twice already.

## Hypothesis 1 is confirmed — it is a scoring bug, and it is live

Hypothesis 1 below was checked on 2026-07-27 and holds. A real request to the
production free tier returned an error to the user, `floor_failed` on fidelity,
for a rewrite that was correct:

- original: "빠르게 변화하는 디지털 환경 속에서, 본 솔루션은 **혁신적인 시너지**를
  활용하여 고객에게 **전례 없는** 가치를 **원활하게** 제공합니다."
- rewrite: "디지털 환경이 빠르게 변하고 있다. 이 솔루션은 고객에게 새로운 가치를
  제공한다."
- MPS: 100. Fidelity: failed, `length_ratio_pct` 62, rationale "omits the
  specific claims about 'innovative synergy' and 'seamless delivery'".

The rewrite removed exactly the marketing packaging patina exists to remove,
and the fidelity judge charged it as omitted claims. Reading the prompt in
`src/scoring.js` shows three separate mechanisms doing this:

1. `claims_preserved` has no stylistic-packaging exemption. `scoreMPS` has one
   and states it explicitly ("removing or toning them down is the rewrite's
   job and must never be penalized"); `scoreFidelity` never received it.
2. `tone_match` scores whether "register/formality of REWRITTEN matches
   ORIGINAL". Changing an AI-sounding register is the product's entire
   function, so this criterion penalizes success by construction.
3. `length_ratio` penalizes shortening. Removing filler shortens text, so
   every clean rewrite of hype-dense copy loses points here too.

Consequences: hype-dense registers (marketing, social, product, blog) cannot
pass regardless of engine, which is exactly the observed failure set; the free
tier returns errors instead of rewrites on the copy most likely to be pasted
into a humanizer; and this week's engine comparisons are biased against
engines that strip hype most thoroughly.

Fixing this changes what the product accepts, so it is an owner decision, not
a silent patch. The minimal change is to give `scoreFidelity` the same
packaging exemption `scoreMPS` already has, and to reconsider whether
`tone_match` and `length_ratio` belong in a gate for a tool whose job is to
change tone and cut filler.

## Remaining hypotheses

2. **The fixtures are mis-specified.** `*-product-01` fails on both engines
   with MPS 40 — check whether those fixtures carry dense factual anchors
   (spec lists, numbers) that no humanizing rewrite can retain while changing
   voice, i.e. the fixture asks for something contradictory.
3. **The prompt lacks register handling.** Profiles exist for some registers;
   confirm which profile these fixtures request and whether the pattern packs
   have anything for instructional/product prose.

## Next steps

1. Decide on the `scoreFidelity` rubric (owner call — it changes what the
   product accepts). Minimal version: port the packaging exemption from
   `scoreMPS`, and drop or rescope `tone_match`.
2. Rerun the 22-fixture comparison after any rubric change. The current
   engine numbers were produced under the biased gate and should not be cited
   afterwards.
3. Only then decide whether the fidelity floor of 70 is calibrated.

## What is already settled (do not redo)

- Judge selection: `docs/research/2026-judge-calibration.md`.
- Engine cost/quality comparison and prompt-cache economics:
  `docs/operations/serving-engine-cost-20260725.md`.
- `gemini-3.6-flash` is allowlisted and is the documented default for both
  tiers as of 2026-07-26; the runtime switch is a hosting env change
  (`PATINA_PRO_PROVIDER/MODEL`, `PATINA_FREE_PROVIDER/MODEL`).
- The free tier previously served `gpt-4.1-mini`, which measured an AI-score
  improvement of 0.2 — effectively no rewrite. That is why the free default
  moved too.

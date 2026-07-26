# Open problem: five registers fail on every engine (handoff, 2026-07-26)

Recorded for the next session. This is the largest remaining quality lever and
it is **not** an engine problem — swapping the serving model does not move it.

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

## Three hypotheses, cheapest first

1. **The fidelity rubric penalizes legitimate rewriting in these registers.**
   Marketing and social text is mostly the stylistic packaging patina is
   supposed to strip; if the fidelity judge counts removed hype as
   infidelity, a correct rewrite is scored as a failure. MPS explicitly
   exempts hype (`src/scoring.js` extraction rules); check whether
   `scoreFidelity` has the same exemption. If it does not, this is a scoring
   bug, not an engine or prompt problem, and it invalidates part of every
   engine comparison recorded this week.
2. **The fixtures are mis-specified.** `*-product-01` fails on both engines
   with MPS 40 — check whether those fixtures carry dense factual anchors
   (spec lists, numbers) that no humanizing rewrite can retain while changing
   voice, i.e. the fixture asks for something contradictory.
3. **The prompt lacks register handling.** Profiles exist for some registers;
   confirm which profile these fixtures request and whether the pattern packs
   have anything for instructional/product prose.

## Next steps

1. Read `scoreFidelity`'s prompt in `src/scoring.js` and compare its
   treatment of removed stylistic packaging against `scoreMPS`. Hypothesis 1
   is cheap to confirm and would be the highest-value fix.
2. Dump the actual rewrites for `en-instructional-01` and `ko-social-01`
   (`--candidate-dir` keeps precomputed rewrites) and read them next to the
   fidelity verdicts. The harness currently discards rewrite text, so this
   needs a small change or a manual run.
3. Only after 1–2: decide whether the gate threshold (fidelity ≥ 70) is
   calibrated for these registers.

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

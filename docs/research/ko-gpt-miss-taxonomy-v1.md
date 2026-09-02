# KO GPT-family miss taxonomy, `ko-gpt-miss-taxonomy.v1`

Status: frozen review constant set for roadmap step 1 (measure-only). Changing any
number, gate, or rule here is a new taxonomy version, never a silent relabel.
Design source: [`ko-gpt-miss-review-step1-decision-20260902.md`](./ko-gpt-miss-review-step1-decision-20260902.md).
Code: `scripts/ko-miss-review-lib.mjs` (`computeMargins`, `classifyMissReason`).

This page exists so a later reviewer can reproduce every `miss_reason` from the
spec alone. It resolves the two points the reviewer's text left open (the KO
diagnostics AND gate, and deficit at equality) and freezes the encoding.

## Precondition

A row is classified only when `expected_hot = true`, `predicted_hot = false` (from
the frozen scored manifest) and `signals.document.hot = false` under the analyzer
recorded in `analysis_provenance`. Rows that the recorded analyzer flags hot are
invalid for classification; the extractor writes them to the exclusions file with
`exclusion_reason = precondition-violated:document-hot` and the diagnosis signal
ids that fire. They are counted, never labelled.

## Gate deficit

For every hot gate the observed value `x` is compared with its threshold `T` and
normalized to the threshold:

| gate form | deficit |
|---|---|
| `x >= T` or `x > T` | `max(0, (T - x) / |T|)` |
| `x < T` or `x <= T` | `max(0, (x - T) / |T|)` |
| `x` missing, or `T` missing or zero | absent |

- Deficit `0` means the value is at or past the threshold. Equality counts as `0`
  even where the analyzer's own comparison is strict (`classifyBurstiness` uses
  `<`, `classifyLexiconHot` uses `>`, `lowThresholdStrength` returns `0` at
  equality). A deficit of `0` on a row that is still a miss therefore reads as
  "exactly at the boundary", and it is within NEAR by definition.
- Absent is encoded as `{ "deficit": null, "absent": true }`. JSON has no
  infinity; the flag is the contract, the null is a guard against arithmetic.
- Values are rounded to 6 decimals after the formula.

Combination:

- AND gates take the **maximum** sub-deficit (`combine: and-max`); if any
  sub-gate is absent the whole gate is absent, because it can never be satisfied.
- OR gates take the **minimum** over present sub-gates (`combine: or-min`); the
  gate is absent only when every sub-gate is absent. Sub-gates that tie (for
  example the standard and ending-monotony burstiness gates sharing the same
  `cv` leaf) need no tie order: the family deficit is the same either way, and
  the report counts such rows as ties.
- Multiple paragraphs are an OR: the family deficit is the best paragraph, and
  that paragraph's gates are the ones recorded. All current rows are single
  paragraphs.

## Families and gates

Thresholds are the production defaults that `analyzeText` uses when no option is
passed; they are copied into every row as `analysis_options` and hashed into
`analysis_provenance.options_hash`.

| family | gate | sub-gates (`x` vs `T`) |
|---|---|---|
| `burstiness` | OR of two gates | **standard** (AND): `sentence_count >= minBurstinessSentences (3)`, `cv < burstinessBands.low (0.30)`. **ending_monotony** (AND): `token_count >= 20`, `cv < 0.30`, `da_ratio >= 0.6`, `da_count >= 2` |
| `mattr` | single | `mattr.value < mattrBands.low (0.55)` |
| `lexicon` | AND | `matches >= lexiconMinHotMatches (ko: 2)`, `density > lexiconDensityThreshold (3.0)`; with zero hits both deficits are exactly `1`, so this family can never be near without a pattern hit |
| `ko-diagnostics` | AND | `sentence_count >= 4`, `eojeol_count >= 20`, `eojeol_length_cv < 0.38`, `comma_per_sentence < 1`, `pos_matched_count >= 10`, `pos_class_diversity < 0.26` |
| `structure` | OR | `fake_candor_count >= 2`, `thematic_break_count >= 3`, `structural_classifier_score >= threshold` (absent when no private model is installed, which is the production default) |

Reading of the reviewer's "exactly one KO diagnostic rule within NEAR": the code
requires all three diagnostic rules to fire together, so the family is treated
as one AND gate whose deficit is the worst rule. `threshold-near-ko-diagnostics`
means that AND deficit is within NEAR and no other family is; the per-rule
deficits stay recorded in `margins.families.ko-diagnostics.gates`.

Markup leakage is not a family: a leaked document is hot and fails the
precondition. Skip reasons are never a root cause; the analyzer computes every
signal regardless of `skipReason`.

## Advisory presence

`advisory.present = true` when the translationese detector reports at least one
rule with matches (`translationese.byRule.length > 0`) or the KO post-editese
interference counters sum to at least one. Advisory signals are outside the hot
verdict by design and are recorded as counts only.

## NEAR and the decision tree

`NEAR = 0.10`. A family is "within NEAR" when it is present and its deficit is
`<= 0.10`. `near_families` lists them in the fixed order burstiness, mattr,
lexicon, ko-diagnostics, structure. `closest_family` is the present family with
the smallest deficit; ties resolve in that same order.

First matching rule wins:

1. two or more families within NEAR → `multi-threshold-near`
2. exactly one → `threshold-near-<family>`
3. `min_deficit < 1` → `threshold-far` (record `closest_family`; not a fix)
4. `advisory.present` → `advisory-only-coverage-gap`
5. otherwise → `no-modeled-signal`

## Review procedure constants

- Blind order per reviewer: rows sorted by
  `sha256(source_manifest_hash + "\0" + reviewer + "\0" + sample_id)`; blind ids
  are `<reviewer>-NNN` in that order.
- The blind sheet shows `signals`, the active options, and `margins` without
  `near_families`, `closest_family` and `min_deficit`, so the reviewer derives the
  code from deficits and the tree above.
- Two labels per row from distinct reviewers; a disagreement, or an agreed label
  that differs from the extractor's `computed_reason`, is unresolved until a third
  reviewer adjudicates from the same blinded view with a written rationale.
- Notes are paraphrase only: no Hangul, no quotation, at most 1000 characters.
  When the private corpus is present the validator also rejects any note or
  rationale in which a 12-character span (whitespace collapsed, NFC) occurs
  inside a source text.

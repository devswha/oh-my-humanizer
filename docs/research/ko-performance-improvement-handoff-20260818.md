# Korean performance improvement handoff — 2026-08-18

**Status:** research complete; implementation not started.

## Decision

The next Korean improvement should not add another global rewrite instruction or
more unconditional lexical substitutions. The strongest path is:

1. run Patina's existing deterministic Korean analysis **before** rewriting;
2. pass a compact, paragraph-bound diagnosis into the rewrite prompt;
3. apply structural treatment only where a structural signal fired;
4. preserve unflagged prose and bound edit churn;
5. experimentally generate two candidates, discard every safety failure, then
   rank only the survivors.

This targets the current failure mode: the contextual prompt is preferred by the
judge and preserves meaning better, but changes too much of the document and
moves the deterministic Korean AI-likeness score in the wrong direction.
Detector or provenance scores remain diagnostics, never the rewrite objective.

## Current evidence

The 2026-08-18 Korean counterbalanced A/B used 11 fixtures. Lower deterministic
AI-likeness is better.

| configuration | mean after score | mean MPS | mean fidelity |
|---|---:|---:|---:|
| shipping baseline | **5.3** | 91.5 | 95.5 |
| `ko-contextual-v1` | 11.0 | **98.0** | **99.2** |

Among consistent blind preference judgments, `ko-contextual-v1` won **7/7**;
three fixtures were order-inconsistent. This is promising naturalness evidence,
but not promotion evidence: it is a small model-judge sample, and the
AI-likeness diagnostic regressed. The production default therefore remains the
baseline.

The public efficacy study already located the residual Korean problem at the
document level: uniform explanatory rhythm, checklist-like completeness, tidy
problem→crisis→lesson arcs, repeated opener/closer shapes, and excessive
cross-document cohesion. See
[`2026-rewrite-efficacy-study1.md`](2026-rewrite-efficacy-study1.md).

## Repository gap

Patina already owns most of the necessary Korean measurements:

- spacing, comma, suffix/POS-diversity proxy and ending monotony;
- translationese and post-editese diagnostics;
- burstiness, MATTR, lexicon, discourse and structural signals;
- exact number checks plus MPS and fidelity gates.

The agent-skill path documents suspect-zone targeting. The hosted rewrite path
does not yet exploit it: `src/web-rewrite.js` builds its prompt with
`documentSignals: null`, while `src/web-rewrite-stream.js` computes deterministic
before/after evidence only after the rewrite. The model therefore receives a
large general rulebook but no authoritative answer to:

- which paragraph is actually suspect;
- whether its dominant defect is structure, rhythm, punctuation, translationese
  or vocabulary;
- which spans should be preserved;
- which natural paragraphs should be left alone.

That missing feedback loop is the first implementation target.

## External evidence

### 1. Humanize KR / `im-not-ai`

Repository: <https://github.com/epoko77-ai/im-not-ai>

The closest Korean project uses roughly 70 Korean-specific patterns, a
`light | standard | heavy` route hint, span-targeted editing, deterministic
change-rate checks, and a separate final comparison on heavy runs. The useful
transfer is the architecture, not wholesale pattern import: Patina already
covers many of its translationese, parallelism, punctuation and ending rules.

Its self-reported 60 AI / 60 pre-ChatGPT human comparison highlights negative
parallelism (`A가 아니라 B`), comma use, `~한다` concentration and absence of
long sentences. These findings are hypothesis material, not independent proof;
the corpus is small, genre-limited and not released in full.

### 2. KatFishNet

Paper: <https://aclanthology.org/2025.acl-long.1030/>

Code/data: <https://github.com/Shinwoo-Park/katfishnet>

KatFish is a Korean LLM-text benchmark spanning essays, poetry and paper
abstracts. Its language-specific feature families are word spacing, POS n-gram
diversity, and comma frequency/position/context. In unseen-model evaluation,
punctuation features were strongest in the reported tables. These features are
valuable measurement evidence, but origin detection is not writing quality.
Patina must not optimize candidate selection against KatFishNet.

### 3. GAEJO

Repository: <https://github.com/DevMinGeonPark/gaejo>

GAEJO separates LLM transformation from deterministic Korean validation. Its
retention tests cover normalized numerals, Latin technical terms, approximation,
contrast, emphasis, possibility and related nuance classes. It is narrower than
Patina—academic slide-style Korean—but supplies useful fixtures and failure
diagnostics for strengthening Method-D preservation checks.

### 4. Style and candidate-selection systems

- `stylometric-transfer`: <https://github.com/ngpepin/stylometric-transfer>
  uses versioned JSON fingerprints, local measurement, deviation feedback and a
  compliance retry. It is a design reference only: its PolyForm Noncommercial
  license precludes direct commercial code reuse without permission.
- VietQuill: <https://github.com/ngwgsang/vietquill> exposes multiple candidates
  and separate lexical, semantic and syntactic estimators.
- TinyStyler: <https://github.com/zacharyhorvitz/TinyStyler> and its
  [EMNLP 2024 paper](https://aclanthology.org/2024.findings-emnlp.781/) use
  multiple samples, automatic filtering and style representations.
- HyPerAlign: <https://arxiv.org/abs/2505.00038> infers interpretable style
  hypotheses from a few user examples before generation. This supports an
  optional source-conditioned voice path, not a generic manufactured persona.

None of these projects provides Patina's complete meaning, number, polarity,
causation, MPS and fidelity boundary. Their ranking/filtering ideas may only run
after Patina's existing gates.

### 5. Korean datasets and research

- StyleKQC: <https://arxiv.org/abs/2103.13439> — 30,000 Korean questions and
  commands across formal/informal styles. Useful for short-form speech level and
  ending tests; not representative of essays or reports.
- KoBEST: <https://arxiv.org/abs/2204.04541> — COPA and SentiNeg tasks are useful
  templates for causation and negation metamorphic tests.
- KLUE: <https://arxiv.org/abs/2105.09680> — STS/NLI/RE provide secondary
  semantic-similarity, contradiction and entity-role challenges across formal
  and colloquial Korean.
- Lost in Literalism: <https://arxiv.org/abs/2503.04369> — shows supervised
  training data can introduce translationese and that polished references plus
  filtering unnatural examples improve naturalness. Korean-specific effect
  sizes were not established.
- Formal Korean writing system, 2024:
  <https://www.dbpia.co.kr/journal/articleDetail?nodeId=NODE11990072>, DOI
  `10.6109/jkiice.2024.28.11.1330`. This is the **verified** record. It describes
  KoBART trained on Korean SmileStyle plus RoBERTa/Daum-dictionary synonym
  recommendation, but the accessible abstract reports no numerical quality or
  fidelity result. `NODE12054291` is unrelated and must not be cited.

## Proposed implementation

### Phase 1 — pre-rewrite diagnosis, no new model calls

Compute `analyzeText()` on the source before building the hosted prompt. Convert
only bounded, non-sensitive results into a compact diagnosis:

```json
{
  "route": "lexical|rhythm|structure|mixed|clean",
  "paragraphs": [
    {
      "id": "P2",
      "signals": ["ending_monotony", "translationese:t2-by-passive"],
      "instruction": "repair these signals only"
    }
  ]
}
```

Requirements:

- do not expose this internal block in the returned prose;
- do not include provider/model identity or customer analytics dimensions;
- mark unflagged paragraphs as preserve-only;
- apply `ko-contextual-v1` only to paragraphs with structure/rhythm signals;
- use clause-level surgery for translationese and lexical-only signals;
- return the source unchanged on an explicit clean/no-op route where the product
  contract permits it.

Likely touch points:

- `src/web-rewrite-stream.js` — source pre-analysis and evidence plumbing;
- `src/web-rewrite.js` — accept a bounded diagnosis instead of
  `documentSignals: null`;
- `src/prompt-builder.js` — render trusted, language-specific diagnosis rules;
- `src/features/index.js` — reuse only; no LLM imports;
- `scripts/rewrite-ab.mjs` — add the treatment as research-only configuration.

### Phase 2 — deterministic Korean structure fingerprint

Add a small, versioned fingerprint rather than a composite “human score”:

- paragraph and sentence-length distributions;
- repeated opener/closer shapes;
- ending-class diversity and streaks;
- checklist/bullet and triadic grouping density;
- exhaustive parallel-section cues;
- problem→crisis→lesson or problem→list→summary arcs;
- translationese/post-editese counts by rule;
- edit churn and untouched-span ratio.

Store input/candidate deltas in research output and Audit JSON only when the
receipt schema is deliberately revised. Do not silently change the existing
receipt contract.

### Phase 3 — two candidates behind a research flag

For Korean experimental runs only:

1. create baseline-targeted and contextual-targeted candidates;
2. run exact meaning/number/polarity/causation checks on both;
3. run MPS and fidelity on both;
4. discard failures before ranking;
5. rank survivors on blind-naturalness evidence, structure-fingerprint distance,
   register/persona match and edit churn;
6. keep deterministic AI-likeness as a separately reported diagnostic;
7. roll back if no candidate survives.

Start with two candidates because three multiplies hosted cost without evidence
that the third sample pays for itself.

### Phase 4 — stronger Korean retention suite

Add metamorphic fixtures that alter exactly one property at a time:

- number, date, unit or approximation marker;
- explicit negation or modality strength;
- cause/effect direction;
- entity and semantic-role assignment;
- contrast/emphasis/possibility;
- addressee relation, honorific agreement and speech level.

KoBEST and KLUE structures can inspire tests, but check dataset licenses before
copying examples. Prefer independently authored fixtures expressing the same
logical challenge.

## Evaluation and promotion gate

Pre-register the apparatus before running the larger comparison.

### Corpus

At least 120 long-form Korean items, stratified across report, email, public
document, product/marketing, review, technical explanation, column/essay and
social/blog. Keep the final test split isolated from prompt development. Add
short-form StyleKQC-like items as a separate slice, not to the long-form mean.

### Primary outcomes

- paired blind native-Korean preference;
- naturalness, register fit and clarity as separate ratings;
- exact invariant pass rate;
- MPS and fidelity;
- edit churn and untouched-span ratio.

### Secondary diagnostics

- deterministic AI-likeness before/after;
- structure fingerprint deltas;
- latency, tokens and cost;
- model/judge and item slices.

### Minimum promotion requirements

- treatment preference win-rate confidence interval excludes 50% under the
  locked confirmatory estimator;
- no regression in exact number, polarity, causation or entity-role checks;
- the shipping MPS/fidelity floors are copied into the preregistration and
  cannot be lowered; their locked lower-tail summaries do not regress;
- no increase in cross-document house-style cohesion;
- latency and cost remain within the preregistered product budget.

The preregistration must freeze all decisive definitions before any confirmatory
output is inspected:

- confidence level, estimator and resampling/cluster unit;
- treatment of ties, abstentions, judge errors and AB/BA order inconsistency;
- the exact shipping MPS/fidelity floors and the tail quantile used for
  non-regression;
- exact-invariant acceptance (number, polarity, causation and entity roles);
- the cross-document cohesion metric, baseline and non-inferiority margin;
- latency, token and monetary budgets;
- missing-data handling, exclusion rules and stopping rule.

Deterministic AI-likeness stays in Secondary diagnostics. It cannot select a
candidate, veto promotion or determine whether an experiment proceeds.

Do not promote on mean score alone, the current 7/7 consistent subset, or the
same model acting as both producer and judge.

## Explicit non-goals

- detector bypass or detector-guided rewriting;
- translation chains through unrelated languages;
- fabricated anecdotes, quotes, citations, specifics or personal texture;
- polarity/sentiment transfer;
- unconditional punctuation or sentence-length quotas;
- replacing existing safety gates with embedding similarity or an LLM judge;
- directly copying noncommercial external code.

## Recommended execution order

1. Phase 1 diagnosis plumbing and focused tests.
2. Shadow A/B on the existing 11 Korean fixtures.
3. Add the long-form evaluation corpus and metamorphic safety suite.
4. Calibrate the fingerprint measurement-only.
5. Run the preregistered 120-item blind comparison.
6. Trial two-candidate selection only if Phase 1 improves locked native-Korean
   outcomes without a safety regression and stays within the locked budget.

This order tests the cheapest causal hypothesis first: Patina's Korean analyzer
already knows where the defects are; the hosted rewriter simply is not being
told.

# KO GPT-family miss review (step 1, measure-only)

- Generated at: 2026-09-02T08:03:22Z
- Manifest: `artifacts/rebaseline-2025/ko-gpt-miss-review.v1.jsonl` (sha256:f2b8d0874e0ac1ea68e12b771598823c1623be78ac345726d0ad6da2c32c6621)
- Exclusions: `artifacts/rebaseline-2025/ko-gpt-miss-review.v1.exclusions.jsonl`
- Source manifest: `artifacts/rebaseline-2025/rebaseline-2026.scored.public.jsonl` (sha256:a8cf8565ba0968f8571d4ed00d94bad51c0c3a5ccd290f1ba106745bc5589e86)
- Analyzer commit: eb3464d2c612c7b72b9b614796ed4fedbc4d8af1; src/features tree e99c5182ec2b06f5f797063473f5cea57ff4b01d; options sha256:c2a509d9b834f5086f0dca13778ab0c955e17b9a3cff27edd901c040204fee56
- Lexicon: 2.0.0 (sha256:c9b6fbd6ee7c57e360506e661aef2f3736c03d2e28fdd07601184dad1d3aa4fd)
- Taxonomy: ko-gpt-miss-taxonomy.v1, NEAR = 0.1
- Validation: **PASS** (regeneration 48/48 byte-identical)

Scope: one cell of the 2026 rebaseline (Korean, GPT-family, `ai-like`). Counts below describe
this cell only. They say nothing about naturalness, about other model families, or about
Korean detection in general, and none of them is a threshold recommendation.

## Population

| count | n |
|---|---:|
| candidates in the frozen manifest | 56 |
| still a miss under the current analyzer (reviewed) | 48 |
| excluded: precondition violated (now hot) | 8 |

Excluded rows are candidates the analyzer at the recorded commit now flags hot. They are listed by the signal that fires, and they are not classified.

| hot signal | n |
|---|---:|
| rhythm:ending-monotony | 8 |

| register | excluded |
|---|---:|
| blog | 1 |
| academic-summary | 7 |

## Population properties

Sentence count per reviewed row (single-paragraph rows report one number). The standard burstiness gate needs the configured minimum sentence count, so rows below it can reach burstiness only through the ending-monotony gate.

| sentences | rows |
|---|---:|
| 2 | 32 |
| 3 | 16 |

Closer burstiness gate per row (smaller deficit): standard cv gate vs KO ending-monotony gate.

| closer gate | rows |
|---|---:|
| standard | 41 |
| ending_monotony | 3 |
| tie | 4 |

## miss_reason

| miss_reason | n |
|---|---:|
| threshold-near-burstiness | 4 |
| threshold-far | 44 |

## register x miss_reason

| register | threshold-near-burstiness | threshold-far | total |
|---|---:|---:|---:|
| blog | 1 | 10 | 11 |
| academic-summary | 2 | 3 | 5 |
| product-doc | 1 | 5 | 6 |
| chat-update | 0 | 16 | 16 |
| technical-how-to | 0 | 10 | 10 |

## provider/model x miss_reason

| provider / model | threshold-near-burstiness | threshold-far | total |
|---|---:|---:|---:|
| codex-cli / gpt-5.5 | 4 | 44 | 48 |

## Closest family for threshold-far rows

Recorded as required by the taxonomy; "closest" is not "fixable".

| family | n |
|---|---:|
| burstiness | 43 |
| lexicon | 1 |

## Families within NEAR

| family | rows within NEAR |
|---|---:|
| burstiness | 4 |

## Family deficit summary

Deficit 0 = at the gate, 1 = one full threshold away; absent = the gate has no value for the row (for example no structural model).

| family | present | absent | min | median | max |
|---|---:|---:|---:|---:|---:|
| burstiness | 48 | 0 | 0.007 | 0.333 | 0.768 |
| mattr | 48 | 0 | 0.653 | 0.818 | 0.818 |
| lexicon | 48 | 0 | 0.5 | 1 | 1 |
| ko-diagnostics | 48 | 0 | 0.399 | 1.071 | 1.885 |
| structure | 48 | 0 | 1 | 1 | 1 |

## Reviewer agreement

| measure | value |
|---|---:|
| reviewed rows | 48 |
| reviewers | reviewer-a (llm-agent-claude), reviewer-b (llm-agent-gpt-5.5) |
| initial agreement | 48/48 (100%) |
| disagreements adjudicated | 0/0 |
| final label equals computed tree | 48/48 (100%) |

Confusion matrix (rows: first reviewer, columns: second reviewer):

| first \ second | threshold-near-burstiness | threshold-far |
|---|---:|---:|
| threshold-near-burstiness | 4 | 0 |
| threshold-far | 0 | 44 |

Reviewers worked from blinded sheets: blind id, scalar signal projection, active gate settings and computed margins only. Sample ids, register, provider/model, scores, hashes, the extractor's own code and raw text were hidden.

## Boundary

Discovery-only: these `text_hash`es are excluded from any later confirmatory corpus. A treatment needs its own preregistration first (see `docs/research/ko-gpt-miss-review-step1-decision-20260902.md`).

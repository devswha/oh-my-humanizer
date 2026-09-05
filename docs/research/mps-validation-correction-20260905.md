# MPS validation correction — September 5, 2026

384 screening judgments over 192 generations were replayed offline. Valid judgments changed from 373 to 363.

Correction commit: `5567e4a81fedd6f56cdd518507051c6c0db04f9d`. New derivation protocol: `75dc405f5960b9a666ec56d0bf17a31863e029c8e308a3ba0c4e3367040602c9`.

Negation was omitted. The reviewed fix restores the Polarity + Negation group specified in `core/scoring.md` §16 and rejects the original response if its reported counts or score are inconsistent.

## Validity transitions

| Transition | MPS responses | Whole judgments |
|---|---:|---:|
| valid->valid | 366 | 363 |
| valid->invalid | 10 | 10 |
| invalid->valid | 0 | 0 |
| invalid->invalid | 8 | 11 |

## Screening top two

| Screen | Original | Corrected | Newly selected; confirmation required |
|---|---|---|---|
| openai | openai-astra, openai-terra | openai-astra, openai-terra | None |
| gemini | gemini-3.8-high, gemini-3.8-medium | gemini-3.8-high, gemini-3.8-medium | None |
| claude | anthropic-sonnet, anthropic-fable | anthropic-sonnet, anthropic-fable | None |

## Candidate ranks and safety

| Screen | Candidate | Old rank → new | Safe before → after / attempted | Judge errors before → after | Corrected naturalness median | Generation median ms |
|---|---|---:|---:|---:|---:|---:|
| openai | openai-astra | 1 → 1 | 10 → 10 / 12 | 0 → 0 | 3.000 | 11430.500 |
| openai | openai-terra | 2 → 2 | 8 → 8 / 12 | 2 → 2 | 3.500 | 5485.000 |
| openai | openai-sol | 4 → 3 | 8 → 8 / 12 | 1 → 1 | 2.500 | 12791.000 |
| openai | openai-5.5 | 3 → 4 | 8 → 7 / 12 | 0 → 1 | 3.000 | 6176.000 |
| openai | openai-luna | 5 → 5 | 6 → 6 / 12 | 1 → 2 | 3.250 | 6379.000 |
| openai | openai-mini | 6 → 6 | 5 → 5 / 12 | 0 → 1 | 3.500 | 4549.000 |
| gemini | gemini-3.8-high | 1 → 1 | 7 → 7 / 12 | 1 → 1 | 3.000 | 9471.000 |
| gemini | gemini-3.8-medium | 2 → 2 | 7 → 7 / 12 | 0 → 0 | 3.000 | 10744.000 |
| gemini | gemini-3.7 | 3 → 3 | 6 → 6 / 12 | 1 → 1 | 3.000 | 6275.000 |
| gemini | gemini-3.8-low | 4 → 4 | 4 → 3 / 12 | 3 → 4 | 2.500 | 9836.000 |
| gemini | gemini-pro | 5 → 5 | 2 → 2 / 12 | 1 → 2 | 3.000 | 22035.500 |
| claude | anthropic-sonnet | 1 → 1 | 8 → 8 / 12 | 0 → 1 | 3.500 | 8366.000 |
| claude | anthropic-fable | 2 → 2 | 8 → 8 / 12 | 0 → 1 | 3.500 | 16877.000 |
| claude | anthropic-haiku | 3 → 3 | 5 → 5 / 12 | 1 → 1 | 3.500 | 48565.500 |
| claude | anthropic-opus | 4 → 4 | 4 → 4 / 12 | 0 → 1 | 3.500 | 24263.000 |
| claude | anthropic-sonnet4.6 | 5 → 5 | 3 → 3 / 12 | 0 → 0 | 3.500 | 18205.000 |

Within each screen: safe-output rate descending, model-rated naturalness median descending, generation latency median ascending, candidate ID ascending. Safety requires numeric proxy pass and two configured different-family valid judges with MPS/fidelity >=90 and zero hard failures. All generation attempts remain in the denominator.

The corrected top two remain screening candidates. Existing completed confirmations need the same retrospective validation; newly selected candidates need confirmation evidence before promotion. No confirmation dataset was inspected here.

## Evidence and derivation

- Every judgment in the three declared screening joins is included, regardless of its original valid/invalid status. Public/private parity, full matrix membership, original snapshots/protocols, committed source/fixture bytes and terminal receipt metadata are checked before correction.
- Generation prompts are rebuilt from frozen-source inputs and matched by hash; request identities and delivered rewrites are bound to original receipts. This does not claim recovery of every historical ambient configuration field.
- Both historical and corrected judge pipelines receive only the original private receipt responses through an injected callback. Every MPS, fidelity and naturalness prompt/request hash and receipt ordinal must match. No source journal, lock, row, schema flag or protocol ID is rewritten.
- The canonical polarity group includes polarity and negation anchors. The corrected validator checks the original self-reported pass counts, polarity counts and MPS. Inconsistent responses stay rejected; no counts or model scores are repaired.
- The correction has its own protocol and private ledger. Historical rows/flags remain in original; corrected status and per-receipt flags are separate. Original protocol IDs stay attached to original observations.

All 192 generation receipts and 1152 judgment receipts were bound. The private ledger SHA-256 is `e3c4613b00e90fc053b05c426420e28e76a429542108bbfb8e8a473db91045e5`. The JSON companion preserves original source/protocol/file/receipt commitments, status counts and rank changes.

| Screen | Original parent protocol | Parent snapshot |
|---|---|---|
| openai | `c2779dde62beec49c198f3faa1be494565de48f147eaf511eacc785ae3b61ef5` | `90a5395382fb803f4168ac66a243d8250851b9e2dab195ac1efbcd68efa045d2` |
| gemini | `60e90a2d1cb33f02c30bc6eaefcbe2ef8ee19ab862ae969356b44f46b6b5710f` | `eda02129432097969f964c7915979776889f7c328d8ccc8dc11ccfa46adb792e` |
| claude | `64399c90db9352c305ade1fb23419d30cd1f436a8bb0fff073f9b54765ed34e3` | `1d8202d5ccdee04e7391398995594e2d9738412c11fcd53c7e1005427298872b` |

## Limits

- Proxy response.model echoes the requested alias. Model identity here is only recorded response/assistant-message/profile evidence, not proof of upstream weights or independent upstream judge families.
- These are one-pass screening results on 12 curated source fixtures per candidate. They do not establish a final winner, default model, human preference or authenticated authorship accuracy.
- MPS arithmetic/schema consistency does not independently certify the truth of the model’s anchor extraction or verdicts. Naturalness remains model-rated.
- Confirmation and other active D/E jobs are outside this derivation. Revalidate completed confirmation evidence under the fix and obtain missing confirmation evidence before any promotion; no paid rerun is performed here.
- Public output contains allowlisted counts, ranks, recorded identifiers and integrity hashes. Source texts, anchors, rationales and raw response/receipt bodies remain private.

## Reproduce offline

```sh
node scripts/research/revalidate-mps-evidence.mjs --check
```

The default input plans are the three supplied `/tmp/patina-{openai,gemini,claude}-join-plan.json` files. The runner reads only their declared completed screening cohorts. `--write` writes the two public report files and a private, gitignored ledger under `/tmp/patina-mps-revalidation-20260905`; no source directory receives a lock or write. Source worktrees must remain at their pinned commits. No credentials are read and network requests are disabled.

Validation code is selected separately. The plans locate the historical evaluator and protocol; `--validation-source DIR --validation-commit COMMIT` points to the reviewed correction, including the frozen G source without reading any of its study artifacts. For full joins, callers can pass the original runtime, corrected pipeline and validator to `replayBoundJudgment`. Those joins must declare their own complete matrix. The CLI is limited to these three screens.

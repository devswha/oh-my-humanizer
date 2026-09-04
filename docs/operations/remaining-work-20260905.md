# Remaining work and model evaluation

Owner request received 2026-09-05 KST: finish the remaining issues and compare
models across providers. Gemini experiments must use the existing OpenCodex
proxy, with no Gemini API key. This request resumes the parked ecosystem work.

Completion requires implementation, the issue's acceptance evidence, independent
review, the full test/lint gate, and integration into `dev`. Human ratings,
publication, live operation, and model results require their own direct evidence.
An implementation alone does not close those requirements.

## Work ledger

| Item | Required evidence | State |
|---|---|---|
| Pro monitor 503 | Diagnose production aggregate/log adapters; verified healthy monitor and recovery receipt | Diagnostics shipped in 8.1.2 (#723–725); stable log-query alias pinned; observing cron |
| Failed rewrite allowance | Bounded, idempotent recovery of charged requests/characters; concurrency and storage-failure tests | Implemented in isolated worktree; real Redis tests passed; final review |
| Model comparison | Available-model inventory, fixed protocol, repeated live runs, cross-family judges, per-provider recommendations | In progress |
| #412 live scorer benchmark | Run `src/scoring.js` against real fixture/rebaseline texts; distributions by pattern pack, recorded model/usage/errors | Harness reviewed and tested; initial pilot invalidated; validated collection next |
| #643 short-form corpus | Real human/AI sources, human labels, all requested slices and counterfactual pairs, FNR/exact-zero gates | Needs human labels |
| #159 human evaluation | 30 randomized pairs × 5 actual human raters, agreement and score/rating association | Needs raters |
| #206 VS Code | Separate repository; status score, diagnostics, selection rewrite with diff confirmation, settings, editor verification | Open |
| #207 Obsidian | Separate repository; note score/audit, selection rewrite, settings/status bar, registry submission | Open |
| #211 community packs | Starter-pack repository/schema, install/list/remove CLI, documentation and untrusted-pack tests | Open |
| #212 HF dataset | Fixture licensing review, published dataset/card, release upload workflow, links | Open |
| #284 browser extension | Separate MV3 repository; Gmail badge, local-only scoring, parity/network checks, bundled lexicons, integration docs | Open |
| Branch synchronization | Merge `main` history into `dev`, preserve research commits, delete merged work branches | Remote main/dev synchronized at 8.1.2; merged-branch cleanup in progress |
| Public benchmark/docs | Current reports, accurate versions/statuses, source-linked public claims | Open |
| GitHub cache removal | Confirm support submission/reply and inaccessible removed objects | Unverified |
| Paid conversion | Verify provider-confirmed aggregate and first paid sale without exposing customer data | Unverified |

## Operational evidence

- PR #723 merged safe monitor diagnostics and restored `main` ancestry in `dev`.
- PR #724 prepared 8.1.2; PR #725 merged `dev` into `main`. Tag `v8.1.2`
  triggered successful release run `33924994410`; both npm packages and the
  hosted version badge were verified at 8.1.2.
- The main branch's required check still named `test (18.0.0)`. Replaced it
  with the actual minimum-supported `test (18.1.0)`, retaining strict mode,
  all other required checks, and their GitHub Actions app binding. No admin
  merge bypass was used.
- Model pilot results are ineligible for recommendations after independent
  review found measurement defects. Corrected tests cover raw schemas, private
  metadata, fingerprints, concurrency, timeout/shutdown, stdin, and replay.
- Actual human raters/labels and funded API access remain requested inputs.
  The local Kimi coding configuration and Hugging Face login are being checked
  for additional usable routes; neither is a completed experiment/publication.

## Research sequence carried forward

KO GPT-family miss review and Study 4 are complete. Study 4 did not support
promotion in either language. The remaining registered sequence is:

1. Edited-AI policy/schema and corpus.
2. Human evaluation (#159).
3. Bounded deterministic merge/split and seam-only infill (H-4a).
4. Selective Korean treatment.
5. Independent meaning-proxy calibration and metamorphic checks.
6. Korean register/lexicon calibration with cold controls.
7. ZH/JA corpus expansion with source and redistribution review.

Research findings do not change the production prompt, detector, or model
defaults without their registered promotion evidence. The core skill pipeline
remains outside this implementation request.

## Execution boundaries

- Preserve the original checkout and its `research/model-sweep-20260904` commit.
  Model work uses `bot/model-evaluation-20260905` in its own worktree.
- API credentials remain outside tracked artifacts and tool output.
- Never replace missing human labels with model labels or fabricated sources.
- Treat unavailable provider models and failed runs as measured missingness;
  do not silently substitute a model or transport.
- Gemini requests are restricted to the loopback OpenCodex endpoint and an
  explicit `google-antigravity/` model ID. Direct Gemini API fallback is forbidden.

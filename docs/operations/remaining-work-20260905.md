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
| Pro monitor 503 | Diagnose production aggregate/log adapters; verified healthy monitor and recovery receipt | Discord envelope fix shipped in 8.1.3; ordinary cron returned 200; eligible alert/recovery receipt still pending |
| Failed rewrite allowance | Bounded, idempotent recovery of charged requests/characters; concurrency and storage-failure tests | Shipped in 8.1.3 (#726, #728–729); independent review, real Redis and full gates passed |
| Model comparison | Available-model inventory, fixed protocol, repeated live runs, cross-family judges, per-provider recommendations | In progress |
| #412 live scorer benchmark | Run `src/scoring.js` against real fixture/rebaseline texts; distributions by pattern pack, recorded model/usage/errors | Validated first pass: OpenAI 293/294 valid, Gemini 245/245; finalist repeats and cross-family rewrite judging in progress |
| #643 short-form corpus | Real human/AI sources, human labels, all requested slices and counterfactual pairs, FNR/exact-zero gates | Needs human labels |
| #159 human evaluation | 30 randomized pairs × 5 actual human raters, agreement and score/rating association | Needs raters |
| #206 VS Code | Separate repository; status score, diagnostics, selection rewrite with diff confirmation, settings, editor verification | Public repository, independent review and dev integration done; packaging/release awaits the inspect CLI release |
| #207 Obsidian | Separate repository; note score/audit, selection rewrite, settings/status bar, registry submission | Public repository, reviewed dev integration and isolated host checks done; live backend/release/registry follow-up remains |
| #211 community packs | Starter-pack repository/schema, install/list/remove CLI, documentation and untrusted-pack tests | Implementation and starter pack under independent review in isolated worktrees |
| #212 HF dataset | Fixture licensing review, published dataset/card, release upload workflow, links | Tools and reviewed fixture licensing merged into dev (#727); namespace decision, publication and links pending |
| #284 browser extension | Separate MV3 repository; Gmail badge, local-only scoring, parity/network checks, bundled lexicons, integration docs | Open |
| Kimi text isolation | Zero-tool/subagent profile, private metadata, cleanup and live admission | Merged into dev (#731); full tests/lint and independent review passed |
| Branch synchronization | Merge `main` history into `dev`, preserve research commits, delete merged work branches | Main is 8.1.3; dev contains main plus unreleased HF/inspect/Kimi changes; merged-branch cleanup in progress |
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
  Kimi's local coding route passed a tool-free live admission probe. The separate
  coding-model experiment is still pending; API billing results cannot be inferred
  from a subscription. Hugging Face namespace/publication remains unresolved.

The issue ledger contains eight GitHub issues. Provider model comparison and
operational follow-ups are additional tasks, not extra open issue numbers.

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

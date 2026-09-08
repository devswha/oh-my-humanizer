# Remaining work and model evaluation

Owner request received 2026-09-05 KST: finish the remaining issues and compare
models across providers. Gemini experiments must use the existing OpenCodex
proxy, with no Gemini API key. This request resumes the parked ecosystem work.

Completion requires implementation, the issue's acceptance evidence, independent
review, the full test/lint gate, and integration into `dev`. Human ratings,
publication, live operation, and model results require their own direct evidence.
An implementation alone does not close those requirements.

Status checked 2026-09-07. The
[September 6 scope decision](https://github.com/devswha/patina/issues/643#issuecomment-5559803306)
defers human evaluation and work requiring owner time. Human acceptance criteria
stay unmet; they are not active recruitment or annotation tasks.

## Work ledger

| Item | Required evidence | State |
|---|---|---|
| Pro monitor 503 | Diagnose production aggregate/log adapters; verified healthy monitor and recovery receipt | Discord envelope fix shipped in 8.1.3; ordinary cron returned 200; eligible alert/recovery receipt still pending |
| Failed rewrite allowance | Bounded, idempotent recovery of charged requests/characters; concurrency and storage-failure tests | Shipped in 8.1.3 (#726, #728–729); independent review, real Redis and full gates passed |
| Model comparison | Available-model inventory, fixed protocol, repeated live runs, cross-family judges, per-provider recommendations | Six-finalist confirmation and qualified guide published September 5; Kimi and other unconfirmed routes retain the guide's limits |
| #412 live scorer benchmark | Run `src/scoring.js` against real fixture/rebaseline texts; distributions by pattern pack, recorded model/usage/errors | Complete: 930/931 valid fixture observations plus 85/85 separate rebaseline observations; issue closed September 5 |
| #643 short-form corpus | Real human/AI sources, human labels, all requested slices and counterfactual pairs, FNR/exact-zero gates | Open; human acceptance deferred. Automation-only runner changes and September 6 diagnostics are recorded below |
| #159 human evaluation | 30 randomized pairs × 5 actual human raters, agreement and score/rating association | Open but deferred; no rater recruitment or owner annotations in the active stream |
| #206 VS Code | Separate repository; status score, diagnostics, selection rewrite with diff confirmation, settings, editor verification | Complete: 1.1.0 VSIX and editor guide available; issue closed. Client retired September 8; local repository deleted, remote repository left unchanged |
| #207 Obsidian | Separate repository; note score/audit, selection rewrite, settings/status bar, directory submission | 1.0.0 release and actual host/backend checks complete; client retired September 8 (local repository deleted, remote left unchanged). Community directory submission classified not planned; the issue remains open and no closure command has been recorded |
| #211 community packs | Starter-pack repository/schema, install/list/remove CLI, documentation and untrusted-pack tests | Complete in 8.2.0; issue closed. Starter repository archived and local copy deleted September 8; removal of the optional community-pattern CLI commands is being integrated separately |
| #212 HF dataset | Fixture licensing review, published dataset/card, release upload workflow, links | Export/licensing tools complete; public upload unverified. Issue closed as not planned on September 5, not as a completed publication |
| #284 browser extension | Separate MV3 repository; Gmail badge, local-only scoring, parity/network checks, bundled lexicons, integration docs | Preview released; client retired September 8 (local repository deleted, remote left unchanged). Signed-in Gmail acceptance, store publication, Notion and LinkedIn classified not planned; the issue remains open and no closure command has been recorded |
| Kimi text isolation | Zero-tool/subagent profile, private metadata, cleanup and live admission | Merged into dev (#731); full tests/lint and independent review passed |
| Branch synchronization | Merge `main` history into `dev`, preserve research commits, delete merged work branches | September 7 baseline: main and dev both at 38423d3; source/web 8.4.0, npm 8.3.0 while publication is on hold |
| Public benchmark/docs | Current reports, accurate versions/statuses, source-linked public claims | September 5 scorer/rewrite reports are published; this ledger and the roadmap now distinguish completed, unverified and deferred work |
| GitHub cache removal | Confirm support submission/reply and inaccessible removed objects | Unverified; no support receipt or removed-object identifiers recorded as of September 8 |
| Paid conversion | Verify provider-confirmed aggregate and first paid sale without exposing customer data | Unverified; an empty log-query result is not evidence of zero sales while retention is unknown |

### September 7 read-only operations check

- Production logs returned 12 monitor requests, all HTTP 200, between 04:45:46
  and 07:30:46 UTC. The durable warning/recovery records could not be read:
  their credentials are sensitive Vercel values unavailable to the local check.
  A successful response is not an eligible `OBS-ALERT-v1` receipt.
- The available webhook-log query returned no rows from August 4 onward, but
  log retention and completeness are unknown. No usable Polar authorization
  was available to confirm paid-order counts, amounts or a first-paid date.
  This result does not establish zero sales. Daily funnel counters expire after
  35 days and contain counts, not payment amounts (`api/polar-webhook.js`).
- Both npm packages still serve 8.3.0. Release run `33956693238` failed at
  `patina-cli@8.3.1` publication with E404 after verification passed. Run
  `33983046367` passed verification and GHCR publication but skipped npm.
  September 7 read-only authentication checks returned 401 for the local npm
  token/session. Usable publishing authorization must be restored before
  publication resumes; expiry, revocation and token equivalence are unverified.

No payment, synthetic alert, message, credential change or publication was
performed by this check.

## September 8 editor-client retirement and documentation reconciliation

Owner decision: the first-party VS Code extension, Obsidian plugin and Gmail
browser-extension preview are retired. The local client repositories were
deleted; the remote repositories `devswha/patina-vscode`,
`devswha/patina-obsidian` and `devswha/patina-extension` were left unchanged
and were verified public and unarchived on September 8. Releases published
before retirement remain as they were. No Marketplace, Obsidian Community
directory or Chrome Web Store listing was ever claimed, so retirement
requires no takedown.

The community starter-pack repository `devswha/patina-community-packs` was
verified archived on September 8, and its local copy was deleted. Removal of
the optional community-pattern CLI commands is being integrated separately;
licensed Pro `patina pack` delivery is unaffected.

`docs/integrations/editors.md` is now a short historical record instead of an
installation guide, so existing inbound links keep resolving without
advertising active products. The four root READMEs, the roadmap and this
ledger were reconciled to classify each item as active, retired, deferred or
externally unverified. Current operational status and the exact unresolved
prerequisites are recorded in
[non-npm-status-20260908.md](non-npm-status-20260908.md).

## Operational evidence

- PR #723 merged safe monitor diagnostics and restored `main` ancestry in `dev`.
- PR #724 prepared 8.1.2; PR #725 merged `dev` into `main`. Tag `v8.1.2`
  triggered successful release run `33924994410`; both npm packages and the
  hosted version badge were verified at 8.1.2.
- The main branch's required check still named `test (18.0.0)`. Replaced it
  with the actual minimum-supported `test (18.1.0)`, retaining strict mode,
  all other required checks, and their GitHub Actions app binding. No admin
  merge bypass was used.
- Earlier model pilot results were rejected after measurement defects were found.
  The corrected [confirmation report](../research/model-rewrite-confirmation-20260905.md)
  and [model guide](../research/model-guide-20260905.md) record the later results
  and remaining route, judging and billing limits. They do not change defaults.
- Kimi Code has preliminary results, not a completed confirmation recommendation.
  Human ratings and manual rights review are deferred under the September 6
  scope decision. Hugging Face publication remains unverified; its issue was
  closed as not planned.

The September 7 GitHub query returned four open issues: #207, #284, #159 and
#643. A September 8 re-check returned the same four. #207 and #284 are now
classified retired/not planned after the editor-client retirement; they stay
open until an explicit closure command is recorded. #159 and #643 remain
deferred. Provider comparison limits and operational follow-ups are separate
from that count. A closed issue does not by itself prove external
publication.

## September 6 automated short-form evidence

The [collection receipt](https://github.com/devswha/patina/issues/643#issuecomment-5559793246)
records 12/12 completed generation calls, 11 unique outputs and three retained
numeric-proxy failures. The
[diagnostic receipt](https://github.com/devswha/patina/issues/643#issuecomment-5560031158)
records eight valid observations on six unique curated/derived texts, all with
unknown labels. Exact zeros were 2/8; analyzer/final disagreement at the
descriptive cutoff of 30 was 3/8. Dash-minus-comma final deltas were +1.43 in
both social and default pairs. These are model diagnostics, not corpus error
rates or isolated causal punctuation effects. All eight rows replayed without
additional provider calls.

That receipt records 2,176 tests passed, two skipped, lint passed, analyzer
49/49 and scorer 8/8. Those are September 6 results, not a fresh test run by
this status update. The associated runner changes preserve hashes, explicit
document types and unknown labels; they do not complete #643's deferred
human-labeled acceptance criteria.

## Research sequence carried forward

KO GPT-family miss review and Study 4 are complete. Study 4 did not support
promotion in either language. The historical registered sequence below is
retained for context; the September 6 scope decision leaves human-dependent
steps deferred rather than active next actions:

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

- Preserve the original checkout and uncommitted scorer work. Each active
  implementation/review session uses its own worktree and bot branch from dev.
- API credentials remain outside tracked artifacts and tool output.
- Never replace missing human labels with model labels or fabricated sources.
- Treat unavailable provider models and failed runs as measured missingness;
  do not silently substitute a model or transport.
- Gemini requests are restricted to the loopback OpenCodex endpoint and an
  explicit `google-antigravity/` model ID. Direct Gemini API fallback is forbidden.

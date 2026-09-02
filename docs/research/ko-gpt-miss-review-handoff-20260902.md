# KO GPT-family miss-review — next-session handoff

Status: **roadmap order recorded; Sol Pro review not yet sent**  
Date: 2026-09-02  
Branch: `bot/performance-roadmap-sol-review`  
Base: `dev` at merge commit `6e3a19d` (PR #713)

## Goal

Review performance-roadmap step 1, **KO GPT-family miss-review manifest**, with GPT-5.6 Sol Pro before implementing a collector, manifest, taxonomy, threshold, pattern, lexicon, or runtime change.

The review must decide whether this is the correct highest-priority performance task and produce an actionable scope, data contract, root-cause taxonomy, acceptance criteria, leakage controls, and go/no-go recommendation.

## Frozen performance-only order

`docs/research/humanization-data-backlog.md` now records this order:

1. KO GPT-family miss-review manifest.
2. Edited-AI intake and corpus.
3. Rewrite human-evaluation panel.
4. Deterministic structure-transform experiment.
5. Selective Korean treatment.
6. Meaning-proxy calibration.
7. KO register and lexicon calibration.
8. ZH/JA corpus expansion.

Only step 1 is active. Do not start later steps or change production behavior on this branch.

## Current working state

- Modified: `docs/research/humanization-data-backlog.md` (the ordered plan above).
- Added: this handoff.
- No Sol prompt was submitted, no new pack was created, and no new response was harvested.
- The attempted environment probe stopped fail-closed because another OMG ChatGPT CDP automation held the browser lock: `RuntimeError: another OMG ChatGPT CDP automation is running`.
- The user confirmed another OMG session was active and instructed this session to stop. Wait for that job to finish; never bypass or delete the CDP lock.
- Existing `.insane-review/live.log` / `harvest.log` belong to earlier reviews. Do not treat them as evidence for this task.

## Required Sol Pro question

> Review step 1 of Patina's performance-only roadmap: the KO GPT-family miss-review manifest. Assess whether this is the correct highest-priority performance task. Refine the scope, row-level data contract, root-cause taxonomy, sampling and reviewer procedure, acceptance criteria, leakage/privacy controls, and separation between measure-only findings and later behavior changes. Identify methodological traps, label leakage, corpus leakage, threshold overfitting, register/model-family confounds, and risks from inspecting private raw text. Give an actionable GO / REVISE / NO-GO recommendation. For every material claim, cite file:line and quote the relevant code or text. Do not propose product, payment, launch, or marketing work.

## Complete review context to pack

Pack full content without `--compress`, comments removal, or line removal. Keep the set design-focused and exclude ignored/private raw corpora and all `.env*` files.

Core decision/evidence:

- `docs/research/humanization-data-backlog.md`
- `docs/research/2026-rebaseline.md`
- `docs/benchmarks/rebaseline-audit-ko-latest.md`
- `docs/benchmarks/rebaseline-ko-latest.md`
- `docs/research/ko-confirmatory-verdict-20260901.md`
- `docs/research/ko-performance-improvement-handoff-20260818.md`
- `docs/research/2026-rewrite-efficacy.md`
- `docs/research/2026-rewrite-efficacy-study3.md`

Current deterministic boundaries:

- `src/features/index.js`
- `src/features/korean-diagnosis.js`
- `src/features/korean-invariants.js`
- `src/features/korean-structure-fingerprint.js`

Manifest/intake implementation and contracts:

- `scripts/rebaseline-intake.mjs`
- `scripts/rebaseline-build-claim-manifest.mjs`
- `scripts/rebaseline-generate-modern.mjs`
- `tests/quality/rebaseline-manifest.example.jsonl`
- `tests/unit/rebaseline-intake.test.js`
- `tests/unit/rebaseline-build-claim-manifest.test.js`
- `tests/unit/rebaseline-generate-modern.test.js`
- `tests/unit/korean-diagnosis.test.js`
- `tests/unit/korean-invariants.test.js`
- `tests/unit/korean-structure-fingerprint.test.js`

Before sending, audit the engine's `📦 패킹 포함 N개 파일` list against this set. Secretlint is mandatory. If a required file is excluded, sanitize a tracked copy rather than bypassing secret detection.

## Safe execution procedure

1. Verify the hardened OMG runtime binding and resolve `bin/pack_and_ask.py` from that binding.
2. Run `--check-env`; require the final `STATUS` to report `node/deps/browser/login=yes` and the saved browser.
3. Prefer `~/workspace/sol-lane/.venv/bin/lane` when available.
4. The repository root contains ignored `.env*` material that previously triggered the lane root guard. Create a tracked-files-only detached review worktree, for example under `/tmp/omg-ir/patina`, from this committed branch. Never copy `.env`, `.env.bak-*`, credentials, private corpus rows, or other ignored files.
5. Run lane review with the exact include set above, GPT-5.6 Sol at Pro/max reasoning, streaming enabled, and a wait budget of at least 4,200 seconds. Do not use `--compress` or `--force-answer-after`.
6. Validate model selection and completion fail-closed. On a paid-message timeout, use lane `harvest`/`salvage`; do not send a duplicate prompt until recovery is exhausted.
7. Read the complete saved `.insane-review/response_*.md`. Report GPT-5.6 Sol Pro's opinion separately from the executing agent's judgment.
8. Do not implement manifest tooling or change thresholds in the review turn. Persist the reviewed GO/REVISE/NO-GO decision first.

## Step-1 constraints already decided

- Measure-only: no threshold, score weight, pattern, lexicon, prompt, or runtime change in the same step.
- Analyze up to 100 currently available KO GPT-family misses, or all available misses when fewer.
- Do not commit private raw generated/user text when hashes and metadata suffice.
- Keep register and model-family fields explicit; do not convert a single miss cluster into a global Korean threshold change.
- MPS/fidelity are meaning checks, not naturalness labels.
- Any future treatment requires its own branch, preregistration, held-out corpus, and promotion gate.

## Completion receipt expected from the next session

- Sol Pro response artifact path and conversation URL.
- Audited packed-file list and any exclusions.
- Sol verdict: GO / REVISE / NO-GO.
- Final step-1 schema and taxonomy after reconciling the review.
- Explicit list of deferred implementation tasks.
- Focused documentation verification, clean git status, commit, push, and PR into `dev` only after the handoff/review documentation is coherent.

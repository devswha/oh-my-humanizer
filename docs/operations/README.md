# docs/operations — maintainer records

Dated records of the Pro launch: payment provider, serving engines, cost and
margin, secrets, rollback, monitoring. They are evidence and decision records
for maintainers, not user documentation; nothing under this directory is
needed to run patina. This index (written 2026-09-02) says which file is
live, which is terminal, and which must not be edited.

## Rules

- **Hash-frozen** (`tests/unit/v6.4-preflight-hold.test.js` verifies SHA-256s
  from `v6.4-preflight-hold.json`): `pro-launch.md` and the six `pay-*.json`
  evidence files. Editing, moving, or deleting them fails `npm test` until the
  owner re-freezes the hashes.
- **Append-only by their own header:** `dep-prod-disabled-20260803.md` (private),
  `polar-approval-20260803.md`, `secret-manager-record-20260803.md`. Add a
  dated section; never rewrite the body.
- `v6.4-preflight-hold.json` still reads `HOLD_NO_PROMOTION` with all nine
  human blockers at `evidence: null`, although checkout opened on 2026-08-04
  and 7.0.0 → 8.1.0 shipped. The release-ready guard is version-gated to
  6.4.x, so at 8.x it only freezes hashes. Wiring the exit records below into
  it is an owner task.

## Live documents (start here)

| file | role |
|---|---|
| `pro-launch.md` | sale-close / service-kill / key-rotation runbook (v6.4 framing, frozen) |
| `live-open-20260804.md` | terminal record: checkout enabled on production via Polar |
| `rollback-drills.md` | measured sale-close drill used by live-open |
| `dashboards/pro-launch-v1.md`, `queries/pro-launch-v1.md` | private monitor operating procedure and queries (`services/log-query/`) |
| `pro-margin-decision-20260729.md` | Pro cap = 100 rewrites/month; cited from `src/web-rewrite-contract.js` |
| `serving-engine-gemini-3.7-flash-20260813.md` | latest engine decision: 3.7-flash allowlisted opt-in, Pro pin unchanged |
| `free-tier-deepseek-flip-20260803.md` | 2026-08-03 free-tier flip to deepseek; **superseded** — owner confirmed on 2026-09-02 that the free tier serves on gemini (env `PATINA_FREE_MODEL`) |

## Evidence chains (read the last node first)

1. **Payment:** `payment-provider-reset-20260729.md` (private) (Lemon Squeezy declined)
   → `polar-application-prep.md` (private) → `polar-onboarding-steps.md` →
   `polar-integration-evidence-20260729.md` → `polar-binding-migration.md` →
   {`polar-approval-20260803.md`, `secret-manager-record-20260803.md`,
   `dep-prod-disabled-20260803.md`} → `gate-b-readiness-20260803.md` →
   `synthetic-license-20260804.md` (private) → **`live-open-20260804.md`**.
   The Lemon Squeezy-era `owner-actions-go-live.md` and
   `production-go-live-checklist.md` were TERMINAL and were removed on
   2026-09-02 (git history keeps them).
2. **Cost and margin:** `g002-collector-redesign.md` → `pay-b-cost-v1.md`
   → **`pro-margin-decision-20260729.md`**; `number-safety-failure-rate-20260730.md` (private)
   is a corrected side measurement whose refund-path item is still open.
3. **Serving engine:** `serving-engine-cost-20260725.md` →
   `register-failure-handoff-20260726.md` (research, closed 2026-07-27) →
   `serving-engine-deepseek-0731-20260803.md` (retracted) →
   **`serving-engine-deepseek-0731-correction-20260803.md`** →
   **`free-tier-deepseek-flip-20260803.md`**; `serving-engine-gemini-3.7-flash-20260813.md`
   is a self-contained branch.

## Known open loops (recorded, not resolved here)

- First healthy `OBS-ALERT-v1` receipt after live-open: no record found.
- Refund path for number-safety failures (`src/rewrite-handler.js` still says
  "no refund path").
- Free-tier engine: resolved 2026-09-02 — owner confirmed gemini; no record
  in this directory documents the flip back from deepseek, so the env value on
  the deployment stays the source of truth.
- `secret-manager-record-20260803.md` predates 8.0.0, which removed
  `PATINA_LICENSE_PROVIDER` as a vendor selector.

## Publishing

This directory is excluded from the npm tarball (`package.json` `files`:
`!docs/operations/**`). Records marked (private) above carried processor correspondence, operator
identities, an internal deployment URL, or raw cost figures; on 2026-09-02
they were moved to the gitignored `docs/internal/` (also
`polar-form-answers.txt`). They stay on the maintainer's disk and in git
history, and the chains above still name them so the trail stays readable.

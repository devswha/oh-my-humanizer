# docs/operations — maintainer records

Dated records of the Pro launch: payment provider, serving engines, cost and
margin, secrets, rollback, monitoring. They are evidence and decision records
for maintainers, not user documentation; nothing under this directory is
needed to run patina. This index (written 2026-09-02) says which file is
live, which is terminal, and which must not be edited.

## Rules

- **The v6.4 preflight hold was retired on 2026-09-02** (owner decision):
  `v6.4-preflight-hold.json`, `scripts/check-v6.4-preflight-hold.mjs`,
  `scripts/check-v6.4-release-ready.mjs` and their tests were removed, so no
  file in this directory is hash-frozen any more. `pro-launch.md` and the
  `pay-*.json` evidence files are ordinary tracked records now.
- **Append-only by their own header:** `dep-prod-disabled-20260803.md` (private),
  `polar-approval-20260803.md`, `secret-manager-record-20260803.md`. Add a
  dated section; never rewrite the body.
- The retired hold still listed its nine human blockers as `evidence: null`
  even though checkout opened on 2026-08-04; the exit records that actually
  closed them are the chain below (`live-open-20260804.md` is the terminal
  node). Its last state is in git history (removed in the 2026-09-02
  retirement commit).

## Live documents (start here)

| file | role |
|---|---|
| `pro-launch.md` | sale-close / service-kill / key-rotation runbook (v6.4 framing; no longer hash-frozen) |
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
4. **Secrets (names only, never values):** `secret-manager-record-20260803.md`
   → **key rotation 2026-09-04**: the owner replaced `PATINA_FREE_API_KEY` and
   `PATINA_PRO_API_KEY` (Vercel Production, Sensitive) with product-only Gemini
   keys in the dashboard; production was redeployed
   (`patina-ihkxs0l2g`, alias `patina.vibetip.help`), the free tier was
   verified by one live `/api/rewrite` call, and the pro tier by the synthetic
   monitor's next scheduled run. Research jobs use a separate local key.

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

# SECRET_MANAGER — presence-only record, Vercel production scope (2026-08-03)

> Exit evidence for the `SECRET_MANAGER` blocker in
> [`v6.4-preflight-hold.json`](v6.4-preflight-hold.json). Names only — **no
> values appear in this file.** Verified via `vercel env ls` / a value check
> limited to the two boolean gate flags, from the owner's authenticated CLI.

## Present in the Vercel *Production* environment

`KV_REST_API_URL`, `KV_REST_API_TOKEN`, `PATINA_LICENSE_PROVIDER`,
`POLAR_ORGANIZATION_ID`, `POLAR_PRO_BENEFIT_ID`, `PATINA_PRO_API_KEY`,
`PATINA_LICENSE_HMAC_SECRET`, `PATINA_QUOTA_HMAC_SECRET`,
`PATINA_FREE_API_KEY`, `PATINA_PRO_PROVIDER`, `PATINA_PRO_MODEL`,
`PATINA_PRO_CHECKOUT_ENABLED`, `PATINA_PRO_CHECKOUT_URL`,
`PATINA_DEPLOYMENT_CHANNEL`, `PATINA_OBSERVABILITY_REST_API_URL`,
`PATINA_OBSERVABILITY_REST_API_TOKEN`, `CRON_SECRET`,
`PATINA_PUBLIC_BASE_URL`, `PATINA_PUBLIC_BASE_URL_SHA256`,
`PATINA_SYNTHETIC_OBSERVER_SECRET`, `PATINA_VERCEL_LOG_QUERY_URL`,
`PATINA_VERCEL_LOG_QUERY_URL_SHA256`, `PATINA_VERCEL_LOG_QUERY_TOKEN`,
`PATINA_ALERT_DISCORD_WEBHOOK`.

`VERCEL_GIT_COMMIT_SHA` is injected by Vercel at build time, not a dashboard
variable.

## Gate-flag values (the only values checked)

- `PATINA_PRO_ALLOW_FREE_KEY` = `false` — satisfies the "absent or exactly
  false" requirement.
- `PATINA_PRO_CHECKOUT_ENABLED` = `false` — checkout stays disabled.
- `PATINA_DEPLOYMENT_CHANNEL` = `production`.

## Not yet present (deliberate — set at live open)

| Name | When | Value source |
|---|---|---|
| `PATINA_PRO_GATE_EVIDENCE_ID` | Live-open step, with the enable flag | `PAY-B-20260729-POLAR-ea8385dc-4c9c3f17` (source-controlled binding) |
| `PATINA_SYNTHETIC_PRO_LICENSE` | Before Gate-B OBS monitoring | Owner issues a fresh license via the bounded forever-100% verification code; the prior verification license was shredded after use |

## Retired names still present

`LS_STORE_ID`, `LS_PRO_PRODUCT_ID`, `LS_PRO_VARIANT_ID` remain configured but
are inert while `PATINA_LICENSE_PROVIDER=polar`. Remove them after live open
stabilizes; they are no longer required by the rewritten hold.

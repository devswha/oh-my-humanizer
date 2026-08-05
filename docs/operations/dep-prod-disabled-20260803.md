# DEP_PROD_DISABLED — production deployed with checkout disabled (2026-08-03)

> Exit-evidence record for the `DEP_PROD_DISABLED` blocker in
> [`v6.4-preflight-hold.json`](v6.4-preflight-hold.json). Immutable: append
> corrections as new dated sections.

## Deployment

| Fact | Value |
|---|---|
| Release merge | PR #670, dev → main (merge commit), v7.0.0 |
| Production deployment | `https://patina-klpr5q2jo-devshwas-projects.vercel.app`, status Ready, 2026-08-03 |
| Stable alias | `https://patina.vibetip.help` |
| Deployed version | 7.0.0 (`origin/main` package.json) |
| Binding table on board | Polar production tuple only (`PAY-B-20260729-POLAR-ea8385dc-4c9c3f17`) |

## Disabled launch shape (fetched from the alias post-deploy)

`/launch-config.js` served exactly the six-field disabled artifact:
`{schemaVersion: 1, channel: "disabled", enabled: false, checkoutOrigin: null,
checkoutPath: null, evidence: null}` — no checkout button is exposed.

## Gate probes (UTC 2026-08-03, against the alias)

| Probe | Result | Meaning |
|---|---|---|
| pro tier, no Authorization | **401** `license required` | fail closed |
| pro tier, unknown license | **403** `license not entitled` | Polar gate answering on 7.0.0 |
| free tier rewrite | 200 stream, `terminal_failed` | see the incident below |

## Fail-closed regression caught during the rollout

The first preview build of this change **failed by design**: the Preview
environment still carried `PATINA_PRO_CHECKOUT_ENABLED=true` with the retired
Lemon Squeezy URL, and `generate-launch-config.mjs` refused it
(`must exactly match a source-controlled checkout evidence binding`). The
preview flag was reset to `false` and the build went green — live proof that
environment values alone cannot resurrect a dead checkout route.

## Incident (open, blocks Gate-B health evidence)

The free-tier smoke returned `terminal_failed`: the server-side Gemini key is
rejected with **HTTP 429 "project has exceeded its monthly spending cap"**.
This predates and is independent of this deployment (same key served 6.3.4).
Owner action: raise/clear the spend cap in AI Studio, then re-run the free and
pro smokes before recording Gate-B health evidence.

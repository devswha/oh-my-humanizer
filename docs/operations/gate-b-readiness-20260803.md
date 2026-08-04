# Gate B readiness — what exists, what blocks (2026-08-03)

> Working ledger for the `GATE_B` blocker in
> [`v6.4-preflight-hold.json`](v6.4-preflight-hold.json). Gate B requires:
> completed production source-binding integration, hosted identity, usage,
> dedicated runtime, content-valid PAY-B-COST evidence, and real-path OBS
> evidence — approved by the Payment Runtime Owner + maintainer.

## Satisfied

| Requirement | Evidence |
|---|---|
| Production source-binding integration | PR #668 (`db909c2`), shipped to main via PR #670; binding table carries exactly `PAY-B-20260729-POLAR-ea8385dc-4c9c3f17` |
| Hosted identity | `https://patina.vibetip.help` serving v7.0.0; deployment `patina-klpr5q2jo…` ([`dep-prod-disabled-20260803.md`](dep-prod-disabled-20260803.md)) |
| PAY-B-COST evidence | [`pay-b-cost-v1.md`](pay-b-cost-v1.md) + `pay-b-cost-20260724*.json.bundle.json`; margin decision [`pro-margin-decision-20260729.md`](pro-margin-decision-20260729.md) (~55% at 100 rewrites/mo on gemini-3.6-flash) |
| Rollback procedures | [`rollback-drills.md`](rollback-drills.md) — measured 2026-07-23 (sale-close within the 10-minute bound); owner sign-off outstanding |
| Approval + payout + KYC | [`polar-approval-20260803.md`](polar-approval-20260803.md) |
| Secret presence | [`secret-manager-record-20260803.md`](secret-manager-record-20260803.md) |

## Blocking — owner actions, in order

1. ~~**Gemini spend cap (incident).**~~ **RESOLVED 2026-08-03**: the owner
   cleared the spend cap; a direct gemini-3.6-flash probe answers again. The
   free tier no longer depends on it (flipped to deepseek,
   [`free-tier-deepseek-flip-20260803.md`](free-tier-deepseek-flip-20260803.md));
   the Pro serving path (gemini) is unblocked but can only be exercised
   end-to-end once a license exists (item 2).
2. **`PATINA_SYNTHETIC_PRO_LICENSE`.** The pro-monitor synthetic probe needs a
   real license; the prior verification license was shredded. Issue one via the
   bounded forever-100% verification code (a zero-amount checkout), hand only
   the license key to the secret manager — never paste it into the repo or chat
   logs that persist to disk.
3. **Real-path OBS evidence.** After 1 and 2: the `/api/pro-monitor` cron cycle
   must produce an ACKed healthy `OBS-ALERT-v1` receipt with `realPath: true`
   per [`pro-launch.md`](pro-launch.md) / the pro-launch-v1 dashboard spec.
4. **Gate-B approval.** Payment Runtime Owner + maintainer (both hats: owner)
   record the approval naming this ledger's evidence.

Then Gate D, rollback sign-off, `PAY_OPEN`, and the live-open env flip
(`PATINA_PRO_GATE_EVIDENCE_ID=PAY-B-20260729-POLAR-ea8385dc-4c9c3f17`,
`PATINA_PRO_CHECKOUT_ENABLED=true`, regenerate, redeploy).

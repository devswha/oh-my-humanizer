# Synthetic Pro license provisioned; production Pro path verified (2026-08-04)

> Closes item 2 of [`gate-b-readiness-20260803.md`](gate-b-readiness-20260803.md).
> No raw key, discount code, or token value appears in this record.

## Provisioning (agent-run via the Polar API, owner-supplied OAT)

1. The standing verification code ("patina test", 100% forever, 1/3 redeemed)
   is **per-customer limited**: both the owner email and a plus-alias drew
   `DiscountRedemptionLimitReached` — Polar normalizes the customer identity.
2. A fresh bounded code was created instead: 100%, `duration: forever`,
   `max_redemptions: 1`, expiry +3 days, scoped to the `patina pro` product.
3. Zero-amount checkout created and confirmed card-free
   (`total: 0`, `is_payment_required: false`, status `confirmed`) for the
   dedicated monitor identity `devswha+monitor@gmail.com`.
4. License `****-2FCE6A` (benefit `4c9c3f17…`, status `granted`) fetched via
   the org API and piped directly into the Vercel Production env as
   `PATINA_SYNTHETIC_PRO_LICENSE` — never echoed, never written to the repo.
5. The one-shot discount was **deleted** after use (204); the OAT was removed
   from the local env and its dashboard revocation recommended to the owner
   (it transited an operator chat).

## Production Pro-path verification (patina.vibetip.help, post-redeploy)

| probe | result |
|---|---|
| tier=pro with the new license | **HTTP 200**, start→done, 10.2s |
| MPS / fidelity | 100 / 100 |
| number safety | `14:30`, `23,000` preserved |
| license leakage in response | none |

This is the first end-to-end Pro observation since the Gemini spend cap was
cleared: the Polar validate → entitle → gemini-3.6-flash rewrite chain works
on the deployed production environment with a currently-issued license.

## Follow-ups

- The pro-monitor cron (`*/15`) can now exercise the real path; the next
  Gate-B step is an ACKed healthy `OBS-ALERT-v1` receipt with `realPath: true`.
- The monitor seat consumes the standard 100-rewrites/month allowance; at the
  cron cadence the synthetic probe budget must stay within it (monitor design
  already accounts for this).

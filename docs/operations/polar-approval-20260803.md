# POLAR_APPROVAL — account approved, payout connected, identity verified (2026-08-03)

> Exit evidence for the `POLAR_APPROVAL` blocker in
> [`v6.4-preflight-hold.json`](v6.4-preflight-hold.json). Immutable record:
> append corrections as new dated sections, never edit the observation below.

## Observation

Observed by the **owner** in the Polar dashboard (Finance → Account) on
2026-08-03 and reported verbatim in the operator session:

| Dashboard section | Reported state |
|---|---|
| Account Review | **"Account approved — Your product and organization details have been reviewed and approved."** |
| Payout Account | **"Payout account connected — Your Stripe payout account is configured and ready to receive payouts."** |
| Identity Verification | **"Identity verified — Your identity has been successfully verified."** |

All three clear simultaneously: the up-to-14-day first-payout review described
in [`polar-onboarding-steps.md`](polar-onboarding-steps.md) has completed, the
Stripe Connect Express payout account is attached, and KYC is done. No external
approval remains between the account and money reaching the owner.

## Approved identities

The approval covers the production identities verified by read-back in
[`pay-b-binding-polar-20260729.json`](pay-b-binding-polar-20260729.json)
(evidence `PAY-B-20260729-POLAR-ea8385dc-4c9c3f17`):

| Identity | Value |
|---|---|
| Organization | `9a9180b7-2d13-422e-b9a7-316bed61c51d` |
| Product | `ea8385dc-e21f-44bd-8ccd-2725437abb70` ("patina pro", $9.99/mo USD) |
| Benefit | `4c9c3f17-f3b9-47cd-9ca4-4295ad3957b4` (license_keys) |
| Production checkout URL | `https://buy.polar.sh/polar_cl_qKqtaZKLhUNJetr1h7XHY6wn8lRJEtG5DAPr02tG1pW` |

## Limits of this record

- Reported from the owner's authenticated dashboard session; no API field
  exposes the same three-way review state for independent re-observation, so
  re-verification means the owner re-opening Finance → Account.
- Approval does not waive the remaining hold blockers: `SECRET_MANAGER`,
  `GATE_B`, `DEP_PROD_DISABLED`, `GATE_D`, `ROLLBACK_DRILLS`, and `PAY_OPEN`
  still gate `PATINA_PRO_CHECKOUT_ENABLED=true`.
- Polar holds accounts to a 0.4% chargeback rate and 48-hour support response;
  approval is ongoing compliance, not a one-time clearance.

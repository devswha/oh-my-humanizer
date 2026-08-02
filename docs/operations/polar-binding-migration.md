# Wiring the Polar checkout into the source-controlled binding

Verified production identities live in
[`pay-b-binding-polar-20260729.json`](pay-b-binding-polar-20260729.json). Every
field there was read back from Polar, not transcribed from the dashboard.

## What already works

The **license gate is live on production** as of 2026-07-29. These three
variables switch the paid tier onto Polar, and no source change was required:

```
PATINA_LICENSE_PROVIDER=polar
POLAR_ORGANIZATION_ID=9a9180b7-2d13-422e-b9a7-316bed61c51d
POLAR_PRO_BENEFIT_ID=4c9c3f17-f3b9-47cd-9ca4-4295ad3957b4
```

Neither value is a secret — they are public identifiers that appear in an
unauthenticated checkout-session read. The license key is the secret, and it
never leaves the entitlement module.

### The paid tier works on production

A real purchase was completed against the production organization on 2026-07-29
using a forever 100% discount code — Polar's sanctioned production verification,
with no card and therefore no card-testing exposure. Full record:
[`pay-live-runtime-polar-20260729.json`](pay-live-runtime-polar-20260729.json).

| step | observed |
|---|---|
| checkout confirm | `confirmed`, 999 → 0 cents, no payment method required |
| license issued | `granted`, correct benefit, `PATINA_` prefix, no expiry or limits |
| production pro rewrite | **HTTP 200**, terminal `done`, real rewrite returned |
| number safety | `14:30` and `23,000` both preserved |
| license leakage | absent from the response body |

That is the first end-to-end proof that a paying customer can actually use what
they bought, and it took a released deployment to get there. The same license
had been rejected with `403` minutes earlier: `origin/main` at 6.3.2 shipped no
`src/entitlement-polar.js` at all, so the environment variables configured on
production had no code to read them. Setting env vars had been mistaken for
shipping the feature, and the resulting `403` had been misread as evidence the
Polar gate was live — it was the Lemon Squeezy validator declining a key it had
never issued. Shipped as v6.3.3.

Still unproven: any card-backed purchase, payout (the review governs money
reaching the owner, not the ability to sell), and refund and
cancellation-revocation behaviour on production.

The Pro monthly request cap is **partially** established. It cannot be exercised
directly without a production license, and the verification license was shredded
after use while a confirmed checkout session does not re-issue a customer token.
What was verified instead is the machinery underneath it: the free tier's hourly
burst limit fired on production with `429 hourly burst exceeded` after ten
requests in the window. The monthly Pro cap runs through the same limiter, the
same KV, and the same HMAC-keyed bucket — only the key and window differ — so the
counters demonstrably increment and block in the deployed environment. The
100-request threshold itself is still only proven against a local handler.

### Payment readiness: blocked, then opened

The organization was `status: "created"` with `details_submitted_at: null`, and
a checkout confirm — even one discounted to 0 USD with
`is_payment_required: false` — was refused outright:

```
HTTP 403  {"error":"PaymentNotReady",
           "detail":"Organization is not ready to accept payments"}
```

That retracts two successive claims made earlier in this file: first that the
link "sells today" (argued from a 307 into a priced session), then that money
was "collectable now" (argued from Polar's review-at-first-payout policy). Both
reasoned from documentation instead of from an attempt, and both were wrong. No
purchase succeeded at any price, including free.

After the owner submitted the account for review the organization flipped to
`status: "active"` with `details_submitted_at` set, and the refusal changed —
`PaymentNotReady` is gone. Payment readiness is therefore **granted at
submission, not at approval**; the up-to-14-day review governs the payout, not
the ability to sell.

### The verification code needs `duration: forever`

The end-to-end walk still cannot complete, for a reason specific to the code
rather than the account. Confirm now fails with:

```
HTTP 422  confirmation_token_id — "Confirmation token is required."
```

The discount reads `duration: "once"`, `basis_points: 10000`. A 100% discount
for a single period leaves every renewal at 999 USD, so Stripe must store a
payment method up front and the confirm demands a card-backed confirmation
token. `is_payment_required: false` describes only the first charge.

A verification code has to waive **every** period, so it must be created with
**duration = forever** at 100%. Then no payment method is needed and the confirm
should complete card-free — expected from the schema, not yet observed.

A forever-free code is a standing liability if it leaks, so it should be bounded
on creation: **max redemptions in the low single digits and an expiry date**.
Without those, anyone who finds the string holds patina Pro free permanently.
This is also the shape Polar's reviewers ask for when they request a code to
walk the purchase flow themselves — a `once` code would make them supply a card.

They were set with `vercel env add … production`, then applied by
**redeploying the existing production deployment** rather than deploying from
`dev` — environment changes take effect only on a new deployment, and the
production alias must keep serving `main`.

Why this was urgent rather than housekeeping: the Polar checkout link went live
before the gate did. Anyone who bought in that window would have received a
working Polar license that production, still configured for Lemon Squeezy,
would have refused. A paid customer holding a rejected key is worse than no
checkout at all.

Verified against `https://patina.vibetip.help` after the redeploy:

| probe | result |
|---|---|
| pro tier, unknown license | **403** `license not entitled` |
| pro tier, no Authorization | **401** `license required` |
| free tier rewrite | terminal `done`, `14:30` preserved |

The 403 is load-bearing evidence, not just a denial: a malformed
`POLAR_ORGANIZATION_ID` draws `422` from Polar, which this gate classifies as
server misconfiguration and reports as a transient **503**. A definitive 403
therefore proves the configured organization is well-formed and that Polar
actually answered.

### Allowance variables are deliberately absent

Neither `PATINA_PRO_REQ_PER_MONTH` nor `PATINA_PRO_CHARS_PER_MONTH` is set on
production, so the shipped defaults apply — **100 requests and 50,000
characters per UTC month**. This closes an earlier open question about a stale
explicit `PATINA_PRO_CHARS_PER_MONTH` overriding the new default: there is no
such override. `PATINA_SCORING_REASONING` is likewise unset, so the
gemini-only low-reasoning default stands.

### The Lemon Squeezy variables are still present

`LS_STORE_ID`, `LS_PRO_PRODUCT_ID`, `LS_PRO_VARIANT_ID`, and
`PATINA_PRO_CHECKOUT_URL` remain configured. They are inert while
`PATINA_LICENSE_PROVIDER=polar`, and they are left in place on purpose: the
v6.4 hold's `SECRET_MANAGER` blocker still enumerates them as required-present,
so removing them now would break that gate before its Polar rewrite lands.

The live `launch-config.js` is still the disabled six-field shape, so no
checkout button is exposed and no visitor can reach the dead Lemon Squeezy
checkout URL.

## What is blocked, and why it is not a re-hash

The in-app upgrade button is driven by `playground/launch-config.js`, which
`scripts/generate-launch-config.mjs` will only emit when
`PATINA_PRO_CHECKOUT_URL` exactly matches a tuple in
`scripts/checkout-evidence-bindings.mjs`. Adding the Polar tuple there trips
the v6.4 preflight hold — by design, and not merely on a file hash.

`scripts/check-v6.4-preflight-hold.mjs` requires the binding table to contain
**exactly** the two Lemon Squeezy tuples, and pins Lemon Squeezy identities as
literals: store `425473`, domain `vibetip.lemonsqueezy.com`, product
`1236551`, variant `1932893`, `activationLimit: 3`, and a
`/checkout/buy/` path prefix. The blocker list names `LS_APPROVAL`; the
`SECRET_MANAGER` blocker enumerates `LS_STORE_ID`, `LS_PRO_PRODUCT_ID`,
`LS_PRO_VARIANT_ID`.

So the hold currently certifies a payment route that no longer exists — Lemon
Squeezy declined the account. That staleness is the thing to fix, but it cannot
be fixed by editing identity constants, for one specific reason:

**`pay-stg-runtime-20260716.json` is a factual record of a real Lemon Squeezy
test-mode purchase** — order `8973866`, subscription `2347121`, license record
`1487257`, observed on a named Vercel preview deployment. Relabelling those
fields as Polar would be fabricating evidence for a purchase that never
happened on Polar. The staging chain has to be **re-earned**, not renamed.

## The honest sequence — resolution (2026-08-03)

Steps 2 and 3 are **done**; step 1 was **superseded by decision** rather than
executed; step 4 remains the deliberate owner act.

1. **Superseded.** The owner chose to rewrite the hold around the two existing
   Polar artifacts instead of re-running a sandbox purchase against a preview
   deployment. The rationale: the sandbox record
   ([`polar-integration-evidence-20260729.md`](polar-integration-evidence-20260729.md))
   already proves the purchase → license → gate mechanics with a real sandbox
   test-card purchase, and the production zero-amount purchase
   ([`pay-live-runtime-polar-20260729.json`](pay-live-runtime-polar-20260729.json))
   already proves the deployed-environment half end to end — which is strictly
   stronger than what a preview run would have shown. The supersession is
   recorded in the hold itself as the
   `PAY_STG_SUPERSEDED_BY_PRODUCTION_RUNTIME` decision (status `SUPERSEDED`,
   evidence `PAY-LIVE-20260729-POLAR-ea8385dc-4c9c3f17`), not silently skipped.
2. **Done.** `scripts/check-v6.4-preflight-hold.mjs` now validates the Polar
   chain: `PAY-B-BINDING-POLAR-v1` + `PAY-LIVE-RUNTIME-POLAR-v1` artifacts,
   `POLAR_APPROVAL` in place of `LS_APPROVAL`, `PATINA_LICENSE_PROVIDER` /
   `POLAR_ORGANIZATION_ID` / `POLAR_PRO_BENEFIT_ID` in the secret-manager
   blocker, and `https://buy.polar.sh` + `/polar_cl_*` in place of the
   `/checkout/buy/` assumption. The Lemon Squeezy evidence files remain on
   disk and hash-frozen as history; the state schema moved to version 4.
3. **Done.** `scripts/checkout-evidence-bindings.mjs` contains exactly one
   tuple — production, `PAY-B-20260729-POLAR-ea8385dc-4c9c3f17`,
   `https://buy.polar.sh` + `/polar_cl_qKqt…` — and the hashes are re-frozen.
   The dead Lemon Squeezy tuples were removed so a retired checkout route can
   never be re-authorized by environment values.
4. **Open (owner) — gated, not immediate.** Enabling checkout by environment
   (`PATINA_PRO_CHECKOUT_ENABLED=true`,
   `PATINA_DEPLOYMENT_CHANNEL=production`, the exact bound
   `PATINA_PRO_CHECKOUT_URL`,
   `PATINA_PRO_GATE_EVIDENCE_ID=PAY-B-20260729-POLAR-ea8385dc-4c9c3f17`, then
   regenerating the launch config and redeploying) is the LAST step of the
   [`pro-launch.md`](pro-launch.md) sequence, not a standalone act. The hold's
   blockers still carry null evidence: `POLAR_APPROVAL`, `SECRET_MANAGER`,
   `GATE_B`, `DEP_PROD_DISABLED` (deploy production with checkout disabled
   first), `GATE_D`, `ROLLBACK_DRILLS`, and `PAY_OPEN` must all be satisfied
   before the flag flips to `true`. Until then `PATINA_PRO_CHECKOUT_ENABLED`
   stays `false`.

## Known limitation: the Polar price ID is not pinned

`pay-b-binding-polar-20260729.json` records the price's commercial fields
(fixed, 999 cents, usd) read back from Polar but not the Polar price object ID,
so the hold pins product/benefit/checkout identities as literals while the
price is pinned only by its fields. The artifact is factsSha256-sealed, so the
ID cannot be added retroactively without fabricating evidence; capture it in
the next read-back artifact (e.g. the Gate-B observation) and extend
`validatePolarBindingEvidence` then.


## Cosmetic mismatch worth fixing in the dashboard

The product name is `patina pro` (lowercase) while the benefit reads
`patina Pro license`. Both are customer-facing on the checkout page.

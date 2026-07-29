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

The **checkout link sells today**. `https://buy.polar.sh/polar_cl_qKqt…`
returns a 307 into a live session priced at 999 USD/month with the license-key
benefit attached. Nothing in this repository has to change for a customer to
buy through that URL.

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

## The honest sequence

1. **Polar sandbox purchase against a Vercel preview deployment.** The gate is
   already proven against the sandbox API from a local process
   ([`polar-integration-evidence-20260729.md`](polar-integration-evidence-20260729.md)),
   which is not the same as a preview deployment serving `tier=pro` to a
   browser. That run produces the replacement staging runtime evidence.
2. **Rewrite the hold's payment identities** against Polar: provider-aware
   binding evidence, `POLAR_*` names in the secret-manager blocker,
   `POLAR_APPROVAL` in place of `LS_APPROVAL`, and the `/checkout/buy/` path
   assumption replaced with Polar's `/polar_cl_*`. Retain the Lemon Squeezy
   records as history rather than deleting them; they document why the provider
   changed.
3. **Add the production tuple** to `scripts/checkout-evidence-bindings.mjs`
   (`https://buy.polar.sh` + `/polar_cl_qKqt…`) with the evidence ID from the
   binding artifact, then re-freeze the hashes.
4. **Enable checkout by environment**, which is a separate deliberate act:
   `PATINA_PRO_CHECKOUT_ENABLED`, `PATINA_DEPLOYMENT_CHANNEL=production`,
   `PATINA_PRO_CHECKOUT_URL`, `PATINA_PRO_GATE_EVIDENCE_ID`.

Steps 2–4 are mechanical once step 1 exists. Step 1 needs a deployment, which
is why the button is still off while the checkout URL itself is already
sellable.

## Cosmetic mismatch worth fixing in the dashboard

The product name is `patina pro` (lowercase) while the benefit reads
`patina Pro license`. Both are customer-facing on the checkout page.

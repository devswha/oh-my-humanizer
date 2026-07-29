# Polar integration evidence (sandbox, 2026-07-29)

> What the Polar review asks to see: that the purchase → automatic access flow
> actually works end to end. This is the written record of that verification,
> run against the **live Polar sandbox** with a real sandbox-purchased license.
> Procedure and remaining owner steps: [`polar-onboarding-steps.md`](polar-onboarding-steps.md).

Environment: sandbox organization, one product with a **License Keys**
benefit, one test-card purchase (`4242 4242 4242 4242`). No production data and
no real money — Polar's own guidance is that live cards must never be used for
testing, since processors flag it as card testing.

## 1. License validation

Against `sandbox-api.polar.sh/v1/customer-portal/license-keys/validate`:

| case | HTTP | gate verdict |
|---|---|---|
| purchased license, correct organization + benefit | 200 `granted` | **allow** |
| purchased license, **mismatched benefit id** | 200 `granted` | **deny** (`benefit-mismatch`) |
| purchased license, mismatched organization | 404 | deny (403) |
| unknown license | 404 `ResourceNotFound` | deny (403) |
| repeated rapid calls | 429 `retry-after: 21` | transient (503), never cached |

The benefit row is the load-bearing one. Polar issues `granted` for *any* of an
organization's license-key benefits, so without an explicit `benefit_id` check
a key from a future free benefit would entitle the paid tier. It denies.

## 2. Through the real API handler

`createRewriteApiHandler` with `PATINA_LICENSE_PROVIDER=polar`:

| request | result |
|---|---|
| valid license | **200**, `tier=pro`, the **server** pro key reaches the runner |
| unknown license | **403** `license not entitled` |
| no Authorization header | **401** `license required` |

The raw license appears in no response body, no log line, and no KV key — it
is reduced to an HMAC subject at the boundary. The customer PII Polar returns
alongside the entitlement fields (purchaser email, display name, avatar URL)
is never read into a result or a log.

## 3. Monthly allowance enforcement

With `PATINA_PRO_REQ_PER_MONTH=3` (shipped default is 100):

```
1회차: HTTP 200   2회차: HTTP 200   3회차: HTTP 200
4회차: HTTP 429 {"error":"monthly rewrite limit reached"}
5회차: HTTP 429 {"error":"monthly rewrite limit reached"}
runner executions: 3
```

The runner count is the point: over-cap requests are refused **before** any LLM
call, so an over-quota seat costs nothing to serve. That is the mechanism the
~55% margin at 100 rewrites/month depends on.

## 4. Revocation propagation

Simulating a cancellation (the provider answer flips to `revoked`) against an
injected clock:

| time after cancellation | verdict |
|---|---|
| 4 minutes | allow — served from the positive cache |
| 5 minutes + | **deny (403)** |

**The revocation bound is the positive cache TTL: 5 minutes**, tunable via
`PATINA_POLAR_CACHE_TTL_MS`. A cancelled or refunded subscription therefore
retains access for at most five minutes. That cache is not optional — Polar
rate-limits the validate endpoint hard enough that uncached validation would
turn ordinary paid traffic into 503s — so the bound is a deliberate trade, not
an oversight.

## What this does NOT yet establish

- **Production**: everything above is the sandbox organization. The production
  product, checkout link, and evidence binding are not created yet.
- **A real payment**: sandbox purchases move no money. The first production
  payment is part of the owner's Gate sequence, and — per the correction in
  `production-go-live-checklist.md` — must be recorded from an explicit
  provider mode field, never inferred from a successful checkout.
- **Refund and chargeback handling**: untested; Polar holds accounts to a 0.4%
  chargeback rate.

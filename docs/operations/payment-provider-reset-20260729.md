# Payment provider reset (2026-07-29)

> Lemon Squeezy declined the store application. This records what that costs,
> what it does not cost, and the replacement options — so the next application
> is not a re-run of the same one. Owner decision required before any code
> moves. Companion: [`production-go-live-checklist.md`](production-go-live-checklist.md)
> (now carries the TERMINAL header + the test-mode evidence correction).

## The rejection

> "After reviewing the information in your application and any extra
> information you supplied, unfortunately, we cannot approve your store
> application for Lemon Squeezy. Each store application decision relies on
> multiple data points … guided by regulations imposed on us by Stripe,
> PayPal and card companies."

No appeal path is offered and no specific defect is named. Treat
`LS_APPROVAL` as unsatisfiable on this provider rather than pending.

### This is NOT a ToS violation — verified

The decline is a **risk-underwriting decision**, not a policy breach, and the
email says so in its own words: decisions are *"more complex than a simple
glance at the ToS list of requirements"* and are *"guided by regulations
imposed on us by Stripe, PayPal and card companies"*. That sentence
pre-empts the "but we comply with every ToS bullet" argument — compliance
was never the question.

Checked against LS's published prohibited-products list
(docs.lemonsqueezy.com/help/getting-started/prohibited-products, retrieved
2026-07-29): **patina appears on none of the ~22 prohibited categories**, and
"Software & SaaS" is the first named *acceptable* category. The single
adjacency worth naming is **"Homework/Essay mills"** — patina is not one, but
a product marketed as removing AI traces from text can be *read* as serving
that market. That is a perception exposure in the product description, not a
rule that was broken.

Practical consequences of the distinction:
- Nothing was done wrong; there is no violation to remediate or disclose.
- Appealing by citing ToS compliance would not work — the decision does not
  rest on the list.
- Applying to another provider is ordinary business, not ban evasion. There
  is no suspension, no chargeback history, and no revenue to explain.
- The fix is the *framing* of the same product, not a change to the product.

## Financial exposure: none

Verified against the LS API on 2026-07-29: store `total_sales: 0`,
`total_revenue: 0`; both $9.99 orders and the active subscription carry
`test_mode: true`. **No customer money was ever taken and no refunds are
owed.** The 08-16 "renewal" is test-mode and bills nothing. The only real
cost was time.

This is the second time a payment-state misreading landed in the ledger
(first: a rendering checkout page read as review clearance; second: a
test-mode order read as live revenue). Rule for the replacement provider:
**a payment fact is only recorded from a provider API field that names the
mode explicitly** (`test_mode`, `livemode`, or equivalent), never from a
dashboard screenshot, an email, or a successful checkout flow.

## What the rejection does NOT invalidate

The entitlement boundary was built as an injected interface, not an LS
import: `createRewriteHandler({ licenseValidator })` receives
`{ validate(key) -> {ok, subject, status, reason} }`. Everything above that
line is provider-independent and survives intact:

- tier contract, 50k-char margin cap, quota + monthly-char metering (HMAC
  subjects, KV atomics)
- fail-closed auth ordering (401 LICENSE_REQUIRED before caps/config), the
  no-leak guarantees, and the full redteam suite pinning them
- observability schema, monitor rules, rollback drill procedures
- the rewrite/scoring pipeline and every quality gate

Provider-coupled and now dead: `src/entitlement.js` internals (519 lines,
LS validate-only semantics + LS rate ceiling), the store/product/variant
identity, `scripts/checkout-evidence-bindings.mjs`, the launch-config
checkout origin/path allowlist, and every `LS_*` env name. **Swap cost is a
new adapter behind the same interface plus evidence rebinding — not a
rewrite of the paid path.**

## Why it likely failed (and what to change in the next application)

Not stated by LS, so this is inference, but the input pattern is
unmistakable for a new KR individual seller:

1. **Category risk.** "AI humanizer" sits next to *AI-detector evasion* and
   *academic dishonesty* in processor risk taxonomies. Stripe/PayPal push
   that risk onto the MoR, which is exactly the constraint LS cited. The
   product's own README and `docs/ETHICS.md` explicitly refuse detector
   bypass — **that refusal must be in the application, not just the repo.**
2. **Thin merchant profile.** New store, free plan, no trading history, no
   registered business entity, KR individual.
3. **Product framing.** If the application described "AI 텍스트 휴머나이저 /
   AI 티 제거", it reads as the risky category. The accurate and equally
   true framing is a *deterministic writing-style editor with an audit
   trail* — it changes wording, never claims/numbers (enforced by a
   meaning-preservation gate that demonstrably rejects its own output).

Concrete framing to reuse: **"Patina is a multilingual (KO/EN/ZH/JA)
writing-style editor for professional and technical prose. It detects
formulaic phrasing and rewrites it while a deterministic gate guarantees the
claims, numbers, and causation are unchanged. It is not an AI-detection
bypass tool; see the published ethics policy."** Link the MIT repo, the
ethics doc, and the public playground — an established open-source project
with real users is the strongest merchant-profile evidence available.

## Replacement options

| provider | model | approval friction | fee | license keys | fit |
|---|---|---|---|---|---|
| **Polar** | MoR | low; built for OSS devs | ~4% + 40¢ | yes, native | **best fit** — MIT OSS dev tool is its core audience |
| **Paddle** | MoR | high; similar underwriting to LS | ~5% + 50¢ | via webhook + own store | real risk of the same rejection |
| **Gumroad** | MoR | lowest | 10% flat | yes, API | fastest to revenue, worst margin |
| **Stripe direct** | you are MoR | medium (account, not store) | 2.9% + 30¢ | build it | KR VAT/tax burden moves to owner |
| **GitHub Sponsors** | platform | none for OSS | 0% | none — needs tier-check gating | no license infra; different entitlement model |

Margin note against the approved 50k-char cap: at $9.99 with net revenue
$8.49 assumed for the 60% gate, Gumroad's 10% (≈$1.00) is close to the LS
assumption already baked into `feeUsdMicros` (999,500). Polar (~$0.80) is
slightly better; Stripe direct (~$0.59) is best on fee but adds tax
obligations that are not free.

**Recommendation: Polar first, Gumroad as the no-friction fallback.** Both
are Merchant of Record, so KR tax/VAT stays off the owner. Apply with the
reframed description above; do not reuse the LS application text.

## Sequenced plan once a provider is chosen

1. [Owner] Apply with the reframed product description + ethics link.
2. [Owner] On approval: create product/variant, capture non-secret identity.
3. [Agent] New entitlement adapter behind the existing `licenseValidator`
   interface (target: `src/entitlement-<provider>.js`), with the LS adapter
   retained only if the interface tests still cover it, plus rebound
   checkout evidence and renamed env. The handler, quota, and redteam suites
   should need no change — that is the acceptance criterion.
4. [Agent] Re-issue PAY-B-COST at the 50k cap (already-owed follow-up), now
   with the new provider's fee in `feeUsdMicros`.
5. [Owner] Gate B → disabled-first deploy → drills → Gate D → open.

## Interim posture (unchanged, safe)

Checkout is fail-closed disabled and the site CTA reads "Pro — coming soon".
Free and BYOK tiers are unaffected and keep serving. Nothing needs to be
switched off in response to the rejection. The one live consequence: the
production `PATINA_SYNTHETIC_PRO_LICENSE` is a test-mode key on a rejected
store, so the pro synthetic probe should be treated as unreliable evidence
from now on — the free-tier canary (added 07-27) is the monitor signal that
still means something.

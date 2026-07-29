# Polar onboarding — step by step (2026-07-29)

> Executable checklist replacing the LS go-live sequence. Facts verified
> against Polar's own docs on 2026-07-29 (acceptable-use, account-reviews,
> supported-countries, payout accounts, license-key benefit). Framing and
> application text: [`polar-application-prep.md`](polar-application-prep.md).

## The sequencing correction

Polar's review happens at **first payout**, not at signup, and their guidance
is explicit:

> "**Build first, submit second.** … Configure your products and benefits,
> wire up your integration (checkout links, API keys, webhooks), and have a
> live website pointing to it. The more we can see end-to-end, the more
> confidently — and quickly — we can approve your account."

This inverts the LS plan recorded earlier ("apply → approved → then build").
Nothing blocks the integration work; signup is immediate and the review comes
after everything is demonstrable.

## Eligibility (verified, no blocker)

| question | answer |
|---|---|
| Is 🇰🇷 South Korea supported for payouts? | **Yes** — listed in supported countries |
| Can an individual (no business registration) sell? | **Yes**, where Stripe Connect Express supports the `individual` business type; KR does for recipient/transfers |
| Is KRW a supported price currency? | Yes (130+ currencies); USD stays the product price |
| Are license keys native? | **Yes** — a first-class benefit with a public validate endpoint |
| Category | "AI Content Generation tools" = **restricted, closer review** — not prohibited |

## Steps

### Owner — now (nothing blocks these)

1. **Sign up** at polar.sh and create the organization.
2. **Fill Settings → website + social accounts.** Polar states these feed
   identity verification and fraud prevention, and that accurate entries
   speed the review. The live playground and the GitHub repo are the two
   strongest items available.
3. **Note the production organization ID** (Settings). It is not a secret — it
   is sent on every validate call.
4. **Set up the sandbox separately** (see the gotcha below): create an account
   and organization at `sandbox.polar.sh/start`, recreate the product and the
   License Key benefit there, open the product's **Checkout Link**, and pay
   with Stripe's test card `4242 4242 4242 4242` (any future expiry, any CVC).
   Use an organization-member email — sandbox only delivers customer emails to
   members. Then hand over the **sandbox** organization ID, the benefit ID,
   and the issued license key.

> **Gotcha: the sandbox is a separate server, not a test mode.** Polar states
> you must "create a dedicated user account and organization" at
> sandbox.polar.sh. Nothing crosses over: the production organization ID does
> not resolve there, products and benefits must be recreated, and access
> tokens are environment-specific. Probing `sandbox-api.polar.sh` with a
> production organization ID returns the same `404 ResourceNotFound` as an
> unknown key, so a wrong-environment ID is indistinguishable from a bad key —
> which is exactly why the sandbox IDs must be captured explicitly rather than
> assumed.

### Agent — as soon as the sandbox IDs exist

5. **Entitlement adapter** behind the existing injected `licenseValidator`
   interface. Polar's endpoint is
   `POST https://api.polar.sh/v1/customer-portal/license-keys/validate`
   with `{ key, organization_id }`; the response carries `status`
   (`granted`), `expires_at`, and `benefit_id`. Notes that matter for the
   port:
   - `benefit_id` **must** be validated, not just `status` — Polar warns that
     one organization can offer several key types.
   - Activation flow is only needed if an activation limit is set; skip it by
     leaving the limit unset.
   - Polar has a built-in `limit_usage` / `increment_usage` quota, but it is
     cumulative per key. Our monthly counter resets on the UTC month
     boundary, so `PATINA_PRO_REQ_PER_MONTH` stays the enforcement point.
   - Acceptance criterion is unchanged: the handler, quota, and redteam
     suites need **no** modification.
6. **Checkout wiring** — rebind `scripts/checkout-evidence-bindings.mjs` and
   the launch config to the Polar checkout origin/path, rename `LS_*` env.
7. **Sandbox end-to-end**: purchase → license issued → `tier=pro` rewrite →
   monthly cap → revoke on cancellation.

### Owner — once the integration demonstrably works

8. **Create the production product**: recurring, monthly, fixed price $9.99 USD, with
   the **License Keys** benefit attached. Description should match the
   application framing (style editor + meaning gate, not "AI humanizer").
9. **Finance → Account → Submit for approval**: business/product/intended-use
   description (reuse the prepared text).
10. **KYC**: passport / ID card / driver's licence + selfie via Stripe
   Identity, completed by the org owner.
11. **Payout account**: Stripe Connect Express. Stripe requires a **domestic
    KR bank account in KRW** — Wise/Payoneer/Revolut style accounts are
    generally rejected.
12. Wait: initial review takes **up to 14 days**.

## Rules that carry real risk

- **Never test with a real card.** Polar states processors flag this as "card
  testing" and it can block the card or the account and trigger a review. Use
  the sandbox, or a 100% discount code in production. (The LS history is
  instructive here: those two $9.99 orders were test-mode, which is exactly
  the pattern Polar prescribes — the mistake there was recording them as live
  revenue, not making them.)
- **Reviewers may ask for a 100% discount code** so they can walk the
  purchase → automatic access flow themselves. The integration must genuinely
  work end-to-end before submitting; a video recording is the fallback.
- **48-hour support response** when Polar loops the merchant into a customer
  thread. Repeated silence leads to offboarding.
- **Chargebacks are held to 0.4%** (below the card networks' 0.7%).
- Policy violations mean offboarding, refunds, and held payouts — which is
  why the framing work in `polar-application-prep.md` (never marketing patina
  as detector evasion) is a standing constraint, not a one-time task.

## Fee impact on the shipped economics

Polar's fee (~4% + 40¢ on $9.99 ≈ $0.80) is slightly better than the $1.00
assumed in `feeUsdMicros`, so net revenue rises marginally and the shipped
100-rewrites/month margin (~55% with the scoring reasoning cut) improves a
little. The exact figure goes into the PAY-B-COST v2 rework once the real fee
is confirmed on a live payout.

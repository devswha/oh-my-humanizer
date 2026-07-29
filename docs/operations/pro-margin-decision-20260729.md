# Pro margin decision input (2026-07-29)

> Decision-support record for the GATE_B "content-valid PAY-B-COST evidence"
> blocker. Measured numbers only; the product decision (cap/price/engine) is
> owner-only. Companion artifacts: `pay-b-cost-20260724*.json.bundle.json`
> (claude, checked in), `pricing-gemini-3.6-flash.json` (this branch), and the
> raw token usage below.

## Why the margin gate refused (offline re-analysis of the 07-24 bundles)

`PAY-B-COST-v1` requires gross margin ≥ 60% at the shipped 1,000,000-char
monthly cap against net revenue of **$8.49/mo** ($9.99 − $1.00 LS fee −
$0.50 refund reserve). Re-deriving the checked-in claude bundles with
`derivePayBCostFinancial` (no new spend):

| bundle | upper COGS / 1M chars | margin at 1M cap | cap clearing 60% |
|---|---:|---:|---:|
| claude-sonnet-5 (uncached) | **$878.26** | −10,243% | ~3,867 chars |
| claude-sonnet-5 (prompt-cached) | **$425.24** | −4,908% | ~7,987 chars |

The refusal is not a tooling failure: **the advertised contract
(claude-sonnet-5 + 1M chars/mo at $9.99) is economically impossible.** COGS
would exceed net revenue ~50–100×.

## gemini-3.6-flash measurement (2026-07-29, this branch)

The shipped serving decision (serving-engine-cost-20260725.md) is
gemini-3.6-flash on both tiers, so the Pro cost evidence must measure it.
Collector run (`G002_PROVIDER=gemini G002_MODEL=gemini-3.6-flash`) against
paid-tier pricing $1.50 in / $0.15 cache-read / $7.50 out per MTok.

**Receipt not issued — two findings:**

### 1. probe-ko-business is deterministically 422-blocked by the model

Across 11+ consecutive runs gemini-3.6-flash rewrote the vague opener
"금번 분기" as "이번 3분기", duplicating the numeral `3` (original mentions
it once, in "3분기 매출"). The number-safety gate correctly rejects the
mention-count drift (`numeric_claim_changed`), so the probe never completes
scoring. Two mitigations landed on this branch, neither sufficient alone:

- **meaning-proxy v2.2**: strictly descending KO magnitude chains and 백/천
  compounds are now exact notation equivalences ("23,000" == "2만 3천",
  "1억 2천만" == 120,000,000). This fixed the *other* recurring gemini
  rewrite shape (grouped digits → chain) that also 422-blocked KO text.
- **prompt rule 3 hardening**: numbers are now declared frozen tokens —
  exact rendering, exact mention count, no relocation. gemini still resolves
  the anaphor; the pattern packs' "make vague phrases concrete" pressure wins.

Operational implication: **while production serves gemini-3.6-flash, KO
business/announcement texts with a vague quarter/period opener will fail
with number_safety_failed at a high rate.** This is a serving-reliability
finding, not only a measurement obstacle.

### 2. Approximate COGS from the two passing probes (billing-true tokens)

Raw usage (openai-compat `usage`; `total_tokens` − prompt − completion =
thinking tokens, billed at the output rate):

| probe | chars | stage tokens (prompt / completion / total) |
|---|---:|---|
| en-blog | 732 | rewrite 17,256/277/19,604 · mps 918/362/3,816 · fidelity 675/103/1,629 |
| ko-sns | 230 | rewrite 20,190/263/21,172 (16,358 cache-hit) · mps 858/333/2,825 · fidelity 615/108/1,759 |

Derived cost per full pipeline run (rewrite + MPS + fidelity):

| basis | en-blog (732c) | ko-sns (230c, warm cache) |
|---|---:|---:|
| completion-only output billing | $0.0338 → **$46/1M chars** | $0.0157 → **$68/1M chars** |
| thinking billed as output (conservative) | $0.0748 → **$102/1M chars** | ~$0.037 → **~$160/1M chars** |

Notes: the ~17–20k-token strict prompt dominates input cost; Gemini implicit
caching cut the warm-run billable input ~5× (16.4k of 20.2k tokens were
cache hits). Short inputs are the worst case per char.

## The structural conclusion

**No allowlisted engine clears 60% margin at a 1,000,000-char monthly cap.**
The gap is not an engine choice away: even the cheapest quality-passing
engine measures ~$46–160/1M chars against a $3.40/1M budget. The variable
that actually decides the margin is `PATINA_PRO_CHARS_PER_MONTH`.

Caps that clear 60% margin at measured COGS (net $8.49/mo):

| engine basis | cap for ≥60% margin |
|---|---:|
| gemini, completion-only ($46/1M) | ~73,000 chars/mo |
| gemini, thinking-billed ($102/1M) | ~33,000 chars/mo |
| gemini, short-text worst ($160/1M) | ~21,000 chars/mo |
| claude cached ($425/1M) | ~8,000 chars/mo |

## Owner decisions needed (in order)

1. **Monthly cap**: pick `PATINA_PRO_CHARS_PER_MONTH` (e.g. 50,000 ≈
   conservative 60%+ on gemini; 100,000 ≈ roughly break-even-to-thin margin
   on worst-case texts). Marketing copy (currently implying 1M) must follow.
2. **Advertised engine**: the 6.3.0 changelog sells Pro "on Claude Sonnet 5";
   the serving decision moved to gemini-3.6-flash. The public claim and the
   env pin must be reconciled before Live open.
3. **PAY-B-COST spec**: `unitChars` is hard-pinned to 1,000,000; a cap-aware
   v2 (margin evaluated at the *shipped* cap) is a repo action I can execute
   once decision 1 names the cap.
4. **KO reliability**: accept the number_safety 422 rate on gemini for
   quarter-opener KO texts, or fund a follow-up (prompt surgery or a
   rewrite-retry-on-422 loop server-side) before Live open.

## Monitor evidence status (Gate B item 1)

The v6.3.2 release (merge `b98b3b0`, git-deployed) restored
`VERCEL_GIT_COMMIT_SHA`, which was the stated precondition for the pro-monitor
identity check. The cron fires every 15 minutes with Vercel-injected
authorization; the endpoint answers 401 to unauthenticated probes by design,
so **capture is owner-side**: Vercel → patina project → Logs → filter
`/api/pro-monitor` → record the first `200` response summary (post-deploy)
in the Gate B ledger. A `503 monitor_unavailable` there now indicates a real
adapter/secret gap, not deployment identity.

## Decisions taken (owner-approved 2026-07-29, same day)

1. **Cap**: `PATINA_PRO_CHARS_PER_MONTH` default 1,000,000 → **50,000**
   (`TIER_LIMITS.pro.charsPerMonth`, env-overridable as before). Production
   env note: if the deployment sets the env var explicitly, it overrides this
   default and must be updated (or removed) at the secret manager.
2. **Public copy**: landing pricing drops the engine name ("Premium AI
   engine") and states 50,000 chars/month. `.env.example` already carried the
   gemini pin (07-26); the go-live checklist secret map now matches it.
3. **KO reliability**: server-side buffered retry on `number_safety_failed`
   (`runWebRewriteStream numberSafetyRetries`, default 1). Attempt ledger
   stays one-based across runs. Verified live: the deterministic
   quarter-opener drift still fails closed after 2 attempts (correct); the
   retry exists for sampling-variance cases.

Follow-up owned by the agent: PAY-B-COST v2 (margin evaluated at the shipped
50,000-char cap instead of the pinned 1M `unitChars`, and a retry-aware
`validateSequence` that accepts a success-outcome preterminal rewrite attempt
with a `number_safety` retry reason) — then re-run the gemini receipt.

## Correction (same day): the char cap does not bound cost — requests do

Measuring the shipped gemini-3.6-flash serving pin directly (not scaled from
the claude bundles) changed the conclusion above:

| measured | value |
|---|---|
| prompt size per request | ~20,100 tokens (81% prompt-cache hit, reproducible across runs) |
| thinking tokens (billed as output) | 872 / 1,083 / 700 for rewrite / MPS / fidelity — **4x the completion tokens** |
| cost per request (177-char KO) | $0.035 cached · $0.057 uncached |
| cost per request (732-char EN) | $0.075 |
| **allowed requests/month at 60% margin** | **45-78** ($3.40 budget ÷ $0.043-0.075) |

The decisive fact: **cost tracks request count, not characters.** Three LLM
calls behind a ~20k-token prompt cost nearly the same for a 100-char input as
for a 1,000-char one. So `charsPerMonth: 50,000` is not a cost control on its
own — 500 x 100-char requests satisfy it while costing ~$17.50 against $8.49
of net revenue. `reqPerDay: 200` (6,000/month) bounds burst, not spend.

The earlier "$0.030 per rewrite" figure in serving-engine-cost-20260725.md is
not wrong, but it is **rewrite-only**; the paid path always bills rewrite +
MPS + fidelity, and the meaning gate is the feature Pro is sold on, so those
two calls cannot be dropped to save cost.

### Shipped fix

`TIER_LIMITS.pro.reqPerMonth = 60` (env `PATINA_PRO_REQ_PER_MONTH`), enforced
per license subject in the same UTC-month bucket as the char counter, checked
*before* it, and counted on every request (the char counter only engages when
a positive char count is supplied). Denial is 429 `monthly rewrite limit
reached` with `remainingMonthlyRequests` / `limitMonthlyRequests`.

60 requests ≈ $2.6 COGS ≈ 70% margin, inside the measured 45-78 band with
room for the uncached worst case. `charsPerMonth: 50,000` is retained as a
secondary bound against a single enormous document. Landing copy now states
"60 rewrites / month" alongside the character limit.

### Open lever, not yet pulled

The ~20k-token prompt is the cost driver, and roughly half the per-request
cost survives the 81% cache hit. Shrinking what is sent per request (pattern
catalog selection, profile/voice trimming) is the only change that would
materially raise the allowance without raising the price. Not attempted here:
it touches the rewrite prompt, which is out of scope without an explicit ask.

## Cost structure, measured per call (gemini-3.6-flash, 2026-07-29)

Where the $0.035 of a cached 177-char KO request actually goes:

| call | input | output | thinking | total |
|---|---:|---:|---:|---:|
| rewrite | $0.0082 | $0.0017 | $0.0065 | **$0.0164** |
| MPS | $0.0012 | $0.0024 | $0.0081 | **$0.0118** |
| fidelity | $0.0009 | $0.0007 | $0.0053 | **$0.0069** |

Two facts follow, and both were counter-intuitive:

1. **Thinking tokens are 57% of the bill.** They are billed at the output
   rate and run 3-5x the completion tokens on the scoring calls.
2. **Scoring costs more than rewriting** ($0.0186 vs $0.0164). Optimizing the
   rewrite prompt alone therefore cannot fix the economics — the ~20k-token
   prompt is only $0.0082 of input after an 81% cache hit.

### Reasoning-effort experiment on the scoring calls

`reasoning_effort` on the two scorers only (the rewrite call untouched —
thinking-off rewrites were previously measured to amputate content):

| setting | scoring thinking tokens | scoring cost |
|---|---:|---:|
| default | 1,935 | $0.0188 |
| `low` | 1,394 | $0.0148 |
| `none` | ~1,288 | ~$0.0149 |

Gate discrimination under `none` (the safety question — a cheaper gate that
stops rejecting bad rewrites would be worse than no saving at all):

| case | default | none |
|---|---|---|
| faithful rewrite | MPS 100 / fid 100 | identical |
| dropped fact (loss reported) | 66.7 / 83.3 → reject | identical |
| polarity inversion (적자→흑자) | 40 / 66.7 → reject | 40 / **58.3** → reject, stricter |

Verdict: safe on the cases tested, but worth **only ~11% of total cost**
(-$0.004/request). It moves the monthly allowance from ~60 to ~68 — a real
saving, not a solution.

## The allowance is a pricing decision, not an engineering one

Budget = net revenue x (1 - margin floor). The 60% floor is self-imposed in
the PAY-B-COST spec, not an external constraint:

| margin floor | monthly budget | allowance at ~$0.045/request |
|---|---:|---:|
| 60% (current) | $3.40 | ~75 |
| 50% | $4.25 | ~95 |
| 40% | $5.09 | ~113 |
| 60% at a $14.99 price | $7.92 | ~175 |

**The BYOK tier reframes the question.** BYOK is already free and has no
daily or monthly request cap — a heavy user's cheapest path is their own API
key, not a bigger Pro plan. Pro sells *not having to manage a provider key*,
so its allowance needs to be credible for a normal user, not unlimited for a
power user. That is the honest case for a number near 100 rather than 500.

Pending owner decision: margin floor (60% vs 50%) and the advertised
allowance. `PATINA_PRO_REQ_PER_MONTH` makes the number env-tunable either
way, so the shipped 60 is a safe placeholder, not a commitment.

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

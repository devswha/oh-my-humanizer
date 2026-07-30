# Measured: number-bearing documents fail the safety gate, and Pro pays for it

Found while measuring long-input cost for the Pro character-cap decision. The
cost question is secondary to what the measurement exposed.

## What was measured

Real pipeline runs (`runWebRewriteStream`, `tier: 'pro'`, gemini-3.6-flash,
production prompt), one request per row:

| probe | chars | digits | terminal | rewrite attempts |
|---|---:|---|---|---:|
| production smoke (`14:30`, `23,000`) | 146 | yes | **done** | 1 |
| digit-free fixture prose | 900 | no | **done** | 1 |
| digit-free fixture prose | 2,301 | no | `number_safety_failed` | 2 |
| digit-free fixture prose | 2,693 | no | `number_safety_failed` | 2 |
| digit-free fixture prose | 2,806 | no | done — **rescued by the retry** | 2 |
| digit-free fixture prose | 7,560 | no | `number_safety_failed` | 2 |
| digit-free fixture prose | 19,540 | no | `number_safety_failed` | 2 |
| `round3-gemini-3-casual-full.md` | 1,624 | yes | `number_safety_failed` | 2 |
| `round3-claude-casual-full.md` | 1,489 | yes | `number_safety_failed` | 2 |
| `sample-rewritten-claude.md` | 1,270 | yes | `number_safety_failed` | 2 |

Every failure reports `numeric_claim_changed` from `numeric-safety-v2`. In one
diagnosed case the original carried the claim `number:1/1` and the rewrite
carried none — the rewriter dropped a number-word and the gate refused, which is
the gate working exactly as designed.

## The part that costs money

`src/rewrite-handler.js` states it directly: the daily and monthly counters
"increment fail-closed with no refund path". So a Pro request that terminates in
`number_safety_failed` still consumes one of the customer's 100 monthly requests
and its characters against the 50,000 monthly total — and returns an error
instead of a rewrite. Both rewrite attempts are billed to us as well: measured
at **$0.069–$0.089** across two runs of the 19,540-character probe. The failed
path never reaches scoring, so that is rewrite cost alone.

### A measurement trap worth naming

The scoring reasoning cut is scoped to `request.provider === 'gemini'`. Omitting
that field — as the first pass of this measurement did — silently serves the
**pre-cut** cost and inflates the scorers. Isolated on the same 518-character
input:

| `request.provider` | scorer thinking (MPS / fidelity) | full pipeline |
|---|---|---:|
| unset | 923 / 497 | $0.0573 |
| `'gemini'` | **0 / 0** | **$0.0311** |

So the cut behaves exactly as documented, and the production-path cost of a
518-character English request is **$0.0311** — about $3.11 of COGS for a full
100-request month against $8.49 net revenue, roughly **63% margin**. That is
better than the ~55% on record, which stands as the conservative figure. An
earlier draft of this note reported $0.05–$0.058 per request and read that as a
margin problem; it was measuring the pre-cut path.

A customer working on number-bearing drafts can therefore spend a paid month
receiving nothing. That is a refund request at best and a chargeback at worst,
against an account Polar holds to a 0.4% chargeback rate.

Meanwhile the pricing card offers "Up to 20,000 characters each".

## Honest limits of this evidence

Each probe family carries a confound, and none of them is a real customer:

- The digit-free probes are unrelated paragraphs concatenated to a target
  length. The topic jumps may themselves provoke compression.
- The coherent documents are patina's own before/after examples, which are
  unusually **number-dense** (scores, percentages, version strings). A typical
  customer paragraph is not.
- Every row is n=1 for its size. Nothing here establishes a rate.

What the rows do support: number-bearing text fails well below the advertised
ceiling, short number-bearing text passes (twice, including in production), and
the single retry rescues some failures but not most.

## Reproduction

Runs used `runWebRewriteStream` directly with `GEMINI_API_KEY`, reading
`result.numberSafety` and `result.attempts.rewrite[].usage`. No production
traffic and no customer data involved.

## The decision this forces

Not taken here, because each option trades away something real:

1. **Stop charging quota on `number_safety_failed`.** Correct from the
   customer's side — our gate rejected our own rewrite. But the no-refund rule
   exists to stop crafted always-failing input from buying unlimited free LLM
   spend, so a refund needs its own bound.
2. **Raise the retry budget.** One retry already rescues some cases. Each extra
   attempt is real money against a ~55% margin.
3. **Lower the advertised character ceiling.** Honest, but Pro would advertise
   less than the free tier's 4,000 characters, which removes its reason to exist.
4. **Reduce the rewriter's numeral drift** so the gate stops firing. The real
   fix, and the only one that improves the product rather than reallocating the
   loss. It touches the rewrite prompt, which is out of scope without an
   explicit ask.

The measurement should be repeated on coherent customer-shaped prose with
ordinary numeric density before any of these is chosen.

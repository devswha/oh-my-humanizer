# gemini-3.7-flash measurement (2026-08-13)

Google released `gemini-3.7-flash`. Measured against the shipped serving pin
`gemini-3.6-flash` to decide whether it earns an allowlist entry and whether
the pin should move. Answer: **allowlist yes, pin move no.**

Not a Gate artifact and not a default change. The serving pin
(`PATINA_PRO_MODEL`/`PATINA_FREE_MODEL`-eligible set) and every preset default
stay where the frozen-default process left them.

## Apparatus

Same 22 live-quality fixtures (ko 11 + en 11), both candidates run through the
identical harness in one session:

```
node tests/quality/live-quality.mjs --live --provider gemini --model <candidate> \
  --judge-base-url https://api.deepseek.com/v1 --judge-model deepseek-chat \
  --judge-extra-body '{"thinking":{"type":"disabled"}}' --json
```

Fixed judge is `deepseek-chat` (thinking off) — not the July `gpt-5.5` codex
seat, because the OpenAI and Kimi balances are exhausted in this environment.
**These two runs are comparable to each other, not to the July 20/22 numbers**;
the deepseek judge scores noticeably softer (both candidates carry more MPS 100
rows than the July judge granted).

## Head-to-head (n=1 per fixture; ±20 MPS single-sample noise applies)

| | gemini-3.7-flash | gemini-3.6-flash |
|---|---:|---:|
| pass / warn / error | **19 / 2 / 1** | 18 / 4 / 0 |
| MPS mean | 93.8 | 97.0 |
| MPS worst | **50** (en-social-01) | 75 (ko-academic-01) |
| ai_not_improved count | **2** (ko-chat, ko-email) | 4 (+ ko-news, ko-social) |
| AI-delta mean | 12.6 | 12.8 |
| s/rewrite (measured wall) | **4.2** | 8.9 |
| completion tokens (22 rewrites) | 4,558 | 4,977 |

Both models return `ko-chat-01` and `ko-email-01` effectively unchanged
(`ai_not_improved`) — a shared prompt/register issue, not a model
differentiator. 3.7 additionally moves `ko-news-01` (+1.3) and `ko-social-01`
(+4.5) where 3.6 returned the input verbatim, so 3.7 rewrites the stubborn KO
registers slightly harder.

## The one regression: en-social-01

The full sweep scored it MPS 50. A `--repeat 3` follow-up on the same fixture:
statuses pass/pass/error, MPS `[80, 80, 50]`. So across 4 samples, 2 land at
50 and 2 at 80 — a real meaning-loss tail on that register, not one-sample
noise. 3.6 on the same judge scored it 80. This is the reason the serving pin
does not move: 3.7's worst case is worse than the incumbent's, and worst-case
MPS is the deciding column (per serving-engine-cost-20260725.md).

## Pricing (published 2026-08-13, Google AI developer pricing page)

`gemini-3.7-flash` standard paid tier is **identical** to `gemini-3.6-flash`:
$0.75/MTok in, $3.75/MTok out, $0.075/MTok cache read through 2026-12-31
(doubling to $1.50/$7.50/$0.15 on 2027-01-01; both models, same schedule).
Paid tier does not train on submitted content; free tier does and stays
ineligible for customer text. Note: the rates recorded in
`serving-engine-cost-20260725.md` ($1.50/$7.50) match the post-2026 schedule;
the current promotional rate is half that for both models, so the relative
comparison is unchanged.

There is no cost lever in this swap — only latency (~2x faster) and the KO
`ai_not_improved` reduction, traded against the en-social meaning-loss tail.

## Decision

1. **Allowlist `gemini-3.7-flash`** in `PROVIDER_PRESETS.gemini` (opt-in,
   appended after the pinned default) — done in this change. BYOK users can
   select it; `PATINA_PRO_MODEL`/`PATINA_FREE_MODEL` may name it.
2. **Serving pin stays `gemini-3.6-flash`.** Same price, and 3.7's worst-case
   MPS (50, reproducible) is below the incumbent's floor on the same judge.
3. Revisit if a later 3.7 snapshot fixes the en-social tail, or if latency
   becomes a paying-user complaint; the measurement command above reproduces
   this comparison in ~10 minutes.

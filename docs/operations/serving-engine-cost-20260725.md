# Serving-engine cost and quality measurements (2026-07-25)

Measured to answer one question: what should serve the Pro tier and the free
trial, given that the incumbent (`claude-sonnet-5`) consumes essentially the
whole $9.99 subscription when one license exhausts its monthly character cap.

Not a Gate-B artifact, not an approval, and not a decision to change any
provider default. Provider defaults and launch bindings stay frozen where the
v6.4 preflight hold pins them.

## Why the prompt is unusually cache-friendly

The rewrite prompt is a fixed prefix (pattern catalog + profile + voice) with
only the user text after the data fence:

| language | total prompt | cacheable prefix | user text |
|---|---:|---:|---:|
| ko | 41,651 chars | 41,517 (99.7%) | 134 |
| en | 72,561 chars | 72,427 (99.8%) | 134 |
| zh | 35,294 chars | 35,160 (99.6%) | 134 |
| ja | 38,639 chars | 38,505 (99.7%) | 134 |

Cost is therefore dominated by input tokens that are identical on every
request, which makes prompt caching — not model choice — the first lever.

## Prompt caching, measured on the real path

`PATINA_ANTHROPIC_NATIVE_CACHE=1`, ko web prompt, `claude-sonnet-5`, two
identical calls:

| call | input | cache write | cache read | latency |
|---|---:|---:|---:|---:|
| 1st | 147 | 34,254 | 0 | 25.2s |
| 2nd | 147 | 0 | **34,254** | **12.0s** |

Cost per request at the checked-in sonnet-5 rates ($3 in / $15 out /
$0.30 cache read / $3.75 5m cache write), 1,500 output tokens assumed:

| state | cost | vs uncached |
|---|---:|---:|
| uncached | $0.1257 | — |
| cache miss (write) | $0.1514 | +20% |
| cache hit (read) | $0.0332 | **−74%** |

Break-even hit rate is **21.7%**. With the 5-minute ephemeral TTL refreshing
on each hit, that is roughly **3 requests/hour per language variant**; the four
languages hold separate cache entries, so low-traffic variants stay in the
surcharge region. Latency halves on every hit regardless of traffic.

| hit rate | cost/request | monthly cap exhausted (50 requests) |
|---|---:|---:|
| 0% | $0.1514 | $7.57 |
| 50% | $0.0923 | $4.62 |
| 90% | $0.0450 | $2.25 |

## Candidate engines, same fixtures and same judge

6 fixtures (ko 3 + en 3), fixed judge `grok-4.5` (calibrated AUC 0.93,
independent of every candidate). Cost uses measured tokens (~18.8k in / ~280
out) at published rates; `gpt-5.3-chat-latest` has no published rate (the 5.3
line is absent from the pricing table) and is interpolated from 5.2/5.4.

| engine | pass | MPS mean | **MPS worst** | fidelity mean | s/rewrite | $/rewrite |
|---|---|---:|---:|---:|---:|---:|
| gemini-3.6-flash | 3/6 | **91.9** | **80.0** | **68.0** | 8.3 | $0.0302 |
| deepseek-v4-flash | 3/6 | 77.2 | 15.0 | 61.1 | 14.1 | **$0.0032** |
| gpt-5.3-chat-latest | 2/6 | 70.5 | 15.0 | 61.1 | **4.2** | $0.0404 |

The pass counts are not an absolute quality verdict — this gate is strict
enough that `claude-sonnet-4-6` scored 2/3 and `claude-sonnet-5` 1/3 on the ko
subset, and the blog register fails for nearly every model. Only the relative
comparison is meaningful.

**Worst-case MPS is the deciding column.** deepseek-v4-flash is 10x cheaper
than gemini-3.6-flash and ties on pass count, but it dropped to MPS 15 on
`ko-blog-01` (most of the original meaning gone). gpt-5.3-chat-latest did the
same.

## Expanded run (2026-07-26): the 6-fixture read was wrong

Rerun on all 22 fixtures with `gpt-5.3-chat-latest` as the fixed judge
(calibrated AUC 0.99, independent of both engines). Two 6-fixture claims from
the section above did not survive:

| engine | pass | AI-score delta | MPS mean | MPS worst | fidelity mean | meaning-loss fixtures | $/rewrite |
|---|---|---:|---:|---:|---:|---:|---:|
| gemini-3.6-flash | 9/22 | **13.0** | 76.3 | 20 | 69.4 | **7** | **$0.030** |
| claude-sonnet-5 (Pro pin) | 8/22 | 11.8 | 73.1 | 20 | 65.2 | 10 | $0.156 |
| gpt-4.1-mini (free default) | 10/22 | **0.2** | 84.8 | 33.3 | 81.8 | 4 | $0.008 |

1. "gemini-3.6-flash never falls below MPS 80" was small-sample luck. On 22
   fixtures its worst case is 20 (`ko-instructional-01`), the same floor as
   sonnet-5. It still loses meaning on fewer fixtures (7 vs 10) and improves
   the AI score more (13.0 vs 11.8) at a fifth of the cost and a third of the
   latency, so the ranking holds — but on margin, not dominance.
2. `gpt-4.1-mini` topping the pass/MPS columns is an artifact, not a win. Its
   AI-score delta is **0.2**: it returns the input essentially unchanged, so it
   trivially preserves meaning while doing none of the product's work. Six of
   its 22 results carry `ai_not_improved`. **The free tier is currently serving
   no real rewrite.** Pass counts must always be read next to the AI delta.

Both frontier engines fail the same registers (blog, instructional, social,
product, marketing) while passing email, public-docs, chat, and academic. Two
independent frontier models failing identically points at the prompt or the
gate for those registers, not at the models — that is the larger lever behind
the ~40% pass rate, and it is untouched by any engine swap.

## Superseded by the fidelity fix (2026-07-27)

Every number above was produced under a fidelity rubric that charged removal of
stylistic packaging as omitted claims, required the rewritten register to match
the original, and penalized the shortening filler removal causes. It therefore
penalized whichever engine stripped hype most thoroughly — exactly the
behaviour the product wants — so the engine ranking here is not reliable.

Remeasured after the fix, same 22 fixtures, same fixed judge
(`gpt-5.3-chat-latest`), same candidate:

| | broken rubric | fixed rubric |
|---|---:|---:|
| gemini-3.6-flash pass | 9/22 | **17/22** |
| fidelity mean | 69.4 | **92.4** |
| MPS mean | 76.3 | 80.5 |

The engine choice already shipped (gemini-3.6-flash on both tiers) and the
remeasurement supports keeping it. What is not re-established is the ranking
against `claude-sonnet-5` and the other candidates: those runs were never
repeated under the fixed rubric, so treat their pass counts as void. Rerun
before citing any comparison from this document.

## Published rates gathered while comparing (per 1M tokens)

| model | input | cached input | output | training on input |
|---|---:|---:|---:|---|
| deepseek-v4-flash | $0.14 | $0.0028 | $0.28 | — |
| deepseek-v4-pro | $0.435 | $0.0036 | $0.87 | — |
| grok-4.3 | $1.25 | $0.20 | $2.50 | — |
| grok-4.5 | $2.00 | $0.30 | $6.00 | — |
| kimi-k2.6 | $0.95 | $0.16 | $4.00 | — |
| kimi-k3 | $3.00 | $0.30 | $15.00 | — |
| gemini-3.6-flash (paid) | $1.50 | $0.15 | $7.50 | no |
| gemini-3.6-flash (batch) | $0.75 | $0.075 | $3.75 | no |
| gemini-3.6-flash (free tier) | $0 | — | $0 | **yes** |
| claude-sonnet-5 | $3.00 | $0.30 | $15.00 | no |

The free Gemini tier trains on submitted content, so it cannot serve customer
text; the paid tier does not. Untested engines with a price advantage over
gemini-3.6-flash: `grok-4.3` ($0.024/rewrite) and `kimi-k2.6` ($0.019). GLM
and a per-token Qwen endpoint have no key in this environment.

## Order of operations this implies

1. Caching first. It is already implemented on both the buffered and streaming
   paths, costs nothing to enable, carries no quality risk, and is worth up to
   −74% once traffic clears ~3 requests/hour per language.
2. Engine comparison second, and on worst-case meaning preservation rather than
   headline pass counts.
3. Any Pro provider/model change goes through the frozen-default process; the
   contract allowlist (`PROVIDER_PRESETS`) currently offers neither
   `gemini-3.6-flash` nor `gpt-5.3-chat-latest`.

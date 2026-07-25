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
same. gemini-3.6-flash never fell below 80, which is the behaviour a paid
surface needs.

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

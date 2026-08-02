# deepseek-v4-flash-0731 remeasured — meaning-gutting fixed, fidelity now the blocker (2026-08-03)

> Same apparatus as the definitive 2026-07-27 rerun in
> [`serving-engine-cost-20260725.md`](serving-engine-cost-20260725.md): all 22
> live-quality fixtures, fixed judge `gpt-5.5` via the codex-cli subscription
> seat, candidate over the DeepSeek API with thinking disabled. Not a Gate-B
> artifact and not a provider-default change; the v6.4 hold keeps defaults
> frozen.

## Why remeasured

DeepSeek re-post-trained the flash line and replaced it in place on 2026-07-31
(`deepseek-v4-flash` now serves V4-Flash-0731, public beta, pricing unchanged:
$0.14/M in, $0.28/M out, ~$0.003 per patina rewrite — 10x under the shipped
gemini-3.6-flash at $0.030).

## Result: 15 pass / 1 warn / 6 error (gemini-3.6-flash baseline: 20/22)

The July disqualifier is **gone**: `ko-news-01`, gutted to MPS 24 in July, now
scores **MPS 100**. Worst-case MPS across all 22 fixtures is 50 (`en-blog-01`);
20 of 22 sit at MPS >= 80. The model no longer deletes meaning wholesale.

The new failure mode is **fidelity** — omitted claims/anchors:

| fixture | mps | fidelity | note |
|---|---:|---:|---|
| ko-blog-01 | 70 | **41.7** | fidelity<70 |
| ko-howto-01 | 100 | **58.3** | fidelity<70 |
| ko-news-01 | 100 | **58.3** | fidelity<70 |
| ko-social-01 | 100 | **66.7** | fidelity<70 |
| en-howto-01 | 100 | **66.7** | fidelity<70, ai_after 33.3, ai_not_improved |
| en-blog-01 | **50** | 83.3 | mps<70 |
| ko-public-docs-01 | 100 | 100 | warn: ai_not_improved (50.0 → 50.0) |

Reading: it now preserves the gist (MPS high) but drops individual claims —
four of five fidelity failures are Korean. This is measured on the fixed
post-register-failure rubric that already exempts packaging removal, so these
are real omissions, not rubric artifacts.

## Verdict

- **Not a Pro-tier swap candidate today.** 15/22 vs 20/22 with five fidelity
  floor failures loses to the shipped engine on the column that matters for a
  paid meaning-preserving product.
- **Trajectory is real.** One post-training pass removed the meaning-gutting
  failure entirely. Re-measure on the next flash update; if fidelity clears the
  floor at comparable pass counts, the 10x cost cut (~55% → ~85%+ margin at 100
  rewrites/mo) justifies the frozen-default process.
- **Possible near-term use: the free tier.** The free tier burns the server's
  Gemini budget (currently over its monthly spend cap) on non-paying traffic.
  Serving free-tier rewrites on deepseek-v4-flash at 1/10 cost — while Pro
  stays on gemini-3.6-flash — would cut the burn and decouple the free tier
  from the Gemini cap. Separate decision: needs the env-driven free-runner path
  checked and an owner call; not part of this measurement.

Raw run: 2026-08-03, `quality:live`, 22 fixtures, judge codex-cli/gpt-5.5,
candidate `deepseek-v4-flash` with `{"thinking":{"type":"disabled"}}`.

## Root cause (2026-08-03 addendum): why fidelity fails

Four failing fixtures were regenerated with the identical prompt path and the
raw deliveries inspected. Two distinct causes, neither of which is "the model
writes worse prose":

### 1. Output-contract violations (3 of 4 inspected failures)

The rewrite prompt requires a `[BODY]` / `[SELF_AUDIT]` structure; the engine
must return them so the delivery layer can strip the audit and hand back only
the body. gemini-3.6-flash and claude-sonnet-5 follow the contract; 0731 does
not, inconsistently per run:

- `en-howto-01`, `ko-news-01`: the whole `[SELF_AUDIT]` bullet block survived
  into the delivered text — the customer would receive the model's self-review
  appended to their document. The judge correctly charges the garbage.
- `ko-howto-01`: an orphan duplicate `[BODY]` tag at the end of the delivery.
- `ko-blog-01`: no tags at all.

The re-post-training that improved "agentic" benchmarks appears to have made
the model editorialize about its own work instead of following the output
schema. A patina-side stripper hardening could salvage some of this (tolerate
malformed/duplicated tags), but a serving engine that only sometimes honors
the response contract is a per-request coin flip.

### 2. Fabrication under naturalness pressure (ko-blog-01, fidelity 41.7)

Original: 통근 시간 절감이 생산성 향상에 기여한다 (plain claim).
Delivered: "생산성이 올라간다는 **연구 결과도 나온다**" — the model invented a
supporting research finding that the original never made. It fabricates
evidence to make prose sound more human. This is the one failure patina can
never engineer around: the product's core promise is that the claim set does
not change.

### Reading

The July failure (wholesale meaning deletion) is genuinely fixed; the August
failures are contract compliance and claim fabrication. Cause 1 is partially
mitigable on our side and worth re-testing on the next model update; cause 2
is disqualifying for the paid tier as long as it reproduces. The free-tier
option stands, but with the stripper hardening as a prerequisite so scaffold
leakage never reaches a visitor.

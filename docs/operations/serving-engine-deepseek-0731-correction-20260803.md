# Correction: the deepseek-0731 failures were a measurement artifact (2026-08-03)

> Corrects the verdict in
> [`serving-engine-deepseek-0731-20260803.md`](serving-engine-deepseek-0731-20260803.md)
> and its root-cause addendum. Those documents stand as history; this one
> supersedes their conclusions. Pattern note: this is the same failure class as
> the July register-failure saga — the apparatus, not the engine.

## What was wrong with the first run

The 15/22 run disabled DeepSeek reasoning (`thinking: {type: "disabled"}`) to
match the July cost point. The shipped gemini-3.6-flash baseline runs with its
default (low) reasoning. That asymmetry caused the failures: with thinking
off, 0731 drifts on the `[BODY]`/`[SELF_AUDIT]` output contract (audit
leakage, orphan tags) and, in one case, fabricated a supporting claim. With
thinking at its default, all four inspected deliveries came back clean — no
tag leakage, no fabrication, dropped claims restored.

## Thinking-on rerun: 20 pass / 2 warn / 0 error

Same 22 fixtures, same fixed judge (`gpt-5.5` via codex-cli), same prompt
path; only the thinking override removed.

| | gemini-3.6-flash (2026-07-27) | deepseek-v4-flash-0731, thinking on |
|---|---:|---:|
| pass | 20/22 (2 fail) | **20/22 (2 warn, 0 error)** |
| worst MPS | 80 | 80 |
| worst fidelity | — | 91.7 |
| ai_not_improved | 2 | 2 (`en-social-01` −1.8, `ko-email-01` −0.1; both near-clean sources) |
| approx cost / rewrite | $0.030 | ~$0.004 (reasoning tokens included; still ~8x cheaper) |
| latency / rewrite | ~8s | **~60–90s** (reasoning-dominated) |

Both warns are the borderline "source already scores low, rewrite does not
improve it" class — the same evasion-adjacent shape the July analysis treated
as tolerable at 2/22 for the shipped engine.

## Corrected verdict

- Quality: with default thinking, 0731 **matches the shipped engine** on this
  gate — the July meaning-gutting and the August contract/fabrication findings
  are both apparatus-resolved or model-resolved.
- The real remaining tradeoff is **latency**: ~60–90s per rewrite versus ~8s.
  For the streaming playground UX this is user-visible waiting, and the
  free-tier hourly burst window compounds it. Cost favors 0731 ~8x.
- Caveats before any provider decision: this is **n=1 per fixture** and the
  harness itself documents ±20 MPS swing between identical runs — a swap
  candidate needs `--repeat` validation; DeepSeek bills output 2x at announced
  peak hours (policy announced, date TBA), which moves the cost figure; and
  the v6.4 hold freezes provider defaults, so any change goes through the
  frozen-default process.

## Options this opens (owner decisions, not taken here)

1. **Free tier on 0731 (thinking on)**: cuts free-tier burn ~8x and decouples
   it from the Gemini spend cap; latency is more tolerable for a free tier.
2. **Pro on 0731**: only after repeat-validated quality and a latency call —
   a paying user waiting 60–90s is a product regression even if quality ties.
3. **Status quo** pending the Gemini cap fix, re-measuring on DeepSeek's next
   update or the peak-pricing activation.

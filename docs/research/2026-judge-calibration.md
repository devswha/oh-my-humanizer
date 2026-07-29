# Do the study-series judges measure anything? — calibration results

Companion to `2026-judge-calibration-prereg.md` (registered 2026-07-13 before
any data). Run: 2026-07-13 00:25–02:45 KST, post-midnight window, zero claude
usage, fully separated from Study 3 (which was running concurrently on its
own artifacts). Decision rules below were fixed in the registration; nothing
moved after the numbers arrived.

- Corpus: 20 fresh human KO web documents (collected at registration time;
  sha256+URL dedupe against every store the deterministic layer was ever
  tuned, swept, or benchmarked on — 21,482 hashes / 94 URLs excluded) +
  24 fresh topic-paired AI documents (8 each gpt-5.5 / kimi-k2.5 / grok-4.5,
  title+register+length-band pairing, human text never in a prompt).
- Judging: 192/192 calls parsed (0 lost) — 132 main + 60 stability repeats.
- Headline metrics are cross-family (each judge never scored its own
  family's generations); self-family cells reported separately.

## Verdicts (pre-set criteria: PASS = AUC ≥ 0.75 AND median repeat SD ≤ 12; DEMOTE = AUC < 0.65 OR SD > 20)

| judge | accuracy | AUC [95% CI] | bias human/AI | repeat SD (median) | self-pref | verdict |
|---|---:|---|---|---:|---:|---|
| judge-kimi (k2.5) | 0.75 | 0.83 [0.69, 0.95] | 36.0 / 71.1 | 4.5 | +6.0 | **PASS** |
| judge-gpt (gpt-5.5) | 0.92 | **1.00 [1.00, 1.00]** | 39.1 / 92.1 | 2.2 | −9.3 | **PASS** |
| judge-grok (grok-4.5) | 0.92 | 0.93 [0.83, 1.00] | 32.1 / 76.1 | 4.1 | +11.9 | **PASS** |
| **pooled panel (2-of-3 mean)** | — | **0.96 [0.90, 1.00]** | — | — | — | **PASS** (pre-set ≥ 0.80) |

**The panel is real.** All three judges discriminate certain-human from
certain-AI Korean documents well above chance, and repeat scoring is tight
(SD 2–5 points on a 0–100 scale).

**The kimi 35↔92 swing is explained.** Kimi's repeat variance is small
(SD 4.5), so its Study 3 swings are *document-driven disagreement*, not
sampling noise: kimi is the weakest discriminator (accuracy 0.75, CI dipping
to 0.69) with the strongest tendency to read human docs as AI-ish (bias 36.0).
Its dissents are real opinions of a mediocre judge — the 2-of-3 quorum design
is doing exactly the work it was added for.

**Self-preference exists but is small and mixed.** gpt flatters its own
family's generations by ~9 points (classic self-preference); grok is ~12
points *harsher* on its own family. The study series' cross-family judging
rule already neutralizes this.

## Challenger round (2026-07-25) — cheap/fast HTTP judges

Same corpus, same prompt, same pre-registered criteria. Motivation: the
live-quality judge probes found HTTP judges 4–9x faster and up to 100x
cheaper than the incumbent seats, with reasoning disabled where the provider
exposes a switch (reasoning was 93–95% of output tokens and bought nothing on
this structured verdict). Discrimination was unmeasured, so it was measured.
192/192 challenger calls parsed (0 lost); latency and token usage are recorded
per call in the same artifact.

| judge | accuracy | AUC [95% CI] | bias human/AI | repeat SD | median s/call | verdict |
|---|---:|---|---|---:|---:|---|
| judge-gemini36flash (gemini-3.6-flash) | 0.91 | **0.96 [0.91, 1.00]** | 13.5 / 79.0 | 2.2 | 4.6 | **PASS** |
| judge-gpt53chat (gpt-5.3-chat-latest, non-reasoning) | 0.94 | **0.99 [0.95, 1.00]** | 39.5 / 86.1 | 2.9 | **2.3** | **PASS** |
| judge-grok420nr (grok-4.20-non-reasoning) | 0.56 | 0.71 [0.53, 0.86] | 19.7 / 23.6 | 2.7 | **0.7** | WATCH |
| judge-deepseek-nothink (deepseek-v4-flash, thinking off) | 0.50 | 0.70 [0.54, 0.84] | 21.3 / 30.4 | 12.5 | **0.2** | WATCH |

**Speed bought nothing for the non-reasoning judges.** grok-4.20-nr called
**23 of 24** AI documents "human"; deepseek-nothink 20 of 24. Their human
false-positive rate is near zero precisely because they score almost
everything low: the human/AI mean gap is 4–9 points, versus 53–65 for every
PASS judge. Low repeat SD (2.7) is not stability here — it is the consistency
of a judge that always answers ~20.

**Reasoning is not the requirement — tier is.** Both failures were
non-reasoning *and* lower tier, so a strong-tier non-reasoning chat model was
added as a confound separator: `gpt-5.3-chat-latest` reached accuracy 0.94,
AUC 0.99 [0.95, 1.00], repeat SD 2.9 at 2.3s per call — PASS, and the fastest
passing judge measured. A judge does not need a reasoning trace to read
Korean prose style; it needs to be a good model. Its self-preference is −24.4
(markedly harsher on its own family's generations) — the conservative
direction for a gate, but it keeps the cross-family judging rule mandatory.

Caveat that limits this specific pick: `gpt-5.3-chat-latest` is a **moving
alias** — the 5.3 line publishes no dated snapshot (unlike
`gpt-5.5-2026-04-23`), so this AUC is "the 5.3 chat model as served on
2026-07-25". If OpenAI repoints the alias, a "fixed" judge silently changes
underneath the comparison it exists to stabilize. Re-run this calibration
before trusting cross-run numbers from it, or use a judge that can be pinned
(gpt-5.5, gemini-3.6-flash) when the comparison must hold over time. Its unit
price is also unpublished (the 5.3 line is absent from the pricing table);
measured usage is 1,907 input / 64 output tokens per call.

**gemini-3.6-flash is a real judge.** AUC 0.96 sits above grok-4.5 (0.93) and
below gpt-5.5 (1.00), with gpt-level repeat tightness (SD 2.2) and the
cleanest separation of the round (13.5 / 79.0). All 24 AI documents are
cross-family for it (no generator overlap), so no self-preference correction
applies. At 4.6s per call on a near-free tier it is the cost-effective judge
this round was looking for — as a **second seat**, not a replacement: gpt-5.5
still holds the only 1.00.

Operational note: the free Gemini tier may train on submitted text, so a
free-tier key is fine for this repo-owned fixture corpus and must not be used
to score customer text — that lane needs a paid no-training API judge
(`gpt-5.3-chat-latest` is the measured pick) or a subscription seat.

## What this study does not measure (2026-07-27)

Every number here is AI-likeness discrimination: can the judge tell AI prose
from human prose. The product gates on something else — meaning preservation
and fidelity — and that was never measured. The cost of the omission surfaced
on 2026-07-27, when a fidelity rubric that charged removal of marketing hype
as omitted claims was found returning `floor_failed` to production users for
correct rewrites, unnoticed for as long as it had shipped.

`scripts/research/judge-rubric-check.mjs` closes the gap without human
labelling: ten constructed pairs whose correct verdict is fixed by
construction. Hype-only removal must pass; a changed figure, flipped negation,
dropped causal link, fabricated claim, or deleted claims must fail. First
results:

| judge | rubric check | note |
|---|---|---|
| gpt-5.5 (codex seat) | **10/10** | caught the 120ms → 12ms swap at MPS 66.7 |
| gemini-3.6-flash | 9/10 | **accepted** the 120ms → 12ms swap at MPS 80 |

A high AUC does not imply a judge grades meaning correctly. Run both checks
before adopting one.

## Deterministic stylometry on the same corpus

| layer | AUC [95% CI] | mean score human/AI |
|---|---|---|
| prose-score `score` (lang ko) | **0.98 [0.93, 1.00]** | 17.7 / 78.1 |

- The deterministic score **matches or beats every judge** on this
  leakage-free corpus, at zero marginal cost and perfect reproducibility.
- Pre-registered promotion rule (deterministic AUC ≥ best judge − 0.05 =
  0.95) **fires** → a promotion-review decision is filed with the operator
  (promotion is an operator call, not this study's).
- Caveat that keeps this honest: the *binary* document verdict currently used
  in some surfaces ("any hot paragraph") scores only 0.55 accuracy here — the
  continuous score separates nearly perfectly, but the hot-paragraph trigger
  is miscalibrated at document length. Any promotion should promote the
  score/threshold, not the current binary rule.

## Limitations (named, not hidden)

- n = 16 cross-family AI + 20 human per judge — CIs are wide (kimi's spans
  0.69–0.95). This is a calibration smoke test, not a benchmark claim.
- Register skew: human side is 14 blog + 4 technical-how-to + 2 chat-update
  (fresh-collection reality); no product-doc/academic register.
- gpt's perfect 1.00 may reflect an easy corpus ceiling (3-family generic
  generations); it does not certify gpt on harder, edited, or rewritten text.
- The corpus is certain-label by construction; humanized/edited-AI middle
  ground — the study series' actual subject — is out of scope here.

## What this means for Study 3

Study 3's panel scores stand on measured ground: three PASS judges, panel
AUC 0.96, low repeat variance. Kimi dissents should be read as a lenient
judge's real opinion, absorbed by the quorum.

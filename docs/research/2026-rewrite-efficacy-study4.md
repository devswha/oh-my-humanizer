# Does a specificity-preservation constraint fix the Korean gap? — Study 4 results

Companion to `2026-rewrite-efficacy-prereg.md` ("Study 4" section, registered
2026-09-02 before any data, with three dated notes on the judge panel that were
written before any Study 4 judge score was read), Study 1
(`2026-rewrite-efficacy-study1.md`) and Studies 2–3. Study 4 tested the
survey's H-4b: that the plain rewrite loses concrete detail, and that a **98%
length floor plus a retain-every-concrete-detail block** on the plain prompt
lowers perceived AI-likeness without any new mechanism.

**Verdict up front: H-4b is NOT supported. The constrained rewrite (S) reads
marginally *more* AI-like than the plain rewrite (P) to the perceptual panel
(paired d +1.6, CI [−3.1, +6.5]) and clearly more AI-like to the deterministic
chief judge (+8.5, CI [+0.8, +17.0]). The model did not obey the floor: only
56% of AI documents reached 98% after up to three attempts. What the
constraint mostly bought was *less rewriting* (copy check fires) and a small
gain in retained detail, not humanness. Guard rail 1 (meaning gate) is
violated at 50/54. Nothing ships.**

- Run: stage 1 (ko) 2026-09-02 08:51 UTC → 2026-09-03 02:00 UTC, 15 supervisor
  passes across three claude session-limit windows. Same 54 Study 1 Arm-D
  documents (27 AI + 27 human) by stored original text; rewriter
  `claude-sonnet-4-6` invoked as patina's claude-cli backend; production
  minimal-mode prompt (template `a3b64773…`), constraint block `2394fa83…`,
  retry suffix `3953a21f…` — all fixed before the first row.
- Final matrix: **54/54 documents**, both arms, both LLM judges parsed on every
  body (0 quorum loss). Det chief fresh-corpus gate at run time: 0.926
  (50/54) → binary det verdicts allowed.
- Stage 2 (en, 42 Study 1 Arm-A1 documents): **not started as of
  2026-09-03**; deferral is an owner decision (see "Stage 2" below).

## Judge panel (registered deviation, decided before any row was read)

Panel v2's grok seat was unavailable (xAI: credits exhausted, HTTP 403 on
2026-09-02). The registered admission rule (AUC on the 54 archived S1-D
originals ≥ 0.85 AND Spearman with gpt ≥ Spearman(grok, gpt) − 0.10, all on
the same 108 archived passages) was applied to five candidates:

| candidate | scored | AUC | ρ vs gpt | ρ vs grok | admitted |
|---|---:|---:|---:|---:|---|
| gemini-2.5-pro (CLI) | 108/108 | 0.556 | 0.137 | 0.233 | no |
| **gemini-3.7-flash (API)** | 108/108 | **1.000** | **0.884** | 0.794 | **yes — selected** |
| gemini-3.1-pro-preview (API) | 108/108 | 0.971 | 0.849 | 0.790 | yes |
| deepseek-v4-pro (API) | 49/108 | incomplete (unparseable replies) | 0.696 (partial) | 0.690 (partial) | no |
| kimi-k3 (API) | 0/108 | account suspended (billing) | — | — | not bridged |

Reference on the same passages: gpt AUC 0.995, grok AUC 0.967, Spearman(grok,
gpt) 0.857. The panel is therefore **judge-gpt (codex, gpt-5.5) + judge-gemini-3.7-flash
(Gemini API)** plus the deterministic chief; both are cross-family for claude
rewrites. Four rows finished before admission were rejudged from their stored
bodies; the runner then carried both judges. The gemini-3.7-flash seat was
assessed on Korean passages only.

## H-4b-a (primary) — paired improvement on AI documents: **NOT SUPPORTED**

Perceptual score = mean of the two LLM judges' 0–100 AI-likeness.

| | P (plain) | S (specificity) | paired d = S − P (95% bootstrap CI) |
|---|---:|---:|---|
| AI docs (n=27) | 85.2 | **86.8** | **+1.6 [−3.1, +6.5]** |

Pre-set support required mean d ≤ −3 AND CI upper < 0. The point estimate is
positive and the interval includes zero: S is indistinguishable from P at
best, and leans worse. AI-call rate per judge call: 94.4% → 94.4%
(discordant pairs 2 vs 2, exact McNemar p = 1.0).

## The mechanism did not execute (H-4b-d)

| | AI docs | human docs |
|---|---:|---:|
| length ratio P → S | 0.908 → 0.984 | 0.928 → 0.988 |
| S rows meeting the 98% floor | **15/27 (56%)** | 20/27 (74%) |
| mean S attempts (max 3) | 2.19 | 2.07 |

The prereg set 80% as the floor-achievement target and said that below it
"the enforcement itself failed and (a) is read with that caveat". Read both
ways: the constraint did not help, *and* a prompt-level length floor with
feedback retries could not make claude-sonnet-4-6 keep 98% of a Korean
document in 44% of cases. The retry suffix moved the mean ratio from 0.91 to
0.98, but the last attempt still fell short on 19 of 54 documents.

## Secondary outcomes

| measure | P | S | reading |
|---|---:|---:|---|
| H-4b-c detail retention (AI docs) | 91.8% | 94.3% | +2.5 pp |
| added detail tokens per doc (AI) | 0.67 | 0.26 | guard rail 3 held (S − P ≤ 1.0) |
| copy check, median trigram Jaccard vs original (AI) | 0.517 | **0.667** | **fires**: S rewrote less |
| det chief continuous score (AI) | 33.3 | **41.9** | paired **+8.5 [+0.8, +17.0]** — S reads more AI-like to the deterministic scorer |
| structural share of still-"ai" cues (AI, n=51 each) | 92.2% | 84.3% | still overwhelmingly architectural |
| gpt-only, descriptive: S1 rw1 / P / S (AI) | 83.9 / 91.3 / 92.3 | | see note below |

The copy check and the det movement tell one story: the constraint made the
rewrite more conservative. Keeping every detail and 98% of the length leaves
the original's paragraph rhythm and structure in place, which is exactly what
the deterministic scorer and the judges' cues penalise. Detail retention rose
by 2.5 points because less was rewritten, not because the prose read more
human.

**Descriptive note on drift.** Today's plain rewrite (P) reads *more* AI-like to
gpt (91.3) than the archived Study 1 rewrite of the same documents did in July
(83.9). The production prompt changed twice in between (2026-07-28
no-invented-claims rule; 2026-08-05 voice-axis cutover) and the gpt judge may
also have drifted; this is why the registration made only within-run S vs P
confirmatory. It is reported here because a reader should see it, not
discover it.

## Guard rails

1. **Meaning-safety gate on S (pre-set ≥ 95%, ≥ 52/54): 50/54 = 92.6% —
   VIOLATED.** Two of the four failures are the two known corpus-artifact
   documents (generator length-preamble numbers; the same two failed in
   Studies 2 and 3). Descriptively, excluding them gives 50/52 = 96.2%, but
   the registered verdict stands. The other two are real content numbers
   dropped by S ("100", "24"); P dropped real numbers on four non-artifact
   documents (48/54 pass). A "keep every number" instruction did not stop the
   model from dropping numbers.
2. **Human-control over-editing:** paired d −0.7 [−2.8, +1.1] — **held**. The
   floor did not push human text toward AI (det −0.7 [−3.6, +2.2]).
3. **Invented-content proxy:** added detail tokens S − P = −0.41 (AI), −0.71
   (human) — **held**; the floor did not induce padding with new numbers or
   names.
4. **Copy check (descriptive):** fires on AI docs (S median 0.667 vs P 0.517;
   human 0.700 vs 0.581). "Preserved specificity" reads as "rewrote less".

## Why it failed (diagnosis)

Studies 1–3 located the surviving Korean tells in document architecture:
uniform paragraphs, tidy arcs, checklist coverage. H-4b bet that judges were
also reacting to lost specificity and that keeping it would help. The data
say the specificity loss is real but small (P already retains 92% of detail
tokens) and that restoring the last few points while freezing length leaves
the architecture untouched — the structural cue share stays above 84% and
the deterministic score rises. The model's refusal to hold a 98% floor on
Korean is a second, independent finding: length is not a knob a prompt can
turn reliably on this rewriter.

## Execution notes

- Session limits: 53 "session limit" failures across two claude 5-hour windows
  (resets 23:00 and 04:00 Asia/Seoul); the supervisor's circuit breaker
  pruned the fail-soft rows and resumed. The back-off was changed mid-run from
  fixed 30-minute polls to reset-aware sleeps (plumbing only).
- One 600 s execute timeout (doc 12, S attempt 2); the rewrite timeout was
  raised to 900 s from the next pass, following the Study 1 (300→600) and
  Study 3 (600→900) precedents. No prompt or criterion changed.
- The judge panel changed from gpt-only to gpt + gemini-3.7-flash after four
  rows, per the dated prereg notes; those rows were rejudged from stored
  bodies. Two runner restarts (panel change, loop change) lost only in-flight
  work.
- The Study 4 bridge scripts, runner, loop and analysis live under
  `scripts/research/`; committed artifacts are hash-and-score rows
  (`artifacts/rewrite-efficacy-study4/s4-rows-ko.jsonl`) and the bridge rows
  and verdicts. Raw texts stay in the ignored private store.

## What ships

Per the pre-registered decision rule: nothing. No efficacy claim attaches to a
length floor or a keep-every-detail instruction, and the block is not added to
the production prompt. The next candidate on the registered list is **H-4a —
deterministic merge/split with seam-only LLM infill** — the first mechanism
that acts on the architecture the judges keep naming.

## Stage 2 (en) — completed 2026-09-04: **NOT supported either**

Run 2026-09-04 07:02 → 10:15 UTC on the owner's instruction, 2 supervisor
passes, no session-limit hits. The 42 Study 1 Arm-A1 documents (21 AI + 21
human; `spok` excluded per pilot Deviation 4), same rewriter, English
production prompt (template `72428aea…`), English constraint block
(`81e2e53c…`) and retry suffix (`b320025b…`). Panel: `judge-gpt` +
`judge-gemini-3.7-flash` (re-admitted on the 84 archived English passages:
AUC 0.994, Spearman vs gpt 0.911 against grok's 0.894; the gemini CLI
transport of the same model timed out and was not admitted). Det chief
fresh-corpus accuracy on the English originals was **0.762 < 0.85**, so per
panel v2 the binary det column is disabled and only the continuous det score
is reported.

| | P (plain) | S (specificity) | paired d = S − P (95% CI) |
|---|---:|---:|---|
| AI docs, panel AI-likeness (n=21) | 81.8 | **85.5** | **+3.7 [−3.5, +10.8]** |
| AI docs, det chief (continuous) | 11.3 | **23.4** | **+12.1 [+4.5, +20.6]** |
| human docs, panel (n=21) | 10.5 | 9.5 | −0.9 [−3.3, +1.9] (guard rail 2 held) |

- **H-4b-a: NOT SUPPORTED.** The point estimate is positive again and the
  interval includes zero. AI-call rate 95.2% → 95.2% (discordant 2 vs 2).
- **The floor executed this time.** Unlike Korean, every English S row met
  the 98% floor (42/42; mean 1.67 attempts on AI docs). The plain rewrite
  compresses English hard (P length ratio **0.806** on AI docs, 0.908 on
  human); S restored it to 1.03 / 1.00. So stage 2 is the clean test of the
  hypothesis that stage 1 could not deliver: with the length actually held,
  the constrained rewrite still reads *more* AI-like to both the panel and
  the deterministic scorer.
- **Copy check:** S median trigram Jaccard 0.630 vs P 0.540 on AI docs; on
  human docs 0.885 vs 0.746 (just under the 0.90 "rewrote less" line).
- **Guard rail 1: 38/42 = 90.5% — VIOLATED** (no corpus-artifact documents
  in this arm; four real dropped numbers in S; P 37/42). Rails 2 and 3 held.
- **Cue mix on AI docs still called "ai":** structural share fell from 35%
  (P) to 18% (S) while the specificity-absence class rose from 11 to 17 of 40
  cues. English judges name different residual tells than Korean judges
  (Korean: 84–92% structural), and keeping the length did not remove them.
- **Descriptive gpt-only:** S1 rw1 74.0 | P 86.0 | S 89.5 on AI docs — the
  same upward drift of today's plain rewrite versus July's that stage 1
  showed (prompt changed twice since; judge drift possible).

**Metric caveat found after the fact (not a criterion change):** the
registered detail-token definition counts every Latin token of two or more
letters, which in English is every word. The English "retention" (P 45% →
S 64%) and "added tokens" (~130 per document in both arms) therefore measure
vocabulary overlap, not concrete details, and guard rail 3 is vacuous for
English. The numbers-and-quotes part of the definition is unaffected; a
future English stage needs a detail definition that excludes ordinary
words. Recorded here and in the prereg as a dated note.

### Combined verdict

Both stages fail the registered primary criterion in the same direction and
both violate the meaning gate. In Korean the model would not hold the floor;
in English it held the floor and the result got worse. The hypothesis that
the plain rewrite's lost specificity is what judges react to is not
supported in either language. Nothing ships; the next candidate remains
H-4a.

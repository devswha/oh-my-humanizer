---
title: patina launch — EN channel drafts
category: Launch
target_url: https://patina.vibetip.help
created: 2026-07-23
notes:
  - No Pro checkout links or price CTAs until the Lemon Squeezy store review clears. CTA is the free playground plus GitHub.
  - Benchmark numbers are the fixed-fixture regression gate from docs/benchmarks/latest.md. Never phrase them as generalization claims.
  - The fabricated "30%" story is a real floor_failed event observed on the live free tier on 2026-07-23. Tell it exactly as it happened.
  - Post the Korean channels first (see patina-launch-korean-first.md), then HN once early feedback is folded in.
---

## Show HN

Title: Show HN: Patina – open-source AI-writing humanizer that rejects its own output when it fabricates

Body:

I got tired of hand-deleting the same AI tells from drafts: "isn't just X, it's Y", "in today's fast-paced world", the three-bullet paragraph. So I built a tool that does it, for Korean, English, Chinese, and Japanese. About 160 patterns total.

Two design choices set it apart from the usual humanizer:

Detection is deterministic and LLM-free. Sentence-length variance (burstiness), lexical diversity (MATTR), AI-lexicon density, plus Korean-specific diagnostics. Same input, same verdict, every time, with per-paragraph reasons you can audit.

Rewrites are gated on meaning. Every rewrite gets a meaning-preservation score against semantic anchors (claims, numbers, polarity, causation) and a fidelity score. Below the floor, the output is rejected, not shown. During a live smoke test the backing model invented a "cuts task time by about 30%" statistic that was nowhere in the source. The gate caught it and threw the rewrite away. A tool built to remove AI packaging should not add AI fabrication.

It is explicitly not a detector bypass. The ethics doc draws that line, and the scoring is designed for auditability, not evasion.

Free browser playground (no signup), a CLI via npx patina-cli, and the whole pattern catalog, scoring spec, and benchmark corpus are in the repo.

Playground: https://patina.vibetip.help
Repo: https://github.com/devswha/patina

The failure mode I most want reports on: false positives, human-written text flagged as AI. Labeled counterexamples go straight into the regression corpus.

## Reddit (r/artificial, writing subs)

Title: I built an open-source tool that removes AI phrasing from text, and it refuses to output a rewrite that changes your claims

Body:

Patina detects AI-sounding patterns (about 160 across Korean, English, Chinese, Japanese) and rewrites them in plain human phrasing. The part I care most about: it scores every rewrite for meaning preservation, and if the rewrite altered a claim, a number, or a causal link, it rejects the output instead of showing it.

That gate fired in live testing. The model slipped a fabricated "30% time savings" stat into a rewrite; the pipeline scored it, failed it, and discarded it.

Detection itself runs without any LLM, so it is deterministic and auditable. You can see exactly which paragraph tripped which signal. It is not an AI-detector bypass and does not try to be; there is an ethics doc in the repo about that.

Free in the browser, no signup: https://patina.vibetip.help
Source: https://github.com/devswha/patina

## X (EN) — thread

> Gate-verified 2026-07-23: `patina-score` **0.0%** (gate 30). First draft failed at 66.7% — uniform punchy sentences (low burstiness) plus quoting "In today's fast-paced world" verbatim tripped the EN lexicon. Rewritten with sentence-length variance and a different quoted tell. Weighted lengths (CJK=2, URL=23, cap 280) verified per tweet.

1/ (271/280 incl. URL)
AI drafts all share the same tells. "isn't just X, it's Y," the word "delve," three bullets under every heading. I got tired of hand-deleting them, so I built an open-source tool that strips them, in KO, EN, ZH, JA. Free in the browser, no signup.
https://patina.vibetip.help

2/ (257/280)
The interesting part isn't the rewriting. It's the refusal. Every rewrite is scored for meaning preservation. In live testing the model fabricated a "30% time savings" stat. The gate failed it and threw the output away. Your words change. Your claims don't.

3/ (267/280 incl. URL)
Detection runs without an LLM: burstiness, lexical diversity, AI-lexicon density, with per-paragraph reasons you can audit. Same input, same verdict, every time. Everything's in the repo. Best contribution: human-written text it wrongly flags.
https://github.com/devswha/patina

Postscript tweet (self-reply to 1/ the next day; 244/280 — attach the patina-score report screenshot):
Postscript: the first draft of this thread failed patina's own detector at 66.7%. Not the words. The rhythm. Uniform punchy sentences are the most AI cadence there is. One rewrite with real variance later: 0%. You just read the passing version.

## X (EN) — wave-riding on @petergyang's /no-ai-slop post

Context (2026-07-23): https://x.com/petergyang/status/2079943830024188105 — posted ~11h ago, 302K views / 3.2K likes / 980 repo stars at time of writing. Same category (AI-slop removal skill), EN-only, ~20 patterns, two files (SKILL.md + eval.md), LLM-executed. Replies already mention people using "humanizer" variants — validated, assembled audience. Post the reply while the engagement window is open; do not wait for the thread schedule.

Fact basis for every comparative claim (verified against his repo/README 2026-07-23): his stated scope is "20+ patterns", English, no deterministic detector, no meaning gate. Ours: ~160 patterns / KO-EN-ZH-JA / LLM-free deterministic detection / meaning-preservation gate with a real live floor_failed event. State facts, never disparage — complimentary tone, "same rabbit hole" framing.

Reply (post now, under his top tweet; 277/280 — zero em dashes, per our own en-style.md #13 short-form branch):
Went down the same rabbit hole: 160 patterns, KO/EN/ZH/JA. Detection uses no LLM, so verdicts are deterministic with per-paragraph reasons. And if a rewrite fabricates a claim, a meaning gate rejects it (it caught a made-up "30% savings" stat live). MIT: https://github.com/devswha/patina

Quote tweet (same day, KST 22:00-24:00 = US morning, while the source post is still surging; 248/280 — zero em dashes):
This, but my problem was worse: I write in Korean, and slop removers are English-only. So I built one for KO/EN/ZH/JA. 160 patterns, LLM-free detection, and a gate that rejects rewrites that fabricate claims. Free, no signup: https://patina.vibetip.help

## X (EN) — reply-tree FAQ kit

Pre-verified answers for likely questions under the reply/QT. All under 280 weighted, zero em dashes. Post as-is or trim; respond fast, reply-tree speed drives ranking. Live status verified 2026-07-23: free-tier /api/rewrite streams end-to-end and the fidelity floor fired on a pure-puffery test input (output rejected, not shown), so the gate claim is live-checkable by anyone.

Q: Is this a detector bypass? (240/280)
No, and it says so in the repo. It is not built to beat detectors; there is an ethics doc drawing that line. It is for allowed AI-assisted editing where you want your own voice back, with an audit trail showing exactly what changed and why.

Q: How is it different from /no-ai-slop? (244/280 — stay complimentary)
His skill is great for quick English edits. Patina goes wider and stricter: 160 patterns across KO/EN/ZH/JA, detection that runs without an LLM (same input, same verdict), and a gate that rejects any rewrite that changes your claims or numbers.

Q: How do I install it? (236/280)
Three ways: browser (no signup) at https://patina.vibetip.help, CLI via npx patina-cli, or as an agent skill. For Claude Code: /plugin marketplace add devswha/patina then /plugin install patina@patina. Works in Codex, Cursor, Gemini CLI too.

Q: How good is the Korean support? (234/280)
Korean is the reason it exists. 40 KO patterns plus Korean-specific diagnostics (translationese, template rhythm). If it ever flags your human-written Korean as AI, send it over; false positives go straight into the regression corpus.

Q: Is the detection reliable / is it an AI detector? (226/280)
It is not an authorship detector and does not claim to be. The detection layer flags AI-sounding style signals with per-paragraph reasons, deterministically, as a regression-tested editing aid. No verdict about who wrote what.

Q: How does the meaning gate work? (242/280)
Every rewrite is scored against semantic anchors from your source: claims, numbers, polarity, causation. Below the floor, the output is discarded, not shown. I watched it throw away a rewrite that invented a 30% stat. That is the whole point.

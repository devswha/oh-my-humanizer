# Polar application prep (2026-07-29)

> Pre-work for the replacement payment provider after the Lemon Squeezy
> decline. Owner submits; this file is the evidence pack and the honesty
> boundary. Context: [`payment-provider-reset-20260729.md`](payment-provider-reset-20260729.md).

## Where patina lands in Polar's policy (verified 2026-07-29)

Read from Polar's Acceptable Use Policy (effective 2026-03-25):

- **Acceptable products** name "Software & SaaS" first, and explicitly list
  **License Keys** as a Polar-fulfilled delivery mechanism — the entitlement
  model ports directly.
- **Prohibited products**: patina matches none of the 36 categories. Two are
  worth naming because a careless description could drag patina into them:
  - #18 *"Services to circumvent the rules, paywalls or terms of other
    services"* — a product sold as "beat AI detectors" is exactly this.
    patina is not, and must never be marketed as, that.
  - #22 *"Cheating … macros, cheat codes and hacks"* — the academic-misuse
    adjacency, same as LS's "Homework/Essay mills" line.
- **Restricted, requires closer review**: *"AI Content Generation tools
  (text, image, video, voice)"*. **patina will land here.** This is not a
  rejection category; it means enhanced due diligence and that the
  description plus public evidence decide the outcome.

Conclusion: approvable, but reviewed. Prepare for the review rather than
hoping to slip past it.

## The honesty boundary (read before writing the application)

The LS failure was a framing failure, not a product problem — so the fix is
to lead with the accurate description instead of the catchy one. That is
repositioning, **not disguise**, and the line must not be crossed:

- **Do** lead with what patina verifiably does: deterministic detection,
  style rewriting, a meaning-preservation gate that rejects its own output
  when claims/numbers drift (demonstrable live), an audit trail, MIT source.
- **Do** state plainly that it is not an authorship detector and not a
  detector-evasion tool, and link the ethics policy that has said so since
  before any payment application existed.
- **Do NOT** deny that patina rewrites AI-generated text, or that people
  call this category "humanizer". If Polar asks directly, the answer is
  "yes, it rewrites AI-sounding drafts — here is the ethics policy and the
  meaning gate that separate it from detector evasion." A denial would be
  misrepresentation to a payment processor, which is both wrong and the
  fastest way to lose an approved account later.

## Repo/site changes made for this (this branch)

The reviewer's first surface is `patina.vibetip.help`, not the repo. Before
this branch, the page's own metadata read as the risky category:

| surface | before | after |
|---|---|---|
| `<title>` | "make AI text sound human" | "rewrite AI-sounding drafts, keep every claim" |
| `<meta description>` | "patina humanizer — rewrite AI-sounding text naturally…" | deterministic style editor + meaning-preservation gate + "Not an authorship detector and not an AI-detection bypass tool" |
| pricing section | offer only | offer + a scope/ethics note linking `docs/ETHICS.md` |

Already in place and unchanged: Ethics is linked in both the nav and the
footer; the pricing card is engine-neutral at 50,000 chars/month; checkout
stays fail-closed disabled ("Pro — coming soon").

Deliberately NOT changed: the hero headline ("Make it sound human") and the
word "humanizer" in body copy and the README. Scrubbing the word everywhere
would be the disguise this document forbids — and the README's own sentence
("not a black-box paraphraser, authorship detector, or detector-bypass
tool") is stronger evidence for a reviewer than an absence would be.

## Application text (reuse verbatim)

**Product**: patina — multilingual writing-style editor (KO/EN/ZH/JA)

**Description**: patina is an open-source (MIT) writing-style editor for
Korean, English, Chinese, and Japanese. It detects formulaic, AI-sounding
phrasing with a deterministic, LLM-free analyzer and rewrites it, while a
meaning-preservation gate verifies that the claims, numbers, polarity, and
causation of the source are unchanged — a rewrite that drifts is rejected
rather than shown. It ships as a CLI (`npx patina-cli`), an agent skill, and
a hosted browser playground. It is not an authorship detector and not a tool
for evading one; the published ethics policy states this and the project
refuses that use case.

**What is sold**: a monthly subscription (Pro, $9.99/mo USD) that raises the
hosted rewrite limits for a licensed user. Delivery is a license key
validated per request by our API. Free and bring-your-own-key tiers remain
available without payment.

**Supporting links**: source github.com/devswha/patina · live product
patina.vibetip.help · ethics policy docs/ETHICS.md · benchmark report
docs/benchmarks/latest.md

## Owner checklist before submitting

1. Confirm Polar supports payouts to the seller's country (KR) and decide
   individual vs. registered business — an entity generally reviews better
   in a "closer review" category.
2. Submit with the text above; do not reuse the LS application wording.
3. Expect enhanced due diligence for the AI-tools category and answer it
   with the live product plus the ethics policy. Volunteering the ethics
   stance up front is stronger than being asked.
4. Nothing needs to be switched off meanwhile: checkout is disabled, and
   free/BYOK keep serving.

## Agent follow-ups once a provider is approved

1. Entitlement adapter behind the existing injected `licenseValidator`
   interface; acceptance criterion is that the handler, quota, and redteam
   suites need no change.
2. Rebind checkout evidence + rename `LS_*` env.
3. Re-issue PAY-B-COST at the 50,000-char cap with the new provider's fee in
   `feeUsdMicros` (Polar ≈ 4% + 40¢ vs the 999,500 µUSD LS assumption).

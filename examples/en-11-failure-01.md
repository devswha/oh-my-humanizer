---
pattern: 11
type: failure
name: Elegant Variation (Synonym Cycling)
pack: en-language
language: en
---

# Pattern 11 (en): Elegant Variation (Synonym Cycling) — Failure Case (False Positive)

## Input Text

> Alphabet reported $307 billion in revenue for 2023. Google, its main subsidiary, accounted for about 90% of that through advertising and cloud services. The parent company also operates Waymo, Verily, and several smaller ventures through its Other Bets segment.

## Expected Output

> (No correction — Pattern 11 should not fire on this text)

## Applied Pattern

- Pattern 11 (Elegant Variation): "Alphabet", "Google", and "the parent company" refer to related but distinct entities, which could superficially look like synonym cycling.

## Judgment

**Failure (false positive)** — The exclusion condition covers "legitimate disambiguation (using 'the company' vs. 'Microsoft' when distinguishing a parent from a subsidiary)." Here, "Alphabet" is the publicly traded parent company and "Google" is its subsidiary — they are legally and operationally distinct entities, not synonyms. "The parent company" in the third sentence refers back unambiguously to Alphabet, distinguishing it from Google. Each name serves a precise purpose: Alphabet for consolidated revenue, Google for the advertising/cloud segment, and "the parent company" to clarify which entity runs Other Bets. This is functional precision, not decorative variation.

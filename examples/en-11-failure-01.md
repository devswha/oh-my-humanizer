---
pattern: 11
type: failure
name: Synonym Cycling
pack: en-language
language: en
---

# Pattern 11 (en): Synonym Cycling — Failure Case (False Positive)

## Input Text

> Alphabet reported $307 billion in revenue for fiscal year 2024, up 14% from the prior year. Most of that growth came from Google, whose advertising division alone generated $224 billion. Meanwhile, DeepMind — the research lab Alphabet acquired in 2014 — published 82 papers at major AI conferences, more than any other corporate lab that year.

## Expected Output

> (No correction — Pattern 11 should not fire on this text)

## Applied Pattern

- Pattern 11 (Synonym Cycling): "Alphabet," "Google," and "DeepMind" are three different names appearing in the same paragraph.

## Judgment

**Failure (false positive)** — Alphabet, Google and DeepMind have distinct referents in this passage: consolidated revenue, advertising revenue and research output. They are not interchangeable labels for one subject. The no-correction control preserves those distinctions; its company-history and financial claims have not been fact-checked.

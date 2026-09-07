---
pattern: 36
type: failure
name: Faux-Insight Setup
pack: en-filler
language: en
---

# Pattern 36: Faux-Insight Setup — Failure (False Positive)

## Input Text

> Most people don't realize that the 1976 Copyright Act already covers this case. The common belief, repeated in three of the five textbooks on my shelf, is that pre-1978 sound recordings fall outside federal protection entirely. Section 301(c) says otherwise: state-law protection continues until 2067, and the CLASSICS Act of 2018 layered federal digital-performance rights on top.

## Expected Output

> (No correction — this text should not trigger Pattern 36)

## Applied Pattern

- Pattern 36 (Faux-Insight Setup): "Most people don't realize" opens the passage.

## Judgment

**Failure (false positive)** — The passage states a view, identifies where the writer encountered it, and supplies statutory references in response. The setup therefore has an argumentative role beyond insider posture. The no-correction control preserves those references; it does not verify the legal interpretation or how widely the view is held.

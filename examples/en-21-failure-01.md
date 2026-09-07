---
pattern: 21
type: failure
name: Sycophantic/Servile Tone
pack: en-communication
language: en
---

# Pattern 21: Sycophantic/Servile Tone — Failure (False Positive)

## Input Text

> "That's a great question," the senator replied, adjusting her microphone. "The short answer is that we don't have the votes yet. We're three short in committee, and two of those members haven't committed either way."

## Expected Output

> (No correction — this text should not trigger Pattern 21)

## Applied Pattern

- Pattern 21 (Sycophantic/Servile Tone): "That's a great question" appears at the start of the response.

## Judgment

**Failure (false positive)** — The phrase is inside dialogue attributed to the senator, rather than an opener addressed by the author to the reader. Removing it would alter the quotation. This no-correction control prioritizes quotation preservation; the pack's absolute exclusion wording remains unchanged in this audit.

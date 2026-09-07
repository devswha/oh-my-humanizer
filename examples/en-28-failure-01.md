---
pattern: 28
type: failure
name: Stacked Subordinate Clauses
pack: en-structure
language: en
---

# Pattern 28 (en): Stacked Subordinate Clauses — Failure Case (False Positive)

## Input Text

> A method for processing data, comprising: receiving, by a processor configured to execute machine-readable instructions stored in a non-transitory computer-readable medium, a plurality of input signals; transforming, by the processor, the plurality of input signals into a normalized data structure according to a predefined schema; and outputting, by the processor, the normalized data structure to a connected display device.

## Expected Output

> (No correction — Pattern 28 should not fire on this text)

## Applied Pattern

- Pattern 28 (Stacked Subordinate Clauses): The sentence contains 4+ embedded participial phrases and appositives — "by a processor configured to execute machine-readable instructions stored in a non-transitory computer-readable medium" nests three levels deep, and the overall claim requires parsing 8 commas before reaching the final element.

## Judgment

**Failure (false positive)** — This passage is framed as a patent claim, with nested qualifications that define the processor, inputs, schema and output. The technical/legal-format exclusion applies. The no-correction result preserves the scope as written; this example makes no claim about legal validity or worldwide drafting requirements.

---
pattern: 10
type: failure
name: Rule of Three Overuse
pack: en-language
language: en
---

# Pattern 10 (en): Rule of Three Overuse — Failure Case (False Positive)

## Input Text

> The U.S. federal government is divided into three branches: the legislative, the executive, and the judicial. Congress writes the laws, the President enforces them, and the courts interpret them. This separation of powers was established by the Constitution to prevent any single branch from accumulating too much authority.

## Expected Output

> (No correction — Pattern 10 should not fire on this text)

## Applied Pattern

- Pattern 10 (Rule of Three Overuse): Two three-item lists appear in consecutive sentences, matching the surface-level frequency condition.

## Judgment

**Failure (false positive)** — The exclusion condition covers "naturally occurring triads in genuinely three-part processes." The three branches of government are a constitutional fact, not an arbitrary grouping. There are exactly three branches — not two, not four. The second sentence's three-part structure (Congress/President/courts and their respective functions) maps directly onto this factual triad. Reducing or expanding the count would make the text factually incorrect. This is enumeration of a real three-part structure, not the artificial rhythm of AI-generated triples.

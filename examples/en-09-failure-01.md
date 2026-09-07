---
pattern: 9
type: failure
name: Negative Parallelisms
pack: en-language
language: en
---

# Pattern 9 (en): Negative Parallelisms — Failure Case (False Positive)

## Input Text

> The event is not a conference but a workshop — no keynotes, only hands-on sessions lasting 90 minutes each. Attendees work in groups of five on a single design problem chosen by the facilitator. Last year, 80% of participants said the format was more useful than traditional conference talks.

## Expected Output

> (No correction — Pattern 9 should not fire on this text)

## Applied Pattern

- Pattern 9 (Negative Parallelisms): "not a conference but a workshop" appears once.

## Judgment

**Failure (false positive)** — The negative frame distinguishes a workshop from a conference and explains the difference: no keynotes and only hands-on sessions. It carries content, so the exclusion applies even though some single instances can trigger the pattern elsewhere. Preserve the session length, group size and attributed 80% result.

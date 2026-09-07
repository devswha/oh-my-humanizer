---
pattern: 5
type: failure
name: Vague Attributions
pack: en-content
language: en
---

# Pattern 5 (en): Vague Attributions — Failure Case (False Positive)

## Input Text

> Doctors recommend at least 150 minutes of moderate aerobic exercise per week for adults. This level of activity is associated with lower risks of heart disease, type 2 diabetes, and several forms of cancer. For older adults, adding balance and flexibility exercises twice a week further reduces the risk of falls and fractures.

## Expected Output

> (No correction — Pattern 5 should not fire on this text)

## Applied Pattern

- Pattern 5 (Vague Attributions): "Doctors recommend" is an unspecified authority claim without a named individual or institution.

## Judgment

**Failure (false positive)** — The intended control is the general attribution "Doctors recommend" in health guidance. The no-correction result preserves the input, including its quantities and associations. This editorial review does not validate the health recommendations or require replacing general attribution with an invented doctor.

---
pattern: 5
type: failure
name: Vague Attributions
pack: en-content
language: en
---

# Pattern 5 (en): Vague Attributions — Failure Case (False Positive)

## Input Text

> Doctors recommend at least 150 minutes of moderate aerobic exercise per week. This guideline, supported by decades of research, is associated with lower rates of heart disease, type 2 diabetes, and certain cancers. Most physicians consider regular physical activity one of the most effective preventive measures available.

## Expected Output

> (No correction — Pattern 5 should not fire on this text)

## Applied Pattern

- Pattern 5 (Vague Attributions): "Doctors recommend" and "most physicians consider" are technically unspecified attributions that could superficially trigger the pattern.

## Judgment

**Failure (false positive)** — The exclusion condition covers "well-established consensus facts with no reasonable controversy." The 150-minute exercise guideline is published by the WHO, AHA, and CDC — it is as uncontroversial as "doctors say smoking causes lung cancer." Demanding a named individual physician for a universally accepted public health recommendation would be pedantic and unnecessary. The surrounding text includes a specific threshold (150 minutes), concrete health outcomes, and no speculative claims. Firing Pattern 5 here would penalize standard health writing for not footnoting common medical consensus.

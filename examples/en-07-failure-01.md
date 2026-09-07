---
pattern: 7
type: failure
name: AI Vocabulary Words
pack: en-language
language: en
---

# Pattern 7 (en): AI Vocabulary Words — Failure Case (False Positive)

## Input Text

> The 2024 study followed 1,200 participants across six cities over 18 months. Researchers found that robust community support networks reduced hospital readmission rates by 14%. The result was consistent across urban and rural cohorts.

## Expected Output

> (No correction — Pattern 7 should not fire on this text)

## Applied Pattern

- Pattern 7 (AI Vocabulary Words): "robust" appears once.

## Judgment

**Failure (false positive)** — Only one watch word, "robust," appears. It describes community support networks; it does not assert statistical robustness. The pattern requires a cluster of at least three watch words, so this standalone use remains unchanged. The numbers do not establish authorship.

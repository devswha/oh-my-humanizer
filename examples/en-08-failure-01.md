---
pattern: 8
type: failure
name: Copula Avoidance
pack: en-language
language: en
---

# Pattern 8: Copula Avoidance — Failure (False Positive)

## Input Text

> Under the new governance charter, the ethics committee serves as an independent advisory board to the CEO. It reviews all proposed acquisitions above $50 million and can issue binding recommendations on conflicts of interest.

## Expected Output

> (No correction — this text should not trigger Pattern 8)

## Applied Pattern

- Pattern 8 (Copula Avoidance): "serves as" appears once, describing the committee's function.

## Judgment

**Failure (false positive)** — "Serves as" describes the ethics committee's formally assigned advisory role under a governance charter. That role distinction is why the exclusion applies. The no-correction result preserves the $50 million threshold and the committee's stated powers.

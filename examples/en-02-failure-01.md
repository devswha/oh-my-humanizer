---
pattern: 2
type: failure
name: Undue Emphasis on Notability/Media
pack: en-content
language: en
---

# Pattern 2 (en): Undue Emphasis on Notability/Media — Failure Case (False Positive)

## Input Text

> The app has been downloaded over 10 million times across 45 countries since its 2022 launch. It is widely used in sub-Saharan Africa, where mobile-first banking adoption grew 38% year-over-year according to a 2023 GSMA report. The World Bank cited the platform in its 2024 Global Findex update as an example of effective financial inclusion.

## Expected Output

> (No correction — Pattern 2 should not fire on this text)

## Applied Pattern

- Pattern 2 (Undue Emphasis on Notability/Media): "widely used" and "cited" could superficially resemble unsourced notability claims.

## Judgment

**Failure (false positive)** — The exclusion condition states that claims backed by rough scale ("used in 50 countries", "over 10 million installs") are acceptable even without named sources. Here, every claim is backed by specifics: 10 million downloads, 45 countries, a named source (GSMA, World Bank), a dated report (2023, 2024), and a concrete statistic (38%). "Widely used" is grounded in verifiable numbers, not vague prestige. Firing Pattern 2 on sourced, quantified statements would be a false positive.

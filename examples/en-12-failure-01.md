---
pattern: 12
type: failure
name: False Ranges
pack: en-language
language: en
---

# Pattern 12 (en): False Ranges — Failure Case (False Positive)

## Input Text

> The study tracked participants aged 18 to 65 over a three-year period from 2021 to 2024. Household income ranged from $25,000 to $150,000 per year. Researchers found that those earning $25,000–$50,000 spent 34% of income on housing, compared to 18% for the $100,000–$150,000 bracket.

## Expected Output

> (No correction — Pattern 12 should not fire on this text)

## Applied Pattern

- Pattern 12 (False Ranges): Three "from X to Y" constructions appear — age range, time period, income range — which could surface-match the pattern's watch words.

## Judgment

**Failure (false positive)** — The exclusion condition explicitly states that "genuine numeric or temporal ranges ('from 10 to 100 employees', 'from January to March', 'from $5 to $50') are not this pattern." All three ranges here are genuine quantitative bounds: an age range (18–65), a study period (2021–2024), and an income range ($25,000–$150,000). Each range defines the actual parameters of the research and is used analytically in the subsequent finding. These are informative boundaries, not decorative breadth claims. Firing Pattern 12 on factual numeric ranges would be a false positive.

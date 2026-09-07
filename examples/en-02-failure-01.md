---
pattern: 2
type: failure
name: Undue Emphasis on Notability/Media
pack: en-content
language: en
---

# Pattern 2 (en): Undue Emphasis on Notability/Media — Failure Case (False Positive)

## Input Text

> Dr. Elena Marquez's 2019 paper on CRISPR delivery mechanisms has been cited over 3,000 times according to Google Scholar. Nature featured her lab's follow-up study in its March 2023 issue, and the Nobel Committee included her work in its shortlist commentary published that October. She is now the most-funded principal investigator in her department's history.

## Expected Output

> (No correction — Pattern 2 should not fire on this text)

## Applied Pattern

- Pattern 2 (Undue Emphasis on Notability/Media): "cited over 3,000 times" and "most-funded principal investigator" could superficially resemble notability claims.

## Judgment

**Failure (false positive)** — The passage illustrates attribution with outlet names, dates and a citation count. Pattern 2 is concerned with vague acclaim, so those references remain intact. The final funding-rank claim lacks a source, and none of the named references has been independently verified here. This control tests editing behavior, not factual accuracy.

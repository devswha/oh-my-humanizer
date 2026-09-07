---
pattern: 13
type: failure
name: Em Dash Overuse
pack: en-style
language: en
---

# Pattern 13: Em Dash Overuse — Failure (False Positive)

## Input Text

> She opened the envelope, scanned the first line, and stopped. The grant had been denied — no explanation, no appeal process, nothing. She sat with it for a long time before calling her co-founder.

## Expected Output

> (No correction — this text should not trigger Pattern 13)

## Applied Pattern

- Pattern 13 (Em Dash Overuse): One em dash appears in the text.

## Judgment

**Failure (false positive)** — One intentional em dash marks a pause in narrative prose. The literary-style exclusion applies, and this is not the social/marketing scoring branch. Keep the punctuation and all details about the denied grant unchanged.

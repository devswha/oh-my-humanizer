---
pattern: 18
type: failure
name: Curly Quotation Marks
pack: en-style
language: en
---

# Pattern 18 (en): Curly Quotation Marks — Failure Case (False Positive)

## Input Text

> “To be or not to be,” wrote Shakespeare, though the full soliloquy is rarely quoted in its entirety. Harold Bloom called it “the most famous speech in the English language,” a claim that few literary scholars have disputed. The phrase has since entered common usage, often shortened to a rhetorical shrug: “To be or not to be—that’s the real question, isn’t it?”

## Expected Output

> (No correction — Pattern 18 should not fire on this text)

## Applied Pattern

- Pattern 18 (Curly Quotation Marks): Three pairs of curly double quotes (“ ”) and two curly apostrophes (’) detected in text.

## Judgment

**Failure (false positive)** — The exclusion condition applies: these curly quotes appear in narrative literary prose, not in code blocks, configuration files, or technical documentation. Curly quotation marks are the typographically correct form for quoted speech and attributed quotations in published writing. The curly apostrophes in “that’s” and “isn’t” are likewise standard in typeset prose. Replacing them with straight quotes would be a typographic downgrade. Pattern 18 explicitly limits its scope to technical and code contexts where curly quotes cause functional problems.

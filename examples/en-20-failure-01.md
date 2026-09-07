---
pattern: 20
type: failure
name: Knowledge-Cutoff Disclaimers
pack: en-communication
language: en
---

# Pattern 20 (en): Knowledge-Cutoff Disclaimers — Failure Case (False Positive)

## Input Text

> GPT-4 was released in March 2023 with multimodal capabilities. The model's training data has a cutoff of September 2021, which means queries about events after that date may produce inaccurate responses. Researchers at Stanford noted that this limitation is particularly problematic for questions about the 2022 midterm elections and the Russia-Ukraine conflict. OpenAI has partially addressed this through retrieval-augmented generation in later versions.

## Expected Output

> (No correction — Pattern 20 should not fire on this text)

## Applied Pattern

- Pattern 20 (Knowledge-Cutoff Disclaimers): "training data has a cutoff" and "queries about events after that date may produce inaccurate responses" resemble AI self-referencing language.

## Judgment

**Failure (false positive)** — The paragraph discusses an AI system's training-data limits as its subject. That is the technical-documentation exclusion, regardless of who wrote it. Preserve the model description and caution; this review does not validate the dates or unnamed research reference.

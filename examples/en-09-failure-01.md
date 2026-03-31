---
pattern: 9
type: failure
name: Negative Parallelisms
pack: en-language
language: en
---

# Pattern 9 (en): Negative Parallelisms — Failure Case (False Positive)

## Input Text

> To be clear, this event is not a conference but a workshop. There are no keynote speakers, no panel discussions, and no expo hall. Participants spend all three days building prototypes in small teams of four. The goal is a working demo by Friday afternoon, not a slide deck.

## Expected Output

> (No correction — Pattern 9 should not fire on this text)

## Applied Pattern

- Pattern 9 (Negative Parallelisms): "not a conference but a workshop" and "not a slide deck" are "not X but Y" constructions that superficially match the pattern.

## Judgment

**Failure (false positive)** — The exclusion condition covers "genuine contrastive clarification correcting a misconception." The author is explicitly correcting a likely confusion: people expect a conference format, but this event has a completely different structure. The negative frame is doing real work — listing what the event deliberately excludes (keynotes, panels, expo hall) and what it replaces them with (prototyping, small teams, working demo). Removing the "not a conference" framing would lose the clarification that distinguishes this event from similar-sounding ones. The final "not a slide deck" reinforces a concrete deliverable expectation. This is functional contrast, not decorative inflation.

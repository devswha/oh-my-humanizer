---
pattern: 16
type: failure
name: Title Case in Headings
pack: en-style
language: en
---

# Pattern 16 (en): Title Case in Headings — Failure Case (False Positive)

## Input Text

> ## How Google Cloud Platform changed our DevOps pipeline
>
> After migrating from on-premise servers to Google Cloud Platform, our team reduced deployment times from four hours to under fifteen minutes. The combination of Cloud Build, Artifact Registry, and GKE made continuous delivery practical for a team of six.

## Expected Output

> (No correction — Pattern 16 should not fire on this text)

## Applied Pattern

- Pattern 16 (Title Case in Headings): The internal capitals belong to "Google Cloud Platform" and "DevOps."

## Judgment

**Failure (false positive)** — The heading uses sentence case while retaining the product name and DevOps capitalization. Those proper-name capitals must remain. The body and no-correction output are unchanged.

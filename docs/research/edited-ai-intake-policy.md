# Edited-AI intake policy

Frozen before new edited-AI collection, 2026-09-05. This is the data contract for
step 2 of the research backlog. It does not promote a detector or rewrite policy.

An original must have reviewed model-generation evidence tied to its exact text
hash. A fixture named `ai` is a style control and does not establish that a model
wrote it. Keep origin, editing actor and edit depth as separate fields. The
editing actor is human, model or mixed; a model paraphrase is never relabeled as
a human edit.

Light edits permit spelling, punctuation and local word substitutions, preserve
sentence/paragraph counts and order, and change at most 15% of tokens by normalized
Levenshtein distance. Heavy edits exceed that lexical bound or explicitly use
merge/split, reordering, paraphrase or roundtrip translation. The token definition
is Patina's language-aware tokenizer; depth is an operational label, not a claim
that meaning survived.

Illustrative examples (not research rows):

- Original: “The team will complete 12 reports by Friday.”
- Light: “The team will finish 12 reports by Friday.”
- Heavy reorder: “By Friday, the team will finish 12 reports.”

Both policies require preserved claims, quantities, polarity and causation. A
numeric proxy alone cannot certify that requirement. Record a separate meaning
review and its evidence. A completed `meaningReview` must bind `originalHash`
and `editedHash` to the exact reviewed texts; changing either text requires a
new review. Unreviewed or meaning-loss cases stay in the intake with
explicit exclusions; they cannot support performance claims. New external human
labels and the five-person panel remain separate requirements.

Run `node scripts/research/edited-ai-intake.mjs INPUT.json` for validation only;
pass a new output directory to write a hash-only manifest and private text file.
The manifest omits original/edit text, free notes, reviewer identities and source
reference strings. Source/license and meaning reviewers must verify the actual
evidence; the validator checks the declared bindings and does not authenticate
external authorship or consent. Do not supply private names as sample IDs or
model/license labels.

No actual edited-AI corpus or human ratings are claimed by this scaffold.

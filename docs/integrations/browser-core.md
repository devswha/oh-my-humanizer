# Shared browser analysis

`src/features/analyzer.js` is the file-free deterministic analyzer. Supply its
lexicon as data; `src/features/index.js` remains the Node adapter that resolves
local lexicon files. Existing Node exports and verdicts are preserved.

`src/prose-core.js` shares prose preparation, language detection and hot-paragraph
ratio calculations with `scripts/prose-score.mjs`. Browser callers can use
`scoreProse(text, { lang, lexicon, gate })`. The Node script adds file traversal
and pattern-watch diagnostics around the same calculations.

The `score` field is the prose hot-paragraph percentage used by the Action/badge
gate. `flooredScore` additionally retains document-level markup evidence. These
are deterministic editing signals; they are not the LLM-based `patina --score`
result or an authorship probability. Comparisons require the same public lexicon
and options. Private or custom local files are not part of a browser bundle.

The browser entry graph uses no filesystem, environment variables, provider
credentials or network APIs. Its caller must bundle the public lexicon data at
build time. The test suite compares the data-only and Node paths across all 49
public fixtures plus markup and Unicode controls. A pre-refactor differential
check also verified unchanged Node analyzer and prose scores for all 49 fixtures.

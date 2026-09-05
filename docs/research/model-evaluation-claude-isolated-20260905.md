# Claude personal-settings isolation cohort

Registered before model quality collection on 2026-09-05. The earlier native
collector inherited a personal `advisorModel` setting. Otherwise valid score
responses included both the requested Opus model and a Fable advisor in
`modelUsage`; the identity guard correctly refused to attribute them to one
model. Those rows remain archived as configuration-invalid observations, not
evidence that Opus failed the score schema or had poor writing quality.

This cohort keeps the existing scorer fixtures, rewrite prompts, judge rubrics,
repeats and selection rules. Each Claude process adds `--safe-mode`, an empty
`--setting-sources`, disabled slash commands and no session persistence. Built-in
tools and MCP are still disabled explicitly. OAuth remains available; `--bare`
is not used because it changes the authentication contract. User configuration
is never edited, and managed policy remains in force.

The observed CLI is Claude Code 2.1.261. Its built-in help documents these flags
and the `fable` model alias. The advisor trace identifies `claude-fable-5-1`;
admission probes must verify exact model identities before it enters quality
collection. The official web model overview returned HTTP 403, so this record
does not claim an exhaustive current vendor catalog. Opus 5, Sonnet 5 and Haiku
4.5 are retained; Sonnet 4.6 remains a baseline for Patina's existing default.

The configured effort is high for Fable, Opus and Sonnet. Haiku has no effort
override. These are explicit requested CLI settings, not an assertion that
different model families spend equal compute. Model-only observations require
one exact response model identity. Streaming assistant messages identify that
model and bind the terminal text to its last response. CLI `modelUsage` also
contains non-response calls, observed as Haiku usage even with personal advisors
disabled. Preserve all its token counts, separate primary and auxiliary usage,
and count attempts as CLI invocations rather than asserting one HTTP request.
Prompt totals include cache reads and writes. Missing fields remain unknown.
Unexpected fallback or mixed root assistant models remain invalid. This does not
claim that the native CLI makes no internal auxiliary calls.

Use a new output directory and its immutable protocol binding. Existing API
generations and judgments remain in their original cohorts; any future
evaluation of those outputs needs explicit parent hashes and separate judge
provenance. Do not relabel old rows to this protocol or reissue paid completions
to conceal a configuration error.

# Join independent evaluation outputs

`scripts/research/join-model-evaluations.mjs PLAN.json` performs an analysis-only
join. It never calls a model. The plan names the parent generation cohort, its
declared scope, the original evaluator source checkout and protocol, the separate
evaluation directories and a new output directory.

```json
{
  "parent": "/path/to/rewrite-screen",
  "parentRoot": "/path/to/generation-source",
  "parentCandidates": "/path/to/generation-protocol.json",
  "parentProvider": "anthropic",
  "candidates": "/path/to/evaluation-protocol.json",
  "evaluationSourceRoot": "/path/to/frozen-evaluator-source",
  "evaluations": ["/path/to/openai-judgments", "/path/to/gemini-judgments"],
  "output": "/path/to/new-analysis"
}
```

For legacy unbound parents, add `allowLegacyParent: true`; the complete parent
receipt audit is still mandatory. Optional `suite`, `repeat` and
`parentCandidate` must match the original generation matrix.

The join verifies parent snapshots, evaluator source/protocol hashes, complete
rows, public/private parity and request-bound raw completion values. It preserves
each original protocol ID and records the analysis script hash. Missing,
unresolved, duplicate or same-family judgments cannot yield a complete report.

Finalist selection follows the registered safe-output rate, naturalness median
and generation latency order. An exact tie uses candidate ID order for
reproducibility; it does not establish a unique quality winner. Finalists are
selected for the full repeated study, not promoted to production defaults.

# Evaluate preserved rewrites with a missing judge seat

Use this collector to add a missing fixed judge without regenerating the text or
changing an earlier generation/judgment protocol ID. It validates the declared
parent provider, candidate scope, suite and repeat matrix; public/private
generation metadata, source/output hashes and numeric safety must agree.

```sh
node scripts/research/evaluate-existing-rewrites.mjs --live \
  --parent /path/to/validated/rewrite-openai \
  --parent-root /path/to/frozen-source \
  --parent-candidates /path/to/frozen-source/docs/research/model-evaluation-20260904.json \
  --parent-provider openai \
  --allow-legacy-parent \
  --candidates docs/research/model-evaluation-claude-isolated-20260905.json \
  --judge anthropic-sonnet --output artifacts/claude-evaluation-openai
```

For a full confirmation cohort, pass `--suite full --repeat 3` and its
`--parent-candidate` when the source directory contains one selected model.
The entire declared matrix must exist before any new model call. The selected
seat must be absent from the parent; this tool never silently replaces a failed
or differently configured prior evaluation.

Parent directory bindings must match the rows. For older unbound directories,
`--allow-legacy-parent` enables a mandatory receipt audit; it does not bypass
validation. Every recorded generation and judgment is checked against its private
counterpart and completion receipts. Private-only or receipt-only judge evidence
blocks new calls until the original cohort is recovered. MPS, fidelity and
naturalness values are recomputed from the saved raw responses before reuse.

Each output directory binds its own protocol before calls and preserves private
call receipts. New rows carry both `parent_protocol_hash` and their evaluation
`protocol_hash`; `provenance.json` hashes all parent inputs. Existing parent API
judgments retain their original identities. Parent files are not rewritten.
Private judge details stay in private files; public reports contain aggregates.

`--report` creates a report without model calls. A parent with one existing
independent seat becomes complete only after the missing seat finishes. A parent
with neither seat needs two separate evaluation directories and a validated
analysis join; either single-seat report remains incomplete. Global model
defaults, the production rewrite prompt and human-evaluation requirements do not
change as a result of this collector.

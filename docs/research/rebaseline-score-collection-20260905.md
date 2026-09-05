# Private rebaseline score collection — September 5, 2026

`collect-rebaseline-scores.mjs` prepares a bounded, single-candidate `scoreText`
collection for issue #412. Execution requires `--live`. The existing frozen
intake has 85 records; this implementation has made no provider calls on them.
The parent owns processing-approval review and live execution.

The collector uses `evaluateScorerFixture` with prepared inputs and its existing
call journal. It has its own intake adapter because `loadScorerManifest` requires
boolean labels. Every collected target has `expected_hot: null` and `class: null`,
even if source metadata contains a fixture label. Source origin, rights, quality
labels, genre declarations, and dependency links remain in the private snapshot.
A model-generated origin does not assign a tell label, and a publisher page does
not establish human authorship.

Intake `register` means dataset genre: `social`, `marketing`, or `chat-update`.
It is retained as `datasetGenre`, with its declared review status. The scorer's
`config.register` and observed row `register` use only the pinned delivery axis,
`casual` or `professional` (or null). Genre is never copied into that setting.
Document type comes from an explicit intake `documentType` declaration or the
pinned config; the collector does not infer it from genre. Each row records which
source supplied document type. Unreviewed declarations do not become human-verified
labels, and original-fixture labels never become rewritten-text target labels.

The supplemental replay-gap audit showed why config fingerprints alone are
insufficient: observed scores could be reproduced without recovering the full
historical resolved config. This collector saves the actual serialized objects,
including inactive fields, before dispatch.

**Admission and bounds**

Supply an existing candidate protocol, its exact file SHA-256, and one candidate
ID. The selected definition is copied unchanged. Two approval schemas are supported.

The parent approval dated September 5 is consumed directly through `--approvals`;
no rewritten approval file is needed. Its `parentApproved`, scope, exact Gemini 3.7
OpenCodex candidate, `reviewPath`/`reviewHash`, `approvedTextHashes`, one repeat,
and logical-observation limit must agree. Every approved hash must have an
`approve` decision, verified bindings, and unchanged provenance in the bound
review. The reviewed bundle's three exact file hashes and semantic hashes are
checked too. Duplicate, deferred, substituted, or missing hashes reject the run.
The parent-selected order is retained, so this grant fixes one pass of 85 targets.

The original approval and review bytes and their SHA-256 values are stored in
`approvalSource` inside the private snapshot. The review's pending status is left
unchanged; the separate parent approval supplies the execution gate. Its authority,
unknowns, payload restriction, and exclusions are preserved verbatim. This does
not certify publication rights, human authorship, or quality. Both source files
remain untouched, and replay reads their frozen copies without rereading them.

The supplied approval was validated read-only: approval SHA-256
`8f31c1b5cbcf43af58a254cbc27f03b1ebab7378582fffe3614afdad3bb67c00`,
review SHA-256
`24d3403dc3f422291d5c087b9a19241ed828f774175dbdf337edfd62b3596f89`,
and all 85 approved hashes matched. No live calls were made.

The earlier per-text decision schema is also supported. Approved entries require
all fields below. These placeholders illustrate its schema and grant no processing
permission.

```json
{
  "schemaVersion": 1,
  "intakeHash": "<canonical hash of the complete frozen intake object>",
  "candidateHash": "<SHA-256 of JSON.stringify(selected candidate)>",
  "decisions": [
    {
      "textHash": "<SHA-256 of exact text bytes>",
      "sourceEvidenceHash": "<canonical hash of this record's origins array>",
      "decision": "approved",
      "reviewer": "<parent-recorded reviewer reference>",
      "reviewedAt": "<ISO timestamp>",
      "provider": "<selected provider>",
      "transport": "<selected transport>",
      "model": "<exact selected model>",
      "permittedLocalAnalysis": true,
      "permittedProviderProcessing": true,
      "retention": "private-only",
      "publication": "summary-only"
    }
  ]
}
```

Canonical hashes recursively sort object keys and preserve array order before
JSON serialization. The frozen bundle's `manifestHash` covers `intake.records`;
its `intakeHash` covers the complete intake object. The collector verifies all
content-addressed evidence blobs and inherited byte/hash bindings. The source
index is also copied and hashed in the new snapshot.

Missing decisions remain unknown. Explicit `blocked` and `unknown` decisions
stay excluded. The approved matrix and the full intake denominator are fixed
before calls; source rights and quality labels are never rewritten by approval.
No collection runs with zero approved texts.

There is one candidate and one evaluation per approved text. The caller supplies
`--max-calls`, bounded by twice the approved count (at most 170). This counts
reserved completion invocations, including errors; it is not a cash-cost figure.
For native routes the bound covers CLI invocations; auxiliary usage and upstream
request counts are known only where the transport reports them.
The production parser may invoke the transport twice after malformed JSON. A
valid JSON object that fails the stricter study schema remains a schema failure.
Timeouts are explicit, from 1 to 180 seconds per logical evaluation.

**Prepare, execute, and replay**

Run from the committed collector checkout. All paths are explicit; the examples
use placeholders and do not create or approve a real cohort.

```sh
node scripts/research/collect-rebaseline-scores.mjs \
  --intake <frozen-intake-directory> \
  --protocol <candidate-protocol.json> --protocol-sha256 <file-sha256> \
  --candidate <candidate-id> --config <pinned-config.yaml> \
  --approvals <processing-approvals.private.json> \
  --output <new-private-directory> --max-calls <approved-bound> \
  --timeout-ms 60000
```

This prepares the snapshot and dispatches no provider call. After the parent's
review, the same bound directory can be executed with:

```sh
node scripts/research/collect-rebaseline-scores.mjs \
  --output <prepared-private-directory> --resume --live
```

Resume uses the embedded approval, matrix, config, and candidate. It cannot take
new input paths or enlarge the budget. A changed protocol requires a new output
directory. Existing model cohorts are never selected implicitly.

```sh
node scripts/research/collect-rebaseline-scores.mjs \
  --output <completed-private-directory> --replay
```

Replay reads snapshots and receipts only, checks current code hashes against the
frozen code, and feeds recorded completions through the scorer. It verifies exact
prompts, request hashes, call sequence, schema outcome, the full production score
object, and observed collector fields. It writes nothing and has no live fallback.
Only a complete observed matrix can return `fullObservedReplay: true`.

**Outbound payload boundary**

The HTTP body contains the selected model, one user message, and supported scoring
request controls. The message is derived only from the exact approved text and
necessary scoring instructions: weights, severity rules, pack counts, and pattern
catalog. The intake, source index, source URLs, generator/quality labels, previous
prompts or receipts, and full source documents stay in the private snapshot.
Unrelated config fields are not included. Tests intercept the outbound body and
check these boundaries using distinct metadata markers.

If production fencing would alter the approved text, preparation stops. There is
no silent edit or replacement text. Scores do not trigger a replacement run:
only the existing bounded JSON-parse retry is permitted, within the fixed call
budget. The worker has not executed the parent's approved live pass.

**Private evidence**

- `snapshot.private.json`: exact input records and provenance, decisions, fixed
  matrix, candidate protocol bytes, config source bytes and resolved objects,
  language-specific patterns and lexicons, per-text config and full deterministic
  analyses, expected prompts, structural-model policy, bounds, and code hashes.
- `wire/<logical-hash>/<ordinal>.private.json`: a started record written before
  dispatch, with the exact private prompt and credential-free request; then the
  terminal result or bounded error and available transport evidence.
- `calls/<logical-hash>/<ordinal>.private.json`: the existing scorer journal,
  including every returned text and schema-validity outcome.
- `rows/<text-hash>.private.json`: observed collector output and the complete
  production result reconstructed immediately from those same receipts.
- `progress.private.json`: reservations, completed-row hashes, and hashes of each
  evaluation's journal/wire receipt set. `study-protocol.json` binds the snapshot.

Files are mode 0600 inside a private directory, with a local `*` ignore rule.
Tracked output destinations, symlink paths, and changed permissions are rejected.
Credential fields and recognized credential-like strings reject snapshots; they
are not redacted and represented as complete evidence. A rejected response leaves
an unresolved call requiring review. No raw text or provider error body goes to
stdout or a tracked report.

Pinned config is parsed directly, with documented `document-type` normalization
and per-text language/document-type selection. No global or project config is
merged. This bounded collector explicitly freezes structural models as absent;
configured model paths are rejected, and incidental ambient model discovery is
blocked during preparation. Loaded pattern/lexicon objects, including RegExp
source/flags when present, are serialized in the private snapshot.

HTTP/OpenCodex uses one fetch per parser invocation, without redirects, transport
retries, temperature fallback, or provider fallback. Request and response bodies
are retained privately; authorization headers are never serialized. Only the
selected HTTP candidate's configured credential variable is read by the existing
credential helper. There is no environment-file option or credential discovery.
Gemini is restricted to the existing loopback OpenCodex route and cannot request
a Gemini API key.

Native CLI candidates use the existing study transport. Their exact collector
arguments and returned metadata are retained; native upstream request bodies,
server revision, effective effort, and thinking remain unverified when the
transport does not disclose them. The replay claim concerns the finite observed
scorer execution, not an independently reconstructed upstream inference.

**Interruption and reporting**

Every evaluation is reserved before its first call. Completed receipts can recover
a row that failed to persist, entirely offline. Missing, extra, altered, or started
receipts stop resume. A missing parser-retry receipt cannot cause a replacement
paid call during recovery. Persistence failures stop subsequent work. Stale locks
and pending writes require parent review; the collector does not erase them.

Output contains score distributions, language/pack distributions, missing-pack
counts, and separate error classes. Failed observations remain missing values.
Distribution denominators use schema-valid observations; excluded texts remain in
the intake denominator. Classification metrics and human-quality ratings remain
null. No FNR, FPR, AUC, accuracy, winner, threshold, or default change is inferred.

Validation uses synthetic inputs and mocked providers, plus a read-only integrity
check of the 85-record bundle. Tests cover opt-in, approval binding, nullable
labels, bounded parser retries, transport errors, immutable snapshots, offline
replay, receipt loss, persistence failure, secret rejection, and Gemini routing.

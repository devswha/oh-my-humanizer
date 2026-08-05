# patina architecture: the two engine lanes

patina produces every output through one of two methods, and binds them together
with a single rule. This document is the **canonical contract** for which method
governs each surface, which module belongs to which lane, and the invariants each
lane must uphold.

The v7 boundary also defines three independent rewrite axes: Document Type owns
document policy, Persona v2 optionally owns reusable voice, and Register owns
casual/professional delivery. None is inferred from another.
This is field ownership, not three competing full-text styles. Meaning and
safety are the outer invariant; Document Type resolves structure and domain
constraints, Persona resolves idiolect and rhythm, and Register resolves only
casual/professional markers. No active axis supplies a missing axis.


See also: [`CONTRIBUTING.md`](../CONTRIBUTING.md) (the determinism rule —
"Adding a Deterministic Detection Signal"), [`docs/HARNESS.md`](HARNESS.md) (the
measurement/quality **tooling** map — a different axis),
[`docs/GLOSSARY.md`](GLOSSARY.md).

---

## The two methods

### Method D — deterministic (measure with code, never call a model)

Computes its answer from the text with code only: no LLM call, no network, no API
key, fully reproducible. Lives in `src/features/*` and the deterministic
backstops. This is patina's **trust / auditability substrate**, the public,
offline, no-key surface, and the ground truth that the benchmark/CI layer pins.

### Method P — LLM transformation (transform with a model, prove meaning survived)

Produces its answer by prompting an LLM — to rewrite, or to narrate a score /
audit / diff. Document Type, Persona, and Register may independently shape a
rewrite. Method P may change wording but MUST NOT change the underlying claim,
numbers, polarity, or causation.

### The binding rule

> **No Method-P output ships without a Method-D anchor.**

Every LLM-backed surface is reconciled, backstopped, or gated by a deterministic
computation. patina is auditable not because some modes avoid the model, but
because the deterministic substrate (Method D) underwrites everything the model
(Method P) emits.

This is the key correction to the intuitive "audit modes are deterministic,
rewrite is the LLM one" picture: **every CLI mode calls the backend**
(`invokeBackendChain` in `src/cli/run.js`). What differs is the *strength of the
Method-D anchor* under each surface — see [Known seams](#known-seams).

---

## Lane invariants (the contract)

**Lane A (Method D) MUST:**
- stay LLM-free, deterministic, network-free, and key-free. This is the hard rule
  (CONTRIBUTING.md) on `src/features/*` and the deterministic scoring layer.
- only *measure*; it never emits a meaning-changed rewrite.
- not import or depend on Lane B. The dependency direction **A → B is forbidden**.

**Lane B (Method P) MUST:**
- anchor every shipped output to a Method-D computation (reconcile, backstop, or
  gate).
- enforce global meaning preservation independently of every rewrite axis.
  `--verify` owns the configurable MPS/fidelity floors and retry path; no
  Document Type, Persona, or Register may weaken them.
- treat Persona v2 as **voice composition only**. It may shape vocabulary,
  explanation habits, rhythm, and other voice targets, but never document
  policy, register, claims, safety thresholds, or worldview.
- keep its own deterministic assets (`src/features/persona-match.js`,
  `src/verify.js#deterministicMeaningGuard`) auditable and LLM-free even though
  they serve Lane B.
- **never add an LLM call into `src/features/*`** — the determinism rule binds the
  whole analysis layer, not just the modules that happen to live in Lane A today.

**Cross-lane:**
- Lane B MAY consume Lane A measurements. **B → A is allowed and expected**:
  `persona-match` and `buildDocumentSignals` reuse `analyzeText()`.
- The reverse (A → B) is forbidden.

---

## Surface → method → Method-D anchor

Backend-backed modes use Method P; the rightmost column is the Method-D anchor.

| Surface | mode | LLM call? | Method-D anchor |
|---|---|---|---|
| default | `rewrite` | yes | `deterministicMeaningGuard`; optional Persona match/churn advisory; `verify.js` MPS/fidelity + retry only with `--verify` |
| `--audit` | `audit` | yes | `buildDeterministicAuditBackstop` |
| `--score` | `score` | yes | `withDeterministicScore`; optional `--exit-on` gate |
| `--score --offline` | `score` | **no** | deterministic signal score |
| `--diff` | `diff` | yes | deterministic pattern/detection report |
| `--preview [--serve]` | preview job | yes | deterministic prose extraction + word-diff rendering |
| `patina-score` (bin) | — | **no** | hot-paragraph ratio over `analyzeText()` |
| playground / hosted rewrite | — | yes | shared server-side prompt, analysis, and scoring assets |

Notes: Persona is opt-in for rewrite/preview in ko/en/zh/ja. Omission preserves
the source voice. Persona match and churn are advisory; meaning and number
checks remain global. `--serve` is a `--preview` transport option.

---

## Module → lane

### Lane A — deterministic substrate (LLM-free)

- `src/features/index.js` — `analyzeText()`, the engine
- `src/features/stylometry.js`, `translationese.js`, `discourse-tells.js`,
  `markup-leakage.js`, `segment.js`, `structural-features.js`,
  `structural-model-loader.js`, `lexicon.js`, `lexicon-core.js`, `catalog/*`
- `src/output.js#buildDeterministicAuditBackstop`,
  `src/cli/run.js#withDeterministicScore` — audit/score backstops
- `src/cli/score-gate.js` — `--exit-on` score gate
- Pure Method-D *surfaces* over this engine: `patina-score`
  (`scripts/prose-score.mjs`, the CI score gate) and the benchmark / HARNESS
  layer call `analyzeText()` with no model. The browser playground no longer
  ships an offline audit mirror — it was dropped when the playground became
  rewrite-first.

### Lane A asset consumed by Lane B (deterministic, cross-lane)

- `src/features/persona-match.js` — LLM-free persona-match scorer. It lives in
  `features/` **on purpose**, to inherit the determinism guarantee, but it is
  authored for Lane B's optional Persona quality report.

### Lane B — LLM rewrite and optional Persona voice (LLM-backed)

- `src/personas/{schema,loader,compose,gates}.js` — Persona v2 voice schema,
  loader, localized prompt directive, and advisory voice-quality evaluation;
  `personas/{ko,en,zh,ja}/*.md` — built-in Personas;
  `custom/personas/{lang}/*.md` — user-authored Personas
- `src/commands/persona.js` — `patina persona new|list|show|edit|rm`
- `src/prompt-builder.js` — rewrite/score/audit/diff prompt construction
- `src/scoring.js` — LLM MPS/fidelity scoring (excluded from the deterministic
  benchmark/gate layer)
- `src/verify.js` — post-rewrite meaning verification + one strict retry
  (`deterministicMeaningGuard` is its LLM-free part)
- `src/web-rewrite.js`, `web-rewrite-contract.js`, `web-rewrite-stream.js`,
  `rewrite-handler.js`, `streaming-api.js` — web / hosted rewrite path
- `src/web-config.js`, `web-observability.js`, `rate-limit.js`, `security.js` —
  web rewrite serving infrastructure
- `src/preview/*`, `preview.js`, `browser-diff.js` — `--preview` page presentation
  over rewrite output (deterministic rendering; optional LLM diff narration)

### Shared infrastructure (lane-neutral)

- `src/cli.js`, `cli/args.js`, `cli/run.js` (dispatcher), `cli/input.js`, `cli/batch.js`
- `src/config.js`, `errors.js`, `logger.js`, `loader.js`, `model-defaults.js`, `output.js`
- `src/api.js`, `providers.js`, `backends/*` — LLM transport (used only by Lane B,
  kept as shared transport)
- `src/auth.js`, `commands/auth.js`, `commands/doctor.js`
- `src/ocr.js` — image → text input extraction
- `scoring`, `verification`, and `personas.thresholds` are separate
  configuration namespaces. Persona thresholds cover advisory voice quality;
  verification owns MPS/fidelity floors.

### Packaged research comparator (unsupported)

- `scripts/iterative-rewrite-baseline.mjs` — `iterative-baseline`, a packaged
  research comparator outside the product API, CLI help, and configuration surface. The package has no `exports` map, so the module remains deep-importable but unsupported.
---

## Seams: resolved and remaining

### Resolved axis ownership

1. **Document Type owns document policy.** `document-types/*.md` supplies genre,
   purpose, structural conventions, and `pattern-overrides`; it contributes no
   voice or Register instruction.
2. **Persona v2 owns reusable voice only.** Persona is optional in every
   supported language. Its schema rejects Document Type, Register, pattern
   policy, verification, meaning floors, and rewrite-depth fields.
3. **Register owns delivery only.** `--register` and `register:` accept exactly
   `casual` or `professional`. Omission preserves the source register.
4. **Safety is global.** The deterministic meaning guard applies regardless of
   axis selection; `--verify` owns MPS/fidelity floors and one conservative
   retry. Persona match and surface churn remain advisory.
5. **The v7 cutover is explicit.** `profile`, `tone`, and `formality` inputs
   fail with migration errors rather than aliases or silent fallback.

### Remaining

- **`persona new` / `persona edit` LLM drafts are non-deterministic.** Authoring uses a one-time
  model call; the saved persona file is deterministic, but two authoring runs on
  the same input can differ. Validation (`validatePersona`) is the safety net.

---

## Provenance

- Two-mode coexistence (LLM rewrite + offline deterministic audit):
  deep-interview playground spec, R6.
- Persona harness safety invariants: deep-interview persona spec + ralplan
  consensus (recorded in the `src/personas/schema.js` header).
- Hosted open-core enhancement (baseline open + enhanced assets server-side):
  deep-interview open-core spec.

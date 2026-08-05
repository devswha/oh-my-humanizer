# Cursor Rules for Patina

## Project Identity

Patina is a **Claude Code skill** that detects and removes AI writing patterns from Korean, English, Chinese, and Japanese text. It rewrites AI-sounding text into natural, human-like prose while preserving meaning through the Meaning Preservation System (MPS).

The project uses a **plugin architecture**: pattern packs (`patterns/{lang}-*.md`), Document Type policies (`document-types/*.md`), and optional Persona v2 voice definitions (`personas/<lang>/*.md`).

## File Structure Conventions

- **Pattern packs**: `patterns/{lang}-{category}.md` (e.g., `en-content.md`, `ko-language.md`)
  - Must have valid YAML frontmatter: `pack`, `language`, `name`, `version`, `patterns`
  - Pattern definitions use `### N. Pattern Name` headings
- **Document Types**: `document-types/{name}.md` — genre, structure, and `pattern-overrides`
- **Personas**: `personas/{lang}/{name}.md` — optional voice-only Persona v2 frontmatter
- **Core definitions**: `core/voice.md`, `core/scoring.md`
- **Examples**: `examples/{number}-success-01.md`, `{number}-failure-01.md`
  - English examples: `examples/en-{number}-success-01.md`
- **Entry point**: `SKILL.md`
- **Config**: `.patina.default.yaml` — source of truth for defaults

## When Adding a New Pattern

1. Pick the correct pack in `patterns/{lang}-{category}.md`
2. Use the exact template:
   ```markdown
   ### N. Pattern Name
   **Watch words:** ...
   **Fire condition:** ...
   **Exclusion:** ...
   **Semantic Risk:** HIGH|MEDIUM|LOW
   **Problem:** ...
   **Before:** > ...
   **After:** > ...
   ```
3. Update the pack's frontmatter `patterns:` count
4. Add to **all 4 languages** if universal. Document if language-specific.
5. Add example files: `examples/{lang}-{number}-success-01.md` and `{lang}-{number}-failure-01.md`
6. Update `README.md` pattern tables
7. Bump the pack's `version:` frontmatter

## When Adding a Document Type

1. Copy `document-types/default.md` as a template.
2. Set `document-type:` to the filename stem.
3. Define `purpose`, `audience`, `structure`, `style`, `avoid`, and
   language-scoped `pattern-overrides` in frontmatter.
4. Keep Persona voice, Register, and verification fields out of the policy.
5. Add a matching key under `.patina.default.yaml`
   `scoring.combined-weights.document-type` only when scoring evidence justifies
   a non-default balance.

Create reusable voice through Persona v2 (`patina persona new`). Persona schema
validation rejects Document Type, Register, pattern-policy, and safety fields.

## When Modifying SKILL.md

- The **3-Phase pipeline** (5a structure → 5b sentence/lexical → 5c self-audit) is sacred. Do not change without explicit request.
- Anchor verification logic must stay in sync with `core/scoring.md`
- CLI flag parsing (`$ARGUMENTS`) must stay in sync with `.patina.default.yaml` options

## When Modifying core/scoring.md

- The scoring formula is canonical — any behavioral change must also update `SKILL.md` §6 (score mode)
- Severity rubric, category weights, and MPS formula are referenced by the skill and CLI surfaces

## Version Management

- `package.json` `version` is the **source of truth**
- `SKILL.md`, `.patina.default.yaml`, and `README.md` must match it
- Pattern pack and Document Type versions are independent

## Language Synchronization Rule

All 4 languages (ko, en, zh, ja) currently maintain **46 patterns each** (184 total). When adding a universal pattern:
- Same pattern number across all 4 languages
- Same semantic category
- Language-specific watch words and examples

If a pattern is language-specific, document it clearly in the pack's intro text and keep the numbering gap consistent.

## Testing Requirements

- Every new pattern needs at least one `success` example and one `failure` example
- Examples must preserve original meaning — the "after" text should convey the same takeaway as the "before"
- E2E examples in `examples/e2e/` show full pipeline outputs and should be updated when pipeline behavior changes
- Before/after examples in `examples/` serve as the project's test suite
- **Assume an LLM backend is available by default** when testing, benchmarking, or advancing patina (a logged-in local `claude`/`codex`/`gemini` CLI or an API key); exercise the LLM-backed `rewrite`/`audit`/`score` and `tests/quality/` live-quality paths too — do not limit verification to the no-key deterministic subset. The determinism rule still holds: `src/features/*` stays LLM-free. See `AGENTS.md`.

## Output Modes

The skill supports these modes (defined in `.patina.default.yaml`):
- `rewrite` — default; humanizes text
- `diff` — shows what changed and why
- `audit` — detects patterns only
- `score` — AI-likeness score 0-100
- `strict` — skill-only multi-pass verification flow (`/patina --strict`), not a runtime output mode

## Important Constraints

- Do NOT suppress type errors with `as any`, `@ts-ignore`, or `@ts-expect-error`
- Do NOT delete failing tests to make the build pass
- Do NOT commit unless explicitly requested
- Do NOT change the core pipeline unless explicitly requested
- Keep pattern packs auto-discoverable via `patterns/{lang}-*.md` glob
- Do NOT break YAML frontmatter format in pattern packs

## References

- `SKILL.md` — full pipeline specification
- `core/scoring.md` — complete scoring algorithm
- `AGENTS.md` — multi-agent usage guide
- `core/standalone-prompt.md` — agent-agnostic prompt template

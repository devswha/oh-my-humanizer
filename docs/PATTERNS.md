# Pattern Catalog

Patina ships 184 pattern entries across four languages. The language-specific references below expand each pack with pattern numbers, names, watch words, fire conditions, source links, and examples.

| Language | Reference | Rewrite-capable patterns | Score/audit-only viral-hook patterns |
|----------|-----------|--------------------------|--------------------------------------|
| Korean | [PATTERNS-KO.md](PATTERNS-KO.md) | 37 | 9 |
| English | [PATTERNS-EN.md](PATTERNS-EN.md) | 37 | 9 |
| Chinese | [PATTERNS-ZH.md](PATTERNS-ZH.md) | 37 | 9 |
| Japanese | [PATTERNS-JA.md](PATTERNS-JA.md) | 37 | 9 |

## Notes

- Rewrite-capable patterns are applied by the rewrite modes (default rewrite, `--verify`, and the skill-only `/patina --strict` multi-pass flow) and `--diff`, according to their pack metadata and runtime mode.
- Viral-hook patterns are score/audit-only SNS-marketing signals. They affect `--score` and `--audit`, but rewrite modes skip them because the rhetoric may be intentional.
- Pattern packs are auto-discovered from `patterns/{lang}-*.md`. To add a language or custom pack, follow [CONTRIBUTING.md](../CONTRIBUTING.md) and the frontmatter format used in the existing packs.

## Community Packs

Community packs add prompt patterns through a separate unsigned GitHub distribution
path. They do not require a Pro license. `patina pack` remains the licensed Pro
pack command.

```bash
patina pattern install en-corporate-bizspeak
patina pattern list
patina pattern remove en-corporate-bizspeak
```

Short names resolve under `devswha/patina-community-packs`, in `packs/<name>`.
You can also pass `https://github.com/OWNER/REPO/tree/REF/DIRECTORY`. Use a tag,
commit, or branch without slashes. The installer resolves it to a full commit
before reading `pack.yaml` and every pattern file. Downloads use public HTTPS
without credentials; redirects, scripts and archive extraction are unsupported.

The manifest requires these fields:

```yaml
name: en-corporate-bizspeak
version: 1.0.0
language: en
patterns:
  - en-community-corporate-bizspeak.md
compatibility:
  min: 8.2.0
  maxExclusive: 9.0.0
author: devswha
license: MIT
```

Pattern files use `LANG-community-NAME.md` and the regular pattern frontmatter:
`pack` matching the filename stem, `language`, `version`, positive `patterns`
count, and optional `phase` or `score_only`. Include fire conditions, exclusions,
meaning-preservation notes, and before/after examples in each pattern's body.

Installation publishes a complete pack directory into this CLI installation's
`custom/community-packs/`. It never replaces built-in, Pro or hand-written
custom patterns. Remove an unchanged installation before installing a newer
version. Locally edited or unrecognized files block loading/removal so they can
be preserved. A CLI reinstall can replace its installation directory; keep your
source packs separately. `list` and `remove` work offline; `--json` is available
on all three commands.

Installed patterns participate in prompt-based rewriting and audit/scoring.
They do not add deterministic detector features. The Node loader reads the
managed directory; the agent skill's orchestration is unchanged. Packs are
unsigned instructions from their authors, so install only sources you trust.
Stored hashes detect later local changes, not malicious authorship.

## Supporting References

- [Scoring](../core/scoring.md) — category weights, AI-likeness score, fidelity, and MPS
- [Stylometry](../core/stylometry.md) — burstiness, MATTR, and AI-lexicon overlap
- [Examples](../examples/README.md) — standalone failure/success fixtures used by the pattern docs

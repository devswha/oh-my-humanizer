# CLI / Skill Flag Parity

Basis: local checkout plus `node bin/patina.js --help` and `SKILL.md` reviewed on 2026-07-31. This table separates the standalone CLI surface from the prompt-based `/patina` skill; a missing check is not always a bug when the flag is backend-, auth-, or CLI-automation-only.

| Flag / command | Standalone CLI | `/patina` (`SKILL.md`) | Notes |
|---|:---:|:---:|---|
| *(default rewrite)* | ✓ | ✓ | Both rewrite one candidate. |
| `--diff` | ✓ | ✓ | Single-candidate pattern-by-pattern diff. |
| `--audit` | ✓ | ✓ | Detection-only mode. |
| `--score` | ✓ | ✓ | Score mode is available on both surfaces. |
| `--exit-on <n>` | ✓ | — | CLI score-gate spelling for CI. |
| `--offline` | ✓ | — | With `--score`, runs deterministic signals only and resolves no backend or credential. |
| `--verify` | ✓ | — | Node CLI rewrite + MPS/fidelity meaning-floor check with one retry. |
| `--strict` | — | ✓ | Agent-skill-only strict rewrite flow. |
| `--format <markdown\|text\|json>` | ✓ | — | CLI output-envelope feature. |
| `--quiet` | ✓ | — | CLI stderr log suppression for scripts. |
| `--batch` | ✓ | ✓ | Multi-file CLI/skill rewrite flow. |
| `--in-place` | ✓ | ✓ | Batch-only write mode. |
| `--suffix <ext>` | ✓ | ✓ | Batch-only alternate output naming. |
| `--outdir <dir>` | ✓ | ✓ | Batch-only output directory. |
| `--no-interactive` | ✓ | — | CLI input safety for non-TTY automation. |
| `--lang <code>` | ✓ | ✓ | `ko`, `en`, `zh`, `ja`. |
| `--document-type <name>` | ✓ | ✓ | Genre, purpose, structural conventions, and pattern policy. |
| `--persona <name>` | ✓ | ✓ | Optional reusable voice; rewrite/preview only in CLI. |
| `--register <casual\|professional>` | ✓ | ✓ | Delivery override; omission preserves source register. |
| `--jargon <policy>` | ✓ | — | CLI rewrite/preview terminology policy. |
| `--preview` | ✓ | — | CLI URL/local-HTML in-place preview. |
| `--model <id>` | ✓ | — | CLI single-backend model selection. |
| `--api-key-file <path>` | ✓ | — | CLI auth. |
| `--base-url <url>` | ✓ | — | CLI provider/backend config. |
| `--backend <name[,name]>` | ✓ | — | CLI backend selection and explicit fallback chains (`openai-http`, `codex-cli`, `claude-cli`, `gemini-cli`, `kimi-cli`). |
| `--list-backends` | ✓ | — | CLI diagnostics with selectors and auth state. |
| `--provider <name>` | ✓ | — | CLI provider preset. |
| `--config <path>` | ✓ | — | CLI config override. |
| `--allow-insecure-base-url` | ✓ | — | CLI network safety override. |
| `--allow-private-base-url` | ✓ | — | CLI SSRF/metadata-address safety override. |
| `-h`, `--help` | ✓ | — | CLI help. |
| `-v`, `--version` | ✓ | — | CLI version. |
| `patina doctor` | ✓ | — | CLI environment diagnostic. |
| `patina auth status/login` | ✓ | — | CLI authentication guidance. |
| `patina persona new/list/show/edit/rm` | ✓ | — | CLI custom Persona lifecycle. |

## Audit notes

- Auth/provider/base-url flags and `doctor`/`auth` commands are CLI automation or transport controls; they do not map cleanly to prompt-only skills.

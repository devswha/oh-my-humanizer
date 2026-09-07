# Public examples audit — 2026-09-07

The audit covers current paired examples, detection snippets and explanation text in the four language packs, standalone examples, public galleries, README demonstrations and their mirrors. Counts below are review units, not unique inputs; duplicate public appearances and explanatory/control cases are counted separately. Historical research outputs and benchmark inputs were preserved.

| Language | Files reviewed | Review units |
|---|---:|---:|
| ko | 103 | 233 |
| en | 89 | 217 |
| zh | 86 | 201 |
| ja | 86 | 197 |

The language ledgers contain 848 review units across 364 scoped files. Shared voice/skill illustrations and generated demo/share assets were checked separately. The ledger review was performed by models, not a human panel.

## Verification boundaries

The canonical test, lint, release metadata, private-asset and dogfood gates remain in force. Whole-file style diagnostics on labeled AI inputs and short snippets are reported separately in the language ledgers; they are not evidence that meaning was preserved, and intentionally bad source examples were not changed to lower their scores. Some source instructions still have documented limits when actor, context or evidence is missing.

The [public paired-check report](../benchmarks/public-examples-20260907.md) records twelve authored showcases at MPS 100 and fidelity 100. Six shared illustrations passed MPS 100 and fidelity 91.7–100. These fixed-pair ratings do not measure general rewrite quality or reader preference.

## Deliverables

- Current native examples: `playground/examples/{ko,en,zh,ja}.js`, three per language.
- Shared gallery: [docs/DEMO.md](../DEMO.md).
- Introduction drafts: [multilingual-examples.md](../social/multilingual-examples.md).
- Four SVG cards plus the English compatibility filename: `assets/social/patina-before-after-*.svg`.
- Bounded page milestones and prepared campaign links: [funnel runbook](multilingual-funnel-20260907.md).

No external introduction post was published. Same-page reuse is measured without a persistent identifier; returning-user retention and GitHub star conversion remain unknown. The npm publication hold is unchanged.

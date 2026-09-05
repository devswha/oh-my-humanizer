# Editor clients

Patina has desktop clients for VS Code and Obsidian, plus a Gmail browser
extension preview. Scores are writing hints, not authorship probabilities.

| Client | Install | Requirements | Availability |
|---|---|---|---|
| [VS Code](https://github.com/devswha/patina-vscode) | Download the VSIX from Releases; run **Extensions: Install from VSIX** | VS Code 1.85+, Node.js/npm, Patina CLI 8.3+ for sentence and audit diagnostics | VSIX installation; no Marketplace listing claimed |
| [Obsidian](https://github.com/devswha/patina-obsidian) | Copy release files into the vault plugin directory | Obsidian 1.13.7+, desktop vault, Node.js/npm, Patina CLI 8.2+ | Manual installation; directory review is separate |
| [Gmail preview](https://github.com/devswha/patina-extension) | Unzip the preview release and load the directory in Chrome developer mode | Desktop Chrome with Manifest V3 support | Preview; no Chrome Web Store listing or signed-in Gmail validation claimed |
| [Aside CLI integration](aside.md) | Load the bundled skill through Aside's custom-skill creator; open `patina aside options` | Node.js 18.1+, a configured rewrite backend, Aside command/workspace permissions | Integration preview; native Aside desktop validation is separate |

## VS Code

Download `patina-vscode-1.1.0.vsix` from the client repository's release page.
After installing it, open a trusted workspace and run **Patina: Install or
Update CLI**. The default CLI path is `npx patina-cli`. You can also point
`patina.cliPath` to an installed executable or a checkout's `bin/patina.js`.

The status bar shows the current document's local score. Editing triggers a
debounced offline inspection. Sentence hints mark lexical evidence; findings
that cannot be localized remain on the paragraph or document. **Patina: Audit
Current Document** opens a report and updates diagnostics if the source has not
changed. **Patina: Humanize Selection** runs verification, opens a diff and asks
whether to apply it. A changed document cannot be overwritten by a stale result.

Configure `patina.language`, `patina.backend`, `patina.scoreThreshold` and
`patina.autoScore` in Settings. Audits and rewrites use the CLI's configured
backend and can send text to that provider. The extension stores no provider
key. Background inspection uses npm's offline resolution; only the explicit
installation command downloads a CLI package.

## Obsidian

Create `.obsidian/plugins/patina-humanizer/` inside the vault. Copy `main.js`,
`manifest.json` and `styles.css` from the same release into that directory.
Restart Obsidian and enable **Patina Humanizer** in Community plugins.

Run **Patina Humanizer: Install or update CLI**, then use **Score current note**,
**Audit current note** or **Humanize selection** from the command palette.
Settings control language, backend, CLI path, automatic scoring and threshold.
Scoring runs locally. Explicit audits and rewrites can send text through the
CLI's configured backend. A rewrite requires preview confirmation and refuses
to overwrite an edited or closed note. The plugin is desktop-only.

## Gmail preview

Download and unzip `patina-extension-preview.zip` from the preview release.
Open Chrome's extensions page, enable developer mode, choose **Load unpacked**
and select the extracted directory containing `manifest.json`. Reload Gmail.

The preview places a local score beside supported compose editors and offers
selection inspection in the popup. It bundles the shared deterministic core;
it needs no CLI or provider key for scoring. Only settings are stored. Text is
not sent over the network by the extension. Explicit humanization provides a
CLI handoff, which the user runs separately.

The preview has passed isolated browser-fixture checks for typing, programmatic
updates, multiple compose editors, settings and selection. Real signed-in Gmail
testing remains pending. Notion and LinkedIn are outside this preview.

For the machine-readable CLI contract, see [editor inspection](editor-inspection.md).

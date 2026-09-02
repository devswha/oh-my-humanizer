#!/usr/bin/env node
// Roadmap step 1 (measure-only): build the hash-only KO GPT-family miss-review
// manifest from the frozen scored manifest plus the ignored private corpus.
// Raw text is read locally, analysed with the fixed analyzer, and never written.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_EXCLUSIONS_OUTPUT,
  DEFAULT_OUTPUT,
  DEFAULT_PRIVATE_CORPUS,
  DEFAULT_SOURCE_MANIFEST,
  REPO_ROOT,
  extractMissReview,
  toRepoRelative,
  writeJsonlString,
} from './ko-miss-review-lib.mjs';

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    sourceManifest: DEFAULT_SOURCE_MANIFEST,
    privateCorpus: DEFAULT_PRIVATE_CORPUS,
    output: DEFAULT_OUTPUT,
    exclusionsOutput: DEFAULT_EXCLUSIONS_OUTPUT,
    analyzedAt: null,
    onDrift: 'fail',
    dryRun: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--source-manifest') args.sourceManifest = argv[++i];
    else if (arg === '--private-corpus') args.privateCorpus = argv[++i];
    else if (arg === '--output') args.output = argv[++i];
    else if (arg === '--exclusions-output') args.exclusionsOutput = argv[++i];
    else if (arg === '--analyzed-at') args.analyzedAt = argv[++i];
    else if (arg === '--on-drift') {
      const value = argv[++i];
      if (value !== 'fail' && value !== 'exclude') throw new Error('--on-drift must be fail or exclude');
      args.onDrift = value;
    } else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.analyzedAt && Number.isNaN(Date.parse(args.analyzedAt))) throw new Error('--analyzed-at must be an ISO timestamp');
  return args;
}

export function writeOutputs(result, options = {}) {
  if (result.errors.length) throw new Error('refusing to write an invalid miss-review manifest');
  const repoRoot = options.repoRoot || REPO_ROOT;
  const outputPath = resolve(repoRoot, options.output || DEFAULT_OUTPUT);
  const exclusionsPath = resolve(repoRoot, options.exclusionsOutput || DEFAULT_EXCLUSIONS_OUTPUT);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, writeJsonlString(result.rows));
  let exclusionsWritten = null;
  if (result.exclusions.length) {
    mkdirSync(dirname(exclusionsPath), { recursive: true });
    writeFileSync(exclusionsPath, writeJsonlString(result.exclusions));
    exclusionsWritten = toRepoRelative(exclusionsPath, repoRoot);
  }
  return { output: toRepoRelative(outputPath, repoRoot), exclusions: exclusionsWritten };
}

export function renderSummary(result, written = null) {
  const lines = ['# KO GPT-family miss-review extraction', ''];
  if (result.population) {
    lines.push(
      `- Source manifest: \`${result.population.source_manifest}\` (${result.population.source_manifest_hash})`,
      `- Population candidates: ${result.population.candidates}`,
      `- Selected (still a miss under the current analyzer): ${result.population.selected}`,
      `- Excluded (precondition violated): ${result.population.excluded}`
    );
  }
  if (result.provenance) {
    lines.push(
      `- Analyzer commit: ${result.provenance.git_commit ?? 'unknown'} (src/features tree ${result.provenance.features_tree ?? 'unknown'})`,
      `- Options hash: ${result.provenance.options_hash}`,
      `- Lexicon: ${result.provenance.lexicon_version ?? 'unversioned'} ${result.provenance.lexicon_hash}`
    );
  }
  const reasons = {};
  for (const row of result.rows) reasons[row.computed_reason] = (reasons[row.computed_reason] ?? 0) + 1;
  if (result.rows.length) {
    lines.push('', '## Computed reasons', '', '| miss_reason | n |', '|---|---:|');
    for (const [code, n] of Object.entries(reasons).sort()) lines.push(`| ${code} | ${n} |`);
  }
  lines.push('', `- Validation: **${result.errors.length ? 'FAIL' : 'PASS'}**`);
  if (written) {
    lines.push(`- Output: \`${written.output}\``);
    lines.push(`- Exclusions: ${written.exclusions ? `\`${written.exclusions}\`` : 'none written'}`);
  }
  if (result.errors.length) lines.push('', '## Errors', ...result.errors.map((error) => `- ${error}`));
  if (result.warnings.length) lines.push('', '## Warnings', ...result.warnings.map((warning) => `- ${warning}`));
  return `${lines.join('\n')}\n`;
}

function printHelp() {
  console.log(`Usage: node scripts/ko-miss-review-extract.mjs [--source-manifest <scored.jsonl>] [--private-corpus <private.jsonl>]
       [--output <manifest.jsonl>] [--exclusions-output <exclusions.jsonl>] [--analyzed-at <iso>]
       [--on-drift fail|exclude] [--dry-run] [--json]

Selects language=ko, class=ai-like, model_family=gpt-family, expected_hot=true,
predicted_hot=false rows from the frozen scored manifest, re-analyses their
private text with the fixed deterministic analyzer, and writes hash-only rows
with the source-free signal projection, per-family gate deficits and the
computed miss_reason. Rows the current analyzer now flags hot violate the
review precondition: the default is to fail; --on-drift exclude records them
in the exclusions file instead. Requires the ignored private corpus.
Default source: ${DEFAULT_SOURCE_MANIFEST}
Default corpus: ${DEFAULT_PRIVATE_CORPUS}
Default output: ${DEFAULT_OUTPUT}`);
}

function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }
  const result = extractMissReview({
    sourceManifest: args.sourceManifest,
    privateCorpus: args.privateCorpus,
    analyzedAt: args.analyzedAt,
    onDrift: args.onDrift,
  });
  const written = !args.dryRun && result.errors.length === 0
    ? writeOutputs(result, { output: args.output, exclusionsOutput: args.exclusionsOutput })
    : null;
  if (args.json) {
    const { rows: _rows, exclusions: _exclusions, ...rest } = result;
    console.log(JSON.stringify({ ...rest, written }, null, 2));
  } else {
    console.log(renderSummary(result, written));
  }
  if (result.errors.length) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

#!/usr/bin/env node
// Validate the KO GPT-family miss-review manifest against its contract:
// schema, precondition triple, hash/provenance binding, population binding to
// the frozen scored manifest, no raw text, and (when the private corpus is
// present) byte-identical regeneration plus a substring leak check.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_EXCLUSIONS_OUTPUT,
  DEFAULT_OUTPUT,
  DEFAULT_PRIVATE_CORPUS,
  DEFAULT_SOURCE_MANIFEST,
  REPO_ROOT,
  readJsonl,
  validateMissReview,
} from './ko-miss-review-lib.mjs';

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    input: DEFAULT_OUTPUT,
    exclusions: DEFAULT_EXCLUSIONS_OUTPUT,
    sourceManifest: DEFAULT_SOURCE_MANIFEST,
    privateCorpus: DEFAULT_PRIVATE_CORPUS,
    requireReview: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input') args.input = argv[++i];
    else if (arg === '--exclusions') args.exclusions = argv[++i];
    else if (arg === '--source-manifest') args.sourceManifest = argv[++i];
    else if (arg === '--private-corpus') args.privateCorpus = argv[++i];
    else if (arg === '--no-source-manifest') args.sourceManifest = null;
    else if (arg === '--require-review') args.requireReview = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

export function runValidation(args, repoRoot = REPO_ROOT) {
  const rows = readJsonl(args.input, repoRoot).rows;
  const exclusionsPath = args.exclusions ? resolve(repoRoot, args.exclusions) : null;
  const exclusions = exclusionsPath && existsSync(exclusionsPath) ? readJsonl(args.exclusions, repoRoot).rows : [];
  return validateMissReview({
    rows,
    exclusions,
    requireReview: args.requireReview,
    sourceManifest: args.sourceManifest,
    privateCorpus: args.privateCorpus,
    repoRoot,
  });
}

export function renderValidation(result, args) {
  const lines = [
    '# KO GPT-family miss-review validation',
    '',
    `- Input: \`${args.input}\``,
    `- Rows: ${result.counts.rows} (reviewed ${result.counts.reviewed}), exclusions: ${result.counts.exclusions}`,
  ];
  if (result.population) lines.push(`- Population: ${result.population.candidates} candidates = ${result.population.selected} selected + ${result.population.excluded} excluded (${result.population.source_manifest_hash})`);
  if (result.regeneration) lines.push(`- Regeneration: ${result.regeneration.identical}/${result.regeneration.checked} rows byte-identical`);
  lines.push(`- Validation: **${result.errors.length ? 'FAIL' : 'PASS'}**`);
  if (result.errors.length) lines.push('', '## Errors', ...result.errors.map((error) => `- ${error}`));
  if (result.warnings.length) lines.push('', '## Warnings', ...result.warnings.map((warning) => `- ${warning}`));
  return `${lines.join('\n')}\n`;
}

function printHelp() {
  console.log(`Usage: node scripts/ko-miss-review-validate.mjs [--input <manifest.jsonl>] [--exclusions <exclusions.jsonl>]
       [--source-manifest <scored.jsonl> | --no-source-manifest] [--private-corpus <private.jsonl>]
       [--require-review] [--json]

Exit 1 on any contract violation. --require-review also fails unreviewed rows.
Regeneration and leak checks run only when the private corpus exists locally.`);
}

function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }
  const result = runValidation(args);
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else console.log(renderValidation(result, args));
  if (result.errors.length) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

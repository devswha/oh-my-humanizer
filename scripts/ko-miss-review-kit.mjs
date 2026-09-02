#!/usr/bin/env node
// Blinded review kit for the KO GPT-family miss-review manifest.
//
//   blind      write a per-reviewer sheet: permuted order, blind ids, signal
//              projection, gate settings and margins only (no sample ids,
//              register, provider/model, scores, hashes or computed reason)
//   adjudicate write a third-reviewer sheet holding only the disagreement rows
//   merge      join reviewer sheets (+ adjudication) back into the manifest,
//              record both labels, disagreement flags and the final reason
//
// Sheets are JSONL: one header line, then one row per blind id.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_OUTPUT,
  MISS_REASONS,
  REPO_ROOT,
  SHEET_SCHEMA,
  blindOrder,
  buildBlindSheet,
  mergeReviews,
  parseSheet,
  readJsonl,
  toRepoRelative,
  writeJsonlString,
} from './ko-miss-review-lib.mjs';

export const DEFAULT_SHEET_DIR = 'artifacts/rebaseline-2025/private/ko-gpt-miss-review';

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    command: argv[0] && !argv[0].startsWith('-') ? argv[0] : null,
    input: DEFAULT_OUTPUT,
    output: null,
    reviewer: null,
    sheets: [],
    adjudication: null,
    adjudicator: null,
    reviewedAt: null,
    json: false,
    help: false,
  };
  for (let i = args.command ? 1 : 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input') args.input = argv[++i];
    else if (arg === '--output') args.output = argv[++i];
    else if (arg === '--reviewer') args.reviewer = argv[++i];
    else if (arg === '--sheet') args.sheets.push(argv[++i]);
    else if (arg === '--adjudication') args.adjudication = argv[++i];
    else if (arg === '--adjudicator') args.adjudicator = argv[++i];
    else if (arg === '--reviewed-at') args.reviewedAt = argv[++i];
    else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function loadSheet(path, repoRoot) {
  return parseSheet(readJsonl(path, repoRoot).rows);
}

export function runBlind(args, repoRoot = REPO_ROOT) {
  if (!args.reviewer) throw new Error('blind requires --reviewer <pseudonym>');
  const rows = readJsonl(args.input, repoRoot).rows;
  const sheet = buildBlindSheet(rows, args.reviewer);
  const output = resolve(repoRoot, args.output || `${DEFAULT_SHEET_DIR}/review-${args.reviewer}.jsonl`);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, writeJsonlString([sheet.header, ...sheet.rows]));
  return { output: toRepoRelative(output, repoRoot), rows: sheet.rows.length, reviewer: args.reviewer };
}

export function runAdjudicate(args, repoRoot = REPO_ROOT) {
  if (!args.adjudicator) throw new Error('adjudicate requires --adjudicator <pseudonym>');
  if (args.sheets.length < 2) throw new Error('adjudicate requires at least two --sheet files');
  const rows = readJsonl(args.input, repoRoot).rows;
  const sheets = args.sheets.map((path) => loadSheet(path, repoRoot));
  const labelsById = new Map();
  for (const sheet of sheets) {
    const mapping = new Map(blindOrder(rows, sheet.header.reviewer).map((entry) => [entry.blind_id, entry.row.sample_id]));
    for (const entry of sheet.rows) {
      const sampleId = mapping.get(entry.blind_id);
      if (!sampleId) throw new Error(`sheet ${sheet.header.reviewer}: unknown blind_id ${entry.blind_id}`);
      if (!labelsById.has(sampleId)) labelsById.set(sampleId, []);
      labelsById.get(sampleId).push({ reviewer: sheet.header.reviewer, miss_reason: entry.miss_reason, reviewer_notes: entry.reviewer_notes ?? null });
    }
  }
  const byId = new Map(rows.map((row) => [row.sample_id, row]));
  const disputed = [];
  for (const [sampleId, labels] of labelsById) {
    const row = byId.get(sampleId);
    const distinct = new Set(labels.map((entry) => entry.miss_reason));
    const disagreement = distinct.size > 1 || labels.some((entry) => entry.miss_reason !== row.computed_reason);
    if (disagreement) disputed.push(row);
  }
  const sheet = buildBlindSheet(disputed, args.adjudicator);
  const labelsByRow = new Map(disputed.map((row) => [row.sample_id, labelsById.get(row.sample_id)]));
  const mapping = new Map(blindOrder(disputed, args.adjudicator).map((entry) => [entry.blind_id, entry.row.sample_id]));
  const sheetRows = sheet.rows.map((entry) => ({
    blind_id: entry.blind_id,
    signals: entry.signals,
    margins: entry.margins,
    labels: labelsByRow.get(mapping.get(entry.blind_id)),
    final_reason: null,
    rationale: null,
  }));
  const header = { ...sheet.header, sheet_kind: 'adjudication', disputed: disputed.length, instructions: 'Set final_reason per row by the decision tree from the margins block and write a short rationale; the two original labels are shown for context only.' };
  const output = resolve(repoRoot, args.output || `${DEFAULT_SHEET_DIR}/adjudication-${args.adjudicator}.jsonl`);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, writeJsonlString([header, ...sheetRows]));
  return { output: toRepoRelative(output, repoRoot), disputed: disputed.length, adjudicator: args.adjudicator };
}

export function runMerge(args, repoRoot = REPO_ROOT) {
  if (args.sheets.length < 2) throw new Error('merge requires at least two --sheet files');
  const rows = readJsonl(args.input, repoRoot).rows;
  const sheets = args.sheets.map((path) => loadSheet(path, repoRoot));
  for (const sheet of sheets) {
    if (sheet.header.sheet_schema !== SHEET_SCHEMA) throw new Error('unexpected sheet schema');
    if (args.reviewedAt && !sheet.header.reviewed_at) sheet.header.reviewed_at = args.reviewedAt;
  }
  let adjudication = null;
  let adjudicator = args.adjudicator;
  if (args.adjudication) {
    const adjPath = resolve(repoRoot, args.adjudication);
    if (!existsSync(adjPath)) throw new Error(`adjudication sheet not found: ${args.adjudication}`);
    adjudication = parseSheet(readJsonl(args.adjudication, repoRoot).rows);
    adjudicator = adjudicator || adjudication.header.reviewer;
    for (const entry of adjudication.rows) {
      if (!entry.reviewed_at && (adjudication.header.reviewed_at || args.reviewedAt)) entry.reviewed_at = adjudication.header.reviewed_at || args.reviewedAt;
    }
  }
  const merged = mergeReviews(rows, sheets, adjudication, adjudicator);
  const output = resolve(repoRoot, args.output || args.input);
  if (merged.errors.length === 0 && merged.unresolved.length === 0) {
    writeFileSync(output, writeJsonlString(merged.rows));
  }
  return {
    output: toRepoRelative(output, repoRoot),
    written: merged.errors.length === 0 && merged.unresolved.length === 0,
    errors: merged.errors,
    unresolved: merged.unresolved,
    agreement: merged.agreement,
    confusion: merged.confusion,
    codes: MISS_REASONS,
  };
}

function printHelp() {
  console.log(`Usage:
  node scripts/ko-miss-review-kit.mjs blind --reviewer <slug> [--input <manifest>] [--output <sheet.jsonl>]
  node scripts/ko-miss-review-kit.mjs adjudicate --adjudicator <slug> --sheet <a.jsonl> --sheet <b.jsonl> [--input <manifest>] [--output <sheet.jsonl>]
  node scripts/ko-miss-review-kit.mjs merge --sheet <a.jsonl> --sheet <b.jsonl> [--adjudication <sheet.jsonl>] [--adjudicator <slug>] [--reviewed-at <iso>] [--input <manifest>] [--output <manifest>]

Sheets default to ${DEFAULT_SHEET_DIR}/ (ignored). merge rewrites the manifest
in place only when every row has two labels and every disagreement is
adjudicated; otherwise it exits 2 and lists the unresolved rows.`);
}

function main() {
  const args = parseArgs();
  if (args.help || !args.command) {
    printHelp();
    if (!args.help) process.exit(1);
    return;
  }
  let result;
  if (args.command === 'blind') result = runBlind(args);
  else if (args.command === 'adjudicate') result = runAdjudicate(args);
  else if (args.command === 'merge') result = runMerge(args);
  else throw new Error(`Unknown command: ${args.command}`);
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const [key, value] of Object.entries(result)) {
      if (key === 'codes') continue;
      console.log(`- ${key}: ${typeof value === 'object' && value !== null ? JSON.stringify(value) : value}`);
    }
  }
  if (result.errors?.length) process.exit(1);
  if (result.unresolved?.length) process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

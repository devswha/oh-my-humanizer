#!/usr/bin/env node
// Measure-only report for the KO GPT-family miss-review manifest. Counts only:
// population and selection, register x miss_reason, provider/model x
// miss_reason, closest family for threshold-far rows, reviewer agreement and
// the label confusion matrix. No threshold, pattern, lexicon or prompt change
// is proposed here.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_EXCLUSIONS_OUTPUT,
  DEFAULT_OUTPUT,
  DEFAULT_PRIVATE_CORPUS,
  DEFAULT_SOURCE_MANIFEST,
  FAMILIES,
  MISS_REASONS,
  NEAR,
  REGISTERS,
  REPO_ROOT,
  TAXONOMY_VERSION,
  readJsonl,
  round,
  sha256Hex,
  toRepoRelative,
  validateMissReview,
} from './ko-miss-review-lib.mjs';

export const DEFAULT_REPORT_DIR = 'docs/benchmarks';
export const DEFAULT_REPORT_BASENAME = 'ko-gpt-miss-review-v1';

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    input: DEFAULT_OUTPUT,
    exclusions: DEFAULT_EXCLUSIONS_OUTPUT,
    sourceManifest: DEFAULT_SOURCE_MANIFEST,
    privateCorpus: DEFAULT_PRIVATE_CORPUS,
    outputDir: DEFAULT_REPORT_DIR,
    basename: DEFAULT_REPORT_BASENAME,
    generatedAt: null,
    reviewerKinds: {},
    write: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input') args.input = argv[++i];
    else if (arg === '--exclusions') args.exclusions = argv[++i];
    else if (arg === '--source-manifest') args.sourceManifest = argv[++i];
    else if (arg === '--private-corpus') args.privateCorpus = argv[++i];
    else if (arg === '--output-dir') args.outputDir = argv[++i];
    else if (arg === '--basename') args.basename = argv[++i];
    else if (arg === '--generated-at') args.generatedAt = argv[++i];
    else if (arg === '--reviewer-kind') {
      const [reviewer, kind] = String(argv[++i]).split('=');
      if (!reviewer || !kind) throw new Error('--reviewer-kind expects <reviewer>=<kind>');
      args.reviewerKinds[reviewer] = kind;
    } else if (arg === '--write') args.write = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function count(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

export function summarize({ rows, exclusions, validation, input, exclusionsPath, manifestHash, generatedAt, reviewerKinds }) {
  const byRegister = {};
  const byModel = {};
  const byReason = {};
  const closest = {};
  const nearFamilies = {};
  const familyDeficits = Object.fromEntries(FAMILIES.map((family) => [family, []]));
  const reviewers = {};
  let disagreements = 0;
  let adjudicated = 0;
  let agreesWithComputed = 0;
  const confusion = {};
  const labelCounts = {};
  for (const row of rows) {
    const reason = row.miss_reason ?? row.computed_reason;
    count(byReason, reason);
    byRegister[row.register] = byRegister[row.register] ?? {};
    count(byRegister[row.register], reason);
    const modelKey = `${row.provider} / ${row.model}`;
    byModel[modelKey] = byModel[modelKey] ?? {};
    count(byModel[modelKey], reason);
    if (reason === 'threshold-far' && row.margins?.closest_family) count(closest, row.margins.closest_family);
    for (const family of row.margins?.near_families ?? []) count(nearFamilies, family);
    for (const family of FAMILIES) {
      const entry = row.margins?.families?.[family];
      if (entry && !entry.absent) familyDeficits[family].push(entry.deficit);
    }
    if (row.review) {
      for (const label of row.review.labels ?? []) {
        reviewers[label.reviewer] = (reviewers[label.reviewer] ?? 0) + 1;
        labelCounts[label.reviewer] = labelCounts[label.reviewer] ?? {};
        count(labelCounts[label.reviewer], label.miss_reason);
      }
      if (row.review.disagreement) disagreements++;
      if (row.review.adjudication) adjudicated++;
      if (row.review.agrees_with_computed) agreesWithComputed++;
      const [a, b] = row.review.labels ?? [];
      if (a && b) {
        confusion[a.miss_reason] = confusion[a.miss_reason] ?? {};
        count(confusion[a.miss_reason], b.miss_reason);
      }
    }
  }
  const excludedSignals = {};
  const excludedByRegister = {};
  for (const entry of exclusions) {
    for (const signal of entry.hot_signals ?? []) count(excludedSignals, signal);
    count(excludedByRegister, entry.register);
  }
  const reviewed = rows.filter((row) => row.review).length;
  const provenance = rows[0]?.analysis_provenance ?? null;
  return {
    schema: 'ko-gpt-miss-review-report.v1',
    generatedAt,
    input,
    exclusionsPath,
    manifestHash,
    taxonomyVersion: TAXONOMY_VERSION,
    near: NEAR,
    sourceManifest: rows[0]?.source_manifest ?? null,
    sourceManifestHash: rows[0]?.source_manifest_hash ?? null,
    provenance: provenance
      ? { git_commit: provenance.git_commit, features_tree: provenance.features_tree, options_hash: provenance.options_hash, lexicon_version: provenance.lexicon_version, lexicon_hash: provenance.lexicon_hash, analyzed_at: provenance.analyzed_at }
      : null,
    analysisOptions: rows[0]?.analysis_options ?? null,
    validation: { pass: validation.errors.length === 0, errors: validation.errors, warnings: validation.warnings, regeneration: validation.regeneration },
    population: validation.population ?? { candidates: rows.length + exclusions.length, selected: rows.length, excluded: exclusions.length },
    exclusions: { count: exclusions.length, hotSignals: excludedSignals, byRegister: excludedByRegister },
    byReason,
    byRegister,
    byModel,
    closestFamilyForThresholdFar: closest,
    nearFamilies,
    familyDeficitSummary: Object.fromEntries(
      FAMILIES.map((family) => {
        const values = familyDeficits[family].slice().sort((a, b) => a - b);
        const present = values.length;
        const median = present ? values[Math.floor((present - 1) / 2)] : null;
        return [family, { present, absent: rows.length - present, min: present ? values[0] : null, median, max: present ? values[present - 1] : null }];
      })
    ),
    review: {
      reviewed,
      unreviewed: rows.length - reviewed,
      reviewers: Object.keys(reviewers).sort().map((id) => ({ id, labels: reviewers[id], kind: reviewerKinds[id] ?? 'undisclosed' })),
      initialAgreement: reviewed ? { agreed: reviewed - disagreements, total: reviewed, rate: round((reviewed - disagreements) / reviewed, 4) } : null,
      disagreements,
      adjudicated,
      finalAgreesWithComputed: reviewed ? { agreed: agreesWithComputed, total: reviewed, rate: round(agreesWithComputed / reviewed, 4) } : null,
      confusion,
      labelCounts,
    },
  };
}

function table(header, rows) {
  return [`| ${header.join(' | ')} |`, `|${header.map((_, index) => (index === 0 ? '---' : '---:')).join('|')}|`, ...rows.map((row) => `| ${row.join(' | ')} |`)];
}

function crossTable(label, data, keys) {
  const reasons = MISS_REASONS.filter((code) => keys.some((key) => data[key]?.[code]));
  const header = [label, ...reasons, 'total'];
  const rows = keys.filter((key) => data[key]).map((key) => {
    const total = Object.values(data[key]).reduce((sum, n) => sum + n, 0);
    return [key, ...reasons.map((code) => String(data[key][code] ?? 0)), String(total)];
  });
  return table(header, rows);
}

export function renderReport(summary) {
  const lines = [
    '# KO GPT-family miss review (step 1, measure-only)',
    '',
    `- Generated at: ${summary.generatedAt}`,
    `- Manifest: \`${summary.input}\` (${summary.manifestHash})`,
    `- Exclusions: ${summary.exclusionsPath ? `\`${summary.exclusionsPath}\`` : 'none'}`,
    `- Source manifest: \`${summary.sourceManifest}\` (${summary.sourceManifestHash})`,
    `- Analyzer commit: ${summary.provenance?.git_commit ?? 'unknown'}; src/features tree ${summary.provenance?.features_tree ?? 'unknown'}; options ${summary.provenance?.options_hash ?? 'unknown'}`,
    `- Lexicon: ${summary.provenance?.lexicon_version ?? 'unversioned'} (${summary.provenance?.lexicon_hash ?? 'unknown'})`,
    `- Taxonomy: ${summary.taxonomyVersion}, NEAR = ${summary.near}`,
    `- Validation: **${summary.validation.pass ? 'PASS' : 'FAIL'}**${summary.validation.regeneration ? ` (regeneration ${summary.validation.regeneration.identical}/${summary.validation.regeneration.checked} byte-identical)` : ''}`,
    '',
    'Scope: one cell of the 2026 rebaseline (Korean, GPT-family, `ai-like`). Counts below describe',
    'this cell only. They say nothing about naturalness, about other model families, or about',
    'Korean detection in general, and none of them is a threshold recommendation.',
    '',
    '## Population',
    '',
    ...table(['count', 'n'], [
      ['candidates in the frozen manifest', String(summary.population.candidates)],
      ['still a miss under the current analyzer (reviewed)', String(summary.population.selected)],
      ['excluded: precondition violated (now hot)', String(summary.population.excluded)],
    ]),
  ];
  if (summary.exclusions.count) {
    lines.push('', 'Excluded rows are candidates the analyzer at the recorded commit now flags hot. They are listed by the signal that fires, and they are not classified.', '');
    lines.push(...table(['hot signal', 'n'], Object.entries(summary.exclusions.hotSignals).sort().map(([k, v]) => [k, String(v)])));
    lines.push('');
    lines.push(...table(['register', 'excluded'], REGISTERS.filter((r) => summary.exclusions.byRegister[r]).map((r) => [r, String(summary.exclusions.byRegister[r])])));
  }
  lines.push('', '## miss_reason', '', ...table(['miss_reason', 'n'], MISS_REASONS.filter((code) => summary.byReason[code]).map((code) => [code, String(summary.byReason[code])])));
  lines.push('', '## register x miss_reason', '', ...crossTable('register', summary.byRegister, REGISTERS));
  lines.push('', '## provider/model x miss_reason', '', ...crossTable('provider / model', summary.byModel, Object.keys(summary.byModel).sort()));
  if (Object.keys(summary.closestFamilyForThresholdFar).length) {
    lines.push('', '## Closest family for threshold-far rows', '', 'Recorded as required by the taxonomy; "closest" is not "fixable".', '');
    lines.push(...table(['family', 'n'], Object.entries(summary.closestFamilyForThresholdFar).sort().map(([k, v]) => [k, String(v)])));
  }
  if (Object.keys(summary.nearFamilies).length) {
    lines.push('', '## Families within NEAR', '', ...table(['family', 'rows within NEAR'], Object.entries(summary.nearFamilies).sort().map(([k, v]) => [k, String(v)])));
  }
  lines.push('', '## Family deficit summary', '', 'Deficit 0 = at the gate, 1 = one full threshold away; absent = the gate has no value for the row (for example no structural model).', '');
  lines.push(...table(['family', 'present', 'absent', 'min', 'median', 'max'], FAMILIES.map((family) => {
    const s = summary.familyDeficitSummary[family];
    return [family, String(s.present), String(s.absent), fmt(s.min), fmt(s.median), fmt(s.max)];
  })));
  lines.push('', '## Reviewer agreement', '');
  if (summary.review.reviewed === 0) {
    lines.push('No reviewer labels merged yet; the table above uses the extractor\'s computed reasons.');
  } else {
    lines.push(...table(['measure', 'value'], [
      ['reviewed rows', String(summary.review.reviewed)],
      ['reviewers', summary.review.reviewers.map((r) => `${r.id} (${r.kind})`).join(', ')],
      ['initial agreement', `${summary.review.initialAgreement.agreed}/${summary.review.initialAgreement.total} (${pct(summary.review.initialAgreement.rate)})`],
      ['disagreements adjudicated', `${summary.review.adjudicated}/${summary.review.disagreements}`],
      ['final label equals computed tree', `${summary.review.finalAgreesWithComputed.agreed}/${summary.review.finalAgreesWithComputed.total} (${pct(summary.review.finalAgreesWithComputed.rate)})`],
    ]));
    const codes = MISS_REASONS.filter((code) => summary.review.confusion[code] || Object.values(summary.review.confusion).some((row) => row[code]));
    if (codes.length) {
      lines.push('', 'Confusion matrix (rows: first reviewer, columns: second reviewer):', '');
      lines.push(...table(['first \\ second', ...codes], codes.map((a) => [a, ...codes.map((b) => String(summary.review.confusion[a]?.[b] ?? 0))])));
    }
    lines.push('', 'Reviewers worked from blinded sheets: blind id, scalar signal projection, active gate settings and computed margins only. Sample ids, register, provider/model, scores, hashes, the extractor\'s own code and raw text were hidden.');
  }
  lines.push('', '## Boundary', '', 'Discovery-only: these `text_hash`es are excluded from any later confirmatory corpus. A treatment needs its own preregistration first (see `docs/research/ko-gpt-miss-review-step1-decision-20260902.md`).');
  if (summary.validation.errors.length) lines.push('', '## Validation errors', '', ...summary.validation.errors.map((error) => `- ${error}`));
  return `${lines.join('\n')}\n`;
}

function fmt(value) {
  return value === null || value === undefined ? 'n/a' : String(round(value, 3));
}

function pct(value) {
  return value === null || value === undefined ? 'n/a' : `${round(value * 100, 1)}%`;
}

export function buildReport(args, repoRoot = REPO_ROOT) {
  const manifest = readJsonl(args.input, repoRoot);
  const exclusionsPath = args.exclusions ? resolve(repoRoot, args.exclusions) : null;
  const exclusions = exclusionsPath && existsSync(exclusionsPath) ? readJsonl(args.exclusions, repoRoot).rows : [];
  const validation = validateMissReview({
    rows: manifest.rows,
    exclusions,
    requireReview: false,
    sourceManifest: args.sourceManifest,
    privateCorpus: args.privateCorpus,
    repoRoot,
  });
  const summary = summarize({
    rows: manifest.rows,
    exclusions,
    validation,
    input: manifest.relativePath,
    exclusionsPath: exclusions.length ? toRepoRelative(exclusionsPath, repoRoot) : null,
    manifestHash: `sha256:${sha256Hex(manifest.bytes)}`,
    generatedAt: args.generatedAt || new Date().toISOString(),
    reviewerKinds: args.reviewerKinds || {},
  });
  return { summary, markdown: renderReport(summary) };
}

export function writeReport(report, args, repoRoot = REPO_ROOT) {
  const dir = resolve(repoRoot, args.outputDir || DEFAULT_REPORT_DIR);
  mkdirSync(dir, { recursive: true });
  const md = resolve(dir, `${args.basename || DEFAULT_REPORT_BASENAME}.md`);
  const json = resolve(dir, `${args.basename || DEFAULT_REPORT_BASENAME}.json`);
  writeFileSync(md, report.markdown);
  writeFileSync(json, `${JSON.stringify(report.summary, null, 2)}\n`);
  return { markdown: toRepoRelative(md, repoRoot), json: toRepoRelative(json, repoRoot) };
}

function printHelp() {
  console.log(`Usage: node scripts/ko-miss-review-report.mjs [--input <manifest>] [--exclusions <jsonl>] [--source-manifest <scored>]
       [--private-corpus <private>] [--reviewer-kind <id>=<kind>]... [--generated-at <iso>] [--write] [--output-dir ${DEFAULT_REPORT_DIR}] [--basename ${DEFAULT_REPORT_BASENAME}] [--json]

Prints the measure-only report; --write stores <basename>.md and .json under the output dir.`);
}

function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }
  const report = buildReport(args);
  const written = args.write ? writeReport(report, args) : null;
  if (args.json) console.log(JSON.stringify({ ...report.summary, written }, null, 2));
  else {
    console.log(report.markdown);
    if (written) console.log(`Written: ${written.markdown}, ${written.json}`);
  }
  if (!report.summary.validation.pass) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

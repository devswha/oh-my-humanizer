#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DATASET_FILES = ['README.md', 'LICENSE', 'data/test.jsonl', 'source-manifest.json'];
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function exportDataset({ repoRoot = ROOT, output, sourceCommit } = {}) {
  if (!output) throw new Error('An output directory is required');
  const directory = resolve(output);
  if (directory === resolve(repoRoot) || existsSync(resolve(directory, '.git'))) throw new Error('Refusing to overwrite a repository root');
  const review = JSON.parse(readFileSync(resolve(repoRoot, 'docs/research/hf-fixture-license-review.json'), 'utf8'));
  if (review.licensePath !== 'LICENSE') throw new Error('Only the repository LICENSE may be exported');
  const license = readFileSync(resolve(repoRoot, review.licensePath));
  if (review.schemaVersion !== 1 || sha256(license) !== review.licenseSha256) throw new Error('License review is missing or stale');
  const tracked = execFileSync('git', ['-C', repoRoot, 'ls-files', 'tests/fixtures/suspect-zones/*/*/*.md'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
  const reviewed = review.entries.map((entry) => entry.path).sort();
  if (new Set(reviewed).size !== reviewed.length || JSON.stringify(tracked) !== JSON.stringify(reviewed)) throw new Error('The fixture set changed; review redistribution before exporting');
  const commit = sourceCommit || execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Source commit must be a full Git SHA');
  const version = JSON.parse(execFileSync('git', ['-C', repoRoot, 'show', `${commit}:package.json`], { encoding: 'utf8' })).version;
  if (sha256(execFileSync('git', ['-C', repoRoot, 'show', `${commit}:LICENSE`])) !== sha256(license)) throw new Error('License is not bound to the source commit');
  const rows = [];
  for (const entry of [...review.entries].sort((a, b) => a.path.localeCompare(b.path))) {
    if (!/^tests\/fixtures\/suspect-zones\/(en|ko|zh|ja)\/(ai|natural)\/[a-z0-9-]+\.md$/.test(entry.path) || entry.license !== 'MIT') throw new Error('Unapproved fixture path or license');
    const path = resolve(repoRoot, entry.path);
    if (!realpathSync(path).startsWith(realpathSync(resolve(repoRoot, 'tests/fixtures/suspect-zones')) + sep)) throw new Error('Fixture escaped the reviewed tree');
    const bytes = readFileSync(path);
    if (sha256(bytes) !== entry.sha256) throw new Error(`Fixture changed after license review: ${entry.path}`);
    if (sha256(execFileSync('git', ['-C', repoRoot, 'show', `${commit}:${entry.path}`])) !== entry.sha256) throw new Error('Uncommitted fixture cannot be published as a committed source');
    const match = bytes.toString('utf8').match(/^---\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
    if (!match) throw new Error('Missing fixture metadata');
    const meta = yaml.load(match[1]); const text = match[2].trim();
    if (!text || typeof meta.fixture_id !== 'string' || !/^[a-z0-9-]+$/.test(meta.fixture_id)
      || !['en', 'ko', 'zh', 'ja'].includes(meta.language) || !['ai', 'natural'].includes(meta.class) || typeof meta.expected_hot !== 'boolean'
      || !entry.path.includes(`/${meta.language}/${meta.class}/`)) throw new Error('Invalid fixture data');
    rows.push({ id: meta.fixture_id, language: meta.language, style_class: meta.class, expected_hot: meta.expected_hot,
      text, text_sha256: sha256(text), source_path: entry.path, source_sha256: entry.sha256, license: 'MIT',
      provenance: 'Designed repository regression fixture; not a verified human/AI authorship label' });
  }
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error('Duplicate fixture IDs');
  const counts = Object.fromEntries(['en', 'ko', 'zh', 'ja'].map((lang) => [lang, { total: rows.filter((row) => row.language === lang).length,
    hot: rows.filter((row) => row.language === lang && row.expected_hot).length }]));
  const data = `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
  const manifest = { schemaVersion: 1, sourceRepository: 'devswha/patina', sourceCommit: commit, sourceVersion: version,
    rowCount: rows.length, languages: counts, dataSha256: sha256(data), licenseSha256: sha256(license),
    licenseReviewSha256: sha256(readFileSync(resolve(repoRoot, 'docs/research/hf-fixture-license-review.json'))) };
  const card = datasetCard(manifest);
  const files = { 'README.md': card, LICENSE: license.toString('utf8'), 'data/test.jsonl': data,
    'source-manifest.json': `${JSON.stringify(manifest, null, 2)}\n` };
  const priorPath = resolve(directory, 'source-manifest.json');
  if (DATASET_FILES.some((name) => existsSync(resolve(directory, name)))) {
    if (!existsSync(priorPath)) throw new Error('Output contains files not owned by this exporter');
    const prior = JSON.parse(readFileSync(priorPath, 'utf8'));
    if (prior.sourceRepository !== 'devswha/patina' || !prior.fileHashes) throw new Error('Output ownership cannot be verified');
    for (const name of DATASET_FILES.filter((name) => name !== 'source-manifest.json')) {
      if (!existsSync(resolve(directory, name)) || sha256(readFileSync(resolve(directory, name))) !== prior.fileHashes[name]) throw new Error('Exported file was edited; choose a new output directory');
    }
  }
  manifest.fileHashes = Object.fromEntries(Object.entries(files).filter(([name]) => name !== 'source-manifest.json').map(([name, value]) => [name, sha256(value)]));
  files['source-manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  mkdirSync(resolve(directory, 'data'), { recursive: true });
  const realOutput = realpathSync(directory);
  if (!realpathSync(resolve(directory, 'data')).startsWith(realOutput + sep)) throw new Error('Export data directory escaped the output root');
  for (const [name, content] of Object.entries(files)) {
    const path = resolve(directory, name);
    if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Refusing to overwrite a symlink');
    const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW || 0), 0o644);
    try { writeFileSync(fd, content); } finally { closeSync(fd); }
  }
  return { directory, manifest, files: DATASET_FILES };
}

export function datasetCard(manifest) {
  const breakdown = Object.entries(manifest.languages).map(([lang, count]) => `| ${lang} | ${count.total} | ${count.hot} | ${count.total - count.hot} |`).join('\n');
  return `---
pretty_name: Patina suspect-zone regression fixtures
license: mit
language:
  - en
  - ko
  - zh
  - ja
task_categories:
  - text-classification
tags:
  - writing-assistance
  - stylometry
  - regression-tests
configs:
  - config_name: default
    data_files:
      - split: test
        path: data/test.jsonl
---

# Patina suspect-zone regression fixtures

These ${manifest.rowCount} fixtures test whether Patina flags paragraphs as editing
hotspots. They were designed to exercise known stylometry, lexicon and discourse
signals. **The labels do not certify who wrote a text.** A \`natural\` style class
is a regression control, not evidence of human authorship.

Source: [devswha/patina](https://github.com/devswha/patina), version
${manifest.sourceVersion}, commit \`${manifest.sourceCommit}\`. Every row preserves its
source path, source-file hash, text hash and repository MIT license.

| Language | Total | Expected hot | Natural-style controls |
|---|---:|---:|---:|
${breakdown}

## Fields and intended use

- \`text\`: the fixture body, without YAML metadata.
- \`language\`: en, ko, zh or ja.
- \`style_class\`: the source fixture's ai/natural design label.
- \`expected_hot\`: expected editing-hotspot result from the regression suite.
- \`source_path\`, \`source_sha256\`, \`text_sha256\`: source/provenance checks.

Use the test split to reproduce deterministic regressions. The repository's
[benchmark report](https://github.com/devswha/patina/blob/${manifest.sourceCommit}/docs/benchmarks/latest.md)
describes the measured result and uncertainty for that exact fixture suite.
Run \`npm run benchmark\` in the corresponding checkout to reproduce it.

## Limits

This is a small, intentionally constructed set, not an independent sample of
real-world writing. It cannot support authorship accusations, detector-bypass
claims, or broad language/model accuracy claims. It contains no private
rebaseline generations, user submissions or human-panel ratings. The separate
600-generated/200-human rebaseline is not this dataset.

## Licensing and maintenance

The included LICENSE is the source repository's MIT license. The checked-in
per-file redistribution review pins all fixture hashes; adding or changing a
fixture requires a review update before export. Review evidence establishes the
repository licensing basis, not independently verified authorship.

This card and split are generated from the source repository. Submit corrections
there so future releases retain them. \`source-manifest.json\` records the source
version, commit and dataset checksum.
`;
}

export function main(argv = process.argv.slice(2)) {
  let output;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output' && argv[i + 1]) output = argv[++i];
    else if (argv[i] === '--help') { console.log('export-hf-dataset --output DIRECTORY'); return; }
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  const result = exportDataset({ output });
  console.log(JSON.stringify({ output: result.directory, rows: result.manifest.rowCount, sourceCommit: result.manifest.sourceCommit }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

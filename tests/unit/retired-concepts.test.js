import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanPaths,
  scanRoot,
  scanText,
} from '../../scripts/check-retired-concepts.mjs';

const retired = ['ouro', 'boros'].join('');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function relocateFirstMatch(source) {
  const lines = source.split('\n');
  const from = lines.findIndex((line) => line.toLowerCase().includes(retired));
  assert.notEqual(from, -1);
  const to = lines.findIndex((line, index) => index > from && !line.toLowerCase().includes(retired));
  assert.notEqual(to, -1);
  [lines[from], lines[to]] = [lines[to], lines[from]];
  return lines.join('\n');
}


test('current product references are forbidden case-insensitively', () => {
  const report = scanText(`Mode: ${retired.toUpperCase()}`, 'README.md');
  assert.equal(report.forbidden.length, 1);
  assert.equal(report.allowed.length, 0);
  assert.equal(report.historicalDrift.length, 0);
  assert.equal(report.forbidden[0].line, 1);
});

test('clean current product text passes', () => {
  const report = scanText('Use --verify for meaning-floor checks.', 'docs/CLI.md');
  assert.deepEqual(report, { forbidden: [], allowed: [], historicalDrift: [] });
});

test('changelog uses the exact 7.0.0 boundary and pinned historical occurrences', () => {
  const path = 'CHANGELOG.md';
  const source = readFileSync(resolve(repoRoot, path), 'utf8');
  const report = scanText(source, path);
  assert.equal(report.forbidden.length, 0);
  assert.equal(report.allowed.length, 13);
  assert.equal(report.historicalDrift.length, 0);

  const currentExpansion = source.replace(
    /^## 7\.0\.0.*$/m,
    (heading) => `${heading}\nCurrent ${retired} expansion`
  );
  const currentExpansionReport = scanText(currentExpansion, path);
  assert.ok(currentExpansionReport.forbidden.some((row) => row.text === `Current ${retired} expansion`));
  assert.ok(currentExpansionReport.historicalDrift.length > 0);

  const historicalExpansion = `${source}\n## 0.0.0 — historical fixture\nHistorical ${retired} expansion\n`;
  assert.equal(scanText(historicalExpansion, path).forbidden.length, 1);

  const approvedLine = source.split('\n').find((line) => line.toLowerCase().includes(retired));
  const changed = source.replace(approvedLine, `${approvedLine} changed`);
  const changedReport = scanText(changed, path);
  assert.equal(changedReport.forbidden.length, 1);
  assert.ok(changedReport.historicalDrift.some((row) => row.actualCount === 0));

  const missing = source.replace(`${approvedLine}\n`, '');
  assert.ok(scanText(missing, path).historicalDrift.some((row) => row.actualCount === 0));
  const relocated = scanText(relocateFirstMatch(source), path);
  assert.equal(relocated.forbidden.length, 1);
  assert.ok(relocated.historicalDrift.some((row) => row.actualLines?.length === 1));


  const malformed = source.replace(/^## 7\.0\.0\b/m, '## 7.0.1');
  assert.ok(scanText(malformed, path).historicalDrift.some((row) => /7\.0\.0/.test(row.reason)));
});

test('approved historical documents require their exact pinned occurrence sets', () => {
  const paths = [
    ['docs/audits/2026-05-deep-research.md', 14],
    ['docs/superpowers/specs/2026-04-03-meaning-preservation-design.md', 2],
  ];
  for (const [path, expectedCount] of paths) {
    const source = readFileSync(resolve(repoRoot, path), 'utf8');
    const report = scanText(source, path);
    assert.equal(report.forbidden.length, 0, path);
    assert.equal(report.allowed.length, expectedCount, path);
    assert.equal(report.historicalDrift.length, 0, path);

    const expanded = scanText(`${source}\nHistorical ${retired} expansion\n`, path);
    assert.equal(expanded.forbidden.length, 1, path);

    const relocated = scanText(relocateFirstMatch(source), path);
    assert.equal(relocated.forbidden.length, 1, path);
    assert.ok(relocated.historicalDrift.some((row) => row.actualLines?.length === 1), path);
  }
});

test('scanPaths reports only files actually scanned and names every skip reason', () => {
  const root = mkdtempSync(join(tmpdir(), 'patina-retired-scan-'));
  try {
    mkdirSync(resolve(root, '.gjc'), { recursive: true });
    writeFileSync(resolve(root, 'clean.txt'), 'clean text\n');
    writeFileSync(resolve(root, 'binary.bin'), Buffer.from([0, 1, 2]));
    writeFileSync(resolve(root, '.gjc/archive.md'), 'archived text\n');
    const report = scanPaths(root, [
      '.gjc/archive.md',
      'binary.bin',
      'clean.txt',
      'missing.txt',
    ]);
    assert.equal(report.filesDiscovered, 4);
    assert.equal(report.filesScanned, 1);
    assert.deepEqual(report.filesSkipped, { archive: 1, missing: 1, binary: 1, total: 3 });
    assert.equal(report.allowedHits, 0);
    assert.equal(report.forbiddenHits, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('scanRoot fails closed when tracked-file enumeration is unavailable', () => {
  const root = mkdtempSync(join(tmpdir(), 'patina-retired-git-'));
  try {
    assert.throws(() => scanRoot(root), /Unable to enumerate tracked content/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
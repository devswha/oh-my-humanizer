import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseStrictJson } from '../../src/json-response.js';
import { createHash } from 'node:crypto';
const textHash = (value) => createHash('sha256').update(value).digest('hex');

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const bounded = (value, maximum) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;
const integer = (value, maximum = Number.MAX_SAFE_INTEGER) => Number.isInteger(value) && bounded(value, maximum);

export function validateRawScore(text, patterns) {
  const value = parseStrictJson(text);
  const packs = new Map(patterns.map((pack) => [pack.frontmatter.pack.replace(/^[a-z]{2}-/, ''), Number(pack.frontmatter.patterns)]));
  if (!bounded(value.overall, 100) || !object(value.categories) || !Object.keys(value.categories).length) throw new Error('invalid-score-schema');
  for (const [name, row] of Object.entries(value.categories)) {
    if (!packs.has(name) || !object(row) || !integer(row.detected, packs.get(name))
      || !bounded(row.sum, Number.MAX_SAFE_INTEGER) || !bounded(row.max, Number.MAX_SAFE_INTEGER) || row.max === 0 || row.sum > row.max
      || !bounded(row.score, 100) || !bounded(row.weighted, 100)) throw new Error('invalid-score-category');
  }
  return value;
}

export function validateRawMps(text) {
  const value = parseStrictJson(text);
  const types = new Set(['claim', 'polarity', 'causation', 'quantifier', 'negation']);
  const verdicts = new Set(['PASS', 'SOFT_FAIL', 'HARD_FAIL']);
  if (!Array.isArray(value.anchors) || !bounded(value.mps, 100)) throw new Error('invalid-mps-schema');
  for (const anchor of value.anchors) {
    if (!object(anchor) || !types.has(anchor.type) || !verdicts.has(anchor.verdict) || typeof anchor.content !== 'string' || !anchor.content.trim()) throw new Error('invalid-anchor');
  }
  const passed = value.anchors.filter((anchor) => anchor.verdict === 'PASS').length;
  const polarity = value.anchors.filter((anchor) => anchor.type === 'polarity');
  const polarityPassed = polarity.filter((anchor) => anchor.verdict === 'PASS').length;
  if (value.pass_count !== passed || value.total_count !== value.anchors.length
    || value.polarity_pass_count !== polarityPassed || value.polarity_total_count !== polarity.length) throw new Error('inconsistent-mps-counts');
  const passRate = value.anchors.length ? passed / value.anchors.length : 1;
  const expected = polarity.length ? (passRate * .6 + polarityPassed / polarity.length * .4) * 100 : passRate * 100;
  if (Math.abs(value.mps - expected) > .11) throw new Error('inconsistent-mps-score');
  return { ...value, hard_fail_count: value.anchors.filter((anchor) => anchor.verdict === 'HARD_FAIL').length };
}

export function validateRawFidelity(text) {
  const value = parseStrictJson(text);
  if (!['claims_preserved', 'no_fabrication', 'audience_register_match'].every((key) => integer(value[key], 3))) throw new Error('invalid-fidelity-schema');
  return value;
}

export function studySemantics(repoRoot) {
  const fixed = ['.patina.default.yaml', 'package.json', 'src/scoring.js', 'src/json-response.js', 'src/prompt-builder.js',
    'src/features/meaning-proxy.js', 'tests/quality/live-quality.mjs', 'tests/quality/live-scorer-benchmark.mjs',
    'scripts/research/model-rewrite-benchmark.mjs', 'scripts/research/model-evaluation-transport.mjs',
    'scripts/research/study-validation.mjs', 'scripts/research/study-journal.mjs', 'scripts/research/study-job.mjs', 'scripts/research/study-inputs.mjs'];
  const paths = [...fixed];
  for (const directory of ['src', 'patterns', 'core', 'document-types', 'lexicon', 'personas']) {
    const walk = (path) => {
      for (const item of readdirSync(resolve(repoRoot, path), { withFileTypes: true })) {
        const child = `${path}/${item.name}`;
        if (item.isDirectory()) walk(child);
        else if (item.isFile()) paths.push(child);
      }
    };
    walk(directory);
  }
  return Object.fromEntries([...new Set(paths)].sort().map((path) => [path, textHash(readFileSync(resolve(repoRoot, path)))]));
}

export function fixtureIdentity(fixture) {
  return { id: fixture.fixture_id, text_hash: fixture.text_hash, language: fixture.language,
    expected_hot: fixture.expected_hot ?? null, class: fixture.class ?? null,
    register: fixture.register ?? null, documentType: fixture.documentType ?? null,
    source: fixture.source ?? null, provenance: fixture.provenance ?? null };
}

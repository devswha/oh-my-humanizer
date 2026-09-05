#!/usr/bin/env node
// Offline, bounded publication of the six completed A/C scorer matrices (#412).
// Never imports a study runner, transport, credential loader, or live scorer.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { parseStrictJson } from '../../src/json-response.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT = 'docs/benchmarks/live-scorer-20260905';
const PROTOCOL = 'docs/research/model-evaluation-20260904.json';
const LANGUAGES = ['en', 'ko', 'zh', 'ja'];
const PACKS = ['communication', 'content', 'filler', 'language', 'structure', 'style', 'viral-hook'];
const METRICS = { overall: 'overall', rawLLM: 'raw_overall', deterministic: 'deterministic_overall' };
const HASH = /^[a-f0-9]{64}$/;
const MAX_FILE = 8 * 1024 * 1024;
const MAX_SOURCE = 64 * 1024 * 1024;
const COMMITS = { A: '66a19b79e68e0e7df00d0c5da0aa94dac3c51e1c', C: '7de2d0b6d78d905804e8e863392df11d3048265e' };
const SOURCE_FILES = new Set(['.patina.default.yaml', 'package.json',
  'scripts/research/model-evaluation-transport.mjs', 'scripts/research/model-rewrite-benchmark.mjs',
  'scripts/research/study-inputs.mjs', 'scripts/research/study-job.mjs', 'scripts/research/study-journal.mjs',
  'scripts/research/study-validation.mjs', 'tests/quality/live-quality.mjs', 'tests/quality/live-scorer-benchmark.mjs']);
const MODELS = {
  'openai-astra': 'gpt-6-astra', 'openai-sol': 'gpt-5.6-sol', 'openai-terra': 'gpt-5.6-terra',
  'openai-luna': 'gpt-5.6-luna', 'openai-5.5': 'gpt-5.5', 'openai-mini': 'gpt-5.4-mini',
  'gemini-pro': 'google-antigravity/gemini-3.1-pro', 'gemini-3.7': 'google-antigravity/gemini-3.7-flash',
  'gemini-3.8-low': 'google-antigravity/gemini-3.8-flash-low',
  'gemini-3.8-medium': 'google-antigravity/gemini-3.8-flash-medium',
  'gemini-3.8-high': 'google-antigravity/gemini-3.8-flash-high',
};
export const DATASETS = [
  { source: 'A', id: 'scorer-openai', candidates: Object.keys(MODELS).slice(0, 6), repeat: 1, protocolHash: '7c79c2edf1b86407a5279eff9dc0f14d02e1e8e24e75b73f1f2a4e3dbc60706a' },
  { source: 'A', id: 'scorer-gemini', candidates: Object.keys(MODELS).slice(6), repeat: 1, protocolHash: 'c175a0f7e1c3495d4b95c0a5f6bd5efb81ceb794c5dda95a58b55ceed1023d2c' },
  { source: 'A', id: 'scorer-gemini-low-confirm', candidates: ['gemini-3.8-low'], repeat: 2, protocolHash: '94dbaa1798640081212148bbdd484436ffc17eb74dd969eb530c7e3940144755' },
  { source: 'A', id: 'scorer-gemini-pro-confirm', candidates: ['gemini-pro'], repeat: 2, protocolHash: '980a3d6501f47cafb02a12a3c0c94f1aaf7d5ca3c8583a25207ec9ccef516fda' },
  { source: 'C', id: 'scorer-openai-terra-confirm', candidates: ['openai-terra'], repeat: 2, protocolHash: '583b9f6ac3f7e1d7effd6da0ab99abad065cc7f91271bc893f46eccb818936a3' },
  { source: 'C', id: 'scorer-openai-5.5-confirm', candidates: ['openai-5.5'], repeat: 2, protocolHash: 'f07aff116b48a289aa3acaa16934ac4f643a84c94318fd504e37a3f27c0aa502' },
];

export const sha256 = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
function requireEvidence(condition, code) { if (!condition) throw new Error(`scorer-report: ${code}`); }
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value, max = 100) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const integer = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && number(value, max);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (values) => [...values].sort();
const rowKey = (row) => `${row.candidate_id}/${row.fixture_id}/${row.repeat}`;
const timestamp = (value) => typeof value === 'string' && /^2026-09-0[45]T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value));

function readJson(bytes) {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error('scorer-report: invalid JSON'); }
}

// Do not follow symlinks or allow any path supplied by a receipt to escape its root.
export function createReader(directory) {
  const root = realpathSync(directory);
  const cache = new Map();
  let size = 0;
  const locate = (path) => {
    requireEvidence(typeof path === 'string' && /^[a-zA-Z0-9._/-]+$/.test(path)
      && !path.startsWith('/') && path.split('/').every((part) => part && part !== '.' && part !== '..'), 'unsafe source path');
    let full = root;
    for (const part of path.split('/')) {
      full = resolve(full, part);
      requireEvidence(!lstatSync(full).isSymbolicLink(), 'source symlink');
    }
    return full;
  };
  const bytes = (path) => {
    if (cache.has(path)) return cache.get(path);
    const full = locate(path); const stat = lstatSync(full);
    requireEvidence(stat.isFile() && stat.size <= MAX_FILE && size + stat.size <= MAX_SOURCE, 'source size bound');
    const value = readFileSync(full);
    requireEvidence(value.length === stat.size, 'source changed during read');
    size += value.length; cache.set(path, value); return value;
  };
  return { root, bytes, json: (path) => readJson(bytes(path)),
    list: (path) => {
      const entries = readdirSync(locate(path));
      requireEvidence(entries.length <= 1000, 'directory entry bound'); return entries.sort();
    },
    exists: (path) => existsSync(resolve(root, path)),
    verifyUnchanged() {
      for (const [path, value] of cache) {
        const full = locate(path);
        requireEvidence(lstatSync(full).size === value.length && sha256(readFileSync(full)) === sha256(value), 'source changed during publication');
      }
    },
  };
}

function committedFiles(reader, commit, paths) {
  requireEvidence(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: reader.root, encoding: 'utf8' }).trim() === commit, 'source commit differs');
  const output = execFileSync('git', ['cat-file', '--batch'], {
    cwd: reader.root, input: paths.map((path) => `${commit}:${path}\n`).join(''), maxBuffer: MAX_SOURCE,
  });
  let position = 0;
  for (const path of paths) {
    const end = output.indexOf(10, position);
    const header = output.subarray(position, end).toString('utf8').match(/^[a-f0-9]{40} blob ([0-9]+)$/);
    requireEvidence(header, 'missing committed source');
    const length = Number(header[1]);
    const content = output.subarray(end + 1, end + 1 + length);
    requireEvidence(sha256(content) === sha256(reader.bytes(path)), 'source differs from commit');
    position = end + length + 2;
  }
  requireEvidence(position === output.length, 'invalid git source evidence');
}

function frontmatter(bytes) {
  const match = bytes.toString('utf8').match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  requireEvidence(match, 'missing source frontmatter');
  try { return { meta: yaml.load(match[1]), text: match[2].trim() }; }
  catch { throw new Error('scorer-report: invalid source frontmatter'); }
}

function verifySource(reader, spec, semantics) {
  const files = semantics.semantics;
  requireEvidence(object(files) && Object.keys(files).length >= 150 && Object.keys(files).length <= 250, 'source manifest bound');
  for (const [path, hash] of Object.entries(files)) {
    requireEvidence(SOURCE_FILES.has(path) || /^(src|patterns|core|document-types|lexicon|personas)\/[a-zA-Z0-9/_-]+\.(js|md|json)$/.test(path), 'unexpected source file');
    requireEvidence(HASH.test(hash) && sha256(reader.bytes(path)) === hash, 'source semantics hash differs');
  }
  requireEvidence(files['src/json-response.js'] === sha256(readFileSync(resolve(ROOT, 'src/json-response.js'))), 'response parser semantics differ');
  requireEvidence(semantics.fixtures?.length === 49, 'fixture matrix bound');
  const seen = new Set();
  for (const fixture of semantics.fixtures) {
    requireEvidence(LANGUAGES.includes(fixture.language) && ['ai', 'natural'].includes(fixture.class)
      && typeof fixture.expected_hot === 'boolean' && HASH.test(fixture.text_hash)
      && typeof fixture.id === 'string' && /^[a-z0-9-]+$/.test(fixture.id) && !seen.has(fixture.id)
      && fixture.source?.startsWith(`tests/fixtures/suspect-zones/${fixture.language}/${fixture.class}/`), 'invalid fixture identity');
    const source = frontmatter(reader.bytes(fixture.source));
    requireEvidence(source.meta.fixture_id === fixture.id && source.meta.language === fixture.language
      && source.meta.expected_hot === fixture.expected_hot && sha256(source.text) === fixture.text_hash, 'fixture provenance differs');
    seen.add(fixture.id);
  }
  committedFiles(reader, COMMITS[spec.source], [...Object.keys(files), PROTOCOL, ...semantics.fixtures.map((fixture) => fixture.source)]);
  const packs = {};
  for (const language of LANGUAGES) {
    const loaded = Object.keys(files).filter((path) => path.startsWith(`patterns/${language}-`) && path.endsWith('.md')).sort().map((path) => {
      const { meta, text } = frontmatter(reader.bytes(path));
      return { file: path.slice('patterns/'.length), frontmatter: meta, body: text, isStructure: meta.phase === 'structure', isScoreOnly: meta.score_only === true };
    });
    requireEvidence(sha256(loaded) === semantics.effectiveInputs?.patterns?.[language], 'effective pattern catalog differs');
    packs[language] = Object.fromEntries(loaded.map((pack) => [pack.frontmatter.pack.replace(/^[a-z]{2}-/, ''), Number(pack.frontmatter.patterns)]));
    requireEvidence(same(sorted(Object.keys(packs[language])), PACKS) && Object.values(packs[language]).every((n) => integer(n, 100) && n > 0), 'unexpected pattern catalog');
  }
  const effective = semantics.effectiveInputs;
  requireEvidence(HASH.test(effective.configuration) && effective.sourceVoice === false, 'invalid effective configuration fingerprint');
  for (const lang of LANGUAGES) requireEvidence(HASH.test(effective.lexicons?.[lang])
    && effective.structuralModels?.[lang]?.status === 'absent' && effective.structuralModels[lang].contentHash === null, 'unexpected effective input');
  return packs;
}

// Match the collector's original schema without silently strengthening it or
// accepting an invalid row as a zero. Arithmetic consistency is a separate diagnostic.
export function checkRawScore(text, packs) {
  let value;
  try { value = parseStrictJson(text); } catch { return { valid: false, reason: 'invalid-json' }; }
  if (!number(value.overall) || !object(value.categories) || !Object.keys(value.categories).length) return { valid: false, reason: 'invalid-score-schema' };
  for (const [name, category] of Object.entries(value.categories)) {
    if (!Object.hasOwn(packs, name) || !object(category) || !integer(category.detected, packs[name])
      || !number(category.sum, Number.MAX_SAFE_INTEGER) || !number(category.max, Number.MAX_SAFE_INTEGER) || category.max === 0 || category.sum > category.max
      || !number(category.score) || !number(category.weighted)) return { valid: false, reason: 'invalid-score-category' };
  }
  return { valid: true, value };
}

export function distribution(values) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return { n: 0, min: null, median: null, mean: null, p95: null, max: null };
  const mid = Math.floor(ordered.length / 2);
  return { n: ordered.length, min: ordered[0], median: ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2,
    mean: ordered.reduce((sum, value) => sum + value, 0) / ordered.length,
    p95: ordered[Math.ceil(ordered.length * .95) - 1], max: ordered.at(-1) };
}

export function summarizeRows(rows) {
  const valid = rows.filter((row) => row.status === 'ok');
  return { observed: rows.length, uniqueFixtures: new Set(rows.map((row) => row.fixture_id)).size,
    valid: valid.length, errors: rows.length - valid.length,
    availability: { validNumerator: valid.length, observedDenominator: rows.length },
    scores: Object.fromEntries(Object.entries(METRICS).map(([name, field]) => [name, distribution((name === 'deterministic' ? rows : valid).map((row) => row[field]))])),
    reconciliation: { changed: valid.filter((row) => row.overall !== row.raw_overall).length, delta: distribution(valid.map((row) => row.overall - row.raw_overall)) },
  };
}

function candidateSummary(rows, repeat) {
  const valid = rows.filter((row) => row.status === 'ok');
  const byPatternPack = {};
  for (const language of LANGUAGES) for (const pack of PACKS) {
    const selected = valid.filter((row) => row.language === language);
    const values = selected.map((row) => row.categories[pack]?.score).filter(Number.isFinite);
    byPatternPack[`${language}/${pack}`] = { validRows: selected.length, missing: selected.length - values.length, score: distribution(values) };
  }
  const pairs = [];
  if (repeat === 2) for (const first of rows.filter((row) => row.repeat === 0 && row.status === 'ok')) {
    const second = rows.find((row) => row.fixture_id === first.fixture_id && row.repeat === 1 && row.status === 'ok');
    if (second) pairs.push([first, second]);
  }
  return { ...summarizeRows(rows), expected: 49 * repeat,
    byLanguage: Object.fromEntries(LANGUAGES.map((lang) => [lang, summarizeRows(rows.filter((row) => row.language === lang))])),
    byFixtureControl: Object.fromEntries([true, false].map((expected) => [expected ? 'expected_hot' : 'expected_not_hot', summarizeRows(rows.filter((row) => row.expected_hot === expected))])),
    byRepeat: Array.from({ length: repeat }, (_, iteration) => ({ repeat: iteration, ...summarizeRows(rows.filter((row) => row.repeat === iteration)) })),
    byPatternPack,
    pairedRepeatAbsoluteDifference: repeat === 2 ? { pairs: pairs.length,
      scores: Object.fromEntries(Object.entries(METRICS).map(([name, field]) => [name, distribution(pairs.map(([a, b]) => Math.abs(a[field] - b[field])))])) } : null,
  };
}

function checkCandidate(candidate, id) {
  requireEvidence(candidate?.id === id && candidate.model === MODELS[id]
    && candidate.provider === (id.startsWith('openai-') ? 'openai' : 'gemini') && candidate.transport === 'opencodex'
    && candidate.baseURL === 'http://127.0.0.1:10100/v1' && !candidate.apiKeyEnv
    && (id.startsWith('openai-') ? candidate.extraBody?.reasoning_effort === 'low' : candidate.extraBody === undefined), 'candidate identity or route differs');
}

export function verifyMatrix(rows, expectedKeys, fixtures, spec) {
  requireEvidence(Array.isArray(rows) && rows.length <= 400 && fixtures.length === 49, 'matrix size bound');
  const expected = spec.candidates.flatMap((id) => Array.from({ length: spec.repeat }, (_, iteration) => fixtures.map((fixture) => `${id}/${fixture.id}/${iteration}`)).flat());
  requireEvidence(Array.isArray(expectedKeys) && same(sorted(expectedKeys), sorted(expected)), 'declared matrix differs');
  requireEvidence(same(sorted(rows.map(rowKey)), sorted(expected)), 'missing, duplicate, or unexpected row');
  for (const row of rows) {
    const fixture = fixtures.find((item) => item.id === row.fixture_id);
    requireEvidence(row.schemaVersion === 1 && row.protocol_hash === spec.protocolHash && row.requested_model === MODELS[row.candidate_id]
      && row.provider === (row.candidate_id.startsWith('openai-') ? 'openai' : 'gemini') && row.transport === 'opencodex'
      && ['ok', 'error'].includes(row.status) && integer(row.repeat, spec.repeat - 1), 'row identity or protocol differs');
    for (const field of ['text_hash', 'language', 'class', 'expected_hot', 'source', 'register']) requireEvidence(row[field] === fixture[field], 'row fixture identity differs');
    requireEvidence(number(row.deterministic_overall) || row.deterministic_overall === null, 'invalid deterministic score');
    requireEvidence(Array.isArray(row.calls) && row.calls.length >= 1 && row.calls.length <= 2, 'call count bound');
    if (row.status === 'ok') requireEvidence(number(row.overall) && number(row.raw_overall) && row.raw_overall === row.llm_overall && row.error === null
      && row.overall >= row.raw_overall && row.overall <= Math.max(row.raw_overall, row.deterministic_overall ?? row.raw_overall), 'invalid successful score');
    else requireEvidence(row.overall === null && row.raw_overall === null && object(row.categories) && !Object.keys(row.categories).length, 'error score must remain missing');
  }
}

export function verifyReceipt(receipt, call, { candidate, logicalId, index, packs }) {
  requireEvidence(receipt.schemaVersion === 1 && ['completed', 'error'].includes(receipt.state)
    && HASH.test(receipt.promptHash) && HASH.test(receipt.requestHash) && number(receipt.temperature, 2), 'nonterminal or invalid receipt');
  const request = { logicalId, index, candidate, promptHash: receipt.promptHash, temperature: receipt.temperature, responseFormat: null, extraBody: null };
  requireEvidence(sha256(request) === receipt.requestHash, 'receipt request binding differs');
  requireEvidence(call.temperature === receipt.temperature && call.temperature_control === 'requested', 'temperature evidence differs');
  requireEvidence(Array.isArray(receipt.transportAttempts) && receipt.transportAttempts.length <= 8, 'transport attempt bound');
  const attempts = receipt.transportAttempts;
  requireEvidence(call.attempts === attempts.length && call.transportAttempts?.length === attempts.length && !call.notStarted, 'attempt denominator differs');
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    requireEvidence(attempt.attemptIndex === i + 1 && attempt.requestedModel === candidate.model
      && ['success', 'error'].includes(attempt.outcome) && attempt.outcome === call.transportAttempts[i].outcome, 'attempt metadata differs');
    if (attempt.outcome === 'success') requireEvidence(attempt.effectiveModel === candidate.model, 'attempt model identity differs');
  }
  if (receipt.state === 'error') {
    requireEvidence(call.status === 'error' && call.schema_valid === null, 'transport failure metadata differs');
    return { valid: false, reason: 'transport-error', attempts: attempts.length };
  }
  const response = receipt.response;
  requireEvidence(object(response) && typeof response.text === 'string' && response.text.length <= 200_000
    && Array.isArray(response.effectiveModels) && response.effectiveModels.length > 0
    && response.effectiveModels.every((model) => model === candidate.model)
    && same(call.effectiveModels, response.effectiveModels) && call.modelIdentityVerified === true && call.mixedOrUnexpectedModel === false
    && call.status === 'ok' && response.attempts === attempts.length && call.durationMs === response.durationMs
    && number(response.durationMs, 3_600_000), 'response model identity or metadata differs');
  const checked = checkRawScore(response.text, packs);
  requireEvidence(receipt.schemaValid === checked.valid && call.schema_valid === checked.valid, 'receipt schema evidence differs');
  return { ...checked, attempts: attempts.length };
}

export function verifyDataset(reader, spec) {
  const base = `artifacts/model-evaluation-${spec.source === 'A' ? '20260904' : '20260905'}/validated`;
  const directory = `${base}/${spec.id}`;
  requireEvidence(!reader.exists(`${directory}/.writer.lock`), 'dataset writer is active');
  const summary = reader.json(`${directory}/scorer-summary.json`);
  const semantics = reader.json(`${directory}/semantics.json`);
  const job = reader.json(`${base}/jobs/${spec.id}/job.json`);
  requireEvidence(summary.protocolHash === spec.protocolHash && semantics.protocolHash === spec.protocolHash, 'original protocol differs');
  requireEvidence(job.schemaVersion === 1 && job.state === 'completed' && job.exitCode === 0 && job.signal === null
    && timestamp(job.startedAt) && timestamp(job.endedAt) && Date.parse(job.endedAt) >= Date.parse(job.startedAt), 'job is not terminal');
  const args = job.args;
  requireEvidence(Array.isArray(args) && args.length <= 12 && args.includes('--live')
    && args[args.indexOf('--candidates') + 1] === PROTOCOL && args[args.indexOf('--output') + 1] === directory
    && (spec.repeat === 2 ? args[args.indexOf('--repeat') + 1] === '2' && args[args.indexOf('--candidate') + 1] === spec.candidates[0]
      : args[args.indexOf('--provider') + 1] === (spec.id === 'scorer-openai' ? 'openai' : 'gemini'))
    && !args.includes('--manifest') && !args.includes('--texts') && !args.includes('--limit'), 'terminal job selection differs');
  const packs = verifySource(reader, spec, semantics);
  const protocol = reader.json(PROTOCOL);
  requireEvidence(protocol.study === 'patina-model-evaluation-20260904', 'study identifier differs');
  const candidates = spec.candidates.map((id) => {
    const matching = protocol.candidates.filter((row) => row.id === id);
    requireEvidence(matching.length === 1, 'candidate is missing or duplicated');
    checkCandidate(matching[0], id); return matching[0];
  });
  let rows;
  try { rows = reader.bytes(`${directory}/scorer-rows.jsonl`).toString('utf8').split(/\r?\n/).filter((line) => line.trim()).map(JSON.parse); }
  catch { throw new Error('scorer-report: invalid row JSON'); }
  verifyMatrix(rows, summary.expectedKeys, semantics.fixtures, spec);
  const bound = reader.exists(`${directory}/study-protocol.json`);
  if (bound) {
    const binding = reader.json(`${directory}/study-protocol.json`);
    requireEvidence(binding.schemaVersion === 1 && binding.protocolHash === spec.protocolHash, 'directory protocol binding differs');
  }
  requireEvidence(spec.source !== 'C' || bound, 'missing C directory protocol binding');
  const groups = rows.map((row) => sha256(`${spec.protocolHash}/${rowKey(row)}/score`));
  requireEvidence(same(sorted(groups), reader.list(`${directory}/calls`)), 'receipt group matrix differs');
  const receiptManifest = [];
  const errorCounts = { 'invalid-json': 0, 'invalid-score-schema': 0, 'invalid-score-category': 0, 'transport-error': 0 };
  let transportAttempts = 0; let schemaFailures = 0; let identityVerified = 0;
  let arithmeticMismatches = 0; let weightedSumMismatches = 0;
  for (const row of rows) {
    const logicalId = `${spec.protocolHash}/${rowKey(row)}/score`;
    const group = sha256(logicalId);
    const names = Array.from({ length: row.calls.length }, (_, i) => `${i + 1}.private.json`);
    requireEvidence(same(reader.list(`${directory}/calls/${group}`), names), 'receipt sequence differs');
    const candidate = candidates.find((item) => item.id === row.candidate_id);
    const checked = [];
    for (let i = 0; i < names.length; i++) {
      const path = `${directory}/calls/${group}/${names[i]}`;
      const receipt = reader.json(path);
      requireEvidence(timestamp(receipt.startedAt) && timestamp(receipt.endedAt) && timestamp(row.recorded_at)
        && Date.parse(receipt.startedAt) >= Date.parse(job.startedAt)
        && Date.parse(receipt.endedAt) >= Date.parse(receipt.startedAt)
        && Date.parse(row.recorded_at) >= Date.parse(receipt.endedAt)
        && Date.parse(row.recorded_at) <= Date.parse(job.endedAt), 'receipt time bounds differ');
      const result = verifyReceipt(receipt, row.calls[i], { candidate, logicalId, index: i + 1, packs: packs[row.language] });
      checked.push(result); transportAttempts += result.attempts;
      if (receipt.state === 'completed') identityVerified++;
      if (receipt.schemaValid === false) schemaFailures++;
      receiptManifest.push({ group, index: i + 1, sha256: sha256(reader.bytes(path)), requestHash: receipt.requestHash, promptHash: receipt.promptHash });
    }
    requireEvidence(number(row.duration_ms, 7_200_000) && row.duration_ms === row.calls.reduce((sum, call) => sum + call.durationMs, 0), 'row duration differs from receipts');
    const last = checked.at(-1);
    requireEvidence(row.schema_failures === row.calls.filter((call) => call.schema_valid === false).length, 'schema failure count differs');
    requireEvidence(row.status === (last.valid ? 'ok' : 'error'), 'row validity differs from receipts');
    if (!last.valid) { errorCounts[last.reason]++; continue; }
    requireEvidence(row.raw_overall === last.value.overall, 'raw score differs from receipt');
    requireEvidence(same(sorted(Object.keys(row.categories)), sorted(Object.keys(last.value.categories))), 'category keys differ from receipt');
    for (const [pack, category] of Object.entries(last.value.categories)) {
      for (const field of ['detected', 'sum', 'max', 'score', 'weighted']) requireEvidence(row.categories[pack][field] === category[field], 'category score differs from receipt');
      if (Math.abs(category.score - 100 * category.sum / category.max) > .11) arithmeticMismatches++;
    }
    if (Math.abs(Object.values(last.value.categories).reduce((sum, category) => sum + category.weighted, 0) - row.raw_overall) > .11) weightedSumMismatches++;
  }
  receiptManifest.sort((a, b) => a.group.localeCompare(b.group) || a.index - b.index);
  for (const candidate of candidates) {
    const selected = rows.filter((row) => row.candidate_id === candidate.id);
    const actual = summarizeRows(selected); const prior = summary.summary?.[candidate.id];
    requireEvidence(prior?.total === actual.observed && prior?.valid === actual.valid && prior?.errors === actual.errors
      && same(prior.overall, actual.scores.overall), 'collector summary differs from rows');
  }
  const artifactPaths = [`${directory}/scorer-rows.jsonl`, `${directory}/scorer-summary.json`, `${directory}/semantics.json`, `${base}/jobs/${spec.id}/job.json`, PROTOCOL];
  if (bound) artifactPaths.push(`${directory}/study-protocol.json`);
  return { id: spec.id, source: spec.source, sourceCommit: COMMITS[spec.source], study: protocol.study,
    protocolHash: spec.protocolHash, repeat: spec.repeat, uniqueFixtures: 49,
    collection: { state: 'completed', startedAt: job.startedAt, endedAt: job.endedAt,
      expected: summary.expectedKeys.length, observed: rows.length, valid: rows.filter((row) => row.status === 'ok').length,
      errors: rows.filter((row) => row.status === 'error').length, missing: 0, calls: receiptManifest.length, transportAttempts, identityVerifiedResponses: identityVerified, schemaFailures, errorCounts },
    provenance: { artifacts: Object.fromEntries(artifactPaths.map((path) => [path, sha256(reader.bytes(path))])),
      semanticsSha256: sha256(semantics.semantics), effectiveInputs: {
        configuration: semantics.effectiveInputs.configuration, sourceVoice: false,
        patterns: Object.fromEntries(LANGUAGES.map((lang) => [lang, semantics.effectiveInputs.patterns[lang]])),
        lexicons: Object.fromEntries(LANGUAGES.map((lang) => [lang, semantics.effectiveInputs.lexicons[lang]])),
        structuralModels: Object.fromEntries(LANGUAGES.map((lang) => [lang, { status: 'absent', contentHash: null }])),
      },
      fixtureIdentitySha256: sha256(semantics.fixtures), expectedKeysSha256: sha256(summary.expectedKeys),
      receiptManifestSha256: sha256(receiptManifest), receiptCount: receiptManifest.length,
      requestHashesSha256: sha256(sorted(receiptManifest.map((receipt) => receipt.requestHash))),
      promptHashesSha256: sha256(sorted(receiptManifest.map((receipt) => receipt.promptHash))),
      sourceFilesVerifiedAgainstCommit: Object.keys(semantics.semantics).length,
      scorerSha256: semantics.semantics['src/scoring.js'], parserSha256: semantics.semantics['src/json-response.js'],
      patternCatalog: packs, directoryProtocolBinding: bound ? 'present' : 'legacy-absent',
      protocolRecomputed: false, fullScorerReplay: false },
    diagnostics: { categoryArithmeticMismatches: arithmeticMismatches, overallWeightedSumMismatches: weightedSumMismatches, arithmeticTolerance: .11 },
    candidates: candidates.map((candidate) => ({ id: candidate.id, provider: candidate.provider, transport: candidate.transport,
      requestedModel: candidate.model, responseModel: candidate.model, identityEvidence: 'OpenCodex response metadata; not upstream attestation',
      requestedReasoningEffort: candidate.extraBody?.reasoning_effort ?? null,
      ...candidateSummary(rows.filter((row) => row.candidate_id === candidate.id), spec.repeat) })),
  };
}

export function assembleReport({ sourceA, sourceC, audit }) {
  const readers = { A: createReader(sourceA), C: createReader(sourceC) };
  const datasets = DATASETS.map((spec) => verifyDataset(readers[spec.source], spec));
  const fixtureHash = datasets[0].provenance.fixtureIdentitySha256;
  requireEvidence(datasets.every((dataset) => dataset.provenance.fixtureIdentitySha256 === fixtureHash), 'cross-cohort fixture identities differ');
  let priorAudit = null;
  if (audit) {
    const reader = createReader(dirname(resolve(audit)));
    const path = resolve(audit).slice(reader.root.length + 1);
    const bytes = reader.bytes(path); const value = readJson(bytes);
    requireEvidence(value.sourceCommit === COMMITS.A && timestamp(value.checkedAt), 'prior audit identity differs');
    const covered = datasets.filter((dataset) => value.datasets?.some((entry) => entry.dataset === dataset.id));
    for (const dataset of covered) {
      const entry = value.datasets.find((item) => item.dataset === dataset.id);
      requireEvidence(entry.protocolHash === dataset.protocolHash && entry.rows === dataset.collection.observed
        && entry.receipts === dataset.collection.calls && entry.recordedTransportAttempts === dataset.collection.transportAttempts
        && entry.receiptAudit === 'passed' && Array.isArray(entry.anomalies) && entry.anomalies.length === 0, 'prior audit contradicts independent checks');
    }
    priorAudit = { sha256: sha256(bytes), checkedAt: value.checkedAt, sourceCommit: value.sourceCommit, coveredDatasets: covered.map((dataset) => dataset.id) };
    reader.verifyUnchanged();
  }
  for (const reader of Object.values(readers)) reader.verifyUnchanged();
  return { schemaVersion: 1, reportDate: '2026-09-05', timezone: 'Asia/Seoul', issue: 412,
    status: 'completed-fixture-diagnostics; rebaseline-evidence-missing',
    scope: 'src/scoring.js scoreText AI-likeness diagnostics; not rewrite quality or authenticated authorship accuracy',
    totals: { datasets: datasets.length, candidates: new Set(datasets.flatMap((dataset) => dataset.candidates.map((candidate) => candidate.id))).size,
      uniqueFixtures: 49, observed: datasets.reduce((n, dataset) => n + dataset.collection.observed, 0),
      valid: datasets.reduce((n, dataset) => n + dataset.collection.valid, 0), errors: datasets.reduce((n, dataset) => n + dataset.collection.errors, 0) },
    metricDefinitions: { overall: 'Recorded production scoreText overall, after deterministic reconciliation; valid rows only.',
      rawLLM: 'Receipt-validated raw_overall; equals llm_overall on valid rows. Invalid schema values are excluded.',
      deterministic: 'Recorded deterministic_overall on all observed rows, including scorer errors. No recomputation from hash-only resolved inputs.',
      patternPack: 'Recorded category.score; omissions counted, never filled with zero. A pack score is not an individual pattern accuracy.',
      distribution: 'Finite values only; median averages the middle pair; p95 is nearest-rank ceil(0.95*n); unrounded JSON statistics.',
      receiptManifest: 'SHA-256 of JSON.stringify(sorted [{group,index,sha256,requestHash,promptHash}]); group = SHA-256(originalProtocol/candidate/fixture/repeat/score). File sha256 covers original bytes. Sort by group then index. Request/prompt commitments hash sorted original hash arrays, including duplicates.' },
    limitations: [
      'The 49 suspect-zones inputs are curated regression controls (26 expected_hot, 23 expected_not_hot), not authenticated real-world human-vs-AI truth or human preference ratings.',
      'No rebaseline corpus was collected in these six datasets. Its runner support is not evidence of a completed rebaseline experiment.',
      'A and C retain separate protocol and effective-input hashes. Lexicon fingerprints include absolute paths; different hashes alone do not prove different lexical content. Repeats are the same 49 inputs, not additional independent samples.',
      'Resolved configuration and complete deterministic analyses were not archived, only hashed. Protocol IDs are preserved and cross-bound to rows/receipts; they cannot be fully recomputed here. Prompt hashes bind requests but do not independently reconstruct prompt text.',
      'Overall and deterministic scalars are source-bound collector observations, not independently replayed production outputs. Receipt schema, raw scores, categories, model metadata, matrix membership, and committed source/fixture bytes are independently checked.',
      'Original raw-score validation permits partial packs and does not enforce arithmetic consistency. Reported arithmetic diagnostics do not change original validity or repair model outputs.',
      'Model names are exact requested/returned OpenCodex identifiers observed in these calls. Metadata equality does not authenticate upstream model weights, current catalog availability, reasoning execution, or provider-wide reliability.',
      'Serial call timing, one initial pass and selected two-repeat cohorts cannot establish a winner, calibrated threshold, or default model. No live score CI gate, cost estimate, rewrite-quality claim, or human label is introduced.',
      'Only the six explicitly selected terminal A/C matrices are included. Other study lanes are outside this completed comparison.',
    ],
    acceptance: { supported: ['opt-in production scorer fixture collection', 'per-language and per-pattern-pack distributions', 'explicit validity and availability denominators', 'diagnostics without a CI score gate'],
      gaps: ['completed rebaseline corpus measurements', 'resolved configuration and deterministic analysis snapshots for full offline replay'],
      closure: 'Partial evidence for #412. The fixture diagnostic deliverable is complete; do not claim its rebaseline scope is complete.' },
    priorAudit, datasets };
}

const format = (value) => Number.isFinite(value) ? value.toFixed(2) : 'N/A';
export function renderReport(report) {
  const lines = ['# Live scorer diagnostics — September 5, 2026', '',
    `${report.totals.valid}/${report.totals.observed} valid rows across ${report.totals.datasets} completed matrices, ${report.totals.candidates} observed model identifiers, and 49 unique regression fixtures.`, '',
    report.acceptance.closure, '',
    'The production `src/scoring.js` `scoreText` path was used by the opt-in collector. This publication reads completed artifacts offline. It makes no provider calls.', '',
    '## Reading the results', '',
    ...Object.entries(report.metricDefinitions).filter(([key]) => key !== 'receiptManifest').map(([key, value]) => `- **${key}:** ${value}`), '',
    'Scores range from 0 to 100; larger values mean more detected writing patterns. A candidate mean is not a measure of scorer quality.', '',
    'The JSON companion preserves full-precision distributions, per-repeat and fixture-control slices, paired repeat differences, original protocol IDs, and source/receipt integrity commitments. All model names below are observed OpenCodex identifiers.', '',
    '## Validity and score distributions', '',
    '| Cohort | Candidate | Valid / expected | Errors | Overall median / mean | Raw LLM median / mean | Deterministic n / mean | Adjusted rows |',
    '|---|---|---:|---:|---:|---:|---:|---:|'];
  for (const dataset of report.datasets) for (const candidate of dataset.candidates) {
    const scores = candidate.scores;
    lines.push(`| ${dataset.source}/${dataset.id} | ${candidate.id} | ${candidate.valid}/${candidate.expected} | ${candidate.errors} | ${format(scores.overall.median)} / ${format(scores.overall.mean)} | ${format(scores.rawLLM.median)} / ${format(scores.rawLLM.mean)} | ${scores.deterministic.n} / ${format(scores.deterministic.mean)} | ${candidate.reconciliation.changed} |`);
  }
  lines.push('', '## Errors and arithmetic diagnostics', '',
    'Validity uses the original collector schema. The arithmetic checks count category scores differing from `100 × sum / max`, and overall scores differing from the sum of category weights, by more than 0.11 points. They do not reclassify valid rows. These are diagnostic counts, not model rankings.', '',
    '| Cohort | Schema-failed rows | Transport-failed rows | Category arithmetic mismatches | Overall weighted-sum mismatches |', '|---|---:|---:|---:|---:|');
  for (const dataset of report.datasets) lines.push(`| ${dataset.id} | ${dataset.collection.errors - dataset.collection.errorCounts['transport-error']} | ${dataset.collection.errorCounts['transport-error']} | ${dataset.diagnostics.categoryArithmeticMismatches} | ${dataset.diagnostics.overallWeightedSumMismatches} |`);
  lines.push('', '## Language distributions', '', '| Cohort / candidate | Language | Valid / observed | Overall n / mean / median / p95 | Raw LLM n / mean / median / p95 | Deterministic n / mean / median / p95 |', '|---|---|---:|---:|---:|---:|');
  const compact = (d) => `${d.n} / ${format(d.mean)} / ${format(d.median)} / ${format(d.p95)}`;
  for (const dataset of report.datasets) for (const candidate of dataset.candidates) for (const [lang, slice] of Object.entries(candidate.byLanguage)) {
    lines.push(`| ${dataset.id}/${candidate.id} | ${lang} | ${slice.valid}/${slice.observed} | ${compact(slice.scores.overall)} | ${compact(slice.scores.rawLLM)} | ${compact(slice.scores.deterministic)} |`);
  }
  lines.push('', '## Pattern-pack distributions', '', 'Each value is the category score from a valid response. Missing packs remain missing. Repeated rows do not increase the unique fixture count.', '',
    '| Cohort / candidate | Language / pack | n / valid rows | Missing | Min | Median | Mean | p95 | Max |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const dataset of report.datasets) for (const candidate of dataset.candidates) for (const [pack, slice] of Object.entries(candidate.byPatternPack)) {
    const d = slice.score;
    lines.push(`| ${dataset.id}/${candidate.id} | ${pack} | ${d.n}/${slice.validRows} | ${slice.missing} | ${format(d.min)} | ${format(d.median)} | ${format(d.mean)} | ${format(d.p95)} | ${format(d.max)} |`);
  }
  lines.push('', '## Evidence and identity', '', '| Cohort | Source commit | Original protocol | Rows / calls / transport attempts |', '|---|---|---|---:|');
  for (const dataset of report.datasets) lines.push(`| ${dataset.source}/${dataset.id} | \`${dataset.sourceCommit}\` | \`${dataset.protocolHash}\` | ${dataset.collection.observed} / ${dataset.collection.calls} / ${dataset.collection.transportAttempts} |`);
  lines.push('', '| Candidate | Exact requested and returned model | Transport | Requested reasoning effort |', '|---|---|---|---|');
  const seen = new Set();
  for (const dataset of report.datasets) for (const candidate of dataset.candidates) if (!seen.has(candidate.id)) {
    seen.add(candidate.id); lines.push(`| ${candidate.id} | \`${candidate.requestedModel}\` | ${candidate.transport} | ${candidate.requestedReasoningEffort ?? 'unspecified'} |`);
  }
  lines.push('', 'Hashes in the JSON companion cover the source rows, semantics, summary, original protocol document, terminal job record, and private receipt set. Source and fixture bytes were checked against the two pinned commits. A uses legacy directories without `study-protocol.json`; C has that binding. Neither source directory is modified.', '',
    report.priorAudit ? `The earlier audit (${report.priorAudit.checkedAt}; SHA-256 \`${report.priorAudit.sha256}\`) agrees for ${report.priorAudit.coveredDatasets.join(', ')}. The other matrices were checked independently for this publication.` : 'No earlier external audit was supplied.', '',
    '## Limits and remaining work', '', ...report.limitations.map((item) => `- ${item}`), '',
    '## Reproduce offline', '', 'From a checkout containing the assembler, with read-only access to the pinned A and C worktrees:', '',
    '```sh', 'node scripts/research/publish-scorer-report.mjs \\', '  --source-a /path/to/frozen-A --source-c /path/to/frozen-C \\', '  --audit /path/to/patina-model-journal-audit-20260905.json --check', '```', '',
    'Use `--write` to regenerate only this Markdown file and its JSON companion. Without either flag, the assembler prints a compact validation summary. Bounds reject unexpected matrices, nonterminal receipts, model mismatches, changed sources, symlinks, and oversized input. No provider credentials are read.', '',
    'The existing opt-in runner is `tests/quality/live-scorer-benchmark.mjs` (`npm run benchmark:scorer:live -- --help`). Its `--manifest`/`--texts` path can collect a separately authorized rebaseline study. This report does not start or imply that study.', '');
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help') { console.log('publish-scorer-report --source-a DIR --source-c DIR [--audit FILE] [--write | --check] (offline only)'); return; }
    if (['--write', '--check'].includes(arg)) options[arg.slice(2)] = true;
    else if (['--source-a', '--source-c', '--audit'].includes(arg) && argv[i + 1] && !argv[i + 1].startsWith('--')) options[arg.slice(2)] = argv[++i];
    else throw new Error('scorer-report: invalid argument');
  }
  requireEvidence(options['source-a'] && options['source-c'] && !(options.write && options.check), 'required sources or conflicting mode');
  const report = assembleReport({ sourceA: options['source-a'], sourceC: options['source-c'], audit: options.audit });
  const outputs = { [`${REPORT}.json`]: `${JSON.stringify(report, null, 2)}\n`, [`${REPORT}.md`]: renderReport(report) };
  for (const [path, content] of Object.entries(outputs)) {
    const destination = resolve(ROOT, path);
    if (options.check) requireEvidence(existsSync(destination) && readFileSync(destination, 'utf8') === content, 'published report differs');
    if (options.write) {
      createReader(ROOT).list('docs/benchmarks');
      requireEvidence(!existsSync(destination) || !lstatSync(destination).isSymbolicLink(), 'output symlink');
      mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, content);
    }
  }
  console.log(JSON.stringify({ status: report.status, ...report.totals, written: options.write === true, checked: options.check === true }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    // Never echo a path, parser excerpt, receipt, or provider error to public logs.
    console.error(error.message?.startsWith('scorer-report: ') ? error.message : 'scorer-report: input verification failed');
    process.exitCode = 1;
  }
}

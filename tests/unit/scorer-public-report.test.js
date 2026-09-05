import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASETS, checkRawScore, createReader, distribution, main, renderReport, sha256, summarizeRows, verifyMatrix, verifyReceipt } from '../../scripts/research/publish-scorer-report.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicJson = resolve(ROOT, 'docs/benchmarks/live-scorer-20260905.json');
const publicMarkdown = resolve(ROOT, 'docs/benchmarks/live-scorer-20260905.md');
const clone = (value) => JSON.parse(JSON.stringify(value));
// Synthetic verification cases below are not experimental measurements.
const candidate = { id: 'openai-astra', provider: 'openai', transport: 'opencodex',
  baseURL: 'http://127.0.0.1:10100/v1', model: 'gpt-6-astra', extraBody: { reasoning_effort: 'low' } };
const category = { detected: 0, sum: 0, max: 18, score: 0, weighted: 0 };
const raw = { overall: 0, categories: { content: category }, interpretation: 'test-only' };

function receiptCase(value = raw, valid = true) {
  const binding = { candidate, logicalId: 'synthetic-test/fixture/0/score', index: 1, packs: { content: 6 } };
  const receipt = { schemaVersion: 1, state: 'completed', promptHash: sha256('synthetic prompt'), temperature: .1,
    transportAttempts: [{ attemptIndex: 1, requestedModel: candidate.model, effectiveModel: candidate.model, outcome: 'success' }],
    response: { text: JSON.stringify(value), effectiveModels: [candidate.model], attempts: 1, durationMs: 10 }, schemaValid: valid };
  receipt.requestHash = sha256({ logicalId: binding.logicalId, index: 1, candidate, promptHash: receipt.promptHash,
    temperature: .1, responseFormat: null, extraBody: null });
  const call = { temperature: .1, temperature_control: 'requested', attempts: 1, notStarted: false,
    transportAttempts: [{ outcome: 'success' }], effectiveModels: [candidate.model], modelIdentityVerified: true,
    mixedOrUnexpectedModel: false, status: 'ok', durationMs: 10, schema_valid: valid };
  return { receipt, call, binding };
}

function matrixCase() {
  const spec = { ...DATASETS[0], candidates: [candidate.id] };
  const fixtures = Array.from({ length: 49 }, (_, i) => ({ id: `test-${i}`, text_hash: sha256(`fixture-${i}`), language: 'en',
    class: i % 2 ? 'ai' : 'natural', expected_hot: Boolean(i % 2), source: `tests/fixtures/suspect-zones/en/test-${i}.md`, register: 'unspecified' }));
  const rows = fixtures.map((fixture) => ({ ...fixture, fixture_id: fixture.id, schemaVersion: 1, protocol_hash: spec.protocolHash,
    requested_model: candidate.model, candidate_id: candidate.id, provider: 'openai', transport: 'opencodex',
    status: 'ok', repeat: 0, deterministic_overall: 25, overall: 0, raw_overall: 0, llm_overall: 0, error: null,
    calls: [receiptCase().call], categories: { content: category } }));
  const expected = rows.map((row) => `${row.candidate_id}/${row.fixture_id}/${row.repeat}`);
  return { spec, fixtures, rows, expected };
}

test('statistics retain zero, exclude missing values, and use nearest-rank p95', () => {
  assert.deepEqual(distribution([null, undefined, '0', NaN, Infinity]), { n: 0, min: null, median: null, mean: null, p95: null, max: null });
  assert.deepEqual(distribution([0, 2, 4, 6, null]), { n: 4, min: 0, median: 3, mean: 3, p95: 6, max: 6 });
  assert.equal(distribution(Array.from({ length: 20 }, (_, i) => i)).p95, 18);
});

test('schema failures are excluded from LLM distributions but retain deterministic observations', () => {
  const rows = [
    { fixture_id: 'one', status: 'ok', overall: 0, raw_overall: 0, deterministic_overall: 80, privateText: 'DO-NOT-PUBLISH' },
    { fixture_id: 'two', status: 'error', overall: null, raw_overall: null, llm_overall: 6.6, deterministic_overall: 100, error: 'DO-NOT-PUBLISH' },
  ];
  const summary = summarizeRows(rows);
  assert.equal(summary.valid, 1); assert.equal(summary.errors, 1);
  assert.deepEqual(summary.availability, { validNumerator: 1, observedDenominator: 2 });
  assert.equal(summary.scores.overall.mean, 0); assert.equal(summary.scores.rawLLM.n, 1);
  assert.equal(summary.scores.deterministic.n, 2); assert.equal(summary.scores.deterministic.mean, 90);
  assert.ok(!JSON.stringify(summary).includes('DO-NOT-PUBLISH'));
});

test('raw-score audit follows original category schema including partial packs', () => {
  assert.equal(checkRawScore(JSON.stringify(raw), { content: 6, style: 7 }).valid, true);
  for (const value of [{}, { ...raw, overall: '0' }, { ...raw, overall: null }, { ...raw, overall: 101 },
    { ...raw, categories: {} }, { ...raw, categories: { secret: category } },
    { ...raw, categories: { content: { ...category, detected: 7 } } },
    { ...raw, categories: { content: { ...category, score: -1 } } },
    { ...raw, categories: { content: { ...category, max: 0 } } },
    { ...raw, categories: { content: { ...category, sum: 19 } } }]) {
    assert.equal(checkRawScore(JSON.stringify(value), { content: 6 }).valid, false);
  }
  assert.deepEqual(checkRawScore('DO-NOT-PUBLISH invalid response', { content: 6 }), { valid: false, reason: 'invalid-json' });
});

test('valid receipt independently binds original logical ID, request, schema, and model', () => {
  const { receipt, call, binding } = receiptCase();
  const original = JSON.stringify(receipt);
  const checked = verifyReceipt(receipt, call, binding);
  assert.equal(checked.valid, true); assert.equal(checked.value.overall, 0); assert.equal(checked.attempts, 1);
  assert.equal(JSON.stringify(receipt), original, 'audit must not rewrite receipts');
});

test('request substitution, nonterminal calls, and false model attestations fail closed', () => {
  const changes = [
    ({ receipt }) => { receipt.state = 'started'; },
    ({ receipt }) => { receipt.promptHash = sha256('substituted'); },
    ({ binding }) => { binding.logicalId = 'different-protocol'; },
    ({ receipt }) => { receipt.response.effectiveModels = ['wrong-model']; },
    ({ receipt, call }) => { receipt.response.effectiveModels = ['wrong-model']; call.effectiveModels = ['wrong-model']; },
    ({ receipt }) => { receipt.transportAttempts[0].effectiveModel = 'wrong-model'; },
    ({ receipt }) => { receipt.transportAttempts[0].requestedModel = 'wrong-model'; },
    ({ call }) => { call.modelIdentityVerified = false; },
    ({ call }) => { call.mixedOrUnexpectedModel = true; },
    ({ call }) => { call.attempts = 0; },
    ({ call }) => { call.schema_valid = false; },
    ({ receipt }) => { receipt.schemaValid = false; },
    ({ receipt }) => { receipt.response.attempts = 3; },
  ];
  for (const change of changes) {
    const data = receiptCase(); change(data);
    assert.throws(() => verifyReceipt(data.receipt, data.call, data.binding), /^Error: scorer-report:/);
  }
});

test('terminal schema and transport errors remain classified failures, never valid zero scores', () => {
  const invalid = receiptCase({ overall: 6.6 }, false);
  const checked = verifyReceipt(invalid.receipt, invalid.call, invalid.binding);
  assert.equal(checked.valid, false); assert.equal(checked.reason, 'invalid-score-schema');
  const transport = receiptCase();
  transport.receipt.state = 'error'; delete transport.receipt.response; delete transport.receipt.schemaValid;
  transport.receipt.transportAttempts[0].outcome = 'error';
  transport.call.transportAttempts[0].outcome = 'error'; transport.call.status = 'error'; transport.call.schema_valid = null;
  assert.deepEqual(verifyReceipt(transport.receipt, transport.call, transport.binding), { valid: false, reason: 'transport-error', attempts: 1 });
});

test('matrix membership requires the full independent candidate × fixture × repeat product', () => {
  const data = matrixCase();
  assert.doesNotThrow(() => verifyMatrix(data.rows, data.expected, data.fixtures, data.spec));
  const changes = [
    (d) => { d.rows.pop(); },
    (d) => { d.rows[1] = clone(d.rows[0]); },
    (d) => { d.rows[0].repeat = 1; },
    (d) => { d.rows[0].protocol_hash = sha256('different protocol'); },
    (d) => { d.rows[0].text_hash = sha256('different input'); },
    (d) => { d.rows[0].expected_hot = !d.rows[0].expected_hot; },
    (d) => { d.rows[0].requested_model = 'invented-model'; },
    (d) => { d.rows[0].transport = 'http'; },
    (d) => { d.expected[0] = d.expected[1]; },
    (d) => { d.rows[0].overall = 101; },
    (d) => { d.rows[0].deterministic_overall = '25'; },
    (d) => { d.rows[0].raw_overall = null; },
    (d) => { d.rows[0].llm_overall = 5; },
    (d) => { d.rows[0].status = 'error'; },
    (d) => { d.rows[0].calls = []; },
  ];
  for (const change of changes) {
    const changed = matrixCase(); change(changed);
    assert.throws(() => verifyMatrix(changed.rows, changed.expected, changed.fixtures, changed.spec), /^Error: scorer-report:/);
  }
});

test('bounded reader rejects traversal, symlinks, oversized input, and source mutations', () => {
  const directory = mkdtempSync(join(tmpdir(), 'scorer-public-reader-'));
  try {
    writeFileSync(join(directory, 'small.json'), '{}');
    const reader = createReader(directory);
    assert.deepEqual(reader.json('small.json'), {});
    assert.throws(() => reader.bytes('../private.json'), /unsafe source path/);
    assert.throws(() => reader.bytes('/private.json'), /unsafe source path/);
    symlinkSync(join(directory, 'small.json'), join(directory, 'link.json'));
    assert.throws(() => reader.bytes('link.json'), /source symlink/);
    writeFileSync(join(directory, 'big.json'), ''); truncateSync(join(directory, 'big.json'), 8 * 1024 * 1024 + 1);
    assert.throws(() => reader.bytes('big.json'), /source size bound/);
    writeFileSync(join(directory, 'small.json'), '[]');
    assert.throws(() => reader.verifyUnchanged(), /source changed during publication/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('CLI has an explicit offline interface and never echoes unknown argument contents', () => {
  assert.throws(() => main(['--api-key', 'DO-NOT-PUBLISH']), (error) => error.message === 'scorer-report: invalid argument');
  assert.throws(() => main(['--write', '--check']), /required sources or conflicting mode/);
  const output = execFileSync(process.execPath, ['scripts/research/publish-scorer-report.mjs', '--help'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(output, /offline only/); assert.doesNotMatch(output, /--live|--api-key/);
});

test('public artifact reproduces Markdown and preserves scoped acceptance and original protocols', () => {
  const report = JSON.parse(readFileSync(publicJson, 'utf8'));
  assert.equal(renderReport(report), readFileSync(publicMarkdown, 'utf8'));
  assert.deepEqual(report.totals, { datasets: 6, candidates: 11, uniqueFixtures: 49, observed: 931, valid: 930, errors: 1 });
  assert.equal(report.datasets.length, DATASETS.length);
  for (const spec of DATASETS) {
    const dataset = report.datasets.find((item) => item.id === spec.id);
    assert.equal(dataset.protocolHash, spec.protocolHash);
    assert.equal(dataset.collection.expected, spec.candidates.length * 49 * spec.repeat);
    assert.equal(dataset.collection.missing, 0);
    assert.equal(dataset.collection.observed, dataset.collection.valid + dataset.collection.errors);
    assert.equal(dataset.collection.calls, dataset.provenance.receiptCount);
    assert.equal(dataset.collection.transportAttempts, dataset.collection.calls);
    assert.equal(dataset.provenance.protocolRecomputed, false);
    assert.equal(dataset.provenance.fullScorerReplay, false);
    for (const field of ['receiptManifestSha256', 'requestHashesSha256', 'promptHashesSha256', 'fixtureIdentitySha256']) assert.match(dataset.provenance[field], /^[a-f0-9]{64}$/);
    for (const hash of Object.values(dataset.provenance.artifacts)) assert.match(hash, /^[a-f0-9]{64}$/);
  }
  assert.match(report.acceptance.closure, /Partial evidence/);
  assert.ok(report.acceptance.gaps.some((gap) => gap.includes('rebaseline')));
  assert.ok(report.limitations.some((limit) => limit.includes('not authenticated real-world')));
  assert.ok(report.limitations.some((limit) => limit.includes('not independently replayed')));
});

test('public distribution denominators balance by language, pack, control, and repeat', () => {
  const report = JSON.parse(readFileSync(publicJson, 'utf8'));
  for (const dataset of report.datasets) for (const candidate of dataset.candidates) {
    assert.equal(candidate.scores.overall.n, candidate.valid);
    assert.equal(candidate.scores.rawLLM.n, candidate.valid);
    assert.equal(candidate.scores.deterministic.n, candidate.observed);
    for (const grouping of [Object.values(candidate.byLanguage), Object.values(candidate.byFixtureControl), candidate.byRepeat]) {
      assert.equal(grouping.reduce((n, slice) => n + slice.observed, 0), candidate.observed);
      assert.equal(grouping.reduce((n, slice) => n + slice.valid, 0), candidate.valid);
    }
    assert.equal(Object.keys(candidate.byPatternPack).length, 28);
    for (const [pack, slice] of Object.entries(candidate.byPatternPack)) {
      assert.equal(slice.validRows, candidate.byLanguage[pack.split('/')[0]].valid);
      assert.equal(slice.score.n + slice.missing, slice.validRows);
    }
    if (dataset.repeat === 2) assert.equal(candidate.pairedRepeatAbsoluteDifference.pairs, 49);
    else assert.equal(candidate.pairedRepeatAbsoluteDifference, null);
  }
});

test('published JSON is summaries and integrity commitments, without private row or receipt bodies', () => {
  const source = readFileSync(publicJson, 'utf8');
  const report = JSON.parse(source);
  const forbiddenKeys = new Set(['text', 'prompt', 'response', 'raw', 'rationale', 'apiKey', 'apiKeyEnv', 'baseURL', 'usage', 'owner', 'pid', 'args', 'fixture_id', 'text_hash', 'requestHash', 'promptHash']);
  function walk(value) {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) { assert.ok(!forbiddenKeys.has(key), key); walk(nested); }
  }
  walk(report);
  assert.doesNotMatch(source, /\/home\/|\/tmp\/|Bearer |sk-[A-Za-z0-9]{10}|PRIVATE KEY/);
  for (const dataset of report.datasets) {
    assert.deepEqual(Object.keys(dataset.provenance.effectiveInputs).sort(), ['configuration', 'lexicons', 'patterns', 'sourceVoice', 'structuralModels']);
    assert.ok(dataset.candidates.every((candidate) => ['openai', 'gemini'].includes(candidate.provider)));
  }
});

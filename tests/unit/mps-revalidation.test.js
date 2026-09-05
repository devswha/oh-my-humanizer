import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRawMps } from '../../scripts/research/study-validation.mjs';
import { bindReceipt, checkParity, classifyMps, createEvidenceReader, rankSummary, renderCorrection, replayBoundJudgment, sha256 } from '../../scripts/research/revalidate-mps-evidence.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const clone = (value) => JSON.parse(JSON.stringify(value));
// Synthetic legacy cases describe the old bug, not new empirical observations.
function legacyValidator(text) {
  const row = JSON.parse(text), anchors = row.anchors;
  const passed = anchors.filter((anchor) => anchor.verdict === 'PASS').length;
  const polarity = anchors.filter((anchor) => anchor.type === 'polarity');
  const polarityPass = polarity.filter((anchor) => anchor.verdict === 'PASS').length;
  if (row.pass_count !== passed || row.total_count !== anchors.length || row.polarity_pass_count !== polarityPass
    || row.polarity_total_count !== polarity.length) throw new Error('inconsistent-mps-counts');
  const passRate = anchors.length ? passed / anchors.length : 1;
  const expected = polarity.length ? (passRate * .6 + polarityPass / polarity.length * .4) * 100 : passRate * 100;
  if (Math.abs(row.mps - expected) > .11) throw new Error('inconsistent-mps-score');
  return { ...row, hard_fail_count: anchors.filter((anchor) => anchor.verdict === 'HARD_FAIL').length };
}

const claim = { anchors: [{ type: 'claim', content: 'Synthetic fact', verdict: 'PASS' }], pass_count: 1,
  total_count: 1, polarity_pass_count: 0, polarity_total_count: 0, mps: 100 };
const oldOnly = { ...claim, anchors: [{ type: 'negation', content: 'Synthetic negative claim', verdict: 'PASS' }] };
const canonicalOnly = { ...oldOnly, polarity_pass_count: 1, polarity_total_count: 1 };
const invalidBoth = { ...canonicalOnly, total_count: 2 };

test('all four transitions are checked, including previously rejected canonical responses', () => {
  for (const [raw, oldValid, transition] of [
    [claim, true, 'valid->valid'], [oldOnly, true, 'valid->invalid'],
    [canonicalOnly, false, 'invalid->valid'], [invalidBoth, false, 'invalid->invalid'],
  ]) {
    const text = JSON.stringify(raw);
    const result = classifyMps(text, oldValid, legacyValidator);
    assert.equal(result.transition, transition);
    assert.equal(result.selfReported.mps, raw.mps);
    assert.equal(result.selfReported.polarity_total_count, raw.polarity_total_count);
    assert.equal(result.acceptedMps, result.correctedSchemaValid ? 100 : null);
    assert.equal(text, JSON.stringify(raw));
  }
  assert.throws(() => classifyMps(JSON.stringify(oldOnly), false, legacyValidator), /historical MPS flag differs/);
});

test('corrected validator never repairs reported scores or counts', () => {
  const brokenScore = { anchors: [claim.anchors[0], { type: 'negation', content: 'Synthetic prohibition', verdict: 'HARD_FAIL' }],
    pass_count: 1, total_count: 2, polarity_pass_count: 0, polarity_total_count: 1, mps: 50 };
  const bytes = JSON.stringify(brokenScore);
  let seen;
  const result = classifyMps(bytes, false, legacyValidator, (text) => { seen = text; return validateRawMps(text); });
  assert.equal(seen, bytes);
  assert.equal(result.rejection, 'inconsistent-mps-score');
  assert.equal(result.acceptedMps, null);
  assert.equal(result.selfReported.mps, 50, 'canonical arithmetic would be 30, but must not replace the response');
  assert.equal(classifyMps(JSON.stringify(oldOnly), true, legacyValidator).rejection, 'inconsistent-mps-counts');
});

function synthetic(raw = oldOnly) {
  const fixture = { fixture_id: 'synthetic-fixture', text: 'Synthetic source.', language: 'en' };
  const generation = { candidate_id: 'synthetic-generator', fixture_id: fixture.fixture_id, repeat: 0, rewrite: 'Synthetic rewrite.' };
  const judge = { id: 'synthetic-judge', model: 'test-model', provider: 'test-provider', transport: 'opencodex' };
  const protocol = sha256('synthetic-protocol');
  const logicalId = `${protocol}/${generation.candidate_id}/${fixture.fixture_id}/0/judge/${judge.id}`;
  const stages = ['mps', 'fidelity', 'naturalness'];
  const texts = [JSON.stringify(raw), '{"claims_preserved":3,"no_fabrication":3,"audience_register_match":3}', '{"naturalness":3}'];
  const flag = (validator) => { try { validator(texts[0]); return true; } catch { return false; } };
  const make = (validator) => {
    const valid = flag(validator);
    return { status: valid ? 'ok' : 'error', error: valid ? null : 'judge-schema-failure', mps: raw.mps,
      fidelity: 100, naturalness: 3, hard_fail_count: valid ? 0 : null,
      private_details: { anchors: raw.anchors },
      calls: stages.map((stage) => ({ stage, schema_valid: stage === 'mps' ? valid : true })) };
  };
  const historical = make(legacyValidator);
  const row = { ...generation, protocol_hash: protocol, judge_id: judge.id, ...historical };
  delete row.private_details;
  const entries = texts.map((text, i) => {
    const identity = { logicalId, index: i + 1, candidate: judge, promptHash: sha256(`synthetic-${stages[i]}-prompt`),
      temperature: .1, responseFormat: null, extraBody: null };
    return { receipt: { schemaVersion: 1, state: 'completed', promptHash: identity.promptHash, requestHash: sha256(identity),
      temperature: .1, schemaValid: historical.calls[i].schema_valid, transportAttempts: [], response: { text } } };
  });
  const runner = (validator) => async (_fixture, _generation, candidate, { complete }) => {
    for (const stage of stages) await complete(candidate, `synthetic-${stage}-prompt`, { temperature: .1 });
    return make(validator);
  };
  return { row, stored: { ...row, private_details: historical.private_details }, fixture, generation, judge, entries,
    originalRuntime: { rewrite: { judgeRewrite: runner(legacyValidator) }, validation: { validateRawMps: legacyValidator } },
    correctedRun: runner(validateRawMps), correctedValidator: validateRawMps };
}

test('paired replay preserves source evidence while deriving both directions of change', async () => {
  for (const [raw, status] of [[oldOnly, 'error'], [canonicalOnly, 'ok']]) {
    const data = synthetic(raw), original = JSON.stringify(data.entries), oldRow = JSON.stringify(data.row);
    const result = await replayBoundJudgment(data);
    assert.equal(result.corrected.status, status);
    assert.equal(result.corrected.mps, 100);
    assert.equal(result.mpsResponses.length, 1);
    assert.equal(JSON.stringify(data.entries), original);
    assert.equal(JSON.stringify(data.row), oldRow);
  }
});

test('replay rejects prompt, request, stage, outcome, and non-MPS substitutions', async () => {
  const changes = [
    (data) => { data.entries[0].receipt.promptHash = sha256('wrong prompt'); },
    (data) => { data.entries[0].receipt.requestHash = sha256('wrong request'); },
    (data) => { data.entries[1].receipt.state = 'started'; },
    (data) => { data.entries.pop(); },
    (data) => { data.row.calls[0].stage = 'fidelity'; },
    (data) => { data.row.mps = 99; },
    (data) => { data.stored.private_details = {}; },
    (data) => {
      const original = data.correctedRun;
      data.correctedRun = async (...args) => { const value = await original(...args); value.calls[1].schema_valid = false; return value; };
    },
    (data) => {
      const original = data.correctedRun;
      data.correctedRun = async (...args) => { const value = await original(...args); value.mps = 30; return value; };
    },
  ];
  for (const change of changes) {
    const data = synthetic(); change(data);
    await assert.rejects(replayBoundJudgment(data), /^Error: mps-revalidation:/);
  }
});

test('receipt identity retains original protocol, ordinal, candidate, and request options', () => {
  const data = synthetic(), receipt = data.entries[0].receipt;
  const binding = { logicalId: `${data.row.protocol_hash}/synthetic-generator/synthetic-fixture/0/judge/synthetic-judge`,
    index: 1, candidate: data.judge, promptHash: receipt.promptHash, temperature: .1 };
  assert.doesNotThrow(() => bindReceipt(receipt, binding));
  for (const patch of [{ logicalId: 'new-derived-protocol' }, { index: 2 }, { temperature: 0 },
    { candidate: { ...data.judge, model: 'different-model' } }, { extraBody: { reasoning_effort: 'high' } }]) {
    assert.throws(() => bindReceipt(receipt, { ...binding, ...patch }), /request\/prompt binding differs/);
  }
});

test('public/private parity checks rejected rows too, with exact membership', () => {
  const rows = [synthetic().row, { ...synthetic(canonicalOnly).row, fixture_id: 'second' }];
  const privateRows = rows.map((row) => ({ ...clone(row), private_details: { secret: 'not-public' } }));
  assert.equal(checkParity(rows, privateRows, 'private_details').size, 2);
  privateRows[0].mps = 20;
  assert.throws(() => checkParity(rows, privateRows, 'private_details'), /row differs/);
  assert.throws(() => checkParity(rows, [privateRows[1], privateRows[1]], 'private_details'), /matrix differs/);
});

test('rank comparison retains safety/naturalness/latency ordering and blocks incomplete joins', () => {
  const row = (rate, naturalness, latency) => ({ attempted: 12, safe: rate * 12, safe_rate: rate,
    judge_errors: 0, pending_judgments: 0, naturalness: { median: naturalness }, generation_latency_ms: { median: latency } });
  const summary = { a: row(.5, 3, 10), b: row(.75, 2, 20), c: row(.5, 4, 30), d: row(.5, 4, 20) };
  assert.deepEqual(rankSummary(summary).map((row) => row.id), ['b', 'd', 'c', 'a']);
  summary.a.pending_judgments = 1;
  assert.throws(() => rankSummary(summary), /pending judgments/);
});

test('read-only evidence reader bounds input and rejects source changes or symlink escapes', () => {
  const root = mkdtempSync(join(tmpdir(), 'mps-revalidation-'));
  try {
    writeFileSync(join(root, 'data.json'), '{}'); const reader = createEvidenceReader(root);
    assert.deepEqual(reader.json('data.json'), {});
    assert.throws(() => reader.bytes('../secret'), /unsafe evidence path/);
    symlinkSync(join(root, 'data.json'), join(root, 'link.json'));
    assert.throws(() => reader.bytes('link.json'), /evidence symlink/);
    writeFileSync(join(root, 'huge.json'), ''); truncateSync(join(root, 'huge.json'), 16 * 1024 * 1024 + 1);
    assert.throws(() => reader.bytes('huge.json'), /evidence size bound/);
    writeFileSync(join(root, 'data.json'), '[]');
    assert.throws(() => reader.unchanged(), /evidence changed/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI exposes independent corrected source and cannot start a live run', () => {
  const help = execFileSync(process.execPath, ['scripts/research/revalidate-mps-evidence.mjs', '--help'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(help, /--validation-source DIR --validation-commit COMMIT/);
  assert.match(help, /offline only/); assert.doesNotMatch(help, /--live/);
  assert.throws(() => execFileSync(process.execPath, ['scripts/research/revalidate-mps-evidence.mjs', '--api-key', 'do-not-echo'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }),
    (error) => error.stderr.trim() === 'mps-revalidation: invalid argument');
});

test('public correction balances all observations and reproduces its Markdown', () => {
  const report = JSON.parse(readFileSync(resolve(ROOT, 'docs/research/mps-validation-correction-20260905.json')));
  assert.equal(renderCorrection(report), readFileSync(resolve(ROOT, 'docs/research/mps-validation-correction-20260905.md'), 'utf8'));
  assert.equal(report.totals.generations, 192); assert.equal(report.totals.judgments, 384);
  assert.equal(report.totals.judgmentReceipts, 1152); assert.equal(report.totals.generationReceipts, 192);
  assert.equal(Object.values(report.totals.statusTransitions).reduce((a, b) => a + b), 384);
  assert.equal(report.totals.statusTransitions['valid->valid'] + report.totals.statusTransitions['valid->invalid'], report.totals.originalValid);
  assert.equal(report.totals.statusTransitions['valid->valid'] + report.totals.statusTransitions['invalid->valid'], report.totals.correctedValid);
  assert.match(report.derivationProtocolHash, /^[a-f0-9]{64}$/); assert.match(report.privateLedgerSha256, /^[a-f0-9]{64}$/);
  for (const screen of report.screens) {
    assert.equal(screen.judgments, screen.generations * 2);
    assert.equal(screen.correctedRanks.reduce((n, row) => n + row.attempted, 0), screen.generations);
    assert.deepEqual(screen.newTopTwo, screen.correctedRanks.slice(0, 2).map((row) => row.id));
    assert.ok(screen.provenance.judgments.every((dataset) => /^[a-f0-9]{64}$/.test(dataset.originalProtocolHash)));
  }
});

test('public report excludes bodies, private rows, and claims of upstream authentication', () => {
  const bytes = readFileSync(resolve(ROOT, 'docs/research/mps-validation-correction-20260905.json'), 'utf8');
  const report = JSON.parse(bytes);
  const forbidden = new Set(['text', 'rewrite', 'anchors', 'rationale', 'private_details', 'response', 'calls', 'apiKey', 'authorization', 'original']);
  function walk(value) {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { assert.ok(!forbidden.has(key), key); walk(child); }
  }
  walk(report);
  assert.doesNotMatch(bytes, /\/home\/|Bearer |PRIVATE KEY/);
  assert.ok(report.limits.some((value) => value.includes('echoes the requested alias')));
  assert.ok(report.limits.some((value) => value.includes('not proof of upstream')));
  assert.ok(report.limits.some((value) => value.includes('active D/E jobs')));
});

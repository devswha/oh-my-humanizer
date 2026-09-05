import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLexicon } from '../../src/features/lexicon.js';
import { hash, collectRebaselineScores, replayCollection, loadNullableIntake, persistPrivate, boundedCompletion, main } from '../../scripts/research/collect-rebaseline-scores.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value;
const canonical = value => hash(sort(value));
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const write = (path, value) => fs.writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
const paths = root => fs.readdirSync(root, { withFileTypes: true }).flatMap(item => item.isDirectory() ? paths(resolve(root, item.name)) : [resolve(root, item.name)]);
const candidate = { id: 'unit-collector', provider: 'openai', transport: 'opencodex', baseURL: 'http://127.0.0.1:10100/v1', model: 'unit-test-model' };
function setup(t, count = 1) {
  const root = fs.mkdtempSync(resolve(tmpdir(), 'patina-rebaseline-collector-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const intake = resolve(root, 'intake'); fs.mkdirSync(resolve(intake, 'evidence'), { recursive: true, mode: 0o700 });
  const records = Array.from({ length: count }, (_, i) => {
    const text = `The train leaves at noon. I packed ${i + 1} bag for the trip.`;
    return { id: `unit-${i}`, text, textHash: hash(text), language: 'en', documentType: 'default', register: 'source-declared',
      origins: [{ kind: 'unknown', evidenceHash: hash('unit evidence') }], originKind: 'unknown',
      expected_hot: null, labels: { generator: null, humanQuality: null, expected_short_form_tells: null },
      rights: { status: 'needs-review', sharing: 'private' }, eligibleForClaims: false };
  });
  const sourceIndex = { 'unit-evidence': { sha256: hash('unit evidence'), bytes: Buffer.byteLength('unit evidence') } };
  const data = { records, excluded: [], counts: { retained: records.length } };
  fs.writeFileSync(resolve(intake, 'evidence', hash('unit evidence')), 'unit evidence', { mode: 0o600 });
  write(resolve(intake, 'intake.private.json'), data); write(resolve(intake, 'source-index.private.json'), sourceIndex);
  write(resolve(intake, 'summary.json'), { intakeHash: canonical(data), manifestHash: canonical(records) });
  const protocol = resolve(root, 'protocol.json'); write(protocol, { schemaVersion: 1, candidates: [candidate] });
  const approvals = resolve(root, 'approval.private.json');
  const approval = { schemaVersion: 1, intakeHash: canonical(data), candidateHash: hash(candidate), decisions: records.map(record => ({
    textHash: record.textHash, sourceEvidenceHash: canonical(record.origins), decision: 'approved', reviewer: 'unit-test-only', reviewedAt: '2026-09-05T00:00:00Z',
    provider: candidate.provider, transport: candidate.transport, model: candidate.model, permittedLocalAnalysis: true, permittedProviderProcessing: true,
    retention: 'private-only', publication: 'summary-only' })) };
  write(approvals, approval);
  return { root, records, approval, options: { intake, protocol, protocolSha256: hash(fs.readFileSync(protocol)), candidateId: candidate.id,
    config: resolve(ROOT, '.patina.default.yaml'), approvals, output: resolve(root, 'output'), maxCalls: count * 2, timeoutMs: 60000, live: true } };
}
const valid = (model = candidate.model, overall = 5) => ({ text: JSON.stringify({ overall, categories: { content: { detected: 0, sum: 0, max: 30, score: 0, weighted: 0 } } }),
  effectiveModels: [model], usage: { prompt_tokens: 10, completion_tokens: 10 }, attempts: 1, durationMs: 2 });

function resume(options, live = true) { return { output: options.output, resume: true, live }; }

test('nullable intake verifies bytes and evidence without inventing human or generator labels', t => {
  const { options, records } = setup(t);
  const bundle = loadNullableIntake(options.intake);
  assert.deepEqual(bundle.intake.records[0].labels, records[0].labels);
  assert.equal(bundle.intake.records[0].expected_hot, null);
  fs.writeFileSync(resolve(options.intake, 'evidence', hash('unit evidence')), 'changed');
  assert.throws(() => loadNullableIntake(options.intake), /evidence mismatch/);
});

test('no opt-in means no call; snapshots preserve exact private inputs and loaded resources', async t => {
  const { options, records } = setup(t);
  const report = await collectRebaselineScores({ ...options, live: false }, { complete: async () => assert.fail('not opted in') });
  assert.equal(report.attempted, 0);
  const snapshot = read(resolve(options.output, 'snapshot.private.json'));
  assert.deepEqual(snapshot.records, records);
  assert.equal(snapshot.inputs.configSource.ambientOverrides, false);
  assert.ok(snapshot.prompts[records[0].textHash].includes(records[0].text));
  assert.deepEqual(snapshot.inputs.lexicons.en, JSON.parse(JSON.stringify(loadLexicon('en', ROOT))));
  assert.ok(snapshot.inputs.prepared[records[0].textHash].deterministicScore.bands);
  assert.equal(fs.readFileSync(resolve(options.output, '.gitignore'), 'utf8'), '*\n');
  for (const path of paths(options.output)) assert.equal(fs.statSync(path).mode & 0o777, 0o600);
});

test('missing, unknown, denied and route-mismatched approvals never dispatch', async t => {
  for (const variant of ['missing', 'unknown', 'blocked', 'wrong-route', 'wrong-evidence']) {
    const { options, approval } = setup(t);
    if (variant === 'missing') fs.unlinkSync(options.approvals);
    else {
      if (['unknown', 'blocked'].includes(variant)) { approval.decisions[0].decision = variant; options.maxCalls = 0; }
      if (variant === 'wrong-route') approval.decisions[0].model = 'another-model';
      if (variant === 'wrong-evidence') approval.decisions[0].sourceEvidenceHash = hash('other evidence');
      write(options.approvals, approval);
    }
    await assert.rejects(collectRebaselineScores(options, { complete: async () => assert.fail('unapproved processing') }));
  }
});

test('mixed admission freezes the full denominator and preserves nullable labels', async t => {
  const { options, approval, records } = setup(t, 2);
  approval.decisions[1].decision = 'unknown'; options.maxCalls = 2; write(options.approvals, approval);
  let calls = 0;
  const report = await collectRebaselineScores(options, { complete: async () => { calls++; return valid(); } });
  assert.equal(calls, 1); assert.equal(report.denominator, 2); assert.equal(report.approved, 1); assert.equal(report.excluded, 1);
  const row = read(resolve(options.output, 'rows', `${records[0].textHash}.private.json`));
  assert.equal(row.expected_hot, null); assert.equal(row.class, null);
  assert.ok(row.productionResult.llmScore); assert.ok(row.productionResult.deterministicScore);
  assert.equal(report.classificationMetrics, null);
  assert.doesNotMatch(JSON.stringify(report), /\b(?:FNR|FPR|AUC|accuracy|precision|recall)\b/i);
  assert.ok(report.languages.en.packs.content);
  assert.equal(report.languages.en.packs['viral-hook'].missing, 1);
});

test('completed observations replay offline byte-for-byte; resume never pays for them again', async t => {
  const { options } = setup(t, 2); let calls = 0;
  await collectRebaselineScores(options, { complete: async () => { calls++; return valid(); } });
  assert.equal(calls, 2);
  const before = Object.fromEntries(paths(options.output).map(path => [path, hash(fs.readFileSync(path))]));
  const replay = await replayCollection(options.output);
  assert.equal(replay.fullObservedReplay, true); assert.equal(replay.attempted, 2);
  assert.deepEqual(Object.fromEntries(paths(options.output).map(path => [path, hash(fs.readFileSync(path))])), before);
  await collectRebaselineScores(resume(options), { complete: async () => assert.fail('already paid') });
});

test('production JSON retry is retained, while valid-JSON schema failure is a separate missing score', async t => {
  const { options } = setup(t, 2); const temperatures = [];
  const report = await collectRebaselineScores(options, { complete: async (_candidate, _prompt, args) => {
    temperatures.push(args.temperature);
    if (temperatures.length === 1) return { ...valid(), text: 'not JSON' };
    if (temperatures.length === 3) return { ...valid(), text: JSON.stringify({ overall: 0, categories: { content: { detected: 999, sum: 0, max: 1, score: 0, weighted: 0 } } }) };
    return valid();
  } });
  assert.deepEqual(temperatures, [.1, 0, .1]);
  assert.equal(report.valid, 1); assert.equal(report.errors, 1); assert.equal(report.distributions.rawLlm.n, 1);
  assert.equal(report.errorClasses['score-schema-failure'], 1);
  assert.equal((await replayCollection(options.output)).fullObservedReplay, true);
});

test('transport failures remain errors and missing scores, with no transport retry', async t => {
  const { options } = setup(t); let calls = 0;
  const report = await collectRebaselineScores(options, { complete: async () => { calls++; throw new Error('HTTP 429'); } });
  assert.equal(calls, 1); assert.equal(report.valid, 0); assert.equal(report.distributions.overall.n, 0);
  assert.equal(report.errorClasses['provider-rate-limited (HTTP 429)'], 1);
  assert.equal((await replayCollection(options.output)).fullObservedReplay, true);
});

test('snapshot/row/receipt changes and missing parser receipts reject before any resumed paid call', async t => {
  for (const variant of ['snapshot', 'row', 'wire', 'missing-parser-call']) {
    const { options, records } = setup(t); let count = 0;
    await collectRebaselineScores(options, { complete: async () => (++count === 1 && variant === 'missing-parser-call' ? { ...valid(), text: 'malformed' } : valid()) });
    if (variant === 'snapshot') {
      const path = resolve(options.output, 'snapshot.private.json'), data = read(path); data.inputs.config.language = 'zh'; write(path, data);
    } else if (variant === 'row') {
      const path = resolve(options.output, 'rows', `${records[0].textHash}.private.json`), data = read(path); data.overall = 99; write(path, data);
    } else if (variant === 'wire') {
      const path = paths(resolve(options.output, 'wire'))[0], data = read(path); data.response.text = '{}'; write(path, data);
    } else {
      for (const kind of ['calls', 'wire']) for (const path of paths(resolve(options.output, kind)).filter(path => path.endsWith('2.private.json'))) fs.unlinkSync(path);
      const progressPath = resolve(options.output, 'progress.private.json'), progress = read(progressPath);
      progress.entries[records[0].textHash] = { state: 'started' }; write(progressPath, progress);
      fs.unlinkSync(resolve(options.output, 'rows', `${records[0].textHash}.private.json`));
    }
    await assert.rejects(collectRebaselineScores(resume(options), { complete: async () => assert.fail('unrecorded paid replay') }));
  }
});

test('persistence failure before dispatch pays nothing; after dispatch it stops and blocks paid resume', async t => {
  for (const phase of ['started', 'completed']) {
    const { options } = setup(t, 2); let calls = 0;
    await assert.rejects(collectRebaselineScores(options, {
      complete: async () => { calls++; return valid(); },
      persist: (path, value) => { if (path.includes('/wire/') && value.state === phase) throw new Error('disk full'); persistPrivate(path, value); },
    }), /persistence/);
    assert.equal(calls, phase === 'started' ? 0 : 1);
    await assert.rejects(collectRebaselineScores(resume(options), { complete: async () => assert.fail('unresolved paid call') }));
  }
});

test('completed paid receipts can recover a missing row offline after row persistence failure', async t => {
  const { options } = setup(t); let calls = 0;
  await assert.rejects(collectRebaselineScores(options, { complete: async () => { calls++; return valid(); },
    persist: (path, value) => { if (path.includes('/rows/')) throw new Error('disk full'); persistPrivate(path, value); } }), /persistence/);
  const report = await collectRebaselineScores(resume(options), { complete: async () => assert.fail('recovery must use receipts') });
  assert.equal(calls, 1); assert.equal(report.valid, 1);
});

test('secrets reject preparation or response capture; no redacted full-replay claim', async t => {
  const secret = 'sk-' + 'x'.repeat(32);
  const a = setup(t); a.options.config = resolve(a.root, 'secret.yaml'); fs.writeFileSync(a.options.config, `api_key: ${secret}\n`);
  await assert.rejects(collectRebaselineScores(a.options, { complete: async () => assert.fail('secret config') }), /secret/);
  const b = setup(t); let calls = 0;
  await assert.rejects(collectRebaselineScores(b.options, { complete: async () => { calls++; return { ...valid(), text: secret }; } }), /rejected/);
  assert.equal(calls, 1);
  for (const path of paths(b.options.output)) assert.ok(!fs.readFileSync(path, 'utf8').includes(secret));
  await assert.rejects(replayCollection(b.options.output));
});

test('Gemini direct API candidates, protocol drift, unknown CLI flags and unsafe output paths reject', async t => {
  const { options } = setup(t);
  write(options.protocol, { candidates: [{ ...candidate, provider: 'gemini', model: 'gemini-unit', transport: 'http', baseURL: 'https://example.invalid', apiKeyEnv: 'GEMINI_API_KEY' }] });
  await assert.rejects(collectRebaselineScores(options), /protocol hash/);
  options.protocolSha256 = hash(fs.readFileSync(options.protocol));
  await assert.rejects(collectRebaselineScores(options), /OpenCodex/);
  await assert.rejects(main(['--output', options.output, '--env-file', 'forbidden']), /unknown/);
  const b = setup(t); fs.symlinkSync(b.root, b.options.output);
  await assert.rejects(collectRebaselineScores(b.options), /symlink/);
});

test('the bounded HTTP path sends once even for temperature rejection and captures credential-free bodies', async t => {
  const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous; });
  let calls = 0, observed;
  globalThis.fetch = async (_url, options) => {
    calls++; assert.equal(options.redirect, 'error');
    return new Response('temperature is unsupported', { status: 400 });
  };
  await assert.rejects(boundedCompletion(candidate, 'unit prompt', { temperature: .1, timeoutMs: 1000 }, value => { observed = value; }), /HTTP 400/);
  assert.equal(calls, 1); assert.equal(observed.httpStatus, 400);
  assert.equal(observed.requestBody.temperature, .1);
  assert.ok(!JSON.stringify(observed).includes('Authorization'));
});

test('opt-in is boolean and the bound includes every production parser invocation', async t => {
  const a = setup(t);
  const report = await collectRebaselineScores({ ...a.options, live: 'false' }, { complete: async () => assert.fail('string is not opt-in') });
  assert.equal(report.attempted, 0);
  const b = setup(t);
  await assert.rejects(collectRebaselineScores({ ...b.options, maxCalls: 3 }, { complete: async () => assert.fail('oversized budget') }), /call bound/);
  let calls = 0;
  await assert.rejects(collectRebaselineScores({ ...b.options, maxCalls: 1 }, { complete: async () => { calls++; return { ...valid(), text: 'malformed' }; } }), /budget exhausted/);
  assert.equal(calls, 1);
  await assert.rejects(collectRebaselineScores(resume(b.options), { complete: async () => assert.fail('budget cannot grow on resume') }));
});

test('observed partial error metadata survives replay without a new invocation', async t => {
  const { options } = setup(t);
  const report = await collectRebaselineScores(options, { complete: async () => {
    const error = new Error('CLI failed');
    error.studyResult = { effectiveModels: [], identityEvidence: 'unverified', usage: { prompt_tokens: 9, completion_tokens: 0 }, attempts: 1 };
    throw error;
  } });
  assert.equal(report.errors, 1);
  const replay = await replayCollection(options.output);
  assert.equal(replay.fullObservedReplay, true);
});

test('native profile admission remains distinct from server model verification', async t => {
  const { options, approval, records } = setup(t);
  const native = { id: 'unit-native', provider: 'kimi', transport: 'kimi-cli', model: 'kimi-code/kimi-for-coding' };
  write(options.protocol, { schemaVersion: 1, candidates: [native] });
  options.protocolSha256 = hash(fs.readFileSync(options.protocol)); options.candidateId = native.id;
  approval.candidateHash = hash(native);
  Object.assign(approval.decisions[0], { provider: native.provider, transport: native.transport, model: native.model });
  write(options.approvals, approval);
  const report = await collectRebaselineScores(options, { complete: async selected => {
    assert.deepEqual(selected, native);
    return { ...valid(native.model), identityEvidence: 'cli-request-trace', usageEvidence: 'cli-session-trace', effectiveTemperature: null };
  } });
  assert.equal(report.valid, 1);
  const row = read(resolve(options.output, 'rows', `${records[0].textHash}.private.json`));
  assert.equal(row.calls[0].profileIdentityVerified, true);
  assert.equal(row.calls[0].modelIdentityVerified, false);
  const snapshot = read(resolve(options.output, 'snapshot.private.json'));
  assert.equal(snapshot.budgetUnit, 'CLI-invocation');
  assert.equal(snapshot.nativeUpstreamAttemptCountVerified, false);
  assert.equal((await replayCollection(options.output)).fullObservedReplay, true);
});

test('dataset genre and delivery register remain separate; source labels never label new targets', async t => {
  const { options, records, approval, root } = setup(t, 4);
  const genres = ['social', 'marketing', 'chat-update', 'chat-update'];
  const documentTypes = ['social', 'marketing', undefined, 'casual-conversation'];
  records.forEach((record, i) => {
    record.register = genres[i];
    if (documentTypes[i]) record.documentType = documentTypes[i]; else delete record.documentType;
    record.labels.registerStatus = 'source-declared-unreviewed';
    record.expected_hot = i % 2 === 0; record.class = i % 2 === 0 ? 'ai' : 'natural';
    record.origins[0].originalFixtureExpectedHot = true;
    approval.decisions[i].sourceEvidenceHash = canonical(record.origins);
  });
  const intake = read(resolve(options.intake, 'intake.private.json')); intake.records = records;
  write(resolve(options.intake, 'intake.private.json'), intake);
  const summary = read(resolve(options.intake, 'summary.json'));
  summary.intakeHash = canonical(intake); summary.manifestHash = canonical(records);
  write(resolve(options.intake, 'summary.json'), summary);
  approval.intakeHash = summary.intakeHash; write(options.approvals, approval);
  const config = fs.readFileSync(options.config, 'utf8').replace(/^register:.*$/m, 'register: professional');
  options.config = resolve(root, 'pinned-delivery-register.yaml'); fs.writeFileSync(options.config, config);
  const report = await collectRebaselineScores(options, { complete: async () => valid() });
  assert.equal(report.valid, 4); assert.equal(report.classificationMetrics, null);
  const snapshot = read(resolve(options.output, 'snapshot.private.json'));
  assert.ok(Object.values(snapshot.targetLabels).every(value => value === null));
  assert.deepEqual(snapshot.records.map(record => record.expected_hot), [true, false, true, false]);
  records.forEach((record, i) => {
    const row = read(resolve(options.output, 'rows', `${record.textHash}.private.json`));
    assert.equal(row.register, 'professional');
    assert.equal(row.datasetGenre.value, genres[i]);
    assert.equal(row.datasetGenre.reviewStatus, 'source-declared-unreviewed');
    assert.equal(row.expected_hot, null); assert.equal(row.class, null);
    assert.equal(row.documentTypeSelection.value, documentTypes[i] ?? 'default');
    assert.equal(row.documentTypeSelection.source, documentTypes[i] ? 'intake.documentType' : 'pinned-config');
    assert.equal(row.documentTypeSelection.inferredFromGenreByCollector, false);
    assert.equal(snapshot.inputs.prepared[record.textHash].config.register, 'professional');
  });
  assert.equal((await replayCollection(options.output)).fullObservedReplay, true);
});

test('a dataset genre in pinned config.register is rejected instead of treated as delivery register', async t => {
  const { options, root } = setup(t);
  const config = fs.readFileSync(options.config, 'utf8').replace(/^register:.*$/m, 'register: marketing');
  options.config = resolve(root, 'invalid-register.yaml'); fs.writeFileSync(options.config, config);
  await assert.rejects(collectRebaselineScores(options, { complete: async () => assert.fail('invalid register cannot dispatch') }), /delivery-register axis/);
});

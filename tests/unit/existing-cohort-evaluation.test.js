import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadParentCohort, evaluateExisting } from '../../scripts/research/evaluate-existing-rewrites.mjs';
import { textHash } from '../quality/live-scorer-benchmark.mjs';
import { judgeRewrite } from '../../scripts/research/model-rewrite-benchmark.mjs';

const generator = { id: 'openai-test', provider: 'openai', model: 'gpt-test', transport: 'opencodex', baseURL: 'http://127.0.0.1:10100/v1' };
const judge = { id: 'anthropic-sonnet', provider: 'anthropic', model: 'claude-sonnet-5', transport: 'claude-cli' };
const gemini = { id: 'gemini-3.7', provider: 'gemini', model: 'google-antigravity/gemini-test', transport: 'opencodex', baseURL: generator.baseURL };
const fixture = { fixture_id: 'one', text: 'We shipped 12 fixes.', text_hash: textHash('We shipped 12 fixes.'), language: 'en' };
const parentHash = 'a'.repeat(64), evaluationHash = 'b'.repeat(64);

function receipt(root, logicalId, index, candidate, text, options = {}) {
  const directory = join(root, 'calls', textHash(logicalId)); mkdirSync(directory, { recursive: true });
  const promptHash = textHash(options.prompt || 'Frozen generation prompt');
  const identity = { logicalId, index, candidate, promptHash, temperature: options.temperature ?? .2,
    responseFormat: options.responseFormat ?? null, extraBody: options.extraBody ?? null };
  const response = { text, effectiveModels: [candidate.model], durationMs: 10, attempts: 1 };
  writeFileSync(join(directory, `${index}.private.json`), JSON.stringify({ schemaVersion: 1, state: 'completed', schemaValid: true,
    requestHash: textHash(JSON.stringify(identity)), promptHash, temperature: identity.temperature, response, transportAttempts: [] }));
  return response;
}

async function addParentJudgment(root, row, mps = 0) {
  const logical = `${parentHash}/${generator.id}/${fixture.fixture_id}/0/judge/${gemini.id}`;
  let index = 0;
  const anchors = mps === 89.9 ? Array.from({ length: 10 }, (_, i) => ({ type: 'claim', content: `claim ${i}`, verdict: i < 9 ? 'PASS' : 'SOFT_FAIL' }))
    : [{ type: 'claim', content: '12 fixes', verdict: 'HARD_FAIL' }];
  const rawMps = JSON.stringify({ anchors, pass_count: mps === 89.9 ? 9 : 0, total_count: anchors.length, polarity_pass_count: 0, polarity_total_count: 0, mps });
  const result = await judgeRewrite(fixture, { ...row, rewrite: fixture.text }, gemini, { complete: async (candidate, prompt, options) => {
    const text = prompt.includes('Meaning Preservation evaluator') ? rawMps : prompt.includes('Fidelity evaluator')
      ? '{"claims_preserved":3,"no_fabrication":3,"audience_register_match":3}' : '{"naturalness":3}';
    return receipt(root, logical, ++index, candidate, text, { ...options, prompt });
  } });
  assert.equal(result.status, 'ok');
  const privateRow = { ...result, protocol_hash: parentHash };
  const { private_details: _details, ...publicRow } = privateRow;
  writeFileSync(join(root, 'judge-gemini-3.7.jsonl'), JSON.stringify(publicRow) + '\n');
  writeFileSync(join(root, 'judge-gemini-3.7.private.jsonl'), JSON.stringify(privateRow) + '\n');
  return { publicRow, privateRow, logical };
}

function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'patina-parent-eval-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const protocolFile = join(root, 'protocol.json');
  writeFileSync(protocolFile, JSON.stringify({ candidates: [generator, { ...generator, id: 'openai-5.5' }, gemini, judge] }));
  const row = { schemaVersion: 1, candidate_id: generator.id, fixture_id: fixture.fixture_id, repeat: 0,
    provider: generator.provider, requested_model: generator.model, transport: generator.transport, language: fixture.language,
    protocol_hash: parentHash, prompt_hash: textHash('Frozen generation prompt'), text_hash: fixture.text_hash, rewrite_hash: fixture.text_hash,
    status: 'ok', number_safety: { ok: true }, duration_ms: 10,
    calls: [{ effectiveModels: [generator.model], modelIdentityVerified: true, status: 'ok', schema_valid: true }] };
  writeFileSync(join(root, 'rewrite-rows.jsonl'), JSON.stringify(row) + '\n');
  writeFileSync(join(root, 'rewrites.private.jsonl'), JSON.stringify({ ...row, rewrite: fixture.text }) + '\n');
  writeFileSync(join(root, 'study-protocol.json'), JSON.stringify({ schemaVersion: 1, protocolHash: parentHash }));
  receipt(root, `${parentHash}/${generator.id}/${fixture.fixture_id}/0/rewrite`, 1, generator, fixture.text);
  const options = { directory: root, protocolFile, fixtures: [fixture], provider: 'openai', candidateId: generator.id };
  return { root, row, options };
}

test('new judgments preserve parent identities, resume once, and never regenerate outputs', async (t) => {
  const { root, options } = setup(t);
  const before = readFileSync(join(root, 'rewrites.private.jsonl'), 'utf8');
  const parent = { ...await loadParentCohort(options), fixtures: [fixture] };
  let calls = 0;
  const evaluate = async (_fixture, generation, seat) => {
    calls++;
    return { candidate_id: generation.candidate_id, fixture_id: generation.fixture_id, repeat: generation.repeat,
      text_hash: generation.text_hash, rewrite_hash: generation.rewrite_hash, judge_id: seat.id, judge_model: seat.model,
      judge_provider: seat.provider, judge_transport: seat.transport, status: 'ok', mps: 100, fidelity: 100, naturalness: 3,
      hard_fail_count: 0, calls: ['mps', 'fidelity', 'naturalness'].map((stage) => ({ stage, status: 'ok', schema_valid: true, modelIdentityVerified: true })), private_details: { rationale: 'private reasoning must not be public' } };
  };
  const args = { parent, judge, output: join(root, 'evaluation'), protocolHash: evaluationHash, live: true, evaluate };
  const rows = await evaluateExisting(args); await evaluateExisting(args);
  assert.equal(calls, 1);
  assert.equal(rows[0].parent_protocol_hash, parentHash);
  assert.equal(rows[0].protocol_hash, evaluationHash);
  assert.equal(readFileSync(join(root, 'rewrites.private.jsonl'), 'utf8'), before);
  assert.doesNotMatch(readFileSync(join(root, 'evaluation/judge-anthropic-sonnet.jsonl'), 'utf8'), /private reasoning/);
  assert.match(readFileSync(join(root, 'evaluation/rewrite-report.md'), 'utf8'), /complete: \*\*no/);
  await assert.rejects(evaluateExisting({ ...args, protocolHash: 'c'.repeat(64) }), /different protocol/);
});

test('private-only and receipt-only parent judge evidence prevents a new paid evaluation', async (t) => {
  for (const kind of ['private-only', 'receipt-only']) {
    const { root, options } = setup(t);
    if (kind === 'private-only') writeFileSync(join(root, 'judge-anthropic-sonnet.private.jsonl'), '{"candidate_id":"openai-test","fixture_id":"one","repeat":0}\n');
    else receipt(root, `${parentHash}/${generator.id}/${fixture.fixture_id}/0/judge/${judge.id}`, 1, judge, 'Already paid');
    await assert.rejects(loadParentCohort(options), /private-only|receipt-only/);
  }
});

test('parent scores must match private rows and the original model completion', async (t) => {
  for (const inconsistentPublic of [true, false]) {
    const { root, row, options } = setup(t);
    const saved = await addParentJudgment(root, row);
    saved.publicRow.mps = 100; saved.publicRow.hard_fail_count = 0;
    writeFileSync(join(root, 'judge-gemini-3.7.jsonl'), JSON.stringify(saved.publicRow) + '\n');
    if (!inconsistentPublic) writeFileSync(join(root, 'judge-gemini-3.7.private.jsonl'), JSON.stringify({ ...saved.privateRow, mps: 100, hard_fail_count: 0 }) + '\n');
    await assert.rejects(loadParentCohort(options), inconsistentPublic ? /public\/private metadata/ : /scores differ/);
  }
});

test('parent binding is checked and legacy parents require explicit full receipt auditing', async (t) => {
  const { root, options } = setup(t);
  writeFileSync(join(root, 'study-protocol.json'), JSON.stringify({ schemaVersion: 1, protocolHash: evaluationHash }));
  await assert.rejects(loadParentCohort(options), /binding differs/);
  rmSync(join(root, 'study-protocol.json'));
  await assert.rejects(loadParentCohort(options), /explicit receipt audit/);
  const parent = await loadParentCohort({ ...options, allowLegacyUnbound: true });
  assert.equal(parent.provenance.bindingMode, 'legacy-receipts-audited');
  assert.ok(Object.keys(parent.provenance.inputHashes).some((path) => path.startsWith('calls/')));
});

test('incomplete matrices, tampered private content and same-family evaluation fail before calls', async (t) => {
  const { root, options } = setup(t);
  await assert.rejects(loadParentCohort({ ...options, repeat: 2 }), /incomplete/);
  const parent = { ...await loadParentCohort(options), fixtures: [fixture] };
  await assert.rejects(evaluateExisting({ parent, judge: generator, output: join(root, 'bad'), protocolHash: evaluationHash, live: true }), /own family/);
  const row = JSON.parse(readFileSync(join(root, 'rewrites.private.jsonl'), 'utf8'));
  writeFileSync(join(root, 'rewrites.private.jsonl'), JSON.stringify({ ...row, rewrite: 'Changed 13 fixes.' }) + '\n');
  await assert.rejects(loadParentCohort(options), /hash mismatch/);
});

test('public evaluation tampering cannot override its private receipt', async (t) => {
  const { root, options, row } = setup(t);
  const parent = { ...await loadParentCohort(options), fixtures: [fixture] };
  const args = { parent, judge, output: join(root, 'eval'), protocolHash: evaluationHash, live: true, evaluate: async () => ({
    candidate_id: row.candidate_id, fixture_id: row.fixture_id, repeat: 0, text_hash: row.text_hash, rewrite_hash: row.rewrite_hash,
    judge_id: judge.id, judge_provider: judge.provider, judge_model: judge.model, judge_transport: judge.transport,
    status: 'error', calls: [], private_details: {},
  }) };
  await evaluateExisting(args);
  const path = join(root, 'eval/judge-anthropic-sonnet.jsonl');
  const saved = JSON.parse(readFileSync(path, 'utf8')); saved.mps = 100; writeFileSync(path, JSON.stringify(saved) + '\n');
  await assert.rejects(evaluateExisting(args), /metadata differs/);
});

test('foreign request identities and altered prompt bindings are rejected', async (t) => {
  for (const alterPrompt of [false, true]) {
    const { root, row, options } = setup(t);
    const { logical } = await addParentJudgment(root, row);
    const path = join(root, 'calls', textHash(logical), '1.private.json');
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    const promptHash = alterPrompt ? textHash('A different fixture prompt') : saved.promptHash;
    saved.promptHash = promptHash;
    saved.requestHash = textHash(JSON.stringify({ logicalId: alterPrompt ? logical : 'another-fixture', index: 1,
      candidate: gemini, promptHash, temperature: saved.temperature, responseFormat: null, extraBody: null }));
    writeFileSync(path, JSON.stringify(saved));
    await assert.rejects(loadParentCohort(options), /request or prompt binding/);
  }
});

test('MPS replay cannot round a failing 89.9 up through the safety threshold', async (t) => {
  const { root, row, options } = setup(t);
  const saved = await addParentJudgment(root, row, 89.9);
  assert.equal(saved.publicRow.mps, 89.9);
  for (const name of ['judge-gemini-3.7.jsonl', 'judge-gemini-3.7.private.jsonl']) {
    const path = join(root, name), value = JSON.parse(readFileSync(path, 'utf8'));
    value.mps = 90; writeFileSync(path, JSON.stringify(value) + '\n');
  }
  await assert.rejects(loadParentCohort(options), /scores differ/);
});

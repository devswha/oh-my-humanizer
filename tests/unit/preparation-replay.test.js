import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { textHash, evaluateScorerFixture } from '../../tests/quality/live-scorer-benchmark.mjs';
import { safeCallRecord } from '../../scripts/research/study-journal.mjs';
import { replayPreparationRow } from '../../scripts/research/preparation-replay.mjs';

const candidate = { id: 'test', model: 'test-model', provider: 'openai', transport: 'opencodex-http' };
function setup(t) {
  const directory = mkdtempSync(resolve(tmpdir(), 'patina-preparation-replay-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const logicalId = 'test-protocol/score/source', prompt = 'test prompt';
  const identity = { logicalId, index: 1, candidate, promptHash: textHash(prompt), temperature: .2, responseFormat: null, extraBody: null };
  const receipt = { schemaVersion: 1, state: 'completed', requestHash: textHash(JSON.stringify(identity)), promptHash: identity.promptHash,
    temperature: .2, schemaValid: false, transportAttempts: [], response: { text: 'malformed score', effectiveModels: [candidate.model], durationMs: 12 } };
  const group = resolve(directory, 'calls', textHash(logicalId)); mkdirSync(group, { recursive: true });
  const path = resolve(group, '1.private.json'); writeFileSync(path, JSON.stringify(receipt));
  return { directory, logicalId, candidate, prompt, row: { calls: [safeCallRecord(receipt, candidate)] }, path, group };
}

test('preparation replay is read-only and cannot issue an unrecorded fallback request', async (t) => {
  const input = setup(t), original = readFileSync(input.path, 'utf8');
  await assert.rejects(replayPreparationRow({ ...input, run: async (complete) => {
    await complete(candidate, input.prompt);
    try { await complete(candidate, input.prompt + ' repair'); } catch { /* Production parsers may absorb transport failures. */ }
    return { status: 'error' };
  } }), /unrecorded/);
  assert.equal(readFileSync(input.path, 'utf8'), original);
});

test('preparation replay rejects extra receipts, unused calls and changed prompts', async (t) => {
  const input = setup(t);
  await assert.rejects(replayPreparationRow({ ...input, run: async () => ({ status: 'ok' }) }), /exact call sequence/);
  await assert.rejects(replayPreparationRow({ ...input, run: async (complete) => { try { await complete(candidate, 'changed'); } catch {} } }), /mismatched/);
  writeFileSync(resolve(input.group, '2.private.json'), readFileSync(input.path));
  await assert.rejects(replayPreparationRow({ ...input, run: async () => assert.fail('must reject before replay') }), /missing or extra/);
});

test('preparation replay returns the exact recorded completion without a live transport', async (t) => {
  const input = setup(t);
  const result = await replayPreparationRow({ ...input, run: async (complete) => complete(candidate, input.prompt) });
  assert.equal(result.text, 'malformed score');
});

test('the actual score parser cannot replenish a truncated failed score observation', async (t) => {
  const input = setup(t), text = 'The meeting starts at noon.';
  const fixture = { fixture_id: 'test', language: 'en', text, text_hash: textHash(text), documentType: 'default' };
  let fixtureCalls = 0;
  rmSync(input.group, { recursive: true });
  const row = await evaluateScorerFixture(fixture, candidate, { logicalId: input.logicalId, journalDirectory: input.directory,
    complete: async () => { fixtureCalls++; return { text: 'malformed score', durationMs: 1, effectiveModels: [candidate.model] }; } });
  assert.ok(fixtureCalls > 1, 'the score parser exercised its fallback');
  for (let i = 2; i <= row.calls.length; i++) rmSync(resolve(input.group, `${i}.private.json`));
  row.calls = row.calls.slice(0, 1);
  const original = readFileSync(input.path, 'utf8');
  await assert.rejects(replayPreparationRow({ ...input, row,
    run: (complete) => evaluateScorerFixture(fixture, candidate, { logicalId: input.logicalId, complete }) }), /unrecorded/);
  assert.equal(readFileSync(input.path, 'utf8'), original);
  assert.equal(existsSync(resolve(input.group, '2.private.json')), false);
});

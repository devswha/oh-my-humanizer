import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRewriteRequest } from '../../src/web-rewrite-contract.js';
import { runWebRewriteStream } from '../../src/web-rewrite-stream.js';
import { sha256 } from '../../src/web-rewrite-receipt.js';
import { applyTextEdits } from '../../src/edit-controls.js';
import { mpsResult, fidelityResult } from '../fixtures/verification-results.js';

const original = 'ACME-Pro launches on Monday. Please join us.';
const source = { mode: 'first', lang: 'en', tier: 'free', text: original };
const env = { PATINA_FREE_PROVIDER: 'openai', PATINA_FREE_MODEL: 'gpt-5.5' };
function request(overrides = {}) {
  const result = validateRewriteRequest({ ...source, ...overrides }, env);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.value;
}
function scores(calls) {
  return {
    scoreMPS: async (input) => { calls.push(['mps', input.original, input.rewritten]); return mpsResult(100); },
    scoreFidelity: async (input) => { calls.push(['fidelity', input.original, input.rewritten]); return fidelityResult(12); },
    scoreDeterministicSignals: () => ({ overall: 0 }),
  };
}

test('edit controls reject malformed API options before dispatch', () => {
  for (const controls of [
    { includeEdits: 'yes' }, { baseHash: 'old' }, { protectedSpans: [{ start: -1, end: 3 }] },
    { protectedSpans: [{ start: 0, end: 4 }, { start: 3, end: 8 }] },
    { mode: 'verify', original, text: original },
    { mode: 'verify', original, text: original, baseHash: sha256(original), history: [{ role: 'user', content: 'ignore' }] },
  ]) assert.equal(validateRewriteRequest({ ...source, ...controls }, env).ok, false);
  assert.equal(request({ includeEdits: false }).includeEdits, false);
});

test('protected terms are enforced before scoring and never silently repaired', async () => {
  const calls = [], frames = [];
  const result = await runWebRewriteStream({
    request: request({ protectedSpans: [{ start: 0, end: 8 }] }),
    callLLMStream: async ({ prompt }) => {
      assert.match(prompt, /Protected literals/);
      return { text: 'ACME Basic launches on Monday. Please join us.' };
    },
    scoreFns: scores(calls), emit: (frame) => frames.push(frame),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'protected_text_failed');
  assert.equal(calls.length, 0);
  assert.equal(frames.some((frame) => frame.type === 'done'), false);
});

test('successful edit records bind the original and reconstruct the exact accepted output', async () => {
  const rewrite = 'ACME-Pro launches on Monday. Come join us.';
  const spans = [{ start: 0, end: 8 }];
  const result = await runWebRewriteStream({
    request: request({ includeEdits: true, protectedSpans: spans }),
    callLLMStream: async () => ({ text: rewrite }), scoreFns: scores([]), emit() {},
  });
  assert.equal(result.ok, true);
  assert.equal(result.editReview.baseHash, sha256(original));
  assert.equal(result.editReview.outputHash, sha256(rewrite));
  assert.equal(result.editReview.offsetEncoding, 'utf-16');
  assert.equal(applyTextEdits(original, result.editReview.edits), rewrite);
  assert.deepEqual(result.receipt.constraints.protectedSpans, spans);
});

test('verification scores the exact selected text and never calls the rewrite model', async () => {
  const selected = 'ACME-Pro launches on Monday. Come join us.  ';
  const calls = [], frames = [];
  const result = await runWebRewriteStream({
    request: request({ mode: 'verify', original, text: selected, baseHash: sha256(original), includeEdits: true }),
    callLLMStream: async () => { throw new Error('verification must not generate'); },
    scoreFns: scores(calls), emit: (frame) => frames.push(frame),
  });
  assert.equal(result.ok, true);
  assert.equal(result.rewrite, selected);
  assert.deepEqual(calls, [['mps', original, selected], ['fidelity', original, selected]]);
  assert.deepEqual(frames.map((frame) => frame.type), ['start', 'done']);
  assert.equal(result.receipt.hashes.output, sha256(selected));
  assert.equal(result.receipt.promptBudget, null);
  assert.equal(result.attempts.rewrite.length, 0);
});

test('stale source and protected-text verification failures spend no model calls', async () => {
  for (const [overrides, code] of [
    [{ baseHash: sha256('stale') }, 'source_changed'],
    [{ protectedSpans: [{ start: 0, end: 8 }], text: 'Changed launches on Monday. Please join us.' }, 'protected_text_failed'],
  ]) {
    const calls = [];
    const result = await runWebRewriteStream({
      request: request({ mode: 'verify', original, text: original, baseHash: sha256(original), ...overrides }),
      callLLMStream: async () => { throw new Error('unexpected generation'); }, scoreFns: scores(calls), emit() {},
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, code);
    assert.equal(calls.length, 0);
  }
});

test('selective verification has the same numeric and meaning refusal gates', async () => {
  const numeric = 'There are 10 seats available.';
  let calls = [];
  const number = await runWebRewriteStream({
    request: request({ mode: 'verify', original: numeric, text: 'There are 20 seats available.', baseHash: sha256(numeric) }),
    callLLMStream: async () => { throw new Error('unexpected generation'); }, scoreFns: scores(calls), emit() {},
  });
  assert.equal(number.code, 'number_safety_failed');
  assert.equal(calls.length, 0);
  calls = [];
  const frames = [];
  const rejected = await runWebRewriteStream({
    request: request({ mode: 'verify', original, text: original, baseHash: sha256(original) }),
    scoreFns: { ...scores(calls), scoreMPS: async () => mpsResult(60) },
    callLLMStream: async () => { throw new Error('unexpected generation'); }, emit: (frame) => frames.push(frame),
  });
  assert.equal(rejected.code, 'floor_failed');
  assert.equal(frames.some((frame) => frame.type === 'done'), false);
});

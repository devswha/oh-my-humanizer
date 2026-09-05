import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeClaudeStudyStream } from '../../scripts/research/claude-study-stream.mjs';
import { safeCallRecord } from '../../scripts/research/study-journal.mjs';

const candidate = { model: 'claude-opus-5', transport: 'claude-cli' };
const assistant = (model = candidate.model, text = 'READY', parent = null) => ({ type: 'assistant', parent_tool_use_id: parent, message: { model, content: [{ type: 'text', text }] } });
const terminal = (extra = {}) => ({ type: 'result', is_error: false, result: 'READY', modelUsage: {
  'claude-opus-5': { inputTokens: 2, outputTokens: 4, cacheReadInputTokens: 2365, cacheCreationInputTokens: 372 },
  'claude-haiku-4-5-20251001': { inputTokens: 899, outputTokens: 9, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
}, usage: { input_tokens: 2, output_tokens: 4, cache_read_input_tokens: 2365, cache_creation_input_tokens: 372 }, ...extra });
const stream = (...rows) => rows.map((row) => JSON.stringify(row)).join('\n');

test('answer identity comes from messages and usage retains both primary and auxiliary models', () => {
  const result = decodeClaudeStudyStream(stream(assistant(), terminal()), candidate);
  assert.equal(result.outputBound, true);
  assert.deepEqual(result.effectiveModels, ['claude-opus-5']);
  assert.deepEqual(result.usage, { prompt_tokens: 3638, completion_tokens: 13, cached_read_tokens: 2365, cache_write_tokens: 372 });
  assert.equal(result.primaryUsage.prompt_tokens, 2739);
  assert.equal(result.auxiliaryUsage.prompt_tokens, 899);
  assert.equal(result.usageComplete, true);
  const safe = safeCallRecord({ state: 'completed', response: result }, candidate);
  assert.equal(safe.modelIdentityVerified, true);
  assert.equal(safe.auxiliaryModelCount, 1);
  assert.equal(safe.attemptUnit, 'cli-invocation');
  assert.equal(safe.usage.completion_tokens, 13);
});

test('fallback or mixed root messages never qualify as the requested model', () => {
  for (const messages of [[assistant('claude-sonnet-5')], [assistant('claude-sonnet-5'), assistant()]]) {
    const result = decodeClaudeStudyStream(stream(...messages, terminal()), candidate);
    const safe = safeCallRecord({ state: 'completed', response: result }, candidate);
    assert.equal(safe.modelIdentityVerified, false);
    assert.equal(safe.mixedOrUnexpectedModel, true);
  }
});

test('terminal text must be bound to a root assistant reply', () => {
  for (const rows of [[terminal()], [terminal(), assistant()], [assistant(), assistant(candidate.model, ''), terminal()], [assistant(candidate.model, 'different'), terminal()], [assistant(candidate.model, 'READY', 'child-call'), terminal()]]) {
    const result = decodeClaudeStudyStream(stream(...rows), candidate);
    assert.equal(result.outputBound, false);
    assert.deepEqual(result.effectiveModels, []);
    assert.equal(result.primaryUsage, null);
  }
  assert.throws(() => decodeClaudeStudyStream(stream(assistant(), terminal(), terminal()), candidate), /one terminal/);
});

test('missing or invalid accounting remains unknown and private metadata cannot leak', () => {
  const result = decodeClaudeStudyStream(stream(assistant(), terminal({ modelUsage: {
    ...terminal().modelUsage,
    'private-account@example.test': { inputTokens: 'unknown', outputTokens: 2, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, privateText: 'private-note' },
  } })), candidate);
  assert.equal(result.usage, null);
  assert.equal(result.usageComplete, false);
  assert.equal(result.primaryUsage.prompt_tokens, 2739);
  assert.equal(result.observedResultUsage.prompt_tokens, 2739);
  const safe = safeCallRecord({ state: 'completed', response: result }, candidate);
  assert.doesNotMatch(JSON.stringify(safe), /private-account|private-note/);
});

test('failed terminal results retain accounting without inventing response identity', () => {
  const result = decodeClaudeStudyStream(stream(terminal({ is_error: true, result: 'Failed' })), candidate);
  assert.equal(result.isError, true);
  assert.equal(result.outputBound, false);
  assert.equal(result.usage.completion_tokens, 13);
});

test('missing result cache fields remain unknown rather than becoming zero', () => {
  const result = decodeClaudeStudyStream(stream(assistant(), terminal({ modelUsage: {}, usage: { input_tokens: 2, output_tokens: 4 } })));
  assert.equal(result.usage, null);
  assert.equal(result.usageComplete, false);
  assert.deepEqual(result.observedResultUsage, { prompt_tokens: null, completion_tokens: 4, cached_read_tokens: null, cache_write_tokens: null, reasoning_tokens: null });
});

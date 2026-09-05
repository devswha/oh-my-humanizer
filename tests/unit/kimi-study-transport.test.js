import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseKimiTrace } from '../../scripts/research/kimi-study-transport.mjs';
import { safeCallRecord } from '../../scripts/research/study-journal.mjs';
import { validateTransport } from '../../scripts/research/model-evaluation-transport.mjs';

const candidate = { id: 'kimi-code-k3', provider: 'kimi', transport: 'kimi-cli', model: 'kimi-code/k3' };
const request = { type: 'llm.request', model: 'k3', modelAlias: candidate.model, toolsHash: createHash('sha256').update('[]').digest('hex'), toolSelect: false };
const usage = { type: 'usage.record', model: candidate.model, usageScope: 'turn', usage: { inputOther: 10, output: 20, inputCacheRead: 30, inputCacheCreation: 40 } };
const trace = (...rows) => rows.map((row) => JSON.stringify(row)).join('\n');

test('Kimi study accounting distinguishes request trace from server identity', () => {
  const result = parseKimiTrace(trace(request, usage), candidate);
  assert.equal(result.usage.prompt_tokens, 80);
  assert.equal(result.usage.completion_tokens, 20);
  const safe = safeCallRecord({ state: 'completed', response: result }, candidate);
  assert.equal(safe.modelIdentityVerified, false);
  assert.equal(safe.identityEvidence, 'cli-request-trace');
  assert.equal(safe.usageEvidence, 'cli-session-trace');
  assert.equal(safe.temperature_control, 'unsupported-by-cli');
});

test('Kimi trace rejects fallback models, tool access, ambiguous calls and missing usage', () => {
  for (const rows of [[{ ...request, model: 'another' }, usage], [{ ...request, toolsHash: 'not-empty' }, usage], [{ ...request, toolSelect: true }, usage], [request, request, usage], [request], [request, { ...usage, usage: { output: 20 } }]]) assert.throws(() => parseKimiTrace(trace(...rows), candidate));
  assert.doesNotThrow(() => validateTransport(candidate));
  assert.throws(() => validateTransport({ ...candidate, provider: 'gemini' }), /Gemini/);
  assert.throws(() => validateTransport({ ...candidate, model: 'kimi-code/unadmitted' }), /admitted/);
});

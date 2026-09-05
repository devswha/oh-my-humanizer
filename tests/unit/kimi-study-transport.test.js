import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseKimiTrace } from '../../scripts/research/kimi-study-transport.mjs';
import { acceptedStudyIdentity, safeCallRecord } from '../../scripts/research/study-journal.mjs';
import { validateTransport } from '../../scripts/research/model-evaluation-transport.mjs';
import { evaluateScorerFixture, loadScorerFixtures } from '../quality/live-scorer-benchmark.mjs';
import { generateRewrite } from '../../scripts/research/model-rewrite-benchmark.mjs';

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
  assert.equal(safe.profileIdentityVerified, true);
  assert.equal(acceptedStudyIdentity(safe, candidate), true);
  assert.equal(acceptedStudyIdentity(safe, { transport: 'opencodex' }), false);
  assert.equal(safe.identityEvidence, 'cli-request-trace');
  assert.equal(safe.usageEvidence, 'cli-session-trace');
  assert.equal(safe.temperature_control, 'unsupported-by-cli');
});

test('valid Kimi profile observations reach scoring and rewriting without a server identity claim', async () => {
  const metadata = parseKimiTrace(trace(request, usage), candidate);
  const fixture = loadScorerFixtures().find((row) => row.language === 'en');
  const completion = (text) => async () => ({ text, ...metadata, durationMs: 1, attempts: 1 });
  const score = await evaluateScorerFixture(fixture, candidate, { complete: completion('{"categories":{"content":{"detected":0,"sum":0,"max":18,"score":0,"weighted":0}},"overall":0,"interpretation":"test"}') });
  assert.equal(score.status, 'ok');
  assert.equal(score.calls[0].modelIdentityVerified, false);
  const generation = await generateRewrite(fixture, candidate, 'Rewrite this fixture.', { complete: completion('A clear rewrite.') });
  assert.equal(generation.status, 'ok');
  assert.equal(generation.calls[0].profileIdentityVerified, true);
});

test('Kimi trace rejects fallback models, tool access, ambiguous calls and missing usage', () => {
  for (const rows of [[{ ...request, model: 'another' }, usage], [{ ...request, toolsHash: 'not-empty' }, usage], [{ ...request, toolSelect: true }, usage], [request, request, usage], [request], [request, { ...usage, usage: { output: 20 } }]]) assert.throws(() => parseKimiTrace(trace(...rows), candidate));
  assert.doesNotThrow(() => validateTransport(candidate));
  assert.throws(() => validateTransport({ ...candidate, provider: 'gemini' }), /Gemini/);
  assert.throws(() => validateTransport({ ...candidate, model: 'kimi-code/unadmitted' }), /admitted/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { oneAttemptCompletion, resolveShortPlan } from '../../scripts/research/collect-shortform-corpus.mjs';

test('source, prompt, candidate and matrix bindings are checked before collection', () => {
  const hash = (text) => createHash('sha256').update(text).digest('hex');
  const seal = (plan) => { const { planHash: _old, ...definition } = plan; return { ...definition, planHash: hash(JSON.stringify(definition, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])) : value)) }; };
  const candidate = { id: 'test', provider: 'gemini', transport: 'opencodex', model: 'google-antigravity/gemini-test', baseURL: 'http://127.0.0.1:10100/v1' };
  const fixtures = ['en', 'ko'].flatMap((language) => ['social', 'marketing'].map((register) => {
    const text = `${language} ${register} fixture.`; return { fixture_id: `${language}-${register}`, language, register, text, text_hash: hash(text) };
  }));
  const plan = seal({ status: 'frozen-awaiting-parent-execution', repeats: 3, requiredGenerationCalls: 12, additionalScoreOrJudgeCalls: 0,
    maxTransportAttemptsPerCall: 1, temperature: .2, candidate: { id: candidate.id, model: candidate.model, provider: candidate.provider, transport: candidate.transport },
    candidateDefinitionHash: hash(JSON.stringify(candidate)), promptTemplate: '{sourceJson}',
    sources: fixtures.map((row) => ({ fixtureId: row.fixture_id, language: row.language, register: row.register, sourceTextHash: row.text_hash, promptHash: hash(JSON.stringify(row.text)) })) });
  assert.equal(resolveShortPlan(plan, { candidates: [candidate] }, fixtures).sources.length, 4);
  assert.throws(() => resolveShortPlan({ ...plan, repeats: 4 }, { candidates: [candidate] }, fixtures), /hash differs/);
  assert.throws(() => resolveShortPlan(seal({ ...plan, candidate: { ...plan.candidate, model: 'wrong' } }), { candidates: [candidate] }, fixtures), /label differs/);
  assert.throws(() => resolveShortPlan(plan, { candidates: [{ ...candidate, baseURL: 'https://example.com/v1' }] }, fixtures), /definition differs/);
  assert.throws(() => resolveShortPlan(plan, { candidates: [candidate] }, fixtures.map((row, i) => i ? row : { ...row, text: 'changed' })), /source binding/);
  assert.throws(() => resolveShortPlan(seal({ ...plan, sources: plan.sources.map((row, i) => i ? row : { ...row, promptHash: hash('changed') }) }), { candidates: [candidate] }, fixtures), /prompt binding/);
});

test('one-attempt collection does not issue the API client temperature fallback', async (t) => {
  let requests = 0;
  const server = createServer((request, response) => {
    requests++; request.resume(); response.writeHead(400, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { message: 'Unsupported parameter: temperature' } }));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const candidate = { id: 'mock', provider: 'gemini', transport: 'opencodex', model: 'google-antigravity/gemini-cap-test', baseURL: `http://127.0.0.1:${server.address().port}/v1` };
  await assert.rejects(oneAttemptCompletion(candidate, 'test', { timeoutMs: 1000 }));
  assert.equal(requests, 1);
});

test('collection retains actual response identity, usage and requested settings', async (t) => {
  let requests = 0;
  const model = 'google-antigravity/gemini-success-test';
  const raw = { model, choices: [{ message: { content: 'A short test post.' } }], usage: { prompt_tokens: 8, completion_tokens: 5 } };
  const server = createServer((request, response) => {
    requests++; request.resume(); response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(raw));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const candidate = { id: 'mock', provider: 'gemini', transport: 'opencodex', model, baseURL: `http://127.0.0.1:${server.address().port}/v1` };
  for (let i = 0; i < 2; i++) {
    const result = await oneAttemptCompletion(candidate, 'test', { timeoutMs: 1000, temperature: .2 });
    assert.equal(result.attempts, 1); assert.deepEqual(result.rawResponse, raw);
    assert.deepEqual(result.effectiveModels, [model]); assert.equal(result.effectiveTemperature, .2);
  }
  assert.equal(requests, 2);
});

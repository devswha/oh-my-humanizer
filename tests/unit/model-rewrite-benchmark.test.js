import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateRewrite, judgeCandidates, judgeRewrite, naturalnessPrompt, parseNaturalness, renderRewriteReport, rewriteFixtures, summarizeRewrites } from '../../scripts/research/model-rewrite-benchmark.mjs';
import { textHash } from '../quality/live-scorer-benchmark.mjs';
import { isSameProcess, processIdentity } from '../../scripts/research/study-job.mjs';

const protocol = JSON.parse(readFileSync(new URL('../../docs/research/model-evaluation-20260904.json', import.meta.url), 'utf8'));
const candidate = protocol.candidates.find((row) => row.id === 'openai-astra');
const text = 'We shipped 12 updates. We did not remove backups.';
const fixture = { fixture_id: 'test', language: 'en', register: 'product-doc', documentType: 'default', text, text_hash: textHash(text) };
const response = (text, model = candidate.model) => ({ text, durationMs: 2, effectiveModels: [model], attempts: 1, usage: null });

test('screening and full rewrite suites retain four languages and registered scope', () => {
  const screening = rewriteFixtures();
  const full = rewriteFixtures('full');
  assert.equal(screening.length, 12);
  assert.equal(full.length, 34);
  assert.equal(new Set(screening.map((row) => row.fixture_id)).size, 12);
  for (const language of ['en', 'ko', 'zh', 'ja']) assert.ok(screening.some((row) => row.language === language));
  for (const row of screening) assert.equal(row.text_hash, textHash(row.text));
});

test('fixed judge assignment excludes the producer and uses two different families', () => {
  for (const producer of protocol.candidates) {
    const judges = judgeCandidates(producer, protocol);
    assert.equal(judges.length, 2);
    assert.equal(new Set(judges.map((row) => row.provider)).size, 2);
    assert.ok(judges.every((row) => row.provider !== producer.provider));
  }
  assert.throws(() => judgeCandidates(candidate, { candidates: [] }), /missing/);
});

test('generation strips audit output and refuses changed numbers before judging', async () => {
  const result = await generateRewrite(fixture, candidate, 'test prompt', { complete: async () => response('[BODY]We shipped 13 updates. We did not remove backups.[/BODY]\n[SELF_AUDIT]private analysis[/SELF_AUDIT]') });
  assert.equal(result.status, 'ok');
  assert.equal(result.number_safety.ok, false);
  assert.equal(result.number_safety.reason, 'numeric_claim_changed');
  assert.doesNotMatch(result.rewrite, /SELF_AUDIT|private analysis/);
  assert.equal(result.rewrite_hash, textHash(result.rewrite));
});

test('generation failures are recorded without invented outputs or upstream private data', async () => {
  const result = await generateRewrite(fixture, candidate, 'prompt', { complete: async () => { throw new Error('HTTP 403 secret-account private draft'); } });
  assert.equal(result.status, 'error');
  assert.equal(result.rewrite_hash, null);
  assert.equal(result.error, 'provider-access-denied (HTTP 403)');
});

test('naturalness rubric is model-blind and rejects non-numeric or out-of-range ratings', () => {
  const prompt = naturalnessPrompt(fixture, text);
  assert.doesNotMatch(prompt, /gpt-6|google-antigravity|claude-sonnet/);
  assert.equal(parseNaturalness('```json\n{"naturalness":4}\n```').naturalness, 4);
  for (const bad of ['{"naturalness":"4"}', '{"naturalness":5}', '{"naturalness":null}', '{}']) assert.throws(() => parseNaturalness(bad));
});

test('judging exercises production MPS and fidelity separately from naturalness', async () => {
  const generation = { candidate_id: candidate.id, provider: candidate.provider, requested_model: candidate.model, repeat: 0, rewrite: text, rewrite_hash: textHash(text) };
  const prompts = [];
  const result = await judgeRewrite(fixture, generation, judgeCandidates(candidate, protocol)[0], { complete: async (judge, prompt) => {
    prompts.push(prompt);
    if (prompt.includes('Meaning Preservation evaluator')) return response(JSON.stringify({ anchors: [{ type: 'claim', content: '12 updates', verdict: 'PASS' }], pass_count: 1, total_count: 1, polarity_pass_count: 0, polarity_total_count: 0, mps: 100 }), judge.model);
    if (prompt.includes('Fidelity evaluator')) return response(JSON.stringify({ claims_preserved: 3, no_fabrication: 3, audience_register_match: 3 }), judge.model);
    return response('{"naturalness":3,"rationale":"Clear prose."}', judge.model);
  } });
  assert.equal(prompts.length, 3);
  assert.equal(result.status, 'ok');
  assert.equal(result.mps, 100);
  assert.equal(result.fidelity, 100);
  assert.equal(result.naturalness, 3);
  assert.ok(result.private_details.anchors);
});

test('summary cannot count missing, same-family, stale or invalid judgments as safe', () => {
  const generation = { candidate_id: 'a', provider: 'openai', fixture_id: 'one', repeat: 0, language: 'en', status: 'ok', number_safety: { ok: true }, text_hash: 'source', rewrite_hash: 'rewrite', duration_ms: 10 };
  const judges = ['gemini', 'anthropic'].map((provider) => ({ ...generation, judge_id: provider, judge_provider: provider, mps: 100, fidelity: 100, naturalness: 4, hard_fail_count: 0 }));
  assert.equal(summarizeRewrites([generation], []).a.safe, 0);
  assert.equal(summarizeRewrites([generation], []).a.pending_judgments, 1);
  assert.equal(summarizeRewrites([generation], judges).a.safe, 1);
  assert.equal(summarizeRewrites([generation], [{ ...judges[0], mps: Infinity }, judges[1]]).a.safe, 0);
  assert.throws(() => summarizeRewrites([generation], [{ ...judges[0], judge_provider: 'openai' }, judges[1]]), /same-family/);
  assert.throws(() => summarizeRewrites([generation], [{ ...judges[0], rewrite_hash: 'changed' }]), /Unbound/);
  assert.throws(() => summarizeRewrites([generation], [judges[0], judges[0]]), /Duplicate/);
  assert.match(renderRewriteReport([generation], [], { expectedGenerations: 1 }), /Collection complete: \*\*no\*\*/);
});

test('Linux supervisor verifies PID start time and boot identity rather than a stale state file', { skip: process.platform !== 'linux' }, () => {
  const identity = processIdentity(process.pid);
  assert.equal(isSameProcess(identity), true);
  assert.equal(isSameProcess({ ...identity, startTime: '0' }), false);
  assert.equal(isSameProcess({ ...identity, bootId: 'stale' }), false);
  assert.equal(isSameProcess({ pid: -1 }), false);
});

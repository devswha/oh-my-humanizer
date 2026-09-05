import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { distribution, evaluateScorerFixture, loadScorerFixtures, loadScorerManifest, summarizeScorerRows, textHash } from '../quality/live-scorer-benchmark.mjs';
import { readCredential, safeStudyError, validateTransport } from '../../scripts/research/model-evaluation-transport.mjs';

const candidate = { id: 'test', provider: 'gemini', transport: 'opencodex', model: 'google-antigravity/gemini-test', baseURL: 'http://127.0.0.1:10100/v1' };

test('Gemini study rejects every direct, foreign-host, unqualified or API-key route', () => {
  assert.doesNotThrow(() => validateTransport(candidate));
  for (const patch of [{ transport: 'http' }, { baseURL: 'https://generativelanguage.googleapis.com/v1' }, { model: 'gemini-test' }, { apiKeyEnv: 'GEMINI_API_KEY' }, { baseURL: 'http://127.0.0.1.evil.example/v1' }]) {
    assert.throws(() => validateTransport({ ...candidate, ...patch }));
  }
  assert.throws(() => readCredential('GEMINI_API_KEY'), /forbidden/);
});

test('scorer fixture suite carries both classes in every language and exact hashes', () => {
  const rows = loadScorerFixtures();
  for (const language of ['ko', 'en', 'zh', 'ja']) for (const expected of [true, false]) assert.ok(rows.some((row) => row.language === language && row.expected_hot === expected));
  for (const row of rows) assert.equal(row.text_hash, textHash(row.text));
});

test('live scorer executes the production prompt, preserves zero, and omits raw content', async () => {
  const fixture = loadScorerFixtures().find((row) => row.language === 'en' && !row.expected_hot);
  let calls = 0;
  const result = await evaluateScorerFixture(fixture, candidate, { complete: async (_candidate, prompt) => {
    calls++;
    assert.match(prompt, /AI-likeness scoring engine/);
    assert.ok(prompt.includes(fixture.text));
    return { text: JSON.stringify({ categories: { content: { detected: 0, sum: 0, max: 18, score: 0, weighted: 0 } }, overall: 0, interpretation: 'natural' }), durationMs: 10, effectiveModels: [candidate.model], usage: { prompt_tokens: 1 }, attempts: 1 };
  } });
  assert.equal(calls, 1);
  assert.equal(result.status, 'ok');
  assert.equal(result.overall, 0);
  assert.equal(result.categories.content.score, 0);
  assert.ok(!JSON.stringify(result).includes(fixture.text));
});

test('schema and transport failures remain missing, not perfect zero scores', async () => {
  const result = await evaluateScorerFixture(loadScorerFixtures()[0], candidate, { complete: async () => { throw new Error('transport unavailable'); } });
  assert.equal(result.status, 'error');
  assert.equal(result.overall, null);
  const summary = summarizeScorerRows([result]).test;
  assert.equal(summary.errors, 1);
  assert.equal(summary.overall.n, 0);
  assert.equal(summary.overall.mean, null);
});

test('statistics exclude null and report the even-sample median', () => {
  assert.deepEqual(distribution([null, undefined, NaN]), { n: 0, min: null, median: null, mean: null, p95: null, max: null });
  assert.equal(distribution([2, 0, 4, 6, null]).median, 3);
});

test('public transport errors omit provider account IDs and echoed source text', () => {
  const error = new Error('HTTP 429: account org-private <ak-private> suspended due to insufficient balance; input: confidential draft');
  assert.equal(safeStudyError(error), 'provider-insufficient-balance (HTTP 429)');
  assert.equal(safeStudyError(new Error('HTTP 400: token=secret; draft=private')), 'study-call-failed (HTTP 400)');
});

test('manifest text resolution rejects missing, duplicate and mismatched evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'patina-live-manifest-'));
  const manifest = join(dir, 'manifest.jsonl');
  const texts = join(dir, 'texts.jsonl');
  const text = 'A public example.';
  const row = { sample_id: 'one', language: 'en', class: 'natural-human', expected_hot: false, text_hash: textHash(text) };
  try {
    writeFileSync(manifest, JSON.stringify(row));
    writeFileSync(texts, JSON.stringify({ text, text_hash: textHash(text) }));
    assert.equal(loadScorerManifest(manifest, texts)[0].text, text);
    writeFileSync(texts, JSON.stringify({ text, text_hash: 'wrong' }));
    assert.throws(() => loadScorerManifest(manifest, texts), /hash mismatch/);
    writeFileSync(texts, JSON.stringify({ text: 'Different input' }));
    assert.throws(() => loadScorerManifest(manifest, texts), /Unresolved/);
    writeFileSync(texts, JSON.stringify({ text }));
    writeFileSync(manifest, `${JSON.stringify(row)}\n${JSON.stringify(row)}`);
    assert.throws(() => loadScorerManifest(manifest, texts), /invalid/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

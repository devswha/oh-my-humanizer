import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertMatrix, assertTerminalJob, FINALISTS, fixtureBootstrap, renderConfirmation, summarizeItems } from '../../scripts/research/confirm-model-results.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const clone = (value) => JSON.parse(JSON.stringify(value));
const report = () => JSON.parse(readFileSync(resolve(ROOT, 'docs/research/model-rewrite-confirmation-20260905.json'), 'utf8'));

test('completed exit zero does not excuse missing or unresolved matrix rows', () => {
  const job = { schemaVersion: 1, state: 'completed', exitCode: 0, signal: null,
    startedAt: '2026-09-05T01:00:00.000Z', endedAt: '2026-09-05T03:00:00.000Z' };
  const rows = Array.from({ length: 102 }, () => ({ status: 'ok', recorded_at: '2026-09-05T02:00:00.000Z', calls: [] }));
  assert.doesNotThrow(() => assertTerminalJob(job, rows));
  assert.throws(() => assertTerminalJob(job, rows.slice(1)), /incomplete rows/);
  for (const patch of [{ state: 'running' }, { exitCode: 1 }, { signal: 'SIGTERM' }, { endedAt: null }]) {
    assert.throws(() => assertTerminalJob({ ...job, ...patch }, rows));
  }
  rows[0].calls.push({ error: 'study-call-unobserved' });
  assert.throws(() => assertTerminalJob(job, rows), /nonterminal/);
});

test('terminal recovery accepts old rows preceding the latest job start, preserving errors', () => {
  const job = { schemaVersion: 1, state: 'completed', exitCode: 0, signal: null,
    startedAt: '2026-09-05T02:00:00.000Z', endedAt: '2026-09-05T03:00:00.000Z' };
  const rows = [{ status: 'error', error: 'judge-schema-failure', recorded_at: '2026-09-05T01:00:00.000Z', calls: [] }];
  assert.doesNotThrow(() => assertTerminalJob(job, rows, 1));
  assert.equal(rows[0].status, 'error');
  rows[0].recorded_at = '2026-09-05T04:00:00.000Z';
  assert.throws(() => assertTerminalJob(job, rows, 1), /nonterminal/);
});

test('full matrix requires every source/repeat and rejects type, duplicate, and candidate substitutions', () => {
  const fixtures = Array.from({ length: 34 }, (_, i) => ({ fixture_id: `synthetic-${i}` }));
  const rows = fixtures.flatMap((fixture) => [0, 1, 2].map((repeat) => ({ ...fixture, repeat, candidate_id: 'synthetic-model' })));
  assert.equal(assertMatrix(rows, 'synthetic-model', fixtures).length, 102);
  for (const change of [
    (r) => r.pop(), (r) => { r[1] = r[0]; }, (r) => { r[0].repeat = '0'; },
    (r) => { r[0].repeat = 3; }, (r) => { r[0].candidate_id = 'other-model'; },
  ]) { const changed = clone(rows); change(changed); assert.throws(() => assertMatrix(changed, 'synthetic-model', fixtures), /matrix/); }
});

function judge(overrides = {}) {
  return { status: 'ok', transportErrors: 0, stages: {
    mps: { valid: true, value: 100, hardFailCount: 0 }, fidelity: { valid: true, value: 100 }, naturalness: { valid: true, value: 3 },
  }, ...overrides };
}

test('stage diagnostics preserve preceding valid measurements when another stage fails', () => {
  const rejected = judge({ status: 'error', stages: {
    mps: { valid: true, value: 0, hardFailCount: 1 }, fidelity: { valid: true, value: 100 }, naturalness: { valid: false, value: null },
  } });
  const summary = summarizeItems([{ fixture_id: 'synthetic', generationStatus: 'ok', numericSafe: true,
    safe: false, pairNaturalness: null, durationMs: 20, judgments: [judge(), rejected] }]);
  assert.equal(summary.generations, 1); assert.equal(summary.expectedJudgments, 2);
  assert.equal(summary.judgmentErrors, 1); assert.equal(summary.validJudgePairs, 0);
  assert.equal(summary.safeRate, 0);
  assert.equal(summary.stages.mps.scores.min, 0, 'valid zero is measured, not missing');
  assert.equal(summary.stages.mps.hardFailureResponses, 1);
  assert.equal(summary.stages.fidelity.scores.n, 2);
  assert.equal(summary.stages.naturalness.scores.n, 1);
  assert.equal(summary.stages.naturalness.invalid, 1);
  assert.equal(summary.pairNaturalness.n, 0);
});

test('empty slices retain null statistics and all explicit zero denominators', () => {
  const summary = summarizeItems([]);
  assert.equal(summary.safeRate, null);
  assert.equal(summary.observedJudgments, 0);
  assert.equal(summary.stages.mps.scores.mean, null);
  assert.equal(summary.generationLatencyMs.mean, null);
});

function pairedItems() {
  // Synthetic correlated repeats: resampling individual rows would understate uncertainty.
  const items = ['pass-cluster', 'fail-cluster'].flatMap((fixture_id, i) => [0, 1, 2].map((repeat) => ({
    fixture_id, repeat, language: 'en', safe: i === 0, pairNaturalness: i === 0 ? 4 : 2,
  })));
  return { first: items, second: clone(items) };
}

test('fixture bootstrap retains correlated repeats and uses paired draws for candidates', () => {
  const input = pairedItems(), before = JSON.stringify(input);
  const result = fixtureBootstrap(input, { iterations: 200, seed: 3 });
  assert.equal(result.clusters, 2); assert.equal(result.strata.en, 2);
  assert.equal(result.byCandidate.first.safeRate.lower, 0);
  assert.equal(result.byCandidate.first.safeRate.upper, 1);
  assert.equal(result.pairs[0].safeRateDifference, 0);
  assert.equal(result.pairs[0].interval.lower, 0); assert.equal(result.pairs[0].interval.upper, 0);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(result, fixtureBootstrap(input, { iterations: 200, seed: 3 }));
});

test('language stratification preserves allocation and null naturalness replicates remain explicit', () => {
  const input = pairedItems();
  for (const rows of Object.values(input)) for (const row of rows) {
    row.language = row.fixture_id === 'pass-cluster' ? 'en' : 'ko'; row.pairNaturalness = null;
  }
  const result = fixtureBootstrap(input, { iterations: 40, seed: 7 });
  assert.equal(result.byCandidate.first.safeRate.lower, .5); assert.equal(result.byCandidate.first.safeRate.upper, .5);
  assert.equal(result.byCandidate.first.naturalnessMedian.lower, null);
  assert.equal(result.byCandidate.first.naturalnessMedian.missingReplicates, 40);
  assert.equal(result.byCandidate.first.byLanguage.zh.safeRate.validReplicates, 0);
});

test('bootstrap rejects broken pairing, duplicated rows, and unbounded work', () => {
  const input = pairedItems(); input.second.pop();
  assert.throws(() => fixtureBootstrap(input), /pairing differs/);
  const duplicate = pairedItems(); duplicate.first.push(duplicate.first[0]); duplicate.second.push(duplicate.second[0]);
  assert.throws(() => fixtureBootstrap(duplicate), /duplicates/);
  assert.throws(() => fixtureBootstrap(pairedItems(), { iterations: 1 }), /bound/);
  assert.throws(() => fixtureBootstrap(pairedItems(), { iterations: 10001 }), /bound/);
});

test('public report reproduces its Markdown and includes all terminal evidence', () => {
  const value = report();
  assert.equal(renderConfirmation(value), readFileSync(resolve(ROOT, 'docs/research/model-rewrite-confirmation-20260905.md'), 'utf8'));
  assert.equal(value.coverage.candidates, 6); assert.equal(value.coverage.generations, 612);
  assert.equal(value.coverage.observedJudgments, 1224); assert.equal(value.coverage.expectedJudgments, 1224);
  assert.equal(value.coverage.judgedReceipts, 3672); assert.equal(value.coverage.generationReceipts, 612);
  assert.equal(Object.values(value.coverage.statusTransitions).reduce((a, b) => a + b), 1224);
  assert.ok(value.coverage.statusTransitions['ok->error'] > 0);
  assert.ok(value.coverage.statusTransitions['error->ok'] > 0);
  assert.equal(value.coverage.byOriginalEvaluator.G.statusTransitions['ok->error'], 0);
  assert.equal(value.coverage.byOriginalEvaluator.G.statusTransitions['error->ok'], 0);
  assert.equal(value.candidates.length, FINALISTS.length);
  for (const candidate of value.candidates) {
    assert.equal(candidate.overall.generations, 102); assert.equal(candidate.overall.observedJudgments, 204);
    assert.equal(candidate.overall.fixtureClusters, 34);
    assert.equal(candidate.provenance.generationJob.state, 'completed');
    assert.equal(candidate.provenance.generationJob.exitCode, 0);
    assert.equal(candidate.provenance.judgments.length, 2);
    for (const evidence of candidate.provenance.judgments) {
      assert.equal(evidence.rows, 102); assert.equal(evidence.job.state, 'completed'); assert.equal(evidence.job.exitCode, 0);
      assert.match(evidence.receiptManifestHash, /^[a-f0-9]{64}$/);
      assert.match(evidence.originalProtocolHash, /^[a-f0-9]{64}$/);
    }
    for (const field of ['generations', 'observedJudgments', 'judgmentErrors', 'safe']) assert.equal(
      Object.values(candidate.byLanguage).reduce((n, slice) => n + slice[field], 0), candidate.overall[field]);
    for (const stage of ['mps', 'fidelity', 'naturalness']) assert.equal(Object.values(candidate.byLanguage)
      .reduce((n, slice) => n + slice.stages[stage].scores.n, 0), candidate.overall.stages[stage].scores.n);
  }
  assert.equal(value.uncertainty.clusters, 34); assert.equal(value.uncertainty.pairs.length, 15);
  assert.deepEqual(value.uncertainty.strata, { en: 11, ko: 11, zh: 6, ja: 6 });
});

test('report ranks use only the existing rule and retain attempted denominators', () => {
  const value = report();
  for (const rank of value.ranks) {
    const candidate = value.candidates.find((row) => row.id === rank.id);
    assert.equal(rank.attempted, 102); assert.equal(rank.safe, candidate.overall.safe);
    assert.equal(rank.safeRate, rank.safe / 102);
    assert.equal(rank.naturalnessMedian, candidate.overall.pairNaturalness.median);
    assert.equal(rank.generationMedianMs, candidate.overall.generationLatencyMs.median);
  }
  for (let i = 1; i < value.ranks.length; i++) assert.ok(value.ranks[i - 1].safeRate >= value.ranks[i].safeRate);
});

test('public content is allowlisted summaries without source text or response bodies', () => {
  const value = report(), source = JSON.stringify(value);
  const forbidden = new Set(['text', 'rewrite', 'anchors', 'rationale', 'private_details', 'response', 'calls', 'apiKey', 'authorization', 'original']);
  function walk(value) {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { assert.ok(!forbidden.has(key), key); walk(child); }
  }
  walk(value);
  assert.doesNotMatch(source, /\/home\/|Bearer |PRIVATE KEY/);
  assert.ok(value.limits.some((limit) => limit.includes('echoes a requested alias')));
  assert.ok(value.metricDefinitions.latency.includes('shared concurrent load'));
  assert.ok(value.limits.some((limit) => limit.includes('no authenticated human')));
});

test('CLI offers only offline operations and redacts rejected arguments', () => {
  const help = execFileSync(process.execPath, ['scripts/research/confirm-model-results.mjs', '--help'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(help, /offline only/); assert.doesNotMatch(help, /--live/);
  assert.throws(() => execFileSync(process.execPath, ['scripts/research/confirm-model-results.mjs', '--live', 'do-not-echo'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }),
    (error) => error.stderr.trim() === 'model-confirmation: invalid argument');
});

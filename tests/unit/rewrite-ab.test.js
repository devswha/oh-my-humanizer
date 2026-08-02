import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { editChurn, pickWinner, compareRewrites, DEFAULT_CONFIGS, REWRITE_AB_SCHEMA_VERSION } from '../../scripts/rewrite-ab.mjs';

test('editChurn is 0 for identical text, 1 for fully disjoint, fractional otherwise', () => {
  assert.equal(editChurn('a b c', 'a b c'), 0);
  assert.equal(editChurn('a b c', 'x y z'), 1);
  assert.equal(editChurn('a b c d', 'a b x d'), 0.25); // LCS a,b,d = 3 of 8 tokens
  assert.equal(editChurn('', ''), 0);
});

test('pickWinner takes lowest after-score among floor-passing configs', () => {
  const winner = pickWinner([
    { config: 'single', after_score: 40, mps: 80, fidelity: 80, churn: 0.2 },
    { config: 'iterative-baseline', after_score: 20, mps: 85, fidelity: 85, churn: 0.3 },
  ]);
  assert.equal(winner, 'iterative-baseline');
});

test('pickWinner returns none when no config preserves meaning (floors)', () => {
  const winner = pickWinner([
    { config: 'single', after_score: 10, mps: 50, fidelity: 90, churn: 0.1 }, // mps < 70
    { config: 'iterative-baseline', after_score: 12, mps: 90, fidelity: 50, churn: 0.1 }, // fidelity < 70
  ]);
  assert.equal(winner, 'none');
});

test('pickWinner breaks after-score ties on lower churn', () => {
  const winner = pickWinner([
    { config: 'single', after_score: 20, mps: 80, fidelity: 80, churn: 0.5 },
    { config: 'iterative-baseline', after_score: 20, mps: 80, fidelity: 80, churn: 0.2 },
  ]);
  assert.equal(winner, 'iterative-baseline');
});

test('compareRewrites grades both configs, picks winners, and aggregates (injected produce/grade)', async () => {
  const fixtures = [
    { fixture_id: 'f1', language: 'ko', register: 'blog', text: '원문 문장 하나 둘 셋' },
    { fixture_id: 'f2', language: 'ko', register: 'blog', text: '다른 원문 가 나 다' },
  ];
  // The iterative baseline returns a cleaner (lower after-score) rewrite; both preserve meaning.
  const graded = {
    single: { before_score: 60, after_score: 40, ai_delta: 20, mps: 80, fidelity: 82, status: 'warn' },
    'iterative-baseline': { before_score: 60, after_score: 20, ai_delta: 40, mps: 85, fidelity: 88, status: 'pass' },
  };
  const produce = async (config) => `rewrite-${config}`;
  const grade = async (_fixture, raw) => graded[raw.replace('rewrite-', '')];

  const report = await compareRewrites({ fixtures, configs: DEFAULT_CONFIGS, produce, grade });

  assert.equal(report.results.length, 2);
  assert.equal(report.schema_version, REWRITE_AB_SCHEMA_VERSION);
  assert.equal(report.schema_version, 2);
  assert.equal(report.results[0].winner, 'iterative-baseline');
  assert.equal(report.results[1].winner, 'iterative-baseline');
  assert.equal(report.summary.wins['iterative-baseline'], 2);
  assert.equal(report.summary.wins.single, 0);
  assert.equal(report.summary.byConfig['iterative-baseline'].mean_after_score, 20);
  assert.equal(report.summary.byConfig.single.mean_after_score, 40);
  assert.equal(report.summary.byConfig['iterative-baseline'].wins, 2);
  // both entries present per fixture
  assert.equal(report.results[0].entries.length, 2);
});

test('compareRewrites records errors from a failing producer without aborting', async () => {
  const fixtures = [{ fixture_id: 'f1', language: 'ko', text: '원문' }];
  const produce = async (config) => {
    if (config === 'iterative-baseline') throw new Error('boom');
    return 'ok';
  };
  const grade = async () => ({ after_score: 30, mps: 80, fidelity: 80 });
  const report = await compareRewrites({ fixtures, configs: ['single', 'iterative-baseline'], produce, grade });
  const iterativeBaseline = report.results[0].entries.find((e) => e.config === 'iterative-baseline');
  assert.equal(iterativeBaseline.status, 'error');
  assert.deepEqual(iterativeBaseline.errors, ['boom']);
  // single still graded and wins
  assert.equal(report.results[0].winner, 'single');
});

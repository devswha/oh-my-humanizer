import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRawMps } from '../../scripts/research/study-validation.mjs';

test('MPS polarity counters include preserved negation anchors', () => {
  const value = { anchors: [
    { type: 'claim', content: 'The report arrives Friday.', verdict: 'PASS' },
    { type: 'claim', content: 'The team approved it.', verdict: 'SOFT_FAIL' },
    { type: 'negation', content: 'There is no fee.', verdict: 'PASS' },
  ], pass_count: 2, total_count: 3, polarity_pass_count: 1, polarity_total_count: 1, mps: 80 };
  assert.equal(validateRawMps(JSON.stringify(value)).mps, 80);
  assert.throws(() => validateRawMps(JSON.stringify({ ...value, polarity_pass_count: 0, polarity_total_count: 0, mps: 66.7 })), /counts/);
});

test('failed negation carries the documented polarity weight and remains a hard failure', () => {
  const value = { anchors: [
    { type: 'claim', content: 'The report arrives Friday.', verdict: 'PASS' },
    { type: 'negation', content: 'There is no fee.', verdict: 'HARD_FAIL' },
  ], pass_count: 1, total_count: 2, polarity_pass_count: 0, polarity_total_count: 1, mps: 30 };
  assert.equal(validateRawMps(JSON.stringify(value)).hard_fail_count, 1);
  assert.throws(() => validateRawMps(JSON.stringify({ ...value, mps: 50 })), /score/);
});

test('polarity and negation are counted together without inventing polarity for ordinary claims', () => {
  const value = { anchors: [
    { type: 'polarity', content: 'The team opposes the change.', verdict: 'PASS' },
    { type: 'negation', content: 'There is no fee.', verdict: 'SOFT_FAIL' },
  ], pass_count: 1, total_count: 2, polarity_pass_count: 1, polarity_total_count: 2, mps: 50 };
  assert.equal(validateRawMps(JSON.stringify(value)).mps, 50);
  assert.throws(() => validateRawMps(JSON.stringify({ ...value, polarity_total_count: 1, mps: 70 })), /counts/);
  assert.equal(validateRawMps(JSON.stringify({ anchors: [{ type: 'claim', content: 'It arrives Friday.', verdict: 'PASS' }], pass_count: 1, total_count: 1, polarity_pass_count: 0, polarity_total_count: 0, mps: 100 })).mps, 100);
});

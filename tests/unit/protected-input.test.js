import test from 'node:test';
import assert from 'node:assert/strict';
import { protectedInputSpans, mergeProtectedSpans } from '../../playground/protected-input.js';

test('protected input preserves every occurrence of Unicode and punctuation literals', () => {
  const text = '🚀 ACME-Pro와 A/B입니다. ACME-Pro를 쓰세요.';
  const spans = protectedInputSpans(text, ' ACME-Pro\nA/B\nACME-Pro ');
  assert.deepEqual(spans.map(({ start, end }) => text.slice(start, end)), ['ACME-Pro', 'A/B', 'ACME-Pro']);
  assert.equal(spans[0].start, 3);
});

test('protected input refuses missing, overlapping and excessive occurrences', () => {
  assert.throws(() => protectedInputSpans('ACME-Pro', 'ACME-Pro\nACME'));
  assert.throws(() => protectedInputSpans('ACME-Pro', 'Other'));
  assert.throws(() => protectedInputSpans('A '.repeat(21), 'A'));
  assert.deepEqual(protectedInputSpans('Anything', '\n '), []);
});

test('review keeps earlier protected phrases when additional constraints are selected', () => {
  const original = 'ACME-Pro uses A/B.';
  const prior = protectedInputSpans(original, 'ACME-Pro');
  const current = protectedInputSpans(original, 'ACME-Pro\nA/B');
  assert.deepEqual(mergeProtectedSpans(original, prior, current), current);
  assert.deepEqual(mergeProtectedSpans(original, prior, []), prior);
});

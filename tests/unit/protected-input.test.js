import test from 'node:test';
import assert from 'node:assert/strict';
import { protectedInputSpans } from '../../playground/protected-input.js';

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

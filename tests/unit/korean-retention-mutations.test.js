import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Korean retention mutations cover the preregistered semantic dimensions', () => {
  const fixtures = readFileSync(
    resolve('tests/fixtures/ko-performance/retention-mutations.jsonl'),
    'utf8',
  ).trim().split('\n').map((line) => JSON.parse(line));
  const expected = [
    'approximation',
    'modality',
    'contrast',
    'emphasis',
    'possibility',
    'honorific',
    'addressee_relation',
    'speech_level',
  ];

  assert.equal(fixtures.length, 16);
  assert.deepEqual([...new Set(fixtures.map((fixture) => fixture.property))].sort(), expected.sort());
  for (const property of expected) {
    assert.equal(fixtures.filter((fixture) => fixture.property === property).length, 2);
  }
  for (const fixture of fixtures) {
    assert.notEqual(fixture.original, fixture.mutation, fixture.fixture_id);
    assert.ok(fixture.anchor, fixture.fixture_id);
  }
});

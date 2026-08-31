import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { evaluateKoreanInvariants } from '../../src/features/korean-invariants.js';

const fixturePath = resolve('tests/fixtures/ko-performance/invariant-mutations.jsonl');

test('Korean invariant mutations fail only their preregistered property', () => {
  // Given: independently reviewable one-property Korean mutations.
  const fixtures = readFileSync(fixturePath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

  // When: each mutation is evaluated.
  const results = fixtures.map((fixture) => ({
    fixture,
    result: evaluateKoreanInvariants(fixture.original, fixture.mutation),
  }));

  // Then: every mutation fails its declared invariant.
  assert.equal(fixtures.length, 20);
  for (const { fixture, result } of results) {
    assert.equal(
      result.checks[fixture.expected_failure].ok,
      false,
      fixture.fixture_id,
    );
    for (const [name, check] of Object.entries(result.checks)) {
      if (name !== fixture.expected_failure) {
        assert.equal(check.ok, true, `${fixture.fixture_id}:${name}`);
      }
    }
    assert.equal(result.ok, false, fixture.fixture_id);
  }
});

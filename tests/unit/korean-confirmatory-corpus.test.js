import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadLiveFixtures } from '../quality/live-quality.mjs';

const corpusPath = resolve('tests/fixtures/ko-performance/confirmatory.jsonl');
const domains = [
  'report',
  'email',
  'public-document',
  'product-marketing',
  'review',
  'technical-explanation',
  'column-essay',
  'social-blog',
];

test('Korean confirmatory corpus freezes 120 balanced long-form fixtures', () => {
  const fixtures = readFileSync(corpusPath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const loaded = loadLiveFixtures(corpusPath);

  assert.equal(fixtures.length, 120);
  assert.equal(loaded.length, 120);
  assert.equal(new Set(fixtures.map((fixture) => fixture.fixture_id)).size, 120);
  for (const domain of domains) {
    assert.equal(fixtures.filter((fixture) => fixture.domain === domain).length, 15);
  }
  for (const fixture of fixtures) {
    assert.equal(fixture.language, 'ko');
    assert.equal(fixture.redistribution, 'repo-ok');
    assert.ok(fixture.text.length >= 180, fixture.fixture_id);
    assert.equal(fixture.text.split('\n\n').length, 2, fixture.fixture_id);
    assert.ok(Array.isArray(fixture.anchors) && fixture.anchors.length >= 2, fixture.fixture_id);
    assert.deepEqual(
      Object.keys(fixture.mutations).sort(),
      ['causation', 'entity_roles', 'numbers', 'polarity'],
      fixture.fixture_id,
    );
  }
});

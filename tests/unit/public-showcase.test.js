import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateShowcase, loadShowcase, buildShowcaseArtifacts } from '../../scripts/public-showcase.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const fixtures = () => ['ko', 'en', 'zh', 'ja'].flatMap(lang => [1, 2, 3].map(index => ({
  id: `${lang}-example-${index}`, lang, label: 'Example', before: 'The meeting starts at 10.',
  after: 'The meeting starts at 10.', caption: 'The time stays the same.', kind: 'illustrative',
})));

test('showcase rejects missing languages, fabricated numbers, duplicate IDs and unearned score claims', () => {
  assert.equal(validateShowcase(fixtures()).length, 12);
  assert.throws(() => validateShowcase(fixtures().filter(row => row.lang !== 'ja')), /three ja/);
  const numbers = fixtures(); numbers[0].after = 'The meeting starts at 10 for 20 people.';
  assert.throws(() => validateShowcase(numbers), /numeric tokens/);
  const duplicate = fixtures(); duplicate[1].id = duplicate[0].id;
  assert.throws(() => validateShowcase(duplicate), /duplicate/);
  const scored = fixtures(); scored[0].mps = 100;
  assert.throws(() => validateShowcase(scored), /measured-score/);
});

test('four-language public pages and cards match their shared source pairs', async () => {
  const rows = await loadShowcase(root);
  assert.equal(rows.length, 12);
  for (const [file, contents] of buildShowcaseArtifacts(rows)) {
    assert.equal(readFileSync(resolve(root, file), 'utf8'), contents, `${file} must be regenerated from the shared examples`);
  }
  const evidence = JSON.parse(readFileSync(resolve(root, 'docs/benchmarks/public-examples-20260907.json'), 'utf8'));
  assert.equal(evidence.modelRated, true);
  assert.equal(evidence.humanRatings, false);
  assert.equal(evidence.rows.length, rows.length);
  const hash = value => createHash('sha256').update(value).digest('hex');
  for (const row of rows) {
    const recorded = evidence.rows.find(entry => entry.id === row.id);
    assert.ok(recorded, `${row.id}: missing recorded example check`);
    assert.equal(recorded.sourceHash, hash(row.before), `${row.id}: source changed after the recorded check`);
    assert.equal(recorded.outputHash, hash(row.after), `${row.id}: output changed after the recorded check`);
  }
});

test('showcase cards retain complete text instead of silently clipping long source claims', () => {
  const rows = fixtures();
  for (const row of rows.filter(row => row.lang === 'ko')) row.before = 'The meeting starts at 10. ' + 'This sentence is deliberately long. '.repeat(20);
  assert.throws(() => buildShowcaseArtifacts(rows), /No ko example fits/);
});

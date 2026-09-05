import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  normalizeProtectedSpans,
  validateProtectedText,
  createTextEdits,
  applyTextEdits,
} from '../../src/edit-controls.js';

const accepted = { ok: true, reason: null };
const changed = { ok: false, reason: 'protected_text_changed' };
const ambiguous = { ok: false, reason: 'protected_text_ambiguous' };

function rejectsCode(fn, code) {
  assert.throws(fn, (error) => error instanceof TypeError && error.code === code && error.message === code);
}

function codePointBoundaries(text) {
  const boundaries = new Set([0]);
  let offset = 0;
  for (const character of text) {
    offset += character.length;
    boundaries.add(offset);
  }
  return boundaries;
}

// Independent application oracle: replace from the end using original indices.
function applyFromEnd(original, edits) {
  return [...edits].reverse().reduce((text, edit) =>
    text.slice(0, edit.start) + edit.replacement + text.slice(edit.end), original);
}

function assertRoundTrip(original, output) {
  const edits = createTextEdits(original, output);
  assert.deepEqual(createTextEdits(original, output), edits, 'deterministic edit list');
  const boundaries = codePointBoundaries(original);
  let end = 0;
  let previousStart = -1;
  for (const edit of edits) {
    assert.deepEqual(Object.keys(edit).sort(), ['end', 'replacement', 'start']);
    assert.ok(Number.isInteger(edit.start) && Number.isInteger(edit.end));
    assert.ok(edit.start >= end && edit.start > previousStart && edit.end >= edit.start);
    assert.ok(boundaries.has(edit.start) && boundaries.has(edit.end), 'whole code points');
    assert.notEqual(original.slice(edit.start, edit.end), edit.replacement, 'no redundant edits');
    end = edit.end;
    previousStart = edit.start;
  }
  assert.equal(applyFromEnd(original, edits), output, 'independent round trip');
  assert.equal(applyTextEdits(original, edits), output, 'public round trip');
  return edits;
}

// Seeded test data without runtime randomness or fixture dependencies.
function randomGenerator(seed) {
  let value = seed;
  return (limit) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value % limit;
  };
}

test('normalization binds exact UTF-16 literals, sorts copies, and permits adjacent spans', () => {
  const original = 'A😀한字 café';
  const spans = Object.freeze([
    Object.freeze({ start: 3, end: 5 }),
    Object.freeze({ start: 1, end: 3 }),
    Object.freeze({ start: 0, end: 1 }),
  ]);
  const normalized = normalizeProtectedSpans(original, spans);
  assert.deepEqual(normalized, [
    { start: 0, end: 1, text: 'A' },
    { start: 1, end: 3, text: '😀' },
    { start: 3, end: 5, text: '한字' },
  ]);
  assert.equal(spans[0].start, 3);
  assert.deepEqual(normalizeProtectedSpans(original, normalized), normalized);
  assert.deepEqual(normalizeProtectedSpans(''), []);
  assert.deepEqual(normalizeProtectedSpans(original, []), []);
});

test('protected ranges reject invalid types, empty/out-of-range indices, and surrogate splits', () => {
  for (const spans of [null, {}, 'range', 4]) {
    rejectsCode(() => normalizeProtectedSpans('a😀b', spans), 'invalid_protected_spans');
  }
  for (const span of [null, undefined, [], 'range', 4]) {
    rejectsCode(() => normalizeProtectedSpans('a😀b', [span]), 'invalid_protected_span');
  }
  for (const span of [
    {}, { start: '0', end: 1 }, { start: 0, end: '1' },
    { start: 0.5, end: 1 }, { start: 0, end: 1.5 },
    { start: -1, end: 1 }, { start: 0, end: 5 },
    { start: 1, end: 1 }, { start: 3, end: 1 },
    { start: NaN, end: 1 }, { start: 0, end: Infinity },
    { start: 0n, end: 1 }, { start: false, end: 1 },
  ]) rejectsCode(() => normalizeProtectedSpans('a😀b', [span]), 'invalid_span_range');
  for (const span of [{ start: 1, end: 2 }, { start: 2, end: 3 }]) {
    rejectsCode(() => normalizeProtectedSpans('a😀b', [span]), 'span_splits_surrogate');
  }
  rejectsCode(() => normalizeProtectedSpans('', [{ start: 0, end: 1 }]), 'invalid_span_range');
});

test('overlap, duplicate ranges, stale snapshots, and the 20-span cap fail closed', () => {
  for (const spans of [
    [{ start: 0, end: 3 }, { start: 2, end: 4 }],
    [{ start: 1, end: 2 }, { start: 0, end: 3 }],
    [{ start: 0, end: 1 }, { start: 0, end: 1 }],
  ]) rejectsCode(() => normalizeProtectedSpans('abcd', spans), 'overlapping_protected_spans');
  const bound = normalizeProtectedSpans('old claim', [{ start: 0, end: 3 }]);
  rejectsCode(() => normalizeProtectedSpans('new claim', bound), 'protected_span_mismatch');
  assert.deepEqual(validateProtectedText('new claim', 'old claim', bound), {
    ok: false, reason: 'protected_span_mismatch',
  });
  for (const text of [null, undefined, 1, 'OLD']) {
    rejectsCode(() => normalizeProtectedSpans('old', [{ start: 0, end: 3, text }]), 'protected_span_mismatch');
  }
  const spans = Array.from({ length: 20 }, (_, start) => ({ start, end: start + 1 }));
  assert.equal(normalizeProtectedSpans('x'.repeat(20), spans).length, 20);
  rejectsCode(() => normalizeProtectedSpans('x'.repeat(21), [...spans, { start: 20, end: 21 }]), 'too_many_protected_spans');
});

test('protection accepts moved literals but requires exact global counts and occurrence order', () => {
  const original = 'fee 10%; fee 10%; final';
  const spans = [{ start: original.indexOf('final'), end: original.length }, { start: 0, end: 7 }, { start: 9, end: 16 }];
  assert.deepEqual(validateProtectedText(original, 'Now: fee 10%. Then fee 10%. The final result.', spans), accepted);
  assert.deepEqual(validateProtectedText(original, 'fee 10% fee 10% fee 10% final', spans), changed);
  assert.deepEqual(validateProtectedText(original, 'fee 10% final', spans), changed);
  assert.deepEqual(validateProtectedText(original, 'final fee 10% fee 10%', spans), changed);
  assert.deepEqual(validateProtectedText(original, 'fee 10% fee 11% final', spans), changed);
  assert.deepEqual(validateProtectedText('aa aa', 'aa', [{ start: 0, end: 2 }, { start: 3, end: 5 }]), changed);
  assert.deepEqual(validateProtectedText('aa aa', 'aa aa', [{ start: 0, end: 2 }, { start: 3, end: 5 }]), accepted);
});

test('choosing one span protects every identical literal against deletion or fabricated duplication', () => {
  const original = 'red blue red';
  const spans = [{ start: 9, end: 12 }, { start: 4, end: 8 }];
  for (const output of ['blue red', 'red blue', 'red red blue', 'red blue red red', 'red blue blue red']) {
    assert.deepEqual(validateProtectedText(original, output, spans), changed, output);
  }
  assert.deepEqual(validateProtectedText(original, 'red and blue then red', spans), accepted);
  assert.deepEqual(validateProtectedText('same same', 'same', [{ start: 5, end: 9 }]), changed);
  assert.deepEqual(validateProtectedText('same', 'same same', [{ start: 0, end: 4 }]), changed);
  assert.deepEqual(validateProtectedText('same same', 'same same', [{ start: 5, end: 9 }]), accepted);
  assert.deepEqual(validateProtectedText('cat at', 'cat at', [{ start: 0, end: 3 }]), accepted);
});

test('overlapping occurrences and nested selected literals fail conservatively in either text', () => {
  assert.deepEqual(validateProtectedText('aaaa', 'aaaa', [{ start: 0, end: 2 }]), ambiguous);
  assert.deepEqual(validateProtectedText('aa aa', 'aaaa', [{ start: 0, end: 2 }]), ambiguous);
  assert.deepEqual(validateProtectedText('aaaa', 'aa aa', [{ start: 0, end: 2 }]), ambiguous);
  assert.deepEqual(validateProtectedText('cat at', 'cat at', [{ start: 0, end: 3 }, { start: 4, end: 6 }]), ambiguous);
  assert.deepEqual(validateProtectedText('ab bc', 'abc', [{ start: 0, end: 2 }, { start: 3, end: 5 }]), ambiguous);
  assert.deepEqual(validateProtectedText('😀😀😀', '😀😀😀', [{ start: 0, end: 4 }]), ambiguous);
});

test('literal protection does not normalize, interpret regex, repair text, or prove semantic alignment', () => {
  for (const [original, output] of [
    ['café', 'cafe\u0301'], ['A B', 'A  B'], ['Keep', 'keep'],
    ['10%', '１０％'], ['[a].*', 'axxx'], ['👩‍💻', '👨‍💻'], ['줄\n바꿈', '줄 바꿈'],
  ]) {
    const span = [{ start: 0, end: original.length }];
    assert.deepEqual(validateProtectedText(original, output, span), changed);
    assert.deepEqual(validateProtectedText(original, `(${original})`, span), accepted);
  }
  const output = 'changed literal';
  assert.deepEqual(validateProtectedText('keep literal', output, [{ start: 0, end: 4 }]), changed);
  assert.equal(output, 'changed literal');
  assert.deepEqual(validateProtectedText('Alex paid; Alex left', 'Alex left; Alex paid', [{ start: 0, end: 4 }]), accepted,
    'exact literal counts/order do not prove source-instance semantic alignment');
  assert.deepEqual(validateProtectedText('old', 'unrelated', []), accepted);
});

test('lone surrogate literals cannot be matched inside a newly formed pair', () => {
  for (const original of ['\uD83D', '\uDE00']) {
    assert.deepEqual(validateProtectedText(original, '😀', [{ start: 0, end: 1 }]), changed);
    assert.deepEqual(validateProtectedText(original, `😀 ${original}`, [{ start: 0, end: 1 }]), accepted);
  }
});

test('global occurrence validation agrees with a character-sequence oracle on repeated selected literals', () => {
  const random = randomGenerator(831);
  for (let i = 0; i < 400; i++) {
    const makeText = () => Array.from({ length: 1 + random(12) }, () => ['a', 'b', ' '][random(3)]).join('');
    const original = makeText();
    const output = makeText();
    const spans = [];
    for (let start = 0; start < original.length; start++) {
      if (random(2)) spans.push({ start, end: start + 1 });
    }
    const selected = new Set(spans.map(({ start }) => original[start]));
    const sequence = (text) => [...text].filter((character) => selected.has(character)).join('');
    const expected = sequence(original) === sequence(output);
    assert.deepEqual(validateProtectedText(original, output, spans), expected ? accepted : changed);
  }
});

test('diff round trips Unicode, CJK, emoji sequences, combining marks, whitespace, and empty text exactly', () => {
  for (const [original, output] of [
    ['', ''], ['', '😀'], ['😀', ''], ['same\r\n', 'same\r\n'],
    ['The red kite flies.', 'The green kite flies.'],
    ['첫 설명입니다. 유지할 문장입니다. 마지막 결론입니다.', '새 설명입니다. 유지할 문장입니다. 다른 결론입니다.'],
    ['第一段說明。保持這段文字。最後結論。', '第一段介紹。保持這段文字。結尾總結。'],
    ['最初の説明。ここは残す。最後の結論。', '新しい説明。ここは残す。別の結論。'],
    ['👩‍💻 works 👍🏽.', '👨‍💻 works 👍🏻.'], ['🇰🇷 🇯🇵', '🇨🇳 🇯🇵'], ['1️⃣ two', '2️⃣ two'],
    ['cafe\u0301 stays naïve', 'café stays naive'], ['عربي עברית', 'عربية עברית'],
    ['\tA\r\nB\u2028C\u00A0', ' A\nB\u2029C '],
    ['<tag> & [a].*', '<other> & literal'], ['x\u0000y', 'x\u0000z'],
    ['\uD800 x \uDC00', '\uD800 y \uDC00'], ['😀', '😁'],
    ['\uD83D x \uDE00', '😀'], ['a b c', 'c b a'],
  ]) assertRoundTrip(original, output);
});

test('separated changes remain selectable with original offsets and no verification metadata', () => {
  const original = 'The red kite flies. The blue boat sails.';
  const output = 'The green kite flies. The gold boat sails.';
  const edits = assertRoundTrip(original, output);
  assert.equal(edits.length, 2);
  const frozen = Object.freeze(edits.map((edit) => Object.freeze(edit)));
  assert.equal(applyTextEdits(original, []), original);
  assert.equal(applyTextEdits(original, [frozen[0]]), 'The green kite flies. The blue boat sails.');
  assert.equal(applyTextEdits(original, [frozen[1]]), 'The red kite flies. The gold boat sails.');
  assert.equal(applyTextEdits(original, frozen), output);
  assert.deepEqual(createTextEdits(original, original), []);
});

test('ambiguous repeated text safely falls back to a coarse replacement', () => {
  const original = 'a a a a a';
  const output = 'b b b b b';
  assert.deepEqual(assertRoundTrip(original, output), [{ start: 0, end: original.length, replacement: output }]);
  for (const [before, after] of [
    ['a b a b', 'b a b a'], ['同じ。同じ。同じ。', '同じ。別。同じ。'],
    ['😀😀😀', '😀😁😀'], ['x a x b x', 'x b x a x'],
  ]) assertRoundTrip(before, after);
});

test('seeded arbitrary text and edit subsets preserve the exact round-trip invariant', () => {
  const random = randomGenerator(20260905);
  const alphabet = ['a', 'same', ' ', '\n', '\r\n', '😀', '👩‍💻', '👍🏽', '🇰🇷', '한글', '字', 'かな',
    'e\u0301', '\u0301', '\uD800', '\uDC00', '\u200D', '\uFE0F', '\u0000', '.', '—', '\t', '1️⃣'];
  const makeText = () => Array.from({ length: random(70) }, () => alphabet[random(alphabet.length)]).join('');
  for (let i = 0; i < 1000; i++) {
    const original = makeText();
    const output = makeText();
    const edits = assertRoundTrip(original, output);
    const subset = edits.filter(() => random(2));
    assert.equal(applyTextEdits(original, subset), applyFromEnd(original, subset));
  }
});

test('apply accepts insertion, deletion, adjacency, and a terminal insertion', () => {
  assert.equal(applyTextEdits('', [{ start: 0, end: 0, replacement: '😀' }]), '😀');
  assert.equal(applyTextEdits('abcd', [
    { start: 0, end: 1, replacement: 'AA' },
    { start: 1, end: 3, replacement: '' },
    { start: 4, end: 4, replacement: '!' },
  ]), 'AAd!');
  assert.equal(applyTextEdits('a', [{ start: 0, end: 0, replacement: '' }]), 'a');
});

test('apply rejects malformed, stale, unsorted, overlapping, and ambiguous same-start edits', () => {
  for (const edits of [undefined, null, {}, 'edits']) rejectsCode(() => applyTextEdits('abc', edits), 'invalid_edits');
  for (const edit of [undefined, null, [], 'edit', 1]) rejectsCode(() => applyTextEdits('abc', [edit]), 'invalid_edit');
  for (const edit of [
    {}, { start: '0', end: 1 }, { start: 0, end: 0.5 }, { start: -1, end: 0 },
    { start: 0, end: 5 }, { start: 2, end: 1 }, { start: NaN, end: 1 }, { start: 0, end: Infinity },
  ]) rejectsCode(() => applyTextEdits('abcd', [{ ...edit, replacement: '' }]), 'invalid_edit_range');
  for (const replacement of [undefined, null, {}, 42]) {
    rejectsCode(() => applyTextEdits('a', [{ start: 0, end: 1, replacement }]), 'invalid_edit_replacement');
  }
  for (const ranges of [
    [[2, 3], [0, 1]], [[0, 2], [1, 3]], [[0, 0], [0, 0]], [[0, 0], [0, 1]], [[0, 1], [0, 0]],
  ]) {
    rejectsCode(() => applyTextEdits('abcd', ranges.map(([start, end]) => ({ start, end, replacement: 'x' }))), 'edits_not_sorted_or_overlapping');
  }
  for (const [start, end] of [[1, 2], [2, 3], [2, 2]]) {
    rejectsCode(() => applyTextEdits('a😀b', [{ start, end, replacement: '' }]), 'edit_splits_surrogate');
  }
  rejectsCode(() => applyTextEdits('', [{ start: 0, end: 0, replacement: 'a' }, { start: 0, end: 0, replacement: 'b' }]), 'too_many_edits');
  const stale = createTextEdits('old tail', 'old end');
  rejectsCode(() => applyTextEdits('old', stale), 'invalid_edit_range');
  assert.equal(applyTextEdits('new tail', stale), 'new end', 'same-length stale sources require the upstream base hash');
});

test('text types and 20,000 UTF-16 unit limits are enforced without coercion', () => {
  for (const value of [undefined, null, 42, {}, new String('text')]) {
    rejectsCode(() => normalizeProtectedSpans(value), 'invalid_original');
    rejectsCode(() => createTextEdits(value, ''), 'invalid_original');
    rejectsCode(() => createTextEdits('', value), 'invalid_output');
    rejectsCode(() => applyTextEdits(value, []), 'invalid_original');
    assert.deepEqual(validateProtectedText('', value), { ok: false, reason: 'invalid_output' });
  }
  const limit = '😀'.repeat(10_000);
  const oversized = limit + 'x';
  assertRoundTrip(limit, '字'.repeat(20_000));
  assert.equal(normalizeProtectedSpans(limit, [{ start: 0, end: limit.length }])[0].text, limit);
  rejectsCode(() => normalizeProtectedSpans(oversized), 'original_too_long');
  rejectsCode(() => createTextEdits(oversized, ''), 'original_too_long');
  rejectsCode(() => createTextEdits('', oversized), 'output_too_long');
  rejectsCode(() => applyTextEdits(oversized, []), 'original_too_long');
  assert.deepEqual(validateProtectedText('', oversized), { ok: false, reason: 'output_too_long' });
  rejectsCode(() => applyTextEdits(limit, [{ start: 0, end: 0, replacement: 'x' }]), 'result_too_long');
  assert.equal(applyTextEdits('ab', [
    { start: 0, end: 1, replacement: 'x'.repeat(20_000) },
    { start: 1, end: 2, replacement: '' },
  ]).length, 20_000, 'later deletion is included when bounding the result');
});

test('bounded long inputs cover dense changes, reversed unique anchors, and repeated Unicode', () => {
  const words = Array.from({ length: 3000 }, (_, i) => `w${i}`);
  assertRoundTrip(words.join(' '), [...words].reverse().join(' '));
  assertRoundTrip('a '.repeat(10_000), 'b '.repeat(10_000));
  assertRoundTrip('😀 '.repeat(6666), '😁 '.repeat(6666));
  assertRoundTrip('同。'.repeat(10_000), '別。'.repeat(10_000));
  assertRoundTrip('x'.repeat(19_999) + 'a', 'x'.repeat(19_999) + 'b');
});

test('module executes with standard JavaScript globals and no Node or imported dependencies', () => {
  const script = `
    import { readFileSync } from 'node:fs';
    import { createContext, SourceTextModule } from 'node:vm';
    const context = createContext({});
    const module = new SourceTextModule(readFileSync(process.argv[1], 'utf8'), { context });
    await module.link(() => { throw new Error('Unexpected import'); });
    await module.evaluate();
    const { createTextEdits, applyTextEdits, normalizeProtectedSpans, validateProtectedText } = module.namespace;
    const original = '한😀字 old';
    const output = '한😀字 new';
    if (applyTextEdits(original, createTextEdits(original, output)) !== output) throw new Error('Round trip');
    const spans = normalizeProtectedSpans(original, [{ start: 1, end: 3 }]);
    if (!validateProtectedText(original, output, spans).ok) throw new Error('Protection');
  `;
  const result = spawnSync(process.execPath, [
    '--experimental-vm-modules', '--input-type=module', '-e', script,
    fileURLToPath(new URL('../../src/edit-controls.js', import.meta.url)),
  ], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});

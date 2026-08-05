import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyDocumentTypePatternPolicy, loadPatterns, loadDocumentType } from '../../src/loader.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// A tiny synthetic pack mirroring the real "### N. title" + `---` layout, so the
// stripping logic is tested independently of the live pattern catalog numbering.
const PACK_BODY = [
  '# Pack title',
  '',
  '### 1. First pattern',
  '',
  'Body of one.',
  '',
  '---',
  '',
  '### 2. Second pattern',
  '',
  'Body of two.',
  '',
  '---',
  '',
  '### 12. Twelfth pattern',
  '',
  'Body of twelve.',
  '',
  '---',
  '',
  '### 27. Last pattern',
  '',
  'Body of twenty-seven.',
].join('\n');

function pack(body) {
  return [{ file: 'xx-test.md', frontmatter: { pack: 'xx-test' }, body, isStructure: false, isScoreOnly: false }];
}

function documentTypeWith(overrides) {
  return { frontmatter: { 'pattern-overrides': overrides }, body: 'doc' };
}

test('suppress removes the exact section and leaves neighbours intact', () => {
  const [out] = applyDocumentTypePatternPolicy(pack(PACK_BODY), documentTypeWith({ xx: { 27: 'suppress' } }), 'xx');
  assert.match(out.body, /^### 1\. /m);
  assert.match(out.body, /^### 2\. /m);
  assert.match(out.body, /^### 12\. /m);
  assert.doesNotMatch(out.body, /^### 27\. /m);
  assert.ok(!out.body.includes('Body of twenty-seven'));
  assert.ok(out.body.includes('Body of twelve.'));
});

test('suppress never matches a substring id (12 ≠ 2, 27 ≠ 7)', () => {
  const [out] = applyDocumentTypePatternPolicy(pack(PACK_BODY), documentTypeWith({ xx: { 12: 'suppress' } }), 'xx');
  assert.doesNotMatch(out.body, /^### 12\. /m);
  assert.match(out.body, /^### 2\. /m, '#2 must survive when #12 is suppressed');
  assert.match(out.body, /^### 1\. /m);
});

test('multiple suppress ids are removed in one pass and seams stay clean', () => {
  const [out] = applyDocumentTypePatternPolicy(pack(PACK_BODY), documentTypeWith({ xx: { 1: 'suppress', 12: 'suppress' } }), 'xx');
  assert.doesNotMatch(out.body, /^### 1\. /m);
  assert.doesNotMatch(out.body, /^### 12\. /m);
  assert.match(out.body, /^### 2\. /m);
  assert.match(out.body, /^### 27\. /m);
  assert.ok(!/\n{3,}/.test(out.body), 'no triple-newline gaps left behind');
});

test('reduce is left in place (only suppress is wired in v1)', () => {
  const [out] = applyDocumentTypePatternPolicy(pack(PACK_BODY), documentTypeWith({ xx: { 12: 'reduce' } }), 'xx');
  assert.match(out.body, /^### 12\. /m, 'reduce must not remove the section');
});

test('no overrides for the language is an identity passthrough (same refs)', () => {
  const packs = pack(PACK_BODY);
  assert.equal(applyDocumentTypePatternPolicy(packs, documentTypeWith({ ko: { 1: 'suppress' } }), 'xx'), packs);
  assert.equal(applyDocumentTypePatternPolicy(packs, documentTypeWith({}), 'xx'), packs);
  assert.equal(applyDocumentTypePatternPolicy(packs, { frontmatter: null, body: '' }, 'xx'), packs);
  assert.equal(applyDocumentTypePatternPolicy(packs, null, 'xx'), packs);
});

test('integration: legal Document Type suppresses ko patterns 12/18/27 deterministically', () => {
  const raw = loadPatterns(REPO_ROOT, 'ko');
  const legal = loadDocumentType(REPO_ROOT, 'legal');
  const filtered = applyDocumentTypePatternPolicy(raw, legal, 'ko');
  const after = filtered.map((p) => p.body).join('\n\n');

  for (const id of [12, 18, 27]) {
    assert.doesNotMatch(after, new RegExp(`^### ${id}\\. `, 'm'), `legal must suppress ko #${id}`);
  }
  // A non-suppressed pattern and the reduce-only ones survive.
  assert.match(after, /^### 7\. /m);
  for (const id of [22, 23, 8]) {
    assert.match(after, new RegExp(`^### ${id}\\. `, 'm'), `reduce/untouched ko #${id} must survive`);
  }

  // The default Document Type changes nothing.
  const def = loadDocumentType(REPO_ROOT, 'default');
  assert.equal(applyDocumentTypePatternPolicy(raw, def, 'ko'), raw);
});

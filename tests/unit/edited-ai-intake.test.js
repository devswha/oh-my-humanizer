import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareEditedIntake, tokenEditRatio, validateEditedPair } from '../../scripts/research/edited-ai-intake.mjs';

const hash = (text) => createHash('sha256').update(text).digest('hex');
function row() {
  const original = 'The team will complete 12 reports by Friday.';
  const edited = 'The team will finish 12 reports by Friday.';
  return { sampleId: 'test-01', language: 'en', original, edited,
    source: { kind: 'model-generated', reviewed: true, originalHash: hash(original), evidenceHash: hash('test receipt'), reference: 'private-source-reference', model: 'test-model', reviewer: 'private-reviewer' },
    edit: { agent: 'model', depth: 'light', operations: ['word-substitution'] }, rights: { license: 'MIT', reviewed: true, sharing: 'panel-only' },
    meaningReview: { reviewed: true, loss: false, originalHash: hash(original), editedHash: hash(edited), reviewer: 'private-reviewer', evidenceHash: hash('test meaning review') }, note: 'private note' };
}

test('edited-AI intake separates origin, editor and depth without publishing text or identities', () => {
  const input = row(), result = validateEditedPair(input);
  assert.equal(result.publicRecord.eligibleForClaims, true);
  assert.equal(result.publicRecord.editingAgent, 'model');
  assert.equal(result.privateRecord.original, input.original);
  assert.doesNotMatch(JSON.stringify(result.publicRecord), /The team|private-reviewer|private note|private-source-reference/);
  assert.throws(() => validateEditedPair({ ...input, source: { ...input.source, kind: 'curated-fixture' } }), /provenance/);
});

test('light/deep policy and duplicate protection are enforced', () => {
  const input = row();
  assert.throws(() => validateEditedPair({ ...input, edit: { ...input.edit, operations: ['reorder'] } }), /Light/);
  assert.throws(() => validateEditedPair({ ...input, edit: { ...input.edit, depth: 'heavy' } }), /Heavy/);
  assert.throws(() => validateEditedPair({ ...input, edit: { ...input.edit, depth: 'heavy', operations: ['extensive-lexical'] } }), /Heavy/);
  assert.equal(validateEditedPair({ ...input, edit: { ...input.edit, depth: 'heavy', operations: ['reorder'] } }).publicRecord.editDepth, 'heavy');
  assert.throws(() => prepareEditedIntake([input, input]), /Duplicate/);
});

test('numeric failures and missing meaning reviews remain excluded observations', () => {
  const input = row();
  const edited = input.original.replace('12', '13');
  const unsafe = validateEditedPair({ ...input, edited, meaningReview: { ...input.meaningReview, editedHash: hash(edited) } });
  assert.equal(unsafe.publicRecord.eligibleForClaims, false);
  assert.ok(unsafe.publicRecord.exclusions.includes('numeric-proxy-failure'));
  const unreviewed = validateEditedPair({ ...input, meaningReview: { reviewed: false } });
  assert.equal(unreviewed.publicRecord.meaningLoss, null);
  assert.ok(unreviewed.publicRecord.exclusions.includes('meaning-unreviewed'));
  assert.equal(tokenEditRatio('相同文字', '相同文字', 'zh').ratio, 0);
});

test('meaning evidence cannot be reused after either text changes', () => {
  const input = row();
  assert.throws(() => validateEditedPair({ ...input, edited: input.edited.replace('will', 'will not'), edit: { ...input.edit, depth: 'heavy', operations: ['paraphrase'] } }), /both exact texts/);
  assert.throws(() => validateEditedPair({ ...input, meaningReview: { ...input.meaningReview, originalHash: hash('different') } }), /both exact texts/);
});

test('moving short sentences within a long passage cannot be labeled a light edit', () => {
  const input = row();
  const unchanged = 'The coordinator reviewed the original draft carefully before sharing it with the wider team for their comments and final approval.';
  const original = `One. Two. ${unchanged}`, edited = `Two. One. ${unchanged}`;
  assert.ok(tokenEditRatio(original, edited, 'en').ratio <= .15);
  assert.throws(() => validateEditedPair({ ...input, original, edited,
    source: { ...input.source, originalHash: hash(original) }, meaningReview: { reviewed: false } }), /Light/);
});

test('editing one occurrence of a repeated sentence preserves the remaining order', () => {
  const input = row();
  const unchanged = 'The coordinator reviewed the original draft carefully before sharing it with the wider team for their comments and final approval.';
  const original = `Thanks. ${unchanged} Thanks.`, edited = `Thank you. ${unchanged} Thanks.`;
  assert.ok(tokenEditRatio(original, edited, 'en').ratio <= .15);
  const result = validateEditedPair({ ...input, original, edited, source: { ...input.source, originalHash: hash(original) }, meaningReview: { reviewed: false } });
  assert.equal(result.publicRecord.editDepth, 'light'); assert.equal(result.publicRecord.structureChanged, false);
});

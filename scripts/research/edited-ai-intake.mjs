#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitParagraphs, splitSentences, tokenize } from '../../src/features/segment.js';
import { evaluateNumberSafety } from '../../src/features/meaning-proxy.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = (value) => typeof value === 'string' && value.trim();
const LIGHT_OPERATIONS = new Set(['spelling', 'punctuation', 'word-substitution']);
const OPERATIONS = new Set([...LIGHT_OPERATIONS, 'extensive-lexical', 'merge', 'split', 'reorder', 'paraphrase', 'roundtrip-translation']);
const STRUCTURAL_OPERATIONS = new Set(['merge', 'split', 'reorder', 'paraphrase', 'roundtrip-translation']);

function orderChanged(before, after, language) {
  const key = (value) => tokenize(value.normalize('NFC'), { lang: language }).join('\0');
  const left = before.map(key).filter(Boolean), right = after.map(key).filter(Boolean);
  const counts = new Map();
  for (const value of left) counts.set(value, (counts.get(value) || 0) + 1);
  let common = 0;
  for (const value of right) if (counts.get(value) > 0) { common++; counts.set(value, counts.get(value) - 1); }
  // Match repeated sentences by the best order-preserving alignment, rather
  // than assigning a later unchanged occurrence to an earlier edited one.
  let row = new Uint16Array(right.length + 1);
  for (const value of left) {
    const next = new Uint16Array(right.length + 1);
    for (let j = 1; j <= right.length; j++) next[j] = value === right[j - 1] ? row[j - 1] + 1 : Math.max(row[j], next[j - 1]);
    row = next;
  }
  return row[right.length] < common;
}

export function tokenEditRatio(original, edited, language) {
  const before = tokenize(original.normalize('NFC'), { lang: language }), after = tokenize(edited.normalize('NFC'), { lang: language });
  if (before.length > 2000 || after.length > 2000) throw new Error('Intake supports at most 2,000 tokens per version');
  let row = Array.from({ length: after.length + 1 }, (_, i) => i);
  for (let i = 1; i <= before.length; i++) {
    const next = [i];
    for (let j = 1; j <= after.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (before[i - 1] === after[j - 1] ? 0 : 1));
    row = next;
  }
  const distance = row[after.length];
  return { distance, ratio: distance / Math.max(1, before.length, after.length), originalTokens: before.length, editedTokens: after.length };
}

export function validateEditedPair(row) {
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(row?.sampleId || '') || !['en', 'ko', 'zh', 'ja'].includes(row.language)) throw new Error('Invalid edited-AI sample identity');
  if (!text(row.original) || !text(row.edited) || row.original === row.edited || row.original.length > 20000 || row.edited.length > 20000) throw new Error('Distinct bounded source/edit text required');
  const originalHash = hash(row.original), editedHash = hash(row.edited);
  const source = row.source;
  if (source?.kind !== 'model-generated' || source.reviewed !== true || source.originalHash !== originalHash || !digest(source.evidenceHash)
    || !text(source.reference) || !text(source.model) || !text(source.reviewer)) throw new Error('Original model-generated provenance must be reviewed; fixture style labels are not origin evidence');
  if (!['human', 'model', 'mixed'].includes(row.edit?.agent) || !['light', 'heavy'].includes(row.edit?.depth)
    || !Array.isArray(row.edit.operations) || !row.edit.operations.length || row.edit.operations.some((operation) => !OPERATIONS.has(operation))) throw new Error('Editing actor, depth and supported operations required');
  if (!text(row.rights?.license) || row.rights.reviewed !== true || !['private', 'panel-only', 'public'].includes(row.rights.sharing)) throw new Error('Reviewed source sharing/license required');
  const churn = tokenEditRatio(row.original, row.edited, row.language);
  const beforeParagraphs = splitParagraphs(row.original), afterParagraphs = splitParagraphs(row.edited);
  const beforeSentences = splitSentences(row.original), afterSentences = splitSentences(row.edited);
  const reordered = orderChanged(beforeSentences, afterSentences, row.language) || orderChanged(beforeParagraphs, afterParagraphs, row.language);
  const structureChanged = beforeParagraphs.length !== afterParagraphs.length || beforeSentences.length !== afterSentences.length || reordered;
  const structuralOperation = row.edit.operations.some((operation) => STRUCTURAL_OPERATIONS.has(operation));
  if (row.edit.depth === 'light' && (churn.ratio > .15 || structureChanged || row.edit.operations.some((operation) => !LIGHT_OPERATIONS.has(operation)))) throw new Error('Light edits exceed the frozen surface-edit policy');
  if (row.edit.depth === 'heavy' && churn.ratio <= .15 && !structureChanged && !structuralOperation) throw new Error('Heavy edits need substantial lexical or structural change');
  const review = row.meaningReview || {};
  if (review.reviewed === true && (typeof review.loss !== 'boolean' || !digest(review.evidenceHash) || !text(review.reviewer)
    || review.originalHash !== originalHash || review.editedHash !== editedHash)) throw new Error('Meaning review needs evidence bound to both exact texts');
  const numeric = evaluateNumberSafety(row.original, row.edited, row.language);
  const exclusions = [];
  if (!numeric.ok) exclusions.push('numeric-proxy-failure');
  if (review.reviewed !== true) exclusions.push('meaning-unreviewed');
  else if (review.loss) exclusions.push('meaning-loss');
  const publicRecord = { schemaVersion: 1, sampleId: row.sampleId, language: row.language, sourceKind: source.kind,
    originalHash, editedHash, model: source.model, sourceReferenceHash: hash(source.reference), sourceEvidenceHash: source.evidenceHash,
    editingAgent: row.edit.agent, editDepth: row.edit.depth, operations: row.edit.operations,
    tokenEditDistance: churn.distance, tokenEditRatio: churn.ratio, structureChanged,
    license: row.rights.license, sharing: row.rights.sharing, numericProxyPass: numeric.ok,
    meaningReviewed: review.reviewed === true, meaningLoss: review.reviewed === true ? review.loss : null,
    eligibleForClaims: exclusions.length === 0, exclusions };
  return { publicRecord, privateRecord: { ...row, originalHash, editedHash } };
}

export function prepareEditedIntake(rows) {
  const ids = new Set(), pairs = new Set();
  return rows.map((row) => {
    const result = validateEditedPair(row), id = result.publicRecord.sampleId, pair = `${result.publicRecord.originalHash}/${result.publicRecord.editedHash}`;
    if (ids.has(id) || pairs.has(pair)) throw new Error('Duplicate edited-AI identity or pair');
    ids.add(id); pairs.add(pair); return result;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [input, output] = process.argv.slice(2);
    if (!input) throw new Error('Usage: edited-ai-intake INPUT.json [NEW_OUTPUT_DIRECTORY]');
    const records = prepareEditedIntake(JSON.parse(readFileSync(input, 'utf8')));
    if (output) {
      mkdirSync(output, { mode: 0o700 });
      writeFileSync(resolve(output, '.gitignore'), '*\n', { flag: 'wx', mode: 0o600 });
      writeFileSync(resolve(output, 'manifest.jsonl'), records.map((row) => JSON.stringify(row.publicRecord)).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
      writeFileSync(resolve(output, 'texts.private.jsonl'), records.map((row) => JSON.stringify(row.privateRecord)).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
    }
    console.log(JSON.stringify({ dryRun: !output, rows: records.length, eligible: records.filter((row) => row.publicRecord.eligibleForClaims).length }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

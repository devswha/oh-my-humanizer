import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { textHash } from '../../tests/quality/live-scorer-benchmark.mjs';
import { safeCallRecord } from './study-journal.mjs';

// The supplied runner receives only this receipt transport. No journal writes
// or live transport are available while validating a previously saved row.
export async function replayPreparationRow({ directory, logicalId, row, candidate, run }) {
  if (!Array.isArray(row.calls) || !row.calls.length) throw new Error('Saved preparation row lacks call receipts');
  const group = resolve(directory, 'calls', textHash(logicalId));
  const names = readdirSync(group);
  if (names.length !== row.calls.length || names.some((name) => !/^\d+\.private\.json$/.test(name))) throw new Error('Preparation receipt sequence has missing or extra ordinals');
  const receipts = row.calls.map((call, index) => {
    const receipt = JSON.parse(readFileSync(resolve(group, `${index + 1}.private.json`), 'utf8'));
    if (receipt.schemaVersion !== 1 || !['completed', 'error'].includes(receipt.state)) throw new Error('Preparation receipt is unresolved');
    const safe = safeCallRecord(receipt, candidate);
    for (const [field, value] of Object.entries(safe)) {
      if (field === 'recovered_from_journal') continue;
      if (JSON.stringify(call[field]) !== JSON.stringify(value)) throw new Error('Preparation call metadata differs from its receipt');
    }
    return receipt;
  });
  let index = 0, failure = null;
  const replay = await run(async (requested, prompt, options = {}) => {
    if (failure) throw failure;
    const receipt = receipts[index++];
    const identity = { logicalId, index, candidate: requested, promptHash: textHash(prompt), temperature: options.temperature ?? .2,
      responseFormat: options.responseFormat ?? null, extraBody: options.extraBody ?? null };
    if (!receipt || receipt.promptHash !== identity.promptHash || receipt.requestHash !== textHash(JSON.stringify(identity))) {
      failure = new Error('Preparation replay needs an unrecorded or mismatched call');
      throw failure;
    }
    for (const attempt of receipt.transportAttempts || []) options.onAttempt?.(attempt);
    if (receipt.state !== 'completed') { const error = new Error(receipt.error); error.studyResult = receipt.errorMetadata; throw error; }
    return receipt.response;
  });
  if (failure) throw failure;
  if (index !== receipts.length) throw new Error('Preparation replay did not consume its exact call sequence');
  return replay;
}

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { textHash } from '../../tests/quality/live-scorer-benchmark.mjs';
import { deliveredRewrite } from '../../tests/quality/live-quality.mjs';
import { judgeCandidates, judgeRewrite } from './model-rewrite-benchmark.mjs';
import { safeCallRecord } from './study-journal.mjs';

const key = (row) => `${row.candidate_id}/${row.fixture_id}/${row.repeat}`;

function bindRequest(receipt, logicalId, index, candidate, promptHash, options = {}) {
  const identity = { logicalId, index, candidate, promptHash, temperature: options.temperature ?? .2,
    responseFormat: options.responseFormat ?? null, extraBody: options.extraBody ?? null };
  if (receipt.schemaVersion !== 1 || receipt.promptHash !== promptHash || receipt.requestHash !== textHash(JSON.stringify(identity))) throw new Error('Parent receipt request or prompt binding differs');
}

export async function auditParentReceipts({ directory, generations, privateRows, judgments, candidates, protocol, fixtures, hashes }) {
  const expectedGroups = new Map();
  for (const generation of generations) {
    const candidate = candidates.find((candidate) => candidate.id === generation.candidate_id);
    const logical = `${generation.protocol_hash}/${key(generation)}`;
    expectedGroups.set(textHash(`${logical}/rewrite`), { row: generation, candidate, generation, logicalId: `${logical}/rewrite` });
    for (const judge of judgeCandidates(candidate, protocol)) {
      const row = judgments.find((row) => key(row) === key(generation) && row.judge_id === judge.id);
      expectedGroups.set(textHash(`${logical}/judge/${judge.id}`), { row, candidate: judge, generation, judge: true, logicalId: `${logical}/judge/${judge.id}` });
    }
  }
  const callsRoot = resolve(directory, 'calls');
  const actualGroups = existsSync(callsRoot) ? readdirSync(callsRoot) : [];
  for (const group of actualGroups) if (!expectedGroups.has(group)) throw new Error('Parent has an unrecognized call group; reconcile it before evaluation');
  for (const [group, expected] of expectedGroups) {
    const path = resolve(callsRoot, group);
    if (!expected.row) {
      if (existsSync(path)) throw new Error('Parent has receipt-only judge evidence; recover the original cohort before another evaluation');
      continue;
    }
    const calls = expected.row.calls;
    if (!Array.isArray(calls)) throw new Error('Parent row has no call evidence');
    const names = existsSync(path) ? readdirSync(path) : [];
    if (names.length !== calls.length || names.some((name) => !/^\d+\.private\.json$/.test(name))) throw new Error('Parent call receipts are missing or unresolved');
    const receipts = calls.map((call, index) => {
      const file = `calls/${group}/${index + 1}.private.json`;
      const bytes = readFileSync(resolve(directory, file), 'utf8'); hashes[file] = textHash(bytes);
      const receipt = JSON.parse(bytes);
      if (!['completed', 'error'].includes(receipt.state)) throw new Error('Parent call outcome is unresolved');
      const safe = safeCallRecord(receipt, expected.candidate);
      for (const field of ['status', 'error', 'schema_valid', 'modelIdentityVerified']) {
        if ((call[field] ?? null) !== (safe[field] ?? null)) throw new Error('Parent call metadata differs from its receipt');
      }
      if (expected.candidate.transport === 'kimi-cli' && call.profileIdentityVerified !== safe.profileIdentityVerified) throw new Error('Parent profile identity differs from its receipt');
      return receipt;
    });
    const original = privateRows.find((row) => key(row) === key(expected.generation));
    if (!expected.judge) {
      for (let i = 0; i < receipts.length; i++) bindRequest(receipts[i], expected.logicalId, i + 1, expected.candidate, expected.generation.prompt_hash, { temperature: .2 });
      if (expected.row.status === 'ok' && (!receipts.length || deliveredRewrite(receipts.at(-1).response?.text || '') !== original.rewrite)) throw new Error('Parent generation differs from its completion receipt');
      continue;
    }
    const fixture = fixtures.find((fixture) => fixture.fixture_id === original.fixture_id);
    let index = 0, requestFailure = null;
    // Offline replay rebuilds the production prompts and scores. It never calls
    // a transport and cannot replenish a paid request's deadline.
    const replay = await judgeRewrite(fixture, original, expected.candidate, { logicalId: expected.logicalId,
      complete: async (candidate, prompt, options) => {
        if (requestFailure) throw requestFailure;
        const receipt = receipts[index++];
        try {
          if (!receipt) throw new Error('Parent replay needs an unrecorded call');
          bindRequest(receipt, expected.logicalId, index, candidate, textHash(prompt), options);
        } catch (error) { requestFailure = error; throw error; }
        for (const attempt of receipt.transportAttempts || []) options.onAttempt?.(attempt);
        if (receipt.state !== 'completed') throw new Error(receipt.error);
        return receipt.response;
      } });
    if (requestFailure) throw requestFailure;
    if (index !== receipts.length) throw new Error('Parent replay did not consume its exact call sequence');
    for (const field of ['status', 'error', 'mps', 'fidelity', 'naturalness', 'hard_fail_count']) {
      if ((expected.row[field] ?? null) !== (replay[field] ?? null)) throw new Error('Parent judge scores differ from their completion receipts');
    }
  }
}

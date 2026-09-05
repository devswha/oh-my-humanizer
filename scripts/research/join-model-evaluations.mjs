#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { textHash } from '../../tests/quality/live-scorer-benchmark.mjs';
import { acquireStudyWriter, readUniqueRows } from './study-journal.mjs';
import { loadParentCohort } from './evaluate-existing-rewrites.mjs';
import { auditParentReceipts } from './parent-cohort-audit.mjs';
import { judgeCandidates, renderRewriteReport, rewriteFixtures, summarizeRewrites } from './model-rewrite-benchmark.mjs';
import { studySemantics } from './study-validation.mjs';
import { resolveStudyFamily, generationFamily, validateJudgmentFamilies } from './study-family.mjs';

const key = (row) => `${row.candidate_id}/${row.fixture_id}/${row.repeat}`;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonical(value[name])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export async function joinEvaluations({ parent, fixtures, directories, protocol, evaluationSemantics }) {
  for (const candidate of parent.candidates) judgeCandidates(candidate, protocol);
  for (const generation of parent.generations) {
    const candidate = parent.candidates.find((candidate) => candidate.id === generation.candidate_id);
    if (!candidate) throw new Error('Unknown joined generator');
    generationFamily(generation, candidate);
  }
  for (const row of parent.judgments) {
    const generation = parent.generations.find((generation) => key(generation) === key(row));
    const candidate = parent.candidates.find((candidate) => candidate.id === generation?.candidate_id);
    const judge = protocol.candidates.find((candidate) => candidate.id === row.judge_id);
    if (!generation || !judge || !judgeCandidates(candidate, protocol).some((seat) => seat.id === judge.id)) throw new Error('Unbound or same-family parent judgment');
    validateJudgmentFamilies(generation, row, { candidate, judge });
  }
  const judgments = [...parent.judgments], evidence = [];
  for (const directory of [...new Set(directories.map((path) => resolve(path)))].sort()) {
    const release = acquireStudyWriter(directory, 'analysis-snapshot');
    try {
      const provenanceBytes = readFileSync(resolve(directory, 'provenance.json'), 'utf8');
      const provenance = JSON.parse(provenanceBytes);
      const judge = protocol.candidates.find((candidate) => candidate.id === provenance.judge?.id);
      if (!judge || provenance.parentSnapshotHash !== parent.snapshotHash) throw new Error('Evaluation belongs to another parent snapshot');
      if (['provider', 'model', 'transport'].some((field) => provenance.judge[field] !== judge[field])
        || resolveStudyFamily(provenance.judge, { legacy: true }).upstreamFamily !== resolveStudyFamily(judge).upstreamFamily
        || (Object.hasOwn(provenance.judge, 'familyEvidence') && provenance.judge.familyEvidence !== resolveStudyFamily(judge).familyEvidence)) throw new Error('Evaluation judge family differs from admitted definition');
      const expected = textHash(JSON.stringify({ protocol, judge: judge.id, parentSnapshotHash: parent.snapshotHash, semantics: evaluationSemantics }));
      const binding = JSON.parse(readFileSync(resolve(directory, 'study-protocol.json'), 'utf8'));
      if (binding.schemaVersion !== 1 || binding.protocolHash !== expected || provenance.evaluationProtocolHash !== expected) throw new Error('Evaluation source/protocol binding differs');
      const publicFile = `judge-${judge.id}.jsonl`, privateFile = `judge-${judge.id}.private.jsonl`;
      const rows = readUniqueRows(resolve(directory, publicFile), key), privateRows = readUniqueRows(resolve(directory, privateFile), key);
      if (rows.length !== privateRows.length || rows.length !== parent.generations.filter((row) => row.status === 'ok').length) throw new Error('Evaluation is incomplete');
      const hashes = { 'provenance.json': textHash(provenanceBytes), [publicFile]: textHash(readFileSync(resolve(directory, publicFile))), [privateFile]: textHash(readFileSync(resolve(directory, privateFile))) };
      for (const row of rows) {
        const stored = privateRows.find((stored) => key(stored) === key(row));
        if (!stored) throw new Error('Missing private evaluation row');
        const { private_details: _details, ...safe } = stored;
        if (!same(row, safe)) throw new Error('Evaluation public/private values differ');
        const generation = parent.generations.find((generation) => key(generation) === key(row));
        const candidate = parent.candidates.find((candidate) => candidate.id === generation?.candidate_id);
        if (!generation || generation.status !== 'ok' || row.protocol_hash !== expected || row.parent_protocol_hash !== generation.protocol_hash
          || row.parent_snapshot_hash !== parent.snapshotHash || row.text_hash !== generation.text_hash || row.rewrite_hash !== generation.rewrite_hash
          || row.judge_id !== judge.id || row.judge_model !== judge.model || row.judge_provider !== judge.provider || row.judge_transport !== judge.transport
          || !judgeCandidates(candidate, protocol).some((seat) => seat.id === judge.id)) throw new Error('Unbound evaluation judgment');
        validateJudgmentFamilies(generation, row, { candidate, judge });
      }
      await auditParentReceipts({ directory, generations: parent.generations, privateRows: parent.privateRows, judgments: rows,
        candidates: parent.candidates, protocol, fixtures, hashes, includeGenerations: false, judgmentProtocolHash: expected, judgeIds: [judge.id] });
      judgments.push(...rows); evidence.push({ judge: judge.id, protocolHash: expected, hashes });
    } finally { release(); }
  }
  const summary = summarizeRewrites(parent.generations, judgments);
  const report = renderRewriteReport(parent.generations, judgments, { expectedKeys: parent.expectedKeys, protocolHash: 'see separate parent/evaluation provenance' });
  if (!report.includes('Collection complete: **yes**')) throw new Error('Joined evaluation still has missing or unresolved work');
  return { summary, report, evidence };
}

export function selectRewriteFinalists(summary) {
  const groups = {};
  for (const [id, value] of Object.entries(summary)) {
    if (value.pending_judgments) throw new Error('Cannot select finalists with pending judgments');
    (groups[value.provider] ||= []).push({ id, ...value });
  }
  return Object.fromEntries(Object.entries(groups).map(([provider, values]) => [provider,
    values.sort((a, b) => b.safe_rate - a.safe_rate
      || (b.naturalness.median ?? -Infinity) - (a.naturalness.median ?? -Infinity)
      || (a.generation_latency_ms.median ?? Infinity) - (b.generation_latency_ms.median ?? Infinity)
      || a.id.localeCompare(b.id)).slice(0, 2).map((row) => row.id)]));
}

async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: join-model-evaluations PLAN.json (no model calls)');
  const plan = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const fixtures = rewriteFixtures(plan.suite || 'screening', resolve(plan.parentRoot));
  const parent = await loadParentCohort({ directory: resolve(plan.parent), protocolFile: resolve(plan.parentCandidates), fixtures,
    provider: plan.parentProvider, candidateId: plan.parentCandidate, repeat: plan.repeat || 1, allowLegacyUnbound: plan.allowLegacyParent === true });
  const protocol = JSON.parse(readFileSync(plan.candidates, 'utf8'));
  const result = await joinEvaluations({ parent, fixtures, directories: plan.evaluations, protocol, evaluationSemantics: studySemantics(resolve(plan.evaluationSourceRoot)) });
  const output = resolve(plan.output);
  if ([plan.parent, ...plan.evaluations].some((path) => resolve(path) === output)) throw new Error('Analysis output must be separate from input cohorts');
  mkdirSync(output, { recursive: true });
  const provenance = { parent: parent.provenance, parentSnapshotHash: parent.snapshotHash, evaluations: result.evidence,
    analysisScriptHash: textHash(readFileSync(fileURLToPath(import.meta.url))),
    analysisFamilyPolicyHash: textHash(readFileSync(new URL('./study-family.mjs', import.meta.url))) };
  writeFileSync(resolve(output, 'provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  writeFileSync(resolve(output, 'rewrite-report.md'), `Parent and evaluation protocols are preserved in provenance.json.\n\n${result.report}`);
  writeFileSync(resolve(output, 'rewrite-summary.json'), `${JSON.stringify({ summary: result.summary, finalists: selectRewriteFinalists(result.summary) }, null, 2)}\n`);
  console.log(JSON.stringify({ output, finalists: selectRewriteFinalists(result.summary) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

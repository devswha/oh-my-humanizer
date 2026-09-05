#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { textHash } from '../../tests/quality/live-scorer-benchmark.mjs';
import { evaluateNumberSafety } from '../../src/features/meaning-proxy.js';
import { judgeCandidates, judgeRewrite, renderRewriteReport, rewriteFixtures, summarizeRewrites } from './model-rewrite-benchmark.mjs';
import { acceptedStudyIdentity, acquireStudyWriter, bindStudyProtocol, readUniqueRows } from './study-journal.mjs';
import { assertStudyActive, installStudySignals, safeStudyError, validateTransport } from './model-evaluation-transport.mjs';
import { fixtureIdentity, studySemantics } from './study-validation.mjs';
import { resolveStudyFamily, generationFamily, independentJudgeMetadata, validateJudgmentFamilies } from './study-family.mjs';
import { auditParentReceipts } from './parent-cohort-audit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SEATS = ['openai-5.5', 'gemini-3.7', 'anthropic-sonnet'];
const key = (row) => `${row.candidate_id}/${row.fixture_id}/${row.repeat}`;
const unresolved = (row) => [row.error, ...(row.calls || []).map((call) => call.error)].some((error) =>
  ['study-cancelled', 'study-call-inflight', 'study-call-unobserved', 'study-journal-persistence-failed'].includes(error));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonical(value[name])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const append = (path, row) => appendFileSync(path, `${JSON.stringify(row)}\n`, { mode: 0o600 });

/** Read a complete parent generation cohort without changing its protocol IDs. */
export async function loadParentCohort({ directory, protocolFile, fixtures, provider, candidateId, repeat = 1, allowLegacyUnbound = false }) {
  if (!provider || !Number.isSafeInteger(repeat) || repeat < 1 || repeat > 10) throw new Error('Explicit parent provider and valid repeat count are required');
  const release = acquireStudyWriter(directory, 'evaluation-snapshot');
  try {
    const protocolBytes = readFileSync(protocolFile, 'utf8');
    const protocol = JSON.parse(protocolBytes);
    const candidates = protocol.candidates.filter((candidate) => candidate.provider === provider && (!candidateId || candidate.id === candidateId));
    if (!candidates.length || candidates.some((candidate) => !/^[a-z0-9.-]{1,80}$/i.test(candidate.id))) throw new Error('Invalid parent candidate scope');
    for (const candidate of candidates) { validateTransport(candidate); resolveStudyFamily(candidate); }
    const hashes = { protocol: textHash(protocolBytes) };
    const read = (name) => {
      const path = resolve(directory, name); const bytes = readFileSync(path, 'utf8'); hashes[name] = textHash(bytes);
      return readUniqueRows(path, key);
    };
    const generations = read('rewrite-rows.jsonl'), privateRows = read('rewrites.private.jsonl');
    const expectedKeys = candidates.flatMap((candidate) => Array.from({ length: repeat }, (_, iteration) => fixtures.map((fixture) => `${candidate.id}/${fixture.fixture_id}/${iteration}`)).flat());
    if (generations.length !== expectedKeys.length || privateRows.length !== expectedKeys.length
      || generations.some((row) => !expectedKeys.includes(key(row))) || privateRows.some((row) => !expectedKeys.includes(key(row)))) throw new Error('Parent generation matrix is incomplete or has unexpected rows');
    const privateByKey = new Map(privateRows.map((row) => [key(row), row]));
    const protocols = new Set();
    for (const row of generations) {
      const original = privateByKey.get(key(row)); const { rewrite: _rewrite, ...publicPart } = original;
      if (!same(row, publicPart)) throw new Error('Parent public/private generation metadata differs');
      const fixture = fixtures.find((fixture) => fixture.fixture_id === row.fixture_id);
      const candidate = candidates.find((candidate) => candidate.id === row.candidate_id);
      generationFamily(row, candidate);
      if (!/^[a-f0-9]{64}$/.test(row.protocol_hash) || row.text_hash !== fixture.text_hash || row.language !== fixture.language
        || row.provider !== candidate.provider || row.requested_model !== candidate.model || row.transport !== candidate.transport || unresolved(row)) throw new Error('Unbound parent generation');
      protocols.add(row.protocol_hash);
      if (!['ok', 'error'].includes(row.status)) throw new Error('Unknown parent generation status');
      if (row.status === 'ok') {
        if (typeof original.rewrite !== 'string' || textHash(original.rewrite) !== row.rewrite_hash
          || !acceptedStudyIdentity(row.calls?.at(-1), candidate)) throw new Error('Parent rewrite identity/hash mismatch');
        if (row.number_safety?.ok !== evaluateNumberSafety(fixture.text, original.rewrite, fixture.language).ok) throw new Error('Parent numeric-safety finding differs');
      }
    }
    if (protocols.size !== 1) throw new Error('Mixed parent generation protocols');
    const bindingPath = resolve(directory, 'study-protocol.json');
    let bindingMode = 'bound';
    if (existsSync(bindingPath)) {
      const bytes = readFileSync(bindingPath, 'utf8'); hashes['study-protocol.json'] = textHash(bytes);
      const binding = JSON.parse(bytes);
      if (binding.schemaVersion !== 1 || binding.protocolHash !== [...protocols][0]) throw new Error('Parent directory protocol binding differs');
    } else {
      if (!allowLegacyUnbound) throw new Error('Legacy unbound parent requires explicit receipt audit opt-in');
      bindingMode = 'legacy-receipts-audited';
    }
    const judgments = [];
    for (const id of SEATS) {
      const name = `judge-${id}.jsonl`, privateName = `judge-${id}.private.jsonl`;
      if (!existsSync(resolve(directory, name)) && !existsSync(resolve(directory, privateName))) continue;
      if (!existsSync(resolve(directory, name)) || !existsSync(resolve(directory, privateName))) throw new Error('Parent has private-only or public-only judge evidence; recover it before evaluation');
      const judge = protocol.candidates.find((candidate) => candidate.id === id);
      if (!judge) throw new Error('Parent judge missing from protocol');
      const publicJudgments = read(name), privateJudgments = read(privateName);
      if (publicJudgments.length !== privateJudgments.length) throw new Error('Parent judge private/public rows differ; recover before evaluation');
      for (const row of publicJudgments) {
        const privateRow = privateJudgments.find((privateRow) => key(privateRow) === key(row));
        if (!privateRow) throw new Error('Parent judge lacks a private receipt');
        const { private_details: _details, ...publicPart } = privateRow;
        if (!same(row, publicPart)) throw new Error('Parent judge public/private metadata differs');
        const generation = privateByKey.get(key(row));
        const candidate = candidates.find((candidate) => candidate.id === generation?.candidate_id);
        if (!generation || row.judge_id !== id || row.judge_model !== judge.model || row.judge_provider !== judge.provider || row.judge_transport !== judge.transport
          || row.protocol_hash !== generation.protocol_hash || row.text_hash !== generation.text_hash || row.rewrite_hash !== generation.rewrite_hash
          || !judgeCandidates(candidate, protocol).some((seat) => seat.id === id) || unresolved(row)) throw new Error('Unbound parent judgment');
        validateJudgmentFamilies(generation, row, { candidate, judge });
        if (row.status === 'ok' && !['mps', 'fidelity', 'naturalness'].every((stage) => {
          const call = row.calls?.filter((call) => call.stage === stage).at(-1);
          return call?.schema_valid === true && acceptedStudyIdentity(call, judge);
        })) throw new Error('Parent judgment lacks validated stage evidence');
        judgments.push(row);
      }
    }
    await auditParentReceipts({ directory, generations, privateRows, judgments, candidates, protocol, fixtures, hashes });
    const provenance = { schemaVersion: 1, bindingMode, parentProtocolHashes: [...protocols], inputHashes: hashes,
      scope: { provider, candidateId: candidateId || null, repeat }, fixtures: fixtures.map(fixtureIdentity) };
    return { generations, privateRows, judgments, candidates, expectedKeys, provenance, snapshotHash: textHash(JSON.stringify(provenance)) };
  } finally { release(); }
}

function validateJudgment(row, parent, judge, protocolHash) {
  const generation = parent.generations.find((generation) => key(generation) === key(row));
  if (!generation || row.protocol_hash !== protocolHash || row.parent_snapshot_hash !== parent.snapshotHash
    || row.parent_protocol_hash !== generation.protocol_hash || row.text_hash !== generation.text_hash || row.rewrite_hash !== generation.rewrite_hash
    || row.judge_id !== judge.id || row.judge_model !== judge.model || row.judge_provider !== judge.provider || row.judge_transport !== judge.transport) throw new Error('Unbound evaluation row');
  const candidate = parent.candidates.find((candidate) => candidate.id === generation.candidate_id);
  if (!candidate) throw new Error('Unknown evaluation generator');
  validateJudgmentFamilies(generation, row, { candidate, judge });
  if (!['ok', 'error'].includes(row.status)) throw new Error('Unknown evaluation status');
  if (row.status === 'ok' && (!Number.isFinite(row.mps) || row.mps < 0 || row.mps > 100
    || !Number.isFinite(row.fidelity) || row.fidelity < 0 || row.fidelity > 100
    || !Number.isInteger(row.naturalness) || row.naturalness < 0 || row.naturalness > 4
    || !Number.isSafeInteger(row.hard_fail_count) || row.hard_fail_count < 0
    || !['mps', 'fidelity', 'naturalness'].every((stage) => {
      const call = row.calls?.filter((call) => call.stage === stage).at(-1);
      return call?.schema_valid === true && call.status === 'ok' && acceptedStudyIdentity(call, judge);
    }))) throw new Error('Evaluation lacks valid scores or stage evidence');
}

export async function evaluateExisting({ parent, judge, output, protocolHash, live = false, report = false, evaluate = judgeRewrite }) {
  if (parent.judgments.some((row) => row.judge_id === judge.id)) throw new Error('Selected seat already has parent observations; do not silently re-evaluate it');
  validateTransport(judge);
  for (const candidate of parent.candidates) {
    if (resolveStudyFamily(candidate).upstreamFamily === resolveStudyFamily(judge).upstreamFamily) throw new Error('A judge cannot evaluate its own family');
  }
  for (const generation of [...parent.generations, ...parent.privateRows]) {
    const candidate = parent.candidates.find((candidate) => candidate.id === generation.candidate_id);
    if (!candidate) throw new Error('Unknown evaluation generator');
    independentJudgeMetadata(generation, judge, candidate);
  }
  const release = acquireStudyWriter(output, `judge-${judge.id}`);
  try {
    bindStudyProtocol(output, protocolHash);
    const judgeIdentity = { id: judge.id, provider: judge.provider, model: judge.model, transport: judge.transport, effort: judge.effort ?? null, ...resolveStudyFamily(judge) };
    writeFileSync(resolve(output, 'provenance.json'), `${JSON.stringify({ ...parent.provenance, parentSnapshotHash: parent.snapshotHash, evaluationProtocolHash: protocolHash, judge: judgeIdentity }, null, 2)}\n`);
    const publicPath = resolve(output, `judge-${judge.id}.jsonl`), privatePath = resolve(output, `judge-${judge.id}.private.jsonl`);
    const rows = readUniqueRows(publicPath, key), done = new Set(rows.map(key));
    for (const row of rows) validateJudgment(row, parent, judge, protocolHash);
    const privateRows = readUniqueRows(privatePath, key);
    if (rows.some((row) => !privateRows.some((privateRow) => key(privateRow) === key(row)))) throw new Error('Evaluation row lacks its private receipt');
    for (const row of privateRows) {
      validateJudgment(row, parent, judge, protocolHash);
      const { private_details: _details, ...safe } = row;
      if (done.has(key(row))) {
        if (!same(safe, rows.find((publicRow) => key(publicRow) === key(row)))) throw new Error('Evaluation public/private metadata differs');
        continue;
      }
      append(publicPath, safe); rows.push(safe); done.add(key(row));
    }
    if (live && !report) for (const generation of parent.privateRows) {
      assertStudyActive(); if (generation.status !== 'ok' || done.has(key(generation))) continue;
      const fixture = parent.fixtures.find((fixture) => fixture.fixture_id === generation.fixture_id);
      const evaluated = await evaluate(fixture, generation, judge, { journalDirectory: output,
        logicalId: `${protocolHash}/${key(generation)}/judge/${judge.id}` });
      // Validate supplied metadata before adding the new row's explicit family
      // fields. Existing first-party evaluators may still omit those fields.
      validateJudgmentFamilies(generation, evaluated, { judge });
      const row = { ...evaluated, ...independentJudgeMetadata(generation, judge),
        protocol_hash: protocolHash, parent_protocol_hash: generation.protocol_hash, parent_snapshot_hash: parent.snapshotHash, recorded_at: new Date().toISOString() };
      validateJudgment(row, parent, judge, protocolHash);
      append(privatePath, row); const { private_details: _details, ...safe } = row; append(publicPath, safe); rows.push(safe); done.add(key(row));
      console.log(JSON.stringify({ candidate: row.candidate_id, fixture: row.fixture_id, judge: judge.id, status: row.status }));
    }
    const combined = [...parent.judgments, ...rows];
    const provenance = `Parent generation protocol: ${parent.provenance.parentProtocolHashes.join(', ')}.\nEvaluation protocol: ${protocolHash}. Parent and new judgment protocol IDs are preserved separately.\n\n`;
    writeFileSync(resolve(output, 'rewrite-report.md'), provenance + renderRewriteReport(parent.generations, combined, { protocolHash, expectedKeys: parent.expectedKeys }));
    writeFileSync(resolve(output, 'rewrite-summary.json'), `${JSON.stringify({ parentSnapshotHash: parent.snapshotHash, evaluationProtocolHash: protocolHash,
      parentGenerationProtocols: parent.provenance.parentProtocolHashes, summary: summarizeRewrites(parent.generations, combined) }, null, 2)}\n`);
    return rows;
  } finally { release(); }
}

export async function main(argv = process.argv.slice(2)) {
  const options = { suite: 'screening', repeat: '1' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--live') options.live = true;
    else if (argv[i] === '--report') options.report = true;
    else if (argv[i] === '--allow-legacy-parent') options.allowLegacyUnbound = true;
    else if (['--parent', '--parent-root', '--parent-candidates', '--parent-provider', '--parent-candidate', '--candidates', '--judge', '--output', '--suite', '--repeat'].includes(argv[i]) && argv[i + 1] && !argv[i + 1].startsWith('--')) options[argv[i].slice(2)] = argv[++i];
    else throw new Error('Invalid existing-cohort evaluation arguments');
  }
  for (const name of ['parent', 'parent-root', 'parent-candidates', 'parent-provider', 'candidates', 'judge', 'output']) if (!options[name]) throw new Error(`Missing --${name}`);
  if (!options.live && !options.report) throw new Error('Pass --live for paid judgments or --report to generate a report without model calls');
  installStudySignals();
  const protocol = JSON.parse(readFileSync(options.candidates, 'utf8'));
  const judge = protocol.candidates.find((candidate) => candidate.id === options.judge);
  if (!judge || !SEATS.includes(judge.id)) throw new Error('A fixed judge seat is required');
  const fixtures = rewriteFixtures(options.suite, resolve(options['parent-root']));
  const parent = await loadParentCohort({ directory: resolve(options.parent), protocolFile: resolve(options['parent-candidates']), fixtures,
    provider: options['parent-provider'], candidateId: options['parent-candidate'], repeat: Number(options.repeat), allowLegacyUnbound: options.allowLegacyUnbound });
  for (const candidate of parent.candidates) if (!judgeCandidates(candidate, protocol).some((seat) => seat.id === judge.id)) throw new Error('Judge is not assigned to this parent family');
  const protocolHash = textHash(JSON.stringify({ protocol, judge: judge.id, parentSnapshotHash: parent.snapshotHash, semantics: studySemantics(ROOT) }));
  return evaluateExisting({ parent: { ...parent, fixtures }, judge, protocolHash, output: resolve(options.output), live: options.live, report: options.report });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(safeStudyError(error)); process.exitCode = 1; });

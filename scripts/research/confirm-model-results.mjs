#!/usr/bin/env node
// Bounded offline join of the six completed 34-fixture × 3-repeat finalists.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import yaml from 'js-yaml';
import { bindReceipt, checkParity, createEvidenceReader, rankSummary, replayBoundJudgment, sha256 } from './revalidate-mps-evidence.mjs';
import { distribution } from '../../tests/quality/live-scorer-benchmark.mjs';
import { summarizeRewrites } from './model-rewrite-benchmark.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = 'scripts/research/confirm-model-results.mjs';
const REPORT = 'docs/research/model-rewrite-confirmation-20260905';
const OUTPUT = '/tmp/patina-full-rewrite-confirmation-20260905';
const HELPER = 'scripts/research/revalidate-mps-evidence.mjs';
const HELPER_HASH = '3bd298a7b5f6b3d8302ff25f8c2e74fa8ed82e6c4ef7dde1af8a4687900ce977';
const COMMITS = { E: '8918cd015fc71b35d0b7855cfe7625eb7a050fcf', D: 'dca3aa1de00bd21594f39e5b3c83614f28f22b85', G: '5567e4a81fedd6f56cdd518507051c6c0db04f9d' };
const SOURCE_NAMES = { E: 'patina-cohort-evaluation', D: 'patina-claude-model-study', G: 'patina-corrected-judge-source-20260905' };
const PARENT_BASE = 'artifacts/model-confirmation-20260905';
const G_BASE = 'artifacts/corrected-judgments-20260905';
const API_PROTOCOL = 'docs/research/model-evaluation-20260904.json';
const ISOLATED_PROTOCOL = 'docs/research/model-evaluation-claude-isolated-20260905.json';
const LANGUAGES = ['en', 'ko', 'zh', 'ja'];
const STAGES = ['mps', 'fidelity', 'naturalness'];
const FIELDS = ['status', 'error', 'mps', 'fidelity', 'naturalness', 'hard_fail_count'];
const HASH = /^[a-f0-9]{64}$/;
const insist = (ok, code) => { if (!ok) throw new Error(`model-confirmation: ${code}`); };
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const digest = (value) => sha256(canonical(value));
const key = (row) => `${row.candidate_id}/${row.fixture_id}/${row.repeat}`;
const sorted = (values) => [...values].sort();
const finite = Number.isFinite;
const snapshot = (row) => Object.fromEntries(FIELDS.map((field) => [field, row[field] ?? null]));
const unresolved = (row) => [row.error, ...(row.calls || []).map((call) => call.error)].some((error) =>
  ['study-call-inflight', 'study-call-unobserved', 'study-cancelled', 'study-journal-persistence-failed'].includes(error));

export const FINALISTS = [
  { id: 'openai-astra', source: 'E', provider: 'openai', apiJudge: 'gemini-3.7', apiDirectory: 'gemini-3.7-on-openai-astra' },
  { id: 'openai-terra', source: 'E', provider: 'openai', apiJudge: 'gemini-3.7', apiDirectory: 'gemini-on-openai-terra' },
  { id: 'gemini-3.8-high', source: 'E', provider: 'gemini', apiJudge: 'openai-5.5', apiDirectory: 'openai-5.5-on-gemini-3.8-high' },
  { id: 'gemini-3.8-medium', source: 'E', provider: 'gemini', apiJudge: 'openai-5.5', apiDirectory: 'openai-5.5-on-gemini-3.8-medium' },
  { id: 'anthropic-sonnet', source: 'D', provider: 'anthropic' },
  { id: 'anthropic-fable', source: 'D', provider: 'anthropic' },
];

function evaluationSeats(candidate) {
  return candidate.source === 'E' ? [
    { id: candidate.apiJudge, source: 'E', directory: `${PARENT_BASE}/${candidate.apiDirectory}` },
    { id: 'anthropic-sonnet', source: 'G', directory: `${G_BASE}/anthropic-sonnet-on-${candidate.id}` },
  ] : ['openai-5.5', 'gemini-3.7'].map((id) => ({ id, source: 'G', directory: `${G_BASE}/${id}-on-${candidate.id}` }));
}

function verifySource(reader, commit, paths) {
  insist(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: reader.root, encoding: 'utf8' }).trim() === commit, 'frozen source commit differs');
  const bytes = execFileSync('git', ['cat-file', '--batch'], { cwd: reader.root,
    input: paths.map((path) => `${commit}:${path}\n`).join(''), maxBuffer: 64 * 1024 * 1024 });
  let offset = 0;
  for (const path of paths) {
    const end = bytes.indexOf(10, offset), header = bytes.subarray(offset, end).toString('utf8').match(/^[a-f0-9]{40} blob ([0-9]+)$/);
    insist(header, 'committed source missing');
    const length = Number(header[1]);
    insist(sha256(bytes.subarray(end + 1, end + length + 1)) === reader.hash(path), 'frozen source bytes differ');
    offset = end + length + 2;
  }
  insist(offset === bytes.length, 'invalid source stream');
}

async function loadRuntime(reader, commit) {
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', commit], { cwd: reader.root, encoding: 'utf8' }).trim().split('\n').filter((path) =>
    /^(src|patterns|core|document-types|lexicon|personas)\//.test(path) || /^tests\/fixtures\/(live-quality|suspect-zones)\//.test(path)
    || ['.patina.default.yaml', 'package.json', 'tests/quality/live-quality.mjs', 'tests/quality/live-scorer-benchmark.mjs'].includes(path)
    || /^scripts\/research\/[a-z0-9-]+\.mjs$/.test(path) || /^docs\/research\/model-evaluation.*\.json$/.test(path));
  verifySource(reader, commit, paths);
  const load = (path) => import(pathToFileURL(resolve(reader.root, path)).href);
  const [rewrite, journal, validation, live, loader, numbers, scoring] = await Promise.all([
    load('scripts/research/model-rewrite-benchmark.mjs'), load('scripts/research/study-journal.mjs'), load('scripts/research/study-validation.mjs'),
    load('tests/quality/live-quality.mjs'), load('src/loader.js'), load('src/features/meaning-proxy.js'), load('src/scoring.js'),
  ]);
  return { rewrite, journal, validation, live, loader, numbers, scoring,
    semantics: validation.studySemantics(reader.root), sourceHash: digest(Object.fromEntries(paths.map((path) => [path, reader.hash(path)]))) };
}

export function assertTerminalJob(job, rows, expected = 102) {
  insist(job?.schemaVersion === 1 && job.state === 'completed' && job.exitCode === 0 && job.signal === null, 'job not completed with exit zero');
  insist(Number.isFinite(Date.parse(job.startedAt)) && Number.isFinite(Date.parse(job.endedAt)) && Date.parse(job.endedAt) >= Date.parse(job.startedAt), 'invalid job times');
  insist(rows.length === expected && rows.every((row) => !unresolved(row) && ['ok', 'error'].includes(row.status)
    && Number.isFinite(Date.parse(row.recorded_at)) && Date.parse(row.recorded_at) <= Date.parse(job.endedAt)), 'nonterminal or incomplete rows');
  // A resumed job can start after some of its immutable rows were recorded.
}

function jobEvidence(reader, directory, rows, expectedArgs, entry) {
  insist(!reader.exists(`${directory}/.writer.lock`), 'dataset writer active');
  const parts = directory.split('/'), name = parts.pop(), path = `${parts.join('/')}/jobs/${name}/job.json`;
  const job = reader.json(path); assertTerminalJob(job, rows);
  insist(job.entry === entry && Array.isArray(job.args) && job.args.length <= 40 && job.args.includes('--live'), 'job command differs');
  const get = (flag) => { const i = job.args.indexOf(flag); insist(i >= 0 && job.args.lastIndexOf(flag) === i, 'missing or duplicate job option'); return job.args[i + 1]; };
  for (const [flag, value] of Object.entries(expectedArgs)) {
    const actual = get(flag);
    const pathOption = ['--output', '--parent', '--parent-root', '--candidates', '--parent-candidates'].includes(flag);
    insist(pathOption ? typeof actual === 'string' && resolve(reader.root, actual) === value : actual === value, 'job selection differs');
  }
  return { path, sha256: reader.hash(path), state: job.state, exitCode: job.exitCode, startedAt: job.startedAt, endedAt: job.endedAt,
    rowsPredatingLatestJobStart: rows.filter((row) => Date.parse(row.recorded_at) < Date.parse(job.startedAt)).length };
}

export function assertMatrix(rows, candidateId, fixtures, repeats = 3) {
  const expected = fixtures.flatMap((fixture) => Array.from({ length: repeats }, (_, repeat) => `${candidateId}/${fixture.fixture_id}/${repeat}`));
  insist(rows.every((row) => Number.isSafeInteger(row.repeat) && row.repeat >= 0 && row.repeat < repeats)
    && same(sorted(rows.map(key)), sorted(expected)), 'matrix has missing, duplicate or unexpected rows');
  return expected;
}

function readReceipts(reader, directory, row, candidate, runtime, suffix) {
  insist(Array.isArray(row.calls) && row.calls.length >= 1 && row.calls.length <= 6 && !unresolved(row), 'invalid call sequence');
  const logicalId = `${row.protocol_hash}/${key(row)}/${suffix}`, group = sha256(logicalId);
  const names = row.calls.map((_call, i) => `${i + 1}.private.json`);
  insist(same(reader.list(`${directory}/calls/${group}`), names), 'receipt ordinals differ');
  return names.map((name, i) => {
    const path = `${directory}/calls/${group}/${name}`, receipt = reader.json(path);
    insist(receipt.schemaVersion === 1 && ['completed', 'error'].includes(receipt.state) && !unresolved(receipt), 'receipt not terminal');
    insist(Number.isFinite(Date.parse(receipt.endedAt)) && Date.parse(receipt.endedAt) <= Date.parse(row.recorded_at), 'receipt/row time binding differs');
    const safe = runtime.journal.safeCallRecord(receipt, candidate), { stage: _stage, ...original } = row.calls[i];
    insist(same(safe, original), 'receipt metadata differs from original row');
    if (receipt.state === 'completed') insist((safe.modelIdentityVerified || safe.profileIdentityVerified) && !safe.mixedOrUnexpectedModel
      && receipt.response.effectiveModels.every((model) => model === candidate.model), 'recorded response/profile identity differs');
    return { path, receipt, sha256: reader.hash(path), index: i + 1, group, logicalId };
  });
}

function receiptHashes(entries) {
  return entries.map((entry) => ({ path: entry.path, sha256: entry.sha256, requestHash: entry.receipt.requestHash,
    promptHash: entry.receipt.promptHash, responseSha256: entry.receipt.response ? sha256(entry.receipt.response.text) : null }));
}

async function stageScores(row, result, fixture, generation, judge, entries, runtime) {
  const last = (stage) => row.calls.map((call, i) => ({ call, i })).filter(({ call }) => call.stage === stage).at(-1);
  const scores = {};
  for (const stage of STAGES) {
    const slot = last(stage), valid = slot ? result.corrected.calls[slot.i].schema_valid === true : false;
    scores[stage] = { valid, value: null, hardFailCount: null };
    if (!valid) continue;
    const receipt = entries[slot.i].receipt;
    if (stage === 'mps') {
      const value = runtime.validation.validateRawMps(receipt.response.text);
      scores.mps.value = value.mps; scores.mps.hardFailCount = value.hard_fail_count;
    } else if (stage === 'naturalness') scores.naturalness.value = runtime.rewrite.parseNaturalness(receipt.response.text).naturalness;
    else {
      const slots = row.calls.map((call, i) => ({ call, i })).filter(({ call }) => call.stage === 'fidelity'); let consumed = 0;
      const fidelity = await runtime.scoring.scoreFidelity({ original: fixture.text, rewritten: generation.rewrite, model: judge.model,
        logger: { warn() {} }, callLLM: async (args) => {
          const selected = slots[consumed++]; insist(selected, 'unrecorded fidelity call'); const entry = entries[selected.i];
          bindReceipt(entry.receipt, { logicalId: entry.logicalId, index: entry.index, candidate: judge, promptHash: sha256(args.prompt),
            temperature: args.temperature ?? .2, responseFormat: args.responseFormat ?? null, extraBody: args.extraBody ?? null });
          return entry.receipt.response.text;
        } });
      insist(consumed === slots.length && !fidelity.error && finite(fidelity.fidelity), 'fidelity stage replay differs');
      scores.fidelity.value = fidelity.fidelity;
      if (finite(result.corrected.fidelity)) insist(fidelity.fidelity === result.corrected.fidelity, 'fidelity aggregate differs');
    }
  }
  return scores;
}

async function auditCandidate(spec, readers, runtimes) {
  const parent = readers[spec.source], origin = runtimes[spec.source], directory = `${PARENT_BASE}/${spec.id}`;
  const protocolFile = spec.source === 'E' ? API_PROTOCOL : ISOLATED_PROTOCOL, protocol = parent.json(protocolFile);
  const candidate = protocol.candidates.find((candidate) => candidate.id === spec.id);
  insist(candidate && candidate.provider === spec.provider, 'generator definition differs');
  const fixtures = origin.rewrite.rewriteFixtures('full', parent.root);
  insist(fixtures.length === 34 && new Set(fixtures.map((fixture) => fixture.text_hash)).size === 34, 'full fixture suite differs');
  const rows = parent.rows(`${directory}/rewrite-rows.jsonl`), originals = checkParity(rows, parent.rows(`${directory}/rewrites.private.jsonl`), 'rewrite');
  assertMatrix(rows, spec.id, fixtures);
  const generationJob = jobEvidence(parent, directory, rows, { '--output': resolve(parent.root, directory), '--candidate': spec.id,
    '--candidates': resolve(parent.root, protocolFile), '--suite': 'full', '--repeat': '3' }, 'scripts/research/model-rewrite-benchmark.mjs');
  const binding = parent.json(`${directory}/study-protocol.json`);
  insist(binding.schemaVersion === 1 && HASH.test(binding.protocolHash) && rows.every((row) => row.protocol_hash === binding.protocolHash), 'generation protocol differs');
  const config = yaml.load(parent.bytes('.patina.default.yaml').toString('utf8'));
  config.documentType = config['document-type'] || 'default'; delete config['document-type']; config.persona = null; config.register = null;
  const prompts = new Map();
  for (const fixture of fixtures) prompts.set(fixture.fixture_id, await origin.live.buildPatinaRewritePrompt(fixture,
    { repoRoot: parent.root, config, promptMode: 'minimal', patterns: origin.loader.loadPatterns(parent.root, fixture.language) }));
  const generationReceipts = [];
  for (const row of rows) {
    const stored = originals.get(key(row)), fixture = fixtures.find((fixture) => fixture.fixture_id === row.fixture_id);
    insist(row.schemaVersion === 1 && row.status === 'ok' && row.provider === candidate.provider && row.requested_model === candidate.model
      && row.transport === candidate.transport && row.language === fixture.language && row.text_hash === fixture.text_hash
      && row.prompt_hash === sha256(prompts.get(fixture.fixture_id)) && sha256(stored.rewrite) === row.rewrite_hash, 'generation source binding differs');
    insist(row.number_safety?.ok === origin.numbers.evaluateNumberSafety(fixture.text, stored.rewrite, fixture.language).ok, 'numeric proxy differs');
    const entries = readReceipts(parent, directory, row, candidate, origin, 'rewrite');
    for (const entry of entries) bindReceipt(entry.receipt, { logicalId: entry.logicalId, index: entry.index, candidate, promptHash: row.prompt_hash, temperature: .2 });
    insist(origin.live.deliveredRewrite(entries.at(-1).receipt.response.text) === stored.rewrite, 'generation response differs');
    generationReceipts.push(...entries);
  }
  insist(same(parent.list(`${directory}/calls`), sorted(generationReceipts.map((entry) => entry.group))), 'unexpected generation receipt group');
  const originalJudgments = [], correctedJudgments = [], ledger = [], datasets = [];
  const items = rows.map((row) => ({ fixture_id: row.fixture_id, language: row.language, repeat: row.repeat,
    generationKey: key(row), generationStatus: row.status, numericSafe: row.number_safety.ok, durationMs: row.duration_ms, judgments: [] }));
  let parentSnapshot = null;
  for (const seat of evaluationSeats(spec)) {
    const reader = readers[seat.source], runtime = runtimes[seat.source], path = seat.directory;
    const evaluationProtocol = reader.json(ISOLATED_PROTOCOL), judge = evaluationProtocol.candidates.find((judge) => judge.id === seat.id);
    insist(judge && runtime.rewrite.judgeCandidates(candidate, evaluationProtocol).some((assigned) => assigned.id === seat.id), 'judge seat differs');
    const publicFile = `${path}/judge-${seat.id}.jsonl`, privateFile = `${path}/judge-${seat.id}.private.jsonl`;
    const judgments = reader.rows(publicFile), privateJudgments = checkParity(judgments, reader.rows(privateFile), 'private_details');
    assertMatrix(judgments, spec.id, fixtures);
    const job = jobEvidence(reader, path, judgments, { '--output': resolve(reader.root, path), '--parent': resolve(parent.root, directory),
      '--parent-root': parent.root, '--parent-candidates': resolve(parent.root, protocolFile), '--parent-provider': spec.provider,
      '--parent-candidate': spec.id, '--candidates': resolve(reader.root, ISOLATED_PROTOCOL), '--judge': seat.id, '--suite': 'full', '--repeat': '3' }, 'scripts/research/evaluate-existing-rewrites.mjs');
    const provenance = reader.json(`${path}/provenance.json`);
    const base = Object.fromEntries(['schemaVersion', 'bindingMode', 'parentProtocolHashes', 'inputHashes', 'scope', 'fixtures'].map((name) => [name, provenance[name]]));
    insist(base.schemaVersion === 1 && base.bindingMode === 'bound' && same(base.parentProtocolHashes, [binding.protocolHash])
      && same(base.scope, { provider: spec.provider, candidateId: spec.id, repeat: 3 })
      && same(base.fixtures, fixtures.map(origin.validation.fixtureIdentity)) && sha256(base) === provenance.parentSnapshotHash, 'parent snapshot differs');
    const snapshotFiles = ['protocol', 'rewrite-rows.jsonl', 'rewrites.private.jsonl', 'study-protocol.json',
      ...generationReceipts.map((entry) => entry.path.slice(directory.length + 1))];
    insist(same(sorted(Object.keys(base.inputHashes)), sorted(snapshotFiles)), 'parent snapshot coverage differs');
    for (const [file, hash] of Object.entries(base.inputHashes)) insist(HASH.test(hash)
      && parent.hash(file === 'protocol' ? protocolFile : `${directory}/${file}`) === hash, 'parent snapshot bytes differ');
    if (parentSnapshot) insist(parentSnapshot === provenance.parentSnapshotHash, 'judge parent snapshots differ');
    parentSnapshot = provenance.parentSnapshotHash;
    const originalProtocol = sha256({ protocol: evaluationProtocol, judge: seat.id, parentSnapshotHash: parentSnapshot, semantics: runtime.semantics });
    insist(provenance.evaluationProtocolHash === originalProtocol && reader.json(`${path}/study-protocol.json`).protocolHash === originalProtocol
      && same(provenance.judge, { id: judge.id, provider: judge.provider, model: judge.model, transport: judge.transport, effort: judge.effort ?? null }), 'original evaluator protocol differs');
    const manifests = [], groups = [], datasetLedger = [], oldValid = judgments.filter((row) => row.status === 'ok').length;
    let newValid = 0;
    for (const row of judgments) {
      const generation = originals.get(key(row)), fixture = fixtures.find((fixture) => fixture.fixture_id === row.fixture_id), stored = privateJudgments.get(key(row));
      insist(row.schemaVersion === 1 && row.protocol_hash === originalProtocol && row.parent_protocol_hash === binding.protocolHash
        && row.parent_snapshot_hash === parentSnapshot && row.text_hash === generation.text_hash && row.rewrite_hash === generation.rewrite_hash
        && row.judge_id === judge.id && row.judge_model === judge.model && row.judge_provider === judge.provider && row.judge_transport === judge.transport, 'judgment source binding differs');
      const entries = readReceipts(reader, path, row, judge, runtime, `judge/${judge.id}`);
      const result = await replayBoundJudgment({ row, stored, fixture, generation, judge, entries, originalRuntime: runtime,
        correctedRun: runtimes.G.rewrite.judgeRewrite, correctedValidator: runtimes.G.validation.validateRawMps });
      const corrected = { ...row, ...snapshot(result.corrected) };
      originalJudgments.push(row); correctedJudgments.push(corrected); newValid += corrected.status === 'ok' ? 1 : 0;
      const stages = await stageScores(row, result, fixture, generation, judge, entries, runtimes.G);
      const stageFlags = result.corrected.calls.map((call) => ({ stage: call.stage, schemaValid: call.schema_valid, status: call.status }));
      const hashes = receiptHashes(entries); manifests.push(...hashes); groups.push(entries[0].group);
      ledger.push({ candidateId: spec.id, source: seat.source, sourceCommit: COMMITS[seat.source], publicFile, privateFile,
        publicRowHash: sha256(row), privateRowHash: sha256(stored), original: globalThis.structuredClone(row), corrected: snapshot(result.corrected),
        mpsResponses: result.mpsResponses, correctedStageFlags: stageFlags, stageScores: stages, receipts: hashes });
      datasetLedger.push({ original: row, corrected });
      items.find((item) => item.generationKey === key(row)).judgments.push({ judgeId: judge.id, provider: judge.provider,
        originalStatus: row.status, status: corrected.status, mps: corrected.mps, fidelity: corrected.fidelity,
        naturalness: corrected.naturalness, hardFailCount: corrected.hard_fail_count, stages,
        transportErrors: result.corrected.calls.filter((call) => call.status !== 'ok').length });
    }
    insist(same(reader.list(`${path}/calls`), sorted(groups)), 'unexpected judgment receipt group');
    datasets.push({ source: seat.source, sourceCommit: COMMITS[seat.source], judgeId: judge.id, requestedModel: judge.model, transport: judge.transport,
      originalProtocolHash: originalProtocol, publicFile, publicFileHash: reader.hash(publicFile), privateFile, privateFileHash: reader.hash(privateFile),
      provenanceHash: reader.hash(`${path}/provenance.json`), bindingHash: reader.hash(`${path}/study-protocol.json`),
      job, rows: judgments.length, originalValid: oldValid, canonicalValid: newValid, statusTransitions: transitionCounts(datasetLedger),
      receiptCount: manifests.length, receiptManifestHash: digest(manifests) });
  }
  for (const item of items) {
    insist(item.judgments.length === 2 && new Set(item.judgments.map((judge) => judge.provider)).size === 2, 'missing configured judge family');
    const judged = item.judgments.every((judge) => judge.status === 'ok');
    item.safe = item.generationStatus === 'ok' && item.numericSafe && judged
      && item.judgments.every((judge) => judge.mps >= 90 && judge.fidelity >= 90 && judge.hardFailCount === 0);
    item.pairNaturalness = judged ? item.judgments.reduce((sum, judge) => sum + judge.naturalness, 0) / 2 : null;
  }
  const summary = summarizeRewrites(rows, correctedJudgments)[spec.id];
  insist(summary.safe === items.filter((item) => item.safe).length && summary.pending_judgments === 0, 'join metrics disagree');
  return { fixtures, items, ledger, generations: rows, originalJudgments, correctedJudgments,
    report: { id: spec.id, provider: spec.provider, requestedModel: candidate.model, transport: candidate.transport,
      overall: summarizeItems(items), byLanguage: Object.fromEntries(LANGUAGES.map((lang) => [lang, summarizeItems(items.filter((item) => item.language === lang))])),
      provenance: { source: spec.source, sourceCommit: COMMITS[spec.source], protocolHash: binding.protocolHash, parentSnapshotHash: parentSnapshot,
        generationFileHash: parent.hash(`${directory}/rewrite-rows.jsonl`), privateGenerationFileHash: parent.hash(`${directory}/rewrites.private.jsonl`),
        generationJob, generationReceipts: generationReceipts.length, generationReceiptManifestHash: digest(receiptHashes(generationReceipts)), judgments: datasets } } };
}

export function summarizeItems(items) {
  const judges = items.flatMap((item) => item.judgments), validPairs = items.filter((item) => finite(item.pairNaturalness));
  return { generations: items.length, fixtureClusters: new Set(items.map((item) => item.fixture_id)).size,
    generationErrors: items.filter((item) => item.generationStatus !== 'ok').length, expectedJudgments: items.length * 2,
    observedJudgments: judges.length, validJudgments: judges.filter((judge) => judge.status === 'ok').length,
    judgmentErrors: judges.filter((judge) => judge.status !== 'ok').length,
    transportErrors: judges.reduce((sum, judge) => sum + judge.transportErrors, 0),
    validJudgePairs: validPairs.length, safe: items.filter((item) => item.safe).length,
    safeRate: items.length ? items.filter((item) => item.safe).length / items.length : null,
    numericSafety: { assessed: items.filter((item) => typeof item.numericSafe === 'boolean').length,
      passed: items.filter((item) => item.numericSafe === true).length, failed: items.filter((item) => item.numericSafe === false).length },
    stages: Object.fromEntries(STAGES.map((stage) => {
      const values = judges.map((judge) => judge.stages[stage]), accepted = values.filter((value) => value.valid);
      return [stage, { observed: values.length, valid: accepted.length, invalid: values.length - accepted.length,
        belowFloor: stage === 'naturalness' ? null : accepted.filter((value) => value.value < 90).length,
        hardFailureResponses: stage === 'mps' ? accepted.filter((value) => value.hardFailCount > 0).length : null,
        scores: distribution(accepted.map((value) => value.value)) }];
    })), pairNaturalness: distribution(validPairs.map((item) => item.pairNaturalness)),
    generationLatencyMs: distribution(items.map((item) => item.durationMs)) };
}

function median(values) {
  const ordered = values.filter(finite).sort((a, b) => a - b), n = ordered.length;
  return n ? n % 2 ? ordered[Math.floor(n / 2)] : (ordered[n / 2 - 1] + ordered[n / 2]) / 2 : null;
}

function interval(values) {
  const ordered = values.filter(finite).sort((a, b) => a - b), n = ordered.length;
  return { confidence: .95, validReplicates: n, missingReplicates: values.length - n,
    lower: n ? ordered[Math.floor(.025 * n)] : null, upper: n ? ordered[Math.ceil(.975 * n) - 1] : null };
}

// Matched draws keep every repeat and both judges inside the sampled fixture.
// Stratification preserves the observed language allocation, not a population mix.
export function fixtureBootstrap(byCandidate, { iterations = 5000, seed = 20260905 } = {}) {
  insist(Number.isSafeInteger(iterations) && iterations >= 20 && iterations <= 10000 && Number.isSafeInteger(seed), 'bootstrap bound');
  const ids = Object.keys(byCandidate), first = byCandidate[ids[0]]; insist(ids.length >= 2 && first?.length, 'bootstrap needs paired candidates');
  const fixtures = [...new Map(first.map((item) => [item.fixture_id, item.language])).entries()].sort(([a], [b]) => a.localeCompare(b));
  insist(fixtures.every(([id, lang]) => LANGUAGES.includes(lang) && first.filter((item) => item.fixture_id === id).every((item) => item.language === lang)), 'bootstrap fixture language differs');
  const expected = sorted(first.map((item) => `${item.fixture_id}/${item.repeat}/${item.language}`));
  for (const items of Object.values(byCandidate)) insist(same(sorted(items.map((item) => `${item.fixture_id}/${item.repeat}/${item.language}`)), expected), 'bootstrap pairing differs');
  insist(new Set(expected).size === expected.length && fixtures.length >= 2, 'bootstrap cluster duplicates');
  const strata = LANGUAGES.map((language) => fixtures.filter(([, lang]) => lang === language).map(([id]) => id)).filter((ids) => ids.length);
  const groups = Object.fromEntries(ids.map((id) => [id, new Map(fixtures.map(([fixture]) => [fixture, byCandidate[id].filter((item) => item.fixture_id === fixture)]))]));
  let state = seed >>> 0;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
  const samples = Object.fromEntries(ids.map((id) => [id, { safeRate: [], naturalnessMedian: [], byLanguage: Object.fromEntries(LANGUAGES.map((lang) => [lang, { safeRate: [], naturalnessMedian: [] }])) }]));
  const draws = [];
  for (let iteration = 0; iteration < iterations; iteration++) {
    const selected = strata.flatMap((stratum) => stratum.map(() => stratum[Math.floor(random() * stratum.length)])); draws.push(selected);
    for (const id of ids) {
      const items = selected.flatMap((fixture) => groups[id].get(fixture)), target = samples[id];
      target.safeRate.push(items.filter((item) => item.safe).length / items.length);
      target.naturalnessMedian.push(median(items.map((item) => item.pairNaturalness)));
      for (const lang of LANGUAGES) {
        const subset = items.filter((item) => item.language === lang), slice = target.byLanguage[lang];
        slice.safeRate.push(subset.length ? subset.filter((item) => item.safe).length / subset.length : null);
        slice.naturalnessMedian.push(median(subset.map((item) => item.pairNaturalness)));
      }
    }
  }
  const pairs = [];
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const left = ids[a], right = ids[b];
    const rate = (id) => byCandidate[id].filter((item) => item.safe).length / byCandidate[id].length;
    pairs.push({ left, right, safeRateDifference: rate(left) - rate(right),
      interval: interval(samples[left].safeRate.map((value, i) => value - samples[right].safeRate[i])) });
  }
  return { method: 'language-stratified paired fixture-cluster percentile bootstrap', iterations, seed,
    quantiles: 'sorted finite replicates: floor(0.025*n), ceil(0.975*n)-1; report missing replicates',
    clusters: fixtures.length, strata: Object.fromEntries(LANGUAGES.map((lang) => [lang, fixtures.filter(([, language]) => language === lang).length])),
    drawHash: sha256(draws), byCandidate: Object.fromEntries(ids.map((id) => [id, { safeRate: interval(samples[id].safeRate),
      naturalnessMedian: interval(samples[id].naturalnessMedian), byLanguage: Object.fromEntries(LANGUAGES.map((lang) => [lang,
        { safeRate: interval(samples[id].byLanguage[lang].safeRate), naturalnessMedian: interval(samples[id].byLanguage[lang].naturalnessMedian) }])) }])), pairs };
}

function transitionCounts(ledger) {
  return Object.fromEntries(['ok->ok', 'ok->error', 'error->ok', 'error->error'].map((value) => [value,
    ledger.filter((row) => `${row.original.status}->${row.corrected.status}` === value).length]));
}

export async function confirmResults({ workspace = resolve(ROOT, '..'), iterations = 5000, seed = 20260905 } = {}) {
  insist(sha256(readFileSync(resolve(ROOT, HELPER))) === HELPER_HASH, 'reviewed replay helper differs');
  const readers = Object.fromEntries(Object.entries(SOURCE_NAMES).map(([source, name]) => [source, createEvidenceReader(resolve(workspace, name))]));
  const runtimes = {};
  for (const source of Object.keys(readers)) runtimes[source] = await loadRuntime(readers[source], COMMITS[source]);
  insist(sha256(summarizeRewrites.toString()) === sha256(runtimes.G.rewrite.summarizeRewrites.toString()), 'existing safety/ranking rule differs');
  for (const source of ['E', 'D']) for (const file of ['src/scoring.js', 'src/json-response.js']) insist(readers[source].hash(file) === readers.G.hash(file), 'scorer/parser semantics differ');
  const results = [];
  for (const spec of FINALISTS) results.push(await auditCandidate(spec, readers, runtimes));
  const fixtureIdentity = results[0].fixtures.map(runtimes.E.validation.fixtureIdentity);
  for (const result of results) insist(same(result.fixtures.map(runtimes.E.validation.fixtureIdentity), fixtureIdentity), 'finalists have different source fixtures');
  const original = summarizeRewrites(results.flatMap((r) => r.generations), results.flatMap((r) => r.originalJudgments));
  const corrected = summarizeRewrites(results.flatMap((r) => r.generations), results.flatMap((r) => r.correctedJudgments));
  const bootstrap = fixtureBootstrap(Object.fromEntries(results.map((r) => [r.report.id, r.items])), { iterations, seed });
  const ledger = results.flatMap((r) => r.ledger);
  const protocol = { schemaVersion: 1, kind: 'full-rewrite-confirmation-canonical-mps', sourceCommits: COMMITS,
    sourceManifestHashes: Object.fromEntries(Object.entries(runtimes).map(([source, runtime]) => [source, runtime.sourceHash])),
    derivationScriptHash: sha256(readFileSync(resolve(ROOT, SCRIPT))), reviewedReplayHelperHash: HELPER_HASH,
    canonicalValidatorHash: readers.G.hash('scripts/research/study-validation.mjs'), canonicalSpecHash: readers.G.hash('core/scoring.md'),
    rankingRuleHash: sha256(readFileSync(resolve(ROOT, 'scripts/research/model-rewrite-benchmark.mjs'))),
    fixtureIdentityHash: sha256(fixtureIdentity), bootstrap: { iterations, seed, drawHash: bootstrap.drawHash, method: bootstrap.method },
    datasets: results.map((r) => ({ candidate: r.report.id, provenance: r.report.provenance })) };
  const protocolHash = digest(protocol);
  const ledgerBytes = ledger.map((row) => JSON.stringify({ ...row, derivedProtocolHash: protocolHash })).join('\n') + '\n';
  const report = { schemaVersion: 1, date: '2026-09-05', timezone: 'Asia/Seoul', status: 'complete-terminal-confirmation-join',
    protocolHash, protocol, privateLedgerHash: sha256(ledgerBytes),
    coverage: { candidates: 6, uniqueFixtures: 34, repeatsPerFixture: 3, generations: results.reduce((n, r) => n + r.generations.length, 0),
      expectedJudgments: 1224, observedJudgments: ledger.length, terminalGenerationJobs: 6, terminalJudgeJobs: 12,
      originalValidJudgments: ledger.filter((r) => r.original.status === 'ok').length, canonicalValidJudgments: ledger.filter((r) => r.corrected.status === 'ok').length,
      statusTransitions: transitionCounts(ledger), byOriginalEvaluator: Object.fromEntries(['E', 'G'].map((source) => [source,
        { judgments: ledger.filter((r) => r.source === source).length, statusTransitions: transitionCounts(ledger.filter((r) => r.source === source)) }])),
      judgedReceipts: ledger.reduce((n, r) => n + r.receipts.length, 0), generationReceipts: results.reduce((n, r) => n + r.report.provenance.generationReceipts, 0) },
    originalRanks: rankSummary(original), ranks: rankSummary(corrected), candidates: results.map((r) => r.report), uncertainty: bootstrap,
    metricDefinitions: {
      safeRate: 'Numerator: numeric proxy pass and two configured different-family valid judgments with MPS/fidelity >=90 and zero hard failures. Denominator: all 102 generation attempts per candidate, including failed judgment cases.',
      ranking: 'Same existing rule: safe rate descending, median of per-generation mean naturalness from fully valid judge pairs descending, generation latency median ascending, ID ascending. The ranking compares these six finalists only.',
      stageScores: 'MPS/fidelity/naturalness distributions use canonically valid final stage responses even if another stage failed. Fidelity is replayed through production scoreFidelity, including its deterministic length component. Separate row errors remain errors; no model counts or scores are repaired.',
      numericSafety: 'Existing deterministic numeric proxy; not a proof of full meaning preservation.',
      uncertainty: 'Resample whole fixtures within language, with replacement, using shared draws for all six candidates. Retain every repeat and judge pair inside each sampled fixture. Intervals are conditional on these selected fixtures and observed judgments; they are not population or human-quality confidence claims.',
      latency: 'Observed generation wall time under shared concurrent load and different transports. No causal speed claim, provider cost claim, or isolated latency benchmark.' },
    limits: [
      'The 34 curated regression source fixtures have no authenticated human-vs-AI authorship or human-quality labels. Naturalness and semantic verdicts are model-rated. Three repeats do not make 102 independent fixture samples.',
      'OpenCodex response.model echoes a requested alias. Identity admission checks recorded response, assistant-message or profile evidence only. Configured provider families do not prove different upstream models or weights.',
      'Old E and corrected G evaluator runtimes/protocols remain separate. Every old valid and invalid response is revalidated unchanged; the original rows, schema flags, protocols and receipts are preserved.',
      'All selected jobs and matrices must be terminal and complete before ranking. A successful job exit alone is insufficient; row matrices, public/private parity, snapshots and receipt sequences are checked too.',
      'The language mix is fixed at 11 EN, 11 KO, 6 ZH and 6 JA fixtures. Bootstrap intervals do not correct selection bias, shared judge bias, changed model aliases, or uncertainty in whether anchor verdicts are true. Pairwise intervals are unadjusted descriptive comparisons.',
      'The score order is a rule-based confirmation result, not a deployment recommendation. No defaults, score gates, core skill, or transport behavior are changed. No additional model call was made.',
      'Public files contain summaries, recorded identifiers and integrity hashes. Source/rewritten text, anchors, rationales and raw responses remain private.' ] };
  for (const reader of Object.values(readers)) reader.unchanged();
  for (const spec of FINALISTS) {
    insist(!readers[spec.source].exists(`${PARENT_BASE}/${spec.id}/.writer.lock`), 'generation writer appeared');
    for (const seat of evaluationSeats(spec)) insist(!readers[seat.source].exists(`${seat.directory}/.writer.lock`), 'judge writer appeared');
  }
  return { report, ledgerBytes };
}

const f = (value, places = 2) => finite(value) ? value.toFixed(places) : 'N/A';
const ci = (value) => `[${f(value.lower)}, ${f(value.upper)}]`;
export function renderConfirmation(report) {
  const c = report.coverage, lines = ['# Full rewrite confirmation — September 5, 2026', '',
    `${c.generations} generations and ${c.observedJudgments}/${c.expectedJudgments} judgments form the complete six-finalist join. Each candidate has 34 fixtures × 3 repeats. All 18 jobs ended with exit code 0.`, '',
    `New derivation protocol: \`${report.protocolHash}\`. Historical evaluator protocol IDs and raw flags remain unchanged.`, '',
    '## Observed ranking', '', '| Rank | Candidate | Safe / attempted | Safe rate, 95% fixture CI | Pair naturalness median | Generation median ms | Canonical judgment errors |', '|---:|---|---:|---|---:|---:|---:|'];
  for (const rank of report.ranks) {
    const data = report.candidates.find((c) => c.id === rank.id), uncertainty = report.uncertainty.byCandidate[rank.id];
    lines.push(`| ${rank.rank} | ${rank.id} | ${rank.safe}/${rank.attempted} | ${f(rank.safeRate)} ${ci(uncertainty.safeRate)} | ${f(rank.naturalnessMedian)} | ${f(rank.generationMedianMs)} | ${data.overall.judgmentErrors}/${data.overall.observedJudgments} |`);
  }
  lines.push('', report.metricDefinitions.ranking, '', report.metricDefinitions.safeRate, '',
    '## Historical versus canonical validity', '', `Valid judgments: ${c.originalValidJudgments} → ${c.canonicalValidJudgments}. Counts below cover every original valid and invalid row.`, '',
    '| Transition | Judgments |', '|---|---:|');
  for (const [transition, count] of Object.entries(c.statusTransitions)) lines.push(`| ${transition} | ${count} |`);
  lines.push('', '## Language coverage and diagnostics', '',
    '| Candidate | Language | Gen / fixtures | Numeric pass / assessed | Valid judge pairs / gen | Judge errors / rows | Safe / gen | Safe 95% fixture CI | MPS n / median | Fidelity n / median | Naturalness n / median |',
    '|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|');
  for (const candidate of report.candidates) for (const [lang, slice] of Object.entries(candidate.byLanguage)) {
    const stage = (name) => `${slice.stages[name].scores.n} / ${f(slice.stages[name].scores.median)}`;
    lines.push(`| ${candidate.id} | ${lang} | ${slice.generations} / ${slice.fixtureClusters} | ${slice.numericSafety.passed}/${slice.numericSafety.assessed} | ${slice.validJudgePairs}/${slice.generations} | ${slice.judgmentErrors}/${slice.observedJudgments} | ${slice.safe}/${slice.generations} | ${ci(report.uncertainty.byCandidate[candidate.id].byLanguage[lang].safeRate)} | ${stage('mps')} | ${stage('fidelity')} | ${stage('naturalness')} |`);
  }
  lines.push('', report.metricDefinitions.stageScores, '', report.metricDefinitions.numericSafety, '', '## Fixture-clustered uncertainty', '',
    `${report.uncertainty.iterations} deterministic resamples use seed ${report.uncertainty.seed}. ${report.metricDefinitions.uncertainty}`, '',
    'The JSON report also includes naturalness-median intervals and finite/missing replicate counts. The following paired safe-rate differences use the same sampled fixtures for both candidates; intervals containing zero do not resolve an ordering.', '',
    '| Left minus right | Observed difference | 95% paired fixture CI |', '|---|---:|---|');
  for (const pair of report.uncertainty.pairs) lines.push(`| ${pair.left} − ${pair.right} | ${f(pair.safeRateDifference, 3)} | ${ci(pair.interval)} |`);
  lines.push('', '## Evidence and limits', '',
    `Bound receipts: ${c.generationReceipts} generation and ${c.judgedReceipts} judgment receipts. The private ledger hash is \`${report.privateLedgerHash}\`. Source commits, terminal job records, original snapshots, evaluator protocols and file/receipt hashes are retained in the JSON companion.`, '',
    report.metricDefinitions.latency, '', ...report.limits.map((value) => `- ${value}`), '', '## Reproduce offline', '',
    '```sh', 'node scripts/research/confirm-model-results.mjs --check', '```', '',
    'The default sources are the frozen sibling E, D and G worktrees. `--workspace DIR` changes only their common parent. `--write` writes this Markdown/JSON pair and a gitignored private ledger under `/tmp/patina-full-rewrite-confirmation-20260905`. `--check` reproduces both public files and the private ledger. The command makes no network request or model call and never writes to a source study.', '');
  return lines.join('\n');
}

export async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help') { console.log('confirm-model-results [--write | --check] [--workspace DIR] (offline only)'); return; }
    if (['--write', '--check'].includes(arg)) options[arg.slice(2)] = true;
    else if (arg === '--workspace' && argv[i + 1] && !argv[i + 1].startsWith('--')) options.workspace = argv[++i];
    else throw new Error('model-confirmation: invalid argument');
  }
  insist(!(options.write && options.check), 'conflicting output modes');
  const blocked = () => { throw new Error('model-confirmation: network disabled'); };
  globalThis.fetch = blocked; http.request = blocked; http.get = blocked; https.request = blocked; https.get = blocked; net.Socket.prototype.connect = blocked;
  const { report, ledgerBytes } = await confirmResults({ workspace: options.workspace });
  const files = { [`${REPORT}.json`]: `${JSON.stringify(report, null, 2)}\n`, [`${REPORT}.md`]: renderConfirmation(report) };
  if (options.check) {
    for (const [file, data] of Object.entries(files)) insist(readFileSync(resolve(ROOT, file), 'utf8') === data, 'public report differs');
    insist(readFileSync(resolve(OUTPUT, 'judgments.private.jsonl'), 'utf8') === ledgerBytes, 'private ledger differs');
  }
  if (options.write) {
    insist(!existsSync(OUTPUT) || !lstatSync(OUTPUT).isSymbolicLink(), 'private output symlink'); mkdirSync(OUTPUT, { recursive: true, mode: 0o700 });
    for (const [file, data] of Object.entries({ '.gitignore': '*\n', 'judgments.private.jsonl': ledgerBytes, 'protocol.json': `${JSON.stringify(report.protocol, null, 2)}\n` })) {
      const path = resolve(OUTPUT, file); insist(!existsSync(path) || !lstatSync(path).isSymbolicLink(), 'private artifact symlink'); writeFileSync(path, data, { mode: 0o600 });
    }
    for (const [file, data] of Object.entries(files)) { const path = resolve(ROOT, file); insist(!existsSync(path) || !lstatSync(path).isSymbolicLink(), 'public output symlink'); writeFileSync(path, data); }
  }
  console.log(JSON.stringify({ protocolHash: report.protocolHash, coverage: report.coverage, ranks: report.ranks }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(/^(model-confirmation|mps-revalidation): /.test(error.message) ? error.message : 'model-confirmation: evidence validation failed'); process.exitCode = 1;
});

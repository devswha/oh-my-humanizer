#!/usr/bin/env node
// Offline correction of the three completed screening joins. Never resume a study.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import yaml from 'js-yaml';
import { parseStrictJson } from '../../src/json-response.js';
import { validateRawMps } from './study-validation.mjs';
import { judgeRewrite, summarizeRewrites } from './model-rewrite-benchmark.mjs';
import { selectRewriteFinalists } from './join-model-evaluations.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = 'scripts/research/revalidate-mps-evidence.mjs';
const REPORT = 'docs/research/mps-validation-correction-20260905';
const PRIVATE_OUTPUT = '/tmp/patina-mps-revalidation-20260905';
const VALIDATION_SOURCE = resolve(ROOT, '../patina-corrected-judge-source-20260905');
const FIX = '5567e4a81fedd6f56cdd518507051c6c0db04f9d';
const HASH = /^[a-f0-9]{64}$/;
const SEATS = ['openai-5.5', 'gemini-3.7', 'anthropic-sonnet'];
const STAGES = ['mps', 'fidelity', 'naturalness'];
const FIELDS = ['status', 'error', 'mps', 'fidelity', 'naturalness', 'hard_fail_count'];
const COMMITS = {
  A: '66a19b79e68e0e7df00d0c5da0aa94dac3c51e1c',
  D: 'dca3aa1de00bd21594f39e5b3c83614f28f22b85',
  E: '8918cd015fc71b35d0b7855cfe7625eb7a050fcf',
  F: '6ef4ae0abe7f571dabd7648fbe9373ea16946616',
};
const SCREENS = {
  openai: { source: 'A', provider: 'openai', generations: 72, parent: 'artifacts/model-evaluation-20260904/validated/rewrite-openai', evaluations: ['claude-on-openai'] },
  gemini: { source: 'A', provider: 'gemini', generations: 60, parent: 'artifacts/model-evaluation-20260904/validated/rewrite-gemini', evaluations: ['claude-on-gemini'] },
  claude: { source: 'D', provider: 'anthropic', generations: 60, parent: 'artifacts/model-evaluation-claude-isolated-20260905/validated/rewrite-screen', evaluations: ['openai-on-claude', 'gemini-on-claude'] },
};
const MAX_FILE = 16 * 1024 * 1024;
const MAX_TOTAL = 128 * 1024 * 1024;
const key = (row) => `${row.candidate_id}/${row.fixture_id}/${row.repeat}`;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((name) => [name, canonical(value[name])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export const sha256 = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const digest = (value) => sha256(canonical(value));
const sorted = (values) => [...values].sort();
const insist = (condition, code) => { if (!condition) throw new Error(`mps-revalidation: ${code}`); };
const snapshot = (row) => Object.fromEntries(FIELDS.map((field) => [field, row[field] ?? null]));
const unresolved = (row) => [row.error, ...(row.calls || []).map((call) => call.error)].some((error) =>
  ['study-cancelled', 'study-call-inflight', 'study-call-unobserved', 'study-journal-persistence-failed'].includes(error));

function json(bytes) {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error('mps-revalidation: invalid JSON'); }
}

export function createEvidenceReader(root) {
  root = realpathSync(root);
  const cache = new Map(); let total = 0;
  const locate = (name) => {
    insist(typeof name === 'string' && /^[a-zA-Z0-9._/-]+$/.test(name) && !name.startsWith('/')
      && name.split('/').every((part) => part && !['.', '..'].includes(part)), 'unsafe evidence path');
    let full = root;
    for (const part of name.split('/')) { full = resolve(full, part); insist(!lstatSync(full).isSymbolicLink(), 'evidence symlink'); }
    return full;
  };
  const bytes = (name) => {
    if (cache.has(name)) return cache.get(name);
    const full = locate(name), stat = lstatSync(full);
    insist(stat.isFile() && stat.size <= MAX_FILE && total + stat.size <= MAX_TOTAL, 'evidence size bound');
    const data = readFileSync(full); insist(data.length === stat.size, 'evidence changed during read');
    total += data.length; cache.set(name, data); return data;
  };
  return { root, bytes, json: (name) => json(bytes(name)),
    rows(name, rowKey = key) {
      const rows = bytes(name).toString('utf8').split(/\r?\n/).filter((line) => line.trim()).map((line) => json(line));
      insist(rows.length <= 500 && new Set(rows.map(rowKey)).size === rows.length, 'row bound or duplicate'); return rows;
    },
    list(name) { const entries = readdirSync(locate(name)); insist(entries.length <= 1500, 'directory bound'); return entries.sort(); },
    exists: (name) => existsSync(resolve(root, name)),
    hash: (name) => sha256(bytes(name)),
    unchanged() {
      for (const [name, data] of cache) {
        const full = locate(name); insist(lstatSync(full).size === data.length && sha256(readFileSync(full)) === sha256(data), 'evidence changed during derivation');
      }
    },
  };
}

function verifyCommitted(reader, commit, paths) {
  insist(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: reader.root, encoding: 'utf8' }).trim() === commit, 'frozen source commit differs');
  const output = execFileSync('git', ['cat-file', '--batch'], { cwd: reader.root,
    input: paths.map((path) => `${commit}:${path}\n`).join(''), maxBuffer: MAX_TOTAL });
  let offset = 0;
  for (const path of paths) {
    const end = output.indexOf(10, offset);
    const header = output.subarray(offset, end).toString('utf8').match(/^[a-f0-9]{40} blob ([0-9]+)$/);
    insist(header, 'source file missing from commit');
    const size = Number(header[1]);
    insist(sha256(output.subarray(end + 1, end + size + 1)) === reader.hash(path), 'source bytes differ from commit');
    offset = end + size + 2;
  }
  insist(offset === output.length, 'invalid committed source stream');
}

async function loadRuntime(reader, commit) {
  const names = execFileSync('git', ['ls-tree', '-r', '--name-only', commit], { cwd: reader.root, encoding: 'utf8' }).trim().split('\n')
    .filter((name) => /^(src|patterns|core|document-types|lexicon|personas)\//.test(name)
      || /^tests\/fixtures\/(live-quality|suspect-zones)\//.test(name)
      || ['.patina.default.yaml', 'package.json', 'tests/quality/live-quality.mjs', 'tests/quality/live-scorer-benchmark.mjs'].includes(name)
      || /^scripts\/research\/[a-z0-9-]+\.mjs$/.test(name)
      || /^docs\/research\/model-evaluation.*\.json$/.test(name));
  verifyCommitted(reader, commit, names);
  const module = (name) => import(pathToFileURL(resolve(reader.root, name)).href);
  const [rewrite, journal, validation, live, loader, numbers] = await Promise.all([
    module('scripts/research/model-rewrite-benchmark.mjs'), module('scripts/research/study-journal.mjs'),
    module('scripts/research/study-validation.mjs'), module('tests/quality/live-quality.mjs'),
    module('src/loader.js'), module('src/features/meaning-proxy.js'),
  ]);
  return { rewrite, journal, validation, live, loader, numbers,
    sourceHashes: Object.fromEntries(names.map((name) => [name, reader.hash(name)])) };
}

export function checkParity(publicRows, privateRows, privateField) {
  insist(publicRows.length === privateRows.length && new Set(publicRows.map(key)).size === publicRows.length
    && new Set(privateRows.map(key)).size === privateRows.length, 'public/private matrix differs');
  const byKey = new Map(privateRows.map((row) => [key(row), row]));
  for (const row of publicRows) {
    const stored = byKey.get(key(row)); insist(stored, 'missing private row');
    const { [privateField]: _private, ...publicPart } = stored;
    insist(same(row, publicPart), 'public/private row differs');
  }
  return byKey;
}

export function bindReceipt(receipt, { logicalId, index, candidate, promptHash, temperature, responseFormat = null, extraBody = null }) {
  const identity = { logicalId, index, candidate, promptHash, temperature, responseFormat, extraBody };
  insist(receipt.schemaVersion === 1 && ['completed', 'error'].includes(receipt.state), 'receipt is not terminal');
  insist(HASH.test(promptHash) && receipt.promptHash === promptHash && receipt.requestHash === sha256(identity), 'request/prompt binding differs');
  insist(!['study-call-inflight', 'study-call-unobserved', 'study-cancelled', 'study-journal-persistence-failed'].includes(receipt.error), 'unresolved receipt');
}

function errorCode(error) {
  return ['invalid-mps-schema', 'invalid-anchor', 'inconsistent-mps-counts', 'inconsistent-mps-score'].includes(error?.message) ? error.message : 'invalid-mps-json';
}

// No counts or MPS values are changed. Validators receive the original text.
export function classifyMps(text, originalSchemaValid, legacyValidator, correctedValidator = validateRawMps) {
  let oldValid = false, newValid = false, reason = null, parsed = null;
  try { legacyValidator(text); oldValid = true; } catch { /* A historical rejection is evidence too. */ }
  insist(originalSchemaValid === oldValid, 'historical MPS flag differs from original validator');
  try { correctedValidator(text); newValid = true; } catch (error) { reason = errorCode(error); }
  try { parsed = parseStrictJson(text); } catch { /* Preserve unparsable input as a rejection. */ }
  const fields = ['pass_count', 'total_count', 'polarity_pass_count', 'polarity_total_count', 'mps'];
  return { originalSchemaValid: oldValid, correctedSchemaValid: newValid,
    transition: `${oldValid ? 'valid' : 'invalid'}->${newValid ? 'valid' : 'invalid'}`, rejection: reason,
    selfReported: Object.fromEntries(fields.map((field) => [field, Number.isFinite(parsed?.[field]) ? parsed[field] : null])),
    negationAnchors: Array.isArray(parsed?.anchors) ? parsed.anchors.filter((anchor) => anchor?.type === 'negation').length : null,
    acceptedMps: newValid ? parsed.mps : null };
}

function receiptSequence(reader, directory, logicalId, row, candidate, runtime) {
  insist(!unresolved(row) && Array.isArray(row.calls) && row.calls.length > 0 && row.calls.length <= 6, 'unresolved row or call bound');
  const group = sha256(logicalId), names = Array.from({ length: row.calls.length }, (_, i) => `${i + 1}.private.json`);
  insist(same(reader.list(`${directory}/calls/${group}`), names), 'receipt sequence differs');
  return names.map((name, i) => {
    const path = `${directory}/calls/${group}/${name}`, receipt = reader.json(path), call = row.calls[i];
    insist(['completed', 'error'].includes(receipt.state) && !unresolved(receipt), 'nonterminal receipt');
    const safe = runtime.journal.safeCallRecord(receipt, candidate);
    const { stage: _stage, ...originalCall } = call;
    insist(same(safe, originalCall), 'original receipt/call metadata differs');
    insist(safe.modelIdentityVerified === true || safe.profileIdentityVerified === true, 'missing recorded identity evidence');
    insist(!safe.mixedOrUnexpectedModel && receipt.response?.effectiveModels?.every((model) => model === candidate.model), 'mixed or unexpected recorded model');
    return { receipt, path, sha256: reader.hash(path), group, index: i + 1 };
  });
}

export async function replayBoundJudgment({ row, stored, fixture, generation, judge, entries, originalRuntime,
  correctedRun = judgeRewrite, correctedValidator = validateRawMps }) {
  const logicalId = `${row.protocol_hash}/${key(row)}/judge/${judge.id}`;
  const run = async (evaluate) => {
    let ordinal = 0, bindingFailure = null;
    const replay = await evaluate(fixture, generation, judge, { logicalId,
      complete: async (requested, prompt, options) => {
        const entry = entries[ordinal++];
        try {
          insist(entry && same(requested, judge), 'unrecorded replay call or candidate');
          bindReceipt(entry.receipt, { logicalId, index: ordinal, candidate: requested, promptHash: sha256(prompt),
            temperature: options.temperature ?? .2, responseFormat: options.responseFormat ?? null, extraBody: options.extraBody ?? null });
        } catch (error) { bindingFailure = error; throw error; }
        for (const attempt of entry.receipt.transportAttempts || []) options.onAttempt?.(attempt);
        if (entry.receipt.state !== 'completed') throw new Error(entry.receipt.error);
        return globalThis.structuredClone(entry.receipt.response);
      } });
    if (bindingFailure) throw bindingFailure;
    insist(ordinal === entries.length, 'replay did not consume exact receipt sequence');
    return replay;
  };
  const historical = await run(originalRuntime.rewrite.judgeRewrite);
  insist(same(snapshot(historical), snapshot(row)), 'original judgment outcome differs from receipts');
  insist(same(historical.private_details, stored.private_details), 'original private judgment details differ');
  for (let i = 0; i < entries.length; i++) insist(historical.calls[i].stage === row.calls[i].stage
    && historical.calls[i].schema_valid === row.calls[i].schema_valid, 'original stage binding differs');
  const corrected = await run(correctedRun);
  insist(corrected.calls.length === row.calls.length, 'correction changed call sequence');
  const mpsResponses = [];
  for (let i = 0; i < entries.length; i++) {
    const oldCall = row.calls[i], nextCall = corrected.calls[i];
    insist(STAGES.includes(oldCall.stage) && oldCall.stage === nextCall.stage, 'correction changed stage');
    if (oldCall.stage === 'mps' && entries[i].receipt.state === 'completed') {
      const result = classifyMps(entries[i].receipt.response.text, oldCall.schema_valid, originalRuntime.validation.validateRawMps, correctedValidator);
      insist(nextCall.schema_valid === result.correctedSchemaValid, 'corrected MPS replay differs');
      mpsResponses.push({ ordinal: i + 1, responseSha256: sha256(entries[i].receipt.response.text), ...result });
    } else insist(oldCall.schema_valid === nextCall.schema_valid, 'non-MPS validation changed');
  }
  // Validation may change status and derived hard-failure availability, not a
  // model's numerical MPS, fidelity, or naturalness response.
  for (const field of ['mps', 'fidelity', 'naturalness']) insist((corrected[field] ?? null) === (historical[field] ?? null), 'correction repaired a model score');
  return { corrected, mpsResponses };
}

export function rankSummary(summary) {
  const rows = Object.entries(summary).map(([id, value]) => ({ id, ...value }));
  insist(rows.every((row) => row.pending_judgments === 0), 'pending judgments prevent ranking');
  return rows.sort((a, b) => b.safe_rate - a.safe_rate
    || (b.naturalness.median ?? -Infinity) - (a.naturalness.median ?? -Infinity)
    || (a.generation_latency_ms.median ?? Infinity) - (b.generation_latency_ms.median ?? Infinity)
    || a.id.localeCompare(b.id)).map((row, i) => ({ rank: i + 1, id: row.id, attempted: row.attempted,
      safe: row.safe, safeRate: row.safe_rate, judgeErrors: row.judge_errors, naturalnessMedian: row.naturalness.median,
      generationMedianMs: row.generation_latency_ms.median }));
}

function transitions(values) {
  return Object.fromEntries(['valid->valid', 'valid->invalid', 'invalid->valid', 'invalid->invalid'].map((value) => [value, values.filter((item) => item === value).length]));
}

function validatePlan(plan, screen) {
  const spec = SCREENS[screen];
  insist(spec && plan.parentProvider === spec.provider && !plan.parentCandidate && (plan.repeat ?? 1) === 1
    && (plan.suite ?? 'screening') === 'screening', 'plan scope differs');
  insist(resolve(plan.parent) === resolve(plan.parentRoot, spec.parent), 'parent is outside selected screening cohort');
  const evaluations = spec.evaluations.map((name) => resolve(plan.evaluationSourceRoot, 'artifacts/evaluation-parent-20260905', name));
  insist(same(sorted(plan.evaluations.map((path) => resolve(path))), sorted(evaluations)), 'evaluation scope differs');
  const parentProtocol = spec.source === 'A' ? 'docs/research/model-evaluation-20260904.json' : 'docs/research/model-evaluation-claude-isolated-20260905.json';
  insist(resolve(plan.parentCandidates) === resolve(plan.parentRoot, parentProtocol)
    && resolve(plan.candidates) === resolve(plan.evaluationSourceRoot, 'docs/research/model-evaluation-claude-isolated-20260905.json'), 'protocol source differs');
  insist(plan.output === `/tmp/patina-${screen}-rewrite-screen-summary`, 'baseline summary scope differs');
  return { spec, parentProtocol };
}

async function auditScreen(screen, plan, readers, runtimes, correctedRuntime) {
  const { spec, parentProtocol } = validatePlan(plan, screen);
  const parentReader = readers[spec.source], parentRuntime = runtimes[spec.source], evaluator = readers.E;
  const directory = spec.parent;
  insist(!parentReader.exists(`${directory}/.writer.lock`), 'selected parent writer active');
  const protocol = parentReader.json(parentProtocol), evaluationProtocol = evaluator.json('docs/research/model-evaluation-claude-isolated-20260905.json');
  const fixtures = parentRuntime.rewrite.rewriteFixtures('screening', parentReader.root);
  insist(fixtures.length === 12 && new Set(fixtures.map((f) => f.fixture_id)).size === 12, 'fixture matrix differs');
  const candidates = protocol.candidates.filter((candidate) => candidate.provider === spec.provider);
  const generations = parentReader.rows(`${directory}/rewrite-rows.jsonl`), privateRows = parentReader.rows(`${directory}/rewrites.private.jsonl`);
  const originals = checkParity(generations, privateRows, 'rewrite');
  const expected = candidates.flatMap((candidate) => fixtures.map((fixture) => `${candidate.id}/${fixture.fixture_id}/0`));
  insist(generations.length === spec.generations && same(sorted(generations.map(key)), sorted(expected)), 'generation matrix incomplete or unexpected');
  const config = yaml.load(parentReader.bytes('.patina.default.yaml').toString('utf8'));
  config.documentType = config['document-type'] || 'default'; delete config['document-type']; config.persona = null; config.register = null;
  const prompts = new Map();
  for (const fixture of fixtures) prompts.set(fixture.fixture_id, await parentRuntime.live.buildPatinaRewritePrompt(fixture, {
    repoRoot: parentReader.root, promptMode: 'minimal', config, patterns: parentRuntime.loader.loadPatterns(parentReader.root, fixture.language),
  }));
  const generationEvidence = [], expectedParentGroups = [];
  for (const row of generations) {
    const original = originals.get(key(row)), fixture = fixtures.find((f) => f.fixture_id === row.fixture_id), candidate = candidates.find((c) => c.id === row.candidate_id);
    insist(row.schemaVersion === 1 && row.status === 'ok' && !unresolved(row) && HASH.test(row.protocol_hash)
      && row.repeat === 0 && row.text_hash === fixture.text_hash && row.language === fixture.language
      && row.provider === candidate.provider && row.requested_model === candidate.model && row.transport === candidate.transport
      && row.prompt_hash === sha256(prompts.get(fixture.fixture_id)) && sha256(original.rewrite) === row.rewrite_hash, 'generation source/identity/prompt differs');
    insist(row.number_safety?.ok === parentRuntime.numbers.evaluateNumberSafety(fixture.text, original.rewrite, fixture.language).ok, 'original numeric safety differs');
    const logicalId = `${row.protocol_hash}/${key(row)}/rewrite`;
    const entries = receiptSequence(parentReader, directory, logicalId, row, candidate, parentRuntime);
    for (const entry of entries) bindReceipt(entry.receipt, { logicalId, index: entry.index, candidate, promptHash: row.prompt_hash, temperature: .2 });
    insist(parentRuntime.live.deliveredRewrite(entries.at(-1).receipt.response.text) === original.rewrite, 'delivered generation differs from receipt');
    generationEvidence.push(...entries); expectedParentGroups.push(sha256(logicalId));
  }
  const parentProtocols = [...new Set(generations.map((row) => row.protocol_hash))];
  insist(parentProtocols.length === 1, 'mixed parent protocols');
  if (parentReader.exists(`${directory}/study-protocol.json`)) insist(parentReader.json(`${directory}/study-protocol.json`).protocolHash === parentProtocols[0], 'parent protocol directory binding differs');
  else insist(plan.allowLegacyParent === true, 'unbound parent not authorized');

  const datasets = [];
  for (const id of SEATS) if (parentReader.exists(`${directory}/judge-${id}.jsonl`)) datasets.push({ reader: parentReader, runtime: parentRuntime,
    directory, id, protocol, parent: true, source: spec.source });
  const evaluationSemantics = runtimes.E.validation.studySemantics(evaluator.root);
  const parentInputHashes = new Map(); let parentSnapshotHash = null;
  for (const name of spec.evaluations) {
    const path = `artifacts/evaluation-parent-20260905/${name}`;
    insist(!evaluator.exists(`${path}/.writer.lock`), 'selected evaluation writer active');
    const provenance = evaluator.json(`${path}/provenance.json`);
    const base = Object.fromEntries(['schemaVersion', 'bindingMode', 'parentProtocolHashes', 'inputHashes', 'scope', 'fixtures'].map((field) => [field, provenance[field]]));
    insist(sha256(base) === provenance.parentSnapshotHash && same(base.parentProtocolHashes, parentProtocols)
      && same(base.scope, { provider: spec.provider, candidateId: null, repeat: 1 })
      && same(base.fixtures, fixtures.map(parentRuntime.validation.fixtureIdentity)), 'parent snapshot provenance differs');
    for (const [file, hash] of Object.entries(base.inputHashes)) {
      insist(file === 'protocol' || /^(rewrite-rows\.jsonl|rewrites\.private\.jsonl|study-protocol\.json|judge-[a-z0-9.-]+(?:\.private)?\.jsonl|calls\/[a-f0-9]{64}\/[1-6]\.private\.json)$/.test(file), 'unexpected parent snapshot member');
      insist(HASH.test(hash) && (file === 'protocol' ? parentReader.hash(parentProtocol) : parentReader.hash(`${directory}/${file}`)) === hash, 'parent snapshot bytes differ');
    }
    if (parentSnapshotHash) insist(parentSnapshotHash === provenance.parentSnapshotHash, 'evaluations use different parent snapshots');
    parentSnapshotHash = provenance.parentSnapshotHash;
    parentInputHashes.set(name, base.inputHashes);
    const id = provenance.judge?.id, judge = evaluationProtocol.candidates.find((candidate) => candidate.id === id);
    insist(judge && SEATS.includes(id) && same(provenance.judge, { id, provider: judge.provider, model: judge.model, transport: judge.transport, effort: judge.effort ?? null }), 'evaluation judge identity differs');
    const expectedProtocol = sha256({ protocol: evaluationProtocol, judge: id, parentSnapshotHash, semantics: evaluationSemantics });
    insist(provenance.evaluationProtocolHash === expectedProtocol && evaluator.json(`${path}/study-protocol.json`).protocolHash === expectedProtocol, 'evaluation protocol differs');
    datasets.push({ reader: evaluator, runtime: runtimes.E, directory: path, id, protocol: evaluationProtocol,
      parent: false, protocolHash: expectedProtocol, source: 'E' });
  }
  const allOriginal = [], allCorrected = [], ledger = [], datasetEvidence = [];
  for (const dataset of datasets) {
    const { reader, runtime, directory: path, id } = dataset;
    const publicFile = `${path}/judge-${id}.jsonl`, privateFile = `${path}/judge-${id}.private.jsonl`;
    const rows = reader.rows(publicFile), stored = checkParity(rows, reader.rows(privateFile), 'private_details');
    insist(rows.length === generations.length && same(sorted(rows.map(key)), sorted(expected)), 'judge matrix incomplete or unexpected');
    const judge = dataset.protocol.candidates.find((candidate) => candidate.id === id);
    const entriesManifest = [], groups = [];
    for (const row of rows) {
      const generation = originals.get(key(row)), fixture = fixtures.find((f) => f.fixture_id === row.fixture_id), generator = candidates.find((c) => c.id === row.candidate_id);
      insist(row.schemaVersion === 1 && ['ok', 'error'].includes(row.status) && !unresolved(row)
        && row.text_hash === generation.text_hash && row.rewrite_hash === generation.rewrite_hash
        && row.judge_id === id && row.judge_model === judge.model && row.judge_provider === judge.provider && row.judge_transport === judge.transport
        && runtime.rewrite.judgeCandidates(generator, dataset.protocol).some((seat) => seat.id === id)
        && row.protocol_hash === (dataset.parent ? generation.protocol_hash : dataset.protocolHash), 'judgment identity or protocol differs');
      if (!dataset.parent) insist(row.parent_protocol_hash === generation.protocol_hash && row.parent_snapshot_hash === parentSnapshotHash, 'judgment parent binding differs');
      const logicalId = `${row.protocol_hash}/${key(row)}/judge/${id}`;
      const entries = receiptSequence(reader, path, logicalId, row, judge, runtime);
      const result = await replayBoundJudgment({ row, stored: stored.get(key(row)), fixture, generation, judge, entries, originalRuntime: runtime,
        correctedRun: correctedRuntime.rewrite.judgeRewrite, correctedValidator: correctedRuntime.validation.validateRawMps });
      const corrected = { ...row, ...snapshot(result.corrected) };
      allOriginal.push(row); allCorrected.push(corrected); groups.push(sha256(logicalId));
      const receiptBindings = entries.map((entry, i) => ({ path: entry.path, sha256: entry.sha256, ordinal: entry.index,
        requestHash: entry.receipt.requestHash, promptHash: entry.receipt.promptHash, responseSha256: entry.receipt.response ? sha256(entry.receipt.response.text) : null,
        originalSchemaValid: entry.receipt.schemaValid ?? null, correctedSchemaValid: result.corrected.calls[i].schema_valid,
        stage: row.calls[i].stage, identityEvidence: row.calls[i].identityEvidence ?? 'response-metadata' }));
      entriesManifest.push(...receiptBindings);
      ledger.push({ schemaVersion: 1, screen, source: dataset.source, sourceCommit: COMMITS[dataset.source],
        sourcePublicFile: publicFile, sourcePrivateFile: privateFile,
        originalPublicRowHash: sha256(row), originalPrivateRowHash: sha256(stored.get(key(row))),
        original: globalThis.structuredClone(row), corrected: snapshot(result.corrected),
        statusTransition: `${row.status === 'ok' ? 'valid' : 'invalid'}->${corrected.status === 'ok' ? 'valid' : 'invalid'}`,
        mpsResponses: result.mpsResponses, receiptBindings });
    }
    if (dataset.parent) expectedParentGroups.push(...groups);
    else insist(same(reader.list(`${path}/calls`), sorted(groups)), 'unexpected evaluation receipt group');
    datasetEvidence.push({ source: dataset.source, sourceCommit: COMMITS[dataset.source], judge: id,
      requestedModel: judge.model, transport: judge.transport, originalProtocolHash: rows[0].protocol_hash,
      publicFile, publicFileSha256: reader.hash(publicFile), privateFile, privateFileSha256: reader.hash(privateFile),
      rows: rows.length, originalValid: rows.filter((row) => row.status === 'ok').length,
      receiptCount: entriesManifest.length, receiptManifestHash: digest(entriesManifest),
      ...(!dataset.parent ? { provenanceHash: reader.hash(`${path}/provenance.json`), directoryBindingHash: reader.hash(`${path}/study-protocol.json`) } : {}) });
  }
  insist(same(parentReader.list(`${directory}/calls`), sorted(expectedParentGroups)), 'unexpected parent receipt group');
  insist(allOriginal.length === generations.length * 2, 'missing screening judge seats');
  // Coverage must match the original snapshot exactly, not a convenient subset.
  for (const hashes of parentInputHashes.values()) {
    const files = ['protocol', 'rewrite-rows.jsonl', 'rewrites.private.jsonl'];
    if (parentReader.exists(`${directory}/study-protocol.json`)) files.push('study-protocol.json');
    for (const dataset of datasets.filter((dataset) => dataset.parent)) files.push(`judge-${dataset.id}.jsonl`, `judge-${dataset.id}.private.jsonl`);
    for (const group of expectedParentGroups) for (const file of parentReader.list(`${directory}/calls/${group}`)) files.push(`calls/${group}/${file}`);
    insist(same(sorted(Object.keys(hashes)), sorted(files)), 'parent snapshot membership differs');
  }
  const before = summarizeRewrites(generations, allOriginal), after = summarizeRewrites(generations, allCorrected);
  const oldRank = rankSummary(before), newRank = rankSummary(after), oldTopTwo = oldRank.slice(0, 2).map((row) => row.id), newTopTwo = newRank.slice(0, 2).map((row) => row.id);
  insist(same(selectRewriteFinalists(before)[spec.provider], oldTopTwo) && same(selectRewriteFinalists(after)[spec.provider], newTopTwo), 'ranking differs from join rule');
  const baselineReader = createEvidenceReader(plan.output), baseline = baselineReader.json('rewrite-summary.json');
  insist(same(baseline.summary, before) && same(baseline.finalists[spec.provider], oldTopTwo), 'original F screening summary differs');
  baselineReader.unchanged();
  const changes = newRank.map((next) => {
    const prior = oldRank.find((row) => row.id === next.id);
    return { id: next.id, oldRank: prior.rank, newRank: next.rank, oldSafe: prior.safe, newSafe: next.safe,
      oldJudgeErrors: prior.judgeErrors, newJudgeErrors: next.judgeErrors,
      enteredTopTwo: newTopTwo.includes(next.id) && !oldTopTwo.includes(next.id),
      leftTopTwo: oldTopTwo.includes(next.id) && !newTopTwo.includes(next.id) };
  }).filter((row) => row.oldRank !== row.newRank || row.oldSafe !== row.newSafe || row.oldJudgeErrors !== row.newJudgeErrors);
  const mps = ledger.flatMap((row) => row.mpsResponses);
  for (const path of [directory]) insist(!parentReader.exists(`${path}/.writer.lock`), 'parent writer appeared');
  for (const name of spec.evaluations) insist(!evaluator.exists(`artifacts/evaluation-parent-20260905/${name}/.writer.lock`), 'evaluation writer appeared');
  return { ledger, report: { screen, provider: spec.provider, generations: generations.length, judgments: ledger.length,
    originalValid: allOriginal.filter((row) => row.status === 'ok').length, correctedValid: allCorrected.filter((row) => row.status === 'ok').length,
    statusTransitions: transitions(ledger.map((row) => row.statusTransition)), mpsTransitions: transitions(mps.map((row) => row.transition)),
    oldTopTwo, newTopTwo, oldRanks: oldRank, correctedRanks: newRank, changes,
    requiresConfirmation: { promotedCandidates: newTopTwo.filter((id) => !oldTopTwo.includes(id)),
      correctedTopTwo: newTopTwo, action: 'Revalidate any completed confirmation receipts with the corrected validator before relying on them. Newly selected candidates require confirmation evidence. No active confirmation dataset was inspected and no paid rerun is authorized by this report.' },
    provenance: { source: spec.source, sourceCommit: COMMITS[spec.source], originalParentProtocolHash: parentProtocols[0], parentSnapshotHash,
      generationFileHash: parentReader.hash(`${directory}/rewrite-rows.jsonl`), privateGenerationFileHash: parentReader.hash(`${directory}/rewrites.private.jsonl`),
      generationReceiptCount: generationEvidence.length,
      generationReceiptManifestHash: digest(generationEvidence.map((entry) => ({ path: entry.path, sha256: entry.sha256, requestHash: entry.receipt.requestHash, promptHash: entry.receipt.promptHash }))),
      rebuiltGenerationPrompts: generations.length, baselineSummaryHash: baselineReader.hash('rewrite-summary.json'), judgments: datasetEvidence } } };
}

export async function deriveCorrection(plans, { joinSourceRoot = '/home/devswha/workspace/patina-model-results',
  validationSourceRoot = VALIDATION_SOURCE, validationCommit = FIX } = {}) {
  insist(/^[a-f0-9]{40}$/.test(validationCommit), 'invalid validation commit');
  insist(same(sorted(Object.keys(plans)), ['claude', 'gemini', 'openai']), 'exactly three screening plans required');
  for (const [name, plan] of Object.entries(plans)) validatePlan(plan, name);
  insist(plans.openai.parentRoot === plans.gemini.parentRoot
    && Object.values(plans).every((plan) => plan.evaluationSourceRoot === plans.openai.evaluationSourceRoot), 'source roots differ');
  const readers = { A: createEvidenceReader(plans.openai.parentRoot), D: createEvidenceReader(plans.claude.parentRoot), E: createEvidenceReader(plans.openai.evaluationSourceRoot) };
  const runtimes = {};
  for (const name of Object.keys(readers)) runtimes[name] = await loadRuntime(readers[name], COMMITS[name]);
  const validationReader = createEvidenceReader(validationSourceRoot);
  // This source is independent of each original evaluator's root and protocol.
  // Only code/fixtures are read here, never a validation source's study outputs.
  const correctedRuntime = await loadRuntime(validationReader, validationCommit);
  const joinReader = createEvidenceReader(joinSourceRoot);
  verifyCommitted(joinReader, COMMITS.F, ['scripts/research/join-model-evaluations.mjs', 'scripts/research/model-rewrite-benchmark.mjs']);
  insist(joinReader.hash('scripts/research/join-model-evaluations.mjs') === sha256(readFileSync(resolve(ROOT, 'scripts/research/join-model-evaluations.mjs'))), 'join ranking source differs');
  insist(correctedRuntime.validation.validateRawMps.toString().includes("['polarity', 'negation']"), 'canonical negation grouping absent');
  const correctionSource = validationReader.bytes('scripts/research/study-validation.mjs');
  for (const reader of Object.values(readers)) for (const file of ['src/scoring.js', 'src/json-response.js']) insist(reader.hash(file) === validationReader.hash(file), 'production scorer/parser changed');
  const screens = [], ledger = [];
  for (const screen of ['openai', 'gemini', 'claude']) { const result = await auditScreen(screen, plans[screen], readers, runtimes, correctedRuntime); screens.push(result.report); ledger.push(...result.ledger); }
  for (const reader of [...Object.values(readers), joinReader, validationReader]) reader.unchanged();
  const inputs = { schemaVersion: 1, kind: 'canonical-negation-mps-retrospective', correctionCommit: validationCommit,
    validatorSha256: sha256(correctionSource), canonicalSpecSha256: validationReader.hash('core/scoring.md'),
    validationSourceManifestHash: digest(correctedRuntime.sourceHashes),
    derivationScriptSha256: sha256(readFileSync(resolve(ROOT, SCRIPT))),
    joinRuleSha256: joinReader.hash('scripts/research/join-model-evaluations.mjs'),
    sourceManifests: Object.fromEntries(Object.entries(runtimes).map(([name, runtime]) => [name, { commit: COMMITS[name], sha256: digest(runtime.sourceHashes) }])),
    planHashes: Object.fromEntries(Object.entries(plans).map(([name, plan]) => [name, digest(plan)])),
    screens: screens.map((screen) => ({ screen: screen.screen, provenance: screen.provenance })) };
  const protocolHash = digest(inputs);
  const derivedLedger = ledger.map((row) => ({ ...row, derivationProtocolHash: protocolHash }));
  const ledgerBytes = derivedLedger.map((row) => JSON.stringify(row)).join('\n') + '\n';
  const allMps = ledger.flatMap((row) => row.mpsResponses);
  const report = { schemaVersion: 1, date: '2026-09-05', timezone: 'Asia/Seoul', status: 'completed-offline-screening-correction',
    derivationProtocolHash: protocolHash, protocol: inputs, privateLedgerSha256: sha256(ledgerBytes),
    totals: { generations: screens.reduce((n, screen) => n + screen.generations, 0), judgments: ledger.length,
      originalValid: screens.reduce((n, screen) => n + screen.originalValid, 0), correctedValid: screens.reduce((n, screen) => n + screen.correctedValid, 0),
      statusTransitions: transitions(ledger.map((row) => row.statusTransition)), mpsResponses: allMps.length,
      mpsTransitions: transitions(allMps.map((row) => row.transition)),
      judgmentReceipts: ledger.reduce((n, row) => n + row.receiptBindings.length, 0),
      generationReceipts: screens.reduce((n, screen) => n + screen.provenance.generationReceiptCount, 0) },
    method: [
      'Every judgment in the three declared screening joins is included, regardless of its original valid/invalid status. Public/private parity, full matrix membership, original snapshots/protocols, committed source/fixture bytes and terminal receipt metadata are checked before correction.',
      'Generation prompts are rebuilt from frozen-source inputs and matched by hash; request identities and delivered rewrites are bound to original receipts. This does not claim recovery of every historical ambient configuration field.',
      'Both historical and corrected judge pipelines receive only the original private receipt responses through an injected callback. Every MPS, fidelity and naturalness prompt/request hash and receipt ordinal must match. No source journal, lock, row, schema flag or protocol ID is rewritten.',
      'The canonical polarity group includes polarity and negation anchors. The corrected validator checks the original self-reported pass counts, polarity counts and MPS. Inconsistent responses stay rejected; no counts or model scores are repaired.',
      'The correction has its own protocol and private ledger. Historical rows/flags remain in original; corrected status and per-receipt flags are separate. Original protocol IDs stay attached to original observations.',
    ],
    rankingRule: 'Within each screen: safe-output rate descending, model-rated naturalness median descending, generation latency median ascending, candidate ID ascending. Safety requires numeric proxy pass and two configured different-family valid judges with MPS/fidelity >=90 and zero hard failures. All generation attempts remain in the denominator.',
    limits: [
      'Proxy response.model echoes the requested alias. Model identity here is only recorded response/assistant-message/profile evidence, not proof of upstream weights or independent upstream judge families.',
      'These are one-pass screening results on 12 curated source fixtures per candidate. They do not establish a final winner, default model, human preference or authenticated authorship accuracy.',
      'MPS arithmetic/schema consistency does not independently certify the truth of the model’s anchor extraction or verdicts. Naturalness remains model-rated.',
      'Confirmation and other active D/E jobs are outside this derivation. Revalidate completed confirmation evidence under the fix and obtain missing confirmation evidence before any promotion; no paid rerun is performed here.',
      'Public output contains allowlisted counts, ranks, recorded identifiers and integrity hashes. Source texts, anchors, rationales and raw response/receipt bodies remain private.',
    ], screens };
  return { report, ledgerBytes };
}

const format = (value) => Number.isFinite(value) ? value.toFixed(3) : 'N/A';
export function renderCorrection(report) {
  const t = report.totals;
  const lines = ['# MPS validation correction — September 5, 2026', '',
    `${t.judgments} screening judgments over ${t.generations} generations were replayed offline. Valid judgments changed from ${t.originalValid} to ${t.correctedValid}.`, '',
    `Correction commit: \`${report.protocol.correctionCommit}\`. New derivation protocol: \`${report.derivationProtocolHash}\`.`, '',
    'Negation was omitted. The reviewed fix restores the Polarity + Negation group specified in `core/scoring.md` §16 and rejects the original response if its reported counts or score are inconsistent.', '',
    '## Validity transitions', '', '| Transition | MPS responses | Whole judgments |', '|---|---:|---:|'];
  for (const name of Object.keys(t.statusTransitions)) lines.push(`| ${name} | ${t.mpsTransitions[name]} | ${t.statusTransitions[name]} |`);
  lines.push('', '## Screening top two', '', '| Screen | Original | Corrected | Newly selected; confirmation required |', '|---|---|---|---|');
  for (const screen of report.screens) lines.push(`| ${screen.screen} | ${screen.oldTopTwo.join(', ')} | ${screen.newTopTwo.join(', ')} | ${screen.requiresConfirmation.promotedCandidates.join(', ') || 'None'} |`);
  lines.push('', '## Candidate ranks and safety', '', '| Screen | Candidate | Old rank → new | Safe before → after / attempted | Judge errors before → after | Corrected naturalness median | Generation median ms |', '|---|---|---:|---:|---:|---:|---:|');
  for (const screen of report.screens) for (const next of screen.correctedRanks) {
    const prior = screen.oldRanks.find((row) => row.id === next.id);
    lines.push(`| ${screen.screen} | ${next.id} | ${prior.rank} → ${next.rank} | ${prior.safe} → ${next.safe} / ${next.attempted} | ${prior.judgeErrors} → ${next.judgeErrors} | ${format(next.naturalnessMedian)} | ${format(next.generationMedianMs)} |`);
  }
  lines.push('', report.rankingRule, '', 'The corrected top two remain screening candidates. Existing completed confirmations need the same retrospective validation; newly selected candidates need confirmation evidence before promotion. No confirmation dataset was inspected here.', '',
    '## Evidence and derivation', '', ...report.method.map((value) => `- ${value}`), '',
    `All ${t.generationReceipts} generation receipts and ${t.judgmentReceipts} judgment receipts were bound. The private ledger SHA-256 is \`${report.privateLedgerSha256}\`. The JSON companion preserves original source/protocol/file/receipt commitments, status counts and rank changes.`, '',
    '| Screen | Original parent protocol | Parent snapshot |', '|---|---|---|');
  for (const screen of report.screens) lines.push(`| ${screen.screen} | \`${screen.provenance.originalParentProtocolHash}\` | \`${screen.provenance.parentSnapshotHash}\` |`);
  lines.push('', '## Limits', '', ...report.limits.map((value) => `- ${value}`), '', '## Reproduce offline', '',
    '```sh', 'node scripts/research/revalidate-mps-evidence.mjs --check', '```', '',
    'The default input plans are the three supplied `/tmp/patina-{openai,gemini,claude}-join-plan.json` files. The runner reads only their declared completed screening cohorts. `--write` writes the two public report files and a private, gitignored ledger under `/tmp/patina-mps-revalidation-20260905`; no source directory receives a lock or write. Source worktrees must remain at their pinned commits. No credentials are read and network requests are disabled.', '',
    'Validation code is selected separately. The plans locate the historical evaluator and protocol; `--validation-source DIR --validation-commit COMMIT` points to the reviewed correction, including the frozen G source without reading any of its study artifacts. For full joins, callers can pass the original runtime, corrected pipeline and validator to `replayBoundJudgment`. Those joins must declare their own complete matrix. The CLI is limited to these three screens.', '');
  return lines.join('\n');
}

export async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help') { console.log('revalidate-mps-evidence [--write | --check] [--plans-dir DIR] [--join-source DIR] [--validation-source DIR --validation-commit COMMIT] (offline only)'); return; }
    if (['--write', '--check'].includes(arg)) options[arg.slice(2)] = true;
    else if (['--plans-dir', '--join-source', '--validation-source', '--validation-commit'].includes(arg) && argv[i + 1] && !argv[i + 1].startsWith('--')) options[arg.slice(2)] = argv[++i];
    else throw new Error('mps-revalidation: invalid argument');
  }
  insist(!(options.write && options.check), 'conflicting output modes');
  const block = () => { throw new Error('mps-revalidation: network disabled'); };
  globalThis.fetch = block; http.request = block; http.get = block; https.request = block; https.get = block; net.Socket.prototype.connect = block;
  const planReader = createEvidenceReader(options['plans-dir'] || '/tmp');
  const plans = Object.fromEntries(Object.keys(SCREENS).map((name) => [name, planReader.json(`patina-${name}-join-plan.json`)]));
  const result = await deriveCorrection(plans, { joinSourceRoot: options['join-source'], validationSourceRoot: options['validation-source'], validationCommit: options['validation-commit'] });
  planReader.unchanged();
  const output = { [`${REPORT}.json`]: `${JSON.stringify(result.report, null, 2)}\n`, [`${REPORT}.md`]: renderCorrection(result.report) };
  if (options.check) {
    for (const [path, bytes] of Object.entries(output)) insist(readFileSync(resolve(ROOT, path), 'utf8') === bytes, 'public report differs');
    insist(readFileSync(resolve(PRIVATE_OUTPUT, 'correction-ledger.private.jsonl'), 'utf8') === result.ledgerBytes, 'private ledger differs');
  }
  if (options.write) {
    insist(!existsSync(PRIVATE_OUTPUT) || !lstatSync(PRIVATE_OUTPUT).isSymbolicLink(), 'private output symlink');
    mkdirSync(PRIVATE_OUTPUT, { recursive: true, mode: 0o700 });
    for (const [name, bytes] of Object.entries({ '.gitignore': '*\n', 'correction-ledger.private.jsonl': result.ledgerBytes,
      'derivation-protocol.json': `${JSON.stringify(result.report.protocol, null, 2)}\n` })) {
      const path = resolve(PRIVATE_OUTPUT, name);
      insist(!existsSync(path) || !lstatSync(path).isSymbolicLink(), 'private artifact symlink');
      writeFileSync(path, bytes, { mode: 0o600 });
    }
    for (const [path, bytes] of Object.entries(output)) {
      const target = resolve(ROOT, path); insist(!existsSync(target) || !lstatSync(target).isSymbolicLink(), 'public output symlink');
      writeFileSync(target, bytes);
    }
  }
  console.log(JSON.stringify({ protocolHash: result.report.derivationProtocolHash, ...result.report.totals,
    topTwo: Object.fromEntries(result.report.screens.map((screen) => [screen.screen, screen.newTopTwo])) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error.message?.startsWith('mps-revalidation: ') ? error.message : 'mps-revalidation: evidence validation failed');
  process.exitCode = 1;
});

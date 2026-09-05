#!/usr/bin/env node
// Private, nullable-label scoreText collection. No live execution by default.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { evaluateScorerFixture, distribution } from '../../tests/quality/live-scorer-benchmark.mjs';
import { loadPatterns } from '../../src/loader.js';
import { loadLexicon } from '../../src/features/lexicon.js';
import { analyzeText } from '../../src/features/index.js';
import { scoreDeterministicSignals, scoreText } from '../../src/scoring.js';
import { studySemantics } from './study-validation.mjs';
import { acquireStudyWriter, bindStudyProtocol, safeCallRecord } from './study-journal.mjs';
import { replayPreparationRow } from './preparation-replay.mjs';
import { studyCompletion, validateTransport, readCredential, safeStudyError, installStudySignals, getStudyCancellationSignal } from './model-evaluation-transport.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SELF = 'scripts/research/collect-rebaseline-scores.mjs';
const HEX = /^[a-f0-9]{64}$/;
const LANGS = ['en', 'ko', 'zh', 'ja'];
const clone = value => globalThis.structuredClone(value);
export const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const encode = value => JSON.stringify(value, (_key, item) => item instanceof RegExp ? { $regexp: item.source, $flags: item.flags } : item);
const decode = text => JSON.parse(text, (_key, item) => item && typeof item === 'object' && Object.keys(item).length === 2 && typeof item.$regexp === 'string' && typeof item.$flags === 'string' ? new RegExp(item.$regexp, item.$flags) : item);
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
const canonicalHash = value => hash(JSON.stringify(sorted(value)));
const fail = message => { throw new Error(`rebaseline: ${message}`); };

// Refuse identifiable credentials; never replace bytes and call them a replay.
export function assertSecretFree(value) {
  const walk = (item, key = '') => {
    if (item === null || item === undefined || item === '') return;
    if (/^(?:api[-_]?key|authorization|proxy-authorization|password|passwd|client[-_]?secret|access[-_]?token|refresh[-_]?token|cookie|set-cookie|headers)$/i.test(key)) fail('secret-bearing snapshot field');
    if (typeof item === 'string' && /\b(?:sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._~+/-]{12,})|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|(?:api[_-]?key|password|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9_-]{16,}/i.test(item)) fail('credential-like bytes in snapshot');
    if (typeof item === 'number' && !Number.isFinite(item)) fail('nonfinite snapshot value');
    if (item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof RegExp)
      && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) fail('unsupported snapshot object type');
    if (Array.isArray(item)) item.forEach(child => walk(child));
    else if (item && typeof item === 'object' && !(item instanceof RegExp)) Object.entries(item).forEach(([name, child]) => walk(child, name));
  };
  walk(value);
}
function noLinks(path) {
  for (let part = resolve(path);; part = dirname(part)) {
    if (fs.existsSync(part) && fs.lstatSync(part).isSymbolicLink()) fail('symlink path refused');
    if (dirname(part) === part) break;
  }
}
function readJson(path) { noLinks(path); try { return decode(fs.readFileSync(path, 'utf8')); } catch { fail('invalid or missing JSON artifact'); } }
export function persistPrivate(path, value) {
  assertSecretFree(value); noLinks(path);
  fs.mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.pending`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, `${encode(value)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, path);
}
function filesBelow(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(root, entry.name); noLinks(path);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

export function loadNullableIntake(directory) {
  const intake = readJson(resolve(directory, 'intake.private.json'));
  const summary = readJson(resolve(directory, 'summary.json'));
  const sourceIndex = readJson(resolve(directory, 'source-index.private.json'));
  if (!Array.isArray(intake.records) || intake.records.length < 1 || intake.records.length > 85) fail('intake must contain 1..85 records');
  if (canonicalHash(intake) !== summary.intakeHash || canonicalHash(intake.records) !== summary.manifestHash) fail('frozen intake/record-manifest hash mismatch');
  const evidence = new Map();
  for (const name of fs.readdirSync(resolve(directory, 'evidence'))) {
    if (!HEX.test(name)) fail('invalid evidence filename');
    const path = resolve(directory, 'evidence', name); noLinks(path);
    const bytes = fs.readFileSync(path);
    if (hash(bytes) !== name) fail('frozen evidence mismatch');
    evidence.set(name, bytes.length);
  }
  const checkBindings = value => {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'sha256') && Object.hasOwn(value, 'bytes') && evidence.get(value.sha256) !== value.bytes) fail('missing inherited evidence');
    Object.values(value).forEach(checkBindings);
  };
  checkBindings(intake);
  for (const entry of Object.values(sourceIndex)) {
    if (!HEX.test(entry?.sha256) || !Number.isSafeInteger(entry.bytes)) fail('invalid evidence binding');
    const path = resolve(directory, 'evidence', entry.sha256); noLinks(path);
    const bytes = fs.readFileSync(path);
    if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) fail('frozen evidence mismatch');
  }
  const ids = new Set(), hashes = new Set();
  for (const record of intake.records) {
    if (!record || typeof record.id !== 'string' || !record.id || ids.has(record.id) || hashes.has(record.textHash)
      || typeof record.text !== 'string' || !record.text.trim() || record.text.length > 100000
      || hash(record.text) !== record.textHash || !LANGS.includes(record.language)
      || !Array.isArray(record.origins) || !record.origins.length || !record.labels || !record.rights
      || (record.expected_hot !== undefined && record.expected_hot !== null && typeof record.expected_hot !== 'boolean')) fail('invalid nullable intake record');
    ids.add(record.id); hashes.add(record.textHash);
  }
  assertSecretFree(intake);
  const originals = { 'intake.private.json': intake, 'summary.json': summary, 'source-index.private.json': sourceIndex };
  const fileHashes = Object.fromEntries(Object.entries(originals).map(([name, value]) => {
    const bytes = fs.readFileSync(resolve(directory, name));
    if (encode(decode(bytes.toString('utf8'))) !== encode(value)) fail('bundle changed while reading');
    return [name, hash(bytes)];
  }));
  return { intake, sourceIndex, fileHashes, intakeHash: summary.intakeHash, manifestHash: summary.manifestHash, sourceIndexHash: canonicalHash(sourceIndex) };
}
function selectCandidate(protocolFile, protocolSha256, candidateId) {
  const bytes = fs.readFileSync(protocolFile);
  if (!HEX.test(protocolSha256) || hash(bytes) !== protocolSha256) fail('explicit frozen candidate protocol hash required');
  const protocol = readJson(protocolFile);
  const matches = protocol.candidates?.filter(row => row.id === candidateId);
  if (matches?.length !== 1) fail('one explicit candidate required');
  const candidate = matches[0]; assertSecretFree(candidate); validateTransport(candidate);
  const allowed = new Set(['id', 'provider', 'transport', 'baseURL', 'model', 'extraBody', 'apiKeyEnv', 'effort']);
  if (Object.keys(candidate).some(key => !allowed.has(key))) fail('unsupported candidate field');
  if (candidate.extraBody && Object.keys(candidate.extraBody).some(key => ['model', 'messages', 'stream', 'temperature', 'response_format', 'seed'].includes(key))) fail('candidate overrides collector request fields');
  if (candidate.transport === 'http' && (!/^[A-Z][A-Z0-9_]*$/.test(candidate.apiKeyEnv) || /GEMINI|GOOGLE/.test(candidate.apiKeyEnv))) fail('invalid transport credential variable');
  return { protocol, candidate };
}
export function loadProcessingApproval(path) {
  noLinks(path);
  const approvalBytes = fs.readFileSync(path, 'utf8');
  let approvals; try { approvals = decode(approvalBytes); } catch { fail('invalid approval JSON'); }
  const source = { approvalBytes, approvalSha256: hash(approvalBytes), reviewBytes: null, reviewSha256: null };
  if (Object.hasOwn(approvals, 'parentApproved')) {
    if (typeof approvals.reviewPath !== 'string' || !HEX.test(approvals.reviewHash)) fail('parent approval requires a bound review');
    noLinks(approvals.reviewPath);
    source.reviewBytes = fs.readFileSync(approvals.reviewPath, 'utf8'); source.reviewSha256 = hash(source.reviewBytes);
    if (source.reviewSha256 !== approvals.reviewHash) fail('parent review hash mismatch');
  }
  assertSecretFree({ approvals, source });
  return { approvals, source };
}
function validateParentApproval(bundle, candidate, approvals, source) {
  const scope = 'private-benchmark-scoring-only';
  if (approvals.schemaVersion !== 1 || approvals.status !== 'parent-approved-for-private-benchmark-scoring' || approvals.parentApproved !== true
    || approvals.scope !== scope || approvals.repeats !== 1 || !Number.isFinite(Date.parse(approvals.approvedAt))
    || canonicalHash(approvals.candidate) !== canonicalHash(candidate)
    || candidate.id !== 'gemini-3.7' || candidate.provider !== 'gemini' || candidate.transport !== 'opencodex'
    || candidate.model !== 'google-antigravity/gemini-3.7-flash') fail('parent approval candidate/scope mismatch');
  validateTransport(candidate);
  if (typeof source?.reviewBytes !== 'string' || hash(source.reviewBytes) !== approvals.reviewHash || source.reviewSha256 !== approvals.reviewHash) fail('parent review bytes/hash required');
  let review; try { review = decode(source.reviewBytes); } catch { fail('invalid bound review'); }
  const records = new Map(bundle.intake.records.map(record => [record.textHash, record]));
  const hashes = approvals.approvedTextHashes;
  if (!Array.isArray(hashes) || new Set(hashes).size !== hashes.length || hashes.length !== records.size
    || approvals.logicalObservationLimit !== hashes.length || hashes.some(textHash => !records.has(textHash))) fail('parent-approved exact matrix mismatch');
  if (review.schemaVersion !== 1 || review.scope?.id !== scope || review.scope.allowedCorpusSize !== records.size
    || review.bundle?.intakeSemanticHash !== bundle.intakeHash || review.bundle?.manifestHash !== bundle.manifestHash
    || !Array.isArray(review.records) || review.records.length !== records.size
    || typeof approvals.payloadBoundary !== 'string' || approvals.payloadBoundary !== review.scope.payloadBoundary
    || typeof approvals.retryPolicy !== 'string' || !approvals.retryPolicy.trim()) fail('parent review scope/intake mismatch');
  for (const name of ['intake.private.json', 'summary.json', 'source-index.private.json']) {
    if (!HEX.test(bundle.fileHashes?.[name]) || bundle.fileHashes[name] !== review.bundle.fileSha256?.[name]) fail('parent-reviewed bundle file hash mismatch');
  }
  const unknowns = approvals.unknownsPreserved;
  if (!unknowns || unknowns.eligibleForClaims !== false || unknowns.classifierTruthAssigned !== false || unknowns.humanRatingsCreated !== 0
    || ['humanQuality', 'perceivedAiPolish', 'expectedShortFormTells', 'editingActor', 'editDepth'].some(key => unknowns[key] !== null)) fail('parent approval must preserve unknown labels');
  const reviewed = new Map();
  for (const row of review.records) {
    const record = records.get(row.textHash);
    if (!record || reviewed.has(row.textHash) || row.decision !== 'approve' || row.scope !== scope || row.bindingEvidence?.verified !== true
      || !Array.isArray(row.deferredReasons) || row.deferredReasons.length || row.recordId !== record.id) fail('unmatched, deferred or unverified reviewed text');
    for (const key of ['language', 'register', 'documentType', 'chars', 'originKind', 'contextConflict', 'rights', 'labels', 'eligibleForClaims']) {
      if (encode(row.preservedMetadata?.[key]) !== encode(record[key])) fail('reviewed provenance/unknowns mismatch');
    }
    reviewed.set(row.textHash, row);
  }
  // Direct consumption preserves both source documents, their decisions, and
  // parent-selected order. It never rewrites the pending content-review file.
  return hashes.map(textHash => ({ textHash, decision: 'approved', sourceDecision: reviewed.get(textHash).decision,
    parentApprovalSha256: source.approvalSha256, reviewSha256: source.reviewSha256 }));
}
export function validateApprovals(bundle, candidate, approvals, source) {
  if (source && (hash(source.approvalBytes) !== source.approvalSha256 || encode(decode(source.approvalBytes)) !== encode(approvals))) fail('approval source bytes/hash mismatch');
  if (approvals && Object.hasOwn(approvals, 'parentApproved')) return validateParentApproval(bundle, candidate, approvals, source);
  const records = new Map(bundle.intake.records.map(row => [row.textHash, row]));
  if (approvals?.schemaVersion !== 1 || approvals.intakeHash !== bundle.intakeHash || approvals.candidateHash !== hash(candidate) || !Array.isArray(approvals.decisions)) fail('separate processing-approval manifest required');
  const decisions = new Map();
  for (const decision of approvals.decisions) {
    if (!records.has(decision.textHash) || decisions.has(decision.textHash) || !['approved', 'blocked', 'unknown'].includes(decision.decision)) fail('invalid or duplicate approval decision');
    if (decision.decision === 'approved' && (decision.sourceEvidenceHash !== canonicalHash(records.get(decision.textHash).origins)
      || decision.permittedLocalAnalysis !== true || decision.permittedProviderProcessing !== true
      || decision.provider !== candidate.provider || decision.transport !== candidate.transport || decision.model !== candidate.model
      || typeof decision.reviewer !== 'string' || !decision.reviewer.trim() || !Number.isFinite(Date.parse(decision.reviewedAt))
      || decision.retention !== 'private-only' || decision.publication !== 'summary-only')) fail('incomplete or route-mismatched processing approval');
    decisions.set(decision.textHash, decision);
  }
  assertSecretFree(approvals);
  return bundle.intake.records.map(record => ({ textHash: record.textHash, decision: decisions.get(record.textHash)?.decision ?? 'unknown' }));
}

// Synchronous, restored filesystem guard prevents incidental structural-model
// discovery in scoreDeterministicSignals. This collector freezes absence; it
// never reads ambient overrides or credentials during input preparation.
function withoutAmbientModels(run) {
  const read = fs.readFileSync, exists = fs.existsSync;
  const allowed = path => typeof path === 'string' && resolve(path).startsWith(`${ROOT}${sep}`) && !/[\\/]\.patina(?:[\\/.]|$)|[\\/]\.env|[\\/]credentials[\\/]/.test(path);
  fs.existsSync = path => allowed(path) && exists(path);
  fs.readFileSync = (path, ...args) => { if (!allowed(path)) fail('ambient read refused'); return read(path, ...args); };
  syncBuiltinESMExports();
  try { return run(); } finally { fs.readFileSync = read; fs.existsSync = exists; syncBuiltinESMExports(); }
}
export function prepareInputs(records, configFile) {
  const configBytes = fs.readFileSync(configFile, 'utf8');
  let config; try { config = yaml.load(configBytes); } catch { fail('invalid pinned config'); }
  if (!config || Array.isArray(config) || typeof config !== 'object') fail('config must be a mapping');
  assertSecretFree(config);
  if (config.register != null && !['casual', 'professional'].includes(config.register)) fail('pinned register must use the delivery-register axis');
  if (['profile', 'tone', 'formality'].some(key => Object.hasOwn(config, key))) fail('retired configuration field');
  if (config.stylometry?.structural_model?.path || config.stylometry?.classifier?.model_path || config.private_model?.path) fail('explicit structural model unsupported by this absence-frozen collector');
  config.documentType = config['document-type'] || config.documentType || 'default'; delete config['document-type'];
  const languages = [...new Set(records.map(row => row.language))];
  const patterns = Object.fromEntries(languages.map(lang => [lang, loadPatterns(ROOT, lang)]));
  const lexicons = Object.fromEntries(languages.map(lang => [lang, loadLexicon(lang, ROOT)]));
  const prepared = {};
  for (const record of records) {
    const settings = clone(config); settings.language = record.language;
    if (record.documentType) settings.documentType = record.documentType;
    let analysis = null;
    const deterministicScore = withoutAmbientModels(() => scoreDeterministicSignals({ text: record.text, config: settings, patterns: patterns[record.language], repoRoot: ROOT,
      logger: { warn() {} }, analyzer: (text, options) => {
        analysis = analyzeText(text, { ...options, structuralModel: null, lexicon: options.lexicon ?? clone(lexicons[record.language]) });
        return analysis;
      } }));
    prepared[record.textHash] = { config: settings, patterns: clone(patterns[record.language]), deterministicScore, analysis };
  }
  const result = { configSource: { bytes: configBytes, sha256: hash(configBytes), layers: ['explicit-pinned-file'], ambientOverrides: false }, config, patterns, lexicons,
    structuralModels: Object.fromEntries(languages.map(lang => [lang, { status: 'explicitly-absent', model: null }])), prepared };
  assertSecretFree(result); return result;
}
function currentCodeHashes() { return { ...studySemantics(ROOT), [SELF]: hash(fs.readFileSync(resolve(ROOT, SELF))), 'scripts/research/preparation-replay.mjs': hash(fs.readFileSync(resolve(ROOT, 'scripts/research/preparation-replay.mjs'))) }; }
function fixture(record, prepared) { return { fixture_id: record.id, text_hash: record.textHash, text: record.text, language: record.language, documentType: prepared.config.documentType,
  register: prepared.config.register ?? null, class: null, expected_hot: null, source: null }; }
function annotateObservation(row, record, prepared) {
  row.datasetGenre = { value: record.register ?? null, reviewStatus: record.labels?.registerStatus ?? null, source: 'intake.register' };
  row.documentTypeSelection = { value: prepared.config.documentType, source: record.documentType ? 'intake.documentType' : 'pinned-config', inferredFromGenreByCollector: false };
}
const logical = (protocolHash, candidate, record) => `${protocolHash}/${candidate.id}/${record.id}/0/score`;
function normalizedObservation(row) {
  const value = clone(row); delete value.productionResult; value.calls.forEach(call => { delete call.recovered_from_journal; }); return value;
}

// Exact credential-free HTTP body, one fetch only: no automatic temperature
// fallback, HTTP retry, redirect, alternate provider or environment-file lookup.
function interruptedRequest(kind, dispatched, started) {
  const message = kind === 'operator-cancelled' ? 'Study cancelled' : kind === 'deadline' ? 'LLM request timed out' : 'Network transport interrupted';
  const error = new Error(message);
  error.studyResult = { interruption: kind, attempts: dispatched ? 1 : 0, effectiveModels: [], usage: null, identityEvidence: 'unverified', durationMs: Date.now() - started };
  return error;
}
export async function boundedCompletion(candidate, prompt, options, observe) {
  const studySignal = getStudyCancellationSignal();
  const started = Date.now();
  if (studySignal.aborted) throw interruptedRequest('operator-cancelled', false, started);
  if (['claude-cli', 'kimi-cli'].includes(candidate.transport)) {
    try {
      const result = await studyCompletion(candidate, prompt, { ...options, maxRetries: 0 });
      observe({ scope: 'native-cli-observed-result', response: result, upstreamRequestVerified: false });
      return result;
    } catch (error) {
      if (error.studyResult) observe({ scope: 'native-cli-error-metadata', errorMetadata: error.studyResult, upstreamRequestVerified: false });
      throw error;
    }
  }
  const controller = new AbortController();
  let timer, reader, timedOut = false, dispatched = false;
  const onStudyAbort = () => controller.abort(new Error('Study cancelled'));
  const checkInterruption = () => {
    if (studySignal.aborted) throw interruptedRequest('operator-cancelled', dispatched, started);
    if (timedOut) throw interruptedRequest('deadline', dispatched, started);
  };
  try {
    studySignal.addEventListener('abort', onStudyAbort, { once: true });
    // addEventListener does not notify a listener added after the abort event.
    if (studySignal.aborted) onStudyAbort();
    checkInterruption();
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('Request deadline expired'));
    }, options.timeoutMs);
    const apiKey = candidate.transport === 'opencodex' ? 'opencodex-local' : readCredential(candidate.apiKeyEnv);
    if (!apiKey) throw new Error('Required transport credential unavailable');
    const body = { ...(candidate.extraBody || {}), model: candidate.model, messages: [{ role: 'user', content: prompt }], temperature: options.temperature };
    if (options.responseFormat) body.response_format = options.responseFormat;
    checkInterruption();
    dispatched = true;
    const response = await fetch(`${candidate.baseURL}/chat/completions`, { method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    checkInterruption();
    let raw = '', size = 0;
    reader = response.body.getReader(); const decoder = new globalThis.TextDecoder();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      checkInterruption();
      size += chunk.value.byteLength; if (size > 4 * 1024 * 1024) { controller.abort(new Error('Response size bound exceeded')); throw new Error('Response size bound exceeded'); }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    checkInterruption();
    raw += decoder.decode();
    observe({ scope: 'http-body', requestBody: body, responseBody: raw, httpStatus: response.status });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let data; try { data = JSON.parse(raw); } catch { throw new Error('Invalid provider JSON'); }
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('Empty response');
    const result = { text, effectiveModels: typeof data.model === 'string' ? [data.model] : [], usage: data.usage ?? null, attempts: 1,
      durationMs: Date.now() - started, requestedTemperature: options.temperature, effectiveTemperature: body.temperature };
    options.onAttempt?.({ attemptIndex: 1, requestedModel: candidate.model, effectiveModel: data.model ?? null, usage: result.usage, outcome: 'success', retryReason: 'initial' });
    checkInterruption();
    return result;
  } catch (error) {
    // Fetch implementations may reject with AbortError, the supplied reason,
    // or a network error. Classification follows our controls, not that name.
    checkInterruption();
    if (error?.name === 'AbortError' || error?.cause?.name === 'AbortError' || /aborted/i.test(error?.message || '')) {
      throw interruptedRequest('network', dispatched, started);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    studySignal.removeEventListener('abort', onStudyAbort);
    reader?.releaseLock();
  }
}
function credentialFreeRequest(candidate, prompt, options) {
  return { candidate, prompt, temperature: options.temperature ?? .2, responseFormat: options.responseFormat ?? null, extraBody: options.extraBody ?? null,
    timeoutMs: options.timeoutMs, maxRetries: 0,
    requestBody: ['http', 'opencodex'].includes(candidate.transport) ? { ...(candidate.extraBody || {}), model: candidate.model, messages: [{ role: 'user', content: prompt }], temperature: options.temperature ?? .2,
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}) } : null,
    nativeBoundary: ['http', 'opencodex'].includes(candidate.transport) ? null : 'Exact collector arguments only; native effective upstream parameters remain unverified.' };
}
function verifyPrivateTree(output) {
  for (const path of filesBelow(output)) {
    if (path.endsWith('.pending')) fail('incomplete persistence artifact');
    if ((fs.statSync(path).mode & 0o077) !== 0) fail('private file permissions must be 0600');
  }
}
function savedSnapshot(output) {
  verifyPrivateTree(output);
  if (fs.readFileSync(resolve(output, '.gitignore'), 'utf8') !== '*\n') fail('private output ignore rule changed');
  const snapshot = readJson(resolve(output, 'snapshot.private.json'));
  const binding = readJson(resolve(output, 'study-protocol.json'));
  if (hash(encode(snapshot)) !== binding.protocolHash) fail('snapshot/protocol mismatch');
  if (JSON.stringify(snapshot.codeHashes) !== JSON.stringify(currentCodeHashes())) fail('collector source changed; replay requires the frozen code');
  assertSecretFree(snapshot); validateTransport(snapshot.candidate);
  if (hash(snapshot.candidateProtocolBytes) !== snapshot.candidateProtocolHash || encode(JSON.parse(snapshot.candidateProtocolBytes)) !== encode(snapshot.protocol)
    || snapshot.protocol.candidates.filter(candidate => encode(candidate) === encode(snapshot.candidate)).length !== 1) fail('frozen candidate protocol mismatch');
  const admission = validateApprovals({ intake: { records: snapshot.records }, intakeHash: snapshot.intakeHash, manifestHash: snapshot.manifestHash, fileHashes: snapshot.bundleFileHashes }, snapshot.candidate, snapshot.approvals, snapshot.approvalSource);
  if (encode(admission.filter(row => row.decision === 'approved').map(row => row.textHash)) !== encode(snapshot.matrix)) fail('saved approval matrix mismatch');
  return { snapshot, protocolHash: binding.protocolHash };
}
function evidenceHash(output, id) {
  return hash(['calls', 'wire'].flatMap(kind => filesBelow(resolve(output, kind, hash(id)))).sort().map(path => [relative(output, path), hash(fs.readFileSync(path))]));
}
function checkWire(output, id, candidate, record, snapshot, protocolHash) {
  const group = resolve(output, 'calls', hash(id));
  const paths = filesBelow(group);
  if (!paths.length) fail('started evaluation lacks recorded calls');
  const receipts = paths.map((_, i) => readJson(resolve(group, `${i + 1}.private.json`)));
  for (const [i, receipt] of receipts.entries()) {
    if (!['completed', 'error'].includes(receipt.state)) fail('unresolved call; no paid replay');
    const wire = readJson(resolve(output, 'wire', hash(id), `${i + 1}.private.json`));
    if (wire.protocolHash !== protocolHash || wire.preparedHash !== hash(encode(snapshot.inputs.prepared[record.textHash])) || wire.request.prompt !== snapshot.prompts[record.textHash]
      || !['completed', 'error'].includes(wire.state) || wire.requestHash !== receipt.requestHash || hash(wire.request.prompt) !== receipt.promptHash
      || wire.textHash !== record.textHash || hash(wire.request.candidate) !== hash(candidate)) fail('wire/request binding mismatch or unresolved paid call');
    if (receipt.state === 'completed' && encode(wire.response) !== encode(receipt.response)) fail('response receipt mismatch');
    if (receipt.state === 'error' && (wire.error !== receipt.error || encode(wire.errorMetadata ?? null) !== encode(receipt.errorMetadata ?? null))) fail('error receipt mismatch');
  }
  if (filesBelow(resolve(output, 'wire', hash(id))).length !== receipts.length) fail('extra wire receipts');
  return { calls: receipts.map(receipt => safeCallRecord(receipt, candidate)) };
}
async function replayOne(output, snapshot, protocolHash, record, stored) {
  const id = logical(protocolHash, snapshot.candidate, record);
  const receiptRow = checkWire(output, id, snapshot.candidate, record, snapshot, protocolHash);
  let consumed = 0;
  const replay = await replayPreparationRow({ directory: output, logicalId: id, row: stored || receiptRow, candidate: snapshot.candidate,
    run: complete => evaluateScorerFixture(fixture(record, snapshot.inputs.prepared[record.textHash]), snapshot.candidate, {
      complete: async (...args) => {
        const ordinal = consumed++;
        try { return await complete(...args); } catch (error) {
          error.studyResult = { ...(error.studyResult || {}), durationMs: receiptRow.calls[ordinal]?.durationMs }; throw error;
        }
      }, preparedInputs: snapshot.inputs.prepared[record.textHash], logicalId: id, timeoutMs: snapshot.timeoutMs }) });
  annotateObservation(replay, record, snapshot.inputs.prepared[record.textHash]);
  if (stored && encode(normalizedObservation(stored)) !== encode(normalizedObservation(replay))) fail('observed replay mismatch');
  replay.productionResult = await replayPreparationRow({ directory: output, logicalId: id, row: receiptRow, candidate: snapshot.candidate,
    run: complete => scoreText({ ...snapshot.inputs.prepared[record.textHash], text: record.text, model: snapshot.candidate.model, logger: { warn() {}, info() {}, debug() {} },
      callLLM: async args => (await complete(snapshot.candidate, args.prompt, { temperature: args.temperature, responseFormat: args.responseFormat, extraBody: args.extraBody, onAttempt: args.onAttempt })).text }) });
  if (stored && encode(stored.productionResult) !== encode(replay.productionResult)) fail('full production result replay mismatch');
  return replay;
}
export function summarizeCollection(snapshot, observations) {
  const scores = rows => ({ overall: distribution(rows.map(row => row.overall)), rawLlm: distribution(rows.map(row => row.raw_overall)), deterministic: distribution(rows.map(row => row.deterministic_overall)) });
  const valid = observations.filter(row => row.status === 'ok');
  return { schemaVersion: 1, scope: 'unlabelled-score-distributions-only', candidateId: snapshot.candidate.id,
    denominator: snapshot.records.length, approved: snapshot.matrix.length, excluded: snapshot.records.length - snapshot.matrix.length,
    attempted: observations.length, valid: valid.length, errors: observations.length - valid.length,
    errorClasses: Object.fromEntries([...new Set(observations.filter(row => row.error).map(row => row.error))].map(error => [error, observations.filter(row => row.error === error).length])),
    distributions: scores(valid),
    languages: Object.fromEntries([...new Set(snapshot.records.map(row => row.language))].map(language => {
      const rows = observations.filter(row => row.language === language), ok = rows.filter(row => row.status === 'ok');
      const packs = snapshot.inputs.patterns[language] || [];
      return [language, { attempted: rows.length, valid: ok.length, errors: rows.length - ok.length, ...scores(ok),
        packs: Object.fromEntries(packs.map(pack => { const name = pack.frontmatter.pack.replace(/^[a-z]{2}-/, ''); const values = ok.map(row => row.categories?.[name]?.score);
          return [name, { ...distribution(values), missing: ok.filter(row => !Number.isFinite(row.categories?.[name]?.score)).length }]; })) }];
    })), classificationMetrics: null, humanQualityRatings: null };
}
function verifyProgress(output, snapshot, progress, protocolHash) {
  if (progress.protocolHash !== protocolHash || !progress.entries || Object.keys(progress.entries).some(key => !snapshot.matrix.includes(key) || !['started', 'completed'].includes(progress.entries[key].state))) fail('progress binding mismatch');
  const groups = new Set(Object.keys(progress.entries).map(textHash => hash(logical(protocolHash, snapshot.candidate, snapshot.records.find(row => row.textHash === textHash)))));
  for (const kind of ['calls', 'wire']) {
    const parent = resolve(output, kind);
    if (fs.existsSync(parent) && fs.readdirSync(parent).some(name => !groups.has(name))) fail('orphan call evidence outside reserved evaluations');
  }
  const rows = resolve(output, 'rows');
  if (fs.existsSync(rows) && fs.readdirSync(rows).some(name => !Object.hasOwn(progress.entries, name.replace(/\.private\.json$/, '')) || !/^[a-f0-9]{64}\.private\.json$/.test(name))) fail('unexpected observed row');
}
export async function replayCollection(output) {
  const { snapshot, protocolHash } = savedSnapshot(output);
  const progress = readJson(resolve(output, 'progress.private.json'));
  verifyProgress(output, snapshot, progress, protocolHash);
  const observations = [];
  for (const textHash of snapshot.matrix) {
    const record = snapshot.records.find(row => row.textHash === textHash);
    const entry = progress.entries[textHash];
    if (!entry || entry.state !== 'completed') fail('replay requires a complete observed matrix');
    const path = resolve(output, 'rows', `${textHash}.private.json`);
    if (hash(fs.readFileSync(path)) !== entry.rowHash) fail('missing or changed observed row');
    const stored = readJson(path);
    if (evidenceHash(output, logical(protocolHash, snapshot.candidate, record)) !== entry.evidenceHash) fail('receipt-set hash mismatch');
    observations.push(await replayOne(output, snapshot, protocolHash, record, stored));
  }
  return { protocolHash, fullObservedReplay: true, ...summarizeCollection(snapshot, observations) };
}

export async function collectRebaselineScores(options, { complete = boundedCompletion, prepare = prepareInputs, persist = persistPrivate } = {}) {
  const output = resolve(options.output); noLinks(output);
  let fatal = null;
  const save = (path, value) => { try { persist(path, value); } catch { fatal = new Error('rebaseline: persistence or secret rejection; stop without paid replay'); throw fatal; } };
  const resume = options.resume === true;
  if (fs.existsSync(output) && fs.readdirSync(output).length && !resume) fail('nonempty output requires bound resume');
  if (!resume && fs.existsSync(resolve(output, 'snapshot.private.json'))) fail('snapshot already exists');
  let snapshot, protocolHash;
  if (resume) {
    if (Object.keys(options).some(key => !['output', 'resume', 'live', 'candidateId'].includes(key))) fail('resume accepts only its bound output and opt-in');
    ({ snapshot, protocolHash } = savedSnapshot(output));
  }
  else {
    for (const path of [options.intake, options.protocol, options.config, options.approvals]) if (!path) fail('intake, protocol, config and separate approvals are required');
    if ([resolve(options.intake, 'intake.private.json'), resolve(options.protocol), resolve(options.config)].includes(resolve(options.approvals))) fail('approval must be a separate manifest');
    const bundle = loadNullableIntake(options.intake);
    const { protocol, candidate } = selectCandidate(options.protocol, options.protocolSha256, options.candidateId);
    const { approvals, source: approvalSource } = loadProcessingApproval(options.approvals);
    const admission = validateApprovals(bundle, candidate, approvals, approvalSource);
    const matrix = admission.filter(row => row.decision === 'approved').map(row => row.textHash);
    if (!Number.isSafeInteger(options.maxCalls) || options.maxCalls < 0 || options.maxCalls > matrix.length * 2 || (matrix.length && !options.maxCalls)) fail('explicit call bound must be 1..2*approved (zero for empty admission)');
    const timeoutMs = options.timeoutMs ?? 60000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 180000) fail('timeout must be 1000..180000ms');
    const inputs = await prepare(bundle.intake.records, options.config);
    const prompts = {};
    for (const record of bundle.intake.records) {
      await scoreText({ ...inputs.prepared[record.textHash], text: record.text, model: candidate.model, logger: { warn() {}, info() {}, debug() {} },
        callLLM: async args => { prompts[record.textHash] = args.prompt; throw new Error('prompt capture only'); } });
      if (typeof prompts[record.textHash] !== 'string') fail('scorer prompt capture failed');
      if (!prompts[record.textHash].includes(record.text)) fail('scorer fencing changes approved text; new review required');
    }
    snapshot = { schemaVersion: 1, kind: 'nullable-rebaseline-score-collection', candidate, protocol, candidateProtocolHash: options.protocolSha256, candidateProtocolBytes: fs.readFileSync(options.protocol, 'utf8'),
      intakeHash: bundle.intakeHash, manifestHash: bundle.manifestHash, sourceIndexHash: bundle.sourceIndexHash, sourceIndex: bundle.sourceIndex, bundleFileHashes: bundle.fileHashes, records: bundle.intake.records,
      targetLabels: { expected_hot: null, class: null, authorship: null, humanQuality: null, expected_short_form_tells: null, perceived_ai_polish: null },
      approvals, approvalSource, admission, matrix, maxCalls: options.maxCalls, timeoutMs, repeats: 1, parserInvocationsPerText: 2, transportRetries: 0,
      budgetUnit: ['http', 'opencodex'].includes(candidate.transport) ? 'HTTP-request' : 'CLI-invocation',
      nativeUpstreamAttemptCountVerified: false, runtime: { node: process.version, platform: process.platform, arch: process.arch },
      inputs, prompts, codeHashes: currentCodeHashes() };
    assertSecretFree(snapshot); protocolHash = hash(encode(snapshot));
  }
  // Prevent writing even private artifacts into a tracked destination.
  if (relative(ROOT, output).split(sep)[0] !== '..' && execFileSync('git', ['ls-files', '--', relative(ROOT, output)], { cwd: ROOT, encoding: 'utf8' }).trim()) fail('tracked output destination refused');
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  if ((fs.statSync(output).mode & 0o077) !== 0) fail('private directory permissions must be 0700');
  if (!resume) {
    fs.writeFileSync(resolve(output, '.gitignore'), '*\n', { flag: 'wx', mode: 0o600 });
    save(resolve(output, 'snapshot.private.json'), snapshot);
    // Persist the same binding contract before opening the shared journal.
    save(resolve(output, 'study-protocol.json'), { schemaVersion: 1, protocolHash });
    save(resolve(output, 'progress.private.json'), { protocolHash, entries: {} });
  }
  const release = acquireStudyWriter(output, 'rebaseline-score-collection');
  fs.chmodSync(resolve(output, '.writer.lock'), 0o600);
  try {
    bindStudyProtocol(output, protocolHash); verifyPrivateTree(output);
    const progressPath = resolve(output, 'progress.private.json');
    const progress = readJson(progressPath);
    verifyProgress(output, snapshot, progress, protocolHash);
    if (resume && options.candidateId && options.candidateId !== snapshot.candidate.id) fail('resume candidate changed');
    const observations = [];
    // Validate/recover every already reserved evaluation offline before a paid call.
    for (const textHash of snapshot.matrix) {
      const entry = progress.entries[textHash]; if (!entry) continue;
      const record = snapshot.records.find(row => row.textHash === textHash), path = resolve(output, 'rows', `${textHash}.private.json`);
      const stored = entry.state === 'completed' ? readJson(path) : null;
      if (stored && (hash(fs.readFileSync(path)) !== entry.rowHash || evidenceHash(output, logical(protocolHash, snapshot.candidate, record)) !== entry.evidenceHash)) fail('observed row/receipt hash mismatch');
      const observation = await replayOne(output, snapshot, protocolHash, record, stored);
      if (!stored) { save(path, observation); progress.entries[textHash] = { state: 'completed', rowHash: hash(fs.readFileSync(path)), evidenceHash: evidenceHash(output, logical(protocolHash, snapshot.candidate, record)) }; save(progressPath, progress); }
      observations.push(observation);
    }
    if (options.live !== true) return { protocolHash, state: 'prepared-no-live-calls', ...summarizeCollection(snapshot, observations) };
    if (!snapshot.matrix.length) fail('no approved provider processing');
    let invocations = filesBelow(resolve(output, 'wire')).length;
    for (const textHash of snapshot.matrix) {
      if (progress.entries[textHash]) continue;
      if (fatal) throw fatal;
      const record = snapshot.records.find(row => row.textHash === textHash), id = logical(protocolHash, snapshot.candidate, record);
      progress.entries[textHash] = { state: 'started' }; save(progressPath, progress);
      let ordinal = 0;
      const observation = await evaluateScorerFixture(fixture(record, snapshot.inputs.prepared[record.textHash]), snapshot.candidate, { preparedInputs: snapshot.inputs.prepared[textHash], journalDirectory: output, logicalId: id, timeoutMs: snapshot.timeoutMs,
        complete: async (candidate, prompt, args) => {
          if (fatal) throw fatal;
          if (++ordinal > 2 || invocations >= snapshot.maxCalls) { fatal = new Error('rebaseline: call budget exhausted'); throw fatal; }
          invocations++;
          if (prompt !== snapshot.prompts[textHash] || hash(candidate) !== hash(snapshot.candidate)) { fatal = new Error('rebaseline: frozen prompt/candidate changed'); throw fatal; }
          const request = credentialFreeRequest(candidate, prompt, args);
          const identity = { logicalId: id, index: ordinal, candidate, promptHash: hash(prompt), temperature: args.temperature ?? .2, responseFormat: args.responseFormat ?? null, extraBody: args.extraBody ?? null };
          const wirePath = resolve(output, 'wire', hash(id), `${ordinal}.private.json`);
          const wire = { schemaVersion: 1, protocolHash, textHash, preparedHash: hash(encode(snapshot.inputs.prepared[textHash])), requestHash: hash(identity), request,
            state: 'started', startedAt: new Date().toISOString() };
          save(wirePath, wire);
          try {
            const response = await complete(candidate, prompt, { ...args, maxRetries: 0 }, transport => { wire.transport = transport; save(wirePath, wire); });
            if (fatal) throw fatal;
            assertSecretFree(response);
            wire.response = response; wire.state = 'completed'; wire.endedAt = new Date().toISOString(); save(wirePath, wire);
            return response;
          } catch (error) {
            if (fatal || /secret|credential-like/.test(error.message)) { fatal ||= new Error('rebaseline: response rejected; unresolved paid observation'); throw fatal; }
            if (error.studyResult) { assertSecretFree(error.studyResult); wire.errorMetadata = error.studyResult; }
            wire.error = safeStudyError(error); wire.state = 'error'; wire.endedAt = new Date().toISOString(); save(wirePath, wire);
            const failure = new Error(wire.error); if (wire.errorMetadata) failure.studyResult = wire.errorMetadata; throw failure;
          }
        } });
      if (fatal) throw fatal;
      if (observation.calls.some(call => ['study-journal-persistence-failed', 'study-call-unobserved', 'study-call-inflight', 'study-cancelled'].includes(call.error))) fail('unresolved journal; collection stopped');
      annotateObservation(observation, record, snapshot.inputs.prepared[textHash]);
      const recovered = await replayOne(output, snapshot, protocolHash, record, null);
      if (encode(normalizedObservation(observation)) !== encode(normalizedObservation(recovered))) fail('fresh receipt replay mismatch');
      observation.productionResult = recovered.productionResult;
      const rowPath = resolve(output, 'rows', `${textHash}.private.json`); save(rowPath, observation);
      progress.entries[textHash] = { state: 'completed', rowHash: hash(fs.readFileSync(rowPath)), evidenceHash: evidenceHash(output, id) }; save(progressPath, progress);
      observations.push(observation);
    }
    const report = { protocolHash, fullObservedReplay: false, ...summarizeCollection(snapshot, observations) };
    save(resolve(output, 'summary.private.json'), report);
    return report;
  } finally { release(); }
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) { console.log('collect-rebaseline-scores --intake DIR --protocol FILE --protocol-sha256 HASH --candidate ID --config FILE --approvals FILE --output DIR --max-calls N [--timeout-ms N] [--live]\nResume: --output DIR --resume [--live]. Offline replay: --output DIR --replay.'); return; }
  const options = {};
  const names = { '--intake': 'intake', '--protocol': 'protocol', '--protocol-sha256': 'protocolSha256', '--candidate': 'candidateId', '--config': 'config', '--approvals': 'approvals', '--output': 'output', '--max-calls': 'maxCalls', '--timeout-ms': 'timeoutMs' };
  for (let i = 0; i < argv.length; i++) {
    if (['--live', '--resume', '--replay'].includes(argv[i])) options[argv[i].slice(2)] = true;
    else if (names[argv[i]] && argv[i + 1] && !argv[i + 1].startsWith('--')) options[names[argv[i]]] = argv[++i];
    else fail('unknown or missing command-line option');
  }
  if (!options.output || (options.replay && (options.live || options.resume))) fail('explicit output and separate replay mode required');
  for (const key of ['maxCalls', 'timeoutMs']) if (options[key] !== undefined) options[key] = Number(options[key]);
  if (options.live === true) installStudySignals();
  const result = options.replay ? await replayCollection(resolve(options.output)) : await collectRebaselineScores(options);
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('rebaseline collection stopped; inspect private bindings/receipts before resuming'); process.exitCode = 1; });

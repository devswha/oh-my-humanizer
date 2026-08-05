// @ts-check
import { callLLMStream as defaultStream } from './streaming-api.js';
import { scoreDeterministicSignals, scoreFidelity, scoreMPS } from './scoring.js';
import { evaluateNumberSafety } from './features/meaning-proxy.js';
import { formatRewriteBodyForBrowser } from './output.js';
import { loadWebConfig, resolveBundleRoot } from './web-config.js';
import { buildWebRewritePrompt, loadWebAssets } from './web-rewrite.js';
import { evaluateFloors, redactSecrets, STREAM_FRAME_TYPES, WEB_TIERS } from './web-rewrite-contract.js';

/**
 * Extract a score field RAW (no coercion) so evaluateFloors can strictly reject
 * non-numbers. evaluateFloors requires a finite number >= floor, so a string,
 * object, array, or missing value fails closed — "95" must NOT become 95.
 * @param {unknown} score
 * @param {string} field
 */
function rawScore(score, field) {
  return /** @type {any} */ (score)?.[field];
}
const ATTEMPT_RETRY_REASONS = new Set([
  'initial',
  'transport',
  'network',
  'timeout',
  'temperature_schema',
  'score_schema_parse',
]);

/**
 * Retain only valid paid-attempt records in private result metadata.
 * @param {{valid: boolean}} attempts
 * @param {object[]} stageAttempts
 * @param {number} expectedAttemptIndex
 * @param {unknown} value
 */
function collectAttempt(attempts, stageAttempts, expectedAttemptIndex, value) {
  const fields = [
    'attemptIndex',
    'requestedModel',
    'effectiveModel',
    'usage',
    'retryReason',
    'minimumChargeApplied',
    'outcome',
  ];
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError();
    const source = /** @type {any} */ (value);
    const keys = Reflect.ownKeys(source);
    if (
      keys.length !== fields.length
      || !fields.every((field) => Object.prototype.hasOwnProperty.call(source, field))
      || keys.some((key) => typeof key !== 'string' || !fields.includes(key))
      || !Number.isInteger(source.attemptIndex)
      || source.attemptIndex !== expectedAttemptIndex
      || source.attemptIndex <= 0
      || !(typeof source.requestedModel === 'string' || source.requestedModel === null)
      || !(typeof source.effectiveModel === 'string' || source.effectiveModel === null)
      || !(source.usage === null || (typeof source.usage === 'object' && !Array.isArray(source.usage)))
      || !ATTEMPT_RETRY_REASONS.has(source.retryReason)
      || typeof source.minimumChargeApplied !== 'boolean'
      || !(source.outcome === 'success' || source.outcome === 'error')
    ) throw new TypeError();
    stageAttempts.push(value);
  } catch {
    attempts.valid = false;
  }
}

/**
 * @param {unknown} err
 * @param {string} [secret] Request-scoped API key to scrub verbatim, on top of
 *   pattern-based redaction. Covers provider key formats (e.g. GLM `id.secret`)
 *   that carry no `sk-`/`Bearer`/label marker for the regex to catch, so a key
 *   echoed in a provider error body never reaches an error frame or a log line.
 */
function safeError(err, secret) {
  let out = String(redactSecrets(/** @type {any} */ (err)?.message ?? err ?? 'unknown error'));
  if (typeof secret === 'string' && secret.length >= 8 && out.includes(secret)) {
    out = out.split(secret).join('[REDACTED]');
  }
  return out;
}

/** @param {unknown} value */
function cloneConfig(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

/**
 * @param {string} before
 * @param {string} after
 */
function summarizeDiff(before, after) {
  const beforeWords = before.trim() ? before.trim().split(/\s+/).length : 0;
  const afterWords = after.trim() ? after.trim().split(/\s+/).length : 0;
  return {
    beforeChars: before.length,
    afterChars: after.length,
    charDelta: after.length - before.length,
    beforeWords,
    afterWords,
    wordDelta: afterWords - beforeWords,
  };
}

/**
 * Provider-specific request fields for the two scoring calls.
 *
 * The MPS and fidelity judges are rubric-application tasks, and on
 * gemini-3.6-flash their thinking tokens dominate the bill: measured
 * 2026-07-29, thinking is ~57% of a request's cost and the two scorers
 * together cost more than the rewrite itself. `reasoning_effort: 'low'` cuts
 * scoring thinking sharply (measured 0-493 tokens per scorer against a
 * 700-1,900 baseline) for a ~55% cut in scoring cost.
 *
 * Safety was the deciding question — a cheaper gate that stops rejecting bad
 * rewrites would be worse than no saving. Verified across
 * tests/fixtures/meaning-proxy/pairs.json (3 preserving + 3 broken, KO+EN):
 * 6/6 verdicts identical to the default and 6/6 matching the expected verdict.
 *
 * Scoped to the providers it was measured on: gemini (2026-07-29, above) and
 * deepseek (2026-08-03 — deepseek-v4-flash accepts `reasoning_effort` and its
 * default thinking runs ~11.5k tokens per call, so uncut scorers would
 * dominate both latency and cost;
 * docs/operations/serving-engine-deepseek-0731-correction-20260803.md). The
 * same field is rejected outright by some providers (gemini itself returns
 * HTTP 400 for `reasoning_effort: 'none'`), so it is never sent blind to a
 * BYOK caller's provider. `PATINA_SCORING_REASONING=off` disables it.
 *
 * The rewrite call carries no scoring reasoning control: reduced thinking on
 * gemini rewrites was previously measured to amputate content. The free-tier
 * deepseek rewrite has its own, separately measured control below.
 *
 * @param {string|undefined} provider
 * @param {Record<string,string|undefined>} [env]
 * @returns {{reasoning_effort: string}|undefined}
 */
export function scoringExtraBody(provider, env = {}) {
  if (env.PATINA_SCORING_REASONING === 'off') return undefined;
  return provider === 'gemini' || provider === 'deepseek' ? { reasoning_effort: 'low' } : undefined;
}

/** Reasoning levels the free-tier rewrite control may request. */
const FREE_REWRITE_REASONING_LEVELS = Object.freeze(['low', 'medium', 'high']);

/**
 * Provider-specific request fields for the REWRITE call, free tier only.
 *
 * deepseek-v4-flash spends ~11.5k thinking tokens (~60-94s) per rewrite at
 * its default; `reasoning_effort: 'low'` halves that (~5.3k, ~44s) and held
 * 20/22 on the live-quality gate (2026-08-03, repeat-validated before the
 * production flip; docs/operations/serving-engine-deepseek-0731-correction-20260803.md).
 * That latency point is what makes deepseek serviceable as the free-tier
 * engine, so the cut applies ONLY when the server is paying for a free-tier
 * request on deepseek:
 * - BYOK callers keep their provider's default thinking — quality is theirs
 *   to configure, and unknown providers may reject the field with a 400.
 * - Pro requests keep full thinking: a paid rewrite never trades quality for
 *   the server's latency preference (the gemini amputation lesson).
 * `PATINA_FREE_REWRITE_REASONING` overrides the level (`low`|`medium`|`high`)
 * or disables the control entirely (`off`).
 *
 * @param {string|undefined} provider
 * @param {string|undefined} tier
 * @param {Record<string,string|undefined>} [env]
 * @returns {{reasoning_effort: string}|undefined}
 */
export function rewriteExtraBody(provider, tier, env = {}) {
  if (tier !== WEB_TIERS.FREE || provider !== 'deepseek') return undefined;
  const configured = env.PATINA_FREE_REWRITE_REASONING;
  if (configured === 'off') return undefined;
  const level = FREE_REWRITE_REASONING_LEVELS.includes(/** @type {string} */ (configured)) ? configured : 'low';
  return { reasoning_effort: /** @type {string} */ (level) };
}

/**
 * Stream a web rewrite and emit contract frames. A successful stream is start -> delta* -> done;
 * stream failures and scoring floor failures emit terminal error frames with no success done.
 *
 * @param {object} options
 * @param {object} options.request Validated web rewrite request.
 * @param {object} [options.config] Web-safe config.
 * @param {string} [options.repoRoot] Bundle root.
 * @param {Function} [options.callLLMStream] Streaming LLM client.
 * @param {{scoreMPS?: Function, scoreFidelity?: Function, scoreDeterministicSignals?: Function}} [options.scoreFns] Injectable scorers.
 * @param {(frame: object) => void} options.emit Frame sink.
 * @param {AbortSignal} [options.signal] Abort signal.
 * @param {number} [options.timeout] Timeout in milliseconds.
 * @param {(input: {tier: string, outcome: string, status: number, latencyMs: number}) => unknown} [options.observe] Closed telemetry sink.
 * @param {() => number} [options.now] Injectable clock.
 * @param {number} [options.numberSafetyRetries] Buffered LLM retries after a number-safety failure (default 1).
 * @param {Record<string,string|undefined>} [options.env] Server env, read only for scoring reasoning control.
 * @returns {Promise<object>} Small result summary.
 */
export async function runWebRewriteStream({
  request,
  repoRoot = resolveBundleRoot(),
  config = loadWebConfig({ repoRoot }),
  callLLMStream = defaultStream,
  scoreFns = {},
  emit,
  signal,
  timeout,
  observe,
  now = () => Date.now(),
  numberSafetyRetries = 1,
  env = typeof process === 'undefined' ? {} : process.env,
}) {
  if (typeof emit !== 'function') throw new TypeError('emit must be a function');
  let startedAt;
  if (typeof observe === 'function') {
    try {
      startedAt = Number(now());
    } catch {
      // A telemetry clock cannot alter a customer result.
    }
  }
  /**
   * @param {'completed'|'number_safety_failed'|'terminal_failed'} outcome
   * @param {number} status
   */
  const observeTerminal = (outcome, status) => {
    if (typeof observe !== 'function' || !Number.isFinite(startedAt)) return false;
    let endedAt;
    try {
      endedAt = Number(now());
    } catch {
      return false;
    }
    if (!Number.isFinite(endedAt)) return false;
    try {
      const result = observe({ tier: request.tier, outcome, status, latencyMs: Math.max(0, endedAt - startedAt) });
      if (result && typeof /** @type {any} */ (result).catch === 'function') /** @type {Promise<unknown>} */ (result).catch(() => {});
    } catch {
      // Observability is strictly nonblocking and exception-isolated.
    }
    return true;
  };
  const effectiveConfig = cloneConfig(config);
  effectiveConfig.language = request.lang;
  effectiveConfig.documentType = request.documentType || effectiveConfig.documentType || 'default';
  const documentType = effectiveConfig.documentType;
  const assets = loadWebAssets({ repoRoot, lang: request.lang, documentType, config: effectiveConfig, personaId: request.persona });
  const prompt = buildWebRewritePrompt({ request, config: effectiveConfig, assets });

  emit({ type: STREAM_FRAME_TYPES.START });

  // This metadata is intentionally return-only: NDJSON frames are customer-safe.
  /** @type {{valid: boolean, rewrite: object[], mps: object[], fidelity: object[]}} */
  const attempts = { valid: true, rewrite: [], mps: [], fidelity: [] };
  /** @type {{rewrite: number, mps: number, fidelity: number}} */
  const attemptCounts = { rewrite: 0, mps: 0, fidelity: 0 };
  /**
   * @param {'rewrite'|'mps'|'fidelity'} stage
   * @param {unknown} record
   */
  const recordAttempt = (stage, record) => {
    if (attemptsClosed) return;
    attemptCounts[stage] += 1;
    collectAttempt(attempts, attempts[stage], attemptCounts[stage], record);
  };
  const recordInvalidAttempt = () => {
    if (attemptsClosed) return;
    attempts.valid = false;
  };
  const closeAttempts = () => {
    attemptsClosed = true;
  };
  let attemptsClosed = false;
  let rewrite = '';
  const original = String(request.original ?? request.text ?? '');
  let numberSafety = null;
  const rewriteExtra = rewriteExtraBody(request.provider, request.tier, env);
  // Attempt 1 streams deltas live for UX. If the rewrite fails the
  // deterministic number-safety gate, retry the LLM call up to
  // `numberSafetyRetries` more times WITHOUT emitting deltas (the client has
  // already rendered attempt 1's text; the done frame carries the full
  // accepted rewrite and the playground replaces the bubble content with it,
  // so no protocol change is needed). Motivated by live gemini-3.6-flash
  // serving: sampling variance sometimes clears a numeric-drift habit that a
  // first attempt trips (docs/operations/pro-margin-decision-20260729.md).
  // Every paid attempt is still recorded in the private attempts metadata.
  const maxRuns = 1 + Math.max(0, Number.isSafeInteger(numberSafetyRetries) ? numberSafetyRetries : 1);
  for (let run = 1; run <= maxRuns; run += 1) {
    // Each callLLMStream invocation numbers its own attempts from 1; offset
    // retry-run indices so the stage's private attempt ledger stays one-based
    // and contiguous across runs (the fields and values are otherwise
    // untouched — every paid attempt is recorded).
    const indexBase = attemptCounts.rewrite;
    try {
      const streamResult = await callLLMStream({
        extraBody: rewriteExtra,
        prompt,
        apiKey: request.apiKey,
        baseURL: request.baseURL,
        model: request.model,
        signal,
        timeout,
        onDelta: (text) => {
          if (run === 1) emit({ type: STREAM_FRAME_TYPES.DELTA, text });
        },
        onAttempt: (record) => recordAttempt('rewrite', Number.isInteger(/** @type {any} */ (record)?.attemptIndex)
          ? { .../** @type {any} */ (record), attemptIndex: /** @type {any} */ (record).attemptIndex + indexBase }
          : record),
        onAttemptInvalid: recordInvalidAttempt,
      });
      rewrite = formatRewriteBodyForBrowser(streamResult.text);
    } catch (err) {
      const error = safeError(err, request.apiKey);
      closeAttempts();
      emit({ type: STREAM_FRAME_TYPES.ERROR, code: 'stream_failed', error });
      return { ok: false, code: 'stream_failed', error, attempts, observed: observeTerminal('terminal_failed', 500) };
    }
    numberSafety = evaluateNumberSafety(original, rewrite, request.lang);
    if (numberSafety.ok) break;
    // An externally aborted signal must not spend another paid attempt.
    if (run === maxRuns || signal?.aborted) {
      closeAttempts();
      emit({ type: STREAM_FRAME_TYPES.ERROR, code: 'number_safety_failed' });
      return { ok: false, code: 'number_safety_failed', numberSafety, attempts, observed: observeTerminal('number_safety_failed', 422) };
    }
  }

  const mpsScore = scoreFns.scoreMPS || scoreMPS;
  const fidelityScore = scoreFns.scoreFidelity || scoreFidelity;
  const deterministicScore = scoreFns.scoreDeterministicSignals || scoreDeterministicSignals;
  const scoringExtra = scoringExtraBody(request.provider, env);

  let mps, fidelity, signals, diff;
  try {
    const scoreResults = await Promise.allSettled([
      Promise.resolve().then(() => mpsScore({ original, rewritten: rewrite, apiKey: request.apiKey, baseURL: request.baseURL, model: request.model, extraBody: scoringExtra, signal, timeout, onAttempt: (record) => recordAttempt('mps', record), onAttemptInvalid: recordInvalidAttempt })),
      Promise.resolve().then(() => fidelityScore({ original, rewritten: rewrite, apiKey: request.apiKey, baseURL: request.baseURL, model: request.model, extraBody: scoringExtra, signal, timeout, onAttempt: (record) => recordAttempt('fidelity', record), onAttemptInvalid: recordInvalidAttempt })),
    ]);
    const [mpsResult, fidelityResult] = scoreResults;
    if (mpsResult.status === 'rejected') throw mpsResult.reason;
    if (fidelityResult.status === 'rejected') throw fidelityResult.reason;
    mps = mpsResult.value;
    fidelity = fidelityResult.value;
    signals = {
      before: deterministicScore({ text: original, config: effectiveConfig, repoRoot }),
      after: deterministicScore({ text: rewrite, config: effectiveConfig, repoRoot }),
    };
    diff = summarizeDiff(original, rewrite);
  } catch (err) {
    // A scoring failure (including an abort during scoring) must terminate as
    // a clean NDJSON error frame — never bubble to the handler's JSON 500,
    // which would append a non-frame tail to an already-started stream.
    const error = safeError(err, request.apiKey);
    closeAttempts();
    emit({ type: STREAM_FRAME_TYPES.ERROR, code: 'scoring_failed', error });
    return { ok: false, code: 'scoring_failed', error, attempts, observed: observeTerminal('terminal_failed', 500) };
  }

  // Pass the raw score values to evaluateFloors, which strictly requires a
  // finite number >= floor (a non-number fails closed). No Number() coercion.
  const floors = evaluateFloors({ mps: rawScore(mps, 'mps'), fidelity: rawScore(fidelity, 'fidelity') });
  if (!floors.ok) {
    // Keep the already-computed audit metadata (deterministic signals + length
    // diff) on floor failures so a flagged attempt stays auditable in the UI.
    closeAttempts();
    emit({ type: STREAM_FRAME_TYPES.ERROR, code: 'floor_failed', failed: floors.failed, rewrite, mps, fidelity, signals, diff });
    return { ok: false, code: 'floor_failed', failed: floors.failed, mps, fidelity, signals, diff, attempts, observed: observeTerminal('terminal_failed', 422) };
  }

  closeAttempts();
  emit({ type: STREAM_FRAME_TYPES.DONE, rewrite, mps, fidelity, signals, diff });
  return { ok: true, rewrite, mps, fidelity, signals, diff, attempts, observed: observeTerminal('completed', 200) };
}

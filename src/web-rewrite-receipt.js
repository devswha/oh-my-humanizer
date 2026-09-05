// @ts-check
import { createHash } from 'node:crypto';

const PRIVATE_FIELDS = new Set([
  'apikey',
  'attemptindex',
  'attempts',
  'attemptcount',
  'attemptcounts',
  'baseurl',
  'cachetokens',
  'effectivemodel',
  'minimumchargeapplied',
  'model',
  'outcome',
  'provider',
  'raw',
  'rawresponse',
  'requestedmodel',
  'retryreason',
  'timestamp',
  'timestamps',
  'usage',
]);

/**
 * Convert JSON-compatible data into a recursively key-sorted representation.
 * @param {unknown} value
 * @returns {unknown}
 */
export function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const child = canonicalize(/** @type {Record<string, unknown>} */ (value)[key]);
    if (child !== null || /** @type {Record<string, unknown>} */ (value)[key] === null) out[key] = child;
  }
  return out;
}

/** @param {unknown} value */
export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

/** @param {unknown} value */
export function sha256(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

/**
 * Retain public verification data while rejecting accidental source or private
 * metadata propagation from injected scorers.
 * @param {unknown} value
 * @param {Set<string>} sourceValues
 * @returns {unknown}
 */
function publicVerification(value, sourceValues) {
  if (typeof value === 'string') {
    return [...sourceValues].some((source) => source && value.includes(source)) ? null : value;
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((item) => publicVerification(item, sourceValues));
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (PRIVATE_FIELDS.has(key.toLowerCase())) continue;
    const child = publicVerification(/** @type {Record<string, unknown>} */ (value)[key], sourceValues);
    if (child !== null || /** @type {Record<string, unknown>} */ (value)[key] === null) out[key] = child;
  }
  return out;
}

/** @param {unknown} value */
function publicChoice(value) {
  return value === null || value === undefined || value === '' ? null : String(value);
}

/** @param {unknown} value */
function publicPromptBudget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const budget = /** @type {Record<string, unknown>} */ (value);
  const policies = new Set(['off', 'shadow', 'active']);
  const profiles = new Set(['strict', 'minimal']);
  const reasons = new Set([
    'invalid_request', 'not_first_turn', 'unsupported_language', 'invalid_text',
    'multiple_blocks', 'text_too_long', 'non_default_document_type',
    'persona_or_register', 'transformation_options', 'unexpected_context',
    'number_date_or_percent', 'negation_or_polarity',
    'causation', 'multiple_claims', 'eligible',
  ]);
  if (!policies.has(/** @type {string} */ (budget.policy))
    || !profiles.has(/** @type {string} */ (budget.selected))
    || !profiles.has(/** @type {string} */ (budget.applied))
    || !reasons.has(/** @type {string} */ (budget.reason))) return null;
  return {
    policy: budget.policy,
    selected: budget.selected,
    applied: budget.applied,
    reason: budget.reason,
  };
}

/**
 * Build an integrity binding, not a provider attestation, for an accepted
 * hosted rewrite. Source text is represented only by SHA-256 hashes.
 * @param {object} input
 * @param {Record<string, unknown>} input.request
 * @param {string} input.documentType
 * @param {unknown} input.original
 * @param {unknown} input.latest
 * @param {unknown} input.prompt
 * @param {unknown} input.output
 * @param {unknown} input.mps
 * @param {unknown} input.fidelity
 * @param {unknown} input.signals
 * @param {unknown} input.diff
 * @param {unknown} [input.budget]
 */
export function buildWebRewriteReceipt({
  request,
  documentType,
  original,
  latest,
  prompt,
  output,
  mps,
  fidelity,
  signals,
  diff,
  budget,
}) {
  const sourceValues = new Set([String(original ?? ''), String(latest ?? ''), String(prompt ?? ''), String(output ?? '')]);
  const receipt = {
    schemaVersion: 'patina-rewrite-receipt-v2',
    assurance: 'integrity-binding-not-provider-attestation',
    request: {
      mode: publicChoice(request?.mode),
      lang: publicChoice(request?.lang),
      tier: publicChoice(request?.tier),
      documentType: publicChoice(documentType),
      persona: publicChoice(request?.persona),
      register: publicChoice(request?.register),
    },
    hashes: {
      original: sha256(original ?? ''),
      latest: sha256(latest ?? ''),
      prompt: sha256(prompt ?? ''),
      output: sha256(output ?? ''),
    },
    verification: {
      mps: publicVerification(mps, sourceValues),
      fidelity: publicVerification(fidelity, sourceValues),
      signals: publicVerification(signals, sourceValues),
      diff: publicVerification(diff, sourceValues),
    },
    promptBudget: publicPromptBudget(budget),
    ...(Array.isArray(request?.protectedSpans) && request.protectedSpans.length
      ? { constraints: { protectedSpans: request.protectedSpans.map(({ start, end }) => ({ start, end })) } }
      : {}),
  };
  return { ...receipt, receiptHash: sha256(canonicalJson(receipt)) };
}

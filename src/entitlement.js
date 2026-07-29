// @ts-check

// Server-only Lemon Squeezy License Key entitlement core for the patina Pro tier.
// This module is the revenue gate for the hosted "pro" tier: it turns a
// caller-supplied license key into an allow/deny decision using Lemon Squeezy's
// validate-only endpoint (POST /v1/licenses/validate), fronted by a fail-closed
// admission layer that keeps patina under Lemon Squeezy's 60 req/min ceiling.
//
// Design invariants (all fail-closed — uncertainty NEVER grants entitlement):
//   - Missing config, or (in production) a missing secret/shared-KV, an LS
//     error/timeout/non-2xx/bad-body, a saturated admission bucket, or a held
//     single-flight lock all DENY access.
//   - The raw license key is NEVER written to a log line, an error body, a return
//     value, or a KV key. Every KV key is an HMAC of the license; every return
//     value carries only the HMAC "subject"; every log payload is passed through
//     redactSecrets and only ever carries the subject.
//
// It deliberately reuses the quota primitives (quotaKeyHmac / isProductionPosture /
// createMemoryKv) and the shared redaction/reason contract rather than growing a
// parallel convention. No new runtime dependency: HMAC comes from rate-limit.js,
// fetch from globalThis.fetch (injectable), timeouts from AbortController.

import { createMemoryKv, isProductionPosture, quotaKeyHmac } from './rate-limit.js';
import { QUOTA_REASONS, redactSecrets } from './web-rewrite-contract.js';

/** Lemon Squeezy validate-only endpoint. */
export const LS_LICENSE_VALIDATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/validate';

/** license_key.status values that entitle. Validate-only: an issued-but-inactive key still entitles. */
const USABLE_STATUSES = new Set(['active', 'inactive']);
/** license_key.status values that are explicitly revoked/lapsed. */
const BLOCKED_STATUSES = new Set(['expired', 'disabled']);

/** Default tunables (each overridable via env). */
const DEFAULT_CACHE_TTL_MS = 300_000; // positive-result cache
const DEFAULT_NEGATIVE_CACHE_TTL_MS = 60_000; // negative-result cache
const DEFAULT_TIMEOUT_MS = 2_500; // LS fetch abort deadline
const DEFAULT_VALIDATE_RPM = 50; // stays below LS's hard 60 rpm ceiling
const LOCK_TTL_MS = 10_000; // single-flight lock self-heal window
const DEFAULT_LOCK_POLL_INTERVAL_MS = 150; // follower cache-poll cadence while the winner validates
/** Dev-only HMAC fallback; only ever reached OUTSIDE production (prod requires a real secret). */
const DEV_FALLBACK_SECRET = 'patina-local-license-secret';

/**
 * @typedef {{ok: true, subject: string, tier: 'pro', status: string, cache: 'hit'|'miss'}} EntitlementAllow
 * @typedef {{ok: false, status: 401|403|503, reason: string}} EntitlementDeny
 * @typedef {EntitlementAllow|EntitlementDeny} EntitlementResult
 * @typedef {{get(key: string): Promise<unknown>, set(key: string, val: unknown, options?: {ttlMs?: number}): Promise<void>, incr(key: string, options?: {ttlMs?: number}): Promise<number>, __memory?: boolean}} EntitlementKv
 */

/**
 * Parse a positive integer env value, falling back when absent/invalid/<=0.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function readPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Extract exactly one `Bearer <token>` license from a request's headers, matching
 * the `authorization` header name case-insensitively (and the scheme
 * case-insensitively, per RFC 7235). Anything ambiguous — absent, blank, a
 * non-Bearer scheme, an empty token, or more than one authorization value — fails
 * closed. Never logs or echoes the raw header/token.
 *
 * @param {Record<string, string|string[]|undefined>|null|undefined} headers
 * @returns {{ok: true, license: string}|{ok: false, status: 401, reason: string}}
 */
export function extractBearerLicense(headers) {
  const missing = /** @type {{ok: false, status: 401, reason: string}} */ (
    { ok: false, status: 401, reason: QUOTA_REASONS.LICENSE_REQUIRED }
  );
  if (!headers || typeof headers !== 'object') return missing;

  // Case-insensitive header lookup. Two distinct authorization keys is ambiguous.
  /** @type {string|string[]|undefined} */
  let raw;
  let seen = 0;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'authorization') {
      raw = value;
      seen += 1;
    }
  }
  if (seen !== 1 || raw === undefined || raw === null) return missing;

  // A header array with more than one value is "multiple" -> ambiguous -> reject.
  let value;
  if (Array.isArray(raw)) {
    if (raw.length !== 1) return missing;
    value = raw[0];
  } else {
    value = raw;
  }
  if (typeof value !== 'string') return missing;

  // Exactly one token: scheme, whitespace, one non-whitespace token, nothing else.
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
  if (!match || !match[1]) return missing;
  return { ok: true, license: match[1] };
}

/**
 * Pure allow/deny evaluation of a Lemon Squeezy validate response against the
 * configured store/variant/product. On any failed check the PUBLIC result is a
 * generic 403 LICENSE_INVALID; the specific failing check is exposed only via the
 * non-authoritative `detail` field (for server-side logging — never returned to
 * the client, never contains the license).
 *
 * @param {any} data Parsed LS validate response body.
 * @param {Record<string, string|undefined>} [env]
 * @param {number} [now] Epoch ms used to evaluate expiry.
 * @returns {{ok: true, status: string, expiresAt: number|null}|{ok: false, status: 403, reason: string, detail: string}}
 */
export function evaluateLicenseResponse(data, env = {}, now = Date.now()) {
  const deny = (/** @type {string} */ detail) => (
    /** @type {{ok: false, status: 403, reason: string, detail: string}} */ (
      { ok: false, status: 403, reason: QUOTA_REASONS.LICENSE_INVALID, detail }
    )
  );

  if (!data || typeof data !== 'object') return deny('malformed-response');
  if (data.valid !== true) return deny('not-valid');

  const licenseKey = data.license_key;
  if (!licenseKey || typeof licenseKey !== 'object') return deny('missing-license_key');

  const status = licenseKey.status;
  if (typeof status !== 'string') return deny('status-missing');
  // Both gates are asserted explicitly even though the sets are disjoint: a status
  // in {expired,disabled} is blocked, and only {active,inactive} is entitled.
  if (BLOCKED_STATUSES.has(status)) return deny(`status-${status}`);
  if (!USABLE_STATUSES.has(status)) return deny('status-not-usable');

  // Expiry: absent/null entitles; present must parse to a strictly future instant.
  let expiresAt = /** @type {number|null} */ (null);
  const rawExpiry = licenseKey.expires_at;
  if (rawExpiry !== null && rawExpiry !== undefined) {
    const parsed = Date.parse(rawExpiry);
    if (!Number.isFinite(parsed) || !(parsed > now)) return deny('expired');
    expiresAt = parsed;
  }

  const meta = data.meta;
  if (!meta || typeof meta !== 'object') return deny('missing-meta');
  if (String(meta.store_id) !== String(env.LS_STORE_ID)) return deny('store-mismatch');
  if (String(meta.variant_id) !== String(env.LS_PRO_VARIANT_ID)) return deny('variant-mismatch');
  const wantProduct = env.LS_PRO_PRODUCT_ID;
  if (wantProduct !== undefined && wantProduct !== null && wantProduct !== '') {
    if (String(meta.product_id) !== String(wantProduct)) return deny('product-mismatch');
  }

  return { ok: true, status, expiresAt };
}

/**
 * Validate and interpret a cached decision. The embedded `expiresAt` (epoch ms) is
 * authoritative on read (the KV TTL only reclaims storage): a missing/NaN/past
 * value, or an unrecognized decision shape, is treated as a miss (returns null).
 *
 * @param {unknown} entry
 * @param {number} nowMs
 * @returns {{decision: 'allow', status: string}|{decision: 'deny', status: number, reason: string}|null}
 */
function readCacheEntry(entry, nowMs) {
  if (!entry || typeof entry !== 'object') return null;
  const e = /** @type {Record<string, unknown>} */ (entry);
  const expiresAt = e.expiresAt;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= nowMs) return null;
  if (e.decision === 'allow' && typeof e.status === 'string') {
    return { decision: 'allow', status: e.status };
  }
  if (e.decision === 'deny' && typeof e.status === 'number' && typeof e.reason === 'string') {
    return { decision: 'deny', status: e.status, reason: e.reason };
  }
  return null;
}

/**
 * Provider descriptor: the ONLY parts of the entitlement gate that differ
 * between license vendors. Everything else in `createLicenseValidator` —
 * HMAC subjects, the two-layer cache, the cross-instance single-flight lock,
 * the RPM admission bucket, timeout handling, redaction, and the fail-closed
 * defaults — is vendor-independent and must never be duplicated per provider.
 *
 * @typedef {object} LicenseProvider
 * @property {string} id Short namespace for HMAC key prefixes and env names. Changing it invalidates cached decisions, which is intended on a provider switch.
 * @property {(env: Record<string, string|undefined>) => string} url Validate endpoint.
 * @property {(env: Record<string, string|undefined>) => boolean} configured Whether the entitlement-deciding config is present; false fails closed.
 * @property {(license: string, env: Record<string, string|undefined>) => {headers: Record<string,string>, body: string}} request Request headers and serialized body.
 * @property {(status: number, body: any) => boolean} isDefinitiveDenial Whether a non-2xx answer is a license verdict rather than an outage.
 * @property {(data: any, env: Record<string, string|undefined>, now: number) => {ok: true, status: string, expiresAt: number|null}|{ok: false, status: 403, reason: string, detail: string}} evaluate
 * @property {number} defaultRpm Per-minute admission ceiling when unconfigured.
 * @property {(data: any) => string|undefined} [errorText] Vendor error string for triage logging; must never return PII.
 */

/** @type {LicenseProvider} */
export const LEMON_SQUEEZY_PROVIDER = {
  id: 'ls',
  url: () => LS_LICENSE_VALIDATE_URL,
  configured: (env) => Boolean(env.LS_STORE_ID && env.LS_PRO_VARIANT_ID),
  request: (license) => ({
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new globalThis.URLSearchParams({ license_key: license }).toString(),
  }),
  // LS answers an unknown/malformed key with a 4xx whose body still carries
  // `valid: false`; that is a verdict, not an outage. A 429 (LS's own rate
  // limit) or any 5xx stays transient.
  isDefinitiveDenial: (status, body) =>
    status >= 400 && status < 500 && status !== 429
    && Boolean(body) && typeof body === 'object' && body.valid === false,
  evaluate: evaluateLicenseResponse,
  defaultRpm: DEFAULT_VALIDATE_RPM,
  errorText: (data) => (data && typeof data.error === 'string' ? data.error : undefined),
};

/**
 * Build a fail-closed, validate-only license validator with a two-layer cache
 * (positive + negative) and an admission guard (per-minute RPM bucket +
 * per-license single-flight lock) that runs BEFORE any provider network call.
 *
 * The vendor-specific surface is supplied as a `provider` descriptor; this
 * function holds the security machinery that must stay identical across
 * vendors rather than being duplicated per integration.
 *
 * @param {{
 *   provider?: LicenseProvider,
 *   kv?: EntitlementKv|null,
 *   hmacSecret?: string,
 *   env?: Record<string, string|undefined>,
 *   fetchImpl?: typeof fetch,
 *   now?: () => number,
 *   logger?: {warn?: (...args: unknown[]) => void, log?: (...args: unknown[]) => void},
 * }} [options]
 * @returns {{validate(input: {licenseKey: string}): Promise<EntitlementResult>}}
 */
export function createLicenseValidator({
  provider = LEMON_SQUEEZY_PROVIDER,
  kv,
  hmacSecret,
  env = {},
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  logger = console,
} = {}) {
  // Tunable env names are namespaced per provider so a vendor switch cannot
  // silently inherit the previous vendor's settings — its RPM ceiling above
  // all, since Polar's tolerance is a fraction of Lemon Squeezy's.
  const tunable = (/** @type {string} */ name) => env[`PATINA_${provider.id.toUpperCase()}_${name}`];
  // Non-production fallback store, created at most once and only when no KV is
  // injected (production already requires a real shared KV below). When a KV is
  // injected this is that same reference.
  const store = kv || createMemoryKv();

  // Base log sink: redactSecrets scrubs secret-named keys and labelled token
  // shapes. Per-request logging additionally routes through `warnSafe` below,
  // which exact-substring-scrubs the current raw license (LS can echo it under an
  // unlabelled/non-secret key that pattern redaction alone would miss).
  const warn = (/** @type {string} */ message, /** @type {Record<string, unknown>} */ meta) => {
    try {
      const fn = logger && (logger.warn || logger.log);
      if (typeof fn === 'function') fn.call(logger, message, redactSecrets(meta));
    } catch {
      /* logging must never throw into the request path */
    }
  };

  const unavailable = () => /** @type {EntitlementDeny} */ (
    { ok: false, status: 503, reason: QUOTA_REASONS.LICENSE_UNAVAILABLE }
  );
  const required = () => /** @type {EntitlementDeny} */ (
    { ok: false, status: 401, reason: QUOTA_REASONS.LICENSE_REQUIRED }
  );

  /**
   * @param {{licenseKey?: string}} [input]
   * @returns {Promise<EntitlementResult>}
   */
  const validate = async (input = {}) => {
    const licenseKey = input.licenseKey;
    // 0. Input guard (defense in depth; the handler extracts via extractBearerLicense first).
    if (typeof licenseKey !== 'string' || licenseKey.trim() === '') return required();

    const production = isProductionPosture(env);

    // 1. Fail-closed prerequisites.
    const configuredSecret = hmacSecret || env.PATINA_LICENSE_HMAC_SECRET || env.PATINA_QUOTA_HMAC_SECRET;
    // A memory KV in production is not a shared store: it cannot enforce the
    // cross-instance admission guard, so treat it as unavailable (mirrors the
    // rate limiter's production KV posture).
    if (production && (!kv || kv.__memory)) return unavailable();
    if (production && !configuredSecret) return unavailable();
    // Config is required in every posture: without store/variant we cannot decide entitlement.
    if (!provider.configured(env)) return unavailable();

    const secret = configuredSecret || DEV_FALLBACK_SECRET;

    // 2. Derive HMAC keys. The raw license never appears in any key.
    const subject = quotaKeyHmac(secret, `${provider.id}-license-subject`, licenseKey);
    const cacheKey = quotaKeyHmac(secret, `${provider.id}-license-cache`, licenseKey);
    const nowMs = now();

    // 3. Cache lookup. A broken cache read must NOT fail open; fall through to LS.
    try {
      const hit = readCacheEntry(await store.get(cacheKey), nowMs);
      if (hit) {
        if (hit.decision === 'allow') {
          return { ok: true, subject, tier: 'pro', status: hit.status, cache: 'hit' };
        }
        return /** @type {EntitlementDeny} */ ({ ok: false, status: hit.status, reason: hit.reason });
      }
    } catch {
      /* treat as a miss */
    }

    // 4. Cross-instance single-flight lock FIRST (before the RPM bucket): only
    //    the first caller for a given license proceeds; concurrent callers fail
    //    closed and retry into the cache the winner writes. Acquiring the lock
    //    before charging RPM means a same-license stampede cannot exhaust the
    //    global LS minute budget (only the winner ever charges RPM / calls LS).
    //    A per-process in-flight map would dedupe within ONE process only and is
    //    NOT a substitute for this shared-KV lock across instances.
    const warnSafe = (/** @type {string} */ message, /** @type {Record<string, unknown>} */ meta) =>
      warn(message, /** @type {Record<string, unknown>} */ (scrubLicense(meta, licenseKey)));

    const timeoutMs = readPositiveInt(tunable('TIMEOUT_MS'), DEFAULT_TIMEOUT_MS);
    // The lock MUST outlive the fetch it guards, or it could self-heal mid-flight
    // and let a second instance call LS. Floor at LOCK_TTL_MS; extend past the
    // fetch deadline when a longer timeout is configured.
    const lockTtlMs = Math.max(LOCK_TTL_MS, timeoutMs + 5_000);
    const lockKey = quotaKeyHmac(secret, `${provider.id}-lock`, licenseKey);
    let lockCount;
    try {
      lockCount = await store.incr(lockKey, { ttlMs: lockTtlMs });
    } catch {
      return unavailable();
    }
    if (!Number.isSafeInteger(lockCount) || lockCount < 1) return unavailable();
    if (lockCount > 1) {
      // Follower path: the winner is validating this SAME license right now and
      // writes the cache when it finishes (typically well under timeoutMs). An
      // instant 503 here would break the advertised concurrency for a license's
      // first burst — right after purchase, or whenever the positive cache TTL
      // lapses — so followers briefly poll the cache instead (#606). The loop
      // is bounded by ITERATION COUNT, never the wall clock, so an injected or
      // frozen `now` cannot spin it forever; when the winner crashed or LS is
      // down, nothing gets cached and this stays fail-closed 503.
      const pollIntervalMs = readPositiveInt(tunable('LOCK_POLL_INTERVAL_MS'), DEFAULT_LOCK_POLL_INTERVAL_MS);
      const lockWaitMs = readPositiveInt(tunable('LOCK_WAIT_MS'), Math.min(lockTtlMs, timeoutMs + 1_000));
      const attempts = Math.max(1, Math.ceil(lockWaitMs / pollIntervalMs));
      for (let i = 0; i < attempts; i += 1) {
        await sleep(pollIntervalMs);
        try {
          const hit = readCacheEntry(await store.get(cacheKey), now());
          if (hit) {
            if (hit.decision === 'allow') {
              return { ok: true, subject, tier: 'pro', status: hit.status, cache: 'hit' };
            }
            return /** @type {EntitlementDeny} */ ({ ok: false, status: hit.status, reason: hit.reason });
          }
        } catch {
          /* a broken cache read never fails open; keep polling */
        }
      }
      warnSafe('entitlement: LS validate single-flight lock held', { subject, lockCount });
      return unavailable();
    }

    // Winner path: hold the lock; release it on EVERY completion path (cache
    // re-hit, RPM saturation, fetch success/denial/transient failure) so an
    // immediate retry re-validates or hits the freshly written cache. Release
    // resets the counter to 0 via set() (a guaranteed KV op): losers that
    // incremented past 1 never decrement, so a decr-based release would leak the
    // counter upward and wedge the lock. lockTtlMs is only the crash self-heal.
    let lockReleased = false;
    const releaseLock = async () => {
      if (lockReleased) return;
      lockReleased = true;
      try {
        await store.set(lockKey, 0, { ttlMs: lockTtlMs });
      } catch {
        /* best-effort; the TTL self-heals the lock regardless */
      }
    };

    try {
      // 4b. Re-read the cache now that we hold the lock: a previous winner may
      //     have finished (and released the lock) between our miss above and our
      //     lock acquisition. Serving its cached result closes the follower race
      //     that would otherwise make a duplicate LS call.
      try {
        const hit = readCacheEntry(await store.get(cacheKey), nowMs);
        if (hit) {
          if (hit.decision === 'allow') {
            return { ok: true, subject, tier: 'pro', status: hit.status, cache: 'hit' };
          }
          return /** @type {EntitlementDeny} */ ({ ok: false, status: hit.status, reason: hit.reason });
        }
      } catch {
        /* treat as a miss */
      }

      // 4c. Per-minute RPM bucket keeps us under LS's 60 rpm ceiling. Charged
      //     only by the winner that will actually call LS.
      const rpmLimit = readPositiveInt(tunable('VALIDATE_RPM'), provider.defaultRpm);
      const minute = Math.floor(nowMs / 60_000);
      const rpmKey = quotaKeyHmac(secret, `${provider.id}-rpm`, minute);
      let rpmCount;
      try {
        rpmCount = await store.incr(rpmKey, { ttlMs: 60_000 });
      } catch {
        return unavailable();
      }
      if (!Number.isSafeInteger(rpmCount) || rpmCount < 1) return unavailable();
      if (rpmCount > rpmLimit) {
        warnSafe('entitlement: validate RPM bucket saturated', { provider: provider.id, subject, minute, rpmCount, rpmLimit });
        return unavailable();
      }

      // 5. Validate-only call with a hard timeout.
      const controller = new AbortController();
      const timer = setTimeout(() => {
        try { controller.abort(); } catch { /* noop */ }
      }, timeoutMs);
      let response;
      try {
        const built = provider.request(licenseKey, env);
        response = await fetchImpl(provider.url(env), {
          method: 'POST',
          headers: built.headers,
          body: built.body,
          signal: controller.signal,
        });
      } catch (err) {
        warnSafe('entitlement: validate request failed', { provider: provider.id, subject, error: errorMessage(err) });
        return unavailable();
      } finally {
        clearTimeout(timer);
      }

      if (!response || typeof response.ok !== 'boolean') return unavailable();

      // Non-2xx: some answers are a definitive license verdict rather than an
      // outage (LS returns 4xx with `valid: false`; Polar returns 404
      // ResourceNotFound). A verdict falls through to the deny path below
      // (403 + negative cache) — treating it as a 503 would break the client
      // contract AND leave every same-key retry re-charging the provider's
      // rate budget. Anything the provider does not call definitive stays a
      // transient 503 and is never cached.
      /** @type {any} */
      let data;
      if (!response.ok) {
        const status = response.status;
        // Only 4xx bodies are worth parsing for a verdict; a 5xx body is an
        // outage payload and parsing it would just waste the deadline.
        let body = null;
        if (typeof status === 'number' && status >= 400 && status < 500) {
          try { body = await response.json(); } catch { body = null; }
        }
        if (!provider.isDefinitiveDenial(status, body)) {
          warnSafe('entitlement: validate non-2xx', { provider: provider.id, subject, status });
          return unavailable();
        }
        data = body;
      } else {
        try {
          data = await response.json();
        } catch (err) {
          warnSafe('entitlement: LS validate response parse failed', { subject, error: errorMessage(err) });
          return unavailable();
        }
      }

      // 6. Evaluate + cache. A denial is cached negatively (bounded); a transient
      //    503 is NEVER cached so a retry re-attempts validation.
      const decision = provider.evaluate(data, env, nowMs);

      // `=== true` (not truthiness) so the fall-through below narrows to the deny shape.
      if (decision.ok === true) {
        const posDefault = readPositiveInt(tunable('CACHE_TTL_MS'), DEFAULT_CACHE_TTL_MS);
        let ttl = posDefault;
        if (decision.expiresAt !== null && Number.isFinite(decision.expiresAt)) {
          const untilExpiry = decision.expiresAt - nowMs;
          if (untilExpiry > 0) ttl = Math.min(posDefault, untilExpiry);
        }
        // Embedded expiresAt is authoritative on read; KV TTL is only for cleanup.
        await safeSet(store, cacheKey, { decision: 'allow', tier: 'pro', status: decision.status, expiresAt: nowMs + ttl }, ttl, warnSafe, subject);
        return { ok: true, subject, tier: 'pro', status: decision.status, cache: 'miss' };
      }

      const negTtl = readPositiveInt(tunable('NEGATIVE_CACHE_TTL_MS'), DEFAULT_NEGATIVE_CACHE_TTL_MS);
      await safeSet(store, cacheKey, { decision: 'deny', tier: 'pro', status: decision.status, reason: decision.reason, expiresAt: nowMs + negTtl }, negTtl, warnSafe, subject);
      // The concrete failing check (plus LS's own error string, if any) is logged
      // for triage; the FULL LS body is never logged — its `meta` carries customer
      // PII (customer_email / customer_name) that secret-name redaction won't catch.
      const vendorError = provider.errorText ? provider.errorText(data) : undefined;
      warnSafe('entitlement: license denied', { subject, detail: decision.detail, error: vendorError });
      return /** @type {EntitlementDeny} */ ({ ok: false, status: decision.status, reason: decision.reason });
    } finally {
      await releaseLock();
    }
  };

  return { validate };
}

/**
 * Lemon Squeezy validator. Thin wrapper over `createLicenseValidator` kept as
 * the historical entry point so the existing behavioral and redteam suites
 * pin the shared machinery unchanged.
 *
 * @param {Parameters<typeof createLicenseValidator>[0]} [options]
 * @returns {ReturnType<typeof createLicenseValidator>}
 */
export function createLemonSqueezyLicenseValidator(options = {}) {
  return createLicenseValidator({ ...options, provider: LEMON_SQUEEZY_PROVIDER });
}

/**
 * Deep exact-substring scrub of a known raw license from a log payload, applied
 * BEFORE the pattern-based redactSecrets. Lemon Squeezy can echo the license
 * under an unlabelled or non-secret key that pattern redaction alone misses, so
 * we replace the exact value we hold. Guarded on length so trivially short
 * values can't over-redact unrelated text.
 *
 * @param {unknown} value
 * @param {string} license
 * @returns {unknown}
 */
function scrubLicense(value, license) {
  if (typeof license !== 'string' || license.length < 4) return value;
  const walk = (/** @type {unknown} */ v) => {
    if (typeof v === 'string') return v.split(license).join('[REDACTED]');
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      /** @type {Record<string, unknown>} */
      const out = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(value);
}

/** @param {number} ms @returns {Promise<void>} */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @param {unknown} err @returns {string} */
function errorMessage(err) {
  if (err && typeof err === 'object' && 'message' in err) return String(/** @type {{message: unknown}} */ (err).message);
  return String(err);
}

/**
 * Best-effort cache write. A caching failure must never fail an otherwise-valid
 * decision, so errors are swallowed after a redacted log.
 * @param {EntitlementKv} store
 * @param {string} key
 * @param {unknown} value
 * @param {number} ttlMs
 * @param {(message: string, meta: Record<string, unknown>) => void} warn
 * @param {string} subject
 * @returns {Promise<void>}
 */
async function safeSet(store, key, value, ttlMs, warn, subject) {
  try {
    await store.set(key, value, { ttlMs });
  } catch (err) {
    warn('entitlement: cache write failed', { subject, error: errorMessage(err) });
  }
}

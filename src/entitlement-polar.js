// @ts-check

// Polar license-key entitlement evaluation for the patina Pro tier.
//
// Scope of this module: the PROVIDER-SPECIFIC half of the entitlement gate —
// building the validate request and judging the response. The
// provider-independent half (HMAC subjects, positive/negative caching,
// single-flight locking, RPM admission, redaction, fail-closed defaults) lives
// in src/entitlement.js and is reused rather than duplicated; wiring the two
// together lands with sandbox access, which is what makes it testable.
//
// Provider notes that shaped this file (Polar docs, retrieved 2026-07-29):
//   - The validate endpoint is on the customer portal and takes no server
//     secret: POST /v1/customer-portal/license-keys/validate with
//     { key, organization_id }. `organization_id` is required precisely so a
//     key issued by one Polar organization cannot validate against another.
//   - Polar states explicitly that an organization may issue several kinds of
//     license key, and that callers offering more than one MUST additionally
//     scope on `benefit_id`. Patina sells exactly one paid benefit, so
//     benefit_id is checked as a hard gate, not an optional refinement.
//   - Activation instances are only required when the benefit sets an
//     activation limit. Patina leaves that unset, so no activation_id is sent
//     and the response's `activation` field is ignored.
//   - Polar carries its own cumulative `limit_usage`/`usage` quota. It is NOT
//     used for metering here: patina's allowance resets on the UTC month
//     boundary (PATINA_PRO_REQ_PER_MONTH) and Polar's counter never resets, so
//     mixing them would silently shorten a paying month.
//
// Fail-closed posture matches the LS module: every failed check returns a
// generic 403 LICENSE_INVALID to the caller, and the specific reason is
// carried only in `detail` for server-side logging. `detail` never contains
// the license key.

import { QUOTA_REASONS } from './web-rewrite-contract.js';

/** Polar's customer-portal validate endpoint (no server credential required). */
export const POLAR_LICENSE_VALIDATE_URL = 'https://api.polar.sh/v1/customer-portal/license-keys/validate';
/** Sandbox counterpart, used for pre-approval integration testing. */
export const POLAR_SANDBOX_LICENSE_VALIDATE_URL = 'https://sandbox-api.polar.sh/v1/customer-portal/license-keys/validate';

/**
 * `license_key.status` values that entitle. Polar grants a key on purchase and
 * revokes it when the subscription ends, so `granted` is the only entitled
 * state; anything else (revoked/disabled) is a denial.
 */
const ENTITLED_STATUSES = new Set(['granted']);

/**
 * Resolve the validate endpoint for the configured environment.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {string}
 */
export function polarValidateUrl(env = {}) {
  return env.POLAR_SERVER === 'sandbox' ? POLAR_SANDBOX_LICENSE_VALIDATE_URL : POLAR_LICENSE_VALIDATE_URL;
}

/**
 * Build the validate request body. The organization ID is server configuration,
 * never caller-supplied, so a request can never be pointed at another org.
 *
 * @param {string} license Raw license key from the Authorization header.
 * @param {Record<string, string|undefined>} [env]
 * @returns {{ok: true, body: {key: string, organization_id: string}}|{ok: false, detail: string}}
 */
export function buildPolarValidateRequest(license, env = {}) {
  const organizationId = env.POLAR_ORGANIZATION_ID;
  if (typeof organizationId !== 'string' || organizationId === '') {
    return { ok: false, detail: 'organization-not-configured' };
  }
  if (typeof license !== 'string' || license === '') {
    return { ok: false, detail: 'license-missing' };
  }
  return { ok: true, body: { key: license, organization_id: organizationId } };
}

/**
 * Pure allow/deny evaluation of a Polar validate response against the
 * configured organization and benefit.
 *
 * Mirrors `evaluateLicenseResponse` in src/entitlement.js: on any failed check
 * the PUBLIC result is a generic 403 LICENSE_INVALID, and the failing check is
 * exposed only through the non-authoritative `detail` field for server-side
 * logging — never returned to the client and never containing the license.
 *
 * @param {any} data Parsed Polar validate response body.
 * @param {Record<string, string|undefined>} [env]
 * @param {number} [now] Epoch ms used to evaluate expiry.
 * @returns {{ok: true, status: string, expiresAt: number|null}|{ok: false, status: 403, reason: string, detail: string}}
 */
export function evaluatePolarLicenseResponse(data, env = {}, now = Date.now()) {
  const deny = (/** @type {string} */ detail) => (
    /** @type {{ok: false, status: 403, reason: string, detail: string}} */ (
      { ok: false, status: 403, reason: QUOTA_REASONS.LICENSE_INVALID, detail }
    )
  );

  if (!data || typeof data !== 'object' || Array.isArray(data)) return deny('malformed-response');

  const status = data.status;
  if (typeof status !== 'string') return deny('status-missing');
  if (!ENTITLED_STATUSES.has(status)) return deny(`status-${status}`);

  // Organization scoping. The request already pins organization_id, but the
  // response is re-checked so a proxy or a future endpoint change cannot widen
  // the gate silently.
  const wantOrganization = env.POLAR_ORGANIZATION_ID;
  if (typeof wantOrganization !== 'string' || wantOrganization === '') return deny('organization-not-configured');
  if (String(data.organization_id) !== String(wantOrganization)) return deny('organization-mismatch');

  // Benefit scoping. Polar warns that one organization can issue several key
  // types; without this, a key from any other benefit in the same org would
  // entitle the paid tier.
  const wantBenefit = env.POLAR_PRO_BENEFIT_ID;
  if (typeof wantBenefit !== 'string' || wantBenefit === '') return deny('benefit-not-configured');
  if (String(data.benefit_id) !== String(wantBenefit)) return deny('benefit-mismatch');

  // Expiry: absent/null entitles (a live subscription has no end date); present
  // must parse to a strictly future instant.
  let expiresAt = /** @type {number|null} */ (null);
  const rawExpiry = data.expires_at;
  if (rawExpiry !== null && rawExpiry !== undefined) {
    const parsed = Date.parse(rawExpiry);
    if (!Number.isFinite(parsed) || !(parsed > now)) return deny('expired');
    expiresAt = parsed;
  }

  return { ok: true, status, expiresAt };
}

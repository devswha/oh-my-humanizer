// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POLAR_LICENSE_VALIDATE_URL,
  POLAR_SANDBOX_LICENSE_VALIDATE_URL,
  buildPolarValidateRequest,
  evaluatePolarLicenseResponse,
  polarValidateUrl,
} from '../../src/entitlement-polar.js';
import { QUOTA_REASONS } from '../../src/web-rewrite-contract.js';

const ORG = 'fda84e25-7b55-4d67-916d-60ead04ff61f';
const BENEFIT = '32a8eda4-56cf-4a94-8228-792d324a519e';
const env = { POLAR_ORGANIZATION_ID: ORG, POLAR_PRO_BENEFIT_ID: BENEFIT };

/** The documented Polar validate response shape (docs, retrieved 2026-07-29). */
function grantedResponse(overrides = {}) {
  return {
    id: '508176f7-065a-4b5d-b524-4e9c8a11ed63',
    organization_id: ORG,
    user_id: 'd910050c-be66-4ca0-b4cc-34fde514f227',
    benefit_id: BENEFIT,
    key: '1C285B2D-6CE6-4BC7-B8BE-ADB6A7E304DA',
    display_key: '****-E304DA',
    status: 'granted',
    limit_activations: null,
    usage: 0,
    limit_usage: null,
    validations: 5,
    last_validated_at: '2026-07-29T13:57:00.977363Z',
    expires_at: null,
    ...overrides,
  };
}

test('a granted key for the configured organization and benefit entitles', () => {
  const result = evaluatePolarLicenseResponse(grantedResponse(), env);
  assert.deepEqual(result, { ok: true, status: 'granted', expiresAt: null });
});

test('a future expiry entitles and is returned; a past or unparseable one denies', () => {
  const now = Date.parse('2026-07-29T00:00:00.000Z');
  const future = evaluatePolarLicenseResponse(grantedResponse({ expires_at: '2026-08-30T08:40:34.769148Z' }), env, now);
  assert.equal(future.ok, true);
  assert.equal(future.ok === true && future.expiresAt, Date.parse('2026-08-30T08:40:34.769148Z'));

  for (const expires_at of ['2026-07-28T23:59:59.000Z', '2026-07-29T00:00:00.000Z', 'not-a-date', '']) {
    const denied = evaluatePolarLicenseResponse(grantedResponse({ expires_at }), env, now);
    assert.equal(denied.ok, false, `${expires_at} must not entitle`);
    assert.equal(denied.ok === false && denied.detail, 'expired');
  }
});

test('every denial is a generic 403 LICENSE_INVALID with the reason only in detail', () => {
  const cases = /** @type {Array<[string, unknown]>} */ ([
    ['malformed-response', undefined],
    ['malformed-response', null],
    ['malformed-response', 'a string'],
    ['malformed-response', []],
    ['status-missing', grantedResponse({ status: undefined })],
    ['status-missing', grantedResponse({ status: 42 })],
    ['status-revoked', grantedResponse({ status: 'revoked' })],
    ['status-disabled', grantedResponse({ status: 'disabled' })],
    ['organization-mismatch', grantedResponse({ organization_id: 'another-org' })],
    ['benefit-mismatch', grantedResponse({ benefit_id: 'another-benefit' })],
  ]);
  for (const [detail, data] of cases) {
    const result = evaluatePolarLicenseResponse(data, env);
    assert.equal(result.ok, false, detail);
    assert.equal(result.ok === false && result.status, 403, detail);
    assert.equal(result.ok === false && result.reason, QUOTA_REASONS.LICENSE_INVALID, detail);
    assert.equal(result.ok === false && result.detail, detail);
  }
});

test('a benefit from the same organization does not entitle the paid tier', () => {
  // Polar warns that one organization can issue several license-key types. A
  // free or unrelated benefit's key validates fine against the org, so the
  // benefit gate is what separates it from the paid tier.
  const otherBenefit = grantedResponse({ benefit_id: 'free-tier-benefit-id' });
  assert.equal(evaluatePolarLicenseResponse(otherBenefit, env).ok, false);
});

test('missing server configuration fails closed rather than skipping a gate', () => {
  for (const partial of [{}, { POLAR_ORGANIZATION_ID: ORG }, { POLAR_PRO_BENEFIT_ID: BENEFIT }, { POLAR_ORGANIZATION_ID: '', POLAR_PRO_BENEFIT_ID: '' }]) {
    const result = evaluatePolarLicenseResponse(grantedResponse(), partial);
    assert.equal(result.ok, false, JSON.stringify(partial));
    assert.equal(result.ok === false && result.status, 403);
  }
});

test('the validate request pins the server-configured organization, never a caller value', () => {
  const built = buildPolarValidateRequest('LICENSE-ABC', env);
  assert.deepEqual(built, { ok: true, body: { key: 'LICENSE-ABC', organization_id: ORG } });
  // No secret is sent: the customer-portal endpoint is unauthenticated.
  assert.deepEqual(Object.keys(built.ok === true ? built.body : {}).sort(), ['key', 'organization_id']);
});

test('the validate request fails closed without configuration or a license', () => {
  assert.deepEqual(buildPolarValidateRequest('LICENSE-ABC', {}), { ok: false, detail: 'organization-not-configured' });
  assert.deepEqual(buildPolarValidateRequest('', env), { ok: false, detail: 'license-missing' });
  assert.deepEqual(buildPolarValidateRequest(/** @type {any} */ (undefined), env), { ok: false, detail: 'license-missing' });
});

test('the sandbox endpoint is opt-in and production is the default', () => {
  assert.equal(polarValidateUrl(), POLAR_LICENSE_VALIDATE_URL);
  assert.equal(polarValidateUrl({}), POLAR_LICENSE_VALIDATE_URL);
  assert.equal(polarValidateUrl({ POLAR_SERVER: 'production' }), POLAR_LICENSE_VALIDATE_URL);
  assert.equal(polarValidateUrl({ POLAR_SERVER: 'sandbox' }), POLAR_SANDBOX_LICENSE_VALIDATE_URL);
  // Both endpoints are HTTPS on a polar.sh host.
  for (const url of [POLAR_LICENSE_VALIDATE_URL, POLAR_SANDBOX_LICENSE_VALIDATE_URL]) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'https:');
    assert.ok(parsed.hostname.endsWith('polar.sh'), url);
  }
});

test('the evaluator never echoes the license key into its result', () => {
  const license = 'SECRET-LICENSE-VALUE';
  const results = [
    evaluatePolarLicenseResponse(grantedResponse({ key: license }), env),
    evaluatePolarLicenseResponse(grantedResponse({ key: license, status: 'revoked' }), env),
  ];
  for (const result of results) {
    assert.equal(JSON.stringify(result).includes(license), false);
  }
});

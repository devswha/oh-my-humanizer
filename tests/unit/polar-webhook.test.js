// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createPolarWebhookHandler, createPolarWebhookStore, polarPurchaseCounterKey, polarWebhookDedupeDigest } from '../../api/polar-webhook.js';
import { isPolarInitialPaidOrder, polarWebhookEventTime, PolarWebhookError, verifyPolarWebhook } from '../../src/polar-webhook.js';

const secret = 'polar-webhook-test-secret';
const now = new Date('2026-08-18T12:00:00.000Z');
const event = { type: 'order.paid', timestamp: '2026-08-17T23:45:00.000Z', data: { product_id: 'product_pro', product: { id: 'product_pro', organization_id: 'org_patina' }, status: 'paid', billing_reason: 'subscription_create', total_amount: 999, currency: 'usd', customer: { email: 'person@example.test' }, id: 'order_private' } };

function signature(id, timestamp, body, key = secret) {
  return createHmac('sha256', key).update(`${id}.${timestamp}.`).update(body).digest('base64');
}

function signedRequest({ body = JSON.stringify(event), id = 'msg_abcdefgh1234', timestamp = String(Math.floor(now.getTime() / 1000)), headers = {}, method = 'POST' } = {}) {
  return {
    method,
    body,
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': timestamp,
      'webhook-signature': `v1,${signature(id, timestamp, body)}`,
      ...headers,
    },
  };
}

function response() {
  const headers = new Map();
  const chunks = [];
  return { statusCode: 200, headers, chunks, setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); }, end(value) { if (value !== undefined) chunks.push(String(value)); } };
}

const env = { POLAR_WEBHOOK_SECRET: secret, POLAR_ORGANIZATION_ID: 'org_patina', POLAR_PRO_PRODUCT_ID: 'product_pro' };

test('Standard Webhooks verification accepts valid and multiple v1 signatures only', () => {
  const body = JSON.stringify(event);
  const id = 'msg_abcdefgh1234';
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const headers = { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': [`v1,${Buffer.alloc(32).toString('base64')}`, `v1,${signature(id, timestamp, body)}`] };
  assert.deepEqual(verifyPolarWebhook(body, headers, { secret, now }), event);
  assert.deepEqual(verifyPolarWebhook(body, { ...headers, 'webhook-signature': `v2,ignored v1,${signature(id, timestamp, body)}` }, { secret, now }), event);
  assert.throws(() => verifyPolarWebhook(`${body} `, headers, { secret, now }), (error) => error instanceof PolarWebhookError && error.code === 'signature');
  assert.throws(() => verifyPolarWebhook(body, { ...headers, 'webhook-timestamp': String(Math.floor(now.getTime() / 1000) - 301) }, { secret, now }), /invalid webhook signature/);
  assert.throws(() => verifyPolarWebhook(body, { ...headers, 'webhook-timestamp': String(Math.floor(now.getTime() / 1000) + 301) }, { secret, now }), /invalid webhook signature/);
  assert.throws(() => verifyPolarWebhook('{', { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature(id, timestamp, '{')}` }, { secret, now }), /malformed webhook/);
  assert.throws(() => verifyPolarWebhook(body, { 'webhook-id': '../../unsafe', 'webhook-timestamp': timestamp, 'webhook-signature': 'v1,not-base64' }, { secret, now }), /malformed webhook/);
});

test('only exact initial paid Polar orders are aggregation targets', () => {
  assert.equal(isPolarInitialPaidOrder(event, { organizationId: 'org_patina', productId: 'product_pro' }), true);
  for (const patch of [
    { product_id: 'product_other' }, { status: 'pending' },
    { billing_reason: 'subscription_cycle' }, { billing_reason: 'subscription_update' },
    { total_amount: 0 }, { total_amount: -1 }, { currency: 'eur' },
  ]) {
    assert.equal(isPolarInitialPaidOrder({ ...event, data: { ...event.data, ...patch } }, { organizationId: 'org_patina', productId: 'product_pro' }), false);
  }
  assert.equal(isPolarInitialPaidOrder({ ...event, data: { ...event.data, product: { ...event.data.product, organization_id: 'org_other' } } }, { organizationId: 'org_patina', productId: 'product_pro' }), false);
  assert.equal(isPolarInitialPaidOrder({ ...event, data: { ...event.data, product: { ...event.data.product, id: 'product_other' } } }, { organizationId: 'org_patina', productId: 'product_pro' }), false);
  assert.equal(isPolarInitialPaidOrder({ ...event, timestamp: 'invalid' }, { organizationId: 'org_patina', productId: 'product_pro' }), false);
  assert.equal(polarWebhookEventTime(event)?.toISOString(), event.timestamp);
  assert.equal(isPolarInitialPaidOrder({ ...event, type: 'order.created' }, { organizationId: 'org_patina', productId: 'product_pro' }), false);
  assert.equal(isPolarInitialPaidOrder({ ...event, data: { ...event.data, billing_reason: 'purchase' } }, { organizationId: 'org_patina', productId: 'product_pro' }), true);
});

test('webhook endpoint fails closed and has empty status responses', async () => {
  const store = { calls: [], async incrementOnce(...args) { this.calls.push(args); return true; } };
  const handler = createPolarWebhookHandler({ env, store, now: () => now });
  for (const [request, expected] of [
    [signedRequest({ method: 'GET' }), 405], [signedRequest({ headers: { 'content-type': 'text/plain' } }), 400],
    [signedRequest({ body: 'x'.repeat(64 * 1024 + 1) }), 413], [signedRequest({ headers: { 'webhook-signature': 'v1,invalid' } }), 400],
    [signedRequest({ headers: { 'webhook-signature': `v1,${Buffer.alloc(32).toString('base64')}` } }), 403],
  ]) {
    const res = response(); await handler(request, res); assert.equal(res.statusCode, expected); assert.deepEqual(res.chunks, []);
  }
  const missing = createPolarWebhookHandler({ env: {}, store, now: () => now });
  const missingResponse = response(); await missing(signedRequest(), missingResponse); assert.equal(missingResponse.statusCode, 503);
  const unavailable = createPolarWebhookHandler({ env, store: null, now: () => now });
  const unavailableResponse = response(); await unavailable(signedRequest(), unavailableResponse); assert.equal(unavailableResponse.statusCode, 503);
  const failing = createPolarWebhookHandler({ env, store: { incrementOnce: async () => { throw new Error('offline'); } }, now: () => now });
  const failingResponse = response(); await failing(signedRequest(), failingResponse); assert.equal(failingResponse.statusCode, 503);
});

test('target first delivery increments once while duplicates and non-targets do not', async () => {
  const calls = [];
  const handler = createPolarWebhookHandler({ env, now: () => now, store: { incrementOnce: async (...args) => { calls.push(args); return calls.length === 1; } } });
  const first = response(); await handler(signedRequest(), first); assert.equal(first.statusCode, 202);
  const duplicate = response(); await handler(signedRequest(), duplicate); assert.equal(duplicate.statusCode, 202);
  const nonTarget = response(); await handler(signedRequest({ body: JSON.stringify({ ...event, data: { ...event.data, billing_reason: 'subscription_cycle' } }) }), nonTarget); assert.equal(nonTarget.statusCode, 204);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], polarWebhookDedupeDigest('msg_abcdefgh1234', secret));
  assert.equal(calls[0][1], 'patina:funnel:v1:2026-08-17:purchase-completed:provider=polar');
  assert.deepEqual(first.chunks, []);
});

test('parsed Vercel JSON bodies are re-serialized and still require an exact signature', async () => {
  const calls = [];
  const handler = createPolarWebhookHandler({ env, now: () => now, store: { incrementOnce: async (...args) => { calls.push(args); return true; } } });
  const body = JSON.stringify(event);
  const request = /** @type {any} */ (signedRequest({ body }));
  request.body = event;
  const accepted = response();
  await handler(request, accepted);
  assert.equal(accepted.statusCode, 202);
  assert.equal(calls.length, 1);

  request.body = { ...event, type: 'order.created' };
  const rejected = response();
  await handler(request, rejected);
  assert.equal(rejected.statusCode, 403);
});

test('Upstash command stores only a stable HMAC delivery digest and aggregate counter', async () => {
  const calls = [];
  const store = createPolarWebhookStore({ PATINA_OBSERVABILITY_REST_API_URL: 'https://observability.upstash.io/', PATINA_OBSERVABILITY_REST_API_TOKEN: 'token' }, async (...args) => {
    calls.push(args); return /** @type {any} */ ({ ok: true, json: async () => ({ result: 1 }) });
  });
  assert.ok(store);
  const id = 'msg_no_raw_storage';
  const digest = polarWebhookDedupeDigest(id, secret);
  assert.equal(digest, polarWebhookDedupeDigest(id, secret));
  assert.notEqual(digest, id);
  await store.incrementOnce(digest, polarPurchaseCounterKey(now));
  const command = JSON.parse(calls[0][1].body);
  assert.equal(command[0], 'EVAL');
  assert.match(command[3], new RegExp(`${digest}$`));
  assert.ok(command.every((item) => !String(item).includes(id) && !String(item).includes('person@example.test') && !String(item).includes('order_private')));
});

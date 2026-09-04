import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createMemoryKv, createRateLimiter } from '../../src/rate-limit.js';
import { createRewriteHandler } from '../../src/rewrite-handler.js';
import { TIER_LIMITS } from '../../src/web-rewrite-contract.js';

function setup(overrides = {}) {
  let time = Date.UTC(2026, 8, 4, 12);
  const now = () => time;
  const kv = createMemoryKv({ now });
  const limits = { ...TIER_LIMITS, pro: { ...TIER_LIMITS.pro, reqPerDay: 10, reqPerMonth: 2, charsPerMonth: 1000, ...overrides } };
  const limiter = createRateLimiter({ kv, hmacSecret: 'test-secret', now, limits });
  const check = (requestId, chars = 100) => limiter.check({ tier: 'pro', subject: 'subject', requestId, chars });
  return { kv, limiter, check, advance(value) { time = value; } };
}

test('failed rewrite restores allowance exactly once while attempts remain counted', async () => {
  const { kv, limiter, check } = setup();
  const first = await check('one'); assert.equal(first.allowed, true);
  const plan = first.reservation;
  assert.deepEqual(await Promise.all(plan.keys.slice(0, 4).map((key) => kv.get(key))), [1, 1, 100, 1]);
  assert.equal(await limiter.settleReservation({ reservation: plan, refund: true }), true);
  assert.equal(await limiter.settleReservation({ reservation: plan, refund: true }), true);
  assert.deepEqual(await Promise.all(plan.keys.slice(0, 4).map((key) => kv.get(key))), [0, 0, 0, 1]);
  assert.equal((await check('two')).allowed, true);
  assert.equal((await check('three')).allowed, true);
  assert.equal((await check('four')).allowed, false);
});

test('successful settlement cannot later be changed to a refund', async () => {
  const { kv, limiter, check } = setup();
  const first = await check('one');
  assert.equal(await limiter.settleReservation({ reservation: first.reservation, refund: false }), true);
  assert.equal(await limiter.settleReservation({ reservation: first.reservation, refund: true }), false);
  assert.equal(await kv.get(first.reservation.keys[1]), 1);
});

test('reservation retries are idempotent but settled nonces cannot buy another call', async () => {
  const { kv, limiter, check } = setup();
  const first = await check('one'); const retry = await check('one');
  assert.deepEqual(retry, first);
  assert.equal(await kv.get(first.reservation.keys[3]), 1);
  await limiter.settleReservation({ reservation: first.reservation, refund: true });
  assert.equal((await check('one')).allowed, false);
  assert.equal(await kv.get(first.reservation.keys[3]), 1);
});

test('a conflicting nonce retry cannot refund an earlier admitted request', async () => {
  const { kv, check } = setup();
  const original = await check('one', 100);
  assert.equal((await check('one', 200)).allowed, false);
  assert.deepEqual(await Promise.all(original.reservation.keys.slice(0, 4).map((key) => kv.get(key))), [1, 1, 100, 1]);
});

test('all-failing input exhausts the independent processing budget without losing allowance', async () => {
  const { kv, limiter, check } = setup();
  let plan;
  for (let i = 0; i < 4; i++) {
    const result = await check(`request-${i}`); assert.equal(result.allowed, true); plan = result.reservation;
    await limiter.settleReservation({ reservation: plan, refund: true });
  }
  const denied = await check('five');
  assert.equal(denied.allowed, false); assert.match(denied.reason, /processing attempt/);
  assert.deepEqual(await Promise.all(plan.keys.slice(0, 4).map((key) => kv.get(key))), [0, 0, 0, 4]);
});

test('concurrent admission never overbooks monthly request or character capacity', async () => {
  const { kv, check } = setup();
  const rows = await Promise.all(Array.from({ length: 20 }, (_, i) => check(`parallel-${i}`, 400)));
  const allowed = rows.filter((row) => row.allowed);
  assert.equal(allowed.length, 2);
  assert.deepEqual(await Promise.all(allowed[0].reservation.keys.slice(0, 4).map((key) => kv.get(key))), [2, 2, 800, 2]);
});

test('refund at a UTC rollover never recreates an expired counter or credits the new bucket', async () => {
  const { kv, limiter, check, advance } = setup();
  advance(Date.UTC(2026, 8, 30, 23, 59, 59));
  const previous = await check('previous', 100);
  advance(Date.UTC(2026, 9, 1, 0, 0, 1));
  const current = await check('current', 200);
  assert.equal(await limiter.settleReservation({ reservation: previous.reservation, refund: true }), true);
  assert.equal(await kv.get(previous.reservation.keys[0]), undefined);
  assert.equal(await kv.get(previous.reservation.keys[1]), undefined);
  assert.deepEqual(await Promise.all(current.reservation.keys.slice(0, 4).map((key) => kv.get(key))), [1, 1, 200, 1]);
});

test('corrupted storage fails closed before partial refunds', async () => {
  const { kv, limiter, check } = setup();
  const result = await check('one'); const plan = result.reservation;
  await kv.set(plan.keys[2], 'corrupt');
  assert.equal(await limiter.settleReservation({ reservation: plan, refund: true }), false);
  assert.equal(await kv.get(plan.keys[0]), 1); assert.equal(await kv.get(plan.keys[1]), 1);
});

test('unknown reservation response is compensated before rejecting the request', async () => {
  const { kv } = setup(); const reserve = kv.reserveQuota.bind(kv);
  let saved;
  kv.reserveQuota = async (plan) => { saved = plan; await reserve(plan); throw new Error('lost acknowledgement'); };
  const limiter = createRateLimiter({ kv, hmacSecret: 'secret' });
  const result = await limiter.check({ tier: 'pro', subject: 'subject', requestId: 'one', chars: 10 });
  assert.equal(result.allowed, false);
  assert.deepEqual(await Promise.all(saved.keys.slice(0, 4).map((key) => kv.get(key))), [0, 0, 0, 1]);
});

test('handler refunds a trusted safety failure before response end and settles once', async () => {
  const { kv, limiter } = setup(); let plan;
  const original = limiter.check.bind(limiter);
  limiter.check = async (input) => { const result = await original(input); plan = result.reservation; return result; };
  const res = { statusCode: 200, setHeader() {}, end() {} };
  const handler = createRewriteHandler({ rateLimiter: limiter,
    licenseValidator: { async validate() { return { ok: true, subject: 'subject', tier: 'pro', status: 'active', cache: 'miss' }; } },
    runRewrite: async ({ beforeResponseEnd }) => {
      await beforeResponseEnd({ ok: false, code: 'number_safety_failed' });
      assert.equal(await kv.get(plan.keys[1]), 0);
      return { ok: false, code: 'number_safety_failed' };
    } });
  await handler({ method: 'POST', headers: { authorization: 'Bearer test-license', 'x-real-ip': '203.0.113.1' }, body: { mode: 'first', tier: 'pro', lang: 'en', text: 'There are 12 updates.' } }, res);
  assert.equal(await kv.get(plan.keys[1]), 0); assert.equal(await kv.get(plan.keys[3]), 1);
});

test('a disconnect during admission does not start a runner or masquerade as a refundable server failure', async () => {
  const { kv, limiter } = setup();
  const req = Object.assign(new EventEmitter(), { method: 'POST', headers: { authorization: 'Bearer test-license', 'x-real-ip': '203.0.113.1' }, body: { mode: 'first', tier: 'pro', lang: 'en', text: 'There are 12 updates.' } });
  const res = Object.assign(new EventEmitter(), { statusCode: 200, setHeader() {}, end() {} });
  const check = limiter.check.bind(limiter); let plan; let ran = false;
  limiter.check = async (input) => { const result = await check(input); plan = result.reservation; req.emit('aborted'); return result; };
  const handler = createRewriteHandler({ rateLimiter: limiter,
    licenseValidator: { async validate() { return { ok: true, subject: 'subject', tier: 'pro', status: 'active', cache: 'miss' }; } },
    runRewrite() { ran = true; return { ok: false, code: 'stream_failed' }; } });
  await handler(req, res);
  assert.equal(ran, false);
  assert.equal(await kv.get(plan.keys[1]), 1);
  assert.equal(req.listenerCount('aborted'), 0); assert.equal(res.listenerCount('close'), 0);
});

test('asynchronous settlement diagnostics cannot escape the response boundary', async () => {
  const { kv, check } = setup(); const result = await check('one');
  kv.settleQuota = async () => { throw new Error('store unavailable'); };
  const limiter = createRateLimiter({ kv, logger: { async warn() { throw new Error('logger unavailable'); } } });
  assert.equal(await limiter.settleReservation({ reservation: result.reservation, refund: true }), false);
  await new Promise((resolve) => setTimeout(resolve, 0));
});

// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { FUNNEL_PROGRESS_SCHEMA, funnelCounterKey, validateFunnelEvent } from '../../src/funnel-analytics.js';
import { createFunnelAggregateStore, createFunnelApiHandler } from '../../api/funnel.js';

const validEvent = { name: 'Rewrite Completed', data: { surface: 'hero', lang: 'en', tier: 'free', mode: 'first', inputBucket: '100-499', latencyBucket: '5-10s', mpsBand: '80-89', fidelityBand: '90-100' } };

function request({ method = 'POST', body = JSON.stringify(validEvent), headers = {} } = {}) {
  return {
    method,
    body,
    headers: {
      origin: 'https://app.example.test',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'app.example.test',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      ...headers,
    },
  };
}

function response() {
  const headers = new Map();
  const chunks = [];
  return {
    statusCode: 200,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    end(value) { if (value !== undefined) chunks.push(String(value)); this.ended = true; },
    headers,
    chunks,
  };
}

test('funnel schema accepts every complete categorical event and rejects incomplete or extra shapes', () => {
  const events = [
    { name: 'Funnel Progress', data: { lang: 'ko', channel: 'github', campaign: 'multilingual-20260907', stage: 'arrival' } },
    { name: 'Input Started', data: { surface: 'chat', lang: 'ko' } },
    { name: 'Rewrite Requested', data: { surface: 'hero', lang: 'zh', tier: 'byok', mode: 'refine', inputBucket: '2000+' } },
    validEvent,
    { name: 'Rewrite Failed', data: { surface: 'chat', lang: 'ja', tier: 'pro', mode: 'first', inputBucket: '0-99', latencyBucket: '30s+', outcome: 'concurrency' } },
    { name: 'Result Action', data: { action: 'audit' } },
    { name: 'Checkout Started', data: { surface: 'quota', lang: 'en' } },
    { name: 'Tier Selected', data: { tier: 'free', surface: 'controls' } },
  ];
  for (const event of events) assert.equal(validateFunnelEvent(event), true, event.name);
  assert.equal(validateFunnelEvent({ name: 'Input Started', data: { surface: 'hero' } }), false);
  assert.equal(validateFunnelEvent({ name: 'Input Started', data: { surface: 'hero', lang: 'en', extra: 'x' } }), false);
  assert.equal(validateFunnelEvent({ name: 'Unknown', data: {} }), false);
  assert.equal(validateFunnelEvent({ name: 'toString', data: {} }), false);
  assert.equal(validateFunnelEvent({ name: 'Result Action', data: { action: 'share' } }), false);
  for (const outcome of ['preflight', 'stream', 'number-safety', 'scoring', 'floor', 'cancelled', 'quota', 'concurrency', 'service', 'input', 'auth', 'unknown']) {
    assert.equal(validateFunnelEvent({ name: 'Rewrite Failed', data: { surface: 'hero', lang: 'en', tier: 'free', mode: 'first', inputBucket: '0-99', latencyBucket: '<5s', outcome } }), true, outcome);
  }
});

test('funnel schema rejects all free-form and contextual fields', () => {
  for (const field of ['text', 'content', 'input', 'ip', 'session', 'user', 'url', 'referrer', 'utm', 'model', 'provider', 'hash', 'receipt', 'email', 'token']) {
    assert.equal(validateFunnelEvent({ ...validEvent, data: { ...validEvent.data, [field]: 'customer-or-context-data' } }), false, field);
  }
  assert.equal(validateFunnelEvent({ name: 'Rewrite Requested', data: { ...validEvent.data, inputBucket: 'arbitrary customer text' } }), false);
});

test('funnel key is UTC-day deterministic, sorted, and contains no prohibited data', () => {
  const event = /** @type {const} */ ({ name: 'Input Started', data: { lang: 'en', surface: 'hero' } });
  const key = funnelCounterKey(event, '2026-08-18T00:30:00+09:00');
  assert.equal(key, 'patina:funnel:v1:2026-08-17:input-started:lang=en:surface=hero');
  for (const forbidden of ['ip', 'session', 'user', 'url', 'referrer', 'utm', 'model', 'provider', 'hash', 'receipt']) assert.doesNotMatch(key, new RegExp(forbidden, 'i'));
  assert.throws(() => funnelCounterKey({ name: 'Input Started', data: { surface: 'hero', lang: 'en', url: 'https://example.test' } }, new Date()), /invalid funnel event/);
});

test('funnel endpoint rejects invalid method, body, origin, fetch-site, and oversized requests', async () => {
  const handler = createFunnelApiHandler({ aggregateStore: { increment() { throw new Error('must not store'); } } });
  for (const [input, expected] of [
    [request({ method: 'GET' }), 405],
    [request({ body: '{' }), 400],
    [request({ headers: { origin: 'https://other.example.test' } }), 403],
    [request({ headers: { 'sec-fetch-site': 'cross-site' } }), 403],
    [request({ body: 'x'.repeat(4097) }), 413],
  ]) {
    const res = response();
    await handler(input, res);
    assert.equal(res.statusCode, expected);
  }
});

test('production funnel intake accepts only configured deployment hosts', async () => {
  const calls = [];
  const env = { VERCEL: '1', VERCEL_URL: 'app.example.test' };
  const handler = createFunnelApiHandler({
    env,
    aggregateStore: { increment: async () => { calls.push('stored'); } },
  });
  const allowed = response();
  await handler(request(), allowed);
  assert.equal(allowed.statusCode, 204);
  assert.deepEqual(calls, ['stored']);

  const rejected = response();
  await handler(request({ headers: {
    origin: 'https://preview.example.test',
    'x-forwarded-host': 'preview.example.test',
  } }), rejected);
  assert.equal(rejected.statusCode, 403);
  assert.deepEqual(calls, ['stored']);
});

test('aggregate store enforces one bounded UTC-day spend counter', async () => {
  const calls = [];
  const env = {
    PATINA_OBSERVABILITY_REST_API_URL: 'https://example.upstash.io/',
    PATINA_OBSERVABILITY_REST_API_TOKEN: 'secret',
    PATINA_FUNNEL_EVENTS_PER_DAY: '123',
  };
  const store = createFunnelAggregateStore(env, async (...args) => {
    calls.push(args);
    return /** @type {any} */ ({ ok: true, json: async () => ({ result: 1 }) });
  });
  assert.ok(store);
  const key = 'patina:funnel:v1:2026-08-18:input-started:lang=en:surface=hero';
  await store.increment(key, { ttlSeconds: 60 });
  const command = JSON.parse(calls[0][1].body);
  assert.equal(command[0], 'EVAL');
  assert.equal(typeof command[1], 'string');
  assert.deepEqual(command.slice(2), ['2', 'patina:funnel:v1:2026-08-18:budget', key, '1', '60000', '123']);

  const capped = createFunnelAggregateStore(env, async () => (
    /** @type {any} */ ({ ok: true, json: async () => ({ result: -1 }) })
  ));
  assert.ok(capped);
  await assert.rejects(
    capped.increment(key, { ttlSeconds: 60 }),
    (error) => /** @type {any} */ (error)?.code === 'FUNNEL_DAILY_LIMIT',
  );
});

test('funnel endpoint fails closed on unavailable storage and increments exactly one aggregate counter', async () => {
  const unavailable = createFunnelApiHandler({ aggregateStore: null });
  const unavailableResponse = response();
  await unavailable(request(), unavailableResponse);
  assert.equal(unavailableResponse.statusCode, 503);

  const calls = [];
  const handler = createFunnelApiHandler({
    now: () => new Date('2026-08-18T12:00:00.000Z'),
    aggregateStore: { increment: async (key, options) => { calls.push({ key, options }); } },
  });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.chunks.length, 0);
  assert.deepEqual(calls, [{
    key: 'patina:funnel:v1:2026-08-18:rewrite-completed:fidelityBand=90-100:inputBucket=100-499:lang=en:latencyBucket=5-10s:mode=first:mpsBand=80-89:surface=hero:tier=free',
    options: { ttlSeconds: 35 * 24 * 60 * 60 },
  }]);
});

test('funnel endpoint returns 503 when aggregate storage fails', async () => {
  const handler = createFunnelApiHandler({ aggregateStore: { increment: async () => { throw new Error('offline'); } } });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.chunks.length, 0);

  const limited = createFunnelApiHandler({
    aggregateStore: {
      increment: async () => {
        const error = /** @type {Error & {code: string}} */ (new Error('limit'));
        error.code = 'FUNNEL_DAILY_LIMIT';
        throw error;
      },
    },
  });
  const limitedResponse = response();
  await limited(request(), limitedResponse);
  assert.equal(limitedResponse.statusCode, 429);
});

const progressEvent = /** @type {const} */ ({ name: 'Funnel Progress', data: {
  lang: 'ja', channel: 'community', campaign: 'multilingual-20260907', stage: 'reuse',
} });

test('milestone schema is exact, immutable and bounded independently of rewrite dimensions', () => {
  assert.equal(Object.isFrozen(FUNNEL_PROGRESS_SCHEMA), true);
  let cardinality = 1;
  for (const [field, allowed] of Object.entries(FUNNEL_PROGRESS_SCHEMA)) {
    assert.equal(Object.isFrozen(allowed), true);
    cardinality *= allowed.length;
    for (const invalid of ['', 'customer-123', 'https://private.test', 'sk_secret', 'user@example.test', 1, null, {}, []]) {
      assert.equal(validateFunnelEvent({ ...progressEvent, data: { ...progressEvent.data, [field]: invalid } }), false);
    }
    const missing = { ...progressEvent.data };
    delete missing[field];
    assert.equal(validateFunnelEvent({ ...progressEvent, data: missing }), false);
  }
  assert.equal(cardinality, 120);
  for (const field of ['utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'text', 'input', 'output', 'ip', 'id', 'session', 'pageId', 'user', 'url', 'referrer', 'token', 'key', 'hash', 'timestamp', 'surface', 'mode', 'tier']) {
    assert.equal(validateFunnelEvent({ ...progressEvent, data: { ...progressEvent.data, [field]: 'private' } }), false, field);
    assert.equal(validateFunnelEvent({ ...progressEvent, [field]: 'private' }), false, field);
  }
  // Detailed legacy events cannot receive attribution or change their key shape.
  for (const field of ['channel', 'campaign', 'stage']) {
    assert.equal(validateFunnelEvent({ ...validEvent, data: { ...validEvent.data, [field]: progressEvent.data[field] } }), false);
  }
});

test('milestone intake stores only one categorical UTC-day counter, even with sensitive request headers', async () => {
  const calls = [];
  const handler = createFunnelApiHandler({
    now: () => '2026-09-07T00:00:00+09:00',
    aggregateStore: { increment(key, options) { calls.push({ key, options }); } },
  });
  const res = response();
  await handler(request({ body: JSON.stringify(progressEvent), headers: {
    'x-forwarded-for': '192.0.2.42', cookie: 'session=private',
    authorization: 'Bearer private-license', referer: 'https://private.test/draft?key=secret',
    'user-agent': 'fingerprint-canary',
  } }), res);
  assert.equal(res.statusCode, 204);
  assert.deepEqual(calls, [{
    key: 'patina:funnel:v1:2026-09-06:funnel-progress:campaign=multilingual-20260907:channel=community:lang=ja:stage=reuse',
    options: { ttlSeconds: 35 * 24 * 60 * 60 },
  }]);
  assert.deepEqual(res.chunks, []);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(JSON.stringify(calls), /192\.0\.2|private|secret|fingerprint|cookie|authorization|referer|https?:/);
});

test('invalid milestone payloads fail before storage and cannot grow aggregate cardinality', async () => {
  let calls = 0;
  const handler = createFunnelApiHandler({ aggregateStore: { increment() { calls += 1; } } });
  for (let i = 0; i < 200; i++) {
    const res = response();
    await handler(request({ body: JSON.stringify({ ...progressEvent, data: { ...progressEvent.data, campaign: `customer-${i}` } }) }), res);
    assert.equal(res.statusCode, 400);
  }
  for (const data of [{ ...progressEvent.data, utm_source: 'secret' }, { ...progressEvent.data, channel: 'https://private.test' }]) {
    const res = response();
    await handler(request({ body: JSON.stringify({ ...progressEvent, data }) }), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(calls, 0);
});

test('milestones share the existing atomic daily budget, TTL and fail-closed storage behavior', async () => {
  const env = {
    PATINA_OBSERVABILITY_REST_API_URL: 'https://example.upstash.io',
    PATINA_OBSERVABILITY_REST_API_TOKEN: 'fake-secret',
    PATINA_FUNNEL_EVENTS_PER_DAY: '2',
  };
  const commands = [];
  let now = '2026-09-07T23:59:59Z';
  const handler = createFunnelApiHandler({ env, now: () => now, fetchImpl: async (_url, options) => {
    commands.push(JSON.parse(/** @type {string} */ (options.body)));
    return /** @type {any} */ ({ ok: true, json: async () => ({ result: commands.length > 2 ? -1 : 1 }) });
  } });
  for (const [event, status] of [[validEvent, 204], [progressEvent, 204], [progressEvent, 429]]) {
    const res = response();
    await handler(request({ body: JSON.stringify(event) }), res);
    assert.equal(res.statusCode, status);
    assert.deepEqual(res.chunks, []);
  }
  for (const command of commands) {
    assert.equal(command[0], 'EVAL');
    assert.deepEqual(command.slice(2, 4), ['2', 'patina:funnel:v1:2026-09-07:budget']);
    assert.deepEqual(command.slice(5), ['1', String(35 * 24 * 60 * 60 * 1000), '2']);
  }
  now = '2026-09-08T00:00:00Z';
  await handler(request({ body: JSON.stringify(progressEvent) }), response());
  assert.equal(commands[3][3], 'patina:funnel:v1:2026-09-08:budget');
  for (const fetchImpl of [
    async () => { throw new Error('private transport context'); },
    async () => (/** @type {any} */ ({ ok: false })),
    async () => (/** @type {any} */ ({ ok: true, json: async () => ({ result: '1' }) })),
  ]) {
    const res = response();
    await createFunnelApiHandler({ env, fetchImpl })(request({ body: JSON.stringify(progressEvent) }), res);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.chunks, []);
  }
  const res = response();
  await createFunnelApiHandler({ aggregateStore: null })(request({ body: JSON.stringify(progressEvent) }), res);
  assert.equal(res.statusCode, 503);
});

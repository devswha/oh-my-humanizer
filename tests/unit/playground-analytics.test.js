import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const analytics = readFileSync(join(root, 'playground', 'analytics.js'), 'utf8');
const index = readFileSync(join(root, 'playground', 'index.html'), 'utf8');
const controller = readFileSync(join(root, 'playground', 'chatgpt.js'), 'utf8');

function adapter({ fetch } = {}) {
  const window = { fetch };
  vm.runInNewContext(analytics, { window, Set, Object, Array });
  return window;
}

test('analytics adapter sends the complete allowlisted event body with exact request options', () => {
  const calls = [];
  const window = adapter({
    fetch: (...args) => {
      calls.push(args);
      return Promise.resolve();
    },
  });

  window.patinaTrack('Rewrite Completed', {
    surface: 'hero', lang: 'ko', tier: 'pro', mode: 'first', inputBucket: '500-1999',
    latencyBucket: '5-10s', mpsBand: '90-100', fidelityBand: '80-89',
  });

  assert.deepEqual(JSON.parse(calls[0][1].body), {
    name: 'Rewrite Completed',
    data: {
      surface: 'hero', lang: 'ko', tier: 'pro', mode: 'first', inputBucket: '500-1999',
      latencyBucket: '5-10s', mpsBand: '90-100', fidelityBand: '80-89',
    },
  });
  const { body: _body, ...requestOptions } = calls[0][1];
  assert.deepEqual(JSON.parse(JSON.stringify(requestOptions)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    keepalive: true,
  });
});

test('analytics adapter sends failure categories through the same fixed envelope', () => {
  const calls = [];
  const window = adapter({
    fetch: (...args) => {
      calls.push(args);
      return Promise.resolve();
    },
  });

  window.patinaTrack('Rewrite Failed', {
    surface: 'hero', lang: 'en', tier: 'free', mode: 'first', inputBucket: '0-99',
    latencyBucket: '<5s', outcome: 'concurrency',
  });

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[
    '/api/funnel',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"Rewrite Failed","data":{"surface":"hero","lang":"en","tier":"free","mode":"first","inputBucket":"0-99","latencyBucket":"<5s","outcome":"concurrency"}}',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
    },
  ]]);
});

test('analytics adapter rejects unknown, incomplete, extra, invalid, and free-form calls', () => {
  const calls = [];
  const window = adapter({
    fetch: (...args) => {
      calls.push(args);
      return Promise.resolve();
    },
  });

  window.patinaTrack('Purchase Completed', { tier: 'pro' });
  window.patinaTrack('Rewrite Requested', { surface: 'hero', lang: 'ko', tier: 'pro', mode: 'first' });
  window.patinaTrack('Rewrite Requested', { surface: 'hero', lang: 'ko', tier: 'pro', mode: 'first', inputBucket: '500-1999', text: 'customer draft' });
  window.patinaTrack('Rewrite Requested', { text: 'customer draft', url: 'https://example.test', apiKey: 'sk_live_secret' });
  window.patinaTrack('Rewrite Requested', { surface: 'hero', lang: 'Korean prose', tier: 'pro', mode: 'first', inputBucket: '500-1999' });

  assert.deepEqual(calls, []);
});

test('analytics adapter isolates fetch exceptions', () => {
  const fetchWindow = adapter({
    fetch: () => { throw new Error('fetch unavailable'); },
  });
  const rejectedFetchWindow = adapter({
    fetch: () => Promise.reject(new Error('network unavailable')),
  });

  assert.doesNotThrow(() => fetchWindow.patinaTrack('Input Started', { surface: 'hero', lang: 'en' }));
  assert.doesNotThrow(() => rejectedFetchWindow.patinaTrack('Input Started', { surface: 'hero', lang: 'en' }));
});

test('analytics adapter allows each added Rewrite Failed outcome', () => {
  const calls = [];
  const window = adapter({
    fetch: (...args) => {
      calls.push(args);
      return Promise.resolve();
    },
  });

  for (const outcome of ['quota', 'concurrency', 'service', 'input', 'auth']) {
    window.patinaTrack('Rewrite Failed', {
      surface: 'hero', lang: 'en', tier: 'free', mode: 'first', inputBucket: '0-99',
      latencyBucket: '<5s', outcome,
    });
  }

  assert.equal(calls.length, 5);
});

test('analytics body contains no prohibited fields or free-form values', () => {
  const calls = [];
  const window = adapter({
    fetch: (...args) => {
      calls.push(args);
      return Promise.resolve();
    },
  });

  window.patinaTrack('Rewrite Requested', {
    surface: 'hero', lang: 'en', tier: 'pro', mode: 'first', inputBucket: '500-1999',
  });

  const body = calls[0][1].body;
  assert.doesNotMatch(body, /\b(?:url|query|referrer|user|session|utm|model|provider|hash|receipt|text|key|license)\b/i);
  assert.doesNotMatch(body, /customer draft|sk_live_secret|https?:/);
});

test('only the application-owned analytics script loads before the application module', () => {
  const adapterScript = index.indexOf('<script src="/analytics.js"></script>');
  const appScript = index.indexOf('<script type="module" src="/chatgpt.js"></script>');
  assert.ok(adapterScript >= 0 && adapterScript < appScript);
  assert.doesNotMatch(index, /_vercel\/insights|@vercel\/analytics/i);
});

test('controller wires the complete aggregate funnel without Purchase Completed or telemetry payloads', () => {
  for (const event of ['Input Started', 'Rewrite Requested', 'Rewrite Completed', 'Rewrite Failed', 'Result Action', 'Checkout Started', 'Tier Selected']) {
    assert.match(controller, new RegExp(`track\\('${event}'`));
  }
  assert.doesNotMatch(controller, /track\('Purchase Completed'/);
  assert.match(controller, /function inputBucket\(length\)/);
  assert.match(controller, /function latencyBucket\(startedAt\)/);
  assert.match(controller, /function scoreBand\(score\)/);
  assert.match(controller, /track\('Result Action', \{ action: 'audit' \}\)/);
  assert.match(controller, /track\('Checkout Started', \{ surface: 'pricing', lang: els\.lang\.value \}\)/);
  assert.match(controller, /track\('Checkout Started', \{ surface: 'quota', lang: els\.lang\.value \}\)/);
  const trackingLines = controller.split('\n').filter((line) => line.includes('track(')).join('\n');
  assert.doesNotMatch(trackingLines, /\b(?:text|receipt|apiKey|license|provider|model|capturedUtm)\s*:/);
});

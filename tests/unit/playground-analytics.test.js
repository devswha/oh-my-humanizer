import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { FUNNEL_PROGRESS_SCHEMA, funnelCounterKey, validateFunnelEvent } from '../../src/funnel-analytics.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const analytics = readFileSync(join(root, 'playground', 'analytics.js'), 'utf8');
const index = readFileSync(join(root, 'playground', 'index.html'), 'utf8');
const controller = readFileSync(join(root, 'playground', 'chatgpt.js'), 'utf8');

function adapter({ fetch, location, ...rest } = {}) {
  const window = { fetch, location, URLSearchParams: globalThis.URLSearchParams, ...rest };
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

const completed = {
  surface: 'hero', lang: 'en', tier: 'free', mode: 'first', inputBucket: '100-499',
  latencyBucket: '<5s', mpsBand: '90-100', fidelityBand: '90-100',
};

function recordingAdapter(search = '') {
  const events = [];
  const window = adapter({ location: { search }, fetch: (_url, options) => {
    events.push(JSON.parse(options.body));
    return Promise.resolve();
  } });
  return { window, events, progress: () => events.filter((event) => event.name === 'Funnel Progress') };
}

test('funnel waits for actual UI readiness and counts arrival once in the initialized language', () => {
  const { window, progress } = recordingAdapter('?lang=ko&utm_source=github&utm_campaign=multilingual-20260907');
  assert.deepEqual(progress(), []);
  window.patinaFunnelReady('not-a-language');
  window.patinaFunnelReady({ lang: 'ko' });
  window.patinaTrack('Rewrite Completed', completed);
  assert.deepEqual(progress(), []);
  // The URL language is not evidence that the UI initialized in that language.
  window.patinaFunnelReady('ja');
  window.patinaFunnelReady('en');
  assert.deepEqual(progress(), [{ name: 'Funnel Progress', data: {
    lang: 'ja', channel: 'github', campaign: 'multilingual-20260907', stage: 'arrival',
  } }]);
});

test('first success and second-success reuse are once per loaded page, across modes and language changes', () => {
  const { window, events, progress } = recordingAdapter('?utm_source=community&utm_campaign=multilingual-20260907');
  window.patinaFunnelReady('ko');
  window.patinaTrack('Rewrite Requested', { surface: 'hero', lang: 'ko', tier: 'free', mode: 'first', inputBucket: '100-499' });
  window.patinaTrack('Rewrite Failed', { surface: 'hero', lang: 'ko', tier: 'free', mode: 'first', inputBucket: '100-499', latencyBucket: '<5s', outcome: 'floor' });
  window.patinaTrack('Result Action', { action: 'copy' });
  for (const bad of [{ ...completed, text: 'private draft' }, { ...completed, surface: 'pricing' }, { ...completed, lang: 'invalid' }]) {
    window.patinaTrack('Rewrite Completed', bad);
  }
  // These remain legal legacy categories, but cannot establish success.
  window.patinaTrack('Rewrite Completed', { ...completed, mpsBand: 'failed' });
  window.patinaTrack('Rewrite Completed', { ...completed, fidelityBand: 'failed' });
  assert.deepEqual(progress().map((event) => event.data.stage), ['arrival']);
  window.patinaTrack('Rewrite Completed', completed);
  assert.deepEqual(progress().map((event) => event.data.stage), ['arrival', 'first-success']);
  window.location.search = '?utm_source=social&utm_campaign=other';
  window.patinaFunnelReady('en');
  for (let i = 0; i < 100; i++) {
    window.patinaTrack('Rewrite Completed', { ...completed, lang: 'zh', mode: i % 2 ? 'verify' : 'refine' });
  }
  assert.deepEqual(progress().map((event) => event.data), [
    { lang: 'ko', channel: 'community', campaign: 'multilingual-20260907', stage: 'arrival' },
    { lang: 'ko', channel: 'community', campaign: 'multilingual-20260907', stage: 'first-success' },
    { lang: 'ko', channel: 'community', campaign: 'multilingual-20260907', stage: 'reuse' },
  ]);
  assert.equal(events.filter((event) => event.name === 'Rewrite Completed').length, 103);
  assert.ok(events.every(validateFunnelEvent));
  const nextPage = recordingAdapter();
  nextPage.window.patinaFunnelReady('ko');
  nextPage.window.patinaTrack('Rewrite Completed', completed);
  assert.deepEqual(nextPage.progress().map((event) => event.data.stage), ['arrival', 'first-success']);
});

test('all browser milestone combinations match the server contract, with exactly 120 daily keys', () => {
  const keys = new Set();
  for (const lang of FUNNEL_PROGRESS_SCHEMA.lang) {
    for (const channel of FUNNEL_PROGRESS_SCHEMA.channel) {
      for (const campaign of FUNNEL_PROGRESS_SCHEMA.campaign) {
        const { window, progress } = recordingAdapter(`?utm_source=${channel}&utm_campaign=${campaign}`);
        window.patinaFunnelReady(lang);
        window.patinaTrack('Rewrite Completed', completed);
        window.patinaTrack('Rewrite Completed', completed);
        assert.equal(progress().length, 3);
        for (const event of progress()) {
          assert.equal(validateFunnelEvent(event), true);
          assert.deepEqual(event.data, { lang, channel, campaign, stage: event.data.stage });
          keys.add(funnelCounterKey(event, '2026-09-07'));
        }
      }
    }
  }
  assert.equal(keys.size, 120);
});

test('attribution only accepts exact finite labels; missing, duplicated, large and arbitrary UTMs collapse', () => {
  const searches = [
    '', '?utm_source=Github&utm_campaign=MULTILINGUAL-20260907',
    '?utm_source=github&%75tm_source=social&utm_campaign=multilingual-20260907&utm_campaign=multilingual-20260907',
    `?utm_source=github&utm_campaign=multilingual-20260907&text=${'x'.repeat(4096)}`,
    '?utm_source=github%00&utm_campaign=multilingual-20260907%20',
    '?utm_source=%FF&utm_campaign=%FF',
  ];
  for (let i = 0; i < 200; i++) searches.push(`?utm_source=customer-${i}&utm_campaign=private-${i}`);
  const keys = new Set();
  for (const search of searches) {
    const { window, progress } = recordingAdapter(search);
    window.patinaFunnelReady('en');
    const event = progress()[0];
    assert.deepEqual(event.data, { lang: 'en', channel: 'unattributed', campaign: 'none', stage: 'arrival' });
    keys.add(funnelCounterKey(event, '2026-09-07'));
  }
  assert.equal(keys.size, 1);
  for (const [search, channel, campaign] of [
    ['?utm_source=blog&utm_campaign=secret', 'blog', 'none'],
    ['?utm_source=secret&utm_campaign=multilingual-20260907', 'unattributed', 'multilingual-20260907'],
    ['?utm_source=%67ithub&utm_campaign=multilingual-20260907', 'github', 'multilingual-20260907'],
  ]) {
    const { window, progress } = recordingAdapter(search);
    window.patinaFunnelReady('en');
    assert.deepEqual(progress()[0].data, { lang: 'en', channel, campaign, stage: 'arrival' });
  }
});

test('privacy canaries never enter milestone bodies and browser identity/context stores are never touched', () => {
  const { window, events, progress } = recordingAdapter('?utm_source=social&utm_campaign=multilingual-20260907&utm_medium=sk_live_secret&utm_content=private-draft&utm_term=user-123&ref=https%3A%2F%2Fprivate.test&key=credential');
  const forbidden = () => { throw new Error('must not access identity or page content'); };
  for (const name of ['localStorage', 'sessionStorage', 'document', 'navigator', 'crypto']) {
    Object.defineProperty(window, name, { get: forbidden });
  }
  for (const name of ['href', 'hash', 'host', 'pathname']) Object.defineProperty(window.location, name, { get: forbidden });
  window.patinaFunnelReady('en');
  window.patinaTrack('Rewrite Completed', completed);
  window.patinaTrack('Rewrite Completed', completed);
  window.patinaTrack('Funnel Progress', { lang: 'en', channel: 'github', campaign: 'none', stage: 'reuse' });
  assert.equal(progress().length, 3);
  assert.ok(events.every(validateFunnelEvent));
  assert.doesNotMatch(JSON.stringify(events), /sk_live_secret|private-draft|user-123|private\.test|credential|utm_|referrer|session|cookie|https?:/);
});

test('readiness and milestones isolate blocked location, missing fetch, thrown fetch and rejected fetch without retry', async () => {
  for (const mode of ['missing', 'throws', 'rejects', 'limited', 'offline']) {
    let calls = 0;
    const fetch = mode === 'missing' ? undefined : () => {
      calls += 1;
      if (mode === 'throws') throw new Error('unavailable');
      if (mode === 'rejects') return Promise.reject(new Error('offline'));
      return Promise.resolve({ ok: false, status: mode === 'limited' ? 429 : 503 });
    };
    const window = adapter({ fetch });
    Object.defineProperty(window, 'location', { get() { throw new Error('blocked'); } });
    assert.doesNotThrow(() => window.patinaFunnelReady('en'));
    window.patinaFunnelReady('en');
    for (let i = 0; i < 3; i++) assert.doesNotThrow(() => window.patinaTrack('Rewrite Completed', completed));
    await Promise.resolve();
    assert.equal(calls, mode === 'missing' ? 0 : 6);
  }
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

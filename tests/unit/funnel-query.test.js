import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const doc = readFileSync(new URL('../../docs/operations/multilingual-funnel-20260907.md', import.meta.url), 'utf8');
const recipe = doc.match(/node --input-type=module <<'NODE'\n([\s\S]+?)\nNODE/)[1];
const secret = 'query-credential-canary';
const privateResponse = 'private-upstream-response-canary';

// Run the exact documented recipe in isolation, with fake credentials and a
// replacement fetch that cannot access a real network or another KV namespace.
function query(mode = 'counts', env = {}) {
  const bootstrap = `
    globalThis.fetch = async (url, options) => {
      const command = JSON.parse(options.body);
      if (url !== 'https://example.upstash.io' || options.method !== 'POST'
        || options.redirect !== 'error' || !options.signal
        || options.headers.Authorization !== 'Bearer ${secret}'
        || command.length !== 122 || command[0] !== 'MGET'
        || new Set(command.slice(1)).size !== 121
        || !command.slice(1, -1).every((key) => /^patina:funnel:v1:2026-09-07:funnel-progress:campaign=(none|multilingual-20260907):channel=(unattributed|github|blog|social|community):lang=(en|ko|zh|ja):stage=(arrival|first-success|reuse)$/.test(key))
        || command.at(-1) !== 'patina:funnel:v1:2026-09-07:budget') throw new Error('invalid query');
      if (process.env.FUNNEL_TEST_MODE === 'transport') throw new Error('${secret} ${privateResponse}');
      let result = command.slice(1).map((key) => {
        if (process.env.FUNNEL_TEST_MODE === 'missing') return null;
        if (key.endsWith(':budget')) return '42';
        if (key.includes(':channel=community:lang=ko:') && key.includes(':campaign=multilingual-20260907:')) {
          return key.endsWith('stage=arrival') ? '10' : key.endsWith('stage=first-success') ? '6' : '2';
        }
        return null;
      });
      if (process.env.FUNNEL_TEST_MODE === 'shape') result = ['${privateResponse}'];
      if (process.env.FUNNEL_TEST_MODE === 'private') result[0] = '${privateResponse}';
      if (process.env.FUNNEL_TEST_MODE === 'overflow') result[0] = '9007199254740992';
      return { ok: process.env.FUNNEL_TEST_MODE !== 'http', json: async () => ({ result }) };
    };
  `;
  return spawnSync(process.execPath, ['--input-type=module', '-e', bootstrap + recipe], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      FUNNEL_DAY: '2026-09-07',
      PATINA_OBSERVABILITY_REST_API_URL: 'https://example.upstash.io',
      PATINA_OBSERVABILITY_REST_API_TOKEN: secret,
      FUNNEL_TEST_MODE: mode,
      ...env,
    },
  });
}

test('documented aggregate query reads exactly the finite keys and prints only categories and counts', () => {
  const result = query();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout, new RegExp(`${secret}|${privateResponse}|Authorization|upstash|https?:`));
  const data = JSON.parse(result.stdout);
  assert.equal(data.day, '2026-09-07');
  assert.equal(data.budget, 42);
  assert.equal(data.observedMilestoneKeys, 3);
  assert.equal(data.rows.length, 40);
  assert.deepEqual(data.rows.find((row) => row.lang === 'ko' && row.channel === 'community' && row.campaign === 'multilingual-20260907'), {
    lang: 'ko', channel: 'community', campaign: 'multilingual-20260907',
    arrival: 10, 'first-success': 6, reuse: 2,
  });
});

test('documented aggregate query preserves absent keys as missing, not measured zero', () => {
  const result = query('missing');
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.budget, null);
  assert.equal(data.observedMilestoneKeys, 0);
  assert.ok(data.rows.every((row) => row.arrival === null && row['first-success'] === null && row.reuse === null));
});

test('query fails closed without disclosing auth or upstream context on malformed counts and configuration', () => {
  for (const [mode, env] of [
    ['http', {}], ['transport', {}], ['shape', {}], ['private', {}], ['overflow', {}],
    ['counts', { FUNNEL_DAY: '2026-02-30' }],
    ['counts', { FUNNEL_DAY: '2026-09-07:private' }],
    ['counts', { PATINA_OBSERVABILITY_REST_API_TOKEN: '' }],
    ['counts', { PATINA_OBSERVABILITY_REST_API_URL: 'https://example.upstash.io.evil.test' }],
    ['counts', { PATINA_OBSERVABILITY_REST_API_URL: `https://${secret}@example.upstash.io` }],
    ['counts', { PATINA_OBSERVABILITY_REST_API_URL: 'https://example.upstash.io/private' }],
  ]) {
    const result = query(mode, env);
    assert.equal(result.status, 1, mode);
    assert.equal(result.stdout, '', mode);
    assert.equal(result.stderr, 'Funnel aggregate query unavailable; no counts reported.\n', mode);
  }
});

test('prepared share links have one finite campaign and supported language and channel labels', () => {
  const links = doc.match(/https:\/\/patina\.vibetip\.help\/\?lang=[^`]+/g);
  assert.equal(links.length, 4);
  assert.deepEqual(links.map((link) => new URL(link).searchParams.get('lang')), ['ko', 'en', 'zh', 'ja']);
  for (const link of links) {
    const url = new URL(link);
    assert.equal(url.pathname, '/');
    assert.equal(url.hash, '');
    assert.deepEqual([...url.searchParams.keys()], ['lang', 'utm_source', 'utm_campaign']);
    assert.equal(url.searchParams.get('utm_source'), 'community');
    assert.equal(url.searchParams.get('utm_campaign'), 'multilingual-20260907');
  }
});

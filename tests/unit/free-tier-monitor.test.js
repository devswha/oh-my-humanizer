import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { aggregateKey, evaluateFreeTierHealth } from '../../src/pro-monitor.js';

const NOW = new Date('2026-07-15T12:07:00.000Z');

function store() {
  const values = new Map();
  return {
    values,
    async get(key) { return values.get(key); },
    async set(key, value) { values.set(key, value); return true; },
    async acquire(key, value) { if (values.has(key)) return false; values.set(key, value); return true; },
    async release(key, value) { if (values.get(key) !== value) return false; values.delete(key); return true; },
  };
}
function snapshot(values = {}) {
  return { async snapshot(keys) { return Object.fromEntries(keys.map((key) => [key, values[key] ?? 0])); } };
}
const key = (outcome, latencyBucket = '<=30s') =>
  aggregateKey({ channel: 'production', tier: 'free', at: '20260715T1200Z', outcome, latencyBucket });

function deps(overrides = {}) {
  return {
    channel: 'production',
    tier: 'free',
    clock: () => NOW,
    sleep: async () => {},
    aggregateReader: snapshot(),
    discordSender: async () => ({ status: 204, receiptId: 'discord-free-1' }),
    controlStore: store(),
    ...overrides,
  };
}

test('a healthy free tier raises nothing', async () => {
  const result = await evaluateFreeTierHealth(deps({
    aggregateReader: snapshot({ [key('completed')]: 20 }),
    canaryRequest: async () => ({ ok: true, terminal: 'done' }),
  }));
  assert.deepEqual(result.triggers, []);
  assert.equal(result.canaryTerminal, 'done');
  assert.deepEqual(result.denominators, { total: 20, failed: 0 });
});

test('a majority-failing free tier alerts on the ratio', async () => {
  // The 2026-07-27 shape: users asking for rewrites and getting provider errors.
  const result = await evaluateFreeTierHealth(deps({
    aggregateReader: snapshot({ [key('completed')]: 2, [key('terminal_failed')]: 8 }),
  }));
  assert.deepEqual(result.denominators, { total: 10, failed: 8 });
  assert.equal(result.triggers[0].trigger, 'free_failure_ratio');
  assert.equal(result.alerts[0].sent, true);
});

test('quota denials are the product working, not an outage', async () => {
  const result = await evaluateFreeTierHealth(deps({
    aggregateReader: snapshot({ [key('completed')]: 2, [key('quota_denied')]: 30 }),
  }));
  assert.deepEqual(result.triggers, []);
  assert.equal(result.denominators.failed, 0);
});

test('a small sample never trips the ratio', async () => {
  const result = await evaluateFreeTierHealth(deps({
    aggregateReader: snapshot({ [key('terminal_failed')]: 4 }),
  }));
  assert.deepEqual(result.triggers, []);
});

test('the canary covers zero traffic, where the aggregate cannot tell idle from down', async () => {
  const result = await evaluateFreeTierHealth(deps({
    canaryRequest: async () => { throw new Error('HTTP 429'); },
  }));
  assert.equal(result.canaryTerminal, 'failed');
  assert.equal(result.triggers[0].trigger, 'free_canary_failure');
  assert.equal(result.alerts[0].sent, true);
});

test('the canary is budgeted so it cannot exhaust the free IP quota it probes', async () => {
  const controlStore = store();
  let probes = 0;
  const canaryRequest = async () => { probes += 1; return { ok: true, terminal: 'done' }; };
  await evaluateFreeTierHealth(deps({ controlStore, canaryRequest }));
  await evaluateFreeTierHealth(deps({ controlStore, canaryRequest }));
  await evaluateFreeTierHealth(deps({ controlStore, canaryRequest }));
  assert.equal(probes, 1, 'the lease must hold across cron ticks');
});

test('repeat alerts are deduplicated within the lease window', async () => {
  const controlStore = store();
  let sends = 0;
  const discordSender = async () => { sends += 1; return { status: 204, receiptId: 'discord-free-2' }; };
  const overrides = { controlStore, discordSender, aggregateReader: snapshot({ [key('terminal_failed')]: 9 }) };
  const first = await evaluateFreeTierHealth(deps(overrides));
  const second = await evaluateFreeTierHealth(deps(overrides));
  assert.equal(sends, 1);
  assert.equal(first.alerts[0].sent, true);
  assert.equal(second.alerts[0].deduped, true);
});

test('a failed Discord delivery releases the lease so the next tick retries', async () => {
  const controlStore = store();
  const result = await evaluateFreeTierHealth(deps({
    controlStore,
    discordSender: async () => ({ status: 500 }),
    aggregateReader: snapshot({ [key('terminal_failed')]: 9 }),
  }));
  assert.equal(result.alerts[0].sent, false);
  assert.equal([...controlStore.values.keys()].some((item) => item.includes('dedup:free_failure_ratio')), false);
});

test('the pro tier cannot be evaluated here, and neither can an unknown channel', async () => {
  await assert.rejects(() => evaluateFreeTierHealth(deps({ tier: 'pro' })), /closed dimensions/);
  await assert.rejects(() => evaluateFreeTierHealth(deps({ channel: 'dev' })), /closed dimensions/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { quotaKeyHmac } from '../../src/rate-limit.js';
import { reservationArgs, RESERVE_QUOTA_LUA, settlementArgs, SETTLE_QUOTA_LUA } from '../../src/quota-reservation.js';

const server = process.env.PATINA_TEST_REDIS_SERVER;
const cli = process.env.PATINA_TEST_REDIS_CLI;
if ((server || cli) && (!server || !cli || !existsSync(server) || !existsSync(cli))) throw new Error('Configured Redis test tools are missing');
const execute = promisify(execFile);

test('real Redis executes reservation/refund Lua atomically and preserves expiry', { skip: !server || !cli }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'patina-redis-'));
  const socket = join(directory, 'redis.sock');
  const proc = spawn(server, ['--port', '0', '--unixsocket', socket, '--unixsocketperm', '700', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  const exited = new Promise((resolve) => proc.once('exit', resolve));
  const command = async (...args) => {
    const result = await execute(cli, ['-s', socket, '--json', ...args.map(String)], { timeout: 5000 });
    return JSON.parse(result.stdout.trim());
  };
  const plan = (nonce) => ({
    keys: ['day', 'month', 'chars', 'attempts', `receipt-${nonce}`].map((part) => quotaKeyHmac('redis-test-secret', part)),
    caps: [10, 2, 1000], amounts: [1, 1, 400], ttlMs: [60000, 60000, 60000], receiptTtlMs: 120000, attemptCap: 4,
  });
  const reserve = (value) => command('EVAL', RESERVE_QUOTA_LUA, 5, ...value.keys, ...reservationArgs(value));
  const settle = (value, refund) => command('EVAL', SETTLE_QUOTA_LUA, 5, ...value.keys, ...settlementArgs(value, refund));
  try {
    for (let i = 0; i < 100 && !existsSync(socket); i++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(await command('PING'), 'PONG');
    const first = plan('one');
    assert.deepEqual(await reserve(first), [1, 9]);
    assert.deepEqual(await reserve(first), [1, 9]);
    assert.equal(await command('GET', first.keys[3]), '1');
    assert.equal(await settle(first, true), 1);
    assert.equal(await settle(first, true), 1);
    assert.deepEqual(await command('MGET', ...first.keys.slice(0, 4)), ['0', '0', '0', '1']);
    assert.ok(await command('PTTL', first.keys[0]) > 0);
    assert.deepEqual(await reserve(first), [-1]);

    const second = plan('two'); assert.deepEqual(await reserve(second), [1, 9]);
    assert.equal(await settle(second, false), 1); assert.equal(await settle(second, true), 0);
    assert.equal(await command('GET', second.keys[1]), '1');

    // A cancellation must also block an in-flight reservation arriving late.
    const late = plan('late'); assert.equal(await settle(late, true), 1);
    assert.deepEqual(await reserve(late), [-1]);
    assert.equal(await command('GET', late.keys[3]), '2');

    await command('FLUSHDB');
    const outcomes = await Promise.all(Array.from({ length: 20 }, (_, i) => reserve(plan(`parallel-${i}`))));
    assert.equal(outcomes.filter((row) => row[0] === 1).length, 2);
    assert.deepEqual(await command('MGET', ...first.keys.slice(0, 4)), ['2', '2', '800', '2']);

    await command('FLUSHDB');
    for (let i = 0; i < 4; i++) { const value = plan(`failed-${i}`); assert.equal((await reserve(value))[0], 1); assert.equal(await settle(value, true), 1); }
    assert.deepEqual(await reserve(plan('budget-exhausted')), [0, 4]);

    await command('FLUSHDB');
    const corrupt = plan('corrupt'); await reserve(corrupt); await command('SET', corrupt.keys[2], 'bad-counter');
    assert.equal(await settle(corrupt, true), -1);
    assert.deepEqual(await command('MGET', ...corrupt.keys.slice(0, 2)), ['1', '1']);

    await command('FLUSHDB');
    const expired = plan('expired'); await reserve(expired); await command('DEL', expired.keys[0]);
    assert.equal(await settle(expired, true), 1);
    assert.equal(await command('GET', expired.keys[0]), null);
    assert.equal(await command('GET', expired.keys[1]), '0');
  } finally {
    proc.kill('SIGTERM'); await exited; rmSync(directory, { recursive: true, force: true });
  }
});

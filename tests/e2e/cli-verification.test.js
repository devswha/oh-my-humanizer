import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { mpsResult, highHardFailMps } from '../fixtures/verification-results.js';
import { cleanRewriteOutput, formatOutput } from '../../src/output.js';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const outputHash = text => createHash('sha256').update(text, 'utf8').digest('hex');
const NESTED_RAW = '[BODY]The service does not store drafts. [BODY]It runs locally.[/BODY][/BODY]';
const NESTED_GRADED = 'The service does not store drafts. [BODY]It runs locally.\n\n[/BODY]';

test('CLI --verify preserves stdout and exit 4 for semantic failures; normal evidence exits 0', async () => {
  for (const scenario of ['normal', 'hard-fail', 'malformed']) {
    const counts = { rewrite: 0, mps: 0, fidelity: 0 };
    const text = 'The service retains the audit log.';
    const dir = mkdtempSync(join(tmpdir(), 'patina-runtime-cli-'));
    writeFileSync(join(dir, 'key'), 'test-key');
    writeFileSync(join(dir, 'input.txt'), text);
    const server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      const prompt = JSON.parse(body).messages.map((message) => message.content).join('\n');
      let answer = text;
      if (prompt.includes('Meaning Preservation evaluator')) {
        counts.mps++;
        answer = JSON.stringify(scenario === 'hard-fail' ? highHardFailMps() : scenario === 'malformed' ? { ...mpsResult(), pass_count: 0 } : mpsResult());
      } else if (prompt.includes('Fidelity evaluator')) {
        counts.fidelity++;
        answer = JSON.stringify({ claims_preserved: scenario === 'malformed' ? 99 : 3, no_fabrication: 3, audience_register_match: 3 });
      } else {
        counts.rewrite++;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: answer } }] }));
    });
    try {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const result = await run(process.execPath, [join(root, 'bin/patina.js'), '--verify', '--lang', 'en', '--backend', 'openai-http',
        '--model', 'test-model', '--api-key-file', join(dir, 'key'), '--base-url', `http://127.0.0.1:${server.address().port}/v1`, join(dir, 'input.txt')],
      { cwd: root, timeout: 20000 }).then((result) => ({ ...result, code: 0 }), (error) => error);
      assert.equal(result.code, scenario === 'normal' ? 0 : 4, result.stderr);
      assert.equal(result.stdout.trim(), text);
      assert.equal(counts.rewrite, scenario === 'normal' ? 1 : 2);
      if (scenario === 'normal') assert.match(result.stderr, /\(passed\)/);
      else assert.match(result.stderr, /below floor/);
      // One correction per malformed score per candidate, never unbounded.
      assert.equal(counts.mps, scenario === 'normal' ? 1 : scenario === 'malformed' ? 4 : 2);
      assert.equal(counts.fidelity, scenario === 'normal' ? 1 : scenario === 'malformed' ? 4 : 2);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('JSON verification metadata is opt-in runtime evidence with no duplicate draft or extra fields', () => {
  const text = 'The service retains 12 audit logs.';
  const evidence = { verified: true, mps: 100, fidelity: 100, retried: false, reason: 'passed', mpsFloor: 95, fidelityFloor: 95,
    outputHash: outputHash(text) };
  const options = { verification: { ...evidence, text, apiKey: 'private-key' } };
  const verified = JSON.parse(formatOutput(text, 'rewrite', { format: 'json', verify: true }, options));
  assert.deepEqual(verified.verification, evidence);
  assert.equal(verified.output, text);
  assert.equal(JSON.stringify(verified).split(text).length, 2);
  assert.doesNotMatch(JSON.stringify(verified), /private-key/);
  for (const mode of ['rewrite', 'score', 'audit', 'diff']) {
    const payload = JSON.parse(formatOutput(text, mode, { format: 'json', verify: mode !== 'rewrite' }, options));
    assert.equal(Object.hasOwn(payload, 'verification'), false);
  }
  for (const format of ['text', 'markdown']) assert.equal(formatOutput(text, 'rewrite', { format, verify: true }, options), text);
  const modelResult = { output: text, verification: evidence };
  assert.equal(Object.hasOwn(JSON.parse(formatOutput(modelResult, 'rewrite', { format: 'json', verify: true })), 'verification'), false);
  const graded = cleanRewriteOutput(NESTED_RAW);
  assert.equal(graded, NESTED_GRADED);
  const nested = JSON.parse(formatOutput(graded, 'rewrite', { format: 'json', verify: true }, {
    verification: { ...evidence, outputHash: outputHash(graded) },
  }));
  assert.equal(nested.output, 'It runs locally.');
  assert.equal(nested.verification.outputHash, outputHash(graded), 'formatter must preserve the original evidence hash');
  assert.notEqual(nested.verification.outputHash, outputHash(nested.output));
});

test('CLI --verify JSON binds scores to graded text and rejects post-verification claim loss', async () => {
  for (const scenario of ['pass', 'hard-fail', 'malformed', 'dropped-number', 'retry-pass', 'nested-body']) {
    const text = scenario === 'nested-body' ? 'The service does not store drafts. It runs locally.\n' : 'The service retains 12 audit logs.';
    const dir = mkdtempSync(join(tmpdir(), 'patina-runtime-json-'));
    writeFileSync(join(dir, 'key'), 'test-key');
    writeFileSync(join(dir, 'input.txt'), text);
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ persona: null, register: null,
      verification: { 'mps-floor': 95, 'fidelity-floor': 95 } }));
    let rewriteCount = 0;
    const server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      const prompt = JSON.parse(body).messages.map(message => message.content).join('\n');
      let answer;
      if (prompt.includes('Meaning Preservation evaluator')) {
        answer = JSON.stringify(scenario === 'hard-fail' ? highHardFailMps()
          : scenario === 'malformed' ? { ...mpsResult(), pass_count: 0 }
          : mpsResult(scenario === 'retry-pass' && rewriteCount === 1 ? 80 : 100));
      } else if (prompt.includes('Fidelity evaluator')) {
        answer = JSON.stringify({ claims_preserved: 3, no_fabrication: 3, audience_register_match: 3 });
      } else {
        rewriteCount++;
        answer = scenario === 'dropped-number' ? 'The service retains the audit logs.' : scenario === 'nested-body' ? NESTED_RAW : text;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: answer } }] }));
    });
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const result = await run(process.execPath, [join(root, 'bin/patina.js'), '--verify', '--format', 'json', '--lang', 'en',
        '--config', join(dir, 'config.json'), '--backend', 'openai-http', '--model', 'test-model',
        '--api-key-file', join(dir, 'key'), '--base-url', `http://127.0.0.1:${server.address().port}/v1`, join(dir, 'input.txt')],
      { cwd: dir, timeout: 20000, env: { ...process.env, HOME: dir, USERPROFILE: dir, TMPDIR: dir } })
        .then(result => ({ ...result, code: 0 }), error => error);
      const success = ['pass', 'retry-pass'].includes(scenario);
      assert.equal(result.code, success ? 0 : 4, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.mode, 'rewrite');
      assert.equal(payload.output, scenario === 'dropped-number' ? 'The service retains the audit logs.' : scenario === 'nested-body' ? 'It runs locally.' : text);
      assert.deepEqual(payload.verification, {
        verified: success, mps: scenario === 'malformed' ? null : scenario === 'hard-fail' ? 95 : 100,
        fidelity: 100, retried: !['pass', 'dropped-number', 'nested-body'].includes(scenario),
        reason: scenario === 'pass' ? 'passed' : scenario === 'retry-pass' ? 'passed-on-retry'
          : scenario === 'dropped-number' ? 'dropped-numbers' : scenario === 'nested-body' ? 'output-changed' : 'floor-not-met',
        mpsFloor: 95, fidelityFloor: 95,
        outputHash: outputHash(scenario === 'nested-body' ? NESTED_GRADED : payload.output),
      });
      assert.equal(rewriteCount, ['pass', 'dropped-number', 'nested-body'].includes(scenario) ? 1 : 2);
      if (scenario === 'nested-body') {
        assert.doesNotMatch(text, /\d/);
        assert.notEqual(payload.verification.outputHash, outputHash(payload.output));
        // Plain output keeps its existing body; only unsafe verification
        // changes the exit status. Ordinary unverified cleanup is unchanged.
        for (const verify of [true, false]) {
          const plain = await run(process.execPath, [join(root, 'bin/patina.js'), ...(verify ? ['--verify'] : []), '--format', 'text', '--lang', 'en',
            '--config', join(dir, 'config.json'), '--backend', 'openai-http', '--model', 'test-model',
            '--api-key-file', join(dir, 'key'), '--base-url', `http://127.0.0.1:${server.address().port}/v1`, join(dir, 'input.txt')],
          { cwd: dir, timeout: 20000, env: { ...process.env, HOME: dir, USERPROFILE: dir, TMPDIR: dir } })
            .then(result => ({ ...result, code: 0 }), error => error);
          assert.equal(plain.code, verify ? 4 : 0, plain.stderr);
          assert.equal(plain.stdout.trim(), verify ? 'It runs locally.' : NESTED_GRADED);
        }
      }
    } finally {
      await new Promise(resolve => server.close(resolve));
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

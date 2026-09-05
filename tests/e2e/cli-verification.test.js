import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { mpsResult, highHardFailMps } from '../fixtures/verification-results.js';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));

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

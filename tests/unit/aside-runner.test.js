import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { hashAsideText, saveAsideSettings } from '../../src/aside/options.js';
import { runAsideRewrite } from '../../src/aside/runner.js';
import { parseArgs } from '../../src/cli/args.js';
import { highHardFailMps, mpsResult } from '../fixtures/verification-results.js';

const SOURCE = 'Patina retains 12 audit logs. In conclusion, Patina retains them.';
const REWRITE = 'Patina keeps 12 audit logs. Patina retains them.';

async function fixture(t, { source = SOURCE, settings } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'aside-runner-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, 'workspace with spaces');
  const temporary = join(root, 'temporary');
  await mkdir(workspace);
  await mkdir(temporary);
  const inputPath = join(workspace, "draft 'quoted' $(no-command); --audit.md");
  await writeFile(inputPath, source);
  if (settings !== undefined) await saveAsideSettings(workspace, settings);
  return { root, workspace, temporary, inputPath, outputPath: join(workspace, 'result.md') };
}

function fakeCli({ output = REWRITE, exitCode = 0, stdout, script, inspect } = {}) {
  return (command, argv, options) => {
    assert.equal(command, process.execPath);
    assert.match(argv[0], /bin[/\\]patina\.js$/);
    assert.equal(options.shell, false);
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'ignore']);
    const parsed = parseArgs(argv.slice(1));
    assert.equal(parsed.verify, true);
    assert.equal(parsed.format, 'json');
    assert.equal(parsed.files.length, 1);
    assert.equal(parsed.inPlace, undefined);
    assert.equal(parsed.quiet, true);
    inspect?.({ argv, options, parsed, config: JSON.parse(readFileSync(parsed.config, 'utf8')), source: readFileSync(parsed.files[0], 'utf8') });
    const body = stdout === undefined ? JSON.stringify({ mode: 'rewrite', format: 'json', output }) : stdout;
    const program = script ?? `process.stderr.write('provider-secret raw-draft'); process.stdout.write(${JSON.stringify(body)}); process.exitCode = ${exitCode};`;
    return spawn(command, ['--input-type=module', '-e', program], options);
  };
}

async function assertNoOutput(f, result) {
  assert.equal(result.outputPath, null);
  assert.equal(result.rewriteHash, null);
  assert.equal(result.verification.verified, false);
  assert.equal(result.ok, false);
  assert.notEqual(result.exitCode, 0);
  await assert.rejects(stat(f.outputPath), { code: 'ENOENT' });
  assert.equal((await readdir(f.temporary)).some(name => name.startsWith('patina-aside-run-')), false);
  assert.equal((await readdir(f.workspace)).some(name => name.startsWith('.patina-aside-output-')), false);
}

test('Aside accepts valid forced CLI JSON, propagates options safely, and keeps source bytes unchanged', async t => {
  const f = await fixture(t, { settings: { language: 'en', documentType: 'technical', persona: 'technical-explainer',
    register: 'professional', backend: 'codex-cli', model: 'org/model-v2:tag', protectedTerms: ['Patina', '12'] } });
  let seen = false;
  const result = await runAsideRewrite({ ...f, tempRoot: f.temporary, spawnImpl: fakeCli({ inspect: ({ argv, parsed, config, source }) => {
    seen = true;
    assert.equal(source, SOURCE);
    assert.notEqual(parsed.files[0], f.inputPath);
    assert.equal(resolve(parsed.files[0]), parsed.files[0]);
    assert.equal(argv.some(arg => arg.includes(SOURCE)), false);
    assert.equal(argv.some(arg => arg.includes('provider-secret')), false);
    assert.deepEqual(config, { language: 'en', 'document-type': 'technical', persona: 'technical-explainer', register: 'professional',
      backend: 'codex-cli', model: 'org/model-v2:tag', verification: { 'mps-floor': 70, 'fidelity-floor': 70 } });
  } }) });
  assert.equal(seen, true);
  assert.equal(result.status, 'verified');
  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.outputPath, f.outputPath);
  assert.equal(result.sourceHash, hashAsideText(SOURCE));
  assert.equal(result.rewriteHash, hashAsideText(REWRITE));
  assert.equal(result.verification.verified, true);
  assert.equal(result.verification.exitCode, 0);
  assert.equal(result.verification.mps, null);
  assert.equal(result.verification.fidelity, null);
  assert.equal(result.verification.protectedTermsVerified, true);
  assert.equal(result.changes.changed, true);
  assert.ok(result.changes.editCount > 0);
  assert.equal(result.changes.originalLength - result.changes.removedLength + result.changes.addedLength, REWRITE.length);
  assert.equal(await readFile(f.inputPath, 'utf8'), SOURCE);
  assert.equal(await readFile(f.outputPath, 'utf8'), REWRITE);
  assert.deepEqual(await readdir(f.temporary), []);
  if (process.platform !== 'win32') assert.equal((await stat(f.outputPath)).mode & 0o777, 0o600);
  assert.doesNotMatch(JSON.stringify(result), /provider-secret|raw-draft|In conclusion/);
});

test('Aside unconfigured runs use blog/source defaults and a distinct default output path', async t => {
  const f = await fixture(t);
  const result = await runAsideRewrite({ ...f, inputPath: basename(f.inputPath), outputPath: undefined,
    tempRoot: f.temporary, spawnImpl: fakeCli({ output: SOURCE, inspect: ({ config }) => {
      assert.equal(config.persona, null);
      assert.equal(config.register, null);
      assert.equal(config['document-type'], 'blog');
      assert.equal(config.backend, undefined);
      assert.equal(config.model, undefined);
    } }) });
  assert.equal(result.status, 'verified');
  assert.equal(result.configured, false);
  assert.equal(result.settingsHash, null);
  assert.equal(result.effectiveOptions.language, 'en');
  assert.equal(result.changes.changed, false);
  assert.equal(result.changes.editCount, 0);
  assert.equal(result.outputPath, f.inputPath.replace(/\.md$/, '.patina.md'));
  await assert.rejects(stat(join(f.workspace, '.patina')), { code: 'ENOENT' });
});

test('Aside exit 4 rejects a nonempty closest candidate and never exposes it', async t => {
  const f = await fixture(t);
  const result = await runAsideRewrite({ ...f, tempRoot: f.temporary, spawnImpl: fakeCli({ exitCode: 4 }) });
  assert.equal(result.status, 'rejected');
  assert.equal(result.code, 'verification_rejected');
  assert.equal(result.verification.exitCode, 4);
  assert.equal(result.sourceHash, hashAsideText(SOURCE));
  await assertNoOutput(f, result);
  assert.doesNotMatch(JSON.stringify(result), /provider-secret|raw-draft|keeps 12/);
});

test('Aside rejects malformed JSON, wrong mode/format, missing/empty/ill-formed/oversized output', async t => {
  for (const stdout of ['not JSON provider-secret', 'null', '{}', JSON.stringify({ mode: 'score', format: 'json', output: REWRITE }),
    JSON.stringify({ mode: 'rewrite', format: 'text', output: REWRITE }),
    ...['', ' ', '\uD800', 'a\0b', 'a'.repeat(20_001)].map(output => JSON.stringify({ mode: 'rewrite', format: 'json', output }))]) {
    const f = await fixture(t);
    const result = await runAsideRewrite({ ...f, tempRoot: f.temporary, spawnImpl: fakeCli({ stdout }) });
    assert.equal(result.status, 'rejected');
    assert.match(result.code, /^invalid_cli_(?:json|output)$/);
    await assertNoOutput(f, result);
    assert.doesNotMatch(JSON.stringify(result), /provider-secret/);
  }
});

test('Aside bounds stdout bytes and ignores stderr secrets', async t => {
  const f = await fixture(t);
  const result = await runAsideRewrite({ ...f, tempRoot: f.temporary, spawnImpl: fakeCli({
    script: "process.stderr.write('provider-secret'); process.stdout.write('a'.repeat(300000));",
  }) });
  assert.equal(result.code, 'cli_output_limit');
  await assertNoOutput(f, result);
});

test('Aside rejects invalid UTF-8 child output while exit 4 still wins over its bytes', async t => {
  for (const exitCode of [0, 4]) {
    const f = await fixture(t);
    const result = await runAsideRewrite({ ...f, tempRoot: f.temporary, spawnImpl: fakeCli({
      script: `process.stdout.write(Buffer.from([0xc3, 0x28])); process.exitCode = ${exitCode};`,
    }) });
    assert.equal(result.status, 'rejected');
    assert.equal(result.code, exitCode === 4 ? 'verification_rejected' : 'invalid_cli_json');
    await assertNoOutput(f, result);
  }
});

test('Aside safe errors never expose thrown messages or nonzero CLI stderr/stdout', async t => {
  for (const spawnImpl of [fakeCli({ exitCode: 1 }), () => { throw new Error('provider-secret'); },
    (_command, _argv, options) => spawn('/definitely-absent-aside-executable', [], options)]) {
    const f = await fixture(t);
    const result = await runAsideRewrite({ ...f, tempRoot: f.temporary, spawnImpl });
    assert.equal(result.status, 'error');
    assert.ok(['cli_failed', 'cli_start_failed'].includes(result.code));
    assert.doesNotMatch(JSON.stringify(result), /provider-secret|definitely-absent|raw-draft/);
    await assertNoOutput(f, result);
  }
});

test('Aside stale input hash rejects output after a successful child', async t => {
  const f = await fixture(t);
  const result = await runAsideRewrite({ ...f, tempRoot: f.temporary, spawnImpl: fakeCli({ inspect: () => {
    writeFileSync(f.inputPath, 'A newer source draft.');
  } }) });
  assert.equal(result.status, 'rejected');
  assert.equal(result.code, 'input_changed');
  assert.equal(await readFile(f.inputPath, 'utf8'), 'A newer source draft.');
  await assertNoOutput(f, result);
});

test('Aside never overwrites source, existing files, symlinks, or an output created during the child', async t => {
  for (const kind of ['source', 'existing', 'symlink', 'during']) {
    const f = await fixture(t);
    if (kind === 'existing') await writeFile(f.outputPath, 'KEEP');
    if (kind === 'symlink') await symlink(f.inputPath, f.outputPath);
    const result = await runAsideRewrite({ ...f, outputPath: kind === 'source' ? f.inputPath : f.outputPath,
      tempRoot: f.temporary, spawnImpl: fakeCli({ inspect: () => {
        assert.equal(kind, 'during', 'existing destination must fail before spawning');
        writeFileSync(f.outputPath, 'KEEP');
      } }) });
    assert.equal(result.code, kind === 'source' ? 'output_is_input' : 'output_exists');
    assert.equal(result.outputPath, null);
    assert.equal(await readFile(f.inputPath, 'utf8'), SOURCE);
    if (kind === 'existing' || kind === 'during') assert.equal(await readFile(f.outputPath, 'utf8'), 'KEEP');
    assert.deepEqual(await readdir(f.temporary), []);
  }
});

test('Aside rejects invalid/bounded/non-file inputs before starting any backend', async t => {
  for (const source of ['', '  ', '\0draft', 'a'.repeat(20_001), '字'.repeat(30_000), Buffer.from([0xC3, 0x28])]) {
    const f = await fixture(t, { source });
    const result = await runAsideRewrite({ ...f, spawnImpl: () => { assert.fail('must not spawn'); } });
    assert.equal(result.code, 'invalid_input');
    await assertNoOutput(f, result);
  }
  const f = await fixture(t);
  await rm(f.inputPath);
  await mkdir(f.inputPath);
  const result = await runAsideRewrite({ ...f, spawnImpl: () => { assert.fail('must not spawn'); } });
  assert.equal(result.code, 'invalid_input');
});

test('Aside source hash preserves BOM and multibyte UTF-8 exactly', async t => {
  const source = '\uFEFFパティナは意味と数字を保ったまま文章を整えます。😀';
  const f = await fixture(t, { source });
  const result = await runAsideRewrite({ ...f, tempRoot: f.temporary, spawnImpl: fakeCli({ output: source,
    inspect: ({ source: snapshot }) => assert.equal(snapshot, source) }) });
  assert.equal(result.status, 'verified');
  assert.equal(result.sourceHash, hashAsideText(await readFile(f.inputPath)));
  assert.equal(result.rewriteHash, result.sourceHash);
  assert.equal(result.effectiveOptions.language, 'ja');
});

test('Aside protected terms require exact global counts and order, with no repair', async t => {
  for (const output of ['Patina retains 12 audit logs.', 'Patina Patina Patina retains 12 audit logs.',
    '12 audit logs remain. Patina retains them. Patina agrees.', 'Patina retains 12 audit logs. patina retains them.']) {
    const f = await fixture(t, { settings: { protectedTerms: ['Patina', '12'] } });
    const result = await runAsideRewrite({ ...f, tempRoot: f.temporary, spawnImpl: fakeCli({ output }) });
    assert.equal(result.status, 'rejected');
    assert.equal(result.code, 'protected_text_changed');
    await assertNoOutput(f, result);
  }
});

test('Aside missing/ambiguous protected terms fail before spawning', async t => {
  for (const [source, settings, code] of [
    [SOURCE, { protectedTerms: ['Missing'] }, 'protected_term_missing'],
    [SOURCE, { protectedTerms: ['Patina', 'Pat'] }, 'protected_text_ambiguous'],
    ['banana 12', { protectedTerms: ['ana'] }, 'protected_text_ambiguous'],
  ]) {
    const f = await fixture(t, { source, settings });
    const result = await runAsideRewrite({ ...f, spawnImpl: () => { assert.fail('must not spawn'); } });
    assert.equal(result.code, code);
    await assertNoOutput(f, result);
  }
});

test('Aside checks missing numbers even if a child incorrectly exits zero', async t => {
  const f = await fixture(t);
  const result = await runAsideRewrite({ ...f, tempRoot: f.temporary, spawnImpl: fakeCli({ output: 'Patina retains logs.' }) });
  assert.equal(result.code, 'numbers_changed');
  await assertNoOutput(f, result);
});

test('Aside cancellation before spawn and during a real child is bounded and content-free', async t => {
  for (const before of [true, false]) {
    const f = await fixture(t);
    const controller = new AbortController();
    if (before) controller.abort(new Error('provider-secret'));
    let pid;
    const spawnImpl = fakeCli({ script: 'setInterval(() => {}, 1000);', inspect: () => {
      assert.equal(before, false);
      setTimeout(() => controller.abort(new Error('provider-secret')), 40);
    } });
    const result = await runAsideRewrite({ ...f, signal: controller.signal, tempRoot: f.temporary,
      spawnImpl: (...args) => { const child = spawnImpl(...args); pid = child.pid; return child; } });
    assert.equal(result.status, 'error');
    assert.equal(result.code, 'aborted');
    assert.equal(result.exitCode, 1);
    if (pid) {
      // Child close may follow the immediate rejection by one event-loop turn.
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    }
    await assertNoOutput(f, result);
    assert.doesNotMatch(JSON.stringify(result), /provider-secret/);
  }
});

test('Aside timeouts are bounded and reject invalid limits', async t => {
  for (const timeoutMs of [0, Infinity, NaN, -1, 300_001]) {
    const f = await fixture(t);
    const result = await runAsideRewrite({ ...f, timeoutMs, spawnImpl: () => { assert.fail('must not spawn'); } });
    assert.equal(result.code, 'invalid_timeout');
  }
  const f = await fixture(t);
  const result = await runAsideRewrite({ ...f, timeoutMs: 100, tempRoot: f.temporary,
    spawnImpl: fakeCli({ script: 'setInterval(() => {}, 1000);' }) });
  assert.equal(result.code, 'timeout');
  await assertNoOutput(f, result);
});

test('Aside shipped CLI enforces HARD_FAIL/floors and clears inherited voice while keeping configured backend/model', async t => {
  for (const scenario of ['pass', 'hard-fail', 'low-mps', 'low-fidelity']) {
    const source = 'The service retains 12 audit logs.';
    const f = await fixture(t, { source });
    const home = join(f.root, 'home');
    await mkdir(home);
    await writeFile(join(home, '.patina.yaml'), JSON.stringify({
      language: 'ko', 'document-type': 'formal', persona: 'natural-ko', register: 'casual',
      backend: 'openai-http', model: 'configured-model', verification: { 'mps-floor': 0, 'fidelity-floor': 0 },
    }));
    const requests = [];
    const server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body);
      requests.push(payload);
      const prompt = payload.messages.map(message => message.content).join('\n');
      let answer = source;
      if (prompt.includes('Meaning Preservation evaluator')) answer = JSON.stringify(scenario === 'hard-fail' ? highHardFailMps() : mpsResult(scenario === 'low-mps' ? 60 : 100));
      else if (prompt.includes('Fidelity evaluator')) answer = JSON.stringify({ claims_preserved: scenario === 'low-fidelity' ? 0 : 3,
        no_fabrication: scenario === 'low-fidelity' ? 0 : 3, audience_register_match: 3 });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: answer } }] }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      await writeFile(join(f.workspace, '.patina.yaml'), JSON.stringify({ baseURL: `http://127.0.0.1:${server.address().port}/v1`,
        persona: 'natural-ko', register: 'professional' }));
      const env = { ...process.env, HOME: home, USERPROFILE: home, PATINA_API_KEY: 'aside-local-test-key',
        PATINA_API_KEY_FILE: '', PATINA_BASE_URL: '', OPENAI_BASE_URL: '', PATINA_MODEL: '',
        TMPDIR: f.temporary };
      const result = await runAsideRewrite({ ...f, env, timeoutMs: 20_000, tempRoot: f.temporary });
      assert.equal(result.status, scenario === 'pass' ? 'verified' : 'rejected', JSON.stringify(result));
      assert.equal(result.verification.exitCode, scenario === 'pass' ? 0 : 4);
      assert.ok(requests.length >= 3);
      assert.ok(requests.every(request => request.model === 'configured-model'));
      const rewritePrompt = requests[0].messages.map(message => message.content).join('\n');
      assert.match(rewritePrompt, /Persona is omitted: preserve the source voice/);
      assert.match(rewritePrompt, /Register is omitted: preserve the source/);
      if (scenario === 'pass') assert.equal(await readFile(f.outputPath, 'utf8'), source);
      else await assertNoOutput(f, result);
      assert.equal(await readFile(f.inputPath, 'utf8'), source);
      assert.doesNotMatch(JSON.stringify(result), /aside-local-test-key|127\.0\.0\.1/);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }
});

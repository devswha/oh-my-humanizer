import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { getAsideChoices, normalizeAsideSettings, readAsideSettings, saveAsideSettings } from '../../src/aside/options.js';
import { listBackendNames } from '../../src/backends/index.js';
import { SUPPORTED_LANGS, WEB_DOCUMENT_TYPES, WEB_PERSONAS, WEB_REGISTERS } from '../../src/web-rewrite-contract.js';

const execute = promisify(execFile);
const optionsURL = new URL('../../src/aside/options.js', import.meta.url).href;

async function workspace(t) {
  const path = await mkdtemp(join(tmpdir(), 'aside-options-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('Aside choices use canonical lists, with no credential inspection or mutable shared entries', () => {
  const choices = getAsideChoices();
  assert.deepEqual(choices, {
    languages: ['auto', ...SUPPORTED_LANGS], documentTypes: [...WEB_DOCUMENT_TYPES],
    personas: WEB_PERSONAS, registers: [...WEB_REGISTERS], backends: listBackendNames(),
  });
  choices.personas.ko[0].label = 'changed';
  choices.backends.push('arbitrary-command');
  assert.equal(getAsideChoices().personas.ko[0].label, WEB_PERSONAS.ko[0].label);
  assert.deepEqual(getAsideChoices().backends, listBackendNames());
});

test('Aside normalizes safe unconfigured blog defaults and copies literal selections', () => {
  assert.deepEqual(normalizeAsideSettings(), {
    version: 1, language: 'auto', documentType: 'blog', persona: null, register: null,
    backend: null, model: null, protectedTerms: [],
  });
  const terms = ['Patina', '한글😀'];
  const settings = normalizeAsideSettings({ language: 'ko', persona: 'natural-ko', protectedTerms: terms });
  terms.push('later');
  assert.deepEqual(settings.protectedTerms, ['Patina', '한글😀']);
  assert.equal(normalizeAsideSettings({ language: 'en', persona: 'blog-essay' }).persona, 'blog-essay');
  assert.equal(normalizeAsideSettings({ language: 'ko', documentType: 'namuwiki' }).documentType, 'namuwiki');
});

test('Aside rejects unsupported fields, values, secrets, malformed text, and oversized term selections', () => {
  const invalid = [null, [], 'text', { version: 2 }, { version: '1' }, { schemaVersion: 1 },
    { apiKey: 'SECRET' }, { baseURL: 'https://secret.example' }, { draft: 'PRIVATE DRAFT' },
    { language: null }, { language: 'EN' }, { documentType: 'unknown' }, { documentType: null },
    { register: 'auto' }, { persona: '../secret' }, { language: 'en', persona: 'natural-ko' },
    { language: 'auto', persona: 'blog-essay' }, { persona: 'natural-ko' },
    { documentType: 'namuwiki' }, { language: 'en', documentType: 'namuwiki' },
    { backend: 'node' }, { backend: 'codex-cli,claude-cli' }, { backend: '' },
    ...['--model', 'model with spaces', 'model;exit', "model'", '$(whoami)', 'https://example.test/model',
      'sk-sensitive', 'Bearer-token', 'm'.repeat(161)].map(model => ({ model })),
    { protectedTerms: null }, { protectedTerms: [''] }, { protectedTerms: [' '] },
    { protectedTerms: ['a', 'a'] }, { protectedTerms: ['a\nb'] }, { protectedTerms: ['\uD800'] },
    { protectedTerms: ['a'.repeat(257)] }, { protectedTerms: Array.from({ length: 21 }, (_, i) => `term${i}`) },
    JSON.parse('{"__proto__": {"polluted":true}}'), Object.create({ language: 'en' }),
  ];
  for (const value of invalid) {
    assert.throws(() => normalizeAsideSettings(value), error => {
      assert.match(error.code, /^(?:invalid_|unknown_|unsupported_)/);
      assert.equal(error.message, error.code);
      assert.doesNotMatch(error.message, /SECRET|PRIVATE DRAFT|secret\.example/);
      return true;
    });
  }
  assert.equal(normalizeAsideSettings({ model: 'org/model-v2:tag' }).model, 'org/model-v2:tag');
});

test('Aside missing settings return schemaVersion and null hash without creating files', async t => {
  const root = await workspace(t);
  const result = await readAsideSettings(root);
  assert.deepEqual(result, { schemaVersion: 1, configured: false, settingsHash: null, settings: normalizeAsideSettings() });
  assert.deepEqual(await readdir(root), []);
});

test('Aside atomically saves private normalized JSON and stable hashes', async t => {
  const root = await workspace(t);
  const saved = await saveAsideSettings(root, { language: 'ja', protectedTerms: ['パティナ'] }, { expectedHash: null });
  assert.equal(saved.schemaVersion, 1);
  assert.equal(saved.configured, true);
  assert.match(saved.settingsHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(await readAsideSettings(root), saved);
  const same = await saveAsideSettings(root, saved.settings, { expectedHash: saved.settingsHash });
  assert.equal(same.settingsHash, saved.settingsHash);
  assert.deepEqual(await readdir(join(root, '.patina')), ['aside.json']);
  assert.deepEqual(JSON.parse(await readFile(join(root, '.patina', 'aside.json'), 'utf8')), saved.settings);
  if (process.platform !== 'win32') {
    assert.equal((await stat(join(root, '.patina'))).mode & 0o777, 0o700);
    assert.equal((await stat(join(root, '.patina', 'aside.json'))).mode & 0o777, 0o600);
  }
});

test('Aside compare-and-swap rejects stale and missing hashes with 409 and no lost writes', async t => {
  const root = await workspace(t);
  const first = await saveAsideSettings(root, {}, { expectedHash: null });
  for (const expectedHash of [null, '0'.repeat(64)]) {
    await assert.rejects(saveAsideSettings(root, { language: 'en' }, { expectedHash }), error => error.code === 'settings_changed' && error.statusCode === 409);
  }
  assert.deepEqual(await readAsideSettings(root), first);
  await assert.rejects(saveAsideSettings(root, {}, { expectedHash: 'SECRET' }), { code: 'invalid_expected_hash' });
});

test('Aside file lock serializes competing writers in separate processes', async t => {
  const root = await workspace(t);
  const first = await saveAsideSettings(root, {});
  const script = `
    const { saveAsideSettings } = await import(process.argv[1]);
    try {
      const saved = await saveAsideSettings(process.argv[2], { language: process.argv[3] }, { expectedHash: process.argv[4] });
      process.stdout.write(JSON.stringify(saved));
    } catch (error) { process.stdout.write(JSON.stringify({ code: error.code, statusCode: error.statusCode })); }
  `;
  const results = await Promise.all(['ko', 'en'].map(language => execute(process.execPath,
    ['--input-type=module', '-e', script, optionsURL, root, language, first.settingsHash], { timeout: 5000 })));
  const values = results.map(result => JSON.parse(result.stdout));
  assert.equal(values.filter(value => value.configured).length, 1);
  assert.deepEqual(values.find(value => value.code), { code: 'settings_changed', statusCode: 409 });
  assert.deepEqual(await readAsideSettings(root), values.find(value => value.configured));
  assert.deepEqual(await readdir(join(root, '.patina')), ['aside.json']);
});

test('Aside settings reject symlink directories and files without changing the outside target', async t => {
  const root = await workspace(t);
  const outside = await workspace(t);
  await writeFile(join(outside, 'aside.json'), 'PRIVATE TARGET');
  await symlink(outside, join(root, '.patina'), 'dir');
  await assert.rejects(readAsideSettings(root), { code: 'unsafe_settings_path' });
  await assert.rejects(saveAsideSettings(root, {}), { code: 'unsafe_settings_path' });
  await rm(join(root, '.patina'));
  await mkdir(join(root, '.patina'));
  await symlink(join(outside, 'aside.json'), join(root, '.patina', 'aside.json'));
  await assert.rejects(readAsideSettings(root), { code: 'settings_read_failed' });
  await assert.rejects(saveAsideSettings(root, {}), { code: 'unsafe_settings_path' });
  assert.equal(await readFile(join(outside, 'aside.json'), 'utf8'), 'PRIVATE TARGET');
  assert.deepEqual(await readdir(outside), ['aside.json']);
});

test('Aside settings reject corrupt, invalid UTF-8, oversized, and non-file JSON', async t => {
  const root = await workspace(t);
  await mkdir(join(root, '.patina'));
  const path = join(root, '.patina', 'aside.json');
  for (const [value, code] of [['PRIVATE DRAFT', 'invalid_settings_json'], [Buffer.from([0xC3, 0x28]), 'settings_read_failed'], [' '.repeat(16_385), 'settings_read_failed']]) {
    await writeFile(path, value);
    await assert.rejects(readAsideSettings(root), error => error.code === code && error.message === code);
  }
  await rm(path);
  await mkdir(path);
  await assert.rejects(readAsideSettings(root), { code: 'settings_read_failed' });
});

test('Aside settings reject an invalid workspace before writing', async t => {
  const root = await workspace(t);
  await assert.rejects(saveAsideSettings(join(root, 'missing'), {}), { code: 'invalid_workspace' });
  await assert.rejects(readAsideSettings(''), { code: 'invalid_workspace' });
  assert.deepEqual(await readdir(root), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { communitySource, installCommunityPack, listCommunityPacks, removeCommunityPack, validateCommunityManifest } from '../../src/community-patterns.js';
import { loadPatterns } from '../../src/loader.js';
import { runPattern } from '../../src/commands/pattern.js';

const SHA = 'a'.repeat(40);
const FILE = 'en-community-corporate-bizspeak.md';
const manifest = () => ({ name: 'en-corporate-bizspeak', version: '1.0.0', language: 'en', patterns: [FILE], compatibility: { min: '8.1.0', maxExclusive: '9.0.0' }, author: 'Test author', license: 'MIT' });
const pattern = `---\npack: en-community-corporate-bizspeak\nlanguage: en\nversion: 1.0.0\npatterns: 1\n---\n### 1. Corporate filler\n**Before:** We leverage the tool.\n**After:** We use the tool.\n`;

function fixture(t, pack = manifest()) {
  const repoRoot = mkdtempSync(join(tmpdir(), 'patina-community-test-'));
  t.after(() => rmSync(repoRoot, { recursive: true, force: true }));
  writeFileSync(join(repoRoot, 'package.json'), '{"version":"8.1.3"}');
  mkdirSync(join(repoRoot, 'patterns'));
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (url.startsWith('https://api.github.com/')) return new Response(JSON.stringify({ sha: SHA }));
    assert.ok(url.includes(`/${SHA}/`), 'every content read is pinned to one immutable commit');
    if (url.endsWith('/pack.yaml')) return new Response(yaml.dump(pack));
    return new Response(pattern);
  };
  return { repoRoot, fetchImpl, requests, version: '8.1.3' };
}

test('community pack installs, loads, lists and removes without credentials or built-in changes', async (t) => {
  const f = fixture(t);
  const builtIn = join(f.repoRoot, 'patterns/en-original.md');
  writeFileSync(builtIn, 'Built-in text');
  const result = await installCommunityPack('en-corporate-bizspeak', f);
  assert.equal(result.source.commit, SHA);
  assert.deepEqual(loadPatterns(f.repoRoot, 'en').map((p) => p.file), [FILE, 'en-original.md']);
  assert.deepEqual(loadPatterns(f.repoRoot, 'en', [FILE.slice(0, -3)]).map((p) => p.file), ['en-original.md']);
  assert.equal(listCommunityPacks(f.repoRoot)[0].status, 'installed');
  assert.equal(f.requests.length, 3);
  assert.ok(f.requests.every(({ options }) => options.redirect === 'error' && !options.headers.authorization));
  removeCommunityPack(result.name, f);
  assert.deepEqual(listCommunityPacks(f.repoRoot), []);
  assert.equal(readFileSync(builtIn, 'utf8'), 'Built-in text');
});

test('list is offline and install refuses existing managed or custom content', async (t) => {
  const f = fixture(t);
  const output = [];
  await runPattern(['list', '--json'], { ...f, fetchImpl: () => assert.fail('list must be offline'), out: (text) => output.push(JSON.parse(text)) });
  assert.deepEqual(output, [{ packs: [] }]);
  await installCommunityPack('en-corporate-bizspeak', f);
  await assert.rejects(installCommunityPack('en-corporate-bizspeak', f), /already installed/);
  removeCommunityPack('en-corporate-bizspeak', f);
  mkdirSync(join(f.repoRoot, 'custom/patterns'));
  writeFileSync(join(f.repoRoot, 'custom/patterns', FILE), 'User text');
  await assert.rejects(installCommunityPack('en-corporate-bizspeak', f), /collision/);
  assert.equal(readFileSync(join(f.repoRoot, 'custom/patterns', FILE), 'utf8'), 'User text');
});

test('edited packs are reported, never loaded or destructively removed', async (t) => {
  const f = fixture(t);
  const installed = await installCommunityPack('en-corporate-bizspeak', f);
  writeFileSync(join(installed.path, FILE), 'User changes');
  assert.equal(listCommunityPacks(f.repoRoot)[0].status, 'invalid');
  assert.throws(() => loadPatterns(f.repoRoot, 'en'), /local changes/);
  assert.throws(() => removeCommunityPack(installed.name, f), /local changes/);
  assert.equal(readFileSync(join(installed.path, FILE), 'utf8'), 'User changes');
});

test('source paths and metadata reject traversal, mixed language, hooks and unsupported versions', () => {
  assert.throws(() => communitySource('https://github.com/alice/packs/tree/main/packs/../other'), /dot segments/);
  for (const char of ['\t', '\n', '\r']) assert.throws(() => communitySource(`https://github.com/alice/packs/tree/main/packs/.${char}./other`), /control characters/);
  assert.throws(() => validateCommunityManifest({ ...manifest(), version: ['1.0.0'] }), /version/);
  assert.throws(() => validateCommunityManifest({ ...manifest(), author: '   ' }), /author/);
  for (const url of ['https://evil.test/a', 'http://github.com/a/b/tree/main/p', 'https://u:p@github.com/a/b/tree/main/p', 'https://github.com/a/b/tree/main/%2e%2e', 'https://github.com/a/b/tree/main/p?token=x', '../outside']) assert.throws(() => communitySource(url));
  assert.deepEqual(communitySource('https://github.com/alice/packs/tree/v1/packs/en-team'), { owner: 'alice', repo: 'packs', ref: 'v1', directory: 'packs/en-team' });
  for (const patch of [{ patterns: ['../outside.md'] }, { patterns: ['en-filler.md'] }, { language: 'ko' }, { scripts: { install: 'run' } }, { patterns: [FILE, FILE] }]) assert.throws(() => validateCommunityManifest({ ...manifest(), ...patch }, '8.1.3'));
  assert.throws(() => validateCommunityManifest(manifest(), '9.0.0'), /requires Patina/);
});

test('failed downloads cannot publish a partial pack', async (t) => {
  const f = fixture(t); const normal = f.fetchImpl;
  f.fetchImpl = (url, options) => url.endsWith(FILE) ? new Response('unavailable', { status: 503 }) : normal(url, options);
  await assert.rejects(installCommunityPack('en-corporate-bizspeak', f), /503/);
  assert.deepEqual(listCommunityPacks(f.repoRoot), []);
});

test('streaming download size limit works without a content-length header', async (t) => {
  const f = fixture(t); const normal = f.fetchImpl;
  f.fetchImpl = (url, options) => url.endsWith(FILE) ? new Response('x'.repeat(128 * 1024 + 1)) : normal(url, options);
  await assert.rejects(installCommunityPack('en-corporate-bizspeak', f), /128 KiB/);
  assert.deepEqual(listCommunityPacks(f.repoRoot), []);
});

test('early response rejection aborts the download before clearing its deadline', async (t) => {
  for (const response of [new Response('unavailable', { status: 503 }), new Response('large', { headers: { 'content-length': String(128 * 1024 + 1) } })]) {
    const f = fixture(t); let signal;
    f.fetchImpl = async (_url, options) => { signal = options.signal; return response; };
    await assert.rejects(installCommunityPack('en-corporate-bizspeak', f));
    assert.equal(signal.aborted, true);
  }
});

test('symlinked legacy custom packs load when no community subtree exists', (t) => {
  const f = fixture(t), outside = mkdtempSync(join(tmpdir(), 'patina-legacy-custom-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  mkdirSync(join(outside, 'patterns')); writeFileSync(join(outside, 'patterns/en-legacy.md'), 'Legacy custom text');
  symlinkSync(outside, join(f.repoRoot, 'custom'));
  assert.equal(loadPatterns(f.repoRoot, 'en')[0].body, 'Legacy custom text');
  assert.deepEqual(listCommunityPacks(f.repoRoot), []);
});

test('symlinked directories and installed files cannot escape the managed area', async (t) => {
  const f = fixture(t); const outside = mkdtempSync(join(tmpdir(), 'patina-community-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  symlinkSync(outside, join(f.repoRoot, 'custom'));
  await assert.rejects(installCommunityPack('en-corporate-bizspeak', f), /unsafe directory/);
  assert.deepEqual(readdirSync(outside), []);
  rmSync(join(f.repoRoot, 'custom'));
  const installed = await installCommunityPack('en-corporate-bizspeak', f);
  const target = join(outside, 'draft.md'); writeFileSync(target, 'Private draft');
  rmSync(join(installed.path, FILE)); symlinkSync(target, join(installed.path, FILE));
  assert.throws(() => loadPatterns(f.repoRoot, 'en'), /unsafe file/);
  assert.throws(() => removeCommunityPack(installed.name, f), /unsafe file/);
  assert.equal(readFileSync(target, 'utf8'), 'Private draft');
});

test('receipt traversal and additional files block removal', async (t) => {
  const f = fixture(t), installed = await installCommunityPack('en-corporate-bizspeak', f);
  const receiptPath = join(installed.path, 'installed.json');
  const original = readFileSync(receiptPath, 'utf8');
  const receipt = JSON.parse(original); receipt.hashes['../outside.md'] = 'x';
  writeFileSync(receiptPath, JSON.stringify(receipt));
  assert.throws(() => removeCommunityPack(installed.name, f), /unsafe installation receipt/);
  writeFileSync(receiptPath, original); writeFileSync(join(installed.path, 'my-notes.txt'), 'Keep me');
  assert.throws(() => removeCommunityPack(installed.name, f), /added or removed/);
  assert.equal(readFileSync(join(installed.path, 'my-notes.txt'), 'utf8'), 'Keep me');
});

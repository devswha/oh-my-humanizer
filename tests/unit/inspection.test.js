import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectText, normalizedOffsetMap } from '../../src/inspection.js';
import { loadConfig } from '../../src/config.js';

const sample = "In today's rapidly evolving landscape, this comprehensive solution unlocks unprecedented opportunities. Furthermore, it fosters seamless collaboration and takes productivity to the next level.";

test('inspection is backend-free and agrees with the existing offline CLI score', () => {
  const originalFetch = globalThis.fetch; globalThis.fetch = () => assert.fail('inspection called a provider');
  try {
    const result = inspectText(sample, { language: 'en' });
    assert.equal(result.available, true); assert.equal(result.deterministicOnly, true);
    assert.ok(result.diagnostics.length > 0);
    assert.ok(result.diagnostics.every((row) => row.start >= 0 && row.end <= sample.length && row.start < row.end));
    const cli = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('../../bin/patina.js', import.meta.url)), '--score', '--offline', '--format', 'json', '--lang', 'en'], { input: sample, encoding: 'utf8' }));
    assert.equal(result.score, cli.overall);
  } finally { globalThis.fetch = originalFetch; }
});

test('duplicate paragraphs and CRLF map to distinct source ranges', () => {
  const text = `${sample}\r\n\r\n${sample}`;
  const result = inspectText(text, { language: 'en' });
  const paragraphs = result.diagnostics.filter((row) => row.code === 'ai-like-paragraph');
  assert.equal(paragraphs.length, 2);
  assert.equal(text.slice(paragraphs[0].start, paragraphs[0].end), sample);
  assert.equal(text.slice(paragraphs[1].start, paragraphs[1].end), sample);
  assert.ok(paragraphs[1].start > paragraphs[0].end);
});

test('NFC and emoji offsets preserve whole original graphemes', () => {
  const source = `cafe\u0301 👩‍💻\r\n${sample}`;
  const map = normalizedOffsetMap(source);
  assert.equal(map.normalized, source.normalize('NFC'));
  const accent = map.normalized.indexOf('é');
  assert.equal(source.slice(map.starts[accent], map.ends[accent]), 'e\u0301');
  const result = inspectText(source, { language: 'en' });
  for (const row of result.diagnostics) assert.ok(row.end <= source.length);
});

test('disabled deterministic analysis is unavailable, never a perfect zero', () => {
  const config = loadConfig(); config.scoring.deterministic.enabled = false;
  const result = inspectText(sample, { language: 'en', config });
  assert.equal(result.available, false); assert.equal(result.score, null); assert.deepEqual(result.diagnostics, []);
});

test('inspection CLI emits bounded JSON with no raw text and rejects provider options', () => {
  const bin = fileURLToPath(new URL('../../bin/patina.js', import.meta.url));
  const raw = execFileSync(process.execPath, [bin, 'inspect', '--lang', 'en'], { input: sample, encoding: 'utf8' });
  const data = JSON.parse(raw); assert.equal(data.schemaVersion, 1); assert.equal(data.offsetEncoding, 'utf-16');
  assert.ok(!raw.includes(sample));
  assert.throws(() => execFileSync(process.execPath, [bin, 'inspect', '--provider', 'openai'], { input: sample, stdio: 'pipe' }));
  assert.throws(() => execFileSync(process.execPath, [bin, 'inspect', '-', 'README.md'], { input: sample, stdio: 'pipe' }));
  assert.throws(() => execFileSync(process.execPath, [bin, 'inspect', '--', '-', 'README.md'], { input: sample, stdio: 'pipe' }));
});

test('inspection honors excluded pattern packs', () => {
  const config = loadConfig(); config.documentType = 'social'; config['skip-patterns'] = ['en-style'];
  const result = inspectText('Good morning — see you at lunch.', { language: 'en', config });
  assert.equal(result.score, 0);
});

test('automatic Korean detection is invariant under NFC/NFD source encoding', () => {
  const text = '한국어 문장을 작성합니다. 오늘도 차분하게 이야기를 정리합니다.';
  const nfc = inspectText(text); const nfd = inspectText(text.normalize('NFD'));
  assert.equal(nfc.language, 'ko'); assert.equal(nfd.language, 'ko'); assert.equal(nfc.score, nfd.score);
  assert.notEqual(nfc.sourceHash, nfd.sourceHash);
});

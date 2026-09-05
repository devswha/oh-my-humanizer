import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createRewriteThread } from '../../playground/rewrite-client.js';
import {
  normalizePreferences, createThreadPreferences, readPresets, writePresets,
  saveNamedPreset, PRESET_STORAGE_KEY, PRESET_VERSION,
} from '../../playground/preferences.js';

const defaults = { lang: 'en', documentType: 'default', persona: '', register: '' };
const send = (thread, text = 'Refine this') => thread.buildRequest({ text, tier: 'free' });

test('conversation A/B preferences and payloads remain independent; defaults omit voice/register/document overrides', () => {
  const a = createRewriteThread({ lang: 'ko', documentType: 'namuwiki', persona: 'soft-professional', register: 'professional' });
  const b = createRewriteThread({ lang: 'ja', documentType: 'email', persona: 'natural-ja', register: 'casual' });
  a.commit({ userText: '원문 70%', assistantText: '원문 70%' });
  b.commit({ userText: '原文 80%', assistantText: '原文 80%' });
  a.updatePreferences({ documentType: 'blog', register: 'casual' });
  assert.deepEqual(a.preferences, { lang: 'ko', documentType: 'blog', persona: 'soft-professional', register: 'casual' });
  assert.deepEqual(b.preferences, { lang: 'ja', documentType: 'email', persona: 'natural-ja', register: 'casual' });
  assert.equal(send(a).original, '원문 70%');
  assert.equal(send(b).original, '原文 80%');
  assert.equal(send(a).lang, 'ko');
  assert.equal(send(a).persona, 'soft-professional');
  assert.equal(send(a).register, 'casual');
  assert.equal(send(b).documentType, 'email');
  a.updatePreferences({ persona: '', register: '', documentType: 'default' });
  for (const key of ['persona', 'register', 'documentType']) assert.equal(key in send(a), false);
  const snapshot = b.preferences;
  snapshot.persona = 'tampered';
  assert.equal(send(b).persona, 'natural-ja');
});

test('a conflicting language preset is rejected atomically after original anchoring', () => {
  const thread = createRewriteThread({ lang: 'ko', persona: 'soft-professional' });
  thread.commit({ userText: '원문', assistantText: '원문' });
  const before = thread.preferences;
  assert.equal(thread.updatePreferences({ lang: 'en', persona: 'natural-en', register: 'casual' }, { explicitLanguage: true }), false);
  assert.deepEqual(thread.preferences, before);
  thread.detectLanguage('ja');
  assert.equal(send(thread).lang, 'ko');
  assert.equal(send(thread).original, '원문');
  assert.equal(thread.updatePreferences({ register: 'professional' }), true);
  assert.equal(send(thread).register, 'professional');
});

test('first-turn detection preserves explicit language and valid settings; incompatible language-specific options drop safely', () => {
  const thread = createRewriteThread({ lang: 'ko', documentType: 'namuwiki', persona: 'soft-professional', register: 'professional' });
  thread.detectLanguage('ja');
  assert.deepEqual(thread.preferences, { lang: 'ja', documentType: 'default', persona: '', register: 'professional' });
  thread.updatePreferences({ lang: 'ko', persona: 'blog-essay' }, { explicitLanguage: true });
  thread.detectLanguage('en');
  assert.equal(send(thread).lang, 'ko');
  assert.equal(send(thread).persona, 'blog-essay');
  // No accepted original yet: failed requests do not lock a stale source language.
  assert.equal(thread.original, undefined);
  thread.updatePreferences({ lang: 'en' }, { explicitLanguage: true });
  assert.equal(send(thread).lang, 'en');
  assert.equal(send(thread).persona, 'blog-essay');
  thread.commit({ userText: 'source', assistantText: 'rewrite' });
  thread.reset();
  assert.equal(thread.updatePreferences({ lang: 'ko' }), true);
});

test('normalization accepts only contract settings and drops unknown persona, language, register, and Korean-only documents', () => {
  for (const input of [undefined, null, {}, { lang: 'fr', documentType: 'removed', persona: 'evil', register: 'formal' }]) {
    assert.deepEqual(normalizePreferences(input), defaults);
  }
  assert.equal(normalizePreferences({ lang: 'en', documentType: 'namuwiki' }).documentType, 'default');
  const prefs = createThreadPreferences({ lang: 'ko', persona: 'soft-professional' });
  const value = prefs.value;
  value.persona = 'x';
  assert.equal(prefs.value.persona, 'soft-professional');
});

function memoryStorage(raw = null) {
  let value = raw;
  return {
    getItem(key) { assert.equal(key, PRESET_STORAGE_KEY); return value; },
    setItem(key, next) { assert.equal(key, PRESET_STORAGE_KEY); value = next; },
    get value() { return value; },
  };
}

test('preset persistence strips secrets/text/history on write AND read, bounds count and allows named replacement/deletion', () => {
  const polluted = { ...defaults, apiKey: 'sk-secret', license: 'secret-license', text: 'private source', history: ['private history'], provider: 'openai', model: 'changed' };
  const storage = memoryStorage();
  const list = saveNamedPreset([], 'Work', polluted).presets;
  list[0].license = 'top-level-secret';
  assert.equal(writePresets(list, () => storage), true);
  assert.deepEqual(JSON.parse(storage.value), { version: PRESET_VERSION, presets: [{ name: 'Work', settings: defaults }] });
  assert.deepEqual(readPresets(() => storage).presets, [{ name: 'Work', settings: defaults }]);
  const imported = memoryStorage(JSON.stringify({ version: 1, presets: [{ name: 'Work', settings: polluted, license: 'more-secret' }] }));
  assert.deepEqual(readPresets(() => imported).presets, [{ name: 'Work', settings: defaults }]);
  const replaced = saveNamedPreset(list, ' Work ', { lang: 'ja', persona: 'natural-ja' });
  assert.equal(replaced.presets.length, 1);
  assert.equal(replaced.presets[0].settings.lang, 'ja');
  writePresets(replaced.presets.filter((p) => p.name !== 'Work'), () => storage);
  assert.deepEqual(readPresets(() => storage).presets, []);
  const twenty = Array.from({ length: 20 }, (_, i) => ({ name: `Preset ${i}`, settings: defaults }));
  assert.equal(saveNamedPreset(twenty, 'Twenty one', defaults).reason, 'limit');
  assert.equal(saveNamedPreset(twenty, 'Preset 0', defaults).ok, true);
  for (const name of ['', 'x'.repeat(41), 'sk_live_accidental_key', 'Bearer secret', 'a\nname', '550e8400-e29b-41d4-a716-446655440000']) {
    assert.equal(saveNamedPreset([], name, defaults).ok, false, name);
  }
});

test('unavailable storage, malformed JSON, old versions and unsupported personas do not break the rewrite session', () => {
  const unavailable = () => { throw new Error('SecurityError'); };
  assert.deepEqual(readPresets(unavailable), { presets: [], status: 'unavailable' });
  assert.equal(writePresets([], unavailable), false);
  assert.equal(writePresets([], () => ({ setItem() { throw new Error('QuotaExceededError'); } })), false);
  for (const raw of ['{bad', 'x'.repeat(16001), '{"version":1,"presets":{}}']) {
    assert.equal(readPresets(() => memoryStorage(raw)).status, 'invalid');
  }
  assert.equal(readPresets(() => memoryStorage('{"version":0,"presets":[]}')).status, 'version');
  const data = { version: 1, presets: [{ name: 'Old voice', settings: { lang: 'ja', persona: 'soft-professional', register: 'casual' } }, null] };
  const restored = readPresets(() => memoryStorage(JSON.stringify(data)));
  assert.equal(restored.presets[0].settings.persona, '');
  assert.equal(restored.presets[0].settings.register, 'casual');
  assert.equal(restored.presets.length, 1);
  const thread = createRewriteThread({ lang: 'en' });
  assert.equal(send(thread).mode, 'first');
});

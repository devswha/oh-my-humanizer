import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOptionsClient, createOptionsController, displayChoices, mountOptionsPage,
  parseProtectedTerms, readPayload, settingsFromDraft, takeSessionToken,
  textFor, validateSettings,
} from '../../assets/aside/options.js';

const token = 'local-session-capability-123456789';
const defaults = { language: 'auto', documentType: 'blog', persona: null, register: null, backend: null, model: null, protectedTerms: [] };
function payload(settings = {}, extra = {}) {
  return {
    schemaVersion: 1, configured: false, settingsHash: null,
    settings: { ...defaults, ...settings },
    choices: {
      languages: ['auto', 'ko', 'en', 'zh', 'ja'], documentTypes: ['blog', 'technical', 'namuwiki'],
      personas: {
        ko: [{ id: 'natural-ko', label: '담백한 한국어' }, { id: 'blog-essay', label: '개인 블로그 에세이' }],
        en: [{ id: 'natural-en', label: 'Plain English' }, { id: 'blog-essay', label: 'Personal blog essay' }],
        zh: [{ id: 'natural-zh', label: '朴素中文' }], ja: [{ id: 'natural-ja', label: '素朴な日本語' }],
      },
      registers: ['casual', 'professional'], backends: ['codex-cli', 'claude-cli', 'gemini-cli', 'kimi-cli'],
    },
    ...extra,
  };
}
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const rejected = (code) => Object.assign(new Error(code), { code });
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('the agreed wire shape preserves default source style and language-specific personas', () => {
  const loaded = readPayload(payload());
  assert.deepEqual(loaded.settings, defaults);
  assert.deepEqual(validateSettings(loaded.settings, loaded.choices), {});
  for (const lang of ['ko', 'en', 'zh', 'ja']) {
    const settings = { ...defaults, language: lang, persona: `natural-${lang}` };
    assert.deepEqual(validateSettings(settings, loaded.choices), {});
    assert.equal(displayChoices(loaded.choices, 'persona', settings).find((entry) => entry.value === `natural-${lang}`).disabled, false);
  }
});

test('optional labeled choices work without inventing allowed values', () => {
  const wire = payload();
  wire.choices.documentTypes.push({ value: 'future-type', label: { ko: '새 문서', en: 'New document' } });
  const loaded = readPayload(wire);
  const settings = { ...defaults, documentType: 'future-type' };
  assert.deepEqual(validateSettings(settings, loaded.choices), {});
  assert.equal(displayChoices(loaded.choices, 'documentType', settings, 'en').find((entry) => entry.value === 'future-type').label, 'New document');
  settings.documentType = 'unadvertised-type';
  assert.equal(validateSettings(settings, loaded.choices).documentType, 'unsupported');
  assert.equal(displayChoices(loaded.choices, 'documentType', settings).at(-1).value, 'unadvertised-type');
});

test('invalid loaded selections stay visible and block saving rather than becoming defaults', () => {
  const loaded = readPayload(payload({ language: 'en', documentType: 'namuwiki', persona: 'natural-ko', register: 'old-style', backend: 'removed-cli' }));
  assert.deepEqual(validateSettings(loaded.settings, loaded.choices), {
    documentType: 'namuwiki', persona: 'personaLanguage', register: 'unsupported', backend: 'unsupported',
  });
  for (const field of ['documentType', 'persona', 'register', 'backend']) {
    const current = displayChoices(loaded.choices, field, loaded.settings).find((entry) => entry.value === loaded.settings[field]);
    assert.ok(current, `still displays ${field}`);
    assert.equal(current.disabled, true);
  }
  assert.equal(loaded.settings.persona, 'natural-ko');
});

test('auto language disables every nonempty persona but lets the user explicitly preserve source', () => {
  const { settings, choices } = readPayload(payload({ persona: 'natural-ko' }));
  assert.equal(validateSettings(settings, choices).persona, 'personaAuto');
  const entries = displayChoices(choices, 'persona', settings);
  assert.equal(entries.find((entry) => entry.value === null).disabled, false);
  assert.ok(entries.filter((entry) => entry.value !== null).every((entry) => entry.disabled));
  assert.ok(entries.some((entry) => entry.value === 'natural-ko'));
  assert.deepEqual(validateSettings({ ...settings, persona: null }, choices), {});
});

test('unknown loaded languages, including object property names, stay visible without breaking the form', () => {
  for (const language of ['fr', 'constructor', '__proto__']) {
    const { settings, choices } = readPayload(payload({ language, persona: 'natural-ko' }));
    assert.equal(validateSettings(settings, choices).language, 'unsupported');
    assert.equal(validateSettings(settings, choices).persona, 'personaLanguage');
    assert.equal(displayChoices(choices, 'language', settings).at(-1).value, language);
    assert.equal(displayChoices(choices, 'persona', settings).at(-1).value, 'natural-ko');
  }
});

test('model IDs accept provider syntax and reject command-like input, whitespace and excessive length', () => {
  const { choices } = readPayload(payload());
  for (const model of [null, 'provider/model-v1.0:beta@2026+variant', 'a'.repeat(160)]) {
    assert.equal(validateSettings({ ...defaults, model }, choices).model, undefined);
  }
  for (const model of ['-flags', '../path', 'two models', 'x;echo', '$(secret)', 'x\ny', 'a'.repeat(161)]) {
    assert.equal(validateSettings({ ...defaults, model }, choices).model, 'modelInvalid');
  }
});

test('protected terms remain literal Unicode configuration with a 20-term cap', () => {
  const { choices } = readPayload(payload());
  const terms = parseProtectedTerms(' Patina \r\n\r\n제품 이름\n<literal & name>\n保護語\r固有名詞 ');
  assert.deepEqual(terms, ['Patina', '제품 이름', '<literal & name>', '保護語', '固有名詞']);
  assert.deepEqual(validateSettings({ ...defaults, protectedTerms: terms }, choices), {});
  const twenty = Array.from({ length: 20 }, (_, index) => `Name ${index}`);
  assert.equal(validateSettings({ ...defaults, protectedTerms: twenty }, choices).protectedTerms, undefined);
  assert.equal(validateSettings({ ...defaults, protectedTerms: [...twenty, 'extra'] }, choices).protectedTerms, 'termsLimit');
  assert.equal(validateSettings({ ...defaults, protectedTerms: ['private\u0000term'] }, choices).protectedTerms, 'termsInvalid');
});

test('payload parsing rejects incompatible protocol data and never substitutes missing selections', () => {
  for (const bad of [null, {}, payload({}, { schemaVersion: 2 }), payload({}, { settingsHash: 3 }), payload({}, { configured: 'yes' }), payload({}, { choices: {} })]) {
    assert.throws(() => readPayload(bad), { code: 'protocol' });
  }
  const bad = payload(); delete bad.settings.persona;
  assert.throws(() => readPayload(bad), { code: 'protocol' });
  assert.throws(() => readPayload(payload({ protectedTerms: ['multiple\nlines'] })), { code: 'protocol' });
});

test('fragment tokens survive reload and are never read from query parameters', () => {
  for (const capability of [token, 'a'.repeat(64)]) {
    for (const hash of [`#${capability}`, `#token=${capability}`]) {
      const location = { hash, pathname: '/', search: '?view=options' };
      assert.equal(takeSessionToken(location), capability);
      assert.equal(location.hash, hash);
      assert.equal(takeSessionToken(location), capability, 'reload can read the same fragment');
    }
  }
  for (const hash of ['', '#short', '#%ZZ', '#token=bad%0Aheader']) {
    assert.equal(takeSessionToken({ hash, pathname: '/', search: `?token=${token}` }), '');
  }
});

test('the client authenticates only a fixed local endpoint and POSTs only settings plus the base hash', async () => {
  const requests = [];
  const client = createOptionsClient({ token, fetchImpl: async (url, options) => { requests.push({ url, ...options }); return response(payload()); } });
  await client.load();
  await client.save({ ...defaults, protectedTerms: ['Private product'], draft: 'NEVER SEND', apiKey: 'NEVER SEND' }, 'previous-hash');
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.url, '/api/options');
    assert.equal(request.headers['X-Patina-Session'], token);
    assert.equal(request.credentials, 'omit');
    assert.equal(request.cache, 'no-store');
    assert.equal(request.redirect, 'error');
    assert.equal(request.referrerPolicy, 'no-referrer');
  }
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].body, undefined);
  assert.equal(requests[1].method, 'POST');
  assert.deepEqual(JSON.parse(requests[1].body), { settings: { ...defaults, protectedTerms: ['Private product'] }, baseHash: 'previous-hash' });
  assert.ok(!requests[1].body.includes(token));
});

test('client errors do not expose arbitrary server response text and missing tokens send nothing', async () => {
  let calls = 0;
  const missing = createOptionsClient({ token: '', fetchImpl: async () => { calls++; } });
  await assert.rejects(missing.load(), { code: 'missingToken' });
  assert.equal(calls, 0);
  for (const [status, code] of [[401, 'unauthorized'], [403, 'unauthorized'], [410, 'unauthorized'], [409, 'conflict'], [400, 'rejected'], [503, 'server']]) {
    const client = createOptionsClient({ token, fetchImpl: async () => ({ ok: false, status, json() { throw new Error('private server detail must not be read'); } }) });
    await assert.rejects(client.load(), { code, message: code });
  }
  const invalid = createOptionsClient({ token, fetchImpl: async () => response({ token, error: 'sensitive local path' }) });
  await assert.rejects(invalid.load(), { code: 'protocol' });
});

test('a timed-out request aborts and surfaces a recoverable connection error', async () => {
  let signal;
  const client = createOptionsClient({ token, timeoutMs: 5, fetchImpl: async (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  await assert.rejects(client.load(), { code: 'network' });
  assert.equal(signal.aborted, true);
});

test('the controller saves one snapshot, blocks duplicate submissions, and carries the new hash into later edits', async () => {
  const pending = deferred();
  const saves = [];
  const controller = createOptionsController({ client: {
    load: async () => readPayload(payload()),
    save: async (settings, hash) => { saves.push({ settings, hash }); return saves.length === 1 ? pending.promise : readPayload(payload(settings, { configured: true, settingsHash: 'hash-two' })); },
  } });
  await controller.load();
  controller.update('protectedTerms', 'Patina\nAside');
  controller.update('model', ' provider/model ');
  const saving = controller.save();
  assert.equal(controller.getState().phase, 'saving');
  assert.equal(await controller.save(), false);
  controller.update('language', 'en');
  assert.equal(controller.getState().draft.language, 'auto');
  assert.deepEqual(saves[0], { settings: { ...defaults, model: 'provider/model', protectedTerms: ['Patina', 'Aside'] }, hash: null });
  pending.resolve(readPayload(payload(saves[0].settings, { configured: true, settingsHash: 'hash-one' })));
  assert.equal(await saving, true);
  assert.equal(controller.getState().phase, 'saved');
  assert.equal(controller.getState().dirty, false);
  controller.update('register', 'professional');
  assert.equal(await controller.save(), true);
  assert.equal(saves[1].hash, 'hash-one');
});

test('a conflict blocks another write until explicit reload, including when the first reload fails', async () => {
  let loads = 0; let saves = 0;
  const controller = createOptionsController({ client: {
    load: async () => {
      loads++;
      if (loads === 2) throw rejected('network');
      return readPayload(payload({ language: loads === 1 ? 'ko' : 'en' }, { configured: true, settingsHash: `hash-${loads}` }));
    },
    save: async (settings, hash) => {
      saves++;
      if (saves === 1) throw rejected('conflict');
      assert.equal(hash, 'hash-3');
      return readPayload(payload(settings, { configured: true, settingsHash: 'hash-4' }));
    },
  } });
  await controller.load(); controller.update('register', 'casual');
  assert.equal(await controller.save(), false);
  assert.equal(controller.getState().problem, 'conflict');
  assert.equal(await controller.save(), false);
  assert.equal(saves, 1);
  assert.equal(await controller.load(), false);
  assert.equal(controller.getState().conflict, true);
  assert.equal(controller.getState().draft.register, 'casual');
  assert.equal(await controller.save(), false);
  await controller.load();
  assert.equal(controller.getState().draft.language, 'en');
  assert.equal(controller.getState().draft.register, null);
  assert.equal(await controller.save(), true);
});

test('language changes keep an incompatible current persona and block requests until explicitly corrected', async () => {
  let saves = 0;
  const controller = createOptionsController({ client: {
    load: async () => readPayload(payload({ language: 'ko', persona: 'natural-ko' })),
    save: async (settings) => { saves++; return readPayload(payload(settings)); },
  } });
  await controller.load(); controller.update('language', 'auto');
  assert.equal(controller.getState().draft.persona, 'natural-ko');
  assert.equal(await controller.save(), false);
  assert.equal(saves, 0);
  controller.update('persona', null);
  assert.equal(await controller.save(), true);
});

test('failed saves retain editable input and can be retried without a settings reload', async () => {
  let attempts = 0;
  const controller = createOptionsController({ client: {
    load: async () => readPayload(payload()),
    save: async (settings) => { if (++attempts === 1) throw rejected('network'); return readPayload(payload(settings, { configured: true, settingsHash: 'saved' })); },
  } });
  await controller.load(); controller.update('protectedTerms', 'Private name');
  assert.equal(await controller.save(), false);
  assert.equal(controller.getState().draft.protectedTerms, 'Private name');
  assert.equal(controller.getState().dirty, true);
  assert.equal(await controller.save(), true);
  assert.equal(attempts, 2);
});

test('an expired session leaves the input available but blocks further save requests', async () => {
  let saves = 0;
  const controller = createOptionsController({ client: {
    load: async () => readPayload(payload()),
    save: async () => { saves++; throw rejected('unauthorized'); },
  } });
  await controller.load(); controller.update('protectedTerms', 'My product');
  assert.equal(await controller.save(), false);
  controller.update('protectedTerms', 'Updated product');
  assert.equal(controller.getState().draft.protectedTerms, 'Updated product');
  assert.equal(controller.getState().problem, 'unauthorized');
  assert.equal(await controller.save(), false);
  assert.equal(saves, 1);
});

// A deliberately small DOM seam exercises actual event/render wiring. It is
// not a layout or native Aside-browser claim; the parent runs real-browser QA.
function pageHarness(fetchImpl, hash = `#token=${token}`) {
  class Element {
    value = ''; textContent = ''; disabled = false; hidden = false; dataset = {}; children = []; attributes = {}; listeners = new Map();
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    setAttribute(name, value) { this.attributes[name] = value; }
    replaceChildren(...children) { this.children = children; }
    focus() { this.focused = true; }
    async dispatch(type, data = {}) { return this.listeners.get(type)?.({ target: this, preventDefault() {}, ...data }); }
  }
  const nodes = new Map();
  const doc = {
    documentElement: {}, title: '',
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); },
    createElement() { return new Element(); },
    querySelectorAll() { return []; },
  };
  const historyCalls = [];
  const listeners = new Map();
  const browser = {
    fetch: fetchImpl, location: { hash, pathname: '/options.html', search: '' },
    history: { replaceState: (...args) => historyCalls.push(args) },
    addEventListener: (type, listener) => listeners.set(type, listener),
  };
  return { doc, browser, node: (id) => doc.getElementById(id), historyCalls, listeners };
}

test('mounted page wires bilingual labels, accessible errors, pending locks, and save completion', async () => {
  const saving = deferred();
  const requests = [];
  const page = pageHarness(async (_url, options) => {
    requests.push(options);
    return options.method === 'POST' ? saving.promise : response(payload());
  });
  const mounted = mountOptionsPage(page.doc, page.browser);
  assert.equal(page.node('save').disabled, true);
  assert.equal(page.node('options-form').attributes['aria-busy'], 'true');
  await mounted.ready;
  assert.equal(page.doc.documentElement.lang, 'ko');
  assert.equal(page.node('save').disabled, false);
  assert.equal(page.node('language').value, 'auto');
  assert.equal(page.node('persona').value, '');
  assert.ok(page.node('persona').children.filter((entry) => entry.value).every((entry) => entry.disabled));
  page.node('ui-language').value = 'en'; await page.node('ui-language').dispatch('change');
  assert.equal(page.doc.documentElement.lang, 'en');
  assert.equal(page.node('language').children[0].textContent, 'Auto detect');
  page.node('model').value = '--bad'; await page.node('model').dispatch('input');
  assert.equal(page.node('model').attributes['aria-invalid'], 'true');
  assert.equal(page.node('model-error').hidden, false);
  assert.equal(page.node('save').disabled, true);
  await page.node('options-form').dispatch('submit');
  assert.equal(page.node('model').focused, true);
  assert.equal(requests.length, 1);
  page.node('model').value = ''; await page.node('model').dispatch('input');
  page.node('protectedTerms').value = '<private name>\nPatina'; await page.node('protectedTerms').dispatch('input');
  assert.equal(page.node('terms-count').textContent, '2 / 20');
  const submit = page.node('options-form').dispatch('submit');
  assert.equal(page.node('settings-fields').disabled, true);
  assert.equal(page.node('save').disabled, true);
  saving.resolve(response(payload(JSON.parse(requests[1].body).settings, { configured: true, settingsHash: 'new-hash' })));
  await submit;
  assert.equal(page.node('status').textContent, textFor('en', 'saved'));
  assert.equal(page.node('settings-fields').disabled, false);
  assert.equal(page.node('save').disabled, false);
  assert.equal(page.node('protectedTerms').value, '<private name>\nPatina');
  assert.deepEqual(page.historyCalls, []);
  assert.equal(page.browser.location.hash, `#token=${token}`);
});

test('mounted page conflict recovery requires reload and keeps language selection local to the UI', async () => {
  let getCalls = 0;
  const page = pageHarness(async (_url, options) => {
    if (options.method === 'POST') return response({}, 409);
    getCalls++;
    return response(payload({ language: getCalls === 1 ? 'ko' : 'ja' }, { configured: true, settingsHash: `hash-${getCalls}` }));
  });
  const { ready } = mountOptionsPage(page.doc, page.browser); await ready;
  page.node('ui-language').value = 'en'; await page.node('ui-language').dispatch('change');
  assert.equal(page.node('language').value, 'ko', 'page language does not change draft language');
  page.node('register').value = 'casual'; await page.node('register').dispatch('change');
  await page.node('options-form').dispatch('submit');
  assert.equal(page.node('settings-fields').disabled, true);
  assert.equal(page.node('save').disabled, true);
  assert.equal(page.node('reload').hidden, false);
  assert.equal(page.node('error').textContent, textFor('en', 'conflict'));
  await page.node('reload').dispatch('click');
  assert.equal(page.node('language').value, 'ja');
  assert.equal(page.node('register').value, '');
  assert.equal(page.node('settings-fields').disabled, false);
});

test('mounted page missing session sends no request and initial network errors offer reconnection', async () => {
  let requests = 0;
  const missing = pageHarness(async () => { requests++; }, '');
  await mountOptionsPage(missing.doc, missing.browser).ready;
  assert.equal(requests, 0);
  assert.equal(missing.node('save').disabled, true);
  assert.equal(missing.node('error').textContent, textFor('ko', 'missingToken'));
  const offline = pageHarness(async () => { if (++requests === 1) throw new Error('connection refused'); return response(payload()); });
  await mountOptionsPage(offline.doc, offline.browser).ready;
  assert.equal(offline.node('reload').hidden, false);
  assert.equal(offline.node('settings-fields').disabled, true);
  await offline.node('reload').dispatch('click');
  assert.equal(offline.node('save').disabled, false);
});

test('converting a draft emits exactly the seven supported settings', () => {
  assert.deepEqual(settingsFromDraft({ ...defaults, persona: '', backend: '', register: '', model: '  ', protectedTerms: 'Patina\nAside', autoBlog: true, apiKey: 'not-a-setting' }), { ...defaults, protectedTerms: ['Patina', 'Aside'] });
});

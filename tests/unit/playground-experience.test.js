// Execute the actual controller with a small DOM adapter and injected transport.
// This checks control/state/payload wiring; layout/browser QA is a separate gate.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as client from '../../playground/rewrite-client.js';
import * as preferences from '../../playground/preferences.js';
import * as copy from '../../playground/experience-copy.js';
import * as contract from '../../src/web-rewrite-contract.js';
import * as protection from '../../playground/protected-input.js';
import { createEditReview } from '../../playground/edit-review.js';

const html = readFileSync(new URL('../../playground/index.html', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../../playground/chatgpt.js', import.meta.url), 'utf8')
  .replace(/^import\s[\s\S]*?;$/gm, '');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this._value = undefined;
    this._text = '';
    this.scrollHeight = 24;
    this.classList = {
      contains: (value) => this.className.split(' ').includes(value),
      add: (...values) => { this.className = [...new Set([...this.className.split(' '), ...values])].join(' ').trim(); },
      remove: (...values) => { this.className = this.className.split(' ').filter((v) => !values.includes(v)).join(' '); },
      toggle: (value, force) => {
        const enabled = force ?? !this.classList.contains(value);
        this.classList[enabled ? 'add' : 'remove'](value); return enabled;
      },
    };
  }
  get className() { return this.attributes.class || ''; }
  set className(value) { this.attributes.class = value; }
  get id() { return this.attributes.id; }
  set id(value) { this.attributes.id = value; }
  get options() { return this.children.filter((c) => c.tagName === 'option'); }
  get value() {
    if (this.tagName === 'select') return this.options.find((o) => o.value === this._value)?.value ?? (this._value === undefined ? this.options[0]?.value || '' : '');
    return this._value ?? this.attributes.value ?? '';
  }
  set value(value) { this._value = value; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(value) { this.children = []; this._text = String(value ?? ''); }
  set innerHTML(value) { assert.equal(value, ''); this.children = []; this._text = ''; this._value = undefined; }
  get disabled() { return 'disabled' in this.attributes; }
  set disabled(value) { this.toggleAttribute('disabled', value); }
  get hidden() { return 'hidden' in this.attributes; }
  set hidden(value) { this.toggleAttribute('hidden', value); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  toggleAttribute(name, force) { if (force) this.attributes[name] = ''; else delete this.attributes[name]; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  append(...children) { children.forEach((c) => this.appendChild(c)); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((c) => c !== this); this.parentElement = null; }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  emit(name, extra = {}) { if (name === 'click' && this.disabled) return; for (const fn of this.listeners[name] || []) fn({ preventDefault() {}, ...extra }); }
  focus() { this.focused = true; }
  matches(selector) {
    const attr = selector.match(/\[([^=\]]+)="([^"]*)"\]/);
    if (attr && (attr[1] === 'value' ? this.value : this.getAttribute(attr[1])) !== attr[2]) return false;
    if (selector.endsWith(':last-child') && this.parentElement?.children.at(-1) !== this) return false;
    const simple = selector.replace(/\[.*?\]|:last-child/g, '');
    if (simple.startsWith('#')) return this.id === simple.slice(1);
    if (simple.startsWith('.')) return this.classList.contains(simple.slice(1));
    return this.tagName === simple;
  }
  querySelectorAll(selector) {
    const parts = selector.split(',').map((s) => s.trim().split(/\s+/));
    const descendants = (node) => node.children.flatMap((c) => [c, ...descendants(c)]);
    return descendants(this).filter((node) => parts.some((path) => {
      if (!node.matches(path.at(-1))) return false;
      let parent = node.parentElement;
      for (let i = path.length - 2; i >= 0; i--) {
        while (parent && !parent.matches(path[i])) parent = parent.parentElement;
        if (!parent) return false;
        parent = parent.parentElement;
      }
      return true;
    }));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function documentFixture() {
  const document = new Element('document');
  const stack = [document];
  for (const match of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<\/?[a-z][^>]*>|[^<]+/g)) {
    const token = match[0];
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (!token.startsWith('<')) { stack.at(-1)._text += token; continue; }
    const tag = token.match(/^<([a-z0-9]+)/)[1];
    const node = new Element(tag);
    for (const attr of token.matchAll(/\s([\w-]+)(?:="([^"]*)")?/g)) node.setAttribute(attr[1], attr[2] ?? '');
    stack.at(-1).appendChild(node);
    if (!['meta', 'link', 'img', 'input', 'br', 'hr'].includes(tag) && !token.endsWith('/>')) stack.push(node);
  }
  document.documentElement = document.querySelector('html');
  document.createElement = (tag) => new Element(tag);
  document.createTextNode = (text) => { const node = new Element('#text'); node.textContent = text; return node; };
  return document;
}

function app({ response, storage = new Map() } = {}) {
  const document = documentFixture();
  const calls = [];
  const context = vm.createContext({
    ...contract, ...client, ...preferences, ...copy, ...protection, createEditReview,
    launchConfig: { schemaVersion: 1, enabled: false },
    document,
    Option: class extends Element { constructor(label, value) { super('option'); this.textContent = label; this.value = value; } },
    AbortController, URL, URLSearchParams: globalThis.URLSearchParams, setTimeout, clearTimeout,
    requestAnimationFrame() {}, addEventListener() {}, scrollTo() {},
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    streamRewrite: async (options) => {
      calls.push(options);
      if (response) return response(options);
      options.onStart?.({ type: 'start' });
      const frame = { type: 'done', rewrite: 'Accepted 70%', mps: 70, fidelity: 70 };
      options.onDone(frame);
      return { ok: true, finalFrame: frame };
    },
    // These injected wrappers resolve this fixture's storage, not Node global storage.
    readPresets: () => preferences.readPresets(() => context.localStorage),
    writePresets: (items) => preferences.writePresets(items, () => context.localStorage),
  });
  vm.runInContext(controller + '\nglobalThis.ui = { state, submit, activeConvo, newConvo, selectConvo, readControls, failureMessage, addRecovery };', context);
  return { document, calls, storage, context, ui: context.ui, get: (id) => document.querySelector(`#${id}`) };
}
function change(app, id, value) { const node = app.get(id); node.value = value; node.emit('change'); }
function controls(app) { return JSON.parse(JSON.stringify(app.ui.readControls())); }

test('verification credential recovery does not turn its selection into a composer rewrite', () => {
  const a = app();
  const body = a.document.createElement('div');
  a.ui.addRecovery(body, { convo: a.ui.activeConvo(), epoch: a.ui.state.sessionEpoch,
    clean: 'Selected draft must not be generated again.', reqBody: { mode: 'verify', tier: 'pro' } }, 'credentials');
  body.querySelector('.retrybtn').emit('click');
  assert.equal(a.get('input').value, '');
  assert.equal(a.calls.length, 0);
  assert.equal(a.get('license-key').focused, true);
  assert.equal(a.get('send').disabled, true);
});

for (const lang of contract.SUPPORTED_LANGS) {
  test(`${lang}: actual Pro controls apply a memory-only key, validate on first request and route existing buyers to it`, async () => {
    const a = app();
    change(a, 'lang', lang);
    a.get('pro-existing').emit('click');
    assert.equal(a.get('tier').value, 'pro');
    assert.equal(a.get('pro-row').hidden, false);
    assert.equal(a.get('license-key').focused, true);
    a.get('license-key').value = 'private-license';
    a.get('license-sign-in').emit('click');
    const t = copy.experienceCopy(lang);
    assert.equal(a.get('license-sign-in').textContent, t.signIn);
    assert.equal(a.get('license-status').textContent, t.licenseStates.pending);
    assert.equal(a.calls.length, 0, 'apply is not authentication');
    await a.ui.submit('A source 70%', 'hero');
    assert.equal(a.calls[0].body.lang, lang, 'an explicit language survives script detection');
    assert.equal(a.calls[0].authorization, 'Bearer private-license');
    assert.equal('license' in a.calls[0].body, false);
    assert.equal(a.get('license-status').textContent, t.licenseStates.validated);
    assert.equal(a.ui.activeConvo().thread.original, 'A source 70%', '70/70 is accepted');
    a.get('preset-name').value = 'Work';
    a.get('preset-save').emit('click');
    assert.doesNotMatch([...a.storage.values()].join(''), /private-license|A source|Accepted|history|authorization|apiKey/);
    assert.equal(a.get('pro-portal').hidden, true, 'unconfigured portal stays hidden');
    assert.equal(a.document.querySelector('.price__badge').textContent, t.proBadge);
    assert.equal(a.document.querySelectorAll('.price')[1].querySelector('.price__name').textContent, 'BYOK');
  });
}

test('actual A/B switches restore all controls and next payload; conflicting language selection is visibly rejected', async () => {
  const a = app();
  change(a, 'lang', 'ko'); change(a, 'document-type', 'namuwiki'); change(a, 'persona', 'soft-professional'); change(a, 'register', 'professional');
  await a.ui.submit('원문 70%');
  const first = a.ui.activeConvo();
  a.get('new-chat').emit('click');
  change(a, 'lang', 'ja'); change(a, 'document-type', 'email'); change(a, 'persona', 'natural-ja'); change(a, 'register', 'casual');
  await a.ui.submit('原文 70%');
  const second = a.ui.activeConvo();
  a.get('history').children[1].emit('click');
  assert.deepEqual(controls(a), { lang: 'ko', documentType: 'namuwiki', persona: 'soft-professional', register: 'professional' });
  await a.ui.submit('더 짧게', 'chat');
  assert.equal(a.calls.at(-1).body.original, '원문 70%');
  assert.equal(a.calls.at(-1).body.lang, 'ko');
  assert.equal(a.calls.at(-1).body.persona, 'soft-professional');
  change(a, 'lang', 'en');
  assert.equal(a.get('lang').value, 'ko');
  assert.equal(a.get('settings-status').textContent, copy.experienceCopy('ko').languageLocked);
  a.ui.selectConvo(second);
  assert.deepEqual(controls(a), { lang: 'ja', documentType: 'email', persona: 'natural-ja', register: 'casual' });
  change(a, 'register', '');
  await a.ui.submit('短く', 'chat');
  assert.equal('register' in a.calls.at(-1).body, false);
  assert.equal(a.calls.at(-1).body.original, '原文 70%');
  a.ui.selectConvo(first);
  assert.equal(a.get('register').value, 'professional');
});

test('actual presets apply/delete/restore safely and reject a conflicting language without partial updates', async () => {
  const a = app();
  change(a, 'lang', 'ko'); change(a, 'persona', 'soft-professional');
  a.get('preset-name').value = '한국어'; a.get('preset-save').emit('click');
  const storage = a.storage;
  change(a, 'lang', 'en'); change(a, 'document-type', 'email');
  await a.ui.submit('Source');
  const before = controls(a);
  a.get('preset-select').value = '한국어'; a.get('preset-select').emit('change'); a.get('preset-apply').emit('click');
  assert.deepEqual(controls(a), before);
  assert.equal(a.get('preset-status').textContent, copy.experienceCopy('en').languageLocked);
  a.get('new-chat').emit('click'); a.get('preset-apply').emit('click');
  assert.equal(controls(a).lang, 'ko');
  assert.equal(controls(a).persona, 'soft-professional');
  const reloaded = app({ storage });
  assert.equal(reloaded.get('preset-select').options[1].value, '한국어');
  assert.deepEqual(controls(reloaded), { lang: 'en', documentType: 'default', persona: '', register: '' });
  reloaded.get('preset-select').value = '한국어'; reloaded.get('preset-select').emit('change'); reloaded.get('preset-delete').emit('click');
  assert.equal(reloaded.get('preset-select').options.length, 1);
});

for (const [status, error, kind] of [
  [401, 'pro license required', 'AUTH_REQUIRED'], [403, 'license not entitled', 'AUTH_DENIED'],
  [429, 'monthly rewrite limit reached', 'QUOTA_MONTHLY_REQUESTS'],
  [429, 'monthly character limit reached', 'QUOTA_MONTHLY_CHARS'],
  [429, 'monthly processing attempt limit reached', 'QUOTA_MONTHLY_PROCESSING'],
  [429, 'undocumented limit', 'QUOTA_UNKNOWN'],
]) {
  for (const lang of contract.SUPPORTED_LANGS) {
    test(`${lang}: ${status} ${error} renders distinct recovery and never replays the failed request`, async () => {
      const a = app({ response: () => ({ ok: false, finalFrame: { status, error } }) });
      change(a, 'lang', lang); a.get('pro-existing').emit('click');
      a.get('license-key').value = 'private-license'; a.get('license-sign-in').emit('click');
      await a.ui.submit('Source');
      const K = client.REWRITE_ERROR_KINDS;
      const classified = client.classifyRewriteError({ status, error });
      assert.equal(classified, K[kind]);
      const message = a.document.querySelector('.error-note').textContent;
      const recovery = a.document.querySelector('.retrybtn');
      const t = copy.experienceCopy(lang);
      const localized = ({ AUTH_REQUIRED: 'authRequired', AUTH_DENIED: 'authDenied', QUOTA_MONTHLY_REQUESTS: 'monthlyRequests', QUOTA_MONTHLY_CHARS: 'monthlyChars', QUOTA_MONTHLY_PROCESSING: 'monthlyProcessing', QUOTA_UNKNOWN: 'quotaUnknown' })[kind];
      assert.equal(message, t[localized]);
      assert.equal(a.ui.activeConvo().thread.original, undefined);
      assert.notEqual(client.rewriteRecovery(classified), 'retry');
      recovery.emit('click');
      assert.equal(a.calls.length, 1);
      assert.equal(a.get('input').value, 'Source');
      if (status === 401 || status === 403) {
        assert.equal(a.ui.state.license, '');
        assert.equal(a.get('license-key').disabled, false);
        assert.equal(a.get('license-status').textContent, t.licenseStates.rejected);
        await a.ui.submit('Source', 'chat');
        assert.equal(a.calls.length, 1, 'missing key blocks another network request');
      }
    });
  }
}

test('below-floor output cannot commit even when the Pro license was accepted', async () => {
  const a = app({ response(options) {
    options.onStart();
    const frame = { type: 'done', rewrite: 'Unacceptable', mps: 69, fidelity: 100 };
    options.onDone(frame);
    return { ok: true, finalFrame: frame };
  } });
  a.get('pro-existing').emit('click');
  a.get('license-key').value = 'private-license'; a.get('license-sign-in').emit('click');
  await a.ui.submit('Source');
  assert.equal(a.ui.activeConvo().thread.original, undefined);
  assert.equal(a.ui.activeConvo().messages.filter((m) => m.role === 'assistant').length, 0);
  assert.equal(a.document.querySelector('.output-action'), null);
});

test('license status cannot report success on apply, network failure or infrastructure denial', () => {
  let status = copy.licenseStatusAfter('empty', 'apply');
  assert.equal(status, 'pending');
  status = copy.licenseStatusAfter(status, 'request');
  assert.equal(copy.licenseStatusAfter(status, 'end'), 'unconfirmed');
  assert.equal(copy.licenseStatusAfter(status, 'denied'), 'rejected');
  assert.equal(copy.licenseStatusAfter(status, 'accepted'), 'validated');
});

test('portal links require an explicit safe Polar customer portal; no checkout-derived URL', () => {
  for (const config of [null, {}, { checkoutOrigin: 'https://polar.sh', checkoutPath: '/checkout/test' },
    ...['https://evil.invalid/org/portal', 'javascript:alert(1)', 'https://polar.sh.evil.invalid/org/portal', 'https://user@polar.sh/org/portal', 'https://polar.sh/org/portal?key=secret', 'https://polar.sh/org/checkout'].map((portalUrl) => ({ portalUrl }))]) {
    assert.equal(copy.configuredPortalHref(config), '');
  }
  assert.equal(copy.configuredPortalHref({ portalUrl: 'https://polar.sh/configured-org/portal' }), 'https://polar.sh/configured-org/portal');
});

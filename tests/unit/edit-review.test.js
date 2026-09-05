import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { createEditReview, createEditReviewState } from '../../playground/edit-review.js';

// Compute fixtures independently with Node's real SHA-256 implementation.
const hash = text => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
function input(original = 'A cat sat.', rewrite = 'The cat slept.', edits = [
  { start: 0, end: 1, replacement: 'The' },
  { start: 6, end: 9, replacement: 'slept' },
]) {
  return {
    original, rewrite,
    editReview: { schemaVersion: 1, offsetEncoding: 'utf-16', baseHash: hash(original), outputHash: hash(rewrite), edits },
  };
}
const stateFor = data => createEditReviewState({ ...data, crypto: webcrypto });

test('real WebCrypto validates an envelope and selections preserve exact original offsets', async () => {
  const data = input();
  const state = await stateFor(data);
  assert.deepEqual(state.getSelection(), {
    candidate: data.rewrite, isAccepted: true, isOriginal: false, baseHash: hash(data.original),
  });
  assert.equal(state.getAcceptedCount(), 2);
  assert.deepEqual(state.setAccepted(0, false), {
    candidate: 'A cat slept.', isAccepted: false, isOriginal: false, baseHash: hash(data.original),
  });
  assert.deepEqual(state.setAccepted(1, false), {
    candidate: data.original, isAccepted: false, isOriginal: true, baseHash: hash(data.original),
  });
  assert.equal(state.selectAll(true).candidate, data.rewrite);
  assert.equal(state.selectAll(false).candidate, data.original);
});

test('works with a real Node global WebCrypto when available', async t => {
  if (!globalThis.crypto?.subtle) return t.skip('this Node version needs injected WebCrypto');
  const state = await createEditReviewState(input());
  assert.equal(state.getSelection().isAccepted, true);
});

test('cannot reuse scores, receipts, or mutable caller edits in the selected state', async () => {
  const data = input();
  data.editReview.scores = { mps: 100 };
  data.editReview.receipt = { approved: true };
  const pending = stateFor(data);
  data.editReview.edits[0].replacement = 'tampered';
  data.editReview.edits.push({ start: 10, end: 10, replacement: 'tampered' });
  data.editReview.baseHash = hash('changed');
  const state = await pending;
  assert.deepEqual(Object.keys(state.getSelection()).sort(), ['baseHash', 'candidate', 'isAccepted', 'isOriginal']);
  assert.throws(() => { state.edits[0].replacement = 'tampered'; }, TypeError);
  assert.throws(() => { state.getSelection().candidate = 'tampered'; }, TypeError);
  assert.equal(state.setAccepted(1, false).candidate, 'The cat sat.');
});

test('restoring a conversation restores the exact unverified selection without reusing approval', async () => {
  const data = input();
  const state = await stateFor(data);
  state.setAccepted(0, false);
  const restored = await createEditReviewState({ ...data, initialSelection: [...state.getAccepted()], crypto: webcrypto });
  assert.deepEqual(restored.getSelection(), state.getSelection());
  assert.equal(restored.getSelection().isAccepted, false);
  for (const selection of [[true], [true, 'yes'], null]) {
    await assert.rejects(createEditReviewState({ ...data, initialSelection: selection, crypto: webcrypto }), /edit_review_invalid_selection/);
  }
});

test('rejects missing, stale, forged, and incorrectly encoded hashes', async () => {
  for (const field of ['baseHash', 'outputHash']) {
    for (const value of [undefined, '', 'sha256:fake', hash('stale'), `sha256:${'0'.repeat(64)}`]) {
      const data = input();
      data.editReview[field] = value;
      await assert.rejects(stateFor(data), /edit_review_(invalid_envelope|hash_mismatch)/);
    }
  }
  const data = input('한글😀', '日文😀', [{ start: 0, end: 2, replacement: '日文' }]);
  data.editReview.baseHash = `sha256:${createHash('sha256').update(data.original, 'utf16le').digest('hex')}`;
  await assert.rejects(stateFor(data), /edit_review_hash_mismatch/);
});

test('valid hashes never excuse incorrect full application, whitespace, or Unicode normalization', async () => {
  for (const data of [
    input('abc', 'abd', []),
    input('abc', 'abc ', [{ start: 2, end: 3, replacement: 'c' }]),
    input('e\u0301', 'é', []),
  ]) await assert.rejects(stateFor(data), /edit_review_output_mismatch/);
});

test('rejects bad schemas, excessive text, and invalid edit arrays', async () => {
  for (const patch of [
    { schemaVersion: 2 }, { schemaVersion: '1' }, { offsetEncoding: 'utf-8' },
    { edits: null }, { edits: {} }, { edits: Array(12).fill({ start: 0, end: 0, replacement: '' }) },
  ]) {
    const data = input();
    Object.assign(data.editReview, patch);
    await assert.rejects(stateFor(data), /edit_review_invalid_envelope/);
  }
  await assert.rejects(stateFor({ ...input(), editReview: null }), /edit_review_invalid_envelope/);
  for (const patch of [{ original: null }, { rewrite: 1 }, { original: 'a'.repeat(20_001) }, { rewrite: 'b'.repeat(20_001) }]) {
    await assert.rejects(stateFor({ ...input(), ...patch }), /edit_review_invalid_text/);
  }
});

test('rejects malformed, out-of-bounds, overlapping, unsorted, and split-surrogate edits', async () => {
  const badEdits = [
    [null], [[]], [{}],
    [{ start: -1, end: 1, replacement: 'x' }],
    [{ start: 1.5, end: 2, replacement: 'x' }],
    [{ start: '0', end: 1, replacement: 'x' }],
    [{ start: 0, end: 5, replacement: 'x' }],
    [{ start: 2, end: 1, replacement: 'x' }],
    [{ start: 0, end: 1, replacement: null }],
    [{ start: 1, end: 3, replacement: 'x' }, { start: 2, end: 4, replacement: 'y' }],
    [{ start: 3, end: 4, replacement: 'x' }, { start: 0, end: 1, replacement: 'y' }],
    [{ start: 1, end: 1, replacement: 'x' }, { start: 1, end: 1, replacement: 'y' }],
  ];
  for (const edits of badEdits) await assert.rejects(stateFor(input('abcd', 'changed', edits)), TypeError);
  await assert.rejects(stateFor(input('😀', 'x', [{ start: 0, end: 1, replacement: 'x' }])), /surrogate/);
});

test('requires usable cryptography and fails closed when hashing fails', async () => {
  for (const crypto of [null, {}, { subtle: {} }]) {
    await assert.rejects(createEditReviewState({ ...input(), crypto }), /edit_review_crypto_unavailable/);
  }
  const crypto = { subtle: { digest: async () => { throw new Error('private transport detail'); } } };
  await assert.rejects(createEditReviewState({ ...input(), crypto }), error => {
    assert.equal(error.message, 'edit_review_hash_failed');
    return true;
  });
});

test('hash-bound review rejects lone surrogates even when UTF-8 hashes collide', async () => {
  const original = 'Draft \uD800.', changed = 'Draft \uD801.';
  assert.equal(hash(original), hash(changed));
  await assert.rejects(stateFor(input(original, changed, [{ start: 6, end: 7, replacement: '\uD801' }])), /edit_review_invalid_text/);
  await assert.rejects(stateFor(input('Valid', 'Bad \uDC00', [{ start: 0, end: 5, replacement: 'Bad \uDC00' }])), /edit_review_invalid_text/);
});

test('edits support insertion, deletion, emoji, CJK, CRLF, and adjacent original offsets', async () => {
  const original = '😀 한국\r\n中文 日本語';
  const rewrite = '😀 좋은 한국\r\n日本語!';
  const state = await stateFor(input(original, rewrite, [
    { start: 3, end: 3, replacement: '좋은 ' },
    { start: 7, end: 10, replacement: '' },
    { start: original.length, end: original.length, replacement: '!' },
  ]));
  assert.equal(state.getSelection().candidate, rewrite);
  assert.equal(state.setAccepted(0, false).candidate, '😀 한국\r\n日本語!');
  assert.equal(state.selectAll(false).candidate, original);
  const adjacent = await stateFor(input('ab', 'XY', [
    { start: 0, end: 1, replacement: 'X' }, { start: 1, end: 2, replacement: 'Y' },
  ]));
  assert.equal(adjacent.setAccepted(0, false).candidate, 'aY');
});

test('empty and unchanged text have exact equality flags without inferred approval', async () => {
  for (const original of ['', 'same\r\n', '😀']) {
    const state = await stateFor(input(original, original, []));
    assert.deepEqual(state.selectAll(false), { candidate: original, isAccepted: true, isOriginal: true, baseHash: hash(original) });
  }
  const insertion = await stateFor(input('', 'text', [{ start: 0, end: 0, replacement: 'text' }]));
  assert.equal(insertion.selectAll(false).candidate, '');
  const deletion = await stateFor(input('text', '', [{ start: 0, end: 4, replacement: '' }]));
  assert.equal(deletion.selectAll(false).candidate, 'text');
});

function limitInput() {
  const original = 'a'.repeat(20_000);
  return input(original, `b${'a'.repeat(19_999)}`, [
    { start: 0, end: 0, replacement: 'b' }, { start: 19_999, end: 20_000, replacement: '' },
  ]);
}

test('a subset exceeding 20k fails atomically and invalid selection arguments cannot alter state', async () => {
  const state = await stateFor(limitInput());
  const previous = state.getSelection();
  assert.throws(() => state.setAccepted(1, false), /result_too_long/);
  assert.deepEqual(state.getSelection(), previous);
  assert.equal(state.isChecked(1), true);
  for (const args of [[-1, true], [2, false], [0.5, true], [0, 'false']]) {
    assert.throws(() => state.setAccepted(...args), /edit_review_invalid_selection/);
  }
  assert.throws(() => state.selectAll(null), /edit_review_invalid_selection/);
  assert.deepEqual(state.getSelection(), previous);
});

// Small DOM seam: real component code, native input/button properties, bubbling
// events, listener disposal, and a hard failure for HTML injection. No DOM deps.
class Element {
  constructor(tag, document) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this._text = '';
  }
  set innerHTML(_) { throw new Error('HTML injection is forbidden'); }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this._text = '';
    this.append(...nodes);
  }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  focus() { this.ownerDocument.activeElement = this; }
  async dispatch(name, { force = false } = {}) {
    if (this.disabled && !force) return;
    const pending = [];
    for (let node = this; node; node = node.parentNode) {
      for (const callback of node.listeners.get(name) ?? []) pending.push(callback({ target: this }));
    }
    await Promise.all(pending);
  }
}
function documentFor(crypto = webcrypto) {
  return {
    defaultView: { crypto },
    created: [],
    createElement(tag) {
      const element = new Element(tag, this);
      this.created.push(element);
      return element;
    },
  };
}
function descendants(root) { return [root, ...root.children.flatMap(descendants)]; }
const all = (root, tag) => descendants(root).filter(node => node.tagName === tag.toUpperCase());
const action = (root, name) => descendants(root).find(node => node.getAttribute('data-action') === name);
const statusOf = root => descendants(root).find(node => node.getAttribute('role') === 'status');
async function toggle(checkbox, checked, options) { checkbox.checked = checked; await checkbox.dispatch('change', options); }
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function component(data = input(), options = {}) {
  return createEditReview({ ...data, document: documentFor(), ...options });
}

test('invalid review creates no DOM or selection callbacks before validation succeeds', async () => {
  const document = documentFor();
  const data = input();
  data.editReview.outputHash = hash('different');
  let emitted = false;
  await assert.rejects(component(data, { document, onSelectionChange: () => { emitted = true; } }), /hash_mismatch/);
  assert.equal(document.created.length, 0);
  assert.equal(emitted, false);
  await assert.rejects(component(input(), { document: null }), /document_unavailable/);
  await assert.rejects(component(input(), { onVerify: true }), /invalid_callback/);
});

test('checkbox changes emit candidates, restore checks all, and reject-all returns the exact original', async () => {
  const emitted = [], restored = [];
  const data = input();
  const { element } = await component(data, {
    onSelectionChange: selection => emitted.push(selection),
    onRestore: selection => restored.push(selection),
    onVerify: async () => {},
  });
  const boxes = all(element, 'input');
  assert.ok(boxes.every(box => box.checked));
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].candidate, data.rewrite);
  assert.equal(action(element, 'restore').disabled, true);
  await toggle(boxes[0], false);
  assert.deepEqual(emitted.at(-1), { candidate: 'A cat slept.', isAccepted: false, isOriginal: false, baseHash: hash(data.original) });
  assert.match(statusOf(element).textContent, /new meaning check/);
  await action(element, 'restore').dispatch('click');
  assert.ok(boxes.every(box => box.checked));
  assert.equal(restored.length, 1);
  assert.deepEqual(restored[0], emitted.at(-1));
  assert.equal(restored[0].candidate, data.rewrite);
  await action(element, 'original').dispatch('click');
  assert.ok(boxes.every(box => !box.checked));
  assert.equal(emitted.at(-1).candidate, data.original);
  assert.equal(emitted.at(-1).isOriginal, true);
  assert.equal(action(element, 'verify').disabled, true);
});

test('all user fragments render verbatim as text, with accessible before/after labels', async () => {
  const original = '<img src=x onerror=alert(1)>\r\n';
  const rewrite = '<script>alert("secret")</script>\n';
  const document = documentFor();
  const { element } = await component(input(original, rewrite, [{ start: 0, end: original.length, replacement: rewrite }]), { document });
  assert.deepEqual(all(element, 'pre').map(node => node.textContent), [original, rewrite]);
  assert.equal(all(element, 'script').length, 0);
  assert.equal(all(element, 'img').length, 0);
  const checkbox = all(element, 'input')[0];
  assert.equal(checkbox.parentNode.tagName, 'LABEL');
  for (const id of checkbox.getAttribute('aria-describedby').split(' ')) {
    assert.ok(descendants(element).some(node => node.id === id));
  }
  for (const pre of all(element, 'pre')) {
    assert.equal(pre.tabIndex, 0);
    assert.equal(pre.dir, 'auto');
    assert.ok(pre.getAttribute('aria-labelledby'));
  }
  assert.ok(all(element, 'button').every(node => node.type === 'button'));
});

test('all four languages provide localized controls, guidance, and a live status region', async () => {
  const expectations = {
    en: ['Review changes', 'Before', 'After', 'Verify selected text'],
    ko: ['변경 사항 검토', '변경 전', '변경 후', '선택한 글 검증'],
    zh: ['审阅修改', '修改前', '修改后', '验证所选文本'],
    ja: ['変更を確認', '変更前', '変更後', '選択した文章を検証'],
  };
  for (const [lang, texts] of Object.entries(expectations)) {
    const { element } = await component(input(), { lang, onVerify: async () => {} });
    assert.equal(element.lang, lang);
    assert.equal(element.getAttribute('aria-label'), texts[0]);
    for (const text of texts) assert.ok(element.textContent.includes(text));
    const status = statusOf(element);
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(status.getAttribute('aria-atomic'), 'true');
    await toggle(all(element, 'input')[0], false);
    assert.ok(status.textContent.length > 0);
  }
  assert.equal((await component(input(), { lang: 'ko-KR' })).element.lang, 'ko');
  assert.equal((await component(input(), { lang: 'toString' })).element.lang, 'en');
});

test('verification awaits the exact selected text and locks edits against duplicate requests', async () => {
  const pending = deferred();
  const calls = [];
  const { element, setBusy } = await component(input(), {
    onVerify: (...args) => { calls.push(args); return pending.promise; },
  });
  const boxes = all(element, 'input');
  await toggle(boxes[0], false);
  const verify = action(element, 'verify');
  const clicked = verify.dispatch('click');
  assert.deepEqual(calls, [['A cat slept.', hash('A cat sat.')]]);
  assert.ok(all(element, 'button').every(node => node.disabled));
  assert.ok(boxes.every(node => node.disabled));
  assert.equal(element.getAttribute('aria-busy'), 'true');
  assert.match(statusOf(element).textContent, /Checking the meaning/);
  await verify.dispatch('click', { force: true });
  await toggle(boxes[1], false, { force: true });
  assert.equal(boxes[1].checked, true);
  assert.equal(calls.length, 1);
  setBusy(false);
  assert.equal(verify.disabled, true);
  pending.resolve({ ok: true, approved: true, mps: 100, receipt: 'not-for-component' });
  await clicked;
  assert.equal(verify.disabled, false);
  assert.equal(element.getAttribute('aria-busy'), 'false');
  assert.equal(statusOf(element).textContent, 'Verification request finished. See the verification result.');
  assert.doesNotMatch(element.textContent, /approved|100|not-for-component/i);
  await toggle(boxes[0], true);
  assert.equal(statusOf(element).textContent, 'Full rewrite selected.');
});

test('verification errors and false returns expose no private details and can be retried', async () => {
  let attempt = 0;
  const { element } = await component(input(), {
    onVerify: async () => {
      attempt++;
      if (attempt === 1) throw new Error('key=sk-private original=secret');
      if (attempt === 2) return { ok: false, error: 'private' };
      if (attempt === 3) return false;
    },
  });
  const verify = action(element, 'verify');
  for (let i = 0; i < 3; i++) {
    await verify.dispatch('click');
    assert.match(statusOf(element).textContent, /could not be completed/);
    assert.doesNotMatch(element.textContent, /sk-private|original=secret/);
    assert.equal(verify.disabled, false);
  }
  await verify.dispatch('click');
  assert.equal(attempt, 4);
  assert.match(statusOf(element).textContent, /See the verification result/);
});

test('external busy stays locked across callback completion and idle state disables missing verification', async () => {
  const pending = deferred();
  const { element, setBusy } = await component(input(), { onVerify: () => pending.promise });
  const clicked = action(element, 'verify').dispatch('click');
  setBusy(true);
  pending.resolve();
  await clicked;
  assert.ok(all(element, 'input').every(box => box.disabled));
  assert.equal(action(element, 'verify').disabled, true);
  setBusy(false);
  assert.equal(action(element, 'verify').disabled, false);
  const missing = await component();
  missing.setBusy(true);
  missing.setBusy(false);
  assert.equal(action(missing.element, 'verify').disabled, true);
  assert.match(statusOf(missing.element).textContent, /unavailable/);
});

test('disposal removes listeners, disables controls, and ignores pending verification success or failure', async () => {
  for (const fails of [false, true]) {
    const pending = deferred();
    const calls = [];
    const { element, dispose, setBusy } = await component(input(), {
      onVerify: () => pending.promise, onSelectionChange: selection => calls.push(selection),
    });
    const clicked = action(element, 'verify').dispatch('click');
    dispose();
    const disposedText = element.textContent;
    if (fails) pending.reject(new Error('private late failure'));
    else pending.resolve({ ok: true });
    await clicked;
    setBusy(false);
    dispose();
    assert.equal(element.textContent, disposedText);
    assert.ok(all(element, 'button').every(node => node.disabled));
    const listenerCount = descendants(element).reduce((n, node) =>
      n + [...node.listeners.values()].reduce((m, handlers) => m + handlers.size, 0), 0);
    assert.equal(listenerCount, 0);
    await toggle(all(element, 'input')[0], false, { force: true });
    assert.equal(calls.length, 1);
  }
});

test('async parent selection updates lock verification; errors require successful synchronization', async () => {
  const pending = deferred();
  let calls = 0;
  const { element } = await component(input(), {
    onSelectionChange: () => ++calls === 2 ? pending.promise : undefined,
    onVerify: async () => {},
  });
  const boxes = all(element, 'input');
  const changed = toggle(boxes[0], false);
  assert.equal(action(element, 'verify').disabled, true);
  assert.equal(boxes[1].disabled, true);
  pending.reject(new Error('private selection failure'));
  await changed;
  assert.equal(action(element, 'verify').disabled, true);
  assert.match(statusOf(element).textContent, /could not be updated/);
  assert.doesNotMatch(element.textContent, /private selection failure/);
  await action(element, 'restore').dispatch('click');
  assert.equal(action(element, 'verify').disabled, false);
});

test('disposal during restore skips the pending restore callback', async () => {
  const pending = deferred();
  let calls = 0, restores = 0;
  const { element, dispose } = await component(input(), {
    onSelectionChange: () => ++calls === 3 ? pending.promise : undefined,
    onRestore: () => { restores++; },
  });
  await toggle(all(element, 'input')[0], false);
  const clicked = action(element, 'restore').dispatch('click');
  dispose();
  pending.resolve();
  await clicked;
  assert.equal(restores, 0);
});

test('restore can retry failed initial selection and restore callbacks even with all edits checked', async () => {
  let selections = 0, restores = 0;
  const { element } = await component(input(), {
    onSelectionChange: () => { if (++selections === 1) throw new Error('initial failure'); },
    onRestore: async () => { if (++restores === 1) throw new Error('restore failure'); },
    onVerify: async () => {},
  });
  const restore = action(element, 'restore');
  assert.ok(all(element, 'input').every(box => box.checked));
  assert.equal(restore.disabled, false);
  assert.equal(action(element, 'verify').disabled, true);
  await restore.dispatch('click');
  assert.equal(restore.disabled, false);
  assert.equal(action(element, 'verify').disabled, true);
  await restore.dispatch('click');
  assert.equal(restore.disabled, true);
  assert.equal(action(element, 'verify').disabled, false);
  assert.equal(selections, 3);
  assert.equal(restores, 2);
});

test('oversized subset reverts its checkbox, emits no candidate, and cannot clear a parent selection failure', async () => {
  let calls = 0;
  const { element } = await component(limitInput(), {
    onSelectionChange: () => { calls++; throw new Error('cannot sync'); },
    onVerify: async () => {},
  });
  assert.equal(action(element, 'verify').disabled, true);
  const boxes = all(element, 'input');
  await toggle(boxes[1], false);
  assert.equal(boxes[1].checked, true);
  assert.equal(calls, 1);
  assert.match(statusOf(element).textContent, /previous selection has been kept/);
  assert.equal(action(element, 'verify').disabled, true);
});

test('20k input is paged with bounded rows and preserves selections across pages', async () => {
  const original = 'a '.repeat(10_000);
  const rewrite = 'b '.repeat(10_000);
  const edits = Array.from({ length: 10_000 }, (_, i) => ({ start: i * 2, end: i * 2 + 1, replacement: 'b' }));
  const emitted = [];
  const document = documentFor();
  const { element } = await component(input(original, rewrite, edits), { document, onSelectionChange: selection => emitted.push(selection) });
  assert.equal(all(element, 'input').length, 50);
  assert.equal(all(element, 'pre').reduce((n, node) => n + node.textContent.length, 0), 100);
  assert.ok(document.created.length < 700, 'does not allocate a full 10,000-row DOM');
  await toggle(all(element, 'input')[0], false);
  assert.equal(emitted.at(-1).candidate, `a ${rewrite.slice(2)}`);
  await action(element, 'next').dispatch('click');
  assert.match(statusOf(element).textContent, /Changes 51–100 of 10000/);
  assert.equal(document.activeElement, all(element, 'input')[0]);
  await toggle(all(element, 'input')[0], false);
  await action(element, 'previous').dispatch('click');
  assert.equal(all(element, 'input')[0].checked, false);
  await action(element, 'original').dispatch('click');
  assert.equal(emitted.at(-1).candidate, original);
  await action(element, 'next').dispatch('click');
  assert.ok(all(element, 'input').every(box => !box.checked));
  await action(element, 'restore').dispatch('click');
  assert.equal(emitted.at(-1).candidate, rewrite);
  assert.ok(all(element, 'input').every(box => box.checked));
});

test('unchanged reviews disable actions and multiple components have distinct accessible IDs', async () => {
  const unchanged = await component(input('same', 'same', []));
  assert.equal(all(unchanged.element, 'input').length, 0);
  assert.ok(all(unchanged.element, 'button').every(button => button.disabled));
  assert.match(unchanged.element.textContent, /No changes to review/);
  const first = await component(), second = await component();
  const ids = [...descendants(first.element), ...descendants(second.element)].map(node => node.id).filter(Boolean);
  assert.equal(ids.length, new Set(ids).size);
});

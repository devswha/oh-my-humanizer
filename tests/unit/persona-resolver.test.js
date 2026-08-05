import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { resolvePersonaForRun } from '../../src/personas/resolve.js';
import { PatinaCliError } from '../../src/errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

test('every language preserves source voice when Persona is omitted', () => {
  assert.equal(resolvePersonaForRun({ parsed: {}, config: {}, mode: 'score', lang: 'ko', repoRoot: REPO_ROOT }), null);
  for (const lang of ['ko', 'en', 'zh', 'ja']) {
    assert.equal(resolvePersonaForRun({ parsed: {}, config: {}, mode: 'rewrite', lang, repoRoot: REPO_ROOT }), null);
  }
});

test('an explicit Persona resolves in every supported language', () => {
  const ids = { ko: 'natural-ko', en: 'natural-en', zh: 'natural-zh', ja: 'natural-ja' };
  for (const [lang, id] of Object.entries(ids)) {
    const persona = resolvePersonaForRun({ parsed: { persona: id }, config: {}, mode: 'rewrite', lang, repoRoot: REPO_ROOT });
    assert.equal(persona.id, id);
    assert.equal(persona.lang, lang);
  }
});

test('a persona id absent from a language library throws an input error', () => {
  // en ships blog-essay/natural-en/technical-explainer; a
  // KO-only seed id (pragmatic-founder) must fail closed, not silently fall back.
  assert.throws(
    () => resolvePersonaForRun({ parsed: { persona: 'pragmatic-founder' }, config: {}, mode: 'rewrite', lang: 'en', repoRoot: REPO_ROOT }),
    (err) => err instanceof PatinaCliError && err.exitCode === 2,
  );
});

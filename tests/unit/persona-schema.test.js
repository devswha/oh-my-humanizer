import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPersona } from '../../src/personas/loader.js';
import { validatePersona } from '../../src/personas/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

function validFrontmatter(overrides = {}) {
  return {
    schema: 'patina.persona.v2',
    id: 'preserve',
    name: '원문 의미 보존',
    lang: 'ko',
    source: 'library',
    blocks: {
      preferred_words: { active: false, allow: [], avoid: [] },
      preferred_metaphors: { active: false, allow: [], forbid_new_facts: true },
      explanation_habits: { active: false, moves: [], avoid: [] },
      sentence_structure: { active: false },
      worldview: { active: false },
    },
    target_features: {},
    ...overrides,
  };
}

function assertInputError(fn) {
  assert.throws(fn, (err) => err?.exitCode === 2);
}

test('valid natural-ko persona loads and normalizes without body', () => {
  const persona = loadPersona(REPO_ROOT, 'ko', 'natural-ko');
  assert.equal(persona.schema, 'patina.persona.v2');
  assert.equal(persona.id, 'natural-ko');
  assert.equal(persona.blocks.preferredWords.active, true);
  assert.equal(persona.blocks.worldview.active, false);
  assert.equal(Object.hasOwn(persona, 'body'), false);
  assert.equal(Object.hasOwn(persona, 'depth'), false);
  assert.equal(Object.hasOwn(persona, 'mps'), false);
  assert.equal(Object.hasOwn(persona, 'fidelity'), false);
});

test('Persona v2 rejects cross-axis safety, policy, and register fields', () => {
  assertInputError(() => validatePersona(validFrontmatter({ disable_mps: true }), { id: 'preserve', lang: 'ko' }));
  assertInputError(() => validatePersona(validFrontmatter({ blocks: { worldview: { active: true } } }), { id: 'preserve', lang: 'ko' }));
  assertInputError(() => validatePersona(validFrontmatter({ mps: { enforce: true, floor: 70 } }), { id: 'preserve', lang: 'ko' }));
  assertInputError(() => validatePersona(validFrontmatter({ fidelity: { enforce: true, floor: 70 } }), { id: 'preserve', lang: 'ko' }));
  assertInputError(() => validatePersona(validFrontmatter({ depth: 'style-only' }), { id: 'preserve', lang: 'ko' }));
  assertInputError(() => validatePersona(validFrontmatter({ register: 'casual' }), { id: 'preserve', lang: 'ko' }));
  assertInputError(() => validatePersona(validFrontmatter({ documentType: 'blog' }), { id: 'preserve', lang: 'ko' }));
  assertInputError(() => validatePersona(validFrontmatter({ id: 'other' }), { id: 'preserve', lang: 'ko' }));
});

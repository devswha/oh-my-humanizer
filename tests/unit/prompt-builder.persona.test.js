import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { buildPrompt } from '../../src/prompt-builder.js';
import { loadPersona } from '../../src/personas/loader.js';
import { formatPersonaDirective } from '../../src/personas/compose.js';
import { loadDocumentType } from '../../src/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

const documentType = loadDocumentType(REPO_ROOT, 'blog');
const base = {
  config: { language: 'ko', documentType: 'blog' },
  patterns: [],
  documentType,
  voice: null,
  scoring: null,
  text: '테스트 문장입니다.',
  mode: 'rewrite',
};

test('strict and minimal prompts include the same persona directive', () => {
  const persona = loadPersona(REPO_ROOT, 'ko', 'pragmatic-founder');
  const directive = formatPersonaDirective(persona, { lang: 'ko' });
  const strictPrompt = buildPrompt({ ...base, persona, promptMode: 'strict' });
  const minimalPrompt = buildPrompt({ ...base, persona, promptMode: 'minimal' });

  assert.ok(strictPrompt.includes(directive));
  assert.ok(minimalPrompt.includes(directive));
});

test('persona contributes voice blocks only', () => {
  const persona = loadPersona(REPO_ROOT, 'ko', 'pragmatic-founder');
  const prompt = buildPrompt({ ...base, persona, promptMode: 'strict' });
  const directive = formatPersonaDirective(persona, { lang: 'ko' });

  assert.ok(prompt.includes(directive));
  assert.doesNotMatch(directive, /worldview|register|document_type|pattern_policy|MPS|fidelity/i);
});

test('omitting persona preserves the source voice and adds no persona directive', () => {
  const withoutPersona = buildPrompt({ ...base, promptMode: 'strict' });
  const explicitNull = buildPrompt({ ...base, persona: null, promptMode: 'strict' });
  assert.equal(explicitNull, withoutPersona);
  assert.doesNotMatch(withoutPersona, /페르소나:/);
  assert.match(withoutPersona, /Persona is omitted: preserve the source voice/);
  assert.match(withoutPersona, /Register is omitted: preserve the source’s dominant/);
  assert.match(withoutPersona, /Preserve the source’s dominant voice/);
  assert.match(withoutPersona, /Preserve and unify the source’s dominant register/);
});

test('explicit register and Persona compose without changing each other', () => {
  const persona = loadPersona(REPO_ROOT, 'ko', 'soft-professional');
  const directive = formatPersonaDirective(persona, { lang: 'ko' });
  const register = {
    register: 'casual',
    register_source: 'command',
    register_evidence: ['user-specified'],
    register_confidence: 'high',
  };
  const strictPrompt = buildPrompt({ ...base, persona, register, promptMode: 'strict' });
  const minimalPrompt = buildPrompt({ ...base, persona, register, promptMode: 'minimal' });

  for (const prompt of [strictPrompt, minimalPrompt]) {
    assert.ok(prompt.includes(directive));
    assert.match(prompt, /Persona is explicit: apply only its reusable vocabulary/);
    assert.match(prompt, /Register is explicit: apply only casual\/professional delivery markers/);
    assert.match(prompt, /명시적 목표는 casual/);
  }
  assert.match(directive, /CV/);
  assert.doesNotMatch(strictPrompt, /Preserve and unify the source’s dominant register/);
  assert.doesNotMatch(minimalPrompt, /Preserve and unify the source’s dominant register/);
});

test('diff mode composes Document Type, Persona, and Register', () => {
  const persona = loadPersona(REPO_ROOT, 'ko', 'soft-professional');
  const directive = formatPersonaDirective(persona, { lang: 'ko' });
  const register = {
    register: 'casual',
    register_source: 'command',
    register_evidence: ['user-specified'],
    register_confidence: 'high',
  };
  const prompt = buildPrompt({ ...base, mode: 'diff', persona, register });

  assert.ok(prompt.includes(directive));
  assert.match(prompt, /"document_type": "blog"/);
  assert.match(prompt, /명시적 목표는 casual/);
  assert.match(prompt, /Persona is explicit/);
  assert.match(prompt, /Register is explicit/);
  assert.match(prompt, /Pattern: N\. Pattern Name/);
});

test('Document Type supplies structured policy, never documentation prose', () => {
  const prompt = buildPrompt({ ...base, persona: null, promptMode: 'strict' });
  assert.match(prompt, /"document_type": "blog"/);
  assert.match(prompt, /"purpose":/);
  assert.match(prompt, /"audience":/);
  assert.match(prompt, /"structure":/);
  assert.match(prompt, /"style":/);
  assert.match(prompt, /"avoid":/);
  assert.match(prompt, /"pattern_policy":/);
  assert.equal(prompt.includes(documentType.body), false);
});

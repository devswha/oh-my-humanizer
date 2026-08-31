import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateKoreanInvariants } from '../../src/features/korean-invariants.js';

test('evaluateKoreanInvariants accepts a meaning-preserving rewrite', () => {
  // Given: a rewrite that changes wording but preserves every invariant.
  const original = '운영팀은 서버 3대를 점검하지 못했다. 장애 때문에 배포가 취소됐다.';
  const rewrite = '운영팀은 서버 3대를 확인하지 못했다. 장애로 인해 배포가 취소됐다.';

  // When: invariants are compared.
  const result = evaluateKoreanInvariants(original, rewrite);

  // Then: all deterministic checks pass.
  assert.equal(result.ok, true);
  assert.deepEqual(Object.values(result.checks).map((check) => check.ok), [true, true, true, true]);
});

test('evaluateKoreanInvariants uses shipping-equivalent exact number safety', () => {
  const result = evaluateKoreanInvariants(
    '운영팀은 서버 3대를 점검했다.',
    '운영팀은 서버 세 대를 점검했다.',
  );

  assert.equal(result.checks.number.ok, false);
});

test('evaluateKoreanInvariants rejects a changed number', () => {
  // Given: only a numeric claim changes.
  const original = '서버 3대를 점검했다.';
  const rewrite = '서버 4대를 점검했다.';

  // When: invariants are compared.
  const result = evaluateKoreanInvariants(original, rewrite);

  // Then: number safety fails.
  assert.equal(result.ok, false);
  assert.equal(result.checks.number.ok, false);
});

test('evaluateKoreanInvariants rejects explicit polarity inversion', () => {
  // Given: only explicit negation disappears.
  const original = '운영팀은 배포를 승인하지 않았다.';
  const rewrite = '운영팀은 배포를 승인했다.';

  // When: invariants are compared.
  const result = evaluateKoreanInvariants(original, rewrite);

  // Then: polarity safety fails.
  assert.equal(result.ok, false);
  assert.equal(result.checks.polarity.ok, false);
});

test('evaluateKoreanInvariants rejects reversed cause and effect', () => {
  // Given: the same entities appear with causal direction reversed.
  const original = '폭우 때문에 행사가 취소됐다.';
  const rewrite = '행사 취소 때문에 폭우가 발생했다.';

  // When: invariants are compared.
  const result = evaluateKoreanInvariants(original, rewrite);

  // Then: causation safety fails.
  assert.equal(result.ok, false);
  assert.equal(result.checks.causation.ok, false);
});

test('evaluateKoreanInvariants rejects a dropped causal relation', () => {
  const original = '폭우 때문에 행사가 취소됐다.';
  const rewrite = '폭우가 내렸다. 행사는 취소됐다.';

  const result = evaluateKoreanInvariants(original, rewrite);

  assert.equal(result.ok, false);
  assert.equal(result.checks.causation.ok, false);
});

test('evaluateKoreanInvariants rejects reversed entity roles', () => {
  // Given: actor and object swap roles.
  const original = '운영팀이 보안팀을 지원했다.';
  const rewrite = '보안팀이 운영팀을 지원했다.';

  // When: invariants are compared.
  const result = evaluateKoreanInvariants(original, rewrite);

  // Then: entity-role safety fails.
  assert.equal(result.ok, false);
  assert.equal(result.checks.entityRole.ok, false);
});

test('evaluateKoreanInvariants rejects a dropped entity-role assignment', () => {
  const original = '운영팀이 보안팀을 지원했다.';
  const rewrite = '운영팀과 보안팀이 협업했다.';

  const result = evaluateKoreanInvariants(original, rewrite);

  assert.equal(result.ok, false);
  assert.equal(result.checks.entityRole.ok, false);
});

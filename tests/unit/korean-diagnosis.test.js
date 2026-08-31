import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

import {
  buildKoreanDiagnosis,
  diagnosisStructureGuidance,
} from '../../src/features/korean-diagnosis.js';

const repoRoot = resolve('.');

test('buildKoreanDiagnosis attributes translationese to its paragraph', () => {
  // Given: one natural paragraph and one paragraph with a specific calque.
  const text = [
    '회의는 내일 오전 열 시에 시작한다. 참석자는 자료를 미리 읽어 온다.',
    '당신은 커맨드 기둥을 설정한다. 이것은 담당자에 의해 검토된다. 그것은 운영팀에 의해 다시 조정된다.',
  ].join('\n\n');

  // When: deterministic Korean diagnosis is built.
  const diagnosis = buildKoreanDiagnosis(text, { repoRoot });

  // Then: only the affected paragraph carries translationese rule ids.
  assert.equal(diagnosis.schema, 'koDiagnosis.v1');
  assert.equal(diagnosis.paragraphs.length, 2);
  assert.equal(diagnosis.paragraphs[0].preserveOnly, true);
  assert.equal(diagnosis.paragraphs[1].preserveOnly, false);
  assert.ok(diagnosis.paragraphs[1].signals.some((signal) => signal.startsWith('translationese:')));
  assert.equal(diagnosisStructureGuidance(diagnosis), 'ko-contextual-v1');
  assert.equal(diagnosis.policy.unflagged, 'preserve-only');
});

test('buildKoreanDiagnosis returns a clean preserve-only route', () => {
  // Given: short natural prose without a deterministic trigger.
  const text = '창문을 열자 빗소리가 가까워졌다. 잠시 뒤 골목이 조용해졌다.';

  // When: diagnosis runs.
  const diagnosis = buildKoreanDiagnosis(text, { repoRoot });

  // Then: the source is explicitly routed as a no-op candidate.
  assert.equal(diagnosis.route, 'clean');
  assert.deepEqual(diagnosis.paragraphs.map((paragraph) => paragraph.preserveOnly), [true]);
});

test('buildKoreanDiagnosis emits bounded signal identifiers without source text', () => {
  // Given: a paragraph containing customer-like prose and several signals.
  const secret = '고객비밀문구';
  const text = `${secret}는 운영팀에 의해 검토된다. ${secret}는 운영팀에 의해 기록된다.`;

  // When: diagnosis is serialized.
  const diagnosis = buildKoreanDiagnosis(text, { repoRoot });
  const serialized = JSON.stringify(diagnosis);

  // Then: only bounded identifiers are emitted.
  assert.equal(serialized.includes(secret), false);
  assert.ok(diagnosis.paragraphs.every((paragraph) => paragraph.signals.length <= 12));
});

test('diagnosisStructureGuidance enables contextual treatment only for structure or rhythm', () => {
  const diagnosis = {
    schema: 'koDiagnosis.v1',
    route: 'rhythm',
    paragraphs: [{ id: 'P1', signals: ['rhythm:ending-monotony'], preserveOnly: false }],
  };

  assert.equal(diagnosisStructureGuidance(diagnosis), 'ko-contextual-v1');
  assert.equal(diagnosisStructureGuidance({ ...diagnosis, route: 'lexical' }), 'baseline');
});

test('buildKoreanDiagnosis globally bounds paragraph output', () => {
  const text = Array.from(
    { length: 200 },
    (_, index) => `문단 ${index + 1}의 결과는 담당자에 의해 검토된다.`,
  ).join('\n\n');

  const diagnosis = buildKoreanDiagnosis(text, { repoRoot });

  assert.equal(diagnosis.paragraphs.length, 64);
  assert.equal(diagnosis.omittedParagraphCount, 136);
  assert.ok(JSON.stringify(diagnosis).length < 30_000);
});

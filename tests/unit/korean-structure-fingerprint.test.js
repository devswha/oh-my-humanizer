import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareKoreanStructure,
  fingerprintKoreanStructure,
  koreanStructureDistance,
} from '../../src/features/korean-structure-fingerprint.js';

const structured = [
  '문제는 반복되는 일정 지연이다. 문제는 담당자가 바뀔 때마다 더 커진다.',
  '- 첫째, 요청을 확인한다.\n- 둘째, 담당자를 정한다.\n- 셋째, 결과를 공유한다.',
  '결론적으로 이 절차가 중요하다. 결론적으로 모두가 같은 순서를 따라야 한다.',
].join('\n\n');

test('fingerprintKoreanStructure is deterministic and versioned', () => {
  // Given: one Korean document.
  // When: the fingerprint is computed twice.
  const first = fingerprintKoreanStructure(structured);
  const second = fingerprintKoreanStructure(structured);

  // Then: the machine-consumed result is stable and versioned.
  assert.deepEqual(first, second);
  assert.equal(first.schema, 'koStructureFingerprint.v1');
  assert.equal(first.paragraphCount, 3);
  assert.ok(first.checklistDensity > 0);
  assert.ok(first.repeatedOpenerCount > 0);
});

test('compareKoreanStructure reports edit churn and untouched-span ratio', () => {
  // Given: one unchanged candidate and one substantially changed candidate.
  const changed = '일정이 자주 늦어진다. 요청을 확인한 뒤 담당자를 정하고 결과를 공유한다.';

  // When: structure deltas are measured.
  const same = compareKoreanStructure(structured, structured);
  const delta = compareKoreanStructure(structured, changed);

  // Then: identical text has no churn while the changed candidate does.
  assert.equal(same.editChurn, 0);
  assert.equal(same.untouchedSpanRatio, 1);
  assert.ok(delta.editChurn > 0);
  assert.ok(delta.untouchedSpanRatio < 1);
  assert.notDeepEqual(delta.before, delta.after);
  assert.equal(same.fingerprintDistance, 0);
  assert.ok(delta.fingerprintDistance > 0);
  assert.equal(koreanStructureDistance(same.before, same.after), 0);
});

test('sequence-aware span retention rejects token reversal', () => {
  const delta = compareKoreanStructure(
    '사과 배 포도 복숭아',
    '복숭아 포도 배 사과',
  );

  assert.ok(delta.untouchedSpanRatio < 1);
  assert.ok(delta.editChurn > 0);
});

test('formal and plain Korean endings form different streak classes', () => {
  const fingerprint = fingerprintKoreanStructure('결과를 처리합니다. 담당자가 알린다.');

  assert.equal(fingerprint.endingStreakMax, 1);
});

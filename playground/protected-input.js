import { normalizeProtectedSpans } from '../src/edit-controls.js';

/** Resolve one exact literal per line to all of its original-text occurrences. */
export function protectedInputSpans(original, input) {
  if (typeof original !== 'string' || typeof input !== 'string') throw new TypeError('invalid_protected_input');
  if (input.length > 4000) throw new RangeError('protected_input_too_long');
  const literals = [...new Set(input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
  if (literals.length > 20) throw new RangeError('too_many_protected_spans');
  const spans = [];
  for (const literal of literals) {
    let cursor = 0, found = false;
    while (cursor <= original.length - literal.length) {
      const start = original.indexOf(literal, cursor);
      if (start < 0) break;
      found = true;
      spans.push({ start, end: start + literal.length });
      if (spans.length > 20) throw new RangeError('too_many_protected_spans');
      cursor = start + literal.length;
    }
    if (!found) throw new RangeError('protected_text_missing');
  }
  return normalizeProtectedSpans(original, spans).map(({ start, end }) => ({ start, end }));
}

export const PROTECTED_INPUT_COPY = Object.freeze({
  en: { label: 'Keep these phrases unchanged', hint: 'Optional: one product name, quote or phrase per line. Kept in this conversation only.', invalid: 'Use exact phrases from the original, with no overlaps and at most 20 occurrences in total.' },
  ko: { label: '그대로 유지할 문구', hint: '선택 사항: 제품명·인용문 등을 한 줄에 하나씩 입력하세요. 이 대화에서만 유지됩니다.', invalid: '원문에 있는 문구를 입력하세요. 서로 겹치지 않아야 하며 전체 출현 횟수는 20개까지입니다.' },
  zh: { label: '保持不变的词句', hint: '可选：每行输入一个产品名、引文或词句。仅保留在本次对话中。', invalid: '请输入原文中的词句，不可重叠，总出现次数最多为20次。' },
  ja: { label: '変更しない語句', hint: '任意：製品名や引用文を1行に1つ入力してください。この会話内だけで保持します。', invalid: '原文にある語句を入力してください。範囲は重ならず、出現回数の合計は20回以内にしてください。' },
});

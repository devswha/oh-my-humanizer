// @ts-check
// Portable deterministic text controls. No I/O, scoring, normalization, or repair.
// All offsets and the 20,000-unit text limit use JavaScript UTF-16 indices.

const MAX_TEXT_LENGTH = 20_000;
const MAX_PROTECTED_SPANS = 20;

/** UTF-8 source hashes are lossless only for well-formed Unicode strings. */
export function isWellFormedText(text) {
  if (typeof text !== 'string') return false;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return false;
    } else if (code >= 0xDC00 && code <= 0xDFFF) return false;
  }
  return true;
}

/** @typedef {{start: number, end: number, text?: string}} ProtectedSpan */
/** @typedef {{start: number, end: number, text: string}} BoundSpan */
/** @typedef {{start: number, end: number, replacement: string}} TextEdit */
/** @typedef {{text: string, start: number}} Token */

/** Errors contain stable codes only, never source or output content. */
function invalid(code) {
  return Object.assign(new TypeError(code), { code });
}

function requireText(text, name) {
  if (typeof text !== 'string') throw invalid(`invalid_${name}`);
  if (text.length > MAX_TEXT_LENGTH) throw invalid(`${name}_too_long`);
}

/** True at code-point boundaries, including beside an unpaired surrogate. */
function isBoundary(text, offset) {
  const left = text.charCodeAt(offset - 1);
  const right = text.charCodeAt(offset);
  return !(left >= 0xD800 && left <= 0xDBFF && right >= 0xDC00 && right <= 0xDFFF);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validRange(text, start, end, allowEmpty) {
  return Number.isInteger(start) && Number.isInteger(end)
    && start >= 0 && end <= text.length && (allowEmpty ? start <= end : start < end);
}

/**
 * Copy and sort up to 20 nonempty, nonoverlapping ranges; adjacency is allowed.
 * Capture the exact source literal in `text`. If already supplied, `text` must
 * match that range, so stale snapshots fail with protected_span_mismatch.
 * Undefined means no selections; null and malformed ranges fail closed.
 * Throws a TypeError with a stable `.code` on invalid input. This binds selected
 * literals only: the caller must bind the whole source using its base hash.
 *
 * @param {string} original
 * @param {ProtectedSpan[]} [spans]
 * @returns {BoundSpan[]}
 */
export function normalizeProtectedSpans(original, spans = []) {
  requireText(original, 'original');
  if (!Array.isArray(spans)) throw invalid('invalid_protected_spans');
  if (spans.length > MAX_PROTECTED_SPANS) throw invalid('too_many_protected_spans');
  const normalized = [];
  for (const span of spans) {
    if (!isRecord(span)) throw invalid('invalid_protected_span');
    const { start, end } = span;
    if (!validRange(original, start, end, false)) throw invalid('invalid_span_range');
    if (!isBoundary(original, start) || !isBoundary(original, end)) {
      throw invalid('span_splits_surrogate');
    }
    const text = original.slice(start, end);
    if ('text' in span && span.text !== text) throw invalid('protected_span_mismatch');
    normalized.push({ start, end, text });
  }
  normalized.sort((a, b) => a.start - b.start);
  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i].start < normalized[i - 1].end) {
      throw invalid('overlapping_protected_spans');
    }
  }
  return normalized;
}

/**
 * Spans choose literals; protection covers ALL occurrences of each chosen
 * literal throughout the original, including occurrences outside the spans.
 * Require their exact counts and ordered occurrence sequence in output. Offsets
 * may move, but added, missing, or reordered occurrences fail. Duplicate span
 * literals select the same global rule. Overlapping occurrences within either
 * text conservatively fail with protected_text_ambiguous, including a literal
 * contained in another selected literal. This is a literal guarantee, not proof
 * of source-instance semantic alignment, meaning, or unchanged context.
 * No Unicode/whitespace normalization or output repair. Count/order changes
 * return protected_text_changed; invalid input returns its validation code.
 *
 * @param {string} original
 * @param {string} output
 * @param {ProtectedSpan[]} [spans]
 * @returns {{ok: boolean, reason: string | null}}
 */
export function validateProtectedText(original, output, spans = []) {
  let normalized;
  try {
    normalized = normalizeProtectedSpans(original, spans);
    requireText(output, 'output');
  } catch (error) {
    if (error instanceof TypeError && 'code' in error) {
      return { ok: false, reason: String(error.code) };
    }
    throw error;
  }
  const literals = [...new Set(normalized.map(({ text }) => text))];
  if (!literals.length) return { ok: true, reason: null };
  const before = literalSequence(original, literals);
  const after = literalSequence(output, literals);
  if (before === null || after === null) return { ok: false, reason: 'protected_text_ambiguous' };
  if (before.length !== after.length || before.some((id, index) => id !== after[index])) {
    return { ok: false, reason: 'protected_text_changed' };
  }
  return { ok: true, reason: null };
}

/**
 * Collect every occurrence, including potential overlaps. Occupancy detects
 * ambiguity before matches can grow beyond text length; at most 20 literal
 * scans, O(n) storage, and O(n log n) sorting. Valid matches are whole code points.
 * @param {string} text
 * @param {string[]} literals
 * @returns {number[] | null}
 */
function literalSequence(text, literals) {
  const occupied = new Uint8Array(text.length);
  const matches = [];
  for (let id = 0; id < literals.length; id++) {
    const literal = literals[id];
    for (let start = text.indexOf(literal); start !== -1; start = text.indexOf(literal, start + 1)) {
      const end = start + literal.length;
      if (!isBoundary(text, start) || !isBoundary(text, end)) continue;
      for (let offset = start; offset < end; offset++) {
        if (occupied[offset]) return null;
        occupied[offset] = 1;
      }
      matches.push({ start, id });
    }
  }
  matches.sort((a, b) => a.start - b.start);
  return matches.map(({ id }) => id);
}

/**
 * Unicode word, whitespace, and punctuation/symbol runs. This deliberately
 * keeps unspaced CJK phrases and emoji sequences coarse. No locale-dependent
 * segmenter, ASCII-only word boundary, or UTF-16 code-unit slicing is used.
 * Offsets guarantee code-point boundaries, not full grapheme segmentation.
 * @param {string} text
 * @returns {Token[]}
 */
function tokenize(text) {
  return Array.from(text.matchAll(/[\p{L}\p{M}\p{N}_]+|\s+|[^\p{L}\p{M}\p{N}_\s]+/gu),
    (match) => ({ text: match[0], start: match.index }));
}

/** @param {Token[]} tokens @param {number} start @param {number} end */
function uniqueTokens(tokens, start, end) {
  const positions = new Map();
  for (let i = start; i < end; i++) {
    const text = tokens[i].text;
    positions.set(text, positions.has(text) ? -1 : i);
  }
  return positions;
}

/**
 * Longest increasing sequence of unique matches, with a fixed tie rule.
 * O(n log n) work and O(n) storage; no edit-distance matrix or recursion.
 * @param {Token[]} before
 * @param {Token[]} after
 * @param {number} start
 * @param {number} beforeEnd
 * @param {number} afterEnd
 * @returns {{before: number, after: number}[]}
 */
function orderedAnchors(before, after, start, beforeEnd, afterEnd) {
  const left = uniqueTokens(before, start, beforeEnd);
  const right = uniqueTokens(after, start, afterEnd);
  const candidates = [];
  for (const [text, beforeIndex] of left) {
    const afterIndex = right.get(text);
    if (beforeIndex !== -1 && afterIndex !== undefined && afterIndex !== -1) {
      candidates.push({ before: beforeIndex, after: afterIndex });
    }
  }
  const tails = [];
  const previous = [];
  for (let i = 0; i < candidates.length; i++) {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (candidates[tails[middle]].after < candidates[i].after) low = middle + 1;
      else high = middle;
    }
    previous[i] = low === 0 ? -1 : tails[low - 1];
    tails[low] = i;
  }
  const anchors = [];
  for (let i = tails.length ? tails[tails.length - 1] : -1; i !== -1; i = previous[i]) {
    anchors.push(candidates[i]);
  }
  return anchors.reverse();
}

/**
 * Produce sorted, nonoverlapping edits against the exact original. Applying
 * all edits reproduces output exactly, including whitespace and lone surrogate
 * code units. Shared token prefixes/suffixes and ordered unique tokens anchor
 * the changes. Ambiguous gaps become a single replacement; minimality is not
 * promised. Each text is capped at 20,000 UTF-16 units. Invalid input throws a
 * TypeError with a stable `.code`. No hash or verification claim is generated.
 *
 * @param {string} original
 * @param {string} output
 * @returns {TextEdit[]}
 */
export function createTextEdits(original, output) {
  requireText(original, 'original');
  requireText(output, 'output');
  if (original === output) return [];
  const before = tokenize(original);
  const after = tokenize(output);
  let start = 0;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (start < beforeEnd && start < afterEnd && before[start].text === after[start].text) start++;
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1].text === after[afterEnd - 1].text) {
    beforeEnd--;
    afterEnd--;
  }
  const anchors = orderedAnchors(before, after, start, beforeEnd, afterEnd);
  anchors.push({ before: beforeEnd, after: afterEnd });
  const edits = [];
  let left = start;
  let right = start;
  for (const anchor of anchors) {
    const from = before[left]?.start ?? original.length;
    const to = before[anchor.before]?.start ?? original.length;
    const replacement = output.slice(after[right]?.start ?? output.length, after[anchor.after]?.start ?? output.length);
    if (original.slice(from, to) !== replacement) edits.push({ start: from, end: to, replacement });
    left = anchor.before + 1;
    right = anchor.after + 1;
  }
  return edits;
}

/**
 * Apply any ordered subset of edits using original offsets, without mutation.
 * Reject malformed, out-of-range, overlapping, unsorted, surrogate-splitting,
 * and same-start edits (including two insertions at one offset). Adjacent edits
 * are allowed; start === end denotes insertion. The original and result must
 * each fit 20,000 UTF-16 units. Throws a TypeError with a stable `.code`.
 *
 * Bounds cannot detect a stale same-length source: the caller must check the
 * whole-source base hash before applying. A selected subset is new text and
 * inherits no verification or protected-text result from the full rewrite.
 *
 * @param {string} original
 * @param {TextEdit[]} edits
 * @returns {string}
 */
export function applyTextEdits(original, edits) {
  requireText(original, 'original');
  if (!Array.isArray(edits)) throw invalid('invalid_edits');
  if (edits.length > original.length + 1) throw invalid('too_many_edits');
  const parts = [];
  let cursor = 0;
  let previousStart = -1;
  let length = 0;
  for (const edit of edits) {
    if (!isRecord(edit)) throw invalid('invalid_edit');
    const { start, end, replacement } = edit;
    if (!validRange(original, start, end, true)) throw invalid('invalid_edit_range');
    if (!isBoundary(original, start) || !isBoundary(original, end)) throw invalid('edit_splits_surrogate');
    if (typeof replacement !== 'string') throw invalid('invalid_edit_replacement');
    if (start < cursor || start <= previousStart) throw invalid('edits_not_sorted_or_overlapping');
    length += start - cursor + replacement.length;
    if (length > MAX_TEXT_LENGTH) throw invalid('result_too_long');
    parts.push(original.slice(cursor, start), replacement);
    cursor = end;
    previousStart = start;
  }
  if (length + original.length - cursor > MAX_TEXT_LENGTH) throw invalid('result_too_long');
  parts.push(original.slice(cursor));
  return parts.join('');
}

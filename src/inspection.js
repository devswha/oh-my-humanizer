import { createHash } from 'node:crypto';
import { analyzeText, splitParagraphs } from './features/index.js';
import { loadConfig, getRepoRoot } from './config.js';
import { loadPatterns } from './loader.js';
import { scoreDeterministicSignals } from './scoring.js';
import { detectLanguage } from '../scripts/prose-score.mjs';

export const MAX_INSPECTION_CHARS = 200000;

// Offsets are UTF-16, matching VS Code and JavaScript editor APIs. NFC analysis
// can shorten decomposed graphemes; map each normalized unit back to its whole
// original grapheme so diagnostics never split combining marks or surrogate pairs.
export function normalizedOffsetMap(text) {
  let normalized = ''; const starts = []; const ends = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const { segment, index } of segmenter.segment(text)) {
    const value = segment.normalize('NFC');
    for (let i = 0; i < value.length; i++) { starts.push(index); ends.push(index + segment.length); }
    normalized += value;
  }
  return { normalized, starts, ends };
}

function paragraphSignals(paragraph) {
  return [
    paragraph.burstiness?.band === 'low' && 'uniform-sentence-length',
    paragraph.mattr?.band === 'low' && 'repeated-vocabulary',
    paragraph.lexicon?.hot && 'ai-lexicon-density',
    paragraph.koDiagnostics?.hot && 'korean-diagnostics',
    paragraph.endingMonotonyHot && 'repeated-endings',
    paragraph.candorHot && 'formulaic-candor',
    paragraph.thematicBreakHot && 'thematic-breaks',
  ].filter(Boolean);
}

export function inspectText(text, { language = 'auto', file = '', config, repoRoot = getRepoRoot() } = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('Inspection requires non-empty text');
  if (text.length > MAX_INSPECTION_CHARS) throw new RangeError(`Inspection supports at most ${MAX_INSPECTION_CHARS} characters; inspect a selection instead`);
  if (!['auto', 'en', 'ko', 'zh', 'ja'].includes(language)) throw new TypeError('Unsupported inspection language');
  const settings = globalThis.structuredClone(config || loadConfig());
  const lang = detectLanguage(file, text.normalize('NFC'), language); settings.language = lang;
  const patterns = loadPatterns(repoRoot, lang, settings['skip-patterns'] || []);
  let analysis;
  const score = scoreDeterministicSignals({ text, config: settings, patterns, repoRoot,
    logger: { warn() {} }, analyzer: (value, options) => { analysis = analyzeText(value, options); return analysis; } });
  const base = { schemaVersion: 1, language: lang, sourceHash: createHash('sha256').update(text).digest('hex'),
    deterministicOnly: true, offsetEncoding: 'utf-16', score: score?.overall ?? null,
    interpretation: score?.interpretation ?? null, paragraphCount: score?.paragraphCount ?? 0 };
  if (!analysis || !Number.isFinite(score?.overall)) return { ...base, available: false, diagnostics: [], reason: score?.skipReason || 'analysis-unavailable' };
  const mapping = normalizedOffsetMap(text);
  const paragraphs = splitParagraphs(mapping.normalized);
  const diagnostics = []; let cursor = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const start = mapping.normalized.indexOf(paragraph, cursor);
    if (start < 0) throw new Error('Analysis paragraph could not be mapped to the source');
    cursor = start + paragraph.length;
    if (!analysis.paragraphs[i]?.hot) continue;
    diagnostics.push({ start: mapping.starts[start], end: mapping.ends[cursor - 1],
      code: 'ai-like-paragraph', severity: 'warning', paragraph: i + 1,
      message: 'This paragraph has AI-like editing signals.', signals: paragraphSignals(analysis.paragraphs[i]) });
  }
  if (analysis.markupLeakage?.leaked) diagnostics.push({ start: 0, end: text.length, code: 'model-output-leakage', severity: 'warning', message: 'Model-output markup or self-identification is present.', signals: ['model-output-leakage'] });
  if (analysis.structuralClassifier?.hot) diagnostics.push({ start: 0, end: text.length, code: 'structural-model', severity: 'warning', message: 'The configured structural model flagged this document.', signals: ['structural-model'] });
  return { ...base, available: true, diagnostics, skipped: score.skipped, skipReason: score.skipReason };
}

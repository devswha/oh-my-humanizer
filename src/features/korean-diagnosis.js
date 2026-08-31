import { analyzeText, splitParagraphs } from './index.js';
import { detectTranslationese } from './translationese.js';

export const KOREAN_DIAGNOSIS_SCHEMA = 'koDiagnosis.v1';
export const MAX_KOREAN_DIAGNOSIS_SIGNALS = 12;
export const MAX_KOREAN_DIAGNOSIS_PARAGRAPHS = 64;
export const KOREAN_DIAGNOSIS_POLICY = Object.freeze({
  unflagged: 'preserve-only',
  lexical: 'clause-level',
  translationese: 'clause-level',
  rhythm: 'contextual',
  structure: 'contextual',
  omitted: 'baseline-preserve',
});

function paragraphSignals(paragraph, analysis) {
  const signals = [];
  if (analysis.burstiness?.band === 'low') signals.push('rhythm:burstiness-low');
  if (analysis.mattr?.band === 'low') signals.push('lexical:mattr-low');
  if (analysis.lexicon?.hot) signals.push('lexical:lexicon-density');
  if (analysis.endingMonotonyHot) signals.push('rhythm:ending-monotony');
  if (analysis.candorHot) signals.push('structure:repeated-candor');
  if (analysis.thematicBreakHot) signals.push('structure:thematic-break');
  for (const reason of analysis.koDiagnostics?.reasons ?? []) {
    signals.push(`rhythm:${reason}`);
  }
  const translationese = detectTranslationese(paragraph, { lang: 'ko' });
  if (translationese.hot) {
    for (const rule of translationese.byRule) {
      signals.push(`translationese:${rule.id}`);
    }
  }
  return [...new Set(signals)].sort().slice(0, MAX_KOREAN_DIAGNOSIS_SIGNALS);
}

function routeFor(paragraphs) {
  const categories = new Set();
  for (const paragraph of paragraphs) {
    for (const signal of paragraph.signals) {
      if (signal.startsWith('structure:')) categories.add('structure');
      else if (signal.startsWith('rhythm:')) categories.add('rhythm');
      else categories.add('lexical');
    }
  }
  if (categories.size === 0) return 'clean';
  if (categories.size > 1) return 'mixed';
  return [...categories][0];
}

/**
 * Build a bounded, source-free Korean diagnosis for prompt routing.
 *
 * @param {string} text
 * @param {{repoRoot: string}} options
 */
export function buildKoreanDiagnosis(text, { repoRoot } = {}) {
  const sourceParagraphs = splitParagraphs(String(text ?? ''));
  const analyzed = analyzeText(text, { lang: 'ko', repoRoot });
  const paragraphs = sourceParagraphs
    .slice(0, MAX_KOREAN_DIAGNOSIS_PARAGRAPHS)
    .map((paragraph, index) => {
    const signals = paragraphSignals(paragraph, analyzed.paragraphs[index] ?? {});
    return {
      id: `P${index + 1}`,
      signals,
      preserveOnly: signals.length === 0,
    };
  });
  return {
    schema: KOREAN_DIAGNOSIS_SCHEMA,
    route: routeFor(paragraphs),
    policy: KOREAN_DIAGNOSIS_POLICY,
    omittedParagraphCount: Math.max(0, sourceParagraphs.length - paragraphs.length),
    paragraphs,
  };
}

/**
 * Restrict contextual structure treatment to diagnosed structure/rhythm routes.
 *
 * @param {{route?: string}} diagnosis
 * @returns {'baseline'|'ko-contextual-v1'}
 */
export function diagnosisStructureGuidance(diagnosis) {
  return ['rhythm', 'structure', 'mixed'].includes(diagnosis?.route)
    ? 'ko-contextual-v1'
    : 'baseline';
}

/**
 * Serialize the diagnosis as one trusted machine-consumed document signal.
 *
 * @param {ReturnType<typeof buildKoreanDiagnosis>} diagnosis
 */
export function serializeKoreanDiagnosis(diagnosis) {
  return JSON.stringify(diagnosis);
}

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../../src/config.js';
import { loadPatterns } from '../../src/loader.js';
import { analyzeText } from '../../src/features/index.js';
import { loadLexicon } from '../../src/features/lexicon.js';
import { normalizeStructuralModel } from '../../src/features/structural-classifier.js';
import { resolveStructuralModelPath } from '../../src/features/structural-model-loader.js';
import { scoreDeterministicSignals } from '../../src/scoring.js';

const clone = (value) => globalThis.structuredClone(value);
const digest = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value
  : JSON.stringify(value, (_key, item) => item instanceof RegExp ? { expression: item.source, flags: item.flags } : item)).digest('hex');

// Snapshot the actual resolved inputs, including ambient CLI overrides and
// externally installed private weights. Public provenance contains hashes only.
export function createStudyInputs(repoRoot, { config: supplied, env = process.env, cwd = process.cwd(), sourceVoice = false } = {}) {
  const config = clone(supplied || loadConfig(resolve(repoRoot, '.patina.default.yaml')));
  if (sourceVoice) { config.persona = null; config.register = null; }
  const patterns = {}; const lexicons = {}; const models = {}; const modelIdentity = {};
  for (const language of ['en', 'ko', 'zh', 'ja']) {
    patterns[language] = loadPatterns(repoRoot, language);
    lexicons[language] = loadLexicon(language, repoRoot);
    const selected = resolveStructuralModelPath(config, { lang: language, env, cwd });
    models[language] = null; modelIdentity[language] = { status: 'absent', contentHash: null };
    if (selected) {
      let bytes;
      try { bytes = readFileSync(selected.path); }
      catch { modelIdentity[language] = { status: 'unreadable', contentHash: null }; }
      if (bytes) {
        try {
          models[language] = normalizeStructuralModel(JSON.parse(bytes.toString('utf8')));
          modelIdentity[language] = { status: models[language] ? 'loaded' : 'invalid', contentHash: digest(bytes) };
        } catch { modelIdentity[language] = { status: 'invalid', contentHash: digest(bytes) }; }
      }
    }
  }
  const fingerprint = { configuration: digest(config), sourceVoice,
    patterns: Object.fromEntries(Object.entries(patterns).map(([lang, value]) => [lang, digest(value)])),
    lexicons: Object.fromEntries(Object.entries(lexicons).map(([lang, value]) => [lang, digest(value)])),
    structuralModels: modelIdentity };
  return {
    fingerprint,
    config: () => clone(config),
    patterns: (language) => clone(patterns[language]),
    fixture(fixture) {
      const settings = clone(config); settings.language = fixture.language;
      if (fixture.documentType) settings.documentType = fixture.documentType;
      const packs = clone(patterns[fixture.language]);
      // Capture the exact analyzer result used by deterministic scoring. Only
      // its document-level hot bit leaves preparation; raw analysis stays out
      // of the public scorer row.
      let analysis = null;
      const deterministicScore = scoreDeterministicSignals({ text: fixture.text, config: settings, patterns: packs, repoRoot,
        logger: { warn() {} }, analyzer: (text, options) => {
          analysis = analyzeText(text, { ...options,
            structuralModel: clone(models[fixture.language]), lexicon: options.lexicon ?? clone(lexicons[fixture.language]) });
          return analysis;
        } });
      return { config: settings, patterns: packs, deterministicScore,
        analyzerHot: typeof analysis?.hot === 'boolean' ? analysis.hot : null };
    },
  };
}

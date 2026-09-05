// @ts-check
// Only these small, public rewrite settings may cross the local-storage boundary.
import { SUPPORTED_LANGS, WEB_DOCUMENT_TYPES, WEB_REGISTERS, isWebPersonaAllowed } from '../src/web-rewrite-contract.js';

export const PRESET_STORAGE_KEY = 'patina.rewrite-presets';
export const PRESET_VERSION = 1;
const MAX_PRESETS = 20;
const MAX_NAME = 40;

/** @param {{lang?:string, documentType?:string, persona?:string, register?:string}} [input] */
export function normalizePreferences(input = {}) {
  const lang = SUPPORTED_LANGS.includes(input?.lang) ? input.lang : 'en';
  const documentType = WEB_DOCUMENT_TYPES.includes(input?.documentType)
    && (input.documentType !== 'namuwiki' || lang === 'ko') ? input.documentType : 'default';
  return {
    lang,
    documentType,
    persona: isWebPersonaAllowed(lang, input?.persona) ? input.persona : '',
    register: WEB_REGISTERS.includes(input?.register) ? input.register : '',
  };
}

export function createThreadPreferences(initial = {}, languageExplicit = false) {
  let value = normalizePreferences(initial);
  let anchored = false;
  return {
    get value() { return { ...value }; },
    get languageExplicit() { return languageExplicit; },
    update(patch, { explicitLanguage = false } = {}) {
      const next = normalizePreferences({ ...value, ...patch });
      // Do not partially apply a preset whose language conflicts with the source.
      if (anchored && next.lang !== value.lang) return false;
      value = next;
      if (explicitLanguage) languageExplicit = true;
      return true;
    },
    detect(lang) {
      if (!anchored && !languageExplicit && SUPPORTED_LANGS.includes(lang)) {
        value = normalizePreferences({ ...value, lang });
      }
      return { ...value };
    },
    anchor() { anchored = true; },
    reset() { anchored = false; },
  };
}

function presetName(input) {
  if (typeof input !== 'string') return '';
  const name = input.trim();
  if (!name || name.length > MAX_NAME || [...name].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return '';
  // Reject common pasted credential forms; names are labels, never key fields.
  if (/^(?:Bearer\s|(?:sk|pk|rk|api|key|token|secret|ghp|github_pat)[_-]|[0-9a-f]{24,}$|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$)/i.test(name)) return '';
  return name;
}

function cleanPresets(input) {
  if (!Array.isArray(input)) return [];
  const names = new Set();
  return input.slice(0, MAX_PRESETS).flatMap((item) => {
    const name = presetName(item?.name);
    if (!name || names.has(name) || !item?.settings || typeof item.settings !== 'object') return [];
    names.add(name);
    return [{ name, settings: normalizePreferences(item.settings) }];
  });
}

export function saveNamedPreset(presets, name, settings) {
  const cleanName = presetName(name);
  if (!cleanName) return { ok: false, reason: 'name', presets };
  const clean = cleanPresets(presets);
  const index = clean.findIndex((p) => p.name === cleanName);
  if (index < 0 && clean.length >= MAX_PRESETS) return { ok: false, reason: 'limit', presets: clean };
  const preset = { name: cleanName, settings: normalizePreferences(settings) };
  if (index < 0) clean.push(preset);
  else clean[index] = preset;
  return { ok: true, reason: '', presets: clean };
}

// Resolve storage inside try: browsers can throw even while reading the getter.
export function readPresets(getStorage = () => globalThis.localStorage) {
  try {
    const raw = getStorage().getItem(PRESET_STORAGE_KEY);
    if (!raw) return { presets: [], status: 'ready' };
    if (raw.length > 16000) return { presets: [], status: 'invalid' };
    const data = JSON.parse(raw);
    if (data?.version !== PRESET_VERSION) return { presets: [], status: 'version' };
    if (!Array.isArray(data.presets)) return { presets: [], status: 'invalid' };
    return { presets: cleanPresets(data.presets), status: 'ready' };
  } catch (error) {
    return { presets: [], status: error instanceof SyntaxError ? 'invalid' : 'unavailable' };
  }
}

export function writePresets(presets, getStorage = () => globalThis.localStorage) {
  try {
    getStorage().setItem(PRESET_STORAGE_KEY, JSON.stringify({ version: PRESET_VERSION, presets: cleanPresets(presets) }));
    return true;
  } catch { return false; }
}

import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { listBackendNames } from '../backends/index.js';
import { isWellFormedText } from '../edit-controls.js';
import { SUPPORTED_LANGS, WEB_DOCUMENT_TYPES, WEB_PERSONAS, WEB_REGISTERS } from '../web-rewrite-contract.js';

const SETTINGS_BYTES = 16_384;
const KEYS = new Set(['version', 'language', 'documentType', 'persona', 'register', 'backend', 'model', 'protectedTerms']);

/** Public failures carry stable codes only, never values, drafts, or filesystem errors. */
export class AsideError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AsideError';
    this.code = code;
    this.statusCode = code === 'settings_changed' ? 409 : code === 'settings_busy' ? 423 : 400;
  }
}

/** Canonical UI choices; listing backends does not inspect credentials or start a CLI. */
export function getAsideChoices() {
  return {
    languages: ['auto', ...SUPPORTED_LANGS],
    documentTypes: [...WEB_DOCUMENT_TYPES],
    personas: Object.fromEntries(Object.entries(WEB_PERSONAS).map(([lang, values]) => [lang, values.map(value => ({ ...value }))])),
    registers: [...WEB_REGISTERS],
    backends: listBackendNames(),
  };
}

/**
 * Flat v1 settings: null voice/register preserves the source; null backend/model
 * uses the configured CLI backend/model (or the existing CLI defaults).
 * Unknown fields fail closed: credentials, endpoints, and draft text have no
 * settings fields. Terms are literal strings, not prompts or regular expressions.
 */
export function normalizeAsideSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new AsideError('invalid_settings');
  if (Object.keys(value).some(key => !KEYS.has(key))) throw new AsideError('unknown_setting');
  if (value.version !== undefined && value.version !== 1) throw new AsideError('unsupported_settings_version');
  const settings = {
    version: 1,
    language: value.language === undefined ? 'auto' : value.language,
    documentType: value.documentType === undefined ? 'blog' : value.documentType,
    persona: value.persona === undefined ? null : value.persona,
    register: value.register === undefined ? null : value.register,
    backend: value.backend === undefined ? null : value.backend,
    model: value.model === undefined ? null : value.model,
    protectedTerms: value.protectedTerms === undefined ? [] : value.protectedTerms,
  };
  const choices = getAsideChoices();
  if (!choices.languages.includes(settings.language)) throw new AsideError('invalid_language');
  if (!choices.documentTypes.includes(settings.documentType)) throw new AsideError('invalid_document_type');
  if (settings.documentType === 'namuwiki' && settings.language !== 'ko') throw new AsideError('invalid_document_type');
  const personas = settings.language === 'auto' ? [] : choices.personas[settings.language];
  if (settings.persona !== null && !personas.some(persona => persona.id === settings.persona)) throw new AsideError('invalid_persona');
  if (settings.register !== null && !choices.registers.includes(settings.register)) throw new AsideError('invalid_register');
  if (settings.backend !== null && !choices.backends.includes(settings.backend)) throw new AsideError('invalid_backend');
  // Model identifiers may include provider/name and tags, but never URLs,
  // whitespace, switches, shell syntax, or common credential prefixes.
  if (settings.model !== null && (typeof settings.model !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._/:@+-]{0,159}$/.test(settings.model)
    || /:\/\/|^(?:sk[-_]|AIza|Bearer)/i.test(settings.model))) throw new AsideError('invalid_model');
  if (!Array.isArray(settings.protectedTerms) || settings.protectedTerms.length > 20
    || settings.protectedTerms.some(term => typeof term !== 'string' || !term.trim() || term.length > 256
      || !isWellFormedText(term) || Array.from(term).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
    || new Set(settings.protectedTerms).size !== settings.protectedTerms.length) throw new AsideError('invalid_protected_terms');
  return { ...settings, protectedTerms: [...settings.protectedTerms] };
}

export function hashAsideText(text) {
  return createHash('sha256').update(text).digest('hex');
}

function envelope(configured, settings) {
  return { schemaVersion: 1, configured, settings, settingsHash: configured ? hashAsideText(JSON.stringify(settings)) : null };
}

export async function resolveAsideWorkspace(workspace) {
  if (typeof workspace !== 'string' || !workspace.trim() || workspace.includes('\0')) throw new AsideError('invalid_workspace');
  try {
    const path = await realpath(resolve(workspace));
    if (!(await lstat(path)).isDirectory()) throw new AsideError('invalid_workspace');
    return path;
  } catch {
    throw new AsideError('invalid_workspace');
  }
}

/** Bounded regular-file read; fatal UTF-8 decode preserves a leading BOM. */
export async function readAsideUtf8(path, maxBytes, code) {
  let file;
  try {
    if (!(await lstat(path)).isFile()) throw new AsideError(code);
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maxBytes) throw new AsideError(code);
    const bytes = Buffer.alloc(maxBytes + 1);
    let size = 0;
    while (size < bytes.length) {
      const { bytesRead } = await file.read(bytes, size, bytes.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > maxBytes) throw new AsideError(code);
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, size));
  } catch {
    throw new AsideError(code);
  } finally {
    await file?.close();
  }
}

async function settingsDirectory(workspace, create = false) {
  const root = await resolveAsideWorkspace(workspace);
  const dir = join(root, '.patina');
  try {
    if (create) await mkdir(dir, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw new AsideError('settings_write_failed');
  }
  try {
    if (!(await lstat(dir)).isDirectory() || await realpath(dir) !== dir) throw new AsideError('unsafe_settings_path');
    return dir;
  } catch (error) {
    if (!create && error.code === 'ENOENT') return null;
    throw new AsideError('unsafe_settings_path');
  }
}

export async function readAsideSettings(workspace) {
  const dir = await settingsDirectory(workspace);
  if (!dir) return envelope(false, normalizeAsideSettings());
  const path = join(dir, 'aside.json');
  try {
    await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return envelope(false, normalizeAsideSettings());
    throw new AsideError('settings_read_failed');
  }
  const raw = await readAsideUtf8(path, SETTINGS_BYTES, 'settings_read_failed');
  let value;
  try { value = JSON.parse(raw); } catch { throw new AsideError('invalid_settings_json'); }
  return envelope(true, normalizeAsideSettings(value));
}

/** Atomically publish a private settings file; never follow an existing symlink. */
export async function saveAsideSettings(workspace, value, { expectedHash } = {}) {
  const settings = normalizeAsideSettings(value);
  if (expectedHash !== undefined && expectedHash !== null
    && (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash))) throw new AsideError('invalid_expected_hash');
  const dir = await settingsDirectory(workspace, true);
  const path = join(dir, 'aside.json');
  const temporary = join(dir, `.aside-${randomUUID()}.tmp`);
  const lockPath = join(dir, '.aside.lock');
  let file;
  let lock;
  try {
    // O_EXCL serializes separate UI processes as well as one server's POSTs.
    // Never steal an existing lock: a crashed writer fails closed until the
    // operator removes its stale lock, rather than risking a lost update.
    for (let attempt = 0; attempt < 50; attempt++) {
      try { lock = await open(lockPath, 'wx', 0o600); break; } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (attempt === 49) throw new AsideError('settings_busy');
        await delay(20);
      }
    }
    if (expectedHash !== undefined) {
      const current = await readAsideSettings(workspace);
      if (current.settingsHash !== expectedHash) throw new AsideError('settings_changed');
    }
    try {
      if (!(await lstat(path)).isFile()) throw new AsideError('unsafe_settings_path');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    file = await open(temporary, 'wx', 0o600);
    await file.writeFile(`${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    await file.sync();
    await file.close();
    file = null;
    await rename(temporary, path);
    return envelope(true, settings);
  } catch (error) {
    throw error instanceof AsideError ? error : new AsideError('settings_write_failed');
  } finally {
    await file?.close();
    await rm(temporary, { force: true });
    if (lock) {
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }
}

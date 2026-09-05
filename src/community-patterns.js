import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const NAME = /^(?:en|ko|zh|ja)-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const LIMIT = 128 * 1024;
const digest = (text) => createHash('sha256').update(text).digest('hex');
const fail = (message) => { throw new Error(`community pattern pack: ${message}`); };
const compare = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); return Math.sign(x[0] - y[0] || x[1] - y[1] || x[2] - y[2]); };
const mapping = (x) => x && typeof x === 'object' && !Array.isArray(x);
const hasControls = (text) => [...text].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
const stableVersion = (value) => typeof value === 'string' && VERSION.test(value);

export function validateCommunityManifest(value, version) {
  if (!mapping(value)) fail('pack.yaml must be a mapping');
  if (typeof value.name !== 'string' || value.name.length > 80 || !NAME.test(value.name)) fail('invalid pack name');
  if (!['en', 'ko', 'zh', 'ja'].includes(value.language) || !value.name.startsWith(`${value.language}-`)) fail('name/language mismatch');
  if (!stableVersion(value.version)) fail('version must be a stable x.y.z string');
  for (const key of ['author', 'license']) if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 200 || hasControls(value[key])) fail(`invalid ${key}`);
  const range = value.compatibility;
  if (!mapping(range) || !stableVersion(range.min) || !stableVersion(range.maxExclusive) || compare(range.min, range.maxExclusive) >= 0) fail('compatibility requires min and maxExclusive stable versions');
  if (Object.keys(range).some((key) => !['min', 'maxExclusive'].includes(key))) fail('unknown compatibility field');
  if (version && (compare(version, range.min) < 0 || compare(version, range.maxExclusive) >= 0)) fail(`requires Patina >=${range.min} <${range.maxExclusive}; installed ${version}`);
  if (!Array.isArray(value.patterns) || value.patterns.length < 1 || value.patterns.length > 16 || new Set(value.patterns).size !== value.patterns.length) fail('patterns must list 1–16 unique files');
  const filePattern = new RegExp(`^${value.language}-community-[a-z0-9]+(?:-[a-z0-9]+)*\\.md$`);
  if (value.patterns.some((file) => typeof file !== 'string' || file.length > 120 || !filePattern.test(file))) fail('pattern filenames must use LANG-community-NAME.md without directories');
  const allowed = new Set(['name', 'version', 'language', 'patterns', 'compatibility', 'author', 'license']);
  if (Object.keys(value).some((key) => !allowed.has(key))) fail('unknown manifest field; hooks and scripts are not supported');
  return value;
}

function parseYaml(text) {
  try { return yaml.load(text, { schema: yaml.JSON_SCHEMA }); } catch { fail('invalid YAML'); }
}

function parsePattern(text, file, manifest) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) fail(`${file} needs YAML frontmatter`);
  const frontmatter = parseYaml(match[1]);
  if (!mapping(frontmatter) || frontmatter.pack !== file.slice(0, -3) || frontmatter.language !== manifest.language || frontmatter.version !== manifest.version) fail(`${file} frontmatter must match its filename, language and version`);
  if (!Number.isSafeInteger(frontmatter.patterns) || frontmatter.patterns < 1 || frontmatter.patterns > 100 || !match[2].trim()) fail(`${file} needs a pattern count and body`);
  if (frontmatter.phase !== undefined && !['structure', 'sentence', 'lexical'].includes(frontmatter.phase)) fail(`${file} has an invalid phase`);
  if (frontmatter.score_only !== undefined && typeof frontmatter.score_only !== 'boolean') fail(`${file} has an invalid score_only flag`);
  return { file, frontmatter, body: match[2].trim(), isStructure: frontmatter.phase === 'structure', isScoreOnly: frontmatter.score_only === true };
}

export function communitySource(input) {
  if (typeof input !== 'string') fail('provide a pack name or GitHub tree URL');
  if (hasControls(input)) fail('control characters are not supported in source URLs');
  if (NAME.test(input) && input.length <= 80) return { owner: 'devswha', repo: 'patina-community-packs', ref: 'main', directory: `packs/${input}`, expectedName: input };
  if (/\/(?:\.|\.\.)(?:\/|$)/.test(input)) fail('dot segments are not supported in source URLs');
  let url;
  try { url = new URL(input); } catch { fail('expected a pack name or https://github.com/OWNER/REPO/tree/REF/DIRECTORY'); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash || /%|\\/.test(input)) fail('only plain HTTPS GitHub tree URLs are supported');
  const parts = url.pathname.replace(/\/$/, '').split('/').slice(1);
  if (parts.length < 5 || parts[2] !== 'tree' || parts.some((part) => !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(part) || part === '..')) fail('invalid GitHub tree path; refs containing slashes are not supported');
  return { owner: parts[0], repo: parts[1], ref: parts[3], directory: parts.slice(4).join('/') };
}

async function fetchText(url, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, { redirect: 'error', signal: controller.signal, headers: { accept: 'application/vnd.github+json', 'user-agent': 'patina-community-packs' } });
    if (!response.ok) fail(`download failed (HTTP ${response.status})`);
    if (Number(response.headers.get('content-length')) > LIMIT) fail('download exceeds 128 KiB');
    const reader = response.body?.getReader();
    if (!reader) fail('download has no readable body');
    let size = 0; const chunks = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > LIMIT) { await reader.cancel(); fail('download exceeds 128 KiB'); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    const text = Buffer.concat(chunks).toString('utf8');
    if (text.includes('\0') || text.includes('\uFFFD')) fail('download must be valid UTF-8 text');
    return text;
  } finally { controller.abort(); clearTimeout(timer); }
}

function directory(root, name, create) {
  const path = join(root, name);
  if (!existsSync(path)) {
    // lstat also catches dangling symlinks, which existsSync does not see.
    try { lstatSync(path); fail(`unsafe directory ${name}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!create) return null;
    mkdirSync(path);
  }
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`unsafe directory ${name}`);
  return path;
}

function managedRoot(repoRoot, create = false) {
  // Existing custom/ and licensed packs may legitimately use a symlink. Do not
  // impose the community manager's stricter rules when its subtree is absent.
  if (!create) {
    try { lstatSync(join(repoRoot, 'custom/community-packs')); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null; throw error; }
  }
  const custom = directory(realpathSync(repoRoot), 'custom', create);
  return custom ? directory(custom, 'community-packs', create) : null;
}

function regularText(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > LIMIT) fail('installed pack contains an unsafe file');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try { return readFileSync(fd, 'utf8'); } finally { closeSync(fd); }
}

function readInstalled(root, name, version) {
  if (!NAME.test(name)) fail('invalid installed name');
  const path = directory(root, name, false);
  if (!path) fail(`pack ${name} is not installed`);
  let receipt;
  try { receipt = JSON.parse(regularText(join(path, 'installed.json'))); } catch { fail(`invalid installation receipt for ${name}`); }
  if (receipt.schemaVersion !== 1 || !mapping(receipt.hashes) || receipt.name !== name) fail(`invalid installation receipt for ${name}`);
  const expected = Object.keys(receipt.hashes).sort();
  if (expected.some((file) => file !== 'pack.yaml' && !/^(en|ko|zh|ja)-community-[a-z0-9-]+\.md$/.test(file))) fail('unsafe installation receipt path');
  const actual = readdirSync(path).filter((file) => file !== 'installed.json').sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) fail(`pack ${name} has added or removed files`);
  const files = new Map();
  for (const file of expected) {
    const text = regularText(join(path, file));
    if (digest(text) !== receipt.hashes[file]) fail(`pack ${name} has local changes; preserve them before reinstalling or removing`);
    files.set(file, text);
  }
  const manifest = validateCommunityManifest(parseYaml(files.get('pack.yaml')), version);
  if (manifest.name !== name || manifest.patterns.length + 1 !== files.size || manifest.patterns.some((file) => !files.has(file))) fail('installation receipt and manifest differ');
  const patterns = manifest.patterns.map((file) => parsePattern(files.get(file), file, manifest));
  return { path, manifest, patterns, source: receipt.source };
}

export function listCommunityPacks(repoRoot) {
  const root = managedRoot(repoRoot);
  if (!root) return [];
  return readdirSync(root).filter((name) => NAME.test(name)).sort().map((name) => {
    try { const installed = readInstalled(root, name); return { ...installed.manifest, source: installed.source, status: 'installed' }; }
    catch (error) { return { name, status: 'invalid', error: error.message }; }
  });
}

export function loadCommunityPatterns(repoRoot, lang, skipPatterns = []) {
  const root = managedRoot(repoRoot);
  if (!root) return [];
  const packagePath = join(repoRoot, 'package.json');
  const version = existsSync(packagePath) ? JSON.parse(readFileSync(packagePath, 'utf8')).version : undefined;
  return readdirSync(root).filter((name) => NAME.test(name) && name.startsWith(`${lang}-`)).sort()
    .flatMap((name) => readInstalled(root, name, version).patterns).filter((pattern) => !skipPatterns.includes(pattern.file.slice(0, -3)));
}

function lock(root) {
  const path = join(root, '.mutation.lock');
  let fd;
  try { fd = openSync(path, 'wx', 0o600); } catch { fail('another pack mutation is active; check .mutation.lock if a previous command was interrupted'); }
  return () => { closeSync(fd); rmSync(path); };
}

export async function installCommunityPack(input, { repoRoot, version, fetchImpl = globalThis.fetch } = {}) {
  const source = communitySource(input);
  let commit;
  try { commit = JSON.parse(await fetchText(`https://api.github.com/repos/${source.owner}/${source.repo}/commits/${encodeURIComponent(source.ref)}`, fetchImpl)).sha; } catch (error) { throw new Error(`community pattern pack: could not resolve source commit (${error.message})`); }
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit)) fail('GitHub did not return a full commit SHA');
  const base = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${commit}/${source.directory}/`;
  const manifestText = await fetchText(`${base}pack.yaml`, fetchImpl);
  const manifest = validateCommunityManifest(parseYaml(manifestText), version);
  if (source.expectedName && manifest.name !== source.expectedName) fail('requested name differs from pack.yaml');
  const files = new Map([['pack.yaml', manifestText]]);
  for (const file of manifest.patterns) {
    const text = await fetchText(`${base}${file}`, fetchImpl);
    parsePattern(text, file, manifest); files.set(file, text);
  }
  const root = managedRoot(repoRoot, true), release = lock(root);
  let stage;
  try {
    const destination = join(root, manifest.name);
    if (existsSync(destination)) fail(`${manifest.name} is already installed; remove it before installing another version`);
    const existing = new Set(listCommunityPacks(repoRoot).flatMap((pack) => pack.patterns || []));
    for (const file of manifest.patterns) {
      if (existing.has(file) || existsSync(join(repoRoot, 'patterns', file)) || existsSync(join(repoRoot, 'custom', 'patterns', file))) fail(`pattern file collision: ${file}`);
    }
    stage = mkdtempSync(join(root, '.stage-'));
    for (const [file, text] of files) writeFileSync(join(stage, file), text, { flag: 'wx', mode: 0o600 });
    const receipt = { schemaVersion: 1, name: manifest.name, source: { ...source, commit }, hashes: Object.fromEntries([...files].map(([file, text]) => [file, digest(text)])) };
    writeFileSync(join(stage, 'installed.json'), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    renameSync(stage, destination); stage = null;
    return { name: manifest.name, version: manifest.version, path: destination, source: receipt.source };
  } finally { if (stage) rmSync(stage, { recursive: true, force: true }); release(); }
}

export function removeCommunityPack(name, { repoRoot } = {}) {
  if (typeof name !== 'string' || !NAME.test(name)) fail('invalid pack name');
  const root = managedRoot(repoRoot);
  if (!root) fail(`${name} is not installed`);
  const release = lock(root);
  try {
    const { path } = readInstalled(root, name);
    rmSync(path, { recursive: true });
    return { removed: name };
  } finally { release(); }
}

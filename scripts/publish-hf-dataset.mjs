#!/usr/bin/env node
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { DATASET_FILES, exportDataset, sha256 } from './export-hf-dataset.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HUB = 'https://huggingface.co';

export function readDatasetBundle(directory) {
  const root = realpathSync(directory);
  const files = DATASET_FILES.map((name) => {
    const path = realpathSync(resolve(root, name));
    if (!path.startsWith(root + sep)) throw new Error('Dataset file escaped its export directory');
    const content = readFileSync(path);
    if (content.length > 1024 * 1024) throw new Error('Dataset file exceeds the regular-file publication limit');
    return { path: name, content };
  });
  const manifest = JSON.parse(files.find((file) => file.path === 'source-manifest.json').content.toString('utf8'));
  if (manifest.schemaVersion !== 1 || manifest.sourceRepository !== 'devswha/patina' || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit)) throw new Error('Invalid source manifest');
  for (const file of files.filter((file) => file.path !== 'source-manifest.json')) if (manifest.fileHashes?.[file.path] !== sha256(file.content)) throw new Error('Dataset export checksum mismatch');
  if (manifest.dataSha256 !== sha256(files.find((file) => file.path === 'data/test.jsonl').content)) throw new Error('Dataset data checksum mismatch');
  return { files, manifest };
}

export async function publishDataset({ directory, repository, token, fetchImpl = globalThis.fetch, dryRun = true, repoRoot = ROOT } = {}) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*\/patina-suspect-zones$/.test(repository || '')) throw new Error('Explicit owner/patina-suspect-zones repository is required');
  const bundle = readDatasetBundle(directory);
  if (dryRun) return { dryRun: true, repository, files: bundle.files.map((file) => file.path), rows: bundle.manifest.rowCount };
  if (!token) throw new Error('HF_TOKEN is required for publication');
  // Publish only data sourced from the reviewed released/integration history.
  execFileSync('git', ['-C', repoRoot, 'merge-base', '--is-ancestor', bundle.manifest.sourceCommit, 'origin/main']);
  const reviewed = execFileSync('git', ['-C', repoRoot, 'show', `${bundle.manifest.sourceCommit}:docs/research/hf-fixture-license-review.json`]);
  if (sha256(reviewed) !== bundle.manifest.licenseReviewSha256) throw new Error('Redistribution review is not bound to the source commit');
  const verification = mkdtempSync(resolve(tmpdir(), 'patina-hf-verify-'));
  try {
    exportDataset({ repoRoot, output: verification, sourceCommit: bundle.manifest.sourceCommit });
    for (const file of bundle.files) if (sha256(file.content) !== sha256(readFileSync(resolve(verification, file.path)))) throw new Error('Bundle differs from the reviewed source export');
  } finally { rmSync(verification, { recursive: true, force: true }); }
  const request = async (path, { method = 'GET', body, contentType = 'application/json', allow404 = false } = {}) => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
    try {
      let url = new URL(path, HUB);
      let response;
      for (let redirects = 0; redirects < 4; redirects++) {
        response = await fetchImpl(url.toString(), { method, redirect: 'manual', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType, Accept: 'application/json' }, body });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        if (method !== 'GET') throw new Error('Refusing a redirected mutation');
        const target = new URL(response.headers.get('location'), url);
        if (target.origin !== HUB || target.username || target.password) throw new Error('Refusing a cross-origin authenticated redirect');
        url = target;
      }
      if (allow404 && response.status === 404) return null;
      if (!response.ok) throw new Error(`Hugging Face request failed (HTTP ${response.status})`);
      return await response.json();
    } finally { clearTimeout(timer); }
  };
  const user = await request('/api/whoami-v2');
  const [owner, name] = repository.split('/');
  if (owner !== user.name && !(user.orgs || []).some((org) => org.name === owner)) throw new Error('Authenticated Hugging Face namespace differs from the requested repository');
  let remote = await request(`/api/datasets/${repository}`, { allow404: true });
  if (!remote) {
    await request('/api/repos/create', { method: 'POST', body: JSON.stringify({ type: 'dataset', name, organization: owner, private: false }) });
    remote = await request(`/api/datasets/${repository}`);
  } else {
    if (remote.private === true) throw new Error('Refusing to change an existing private dataset');
    const existing = await request(`/datasets/${repository}/resolve/main/source-manifest.json`, { allow404: true });
    if (!existing || existing.sourceRepository !== 'devswha/patina') throw new Error('Refusing to overwrite an unrelated or unmanaged dataset');
    if (!/^[a-f0-9]{40}$/.test(existing.sourceCommit || '')) throw new Error('Existing dataset source is invalid');
    execFileSync('git', ['-C', repoRoot, 'merge-base', '--is-ancestor', existing.sourceCommit, bundle.manifest.sourceCommit]);
  }
  if (!/^[a-f0-9]{40}$/.test(remote.sha || '')) throw new Error('Hugging Face did not return a commit to compare against');
  const operations = [{ key: 'header', value: { summary: `Refresh Patina ${bundle.manifest.sourceVersion} regression fixtures`,
    description: `Reviewed source ${bundle.manifest.sourceCommit}`, parentCommit: remote.sha } },
  ...bundle.files.map((file) => ({ key: 'file', value: { path: file.path, encoding: 'base64', content: file.content.toString('base64') } }))];
  const commit = await request(`/api/datasets/${repository}/commit/main`, { method: 'POST', contentType: 'application/x-ndjson',
    body: `${operations.map((operation) => JSON.stringify(operation)).join('\n')}\n` });
  if (!/^[a-f0-9]{40}$/.test(commit.commitOid || '')) throw new Error('Publication returned no verifiable commit');
  const verify = await request(`/api/datasets/${repository}`);
  if (verify.sha !== commit.commitOid) throw new Error('Published dataset head could not be verified');
  for (const file of bundle.files) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
    try {
      // These files are public. CDN redirects never receive the account token.
      const response = await fetchImpl(`${HUB}/datasets/${repository}/resolve/${commit.commitOid}/${file.path}`, {
        method: 'GET', redirect: 'follow', signal: controller.signal, headers: { Accept: 'application/octet-stream' },
      });
      if (!response.ok) throw new Error(`Published file unavailable (HTTP ${response.status})`);
      const content = Buffer.from(await response.arrayBuffer());
      if (sha256(content) !== sha256(file.content)) throw new Error('Published file checksum mismatch');
    } finally { clearTimeout(timer); }
  }
  return { dryRun: false, repository, commit: commit.commitOid, rows: bundle.manifest.rowCount };
}

export async function main(argv = process.argv.slice(2)) {
  const options = { dryRun: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--publish') options.dryRun = false;
    else if (argv[i] === '--directory' && argv[i + 1]) options.directory = argv[++i];
    else if (argv[i] === '--repository' && argv[i + 1]) options.repository = argv[++i];
    else if (argv[i] === '--help') { console.log('publish-hf-dataset --directory EXPORT --repository OWNER/patina-suspect-zones [--publish]'); return; }
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  console.log(JSON.stringify(await publishDataset({ ...options, token: process.env.HF_TOKEN })));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

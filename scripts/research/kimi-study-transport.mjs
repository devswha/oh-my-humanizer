import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { invokeDetailed } from '../../src/backends/kimi-cli.js';

export const KIMI_PROFILE_MODELS = Object.freeze({
  'kimi-code/k3': 'k3',
  'kimi-code/k3-256k': 'k3-256k',
  'kimi-code/kimi-for-coding': 'kimi-for-coding',
  'kimi-code/kimi-for-coding-highspeed': 'kimi-for-coding-highspeed',
});
const EMPTY_TOOLS = createHash('sha256').update('[]').digest('hex');

// The trace proves the CLI's selected profile/request, not an independently
// disclosed server model version. Keep that distinction in public accounting.
export function parseKimiTrace(text, candidate) {
  const rows = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const requests = rows.filter((row) => row.type === 'llm.request');
  const usageRows = rows.filter((row) => row.type === 'usage.record' && row.usageScope === 'turn');
  const expected = KIMI_PROFILE_MODELS[candidate.model];
  if (!expected || requests.length !== 1 || usageRows.length !== 1) throw new Error('Kimi trace needs one request and one usage record');
  if (requests[0].model !== expected || requests[0].modelAlias !== candidate.model || usageRows[0].model !== candidate.model) throw new Error('Kimi trace profile mismatch');
  if (requests[0].toolsHash !== EMPTY_TOOLS || requests[0].toolSelect !== false) throw new Error('Kimi trace tool isolation not verified');
  const usage = usageRows[0].usage;
  for (const key of ['inputOther', 'output', 'inputCacheRead', 'inputCacheCreation']) {
    if (!Number.isSafeInteger(usage?.[key]) || usage[key] < 0) throw new Error('Kimi trace usage is incomplete');
  }
  return { effectiveModels: [candidate.model], identityEvidence: 'cli-request-trace', usageEvidence: 'cli-session-trace',
    usage: { prompt_tokens: usage.inputOther + usage.inputCacheRead + usage.inputCacheCreation,
      completion_tokens: usage.output, cached_read_tokens: usage.inputCacheRead, cache_write_tokens: usage.inputCacheCreation } };
}

function commandText(command, args, { deadline, signal }) {
  if (signal?.aborted || Date.now() >= deadline) return Promise.reject(new Error('Kimi trace deadline or cancellation'));
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let text = '', bytes = 0, failure = null;
    const stop = () => { failure ||= new Error('Kimi trace deadline or cancellation'); child.kill('SIGKILL'); };
    const timer = setTimeout(stop, Math.max(1, deadline - Date.now()));
    signal?.addEventListener('abort', stop, { once: true });
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 8 * 1024 * 1024) { failure = new Error('Kimi trace exceeds size limit'); stop(); return; }
      text += chunk;
    });
    child.on('error', () => { cleanup(); reject(new Error('Kimi trace export requires kimi and unzip executables')); });
    child.on('close', (code) => { cleanup(); if (failure || code !== 0) reject(failure || new Error('Kimi trace export failed')); else resolve(text); });
  });
}

export async function kimiStudyCompletion(candidate, prompt, { timeoutMs = 180000, signal } = {}) {
  const deadline = Date.now() + timeoutMs;
  const response = await invokeDetailed({ prompt, model: candidate.model, modelSource: 'flag', signal,
    timeout: Math.max(1, timeoutMs - Math.min(20000, timeoutMs / 4)) });
  if (!response.sessionId) throw new Error('Kimi trace session identity missing');
  const directory = mkdtempSync(join(tmpdir(), 'patina-kimi-study-trace-'));
  const archive = join(directory, 'session.private.zip');
  try {
    await commandText('kimi', ['export', response.sessionId, '--output', archive, '--yes', '--no-include-global-log'], { deadline, signal });
    chmodSync(archive, 0o600);
    const trace = await commandText('unzip', ['-p', archive, 'agents/main/wire.jsonl'], { deadline, signal });
    return { text: response.text, ...parseKimiTrace(trace, candidate), attempts: 1 };
  } catch (error) {
    error.studyResult = { attempts: 1, usage: null, effectiveModels: [], identityEvidence: 'unverified' };
    throw error;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

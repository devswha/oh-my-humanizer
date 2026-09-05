import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setInterval, clearInterval } from 'node:timers';
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

function cancelled() { const error = new Error('Kimi trace aborted'); error.name = 'AbortError'; return error; }

export function runKimiTraceCommand(command, args, { deadline, signal }) {
  if (signal?.aborted) return Promise.reject(cancelled());
  if (Date.now() >= deadline) return Promise.reject(new Error('Kimi trace deadline exceeded'));
  if (process.platform === 'win32') return Promise.reject(new Error('Kimi trace isolation requires POSIX'));
  return new Promise((resolve, reject) => {
    const directory = mkdtempSync(join(tmpdir(), 'patina-kimi-command-'));
    const status = join(directory, 'status');
    // A live group leader prevents PID reuse while inherited pipes remain open.
    const shell = 'patina_status=$1; patina_seconds=$2; shift 2; trap ":" TERM; (sleep "$patina_seconds"; /bin/kill -KILL -- -$$) & "$@" & patina_cli=$!; wait "$patina_cli"; patina_exit=$?; printf "%s" "$patina_exit" > "$patina_status"; while :; do sleep 1; done';
    let child;
    try { child = spawn('/bin/sh', ['-c', shell, 'patina-kimi-export', status, String(Math.ceil((deadline - Date.now() + 1000) / 1000)), command, ...args], { stdio: ['ignore', 'pipe', 'ignore'], detached: true }); }
    catch (error) { rmSync(directory, { recursive: true, force: true }); reject(error); return; }
    let text = '', bytes = 0, settled = false, exitCode = null, grace;
    const kill = () => { if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } } };
    const finish = (error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(grace); clearInterval(poll);
      signal?.removeEventListener('abort', onAbort); kill(); child.stdout.destroy();
      rmSync(directory, { recursive: true, force: true });
      if (error) reject(error); else resolve(text);
    };
    const onAbort = () => finish(cancelled());
    const timer = setTimeout(() => finish(new Error('Kimi trace deadline exceeded')), Math.max(1, deadline - Date.now()));
    const poll = setInterval(() => {
      if (exitCode !== null || !existsSync(status)) return;
      const value = readFileSync(status, 'utf8'); if (!/^\d{1,3}$/.test(value)) return;
      exitCode = Number(value); kill();
      grace = setTimeout(() => finish(new Error('Kimi trace pipes did not close')), 200);
    }, 10);
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 8 * 1024 * 1024) { finish(new Error('Kimi trace exceeds size limit')); return; }
      text += chunk;
    });
    child.on('error', () => finish(new Error('Kimi trace export requires kimi and unzip executables')));
    child.on('close', () => finish(exitCode === 0 ? null : new Error('Kimi trace export failed')));
  });
}

export async function kimiStudyCompletion(candidate, prompt, { timeoutMs = 180000, signal, invoke = invokeDetailed,
  prepareDirectory = () => mkdtempSync(join(tmpdir(), 'patina-kimi-study-trace-')) } = {}) {
  const deadline = Date.now() + timeoutMs;
  let response, directory;
  try {
    if (signal?.aborted) throw cancelled();
    response = await invoke({ prompt, model: candidate.model, modelSource: 'flag', signal,
      timeout: Math.max(1, timeoutMs - Math.min(20000, timeoutMs / 4)) });
    if (!response.sessionId) throw new Error('Kimi trace session identity missing');
    directory = prepareDirectory();
    const archive = join(directory, 'session.private.zip');
    await runKimiTraceCommand('kimi', ['export', response.sessionId, '--output', archive, '--yes', '--no-include-global-log'], { deadline, signal });
    chmodSync(archive, 0o600);
    const trace = await runKimiTraceCommand('unzip', ['-p', archive, 'agents/main/wire.jsonl'], { deadline, signal });
    return { text: response.text, ...parseKimiTrace(trace, candidate), attempts: 1 };
  } catch (error) {
    error.studyResult = { attempts: response ? 1 : null, usage: null, effectiveModels: [], identityEvidence: 'unverified' };
    throw error;
  } finally { if (directory) rmSync(directory, { recursive: true, force: true }); }
}

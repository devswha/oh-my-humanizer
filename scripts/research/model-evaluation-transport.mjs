import { spawn } from 'node:child_process';
import { setInterval, clearInterval } from 'node:timers';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { callLLM } from '../../src/api.js';
import { KIMI_PROFILE_MODELS, kimiStudyCompletion } from './kimi-study-transport.mjs';

const cancellation = new AbortController();
const children = new Map();
let signalsInstalled = false;
export function assertStudyActive() { if (cancellation.signal.aborted) throw new Error('Study cancelled'); }
export function abortStudy() {
  cancellation.abort();
  for (const child of children.values()) child.stop(new Error('Study cancelled'));
}
export function installStudySignals() {
  if (signalsInstalled) return;
  signalsInstalled = true;
  process.on('SIGTERM', abortStudy); process.on('SIGINT', abortStudy);
}

// An explicit file is supported for the existing local research credentials.
// Only the requested variable is read; the file never populates process.env.
export function readCredential(name, envFile) {
  if (!name) return null;
  if (/GEMINI|GOOGLE/i.test(name)) throw new Error('Gemini API credentials are forbidden in this study');
  if (process.env[name]) return process.env[name];
  if (!envFile) return null;
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match?.[1] !== name) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return value || null;
  }
  return null;
}

export function validateTransport(candidate) {
  if (!candidate?.id || !candidate.model || !candidate.provider) throw new Error('candidate id, model and provider are required');
  const gemini = candidate.provider === 'gemini' || /gemini/i.test(candidate.model);
  if (gemini && candidate.transport !== 'opencodex') throw new Error('Gemini requires the OpenCodex proxy');
  if (candidate.transport === 'kimi-cli') {
    if (candidate.provider !== 'kimi' || !Object.hasOwn(KIMI_PROFILE_MODELS, candidate.model)) throw new Error('kimi-cli requires an explicitly admitted Kimi coding profile');
    return;
  }
  if (candidate.transport === 'claude-cli') {
    if (candidate.provider !== 'anthropic' || !/^claude-[a-z0-9.-]+$/i.test(candidate.model)) throw new Error('claude-cli is restricted to explicit Anthropic candidates');
    return;
  }
  const url = new URL(candidate.baseURL);
  if (url.username || url.password || url.search || url.hash) throw new Error('endpoint must not embed credentials or query parameters');
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (!['http:', 'https:'].includes(url.protocol) || (!loopback && url.protocol !== 'https:')) throw new Error('remote endpoints require HTTPS');
  if (gemini) {
    if (candidate.transport !== 'opencodex' || !loopback || !candidate.model.startsWith('google-antigravity/gemini-') || candidate.apiKeyEnv) {
      throw new Error('Gemini requires an explicit google-antigravity model on the loopback OpenCodex proxy, without API credentials');
    }
  }
  if (candidate.transport === 'opencodex' && (!loopback || candidate.apiKeyEnv)) throw new Error('OpenCodex studies use loopback admission only');
  if (!['opencodex', 'http'].includes(candidate.transport)) throw new Error('unsupported study transport');
}

function claudeCompletion(candidate, prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') return reject(new Error('Native study isolation requires a POSIX shell'));
    const directory = mkdtempSync(join(tmpdir(), 'patina-study-cli-'));
    const statusPath = join(directory, 'status');
    const env = { ...process.env };
    delete env.GEMINI_API_KEY;
    delete env.GOOGLE_API_KEY;
    // Keep the group leader alive until the entire group is killed. This
    // prevents a CLI leader's early exit from orphaning detached-stdio helpers
    // or allowing its process-group ID to be reused before cleanup.
    const shell = 'exec 3<&0; patina_status=$1; patina_seconds=$2; shift 2; trap ":" TERM; (sleep "$patina_seconds"; /bin/kill -KILL -- -$$) & "$@" <&3 & patina_cli=$!; wait "$patina_cli"; patina_exit=$?; printf "%s" "$patina_exit" > "$patina_status"; while :; do sleep 1; done';
    const child = spawn('/bin/sh', ['-c', shell, 'patina-study', statusPath, String(Math.ceil((timeoutMs + 2000) / 1000)),
      'claude', '-p', '--model', candidate.model, '--output-format', 'json', '--tools', '', '--strict-mcp-config'], {
      cwd: directory, env, stdio: ['pipe', 'pipe', 'pipe'], detached: true,
    });
    let stdout = '';
    let size = 0;
    let settled = false;
    let failure = null;
    let escalation;
    let cliExitCode = null;
    const kill = (signal) => { if (!child.pid) return; try { process.kill(-child.pid, signal); } catch { child.kill(signal); } };
    const stop = (error) => {
      if (settled || failure) return;
      failure = error; kill('SIGTERM');
      escalation = setTimeout(() => kill('SIGKILL'), 1000);
    };
    const timer = setTimeout(() => stop(new Error('Claude study call timed out')), timeoutMs);
    const statusPoll = setInterval(() => {
      if (!existsSync(statusPath)) return;
      const value = readFileSync(statusPath, 'utf8');
      if (!/^\d{1,3}$/.test(value)) return;
      cliExitCode = Number(value);
      // The CLI is finished; kill the still-owned group, including helpers.
      kill('SIGKILL');
    }, 10);
    if (child.pid) children.set(child.pid, { stop });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > 4 * 1024 * 1024) return stop(new Error('Claude study output exceeded limit'));
      stdout += chunk;
    });
    // Drain stderr without retaining provider/account diagnostics in artifacts.
    child.stderr.resume();
    child.on('error', (error) => { failure = error; });
    child.on('close', (code) => {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(escalation); clearInterval(statusPoll); children.delete(child.pid);
      rmSync(directory, { recursive: true, force: true });
      let payload = null;
      try { payload = JSON.parse(stdout); } catch { /* No complete provider result. */ }
      try {
        if (failure) throw failure;
        if (cliExitCode !== 0) throw new Error(`Claude study process exited ${cliExitCode ?? code}`);
        const result = payload;
        if (result.is_error || typeof result.result !== 'string' || !result.result.trim()) throw new Error('Claude study returned no successful text');
        resolve({ text: result.result, effectiveModels: Object.keys(result.modelUsage || {}), usage: result.usage || null });
      } catch (error) {
        if (payload?.usage) error.studyResult = { usage: payload.usage, effectiveModels: Object.keys(payload.modelUsage || {}), attempts: 1 };
        reject(error);
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
  });
}

export async function studyCompletion(candidate, prompt, { envFile, timeoutMs = 180_000, onAttempt, temperature = 0.2, responseFormat, extraBody, maxRetries = 2 } = {}) {
  assertStudyActive();
  validateTransport(candidate);
  const start = Date.now();
  if (candidate.transport === 'kimi-cli') {
    const result = await kimiStudyCompletion(candidate, prompt, { timeoutMs, signal: cancellation.signal });
    return { ...result, durationMs: Date.now() - start, requestedTemperature: temperature, effectiveTemperature: null };
  }
  if (candidate.transport === 'claude-cli') {
    const result = await claudeCompletion(candidate, prompt, timeoutMs);
    return { ...result, durationMs: Date.now() - start, attempts: 1, requestedTemperature: temperature, effectiveTemperature: null };
  }
  const apiKey = candidate.transport === 'opencodex' ? 'opencodex-local' : readCredential(candidate.apiKeyEnv, envFile);
  if (!apiKey) throw new Error(`Missing credential: ${candidate.apiKeyEnv}`);
  let metadata = null;
  let attempts = 0;
  const text = await callLLM({
    prompt, apiKey, baseURL: candidate.baseURL, model: candidate.model,
    temperature, responseFormat, extraBody: { ...candidate.extraBody, ...extraBody },
    signal: cancellation.signal,
    timeout: timeoutMs, deadline: Date.now() + timeoutMs, maxRetries,
    onResponse: (response) => { metadata = response; },
    onAttempt: (attempt) => { attempts++; onAttempt?.(attempt); },
  });
  if (!text.trim()) throw new Error('Empty study completion');
  return { text, durationMs: Date.now() - start, attempts,
    effectiveModels: metadata?.model ? [metadata.model] : [], usage: metadata?.usage || null,
    requestedTemperature: temperature };
}

export function safeStudyError(error) {
  // Provider errors can contain organization IDs, key IDs and echoed input.
  // Store a bounded classification, never a fragment of the upstream body.
  const message = String(error?.message || '');
  if (/study.cancelled|aborted/i.test(message)) return 'study-cancelled';
  if (/journal[- ]persistence[- ]failed/i.test(message)) return 'study-journal-persistence-failed';
  if (/outcome unobserved|study-call-unobserved/i.test(message)) return 'study-call-unobserved';
  if (/still in flight|study-call-inflight/i.test(message)) return 'study-call-inflight';
  const status = message.match(/HTTP (\d{3})/)?.[1];
  const suffix = status ? ` (HTTP ${status})` : '';
  if (/insufficient.*balance|balance.*insufficient|recharge.*account/i.test(message)) return `provider-insufficient-balance${suffix}`;
  if (/timed?\s*out|timeout|deadline/i.test(message)) return `request-timeout${suffix}`;
  if (/Missing credential: [A-Z][A-Z0-9_]*$/.test(message)) return message;
  if (status === '429') return 'provider-rate-limited (HTTP 429)';
  if (status === '401' || status === '403') return `provider-access-denied${suffix}`;
  if (status === '404' || /model.*(?:not found|not supported|unavailable)/i.test(message)) return `model-unavailable${suffix}`;
  if (/empty|no successful text/i.test(message)) return 'empty-completion';
  if (/Claude study process exited \d+$/.test(message)) return message;
  return `study-call-failed${suffix}`;
}

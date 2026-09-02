// Shared plumbing for rewrite-efficacy Study 4 (docs/research/2026-rewrite-efficacy-prereg.md,
// "Study 4" section). Judge prompt/parse are byte-identical to the Study 1/2/3
// runners; process spawning and the claude call mirror the Study 3 harness.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const S1_DIR = join(ROOT, 'artifacts', 'rewrite-efficacy-study1');
export const OUT_DIR = join(ROOT, 'artifacts', 'rewrite-efficacy-study4');
export const REWRITER_MODEL = 'claude-sonnet-4-6';
export const NO_MCP_SERVERS = '__patina_no_mcp__'; // src/backends/gemini-cli.js
export const JUDGE_TIMEOUT_MS = 180_000;
export const JUDGE_ATTEMPTS = 3;

const HTTP_CLI = [join('scripts', 'research', 'judge-http-cli.mjs')];
const http = (id, family, baseURL, keyEnv, model) => ({
  id, family, cmd: 'node', args: HTTP_CLI,
  env: { JUDGE_BASE_URL: baseURL, JUDGE_API_KEY_ENV: keyEnv, JUDGE_MODEL: model },
});

export const JUDGE_DEFS = Object.freeze({
  'judge-gpt': { id: 'judge-gpt', family: 'gpt', cmd: 'codex', args: ['exec', '--skip-git-repo-check', '--sandbox', 'read-only'] },
  'judge-gemini': { id: 'judge-gemini', family: 'gemini', cmd: 'gemini', args: ['-p', '', '--output-format', 'text', '--skip-trust', '--allowed-mcp-server-names', NO_MCP_SERVERS, '-m', 'gemini-2.5-pro'] },
  'judge-grok': { id: 'judge-grok', family: 'xai', cmd: 'node', args: [join('scripts', 'research', 'xai-cli.mjs')] },
  // Bridge candidates without xAI credit (2026-09-02 amendment): API judges on
  // the OpenAI-compatible endpoints patina's providers already use.
  'judge-gemini-3.7-flash': http('judge-gemini-3.7-flash', 'gemini', 'https://generativelanguage.googleapis.com/v1beta/openai', 'GEMINI_API_KEY', 'gemini-3.7-flash'),
  'judge-gemini-3.1-pro': http('judge-gemini-3.1-pro', 'gemini', 'https://generativelanguage.googleapis.com/v1beta/openai', 'GEMINI_API_KEY', 'gemini-3.1-pro-preview'),
  'judge-deepseek-v4-pro': http('judge-deepseek-v4-pro', 'deepseek', 'https://api.deepseek.com', 'DEEPSEEK_API_KEY', 'deepseek-v4-pro'),
  'judge-kimi-k3': http('judge-kimi-k3', 'moonshot', 'https://api.moonshot.ai/v1', 'KIMI_API_KEY', 'kimi-k3'),
});

export const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);

export function makeLogger(path) {
  return (m) => {
    const line = `[${new Date().toISOString()}] ${m}`;
    console.log(line);
    appendFileSync(path, line + '\n');
  };
}

export function run(cmd, args, { input = '', timeout = 120_000, cwd = ROOT, env = null } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], detached: true, env: env ? { ...process.env, ...env } : process.env });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* noop */ } }
      finish({ ok: false, stdout, stderr, error: `timeout after ${timeout}ms` });
    }, timeout);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => finish({ ok: false, stdout, stderr, error: String(e?.message ?? e) }));
    child.on('close', (code) => finish({ ok: code === 0, code, stdout, stderr }));
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

/** claude -p in a fresh temp cwd (same containment as patina's claude-cli backend). */
export async function claudeCall(prompt, { timeout, model = REWRITER_MODEL } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'patina-s4-claude-'));
  try {
    const res = await run('claude', ['-p', '--model', model], { input: prompt, timeout, cwd: dir });
    if (!res.ok) return { text: null, error: res.error || res.stderr.slice(0, 300) || `exit ${res.code}` };
    let out = String(res.stdout).trim();
    const fence = out.match(/^```[a-z]*\n([\s\S]*)\n```$/);
    if (fence) out = fence[1].trim();
    if (!out) return { text: null, error: 'empty output' };
    return { text: out, error: null };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}

// Judge prompt — byte-identical to the Study 1 runner (lang line included).
export function judgePrompt(text, lang) {
  return [
    'You are evaluating a single passage of writing. You do not know its origin.',
    '',
    'Answer BOTH questions independently. Do not let one answer drive the other.',
    '',
    'Q1 (authorship): Was this passage most likely written by a human, or generated by an AI language model?',
    'Q2 (AI-likeness): On a 0-100 scale, how AI-like does the PROSE read?',
    '   0 = reads unmistakably like an individual human wrote it',
    '   100 = reads unmistakably like generic AI output',
    '   Judge the writing itself (rhythm, word choice, structure, specificity), not the topic.',
    '',
    'Then name the single strongest cue that drove your judgement.',
    '',
    `The passage is in ${lang === 'ko' ? 'Korean' : 'English'}.`,
    '',
    'Respond with ONLY a JSON object, no code fence, no prose:',
    '{"authorship":"human"|"ai","ai_likeness":<0-100 integer>,"strongest_cue":"<short phrase>"}',
    '',
    '--- PASSAGE START ---',
    text,
    '--- PASSAGE END ---',
  ].join('\n');
}

const SCORE_KEYS = ['ai_likeness', 'ai_status', 'ai_score', 'score', 'aiLikeness'];

export function parseJudge(raw) {
  if (!raw) return null;
  const matches = String(raw).match(/\{[^{}]*"authorship"[^{}]*\}/g);
  if (!matches) return null;
  for (const candidate of [...matches].reverse()) {
    try {
      const o = JSON.parse(candidate);
      const authorship = String(o.authorship || '').toLowerCase();
      if (authorship !== 'human' && authorship !== 'ai') continue;
      const key = SCORE_KEYS.find((k) => Number.isFinite(Number(o[k])));
      if (!key) continue;
      return {
        authorship,
        ai_likeness: Math.max(0, Math.min(100, Math.round(Number(o[key])))),
        strongest_cue: String(o.strongest_cue || '').slice(0, 200),
        score_key: key === 'ai_likeness' ? undefined : key,
      };
    } catch { /* next */ }
  }
  return null;
}

export async function judgeOnce(judge, text, lang) {
  const attempts = [];
  let lastOut = '';
  let lastErr = '';
  for (let attempt = 1; attempt <= JUDGE_ATTEMPTS; attempt += 1) {
    const res = await run(judge.cmd, judge.args, { input: judgePrompt(text, lang), timeout: JUDGE_TIMEOUT_MS, env: judge.env ?? null });
    const parsed = parseJudge(res.stdout);
    if (parsed) return attempt === 1 ? parsed : { ...parsed, retried: true };
    attempts.push(res.error || 'unparseable');
    lastOut = String(res.stdout);
    lastErr = String(res.stderr);
  }
  return { error: attempts.join(' | '), raw_head: (lastOut || lastErr).slice(-240), retries_exhausted: true };
}

export function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

/** S1 text store for one arm, TOPUP-deduped by original_sha (last write wins). */
export function loadS1Texts(arm) {
  const byKey = new Map();
  for (const f of readdirSync(S1_DIR).filter((x) => /^s1-texts(-.*)?\.private\.jsonl$/.test(x))) {
    for (const t of readJsonl(join(S1_DIR, f))) if (t.arm === arm) byKey.set(t.original_sha, t);
  }
  return byKey;
}

// ---------------------------------------------------------------------------
// Pre-registered deterministic measures.

export function collapse(text) {
  return String(text ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
}

const NUMBER_RE = /\d[\d,.]*(?:\s?(?:%|[A-Za-z]{1,4}|[가-힣]{1,2}))?/gu;
const LATIN_RE = /[A-Za-z][A-Za-z0-9+._-]+/gu;
const QUOTE_RE = /[“"‘'「『]([^”"’'」』\n]{2,60})[”"’'」』]/gu;

export function detailTokens(text) {
  const t = collapse(text);
  const set = new Set();
  for (const m of t.matchAll(NUMBER_RE)) set.add(`n:${m[0].replace(/,/gu, '').replace(/\s+/gu, '')}`);
  for (const m of t.matchAll(LATIN_RE)) set.add(`l:${m[0].toLowerCase()}`);
  for (const m of t.matchAll(QUOTE_RE)) set.add(`q:${m[1].trim()}`);
  return set;
}

export function detailStats(original, rewrite) {
  const o = detailTokens(original);
  const r = detailTokens(rewrite);
  let retained = 0;
  for (const tok of o) if (r.has(tok)) retained += 1;
  let added = 0;
  for (const tok of r) if (!o.has(tok)) added += 1;
  return { orig_count: o.size, retained, retention: o.size ? retained / o.size : null, added };
}

export function trigramJaccard(a, b) {
  const grams = (s) => { const t = collapse(s); const g = new Set(); for (let i = 0; i + 3 <= t.length; i++) g.add(t.slice(i, i + 3)); return g; };
  const A = grams(a); const B = grams(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export function lengthRatio(original, rewrite) {
  const o = collapse(original).length;
  return o ? collapse(rewrite).length / o : null;
}

// ---------------------------------------------------------------------------
// Statistics.

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function lcg(seed = 20260902) {
  let s = seed >>> 0;
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
}

export function bootstrapCI(values, stat = mean, { iters = 5000, seed = 20260902 } = {}) {
  if (values.length < 2) return null;
  const rnd = lcg(seed);
  const stats = [];
  for (let i = 0; i < iters; i++) {
    const sample = values.map(() => values[Math.floor(rnd() * values.length)]);
    stats.push(stat(sample));
  }
  stats.sort((a, b) => a - b);
  return [stats[Math.floor(0.025 * iters)], stats[Math.ceil(0.975 * iters) - 1]];
}

function ranks(xs) {
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function spearman(xs, ys) {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const rx = ranks(xs); const ry = ranks(ys);
  const mx = mean(rx); const my = mean(ry);
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < rx.length; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

/** AUC = P(score(pos) > score(neg)) with ties counted 0.5. */
export function auc(pos, neg) {
  if (!pos.length || !neg.length) return null;
  let s = 0;
  for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}

/** Exact McNemar (binomial) on discordant pairs: b = P-only "ai", c = S-only "ai". */
export function mcnemarExact(b, c) {
  const n = b + c;
  if (n === 0) return { b, c, p: 1 };
  const k = Math.min(b, c);
  let p = 0;
  const logChoose = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
  for (let i = 0; i <= k; i++) p += Math.exp(logChoose(n, i) - n * Math.log(2));
  return { b, c, p: Math.min(1, 2 * p) };
}

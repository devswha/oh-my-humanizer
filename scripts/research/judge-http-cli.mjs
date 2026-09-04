#!/usr/bin/env node
// Minimal OpenAI-compatible chat judge: prompt on stdin, model text on stdout.
// Env: JUDGE_BASE_URL, JUDGE_API_KEY_ENV (name of the env var holding the key),
//      JUDGE_MODEL, JUDGE_TIMEOUT_MS (default 110000). Same stdin/stdout shape
//      as scripts/research/xai-cli.mjs so it plugs into judgeOnce().

import { readFileSync } from 'node:fs';

const BASE = process.env.JUDGE_BASE_URL;
const KEY_ENV = process.env.JUDGE_API_KEY_ENV;
const MODEL = process.env.JUDGE_MODEL;
const TIMEOUT_MS = Number(process.env.JUDGE_TIMEOUT_MS || 110_000);
const API_KEY = KEY_ENV ? process.env[KEY_ENV] : null;

if (!BASE || !MODEL || !API_KEY) {
  console.error('judge-http-cli: JUDGE_BASE_URL, JUDGE_MODEL and the key named by JUDGE_API_KEY_ENV are required');
  process.exit(2);
}

const prompt = readFileSync(0, 'utf8');
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
try {
  const res = await fetch(`${BASE.replace(/\/$/u, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0 }),
    signal: controller.signal,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`judge-http-cli: HTTP ${res.status}: ${text.slice(0, 300)}`);
    process.exit(1);
  }
  const json = JSON.parse(text);
  const content = json?.choices?.[0]?.message?.content;
  process.stdout.write(typeof content === 'string' ? content : JSON.stringify(content ?? json));
} catch (error) {
  console.error(`judge-http-cli: ${error?.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : String(error?.message ?? error)}`);
  process.exit(1);
} finally {
  clearTimeout(timer);
}

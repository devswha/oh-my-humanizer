import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { stripGeminiNoise } from '../../src/backends/gemini-cli.js';
import { extractKimiFinalMessage, stripKimiNoise } from '../../src/backends/kimi-cli.js';

test('stripGeminiNoise strips known leading banners but keeps a "Warning:" response (#446)', () => {
  const noisy = 'Loaded cached credentials\nRipgrep is not available. Falling back to GrepTool.\n\nThe real rewritten text.';
  assert.equal(stripGeminiNoise(noisy), 'The real rewritten text.');
  // A model response that legitimately begins with "Warning:" must NOT be truncated.
  const warning = 'Warning: this approach has a tradeoff.\n\nUse it carefully.';
  assert.equal(stripGeminiNoise(warning), warning);
  // MCP banner is still stripped.
  assert.equal(stripGeminiNoise('MCP issues detected: foo\nBody here.'), 'Body here.');
});

test('stripKimiNoise strips only the trailing resume banner (#446)', () => {
  const trailing = 'Rewritten body line one.\nLine two.\n\nTo resume this session: kimi -r abc123';
  assert.equal(stripKimiNoise(trailing), 'Rewritten body line one.\nLine two.');
  // A banner-shaped line mid-body (with real content as the trailing line) is
  // preserved — the old filter removed it anywhere in the body and lost content.
  const midBanner = 'To resume this session: kimi -r quoted-in-body\nBut the actual answer continues here.';
  assert.equal(stripKimiNoise(midBanner), midBanner);
  // No banner → unchanged aside from leading trim.
  assert.equal(stripKimiNoise('just a response'), 'just a response');
});

test('extractKimiFinalMessage takes the LAST assistant event from stream-json (kimi >= 0.28)', () => {
  const ndjson = [
    '{"role":"assistant","content":"Intermediate reasoning summary."}',
    '{"role":"assistant","content":"{\\"overall\\": 12}"}',
    '{"role":"meta","type":"session.resume_hint","content":"To resume this session: kimi -r session_x"}',
  ].join('\n');
  assert.equal(extractKimiFinalMessage(ndjson), '{"overall": 12}');
});

test('extractKimiFinalMessage ignores malformed lines and non-assistant roles', () => {
  const ndjson = [
    'not json at all',
    '{"role":"tool","content":"ignored"}',
    '{broken json',
    '{"role":"assistant","content":"final answer"}',
  ].join('\n');
  assert.equal(extractKimiFinalMessage(ndjson), 'final answer');
});

test('extractKimiFinalMessage falls back to banner-stripped raw text for legacy plain output', () => {
  const legacy = 'Plain text answer.\n\nTo resume this session: kimi -r abc123';
  assert.equal(extractKimiFinalMessage(legacy), 'Plain text answer.');
});

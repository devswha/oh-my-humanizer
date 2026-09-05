import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { startAsideOptionsServer } from '../../src/aside/server.js';

async function fixture(t, options = {}) {
  const workspace = await mkdtemp(join(tmpdir(), 'patina-aside-server-'));
  const server = await startAsideOptionsServer({ workspace, ...options });
  t.after(async () => { server.close(); await rm(workspace, { recursive: true, force: true }); });
  const headers = { 'X-Patina-Session': server.token, Origin: server.origin, 'Content-Type': 'application/json' };
  return { workspace, ...server, headers };
}

test('local options UI reads defaults and saves a real settings file with optimistic concurrency', async (t) => {
  const f = await fixture(t);
  assert.equal(f.server.address().address, '127.0.0.1');
  const page = await fetch(f.origin);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
  assert.doesNotMatch(await page.text(), new RegExp(f.token));
  const initial = await (await fetch(`${f.origin}/api/options`, { headers: f.headers })).json();
  assert.equal(initial.configured, false);
  assert.equal(initial.settings.documentType, 'blog');
  assert.equal(initial.settingsHash, null);
  const settings = { ...initial.settings, language: 'ko', register: 'professional' };
  const response = await fetch(`${f.origin}/api/options`, { method: 'POST', headers: f.headers, body: JSON.stringify({ settings, baseHash: null }) });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.configured, true);
  assert.equal(saved.settings.language, 'ko');
  assert.equal(saved.settings.register, 'professional');
  assert.equal(JSON.parse(await readFile(join(f.workspace, '.patina/aside.json'), 'utf8')).language, 'ko');
  const stale = await fetch(`${f.origin}/api/options`, { method: 'POST', headers: f.headers, body: JSON.stringify({ settings: initial.settings, baseHash: null }) });
  assert.equal(stale.status, 409);
  const latest = await (await fetch(`${f.origin}/api/options`, { headers: f.headers })).json();
  assert.equal(latest.settingsHash, saved.settingsHash);
});

test('session, origin and JSON bounds prevent unrelated pages from changing local settings', async (t) => {
  const f = await fixture(t);
  for (const headers of [{}, { 'X-Patina-Session': 'incorrect' }, { ...f.headers, Origin: 'https://unrelated.example' }]) {
    assert.equal((await fetch(`${f.origin}/api/options`, { headers })).status, 403);
  }
  const response = await fetch(`${f.origin}/api/options`, { method: 'POST', headers: { 'X-Patina-Session': f.token, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 403);
  assert.equal((await fetch(`${f.origin}/api/options`, { method: 'POST', headers: { ...f.headers, 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
  assert.equal((await fetch(`${f.origin}/api/options`, { method: 'POST', headers: f.headers, body: 'x'.repeat(65537) })).status, 413);
  assert.equal((await fetch(`${f.origin}/api/options`, { method: 'POST', headers: f.headers, body: JSON.stringify({ settings: { apiKey: 'do-not-save' }, baseHash: null }) })).status, 400);
  assert.equal((await fetch(`${f.origin}/api/options?token=${f.token}`, { headers: f.headers })).status, 400);
  assert.equal((await fetch(`${f.origin}/.patina/aside.json`)).status, 404);
  const hostStatus = await new Promise((resolve, reject) => {
    const req = request(`${f.origin}/api/options`, { headers: { ...f.headers, Host: 'rebound.example' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(hostStatus, 403);
});

test('the settings session has a bounded lifetime and an authenticated close action', async (t) => {
  const f = await fixture(t, { sessionMs: 1000 });
  await new Promise(resolve => f.server.once('close', resolve));
  await assert.rejects(fetch(`${f.origin}/api/options`, { headers: f.headers }));
  const other = await fixture(t);
  const closed = new Promise(resolve => other.server.once('close', resolve));
  const response = await fetch(`${other.origin}/api/close`, { method: 'POST', headers: other.headers, body: '{}' });
  assert.equal(response.status, 200);
  await closed;
});

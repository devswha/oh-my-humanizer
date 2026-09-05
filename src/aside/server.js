import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setImmediate } from 'node:timers';
import { getRepoRoot } from '../config.js';
import { getAsideChoices, readAsideSettings, saveAsideSettings } from './options.js';

const MAX_BODY_BYTES = 64 * 1024;
const SESSION_MS = 15 * 60 * 1000;
const ASSETS = Object.freeze({ '/': ['options.html', 'text/html; charset=utf-8'],
  '/options.js': ['options.js', 'text/javascript; charset=utf-8'],
  '/options.css': ['options.css', 'text/css; charset=utf-8'] });

function send(res, status, value) {
  if (res.destroyed || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

async function readJson(req) {
  if (String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw Object.assign(new Error('json_required'), { status: 415 });
  }
  const chunks = []; let size = 0;
  await new Promise((resolveBody, reject) => {
    const cleanup = () => { req.off('data', data); req.off('end', end); req.off('error', failed); req.off('aborted', aborted); };
    const failed = (error) => { cleanup(); reject(error); };
    const aborted = () => failed(new Error('request_aborted'));
    const data = (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        cleanup(); req.resume();
        reject(Object.assign(new Error('request_too_large'), { status: 413 }));
      } else chunks.push(chunk);
    };
    const end = () => { cleanup(); resolveBody(); };
    req.on('data', data); req.on('end', end); req.on('error', failed); req.on('aborted', aborted);
  });
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('invalid_json'), { status: 400 }); }
}

/** A short-lived loopback page for options; it never reads drafts or calls a model. */
export async function startAsideOptionsServer({ workspace, port = 0, sessionMs = SESSION_MS, repoRoot = getRepoRoot() }) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('invalid_port');
  if (!Number.isInteger(sessionMs) || sessionMs < 1000 || sessionMs > SESSION_MS) throw new TypeError('invalid_session_duration');
  const token = randomBytes(32).toString('hex');
  const tokenBytes = Buffer.from(token);
  let origin, timer;
  let closed = false;
  const sockets = new Set();
  const server = createServer(async (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    res.setHeader('cross-origin-resource-policy', 'same-origin');
    try {
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) {
        return send(res, 403, { ok: false, code: 'origin_denied' });
      }
      const url = new URL(req.url, origin);
      if (url.origin !== origin || url.search) return send(res, 400, { ok: false, code: 'invalid_url' });
      if (Object.hasOwn(ASSETS, url.pathname) && (req.method === 'GET' || req.method === 'HEAD')) {
        const [file, type] = ASSETS[url.pathname];
        const bytes = readFileSync(resolve(repoRoot, 'assets/aside', file));
        res.setHeader('content-type', type);
        return res.end(req.method === 'HEAD' ? undefined : bytes);
      }
      if (!['/api/options', '/api/close'].includes(url.pathname)) return send(res, 404, { ok: false, code: 'not_found' });
      const supplied = req.headers['x-patina-session'];
      const suppliedBytes = typeof supplied === 'string' ? Buffer.from(supplied) : Buffer.alloc(0);
      if (suppliedBytes.length !== tokenBytes.length || !timingSafeEqual(suppliedBytes, tokenBytes)) {
        return send(res, 403, { ok: false, code: 'session_required' });
      }
      const state = async () => {
        const value = await readAsideSettings(workspace);
        return { schemaVersion: 1, configured: value.configured, settingsHash: value.settingsHash,
          settings: value.settings, choices: getAsideChoices() };
      };
      if (req.method === 'GET' && url.pathname === '/api/options') return send(res, 200, await state());
      if (req.method !== 'POST') return send(res, 405, { ok: false, code: 'method_not_allowed' });
      if (req.headers.origin !== origin) return send(res, 403, { ok: false, code: 'origin_required' });
      const body = await readJson(req);
      if (url.pathname === '/api/close') {
        if (!body || Array.isArray(body) || Object.keys(body).length) return send(res, 400, { ok: false, code: 'invalid_request' });
        send(res, 200, { ok: true });
        setImmediate(close);
        return;
      }
      if (!body || Array.isArray(body) || Object.keys(body).length !== 2
        || !Object.hasOwn(body, 'settings') || !Object.hasOwn(body, 'baseHash')
        || !(body.baseHash === null || typeof body.baseHash === 'string')) {
        return send(res, 400, { ok: false, code: 'invalid_request' });
      }
      const current = await readAsideSettings(workspace);
      if (body.baseHash !== current.settingsHash) return send(res, 409, { ok: false, code: 'settings_changed' });
      await saveAsideSettings(workspace, body.settings, { expectedHash: body.baseHash });
      return send(res, 200, await state());
    } catch (error) {
      const conflict = ['settings_changed', 'settings_conflict', 'aside_settings_conflict'].includes(error.code);
      const status = conflict ? 409 : [400, 413, 415].includes(error.status) ? error.status
        : [400, 423].includes(error.statusCode) ? error.statusCode
          : error instanceof TypeError || error instanceof RangeError ? 400 : 500;
      return send(res, status, { ok: false, code: conflict ? 'settings_changed' : status === 400 ? 'invalid_settings' : status === 413 ? 'request_too_large' : status === 415 ? 'json_required' : 'settings_unavailable' });
    }
  });
  server.headersTimeout = 5000;
  server.requestTimeout = 10000;
  server.keepAliveTimeout = 1000;
  server.on('connection', (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    server.close();
    for (const socket of sockets) socket.destroy();
  };
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  const expiresAt = new Date(Date.now() + sessionMs).toISOString();
  timer = setTimeout(close, sessionMs);
  timer.unref();
  return { url: `${origin}/#${token}`, origin, token, expiresAt, close, server };
}

// The CLI starts this process with IPC, then disconnects once its URL is ready.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.once('message', async (input) => {
    try {
      const service = await startAsideOptionsServer(input);
      process.send?.({ ok: true, url: service.url, expiresAt: service.expiresAt });
      process.on('SIGTERM', service.close);
      process.on('SIGINT', service.close);
    } catch {
      process.send?.({ ok: false, code: 'options_start_failed' });
      process.exitCode = 1;
      process.disconnect?.();
    }
  });
}

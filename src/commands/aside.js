import { fork } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRepoRoot } from '../config.js';
import { readAsideSettings } from '../aside/options.js';
import { runAsideRewrite } from '../aside/runner.js';
import { startAsideOptionsServer } from '../aside/server.js';

const HELP = `patina aside options [--workspace DIR] [--port NUMBER]
patina aside status [--workspace DIR]
patina aside rewrite --input FILE --output FILE [--workspace DIR]
patina aside skill

Rewrite overrides: --lang, --document-type, --persona, --register, --backend, --model.
Use "preserve" for source persona/register, "configured" for backend/model.

Options opens a short-lived loopback settings page: use the returned URL in Aside.
Settings are local to the workspace. The command returns immediately.
Rewrite requires meaning verification and only writes a verified, unchanged-source result.
Every subcommand returns JSON. No content is published by these commands.
`;

function parse(args) {
  const command = args[0] || 'help';
  if (['help', '--help', '-h'].includes(command)) return { command: 'help' };
  if (!['options', 'status', 'rewrite', 'skill'].includes(command)) throw new TypeError('unknown_aside_command');
  const options = { command, workspace: process.cwd(), port: 0, foreground: false, overrides: {} };
  const overrideKeys = { '--lang': 'language', '--document-type': 'documentType', '--persona': 'persona',
    '--register': 'register', '--backend': 'backend', '--model': 'model' };
  const seen = new Set();
  for (let i = 1; i < args.length; i += 1) {
    const name = args[i];
    if (name === '--help' || name === '-h') return { command: 'help' };
    if (seen.has(name)) throw new TypeError('duplicate_option');
    seen.add(name);
    if (name === '--foreground' && command === 'options') { options.foreground = true; continue; }
    if (!['--workspace', '--input', '--output', '--port'].includes(name) && !Object.hasOwn(overrideKeys, name)) throw new TypeError('unknown_option');
    const value = args[++i];
    if (typeof value !== 'string' || !value || value.startsWith('--')) throw new TypeError('missing_option_value');
    if (Object.hasOwn(overrideKeys, name) && command === 'rewrite') {
      const key = overrideKeys[name];
      options.overrides[key] = (['persona', 'register'].includes(key) && value === 'preserve')
        || (['backend', 'model'].includes(key) && value === 'configured') ? null : value;
    } else if (name === '--workspace') options.workspace = resolve(value);
    else if (name === '--port' && command === 'options') {
      if (!/^\d+$/.test(value)) throw new TypeError('invalid_port');
      options.port = Number(value);
      if (options.port > 65535) throw new TypeError('invalid_port');
    } else if (command === 'rewrite' && (name === '--input' || name === '--output')) options[name.slice(2)] = value;
    else throw new TypeError('invalid_option_for_command');
  }
  if (command === 'rewrite' && (!options.input || !options.output)) throw new TypeError('input_and_output_required');
  return options;
}

export async function launchAsideOptions({ workspace, port = 0 }) {
  const child = fork(fileURLToPath(new URL('../aside/server.js', import.meta.url)), [], {
    cwd: workspace, detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.fromEntries(['PATH', 'HOME', 'USERPROFILE', 'TMPDIR', 'TEMP', 'LANG'].filter((key) => typeof process.env[key] === 'string').map((key) => [key, process.env[key]])),
  });
  return new Promise((resolveReady, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error('options_start_timeout')), 10000);
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeAllListeners('message');
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
      child.on('error', () => {});
      if (error) { child.kill(); if (child.connected) child.disconnect(); child.unref(); reject(error); }
      else {
        if (child.connected) child.disconnect();
        child.unref();
        resolveReady(result);
      }
    };
    child.once('message', (message) => {
      if (message?.ok === true && typeof message.url === 'string') finish(null, message);
      else finish(new Error('options_start_failed'));
    });
    child.once('error', () => finish(new Error('options_start_failed')));
    child.once('exit', () => finish(new Error('options_start_failed')));
    child.send({ workspace, port });
  });
}

export async function runAside(args, { output = (value) => console.log(value) } = {}) {
  try {
    const options = parse(args);
    if (options.command === 'help') { output(HELP); return; }
    const workspace = realpathSync(options.workspace);
    if (!statSync(workspace).isDirectory()) throw new TypeError('workspace_must_be_directory');
    if (options.command === 'skill') {
      const path = resolve(getRepoRoot(), 'integrations/aside/SKILL.md');
      if (!existsSync(path)) throw new Error('aside_skill_missing');
      output(JSON.stringify({ schemaVersion: 1, name: 'patina-aside', path,
        instructions: 'Read this file and use Aside\'s custom-skill creator to register it. This command does not change Aside configuration.' }));
      return;
    }
    if (options.command === 'status') {
      output(JSON.stringify({ schemaVersion: 1, ...await readAsideSettings(workspace) }));
      return;
    }
    if (options.command === 'options') {
      const service = options.foreground
        ? await startAsideOptionsServer({ workspace, port: options.port })
        : await launchAsideOptions({ workspace, port: options.port });
      output(JSON.stringify({ schemaVersion: 1, ok: true, url: service.url, expiresAt: service.expiresAt }));
      return;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    process.once('SIGINT', abort); process.once('SIGTERM', abort);
    let result;
    try {
      result = await runAsideRewrite({ workspace, inputPath: options.input, outputPath: options.output, signal: controller.signal, overrides: options.overrides });
    } finally {
      process.off('SIGINT', abort); process.off('SIGTERM', abort);
    }
    output(JSON.stringify({ schemaVersion: 1, ...result }));
    if (!result.ok) process.exitCode = Math.max(Number(process.exitCode) || 0, controller.signal.aborted ? 130 : result.exitCode || 4);
  } catch (error) {
    const input = error instanceof TypeError || error instanceof RangeError || error.statusCode === 400;
    const code = typeof error.code === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(error.code)
      ? error.code : input ? 'invalid_aside_request' : 'aside_failed';
    output(JSON.stringify({ schemaVersion: 1, ok: false, status: 'error', code }));
    process.exitCode = Math.max(Number(process.exitCode) || 0, input ? 2 : 1);
  }
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processIdentity } from '../../scripts/research/study-job.mjs';
import { studyCompletion } from '../../scripts/research/model-evaluation-transport.mjs';

function fakeCli() {
  const directory = mkdtempSync(join(tmpdir(), 'patina-study-child-'));
  const executable = join(directory, 'claude');
  const pidPath = join(directory, 'child.pid');
  writeFileSync(executable, '#!/bin/sh\ntrap "" TERM\nprintf "%s" "$$" > "$PATINA_TEST_CLI_PID"\nwhile :; do sleep 1; done\n');
  chmodSync(executable, 0o700);
  return { directory, pidPath, env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, PATINA_TEST_CLI_PID: pidPath } };
}

test('native CLI receives the complete UTF-8 prompt and returns its JSON result', { skip: process.platform !== 'linux' }, async () => {
  const fake = fakeCli();
  const executable = join(fake.directory, 'claude');
  writeFileSync(executable, '#!/usr/bin/env node\nlet input="";process.stdin.setEncoding("utf8");process.stdin.on("data",part=>input+=part);process.stdin.on("end",()=>{console.log(JSON.stringify({type:"assistant",parent_tool_use_id:null,message:{model:"claude-test",content:[{type:"text",text:input}]}}));console.log(JSON.stringify({type:"result",result:input,is_error:false,modelUsage:{"claude-test":{inputTokens:1,outputTokens:1,cacheReadInputTokens:0,cacheCreationInputTokens:0}},usage:{input_tokens:1,output_tokens:1}}));});\n');
  chmodSync(executable, 0o700);
  const oldPath = process.env.PATH; process.env.PATH = fake.env.PATH;
  try {
    const prompt = '문장을 그대로 유지하세요.\nA quote: "hello" — 12 updates. 中文 日本語';
    const result = await studyCompletion({ id: 'fake', provider: 'anthropic', transport: 'claude-cli', model: 'claude-test' }, prompt, { timeoutMs: 3000 });
    assert.equal(result.text, prompt); assert.deepEqual(result.effectiveModels, ['claude-test']);
  } finally { process.env.PATH = oldPath; rmSync(fake.directory, { recursive: true, force: true }); }
});

test('timed-out CLI calls wait for SIGKILL and process exit before rejecting', { skip: process.platform !== 'linux' }, async () => {
  const fake = fakeCli();
  const oldPath = process.env.PATH;
  const oldPidPath = process.env.PATINA_TEST_CLI_PID;
  process.env.PATH = fake.env.PATH; process.env.PATINA_TEST_CLI_PID = fake.pidPath;
  try {
    await assert.rejects(studyCompletion({ id: 'fake', provider: 'anthropic', transport: 'claude-cli', model: 'claude-test' }, 'test', { timeoutMs: 300 }), /timed out/);
    const pid = Number(readFileSync(fake.pidPath, 'utf8'));
    assert.equal(processIdentity(pid), null);
  } finally {
    process.env.PATH = oldPath;
    if (oldPidPath === undefined) delete process.env.PATINA_TEST_CLI_PID; else process.env.PATINA_TEST_CLI_PID = oldPidPath;
    rmSync(fake.directory, { recursive: true, force: true });
  }
});

test('benchmark SIGTERM also terminates its detached CLI process group', { skip: process.platform !== 'linux' }, async () => {
  const fake = fakeCli();
  const transport = new URL('../../scripts/research/model-evaluation-transport.mjs', import.meta.url).href;
  const source = `import {installStudySignals,studyCompletion} from ${JSON.stringify(transport)}; installStudySignals(); studyCompletion({id:'fake',provider:'anthropic',transport:'claude-cli',model:'claude-test'},'test',{timeoutMs:60000}).catch(()=>{process.exitCode=1;});`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], { env: fake.env, stdio: 'ignore' });
  const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  try {
    for (let i = 0; i < 100 && !existsSync(fake.pidPath); i++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(existsSync(fake.pidPath), 'fake CLI started');
    const pid = Number(readFileSync(fake.pidPath, 'utf8'));
    child.kill('SIGTERM');
    assert.equal(await exited, 1);
    assert.equal(processIdentity(pid), null);
  } finally { child.kill('SIGKILL'); rmSync(fake.directory, { recursive: true, force: true }); }
});

test('a CLI leader exiting on TERM cannot leave an independent-stdio descendant running', { skip: process.platform !== 'linux' }, async () => {
  const fake = fakeCli();
  const oldPath = process.env.PATH; const oldPidPath = process.env.PATINA_TEST_CLI_PID;
  const executable = join(fake.directory, 'claude');
  writeFileSync(executable, '#!/bin/sh\n/bin/sh -c \'trap "" TERM; printf "%s" "$$" > "$PATINA_TEST_CLI_PID"; while :; do sleep 1; done\' </dev/null >/dev/null 2>&1 &\nwait\n');
  chmodSync(executable, 0o700);
  process.env.PATH = fake.env.PATH; process.env.PATINA_TEST_CLI_PID = fake.pidPath;
  try {
    await assert.rejects(studyCompletion({ id: 'fake', provider: 'anthropic', transport: 'claude-cli', model: 'claude-test' }, 'test', { timeoutMs: 300 }), /timed out/);
    assert.equal(processIdentity(Number(readFileSync(fake.pidPath, 'utf8'))), null);
  } finally {
    process.env.PATH = oldPath;
    if (oldPidPath === undefined) delete process.env.PATINA_TEST_CLI_PID; else process.env.PATINA_TEST_CLI_PID = oldPidPath;
    rmSync(fake.directory, { recursive: true, force: true });
  }
});

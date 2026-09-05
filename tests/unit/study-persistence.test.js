import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bindStudyProtocol, createCallJournal } from '../../scripts/research/study-journal.mjs';

const candidate = { id: 'test-model', provider: 'openai', transport: 'opencodex', model: 'gpt-test', baseURL: 'http://127.0.0.1:10100/v1' };

test('both entrypoints bind an output directory before a receipt can outlive its first row', async () => {
  const root = fs.mkdtempSync(join(tmpdir(), 'patina-study-binding-'));
  const fetchOriginal = globalThis.fetch, appendOriginal = fs.appendFileSync;
  try {
    const scorer = await import('../quality/live-scorer-benchmark.mjs');
    const rewrite = await import('../../scripts/research/model-rewrite-benchmark.mjs');
    for (const [name, main, target] of [['score', scorer.main, 'scorer-rows.jsonl'], ['rewrite', rewrite.main, 'rewrites.private.jsonl']]) {
      const output = join(root, name), protocolPath = join(root, `${name}.json`);
      const protocol = { candidates: [candidate], marker: 'original' };
      fs.writeFileSync(protocolPath, JSON.stringify(protocol));
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        const content = name === 'score' ? '{"categories":{},"overall":20,"interpretation":"test"}' : 'A clear test rewrite.';
        return new Response(JSON.stringify({ model: candidate.model, choices: [{ message: { content } }], usage: { prompt_tokens: 2, completion_tokens: 2 } }));
      };
      fs.appendFileSync = (path, ...args) => { if (String(path).endsWith(target)) throw new Error('simulated row write failure'); return appendOriginal(path, ...args); };
      syncBuiltinESMExports();
      const args = ['--live', '--candidates', protocolPath, '--output', output, ...(name === 'score' ? ['--limit', '1'] : [])];
      await assert.rejects(main(args), /row write failure/);
      assert.equal(calls, 1);
      assert.equal(fs.existsSync(join(output, 'study-protocol.json')), true);
      fs.appendFileSync = appendOriginal; syncBuiltinESMExports();
      fs.writeFileSync(protocolPath, JSON.stringify({ ...protocol, marker: 'changed' }));
      await assert.rejects(main(args), /different protocol/);
      assert.equal(calls, 1, 'changed protocol must not select a new paid journal namespace');
    }
    const unbound = join(root, 'legacy'); fs.mkdirSync(unbound); fs.mkdirSync(join(unbound, 'calls'));
    assert.throws(() => bindStudyProtocol(unbound, 'a'.repeat(64)), /no protocol binding/);
  } finally {
    fs.appendFileSync = appendOriginal; syncBuiltinESMExports(); globalThis.fetch = fetchOriginal;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an attempt receipt write failure aborts the real HTTP retry loop', async () => {
  const root = fs.mkdtempSync(join(tmpdir(), 'patina-study-attempt-'));
  const fetchOriginal = globalThis.fetch;
  let requests = 0, writeFailed = false;
  try {
    globalThis.fetch = async () => { requests++; return new Response('retryable failure', { status: 500 }); };
    const call = createCallJournal({ directory: root, logicalId: 'retry-case', candidate,
      persist: (path, receipt) => {
        if (!writeFailed && receipt.state === 'started' && receipt.transportAttempts.length) { writeFailed = true; throw new Error('simulated disk failure'); }
        fs.writeFileSync(path, JSON.stringify(receipt));
      } });
    await assert.rejects(call({ prompt: 'A private fixture', timeout: 3000 }), /journal-persistence-failed/);
    assert.equal(writeFailed, true);
    assert.equal(requests, 1, 'observer isolation must not allow a second transport attempt');
    const group = fs.readdirSync(join(root, 'calls'))[0];
    const receipt = JSON.parse(fs.readFileSync(join(root, 'calls', group, '1.private.json'), 'utf8'));
    assert.equal(receipt.error, 'study-journal-persistence-failed');
    assert.equal(receipt.transportAttempts.length, 1);
  } finally { globalThis.fetch = fetchOriginal; fs.rmSync(root, { recursive: true, force: true }); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, renderScorerReport } from '../quality/live-scorer-benchmark.mjs';

test('a final receipt write failure stops collection and cannot produce a complete report', async () => {
  const root = fs.mkdtempSync(join(tmpdir(), 'patina-final-receipt-'));
  const writeOriginal = fs.writeFileSync, fetchOriginal = globalThis.fetch;
  const candidate = { id: 'test-model', provider: 'openai', transport: 'opencodex', model: 'gpt-test', baseURL: 'http://127.0.0.1:10100/v1' };
  let requests = 0;
  try {
    const config = join(root, 'protocol.json'), output = join(root, 'output');
    fs.writeFileSync(config, JSON.stringify({ candidates: [candidate] }));
    globalThis.fetch = async () => {
      requests++;
      return new Response(JSON.stringify({ model: candidate.model, choices: [{ message: { content: '{"categories":{},"overall":20,"interpretation":"test"}' } }], usage: { prompt_tokens: 2, completion_tokens: 2 } }));
    };
    fs.writeFileSync = (path, data, ...args) => {
      let value; try { value = JSON.parse(String(data)); } catch { /* Other filesystem writes. */ }
      if (value?.state === 'completed' && String(path).includes('.private.json')) throw new Error('simulated final receipt failure');
      return writeOriginal(path, data, ...args);
    };
    syncBuiltinESMExports();
    await assert.rejects(main(['--live', '--candidates', config, '--output', output, '--limit', '2']), /Study cancelled/);
    assert.equal(requests, 1);
    const rows = fs.readFileSync(join(output, 'scorer-rows.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(rows.length, 1);
    assert.ok(rows[0].calls.some((call) => call.error === 'study-journal-persistence-failed'));
    const expectedKeys = rows.map((row) => `${row.candidate_id}/${row.fixture_id}/${row.repeat}`);
    assert.match(renderScorerReport(rows, { expectedKeys }), /Collection complete: no/);
  } finally {
    fs.writeFileSync = writeOriginal; syncBuiltinESMExports(); globalThis.fetch = fetchOriginal;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { textHash } from '../quality/live-scorer-benchmark.mjs';
import { generateRewrite, judgeRewrite } from '../../scripts/research/model-rewrite-benchmark.mjs';
import { loadParentCohort, evaluateExisting } from '../../scripts/research/evaluate-existing-rewrites.mjs';
import { joinEvaluations, selectRewriteFinalists } from '../../scripts/research/join-model-evaluations.mjs';

async function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'patina-evaluation-join-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const generator = { id: 'generator', provider: 'openai', model: 'gpt-test', transport: 'opencodex', baseURL: 'http://127.0.0.1:10100/v1' };
  const gemini = { id: 'gemini-3.7', provider: 'gemini', model: 'google-antigravity/gemini-test', transport: 'opencodex', baseURL: generator.baseURL };
  const claude = { id: 'anthropic-sonnet', provider: 'anthropic', model: 'claude-sonnet-5', transport: 'claude-cli' };
  const protocol = { candidates: [generator, { ...generator, id: 'openai-5.5' }, gemini, claude] };
  const source = { fixture_id: 'one', text: 'We shipped 12 fixes.', language: 'en', text_hash: textHash('We shipped 12 fixes.') };
  const parentHash = 'a'.repeat(64), protocolFile = join(root, 'protocol.json'), semantics = { test: 'isolated-fixture' };
  writeFileSync(protocolFile, JSON.stringify(protocol)); writeFileSync(join(root, 'study-protocol.json'), JSON.stringify({ schemaVersion: 1, protocolHash: parentHash }));
  const response = (candidate, text) => ({ text, effectiveModels: [candidate.model], durationMs: 1, attempts: 1 });
  const generation = { ...await generateRewrite(source, generator, 'Frozen generation prompt', { journalDirectory: root,
    logicalId: `${parentHash}/generator/one/0/rewrite`, complete: async (candidate) => response(candidate, source.text) }), repeat: 0, protocol_hash: parentHash };
  const { rewrite: _text, ...publicGeneration } = generation;
  writeFileSync(join(root, 'rewrite-rows.jsonl'), JSON.stringify(publicGeneration) + '\n');
  writeFileSync(join(root, 'rewrites.private.jsonl'), JSON.stringify(generation) + '\n');
  const parent = await loadParentCohort({ directory: root, protocolFile, fixtures: [source], provider: 'openai', candidateId: generator.id });
  const directories = [];
  for (const judge of [gemini, claude]) {
    const output = join(root, judge.id); directories.push(output);
    const protocolHash = textHash(JSON.stringify({ protocol, judge: judge.id, parentSnapshotHash: parent.snapshotHash, semantics }));
    await evaluateExisting({ parent: { ...parent, fixtures: [source] }, judge, output, protocolHash, live: true,
      evaluate: (f, g, j, options) => judgeRewrite(f, g, j, { ...options, complete: async (candidate, prompt) => response(candidate,
        prompt.includes('Meaning Preservation evaluator') ? '{"anchors":[{"type":"claim","content":"12 fixes","verdict":"PASS"}],"pass_count":1,"total_count":1,"polarity_pass_count":0,"polarity_total_count":0,"mps":100}'
          : prompt.includes('Fidelity evaluator') ? '{"claims_preserved":3,"no_fabrication":3,"audience_register_match":3}' : '{"naturalness":3}') }) });
  }
  return { root, parent, fixtures: [source], directories, protocol, evaluationSemantics: semantics };
}

test('two independently bound evaluation directories join without relabeling parent protocols', async (t) => {
  const args = await fixture(t); const result = await joinEvaluations(args);
  assert.equal(result.summary.generator.safe, 1); assert.equal(result.evidence.length, 2);
  assert.match(result.report, /complete: \*\*yes/);
  assert.equal(args.parent.generations[0].protocol_hash, 'a'.repeat(64));
  await assert.rejects(joinEvaluations({ ...args, directories: [args.directories[0]] }), /missing or unresolved/);
});

test('wrong snapshots and altered public/private scores cannot certify joined results', async (t) => {
  const args = await fixture(t);
  const provenancePath = join(args.directories[0], 'provenance.json'), original = readFileSync(provenancePath, 'utf8');
  const value = JSON.parse(original); value.parentSnapshotHash = 'f'.repeat(64); writeFileSync(provenancePath, JSON.stringify(value));
  await assert.rejects(joinEvaluations(args), /another parent/);
  writeFileSync(provenancePath, original);
  for (const suffix of ['jsonl', 'private.jsonl']) {
    const path = join(args.directories[0], `judge-gemini-3.7.${suffix}`), row = JSON.parse(readFileSync(path, 'utf8'));
    row.mps = 0; writeFileSync(path, JSON.stringify(row) + '\n');
  }
  await assert.rejects(joinEvaluations(args), /scores differ/);
});

test('finalists follow safety, naturalness and latency; pending work is rejected', () => {
  const row = (safe_rate, median, latency) => ({ provider: 'test', pending_judgments: 0, safe_rate, naturalness: { median }, generation_latency_ms: { median: latency } });
  assert.deepEqual(selectRewriteFinalists({ a: row(.9, 3, 10), b: row(.8, 4, 1), c: row(.9, 4, 20) }), { test: ['c', 'a'] });
  assert.throws(() => selectRewriteFinalists({ a: { ...row(1, 4, 1), pending_judgments: 1 } }), /pending/);
});

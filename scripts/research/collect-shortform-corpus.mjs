#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callLLM } from '../../src/api.js';
import { splitSentences } from '../../src/features/segment.js';
import { textHash } from '../../tests/quality/live-scorer-benchmark.mjs';
import { generateRewrite, rewriteFixtures } from './model-rewrite-benchmark.mjs';
import { acquireStudyWriter, bindStudyProtocol, readUniqueRows } from './study-journal.mjs';
import { assertStudyActive, installStudySignals, safeStudyError, validateTransport } from './model-evaluation-transport.mjs';
import { replayPreparationRow } from './preparation-replay.mjs';
import { studySemantics } from './study-validation.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const canonical = (value) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };

export function resolveShortPlan(plan, protocol, fixtures) {
  const { planHash, ...definition } = plan;
  requireThat(textHash(canonical(definition)) === planHash, 'Short-form plan hash differs');
  requireThat(plan.status === 'frozen-awaiting-parent-execution' && plan.repeats === 3 && plan.sources.length === 4
    && plan.requiredGenerationCalls === 12 && plan.additionalScoreOrJudgeCalls === 0
    && plan.maxTransportAttemptsPerCall === 1 && plan.temperature === .2, 'Unsupported short-form collection contract');
  const candidate = protocol.candidates.find((row) => row.id === plan.candidate.id);
  requireThat(candidate && textHash(JSON.stringify(candidate)) === plan.candidateDefinitionHash, 'Short-form candidate definition differs');
  requireThat(['id', 'model', 'provider', 'transport'].every((field) => candidate[field] === plan.candidate[field]), 'Short-form candidate label differs');
  validateTransport(candidate);
  requireThat(candidate.provider === 'gemini' && candidate.transport === 'opencodex', 'Only Gemini OpenCodex is admitted');
  const sources = plan.sources.map((source) => {
    const fixture = fixtures.find((row) => row.fixture_id === source.fixtureId);
    requireThat(fixture && fixture.language === source.language && fixture.register === source.register
      && fixture.text_hash === source.sourceTextHash && textHash(fixture.text) === source.sourceTextHash, 'Short-form source binding differs');
    const prompt = plan.promptTemplate.replace('{register}', fixture.register).replace('{language}', fixture.language)
      .replace('{sourceJson}', () => JSON.stringify(fixture.text));
    requireThat(textHash(prompt) === source.promptHash, 'Short-form prompt binding differs');
    return { fixture, prompt };
  });
  requireThat(new Set(sources.map(({ fixture }) => `${fixture.language}/${fixture.register}`)).size === 4
    && sources.every(({ fixture }) => ['en', 'ko'].includes(fixture.language) && ['social', 'marketing'].includes(fixture.register)), 'Short-form cell matrix differs');
  return { candidate, sources };
}

// maxRetries=0 alone still permits the API client's temperature fallback.
// Abort this individual request after its first failed transport attempt.
export async function oneAttemptCompletion(candidate, prompt, options = {}) {
  validateTransport(candidate);
  requireThat(candidate.provider === 'gemini' && candidate.transport === 'opencodex', 'Only Gemini OpenCodex is admitted');
  const controller = new AbortController(), started = Date.now();
  const stop = () => controller.abort();
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  let metadata = null, attempts = 0;
  try {
    const timeout = options.timeoutMs ?? 180000;
    const text = await callLLM({ prompt, model: candidate.model, baseURL: candidate.baseURL, apiKey: 'opencodex-local',
      temperature: options.temperature ?? .2, responseFormat: options.responseFormat,
      extraBody: { ...candidate.extraBody, ...options.extraBody }, maxRetries: 0,
      signal: controller.signal, timeout, deadline: Date.now() + timeout,
      onResponse: (value) => { metadata = value; },
      onAttempt: (attempt) => { attempts++; try { options.onAttempt?.(attempt); } finally { if (attempt.outcome === 'error') controller.abort(); } },
    });
    requireThat(attempts === 1, 'Single-attempt transport contract differed');
    return { text, attempts, durationMs: Date.now() - started, effectiveModels: metadata?.model ? [metadata.model] : [],
      usage: metadata?.usage ?? null, requestedTemperature: options.temperature ?? .2,
      effectiveTemperature: metadata?.temperature ?? null, rawResponse: metadata?.rawResponse ?? null };
  } finally { process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop); }
}

export async function main(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--live') args.live = true;
    else if (['--plan', '--source-root', '--output'].includes(argv[i]) && argv[i + 1]) args[argv[i].slice(2)] = argv[++i];
    else throw new Error('Use --plan, --source-root, --output and optional --live');
  }
  for (const key of ['plan', 'source-root', 'output']) requireThat(args[key], `Missing --${key}`);
  const planBytes = readFileSync(args.plan, 'utf8'), supplied = JSON.parse(planBytes), plan = supplied.optionalGenerationPlan || supplied;
  const sourceRoot = resolve(args['source-root']);
  requireThat(execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === plan.sourceCommit, 'Frozen source checkout differs');
  const protocol = JSON.parse(readFileSync(resolve(sourceRoot, 'docs/research/model-evaluation-20260904.json'), 'utf8'));
  const { candidate, sources } = resolveShortPlan(plan, protocol, rewriteFixtures('full', sourceRoot));
  const definition = { plan, planFileHash: textHash(planBytes), candidate, sourceCommit: plan.sourceCommit,
    runnerCommit: execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDefinition: sources.map(({ fixture, prompt }) => ({ fixture, prompt })),
    order: 'repeat-then-plan-source', scriptHash: textHash(readFileSync(fileURLToPath(import.meta.url))),
    replayHelperHash: textHash(readFileSync(new URL('./preparation-replay.mjs', import.meta.url))), runnerSemantics: studySemantics(ROOT) };
  const protocolHash = textHash(JSON.stringify(definition));
  if (!args.live) { console.log(JSON.stringify({ dryRun: true, plannedCalls: 12, planHash: plan.planHash, protocolHash })); return; }
  requireThat(textHash(execFileSync('git', ['-C', ROOT, 'show', 'HEAD:scripts/research/collect-shortform-corpus.mjs'])) === definition.scriptHash, 'Commit the collection runner before live execution');
  execFileSync('git', ['-C', ROOT, 'diff', '--quiet', 'HEAD']);
  delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY;
  installStudySignals();
  const output = resolve(args.output), release = acquireStudyWriter(output, 'shortform-collection');
  try {
    bindStudyProtocol(output, protocolHash);
    writeFileSync(resolve(output, '.gitignore'), '*\n', { mode: 0o600 });
    writeFileSync(resolve(output, 'definition.private.json'), JSON.stringify(definition, null, 2), { mode: 0o600 });
    const path = resolve(output, 'generations.private.jsonl'), key = (row) => `${row.fixture_id}/${row.repeat}`;
    const rows = readUniqueRows(path, key);
    const expected = sources.flatMap(({ fixture }) => [0, 1, 2].map((repeat) => `${fixture.fixture_id}/${repeat}`));
    requireThat(rows.every((row) => row.protocol_hash === protocolHash && row.plan_hash === plan.planHash
      && Number.isInteger(row.repeat) && expected.includes(key(row))), 'Saved rows differ from the frozen matrix');
    for (let repeat = 0; repeat < plan.repeats; repeat++) for (const { fixture, prompt } of sources) {
      assertStudyActive();
      const logicalId = `${protocolHash}/${candidate.id}/${fixture.fixture_id}/${repeat}/rewrite`;
      let row = rows.find((value) => key(value) === `${fixture.fixture_id}/${repeat}`);
      if (row) {
        const replay = await replayPreparationRow({ directory: output, logicalId, row, candidate,
          run: (complete) => generateRewrite(fixture, candidate, prompt, { complete, logicalId }) });
        for (const field of Object.keys(replay).filter((name) => !['duration_ms', 'calls'].includes(name))) requireThat(canonical(replay[field]) === canonical(row[field]), 'Saved generation differs from its receipts');
      } else {
        row = { ...await generateRewrite(fixture, candidate, prompt, { complete: oneAttemptCompletion, journalDirectory: output, logicalId }),
          repeat, plan_hash: plan.planHash, protocol_hash: protocolHash, recorded_at: new Date().toISOString() };
        appendFileSync(path, JSON.stringify(row) + '\n', { mode: 0o600 }); rows.push(row);
      }
      requireThat(!row.calls.some((call) => ['study-call-inflight', 'study-call-unobserved', 'study-journal-persistence-failed'].includes(call.error)), 'Unresolved generation evidence needs reconciliation');
      console.log(JSON.stringify({ fixture: fixture.fixture_id, repeat, status: row.status }));
    }
    const observations = rows.map((row) => ({ fixtureId: row.fixture_id, repeat: row.repeat, status: row.status,
      rewriteHash: row.rewrite_hash, nonWhitespaceCharacters: row.rewrite ? [...row.rewrite.replace(/\s/gu, '')].length : null,
      sentences: row.rewrite ? splitSentences(row.rewrite).length : null, numericProxyPass: row.number_safety?.ok ?? null,
      humanQualityLabel: null, humanMeaningReview: null, outputRights: 'needs-review' }));
    const summary = { status: 'collected-awaiting-human-labels', planHash: plan.planHash, protocolHash,
      expected: 12, observations, successful: rows.filter((row) => row.status === 'ok').length, humanRatings: 0, scoreCalls: 0 };
    writeFileSync(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ status: summary.status, outcomes: rows.length, successful: summary.successful, humanRatings: 0 }));
  } finally { release(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(safeStudyError(error)); process.exitCode = 1; });

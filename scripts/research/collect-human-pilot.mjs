#!/usr/bin/env node
// Preparation only: no human responses are created or inferred here.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildPatinaRewritePrompt } from '../../tests/quality/live-quality.mjs';
import { evaluateScorerFixture, loadScorerFixtures, textHash } from '../../tests/quality/live-scorer-benchmark.mjs';
import { generateRewrite, rewriteFixtures } from './model-rewrite-benchmark.mjs';
import { loadParentCohort } from './evaluate-existing-rewrites.mjs';
import { acquireStudyWriter, bindStudyProtocol, readUniqueRows } from './study-journal.mjs';
import { createStudyInputs } from './study-inputs.mjs';
import { studySemantics } from './study-validation.mjs';
import { assertStudyActive, installStudySignals } from './model-evaluation-transport.mjs';
import { replayPreparationRow } from './preparation-replay.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const append = (path, row) => appendFileSync(path, JSON.stringify(row) + '\n', { mode: 0o600 });

export async function main(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--live') args.live = true;
    else if (['--plan', '--source-root', '--parent', '--output'].includes(argv[i]) && argv[i + 1]) args[argv[i].slice(2)] = argv[++i];
    else throw new Error('Use --plan, --source-root, --parent, --output and optional --live');
  }
  for (const key of ['plan', 'source-root', 'parent', 'output']) if (!args[key]) throw new Error(`Missing --${key}`);
  const plan = JSON.parse(readFileSync(args.plan, 'utf8')), sourceRoot = resolve(args['source-root']);
  const sourceCommit = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (sourceCommit !== plan.sourceCommit) throw new Error('Pilot source checkout differs from its frozen plan');
  const protocol = JSON.parse(readFileSync(resolve(sourceRoot, 'docs/research/model-evaluation-20260904.json'), 'utf8'));
  const generator = protocol.candidates.find((candidate) => candidate.id === plan.generationCandidate);
  const scorer = protocol.candidates.find((candidate) => candidate.id === plan.scoreCandidate);
  if (!generator || !scorer) throw new Error('Pilot model definitions are missing');
  const full = rewriteFixtures('full', sourceRoot), controls = loadScorerFixtures(sourceRoot);
  const planned = [...plan.existing, ...plan.additional];
  if (planned.length !== 30 || ['en', 'ko'].some((language) => planned.filter((row) => row.language === language).length !== 15)
    || new Set(planned.map((row) => row.textHash)).size !== 30) throw new Error('Pilot plan must contain 30 unique sources, 15 per language');
  const fixtures = planned.map((row) => {
    const fixture = [...full, ...controls].find((fixture) => fixture.fixture_id === row.id && fixture.text_hash === row.textHash && fixture.language === row.language);
    if (!fixture) throw new Error('Pilot source hash does not resolve');
    return { ...fixture, documentType: fixture.documentType || 'default' };
  });
  const parent = await loadParentCohort({ directory: resolve(args.parent), protocolFile: resolve(sourceRoot, 'docs/research/model-evaluation-20260904.json'),
    fixtures: full, provider: 'openai', candidateId: generator.id, repeat: 3 });
  const inputs = createStudyInputs(sourceRoot, { sourceVoice: true }), prompts = new Map();
  for (const fixture of fixtures) prompts.set(fixture.fixture_id, await buildPatinaRewritePrompt(fixture, { repoRoot: sourceRoot, promptMode: 'minimal',
    config: inputs.config(), patterns: inputs.patterns(fixture.language) }));
  const definition = { plan, sourceCommit, generator, scorer, parentSnapshotHash: parent.snapshotHash,
    preparationScriptHash: textHash(readFileSync(fileURLToPath(import.meta.url))), runnerSemantics: studySemantics(ROOT),
    preparationReplayHash: textHash(readFileSync(new URL('./preparation-replay.mjs', import.meta.url))),
    generationInputs: inputs.fingerprint, prompts: Object.fromEntries([...prompts].map(([id, prompt]) => [id, textHash(prompt)])) };
  const protocolHash = textHash(JSON.stringify(definition));
  if (!args.live) { console.log(JSON.stringify({ dryRun: true, protocolHash, reused: plan.existing.length, newGenerations: plan.additional.length, maximumNewScoreObservations: 60 })); return; }
  installStudySignals();
  const output = resolve(args.output), release = acquireStudyWriter(output, 'human-pilot-preparation');
  try {
    bindStudyProtocol(output, protocolHash);
    writeFileSync(resolve(output, '.gitignore'), '*\n', { mode: 0o600 });
    writeFileSync(resolve(output, 'definition.private.json'), JSON.stringify(definition, null, 2), { mode: 0o600 });
    const generationFile = resolve(output, 'generations.private.jsonl'), scoreFile = resolve(output, 'scores.private.jsonl');
    const generated = readUniqueRows(generationFile, (row) => row.fixture_id), scores = readUniqueRows(scoreFile, (row) => row.observationKey);
    const pairs = [];
    for (const fixture of fixtures) {
      assertStudyActive();
      const plannedOriginal = plan.existing.some((row) => row.id === fixture.fixture_id);
      let generation = plannedOriginal ? parent.privateRows.find((row) => row.fixture_id === fixture.fixture_id && row.repeat === 0) : generated.find((row) => row.fixture_id === fixture.fixture_id);
      const generationLogicalId = `${protocolHash}/generation/${fixture.fixture_id}`;
      if (generation && !plannedOriginal) {
        if (generation.protocol_hash !== protocolHash) throw new Error('Saved generation protocol differs');
        const replay = await replayPreparationRow({ directory: output, logicalId: generationLogicalId, row: generation, candidate: generator,
          run: (complete) => generateRewrite(fixture, generator, prompts.get(fixture.fixture_id), { complete, logicalId: generationLogicalId }) });
        if (replay.status !== generation.status || replay.rewrite_hash !== generation.rewrite_hash) throw new Error('Saved generation differs from its call receipts');
      }
      if (!generation) {
        generation = { ...await generateRewrite(fixture, generator, prompts.get(fixture.fixture_id), { journalDirectory: output,
          logicalId: generationLogicalId }), protocol_hash: protocolHash };
        append(generationFile, generation); generated.push(generation);
      }
      if (generation.status !== 'ok' || generation.text_hash !== fixture.text_hash || textHash(generation.rewrite) !== generation.rewrite_hash
        || generation.prompt_hash !== textHash(prompts.get(fixture.fixture_id))) throw new Error('Pilot generation is missing or unbound; retain its failure evidence');
      const observations = [];
      for (const [role, text] of [['original', fixture.text], ['rewrite', generation.rewrite]]) {
        assertStudyActive();
        const observationKey = textHash(JSON.stringify({ textHash: textHash(text), language: fixture.language, documentType: fixture.documentType, register: fixture.register }));
        const input = { ...fixture, fixture_id: observationKey, text, text_hash: textHash(text), expected_hot: null, class: 'unlabelled-human-panel', source: 'private panel preparation' };
        const logicalId = `${protocolHash}/score/${observationKey}`;
        let row = scores.find((row) => row.observationKey === observationKey);
        if (row) {
          const replay = await replayPreparationRow({ directory: output, logicalId, row, candidate: scorer,
            run: (complete) => evaluateScorerFixture(input, scorer, { repoRoot: sourceRoot, complete, logicalId }) });
          for (const field of ['status', 'error', 'overall', 'raw_overall', 'llm_overall', 'deterministic_overall', 'categories', 'requested_model', 'text_hash']) if (JSON.stringify(replay[field]) !== JSON.stringify(row[field])) throw new Error('Saved panel score differs from its call receipts');
        }
        if (!row) {
          row = { ...await evaluateScorerFixture(input, scorer, { repoRoot: sourceRoot, journalDirectory: output,
            logicalId }), observationKey, preparationProtocolHash: protocolHash };
          append(scoreFile, row); scores.push(row);
        }
        if (row.preparationProtocolHash !== protocolHash || row.status !== 'ok' || row.text_hash !== textHash(text)) throw new Error('Pilot score observation is missing or invalid; do not replace failures silently');
        observations.push(row);
        console.log(JSON.stringify({ stage: 'score', fixture: fixture.fixture_id, role, status: row.status }));
      }
      pairs.push({ pairId: `panel-${fixture.fixture_id}`, language: fixture.language, register: fixture.register || 'general',
        context: `Review a ${fixture.documentType === 'default' ? 'general explanatory passage' : fixture.documentType + ' draft'} for its intended reader.`,
        original: fixture.text, rewrite: generation.rewrite, originalHash: fixture.text_hash, rewriteHash: generation.rewrite_hash,
        sourceKind: 'curated-fixture', sourceRef: `git:${sourceCommit}:${fixture.source || fixture.fixture_id}`,
        sourceLicense: 'MIT repository fixture; generated output retained for private study', sharing: 'panel-only', sharingReviewed: false,
        scoreBefore: observations[0].overall, scoreAfter: observations[1].overall,
        signalBefore: observations[0].deterministic_overall, signalAfter: observations[1].deterministic_overall,
        preparationProtocolHash: protocolHash, parentGenerationProtocolHash: generation.protocol_hash,
        scoreEvidence: observations.map((row) => ({ observationKey: row.observationKey, rowHash: textHash(JSON.stringify(row)) })) });
      writeFileSync(resolve(output, 'pairs.private.json'), JSON.stringify(pairs, null, 2), { mode: 0o600 });
    }
    writeFileSync(resolve(output, 'status.json'), JSON.stringify({ status: 'awaiting-source-sharing-review', pairs: pairs.length, humanRatings: 0, protocolHash }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ status: 'awaiting-source-sharing-review', output, pairs: pairs.length, humanRatings: 0 }));
  } finally { release(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

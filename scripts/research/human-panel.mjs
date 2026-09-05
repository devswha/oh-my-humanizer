#!/usr/bin/env node
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { krippendorffAlpha, mean, pairBootstrap, spearman } from './human-panel-stats.mjs';
import { renderPanelPacket } from './human-panel-view.mjs';

export const MIN_PAIRS = 30, MIN_RATERS = 5;
const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const opaque = () => randomBytes(16).toString('hex');
const text = (value, max = 20000) => typeof value === 'string' && value.trim() && value.length <= max;
const score = (value) => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const shuffle = (values) => { const copy = [...values]; for (let i = copy.length - 1; i > 0; i--) { const j = randomInt(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };

export function validatePanelPairs(rows) {
  if (!Array.isArray(rows) || rows.length < MIN_PAIRS || rows.length > 100) throw new Error('Panel requires 30–100 paired passages');
  const ids = new Set(), originals = new Set();
  return rows.map((row) => {
    if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(row.pairId || '') || ids.has(row.pairId)) throw new Error('Invalid or duplicate panel pair ID');
    ids.add(row.pairId);
    if (!['en', 'ko', 'zh', 'ja'].includes(row.language) || !text(row.register, 60) || !text(row.context, 300)) throw new Error('Panel language/register/context required');
    if (!text(row.original) || !text(row.rewrite)) throw new Error('Panel requires non-empty paired texts');
    const originalHash = hash(row.original), rewriteHash = hash(row.rewrite);
    if (row.originalHash !== originalHash || row.rewriteHash !== rewriteHash || originals.has(originalHash)) throw new Error('Panel text hashes differ or original sources repeat');
    originals.add(originalHash);
    if (!['panel-only', 'public'].includes(row.sharing) || !text(row.sourceRef, 500) || !text(row.sourceLicense, 100)
      || !['curated-fixture', 'model-generated', 'human-authored', 'unknown'].includes(row.sourceKind)) throw new Error('Reviewed panel sharing/provenance required');
    if (row.sharingReviewed !== true) throw new Error('Panel source sharing must be reviewed before preparation');
    for (const name of ['signalBefore', 'signalAfter', 'scoreBefore', 'scoreAfter']) if (!score(row[name] ?? null)) throw new Error('Panel scores must be bounded numbers or null');
    return { ...row, signalBefore: row.signalBefore ?? null, signalAfter: row.signalAfter ?? null,
      scoreBefore: row.scoreBefore ?? null, scoreAfter: row.scoreAfter ?? null };
  });
}

export function preparePanel(rows, { raterCount = MIN_RATERS, scoreDefinition } = {}) {
  const pairs = validatePanelPairs(rows);
  if (!Number.isInteger(raterCount) || raterCount < MIN_RATERS || raterCount > 30) throw new Error('Prepare 5–30 participant packets');
  if (!text(scoreDefinition, 500)) throw new Error('Freeze the score definition before collecting human responses');
  const studyId = opaque(), packets = [], assignments = [];
  for (let n = 0; n < raterCount; n++) {
    const packetId = opaque(), token = opaque(), orientation = shuffle(pairs.map((_, i) => i < Math.ceil(pairs.length / 2)));
    const items = shuffle(pairs.map((pair, i) => {
      const itemId = opaque(), originalIsA = orientation[i];
      assignments.push({ packetId, itemId, pairId: pair.pairId, originalIsA });
      return { id: itemId, language: pair.language, context: pair.context,
        a: originalIsA ? pair.original : pair.rewrite, b: originalIsA ? pair.rewrite : pair.original };
    }));
    const payload = { schemaVersion: 1, studyId, packetId, token, items };
    packets.push({ ...payload, payloadHash: hash(payload) });
  }
  const control = { schemaVersion: 1, studyId, scoreDefinition, inputHash: hash(pairs), minimumPairs: MIN_PAIRS,
    minimumRatersPerPair: MIN_RATERS, pairs, assignments,
    packets: packets.map(({ items, ...packet }) => ({ ...packet, itemOrder: items.map((item) => item.id) })) };
  control.controlHash = hash(control);
  const roster = { schemaVersion: 1, studyId, participants: packets.map((packet) => ({ packetId: packet.packetId,
    personId: null, verifiedHuman: false, consentVerified: false, languages: [], evidenceHash: null })) };
  return { control, packets, roster };
}

export function writePanel(panel, output) {
  const target = resolve(output);
  if (existsSync(target)) throw new Error('Panel output already exists; never overwrite participant work');
  mkdirSync(dirname(target), { recursive: true });
  const stage = mkdtempSync(resolve(dirname(target), '.writing-panel-'));
  try {
    writeFileSync(resolve(stage, '.gitignore'), '*\n', { mode: 0o600 });
    for (const packet of panel.packets) writeFileSync(resolve(stage, `review-${packet.packetId}.html`), renderPanelPacket(packet), { mode: 0o600 });
    writeFileSync(resolve(stage, 'control.private.json'), JSON.stringify(panel.control, null, 2), { mode: 0o600 });
    writeFileSync(resolve(stage, 'roster.private.json'), JSON.stringify(panel.roster, null, 2), { mode: 0o600 });
    writeFileSync(resolve(stage, 'README.txt'), 'Assign each review file to a different consenting human. Do not share control.private.json or roster.private.json with participants. Record independent human/consent verification in the private roster before analysis. No responses or human identities have been supplied by preparation.\n', { mode: 0o600 });
    if (existsSync(target)) throw new Error('Panel destination appeared during preparation');
    renameSync(stage, target);
  } catch (error) { rmSync(stage, { recursive: true, force: true }); throw error; }
  return { output: target, studyId: panel.control.studyId, pairs: panel.control.pairs.length, packets: panel.packets.length, verifiedHumans: 0 };
}

function validateAnswer(answer) {
  if (answer.abstain === true) return;
  for (const name of ['ratingA', 'ratingB']) if (!Number.isInteger(answer[name]) || answer[name] < 0 || answer[name] > 4) throw new Error('Human naturalness ratings must be integers 0–4');
  if (!['a', 'b', 'tie'].includes(answer.preference) || !['a', 'b', 'both', 'neither', 'uncertain'].includes(answer.meaningConcern)
    || !['a', 'b', 'tie', 'neither'].includes(answer.sendChoice)) throw new Error('Invalid human comparison answer');
  if (answer.note !== undefined && (!text(answer.note, 2000) && answer.note !== '')) throw new Error('Invalid private note');
}

export function analyzePanel(control, submissions, roster, { bootstrapIterations = 2000 } = {}) {
  const { controlHash, ...unsignedControl } = control;
  if (controlHash !== hash(unsignedControl)) throw new Error('Panel control changed after preparation');
  if (control.schemaVersion !== 1 || control.minimumPairs !== MIN_PAIRS || control.minimumRatersPerPair !== MIN_RATERS) throw new Error('Invalid panel control contract');
  const pairs = validatePanelPairs(control.pairs);
  if (hash(pairs) !== control.inputHash || roster.studyId !== control.studyId || !Array.isArray(roster.participants)) throw new Error('Panel inputs or roster binding changed');
  for (const packet of control.packets) {
    const items = packet.itemOrder.map((id) => {
      const assignment = control.assignments.find((entry) => entry.packetId === packet.packetId && entry.itemId === id);
      const pair = pairs.find((entry) => entry.pairId === assignment?.pairId);
      if (!pair) throw new Error('Panel assignment missing');
      return { id, language: pair.language, context: pair.context, a: assignment.originalIsA ? pair.original : pair.rewrite, b: assignment.originalIsA ? pair.rewrite : pair.original };
    });
    if (hash({ schemaVersion: 1, studyId: control.studyId, packetId: packet.packetId, token: packet.token, items }) !== packet.payloadHash) throw new Error('Panel blinding map differs from participant payload');
  }
  const people = new Set(), verified = new Map();
  for (const person of roster.participants) {
    if (!control.packets.some((packet) => packet.packetId === person.packetId)) throw new Error('Unknown roster packet');
    if (person.verifiedHuman !== true || person.consentVerified !== true) continue;
    if (!text(person.personId, 100) || people.has(person.personId) || verified.has(person.packetId)
      || !/^[a-f0-9]{64}$/.test(person.evidenceHash || '') || !Array.isArray(person.languages)
      || person.languages.some((lang) => !['en', 'ko', 'zh', 'ja'].includes(lang))) throw new Error('Human roster needs unique people and consent/provenance evidence');
    people.add(person.personId); verified.set(person.packetId, person);
  }
  const byPair = new Map(pairs.map((pair) => [pair.pairId, []])), seenPackets = new Set();
  let unverifiedPackets = 0, abstentions = 0;
  for (const submission of submissions) {
    const packet = control.packets.find((packet) => packet.packetId === submission.packetId);
    if (!packet || seenPackets.has(packet.packetId) || submission.studyId !== control.studyId || submission.token !== packet.token || submission.payloadHash !== packet.payloadHash
      || submission.schemaVersion !== 1 || submission.final !== true || !Number.isFinite(Date.parse(submission.submittedAt))
      || !Array.isArray(submission.answers)) throw new Error('Unbound, draft or duplicate participant response');
    seenPackets.add(packet.packetId);
    const assignments = control.assignments.filter((item) => item.packetId === packet.packetId);
    if (submission.answers.length !== assignments.length) throw new Error('Participant response must cover every assigned item (or abstain)');
    const seenItems = new Set();
    for (const answer of submission.answers) {
      const assignment = assignments.find((assignment) => assignment.itemId === answer.id);
      if (!assignment || seenItems.has(answer.id)) throw new Error('Duplicate or unknown response item');
      seenItems.add(answer.id); validateAnswer(answer);
    }
    if (!verified.has(packet.packetId)) { unverifiedPackets++; continue; }
    if (submission.humanDeclared !== true || submission.consent !== true || submission.usedAi !== false || !Array.isArray(submission.languages)) throw new Error('Human response consent and no-automation declaration required');
    const person = verified.get(packet.packetId);
    for (const answer of submission.answers) {
      if (answer.abstain === true) { abstentions++; continue; }
      const assignment = assignments.find((assignment) => assignment.itemId === answer.id);
      const pair = pairs.find((pair) => pair.pairId === assignment.pairId);
      if (!person.languages.includes(pair.language) || !submission.languages.includes(pair.language)) throw new Error('Unqualified language rating; use abstention instead');
      const rewriteSide = assignment.originalIsA ? 'b' : 'a';
      byPair.get(pair.pairId).push({ originalRating: assignment.originalIsA ? answer.ratingA : answer.ratingB,
        rewriteRating: assignment.originalIsA ? answer.ratingB : answer.ratingA,
        preference: answer.preference === 'tie' ? 'tie' : answer.preference === rewriteSide ? 'rewrite' : 'original',
        meaningClear: answer.meaningConcern === 'neither', meaningUncertain: answer.meaningConcern === 'uncertain',
        rewriteConcern: answer.meaningConcern === rewriteSide || answer.meaningConcern === 'both',
        sendChoice: ['tie', 'neither'].includes(answer.sendChoice) ? answer.sendChoice : answer.sendChoice === rewriteSide ? 'rewrite' : 'original' });
    }
  }
  const groups = pairs.map((pair) => ({ pair, ratings: byPair.get(pair.pairId) }));
  const coverage = groups.map(({ pair, ratings }) => ({ sampleHash: hash(pair.originalHash + pair.rewriteHash), language: pair.language, register: pair.register, raters: ratings.length }));
  const base = { schemaVersion: 1, studyId: control.studyId, preparedPairs: pairs.length, submittedPackets: seenPackets.size,
    verifiedRosterPeople: people.size, unverifiedPackets, abstentions, coverage, scoreDefinition: control.scoreDefinition };
  if (groups.some((group) => group.ratings.length < MIN_RATERS)) return { ...base, status: 'awaiting-qualified-human-ratings', metrics: null };
  const preference = (sample) => mean(sample.map((group) => mean(group.ratings.map((row) => row.preference === 'rewrite' ? 1 : row.preference === 'tie' ? .5 : 0))));
  const correlation = (sample, before, after) => spearman(sample.flatMap((group) => [group.pair[before], group.pair[after]]),
    sample.flatMap((group) => [mean(group.ratings.map((row) => row.originalRating)), mean(group.ratings.map((row) => row.rewriteRating))]));
  const scored = groups.every((group) => Number.isFinite(group.pair.scoreBefore) && Number.isFinite(group.pair.scoreAfter));
  const signalScored = groups.every((group) => Number.isFinite(group.pair.signalBefore) && Number.isFinite(group.pair.signalAfter));
  const all = groups.flatMap((group) => group.ratings);
  const safe = groups.filter((group) => group.ratings.every((row) => row.meaningClear));
  const metrics = {
    preferenceCounts: Object.fromEntries(['original', 'rewrite', 'tie'].map((value) => [value, all.filter((row) => row.preference === value).length])),
    rewritePreference: preference(groups), preferenceCI: pairBootstrap(groups, preference, { iterations: bootstrapIterations }),
    meaningConcernRate: all.filter((row) => !row.meaningClear).length / all.length,
    rewriteMeaningConcernRate: all.filter((row) => row.rewriteConcern).length / all.length,
    uncertainMeaningRate: all.filter((row) => row.meaningUncertain).length / all.length,
    naturalnessAlphaInterval: krippendorffAlpha(groups.flatMap((group) => [group.ratings.map((row) => row.originalRating), group.ratings.map((row) => row.rewriteRating)])),
    preferenceAlphaNominal: krippendorffAlpha(groups.map((group) => group.ratings.map((row) => row.preference)), 'nominal'),
    scoreNaturalnessSpearman: scored ? correlation(groups, 'scoreBefore', 'scoreAfter') : null,
    scoreCorrelationCI: scored ? pairBootstrap(groups, (sample) => correlation(sample, 'scoreBefore', 'scoreAfter'), { iterations: bootstrapIterations }) : null,
    signalNaturalnessSpearman: signalScored ? correlation(groups, 'signalBefore', 'signalAfter') : null,
    safePairs: safe.length, safeScoreReduction: scored ? mean(safe.map((group) => group.pair.scoreBefore - group.pair.scoreAfter)) : null,
    bySlice: Object.fromEntries([...new Set(pairs.map((pair) => `${pair.language}/${pair.register}`))].map((slice) => {
      const values = groups.filter((group) => `${group.pair.language}/${group.pair.register}` === slice);
      return [slice, { pairs: values.length, rewritePreference: preference(values) }];
    })),
  };
  return { ...base, status: scored && signalScored ? 'complete' : 'awaiting-score-observations',
    missingScoreKinds: [...(!scored ? ['primary'] : []), ...(!signalScored ? ['deterministic-signal'] : [])], metrics };
}

async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv; const args = {};
  for (let i = 0; i < rest.length; i += 2) { if (!rest[i]?.startsWith('--') || !rest[i + 1]) throw new Error('Use named option/value pairs'); args[rest[i].slice(2)] = rest[i + 1]; }
  if (command === 'prepare') {
    const pairs = JSON.parse(readFileSync(args.input, 'utf8'));
    const panel = preparePanel(pairs, { raterCount: Number(args.raters || MIN_RATERS), scoreDefinition: args['score-definition'] });
    console.log(JSON.stringify(writePanel(panel, args.output)));
  } else if (command === 'analyze') {
    const control = JSON.parse(readFileSync(args.control, 'utf8')), roster = JSON.parse(readFileSync(args.roster, 'utf8'));
    const submissions = JSON.parse(readFileSync(args.responses, 'utf8'));
    const report = analyzePanel(control, submissions, roster);
    if (args.output) writeFileSync(args.output, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(report));
  } else throw new Error('Use human-panel prepare or analyze');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

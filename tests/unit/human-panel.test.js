import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzePanel, preparePanel, writePanel } from '../../scripts/research/human-panel.mjs';
import { renderPanelPacket } from '../../scripts/research/human-panel-view.mjs';
import { krippendorffAlpha, pairBootstrap, spearman } from '../../scripts/research/human-panel-stats.mjs';

const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
function pairs() {
  return Array.from({ length: 30 }, (_, i) => {
    const original = `Fixture passage ${i}: the team will ship 12 fixes.`, rewrite = `The team will ship 12 fixes for fixture passage ${i}.`;
    return { pairId: `test-${i}`, original, rewrite, originalHash: hash(original), rewriteHash: hash(rewrite), language: i < 15 ? 'en' : 'ko',
      register: 'email', context: 'Synthetic test fixture; never collect real ratings for this test.', sourceKind: 'curated-fixture', sharing: 'panel-only',
      sharingReviewed: true, sourceRef: `test-only:${i}`, sourceLicense: 'MIT', modelName: 'hidden-model-name',
      signalBefore: 80, signalAfter: 20, scoreBefore: 80, scoreAfter: 20 };
  });
}
function filled(panel) {
  const roster = globalThis.structuredClone(panel.roster);
  roster.participants.forEach((row, i) => Object.assign(row, { personId: `synthetic-test-person-${i}`, verifiedHuman: true, consentVerified: true, languages: ['en', 'ko'], evidenceHash: hash(`synthetic-test-evidence-${i}`) }));
  const responses = panel.packets.map((packet) => ({ schemaVersion: 1, studyId: packet.studyId, packetId: packet.packetId, token: packet.token,
    payloadHash: packet.payloadHash, final: true, submittedAt: '2026-09-05T00:00:00Z', humanDeclared: true, consent: true, usedAi: false, languages: ['en', 'ko'],
    answers: packet.items.map((item) => {
      const assignment = panel.control.assignments.find((row) => row.itemId === item.id);
      return { id: item.id, abstain: false, ratingA: assignment.originalIsA ? 1 : 4, ratingB: assignment.originalIsA ? 4 : 1,
        preference: assignment.originalIsA ? 'b' : 'a', meaningConcern: 'neither', sendChoice: assignment.originalIsA ? 'b' : 'a', note: 'Private test note' };
    }) }));
  return { roster, responses };
}

test('packets hide source/model/score metadata and balance original-side assignments', () => {
  const panel = preparePanel(pairs(), { scoreDefinition: 'Test-only fixed score observations' });
  assert.equal(panel.packets.length, 5); assert.equal(panel.roster.participants.filter((row) => row.verifiedHuman).length, 0);
  for (const packet of panel.packets) {
    assert.equal(packet.items.length, 30);
    assert.equal(panel.control.assignments.filter((row) => row.packetId === packet.packetId && row.originalIsA).length, 15);
    assert.doesNotMatch(JSON.stringify(packet), /originalIsA|scoreBefore|hidden-model-name|sourceRef/);
    assert.equal(new Set(packet.items.map((item) => item.id)).size, 30);
  }
  assert.throws(() => preparePanel(pairs().slice(1), { scoreDefinition: 'Test' }), /30/);
  const duplicate = pairs(); duplicate[1].original = duplicate[0].original; duplicate[1].originalHash = duplicate[0].originalHash;
  assert.throws(() => preparePanel(duplicate, { scoreDefinition: 'Test' }), /repeat/);
});

test('HTML escapes source markup, binds the script, and writes private files without overwrite', () => {
  const data = pairs(); data[0].original = '</script><img src=x onerror=alert(1)>'; data[0].originalHash = hash(data[0].original);
  const panel = preparePanel(data, { scoreDefinition: 'Test' });
  const html = renderPanelPacket(panel.packets[0]);
  assert.ok(html.includes('\\u003c/script>')); assert.ok(!html.includes('</script><img'));
  assert.match(html, /connect-src 'none'/); assert.match(html, /script-src 'sha256-/);
  assert.doesNotMatch(html, /localStorage|XMLHttpRequest|fetch\(/);
  const root = mkdtempSync(join(tmpdir(), 'panel-output-test-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    const output = join(root, 'panel'); const result = writePanel(panel, output);
    assert.equal(result.verifiedHumans, 0);
    assert.equal(JSON.parse(readFileSync(join(output, 'control.private.json'), 'utf8')).controlHash, panel.control.controlHash);
    assert.throws(() => writePanel(panel, output), /already exists/);
    assert.match(execFileSync('git', ['check-ignore', '--no-index', 'panel/control.private.json', `panel/review-${panel.packets[0].packetId}.html`], { cwd: root, encoding: 'utf8' }), /control.private.json/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unverified packets never produce human metrics; qualified complete fixtures do', () => {
  const panel = preparePanel(pairs(), { scoreDefinition: 'Test-only fixed score observations' }), data = filled(panel);
  const pending = analyzePanel(panel.control, data.responses, panel.roster, { bootstrapIterations: 50 });
  assert.equal(pending.status, 'awaiting-qualified-human-ratings'); assert.equal(pending.metrics, null);
  const report = analyzePanel(panel.control, data.responses, data.roster, { bootstrapIterations: 100 });
  assert.equal(report.status, 'complete'); assert.equal(report.metrics.rewritePreference, 1);
  assert.equal(report.metrics.naturalnessAlphaInterval, 1); assert.equal(report.metrics.scoreNaturalnessSpearman, -1);
  assert.equal(report.metrics.safeScoreReduction, 60);
  assert.doesNotMatch(JSON.stringify(report), /Private test note|synthetic-test-person|Fixture passage/);
});

test('drafts, duplicate people, changed packets and automated declarations cannot count', () => {
  const panel = preparePanel(pairs(), { scoreDefinition: 'Test' });
  for (const mutate of [
    (data) => { data.responses[0].final = false; },
    (data) => { data.responses[0].usedAi = true; },
    (data) => { data.responses[0].payloadHash = 'bad'; },
    (data) => { data.roster.participants[1].personId = data.roster.participants[0].personId; },
    (data) => { data.responses.push(data.responses[0]); },
  ]) { const data = filled(panel); mutate(data); assert.throws(() => analyzePanel(panel.control, data.responses, data.roster)); }
  const changed = globalThis.structuredClone(panel.control); changed.assignments[0].originalIsA = !changed.assignments[0].originalIsA;
  const { controlHash: _hash, ...unsigned } = changed; changed.controlHash = hash(unsigned);
  const data = filled(panel); assert.throws(() => analyzePanel(changed, data.responses, data.roster), /blinding map/);
});

test('abstention, missing scores and meaning concerns preserve incomplete/unsafe states', () => {
  const panel = preparePanel(pairs(), { scoreDefinition: 'Test' }), data = filled(panel);
  data.responses[0].answers[0].abstain = true;
  assert.equal(analyzePanel(panel.control, data.responses, data.roster).status, 'awaiting-qualified-human-ratings');
  const concern = filled(panel); concern.responses[0].answers[0].meaningConcern = 'uncertain';
  assert.equal(analyzePanel(panel.control, concern.responses, concern.roster, { bootstrapIterations: 50 }).metrics.safePairs, 29);
  const missing = pairs(); missing[0].scoreAfter = null;
  const partial = preparePanel(missing, { scoreDefinition: 'Score observation pending' }), p = filled(partial);
  assert.equal(analyzePanel(partial.control, p.responses, p.roster, { bootstrapIterations: 50 }).status, 'awaiting-score-observations');
  const missingSignal = pairs(); missingSignal[0].signalBefore = null;
  const signalPanel = preparePanel(missingSignal, { scoreDefinition: 'Test' }), signals = filled(signalPanel);
  assert.deepEqual(analyzePanel(signalPanel.control, signals.responses, signals.roster, { bootstrapIterations: 50 }).missingScoreKinds, ['deterministic-signal']);
});

test('agreement, tied ranks and pair-level resampling match analytic cases', () => {
  assert.equal(krippendorffAlpha([[0, 0], [1, 1]], 'nominal'), 1);
  assert.equal(krippendorffAlpha([[0, 1], [0, 1]], 'nominal'), -.5);
  assert.equal(krippendorffAlpha([[0, 0], [0, 0]]), null);
  assert.equal(krippendorffAlpha([[0, null], [1, 1]]), null);
  assert.equal(spearman([1, 1, 3, 4], [4, 4, 2, 1]), -1);
  assert.equal(spearman([1, 1, 1], [1, 2, 3]), null);
  const bootstrap = pairBootstrap([1, 2, 3], (values) => values.reduce((sum, value) => sum + value, 0) / values.length, { iterations: 100 });
  assert.equal(bootstrap.unit, 'source-pair');
  assert.deepEqual(bootstrap, pairBootstrap([1, 2, 3], (values) => values.reduce((sum, value) => sum + value, 0) / values.length, { iterations: 100 }));
});

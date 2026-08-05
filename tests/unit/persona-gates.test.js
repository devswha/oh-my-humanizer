import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ablationDecision, evaluatePersonaGate } from '../../src/personas/gates.js';

test('Persona quality reports low voice match as advisory only', () => {
  const result = evaluatePersonaGate({
    personaMatch: 30,
    churn: 0.1,
    thresholds: { personaMatchMin: 70, churnMax: 0.45 },
  });
  assert.equal(result.pass, true);
  assert.deepEqual(result.hardFailures, []);
  assert.deepEqual(result.safetyFailures, []);
  assert.equal(result.personaMatchPass, false);
  assert.deepEqual(result.advisory, ['personaMatch']);
});

test('Persona quality reports high surface churn as advisory only', () => {
  const result = evaluatePersonaGate({
    personaMatch: 90,
    churn: 0.85,
    thresholds: { personaMatchMin: 70, churnMax: 0.45 },
  });
  assert.equal(result.pass, true);
  assert.equal(result.churnPass, false);
  assert.deepEqual(result.advisory, ['churn']);
});

test('Persona quality ignores safety-shaped inputs owned by verification', () => {
  const result = evaluatePersonaGate({
    personaMatch: 90,
    churn: 0.1,
    mps: 0,
    fidelity: 0,
    droppedNumbers: ['2026'],
    meaningProxy: { severity: 'fail' },
  });
  assert.equal(result.pass, true);
  assert.deepEqual(result.hardFailures, []);
  assert.deepEqual(result.safetyFailures, []);
  assert.deepEqual(result.advisory, []);
  assert.equal(Object.hasOwn(result, 'mps'), false);
  assert.equal(Object.hasOwn(result, 'fidelity'), false);
  assert.equal(Object.hasOwn(result, 'droppedNumbers'), false);
});

test('ablation decision falls back on two consecutive failed rounds', () => {
  const fail = {
    aggregatePass: false,
    meanPersonaMatchDelta: 2,
    winRate: 0.5,
    safetyPassRateDrop: 0,
  };
  assert.equal(ablationDecision([fail, fail]), 'fallback-bridge-only');
});

test('ablation decision resets failure count after a passing round', () => {
  const fail = {
    aggregatePass: false,
    meanPersonaMatchDelta: 2,
    winRate: 0.5,
    safetyPassRateDrop: 0,
  };
  const pass = {
    aggregatePass: true,
    meanPersonaMatchDelta: 6,
    winRate: 0.6,
    safetyPassRateDrop: 0,
  };
  assert.equal(ablationDecision([fail, pass, fail]), 'promote-thresholds');
});

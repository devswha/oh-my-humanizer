// Shared semantic validation for runtime verification and raw study evidence.
// Pure data checks: no transport, filesystem, dependencies, or score repair.
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const bounded = (value, maximum) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;
const points = (value) => Number.isInteger(value) && bounded(value, 3);
const anchorTypes = new Set(['claim', 'polarity', 'causation', 'quantifier', 'negation']);
const verdicts = new Set(['PASS', 'SOFT_FAIL', 'HARD_FAIL']);
const fidelityCriteria = ['claims_preserved', 'no_fabrication', 'audience_register_match'];

/** Validate counts and weighted MPS without discarding consistent HARD_FAIL evidence. */
export function validateMps(value) {
  if (!object(value) || !Array.isArray(value.anchors) || !bounded(value.mps, 100)) throw new Error('invalid-mps-schema');
  for (const anchor of value.anchors) {
    if (!object(anchor) || !anchorTypes.has(anchor.type) || !verdicts.has(anchor.verdict)
      || typeof anchor.content !== 'string' || !anchor.content.trim()) throw new Error('invalid-anchor');
  }
  const passed = value.anchors.filter((anchor) => anchor.verdict === 'PASS').length;
  // core/scoring.md weights Polarity + Negation together, including mixed sets.
  const polarity = value.anchors.filter((anchor) => anchor.type === 'polarity' || anchor.type === 'negation');
  const polarityPassed = polarity.filter((anchor) => anchor.verdict === 'PASS').length;
  if (value.pass_count !== passed || value.total_count !== value.anchors.length
    || value.polarity_pass_count !== polarityPassed || value.polarity_total_count !== polarity.length) throw new Error('inconsistent-mps-counts');
  const passRate = value.anchors.length ? passed / value.anchors.length : 1;
  const expected = polarity.length ? (passRate * .6 + polarityPassed / polarity.length * .4) * 100 : passRate * 100;
  // Preserve the study tolerance for scores rounded to one decimal place.
  if (Math.abs(value.mps - expected) > .11) throw new Error('inconsistent-mps-score');
  const hardFailCount = value.anchors.filter((anchor) => anchor.verdict === 'HARD_FAIL').length;
  if (value.hard_fail_count !== undefined && value.hard_fail_count !== hardFailCount) throw new Error('inconsistent-mps-counts');
  return { ...value, hard_fail_count: hardFailCount };
}

/** Validate the provider's three integer criteria before any fidelity arithmetic. */
export function validateFidelityCriteria(value) {
  if (!object(value) || !fidelityCriteria.every((key) => points(value[key]))) throw new Error('invalid-fidelity-schema');
  return value;
}

/** Validate the runtime result, including deterministic length points and total. */
export function validateFidelityResult(value) {
  if (!object(value) || !bounded(value.fidelity, 100)) throw new Error('invalid-fidelity-schema');
  const criteria = validateFidelityCriteria(value.criteria);
  if (!points(criteria.length_ratio)) throw new Error('invalid-fidelity-schema');
  const expected = (fidelityCriteria.reduce((sum, key) => sum + criteria[key], criteria.length_ratio) / 12) * 100;
  if (Math.abs(value.fidelity - expected) > .11) throw new Error('inconsistent-fidelity-score');
  return value;
}

/**
 * Runtime gate. Full results are mandatory: a numeric score cannot certify
 * schema validity or erase a HARD_FAIL. Research uses the validators above
 * to retain consistent failed observations independently of this gate.
 */
export function evaluateVerification({ mps, fidelity } = {}, { mpsFloor = 70, fidelityFloor = 70 } = {}) {
  const failed = [];
  try {
    const result = validateMps(mps);
    if (mps.error != null || !bounded(mpsFloor, 100) || result.mps < mpsFloor || result.hard_fail_count > 0) failed.push('mps');
  } catch {
    failed.push('mps');
  }
  try {
    const result = validateFidelityResult(fidelity);
    if (fidelity.error != null || !bounded(fidelityFloor, 100) || result.fidelity < fidelityFloor) failed.push('fidelity');
  } catch {
    failed.push('fidelity');
  }
  return { ok: failed.length === 0, failed };
}

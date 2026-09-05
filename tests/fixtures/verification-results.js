// Full scorer fixtures. Fidelity totals are multiples of 1/12, never invented
// percentages; MPS counts describe the listed PASS/SOFT_FAIL anchors exactly.
export function mpsResult(score = 100) {
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('fixture MPS must be an integer percentage');
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const divisor = gcd(score, 100);
  const total = 100 / divisor;
  const passed = score / divisor;
  return {
    anchors: Array.from({ length: total }, (_, index) => ({
      type: 'claim', content: `Claim ${index + 1}`, verdict: index < passed ? 'PASS' : 'SOFT_FAIL',
    })),
    pass_count: passed, total_count: total,
    polarity_pass_count: 0, polarity_total_count: 0, mps: score, hard_fail_count: 0,
  };
}

export function fidelityResult(total = 12) {
  if (!Number.isInteger(total) || total < 0 || total > 12) throw new Error('fixture fidelity must have 0–12 total points');
  // Assign length first so ordinary high scores use the normal length band.
  const length = Math.min(3, total);
  const claims = Math.min(3, total - length);
  const noFabrication = Math.min(3, total - length - claims);
  return {
    criteria: {
      claims_preserved: claims, no_fabrication: noFabrication,
      audience_register_match: total - length - claims - noFabrication,
      length_ratio: length,
    },
    fidelity: Math.round(total / 12 * 1000) / 10,
  };
}

export function highHardFailMps() {
  const result = mpsResult(95);
  result.anchors.at(-1).verdict = 'HARD_FAIL';
  result.hard_fail_count = 1;
  return result;
}

export function zeroAnchorMps() {
  return { anchors: [], pass_count: 0, total_count: 0, polarity_pass_count: 0, polarity_total_count: 0, mps: 100 };
}

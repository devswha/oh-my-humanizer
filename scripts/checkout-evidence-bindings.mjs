function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nestedValue of Object.values(value)) deepFreeze(nestedValue);
  }
  return value;
}

export function checkoutEvidenceBindingKey({ channel, evidence, origin, path }) {
  return JSON.stringify([channel, evidence, origin, path]);
}

// The approved production tuple is source controlled; environment variables
// cannot add, alter, or promote checkout bindings. The production tuple
// integrates the verified Polar identities
// (docs/operations/pay-b-binding-polar-20260729.json) and the production
// zero-amount purchase runtime evidence
// (docs/operations/pay-live-runtime-polar-20260729.json); enabling checkout
// still requires the full Gate-B/Gate-D env-side sequence.
//
// The retired Lemon Squeezy tuples were removed on 2026-08-03: Lemon Squeezy
// declined the account (docs/operations/payment-provider-reset-20260729.md),
// so retaining them would have kept a dead checkout route authorizable. The
// LS evidence artifacts remain on disk, hash-frozen, as history.
export const CHECKOUT_EVIDENCE_BINDINGS = deepFreeze({
  [checkoutEvidenceBindingKey({
    channel: 'production',
    evidence: 'PAY-B-20260729-POLAR-ea8385dc-4c9c3f17',
    origin: 'https://buy.polar.sh',
    path: '/polar_cl_qKqtaZKLhUNJetr1h7XHY6wn8lRJEtG5DAPr02tG1pW',
  })]: true,
});

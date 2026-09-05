const valid = (value) => value !== null && value !== undefined;
export const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function krippendorffAlpha(units, metric = 'interval') {
  if (!['interval', 'nominal'].includes(metric)) throw new Error('Unknown agreement metric');
  const groups = units.map((unit) => unit.filter(valid)).filter((unit) => unit.length >= 2);
  if (groups.length < 2) return null;
  const distance = metric === 'nominal' ? (a, b) => a === b ? 0 : 1 : (a, b) => (a - b) ** 2;
  const pooled = groups.flat();
  if (metric === 'interval' && pooled.some((value) => !Number.isFinite(value))) throw new Error('Interval ratings must be finite');
  let observed = 0;
  for (const group of groups) {
    let differences = 0;
    for (const a of group) for (const b of group) differences += distance(a, b);
    observed += differences / (group.length - 1);
  }
  observed /= pooled.length;
  let expected = 0;
  for (const a of pooled) for (const b of pooled) expected += distance(a, b);
  expected /= pooled.length * (pooled.length - 1);
  return expected > 0 ? 1 - observed / expected : null;
}

function ranks(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = [];
  for (let i = 0; i < sorted.length;) {
    let end = i + 1; while (end < sorted.length && sorted[end].value === sorted[i].value) end++;
    for (let j = i; j < end; j++) result[sorted[j].index] = (i + end - 1) / 2;
    i = end;
  }
  return result;
}

export function spearman(xs, ys) {
  if (xs.length !== ys.length || xs.length < 3 || [...xs, ...ys].some((value) => !Number.isFinite(value))) return null;
  const a = ranks(xs), b = ranks(ys), ma = mean(a), mb = mean(b);
  let numerator = 0, va = 0, vb = 0;
  for (let i = 0; i < a.length; i++) { numerator += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return va && vb ? numerator / Math.sqrt(va * vb) : null;
}

export function pairBootstrap(groups, statistic, { iterations = 2000, seed = 20260905 } = {}) {
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 10000 || !Number.isSafeInteger(seed)) throw new Error('Invalid bootstrap settings');
  if (!groups.length) return null;
  let state = seed >>> 0;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const estimates = [];
  for (let i = 0; i < iterations; i++) {
    const sampled = Array.from({ length: groups.length }, () => groups[Math.floor(next() * groups.length)]);
    const value = statistic(sampled); if (Number.isFinite(value)) estimates.push(value);
  }
  if (estimates.length < iterations * .8) return null;
  estimates.sort((a, b) => a - b);
  return { low: estimates[Math.floor(estimates.length * .025)], high: estimates[Math.min(estimates.length - 1, Math.floor(estimates.length * .975))],
    iterations, validIterations: estimates.length, unit: 'source-pair' };
}

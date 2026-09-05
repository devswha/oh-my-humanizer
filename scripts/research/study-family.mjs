// Study admission policy, not model availability or quality evidence. Provider
// remains the host/billing identity; never rewrite it to select judge seats.
const FAMILIES = new Set(['openai', 'google', 'anthropic', 'deepseek', 'moonshot', 'minimax', 'qwen', 'meta', 'glm']);
const ALIASES = { gemini: 'google', kimi: 'moonshot', alibaba: 'qwen', llama: 'meta', zai: 'glm' };
const FIRST_PARTY = { openai: 'openai', google: 'google', gemini: 'google', anthropic: 'anthropic',
  deepseek: 'deepseek', kimi: 'moonshot', moonshot: 'moonshot', minimax: 'minimax', 'minimax-cn': 'minimax' };
const EVIDENCE = new Set(['declared', 'model-id', 'legacy-first-party']);
const own = (value, field) => Object.hasOwn(value, field);

function normalize(value) {
  if (typeof value !== 'string' || value !== value.trim()) throw new Error('Invalid upstream family');
  const name = value.toLowerCase(), family = ALIASES[name] || name;
  if (!FAMILIES.has(family)) throw new Error('Unknown upstream family; explicit reviewed family policy is required');
  return family;
}

function modelFamily(model) {
  if (typeof model !== 'string') return null;
  const rules = [
    ['openai', /^(?:openai\/)?(?:gpt-|o[1-9](?:-|$))/i],
    ['google', /^(?:(?:google|google-antigravity)\/)?gemini-/i],
    ['anthropic', /^(?:anthropic\/)?claude-/i],
    ['deepseek', /^(?:deepseek-ai\/)?deepseek-/i],
    ['moonshot', /^(?:moonshotai\/)?kimi-|^kimi-code\//i],
    ['minimax', /^(?:minimaxai\/)?minimax-/i],
    ['qwen', /^qwen\/|^qwen[0-9-]/i],
    ['meta', /^(?:meta-llama\/)?llama-/i],
    ['glm', /^(?:(?:zai-org|z-ai)\/)?glm-/i],
  ];
  return rules.find(([, pattern]) => pattern.test(model))?.[0] ?? null;
}

/** Resolve only declared families or recognized identities, never a host name. */
export function resolveStudyFamily(definition, { legacy = false } = {}) {
  if (!definition || typeof definition.provider !== 'string' || !definition.provider) throw new Error('Missing study provider/family identity');
  const providerFamily = own(FIRST_PARTY, definition.provider) ? FIRST_PARTY[definition.provider] : null;
  const inferred = modelFamily(definition.model);
  const declared = own(definition, 'upstreamFamily') ? normalize(definition.upstreamFamily) : null;
  if ((providerFamily && inferred && providerFamily !== inferred)
    || (declared && [providerFamily, inferred].some((family) => family && family !== declared))) {
    throw new Error('Contradictory upstream family in admitted definition');
  }
  if (declared) return { upstreamFamily: declared, familyEvidence: 'declared' };
  if (inferred) return { upstreamFamily: inferred, familyEvidence: 'model-id' };
  if (legacy && providerFamily) return { upstreamFamily: providerFamily, familyEvidence: 'legacy-first-party' };
  throw new Error('Missing upstream family; declare upstreamFamily for an opaque hosted model');
}

function rowFamily(row, judge = false, admitted) {
  const provider = row[judge ? 'judge_provider' : 'provider'];
  const model = row[judge ? 'judge_model' : 'requested_model'];
  const field = judge ? 'judge_upstream_family' : 'upstream_family';
  const evidenceField = judge ? 'judge_family_evidence' : 'family_evidence';
  if (!own(FIRST_PARTY, provider) && (!own(row, field) || !own(row, evidenceField))) throw new Error('Missing hosted row upstream family/evidence');
  if (own(row, evidenceField) && !EVIDENCE.has(row[evidenceField])) throw new Error('Invalid row family evidence');
  if (row[evidenceField] === 'legacy-first-party' && !own(FIRST_PARTY, provider)) throw new Error('Hosted rows cannot claim legacy first-party evidence');
  const identity = { provider, model, ...(own(row, field) ? { upstreamFamily: row[field] } : {}) };
  const resolved = resolveStudyFamily(identity, { legacy: true });
  if (admitted) {
    const expected = resolveStudyFamily(admitted);
    if (provider !== admitted.provider || model !== admitted.model || resolved.upstreamFamily !== expected.upstreamFamily
      || (own(row, evidenceField) && row[evidenceField] !== expected.familyEvidence)) throw new Error('Row upstream family differs from admitted definition');
  }
  return { ...resolved, familyEvidence: row[evidenceField] ?? (own(row, field) ? resolved.familyEvidence : 'legacy-first-party') };
}

export function generationFamily(row, admitted) { return rowFamily(row, false, admitted); }

/** Guard direct judge calls too, before journals or paid evaluators are opened. */
export function independentJudgeMetadata(generation, judge, admittedGenerator) {
  const producer = generationFamily(generation, admittedGenerator), evaluator = resolveStudyFamily(judge);
  if (producer.upstreamFamily === evaluator.upstreamFamily) throw new Error('A judge cannot evaluate its own family (same-family judgment)');
  return { generator_upstream_family: producer.upstreamFamily, generator_family_evidence: producer.familyEvidence,
    judge_upstream_family: evaluator.upstreamFamily, judge_family_evidence: evaluator.familyEvidence };
}

/** Validate saved results without adding fields to historical rows/protocols. */
export function validateJudgmentFamilies(generation, judgment, { candidate, judge } = {}) {
  const producer = generationFamily(generation, candidate), evaluator = rowFamily(judgment, true, judge);
  if ((!own(FIRST_PARTY, generation.provider) && !own(judgment, 'generator_upstream_family'))
    || (own(judgment, 'generator_upstream_family') && normalize(judgment.generator_upstream_family) !== producer.upstreamFamily)
    || (own(judgment, 'generator_family_evidence') && (!EVIDENCE.has(judgment.generator_family_evidence)
      || judgment.generator_family_evidence !== producer.familyEvidence))) throw new Error('Judgment generator family differs from its source');
  if (producer.upstreamFamily === evaluator.upstreamFamily) throw new Error('A judge cannot evaluate its own family (same-family judgment)');
  return evaluator.upstreamFamily;
}

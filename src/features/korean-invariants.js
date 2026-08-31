import { evaluateNumberSafety } from './meaning-proxy.js';

export const KOREAN_INVARIANTS_SCHEMA = 'koInvariants.v1';

const NEGATION_RE = /(?:(?<![가-힣])(?:안|못)(?![가-힣])|않(?:다|았다|는다|습니다)?|없(?:다|었다|습니다)?|아니(?:다|었다|라고)?|금지|불가)/g;
const CAUSAL_RE = /([^.!?\n]{1,80}?)(?:때문에|로 인해|으로 인해)\s*([^.!?\n]{1,80})/g;
const PARTICLE_RE = /(?:에게서|으로부터|로부터|에게|에서|께서|으로|로|은|는|이|가|을|를|의|에|도|만)$/;
const STOP_WORDS = new Set(['그', '이', '저', '것', '결과', '원인']);

function normalizeToken(token) {
  return token.replace(/[^가-힣A-Za-z0-9]/g, '').replace(PARTICLE_RE, '');
}

function contentTokens(text) {
  return String(text ?? '')
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function polaritySignature(text) {
  return (String(text ?? '').match(NEGATION_RE) ?? []).map((marker) => marker.slice(0, 2)).sort();
}

function causalRelations(text) {
  const relations = [];
  let match;
  const pattern = new RegExp(CAUSAL_RE.source, CAUSAL_RE.flags);
  while ((match = pattern.exec(String(text ?? ''))) !== null) {
    const cause = contentTokens(match[1]).at(0);
    const effect = contentTokens(match[2]).at(0);
    if (cause && effect) relations.push({ cause, effect });
  }
  return relations;
}

function roleAssignments(text) {
  const assignments = [];
  const tokens = String(text ?? '')
    .split(/\s+/)
    .map((token) => token.replace(/^[^가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9]+$/g, ''))
    .filter(Boolean);
  const splitParticle = (token, particles) => {
    const particle = particles.find((candidate) => token.endsWith(candidate));
    if (!particle) return null;
    const stem = token.slice(0, -particle.length);
    return stem.length >= 2 && !/^\d/.test(stem) ? stem : null;
  };
  for (let index = 0; index < tokens.length; index += 1) {
    const actor = splitParticle(tokens[index], ['께서', '이', '가', '은', '는']);
    if (!actor) continue;
    for (let targetIndex = index + 1; targetIndex < Math.min(tokens.length, index + 5); targetIndex += 1) {
      const target = splitParticle(tokens[targetIndex], ['에게', '을', '를']);
      if (target) {
        assignments.push({ actor, target });
        break;
      }
    }
  }
  return assignments;
}

function sameRelations(source, target, left, right) {
  const serialize = (relation) => `${relation[left]}\u0000${relation[right]}`;
  const sourceSet = [...new Set(source.map(serialize))].sort();
  const targetSet = [...new Set(target.map(serialize))].sort();
  return JSON.stringify(sourceSet) === JSON.stringify(targetSet);
}

function check(ok, reason = null, details = {}) {
  return { ok, reason: ok ? null : reason, ...details };
}

/**
 * Compare deterministic Korean meaning invariants.
 *
 * @param {string} original
 * @param {string} rewrite
 */
export function evaluateKoreanInvariants(original, rewrite) {
  const numberResult = evaluateNumberSafety(
    original,
    rewrite,
    'ko',
  );
  const sourcePolarity = polaritySignature(original);
  const targetPolarity = polaritySignature(rewrite);
  const polarityOk = JSON.stringify(sourcePolarity) === JSON.stringify(targetPolarity);

  const sourceCausation = causalRelations(original);
  const targetCausation = causalRelations(rewrite);
  const causationOk = sameRelations(
    sourceCausation,
    targetCausation,
    'cause',
    'effect',
  );

  const sourceRoles = roleAssignments(original);
  const targetRoles = roleAssignments(rewrite);
  const rolesOk = sameRelations(sourceRoles, targetRoles, 'actor', 'target');

  const checks = {
    number: check(numberResult.ok, numberResult.reason, {
      originalClaims: numberResult.originalClaims,
      rewriteClaims: numberResult.rewriteClaims,
    }),
    polarity: check(polarityOk, 'explicit-polarity-changed', {
      original: sourcePolarity,
      rewrite: targetPolarity,
    }),
    causation: check(causationOk, 'causal-relation-changed', {
      original: sourceCausation,
      rewrite: targetCausation,
    }),
    entityRole: check(rolesOk, 'entity-role-changed', {
      original: sourceRoles,
      rewrite: targetRoles,
    }),
  };

  return {
    schema: KOREAN_INVARIANTS_SCHEMA,
    ok: Object.values(checks).every((result) => result.ok),
    checks,
  };
}

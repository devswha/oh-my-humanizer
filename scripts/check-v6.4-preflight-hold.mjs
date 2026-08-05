import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_BEST_MODELS } from '../src/model-defaults.js';
import { PROVIDERS } from '../src/providers.js';
import { PROVIDER_PRESETS } from '../src/web-rewrite-contract.js';
import { CHECKOUT_EVIDENCE_BINDINGS, checkoutEvidenceBindingKey } from './checkout-evidence-bindings.mjs';
import launchConfig from '../playground/launch-config.js';

const STATE_URL = new URL('../docs/operations/v6.4-preflight-hold.json', import.meta.url);
const PRODUCTION_EVIDENCE_URL = new URL('../docs/operations/pay-b-binding-polar-20260729.json', import.meta.url);
const RUNTIME_EVIDENCE_URL = new URL('../docs/operations/pay-live-runtime-polar-20260729.json', import.meta.url);
const ROOT_URL = new URL('../', import.meta.url);
const CURRENT_PACKAGE_URL = new URL('../package.json', import.meta.url);
const POST_V64_MUTABLE_HASHES = new Set([
  'src/web-rewrite-contract.js',
  'vercel.json',
  'tests/unit/web-deploy-invariants.test.js',
  'tests/unit/v6.4-preflight-hold.test.js',
  'package.json',
  'package-lock.json',
  'README.md',
  'README_KR.md',
  'README_ZH.md',
  'README_JA.md',
  'SKILL.md',
  '.patina.default.yaml',
  'packages/patina-humanizer/package.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'CHANGELOG.md',
]);
// Polar identities verified by read-back from Polar itself
// (docs/operations/pay-b-binding-polar-20260729.json). The Lemon Squeezy chain
// this replaced was retired on 2026-08-03 after the LS account was declined
// (docs/operations/payment-provider-reset-20260729.md); its evidence files
// remain on disk, hash-frozen, as history. The Polar staging tier was
// superseded by production runtime evidence: a Polar-sanctioned zero-amount
// production purchase reached tier=pro end to end
// (docs/operations/pay-live-runtime-polar-20260729.json), which subsumes what
// a sandbox purchase against a preview deployment would have established.
const REQUIRED_PRODUCTION_EVIDENCE_ID = 'PAY-B-20260729-POLAR-ea8385dc-4c9c3f17';
const REQUIRED_RUNTIME_EVIDENCE_ID = 'PAY-LIVE-20260729-POLAR-ea8385dc-4c9c3f17';
const POLAR_ORGANIZATION_ID = '9a9180b7-2d13-422e-b9a7-316bed61c51d';
const POLAR_PRODUCT_ID = 'ea8385dc-e21f-44bd-8ccd-2725437abb70';
const POLAR_BENEFIT_ID = '4c9c3f17-f3b9-47cd-9ca4-4295ad3957b4';
const POLAR_CHECKOUT_ORIGIN = 'https://buy.polar.sh';
const REQUIRED_ROWS = [['OpenAI HTTP', 'gpt-5.5', 'gpt-5.6'], ['Codex CLI', 'gpt-5.5', 'gpt-5.6'], ['Claude CLI', 'claude-sonnet-4-6', 'claude-sonnet-5'], ['Gemini HTTP', 'gemini-2.5-pro', 'gemini-3.1-pro-preview', 'opt_in_only'], ['Gemini CLI', 'gemini-2.5-pro', 'gemini-3.1-pro-preview', 'opt_in_only']];
const SECRET_NAMES = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'PATINA_LICENSE_PROVIDER', 'POLAR_ORGANIZATION_ID', 'POLAR_PRO_BENEFIT_ID', 'PATINA_PRO_API_KEY', 'PATINA_LICENSE_HMAC_SECRET', 'PATINA_QUOTA_HMAC_SECRET', 'PATINA_FREE_API_KEY', 'PATINA_PRO_PROVIDER', 'PATINA_PRO_MODEL', 'PATINA_PRO_CHECKOUT_ENABLED', 'PATINA_PRO_CHECKOUT_URL', 'PATINA_PRO_GATE_EVIDENCE_ID', 'PATINA_DEPLOYMENT_CHANNEL', 'PATINA_OBSERVABILITY_REST_API_URL', 'PATINA_OBSERVABILITY_REST_API_TOKEN', 'CRON_SECRET', 'PATINA_PUBLIC_BASE_URL', 'PATINA_PUBLIC_BASE_URL_SHA256', 'PATINA_SYNTHETIC_PRO_LICENSE', 'PATINA_SYNTHETIC_OBSERVER_SECRET', 'PATINA_VERCEL_LOG_QUERY_URL', 'PATINA_VERCEL_LOG_QUERY_URL_SHA256', 'PATINA_VERCEL_LOG_QUERY_TOKEN', 'PATINA_ALERT_DISCORD_WEBHOOK', 'VERCEL_GIT_COMMIT_SHA'];
const SECRET_EVIDENCE = `Secret-manager presence-only record, without values, for ${SECRET_NAMES.join(', ')}; PATINA_PRO_ALLOW_FREE_KEY is absent or exactly false.`;
const REQUIRED_BLOCKERS = [['POLAR_APPROVAL', 'Polar Approval Owner', 'Immutable Polar account approval at first payout naming the exact production organization, product, and benefit identities and the exact production HTTPS checkout URL; and approval that is immutable.'], ['SECRET_MANAGER', 'Secret Manager Owner', SECRET_EVIDENCE], ['GATE_B', 'Payment Runtime Owner + maintainer', 'Gate-B approval by the Payment Runtime Owner and maintainer proving completed production source-binding integration commit or artifact, hosted identity, usage, dedicated runtime, content-valid PAY-B-COST evidence, and real-path OBS evidence.'], ['DEP_PROD_DISABLED', 'Deployment Owner', 'Immutable production-disabled artifact/config with the exact disabled launch shape; browser evidence that checkout is disabled; health, monitor, and operator evidence; and UTC timestamps.'], ['GATE_D', 'Release Authority', 'Gate-D record proving mandatory gates passed and naming the approving Release Authority.'], ['ROLLBACK_DRILLS', 'Deployment Owner', 'Timestamped rollback records: sale-close completed within 10 minutes, plus correctness evidence for service-kill and fallback without a 10-minute claim.'], ['PAY_OPEN', 'Maintainer', 'Maintainer authorization to open payment after the required gates and immutable evidence are complete.'], ['PAY_LIVE', 'Payment Runtime Owner', 'Bounded real-production payment, refund, revoke, license-denial, and recovery evidence, including denial and recovery within the documented propagation bound.'], ['REL_PUBLISH', 'Release Authority', 'Final Release Authority approval for the v6.4 tag and registry publication.']];
const REQUIRED_DECISIONS = [['GATE_C_OPENAI_HTTP_NO_PROMOTION', 'HOLD_NO_PROMOTION'], ['GATE_C_CODEX_CLI_NO_PROMOTION', 'HOLD_NO_PROMOTION'], ['GATE_C_CLAUDE_CLI_NO_PROMOTION', 'HOLD_NO_PROMOTION'], ['GATE_C_GEMINI_HTTP_NO_PROMOTION', 'HOLD_NO_PROMOTION'], ['GATE_C_GEMINI_CLI_NO_PROMOTION', 'HOLD_NO_PROMOTION'], ['PAY_STG_SUPERSEDED_BY_PRODUCTION_RUNTIME', 'SUPERSEDED'], ['PAY_B_BINDING_APPROVAL', 'COMPLETED'], ['SOURCE_BINDING_PRODUCTION_INTEGRATION', 'COMPLETED'], ['PAY_LIVE_RUNTIME_ZERO_AMOUNT_SMOKE', 'COMPLETED']];
const REQUIRED_DEFERRED_ACTIONS = [['V6_4_METADATA_COPY_RECONCILIATION', ['GATE_B'], 'Cannot reconcile 6.4 metadata and copy until Gate B evidence exists; Gate-C no-promotion cutoff decisions are complete.', false], ['FINAL_TAG_PUBLISH_COMMAND', ['PAY_LIVE', 'REL_PUBLISH'], 'Cannot run the final tag and publish command until named external evidence exists.', false]];
const FROZEN_SEMANTICS = Object.freeze({ manifestVersion: 4, providers: Object.fromEntries(Object.entries(PROVIDERS).map(([key, provider]) => [key, Object.fromEntries(['name', 'baseURL', 'apiKeyEnv', 'defaultModel', 'freeTier', 'note'].map((field) => [field, provider[field]]))])), sourceHashes: {
  '.env.example': '29b1cdc48b5c14ed0c84716ad9ca42ba23001b9f40f99efb78c2c368180e7e5a', 'src/model-defaults.js': 'c568977fcac8ea44d5387a8a8745b062675ec94d73d39ce528c492ad35f87176', 'src/providers.js': '92415eacaf87da2d0f2aed7db97feeb98b8b087adfe584a02c4478353b807d90', 'src/web-rewrite-contract.js': 'be433e8260e452028eb53b5c1aed0935a4150cd669ec2d5e826302219df22b9a', 'playground/launch-config.js': '4d19fc8ce36651f73f94d80bbcd108a2ccbb50fa3fc25b54d75f193b42ac6bf4', 'vercel.json': '37a54c0850db54e80eec963c570d4b8a047fcfb4bf56d1a133e5a3934b28260e', 'scripts/checkout-evidence-bindings.mjs': '767c832fe4b517824e06fa7e18d6dd777e6525831dcfaa2022e51a4c8f27c07c', 'scripts/generate-launch-config.mjs': 'c5047625479bc687c510b6faf5045cf6118359ba978d219cea834325de5e8a07', 'scripts/check-v6.4-release-ready.mjs': 'fc4521db8f4677e03ac6a2199a86917b6332033030a9e8fe248cd166b0a59313', 'docs/AUTHENTICATION.md': 'e8c335550c4a0f0b144b79f4286d467a968962821a1c88049f1e679810751cfe', 'docs/AUTHENTICATION_KR.md': '5e077cd3a13c2299a11fc831c8303a204880c91dd0d465148d34a435dbe00796', 'docs/operations/pro-launch.md': '50448491ce0b745eb2bfe07983238a6e727466de0f71c72b7cbc4a9c447068ff', 'docs/operations/pay-stg-binding-20260716.json': '2f523259de91f640f056fe7acfe00264e493d9891b7a61152fe5e91704c0ecdf', 'docs/operations/pay-stg-runtime-20260716.json': 'b0229e892b06e1ec303a001c1317c4c63fc3c98fd7e10243e64db07df4803d29', 'docs/operations/pay-b-binding-20260723.json': '96eb8e0aba9fcb4ce67dd356bd35aaf678d8abea96a7ec134218eab7cd20f132', 'docs/operations/pay-b-binding-polar-20260729.json': '471c9035a04ce5c2c76d7e5b4d595054191d513fa007455a02c9b123d0811ac5', 'docs/operations/pay-live-runtime-polar-20260729.json': '384912dca4576f1c3f8d653f39c3d9a8cb19f8f8acc1a91ac2bc36fdf10e7a9c', 'tests/e2e/providers.test.js': '47958be678e9bbfd06bcdd849ec0df37ed765f886e245b7b528e7d596b6d9dfe', 'tests/unit/backend-model-defaults.test.js': '908dd9b06a9d5305ad28b50007d6428435b0b6b7019d6a2210aff813bfb9cf3d', 'tests/unit/web-deploy-invariants.test.js': '2aecb9068c04999eaf964766cdc1e0c3a551f58ecfa54a0ade8802f1b8f4f296', 'tests/unit/web-rewrite-contract.test.js': '2980f555bb53e7c8d93a74d60dc096adadfd1c7d07fd70f55de1670959219c13', 'tests/unit/web-rewrite-contract.redteam.test.js': '3c7591926e168b14f486199297fd1e84ed447c1b8d339c9b4860f79da0f6a7bb', 'tests/unit/v6.4-preflight-hold.test.js': 'c5f8a3465576dff5a94f07dd8eaac741d1e0e5006b7076fe9884204eb7a0c7a8', 'tests/unit/v6.4-release-ready.test.js': '8d88aab35ce75bc40b4782932329c0402001afabc380ac349ccc1b82d01c12d7', 'package.json': '6712053362194ab947aa10de4f7772bfa23ae6db97dc5a912e05763c4e3a2dc3', 'package-lock.json': '3d4b2573cd3a273d766a01a6ea2245b2528a9149ae75fdda9bb977bfd5af69a1', '.github/workflows/release.yml': '43900a0966a52c500d54b1971d4141fe2d380a893364b4cb7b9976e9e3795f8f', 'README.md': '78829adef9bc233a2dc0003ea022281ce483cb958daeef01a073361e31ce8f11', 'README_KR.md': 'ebac4f175b399a081d4c4a2b92fcc0708f1e85976d8da869f0f9b608046cfd59', 'README_ZH.md': '66076f5870bf806310b4516db0c260037f7b2684c3234b291660593f744a8ec0', 'README_JA.md': 'bd71aa30bd9eca7b1f4520f4fb609585f40ccbf78d9c0ba29d29c7364c869c44', 'SKILL.md': '3b7dc62f22c1feb9178d49a47e78bfa60fe94ea314d7132a99dcc6c9b231a4c5', '.patina.default.yaml': '308311b43add43e9d0e40bdfcdf65823337f12357e50366ce0fb8b07cfd76885', 'packages/patina-humanizer/package.json': 'fc9b27a4c97965d17b18492999f7018f34819806d63d626eeb428f6dd0834c63', '.claude-plugin/plugin.json': '7a5df3e87832d22821e7d1fafed76e125b33a02d5550e46fa73e7aa9073d2325', '.claude-plugin/marketplace.json': 'c500dfec67c40f4c2acb6de3efc5c60631e8e82ff961311a09609fe37e806e2d', 'CHANGELOG.md': 'dfc4fb1f70ca873ca1bf44b3949374d43018fc673b98212e7515b31c9a07ef80' } });
const DISABLED_LAUNCH = { schemaVersion: 1, channel: 'disabled', enabled: false, checkoutOrigin: null, checkoutPath: null, evidence: null };
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
function exactKeys(value, keys, label, errors) { if (!isObject(value)) { errors.push(`${label} must be an object`); return false; } const actual = Object.keys(value).sort(); const expected = [...keys].sort(); if (!sameJson(actual, expected)) errors.push(`${label} must contain exactly: ${expected.join(', ')}`); return sameJson(actual, expected); }
function validUtcTimestamp(value) { const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(value); if (!match || Number.isNaN(Date.parse(value))) return false; const [, year, month, day, hour, minute, second] = match.map(Number); const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second; }
function requireString(value, label, errors) { if (typeof value !== 'string' || value.length === 0) errors.push(`${label} must be a non-empty string`); }
function verifyFactsSha256(evidence, label, errors) {
  if (typeof evidence.factsSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(evidence.factsSha256)) errors.push(`${label}.factsSha256 must be a SHA-256 hex string`);
  const { factsSha256, ...facts } = evidence;
  if (typeof factsSha256 === 'string' && createHash('sha256').update(JSON.stringify(facts)).digest('hex') !== factsSha256) errors.push(`${label} factsSha256 does not match compact insertion-ordered facts`);
}
function validatePolarBindingEvidence(evidence, errors) {
  const errorCount = errors.length;
  exactKeys(evidence, ['schemaVersion', 'evidenceId', 'observedAt', 'provider', 'source', 'verification', 'organization', 'product', 'benefit', 'checkout', 'licenseGateEnv', 'notEstablished', 'factsSha256'], 'production binding evidence', errors);
  if (!isObject(evidence)) return null;
  if (evidence.schemaVersion !== 'PAY-B-BINDING-POLAR-v1') errors.push('production binding evidence schemaVersion must be PAY-B-BINDING-POLAR-v1');
  if (evidence.evidenceId !== REQUIRED_PRODUCTION_EVIDENCE_ID) errors.push('production binding evidence ID must be exact');
  if (evidence.provider !== 'polar') errors.push('production binding evidence provider must be polar');
  if (!validUtcTimestamp(evidence.observedAt)) errors.push('production binding evidence.observedAt must be a valid UTC timestamp');
  requireString(evidence.source, 'production binding evidence.source', errors);
  exactKeys(evidence.verification, ['method', 'checkoutLinkStatus', 'sessionEndpoint', 'sessionStatus'], 'production binding evidence.verification', errors);
  if (evidence.verification?.checkoutLinkStatus !== 307 || evidence.verification?.sessionStatus !== 200) errors.push('production binding evidence must record the read-back verification statuses');
  exactKeys(evidence.organization, ['id'], 'production binding evidence.organization', errors);
  if (evidence.organization?.id !== POLAR_ORGANIZATION_ID) errors.push('production binding evidence organization identity must be exact');
  exactKeys(evidence.product, ['id', 'name', 'isRecurring', 'recurringInterval', 'priceAmountType', 'priceCents', 'currency', 'isArchived', 'trial'], 'production binding evidence.product', errors);
  if (evidence.product?.id !== POLAR_PRODUCT_ID || evidence.product?.isRecurring !== true || evidence.product?.recurringInterval !== 'month' || evidence.product?.priceAmountType !== 'fixed' || evidence.product?.priceCents !== 999 || evidence.product?.currency !== 'usd' || evidence.product?.isArchived !== false || evidence.product?.trial !== null) errors.push('production binding evidence product must be the live monthly $9.99 fixed-price subscription');
  exactKeys(evidence.benefit, ['id', 'type', 'description', 'expires', 'limitActivations', 'limitUsage'], 'production binding evidence.benefit', errors);
  if (evidence.benefit?.id !== POLAR_BENEFIT_ID || evidence.benefit?.type !== 'license_keys' || evidence.benefit?.expires !== false || evidence.benefit?.limitActivations !== false || evidence.benefit?.limitUsage !== false) errors.push('production binding evidence benefit must be the unlimited license-keys benefit');
  exactKeys(evidence.checkout, ['url', 'allowDiscountCodes', 'requireBillingAddress', 'successUrlOverridden', 'returnUrl'], 'production binding evidence.checkout', errors);
  if (!sameJson(evidence.licenseGateEnv, { PATINA_LICENSE_PROVIDER: 'polar', POLAR_ORGANIZATION_ID, POLAR_PRO_BENEFIT_ID: POLAR_BENEFIT_ID })) errors.push('production binding evidence licenseGateEnv must exactly name the polar gate variables');
  if (!Array.isArray(evidence.notEstablished) || !evidence.notEstablished.every((entry) => typeof entry === 'string' && entry.length > 0)) errors.push('production binding evidence.notEstablished must list what the record does not establish');
  verifyFactsSha256(evidence, 'production binding evidence', errors);
  let url;
  try { url = new URL(evidence.checkout?.url); } catch { errors.push('production binding evidence.checkout.url must be a URL'); return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.origin !== POLAR_CHECKOUT_ORIGIN || !url.pathname.startsWith('/polar_cl_')) errors.push('production binding evidence checkout URL must be the Polar HTTPS checkout-link path');
  return errors.length === errorCount ? { channel: 'production', evidence: evidence.evidenceId, origin: url.origin, path: url.pathname } : null;
}
function rejectRuntimeSecrets(value, path, errors) { if (Array.isArray(value)) return value.forEach((entry, index) => rejectRuntimeSecrets(entry, `${path}[${index}]`, errors)); if (!isObject(value)) return; for (const [key, entry] of Object.entries(value)) { if (/(?:secret|token|api.?key|password|license.?key)/i.test(key)) errors.push(`${path}.${key} is secret-like`); rejectRuntimeSecrets(entry, `${path}.${key}`, errors); } }
function validatePolarRuntimeEvidence(evidence, errors) {
  const errorCount = errors.length;
  const expected = { schemaVersion: 'PAY-LIVE-RUNTIME-POLAR-v1', evidenceId: REQUIRED_RUNTIME_EVIDENCE_ID, observedAt: '2026-07-29T23:37:17.096Z', provider: 'polar', server: 'production', moneyMoved: false, method: 'forever 100% discount code, Polar-sanctioned production verification (no card, no card-testing)', checkout: { linkOrigin: POLAR_CHECKOUT_ORIGIN, discountDuration: 'forever', discountBasisPoints: 10000, subtotalCents: 999, totalCents: 0, isPaymentRequired: false, confirmStatus: 'confirmed', organizationStatusAtPurchase: 'active' }, license: { status: 'granted', benefitId: POLAR_BENEFIT_ID, displayKey: '****-CC442E', keyLength: 43, prefixApplied: false, expiresAt: null, limitActivations: null, limitUsage: null, rawKeyRecorded: false, customerPiiRecorded: false }, proEntitlement: { url: 'https://patina.vibetip.help', deployedVersion: '6.3.3', httpStatus: 200, terminal: 'done', events: ['start', 'delta', 'done', 'claim', 'quantifier'], numbersPreserved: ['14:30', '23,000'], rawLicenseInResponse: false }, priorFailure: { deployedVersion: '6.3.2', httpStatus: 403, cause: 'origin/main at 6.3.2 shipped no src/entitlement-polar.js; the configured env had no code to read it' }, notEstablished: ['A card-backed purchase has never been completed; only a zero-amount checkout.', 'Payout is unproven: the account review (up to 14 days) governs money reaching the owner, not the ability to sell.', 'Refund, cancellation-revocation, and chargeback handling are untested on production.', 'The monthly 100-request cap is proven against a local handler, not against this production deployment.'] };
  exactKeys(evidence, [...Object.keys(expected), 'factsSha256'], 'production runtime evidence', errors);
  rejectRuntimeSecrets(evidence, 'production runtime evidence', errors);
  if (!isObject(evidence) || !sameJson(Object.fromEntries(Object.keys(expected).map((key) => [key, evidence[key]])), expected)) errors.push('production runtime evidence must exactly retain the zero-amount purchase, production pro smoke, number safety, and not-established facts');
  if (!validUtcTimestamp(evidence?.observedAt)) errors.push('production runtime evidence.observedAt must be a valid UTC timestamp');
  if (isObject(evidence)) verifyFactsSha256(evidence, 'production runtime evidence', errors);
  return errors.length === errorCount ? evidence.evidenceId : null;
}
function rejectReceiptFields(value, path, errors) { if (Array.isArray(value)) return value.forEach((entry, index) => rejectReceiptFields(entry, `${path}[${index}]`, errors)); if (!isObject(value)) return; for (const [key, entry] of Object.entries(value)) { if (/pass|receipt/i.test(key)) errors.push(`${path}.${key} is forbidden in a non-receipt hold`); if (key === 'evidence' && !path.startsWith('state.completedDecisions[') && entry !== null) errors.push(`${path}.evidence must be null outside completed decisions`); rejectReceiptFields(entry, `${path}.${key}`, errors); } }
function hashFile(path) { return createHash('sha256').update(readFileSync(new URL(path, ROOT_URL))).digest('hex'); }
function validateFrozenSources(sources, errors) { const modelDefaults = sources.modelDefaults ?? DEFAULT_BEST_MODELS; const providers = sources.providers ?? PROVIDERS; const presets = sources.webProviderPresets ?? PROVIDER_PRESETS; const defaults = [presets.openai?.models?.[0], modelDefaults.codexCli, modelDefaults.claudeCli, providers.gemini?.defaultModel, modelDefaults.geminiCli]; REQUIRED_ROWS.forEach(([, expected], index) => { if (defaults[index] !== expected) errors.push(`held source default ${REQUIRED_ROWS[index][0]} changed`); }); for (const [key, expected] of Object.entries(FROZEN_SEMANTICS.providers)) { const provider = providers[key]; if (!sameJson(provider && Object.fromEntries(Object.keys(expected).map((field) => [field, provider[field]])), expected)) errors.push(`source provider ${key} changed from frozen semantics`); } }
function validateHashes(errors, hash = hashFile, currentVersion) {
  const version = currentVersion ?? JSON.parse(readFileSync(CURRENT_PACKAGE_URL, 'utf8')).version;
  const match = typeof version === 'string' ? /^(\d+)\.(\d+)(?:\.|$)/.exec(version) : null;
  const isAfterV64 = match ? Number(match[1]) > 6 || (Number(match[1]) === 6 && Number(match[2]) > 4) : false;
  for (const [file, expected] of Object.entries(FROZEN_SEMANTICS.sourceHashes)) {
    if (isAfterV64 && POST_V64_MUTABLE_HASHES.has(file)) continue;
    try {
      if (hash(file) !== expected) errors.push(`frozen SHA-256 mismatch: ${file}`);
    } catch {
      errors.push(`frozen manifest entry unreadable: ${file}`);
    }
  }
}
function validateDependencyGraph(state, errors) { const blockers = new Set(REQUIRED_BLOCKERS.map(([id]) => id)); const decisions = new Set(REQUIRED_DECISIONS.map(([id]) => id)); const actions = new Set(REQUIRED_DEFERRED_ACTIONS.map(([id]) => id)); const known = new Set([...blockers, ...decisions, ...actions]); const ranks = { POLAR_APPROVAL: 1, PAY_B_BINDING_APPROVAL: 2, SOURCE_BINDING_PRODUCTION_INTEGRATION: 3, PAY_LIVE_RUNTIME_ZERO_AMOUNT_SMOKE: 3, GATE_B: 4, V6_4_METADATA_COPY_RECONCILIATION: 5, PAY_LIVE: 6, REL_PUBLISH: 6, FINAL_TAG_PUBLISH_COMMAND: 7 }; const graph = new Map((state.deferredActions || []).map((action) => [action.id, action.blockedBy])); for (const [id, dependencies] of graph) for (const dependency of dependencies || []) { if (!known.has(dependency)) errors.push(`dependency graph references unknown ID: ${dependency}`); if (dependency === id) errors.push(`dependency graph contains self reference: ${id}`); if (ranks[id] !== undefined && ranks[dependency] !== undefined && ranks[dependency] >= ranks[id]) errors.push(`dependency graph reverses release order: ${id} -> ${dependency}`); } const visiting = new Set(); const visited = new Set(); const visit = (id) => { if (visiting.has(id)) { errors.push(`dependency graph contains cycle at: ${id}`); return; } if (visited.has(id)) return; visiting.add(id); for (const dependency of graph.get(id) || []) if (actions.has(dependency)) visit(dependency); visiting.delete(id); visited.add(id); }; for (const id of graph.keys()) visit(id); }
/** Validate the closed non-receipt v6.4 preflight state. */
export function validatePreflightHold(state, sources = {}) {
  const errors = [];
  if (!isObject(state)) return ['state must be an object'];
  const productionEvidence = sources.productionEvidence ?? JSON.parse(readFileSync(PRODUCTION_EVIDENCE_URL, 'utf8'));
  const productionBinding = validatePolarBindingEvidence(productionEvidence, errors);
  const runtimeEvidence = sources.runtimeEvidence ?? JSON.parse(readFileSync(RUNTIME_EVIDENCE_URL, 'utf8'));
  const runtimeEvidenceId = validatePolarRuntimeEvidence(runtimeEvidence, errors);
  rejectReceiptFields(state, 'state', errors);
  exactKeys(state, ['schemaVersion', 'release', 'state', 'promotionRows', 'completedDecisions', 'checkout', 'frozenSemantics', 'blockers', 'deferredActions', 'prohibitions'], 'state', errors);
  if (state.schemaVersion !== 4) errors.push('schemaVersion must be 4');
  if (state.release !== 'v6.4') errors.push('release must be v6.4');
  if (state.state !== 'HOLD_NO_PROMOTION') errors.push('state must be HOLD_NO_PROMOTION');
  if (!Array.isArray(state.promotionRows) || state.promotionRows.length !== REQUIRED_ROWS.length) errors.push('promotionRows must contain exactly five ordered hold rows');
  else state.promotionRows.forEach((row, index) => { const [surface, currentDefault, candidate, ceiling] = REQUIRED_ROWS[index]; exactKeys(row, ceiling ? ['surface', 'currentDefault', 'candidate', 'ceiling', 'status'] : ['surface', 'currentDefault', 'candidate', 'status'], `promotionRows[${index}]`, errors); if (!isObject(row) || row.surface !== surface || row.currentDefault !== currentDefault || row.candidate !== candidate || row.status !== 'HOLD_NO_PROMOTION' || row.ceiling !== ceiling) errors.push(`promotionRows[${index}] must exactly retain ${surface}'s HOLD_NO_PROMOTION row`); });
  if (!Array.isArray(state.completedDecisions) || state.completedDecisions.length !== REQUIRED_DECISIONS.length) errors.push('completedDecisions must contain exactly five Gate-C, one superseded-staging, and three Polar production decisions');
  else state.completedDecisions.forEach((decision, index) => { const [id, status] = REQUIRED_DECISIONS[index]; const evidenceId = ({ PAY_STG_SUPERSEDED_BY_PRODUCTION_RUNTIME: runtimeEvidenceId, PAY_B_BINDING_APPROVAL: productionBinding?.evidence, SOURCE_BINDING_PRODUCTION_INTEGRATION: productionBinding?.evidence, PAY_LIVE_RUNTIME_ZERO_AMOUNT_SMOKE: runtimeEvidenceId })[id]; exactKeys(decision, evidenceId ? ['id', 'status', 'evidence'] : ['id', 'status'], `completedDecisions[${index}]`, errors); if (!isObject(decision) || decision.id !== id || decision.status !== status || (evidenceId ? decision.evidence !== evidenceId : Object.hasOwn(decision, 'evidence'))) errors.push(`completedDecisions[${index}] must exactly retain ${id}`); });
  exactKeys(state.checkout, ['enabled'], 'checkout', errors);
  if (!isObject(state.checkout) || state.checkout.enabled !== false) errors.push('state checkout must be disabled');
  const launch = sources.launch ?? launchConfig;
  exactKeys(launch, Object.keys(DISABLED_LAUNCH), 'checked-in launch artifact', errors);
  if (!sameJson(launch, DISABLED_LAUNCH)) errors.push('checked-in launch artifact must exactly retain six-field disabled shape');
  const bindings = sources.bindings ?? CHECKOUT_EVIDENCE_BINDINGS;
  const requiredBindings = productionBinding ? Object.freeze({ [checkoutEvidenceBindingKey(productionBinding)]: true }) : null;
  if (!isObject(bindings) || !Object.isFrozen(bindings) || !sameJson(bindings, requiredBindings)) errors.push('checkout evidence binding table must exactly retain the validated production binding');
  if (!sameJson(state.frozenSemantics, FROZEN_SEMANTICS)) errors.push('frozenSemantics must exactly match manifest version 4');
  validateFrozenSources(sources, errors);
  if (sources.checkHashes !== false) validateHashes(errors, sources.hashFile, sources.currentVersion);
  if (!Array.isArray(state.blockers) || state.blockers.length !== REQUIRED_BLOCKERS.length) errors.push('blockers must contain exactly the ordered required blockers');
  else state.blockers.forEach((blocker, index) => { const [id, owner, exitEvidence] = REQUIRED_BLOCKERS[index]; exactKeys(blocker, ['id', 'type', 'owner', 'exitEvidence', 'evidence'], `blockers[${index}]`, errors); if (!isObject(blocker) || blocker.id !== id || blocker.type !== 'human_action' || blocker.owner !== owner || blocker.exitEvidence !== exitEvidence || blocker.evidence !== null) errors.push(`blockers[${index}] must exactly retain ${id}'s owner, human type, exit artifact, and null evidence`); });
  if (!Array.isArray(state.deferredActions) || state.deferredActions.length !== REQUIRED_DEFERRED_ACTIONS.length) errors.push('deferredActions must contain exactly the closed deferred repo actions');
  else state.deferredActions.forEach((action, index) => { const [id, blockedBy, reason] = REQUIRED_DEFERRED_ACTIONS[index]; exactKeys(action, ['id', 'type', 'blockedBy', 'reason', 'executable'], `deferredActions[${index}]`, errors); if (!isObject(action) || action.id !== id || action.type !== 'repo_action' || !sameJson(action.blockedBy, blockedBy) || action.reason !== reason || action.executable !== false) errors.push(`deferredActions[${index}] must exactly retain ${id}'s closed external-evidence hold`); });
  validateDependencyGraph(state, errors);
  exactKeys(state.prohibitions, ['tag', 'publish'], 'prohibitions', errors);
  if (!isObject(state.prohibitions) || state.prohibitions.tag !== true || state.prohibitions.publish !== true) errors.push('tag and publish prohibitions must be explicit');
  return [...new Set(errors)];
}
export function validateCheckedInPreflightHold() { return validatePreflightHold(JSON.parse(readFileSync(STATE_URL, 'utf8'))); }
if (process.argv[1] === fileURLToPath(import.meta.url)) { const errors = validateCheckedInPreflightHold(); if (errors.length) { console.error(errors.map((error) => `v6.4 preflight hold: ${error}`).join('\n')); process.exitCode = 1; } else console.log('v6.4 preflight hold is valid.'); }

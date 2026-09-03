// Rewrite-efficacy Study 4 runner — specificity-preservation constraint (H-4b).
// Registered design: docs/research/2026-rewrite-efficacy-prereg.md ("Study 4").
//
// Per document (same Study 1 corpus, by stored original text) two fresh arms
// run back-to-back with the same pinned rewriter:
//   P  the production minimal-mode prompt exactly as `patina --lang <l>
//      --backend claude-cli` builds it today; no retry.
//   S  the same prompt with the fixed constraint block spliced in before the
//      output-format section; if the body is < 98% of the original length the
//      model is re-prompted with a fixed feedback suffix, at most two retries.
// Both bodies pass the production extractor, the deterministic meaning gate,
// the det chief scorer, the pre-registered detail-token / copy measures and
// the admitted LLM judges. Rows carry hashes, scores and metadata; texts stay
// in the ignored private store.
//
// `buildDocumentSignals` is a private function in src/cli/run.js; its ten
// lines are replicated here verbatim (documentSignals()).
//
// Env: S4_STAGE=ko|en (default ko), S4_LIMIT=<n>, S4_JUDGES=judge-gpt,judge-gemini
// (override; default comes from bridge-verdict.json), S4_USE_GROK=1.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadConfig, getRepoRoot, resolveRegister } from '../../src/config.js';
import { loadPatterns, applyDocumentTypePatternPolicy, loadDocumentType, loadCoreFile } from '../../src/loader.js';
import { buildPrompt } from '../../src/prompt-builder.js';
import { resolvePromptMode, resolveDocumentTypeForLanguage } from '../../src/cli/run.js';
import { cleanRewriteOutput } from '../../src/output.js';
import { deterministicMeaningGuard } from '../../src/verify.js';
import { detectKoreanRegister } from '../../src/features/stylometry.js';
import { scoreText } from '../prose-score.mjs';
import { DET_DOCUMENT_THRESHOLD, validateFreshCorpus } from './panel-v2.mjs';
import {
  JUDGE_DEFS, OUT_DIR, REWRITER_MODEL, S1_DIR, claudeCall, collapse, detailStats, judgeOnce,
  lengthRatio, loadS1Texts, makeLogger, readJsonl, sha, trigramJaccard,
} from './study4-common.mjs';

const STAGE = process.env.S4_STAGE === 'en' ? 'en' : 'ko';
const S1_ARM = STAGE === 'ko' ? 'D' : 'A1';
// Plumbing smoke test on a synthetic paragraph (never a corpus document):
// S4_SMOKE_TEXT_FILE=<path> routes output to s4-smoke-* files.
const SMOKE_FILE = process.env.S4_SMOKE_TEXT_FILE || null;
const PREFIX = SMOKE_FILE ? 's4-smoke' : 's4';
const OUT_JSONL = join(OUT_DIR, `${PREFIX}-rows-${STAGE}.jsonl`);
const TEXTS_JSONL = join(OUT_DIR, `${PREFIX}-texts-${STAGE}.private.jsonl`);
const LOG = join(OUT_DIR, `${PREFIX}-run-${STAGE}.log`);
const VERDICT = join(OUT_DIR, 'bridge-verdict.json');

const REWRITE_TIMEOUT_MS = 900_000; // raised 600s -> 900s at doc 12 (S attempt 2 timeout), Study 3 precedent; execution note, no criterion change
const FLOOR = 0.98;
const MAX_ATTEMPTS = 3; // one first pass + two retries

// ---------------------------------------------------------------------------
// FIXED TEXTS — registered verbatim in the prereg; stamped by sha in every row.
// Do not edit after the first real row exists.

const BLOCK = {
  ko: `## 구체성 보존 (필수 — 위의 "±30%" 분량 규칙보다 우선한다)

1. 길이 하한: 다듬은 본문의 글자 수는 원문의 98% 이상이어야 한다. 군더더기를 걷어낸 자리는 요약이 아니라 같은 무게의 구체적인 표현으로 다시 채운다.
2. 원문에 있는 구체적 세부는 하나도 빠뜨리지 않는다: 숫자·날짜·단위·비율, 사람·기관·제품·기능·장소 이름, 인용구, 예시와 일화, 비유에 등장하는 대상. 여러 항목을 "등"이나 일반 명사로 뭉뚱그리지 않는다.
3. 원문에 없는 사실·숫자·이름·예시를 새로 만들어 넣지 않는다. 길이를 채우려고 지어내는 것은 금지다.
4. 다 쓰고 나서 원문과 나란히 대조해, 빠진 세부가 있으면 원래 자리에 되살린 뒤에 출력한다.
`,
  en: `## Preserve specificity (REQUIRED — overrides the "±30%" length rule above)

1. Length floor: the rewritten body must be at least 98% of the original's character count. Where you cut filler, refill the space with concrete phrasing of the same weight, not with a summary.
2. Keep every concrete detail the original contains: numbers, dates, units, percentages; names of people, organisations, products, features and places; quotations; examples and anecdotes; the objects inside analogies. Never collapse several items into "etc." or a generic noun.
3. Do not invent facts, numbers, names or examples that are not in the original. Padding with invented material is forbidden.
4. When you finish, compare the result against the original side by side; restore any missing detail in its original place before you output.
`,
};

const RETRY = {
  ko: `## 재시도 사유

직전 출력은 원문 길이의 {ratio}%였다. 위 "구체성 보존" 규칙 1의 98% 하한을 지키지 못했다. 빠뜨린 구체적 세부를 되살리고 군더더기 자리를 같은 무게의 표현으로 채워, 원문 길이의 98% 이상으로 다시 출력하라. 새 사실을 지어내지 마라.
`,
  en: `## Reason for retry

Your previous output was {ratio}% of the original's length, below the 98% floor in rule 1 of "Preserve specificity" above. Restore the concrete details you dropped and refill cut filler with phrasing of the same weight, then output again at 98% or more of the original length. Do not invent new facts.
`,
};

const FORMAT_MARKER = { ko: '## 출력 형식\n\n', en: '## Output format\n\n' };
const OUTPUT_MARKER = { ko: '## 출력\n\n', en: '## Output\n\n' };

// ---------------------------------------------------------------------------
// Production prompt assembly (mirrors src/cli/run.js runDefault for a plain
// `patina --lang <l> --backend claude-cli` rewrite: default document type, no
// persona, no register, measured document signals, jargon keep, headings kept).

function documentSignals({ text, lang }) {
  if (lang !== 'ko') return { signals: [], register: null };
  const register = detectKoreanRegister(text);
  if (!register) return { signals: [], register: null };
  const pct = (value) => `${Math.round(value * 100)}%`;
  const distribution = `합쇼체 ${pct(register.shares.formal)} · 해요체 ${pct(register.shares.polite)} · -다체 ${pct(register.shares.plain)} (문장 ${register.classified}개 기준)`;
  const signals = register.register === 'mixed'
    ? [`어미 분포: ${distribution} — 지배 어투 없음(혼합). 문서 성격에 맞는 어투 하나를 골라 전체를 통일할 것`]
    : [`지배 어투: ${register.label} — ${distribution}. 재작성 문장 전체를 이 어투로 통일할 것`];
  return { signals, register };
}

function loadAssets(lang) {
  const config = loadConfig();
  config.language = lang;
  const repoRoot = getRepoRoot();
  const registerResolution = resolveRegister({ cliRegister: undefined, configRegister: config.register });
  let documentTypeName = config.documentType || 'default';
  const resolvedName = resolveDocumentTypeForLanguage(documentTypeName, lang, null);
  if (resolvedName !== documentTypeName) { documentTypeName = resolvedName; config.documentType = 'default'; }
  const documentType = loadDocumentType(repoRoot, documentTypeName);
  const patterns = applyDocumentTypePatternPolicy(loadPatterns(repoRoot, lang, config['skip-patterns'] || []), documentType, lang);
  const voice = loadCoreFile(repoRoot, 'voice.md');
  const scoring = loadCoreFile(repoRoot, 'scoring.md');
  const promptMode = resolvePromptMode({ backend: 'claude-cli', model: REWRITER_MODEL });
  return { config, patterns, documentType, voice, scoring, promptMode, registerResolution, repoRoot };
}

function productionPrompt(text, assets, lang) {
  return buildPrompt({
    config: assets.config,
    patterns: assets.patterns,
    documentType: assets.documentType,
    voice: assets.voice.body ? assets.voice : null,
    scoring: assets.scoring.body ? assets.scoring : null,
    text,
    mode: 'rewrite',
    register: assets.registerResolution,
    promptMode: assets.promptMode,
    documentSignals: documentSignals({ text, lang }).signals,
    jargon: 'keep',
    rewriteHeadings: false,
    persona: null,
  });
}

function spliceOnce(prompt, marker, insert) {
  const first = prompt.indexOf(marker);
  if (first < 0 || prompt.indexOf(marker, first + 1) >= 0) throw new Error(`marker not unique: ${JSON.stringify(marker)}`);
  return prompt.slice(0, first) + insert + prompt.slice(first);
}

function specificityPrompt(base, lang) {
  return spliceOnce(base, FORMAT_MARKER[lang], `${BLOCK[lang]}\n`);
}

function retryPrompt(sPrompt, ratio, lang) {
  const suffix = RETRY[lang].replace('{ratio}', String(Math.round(ratio * 100)));
  const last = sPrompt.lastIndexOf(OUTPUT_MARKER[lang]);
  if (last < 0) throw new Error('output marker missing');
  return sPrompt.slice(0, last) + `${suffix}\n` + sPrompt.slice(last);
}

const SILENT = { warn() {}, info() {}, error() {}, debug() {}, log() {} };

function extractBody(raw) {
  const body = cleanRewriteOutput(raw, { logger: SILENT });
  return typeof body === 'string' ? body.trim() : '';
}

// ---------------------------------------------------------------------------
// Measures.

function internalScore(text, lang) {
  try {
    const r = scoreText(text, { lang, repoRoot: getRepoRoot() });
    return { signal_score: r.signalScore ?? null, score: r.score ?? null, pattern_hits: r.patternHits ?? null, det_verdict: Number.isFinite(r.score) ? (r.score >= DET_DOCUMENT_THRESHOLD ? 'ai' : 'human') : null };
  } catch (e) {
    return { error: String(e?.message ?? e).slice(0, 200) };
  }
}

function measure(original, body, lang) {
  const warnings = body ? deterministicMeaningGuard(original, body) : [];
  return {
    chars: body ? body.length : null,
    ratio: body ? round(lengthRatio(original, body), 4) : null,
    gate_failed: body ? warnings.length > 0 : null,
    gate_reason: warnings.length ? warnings.join(' | ').slice(0, 200) : null,
    internal: body ? internalScore(body, lang) : null,
    detail: body ? detailStats(original, body) : null,
    trigram_jaccard: body ? round(trigramJaccard(original, body), 4) : null,
  };
}

const round = (v, d = 4) => (Number.isFinite(v) ? Number(v.toFixed(d)) : v);

async function judgeAll(judges, text, lang) {
  const out = {};
  for (const id of judges) out[id] = await judgeOnce(JUDGE_DEFS[id], text, lang);
  return out;
}

function resolveJudges(log) {
  if (process.env.S4_JUDGES) return process.env.S4_JUDGES.split(',').map((s) => s.trim()).filter(Boolean);
  if (process.env.S4_USE_GROK === '1') return ['judge-gpt', 'judge-grok'];
  if (!existsSync(VERDICT)) throw new Error('bridge-verdict.json missing — run rewrite-efficacy-study4-bridge.mjs first (registered admission rule)');
  const verdict = JSON.parse(readFileSync(VERDICT, 'utf8'));
  log(`bridge verdict ${verdict.label}: judges ${verdict.judges.join(', ')} (AUC gemini ${verdict.auc_gemini?.toFixed?.(3)}, rho gemini-gpt ${verdict.spearman_gemini_gpt?.toFixed?.(3)} vs grok-gpt ${verdict.spearman_grok_gpt?.toFixed?.(3)})`);
  return verdict.judges;
}

// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (!existsSync(LOG)) writeFileSync(LOG, '');
  const log = makeLogger(LOG);
  const lang = STAGE;
  const assets = loadAssets(lang);
  const templateSha = sha(productionPrompt('PROBE', assets, lang));
  const blockSha = sha(BLOCK[lang]);
  const retrySha = sha(RETRY[lang]);
  const judges = resolveJudges(log);
  for (const id of judges) if (!JUDGE_DEFS[id]) throw new Error(`unknown judge ${id}`);

  let s1Rows = readJsonl(join(S1_DIR, `s1-rows-${S1_ARM}.jsonl`)).filter((r) => r.original_sha);
  let texts = loadS1Texts(S1_ARM);
  if (SMOKE_FILE) {
    const smokeText = readFileSync(SMOKE_FILE, 'utf8').trim();
    const smokeSha = sha(smokeText);
    s1Rows = [{ original_sha: smokeSha, source_class: 'ai', pair_id: 'smoke', model_family: 'synthetic', register: 'smoke' }];
    texts = new Map([[smokeSha, { original: smokeText }]]);
    log(`SMOKE MODE — synthetic paragraph ${smokeSha}; outputs go to ${PREFIX}-* files and are not study data`);
  }
  const limit = Number(process.env.S4_LIMIT) > 0 ? Number(process.env.S4_LIMIT) : Infinity;
  log(`study4 start — stage ${STAGE} (S1 arm ${S1_ARM}); template ${templateSha} block ${blockSha} retry ${retrySha}; prompt mode ${assets.promptMode}; model ${REWRITER_MODEL}; judges ${judges.join(',')}; ${s1Rows.length} rows; limit ${limit === Infinity ? 'none' : limit}`);

  // Panel v2 fresh-corpus gate on det scores recomputed NOW over the corpus originals.
  const detRows = [];
  for (const r of s1Rows) {
    const t = texts.get(r.original_sha);
    if (!t?.original) continue;
    const s = internalScore(t.original, lang);
    if (Number.isFinite(s.score)) detRows.push({ label: r.source_class, score: s.score });
  }
  const fresh = validateFreshCorpus(detRows);
  const detBinaryAllowed = fresh.binaryVerdictsAllowed;
  log(`det fresh-corpus gate: accuracy ${fresh.accuracy.toFixed(3)} (${fresh.correct}/${fresh.total}) at threshold ${fresh.threshold} — binary det verdicts ${detBinaryAllowed ? 'ALLOWED' : 'DISABLED (continuous only)'}`);

  const done = new Set(readJsonl(OUT_JSONL).map((r) => r.original_sha));
  let processed = 0;
  let consecutiveFailures = 0;

  for (const [idx, s1] of s1Rows.entries()) {
    if (done.has(s1.original_sha)) continue;
    if (processed >= limit) { log(`limit ${limit} reached — stopping (resumable)`); break; }
    const stored = texts.get(s1.original_sha);
    if (!stored?.original) { log(`WARN no stored original for ${s1.original_sha}`); continue; }
    if (consecutiveFailures >= 3) { log('3 consecutive rewrite failures — circuit breaker OPEN, stopping (prune failed rows, then resume)'); break; }
    const label = `S4-${STAGE}/${s1.source_class}/${idx + 1}`;
    processed += 1;
    const original = stored.original;
    const basePrompt = productionPrompt(original, assets, lang);
    const sPrompt = specificityPrompt(basePrompt, lang);

    // Arm P — plain production prompt, single attempt.
    log(`${label}: P rewrite (${original.length} chars)…`);
    const pRes = await claudeCall(basePrompt, { timeout: REWRITE_TIMEOUT_MS });
    const pBody = pRes.text ? extractBody(pRes.text) : '';
    const pError = pRes.error || (pBody ? null : 'empty body');
    if (pError) log(`${label}: P FAILED — ${pError}`);

    // Arm S — constraint block + enforced floor with capped feedback retries.
    const attempts = [];
    let sBody = '';
    let sError = null;
    let prompt = sPrompt;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      log(`${label}: S rewrite attempt ${attempt}…`);
      const res = await claudeCall(prompt, { timeout: REWRITE_TIMEOUT_MS });
      const body = res.text ? extractBody(res.text) : '';
      if (res.error || !body) { sError = res.error || 'empty body'; log(`${label}: S attempt ${attempt} FAILED — ${sError}`); break; }
      sError = null;
      sBody = body;
      const ratio = lengthRatio(original, body);
      attempts.push({ attempt, chars: body.length, ratio: round(ratio, 4), rewrite_sha: sha(body) });
      if (ratio >= FLOOR) break;
      if (attempt < MAX_ATTEMPTS) prompt = retryPrompt(sPrompt, ratio, lang);
    }
    if (!sBody && !sError) sError = 'no attempt produced a body';
    const failed = Boolean(pError || sError);
    consecutiveFailures = failed ? consecutiveFailures + 1 : 0;

    const pMeasure = pBody ? measure(original, pBody, lang) : null;
    const sMeasure = sBody ? measure(original, sBody, lang) : null;
    if (pMeasure?.gate_failed) log(`${label}: P MEANING GATE FAILED — ${pMeasure.gate_reason}`);
    if (sMeasure?.gate_failed) log(`${label}: S MEANING GATE FAILED — ${sMeasure.gate_reason}`);

    let pJudges = null;
    let sJudges = null;
    if (pBody) { log(`${label}: judging P…`); pJudges = await judgeAll(judges, pBody, lang); }
    if (sBody) { log(`${label}: judging S…`); sJudges = await judgeAll(judges, sBody, lang); }

    const row = {
      arm: 'S4',
      stage: STAGE,
      s1_arm: S1_ARM,
      template_sha: templateSha,
      block_sha: blockSha,
      retry_sha: retrySha,
      rewriter_model: REWRITER_MODEL,
      prompt_mode: assets.promptMode,
      judges_used: judges,
      det_binary_allowed: detBinaryAllowed,
      source_class: s1.source_class,
      pair_id: s1.pair_id,
      model_family: s1.model_family,
      register: s1.register,
      original_sha: s1.original_sha,
      original_chars: original.length,
      original_detail_count: detailStats(original, '').orig_count,
      P: { rewrite_sha: pBody ? sha(pBody) : null, error: pError, ...(pMeasure ?? {}), judges: pJudges },
      S: { rewrite_sha: sBody ? sha(sBody) : null, error: sError, attempts, floor_met: attempts.length ? attempts.at(-1).ratio >= FLOOR : null, ...(sMeasure ?? {}), judges: sJudges },
      collapsed_original_chars: collapse(original).length,
    };
    appendFileSync(OUT_JSONL, JSON.stringify(row) + '\n');
    appendFileSync(TEXTS_JSONL, JSON.stringify({
      original_sha: s1.original_sha, source_class: s1.source_class, original,
      P: pBody || null, S: sBody || null, S_attempts: attempts.map((a) => a.rewrite_sha),
    }) + '\n');
    const jl = (j) => judges.map((id) => `${id.replace('judge-', '')} ${j?.[id]?.ai_likeness ?? '?'}`).join(' ');
    log(`${label}: done — P ratio ${pMeasure?.ratio ?? '?'} [${jl(pJudges)}] | S ratio ${sMeasure?.ratio ?? '?'} attempts ${attempts.length} floor ${row.S.floor_met} [${jl(sJudges)}]`);
  }
  log('study4 runner pass complete');
}

main().catch((e) => { console.error(e?.stack ?? e); process.exit(1); });

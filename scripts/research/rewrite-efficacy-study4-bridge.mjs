// Study 4 judge bridge: gemini scores the 108 archived Study 1 Arm-D passages
// (54 originals + 54 S1 rewrites) with the Study 1 judge prompt, so the
// registered admission rule can be applied BEFORE any Study 4 row exists:
//   admit iff AUC(gemini | 27 AI vs 27 human originals) >= 0.85
//        AND Spearman(gemini, gpt | 108) >= Spearman(grok, gpt | same 108) - 0.10
// (docs/research/2026-rewrite-efficacy-prereg.md, "Study 4" > Judges).
// Bridge scores are not study data. Raw text is read from the ignored S1 store.

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  JUDGE_DEFS, OUT_DIR, S1_DIR, auc, judgeOnce, loadS1Texts, makeLogger, readJsonl, spearman,
} from './study4-common.mjs';

// BRIDGE_JUDGE selects the candidate (default: the original gemini CLI judge).
const JUDGE_ID = process.env.BRIDGE_JUDGE || 'judge-gemini';
const JUDGE = JUDGE_DEFS[JUDGE_ID];
if (!JUDGE) throw new Error(`unknown bridge judge ${JUDGE_ID}`);
const SUFFIX = JUDGE_ID === 'judge-gemini' ? '' : `-${JUDGE_ID.replace(/^judge-/u, '')}`;
const ROWS = join(OUT_DIR, `bridge-gemini${SUFFIX}.jsonl`.replace('bridge-gemini-', 'bridge-'));
const VERDICT = join(OUT_DIR, `bridge-verdict${SUFFIX}.json`);
const LOG = join(OUT_DIR, `bridge-run${SUFFIX}.log`);
const RULE = { min_auc: 0.85, spearman_slack: 0.10, reference: 'grok-vs-gpt on the same passages' };

function analyze(log) {
  const rows = readJsonl(ROWS).filter((r) => r.gemini && Number.isFinite(r.gemini.ai_likeness));
  const originals = rows.filter((r) => r.cond === 'original');
  const pos = originals.filter((r) => r.source_class === 'ai').map((r) => r.gemini.ai_likeness);
  const neg = originals.filter((r) => r.source_class === 'human').map((r) => r.gemini.ai_likeness);
  const both = rows.filter((r) => Number.isFinite(r.gpt?.ai_likeness) && Number.isFinite(r.grok?.ai_likeness));
  const rhoGeminiGpt = spearman(both.map((r) => r.gemini.ai_likeness), both.map((r) => r.gpt.ai_likeness));
  const rhoGrokGpt = spearman(both.map((r) => r.grok.ai_likeness), both.map((r) => r.gpt.ai_likeness));
  const rhoGeminiGrok = spearman(both.map((r) => r.gemini.ai_likeness), both.map((r) => r.grok.ai_likeness));
  const aucGemini = auc(pos, neg);
  const aucGpt = auc(originals.filter((r) => r.source_class === 'ai').map((r) => r.gpt?.ai_likeness).filter(Number.isFinite), originals.filter((r) => r.source_class === 'human').map((r) => r.gpt?.ai_likeness).filter(Number.isFinite));
  const aucGrok = auc(originals.filter((r) => r.source_class === 'ai').map((r) => r.grok?.ai_likeness).filter(Number.isFinite), originals.filter((r) => r.source_class === 'human').map((r) => r.grok?.ai_likeness).filter(Number.isFinite));
  const complete = rows.length;
  const admitted = complete >= 100 && aucGemini !== null && rhoGeminiGpt !== null && rhoGrokGpt !== null
    && aucGemini >= RULE.min_auc && rhoGeminiGpt >= rhoGrokGpt - RULE.spearman_slack;
  const verdict = {
    computed_at: new Date().toISOString(),
    rule: RULE,
    passages_scored: complete,
    originals: originals.length,
    n_ai: pos.length,
    n_human: neg.length,
    auc_gemini: aucGemini,
    auc_gpt_reference: aucGpt,
    auc_grok_reference: aucGrok,
    n_paired: both.length,
    spearman_gemini_gpt: rhoGeminiGpt,
    spearman_grok_gpt: rhoGrokGpt,
    spearman_gemini_grok: rhoGeminiGrok,
    candidate: JUDGE_ID,
    admitted,
    judges: admitted ? ['judge-gpt', JUDGE_ID] : ['judge-gpt'],
    label: admitted ? 'panel-v2-deviation-gemini' : 'single-perceptual-judge',
  };
  writeFileSync(VERDICT, JSON.stringify(verdict, null, 2) + '\n');
  log(`bridge verdict [${JUDGE_ID}]: scored ${complete}/108; AUC gemini ${fmt(aucGemini)} (gpt ${fmt(aucGpt)}, grok ${fmt(aucGrok)}); rho gemini-gpt ${fmt(rhoGeminiGpt)} vs grok-gpt ${fmt(rhoGrokGpt)} (gemini-grok ${fmt(rhoGeminiGrok)}); admitted=${admitted}`);
  return verdict;
}

const fmt = (v) => (v === null || v === undefined ? 'n/a' : v.toFixed(3));

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (!existsSync(LOG)) writeFileSync(LOG, '');
  const log = makeLogger(LOG);
  if (process.argv.includes('--analyze')) { analyze(log); return; }

  const s1Rows = readJsonl(join(S1_DIR, 's1-rows-D.jsonl'));
  const texts = loadS1Texts('D');
  const passages = [];
  for (const r of s1Rows) {
    const t = texts.get(r.original_sha);
    if (!t?.original) { log(`WARN no stored original for ${r.original_sha}`); continue; }
    passages.push({ key: `${r.original_sha}:original`, original_sha: r.original_sha, cond: 'original', source_class: r.source_class, text: t.original, archived: r.judges?.original ?? {} });
    if (r.rewrite_sha && t.rewritten) passages.push({ key: `${r.original_sha}:rewrite`, original_sha: r.original_sha, cond: 'rewrite', source_class: r.source_class, text: t.rewritten, archived: r.judges?.rewrite ?? {} });
  }
  const done = new Set(readJsonl(ROWS).filter((r) => r.gemini && Number.isFinite(r.gemini.ai_likeness)).map((r) => r.key));
  log(`bridge start [${JUDGE_ID}] — ${passages.length} passages, ${done.size} already scored`);
  let failures = 0;
  for (const p of passages) {
    if (done.has(p.key)) continue;
    const gemini = await judgeOnce(JUDGE, p.text, 'ko');
    if (gemini.error) {
      failures += 1;
      log(`${p.key}: gemini FAILED — ${gemini.error}`);
      if (failures >= 5) { log('5 gemini failures — stopping (resumable)'); break; }
      continue;
    }
    failures = 0;
    appendFileSync(ROWS, JSON.stringify({
      key: p.key, original_sha: p.original_sha, cond: p.cond, source_class: p.source_class,
      gemini, gpt: p.archived['judge-gpt'] ?? null, grok: p.archived['judge-grok'] ?? null, kimi: p.archived['judge-kimi'] ?? null,
    }) + '\n');
    log(`${p.key} (${p.source_class}): gemini ${gemini.ai_likeness} | gpt ${p.archived['judge-gpt']?.ai_likeness ?? '?'} grok ${p.archived['judge-grok']?.ai_likeness ?? '?'}`);
  }
  analyze(log);
}

main().catch((e) => { console.error(e); process.exit(1); });

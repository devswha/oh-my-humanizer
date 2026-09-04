// Analysis for rewrite-efficacy Study 4. Applies the decision rules fixed in
// docs/research/2026-rewrite-efficacy-prereg.md ("Study 4") to
// artifacts/rewrite-efficacy-study4/s4-rows-<stage>.jsonl. Prints Markdown.
// Usage: node scripts/research/rewrite-efficacy-study4-analyze.mjs [ko|en]

import { join } from 'node:path';

import { OUT_DIR, S1_DIR, bootstrapCI, mcnemarExact, mean, readJsonl } from './study4-common.mjs';

const STAGE = process.argv[2] === 'en' ? 'en' : 'ko';
const S1_ARM = STAGE === 'ko' ? 'D' : 'A1';
const CUE_RUBRIC = [
  ['structure', /구조|구성|서사|전개|문단|나열|체크리스트|병렬|틀|정리|결론|arc|structure|paragraph|parallel|list|checklist|scaffold|outline|organi[sz]|symmetr|template|tidy|resol/iu],
  ['lexical', /어휘|단어|표현|용어|상투|클리셰|vocab|word|phrase|lexic|cliche|jargon|buzz/iu],
  ['specificity-absence', /구체|추상|일반|generic|abstract|vague|specific|detail|concrete/iu],
];
const classifyCue = (cue) => CUE_RUBRIC.find(([, re]) => re.test(cue || ''))?.[0] ?? 'other';

const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? 'n/a' : Number(v).toFixed(d));
const pct = (v) => (v === null || v === undefined ? 'n/a' : `${(v * 100).toFixed(1)}%`);
const fmtCI = (ci) => (ci ? `[${fmt(ci[0])}, ${fmt(ci[1])}]` : '[n/a]');
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };

function panelScore(judgeBlock, judges) {
  const vals = judges.map((id) => judgeBlock?.[id]?.ai_likeness).filter(Number.isFinite);
  return vals.length === judges.length && judges.length ? mean(vals) : null;
}

function main() {
  const rows = readJsonl(join(OUT_DIR, `s4-rows-${STAGE}.jsonl`));
  const s1 = new Map(readJsonl(join(S1_DIR, `s1-rows-${S1_ARM}.jsonl`)).map((r) => [r.original_sha, r]));
  const judges = rows[0]?.judges_used ?? [];
  const out = [];
  out.push(`# Rewrite-efficacy Study 4 — ${STAGE} stage — analysis`);
  out.push('');
  out.push(`- rows: ${rows.length}; judges: ${judges.join(', ')}; det binary ${rows[0]?.det_binary_allowed ? 'allowed' : 'disabled'}; template ${rows[0]?.template_sha} block ${rows[0]?.block_sha} retry ${rows[0]?.retry_sha}; model ${rows[0]?.rewriter_model}`);
  const failed = rows.filter((r) => r.P?.error || r.S?.error);
  if (failed.length) out.push(`- ⚠ fail-soft rows present (${failed.length}) — prune and resume before reading results`);

  for (const cls of ['ai', 'human']) {
    const subset = rows.filter((r) => r.source_class === cls && r.P?.rewrite_sha && r.S?.rewrite_sha);
    const d = []; const pS = []; const sS = []; let lost = 0;
    const ratioP = []; const ratioS = []; const retP = []; const retS = []; const addP = []; const addS = []; const jacP = []; const jacS = [];
    const detP = []; const detS = []; let floorMet = 0; let attemptsSum = 0;
    let b = 0; let c = 0; let aiP = 0; let aiS = 0; let calls = 0;
    const gptOnly = { s1: [], P: [], S: [] };
    for (const r of subset) {
      const p = panelScore(r.P.judges, judges); const s = panelScore(r.S.judges, judges);
      if (p === null || s === null) { lost += 1; continue; }
      d.push(s - p); pS.push(p); sS.push(s);
      ratioP.push(r.P.ratio); ratioS.push(r.S.ratio);
      if (r.P.detail?.retention !== null) retP.push(r.P.detail.retention);
      if (r.S.detail?.retention !== null) retS.push(r.S.detail.retention);
      addP.push(r.P.detail?.added ?? 0); addS.push(r.S.detail?.added ?? 0);
      jacP.push(r.P.trigram_jaccard); jacS.push(r.S.trigram_jaccard);
      if (Number.isFinite(r.P.internal?.score) && Number.isFinite(r.S.internal?.score)) { detP.push(r.P.internal.score); detS.push(r.S.internal.score); }
      if (r.S.floor_met) floorMet += 1;
      attemptsSum += r.S.attempts?.length ?? 0;
      for (const id of judges) {
        const pa = r.P.judges?.[id]?.authorship; const sa = r.S.judges?.[id]?.authorship;
        if (!pa || !sa) continue;
        calls += 1; if (pa === 'ai') aiP += 1; if (sa === 'ai') aiS += 1;
        if (pa === 'ai' && sa !== 'ai') b += 1; if (pa !== 'ai' && sa === 'ai') c += 1;
      }
      const base = s1.get(r.original_sha)?.judges?.rewrite?.['judge-gpt']?.ai_likeness;
      const pg = r.P.judges?.['judge-gpt']?.ai_likeness; const sg = r.S.judges?.['judge-gpt']?.ai_likeness;
      if (Number.isFinite(base) && Number.isFinite(pg) && Number.isFinite(sg)) { gptOnly.s1.push(base); gptOnly.P.push(pg); gptOnly.S.push(sg); }
    }
    const ci = bootstrapCI(d);
    out.push('', `## ${cls} documents (n=${d.length}${lost ? `, judge-lost ${lost}` : ''})`, '');
    out.push(`- panel score P ${fmt(mean(pS))} → S ${fmt(mean(sS))}; paired d = S − P: **${fmt(mean(d))} ${fmtCI(ci)}**`);
    if (cls === 'ai') {
      const supported = ci && ci[1] < 0 && mean(d) <= -3;
      out.push(`- **H-4b-a (primary): ${supported ? 'SUPPORTED' : 'NOT SUPPORTED'}** (needs mean d ≤ −3 AND CI upper < 0)`);
      const mc = mcnemarExact(b, c);
      out.push(`- H-4b-b AI-call rate (per judge call): P ${pct(calls ? aiP / calls : null)} → S ${pct(calls ? aiS / calls : null)}; discordant P-only-ai ${b} / S-only-ai ${c}; exact McNemar p = ${fmt(mc.p, 3)}`);
    } else {
      const harmed = ci && ci[0] > 0;
      out.push(`- guard rail 2 (human over-editing): ${harmed ? '**VIOLATED** (CI excludes 0, positive)' : 'held'}`);
    }
    out.push(`- length ratio: P ${fmt(mean(ratioP), 3)} → S ${fmt(mean(ratioS), 3)}; H-4b-d floor met (S ≥ 0.98): ${floorMet}/${d.length} (${pct(d.length ? floorMet / d.length : null)}; target ≥ 80%); mean S attempts ${fmt(d.length ? attemptsSum / d.length : null, 2)}`);
    out.push(`- H-4b-c detail retention: P ${pct(mean(retP))} → S ${pct(mean(retS))} (n with details ${retS.length}); added detail tokens/doc: P ${fmt(mean(addP), 2)} → S ${fmt(mean(addS), 2)} → guard rail 3 (S − P ≤ 1.0): ${mean(addS) - mean(addP) <= 1.0 ? 'held' : '**VIOLATED**'}`);
    out.push(`- copy check (trigram Jaccard vs original, median): P ${fmt(median(jacP), 3)} / S ${fmt(median(jacS), 3)}${median(jacS) > 0.9 && !(median(jacP) > 0.9) ? ' — **S reads as "rewrote less"**' : ''}`);
    if (detP.length) { const dd = detS.map((v, i) => v - detP[i]); out.push(`- det chief continuous: P ${fmt(mean(detP))} → S ${fmt(mean(detS))}; paired ${fmt(mean(dd))} ${fmtCI(bootstrapCI(dd))}`); }
    if (gptOnly.s1.length) out.push(`- descriptive gpt-only: S1 rw1 ${fmt(mean(gptOnly.s1))} | P ${fmt(mean(gptOnly.P))} | S ${fmt(mean(gptOnly.S))} (n=${gptOnly.s1.length})`);
  }

  const gated = rows.filter((r) => r.S?.rewrite_sha && r.S.gate_failed !== null && r.S.gate_failed !== undefined);
  const pass = gated.filter((r) => r.S.gate_failed === false).length;
  const expected = STAGE === 'ko' ? 54 : 42;
  out.push('', '## guard rail 1 — deterministic meaning gate on S', '');
  out.push(`- pass ${pass}/${gated.length} (${pct(gated.length ? pass / gated.length : null)}) — pre-registered ≥ 95% → ${gated.length < expected ? 'incomplete run' : pass / gated.length >= 0.95 ? 'held' : '**VIOLATED**'}`);
  for (const r of gated.filter((x) => x.S.gate_failed)) out.push(`  - S gate fail — ${r.pair_id}: ${r.S.gate_reason}`);
  const gatedP = rows.filter((r) => r.P?.rewrite_sha && r.P.gate_failed !== null);
  out.push(`- (P for reference: ${gatedP.filter((r) => r.P.gate_failed === false).length}/${gatedP.length} pass)`);

  for (const arm of ['P', 'S']) {
    const cues = rows.filter((r) => r.source_class === 'ai' && r[arm]?.judges)
      .flatMap((r) => judges.map((id) => r[arm].judges[id])).filter((j) => j && j.authorship === 'ai' && j.strongest_cue);
    const counts = {};
    for (const j of cues) { const k = classifyCue(j.strongest_cue); counts[k] = (counts[k] ?? 0) + 1; }
    out.push('', `## cue mix — still-"ai" judgments on ${arm} (AI docs, n=${cues.length})`, '', `- ${JSON.stringify(counts)}; structural share ${pct(cues.length ? (counts.structure ?? 0) / cues.length : null)}`);
  }
  console.log(out.join('\n'));
}

main();

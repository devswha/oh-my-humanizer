// Study 4: add an admitted judge's scores to existing rows from the stored
// private P/S bodies (rows finished before the judge was admitted), and set
// judges_used accordingly. Usage:
//   node scripts/research/rewrite-efficacy-study4-rejudge.mjs <judge-id> [ko|en]
// Only rows missing that judge on P or S are touched; scores already present
// are never overwritten.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { JUDGE_DEFS, OUT_DIR, judgeOnce, makeLogger, readJsonl } from './study4-common.mjs';

const JUDGE_ID = process.argv[2];
const STAGE = process.argv[3] === 'en' ? 'en' : 'ko';
const JUDGE = JUDGE_DEFS[JUDGE_ID];
if (!JUDGE) throw new Error(`unknown judge ${JUDGE_ID}`);
const ROWS = join(OUT_DIR, `s4-rows-${STAGE}.jsonl`);
const TEXTS = join(OUT_DIR, `s4-texts-${STAGE}.private.jsonl`);
const LOG = join(OUT_DIR, `s4-run-${STAGE}.log`);

async function main() {
  const log = makeLogger(LOG);
  const rows = readJsonl(ROWS);
  const texts = new Map(readJsonl(TEXTS).map((t) => [t.original_sha, t]));
  let touched = 0;
  let failures = 0;
  for (const row of rows) {
    const t = texts.get(row.original_sha);
    for (const arm of ['P', 'S']) {
      if (!row[arm]?.rewrite_sha || row[arm]?.judges?.[JUDGE_ID]?.ai_likeness !== undefined) continue;
      const body = t?.[arm];
      if (!body) { log(`rejudge ${JUDGE_ID}: no stored ${arm} body for ${row.original_sha}`); continue; }
      const verdict = await judgeOnce(JUDGE, body, STAGE);
      row[arm].judges = { ...(row[arm].judges ?? {}), [JUDGE_ID]: verdict };
      if (verdict.error) { failures += 1; log(`rejudge ${JUDGE_ID}: ${row.pair_id} ${arm} FAILED — ${verdict.error}`); }
      else touched += 1;
    }
    if (!row.judges_used.includes(JUDGE_ID)) row.judges_used = [...row.judges_used, JUDGE_ID];
    // Write after every row so a crash loses at most one document.
    writeFileSync(ROWS, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  }
  log(`rejudge ${JUDGE_ID} (${STAGE}): ${touched} bodies scored, ${failures} failures, ${rows.length} rows`);
  if (failures) process.exit(2);
}

main().catch((e) => { console.error(e?.stack ?? e); process.exit(1); });

#!/usr/bin/env bash
# Study 4 supervisor: run the resumable runner until every corpus row is clean
# (both arms rewritten, every admitted judge parsed on both). Between passes,
# prune fail-soft rows so resume retries them; back off 30 min to ride out
# claude window exhaustion. Usage: S4_STAGE=ko|en scripts/research/rewrite-efficacy-study4-loop.sh
set -u
cd "$(dirname "$0")/../.."
STAGE="${S4_STAGE:-ko}"
EXPECTED="${S4_EXPECTED:-$([ "$STAGE" = "en" ] && echo 42 || echo 54)}"
ROWS="artifacts/rewrite-efficacy-study4/s4-rows-${STAGE}.jsonl"
LOG="artifacts/rewrite-efficacy-study4/s4-run-${STAGE}.log"
mkdir -p artifacts/rewrite-efficacy-study4

for pass in $(seq 1 48); do
  echo "[loop] pass $pass" >> "$LOG"
  S4_STAGE="$STAGE" S4_JUDGES="${S4_JUDGES:-}" node scripts/research/rewrite-efficacy-study4.mjs >> "artifacts/rewrite-efficacy-study4/s4-stdout-${STAGE}.log" 2>&1
  node -e '
    const fs = require("fs");
    const [p, expected] = [process.argv[1], Number(process.argv[2])];
    if (!fs.existsSync(p)) process.exit(0);
    const rows = fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map(JSON.parse);
    const clean = (r) => !r.P?.error && !r.S?.error && r.P?.rewrite_sha && r.S?.rewrite_sha
      && (r.judges_used || []).every((id) => Number.isFinite(r.P?.judges?.[id]?.ai_likeness) && Number.isFinite(r.S?.judges?.[id]?.ai_likeness));
    const good = rows.filter(clean);
    if (good.length !== rows.length) {
      fs.writeFileSync(p, good.map((r) => JSON.stringify(r)).join("\n") + (good.length ? "\n" : ""));
      console.log(`[loop] pruned ${rows.length - good.length} fail-soft rows`);
    }
    process.exit(good.length >= expected ? 42 : 0);
  ' "$ROWS" "$EXPECTED" >> "$LOG" 2>&1
  if [ $? -eq 42 ]; then echo "[loop] all $EXPECTED rows clean — done" >> "$LOG"; exit 0; fi
  echo "[loop] incomplete after pass $pass — sleeping 30m before resume" >> "$LOG"
  sleep 1800
done
echo "[loop] gave up after 48 passes" >> "$LOG"
exit 1

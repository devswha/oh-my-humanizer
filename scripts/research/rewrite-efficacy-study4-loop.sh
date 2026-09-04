#!/usr/bin/env bash
# Study 4 supervisor: run the resumable runner until every corpus row is clean
# (both arms rewritten, every admitted judge parsed on both). Between passes,
# prune fail-soft rows so resume retries them. Back-off is reset-aware: when
# the last pass died on claude's "session limit · resets Xam/pm (Asia/Seoul)"
# message, sleep until that time (+90 s, capped at 6 h) instead of 30 min, so
# idle passes do not burn the pass budget. Usage:
#   S4_STAGE=ko|en S4_JUDGES=judge-gpt,judge-gemini-3.7-flash scripts/research/rewrite-efficacy-study4-loop.sh
set -u
cd "$(dirname "$0")/../.."
STAGE="${S4_STAGE:-ko}"
EXPECTED="${S4_EXPECTED:-$([ "$STAGE" = "en" ] && echo 42 || echo 54)}"
ROWS="artifacts/rewrite-efficacy-study4/s4-rows-${STAGE}.jsonl"
LOG="artifacts/rewrite-efficacy-study4/s4-run-${STAGE}.log"
MAX_PASSES="${S4_MAX_PASSES:-240}"
mkdir -p artifacts/rewrite-efficacy-study4

reset_sleep_seconds() {
  # Look at the tail of this pass's log for a session-limit message; print
  # seconds until the stated KST reset (+90 s), or nothing.
  local msg tok now target
  msg=$(tail -n 40 "$LOG" | grep -o "resets [0-9]\{1,2\}\(:[0-9]\{2\}\)\?[ap]m (Asia/Seoul)" | tail -1) || true
  [ -n "$msg" ] || return 0
  tok=$(echo "$msg" | sed -E 's/resets ([0-9:]+[ap]m).*/\1/')
  now=$(date +%s)
  target=$(TZ=Asia/Seoul date -d "today $tok" +%s 2>/dev/null) || return 0
  if [ "$target" -le "$now" ]; then target=$(TZ=Asia/Seoul date -d "tomorrow $tok" +%s 2>/dev/null) || return 0; fi
  local delta=$((target - now + 90))
  [ "$delta" -gt 21600 ] && delta=21600
  [ "$delta" -lt 60 ] && delta=60
  echo "$delta"
}

for pass in $(seq 1 "$MAX_PASSES"); do
  echo "[loop] pass $pass" >> "$LOG"
  before=$(wc -l < "$LOG")
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
  wait_s=1800
  if tail -n +"$before" "$LOG" | grep -q "session limit"; then
    rs=$(reset_sleep_seconds); [ -n "${rs:-}" ] && wait_s=$rs
  fi
  echo "[loop] incomplete after pass $pass — sleeping ${wait_s}s before resume" >> "$LOG"
  sleep "$wait_s"
done
echo "[loop] gave up after $MAX_PASSES passes" >> "$LOG"
exit 1

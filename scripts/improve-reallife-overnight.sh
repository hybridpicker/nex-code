#!/bin/bash
# scripts/improve-reallife-overnight.sh — Overnight real-life improvement loop
#
# Runs the autoresearch-style improvement loop with budget constraints.
# Designed for unattended overnight execution.
#
# Usage:
#   ./scripts/improve-reallife-overnight.sh [model]
#   nohup ./scripts/improve-reallife-overnight.sh &

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$SCRIPT_DIR/benchmark-results"
DATE=$(date +%Y%m%d)
LOG_FILE="$RESULTS_DIR/overnight-$DATE.log"
MODEL="${1:-devstral-2:123b}"
MAX_PASSES=20
TOKEN_BUDGET=500000

mkdir -p "$RESULTS_DIR"

echo "═══════════════════════════════════════════════════" | tee "$LOG_FILE"
echo "  nex-code Real-Life Overnight Improvement"          | tee -a "$LOG_FILE"
echo "  $(date)"                                           | tee -a "$LOG_FILE"
echo "  Model: $MODEL"                                     | tee -a "$LOG_FILE"
echo "  Max passes: $MAX_PASSES"                           | tee -a "$LOG_FILE"
echo "  Token budget: $TOKEN_BUDGET"                       | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════" | tee -a "$LOG_FILE"

cd "$ROOT"

# Ensure dist is built
if [ ! -f dist/nex-code.js ]; then
  echo "Building dist..." | tee -a "$LOG_FILE"
  npm run build 2>&1 | tee -a "$LOG_FILE"
fi

# Run the improvement loop
node scripts/improve-reallife.js \
  --model "$MODEL" \
  --max-passes "$MAX_PASSES" \
  --budget "$TOKEN_BUDGET" \
  2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo "" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  Finished at $(date) (exit: $EXIT_CODE)"            | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════════════" | tee -a "$LOG_FILE"

# Send notification with result summary
LATEST=$(ls -t "$RESULTS_DIR"/reallife-*.json 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
  SCORE=$(node -e "try{const r=JSON.parse(require('fs').readFileSync('$LATEST','utf8'));console.log(Math.round(r.overall||r.score||0))}catch{console.log('?')}")
  "$SCRIPT_DIR/notify.sh" "Overnight improvement done — score: ${SCORE}/100, exit: ${EXIT_CODE}" 2>/dev/null || true
else
  "$SCRIPT_DIR/notify.sh" "Overnight improvement done — exit: ${EXIT_CODE}" 2>/dev/null || true
fi

exit $EXIT_CODE

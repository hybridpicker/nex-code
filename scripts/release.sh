#!/bin/bash
# scripts/release.sh — Automated release checklist
#
# Runs all pre-release checks in order, then merges to main:
#   1. npm run build
#   2. npm test
#   3. Full real-life benchmark (35 tasks)
#   4. Verify score >= threshold
#   5. npm run merge-to-main (CI-gated merge + publish)
#
# Usage:
#   npm run release              # full pipeline
#   npm run release -- --skip-bench   # skip benchmark (tests only)
#
# The merge-to-main step handles: CI wait, merge, version bump, npm publish.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

SCORE_THRESHOLD=85
SKIP_BENCH=false

for arg in "$@"; do
  case "$arg" in
    --skip-bench) SKIP_BENCH=true ;;
    --threshold=*) SCORE_THRESHOLD="${arg#--threshold=}" ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || true)
if [ "$CURRENT_BRANCH" != "devel" ]; then
  echo "[release] ERROR: Must be on 'devel' branch (currently on '$CURRENT_BRANCH')"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[release] ERROR: Working tree not clean. Commit or stash first."
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  nex-code Release Pipeline                              ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  1. Build          npm run build                        ║"
echo "║  2. Unit tests     npm test                             ║"
if [ "$SKIP_BENCH" = false ]; then
echo "║  3. Benchmark      35-task real-life suite              ║"
echo "║  4. Score check    >= ${SCORE_THRESHOLD}/100                           ║"
fi
echo "║  5. Merge & publish  npm run merge-to-main              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Build ──────────────────────────────────────────────
echo "━━━ [1/5] Building dist..."
npm run build
echo "    Build complete."

# ── Step 2: Unit tests ────────────────────────────────────────
echo "━━━ [2/5] Running unit tests..."
if ! npm test; then
  echo ""
  echo "[release] FAILED: Unit tests did not pass. Fix and retry."
  exit 1
fi
echo "    Tests passed."

# ── Step 3+4: Benchmark ──────────────────────────────────────
if [ "$SKIP_BENCH" = false ]; then
  echo "━━━ [3/5] Running full real-life benchmark..."

  node scripts/benchmark-reallife.js 2>&1 || true

  # Read score from the latest result file
  LATEST=$(ls -t scripts/benchmark-results/reallife-*.json 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    SCORE=$(node -e "
      try {
        const r = JSON.parse(require('fs').readFileSync('$LATEST','utf8'));
        console.log(Math.round(r.overall || r.score || 0));
      } catch { console.log('0'); }
    ")
  else
    echo "[release] WARNING: No benchmark result file found."
    SCORE=0
  fi

  echo ""
  echo "━━━ [4/5] Score check: ${SCORE}/100 (threshold: ${SCORE_THRESHOLD})"

  if [ "$SCORE" -lt "$SCORE_THRESHOLD" ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  RELEASE BLOCKED — benchmark score too low              ║"
    echo "╠══════════════════════════════════════════════════════════╣"
    echo "║  Score: ${SCORE}/100  (need >= ${SCORE_THRESHOLD})                     ║"
    echo "║  Investigate failing tasks before releasing.            ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    exit 1
  fi
  echo "    Score ${SCORE}/100 — above threshold."
else
  echo "━━━ [3/5] Benchmark skipped (--skip-bench)"
  echo "━━━ [4/5] Score check skipped"
fi

# ── Step 5: Merge to main ────────────────────────────────────
echo "━━━ [5/5] Merging to main (CI-gated)..."
echo ""
# Skip tests and benchmark in pre-push — we just ran them
NEX_SKIP_TESTS=1 NEX_SKIP_BENCHMARK=1 bash scripts/merge-to-main.sh

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Release complete!                                      ║"
echo "║  post-merge hook will bump version and publish to npm.  ║"
echo "╚══════════════════════════════════════════════════════════╝"

# Notify
VERSION=$(node -e "console.log(require('./package.json').version)")
"$(dirname "$0")/notify.sh" "nex-code v${VERSION} released (score: ${SCORE:-?}/100)" 2>/dev/null || true

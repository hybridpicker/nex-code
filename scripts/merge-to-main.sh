#!/bin/bash
# merge-to-main.sh — CI-gated devel→main merge
# Usage: npm run merge-to-main
# Waits for CI to pass on the current devel HEAD, then merges into main.

set -euo pipefail

POLL_INTERVAL=20  # seconds between CI status checks

# Must be run from repo root
cd "$(git rev-parse --show-toplevel)"

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || true)
if [ "$CURRENT_BRANCH" != "devel" ]; then
  echo "[merge-to-main] ERROR: Must be on 'devel' branch (currently on '$CURRENT_BRANCH')"
  exit 1
fi

# Require clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[merge-to-main] ERROR: Working tree is not clean. Commit or stash changes first."
  echo ""
  git status --short
  exit 1
fi

# Require gh CLI
if ! command -v gh &>/dev/null; then
  echo "[merge-to-main] ERROR: 'gh' CLI not found. Install it and run 'gh auth login'."
  exit 1
fi

# Fetch latest remote state so CI status is up to date
echo "[merge-to-main] Fetching remote..."
git fetch origin devel --quiet

DEVEL_SHA=$(git rev-parse devel)
SHORT_SHA="${DEVEL_SHA:0:8}"

get_ci_status() {
  local json
  json=$(gh run list \
    --branch devel \
    --workflow "CI" \
    --commit "$DEVEL_SHA" \
    --limit 1 \
    --json conclusion,status \
    2>/dev/null || echo "[]")

  echo "$json" | node -e "
const runs = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
if (!runs.length) { console.log('no_run'); process.exit(0); }
const r = runs[0];
if (r.status !== 'completed') { console.log(r.status); } else { console.log(r.conclusion); }
" 2>/dev/null || echo "unknown"
}

echo "[merge-to-main] Waiting for CI on devel @ ${SHORT_SHA}..."

while true; do
  STATUS=$(get_ci_status)

  case "$STATUS" in
    success)
      echo "[merge-to-main] CI passed. Merging devel → main..."
      git checkout main
      git merge devel --no-edit
      echo "[merge-to-main] Merge complete. post-merge hook will handle version bump and publish."
      exit 0
      ;;
    in_progress|queued|waiting|pending)
      echo "[merge-to-main] CI still running (${STATUS}) — checking again in ${POLL_INTERVAL}s..."
      sleep "$POLL_INTERVAL"
      ;;
    failure|cancelled|timed_out|action_required|startup_failure)
      echo "[merge-to-main] CI failed (${STATUS}) for devel @ ${SHORT_SHA}."
      echo "  Fix the failing checks on devel, push, and retry."
      echo "  View details: gh run list --branch devel --workflow CI"
      exit 1
      ;;
    no_run)
      echo "[merge-to-main] No CI run found yet for devel @ ${SHORT_SHA} — waiting ${POLL_INTERVAL}s..."
      sleep "$POLL_INTERVAL"
      ;;
    *)
      echo "[merge-to-main] Unknown CI status: '${STATUS}' — aborting to be safe."
      echo "  Check manually: gh run list --branch devel --workflow CI"
      exit 1
      ;;
  esac
done

#!/bin/bash
# Auto-update nex-code from devel branch — meant to run via cron.
# Pulls latest devel, rebuilds dist/ if there are new commits.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$REPO_DIR/scripts/auto-update.log"
NODE="$(which node)"
NPM="$(which npm)"

exec >> "$LOG_FILE" 2>&1
echo "=== $(date) ==="

cd "$REPO_DIR"

# Guard: don't run if there are uncommitted local changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "SKIP: dirty working tree (uncommitted changes)"
  exit 0
fi

# Fetch latest from origin
git fetch origin devel --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/devel)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "OK: already at latest ($LOCAL)"
  exit 0
fi

echo "PULL: $LOCAL -> $REMOTE"
git pull origin devel --ff-only

echo "BUILD: running npm run build..."
$NODE $NPM run build

echo "DONE: nex-code updated and rebuilt"

#!/bin/bash
# Auto-rebuild dist/nex-code.js when cli/ or bin/ sources change.
# Run via cron every minute.

set -e

REPO="$HOME/Coding/nex-code"
DIST="$REPO/dist/nex-code.js"
LOG="$REPO/scripts/auto-build.log"

cd "$REPO"

# Check if any .js file in cli/ or bin/ is newer than dist/nex-code.js
if [ ! -f "$DIST" ] || find cli/ bin/ -name "*.js" -newer "$DIST" | grep -q .; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') rebuilding..." >> "$LOG"
  npm run build >> "$LOG" 2>&1
  echo "$(date '+%Y-%m-%d %H:%M:%S') done" >> "$LOG"
fi

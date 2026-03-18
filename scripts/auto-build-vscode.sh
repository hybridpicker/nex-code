#!/bin/bash
# Auto-rebuild vscode/out/ when vscode/src/ or vscode/webview/ sources change.
# Run via cron every minute.

set -e

REPO="$HOME/Coding/nex-code"
VSCODE="$REPO/vscode"
OUT="$VSCODE/out/extension.js"
LOG="$VSCODE/auto-build.log"

cd "$VSCODE"

# Check if any source file is newer than out/extension.js
if [ ! -f "$OUT" ] || find src/ webview/ -name "*.ts" -newer "$OUT" | grep -q .; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') rebuilding..." >> "$LOG"
  npm run build >> "$LOG" 2>&1
  echo "$(date '+%Y-%m-%d %H:%M:%S') done" >> "$LOG"
fi

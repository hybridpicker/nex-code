#!/bin/bash
# scripts/notify.sh — Send notification via Matrix (jarvis) or macOS (local)
#
# Usage: ./scripts/notify.sh "message text"
#
# On jarvis (SERVER_SSH_HOST not needed — posts directly):
#   curl -sf http://localhost:3000/matrix/notify
# On Mac (SERVER_SSH_HOST set in env):
#   ssh $SERVER_SSH_HOST curl...
# Fallback: macOS osascript notification

set -euo pipefail

MESSAGE="${1:-nex-code notification}"

# Try direct local Matrix (running on jarvis itself)
if curl -sf -o /dev/null http://localhost:3000/matrix/notify \
  -H 'Content-Type: application/json' \
  -d "{\"message\": $(echo "$MESSAGE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}" 2>/dev/null; then
  exit 0
fi

# Try via SSH (running on Mac)
SSH_HOST="${SERVER_SSH_HOST:-${JARVIS_SSH_HOST:-}}"
if [ -n "$SSH_HOST" ]; then
  PAYLOAD=$(echo "$MESSAGE" | python3 -c 'import json,sys; print(json.dumps({"message": sys.stdin.read().strip()}))')
  TMPFILE=$(mktemp /tmp/nex-notify-XXXXXX.json)
  echo "$PAYLOAD" > "$TMPFILE"
  if ssh -o ConnectTimeout=10 -o BatchMode=yes "$SSH_HOST" \
    "curl -sf -X POST http://localhost:3000/matrix/notify -H 'Content-Type: application/json' -d @-" < "$TMPFILE" 2>/dev/null; then
    rm -f "$TMPFILE"
    exit 0
  fi
  rm -f "$TMPFILE"
fi

# Fallback: macOS notification
if command -v osascript &>/dev/null; then
  SHORT=$(echo "$MESSAGE" | head -c 200)
  osascript -e "display notification \"$SHORT\" with title \"nex-code\"" 2>/dev/null || true
fi

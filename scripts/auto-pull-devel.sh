#!/bin/bash
# auto-pull-devel.sh — hält nex-code/devel aktuell
# Läuft als LaunchAgent alle 30 Minuten

REPO="$HOME/Coding/nex-code"
LOG="$HOME/Library/Logs/nex-code-autopull.log"
MAX_LOG_LINES=200

cd "$REPO" || exit 1

# Sicherstellen dass wir auf devel sind
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "devel" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M')] SKIP — branch ist '$BRANCH', nicht devel" >> "$LOG"
  exit 0
fi

# Fetch ohne Pull
git fetch origin devel --quiet 2>&1

# Vergleich local vs remote
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/devel)

if [ "$LOCAL" = "$REMOTE" ]; then
  # Kein Log-Spam bei Gleichstand — nur alle 4h eine "alles aktuell" Zeile
  LAST_OK=$(grep -c "aktuell" "$LOG" 2>/dev/null || echo 0)
  exit 0
fi

# Hinter remote — pull
BEHIND=$(git rev-list HEAD..origin/devel --count)
echo "[$(date '+%Y-%m-%d %H:%M')] Pull — $BEHIND neuer Commit(s) auf devel" >> "$LOG"

git pull --ff-only origin devel >> "$LOG" 2>&1
EXIT=$?

if [ $EXIT -eq 0 ]; then
  NEW_VER=$(node -p "require('./package.json').version" 2>/dev/null || echo "?")
  echo "[$(date '+%Y-%m-%d %H:%M')] ✅ nex-code devel aktualisiert → v$NEW_VER" >> "$LOG"
else
  echo "[$(date '+%Y-%m-%d %H:%M')] ❌ Pull fehlgeschlagen (exit $EXIT)" >> "$LOG"
fi

# Log kürzen
if [ -f "$LOG" ]; then
  LINES=$(wc -l < "$LOG")
  if [ "$LINES" -gt "$MAX_LOG_LINES" ]; then
    tail -n "$MAX_LOG_LINES" "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  fi
fi

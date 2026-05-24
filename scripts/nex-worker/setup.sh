#!/bin/bash
# scripts/nex-worker/setup.sh — Deploy nex-code improvement automation to nex-worker
#
# Run from Mac:
#   ssh dev-machine
#   cd ~/nex-code && bash scripts/nex-worker/setup.sh
#
# Or remotely:
#   ssh dev-machine 'cd ~/nex-code && bash scripts/nex-worker/setup.sh'
#
# Prerequisites:
#   - nex-code repo cloned at /home/nex-worker/nex-code
#   - Node.js >= 18 installed
#   - Ollama running (for benchmarks)

set -euo pipefail

REPO_DIR="/home/nex-worker/nex-code"
SYSTEMD_DIR="/etc/systemd/system"
JARVIS_DIR="$REPO_DIR/scripts/nex-worker"

echo "═══════════════════════════════════════════════════"
echo "  nex-code NexWorker Setup"
echo "═══════════════════════════════════════════════════"

# Verify we're on nex-worker
if [ "$(whoami)" = "nex-worker" ] || [ "$(whoami)" = "root" ]; then
  echo "[setup] Running as $(whoami) on $(hostname)"
else
  echo "[setup] WARNING: Expected nex-worker or root user, got $(whoami)"
fi

# Verify repo exists
if [ ! -d "$REPO_DIR" ]; then
  echo "[setup] Cloning nex-code repo..."
  git clone https://github.com/hybridpicker/nex-code.git "$REPO_DIR"
fi

cd "$REPO_DIR"
git checkout devel
git pull --ff-only origin devel

# Install dependencies and build
echo "[setup] Installing dependencies..."
npm install --production
npm run build

# Create results directory
mkdir -p scripts/benchmark-results

# Install systemd user units (no sudo needed)
USER_SYSTEMD="$HOME/.config/systemd/user"
mkdir -p "$USER_SYSTEMD"
echo "[setup] Installing systemd user units..."
cp "$JARVIS_DIR/nex-improve.service" "$USER_SYSTEMD/"
cp "$JARVIS_DIR/nex-improve.timer" "$USER_SYSTEMD/"
cp "$JARVIS_DIR/nex-weekly-bench.service" "$USER_SYSTEMD/"
systemctl --user daemon-reload

# Enable lingering so timers run without login
loginctl enable-linger "$(whoami)" 2>/dev/null || true

# Enable and start timers
echo "[setup] Enabling timers..."
systemctl --user enable --now nex-improve.timer
systemctl --user disable --now nex-weekly-bench.timer 2>/dev/null || true

# Setup auto-pull (keep repo in sync with devel)
CRON_LINE="*/30 * * * * cd $REPO_DIR && git fetch origin devel --quiet && git merge --ff-only origin/devel --quiet 2>/dev/null || true"
(crontab -l 2>/dev/null | grep -v "nex-code.*git fetch" || true; echo "$CRON_LINE") | crontab -

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Timers installed:"
echo "    nex-improve.timer     — nightly at 02:00"
echo "    nex-weekly-bench.timer — disabled"
echo "    cron: auto-pull devel  — every 30 min"
echo ""
echo "  Useful commands:"
echo "    systemctl --user status nex-improve.timer"
echo "    systemctl --user status nex-weekly-bench.timer"
echo "    journalctl --user -u nex-improve -f"
echo "    systemctl --user start nex-improve  # run manually now"
echo "═══════════════════════════════════════════════════"

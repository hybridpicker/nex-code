#!/bin/bash
# scripts/jarvis/setup.sh — Deploy nex-code improvement automation to jarvis (almalinux9)
#
# Run from Mac:
#   ssh clawbook
#   cd ~/nex-code && bash scripts/jarvis/setup.sh
#
# Or remotely:
#   ssh clawbook 'cd ~/nex-code && bash scripts/jarvis/setup.sh'
#
# Prerequisites:
#   - nex-code repo cloned at /home/jarvis/nex-code
#   - Node.js >= 18 installed
#   - Ollama running (for benchmarks)

set -euo pipefail

REPO_DIR="/home/jarvis/nex-code"
SYSTEMD_DIR="/etc/systemd/system"
JARVIS_DIR="$REPO_DIR/scripts/jarvis"

echo "═══════════════════════════════════════════════════"
echo "  nex-code Jarvis Setup"
echo "═══════════════════════════════════════════════════"

# Verify we're on jarvis
if [ "$(whoami)" = "jarvis" ] || [ "$(whoami)" = "root" ]; then
  echo "[setup] Running as $(whoami) on $(hostname)"
else
  echo "[setup] WARNING: Expected jarvis or root user, got $(whoami)"
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

# Install systemd units (requires sudo)
echo "[setup] Installing systemd units..."
sudo cp "$JARVIS_DIR/nex-improve.service" "$SYSTEMD_DIR/"
sudo cp "$JARVIS_DIR/nex-improve.timer" "$SYSTEMD_DIR/"
sudo cp "$JARVIS_DIR/nex-weekly-bench.service" "$SYSTEMD_DIR/"
sudo cp "$JARVIS_DIR/nex-weekly-bench.timer" "$SYSTEMD_DIR/"
sudo systemctl daemon-reload

# Enable and start timers
echo "[setup] Enabling timers..."
sudo systemctl enable --now nex-improve.timer
sudo systemctl enable --now nex-weekly-bench.timer

# Setup auto-pull (keep repo in sync with devel)
CRON_LINE="*/30 * * * * cd $REPO_DIR && git fetch origin devel --quiet && git merge --ff-only origin/devel --quiet 2>/dev/null || true"
(crontab -l 2>/dev/null | grep -v "nex-code.*git fetch" || true; echo "$CRON_LINE") | crontab -

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Timers installed:"
echo "    nex-improve.timer     — nightly at 02:00"
echo "    nex-weekly-bench.timer — Saturday at 04:00"
echo "    cron: auto-pull devel  — every 30 min"
echo ""
echo "  Useful commands:"
echo "    systemctl status nex-improve.timer"
echo "    systemctl status nex-weekly-bench.timer"
echo "    journalctl -u nex-improve -f"
echo "    systemctl start nex-improve  # run manually now"
echo "═══════════════════════════════════════════════════"

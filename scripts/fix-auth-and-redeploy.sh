#!/usr/bin/env bash
#
# fix-auth-and-redeploy.sh — run ON the nex-code worker host (almalinux9)
#
# Fixes the "rotated OLLAMA_API_KEY silently shadowed by stale systemd
# EnvironmentFile" outage:
#
#   1. Sync OLLAMA_API_KEY from ~/.nex-code/.env into models-systemd.env
#      and models.env so a worker restart picks up the rotated key.
#   2. Pull the latest devel branch so the new practice-runner guards
#      and the bin/nex-code.js override:true fix are in place.
#   3. Restart nex-worker.service.
#   4. Verify Ollama Cloud auth with a quiet HTTP code probe.
#   5. Tail the worker log for the next practice run.
#
# Never prints a secret. Intermediate files are created with umask 077
# and removed on exit.

set -euo pipefail

# ── config ────────────────────────────────────────────────────────────────
REPO_DIR="${REPO_DIR:-$HOME/Coding/nex-code}"
ENV_SRC="$HOME/.nex-code/.env"
ENV_SYSTEMD="$HOME/.nex-code/models-systemd.env"
ENV_MODELS="$HOME/.nex-code/models.env"
SERVICE="nex-worker.service"

color() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
step()  { color "1;36" "── $* ──"; }
ok()    { color "1;32" "  ok: $*"; }
warn()  { color "1;33" "  warn: $*"; }
die()   { color "1;31" "  fail: $*"; exit 1; }

umask 077
TMPDIR_RUN="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_RUN"' EXIT

# ── preflight ─────────────────────────────────────────────────────────────
step "preflight: source file must exist and contain OLLAMA_API_KEY"
[[ -f "$ENV_SRC" ]]                        || die "$ENV_SRC missing"
grep -q '^OLLAMA_API_KEY=' "$ENV_SRC"      || die "$ENV_SRC has no OLLAMA_API_KEY line"
NEW_LEN=$(awk -F= '/^OLLAMA_API_KEY=/{print length($2); exit}' "$ENV_SRC")
[[ "$NEW_LEN" -ge 20 ]]                    || die "OLLAMA_API_KEY in $ENV_SRC looks too short (len=$NEW_LEN)"
ok "source file has OLLAMA_API_KEY (len=$NEW_LEN)"

# ── 1. sync key into systemd EnvironmentFile(s) ───────────────────────────
step "sync OLLAMA_API_KEY from .env → models-systemd.env + models.env"
sync_key_into() {
  local target="$1"
  [[ -f "$target" ]] || { warn "$target missing — creating"; : > "$target"; chmod 600 "$target"; }

  local old_len=0
  if grep -q '^OLLAMA_API_KEY=' "$target"; then
    old_len=$(awk -F= '/^OLLAMA_API_KEY=/{print length($2); exit}' "$target")
  fi

  local tmp="$TMPDIR_RUN/$(basename "$target").new"
  grep -v '^OLLAMA_API_KEY=' "$target" > "$tmp" || true
  grep    '^OLLAMA_API_KEY=' "$ENV_SRC" >> "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$target"
  chmod 600 "$target"

  if [[ "$old_len" == "$NEW_LEN" ]]; then
    ok "$(basename "$target"): key length unchanged ($NEW_LEN)"
  else
    ok "$(basename "$target"): key length $old_len → $NEW_LEN"
  fi
}
sync_key_into "$ENV_SYSTEMD"
sync_key_into "$ENV_MODELS"

# ── 2. pull latest devel ──────────────────────────────────────────────────
step "git pull devel in $REPO_DIR"
[[ -d "$REPO_DIR/.git" ]] || die "$REPO_DIR is not a git repo"
pushd "$REPO_DIR" >/dev/null

cur_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$cur_branch" != "devel" ]]; then
  warn "current branch is $cur_branch — switching to devel"
  git checkout devel
fi

dirty=$(git status --porcelain)
if [[ -n "$dirty" ]]; then
  warn "worktree dirty — stashing before pull"
  git stash push -u -m "fix-auth-and-redeploy $(date +%s)"
  STASHED=1
else
  STASHED=0
fi

git fetch origin devel
before=$(git rev-parse HEAD)
git reset --hard origin/devel
after=$(git rev-parse HEAD)

if [[ "$before" == "$after" ]]; then
  ok "already at $after — no new commits"
else
  ok "updated $before → $after"
  git log --oneline "$before..$after"
fi

[[ "$STASHED" == "1" ]] && warn "stash preserved — run 'git stash list' to recover"

popd >/dev/null

# ── 3. restart nex-worker ─────────────────────────────────────────────────
step "restart $SERVICE"
if ! systemctl --user cat "$SERVICE" >/dev/null 2>&1; then
  die "$SERVICE not installed for this user"
fi
systemctl --user restart "$SERVICE"
sleep 3
state=$(systemctl --user is-active "$SERVICE" || true)
if [[ "$state" != "active" ]]; then
  systemctl --user status "$SERVICE" --no-pager --lines=20 || true
  die "$SERVICE not active after restart (state=$state)"
fi
ok "$SERVICE is $state"

# Confirm the new process actually has the new key length (still no value)
worker_pid=$(pgrep -f improve-daemon-server.js | head -1 || true)
if [[ -n "$worker_pid" ]]; then
  proc_len=$(tr '\0' '\n' < "/proc/$worker_pid/environ" 2>/dev/null \
    | awk -F= '/^OLLAMA_API_KEY=/{print length($2); exit}')
  if [[ "$proc_len" == "$NEW_LEN" ]]; then
    ok "worker pid=$worker_pid has OLLAMA_API_KEY with expected length ($NEW_LEN)"
  else
    warn "worker pid=$worker_pid has OLLAMA_API_KEY length=$proc_len (expected $NEW_LEN) — systemd may have cached old env"
  fi
else
  warn "could not locate improve-daemon-server.js pid"
fi

# ── 4. verify Ollama Cloud auth with a quiet probe ────────────────────────
step "probe Ollama Cloud /api/tags (expect HTTP 200)"
probe_http=$(
  set -a
  # shellcheck disable=SC1090
  . "$ENV_SYSTEMD"
  set +a
  curl -sS -o /dev/null -w '%{http_code}' -m 10 \
    -H "Authorization: Bearer $OLLAMA_API_KEY" \
    https://ollama.com/api/tags || echo "curl_err"
)
case "$probe_http" in
  200)
    ok "Ollama Cloud auth OK (HTTP 200)"
    ;;
  401|403)
    die "Ollama Cloud still returns HTTP $probe_http — the key in ~/.nex-code/.env is wrong. Regenerate at ollama.com/settings/keys and rerun this script."
    ;;
  *)
    warn "Ollama Cloud probe returned HTTP $probe_http — treat as inconclusive, check your network"
    ;;
esac

# ── 5. show where to watch for the next practice run ─────────────────────
step "next practice run"
last_practice=$(grep -n 'Nex-Code-Playground' ~/.nex-code/worker.log 2>/dev/null | tail -1 | cut -d: -f1 || true)
echo "  worker log: ~/.nex-code/worker.log"
echo "  watch:      tail -f ~/.nex-code/worker.log"
if [[ -n "$last_practice" ]]; then
  echo "  last practice run line: $last_practice"
fi
echo
ok "done — the next scheduled pass should now run with the rotated key and the new scoring guards."

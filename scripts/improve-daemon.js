#!/usr/bin/env node
/**
 * improve-daemon.js — nex-code Auto-Improvement Daemon
 *
 * Watches _autosave.json for new sessions. After a session ends (90s debounce):
 *   1. Score the session
 *   2. If score improved and stop-conditions not met: run one improvement pass via Claude Code headless
 *   3. Commit fixes to devel, push — GitHub Actions handles CI + npm publish
 *   4. Send Matrix notification when loop ends (plateau / max passes / score 9.5+)
 *
 * Stop conditions (auto):
 *   - Score plateau: same score for PLATEAU_COUNT consecutive sessions
 *   - Max passes: MAX_PASSES improvement passes done
 *   - Excellent score: ≥ 9.5/10
 *
 * Stop (manual):
 *   cd ~/Coding/nex-code && git checkout main && git merge devel --no-ff && git push
 *
 * Start: node scripts/improve-daemon.js
 * Auto-start: LaunchAgent (com.nex-code.improve-daemon.plist)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync, execSync } = require("child_process");

// ── Config ─────────────────────────────────────────────────────────────────
const HOME = process.env.HOME;
const SESSION_FILE = path.join(
  HOME,
  "Coding/jarvis-agent/.nex/sessions/_autosave.json",
);
const STATE_FILE = path.join(HOME, "Coding/jarvis-agent/.nex/loop-state.json");
const NEX_DIR = path.join(HOME, "Coding/nex-code");
const CLAUDE_BIN = path.join(HOME, ".local/bin/claude");
const JARVIS_SSH = process.env.JARVIS_SSH_HOST; // set in LaunchAgent plist EnvironmentVariables
const NODE_BIN = process.execPath;

const DEBOUNCE_MS = 90_000; // wait 90s after last write before treating session as complete
const MAX_PASSES = 8; // hard stop after 8 improvement passes
const PLATEAU_COUNT = 2; // stop if score unchanged for this many consecutive sessions
const SCORE_TARGET = 9.5; // stop early if this score is reached

// ── State helpers ───────────────────────────────────────────────────────────
function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {
      pass: 0,
      scores: [],
      lastHash: "",
      startedAt: new Date().toISOString(),
    };
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function sessionHash() {
  try {
    const stat = fs.statSync(SESSION_FILE);
    return String(stat.mtimeMs);
  } catch {
    return "";
  }
}

// ── Scorer ──────────────────────────────────────────────────────────────────
function scoreSession() {
  const script = `
    const {scoreMessages} = require(${JSON.stringify(path.join(NEX_DIR, "cli/session-scorer.js"))});
    const fs = require('fs');
    try {
      const d = JSON.parse(fs.readFileSync(${JSON.stringify(SESSION_FILE)}, 'utf8'));
      const r = scoreMessages(d.messages || []);
      process.stdout.write(JSON.stringify({ score: r.score, grade: r.grade, issues: r.issues }));
    } catch(e) {
      process.stdout.write(JSON.stringify({ score: -1, grade: 'X', issues: ['scorer error: ' + e.message] }));
    }
  `;
  const res = spawnSync(NODE_BIN, ["-e", script], {
    encoding: "utf8",
    timeout: 15_000,
  });
  if (res.error) {
    log(`Scorer child process error: ${res.error.message}`);
    return { score: -1, grade: "X", issues: ["scorer error: " + res.error.message] };
  }
  try {
    return JSON.parse(res.stdout);
  } catch {
    const stderr = (res.stderr || "").trim().slice(0, 200);
    log(`Scorer stdout not parseable. stderr: ${stderr || "(empty)"}`);
    return { score: -1, grade: "X", issues: ["scorer error: unparseable output"] };
  }
}

// ── Matrix notification via Jarvis ──────────────────────────────────────────
function sendMatrix(message) {
  if (!JARVIS_SSH) {
    log("Matrix notification skipped — JARVIS_SSH_HOST not set.");
    return;
  }
  try {
    const payload = JSON.stringify({ message });
    // Write payload to a temp file to avoid shell quoting issues
    const tmpFile = `/tmp/nex-matrix-${Date.now()}.json`;
    require("fs").writeFileSync(tmpFile, payload);
    execSync(
      `ssh -o ConnectTimeout=10 -o BatchMode=yes ${JARVIS_SSH} ` +
        `"curl -sf -X POST http://localhost:3000/matrix/notify ` +
        `-H 'Content-Type: application/json' -d @-" < ${tmpFile}`,
      { timeout: 20_000 },
    );
    require("fs").unlinkSync(tmpFile);
    log("Matrix notification sent.");
  } catch (e) {
    log(`Matrix notification failed: ${e.message}`);
    // Fallback: macOS notification
    try {
      execSync(
        `osascript -e 'display notification "${message.replace(/"/g, "'").slice(0, 200)}" with title "nex-code daemon"'`,
      );
    } catch {}
  }
}

// ── Plateau detection ────────────────────────────────────────────────────────
function isScorePlateau(scores) {
  if (scores.length < PLATEAU_COUNT + 1) return false;
  const last = scores.slice(-PLATEAU_COUNT);
  return last.every((s) => s === last[0]);
}

// ── Logging ──────────────────────────────────────────────────────────────────
function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}]`, ...args);
}

// ── Improvement pass ─────────────────────────────────────────────────────────
function runImprovementPass(score, issues) {
  const issueText = issues.length
    ? `\nAktuell offene Issues (höchste Prio zuerst):\n${issues.map((x, i) => `${i + 1}. ${x}`).join("\n")}`
    : "\nKeine Issues vom Scorer gemeldet — prüfe Terminal-Output und Layout.";

  const prompt =
    `nex-code Auto-Improvement Pass — Session Score: ${score}/10.` +
    issueText +
    `\n\nAnalysiere die letzte nex-code Session (${SESSION_FILE}) und implementiere gezielte Fixes ` +
    `für das wichtigste offene Problem in /Users/lukasschonsgibl/Coding/nex-code/cli/. ` +
    `Teste mit: node -e "require('./cli/agent.js')". ` +
    `Führe npm test -- --forceExit aus und committe + pushe nach devel wenn alle Tests grünen. ` +
    `Fokus: NUR das wichtigste Issue beheben, nicht alles auf einmal. ` +
    `\n\nWhen finished, write a 2-3 sentence summary covering: (1) what you changed, ` +
    `(2) why you changed it, (3) what the expected impact is. ` +
    `Do NOT end with just "Done", "Analysis complete", "Finished", or any single word or short phrase. ` +
    `Always write a substantive closing paragraph of at least 2 sentences.`;

  log("Running improvement pass via Claude Code headless...");
  const res = spawnSync(
    CLAUDE_BIN,
    ["--print", "--dangerously-skip-permissions", "-p", prompt],
    {
      cwd: NEX_DIR,
      stdio: "inherit",
      timeout: 900_000, // 15 min max
      env: {
        ...process.env,
        ANTHROPIC_BASE_URL: undefined,
        ANTHROPIC_API_KEY: undefined,
      },
    },
  );

  if (res.status !== 0) {
    log(`Claude pass exited with status ${res.status}`);
  } else {
    log("Improvement pass complete.");
  }
}

// ── Main trigger ─────────────────────────────────────────────────────────────
let debounceTimer = null;
let lastHash = "";

function onSessionChange() {
  const hash = sessionHash();
  if (hash === lastHash) return; // no actual change

  // File was deleted — update tracking hash so next creation is detected,
  // but don't trigger an improvement pass on deletion events.
  if (!hash) {
    log("Session file deleted — tracking reset, waiting for new session.");
    lastHash = "";
    return;
  }

  lastHash = hash;

  if (debounceTimer) clearTimeout(debounceTimer);
  log(
    `Session file changed — waiting ${DEBOUNCE_MS / 1000}s for session to complete...`,
  );

  debounceTimer = setTimeout(async () => {
    debounceTimer = null;

    // Re-check: file may have been deleted during the debounce window
    if (!fs.existsSync(SESSION_FILE)) {
      log("Session file gone after debounce — skipping improvement pass.");
      return;
    }

    const state = readState();

    // Don't re-process same session
    if (hash === state.lastHash) {
      log("Same session hash as last pass — skipping.");
      return;
    }

    const { score, grade, issues } = scoreSession();
    log(
      `Score: ${score}/10 ${grade}  Issues: ${issues.length ? issues.join("; ") : "none"}`,
    );

    // Scorer itself failed — don't count as a real score or run improvement
    if (score < 0) {
      log("Scorer error — skipping this session (will retry on next change).");
      return;
    }

    state.scores.push(score);
    state.pass++;
    state.lastHash = hash;
    writeState(state);

    // ── Stop conditions ─────────────────────────────────────────────────────
    if (score >= SCORE_TARGET) {
      sendMatrix(
        `✅ nex-code auto-improve: Score erreicht ${score}/10 ${grade} — kein weiterer Fix nötig.\n` +
          `Pass ${state.pass}/${MAX_PASSES}. Devel bereit → \`nex-improve stop\` in Claude zum Mergen.`,
      );
      log("Score target reached. Daemon will wait for next session.");
      return;
    }

    if (state.pass >= MAX_PASSES) {
      sendMatrix(
        `🛑 nex-code auto-improve: Max Passes (${MAX_PASSES}) erreicht.\n` +
          `Letzter Score: ${score}/10 ${grade}\n` +
          `Devel bereit → \`/nex-improve stop\` zum Mergen, dann manuell weitere Analyse.`,
      );
      log("Max passes reached. Stopping improvement loop.");
      // Reset so next session starts fresh
      writeState({
        pass: 0,
        scores: [],
        lastHash: hash,
        startedAt: new Date().toISOString(),
      });
      return;
    }

    if (isScorePlateau(state.scores)) {
      sendMatrix(
        `📊 nex-code auto-improve: Score Plateau bei ${score}/10 (${PLATEAU_COUNT}× gleich).\n` +
          `Pass ${state.pass}/${MAX_PASSES}. Weitere Fixes brauchen neue Sessions.\n` +
          `Devel bereit → \`nex-improve stop\` in Claude zum Mergen.`,
      );
      log("Score plateau detected. Stopping improvement loop.");
      writeState({
        pass: 0,
        scores: [],
        lastHash: hash,
        startedAt: new Date().toISOString(),
      });
      return;
    }

    // ── Run improvement pass ─────────────────────────────────────────────────
    runImprovementPass(score, issues);
  }, DEBOUNCE_MS);
}

// ── Watch ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(SESSION_FILE)) {
  log(`Session file not found: ${SESSION_FILE} — will start watching and wait for first session.`);
  // Ensure sessions directory exists so watchFile has a stable parent
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
}

log(`nex-code improve-daemon started.`);
log(`Watching: ${SESSION_FILE}`);
log(`State:    ${STATE_FILE}`);
log(
  `Stop conditions: plateau=${PLATEAU_COUNT}× | max=${MAX_PASSES} passes | score≥${SCORE_TARGET}`,
);

// Initialize lastHash from state so restart doesn't re-process old session
const initialState = readState();
lastHash = initialState.lastHash || "";

// fs.watch on macOS can miss events for atomically-written files (write+rename).
// Use fs.watchFile (polling) as primary watcher for reliability.
const POLL_INTERVAL_MS = 5000; // poll every 5s
fs.watchFile(
  SESSION_FILE,
  { persistent: true, interval: POLL_INTERVAL_MS },
  (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) onSessionChange();
  },
);

// Also keep fs.watch as a fast-path for editors that modify in-place.
// On macOS, fs.watch uses open() internally and throws ENOENT synchronously
// when the target file does not exist yet — before .on("error") can be attached.
// Wrap in try-catch: fs.watchFile (polling above) is the reliable fallback.
try {
  const watcher = fs.watch(SESSION_FILE, { persistent: true }, (event) => {
    if (event === "change") onSessionChange();
  });
  watcher.on("error", () => {}); // silently ignore post-creation errors
} catch {
  log("fs.watch unavailable (file not yet created) — relying on watchFile polling.");
}

// Graceful shutdown
process.on("SIGTERM", () => {
  fs.unwatchFile(SESSION_FILE);
  log("SIGTERM — shutting down.");
  process.exit(0);
});
process.on("SIGINT", () => {
  fs.unwatchFile(SESSION_FILE);
  log("SIGINT — shutting down.");
  process.exit(0);
});

log("Ready. Watching for session changes (poll every 5s + fs.watch)...");

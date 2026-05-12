/**
 * desktop/renderer/js/components/command-palette.js — Command Shortcut Chips
 *
 * Functional command chips with clear labels and handlers.
 */

"use strict";

function initCommandPaletteComponents(data) {
  const chips = document.getElementById("command-chips");
  if (!chips || !data.shortcutChips) return;

  chips.innerHTML = data.shortcutChips
    .map((cmd) => {
      const disabledReason = getDisabledReason(cmd, data);
      return `
    <button class="chip${disabledReason ? " chip-disabled" : ""}" onclick="handleChipClick('${cmd}')" title="${disabledReason || getChipDescription(cmd)}" data-disabled="${disabledReason ? "true" : "false"}">
      <span class="chip-icon">${getChipIcon(cmd)}</span>
      ${cmd}
      ${disabledReason ? `<span class="chip-reason">locked</span>` : ""}
    </button>
  `;
    })
    .join("");
}

function handleChipClick(cmd) {
  const input = document.getElementById("cmd-input");
  if (!input) return;

  const data = window.AppState ? window.AppState.data : {};
  const disabledReason = getDisabledReason(cmd, data);
  if (disabledReason) {
    writeCommandLog(`${cmd} disabled: ${disabledReason}`);
    input.focus();
    return;
  }

  // Set the command in the input and focus
  input.value = cmd + " ";
  input.focus();

  // Show brief description in server log
  writeCommandLog(`nex-code › ${getChipDescription(cmd)}`);
}

function writeCommandLog(text) {
  const output = document.getElementById("server-output");
  const stream = document.getElementById("server-stream");
  if (output && stream) {
    output.classList.remove("hidden");
    const div = document.createElement("div");
    div.className = "log-line";
    div.textContent = text;
    stream.appendChild(div);
    stream.scrollTop = stream.scrollHeight;
  }
}

function getDisabledReason(cmd, data) {
  const hasProject = !!data.project;
  if (cmd === "/git" && !hasProject) return "disabled until a Git repository is opened.";
  if (cmd === "/git" && !data.isGitRepository) return "disabled because the open project is not a Git repository.";
  if (cmd === "/deploy" && !hasProject) return "disabled until a deployable project is opened.";
  if (cmd === "/deploy" && !data.isDeployable) return "disabled until a deployable project is opened.";
  if (["/plan", "/impl", "/verify", "/bench"].includes(cmd) && !hasProject) {
    return "disabled until a project is opened.";
  }
  return "";
}

function getChipIcon(cmd) {
  switch (cmd) {
    case "/plan":
      return "◈";
    case "/impl":
      return "◆";
    case "/verify":
      return "✓";
    case "/bench":
      return "⏱";
    case "/git":
      return "⎇";
    case "/deploy":
      return "⇧";
    default:
      return "⚡";
  }
}

function getChipDescription(cmd) {
  switch (cmd) {
    case "/plan":
      return "Create or update an implementation plan";
    case "/impl":
      return "Start implementation phase";
    case "/verify":
      return "Run verification checks";
    case "/bench":
      return "Run benchmark checks";
    case "/git":
      return "Open Git status and actions";
    case "/deploy":
      return "Start deployment workflow";
    default:
      return "Execute command";
  }
}

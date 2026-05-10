/**
 * desktop/renderer/js/components/command-palette.js — Bottom Command Center
 *
 * Frosted-glass command input with shortcut chips, command history,
 * and full keyboard navigation.
 */

"use strict";

// ─── Command History ─────────────────────────────────────────────────────────

const commandHistory = [];
let historyIndex = -1;

function addToHistory(command) {
  // Deduplicate consecutive identical commands
  if (commandHistory.length > 0 && commandHistory[commandHistory.length - 1] === command) {
    return;
  }
  commandHistory.push(command);
  // Cap at 50 entries
  if (commandHistory.length > 50) {
    commandHistory.shift();
  }
  historyIndex = commandHistory.length;
}

function navigateHistory(direction, input) {
  if (commandHistory.length === 0) return;

  if (direction === "up") {
    if (historyIndex === commandHistory.length) {
      // Save current input before navigating
      input.dataset.savedInput = input.value;
    }
    if (historyIndex > 0) {
      historyIndex--;
      input.value = commandHistory[historyIndex];
    }
  } else if (direction === "down") {
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      input.value = commandHistory[historyIndex];
    } else {
      historyIndex = commandHistory.length;
      input.value = input.dataset.savedInput || "";
    }
  }
}

// ─── Component Init ──────────────────────────────────────────────────────────

function initCommandPaletteComponents(data) {
  if (!data) return;

  const input = document.getElementById("command-input");
  const submitBtn = document.getElementById("command-submit");
  const chipsContainer = document.getElementById("shortcut-chips");

  // ─── Render shortcut chips ────────────────────────────────────────────
  if (chipsContainer && data.shortcutChips) {
    const icons = {
      "/plan": "◈",
      "/impl": "◆",
      "/verify": "✓",
      "/bench": "⏱",
      "/git": "⎇",
      "/deploy": "⇧",
    };

    chipsContainer.innerHTML = data.shortcutChips
      .map(
        (cmd) => `
      <button class="chip" data-command="${cmd}">
        <span class="chip-icon">${icons[cmd] || "›"}</span>
        ${cmd}
      </button>
    `
      )
      .join("");

    // Attach click handlers
    chipsContainer.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const cmd = chip.dataset.command;
        if (input) {
          input.value = cmd;
          input.focus();
        }
        window.NexApp.executeCommand(cmd);
      });
    });
  }

  // ─── Submit handler ───────────────────────────────────────────────────
  function doSubmit() {
    const command = input.value.trim();
    if (!command) return;

    addToHistory(command);
    window.NexApp.executeCommand(command);
    input.value = "";
  }

  if (submitBtn && input) {
    submitBtn.addEventListener("click", doSubmit);
  }

  // ─── Keyboard handlers ────────────────────────────────────────────────
  if (input) {
    input.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "Enter":
          if (!e.shiftKey) {
            e.preventDefault();
            doSubmit();
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          navigateHistory("up", input);
          break;

        case "ArrowDown":
          e.preventDefault();
          navigateHistory("down", input);
          break;

        case "Escape":
          input.blur();
          break;
      }
    });
  }

  // ─── Global keyboard shortcuts ────────────────────────────────────────

  // Cmd/Ctrl+K focuses command input
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (input) input.focus();
    }
  });

  // Cmd/Ctrl+Enter submits from anywhere
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (input && input.value.trim()) {
        doSubmit();
      }
    }
  });
}

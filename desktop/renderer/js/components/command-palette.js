/**
 * desktop/renderer/js/components/command-palette.js
 */

"use strict";

function initCommandPaletteComponents(data) {
  const chips = document.getElementById("command-chips");
  if (!chips || !data.shortcutChips) return;

  chips.innerHTML = data.shortcutChips
    .map(
      (c) => `
    <button class="chip" onclick="handleChipClick('${c}')">
      <span class="chip-icon">${getChipIcon(c)}</span>
      ${c}
    </button>
  `
    )
    .join("");
}

function handleChipClick(cmd) {
  const input = document.getElementById("command-input");
  if (input) {
    input.value = cmd + " ";
    input.focus();
  }
}

function getChipIcon(cmd) {
  switch (cmd) {
    case "/plan": return "◈";
    case "/impl": return "◆";
    case "/verify": return "✓";
    case "/bench": return "⏱";
    case "/git": return "⎇";
    case "/deploy": return "⇧";
    default: return "⚡";
  }
}

/**
 * cli/picker.js — Interactive Terminal Picker
 * Generic cursor-based list picker for terminal UIs.
 */

const { C } = require("./ui");
const {
  listProviders,
  getActiveProviderName,
  getActiveModelId,
  setActiveModel,
} = require("./providers/registry");

/**
 * Generic interactive list picker.
 * @param {readline.Interface} rl - readline instance (will be paused during pick)
 * @param {Array<{ label: string, value: string|null, isHeader?: boolean, isCurrent?: boolean }>} items
 * @param {object} [options]
 * @param {string} [options.title] - Title shown above the list
 * @param {string} [options.hint] - Hint shown below title
 * @returns {Promise<string|null>} selected value or null if cancelled
 */
function pickFromList(rl, items, options = {}) {
  const {
    title = "Select",
    hint = "\u2191\u2193 navigate \u00b7 Enter select \u00b7 Esc cancel",
  } = options;

  return new Promise((resolve) => {
    // Find selectable items (non-headers)
    const selectableIndices = items
      .map((item, i) => (item.isHeader ? -1 : i))
      .filter((i) => i >= 0);

    if (selectableIndices.length === 0) {
      resolve(null);
      return;
    }

    // Start cursor at current item, or first selectable
    const currentIdx = items.findIndex((item) => item.isCurrent);
    let cursor = currentIdx >= 0 ? selectableIndices.indexOf(currentIdx) : 0;
    if (cursor < 0) cursor = 0;

    // Calculate visible window for scrolling
    const maxVisible = process.stdout.rows
      ? Math.max(process.stdout.rows - 6, 5)
      : 20;
    let scrollOffset = 0;

    function getVisibleRange() {
      // Ensure cursor is visible
      const cursorItemIdx = selectableIndices[cursor];
      if (cursorItemIdx < scrollOffset) {
        scrollOffset = cursorItemIdx;
      } else if (cursorItemIdx >= scrollOffset + maxVisible) {
        scrollOffset = cursorItemIdx - maxVisible + 1;
      }
      return {
        start: scrollOffset,
        end: Math.min(items.length, scrollOffset + maxVisible),
      };
    }

    let renderedLines = 0;

    function render() {
      // Clear previous render
      if (renderedLines > 0) {
        process.stdout.write(`\x1b[${renderedLines}A`);
        for (let i = 0; i < renderedLines; i++) {
          process.stdout.write("\x1b[2K\n");
        }
        process.stdout.write(`\x1b[${renderedLines}A`);
      }

      const lines = [];
      lines.push(`  ${C.bold}${C.cyan}${title}${C.reset}`);
      lines.push(`  ${C.dim}${hint}${C.reset}`);
      lines.push("");

      const { start, end } = getVisibleRange();

      if (start > 0) {
        lines.push(`  ${C.dim}\u2191 more${C.reset}`);
      }

      for (let i = start; i < end; i++) {
        const item = items[i];
        if (item.isHeader) {
          lines.push(`  ${C.bold}${C.dim}${item.label}${C.reset}`);
          continue;
        }

        const isSelected = selectableIndices[cursor] === i;
        const pointer = isSelected ? `${C.cyan}> ` : "  ";
        const currentTag = item.isCurrent
          ? ` ${C.yellow}<current>${C.reset}`
          : "";

        if (isSelected) {
          lines.push(`${pointer}${C.bold}${item.label}${C.reset}${currentTag}`);
        } else {
          lines.push(`${pointer}${C.dim}${item.label}${C.reset}${currentTag}`);
        }
      }

      if (end < items.length) {
        lines.push(`  ${C.dim}\u2193 more${C.reset}`);
      }

      const output = lines.join("\n");
      process.stdout.write(output + "\n");
      renderedLines = lines.length;
    }

    // Pause readline, take over stdin
    rl.pause();
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    function cleanup() {
      process.stdin.removeListener("keypress", onKeypress);
      if (process.stdin.isTTY && wasRaw !== undefined) {
        process.stdin.setRawMode(wasRaw);
      }
      rl.resume();
    }

    function onKeypress(str, key) {
      if (!key) return;

      if (key.name === "up" || (key.ctrl && key.name === "p")) {
        if (cursor > 0) {
          cursor--;
          render();
        }
        return;
      }

      if (key.name === "down" || (key.ctrl && key.name === "n")) {
        if (cursor < selectableIndices.length - 1) {
          cursor++;
          render();
        }
        return;
      }

      if (key.name === "return") {
        const selectedItem = items[selectableIndices[cursor]];
        cleanup();
        resolve(selectedItem ? selectedItem.value : null);
        return;
      }

      if (key.name === "escape" || (key.ctrl && key.name === "c")) {
        cleanup();
        resolve(null);
        return;
      }
    }

    process.stdin.on("keypress", onKeypress);
    render();
  });
}

/**
 * Show the model picker and handle selection.
 * @param {readline.Interface} rl
 * @returns {Promise<boolean>} true if model was selected
 */
async function showModelPicker(rl) {
  const providerList = listProviders();
  const activeProvider = getActiveProviderName();
  const activeModel = getActiveModelId();

  // Build picker items: provider headers + model entries
  const items = [];
  for (const p of providerList) {
    if (p.models.length === 0) continue;

    items.push({
      label: p.provider,
      value: null,
      isHeader: true,
    });

    for (const m of p.models) {
      const isCurrent = p.provider === activeProvider && m.id === activeModel;
      items.push({
        label: `  ${m.name} (${p.provider}:${m.id})`,
        value: `${p.provider}:${m.id}`,
        isCurrent,
      });
    }
  }

  const selected = await pickFromList(rl, items, {
    title: "Select Model",
  });

  if (selected) {
    setActiveModel(selected);
    console.log(`${C.green}Switched to ${selected}${C.reset}`);
    return true;
  }

  console.log(`${C.dim}Cancelled${C.reset}`);
  return false;
}

module.exports = { pickFromList, showModelPicker };

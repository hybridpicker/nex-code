/**
 * cli/session-tree.js — Session Tree Navigation
 * Navigate to any point in conversation history and branch from there.
 * Like git for chat — supports branching, switching, and tree visualization.
 */

const { C } = require("./ui");

/**
 * Session tree metadata structure.
 * Stored alongside session data in .nex/sessions/.
 *
 * tree = {
 *   branches: {
 *     "main": { messages: [...], parentBranch: null, forkIndex: 0 },
 *     "branch-1": { messages: [...], parentBranch: "main", forkIndex: 5 }
 *   },
 *   activeBranch: "main"
 * }
 */

/**
 * Initialize tree metadata for a session's messages.
 * If the session already has tree data, returns it as-is.
 * @param {object} session - Session object with messages array
 * @returns {object} tree metadata
 */
function initTree(session) {
  if (session.tree && session.tree.branches) {
    return session.tree;
  }
  return {
    branches: {
      main: {
        messages: session.messages || [],
        parentBranch: null,
        forkIndex: 0,
      },
    },
    activeBranch: "main",
  };
}

/**
 * Get the active branch's messages.
 * @param {object} tree
 * @returns {Array} messages
 */
function getActiveMessages(tree) {
  const branch = tree.branches[tree.activeBranch];
  if (!branch) return [];
  return branch.messages;
}

/**
 * Set messages on the active branch.
 * @param {object} tree
 * @param {Array} messages
 */
function setActiveMessages(tree, messages) {
  const branch = tree.branches[tree.activeBranch];
  if (branch) {
    branch.messages = messages;
  }
}

/**
 * Create a new branch forking from a specific message index on the current branch.
 * @param {object} tree
 * @param {number} forkIndex - Message index to fork from (messages 0..forkIndex are shared)
 * @param {string} [branchName] - Optional name (auto-generated if omitted)
 * @returns {{ tree: object, branchName: string }}
 */
function createBranch(tree, forkIndex, branchName) {
  const sourceBranch = tree.activeBranch;
  const sourceMessages = tree.branches[sourceBranch].messages;

  if (forkIndex < 0 || forkIndex >= sourceMessages.length) {
    throw new Error(
      `Fork index ${forkIndex} out of range (0-${sourceMessages.length - 1})`,
    );
  }

  // Auto-generate branch name
  if (!branchName) {
    const existing = Object.keys(tree.branches).filter((b) =>
      b.startsWith("branch-"),
    );
    const maxNum = existing.reduce((max, b) => {
      const n = parseInt(b.replace("branch-", ""), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    branchName = `branch-${maxNum + 1}`;
  }

  // Branch gets messages up to and including forkIndex
  tree.branches[branchName] = {
    messages: sourceMessages.slice(0, forkIndex + 1),
    parentBranch: sourceBranch,
    forkIndex,
  };

  tree.activeBranch = branchName;
  return { tree, branchName };
}

/**
 * Switch to a different branch.
 * @param {object} tree
 * @param {string} branchName
 * @returns {object} tree
 */
function switchBranch(tree, branchName) {
  if (!tree.branches[branchName]) {
    throw new Error(
      `Branch "${branchName}" not found. Available: ${Object.keys(tree.branches).join(", ")}`,
    );
  }
  tree.activeBranch = branchName;
  return tree;
}

/**
 * Go to a specific message index on the current branch.
 * Truncates the branch to that point.
 * @param {object} tree
 * @param {number} index - Message index to go to
 * @returns {{ tree: object, truncated: number }}
 */
function gotoMessage(tree, index) {
  const branch = tree.branches[tree.activeBranch];
  if (!branch) throw new Error("No active branch");

  if (index < 0 || index >= branch.messages.length) {
    throw new Error(
      `Index ${index} out of range (0-${branch.messages.length - 1})`,
    );
  }

  const truncated = branch.messages.length - (index + 1);
  branch.messages = branch.messages.slice(0, index + 1);
  return { tree, truncated };
}

/**
 * Delete a branch (cannot delete the active branch or "main").
 * @param {object} tree
 * @param {string} branchName
 * @returns {object} tree
 */
function deleteBranch(tree, branchName) {
  if (branchName === "main") {
    throw new Error('Cannot delete the "main" branch');
  }
  if (branchName === tree.activeBranch) {
    throw new Error(
      "Cannot delete the active branch. Switch to another branch first.",
    );
  }
  if (!tree.branches[branchName]) {
    throw new Error(`Branch "${branchName}" not found`);
  }
  delete tree.branches[branchName];
  return tree;
}

/**
 * Render a visual tree of all branches.
 * @param {object} tree
 * @returns {string} formatted tree output
 */
function renderTree(tree) {
  const lines = [];
  lines.push(`${C.bold}${C.cyan}Session Tree${C.reset}\n`);

  const branchNames = Object.keys(tree.branches);

  for (const name of branchNames) {
    const branch = tree.branches[name];
    const isActive = name === tree.activeBranch;
    const prefix = isActive ? `${C.green}* ` : `  `;
    const nameStr = isActive
      ? `${C.green}${C.bold}${name}${C.reset}`
      : `${C.cyan}${name}${C.reset}`;

    const msgCount = branch.messages.length;
    const parentInfo = branch.parentBranch
      ? ` ${C.dim}(forked from ${branch.parentBranch}@${branch.forkIndex})${C.reset}`
      : "";

    lines.push(`${prefix}${nameStr} — ${msgCount} messages${parentInfo}`);

    // Show last few user messages as preview
    const userMessages = branch.messages.filter((m) => m.role === "user");
    const preview = userMessages.slice(-2);
    for (const msg of preview) {
      const text =
        typeof msg.content === "string"
          ? msg.content.substring(0, 60)
          : "[multimodal]";
      lines.push(`    ${C.dim}> ${text}${text.length >= 60 ? "..." : ""}${C.reset}`);
    }
  }

  return lines.join("\n");
}

/**
 * Render a timeline view of the current branch's messages.
 * @param {object} tree
 * @param {number} [maxItems=20] - Maximum messages to show
 * @returns {string} formatted timeline
 */
function renderTimeline(tree, maxItems = 20) {
  const branch = tree.branches[tree.activeBranch];
  if (!branch) return "No active branch.";

  const messages = branch.messages;
  const lines = [];
  lines.push(
    `${C.bold}${C.cyan}Timeline: ${tree.activeBranch}${C.reset} (${messages.length} messages)\n`,
  );

  // Show the last N messages
  const start = Math.max(0, messages.length - maxItems);
  for (let i = start; i < messages.length; i++) {
    const msg = messages[i];
    const role = msg.role;
    const roleColor =
      role === "user"
        ? C.green
        : role === "assistant"
          ? C.cyan
          : role === "system"
            ? C.yellow
            : C.dim;

    let preview = "";
    if (typeof msg.content === "string") {
      preview = msg.content.substring(0, 70).replace(/\n/g, " ");
    } else if (Array.isArray(msg.content)) {
      const textBlock = msg.content.find(
        (b) => b.type === "text" || b.type === "tool_result",
      );
      preview = textBlock
        ? (textBlock.text || textBlock.content || "").substring(0, 70)
        : "[blocks]";
    }
    if (preview.length >= 70) preview += "...";

    const toolInfo =
      msg.tool_calls && msg.tool_calls.length > 0
        ? ` ${C.dim}[${msg.tool_calls.length} tool calls]${C.reset}`
        : "";

    lines.push(
      `  ${C.dim}${String(i).padStart(3)}${C.reset} ${roleColor}${role.padEnd(9)}${C.reset} ${preview}${toolInfo}`,
    );
  }

  if (start > 0) {
    lines.splice(
      1,
      0,
      `  ${C.dim}... ${start} earlier messages not shown${C.reset}`,
    );
  }

  return lines.join("\n");
}

module.exports = {
  initTree,
  getActiveMessages,
  setActiveMessages,
  createBranch,
  switchBranch,
  gotoMessage,
  deleteBranch,
  renderTree,
  renderTimeline,
};

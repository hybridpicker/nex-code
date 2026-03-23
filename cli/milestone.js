"use strict";

const EXPLORE_TOOLS = new Set([
  "read_file",
  "grep",
  "glob",
  "search_files",
  "list_directory",
]);
const WRITE_TOOLS = new Set(["write_file", "edit_file", "patch_file"]);
const EXEC_TOOLS = new Set(["bash"]);
const WEB_TOOLS = new Set(["web_search", "web_fetch", "perplexity_search"]);

function _phaseName(toolCounts, phaseNum) {
  let explore = 0,
    write = 0,
    exec = 0,
    web = 0,
    total = 0;
  for (const [name, count] of toolCounts) {
    total += count;
    if (EXPLORE_TOOLS.has(name)) explore += count;
    if (WRITE_TOOLS.has(name)) write += count;
    if (EXEC_TOOLS.has(name)) exec += count;
    if (WEB_TOOLS.has(name)) web += count;
  }
  if (total === 0) return `Phase ${phaseNum}`;
  if (web / total > 0.5) return "Research";
  if (explore / total > 0.5) return "Exploration";
  if (write / total > 0.3) return "Implementation";
  if (exec / total > 0.3 && write / total < 0.15) return "Verification";
  return `Phase ${phaseNum}`;
}

class MilestoneTracker {
  constructor(n) {
    this._N = n;
    this._disabled = n <= 0;
    this._phaseNum = 0;
    this._stepsThisPhase = 0;
    this._phaseCounts = new Map();
    this._phaseStart = Date.now();
  }

  /**
   * Call after each step group is printed.
   * @param {number}   _stepLines  - unused (kept for API compat — milestones are append-only)
   * @param {string[]} toolNames   - tools used in this step (ask_user excluded)
   * @param {Set}      filesRead
   * @param {Set}      filesModified
   * @returns {object|null} milestone descriptor, or null if phase not complete
   */
  record(_stepLines, toolNames, filesRead, filesModified) {
    if (this._disabled) return null;

    this._stepsThisPhase++;
    for (const n of toolNames) {
      this._phaseCounts.set(n, (this._phaseCounts.get(n) || 0) + 1);
    }

    if (this._stepsThisPhase < this._N) return null;

    this._phaseNum++;
    const ms = {
      phaseNum: this._phaseNum,
      phaseName: _phaseName(this._phaseCounts, this._phaseNum),
      stepCount: this._stepsThisPhase,
      toolCounts: new Map(this._phaseCounts),
      elapsed: Date.now() - this._phaseStart,
      filesRead: new Set(filesRead),
      filesModified: new Set(filesModified),
    };

    // Reset phase state
    this._stepsThisPhase = 0;
    this._phaseCounts = new Map();
    this._phaseStart = Date.now();

    return ms;
  }
}

module.exports = { MilestoneTracker, _phaseName };

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  scoreMessages,
  formatScore,
  appendScoreHistory,
  _extractToolCalls: extractToolCalls,
  _extractToolResults: extractToolResults,
  _getLastAssistantText: getLastAssistantText,
  _getLastNAssistantTexts: getLastNAssistantTexts,
  _countDuplicateToolCalls: countDuplicateToolCalls,
} = require("../cli/session-scorer");

// ─── Helper: build tool_use message ────────────────────────────────────────
function toolUse(name, input = {}, msgIndex = 0) {
  return {
    role: "assistant",
    content: [{ type: "tool_use", name, input }],
  };
}

function toolResult(content, role = "tool") {
  return { role, content };
}

function assistantText(text) {
  return { role: "assistant", content: text };
}

function userMsg(text) {
  return { role: "user", content: text };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("session-scorer.js", () => {
  // ─── extractToolCalls ─────────────────────────────────────────────
  describe("extractToolCalls()", () => {
    it("extracts Anthropic-style tool_use blocks", () => {
      const msgs = [
        {
          role: "assistant",
          content: [
            { type: "tool_use", name: "read_file", input: { path: "/a" } },
            { type: "text", text: "hello" },
          ],
        },
      ];
      const calls = extractToolCalls(msgs);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe("read_file");
      expect(calls[0].input.path).toBe("/a");
    });

    it("extracts OpenAI-style tool_calls", () => {
      const msgs = [
        {
          role: "assistant",
          content: "thinking...",
          tool_calls: [
            {
              function: {
                name: "bash",
                arguments: '{"command":"ls"}',
              },
            },
          ],
        },
      ];
      const calls = extractToolCalls(msgs);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe("bash");
      expect(calls[0].input.command).toBe("ls");
    });

    it("handles malformed arguments gracefully", () => {
      const msgs = [
        {
          role: "assistant",
          content: "",
          tool_calls: [
            { function: { name: "bash", arguments: "not json" } },
          ],
        },
      ];
      const calls = extractToolCalls(msgs);
      expect(calls).toHaveLength(1);
      expect(calls[0].input).toEqual({});
    });

    it("skips non-assistant messages", () => {
      const msgs = [{ role: "user", content: "hi" }];
      expect(extractToolCalls(msgs)).toHaveLength(0);
    });
  });

  // ─── extractToolResults ───────────────────────────────────────────
  describe("extractToolResults()", () => {
    it("extracts Anthropic-style tool role messages", () => {
      const msgs = [{ role: "tool", content: "file contents here" }];
      const results = extractToolResults(msgs);
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("file contents here");
    });

    it("extracts OpenAI-style tool_result blocks", () => {
      const msgs = [
        {
          role: "user",
          content: [
            { type: "tool_result", content: "result text" },
          ],
        },
      ];
      const results = extractToolResults(msgs);
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("result text");
    });
  });

  // ─── getLastAssistantText ─────────────────────────────────────────
  describe("getLastAssistantText()", () => {
    it("returns last assistant string content", () => {
      const msgs = [
        assistantText("first"),
        userMsg("question"),
        assistantText("second"),
      ];
      expect(getLastAssistantText(msgs)).toBe("second");
    });

    it("returns joined text blocks from array content", () => {
      const msgs = [
        {
          role: "assistant",
          content: [
            { type: "text", text: "hello " },
            { type: "text", text: "world" },
          ],
        },
      ];
      expect(getLastAssistantText(msgs)).toBe("hello world");
    });

    it("returns empty string when no assistant messages", () => {
      expect(getLastAssistantText([userMsg("hi")])).toBe("");
    });
  });

  // ─── getLastNAssistantTexts ───────────────────────────────────────
  describe("getLastNAssistantTexts()", () => {
    it("returns up to N texts in reverse order", () => {
      const msgs = [
        assistantText("one"),
        userMsg("q"),
        assistantText("two"),
        userMsg("q"),
        assistantText("three"),
      ];
      const texts = getLastNAssistantTexts(msgs, 2);
      expect(texts).toEqual(["three", "two"]);
    });
  });

  // ─── countDuplicateToolCalls ──────────────────────────────────────
  describe("countDuplicateToolCalls()", () => {
    it("counts identical tool calls", () => {
      const calls = [
        { name: "read_file", input: { path: "/a" } },
        { name: "read_file", input: { path: "/a" } },
        { name: "read_file", input: { path: "/a" } },
        { name: "read_file", input: { path: "/b" } },
      ];
      const counts = countDuplicateToolCalls(calls);
      const max = Math.max(...counts.values());
      expect(max).toBe(3);
    });
  });

  // ─── scoreMessages — individual penalties ─────────────────────────
  describe("scoreMessages()", () => {
    it("returns 0 for empty input", () => {
      const r = scoreMessages([]);
      expect(r.score).toBe(0);
      expect(r.issues).toHaveLength(1);
    });

    it("returns perfect 10 for clean session", () => {
      const msgs = [
        userMsg("Fix the login bug"),
        toolUse("read_file", { path: "/auth.js" }),
        toolResult("const auth = require('./auth');"),
        toolUse("edit_file", { path: "/auth.js", old_text: "a", new_text: "b" }),
        toolResult("File edited successfully"),
        assistantText(
          "I fixed the login bug by updating the auth redirect. The issue was that the redirect URL was hardcoded instead of using req.originalUrl. Now it correctly redirects back to the page the user was trying to access.",
        ),
      ];
      const r = scoreMessages(msgs);
      expect(r.score).toBe(10);
      expect(r.grade).toBe("A");
      expect(r.issues).toHaveLength(0);
    });

    // Penalty 1: Loop warning
    it("penalizes loop warnings (-2.0)", () => {
      const msgs = [
        userMsg("[SYSTEM WARNING] re-read the same file already in your context"),
        assistantText("This is a detailed diagnosis of the issue that is longer than one hundred characters to avoid the no-diagnosis penalty."),
      ];
      const r = scoreMessages(msgs);
      expect(r.score).toBe(8);
    });

    // Penalty 2: sed -n
    it("penalizes sed -n usage (-1.5) when not blocked", () => {
      const msgs = [
        toolUse("bash", { command: "sed -n '1,10p' file.js" }),
        toolResult("line1\nline2"),
        assistantText("This is a detailed diagnosis that exceeds one hundred characters to avoid triggering the no-diagnosis penalty in session scoring logic."),
      ];
      const r = scoreMessages(msgs);
      expect(r.score).toBe(8.5);
    });

    it("applies reduced penalty (-0.25) when sed -n was blocked by agent guard", () => {
      const msgs = [
        toolUse("bash", { command: "sed -n '520,550p' startup/cron-jobs.js" }),
        toolResult(
          'BLOCKED: sed -n is forbidden \u2014 it floods context with line ranges. Use grep -n "pattern" <file> | head -30 to read a specific section, or cat <file> for the full file.',
        ),
        assistantText(
          "This is a detailed diagnosis that exceeds one hundred characters to avoid triggering the no-diagnosis penalty in session scoring logic.",
        ),
      ];
      const r = scoreMessages(msgs);
      expect(r.score).toBe(9.8); // 10 - 0.25 = 9.75, rounded to 1 decimal
      expect(r.issues[0]).toMatch(/blocked by agent guard/);
    });

    // Penalty 3: heavy grep context
    it("penalizes grep with >20 context lines (-1.0)", () => {
      const msgs = [
        toolUse("bash", { command: "grep -C 25 pattern file.js" }),
        toolResult("matches"),
        assistantText("The investigation of the issue shows that the pattern was found in multiple locations and the fix requires updating the handler logic across several files."),
      ];
      const r = scoreMessages(msgs);
      expect(r.score).toBe(9);
    });

    // Penalty 4: no diagnosis
    it("penalizes session ending without diagnosis (-2.0)", () => {
      const msgs = [
        userMsg("Fix the bug"),
        assistantText("OK"),
      ];
      const r = scoreMessages(msgs);
      expect(r.score).toBe(8);
    });

    it("does not penalize short closing after substantive diagnosis", () => {
      const msgs = [
        userMsg("Fix the bug"),
        assistantText(
          "I found the issue in auth.js line 42. The redirect URL was hardcoded to / instead of using req.originalUrl. I have updated the code to use the dynamic URL.",
        ),
        userMsg("thanks"),
        assistantText("Done."),
      ];
      const r = scoreMessages(msgs);
      // Should not get the no-diagnosis penalty because one of the last 3 has >100 chars
      expect(r.issues).not.toEqual(
        expect.arrayContaining([expect.stringContaining("without diagnosis")]),
      );
    });

    // Penalty 5: excessive tool calls
    it("penalizes >40 tool calls (-1.5)", () => {
      const msgs = [];
      for (let i = 0; i < 41; i++) {
        msgs.push(toolUse("read_file", { path: `/file${i}.js` }));
        msgs.push(toolResult("content"));
      }
      msgs.push(
        assistantText(
          "Completed analysis of all files. The codebase follows consistent patterns and the main issue is in the configuration loading module which needs to handle missing environment variables.",
        ),
      );
      const r = scoreMessages(msgs);
      expect(r.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("Excessive tool calls")]),
      );
    });

    it("penalizes >25 tool calls (-0.5)", () => {
      const msgs = [];
      for (let i = 0; i < 26; i++) {
        msgs.push(toolUse("read_file", { path: `/file${i}.js` }));
        msgs.push(toolResult("content"));
      }
      msgs.push(
        assistantText(
          "Completed analysis of the codebase. Found the root cause in the authentication middleware where session tokens were being stored incorrectly.",
        ),
      );
      const r = scoreMessages(msgs);
      expect(r.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("High tool call count")]),
      );
    });

    // Penalty 6: auto-compress
    it("penalizes auto-compress triggered (-0.5)", () => {
      const msgs = [
        assistantText("[auto-compressed] context was compacted"),
        assistantText(
          "After compaction I can now see the issue. The handler needs to properly validate input before processing the request. I have updated the validation logic.",
        ),
      ];
      const r = scoreMessages(msgs);
      expect(r.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("Auto-compress")]),
      );
    });

    // Penalty 7: duplicate tool calls
    it("penalizes 3+ identical tool calls (-1.0)", () => {
      const msgs = [
        toolUse("read_file", { path: "/same.js" }),
        toolResult("content"),
        toolUse("read_file", { path: "/same.js" }),
        toolResult("content"),
        toolUse("read_file", { path: "/same.js" }),
        toolResult("content"),
        assistantText(
          "After reading the file multiple times I can confirm the issue is in the export statement. The module needs to export the correct function signature.",
        ),
      ];
      const r = scoreMessages(msgs);
      expect(r.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("repeated")]),
      );
    });

    // Penalty 9: SSH reconnect storm
    it("penalizes SSH reconnect storm (-0.5) at 8+ consecutive calls", () => {
      const msgs = [];
      for (let i = 0; i < 9; i++) {
        msgs.push(toolUse("ssh_exec", { command: `check ${i}` }));
        msgs.push(toolResult("ok"));
      }
      msgs.push(
        assistantText(
          "Completed the server diagnostics. All services are running correctly. The API endpoint was temporarily unavailable due to a connection pool exhaustion issue.",
        ),
      );
      const r = scoreMessages(msgs);
      expect(r.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("SSH reconnect")]),
      );
    });

    it("does not penalize SSH storm below 8 consecutive calls", () => {
      const msgs = [];
      for (let i = 0; i < 6; i++) {
        msgs.push(toolUse("ssh_exec", { command: `check ${i}` }));
        msgs.push(toolResult("ok"));
      }
      msgs.push(
        assistantText(
          "Server diagnostics complete. All services healthy.",
        ),
      );
      const r = scoreMessages(msgs);
      expect(r.issues).not.toEqual(
        expect.arrayContaining([expect.stringContaining("SSH reconnect")]),
      );
    });

    // Penalty 9b: Surrender
    it("penalizes surrender when model asks user to provide server output (-2.0)", () => {
      const msgs = [];
      for (let i = 0; i < 4; i++) {
        msgs.push(toolUse("ssh_exec", { command: `check ${i}` }));
        msgs.push(toolResult("ok"));
      }
      msgs.push(
        assistantText(
          "Ich kann aktuell nicht direkt auf den Server zugreifen, da SSH temporär nicht verfügbar ist. Könntest du mir bitte die Logs bereitstellen?",
        ),
      );
      const r = scoreMessages(msgs);
      expect(r.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("Surrender")]),
      );
    });

    it("does not penalize surrender when no SSH calls were made", () => {
      const msgs = [
        assistantText(
          "Könntest du mir bitte die Logs bereitstellen?",
        ),
      ];
      const r = scoreMessages(msgs);
      expect(r.issues).not.toEqual(
        expect.arrayContaining([expect.stringContaining("Surrender")]),
      );
    });

    // Penalty 14: BLOCKED tool calls
    it("penalizes BLOCKED tool results", () => {
      const msgs = [
        toolUse("bash", { command: "rm -rf /" }),
        toolResult("BLOCKED: forbidden command"),
        assistantText(
          "I apologize for attempting that command. Let me use a safer approach to clean up the temporary files by targeting only the specific directory.",
        ),
      ];
      const r = scoreMessages(msgs);
      expect(r.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("blocked")]),
      );
    });

    // Penalty 15: super-nuclear context wipe
    it("penalizes super-nuclear context wipes", () => {
      const msgs = [
        userMsg("[SYSTEM WARNING] Context wiped 1× due to overflow"),
        assistantText(
          "Understood. I will proceed more carefully with reading files. Let me start by focusing on the specific function that needs to be fixed rather than reading entire files.",
        ),
      ];
      const r = scoreMessages(msgs);
      expect(r.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("context wipe")]),
      );
    });

    // Penalty 16: bash instead of dedicated tool
    it("penalizes bash cat instead of read_file", () => {
      const msgs = [
        toolUse("bash", { command: "cat server.js" }),
        toolResult("module.exports = ..."),
        assistantText(
          "Based on reading the file I can see the server configuration needs to be updated to use the new middleware pattern for handling authentication.",
        ),
      ];
      const r = scoreMessages(msgs);
      expect(r.issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining("bash used instead of dedicated tool"),
        ]),
      );
    });

    it("does not penalize cat > (write redirect)", () => {
      const msgs = [
        toolUse("bash", { command: "cat > output.txt << EOF\nhello\nEOF" }),
        toolResult(""),
        assistantText(
          "Created the output file with the required content. The heredoc approach ensures proper formatting of the multi-line configuration template.",
        ),
      ];
      const r = scoreMessages(msgs);
      expect(r.issues).not.toEqual(
        expect.arrayContaining([
          expect.stringContaining("bash used instead of dedicated tool"),
        ]),
      );
    });

    // Penalty 12: bash EXIT errors
    it("penalizes 10+ EXIT errors (-1.0)", () => {
      const msgs = [];
      for (let i = 0; i < 11; i++) {
        msgs.push(toolUse("bash", { command: `failing-cmd-${i}` }));
        msgs.push(toolResult("EXIT 1: command not found"));
      }
      msgs.push(
        assistantText(
          "After extensive debugging I found that the commands are not available in this environment. The issue is that the PATH variable is missing the required binary directories.",
        ),
      );
      const r = scoreMessages(msgs);
      expect(r.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("exit-error storm")]),
      );
    });

    // Penalty 14a: plan without reading files
    it("penalizes plan without reading files", () => {
      const msgs = [
        userMsg("Plan the auth refactor"),
        assistantText(
          "## Steps\n1. Create AuthService class\n2. Add JWT middleware\n3. Update routes\n/plan approve",
        ),
      ];
      const r = scoreMessages(msgs);
      expect(r.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("plan written without")]),
      );
    });

    // Grade mapping
    it("assigns correct grades", () => {
      expect(scoreMessages([assistantText("A".repeat(150))]).grade).toBe("A");
    });

    // Score clamping
    it("clamps score to 0 minimum", () => {
      // Trigger many penalties at once
      const msgs = [
        userMsg("[SYSTEM WARNING] re-read the same file already in your context"),
        userMsg("[SYSTEM WARNING] Context wiped 1× due to overflow"),
        userMsg("[SYSTEM WARNING] Context wiped 2× due to overflow"),
      ];
      // Add 42 identical tool calls to trigger excessive + duplicate
      for (let i = 0; i < 42; i++) {
        msgs.push(toolUse("bash", { command: "cat same.js" }));
        msgs.push(toolResult("EXIT 1: error"));
      }
      const r = scoreMessages(msgs);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(10);
    });
  });

  // ─── formatScore ──────────────────────────────────────────────────
  describe("formatScore()", () => {
    it("formats with color codes", () => {
      const result = { score: 9.5, grade: "A", issues: [], summary: "Clean" };
      const C = { dim: "", reset: "", green: "G", yellow: "Y", red: "R", cyan: "", bold: "B" };
      const out = formatScore(result, C);
      expect(out).toContain("9.5/10");
      expect(out).toContain("(A)");
    });

    it("lists issues with warning symbols", () => {
      const result = {
        score: 7,
        grade: "C",
        issues: ["test issue"],
        summary: "1 issue",
      };
      const out = formatScore(result);
      expect(out).toContain("test issue");
    });

    it("works without color object", () => {
      const result = { score: 5, grade: "F", issues: [], summary: "Bad" };
      expect(() => formatScore(result)).not.toThrow();
    });
  });

  // ─── appendScoreHistory ───────────────────────────────────────────
  describe("appendScoreHistory()", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-scorer-"));
    const origCwd = process.cwd();

    beforeEach(() => {
      process.chdir(tmpDir);
    });

    afterAll(() => {
      process.chdir(origCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates history file if it does not exist", () => {
      appendScoreHistory(8.5, { version: "0.3.84" });
      const histPath = path.join(tmpDir, ".nex", "benchmark-history.json");
      expect(fs.existsSync(histPath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(histPath, "utf-8"));
      expect(data).toHaveLength(1);
      expect(data[0].score).toBe(8.5);
      expect(data[0].grade).toBe("B");
    });

    it("caps history at 100 entries", () => {
      const histPath = path.join(tmpDir, ".nex", "benchmark-history.json");
      const bigHistory = Array.from({ length: 100 }, (_, i) => ({
        date: "2026-01-01",
        score: i,
      }));
      fs.writeFileSync(histPath, JSON.stringify(bigHistory));
      appendScoreHistory(9.5);
      const data = JSON.parse(fs.readFileSync(histPath, "utf-8"));
      expect(data.length).toBeLessThanOrEqual(100);
      expect(data[data.length - 1].score).toBe(9.5);
    });
  });
});

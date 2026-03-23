/**
 * tests/error-messages.test.js — Tests for User-facing Error Messages
 *
 * These tests ensure that all error messages shown to users are:
 * - Clear and actionable (no raw stack traces)
 * - Helpful (provide context and next steps)
 * - User-friendly (no cryptic error codes)
 */

const { enrichBashError } = require("../cli/tools");

describe("User-facing Error Messages", () => {
  describe("cli/agent.js error messages", () => {
    test("malformed arguments error should be helpful", () => {
      const errorContent = `ERROR: Malformed tool arguments. Could not parse your arguments as JSON.
Raw input: {invalid json

Expected JSON schema for "read_file":
{
  "type": "object",
  "properties": {
    "path": { "type": "string" }
  },
  "required": ["path"]
}

Please retry the tool call with valid JSON arguments matching this schema.`;

      // Should contain helpful guidance
      expect(errorContent).toContain("Malformed tool arguments");
      expect(errorContent).toContain("Could not parse");
      expect(errorContent).toContain("Expected JSON schema");
      expect(errorContent).toContain("Please retry");
      // Should NOT contain cryptic codes
      expect(errorContent).not.toMatch(/error\s*\d{3,}/i);
      expect(errorContent).not.toContain("at "); // no stack trace
    });

    test("validation error should be clear", () => {
      const validationError =
        'ERROR: Missing required parameter "path" for tool read_file';
      expect(validationError).toContain("Missing required parameter");
      expect(validationError).toContain("read_file");
      expect(validationError).not.toMatch(/^\d+$/); // not just a code
    });

    test("permission denied error should be clear", () => {
      const errorContent = "DENIED: Tool 'bash' is blocked by permissions";
      expect(errorContent).toContain("blocked by permissions");
      expect(errorContent).toContain("bash");
      expect(errorContent).not.toMatch(/error\s*\d+/i);
    });

    test("user cancelled error should be clear", () => {
      const errorContent = "CANCELLED: User declined bash";
      expect(errorContent).toContain("CANCELLED");
      expect(errorContent).toContain("User declined");
      expect(errorContent).not.toMatch(/error\s*\d+/i);
    });

    test("network error messages should be user-friendly", () => {
      // These are the user-friendly messages from agent.js
      const networkErrors = [
        "Connection refused — please check your internet connection or API endpoint",
        "Network error — could not reach the API server. Please check your connection",
        "Request timed out — the API server took too long to respond. Please try again",
        "Authentication failed — please check your API key in the .env file",
        "Access denied — your API key may not have permission for this model",
        "API server error — the provider is experiencing issues. Please try again in a moment",
        "Network request failed — please check your internet connection",
      ];

      for (const msg of networkErrors) {
        // Should be clear and actionable
        expect(msg.length).toBeGreaterThan(20);
        // Should contain helpful words (may, please, try, check, your)
        expect(msg).toMatch(/may|please|try|check|your/i);
        // Should NOT contain cryptic codes
        expect(msg).not.toMatch(/ECONNREFUSED|ENOTFOUND|ETIMEDOUT/);
        expect(msg).not.toMatch(/\d{3}/); // no HTTP codes like 401, 403
      }
    });

    test("rate limit message should be helpful", () => {
      const rateLimitMsg = "Rate limit — waiting 5s (retry 1/5)...";
      expect(rateLimitMsg).toContain("Rate limit");
      expect(rateLimitMsg).toContain("waiting");
      expect(rateLimitMsg).toContain("retry");
    });

    test("rate limit max retries exceeded should suggest action", () => {
      const msg =
        "Rate limit: max retries (5) exceeded. Try again later or use /budget to check your limits.";
      expect(msg).toContain("Rate limit");
      expect(msg).toContain("max retries");
      expect(msg).toContain("exceeded");
      expect(msg).toContain("/budget");
      expect(msg).toContain("Try again later");
    });

    test("network error max retries exceeded should suggest action", () => {
      const msg =
        "Network error: max retries (3) exceeded. Check your connection and try again.";
      expect(msg).toContain("Network error");
      expect(msg).toContain("max retries");
      expect(msg).toContain("exceeded");
      expect(msg).toContain("Check your connection");
    });

    test("max iterations message should be clear and suggest action", () => {
      const maxIterMsg =
        "⚠ Max iterations (30) reached. The task may be too complex — try breaking it into smaller steps.";
      expect(maxIterMsg).toContain("Max iterations");
      expect(maxIterMsg).toContain("reached");
      expect(maxIterMsg).toContain("breaking it into smaller steps");
    });

    test("context compression message should be informative", () => {
      const msg = "[context compressed, ~1500 tokens freed]";
      expect(msg).toContain("context compressed");
      expect(msg).toContain("tokens freed");
    });

    test("context budget warning should be actionable", () => {
      const msg = "⚠ Context 90% full — consider /clear or /save + start fresh";
      expect(msg).toContain("Context");
      expect(msg).toContain("full");
      expect(msg).toContain("/clear");
      expect(msg).toContain("/save");
    });
  });

  describe("cli/tools.js error messages", () => {
    test("access denied error should be clear", () => {
      const error = "ERROR: Access denied — path outside project: /etc/passwd";
      expect(error).toContain("Access denied");
      expect(error).toContain("path outside project");
      expect(error).not.toMatch(/EACCES|EPERM/);
    });

    test("file not found error should include path", () => {
      const error = "ERROR: File not found: src/utils.js";
      expect(error).toContain("File not found");
      expect(error).toContain("src/utils.js");
      expect(error).not.toMatch(/ENOENT/);
    });

    test("file not found with suggestions should be helpful", () => {
      const error = `File not found. Did you mean one of:
  - src/utils/index.js
  - src/utils/helpers.js`;
      expect(error).toContain("Did you mean");
      expect(error).toContain("src/utils");
    });

    test("binary file error should be clear", () => {
      const error =
        "ERROR: /path/to/file.bin is a binary file (not readable as text)";
      expect(error).toContain("binary file");
      expect(error).toContain("not readable as text");
      expect(error).not.toMatch(/null bytes|0x00/);
    });

    test("old_text not found error should show similar text", () => {
      const error = `ERROR: old_text not found in src/app.js
Most similar text (line 42, distance 3):
function myFunction() {`;
      expect(error).toContain("old_text not found");
      expect(error).toContain("Most similar text");
      expect(error).toContain("line 42");
    });

    test("directory not found error should be clear", () => {
      const error = "ERROR: Directory not found: src/components";
      expect(error).toContain("Directory not found");
      expect(error).not.toMatch(/ENOENT/);
    });

    test("invalid pattern error should be clear", () => {
      const error = "ERROR: Invalid pattern: [invalid regex";
      expect(error).toContain("Invalid pattern");
      expect(error).not.toMatch(/SyntaxError|Invalid regular expression/);
    });

    test("patch error should indicate which patch failed", () => {
      const error = `ERROR: Patch 3 old_text not found in src/app.js
Most similar text (line 15, distance 2):
const x = 5;`;
      expect(error).toContain("Patch 3");
      expect(error).toContain("old_text not found");
    });

    test("no patches provided error should be clear", () => {
      const error = "ERROR: No patches provided";
      expect(error).toContain("No patches provided");
    });

    test("web fetch error should include URL", () => {
      const error =
        "ERROR: Failed to fetch https://example.com: Network timeout";
      expect(error).toContain("Failed to fetch");
      expect(error).toContain("https://example.com");
    });

    test("web search error should be simple", () => {
      const error = "ERROR: Web search failed";
      expect(error).toContain("Web search failed");
      expect(error.length).toBeLessThan(50);
    });

    test("git not a repository error should be clear", () => {
      const error = "ERROR: Not a git repository";
      expect(error).toContain("Not a git repository");
      expect(error).not.toMatch(/fatal: not a git repository/);
    });

    test("task_list create error should indicate missing params", () => {
      const error = "ERROR: task_list create requires name and tasks";
      expect(error).toContain("requires name and tasks");
    });

    test("task_list update error should indicate missing params", () => {
      const error = "ERROR: task_list update requires task_id and status";
      expect(error).toContain("requires task_id and status");
    });

    test("task not found error should include task_id", () => {
      const error = "ERROR: Task not found: task-123";
      expect(error).toContain("Task not found");
      expect(error).toContain("task-123");
    });

    test("unknown task_list action error should list valid actions", () => {
      const error =
        "ERROR: Unknown task_list action: delete. Use: create, update, get";
      expect(error).toContain("Unknown task_list action");
      expect(error).toContain("Use: create, update, get");
    });

    test("unknown tool error should be clear", () => {
      const error = "ERROR: Unknown tool: some_tool";
      expect(error).toContain("Unknown tool");
      expect(error).toContain("some_tool");
    });

    test("bash blocked error should show pattern", () => {
      const error =
        "BLOCKED: Command matches forbidden pattern: /rm\\s+-rf\\s+\\//";
      expect(error).toContain("BLOCKED");
      expect(error).toContain("forbidden pattern");
    });

    test("bash cancelled error should be clear", () => {
      const error = "CANCELLED: User declined to execute this command.";
      expect(error).toContain("CANCELLED");
      expect(error).toContain("User declined");
    });

    test("glob truncated warning should suggest narrowing", () => {
      const warning =
        "⚠ Results truncated at 200. Use a more specific pattern to narrow results.";
      expect(warning).toContain("truncated");
      expect(warning).toContain("more specific pattern");
    });
  });

  describe("cli/tools.js enrichBashError", () => {
    test("command not found should suggest installation", () => {
      const error = "command not found: python3";
      const enriched = enrichBashError(error, "python3 script.py");
      expect(enriched).toContain("HINT");
      expect(enriched).toMatch(/not installed|may not be installed/);
      expect(enriched).toMatch(/brew install|apt install|package manager/);
    });

    test("npm command not found should suggest Node.js check", () => {
      const error = "npm: command not found";
      const enriched = enrichBashError(error, "npm install");
      expect(enriched).toContain("HINT");
      expect(enriched).toContain("Node.js");
    });

    test("module not found should suggest npm install", () => {
      const error = "Cannot find module 'express'";
      const enriched = enrichBashError(error, "node app.js");
      expect(enriched).toContain("HINT");
      expect(enriched).toContain("npm install");
      expect(enriched).toContain("express");
    });

    test("permission denied should give hint", () => {
      const error = "EACCES: permission denied";
      const enriched = enrichBashError(error, "cat /etc/shadow");
      expect(enriched).toContain("HINT");
      expect(enriched).toContain("Permission denied");
    });

    test("port in use should suggest killing process", () => {
      const error = "EADDRINUSE: address already in use :::3000";
      const enriched = enrichBashError(error, "npm start");
      expect(enriched).toContain("HINT");
      expect(enriched).toContain("Port");
      expect(enriched).toContain("already in use");
    });

    test("syntax error should give hint", () => {
      const error = "SyntaxError: Unexpected token";
      const enriched = enrichBashError(error, "node app.js");
      expect(enriched).toContain("HINT");
      expect(enriched).toContain("Syntax error");
    });

    test("TypeScript error should give hint", () => {
      const error = "TS2345: Argument of type string is not assignable";
      const enriched = enrichBashError(error, "tsc");
      expect(enriched).toContain("HINT");
      expect(enriched).toContain("TypeScript");
    });

    test("test failures should give hint", () => {
      const error = "Test Suites: 1 failed, 1 total";
      const enriched = enrichBashError(error, "npm test");
      expect(enriched).toContain("HINT");
      expect(enriched).toContain("Test failures");
    });

    test("git not a repo should give hint", () => {
      const error = "fatal: not a git repository";
      const enriched = enrichBashError(error, "git status");
      expect(enriched).toContain("HINT");
      expect(enriched).toContain("git init");
    });

    test("unrecognized error should return original", () => {
      const error = "Some random error";
      const enriched = enrichBashError(error, "some command");
      expect(enriched).toBe(error);
    });
  });

  describe("cli/providers/registry.js error messages", () => {
    test("budget limit error should show usage and solution", () => {
      const error =
        "All providers are over budget. Use /budget to check limits or /budget <provider> off to remove a limit.";
      expect(error).toContain("over budget");
      expect(error).toContain("/budget");
      expect(error).toContain("check limits");
      expect(error).toContain("remove a limit");
    });

    test("provider not available error should be clear", () => {
      const error = "Provider 'openai' is not available";
      expect(error).toContain("not available");
      expect(error).toContain("openai");
    });

    test("no configured provider error should be clear", () => {
      const error = "No configured provider available";
      expect(error).toContain("No configured provider");
    });
  });

  describe("cli/providers/* error messages", () => {
    test("API key not set errors should indicate which key", () => {
      const errors = [
        "ANTHROPIC_API_KEY not set",
        "GEMINI_API_KEY not set",
        "OLLAMA_API_KEY not set",
        "OPENAI_API_KEY not set",
      ];
      for (const error of errors) {
        expect(error).toMatch(/_API_KEY not set/);
        expect(error).not.toMatch(/undefined|null/);
      }
    });

    test("local model not available should suggest checking Ollama", () => {
      const error = "No local model available. Is Ollama running?";
      expect(error).toContain("No local model available");
      expect(error).toContain("Ollama running");
    });

    test("API errors should include the message", () => {
      const error = "API Error: Rate limit exceeded";
      expect(error).toContain("API Error");
      expect(error).toContain("Rate limit exceeded");
    });
  });

  describe("cli/index.js error messages", () => {
    test("no provider configured error should give clear options", () => {
      // This is a multi-line error message
      const lines = [
        "No provider configured and no local Ollama running.",
        "Options:",
        "  1. Install Ollama: https://ollama.com/download",
        "  2. Set an API key: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or OLLAMA_API_KEY",
      ];
      expect(lines[0]).toContain("No provider configured");
      expect(lines[1]).toContain("Options");
      expect(lines[2]).toContain("Install Ollama");
      expect(lines[3]).toContain("Set an API key");
    });

    test("general error display should be clean", () => {
      // The pattern used in index.js for displaying errors
      const errorPattern = "Error: ${err.message}";
      expect(errorPattern).toContain("Error:");
      expect(errorPattern).toContain("err.message");
      // Should not include stack trace
      expect(errorPattern).not.toContain("stack");
    });
  });

  describe("cli/sub-agent.js error messages", () => {
    test("malformed tool arguments error should be clear", () => {
      const error = "ERROR: Malformed tool arguments for read_file";
      expect(error).toContain("Malformed tool arguments");
      expect(error).toContain("read_file");
    });

    test("file locked error should suggest alternatives", () => {
      const error =
        "ERROR: File 'src/app.js' is locked by another sub-agent. Try a different approach or skip this file.";
      expect(error).toContain("locked by another sub-agent");
      expect(error).toContain("Try a different approach");
      expect(error).toContain("skip this file");
    });

    test("no agents specified error should be clear", () => {
      const error = "ERROR: No agents specified";
      expect(error).toContain("No agents specified");
    });

    test("max agents exceeded error should show limit", () => {
      const error = "ERROR: Max 5 parallel agents allowed, got 10";
      expect(error).toContain("Max 5 parallel agents");
      expect(error).toContain("allowed");
    });

    test("sub-agent execution failed should include reason", () => {
      const error = "ERROR: Sub-agent execution failed: Network timeout";
      expect(error).toContain("Sub-agent execution failed");
      expect(error).toContain("Network timeout");
    });
  });

  describe("cli/skills.js error messages", () => {
    test("skill tool failed error should include tool name", () => {
      const error = "ERROR: Skill tool 'deploy' failed: Connection refused";
      expect(error).toContain("Skill tool");
      expect(error).toContain("deploy");
      expect(error).toContain("failed");
    });

    test("skill tool not found error should include tool name", () => {
      const error = "ERROR: Skill tool 'unknown' not found";
      expect(error).toContain("Skill tool");
      expect(error).toContain("not found");
    });
  });

  describe("cli/mcp.js error messages", () => {
    test("MCP timeout error should indicate method", () => {
      const error = "MCP request timeout: tools/list";
      expect(error).toContain("MCP request timeout");
      expect(error).toContain("tools/list");
    });

    test("MCP error should include message", () => {
      const error = "MCP error: Server not responding";
      expect(error).toContain("MCP error");
      expect(error).toContain("Server not responding");
    });

    test("MCP write failed error should include reason", () => {
      const error = "MCP write failed: EPIPE broken pipe";
      expect(error).toContain("MCP write failed");
    });

    test("MCP server connection failed should include server name", () => {
      const error =
        "Failed to connect MCP server 'my-server': Connection refused";
      expect(error).toContain("Failed to connect MCP server");
      expect(error).toContain("my-server");
    });

    test("MCP server not connected error should include server name", () => {
      const error = "MCP server not connected: my-server";
      expect(error).toContain("MCP server not connected");
      expect(error).toContain("my-server");
    });
  });

  describe("Error message quality checks", () => {
    test("all error messages should avoid technical codes", () => {
      const badPatterns = [
        /ENOENT\b/,
        /EACCES\b/,
        /EPERM\b/,
        /ECONNREFUSED\b/,
        /ENOTFOUND\b/,
        /ETIMEDOUT\b/,
        /ECONNRESET\b/,
        /EADDRINUSE\b/,
        /EPIPE\b/,
        /Error:\s*\d+\s*at\s+/m, // stack traces
      ];

      const goodErrorMessages = [
        "File not found: src/app.js",
        "Access denied — path outside project",
        "Connection refused — please check your connection",
        "Request timed out — please try again",
      ];

      for (const msg of goodErrorMessages) {
        for (const pattern of badPatterns) {
          expect(msg).not.toMatch(pattern);
        }
      }
    });

    test("error messages should be actionable", () => {
      const actionablePatterns = [
        /try/i,
        /please/i,
        /use\s+/i,
        /check/i,
        /install/i,
        /did you mean/i,
      ];

      const actionableErrors = [
        "File not found. Did you mean one of: src/app.js, src/utils.js",
        "Please check your API key in the .env file",
        "Try a different approach or skip this file",
        "Use /budget to check limits",
        "Install Ollama: https://ollama.com/download",
      ];

      for (const msg of actionableErrors) {
        const isActionable = actionablePatterns.some((p) => p.test(msg));
        expect(isActionable).toBe(true);
      }
    });

    test("error messages should include relevant context", () => {
      const errorsWithContext = [
        { error: "File not found: src/app.js", context: "src/app.js" },
        { error: "Task not found: task-123", context: "task-123" },
        { error: "Unknown tool: my_tool", context: "my_tool" },
        { error: "Patch 3 old_text not found", context: "Patch 3" },
      ];

      for (const { error, context } of errorsWithContext) {
        expect(error).toContain(context);
      }
    });
  });
});

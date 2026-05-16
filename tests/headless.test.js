const { runCli } = require("./helpers/cli-harness");
const fs = require("fs");
const os = require("os");
const path = require("path");

describe("headless mode (bin/nex-code.js)", () => {
  // ─── --version ──────────────────────────────────────────────
  describe("--version", () => {
    it("prints version and exits", () => {
      const r = runCli(["--version"]);
      expect(r.exitCode).toBe(0);
      expect(r.stdoutStripped.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("short flag -v works", () => {
      const r = runCli(["-v"]);
      expect(r.exitCode).toBe(0);
      expect(r.stdoutStripped.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  // ─── --help ─────────────────────────────────────────────────
  describe("--help", () => {
    it("prints usage text and exits", () => {
      const r = runCli(["--help"]);
      expect(r.exitCode).toBe(0);
      expect(r.stdoutStripped).toContain("Usage:");
      for (const flag of ["--task", "--auto", "--model", "--json"])
        expect(r.stdoutStripped).toContain(flag);
    });

    it("short flag -h works", () => {
      const r = runCli(["-h"]);
      expect(r.exitCode).toBe(0);
      expect(r.stdoutStripped).toContain("Usage:");
    });
  });

  // ─── --daemon in --help ─────────────────────────────────────
  describe("--daemon flag", () => {
    it("--help output mentions --daemon", () => {
      const r = runCli(["--help"]);
      expect(r.stdoutStripped).toContain("--daemon");
    });
  });

  // ─── --task validation ──────────────────────────────────────
  describe("--task validation", () => {
    it("exits with error when --task has no prompt", () => {
      const r = runCli(["--task"], { expectError: true });
      expect(r.exitCode).toBe(1);
      expect(r.stderrStripped).toContain("requires a prompt");
    });

    it("exits with error when --task is followed by another flag", () => {
      const r = runCli(["--task", "--json"], { expectError: true });
      expect(r.exitCode).toBe(1);
    });
  });

  describe("headless fail-closed behavior", () => {
    it("exits non-zero when the run ends without a final assistant response", () => {
      const r = runCli(
        ["--auto", "--json", "--task", "Trigger null provider response."],
        {
          expectError: true,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_NULL_RESPONSE: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(1);
      const lines = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      const last = JSON.parse(lines[lines.length - 1]);
      expect(last.type).toBe("error");
      expect(last.success).toBe(false);
      expect(last.error).toContain("without a final assistant response");
    });

    it("exits non-zero when writes occur without a final summary", () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "nex-headless-"));
      const r = runCli(
        ["--auto", "--json", "--task", "Write a file and then stop."],
        {
          expectError: true,
          cwd,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_WRITE_THEN_NULL: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(1);
      expect(fs.readFileSync(path.join(cwd, "write-null.txt"), "utf-8")).toBe(
        "changed\n",
      );
      const lines = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const last = JSON.parse(lines[lines.length - 1]);
      expect(last.type).toBe("error");
      expect(last.success).toBe(false);
      expect(last.error).toContain("modified files");
    });

    it("finalizes when a kcal edit is read back before an empty provider response", () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "nex-headless-kcal-"));
      const r = runCli(
        [
          "--auto",
          "--json",
          "--task",
          "Update the nutrition display so kcal appears in the one-line diff, then verify the file readback.",
        ],
        {
          cwd,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_WRITE_READ_THEN_NULL: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(0);
      expect(
        fs.readFileSync(path.join(cwd, "headless-recovered.txt"), "utf-8"),
      ).toBe("stable edit\n");
      const events = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const last = events[events.length - 1];
      expect(last.type).toBe("done");
      expect(last.success).toBe(true);
      expect(last.response).toContain("Completed the requested edit");
      expect(last.response).toContain("post-edit readback");
    });

    it("finalizes a neutral file edit after readback when the provider returns empty", () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "nex-headless-neutral-"));
      const r = runCli(
        [
          "--auto",
          "--json",
          "--task",
          "Update src/components/ProfileCard.jsx and verify the edited file readback before finishing.",
        ],
        {
          cwd,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_WRITE_READ_THEN_NULL: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(0);
      const events = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const last = events[events.length - 1];
      expect(last.type).toBe("done");
      expect(last.success).toBe(true);
      expect(last.response).toContain("headless-recovered.txt");
      expect(last.response).toContain(
        "provider returned an empty response after successful post-edit verification",
      );
    });

    it("finalizes from the CLI wrapper when a stream aborts after verified readback", () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "nex-headless-abort-"));
      const r = runCli(
        [
          "--auto",
          "--json",
          "--task",
          "Update src/lib/request-handler.js and verify the edited file readback before finishing.",
        ],
        {
          cwd,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_WRITE_READ_THEN_NULL: "1",
            NEX_MOCK_WRITE_READ_THEN_ABORT_STREAM: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(0);
      const events = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const last = events[events.length - 1];
      expect(last.type).toBe("done");
      expect(last.success).toBe(true);
      expect(last.response).toContain("model stream ended");
      expect(last.response).toContain("post-edit readback");
    });

    it("does not recover as success when the write failed before readback", () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "nex-headless-failed-"));
      fs.writeFileSync(path.join(cwd, "headless-failed.txt"), "unchanged\n");
      const r = runCli(
        [
          "--auto",
          "--json",
          "--task",
          "Attempt an edit, read the file back, and finish.",
        ],
        {
          cwd,
          expectError: true,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_FAILED_WRITE_READ_ABORT_STREAM: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(1);
      const events = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const last = events[events.length - 1];
      expect(last.type).toBe("error");
      expect(last.success).toBe(false);
      expect(last.error).toContain("without a final assistant response");
      expect(fs.readFileSync(path.join(cwd, "headless-failed.txt"), "utf-8")).toBe(
        "unchanged\n",
      );
    });

    it("replaces confused post-edit questions with a verified-work summary", () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "nex-headless-question-"));
      const r = runCli(
        [
          "--auto",
          "--json",
          "--task",
          "Update src/lib/request-handler.js and verify the edited file readback before finishing.",
        ],
        {
          cwd,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_WRITE_READ_THEN_QUESTION: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(0);
      const events = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const last = events[events.length - 1];
      expect(last.type).toBe("done");
      expect(last.success).toBe(true);
      expect(last.response).toContain("Completed the requested edit");
      expect(last.response).toContain("confused follow-up question");
      expect(last.response).not.toContain("What would you like me to do");
    });

    it("emits a terminal error event when the process exits after tool_start", () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "nex-headless-exit-"));
      const r = runCli(
        ["--auto", "--json", "--task", "Refactor app.js to async / await."],
        {
          expectError: true,
          cwd,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_EXIT_AFTER_TOOL_START: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(1);
      const events = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      expect(events.some((event) => event.type === "tool_start")).toBe(true);
      expect(events.some((event) => event.type === "tool_end")).toBe(false);
      expect(events.some((event) => event.type === "done")).toBe(false);
      const last = events[events.length - 1];
      expect(last.type).toBe("error");
      expect(last.success).toBe(false);
      expect(last.error).toMatch(/unfinished tool call|Headless JSON run ended/);
    });

    it("emits a terminal error when the process exits 0 without a terminal event", () => {
      const r = runCli(
        ["--auto", "--json", "--task", "Exit before finishing."],
        {
          expectError: true,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_EXIT_ZERO_NO_TERMINAL: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(1);
      const events = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const last = events[events.length - 1];
      expect(last.type).toBe("error");
      expect(last.success).toBe(false);
      expect(last.error).toContain(
        "Headless JSON run ended before emitting a final done/error event",
      );
    });

    it("emits an error instead of done when the final response explicitly refuses success", () => {
      const r = runCli(
        ["--auto", "--json", "--task", "Run npm run lint before finishing."],
        {
          expectError: true,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_INCOMPLETE_VERIFY_RESPONSE: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(1);
      const events = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const last = events[events.length - 1];
      expect(last.type).toBe("error");
      expect(last.success).toBe(false);
      expect(last.error).toContain("Verification incomplete");
    });

    it(
      "emits a terminal error when thinking tokens flow but no content arrives for the abort threshold",
      () => {
        const r = runCli(
          [
            "--auto",
            "--json",
            "--task",
            "Fix the ESLint failures. Run npm run lint before finishing.",
          ],
          {
            expectError: true,
            timeout: 120000,
            env: {
              NEX_NO_DOTENV: "1",
              NEX_MOCK_PROVIDER: "1",
              NEX_MOCK_THINKING_NO_CONTENT: "1",
              NEX_STALE_ABORT_MS: "1000",
              HEADLESS_MODEL: "mock:mock-model",
              NEX_NO_FLATRATE: "1",
              OLLAMA_API_KEY: "",
              NEX_PHASE_ROUTING: "0",
            },
          },
        );
        expect(r.exitCode).toBe(1);
        const lines = r.stdoutStripped
          .trim()
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        expect(lines.length).toBeGreaterThan(0);
        const last = JSON.parse(lines[lines.length - 1]);
        expect(last.type).toBe("error");
        expect(last.success).toBe(false);
      },
      125000,
    );

    it("does not fail when thinking tokens arrive before visible content", () => {
      const r = runCli(
        ["--auto", "--json", "--task", "Fix the ESLint failures."],
        {
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_THINKING_BEFORE_CONTENT: "1",
            NEX_STALE_ABORT_MS: "1000",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(0);
      const lines = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      const last = JSON.parse(lines[lines.length - 1]);
      expect(last.type).toBe("done");
      expect(last.success).toBe(true);
    }, 30000);

    it(
      "watchdog emits terminal error when tools remain pending past threshold",
      () => {
        const r = runCli(
          [
            "--auto",
            "--json",
            "--task",
            "Refactor app.js to async / await.",
          ],
          {
            expectError: true,
            timeout: 30000,
            env: {
              NEX_NO_DOTENV: "1",
              NEX_MOCK_PROVIDER: "1",
              // The mock returns a tool call normally, and the agent loop
              // proceeds. The watchdog fires only if the process stalls
              // mid-tool-execution. To test the watchdog itself, use
              // NEX_MOCK_EXIT_AFTER_TOOL_START to simulate an exit during
              // tool execution, which historically caused a dangling
              // tool_start before the watchdog was added.
              NEX_MOCK_EXIT_AFTER_TOOL_START: "1",
              HEADLESS_MODEL: "mock:mock-model",
              NEX_NO_FLATRATE: "1",
              OLLAMA_API_KEY: "",
              NEX_PHASE_ROUTING: "0",
              // Fast watchdog for testing — fire at 2 seconds instead of 15
              NEX_PENDING_TOOLS_WATCHDOG_MS: "2000",
            },
          },
        );
        // The NEX_MOCK_EXIT_AFTER_TOOL_START trigger fires before the
        // watchdog has a chance (process.exit(0) runs immediately after
        // onToolStart). Both paths should produce a terminal error.
        expect(r.exitCode).toBe(1);
        const events = r.stdoutStripped
          .trim()
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        expect(events.some((event) => event.type === "tool_start")).toBe(true);
        // No tool_end because the process exited during execution
        expect(events.some((event) => event.type === "tool_end")).toBe(false);
        const last = events[events.length - 1];
        expect(last.type).toBe("error");
        expect(last.success).toBe(false);
        // Error message should mention the unfinished tool or the lifecycle failure
        expect(last.error).toMatch(
          /unfinished tool call|Headless JSON run ended/,
        );
      },
      35000,
    );

    it(
      "watchdog keeps the process alive and fails closed for unresolved tool promises",
      () => {
        const r = runCli(
          [
            "--auto",
            "--json",
            "--task",
            "Refactor app.js to async / await.",
          ],
          {
            expectError: true,
            timeout: 30000,
            env: {
              NEX_NO_DOTENV: "1",
              NEX_MOCK_PROVIDER: "1",
              NEX_MOCK_HANG_AFTER_TOOL_START: "1",
              HEADLESS_MODEL: "mock:mock-model",
              NEX_NO_FLATRATE: "1",
              OLLAMA_API_KEY: "",
              NEX_PHASE_ROUTING: "0",
              NEX_PENDING_TOOLS_WATCHDOG_MS: "2000",
            },
          },
        );
        expect(r.exitCode).toBe(1);
        const events = r.stdoutStripped
          .trim()
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        expect(events.some((event) => event.type === "tool_start")).toBe(true);
        expect(events.some((event) => event.type === "tool_end")).toBe(false);
        const last = events[events.length - 1];
        expect(last.type).toBe("error");
        expect(last.success).toBe(false);
        expect(last.error).toContain("Pending tool call");
      },
      35000,
    );

    // ─── Patch 3 regression: exit 0 blocked after dangling tool_start ──
    it(
      "emits terminal error (exit 1) when last event is a dangling tool_start with empty pending tools",
      () => {
        const r = runCli(
          [
            "--auto",
            "--json",
            "--task",
            "Refactor app.js to async / await.",
          ],
          {
            expectError: true,
            timeout: 30000,
            env: {
              NEX_NO_DOTENV: "1",
              NEX_MOCK_PROVIDER: "1",
              // Exit immediately after tool_start — this simulates a
              // lifecycle bug where the process exits 0 before the
              // pending-tools watchdog fires and mismatched tool_end
              // cleanup left pendingTools empty but lastJsonEventType
              // stuck at "tool_start".
              NEX_MOCK_EXIT_AFTER_TOOL_START: "1",
              HEADLESS_MODEL: "mock:mock-model",
              NEX_NO_FLATRATE: "1",
              OLLAMA_API_KEY: "",
              NEX_PHASE_ROUTING: "0",
              // Fast watchdog (won't fire because process exits first)
              NEX_PENDING_TOOLS_WATCHDOG_MS: "2000",
            },
          },
        );
        // The process.exit override must prevent exit 0 when the last
        // JSON event is a dangling tool_start, even if pendingTools is
        // empty (e.g. due to a race or bug).
        expect(r.exitCode).toBe(1);
        const events = r.stdoutStripped
          .trim()
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        const last = events[events.length - 1];
        expect(last.type).toBe("error");
        expect(last.success).toBe(false);
        // The error must mention either the unfinished tool or the
        // dangling tool_start / missing terminal event.
        expect(last.error).toMatch(
          /unfinished tool call|dangling tool_start|Headless JSON run ended/,
        );
      },
      35000,
    );
  });
});

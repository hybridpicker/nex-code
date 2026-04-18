"use strict";

const {
  extractBenchmarkMetrics,
  extractUsageFromDoneEvent,
  parseJsonEventStream,
} = require("../scripts/benchmark-reallife");

describe("benchmark reallife parser", () => {
  test("parses current JSON event stream for tool calls and usage", () => {
    const stdout = [
      JSON.stringify({ type: "token", text: "I" }),
      JSON.stringify({ type: "tool_start", tool: "read_file", args: { path: "package.json" } }),
      JSON.stringify({ type: "tool_end", tool: "read_file", summary: "Inspect · Read 10 lines", ok: true }),
      JSON.stringify({
        type: "done",
        success: true,
        response: "0.5.13",
        usage: { input: 123, output: 45, cacheRead: 0 },
        toolCalls: 1,
      }),
    ].join("\n");

    expect(parseJsonEventStream(stdout)).toHaveLength(4);
    expect(extractBenchmarkMetrics(stdout, "")).toEqual({
      toolCalls: 1,
      tokens: { input: 123, output: 45 },
      telemetry: {
        valid: true,
        source: "json",
        reason: null,
      },
      harnessDiagnostics: {
        jsonEventCount: 4,
        toolStartCount: 1,
        hasDoneEvent: true,
        stdoutBytes: Buffer.byteLength(stdout, "utf8"),
        stderrBytes: 0,
      },
    });
  });

  test("supports older done usage field names as fallback", () => {
    expect(
      extractUsageFromDoneEvent({
        type: "done",
        usage: { prompt_tokens: 200, completion_tokens: 80 },
      }),
    ).toEqual({ input: 200, output: 80 });
  });

  test("falls back to legacy tool detection when no JSON events are present", () => {
    const stdout = "{\"type\":\"tool_call\"}\n";
    expect(extractBenchmarkMetrics(stdout, "")).toEqual({
      toolCalls: 1,
      tokens: { input: 0, output: 0 },
      telemetry: {
        valid: false,
        source: "legacy-fallback",
        reason: "missing-done-event",
      },
      harnessDiagnostics: {
        jsonEventCount: 1,
        toolStartCount: 0,
        hasDoneEvent: false,
        stdoutBytes: Buffer.byteLength(stdout, "utf8"),
        stderrBytes: 0,
        usedLegacyFallback: true,
      },
    });
  });

  test("marks partial JSON streams without a done event as invalid telemetry", () => {
    const stdout = [
      JSON.stringify({ type: "tool_start", tool: "read_file", args: { path: "package.json" } }),
      JSON.stringify({ type: "tool_end", tool: "read_file", ok: true }),
    ].join("\n");

    expect(extractBenchmarkMetrics(stdout, "")).toEqual({
      toolCalls: 1,
      tokens: { input: 0, output: 0 },
      telemetry: {
        valid: false,
        source: "json",
        reason: "missing-done-event",
      },
      harnessDiagnostics: {
        jsonEventCount: 2,
        toolStartCount: 1,
        hasDoneEvent: false,
        stdoutBytes: Buffer.byteLength(stdout, "utf8"),
        stderrBytes: 0,
      },
    });
  });
});

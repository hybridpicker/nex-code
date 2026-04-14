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
    });
  });
});

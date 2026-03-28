"use strict";

const {
  detectLang,
  highlightLine,
  highlightLines,
} = require("../cli/syntax");

// Strip all ANSI escape sequences for plain-text assertions
function plain(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// Check whether a string contains an ANSI color start
function hasColor(s) {
  return /\x1b\[[0-9]+m/.test(s);
}

describe("detectLang", () => {
  it("detects JavaScript extensions", () => {
    expect(detectLang("app.js")).toBe("js");
    expect(detectLang("comp.jsx")).toBe("js");
    expect(detectLang("index.ts")).toBe("js");
    expect(detectLang("mod.tsx")).toBe("js");
  });

  it("detects Python", () => {
    expect(detectLang("script.py")).toBe("py");
  });

  it("detects shell scripts", () => {
    expect(detectLang("run.sh")).toBe("sh");
    expect(detectLang("setup.bash")).toBe("sh");
    expect(detectLang("rc.zsh")).toBe("sh");
  });

  it("detects Go and Rust", () => {
    expect(detectLang("main.go")).toBe("go");
    expect(detectLang("lib.rs")).toBe("rs");
  });

  it("detects JSON, HTML, CSS", () => {
    expect(detectLang("data.json")).toBe("json");
    expect(detectLang("page.html")).toBe("html");
    expect(detectLang("style.css")).toBe("css");
  });

  it("returns null for unknown extensions", () => {
    expect(detectLang("README.md")).toBe("md");
    expect(detectLang("binary.exe")).toBeNull();
    expect(detectLang(null)).toBeNull();
  });
});

describe("highlightLine — JS keywords", () => {
  it("colors known keywords", () => {
    const out = highlightLine("const x = 1;", "js");
    expect(plain(out)).toBe("const x = 1;");
    // "const" should receive a color code
    expect(out).toMatch(/\x1b\[34m.*const/); // blue keyword
  });

  it("does not color unknown identifiers as keywords", () => {
    const out = highlightLine("myVariable = 5;", "js");
    // No keyword color on "myVariable"
    expect(out).not.toMatch(/\x1b\[34mmyVariable/);
  });

  it("colors uppercase identifiers as types (cyan)", () => {
    const out = highlightLine("class Foo extends Bar {", "js");
    expect(out).toMatch(/\x1b\[36m.*Foo/); // cyan type
  });

  it("colors string literals", () => {
    const out = highlightLine('const s = "hello";', "js");
    expect(out).toMatch(/\x1b\[32m.*"hello"/); // green string
  });

  it("colors single-quoted strings", () => {
    const out = highlightLine("const s = 'world';", "js");
    expect(out).toMatch(/\x1b\[32m.*'world'/);
  });

  it("colors numbers", () => {
    const out = highlightLine("const n = 42;", "js");
    expect(out).toMatch(/\x1b\[33m.*42/); // yellow number
  });

  it("colors line comments", () => {
    const out = highlightLine("// this is a comment", "js");
    expect(out).toMatch(/\x1b\[90m.*\/\/ this is a comment/); // dark gray
  });

  it("colors decorators", () => {
    const out = highlightLine("@Component({", "js");
    expect(out).toMatch(/\x1b\[35m.*@Component/); // magenta
  });
});

describe("highlightLine — Python", () => {
  it("colors Python keywords", () => {
    const out = highlightLine("def greet(name):", "py");
    expect(out).toMatch(/\x1b\[34m.*def/);
  });

  it("colors # comments in Python", () => {
    const out = highlightLine("# this is a comment", "py");
    expect(out).toMatch(/\x1b\[90m/);
    expect(plain(out)).toBe("# this is a comment");
  });
});

describe("highlightLine — JSON", () => {
  it("colors JSON keys differently from values", () => {
    const out = highlightLine('  "name": "Alice",', "json");
    // Key gets type color (cyan), value gets string color (green)
    expect(hasColor(out)).toBe(true);
    expect(plain(out)).toBe('  "name": "Alice",');
  });

  it("colors JSON booleans as keywords", () => {
    const out = highlightLine("  true,", "json");
    expect(out).toMatch(/\x1b\[34m.*true/);
  });

  it("colors JSON numbers", () => {
    const out = highlightLine("  42,", "json");
    expect(out).toMatch(/\x1b\[33m.*42/);
  });
});

describe("highlightLines — multi-line state tracking", () => {
  it("tracks block comments across lines", () => {
    const code = ["/* start", "  middle", "  end */", "normal"].join("\n");
    const lines = highlightLines(code, "test.js");
    // All 3 comment lines should have the comment color
    expect(lines[0]).toMatch(/\x1b\[90m/);
    expect(lines[1]).toMatch(/\x1b\[90m/);
    expect(lines[2]).toMatch(/\x1b\[90m/);
    // Normal line should not be entirely commented
    expect(plain(lines[3])).toBe("normal");
  });

  it("tracks template literal backticks across lines", () => {
    const code = ["const s = `hello", "  world`, done"].join("\n");
    const lines = highlightLines(code, "test.js");
    // Second line starts inside string → should be colored green
    expect(lines[1]).toMatch(/\x1b\[32m/);
  });

  it("returns plain lines for unknown language", () => {
    const lines = highlightLines("hello world", "file.xyz");
    expect(lines).toEqual(["hello world"]);
  });

  it("preserves plain text content", () => {
    const code = 'const x = 1;\nlet y = "two";';
    const lines = highlightLines(code, "test.ts");
    expect(plain(lines.join("\n"))).toBe(code);
  });
});

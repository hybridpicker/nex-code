"use strict";

const {
  detectLang,
  highlightLine,
  highlightLines,
} = require("../cli/syntax");
const { T } = require("../cli/theme");

// Strip all ANSI escape sequences for plain-text assertions
function plain(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// Check whether a string contains an ANSI color start
function hasColor(s) {
  return /\x1b\[[0-9;]+m/.test(s);
}

// Check whether a string contains a specific theme color
function hasThemeColor(s, color) {
  const escaped = color.replace(/[[\]\\]/g, "\\$&");
  return new RegExp(escaped).test(s);
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
    expect(hasThemeColor(out, T.syn_keyword)).toBe(true);
  });

  it("does not color unknown identifiers as keywords", () => {
    const out = highlightLine("myVariable = 5;", "js");
    expect(out).not.toContain(T.syn_keyword + "myVariable");
  });

  it("colors uppercase identifiers as types (cyan)", () => {
    const out = highlightLine("class Foo extends Bar {", "js");
    expect(hasThemeColor(out, T.cyan)).toBe(true);
  });

  it("colors string literals", () => {
    const out = highlightLine('const s = "hello";', "js");
    expect(hasThemeColor(out, T.syn_string)).toBe(true);
  });

  it("colors single-quoted strings", () => {
    const out = highlightLine("const s = 'world';", "js");
    expect(hasThemeColor(out, T.syn_string)).toBe(true);
  });

  it("colors numbers", () => {
    const out = highlightLine("const n = 42;", "js");
    expect(hasThemeColor(out, T.syn_number)).toBe(true);
  });

  it("colors line comments", () => {
    const out = highlightLine("// this is a comment", "js");
    expect(hasThemeColor(out, T.syn_comment)).toBe(true);
  });

  it("colors decorators", () => {
    const out = highlightLine("@Component({", "js");
    expect(hasThemeColor(out, T.magenta)).toBe(true);
  });
});

describe("highlightLine — Python", () => {
  it("colors Python keywords", () => {
    const out = highlightLine("def greet(name):", "py");
    expect(hasThemeColor(out, T.syn_keyword)).toBe(true);
  });

  it("colors # comments in Python", () => {
    const out = highlightLine("# this is a comment", "py");
    expect(hasThemeColor(out, T.syn_comment)).toBe(true);
    expect(plain(out)).toBe("# this is a comment");
  });
});

describe("highlightLine — JSON", () => {
  it("colors JSON keys differently from values", () => {
    const out = highlightLine('  "name": "Alice",', "json");
    expect(hasColor(out)).toBe(true);
    expect(plain(out)).toBe('  "name": "Alice",');
  });

  it("colors JSON booleans as keywords", () => {
    const out = highlightLine("  true,", "json");
    expect(hasThemeColor(out, T.syn_keyword)).toBe(true);
  });

  it("colors JSON numbers", () => {
    const out = highlightLine("  42,", "json");
    expect(hasThemeColor(out, T.syn_number)).toBe(true);
  });
});

describe("highlightLines — multi-line state tracking", () => {
  it("tracks block comments across lines", () => {
    const code = ["/* start", "  middle", "  end */", "normal"].join("\n");
    const lines = highlightLines(code, "test.js");
    expect(hasThemeColor(lines[0], T.syn_comment)).toBe(true);
    expect(hasThemeColor(lines[1], T.syn_comment)).toBe(true);
    expect(hasThemeColor(lines[2], T.syn_comment)).toBe(true);
    expect(plain(lines[3])).toBe("normal");
  });

  it("tracks template literal backticks across lines", () => {
    const code = ["const s = `hello", "  world`, done"].join("\n");
    const lines = highlightLines(code, "test.js");
    expect(hasThemeColor(lines[1], T.syn_string)).toBe(true);
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

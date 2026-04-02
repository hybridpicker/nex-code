/**
 * cli/syntax.js — Lightweight ANSI syntax highlighter
 *
 * Single-pass, line-aware tokenizer for terminal output.
 * No external dependencies — uses only 16-color ANSI codes.
 *
 * Supported languages: JS/JSX/TS/TSX, Python, CSS/SCSS,
 * HTML/XML, JSON, Shell, Go, Rust, Java
 */

"use strict";

// ─── ANSI token colors (explicit RGB via theme, readable on all terminals) ───
const { T } = require("./theme");
const S = {
  kw:    T.syn_keyword, // blue — keywords
  str:   T.syn_string,  // green — string literals
  cmt:   T.syn_comment, // dark gray — comments
  num:   T.syn_number,  // yellow — numbers
  type:  T.cyan,        // cyan — class names / types / tags
  punct: T.magenta,     // magenta — decorators / annotations
  reset: T.reset,
};

// ─── Keyword sets per language ────────────────────────────────────────────────
const KW = {
  js: new Set([
    "const","let","var","function","return","if","else","for","while","do",
    "class","new","this","import","export","from","default","async","await",
    "try","catch","finally","throw","typeof","instanceof","in","of","switch",
    "case","break","continue","null","undefined","true","false","extends",
    "super","static","get","set","delete","void","yield","interface","type",
    "enum","namespace","abstract","implements","declare","module","require",
    "readonly","keyof","infer","never","unknown","any","as","satisfies",
  ]),
  py: new Set([
    "def","class","return","if","elif","else","for","while","with","as",
    "import","from","pass","break","continue","try","except","finally",
    "raise","in","not","and","or","is","lambda","yield","global","nonlocal",
    "del","assert","True","False","None","async","await","self","cls",
    "print","range","len","type","list","dict","set","tuple","str","int",
    "float","bool","open","super","property","staticmethod","classmethod",
  ]),
  sh: new Set([
    "if","then","else","elif","fi","for","while","do","done","case","esac",
    "in","function","return","local","export","source","echo","exit",
    "break","continue","readonly","unset","shift","trap","read",
  ]),
  go: new Set([
    "func","return","if","else","for","range","type","struct","interface",
    "import","package","var","const","defer","go","chan","select","case",
    "default","break","continue","fallthrough","nil","true","false",
    "make","new","len","cap","append","copy","delete","panic","recover",
    "map","error","string","int","int64","int32","uint","bool","byte","rune",
  ]),
  rs: new Set([
    "fn","let","mut","return","if","else","for","while","loop","match",
    "use","mod","pub","struct","enum","impl","trait","where","const",
    "static","type","move","ref","in","as","unsafe","extern","crate",
    "self","Self","super","true","false","None","Some","Ok","Err",
    "i32","i64","u32","u64","usize","f32","f64","bool","str","String","Vec",
  ]),
  java: new Set([
    "class","interface","extends","implements","import","package","return",
    "if","else","for","while","do","switch","case","break","continue",
    "new","this","super","null","true","false","public","private","protected",
    "static","final","abstract","void","int","long","double","float",
    "boolean","char","byte","short","try","catch","finally","throw","throws",
    "synchronized","volatile","transient","instanceof","enum","record",
  ]),
};

// ─── Language detection ───────────────────────────────────────────────────────

const EXT_MAP = {
  js:"js", jsx:"js", ts:"js", tsx:"js", mjs:"js", cjs:"js",
  py:"py",
  css:"css", scss:"css", less:"css",
  sh:"sh", bash:"sh", zsh:"sh",
  go:"go",
  rs:"rs",
  java:"java",
  json:"json",
  html:"html", htm:"html",
  xml:"xml",
  md:"md",
};

/**
 * Detect language from a file path.
 * @param {string|null} filePath
 * @returns {string|null}
 */
function detectLang(filePath) {
  if (!filePath) return null;
  const ext = filePath.split(".").pop().toLowerCase();
  return EXT_MAP[ext] || null;
}

// ─── ANSI-safe regex replacement ────────────────────────────────────────────
// Applies a regex replacement only to non-ANSI text segments,
// preventing colour codes inserted by earlier passes from being re-tokenized.
const ANSI_RE = /\x1b\[[0-9;]*m/g;

function _replaceOutsideAnsi(str, regex, replacer) {
  const parts = str.split(ANSI_RE);
  const codes = str.match(ANSI_RE) || [];
  let result = "";
  for (let i = 0; i < parts.length; i++) {
    result += parts[i].replace(regex, replacer);
    if (i < codes.length) result += codes[i];
  }
  return result;
}

// ─── Per-language highlight functions ────────────────────────────────────────

function _highlightJSON(line) {
  let out = line;
  // Keys first (object property names)
  out = out.replace(/"([^"\\]|\\.)*"\s*:/g, (m) => S.type + m + S.reset);
  // Remaining strings
  out = _replaceOutsideAnsi(out, /"([^"\\]|\\.)*"/g, (m) => S.str + m + S.reset);
  // Numbers
  out = _replaceOutsideAnsi(out, /\b-?(\d+(\.\d+)?([eE][+-]?\d+)?)\b/g, (m) => S.num + m + S.reset);
  // Keywords
  out = _replaceOutsideAnsi(out, /\b(true|false|null)\b/g, (m) => S.kw + m + S.reset);
  return out;
}

function _highlightHTML(line) {
  // Comments
  if (/<!--/.test(line)) {
    return line.replace(/<!--[\s\S]*?(?:-->|$)/g, (m) => S.cmt + m + S.reset);
  }
  let out = line;
  // Closing / opening tag names
  out = out.replace(/(<\/?)([a-zA-Z][a-zA-Z0-9.-]*)/g, (m, open, tag) =>
    open + S.type + tag + S.reset);
  // Attribute names
  out = _replaceOutsideAnsi(out, /\s([a-zA-Z][a-zA-Z0-9-]*)=/g, (m, attr) =>
    " " + S.kw + attr + S.reset + "=");
  // Attribute values
  out = _replaceOutsideAnsi(out, /"([^"]*)"/g, (m) => S.str + m + S.reset);
  return out;
}

function _highlightCSS(line) {
  let out = line;
  // Block comments
  out = out.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, (m) => S.cmt + m + S.reset);
  // Hex colors
  out = _replaceOutsideAnsi(out, /#[0-9a-fA-F]{3,8}\b/g, (m) => S.num + m + S.reset);
  // Numbers with units
  out = _replaceOutsideAnsi(out, /\b(-?\d+(?:\.\d+)?)(px|em|rem|vh|vw|vmin|vmax|%|s|ms|deg|fr)\b/g,
    (m, n, u) => S.num + n + S.reset + u);
  // CSS property names (word followed by colon)
  out = _replaceOutsideAnsi(out, /([a-z][a-z-]*)(\s*:)/g, (m, prop, colon) =>
    S.type + prop + S.reset + colon);
  // Strings
  out = _replaceOutsideAnsi(out, /"[^"]*"|'[^']*'/g, (m) => S.str + m + S.reset);
  return out;
}

// ─── Main tokenizer (JS / PY / SH / GO / RS / JAVA) ─────────────────────────

/**
 * Highlight one line with a persistent parse state.
 *
 * @param {string} line
 * @param {string} lang
 * @param {{ inString: string|null, inBlockComment: boolean }} state  Mutated in place.
 * @returns {string} ANSI-colored line
 */
function _highlightLine(line, lang, state) {
  // Delegate to dedicated highlighters
  if (lang === "json") return _highlightJSON(line);
  if (lang === "html" || lang === "xml") return _highlightHTML(line);
  if (lang === "css") return _highlightCSS(line);
  if (lang === "md") return line;

  const kws = KW[lang] || KW.js;
  let out = "";
  let i = 0;

  // ── Resume inside block comment ───────────────────────────────────────────
  if (state.inBlockComment) {
    const end = line.indexOf("*/");
    if (end === -1) return S.cmt + line + S.reset;
    out += S.cmt + line.slice(0, end + 2) + S.reset;
    state.inBlockComment = false;
    i = end + 2;
    if (i >= line.length) return out;
  }

  // ── Resume inside multi-line template literal ─────────────────────────────
  if (state.inString === "`") {
    const end = line.indexOf("`");
    if (end === -1) return S.str + line + S.reset;
    out += S.str + line.slice(0, end + 1) + S.reset;
    state.inString = null;
    i = end + 1;
    if (i >= line.length) return out;
  }

  // ── Token loop ────────────────────────────────────────────────────────────
  while (i < line.length) {
    const ch = line[i];

    // Block comment start (not inside string)
    if (!state.inString && ch === "/" && line[i + 1] === "*") {
      const end = line.indexOf("*/", i + 2);
      if (end === -1) {
        out += S.cmt + line.slice(i) + S.reset;
        state.inBlockComment = true;
        return out;
      }
      out += S.cmt + line.slice(i, end + 2) + S.reset;
      i = end + 2;
      continue;
    }

    // Line comment
    if (!state.inString) {
      const isLC =
        ((lang === "js" || lang === "go" || lang === "rs" || lang === "java") &&
          ch === "/" && line[i + 1] === "/") ||
        ((lang === "py" || lang === "sh") && ch === "#");
      if (isLC) {
        out += S.cmt + line.slice(i) + S.reset;
        return out;
      }
    }

    // String start
    if (!state.inString && (ch === '"' || ch === "'" || ch === "`")) {
      state.inString = ch;
      out += S.str + ch;
      i++;
      continue;
    }

    // Inside string
    if (state.inString) {
      if (ch === "\\" && i + 1 < line.length) {
        out += ch + line[i + 1];
        i += 2;
        continue;
      }
      if (ch === state.inString) {
        out += ch + S.reset;
        state.inString = null;
        i++;
        continue;
      }
      out += ch;
      i++;
      continue;
    }

    // Number (must not be part of an identifier)
    if (/[0-9]/.test(ch) && (i === 0 || !/[a-zA-Z0-9_$]/.test(line[i - 1]))) {
      let num = "";
      while (i < line.length && /[0-9a-fA-F_.xXoObBeE+-]/.test(line[i]) &&
             !(num.length > 0 && /[eE]/.test(line[i - 1]) && /[^+-]/.test(ch))) {
        num += line[i++];
      }
      out += S.num + num + S.reset;
      continue;
    }

    // Decorator / annotation
    if (ch === "@" && (lang === "js" || lang === "java" || lang === "py")) {
      let word = "@";
      i++;
      while (i < line.length && /[a-zA-Z0-9_$.]/.test(line[i])) word += line[i++];
      out += S.punct + word + S.reset;
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_$]/.test(ch)) {
      let word = "";
      while (i < line.length && /[a-zA-Z0-9_$]/.test(line[i])) word += line[i++];
      if (kws.has(word)) {
        out += S.kw + word + S.reset;
      } else if (
        /^[A-Z][A-Za-z0-9]*$/.test(word) &&
        lang !== "sh"
      ) {
        out += S.type + word + S.reset;
      } else {
        out += word;
      }
      continue;
    }

    out += ch;
    i++;
  }

  // Close any unclosed inline string (single-line strings that were opened but not closed)
  if (state.inString && state.inString !== "`") {
    out += S.reset;
    state.inString = null;
  }

  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Highlight a block of code, returning one highlighted line per input line.
 * Maintains parse state across lines (block comments, template literals).
 *
 * @param {string} content - Full content to highlight
 * @param {string|null} filePath - Used for language detection
 * @returns {string[]} Highlighted lines
 */
function highlightLines(content, filePath) {
  const lang = detectLang(filePath);
  if (!lang) return content.split("\n");
  const lines = content.split("\n");
  const state = { inString: null, inBlockComment: false };
  return lines.map((line) => _highlightLine(line, lang, state));
}

/**
 * Highlight a single line. Useful when lines are already split.
 * For multi-line state tracking use highlightLines().
 *
 * @param {string} line
 * @param {string|null} lang - Language key (from detectLang) or null
 * @returns {string}
 */
function highlightLine(line, lang) {
  if (!lang) return line;
  const state = { inString: null, inBlockComment: false };
  return _highlightLine(line, lang, state);
}

module.exports = { detectLang, highlightLine, highlightLines };

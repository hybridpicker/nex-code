#!/usr/bin/env node
var K = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports);
var Cn = K((Qx, mm) => {
  mm.exports = {
    name: "nex-code",
    version: "0.3.77",
    description:
      "The open-source agentic coding CLI. Free with Ollama Cloud \u2014 switch to OpenAI, Anthropic or Gemini anytime. Alternative to Claude Code & Gemini CLI.",
    bin: { "nex-code": "./dist/nex-code.js" },
    files: ["dist/", "README.md", "LICENSE"],
    engines: { node: ">=18.0.0" },
    scripts: {
      start: "node dist/nex-code.js",
      build:
        "esbuild bin/nex-code.js --bundle --platform=node --target=node18 --outfile=dist/nex-code.js --minify --external:axios --external:dotenv --external:playwright",
      test: "jest --forceExit",
      "test:orchestrator": "jest tests/orchestrator.test.js --forceExit",
      coverage: "jest --coverage --forceExit",
      "test:watch": "jest --watch",
      format: "prettier --write .",
      "install-hooks":
        "ln -sf ../../hooks/pre-push .git/hooks/pre-push && chmod +x .git/hooks/pre-push && ln -sf ../../hooks/post-merge .git/hooks/post-merge && chmod +x .git/hooks/post-merge && echo 'Hooks installed (pre-push, post-merge).'",
      prepublishOnly: "npm run build && npm test",
      "merge-to-main": "bash scripts/merge-to-main.sh",
      release: "npm version patch && git push --follow-tags && npm publish",
    },
    keywords: [
      "ai",
      "cli",
      "coding",
      "agent",
      "ollama",
      "ollama-cloud",
      "openai",
      "anthropic",
      "claude",
      "gemini",
      "llm",
      "gpt",
      "agentic",
      "terminal",
      "coding-assistant",
      "claude-code-alternative",
      "gemini-cli-alternative",
      "open-source",
      "free",
      "qwen3",
      "devstral",
      "kimi-k2",
      "deepseek",
      "local-llm",
      "mcp",
      "model-context-protocol",
      "multi-provider",
    ],
    repository: {
      type: "git",
      url: "https://github.com/hybridpicker/nex-code.git",
    },
    bugs: { url: "https://github.com/hybridpicker/nex-code/issues" },
    homepage: "https://github.com/hybridpicker/nex-code#readme",
    license: "MIT",
    dependencies: { axios: "^1.7.0", dotenv: "^16.4.0" },
    devDependencies: { esbuild: "^0.27.3", jest: "^29.7.0" },
    jest: {
      coverageThreshold: {
        global: { lines: 45, functions: 30, branches: 35 },
        "./cli/sub-agent.js": { lines: 70, functions: 60, branches: 55 },
      },
    },
  };
});
var dn = K((Zx, _c) => {
  "use strict";
  var hc = "\x1B[0m",
    gc = "\x1B[1m",
    An = "\x1B[2m";
  function j(t, e, s) {
    return `\x1B[38;2;${t};${e};${s}m`;
  }
  function hm() {
    if (!process.stdout.isTTY) return null;
    try {
      let { execFileSync: t } = require("child_process"),
        e = [
          "import sys,os,tty,termios,select",
          "f=open('/dev/tty','r+b',buffering=0)",
          "fd=f.fileno()",
          "s=termios.tcgetattr(fd)",
          "try:",
          " tty.setraw(fd)",
          " f.write(bytes([0x1b,0x5d,0x31,0x31,0x3b,0x3f,0x1b,0x5c]))",
          " r=select.select([fd],[],[],0.1)[0]",
          " d=b''",
          " if r:",
          "  while True:",
          "   r2=select.select([fd],[],[],0.05)[0]",
          "   if not r2:break",
          "   c=os.read(fd,1)",
          "   d+=c",
          "   if d[-1:]==bytes([0x07]) or d[-2:]==bytes([0x1b,0x5c]):break",
          " sys.stdout.buffer.write(d)",
          "finally:",
          " termios.tcsetattr(fd,termios.TCSADRAIN,s)",
          " f.close()",
        ].join(`
`),
        n = t("python3", ["-c", e], {
          encoding: "buffer",
          timeout: 400,
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString("utf8")
          .match(/rgb:([0-9a-fA-F]+)\/([0-9a-fA-F]+)\/([0-9a-fA-F]+)/);
      if (n) {
        let r = parseInt(n[1].slice(0, 2), 16),
          i = parseInt(n[2].slice(0, 2), 16),
          c = parseInt(n[3].slice(0, 2), 16);
        return 0.299 * r + 0.587 * i + 0.114 * c < 128;
      }
    } catch {}
    return null;
  }
  function $c() {
    let t = require("os");
    return require("path").join(t.homedir(), ".nex-code", ".theme_cache.json");
  }
  function gm(t) {
    try {
      let s = require("fs").readFileSync($c(), "utf8"),
        o = JSON.parse(s);
      if (o && typeof o[t] == "boolean") return o[t];
    } catch {}
    return null;
  }
  function $m(t, e) {
    try {
      let s = require("fs"),
        o = require("path"),
        n = $c(),
        r = o.dirname(n),
        i = {};
      try {
        i = JSON.parse(s.readFileSync(n, "utf8"));
      } catch {}
      i[t] = e;
      let c = Object.keys(i);
      (c.length > 50 && c.slice(0, c.length - 50).forEach((l) => delete i[l]),
        s.existsSync(r) || s.mkdirSync(r, { recursive: !0 }),
        s.writeFileSync(n, JSON.stringify(i), "utf8"));
    } catch {}
  }
  function ym() {
    let t = (process.env.NEX_THEME || "").toLowerCase();
    if (t === "light") return !1;
    if (t === "dark") return !0;
    let e = process.env.COLORFGBG;
    if (e) {
      let i = e.split(";"),
        c = parseInt(i[i.length - 1], 10);
      if (!isNaN(c)) return c < 8;
    }
    let s = process.env.TERM_SESSION_ID || "default",
      o = gm(s);
    if (o !== null) return o;
    let n = hm(),
      r = n !== null ? n : !0;
    return ($m(s, r), r);
  }
  var yc = ym(),
    wc = {
      reset: hc,
      bold: gc,
      dim: An,
      primary: j(80, 190, 255),
      secondary: j(60, 170, 190),
      success: j(80, 210, 120),
      warning: j(245, 175, 50),
      error: j(230, 80, 80),
      muted: An,
      subtle: j(130, 130, 145),
      tool_read: j(80, 190, 255),
      tool_write: j(245, 165, 55),
      tool_exec: j(185, 100, 235),
      tool_search: j(70, 185, 190),
      tool_git: j(90, 210, 100),
      tool_web: j(100, 215, 250),
      tool_sysadmin: j(225, 150, 75),
      tool_default: j(100, 205, 115),
      syn_keyword: j(185, 100, 235),
      syn_string: j(90, 210, 120),
      syn_number: j(245, 175, 50),
      syn_comment: An,
      syn_key: j(80, 190, 255),
      diff_add: j(80, 210, 120),
      diff_rem: j(230, 80, 80),
      banner_logo: j(80, 200, 255),
      banner_name: j(80, 200, 255),
      banner_version: An,
      banner_model: An,
      banner_yolo: j(245, 175, 50),
      footer_sep: An,
      footer_model: j(80, 175, 235),
      footer_branch: j(80, 210, 100),
      footer_project: j(130, 130, 145),
      footer_divider: j(80, 80, 95),
      footer_mode: j(210, 150, 50),
      white: "\x1B[37m",
      red: "\x1B[31m",
      green: "\x1B[32m",
      yellow: "\x1B[33m",
      blue: "\x1B[34m",
      magenta: "\x1B[35m",
      cyan: "\x1B[36m",
      gray: "\x1B[90m",
      bgRed: "\x1B[41m",
      bgGreen: "\x1B[42m",
      diff_add_bg: "\x1B[48;2;10;46;20m",
      diff_rem_bg: "\x1B[48;2;58;16;16m",
      brightCyan: "\x1B[96m",
      brightMagenta: "\x1B[95m",
      brightBlue: "\x1B[94m",
    },
    bc = {
      reset: hc,
      bold: gc,
      dim: j(110, 110, 120),
      primary: j(0, 110, 190),
      secondary: j(0, 125, 148),
      success: j(0, 148, 62),
      warning: j(168, 92, 0),
      error: j(188, 32, 32),
      muted: j(110, 110, 120),
      subtle: j(155, 155, 165),
      tool_read: j(0, 110, 190),
      tool_write: j(168, 92, 0),
      tool_exec: j(128, 42, 188),
      tool_search: j(0, 122, 148),
      tool_git: j(0, 138, 62),
      tool_web: j(0, 112, 178),
      tool_sysadmin: j(168, 82, 0),
      tool_default: j(0, 138, 62),
      syn_keyword: j(128, 42, 188),
      syn_string: j(0, 138, 62),
      syn_number: j(168, 92, 0),
      syn_comment: j(135, 135, 148),
      syn_key: j(0, 110, 190),
      diff_add: j(0, 148, 62),
      diff_rem: j(188, 32, 32),
      banner_logo: j(0, 122, 205),
      banner_name: j(0, 122, 205),
      banner_version: j(100, 100, 118),
      banner_model: j(100, 100, 118),
      banner_yolo: j(168, 62, 0),
      footer_sep: j(168, 168, 178),
      footer_model: j(0, 102, 175),
      footer_branch: j(0, 138, 62),
      footer_project: j(135, 135, 148),
      footer_divider: j(168, 168, 178),
      footer_mode: j(148, 88, 0),
      white: j(40, 40, 52),
      red: j(188, 32, 32),
      green: j(0, 148, 62),
      yellow: j(168, 92, 0),
      blue: j(0, 110, 190),
      magenta: j(128, 42, 188),
      cyan: j(0, 125, 148),
      gray: j(132, 132, 142),
      bgRed: "\x1B[41m",
      bgGreen: "\x1B[42m",
      diff_add_bg: "\x1B[48;2;215;245;220m",
      diff_rem_bg: "\x1B[48;2;255;215;215m",
      brightCyan: j(0, 158, 182),
      brightMagenta: j(158, 52, 208),
      brightBlue: j(0, 112, 208),
    },
    wm = yc ? wc : bc;
  _c.exports = { T: wm, isDark: yc, DARK: wc, LIGHT: bc };
});
var Nn = K((ek, kc) => {
  var { T: B } = dn(),
    lo = 5,
    On = (() => {
      let t = [];
      for (let e = 0; e < lo; e++) t.push(e);
      for (let e = lo - 2; e >= 1; e--) t.push(e);
      return t;
    })(),
    xc = ["\u273D", "\u2726", "\u2727", "\u2726"],
    Br = class {
      constructor(e = "Thinking...") {
        ((this.text = e),
          (this.frame = 0),
          (this.interval = null),
          (this.startTime = null));
      }
      _render() {
        if (this._stopped) return;
        let e = On[this.frame % On.length],
          s = "";
        for (let n = 0; n < lo; n++)
          s += n === e ? `${B.cyan}\u25CF${B.reset}` : " ";
        let o = "";
        if (this.startTime) {
          let n = Math.floor((Date.now() - this.startTime) / 1e3);
          if (n >= 60) {
            let r = Math.floor(n / 60),
              i = n % 60;
            o = ` ${B.dim}${r}m ${String(i).padStart(2, "0")}s${B.reset}`;
          } else n >= 1 && (o = ` ${B.dim}${n}s${B.reset}`);
        }
        (process.stderr.write(
          `\x1B[2K\r${s} ${B.dim}${this.text}${B.reset}${o}`,
        ),
          this.frame++);
      }
      start() {
        ((this._stopped = !1),
          (this.startTime = Date.now()),
          process.stderr.isTTY &&
            (process.stderr.write("\x1B[?25l"),
            this._render(),
            (this.interval = setInterval(() => this._render(), 100))));
      }
      update(e) {
        this.text = e;
      }
      stop() {
        ((this._stopped = !0),
          this.interval &&
            (clearInterval(this.interval), (this.interval = null)),
          process.stderr.isTTY && process.stderr.write("\x1B[2K\r\x1B[?25h"),
          (this.startTime = null));
      }
    },
    Hr = class {
      constructor(e) {
        ((this.labels = e),
          (this.statuses = e.map(() => "running")),
          (this.frame = 0),
          (this.interval = null),
          (this.startTime = null),
          (this.lineCount = e.length));
      }
      _formatElapsed() {
        if (!this.startTime) return "";
        let e = Math.floor((Date.now() - this.startTime) / 1e3);
        if (e < 1) return "";
        let s = Math.floor(e / 60),
          o = e % 60;
        return s > 0 ? `${s}m ${String(o).padStart(2, "0")}s` : `${o}s`;
      }
      _render() {
        if (this._stopped) return;
        let e = On[this.frame % On.length],
          s = `${B.cyan}\u25CF${B.reset}`,
          o = `${B.dim}\u25CB${B.reset}`,
          n = this._formatElapsed(),
          r = n ? ` ${B.dim}${n}${B.reset}` : "",
          i = "";
        for (let c = 0; c < this.labels.length; c++) {
          let l, u;
          switch (this.statuses[c]) {
            case "done":
              ((l = `${B.green}\u2713${B.reset}`), (u = B.dim));
              break;
            case "error":
              ((l = `${B.red}\u2717${B.reset}`), (u = B.dim));
              break;
            default:
              ((l = c === e ? s : " "), (u = ""));
          }
          let d = c === this.labels.length - 1 ? r : "";
          i += `\x1B[2K  ${l} ${u}${this.labels[c]}${B.reset}${d}
`;
        }
        (this.lineCount > 0 && (i += `\x1B[${this.lineCount}A`),
          process.stderr.write(i),
          this.frame++);
      }
      start() {
        ((this._stopped = !1), (this.startTime = Date.now()));
        let e = "\x1B[?25l";
        for (let s = 0; s < this.lineCount; s++)
          e += `
`;
        (this.lineCount > 0 && (e += `\x1B[${this.lineCount}A`),
          process.stderr.write(e),
          this._render(),
          (this.interval = setInterval(() => this._render(), 100)));
      }
      update(e, s) {
        e >= 0 && e < this.statuses.length && (this.statuses[e] = s);
      }
      stop() {
        ((this._stopped = !0),
          this.interval &&
            (clearInterval(this.interval), (this.interval = null)),
          this._renderFinal(),
          process.stderr.write("\x1B[?25h"));
      }
      _renderFinal() {
        let e = this._formatElapsed(),
          s = e ? ` ${B.dim}${e}${B.reset}` : "",
          o = "";
        for (let n = 0; n < this.labels.length; n++) {
          let r;
          switch (this.statuses[n]) {
            case "done":
              r = `${B.green}\u2713${B.reset}`;
              break;
            case "error":
              r = `${B.red}\u2717${B.reset}`;
              break;
            default:
              r = `${B.yellow}\u25CB${B.reset}`;
          }
          let i = n === this.labels.length - 1 ? s : "";
          o += `\x1B[2K  ${r} ${B.dim}${this.labels[n]}${B.reset}${i}
`;
        }
        process.stderr.write(o);
      }
    },
    ao = {
      done: "\u2714",
      in_progress: "\u25FC",
      pending: "\u25FB",
      failed: "\u2717",
    },
    co = { done: B.green, in_progress: B.cyan, pending: B.dim, failed: B.red },
    Jt = null,
    Gr = class {
      constructor(e, s) {
        ((this.name = e),
          (this.tasks = s.map((o) => ({
            id: o.id,
            description: o.description,
            status: o.status || "pending",
          }))),
          (this.frame = 0),
          (this.interval = null),
          (this.startTime = null),
          (this.tokens = 0),
          (this.lineCount = 1 + this.tasks.length),
          (this._paused = !1));
      }
      _formatElapsed() {
        if (!this.startTime) return "";
        let e = Math.floor((Date.now() - this.startTime) / 1e3);
        if (e < 1) return "";
        let s = Math.floor(e / 60),
          o = e % 60;
        return s > 0 ? `${s}m ${String(o).padStart(2, "0")}s` : `${o}s`;
      }
      _formatTokens() {
        return this.tokens <= 0
          ? ""
          : this.tokens >= 1e3
            ? `${(this.tokens / 1e3).toFixed(1)}k`
            : String(this.tokens);
      }
      _render() {
        if (this._stopped) return;
        let e = xc[this.frame % xc.length],
          s = this._formatElapsed(),
          o = this._formatTokens(),
          n = [s, o ? `\u2193 ${o} tokens` : ""].filter(Boolean).join(" \xB7 "),
          r = n ? ` ${B.dim}(${n})${B.reset}` : "",
          i = `\x1B[2K${B.cyan}${e}${B.reset} ${this.name}\u2026${r}
`;
        for (let c = 0; c < this.tasks.length; c++) {
          let l = this.tasks[c],
            u = c === 0 ? "\u23BF" : " ",
            d = ao[l.status] || ao.pending,
            f = co[l.status] || co.pending,
            m =
              l.description.length > 55
                ? l.description.substring(0, 52) + "..."
                : l.description;
          i += `\x1B[2K  ${B.dim}${u}${B.reset}  ${f}${d}${B.reset} ${m}
`;
        }
        ((i += `\x1B[${this.lineCount}A`),
          process.stderr.write(i),
          this.frame++);
      }
      start() {
        ((this._stopped = !1),
          (this.startTime = Date.now()),
          (this._paused = !1));
        let e = "\x1B[?25l";
        for (let s = 0; s < this.lineCount; s++)
          e += `
`;
        ((e += `\x1B[${this.lineCount}A`),
          process.stderr.write(e),
          this._render(),
          (this.interval = setInterval(() => this._render(), 120)),
          (Jt = this));
      }
      stop() {
        ((this._stopped = !0),
          this.interval &&
            (clearInterval(this.interval), (this.interval = null)),
          this._paused || this._renderFinal(),
          process.stderr.write("\x1B[?25h"),
          (this._paused = !1),
          Jt === this && (Jt = null));
      }
      pause() {
        if (this._paused) return;
        this.interval && (clearInterval(this.interval), (this.interval = null));
        let e = "";
        for (let s = 0; s < this.lineCount; s++)
          e += `\x1B[2K
`;
        ((e += `\x1B[${this.lineCount}A`),
          process.stderr.write(e),
          (this._paused = !0));
      }
      resume() {
        if (!this._paused) return;
        this._paused = !1;
        let e = "\x1B[?25l";
        for (let s = 0; s < this.lineCount; s++)
          e += `
`;
        ((e += `\x1B[${this.lineCount}A`),
          process.stderr.write(e),
          this._render(),
          (this.interval = setInterval(() => this._render(), 120)));
      }
      updateTask(e, s) {
        let o = this.tasks.find((n) => n.id === e);
        o && (o.status = s);
      }
      setStats({ tokens: e }) {
        e !== void 0 && (this.tokens = e);
      }
      isActive() {
        return this.interval !== null || this._paused;
      }
      _renderFinal() {
        let e = this._formatElapsed(),
          s = this.tasks.filter((c) => c.status === "done").length,
          o = this.tasks.filter((c) => c.status === "failed").length,
          n = this.tasks.length,
          r = o > 0 ? `${s}/${n} done, ${o} failed` : `${s}/${n} done`,
          i = `\x1B[2K${B.green}\u2714${B.reset} ${this.name} ${B.dim}(${e} \xB7 ${r})${B.reset}
`;
        for (let c = 0; c < this.tasks.length; c++) {
          let l = this.tasks[c],
            u = c === 0 ? "\u23BF" : " ",
            d = ao[l.status] || ao.pending,
            f = co[l.status] || co.pending,
            m =
              l.description.length > 55
                ? l.description.substring(0, 52) + "..."
                : l.description;
          i += `\x1B[2K  ${B.dim}${u}${B.reset}  ${f}${d}${B.reset} ${B.dim}${m}${B.reset}
`;
        }
        process.stderr.write(i);
      }
    },
    Kr = class {
      constructor(e, s) {
        ((this.toolName = e),
          (this.message = s || `Running ${e}...`),
          (this.count = 0),
          (this.total = null),
          (this.detail = ""),
          (this.frame = 0),
          (this.interval = null),
          (this.startTime = null),
          (this._stopped = !1));
      }
      _render() {
        if (this._stopped || !process.stderr.isTTY) return;
        let e = On[this.frame % On.length],
          s = "";
        for (let r = 0; r < lo; r++)
          s += r === e ? `${B.cyan}\u25CF${B.reset}` : " ";
        let o = this.message;
        this.count > 0 &&
          ((o += ` ${B.cyan}${this.count}${B.reset}`),
          this.total && (o += `/${this.total}`),
          this.detail && (o += ` ${B.dim}${this.detail}${B.reset}`));
        let n = "";
        if (this.startTime) {
          let r = Math.floor((Date.now() - this.startTime) / 1e3);
          r >= 1 && (n = ` ${B.dim}${r}s${B.reset}`);
        }
        (process.stderr.write(`\x1B[2K\r${s} ${B.dim}${o}${B.reset}${n}`),
          this.frame++);
      }
      start() {
        ((this._stopped = !1),
          (this.startTime = Date.now()),
          process.stderr.isTTY &&
            (process.stderr.write("\x1B[?25l"),
            this._render(),
            (this.interval = setInterval(() => this._render(), 100))));
      }
      update(e) {
        (e.count !== void 0 && (this.count = e.count),
          e.total !== void 0 && (this.total = e.total),
          e.detail !== void 0 && (this.detail = e.detail),
          e.message !== void 0 && (this.message = e.message));
      }
      stop() {
        ((this._stopped = !0),
          this.interval &&
            (clearInterval(this.interval), (this.interval = null)),
          process.stderr.isTTY && process.stderr.write("\x1B[2K\r\x1B[?25h"));
      }
    };
  function bm(t) {
    Jt = t;
  }
  function _m() {
    return Jt;
  }
  function xm() {
    (Jt && (Jt.stop(), (Jt = null)),
      process.stderr.write("\x1B[?25h\x1B[2K\r"));
  }
  kc.exports = {
    C: B,
    Spinner: Br,
    MultiProgress: Hr,
    TaskProgress: Gr,
    ToolProgress: Kr,
    setActiveTaskProgress: bm,
    getActiveTaskProgress: _m,
    cleanupTerminal: xm,
  };
});
var Ec = K((tk, Sc) => {
  var { T: C } = dn(),
    nt = C;
  function vc(t) {
    if (!t) return "";
    let e = t.replace(/^\.\//, "").split("/");
    return e.length > 1 ? e.slice(-2).join("/") : e[0];
  }
  var km = {
      read_file: C.tool_read,
      list_directory: C.tool_read,
      write_file: C.tool_write,
      edit_file: C.tool_write,
      patch_file: C.tool_write,
      bash: C.tool_exec,
      grep: C.tool_search,
      search_files: C.tool_search,
      glob: C.tool_search,
      git_commit: C.tool_git,
      git_push: C.tool_git,
      git_pull: C.tool_git,
      git_status: C.tool_git,
      git_diff: C.tool_git,
      git_log: C.tool_git,
      git_branch: C.tool_git,
      git_stash: C.tool_git,
      web_fetch: C.tool_web,
      web_search: C.tool_web,
      sysadmin: C.tool_sysadmin,
      ssh_exec: C.tool_sysadmin,
      ssh_upload: C.tool_sysadmin,
      ssh_download: C.tool_sysadmin,
      deploy: C.tool_sysadmin,
    },
    Yr = {
      read_file: "Read file",
      write_file: "Write",
      edit_file: "Update",
      patch_file: "Update",
      list_directory: "List directory",
      bash: "Run command",
      grep: "Search code",
      search_files: "Search files",
      glob: "Find files",
      web_fetch: "Fetch URL",
      web_search: "Web search",
      git_status: "Git status",
      git_diff: "Git diff",
      git_log: "Git log",
      git_commit: "Git commit",
      git_push: "Git push",
      git_pull: "Git pull",
      git_branch: "Git branch",
      git_stash: "Git stash",
      task_list: "Task list",
      spawn_agents: "Spawn agents",
      ask_user: "Ask user",
      switch_model: "Switch model",
      gh_run_list: "GH Actions",
      gh_run_view: "GH Actions",
      gh_workflow_trigger: "GH trigger",
      browser_open: "Browser open",
      browser_screenshot: "Screenshot",
      browser_click: "Browser click",
      browser_fill: "Browser fill",
      ssh_exec: "SSH exec",
      ssh_upload: "SSH upload",
      ssh_download: "SSH download",
      service_manage: "Service",
      service_logs: "Service logs",
      container_list: "Containers",
      container_logs: "Container logs",
      container_exec: "Container exec",
      brain_write: "Brain write",
      deploy: "Deploy",
      frontend_recon: "Frontend recon",
    };
  function uo(t, e = !1, s = null) {
    if (e) return `${C.error}\u25CF${C.reset}`;
    let o = km[t] || C.tool_default;
    return s === "blink"
      ? `${o}\x1B[5m\u25CF\x1B[25m${C.reset}`
      : `${o}${s !== null ? s : "\u25CF"}${C.reset}`;
  }
  function vm(t, e, s = !1, o = null) {
    let n = (t || []).filter((l) => l && l.canExecute !== !1);
    if (n.length === 0) return `${uo("", s, o)} Step ${e}`;
    if (n.length === 1) {
      let l = n[0],
        u = l.args || {},
        d = Yr[l.fnName] || l.fnName.replace(/_/g, " "),
        f = "";
      u.path
        ? (f = vc(u.path))
        : u.command
          ? (f = String(u.command).substring(0, 60))
          : u.query
            ? (f = String(u.query).substring(0, 50))
            : u.pattern && (f = String(u.pattern).substring(0, 50));
      let m = f ? `${nt.dim}(${f})${nt.reset}` : "";
      return `${uo(l.fnName, s, o)} ${nt.bold}${d}${nt.reset} ${m}`;
    }
    let r = n[0].fnName,
      i = [
        ...new Set(n.map((l) => Yr[l.fnName] || l.fnName.replace(/_/g, " "))),
      ],
      c = i.length <= 3 ? i.join(" \xB7 ") : `${n.length} actions`;
    return `${uo(r, s, o)} ${c}`;
  }
  function Sm(t, e) {
    let s;
    switch (t) {
      case "write_file":
      case "edit_file":
      case "patch_file":
      case "read_file":
      case "list_directory":
        s = vc(e.path);
        break;
      case "bash":
      case "ssh_exec":
        s = (e.command || "").substring(0, 80);
        break;
      case "grep":
      case "search_files":
        s = e.pattern ? `"${e.pattern}"${e.path ? ` in ${e.path}` : ""}` : "";
        break;
      case "glob":
        s = e.pattern || "";
        break;
      case "web_fetch":
        s = (e.url || "").substring(0, 60);
        break;
      case "web_search":
        s = (e.query || "").substring(0, 50);
        break;
      default:
        s = JSON.stringify(e).substring(0, 80);
    }
    let o = Yr[t] || t.replace(/_/g, " "),
      n = s ? ` ${nt.dim}(${s})${nt.reset}` : "";
    return `${uo(t)} ${nt.bold}${o}${nt.reset}${n}`;
  }
  function Em(t, e = 8) {
    let s = t.split(`
`),
      o = s.slice(0, e),
      n = s.length - e,
      r = `${C.muted}  \u2514  ${C.reset}`,
      i = "     ",
      c = o.map((l, u) => `${u === 0 ? r : i}${C.success}${l}${C.reset}`).join(`
`);
    return (
      n > 0 &&
        (c += `
${C.subtle}     \u2026 +${n} lines${C.reset}`),
      c
    );
  }
  function Tm(t, e) {
    switch (t) {
      case "bash":
      case "ask_user":
      case "write_file":
      case "edit_file":
      case "patch_file":
      case "task_list":
      case "spawn_agents":
        return null;
      case "read_file":
        return `Reading: ${e.path || "file"}`;
      case "list_directory":
        return `Listing: ${e.path || "."}`;
      case "search_files":
        return `Searching: ${e.pattern || "..."}`;
      case "glob":
        return `Glob: ${e.pattern || "..."}`;
      case "grep":
        return `Grep: ${e.pattern || "..."}`;
      case "web_fetch":
        return `Fetching: ${(e.url || "").substring(0, 60)}`;
      case "web_search":
        return `Searching web: ${(e.query || "").substring(0, 50)}`;
      case "git_status":
        return "Git status...";
      case "git_diff":
        return `Git diff${e.file ? `: ${e.file}` : ""}...`;
      case "git_log":
        return `Git log${e.file ? `: ${e.file}` : ""}...`;
      case "gh_run_list":
        return `GitHub Actions: listing runs${e.workflow ? ` (${e.workflow})` : ""}...`;
      case "gh_run_view":
        return `GitHub Actions: run ${e.run_id}...`;
      case "gh_workflow_trigger":
        return `GitHub Actions: trigger ${e.workflow}...`;
      case "browser_open":
        return `Browser: opening ${(e.url || "").substring(0, 60)}...`;
      case "browser_screenshot":
        return `Browser: screenshot ${(e.url || "").substring(0, 60)}...`;
      case "browser_click":
        return `Browser: clicking ${e.text || e.selector || "element"}...`;
      case "browser_fill":
        return `Browser: filling ${e.selector || "field"}...`;
      case "sysadmin": {
        let s = e.server && e.server !== "local" ? ` [${e.server}]` : "";
        switch (e.action) {
          case "audit":
            return `Sysadmin${s}: full audit...`;
          case "disk_usage":
            return `Sysadmin${s}: disk usage ${e.path || "/"}...`;
          case "process_list":
            return `Sysadmin${s}: top processes (${e.sort_by || "cpu"})...`;
          case "network_status":
            return `Sysadmin${s}: network status...`;
          case "ssl_check":
            return `Sysadmin${s}: SSL check ${e.domain || e.cert_path || ""}...`;
          case "log_tail":
            return `Sysadmin${s}: tail ${e.path || "log"}...`;
          case "find_large":
            return `Sysadmin${s}: find large files in ${e.path || "/"}...`;
          case "service":
            return `Sysadmin${s}: service ${e.service_action || ""} ${e.service_name || ""}...`;
          case "kill_process":
            return `Sysadmin${s}: kill PID ${e.pid || e.process_name || "?"}...`;
          case "journalctl":
            return `Sysadmin${s}: journal ${e.unit ? `[${e.unit}]` : ""}${e.since ? ` since ${e.since}` : ""}...`;
          case "package":
            return `Sysadmin${s}: package ${e.package_action || ""} ${(e.packages || []).join(" ")}...`;
          case "firewall":
            return `Sysadmin${s}: firewall ${e.firewall_action || ""}...`;
          case "user_manage":
            return `Sysadmin${s}: user ${e.user_action || ""} ${e.user || ""}...`;
          case "cron":
            return `Sysadmin${s}: cron ${e.cron_action || ""}...`;
          default:
            return `Sysadmin${s}: ${e.action}...`;
        }
      }
      default:
        return `Running: ${t}`;
    }
  }
  function Rm(t, e, s, o) {
    let n = String(s || "");
    if (o) {
      let c = n
          .split(
            `
`,
          )[0]
          .replace(/^ERROR:\s*/i, "")
          .substring(0, 80),
        l = n.match(/\nHINT: (.+)/),
        u = l
          ? `
     ${C.muted}${l[1].substring(0, 100)}${C.reset}`
          : "";
      return `  ${C.error}\u2514 ${c}${C.reset}${u}`;
    }
    let r;
    switch (t) {
      case "read_file": {
        let l = n
            .split(
              `
`,
            )
            .filter(Boolean)
            .filter((g) => !/^File:\s/.test(g) && !/^\[LARGE FILE:/.test(g)),
          u = l.length,
          d = l[l.length - 1],
          f = d ? parseInt(d.match(/^(\d+):/)?.[1] || "0") : 0,
          m = e.line_start || e.line_end,
          h = e.path ? require("path").basename(e.path) : null,
          p = h ? ` ${C.muted}from ${h}${C.reset}` : "";
        m && f > u
          ? (r = `Read lines ${e.line_start || 1}\u2013${f}${p}`)
          : (r = `Read ${u} line${u !== 1 ? "s" : ""}${p}`);
        break;
      }
      case "write_file": {
        let c = (e.content || "").split(`
`),
          l = c.length,
          u = e.path ? require("path").basename(e.path) : null,
          d = u
            ? `Wrote ${u} \xB7 ${l} line${l !== 1 ? "s" : ""}`
            : `Wrote ${l} line${l !== 1 ? "s" : ""}`,
          f = 40,
          m = 8;
        if (l <= f) {
          let h = c.map((p) => `     ${C.muted}${p}${C.reset}`).join(`
`);
          r = `${d}
${h}`;
        } else {
          let h = c.slice(0, m).map((p) => `     ${C.muted}${p}${C.reset}`)
            .join(`
`);
          r = `${d}
${h}
     ${C.subtle}\u2026 +${l - m} lines${C.reset}`;
        }
        break;
      }
      case "edit_file": {
        let c = (e.old_text || "").split(`
`),
          l = (e.new_text || "").split(`
`),
          u = c.length,
          d = l.length,
          f = e.path ? require("path").basename(e.path) : null,
          m = f ? `  ${C.muted}${f}${C.reset}` : "",
          h = c.find(($) => $.trim()),
          p = l.find(($) => $.trim()),
          g = [];
        (h &&
          g.push(
            `    ${C.diff_rem}- ${C.reset}${C.muted}${h.trimEnd().substring(0, 72)}${C.reset}`,
          ),
          p &&
            g.push(
              `    ${C.diff_add}+ ${C.reset}${C.muted}${p.trimEnd().substring(0, 72)}${C.reset}`,
            ),
          (r =
            `${C.diff_rem}\u2212${u}${C.reset}  ${C.diff_add}+${d}${C.reset}${m}` +
            (g.length > 0
              ? `
` +
                g.join(`
`)
              : "")));
        break;
      }
      case "patch_file": {
        let c = e.patches || [],
          l = c.reduce(
            (d, f) =>
              d +
              (f.old_text || "").split(`
`).length,
            0,
          ),
          u = c.reduce(
            (d, f) =>
              d +
              (f.new_text || "").split(`
`).length,
            0,
          );
        r = `${C.reset}${c.length} patch${c.length !== 1 ? "es" : ""}  ${C.diff_rem}\u2212${l}${C.reset}  ${C.diff_add}+${u}${C.reset}`;
        break;
      }
      case "bash": {
        let l = n.match(/^EXIT (\d+)/),
          u = n
            .split(
              `
`,
            )
            .filter(
              (m) =>
                m &&
                !m.startsWith("EXIT ") &&
                !m.startsWith("HINT:") &&
                m.trim(),
            ),
          d = l
            ? l[1] === "0"
              ? `${C.success}\u2713${C.reset}`
              : `${C.error}\u2717 Exit ${l[1]}${C.reset}`
            : `${C.success}\u2713${C.reset}`,
          f = n.match(/\nHINT: (.+)/);
        if (f) r = `${d} ${C.muted}\u2014 ${f[1].substring(0, 100)}${C.reset}`;
        else if (u.length === 0) r = d;
        else {
          let m = l && l[1] !== "0",
            h = m ? u.slice(-3) : u.slice(0, 3),
            p = u.length - 3,
            g = h.map(($, w) =>
              w === 0
                ? `${d} ${C.muted}${$.substring(0, 120)}${C.reset}`
                : `    ${C.muted}${$.substring(0, 120)}${C.reset}`,
            );
          if (p > 0) {
            let $ = m
              ? `    ${C.subtle}${p} lines above\u2026${C.reset}`
              : `    ${C.subtle}\u2026 +${p} lines${C.reset}`;
            m ? g.unshift($) : g.push($);
          }
          r = g.join(`
`);
        }
        break;
      }
      case "grep":
      case "search_files": {
        if (n.includes("(no matches)") || n === "no matches")
          r = `No matches${e.pattern ? ` ${C.muted}"${String(e.pattern).substring(0, 40)}"${C.reset}` : ""}`;
        else {
          let p = function (w) {
            let _ = w.indexOf(":");
            if (_ === -1) return `${C.muted}${w.substring(0, 90)}${C.reset}`;
            let x = w.substring(0, _),
              v = w.substring(_ + 1),
              b = v.match(/^(\d+)[:-](.*)/s),
              k = b ? `:${b[1]}` : "",
              A = (b ? b[2] : v).trim(),
              O = `${C.subtle}${c.basename(x)}${k}${C.reset}`,
              P = `${C.muted}${A.substring(0, 80)}${A.length > 80 ? "\u2026" : ""}${C.reset}`;
            return `${O}  ${P}`;
          };
          var i = p;
          let c = require("path"),
            l = n
              .split(
                `
`,
              )
              .filter(Boolean),
            u = l.length,
            f = new Set(l.map((w) => w.split(":")[0]).filter(Boolean)).size,
            m = e.pattern
              ? ` ${C.muted}"${String(e.pattern).substring(0, 40)}"${C.reset}`
              : "",
            h =
              f > 1
                ? `${u} match${u !== 1 ? "es" : ""} in ${f} files${m}`
                : `${u} match${u !== 1 ? "es" : ""}${m}`,
            g = l.slice(0, 3).map((w, _) =>
              _ === 0
                ? `${h}
    ${p(w)}`
                : `    ${p(w)}`,
            ),
            $ = l.length - 3;
          ($ > 0 && g.push(`    ${C.subtle}\u2026 +${$} lines${C.reset}`),
            (r = g.join(`
`)));
        }
        break;
      }
      case "glob": {
        let c = e.pattern
          ? ` ${C.muted}${String(e.pattern).substring(0, 50)}${C.reset}`
          : "";
        if (n === "(no matches)") r = `No files found${c}`;
        else {
          let l = require("path"),
            u = n
              .split(
                `
`,
              )
              .filter(Boolean),
            d = u.length,
            f = u.slice(0, 5).map((p) => l.basename(p)),
            m = d - f.length,
            h = f.join(", ") + (m > 0 ? `, +${m} more` : "");
          r = `${d} file${d !== 1 ? "s" : ""}${c} \u2014 ${C.muted}${h}${C.reset}`;
        }
        break;
      }
      case "list_directory": {
        if (n === "(empty)") r = "0 entries";
        else {
          let c = n
              .split(
                `
`,
              )
              .filter(Boolean),
            l = c.length,
            u = c.slice(0, 6).join(", "),
            d = l - 6;
          r =
            d > 0
              ? `${l} entries \u2014 ${C.muted}${u}, +${d} more${C.reset}`
              : `${l} entr${l !== 1 ? "ies" : "y"} \u2014 ${C.muted}${u}${C.reset}`;
        }
        break;
      }
      case "git_status": {
        let c = n.match(/Branch:\s*(\S+)/),
          l = n
            .split(
              `
`,
            )
            .filter((u) => /^\s*[MADRCU?!]/.test(u)).length;
        r = c ? `${c[1]} \xB7 ${l} change${l !== 1 ? "s" : ""}` : "Done";
        break;
      }
      case "git_diff": {
        let c = (n.match(/^\+[^+]/gm) || []).length,
          l = (n.match(/^-[^-]/gm) || []).length;
        r = c || l ? `+${c} \u2212${l} lines` : "No diff";
        break;
      }
      case "git_log": {
        let c = n
            .split(
              `
`,
            )
            .filter((f) => /^commit\s+[0-9a-f]{7}/.test(f)),
          l = c.length,
          u = c[0] ? c[0].replace(/^commit\s+/, "").substring(0, 7) : null,
          d = (() => {
            let f = n.indexOf(c[0] || "\0");
            return f === -1
              ? null
              : n
                  .substring(f)
                  .split(
                    `
`,
                  )
                  .find(
                    (h, p) =>
                      p > 0 &&
                      h.trim() &&
                      !h.startsWith("Author:") &&
                      !h.startsWith("Date:") &&
                      !h.startsWith("Merge:"),
                  );
          })();
        if (l === 0) r = "Log retrieved";
        else if (u && d) {
          let f = l > 1 ? ` ${C.muted}+${l - 1} more${C.reset}` : "";
          r = `${u} ${C.muted}${d.trim().substring(0, 60)}${C.reset}${f}`;
        } else r = `${l} commit${l !== 1 ? "s" : ""}`;
        break;
      }
      case "git_commit": {
        let c = n.match(/\[[\w./\-]+ ([0-9a-f]{7,})\]/),
          l = n.match(/\[[\w./\-]+ [0-9a-f]+\]\s+(.+)/);
        r = c
          ? `${c[1]}${l ? ` \u2014 ${l[1].substring(0, 55)}` : ""}`
          : "Committed";
        break;
      }
      case "git_push": {
        let c = n.match(/(?:->|→)\s*(\S+)/);
        r = c ? `\u2192 ${c[1]}` : "Pushed";
        break;
      }
      case "git_pull": {
        if (/Already up.to.date/i.test(n)) r = "Already up to date";
        else {
          let c = (n.match(/^\+/gm) || []).length;
          r = c > 0 ? `Pulled \xB7 +${c} lines` : "Pulled";
        }
        break;
      }
      case "web_fetch": {
        let c = n.match(/<title[^>]*>([^<]{1,80})<\/title>/i),
          l = n.match(/^#\s+(.{1,80})/m),
          u = e.url || "",
          d = "";
        try {
          d = new URL(u).hostname;
        } catch {
          d = u.substring(0, 60);
        }
        let f = c ? c[1].trim() : l ? l[1].trim() : null;
        r = f
          ? `${d} \u2014 ${C.muted}${f.substring(0, 70)}${C.reset}`
          : `Fetched ${d}`;
        break;
      }
      case "web_search": {
        let c = n
            .split(
              `

`,
            )
            .filter(Boolean),
          l = c.length,
          u = c[0]
            ? c[0]
                .split(
                  `
`,
                )[0]
                .replace(/^\d+\.\s*/, "")
                .trim()
            : null,
          d = u ? ` ${C.muted}\u2014 ${u.substring(0, 70)}${C.reset}` : "";
        r = `${l} result${l !== 1 ? "s" : ""}${d}`;
        break;
      }
      case "task_list":
        r = "Done";
        break;
      case "spawn_agents": {
        let c = (n.match(/✓ Agent/g) || []).length,
          l = (n.match(/✗ Agent/g) || []).length;
        r =
          l > 0
            ? `${c} done, ${l} failed`
            : `${c} agent${c !== 1 ? "s" : ""} done`;
        break;
      }
      case "switch_model": {
        let c = n.match(/Switched to (.+)/);
        r = c ? `\u2192 ${c[1]}` : "Done";
        break;
      }
      case "ssh_exec": {
        let l = n.startsWith("EXIT ") || n.startsWith("Command failed"),
          u = n
            .split(
              `
`,
            )
            .filter((f) => f.trim() && !f.startsWith("EXIT ")),
          d = l ? `${C.error}\u2717${C.reset}` : `${C.success}\u2713${C.reset}`;
        if (u.length === 0) r = d;
        else {
          if (u.length > 2 && u.every((g) => /^\[/.test(g.trim()))) {
            r = `${d} ${u.length} log lines`;
            break;
          }
          let m = l ? u.slice(-3) : u.slice(0, 3),
            h = u.length - 3,
            p = m.map((g, $) =>
              $ === 0
                ? `${d} ${C.muted}${g.substring(0, 120)}${C.reset}`
                : `    ${C.muted}${g.substring(0, 120)}${C.reset}`,
            );
          if (h > 0) {
            let g = l
              ? `    ${C.subtle}${h} lines above\u2026${C.reset}`
              : `    ${C.subtle}\u2026 +${h} lines${C.reset}`;
            l ? p.unshift(g) : p.push(g);
          }
          r = p.join(`
`);
        }
        break;
      }
      default: {
        let c = n
          .split(
            `
`,
          )
          .filter(
            (l) => l.trim() && !l.startsWith("EXIT ") && !l.startsWith("HINT:"),
          );
        if (c.length > 0) {
          let l = c[0].trim().substring(0, 90),
            u =
              c.length > 1
                ? ` ${C.subtle}\u2026 +${c.length - 1} lines${C.reset}`
                : "";
          r = `${C.muted}${l}${C.reset}${u}`;
        } else r = "Done";
      }
    }
    return `  ${C.muted}\u2514 ${r}${C.reset}`;
  }
  function Cm(t, e, s, o, n, r) {
    let i = [...s.values()].reduce((d, f) => d + f, 0),
      c = Math.round(o / 1e3),
      l = c >= 60 ? `${Math.floor(c / 60)}m ${c % 60}s` : `${c}s`,
      u = `
${C.success}\u25C6${nt.reset} ${nt.bold}${t}${nt.reset}`;
    return (
      (u += `${nt.dim} \xB7 ${e} step${e !== 1 ? "s" : ""}`),
      (u += ` \xB7 ${i} tool${i !== 1 ? "s" : ""}`),
      (u += ` \xB7 ${l}`),
      r.size > 0 &&
        (u += ` \xB7 ${r.size} file${r.size !== 1 ? "s" : ""} modified`),
      (u += nt.reset),
      u
    );
  }
  Sc.exports = {
    C: nt,
    formatToolCall: Sm,
    formatResult: Em,
    getToolSpinnerText: Tm,
    formatToolSummary: Rm,
    formatSectionHeader: vm,
    formatMilestone: Cm,
  };
});
var Ce = K((nk, Rc) => {
  var { T: fn } = dn(),
    zr = fn,
    Tc = [
      "01100110",
      "01111110",
      "01111110",
      "01011010",
      "01111110",
      "00111100",
    ];
  function Am(t, e) {
    let s = [];
    for (let o = 0; o < t.length; o += 2) {
      let n = "";
      for (let r = 0; r < t[0].length; r++) {
        let i = t[o][r] === "1",
          c = o + 1 < t.length && t[o + 1][r] === "1";
        i && c
          ? (n += `${e}\u2588\x1B[0m`)
          : i && !c
            ? (n += `${e}\u2580\x1B[0m`)
            : !i && c
              ? (n += `${e}\u2584\x1B[0m`)
              : (n += " ");
      }
      s.push(n);
    }
    return s;
  }
  function Om(t, e, s = {}) {
    let o = zr.bold,
      n = zr.reset,
      r = Am(Tc, fn.banner_logo),
      i = s.yolo ? `  ${o}${fn.banner_yolo}\u26A1 YOLO${n}` : "",
      c = Cn().version,
      l = [
        `  ${fn.banner_name}${o}nex-code${n}  ${fn.banner_version}v${c}${n}`,
        `  ${fn.banner_model}${t}${n}  ${fn.muted}\xB7  /help${n}${i}`,
        "",
      ],
      u = Math.max(r.length, l.length),
      d = Math.floor((u - r.length) / 2),
      f = Math.floor((u - l.length) / 2),
      m = Tc[0].length,
      h = [];
    for (let p = 0; p < u; p++) {
      let g = r[p - d] ?? " ".repeat(m),
        $ = l[p - f] ?? "";
      h.push(g + $);
    }
    console.log(
      `
` +
        h.join(`
`) +
        `
`,
    );
  }
  var {
      Spinner: Nm,
      MultiProgress: Mm,
      TaskProgress: Pm,
      ToolProgress: Im,
      setActiveTaskProgress: Lm,
      getActiveTaskProgress: jm,
      cleanupTerminal: Dm,
    } = Nn(),
    {
      formatToolCall: qm,
      formatResult: Fm,
      getToolSpinnerText: Um,
      formatToolSummary: Wm,
      formatSectionHeader: Bm,
      formatMilestone: Hm,
    } = Ec();
  Rc.exports = {
    C: zr,
    banner: Om,
    Spinner: Nm,
    MultiProgress: Mm,
    TaskProgress: Pm,
    ToolProgress: Im,
    setActiveTaskProgress: Lm,
    getActiveTaskProgress: jm,
    cleanupTerminal: Dm,
    formatToolCall: qm,
    formatResult: Fm,
    getToolSpinnerText: Um,
    formatToolSummary: Wm,
    formatSectionHeader: Bm,
    formatMilestone: Hm,
  };
});
var Ye = K((sk, Pc) => {
  var Gm = require("readline"),
    { C: Nt } = Ce(),
    Vr = [
      /rm\s+-rf\s+\/(?:\s|$)/,
      /rm\s+-rf\s+~(?:\/|\s|$)/,
      /rm\s+-rf\s+\.(?:\/|\s|$)/,
      /rm\s+-rf\s+\*(?:\s|$)/,
      /mkfs/,
      /dd\s+if=/,
      /:\(\)\s*\{/,
      />\/dev\/sd/,
      /curl.*\|\s*(?:ba)?sh/,
      /wget.*\|\s*(?:ba)?sh/,
      /cat\s+.*\.env\b/,
      /cat\s+.*credentials/i,
      /chmod\s+777/,
      /chown\s+root/,
      /passwd/,
      /userdel/,
      /useradd/,
      /\beval\s*\(/,
      /base64.*\|.*bash/,
      /\bprintenv\b/,
      /cat\s+.*\.ssh\/id_/,
      /cat\s+.*\.ssh\/config/,
      /\bnc\s+-[el]/,
      /\bncat\b/,
      /\bsocat\b/,
      /python3?\s+-c\s/,
      /node\s+-e\s/,
      /perl\s+-e\s/,
      /ruby\s+-e\s/,
      /(?:^|[;&|]\s*)history(?:\s|$)/,
      /curl.*-X\s*POST/,
      /curl.*--data/,
      /\bsed\s+-n\s+['"]?\d+,\d+p/,
    ],
    Cc = [
      ...Vr,
      /\bgrep\b.*\.env\b/,
      /\bawk\b.*\.env\b/,
      /\bsed\b.*\.env\b/,
      /\bhead\b.*\.env\b/,
      /\btail\b.*\.env\b/,
      /\bless\b.*\.env\b/,
      /\bmore\b.*\.env\b/,
      /\bstrings\b.*\.env\b/,
      /\bgrep\b.*credentials/i,
      /\bawk\b.*credentials/i,
      /\bsed\b.*credentials/i,
      /\bhead\b.*credentials/i,
      /\btail\b.*credentials/i,
      /\bcat\b.*private.*key/i,
      /\bgrep\b.*private_key/i,
      /\bcat\b.*google.*\.json/i,
      /\bcat\b.*service.?account/i,
    ];
  function Km(t) {
    for (let e of Cc) if (e.test(t)) return e;
    return null;
  }
  var Ac = [
      /\.env\b/,
      /credentials\b/i,
      /\.ssh\b/,
      /\.gnupg\b/,
      /\.aws\b/,
      /\.npmrc\b/,
      /\.docker\/config/,
      /\.kube\/config/,
      /venv\b/,
      /\.venv\b/,
      /\.sqlite3\b/,
      /\.git\/(?!hooks)/,
    ],
    Ym = /\b(?:rm|rmdir|unlink|truncate|shred|mv|cp)\b/,
    Xr = [
      /systemctl\s+(status|is-active|is-enabled|list-units|show)/,
      /journalctl\b/,
      /\btail\s/,
      /\bcat\s/,
      /\bhead\s/,
      /\bls\b/,
      /\bfind\s/,
      /\bgrep\s/,
      /\bwc\s/,
      /\bdf\b/,
      /\bfree\b/,
      /\buptime\b/,
      /\bwho\b/,
      /\bps\s/,
      /\bgit\s+(status|log|diff|branch|fetch)\b/,
      /\bgit\s+pull\b/,
      /\bss\s+-[tlnp]/,
      /\bnetstat\s/,
      /\bdu\s/,
      /\blscpu\b/,
      /\bnproc\b/,
      /\buname\b/,
      /\bhostname\b/,
      /\bgetent\b/,
      /\bid\b/,
      /psql\s.*-c\s/,
      /\bmysql\s.*-e\s/,
      /\bdnf\s+(check-update|list|info|history|repolist|updateinfo)\b/,
      /\brpm\s+-q/,
      /\bapt\s+list\b/,
      /\bopenssl\s+s_client\b/,
      /\bopenssl\s+x509\b/,
      /\bcertbot\s+certificates\b/,
      /\bcurl\s+-[sIkv]|curl\s+--head/,
      /\bdig\s/,
      /\bnslookup\s/,
      /\bping\s/,
      /\bgetenforce\b/,
      /\bsesearch\b/,
      /\bausearch\b/,
      /\bsealert\b/,
      /\bcrontab\s+-l\b/,
      /\btimedatectl\b/,
      /\bfirewall-cmd\s+--list/,
      /\bfirewall-cmd\s+--state/,
    ];
  function Oc(t) {
    let e =
      t.match(/ssh\s+[^"]*"([^"]+)"/)?.[1] ||
      t.match(/ssh\s+[^']*'([^']+)'/)?.[1];
    if (!e) return !1;
    let o = e
      .replace(/\bfor\s[\s\S]*?\bdone\b/g, (r) => r.replace(/;/g, "\0"))
      .replace(/\bwhile\s[\s\S]*?\bdone\b/g, (r) => r.replace(/;/g, "\0"))
      .split(/\s*(?:&&|;)\s*/)
      .map((r) => r.replace(/\x00/g, ";").trim())
      .filter(Boolean);
    if (o.length === 0) return !1;
    let n = (r) => {
      let i = r.replace(/^sudo\s+(?:-[ugCD]\s+\S+\s+|-[A-Za-z]+\s+)*/, "");
      if (/^\s*(?:echo|printf)\s/.test(i)) return !0;
      if (/^\s*for\s/.test(r) || /^\s*while\s/.test(r)) {
        let c = r.match(/\bdo\s+([\s\S]*?)\s*(?:done|$)/)?.[1];
        return c
          ? c
              .split(/\s*;\s*/)
              .map((u) => u.trim())
              .filter(Boolean)
              .every((u) => n(u))
          : Xr.some((l) => l.test(r));
      }
      return /^\w+=\$?\(/.test(i) || /^\w+=["']/.test(i) || /^\w+=\S/.test(i)
        ? !0
        : Xr.some((c) => c.test(i));
    };
    return o.every(n);
  }
  var Qr = [
      /rm\s+-rf\s/,
      /docker\s+system\s+prune/,
      /kubectl\s+delete/,
      /sudo\s/,
      /--no-verify\b/,
      /git\s+reset\s+--hard\b/,
      /git\s+clean\s+-[a-z]*f/,
      /git\s+checkout\s+--\s/,
      /git\s+push\s+(?:--force\b|-f\b)/,
    ],
    Nc = [
      /git\s+push/,
      /npm\s+publish/,
      /\bHUSKY=0\b/,
      /\bSKIP_HUSKY=1\b/,
      /\bSKIP_PREFLIGHT_CHECK=true\b/,
      /npx\s+.*publish/,
      /docker\s+rm/,
      /ssh\s/,
      /wget\s/,
      /curl\s.*-o\s/,
      /pip\s+install/,
      /npm\s+install\s+-g/,
    ],
    Mc = [...Qr, ...Nc],
    Zr = !1,
    pn = null,
    Jr = null;
  function zm(t) {
    Zr = t;
  }
  function Xm(t) {
    Jr = t;
  }
  function Jm() {
    return Zr;
  }
  function Vm(t) {
    pn = t;
  }
  function Qm(t) {
    for (let e of Vr) if (e.test(t)) return e;
    return null;
  }
  function Zm(t) {
    if (/ssh\s/.test(t) && Oc(t)) return !1;
    for (let e of Mc) if (e.test(t)) return !0;
    return !1;
  }
  function eh(t) {
    for (let e of Qr) if (e.test(t)) return !0;
    return !1;
  }
  function th(t) {
    if (process.env.NEX_UNPROTECT === "1" || !Ym.test(t)) return null;
    for (let e of Ac) if (e.test(t)) return e;
    return null;
  }
  function nh(t, e = {}) {
    if (Zr) return Promise.resolve(!0);
    if (Jr) return Jr(t, e);
    if (!process.stdout.isTTY || !process.stdin.isTTY) return sh(t, e);
    let s = e.toolName ? ["Yes", "No", "Always allow"] : ["Yes", "No"];
    return new Promise((o) => {
      let n = 0;
      pn && pn.pause();
      let r = global._nexRawWrite || ((f) => process.stdout.write(f)),
        i = () => {
          let f = process.stdout.rows || 24;
          return Math.max(1, f - s.length - 2);
        },
        c = () => {
          let f = i(),
            m = `\x1B[${f};1H\x1B[2K${Nt.yellow}${t}${Nt.reset}`;
          for (let h = 0; h < s.length; h++) {
            let p = h === n,
              g = p ? `${Nt.yellow}\u276F${Nt.reset}` : " ",
              $ = p ? `${Nt.yellow}${s[h]}${Nt.reset}` : s[h];
            m += `\x1B[${f + 1 + h};1H\x1B[2K  ${g} ${$}`;
          }
          r(m);
        },
        l = (f) => {
          (process.stdin.setRawMode(!1),
            process.stdin.pause(),
            process.stdin.removeListener("data", d));
          let m = global._nexRawWrite || ((g) => process.stdout.write(g)),
            h = i(),
            p = "";
          for (let g = 0; g < s.length + 1; g++) p += `\x1B[${h + g};1H\x1B[2K`;
          (m(p),
            global._nexFooter && global._nexFooter.drawFooter(),
            pn && pn.resume(),
            o(f));
        },
        u = (f) => {
          if (f === 1) {
            l(!1);
            return;
          }
          (f === 2 && e.toolName && fo(e.toolName), l(!0));
        },
        d = (f) => {
          if (f[0] === 3) {
            l(!1);
            return;
          }
          let m = f.toString();
          if (
            m === "\r" ||
            m ===
              `
`
          ) {
            u(n);
            return;
          }
          if (m === "\x1B[A") {
            ((n = (n - 1 + s.length) % s.length), c());
            return;
          }
          if (m === "\x1B[B") {
            ((n = (n + 1) % s.length), c());
            return;
          }
          let h = m.toLowerCase().trim();
          if (h === "y") {
            l(!0);
            return;
          }
          if (h === "n") {
            l(!1);
            return;
          }
          if (h === "a" && e.toolName) {
            (fo(e.toolName), l(!0));
            return;
          }
        };
      (c(),
        process.stdin.setRawMode(!0),
        process.stdin.resume(),
        process.stdin.on("data", d));
    });
  }
  function sh(t, e) {
    let s = e.toolName ? "[Y/n/a] " : "[Y/n] ";
    return new Promise((o) => {
      let n = (r) => {
        let i = r.trim().toLowerCase();
        i === "a" && e.toolName ? (fo(e.toolName), o(!0)) : o(i !== "n");
      };
      if (pn) pn.question(`${Nt.yellow}${t} ${s}${Nt.reset}`, n);
      else {
        let r = Gm.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        r.question(`${Nt.yellow}${t} ${s}${Nt.reset}`, (i) => {
          (r.close(), n(i));
        });
      }
    });
  }
  var fo = () => {};
  function oh(t) {
    fo = t;
  }
  Pc.exports = {
    FORBIDDEN_PATTERNS: Vr,
    SSH_FORBIDDEN_PATTERNS: Cc,
    BASH_PROTECTED_PATHS: Ac,
    SSH_SAFE_PATTERNS: Xr,
    isSSHReadOnly: Oc,
    DANGEROUS_BASH: Mc,
    CRITICAL_BASH: Qr,
    NOTABLE_BASH: Nc,
    isForbidden: Qm,
    isSSHForbidden: Km,
    isDangerous: Zm,
    isCritical: eh,
    isBashPathForbidden: th,
    confirm: nh,
    setAutoConfirm: zm,
    getAutoConfirm: Jm,
    setConfirmHook: Xm,
    setReadlineInterface: Vm,
    setAllowAlwaysHandler: oh,
  };
});
var Mn = K((ok, Ic) => {
  async function rh(t, e) {
    if (!t.response?.data) return t.message;
    let s = t.response.data;
    if (typeof s == "object" && s !== null && typeof s.pipe != "function")
      return e(s) || t.message;
    try {
      let o = await new Promise((r, i) => {
          let c = [];
          (s.on("data", (l) => c.push(l)),
            s.on("end", () => r(Buffer.concat(c).toString("utf8"))),
            s.on("error", i));
        }),
        n = JSON.parse(o);
      return e(n) || o || t.message;
    } catch {
      return t.message;
    }
  }
  var ei = class t {
    constructor(e = {}) {
      if (new.target === t)
        throw new Error(
          "BaseProvider is abstract \u2014 use a concrete provider",
        );
      ((this.name = e.name || "unknown"),
        (this.baseUrl = e.baseUrl || ""),
        (this.models = e.models || {}),
        (this.defaultModel = e.defaultModel || null));
    }
    isConfigured() {
      throw new Error(`${this.name}: isConfigured() not implemented`);
    }
    getApiKey() {
      return null;
    }
    getModels() {
      return this.models;
    }
    getModelNames() {
      return Object.keys(this.models);
    }
    getModel(e) {
      return this.models[e] || null;
    }
    async chat(e, s, o = {}) {
      throw new Error(`${this.name}: chat() not implemented`);
    }
    async stream(e, s, o = {}) {
      throw new Error(`${this.name}: stream() not implemented`);
    }
    formatMessages(e) {
      return { messages: e };
    }
    formatTools(e) {
      return e;
    }
    normalizeResponse(e) {
      throw new Error(`${this.name}: normalizeResponse() not implemented`);
    }
  };
  Ic.exports = { BaseProvider: ei, readStreamErrorBody: rh };
});
var Dc = K((rk, jc) => {
  var po = require("axios"),
    ih = require("http"),
    ah = require("https"),
    { BaseProvider: ch, readStreamErrorBody: lh } = Mn(),
    mo = new ih.Agent({ keepAlive: !0, maxSockets: 6, timeout: 6e4 }),
    ho = new ah.Agent({ keepAlive: !0, maxSockets: 6, timeout: 6e4 }),
    Lc = {
      "qwen3-coder:480b": {
        id: "qwen3-coder:480b",
        name: "Qwen3 Coder 480B",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "qwen3-coder-next": {
        id: "qwen3-coder-next",
        name: "Qwen3 Coder Next",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "devstral-2:123b": {
        id: "devstral-2:123b",
        name: "Devstral 2 123B",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "devstral-small-2:24b": {
        id: "devstral-small-2:24b",
        name: "Devstral Small 2 24B",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "kimi-k2.5": {
        id: "kimi-k2.5",
        name: "Kimi K2.5",
        maxTokens: 16384,
        contextWindow: 256e3,
      },
      "kimi-k2:1t": {
        id: "kimi-k2:1t",
        name: "Kimi K2 1T",
        maxTokens: 16384,
        contextWindow: 256e3,
      },
      "kimi-k2-thinking": {
        id: "kimi-k2-thinking",
        name: "Kimi K2 Thinking",
        maxTokens: 16384,
        contextWindow: 256e3,
      },
      "deepseek-v3.2": {
        id: "deepseek-v3.2",
        name: "DeepSeek V3.2",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "deepseek-v3.1:671b": {
        id: "deepseek-v3.1:671b",
        name: "DeepSeek V3.1 671B",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "cogito-2.1:671b": {
        id: "cogito-2.1:671b",
        name: "Cogito 2.1 671B",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "qwen3.5:397b-cloud": {
        id: "qwen3.5:397b-cloud",
        name: "Qwen3.5 397B Cloud",
        maxTokens: 16384,
        contextWindow: 262144,
      },
      "qwen3.5:397b": {
        id: "qwen3.5:397b",
        name: "Qwen3.5 397B",
        maxTokens: 16384,
        contextWindow: 262144,
      },
      "qwen3.5:122b-a10b": {
        id: "qwen3.5:122b-a10b",
        name: "Qwen3.5 122B-A10B",
        maxTokens: 16384,
        contextWindow: 262144,
      },
      "qwen3.5:35b-a3b": {
        id: "qwen3.5:35b-a3b",
        name: "Qwen3.5 35B-A3B",
        maxTokens: 16384,
        contextWindow: 262144,
      },
      "qwen3.5:27b": {
        id: "qwen3.5:27b",
        name: "Qwen3.5 27B",
        maxTokens: 16384,
        contextWindow: 262144,
      },
      "qwen3-next:80b": {
        id: "qwen3-next:80b",
        name: "Qwen3 Next 80B",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "mistral-large-3:675b": {
        id: "mistral-large-3:675b",
        name: "Mistral Large 3 675B",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "gpt-oss:120b": {
        id: "gpt-oss:120b",
        name: "GPT-OSS 120B",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "minimax-m2.5": {
        id: "minimax-m2.5",
        name: "MiniMax M2.5",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "glm-5": {
        id: "glm-5",
        name: "GLM 5",
        maxTokens: 16384,
        contextWindow: 128e3,
      },
      "glm-4.7": {
        id: "glm-4.7",
        name: "GLM 4.7",
        maxTokens: 16384,
        contextWindow: 128e3,
      },
      "qwen3.5:9b": {
        id: "qwen3.5:9b",
        name: "Qwen3.5 9B",
        maxTokens: 8192,
        contextWindow: 262144,
      },
      "qwen3.5:4b": {
        id: "qwen3.5:4b",
        name: "Qwen3.5 4B",
        maxTokens: 8192,
        contextWindow: 262144,
      },
      "qwen3.5:2b": {
        id: "qwen3.5:2b",
        name: "Qwen3.5 2B",
        maxTokens: 8192,
        contextWindow: 262144,
      },
      "qwen3.5:0.8b": {
        id: "qwen3.5:0.8b",
        name: "Qwen3.5 0.8B",
        maxTokens: 8192,
        contextWindow: 262144,
      },
      "gemma3:27b": {
        id: "gemma3:27b",
        name: "Gemma 3 27B",
        maxTokens: 8192,
        contextWindow: 131072,
      },
      "gemma3:12b": {
        id: "gemma3:12b",
        name: "Gemma 3 12B",
        maxTokens: 8192,
        contextWindow: 131072,
      },
      "gemma3:4b": {
        id: "gemma3:4b",
        name: "Gemma 3 4B",
        maxTokens: 8192,
        contextWindow: 131072,
      },
      "ministral-3:14b": {
        id: "ministral-3:14b",
        name: "Ministral 3 14B",
        maxTokens: 8192,
        contextWindow: 131072,
      },
      "ministral-3:8b": {
        id: "ministral-3:8b",
        name: "Ministral 3 8B",
        maxTokens: 8192,
        contextWindow: 131072,
      },
      "gemini-3-flash-preview": {
        id: "gemini-3-flash-preview",
        name: "Gemini 3 Flash Preview",
        maxTokens: 16384,
        contextWindow: 131072,
      },
    },
    ti = class extends ch {
      constructor(e = {}) {
        (super({
          name: "ollama",
          baseUrl: e.baseUrl || "https://ollama.com",
          models: e.models || Lc,
          defaultModel: e.defaultModel || "qwen3-coder:480b",
          ...e,
        }),
          (this.timeout = e.timeout || 18e4),
          (this.temperature = e.temperature ?? 0.2),
          (this._discovered = !1));
      }
      async discoverModels() {
        if (!this._discovered) {
          if (((this._discovered = !0), !process.stdout.isTTY)) {
            po.get(`${this.baseUrl}/api/tags`, {
              timeout: 5e3,
              headers: this._getHeaders(),
              httpAgent: mo,
              httpsAgent: ho,
            })
              .then((e) => {
                let s = e.data?.models || [];
                for (let o of s) {
                  let n = (o.name || o.model || "").replace(/:latest$/, "");
                  !n ||
                    this.models[n] ||
                    (this.models[n] = {
                      id: n,
                      name: o.name || n,
                      maxTokens: 16384,
                      contextWindow: 131072,
                    });
                }
              })
              .catch(() => {});
            return;
          }
          try {
            let s =
              (
                await po.get(`${this.baseUrl}/api/tags`, {
                  timeout: 5e3,
                  headers: this._getHeaders(),
                  httpAgent: mo,
                  httpsAgent: ho,
                })
              ).data?.models || [];
            for (let o of s) {
              let n = (o.name || o.model || "").replace(/:latest$/, "");
              !n ||
                this.models[n] ||
                (this.models[n] = {
                  id: n,
                  name: o.name || n,
                  maxTokens: 16384,
                  contextWindow: 131072,
                });
            }
          } catch {}
        }
      }
      isConfigured() {
        return !!this.getApiKey();
      }
      getApiKey() {
        return process.env.OLLAMA_API_KEY || null;
      }
      _getHeaders() {
        let e = this.getApiKey();
        if (!e) throw new Error("OLLAMA_API_KEY not set");
        return { Authorization: `Bearer ${e}` };
      }
      _formatMessages(e) {
        return e.map((s) => {
          if (s.role === "user" && Array.isArray(s.content)) {
            let o = [],
              n = [];
            for (let i of s.content)
              i.type === "text"
                ? o.push(i.text ?? "")
                : i.type === "image" && i.data && n.push(i.data);
            let r = {
              role: "user",
              content: o.join(`
`),
            };
            return (n.length > 0 && (r.images = n), r);
          }
          return s;
        });
      }
      async chat(e, s, o = {}) {
        await this.discoverModels();
        let n = o.model || this.defaultModel,
          r = this.getModel(n),
          i = o.maxTokens || r?.maxTokens || 16384,
          c;
        try {
          c = await po.post(
            `${this.baseUrl}/api/chat`,
            {
              model: n,
              messages: this._formatMessages(e),
              tools: s && s.length > 0 ? s : void 0,
              stream: !1,
              options: {
                temperature: o.temperature ?? this.temperature,
                num_predict: i,
              },
            },
            {
              timeout: o.timeout || this.timeout,
              headers: this._getHeaders(),
              httpAgent: mo,
              httpsAgent: ho,
            },
          );
        } catch (l) {
          if (
            l.name === "CanceledError" ||
            l.name === "AbortError" ||
            l.code === "ERR_CANCELED"
          )
            throw l;
          let u = l.response?.status ? ` [HTTP ${l.response.status}]` : "",
            d = l.response?.data?.error || l.message;
          throw new Error(`API Error${u}: ${d}`);
        }
        return this.normalizeResponse(c.data);
      }
      async stream(e, s, o = {}) {
        await this.discoverModels();
        let n = o.model || this.defaultModel,
          r = this.getModel(n),
          i = o.maxTokens || r?.maxTokens || 16384,
          c = o.onToken || (() => {}),
          l = o.onThinkingToken || (() => {}),
          u;
        try {
          u = await po.post(
            `${this.baseUrl}/api/chat`,
            {
              model: n,
              messages: this._formatMessages(e),
              tools: s && s.length > 0 ? s : void 0,
              stream: !0,
              options: {
                temperature: o.temperature ?? this.temperature,
                num_predict: i,
              },
            },
            {
              timeout: o.timeout || this.timeout,
              headers: this._getHeaders(),
              responseType: "stream",
              signal: o.signal,
              httpAgent: mo,
              httpsAgent: ho,
            },
          );
        } catch (d) {
          if (
            d.name === "CanceledError" ||
            d.name === "AbortError" ||
            d.code === "ERR_CANCELED"
          )
            throw d;
          let f = d.response?.status ? ` [HTTP ${d.response.status}]` : "",
            m = await lh(d, (h) => h?.error);
          throw new Error(`API Error${f}: ${m}`);
        }
        return new Promise((d, f) => {
          let m = "",
            h = [],
            p = "";
          (o.signal &&
            o.signal.addEventListener(
              "abort",
              () => {
                (u.data.destroy(),
                  f(
                    new DOMException("The operation was aborted", "AbortError"),
                  ));
              },
              { once: !0 },
            ),
            u.data.on("data", (g) => {
              p += g.toString();
              let $ = p.split(`
`);
              p = $.pop() || "";
              for (let w of $) {
                if (!w.trim()) continue;
                let _;
                try {
                  _ = JSON.parse(w);
                } catch {
                  continue;
                }
                if (
                  (_.message?.thinking && l(_.message.thinking),
                  _.message?.content &&
                    (c(_.message.content), (m += _.message.content)),
                  _.message?.tool_calls && (h = h.concat(_.message.tool_calls)),
                  _.done)
                ) {
                  d({ content: m, tool_calls: this._normalizeToolCalls(h) });
                  return;
                }
              }
            }),
            u.data.on("error", (g) => {
              o.signal?.aborted || f(new Error(`Stream error: ${g.message}`));
            }),
            u.data.on("end", () => {
              if (p.trim())
                try {
                  let g = JSON.parse(p);
                  (g.message?.thinking && l(g.message.thinking),
                    g.message?.content &&
                      (c(g.message.content), (m += g.message.content)),
                    g.message?.tool_calls &&
                      (h = h.concat(g.message.tool_calls)));
                } catch {}
              d({ content: m, tool_calls: this._normalizeToolCalls(h) });
            }));
        });
      }
      normalizeResponse(e) {
        let s = e.message || {};
        return {
          content: s.content || "",
          tool_calls: this._normalizeToolCalls(s.tool_calls || []),
        };
      }
      _normalizeToolCalls(e) {
        return e.map((s, o) => ({
          id: s.id || `ollama-${Date.now()}-${o}`,
          function: {
            name: s.function?.name || s.name || "unknown",
            arguments: s.function?.arguments || s.arguments || {},
          },
        }));
      }
    };
  jc.exports = { OllamaProvider: ti, OLLAMA_MODELS: Lc };
});
var Hc = K((ik, Bc) => {
  var { callChat: uh } = Ae(),
    { estimateTokens: ni } = Je(),
    qc = process.env.NEX_COMPACTION !== "false",
    Fc = 6,
    Uc = 500,
    dh = `Summarize this conversation history concisely. Focus on:
- What files were read, created, or modified
- Key decisions made and their rationale
- Current state of the task (what's done, what's pending)
- Any errors encountered and how they were resolved
Be factual and brief. Use bullet points. Max 300 words.`;
  async function fh(t) {
    if (!qc || t.length < Fc) return null;
    let e = [
      { role: "system", content: dh },
      { role: "user", content: Wc(t) },
    ];
    try {
      let o = (
        (await uh(e, [], { temperature: 0, maxTokens: Uc })).content || ""
      ).trim();
      if (!o) return null;
      let n = t.reduce(
          (i, c) =>
            i +
            ni(c.content || "") +
            (c.tool_calls ? ni(JSON.stringify(c.tool_calls)) : 0),
          0,
        ),
        r = ni(o);
      return r >= n * 0.8
        ? null
        : {
            message: {
              role: "system",
              content: `[Conversation Summary \u2014 ${t.length} messages compacted]
${o}`,
              _compacted: !0,
              _originalCount: t.length,
            },
            tokensRemoved: n - r,
          };
    } catch {
      return null;
    }
  }
  function Wc(t) {
    return t.map((e) => {
      let s = e.role === "tool" ? "tool_result" : e.role,
        o = (e.content || "").substring(0, 500);
      if (e.tool_calls) {
        let n = e.tool_calls.map((r) => r.function?.name).join(", ");
        return `[${s}] ${o}
  tools: ${n}`;
      }
      return `[${s}] ${o}`;
    }).join(`

`);
  }
  Bc.exports = {
    compactMessages: fh,
    formatMessagesForSummary: Wc,
    COMPACTION_ENABLED: qc,
    COMPACTION_MIN_MESSAGES: Fc,
    COMPACTION_SUMMARY_BUDGET: Uc,
  };
});
var Je = K((ak, Zc) => {
  var ph = require("path");
  function Kc() {
    return Ae().getActiveModel();
  }
  var mh = { anthropic: 3.5, openai: 4, gemini: 4, ollama: 4, local: 4 },
    mn = new Map(),
    Gc = 1e3,
    si = new WeakMap(),
    as = null;
  function hh() {
    if (as !== null) return as;
    try {
      let e = Kc()?.provider || "ollama";
      return ((as = mh[e] || 4), as);
    } catch {
      return 4;
    }
  }
  function gh() {
    as = null;
  }
  function hn(t) {
    if (!t) return 0;
    typeof t != "string" && (t = JSON.stringify(t));
    let e =
        t.length <= 80
          ? t
          : `${t.length}:${t.substring(0, 60)}:${t.substring(t.length - 20)}`,
      s = mn.get(e);
    if (s !== void 0) return (mn.delete(e), mn.set(e, s), s);
    let o = Math.ceil(t.length / hh());
    if (mn.size >= Gc) {
      let n = Gc >> 1,
        r = mn.keys();
      for (let i = 0; i < n; i++) mn.delete(r.next().value);
    }
    return (mn.set(e, o), o);
  }
  function $h(t) {
    if (si.has(t)) return si.get(t);
    let e = JSON.stringify(t);
    return (si.set(t, e), e);
  }
  function In(t) {
    let s = 4;
    if ((t.content && (s += hn(t.content)), t.tool_calls))
      for (let o of t.tool_calls) {
        ((s += 4), (s += hn(o.function?.name || "")));
        let n = o.function?.arguments;
        typeof n == "string" ? (s += hn(n)) : n && (s += hn(JSON.stringify(n)));
      }
    return s;
  }
  function bt(t) {
    let e = 0;
    for (let s of t) e += In(s);
    return e;
  }
  function yh(t, e) {
    if (t && t.length === e.length) {
      let r = !1;
      for (let i = 0; i < e.length; i++)
        if (t[i] !== e[i]) {
          r = !0;
          break;
        }
      if (!r) return 0;
    }
    let s = t ? t.length : 0,
      o = e.length,
      n = 0;
    for (let r = s; r < o; r++) n += In(e[r]);
    return n;
  }
  function go(t) {
    return !t || t.length === 0 ? 0 : hn(JSON.stringify(t));
  }
  function $o() {
    return Kc()?.contextWindow || 32768;
  }
  function wh(t, e) {
    let s = bt(t),
      o = go(e),
      n = s + o,
      r = $o(),
      i = r > 0 ? (n / r) * 100 : 0,
      c = 0,
      l = 0,
      u = 0;
    for (let d of t) {
      let f = In(d);
      d.role === "system" ? (c += f) : d.role === "tool" ? (u += f) : (l += f);
    }
    return {
      used: n,
      limit: r,
      percentage: Math.round(i * 10) / 10,
      breakdown: {
        system: c,
        conversation: l,
        toolResults: u,
        toolDefinitions: o,
      },
      messageCount: t.length,
    };
  }
  var Yc = parseFloat(process.env.NEX_COMPRESSION_THRESHOLD) || 0.75,
    zc = parseFloat(process.env.NEX_SAFETY_MARGIN) || 0.1,
    Xc = parseInt(process.env.NEX_KEEP_RECENT, 10) || 10,
    bh = 200,
    _h = 500;
  function Jc(t, e) {
    if (!t || t.length <= e) return t;
    let o = /^(ERROR|EXIT|BLOCKED|CANCELLED)/i.test(t) ? e * 3 : e;
    if (t.length <= o) return t;
    let n = t.split(`
`);
    if (n.length <= 10) {
      let p = Math.floor(o * 0.6),
        g = Math.floor(o * 0.4),
        $ = t.substring(0, p),
        w = t.substring(t.length - g);
      return (
        $ +
        `
...(${t.length} chars total)...
` +
        w
      );
    }
    let r = Math.floor(n.length * 0.4),
      i = Math.floor(n.length * 0.4),
      c = [],
      l = 0,
      u = Math.floor(o * 0.4);
    for (let p = 0; p < r && l < u; p++)
      if (l + n[p].length + 1 > u && n[p].trim().startsWith("```")) {
        (c.push(n[p]), (l += n[p].length + 1));
        let g = p + 1;
        for (; g < n.length && l < u * 1.5 && !n[g].trim().startsWith("```"); )
          (c.push(n[g]), (l += n[g].length + 1), g++);
        (g < n.length &&
          n[g].trim().startsWith("```") &&
          (c.push(n[g]), (l += n[g].length + 1)),
          (p = g));
      } else (c.push(n[p]), (l += n[p].length + 1));
    let d = [],
      f = 0,
      m = Math.floor(o * 0.4);
    for (let p = n.length - 1; p >= n.length - i && f < m; p--)
      if (f + n[p].length + 1 > m && n[p].trim().startsWith("```")) {
        (d.push(n[p]), (f += n[p].length + 1));
        let g = p - 1;
        for (; g >= 0 && f < m * 1.5 && !n[g].trim().startsWith("```"); )
          (d.push(n[g]), (f += n[g].length + 1), g--);
        (g >= 0 &&
          n[g].trim().startsWith("```") &&
          (d.push(n[g]), (f += n[g].length + 1)),
          (p = g));
      } else (d.push(n[p]), (f += n[p].length + 1));
    d.reverse();
    let h = n.length - c.length - d.length;
    return (
      c.join(`
`) +
      `
...(${h} lines omitted, ${n.length} total)...
` +
      d.join(`
`)
    );
  }
  function Pn(t, e = "light") {
    let s = e === "aggressive" ? 100 : e === "medium" ? 200 : _h,
      o = e === "aggressive" ? 50 : e === "medium" ? 100 : bh;
    if (t.role === "tool") {
      let n =
        typeof t.content == "string" ? t.content : JSON.stringify(t.content);
      return n.length > o ? { ...t, content: Jc(n, o) } : t;
    }
    if (t.role === "assistant") {
      let n = { ...t };
      return (
        n.content &&
          n.content.length > s &&
          (n.content =
            n.content.substring(0, s) +
            `
...(truncated)`),
        n.tool_calls &&
          e === "aggressive" &&
          (n.tool_calls = n.tool_calls.map((r) => ({
            ...r,
            function: {
              name: r.function.name,
              arguments:
                typeof r.function.arguments == "string"
                  ? r.function.arguments.substring(0, 50)
                  : r.function.arguments,
            },
          }))),
        n
      );
    }
    return t;
  }
  function Vc(t, e, s, o) {
    let n = 0;
    if (t.role === "system") return 100;
    if (t.role === "user") n += 35;
    else if (t.role === "tool") {
      let i =
        typeof t.content == "string"
          ? t.content
          : JSON.stringify(t.content || "");
      /^(ERROR|BLOCKED|CANCELLED)/i.test(i) ? (n += 30) : (n += 15);
    } else t.role === "assistant" && (n += t.tool_calls ? 20 : 10);
    let r = s > 1 ? e / (s - 1) : 1;
    if (((n += Math.round(r * 30)), o && o.size > 0)) {
      let i =
          typeof t.content == "string"
            ? t.content
            : JSON.stringify(t.content || ""),
        c = 0;
      for (let l of o) (i.includes(l) || i.includes(ph.basename(l))) && c++;
      n += Math.min(30, c * 10);
    }
    return Math.min(100, n);
  }
  function Qc(t, e = 10) {
    let s = new Set(),
      o = t.slice(-e),
      n = /(?:\/[\w.-]+)+\.\w+/g;
    for (let r of o) {
      let c = (
        typeof r.content == "string"
          ? r.content
          : JSON.stringify(r.content || "")
      ).match(n);
      c && c.forEach((l) => s.add(l));
    }
    return s;
  }
  async function xh(t, e, s = {}) {
    let o = s.threshold ?? Yc,
      n = s.safetyMargin ?? zc,
      r = s.keepRecent ?? Xc,
      i = $o(),
      c = go(e),
      l = Math.floor(i * (o - n)),
      u = l - c,
      d = bt(t),
      f = d + c;
    if (f <= l)
      return { messages: t, compressed: !1, compacted: !1, tokensRemoved: 0 };
    let m = d,
      h = null,
      p = 0;
    t.length > 0 && t[0].role === "system" && ((h = t[0]), (p = 1));
    let g = Math.max(p, t.length - r),
      $ = t.slice(p, g),
      w = t.slice(g),
      _ = $.filter((P) => !P._compacted);
    if (_.length >= 6)
      try {
        let { compactMessages: P } = Hc(),
          W = await P(_);
        if (W) {
          let we = [...$.filter((z) => z._compacted), W.message],
            fe = Vt(h, we, w),
            G = bt(fe);
          if (G + c <= l)
            return {
              messages: fe,
              compressed: !0,
              compacted: !0,
              tokensRemoved: m - G,
            };
          $ = we;
        }
      } catch (P) {
        process.env.NEX_DEBUG &&
          console.error("[context-engine] LLM compacting failed:", P.message);
      }
    let x = (f - l) / l,
      v = $.map((P) => Pn(P, "light")),
      b = Vt(h, v, w),
      k = bt(b);
    if (k + c <= l)
      return {
        messages: b,
        compressed: !0,
        compacted: !1,
        tokensRemoved: m - k,
      };
    if (
      ((v = $.map((P) => Pn(P, "medium"))),
      (b = Vt(h, v, w)),
      (k = bt(b)),
      k + c <= l)
    )
      return {
        messages: b,
        compressed: !0,
        compacted: !1,
        tokensRemoved: m - k,
      };
    if (
      ((v = $.map((P) => Pn(P, "aggressive"))),
      (b = Vt(h, v, w)),
      (k = bt(b)),
      k + c <= l)
    )
      return {
        messages: b,
        compressed: !0,
        compacted: !1,
        tokensRemoved: m - k,
      };
    let A = Qc([...v, ...w]),
      O = v.map((P, W) => ({
        msg: P,
        score: Vc(P, W, v.length, A),
        tokens: In(P),
      }));
    for (; O.length > 0 && k > u; ) {
      let P = 0;
      for (let W = 1; W < O.length; W++) O[W].score < O[P].score && (P = W);
      ((k -= O[P].tokens), O.splice(P, 1));
    }
    return (
      (v = O.map((P) => P.msg)),
      (b = Vt(h, v, w)),
      (k = bt(b)),
      { messages: b, compressed: !0, compacted: !1, tokensRemoved: m - k }
    );
  }
  function Vt(t, e, s) {
    let o = [];
    return (t && o.push(t), o.push(...e, ...s), o);
  }
  function kh(t, e) {
    if (!t) return "";
    if (hn(t) <= e) return t;
    let o = e * 4,
      n = t.split(`
`),
      r = Math.floor(o * 0.6),
      i = Math.floor(o * 0.4),
      c = "",
      l = 0;
    for (let h of n) {
      if (c.length + h.length + 1 > r) break;
      ((c +=
        (c
          ? `
`
          : "") + h),
        l++);
    }
    let u = "",
      d = 0;
    for (let h = n.length - 1; h >= l; h--) {
      let p =
        n[h] +
        (u
          ? `
`
          : "") +
        u;
      if (p.length > i) break;
      ((u = p), d++);
    }
    let m = `

... (${n.length - l - d} lines omitted, ${n.length} total) ...

`;
    return c + m + u;
  }
  var vh = 6;
  function Sh(t, e, s = !1) {
    let o = $o(),
      n = go(e),
      r = Math.floor(o * (s ? 0.35 : 0.5)) - n,
      i = bt(t),
      c = Math.floor(i * (s ? 0.5 : 0.8));
    r > c && (r = c);
    let l = null,
      u = 0;
    t.length > 0 && t[0].role === "system" && ((l = t[0]), (u = 1));
    let d = s ? 2 : vh,
      f = Math.max(u, t.length - d),
      m = t.slice(u, f),
      h = t.slice(f),
      p = m.map((b) => Pn(b, "aggressive"));
    s && (h = h.map((b) => Pn(b, "aggressive")));
    let g = Vt(l, p, h),
      $ = bt(g);
    for (; p.length > 0 && $ > r; ) {
      let b = p.shift();
      $ -= In(b);
    }
    (s &&
      $ > r &&
      ((h = h.filter((k) => k.role === "user").slice(-1)),
      (g = Vt(l, [], h)),
      ($ = bt(g))),
      (g = Vt(l, p, h)));
    let w = t.filter((b) => b.role === "user"),
      _ = (b) => {
        let k = typeof b.content == "string" ? b.content : "";
        return (
          k.startsWith("[SYSTEM WARNING]") ||
          k.startsWith("[SYSTEM:") ||
          k.startsWith("BLOCKED:")
        );
      },
      x = w.find((b) => !_(b)),
      v = [...w].reverse().find((b) => !_(b));
    if (x && !g.find((b) => b === x)) {
      let b = g.findIndex((A) => A.role === "system"),
        k = b >= 0 ? b + 1 : 0;
      g.splice(k, 0, x);
    }
    return (
      v && v !== x && !g.find((b) => b === v) && g.push(v),
      { messages: g, tokensRemoved: i - bt(g) }
    );
  }
  Zc.exports = {
    estimateTokens: hn,
    estimateMessageTokens: In,
    estimateMessagesTokens: bt,
    estimateDeltaTokens: yh,
    estimateToolsTokens: go,
    serializeMessage: $h,
    getContextWindow: $o,
    getUsage: wh,
    compressMessage: Pn,
    compressToolResult: Jc,
    scoreMessageRelevance: Vc,
    extractActiveFiles: Qc,
    fitToContext: xh,
    forceCompress: Sh,
    truncateFileContent: kh,
    invalidateTokenRatioCache: gh,
    COMPRESSION_THRESHOLD: Yc,
    SAFETY_MARGIN: zc,
    KEEP_RECENT: Xc,
  };
});
var sl = K((lk, nl) => {
  var el = require("axios"),
    { BaseProvider: Eh, readStreamErrorBody: Th } = Mn(),
    { serializeMessage: ck } = Je(),
    tl = {
      "gpt-4o": {
        id: "gpt-4o",
        name: "GPT-4o",
        maxTokens: 16384,
        contextWindow: 128e3,
      },
      "gpt-4o-mini": {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        maxTokens: 16384,
        contextWindow: 128e3,
      },
      "gpt-4.1": {
        id: "gpt-4.1",
        name: "GPT-4.1",
        maxTokens: 32768,
        contextWindow: 128e3,
      },
      "gpt-4.1-mini": {
        id: "gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        maxTokens: 32768,
        contextWindow: 128e3,
      },
      "gpt-4.1-nano": {
        id: "gpt-4.1-nano",
        name: "GPT-4.1 Nano",
        maxTokens: 16384,
        contextWindow: 128e3,
      },
      o1: { id: "o1", name: "o1", maxTokens: 1e5, contextWindow: 2e5 },
      o3: { id: "o3", name: "o3", maxTokens: 1e5, contextWindow: 2e5 },
      "o3-mini": {
        id: "o3-mini",
        name: "o3 Mini",
        maxTokens: 65536,
        contextWindow: 2e5,
      },
      "o4-mini": {
        id: "o4-mini",
        name: "o4 Mini",
        maxTokens: 1e5,
        contextWindow: 2e5,
      },
    },
    oi = class extends Eh {
      constructor(e = {}) {
        (super({
          name: "openai",
          baseUrl: e.baseUrl || "https://api.openai.com/v1",
          models: e.models || tl,
          defaultModel: e.defaultModel || "gpt-4o",
          ...e,
        }),
          (this.timeout = e.timeout || 18e4),
          (this.temperature = e.temperature ?? 0.2));
      }
      isConfigured() {
        return !!this.getApiKey();
      }
      getApiKey() {
        return process.env.OPENAI_API_KEY || null;
      }
      _getHeaders() {
        let e = this.getApiKey();
        if (!e) throw new Error("OPENAI_API_KEY not set");
        return {
          Authorization: `Bearer ${e}`,
          "Content-Type": "application/json",
        };
      }
      _messageFormatCache = new WeakMap();
      _messageStringCache = new Map();
      _maxCacheSize = 200;
      formatMessages(e) {
        let s = [];
        for (let o of e) {
          if (this._messageFormatCache.has(o)) {
            s.push(this._messageFormatCache.get(o));
            continue;
          }
          let n = this._getMessageCacheKey(o);
          if (this._messageStringCache.has(n)) {
            let i = this._messageStringCache.get(n);
            (this._messageFormatCache.set(o, i), s.push(i));
            continue;
          }
          let r = this._formatSingleMessage(o);
          (this._messageStringCache.size < this._maxCacheSize &&
            this._messageStringCache.set(n, r),
            this._messageFormatCache.set(o, r),
            s.push(r));
        }
        return { messages: s };
      }
      _getMessageCacheKey(e) {
        let s = e.role || "",
          o = typeof e.content == "string" ? e.content.substring(0, 100) : "",
          n = e.tool_calls ? e.tool_calls.length : 0;
        return `${s}:${o.length}:${n}`;
      }
      _formatSingleMessage(e) {
        if (e.role === "assistant" && e.tool_calls)
          return {
            role: "assistant",
            content: e.content || null,
            tool_calls: e.tool_calls.map((s) => ({
              id: s.id || `call-${Date.now()}`,
              type: "function",
              function: {
                name: s.function.name,
                arguments:
                  typeof s.function.arguments == "string"
                    ? s.function.arguments
                    : JSON.stringify(s.function.arguments),
              },
            })),
          };
        if (e.role === "tool")
          return {
            role: "tool",
            content:
              typeof e.content == "string"
                ? e.content
                : JSON.stringify(e.content),
            tool_call_id: e.tool_call_id,
          };
        if (e.role === "user" && Array.isArray(e.content)) {
          let s = [];
          for (let o of e.content)
            if (o.type === "text") s.push({ type: "text", text: o.text ?? "" });
            else if (o.type === "image" && o.data) {
              let n = o.data.startsWith("data:")
                ? o.data
                : `data:${o.media_type || "image/png"};base64,${o.data}`;
              s.push({
                type: "image_url",
                image_url: { url: n, detail: "auto" },
              });
            }
          return { role: "user", content: s };
        }
        return { role: e.role, content: e.content };
      }
      async chat(e, s, o = {}) {
        let n = o.model || this.defaultModel,
          r = this.getModel(n),
          i = o.maxTokens || r?.maxTokens || 16384,
          { messages: c } = this.formatMessages(e),
          l = {
            model: n,
            messages: c,
            max_tokens: i,
            temperature: o.temperature ?? this.temperature,
          };
        s && s.length > 0 && (l.tools = s);
        let u;
        try {
          u = await el.post(`${this.baseUrl}/chat/completions`, l, {
            timeout: o.timeout || this.timeout,
            headers: this._getHeaders(),
          });
        } catch (d) {
          if (
            d.name === "CanceledError" ||
            d.name === "AbortError" ||
            d.code === "ERR_CANCELED"
          )
            throw d;
          let f = d.response?.status ? ` [HTTP ${d.response.status}]` : "",
            m =
              d.response?.data?.error?.message ||
              d.response?.data?.error ||
              d.message;
          throw new Error(`API Error${f}: ${m}`);
        }
        return this.normalizeResponse(u.data);
      }
      async stream(e, s, o = {}) {
        let n = o.model || this.defaultModel,
          r = this.getModel(n),
          i = o.maxTokens || r?.maxTokens || 16384,
          c = o.onToken || (() => {}),
          { messages: l } = this.formatMessages(e),
          u = {
            model: n,
            messages: l,
            max_tokens: i,
            temperature: o.temperature ?? this.temperature,
            stream: !0,
          };
        s && s.length > 0 && (u.tools = s);
        let d;
        try {
          d = await el.post(`${this.baseUrl}/chat/completions`, u, {
            timeout: o.timeout || this.timeout,
            headers: this._getHeaders(),
            responseType: "stream",
            signal: o.signal,
          });
        } catch (f) {
          if (
            f.name === "CanceledError" ||
            f.name === "AbortError" ||
            f.code === "ERR_CANCELED"
          )
            throw f;
          let m = f.response?.status ? ` [HTTP ${f.response.status}]` : "",
            h = await Th(f, (p) => p?.error?.message || p?.error);
          throw new Error(`API Error${m}: ${h}`);
        }
        return new Promise((f, m) => {
          let h = "",
            p = {},
            g = "";
          (o.signal &&
            o.signal.addEventListener(
              "abort",
              () => {
                (d.data.destroy(),
                  m(
                    new DOMException("The operation was aborted", "AbortError"),
                  ));
              },
              { once: !0 },
            ),
            d.data.on("data", ($) => {
              g += $.toString();
              let w = g.split(`
`);
              g = w.pop() || "";
              for (let _ of w) {
                let x = _.trim();
                if (!x || !x.startsWith("data: ")) continue;
                let v = x.slice(6);
                if (v === "[DONE]") {
                  f({ content: h, tool_calls: this._buildToolCalls(p) });
                  return;
                }
                let b;
                try {
                  b = JSON.parse(v);
                } catch {
                  continue;
                }
                let k = b.choices?.[0]?.delta;
                if (
                  k &&
                  (k.content && (c(k.content), (h += k.content)), k.tool_calls)
                )
                  for (let A of k.tool_calls) {
                    let O = A.index ?? 0;
                    (p[O] ||
                      (p[O] = { id: A.id || "", name: "", arguments: "" }),
                      A.id && (p[O].id = A.id),
                      A.function?.name && (p[O].name += A.function.name),
                      A.function?.arguments &&
                        (p[O].arguments += A.function.arguments));
                  }
              }
            }),
            d.data.on("error", ($) => {
              o.signal?.aborted || m(new Error(`Stream error: ${$.message}`));
            }),
            d.data.on("end", () => {
              f({ content: h, tool_calls: this._buildToolCalls(p) });
            }));
        });
      }
      normalizeResponse(e) {
        let s = e.choices?.[0]?.message || {},
          o = (s.tool_calls || []).map((n) => ({
            id: n.id,
            function: {
              name: n.function.name,
              arguments: n.function.arguments,
            },
          }));
        return { content: s.content || "", tool_calls: o };
      }
      _buildToolCalls(e) {
        return Object.values(e)
          .filter((s) => s.name)
          .map((s) => ({
            id: s.id || `openai-${Date.now()}`,
            function: { name: s.name, arguments: s.arguments },
          }));
      }
    };
  nl.exports = { OpenAIProvider: oi, OPENAI_MODELS: tl };
});
var al = K((dk, il) => {
  var ol = require("axios"),
    { BaseProvider: Rh, readStreamErrorBody: Ch } = Mn(),
    { serializeMessage: uk } = Je(),
    rl = {
      "claude-sonnet": {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        maxTokens: 64e3,
        contextWindow: 2e5,
      },
      "claude-opus": {
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6",
        maxTokens: 128e3,
        contextWindow: 2e5,
      },
      "claude-haiku": {
        id: "claude-haiku-4-5-20251001",
        name: "Claude Haiku 4.5",
        maxTokens: 64e3,
        contextWindow: 2e5,
      },
      "claude-sonnet-4-5": {
        id: "claude-sonnet-4-5-20250929",
        name: "Claude Sonnet 4.5",
        maxTokens: 64e3,
        contextWindow: 2e5,
      },
      "claude-sonnet-4": {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        maxTokens: 64e3,
        contextWindow: 2e5,
      },
    },
    Ah = "2023-06-01",
    ri = class extends Rh {
      constructor(e = {}) {
        (super({
          name: "anthropic",
          baseUrl: e.baseUrl || "https://api.anthropic.com/v1",
          models: e.models || rl,
          defaultModel: e.defaultModel || "claude-sonnet",
          ...e,
        }),
          (this.timeout = e.timeout || 18e4),
          (this.temperature = e.temperature ?? 0.2),
          (this.apiVersion = e.apiVersion || Ah));
      }
      isConfigured() {
        return !!this.getApiKey();
      }
      getApiKey() {
        return process.env.ANTHROPIC_API_KEY || null;
      }
      _getHeaders() {
        let e = this.getApiKey();
        if (!e) throw new Error("ANTHROPIC_API_KEY not set");
        return {
          "x-api-key": e,
          "anthropic-version": this.apiVersion,
          "Content-Type": "application/json",
        };
      }
      _messageFormatCache = new WeakMap();
      _messageStringCache = new Map();
      _maxCacheSize = 200;
      formatMessages(e) {
        let s = "",
          o = [];
        for (let n of e) {
          if (n.role === "system") {
            s +=
              (s
                ? `

`
                : "") + n.content;
            continue;
          }
          if (
            n.role !== "system" &&
            n.role !== "tool" &&
            this._messageFormatCache.has(n)
          ) {
            o.push(this._messageFormatCache.get(n));
            continue;
          }
          let r = this._formatSingleMessage(n, o);
          if (r) {
            if (
              n.role !== "system" &&
              n.role !== "tool" &&
              this._messageStringCache.size < this._maxCacheSize
            ) {
              let i = this._getMessageCacheKey(n);
              (this._messageStringCache.set(i, r),
                this._messageFormatCache.set(n, r));
            }
            o.push(r);
          }
        }
        for (let n = o.length - 1; n > 0; n--)
          o[n].role === "user" &&
            o[n - 1].role === "user" &&
            o.splice(n, 0, {
              role: "assistant",
              content: [{ type: "text", text: "[continuing]" }],
            });
        return { messages: o, system: s };
      }
      _getMessageCacheKey(e) {
        let s = e.role || "",
          o = typeof e.content == "string" ? e.content.substring(0, 100) : "",
          n = e.tool_calls ? e.tool_calls.length : 0;
        return `${s}:${o.length}:${n}`;
      }
      _formatSingleMessage(e, s = []) {
        if (e.role === "assistant") {
          let o = [];
          if (
            (e.content && o.push({ type: "text", text: e.content }),
            e.tool_calls)
          )
            for (let n of e.tool_calls)
              o.push({
                type: "tool_use",
                id: n.id || `toolu-${Date.now()}`,
                name: n.function.name,
                input:
                  typeof n.function.arguments == "string"
                    ? JSON.parse(n.function.arguments || "{}")
                    : n.function.arguments || {},
              });
          return {
            role: "assistant",
            content: o.length > 0 ? o : [{ type: "text", text: "" }],
          };
        }
        if (e.role === "tool") {
          let o = s[s.length - 1],
            n = {
              type: "tool_result",
              tool_use_id: e.tool_call_id,
              content:
                typeof e.content == "string"
                  ? e.content
                  : JSON.stringify(e.content),
            };
          return o &&
            o.role === "user" &&
            Array.isArray(o.content) &&
            o.content[0]?.type === "tool_result"
            ? (o.content.push(n), null)
            : { role: "user", content: [n] };
        }
        if (Array.isArray(e.content)) {
          let o = [];
          for (let n of e.content)
            n.type === "text"
              ? o.push({ type: "text", text: n.text ?? "" })
              : n.type === "image" &&
                n.data &&
                o.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: n.media_type || "image/png",
                    data: n.data,
                  },
                });
          return { role: "user", content: o };
        }
        return { role: "user", content: e.content };
      }
      formatTools(e) {
        return !e || e.length === 0
          ? []
          : e.map((s) => ({
              name: s.function.name,
              description: s.function.description || "",
              input_schema: s.function.parameters || {
                type: "object",
                properties: {},
              },
            }));
      }
      _resolveModelId(e) {
        return this.getModel(e)?.id || e;
      }
      async chat(e, s, o = {}) {
        let n = o.model || this.defaultModel,
          r = this._resolveModelId(n),
          i = this.getModel(n),
          c = o.maxTokens || i?.maxTokens || 8192,
          { messages: l, system: u } = this.formatMessages(e),
          d = {
            model: r,
            messages: l,
            max_tokens: c,
            temperature: o.temperature ?? this.temperature,
          };
        u && (d.system = u);
        let f = this.formatTools(s);
        f.length > 0 && (d.tools = f);
        let m;
        try {
          m = await ol.post(`${this.baseUrl}/messages`, d, {
            timeout: o.timeout || this.timeout,
            headers: this._getHeaders(),
          });
        } catch (h) {
          if (
            h.name === "CanceledError" ||
            h.name === "AbortError" ||
            h.code === "ERR_CANCELED"
          )
            throw h;
          let p = h.response?.status ? ` [HTTP ${h.response.status}]` : "",
            g =
              h.response?.data?.error?.message ||
              h.response?.data?.error ||
              h.message;
          throw new Error(`API Error${p}: ${g}`);
        }
        return this.normalizeResponse(m.data);
      }
      async stream(e, s, o = {}) {
        let n = o.model || this.defaultModel,
          r = this._resolveModelId(n),
          i = this.getModel(n),
          c = o.maxTokens || i?.maxTokens || 8192,
          l = o.onToken || (() => {}),
          { messages: u, system: d } = this.formatMessages(e),
          f = {
            model: r,
            messages: u,
            max_tokens: c,
            temperature: o.temperature ?? this.temperature,
            stream: !0,
          };
        d && (f.system = d);
        let m = this.formatTools(s);
        m.length > 0 && (f.tools = m);
        let h;
        try {
          h = await ol.post(`${this.baseUrl}/messages`, f, {
            timeout: o.timeout || this.timeout,
            headers: this._getHeaders(),
            responseType: "stream",
            signal: o.signal,
          });
        } catch (p) {
          if (
            p.name === "CanceledError" ||
            p.name === "AbortError" ||
            p.code === "ERR_CANCELED"
          )
            throw p;
          let g = p.response?.status ? ` [HTTP ${p.response.status}]` : "",
            $ = await Ch(p, (w) => w?.error?.message || w?.error);
          throw new Error(`API Error${g}: ${$}`);
        }
        return new Promise((p, g) => {
          let $ = "",
            w = [],
            _ = -1,
            x = "";
          (o.signal &&
            o.signal.addEventListener(
              "abort",
              () => {
                (h.data.destroy(),
                  g(
                    new DOMException("The operation was aborted", "AbortError"),
                  ));
              },
              { once: !0 },
            ),
            h.data.on("data", (v) => {
              x += v.toString();
              let b = x.split(`
`);
              x = b.pop() || "";
              for (let k of b) {
                let A = k.trim();
                if (A.startsWith("data: ")) {
                  let O = A.slice(6),
                    P;
                  try {
                    P = JSON.parse(O);
                  } catch {
                    continue;
                  }
                  switch (P.type) {
                    case "content_block_start": {
                      let W = P.content_block;
                      W?.type === "tool_use" &&
                        ((_ = w.length),
                        w.push({ id: W.id, name: W.name, inputJson: "" }));
                      break;
                    }
                    case "content_block_delta": {
                      let W = P.delta;
                      (W?.type === "text_delta" &&
                        W.text &&
                        (l(W.text), ($ += W.text)),
                        W?.type === "input_json_delta" &&
                          W.partial_json !== void 0 &&
                          _ >= 0 &&
                          (w[_].inputJson += W.partial_json));
                      break;
                    }
                    case "content_block_stop":
                      _ = -1;
                      break;
                    case "message_stop":
                      p({ content: $, tool_calls: this._buildToolCalls(w) });
                      return;
                  }
                }
              }
            }),
            h.data.on("error", (v) => {
              o.signal?.aborted || g(new Error(`Stream error: ${v.message}`));
            }),
            h.data.on("end", () => {
              p({ content: $, tool_calls: this._buildToolCalls(w) });
            }));
        });
      }
      normalizeResponse(e) {
        let s = "",
          o = [];
        for (let n of e.content || [])
          n.type === "text"
            ? (s += n.text)
            : n.type === "tool_use" &&
              o.push({
                id: n.id,
                function: { name: n.name, arguments: n.input },
              });
        return { content: s, tool_calls: o };
      }
      _buildToolCalls(e) {
        return e
          .filter((s) => s.name)
          .map((s) => {
            let o = {};
            if (s.inputJson)
              try {
                o = JSON.parse(s.inputJson);
              } catch {
                o = s.inputJson;
              }
            return {
              id: s.id || `anthropic-${Date.now()}`,
              function: { name: s.name, arguments: o },
            };
          });
      }
    };
  il.exports = { AnthropicProvider: ri, ANTHROPIC_MODELS: rl };
});
var dl = K((pk, ul) => {
  var cl = require("axios"),
    { BaseProvider: Oh, readStreamErrorBody: Nh } = Mn(),
    { serializeMessage: fk } = Je(),
    ll = {
      "gemini-3.1-pro-preview": {
        id: "gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro Preview",
        maxTokens: 65536,
        contextWindow: 1048576,
      },
      "gemini-3-flash-preview": {
        id: "gemini-3-flash-preview",
        name: "Gemini 3 Flash Preview",
        maxTokens: 65536,
        contextWindow: 1048576,
      },
      "gemini-2.5-pro": {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        maxTokens: 65536,
        contextWindow: 1048576,
      },
      "gemini-2.5-flash": {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        maxTokens: 65536,
        contextWindow: 1048576,
      },
      "gemini-2.5-flash-lite": {
        id: "gemini-2.5-flash-lite",
        name: "Gemini 2.5 Flash Lite",
        maxTokens: 65536,
        contextWindow: 1048576,
      },
      "gemini-2.0-flash": {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        maxTokens: 8192,
        contextWindow: 1048576,
      },
      "gemini-2.0-flash-lite": {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
        maxTokens: 8192,
        contextWindow: 1048576,
      },
      "gemini-1.5-pro": {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        maxTokens: 8192,
        contextWindow: 1048576,
      },
      "gemini-1.5-flash": {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        maxTokens: 8192,
        contextWindow: 1048576,
      },
    },
    ii = class extends Oh {
      constructor(e = {}) {
        (super({
          name: "gemini",
          baseUrl:
            e.baseUrl ||
            "https://generativelanguage.googleapis.com/v1beta/openai",
          models: e.models || ll,
          defaultModel: e.defaultModel || "gemini-2.5-flash",
          ...e,
        }),
          (this.timeout = e.timeout || 18e4),
          (this.temperature = e.temperature ?? 0.2));
      }
      isConfigured() {
        return !!this.getApiKey();
      }
      getApiKey() {
        return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
      }
      _getHeaders() {
        let e = this.getApiKey();
        if (!e) throw new Error("GEMINI_API_KEY not set");
        return {
          Authorization: `Bearer ${e}`,
          "Content-Type": "application/json",
        };
      }
      _messageFormatCache = new WeakMap();
      _messageStringCache = new Map();
      _maxCacheSize = 200;
      formatMessages(e) {
        let s = [];
        for (let o of e) {
          if (this._messageFormatCache.has(o)) {
            s.push(this._messageFormatCache.get(o));
            continue;
          }
          let n = this._getMessageCacheKey(o);
          if (this._messageStringCache.has(n)) {
            let i = this._messageStringCache.get(n);
            (this._messageFormatCache.set(o, i), s.push(i));
            continue;
          }
          let r = this._formatSingleMessage(o);
          (this._messageStringCache.size < this._maxCacheSize &&
            this._messageStringCache.set(n, r),
            this._messageFormatCache.set(o, r),
            s.push(r));
        }
        return { messages: s };
      }
      _getMessageCacheKey(e) {
        let s = e.role || "",
          o = typeof e.content == "string" ? e.content.substring(0, 100) : "",
          n = e.tool_calls ? e.tool_calls.length : 0;
        return `${s}:${o.length}:${n}`;
      }
      _formatSingleMessage(e) {
        if (e.role === "assistant" && e.tool_calls)
          return {
            role: "assistant",
            content: e.content || "",
            tool_calls: e.tool_calls.map((s) => ({
              id: s.id || `call-${Date.now()}`,
              type: "function",
              function: {
                name: s.function.name,
                arguments:
                  typeof s.function.arguments == "string"
                    ? s.function.arguments
                    : JSON.stringify(s.function.arguments),
              },
            })),
          };
        if (e.role === "tool")
          return {
            role: "tool",
            content:
              typeof e.content == "string"
                ? e.content
                : JSON.stringify(e.content),
            tool_call_id: e.tool_call_id,
          };
        if (e.role === "user" && Array.isArray(e.content)) {
          let s = [];
          for (let o of e.content)
            if (o.type === "text") s.push({ type: "text", text: o.text ?? "" });
            else if (o.type === "image" && o.data) {
              let n = o.data.startsWith("data:")
                ? o.data
                : `data:${o.media_type || "image/png"};base64,${o.data}`;
              s.push({
                type: "image_url",
                image_url: { url: n, detail: "auto" },
              });
            }
          return { role: "user", content: s };
        }
        return { role: e.role, content: e.content };
      }
      async chat(e, s, o = {}) {
        let n = o.model || this.defaultModel,
          r = this.getModel(n),
          i = o.maxTokens || r?.maxTokens || 8192,
          { messages: c } = this.formatMessages(e),
          l = {
            model: n,
            messages: c,
            max_tokens: i,
            temperature: o.temperature ?? this.temperature,
          };
        s && s.length > 0 && (l.tools = s);
        let u;
        try {
          u = await cl.post(`${this.baseUrl}/chat/completions`, l, {
            timeout: o.timeout || this.timeout,
            headers: this._getHeaders(),
          });
        } catch (d) {
          if (
            d.name === "CanceledError" ||
            d.name === "AbortError" ||
            d.code === "ERR_CANCELED"
          )
            throw d;
          let f = d.response?.status ? ` [HTTP ${d.response.status}]` : "",
            m =
              d.response?.data?.error?.message ||
              d.response?.data?.error ||
              d.message;
          throw new Error(`API Error${f}: ${m}`);
        }
        return this.normalizeResponse(u.data);
      }
      async stream(e, s, o = {}) {
        let n = o.model || this.defaultModel,
          r = this.getModel(n),
          i = o.maxTokens || r?.maxTokens || 8192,
          c = o.onToken || (() => {}),
          { messages: l } = this.formatMessages(e),
          u = {
            model: n,
            messages: l,
            max_tokens: i,
            temperature: o.temperature ?? this.temperature,
            stream: !0,
          };
        s && s.length > 0 && (u.tools = s);
        let d;
        try {
          d = await cl.post(`${this.baseUrl}/chat/completions`, u, {
            timeout: o.timeout || this.timeout,
            headers: this._getHeaders(),
            responseType: "stream",
            signal: o.signal,
          });
        } catch (f) {
          if (
            f.name === "CanceledError" ||
            f.name === "AbortError" ||
            f.code === "ERR_CANCELED"
          )
            throw f;
          let m = f.response?.status ? ` [HTTP ${f.response.status}]` : "",
            h = await Nh(f, (p) => p?.error?.message || p?.error);
          throw new Error(`API Error${m}: ${h}`);
        }
        return new Promise((f, m) => {
          let h = "",
            p = {},
            g = "";
          (o.signal &&
            o.signal.addEventListener(
              "abort",
              () => {
                (d.data.destroy(),
                  m(
                    new DOMException("The operation was aborted", "AbortError"),
                  ));
              },
              { once: !0 },
            ),
            d.data.on("data", ($) => {
              g += $.toString();
              let w = g.split(`
`);
              g = w.pop() || "";
              for (let _ of w) {
                let x = _.trim();
                if (!x || !x.startsWith("data: ")) continue;
                let v = x.slice(6);
                if (v === "[DONE]") {
                  f({ content: h, tool_calls: this._buildToolCalls(p) });
                  return;
                }
                let b;
                try {
                  b = JSON.parse(v);
                } catch {
                  continue;
                }
                let k = b.choices?.[0]?.delta;
                if (
                  k &&
                  (k.content && (c(k.content), (h += k.content)), k.tool_calls)
                )
                  for (let A of k.tool_calls) {
                    let O = A.index ?? 0;
                    (p[O] ||
                      (p[O] = { id: A.id || "", name: "", arguments: "" }),
                      A.id && (p[O].id = A.id),
                      A.function?.name && (p[O].name += A.function.name),
                      A.function?.arguments &&
                        (p[O].arguments += A.function.arguments));
                  }
              }
            }),
            d.data.on("error", ($) => {
              o.signal?.aborted || m(new Error(`Stream error: ${$.message}`));
            }),
            d.data.on("end", () => {
              f({ content: h, tool_calls: this._buildToolCalls(p) });
            }));
        });
      }
      normalizeResponse(e) {
        let s = e.choices?.[0]?.message || {},
          o = (s.tool_calls || []).map((n) => ({
            id: n.id,
            function: {
              name: n.function.name,
              arguments: n.function.arguments,
            },
          }));
        return { content: s.content || "", tool_calls: o };
      }
      _buildToolCalls(e) {
        return Object.values(e)
          .filter((s) => s.name)
          .map((s) => ({
            id:
              s.id ||
              `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            function: { name: s.name, arguments: s.arguments },
          }));
      }
    };
  ul.exports = { GeminiProvider: ii, GEMINI_MODELS: ll };
});
var ml = K((mk, pl) => {
  var yo = require("axios"),
    { BaseProvider: Mh, readStreamErrorBody: Ph } = Mn(),
    fl = "http://localhost:11434",
    ai = class extends Mh {
      constructor(e = {}) {
        (super({
          name: "local",
          baseUrl:
            e.baseUrl ||
            process.env.OLLAMA_HOST ||
            process.env.OLLAMA_LOCAL_URL ||
            fl,
          models: e.models || {},
          defaultModel: e.defaultModel || null,
          ...e,
        }),
          (this.timeout = e.timeout || 3e5),
          (this.temperature = e.temperature ?? 0.2),
          (this._modelsLoaded = !1));
      }
      isConfigured() {
        return !0;
      }
      async loadModels() {
        if (this._modelsLoaded) return this.models;
        try {
          let s =
            (await yo.get(`${this.baseUrl}/api/tags`, { timeout: 5e3 })).data
              ?.models || [];
          this.models = {};
          for (let o of s) {
            let n = o.name || o.model;
            if (!n) continue;
            let r = n.replace(/:latest$/, ""),
              i = 32768;
            try {
              let c = await yo.post(
                  `${this.baseUrl}/api/show`,
                  { name: n },
                  { timeout: 5e3 },
                ),
                l = c.data?.model_info || c.data?.details || {};
              i =
                l["general.context_length"] ||
                l["llama.context_length"] ||
                this._parseContextFromModelfile(c.data?.modelfile) ||
                32768;
            } catch {}
            this.models[r] = {
              id: r,
              name: o.name,
              maxTokens: Math.min(8192, Math.floor(i * 0.1)),
              contextWindow: i,
            };
          }
          (!this.defaultModel &&
            Object.keys(this.models).length > 0 &&
            (this.defaultModel = Object.keys(this.models)[0]),
            (this._modelsLoaded = !0));
        } catch {
          ((this.models = {}), (this._modelsLoaded = !1));
        }
        return this.models;
      }
      getModels() {
        return this.models;
      }
      getModelNames() {
        return Object.keys(this.models);
      }
      _formatMessages(e) {
        return e.map((s) => {
          if (s.role === "user" && Array.isArray(s.content)) {
            let o = [],
              n = [];
            for (let i of s.content)
              i.type === "text"
                ? o.push(i.text ?? "")
                : i.type === "image" && i.data && n.push(i.data);
            let r = {
              role: "user",
              content: o.join(`
`),
            };
            return (n.length > 0 && (r.images = n), r);
          }
          return s;
        });
      }
      async chat(e, s, o = {}) {
        this._modelsLoaded || (await this.loadModels());
        let n = o.model || this.defaultModel;
        if (!n) throw new Error("No local model available. Is Ollama running?");
        let r;
        try {
          r = await yo.post(
            `${this.baseUrl}/api/chat`,
            {
              model: n,
              messages: this._formatMessages(e),
              tools: s && s.length > 0 ? s : void 0,
              stream: !1,
              options: {
                temperature: o.temperature ?? this.temperature,
                num_predict: o.maxTokens || 8192,
              },
            },
            { timeout: o.timeout || this.timeout },
          );
        } catch (i) {
          if (
            i.name === "CanceledError" ||
            i.name === "AbortError" ||
            i.code === "ERR_CANCELED"
          )
            throw i;
          let c = i.response?.status ? ` [HTTP ${i.response.status}]` : "",
            l = i.response?.data?.error || i.message;
          throw new Error(`API Error${c}: ${l}`);
        }
        return this.normalizeResponse(r.data);
      }
      async stream(e, s, o = {}) {
        this._modelsLoaded || (await this.loadModels());
        let n = o.model || this.defaultModel;
        if (!n) throw new Error("No local model available. Is Ollama running?");
        let r = o.onToken || (() => {}),
          i;
        try {
          i = await yo.post(
            `${this.baseUrl}/api/chat`,
            {
              model: n,
              messages: this._formatMessages(e),
              tools: s && s.length > 0 ? s : void 0,
              stream: !0,
              options: {
                temperature: o.temperature ?? this.temperature,
                num_predict: o.maxTokens || 8192,
              },
            },
            {
              timeout: o.timeout || this.timeout,
              responseType: "stream",
              signal: o.signal,
            },
          );
        } catch (c) {
          if (
            c.name === "CanceledError" ||
            c.name === "AbortError" ||
            c.code === "ERR_CANCELED"
          )
            throw c;
          let l = c.response?.status ? ` [HTTP ${c.response.status}]` : "",
            u = await Ph(c, (d) => d?.error);
          throw new Error(`API Error${l}: ${u}`);
        }
        return new Promise((c, l) => {
          let u = "",
            d = [],
            f = "";
          (o.signal &&
            o.signal.addEventListener(
              "abort",
              () => {
                (i.data.destroy(),
                  l(
                    new DOMException("The operation was aborted", "AbortError"),
                  ));
              },
              { once: !0 },
            ),
            i.data.on("data", (m) => {
              f += m.toString();
              let h = f.split(`
`);
              f = h.pop() || "";
              for (let p of h) {
                if (!p.trim()) continue;
                let g;
                try {
                  g = JSON.parse(p);
                } catch {
                  continue;
                }
                if (
                  (g.message?.content &&
                    (r(g.message.content), (u += g.message.content)),
                  g.message?.tool_calls && (d = d.concat(g.message.tool_calls)),
                  g.done)
                ) {
                  c({ content: u, tool_calls: this._normalizeToolCalls(d) });
                  return;
                }
              }
            }),
            i.data.on("error", (m) => {
              o.signal?.aborted || l(new Error(`Stream error: ${m.message}`));
            }),
            i.data.on("end", () => {
              if (f.trim())
                try {
                  let m = JSON.parse(f);
                  (m.message?.content &&
                    (r(m.message.content), (u += m.message.content)),
                    m.message?.tool_calls &&
                      (d = d.concat(m.message.tool_calls)));
                } catch {}
              c({ content: u, tool_calls: this._normalizeToolCalls(d) });
            }));
        });
      }
      normalizeResponse(e) {
        let s = e.message || {};
        return {
          content: s.content || "",
          tool_calls: this._normalizeToolCalls(s.tool_calls || []),
        };
      }
      _parseContextFromModelfile(e) {
        if (!e) return null;
        let s = e.match(/PARAMETER\s+num_ctx\s+(\d+)/i);
        return s ? parseInt(s[1], 10) : null;
      }
      _normalizeToolCalls(e) {
        return e.map((s, o) => ({
          id: s.id || `local-${Date.now()}-${o}`,
          function: {
            name: s.function?.name || s.name || "unknown",
            arguments: s.function?.arguments || s.arguments || {},
          },
        }));
      }
    };
  pl.exports = { LocalProvider: ai, DEFAULT_LOCAL_URL: fl };
});
var Qt = K((hk, gl) => {
  "use strict";
  var ft = require("fs"),
    hl = require("path");
  function Ih(t) {
    if (!t || isNaN(t)) return !1;
    try {
      return (process.kill(t, 0), !0);
    } catch (e) {
      return e.code === "EPERM";
    }
  }
  function Lh(t) {
    try {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, t);
    } catch {
      let e = Date.now() + t;
      for (; Date.now() < e; );
    }
  }
  function jh(t, e) {
    let s = hl.dirname(t),
      o = hl.join(s, `.nex-tmp.${process.pid}.${Date.now()}`);
    try {
      (ft.existsSync(s) || ft.mkdirSync(s, { recursive: !0 }),
        ft.writeFileSync(o, e, "utf-8"),
        ft.renameSync(o, t));
    } catch (n) {
      try {
        ft.unlinkSync(o);
      } catch {}
      throw n;
    }
  }
  function Dh(t, e, { timeout: s = 5e3, retryMs: o = 50 } = {}) {
    let n = t + ".lock",
      r = Date.now() + s;
    for (;;) {
      let i = -1;
      try {
        ((i = ft.openSync(n, "wx")),
          ft.writeSync(i, Buffer.from(String(process.pid))),
          ft.closeSync(i),
          (i = -1));
        try {
          return e();
        } finally {
          try {
            ft.unlinkSync(n);
          } catch {}
        }
      } catch (c) {
        if (i !== -1)
          try {
            ft.closeSync(i);
          } catch {}
        if (c.code !== "EEXIST") throw c;
        try {
          let l = ft.readFileSync(n, "utf-8").trim(),
            u = parseInt(l, 10);
          if (!Ih(u)) {
            try {
              ft.unlinkSync(n);
            } catch {}
            continue;
          }
        } catch (l) {
          if (l.code && l.code !== "ENOENT") throw l;
          continue;
        }
        if (Date.now() >= r) {
          try {
            ft.unlinkSync(n);
          } catch {}
          return e();
        }
        Lh(o);
      }
    }
  }
  gl.exports = { atomicWrite: jh, withFileLockSync: Dh };
});
var jn = K((gk, kl) => {
  var Ln = require("fs"),
    ci = require("path"),
    { atomicWrite: qh, withFileLockSync: Fh } = Qt(),
    $l = {
      openai: {
        "gpt-4o": { input: 2.5, output: 10 },
        "gpt-4o-mini": { input: 0.15, output: 0.6 },
        "gpt-4.1": { input: 2, output: 8 },
        "gpt-4.1-mini": { input: 0.4, output: 1.6 },
        "gpt-4.1-nano": { input: 0.1, output: 0.4 },
        o1: { input: 15, output: 60 },
        o3: { input: 10, output: 40 },
        "o3-mini": { input: 1.1, output: 4.4 },
        "o4-mini": { input: 1.1, output: 4.4 },
      },
      anthropic: {
        "claude-sonnet": { input: 3, output: 15 },
        "claude-opus": { input: 5, output: 25 },
        "claude-haiku": { input: 0.8, output: 4 },
        "claude-sonnet-4-5": { input: 3, output: 15 },
        "claude-sonnet-4": { input: 3, output: 15 },
      },
      gemini: {
        "gemini-2.5-pro": { input: 1.25, output: 10 },
        "gemini-2.5-flash": { input: 0.15, output: 0.6 },
        "gemini-2.0-flash": { input: 0.1, output: 0.4 },
        "gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
      },
      ollama: {
        "qwen3-coder:480b": { input: 0, output: 0 },
        "qwen3-coder-next": { input: 0, output: 0 },
        "devstral-2:123b": { input: 0, output: 0 },
        "devstral-small-2:24b": { input: 0, output: 0 },
        "kimi-k2.5": { input: 0, output: 0 },
        "kimi-k2:1t": { input: 0, output: 0 },
        "deepseek-v3.2": { input: 0, output: 0 },
        "minimax-m2.5": { input: 0, output: 0 },
        "glm-5": { input: 0, output: 0 },
        "glm-4.7": { input: 0, output: 0 },
        "gpt-oss:120b": { input: 0, output: 0 },
      },
      local: {},
    },
    wo = [],
    Zt = {};
  function Uh(t, e, s, o) {
    if (
      (wo.push({ provider: t, model: e, input: s, output: o }),
      Zt[t] !== void 0)
    ) {
      let n = _l(t);
      n.allowed ||
        process.stderr
          .write(`\x1B[33m\u26A0 Budget limit reached for ${t}: $${n.spent.toFixed(2)} / $${n.limit.toFixed(2)}\x1B[0m
`);
    }
  }
  function li(t, e) {
    let s = $l[t];
    return s ? s[e] || { input: 0, output: 0 } : { input: 0, output: 0 };
  }
  function yl(t) {
    let e = li(t.provider, t.model);
    return (t.input * e.input + t.output * e.output) / 1e6;
  }
  function wl() {
    let t = {};
    for (let r of wo) {
      let i = `${r.provider}:${r.model}`;
      (t[i] ||
        (t[i] = { provider: r.provider, model: r.model, input: 0, output: 0 }),
        (t[i].input += r.input),
        (t[i].output += r.output));
    }
    let e = Object.values(t).map((r) => ({ ...r, cost: yl(r) })),
      s = e.reduce((r, i) => r + i.cost, 0),
      o = e.reduce((r, i) => r + i.input, 0),
      n = e.reduce((r, i) => r + i.output, 0);
    return { totalCost: s, totalInput: o, totalOutput: n, breakdown: e };
  }
  function Wh() {
    let { totalCost: t, totalInput: e, totalOutput: s, breakdown: o } = wl();
    if (o.length === 0) return "No token usage recorded this session.";
    let n = [];
    (n.push("Session Token Usage:"), n.push(""));
    for (let r of o) {
      let i = r.cost > 0 ? `$${r.cost.toFixed(4)}` : "free";
      (n.push(`  ${r.provider}:${r.model}`),
        n.push(`    Input:  ${r.input.toLocaleString()} tokens`),
        n.push(`    Output: ${r.output.toLocaleString()} tokens`),
        n.push(`    Cost:   ${i}`));
    }
    return (
      n.push(""),
      n.push(
        `  Total: ${e.toLocaleString()} in + ${s.toLocaleString()} out = $${t.toFixed(4)}`,
      ),
      n.join(`
`)
    );
  }
  function Bh(t, e, s, o) {
    let n = li(t, e),
      r = (s * n.input + o * n.output) / 1e6;
    return r <= 0 ? "" : `[~$${r.toFixed(4)}]`;
  }
  function Hh() {
    wo = [];
  }
  function Gh(t, e) {
    Zt[t] = e;
  }
  function Kh(t) {
    delete Zt[t];
  }
  function Yh() {
    return { ...Zt };
  }
  function bl(t) {
    let e = 0;
    for (let s of wo) s.provider === t && (e += yl(s));
    return e;
  }
  function _l(t) {
    let e = bl(t),
      s = Zt[t];
    if (s === void 0)
      return { allowed: !0, spent: e, limit: null, remaining: null };
    let o = Math.max(0, s - e);
    return { allowed: e < s, spent: e, limit: s, remaining: o };
  }
  function xl() {
    let t = ci.join(process.cwd(), ".nex", "config.json");
    if (Ln.existsSync(t))
      try {
        let e = JSON.parse(Ln.readFileSync(t, "utf-8"));
        e.costLimits &&
          typeof e.costLimits == "object" &&
          (Zt = { ...e.costLimits });
      } catch {}
  }
  function zh() {
    let t = ci.join(process.cwd(), ".nex"),
      e = ci.join(t, "config.json");
    (Ln.existsSync(t) || Ln.mkdirSync(t, { recursive: !0 }),
      Fh(e, () => {
        let s = {};
        if (Ln.existsSync(e))
          try {
            s = JSON.parse(Ln.readFileSync(e, "utf-8"));
          } catch {
            s = {};
          }
        ((s.costLimits = Zt), qh(e, JSON.stringify(s, null, 2)));
      }));
  }
  function Xh() {
    Zt = {};
  }
  xl();
  kl.exports = {
    PRICING: $l,
    trackUsage: Uh,
    getSessionCosts: wl,
    formatCosts: Wh,
    formatCostHint: Bh,
    resetCosts: Hh,
    getPricing: li,
    setCostLimit: Gh,
    removeCostLimit: Kh,
    getCostLimits: Yh,
    getProviderSpend: bl,
    checkBudget: _l,
    loadCostLimits: xl,
    saveCostLimits: zh,
    resetCostLimits: Xh,
  };
});
var El = K(($k, Sl) => {
  "use strict";
  var Jh = new Set([
      "read_file",
      "grep",
      "glob",
      "search_files",
      "list_directory",
    ]),
    Vh = new Set(["write_file", "edit_file", "patch_file"]),
    Qh = new Set(["bash"]),
    Zh = new Set(["web_search", "web_fetch", "perplexity_search"]);
  function vl(t, e) {
    let s = 0,
      o = 0,
      n = 0,
      r = 0,
      i = 0;
    for (let [c, l] of t)
      ((i += l),
        Jh.has(c) && (s += l),
        Vh.has(c) && (o += l),
        Qh.has(c) && (n += l),
        Zh.has(c) && (r += l));
    return i === 0
      ? `Phase ${e}`
      : r / i > 0.5
        ? "Research"
        : s / i > 0.5
          ? "Exploration"
          : o / i > 0.3
            ? "Implementation"
            : n / i > 0.3 && o / i < 0.15
              ? "Verification"
              : `Phase ${e}`;
  }
  var ui = class {
    constructor(e) {
      ((this._N = e),
        (this._disabled = e <= 0),
        (this._phaseNum = 0),
        (this._stepsThisPhase = 0),
        (this._phaseCounts = new Map()),
        (this._phaseStart = Date.now()));
    }
    record(e, s, o, n) {
      if (this._disabled) return null;
      this._stepsThisPhase++;
      for (let i of s)
        this._phaseCounts.set(i, (this._phaseCounts.get(i) || 0) + 1);
      if (this._stepsThisPhase < this._N) return null;
      this._phaseNum++;
      let r = {
        phaseNum: this._phaseNum,
        phaseName: vl(this._phaseCounts, this._phaseNum),
        stepCount: this._stepsThisPhase,
        toolCounts: new Map(this._phaseCounts),
        elapsed: Date.now() - this._phaseStart,
        filesRead: new Set(o),
        filesModified: new Set(n),
      };
      return (
        (this._stepsThisPhase = 0),
        (this._phaseCounts = new Map()),
        (this._phaseStart = Date.now()),
        r
      );
    }
  };
  Sl.exports = { MilestoneTracker: ui, _phaseName: vl };
});
var Dn = K((yk, Tl) => {
  var cs = Ae(),
    eg = {
      "kimi-k2.5": { id: "kimi-k2.5", name: "Kimi K2.5", max_tokens: 16384 },
      "qwen3-coder:480b": {
        id: "qwen3-coder:480b",
        name: "Qwen3 Coder 480B",
        max_tokens: 16384,
      },
    };
  function tg() {
    return cs.getActiveModel();
  }
  function ng(t) {
    return cs.setActiveModel(t);
  }
  function sg() {
    return cs.getModelNames();
  }
  function og(t) {
    if (!t) return null;
    if (typeof t == "object") return t;
    try {
      return JSON.parse(t);
    } catch {}
    try {
      let o = t.replace(/,\s*([}\]])/g, "$1").replace(/'/g, '"');
      return JSON.parse(o);
    } catch {}
    let e = t.match(/\{[\s\S]*\}/);
    if (e)
      try {
        return JSON.parse(e[0]);
      } catch {}
    try {
      let o = t.replace(/(\{|,)\s*([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
      return JSON.parse(o);
    } catch {}
    let s = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (s)
      try {
        return JSON.parse(s[1].trim());
      } catch {}
    return null;
  }
  async function rg(t, e) {
    let { C: s } = Ce(),
      { Spinner: o } = Ce(),
      n = new o("Thinking...");
    n.start();
    let r = !0,
      i = "";
    try {
      let c = await cs.callStream(t, e, {
        onToken: (l) => {
          (r && (n.stop(), process.stdout.write(`${s.blue}`), (r = !1)),
            process.stdout.write(l),
            (i += l));
        },
      });
      return (
        r
          ? n.stop()
          : process.stdout.write(`${s.reset}
`),
        c
      );
    } catch (c) {
      throw (n.stop(), c);
    }
  }
  async function ig(t, e) {
    return cs.callChat(t, e);
  }
  Tl.exports = {
    MODELS: eg,
    getActiveModel: tg,
    setActiveModel: ng,
    getModelNames: sg,
    callOllamaStream: rg,
    callOllama: ig,
    parseToolArgs: og,
  };
});
var Al = K((bk, Cl) => {
  var bo = require("path"),
    { C: N } = Ce(),
    { T: di, isDark: wk } = dn(),
    { confirm: ag, getAutoConfirm: cg } = Ye(),
    Rl = 2e3;
  function ls(t, e) {
    let s = t.split(`
`),
      o = e.split(`
`),
      n = [],
      r = s.length,
      i = o.length;
    if (r > Rl || i > Rl) {
      for (let f of s) n.push({ type: "remove", line: f });
      for (let f of o) n.push({ type: "add", line: f });
      return n;
    }
    let c = Array.from({ length: r + 1 }, () => new Array(i + 1).fill(0));
    for (let f = 1; f <= r; f++)
      for (let m = 1; m <= i; m++)
        s[f - 1] === o[m - 1]
          ? (c[f][m] = c[f - 1][m - 1] + 1)
          : (c[f][m] = Math.max(c[f - 1][m], c[f][m - 1]));
    let l = r,
      u = i,
      d = [];
    for (; l > 0 || u > 0; )
      l > 0 && u > 0 && s[l - 1] === o[u - 1]
        ? (d.unshift({ type: "same", line: s[l - 1] }), l--, u--)
        : u > 0 && (l === 0 || c[l][u - 1] >= c[l - 1][u])
          ? (d.unshift({ type: "add", line: o[u - 1] }), u--)
          : (d.unshift({ type: "remove", line: s[l - 1] }), l--);
    return d;
  }
  function lg(t, e, s, o = 3) {
    console.log(`
${N.bold}${N.cyan}  Diff: ${t}${N.reset}`);
    let n = ls(e, s),
      r = [];
    if (
      (n.forEach((l, u) => {
        l.type !== "same" && r.push(u);
      }),
      r.length === 0)
    ) {
      console.log(`${N.gray}    (no changes)${N.reset}`);
      return;
    }
    let i = Math.max(0, r[0] - o),
      c = Math.min(n.length, r[r.length - 1] + o + 1);
    i > 0 && console.log(`${N.gray}    ...${N.reset}`);
    for (let l = i; l < c; l++) {
      let u = n[l];
      switch (u.type) {
        case "remove":
          console.log(`${N.red}  - ${u.line}${N.reset}`);
          break;
        case "add":
          console.log(`${N.green}  + ${u.line}${N.reset}`);
          break;
        default:
          console.log(`${N.gray}    ${u.line}${N.reset}`);
      }
    }
    (c < n.length && console.log(`${N.gray}    ...${N.reset}`), console.log());
  }
  function ug(t, e, s) {
    console.log(`
${N.bold}${N.cyan}  File exists \u2014 showing changes: ${t}${N.reset}`);
    let o = ls(e, s),
      n = 0;
    for (let i of o) i.type !== "same" && n++;
    if (n === 0) {
      console.log(`${N.gray}    (identical content)${N.reset}`);
      return;
    }
    let r = 0;
    for (let i of o) {
      if (r >= 30) {
        console.log(`${N.gray}    ...(${n - r} more changes)${N.reset}`);
        break;
      }
      switch (i.type) {
        case "remove":
          (console.log(`${N.red}  - ${i.line}${N.reset}`), r++);
          break;
        case "add":
          (console.log(`${N.green}  + ${i.line}${N.reset}`), r++);
          break;
        default:
          r > 0 && console.log(`${N.gray}    ${i.line}${N.reset}`);
      }
    }
    console.log();
  }
  function dg(t, e) {
    console.log(`
${N.bold}${N.cyan}  New file: ${t}${N.reset}`);
    let s = e.split(`
`),
      o = s.slice(0, 20);
    for (let n of o) console.log(`${N.green}  + ${n}${N.reset}`);
    (s.length > 20 &&
      console.log(`${N.gray}    ...+${s.length - 20} more lines${N.reset}`),
      console.log());
  }
  async function fg(t) {
    return cg() ? !0 : ag(`  ${t}?`);
  }
  function pg(t, e, s, o) {
    let n = o || process.stdout.columns || 80,
      r = Math.floor((n - 3) / 2);
    (console.log(`
${N.bold}${N.cyan}  Side-by-side: ${t}${N.reset}`),
      console.log(
        `  ${N.dim}${"\u2500".repeat(r)}\u252C${"\u2500".repeat(r)}${N.reset}`,
      ));
    let i = ls(e, s),
      c = [],
      l = 0;
    for (; l < i.length; )
      if (i[l].type === "same")
        (c.push({ left: i[l].line, right: i[l].line, type: "same" }), l++);
      else if (i[l].type === "remove") {
        let h = [];
        for (; l < i.length && i[l].type === "remove"; )
          (h.push(i[l].line), l++);
        let p = [];
        for (; l < i.length && i[l].type === "add"; ) (p.push(i[l].line), l++);
        let g = Math.max(h.length, p.length);
        for (let $ = 0; $ < g; $++)
          c.push({
            left: $ < h.length ? h[$] : "",
            right: $ < p.length ? p[$] : "",
            type: "changed",
          });
      } else
        i[l].type === "add" &&
          (c.push({ left: "", right: i[l].line, type: "changed" }), l++);
    let u = c.map((h, p) => (h.type !== "same" ? p : -1)).filter((h) => h >= 0);
    if (u.length === 0) {
      console.log(`  ${N.gray}(no changes)${N.reset}`);
      return;
    }
    let d = Math.max(0, u[0] - 2),
      f = Math.min(c.length, u[u.length - 1] + 3),
      m = (h, p) => {
        let g = h.replace(/\x1b\[[0-9;]*m/g, "");
        return g.length >= p ? h.substring(0, p) : h + " ".repeat(p - g.length);
      };
    d > 0 &&
      console.log(
        `  ${N.dim}${"\xB7".repeat(r)}\u250A${"\xB7".repeat(r)}${N.reset}`,
      );
    for (let h = d; h < f; h++) {
      let p = c[h];
      if (p.type === "same")
        console.log(
          `  ${N.gray}${m(p.left, r)}${N.reset}\u2502${N.gray}${m(p.right, r)}${N.reset}`,
        );
      else {
        let g = p.left ? `${N.red}${m(p.left, r)}${N.reset}` : `${m("", r)}`,
          $ = p.right ? `${N.green}${m(p.right, r)}${N.reset}` : `${m("", r)}`;
        console.log(`  ${g}\u2502${$}`);
      }
    }
    (f < c.length &&
      console.log(
        `  ${N.dim}${"\xB7".repeat(r)}\u250A${"\xB7".repeat(r)}${N.reset}`,
      ),
      console.log(`  ${N.dim}${"\u2500".repeat(r)}\u2534${"\u2500".repeat(r)}${N.reset}
`));
  }
  function mg(t, e, s, o = {}) {
    let n = o.label || "Update",
      r = o.context || 3,
      i = o.annotations || [],
      c = bo.isAbsolute(t) ? bo.relative(process.cwd(), t) : t,
      l = ls(e, s),
      u = 1,
      d = 1;
    for (let k of l)
      k.type === "same"
        ? ((k.oldLine = u++), (k.newLine = d++))
        : k.type === "remove"
          ? ((k.oldLine = u++), (k.newLine = null))
          : ((k.oldLine = null), (k.newLine = d++));
    let f = 0,
      m = 0;
    for (let k of l) k.type === "add" ? f++ : k.type === "remove" && m++;
    if (
      (console.log(`
${N.green}\u25CF${N.reset} ${N.bold}${n}(${c})${N.reset}`),
      f === 0 && m === 0)
    ) {
      console.log(`  ${N.dim}\u2514  (no changes)${N.reset}
`);
      return;
    }
    let h = [];
    if (
      (f > 0 && h.push(`Added ${f} line${f !== 1 ? "s" : ""}`),
      m > 0 && h.push(`removed ${m} line${m !== 1 ? "s" : ""}`),
      i.length > 0)
    ) {
      let k = i.filter((W) => W.severity === "error").length,
        A = i.filter((W) => W.severity === "warn").length,
        O = i.filter((W) => W.severity === "info").length,
        P = [];
      (k > 0 && P.push(`${N.red}${k} error${k !== 1 ? "s" : ""}${N.dim}`),
        A > 0 && P.push(`${N.yellow}${A} warning${A !== 1 ? "s" : ""}${N.dim}`),
        O > 0 && P.push(`${N.cyan}${O} info${O !== 1 ? "s" : ""}${N.dim}`),
        h.push(`found ${P.join(", ")}`));
    }
    console.log(`  ${N.dim}\u2514  ${h.join(", ")}${N.reset}`);
    let g = [];
    l.forEach((k, A) => {
      k.type !== "same" && g.push(A);
    });
    let $ = [],
      w = null,
      _ = null;
    for (let k of g) {
      let A = Math.max(0, k - r),
        O = Math.min(l.length - 1, k + r);
      w === null
        ? ((w = A), (_ = O))
        : (A <= _ + 1 || ($.push([w, _]), (w = A)), (_ = O));
    }
    w !== null && $.push([w, _]);
    let x = "      ",
      v = process.stdout.columns || 120;
    function b(k, A, O) {
      let P = O.replace(/\x1b\[[0-9;]*m/g, ""),
        W = O + " ".repeat(Math.max(0, v - P.length));
      return `${k}${A}${W}${N.reset}`;
    }
    for (let k = 0; k < $.length; k++) {
      k > 0 && console.log(`${x}${N.dim}\xB7\xB7\xB7${N.reset}`);
      let [A, O] = $[k];
      for (let P = A; P <= O; P++) {
        let W = l[P],
          Le = W.newLine != null ? W.newLine : W.oldLine,
          we = String(Le).padStart(4),
          fe = W.type !== "remove" ? i.filter((G) => G.line === W.newLine) : [];
        W.type === "remove"
          ? console.log(b(di.diff_rem_bg, N.red, `${x}${we} - ${W.line}`))
          : W.type === "add"
            ? console.log(b(di.diff_add_bg, N.green, `${x}${we} + ${W.line}`))
            : console.log(`${x}${N.dim}${we}  ${N.reset}${W.line}`);
        for (let G of fe) {
          let z = N.cyan,
            ne = "\u2139";
          (G.severity === "error"
            ? ((z = N.red), (ne = "\u2716"))
            : G.severity === "warn" && ((z = N.yellow), (ne = "\u26A0")),
            console.log(`${x}     ${z}${ne} ${G.message}${N.reset}`));
        }
      }
    }
    console.log();
  }
  function hg(t, e, s = {}) {
    let o = bo.isAbsolute(t) ? bo.relative(process.cwd(), t) : t,
      n = e.split(`
`),
      r = s.annotations || [];
    console.log(`
${N.green}\u25CF${N.reset} ${N.bold}Create(${o})${N.reset}`);
    let i = [`${n.length} line${n.length !== 1 ? "s" : ""}`];
    if (r.length > 0) {
      let f = r.filter((g) => g.severity === "error").length,
        m = r.filter((g) => g.severity === "warn").length,
        h = r.filter((g) => g.severity === "info").length,
        p = [];
      (f > 0 && p.push(`${N.red}${f} error${f !== 1 ? "s" : ""}${N.dim}`),
        m > 0 && p.push(`${N.yellow}${m} warning${m !== 1 ? "s" : ""}${N.dim}`),
        h > 0 && p.push(`${N.cyan}${h} info${h !== 1 ? "s" : ""}${N.dim}`),
        i.push(`found ${p.join(", ")}`));
    }
    console.log(`  ${N.dim}\u2514  ${i.join(", ")}${N.reset}`);
    let l = "      ",
      u = process.stdout.columns || 120,
      d = Math.min(n.length, 20);
    for (let f = 0; f < d; f++) {
      let m = String(f + 1).padStart(4),
        h = f + 1,
        p = r.filter((_) => _.line === h),
        g = `${l}${m} + ${n[f]}`,
        $ = g.replace(/\x1b\[[0-9;]*m/g, ""),
        w = g + " ".repeat(Math.max(0, u - $.length));
      console.log(`${di.diff_add_bg}${N.green}${w}${N.reset}`);
      for (let _ of p) {
        let x = N.cyan,
          v = "\u2139";
        (_.severity === "error"
          ? ((x = N.red), (v = "\u2716"))
          : _.severity === "warn" && ((x = N.yellow), (v = "\u26A0")),
          console.log(`${l}     ${x}${v} ${_.message}${N.reset}`));
      }
    }
    (n.length > 20 &&
      console.log(`${l}${N.dim}   ...+${n.length - 20} more lines${N.reset}`),
      console.log());
  }
  Cl.exports = {
    diffLines: ls,
    showEditDiff: lg,
    showWriteDiff: ug,
    showNewFilePreview: dg,
    confirmFileChange: fg,
    showSideBySideDiff: pg,
    showClaudeDiff: mg,
    showClaudeNewFile: hg,
  };
});
var en = K((_k, Ml) => {
  var Ol = require("util").promisify(require("child_process").exec),
    gg = require("util").promisify(require("child_process").execFile),
    { C: Oe } = Ce();
  async function fi(t) {
    try {
      let { stdout: e } = await Ol(t, { cwd: process.cwd(), timeout: 3e4 });
      return e.trim();
    } catch {
      return null;
    }
  }
  async function _o(...t) {
    try {
      let { stdout: e } = await gg("git", t, {
        cwd: process.cwd(),
        timeout: 3e4,
      });
      return e.trim();
    } catch {
      return null;
    }
  }
  async function $g() {
    return (await fi("git rev-parse --is-inside-work-tree")) === "true";
  }
  async function yg() {
    return await fi("git branch --show-current");
  }
  async function pi() {
    try {
      let { stdout: t } = await Ol("git status --porcelain", {
        cwd: process.cwd(),
        timeout: 3e4,
      });
      return !t || !t.trim()
        ? []
        : t
            .split(
              `
`,
            )
            .filter(Boolean)
            .map((e) => {
              let s = e.substring(0, 2).trim(),
                o = e.substring(3);
              return { status: s, file: o };
            });
    } catch {
      return [];
    }
  }
  async function xo(t = !1) {
    return (await fi(`git diff ${t ? "--cached" : ""}`)) || "";
  }
  async function mi() {
    return (await pi()).map((e) => e.file);
  }
  async function Nl() {
    let t = await mi();
    if (t.length === 0) return null;
    let e = await xo(),
      o = (await xo(!0)) || e,
      n = 0,
      r = 0;
    if (o) {
      let d = o.split(`
`);
      for (let f of d)
        (f.startsWith("+") && !f.startsWith("+++") && n++,
          f.startsWith("-") && !f.startsWith("---") && r++);
    } else n = t.length;
    let i = "chore",
      c = t.join(" ").toLowerCase();
    c.includes("test")
      ? (i = "test")
      : c.includes("readme") || c.includes("doc")
        ? (i = "docs")
        : n > r * 2
          ? (i = "feat")
          : r > n
            ? (i = "refactor")
            : (i = "fix");
    let l = t.slice(0, 3).map((d) => d.split("/").pop());
    return {
      summary: `${i}: update ${l.join(", ")}${t.length > 3 ? ` (+${t.length - 3} more)` : ""}`,
      type: i,
      files: t,
      stats: { additions: n, deletions: r },
    };
  }
  async function wg(t) {
    let s = `feat/${t
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50)}`;
    return (await _o("checkout", "-b", s)) !== null ? s : null;
  }
  async function bg(t) {
    return (
      await _o("add", "-A"),
      (await _o("commit", "-m", t))
        ? await _o("rev-parse", "--short", "HEAD")
        : null
    );
  }
  async function _g() {
    let t = await Nl();
    if (!t) return `${Oe.dim}No changes${Oe.reset}`;
    let e = [];
    (e.push(`
${Oe.bold}${Oe.cyan}Git Diff Summary:${Oe.reset}`),
      e.push(
        `  ${Oe.green}+${t.stats.additions}${Oe.reset} ${Oe.red}-${t.stats.deletions}${Oe.reset} in ${t.files.length} file(s)`,
      ),
      e.push(`
${Oe.bold}${Oe.cyan}Files:${Oe.reset}`));
    for (let s of t.files.slice(0, 20)) e.push(`  ${Oe.dim}${s}${Oe.reset}`);
    return (
      t.files.length > 20 &&
        e.push(`  ${Oe.dim}...+${t.files.length - 20} more${Oe.reset}`),
      e.push(`
${Oe.bold}${Oe.cyan}Suggested message:${Oe.reset}`),
      e.push(`  ${Oe.cyan}${t.summary}${Oe.reset}
`),
      e.join(`
`)
    );
  }
  async function xg() {
    return (await pi()).filter(
      (e) => e.status === "UU" || e.status === "AA" || e.status === "DD",
    );
  }
  async function kg() {
    let t = await mi();
    if (t.length === 0) return "";
    let e = [`CHANGED FILES (${t.length}):`];
    for (let o of t.slice(0, 10)) e.push(`  ${o}`);
    let s = await xo();
    if (s) {
      let o =
        s.length > 5e3
          ? s.substring(0, 5e3) +
            `
...(truncated)`
          : s;
      e.push(`
DIFF:
${o}`);
    }
    return e.join(`
`);
  }
  Ml.exports = {
    isGitRepo: $g,
    getCurrentBranch: yg,
    getStatus: pi,
    getDiff: xo,
    getChangedFiles: mi,
    analyzeDiff: Nl,
    createBranch: wg,
    commit: bg,
    formatDiffSummary: _g,
    getDiffContext: kg,
    getMergeConflicts: xg,
  };
});
var Ft = K((kk, ql) => {
  var He = require("fs").promises,
    xk = require("fs"),
    _t = require("path"),
    vg = require("crypto"),
    { execSync: us } = require("child_process"),
    Sg = 100 * 1024,
    Ll = 50,
    st = [],
    qn = [];
  function Eg(t, e, s, o) {
    for (
      st.push({
        tool: t,
        filePath: e,
        oldContent: s,
        newContent: o,
        timestamp: Date.now(),
      });
      st.length > Ll;
    )
      st.shift();
    ((qn.length = 0), jl(st[st.length - 1]).catch(() => {}));
  }
  async function Tg() {
    if (st.length === 0) return null;
    let t = st.pop();
    if (t.oldContent === null)
      try {
        await He.unlink(t.filePath);
      } catch {}
    else await He.writeFile(t.filePath, t.oldContent, "utf-8");
    return (
      qn.push(t),
      { tool: t.tool, filePath: t.filePath, wasCreated: t.oldContent === null }
    );
  }
  async function Rg() {
    if (qn.length === 0) return null;
    let t = qn.pop();
    return (
      await He.writeFile(t.filePath, t.newContent, "utf-8"),
      st.push(t),
      { tool: t.tool, filePath: t.filePath }
    );
  }
  function Cg(t = 10) {
    return st
      .slice(-t)
      .reverse()
      .map((e) => ({
        tool: e.tool,
        filePath: e.filePath,
        timestamp: e.timestamp,
      }));
  }
  function Ag() {
    return st.length;
  }
  function Og() {
    return qn.length;
  }
  function Ng({ diskToo: t = !0 } = {}) {
    if (((st.length = 0), (qn.length = 0), t)) {
      let e = vo();
      He.readdir(e)
        .then((s) => {
          for (let o of s)
            o.endsWith(".json") && He.unlink(_t.join(e, o)).catch(() => {});
        })
        .catch(() => {});
    }
  }
  function vo() {
    return _t.join(process.cwd(), ".nex", "history");
  }
  async function Pl(t, e) {
    if (t == null) return { inline: !0, content: t };
    if (Buffer.byteLength(t, "utf-8") <= Sg) return { inline: !0, content: t };
    let s = vg.createHash("sha256").update(t, "utf-8").digest("hex"),
      o = _t.join(e, "blobs");
    return (
      await He.mkdir(o, { recursive: !0 }),
      await He.writeFile(_t.join(o, s), t, "utf-8"),
      { inline: !1, hash: s }
    );
  }
  async function jl(t) {
    let e = vo();
    await He.mkdir(e, { recursive: !0 });
    let s = _t.basename(t.filePath).replace(/[^a-zA-Z0-9]/g, "-"),
      o = `${t.timestamp}-${s}.json`,
      n = await Pl(t.oldContent, e),
      r = await Pl(t.newContent, e),
      i = {
        tool: t.tool,
        filePath: t.filePath,
        timestamp: t.timestamp,
        oldContent: n.inline
          ? { inline: !0, content: n.content }
          : { inline: !1, hash: n.hash },
        newContent: r.inline
          ? { inline: !0, content: r.content }
          : { inline: !1, hash: r.hash },
      };
    await He.writeFile(_t.join(e, o), JSON.stringify(i), "utf-8");
  }
  async function Il(t, e) {
    if (!t) return null;
    if (t.inline) return t.content;
    let s = _t.join(e, "blobs", t.hash);
    return He.readFile(s, "utf-8");
  }
  async function Mg() {
    let t = vo(),
      e;
    try {
      e = await He.readdir(t);
    } catch {
      return 0;
    }
    let s = e.filter((n) => n.endsWith(".json")).sort(),
      o = 0;
    for (let n of s)
      try {
        let r = await He.readFile(_t.join(t, n), "utf-8"),
          i = JSON.parse(r),
          c = await Il(i.oldContent, t),
          l = await Il(i.newContent, t);
        (st.push({
          tool: i.tool,
          filePath: i.filePath,
          timestamp: i.timestamp,
          oldContent: c,
          newContent: l,
        }),
          o++);
      } catch {}
    for (; st.length > Ll; ) st.shift();
    return o;
  }
  async function Pg(t = 7) {
    let e = vo(),
      s;
    try {
      s = await He.readdir(e);
    } catch {
      return 0;
    }
    let o = Date.now() - t * 24 * 60 * 60 * 1e3,
      n = s.filter((u) => u.endsWith(".json")),
      r = 0,
      i = new Set(),
      c = [];
    for (let u of n)
      try {
        let d = await He.readFile(_t.join(e, u), "utf-8"),
          f = JSON.parse(d);
        f.timestamp < o
          ? (c.push(u), r++)
          : (f.oldContent &&
              !f.oldContent.inline &&
              f.oldContent.hash &&
              i.add(f.oldContent.hash),
            f.newContent &&
              !f.newContent.inline &&
              f.newContent.hash &&
              i.add(f.newContent.hash));
      } catch {}
    for (let u of c)
      try {
        await He.unlink(_t.join(e, u));
      } catch {}
    let l = _t.join(e, "blobs");
    try {
      let u = await He.readdir(l);
      for (let d of u)
        if (!i.has(d))
          try {
            await He.unlink(_t.join(l, d));
          } catch {}
    } catch {}
    return r;
  }
  var ko = "nex-snapshot";
  function Ig(t, e = process.cwd()) {
    let s = t
      ? `${ko}-${t.replace(/[^a-zA-Z0-9_-]/g, "-")}`
      : `${ko}-${Date.now()}`;
    try {
      return us("git status --porcelain", { cwd: e, timeout: 1e4 })
        .toString()
        .trim()
        ? (us(`git stash push -u -m "${s}"`, { cwd: e, timeout: 15e3 }),
          us("git stash pop", { cwd: e, timeout: 1e4 }),
          { name: s, label: s, ok: !0 })
        : {
            name: s,
            label: s,
            ok: !1,
            error: "No changes to snapshot (working tree clean)",
          };
    } catch (o) {
      return { name: s, label: s, ok: !1, error: o.message };
    }
  }
  function Dl(t = process.cwd()) {
    try {
      let e = us("git stash list", { cwd: t, timeout: 1e4 }).toString().trim();
      return e
        ? e
            .split(
              `
`,
            )
            .map((s) => {
              let o = s.match(
                /^stash@\{(\d+)\}:\s+(?:WIP on [^:]+:\s+\S+\s+|On \S+:\s+)(.*)/,
              );
              if (!o) return null;
              let n = o[2].trim();
              return n.startsWith(ko)
                ? {
                    index: parseInt(o[1], 10),
                    label: n,
                    shortName: n.replace(`${ko}-`, ""),
                    date: s,
                  }
                : null;
            })
            .filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }
  function Lg(t, e = process.cwd()) {
    try {
      let s = Dl(e);
      if (s.length === 0) return { ok: !1, error: "No snapshots found" };
      let o;
      return (
        t === void 0 || t === "last"
          ? (o = s[0])
          : typeof t == "number"
            ? (o = s.find((n) => n.index === t))
            : (o = s.find(
                (n) =>
                  n.label === t ||
                  n.shortName === t ||
                  n.shortName.includes(String(t)),
              )),
        o
          ? (us(`git stash apply stash@{${o.index}}`, {
              cwd: e,
              timeout: 15e3,
            }),
            { ok: !0, label: o.label })
          : { ok: !1, error: `Snapshot not found: ${t}` }
      );
    } catch (s) {
      return { ok: !1, error: s.message };
    }
  }
  ql.exports = {
    recordChange: Eg,
    undo: Tg,
    redo: Rg,
    getHistory: Cg,
    getUndoCount: Ag,
    getRedoCount: Og,
    clearHistory: Ng,
    persistEntry: jl,
    loadPersistedHistory: Mg,
    pruneHistory: Pg,
    createSnapshot: Ig,
    listSnapshots: Dl,
    restoreSnapshot: Lg,
  };
});
var tn = K((vk, Hl) => {
  var Se = require("fs"),
    ot = require("path"),
    { atomicWrite: jg, withFileLockSync: Dg } = Qt(),
    rt = [];
  function ds() {
    return ot.join(process.cwd(), ".nex", "skills");
  }
  function Fl() {
    return ot.join(process.cwd(), ".nex", "config.json");
  }
  function Ul() {
    let t = ds();
    return (Se.existsSync(t) || Se.mkdirSync(t, { recursive: !0 }), t);
  }
  function $i() {
    let t = Fl();
    if (!Se.existsSync(t)) return [];
    try {
      let e = JSON.parse(Se.readFileSync(t, "utf-8"));
      return e.skills && Array.isArray(e.skills.disabled)
        ? e.skills.disabled
        : [];
    } catch {
      return [];
    }
  }
  function Wl(t) {
    let e = Fl(),
      s = ot.dirname(e);
    (Se.existsSync(s) || Se.mkdirSync(s, { recursive: !0 }),
      Dg(e, () => {
        let o = {};
        if (Se.existsSync(e))
          try {
            o = JSON.parse(Se.readFileSync(e, "utf-8"));
          } catch {
            o = {};
          }
        (o.skills || (o.skills = {}),
          (o.skills.disabled = t),
          jg(e, JSON.stringify(o, null, 2)));
      }));
  }
  function Bl(t, e) {
    let s = [];
    if (typeof t != "object" || t === null)
      return { valid: !1, errors: ["Module must export an object"] };
    if (
      (t.name !== void 0 &&
        typeof t.name != "string" &&
        s.push("name must be a string"),
      t.description !== void 0 &&
        typeof t.description != "string" &&
        s.push("description must be a string"),
      t.instructions !== void 0 &&
        typeof t.instructions != "string" &&
        s.push("instructions must be a string"),
      t.commands !== void 0)
    )
      if (!Array.isArray(t.commands)) s.push("commands must be an array");
      else
        for (let o = 0; o < t.commands.length; o++) {
          let n = t.commands[o];
          ((!n.cmd || typeof n.cmd != "string") &&
            s.push(`commands[${o}].cmd must be a non-empty string`),
            n.handler !== void 0 &&
              typeof n.handler != "function" &&
              s.push(`commands[${o}].handler must be a function`));
        }
    if (t.tools !== void 0)
      if (!Array.isArray(t.tools)) s.push("tools must be an array");
      else
        for (let o = 0; o < t.tools.length; o++) {
          let n = t.tools[o];
          ((!n.function ||
            !n.function.name ||
            typeof n.function.name != "string") &&
            s.push(`tools[${o}].function.name must be a non-empty string`),
            n.execute !== void 0 &&
              typeof n.execute != "function" &&
              s.push(`tools[${o}].execute must be a function`));
        }
    return { valid: s.length === 0, errors: s };
  }
  function hi(t) {
    try {
      let e = Se.readFileSync(t, "utf-8").trim();
      return e
        ? {
            name: ot.basename(t, ".md"),
            type: "prompt",
            filePath: t,
            instructions: e,
            commands: [],
            tools: [],
          }
        : null;
    } catch {
      return null;
    }
  }
  function gi(t) {
    try {
      let e = require(t),
        { valid: s, errors: o } = Bl(e, t);
      return s
        ? {
            name: e.name || ot.basename(t, ".js"),
            type: "script",
            filePath: t,
            description: e.description || "",
            instructions: e.instructions || "",
            commands: (e.commands || []).map((r) => ({
              cmd: r.cmd.startsWith("/") ? r.cmd : `/${r.cmd}`,
              desc: r.desc || r.description || "",
              handler: r.handler || null,
            })),
            tools: (e.tools || []).map((r) => ({
              type: r.type || "function",
              function: {
                name: r.function.name,
                description: r.function.description || "",
                parameters: r.function.parameters || {
                  type: "object",
                  properties: {},
                },
              },
              execute: r.execute || null,
            })),
          }
        : (console.error(`Skill validation failed: ${t}
  ${o.join(`
  `)}`),
          null);
    } catch (e) {
      return (console.error(`Failed to load skill: ${t}: ${e.message}`), null);
    }
  }
  function yi() {
    rt = [];
    let t = $i(),
      e = ds(),
      s = [];
    if (Se.existsSync(e))
      try {
        s = Se.readdirSync(e);
      } catch {
        s = [];
      }
    for (let n of s) {
      let r = ot.join(e, n),
        i;
      try {
        i = Se.statSync(r);
      } catch {
        continue;
      }
      if (!i.isFile()) continue;
      let c = null;
      (n.endsWith(".md") ? (c = hi(r)) : n.endsWith(".js") && (c = gi(r)),
        c && ((c.enabled = !t.includes(c.name)), rt.push(c)));
    }
    let o = ot.join(__dirname, "skills");
    if (!process.env.NEX_SKIP_BUILTIN_SKILLS && Se.existsSync(o)) {
      let n;
      try {
        n = Se.readdirSync(o).filter(
          (r) => r.endsWith(".md") || r.endsWith(".js"),
        );
      } catch {
        n = [];
      }
      for (let r of n) {
        let i = ot.join(o, r),
          c = ot.basename(r, ot.extname(r));
        if (rt.some((d) => d.name === c)) continue;
        let l;
        try {
          l = Se.statSync(i);
        } catch {
          continue;
        }
        if (!l.isFile()) continue;
        let u = r.endsWith(".md") ? hi(i) : gi(i);
        u && ((u._builtin = !0), (u.enabled = !t.includes(u.name)), rt.push(u));
      }
    }
    return rt;
  }
  function qg() {
    let t = [];
    for (let e of rt)
      !e.enabled ||
        !e.instructions ||
        t.push(`[Skill: ${e.name}]
${e.instructions}`);
    return t.length === 0
      ? ""
      : `SKILL INSTRUCTIONS:
${t.join(`

`)}`;
  }
  function Fg() {
    let t = [];
    for (let e of rt)
      if (e.enabled)
        for (let s of e.commands)
          t.push({ cmd: s.cmd, desc: s.desc || `[skill: ${e.name}]` });
    return t;
  }
  function Ug() {
    let t = [];
    for (let e of rt)
      if (e.enabled)
        for (let s of e.tools)
          t.push({
            type: "function",
            function: {
              name: `skill_${s.function.name}`,
              description: `[Skill:${e.name}] ${s.function.description}`,
              parameters: s.function.parameters,
            },
          });
    return t;
  }
  async function Wg(t, e) {
    if (!t.startsWith("skill_")) return null;
    let s = t.substring(6);
    for (let o of rt)
      if (o.enabled) {
        for (let n of o.tools)
          if (n.function.name === s && n.execute)
            try {
              let r = await n.execute(e);
              return typeof r == "string" ? r : JSON.stringify(r);
            } catch (r) {
              return `ERROR: Skill tool '${s}' failed: ${r.message}`;
            }
      }
    return `ERROR: Skill tool '${s}' not found`;
  }
  function Bg(t) {
    let [e, ...s] = t.split(/\s+/),
      o = s.join(" ").trim();
    for (let n of rt)
      if (n.enabled) {
        for (let r of n.commands)
          if (r.cmd === e && r.handler) {
            try {
              r.handler(o);
            } catch (i) {
              console.error(`Skill command error (${e}): ${i.message}`);
            }
            return !0;
          }
      }
    return !1;
  }
  function Hg() {
    return rt.map((t) => ({
      name: t.name,
      type: t.type,
      enabled: t.enabled,
      description: t.description || "",
      commands: t.commands.length,
      tools: t.tools.length,
      filePath: t.filePath,
    }));
  }
  function Gg(t) {
    let e = rt.find((o) => o.name === t);
    if (!e) return !1;
    e.enabled = !0;
    let s = $i().filter((o) => o !== t);
    return (Wl(s), !0);
  }
  function Kg(t) {
    let e = rt.find((o) => o.name === t);
    if (!e) return !1;
    e.enabled = !1;
    let s = $i();
    return (s.includes(t) || (s.push(t), Wl(s)), !0);
  }
  function Yg() {
    return rt;
  }
  async function zg(t, e = {}) {
    let { execSync: s } = require("child_process"),
      o = Ul(),
      n = t;
    /^[\w-]+\/[\w.-]+$/.test(t) && (n = `https://github.com/${t}.git`);
    let r = e.name || ot.basename(n, ".git").replace(/^nex-skill-/, ""),
      i = ot.join(o, r);
    if (Se.existsSync(i))
      return {
        ok: !1,
        name: r,
        error: `Skill "${r}" is already installed at ${i}. Remove it first to reinstall.`,
      };
    try {
      s(`git clone --depth 1 ${n} ${i}`, { timeout: 3e4, stdio: "pipe" });
    } catch (d) {
      return {
        ok: !1,
        name: r,
        error: `Git clone failed: ${d.stderr?.toString().trim() || d.message}`,
      };
    }
    let c = ot.join(i, "skill.json"),
      l = Se.existsSync(c),
      u = Se.readdirSync(i).some(
        (d) => (d.endsWith(".md") || d.endsWith(".js")) && !d.startsWith("."),
      );
    if (!l && !u) {
      try {
        Se.rmSync(i, { recursive: !0, force: !0 });
      } catch {}
      return {
        ok: !1,
        name: r,
        error:
          "No skill.json manifest or .md/.js skill file found in repository",
      };
    }
    if (l)
      try {
        let d = JSON.parse(Se.readFileSync(c, "utf-8"));
        d.name || (d.name = r);
      } catch {
        try {
          Se.rmSync(i, { recursive: !0, force: !0 });
        } catch {}
        return {
          ok: !1,
          name: r,
          error: "Invalid skill.json \u2014 not valid JSON",
        };
      }
    return (yi(), { ok: !0, name: r });
  }
  async function Xg(t) {
    let e = require("axios");
    try {
      let s = encodeURIComponent(`nex-skill ${t} OR nex-code-skill ${t}`);
      return (
        (
          await e.get(
            `https://api.github.com/search/repositories?q=${s}&sort=stars&per_page=10`,
            {
              timeout: 1e4,
              headers: { Accept: "application/vnd.github.v3+json" },
            },
          )
        ).data.items || []
      ).map((n) => ({
        name: n.name.replace(/^nex-skill-/, ""),
        description: n.description || "(no description)",
        url: n.clone_url,
        stars: n.stargazers_count,
        owner: n.owner.login,
      }));
    } catch (s) {
      return [
        {
          name: "error",
          description: `Search failed: ${s.message}`,
          url: "",
          stars: 0,
          owner: "",
        },
      ];
    }
  }
  function Jg(t) {
    let e = ot.join(ds(), t);
    if (!Se.existsSync(e))
      return { ok: !1, error: `Skill "${t}" not found in ${ds()}` };
    try {
      return (Se.rmSync(e, { recursive: !0, force: !0 }), yi(), { ok: !0 });
    } catch (s) {
      return { ok: !1, error: s.message };
    }
  }
  Hl.exports = {
    initSkillsDir: Ul,
    loadAllSkills: yi,
    getSkillInstructions: qg,
    getSkillCommands: Fg,
    getSkillToolDefinitions: Ug,
    routeSkillCall: Wg,
    handleSkillCommand: Bg,
    listSkills: Hg,
    enableSkill: Gg,
    disableSkill: Kg,
    getLoadedSkills: Yg,
    installSkill: zg,
    searchSkills: Xg,
    removeSkill: Jg,
    _getSkillsDir: ds,
    _validateScriptSkill: Bl,
    _loadMarkdownSkill: hi,
    _loadScriptSkill: gi,
  };
});
var Eo = K((Sk, Jl) => {
  var { spawn: Vg } = require("child_process"),
    Qg = require("path"),
    Gl = require("fs"),
    Ut = new Map();
  function Zg() {
    return Qg.join(process.cwd(), ".nex", "config.json");
  }
  function wi() {
    let t = Zg();
    if (!Gl.existsSync(t)) return {};
    try {
      return JSON.parse(Gl.readFileSync(t, "utf-8")).mcpServers || {};
    } catch {
      return {};
    }
  }
  function So(t, e, s = {}, o = 1e4) {
    return new Promise((n, r) => {
      let i = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        c =
          JSON.stringify({ jsonrpc: "2.0", id: i, method: e, params: s }) +
          `
`,
        l = "",
        u = setTimeout(() => {
          (f(), r(new Error(`MCP request timeout: ${e}`)));
        }, o);
      function d(m) {
        l += m.toString();
        let h = l.split(`
`);
        for (let p of h)
          if (p.trim())
            try {
              let g = JSON.parse(p);
              if (g.id === i) {
                (f(),
                  g.error
                    ? r(
                        new Error(
                          `MCP error: ${g.error.message || JSON.stringify(g.error)}`,
                        ),
                      )
                    : n(g.result));
                return;
              }
            } catch {}
        l = h[h.length - 1] || "";
      }
      function f() {
        (clearTimeout(u), t.stdout.removeListener("data", d));
      }
      t.stdout.on("data", d);
      try {
        t.stdin.write(c);
      } catch (m) {
        (f(), r(new Error(`MCP write failed: ${m.message}`)));
      }
    });
  }
  async function Kl(t, e) {
    if (Ut.has(t)) return Ut.get(t);
    let s = ["PATH", "HOME", "USER", "SHELL", "LANG", "TERM", "NODE_ENV"],
      o = {};
    for (let i of s) process.env[i] && (o[i] = process.env[i]);
    let n = Vg(e.command, e.args || [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...o, ...(e.env || {}) },
      }),
      r = { name: t, proc: n, tools: [], config: e };
    try {
      await So(n, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "nex-code", version: "0.2.0" },
      });
      let i = await So(n, "tools/list", {});
      return ((r.tools = (i && i.tools) || []), Ut.set(t, r), r);
    } catch (i) {
      throw (
        n.kill(),
        new Error(`Failed to connect MCP server '${t}': ${i.message}`)
      );
    }
  }
  function Yl(t) {
    let e = Ut.get(t);
    if (!e) return !1;
    try {
      e.proc.kill();
    } catch {}
    return (Ut.delete(t), !0);
  }
  function e$() {
    for (let [t] of Ut) Yl(t);
  }
  async function zl(t, e, s = {}) {
    let o = Ut.get(t);
    if (!o) throw new Error(`MCP server not connected: ${t}`);
    let n = await So(o.proc, "tools/call", { name: e, arguments: s });
    return n && Array.isArray(n.content)
      ? n.content.filter((r) => r.type === "text").map((r) => r.text).join(`
`)
      : JSON.stringify(n);
  }
  function Xl() {
    let t = [];
    for (let [e, s] of Ut)
      for (let o of s.tools)
        t.push({
          server: e,
          name: o.name,
          description: o.description || "",
          inputSchema: o.inputSchema || { type: "object", properties: {} },
        });
    return t;
  }
  function t$() {
    return Xl().map((t) => ({
      type: "function",
      function: {
        name: `mcp_${t.server}_${t.name}`,
        description: `[MCP:${t.server}] ${t.description}`,
        parameters: t.inputSchema,
      },
    }));
  }
  async function n$(t, e) {
    if (!t.startsWith("mcp_")) return null;
    let s = t.substring(4).split("_");
    if (s.length < 2) return null;
    let o = s[0],
      n = s.slice(1).join("_");
    return zl(o, n, e);
  }
  function s$() {
    let t = wi();
    return Object.entries(t).map(([e, s]) => {
      let o = Ut.get(e);
      return {
        name: e,
        command: s.command,
        connected: !!o,
        toolCount: o ? o.tools.length : 0,
      };
    });
  }
  async function o$() {
    let t = wi(),
      e = [];
    for (let [s, o] of Object.entries(t))
      try {
        let n = await Kl(s, o);
        e.push({ name: s, tools: n.tools.length });
      } catch (n) {
        e.push({ name: s, tools: 0, error: n.message });
      }
    return e;
  }
  Jl.exports = {
    loadMCPConfig: wi,
    sendRequest: So,
    connectServer: Kl,
    disconnectServer: Yl,
    disconnectAll: e$,
    callTool: zl,
    getAllTools: Xl,
    getMCPToolDefinitions: t$,
    routeMCPCall: n$,
    listServers: s$,
    connectAll: o$,
  };
});
var Ro = K((Ek, eu) => {
  var Vl = require("fs"),
    bi = require("path"),
    To = [],
    fs = [],
    gn = {},
    ps = [
      "onToolResult",
      "onModelResponse",
      "onSessionStart",
      "onSessionEnd",
      "onFileChange",
      "beforeToolExec",
      "afterToolExec",
    ];
  function Ql(t, e) {
    if (!t || !t.function || !t.function.name)
      return { ok: !1, error: "Tool definition must have function.name" };
    if (typeof e != "function")
      return { ok: !1, error: "Handler must be a function" };
    let s = t.function.name;
    return fs.some((o) => o.definition.function.name === s)
      ? { ok: !1, error: `Tool "${s}" is already registered` }
      : (fs.push({ definition: { type: "function", ...t }, handler: e }),
        { ok: !0 });
  }
  function Zl(t, e) {
    return ps.includes(t)
      ? typeof e != "function"
        ? { ok: !1, error: "Handler must be a function" }
        : (gn[t] || (gn[t] = []), gn[t].push(e), { ok: !0 })
      : { ok: !1, error: `Unknown event "${t}". Available: ${ps.join(", ")}` };
  }
  async function _i(t, e) {
    let s = gn[t] || [],
      o = e;
    for (let n of s)
      try {
        let r = await n(o);
        r !== void 0 && (o = r);
      } catch (r) {
        process.env.NEX_DEBUG &&
          console.error(`[plugin] Hook error on ${t}: ${r.message}`);
      }
    return o;
  }
  function r$() {
    let t = bi.join(process.cwd(), ".nex", "plugins"),
      e = [];
    if (!Vl.existsSync(t)) return { loaded: 0, errors: [] };
    let s = Vl.readdirSync(t).filter((n) => n.endsWith(".js")),
      o = { registerTool: Ql, registerHook: Zl, EVENTS: ps };
    for (let n of s) {
      let r = bi.join(t, n);
      try {
        let i = require(r);
        if (typeof i == "function") i(o);
        else if (typeof i.setup == "function") i.setup(o);
        else {
          e.push(`${n}: Plugin must export a function or { setup: function }`);
          continue;
        }
        To.push({ name: i.name || bi.basename(n, ".js"), filePath: r });
      } catch (i) {
        e.push(`${n}: ${i.message}`);
      }
    }
    return { loaded: To.length, errors: e };
  }
  function i$() {
    return fs.map((t) => t.definition);
  }
  async function a$(t, e, s = {}) {
    let o = fs.find((c) => c.definition.function.name === t);
    if (!o) return null;
    let n = await _i("beforeToolExec", { name: t, args: e, options: s }),
      r = await o.handler(n.args || e, s);
    return (
      (await _i("afterToolExec", { name: t, args: e, result: r })).result || r
    );
  }
  function c$() {
    return [...To];
  }
  function l$() {
    let t = {};
    for (let e of ps) t[e] = (gn[e] || []).length;
    return t;
  }
  function u$() {
    ((To.length = 0), (fs.length = 0));
    for (let t of Object.keys(gn)) delete gn[t];
  }
  eu.exports = {
    registerTool: Ql,
    registerHook: Zl,
    emit: _i,
    loadPlugins: r$,
    getPluginToolDefinitions: i$,
    executePluginTool: a$,
    getLoadedPlugins: c$,
    getHookCounts: l$,
    clearPlugins: u$,
    EVENTS: ps,
  };
});
var xi = K((Tk, ou) => {
  var { getSkillToolDefinitions: d$ } = tn(),
    { getMCPToolDefinitions: f$ } = Eo(),
    { getPluginToolDefinitions: p$ } = Ro(),
    Co = new Map();
  function tu() {
    let { TOOL_DEFINITIONS: t } = St();
    return [...t, ...d$(), ...f$(), ...p$()];
  }
  function nu(t) {
    if (Co.has(t)) return Co.get(t);
    let s = tu().find((n) => n.function.name === t);
    if (!s) return null;
    let o = s.function.parameters;
    return (Co.set(t, o), o);
  }
  function m$() {
    Co.clear();
  }
  function Ao(t, e) {
    if (!t || e.length === 0) return null;
    let s = null,
      o = 1 / 0;
    for (let n of e) {
      let r = su(t.toLowerCase(), n.toLowerCase());
      r < o && ((o = r), (s = n));
    }
    return o <= Math.ceil(t.length / 2) ? s : null;
  }
  function su(t, e) {
    let s = t.length,
      o = e.length,
      n = Array.from({ length: s + 1 }, () => Array(o + 1).fill(0));
    for (let r = 0; r <= s; r++) n[r][0] = r;
    for (let r = 0; r <= o; r++) n[0][r] = r;
    for (let r = 1; r <= s; r++)
      for (let i = 1; i <= o; i++)
        n[r][i] =
          t[r - 1] === e[i - 1]
            ? n[r - 1][i - 1]
            : 1 + Math.min(n[r - 1][i], n[r][i - 1], n[r - 1][i - 1]);
    return n[s][o];
  }
  function h$(t, e) {
    let s = nu(t);
    if (s === null) {
      let d = tu().map((m) => m.function.name),
        f = Ao(t, d);
      return {
        valid: !1,
        error: `Unknown tool "${t}".${f ? ` Did you mean "${f}"?` : ""}
Available tools: ${d.join(", ")}`,
      };
    }
    if (!s || !s.properties) return { valid: !0 };
    let o = s.required || [],
      n = Object.keys(s.properties),
      r = Object.keys(e),
      i = [],
      c = { ...e },
      l = !1;
    for (let u of o)
      if (!(u in e) || e[u] === void 0 || e[u] === null) {
        let d = Ao(u, r);
        d && !n.includes(d)
          ? ((c[u] = e[d]), delete c[d], (l = !0))
          : i.push(
              `Missing required parameter "${u}" (${s.properties[u]?.description || s.properties[u]?.type || "unknown"})`,
            );
      }
    for (let u of r)
      if (!n.includes(u)) {
        let d = Ao(u, n);
        d && !(d in c)
          ? ((c[d] = e[u]), delete c[u], (l = !0))
          : l ||
            i.push(
              `Unknown parameter "${u}".${d ? ` Did you mean "${d}"?` : ""}`,
            );
      }
    for (let u of Object.keys(c)) {
      if (!s.properties[u]) continue;
      let d = s.properties[u].type,
        f = typeof c[u];
      d === "string" && f === "number"
        ? ((c[u] = String(c[u])), (l = !0))
        : d === "number" && f === "string" && !isNaN(c[u])
          ? ((c[u] = Number(c[u])), (l = !0))
          : d === "boolean" &&
            f === "string" &&
            ((c[u] = c[u] === "true"), (l = !0));
    }
    return i.length > 0 && !l
      ? {
          valid: !1,
          error:
            `Tool "${t}" argument errors:
` +
            i.map((u) => `  - ${u}`).join(`
`) +
            `

Expected parameters: ${JSON.stringify(s.properties, null, 2)}`,
        }
      : { valid: !0, corrected: l ? c : null };
  }
  function g$(t, e) {
    let s = [],
      o = { ...t };
    if (!o.function && !o.name)
      return (
        s.push('Tool call missing both "function" and "name" fields'),
        { valid: !1, normalized: o, errors: s }
      );
    if (
      (!o.function &&
        o.name &&
        ((o.function = {
          name: o.name,
          arguments: o.arguments || o.args || {},
        }),
        delete o.name,
        delete o.args),
      o.function &&
        o.function.args !== void 0 &&
        o.function.arguments === void 0 &&
        ((o.function.arguments = o.function.args), delete o.function.args),
      o.function &&
        (o.function.arguments === void 0 || o.function.arguments === null) &&
        (o.function.arguments = {}),
      o.function && typeof o.function.arguments == "string")
    ) {
      let n = o.function.arguments;
      if (n.trim() === "") o.function.arguments = {};
      else
        try {
          o.function.arguments = JSON.parse(n);
        } catch (r) {
          return (
            s.push(
              `Invalid JSON in arguments${e ? ` (${e})` : ""}: ${r.message}`,
            ),
            { valid: !1, normalized: o, errors: s }
          );
        }
    }
    return o.function && typeof o.function.arguments != "object"
      ? (s.push(
          `Arguments must be an object, got ${typeof o.function.arguments}`,
        ),
        { valid: !1, normalized: o, errors: s })
      : !o.function.name || typeof o.function.name != "string"
        ? (s.push("Tool call function name must be a non-empty string"),
          { valid: !1, normalized: o, errors: s })
        : { valid: s.length === 0, normalized: o, errors: s };
  }
  ou.exports = {
    validateToolArgs: h$,
    validateToolCallFormat: g$,
    closestMatch: Ao,
    levenshtein: su,
    getCachedSchema: nu,
    clearSchemaCache: m$,
  };
});
var cu = K((Rk, au) => {
  var { levenshtein: Oo } = xi(),
    $$ = 200,
    y$ = 0.3,
    w$ = 2;
  function ki(t) {
    return t
      .replace(
        /\r\n/g,
        `
`,
      )
      .replace(
        /\r/g,
        `
`,
      )
      .replace(/\t/g, " ".repeat(w$))
      .split(
        `
`,
      )
      .map((e) => {
        let s = e.replace(/\s+$/, ""),
          o = s.match(/^(\s*)(.*)/);
        if (!o) return s;
        let [, n, r] = o;
        return n + r.replace(/ {2,}/g, " ");
      }).join(`
`);
  }
  function b$(t, e) {
    if (t.includes(e)) return e;
    if (e.length < 10) return null;
    let s = ki(t),
      o = ki(e);
    if (!s.includes(o)) return null;
    let n = t.split(`
`),
      r = s.split(`
`),
      i = o.split(`
`),
      c = i[0],
      l = i[i.length - 1];
    for (let u = 0; u <= r.length - i.length; u++) {
      let d = !0;
      for (let f = 0; f < i.length; f++)
        if (r[u + f] !== i[f]) {
          d = !1;
          break;
        }
      if (d)
        return n.slice(u, u + i.length).join(`
`);
    }
    if (i.length === 1) {
      for (let u = 0; u < r.length; u++)
        if (r[u].indexOf(o) !== -1) return n[u];
    }
    return null;
  }
  function _$(t, e) {
    if (!t || !e) return null;
    let s = t.split(`
`),
      n = e.split(`
`).length;
    return s.length === 0 || n === 0 ? null : n === 1 ? x$(s, e) : v$(s, e, n);
  }
  function ru(t) {
    return Math.max(1, Math.floor(t / $$));
  }
  function iu(t, e) {
    return t <= Math.ceil(e * y$);
  }
  function x$(t, e) {
    let s = e.trim(),
      o = ru(t.length),
      n = null,
      r = 1 / 0;
    for (let i = 0; i < t.length; i += o) {
      let c = t[i];
      if (!c.trim()) continue;
      let l = Oo(c.trim(), s);
      l < r && ((r = l), (n = { text: c, distance: l, line: i + 1 }));
    }
    return (
      n && o > 1 && ((n = k$(t, s, n, o) || n), (r = n.distance)),
      iu(r, e.length) ? n : null
    );
  }
  function k$(t, e, s, o) {
    let n = s.line - 1,
      r = Math.max(0, n - o),
      i = Math.min(t.length - 1, n + o),
      c = s.distance,
      l = null;
    for (let u = r; u <= i; u++) {
      let d = t[u];
      if (!d.trim()) continue;
      let f = Oo(d.trim(), e);
      f < c && ((c = f), (l = { text: d, distance: f, line: u + 1 }));
    }
    return l;
  }
  function v$(t, e, s) {
    let o = t.length - s + 1;
    if (o <= 0) return null;
    let n = ru(o),
      r = null,
      i = 1 / 0;
    for (let c = 0; c < o; c += n) {
      let l = t.slice(c, c + s).join(`
`),
        u = Oo(l, e);
      u < i && ((i = u), (r = { text: l, distance: u, line: c + 1 }));
    }
    return (
      r && n > 1 && ((r = S$(t, e, r, n, s, o) || r), (i = r.distance)),
      iu(i, e.length) ? r : null
    );
  }
  function S$(t, e, s, o, n, r) {
    let i = s.line - 1,
      c = Math.max(0, i - o),
      l = Math.min(r - 1, i + o),
      u = s.distance,
      d = null;
    for (let f = c; f <= l; f++) {
      let m = t.slice(f, f + n).join(`
`),
        h = Oo(m, e);
      h < u && ((u = h), (d = { text: m, distance: h, line: f + 1 }));
    }
    return d;
  }
  au.exports = {
    normalizeWhitespace: ki,
    fuzzyFindText: b$,
    findMostSimilar: _$,
  };
});
var uu = K((Ak, lu) => {
  var { C: Ck } = Ce(),
    E$ = [
      { name: "OpenAI API Key", regex: /sk-[a-zA-Z0-9]{20,}/i },
      { name: "Anthropic API Key", regex: /sk-ant-api03-[a-zA-Z0-9-]{90,}/i },
      { name: "Google Gemini API Key", regex: /AIzaSy[a-zA-Z0-9_-]{30,45}/i },
      { name: "Slack Token", regex: /xox[bpors]-[a-zA-Z0-9-]+/i },
      { name: "AWS Access Key", regex: /AKIA[A-Z0-9]{16}/i },
      { name: "GitHub Token", regex: /ghp_[a-zA-Z0-9]{36}/i },
      {
        name: "Private Key",
        regex: /BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY/i,
      },
      {
        name: "Database URL",
        regex: /\b(postgres|mongodb|mysql|redis):\/\/[^"'\s]+/i,
      },
      {
        name: "Hardcoded Secret",
        regex:
          /(password|secret|token|api_key|apikey|api_secret|access_token|auth_token|credentials)\s*[:=]\s*['"'][^'"']{8,}/i,
      },
    ],
    T$ = [
      { name: "TODO", regex: /\bTODO\b/i, severity: "warn" },
      { name: "FIXME", regex: /\bFIXME\b/i, severity: "warn" },
      {
        name: "Debugger",
        regex: /\bdebugger\b/,
        severity: "error",
        ext: [".js", ".ts", ".jsx", ".tsx"],
      },
      {
        name: "eval()",
        regex: /\beval\s*\(/,
        severity: "warn",
        ext: [".js", ".ts", ".jsx", ".tsx"],
      },
      {
        name: "Console Log",
        regex: /\bconsole\.log\(/,
        severity: "info",
        ext: [".js", ".ts", ".jsx", ".tsx"],
      },
      {
        name: "ANSI Code",
        regex: /\\x1b\[[0-9;]*m/,
        severity: "warn",
        message: "Avoid hardcoded ANSI codes; use cli/ui.js instead.",
      },
    ];
  function R$(t, e) {
    let s = e.split(`
`),
      o = [],
      n = t ? `.${t.split(".").pop()}` : "";
    for (let r = 0; r < s.length; r++) {
      let i = s[r],
        c = r + 1;
      for (let l of E$)
        l.regex.test(i) &&
          o.push({
            line: c,
            message: `Potential secret detected: ${l.name}`,
            severity: "error",
          });
      for (let l of T$)
        (l.ext && !l.ext.includes(n)) ||
          (l.regex.test(i) &&
            o.push({
              line: c,
              message: l.message || `Found ${l.name}`,
              severity: l.severity || "warn",
            }));
    }
    return (
      s.length > 500 &&
        o.push({
          line: 0,
          message: `Large file detected (${s.length} lines). Consider refactoring.`,
          severity: "info",
        }),
      o
    );
  }
  lu.exports = { runDiagnostics: R$ };
});
var Ri = K((Ok, gu) => {
  var Fn = require("fs").promises,
    Un = require("path"),
    { exec: C$ } = require("util").promisify(require("child_process").exec),
    Wn = [],
    Ti = null,
    No = !1,
    Si = 0,
    A$ = 6e4;
  function fu(t) {
    return !(Wn.length === 0 || Ti !== t || Date.now() - Si > A$);
  }
  async function pu(t) {
    if (!No && !fu(t)) {
      ((No = !0), (Ti = t));
      try {
        try {
          let { stdout: o } = await C$("rg --files", { cwd: t, timeout: 5e3 });
          ((Wn = o
            .split(
              `
`,
            )
            .filter(Boolean)),
            (Si = Date.now()),
            (No = !1));
          return;
        } catch {}
        let e = [],
          s = async (o, n) => {
            let r;
            try {
              r = await Fn.readdir(o, { withFileTypes: !0 });
            } catch {
              return;
            }
            for (let i of r) {
              if (
                i.name === "node_modules" ||
                i.name === ".git" ||
                i.name.startsWith(".")
              )
                continue;
              let c = n ? `${n}/${i.name}` : i.name;
              i.isDirectory() ? await s(Un.join(o, i.name), c) : e.push(c);
            }
          };
        (await s(t, ""), (Wn = e), (Si = Date.now()));
      } catch (e) {
        console.error(`Index error: ${e.message}`);
      } finally {
        No = !1;
      }
    }
  }
  function Ei() {
    return Wn;
  }
  function O$() {
    return Ti;
  }
  function N$(t) {
    return Wn.filter((e) => Un.basename(e) === t);
  }
  function M$(t) {
    let e = t.toLowerCase();
    return Wn.filter((s) => s.toLowerCase().includes(e)).slice(0, 20);
  }
  var vi = null,
    du = 0,
    P$ = 12e4,
    I$ = new Set([
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".mjs",
      ".cjs",
      ".py",
      ".go",
      ".rs",
      ".java",
      ".rb",
    ]);
  function mu(t, e) {
    let s = [],
      o = t.split(`
`);
    for (let n = 0; n < o.length; n++) {
      let r = o[n],
        i = n + 1;
      if ([".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"].includes(e)) {
        let c = r.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        c && s.push({ type: "function", name: c[1], line: i });
        let l = r.match(/(?:export\s+)?class\s+(\w+)/);
        l && s.push({ type: "class", name: l[1], line: i });
        let u = r.match(
          /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/,
        );
        u && s.push({ type: "function", name: u[1], line: i });
        let d = r.match(/module\.exports\s*=\s*\{([^}]+)\}/);
        if (d) {
          let m = d[1]
            .split(",")
            .map((h) => h.trim().split(":")[0].trim())
            .filter(Boolean);
          for (let h of m)
            /^\w+$/.test(h) && s.push({ type: "export", name: h, line: i });
        }
        let f = r.match(
          /(?:require\(['"]([^'"]+)['"]\)|from\s+['"]([^'"]+)['"])/,
        );
        if (f) {
          let m = f[1] || f[2];
          s.push({ type: "import", name: m, line: i });
        }
      }
      if (e === ".py") {
        let c = r.match(/^(?:async\s+)?def\s+(\w+)/);
        c && s.push({ type: "function", name: c[1], line: i });
        let l = r.match(/^class\s+(\w+)/);
        l && s.push({ type: "class", name: l[1], line: i });
        let u = r.match(/^(?:from\s+(\S+)\s+)?import\s+(\S+)/);
        u && s.push({ type: "import", name: u[1] || u[2], line: i });
      }
      if (e === ".go") {
        let c = r.match(/^func\s+(?:\([^)]+\)\s+)?(\w+)/);
        c && s.push({ type: "function", name: c[1], line: i });
        let l = r.match(/^type\s+(\w+)\s+struct/);
        l && s.push({ type: "class", name: l[1], line: i });
      }
    }
    return s;
  }
  async function hu(t) {
    t = t || process.cwd();
    let e = Un.join(t, ".nex", "index", "content-index.json"),
      s = {};
    if (vi && Date.now() - du < P$) return vi;
    try {
      let i = await Fn.readFile(e, "utf-8");
      s = JSON.parse(i);
    } catch {
      s = { files: {} };
    }
    Ei().length === 0 && (await pu(t));
    let n = { files: {} },
      r = !1;
    for (let i of Ei()) {
      let c = Un.extname(i);
      if (!I$.has(c)) continue;
      let l = Un.join(t, i);
      try {
        let d = (await Fn.stat(l)).mtimeMs;
        if (s.files[i] && s.files[i].mtime === d) {
          n.files[i] = s.files[i];
          continue;
        }
        let f = await Fn.readFile(l, "utf-8"),
          m = mu(f, c);
        ((n.files[i] = { defs: m, mtime: d }), (r = !0));
      } catch {}
    }
    if (r) {
      let i = Un.join(t, ".nex", "index");
      (await Fn.mkdir(i, { recursive: !0 }),
        await Fn.writeFile(e, JSON.stringify(n), "utf-8"));
    }
    return ((vi = n), (du = Date.now()), n);
  }
  async function L$(t, e) {
    let s = await hu(),
      o = [],
      n = t.toLowerCase();
    for (let [r, i] of Object.entries(s.files))
      for (let c of i.defs)
        (e && c.type !== e) ||
          (c.name.toLowerCase().includes(n) &&
            o.push({ file: r, type: c.type, name: c.name, line: c.line }));
    return (
      o.sort((r, i) => {
        let c = r.name.toLowerCase() === n ? 0 : 1,
          l = i.name.toLowerCase() === n ? 0 : 1;
        if (c !== l) return c - l;
        let u = r.name.toLowerCase().startsWith(n) ? 0 : 1,
          d = i.name.toLowerCase().startsWith(n) ? 0 : 1;
        return u - d;
      }),
      o.slice(0, 50)
    );
  }
  gu.exports = {
    refreshIndex: pu,
    getFileIndex: Ei,
    getIndexedCwd: O$,
    findFileInIndex: N$,
    searchIndex: M$,
    isIndexValid: fu,
    buildContentIndex: hu,
    searchContentIndex: L$,
    extractDefinitions: mu,
  };
});
var Bn = K((Nk, bu) => {
  var Mo = require("fs"),
    Io = require("path"),
    Lo = require("os"),
    { execFile: j$ } = require("child_process"),
    { promisify: D$ } = require("util"),
    Ci = D$(j$),
    q$ = Io.join(Lo.homedir(), ".nex", "servers.json"),
    Po = Io.join(Lo.tmpdir(), "nex-ssh-sockets");
  function F$() {
    return Io.join(process.cwd(), ".nex", "servers.json");
  }
  function $u() {
    let t = (o) => {
        if (!Mo.existsSync(o)) return {};
        try {
          return JSON.parse(Mo.readFileSync(o, "utf-8"));
        } catch {
          return {};
        }
      },
      e = t(q$),
      s = t(F$());
    return { ...e, ...s };
  }
  function U$(t) {
    let e = $u();
    if (e[t]) return { ...e[t], _name: t };
    if (
      /^[\w.-]+@[\w.-]+$/.test(t) ||
      /[\w-]+\.[\w.-]+/.test(t) ||
      t === "localhost"
    ) {
      let [n, r] = t.includes("@") ? t.split("@") : [void 0, t];
      return { host: r, user: n };
    }
    let s = Object.keys(e),
      o = s.length
        ? `Available profiles: ${s.join(", ")}`
        : "No profiles configured. Create .nex/servers.json (project) or ~/.nex/servers.json (global)";
    throw new Error(`Unknown server: "${t}". ${o}`);
  }
  function W$() {
    Mo.existsSync(Po) || Mo.mkdirSync(Po, { recursive: !0 });
  }
  function yu(t) {
    let e = [
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=15",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ServerAliveInterval=30",
    ];
    (t.key && e.push("-i", t.key.replace(/^~/, Lo.homedir())),
      t.port && Number(t.port) !== 22 && e.push("-p", String(t.port)),
      W$());
    let s = t.user ? `${t.user}@${t.host}` : t.host,
      o = Io.join(Po, s.replace(/[@.:]/g, "_"));
    return (
      e.push(
        "-o",
        "ControlMaster=auto",
        "-o",
        `ControlPath=${o}`,
        "-o",
        "ControlPersist=120",
      ),
      e.push(s),
      { args: e, target: s }
    );
  }
  function wu(t) {
    let e = [
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=15",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-r",
    ];
    return (
      t.key && e.push("-i", t.key.replace(/^~/, Lo.homedir())),
      t.port && Number(t.port) !== 22 && e.push("-P", String(t.port)),
      e
    );
  }
  async function B$(t, e, { timeout: s = 3e4, sudo: o = !1 } = {}) {
    let { args: n } = yu(t),
      r = o && t.sudo ? `sudo sh -c ${JSON.stringify(e)}` : e;
    try {
      let { stdout: i, stderr: c } = await Ci("ssh", [...n, r], {
        timeout: s,
        maxBuffer: 4194304,
      });
      return { stdout: i || "", stderr: c || "", exitCode: 0 };
    } catch (i) {
      let c = typeof i.code == "number" ? i.code : 1,
        l = (i.stderr || i.message || "").toString();
      return {
        stdout: (i.stdout || "").toString(),
        stderr: l,
        exitCode: c,
        error: jo(l, t),
      };
    }
  }
  async function H$(t, e, s, { timeout: o = 12e4 } = {}) {
    let n = wu(t),
      r = t.user ? `${t.user}@${t.host}` : t.host;
    n.push(e, `${r}:${s}`);
    try {
      let { stdout: i, stderr: c } = await Ci("scp", n, {
        timeout: o,
        maxBuffer: 1048576,
      });
      return i || c || `Uploaded ${e} \u2192 ${r}:${s}`;
    } catch (i) {
      let c = (i.stderr || i.message || "").toString();
      throw new Error(jo(c, t) || c);
    }
  }
  async function G$(t, e, s, { timeout: o = 12e4 } = {}) {
    let n = wu(t),
      r = t.user ? `${t.user}@${t.host}` : t.host;
    n.push(`${r}:${e}`, s);
    try {
      let { stdout: i, stderr: c } = await Ci("scp", n, {
        timeout: o,
        maxBuffer: 1048576,
      });
      return i || c || `Downloaded ${r}:${e} \u2192 ${s}`;
    } catch (i) {
      let c = (i.stderr || i.message || "").toString();
      throw new Error(jo(c, t) || c);
    }
  }
  function jo(t, e) {
    if (!t) return "";
    if (/connection refused/i.test(t)) {
      let s = e.port || 22;
      return `${t}
HINT: Connection refused on ${e.host}:${s}. Check: server is running, SSH service is active (systemctl status sshd), firewall allows port ${s} (firewall-cmd --list-ports).`;
    }
    if (/permission denied/i.test(t)) {
      let s = e.key ? `key: ${e.key}` : "SSH agent";
      return `${t}
HINT: Auth failed using ${s} as user "${e.user || "root"}". Check: authorized_keys on server, correct username, key passphrase.`;
    }
    return /no route to host|network unreachable|name or service not known/i.test(
      t,
    )
      ? `${t}
HINT: Cannot reach ${e.host}. Check: network connection, correct hostname/IP, DNS resolution.`
      : /host key verification failed/i.test(t)
        ? `${t}
HINT: Host key changed for ${e.host}. To reset: ssh-keygen -R ${e.host}`
        : /timed out/i.test(t)
          ? `${t}
HINT: Connection timed out to ${e.host}. Check firewall rules and network connectivity.`
          : /too many authentication failures/i.test(t)
            ? `${t}
HINT: Too many auth attempts. Add "-o IdentitiesOnly=yes -i ${e.key || "~/.ssh/id_rsa"}" or clear your SSH agent keys.`
            : t;
  }
  function K$(t, e) {
    let s = e.user ? `${e.user}@${e.host}` : e.host,
      o = e.port && Number(e.port) !== 22 ? `:${e.port}` : "",
      n = e.os ? ` [${e.os}]` : "",
      r = e.key ? ` key:${e.key}` : "",
      i = e.sudo ? " sudo:yes" : "";
    return `${t}: ${s}${o}${n}${r}${i}`;
  }
  bu.exports = {
    loadServerProfiles: $u,
    resolveProfile: U$,
    buildSSHArgs: yu,
    sshExec: B$,
    scpUpload: H$,
    scpDownload: G$,
    enrichSSHError: jo,
    formatProfile: K$,
    SSH_SOCKET_DIR: Po,
  };
});
var Ni = K((Mk, xu) => {
  var ms = require("fs"),
    Ai = require("path"),
    Y$ = Ai.join(".nex", "deploy.json");
  function Oi() {
    return Ai.join(process.cwd(), Y$);
  }
  function _u() {
    let t = Oi();
    if (!ms.existsSync(t)) return {};
    try {
      return JSON.parse(ms.readFileSync(t, "utf-8"));
    } catch {
      return {};
    }
  }
  function z$(t) {
    let e = _u();
    if (e[t]) return { ...e[t], _name: t };
    let s = Object.keys(e),
      o = s.length
        ? `Available: ${s.join(", ")}`
        : "No deploy configs found. Create .nex/deploy.json or use explicit params.";
    throw new Error(`Unknown deploy config: "${t}". ${o}`);
  }
  function X$(t) {
    let e = Ai.join(process.cwd(), ".nex");
    (ms.existsSync(e) || ms.mkdirSync(e, { recursive: !0 }),
      ms.writeFileSync(
        Oi(),
        JSON.stringify(t, null, 2) +
          `
`,
        "utf-8",
      ));
  }
  xu.exports = {
    loadDeployConfigs: _u,
    resolveDeployConfig: z$,
    saveDeployConfigs: X$,
    getDeployConfigPath: Oi,
  };
});
var Do = K((Pk, Su) => {
  var { getActiveModel: J$, getActiveProviderName: V$ } = Ae(),
    hs = {
      essential: [
        "bash",
        "read_file",
        "write_file",
        "edit_file",
        "list_directory",
      ],
      standard: [
        "bash",
        "read_file",
        "write_file",
        "edit_file",
        "list_directory",
        "search_files",
        "glob",
        "grep",
        "ask_user",
        "git_status",
        "git_diff",
        "git_log",
        "task_list",
        "ssh_exec",
        "service_manage",
        "service_logs",
        "container_list",
        "container_logs",
        "container_exec",
        "container_manage",
        "deploy",
      ],
      full: null,
    },
    gs = {
      "qwen3-coder:480b": "full",
      "qwen3-coder-next": "full",
      "kimi-k2.5": "full",
      "kimi-k2:1t": "full",
      "kimi-k2-thinking": "full",
      "deepseek-v3.2": "full",
      "deepseek-v3.1:671b": "full",
      "devstral-2:123b": "full",
      "devstral-small-2:24b": "standard",
      "cogito-2.1:671b": "full",
      "qwen3-next:80b": "full",
      "qwen3.5:397b-cloud": "full",
      "qwen3.5:397b": "full",
      "qwen3.5:122b-a10b": "full",
      "qwen3.5:35b-a3b": "full",
      "qwen3.5:27b": "full",
      "qwen3.5:9b": "standard",
      "qwen3.5:4b": "essential",
      "qwen3.5:2b": "essential",
      "qwen3.5:0.8b": "essential",
      "mistral-large-3:675b": "full",
      "gpt-oss:120b": "full",
      "minimax-m2.5": "full",
      "glm-5": "full",
      "glm-4.7": "standard",
      "gemma3:27b": "standard",
      "gemma3:12b": "essential",
      "gemma3:4b": "essential",
      "ministral-3:14b": "standard",
      "ministral-3:8b": "essential",
      "gpt-4o": "full",
      "gpt-4.1": "full",
      o1: "full",
      o3: "full",
      "o4-mini": "full",
      "claude-sonnet": "full",
      "claude-sonnet-4-5": "full",
      "claude-opus": "full",
      "claude-haiku": "standard",
      "claude-sonnet-4": "full",
      "gemini-3.1-pro-preview": "full",
      "gemini-3-flash-preview": "full",
      "gemini-2.5-pro": "full",
      "gemini-2.5-flash": "full",
      "gemini-2.0-flash": "standard",
      "gemini-2.0-flash-lite": "essential",
    },
    $s = {
      ollama: "full",
      openai: "full",
      anthropic: "full",
      gemini: "full",
      local: "essential",
    },
    Mt = {};
  function vu() {
    try {
      let t = require("fs"),
        s = require("path").join(process.cwd(), ".nex", "config.json");
      t.existsSync(s) &&
        (Mt = JSON.parse(t.readFileSync(s, "utf-8")).toolTiers || {});
    } catch {
      Mt = {};
    }
  }
  vu();
  function Mi() {
    let e = J$()?.id,
      s = V$();
    return e && Mt[e]
      ? Mt[e]
      : s && Mt[`${s}:*`]
        ? Mt[`${s}:*`]
        : e && gs[e]
          ? gs[e]
          : s && $s[s]
            ? $s[s]
            : "full";
  }
  var Q$ = new Set([
      "claude-sonnet",
      "claude-sonnet-4-5",
      "claude-sonnet-4",
      "claude-opus",
      "claude-haiku",
      "gpt-4o",
      "gpt-4.1",
      "o1",
      "o3",
      "o4-mini",
      "kimi-k2:1t",
      "kimi-k2.5",
      "kimi-k2-thinking",
      "qwen3-coder:480b",
      "qwen3-coder-next",
      "deepseek-v3.2",
      "deepseek-v3.1:671b",
    ]),
    ku = {
      anthropic: "strict",
      openai: "strict",
      gemini: "strict",
      ollama: "fuzzy",
      local: "fuzzy",
    };
  function Z$(t, e) {
    return t && (Q$.has(t) || t.startsWith("claude-"))
      ? "strict"
      : e && ku[e]
        ? ku[e]
        : "fuzzy";
  }
  function ey(t, e) {
    return t && Mt[t]
      ? Mt[t]
      : e && Mt[`${e}:*`]
        ? Mt[`${e}:*`]
        : t && gs[t]
          ? gs[t]
          : e && $s[e]
            ? $s[e]
            : "full";
  }
  function ty(t, e) {
    let s = e || Mi();
    if (s === "full" || !hs[s]) return t;
    let o = new Set(hs[s]);
    return t.filter((n) => o.has(n.function.name));
  }
  function ny() {
    let t = Mi(),
      e = hs[t] ? hs[t].length : "all";
    return { tier: t, toolCount: e };
  }
  Su.exports = {
    filterToolsForModel: ty,
    getActiveTier: Mi,
    getModelTier: ey,
    getEditMode: Z$,
    getTierInfo: ny,
    TIERS: hs,
    MODEL_TIERS: gs,
    PROVIDER_DEFAULT_TIER: $s,
    loadConfigOverrides: vu,
  };
});
var ws = K((Ik, Ru) => {
  var Pi = null,
    Wt = null,
    ys = null,
    Eu = `Playwright is not installed. Install with:
  npm install playwright && npx playwright install chromium
Then restart nex-code.`;
  function Tu() {
    if (ys !== null) return ys;
    try {
      (require("playwright"), (ys = !0));
    } catch {
      ys = !1;
    }
    return ys;
  }
  async function qo() {
    if (!Tu()) throw new Error(Eu);
    return (
      Pi || (Pi = require("playwright")),
      (!Wt || !Wt.isConnected()) &&
        (Wt = await Pi.chromium.launch({ headless: !0 })),
      Wt
    );
  }
  async function sy() {
    if (Wt) {
      try {
        await Wt.close();
      } catch {}
      Wt = null;
    }
  }
  process.on("exit", () => {
    if (Wt)
      try {
        Wt.close();
      } catch {}
  });
  async function oy(
    t,
    { timeout: e = 3e4, waitFor: s = "domcontentloaded" } = {},
  ) {
    let n = await (await qo()).newPage();
    try {
      await n.goto(t, { waitUntil: s, timeout: e });
      let r = await n.title(),
        i = await n.evaluate(
          () => (
            document
              .querySelectorAll(
                "script,style,nav,footer,header,aside,[role=navigation]",
              )
              .forEach((u) => u.remove()),
            document.body?.innerText || ""
          ),
        ),
        c = await n.evaluate(() =>
          Array.from(document.querySelectorAll("a[href]"))
            .slice(0, 30)
            .map((l) => ({
              text: (l.innerText || l.textContent || "")
                .trim()
                .substring(0, 80),
              href: l.href,
            }))
            .filter(
              (l) => l.text && l.href && !l.href.startsWith("javascript:"),
            ),
        );
      return {
        title: r,
        url: n.url(),
        text:
          i.substring(0, 8e3) +
          (i.length > 8e3
            ? `
...(truncated)`
            : ""),
        links: c.slice(0, 20),
      };
    } finally {
      await n.close();
    }
  }
  async function ry(
    t,
    {
      width: e = 1280,
      height: s = 800,
      fullPage: o = !1,
      timeout: n = 3e4,
    } = {},
  ) {
    let i = await (await qo()).newPage();
    try {
      (await i.setViewportSize({ width: e, height: s }),
        await i.goto(t, { waitUntil: "networkidle", timeout: n }));
      let c = await i.screenshot({ type: "png", fullPage: o }),
        l = require("os"),
        u = require("path"),
        d = require("fs"),
        f = u.join(l.tmpdir(), `nex-screenshot-${Date.now()}.png`);
      return (
        d.writeFileSync(f, c),
        {
          path: f,
          base64: c.toString("base64"),
          media_type: "image/png",
          title: await i.title(),
          url: i.url(),
        }
      );
    } finally {
      await i.close();
    }
  }
  async function iy(t, { selector: e, text: s, timeout: o = 3e4 } = {}) {
    if (!e && !s) throw new Error("selector or text is required");
    let r = await (await qo()).newPage();
    try {
      (await r.goto(t, { waitUntil: "domcontentloaded", timeout: o }),
        s
          ? await r.getByText(s, { exact: !1 }).first().click({ timeout: 1e4 })
          : await r.locator(e).first().click({ timeout: 1e4 }),
        await r.waitForLoadState("domcontentloaded"));
      let i = await r.title();
      return `Clicked \u2014 now at: ${r.url()} (${i})`;
    } finally {
      await r.close();
    }
  }
  async function ay(
    t,
    { selector: e, value: s, submit: o = !1, timeout: n = 3e4 } = {},
  ) {
    if (!e || s === void 0) throw new Error("selector and value are required");
    let i = await (await qo()).newPage();
    try {
      return (
        await i.goto(t, { waitUntil: "domcontentloaded", timeout: n }),
        await i.fill(e, String(s)),
        o &&
          (await i.keyboard.press("Enter"),
          await i.waitForLoadState("domcontentloaded")),
        `Filled "${e}" with value. ${o ? `Submitted \u2192 ${i.url()}` : "Not submitted."}`
      );
    } finally {
      await i.close();
    }
  }
  Ru.exports = {
    isPlaywrightAvailable: Tu,
    browserNavigate: oy,
    browserScreenshot: ry,
    browserClick: iy,
    browserFill: ay,
    closeBrowser: sy,
    INSTALL_MSG: Eu,
  };
});
var Fo = K((Lk, Cu) => {
  var { C: Ee } = Ce(),
    _s = "",
    Ve = [],
    bs = 0,
    $n = null;
  function cy(t) {
    $n = t;
  }
  function ly(t, e) {
    ((_s = t), (Ve = []), (bs = 0));
    for (let o of e) {
      bs++;
      let n = `t${bs}`;
      Ve.push({
        id: n,
        description:
          o.description || o.title || o.name || o.task || `Task ${bs}`,
        status: "pending",
        dependsOn: o.depends_on || [],
        result: null,
      });
    }
    let s = Ve.map((o) => ({ ...o }));
    return ($n && $n("create", { name: t, tasks: s }), s);
  }
  function uy(t, e, s) {
    let o = Ve.find((n) => n.id === t);
    return o
      ? ((o.status = e),
        s !== void 0 && (o.result = s),
        $n && $n("update", { id: t, status: e, result: s }),
        { ...o })
      : null;
  }
  function dy() {
    return { name: _s, tasks: Ve.map((t) => ({ ...t })) };
  }
  function fy() {
    ((_s = ""), (Ve = []), (bs = 0), $n && $n("clear", {}));
  }
  function py() {
    return Ve.filter((t) =>
      t.status !== "pending"
        ? !1
        : t.dependsOn.length === 0
          ? !0
          : t.dependsOn.every((e) => {
              let s = Ve.find((o) => o.id === e);
              return s && s.status === "done";
            }),
    );
  }
  function my() {
    if (Ve.length === 0) return `${Ee.dim}No active tasks${Ee.reset}`;
    let t = [];
    _s &&
      (t.push(`  ${Ee.bold}${Ee.cyan}Tasks: ${_s}${Ee.reset}`),
      t.push(`  ${Ee.dim}${"\u2500".repeat(40)}${Ee.reset}`));
    for (let n of Ve) {
      let r, i;
      switch (n.status) {
        case "done":
          ((r = "\u2713"), (i = Ee.green));
          break;
        case "in_progress":
          ((r = "\u2192"), (i = Ee.cyan));
          break;
        case "failed":
          ((r = "\u2717"), (i = Ee.red));
          break;
        default:
          ((r = "\xB7"), (i = Ee.dim));
      }
      let c =
          n.dependsOn.length > 0
            ? ` ${Ee.dim}(after: ${n.dependsOn.join(", ")})${Ee.reset}`
            : "",
        l = `[${n.status}]`,
        u =
          n.description.length > 50
            ? n.description.substring(0, 47) + "..."
            : n.description;
      if (
        (t.push(
          `  ${i}${r}${Ee.reset} ${Ee.bold}${n.id}${Ee.reset}  ${u.padEnd(40)} ${i}${l}${Ee.reset}${c}`,
        ),
        n.result && n.status === "done")
      ) {
        let d =
          n.result.length > 60 ? n.result.substring(0, 57) + "..." : n.result;
        t.push(`       ${Ee.dim}\u2192 ${d}${Ee.reset}`);
      }
    }
    let e = Ve.filter((n) => n.status === "done").length,
      s = Ve.filter((n) => n.status === "failed").length,
      o = Ve.length;
    return (
      t.push(`  ${Ee.dim}${"\u2500".repeat(40)}${Ee.reset}`),
      t.push(
        `  ${Ee.dim}${e}/${o} done${s > 0 ? `, ${s} failed` : ""}${Ee.reset}`,
      ),
      t.join(`
`)
    );
  }
  function hy() {
    return (
      Ve.length > 0 &&
      Ve.some((t) => t.status === "pending" || t.status === "in_progress")
    );
  }
  Cu.exports = {
    createTasks: ly,
    updateTask: uy,
    getTaskList: dy,
    clearTasks: fy,
    getReadyTasks: py,
    renderTaskList: my,
    setOnChange: cy,
    hasActiveTasks: hy,
  };
});
var Ho = K((Dk, Ku) => {
  var {
      callStream: gy,
      getActiveProviderName: Wo,
      getActiveModelId: $y,
      getConfiguredProviders: yy,
      getProvider: Au,
      getActiveProvider: Ou,
      parseModelSpec: Nu,
    } = Ae(),
    { parseToolArgs: Mu } = Dn(),
    { filterToolsForModel: wy, getModelTier: Uo } = Do(),
    { trackUsage: by } = jn(),
    { MultiProgress: _y, C: jk } = Ce(),
    Lu = 15,
    xy = 5,
    Pu = 3,
    ju = 8,
    ky = 2,
    Bo = new Map(),
    Du = 600 * 1e3;
  function vy(t, e) {
    let s = Bo.get(t);
    return s && s.agentId !== e && Date.now() - s.timestamp < Du
      ? !1
      : (Bo.set(t, { agentId: e, timestamp: Date.now() }), !0);
  }
  function xs(t) {
    Bo.delete(t);
  }
  function Ii() {
    Bo.clear();
  }
  function qu(t) {
    let e = t.message || "",
      s = t.code || "";
    return !!(
      e.includes("429") ||
      e.includes("500") ||
      e.includes("502") ||
      e.includes("503") ||
      e.includes("504") ||
      s === "ECONNRESET" ||
      s === "ECONNABORTED" ||
      s === "ETIMEDOUT" ||
      s === "ECONNREFUSED" ||
      e.includes("socket disconnected") ||
      e.includes("TLS") ||
      e.includes("ECONNRESET") ||
      e.includes("fetch failed") ||
      e.includes("ETIMEDOUT") ||
      e.includes("ENOTFOUND")
    );
  }
  async function Fu(t, e, s) {
    let o;
    for (let n = 0; n <= Pu; n++)
      try {
        return await gy(t, e, s);
      } catch (r) {
        if (((o = r), n < Pu && qu(r))) {
          let c = (r.message || "").includes("429")
            ? Math.min(2e3 * Math.pow(2, n), 15e3)
            : Math.min(500 * Math.pow(2, n), 4e3);
          await new Promise((l) => setTimeout(l, c).unref());
          continue;
        }
        throw r;
      }
    throw o;
  }
  var Iu = new Set(["ask_user", "task_list"]);
  function Uu(t) {
    return t >= 2 ? new Set([...Iu, "spawn_agents"]) : Iu;
  }
  var Sy = new Set(["write_file", "edit_file", "patch_file"]),
    Ey = /\b(read|summarize|search|find|list|check|count|inspect|scan)\b/i,
    Ty =
      /\b(refactor|rewrite|implement|create|architect|design|generate|migrate)\b/i;
  function Wu(t) {
    return Ty.test(t) ? "full" : Ey.test(t) ? "essential" : "standard";
  }
  function Bu(t) {
    let e = yy(),
      s = Wo(),
      o = [...e].sort(
        (n, r) => (n.name === s ? -1 : 1) - (r.name === s ? -1 : 1),
      );
    for (let n of o)
      for (let r of n.models)
        if (Uo(r.id, n.name) === t) return { provider: n.name, model: r.id };
    return null;
  }
  var Ry = {
    essential: process.env.NEX_FAST_MODEL || null,
    standard: process.env.NEX_STANDARD_MODEL || null,
    full: process.env.NEX_HEAVY_MODEL || null,
  };
  function Li(t) {
    if (t.model) {
      let { provider: n, model: r } = Nu(t.model),
        i = n ? Au(n) : Ou(),
        c = n || Wo();
      if (i && i.isConfigured() && (i.getModel(r) || c === "local")) {
        let l = Uo(r, c);
        return { provider: c, model: r, tier: l };
      }
    }
    let e = Wu(t.task),
      s = Ry[e];
    if (s) {
      let { provider: n, model: r } = Nu(s),
        i = n ? Au(n) : Ou(),
        c = n || Wo();
      if (i && i.isConfigured() && (i.getModel(r) || c === "local")) {
        let l = Uo(r, c);
        return { provider: c, model: r, tier: l };
      }
    }
    let o = Bu(e);
    if (o) {
      let n = Uo(o.model, o.provider);
      return { provider: o.provider, model: o.model, tier: n };
    }
    return { provider: null, model: null, tier: null };
  }
  async function Hu(t, e = {}, s = 0) {
    let o = s === 0 ? Lu : ju,
      n = Math.min(t.max_iterations || 10, o),
      r = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      i = [],
      c = { input: 0, output: 0 },
      l = new Set(),
      u = new Map(),
      f = [
        {
          role: "system",
          content: `You are a focused sub-agent. Complete this specific task efficiently.

TASK: ${t.task}
${
  t.context
    ? `
CONTEXT: ${t.context}`
    : ""
}

WORKING DIRECTORY: ${process.cwd()}

RULES:
- Focus only on your assigned task. Be concise and efficient.
- When done, respond with a clear summary of what you did and the result.
- Do not ask questions \u2014 make reasonable decisions.
- Use relative paths when possible.

TOOL STRATEGY:
- Use read_file to read files (not bash cat). Use edit_file/patch_file to modify (not bash sed).
- Use glob to find files by name. Use grep to search contents. Only use bash for shell operations.
- ALWAYS read a file with read_file before editing it. edit_file old_text must match exactly.

ERROR RECOVERY:
- If edit_file fails with "old_text not found": read the file again, compare, and retry with exact text.
- If bash fails: read the error, fix the root cause, then retry.
- After 2 failed attempts at the same operation, summarize the issue and stop.`,
        },
      ];
    f.push({ role: "user", content: t.task });
    let m = Li(t),
      h = m.provider,
      p = m.model,
      g = m.tier,
      { TOOL_DEFINITIONS: $, executeTool: w } = St(),
      _ = Uu(s),
      x = wy(
        $.filter((b) => !_.has(b.function.name)),
        g,
      );
    if (p && !t._skipLog) {
      let b = g ? ` (${g})` : "";
      process.stderr.write(`  [sub-agent: ${h}:${p}${b}]
`);
    }
    let v = {};
    (h && (v.provider = h), p && (v.model = p));
    try {
      for (let k = 0; k < n; k++) {
        let A = await Fu(f, x, v);
        if (!A || typeof A != "object")
          throw new Error("Empty or invalid response from provider");
        if (A.usage) {
          let fe = A.usage.prompt_tokens || 0,
            G = A.usage.completion_tokens || 0;
          ((c.input += fe), (c.output += G));
          let z = h || Wo(),
            ne = p || $y();
          by(z, ne, fe, G);
        }
        let O = A.content || "",
          P = A.tool_calls,
          W = { role: "assistant", content: O || "" };
        if (
          (P && P.length > 0 && (W.tool_calls = P),
          f.push(W),
          !P || P.length === 0)
        ) {
          for (let fe of l) xs(fe);
          return {
            task: t.task,
            status: "done",
            result: O || "(no response)",
            toolsUsed: i,
            tokensUsed: c,
            modelSpec: h && p ? `${h}:${p}` : null,
          };
        }
        let Le = P.map((fe) => {
            let G = fe.function.name,
              z = Mu(fe.function.arguments),
              ne =
                fe.id ||
                `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            if (!z)
              return Promise.resolve({
                role: "tool",
                content: `ERROR: Malformed tool arguments for ${G}`,
                tool_call_id: ne,
              });
            let ae = null;
            if (Sy.has(G) && z.path) {
              let L = require("path"),
                Z = L.isAbsolute(z.path)
                  ? z.path
                  : L.resolve(process.cwd(), z.path);
              if (l.has(Z) || !vy(Z, r))
                return Promise.resolve({
                  role: "tool",
                  content: `ERROR: File '${z.path}' is locked by another operation. Try a different approach or skip this file.`,
                  tool_call_id: ne,
                });
              (l.add(Z), (ae = Z));
            }
            return (
              i.push(G),
              (G === "spawn_agents"
                ? Gu(z, s + 1)
                : w(G, z, { autoConfirm: !0, silent: !0 })
              )
                .then((L) => {
                  ae && (xs(ae), l.delete(ae));
                  let Z = String(L ?? "");
                  return {
                    role: "tool",
                    content:
                      Z.length > 2e4
                        ? Z.substring(0, 2e4) +
                          `
...(truncated)`
                        : Z,
                    tool_call_id: ne,
                  };
                })
                .catch(
                  (L) => (
                    ae && (xs(ae), l.delete(ae)),
                    {
                      role: "tool",
                      content: `ERROR: ${L.message}`,
                      tool_call_id: ne,
                    }
                  ),
                )
            );
          }),
          we = await Promise.all(Le);
        f.push(...we);
        for (let fe = 0; fe < P.length; fe++) {
          let G = P[fe];
          if (G.function.name === "bash_exec") {
            let z = Mu(G.function.arguments);
            if ((we[fe]?.content || "").startsWith("ERROR") && z && z.command) {
              let ae = z.command.replace(/\s+/g, " ").trim().slice(0, 100);
              u.set(ae, (u.get(ae) || 0) + 1);
            }
          }
        }
        e.onUpdate && e.onUpdate(`step ${k + 1}/${n}`);
      }
      for (let k of l) xs(k);
      let b = [...u.entries()]
        .filter(([, k]) => k >= 3)
        .sort((k, A) => A[1] - k[1])
        .slice(0, 3)
        .map(([k, A]) => `"${k}" (failed ${A}\xD7)`);
      return {
        task: t.task,
        status: "truncated",
        abortReason: "iteration_limit",
        repeatedFailures: b,
        result: f[f.length - 1]?.content || "(max iterations reached)",
        toolsUsed: i,
        tokensUsed: c,
        modelSpec: h && p ? `${h}:${p}` : null,
      };
    } catch (b) {
      for (let k of l) xs(k);
      return {
        task: t.task,
        status: "failed",
        result: `Error: ${b.message}`,
        toolsUsed: i,
        tokensUsed: c,
        modelSpec: h && p ? `${h}:${p}` : null,
      };
    }
  }
  async function Gu(t, e = 0) {
    if (e >= 2)
      return "ERROR: max agent nesting depth (2) reached \u2014 reviewer agents cannot spawn further agents.";
    let s = e === 0 ? xy : ky,
      o = e === 0 ? Lu : ju,
      n = (t.agents || []).slice(0, s);
    if (n.length === 0) return "ERROR: No agents specified";
    let r = e > 0 ? "  \u21B3 " : "",
      i = e > 0 ? 38 : 44,
      c = n.map((d) => Li(d)),
      l = n.map((d, f) => {
        let m = c[f],
          h = m.model ? ` [${m.model}]` : "",
          p = d.task.substring(0, i - h.length);
        return `${r}Agent ${f + 1}${h}: ${p}${d.task.length > p.length ? "..." : ""}`;
      }),
      u = new _y(l);
    u.start();
    try {
      let d = n.map((g, $) => {
          let w = c[$],
            _ = Math.min(g.max_iterations || o, o),
            x = w.model
              ? {
                  ...g,
                  model: `${w.provider}:${w.model}`,
                  _skipLog: !0,
                  max_iterations: _,
                }
              : { ...g, _skipLog: !0, max_iterations: _ };
          return Hu(x, { onUpdate: () => {} }, e)
            .then(
              (v) => (u.update($, v.status === "failed" ? "error" : "done"), v),
            )
            .catch(
              (v) => (
                u.update($, "error"),
                {
                  task: g.task,
                  status: "failed",
                  result: `Error: ${v.message}`,
                  toolsUsed: [],
                  tokensUsed: { input: 0, output: 0 },
                }
              ),
            );
        }),
        f = await Promise.all(d);
      (u.stop(), Ii());
      let m = ["Sub-agent results:", ""],
        h = 0,
        p = 0;
      for (let g = 0; g < f.length; g++) {
        let $ = f[g],
          w =
            $.status === "done"
              ? "\u2713"
              : $.status === "truncated"
                ? "\u26A0"
                : "\u2717",
          _ = $.modelSpec ? ` [${$.modelSpec}]` : "";
        (m.push(`${w} Agent ${g + 1}${_}: ${$.task}`),
          m.push(`  Status: ${$.status}`),
          m.push(
            `  Tools used: ${$.toolsUsed.length > 0 ? $.toolsUsed.join(", ") : "none"}`,
          ),
          m.push(`  Result: ${$.result}`),
          $.repeatedFailures &&
            $.repeatedFailures.length > 0 &&
            m.push(`  Repeated failures: ${$.repeatedFailures.join("; ")}`),
          m.push(""),
          (h += $.tokensUsed.input),
          (p += $.tokensUsed.output));
      }
      return (
        m.push(`Total sub-agent tokens: ${h} input + ${p} output`),
        m.join(`
`)
      );
    } catch (d) {
      return (
        u.stop(),
        Ii(),
        `ERROR: Sub-agent execution failed: ${d.message}`
      );
    }
  }
  Ku.exports = {
    runSubAgent: Hu,
    executeSpawnAgents: Gu,
    clearAllLocks: Ii,
    classifyTask: Wu,
    pickModelForTier: Bu,
    resolveSubAgentModel: Li,
    isRetryableError: qu,
    callWithRetry: Fu,
    getExcludedTools: Uu,
    LOCK_TIMEOUT_MS: Du,
  };
});
var Ss = K((qk, id) => {
  var Pe = require("fs"),
    Bt = require("path"),
    { atomicWrite: Yu, withFileLockSync: zu } = Qt(),
    Cy = new Set([
      "the",
      "a",
      "an",
      "is",
      "are",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "this",
      "that",
      "it",
      "as",
      "be",
      "by",
      "from",
      "was",
      "were",
      "has",
      "have",
      "had",
      "not",
      "do",
      "does",
      "did",
      "so",
      "if",
      "its",
      "my",
      "me",
      "we",
      "you",
      "he",
      "she",
      "they",
      "our",
      "your",
      "their",
      "can",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "then",
      "than",
      "also",
      "which",
      "when",
      "where",
      "how",
      "what",
      "who",
      "all",
      "any",
      "each",
      "more",
      "most",
      "use",
      "used",
      "using",
      "get",
      "set",
      "new",
      "add",
      "make",
      "der",
      "die",
      "das",
      "den",
      "dem",
      "des",
      "ein",
      "eine",
      "einen",
      "einem",
      "eines",
      "und",
      "oder",
      "aber",
      "von",
      "zu",
      "mit",
      "auf",
      "bei",
      "nach",
      "aus",
      "vor",
      "ist",
      "sind",
      "war",
      "hat",
      "haben",
      "wird",
      "kann",
      "soll",
      "muss",
      "nicht",
      "auch",
      "als",
      "durch",
    ]);
  function Hn() {
    let t = Bt.join(process.cwd(), ".nex", "brain");
    return (Pe.existsSync(t) || Pe.mkdirSync(t, { recursive: !0 }), t);
  }
  function Ko() {
    return Bt.join(Hn(), ".brain-index.json");
  }
  function qi() {
    return Bt.join(Hn(), ".embeddings.json");
  }
  function ks() {
    let t = Bt.join(process.cwd(), ".nex", "brain");
    if (!Pe.existsSync(t)) return [];
    try {
      return Pe.readdirSync(t)
        .filter((e) => e.endsWith(".md") && !e.startsWith("."))
        .map((e) => {
          let s = Bt.join(t, e),
            o = Pe.statSync(s);
          return {
            name: e.replace(/\.md$/, ""),
            path: s,
            size: o.size,
            modified: new Date(o.mtimeMs),
          };
        })
        .sort((e, s) => s.modified - e.modified);
    } catch {
      return [];
    }
  }
  function vs(t) {
    let e = {},
      s = t,
      o = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (o) {
      let n = o[1].split(`
`);
      for (let r of n) {
        let i = r.match(/^(\w+):\s*(.+)$/);
        if (!i) continue;
        let c = i[1].trim(),
          l = i[2].trim();
        l.startsWith("[") && l.endsWith("]")
          ? (e[c] = l
              .slice(1, -1)
              .split(",")
              .map((u) => u.trim())
              .filter(Boolean))
          : (e[c] = l);
      }
      s = o[2];
    }
    return { frontmatter: e, body: s };
  }
  function Xu(t) {
    let e = Bt.join(Hn(), `${t}.md`);
    if (!Pe.existsSync(e))
      return { name: t, content: "", body: "", frontmatter: {} };
    let s = Pe.readFileSync(e, "utf-8"),
      { frontmatter: o, body: n } = vs(s);
    return { name: t, content: s, body: n, frontmatter: o };
  }
  function Ay(t, e) {
    let s = Bt.join(Hn(), `${t}.md`);
    (Yu(s, e), My(t, e), Oy());
  }
  function Oy() {
    if (process.env.NEX_BRAIN_EMBEDDINGS === "false") return;
    let t = qi();
    Pe.existsSync(t) &&
      setImmediate(async () => {
        try {
          await nd();
        } catch {}
      });
  }
  function Ny(t) {
    let e = Bt.join(Hn(), `${t}.md`);
    return Pe.existsSync(e) ? (Pe.unlinkSync(e), Py(t), !0) : !1;
  }
  function Go(t) {
    return t
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((e) => e.length > 2 && !Cy.has(e));
  }
  function Fi(t) {
    let e = {},
      { frontmatter: s, body: o } = vs(t),
      n = Array.isArray(s.tags) ? s.tags : [];
    for (let i of n) {
      let c = i.toLowerCase().replace(/[^a-z0-9-]/g, "");
      c.length > 1 && (e[c] = (e[c] || 0) + 5);
    }
    let r = (o || t).split(`
`);
    for (let i of r)
      if (i.startsWith("#")) {
        let c = i.replace(/^#+\s*/, "");
        for (let l of Go(c)) e[l] = (e[l] || 0) + 3;
      }
    for (let i of Go(o || t)) e[i] = (e[i] || 0) + 1;
    return e;
  }
  function Ui() {
    let t = Ko();
    if (!Pe.existsSync(t)) return { documents: {} };
    try {
      return JSON.parse(Pe.readFileSync(t, "utf-8"));
    } catch {
      return { documents: {} };
    }
  }
  function Wi(t) {
    Yu(Ko(), JSON.stringify(t, null, 2));
  }
  function My(t, e) {
    zu(Ko(), () => {
      let s = Ui(),
        { frontmatter: o } = vs(e),
        n = Array.isArray(o.tags) ? o.tags : [];
      ((s.documents[t] = {
        keywords: Fi(e),
        tags: n,
        modified: new Date().toISOString(),
      }),
        Wi(s));
    });
  }
  function Py(t) {
    zu(Ko(), () => {
      let e = Ui();
      (delete e.documents[t], Wi(e));
    });
  }
  function Di() {
    let t = ks(),
      e = { documents: {} };
    for (let s of t) {
      let o = Pe.readFileSync(s.path, "utf-8"),
        { frontmatter: n } = vs(o),
        r = Array.isArray(n.tags) ? n.tags : [];
      e.documents[s.name] = {
        keywords: Fi(o),
        tags: r,
        modified: s.modified.toISOString(),
      };
    }
    return (Wi(e), e);
  }
  function Ju() {
    let t = Ui(),
      e = ks();
    for (let s of e) {
      let o = t.documents[s.name];
      if (!o || new Date(o.modified) < s.modified) return Di();
    }
    for (let s of Object.keys(t.documents))
      if (!e.some((o) => o.name === s)) return Di();
    return t;
  }
  function Vu(t, e = {}) {
    let { topK: s = 3, minScore: o = 0.1 } = e,
      n = Go(t);
    if (n.length === 0) return [];
    let r = Ju(),
      i = [];
    for (let [c, l] of Object.entries(r.documents)) {
      let u = 0;
      for (let d of n) {
        l.keywords[d] && (u += l.keywords[d]);
        for (let [f, m] of Object.entries(l.keywords))
          f !== d &&
            f.length > 3 &&
            d.length > 3 &&
            (f.includes(d) || d.includes(f)) &&
            (u += m * 0.3);
      }
      u >= o && i.push({ name: c, score: u });
    }
    return (i.sort((c, l) => l.score - c.score), i.slice(0, s));
  }
  var Qu = process.env.NEX_EMBED_MODEL || "nomic-embed-text",
    ji = 400,
    Iy = 50;
  async function Zu() {
    if (process.env.NEX_BRAIN_EMBEDDINGS === "false") return !1;
    try {
      let t = process.env.OLLAMA_HOST || "http://localhost:11434",
        e = require("http"),
        s = require("https"),
        o = new URL(`${t}/api/tags`),
        n = o.protocol === "https:" ? s : e;
      return (
        (
          await new Promise((c, l) => {
            let u = n.get(o.toString(), { timeout: 2e3 }, (d) => {
              let f = "";
              (d.on("data", (m) => (f += m)),
                d.on("end", () => {
                  try {
                    c(JSON.parse(f));
                  } catch {
                    l(new Error("bad json"));
                  }
                }));
            });
            (u.on("error", l),
              u.on("timeout", () => {
                (u.destroy(), l(new Error("timeout")));
              }));
          })
        ).models || []
      )
        .map((c) => c.name)
        .some((c) => c.startsWith(Qu.split(":")[0]));
    } catch {
      return !1;
    }
  }
  async function Bi(t) {
    let e = process.env.OLLAMA_HOST || "http://localhost:11434",
      s = require("http"),
      o = require("https"),
      n = new URL(`${e}/api/embeddings`),
      r = n.protocol === "https:" ? o : s,
      i = JSON.stringify({ model: Qu, prompt: t });
    return new Promise((c, l) => {
      let u = r.request(
        n,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(i),
          },
          timeout: 3e4,
        },
        (d) => {
          let f = "";
          (d.on("data", (m) => (f += m)),
            d.on("end", () => {
              try {
                c(JSON.parse(f).embedding || []);
              } catch (m) {
                l(m);
              }
            }));
        },
      );
      (u.on("error", l),
        u.on("timeout", () => {
          (u.destroy(), l(new Error("embedding timeout")));
        }),
        u.write(i),
        u.end());
    });
  }
  function ed(t, e) {
    if (!t || !e || t.length !== e.length) return 0;
    let s = 0,
      o = 0,
      n = 0;
    for (let i = 0; i < t.length; i++)
      ((s += t[i] * e[i]), (o += t[i] * t[i]), (n += e[i] * e[i]));
    let r = Math.sqrt(o) * Math.sqrt(n);
    return r === 0 ? 0 : s / r;
  }
  function td(t) {
    let e = t.split(/\s+/),
      s = [],
      o = 0;
    for (; o < e.length; ) {
      let n = e.slice(o, o + ji).join(" ");
      if ((s.push({ text: n, offset: o }), o + ji >= e.length)) break;
      o += ji - Iy;
    }
    return s;
  }
  async function nd() {
    let t = ks(),
      e = { documents: {} },
      s = qi();
    if (Pe.existsSync(s))
      try {
        e = JSON.parse(Pe.readFileSync(s, "utf-8"));
      } catch {}
    for (let o of t) {
      let n = e.documents[o.name];
      if (n && new Date(n.modified) >= o.modified) continue;
      let r = Pe.readFileSync(o.path, "utf-8"),
        i = td(r),
        c = [];
      for (let l of i) {
        let u = await Bi(l.text);
        c.push({ text: l.text, embedding: u, offset: l.offset });
      }
      e.documents[o.name] = { chunks: c, modified: o.modified.toISOString() };
    }
    for (let o of Object.keys(e.documents))
      t.some((n) => n.name === o) || delete e.documents[o];
    return (Pe.writeFileSync(s, JSON.stringify(e), "utf-8"), e);
  }
  async function sd(t, e = {}) {
    let { topK: s = 3, minSimilarity: o = 0.3 } = e,
      n = qi();
    if (!Pe.existsSync(n)) return [];
    let r;
    try {
      r = JSON.parse(Pe.readFileSync(n, "utf-8"));
    } catch {
      return [];
    }
    let i = await Bi(t),
      c = [];
    for (let [l, u] of Object.entries(r.documents || {})) {
      let d = 0,
        f = "";
      for (let m of u.chunks || []) {
        let h = ed(i, m.embedding);
        h > d && ((d = h), (f = m.text));
      }
      d >= o && c.push({ name: l, score: d, bestChunk: f });
    }
    return (c.sort((l, u) => u.score - l.score), c.slice(0, s));
  }
  function od(t, e, s = {}) {
    let { k: o = 60, topK: n = 3 } = s,
      r = {};
    return (
      t.forEach((i, c) => {
        r[i.name] = (r[i.name] || 0) + 1 / (o + c + 1);
      }),
      e.forEach((i, c) => {
        r[i.name] = (r[i.name] || 0) + 1 / (o + c + 1);
      }),
      Object.entries(r)
        .map(([i, c]) => ({ name: i, score: c }))
        .sort((i, c) => c.score - i.score)
        .slice(0, n)
    );
  }
  async function rd(t, e = {}) {
    let { topK: s = 3, minScore: o = 0.1 } = e,
      n = Vu(t, { topK: s, minScore: o }),
      r = n;
    if (process.env.NEX_BRAIN_EMBEDDINGS !== "false")
      try {
        if (await Zu()) {
          let c = await sd(t, { topK: s });
          r = od(n, c, { topK: s });
        }
      } catch {}
    return r.map((i) => {
      let c = Xu(i.name),
        l =
          (c.body || c.content || "").slice(0, 300).replace(/\n+/g, " ") +
          "...";
      return { name: i.name, score: i.score, content: c.content, excerpt: l };
    });
  }
  async function Ly(t) {
    if (!t || !t.trim()) return "";
    let e = Bt.join(process.cwd(), ".nex", "brain");
    if (!Pe.existsSync(e) || ks().length === 0) return "";
    let o;
    try {
      o = await rd(t, { topK: 3 });
    } catch {
      return "";
    }
    if (!o || o.length === 0) return "";
    let n;
    try {
      n = Je().estimateTokens;
    } catch {
      n = (l) => Math.ceil(l.length / 4);
    }
    let r = 25e3,
      i = [],
      c = 0;
    for (let l of o) {
      let u = l.content || "",
        d = n(u);
      if (c + d > r) {
        let m = r - c;
        if (m < 100) break;
        let h = m / d;
        u =
          u.slice(0, Math.floor(u.length * h)) +
          `
...(truncated)`;
      }
      let f = typeof l.score == "number" ? l.score.toFixed(2) : String(l.score);
      if (
        (i.push(`--- ${l.name} (relevance: ${f}) ---
${u}`),
        (c += n(u)),
        c >= r)
      )
        break;
    }
    return i.length === 0
      ? ""
      : `KNOWLEDGE BASE (auto-selected):

${i.join(`

`)}`;
  }
  id.exports = {
    getBrainDir: Hn,
    listDocuments: ks,
    readDocument: Xu,
    writeDocument: Ay,
    removeDocument: Ny,
    buildIndex: Di,
    getIndex: Ju,
    query: rd,
    getBrainContext: Ly,
    isEmbeddingAvailable: Zu,
    generateEmbedding: Bi,
    buildEmbeddingIndex: nd,
    semanticQuery: sd,
    cosineSimilarity: ed,
    _keywordQuery: Vu,
    _extractKeywords: Fi,
    _chunkText: td,
    parseFrontmatter: vs,
    tokenize: Go,
    _fuseResults: od,
  };
});
var Ki = K((Fk, dd) => {
  var Es = require("fs"),
    Hi = require("path"),
    Gi = process.env.NEX_AUDIT !== "false",
    yn = null;
  function ad() {
    return (
      yn ||
      ((yn = Hi.join(process.cwd(), ".nex", "audit")),
      Es.existsSync(yn) || Es.mkdirSync(yn, { recursive: !0 }),
      yn)
    );
  }
  function cd() {
    let t = new Date().toISOString().split("T")[0];
    return Hi.join(ad(), `${t}.jsonl`);
  }
  function jy(t) {
    if (Gi)
      try {
        let e = {
            timestamp: new Date().toISOString(),
            tool: t.tool,
            args: ld(t.args),
            resultLength: typeof t.result == "string" ? t.result.length : 0,
            resultPreview:
              typeof t.result == "string" ? t.result.substring(0, 200) : "",
            duration: t.duration || 0,
            success: t.success !== !1,
            model: t.model || null,
            provider: t.provider || null,
          },
          s =
            JSON.stringify(e) +
            `
`;
        Es.appendFileSync(cd(), s, "utf-8");
      } catch {}
  }
  function ld(t) {
    if (!t || typeof t != "object") return {};
    let e = {};
    for (let [s, o] of Object.entries(t))
      /key|token|password|secret|credential/i.test(s)
        ? (e[s] = "***")
        : typeof o == "string" && o.length > 500
          ? (e[s] = o.substring(0, 500) + `... (${o.length} chars)`)
          : (e[s] = o);
    return e;
  }
  function ud(t = {}) {
    let e = ad(),
      s = t.days || 1,
      o = [];
    for (let n = 0; n < s; n++) {
      let r =
          t.date ||
          new Date(Date.now() - n * 864e5).toISOString().split("T")[0],
        i = Hi.join(e, `${r}.jsonl`);
      if (!Es.existsSync(i)) continue;
      let c = Es.readFileSync(i, "utf-8")
        .split(
          `
`,
        )
        .filter((l) => l.trim());
      for (let l of c)
        try {
          let u = JSON.parse(l);
          if (t.tool && u.tool !== t.tool) continue;
          o.push(u);
        } catch {}
      if (t.date) break;
    }
    return o;
  }
  function Dy(t = 1) {
    let e = ud({ days: t });
    if (e.length === 0)
      return { totalCalls: 0, byTool: {}, avgDuration: 0, successRate: 1 };
    let s = {},
      o = 0,
      n = 0;
    for (let r of e)
      ((s[r.tool] = (s[r.tool] || 0) + 1),
        (o += r.duration || 0),
        r.success && n++);
    return {
      totalCalls: e.length,
      byTool: s,
      avgDuration: Math.round(o / e.length),
      successRate: n / e.length,
    };
  }
  function qy(t) {
    Gi = t;
  }
  function Fy() {
    return Gi;
  }
  function Uy() {
    yn = null;
  }
  dd.exports = {
    logToolExecution: jy,
    sanitizeArgs: ld,
    readAuditLog: ud,
    getAuditSummary: Dy,
    setAuditEnabled: qy,
    isAuditEnabled: Fy,
    getAuditLogPath: cd,
    _reset: Uy,
  };
});
var St = K((Bk, _d) => {
  var Ie = require("fs").promises,
    fd = require("fs"),
    xe = require("path"),
    ke = require("util").promisify(require("child_process").exec),
    Yi = require("util").promisify(require("child_process").execFile),
    { spawnSync: Wy } = require("child_process"),
    zi = require("axios"),
    {
      isForbidden: By,
      isSSHForbidden: Hy,
      isDangerous: Gy,
      isCritical: pd,
      isBashPathForbidden: Ky,
      confirm: Et,
    } = Ye(),
    {
      showClaudeDiff: Yo,
      showClaudeNewFile: Yy,
      showEditDiff: Uk,
      confirmFileChange: Ts,
    } = Al(),
    { C: te, Spinner: zy, getToolSpinnerText: Xy } = Ce(),
    { isGitRepo: Xi, getCurrentBranch: md, getStatus: Jy, getDiff: Vy } = en(),
    { recordChange: zo } = Ft(),
    { fuzzyFindText: hd, findMostSimilar: As } = cu(),
    { runDiagnostics: Rs } = uu(),
    { findFileInIndex: Qy, getFileIndex: Wk } = Ri(),
    { resolveProfile: xt, sshExec: it, scpUpload: Zy, scpDownload: ew } = Bn(),
    { resolveDeployConfig: tw, loadDeployConfigs: nw } = Ni(),
    { getEditMode: gd } = Do(),
    sw =
      /^(vim?|nano|emacs|pico|less|more|top|htop|iftop|iotop|glances|telnet\s|screen|tmux|fzf|gum|dialog|whiptail|man\s|node\s*$|python3?\s*$|irb\s*$|rails\s*c|psql\s|mysql\s|redis-cli|mongosh?|sqlite3)\b/,
    ow = /^ssh\s/,
    rw = /^ssh(?:\s+-\S+)*\s+\S+@?\S+\s+["']?[^-]/;
  async function pt(t) {
    return Ie.access(t)
      .then(() => !0)
      .catch(() => !1);
  }
  async function Xo(t) {
    if (!t) return { fixedPath: null, message: "" };
    let e = t
        .replace(/\/+/g, "/")
        .replace(/^~\//, `${require("os").homedir()}/`),
      s = at(e);
    if (s && (await pt(s)))
      return { fixedPath: s, message: `(auto-fixed path: ${t} \u2192 ${e})` };
    let o = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".json"],
      n = xe.extname(t);
    if (!n)
      for (let i of o) {
        let c = at(t + i);
        if (c && (await pt(c)))
          return {
            fixedPath: c,
            message: `(auto-fixed: added ${i} extension)`,
          };
      }
    if (n) {
      let i = t.replace(/\.[^.]+$/, "");
      for (let c of o) {
        if (c === n) continue;
        let l = at(i + c);
        if (l && (await pt(l)))
          return { fixedPath: l, message: `(auto-fixed: ${n} \u2192 ${c})` };
      }
    }
    let r = xe.basename(t);
    if (r && r.length > 2)
      try {
        let i = Qy(r).map((c) => at(c));
        if (i.length === 1)
          return {
            fixedPath: i[0],
            message: `(auto-fixed: found ${r} at ${xe.relative(process.cwd(), i[0])})`,
          };
        if (i.length > 1 && i.length <= 5)
          return {
            fixedPath: null,
            message: `File not found. Did you mean one of:
${i.map((l) => xe.relative(process.cwd(), l)).map((l) => `  - ${l}`).join(`
`)}`,
          };
      } catch {}
    return { fixedPath: null, message: "" };
  }
  function iw(t) {
    return /\bprintenv\b/.test(t)
      ? "printenv exposes all secrets. Use `echo $VAR_NAME` for a single variable, or `env | grep PATTERN` for filtered output."
      : /cat\s+.*\.env\b/.test(t)
        ? 'Reading .env directly is blocked. Use `grep -v "KEY=" .env` to inspect non-secret entries, or ask the user to share specific values.'
        : /cat\s+.*credentials/i.test(t)
          ? "Credentials files are blocked. Reference the variable name from the application config instead."
          : /python3?\s+-c\s/.test(t)
            ? "Inline python -c is blocked. Write a temporary script file and run it with `python3 script.py` instead."
            : /node\s+-e\s/.test(t)
              ? "Inline node -e is blocked. Write a temporary script file and run it with `node script.js` instead."
              : /curl.*-X\s*POST|curl.*--data/.test(t)
                ? "curl POST is blocked to prevent data exfiltration. Use the application's own API client or ask the user to run the request."
                : /base64.*\|.*bash/.test(t)
                  ? "Piping base64-decoded content to bash is blocked. Decode the content first, inspect it, then run explicitly."
                  : /\beval\s*\(/.test(t)
                    ? "eval is blocked. Execute the command directly without eval."
                    : /(?:^|[;&|]\s*)history(?:\s|$)/.test(t)
                      ? "Shell history is blocked. Look at git log or project files for context instead."
                      : /\bsed\s+-n\s+['"]?\d+,\d+p/.test(t)
                        ? 'sed -n line-range scrolling floods context with irrelevant lines. Use targeted grep instead: grep -n "ERROR\\|pattern" <logfile> | tail -20'
                        : "";
  }
  function wd(t, e) {
    let s = [];
    if (/command not found|: not found|not recognized/i.test(t)) {
      let o = e.match(/^(\S+)/),
        n = o ? o[1] : "";
      /^(npx|npm|node|yarn|pnpm|bun)$/.test(n)
        ? s.push(
            "HINT: Node.js/npm may not be in PATH. Check your Node.js installation.",
          )
        : /^(python|python3|pip|pip3)$/.test(n)
          ? s.push(
              "HINT: Python may not be installed. Try: brew install python3 (macOS) or apt install python3 (Linux)",
            )
          : s.push(
              `HINT: "${n}" is not installed. Try installing it with your package manager.`,
            );
    }
    if (/Cannot find module|MODULE_NOT_FOUND/i.test(t)) {
      let o = t.match(/Cannot find module '([^']+)'/),
        n = o ? o[1] : "";
      n && !n.startsWith(".") && !n.startsWith("/")
        ? s.push(`HINT: Missing npm package "${n}". Run: npm install ${n}`)
        : s.push(
            "HINT: Module not found. Check the import path or run npm install.",
          );
    }
    if (
      (/permission denied|EACCES/i.test(t) &&
        s.push(
          "HINT: Permission denied. Check file permissions or try a different approach.",
        ),
      /EADDRINUSE|address already in use/i.test(t))
    ) {
      let o = t.match(/port (\d+)|:(\d+)/),
        n = o ? o[1] || o[2] : "";
      s.push(
        `HINT: Port ${n || ""} is already in use. Kill the process or use a different port.`,
      );
    }
    if (
      (/SyntaxError|Unexpected token/i.test(t) &&
        s.push(
          "HINT: Syntax error in the code. Check the file at the line number shown above.",
        ),
      /TS\d{4}:/i.test(t) &&
        s.push(
          "HINT: TypeScript compilation error. Fix the type issue at the indicated line.",
        ),
      /Test Suites:.*failed|Tests:.*failed/i.test(t) &&
        s.push(
          "HINT: Test failures detected. Read the error output above to identify failing tests.",
        ),
      /fatal: not a git repository/i.test(t) &&
        s.push(
          "HINT: Not inside a git repository. Run git init or cd to a git project.",
        ),
      /^curl\b/.test(e))
    ) {
      let o = t.match(/curl:\s*\((\d+)\)/),
        n = o ? parseInt(o[1], 10) : null;
      n === 6 || /Could not resolve host/i.test(t)
        ? s.push(
            "HINT: Hostname could not be resolved. Check DNS or use an IP address directly.",
          )
        : n === 7 || /Failed to connect|Connection refused/i.test(t)
          ? s.push(
              "HINT: Service not running or port wrong. Check if the service is up and the port is correct.",
            )
          : n === 22 || /HTTP error/i.test(t)
            ? s.push(
                "HINT: HTTP 4xx/5xx response. The endpoint exists but returned an error status.",
              )
            : n === 28 || /timed out/i.test(t)
              ? s.push(
                  "HINT: Request timed out. The host may be unreachable or the service is slow.",
                )
              : (n === 35 || /SSL.*error/i.test(t)) &&
                s.push(
                  "HINT: SSL/TLS handshake failed. Try with --insecure to bypass, or check the certificate.",
                );
    }
    if (/remote port forwarding failed/i.test(t)) {
      let o = t.match(/port (\d+)/),
        n = o ? o[1] : "";
      s.push(
        `HINT: SSH remote port forwarding failed for port ${n}. The port may already be bound on the server. Check with: ssh server "ss -tuln | grep ${n}" and kill any lingering process with that port.`,
      );
    }
    return (
      /bind.*Cannot assign requested address|Address already in use/i.test(t) &&
        s.push(
          "HINT: Port is already in use. Find the process with: ss -tuln | grep <port> and kill it, then retry.",
        ),
      /Connection.*timed out|ssh.*timeout/i.test(t) &&
        /^ssh\b/.test(e) &&
        s.push(
          "HINT: SSH connection timed out. Check if the host is reachable: ping <host> and verify the port with: nc -zv <host> 22",
        ),
      /spawn \/bin\/sh ENOENT|spawn sh ENOENT/i.test(t) &&
        s.push(
          "HINT: The working directory was deleted during this session \u2014 bash cannot execute commands in a non-existent cwd. Previous rm/delete commands succeeded. Use list_directory or glob to verify the state instead of retrying bash.",
        ),
      /cp.*\$f.*\$f\.bak.*sed.*-i\.bak|sed.*-i\.bak.*cp.*\$f.*\$f\.bak/i.test(
        e,
      ) &&
        s.push(
          'HINT: Using both cp with .bak and sed -i.bak creates double backups (.bak.bak). Choose one method: either cp "$f" "$f.bak" OR sed -i.bak, not both.',
        ),
      s.length === 0
        ? t
        : t +
          `

` +
          s.join(`
`)
    );
  }
  function bd(t, e, s) {
    let o = As(t, e);
    if (!o) return null;
    let n = Math.max(2, Math.ceil(e.length * 0.03));
    return o.distance > n
      ? null
      : {
          autoFixed: !0,
          matchText: o.text,
          content: t.split(o.text).join(s),
          distance: o.distance,
          line: o.line,
        };
  }
  var $d = !1,
    wn = null;
  function aw() {
    wn && (wn(), (wn = null));
  }
  var Vi = null;
  function cw(t) {
    Vi = t;
  }
  async function Ji() {
    if (!$d) {
      $d = !0;
      try {
        let { stdout: t } = await ke("git rev-parse --is-inside-work-tree", {
          cwd: process.cwd(),
          timeout: 5e3,
        });
        if (!(t.trim() === "true")) return;
        (await ke(
          'git stash push -m "nex-code-checkpoint" --include-untracked',
          { cwd: process.cwd(), timeout: 1e4 },
        ),
          await ke("git stash pop", { cwd: process.cwd(), timeout: 1e4 }),
          await ke("git tag -f nex-checkpoint", {
            cwd: process.cwd(),
            timeout: 5e3,
          }));
      } catch {}
    }
  }
  var lw = [
    /\.ssh\//i,
    /\.gnupg\//i,
    /\.aws\//i,
    /\.config\/gcloud/i,
    /\/etc\/shadow/,
    /\/etc\/passwd/,
    /\/etc\/sudoers/,
    /\.env(?:\.|$)/,
    /credentials/i,
    /\.npmrc$/,
    /\.docker\/config\.json/,
    /\.kube\/config/,
  ];
  function at(t) {
    let e = xe.isAbsolute(t) ? xe.resolve(t) : xe.resolve(process.cwd(), t);
    for (let s of lw) if (s.test(e)) return null;
    return e;
  }
  var uw = [
    {
      type: "function",
      function: {
        name: "bash",
        description:
          "Execute a bash command in the project directory. Timeout: 90s. Use for: running tests, installing packages, git commands, build tools, starting servers. Do NOT use bash for file operations when a dedicated tool exists \u2014 use read_file instead of cat, edit_file instead of sed, glob instead of find, grep instead of grep/rg. Always quote paths with spaces. Prefer specific commands over rm -rf. Destructive or dangerous commands require user confirmation.",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The bash command to execute",
            },
          },
          required: ["command"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description:
          "Read a file's contents with line numbers. Always read a file BEFORE editing it to see exact content. Use line_start/line_end for large files to read specific sections. Prefer this over bash cat/head/tail. Files are read with UTF-8 encoding. For binary files, use bash with appropriate flags. Alternative: use util.promisify(fs.readFile) for programmatic access.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File path (relative or absolute)",
            },
            line_start: {
              type: "number",
              description: "Start line (1-based, optional)",
            },
            line_end: {
              type: "number",
              description: "End line (1-based, optional)",
            },
          },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "write_file",
        description:
          "Create a new file or completely overwrite an existing file. For targeted changes to existing files, prefer edit_file or patch_file instead \u2014 they only send the diff and are safer. Only use write_file when creating new files or when the entire content needs to be replaced.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path" },
            content: { type: "string", description: "Full file content" },
          },
          required: ["path", "content"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "edit_file",
        description:
          "Replace specific text in a file. IMPORTANT: old_text must match the file content EXACTLY \u2014 including all whitespace, indentation (tabs vs spaces), and newlines. Always read_file first to see the exact content before editing. If old_text is not found, the edit fails. For multiple changes to the same file, prefer patch_file instead.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path" },
            old_text: {
              type: "string",
              description:
                "Exact text to find (must match file content precisely)",
            },
            new_text: { type: "string", description: "Replacement text" },
          },
          required: ["path", "old_text", "new_text"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_directory",
        description:
          "List files and directories in a tree view. Use this to understand project structure. For finding specific files by pattern, prefer glob instead.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path" },
            max_depth: {
              type: "number",
              description: "Max depth (default: 2)",
            },
            pattern: {
              type: "string",
              description: "File filter glob (e.g. '*.js')",
            },
          },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_files",
        description:
          "Search for a text pattern across files (regex). Returns matching lines with file paths. For simple content search, grep is equivalent. For finding files by name, use glob instead.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory to search" },
            pattern: { type: "string", description: "Search pattern (regex)" },
            file_pattern: {
              type: "string",
              description: "File filter (e.g. '*.js')",
            },
          },
          required: ["path", "pattern"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "glob",
        description:
          "Find files matching a glob pattern. Fast file search by name/extension. Use this to find files before reading them. Examples: '**/*.test.js' (all test files), 'src/**/*.ts' (all TypeScript in src). Prefer this over bash find/ls.",
        parameters: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Glob pattern (e.g. '**/*.ts', 'src/**/*.test.js')",
            },
            path: {
              type: "string",
              description: "Base directory (default: project root)",
            },
          },
          required: ["pattern"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "grep",
        description:
          "Search file contents with regex. Returns matching lines with file paths and line numbers. Supports output modes (content/files_with_matches/count), context lines, head_limit, offset, type filter, and multiline. Prefer this over bash grep/rg.",
        parameters: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Regex pattern to search for",
            },
            path: {
              type: "string",
              description:
                "Directory or file to search (default: project root)",
            },
            include: {
              type: "string",
              description: "File filter glob (e.g. '*.js', '*.ts')",
            },
            ignore_case: {
              type: "boolean",
              description: "Case-insensitive search",
            },
            output_mode: {
              type: "string",
              enum: ["content", "files_with_matches", "count"],
              description:
                "Output mode: content (matching lines), files_with_matches (file paths only), count (match counts). Default: content",
            },
            context: {
              type: "number",
              description: "Lines of context around each match (like grep -C)",
            },
            before_context: {
              type: "number",
              description: "Lines before each match (like grep -B)",
            },
            after_context: {
              type: "number",
              description: "Lines after each match (like grep -A)",
            },
            head_limit: {
              type: "number",
              description: "Limit output to first N results",
            },
            offset: { type: "number", description: "Skip first N results" },
            type: {
              type: "string",
              description:
                "File type filter (e.g. 'js', 'py', 'ts') \u2014 maps to --include='*.ext'",
            },
            multiline: {
              type: "boolean",
              description: "Enable multiline matching (grep -Pz)",
            },
            staged: {
              type: "boolean",
              description:
                "Search only staged content (git diff --cached). Default: false",
            },
          },
          required: ["pattern"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "patch_file",
        description:
          "Apply multiple text replacements to a file atomically. All patches are validated before any are applied \u2014 if one fails, none are written. Prefer this over multiple edit_file calls when making several changes to the same file. Like edit_file, all old_text values must match exactly.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path" },
            patches: {
              type: "array",
              description:
                "Array of { old_text, new_text } replacements to apply in order",
              items: {
                type: "object",
                properties: {
                  old_text: { type: "string", description: "Text to find" },
                  new_text: { type: "string", description: "Replacement text" },
                },
                required: ["old_text", "new_text"],
              },
            },
          },
          required: ["path", "patches"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "web_fetch",
        description:
          "Fetch content from a URL and return text. HTML tags are stripped. Use for reading documentation, API responses, or web pages. Will not work with authenticated/private URLs.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to fetch" },
            max_length: {
              type: "number",
              description: "Max response length in chars (default: 10000)",
            },
          },
          required: ["url"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "web_search",
        description:
          "Search the web. Uses Perplexity (grounded, AI-summarized) if PERPLEXITY_API_KEY is set, otherwise DuckDuckGo. Returns titles, URLs, and summaries. Use to find documentation, solutions, or current information beyond your knowledge cutoff.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            max_results: {
              type: "number",
              description: "Max results (default: 5)",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "browser_open",
        description:
          "Open a URL in a headless browser and return the page title, text content, and links. More reliable than web_fetch for JavaScript-heavy pages. Requires playwright (npm install playwright && npx playwright install chromium).",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to open" },
            wait_for: {
              type: "string",
              enum: ["domcontentloaded", "networkidle", "load"],
              description:
                "When to consider page loaded (default: domcontentloaded)",
            },
          },
          required: ["url"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "browser_screenshot",
        description:
          "Take a screenshot of a URL in a headless browser. Returns the screenshot file path. The path can be pasted into the next message for visual analysis. Requires playwright.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to screenshot" },
            full_page: {
              type: "boolean",
              description:
                "Capture full page (default: false \u2014 viewport only)",
            },
            width: {
              type: "number",
              description: "Viewport width in px (default: 1280)",
            },
            height: {
              type: "number",
              description: "Viewport height in px (default: 800)",
            },
          },
          required: ["url"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "browser_click",
        description:
          "Click an element on a web page (by CSS selector or visible text). Returns the new URL after navigation. Requires playwright.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to navigate to first" },
            selector: {
              type: "string",
              description:
                "CSS selector of element to click (mutually exclusive with text)",
            },
            text: {
              type: "string",
              description:
                "Visible text of element to click (mutually exclusive with selector)",
            },
          },
          required: ["url"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "browser_fill",
        description:
          "Fill a form field on a web page and optionally submit. Requires playwright.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to navigate to first" },
            selector: {
              type: "string",
              description: "CSS selector of the input field",
            },
            value: { type: "string", description: "Value to fill in" },
            submit: {
              type: "boolean",
              description:
                "Press Enter to submit after filling (default: false)",
            },
          },
          required: ["url", "selector", "value"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "ask_user",
        description:
          "Ask the user a clarifying question with 2-3 specific options. Use when the user's intent is ambiguous. Always provide concrete, actionable options. The user can select an option or type a custom answer.",
        parameters: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "The clarifying question to ask",
            },
            options: {
              type: "array",
              items: { type: "string" },
              description:
                "2-3 specific, actionable answer options for the user to choose from",
              minItems: 1,
              maxItems: 3,
            },
          },
          required: ["question", "options"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "git_status",
        description:
          "Get git status: current branch, changed files, staged/unstaged state. Use before git operations to understand the current state.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "git_diff",
        description:
          "Get git diff for changed files. Shows additions and deletions.",
        parameters: {
          type: "object",
          properties: {
            staged: {
              type: "boolean",
              description: "Show only staged changes (default: false)",
            },
            file: {
              type: "string",
              description: "Diff specific file only (optional)",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "git_log",
        description: "Show recent git commits (short format).",
        parameters: {
          type: "object",
          properties: {
            count: {
              type: "number",
              description: "Number of commits to show (default: 10)",
            },
            file: {
              type: "string",
              description: "Show commits for specific file (optional)",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "task_list",
        description:
          "Create and manage a task list for complex multi-step tasks. Use for tasks with 3+ steps to track progress. Actions: create (new list with tasks), update (mark task in_progress/done/failed), get (view current list). Always update task status as you work.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["create", "update", "get"],
              description: "Action to perform",
            },
            name: {
              type: "string",
              description: "Task list name (for create)",
            },
            tasks: {
              type: "array",
              description: "Array of tasks to create (for create)",
              items: {
                type: "object",
                properties: {
                  description: {
                    type: "string",
                    description: "Task description",
                  },
                  depends_on: {
                    type: "array",
                    items: { type: "string" },
                    description: "IDs of prerequisite tasks",
                  },
                },
                required: ["description"],
              },
            },
            task_id: {
              type: "string",
              description: "Task ID to update (for update)",
            },
            status: {
              type: "string",
              enum: ["in_progress", "done", "failed"],
              description: "New status (for update)",
            },
            result: {
              type: "string",
              description: "Result summary (for update, optional)",
            },
          },
          required: ["action"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "gh_run_list",
        description:
          "List recent GitHub Actions workflow runs for this repository. Shows run status, conclusion, branch, and timing. Use to check CI/CD status or find a run ID.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of runs to show (default: 10, max: 30)",
            },
            workflow: {
              type: "string",
              description: "Filter by workflow name or filename (optional)",
            },
            branch: {
              type: "string",
              description: "Filter by branch name (optional)",
            },
            status: {
              type: "string",
              enum: [
                "completed",
                "in_progress",
                "queued",
                "failure",
                "success",
              ],
              description: "Filter by status (optional)",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "gh_run_view",
        description:
          "View details of a specific GitHub Actions workflow run: steps, logs, errors. Use gh_run_list first to get the run ID.",
        parameters: {
          type: "object",
          properties: {
            run_id: {
              type: "string",
              description: "The run ID (from gh_run_list)",
            },
            log: {
              type: "boolean",
              description:
                "Include full log output (default: false \u2014 shows step summary only)",
            },
          },
          required: ["run_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "gh_workflow_trigger",
        description:
          "Trigger a GitHub Actions workflow dispatch event. Only works for workflows with workflow_dispatch trigger. Requires user confirmation.",
        parameters: {
          type: "object",
          properties: {
            workflow: {
              type: "string",
              description: "Workflow filename (e.g. ci.yml) or name",
            },
            branch: {
              type: "string",
              description: "Branch to run on (default: current branch)",
            },
            inputs: {
              type: "object",
              description:
                "Workflow input parameters as key-value pairs (optional)",
            },
          },
          required: ["workflow"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "spawn_agents",
        description:
          "Run multiple independent sub-agents in parallel (max 5 at top level, max 2 when called from within a sub-agent). Each agent has its own conversation context. Use when 2+ tasks can run simultaneously \u2014 e.g. reading multiple files, analyzing separate modules, independent research. Do NOT use for tasks that depend on each other or modify the same file. Keep task descriptions specific and self-contained. SWARM PATTERN: Sub-agents can call spawn_agents once (max nesting depth 2) to enable Architect\u2192Coder\u2192Reviewer pipelines: a coder agent spawns 1-2 reviewer agents that validate and fix its own output before returning results to the parent.",
        parameters: {
          type: "object",
          properties: {
            agents: {
              type: "array",
              description:
                "Array of agent definitions to run in parallel (max 5)",
              items: {
                type: "object",
                properties: {
                  task: {
                    type: "string",
                    description: "Task description for the agent",
                  },
                  context: {
                    type: "string",
                    description: "Additional context (optional)",
                  },
                  max_iterations: {
                    type: "number",
                    description: "Max iterations (default: 10, max: 15)",
                  },
                  model: {
                    type: "string",
                    description:
                      'Override model for this agent (provider:model, e.g. "anthropic:claude-haiku"). Auto-selected if omitted.',
                  },
                },
                required: ["task"],
              },
            },
          },
          required: ["agents"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "switch_model",
        description:
          "Switch the active AI model mid-conversation. Use when a different model is better for the next steps \u2014 e.g. switch to a fast model for simple lookups, or a more capable model for complex refactoring. The switch persists for all subsequent turns.",
        parameters: {
          type: "object",
          properties: {
            model: {
              type: "string",
              description:
                'Model spec: "provider:model" (e.g. "ollama:devstral-small-2:24b") or just model name',
            },
          },
          required: ["model"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "k8s_pods",
        description:
          "List Kubernetes pods. Shows pod name, status, restarts, and age. Runs kubectl locally or via SSH on a remote server. Use namespace to filter, or omit for all namespaces.",
        parameters: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description:
                "Namespace to list pods in (default: all namespaces)",
            },
            label: {
              type: "string",
              description: 'Label selector filter (e.g. "app=nginx")',
            },
            context: {
              type: "string",
              description: "kubectl context to use (optional)",
            },
            server: {
              type: "string",
              description:
                "Remote server as user@host to run kubectl via SSH (optional, local kubectl if omitted)",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "k8s_logs",
        description:
          'Fetch logs from a Kubernetes pod. Use tail to limit output, since for time-based filtering (e.g. "1h", "30m").',
        parameters: {
          type: "object",
          properties: {
            pod: { type: "string", description: "Pod name" },
            namespace: {
              type: "string",
              description: "Namespace (default: default)",
            },
            container: {
              type: "string",
              description:
                "Container name (required if pod has multiple containers)",
            },
            tail: {
              type: "number",
              description: "Number of recent lines to show (default: 100)",
            },
            since: {
              type: "string",
              description: 'Show logs since duration (e.g. "1h", "30m", "5s")',
            },
            context: {
              type: "string",
              description: "kubectl context (optional)",
            },
            server: {
              type: "string",
              description: "Remote server user@host (optional)",
            },
          },
          required: ["pod"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "k8s_exec",
        description:
          "Execute a command inside a running Kubernetes pod (kubectl exec). Requires user confirmation. Use for inspecting container state, reading configs, or debugging.",
        parameters: {
          type: "object",
          properties: {
            pod: { type: "string", description: "Pod name" },
            command: {
              type: "string",
              description:
                'Command to run in the pod (e.g. "env", "ls /app", "cat /etc/config.yaml")',
            },
            namespace: {
              type: "string",
              description: "Namespace (default: default)",
            },
            container: {
              type: "string",
              description: "Container name (optional)",
            },
            context: {
              type: "string",
              description: "kubectl context (optional)",
            },
            server: {
              type: "string",
              description: "Remote server user@host (optional)",
            },
          },
          required: ["pod", "command"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "k8s_apply",
        description:
          "Apply a Kubernetes manifest file (kubectl apply -f). Requires confirmation before applying to the cluster. Use dry_run=true to validate without applying.",
        parameters: {
          type: "object",
          properties: {
            file: {
              type: "string",
              description: "Path to manifest YAML file (relative or absolute)",
            },
            namespace: {
              type: "string",
              description: "Override namespace (optional)",
            },
            dry_run: {
              type: "boolean",
              description: "Validate only without applying (default: false)",
            },
            context: {
              type: "string",
              description: "kubectl context (optional)",
            },
            server: {
              type: "string",
              description: "Remote server user@host (optional)",
            },
          },
          required: ["file"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "k8s_rollout",
        description:
          "Manage Kubernetes deployment rollouts: check status, restart (rolling update), view history, or undo (rollback). Restart and undo require confirmation.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["status", "restart", "history", "undo"],
              description:
                "Action: status (check rollout progress), restart (rolling restart), history (show revision history), undo (rollback to previous revision)",
            },
            deployment: { type: "string", description: "Deployment name" },
            namespace: {
              type: "string",
              description: "Namespace (default: default)",
            },
            context: {
              type: "string",
              description: "kubectl context (optional)",
            },
            server: {
              type: "string",
              description: "Remote server user@host (optional)",
            },
          },
          required: ["action", "deployment"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "brain_write",
        description:
          "Write or update a knowledge document in the project brain (.nex/brain/). Use this to persist important findings, architecture decisions, debugging insights, or conventions discovered during the session. The user can review changes via /brain review or git diff.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                'Document name (without .md extension). Use kebab-case. Examples: "api-auth-flow", "db-schema-notes", "deployment-checklist"',
            },
            content: {
              type: "string",
              description:
                "Full Markdown content. Use headings (#), lists (-), and code blocks. Include optional YAML frontmatter with tags.",
            },
            mode: {
              type: "string",
              enum: ["create", "update", "append"],
              description:
                "create: new document (fails if exists). update: overwrite existing. append: add to end of existing document.",
            },
          },
          required: ["name", "content", "mode"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "ssh_exec",
        description:
          'Execute a command on a remote server via SSH. Server is a profile name from .nex/servers.json (e.g. "prod") or "user@host". Use for: checking status, reading logs, running deployments. Destructive commands (restart, delete, modify config) require confirmation. For service management prefer service_manage; for logs prefer service_logs.',
        parameters: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                'Profile name (from .nex/servers.json) or "user@host"',
            },
            command: {
              type: "string",
              description: "Shell command to run on the remote server",
            },
            sudo: {
              type: "boolean",
              description:
                "Run command with sudo (only if profile has sudo:true). Default: false",
            },
            timeout: {
              type: "number",
              description: "Timeout in seconds. Default: 30",
            },
          },
          required: ["server", "command"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "ssh_upload",
        description:
          "Upload a local file or directory to a remote server via SCP. Recursive for directories. Requires confirmation before upload.",
        parameters: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Profile name or "user@host"',
            },
            local_path: {
              type: "string",
              description: "Local path to upload (file or directory)",
            },
            remote_path: {
              type: "string",
              description:
                "Destination path on the remote server (absolute preferred)",
            },
          },
          required: ["server", "local_path", "remote_path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "ssh_download",
        description:
          "Download a file or directory from a remote server via SCP. Recursive for directories.",
        parameters: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description: 'Profile name or "user@host"',
            },
            remote_path: {
              type: "string",
              description: "Path on the remote server to download",
            },
            local_path: {
              type: "string",
              description: "Local destination path",
            },
          },
          required: ["server", "remote_path", "local_path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "remote_agent",
        description:
          'Delegate a coding task to nex-code running on a remote server. Use this when the task involves server-side projects (musikschule, stadtkapelle, cahill, schoensgibl, jarvis) that live on almalinux9/jarvis. Runs nex-code --auto on the server and streams output. Server is a profile name from .nex/servers.json or "user@host".',
        parameters: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                'Profile name from .nex/servers.json (e.g. "almalinux9") or "user@host"',
            },
            task: {
              type: "string",
              description:
                "The full task description to run on the remote nex-code",
            },
            project_path: {
              type: "string",
              description:
                "Working directory on the remote server (e.g. /home/jarvis/jarvis-agent). Defaults to home directory.",
            },
            model: {
              type: "string",
              description:
                "Model to use on remote nex-code (e.g. qwen3-coder:480b). Defaults to server default.",
            },
          },
          required: ["server", "task"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "service_manage",
        description:
          "Manage a systemd service on a remote (or local) server. Uses systemctl. Status is read-only; start/stop/restart/reload/enable/disable require confirmation. For AlmaLinux 9: runs via SSH with sudo if configured.",
        parameters: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                'Profile name or "user@host". Omit or use "local" for local machine.',
            },
            service: {
              type: "string",
              description:
                'Service name (e.g. "nginx", "gunicorn", "postgresql")',
            },
            action: {
              type: "string",
              enum: [
                "status",
                "start",
                "stop",
                "restart",
                "reload",
                "enable",
                "disable",
              ],
              description: "systemctl action to perform",
            },
          },
          required: ["service", "action"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "service_logs",
        description:
          "Fetch systemd service logs via journalctl. Works on AlmaLinux 9 and any systemd Linux. Read-only, no confirmation needed.",
        parameters: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                'Profile name or "user@host". Omit or use "local" for local machine.',
            },
            service: {
              type: "string",
              description: 'Service name (e.g. "nginx", "gunicorn")',
            },
            lines: {
              type: "number",
              description: "Number of recent log lines to fetch. Default: 50",
            },
            since: {
              type: "string",
              description:
                'Time filter, e.g. "1 hour ago", "today", "2024-01-01 12:00". Optional.',
            },
            follow: {
              type: "boolean",
              description:
                "Tail logs in real-time (follow mode). Default: false",
            },
          },
          required: ["service"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "container_list",
        description:
          "List Docker containers on a server (or locally). Shows container ID, name, image, status, and ports. Read-only, no confirmation needed.",
        parameters: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                'Profile name or "user@host". Omit or use "local" for local machine.',
            },
            all: {
              type: "boolean",
              description:
                "Show all containers including stopped ones. Default: false (running only).",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "container_logs",
        description:
          "Fetch logs from a Docker container on a server (or locally). Read-only, no confirmation needed.",
        parameters: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                'Profile name or "user@host". Omit or use "local" for local machine.',
            },
            container: { type: "string", description: "Container name or ID." },
            lines: {
              type: "number",
              description: "Number of recent log lines. Default: 50.",
            },
            since: {
              type: "string",
              description:
                'Time filter, e.g. "1h", "30m", "2024-01-01T12:00:00". Optional.',
            },
          },
          required: ["container"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "container_exec",
        description:
          "Execute a command inside a running Docker container. Destructive or state-changing commands require confirmation.",
        parameters: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                'Profile name or "user@host". Omit or use "local" for local machine.',
            },
            container: { type: "string", description: "Container name or ID." },
            command: {
              type: "string",
              description:
                'Command to run inside the container (e.g. "cat /etc/nginx/nginx.conf").',
            },
          },
          required: ["container", "command"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "container_manage",
        description:
          'Start, stop, restart, or remove a Docker container. All actions except "inspect" require confirmation.',
        parameters: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                'Profile name or "user@host". Omit or use "local" for local machine.',
            },
            container: { type: "string", description: "Container name or ID." },
            action: {
              type: "string",
              enum: ["start", "stop", "restart", "remove", "inspect"],
              description: "Action to perform on the container.",
            },
          },
          required: ["container", "action"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "frontend_recon",
        description:
          "MANDATORY first step before creating or significantly modifying any frontend file (HTML template, Vue/React component, CSS). Scans the project and returns: (1) design tokens \u2014 CSS variables, Tailwind theme colors/fonts, (2) main layout/index page structure, (3) a reference component of the same type, (4) detected JS/CSS framework stack. Call this BEFORE writing any markup or styles. Never skip it for frontend tasks.",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description:
                'Type of frontend file you are about to create. Used to find a relevant reference component. Examples: "list", "form", "detail", "dashboard", "modal", "component". Optional but improves reference quality.',
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "deploy",
        description:
          'Deploy to a remote server. Supports two methods: "rsync" (sync local files) and "git" (git pull on remote). Can use a named config from .nex/deploy.json. Requires confirmation before executing.',
        parameters: {
          type: "object",
          properties: {
            config: {
              type: "string",
              description:
                'Named deploy config from .nex/deploy.json (e.g. "prod"). Overrides all other params if provided.',
            },
            method: {
              type: "string",
              enum: ["rsync", "git"],
              description:
                'Deploy method: "rsync" syncs local files (default), "git" runs git pull on the remote.',
            },
            server: {
              type: "string",
              description:
                'Profile name or "user@host". Required if no config.',
            },
            remote_path: {
              type: "string",
              description:
                "Remote project directory. Required for git method; destination path for rsync.",
            },
            local_path: {
              type: "string",
              description:
                "Local directory or file to sync. Required for rsync method.",
            },
            branch: {
              type: "string",
              description:
                "Branch to pull (git method only). Defaults to current remote branch.",
            },
            deploy_script: {
              type: "string",
              description:
                'Shell command(s) to run on the remote after sync/pull (e.g. "npm ci && systemctl restart myapp"). Optional.',
            },
            health_check: {
              type: "string",
              description:
                "URL (HTTP GET) or shell command to verify the service is healthy after deploy. If it fails, the deploy is marked as failed. Optional.",
            },
            exclude: {
              type: "array",
              items: { type: "string" },
              description: "Paths to exclude from rsync. Optional.",
            },
            dry_run: {
              type: "boolean",
              description:
                "Show what would happen without executing. Default: false.",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "deployment_status",
        description:
          "Check deployment status across all configured servers. Reads .nex/deploy.json configs and checks service health on each server. Returns a status summary table.",
        parameters: {
          type: "object",
          properties: {
            config: {
              type: "string",
              description:
                "Specific deploy config name to check (optional \u2014 checks all if omitted)",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "sysadmin",
        description:
          "Senior sysadmin operations on a remote (or local) Linux server. Covers: system audit, disk_usage, process_list, network_status, package management (dnf/apt), user management, firewall (firewalld/ufw/iptables), cron, SSL cert checks, log tailing, large file discovery, systemd service management, process kill, journalctl log querying. Read-only actions run without confirmation; state-changing actions require user approval.",
        parameters: {
          type: "object",
          properties: {
            server: {
              type: "string",
              description:
                'Profile name or "user@host". Omit or use "local" for local machine.',
            },
            action: {
              type: "string",
              enum: [
                "audit",
                "disk_usage",
                "process_list",
                "network_status",
                "package",
                "user_manage",
                "firewall",
                "cron",
                "ssl_check",
                "log_tail",
                "find_large",
                "service",
                "kill_process",
                "journalctl",
              ],
              description:
                "Sysadmin operation. audit=full health overview; disk_usage=df+du; process_list=top procs; network_status=open ports; package=dnf/apt (package_action: check|list|install|remove|update|upgrade); user_manage=users/keys; firewall=rules; cron=crontab; ssl_check=cert expiry+days; log_tail=tail any log; find_large=big files; service=systemd unit management; kill_process=kill by PID or name; journalctl=query system journal.",
            },
            path: {
              type: "string",
              description:
                "File or directory path. For disk_usage (default /), log_tail (required), find_large (default /).",
            },
            lines: {
              type: "number",
              description:
                "Lines to tail for log_tail or journalctl. Default: 100.",
            },
            limit: {
              type: "number",
              description:
                "Result count for process_list (default 20) or find_large (default 20).",
            },
            sort_by: {
              type: "string",
              enum: ["cpu", "mem"],
              description: "Sort order for process_list. Default: cpu.",
            },
            min_size: {
              type: "string",
              description:
                'Minimum file size for find_large. Default: "100M". Examples: "50M", "1G".',
            },
            package_action: {
              type: "string",
              enum: ["install", "remove", "update", "list", "upgrade"],
              description: "Package sub-action for action=package.",
            },
            packages: {
              type: "array",
              items: { type: "string" },
              description: "Package name(s) for install/remove/update.",
            },
            user_action: {
              type: "string",
              enum: ["list", "create", "delete", "add_ssh_key", "info"],
              description: "User sub-action for action=user_manage.",
            },
            user: {
              type: "string",
              description: "Linux username for user_manage or cron.",
            },
            groups: {
              type: "array",
              items: { type: "string" },
              description:
                'Groups to assign on user create (e.g. ["sudo", "docker"]).',
            },
            ssh_key: {
              type: "string",
              description:
                "SSH public key string to add for user_action=add_ssh_key.",
            },
            firewall_action: {
              type: "string",
              enum: ["status", "allow", "deny", "remove", "reload"],
              description: "Firewall sub-action for action=firewall.",
            },
            port: {
              type: "string",
              description:
                'Port/protocol for firewall rules, e.g. "80/tcp", "443", "8080/udp".',
            },
            cron_action: {
              type: "string",
              enum: ["list", "add", "remove"],
              description: "Cron sub-action for action=cron.",
            },
            schedule: {
              type: "string",
              description:
                'Cron schedule expression for cron add, e.g. "0 2 * * *".',
            },
            command: {
              type: "string",
              description:
                "Command for cron add, or substring to match for cron remove.",
            },
            domain: {
              type: "string",
              description: `Domain for ssl_check (e.g. "example.com"). Auto-detects Let's Encrypt cert on server; falls back to live TLS probe.`,
            },
            cert_path: {
              type: "string",
              description:
                'Explicit path to cert file on server for ssl_check (e.g. "/etc/letsencrypt/live/x/cert.pem").',
            },
            service_name: {
              type: "string",
              description:
                'Systemd unit name for action=service (e.g. "nginx", "jarvis-api", "gunicorn"). .service suffix optional.',
            },
            service_action: {
              type: "string",
              enum: [
                "status",
                "start",
                "stop",
                "restart",
                "reload",
                "enable",
                "disable",
                "list_failed",
              ],
              description:
                "Sub-action for action=service. list_failed shows all failed units.",
            },
            pid: {
              type: "number",
              description: "Process ID to kill for action=kill_process.",
            },
            process_name: {
              type: "string",
              description:
                "Process name to kill (uses pkill) for action=kill_process. Use with pid for safety.",
            },
            signal: {
              type: "string",
              enum: ["SIGTERM", "SIGKILL", "SIGHUP", "SIGINT"],
              description: "Signal for kill_process. Default: SIGTERM.",
            },
            unit: {
              type: "string",
              description:
                'Systemd unit to filter for journalctl (e.g. "nginx", "jarvis-api"). Omit for system-wide.',
            },
            since: {
              type: "string",
              description:
                'Time filter for journalctl, e.g. "1 hour ago", "today", "2026-03-17 10:00". Default: last 200 lines.',
            },
            priority: {
              type: "string",
              enum: [
                "emerg",
                "alert",
                "crit",
                "err",
                "warning",
                "notice",
                "info",
                "debug",
              ],
              description:
                "Minimum log priority for journalctl. Default: no filter.",
            },
          },
          required: ["action"],
        },
      },
    },
  ];
  function Cs(t, { server: e, context: s } = {}) {
    let o = e ? e.replace(/[^a-zA-Z0-9@._-]/g, "") : null,
      n = s ? s.replace(/[^a-zA-Z0-9._/-]/g, "") : null,
      r = "kubectl";
    if ((n && (r += ` --context ${n}`), (r += ` ${t}`), o)) {
      let i = r.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `ssh -o ConnectTimeout=10 -o BatchMode=yes ${o} "${i}"`;
    }
    return r;
  }
  async function yd(t, e, s = {}) {
    switch (t) {
      case "bash": {
        let o = e.command,
          n = By(o);
        if (n) {
          let f = iw(o);
          return `BLOCKED: Command matches forbidden pattern: ${n}${
            f
              ? `
HINT: ${f}`
              : ""
          }`;
        }
        let r = Ky(o);
        if (r)
          return `BLOCKED: Destructive operation on protected path: ${r}
HINT: Protected files (.env, credentials, venv, .ssh, etc.) cannot be deleted or moved via bash. Override with NEX_UNPROTECT=1 if intentional.`;
        if (s.autoConfirm ? pd(o) : Gy(o)) {
          let f = pd(o) ? "\u26D4" : "\u26A0";
          if (!(await Et(`  ${f} bash: \`${o}\``, { toolName: "bash" })))
            return "CANCELLED: User declined to execute this command.";
        }
        let c;
        try {
          ((c = process.cwd()), fd.accessSync(c));
        } catch {
          ((c = require("os").homedir()),
            s.silent ||
              console.log(
                `${te.yellow}  \u26A0 Working directory no longer exists \u2014 running in ${c}${te.reset}`,
              ));
        }
        let l = ow.test(o.trim()) && !rw.test(o.trim());
        if (sw.test(o.trim()) || l) {
          s.silent ||
            console.log(`${te.dim}  \u25B6 interactive: ${o}${te.reset}`);
          let f = Wy("sh", ["-c", o], { stdio: "inherit", cwd: c });
          return f.error
            ? `ERROR: ${f.error.message}`
            : f.status === 0
              ? "(interactive command completed successfully)"
              : `(interactive command exited with code ${f.status})`;
        }
        let { ToolProgress: u } = Nn(),
          d = s.silent ? null : new u("bash", o.substring(0, 40));
        d && d.start();
        try {
          let { stdout: f, stderr: m } = await ke(o, {
            cwd: c,
            timeout: 9e4,
            maxBuffer: 5242880,
          });
          return (d && d.stop(), f || m || "(no output)");
        } catch (f) {
          d && d.stop();
          let m = (f.stderr || f.stdout || f.message || "")
              .toString()
              .substring(0, 5e3),
            h = wd(m, o);
          return `EXIT ${f.code || 1}
${h}`;
        }
      }
      case "read_file": {
        let o = at(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        if (!(await pt(o))) {
          let k = await Xo(e.path);
          if (k.fixedPath)
            ((o = k.fixedPath),
              console.log(
                `${te.dim}  \u2713 auto-fixed path: ${e.path} \u2192 ${xe.relative(process.cwd(), o)}${te.reset}`,
              ));
          else
            return `ERROR: File not found: ${e.path}${
              k.message
                ? `
` + k.message
                : ""
            }`;
        }
        let r = Buffer.alloc(8192),
          i = await fd.promises.open(o, "r"),
          { bytesRead: c } = await i.read(r, 0, 8192, 0);
        await i.close();
        for (let k = 0; k < c; k++)
          if (r[k] === 0)
            return `ERROR: ${o} is a binary file (not readable as text)`;
        let l = await Ie.readFile(o, "utf-8");
        if (!l && (await Ie.stat(o)).size > 0)
          return `WARNING: ${o} is empty or unreadable`;
        let u = l.split(`
`),
          d = await Ie.stat(o),
          f = u.length,
          m = 350,
          h = !e.line_start && !e.line_end,
          p = h && f > m,
          g = (e.line_start || 1) - 1,
          $ = p ? m : e.line_end || u.length,
          w = xe.relative(process.cwd(), o),
          _ = p
            ? `showing lines 1-${m} of ${f}`
            : e.line_start || e.line_end
              ? `lines ${g + 1}-${$} of ${f}`
              : `${f} lines`,
          x = `File: ${w} (${_}, ${d.size} bytes)`,
          v = u.slice(g, $).map((k, A) => `${g + A + 1}: ${k}`).join(`
`),
          b = p
            ? `

[File truncated: showing lines 1-${m} of ${f} total. Use line_start/line_end to read other sections, e.g. line_start=${m + 1} line_end=${Math.min(m * 2, f)}]`
            : !h && f > m
              ? `
[Large file (${f} lines total) \u2014 use line_start/line_end for other sections]`
              : "";
        return `${x}
${v}${b}`;
      }
      case "write_file": {
        await Ji();
        let o = at(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        let n = await pt(o),
          r = null;
        if (s.autoConfirm) n && (r = await Ie.readFile(o, "utf-8"));
        else if (n) {
          r = await Ie.readFile(o, "utf-8");
          let d = await Rs(o, e.content);
          if (
            (Yo(o, r, e.content, { annotations: d }), !(await Ts("Overwrite")))
          )
            return "CANCELLED: User declined to overwrite file.";
        } else {
          let d = await Rs(o, e.content);
          if ((Yy(o, e.content, { annotations: d }), !(await Ts("Create"))))
            return "CANCELLED: User declined to create file.";
        }
        let i = xe.dirname(o);
        ((await pt(i)) || (await Ie.mkdir(i, { recursive: !0 })),
          await Ie.writeFile(o, e.content, "utf-8"));
        let l =
          /[/\\]\.git[/\\]hooks[/\\]/.test(o) ||
          o.endsWith(".sh") ||
          e.content.startsWith("#!");
        (l && (await Ie.chmod(o, 493)), zo("write_file", o, r, e.content));
        let u = l ? " [chmod +x applied]" : "";
        return `Written: ${o} (${e.content.length} chars)${u}`;
      }
      case "edit_file": {
        await Ji();
        let o = at(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        if (!(await pt(o))) {
          let d = await Xo(e.path);
          if (d.fixedPath)
            ((o = d.fixedPath),
              console.log(
                `${te.dim}  \u2713 auto-fixed path: ${e.path} \u2192 ${xe.relative(process.cwd(), o)}${te.reset}`,
              ));
          else
            return `ERROR: File not found: ${e.path}${
              d.message
                ? `
` + d.message
                : ""
            }`;
        }
        let r = await Ie.readFile(o, "utf-8"),
          i = e.old_text,
          c = !1,
          l = !1;
        if (!r.includes(e.old_text)) {
          let { getActiveModelId: d, getActiveProviderName: f } = Ae();
          if (gd(d(), f()) === "strict") {
            let p = As(r, e.old_text);
            return p
              ? `ERROR: old_text not found in ${o} (strict mode \u2014 exact match required)
Most similar text (line ${p.line}, distance ${p.distance}):
${p.text}`
              : `ERROR: old_text not found in ${o} (strict mode \u2014 exact match required)`;
          }
          let h = hd(r, e.old_text);
          if (h)
            ((i = h),
              (c = !0),
              console.log(
                `${te.dim}  \u2713 fuzzy whitespace match applied${te.reset}`,
              ));
          else {
            let p = bd(r, e.old_text, e.new_text);
            if (p) {
              if (!s.autoConfirm) {
                let x = await Rs(o, p.content);
                if (
                  (Yo(o, r, p.content, { annotations: x }),
                  !(await Ts(
                    `Apply (auto-fix, line ${p.line}, distance ${p.distance})`,
                  )))
                )
                  return "CANCELLED: User declined to apply edit.";
              }
              (await Ie.writeFile(o, p.content, "utf-8"),
                (/[/\\]\.git[/\\]hooks[/\\]/.test(o) ||
                  o.endsWith(".sh") ||
                  p.content.startsWith("#!")) &&
                  (await Ie.chmod(o, 493)),
                zo("edit_file", o, r, p.content));
              let _ =
                p.matchText.length > 80
                  ? p.matchText.substring(0, 77) + "..."
                  : p.matchText;
              return (
                console.log(
                  `${te.dim}  \u2713 auto-fixed edit: line ${p.line}, distance ${p.distance}${te.reset}`,
                ),
                `Edited: ${o} (auto-fixed, line ${p.line}, distance ${p.distance}, matched: "${_}")`
              );
            }
            let g = As(r, e.old_text);
            if (g) {
              let _ = r.split(`
`),
                x = Math.max(0, g.line - 6),
                v = Math.min(_.length, g.line + 10),
                b = _.slice(x, v).map((A, O) => `${x + O + 1}: ${A}`).join(`
`),
                k = `line_start=${Math.max(1, g.line - 5)} line_end=${Math.min(_.length, g.line + 15)}`;
              return `ERROR: old_text not found in ${o} (most similar at line ${g.line}, distance ${g.distance})

Actual file content around line ${g.line} \u2014 use this to correct old_text:
${b}

Fix: update old_text to match the exact lines above, then retry. If you need more context: read_file with ${k}`;
            }
            let $ = (e.old_text || "")
                .trim()
                .split(
                  `
`,
                )[0]
                .slice(0, 60),
              w = $
                ? `
Recovery: grep -n "${$.replace(/"/g, '\\"')}" <file> to find the line, then re-read that section with line_start/line_end.`
                : `
Recovery: use grep -n to locate the text, then re-read that section with line_start/line_end.`;
            return `ERROR: old_text not found in ${o}${w}`;
          }
        }
        if (!s.autoConfirm) {
          let d = r.split(i).join(e.new_text),
            f = await Rs(o, d);
          if (
            (Yo(o, r, d, { annotations: f }),
            !(await Ts(c ? "Apply (fuzzy match)" : "Apply")))
          )
            return "CANCELLED: User declined to apply edit.";
        }
        let u = r.split(i).join(e.new_text);
        return (
          await Ie.writeFile(o, u, "utf-8"),
          (/[/\\]\.git[/\\]hooks[/\\]/.test(o) ||
            o.endsWith(".sh") ||
            u.startsWith("#!")) &&
            (await Ie.chmod(o, 493)),
          zo("edit_file", o, r, u),
          c ? `Edited: ${o} (fuzzy match)` : `Edited: ${o}`
        );
      }
      case "list_directory": {
        let o = at(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        if (!(await pt(o))) {
          let u = e.path
              .replace(/\/+/g, "/")
              .replace(/^~\//, `${require("os").homedir()}/`),
            d = at(u),
            f = await pt(d);
          if (d && f) o = d;
          else return `ERROR: Directory not found: ${e.path}`;
        }
        let r = e.max_depth || 2,
          i = null;
        if (e.pattern)
          try {
            let u = e.pattern
              .replace(/[.+^${}()|[\]\\]/g, "\\$&")
              .replace(/\*/g, ".*");
            i = new RegExp(`^${u}$`);
          } catch {
            return `ERROR: Invalid pattern: ${e.pattern}`;
          }
        let c = [],
          l = async (u, d, f) => {
            if (d > r) return;
            let m;
            try {
              m = await Ie.readdir(u, { withFileTypes: !0 });
            } catch {
              return;
            }
            m = m.filter(
              (h) => !h.name.startsWith(".") && h.name !== "node_modules",
            );
            for (let h of m) {
              if (i && !h.isDirectory() && !i.test(h.name)) continue;
              let p = h.isDirectory() ? "/" : "";
              (c.push(`${f}${h.name}${p}`),
                h.isDirectory() &&
                  (await l(xe.join(u, h.name), d + 1, f + "  ")));
            }
          };
        return (
          await l(o, 1, ""),
          c.join(`
`) || "(empty)"
        );
      }
      case "search_files": {
        let o = at(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        let n = ["-rn", "--null", "-H"];
        (e.file_pattern && n.push(`--include=${e.file_pattern}`),
          n.push(e.pattern, o));
        try {
          let { stdout: r } = await Yi("grep", n, {
              cwd: process.cwd(),
              timeout: 3e4,
              maxBuffer: 2097152,
            }),
            i = r.split("\0"),
            c = [];
          for (let l = 0; l < i.length; l += 2) {
            let u = i[l],
              d = i[l + 1];
            if (u && d) {
              let f = d
                .split(
                  `
`,
                )
                .filter((m) => m.trim());
              for (let m of f) if ((c.push(`${u}:${m}`), c.length >= 50)) break;
            }
            if (c.length >= 50) break;
          }
          return (
            c.join(`
`) || "(no matches)"
          );
        } catch {
          return "(no matches)";
        }
      }
      case "glob": {
        let n = process.cwd(),
          r = e.path ? at(e.path) : n,
          i = e.pattern,
          c = (O) => {
            let P = O.replace(/[.+^${}()|[\]\\]/g, "\\$&")
              .replace(/\*\*\//g, "(.*/)?")
              .replace(/\*\*/g, ".*")
              .replace(/\*/g, "[^/]*")
              .replace(/\?/g, ".");
            return new RegExp(`^${P}$`);
          },
          l = c(i),
          u = i.split("/").pop(),
          d = c(u),
          { ToolProgress: f } = Nn(),
          m = new f("glob", "Finding files...");
        m.start();
        let {
            getFileIndex: h,
            getIndexedCwd: p,
            refreshIndex: g,
            isIndexValid: $,
          } = Ri(),
          w = h(),
          _ = p();
        $(r) || (await g(r), (w = h()));
        let x = w
          .filter((O) => l.test(O) || d.test(xe.basename(O)))
          .map((O) => xe.join(r, O));
        if (x.length === 0) return (m.stop(), "(no matches)");
        let v = await Promise.all(
          x.slice(0, 210).map(async (O) => {
            try {
              let P = await Ie.stat(O);
              return { path: O, mtime: P.mtimeMs };
            } catch {
              return { path: O, mtime: 0 };
            }
          }),
        );
        v.sort((O, P) => P.mtime - O.mtime);
        let b = v.map((O) => O.path),
          k = x.length > 200,
          A = b.slice(0, 200).join(`
`);
        return (
          m.update({ count: x.length, detail: e.pattern }),
          m.stop(),
          k
            ? `${A}

\u26A0 Results truncated at 200. Use a more specific pattern.`
            : A
        );
      }
      case "grep": {
        let o = e.path ? at(e.path) : process.cwd();
        if (e.staged) {
          let { getDiff: l } = en(),
            u = await l(!0);
          if (!u.trim()) return "(no staged changes)";
          let d = new Set(),
            f = u.split(`
`);
          for (let $ of f)
            if ($.startsWith("diff --git")) {
              let w = $.match(/diff --git a\/(.+) b\/(.+)/);
              w && d.add(w[2]);
            }
          let m = [
            "-rn",
            "-E",
            "--null",
            "-H",
            "--exclude=*.md",
            "--exclude=*.txt",
            "--exclude=*.json",
            "--exclude=*.yaml",
            "--exclude=*.yml",
          ];
          (e.ignore_case && m.push("-i"),
            e.include && m.push(`--include=${e.include}`),
            e.type && m.push(`--include=*.${e.type}`),
            e.context
              ? m.push("-C", String(e.context))
              : (e.before_context && m.push("-B", String(e.before_context)),
                e.after_context && m.push("-A", String(e.after_context))),
            e.output_mode === "files_with_matches"
              ? m.push("-l")
              : e.output_mode === "count" && m.push("-c"),
            m.push(
              "--exclude-dir=node_modules",
              "--exclude-dir=.git",
              "--exclude-dir=coverage",
            ));
          let { ToolProgress: h } = Nn(),
            p = new h("grep", "Searching staged content...");
          p.start();
          let g = [];
          for (let $ of d)
            try {
              let w = xe.join(process.cwd(), $);
              if (await pt(w)) {
                let _ = [...m];
                _.push(e.pattern, w);
                let { stdout: x } = await Yi("grep", _, {
                  cwd: process.cwd(),
                  timeout: 3e4,
                  maxBuffer: 2 * 1024 * 1024,
                });
                if (
                  e.output_mode === "files_with_matches" ||
                  e.output_mode === "count"
                ) {
                  let v = x
                    .trim()
                    .split(
                      `
`,
                    )
                    .filter((b) => b.trim());
                  g = g.concat(v);
                } else {
                  let v = x.split("\0");
                  for (let b = 0; b < v.length; b += 2) {
                    let k = v[b + 1];
                    if (k) {
                      let A = k
                        .split(
                          `
`,
                        )
                        .filter((O) => O.trim());
                      for (let O of A) g.push(`${$}:${O}`);
                    }
                  }
                }
              }
            } catch {}
          return (
            p.update({ count: g.length, detail: "in staged files" }),
            p.stop(),
            g
              .join(
                `
`,
              )
              .trim() || "(no matches in staged files)"
          );
        }
        let n = ["-rn", "-E", "--null", "-H"];
        (e.ignore_case && n.push("-i"),
          e.include && n.push(`--include=${e.include}`),
          e.type && n.push(`--include=*.${e.type}`));
        let r = 20;
        (e.context
          ? n.push("-C", String(Math.min(Number(e.context), r)))
          : (e.before_context &&
              n.push("-B", String(Math.min(Number(e.before_context), r))),
            e.after_context &&
              n.push("-A", String(Math.min(Number(e.after_context), r)))),
          e.output_mode === "files_with_matches"
            ? n.push("-l")
            : e.output_mode === "count" && n.push("-c"),
          n.push(
            "--exclude-dir=node_modules",
            "--exclude-dir=.git",
            "--exclude-dir=coverage",
          ),
          n.push(e.pattern, o));
        let { ToolProgress: i } = Nn(),
          c = new i("grep", "Searching...");
        c.start();
        try {
          let { stdout: l } = await Yi("grep", n, {
              cwd: process.cwd(),
              timeout: 3e4,
              maxBuffer: 2097152,
            }),
            u;
          if (
            e.output_mode === "files_with_matches" ||
            e.output_mode === "count"
          )
            u = l
              .trim()
              .split(
                `
`,
              )
              .filter((m) => m.trim());
          else {
            let m = l.split("\0");
            u = [];
            for (let h = 0; h < m.length; h += 2) {
              let p = m[h],
                g = m[h + 1];
              if (p && g) {
                let $ = g
                  .split(
                    `
`,
                  )
                  .filter((w) => w.trim());
                for (let w of $) u.push(`${p}:${w}`);
              }
            }
          }
          let d = e.offset || 0,
            f =
              e.head_limit ||
              (e.output_mode === "files_with_matches" ? 200 : 100);
          return (
            (u = u.slice(d, d + f)),
            c.update({ count: u.length, detail: `in ${o}` }),
            c.stop(),
            u
              .join(
                `
`,
              )
              .trim() || "(no matches)"
          );
        } catch (l) {
          return (
            c.stop(),
            l.code === 2
              ? `ERROR: Invalid regex pattern: ${e.pattern}`
              : "(no matches)"
          );
        }
      }
      case "patch_file": {
        await Ji();
        let o = at(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        if (!(await pt(o))) {
          let w = await Xo(e.path);
          if (w.fixedPath)
            ((o = w.fixedPath),
              console.log(
                `${te.dim}  \u2713 auto-fixed path: ${e.path} \u2192 ${xe.relative(process.cwd(), o)}${te.reset}`,
              ));
          else
            return `ERROR: File not found: ${e.path}${
              w.message
                ? `
` + w.message
                : ""
            }`;
        }
        let r = e.patches;
        if (!Array.isArray(r) || r.length === 0)
          return "ERROR: No patches provided";
        let i = await Ie.readFile(o, "utf-8"),
          { getActiveModelId: c, getActiveProviderName: l } = Ae(),
          u = gd(c(), l()),
          d = [],
          f = !1,
          m = !1;
        for (let w = 0; w < r.length; w++) {
          let { old_text: _, new_text: x } = r[w];
          if (i.includes(_)) d.push({ old_text: _, new_text: x });
          else if (u === "strict") {
            let v = As(i, _);
            return v
              ? `ERROR: Patch ${w + 1} old_text not found in ${o} (strict mode \u2014 exact match required)
Most similar text (line ${v.line}, distance ${v.distance}):
${v.text}`
              : `ERROR: Patch ${w + 1} old_text not found in ${o} (strict mode \u2014 exact match required)`;
          } else {
            let v = hd(i, _);
            if (v) (d.push({ old_text: v, new_text: x }), (f = !0));
            else {
              let b = As(i, _);
              if (b) {
                let k = Math.max(3, Math.ceil(_.length * 0.05));
                if (b.distance <= k)
                  (d.push({ old_text: b.text, new_text: x }), (m = !0));
                else
                  return `ERROR: Patch ${w + 1} old_text not found in ${o}
Most similar text (line ${b.line}, distance ${b.distance}):
${b.text}`;
              } else return `ERROR: Patch ${w + 1} old_text not found in ${o}`;
            }
          }
        }
        let h = i;
        for (let { old_text: w, new_text: _ } of d) h = h.split(w).join(_);
        if (!s.autoConfirm) {
          let w = await Rs(o, h);
          if (
            (Yo(o, i, h, { annotations: w }),
            !(await Ts(f ? "Apply patches (fuzzy match)" : "Apply patches")))
          )
            return "CANCELLED: User declined to apply patches.";
        }
        await Ie.writeFile(o, h, "utf-8");
        let p =
          /[/\\]\.git[/\\]hooks[/\\]/.test(o) ||
          o.endsWith(".sh") ||
          h.startsWith("#!");
        (p && (await Ie.chmod(o, 493)), zo("patch_file", o, i, h));
        let g = m ? " (auto-fixed)" : f ? " (fuzzy match)" : "",
          $ = p ? " [chmod +x applied]" : "";
        return `Patched: ${o} (${r.length} replacements)${g}${$}`;
      }
      case "web_fetch": {
        let o = e.url,
          n = e.max_length || 1e4;
        try {
          let r = await zi.get(o, {
            timeout: 15e3,
            maxContentLength: 1048576,
            responseType: "text",
            headers: { "User-Agent": "nex-code/0.2.0" },
          });
          return (
            (typeof r.data == "string" ? r.data : JSON.stringify(r.data))
              .replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .substring(0, n) || "(empty response)"
          );
        } catch (r) {
          return `ERROR: Failed to fetch ${o}: ${r.message}`;
        }
      }
      case "web_search": {
        let o = e.max_results || 5;
        if (process.env.PERPLEXITY_API_KEY)
          try {
            let n = await zi.post(
                "https://api.perplexity.ai/chat/completions",
                {
                  model: "sonar",
                  messages: [{ role: "user", content: e.query }],
                  max_tokens: 1024,
                  search_recency_filter: "month",
                  return_citations: !0,
                },
                {
                  timeout: 2e4,
                  headers: {
                    Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                },
              ),
              r = n.data?.choices?.[0]?.message?.content || "",
              i = n.data?.citations || [],
              c = `[Perplexity grounded search]

${r}`;
            return (
              i.length > 0 &&
                (c +=
                  `

Sources:
` +
                  i.slice(0, o).map((l, u) => `${u + 1}. ${l}`).join(`
`)),
              c
            );
          } catch (n) {
            console.error(
              `${te.dim}  Perplexity search failed (${n.message}), falling back to DuckDuckGo${te.reset}`,
            );
          }
        try {
          let r = (
              await zi.get("https://html.duckduckgo.com/html/", {
                params: { q: e.query },
                timeout: 1e4,
                responseType: "text",
                headers: { "User-Agent": "nex-code/0.2.0" },
              })
            ).data,
            i = [],
            c =
              /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
            l;
          for (; (l = c.exec(r)) !== null && i.length < o; ) {
            let u = l[1].replace(/.*uddg=/, "").split("&")[0],
              d = l[2].replace(/<[^>]+>/g, "").trim();
            try {
              i.push({ title: d, url: decodeURIComponent(u) });
            } catch {
              i.push({ title: d, url: u });
            }
          }
          return i.length === 0
            ? "(no results)"
            : i.map(
                (u, d) => `${d + 1}. ${u.title}
   ${u.url}`,
              ).join(`

`);
        } catch {
          return "ERROR: Web search failed";
        }
      }
      case "browser_open": {
        let { browserNavigate: o } = ws();
        try {
          let n = await o(e.url, { waitFor: e.wait_for }),
            r =
              n.links.length > 0
                ? `

Links:
` +
                  n.links.map((i) => `  ${i.text} \u2192 ${i.href}`).join(`
`)
                : "";
          return `Title: ${n.title}
URL: ${n.url}

${n.text}${r}`;
        } catch (n) {
          return `ERROR: ${n.message}`;
        }
      }
      case "browser_screenshot": {
        let { browserScreenshot: o } = ws();
        try {
          let n = await o(e.url, {
            width: e.width,
            height: e.height,
            fullPage: e.full_page,
          });
          return `Screenshot saved: ${n.path}
Title: ${n.title}
URL: ${n.url}

To analyze visually, paste the path into your next message: ${n.path}`;
        } catch (n) {
          return `ERROR: ${n.message}`;
        }
      }
      case "browser_click": {
        let { browserClick: o } = ws();
        try {
          return await o(e.url, { selector: e.selector, text: e.text });
        } catch (n) {
          return `ERROR: ${n.message}`;
        }
      }
      case "browser_fill": {
        let { browserFill: o } = ws();
        try {
          return await o(e.url, {
            selector: e.selector,
            value: e.value,
            submit: e.submit,
          });
        } catch (n) {
          return `ERROR: ${n.message}`;
        }
      }
      case "ask_user": {
        let { question: o, options: n = [] } = e;
        return Vi
          ? new Promise((r) => {
              ((wn = () => r("CANCELLED")),
                Vi(o, n).then((i) => {
                  ((wn = null), r(i || "User did not answer"));
                }));
            })
          : new Promise((r) => {
              let i = require("readline").createInterface({
                input: process.stdin,
                output: process.stdout,
              });
              wn = () => {
                (i.close(), r("CANCELLED"));
              };
              let c =
                n.length > 0
                  ? `
${n.map((l, u) => `  ${u + 1}. ${l}`).join(`
`)}
`
                  : "";
              (console.log(`
${te.cyan}${te.bold}  ? ${o}${te.reset}${c}`),
                i.question(`${te.cyan}  > ${te.reset}`, (l) => {
                  ((wn = null), i.close(), r(l.trim() || "(no response)"));
                }));
            });
      }
      case "git_status": {
        if (!(await Xi())) return "ERROR: Not a git repository";
        let o = (await md()) || "(detached)",
          n = await Jy();
        if (n.length === 0)
          return `Branch: ${o}
Clean working tree (no changes)`;
        let r = [`Branch: ${o}`, `Changed files (${n.length}):`];
        for (let i of n) {
          let c =
            i.status === "M"
              ? "modified"
              : i.status === "A"
                ? "added"
                : i.status === "D"
                  ? "deleted"
                  : i.status === "??"
                    ? "untracked"
                    : i.status;
          r.push(`  ${c}: ${i.file}`);
        }
        return r.join(`
`);
      }
      case "git_diff": {
        if (!(await Xi())) return "ERROR: Not a git repository";
        let o;
        if (e.file) {
          let n = ["diff"];
          (e.staged && n.push("--cached"), n.push("--", e.file));
          try {
            o = execFileSync("git", n, {
              cwd: process.cwd(),
              encoding: "utf-8",
              timeout: 15e3,
              stdio: "pipe",
            }).trim();
          } catch {
            o = "";
          }
        } else o = await Vy(!!e.staged);
        return o || "(no diff)";
      }
      case "git_log": {
        if (!(await Xi())) return "ERROR: Not a git repository";
        let n = ["log", "--oneline", `-${Math.min(e.count || 10, 50)}`];
        e.file && n.push("--", e.file);
        try {
          return (
            execFileSync("git", n, {
              cwd: process.cwd(),
              encoding: "utf-8",
              timeout: 15e3,
              stdio: "pipe",
            }).trim() || "(no commits)"
          );
        } catch {
          return "(no commits)";
        }
      }
      case "task_list": {
        let {
            createTasks: o,
            updateTask: n,
            getTaskList: r,
            renderTaskList: i,
            hasActiveTasks: c,
          } = Fo(),
          { getActiveTaskProgress: l } = Ce(),
          u = l();
        switch (e.action) {
          case "create": {
            if (!e.name || !e.tasks)
              return "ERROR: task_list create requires name and tasks";
            let d = o(e.name, e.tasks);
            return (
              u ||
                console.log(
                  `
` + i(),
                ),
              `Created task list "${e.name}" with ${d.length} tasks:
` +
                d.map((f) => `  ${f.id}: ${f.description}`).join(`
`)
            );
          }
          case "update":
            return !e.task_id || !e.status
              ? "ERROR: task_list update requires task_id and status"
              : n(e.task_id, e.status, e.result)
                ? (u ||
                    console.log(
                      `
` + i(),
                    ),
                  `Updated ${e.task_id}: ${e.status}${e.result ? " \u2014 " + e.result : ""}`)
                : `ERROR: Task not found: ${e.task_id}`;
          case "get": {
            let d = r();
            return d.tasks.length === 0
              ? "No active tasks"
              : (u ||
                  console.log(
                    `
` + i(),
                  ),
                JSON.stringify(d, null, 2));
          }
          default:
            return `ERROR: Unknown task_list action: ${e.action}. Use: create, update, get`;
        }
      }
      case "spawn_agents": {
        let { executeSpawnAgents: o } = Ho();
        return o(e);
      }
      case "switch_model": {
        let {
          setActiveModel: o,
          getActiveProviderName: n,
          getActiveModelId: r,
        } = Ae();
        return o(e.model)
          ? `Switched to ${n()}:${r()}`
          : `ERROR: Unknown model: ${e.model}. Use /providers to see available models.`;
      }
      case "gh_run_list": {
        let o = Math.min(e.limit || 10, 30),
          n = [
            "run",
            "list",
            "--limit",
            String(o),
            "--json",
            "databaseId,status,conclusion,name,headBranch,createdAt,updatedAt,event",
          ];
        (e.workflow && n.push("--workflow", e.workflow),
          e.branch && n.push("--branch", e.branch),
          e.status && n.push("--status", e.status));
        try {
          let { stdout: r } = await ke(`gh ${n.join(" ")}`, {
              cwd: process.cwd(),
              timeout: 3e4,
            }),
            i = JSON.parse(r || "[]");
          return i.length === 0
            ? "No workflow runs found."
            : i.map((l) => {
                let u = l.conclusion || l.status || "unknown",
                  d =
                    u === "success"
                      ? "\u2713"
                      : u === "failure"
                        ? "\u2717"
                        : u === "in_progress"
                          ? "\u283F"
                          : "\u25CB",
                  f = l.updatedAt
                    ? new Date(l.updatedAt)
                        .toISOString()
                        .slice(0, 16)
                        .replace("T", " ")
                    : "";
                return `${d} [${l.databaseId}] ${l.name} \xB7 ${l.headBranch} \xB7 ${u} \xB7 ${f}`;
              }).join(`
`);
        } catch (r) {
          let i = (r.stderr || r.message || "").toString();
          return i.includes("not found") || i.includes("not logged")
            ? "ERROR: gh CLI not found or not authenticated. Run: gh auth login"
            : `ERROR: ${
                i.split(`
`)[0]
              }`;
        }
      }
      case "gh_run_view": {
        if (!e.run_id) return "ERROR: run_id is required";
        try {
          if (e.log) {
            let { stdout: i } = await ke(`gh run view ${e.run_id} --log`, {
              cwd: process.cwd(),
              timeout: 6e4,
              maxBuffer: 5242880,
            });
            return (
              i.substring(0, 8e3) +
              (i.length > 8e3
                ? `
...(truncated)`
                : "")
            );
          }
          let { stdout: o } = await ke(
              `gh run view ${e.run_id} --json status,conclusion,name,headBranch,createdAt,updatedAt,jobs`,
              { cwd: process.cwd(), timeout: 3e4 },
            ),
            n = JSON.parse(o),
            r = [
              `Run: ${n.name} [${e.run_id}]`,
              `Branch: ${n.headBranch}  Status: ${n.conclusion || n.status}`,
              `Started: ${n.createdAt}  Finished: ${n.updatedAt || "\u2014"}`,
              "",
              "Jobs:",
            ];
          for (let i of n.jobs || []) {
            let c =
              i.conclusion === "success"
                ? "\u2713"
                : i.conclusion === "failure"
                  ? "\u2717"
                  : "\u25CB";
            r.push(`  ${c} ${i.name} (${i.conclusion || i.status})`);
            for (let l of i.steps || []) {
              if (l.conclusion === "failure" || l.conclusion === "skipped")
                continue;
              let u =
                l.conclusion === "success"
                  ? "  \u2713"
                  : l.conclusion === "failure"
                    ? "  \u2717"
                    : "  \u25CB";
              r.push(`    ${u} ${l.name}`);
            }
          }
          return r.join(`
`);
        } catch (o) {
          return `ERROR: ${
            (o.stderr || o.message || "").toString().split(`
`)[0]
          }`;
        }
      }
      case "gh_workflow_trigger": {
        if (!e.workflow) return "ERROR: workflow is required";
        let { confirm: o } = Ye(),
          n = e.branch || (await md()) || "main",
          r = e.inputs
            ? Object.entries(e.inputs)
                .map(([l, u]) => `-f ${l}=${u}`)
                .join(" ")
            : "",
          i = `gh workflow run ${e.workflow} --ref ${n} ${r}`.trim();
        if (
          (console.log(`
${te.yellow}  \u26A0 Trigger workflow: ${e.workflow} on ${n}${te.reset}`),
          !(await o("  Trigger?")))
        )
          return "CANCELLED: User declined to trigger workflow.";
        try {
          return (
            await ke(i, { cwd: process.cwd(), timeout: 3e4 }),
            `Workflow "${e.workflow}" triggered on branch "${n}". Check status with gh_run_list.`
          );
        } catch (l) {
          return `ERROR: ${
            (l.stderr || l.message || "").toString().split(`
`)[0]
          }`;
        }
      }
      case "k8s_pods": {
        let o = e.namespace ? `-n ${e.namespace}` : "-A",
          n = e.label ? `-l ${e.label}` : "",
          r = Cs(`get pods ${o} ${n} -o wide`.trim(), e);
        try {
          let { stdout: i, stderr: c } = await ke(r, {
            timeout: 3e4,
            maxBuffer: 2097152,
          });
          return (i || c || "(no pods)").trim();
        } catch (i) {
          let c = (i.stderr || i.message || "").toString().split(`
`)[0];
          return c.includes("command not found")
            ? "ERROR: kubectl not found. Install kubectl or provide a server with kubectl."
            : `ERROR: ${c}`;
        }
      }
      case "k8s_logs": {
        if (!e.pod) return "ERROR: pod is required";
        let o = e.namespace || "default",
          n = e.tail || 100,
          r = `logs ${e.pod} -n ${o} --tail=${n}`;
        (e.since && (r += ` --since=${e.since}`),
          e.container && (r += ` -c ${e.container}`));
        let i = Cs(r, e);
        try {
          let { stdout: c, stderr: l } = await ke(i, {
              timeout: 6e4,
              maxBuffer: 5242880,
            }),
            u = (c || l || "(no logs)").trim();
          return (
            u.substring(0, 2e4) +
            (u.length > 2e4
              ? `
...(truncated)`
              : "")
          );
        } catch (c) {
          return `ERROR: ${
            (c.stderr || c.message || "").toString().split(`
`)[0]
          }`;
        }
      }
      case "k8s_exec": {
        if (!e.pod) return "ERROR: pod is required";
        if (!e.command) return "ERROR: command is required";
        let o = e.namespace || "default";
        if (
          (console.log(`
${te.yellow}  \u26A0 kubectl exec into pod: ${e.pod} (ns: ${o})${te.reset}`),
          console.log(`${te.dim}  Command: ${e.command}${te.reset}`),
          !(await Et("  Execute in pod?")))
        )
          return "CANCELLED: User declined.";
        let r = `exec ${e.pod} -n ${o}`;
        (e.container && (r += ` -c ${e.container}`),
          (r += ` -- sh -c ${JSON.stringify(e.command)}`));
        let i = Cs(r, e);
        try {
          let { stdout: c, stderr: l } = await ke(i, {
            timeout: 6e4,
            maxBuffer: 2097152,
          });
          return (c || l || "(no output)").trim();
        } catch (c) {
          return `ERROR: ${
            (c.stderr || c.message || "").toString().split(`
`)[0]
          }`;
        }
      }
      case "k8s_apply": {
        if (!e.file) return "ERROR: file is required";
        let o = !!e.dry_run;
        if (!o) {
          let i = e.file;
          if (
            (console.log(`
${te.yellow}  \u26A0 kubectl apply: ${i}${e.namespace ? ` (ns: ${e.namespace})` : ""}${te.reset}`),
            !(await Et("  Apply to cluster?")))
          )
            return "CANCELLED: User declined.";
        }
        let n = `apply -f ${e.file}`;
        (e.namespace && (n += ` -n ${e.namespace}`),
          o && (n += " --dry-run=client"));
        let r = Cs(n, e);
        try {
          let { stdout: i, stderr: c } = await ke(r, {
            timeout: 12e4,
            maxBuffer: 2097152,
          });
          return (i || c || "(no output)").trim();
        } catch (i) {
          return `ERROR: ${
            (i.stderr || i.message || "").toString().split(`
`)[0]
          }`;
        }
      }
      case "k8s_rollout": {
        if (!e.action) return "ERROR: action is required";
        if (!e.deployment) return "ERROR: deployment is required";
        let o = e.namespace || "default";
        if (e.action === "restart" || e.action === "undo") {
          let c =
            e.action === "restart" ? "Rolling restart" : "Rollback (undo)";
          if (
            (console.log(`
${te.yellow}  \u26A0 ${c}: deployment/${e.deployment} (ns: ${o})${te.reset}`),
            !(await Et(`  ${c}?`)))
          )
            return "CANCELLED: User declined.";
        }
        let r = `rollout ${e.action} deployment/${e.deployment} -n ${o}`,
          i = Cs(r, e);
        try {
          let { stdout: c, stderr: l } = await ke(i, {
            timeout: 12e4,
            maxBuffer: 2097152,
          });
          return (c || l || "(no output)").trim();
        } catch (c) {
          return `ERROR: ${
            (c.stderr || c.message || "").toString().split(`
`)[0]
          }`;
        }
      }
      case "brain_write": {
        if (!e.name) return "ERROR: name is required";
        if (!e.content) return "ERROR: content is required";
        if (!e.mode) return "ERROR: mode is required (create, update, append)";
        let { writeDocument: o, readDocument: n } = Ss(),
          { name: r, content: i, mode: c } = e;
        if (c === "create" && n(r).content)
          return `ERROR: Document "${r}" already exists. Use mode "update" to overwrite.`;
        if (c === "append") {
          let l = n(r),
            u = l.content
              ? l.content +
                `

` +
                i
              : i;
          return (o(r, u), `Appended to brain document: ${r}.md`);
        }
        return (
          o(r, i),
          `${c === "create" ? "Created" : "Updated"} brain document: ${r}.md`
        );
      }
      case "ssh_exec": {
        if (!e.server) return "ERROR: server is required";
        if (!e.command) return "ERROR: command is required";
        let o;
        try {
          o = xt(e.server);
        } catch (k) {
          return `ERROR: ${k.message}`;
        }
        let n = e.command,
          r = !!e.sudo,
          i = (e.timeout || 30) * 1e3,
          c = Hy(n);
        if (c)
          return /\bsed\s+-n\s+['"]?\d+,\d+p/.test(n)
            ? `BLOCKED: sed -n line-range is blocked (floods context). To read specific lines from a remote file use:
  grep -n "pattern" /path/to/file -A 50
or to read the whole file:
  cat /path/to/file
NEVER use sed -n again \u2014 it will always be blocked.`
            : `BLOCKED: Remote command matches SSH secret-exposure pattern: ${c}
HINT: Do not read .env, credentials, or private key files via ssh_exec \u2014 secrets would appear in tool output. Reference variable names or file paths instead.`;
        if (
          ((n = n.replace(/(-[BAC])\s*(\d+)/g, (k, A, O) => {
            let P = Math.min(Number(O), 20);
            return `${A} ${P}`;
          })),
          (n = n.replace(
            /(--(?:before|after|context)=)(\d+)/g,
            (k, A, O) => A + Math.min(Number(O), 20),
          )),
          /\b(rm|rmdir|mv|cp|chmod|chown|dd|mkfs|systemctl\s+(start|stop|restart|reload|enable|disable)|dnf\s+(install|remove|update|upgrade)|yum\s+(install|remove)|apt(-get)?\s+(install|remove|purge)|pip\s+install|pip3\s+install|firewall-cmd\s+--permanent|semanage|setsebool|passwd|userdel|useradd|nginx\s+-s\s+(reload|stop)|service\s+\w+\s+(start|stop|restart))\b/.test(
            n,
          ))
        ) {
          let k = o.user ? `${o.user}@${o.host}` : o.host;
          if (
            (console.log(`
${te.yellow}  \u26A0 Remote command on ${k}: ${n}${te.reset}`),
            !(await Et("  Execute on remote server?")))
          )
            return "CANCELLED: User declined to execute remote command.";
        }
        let {
            stdout: u,
            stderr: d,
            exitCode: f,
            error: m,
          } = await it(o, n, { timeout: i, sudo: r }),
          h = [u, d]
            .filter(Boolean)
            .join(
              `
`,
            )
            .trim();
        if (f !== 0)
          return `EXIT ${f}
${m || h || "(no output)"}`;
        let p = /\bgrep\b/.test(n),
          g = h;
        p &&
          (g = g
            .split(
              `
`,
            )
            .filter((k) => k !== "--").join(`
`));
        let $ = p ? 100 : 200,
          w = g.split(`
`);
        w.length > $ &&
          (g =
            `(${w.length - $} earlier lines omitted \u2014 showing last ${$})
` +
            w.slice(-$).join(`
`));
        let _ = 4,
          x = g.split(`
`),
          v = [],
          b = 0;
        for (; b < x.length; ) {
          let k = b + 1;
          for (; k < x.length && x[k] === x[b]; ) k++;
          let A = k - b;
          if ((v.push(x[b]), A > _))
            v.push(`... (${A - 1} identical lines omitted)`);
          else for (let O = 1; O < A; O++) v.push(x[b]);
          b = k;
        }
        return (
          v.join(`
`) || "(command completed, no output)"
        );
      }
      case "ssh_upload": {
        if (!e.server || !e.local_path || !e.remote_path)
          return "ERROR: server, local_path, and remote_path are required";
        let o;
        try {
          o = xt(e.server);
        } catch (i) {
          return `ERROR: ${i.message}`;
        }
        let n = o.user ? `${o.user}@${o.host}` : o.host;
        if (
          (console.log(`
${te.yellow}  \u26A0 Upload: ${e.local_path} \u2192 ${n}:${e.remote_path}${te.reset}`),
          !(await Et("  Upload to remote server?")))
        )
          return "CANCELLED: User declined upload.";
        try {
          return await Zy(o, e.local_path, e.remote_path);
        } catch (i) {
          return `ERROR: ${i.message}`;
        }
      }
      case "ssh_download": {
        if (!e.server || !e.remote_path || !e.local_path)
          return "ERROR: server, remote_path, and local_path are required";
        let o;
        try {
          o = xt(e.server);
        } catch (n) {
          return `ERROR: ${n.message}`;
        }
        try {
          return await ew(o, e.remote_path, e.local_path);
        } catch (n) {
          return `ERROR: ${n.message}`;
        }
      }
      case "remote_agent": {
        let o = require("path").join(process.cwd(), ".nex", "servers.json"),
          n = null;
        try {
          n =
            JSON.parse(require("fs").readFileSync(o, "utf-8"))[e.server] ||
            null;
        } catch {}
        let r = n ? `${n.user || "root"}@${n.host}` : e.server,
          i = n?.key ? ["-i", n.key] : [],
          c = e.project_path || n?.home || "~",
          l = e.model || "",
          d = [
            "TMPFILE=$(mktemp /tmp/nexcode-XXXXXX.txt)",
            `echo "${Buffer.from(e.task).toString("base64")}" | base64 -d > "$TMPFILE"`,
            `cd "${c}" 2>/dev/null || true`,
            l
              ? `nex-code --prompt-file "$TMPFILE" --auto --model "${l}" 2>&1`
              : 'nex-code --prompt-file "$TMPFILE" --auto 2>&1',
            "EXIT_CODE=$?",
            'rm -f "$TMPFILE"',
            "exit $EXIT_CODE",
          ].join(" && "),
          { spawnSync: f } = require("child_process"),
          m = f(
            "ssh",
            [
              ...i,
              "-o",
              "StrictHostKeyChecking=no",
              "-o",
              "ConnectTimeout=10",
              r,
              `bash -c '${d}'`,
            ],
            { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, timeout: 3e5 },
          );
        if (m.error) return `ERROR: SSH connection failed: ${m.error.message}`;
        let h = (m.stdout || "") + (m.stderr || "");
        return m.status !== 0
          ? `Remote nex-code exited with code ${m.status}.
${h.slice(-2e3)}`
          : h.slice(-5e3) || "Remote nex-code completed (no output)";
      }
      case "service_manage": {
        if (!e.service) return "ERROR: service is required";
        if (!e.action) return "ERROR: action is required";
        let o = [
          "status",
          "start",
          "stop",
          "restart",
          "reload",
          "enable",
          "disable",
        ];
        if (!o.includes(e.action))
          return `ERROR: invalid action "${e.action}". Valid: ${o.join(", ")}`;
        let n = !e.server || e.server === "local" || e.server === "localhost",
          r = e.action === "status",
          i = null;
        if (!n)
          try {
            i = xt(e.server);
          } catch (l) {
            return `ERROR: ${l.message}`;
          }
        if (!r) {
          let l = n ? "local machine" : i.user ? `${i.user}@${i.host}` : i.host;
          if (
            (console.log(`
${te.yellow}  \u26A0 Service: systemctl ${e.action} ${e.service} on ${l}${te.reset}`),
            !(await Et("  Execute?")))
          )
            return "CANCELLED: User declined service action.";
        }
        let c = `systemctl ${e.action} ${e.service}`;
        if (n) {
          let u = e.action !== "status" ? `sudo ${c}` : c;
          try {
            let { stdout: d, stderr: f } = await ke(u, { timeout: 15e3 });
            return (d || f || `systemctl ${e.action} ${e.service}: OK`).trim();
          } catch (d) {
            let f = (d.stderr || d.message || "").toString().trim();
            return /not found|loaded.*not-found/i.test(f)
              ? `ERROR: Service "${e.service}" not found. Check: systemctl list-units --type=service`
              : `EXIT ${d.code || 1}
${f}`;
          }
        } else {
          let {
              stdout: l,
              stderr: u,
              exitCode: d,
              error: f,
            } = await it(i, c, { timeout: 15e3, sudo: !0 }),
            m = [l, u]
              .filter(Boolean)
              .join(
                `
`,
              )
              .trim();
          return d !== 0
            ? /not found|loaded.*not-found/i.test(m)
              ? `ERROR: Service "${e.service}" not found on ${i.host}. Check: ssh_exec to run "systemctl list-units --type=service"`
              : `EXIT ${d}
${f || m || "(no output)"}`
            : m || `systemctl ${e.action} ${e.service}: OK`;
        }
      }
      case "service_logs": {
        if (!e.service) return "ERROR: service is required";
        let o = !e.server || e.server === "local" || e.server === "localhost",
          n = e.lines || 50,
          r = e.since ? `--since "${e.since}"` : "",
          i = e.follow ? "-f" : "",
          c = `journalctl -u ${e.service} -n ${n} ${r} ${i} --no-pager`
            .trim()
            .replace(/\s+/g, " ");
        if (o)
          try {
            let { stdout: p, stderr: g } = await ke(c, { timeout: 15e3 });
            return (p || g || "(no log output)").trim();
          } catch (p) {
            return `EXIT ${p.code || 1}
${(p.stderr || p.message || "").toString().trim()}`;
          }
        let l;
        try {
          l = xt(e.server);
        } catch (p) {
          return `ERROR: ${p.message}`;
        }
        let {
            stdout: u,
            stderr: d,
            exitCode: f,
            error: m,
          } = await it(l, c, { timeout: 2e4 }),
          h = [u, d]
            .filter(Boolean)
            .join(
              `
`,
            )
            .trim();
        return f !== 0
          ? `EXIT ${f}
${m || h || "(no output)"}`
          : h || "(no log output)";
      }
      case "container_list": {
        let o = !e.server || e.server === "local" || e.server === "localhost",
          r =
            `docker ps ${e.all ? "-a" : ""} --format "table {{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"`
              .trim()
              .replace(/\s+/g, " ");
        if (o)
          try {
            let { stdout: m, stderr: h } = await ke(r, { timeout: 1e4 });
            return (m || h || "(no containers)").trim();
          } catch (m) {
            return `EXIT ${m.code || 1}
${(m.stderr || m.message || "").toString().trim()}`;
          }
        let i;
        try {
          i = xt(e.server);
        } catch (m) {
          return `ERROR: ${m.message}`;
        }
        let {
            stdout: c,
            stderr: l,
            exitCode: u,
            error: d,
          } = await it(i, r, { timeout: 15e3 }),
          f = [c, l]
            .filter(Boolean)
            .join(
              `
`,
            )
            .trim();
        return u !== 0
          ? `EXIT ${u}
${d || f}`
          : f || "(no containers)";
      }
      case "container_logs": {
        if (!e.container) return "ERROR: container is required";
        let o = !e.server || e.server === "local" || e.server === "localhost",
          n = e.lines || 50,
          r = e.since ? `--since "${e.since}"` : "",
          i = `docker logs --tail ${n} ${r} ${e.container} 2>&1`
            .trim()
            .replace(/\s+/g, " ");
        if (o)
          try {
            let { stdout: h, stderr: p } = await ke(i, { timeout: 15e3 });
            return (h || p || "(no log output)").trim();
          } catch (h) {
            return `EXIT ${h.code || 1}
${(h.stderr || h.message || "").toString().trim()}`;
          }
        let c;
        try {
          c = xt(e.server);
        } catch (h) {
          return `ERROR: ${h.message}`;
        }
        let {
            stdout: l,
            stderr: u,
            exitCode: d,
            error: f,
          } = await it(c, i, { timeout: 2e4 }),
          m = [l, u]
            .filter(Boolean)
            .join(
              `
`,
            )
            .trim();
        return d !== 0
          ? `EXIT ${d}
${f || m}`
          : m || "(no log output)";
      }
      case "container_exec": {
        if (!e.container) return "ERROR: container is required";
        if (!e.command) return "ERROR: command is required";
        let o = !e.server || e.server === "local" || e.server === "localhost",
          n =
            /^(cat|ls|echo|env|printenv|df|du|ps|id|whoami|uname|hostname|date|pwd|which|find\s|head\s|tail\s|grep\s|curl\s+-[A-Za-z]*G|curl\s+https?:\/\/[^\s]+$)/;
        if (!s.autoConfirm && !n.test(e.command.trim())) {
          let h = o ? "local" : e.server;
          if (
            (console.log(`
${te.yellow}  \u26A0 docker exec in ${e.container} on ${h}: ${e.command}${te.reset}`),
            !(await Et("  Execute?")))
          )
            return "CANCELLED: User declined.";
        }
        let i = `docker exec ${e.container} sh -c ${JSON.stringify(e.command)}`;
        if (o)
          try {
            let { stdout: h, stderr: p } = await ke(i, { timeout: 3e4 });
            return (h || p || "(no output)").trim();
          } catch (h) {
            return `EXIT ${h.code || 1}
${(h.stderr || h.message || "").toString().trim()}`;
          }
        let c;
        try {
          c = xt(e.server);
        } catch (h) {
          return `ERROR: ${h.message}`;
        }
        let {
            stdout: l,
            stderr: u,
            exitCode: d,
            error: f,
          } = await it(c, i, { timeout: 35e3 }),
          m = [l, u]
            .filter(Boolean)
            .join(
              `
`,
            )
            .trim();
        return d !== 0
          ? `EXIT ${d}
${f || m}`
          : m || "(no output)";
      }
      case "container_manage": {
        if (!e.container) return "ERROR: container is required";
        if (!e.action) return "ERROR: action is required";
        let o = ["start", "stop", "restart", "remove", "inspect"];
        if (!o.includes(e.action))
          return `ERROR: invalid action "${e.action}". Valid: ${o.join(", ")}`;
        let n = !e.server || e.server === "local" || e.server === "localhost";
        if (!(e.action === "inspect") && !s.autoConfirm) {
          let p = n ? "local" : e.server;
          if (
            (console.log(`
${te.yellow}  \u26A0 docker ${e.action} ${e.container} on ${p}${te.reset}`),
            !(await Et("  Execute?")))
          )
            return "CANCELLED: User declined.";
        }
        let i = e.action === "remove" ? "rm" : e.action,
          c =
            e.action === "inspect"
              ? `docker inspect ${e.container}`
              : `docker ${i} ${e.container}`;
        if (n)
          try {
            let { stdout: p, stderr: g } = await ke(c, { timeout: 3e4 });
            return (p || g || `docker ${e.action} ${e.container}: OK`).trim();
          } catch (p) {
            return `EXIT ${p.code || 1}
${(p.stderr || p.message || "").toString().trim()}`;
          }
        let l;
        try {
          l = xt(e.server);
        } catch (p) {
          return `ERROR: ${p.message}`;
        }
        let {
            stdout: u,
            stderr: d,
            exitCode: f,
            error: m,
          } = await it(l, c, { timeout: 35e3 }),
          h = [u, d]
            .filter(Boolean)
            .join(
              `
`,
            )
            .trim();
        return f !== 0
          ? `EXIT ${f}
${m || h}`
          : h || `docker ${e.action} ${e.container}: OK`;
      }
      case "deploy": {
        if (e.config)
          try {
            ((e = { ...tw(e.config), ...e }), delete e.config, delete e._name);
          } catch (d) {
            return `ERROR: ${d.message}`;
          }
        if (!e.server)
          return 'ERROR: server is required (or use config: "<name>")';
        if (!e.remote_path) return "ERROR: remote_path is required";
        let o = e.method || "rsync";
        if (o === "rsync" && !e.local_path)
          return "ERROR: local_path is required for rsync method";
        let n;
        try {
          n = xt(e.server);
        } catch (d) {
          return `ERROR: ${d.message}`;
        }
        let r = n.user ? `${n.user}@${n.host}` : n.host;
        if (!e.dry_run && !s.autoConfirm) {
          if (o === "git") {
            let f = e.branch ? ` (branch: ${e.branch})` : "";
            console.log(`
${te.yellow}  \u26A0 Deploy [git pull]: ${r}:${e.remote_path}${f}${te.reset}`);
          } else {
            let f = e.local_path.endsWith("/")
              ? e.local_path
              : `${e.local_path}/`;
            console.log(`
${te.yellow}  \u26A0 Deploy [rsync]: ${f} \u2192 ${r}:${e.remote_path}${te.reset}`);
          }
          if (
            (e.deploy_script &&
              console.log(
                `${te.yellow}  Then run: ${e.deploy_script}${te.reset}`,
              ),
            e.health_check &&
              console.log(
                `${te.yellow}  Health check: ${e.health_check}${te.reset}`,
              ),
            !(await Et("  Proceed with deployment?")))
          )
            return "CANCELLED: User declined.";
        }
        let i = "";
        if (o === "git") {
          let d = e.branch
            ? `cd ${e.remote_path} && git fetch origin && git checkout ${e.branch} && git pull origin ${e.branch}`
            : `cd ${e.remote_path} && git pull`;
          if (e.dry_run)
            return `DRY RUN [git]: would run on ${r}:
  ${d}${
    e.deploy_script
      ? `
  ${e.deploy_script}`
      : ""
  }`;
          let {
            stdout: f,
            stderr: m,
            exitCode: h,
            error: p,
          } = await it(n, d, { timeout: 12e4 });
          if (
            ((i = [f, m]
              .filter(Boolean)
              .join(
                `
`,
              )
              .trim()),
            h !== 0)
          )
            return `ERROR (git pull, exit ${h}):
${p || i}`;
        } else {
          let d = n.key
              ? `-e "ssh -i ${n.key.replace(/^~/, require("os").homedir())}${n.port && Number(n.port) !== 22 ? ` -p ${n.port}` : ""}"`
              : n.port && Number(n.port) !== 22
                ? `-e "ssh -p ${n.port}"`
                : "",
            f = (e.exclude || []).map((g) => `--exclude="${g}"`).join(" "),
            m = e.dry_run ? "--dry-run" : "",
            h = e.local_path.endsWith("/") ? e.local_path : `${e.local_path}/`,
            p = `rsync -avz --delete ${m} ${f} ${d} ${h} ${r}:${e.remote_path}`
              .trim()
              .replace(/\s+/g, " ");
          try {
            let { stdout: g, stderr: $ } = await ke(p, { timeout: 12e4 });
            i = (g || $ || "").trim();
          } catch (g) {
            return `ERROR (rsync): ${(g.stderr || g.message || "").toString().trim()}`;
          }
          if (e.dry_run)
            return `DRY RUN [rsync]:
${i || "(nothing to sync)"}`;
        }
        let c = "";
        if (e.deploy_script) {
          let {
              stdout: d,
              stderr: f,
              exitCode: m,
              error: h,
            } = await it(n, e.deploy_script, { timeout: 12e4 }),
            p = [d, f]
              .filter(Boolean)
              .join(
                `
`,
              )
              .trim();
          if (m !== 0)
            return `${o === "git" ? "git pull" : "rsync"} OK

ERROR (deploy_script, exit ${m}):
${h || p}`;
          c = `

Deploy script output:
${p || "(no output)"}`;
        }
        let l = "";
        if (e.health_check) {
          let d = e.health_check.trim();
          if (/^https?:\/\//.test(d))
            try {
              let m = require("node-fetch"),
                h = await Promise.race([
                  m(d),
                  new Promise((p, g) =>
                    setTimeout(() => g(new Error("timeout")), 15e3),
                  ),
                ]);
              if (h.ok)
                l = `

Health check: \u2713 ${d} \u2192 ${h.status}`;
              else
                return (
                  (l = `

Health check FAILED: ${d} \u2192 HTTP ${h.status}`),
                  (o === "git" ? "git pull OK" : "rsync OK") + i + c + l
                );
            } catch (m) {
              return (
                (l = `

Health check FAILED: ${d} \u2192 ${m.message}`),
                (o === "git" ? "git pull OK" : "rsync OK") + i + c + l
              );
            }
          else {
            let {
                stdout: m,
                stderr: h,
                exitCode: p,
              } = await it(n, d, { timeout: 15e3 }),
              g = [m, h]
                .filter(Boolean)
                .join(
                  `
`,
                )
                .trim();
            if (p !== 0)
              return (
                (l = `

Health check FAILED (exit ${p}): ${g}`),
                (o === "git" ? "git pull OK" : "rsync OK") + i + c + l
              );
            l = `

Health check: \u2713 ${g || "(exit 0)"}`;
          }
        }
        let u =
          o === "git"
            ? `${r}:${e.remote_path}`
            : `${e.local_path} \u2192 ${r}:${e.remote_path}`;
        return `Deployed [${o}] ${u}
${i}${c}${l}`.trim();
      }
      case "deployment_status": {
        let o = nw(),
          n = e.config ? [e.config] : Object.keys(o);
        if (n.length === 0)
          return "No deploy configs found. Create .nex/deploy.json to configure deployments.";
        let r = [];
        for (let i of n) {
          let c = o[i];
          if (!c) {
            r.push(`${i}: NOT FOUND`);
            continue;
          }
          try {
            let l = xt(c.server || i),
              d =
                (await it(l, "echo OK", { timeout: 1e4 })).stdout.trim() ===
                "OK",
              f = "unknown";
            if (d && c.deploy_script) {
              let h = c.deploy_script.match(/systemctl\s+\w+\s+(\S+)/);
              if (h)
                try {
                  f = (
                    await it(l, `systemctl is-active ${h[1]}`, { timeout: 1e4 })
                  ).stdout.trim();
                } catch {
                  f = "inactive";
                }
            }
            let m = "N/A";
            if (c.health_check) {
              let h = c.health_check.trim();
              if (/^https?:\/\//.test(h))
                try {
                  let p = require("node-fetch"),
                    g = await Promise.race([
                      p(h),
                      new Promise(($, w) =>
                        setTimeout(() => w(new Error("timeout")), 1e4),
                      ),
                    ]);
                  m = g.ok ? "healthy" : `HTTP ${g.status}`;
                } catch (p) {
                  m = `unhealthy: ${p.message.substring(0, 50)}`;
                }
              else
                try {
                  m =
                    (await it(l, h, { timeout: 1e4 })).exitCode === 0
                      ? "healthy"
                      : "unhealthy";
                } catch {
                  m = "unhealthy";
                }
            }
            r.push(
              `${i}: server=${d ? "reachable" : "unreachable"} service=${f} health=${m}`,
            );
          } catch (l) {
            r.push(`${i}: ERROR \u2014 ${l.message}`);
          }
        }
        return `Deployment Status:
${r.join(`
`)}`;
      }
      case "frontend_recon": {
        let o = process.cwd(),
          n = (e.type || "").toLowerCase(),
          r = [],
          i = async (v, b = 120) => {
            try {
              let k = xe.isAbsolute(v) ? v : xe.join(o, v),
                O = (await Ie.readFile(k, "utf8")).split(`
`),
                P = O.slice(0, b).join(`
`);
              return O.length > b
                ? P +
                    `
... (${O.length - b} more lines \u2014 use read_file for full content)`
                : P;
            } catch {
              return null;
            }
          },
          l = [
            "node_modules",
            ".git",
            "dist",
            "build",
            "vendor",
            ".next",
            "__pycache__",
            "venv",
            ".venv",
          ]
            .map((v) => `-not -path "*/${v}/*"`)
            .join(" "),
          u = async (v) => {
            try {
              let { stdout: b } = await ke(
                `find "${o}" -type f -name "${v}" ${l} 2>/dev/null | head -10`,
                { timeout: 8e3 },
              );
              return b
                .trim()
                .split(
                  `
`,
                )
                .filter(Boolean);
            } catch {
              return [];
            }
          },
          d = async (v, b) => {
            try {
              let { stdout: k } = await ke(
                `grep -rl "${v}" "${o}" --include="${b}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build 2>/dev/null | head -5`,
                { timeout: 8e3 },
              );
              return k
                .trim()
                .split(
                  `
`,
                )
                .filter(Boolean);
            } catch {
              return [];
            }
          };
        r.push(`## STEP 1: Design Tokens
`);
        let f = [
          ...(await u("tailwind.config.js")),
          ...(await u("tailwind.config.ts")),
          ...(await u("tailwind.config.mjs")),
        ];
        if (f.length > 0) {
          let v = await i(f[0], 80);
          v &&
            r.push(`### Tailwind config (${xe.relative(o, f[0])})
\`\`\`js
${v}
\`\`\``);
        } else r.push("(no tailwind.config found)");
        let m = [
            "variables.css",
            "_variables.scss",
            "tokens.css",
            "base.css",
            "global.css",
            "main.css",
            "index.css",
            "app.css",
            "style.css",
            "styles.css",
          ],
          h = !1;
        for (let v of m) {
          let b = await u(v);
          for (let k of b) {
            let A = await i(k, 100);
            if (A && A.includes(":root")) {
              (r.push(`### CSS Variables (${xe.relative(o, k)})
\`\`\`css
${A}
\`\`\``),
                (h = !0));
              break;
            }
          }
          if (h) break;
        }
        if (!h) {
          let v = await d(":root", "*.css");
          if (v.length > 0) {
            let b = await i(v[0], 100);
            (b &&
              r.push(`### CSS Variables (${xe.relative(o, v[0])})
\`\`\`css
${b}
\`\`\``),
              (h = !0));
          }
        }
        (h || r.push("(no CSS custom properties / :root found)"),
          r.push(`
## STEP 2: Main Layout / Index Page
`));
        let p = [
            "base.html",
            "_base.html",
            "layout.html",
            "base.jinja",
            "App.vue",
            "App.jsx",
            "App.tsx",
            "_app.jsx",
            "_app.tsx",
            "_app.js",
            "layout.vue",
            "index.html",
          ],
          g = !1;
        for (let v of p) {
          let b = await u(v);
          if (b.length > 0) {
            let k = await i(b[0], 150);
            if (k) {
              (r.push(`### Main layout: ${xe.relative(o, b[0])}
\`\`\`html
${k}
\`\`\``),
                (g = !0));
              break;
            }
          }
        }
        (g ||
          r.push(
            "(no main layout/index file found \u2014 try read_file on your root template manually)",
          ),
          r.push(`
## STEP 3: Reference Component (same type)
`));
        let $ = [];
        if (n) {
          for (let v of ["*.html", "*.vue", "*.jsx", "*.tsx"])
            if ((($ = await d(n, v)), $.length > 0)) break;
        }
        if ($.length === 0)
          try {
            let { stdout: v } = await ke(
              `find "${o}" -type f \\( -name "*.html" -o -name "*.vue" -o -name "*.jsx" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" -not -name "base.html" -not -name "_base.html" -not -name "layout.html" -not -name "App.vue" -not -name "App.jsx" 2>/dev/null | head -20`,
              { timeout: 8e3 },
            );
            $ = v
              .trim()
              .split(
                `
`,
              )
              .filter(Boolean);
          } catch {
            $ = [];
          }
        if ($.length > 0) {
          let v = $[0],
            b = await i(v, 150);
          b
            ? r.push(`### Reference: ${xe.relative(o, v)}
\`\`\`html
${b}
\`\`\``)
            : r.push("(reference file found but could not be read)");
        } else
          r.push(
            "(no reference component found \u2014 check manually with glob or list_directory)",
          );
        r.push(`
## STEP 4: Framework Stack
`);
        let w = [],
          _ = await i(xe.join(o, "package.json"), 999);
        if (_) {
          if (
            ((_.includes('"react"') || _.includes("'react'")) &&
              w.push("React"),
            _.includes('"vue"') || _.includes("'vue'"))
          ) {
            let b = _.match(/"vue":\s*"[\^~]?(\d+)/);
            w.push(b ? `Vue.js v${b[1]}` : "Vue.js");
          }
          let v = _.match(/"alpinejs":\s*"[\^~]?(\d+)/);
          (v && w.push(`Alpine.js v${v[1]} (\u26A0 v2 vs v3 API differs!)`),
            (_.includes('"htmx') || _.includes("'htmx")) && w.push("HTMX"),
            _.includes('"tailwindcss"') && w.push("Tailwind CSS"),
            _.includes('"bootstrap"') && w.push("Bootstrap"));
        }
        if (
          (((await pt(xe.join(o, "manage.py"))) ||
            ((await i(xe.join(o, "requirements.txt"), 50)) || "").includes(
              "Django",
            )) &&
            w.push("Django (server-rendered templates)"),
          !w.some((v) => v.includes("Alpine")))
        ) {
          let v = await d("alpinejs", "*.html");
          if (v.length > 0) {
            let k = ((await i(v[0], 30)) || "").match(/alpinejs[@/]v?(\d)/);
            w.push(
              k
                ? `Alpine.js v${k[1]} (via CDN \u2014 \u26A0 v2 vs v3 API differs!)`
                : "Alpine.js (via CDN \u2014 check version!)",
            );
          }
        }
        return (
          w.some((v) => v.includes("HTMX")) ||
            ((await d("htmx", "*.html")).length > 0 &&
              w.push("HTMX (via CDN)")),
          w.length > 0
            ? (r.push(
                w.map((v) => `- ${v}`).join(`
`),
              ),
              r.push(`
\u26A0 Use ONLY the frameworks listed above. Do NOT mix (e.g. no fetch() when HTMX is used for the same action).`))
            : r.push(
                "(framework not detected \u2014 check package.json or script tags manually)",
              ),
          r.push(`
---
\u2705 Design recon complete. Now build consistently with the patterns above.`),
          r.join(`
`)
        );
      }
      case "sysadmin": {
        if (!e.action) return "ERROR: action is required";
        let o = !e.server || e.server === "local" || e.server === "localhost",
          n;
        if (!o)
          try {
            n = xt(e.server);
          } catch (l) {
            return `ERROR: ${l.message}`;
          }
        let r = async (l, u = 3e4) => {
          if (o)
            try {
              let { stdout: d, stderr: f } = await ke(l, { timeout: u });
              return { out: (d || f || "").trim(), exitCode: 0 };
            } catch (d) {
              return {
                out: (d.stderr || d.message || "").toString().trim(),
                exitCode: d.code || 1,
              };
            }
          else {
            let {
                stdout: d,
                stderr: f,
                exitCode: m,
                error: h,
              } = await it(n, l, { timeout: u }),
              p = [d, f]
                .filter(Boolean)
                .join(
                  `
`,
                )
                .trim();
            return {
              out:
                h && m !== 0 && !d.trim()
                  ? (
                      h +
                      `
` +
                      p
                    ).trim()
                  : p,
              exitCode: m,
            };
          }
        };
        if (
          !(
            [
              "audit",
              "disk_usage",
              "process_list",
              "network_status",
              "ssl_check",
              "log_tail",
              "find_large",
              "journalctl",
            ].includes(e.action) ||
            (e.action === "package" && e.package_action === "list") ||
            (e.action === "user_manage" &&
              ["list", "info"].includes(e.user_action)) ||
            (e.action === "firewall" && e.firewall_action === "status") ||
            (e.action === "cron" && e.cron_action === "list") ||
            (e.action === "service" &&
              ["status", "list_failed"].includes(e.service_action))
          ) &&
          !s.autoConfirm
        ) {
          let l = o ? "local" : e.server;
          if (!(await Et(`sysadmin [${e.action}] on ${l} \u2014 proceed?`)))
            return "Cancelled.";
        }
        switch (e.action) {
          case "audit": {
            let l = [
                "echo '=== OS / KERNEL ==='",
                "cat /etc/os-release 2>/dev/null | grep -E '^(NAME|VERSION)=' || uname -a",
                "echo '=== UPTIME / LOAD ==='",
                "uptime",
                "echo '=== MEMORY / SWAP ==='",
                "free -h",
                "echo '=== DISK ==='",
                "df -h --output=target,size,used,avail,pcent 2>/dev/null || df -h",
                "echo '=== TOP 10 PROCESSES (CPU) ==='",
                "ps aux --sort=-%cpu | head -11",
                "echo '=== FAILED SYSTEMD UNITS ==='",
                "systemctl list-units --state=failed --no-legend 2>/dev/null || echo '(systemctl not available)'",
                "echo '=== RECENT ERRORS (journalctl) ==='",
                "journalctl -p err --no-pager -n 15 2>/dev/null || echo '(journalctl not available)'",
                "echo '=== LISTENING PORTS ==='",
                "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo '(ss/netstat not available)'",
              ].join(" && "),
              { out: u, exitCode: d } = await r(l, 45e3);
            return (
              u ||
              `EXIT ${d}
(no output)`
            );
          }
          case "disk_usage": {
            let l = e.path || "/",
              u = `df -h ${l}; echo '--- Top subdirs ---'; du -d1 -x -h ${l} 2>/dev/null | sort -rh | head -20`,
              { out: d, exitCode: f } = await r(u, 3e4);
            return f !== 0
              ? `EXIT ${f}
${d}`
              : d;
          }
          case "process_list": {
            let l = e.sort_by === "mem" ? "4" : "3",
              u = (e.limit || 20) + 1,
              d = `ps aux --sort=-${e.sort_by === "mem" ? "%mem" : "%cpu"} 2>/dev/null | head -${u} || ps aux | awk 'NR==1{print; next} {print | "sort -k${l} -rn"}' | head -${u}`,
              { out: f, exitCode: m } = await r(d, 15e3);
            return m !== 0
              ? `EXIT ${m}
${f}`
              : f;
          }
          case "network_status": {
            let l =
                "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null; echo '--- Active connections ---'; ss -tnp 2>/dev/null | head -30",
              { out: u, exitCode: d } = await r(l, 15e3);
            return d !== 0
              ? `EXIT ${d}
${u}`
              : u;
          }
          case "package": {
            if (!e.package_action)
              return "ERROR: package_action is required for action=package";
            let { out: l } = await r(
                "which dnf 2>/dev/null && echo dnf || (which apt-get 2>/dev/null && echo apt) || echo unknown",
                1e4,
              ),
              u = l.includes("dnf") ? "dnf" : l.includes("apt") ? "apt" : null;
            if (!u)
              return "ERROR: No supported package manager found (dnf/apt)";
            let d = (e.packages || []).join(" "),
              f;
            switch (e.package_action) {
              case "list":
                f =
                  u === "dnf"
                    ? "dnf list installed 2>/dev/null | head -60"
                    : "dpkg -l | head -60";
                break;
              case "check": {
                let p =
                    u === "dnf"
                      ? 'dnf check-update 2>/dev/null; EC=$?; [ $EC -eq 100 ] && echo "EXIT_STATUS: updates_available" || ([ $EC -eq 0 ] && echo "EXIT_STATUS: up_to_date" || echo "EXIT_STATUS: error $EC")'
                      : "apt-get -s upgrade 2>/dev/null | tail -5",
                  { out: g } = await r(p, 6e4);
                return g || "(no output from package check)";
              }
              case "install":
                if (!d) return "ERROR: packages required for install";
                f =
                  u === "dnf"
                    ? `dnf install -y ${d}`
                    : `apt-get install -y ${d}`;
                break;
              case "remove":
                if (!d) return "ERROR: packages required for remove";
                f =
                  u === "dnf" ? `dnf remove -y ${d}` : `apt-get remove -y ${d}`;
                break;
              case "update":
                if (!d)
                  return "ERROR: packages required for update (use upgrade for full system upgrade)";
                f =
                  u === "dnf"
                    ? `dnf update -y ${d}`
                    : `apt-get install -y --only-upgrade ${d}`;
                break;
              case "upgrade":
                f =
                  u === "dnf"
                    ? "dnf upgrade -y"
                    : "DEBIAN_FRONTEND=noninteractive apt-get upgrade -y";
                break;
              default:
                return `ERROR: Unknown package_action: ${e.package_action}`;
            }
            let { out: m, exitCode: h } = await r(f, 12e4);
            return h !== 0
              ? `EXIT ${h}
${m}`
              : m || `${e.package_action} OK`;
          }
          case "user_manage": {
            if (!e.user_action)
              return "ERROR: user_action is required for action=user_manage";
            switch (e.user_action) {
              case "list": {
                let l = `awk -F: '$3 >= 1000 && $1 != "nobody" {print $1, "uid="$3, "gid="$4, "shell="$7}' /etc/passwd`,
                  { out: u, exitCode: d } = await r(l, 1e4);
                return d !== 0
                  ? `EXIT ${d}
${u}`
                  : u || "(no regular users)";
              }
              case "info": {
                if (!e.user)
                  return "ERROR: user is required for user_action=info";
                let l = `id ${e.user} && echo '--- Groups ---' && groups ${e.user} && echo '--- Last login ---' && lastlog -u ${e.user} 2>/dev/null`,
                  { out: u, exitCode: d } = await r(l, 1e4);
                return d !== 0
                  ? `EXIT ${d}
${u}`
                  : u;
              }
              case "create": {
                if (!e.user)
                  return "ERROR: user is required for user_action=create";
                let u = `useradd -m ${(e.groups || []).map((m) => `-G ${m}`).join(" ")} ${e.user} && echo "User ${e.user} created"`,
                  { out: d, exitCode: f } = await r(u, 15e3);
                return f !== 0
                  ? `EXIT ${f}
${d}`
                  : d;
              }
              case "delete": {
                if (!e.user)
                  return "ERROR: user is required for user_action=delete";
                let l = `userdel -r ${e.user} && echo "User ${e.user} deleted"`,
                  { out: u, exitCode: d } = await r(l, 15e3);
                return d !== 0
                  ? `EXIT ${d}
${u}`
                  : u;
              }
              case "add_ssh_key": {
                if (!e.user)
                  return "ERROR: user is required for user_action=add_ssh_key";
                if (!e.ssh_key)
                  return "ERROR: ssh_key is required for user_action=add_ssh_key";
                let l = e.ssh_key.replace(/'/g, "'\\''"),
                  u = `mkdir -p /home/${e.user}/.ssh && chmod 700 /home/${e.user}/.ssh && echo '${l}' >> /home/${e.user}/.ssh/authorized_keys && chmod 600 /home/${e.user}/.ssh/authorized_keys && chown -R ${e.user}:${e.user} /home/${e.user}/.ssh && echo "SSH key added for ${e.user}"`,
                  { out: d, exitCode: f } = await r(u, 15e3);
                return f !== 0
                  ? `EXIT ${f}
${d}`
                  : d;
              }
              default:
                return `ERROR: Unknown user_action: ${e.user_action}`;
            }
          }
          case "firewall": {
            if (!e.firewall_action)
              return "ERROR: firewall_action is required for action=firewall";
            let { out: l } = await r(
                "which firewall-cmd 2>/dev/null && echo firewalld || (which ufw 2>/dev/null && echo ufw) || echo iptables",
                1e4,
              ),
              u = l.includes("firewalld")
                ? "firewalld"
                : l.includes("ufw")
                  ? "ufw"
                  : "iptables",
              d;
            switch (e.firewall_action) {
              case "status":
                d =
                  u === "firewalld"
                    ? "firewall-cmd --state && firewall-cmd --list-all"
                    : u === "ufw"
                      ? "ufw status verbose"
                      : "iptables -L -n --line-numbers | head -60";
                break;
              case "allow":
                if (!e.port)
                  return 'ERROR: port is required for firewall allow (e.g. "80/tcp")';
                d =
                  u === "firewalld"
                    ? `firewall-cmd --permanent --add-port=${e.port} && firewall-cmd --reload`
                    : u === "ufw"
                      ? `ufw allow ${e.port}`
                      : `iptables -A INPUT -p ${e.port.includes("/") ? e.port.split("/")[1] : "tcp"} --dport ${e.port.split("/")[0]} -j ACCEPT`;
                break;
              case "deny":
                if (!e.port) return "ERROR: port is required for firewall deny";
                d =
                  u === "firewalld"
                    ? `firewall-cmd --permanent --remove-port=${e.port} && firewall-cmd --reload`
                    : u === "ufw"
                      ? `ufw deny ${e.port}`
                      : `iptables -A INPUT -p ${e.port.includes("/") ? e.port.split("/")[1] : "tcp"} --dport ${e.port.split("/")[0]} -j DROP`;
                break;
              case "remove":
                if (!e.port)
                  return "ERROR: port is required for firewall remove";
                d =
                  u === "firewalld"
                    ? `firewall-cmd --permanent --remove-port=${e.port} && firewall-cmd --reload`
                    : u === "ufw"
                      ? `ufw delete allow ${e.port}`
                      : `iptables -D INPUT -p ${e.port.includes("/") ? e.port.split("/")[1] : "tcp"} --dport ${e.port.split("/")[0]} -j ACCEPT 2>/dev/null || true`;
                break;
              case "reload":
                d =
                  u === "firewalld"
                    ? "firewall-cmd --reload"
                    : u === "ufw"
                      ? "ufw reload"
                      : 'iptables-restore < /etc/iptables/rules.v4 2>/dev/null || echo "iptables: manual reload not available"';
                break;
              default:
                return `ERROR: Unknown firewall_action: ${e.firewall_action}`;
            }
            let { out: f, exitCode: m } = await r(d, 3e4);
            return m !== 0
              ? `EXIT ${m}
${f}`
              : f || `firewall ${e.firewall_action} OK`;
          }
          case "cron": {
            if (!e.cron_action)
              return "ERROR: cron_action is required for action=cron";
            let l = e.user ? `-u ${e.user}` : "";
            switch (e.cron_action) {
              case "list": {
                let u = `crontab ${l} -l 2>/dev/null || echo '(no crontab for ${e.user || "current user"})'`,
                  { out: d } = await r(u, 1e4);
                return d || "(empty crontab)";
              }
              case "add": {
                if (!e.schedule)
                  return "ERROR: schedule is required for cron add";
                if (!e.command)
                  return "ERROR: command is required for cron add";
                let u = `${e.schedule} ${e.command}`,
                  d = `(crontab ${l} -l 2>/dev/null; echo "${u}") | crontab ${l} - && echo "Cron entry added: ${u}"`,
                  { out: f, exitCode: m } = await r(d, 15e3);
                return m !== 0
                  ? `EXIT ${m}
${f}`
                  : f;
              }
              case "remove": {
                if (!e.command)
                  return "ERROR: command (substring to match) is required for cron remove";
                let u = e.command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                  d = `crontab ${l} -l 2>/dev/null | grep -v "${u}" | crontab ${l} - && echo "Matching cron entries removed"`,
                  { out: f, exitCode: m } = await r(d, 15e3);
                return m !== 0
                  ? `EXIT ${m}
${f}`
                  : f;
              }
              default:
                return `ERROR: Unknown cron_action: ${e.cron_action}`;
            }
          }
          case "ssl_check": {
            if (!e.domain && !e.cert_path)
              return "ERROR: domain or cert_path is required for ssl_check";
            let l;
            e.cert_path
              ? (l = `
CERT="${e.cert_path}"
openssl x509 -in "$CERT" -noout -subject -issuer -startdate -enddate -ext subjectAltName 2>&1 && EXPIRY=$(openssl x509 -in "$CERT" -noout -enddate 2>/dev/null | cut -d= -f2) && DAYS=$(( ( $(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null) - $(date +%s) ) / 86400 )) && echo "Days until expiry: $DAYS"
`.trim())
              : (l = `
DOMAIN="${e.domain}"
LECP="/etc/letsencrypt/live/$DOMAIN/cert.pem"
if [ -f "$LECP" ]; then
  echo "Source: Let's Encrypt $LECP"
  openssl x509 -in "$LECP" -noout -subject -issuer -startdate -enddate -ext subjectAltName 2>&1
  EXPIRY=$(openssl x509 -in "$LECP" -noout -enddate 2>/dev/null | cut -d= -f2)
else
  echo "Source: live TLS probe"
  CERT=$(echo | openssl s_client -connect "$DOMAIN":443 -servername "$DOMAIN" 2>/dev/null)
  if [ -z "$CERT" ]; then echo "ERROR: Could not connect to $DOMAIN:443 (port closed or DNS unresolvable)"; exit 1; fi
  echo "$CERT" | openssl x509 -noout -subject -issuer -startdate -enddate -ext subjectAltName 2>&1
  EXPIRY=$(echo "$CERT" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
fi
if [ -n "$EXPIRY" ]; then
  DAYS=$(( ( $(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null) - $(date +%s) ) / 86400 ))
  echo "Days until expiry: $DAYS"
  [ "$DAYS" -lt 14 ] && echo "WARNING: Certificate expires in less than 14 days!"
  [ "$DAYS" -lt 0 ] && echo "CRITICAL: Certificate has EXPIRED!"
fi
`.trim());
            let { out: u, exitCode: d } = await r(l, 25e3),
              f = /notAfter=|Days until expiry:/i.test(u);
            return d !== 0 && !f
              ? `EXIT ${d}
${u}`
              : u || "(no cert info returned)";
          }
          case "log_tail": {
            if (!e.path) return "ERROR: path is required for log_tail";
            let u = `tail -n ${e.lines || 100} ${e.path} 2>&1`,
              { out: d, exitCode: f } = await r(u, 15e3);
            return f !== 0
              ? `EXIT ${f}
${d}`
              : d || "(empty log)";
          }
          case "find_large": {
            let l = e.path || "/",
              u = e.limit || 20,
              d = e.min_size || "100M",
              f = `find ${l} -xdev -type f -size +${d} 2>/dev/null | xargs du -sh 2>/dev/null | sort -rh | head -${u}`,
              { out: m, exitCode: h } = await r(f, 6e4);
            return h !== 0
              ? `EXIT ${h}
${m}`
              : m || `(no files larger than ${d} in ${l})`;
          }
          case "service": {
            if (!e.service_action)
              return "ERROR: service_action is required for action=service";
            if (e.service_action !== "list_failed" && !e.service_name)
              return "ERROR: service_name is required (except for list_failed)";
            let l = e.service_name
                ? e.service_name.includes(".")
                  ? e.service_name
                  : `${e.service_name}.service`
                : "",
              u;
            switch (e.service_action) {
              case "status":
                u = `systemctl status ${l} --no-pager -l 2>&1 | head -40`;
                break;
              case "list_failed":
                u =
                  "systemctl list-units --state=failed --no-legend 2>/dev/null";
                break;
              case "start":
                u = `systemctl start ${l} && systemctl status ${l} --no-pager -l 2>&1 | head -20`;
                break;
              case "stop":
                u = `systemctl stop ${l} && echo "${l} stopped"`;
                break;
              case "restart":
                u = `systemctl restart ${l} && systemctl status ${l} --no-pager -l 2>&1 | head -20`;
                break;
              case "reload":
                u = `systemctl reload ${l} 2>&1 || systemctl reload-or-restart ${l} 2>&1`;
                break;
              case "enable":
                u = `systemctl enable ${l} && echo "${l} enabled"`;
                break;
              case "disable":
                u = `systemctl disable ${l} && echo "${l} disabled"`;
                break;
              default:
                return `ERROR: Unknown service_action: ${e.service_action}`;
            }
            let { out: d, exitCode: f } = await r(u, 3e4);
            return f === 0 || (e.service_action === "status" && f === 3)
              ? d || `service ${e.service_action} OK`
              : `EXIT ${f}
${d}`;
          }
          case "kill_process": {
            if (!e.pid && !e.process_name)
              return "ERROR: pid or process_name is required for kill_process";
            let l = e.signal || "SIGTERM",
              u;
            e.pid
              ? (u = `ps -p ${e.pid} -o pid,user,%cpu,%mem,etime,cmd 2>/dev/null && kill -${l} ${e.pid} && echo "Sent ${l} to PID ${e.pid}"`)
              : (u = `pgrep -a "${e.process_name}" 2>/dev/null | head -5 && pkill -${l} "${e.process_name}" && echo "Sent ${l} to all '${e.process_name}' processes"`);
            let { out: d, exitCode: f } = await r(u, 15e3);
            return f !== 0
              ? `EXIT ${f}
${d}`
              : d;
          }
          case "journalctl": {
            let l = e.lines || 100,
              u = ["journalctl", "--no-pager", "-n", String(l)];
            (e.unit &&
              u.push("-u", e.unit.includes(".") ? e.unit : `${e.unit}.service`),
              e.priority && u.push("-p", e.priority),
              e.since && u.push(`--since="${e.since}"`),
              u.push('2>/dev/null || echo "(journalctl not available)"'));
            let { out: d, exitCode: f } = await r(u.join(" "), 2e4);
            return f !== 0
              ? `EXIT ${f}
${d}`
              : d || "(no log entries)";
          }
          default:
            return `ERROR: Unknown sysadmin action: ${e.action}`;
        }
      }
      default: {
        let { executePluginTool: o } = Ro(),
          n = await o(t, e, s);
        return n !== null ? n : `ERROR: Unknown tool: ${t}`;
      }
    }
  }
  async function dw(t, e, s = {}) {
    let { emit: o } = Ro(),
      { logToolExecution: n } = Ki(),
      r = Date.now(),
      i = s.silent ? null : Xy(t, e);
    if (!i) {
      let l = await yd(t, e, s);
      return (
        n({
          tool: t,
          args: e,
          result: l,
          duration: Date.now() - r,
          success: !l.startsWith?.("ERROR"),
        }),
        await o("onToolResult", { tool: t, args: e, result: l }),
        l
      );
    }
    let c = new zy(i);
    c.start();
    try {
      let l = await yd(t, e, s);
      return (
        c.stop(),
        n({
          tool: t,
          args: e,
          result: l,
          duration: Date.now() - r,
          success: !l.startsWith?.("ERROR"),
        }),
        await o("onToolResult", { tool: t, args: e, result: l }),
        l
      );
    } catch (l) {
      throw (
        c.stop(),
        n({
          tool: t,
          args: e,
          result: l.message,
          duration: Date.now() - r,
          success: !1,
        }),
        l
      );
    }
  }
  _d.exports = {
    TOOL_DEFINITIONS: uw,
    executeTool: dw,
    resolvePath: at,
    autoFixPath: Xo,
    autoFixEdit: bd,
    enrichBashError: wd,
    cancelPendingAskUser: aw,
    setAskUserHandler: cw,
    fileExists: pt,
  };
});
var Zi = K((Hk, xd) => {
  var { loadServerProfiles: Jo } = Bn(),
    Qi = {
      almalinux9: [
        "Package manager: dnf (NOT apt). Install: dnf install <pkg>. Update: dnf update.",
        "Service manager: systemctl. Logs: journalctl -u <service> -n 50.",
        "Firewall: firewalld. Check: firewall-cmd --list-all. Open port: firewall-cmd --permanent --add-port=PORT/tcp && firewall-cmd --reload.",
        "SELinux is active by default. Check: getenforce. Diagnose: ausearch -m avc -ts recent | audit2why. Fix context: restorecon -Rv /path.",
        "Nginx config: /etc/nginx/. Test: nginx -t. Reload: systemctl reload nginx.",
        "Process list: ps aux. Ports: ss -tuln.",
        "Python: python3. Pip: pip3. Virtualenv: python3 -m venv.",
      ],
      almalinux8: [
        "Package manager: dnf (NOT apt). Install: dnf install <pkg>. Update: dnf update.",
        "Service manager: systemctl. Logs: journalctl -u <service> -n 50.",
        "Firewall: firewalld. Check: firewall-cmd --list-all.",
        "SELinux is active by default. Check: getenforce. Diagnose: ausearch -m avc -ts recent.",
      ],
      ubuntu: [
        "Package manager: apt. Install: apt install <pkg>. Update: apt update && apt upgrade.",
        "Service manager: systemctl. Logs: journalctl -u <service> -n 50.",
        "Firewall: ufw. Status: ufw status. Allow port: ufw allow PORT/tcp.",
        "SELinux NOT active by default (AppArmor instead). Check: aa-status.",
      ],
      debian: [
        "Package manager: apt. Install: apt install <pkg>. Update: apt update && apt upgrade.",
        "Service manager: systemctl. Logs: journalctl -u <service> -n 50.",
        "Firewall: ufw or iptables.",
      ],
      macos: [
        "Package manager: Homebrew (brew). Install: brew install <pkg>. Update: brew update && brew upgrade.",
        "Service manager: launchctl (NOT systemctl). Start: brew services start <name>. List: brew services list.",
        `No systemd. No journalctl. Use: log show --predicate 'process == "nginx"' --last 1h instead.`,
        "Firewall: macOS built-in (pfctl or System Settings). Check: pfctl -s rules.",
        "Process list: ps aux. Ports: lsof -i -n -P | grep LISTEN.",
      ],
    };
  function fw() {
    let t = Jo();
    if (Object.keys(t).length === 0) return null;
    let s = ["## Remote Servers (.nex/servers.json)"];
    (s.push(""),
      s.push(
        "Available server profiles (use with ssh_exec, ssh_upload, ssh_download, service_manage, service_logs, container_list, container_logs, container_exec, container_manage, deploy):",
      ));
    for (let [n, r] of Object.entries(t)) {
      let i = r.user ? `${r.user}@${r.host}` : r.host,
        c = r.port && Number(r.port) !== 22 ? `:${r.port}` : "",
        l = r.os ? ` \u2014 OS: ${r.os}` : "",
        u = r.sudo ? ", sudo available" : "";
      s.push(`- **${n}**: ${i}${c}${l}${u}`);
    }
    let o = new Set();
    for (let n of Object.values(t)) n.os && Qi[n.os] && o.add(n.os);
    if (o.size > 0) {
      s.push("");
      for (let n of o) {
        let r =
          {
            almalinux9: "AlmaLinux 9",
            almalinux8: "AlmaLinux 8",
            ubuntu: "Ubuntu",
            debian: "Debian",
            macos: "macOS",
          }[n] || n;
        s.push(`### ${r} Notes`);
        for (let i of Qi[n]) s.push(`- ${i}`);
      }
    }
    return s.join(`
`);
  }
  function pw(t) {
    let e = Jo();
    return Object.values(e).some((s) => s.os && s.os.startsWith(t));
  }
  function mw() {
    return Object.keys(Jo());
  }
  function hw() {
    let t = require("fs"),
      s = require("path").join(process.cwd(), "NEX.md"),
      o = "";
    try {
      o = t.readFileSync(s, "utf-8");
    } catch {}
    let n = Jo(),
      r = Object.keys(n);
    if (r.length === 0) return null;
    let i = [
        "server",
        "deploy",
        "remote",
        "ssh",
        "service",
        "systemctl",
        "production",
        "linux",
        "almalinux",
        "ubuntu",
        "debian",
      ],
      c = o.toLowerCase();
    if (!i.some((m) => c.includes(m))) return null;
    let u = r.map((m) => {
        let h = n[m],
          p = h.user ? `${h.user}@${h.host}` : h.host,
          g = h.port && Number(h.port) !== 22 ? `:${h.port}` : "";
        return `  - **${m}**: ${p}${g}${h.os ? ` (${h.os})` : ""}`;
      }).join(`
`),
      d = r.map((m) => n[m].log_path).filter(Boolean),
      f =
        d.length > 0
          ? `
- Server log paths: ${d.join(", ")}`
          : "";
    return `# Deployment Context (Auto-detected)

This project is deployed on a **remote server**. The application runs as a service there \u2014 NOT locally.

## Configured Servers
${u}

## Critical Debugging Rules

**When you receive an error or warning from the running application** (e.g. "500 ERR_BAD_RESPONSE", "\u26A0\uFE0F service error", health check failures, service alerts):
- \u2705 Use \`ssh_exec\` or \`service_logs\` to investigate on the remote server
- \u2705 \`ssh_exec\` example: \`tail -50 /path/to/logs/api.log\`
- \u2705 \`service_logs\` or \`bash\` with \`ssh\` to check \`systemctl status <service>\`${f}
- \u274C Do NOT \`read_file\` on paths like \`logs/\` \u2014 these files do not exist locally
- \u274C Do NOT \`list_directory\` on server paths \u2014 the local project is the source, not the running instance

**When in doubt:** If a path contains \`logs/\`, \`/var/log/\`, or \`/home/<user>/\` \u2014 it is on the server. SSH there.`;
  }
  xd.exports = {
    getServerContext: fw,
    getDeploymentContextBlock: hw,
    hasServerOS: pw,
    getProfileNames: mw,
    OS_HINTS: Qi,
  };
});
var Zo = K((Gk, Sd) => {
  var Tt = require("fs").promises,
    kd = require("fs"),
    Qe = require("path"),
    Vo = require("util").promisify(require("child_process").exec),
    { C: Gn } = Ce(),
    { getMergeConflicts: vd } = en(),
    { getServerContext: gw } = Zi(),
    $w = new Set([
      "node_modules",
      ".git",
      ".svn",
      "dist",
      "build",
      "coverage",
      ".nyc_output",
      "__pycache__",
      ".DS_Store",
      ".next",
      ".nuxt",
      ".turbo",
      ".cache",
      "vendor",
      "tmp",
      "temp",
    ]);
  function yw(t) {
    try {
      return kd
        .readFileSync(t, "utf-8")
        .split(
          `
`,
        )
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("#") && !s.startsWith("!"))
        .map((s) => s.replace(/\/$/, ""));
    } catch {
      return [];
    }
  }
  function ww(t, e) {
    for (let s of e)
      if (
        s === t ||
        (s.includes("*") &&
          new RegExp(
            "^" + s.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
          ).test(t))
      )
        return !0;
    return !1;
  }
  function bw(
    t,
    { maxDepth: e = 3, maxFiles: s = 200, giPatterns: o = [] } = {},
  ) {
    let n = Qe.join(t, ".gitignore"),
      r = [...o, ...yw(n)],
      i = 0,
      c = [Qe.basename(t) + "/"];
    function l(u, d, f) {
      if (f > e || i >= s) return;
      let m;
      try {
        m = kd.readdirSync(u, { withFileTypes: !0 });
      } catch {
        return;
      }
      m.sort((p, g) =>
        p.isDirectory() !== g.isDirectory()
          ? p.isDirectory()
            ? -1
            : 1
          : p.name.localeCompare(g.name),
      );
      let h = m.filter(
        (p) =>
          !(
            $w.has(p.name) ||
            (p.name.startsWith(".") && p.name !== ".env.example") ||
            ww(p.name, r)
          ),
      );
      for (let p = 0; p < h.length; p++) {
        if (i >= s) {
          c.push(`${d}\u2514\u2500\u2500 \u2026 (truncated)`);
          break;
        }
        let g = h[p],
          $ = p === h.length - 1,
          w = $ ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ",
          _ = d + ($ ? "    " : "\u2502   "),
          x = g.isDirectory() ? g.name + "/" : g.name;
        (c.push(`${d}${w}${x}`),
          i++,
          g.isDirectory() && l(Qe.join(u, g.name), _, f + 1));
      }
    }
    return (
      l(t, "", 1),
      c.join(`
`)
    );
  }
  var ea = new Map(),
    Kn = new Map(),
    Qo = null,
    _w = 3e4;
  async function nn(t) {
    try {
      return await t();
    } catch {
      return null;
    }
  }
  async function xw() {
    if (!Qo || Date.now() > Qo) return !1;
    let t = [
      Qe.join(process.cwd(), "package.json"),
      Qe.join(process.cwd(), "README.md"),
      Qe.join(process.cwd(), ".gitignore"),
    ];
    for (let e of t)
      try {
        let s = await Tt.stat(e),
          o = Kn.get(e);
        if (!o || s.mtimeMs !== o) return !1;
      } catch {
        if (Kn.has(e)) return !1;
      }
    try {
      let e = Qe.join(process.cwd(), ".git", "HEAD"),
        s = await Tt.stat(e),
        o = Kn.get(e);
      if (!o || s.mtimeMs !== o) return !1;
    } catch {}
    return !0;
  }
  async function kw() {
    let t = [
      Qe.join(process.cwd(), "package.json"),
      Qe.join(process.cwd(), "README.md"),
      Qe.join(process.cwd(), ".gitignore"),
      Qe.join(process.cwd(), ".git", "HEAD"),
    ];
    for (let e of t)
      try {
        let s = await Tt.stat(e);
        Kn.set(e, s.mtimeMs);
      } catch {
        Kn.delete(e);
      }
  }
  async function vw(t) {
    let e = "fileContext",
      s = ea.get(e),
      o = !1;
    if ((s && (await xw()) && (o = !0), !o)) {
      let u = [],
        d = Qe.join(t, "package.json");
      if (
        await nn(() =>
          Tt.access(d)
            .then(() => !0)
            .catch(() => !1),
        )
      )
        try {
          let $ = await Tt.readFile(d, "utf-8"),
            w = JSON.parse($),
            _ = { name: w.name, version: w.version };
          (w.scripts && (_.scripts = Object.keys(w.scripts).slice(0, 15)),
            w.dependencies && (_.deps = Object.keys(w.dependencies).length),
            w.devDependencies &&
              (_.devDeps = Object.keys(w.devDependencies).length),
            u.push(`PACKAGE: ${JSON.stringify(_)}`));
        } catch {}
      let m = Qe.join(t, "README.md");
      if (
        await nn(() =>
          Tt.access(m)
            .then(() => !0)
            .catch(() => !1),
        )
      ) {
        let w = (await Tt.readFile(m, "utf-8"))
          .split(
            `
`,
          )
          .slice(0, 50);
        u.push(`README (first 50 lines):
${w.join(`
`)}`);
      }
      let p = Qe.join(t, ".gitignore");
      if (
        await nn(() =>
          Tt.access(p)
            .then(() => !0)
            .catch(() => !1),
        )
      ) {
        let $ = await Tt.readFile(p, "utf-8");
        u.push(`GITIGNORE:
${$.trim()}`);
      }
      ((s = u.join(`

`)),
        ea.set(e, s),
        (Qo = Date.now() + _w),
        await kw());
    }
    let n = [s],
      [r, i, c, l] = await Promise.all([
        nn(async () => {
          let { stdout: u } = await Vo("git branch --show-current", {
            cwd: t,
            timeout: 5e3,
          });
          return u.trim();
        }),
        nn(async () => {
          let { stdout: u } = await Vo("git status --short", {
            cwd: t,
            timeout: 5e3,
          });
          return u.trim();
        }),
        nn(async () => {
          let { stdout: u } = await Vo("git log --oneline -5", {
            cwd: t,
            timeout: 5e3,
          });
          return u.trim();
        }),
        vd(),
      ]);
    if (
      (r && n.push(`GIT BRANCH: ${r}`),
      i &&
        n.push(`GIT STATUS:
${i}`),
      c &&
        n.push(`RECENT COMMITS:
${c}`),
      l && l.length > 0)
    ) {
      let u = l.map((d) => `  ${d.file}`).join(`
`);
      n.push(`MERGE CONFLICTS (resolve before editing these files):
${u}`);
    }
    try {
      let u = gw();
      u && n.push(u);
    } catch {}
    return n.join(`

`);
  }
  async function Sw(t) {
    let e = Qe.join(t, "package.json"),
      s = "";
    if (
      await nn(() =>
        Tt.access(e)
          .then(() => !0)
          .catch(() => !1),
      )
    )
      try {
        let i = await Tt.readFile(e, "utf-8"),
          c = JSON.parse(i);
        s = `${c.name || "?"} v${c.version || "?"}`;
      } catch {}
    let [n, r] = await Promise.all([
      nn(async () => {
        let { stdout: i } = await Vo("git branch --show-current", {
          cwd: t,
          timeout: 5e3,
        });
        return i.trim();
      }),
      vd(),
    ]);
    if (r && r.length > 0) {
      console.log(
        `${Gn.red}  \u26A0 ${r.length} unresolved merge conflict(s):${Gn.reset}`,
      );
      for (let i of r) console.log(`${Gn.red}    ${i.file}${Gn.reset}`);
      console.log(
        `${Gn.yellow}  \u2192 Resolve conflicts before starting tasks${Gn.reset}`,
      );
    }
    console.log();
  }
  Sd.exports = {
    gatherProjectContext: vw,
    printContext: Sw,
    generateFileTree: bw,
    _clearContextCache: () => {
      (ea.clear(), Kn.clear(), (Qo = null));
    },
  };
});
var Rt = K((Kk, Cd) => {
  var sn = require("fs"),
    ta = require("path"),
    { atomicWrite: Ew } = Qt();
  function er() {
    return ta.join(process.cwd(), ".nex", "sessions");
  }
  function Ed() {
    let t = er();
    sn.existsSync(t) || sn.mkdirSync(t, { recursive: !0 });
  }
  function na(t) {
    let e = t.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 100);
    return ta.join(er(), `${e}.json`);
  }
  function sa(t, e, s = {}) {
    Ed();
    let o = na(t),
      n = {
        name: t,
        createdAt: s.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: e.length,
        model: s.model || null,
        provider: s.provider || null,
        messages: e,
      };
    return (Ew(o, JSON.stringify(n, null, 2)), { path: o, name: t });
  }
  function Td(t) {
    let e = na(t);
    if (!sn.existsSync(e)) return null;
    try {
      return JSON.parse(sn.readFileSync(e, "utf-8"));
    } catch {
      return null;
    }
  }
  function Rd() {
    Ed();
    let t = er(),
      e = sn.readdirSync(t).filter((o) => o.endsWith(".json")),
      s = [];
    for (let o of e)
      try {
        let n = JSON.parse(sn.readFileSync(ta.join(t, o), "utf-8"));
        s.push({
          name: n.name || o.replace(".json", ""),
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
          messageCount: n.messageCount || 0,
          model: n.model,
          provider: n.provider,
          score: n.score != null ? n.score : null,
          scoreGrade: n.scoreGrade || null,
        });
      } catch {}
    return s.sort((o, n) =>
      (n.updatedAt || "").localeCompare(o.updatedAt || ""),
    );
  }
  function Tw(t) {
    let e = na(t);
    return sn.existsSync(e) ? (sn.unlinkSync(e), !0) : !1;
  }
  function Rw() {
    let t = Rd();
    return t.length === 0 ? null : Td(t[0].name);
  }
  var bn = null,
    Ht = null,
    Os = null;
  function Cw(t, e = {}) {
    t.length !== 0 &&
      (bn && clearTimeout(bn),
      (Ht = t),
      (Os = e || {}),
      (bn = setTimeout(() => {
        (Ht && Ht.length > 0 && sa("_autosave", Ht, Os),
          (bn = null),
          (Ht = null),
          (Os = null));
      }, 5e3)));
  }
  function Aw() {
    (bn && (clearTimeout(bn), (bn = null)),
      Ht &&
        Ht.length > 0 &&
        (sa("_autosave", Ht, Os), (Ht = null), (Os = null)));
  }
  Cd.exports = {
    saveSession: sa,
    loadSession: Td,
    listSessions: Rd,
    deleteSession: Tw,
    getLastSession: Rw,
    autoSave: Cw,
    flushAutoSave: Aw,
    _getSessionsDir: er,
  };
});
var tr = K((Yk, jd) => {
  "use strict";
  var Ns = require("fs"),
    Ad = require("path");
  function Od(t) {
    let e = [];
    return (
      t.forEach((s, o) => {
        s.role === "assistant" &&
          (Array.isArray(s.content) &&
            s.content.forEach((n) => {
              n &&
                n.type === "tool_use" &&
                e.push({ name: n.name || "", input: n.input || {}, index: o });
            }),
          Array.isArray(s.tool_calls) &&
            s.tool_calls.forEach((n) => {
              let r = n.function?.name || n.name || "",
                i = {};
              try {
                i =
                  typeof n.function?.arguments == "string"
                    ? JSON.parse(n.function.arguments)
                    : n.function?.arguments || n.input || {};
              } catch {}
              e.push({ name: r, input: i, index: o });
            }));
      }),
      e
    );
  }
  function Nd(t) {
    let e = [];
    return (
      t.forEach((s, o) => {
        if (
          (s.role === "user" &&
            Array.isArray(s.content) &&
            s.content.forEach((n) => {
              if (n && n.type === "tool_result") {
                let r =
                  typeof n.content == "string"
                    ? n.content
                    : Array.isArray(n.content)
                      ? n.content
                          .map((i) => (typeof i == "string" ? i : i.text || ""))
                          .join("")
                      : JSON.stringify(n.content || "");
                e.push({ content: r, index: o });
              }
            }),
          s.role === "tool")
        ) {
          let n =
            typeof s.content == "string"
              ? s.content
              : JSON.stringify(s.content || "");
          e.push({ content: n, index: o });
        }
      }),
      e
    );
  }
  function Md(t) {
    for (let e = t.length - 1; e >= 0; e--) {
      let s = t[e];
      if (s.role === "assistant") {
        if (typeof s.content == "string") return s.content.trim();
        if (Array.isArray(s.content)) {
          let o = s.content
            .filter((n) => n && (n.type === "text" || typeof n == "string"))
            .map((n) => (typeof n == "string" ? n : n.text || ""))
            .join("")
            .trim();
          if (o) return o;
        }
      }
    }
    return "";
  }
  function Pd(t, e) {
    let s = [];
    for (let o = t.length - 1; o >= 0 && s.length < e; o--) {
      let n = t[o];
      if (n.role !== "assistant") continue;
      let r = "";
      (typeof n.content == "string"
        ? (r = n.content.trim())
        : Array.isArray(n.content) &&
          (r = n.content
            .filter((i) => i && (i.type === "text" || typeof i == "string"))
            .map((i) => (typeof i == "string" ? i : i.text || ""))
            .join("")
            .trim()),
        r && s.push(r));
    }
    return s;
  }
  function Id(t) {
    let e = new Map();
    for (let s of t) {
      let o;
      try {
        o = JSON.stringify(s.input);
      } catch {
        o = String(s.input);
      }
      let n = `${s.name}|${o}`;
      e.set(n, (e.get(n) || 0) + 1);
    }
    return e;
  }
  function Ld(t) {
    if (!Array.isArray(t) || t.length === 0)
      return {
        score: 0,
        issues: ["Empty or invalid session \u2014 no messages to analyse"],
        summary: "No messages found",
      };
    let e = 10,
      s = [],
      o = Od(t),
      n = Nd(t),
      r = o.length;
    t.some(
      (R) =>
        R.role === "user" &&
        typeof R.content == "string" &&
        R.content.startsWith("[SYSTEM WARNING]") &&
        (R.content.includes("edited") ||
          R.content.includes("bash command") ||
          R.content.includes("grep pattern") ||
          R.content.includes("re-read") ||
          R.content.includes("already in your context")),
    ) &&
      ((e -= 2),
      s.push(
        "Loop-warning was fired during session (repeated file edits, bash commands, or re-reads)",
      ));
    let c = o.find((R) => {
      let L = R.input?.command || R.input?.cmd || "";
      return /\bsed\s+-n\b/.test(L);
    });
    if (c) {
      let R = (c.input?.command || c.input?.cmd || "").slice(0, 80);
      ((e -= 1.5), s.push(`sed -n anti-pattern used: ${R}`));
    }
    o.find((R) => {
      if (R.name !== "grep" && R.name !== "bash" && R.name !== "ssh_exec")
        return !1;
      let L = R.input?.command || R.input?.cmd || "",
        Z = R.input?.pattern || "",
        se = `${L} ${Z}`;
      return (
        /(?:-[CAB]|--context|--after|--before)\s*[=\s]?([2-9][1-9]|\d{3,})/.test(
          se,
        ) || /grep.*-[CAB]\s*([2-9][1-9]|\d{3,})/.test(se)
      );
    }) &&
      ((e -= 1),
      s.push("grep used with >20 context lines (context flood risk)"));
    let u = t.some((R) => R.role === "assistant"),
      d = Md(t),
      m = Pd(t, 3).some((R) => R.length > 100 && !/^[^.!]{0,40}\?$/.test(R));
    if (u && !m && (d.length < 50 || /^[^.!]{0,40}\?$/.test(d))) {
      e -= 2;
      let R =
        d.length > 0 ? `"${d.slice(0, 60)}..."` : "(no assistant text found)";
      s.push(
        `Session ends without diagnosis \u2014 last response too short or is only a question: ${R}`,
      );
    }
    (r > 40
      ? ((e -= 1.5), s.push(`Excessive tool calls: ${r} (>40 threshold)`))
      : r > 25 &&
        ((e -= 0.5), s.push(`High tool call count: ${r} (>25 threshold)`)),
      t.some((R) => {
        let L =
          typeof R.content == "string"
            ? R.content
            : Array.isArray(R.content)
              ? R.content
                  .map((Z) => (typeof Z == "string" ? Z : Z.text || ""))
                  .join("")
              : "";
        return /\[auto-compressed|context compacted|force-compressed/.test(L);
      }) &&
        ((e -= 0.5),
        s.push("Auto-compress triggered (context flood indicator)")));
    let g = Id(o),
      $ = 0,
      w = "";
    for (let [R, L] of g) L > $ && (($ = L), (w = R));
    if ($ >= 3) {
      let [R] = w.split("|");
      ((e -= 1), s.push(`Same tool call repeated ${$}\xD7 (tool: ${R})`));
    }
    let _ = !1;
    for (let R of n)
      if (
        R.content &&
        R.content.includes('"valid":true') &&
        o.filter((Z) => Z.index > R.index).length > 0
      ) {
        _ = !0;
        break;
      }
    _ &&
      ((e -= 1.5),
      s.push(
        'Stop-trigger ignored: tool result contained "valid":true but session continued with more tool calls',
      ));
    let x = o.filter((R) => R.name === "ssh_exec");
    if (x.length >= 8) {
      let R = 0,
        L = 1;
      for (let Z = 1; Z < x.length; Z++)
        x[Z].index <= x[Z - 1].index + 2
          ? L++
          : ((R = Math.max(R, L)), (L = 1));
      ((R = Math.max(R, L)),
        R >= 8 &&
          ((e -= 0.5),
          s.push(`SSH reconnect storm: ${R} consecutive SSH calls`)));
    }
    let v = new Map();
    for (let R of o)
      if (R.name === "read_file" && R.input?.path) {
        let L = R.input.path;
        v.has(L) || v.set(L, { count: 0, ranges: [] });
        let Z = v.get(L);
        if ((Z.count++, R.input.line_start != null)) {
          let se = R.input.line_start || 1,
            oe = R.input.line_end || se + 350;
          Z.ranges.push([se, oe]);
        }
      }
    function b(R, L, Z) {
      for (let [se, oe] of Z) {
        let M = Math.max(R, se),
          q = Math.min(L, oe);
        if (q > M) {
          let re = q - M,
            Y = L - R || 1;
          if (re / Y >= 0.7) return !0;
        }
      }
      return !1;
    }
    let k = 0,
      A = "";
    for (let [R, L] of v) {
      if (L.count < 3) continue;
      if (L.ranges.length === L.count) {
        let se = !1,
          oe = [];
        for (let [M, q] of L.ranges) {
          if (oe.length > 0 && b(M, q, oe)) {
            se = !0;
            break;
          }
          oe.push([M, q]);
        }
        if (!se) continue;
      }
      L.count > k && ((k = L.count), (A = R));
    }
    if (k >= 3) {
      e -= 1;
      let R = A.split("/").slice(-2).join("/");
      s.push(`read_file loop: "${R}" read ${k}\xD7 (file already in context)`);
    }
    let O = 0,
      P = "";
    for (let [R, L] of v) {
      if (L.ranges.length < 4) continue;
      let Z = [],
        se = !1;
      for (let [oe, M] of L.ranges) {
        if (Z.length > 0 && b(oe, M, Z)) {
          se = !0;
          break;
        }
        Z.push([oe, M]);
      }
      !se && L.ranges.length > O && ((O = L.ranges.length), (P = R));
    }
    if (O >= 4) {
      e -= 0.5;
      let R = P.split("/").slice(-2).join("/");
      s.push(
        `File-scroll pattern: "${R}" read in ${O} sequential sections \u2014 use grep instead`,
      );
    }
    let W = new Map();
    for (let R of o)
      if (R.name === "grep" && R.input?.path && R.input?.pattern) {
        let L = R.input.path;
        (W.has(L) || W.set(L, new Set()), W.get(L).add(R.input.pattern));
      }
    let Le = 0,
      we = "";
    for (let [R, L] of W) L.size > Le && ((Le = L.size), (we = R));
    if (Le >= 3) {
      e -= 0.75;
      let R = we.split("/").slice(-2).join("/");
      s.push(
        `grep flood on single file: "${R}" searched ${Le}\xD7 with different patterns (file already in context)`,
      );
    }
    {
      let R = new Set(),
        L = new Set(),
        Z = /^(test_|demo_|temp_|tmp_|scratch_)/;
      for (let oe of o) {
        if (oe.name === "write_file" && oe.input?.path) {
          let M = oe.input.path.split("/").pop(),
            q = oe.input.path.includes("/tests/");
          Z.test(M) && !q && R.add(oe.input.path);
        }
        if (
          (oe.name === "bash" || oe.name === "ssh_exec") &&
          oe.input?.command
        ) {
          let M = oe.input.command.match(/\brm\s+(?:-\w+\s+)?(\S+)/g);
          if (M)
            for (let q of M) {
              let re = q.split(/\s+/),
                Y = re[re.length - 1];
              for (let Q of R)
                (Q.endsWith(Y) || Y.endsWith(Q.split("/").pop())) && L.add(Q);
            }
        }
      }
      let se = L.size;
      if (se >= 1) {
        let oe = Math.min(se * 0.25, 0.5);
        e -= oe;
        let M = [...L].map((q) => q.split("/").pop()).join(", ");
        s.push(
          `Temp file write-then-delete: ${M} \u2014 write inline logic or use tests/ instead`,
        );
      }
    }
    let fe = n.filter((R) => R.content.startsWith("EXIT")).length;
    fe >= 10
      ? ((e -= 1),
        s.push(
          `Bash exit-error storm: ${fe} tool results started with EXIT (repeated failing commands)`,
        ))
      : fe >= 5 &&
        ((e -= 0.5),
        s.push(
          `Repeated bash errors: ${fe} tool results with non-zero exit code`,
        ));
    for (let R of t) {
      if (R.role !== "assistant") continue;
      let L = "";
      if (
        (typeof R.content == "string"
          ? (L = R.content)
          : Array.isArray(R.content) &&
            (L = R.content
              .filter((Y) => Y && (Y.type === "text" || typeof Y == "string"))
              .map((Y) => (typeof Y == "string" ? Y : Y.text || ""))
              .join("")),
        L.length <= 5e3)
      )
        continue;
      let Z = L.split(/(?<=\. )/).filter((Y) => Y.trim().length > 0);
      if (Z.length < 6) continue;
      let se = new Map();
      for (let Y = 0; Y <= Z.length - 3; Y++) {
        let Q = Z.slice(Y, Y + 3)
          .join("")
          .trim();
        Q.length > 30 && se.set(Q, (se.get(Q) || 0) + 1);
      }
      let oe = 0,
        M = "";
      for (let [Y, Q] of se) Q > oe && ((oe = Q), (M = Y));
      if (oe < 3) continue;
      let re = (M.length * oe) / L.length;
      if (re >= 0.4 || oe >= 10) {
        ((e -= 1.5),
          s.push(
            `llm output loop: assistant message repeated content detected (${oe}\xD7 same paragraph, ${Math.round(re * 100)}% repeated)`,
          ));
        break;
      }
    }
    {
      let R = new Set([
          "read_file",
          "list_directory",
          "search_files",
          "glob",
          "grep",
        ]),
        L = t.some((se) =>
          Array.isArray(se.tool_calls)
            ? se.tool_calls.some((oe) => R.has(oe.function?.name))
            : Array.isArray(se.content)
              ? se.content.some(
                  (oe) => oe.type === "tool_use" && R.has(oe.name),
                )
              : !1,
        );
      t.some(
        (se) =>
          se.role === "assistant" &&
          typeof se.content == "string" &&
          (se.content.includes("## Steps") ||
            se.content.includes("/plan approve")),
      ) &&
        !L &&
        ((e -= 2),
        s.push(
          "plan written without reading any files \u2014 LLM invented data structures from training knowledge (hallucination risk)",
        ));
    }
    let G = n.filter((R) => R.content.startsWith("BLOCKED:"));
    if (G.length > 0) {
      let R = Math.min(G.length * 0.5, 1.5);
      ((e -= R),
        s.push(
          `${G.length} tool call${G.length === 1 ? "" : "s"} blocked (agent attempted denied actions)`,
        ));
    }
    let z = t.filter((R) => {
      let L = typeof R.content == "string" ? R.content : "";
      return /\[SYSTEM WARNING\] Context wiped \d+×/.test(L);
    }).length;
    if (z > 0) {
      let R = Math.min(z * 1, 2);
      ((e -= R),
        s.push(
          `Super-nuclear context wipe fired ${z}\xD7 (context collapse \u2014 task too large or read loops)`,
        ));
    }
    {
      let R = !1,
        L = !1,
        Z = !1;
      for (let oe of o) {
        if (oe.name !== "bash") continue;
        let M = (oe.input?.command || oe.input?.cmd || "").trim();
        (!(/cat\s*>/.test(M) || /<</.test(M)) &&
          /\bcat\s+\S/.test(M) &&
          (R = !0),
          /^\s*ls(\s|$)/.test(M) &&
            !/npm|yarn|pnpm|make|git\b/.test(M) &&
            (L = !0),
          /\bfind\s+\S/.test(M) && !/git\b|npm\b|-exec\b/.test(M) && (Z = !0));
      }
      let se = [R, L, Z].filter(Boolean).length;
      if (se > 0) {
        let oe = Math.min(se * 0.25, 0.75);
        e -= oe;
        let M = [];
        (R && M.push("cat (use read_file)"),
          L && M.push("ls (use list_directory)"),
          Z && M.push("find (use glob)"),
          s.push(`bash used instead of dedicated tool: ${M.join(", ")}`));
      }
    }
    ((e = Math.max(0, Math.min(10, e))), (e = Math.round(e * 10) / 10));
    let ne = e >= 9 ? "A" : e >= 8 ? "B" : e >= 7 ? "C" : e >= 6 ? "D" : "F",
      ae =
        s.length === 0
          ? `Clean session \u2014 no quality issues detected (${r} tool calls)`
          : `${s.length} issue${s.length === 1 ? "" : "s"} found \u2014 ${r} tool calls`;
    return { score: e, grade: ne, issues: s, summary: ae };
  }
  function Ow(t) {
    try {
      let { loadSession: e } = Rt(),
        s = e(t);
      return s ? Ld(s.messages || []) : null;
    } catch {
      return null;
    }
  }
  function Nw(t, e = null) {
    let { score: s, grade: o, issues: n, summary: r } = t,
      i = e?.dim || "",
      c = e?.reset || "",
      l = e?.green || "",
      u = e?.yellow || "",
      d = e?.red || "",
      f = e?.cyan || "",
      m = e?.bold || "",
      h = s >= 8 ? l : s >= 6 ? u : d,
      p = `
${i}  Session score: ${c}${m}${h}${s}/10 (${o})${c}`;
    if ((r && (p += `  ${i}${r}${c}`), n.length > 0))
      for (let g of n)
        p += `
  ${u}\u26A0${c} ${i}${g}${c}`;
    return p;
  }
  function Mw(t, e = {}) {
    try {
      let s = Ad.join(process.cwd(), ".nex");
      Ns.existsSync(s) || Ns.mkdirSync(s, { recursive: !0 });
      let o = Ad.join(s, "benchmark-history.json"),
        n = [];
      if (Ns.existsSync(o))
        try {
          n = JSON.parse(Ns.readFileSync(o, "utf-8"));
        } catch {
          n = [];
        }
      Array.isArray(n) || (n = []);
      let r = t >= 9 ? "A" : t >= 8 ? "B" : t >= 7 ? "C" : t >= 6 ? "D" : "F",
        i = {
          date: new Date().toISOString(),
          version: e.version || null,
          model: e.model || null,
          score: t,
          grade: r,
          sessionName: e.sessionName || null,
          issues: Array.isArray(e.issues) ? e.issues : [],
        };
      (n.push(i),
        n.length > 100 && (n = n.slice(n.length - 100)),
        Ns.writeFileSync(o, JSON.stringify(n, null, 2)));
    } catch {}
  }
  jd.exports = {
    scoreMessages: Ld,
    scoreSession: Ow,
    formatScore: Nw,
    appendScoreHistory: Mw,
    _extractToolCalls: Od,
    _extractToolResults: Nd,
    _getLastAssistantText: Md,
    _getLastNAssistantTexts: Pd,
    _countDuplicateToolCalls: Id,
  };
});
var rn = K((zk, Hd) => {
  var on = require("fs"),
    nr = require("path"),
    Pw = require("os"),
    { atomicWrite: Iw, withFileLockSync: Dd } = Qt();
  function oa() {
    return nr.join(process.cwd(), ".nex", "memory");
  }
  function Ms() {
    return nr.join(oa(), "memory.json");
  }
  function Lw() {
    return nr.join(process.cwd(), "NEX.md");
  }
  function qd() {
    return nr.join(Pw.homedir(), ".nex", "NEX.md");
  }
  function ra() {
    let t = oa();
    on.existsSync(t) || on.mkdirSync(t, { recursive: !0 });
  }
  function sr() {
    let t = Ms();
    if (!on.existsSync(t)) return {};
    try {
      return JSON.parse(on.readFileSync(t, "utf-8"));
    } catch {
      return {};
    }
  }
  function Fd(t) {
    (ra(), Iw(Ms(), JSON.stringify(t, null, 2)));
  }
  function jw(t, e) {
    (ra(),
      Dd(Ms(), () => {
        let s = sr();
        ((s[t] = { value: e, updatedAt: new Date().toISOString() }), Fd(s));
      }));
  }
  function Dw(t) {
    let e = sr();
    return e[t] ? e[t].value : null;
  }
  function qw(t) {
    return (
      ra(),
      Dd(Ms(), () => {
        let e = sr();
        return t in e ? (delete e[t], Fd(e), !0) : !1;
      })
    );
  }
  function Ud() {
    let t = sr();
    return Object.entries(t).map(([e, s]) => ({
      key: e,
      value: s.value,
      updatedAt: s.updatedAt,
    }));
  }
  function Wd() {
    let t = qd();
    if (!on.existsSync(t)) return "";
    try {
      return on.readFileSync(t, "utf-8").trim();
    } catch {
      return "";
    }
  }
  function Bd() {
    let t = Lw();
    if (!on.existsSync(t)) return "";
    try {
      return on.readFileSync(t, "utf-8").trim();
    } catch {
      return "";
    }
  }
  function Fw() {
    let t = [],
      e = Wd();
    e &&
      t.push(`GLOBAL INSTRUCTIONS (~/.nex/NEX.md):
${e}`);
    let s = Bd();
    s &&
      t.push(`PROJECT INSTRUCTIONS (NEX.md):
${s}`);
    let o = Ud();
    if (o.length > 0) {
      let n = o.map((r) => `  ${r.key}: ${r.value}`).join(`
`);
      t.push(`PROJECT MEMORY:
${n}`);
    }
    return t.join(`

`);
  }
  Hd.exports = {
    remember: jw,
    recall: Dw,
    forget: qw,
    listMemories: Ud,
    loadGlobalInstructions: Wd,
    loadProjectInstructions: Bd,
    getMemoryContext: Fw,
    _getMemoryDir: oa,
    _getMemoryFile: Ms,
    _getGlobalNexMdPath: qd,
  };
});
var Is = K((Jk, Xd) => {
  var mt = require("fs"),
    Yn = require("path"),
    { C: Xk } = Ce(),
    { atomicWrite: Uw, withFileLockSync: Ww } = Qt(),
    or = {
      bash: "ask",
      read_file: "allow",
      write_file: "ask",
      edit_file: "ask",
      list_directory: "allow",
      search_files: "allow",
      glob: "allow",
      grep: "allow",
      patch_file: "ask",
      web_fetch: "allow",
      web_search: "allow",
      ask_user: "allow",
      task_list: "allow",
      spawn_agents: "ask",
    },
    zn = { ...or };
  function Gd() {
    let t = Yn.join(process.cwd(), ".nex", "config.json");
    if (mt.existsSync(t))
      try {
        let e = JSON.parse(mt.readFileSync(t, "utf-8"));
        e.permissions && (zn = { ...or, ...e.permissions });
      } catch {}
  }
  function Bw() {
    let t = Yn.join(process.cwd(), ".nex"),
      e = Yn.join(t, "config.json");
    (mt.existsSync(t) || mt.mkdirSync(t, { recursive: !0 }),
      Ww(e, () => {
        let s = {};
        if (mt.existsSync(e))
          try {
            s = JSON.parse(mt.readFileSync(e, "utf-8"));
          } catch {
            s = {};
          }
        ((s.permissions = zn), Uw(e, JSON.stringify(s, null, 2)));
      }));
  }
  function Kd(t) {
    return zn[t] || "ask";
  }
  function Hw(t, e) {
    return ["allow", "ask", "deny"].includes(e) ? ((zn[t] = e), !0) : !1;
  }
  function Gw(t) {
    return Kd(t);
  }
  function Kw() {
    return Object.entries(zn).map(([t, e]) => ({ tool: t, mode: e }));
  }
  function Yw() {
    zn = { ...or };
  }
  var Ps = {
    readonly: {
      description: "Read-only access \u2014 can search and read but not modify",
      allowedTools: [
        "read_file",
        "list_directory",
        "search_files",
        "glob",
        "grep",
        "git_status",
        "git_diff",
        "git_log",
        "ask_user",
        "web_fetch",
        "web_search",
        "browser_open",
        "browser_screenshot",
        "task_list",
      ],
      blockedTools: [
        "bash",
        "write_file",
        "edit_file",
        "patch_file",
        "deploy",
        "ssh_exec",
        "service_manage",
        "container_manage",
        "container_exec",
        "remote_agent",
      ],
      autoConfirm: !1,
      allowDangerous: !1,
    },
    developer: {
      description:
        "Standard developer access \u2014 can read, write, and run commands",
      allowedTools: null,
      blockedTools: [
        "deploy",
        "service_manage",
        "container_manage",
        "remote_agent",
      ],
      autoConfirm: !1,
      allowDangerous: !1,
    },
    admin: {
      description:
        "Full access \u2014 all tools, including deployment and infrastructure",
      allowedTools: null,
      blockedTools: [],
      autoConfirm: !1,
      allowDangerous: !0,
    },
  };
  function Yd() {
    let t = Yn.join(process.cwd(), ".nex", "config.json");
    try {
      return (
        (mt.existsSync(t) &&
          JSON.parse(mt.readFileSync(t, "utf-8")).teamPermissions) ||
        null
      );
    } catch {
      return null;
    }
  }
  function zw(t) {
    let e = Yn.join(process.cwd(), ".nex"),
      s = Yn.join(e, "config.json");
    mt.existsSync(e) || mt.mkdirSync(e, { recursive: !0 });
    let o = {};
    try {
      mt.existsSync(s) && (o = JSON.parse(mt.readFileSync(s, "utf-8")));
    } catch {
      o = {};
    }
    ((o.teamPermissions = t),
      mt.writeFileSync(s, JSON.stringify(o, null, 2), "utf-8"));
  }
  function zd() {
    let t = Yd();
    if (!t) return Ps.admin;
    let e = t.role || "admin",
      s = Ps[e] || Ps.admin;
    return {
      ...s,
      ...t.overrides,
      blockedTools: [
        ...(s.blockedTools || []),
        ...(t.overrides?.blockedTools || []),
      ],
    };
  }
  function Xw(t) {
    let e = zd();
    return e.blockedTools && e.blockedTools.includes(t)
      ? {
          allowed: !1,
          reason: `Tool "${t}" is blocked by permission preset "${e.description || "custom"}"`,
        }
      : e.allowedTools && !e.allowedTools.includes(t)
        ? {
            allowed: !1,
            reason: `Tool "${t}" is not in the allowed list for this permission level`,
          }
        : { allowed: !0 };
  }
  function Jw() {
    return Object.entries(Ps).map(([t, e]) => ({
      name: t,
      description: e.description,
      toolCount: e.allowedTools
        ? `${e.allowedTools.length} allowed`
        : "all allowed",
      blockedCount: e.blockedTools.length,
    }));
  }
  Gd();
  Xd.exports = {
    getPermission: Kd,
    setPermission: Hw,
    checkPermission: Gw,
    listPermissions: Kw,
    loadPermissions: Gd,
    savePermissions: Bw,
    resetPermissions: Yw,
    DEFAULT_PERMISSIONS: or,
    PERMISSION_PRESETS: Ps,
    loadPresetConfig: Yd,
    savePresetConfig: zw,
    getEffectivePreset: zd,
    isToolAllowed: Xw,
    listPresets: Jw,
  };
});
var Pt = K((Qk, ef) => {
  var xn = require("fs"),
    rr = require("path"),
    Vk = require("readline"),
    { C: be } = Ce(),
    ye = null,
    aa = !1,
    ca = null,
    Jd = new Set([
      "read_file",
      "list_directory",
      "search_files",
      "glob",
      "grep",
      "web_search",
      "web_fetch",
      "git_status",
      "git_diff",
      "git_log",
      "git_show",
    ]);
  function ir() {
    return rr.join(process.cwd(), ".nex", "plans");
  }
  function Vd() {
    let t = ir();
    xn.existsSync(t) || xn.mkdirSync(t, { recursive: !0 });
  }
  function Vw(t, e = []) {
    return (
      (ye = {
        name: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        task: t,
        steps: e.map((s) => ({
          description: s.description || s,
          files: s.files || [],
          status: "pending",
        })),
        status: "draft",
        createdAt: new Date().toISOString(),
      }),
      ye
    );
  }
  function Qw() {
    return ye;
  }
  function Zw(t) {
    aa = t;
  }
  function e0() {
    return aa;
  }
  function t0() {
    return !ye || ye.status !== "draft"
      ? !1
      : ((ye.status = "approved"),
        (ye.updatedAt = new Date().toISOString()),
        !0);
  }
  function n0() {
    return !ye || ye.status !== "approved"
      ? !1
      : ((ye.status = "executing"), !0);
  }
  function ia(t, e) {
    return !ye || t < 0 || t >= ye.steps.length
      ? !1
      : ((ye.steps[t].status = e),
        (ye.updatedAt = new Date().toISOString()),
        ye.steps.every((s) => s.status === "done" || s.status === "skipped") &&
          (ye.status = "completed"),
        !0);
  }
  function s0(t) {
    if (!t) return `${be.dim}No active plan${be.reset}`;
    let e = {
        draft: `${be.yellow}DRAFT${be.reset}`,
        approved: `${be.green}APPROVED${be.reset}`,
        executing: `${be.blue}EXECUTING${be.reset}`,
        completed: `${be.green}COMPLETED${be.reset}`,
      },
      s = [];
    (s.push(`
${be.bold}${be.cyan}Plan: ${t.task}${be.reset}`),
      s.push(`${be.dim}Status: ${e[t.status] || t.status}${be.reset}
`));
    for (let o = 0; o < t.steps.length; o++) {
      let n = t.steps[o],
        r;
      switch (n.status) {
        case "done":
          r = `${be.green}\u2713${be.reset}`;
          break;
        case "in_progress":
          r = `${be.blue}\u2192${be.reset}`;
          break;
        case "skipped":
          r = `${be.dim}\u25CB${be.reset}`;
          break;
        default:
          r = `${be.dim} ${be.reset}`;
      }
      (s.push(`  ${r} ${be.bold}Step ${o + 1}:${be.reset} ${n.description}`),
        n.files.length > 0 &&
          s.push(`    ${be.dim}Files: ${n.files.join(", ")}${be.reset}`));
    }
    return (
      s.push(""),
      s.join(`
`)
    );
  }
  function o0(t) {
    if ((t || (t = ye), !t)) return null;
    Vd();
    let e = rr.join(ir(), `${t.name}.json`);
    return (xn.writeFileSync(e, JSON.stringify(t, null, 2), "utf-8"), e);
  }
  function r0(t) {
    let e = rr.join(ir(), `${t}.json`);
    if (!xn.existsSync(e)) return null;
    try {
      let s = JSON.parse(xn.readFileSync(e, "utf-8"));
      return ((ye = s), s);
    } catch {
      return null;
    }
  }
  function i0() {
    Vd();
    let t = ir(),
      e = xn.readdirSync(t).filter((o) => o.endsWith(".json")),
      s = [];
    for (let o of e)
      try {
        let n = JSON.parse(xn.readFileSync(rr.join(t, o), "utf-8"));
        s.push({
          name: n.name,
          task: n.task,
          status: n.status,
          steps: n.steps ? n.steps.length : 0,
          createdAt: n.createdAt,
        });
      } catch {}
    return s.sort((o, n) =>
      (n.createdAt || "").localeCompare(o.createdAt || ""),
    );
  }
  function a0(t) {
    if (!t) return [];
    let e = [],
      s = t.match(/##\s+Steps?\s*\n([\s\S]*?)(?:\n##|\s*$)/i),
      o = s ? s[1] : t,
      n = /^\s*(\d+)[.)]\s+(.+)/gm,
      r;
    for (; (r = n.exec(o)) !== null; ) {
      let c = r[2]
        .trim()
        .replace(/^\*\*What\*\*:\s*/i, "")
        .replace(/^\*\*\d+\.\*\*\s*/, "")
        .replace(/\*\*/g, "")
        .trim();
      c.length > 3 && e.push({ description: c, files: [], status: "pending" });
    }
    if (e.length === 0) {
      let i = /\*\*Step\s+\d+[:.]\*\*\s*(.+)/gi;
      for (; (r = i.exec(t)) !== null; ) {
        let c = r[1].replace(/\*\*/g, "").trim();
        c.length > 3 &&
          e.push({ description: c, files: [], status: "pending" });
      }
    }
    if (e.length > 0) {
      let i = /\*\*(?:Where|Files?)\*\*:\s*(.+)/gi,
        c = [...t.matchAll(i)];
      for (let l = 0; l < Math.min(e.length, c.length); l++) {
        let u = c[l][1];
        e[l].files = u
          .split(/[,\s]+/)
          .filter((d) => /[./]/.test(d))
          .slice(0, 5);
      }
    }
    return e;
  }
  function c0(t) {
    ca = t;
  }
  function l0() {
    return ca;
  }
  function u0() {
    ((ye = null), (aa = !1), (ca = null), m0());
  }
  function d0() {
    return `
PLAN MODE ACTIVE: You are in analysis-only mode. You MUST NOT execute any changes.

# Allowed Tools (read-only)
You may ONLY use these tools: ${[...Jd].join(", ")}
Any other tool call will be blocked and returned with an error.

# MANDATORY: Read Before You Plan
You MUST call at least 2 read-only tools before writing any plan. NEVER assume:
- What database type is used (SQLite vs JSON files vs MongoDB \u2014 READ to find out)
- What file contains existing routes (check with glob/read_file first)
- What methods a module exposes (read the module file first)
- What the existing code structure looks like (read it, don't invent it)

For any task involving a named module (e.g. "fitness", "calendar", "reminder"):
1. FIRST: glob for the module file and read it to see actual methods/data structures
2. THEN: read the route file if it exists
3. ONLY THEN: write the plan based on what you actually found

# Analysis Phase
Thoroughly investigate before writing a plan:
- Scope: What files and modules are affected?
- Architecture: How does the current code work? What patterns does it follow?
- Dependencies: What depends on the code being changed? What might break?
- Tests: What test coverage exists? What new tests are needed?

# Required Plan Format
After analysis, output a plan in this exact markdown format:

## Summary
One paragraph describing the overall goal.

## Steps
Numbered list. Each step:
- **What**: Clear description of the change
- **Where**: Specific file(s) and line ranges
- **How**: Implementation approach (edit, create, delete)

## Files Affected
Bullet list of all files that will be modified or created.

## Risks
Bullet list of potential issues and mitigations.

# Important
- Order steps by dependency (later steps may depend on earlier ones).
- After presenting the plan, tell the user to type \`/plan approve\` to proceed.
- Do NOT make any file changes \u2014 your role is analysis and planning only.
- Do NOT call ask_user. If anything is ambiguous, add an "## Assumptions" section to the plan and state your assumption. The user approves or rejects the whole plan \u2014 that is the only gate.`;
  }
  var _n = 0;
  function f0() {
    !ye ||
      ye.status !== "executing" ||
      (_n > 0 && ia(_n - 1, "done"),
      _n < ye.steps.length && (ia(_n, "in_progress"), _n++));
  }
  function p0() {
    if (!ye || ye.status !== "executing" || ye.steps.length === 0) return null;
    let t = Math.min(_n, ye.steps.length),
      e = ye.steps.length,
      s = Math.max(0, t - 1),
      o = ye.steps[s]?.description || "";
    return { current: t, total: e, description: o };
  }
  function m0() {
    _n = 0;
  }
  var Qd = ["interactive", "semi-auto", "autonomous"],
    Zd = "interactive";
  function h0(t) {
    return Qd.includes(t) ? ((Zd = t), !0) : !1;
  }
  function g0() {
    return Zd;
  }
  ef.exports = {
    createPlan: Vw,
    getActivePlan: Qw,
    setPlanMode: Zw,
    isPlanMode: e0,
    approvePlan: t0,
    startExecution: n0,
    updateStep: ia,
    formatPlan: s0,
    savePlan: o0,
    loadPlan: r0,
    listPlans: i0,
    clearPlan: u0,
    getPlanModePrompt: d0,
    setPlanContent: c0,
    getPlanContent: l0,
    extractStepsFromText: a0,
    advancePlanStep: f0,
    getPlanStepInfo: p0,
    PLAN_MODE_ALLOWED_TOOLS: Jd,
    setAutonomyLevel: h0,
    getAutonomyLevel: g0,
    AUTONOMY_LEVELS: Qd,
  };
});
var ff = K((Zk, df) => {
  var { C: S } = Ce();
  function tf() {
    return Math.max(10, (process.stdout.columns || 80) - 2);
  }
  function $0(t) {
    if (!t) return "";
    let e = t.split(`
`),
      s = [],
      o = !1,
      n = "";
    for (let r of e) {
      let i = tf();
      if (r.trim().startsWith("```")) {
        if (o)
          (s.push(`${S.dim}${"\u2500".repeat(40)}${S.reset}`),
            (o = !1),
            (n = ""));
        else {
          ((o = !0), (n = r.trim().substring(3).trim()));
          let c = n ? ` ${n} ` : "";
          s.push(
            `${S.dim}${"\u2500".repeat(3)}${c}${"\u2500".repeat(Math.max(0, 37 - c.length))}${S.reset}`,
          );
        }
        continue;
      }
      if (o) {
        s.push(`  ${ua(r, n)}`);
        continue;
      }
      if (r.startsWith("### ")) {
        s.push(`${S.bold}${S.cyan}   ${kn(r.substring(4))}${S.reset}`);
        continue;
      }
      if (r.startsWith("## ")) {
        s.push(`${S.bold}${S.cyan}  ${kn(r.substring(3))}${S.reset}`);
        continue;
      }
      if (r.startsWith("# ")) {
        s.push(`${S.bold}${S.cyan}${kn(r.substring(2))}${S.reset}`);
        continue;
      }
      if (/^\s*[-*]\s/.test(r)) {
        let c = r.match(/^(\s*)/)[1],
          l = r.replace(/^\s*[-*]\s/, ""),
          u = `${c}${S.cyan}\u2022${S.reset} ${vn(l)}`;
        s.push(Sn(u, i, c + "  "));
        continue;
      }
      if (/^\s*\d+\.\s/.test(r)) {
        let c = r.match(/^(\s*)(\d+)\.\s(.*)/);
        if (c) {
          let l = c[1],
            u = c[2],
            d = c[3],
            f = `${l}${S.cyan}${u}.${S.reset} ${vn(d)}`,
            m = l + " ".repeat(u.length + 2);
          s.push(Sn(f, i, m));
          continue;
        }
      }
      s.push(Sn(vn(r), i));
    }
    return s.join(`
`);
  }
  function kn(t) {
    return t
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
  }
  function vn(t) {
    return t
      ? t
          .replace(/`([^`]+)`/g, `${S.cyan}$1${S.reset}`)
          .replace(/\*\*([^*]+)\*\*/g, `${S.bold}$1${S.reset}`)
          .replace(/\*([^*]+)\*/g, `${S.dim}$1${S.reset}`)
          .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            `${S.cyan}$1${S.reset} ${S.dim}($2)${S.reset}`,
          )
      : "";
  }
  function ua(t, e) {
    return t
      ? ["js", "javascript", "ts", "typescript", "jsx", "tsx"].includes(e) || !e
        ? nf(t)
        : e === "bash" || e === "sh" || e === "shell" || e === "zsh"
          ? sf(t)
          : e === "json" || e === "jsonc"
            ? of(t)
            : e === "python" || e === "py"
              ? rf(t)
              : e === "go" || e === "golang"
                ? af(t)
                : e === "rust" || e === "rs"
                  ? cf(t)
                  : e === "css" || e === "scss" || e === "less"
                    ? lf(t)
                    : e === "html" || e === "xml" || e === "svg" || e === "htm"
                      ? uf(t)
                      : t
      : "";
  }
  function nf(t) {
    let e =
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|require|async|await|new|this|throw|try|catch|switch|case|break|default|typeof|instanceof)\b/g,
      s = /(["'`])(?:(?=(\\?))\2.)*?\1/g,
      o = /(\/\/.*$)/,
      n = /\b(\d+\.?\d*)\b/g,
      r = t;
    return (
      (r = r.replace(n, `${S.yellow}$1${S.reset}`)),
      (r = r.replace(e, `${S.magenta}$1${S.reset}`)),
      (r = r.replace(s, `${S.green}$&${S.reset}`)),
      (r = r.replace(o, `${S.dim}$1${S.reset}`)),
      r
    );
  }
  function sf(t) {
    let e = /^(\s*)([\w-]+)/,
      s = /(--?\w[\w-]*)/g,
      o = /(["'])(?:(?=(\\?))\2.)*?\1/g,
      n = /(#.*$)/,
      r = t;
    return (
      (r = r.replace(s, `${S.cyan}$1${S.reset}`)),
      (r = r.replace(e, `$1${S.green}$2${S.reset}`)),
      (r = r.replace(o, `${S.yellow}$&${S.reset}`)),
      (r = r.replace(n, `${S.dim}$1${S.reset}`)),
      r
    );
  }
  function of(t) {
    let e = /("[\w-]+")\s*:/g,
      s = /:\s*("(?:[^"\\]|\\.)*")/g,
      o = /:\s*(\d+\.?\d*)/g,
      n = /:\s*(true|false|null)/g,
      r = t;
    return (
      (r = r.replace(e, `${S.cyan}$1${S.reset}:`)),
      (r = r.replace(s, `: ${S.green}$1${S.reset}`)),
      (r = r.replace(o, `: ${S.yellow}$1${S.reset}`)),
      (r = r.replace(n, `: ${S.magenta}$1${S.reset}`)),
      r
    );
  }
  function rf(t) {
    let e =
        /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|and|or|not|in|is|None|True|False|self|async|await|nonlocal|global)\b/g,
      s =
        /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
      o = /(#.*$)/,
      n = /\b(\d+\.?\d*)\b/g,
      r = /^(\s*@\w+)/,
      i = t;
    return (
      (i = i.replace(n, `${S.yellow}$1${S.reset}`)),
      (i = i.replace(e, `${S.magenta}$1${S.reset}`)),
      (i = i.replace(r, `${S.cyan}$1${S.reset}`)),
      (i = i.replace(s, `${S.green}$&${S.reset}`)),
      (i = i.replace(o, `${S.dim}$1${S.reset}`)),
      i
    );
  }
  function af(t) {
    let e =
        /\b(func|package|import|var|const|type|struct|interface|map|chan|go|defer|return|if|else|for|range|switch|case|default|break|continue|select|fallthrough|nil|true|false|make|new|len|cap|append|copy|delete|panic|recover)\b/g,
      s =
        /\b(string|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|bool|byte|rune|error|any)\b/g,
      o = /(["'`])(?:(?=(\\?))\2.)*?\1/g,
      n = /(\/\/.*$)/,
      r = /\b(\d+\.?\d*)\b/g,
      i = t;
    return (
      (i = i.replace(r, `${S.yellow}$1${S.reset}`)),
      (i = i.replace(s, `${S.cyan}$1${S.reset}`)),
      (i = i.replace(e, `${S.magenta}$1${S.reset}`)),
      (i = i.replace(o, `${S.green}$&${S.reset}`)),
      (i = i.replace(n, `${S.dim}$1${S.reset}`)),
      i
    );
  }
  function cf(t) {
    let e =
        /\b(fn|let|mut|const|struct|enum|impl|trait|pub|use|mod|crate|self|super|match|if|else|for|while|loop|return|break|continue|where|as|in|ref|move|async|await|unsafe|extern|type|static|dyn|macro_rules)\b/g,
      s =
        /\b(i8|i16|i32|i64|i128|u8|u16|u32|u64|u128|f32|f64|bool|char|str|String|Vec|Option|Result|Box|Rc|Arc|Self|Some|None|Ok|Err|true|false)\b/g,
      o = /(["'])(?:(?=(\\?))\2.)*?\1/g,
      n = /(\/\/.*$)/,
      r = /\b(\d+\.?\d*)\b/g,
      i = /\b(\w+!)/g,
      c = t;
    return (
      (c = c.replace(r, `${S.yellow}$1${S.reset}`)),
      (c = c.replace(s, `${S.cyan}$1${S.reset}`)),
      (c = c.replace(e, `${S.magenta}$1${S.reset}`)),
      (c = c.replace(i, `${S.yellow}$1${S.reset}`)),
      (c = c.replace(o, `${S.green}$&${S.reset}`)),
      (c = c.replace(n, `${S.dim}$1${S.reset}`)),
      c
    );
  }
  function lf(t) {
    let e = /^(\s*)([\w-]+)\s*:/,
      s = /:\s*([^;]+)/,
      o = /^(\s*[.#@][\w-]+)/,
      n = /\b(\d+\.?\d*(px|em|rem|%|vh|vw|s|ms|deg|fr)?)\b/g,
      r = /(\/\*.*?\*\/|\/\/.*$)/,
      i = /(#[0-9a-fA-F]{3,8})\b/g,
      c = t;
    return (
      (c = c.replace(i, `${S.yellow}$1${S.reset}`)),
      (c = c.replace(n, `${S.yellow}$1${S.reset}`)),
      (c = c.replace(e, `$1${S.cyan}$2${S.reset}:`)),
      (c = c.replace(o, `$1${S.magenta}$&${S.reset}`)),
      (c = c.replace(r, `${S.dim}$1${S.reset}`)),
      c
    );
  }
  function uf(t) {
    let e = /<\/?(\w[\w-]*)/g,
      s = /\s([\w-]+)=/g,
      o = /(["'])(?:(?=(\\?))\2.)*?\1/g,
      n = /(<!--.*?-->)/g,
      r = /(&\w+;)/g,
      i = t;
    return (
      (i = i.replace(n, `${S.dim}$1${S.reset}`)),
      (i = i.replace(o, `${S.green}$&${S.reset}`)),
      (i = i.replace(e, `<${S.magenta}$1${S.reset}`)),
      (i = i.replace(s, ` ${S.cyan}$1${S.reset}=`)),
      (i = i.replace(r, `${S.yellow}$1${S.reset}`)),
      i
    );
  }
  function Sn(t, e, s = "") {
    if (!e || e < 10) return t;
    let o = "",
      n = 0,
      r = -1,
      i = 0,
      c = 0,
      l = t.length;
    for (; i < l; ) {
      if (t[i] === "\x1B") {
        let u = i + 1;
        if (u < l && t[u] === "[") {
          for (u++; u < l && !/[a-zA-Z]/.test(t[u]); ) u++;
          u < l && u++;
        }
        i = u;
        continue;
      }
      if ((t[i] === " " && (r = i), n++, n > e && r !== -1)) {
        ((o +=
          t.slice(c, r) +
          `
` +
          s),
          (c = r + 1),
          (i = c),
          (n = s.length),
          (r = -1));
        continue;
      }
      (n > e &&
        r === -1 &&
        ((o +=
          t.slice(c, i) +
          `
` +
          s),
        (c = i),
        (n = s.length + 1)),
        i++);
    }
    return ((o += t.slice(c)), o);
  }
  function y0(t, e) {
    if (!t || t.length === 0) return "";
    let s = t.map((i, c) => {
        let l = e.reduce((u, d) => Math.max(u, (d[c] || "").length), 0);
        return Math.max(i.length, l);
      }),
      o = s.map((i) => "\u2500".repeat(i + 2)).join("\u253C"),
      n = t
        .map((i, c) => ` ${S.bold}${i.padEnd(s[c])}${S.reset} `)
        .join("\u2502"),
      r = [];
    (r.push(`${S.dim}\u250C${o.replace(/┼/g, "\u252C")}\u2510${S.reset}`),
      r.push(`${S.dim}\u2502${S.reset}${n}${S.dim}\u2502${S.reset}`),
      r.push(`${S.dim}\u251C${o}\u2524${S.reset}`));
    for (let i of e) {
      let c = t
        .map((l, u) => ` ${(i[u] || "").padEnd(s[u])} `)
        .join(`${S.dim}\u2502${S.reset}`);
      r.push(`${S.dim}\u2502${S.reset}${c}${S.dim}\u2502${S.reset}`);
    }
    return (
      r.push(`${S.dim}\u2514${o.replace(/┼/g, "\u2534")}\u2518${S.reset}`),
      r.join(`
`)
    );
  }
  function w0(t, e, s, o = 30) {
    let n = s > 0 ? Math.round((e / s) * 100) : 0,
      r = Math.round((n / 100) * o),
      i = o - r,
      c = n >= 100 ? S.green : n > 50 ? S.yellow : S.cyan;
    return `  ${t} ${c}${"\u2588".repeat(r)}${S.dim}${"\u2591".repeat(i)}${S.reset} ${n}% (${e}/${s})`;
  }
  var la = class {
    constructor() {
      ((this.buffer = ""),
        (this.inCodeBlock = !1),
        (this.codeBlockLang = ""),
        (this.lineCount = 0),
        (this._cursorTimer = null),
        (this._cursorFrame = 0),
        (this._cursorActive = !1));
    }
    _safeWrite(e) {
      try {
        ((this.lineCount += (e.match(/\n/g) || []).length),
          process.stdout.write(e));
      } catch (s) {
        if (s.code !== "EPIPE") throw s;
      }
    }
    _cursorWrite(e) {
      try {
        process.stderr.write(e);
      } catch (s) {
        if (s.code !== "EPIPE") throw s;
      }
    }
    startCursor() {
      process.stderr.isTTY &&
        ((this._cursorActive = !0),
        (this._cursorFrame = 0),
        this._cursorWrite("\x1B[?25l"),
        this._renderCursor(),
        (this._cursorTimer = setInterval(() => this._renderCursor(), 100)));
    }
    _renderCursor() {
      let s = [0, 1, 2, 3, 4, 3, 2, 1],
        o = s[this._cursorFrame % s.length],
        n = "";
      for (let r = 0; r < 5; r++) n += r === o ? "\x1B[36m\u25CF\x1B[0m" : " ";
      (this._cursorWrite(`\x1B[2K\r${n}`), this._cursorFrame++);
    }
    _clearCursorLine() {
      this._cursorActive && this._cursorWrite("\x1B[2K\r");
    }
    stopCursor() {
      (this._cursorTimer &&
        (clearInterval(this._cursorTimer), (this._cursorTimer = null)),
        this._cursorActive &&
          (this._cursorWrite("\x1B[2K\r\x1B[?25h"), (this._cursorActive = !1)));
    }
    push(e) {
      if (!e) return;
      (this._clearCursorLine(), (this.buffer += e));
      let s;
      for (
        ;
        (s = this.buffer.indexOf(`
`)) !== -1;
      ) {
        let o = this.buffer.substring(0, s);
        ((this.buffer = this.buffer.substring(s + 1)), this._renderLine(o));
      }
      this._cursorActive &&
        (this._renderCursor(),
        this._cursorTimer && clearInterval(this._cursorTimer),
        (this._cursorTimer = setInterval(() => this._renderCursor(), 100)));
    }
    flush() {
      (this.stopCursor(),
        this.buffer && (this._renderLine(this.buffer), (this.buffer = "")),
        this.inCodeBlock &&
          (this._safeWrite(`${S.dim}${"\u2500".repeat(40)}${S.reset}
`),
          (this.inCodeBlock = !1),
          (this.codeBlockLang = "")));
    }
    _renderLine(e) {
      let s = tf();
      if (e.trim().startsWith("```")) {
        if (this.inCodeBlock)
          (this._safeWrite(`${S.dim}${"\u2500".repeat(40)}${S.reset}
`),
            (this.inCodeBlock = !1),
            (this.codeBlockLang = ""));
        else {
          ((this.inCodeBlock = !0),
            (this.codeBlockLang = e.trim().substring(3).trim()));
          let n = this.codeBlockLang ? ` ${this.codeBlockLang} ` : "";
          this
            ._safeWrite(`${S.dim}${"\u2500".repeat(3)}${n}${"\u2500".repeat(Math.max(0, 37 - n.length))}${S.reset}
`);
        }
        return;
      }
      if (this.inCodeBlock) {
        this._safeWrite(`  ${ua(e, this.codeBlockLang)}
`);
        return;
      }
      if (e.startsWith("### ")) {
        this._safeWrite(`${S.bold}${S.cyan}   ${kn(e.substring(4))}${S.reset}
`);
        return;
      }
      if (e.startsWith("## ")) {
        this._safeWrite(`${S.bold}${S.cyan}  ${kn(e.substring(3))}${S.reset}
`);
        return;
      }
      if (e.startsWith("# ")) {
        this._safeWrite(`${S.bold}${S.cyan}${kn(e.substring(2))}${S.reset}
`);
        return;
      }
      if (/^\s*[-*]\s/.test(e)) {
        let n = e.match(/^(\s*)/)[1],
          r = e.replace(/^\s*[-*]\s/, ""),
          i = `${n}${S.cyan}\u2022${S.reset} ${vn(r)}`,
          c = Sn(i, s, n + "  ");
        this._safeWrite(`${c}
`);
        return;
      }
      if (/^\s*\d+\.\s/.test(e)) {
        let n = e.match(/^(\s*)(\d+)\.\s(.*)/);
        if (n) {
          let r = n[1],
            i = n[2],
            c = n[3],
            l = `${r}${S.cyan}${i}.${S.reset} ${vn(c)}`,
            u = r + " ".repeat(i.length + 2),
            d = Sn(l, s, u);
          this._safeWrite(`${d}
`);
          return;
        }
      }
      let o = Sn(vn(e), s);
      this._safeWrite(`${o}
`);
    }
  };
  df.exports = {
    renderMarkdown: $0,
    renderInline: vn,
    stripHeadingMarkers: kn,
    highlightCode: ua,
    highlightJS: nf,
    highlightBash: sf,
    highlightJSON: of,
    highlightPython: rf,
    highlightGo: af,
    highlightRust: cf,
    highlightCSS: lf,
    highlightHTML: uf,
    renderTable: y0,
    renderProgress: w0,
    wrapAnsi: Sn,
    StreamRenderer: la,
  };
});
var pa = K((ev, gf) => {
  var { execSync: b0 } = require("child_process"),
    da = require("path"),
    Ls = require("fs"),
    fa = [
      "pre-tool",
      "post-tool",
      "pre-commit",
      "post-response",
      "session-start",
      "session-end",
    ];
  function pf() {
    return da.join(process.cwd(), ".nex", "hooks");
  }
  function _0() {
    return da.join(process.cwd(), ".nex", "config.json");
  }
  function mf() {
    let t = _0();
    if (!Ls.existsSync(t)) return {};
    try {
      return JSON.parse(Ls.readFileSync(t, "utf-8")).hooks || {};
    } catch {
      return {};
    }
  }
  function ar(t) {
    if (!fa.includes(t)) return [];
    let e = [],
      s = pf(),
      o = da.join(s, t);
    Ls.existsSync(o) && e.push(o);
    let n = mf();
    if (n[t]) {
      let r = Array.isArray(n[t]) ? n[t] : [n[t]];
      e.push(...r);
    }
    return e;
  }
  function hf(t, e = {}, s = 3e4) {
    try {
      return {
        success: !0,
        output: b0(t, {
          cwd: process.cwd(),
          encoding: "utf-8",
          timeout: s,
          env: { ...process.env, ...e },
          stdio: ["pipe", "pipe", "pipe"],
        }).trim(),
      };
    } catch (o) {
      return { success: !1, error: o.stderr ? o.stderr.trim() : o.message };
    }
  }
  function x0(t, e = {}) {
    let s = ar(t);
    if (s.length === 0) return [];
    let o = {};
    for (let [r, i] of Object.entries(e))
      o[`NEX_${r.toUpperCase()}`] = String(i);
    let n = [];
    for (let r of s) {
      let i = hf(r, o);
      if ((n.push({ command: r, ...i }), !i.success && t.startsWith("pre-")))
        break;
    }
    return n;
  }
  function k0(t) {
    return ar(t).length > 0;
  }
  function v0() {
    let t = [];
    for (let e of fa) {
      let s = ar(e);
      s.length > 0 && t.push({ event: e, commands: s });
    }
    return t;
  }
  function S0() {
    let t = pf();
    return (Ls.existsSync(t) || Ls.mkdirSync(t, { recursive: !0 }), t);
  }
  gf.exports = {
    HOOK_EVENTS: fa,
    loadHookConfig: mf,
    getHooksForEvent: ar,
    executeHook: hf,
    runHooks: x0,
    hasHooks: k0,
    listHooks: v0,
    initHooksDir: S0,
  };
});
var js = K((sv, Tf) => {
  "use strict";
  var { callWithRetry: $f, runSubAgent: E0, clearAllLocks: T0 } = Ho(),
    {
      parseModelSpec: yf,
      getActiveProviderName: tv,
      getActiveModelId: nv,
    } = Ae(),
    { MultiProgress: R0, C: de } = Ce(),
    wf = 3,
    ma = 4,
    bf = "devstral-2:123b",
    _f = "kimi-k2.5",
    xf = `You are a task decomposition engine. Given a complex user request, split it into independent, atomic sub-tasks.

RULES:
- Output ONLY a JSON array, no markdown fences, no explanation.
- Each sub-task must be independently solvable by a coding agent.
- Maximum {maxSubTasks} sub-tasks. Merge closely related items.
- Each sub-task object must have these fields:
  { "id": "t1", "task": "description", "scope": ["file1.js", "dir/"], "estimatedCalls": 5, "priority": 1 }
- "scope" lists files/directories the agent should focus on.
- "estimatedCalls" is a rough count of tool invocations needed (max 15).
- "priority" is 1 (highest) to N (lowest) \u2014 controls execution order if sequential.
- No overlapping scopes: each file should appear in at most one sub-task.
- If the request is simple (single goal), return an array with exactly 1 item.

USER REQUEST:
{prompt}`,
    kf = `You are a result synthesis engine. Given the results of multiple sub-agents that worked on parts of a larger task, produce a unified summary.

RULES:
- Output ONLY a JSON object with these fields:
  { "summary": "what was done", "conflicts": ["file.js: agent 1 and 2 both modified line 42"], "commitMessage": "fix: ...", "filesChanged": ["file1.js", "file2.js"] }
- "conflicts" is an array of file conflicts where multiple agents modified the same file. Empty array if none.
- "commitMessage" follows conventional commits (fix:, feat:, refactor:, etc.).
- "filesChanged" is a deduplicated list of all files modified across all agents.
- "summary" is a concise paragraph describing the overall result.

ORIGINAL REQUEST:
{prompt}

SUB-AGENT RESULTS:
{results}`;
  function vf(t) {
    let e = 0,
      s = [];
    return function () {
      return new Promise((n) => {
        let r = () => {
          e < t
            ? (e++,
              n(() => {
                (e--, s.length > 0 && s.shift()());
              }))
            : s.push(r);
        };
        r();
      });
    };
  }
  function C0(t) {
    if (!t || typeof t != "string")
      return { isComplex: !1, estimatedGoals: 0, reason: "empty" };
    let e = 0,
      s = [],
      o = t.match(/(?:^|\n)\s*(?:\d+[.)]\s|[(]\d+[)]\s|[(][a-z][)]\s)/g);
    o &&
      o.length >= 2 &&
      ((e = Math.max(e, o.length)), s.push(`${o.length} numbered items`));
    let n = t.match(/(?:^|\n)\s*[-*]\s+\S/g);
    n &&
      n.length >= 3 &&
      ((e = Math.max(e, n.length)), s.push(`${n.length} bullet points`));
    let r = t.split(/;\s*/).filter((l) => l.trim().length > 10);
    r.length >= 3 &&
      ((e = Math.max(e, r.length)),
      s.push(`${r.length} semicolon-separated goals`));
    let i = t.match(
      /\b(also|additionally|and\s+(?:fix|add|update|create|implement|remove|refactor))\b/gi,
    );
    return (
      i &&
        i.length >= 2 &&
        ((e = Math.max(e, i.length + 1)),
        s.push(`${i.length} transition keywords`)),
      {
        isComplex: e >= 3,
        estimatedGoals: e,
        reason: s.length > 0 ? s.join(", ") : "single goal",
      }
    );
  }
  function ha(t) {
    if (!t || typeof t != "string")
      throw new Error("Empty response from orchestrator model");
    let e = t.trim();
    try {
      return JSON.parse(e);
    } catch {}
    let s = e.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (s)
      try {
        return JSON.parse(s[1].trim());
      } catch {}
    let o = e.search(/[[\{]/);
    if (o >= 0) {
      let n = e.slice(o);
      try {
        return JSON.parse(n);
      } catch {}
    }
    throw new Error(`Could not extract valid JSON from response:
${e.slice(0, 200)}`);
  }
  async function Sf(t, e, s = {}) {
    let o = s.maxSubTasks || ma,
      r = [
        {
          role: "system",
          content: xf
            .replace("{maxSubTasks}", String(o))
            .replace("{prompt}", t),
        },
        { role: "user", content: t },
      ],
      i = {};
    if (e) {
      let f = yf(e);
      (f.provider && (i.provider = f.provider), f.model && (i.model = f.model));
    }
    let l = (await $f(r, [], i)).content || "",
      u = ha(l);
    if (!Array.isArray(u))
      throw new Error(`Decompose returned non-array: ${typeof u}`);
    return u
      .slice(0, o)
      .map((f, m) => ({
        id: f.id || `t${m + 1}`,
        task: String(f.task || ""),
        scope: Array.isArray(f.scope) ? f.scope : [],
        estimatedCalls:
          typeof f.estimatedCalls == "number"
            ? Math.min(f.estimatedCalls, 15)
            : 10,
        priority: typeof f.priority == "number" ? f.priority : m + 1,
      }))
      .filter((f) => f.task.length > 0);
  }
  async function Ef(t, e, s) {
    if (!t || t.length === 0)
      return {
        summary: "No sub-tasks were executed.",
        conflicts: [],
        commitMessage: "",
        filesChanged: [],
      };
    let o = t.map((d, f) => {
        let m =
          d.status === "done"
            ? "SUCCESS"
            : d.status === "truncated"
              ? "PARTIAL"
              : "FAILED";
        return `--- Agent ${f + 1} [${m}] ---
Task: ${d.task}
Result: ${d.result}
Tools: ${(d.toolsUsed || []).join(", ") || "none"}`;
      }).join(`

`),
      r = [
        {
          role: "system",
          content: kf.replace("{prompt}", e).replace("{results}", o),
        },
        { role: "user", content: "Synthesize the sub-agent results above." },
      ],
      i = {};
    if (s) {
      let d = yf(s);
      (d.provider && (i.provider = d.provider), d.model && (i.model = d.model));
    }
    let l = (await $f(r, [], i)).content || "",
      u = ha(l);
    return {
      summary: String(u.summary || ""),
      conflicts: Array.isArray(u.conflicts) ? u.conflicts : [],
      commitMessage: String(u.commitMessage || ""),
      filesChanged: Array.isArray(u.filesChanged) ? u.filesChanged : [],
    };
  }
  async function A0(t, e = {}) {
    let s = e.orchestratorModel || process.env.NEX_ORCHESTRATOR_MODEL || _f,
      o = e.workerModel || bf,
      n = e.maxParallel || wf,
      r = e.maxSubTasks || ma,
      i = e.onProgress || (() => {}),
      c = { input: 0, output: 0 };
    (console.log(`
${de.bold}Orchestrator${de.reset}  ${de.dim}model: ${s} | workers: ${o} | max parallel: ${n}${de.reset}
`),
      i("decomposing"),
      console.log(
        `${de.dim}Phase 1: Decomposing prompt into sub-tasks...${de.reset}`,
      ));
    let l;
    try {
      l = await Sf(t, s, { maxSubTasks: r });
    } catch (g) {
      return (
        console.log(`${de.red}Decompose failed: ${g.message}${de.reset}`),
        {
          results: [],
          synthesis: {
            summary: `Decompose failed: ${g.message}`,
            conflicts: [],
            commitMessage: "",
            filesChanged: [],
          },
          totalTokens: c,
        }
      );
    }
    if (l.length === 0)
      return (
        console.log(
          `${de.yellow}No sub-tasks generated. Prompt may be too simple for orchestration.${de.reset}`,
        ),
        {
          results: [],
          synthesis: {
            summary: "No sub-tasks generated.",
            conflicts: [],
            commitMessage: "",
            filesChanged: [],
          },
          totalTokens: c,
        }
      );
    console.log(`${de.green}Decomposed into ${l.length} sub-tasks:${de.reset}`);
    for (let g of l)
      (console.log(`  ${de.dim}${g.id}:${de.reset} ${g.task}`),
        g.scope.length > 0 &&
          console.log(`     ${de.dim}scope: ${g.scope.join(", ")}${de.reset}`));
    (console.log(""),
      i("executing"),
      console.log(`${de.dim}Phase 2: Running ${l.length} sub-agents (max ${n} parallel)...${de.reset}
`));
    let u = vf(n),
      d = l.map(
        (g, $) =>
          `Agent ${$ + 1} [${o}]: ${g.task.substring(0, 40)}${g.task.length > 40 ? "..." : ""}`,
      ),
      f = new R0(d);
    f.start();
    let m = l.map(async (g, $) => {
        let w = await u();
        try {
          let _ = await E0(
            {
              task: g.task,
              context:
                g.scope.length > 0
                  ? `Focus on files: ${g.scope.join(", ")}`
                  : void 0,
              max_iterations: Math.min(g.estimatedCalls || 10, 15),
              model: o,
              _skipLog: !0,
            },
            { onUpdate: () => {} },
          );
          return (
            f.update($, _.status === "failed" ? "error" : "done"),
            (c.input += _.tokensUsed.input),
            (c.output += _.tokensUsed.output),
            _
          );
        } catch (_) {
          return (
            f.update($, "error"),
            {
              task: g.task,
              status: "failed",
              result: `Error: ${_.message}`,
              toolsUsed: [],
              tokensUsed: { input: 0, output: 0 },
            }
          );
        } finally {
          w();
        }
      }),
      h;
    try {
      h = await Promise.all(m);
    } finally {
      (f.stop(), T0());
    }
    console.log("");
    for (let g = 0; g < h.length; g++) {
      let $ = h[g],
        w =
          $.status === "done"
            ? `${de.green}\u2713${de.reset}`
            : $.status === "truncated"
              ? `${de.yellow}\u26A0${de.reset}`
              : `${de.red}\u2717${de.reset}`;
      console.log(`${w} Agent ${g + 1}: ${$.task.substring(0, 60)}`);
    }
    (console.log(""),
      i("synthesizing"),
      console.log(`${de.dim}Phase 3: Synthesizing results...${de.reset}`));
    let p;
    try {
      p = await Ef(h, t, s);
    } catch (g) {
      (console.log(
        `${de.yellow}Synthesize failed: ${g.message} \u2014 using raw results.${de.reset}`,
      ),
        (p = {
          summary: h.map(($) => $.result).join(`
`),
          conflicts: [],
          commitMessage: "",
          filesChanged: [],
        }));
    }
    if (
      (console.log(`
${de.bold}Summary:${de.reset} ${p.summary}`),
      p.conflicts.length > 0)
    ) {
      console.log(`${de.yellow}Conflicts:${de.reset}`);
      for (let g of p.conflicts) console.log(`  - ${g}`);
    }
    return (
      p.commitMessage &&
        console.log(`${de.dim}Suggested commit: ${p.commitMessage}${de.reset}`),
      console.log(`${de.dim}Tokens: ${c.input} input + ${c.output} output${de.reset}
`),
      { results: h, synthesis: p, totalTokens: c }
    );
  }
  Tf.exports = {
    runOrchestrated: A0,
    decompose: Sf,
    synthesize: Ef,
    detectComplexPrompt: C0,
    extractJSON: ha,
    createSemaphore: vf,
    DECOMPOSE_PROMPT: xf,
    SYNTHESIZE_PROMPT: kf,
    DEFAULT_ORCHESTRATOR_MODEL: _f,
    DEFAULT_WORKER_MODEL: bf,
    DEFAULT_MAX_PARALLEL: wf,
    DEFAULT_MAX_SUBTASKS: ma,
  };
});
var ve = K((cv, Gf) => {
  var {
      C: y,
      Spinner: Jn,
      TaskProgress: O0,
      formatToolCall: N0,
      formatToolSummary: If,
      formatSectionHeader: ga,
      formatMilestone: M0,
      setActiveTaskProgress: ov,
    } = Ce(),
    { MilestoneTracker: P0 } = El(),
    { callStream: I0 } = Ae(),
    { parseToolArgs: L0 } = Dn(),
    { executeTool: j0 } = St(),
    { gatherProjectContext: D0 } = Zo(),
    {
      fitToContext: q0,
      forceCompress: It,
      getUsage: Ct,
      estimateTokens: F0,
    } = Je(),
    { autoSave: U0, flushAutoSave: W0 } = Rt(),
    { scoreMessages: B0, formatScore: H0, appendScoreHistory: G0 } = tr();
  function qe(t) {
    (U0(t), W0());
  }
  function Rf(t) {
    try {
      if (
        !t.some((o) =>
          o.role !== "assistant"
            ? !1
            : !!(
                (Array.isArray(o.content) &&
                  o.content.some((n) => n && n.type === "tool_use")) ||
                (Array.isArray(o.tool_calls) && o.tool_calls.length > 0)
              ),
        )
      )
        return;
      let s = B0(t);
      if (!s) return;
      console.log(H0(s, y));
      try {
        let { _getSessionsDir: o } = Rt(),
          n = require("fs"),
          r = require("path").join(o(), "_autosave.json");
        if (n.existsSync(r)) {
          let i = JSON.parse(n.readFileSync(r, "utf-8"));
          ((i.score = s.score),
            (i.scoreGrade = s.grade),
            (i.scoreIssues = s.issues),
            n.writeFileSync(r, JSON.stringify(i, null, 2)));
        }
      } catch {}
      try {
        let { getActiveModel: o } = Dn(),
          n = Cn();
        G0(s.score, {
          version: n.version,
          model: o ? o() : null,
          sessionName: "_autosave",
          issues: s.issues,
        });
      } catch {}
    } catch {}
  }
  var { getMemoryContext: K0 } = rn(),
    { getDeploymentContextBlock: Y0 } = Zi(),
    { checkPermission: z0, setPermission: X0, savePermissions: J0 } = Is(),
    { confirm: Lf, setAllowAlwaysHandler: V0, getAutoConfirm: Q0 } = Ye(),
    {
      isPlanMode: Ws,
      getPlanModePrompt: Z0,
      PLAN_MODE_ALLOWED_TOOLS: jf,
      setPlanContent: eb,
      extractStepsFromText: tb,
      createPlan: nb,
      getActivePlan: rv,
      startExecution: iv,
      advancePlanStep: sb,
      getPlanStepInfo: ob,
    } = Pt(),
    { StreamRenderer: rb } = ff(),
    { runHooks: Cf } = pa(),
    { routeMCPCall: ib, getMCPToolDefinitions: ab } = Eo(),
    {
      getSkillInstructions: cb,
      getSkillToolDefinitions: lb,
      routeSkillCall: ub,
    } = tn(),
    { trackUsage: db } = jn(),
    { validateToolArgs: fb } = xi(),
    {
      filterToolsForModel: Af,
      getModelTier: pb,
      PROVIDER_DEFAULT_TIER: av,
    } = Do(),
    {
      getConfiguredProviders: mb,
      getActiveProviderName: Ds,
      getActiveModelId: Vn,
      setActiveModel: Of,
      MODEL_EQUIVALENTS: hr,
    } = Ae(),
    Aa = require("fs"),
    Oa = require("path"),
    hb = (() => {
      let t = parseInt(process.env.NEX_MILESTONE_STEPS ?? "5", 10);
      return Number.isFinite(t) && t >= 0 ? t : 5;
    })();
  function gb(t) {
    let e = M0(
      t.phaseName,
      t.stepCount,
      t.toolCounts,
      t.elapsed,
      t.filesRead,
      t.filesModified,
    );
    process.stdout.write(`${e}
`);
  }
  var Nf =
    /(?:^|\s)((?:~|\.{1,2})?(?:\/[\w.\-@() ]+)+\.(?:png|jpe?g|gif|webp|bmp|tiff?))(?:\s|$)/gi;
  function $b(t) {
    let e = [],
      s;
    for (Nf.lastIndex = 0; (s = Nf.exec(t)) !== null; ) {
      let o = s[1].trim(),
        n = o.startsWith("~")
          ? o.replace("~", process.env.HOME || "")
          : Oa.resolve(o);
      Aa.existsSync(n) && e.push({ raw: o, abs: n });
    }
    return e;
  }
  function yb(t) {
    let e = Aa.readFileSync(t),
      s = Oa.extname(t).toLowerCase().replace(".", ""),
      o =
        s === "jpg" || s === "jpeg"
          ? "image/jpeg"
          : s === "png"
            ? "image/png"
            : s === "gif"
              ? "image/gif"
              : s === "webp"
                ? "image/webp"
                : "image/png";
    return { data: e.toString("base64"), media_type: o };
  }
  function Df(t) {
    let e = $b(t);
    if (e.length === 0) return t;
    let s = [{ type: "text", text: t }];
    for (let o of e)
      try {
        let { data: n, media_type: r } = yb(o.abs);
        s.push({ type: "image", media_type: r, data: n });
      } catch {}
    return s.length > 1 ? s : t;
  }
  function wb(t) {
    if (!t || t.length < 200) return { text: t, truncated: !1, repeatCount: 0 };
    let s = t.split(/(?<=\. )/).filter((l) => l.trim().length > 0);
    if (s.length < 6) return { text: t, truncated: !1, repeatCount: 0 };
    let o = new Map();
    for (let l = 0; l <= s.length - 3; l++) {
      let u = s
        .slice(l, l + 3)
        .join("")
        .trim();
      u.length > 30 && o.set(u, (o.get(u) || 0) + 1);
    }
    let n = 0,
      r = "";
    for (let [l, u] of o) u > n && ((n = u), (r = l));
    if (n < 3) return { text: t, truncated: !1, repeatCount: n };
    let i = `

[SYSTEM: Output repetition detected \u2014 response truncated (${n}\xD7 repeated paragraph)]`,
      c;
    if (t.length > 8e3) c = t.slice(0, 3e3) + i;
    else {
      let l = 0,
        u = -1,
        d = 0;
      for (; l < 2; ) {
        let f = t.indexOf(r, d);
        if (f === -1) break;
        (l++, (u = f + r.length), (d = f + 1));
      }
      c = u > 0 ? t.slice(0, u) + i : t.slice(0, 3e3) + i;
    }
    return { text: c, truncated: !0, repeatCount: n };
  }
  function ka(t, e = 5) {
    if (!t || t.length < 40) return { text: t, truncated: !1, repeatCount: 0 };
    let s = t.split(`
`),
      o = new Map();
    for (let f of s) {
      let m = f.trim();
      m.length >= 20 && o.set(m, (o.get(m) || 0) + 1);
    }
    let n = 0,
      r = "";
    for (let [f, m] of o) m > n && ((n = m), (r = f));
    if (n <= e) return { text: t, truncated: !1, repeatCount: n };
    let i = `

\u26A0 [Response truncated: repeated paragraph detected (${n}\xD7)]`,
      c = 0,
      l = -1,
      u = 0;
    for (; c < e; ) {
      let f = t.indexOf(r, u);
      if (f === -1) break;
      (c++, (l = f + r.length), (u = f + 1));
    }
    return {
      text: l > 0 ? t.slice(0, l) + i : t.slice(0, 2e3) + i,
      truncated: !0,
      repeatCount: n,
    };
  }
  var $a = null,
    ya = null,
    wa = null;
  function ze() {
    if ($a === null) {
      let { TOOL_DEFINITIONS: t } = St();
      $a = t;
    }
    return (
      ya === null && (ya = lb()),
      wa === null && (wa = ab()),
      [...$a, ...ya, ...wa]
    );
  }
  var va = 50;
  function bb(t) {
    Number.isFinite(t) && t > 0 && (va = t);
  }
  var lr = () => null;
  function _b(t) {
    lr = t;
  }
  var qs = null,
    Sa = null,
    Qn = null,
    ur = new Map(),
    xb = 1e4,
    kb = 6e3,
    vb =
      /\b((?:API|ACCESS|AUTH|BEARER|CLIENT|GITHUB|GITLAB|SLACK|STRIPE|TWILIO|SENDGRID|AWS|GCP|AZURE|OPENAI|ANTHROPIC|GEMINI|OLLAMA)[_A-Z0-9]*(?:KEY|TOKEN|SECRET|PASS(?:WORD)?|CREDENTIAL)[_A-Z0-9]*)\s*=\s*["']?([A-Za-z0-9\-_.+/=]{10,})["']?/g;
  function Sb(t) {
    return !t || typeof t != "string"
      ? t
      : t.replace(vb, (e, s) => `${s}=***REDACTED***`);
  }
  var Eb = 7e3,
    Tb = 4e3;
  function Rb(t, e = null) {
    let s = Sb(t),
      o = F0(s),
      n = e === "read_file" ? Eb : xb,
      r = e === "read_file" ? Tb : kb;
    if (o > n)
      try {
        let { compressToolResult: i } = Je();
        return i(s, r);
      } catch {
        return s;
      }
    return s;
  }
  function qf(t) {
    try {
      let { getActiveModel: e } = Ae(),
        s = e(),
        o = s ? `${s.provider}:${s.id}` : "default";
      if (ur.has(o)) return ur.get(o);
      let n = Af(t);
      return (ur.set(o, n), n);
    } catch {
      return Af(t);
    }
  }
  function Cb() {
    ur.clear();
  }
  async function Ff() {
    try {
      let t = require("fs").promises,
        e = require("path"),
        s = [
          e.join(process.cwd(), "package.json"),
          e.join(process.cwd(), ".git", "HEAD"),
          e.join(process.cwd(), "README.md"),
          e.join(process.cwd(), "NEX.md"),
        ],
        n = (
          await Promise.allSettled(
            s.map((r) => t.stat(r).then((i) => `${r}:${i.mtimeMs}`)),
          )
        )
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value);
      try {
        let { getMemoryContextHash: r } = rn(),
          i = r();
        i && n.push(`memory:${i}`);
      } catch {}
      try {
        let r = e.join(process.cwd(), ".nex", "brain");
        if (Aa.existsSync(r)) {
          let i = await t.stat(r);
          n.push(`brain:${i.mtimeMs}`);
        }
      } catch {}
      return n.join("|");
    } catch {
      return `fallback:${Date.now()}`;
    }
  }
  function Ea() {
    ((qs = null), (Sa = null), (Qn = null));
  }
  var Ab = new Set(["spawn_agents"]),
    ba = 5,
    _a = 3,
    cr = 2,
    Ob = parseInt(process.env.NEX_STALE_WARN_MS || "60000", 10),
    Mf = parseInt(process.env.NEX_STALE_ABORT_MS || "120000", 10),
    Nb = process.env.NEX_STALE_AUTO_SWITCH !== "0";
  function Mb(t) {
    try {
      let e = require("fs"),
        s = require("path"),
        o = s.join(process.cwd(), ".nex", "plans");
      e.existsSync(o) || e.mkdirSync(o, { recursive: !0 });
      let n = s.join(o, "current-plan.md");
      e.writeFileSync(n, t, "utf-8");
    } catch {}
  }
  V0((t) => {
    (X0(t, "allow"),
      J0(),
      console.log(`${y.green}  \u2713 ${t}: always allow${y.reset}`));
  });
  async function Pb(t) {
    let e = t.function.name,
      s = L0(t.function.arguments),
      o = t.id || `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (!s) {
      let l = ze().find((d) => d.function.name === e),
        u = l ? JSON.stringify(l.function.parameters, null, 2) : "unknown";
      return (
        console.log(
          `${y.yellow}  \u26A0 ${e}: malformed arguments, sending schema hint${y.reset}`,
        ),
        {
          callId: o,
          fnName: e,
          args: null,
          canExecute: !1,
          errorResult: {
            role: "tool",
            content: `ERROR: Malformed tool arguments. Could not parse your arguments as JSON.
Raw input: ${typeof t.function.arguments == "string" ? t.function.arguments.substring(0, 200) : "N/A"}

Expected JSON schema for "${e}":
${u}

Please retry the tool call with valid JSON arguments matching this schema.`,
            tool_call_id: o,
          },
        }
      );
    }
    let n = fb(e, s);
    if (!n.valid)
      return (
        console.log(
          `${y.yellow}  \u26A0 ${e}: ${
            n.error.split(`
`)[0]
          }${y.reset}`,
        ),
        {
          callId: o,
          fnName: e,
          args: s,
          canExecute: !1,
          errorResult: { role: "tool", content: n.error, tool_call_id: o },
        }
      );
    let r = n.corrected || s;
    if (n.corrected) {
      let c = Object.keys(s),
        l = Object.keys(n.corrected),
        u = c.filter((d) => !l.includes(d));
      u.length &&
        console.log(
          `${y.dim}  \u2713 ${e}: corrected args (${u.join(", ")})${y.reset}`,
        );
    }
    if (Ws() && !jf.has(e))
      return (
        console.log(`${y.yellow}  \u2717 ${e}: blocked in plan mode${y.reset}`),
        {
          callId: o,
          fnName: e,
          args: r,
          canExecute: !1,
          errorResult: {
            role: "tool",
            content: `PLAN MODE: '${e}' is blocked. Only read-only tools are allowed. Present your plan as text output instead of making changes.`,
            tool_call_id: o,
          },
        }
      );
    let i = z0(e);
    if (i === "deny")
      return (
        console.log(`${y.red}  \u2717 ${e}: denied by permissions${y.reset}`),
        {
          callId: o,
          fnName: e,
          args: r,
          canExecute: !1,
          errorResult: {
            role: "tool",
            content: `DENIED: Tool '${e}' is blocked by permissions`,
            tool_call_id: o,
          },
        }
      );
    if (i === "ask") {
      let c = `  Allow ${e}?`;
      return (
        e === "bash" &&
          r.command &&
          (c = `  bash: \`${r.command.substring(0, 80)}${r.command.length > 80 ? "\u2026" : ""}\`?`),
        (await Lf(c, { toolName: e }))
          ? {
              callId: o,
              fnName: e,
              args: r,
              canExecute: !0,
              confirmedByUser: !0,
              errorResult: null,
            }
          : {
              callId: o,
              fnName: e,
              args: r,
              canExecute: !1,
              confirmedByUser: !1,
              errorResult: {
                role: "tool",
                content: `CANCELLED: User declined ${e}`,
                tool_call_id: o,
              },
            }
      );
    }
    return {
      callId: o,
      fnName: e,
      args: r,
      canExecute: !0,
      confirmedByUser: !0,
      errorResult: null,
    };
  }
  async function Ib(t, e, s = {}) {
    let o = await ub(t, e);
    if (o !== null) return o;
    let n = await ib(t, e);
    return n !== null ? n : j0(t, e, s);
  }
  function Lb(t, e) {
    switch (t) {
      case "read_file":
      case "write_file":
      case "edit_file":
      case "patch_file":
      case "list_directory":
        return e.path || "";
      case "bash":
        return (e.command || "").substring(0, 60);
      case "grep":
      case "search_files":
      case "glob":
        return e.pattern || "";
      case "web_fetch":
        return (e.url || "").substring(0, 50);
      case "web_search":
        return (e.query || "").substring(0, 40);
      default:
        return "";
    }
  }
  async function xa(t, e = !1) {
    e || console.log(N0(t.fnName, t.args));
    let s = Cf("pre-tool", { tool_name: t.fnName });
    if (!e && s.length > 0)
      for (let h of s)
        h.success
          ? console.log(
              `${y.dim}  [hook pre-tool] ${h.command} \u2192 ${h.output || "ok"}${y.reset}`,
            )
          : console.log(
              `${y.yellow}  [hook pre-tool] ${h.command} \u2192 ERROR: ${h.error}${y.reset}`,
            );
    Lt?.onToolStart && Lt.onToolStart(t.fnName, t.args);
    let o = await Ib(t.fnName, t.args, {
        silent: !0,
        autoConfirm: t.confirmedByUser === !0,
      }),
      n = String(o ?? ""),
      r =
        n.length > 5e4
          ? n.substring(0, 5e4) +
            `
...(truncated ${n.length - 5e4} chars)`
          : n,
      i = r.split(`
`)[0],
      c =
        i.startsWith("ERROR") ||
        i.includes("CANCELLED") ||
        i.includes("BLOCKED") ||
        (t.fnName === "spawn_agents" &&
          !/✓ Agent/.test(r) &&
          /✗ Agent/.test(r)),
      l = If(t.fnName, t.args, r, c);
    (e || console.log(l), Lt?.onToolEnd && Lt.onToolEnd(t.fnName, l, !c));
    let u = Cf("post-tool", { tool_name: t.fnName });
    if (!e && u.length > 0)
      for (let h of u)
        h.success
          ? console.log(
              `${y.dim}  [hook post-tool] ${h.command} \u2192 ${h.output || "ok"}${y.reset}`,
            )
          : console.log(
              `${y.yellow}  [hook post-tool] ${h.command} \u2192 ERROR: ${h.error}${y.reset}`,
            );
    let f = Rb(r, t.fnName);
    if (t.fnName === "bash" && t.args?.command) {
      let h = t.args.command.trim();
      !/cat\s*>|<</.test(h) && /\bcat\s+\S/.test(h)
        ? (f += `
HINT: use read_file instead of bash cat \u2014 it is faster, context-efficient, and the preferred tool for reading files.`)
        : /^\s*ls(\s|$)/.test(h) &&
          !/npm|yarn|pnpm|make|git\b/.test(h) &&
          (f += `
HINT: use list_directory instead of bash ls \u2014 it is the preferred tool for listing directory contents.`);
    }
    return {
      msg: { role: "tool", content: f, tool_call_id: t.callId },
      summary: l,
    };
  }
  async function jb(t, e = !1, s = {}) {
    let o = new Array(t.length),
      n = [],
      r = [],
      i = null;
    if (e && !s.skipSpinner) {
      let l = t.filter((u) => u.canExecute);
      if (l.length > 0) {
        let u;
        if (l.length === 1) {
          let d = l[0],
            f = Lb(d.fnName, d.args);
          u = `\u25CF ${d.fnName}${f ? `(${f})` : ""}`;
        } else {
          let d = l.map((f) => f.fnName).join(", ");
          u = `\u25CF ${l.length} tools: ${d.length > 60 ? d.substring(0, 57) + "\u2026" : d}`;
        }
        ((i = new Jn(u)), i.start());
      }
    }
    async function c() {
      if (r.length !== 0) {
        if (r.length === 1) {
          let l = r[0],
            { msg: u, summary: d } = await xa(t[l], e);
          ((o[l] = u), n.push(d));
        } else {
          let l = r.map((d) => xa(t[d], e)),
            u = await Promise.all(l);
          for (let d = 0; d < r.length; d++)
            ((o[r[d]] = u[d].msg), n.push(u[d].summary));
        }
        r = [];
      }
    }
    for (let l = 0; l < t.length; l++) {
      let u = t[l];
      if (!u.canExecute) {
        (await c(),
          (o[l] = u.errorResult),
          n.push(If(u.fnName, u.args || {}, u.errorResult.content, !0)));
        continue;
      }
      if (Ab.has(u.fnName)) {
        (await c(), u.fnName === "spawn_agents" && i && (i.stop(), (i = null)));
        let { msg: d, summary: f } = await xa(u, e);
        ((o[l] = d), n.push(f));
      } else r.push(l);
    }
    if ((await c(), i && i.stop(), e && n.length > 0 && !s.skipSummaries))
      for (let l of n) console.log(l);
    return { results: o, summaries: n };
  }
  var X = [],
    Pf = 300,
    Uf = new Map(),
    Wf = new Map(),
    Ta = new Map(),
    Ra = new Map(),
    Fs = new Map(),
    Bf = new Map(),
    Zn = new Map(),
    es = new Map(),
    At = 0,
    Us = 0,
    dr = 0,
    Ca = "",
    fr = 0,
    ts = !1,
    pr = 0;
  function Xn(t, e) {
    t === Ca
      ? (fr++,
        process.stdout
          .write(`\x1B[1A\x1B[2K${e}  \u26A0 ${t} (\xD7${fr})${y.reset}
`))
      : ((Ca = t), (fr = 1), console.log(`${e}  \u26A0 ${t}${y.reset}`));
  }
  var mr = [];
  function Db(t) {
    mr.push(t.trim());
  }
  function qb() {
    return mr.length === 0
      ? null
      : mr.splice(0, mr.length).join(`
`);
  }
  function Fb() {
    let t = process.env.NEX_LANGUAGE,
      e = process.env.NEX_CODE_LANGUAGE,
      s = process.env.NEX_COMMIT_LANGUAGE,
      o = !t || t === "auto" ? null : t,
      n = [
        `# Language Rules (CRITICAL \u2014 enforce strictly)
`,
      ];
    (o
      ? n.push(
          `RESPONSE LANGUAGE: You MUST always respond in ${o}. This overrides any language defaults from your training. Never output Chinese, Japanese, or any other language in your responses \u2014 even when summarizing or thinking. ${o} only.`,
        )
      : n.push(
          "RESPONSE LANGUAGE: Always respond in the same language as the user's message. If the user writes in German, respond in German; if in English, respond in English; etc.",
        ),
      n.push(
        "CODE EXAMPLES: Always show actual, working code examples \u2014 never pseudocode or placeholder snippets.",
      ),
      n.push("COMPLETENESS RULES:"),
      n.push(
        "  \u2022 ALWAYS show actual code when explaining implementations \u2014 never describe without showing",
      ),
      n.push(
        "  \u2022 FILE CREATION TASKS (Makefile, Dockerfile, config files): paste the COMPLETE file content in a fenced code block in your TEXT RESPONSE \u2014 writing a file with a tool does NOT make it visible. The fenced code block MUST appear in your response, not just via write_file.",
      ),
      n.push(
        "  \u2022 Include complete examples with full context (imports, function signatures, error handling)",
      ),
      n.push(
        '  \u2022 Show alternative approaches when relevant (e.g., "Alternative: use util.promisify instead")',
      ),
      n.push(
        "  \u2022 Include edge cases in explanations (empty input, null values, boundary conditions)",
      ),
      n.push(
        "  \u2022 Provide platform-specific guidance when commands differ by OS (Linux/macOS/Windows)",
      ),
      n.push(
        '  \u2022 For Makefiles, paste the COMPLETE Makefile code DIRECTLY in your text response \u2014 every target, recipe, dependency, and .PHONY line. Writing the Makefile with a tool does NOT count as showing it. The Makefile MUST appear verbatim in your chat text as a code block, even if you also wrote it to a file. Never describe structure without showing the actual code. CRITICAL: use EXACTLY the command specified \u2014 if the task says "runs jest", write "jest" in the recipe, NEVER "npm test". npm test is NOT jest. Recipes need real TAB indentation. ONE .PHONY line listing ALL phony targets.',
      ),
      n.push(
        "  \u2022 For dataclasses, paste the COMPLETE dataclass code DIRECTLY in your text response \u2014 @dataclass decorator, all fields with types and defaults, full __post_init__ validation. Writing the file with a tool does NOT count as showing the code. The code MUST appear verbatim in your chat text, even if you also wrote it to a file.",
      ),
      n.push(
        "  \u2022 For cron expressions, re-read the exact time boundaries in the task before writing. If asked for 8-18h, the range is 8,9,...,18 \u2014 write exactly what was asked, not an approximation.",
      ),
      n.push(
        '  \u2022 When a task explicitly specifies a tool (e.g., "use tsc"), NEVER mention alternatives (e.g., "swc build") \u2014 use exactly what was requested.',
      ),
      n.push(
        '  \u2022 In Makefile prerequisites, NEVER use shell glob patterns like src/**/*.ts \u2014 make does not expand these natively. Keep prerequisite lists explicit or omit them. When a Makefile target says "runs jest", call jest directly in the recipe (not npm test).',
      ),
      n.push(
        "  \u2022 For bash in-place text replacements with backups: use ONLY ONE backup method \u2014 either sed -i.bak (let sed create the backup) OR cp file file.bak followed by sed -i (no extension). Never use both cp and sed -i.bak together \u2014 that produces redundant double backups (file.bak and file.bak.bak).",
      ),
      n.push(
        "  \u2022 For iterative array-flattening (flattenDeep): use push() and reverse() at the end \u2014 NEVER unshift(). unshift is O(n) per call making the whole function O(n^2). The iterative version MUST use a loop (while/for) and an explicit stack array \u2014 zero recursive calls. If a function calls itself, it is recursive regardless of its name. Never label a recursive function as iterative.",
      ),
      n.push(
        "  \u2022 FORBIDDEN: when refactoring callbacks to async/await, NEVER write try { ... } catch(e) { throw e } \u2014 this is an explicit anti-pattern. WRONG: async function f() { try { const d = await readFile(..); await writeFile(.., d); } catch(e) { throw e; } } \u2014 RIGHT: async function f() { const d = await readFile(..); await writeFile(.., d); } \u2014 omit the try-catch entirely, let rejections propagate.",
      ),
      n.push(
        '  \u2022 Docker HEALTHCHECK: always include --start-period=30s (or appropriate startup time) so the container has time to initialise before failures are counted. Also note that curl may not be available in minimal Node.js images \u2014 offer wget or "node -e" as alternatives.',
      ),
      n.push(
        '  \u2022 When fixing a bash word-splitting bug like "for f in $(ls *.txt)": replace the entire $(ls *.txt) with a bare glob directly \u2014 "for f in *.txt". The fix is eliminating the ls command and $() subshell entirely. Emphasise this in the explanation: the glob in the for loop prevents word splitting because the shell expands the glob into separate words before the loop \u2014 there is no subshell output to split. CRITICAL: NEVER suggest "ls -N" or any ls variant as a fix \u2014 ls -N outputs filenames one per line, but word splitting still occurs on each line when used in a subshell expansion. The only correct fix is the bare glob pattern.',
      ));
    let r = e || "English";
    n.push(
      `CODE LANGUAGE: Write all code comments, docstrings, variable descriptions, and inline documentation in ${r}.`,
    );
    let i = s || "English";
    return (
      n.push(`COMMIT MESSAGES: Write all git commit messages in ${i}.`),
      o &&
        n.push(`
This is a hard requirement. Always respond in ${o}. Do NOT switch to any other language \u2014 even if the user writes to you in German, French, or any other language, your reply MUST be in ${o}.`),
      n.join(`
`) +
        `

`
    );
  }
  function Ub() {
    if (Qn !== null) return Qn;
    try {
      let e = mb().flatMap((n) =>
        n.models.map((r) => ({
          spec: `${n.name}:${r.id}`,
          tier: pb(r.id, n.name),
          name: r.name,
        })),
      );
      if (e.length < 2) return ((Qn = ""), "");
      let s = {
          full: "complex tasks (refactor, implement, generate)",
          standard: "regular tasks (edit, fix, analyze)",
          essential: "simple tasks (read, search, list)",
        },
        o = `
# Sub-Agent Model Routing

`;
      ((o +=
        'Sub-agents auto-select models by task complexity. Override with `model: "provider:model"` in agent definition.\n\n'),
        (o += `| Model | Tier | Auto-assigned for |
|---|---|---|
`));
      for (let n of e)
        o += `| ${n.spec} | ${n.tier} | ${s[n.tier] || n.tier} |
`;
      return ((Qn = o), o);
    } catch (t) {
      return (
        process.env.NEX_DEBUG &&
          console.error("[agent] model routing guide failed:", t.message),
        (Qn = ""),
        ""
      );
    }
  }
  async function Hf() {
    let t = await Ff();
    if (qs !== null && t === Sa) return qs;
    let e = await D0(process.cwd()),
      s = K0(),
      o = cb(),
      n = Ws() ? Z0() : "",
      r = Fb(),
      i = Y0();
    return (
      (qs = `You are Nex Code, an expert coding assistant. You help with programming tasks by reading, writing, and editing files, running commands, and answering questions.

WORKING DIRECTORY: ${process.cwd()}
All relative paths resolve from this directory.
PROJECT CONTEXT:
${e}
${
  s
    ? `
${s}
`
    : ""
}${
        o
          ? `
${o}
`
          : ""
      }${
        n
          ? `
${n}
`
          : ""
      }
${
  r
    ? `${r}
`
    : ""
}${
        i
          ? `${i}

`
          : ""
      }${
        Q0()
          ? `# YOLO Mode \u2014 Auto-Execute

You are in YOLO mode (autoConfirm=true). All tool calls are pre-approved.
- NEVER ask for confirmation \u2014 just execute tasks directly
- NEVER end responses with questions like "Soll ich...?", "M\xF6chtest du...?", "Shall I...?"
- When you have enough information, implement the fix immediately \u2014 do not propose or ask
- If something is ambiguous, make a reasonable assumption and state it, then proceed
- OVERRIDE "simple questions": If the user pastes any server error or Jarvis message, SSH investigate FIRST \u2014 NEVER answer from training knowledge alone
- After identifying root cause via SSH: IMMEDIATELY fix it (edit file + restart service). Do NOT write "Empfohlene L\xF6sungen" or ask "M\xF6chten Sie...?" \u2014 just execute the fix now.

`
          : ""
      }# Jarvis Debugging Rules

- Jarvis errors (set_reminder, cron, Google Auth, SmartThings) come from the DEPLOYED server at 94.130.37.43
- ALWAYS use ssh_exec to investigate: ssh_exec on 94.130.37.43, check /home/jarvis/jarvis-agent/logs/
- NEVER run local bash/find/sqlite3 commands when debugging Jarvis issues
- Local jarvis-agent/ is just source code \u2014 the running system is on the server
- CRITICAL: When the user pastes a Jarvis error message ("jarvisFehler:", "jarvisEinige Fehler", error logs), this is NEVER a "simple question" to answer from training knowledge. You MUST ssh_exec to verify if the error is still occurring BEFORE writing any explanation. Do NOT explain from memory \u2014 investigate first, always.
- LOG FILES: Always check the CURRENT log first: /home/jarvis/jarvis-agent/logs/api-error.log (no date suffix). Log files WITH a date suffix (e.g. api-error.log-20260322) are ROTATED/OLD \u2014 errors there may already be fixed. Only look at dated logs if the current log is empty or the error is absent from the current log.
- FIX WORKFLOW (YOLO): Once you identify a fixable bug via SSH investigation: (1) edit the file on server using ssh_exec with tee or sed -i (NOT sed -n), (2) restart the affected service with systemctl restart, (3) verify with tail logs. Do NOT produce a report \u2014 execute the fix.
- READING REMOTE FILES: NEVER use sed -n (always blocked). To read a specific function in a remote file: ssh_exec 'grep -n "functionName" /path/file -A 50'. To read the whole file: ssh_exec 'cat /path/file'. These are the only two options.

# Plan Mode

Plan mode is ONLY active when explicitly activated via the /plan command or shown in your system prompt as "PLAN MODE ACTIVE". If you do NOT see "PLAN MODE ACTIVE" in your instructions, you are NOT in plan mode \u2014 you have full tool access and MUST execute tasks directly. Never claim to be in plan mode unless you see that explicit marker.

# Core Behavior

- You can use tools OR respond with text. For simple questions, answer directly.
- For coding tasks, use tools to read files, make changes, run tests, etc.
- Be concise but complete. Keep responses focused while ensuring the user gets the information they asked for.
- When referencing code, include file:line (e.g. src/app.js:42) so the user can navigate.
- Do not make up file paths or URLs. Use tools to discover them.

# Response Quality (Critical)

\u26A0 CRITICAL: The user CANNOT see tool output. They only see your text + 1-line summaries like "\u2713 bash ssh ... \u2192 ok".
If you run tools but write NO text \u2192 the user sees NOTHING useful. This is the #1 quality failure.

MANDATORY RULE: After ANY tool call that gathers information (bash, read_file, grep, ssh commands, etc.), you MUST write a text response summarizing the findings. NEVER end your response with only tool calls and no text.

CODE DISPLAY RULE: Always show actual code examples, not just descriptions. When explaining code:
  \u2022 Show the complete code snippet, not just describe it
  \u2022 Include file paths and line numbers (e.g., "src/app.js:42")
  \u2022 For regex patterns, show both the pattern and example matches. Be precise \u2014 test the pattern mentally. When rewriting for readability, use named constants or a commented breakdown (e.g. const OCTET = ...), NOT named capture groups \u2014 named group syntax varies by engine and is a frequent source of errors. NEVER claim functional equivalence without verifying edge cases (e.g. leading zeros, boundary values).
  \u2022 For Makefiles: (1) Output the COMPLETE Makefile in a fenced \`\`\`makefile code block IN YOUR TEXT first \u2014 before any tool calls. (2) Then optionally write it to disk. FORBIDDEN: using write_file for a Makefile and then only describing it in text \u2014 the code block in text is mandatory. The user CANNOT see write_file output. (3) Use EXACTLY the command from the description: "runs jest" \u2192 recipe is "jest" (NOT "npm test", NOT "npx jest"); "runs tsc" \u2192 recipe is "tsc". (4) Never suggest alternatives to the specified tool \u2014 if the task says tsc, only tsc appears in the Makefile.
  \u2022 For dataclasses, show the COMPLETE implementation \u2014 all fields with types, __post_init__ validation, and any defaults. Never describe without showing the code.
  \u2022 For cron expressions, quote the exact time constraint from the task verbatim, then write the expression. Verify boundary values (e.g., "8-18h" \u2192 hours 8 through 18 inclusive).

- Use markdown formatting: **bold** for key points, headers for sections, bullet lists for multiple items, \`code\` for identifiers. The terminal renders markdown with syntax highlighting.
- Structure longer responses with headers (## Section) so the user can scan quickly.

Response patterns by request type:
- **Questions / analysis / "status" / "explain" / "what is"**: Gather data with tools, then respond with a clear, structured summary. NEVER just run tools and stop.
- **Coding tasks (implement, fix, refactor)**: Brief confirmation of what you'll do, then use tools. After changes, summarize what you did and any important details.
- **Simple questions ("what does X do?")**: Answer directly without tools when you have enough context.
- **Ambiguous requests**: When a request is vague AND lacks sufficient detail to act (e.g. just "optimize this" or "improve performance" with no further context), ask clarifying questions using ask_user. However, if the user's message already contains specific details \u2014 file names, concrete steps, exercises, numbers, examples \u2014 proceed directly without asking. Only block when you genuinely cannot determine what to do without more information. When the user's request is ambiguous or could be interpreted in multiple ways, call the ask_user tool BEFORE starting work. Provide 2-3 specific, actionable options that cover the most likely intents. Do NOT ask open-ended questions in chat \u2014 always use ask_user with concrete options.
- **Server/SSH commands**: After running remote commands, ALWAYS present the results: service status, log errors, findings.
- **Server investigation rule**: When investigating errors via SSH, the moment you see a clear root cause, STOP reading more logs immediately. State the finding, then execute the fix. Never expand log line ranges after identifying the error \u2014 reading more of the same log is not progress, it is an investigation loop.

  **Immediate stop triggers** \u2014 seeing ANY of these in tool output means root cause found, act now:
  - "core-dump" / "code=dumped" / "status=11/SEGV" / "status=6/ABRT" \u2192 process crashed, investigate crash not symptoms
  - "Cannot find module" / "MODULE_NOT_FOUND" \u2192 missing file/package, fix path or run npm install
  - "ENOENT" / "no such file" / "file not found" \u2192 wrong path, locate with glob/ls
  - "EACCES" / "permission denied" \u2192 fix permissions, don't retry
  - "401 Unauthorized" / "token expired" / "auth failed" \u2192 renew credentials
  - "ECONNREFUSED" / "port not reachable" \u2192 service down, check systemctl status
  - "OOM" / "JavaScript heap out of memory" \u2192 memory issue, restart + increase limits

  **Correct investigation order** (stop at the first step that gives a clear answer):
  1. systemctl status <service> \u2014 is it running? any recent crash?
  2. journalctl -u <service> -n 50 --no-pager \u2014 last 50 journal lines
  3. grep -n "ERROR|FATAL|fail" <logfile> | tail -20 \u2014 recent errors
  4. Only if still unclear: targeted grep -B5 -A5 "<specific error>" around the known error string
  NEVER use sequential sed -n 'N,Mp' to scroll backwards through a log file \u2014 use grep to find the exact line instead.
  NEVER use grep -B or -A with values larger than 20 \u2014 large context windows flood the LLM context and cause 400 errors. Use -B5 or -B10 at most.

  **Health-check stop signal**: If a health/token-validation endpoint returns {"valid":true} AND the API responds with HTTP 200, the problem is intermittent or already resolved. STOP reading logs immediately. Report to the user: the token is valid, the service is reachable, the error was transient \u2014 no fix is needed. Do NOT continue reading log files after seeing {"valid":true} from a health check.
- **Regex explanations**: Show the original pattern, test it with concrete examples, then provide BOTH: (1) a named-constant rewrite (e.g. const OCTET = '...'; const IP_RE = new RegExp(...)) AND (2) a step-by-step validation function that replaces the regex entirely using split/conditions \u2014 this is often the most readable alternative. Named groups are engine-specific \u2014 prefer named constants or the validation function. Verify the rewrite matches all edge cases of the original before claiming equivalence.
- **Encoding/buffer handling**: When discussing file operations, mention utf8 encoding or buffer considerations. Use correct flags like --zero instead of -0 for null-delimited output.
- **Hook implementations (Git, bash scripts)**: Answer ENTIRELY in text \u2014 do NOT use any tools. Write the complete, correct script in your first and only response. Think through ALL edge cases (e.g. console.log in comments or strings vs real calls) before writing \u2014 handle them in the initial script, never iterate. Show the full file content and how to install it (chmod +x, correct .git/hooks/ path). For pre-commit hooks that check staged content: always use 'git diff --cached' to get only staged changes \u2014 never grep full file content, which would catch unstaged lines. Use '--diff-filter=ACM' to target added/copied/modified files \u2014 NEVER use '--diff-filter=D' (that shows ONLY deleted files, opposite of intent). NEVER use 'set -e' in pre-commit hooks \u2014 grep exits 1 on no match, which kills the entire script under set -e. Use explicit 'if git diff --cached ... | grep -q ...; then' flow control instead, and check exit codes explicitly. REGEX FALSE POSITIVES IN DIFF OUTPUT: Diff lines start with '+' (added) or '-' (removed) \u2014 the actual code content comes AFTER the leading '+'/'-'. This means 'grep -v "^s*//"' does NOT exclude comment lines in diff output because the line starts with '+', not with whitespace. CORRECT pipeline for detecting console.log in staged .js changes while excluding comment lines: 'git diff --cached -- "*.js" | grep "^+" | grep -v "^+++" | grep -v "^+[[:space:]]*//" | grep -q "console.log"'. The key pattern is '^+[[:space:]]*//' \u2014 match lines where after the '+' prefix comes optional whitespace then '//'. Always use this exact pipeline, never 'grep -v "^s*//"' on diff output. CONSOLE METHODS: When a task asks to block console.log, explicitly address whether console.warn, console.error, console.debug, and console.info should also be blocked \u2014 if the intent is "no console output in production", block all console methods with a single pattern like 'console.(log|warn|error|debug|info)'.
- **Memory leak explanations**: Show the problematic code, then present the primary fix (move emitter.on() outside the loop, registered once) with the original setInterval kept intact for its intended purpose. Then briefly mention 2 alternatives: (1) emitter.once() if only one event needs handling, (2) removeAllListeners() (or emitter.off(event, handler)) BEFORE re-registering inside the loop. CRITICAL for alternative 2: you MUST call removeAllListeners() or off() BEFORE the new emitter.on() \u2014 if you call emitter.on() inside an interval without first removing the previous listener, a new listener accumulates on every tick, which is the same leak as the original. Always show the removal step explicitly. Do NOT replace the setInterval body with an empty callback \u2014 keep the interval doing its original work.
- **Makefile tasks**: ALWAYS follow this exact order: (1) paste the COMPLETE Makefile in a fenced code block in your text response FIRST, (2) THEN optionally write it to a file with a tool. The user cannot see files you write \u2014 your text response is the ONLY output they receive. Calling write_file does NOT substitute for pasting the code in your response. Never describe the Makefile in prose \u2014 paste the actual code. Every target, every recipe, every .PHONY line. Use EXACTLY the tools specified (jest means jest directly, not npm test; tsc means tsc, never npx tsc). Never put glob patterns like src/**/*.ts in prerequisites \u2014 make does not expand them. MAKEFILE SYNTAX RULES (hard requirements): (a) Recipe lines MUST be indented with a real TAB character \u2014 never spaces; a space-indented recipe causes "missing separator" errors. CRITICAL: commands go on the NEXT LINE after the target, indented with a TAB \u2014 NEVER on the same line. WRONG: "build: tsc" (puts tsc as a file dependency, does nothing). RIGHT: "build:
	tsc" (TAB then tsc on the line below). (b) Declare ALL phony targets in a SINGLE .PHONY line at the top \u2014 NEVER split .PHONY across multiple declarations. (c) NEVER define the same target name twice \u2014 duplicate targets silently override each other and produce contradictory behaviour. (d) Do NOT add @echo lines unless the task explicitly asks for output messages. (e) DEPENDENCY CHAIN: if the task describes a test target that runs tests after compilation/building, the test target MUST declare an explicit dependency on build (e.g. "test: build") \u2014 otherwise make test runs against stale or missing binaries. When in doubt, add the dependency; omitting it is always the wrong default. (f) 'all' target ordering: NEVER write "all: clean build test" and rely on make's left-to-right execution \u2014 with parallel make (-j) this is not guaranteed. Instead, encode the sequence via individual target dependencies: "test: build", "build: clean" (if clean\u2192build\u2192test is the intent), so the chain is enforced regardless of parallelism. Or use ordered prerequisites with .NOTPARALLEL if the task explicitly requires strict ordering.
- **Dataclass definitions**: Paste the COMPLETE dataclass code directly in your text response \u2014 @dataclass decorator, all fields with type annotations and defaults, full __post_init__ validation block. The code must appear verbatim in your chat text. Writing a file with a tool does NOT satisfy this \u2014 always also paste the code in text.
- **Cron expressions**: Before writing each expression, quote the exact constraint from the task, then derive the expression. Double-check boundary values match exactly what was asked. NEVER put cron expressions inside markdown tables \u2014 asterisks (*) in table cells are consumed as bold/italic markers and disappear. Always present each cron expression in its own fenced code block. For "every N minutes between X-Yh": only present both interpretations (inclusive vs. exclusive endpoint) when the task is genuinely ambiguous about whether the endpoint fires. If the task explicitly states "8-18h" or "until 18h" without qualification, write the expression with 8-18 directly \u2014 do NOT second-guess or add a confusing dual-interpretation note that contradicts the explicit request. The note is only appropriate when the task says something like "during business hours" or "until approximately 18h" where intent is unclear. CRITICAL OFF-BY-ONE: "8-18h" means the hour field is 8-18 (runs fire AT 18:00 are INCLUDED). Writing 8-17 silently drops the 18:00 run \u2014 this is WRONG. If you notice mid-response that you wrote 8-17 for an 8-18h spec, CORRECT THE EXPRESSION in-place immediately \u2014 do NOT leave both versions and add a contradictory note.
- **Express/fetch error handling**: When adding error handling to an Express route that fetches by ID: (1) validate the ID parameter first (check it exists and is a valid format), (2) wrap fetch in try-catch, (3) check response.ok and handle 404 specifically, (4) call next(error) to pass errors to Express error-handling middleware \u2014 do not just send a raw 500 response.
- **Command suggestions**: Always use correct command flags and syntax. For null-delimited output, use --zero or find/printf instead of non-existent flags like -0.
- **sed -i portability**: When showing 'sed -i' for in-place file editing, always note the macOS/BSD vs GNU difference: on macOS/BSD, '-i' requires an explicit backup suffix argument (e.g. 'sed -i "" "s/old/new/" file' for no backup, or 'sed -i.bak ...' for a backup); on GNU/Linux, 'sed -i "s/old/new/" file' works without the extra argument. When the user's platform is unknown or macOS, show the macOS-compatible form first. For cross-platform scripts, suggest 'perl -i -pe' as a portable alternative.

After completing multi-step tasks, suggest logical next steps (e.g. "You can run npm test to verify" or "Consider committing with /commit").

# Audit & Code Review Output

When performing audits, code reviews, bug hunts, or security reviews:

**1. Context Highlighting \u2014 always show WHY you're reading a file:**
  When following a reference found in one file to read another, prefix your explanation with the source:
  "Found reference in \`src/auth.js\`, checking \`lib/token.js\` to verify..."
  "Imported by \`main.js:42\`, reading \`utils/parse.js\` to trace the call..."
  This helps the user follow your investigation chain without seeing raw tool output.

**2. Selective reading \u2014 MANDATORY for large files:**
  read_file automatically truncates at 350 lines for unbounded reads. To read a large file:
  - First scan the top: line_start=1 line_end=80 to see structure/exports
  - Then read only the section you need (e.g. last 100 lines: line_start=950 line_end=1049)
  - NEVER call read_file without line_start/line_end on a file you know has >350 lines
  - A file showing "showing lines 1-350 of 1049" means 699 lines are hidden \u2014 use line ranges to reach them

**3. Audit summary table \u2014 end every audit with a findings table:**
  After completing an audit, code review, or bug hunt, ALWAYS append a Markdown table summarizing results:
  | # | Finding | File | Severity | Recommended Fix |
  |---|---------|------|----------|-----------------|
  Severity levels: Critical / High / Medium / Low / Info.
  If nothing was found, write a brief "\u2713 No issues found" table with the areas checked.

**4. Actionable next steps \u2014 offer to apply fixes:**
  After the findings table, list numbered fixes and ask explicitly:
  "Shall I apply **Fix #1** (race condition in auth.js)? Type 'yes' or 'fix 1'."
  If multiple fixes exist, list them all and let the user choose which to apply first.

# Response Content Guidelines

- **Avoid opinionated additions**: Only include what was explicitly requested. Do not add:
  - Unrequested fields (e.g., pagination fields not asked for)
  - Unnecessary patterns or interfaces
  - Opinionated design decisions beyond the scope of the request
  - Extra features or improvements not explicitly requested
- **Preserve existing behavior**: When refactoring or fixing code, maintain the original encoding, error handling, and API behavior unless explicitly instructed to change it.
- **Be complete**: Ensure responses include all necessary information and are not truncated. If a response would be very long, summarize key points and offer to provide more detail if needed.

# Frontend Design

Before creating or significantly modifying any frontend file (.html, .vue, .jsx, .tsx, .css, templates, components): **call frontend_recon first.** It returns the project's design tokens (colors, fonts, CSS variables), the main layout page, a reference component of the same type, and the detected framework stack (Alpine.js version, HTMX, Tailwind, etc.). Pass type= the kind of page you are building (e.g. "list", "form", "dashboard").

After frontend_recon returns:
- Use ONLY the colors, fonts, and spacing tokens it found \u2014 never invent values.
- Copy the exact HTML structure and class names from the reference component \u2014 do not create alternative patterns.
- Use ONLY the framework(s) it detected. Never mix (e.g. no fetch() when HTMX is used, no Vue syntax in an Alpine.js project).
- The finished page must be visually indistinguishable from existing pages.

# Doing Tasks

- For non-trivial tasks, briefly state your approach before starting (1 sentence). This helps the user know what to expect.
- **Understand intent before acting** \u2014 every prompt has a reason behind it. Before executing, ask yourself: what is the user actually trying to achieve? Then gather the current state first (read relevant files, run git status/diff). If what you find contradicts or already satisfies the task \u2014 ask the user instead of proceeding blindly. Examples: asked to implement something that already exists \u2192 ask whether to extend or replace it. Asked to reset/clean state \u2192 ask what problem that's supposed to solve. Never invent work and never silently execute when the situation is ambiguous.
- ALWAYS read code before modifying it. Never propose changes to code you haven't read.
- Prefer edit_file for targeted changes over write_file for full rewrites.
- Do not create new files unless absolutely necessary. Edit existing files instead.
- Use relative paths when possible.
- When blocked, try alternative approaches rather than retrying the same thing.
- Keep solutions simple. Only change what's directly requested or clearly necessary.
  - Don't add features, refactoring, or "improvements" beyond what was asked.
  - Don't add error handling for impossible scenarios. Only validate at system boundaries.
  - Don't add docstrings/comments to code you didn't change.
  - Don't create helpers or abstractions for one-time operations.
  - Three similar lines of code is better than a premature abstraction.
- After completing work, give a brief summary of what was done and any important details. Don't just silently finish.

# Diagnose Before Build (Critical)

\u26A0 MANDATORY: Before writing, creating, or modifying ANYTHING for a bug/problem/config task:

1. **Check what already exists** \u2014 read the relevant files, check .env variables, check remote state (server, database, API) FIRST. Do NOT assume the problem is real until you've verified it.
2. **Verify the problem is real** \u2014 if the issue might already be solved (token in .env, config already set, service already running), confirm that BEFORE writing any fix.
3. **One diagnosis step before any write step** \u2014 the sequence is always: read \u2192 understand \u2192 act. Never act \u2192 then discover.

Examples of what this prevents:
- Writing a v2 of a module when the original just needs a 2-line change
- Creating setup guides when the setup already exists
- Building Auto-Renewal systems when the token is already in .env

# No Documentation Bloat

NEVER create documentation files unless the user explicitly asks for them. This includes:
- \`*_SETUP.md\`, \`*_GUIDE.md\`, \`*_SOLUTION.md\`, \`*_PACKAGE.md\`, \`*_FIX.md\`
- \`env-example.txt\`, \`server-env-additions.txt\`, \`quickstart.sh\` wrappers
- Any file whose sole purpose is to explain what you just did

Write the solution. Do not document the solution unless asked.

# No Backup Files / No v2 Copies

NEVER create \`file-backup.js\`, \`file-v2.js\`, \`file-old.js\`, or similar. Git is the backup.
Modify files directly. If a rollback is needed, git handles it.

# Decide and Act \u2014 Don't Present Options

When the user says "do it" or "fix it" or "set it up": pick the best approach and execute it.
Do NOT present "Option 1 / Option 2 / Option 3" lists and wait. You decide. You act.
If you genuinely cannot proceed without a specific credential or value the user must provide, ask for exactly that \u2014 in one sentence, not a list of alternatives.

# No "What You Need to Do" Lists

You are the agent. The user should not need to do anything unless you hit a hard blocker (missing credential, physical device access, etc.).
Never write "Here's what you need to do: 1. ... 2. ... 3. ..." after completing your work.
If you need the user to take an action, state exactly one thing, explain why you can't do it yourself, and stop.

# Secrets Never in Output

Token values, passwords, API keys \u2014 NEVER show their values in chat or terminal output.
Show only variable names: \`SMARTTHINGS_TOKEN=<set>\`, never the actual value.
This applies to bash output, SSH output, grep results, and all other tool output you summarize.

# Tool Strategy

- Use the RIGHT tool for the job:
  - read_file to read files (not bash cat/head/tail)
  - edit_file or patch_file to modify files (not bash sed/awk)
  - glob to find files by name pattern (not bash find/ls)
  - grep or search_files to search file contents (not bash grep)
  - list_directory for directory structure (not bash ls/tree)
  - Only use bash for actual shell operations: running tests, installing packages, git commands, build tools.
- Call multiple tools in parallel when they're independent (e.g. reading multiple files at once).
- For complex tasks with 3+ steps, create a task list with task_list first.
- Use spawn_agents for 2+ independent tasks that can run simultaneously.
  - Good for: reading multiple files, analyzing separate modules.
  - Bad for: tasks that depend on each other or modify the same file.
  - Max 5 parallel agents.
- NEVER write temporary test/demo scripts (test_*.js, demo_*.js, scratch_*.js) just to run once and delete.
  - Instead: use bash with inline node -e '...' for quick one-off checks.
  - If the test is worth keeping, write it to tests/ with a proper name.
  - Write-then-delete patterns waste 3 tool calls and leave orphans if the session is interrupted.
${Ub()}

# Edit Reliability (Critical)

- edit_file's old_text must match the file content EXACTLY \u2014 including whitespace, indentation, and newlines.
- Always read the file first (read_file) before editing to see the exact current content.
- If old_text is not found, the edit fails. Common causes:
  - Indentation mismatch (tabs vs spaces, wrong level)
  - Invisible characters or trailing whitespace
  - Content changed since last read \u2014 read again before retrying.
- For multiple changes to the same file, prefer patch_file (single operation, atomic).
- Never guess file content. Always read first, then edit with the exact text you saw.

# Error Recovery

When a tool call returns ERROR:
- edit_file/patch_file "old_text not found": Use the line number from the error ("Most similar text (line N)") to re-read with line_start=N-5 line_end=N+15 to see the actual content. Then retry the edit with exact text from that targeted read. Do NOT re-read the full file.
- bash non-zero exit: Read the error output. Fix the root cause (missing dependency, wrong path, syntax error) rather than retrying the same command.
- "File not found": Use glob or list_directory to find the correct path. Do not guess.
- After 2 failed attempts at the same operation, stop and explain the issue to the user.

# Git Workflow

- Before committing, review changes with git_diff. Write messages that explain WHY, not WHAT.
- Stage specific files rather than git add -A to avoid committing unrelated changes.
- Use conventional commits: type(scope): description (feat, fix, refactor, docs, test, chore).
- Branch naming: feat/, fix/, refactor/, docs/ prefixes with kebab-case.
- NEVER force-push, skip hooks (--no-verify), or amend published commits without explicit permission.
- When asked to commit: review diff, propose message, wait for approval, then execute.

# Safety & Reversibility

- Consider reversibility before acting. File reads and searches are safe. File writes and bash commands may not be.
- For hard-to-reverse actions (deleting files, force-pushing, dropping tables), confirm with the user first.
- NEVER read .env files, credentials, or SSH keys.
- NEVER run destructive commands (rm -rf /, mkfs, dd, etc.).
- Dangerous commands (git push, npm publish, sudo, rm -rf) require user confirmation.
- Prefer creating new git commits over amending. Never force-push without explicit permission.
- If you encounter unexpected state (unfamiliar files, branches), investigate before modifying.

# Brain Knowledge Base

You have access to a persistent knowledge base in .nex/brain/.
- Use brain_write to save important discoveries, patterns, or decisions
- Write when you find: architecture insights, recurring error patterns, API quirks, deployment steps
- Do NOT write trivial or session-specific information
- Do NOT duplicate what's already in NEX.md or project memory
- Use descriptive kebab-case names: "auth-flow", "db-migration-steps"
- Include tags in frontmatter for better retrieval
- The user reviews all brain writes via /brain review or git diff

`),
      (Sa = t),
      qs
    );
  }
  function Wb() {
    ((X = []),
      Uf.clear(),
      Wf.clear(),
      Ta.clear(),
      Ra.clear(),
      Fs.clear(),
      Bf.clear(),
      Zn.clear(),
      es.clear(),
      (At = 0),
      (Us = 0),
      (dr = 0),
      (ts = !1),
      (pr = 0),
      (Ca = ""),
      (fr = 0));
  }
  function Bb() {
    X.length > Pf && X.splice(0, X.length - Pf);
  }
  function Hb() {
    return X.length;
  }
  function Gb() {
    return X;
  }
  function Kb(t) {
    X = t;
  }
  async function Yb() {
    let { execFile: t } = require("child_process"),
      e = require("fs"),
      s = process.cwd(),
      o = (f, m) =>
        new Promise((h) => {
          t(f, m, { cwd: s, timeout: 3e3 }, (p, g) => {
            h(p ? "" : (g || "").trim());
          });
        }),
      [n] = await Promise.all([
        o("find", [
          ".",
          "-type",
          "f",
          "-not",
          "-path",
          "*/node_modules/*",
          "-not",
          "-path",
          "*/.git/*",
          "-not",
          "-path",
          "*/dist/*",
          "-not",
          "-path",
          "*/.next/*",
          "-not",
          "-path",
          "*/build/*",
          "-not",
          "-path",
          "*/__pycache__/*",
          "-not",
          "-path",
          "*/vendor/*",
        ]),
      ]),
      r = new Set([
        "js",
        "ts",
        "jsx",
        "tsx",
        "py",
        "go",
        "rs",
        "rb",
        "java",
        "cpp",
        "c",
        "cs",
      ]),
      i = (
        n
          ? n.split(`
`)
          : []
      ).filter((f) => {
        let m = f.split(".").pop();
        return r.has(m);
      });
    if (i.length < 3) return null;
    let c = {};
    for (let f of i) {
      let m = f.split(".").pop();
      c[m] = (c[m] || 0) + 1;
    }
    let u = `  \u{1F4C1} ${Object.entries(c)
        .sort((f, m) => m[1] - f[1])
        .slice(0, 4)
        .map(([f, m]) => `${m} .${f}`)
        .join(" \xB7 ")}`,
      d = Oa.join(s, "package.json");
    if (e.existsSync(d))
      try {
        let f = JSON.parse(e.readFileSync(d, "utf-8")),
          m = Object.keys({
            ...(f.dependencies || {}),
            ...(f.devDependencies || {}),
          });
        if (m.length > 0) {
          let h = m.slice(0, 5).join(" \xB7 "),
            p = m.length > 5 ? ` +${m.length - 5}` : "";
          u += `
  \u{1F4E6} ${h}${p}`;
        }
      } catch {}
    return u;
  }
  function zb(t) {
    if (process.platform === "darwin")
      try {
        let { execFileSync: e } = require("child_process");
        e(
          "osascript",
          [
            "-e",
            `display notification "${t.replace(/"/g, '\\"')}" with title "nex-code"`,
          ],
          { timeout: 3e3, stdio: "ignore" },
        );
      } catch {}
  }
  function Fe(t, e, s, o, n, { suppressHint: r = !1 } = {}) {
    if (t < 1) return;
    let i = [...e.values()].reduce((u, d) => u + d, 0),
      c = `\u2500\u2500 ${t} ${t === 1 ? "step" : "steps"} \xB7 ${i} ${i === 1 ? "tool" : "tools"}`,
      l = 0;
    if (n) {
      let u = Date.now() - n;
      ((l = Math.round(u / 1e3)),
        (c +=
          l >= 60 ? ` \xB7 ${Math.floor(l / 60)}m ${l % 60}s` : ` \xB7 ${l}s`));
    }
    if (
      (s.size > 0 &&
        (c += ` \xB7 ${s.size} ${s.size === 1 ? "file" : "files"} modified`),
      (c += " \u2500\u2500"),
      console.log(`
${y.dim}  ${c}${y.reset}`),
      l >= 30 && process.stdout.isTTY)
    ) {
      let u =
        s.size > 0
          ? `Done \u2014 ${s.size} ${s.size === 1 ? "file" : "files"} modified in ${l}s`
          : `Done \u2014 ${t} ${t === 1 ? "step" : "steps"} in ${l}s`;
      zb(u);
    }
    s.size > 0
      ? console.log(
          `${y.dim}  \u{1F4A1} /diff \xB7 /commit \xB7 /undo${y.reset}`,
        )
      : !r && o.size >= 5 && s.size === 0 && t >= 3
        ? console.log(
            `${y.dim}  \u{1F4A1} Found issues? Say "fix 1" or "apply all fixes"${y.reset}`,
          )
        : o.size > 0 &&
          t >= 2 &&
          console.log(`${y.dim}  \u{1F4A1} /save \xB7 /clear${y.reset}`);
  }
  async function Xb() {
    if (!process.stdout.isTTY) return { action: "quit" };
    let t = Ds(),
      e = Vn(),
      s = hr.fast?.[t],
      o = hr.strong?.[t],
      n = s && s !== e,
      r = o && o !== e && o !== s,
      i = [];
    (i.push({
      key: "r",
      label: `Retry with current model ${y.dim}(${e})${y.reset}`,
    }),
      n &&
        i.push({
          key: "f",
          label: `Switch to ${y.bold}${s}${y.reset} ${y.dim}\u2014 fast, low latency${y.reset}`,
          model: s,
        }),
      r &&
        i.push({
          key: "s",
          label: `Switch to ${y.bold}${o}${y.reset} ${y.dim}\u2014 reliable tool-calling, medium speed${y.reset}`,
          model: o,
        }),
      i.push({ key: "q", label: `${y.dim}Quit${y.reset}` }),
      console.log(),
      console.log(
        `${y.yellow}  Stream stale \u2014 all retries exhausted.${y.reset} What would you like to do?`,
      ));
    for (let c of i) console.log(`  ${y.cyan}[${c.key}]${y.reset} ${c.label}`);
    return (
      process.stdout.write(`  ${y.yellow}> ${y.reset}`),
      new Promise((c) => {
        let l = process.stdin,
          u = l.isRaw;
        (l.setRawMode(!0), l.resume(), l.setEncoding("utf8"));
        let d = !1,
          f = (m) => {
            if (d) return;
            ((d = !0),
              l.removeListener("data", f),
              l.setRawMode(u || !1),
              l.pause());
            let h = m.toLowerCase().trim();
            if (
              (process.stdout.write(`${h}
`),
              m === "")
            )
              return c({ action: "quit" });
            let p = i.find((g) => g.key === h);
            !p || p.key === "q" || (!p.model && p.key !== "r")
              ? c({ action: "quit" })
              : p.key === "r"
                ? c({ action: "retry" })
                : c({ action: "switch", model: p.model, provider: t });
          };
        l.on("data", f);
      })
    );
  }
  var Lt = null;
  async function Jb(t, e = null) {
    Lt = e;
    let s = Df(t);
    (X.push({ role: "user", content: s }), Bb());
    try {
      let { detectComplexPrompt: De } = js(),
        Re = De(typeof t == "string" ? t : "");
      Re.isComplex &&
        console.log(
          `${y.dim}Hint: ~${Re.estimatedGoals} goals detected. Use /orchestrate for parallel execution.${y.reset}`,
        );
    } catch {}
    let { setOnChange: o } = Fo(),
      n = null,
      r = 0;
    o((De, Re) => {
      De === "create"
        ? (n && n.stop(),
          (n = new O0(Re.name, Re.tasks)),
          n.setStats({ tokens: r }),
          n.start())
        : De === "update" && n
          ? n.updateTask(Re.id, Re.status)
          : De === "clear" && n && (n.stop(), (n = null));
    });
    let i = await Hf(),
      c = i;
    try {
      let { getBrainContext: De } = Ss(),
        Re = await De(t);
      Re &&
        (c =
          i +
          `
` +
          Re +
          `
`);
    } catch (De) {
      process.env.NEX_DEBUG &&
        console.error("[agent] brain context failed:", De.message);
    }
    let l = [{ role: "system", content: c }, ...X],
      u = new Jn("Thinking...");
    u.start();
    let f = X.length === 1 ? Yb().catch(() => null) : Promise.resolve(null),
      m = ze(),
      [{ messages: h, compressed: p, compacted: g, tokensRemoved: $ }, w] =
        await Promise.all([q0(l, m), f]),
      _ = Ct(l, m);
    if ((u.stop(), w && console.log(`${y.dim}${w}${y.reset}`), g))
      console.log(
        `${y.dim}  [context compacted \u2014 summary (~${$} tokens freed)]${y.reset}`,
      );
    else if (p) {
      let De = _.limit > 0 ? Math.round(($ / _.limit) * 100) : 0;
      console.log(
        `${y.dim}  [context compressed \u2014 ~${$} tokens freed (${De}%)]${y.reset}`,
      );
    }
    _.percentage > 85 &&
      console.log(
        `${y.yellow}  \u26A0 Context ${Math.round(_.percentage)}% used (${Math.round(100 - _.percentage)}% remaining) \u2014 consider /clear or /save + start fresh${y.reset}`,
      );
    let x = h;
    if (Ct(x, ze()).percentage >= 65) {
      let { messages: Re, tokensRemoved: yt } = It(x, ze());
      yt > 0 &&
        ((x = Re),
        console.log(
          `${y.dim}  [pre-flight compress \u2014 ${yt} tokens freed, now ${Math.round(Ct(x, ze()).percentage)}% used]${y.reset}`,
        ));
    }
    let v = 0,
      b = 0,
      k = 0,
      A = 0,
      O = 0,
      P = 9,
      W = 0,
      Le = (() => {
        let De = X.find((Re) => Re.role === "user");
        return typeof De?.content == "string" ? De.content : "";
      })(),
      we =
        /set_reminder|google.?auth|cron:|api\.log|jarvis.{0,30}(fehler|error|fail|broken|crash|nicht.{0,10}(funktioniert|läuft)|debug)|(?:fehler|error|crash|broken).{0,30}jarvis/i.test(
          Le,
        ),
      fe = 0,
      G = 0,
      z = new Map(),
      ne = new Set(),
      ae = new Set(),
      R = Date.now(),
      L = new P0(hb),
      Z = Bf,
      se = 2,
      oe = 4,
      M = Uf,
      q = 5,
      re = 8,
      Y = Wf,
      Q = 4,
      pe = 7,
      ce = Ta,
      ge = 3,
      $e = 4,
      je = Ra,
      Be = 2,
      zt = 3,
      jt = 0,
      Or = 6,
      cm = 10,
      cn = 0,
      ic = 5,
      ln = 0,
      lm = 2,
      um = 3,
      Nr = 0,
      Mr = 8,
      dm = 12,
      lt,
      to = va,
      Pr = 0,
      ac = 3,
      Ir = !1;
    e: for (;;) {
      for (Ir = !1, lt = 0; lt < to && !lr()?.aborted; lt++) {
        {
          let T = ze(),
            E = Ct(x, T),
            J = G === 0 ? 65 : 78;
          if (E.percentage >= J) {
            let { messages: F, tokensRemoved: V } = It(x, T, G === 0);
            V > 0 &&
              ((x = F),
              V > 50 &&
                console.log(
                  `${y.dim}  [auto-compressed \u2014 ~${V} tokens freed, now ${Math.round(Ct(x, T).percentage)}%]${y.reset}`,
                ));
          }
        }
        let Re = !0;
        G > 0 && sb();
        let yt = null;
        if (n && n.isActive()) n._paused && n.resume();
        else if (!n) {
          let T,
            E = ob();
          if (E && E.total > 1) {
            let J =
              E.description.length > 40
                ? E.description.slice(0, 37) + "\u2026"
                : E.description;
            T = `Plan step ${E.current}/${E.total}: ${J}`;
          } else T = G > 0 ? `Thinking... (step ${G + 1})` : "Thinking...";
          ((yt = new Jn(T)), yt.start());
        }
        let Lr = !0,
          Xt = "",
          jr = !1,
          ut = new rb(),
          Dt,
          Dr = Date.now(),
          no = !1,
          qr = new AbortController(),
          cc = setInterval(() => {
            let T = Date.now() - Dr;
            if (T >= Mf)
              (ut._clearCursorLine(),
                console.log(
                  `${y.yellow}  \u26A0 Stream stale for ${Math.round(T / 1e3)}s \u2014 aborting and retrying${y.reset}`,
                ),
                qr.abort());
            else if (T >= Ob && !no) {
              ((no = !0), ut._clearCursorLine());
              let E = hr.fast?.[Ds()],
                J = k > 0 ? ` (retry ${k + 1}/${cr})` : "",
                F = Math.round((Mf - T) / 1e3);
              (console.log(
                `${y.yellow}  \u26A0 No tokens received for ${Math.round(T / 1e3)}s \u2014 waiting...${J}${y.reset}`,
              ),
                E && E !== Vn()
                  ? console.log(
                      `${y.dim}  \u{1F4A1} Will auto-switch to ${E} in ~${F}s if no tokens arrive${y.reset}`,
                    )
                  : console.log(
                      `${y.dim}  \u{1F4A1} Ctrl+C to abort \xB7 auto-abort in ~${F}s${y.reset}`,
                    ));
            }
          }, 5e3),
          wt = "",
          qt = null;
        try {
          let T = qf(ze()),
            E = Ws() ? T.filter((V) => jf.has(V.function.name)) : T,
            J = lr(),
            F = new AbortController();
          (J && J.addEventListener("abort", () => F.abort(), { once: !0 }),
            qr.signal.addEventListener("abort", () => F.abort(), { once: !0 }),
            (Dt = await I0(x, E, {
              signal: F.signal,
              onThinkingToken: () => {
                ((Dr = Date.now()),
                  (no = !1),
                  Lt?.onThinkingToken && Lt.onThinkingToken());
              },
              onToken: (V) => {
                if (((Dr = Date.now()), (no = !1), Lt?.onToken)) {
                  (Lt.onToken(V), (Xt += V));
                  return;
                }
                if (
                  ((Xt += V),
                  !jr && Xt.length > 400 && Xt.length % 250 < V.length + 1)
                ) {
                  let ie = ka(Xt, 3);
                  ie.truncated &&
                    ((jr = !0),
                    ut._clearCursorLine?.(),
                    console.log(
                      `${y.yellow}  \u26A0 LLM stream loop detected (${ie.repeatCount}\xD7 repeated) \u2014 suppressing display${y.reset}`,
                    ));
                }
                jr ||
                  ((wt += V),
                  process.stdout.isTTY
                    ? qt ||
                      (qt = setTimeout(() => {
                        (wt && ut && ut.push(wt), (wt = ""), (qt = null));
                      }, 50))
                    : (ut.push(wt), (wt = "")),
                  Lr &&
                    (n && !n._paused ? n.pause() : yt && yt.stop(),
                    Re || (Re = !0),
                    ut.startCursor(),
                    (Lr = !1)));
              },
            })));
        } catch (T) {
          if (
            (clearInterval(cc),
            qt && (clearTimeout(qt), (qt = null)),
            wt && ut && (ut.push(wt), (wt = "")),
            n && !n._paused && n.pause(),
            yt && yt.stop(),
            ut.stopCursor(),
            qr.signal.aborted && !lr()?.aborted)
          ) {
            if ((k++, k > cr)) {
              if (A < 1) {
                (A++,
                  Xn(
                    "Stale retries exhausted \u2014 last-resort force-compress...",
                    y.yellow,
                  ));
                let I = ze(),
                  { messages: U, tokensRemoved: ee } = It(x, I);
                ((x = U),
                  ee > 50 &&
                    console.log(
                      `${y.dim}  [force-compressed \u2014 ~${ee} tokens freed]${y.reset}`,
                    ),
                  (k = 0),
                  lt--);
                continue;
              }
              n && (n.stop(), (n = null));
              let ie = await Xb();
              if (ie.action === "quit") {
                (o(null), Fe(G, z, ne, ae, R), qe(X));
                break;
              }
              (ie.action === "switch" &&
                (Of(`${ie.provider}:${ie.model}`),
                console.log(
                  `${y.green}  \u2713 Switched to ${ie.provider}:${ie.model}${y.reset}`,
                )),
                (k = 0),
                lt--);
              continue;
            }
            let F = k === 1 ? 3e3 : 5e3;
            if (k >= 1 && W < 1) {
              (W++,
                Xn(
                  `Stale retry ${k}/${cr} \u2014 force-compressing before retry...`,
                  y.yellow,
                ));
              let ie = ze(),
                { messages: I, tokensRemoved: U } = It(x, ie, !0);
              if (
                ((x = I),
                U > 0 &&
                  U > 50 &&
                  console.log(
                    `${y.dim}  [force-compressed \u2014 ~${U} tokens freed]${y.reset}`,
                  ),
                Nb)
              ) {
                let ee = hr.fast?.[Ds()];
                ee &&
                  ee !== Vn() &&
                  (Of(`${Ds()}:${ee}`),
                  console.log(
                    `${y.cyan}  \u26A1 Auto-switched to ${ee} to avoid further stale timeouts${y.reset}`,
                  ),
                  console.log(
                    `${y.dim}  (disable with NEX_STALE_AUTO_SWITCH=0)${y.reset}`,
                  ));
              }
            } else
              console.log(
                `${y.yellow}  \u26A0 Stale retry ${k}/${cr} \u2014 retrying in ${F / 1e3}s...${y.reset}`,
              );
            let V = new Jn(`Waiting ${F / 1e3}s before retry...`);
            (V.start(),
              await new Promise((ie) => setTimeout(ie, F)),
              V.stop(),
              lt--);
            continue;
          }
          if (
            T.name === "AbortError" ||
            T.name === "CanceledError" ||
            T.message?.includes("canceled") ||
            T.message?.includes("aborted")
          ) {
            (n && (n.stop(), (n = null)), o(null), Fe(G, z, ne, ae, R), qe(X));
            break;
          }
          let E = T.message;
          if (T.code === "ECONNREFUSED" || T.message.includes("ECONNREFUSED"))
            E =
              "Connection refused \u2014 please check your internet connection or API endpoint";
          else if (T.code === "ENOTFOUND" || T.message.includes("ENOTFOUND"))
            E =
              "Network error \u2014 could not reach the API server. Please check your connection";
          else if (T.code === "ETIMEDOUT" || T.message.includes("timeout"))
            E =
              "Request timed out \u2014 the API server took too long to respond. Please try again";
          else if (
            T.message.includes("401") ||
            T.message.includes("Unauthorized")
          )
            E =
              "Authentication failed \u2014 please check your API key in the .env file";
          else if (T.message.includes("403") || T.message.includes("Forbidden"))
            E =
              "Access denied \u2014 your API key may not have permission for this model";
          else if (T.message.includes("404")) {
            ((E = `Model not found (404): ${Vn ? Vn() : "unknown"} \u2014 check your .env MODEL setting or run /models to list available models`),
              console.log(`${y.red}  \u2717 ${E}${y.reset}`),
              n && (n.stop(), (n = null)),
              o(null),
              Fe(G, z, ne, ae, R),
              qe(X));
            break;
          } else if (T.message.includes("400")) {
            if (A < 3 && O < P) {
              (A++, O++);
              let F = G === 0 && A === 1,
                V = F || A === 3 || W > 0;
              if (F) {
                A = 3;
                let ee = T.message
                  .replace(/^API Error(\s*\[HTTP \d+\])?:\s*/i, "")
                  .slice(0, 150);
                Xn(
                  `Bad request (400) \u2014 ${ee || "system prompt too large"}, compressing...`,
                  y.yellow,
                );
              } else
                Xn(
                  V
                    ? `Bad request (400) \u2014 nuclear compression (attempt ${A}/3, dropping history)...`
                    : `Bad request (400) \u2014 force-compressing and retrying... (attempt ${A}/3)`,
                  y.yellow,
                );
              let ie = ze(),
                { messages: I, tokensRemoved: U } = It(x, ie, V);
              ((x = I),
                U > 50 &&
                  console.log(
                    `${y.dim}  [force-compressed \u2014 ~${U} tokens freed]${y.reset}`,
                  ),
                lt--);
              continue;
            }
            {
              let F = x.find((le) => le.role === "system"),
                V = x.find(
                  (le) =>
                    le.role === "user" &&
                    !String(le.content).startsWith("[SYSTEM") &&
                    !String(le.content).startsWith("BLOCKED:"),
                ),
                ie = [F, V].filter(Boolean),
                { getUsage: I } = Je(),
                U = Je().estimateMessagesTokens(ie),
                ee = Je().estimateMessagesTokens(x);
              if (U < ee) {
                let le = [],
                  me = X.filter(
                    (ue) =>
                      ue.role === "assistant" &&
                      typeof ue.content == "string" &&
                      ue.content.trim().length > 30,
                  )
                    .slice(-3)
                    .map((ue) =>
                      ue.content.trim().slice(0, 120).replace(/\n+/g, " "),
                    );
                me.length > 0 &&
                  le.push(
                    `Key findings:
` +
                      me.map((ue) => `- ${ue}`).join(`
`),
                  );
                let Me = X.filter(
                  (ue) =>
                    ue.role === "tool" &&
                    typeof ue.content == "string" &&
                    !ue.content.startsWith("BLOCKED:") &&
                    ue.content.trim().length > 10,
                )
                  .slice(-3)
                  .map((ue) =>
                    ue.content
                      .trim()
                      .split(
                        `
`,
                      )
                      .slice(0, 3)
                      .join(
                        `
`,
                      )
                      .slice(0, 200),
                  );
                if (
                  (Me.length > 0 &&
                    le.push(
                      `Tool results summary:
` +
                        Me.map((ue) => `- ${ue}`).join(`
`),
                    ),
                  ne.size > 0)
                ) {
                  let ue = [...ne]
                    .map((dt) => dt.split("/").slice(-2).join("/"))
                    .join(", ");
                  le.unshift(
                    `Already modified: ${ue} \u2014 use edit_file to add missing pieces only, DO NOT use write_file on these files.`,
                  );
                }
                if (le.length > 0) {
                  let ue = {
                    role: "user",
                    content: `[SYSTEM: Findings from investigation before context wipe]
${le.join(`
`)}
Continue implementing the fixes based on these findings.`,
                  };
                  ie.push(ue);
                }
                if (Us >= 3) {
                  let ue =
                    ne.size > 0
                      ? `
Files modified so far: ${[...ne].map((dt) => dt.split("/").slice(-1)[0]).join(", ")}`
                      : "";
                  (console.log(
                    `${y.red}  \u2717 Super-nuclear limit reached (3\xD7) \u2014 aborting to prevent runaway context loop${y.reset}`,
                  ),
                    console.log(
                      `${y.yellow}  \u{1F4A1} Task may exceed model context. Try /clear and break it into smaller steps.${ue ? y.dim + ue : ""}${y.reset}`,
                    ),
                    n && (n.stop(), (n = null)),
                    o(null),
                    Fe(G, z, ne, ae, R, { suppressHint: !0 }),
                    qe(X));
                  break;
                }
                if (
                  ((x = ie),
                  Us++,
                  (At = 0),
                  (fe = 0),
                  Ra.clear(),
                  Zn.clear(),
                  es.clear(),
                  Ta.clear(),
                  Xn(
                    `Super-nuclear compression \u2014 dropped all history, keeping original task only (${ee - U} tokens freed)`,
                    y.yellow,
                  ),
                  Us >= 1)
                ) {
                  let ue = {
                    role: "user",
                    content: `[SYSTEM WARNING] Context wiped ${Us}\xD7. SKIP investigation \u2014 implement directly using findings above. Max 5 tool calls total, then finish.

CRITICAL: If you must re-read a file, use line_start/line_end to read ONLY the section you need (e.g. last 50 lines). Never read a full large file again \u2014 that is what caused the context overflow.`,
                  };
                  (X.push(ue), x.push(ue));
                }
                ((A = 0), lt--);
                continue;
              }
            }
            E =
              "Context too large to compress \u2014 use /clear to start fresh";
          } else
            T.message.includes("500") ||
            T.message.includes("502") ||
            T.message.includes("503") ||
            T.message.includes("504")
              ? (E =
                  "API server error \u2014 the provider is experiencing issues. Please try again in a moment")
              : (T.message.includes("fetch failed") ||
                  T.message.includes("fetch")) &&
                (E =
                  "Network request failed \u2014 please check your internet connection");
          if (
            (console.log(`${y.red}  \u2717 ${E}${y.reset}`),
            T.message.includes("429"))
          ) {
            if ((v++, v > ba)) {
              (console.log(
                `${y.red}  Rate limit: max retries (${ba}) exceeded. Try again later or use /budget to check your limits.${y.reset}`,
              ),
                n && (n.stop(), (n = null)),
                o(null),
                Fe(G, z, ne, ae, R),
                qe(X));
              break;
            }
            let F = Math.min(1e4 * Math.pow(2, v - 1), 12e4),
              V = new Jn(
                `Rate limit \u2014 waiting ${Math.round(F / 1e3)}s (retry ${v}/${ba})`,
              );
            (V.start(), await new Promise((ie) => setTimeout(ie, F)), V.stop());
            continue;
          }
          if (
            T.message.includes("socket disconnected") ||
            T.message.includes("TLS") ||
            T.message.includes("ECONNRESET") ||
            T.message.includes("ECONNABORTED") ||
            T.message.includes("ETIMEDOUT") ||
            T.code === "ECONNRESET" ||
            T.code === "ECONNABORTED"
          ) {
            if ((b++, b > _a)) {
              (console.log(
                `${y.red}  Network error: max retries (${_a}) exceeded. Check your connection and try again.${y.reset}`,
              ),
                n && (n.stop(), (n = null)),
                o(null),
                Fe(G, z, ne, ae, R),
                qe(X));
              break;
            }
            let F = Math.min(2e3 * Math.pow(2, b - 1), 3e4),
              V = new Jn(
                `Network error \u2014 retrying in ${Math.round(F / 1e3)}s (${b}/${_a})`,
              );
            (V.start(),
              await new Promise((ie) => setTimeout(ie, F)),
              V.stop(),
              lt--);
            continue;
          }
          (n && (n.stop(), (n = null)), o(null), Fe(G, z, ne, ae, R), qe(X));
          break;
        }
        (clearInterval(cc),
          (v = 0),
          (b = 0),
          Lr && (n && !n._paused && n.pause(), yt && yt.stop()),
          qt && (clearTimeout(qt), (qt = null)),
          wt && ut && (ut.push(wt), (wt = "")),
          Xt && ut.flush(),
          (b = 0),
          (k = 0),
          Dt &&
            Dt.usage &&
            (db(
              Ds(),
              Vn(),
              Dt.usage.prompt_tokens || 0,
              Dt.usage.completion_tokens || 0,
            ),
            (r +=
              (Dt.usage.prompt_tokens || 0) +
              (Dt.usage.completion_tokens || 0)),
            n && n.setStats({ tokens: r })));
        let { content: lc, tool_calls: un } = Dt,
          so = ka(lc || ""),
          uc = so.truncated ? so.text : lc;
        so.truncated &&
          console.log(
            `${y.yellow}  \u26A0 LLM output loop detected (${so.repeatCount}\xD7 repeated paragraph) \u2014 response truncated${y.reset}`,
          );
        let oo = wb(uc || ""),
          ro = oo.truncated ? oo.text : uc;
        oo.truncated &&
          console.log(
            `${y.yellow}  \u26A0 LLM output loop detected (${oo.repeatCount}\xD7 repeated window) \u2014 response truncated${y.reset}`,
          );
        let Fr = { role: "assistant", content: ro || "" };
        if (
          (un && un.length > 0 && (Fr.tool_calls = un),
          X.push(Fr),
          x.push(Fr),
          !un || un.length === 0)
        ) {
          let T = (ro || "").trim().length > 0 || Xt.trim().length > 0,
            E = !1;
          if ((ts && T && ((ts = !1), (At = 0), (E = !0)), E && T)) {
            let J = (ro || "").trim();
            if (
              J.endsWith("?") ||
              /\b(Wo |Bitte |Kannst du|Soll ich)\b/.test(J.slice(-200))
            ) {
              let V = {
                role: "user",
                content:
                  "[SYSTEM] Continue. Do not ask questions \u2014 implement the fix yourself using SSH. The server is at 94.130.37.43.",
              };
              (x.push(V), X.push(V));
              continue;
            }
          }
          if (!T && G > 0 && lt < va - 1) {
            let J = {
              role: "user",
              content:
                "[SYSTEM] You ran tools but produced no visible output. The user CANNOT see tool results \u2014 only your text. Please summarize your findings now.",
            };
            (x.push(J), X.push(J));
            continue;
          }
          if (Ws() && T && G === 0)
            if ((dr++, dr > 2))
              console.log(
                `${y.yellow}  \u26A0 Plan accepted despite no file reads (rejection loop cap reached)${y.reset}`,
              );
            else {
              let J = {
                role: "user",
                content: `[SYSTEM] You wrote a plan without reading any files. This plan may be based on incorrect assumptions (wrong database type, wrong file structure, etc.).

MANDATORY: Use read_file, glob, or grep to investigate the actual codebase first. Read at least the relevant module file and route file before writing the plan.`,
              };
              (X.push(J),
                x.push(J),
                console.log(
                  `${y.yellow}  \u26A0 Plan rejected (${dr}/2): no files read \u2014 forcing investigation${y.reset}`,
                ));
              continue;
            }
          if (Ws() && T) {
            let J = (ro || Xt || "").trim();
            (eb(J), Mb(J));
            let F = tb(J);
            if (F.length > 0) {
              let V = X.find((ee) => ee.role === "user"),
                ie =
                  typeof V?.content == "string"
                    ? V.content.slice(0, 120)
                    : "Task";
              nb(ie, F);
              let I = F.length === 1 ? "step" : "steps",
                U = !1;
              if (process.stdout.isTTY && process.stdin.isTTY) {
                let {
                  approvePlan: ee,
                  startExecution: le,
                  setPlanMode: me,
                } = Pt();
                process.stdout.write(`
${y.cyan}${y.bold}Plan ready${y.reset} ${y.dim}(${F.length} ${I})${y.reset}  ${y.green}[A]${y.reset}${y.dim}pprove${y.reset}  ${y.yellow}[E]${y.reset}${y.dim}dit${y.reset}  ${y.red}[R]${y.reset}${y.dim}eject${y.reset}  ${y.dim}[\u21B5 = approve]:${y.reset} `);
                let Me = process.stdin.isRaw,
                  ue = await new Promise((dt) => {
                    try {
                      process.stdin.setRawMode(!0);
                    } catch {}
                    (process.stdin.resume(),
                      process.stdin.once("data", (io) => {
                        try {
                          process.stdin.setRawMode(Me || !1);
                        } catch {}
                        let Wr = io.toString().toLowerCase()[0] || "\r";
                        dt(Wr);
                      }));
                  });
                if (
                  (process.stdout.write(`
`),
                  ue === "r")
                )
                  console.log(
                    `${y.red}Plan rejected.${y.reset} Ask follow-up questions to refine.`,
                  );
                else if (ue === "e")
                  console.log(
                    `${y.yellow}Type /plan edit to open in editor, or give feedback.${y.reset}`,
                  );
                else if (ee()) {
                  (le(),
                    me(!1),
                    Ea(),
                    console.log(
                      `${y.green}${y.bold}Approved!${y.reset} Executing ${F.length} ${I}...`,
                    ));
                  let dt = `[PLAN APPROVED \u2014 EXECUTE NOW]

Implement the following plan step by step. All tools are now available.

${J}`;
                  (X.push({ role: "user", content: dt }),
                    x.push({ role: "user", content: dt }),
                    (U = !0));
                }
              } else
                console.log(`
${y.cyan}${y.bold}Plan ready${y.reset} ${y.dim}(${F.length} ${I} extracted).${y.reset} Type ${y.cyan}/plan approve${y.reset}${y.dim} to execute, or ${y.reset}${y.cyan}/plan edit${y.reset}${y.dim} to review.${y.reset}`);
              if (U) {
                (n && (n.stop(), (n = null)), lt--);
                continue;
              }
            } else {
              let V = !1;
              if (process.stdout.isTTY && process.stdin.isTTY) {
                let {
                  approvePlan: ie,
                  startExecution: I,
                  setPlanMode: U,
                } = Pt();
                process.stdout.write(`
${y.cyan}${y.bold}Plan ready.${y.reset}  ${y.green}[A]${y.reset}${y.dim}pprove${y.reset}  ${y.red}[R]${y.reset}${y.dim}eject${y.reset}  ${y.dim}[\u21B5 = approve]:${y.reset} `);
                let ee = process.stdin.isRaw,
                  le = await new Promise((me) => {
                    try {
                      process.stdin.setRawMode(!0);
                    } catch {}
                    (process.stdin.resume(),
                      process.stdin.once("data", (Me) => {
                        try {
                          process.stdin.setRawMode(ee || !1);
                        } catch {}
                        me(Me.toString().toLowerCase()[0] || "\r");
                      }));
                  });
                if (
                  (process.stdout.write(`
`),
                  le === "r")
                )
                  console.log(
                    `${y.red}Plan rejected.${y.reset} Ask follow-up questions to refine.`,
                  );
                else if (ie()) {
                  (I(),
                    U(!1),
                    Ea(),
                    console.log(
                      `${y.green}${y.bold}Approved!${y.reset} Executing...`,
                    ));
                  let Me = `[PLAN APPROVED \u2014 EXECUTE NOW]

Implement the following plan step by step. All tools are now available.

${getPlanContent() || Dt.content}`;
                  (X.push({ role: "user", content: Me }),
                    x.push({ role: "user", content: Me }),
                    (V = !0));
                }
              } else
                console.log(`
${y.cyan}${y.bold}Plan ready.${y.reset} ${y.dim}Type ${y.reset}${y.cyan}/plan approve${y.reset}${y.dim} to execute, or ask follow-up questions to refine.${y.reset}`);
              if (V) {
                (n && (n.stop(), (n = null)), lt--);
                continue;
              }
            }
          }
          (n && (n.stop(), (n = null)),
            o(null),
            Fe(G, z, ne, ae, R),
            qe(X),
            Rf(X));
          return;
        }
        (G++, G >= 1 && (Re = !1));
        for (let T of un) {
          let E = T.function.name;
          z.set(E, (z.get(E) || 0) + 1);
        }
        let Ne = await Promise.all(un.map((T) => Pb(T)));
        {
          let T = Ct(x, ze()),
            E = T.percentage,
            J = Ne.some(
              (I) =>
                I.canExecute && I.fnName === "read_file" && !I.args?.line_end,
            ),
            F = Ne.filter(
              (I) =>
                I.canExecute &&
                I.fnName === "read_file" &&
                I.args?.path &&
                je.get(I.args.path) >= 1 &&
                !I.args?.line_start,
            ).map((I) => I.args.path.split("/").slice(-2).join("/")),
            V = F.length > 0;
          if ((E >= 70 && J && Nr < 70) || (E >= 85 && Nr < 85) || V) {
            Nr = E;
            let I = E >= 85 ? "URGENT" : "WARNING",
              U;
            V
              ? ((I = "WARNING"),
                (U = `Unbounded re-read of ${F.join(", ")} \u2014 already in context. Use line_start/line_end to read specific sections instead.`))
              : J
                ? (U = `Unbounded read at ${Math.round(E)}% context \u2014 use line_start/line_end to avoid overflow.`)
                : (U = `Context ${Math.round(E)}% used. Avoid large reads, wrap up with what you have.`);
            let ee = {
              role: "user",
              content: `[SYSTEM ${I}] Context ${Math.round(E)}% used (${T.used}/${T.limit} tokens). ${U}`,
            };
            if ((X.push(ee), x.push(ee), E >= 85)) {
              let le = V ? ` (re-read of: ${F.join(", ")})` : "";
              console.log(
                `${y.yellow}  \u26A0 Context ${Math.round(E)}% used \u2014 agent warned to use targeted reads${le}${y.reset}`,
              );
            }
          }
        }
        for (let T of Ne) {
          if (!T.canExecute || T.fnName !== "read_file") continue;
          let E = T.args?.path;
          if (!E) continue;
          let J = je.get(E) || 0,
            F = T.args?.line_start != null,
            V = Zn.get(E) === !0,
            ie = 6;
          if (J >= ie) {
            let I = E.split("/").slice(-2).join("/"),
              U = (es.get(E) || 0) + 1;
            (es.set(E, U),
              U === 1 &&
                console.log(
                  `${y.red}  \u2716 Blocked: "${I}" read ${J}\xD7 \u2014 hard cap (${ie}) reached${y.reset}`,
                ),
              (T.canExecute = !1),
              (T.errorResult = {
                role: "tool",
                content: `BLOCKED: read_file("${E}") denied \u2014 file already read ${J}\xD7 (hard cap: ${ie}). You have seen enough of this file. Use grep to find specific content or proceed with what you know.`,
                tool_call_id: T.callId,
              }));
          } else if (J >= 1 && F)
            if (V) {
              let I = E.split("/").slice(-2).join("/");
              (console.log(
                `${y.cyan}  \u21A9 Targeted re-read: "${I}" (line_start=${T.args.line_start}) \u2014 edit recovery${y.reset}`,
              ),
                Zn.delete(E));
            } else {
              let I = T.args.line_start || 1,
                U = T.args.line_end || I + 350,
                ee = Fs.get(E) || [],
                le = !1;
              for (let [me, Me] of ee) {
                let ue = Math.max(I, me),
                  dt = Math.min(U, Me);
                if (dt > ue) {
                  let io = dt - ue,
                    Wr = U - I || 1;
                  if (io / Wr >= 0.7) {
                    let mc = E.split("/").slice(-2).join("/");
                    (console.log(
                      `${y.red}  \u2716 Blocked duplicate read: "${mc}" lines ${I}-${U} (\u226570% overlap with lines ${me}-${Me} already in context)${y.reset}`,
                    ),
                      (T.canExecute = !1),
                      (T.errorResult = {
                        role: "tool",
                        content: `BLOCKED: read_file("${E}", lines ${I}-${U}) is a duplicate \u2014 lines ${me}-${Me} are already in your context (\u226570% overlap). Use grep to find specific content instead of re-reading.`,
                        tool_call_id: T.callId,
                      }),
                      (le = !0));
                    break;
                  }
                }
              }
              if (!le) {
                let me = ee.length,
                  Me = 2;
                if (me >= 3) {
                  let dt = E.split("/").slice(-2).join("/");
                  (console.log(
                    `${y.red}  \u2716 Blocked file-scroll: "${dt}" \u2014 ${me} sections already read. Use grep to find specific content.${y.reset}`,
                  ),
                    (T.canExecute = !1),
                    (T.errorResult = {
                      role: "tool",
                      content: `BLOCKED: read_file("${E}") denied \u2014 you have already read ${me} different sections of this file (file-scroll pattern). You have seen most of this file. Use grep_search to find the exact lines you need instead of continuing to scroll.`,
                      tool_call_id: T.callId,
                    }));
                } else
                  me >= Me &&
                    (T._scrollWarn = { sectionCount: me + 1, path: E });
              }
            }
          else if (J >= 1) {
            let I = E.split("/").slice(-2).join("/"),
              U = (es.get(E) || 0) + 1;
            (es.set(E, U),
              U === 1 &&
                console.log(
                  `${y.red}  \u2716 Blocked unbounded re-read: "${I}" \u2014 already in context. Use line_start/line_end for specific sections.${y.reset}`,
                ),
              (T.canExecute = !1),
              (T.errorResult = {
                role: "tool",
                content: `BLOCKED: read_file("${E}") denied \u2014 file already in context (read ${J}\xD7). Use line_start/line_end to read a specific section instead of the full file.`,
                tool_call_id: T.callId,
              }));
          }
        }
        for (let T of Ne)
          T.canExecute &&
            ((T.fnName !== "ssh_exec" && T.fnName !== "bash") ||
              (/\bsed\s+-n\b/.test(T.args?.command || "") &&
                (console.log(
                  `${y.red}  \u2716 Blocked sed -n: use grep -n "pattern" <file> | head -30 instead${y.reset}`,
                ),
                (T.canExecute = !1),
                (T.errorResult = {
                  role: "tool",
                  content:
                    'BLOCKED: sed -n is forbidden \u2014 it floods context with line ranges. Use grep -n "pattern" <file> | head -30 to read a specific section, or cat <file> for the full file.',
                  tool_call_id: T.callId,
                }))));
        for (let T of Ne) {
          if (!T.canExecute || T.fnName !== "write_file") continue;
          let E = T.args?.path,
            J = T.args?.content || "";
          if (E)
            try {
              let F = require("fs"),
                V = require("path").resolve(process.cwd(), E);
              if (F.existsSync(V)) {
                let ie = F.statSync(V).size,
                  I = Buffer.byteLength(J, "utf8"),
                  U = ie > 0 ? I / ie : 1;
                if (U < 0.6 && ie > 200) {
                  let ee = E.split("/").slice(-2).join("/");
                  (console.log(
                    `${y.red}  \u2716 write_file shrink guard: "${ee}" would shrink to ${Math.round(U * 100)}% of original \u2014 likely context loss${y.reset}`,
                  ),
                    (T.canExecute = !1),
                    (T.errorResult = {
                      role: "tool",
                      content: `BLOCKED: write_file("${E}") denied \u2014 new content is only ${Math.round(U * 100)}% of current file size (${ie} \u2192 ${I} bytes). This looks like a partial rewrite after context loss. Use edit_file/patch_file to add only the new code, or read the file first to see full content before replacing.`,
                      tool_call_id: T.callId,
                    }));
                }
              }
            } catch {}
        }
        for (let T of Ne) {
          if (!T.canExecute || T.fnName !== "grep") continue;
          let E = T.args?.path;
          if (!E) continue;
          let J = ce.get(E) || 0;
          if (J >= $e) {
            let F = E.split("/").slice(-2).join("/");
            (console.log(
              `${y.red}  \u2716 Blocked grep: "${F}" grepped ${J}\xD7 with different patterns \u2014 flood threshold exceeded${y.reset}`,
            ),
              (T.canExecute = !1),
              (T.errorResult = {
                role: "tool",
                content: `BLOCKED: grep("${E}") denied \u2014 ${J} patterns already tried. Use existing results.`,
                tool_call_id: T.callId,
              }));
          }
        }
        if (ts) {
          let T = Ne.filter((F) => F.canExecute && F.fnName === "ssh_exec"),
            E = Ne.some((F) => F.canExecute && F.fnName !== "ssh_exec"),
            J = we && fe < 3;
          if (T.length > 0 && !E && J && pr < 1)
            ((ts = !1),
              pr++,
              (At = Math.max(0, Mr - 2)),
              console.log(
                `${y.dim}  [dual-block deadlock: SSH storm relaxed \u2014 allowing 1 SSH call (relax ${pr}/1)]${y.reset}`,
              ));
          else
            for (let F of T)
              ((F.canExecute = !1),
                (F.errorResult = {
                  role: "tool",
                  content: `BLOCKED: ssh_exec denied \u2014 SSH storm (${Mr}+ calls). Synthesize findings now.`,
                  tool_call_id: F.callId,
                }));
        }
        if (we && fe < 3) {
          for (let T of Ne)
            if (
              T.canExecute &&
              ["bash", "read_file", "find_files"].includes(T.fnName)
            ) {
              fe++;
              {
                let E = ze(),
                  { messages: J } = It(x, E);
                x = J;
              }
              (console.log(
                `${y.yellow}  \u26A0 Jarvis-local guard: blocking local ${T.fnName} \u2014 use ssh_exec on 94.130.37.43${y.reset}`,
              ),
                (T.canExecute = !1),
                (T.errorResult = {
                  role: "tool",
                  content: `BLOCKED: ${T.fnName} denied \u2014 this is a server issue. Use ssh_exec on 94.130.37.43 instead.`,
                  tool_call_id: T.callId,
                }));
              break;
            }
        }
        let is = n ? { skipSpinner: !0, skipSummaries: !0 } : {},
          fm = Ne.some((T) => T.fnName === "ask_user"),
          dc = !is.skipSummaries && !Re,
          Ur = null;
        (dc && !fm
          ? ((Re = !0),
            (is.skipSpinner = !0),
            process.stdout.isTTY
              ? (process.stdout.write(ga(Ne, G, !1, "blink")), (Ur = !0))
              : Lt ||
                process.stdout.write(
                  ga(Ne, G, !1) +
                    `
`,
                ))
          : dc && ((Re = !0), (is.skipSpinner = !0)),
          n && n._paused && n.resume());
        let { results: fc, summaries: pm } = await jb(Ne, !0, {
          ...is,
          skipSummaries: !0,
        });
        if (
          (Ur &&
            ((Ur = null),
            process.stdout.write(`\r\x1B[2K${ga(Ne, G, !1)}
`)),
          !is.skipSummaries)
        ) {
          let T = pm.filter((F, V) => !(Ne[V] && Ne[V].fnName === "ask_user"));
          for (let F of T) console.log(F);
          console.log("");
          let E = Ne.filter((F) => F && F.fnName !== "ask_user").map(
              (F) => F.fnName,
            ),
            J = L.record(0, E, ae, ne);
          J && gb(J);
        }
        for (let T of Ne) {
          if (T.canExecute || !T.errorResult) continue;
          let E =
            typeof T.errorResult.content == "string"
              ? T.errorResult.content
              : "";
          if (
            (E.startsWith("BLOCKED:") || E.startsWith("PLAN MODE:")) &&
            (cn++, cn >= ic)
          ) {
            (console.log(
              `${y.red}  \u2716 Loop abort: ${cn} consecutive blocked calls (pre-execution) \u2014 model not heeding BLOCKED messages${y.reset}`,
            ),
              n && (n.stop(), (n = null)),
              o(null),
              Fe(G, z, ne, ae, R, { suppressHint: !0 }),
              qe(X));
            return;
          }
        }
        for (let T = 0; T < Ne.length; T++) {
          let E = Ne[T];
          if (!E.canExecute) continue;
          let J = fc[T].content,
            F = J.split(`
`)[0],
            V =
              !F.startsWith("ERROR") &&
              !F.startsWith("CANCELLED") &&
              !F.startsWith("Command failed") &&
              !F.startsWith("EXIT");
          if (
            (!V &&
              (E.fnName === "edit_file" || E.fnName === "patch_file") &&
              E.args?.path &&
              F.includes("old_text not found") &&
              Zn.set(E.args.path, !0),
            V && E.fnName === "write_file" && E.args?.path)
          ) {
            let I = E.args.path.split("/").pop(),
              U =
                E.args.path.includes("/tests/") ||
                E.args.path.includes("\\tests\\");
            if (/^(test_|demo_|temp_|tmp_|scratch_)/.test(I) && !U) {
              console.log(
                `${y.yellow}  \u26A0 Temp file: "${I}" \u2014 delete with bash rm when done to keep the workspace clean${y.reset}`,
              );
              let le = {
                role: "user",
                content: `[HINT] "${E.args.path}" looks like a temporary test/demo file. Delete it with bash("rm ${E.args.path}") as soon as you're done \u2014 orphaned temp files count against session quality.`,
              };
              (X.push(le), x.push(le));
            }
          }
          if (
            V &&
            ["write_file", "edit_file", "patch_file"].includes(E.fnName) &&
            E.args &&
            E.args.path
          ) {
            (Zn.delete(E.args.path), ne.add(E.args.path));
            let I = (Z.get(E.args.path) || 0) + 1;
            Z.set(E.args.path, I);
            let U = E.args.path.split("/").slice(-2).join("/");
            if (I === se) {
              console.log(
                `${y.yellow}  \u26A0 Loop warning: "${U}" edited ${I}\xD7 \u2014 possible edit loop${y.reset}`,
              );
              let ee = {
                role: "user",
                content: `[SYSTEM WARNING] "${E.args.path}" edited ${I}\xD7. One more edit max, then move on.`,
              };
              (X.push(ee), x.push(ee));
            } else if (I >= oe) {
              (console.log(
                `${y.red}  \u2716 Loop abort: "${U}" edited ${I}\xD7 \u2014 aborting to prevent runaway loop${y.reset}`,
              ),
                n && (n.stop(), (n = null)),
                o(null),
                Fe(G, z, ne, ae, R, { suppressHint: !0 }),
                qe(X));
              return;
            }
          }
          if (
            (E.fnName === "bash" || E.fnName === "ssh_exec") &&
            E.args &&
            E.args.command
          ) {
            let I = E.args.command
                .replace(/\d+/g, "N")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 100),
              U = (M.get(I) || 0) + 1;
            if ((M.set(I, U), U === q)) {
              console.log(
                `${y.yellow}  \u26A0 Loop warning: same bash command run ${U}\xD7 \u2014 possible debug loop${y.reset}`,
              );
              let ee = {
                role: "user",
                content: `[SYSTEM WARNING] Same bash command ${U}\xD7. Debug loop detected \u2014 try a different approach.`,
              };
              (X.push(ee), x.push(ee));
            } else if (U >= re) {
              (console.log(
                `${y.red}  \u2716 Loop abort: same bash command run ${U}\xD7 \u2014 aborting runaway debug loop${y.reset}`,
              ),
                n && (n.stop(), (n = null)),
                o(null),
                Fe(G, z, ne, ae, R, { suppressHint: !0 }),
                qe(X));
              return;
            }
          }
          if (E.fnName === "ssh_exec") {
            if ((At++, At >= dm)) {
              (console.log(
                `${y.red}  \u2716 SSH storm abort: ${At} consecutive ssh_exec calls \u2014 aborting${y.reset}`,
              ),
                n && (n.stop(), (n = null)),
                o(null),
                Fe(G, z, ne, ae, R, { suppressHint: !0 }),
                qe(X));
              return;
            } else if (At === Mr) {
              {
                let U = ze(),
                  { messages: ee } = It(x, U);
                x = ee;
              }
              ((ts = !0),
                console.log(
                  `${y.yellow}  \u26A0 SSH storm warning: ${At} consecutive ssh_exec calls \u2014 blocking further SSH${y.reset}`,
                ));
              let I = {
                role: "user",
                content: `[SYSTEM WARNING] ${At} consecutive SSH calls. Synthesize findings now \u2014 no more SSH.`,
              };
              (X.push(I), x.push(I));
            }
          } else E.canExecute && (At = 0);
          if (V && E.fnName === "grep" && E.args && E.args.pattern) {
            let I = `${E.args.pattern}|${E.args.path || ""}`,
              U = (Y.get(I) || 0) + 1;
            if ((Y.set(I, U), U === Q)) {
              console.log(
                `${y.yellow}  \u26A0 Loop warning: grep pattern "${E.args.pattern.slice(0, 40)}" run ${U}\xD7 \u2014 possible search loop${y.reset}`,
              );
              let ee = {
                role: "user",
                content: `[SYSTEM WARNING] Same grep pattern ${U}\xD7. Results unchanged \u2014 use existing data or try different pattern.`,
              };
              (X.push(ee), x.push(ee));
            } else if (U >= pe) {
              (console.log(
                `${y.red}  \u2716 Loop abort: grep pattern run ${U}\xD7 \u2014 aborting runaway search loop${y.reset}`,
              ),
                n && (n.stop(), (n = null)),
                o(null),
                Fe(G, z, ne, ae, R, { suppressHint: !0 }),
                qe(X));
              return;
            }
            if (E.args.path) {
              let ee = (ce.get(E.args.path) || 0) + 1;
              if ((ce.set(E.args.path, ee), ee === ge)) {
                let le = E.args.path.split("/").slice(-2).join("/");
                console.log(
                  `${y.yellow}  \u26A0 Loop warning: "${le}" grepped ${ee}\xD7 with different patterns \u2014 context flood risk${y.reset}`,
                );
                let me = {
                  role: "user",
                  content: `[SYSTEM WARNING] "${E.args.path}" grepped ${ee}\xD7 \u2014 file already in context. Use existing data, stop searching.`,
                };
                (X.push(me), x.push(me));
              }
            }
          }
          if (
            V &&
            (E.fnName === "bash" || E.fnName === "ssh_exec") &&
            J.includes('"valid":true')
          ) {
            {
              let U = ze();
              if (Ct(x, U).percentage >= 60) {
                let { messages: le, tokensRemoved: me } = It(x, U);
                me > 0 &&
                  ((x = le),
                  console.log(
                    `${y.dim}  [pre-stop-compress \u2014 ~${me} tokens freed before STOP injection, now ${Math.round(Ct(x, U).percentage)}%]${y.reset}`,
                  ));
              }
            }
            let I = {
              role: "user",
              content:
                '[SYSTEM STOP] Tool result contains {"valid":true}. The token/service is valid and reachable. STOP all further investigation immediately. Report to the user that the token is valid, the service is healthy, and no fix is needed. Do NOT read any more log files.',
            };
            (X.push(I),
              x.push(I),
              console.log(
                `${y.cyan}  \u2713 Health-check stop signal detected \u2014 injecting STOP instruction${y.reset}`,
              ));
          }
          if (J.startsWith("BLOCKED:")) {
            if ((cn++, cn >= ic)) {
              (console.log(
                `${y.red}  \u2716 Loop abort: ${cn} consecutive blocked calls \u2014 model not heeding BLOCKED messages${y.reset}`,
              ),
                n && (n.stop(), (n = null)),
                o(null),
                Fe(G, z, ne, ae, R, { suppressHint: !0 }),
                qe(X));
              return;
            }
          } else cn = 0;
          if (V) ((jt = 0), (Ir = !0));
          else if ((jt++, jt === Or)) {
            console.log(
              `${y.yellow}  \u26A0 Loop warning: ${jt} consecutive tool errors \u2014 possible stuck loop${y.reset}`,
            );
            let I = {
              role: "user",
              content: `[SYSTEM WARNING] ${jt} consecutive errors. Stuck loop \u2014 try fundamentally different approach or declare done.`,
            };
            (X.push(I), x.push(I));
          } else if (jt >= cm) {
            (console.log(
              `${y.red}  \u2716 Loop abort: ${jt} consecutive errors \u2014 aborting stuck loop${y.reset}`,
            ),
              n && (n.stop(), (n = null)),
              o(null),
              Fe(G, z, ne, ae, R, { suppressHint: !0 }),
              qe(X));
            return;
          }
          if (V && E.fnName === "read_file" && E.args && E.args.path) {
            ae.add(E.args.path);
            let I = (je.get(E.args.path) || 0) + 1;
            if ((je.set(E.args.path, I), E.args.line_start != null)) {
              let le = E.args.line_start || 1,
                me = E.args.line_end || le + 350;
              (Fs.has(E.args.path) || Fs.set(E.args.path, []),
                Fs.get(E.args.path).push([le, me]));
            }
            if (E._scrollWarn) {
              let { sectionCount: le, path: me } = E._scrollWarn,
                Me = {
                  role: "user",
                  content: `[SYSTEM WARNING] "${me}" \u2014 you have now read ${le} different sections of this file. This is a file-scroll pattern. Stop reading sections and use grep_search to find the specific lines you need instead.`,
                };
              (X.push(Me),
                x.push(Me),
                console.log(
                  `${y.yellow}  \u26A0 Scroll warning: "${me.split("/").slice(-2).join("/")}" \u2014 ${le} sections read \u2014 use grep instead${y.reset}`,
                ));
            }
            let U = E.args.path.split("/").slice(-2).join("/"),
              ee = !E.args?.line_start && !E.args?.line_end;
            if (ee && I === Be) {
              {
                let me = ze();
                if (Ct(x, me).percentage >= 60) {
                  let { messages: ue } = It(x, me);
                  x = ue;
                }
              }
              console.log(
                `${y.yellow}  \u26A0 Loop warning: "${U}" read unbounded ${I}\xD7 \u2014 use line_start/line_end${y.reset}`,
              );
              let le = {
                role: "user",
                content: `[SYSTEM WARNING] "${E.args.path}" read ${I}\xD7 without line ranges. Use line_start/line_end to read specific sections \u2014 do not re-read the full file.`,
              };
              (X.push(le), x.push(le));
            } else if (ee && I >= zt) {
              (console.log(
                `${y.red}  \u2716 Loop abort: "${U}" read unbounded ${I}\xD7 \u2014 aborting runaway read loop${y.reset}`,
              ),
                n && (n.stop(), (n = null)),
                o(null),
                Fe(G, z, ne, ae, R, { suppressHint: !0 }),
                qe(X));
              return;
            }
          }
          if (E.fnName === "spawn_agents") {
            let I = (J.match(/\bStatus: done\b/g) || []).length;
            if (
              (J.match(/\bStatus: truncated\b/g) || []).length > 0 &&
              I === 0
            ) {
              if ((ln++, ln === lm)) {
                console.log(
                  `${y.yellow}  \u26A0 Swarm warning: all sub-agents hit iteration limit ${ln}\xD7 in a row${y.reset}`,
                );
                let ee = {
                  role: "user",
                  content: `[SYSTEM WARNING] Sub-agents truncated ${ln}\xD7 in a row. Stop spawning \u2014 try different approach or report findings.`,
                };
                (X.push(ee), x.push(ee));
              } else if (ln >= um) {
                (console.log(
                  `${y.red}  \u2716 Swarm abort: all sub-agents hit iteration limit ${ln}\xD7 \u2014 aborting stuck swarm${y.reset}`,
                ),
                  n && (n.stop(), (n = null)),
                  o(null),
                  Fe(G, z, ne, ae, R, { suppressHint: !0 }),
                  qe(X));
                return;
              }
            } else I > 0 && (ln = 0);
          }
        }
        for (let T of fc) (X.push(T), x.push(T));
        {
          let T = ze();
          if (Ct(x, T).percentage >= 78) {
            let { messages: J, tokensRemoved: F } = It(x, T);
            F > 0 &&
              ((x = J),
              console.log(
                `${y.dim}  [auto-compressed \u2014 ~${F} tokens freed, now ${Math.round(Ct(x, T).percentage)}%]${y.reset}`,
              ));
          }
        }
        let pc = qb();
        if (pc) {
          let T = { role: "user", content: `[User note mid-run]: ${pc}` };
          (X.push(T),
            x.push(T),
            console.log(`${y.cyan}  \u270E Context added${y.reset}`));
        }
      }
      if (lt >= to) {
        (n && (n.stop(), (n = null)),
          o(null),
          Fe(G, z, ne, ae, R),
          qe(X),
          Rf(X));
        let { getActiveProviderName: De } = Ae();
        if (De() === "ollama" && Pr < ac) {
          if (ne.size === 0 && !Ir) {
            console.log(
              `${y.yellow}  \u26A0 Max iterations reached with no progress. Stopping.${y.reset}`,
            );
            break e;
          }
          (Pr++,
            (to = 20),
            console.log(
              `${y.dim}  \u2500\u2500 auto-extending (+20 turns, ext ${Pr}/${ac}) \u2500\u2500${y.reset}`,
            ));
          continue e;
        }
        if (
          (console.log(`
${y.yellow}\u26A0 Max iterations reached.${y.reset}`),
          await Lf("  Continue for 20 more turns?"))
        ) {
          to = 20;
          continue e;
        }
        console.log(
          `${y.dim}  Tip: set "maxIterations" in .nex/config.json or use --max-turns${y.reset}`,
        );
      }
      break e;
    }
  }
  Gf.exports = {
    processInput: Jb,
    clearConversation: Wb,
    getConversationLength: Hb,
    getConversationMessages: Gb,
    setConversationMessages: Kb,
    setAbortSignalGetter: _b,
    setMaxIterations: bb,
    invalidateSystemPromptCache: Ea,
    clearToolFilterCache: Cb,
    getCachedFilteredTools: qf,
    buildSystemPrompt: Hf,
    getProjectContextHash: Ff,
    buildUserContent: Df,
    detectAndTruncateLoop: ka,
    injectMidRunNote: Db,
  };
});
var Ae = K((lv, Jf) => {
  var { OllamaProvider: Vb } = Dc(),
    { OpenAIProvider: Qb } = sl(),
    { AnthropicProvider: Zb } = al(),
    { GeminiProvider: e_ } = dl(),
    { LocalProvider: t_ } = ml(),
    { checkBudget: n_ } = jn(),
    Na = {
      top: {
        ollama: "kimi-k2:1t",
        openai: "gpt-4.1",
        anthropic: "claude-sonnet-4-5",
        gemini: "gemini-2.5-pro",
      },
      strong: {
        ollama: "qwen3-coder:480b",
        openai: "gpt-4o",
        anthropic: "claude-sonnet",
        gemini: "gemini-2.5-flash",
      },
      fast: {
        ollama: "devstral-small-2:24b",
        openai: "gpt-4.1-mini",
        anthropic: "claude-haiku",
        gemini: "gemini-2.0-flash",
      },
    },
    Kf = {};
  for (let [t, e] of Object.entries(Na))
    for (let s of Object.values(e)) Kf[s] = t;
  function Yf(t, e) {
    let s = Kf[t];
    return (s && Na[s][e]) || t;
  }
  var Ge = {},
    ct = null,
    Ue = null,
    Bs = [];
  function kt() {
    if (Object.keys(Ge).length > 0) return;
    (ns("ollama", new Vb()),
      ns("openai", new Qb()),
      ns("anthropic", new Zb()),
      ns("gemini", new e_()),
      ns("local", new t_()));
    let t = process.env.DEFAULT_PROVIDER || "ollama",
      e = process.env.DEFAULT_MODEL || null;
    Ge[t]
      ? ((ct = t), (Ue = e || Ge[t].defaultModel))
      : ((ct = "ollama"), (Ue = "kimi-k2.5"));
    let s = process.env.FALLBACK_CHAIN;
    s &&
      (Bs = s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean));
  }
  function ns(t, e) {
    Ge[t] = e;
  }
  function s_(t) {
    return (kt(), Ge[t] || null);
  }
  function Ma() {
    return (kt(), Ge[ct] || null);
  }
  function o_() {
    return (kt(), ct);
  }
  function r_() {
    return (kt(), Ue);
  }
  function i_() {
    kt();
    let t = Ma();
    if (!t) return { id: Ue, name: Ue, provider: ct };
    let e = t.getModel(Ue);
    return e ? { ...e, provider: ct } : { id: Ue, name: Ue, provider: ct };
  }
  function zf(t) {
    if (!t) return { provider: null, model: null };
    let e = t.indexOf(":");
    if (e > 0) {
      let s = t.slice(0, e);
      if (
        Ge[s] ||
        ["ollama", "openai", "anthropic", "gemini", "local"].includes(s)
      )
        return { provider: s, model: t.slice(e + 1) };
    }
    return { provider: null, model: t };
  }
  function a_(t) {
    kt();
    let { provider: e, model: s } = zf(t);
    if (e) {
      let n = Ge[e];
      return n && (n.getModel(s) || e === "local" || e === "ollama")
        ? ((ct = e), (Ue = s), gr(), !0)
        : !1;
    }
    let o = Ma();
    if (o && o.getModel(s)) return ((Ue = s), gr(), !0);
    for (let [n, r] of Object.entries(Ge))
      if (r.getModel(s)) return ((ct = n), (Ue = s), gr(), !0);
    return !1;
  }
  function gr() {
    try {
      let { invalidateSystemPromptCache: t, clearToolFilterCache: e } = ve();
      (t(), e());
    } catch {}
    try {
      let { invalidateTokenRatioCache: t } = Je();
      t();
    } catch {}
  }
  function c_() {
    kt();
    let t = new Set();
    for (let e of Object.values(Ge)) for (let s of e.getModelNames()) t.add(s);
    return Array.from(t);
  }
  function l_() {
    return (
      kt(),
      Object.entries(Ge).map(([t, e]) => ({
        provider: t,
        configured: e.isConfigured(),
        models: Object.values(e.getModels()).map((s) => ({
          ...s,
          active: t === ct && s.id === Ue,
        })),
      }))
    );
  }
  function u_() {
    kt();
    let t = [];
    for (let [e, s] of Object.entries(Ge)) {
      let o = s.isConfigured();
      for (let n of Object.values(s.getModels()))
        t.push({
          spec: `${e}:${n.id}`,
          name: n.name,
          provider: e,
          configured: o,
        });
    }
    return t;
  }
  function d_(t) {
    Bs = Array.isArray(t) ? t : [];
  }
  function f_() {
    return [...Bs];
  }
  function p_(t) {
    let e = t.message || "",
      s = t.code || "";
    return !!(
      e.includes("429") ||
      e.includes("500") ||
      e.includes("502") ||
      e.includes("503") ||
      e.includes("504") ||
      s === "ECONNABORTED" ||
      s === "ETIMEDOUT" ||
      s === "ECONNREFUSED" ||
      s === "ECONNRESET" ||
      s === "EHOSTUNREACH" ||
      s === "ENETUNREACH" ||
      s === "EPIPE" ||
      s === "ERR_SOCKET_CONNECTION_TIMEOUT" ||
      e.includes("socket disconnected") ||
      e.includes("TLS") ||
      e.includes("ECONNRESET") ||
      e.includes("ECONNABORTED") ||
      e.includes("network") ||
      e.includes("ETIMEDOUT")
    );
  }
  async function Xf(t) {
    let e = [ct, ...Bs.filter((r) => r !== ct)],
      s,
      o = 0,
      n = 0;
    for (let r = 0; r < e.length; r++) {
      let i = e[r],
        c = Ge[i];
      if (!c || !c.isConfigured()) continue;
      n++;
      let l = n_(i);
      if (!l.allowed) {
        (o++,
          (s = new Error(
            `Budget limit reached for ${i}: $${l.spent.toFixed(2)} / $${l.limit.toFixed(2)}`,
          )));
        continue;
      }
      try {
        let u = r > 0,
          d = u ? Yf(Ue, i) : Ue;
        return (
          u &&
            d !== Ue &&
            process.stderr.write(`  [fallback: ${i}:${d}]
`),
          await t(c, i, d)
        );
      } catch (u) {
        if (((s = u), p_(u) && r < e.length - 1)) continue;
        throw u;
      }
    }
    throw o > 0 && o === n
      ? new Error(
          "All providers are over budget. Use /budget to check limits or /budget <provider> off to remove a limit.",
        )
      : n === 0
        ? new Error("No configured provider available")
        : s || new Error("No configured provider available");
  }
  async function m_(t, e, s = {}) {
    return (
      kt(),
      Xf((o, n, r) => o.stream(t, e, { model: r, signal: s.signal, ...s }))
    );
  }
  async function h_(t, e, s = {}) {
    if ((kt(), s.provider)) {
      let o = Ge[s.provider];
      if (!o || !o.isConfigured())
        throw new Error(`Provider '${s.provider}' is not available`);
      let n = { model: s.model || Ue, ...s };
      try {
        return await o.chat(t, e, n);
      } catch (r) {
        if (typeof o.stream == "function")
          try {
            return await o.stream(t, e, { ...n, onToken: () => {} });
          } catch {}
        throw r;
      }
    }
    return Xf(async (o, n, r) => {
      try {
        return await o.chat(t, e, { model: r, ...s });
      } catch (i) {
        if (typeof o.stream == "function")
          try {
            return await o.stream(t, e, { model: r, ...s, onToken: () => {} });
          } catch {}
        throw i;
      }
    });
  }
  function g_() {
    kt();
    let t = [];
    for (let [e, s] of Object.entries(Ge))
      s.isConfigured() &&
        t.push({ name: e, models: Object.values(s.getModels()) });
    return t;
  }
  function $_() {
    for (let t of Object.keys(Ge)) delete Ge[t];
    ((ct = null), (Ue = null), (Bs = []));
  }
  Jf.exports = {
    registerProvider: ns,
    getProvider: s_,
    getActiveProvider: Ma,
    getActiveProviderName: o_,
    getActiveModelId: r_,
    getActiveModel: i_,
    setActiveModel: a_,
    getModelNames: c_,
    parseModelSpec: zf,
    listProviders: l_,
    listAllModels: u_,
    callStream: m_,
    callChat: h_,
    getConfiguredProviders: g_,
    setFallbackChain: d_,
    getFallbackChain: f_,
    resolveModelForProvider: Yf,
    MODEL_EQUIVALENTS: Na,
    _reset: $_,
  };
});
var Ia = K((uv, Vf) => {
  "use strict";
  var Gt = require("fs"),
    $r = require("path"),
    y_ = require("readline"),
    he = "\x1B[0m",
    yr = "\x1B[1m",
    Xe = "\x1B[2m",
    wr = "\x1B[33m",
    Pa = "\x1B[36m",
    Hs = "\x1B[32m";
  function w_(t) {
    return (e, s = "") =>
      new Promise((o) => {
        let n = s ? ` ${Xe}[${s}]${he}` : "";
        t.question(`  ${Pa}${e}${n}${he}: `, (r) => o(r.trim() || s));
      });
  }
  function Gs(t, e) {
    return new Promise((s) => {
      (e && e.pause(), process.stdout.write(`  ${Pa}${t}${he}: `));
      let o = process.stdin,
        n = o.isRaw,
        r = "";
      (o.setRawMode(!0), o.resume(), o.setEncoding("utf8"));
      let i = (c) => {
        c === "\r" ||
        c ===
          `
`
          ? (o.setRawMode(n || !1),
            o.removeListener("data", i),
            process.stdout.write(`
`),
            e && e.resume(),
            s(r))
          : c === ""
            ? (process.stdout.write(`
`),
              process.exit(0))
            : c === "\x7F"
              ? r.length > 0 &&
                ((r = r.slice(0, -1)), process.stdout.write("\b \b"))
              : ((r += c), process.stdout.write("*"));
      };
      o.on("data", i);
    });
  }
  async function b_({ rl: t = null, force: e = !1 } = {}) {
    if (!e) {
      let m =
          Gt.existsSync($r.join(process.cwd(), ".env")) ||
          Gt.existsSync($r.join(__dirname, "..", ".env")),
        h =
          process.env.ANTHROPIC_API_KEY ||
          process.env.OPENAI_API_KEY ||
          process.env.GEMINI_API_KEY ||
          process.env.OPENROUTER_API_KEY,
        p = process.env.DEFAULT_PROVIDER || process.env.DEFAULT_MODEL;
      if (m || h || p) return;
    }
    let s = !t,
      o =
        t ||
        y_.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: !0,
        }),
      n = w_(o),
      r = !e;
    (console.log(),
      console.log(
        r
          ? `${wr}${yr}  \u2726 Welcome to nex-code! No configuration found.${he}`
          : `${Pa}${yr}  \u2726 nex-code \u2014 Provider & API Key Setup${he}`,
      ),
      console.log(
        `${Xe}  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${he}`,
      ),
      r &&
        console.log(`  Let's set you up in 60 seconds.
`),
      console.log(`  ${yr}Which AI provider do you want to use?${he}
`),
      console.log(
        `  ${Hs}1)${he} ${yr}Ollama Cloud${he}  ${Xe}recommended \u2014 devstral-2:123b, no API key needed${he}`,
      ),
      console.log(`  ${Xe}   (also works with a local Ollama server)${he}`),
      console.log(
        `  ${Xe}2)  Anthropic     Claude (claude-sonnet-4-6 etc.)${he}`,
      ),
      console.log(`  ${Xe}3)  OpenAI        GPT-4o, GPT-4.1 etc.${he}`),
      console.log(`  ${Xe}4)  Gemini        Google Gemini 2.x${he}`),
      console.log(`  ${Xe}5)  Skip / Cancel${he}`),
      console.log());
    let i = await n("Enter number", "1"),
      c = [];
    if (i === "5") {
      (s && o.close(),
        console.log(`
${Xe}  Cancelled \u2014 no changes made.${he}
`));
      return;
    }
    if (i === "1") {
      (console.log(),
        console.log(`
  ${Hs}Ollama Cloud${he} ${Xe}(recommended): uses ollama.com API \u2014 flat-rate, 47+ models.${he}`),
        console.log(`  ${Xe}Get your API key at: https://ollama.com/settings/api-keys${he}
`));
      let m = await Gs("OLLAMA_API_KEY (leave blank for local)", t),
        h = m
          ? "https://ollama.com"
          : await n("Ollama host", "http://localhost:11434"),
        p = await n("Default model", m ? "devstral-2:123b" : "qwen3-coder");
      (c.push(
        "DEFAULT_PROVIDER=ollama",
        `DEFAULT_MODEL=${p}`,
        `OLLAMA_HOST=${h}`,
      ),
        m && c.push(`OLLAMA_API_KEY=${m}`),
        (process.env.DEFAULT_PROVIDER = "ollama"),
        (process.env.DEFAULT_MODEL = p),
        (process.env.OLLAMA_HOST = h),
        m && (process.env.OLLAMA_API_KEY = m));
    } else if (i === "2") {
      (console.log(),
        console.log(
          `  ${Xe}Get your key: https://console.anthropic.com/settings/keys${he}`,
        ));
      let m = await Gs("ANTHROPIC_API_KEY", t);
      if (!m) {
        (s && o.close(),
          console.log(`
${wr}  No key entered \u2014 cancelled.${he}
`));
        return;
      }
      let h = await n("Default model", "claude-sonnet-4-6");
      (c.push(
        "DEFAULT_PROVIDER=anthropic",
        `DEFAULT_MODEL=${h}`,
        `ANTHROPIC_API_KEY=${m}`,
      ),
        (process.env.DEFAULT_PROVIDER = "anthropic"),
        (process.env.DEFAULT_MODEL = h),
        (process.env.ANTHROPIC_API_KEY = m));
    } else if (i === "3") {
      (console.log(),
        console.log(
          `  ${Xe}Get your key: https://platform.openai.com/api-keys${he}`,
        ));
      let m = await Gs("OPENAI_API_KEY", t);
      if (!m) {
        (s && o.close(),
          console.log(`
${wr}  No key entered \u2014 cancelled.${he}
`));
        return;
      }
      let h = await n("Default model", "gpt-4o");
      (c.push(
        "DEFAULT_PROVIDER=openai",
        `DEFAULT_MODEL=${h}`,
        `OPENAI_API_KEY=${m}`,
      ),
        (process.env.DEFAULT_PROVIDER = "openai"),
        (process.env.DEFAULT_MODEL = h),
        (process.env.OPENAI_API_KEY = m));
    } else if (i === "4") {
      (console.log(),
        console.log(
          `  ${Xe}Get your key: https://aistudio.google.com/app/apikey${he}`,
        ));
      let m = await Gs("GEMINI_API_KEY", t);
      if (!m) {
        (s && o.close(),
          console.log(`
${wr}  No key entered \u2014 cancelled.${he}
`));
        return;
      }
      let h = await n("Default model", "gemini-2.0-flash");
      (c.push(
        "DEFAULT_PROVIDER=gemini",
        `DEFAULT_MODEL=${h}`,
        `GEMINI_API_KEY=${m}`,
      ),
        (process.env.DEFAULT_PROVIDER = "gemini"),
        (process.env.DEFAULT_MODEL = h),
        (process.env.GEMINI_API_KEY = m));
    }
    if (
      (console.log(),
      (
        await n("Add Perplexity key for grounded web search? (y/N)", "n")
      ).toLowerCase() === "y")
    ) {
      console.log(
        `  ${Xe}Get your key: https://www.perplexity.ai/settings/api${he}`,
      );
      let m = await Gs("PERPLEXITY_API_KEY", t);
      m &&
        (c.push(`PERPLEXITY_API_KEY=${m}`),
        (process.env.PERPLEXITY_API_KEY = m));
    }
    console.log();
    let u = $r.join(process.cwd(), ".env"),
      d = (Gt.existsSync(u), "y"),
      f = await n(`Save to ${u}? (Y/n)`, d);
    if ((s && o.close(), f.toLowerCase() !== "n")) {
      let m = Gt.existsSync(u)
        ? Gt.readFileSync(u, "utf-8").trimEnd() +
          `

`
        : "";
      Gt.writeFileSync(
        u,
        m +
          c.join(`
`) +
          `
`,
      );
      let h = $r.join(process.cwd(), ".gitignore");
      (Gt.existsSync(h) &&
        (Gt.readFileSync(h, "utf-8")
          .split(
            `
`,
          )
          .some((g) => g.trim() === ".env") ||
          Gt.appendFileSync(
            h,
            `
.env
`,
          )),
        console.log(`
${Hs}  \u2713 Saved to ${u}${he}`),
        c.some((p) => p.includes("API_KEY")) &&
          console.log(
            `${Xe}  (key stored locally \u2014 never committed)${he}`,
          ));
    }
    if (process.env.DEFAULT_PROVIDER)
      try {
        let { setActiveModel: m } = Ae(),
          h = process.env.DEFAULT_MODEL
            ? `${process.env.DEFAULT_PROVIDER}:${process.env.DEFAULT_MODEL}`
            : process.env.DEFAULT_PROVIDER;
        (m(h),
          console.log(`${Hs}  \u2713 Switched to ${h} for this session${he}`));
      } catch {}
    console.log(`
${Hs}  \u2713 Setup complete!${he}
`);
  }
  Vf.exports = { runSetupWizard: b_ };
});
var Zf = K((dv, Qf) => {
  "use strict";
  var __ = require("readline");
  function En(t) {
    process.stdout.write(
      JSON.stringify(t) +
        `
`,
    );
  }
  function x_() {
    process.env.NEX_SERVER = "1";
    let t = (...c) =>
      process.stderr.write(
        c.map(String).join(" ") +
          `
`,
      );
    ((console.log = t), (console.warn = t), (console.info = t));
    let { setConfirmHook: e } = Ye(),
      s = new Map(),
      o = 0;
    e((c, l) => {
      let u = "cfm-" + ++o,
        d = l?.toolName || "",
        f = !1;
      try {
        let { isCritical: m } = Ye();
        f = m(c);
      } catch {}
      return (
        En({
          type: "confirm_request",
          id: u,
          question: c,
          tool: d,
          critical: f,
        }),
        new Promise((m) => {
          s.set(u, m);
        })
      );
    });
    let n = null,
      r = {
        onToken(c) {
          n && En({ type: "token", id: n, text: c });
        },
        onThinkingToken() {},
        onToolStart(c, l) {
          n && En({ type: "tool_start", id: n, tool: c, args: l || {} });
        },
        onToolEnd(c, l, u) {
          n &&
            En({ type: "tool_end", id: n, tool: c, summary: l || "", ok: !!u });
        },
      },
      i = __.createInterface({
        input: process.stdin,
        output: null,
        terminal: !1,
      });
    (En({ type: "ready" }),
      i.on("line", async (c) => {
        let l = c.trim();
        if (!l) return;
        let u;
        try {
          u = JSON.parse(l);
        } catch {
          return;
        }
        switch (u.type) {
          case "chat": {
            let d = u.id || "msg-" + Date.now();
            n = d;
            let { processInput: f } = ve();
            try {
              (await f(u.text, r), En({ type: "done", id: d }));
            } catch (m) {
              En({ type: "error", id: d, message: m?.message || String(m) });
            } finally {
              n = null;
            }
            break;
          }
          case "confirm": {
            let d = s.get(u.id);
            d && (s.delete(u.id), d(!!u.answer));
            break;
          }
          case "cancel": {
            for (let [d, f] of s) (s.delete(d), f(!1));
            break;
          }
          case "clear": {
            let { clearConversation: d } = ve();
            d();
            for (let [f, m] of s) (s.delete(f), m(!1));
            break;
          }
          default:
            break;
        }
      }),
      i.on("close", () => {
        process.exit(0);
      }));
  }
  Qf.exports = { startServerMode: x_ };
});
var sp = K((fv, np) => {
  "use strict";
  var br = require("fs"),
    { T: Ot, isDark: k_ } = dn(),
    ht = "\x1B[0m",
    v_ = !k_,
    S_ = process.env.FOOTER_DEBUG === "1" || process.env.FOOTER_DEBUG === "2",
    E_ = process.env.FOOTER_DEBUG === "2",
    ss = null;
  function an(...t) {
    S_ &&
      (ss || (ss = br.openSync("/tmp/footer-debug.log", "w")),
      br.writeSync(
        ss,
        t.join(" ") +
          `
`,
      ));
  }
  function ep(t, e) {
    if (!E_ || typeof e != "string") return;
    ss || (ss = br.openSync("/tmp/footer-debug.log", "w"));
    let s = e
      .replace(/\x1b\[([^a-zA-Z]*)([a-zA-Z])/g, (o, n, r) => `<ESC[${n}${r}>`)
      .replace(/\x1b([^[])/g, (o, n) => `<ESC${n}>`)
      .replace(/\r/g, "<CR>")
      .replace(
        /\n/g,
        `<LF>
`,
      )
      .replace(
        /[\x00-\x08\x0b-\x1f\x7f]/g,
        (o) => `<${o.charCodeAt(0).toString(16).padStart(2, "0")}>`,
      );
    br.writeSync(
      ss,
      `${t}: ${s}
`,
    );
  }
  function tp(t) {
    return t.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, "").length;
  }
  var La = class {
    constructor() {
      ((this._active = !1),
        (this._rl = null),
        (this._origWrite = null),
        (this._origPrompt = null),
        (this._origSetPr = null),
        (this._origRefreshLine = null),
        (this._origLog = null),
        (this._origError = null),
        (this._origStderrWrite = null),
        (this._drawing = !1),
        (this._offResize = null),
        (this._cursorOnInputRow = !1),
        (this._inRefreshLine = !1),
        (this._lastOutputRow = 1),
        (this._prevTermRows = 0),
        (this._prevTermCols = 0),
        (this._consistencyTimer = null),
        (this._dirty = !1),
        (this._statusModel = ""),
        (this._statusBranch = ""),
        (this._statusProject = ""),
        (this._statusMode = ""));
    }
    setStatusInfo({ model: e, branch: s, project: o, mode: n } = {}) {
      (e !== void 0 && (this._statusModel = e),
        s !== void 0 && (this._statusBranch = s),
        o !== void 0 && (this._statusProject = o),
        n !== void 0 && (this._statusMode = n),
        this._active && this.drawFooter());
    }
    get _rows() {
      return process.stdout.rows || 24;
    }
    get _cols() {
      return process.stdout.columns || 80;
    }
    get _scrollEnd() {
      return this._rows - 2;
    }
    get _rowStatus() {
      return this._rows - 1;
    }
    get _rowInput() {
      return this._rows;
    }
    _goto(e, s = 1) {
      return `\x1B[${e};${s}H`;
    }
    _statusLine() {
      let e = this._cols,
        s = this._statusModel,
        o = this._statusBranch,
        n = this._statusProject,
        r = this._statusMode;
      if (!s) return Ot.footer_sep + "\u2500".repeat(e) + ht;
      let i = ` ${Ot.footer_divider}\xB7${ht} `,
        c = [];
      (s && c.push(`${Ot.footer_model}${s}${ht}`),
        o && c.push(`${Ot.footer_branch}${o}${ht}`),
        n && c.push(`${Ot.footer_project}${n}${ht}`));
      let l = c.join(i),
        u = [s, o, n].filter(Boolean).join(" \xB7 ").length,
        d = "\u2500 ";
      if (r) {
        let h = r.length,
          p = Math.max(0, e - d.length - u - 1 - 1 - h - 3),
          g = "\u2500".repeat(p);
        return `${Ot.footer_sep}${d}${ht}${l}${Ot.footer_sep} ${g} ${ht}${Ot.footer_mode}${r}${ht}${Ot.footer_sep} \u2500\u2500${ht}`;
      }
      let f = Math.max(0, e - d.length - u - 2),
        m = "\u2500".repeat(f);
      return `${Ot.footer_sep}${d}${ht}${l}${Ot.footer_sep} ${m}${ht}`;
    }
    drawFooter(e) {
      !this._origWrite ||
        this._drawing ||
        ((this._drawing = !0),
        this._origWrite(
          "\x1B7" +
            this._goto(this._rowStatus) +
            "\x1B[2K" +
            this._statusLine(e) +
            "\x1B8",
        ),
        (this._drawing = !1));
    }
    _setScrollRegion() {
      if (v_) return;
      let e = Math.max(1, this._scrollEnd);
      this._origWrite(`\x1B[1;${e}r`);
    }
    _clearScrollRegion() {
      this._origWrite && this._origWrite("\x1B[r");
    }
    _eraseStatus() {
      this._origWrite &&
        this._origWrite("\x1B7" + this._goto(this._rowStatus) + "\x1B[2K\x1B8");
    }
    rawWrite(e) {
      return (
        ep("RAW", e),
        this._origWrite ? this._origWrite(e) : process.stdout.write(e)
      );
    }
    _relayout(e) {
      if (!this._origWrite) return;
      let s = this._origWrite,
        o = this._rows,
        n = this._cols,
        r = Math.max(1, o - 2);
      (an(
        "RELAYOUT:",
        e,
        "rows=" + o,
        "cols=" + n,
        "scrollEnd=" + r,
        "cursorOnInput=" + this._cursorOnInputRow,
      ),
        (this._prevTermRows = o),
        (this._prevTermCols = n));
      let i = Math.min(this._lastOutputRow + 1, r + 1),
        c = "";
      for (let l = i; l <= o; l++) c += this._goto(l) + "\x1B[2K";
      (s(c),
        this._setScrollRegion(),
        (this._lastOutputRow = Math.min(this._lastOutputRow, r)),
        this.drawFooter(),
        this._cursorOnInputRow && this._rl && this._rl.prompt(!0),
        (this._dirty = !1));
    }
    activate(e) {
      if (!process.stdout.isTTY) return;
      ((this._rl = e),
        (this._origWrite = process.stdout.write.bind(process.stdout)),
        (this._active = !0),
        (this._prevTermRows = this._rows),
        (this._prevTermCols = this._cols),
        this._origWrite("\x1B[r"),
        this._setScrollRegion(),
        (this._lastOutputRow = 1),
        this.drawFooter());
      let s = this,
        o = process.stdout.write.bind(process.stdout);
      ((this._origWrite = o),
        (process.stdout.write = function (p, ...g) {
          if ((ep("PATCH", p), !s._active || typeof p != "string"))
            return o(p, ...g);
          if (s._inRefreshLine) {
            let v = p.replace(/\n/g, "");
            return v ? o(v, ...g) : !0;
          }
          if (s._cursorOnInputRow)
            if (
              p.includes(`
`) &&
              p.length > 4 &&
              !p.includes("\r")
            )
              (an(
                "STDOUT: agent output, leaving input row, data=" +
                  JSON.stringify(p).slice(0, 100),
              ),
                (s._cursorOnInputRow = !1),
                o(s._goto(Math.min(s._lastOutputRow + 1, s._scrollEnd))));
            else {
              if (
                p.length <= 4 &&
                !p.includes(`
`) &&
                !p.includes("\r") &&
                !/[\x00-\x1f\x7f]/.test(p)
              )
                return (
                  an("STDOUT: char intercept:", JSON.stringify(p)),
                  s._origRefreshLine && s._doRefreshLine(),
                  !0
                );
              {
                let v = p.replace(/\n/g, "");
                return v ? o(v, ...g) : !0;
              }
            }
          let $ = s._cols || 80,
            w = 0,
            _ = p.split(`
`);
          for (let v = 0; v < _.length; v++) {
            let b = tp(_[v]);
            b > 0 && (w += Math.floor((b - 1) / $));
          }
          let x = _.length - 1;
          return (
            x + w > 0 &&
              (s._lastOutputRow = Math.min(
                s._lastOutputRow + x + w,
                s._scrollEnd,
              )),
            o(p, ...g)
          );
        }),
        (this._cursorOnInputRow = !1),
        (this._origStderrWrite = process.stderr.write.bind(process.stderr)),
        (process.stderr.write = function (p, ...g) {
          if (!s._active) return s._origStderrWrite(p, ...g);
          if (typeof p == "string" && p.includes("\r")) {
            let $ = Math.min(s._lastOutputRow + 1, s._scrollEnd);
            if (s._cursorOnInputRow) {
              (s._origWrite("\x1B7"), s._origWrite(s._goto($)));
              let w = s._origStderrWrite(p, ...g);
              return (s._origWrite("\x1B8"), w);
            }
            s._origWrite(s._goto($));
          }
          return s._origStderrWrite(p, ...g);
        }),
        (this._origLog = console.log),
        (this._origError = console.error));
      function n(...p) {
        if (!s._active) {
          s._origLog(...p);
          return;
        }
        (s._origWrite(s._goto(Math.min(s._lastOutputRow + 1, s._scrollEnd))),
          (s._cursorOnInputRow = !1),
          s._origLog(...p),
          s.drawFooter(),
          o(s._goto(s._rowInput) + "\x1B[2K"),
          (s._cursorOnInputRow = !0));
      }
      function r(...p) {
        if (!s._active) {
          s._origError(...p);
          return;
        }
        (s._origWrite(s._goto(Math.min(s._lastOutputRow + 1, s._scrollEnd))),
          (s._cursorOnInputRow = !1),
          s._origError(...p),
          s.drawFooter(),
          o(s._goto(s._rowInput) + "\x1B[2K"),
          (s._cursorOnInputRow = !0));
      }
      ((console.log = n),
        (console.error = r),
        (this._origSetPr = e.setPrompt.bind(e)),
        (e.setPrompt = function (p) {
          (s._origSetPr(p), s._active && s.drawFooter(p));
        }),
        (this._origPrompt = e.prompt.bind(e)),
        (e.prompt = function (p) {
          if (!s._active) return s._origPrompt(p);
          (an("PROMPT: goto rowInput=" + s._rowInput),
            (e.prevRows = 0),
            o(s._goto(s._rowInput) + ht + "\x1B[2K"),
            (s._cursorOnInputRow = !0),
            s._origPrompt(p));
        }));
      let i = e.question.bind(e);
      e.question = function (p, g) {
        if (!s._active) return i(p, g);
        (o(s._goto(s._rowInput) + "\x1B[2K"),
          (e.prevRows = 0),
          (s._cursorOnInputRow = !0),
          i(p, ($) => {
            (o(s._goto(s._rowInput) + "\x1B[2K"),
              (s._cursorOnInputRow = !1),
              s.drawFooter(),
              g($));
          }));
      };
      let c = Object.getPrototypeOf(e),
        l = Object.getOwnPropertySymbols(c).find(
          (p) => p.toString() === "Symbol(_refreshLine)",
        ),
        u = l ? c[l].bind(e) : e._refreshLine ? e._refreshLine.bind(e) : null;
      if (
        ((this._origRefreshLine = u),
        (this._doRefreshLine = function () {
          if (!s._active || !u) return;
          if (s._rows !== s._prevTermRows || s._cols !== s._prevTermCols) {
            s._dirty = !0;
            return;
          }
          ((e.prevRows = 0), o(s._goto(s._rowInput) + ht + "\x1B[2K"));
          let p = s._cols,
            g = e._prompt || "",
            $ = tp(g),
            w = p - $ - 1;
          s._inRefreshLine = !0;
          try {
            if (e.line.length <= w) {
              (an("REFRESH: short line, len=" + e.line.length), u());
              return;
            }
            an("REFRESH: long line, len=" + e.line.length + ", max=" + w);
            let _ = e.line,
              x = e.cursor,
              v = Math.max(1, w - 1),
              b = Math.max(0, x - v),
              k = (b > 0 ? "\xAB" : "") + _.slice(b, b + v + (b > 0 ? 0 : 1));
            ((e.line = k),
              (e.cursor = k.length),
              u(),
              (e.line = _),
              (e.cursor = x));
          } finally {
            s._inRefreshLine = !1;
          }
        }),
        u)
      ) {
        let p = this._doRefreshLine;
        (l &&
          Object.defineProperty(e, l, {
            value: p,
            writable: !0,
            configurable: !0,
          }),
          (e._refreshLine = p));
      }
      e.on("line", () => {
        s._active &&
          (an("LINE: leaving input row"),
          (s._cursorOnInputRow = !1),
          o(s._goto(s._rowInput) + "\x1B[2K"),
          o(s._goto(Math.min(s._lastOutputRow + 1, s._scrollEnd))),
          s.drawFooter());
      });
      let d = null,
        f = null,
        m = () => {
          ((d = null),
            s._relayout("resize"),
            f && clearTimeout(f),
            (f = setTimeout(() => {
              ((f = null), s._relayout("resize-cleanup"));
            }, 300)));
        },
        h = () => {
          ((s._dirty = !0), d && clearTimeout(d), (d = setTimeout(m, 80)));
        };
      (process.stdout.on("resize", h),
        (this._offResize = () => {
          (process.stdout.off("resize", h),
            d && (clearTimeout(d), (d = null)),
            f && (clearTimeout(f), (f = null)));
        }),
        (this._consistencyTimer = setInterval(() => {
          if (!s._active) return;
          let p = s._rows,
            g = s._cols;
          (s._dirty || p !== s._prevTermRows || g !== s._prevTermCols) &&
            (an(
              "CONSISTENCY: dirty=" +
                s._dirty +
                " rows=" +
                p +
                "/" +
                s._prevTermRows +
                " cols=" +
                g +
                "/" +
                s._prevTermCols,
            ),
            s._relayout("consistency"));
        }, 800)));
    }
    deactivate() {
      if (this._active) {
        if (
          ((this._active = !1),
          this._offResize && (this._offResize(), (this._offResize = null)),
          this._consistencyTimer &&
            (clearInterval(this._consistencyTimer),
            (this._consistencyTimer = null)),
          this._origStderrWrite &&
            ((process.stderr.write = this._origStderrWrite),
            (this._origStderrWrite = null)),
          this._origLog &&
            ((console.log = this._origLog), (this._origLog = null)),
          this._origError &&
            ((console.error = this._origError), (this._origError = null)),
          this._origWrite && (process.stdout.write = this._origWrite),
          this._rl &&
            (this._origPrompt &&
              ((this._rl.prompt = this._origPrompt), (this._origPrompt = null)),
            this._origSetPr &&
              ((this._rl.setPrompt = this._origSetPr),
              (this._origSetPr = null)),
            this._origRefreshLine))
        ) {
          let e = Object.getOwnPropertySymbols(
            Object.getPrototypeOf(this._rl),
          ).find((s) => s.toString() === "Symbol(_refreshLine)");
          (e && delete this._rl[e],
            delete this._rl._refreshLine,
            (this._origRefreshLine = null));
        }
        (this._eraseStatus(),
          this._clearScrollRegion(),
          (this._origWrite = null));
      }
    }
  };
  np.exports = { StickyFooter: La };
});
var ip = K((pv, rp) => {
  var { C: Te } = Ce(),
    {
      listProviders: T_,
      getActiveProviderName: R_,
      getActiveModelId: C_,
      setActiveModel: A_,
    } = Ae();
  function op(t, e, s = {}) {
    let {
      title: o = "Select",
      hint: n = "\u2191\u2193 navigate \xB7 Enter select \xB7 Esc cancel",
    } = s;
    return new Promise((r) => {
      let i = e.map((w, _) => (w.isHeader ? -1 : _)).filter((w) => w >= 0);
      if (i.length === 0) {
        r(null);
        return;
      }
      let c = e.findIndex((w) => w.isCurrent),
        l = c >= 0 ? i.indexOf(c) : 0;
      l < 0 && (l = 0);
      let u = process.stdout.rows ? Math.max(process.stdout.rows - 6, 5) : 20,
        d = 0;
      function f() {
        let w = i[l];
        return (
          w < d ? (d = w) : w >= d + u && (d = w - u + 1),
          { start: d, end: Math.min(e.length, d + u) }
        );
      }
      let m = 0;
      function h() {
        if (m > 0) {
          process.stdout.write(`\x1B[${m}A`);
          for (let b = 0; b < m; b++)
            process.stdout.write(`\x1B[2K
`);
          process.stdout.write(`\x1B[${m}A`);
        }
        let w = [];
        (w.push(`  ${Te.bold}${Te.cyan}${o}${Te.reset}`),
          w.push(`  ${Te.dim}${n}${Te.reset}`),
          w.push(""));
        let { start: _, end: x } = f();
        _ > 0 && w.push(`  ${Te.dim}\u2191 more${Te.reset}`);
        for (let b = _; b < x; b++) {
          let k = e[b];
          if (k.isHeader) {
            w.push(`  ${Te.bold}${Te.dim}${k.label}${Te.reset}`);
            continue;
          }
          let A = i[l] === b,
            O = A ? `${Te.cyan}> ` : "  ",
            P = k.isCurrent ? ` ${Te.yellow}<current>${Te.reset}` : "";
          A
            ? w.push(`${O}${Te.bold}${k.label}${Te.reset}${P}`)
            : w.push(`${O}${Te.dim}${k.label}${Te.reset}${P}`);
        }
        x < e.length && w.push(`  ${Te.dim}\u2193 more${Te.reset}`);
        let v = w.join(`
`);
        (process.stdout.write(
          v +
            `
`,
        ),
          (m = w.length));
      }
      t.pause();
      let p = process.stdin.isRaw;
      (process.stdin.isTTY && process.stdin.setRawMode(!0),
        process.stdin.resume());
      function g() {
        (process.stdin.removeListener("keypress", $),
          process.stdin.isTTY && p !== void 0 && process.stdin.setRawMode(p),
          t.resume());
      }
      function $(w, _) {
        if (_) {
          if (_.name === "up" || (_.ctrl && _.name === "p")) {
            l > 0 && (l--, h());
            return;
          }
          if (_.name === "down" || (_.ctrl && _.name === "n")) {
            l < i.length - 1 && (l++, h());
            return;
          }
          if (_.name === "return") {
            let x = e[i[l]];
            (g(), r(x ? x.value : null));
            return;
          }
          if (_.name === "escape" || (_.ctrl && _.name === "c")) {
            (g(), r(null));
            return;
          }
        }
      }
      (process.stdin.on("keypress", $), h());
    });
  }
  async function O_(t) {
    let e = T_(),
      s = R_(),
      o = C_(),
      n = [];
    for (let i of e)
      if (i.models.length !== 0) {
        n.push({ label: i.provider, value: null, isHeader: !0 });
        for (let c of i.models) {
          let l = i.provider === s && c.id === o;
          n.push({
            label: `  ${c.name} (${i.provider}:${c.id})`,
            value: `${i.provider}:${c.id}`,
            isCurrent: l,
          });
        }
      }
    let r = await op(t, n, { title: "Select Model" });
    return r
      ? (A_(r), console.log(`${Te.green}Switched to ${r}${Te.reset}`), !0)
      : (console.log(`${Te.dim}Cancelled${Te.reset}`), !1);
  }
  rp.exports = { pickFromList: op, showModelPicker: O_ };
});
var Da = K((hv, mp) => {
  var ap = require("fs"),
    N_ = require("path"),
    { atomicWrite: M_, withFileLockSync: P_ } = Qt(),
    { callChat: cp } = Ae(),
    { remember: I_, listMemories: mv, recall: L_ } = rn(),
    ja = 4,
    j_ = `You are a memory optimization agent for an AI coding assistant called nex-code.
Analyze this conversation history and extract actionable learnings the assistant should remember.

Return ONLY valid JSON in this exact format:
{
  "memories": [
    { "key": "snake_case_key", "value": "concise actionable value" }
  ],
  "nex_additions": [
    "- Instruction line to add to project NEX.md"
  ],
  "summary": "1-2 sentence description of what was done this session"
}

Focus on extracting:
1. CORRECTIONS: User corrected the AI ("no, not like that", "always use X", "never do Y", "stop doing Z")
2. PREFERENCES: Explicit style/tool/workflow preferences stated ("I prefer X", "use Y for Z", "always do W")
3. PROJECT CONVENTIONS: Discovered project-specific rules, file patterns, naming conventions
4. TECH STACK FACTS: Specific versions, frameworks, patterns used in this project

Rules:
- ONLY extract HIGH-CONFIDENCE learnings (user was explicit, not guessed)
- key: snake_case, max 30 chars, unique and descriptive
- value: concise actionable instruction, max 120 chars
- nex_additions: project-level instructions/conventions only (not personal preferences)
- If nothing significant to learn, return {"memories": [], "nex_additions": [], "summary": "..."}
- Return ONLY the JSON, no markdown, no explanation`;
  function lp(t) {
    return t
      .filter(
        (e) =>
          (e.role === "user" || e.role === "assistant") &&
          typeof e.content == "string" &&
          e.content.trim().length > 10,
      )
      .slice(-40)
      .map((e) => `[${e.role.toUpperCase()}]: ${e.content.substring(0, 700)}`)
      .join(`

`);
  }
  async function up(t) {
    if (t.filter((n) => n.role === "user").length < ja)
      return { memories: [], nex_additions: [], summary: null, skipped: !0 };
    let s = lp(t);
    if (!s.trim())
      return { memories: [], nex_additions: [], summary: null, skipped: !0 };
    let o = [
      { role: "system", content: j_ },
      {
        role: "user",
        content: `Conversation to analyze:

${s}`,
      },
    ];
    try {
      let i = (
        (await cp(o, [], { temperature: 0, maxTokens: 800 })).content || ""
      )
        .trim()
        .match(/\{[\s\S]*\}/);
      if (!i)
        return {
          memories: [],
          nex_additions: [],
          summary: null,
          error: "No JSON in response",
        };
      let c = JSON.parse(i[0]);
      return {
        memories: Array.isArray(c.memories) ? c.memories : [],
        nex_additions: Array.isArray(c.nex_additions) ? c.nex_additions : [],
        summary: typeof c.summary == "string" ? c.summary : null,
      };
    } catch (n) {
      return {
        memories: [],
        nex_additions: [],
        summary: null,
        error: n.message,
      };
    }
  }
  function dp(t) {
    let e = [];
    for (let { key: s, value: o } of t || []) {
      if (!s || !o || typeof s != "string" || typeof o != "string") continue;
      let n = s.trim().replace(/\s+/g, "-").substring(0, 60),
        r = o.trim().substring(0, 200);
      if (!n || !r) continue;
      let i = L_(n);
      i !== r &&
        (I_(n, r),
        e.push({ key: n, value: r, action: i ? "updated" : "added" }));
    }
    return e;
  }
  function fp(t) {
    if (!t || t.length === 0) return [];
    let e = N_.join(process.cwd(), "NEX.md");
    return P_(e, () => {
      let s = "";
      try {
        ap.existsSync(e) && (s = ap.readFileSync(e, "utf-8"));
      } catch {}
      let o = [],
        n = s;
      for (let r of t) {
        if (!r || typeof r != "string") continue;
        let i = r.trim();
        if (!i) continue;
        let c = i.substring(0, 35).toLowerCase();
        s.toLowerCase().includes(c) ||
          (o.push(i),
          (n = n
            ? n.endsWith(`
`)
              ? n + i
              : n +
                `
` +
                i
            : i));
      }
      return (
        o.length > 0 &&
          (n.endsWith(`
`) ||
            (n += `
`),
          M_(e, n)),
        o
      );
    });
  }
  async function D_(t) {
    let e = await up(t);
    if (e.skipped)
      return { applied: [], nexAdded: [], summary: null, skipped: !0 };
    if (e.error)
      return { applied: [], nexAdded: [], summary: null, error: e.error };
    let s = dp(e.memories),
      o = fp(e.nex_additions);
    return { applied: s, nexAdded: o, summary: e.summary };
  }
  var q_ = `You are a knowledge base agent for an AI coding assistant called nex-code.
Analyze this conversation and extract knowledge worth persisting in the project knowledge base (.nex/brain/).

Return ONLY valid JSON in this exact format:
{
  "documents": [
    {
      "name": "kebab-case-name",
      "content": "# Title\\n\\nMarkdown content with details...",
      "reason": "one sentence: why this is worth persisting"
    }
  ],
  "skip_reason": "why nothing was extracted (only if documents is empty)"
}

Extract documents ONLY for these categories:
1. ARCHITECTURE DECISIONS \u2014 How the system is structured, why certain choices were made
2. DEBUGGING INSIGHTS \u2014 Non-obvious bugs, error patterns, tricky workarounds discovered this session
3. API QUIRKS \u2014 Undocumented behaviors, edge cases of libraries/frameworks/services used
4. DEPLOYMENT PATTERNS \u2014 Steps, configs, sequences required to deploy/run the system
5. CODE CONVENTIONS \u2014 Project-specific patterns beyond what's obviously in the codebase

Rules:
- ONLY extract if the information is genuinely reusable in future sessions
- Do NOT extract session-specific context ("we decided today...") \u2014 only durable facts and patterns
- Do NOT extract trivial information (e.g. "the project uses React")
- Do NOT duplicate what's clearly in README, package.json, or NEX.md
- name: kebab-case, max 40 chars, descriptive (e.g. "jwt-redis-caching", "docker-deploy-sequence")
- content: proper Markdown \u2014 use headings (#), lists (-), code blocks (\`\`\`). Include YAML frontmatter with tags if helpful:
  ---
  tags: [auth, redis, caching]
  ---
- Maximum 3 documents per session. Quality over quantity.
- If nothing worth persisting: return {"documents": [], "skip_reason": "..."}
- Return ONLY the JSON, no markdown fences, no explanation`;
  async function pp(t) {
    if (t.filter((n) => n.role === "user").length < ja)
      return { documents: [], skip_reason: "Session too short" };
    let s = lp(t);
    if (!s.trim()) return { documents: [], skip_reason: "No usable content" };
    let o = [
      { role: "system", content: q_ },
      {
        role: "user",
        content: `Conversation to analyze:

${s}`,
      },
    ];
    try {
      let i = (
        (await cp(o, [], { temperature: 0, maxTokens: 2e3 })).content || ""
      )
        .trim()
        .match(/\{[\s\S]*\}/);
      if (!i) return { documents: [], error: "No JSON in response" };
      let c = JSON.parse(i[0]);
      return {
        documents: Array.isArray(c.documents) ? c.documents : [],
        skip_reason: c.skip_reason,
      };
    } catch (n) {
      return { documents: [], error: n.message };
    }
  }
  async function F_(t) {
    let e = await pp(t);
    if (e.error) return { written: [], skipped: [], error: e.error };
    if (!e.documents || e.documents.length === 0)
      return { written: [], skipped: [], skip_reason: e.skip_reason };
    let { writeDocument: s, readDocument: o } = Ss(),
      n = [],
      r = [];
    for (let i of e.documents) {
      if (!i.name || !i.content) continue;
      let c = i.name
        .trim()
        .replace(/\.md$/, "")
        .replace(/[^a-z0-9-]/g, "-")
        .substring(0, 60);
      if (!c) continue;
      let l = o(c);
      if (l.content) {
        let d = `

## Update ${new Date().toISOString().split("T")[0]}

${i.content}`;
        (s(c, l.content + d),
          n.push({ name: c, reason: i.reason || "", action: "updated" }));
      } else
        (s(c, i.content),
          n.push({ name: c, reason: i.reason || "", action: "created" }));
    }
    return { written: n, skipped: r };
  }
  mp.exports = {
    learnFromSession: D_,
    learnBrainFromSession: F_,
    reflectOnSession: up,
    reflectBrain: pp,
    applyMemories: dp,
    applyNexAdditions: fp,
    LEARN_MIN_MESSAGES: ja,
  };
});
var yp = K(($v, $p) => {
  var Ze = require("fs"),
    rs = require("path"),
    gv = require("os"),
    U_ = require("readline"),
    { C: H } = Ce(),
    hp = ".nex",
    qa = null;
  function W_(t) {
    qa = t;
  }
  function et(t, e = "") {
    let s = e ? ` ${H.dim}[${e}]${H.reset}` : "",
      o = `  ${H.cyan}${t}${s}${H.reset}: `;
    return new Promise((n) => {
      let r = (i) => {
        let c = i.trim() || e;
        n(c);
      };
      if (qa) qa.question(o, r);
      else {
        let i = U_.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        i.question(o, (c) => {
          (i.close(), r(c));
        });
      }
    });
  }
  function os(t, e = !0) {
    return et(`${t} (${e ? "Y/n" : "y/N"})`, e ? "y" : "n").then(
      (o) => o.toLowerCase() !== "n" && o.toLowerCase() !== "no",
    );
  }
  async function Fa(t, e, s) {
    let o = e.map((c, l) => `${H.dim}${l + 1})${H.reset} ${c}`).join("  ");
    (console.log(`  ${H.cyan}${t}${H.reset}`), console.log(`  ${o}`));
    let n = s ? e.indexOf(s) + 1 : 1,
      r = await et("Enter number", String(n)),
      i = parseInt(r, 10) - 1;
    return e[Math.max(0, Math.min(i, e.length - 1))];
  }
  async function B_() {
    let t = rs.join(process.cwd(), hp),
      e = rs.join(t, "servers.json"),
      s = {};
    if (Ze.existsSync(e))
      try {
        s = JSON.parse(Ze.readFileSync(e, "utf-8"));
      } catch {}
    (console.log(`
${H.bold}${H.cyan}\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557${H.reset}`),
      console.log(
        `${H.bold}${H.cyan}\u2551   nex-code Server Setup Wizard       \u2551${H.reset}`,
      ),
      console.log(`${H.bold}${H.cyan}\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D${H.reset}
`));
    let o = Object.keys(s);
    if (
      o.length > 0 &&
      (console.log(`${H.dim}Existing profiles: ${o.join(", ")}${H.reset}`),
      !(await os("Add or update a server profile?", !0)))
    ) {
      console.log(`${H.dim}No changes made.${H.reset}
`);
      return;
    }
    let n = { ...s },
      r = !0;
    for (; r; ) {
      console.log(`
${H.bold}\u2500\u2500\u2500 New Server Profile \u2500\u2500\u2500${H.reset}`);
      let l = await et("Profile name (e.g. prod, staging, macbook)");
      if (!l) {
        console.log(`${H.red}  Name is required.${H.reset}`);
        continue;
      }
      let u = await et("Host / IP address");
      if (!u) {
        console.log(`${H.red}  Host is required.${H.reset}`);
        continue;
      }
      let d = await et("SSH user", "root"),
        f = await et("SSH port", "22"),
        m = parseInt(f, 10) || 22,
        h = await et("SSH key path (leave empty for SSH agent)", ""),
        p = await Fa(
          "Operating system",
          ["almalinux9", "macos", "ubuntu", "debian", "other"],
          "almalinux9",
        ),
        g = await os("Allow sudo commands?", !0),
        $ = { host: u, user: d };
      (m !== 22 && ($.port = m),
        h && ($.key = h),
        p !== "other" && ($.os = p),
        g && ($.sudo = !0),
        (n[l] = $),
        console.log(`
  ${H.green}\u2713${H.reset} Profile "${l}" added: ${d}@${u}${m !== 22 ? `:${m}` : ""}${p !== "other" ? ` [${p}]` : ""}`),
        (r = await os(
          `
Add another server?`,
          !1,
        )));
    }
    (Ze.existsSync(t) || Ze.mkdirSync(t, { recursive: !0 }),
      Ze.writeFileSync(
        e,
        JSON.stringify(n, null, 2) +
          `
`,
        "utf-8",
      ),
      console.log(`
${H.green}\u2713 Saved .nex/servers.json (${Object.keys(n).length} profile${Object.keys(n).length !== 1 ? "s" : ""})${H.reset}`));
    let i = rs.join(process.cwd(), ".gitignore");
    (Ze.existsSync(i) &&
      (Ze.readFileSync(i, "utf-8").includes(".nex/") ||
        ((await os("Add .nex/ to .gitignore?", !0)) &&
          (Ze.appendFileSync(
            i,
            `
# nex-code server profiles
.nex/
`,
          ),
          console.log(
            `${H.green}\u2713 Added .nex/ to .gitignore${H.reset}`,
          )))),
      (await os(
        `
Set up deploy configs (.nex/deploy.json)?`,
        !1,
      )) && (await gp(n, t)),
      console.log(`
${H.dim}Use /servers to list profiles, /servers ping to check connectivity.${H.reset}
`));
  }
  async function gp(t, e) {
    let s = e || rs.join(process.cwd(), hp),
      o = rs.join(s, "deploy.json"),
      n = {};
    if (Ze.existsSync(o))
      try {
        n = JSON.parse(Ze.readFileSync(o, "utf-8"));
      } catch {}
    if (!t) {
      let u = rs.join(s, "servers.json");
      if (Ze.existsSync(u))
        try {
          t = JSON.parse(Ze.readFileSync(u, "utf-8"));
        } catch {
          t = {};
        }
      else t = {};
    }
    let r = Object.keys(t);
    (console.log(`
${H.bold}${H.cyan}\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557${H.reset}`),
      console.log(
        `${H.bold}${H.cyan}\u2551   Deploy Config Wizard               \u2551${H.reset}`,
      ),
      console.log(`${H.bold}${H.cyan}\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D${H.reset}
`));
    let i = Object.keys(n);
    i.length > 0 &&
      console.log(`${H.dim}Existing deploy configs: ${i.join(", ")}${H.reset}`);
    let c = { ...n },
      l = !0;
    for (; l; ) {
      console.log(`
${H.bold}\u2500\u2500\u2500 New Deploy Config \u2500\u2500\u2500${H.reset}`);
      let u = await et("Config name (e.g. prod, staging)");
      if (!u) {
        console.log(`${H.red}  Name is required.${H.reset}`);
        continue;
      }
      let d;
      r.length > 0
        ? (d = await Fa("Target server", r, r[0]))
        : (d = await et("Target server (profile name or user@host)"));
      let f = await Fa("Deploy method", ["rsync", "git"], "rsync"),
        m = "",
        h = [],
        p = "";
      if (f === "rsync") {
        m = await et("Local path to sync (e.g. dist/ or ./build)", "dist/");
        let v = await et(
          "Exclude paths (comma-separated, e.g. node_modules,.env)",
          "node_modules,.env",
        );
        h = v
          ? v
              .split(",")
              .map((b) => b.trim())
              .filter(Boolean)
          : [];
      } else
        p = await et(
          "Branch to pull (leave empty for current remote branch)",
          "main",
        );
      let g = await et(
        f === "git"
          ? "Remote repo path (e.g. /home/jarvis/my-app)"
          : "Remote destination path (e.g. /var/www/app)",
      );
      if (!g) {
        console.log(`${H.red}  Remote path is required.${H.reset}`);
        continue;
      }
      let $ = await et(
          "Command to run on remote after deploy (leave empty to skip)",
          "",
        ),
        w = await et(
          "Health check URL or remote command (leave empty to skip)",
          "",
        ),
        _ = { server: d, method: f, remote_path: g };
      (f === "rsync"
        ? ((_.local_path = m), h.length > 0 && (_.exclude = h))
        : p && (_.branch = p),
        $ && (_.deploy_script = $),
        w && (_.health_check = w),
        (c[u] = _));
      let x =
        f === "git"
          ? `${d}:${g}${p ? ` (${p})` : ""}`
          : `${m.endsWith("/") ? m : m + "/"} \u2192 ${d}:${g}`;
      (console.log(`
  ${H.green}\u2713${H.reset} Deploy config "${u}": [${f}] ${x}`),
        $ && console.log(`  ${H.dim}  Then: ${$}${H.reset}`),
        w && console.log(`  ${H.dim}  Health: ${w}${H.reset}`),
        (l = await os(
          `
Add another deploy config?`,
          !1,
        )));
    }
    (Ze.existsSync(s) || Ze.mkdirSync(s, { recursive: !0 }),
      Ze.writeFileSync(
        o,
        JSON.stringify(c, null, 2) +
          `
`,
        "utf-8",
      ),
      console.log(`
${H.green}\u2713 Saved .nex/deploy.json (${Object.keys(c).length} config${Object.keys(c).length !== 1 ? "s" : ""})${H.reset}`),
      console.log(`${H.dim}Use: deploy prod  (or with explicit params)${H.reset}
`));
  }
  $p.exports = { runServerWizard: B_, runDeployWizard: gp, setWizardRL: W_ };
});
var Ua = K((yv, xp) => {
  "use strict";
  var H_ = require("os"),
    wp = require("path"),
    Ks = require("fs"),
    Ys = wp.join(H_.homedir(), ".nex-code", "model-routing.json"),
    _r = {
      frontend: {
        id: "frontend",
        label: "Frontend",
        icon: "\u2B21",
        envVar: "NEX_ROUTE_FRONTEND",
        pattern:
          /\b(react|vue|angular|svelte|jsx|tsx|html|css|scss|sass|tailwind|bootstrap|component|dom\b|ui\s|button|modal|navbar|sidebar|stylesheet|responsive|flexbox|grid|animation|frontend|front.end|onclick|hover|transition|web\s+design|landing\s+page|browser\s+event)\b/i,
      },
      sysadmin: {
        id: "sysadmin",
        label: "Sysadmin",
        icon: "\u2699",
        envVar: "NEX_ROUTE_SYSADMIN",
        pattern:
          /\b(nginx|apache|docker|kubernetes|k8s|systemd|systemctl|deploy(ment)?|server\s+config|firewall|iptables\b|ssh\s+key|cron(job)?|ansible|terraform|ci\/cd|pipeline|container\b|pod\b|apt\s+install|yum\s+install|daemon|pm2|supervisor|logrotate|ssl\s+cert|lets.encrypt|reverse\s+proxy|load\s+balanc|haproxy|vhost|virtual\s+host)\b/i,
      },
      data: {
        id: "data",
        label: "Data",
        icon: "\u2B21",
        envVar: "NEX_ROUTE_DATA",
        pattern:
          /\b(sql\b|mysql|postgres(ql)?|sqlite|mongodb|redis\b|query\b|database|db\s+migration|schema\s+change|table\s+join|aggregate\b|pandas\b|dataframe|\.csv\b|etl\b|data\s+transform|data\s+pipeline|analytics|data\s+warehouse|dbt\b|orm\b|knex|sequelize|prisma\s+schema)\b/i,
      },
      agentic: {
        id: "agentic",
        label: "Agentic",
        icon: "\u2B21",
        envVar: "NEX_ROUTE_AGENTIC",
        pattern:
          /\b(spawn\s+agent|agent\s+swarm|multi.?agent|parallel\s+agent|orchestrat|coordinate\s+multiple\s+agent|delegate.+agent|sub.?agent|architect.*coder)\b/i,
      },
      coding: {
        id: "coding",
        label: "Coding",
        icon: "\u2B21",
        envVar: "NEX_ROUTE_CODING",
        pattern: null,
      },
    },
    bp = ["agentic", "frontend", "sysadmin", "data", "coding"];
  function G_(t) {
    if (!t || t.length < 8) return null;
    for (let e of bp) {
      let s = _r[e];
      if (!s.pattern || s.pattern.test(t)) return s;
    }
    return _r.coding;
  }
  function _p() {
    try {
      if (Ks.existsSync(Ys)) return JSON.parse(Ks.readFileSync(Ys, "utf-8"));
    } catch {}
    return {};
  }
  function K_(t) {
    let e = _r[t];
    return e?.envVar && process.env[e.envVar]
      ? process.env[e.envVar]
      : _p()[t] || null;
  }
  function Y_(t) {
    let e = wp.dirname(Ys);
    (Ks.existsSync(e) || Ks.mkdirSync(e, { recursive: !0 }),
      Ks.writeFileSync(Ys, JSON.stringify(t, null, 2)));
  }
  xp.exports = {
    CATEGORIES: _r,
    DETECTION_ORDER: bp,
    detectCategory: G_,
    getModelForCategory: K_,
    saveRoutingConfig: Y_,
    loadRoutingConfig: _p,
    ROUTING_CONFIG_PATH: Ys,
  };
});
var Sr = K((wv, Sp) => {
  "use strict";
  var vr = require("os"),
    zs = require("path"),
    Ke = require("fs"),
    z_ = require("axios"),
    X_ = require("https"),
    xr = zs.join(vr.homedir(), ".nex-code", "known-models.json"),
    J_ = "https://ollama.com/api/tags",
    V_ = 60,
    Q_ = {
      "qwen3-coder:480b": 131072,
      "devstral-2:123b": 131072,
      "devstral-small-2:24b": 131072,
      "kimi-k2:1t": 262144,
      "kimi-k2.5": 262144,
      "kimi-k2-thinking": 262144,
      "minimax-m2.7:cloud": 2e5,
      "minimax-m2.5": 131072,
      "qwen3.5:397b": 262144,
      "qwen3.5:35b-a3b": 262144,
      "deepseek-v3.2": 131072,
      "cogito-2.1:671b": 131072,
      "glm-5": 128e3,
      "glm-4.7": 128e3,
    };
  function Wa() {
    try {
      if (Ke.existsSync(xr)) return JSON.parse(Ke.readFileSync(xr, "utf-8"));
    } catch {}
    return { benchmarked: [], lastChecked: null };
  }
  function Z_(t) {
    let e = zs.dirname(xr);
    (Ke.existsSync(e) || Ke.mkdirSync(e, { recursive: !0 }),
      Ke.writeFileSync(xr, JSON.stringify(t, null, 2)));
  }
  function ex(t) {
    let e = Wa(),
      s = new Set(e.benchmarked);
    for (let o of t) s.add(o);
    ((e.benchmarked = [...s]),
      (e.lastChecked = new Date().toISOString()),
      Z_(e));
  }
  async function kp() {
    let t = process.env.OLLAMA_API_KEY;
    if (!t) throw new Error("OLLAMA_API_KEY not set");
    let e = new X_.Agent({ keepAlive: !0 });
    return (
      (
        await z_.get(J_, {
          headers: { Authorization: `Bearer ${t}` },
          timeout: 15e3,
          httpsAgent: e,
        })
      ).data?.models || []
    )
      .map((o) => (o.name || o.model || "").replace(/:latest$/, ""))
      .filter(Boolean);
  }
  async function tx() {
    let t = await kp(),
      e = Wa(),
      s = new Set(e.benchmarked),
      o = t.filter((n) => !s.has(n));
    return { allCloud: t, newModels: o, store: e };
  }
  var Ba = "<!-- nex-benchmark-start -->",
    kr = "<!-- nex-benchmark-end -->",
    nx = {
      "devstral-2:123b":
        "Default \u2014 fastest + most reliable tool selection",
      "devstral-small-2:24b": "Fast sub-agents, simple lookups",
      "qwen3-coder:480b": "Coding-heavy sessions, heavy sub-agents",
      "kimi-k2:1t": "Large repos (>100K tokens)",
      "kimi-k2.5": "Large repos \u2014 faster than k2:1t",
      "minimax-m2.7:cloud":
        "Complex swarm / multi-agent sessions (Toolathon SOTA)",
      "minimax-m2.5": "Multi-agent, large context",
      "qwen3.5:35b-a3b": "Fast MoE with 256K context",
    };
  function sx(t) {
    return t
      ? t >= 25e4
        ? "256K"
        : t >= 19e4
          ? "200K"
          : t >= 128e3
            ? "131K"
            : t >= 64e3
              ? "64K"
              : `${Math.round(t / 1024)}K`
      : "?";
  }
  function vp(t, e) {
    let s = ["\u{1F947}", "\u{1F948}", "\u{1F949}"],
      o = (e || new Date().toISOString()).split("T")[0],
      n = t
        .filter((r) => r.score >= V_)
        .map((r, i) => {
          let c = s[i] || "\u2014",
            l = sx(Q_[r.model]),
            u = nx[r.model] || "\u2014",
            d = `${(r.avgLatency / 1e3).toFixed(1)}s`,
            f = i === 0 ? `**${r.score}**` : String(r.score);
          return `| ${c} | \`${r.model}\` | ${f} | ${d} | ${l} | ${u} |`;
        }).join(`
`);
    return `${Ba}
<!-- Updated: ${o} \u2014 run \`/benchmark --discover\` after new Ollama Cloud releases -->

| Rank | Model | Score | Avg Latency | Context | Best For |
|---|---|---|---|---|---|
${n}

> Rankings are nex-code-specific: tool name accuracy, argument validity, schema compliance.
> Toolathon (Minimax SOTA) measures different task types \u2014 run \`/benchmark --discover\` after model releases.
${kr}`;
  }
  function ox(t, e) {
    if (!Ke.existsSync(e)) return !1;
    let s = Ke.readFileSync(e, "utf-8"),
      o = s.indexOf(Ba),
      n = s.indexOf(kr);
    if (o === -1 || n === -1) return !1;
    let r = s.slice(0, o),
      i = s.slice(n + kr.length),
      c = vp(t);
    return (Ke.writeFileSync(e, r + c + i), !0);
  }
  function rx(t) {
    let e = zs.join(vr.homedir(), ".nex-code", "models.env");
    if (!Ke.existsSync(e) || t.length === 0)
      return { updated: !1, reason: "models.env not found or empty summary" };
    let s = t[0],
      o = Ke.readFileSync(e, "utf-8"),
      r = o.match(/^DEFAULT_MODEL=(\S+)/m)?.[1];
    if (r === s.model) return { updated: !1, reason: "winner unchanged" };
    let i = t.find((l) => l.model === r);
    if (i && s.score - i.score < 5)
      return {
        updated: !1,
        reason: `margin ${(s.score - i.score).toFixed(1)}pts < 5pts threshold`,
      };
    let c = new Date().toISOString().split("T")[0];
    return (
      (o = o
        .replace(/^DEFAULT_MODEL=\S+/m, `DEFAULT_MODEL=${s.model}`)
        .replace(
          /^# Last reviewed:.*$/m,
          `# Last reviewed: ${c} (after /benchmark, ${s.model} wins nex-code tasks)`,
        )),
      Ke.writeFileSync(e, o),
      { updated: !0, previousModel: r, newModel: s.model }
    );
  }
  function ix(t) {
    let { saveRoutingConfig: e } = Ua(),
      s = zs.join(vr.homedir(), ".nex-code", "models.env"),
      o = [],
      n = Object.entries(t).filter(([, c]) => c.score > 0);
    if (n.length === 0) return { saved: !1, envUpdated: !1, changes: [] };
    let r = {};
    for (let [c, l] of n)
      ((r[c] = l.model), o.push(`${c}: ${l.model} (${l.score}/100)`));
    e(r);
    let i = !1;
    if (Ke.existsSync(s)) {
      let c = Ke.readFileSync(s, "utf-8"),
        u = Object.entries({
          coding: "NEX_ROUTE_CODING",
          frontend: "NEX_ROUTE_FRONTEND",
          sysadmin: "NEX_ROUTE_SYSADMIN",
          data: "NEX_ROUTE_DATA",
          agentic: "NEX_ROUTE_AGENTIC",
        })
          .filter(([m]) => t[m] && t[m].score > 0)
          .map(
            ([m, h]) => `${h}=${t[m].model}  # ${m} score: ${t[m].score}/100`,
          ).join(`
`),
        d =
          "# \u2500\u2500 Task-type routing (auto-updated by /benchmark) \u2500\u2500",
        f = "# \u2500\u2500 end routing \u2500\u2500";
      if (c.includes(d)) {
        let m = c.indexOf(d),
          h = c.indexOf(f);
        h !== -1 &&
          (c =
            c.slice(0, m) +
            `${d}
${u}
${f}` +
            c.slice(h + f.length));
      } else
        c += `
${d}
${u}
${f}
`;
      (Ke.writeFileSync(s, c), (i = !0));
    }
    return { saved: !0, envUpdated: i, changes: o };
  }
  var ax = /thinking|reasoning|instruct|planner|orchestrat/i;
  function cx(t) {
    return ax.test(t);
  }
  function lx(t) {
    if (!t || t.length === 0) return { updated: !1 };
    let e = zs.join(vr.homedir(), ".nex-code", "models.env");
    if (!Ke.existsSync(e)) return { updated: !1 };
    let s = Ke.readFileSync(e, "utf-8"),
      o = s.match(/^NEX_ORCHESTRATOR_MODEL=(.+)$/m),
      n = o ? o[1].trim() : null,
      i = [...t].sort((d, f) => f.overall - d.overall)[0],
      c = n ? t.find((d) => d.model === n) : null,
      l = c ? c.overall : 0;
    if (i.model === n) return { updated: !1 };
    if (l > 0 && i.overall < l * 1.05) return { updated: !1 };
    let u = `NEX_ORCHESTRATOR_MODEL=${i.model}`;
    return (
      o
        ? (s = s.replace(/^NEX_ORCHESTRATOR_MODEL=.+$/m, u))
        : (s += `
${u}
`),
      Ke.writeFileSync(e, s),
      { updated: !0, previousModel: n, newModel: i.model }
    );
  }
  Sp.exports = {
    findNewModels: tx,
    fetchCloudModels: kp,
    loadKnownModels: Wa,
    markBenchmarked: ex,
    updateReadme: ox,
    updateModelsEnv: rx,
    updateRoutingConfig: ix,
    generateBenchmarkBlock: vp,
    checkOrchestratorCandidate: cx,
    updateOrchestratorModel: lx,
    SENTINEL_START: Ba,
    SENTINEL_END: kr,
  };
});
var Tn = K((bv, Mp) => {
  "use strict";
  var { C: D } = Ce(),
    ux = Ae(),
    { TOOL_DEFINITIONS: Ep } = St(),
    Xs = [
      {
        id: "read-package",
        category: "file-ops",
        prompt: "Read the file package.json and show me its contents.",
        expectedTool: "read_file",
        validateArgs: (t) =>
          typeof t.path == "string" && t.path.includes("package.json"),
      },
      {
        id: "write-file",
        category: "file-ops",
        prompt:
          'Create a file at /tmp/nex-bench-test.txt with the content "benchmark run".',
        expectedTool: "write_file",
        validateArgs: (t) =>
          typeof t.path == "string" && typeof t.content == "string",
      },
      {
        id: "edit-file",
        category: "file-ops",
        prompt:
          'In the file src/config.js, replace the string "debug: false" with "debug: true".',
        expectedTool: ["edit_file", "patch_file"],
        validateArgs: (t) =>
          !!(
            (t.path && t.old_string !== void 0 && t.new_string !== void 0) ||
            (t.path && Array.isArray(t.patches) && t.patches.length > 0)
          ),
      },
      {
        id: "list-directory",
        category: "file-ops",
        prompt: "Show me all files and folders in the cli/ directory.",
        expectedTool: ["list_directory", "glob"],
        validateArgs: (t) =>
          !!(
            (typeof t.path == "string" && t.path.includes("cli")) ||
            (typeof t.pattern == "string" && t.pattern.includes("cli"))
          ),
      },
      {
        id: "glob-js-files",
        category: "file-ops",
        prompt:
          "Find all JavaScript files (*.js) recursively in the cli/ directory.",
        expectedTool: "glob",
        validateArgs: (t) =>
          typeof t.pattern == "string" && t.pattern.includes(".js"),
      },
      {
        id: "search-constant",
        category: "search",
        prompt:
          'Search for the string "DEFAULT_MODEL" across all files in the project.',
        expectedTool: ["search_files", "grep"],
        validateArgs: (t) =>
          (t.pattern || t.query || t.regex || "").includes("DEFAULT_MODEL"),
      },
      {
        id: "grep-function-def",
        category: "search",
        prompt:
          'Find where the function "callStream" is defined in the codebase.',
        expectedTool: ["grep", "search_files"],
        validateArgs: (t) =>
          (t.pattern || t.query || t.regex || "").includes("callStream"),
      },
      {
        id: "search-todos",
        category: "search",
        prompt: "Find all TODO comments in the source code.",
        expectedTool: ["grep", "search_files", "bash"],
        validateArgs: (t) => JSON.stringify(t).toUpperCase().includes("TODO"),
      },
      {
        id: "git-branch",
        category: "shell",
        prompt: "What git branch am I currently on?",
        expectedTool: "bash",
        validateArgs: (t) =>
          typeof t.command == "string" && t.command.includes("git"),
      },
      {
        id: "git-status",
        category: "shell",
        prompt: "Show me the current git status of the repository.",
        expectedTool: "bash",
        validateArgs: (t) =>
          typeof t.command == "string" && t.command.includes("git status"),
      },
      {
        id: "npm-install",
        category: "shell",
        prompt: "Run npm install to install project dependencies.",
        expectedTool: "bash",
        validateArgs: (t) =>
          typeof t.command == "string" && t.command.includes("npm"),
      },
      {
        id: "schema-strict",
        category: "schema",
        prompt: "Read the file README.md",
        expectedTool: "read_file",
        validateArgs: (t, e) => {
          let s = e?.function?.parameters || {},
            o = s.required || [],
            n = Object.keys(s.properties || {});
          return (
            o.every((r) => t[r] !== void 0) &&
            Object.keys(t).every((r) => n.includes(r))
          );
        },
      },
      {
        id: "multi-step-version",
        category: "multi-step",
        prompt:
          "What is the current version of this project? Check the source files.",
        expectedTool: "read_file",
        validateArgs: (t) =>
          typeof t.path == "string" && t.path.includes("package.json"),
      },
      {
        id: "multi-step-count",
        category: "multi-step",
        prompt:
          "How many JavaScript files are in the cli/ directory? Count them.",
        expectedTool: ["bash", "glob", "list_directory"],
        validateArgs: (t) =>
          !!(
            (typeof t.command == "string" && t.command.includes("cli")) ||
            (typeof t.pattern == "string" && t.pattern.includes("cli")) ||
            (typeof t.path == "string" && t.path.includes("cli"))
          ),
      },
      {
        id: "no-tool-reasoning",
        category: "reasoning",
        prompt: 'What does the acronym "API" stand for?',
        expectedTool: null,
        validateArgs: () => !0,
      },
      {
        id: "frontend-find-hook",
        category: "frontend",
        prompt: "Find all files that import useState from React.",
        expectedTool: ["grep", "search_files"],
        validateArgs: (t) =>
          (t.pattern || t.query || t.regex || "").includes("useState"),
      },
      {
        id: "frontend-create-component",
        category: "frontend",
        prompt:
          "Create a React functional component called Button that accepts a label prop and renders a styled button element. Save it to src/components/Button.jsx.",
        expectedTool: "write_file",
        validateArgs: (t) =>
          typeof t.path == "string" &&
          (t.path.includes(".jsx") ||
            t.path.includes(".tsx") ||
            t.path.includes(".js")) &&
          typeof t.content == "string",
      },
      {
        id: "frontend-edit-css",
        category: "frontend",
        prompt:
          'In the file src/styles.css, change the background-color value from "blue" to "red".',
        expectedTool: ["edit_file", "patch_file"],
        validateArgs: (t) =>
          t.path && t.old_string !== void 0
            ? t.path.includes(".css") ||
              t.old_string.includes("blue") ||
              t.old_string.includes("background")
            : !!(t.path && Array.isArray(t.patches)),
      },
      {
        id: "frontend-glob-components",
        category: "frontend",
        prompt:
          "Find all JSX and TSX component files in the components/ directory.",
        expectedTool: "glob",
        validateArgs: (t) =>
          typeof t.pattern == "string" &&
          (t.pattern.includes(".jsx") ||
            t.pattern.includes(".tsx") ||
            t.pattern.includes("{jsx,tsx}")),
      },
      {
        id: "frontend-list-assets",
        category: "frontend",
        prompt: "List all files in the src/assets/ directory.",
        expectedTool: ["list_directory", "glob"],
        validateArgs: (t) =>
          !!(
            (typeof t.path == "string" && t.path.includes("assets")) ||
            (typeof t.pattern == "string" && t.pattern.includes("assets"))
          ),
      },
      {
        id: "sysadmin-port-check",
        category: "sysadmin",
        prompt: "Which process is currently listening on port 3000?",
        expectedTool: "bash",
        validateArgs: (t) =>
          typeof t.command == "string" &&
          (t.command.includes("lsof") ||
            t.command.includes("ss") ||
            t.command.includes("netstat") ||
            t.command.includes("3000")),
      },
      {
        id: "sysadmin-nginx-config",
        category: "sysadmin",
        prompt:
          "Create an nginx server block that proxies requests to localhost:3000. Save it to /etc/nginx/sites-available/myapp.",
        expectedTool: ["write_file", "bash"],
        validateArgs: (t) =>
          !!(
            (t.path &&
              (t.path.includes("nginx") ||
                t.path.includes("sites-available"))) ||
            (t.command && t.command.includes("nginx"))
          ),
      },
      {
        id: "sysadmin-service-status",
        category: "sysadmin",
        prompt:
          "Check the status of the nginx service and show if it is running.",
        expectedTool: "bash",
        validateArgs: (t) =>
          typeof t.command == "string" &&
          (t.command.includes("systemctl") ||
            t.command.includes("service") ||
            t.command.includes("nginx")),
      },
      {
        id: "sysadmin-error-log",
        category: "sysadmin",
        prompt: "Show the last 100 lines of the nginx error log.",
        expectedTool: "bash",
        validateArgs: (t) =>
          typeof t.command == "string" &&
          (t.command.includes("tail") ||
            t.command.includes("journalctl") ||
            t.command.includes("nginx")),
      },
      {
        id: "sysadmin-docker-compose",
        category: "sysadmin",
        prompt:
          "Create a docker-compose.yml file for a Node.js application with a PostgreSQL database.",
        expectedTool: "write_file",
        validateArgs: (t) =>
          typeof t.path == "string" &&
          t.path.includes("docker-compose") &&
          typeof t.content == "string",
      },
      {
        id: "data-sql-query",
        category: "data",
        prompt:
          "Write a SQL query to find all users who have not logged in for more than 30 days. Save it to queries/inactive-users.sql.",
        expectedTool: "write_file",
        validateArgs: (t) =>
          typeof t.path == "string" &&
          (t.path.includes(".sql") || t.path.includes("quer")) &&
          typeof t.content == "string",
      },
      {
        id: "data-find-json-key",
        category: "data",
        prompt:
          'Find all JSON files in the project that contain the key "userId".',
        expectedTool: ["grep", "search_files"],
        validateArgs: (t) =>
          (t.pattern || t.query || t.regex || "").includes("userId"),
      },
      {
        id: "data-python-csv",
        category: "data",
        prompt:
          'Write a Python script that reads data.csv and calculates the average of the "price" column. Save it to scripts/average_price.py.',
        expectedTool: "write_file",
        validateArgs: (t) =>
          typeof t.path == "string" &&
          t.path.includes(".py") &&
          typeof t.content == "string",
      },
      {
        id: "data-find-migrations",
        category: "data",
        prompt: "Find all database migration files in this project.",
        expectedTool: ["glob", "search_files", "grep"],
        validateArgs: (t) => JSON.stringify(t).toLowerCase().includes("migrat"),
      },
      {
        id: "agentic-test-first",
        category: "agentic",
        prompt:
          "Run the full test suite. If any tests fail, identify the failing test file and read it to understand the issue.",
        expectedTool: "bash",
        validateArgs: (t) =>
          typeof t.command == "string" &&
          (t.command.includes("test") ||
            t.command.includes("jest") ||
            t.command.includes("npm")),
      },
      {
        id: "agentic-read-then-act",
        category: "agentic",
        prompt:
          "Read the project README.md, find the TODO section, and list which items are completed.",
        expectedTool: "read_file",
        validateArgs: (t) =>
          typeof t.path == "string" && t.path.includes("README"),
      },
      {
        id: "agentic-build-deploy",
        category: "agentic",
        prompt:
          "Build the project with npm run build, then verify the output exists in the dist/ directory.",
        expectedTool: "bash",
        validateArgs: (t) =>
          typeof t.command == "string" &&
          (t.command.includes("build") || t.command.includes("npm")),
      },
    ],
    Tp = [
      "minimax-m2.7:cloud",
      "qwen3-coder:480b",
      "kimi-k2:1t",
      "devstral-2:123b",
      "devstral-small-2:24b",
    ],
    Rp = ["minimax-m2.7:cloud", "qwen3-coder:480b", "devstral-2:123b"],
    dx = 7,
    Er = {
      producedToolCall: 0.2,
      correctTool: 0.35,
      validArgs: 0.3,
      schemaCompliant: 0.15,
    },
    fx =
      "You are a coding assistant. Use the provided tools to help with file operations, search, and development tasks. Only call a tool when one is clearly needed to answer the request. Do not call a tool for questions you can answer from general knowledge.";
  async function Cp(t, e) {
    let s = {
        taskId: t.id,
        category: t.category,
        model: e,
        producedToolCall: !1,
        correctTool: !1,
        validArgs: !1,
        schemaCompliant: !1,
        toolCalled: null,
        error: null,
        latencyMs: 0,
      },
      o = [
        { role: "system", content: fx },
        { role: "user", content: t.prompt },
      ],
      n = Date.now();
    try {
      let r = await ux.callChat(o, Ep, {
        provider: "ollama",
        model: e,
        temperature: 0,
        timeout: 9e4,
      });
      s.latencyMs = Date.now() - n;
      let i = r.tool_calls || [];
      if (t.expectedTool === null) {
        let c = i.length === 0;
        ((s.producedToolCall = c),
          (s.correctTool = c),
          (s.validArgs = !0),
          (s.schemaCompliant = !0));
      } else if (i.length > 0) {
        let c = i[0],
          l = c.function?.name || "unknown",
          u = c.function?.arguments || {};
        ((s.producedToolCall = !0), (s.toolCalled = l));
        let d = Array.isArray(t.expectedTool)
          ? t.expectedTool
          : [t.expectedTool];
        if (((s.correctTool = d.includes(l)), s.correctTool)) {
          let f = Ep.find((m) => m.function?.name === l);
          if (((s.validArgs = !!t.validateArgs(u, f)), f)) {
            let m = f.function?.parameters || {},
              h = m.required || [],
              p = Object.keys(m.properties || {});
            s.schemaCompliant =
              h.every((g) => u[g] !== void 0) &&
              Object.keys(u).every((g) => p.includes(g));
          }
        }
      }
    } catch (r) {
      ((s.latencyMs = Date.now() - n), (s.error = r.message.slice(0, 120)));
    }
    return s;
  }
  function Js(t) {
    return t.error
      ? 0
      : ((t.producedToolCall ? Er.producedToolCall : 0) +
          (t.correctTool ? Er.correctTool : 0) +
          (t.validArgs ? Er.validArgs : 0) +
          (t.schemaCompliant ? Er.schemaCompliant : 0)) *
          100;
  }
  var px = {
    coding: "coding",
    search: "coding",
    shell: "coding",
    schema: "coding",
    "multi-step": "coding",
    reasoning: "coding",
    frontend: "frontend",
    sysadmin: "sysadmin",
    data: "data",
    agentic: "agentic",
  };
  function Ha(t) {
    return Object.entries(t)
      .map(([e, s]) => {
        let o = s.map(Js),
          n = o.reduce((c, l) => c + l, 0) / o.length,
          r = (c) => Math.round((s.filter(c).length / s.length) * 100),
          i = {};
        for (let c of ["coding", "frontend", "sysadmin", "data", "agentic"]) {
          let l = s.filter((d) => px[d.category] === c);
          if (l.length === 0) continue;
          let u = l.map(Js).reduce((d, f) => d + f, 0) / l.length;
          i[c] = Math.round(u * 10) / 10;
        }
        return {
          model: e,
          score: Math.round(n * 10) / 10,
          toolCallRate: r(
            (c) =>
              !c.error && (c.producedToolCall || c.category === "reasoning"),
          ),
          correctRate: r((c) => c.correctTool),
          validArgsRate: r((c) => c.validArgs),
          schemaRate: r((c) => c.schemaCompliant),
          avgLatency: Math.round(
            s.reduce((c, l) => c + l.latencyMs, 0) / s.length,
          ),
          errorCount: s.filter((c) => c.error).length,
          categoryScores: i,
          results: s,
        };
      })
      .sort((e, s) => s.score - e.score);
  }
  function mx(t) {
    let e = {};
    for (let s of ["coding", "frontend", "sysadmin", "data", "agentic"]) {
      let o = t
        .filter((n) => n.categoryScores[s] !== void 0)
        .sort((n, r) => r.categoryScores[s] - n.categoryScores[s]);
      o.length > 0 &&
        (e[s] = { model: o[0].model, score: o[0].categoryScores[s] });
    }
    return e;
  }
  function Ap(t, e) {
    let s = `nex-code Model Benchmark  (${e} tasks \xB7 ollama cloud)`,
      o = [
        { label: "#", width: 3 },
        { label: "Model", width: 26 },
        { label: "Score", width: 7 },
        { label: "Tool\u2713", width: 7 },
        { label: "Name\u2713", width: 7 },
        { label: "Args\u2713", width: 7 },
        { label: "Schema\u2713", width: 8 },
        { label: "Latency", width: 8 },
        { label: "Err", width: 4 },
      ],
      n = o.reduce((u, d) => u + d.width + 1, 0) + 1,
      r = "\u2500".repeat(n);
    (console.log(`
${D.bold}${s}${D.reset}`),
      console.log(r));
    let i = o.map((u) => u.label.padEnd(u.width)).join(" ");
    if (
      (console.log(`${D.dim}${i}${D.reset}`),
      console.log(r),
      t.forEach((u, d) => {
        let f = String(d + 1).padEnd(o[0].width),
          m = u.model.slice(0, o[1].width).padEnd(o[1].width),
          h = String(u.score).padEnd(o[2].width),
          p = `${u.toolCallRate}%`.padEnd(o[3].width),
          g = `${u.correctRate}%`.padEnd(o[4].width),
          $ = `${u.validArgsRate}%`.padEnd(o[5].width),
          w = `${u.schemaRate}%`.padEnd(o[6].width),
          _ = `${(u.avgLatency / 1e3).toFixed(1)}s`.padEnd(o[7].width),
          x =
            u.errorCount > 0
              ? `${D.red}${u.errorCount}${D.reset}`
              : `${D.dim}0${D.reset}`,
          v = u.score >= 80 ? D.green : u.score >= 60 ? D.yellow : D.red,
          b = d === 0 ? `${D.yellow}${f}${D.reset}` : `${D.dim}${f}${D.reset}`;
        console.log(
          `${b} ${v}${m}${D.reset} ${D.bold}${v}${h}${D.reset} ${p} ${g} ${$} ${w} ${D.dim}${_}${D.reset} ${x}`,
        );
      }),
      console.log(r),
      t.length > 0)
    ) {
      let u = t[0];
      if (
        (console.log(`
${D.bold}${D.green}Winner: ${u.model}${D.reset}  score ${u.score}/100`),
        t.length > 1)
      ) {
        let d = (u.score - t[1].score).toFixed(1);
        console.log(`${D.dim}+${d} pts over ${t[1].model}${D.reset}`);
      }
    }
    let c = ["coding", "frontend", "sysadmin", "data", "agentic"];
    if (t.some((u) => Object.keys(u.categoryScores).length > 1)) {
      console.log(`
${D.bold}Best model per task type:${D.reset}`);
      for (let u of c) {
        let d = t
          .filter((p) => p.categoryScores[u] !== void 0)
          .sort((p, g) => g.categoryScores[u] - p.categoryScores[u]);
        if (d.length === 0) continue;
        let f = d[0],
          m = f.categoryScores[u],
          h = m >= 80 ? D.green : m >= 60 ? D.yellow : D.red;
        console.log(
          `  ${D.dim}${u.padEnd(10)}${D.reset} ${h}${f.model}${D.reset}  ${D.dim}${m}/100${D.reset}`,
        );
      }
    }
    console.log();
  }
  async function hx({ models: t, quick: e = !1, onProgress: s } = {}) {
    let o = e ? Xs.slice(0, dx) : Xs,
      n = t?.length > 0 ? t : e ? Rp : Tp,
      r = {};
    for (let c of n) {
      r[c] = [];
      for (let l of o) {
        s?.({ model: c, task: l.id, done: !1 });
        let u = await Cp(l, c);
        (r[c].push(u),
          s?.({
            model: c,
            task: l.id,
            done: !0,
            score: Js(u),
            error: u.error,
          }));
      }
    }
    let i = Ha(r);
    return (Ap(i, o.length), i);
  }
  async function gx({
    newModels: t,
    existingRanking: e = [],
    onProgress: s,
  } = {}) {
    if (!t || t.length === 0) return e;
    let o = {};
    for (let i of t) {
      o[i] = [];
      for (let c of Xs) {
        s?.({ model: i, task: c.id, done: !1 });
        let l = await Cp(c, i);
        (o[i].push(l),
          s?.({
            model: i,
            task: c.id,
            done: !0,
            score: Js(l),
            error: l.error,
          }));
      }
    }
    let r = [...Ha(o)];
    for (let i of e) r.find((c) => c.model === i.model) || r.push(i);
    return (r.sort((i, c) => c.score - i.score), Ap(r, Xs.length), r);
  }
  var Tr = [
    {
      id: "simple_question",
      name: "Simple Convergence",
      prompt: "What is 2+2?",
      maxTurns: 3,
      successCriteria: ["4"],
    },
  ];
  function Op(t) {
    let e = require("fs"),
      o = require("path").join(
        t || process.cwd(),
        ".nex",
        "benchmark-config.json",
      );
    if (!e.existsSync(o))
      return (
        console.log(`${D.yellow}No scenarios configured.${D.reset} Create ${D.dim}.nex/benchmark-config.json${D.reset} to define your benchmark scenarios.
  Example:
  {
    "scenarios": [
      {
        "id": "health_check",
        "name": "Service Health Check",
        "prompt": "Check if my-api is running on <your-server> and report status",
        "maxTurns": 10,
        "successCriteria": ["running", "healthy", "OK"]
      }
    ]
  }
`),
        Tr
      );
    try {
      let n = JSON.parse(e.readFileSync(o, "utf-8"));
      return !Array.isArray(n.scenarios) || n.scenarios.length === 0
        ? (console.log(`${D.yellow}benchmark-config.json has no scenarios \u2014 using defaults.${D.reset}
`),
          Tr)
        : n.scenarios;
    } catch (n) {
      return (
        console.log(`${D.yellow}Failed to parse benchmark-config.json: ${n.message}${D.reset}
`),
        Tr
      );
    }
  }
  function Np(t, e) {
    let {
        scoreMessages: s,
        _extractToolCalls: o,
        _getLastAssistantText: n,
      } = tr(),
      r = s(t),
      i = r.score,
      c = [],
      l = n(t).toLowerCase();
    e.successCriteria.every((m) => l.includes(m.toLowerCase())) &&
      ((i = Math.min(10, i + 1)), c.push("+1.0 all success criteria met"));
    let d = o(t);
    (d.length < e.maxTurns / 2 &&
      ((i = Math.min(10, i + 0.5)),
      c.push(`+0.5 efficient (${d.length} tool calls < ${e.maxTurns / 2})`)),
      (i = Math.round(i * 10) / 10));
    let f = i >= 9 ? "A" : i >= 8 ? "B" : i >= 7 ? "C" : i >= 6 ? "D" : "F";
    return {
      score: i,
      grade: f,
      issues: r.issues,
      summary: r.summary,
      bonuses: c,
    };
  }
  async function $x(t, e = {}) {
    let { spawn: s } = require("child_process"),
      o = require("fs"),
      n = require("path"),
      r = require("os"),
      i = n.join(r.tmpdir(), `nex-bench-${t.id}-${Date.now()}.txt`);
    o.writeFileSync(i, t.prompt, "utf-8");
    let c = n.resolve(__dirname, "..", "bin", "nex-code.js"),
      l = e.cwd || process.cwd(),
      u = [
        c,
        "--prompt-file",
        i,
        "--delete-prompt-file",
        "--auto",
        "--max-turns",
        String(t.maxTurns),
      ];
    return (
      e.model && u.push("--model", e.model),
      new Promise((d) => {
        let f = s(process.execPath, u, {
            cwd: l,
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env },
          }),
          m = t.maxTurns * 60 * 1e3,
          h = !1,
          p = setTimeout(() => {
            h = !0;
            try {
              f.kill("SIGTERM");
            } catch {}
          }, m);
        (f.on("close", (g) => {
          clearTimeout(p);
          try {
            o.unlinkSync(i);
          } catch {}
          let $ = n.join(l, ".nex", "sessions", "_autosave.json"),
            w = [];
          if (o.existsSync($))
            try {
              w = JSON.parse(o.readFileSync($, "utf-8")).messages || [];
            } catch {}
          d({ messages: w, exitCode: g || 0, timedOut: h });
        }),
          f.stdout.resume(),
          f.stderr.resume());
      })
    );
  }
  function yx(t, e, s) {
    let o =
        t.length > 0
          ? Math.round((t.reduce((l, u) => l + u.score, 0) / t.length) * 10) /
            10
          : 0,
      n = o >= 9 ? "A" : o >= 8 ? "B" : o >= 7 ? "C" : o >= 6 ? "D" : "F",
      r = 57,
      i = "\u2500".repeat(r);
    console.log(`
\u250C\u2500 Benchmark Results ${"\u2500".repeat(r - 19)}\u2510`);
    for (let l of t) {
      let u = l.id.padEnd(20),
        d = l.name.substring(0, 26).padEnd(26),
        f = `${l.score}/10`.padStart(6),
        m = l.grade.padStart(2);
      console.log(`\u2502  ${u} ${d} ${f}  ${m} \u2502`);
    }
    console.log(`\u2502  ${" ".repeat(r - 2)} \u2502`);
    let c = `Overall: ${o}/10 (${n})  \xB7  v${e}  \xB7  ${s}`;
    (console.log(`\u2502  ${c.substring(0, r - 4).padEnd(r - 4)} \u2502`),
      console.log(`\u2514${"\u2500".repeat(r + 1)}\u2518
`));
  }
  function wx(t = 10) {
    let e = require("fs"),
      o = require("path").join(process.cwd(), ".nex", "benchmark-history.json");
    if (!e.existsSync(o)) {
      console.log(`${D.yellow}No score history yet. Run a session first.${D.reset}
`);
      return;
    }
    let n = [];
    try {
      n = JSON.parse(e.readFileSync(o, "utf-8"));
    } catch {
      n = [];
    }
    if (!Array.isArray(n) || n.length === 0) {
      console.log(`${D.yellow}Score history is empty.${D.reset}
`);
      return;
    }
    let r = n.slice(-t);
    console.log(`
${D.bold}Score History (last ${r.length} session${r.length === 1 ? "" : "s"}):${D.reset}`);
    for (let i of r) {
      let c = (i.date || "").replace("T", " ").substring(0, 16),
        l = (i.version || "?").padEnd(8),
        u = (i.model || "?").substring(0, 12).padEnd(12),
        d = `${i.score}/10`.padStart(6),
        f = i.grade || "?",
        m =
          i.issues && i.issues.length > 0
            ? `${D.yellow}\u26A0 ${i.issues
                .slice(0, 2)
                .map((p) => p.substring(0, 30))
                .join(", ")}${D.reset}`
            : `${D.green}\u2713${D.reset}`,
        h = i.score >= 8 ? D.green : i.score >= 6 ? D.yellow : D.red;
      console.log(
        `  ${D.dim}${c}${D.reset}  ${D.dim}v${l}${D.reset}  ${D.dim}${u}${D.reset}  ${h}${d}  ${f}${D.reset}  ${m}`,
      );
    }
    console.log();
  }
  async function bx({ dryRun: t = !1, model: e, cwd: s, onProgress: o } = {}) {
    let n = Cn(),
      r = Op(s);
    if (t) {
      console.log(`
${D.bold}Jarvis Benchmark \u2014 Scenarios (dry-run):${D.reset}
`);
      for (let l of r)
        (console.log(
          `  ${D.cyan}${l.id.padEnd(20)}${D.reset} ${D.dim}${l.name}${D.reset}  maxTurns=${l.maxTurns}`,
        ),
          console.log(`    ${D.dim}${l.prompt.substring(0, 80)}${D.reset}`));
      return (console.log(), []);
    }
    let i = (() => {
        if (e) return e;
        try {
          let { getActiveModel: l } = Dn();
          return (l && l()) || "unknown";
        } catch {
          return "unknown";
        }
      })(),
      c = [];
    for (let l of r) {
      (o?.({ id: l.id, name: l.name, done: !1 }),
        console.log(`
${D.dim}Running scenario: ${l.name}...${D.reset}`));
      let { messages: u, timedOut: d } = await $x(l, { model: i, cwd: s }),
        f;
      d || u.length === 0
        ? (f = {
            score: 0,
            grade: "F",
            issues: [d ? "Scenario timed out" : "No messages produced"],
            summary: "No output",
            bonuses: [],
          })
        : (f = Np(u, l));
      let m = {
        id: l.id,
        name: l.name,
        score: f.score,
        grade: f.grade,
        issues: f.issues,
        bonuses: f.bonuses,
      };
      (c.push(m),
        o?.({
          id: l.id,
          name: l.name,
          done: !0,
          score: f.score,
          grade: f.grade,
        }));
      try {
        let { appendScoreHistory: h } = tr();
        h(f.score, {
          version: n.version,
          model: i,
          sessionName: `bench:${l.id}`,
          issues: f.issues,
        });
      } catch {}
    }
    return (yx(c, n.version, i), c);
  }
  Mp.exports = {
    runBenchmark: hx,
    runDiscoverBenchmark: gx,
    buildSummary: Ha,
    buildCategoryWinners: mx,
    TASKS: Xs,
    scoreResult: Js,
    DEFAULT_MODELS: Tp,
    QUICK_MODELS: Rp,
    runJarvisBenchmark: bx,
    showScoreTrend: wx,
    loadScenarios: Op,
    DEFAULT_SCENARIOS: Tr,
    scoreJarvisScenario: Np,
  };
});
var Wp = K((_v, Up) => {
  "use strict";
  var _x = require("os"),
    Lp = require("path"),
    Ga = require("fs"),
    { callWithRetry: Pp } = Ho(),
    { parseModelSpec: xx } = Ae(),
    { extractJSON: Ip, DECOMPOSE_PROMPT: kx, SYNTHESIZE_PROMPT: vx } = js(),
    { C: gt } = Ce(),
    Rr = Lp.join(_x.homedir(), ".nex-code", "orchestrator-bench.json"),
    jp = [
      {
        id: "decompose_multi_bug",
        type: "decompose",
        prompt:
          "Fix 4 bugs: (1) 500 error on SmartThings API call, (2) invalid time format on Sunday schedule, (3) Google Auth callback fails with CORS, (4) contact search returns empty",
        expectedSubTasks: 4,
        maxSubTasks: 5,
      },
      {
        id: "decompose_feature_mix",
        type: "decompose",
        prompt:
          "Add dark mode toggle to settings page, fix the broken login redirect, improve search performance by adding an index, update API docs for the new endpoints",
        expectedSubTasks: 4,
        maxSubTasks: 5,
      },
      {
        id: "decompose_overlapping",
        type: "decompose",
        prompt:
          "Refactor auth.js to use JWT instead of sessions, update all tests that import auth.js, and add rate limiting to the login endpoint in auth.js",
        expectedSubTasks: 3,
        maxSubTasks: 4,
      },
      {
        id: "decompose_single",
        type: "decompose",
        prompt:
          "Fix the broken CSS on the login page \u2014 the submit button is not aligned",
        expectedSubTasks: 1,
        maxSubTasks: 4,
      },
      {
        id: "synthesize_clean",
        type: "synthesize",
        prompt: "Fix login and search bugs",
        subResults: [
          {
            task: "Fix login redirect",
            status: "done",
            result:
              "Changed auth.js line 42: fixed redirect URL to use req.originalUrl instead of hardcoded /",
            toolsUsed: ["read_file", "edit_file"],
          },
          {
            task: "Fix search index",
            status: "done",
            result:
              "Added index on users.email column in migration 20260323. Updated search.js to use indexed query.",
            toolsUsed: ["write_file", "edit_file"],
          },
        ],
        expectedConflicts: 0,
      },
      {
        id: "synthesize_conflicts",
        type: "synthesize",
        prompt: "Fix config loading and add env validation",
        subResults: [
          {
            task: "Fix config loading",
            status: "done",
            result:
              "Modified config.js: changed loadConfig() to handle missing .env gracefully",
            toolsUsed: ["edit_file"],
          },
          {
            task: "Add env validation",
            status: "done",
            result:
              "Modified config.js: added validateEnv() function that throws on missing required vars",
            toolsUsed: ["edit_file"],
          },
        ],
        expectedConflicts: 1,
      },
    ];
  function Dp(t, e) {
    if (!Array.isArray(t)) return 0;
    let s = 0;
    s += 1.5;
    let o = Math.abs(t.length - e.expectedSubTasks);
    (o === 0 ? (s += 3) : o === 1 && (s += 1.5),
      t.every(
        (l) => l.task && typeof l.task == "string" && l.task.length > 0,
      ) && (s += 2));
    let r = t.flatMap((l) => (Array.isArray(l.scope) ? l.scope : [])),
      i = new Set(r);
    return (
      r.length === i.size && (s += 2),
      t.every(
        (l) =>
          typeof l.estimatedCalls == "number" ||
          typeof l.estimatedSshCalls == "number",
      ) && (s += 1.5),
      Math.min(10, Math.round(s * 10) / 10)
    );
  }
  function qp(t, e) {
    if (!t || typeof t != "object") return 0;
    let s = 0;
    ((s += 1.5),
      t.summary && t.summary.length > 10 && (s += 2),
      t.commitMessage && t.commitMessage.length > 5 && (s += 2));
    let o = Array.isArray(t.conflicts) ? t.conflicts : [];
    return (
      (e.expectedConflicts === 0 && o.length === 0) ||
      (e.expectedConflicts > 0 && o.length > 0)
        ? (s += 2.5)
        : e.expectedConflicts > 0 && o.length === 0 && (s += 0),
      Array.isArray(t.filesChanged) && t.filesChanged.length > 0 && (s += 2),
      Math.min(10, Math.round(s * 10) / 10)
    );
  }
  async function Fp(t, e) {
    let s = {};
    if (e) {
      let n = xx(e);
      (n.provider && (s.provider = n.provider), n.model && (s.model = n.model));
    }
    let o = Date.now();
    try {
      if (t.type === "decompose") {
        let n = kx
            .replace("{maxSubTasks}", String(t.maxSubTasks))
            .replace("{prompt}", t.prompt),
          r = await Pp(
            [
              { role: "system", content: n },
              { role: "user", content: t.prompt },
            ],
            [],
            s,
          ),
          i = Ip(r.content || ""),
          c = Date.now() - o;
        return { score: Dp(i, t), latencyMs: c };
      }
      if (t.type === "synthesize") {
        let n = t.subResults.map((d, f) => {
            let m = d.status === "done" ? "SUCCESS" : "FAILED";
            return `--- Agent ${f + 1} [${m}] ---
Task: ${d.task}
Result: ${d.result}
Tools: ${d.toolsUsed.join(", ")}`;
          }).join(`

`),
          r = vx.replace("{prompt}", t.prompt).replace("{results}", n),
          i = await Pp(
            [
              { role: "system", content: r },
              {
                role: "user",
                content: "Synthesize the sub-agent results above.",
              },
            ],
            [],
            s,
          ),
          c = Ip(i.content || ""),
          l = Date.now() - o;
        return { score: qp(c, t), latencyMs: l };
      }
      return {
        score: 0,
        latencyMs: 0,
        error: `Unknown scenario type: ${t.type}`,
      };
    } catch (n) {
      return { score: 0, latencyMs: Date.now() - o, error: n.message };
    }
  }
  async function Sx(t = {}) {
    let e = t.models || ["kimi-k2.5", "qwen3.5:397b", "minimax-m2.7:cloud"],
      s = t.onProgress || (() => {}),
      o = [];
    for (let r of e) {
      let i = { model: r, scores: [], latencies: [] },
        c = [],
        l = [];
      for (let h of jp) {
        s({ model: r, scenario: h.id, done: !1 });
        let p = await Fp(h, r);
        (i.scores.push(p.score),
          i.latencies.push(p.latencyMs),
          h.type === "decompose" && c.push(p.score),
          h.type === "synthesize" && l.push(p.score),
          s({
            model: r,
            scenario: h.id,
            done: !0,
            score: p.score,
            error: p.error,
          }));
      }
      let u = c.length > 0 ? c.reduce((h, p) => h + p, 0) / c.length : 0,
        d = l.length > 0 ? l.reduce((h, p) => h + p, 0) / l.length : 0,
        f = i.latencies.reduce((h, p) => h + p, 0) / i.latencies.length,
        m = u * 0.6 + d * 0.4;
      o.push({
        model: r,
        decompose: Math.round(u * 10) / 10,
        synthesize: Math.round(d * 10) / 10,
        avgLatency: Math.round(f),
        overall: Math.round(m * 10) / 10,
      });
    }
    o.sort((r, i) => i.overall - r.overall);
    let n = Lp.dirname(Rr);
    return (
      Ga.existsSync(n) || Ga.mkdirSync(n, { recursive: !0 }),
      Ga.writeFileSync(
        Rr,
        JSON.stringify(
          { date: new Date().toISOString().slice(0, 10), results: o },
          null,
          2,
        ),
      ),
      o
    );
  }
  function Ex(t) {
    console.log(`
${gt.bold}${gt.cyan}Orchestrator Model Benchmark${gt.reset}
`);
    let e = `  ${"Model".padEnd(25)} ${"Decompose".padEnd(10)} ${"Synthesize".padEnd(11)} ${"Speed".padEnd(8)} ${"Score".padEnd(8)}`;
    (console.log(`${gt.dim}${e}${gt.reset}`),
      console.log(`  ${gt.dim}${"\u2500".repeat(65)}${gt.reset}`));
    for (let s of t) {
      let o =
          t.indexOf(s) === 0
            ? "\u{1F947}"
            : t.indexOf(s) === 1
              ? "\u{1F948}"
              : t.indexOf(s) === 2
                ? "\u{1F949}"
                : " ",
        n = `${(s.avgLatency / 1e3).toFixed(1)}s`;
      console.log(
        `${o} ${s.model.padEnd(25)} ${(s.decompose + "/10").padEnd(10)} ${(s.synthesize + "/10").padEnd(11)} ${n.padEnd(8)} ${gt.bold}${s.overall}/10${gt.reset}`,
      );
    }
    t.length > 0 &&
      (console.log(`
  ${gt.green}Best orchestrator: ${t[0].model} (${t[0].overall}/10)${gt.reset}`),
      console.log(`  ${gt.dim}Saved to ${Rr}${gt.reset}
`));
  }
  Up.exports = {
    runOrchestratorBenchmark: Sx,
    ORCHESTRATOR_SCENARIOS: jp,
    scoreDecompose: Dp,
    scoreSynthesize: qp,
    runScenario: Fp,
    printResults: Ex,
    RESULTS_PATH: Rr,
  };
});
var Gp = K((xv, Hp) => {
  var Tx = require("axios"),
    Vs = require("fs"),
    Bp = require("path"),
    Rx = "nex-code",
    Ka = Bp.join(process.cwd(), ".nex"),
    Ya = Bp.join(Ka, "last-version-check");
  Vs.existsSync(Ka) || Vs.mkdirSync(Ka, { recursive: !0 });
  async function Cx() {
    try {
      let t = Ox(),
        e = Date.now();
      if (t && e - t < 1440 * 60 * 1e3) return { hasNewVersion: !1 };
      Nx(e);
      let s = Ax(),
        n = (
          await Tx.get(`https://registry.npmjs.org/${Rx}/latest`, {
            timeout: 5e3,
          })
        ).data.version,
        r = Mx(n, s);
      return {
        hasNewVersion: r,
        latestVersion: r ? n : void 0,
        currentVersion: r ? s : void 0,
      };
    } catch {
      return { hasNewVersion: !1 };
    }
  }
  function Ax() {
    return Cn().version;
  }
  function Ox() {
    try {
      if (Vs.existsSync(Ya)) {
        let t = Vs.readFileSync(Ya, "utf8");
        return parseInt(t, 10);
      }
    } catch {}
    return null;
  }
  function Nx(t) {
    try {
      Vs.writeFileSync(Ya, t.toString());
    } catch {}
  }
  function Mx(t, e) {
    try {
      let s = t.split(".").map(Number),
        o = e.split(".").map(Number);
      return s[0] > o[0]
        ? !0
        : s[0] < o[0]
          ? !1
          : s[1] > o[1]
            ? !0
            : s[1] < o[1]
              ? !1
              : s[2] > o[2];
    } catch {
      return !1;
    }
  }
  Hp.exports = { checkForNewVersion: Cx };
});
var om = K((vv, sm) => {
  var Px = require("readline"),
    tt = require("fs"),
    We = require("path"),
    { C: a, banner: Ix, cleanupTerminal: Kp } = Ce(),
    { isDark: Lx } = dn(),
    {
      listProviders: Ja,
      getActiveProviderName: Rn,
      listAllModels: kv,
      setFallbackChain: jx,
      getFallbackChain: Dx,
      getProvider: qx,
    } = Ae(),
    { flushAutoSave: Yp } = Rt(),
    { getActiveModel: Yt, setActiveModel: Va } = Dn(),
    { printContext: zp } = Zo(),
    { loadAllSkills: Fx, getSkillCommands: Ar, handleSkillCommand: Ux } = tn(),
    {
      setReadlineInterface: Wx,
      setAutoConfirm: Bx,
      getAutoConfirm: za,
      setAllowAlwaysHandler: Hx,
    } = Ye(),
    { StickyFooter: Gx } = sp(),
    vt = process.cwd(),
    Kt = null;
  function Xp() {
    return Kt?.signal ?? null;
  }
  var eo = [
    { cmd: "/help", desc: "Show full help" },
    { cmd: "/model", desc: "Show/switch model" },
    { cmd: "/providers", desc: "List providers and models" },
    { cmd: "/fallback", desc: "Show/set fallback chain" },
    { cmd: "/tokens", desc: "Token usage and context budget" },
    { cmd: "/costs", desc: "Session token costs" },
    { cmd: "/budget", desc: "Show/set cost limits per provider" },
    { cmd: "/clear", desc: "Clear conversation" },
    { cmd: "/context", desc: "Show project context" },
    { cmd: "/tree [depth]", desc: "Show project file tree (default depth 3)" },
    { cmd: "/autoconfirm", desc: "Toggle auto-confirm" },
    { cmd: "/save", desc: "Save session" },
    { cmd: "/load", desc: "Load a saved session" },
    { cmd: "/sessions", desc: "List saved sessions" },
    { cmd: "/resume", desc: "Resume last session" },
    { cmd: "/remember", desc: "Save a memory" },
    { cmd: "/forget", desc: "Delete a memory" },
    { cmd: "/memory", desc: "Show all memories" },
    { cmd: "/brain", desc: "Manage knowledge base" },
    { cmd: "/brain add", desc: "Add document: /brain add <name> [content]" },
    { cmd: "/brain list", desc: "List all brain documents" },
    { cmd: "/brain search", desc: "Search brain: /brain search <query>" },
    { cmd: "/brain show", desc: "Show document: /brain show <name>" },
    { cmd: "/brain remove", desc: "Remove document: /brain remove <name>" },
    { cmd: "/brain rebuild", desc: "Rebuild keyword index" },
    { cmd: "/brain embed", desc: "Build/rebuild embedding index" },
    {
      cmd: "/brain status",
      desc: "Show brain status (docs, index, embeddings)",
    },
    { cmd: "/brain review", desc: "Review pending brain changes (git diff)" },
    { cmd: "/brain undo", desc: "Undo last brain write" },
    { cmd: "/learn", desc: "Reflect on session and update memory" },
    { cmd: "/optimize", desc: "Show optimization opportunities" },
    { cmd: "/permissions", desc: "Show tool permissions" },
    { cmd: "/allow", desc: "Auto-allow a tool" },
    { cmd: "/deny", desc: "Block a tool" },
    { cmd: "/plan", desc: "Plan mode (analyze before executing)" },
    { cmd: "/plan edit", desc: "Open current plan in $EDITOR" },
    { cmd: "/plans", desc: "List saved plans" },
    { cmd: "/auto", desc: "Set autonomy level" },
    { cmd: "/commit", desc: "Smart commit (diff + message)" },
    { cmd: "/diff", desc: "Show current diff" },
    {
      cmd: "/review [--strict] [file]",
      desc: "Deep code review with score table and diff suggestions (--strict: force \u22653 critical findings)",
    },
    { cmd: "/branch", desc: "Create feature branch" },
    { cmd: "/mcp", desc: "MCP servers and tools" },
    { cmd: "/hooks", desc: "Show configured hooks" },
    { cmd: "/skills", desc: "List, enable, disable skills" },
    {
      cmd: "/install-skill <url>",
      desc: "Install a skill from git URL or user/repo",
    },
    { cmd: "/search-skill <query>", desc: "Search for skills on GitHub" },
    { cmd: "/remove-skill <name>", desc: "Remove an installed skill" },
    { cmd: "/tasks", desc: "Show task list" },
    { cmd: "/servers", desc: "List server profiles / ping" },
    { cmd: "/docker", desc: "List containers across all servers" },
    { cmd: "/deploy", desc: "List deploy configs / run named deploy" },
    {
      cmd: "/benchmark [--quick] [--models=a,b]",
      desc: "Rank Ollama Cloud models on nex-code tool-calling tasks (--history for nightly log)",
    },
    {
      cmd: "/bench [--dry-run] [--model=<spec>]",
      desc: "Run Jarvis scenario benchmark (5 agentic tasks)",
    },
    {
      cmd: "/trend [n]",
      desc: "Show score history trend (default: last 10 sessions)",
    },
    { cmd: "/init", desc: "Interactive setup wizard (.nex/)" },
    { cmd: "/setup", desc: "Configure provider and API keys" },
    { cmd: "/undo", desc: "Undo last file change" },
    { cmd: "/redo", desc: "Redo last undone change" },
    { cmd: "/history", desc: "Show file change history" },
    {
      cmd: "/snapshot [name]",
      desc: "Create a named git snapshot of current changes",
    },
    {
      cmd: "/restore [name|last]",
      desc: "Restore a previously created snapshot",
    },
    {
      cmd: "/orchestrate <prompt>",
      desc: "Decompose prompt into parallel sub-tasks, run, synthesize",
    },
    {
      cmd: "/bench-orchestrator",
      desc: "Benchmark models for orchestrator role",
    },
    { cmd: "/audit", desc: "Show tool execution audit log" },
    { cmd: "/k8s", desc: "Kubernetes overview: namespaces and pods" },
    { cmd: "/exit", desc: "Quit" },
  ];
  function Jp() {
    let t = Ar(),
      e = [...eo, ...t],
      s = Math.max(...e.map((o) => o.cmd.length));
    console.log("");
    for (let { cmd: o, desc: n } of eo)
      console.log(
        `  ${a.cyan}${o.padEnd(s + 2)}${a.reset}${a.dim}${n}${a.reset}`,
      );
    for (let { cmd: o, desc: n } of t)
      console.log(
        `  ${a.cyan}${o.padEnd(s + 2)}${a.reset}${a.dim}${n} ${a.yellow}[skill]${a.reset}`,
      );
    console.log(`
${a.dim}Type /help for detailed usage${a.reset}
`);
  }
  function Vp(t) {
    try {
      let e, s;
      (t.endsWith("/") || t.endsWith(We.sep)
        ? ((e = t), (s = ""))
        : ((e = We.dirname(t)), (s = We.basename(t))),
        e.startsWith("~") &&
          (e = We.join(require("os").homedir(), e.slice(1))));
      let o = We.isAbsolute(e) ? e : We.resolve(vt, e);
      if (!tt.existsSync(o) || !tt.statSync(o).isDirectory()) return [];
      let n = tt.readdirSync(o, { withFileTypes: !0 }),
        r = [];
      for (let i of n) {
        if (
          i.name.startsWith(".") ||
          i.name === "node_modules" ||
          (s && !i.name.startsWith(s))
        )
          continue;
        let c = t.endsWith("/") || t.endsWith(We.sep) ? t : We.dirname(t) + "/",
          l = c === "./" && !t.startsWith("./") ? i.name : c + i.name;
        r.push(i.isDirectory() ? l + "/" : l);
      }
      return r;
    } catch {
      return [];
    }
  }
  function Qp(t) {
    if (t.startsWith("/")) {
      let o = [...eo, ...Ar()],
        n = o.map((r) => r.cmd).filter((r) => r.startsWith(t));
      return [n.length ? n : o.map((r) => r.cmd), t];
    }
    let e = t.split(/\s+/),
      s = e[e.length - 1] || "";
    return s &&
      (s.includes("/") ||
        s.startsWith("./") ||
        s.startsWith("../") ||
        s.startsWith("~"))
      ? [Vp(s), s]
      : [[], t];
  }
  function Zp() {
    console.log(`
${a.bold}${a.cyan}Commands:${a.reset}
  ${a.cyan}/help${a.reset}             ${a.dim}Show this help${a.reset}
  ${a.cyan}/model [spec]${a.reset}     ${a.dim}Show/switch model (e.g. openai:gpt-4o, claude-sonnet)${a.reset}
  ${a.cyan}/providers${a.reset}        ${a.dim}Show available providers and models${a.reset}
  ${a.cyan}/fallback [chain]${a.reset} ${a.dim}Show/set fallback chain (e.g. anthropic,openai,local)${a.reset}
  ${a.cyan}/tokens${a.reset}           ${a.dim}Show token usage and context budget${a.reset}
  ${a.cyan}/costs${a.reset}            ${a.dim}Show session token costs${a.reset}
  ${a.cyan}/budget [prov] [n]${a.reset}${a.dim}Show/set cost limits per provider${a.reset}
  ${a.cyan}/clear${a.reset}            ${a.dim}Clear conversation context${a.reset}
  ${a.cyan}/context${a.reset}          ${a.dim}Show project context${a.reset}
  ${a.cyan}/autoconfirm${a.reset}      ${a.dim}Toggle auto-confirm for file changes${a.reset}

${a.bold}${a.cyan}Sessions:${a.reset}
  ${a.cyan}/save [name]${a.reset}      ${a.dim}Save current session${a.reset}
  ${a.cyan}/load <name>${a.reset}      ${a.dim}Load a saved session${a.reset}
  ${a.cyan}/sessions${a.reset}         ${a.dim}List all saved sessions${a.reset}
  ${a.cyan}/resume${a.reset}           ${a.dim}Resume last session${a.reset}

${a.bold}${a.cyan}Memory:${a.reset}
  ${a.cyan}/remember <text>${a.reset}  ${a.dim}Save a memory (key=value or freeform)${a.reset}
  ${a.cyan}/forget <key>${a.reset}     ${a.dim}Delete a memory${a.reset}
  ${a.cyan}/memory${a.reset}           ${a.dim}Show all memories${a.reset}
  ${a.cyan}/learn${a.reset}            ${a.dim}Reflect on this session and auto-update memory + NEX.md${a.reset}
  ${a.cyan}/optimize${a.reset}         ${a.dim}Show context, memory health, and optimization tips${a.reset}

${a.bold}${a.cyan}Permissions:${a.reset}
  ${a.cyan}/permissions${a.reset}      ${a.dim}Show tool permissions${a.reset}
  ${a.cyan}/allow <tool>${a.reset}     ${a.dim}Auto-allow a tool${a.reset}
  ${a.cyan}/deny <tool>${a.reset}      ${a.dim}Block a tool${a.reset}

${a.bold}${a.cyan}Planning:${a.reset}
  ${a.cyan}/plan [task]${a.reset}      ${a.dim}Enter plan mode (analyze, don't execute)${a.reset}
  ${a.cyan}/plan status${a.reset}      ${a.dim}Show current plan progress${a.reset}
  ${a.cyan}/plan approve${a.reset}     ${a.dim}Approve current plan${a.reset}
  ${a.cyan}/plans${a.reset}            ${a.dim}List saved plans${a.reset}
  ${a.cyan}/auto [level]${a.reset}     ${a.dim}Set autonomy: interactive/semi-auto/autonomous${a.reset}

${a.bold}${a.cyan}Git:${a.reset}
  ${a.cyan}/commit [msg]${a.reset}    ${a.dim}Smart commit (analyze diff, suggest message)${a.reset}
  ${a.cyan}/diff${a.reset}             ${a.dim}Show current diff summary${a.reset}
  ${a.cyan}/branch [name]${a.reset}   ${a.dim}Create feature branch${a.reset}

${a.bold}${a.cyan}Extensibility:${a.reset}
  ${a.cyan}/mcp${a.reset}              ${a.dim}Show MCP servers and tools${a.reset}
  ${a.cyan}/mcp connect${a.reset}      ${a.dim}Connect all configured MCP servers${a.reset}
  ${a.cyan}/hooks${a.reset}            ${a.dim}Show configured hooks${a.reset}
  ${a.cyan}/skills${a.reset}           ${a.dim}List loaded skills${a.reset}
  ${a.cyan}/skills enable${a.reset}    ${a.dim}Enable a skill by name${a.reset}
  ${a.cyan}/skills disable${a.reset}   ${a.dim}Disable a skill by name${a.reset}

${a.bold}${a.cyan}Tasks:${a.reset}
  ${a.cyan}/tasks${a.reset}            ${a.dim}Show current task list${a.reset}
  ${a.cyan}/tasks clear${a.reset}      ${a.dim}Clear all tasks${a.reset}

${a.bold}${a.cyan}Undo / Redo:${a.reset}
  ${a.cyan}/undo${a.reset}             ${a.dim}Undo last file change${a.reset}
  ${a.cyan}/redo${a.reset}             ${a.dim}Redo last undone change${a.reset}
  ${a.cyan}/history${a.reset}          ${a.dim}Show file change history${a.reset}

  ${a.cyan}/benchmark${a.reset}        ${a.dim}Rank Ollama Cloud models on nex-code tool-calling tasks${a.reset}
  ${a.cyan}/benchmark --quick${a.reset}${a.dim}  Fast run: 7 tasks, 3 models${a.reset}
  ${a.cyan}/benchmark --models=a,b${a.reset}${a.dim}  Custom model list${a.reset}

  ${a.cyan}/exit${a.reset}             ${a.dim}Quit${a.reset}
`);
  }
  function em(t) {
    let s = Math.round((t / 100) * 30),
      o = 30 - s;
    return `  ${t > 80 ? a.red : t > 50 ? a.yellow : a.green}${"\u2588".repeat(s)}${a.dim}${"\u2591".repeat(o)}${a.reset} ${t}%`;
  }
  function Xa() {
    let t = Ja(),
      e = Rn(),
      s = Yt();
    console.log(`
${a.bold}${a.cyan}Providers:${a.reset}`);
    for (let o of t) {
      let n = o.provider === e,
        r = o.configured
          ? `${a.green}\u2713${a.reset}`
          : `${a.red}\u2717${a.reset}`,
        i = n ? ` ${a.cyan}(active)${a.reset}` : "";
      console.log(`  ${r} ${a.bold}${o.provider}${a.reset}${i}`);
      for (let c of o.models) {
        let l = c.id === s.id && n ? ` ${a.yellow}\u25C4${a.reset}` : "";
        console.log(`    ${a.dim}${c.id}${a.reset} \u2014 ${c.name}${l}`);
      }
    }
    console.log();
  }
  async function tm(t, e) {
    let [s, ...o] = t.split(/\s+/);
    switch (s) {
      case "/help":
        return (Zp(), !0);
      case "/model": {
        let n = o.join(" ").trim();
        if (!n) {
          if (e) {
            let { showModelPicker: r } = ip();
            await r(e);
          } else {
            let r = Yt(),
              i = Rn();
            (console.log(
              `${a.bold}${a.cyan}Active model:${a.reset} ${a.dim}${i}:${r.id} (${r.name})${a.reset}`,
            ),
              console.log(
                `${a.gray}Use /model <provider:model> to switch. /providers to see all.${a.reset}`,
              ));
          }
          return !0;
        }
        if (n === "list") return (Xa(), !0);
        if (Va(n)) {
          let r = Yt(),
            i = Rn();
          console.log(
            `${a.green}Switched to ${i}:${r.id} (${r.name})${a.reset}`,
          );
        } else
          (console.log(`${a.red}Unknown model: ${n}${a.reset}`),
            console.log(
              `${a.gray}Use /providers to see available models${a.reset}`,
            ));
        return !0;
      }
      case "/providers":
        return (Xa(), !0);
      case "/fallback": {
        let n = o.join(" ").trim();
        if (!n) {
          let i = Dx();
          return (
            i.length === 0
              ? (console.log(`${a.dim}No fallback chain configured${a.reset}`),
                console.log(
                  `${a.dim}Use /fallback anthropic,openai,local to set${a.reset}`,
                ))
              : console.log(
                  `${a.bold}${a.cyan}Fallback chain:${a.reset} ${i.join(" \u2192 ")}`,
                ),
            !0
          );
        }
        let r = n
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean);
        return (
          jx(r),
          console.log(
            `${a.green}Fallback chain: ${r.join(" \u2192 ")}${a.reset}`,
          ),
          !0
        );
      }
      case "/tokens": {
        let { getConversationMessages: n } = ve(),
          { getUsage: r } = Je(),
          { TOOL_DEFINITIONS: i } = St(),
          c = n(),
          l = r(c, i),
          u = Yt(),
          d = Rn();
        (console.log(`
${a.bold}${a.cyan}Token Usage:${a.reset}`),
          console.log(
            `  ${a.dim}Model:${a.reset} ${d}:${u.id} (${(l.limit / 1e3).toFixed(0)}k context)`,
          ),
          console.log(
            `  ${a.dim}Used:${a.reset}  ${l.used.toLocaleString()} / ${l.limit.toLocaleString()} (${l.percentage}%)`,
          ));
        let f = em(l.percentage);
        return (
          console.log(`  ${f}`),
          console.log(`
  ${a.dim}Breakdown:${a.reset}`),
          console.log(
            `    System prompt:    ${l.breakdown.system.toLocaleString()} tokens`,
          ),
          console.log(
            `    Conversation:     ${l.breakdown.conversation.toLocaleString()} tokens`,
          ),
          console.log(
            `    Tool results:     ${l.breakdown.toolResults.toLocaleString()} tokens`,
          ),
          console.log(
            `    Tool definitions: ${l.breakdown.toolDefinitions.toLocaleString()} tokens`,
          ),
          console.log(`    Messages:         ${l.messageCount}`),
          console.log(),
          !0
        );
      }
      case "/costs": {
        let { formatCosts: n, resetCosts: r } = jn();
        return o.join(" ").trim() === "reset"
          ? (r(), console.log(`${a.green}Cost tracking reset${a.reset}`), !0)
          : (console.log(`
${n()}
`),
            !0);
      }
      case "/budget": {
        let {
            getCostLimits: n,
            getProviderSpend: r,
            checkBudget: i,
            removeCostLimit: c,
            saveCostLimits: l,
            setCostLimit: u,
          } = jn(),
          d = o[0];
        if (!d) {
          let h = n(),
            p = Ja();
          console.log(`
${a.bold}${a.cyan}Cost Limits:${a.reset}`);
          let g = !1;
          for (let $ of p) {
            let w = r($.provider),
              _ = h[$.provider];
            if (_ !== void 0) {
              g = !0;
              let x = Math.min(100, Math.round((w / _) * 100)),
                v = 10,
                b = Math.round((x / 100) * v),
                k = v - b,
                O = `${x >= 100 ? a.red : x >= 80 ? a.yellow : a.green}${"\u2588".repeat(b)}${a.dim}${"\u2591".repeat(k)}${a.reset}`;
              console.log(
                `  ${a.bold}${$.provider}:${a.reset}  $${w.toFixed(2)} / $${_.toFixed(2)}  (${x}%)  ${O}`,
              );
            } else
              $.provider === "ollama" || $.provider === "local"
                ? console.log(
                    `  ${a.bold}${$.provider}:${a.reset}  ${a.dim}free (no limit)${a.reset}`,
                  )
                : w > 0 &&
                  console.log(
                    `  ${a.bold}${$.provider}:${a.reset}  $${w.toFixed(2)} ${a.dim}(no limit)${a.reset}`,
                  );
          }
          return (
            g ||
              console.log(
                `  ${a.dim}No limits set. Use /budget <provider> <amount> to set one.${a.reset}`,
              ),
            console.log(),
            !0
          );
        }
        let f = o[1];
        if (!f) {
          let h = i(d);
          return (
            h.limit !== null
              ? console.log(
                  `${a.bold}${d}:${a.reset} $${h.spent.toFixed(2)} / $${h.limit.toFixed(2)} ($${h.remaining.toFixed(2)} remaining)`,
                )
              : console.log(
                  `${a.bold}${d}:${a.reset} $${h.spent.toFixed(2)} ${a.dim}(no limit)${a.reset}`,
                ),
            !0
          );
        }
        if (f === "off" || f === "remove" || f === "clear")
          return (
            c(d),
            l(),
            console.log(`${a.green}Removed cost limit for ${d}${a.reset}`),
            !0
          );
        let m = parseFloat(f);
        return isNaN(m) || m <= 0
          ? (console.log(
              `${a.red}Invalid amount: ${f}. Use a positive number or 'off'.${a.reset}`,
            ),
            !0)
          : (u(d, m),
            l(),
            console.log(
              `${a.green}Set ${d} budget limit: $${m.toFixed(2)}${a.reset}`,
            ),
            !0);
      }
      case "/clear": {
        let { clearConversation: n, getConversationMessages: r } = ve(),
          { clearHistory: i } = Ft(),
          c = r();
        if (c.filter((d) => d.role === "user").length >= 4) {
          process.stdout.write(`${a.dim}Reflecting on session...${a.reset} `);
          let { learnFromSession: d } = Da();
          d(c)
            .then((f) => {
              if (
                !f.skipped &&
                !f.error &&
                (f.applied.length > 0 || f.nexAdded.length > 0)
              ) {
                let m = f.applied.length + f.nexAdded.length;
                process.stdout.write(`${a.green}${m} learning(s) saved${a.reset}
`);
              } else
                process.stdout.write(`${a.dim}nothing new${a.reset}
`);
            })
            .catch(() =>
              process.stdout.write(`
`),
            );
        }
        (n(), i());
        let { deleteSession: u } = Rt();
        return (
          u("_autosave"),
          console.log(`${a.green}Conversation cleared${a.reset}`),
          !0
        );
      }
      case "/context":
        return (await zp(vt), !0);
      case "/tree": {
        let { generateFileTree: n } = Zo(),
          r = parseInt(o.join(" ").trim(), 10),
          i = !isNaN(r) && r > 0 ? Math.min(r, 8) : 3,
          c = n(vt, { maxDepth: i, maxFiles: 300 });
        return (
          console.log(`
${a.bold}${a.cyan}Project tree${a.reset}${a.dim} (depth ${i})${a.reset}
`),
          console.log(`${a.dim}${c}${a.reset}
`),
          !0
        );
      }
      case "/autoconfirm": {
        let n = !za();
        return (
          Bx(n),
          console.log(`${a.green}Auto-confirm: ${n ? "ON" : "OFF"}${a.reset}`),
          n &&
            console.log(
              `${a.yellow}  \u26A0 File changes will be applied without confirmation${a.reset}`,
            ),
          Qs(),
          !0
        );
      }
      case "/save": {
        let { saveSession: n } = Rt(),
          { getConversationMessages: r } = ve(),
          i = o.join(" ").trim() || `session-${Date.now()}`,
          c = r();
        if (c.length === 0)
          return (
            console.log(`${a.yellow}No conversation to save${a.reset}`),
            !0
          );
        let l = Yt(),
          u = Rn();
        return (
          n(i, c, { model: l.id, provider: u }),
          console.log(
            `${a.green}Session saved: ${i} (${c.length} messages)${a.reset}`,
          ),
          !0
        );
      }
      case "/load": {
        let { loadSession: n } = Rt(),
          { setConversationMessages: r } = ve(),
          i = o.join(" ").trim();
        if (!i)
          return (console.log(`${a.red}Usage: /load <name>${a.reset}`), !0);
        let c = n(i);
        return c
          ? (r(c.messages),
            console.log(
              `${a.green}Loaded session: ${c.name} (${c.messageCount} messages)${a.reset}`,
            ),
            !0)
          : (console.log(`${a.red}Session not found: ${i}${a.reset}`), !0);
      }
      case "/sessions": {
        let { listSessions: n } = Rt(),
          r = n();
        if (r.length === 0)
          return (console.log(`${a.dim}No saved sessions${a.reset}`), !0);
        console.log(`
${a.bold}${a.cyan}Sessions:${a.reset}`);
        for (let i of r) {
          let c = i.updatedAt ? new Date(i.updatedAt).toLocaleString() : "?",
            l = i.name === "_autosave" ? ` ${a.dim}(auto)${a.reset}` : "",
            u =
              i.score != null
                ? ` \xB7 score ${i.score}/10${i.scoreGrade ? ` (${i.scoreGrade})` : ""}`
                : "";
          console.log(
            `  ${a.cyan}${i.name}${a.reset}${l} \u2014 ${i.messageCount} msgs, ${c}${a.dim}${u}${a.reset}`,
          );
        }
        return (console.log(), !0);
      }
      case "/resume": {
        let { getLastSession: n } = Rt(),
          { setConversationMessages: r } = ve(),
          i = n();
        return i
          ? (r(i.messages),
            console.log(
              `${a.green}Resumed: ${i.name} (${i.messageCount} messages)${a.reset}`,
            ),
            !0)
          : (console.log(`${a.yellow}No session to resume${a.reset}`), !0);
      }
      case "/remember": {
        let { remember: n } = rn(),
          r = o.join(" ").trim();
        if (!r)
          return (
            console.log(
              `${a.red}Usage: /remember <key>=<value> or /remember <text>${a.reset}`,
            ),
            !0
          );
        let i = r.indexOf("="),
          c,
          l;
        return (
          i > 0
            ? ((c = r.substring(0, i).trim()), (l = r.substring(i + 1).trim()))
            : ((c = r.substring(0, 40).replace(/\s+/g, "-")), (l = r)),
          n(c, l),
          console.log(`${a.green}Remembered: ${c}${a.reset}`),
          !0
        );
      }
      case "/forget": {
        let { forget: n } = rn(),
          r = o.join(" ").trim();
        return r
          ? (n(r)
              ? console.log(`${a.green}Forgotten: ${r}${a.reset}`)
              : console.log(`${a.red}Memory not found: ${r}${a.reset}`),
            !0)
          : (console.log(`${a.red}Usage: /forget <key>${a.reset}`), !0);
      }
      case "/memory": {
        let { listMemories: n } = rn(),
          r = n();
        if (r.length === 0)
          return (console.log(`${a.dim}No memories saved${a.reset}`), !0);
        console.log(`
${a.bold}${a.cyan}Memory:${a.reset}`);
        for (let i of r)
          console.log(`  ${a.cyan}${i.key}${a.reset} = ${i.value}`);
        return (console.log(), !0);
      }
      case "/brain": {
        let {
            listDocuments: n,
            readDocument: r,
            writeDocument: i,
            removeDocument: c,
            buildIndex: l,
            buildEmbeddingIndex: u,
            isEmbeddingAvailable: d,
            query: f,
          } = Ss(),
          m = o[0],
          h = o.slice(1).join(" ").trim();
        switch (m) {
          case "add": {
            if (!h)
              return (
                console.log(
                  `${a.red}Usage: /brain add <name> [content]${a.reset}`,
                ),
                console.log(
                  `${a.dim}  /brain add api-notes \u2014 creates empty file${a.reset}`,
                ),
                console.log(
                  `${a.dim}  /brain add api-notes This is content \u2014 writes directly${a.reset}`,
                ),
                !0
              );
            let p = h.indexOf(" ");
            if (p < 0) {
              i(
                h,
                `# ${h}

`,
              );
              let g = require("path").join(
                process.cwd(),
                ".nex",
                "brain",
                `${h}.md`,
              );
              (console.log(`${a.green}Created .nex/brain/${h}.md${a.reset}`),
                console.log(`${a.dim}Edit it directly at: ${g}${a.reset}`));
            } else {
              let g = h.substring(0, p),
                $ = h.substring(p + 1);
              (i(g, $),
                console.log(`${a.green}Added to brain: ${g}${a.reset}`));
            }
            return !0;
          }
          case "list": {
            let p = n();
            if (p.length === 0)
              return (
                console.log(
                  `${a.dim}No brain documents yet. Use /brain add <name> to create one.${a.reset}`,
                ),
                !0
              );
            console.log(`
${a.bold}${a.cyan}Brain Documents:${a.reset}`);
            let g = Math.max(8, ...p.map((w) => w.name.length)),
              $ = 20;
            (console.log(
              `  ${"Name".padEnd(g + 2)}${"Tags".padEnd($)}${"Size".padStart(7)}  Modified`,
            ),
              console.log(
                `  ${"-".repeat(g + 2)}${"-".repeat($)}${"-".repeat(7)}  --------`,
              ));
            for (let w of p) {
              let { frontmatter: _ } = r(w.name),
                x = Array.isArray(_.tags) ? _.tags.join(", ") : "",
                v =
                  w.size < 1024
                    ? `${w.size}B`
                    : `${(w.size / 1024).toFixed(1)}K`,
                b = w.modified.toLocaleDateString();
              console.log(
                `  ${a.cyan}${w.name.padEnd(g + 2)}${a.reset}${a.dim}${x.substring(0, $ - 1).padEnd($)}${v.padStart(7)}  ${b}${a.reset}`,
              );
            }
            return (console.log(), !0);
          }
          case "search": {
            if (!h)
              return (
                console.log(`${a.red}Usage: /brain search <query>${a.reset}`),
                !0
              );
            let p = await f(h, { topK: 5 });
            if (p.length === 0)
              return (
                console.log(
                  `${a.dim}No matching brain documents for: ${h}${a.reset}`,
                ),
                !0
              );
            console.log(`
${a.bold}${a.cyan}Brain Search: "${h}"${a.reset}`);
            for (let g of p) {
              let $ = typeof g.score == "number" ? g.score.toFixed(2) : g.score;
              (console.log(`
  ${a.cyan}${g.name}${a.reset} ${a.dim}(score: ${$})${a.reset}`),
                console.log(`  ${a.dim}${g.excerpt || ""}${a.reset}`));
            }
            return (console.log(), !0);
          }
          case "show": {
            if (!h)
              return (
                console.log(`${a.red}Usage: /brain show <name>${a.reset}`),
                !0
              );
            let p = r(h);
            return p.content
              ? (console.log(`
${a.bold}${a.cyan}${h}.md${a.reset}
`),
                console.log(p.content),
                !0)
              : (console.log(`${a.red}Document not found: ${h}${a.reset}`), !0);
          }
          case "remove": {
            if (!h)
              return (
                console.log(`${a.red}Usage: /brain remove <name>${a.reset}`),
                !0
              );
            let { confirm: p } = Ye();
            if (!(await p(`Remove brain document "${h}"?`)))
              return (console.log(`${a.dim}Cancelled${a.reset}`), !0);
            let $ = c(h);
            return (
              console.log(
                $
                  ? `${a.green}Removed: ${h}.md${a.reset}`
                  : `${a.red}Document not found: ${h}${a.reset}`,
              ),
              !0
            );
          }
          case "rebuild": {
            let p = l(),
              g = Object.keys(p.documents).length;
            return (
              console.log(
                `${a.green}Index rebuilt: ${g} document(s)${a.reset}`,
              ),
              !0
            );
          }
          case "embed": {
            if (!(await d()))
              return (
                console.log(
                  `${a.yellow}Ollama embedding model not available.${a.reset}`,
                ),
                console.log(
                  `${a.dim}Set NEX_EMBED_MODEL env var (default: nomic-embed-text) and ensure Ollama is running.${a.reset}`,
                ),
                !0
              );
            console.log(`${a.dim}Building embedding index...${a.reset}`);
            try {
              let g = await u(),
                $ = Object.keys(g.documents || {}).length;
              console.log(
                `${a.green}Embedding index built: ${$} document(s)${a.reset}`,
              );
            } catch (g) {
              console.log(`${a.red}Embedding failed: ${g.message}${a.reset}`);
            }
            return !0;
          }
          case "status": {
            let p = n(),
              g = require("fs"),
              $ = require("path"),
              w = $.join(process.cwd(), ".nex", "brain", ".brain-index.json"),
              _ = $.join(process.cwd(), ".nex", "brain", ".embeddings.json");
            if (
              (console.log(`
${a.bold}${a.cyan}Brain Status${a.reset}`),
              console.log(`  Documents:  ${p.length}`),
              console.log(
                `  Index:      ${g.existsSync(w) ? a.green + "present" + a.reset : a.dim + "not built" + a.reset}`,
              ),
              console.log(
                `  Embeddings: ${g.existsSync(_) ? a.green + "present" + a.reset : a.dim + "not built (run /brain embed)" + a.reset}`,
              ),
              p.length > 0)
            ) {
              let x = p.reduce((v, b) => v + b.size, 0);
              console.log(
                `  Total size: ${x < 1024 ? x + "B" : (x / 1024).toFixed(1) + "K"}`,
              );
            }
            return (console.log(), !0);
          }
          case "review": {
            let { exec: p } = require("child_process"),
              { promisify: g } = require("util"),
              $ = g(p);
            try {
              let { stdout: w } = await $("git diff .nex/brain/", {
                cwd: process.cwd(),
              });
              w.trim()
                ? (console.log(`
${a.bold}${a.cyan}Brain Changes (git diff):${a.reset}
`),
                  console.log(w))
                : console.log(
                    `${a.dim}No pending brain changes (clean git state)${a.reset}`,
                  );
            } catch {
              console.log(`${a.dim}Not a git repo or no brain dir${a.reset}`);
            }
            return !0;
          }
          case "undo": {
            let p = require("fs"),
              $ = require("path").join(process.cwd(), ".nex", "brain");
            if (!p.existsSync($))
              return (
                console.log(`${a.dim}No brain directory found${a.reset}`),
                !0
              );
            let w = n();
            if (w.length === 0)
              return (
                console.log(`${a.dim}No brain documents to undo${a.reset}`),
                !0
              );
            let _ = w[0],
              { exec: x } = require("child_process"),
              { promisify: v } = require("util"),
              b = v(x);
            try {
              (await b(`git checkout -- ".nex/brain/${_.name}.md"`, {
                cwd: process.cwd(),
              }),
                l(),
                console.log(
                  `${a.green}Undone: restored ${_.name}.md from git${a.reset}`,
                ));
            } catch {
              console.log(
                `${a.red}Could not undo \u2014 not tracked in git or no prior version${a.reset}`,
              );
            }
            return !0;
          }
          default: {
            let p = n();
            if (p.length === 0)
              (console.log(`
${a.bold}${a.cyan}Brain Knowledge Base${a.reset}`),
                console.log(
                  `${a.dim}No documents yet. Create with /brain add <name>${a.reset}`,
                ),
                console.log(`
${a.dim}Commands: add \xB7 list \xB7 search \xB7 show \xB7 remove \xB7 rebuild \xB7 embed \xB7 status \xB7 review \xB7 undo${a.reset}
`));
            else {
              console.log(`
${a.bold}${a.cyan}Brain: ${p.length} document(s)${a.reset}`);
              for (let g of p) {
                let { frontmatter: $ } = r(g.name),
                  w = Array.isArray($.tags) ? ` [${$.tags.join(", ")}]` : "";
                console.log(
                  `  ${a.cyan}${g.name}${a.reset}${a.dim}${w}${a.reset}`,
                );
              }
              console.log(`
${a.dim}Use /brain search <query> \xB7 /brain show <name> \xB7 /brain add <name>${a.reset}
`);
            }
            return !0;
          }
        }
      }
      case "/learn": {
        let { learnFromSession: n, learnBrainFromSession: r } = Da(),
          { getConversationMessages: i } = ve(),
          c = i(),
          l = c.filter((u) => u.role === "user").length;
        if (l < 4)
          return (
            console.log(
              `${a.yellow}Session too short to learn from (need 4+ user messages, have ${l})${a.reset}`,
            ),
            !0
          );
        console.log(`${a.dim}Analyzing session for learnings...${a.reset}`);
        try {
          let [u, d] = await Promise.all([n(c), r(c)]);
          if (u.skipped && (!d.written || d.written.length === 0))
            return (console.log(`${a.dim}Session too short${a.reset}`), !0);
          (u.error &&
            console.log(`${a.red}Reflection error: ${u.error}${a.reset}`),
            console.log(""),
            u.summary &&
              (console.log(
                `${a.bold}Session:${a.reset} ${a.dim}${u.summary}${a.reset}`,
              ),
              console.log("")));
          let f = u.applied && u.applied.length > 0,
            m = u.nexAdded && u.nexAdded.length > 0,
            h = d.written && d.written.length > 0;
          if (!f && !m && !h)
            console.log(
              `${a.dim}No new learnings extracted from this session${a.reset}`,
            );
          else {
            if (f) {
              console.log(`${a.bold}${a.cyan}Memory updates:${a.reset}`);
              for (let { key: p, value: g, action: $ } of u.applied) {
                let w =
                  $ === "updated"
                    ? `${a.yellow}~${a.reset}`
                    : `${a.green}+${a.reset}`;
                console.log(`  ${w} ${a.bold}${p}${a.reset} = ${g}`);
              }
            }
            if (m) {
              console.log(`${a.bold}${a.cyan}Added to NEX.md:${a.reset}`);
              for (let p of u.nexAdded)
                console.log(`  ${a.green}+${a.reset} ${p}`);
            }
            if (h) {
              console.log(`${a.bold}${a.cyan}Brain documents:${a.reset}`);
              for (let { name: p, reason: g, action: $ } of d.written) {
                let w =
                  $ === "updated"
                    ? `${a.yellow}~${a.reset}`
                    : `${a.green}+${a.reset}`;
                console.log(
                  `  ${w} ${a.bold}${p}.md${a.reset}${g ? a.dim + " \u2014 " + g + a.reset : ""}`,
                );
              }
            }
          }
          console.log("");
        } catch (u) {
          console.log(`${a.red}Learn failed: ${u.message}${a.reset}`);
        }
        return !0;
      }
      case "/optimize": {
        let { getConversationMessages: n } = ve(),
          { getUsage: r } = Je(),
          { TOOL_DEFINITIONS: i } = St(),
          { listMemories: c } = rn(),
          l = n(),
          u = r(l, i),
          d = Yt(),
          f = Rn(),
          m = c();
        console.log(`
${a.bold}${a.cyan}Optimization Report${a.reset}
`);
        let h =
          u.percentage > 80 ? a.red : u.percentage > 50 ? a.yellow : a.green;
        if (
          (console.log(
            `${a.bold}Context Window:${a.reset} ${h}${u.percentage}%${a.reset} used (${u.used.toLocaleString()} / ${u.limit.toLocaleString()} tokens)`,
          ),
          u.percentage > 75
            ? console.log(
                `  ${a.yellow}\u2192 Tip: Use /clear to free context (auto-learns first)${a.reset}`,
              )
            : u.percentage > 50
              ? console.log(
                  `  ${a.dim}\u2192 Context is filling up, consider /clear soon${a.reset}`,
                )
              : console.log(`  ${a.green}\u2192 Context healthy${a.reset}`),
          console.log(`
${a.bold}Memory:${a.reset} ${m.length} entries`),
          m.length === 0)
        )
          console.log(
            `  ${a.yellow}\u2192 No memories yet. Use /learn after sessions or /remember key=value${a.reset}`,
          );
        else {
          let x = [...m].sort(
              (k, A) => new Date(A.updatedAt) - new Date(k.updatedAt),
            )[0],
            v = x
              ? Math.round((Date.now() - new Date(x.updatedAt)) / 6e4)
              : null,
            b =
              v !== null
                ? v < 60
                  ? `${v}m ago`
                  : `${Math.round(v / 60)}h ago`
                : "?";
          (console.log(`  ${a.dim}Latest update: ${b}${a.reset}`),
            m.length > 30 &&
              console.log(
                `  ${a.yellow}\u2192 Many memories (${m.length}) \u2014 consider pruning with /forget${a.reset}`,
              ));
        }
        console.log(`
${a.bold}Active Model:${a.reset} ${f}:${d.id}`);
        let p = d.contextWindow || d.maxTokens || 0;
        p > 0 && p < 32e3 && l.length > 10
          ? console.log(
              `  ${a.yellow}\u2192 Small context window (${(p / 1e3).toFixed(0)}k). Consider /model for larger context${a.reset}`,
            )
          : p >= 128e3 &&
            console.log(
              `  ${a.green}\u2192 Large context window (${(p / 1e3).toFixed(0)}k) \u2014 good for long sessions${a.reset}`,
            );
        let g = l.filter((_) => _.role === "user").length;
        (console.log(`
${a.bold}Session:${a.reset} ${g} turns, ${l.length} messages total`),
          g >= 4 &&
            g % 10 === 0 &&
            console.log(
              `  ${a.cyan}\u2192 Good time to /learn and capture session insights${a.reset}`,
            ));
        let $ = [],
          w = require("path").join(process.cwd(), "NEX.md");
        if (
          (require("fs").existsSync(w) ||
            $.push(
              "Create NEX.md in project root to give nex-code project-specific instructions",
            ),
          $.length > 0)
        ) {
          console.log(`
${a.bold}Quick Wins:${a.reset}`);
          for (let _ of $) console.log(`  ${a.cyan}\u2192${a.reset} ${_}`);
        }
        return (console.log(""), !0);
      }
      case "/plan": {
        let {
            getActivePlan: n,
            approvePlan: r,
            startExecution: i,
            setPlanMode: c,
            getPlanContent: l,
            getPlanContent: u,
            formatPlan: d,
            extractStepsFromText: f,
            createPlan: m,
          } = Pt(),
          { invalidateSystemPromptCache: h } = ve(),
          p = o.join(" ").trim();
        if (p === "status") {
          let g = n();
          return (console.log(d(g)), !0);
        }
        if (p === "edit") {
          let g = l();
          if (!g)
            return (
              console.log(
                `${a.yellow}No plan to edit. Generate a plan first with /plan${a.reset}`,
              ),
              !0
            );
          let $ = require("os"),
            w = require("path").join($.tmpdir(), `nex-plan-${Date.now()}.md`);
          require("fs").writeFileSync(w, g, "utf-8");
          let _ = process.env.EDITOR || process.env.VISUAL || "nano",
            { spawnSync: x } = require("child_process");
          if (
            (console.log(
              `${a.dim}Opening plan in ${_}... (save and close to update)${a.reset}`,
            ),
            x(_, [w], { stdio: "inherit" }).status === 0)
          ) {
            let { setPlanContent: b } = Pt(),
              k = require("fs").readFileSync(w, "utf-8");
            b(k);
            let A = f(k);
            if (A.length > 0) {
              let P = n()?.task || "Task";
              (m(P, A),
                console.log(
                  `${a.green}Plan updated \u2014 ${A.length} steps extracted.${a.reset}`,
                ));
            } else console.log(`${a.green}Plan updated.${a.reset}`);
          } else
            console.log(
              `${a.yellow}Editor exited with error \u2014 plan unchanged.${a.reset}`,
            );
          try {
            require("fs").unlinkSync(w);
          } catch {}
          return !0;
        }
        if (p === "approve") {
          let g = l();
          if (r()) {
            (i(), c(!1), Qs(), h());
            let w = n()?.steps?.length || 0,
              _ = w > 0 ? ` (${w} steps)` : "";
            if (
              (console.log(
                `${a.green}${a.bold}Plan approved!${a.reset}${_} Executing...`,
              ),
              console.log(
                `${a.dim}Plan mode disabled \u2014 all tools now available.${a.reset}`,
              ),
              g)
            ) {
              let { processInput: x } = ve(),
                v = `[PLAN APPROVED \u2014 EXECUTE NOW]

Implement the following plan step by step. All tools are now available.

${g}`;
              try {
                await x(v);
              } catch (b) {
                console.log(
                  `${a.red}Error: ${
                    b.message?.split(`
`)[0]
                  }${a.reset}`,
                );
              }
            }
          } else
            console.log(
              `${a.red}No plan to approve. Enter plan mode first with /plan${a.reset}`,
            );
          return !0;
        }
        return (
          c(!0),
          Qs(),
          h(),
          console.log(`
${a.cyan}${a.bold}\u250C\u2500 PLAN MODE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510${a.reset}
${a.cyan}${a.bold}\u2502${a.reset}  Analysis only \u2014 no file changes until approved   ${a.cyan}${a.bold}\u2502${a.reset}
${a.cyan}${a.bold}\u2502${a.reset}  ${a.dim}Read-only tools only \xB7 /plan approve to execute${a.reset}  ${a.cyan}${a.bold}\u2502${a.reset}
${a.cyan}${a.bold}\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518${a.reset}`),
          p && console.log(`${a.dim}Task: ${p}${a.reset}`),
          !0
        );
      }
      case "/plans": {
        let { listPlans: n } = Pt(),
          r = n();
        if (r.length === 0)
          return (console.log(`${a.dim}No saved plans${a.reset}`), !0);
        console.log(`
${a.bold}${a.cyan}Plans:${a.reset}`);
        for (let i of r) {
          let c =
            i.status === "completed"
              ? `${a.green}\u2713`
              : i.status === "executing"
                ? `${a.blue}\u2192`
                : `${a.dim}\u25CB`;
          console.log(
            `  ${c} ${a.reset}${a.bold}${i.name}${a.reset} \u2014 ${i.task || "?"} (${i.steps} steps, ${i.status})`,
          );
        }
        return (console.log(), !0);
      }
      case "/auto": {
        let {
            getAutonomyLevel: n,
            setAutonomyLevel: r,
            AUTONOMY_LEVELS: i,
          } = Pt(),
          c = o.join(" ").trim();
        return c
          ? (r(c)
              ? (console.log(`${a.green}Autonomy: ${c}${a.reset}`), Qs())
              : console.log(
                  `${a.red}Unknown level: ${c}. Use: ${i.join(", ")}${a.reset}`,
                ),
            !0)
          : (console.log(`${a.bold}${a.cyan}Autonomy:${a.reset} ${n()}`),
            console.log(`${a.dim}Levels: ${i.join(", ")}${a.reset}`),
            !0);
      }
      case "/permissions": {
        let { listPermissions: n } = Is(),
          r = n();
        console.log(`
${a.bold}${a.cyan}Tool Permissions:${a.reset}`);
        for (let i of r) {
          let c =
            i.mode === "allow"
              ? `${a.green}\u2713`
              : i.mode === "deny"
                ? `${a.red}\u2717`
                : `${a.yellow}?`;
          console.log(
            `  ${c} ${a.reset}${a.bold}${i.tool}${a.reset} ${a.dim}(${i.mode})${a.reset}`,
          );
        }
        return (
          console.log(`
${a.dim}Use /allow <tool> or /deny <tool> to change${a.reset}
`),
          !0
        );
      }
      case "/allow": {
        let { setPermission: n, savePermissions: r } = Is(),
          i = o.join(" ").trim();
        return i
          ? (n(i, "allow"),
            r(),
            console.log(`${a.green}${i}: allow${a.reset}`),
            !0)
          : (console.log(`${a.red}Usage: /allow <tool>${a.reset}`), !0);
      }
      case "/deny": {
        let { setPermission: n, savePermissions: r } = Is(),
          i = o.join(" ").trim();
        return i
          ? (n(i, "deny"), r(), console.log(`${a.red}${i}: deny${a.reset}`), !0)
          : (console.log(`${a.red}Usage: /deny <tool>${a.reset}`), !0);
      }
      case "/audit": {
        let { getAuditSummary: n, isAuditEnabled: r } = Ki();
        if (!r())
          return (
            console.log(
              `${a.yellow}Audit logging is disabled (set NEX_AUDIT=true to enable)${a.reset}`,
            ),
            !0
          );
        let i = parseInt(o.join(" ").trim()) || 1,
          c = n(i);
        if (
          (console.log(`
${a.bold}${a.cyan}Audit Summary (${i} day${i > 1 ? "s" : ""})${a.reset}
`),
          console.log(`  Total tool calls: ${a.bold}${c.totalCalls}${a.reset}`),
          console.log(`  Avg duration: ${a.dim}${c.avgDuration}ms${a.reset}`),
          console.log(
            `  Success rate: ${c.successRate >= 0.95 ? a.green : a.yellow}${Math.round(c.successRate * 100)}%${a.reset}`,
          ),
          Object.keys(c.byTool).length > 0)
        ) {
          (console.log(`
  ${a.dim}Tool${" ".repeat(25)}Count${a.reset}`),
            console.log(`  ${a.dim}${"\u2500".repeat(35)}${a.reset}`));
          let l = Object.entries(c.byTool).sort((u, d) => d[1] - u[1]);
          for (let [u, d] of l.slice(0, 15))
            console.log(`  ${u.padEnd(30)}${d}`);
        }
        return (console.log(), !0);
      }
      case "/commit": {
        let {
            isGitRepo: n,
            commit: r,
            analyzeDiff: i,
            formatDiffSummary: c,
          } = en(),
          { confirm: l } = Ye();
        if (!n())
          return (console.log(`${a.red}Not a git repository${a.reset}`), !0);
        let u = o.join(" ").trim();
        if (u) {
          let p = await r(u);
          return (
            console.log(
              p
                ? `${a.green}Committed: ${p} \u2014 ${u}${a.reset}`
                : `${a.red}Commit failed${a.reset}`,
            ),
            !0
          );
        }
        if (!i())
          return (console.log(`${a.yellow}No changes to commit${a.reset}`), !0);
        let f = await c();
        if ((console.log(f), !(await l("  Commit changes?")))) return !0;
        let h = await r("nex-code update");
        return (
          h && console.log(`${a.green}  \u2713 Committed: ${h}${a.reset}`),
          !0
        );
      }
      case "/diff": {
        let { isGitRepo: n, formatDiffSummary: r } = en();
        return n()
          ? (console.log(r()), !0)
          : (console.log(`${a.red}Not a git repository${a.reset}`), !0);
      }
      case "/review": {
        let { isGitRepo: n, getDiff: r } = en(),
          { processInput: i } = ve(),
          c = o.join(" ").trim(),
          l = c.includes("--strict"),
          u = c.replace("--strict", "").trim(),
          f = `## Review Protocol

**Phase 1 \u2014 Broad Scan:** Read the target code and identify all issues at a high level.

**Phase 2 \u2014 Deep Dive:** Select the 2-3 files or sections you consider most critical (highest risk or complexity). For each, run a targeted grep for specific anti-patterns:
- Error swallowing: \`catch.*{\\s*}\` or \`catch.*console\`
- Missing awaits, unhandled promises
- Hardcoded secrets or credentials
- Input validation gaps
Briefly report what each grep found or confirmed.

**Phase 3 \u2014 Report:** Present findings in this format:

### Score

| Category | Score | Notes |
|---|---|---|
| Security | X/10 | ... |
| Error Handling | X/10 | ... |
| Code Quality | X/10 | ... |
| Correctness | X/10 | ... |
| **Overall** | **X/10** | ... |

### Findings

For each issue, include:
- **Severity**: \u{1F534} Critical / \u{1F7E1} Warning / \u{1F535} Suggestion
- **Location**: file:line
- **Issue**: description
- **Fix**:
\`\`\`diff
- old code
+ fixed code
\`\`\`${
            l
              ? `

\u26A0 STRICT MODE: You MUST identify at least 3 critical weaknesses. If the code appears clean, dig deeper \u2014 look for subtle error-swallowing, race conditions, missing validation, or architecture risks. Do not give a passing score without identifying at least 3 critical issues.`
              : ""
          }`,
          m;
        if (u)
          m = `Do a thorough code review of \`${u}\`.

${f}`;
        else {
          if (!n())
            return (
              console.log(
                `${a.red}Not a git repository \u2014 try /review <file>${a.reset}`,
              ),
              !0
            );
          let [h, p] = await Promise.all([r(!1), r(!0)]),
            g = p || h;
          if (!g || !g.trim())
            return (
              console.log(
                `${a.yellow}No changes to review \u2014 commit something or specify a file: /review <file>${a.reset}`,
              ),
              !0
            );
          m = `Review the following code diff.

${f}

\`\`\`diff
${g.substring(0, 2e4)}
\`\`\``;
        }
        return (await i(m), !0);
      }
      case "/branch": {
        let { isGitRepo: n, getCurrentBranch: r, createBranch: i } = en();
        if (!n())
          return (console.log(`${a.red}Not a git repository${a.reset}`), !0);
        let c = o.join(" ").trim();
        if (!c) {
          let u = r();
          return (
            console.log(
              `${a.bold}${a.cyan}Branch:${a.reset} ${u || "(detached)"}`,
            ),
            !0
          );
        }
        let l = i(c);
        return (
          console.log(
            l
              ? `${a.green}Created and switched to: ${l}${a.reset}`
              : `${a.red}Failed to create branch${a.reset}`,
          ),
          !0
        );
      }
      case "/mcp": {
        let { listServers: n, connectAll: r, disconnectAll: i } = Eo(),
          c = o.join(" ").trim();
        if (c === "connect")
          return (
            console.log(`${a.dim}Connecting MCP servers...${a.reset}`),
            r()
              .then((u) => {
                for (let d of u)
                  d.error
                    ? console.log(
                        `  ${a.red}\u2717${a.reset} ${d.name}: ${d.error}`,
                      )
                    : console.log(
                        `  ${a.green}\u2713${a.reset} ${d.name}: ${d.tools} tools`,
                      );
                u.length === 0 &&
                  console.log(
                    `${a.dim}No MCP servers configured in .nex/config.json${a.reset}`,
                  );
              })
              .catch((u) => {
                console.log(
                  `${a.red}MCP connection error: ${u.message}${a.reset}`,
                );
              }),
            !0
          );
        if (c === "disconnect")
          return (
            i(),
            console.log(`${a.green}All MCP servers disconnected${a.reset}`),
            !0
          );
        let l = n();
        if (l.length === 0)
          return (
            console.log(`${a.dim}No MCP servers configured${a.reset}`),
            console.log(
              `${a.dim}Add servers to .nex/config.json under "mcpServers"${a.reset}`,
            ),
            !0
          );
        console.log(`
${a.bold}${a.cyan}MCP Servers:${a.reset}`);
        for (let u of l) {
          let d = u.connected
            ? `${a.green}\u2713 connected${a.reset}`
            : `${a.dim}\u25CB disconnected${a.reset}`;
          console.log(
            `  ${d} ${a.bold}${u.name}${a.reset} (${u.command}) \u2014 ${u.toolCount} tools`,
          );
        }
        return (
          console.log(`
${a.dim}Use /mcp connect to connect all servers${a.reset}
`),
          !0
        );
      }
      case "/hooks": {
        let { listHooks: n } = pa(),
          r = n();
        if (r.length === 0)
          return (
            console.log(`${a.dim}No hooks configured${a.reset}`),
            console.log(
              `${a.dim}Add hooks to .nex/config.json or .nex/hooks/${a.reset}`,
            ),
            !0
          );
        console.log(`
${a.bold}${a.cyan}Hooks:${a.reset}`);
        for (let i of r) {
          console.log(`  ${a.cyan}${i.event}${a.reset}`);
          for (let c of i.commands)
            console.log(`    ${a.dim}\u2192 ${c}${a.reset}`);
        }
        return (console.log(), !0);
      }
      case "/skills": {
        let { listSkills: n, enableSkill: r, disableSkill: i } = tn(),
          c = o.join(" ").trim();
        if (c.startsWith("enable ")) {
          let u = c.substring(7).trim();
          return (
            r(u)
              ? console.log(`${a.green}Skill enabled: ${u}${a.reset}`)
              : console.log(`${a.red}Skill not found: ${u}${a.reset}`),
            !0
          );
        }
        if (c.startsWith("disable ")) {
          let u = c.substring(8).trim();
          return (
            i(u)
              ? console.log(`${a.yellow}Skill disabled: ${u}${a.reset}`)
              : console.log(`${a.red}Skill not found: ${u}${a.reset}`),
            !0
          );
        }
        let l = n();
        if (l.length === 0)
          return (
            console.log(`${a.dim}No skills loaded${a.reset}`),
            console.log(
              `${a.dim}Add .md or .js files to .nex/skills/${a.reset}`,
            ),
            !0
          );
        console.log(`
${a.bold}${a.cyan}Skills:${a.reset}`);
        for (let u of l) {
          let d = u.enabled
              ? `${a.green}\u2713${a.reset}`
              : `${a.red}\u2717${a.reset}`,
            f =
              u.type === "prompt"
                ? `${a.dim}(prompt)${a.reset}`
                : `${a.dim}(script)${a.reset}`,
            m = [];
          (u.commands > 0 && m.push(`${u.commands} cmd`),
            u.tools > 0 && m.push(`${u.tools} tools`));
          let h = m.length > 0 ? ` \u2014 ${m.join(", ")}` : "";
          console.log(`  ${d} ${a.bold}${u.name}${a.reset} ${f}${h}`);
        }
        return (
          console.log(`
${a.dim}Use /skills enable <name> or /skills disable <name>${a.reset}
`),
          !0
        );
      }
      case "/install-skill": {
        let n = o.join(" ").trim();
        if (!n)
          return (
            console.log(
              `${a.yellow}Usage: /install-skill <git-url-or-user/repo>${a.reset}`,
            ),
            !0
          );
        let { installSkill: r } = tn();
        console.log(`${a.dim}Installing skill from ${n}...${a.reset}`);
        let i = await r(n);
        return (
          i.ok
            ? (console.log(
                `${a.green}Skill "${i.name}" installed successfully${a.reset}`,
              ),
              console.log(`${a.dim}Reload with /skills to see it${a.reset}`))
            : console.log(`${a.red}Failed: ${i.error}${a.reset}`),
          !0
        );
      }
      case "/search-skill": {
        let n = o.join(" ").trim();
        if (!n)
          return (
            console.log(`${a.yellow}Usage: /search-skill <query>${a.reset}`),
            !0
          );
        let { searchSkills: r } = tn();
        console.log(`${a.dim}Searching for "${n}"...${a.reset}`);
        let i = await r(n);
        if (i.length === 0)
          console.log(`${a.yellow}No skills found matching "${n}"${a.reset}`);
        else {
          console.log(`
${a.bold}Skills matching "${n}":${a.reset}
`);
          for (let c of i)
            c.name === "error"
              ? console.log(`  ${a.red}${c.description}${a.reset}`)
              : (console.log(
                  `  ${a.cyan}${c.owner}/${c.name}${a.reset} ${a.dim}\u2605${c.stars}${a.reset}`,
                ),
                console.log(`    ${c.description}`),
                console.log(`    ${a.dim}/install-skill ${c.url}${a.reset}
`));
        }
        return !0;
      }
      case "/remove-skill": {
        let n = o.join(" ").trim();
        if (!n)
          return (
            console.log(`${a.yellow}Usage: /remove-skill <name>${a.reset}`),
            !0
          );
        let { removeSkill: r } = tn(),
          i = r(n);
        return (
          i.ok
            ? console.log(`${a.green}Skill "${n}" removed${a.reset}`)
            : console.log(`${a.red}${i.error}${a.reset}`),
          !0
        );
      }
      case "/tasks": {
        let { renderTaskList: n, clearTasks: r } = Fo();
        return o.join(" ").trim() === "clear"
          ? (r(), console.log(`${a.green}Tasks cleared${a.reset}`), !0)
          : (console.log(
              `
` +
                n() +
                `
`,
            ),
            !0);
      }
      case "/undo": {
        let { undo: n, getUndoCount: r } = Ft(),
          i = n();
        if (!i)
          return (console.log(`${a.yellow}Nothing to undo${a.reset}`), !0);
        i.wasCreated
          ? console.log(
              `${a.green}Undone: deleted ${i.filePath} (was created by ${i.tool})${a.reset}`,
            )
          : console.log(
              `${a.green}Undone: restored ${i.filePath} (${i.tool})${a.reset}`,
            );
        let c = r();
        return (
          c > 0 && console.log(`${a.dim}${c} more change(s) to undo${a.reset}`),
          !0
        );
      }
      case "/redo": {
        let { redo: n, getRedoCount: r } = Ft(),
          i = n();
        if (!i)
          return (console.log(`${a.yellow}Nothing to redo${a.reset}`), !0);
        console.log(`${a.green}Redone: ${i.filePath} (${i.tool})${a.reset}`);
        let c = r();
        return (
          c > 0 && console.log(`${a.dim}${c} more change(s) to redo${a.reset}`),
          !0
        );
      }
      case "/history": {
        let { getHistory: n, getUndoCount: r, getRedoCount: i } = Ft(),
          c = n(20);
        if (c.length === 0)
          return (
            console.log(`${a.dim}No file changes in this session${a.reset}`),
            !0
          );
        console.log(`
${a.bold}File Change History${a.reset}
`);
        for (let l of c) {
          let u = new Date(l.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          console.log(
            `  ${a.dim}${u}${a.reset} ${a.yellow}${l.tool}${a.reset} ${l.filePath}`,
          );
        }
        return (
          console.log(`
${a.dim}${r()} undo / ${i()} redo available${a.reset}
`),
          !0
        );
      }
      case "/snapshot": {
        let { createSnapshot: n, listSnapshots: r } = Ft(),
          i = o.join(" ").trim() || void 0;
        if (i === "list") {
          let l = r(vt);
          if (l.length === 0)
            console.log(`${a.dim}No snapshots found${a.reset}`);
          else {
            console.log(`
${a.bold}${a.cyan}Snapshots:${a.reset}`);
            for (let u of l)
              console.log(
                `  ${a.cyan}#${u.index}${a.reset}  ${a.bold}${u.shortName}${a.reset}`,
              );
            console.log();
          }
          return !0;
        }
        let c = n(i, vt);
        return (
          c.ok
            ? (console.log(`${a.green}Snapshot created:${a.reset} ${c.label}`),
              console.log(`${a.dim}Use /restore to apply it later${a.reset}`))
            : console.log(`${a.yellow}${c.error}${a.reset}`),
          !0
        );
      }
      case "/restore": {
        let { restoreSnapshot: n, listSnapshots: r } = Ft(),
          i = o.join(" ").trim() || "last";
        if (i === "list") {
          let l = r(vt);
          if (l.length === 0)
            console.log(`${a.dim}No snapshots available${a.reset}`);
          else {
            console.log(`
${a.bold}${a.cyan}Available snapshots:${a.reset}`);
            for (let u of l)
              console.log(
                `  ${a.cyan}#${u.index}${a.reset}  ${a.bold}${u.shortName}${a.reset}`,
              );
            console.log(`
${a.dim}Usage: /restore <name|last>${a.reset}
`);
          }
          return !0;
        }
        let c = n(i, vt);
        return (
          c.ok
            ? (console.log(`${a.green}Restored snapshot:${a.reset} ${c.label}`),
              console.log(
                `${a.dim}Working tree updated. Use /undo for in-session file undos.${a.reset}`,
              ))
            : (console.log(`${a.red}Restore failed:${a.reset} ${c.error}`),
              console.log(
                `${a.dim}Use /snapshot list to see available snapshots${a.reset}`,
              )),
          !0
        );
      }
      case "/k8s": {
        let n = o.join(" ").trim(),
          { exec: r } = require("child_process"),
          { promisify: i } = require("util"),
          c = i(r),
          l = n || null,
          u = l
            ? `ssh -o ConnectTimeout=10 -o BatchMode=yes ${l.replace(/[^a-zA-Z0-9@._-]/g, "")} `
            : "",
          d = (f) => (l ? `${u}"${f.replace(/"/g, '\\"')}"` : f);
        console.log(`
${a.bold}${a.cyan}Kubernetes Overview${a.reset}${l ? a.dim + " (remote: " + l + ")" + a.reset : ""}
`);
        try {
          let { stdout: f } = await c(
              d(
                "kubectl get namespaces --no-headers -o custom-columns=NAME:.metadata.name",
              ),
              { timeout: 15e3 },
            ),
            m = f
              .trim()
              .split(
                `
`,
              )
              .filter(Boolean);
          console.log(`${a.bold}Namespaces (${m.length}):${a.reset}`);
          for (let h of m) console.log(`  ${a.cyan}${h}${a.reset}`);
          console.log();
        } catch {
          return (
            console.log(`${a.dim}Could not reach cluster \u2014 is kubectl configured?${a.reset}
`),
            !0
          );
        }
        try {
          let { stdout: f } = await c(
              d(
                "kubectl get pods -A --no-headers -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,READY:.status.containerStatuses[0].ready,STATUS:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount",
              ),
              { timeout: 2e4 },
            ),
            m = f
              .trim()
              .split(
                `
`,
              )
              .filter(Boolean),
            h = m.filter((w) => w.includes("Running")).length,
            p = m.filter((w) => w.includes("Pending")).length,
            g = m.filter(
              (w) =>
                w.includes("Failed") ||
                w.includes("Error") ||
                w.includes("CrashLoop"),
            ).length;
          console.log(`${a.bold}Pods: ${m.length} total  ${a.green}${h} running${a.reset}  ${a.yellow}${p} pending${a.reset}  ${a.red}${g} unhealthy${a.reset}
`);
          let $ = m.filter(
            (w) => !w.includes("Running") && !w.includes("<none>"),
          );
          if ($.length > 0) {
            console.log(`${a.bold}${a.red}Unhealthy Pods:${a.reset}`);
            for (let w of $) console.log(`  ${a.red}${w}${a.reset}`);
            console.log();
          }
          (console.log(
            `${a.dim}Use k8s_pods / k8s_logs / k8s_exec tools for details${a.reset}`,
          ),
            console.log(`${a.dim}Or: /k8s user@host to query a remote cluster${a.reset}
`));
        } catch (f) {
          console.log(`${a.dim}Could not list pods: ${f.message}${a.reset}
`);
        }
        return !0;
      }
      case "/servers": {
        let { loadServerProfiles: n, resolveProfile: r, sshExec: i } = Bn(),
          c = n(),
          l = Object.keys(c);
        if (l.length === 0)
          return (
            console.log(`
${a.dim}No servers configured. Create .nex/servers.json:${a.reset}`),
            console.log(`${a.dim}  { "prod": { "host": "1.2.3.4", "user": "jarvis", "os": "almalinux9" } }${a.reset}
`),
            !0
          );
        if (o[0] === "ping") {
          let f = o[1] ? [o[1]] : l;
          return (
            console.log(`
${a.bold}${a.cyan}Server connectivity:${a.reset}`),
            await Promise.all(
              f.map(async (m) => {
                if (!c[m]) {
                  console.log(
                    `  ${a.red}\u2717${a.reset} ${m} \u2014 unknown profile`,
                  );
                  return;
                }
                try {
                  let h = { ...c[m], _name: m },
                    { exitCode: p } = await i(h, "echo ok", { timeout: 8e3 });
                  console.log(
                    p === 0
                      ? `  ${a.green}\u2713${a.reset} ${m} (${h.user ? h.user + "@" : ""}${h.host})`
                      : `  ${a.red}\u2717${a.reset} ${m} (${h.host}) \u2014 SSH failed (exit ${p})`,
                  );
                } catch (h) {
                  console.log(
                    `  ${a.red}\u2717${a.reset} ${m} \u2014 ${h.message}`,
                  );
                }
              }),
            ),
            console.log(""),
            !0
          );
        }
        let { formatProfile: d } = Bn();
        console.log(`
${a.bold}${a.cyan}Configured servers (${l.length}):${a.reset}`);
        for (let f of l)
          console.log(
            `  ${a.green}${f}${a.reset}  ${a.dim}${d(f, c[f])}${a.reset}`,
          );
        return (
          console.log(`
${a.dim}/servers ping          \u2014 check SSH connectivity for all servers${a.reset}`),
          console.log(`${a.dim}/servers ping <name>   \u2014 check a specific server${a.reset}
`),
          !0
        );
      }
      case "/docker": {
        let { loadServerProfiles: n, sshExec: r } = Bn(),
          { exec: i } = require("child_process"),
          { promisify: c } = require("util"),
          l = c(i),
          u =
            o[0] === "-a" || o[0] === "--all"
              ? 'docker ps -a --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"'
              : 'docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"',
          d = n(),
          f = [["local", null], ...Object.entries(d)];
        console.log(`
${a.bold}${a.cyan}Docker Containers:${a.reset}`);
        for (let [m, h] of f) {
          let p =
            m === "local"
              ? `${a.dim}local${a.reset}`
              : `${a.cyan}${m}${a.reset}`;
          try {
            let g;
            if (m === "local") {
              let { stdout: $ } = await l(u, { timeout: 8e3 });
              g = ($ || "").trim();
            } else {
              let $ = await r(h, u, { timeout: 1e4 });
              if (
                ((g = [$.stdout, $.stderr].filter(Boolean).join("").trim()),
                $.exitCode !== 0)
              ) {
                console.log(
                  `  ${p}: ${a.red}SSH error (${$.exitCode})${a.reset}`,
                );
                continue;
              }
            }
            !g || g === "NAMES	IMAGE	STATUS	PORTS"
              ? console.log(`  ${p}: ${a.dim}(no containers)${a.reset}`)
              : (console.log(`  ${p}:`),
                g
                  .split(
                    `
`,
                  )
                  .forEach(($) => console.log(`    ${a.dim}${$}${a.reset}`)));
          } catch (g) {
            console.log(`  ${p}: ${a.red}${g.message}${a.reset}`);
          }
        }
        return (console.log(""), !0);
      }
      case "/deploy": {
        let { loadDeployConfigs: n } = Ni(),
          r = n(),
          i = Object.keys(r),
          c = o[0];
        if (c && i.includes(c)) {
          let l = o.includes("--dry-run") || o.includes("-n"),
            u = r[c],
            { executeTool: d } = St();
          console.log(`
${a.bold}Running deploy: ${c}${l ? " (dry run)" : ""}${a.reset}`);
          let f = await d("deploy", { ...u, dry_run: l });
          return (console.log(f), !0);
        }
        if (i.length === 0)
          return (
            console.log(`
${a.dim}No deploy configs. Run /init to create .nex/deploy.json${a.reset}
`),
            !0
          );
        console.log(`
${a.bold}${a.cyan}Deploy configs (${i.length}):${a.reset}`);
        for (let [l, u] of Object.entries(r)) {
          let d = u.method || "rsync",
            f = `[${d}]`,
            m =
              d === "git"
                ? `${u.server}:${u.remote_path}${u.branch ? ` (${u.branch})` : ""}`
                : `${u.local_path || ""} \u2192 ${u.server}:${u.remote_path}`,
            h = [
              u.deploy_script ? `script: ${u.deploy_script}` : null,
              u.health_check ? `health: ${u.health_check}` : null,
            ]
              .filter(Boolean)
              .map((p) => `  ${a.dim}\u2192 ${p}${a.reset}`)
              .join("");
          console.log(
            `  ${a.green}${l}${a.reset}  ${a.dim}${f} ${m}${a.reset}${h}`,
          );
        }
        return (
          console.log(`
${a.dim}/deploy <name>          \u2014 run a named deploy${a.reset}`),
          console.log(`${a.dim}/deploy <name> --dry-run \u2014 preview without syncing${a.reset}
`),
          !0
        );
      }
      case "/init": {
        let { runServerWizard: n, runDeployWizard: r, setWizardRL: i } = yp();
        return (i(e), o[0] === "deploy" ? await r() : await n(), !0);
      }
      case "/setup": {
        let { runSetupWizard: n } = Ia();
        return (await n({ rl: e, force: !0 }), !0);
      }
      case "/benchmark": {
        if (o.includes("--history")) {
          let $ = require("os"),
            w = We.join(
              $.homedir(),
              "Coding",
              "nex-code-benchmarks",
              "results",
            );
          if (!tt.existsSync(w)) {
            (console.log(`${a.yellow}No nightly results at ${w}${a.reset}`),
              console.log(
                `${a.dim}Use /benchmark (no flags) to run a live model comparison.${a.reset}`,
              ));
            break;
          }
          let _ = tt
            .readdirSync(w)
            .filter((v) => v.endsWith(".json"))
            .sort()
            .slice(-7);
          if (_.length === 0) {
            console.log(`${a.yellow}No result files found${a.reset}`);
            break;
          }
          (console.log(`
${a.bold}${a.cyan}OpenClaw Nightly Results (${_.length}-day trend)${a.reset}
`),
            console.log(
              `  ${a.dim}${"Date".padEnd(12)} ${"Model".padEnd(25)} ${"Score".padEnd(8)} ${"Pass".padEnd(8)}${a.reset}`,
            ),
            console.log(`  ${a.dim}${"\u2500".repeat(58)}${a.reset}`));
          let x = [];
          for (let v of _)
            try {
              let b = JSON.parse(tt.readFileSync(We.join(w, v), "utf-8")),
                k = v.replace(".json", ""),
                A = b.tasks?.length || b.total || 0,
                O =
                  b.tasks?.filter((we) => we.passed || we.score >= 0.7)
                    ?.length ||
                  b.passed ||
                  0,
                P =
                  b.score ??
                  b.overall_score ??
                  (A > 0 ? Math.round((O / A) * 100) : "N/A"),
                W = b.model || b.config?.model || "unknown";
              x.push({ date: k, model: W, total: A, passed: O, score: P });
              let Le =
                typeof P == "number"
                  ? P >= 80
                    ? a.green
                    : P >= 60
                      ? a.yellow
                      : a.red
                  : a.dim;
              console.log(
                `  ${k.padEnd(12)} ${W.substring(0, 24).padEnd(25)} ${Le}${String(P).padEnd(8)}${a.reset} ${O}/${A}`,
              );
            } catch {}
          if (x.length >= 2) {
            let v = x[0].score,
              b = x[x.length - 1].score;
            if (typeof v == "number" && typeof b == "number") {
              let k = b - v,
                A =
                  k > 0
                    ? `${a.green}\u25B2 +${k}`
                    : k < 0
                      ? `${a.red}\u25BC ${k}`
                      : `${a.dim}\u2192 stable`;
              console.log(`
  ${a.bold}Trend:${a.reset} ${A}${a.reset} over ${x.length} days`);
            }
          }
          console.log();
          break;
        }
        if (o.includes("--discover")) {
          let {
              findNewModels: $,
              markBenchmarked: w,
              updateReadme: _,
              updateModelsEnv: x,
            } = Sr(),
            { runDiscoverBenchmark: v, buildSummary: b } = Tn();
          console.log(`
${a.bold}Checking Ollama Cloud for new models...${a.reset}`);
          let k;
          try {
            k = await $();
          } catch (se) {
            console.log(`${a.red}Discovery failed: ${se.message}${a.reset}`);
            break;
          }
          let { newModels: A, allCloud: O } = k;
          if (
            (console.log(
              `${a.dim}${O.length} models available on cloud${a.reset}`,
            ),
            A.length === 0)
          ) {
            console.log(`${a.green}No new models since last benchmark run.${a.reset}
`);
            break;
          }
          console.log(`${a.cyan}New models to benchmark (${A.length}):${a.reset} ${A.join(", ")}
`);
          let P = require("os"),
            W = We.join(P.homedir(), ".nex-code", "benchmark-results.json"),
            Le = [];
          try {
            tt.existsSync(W) && (Le = JSON.parse(tt.readFileSync(W, "utf-8")));
          } catch {}
          let we = "",
            fe = await v({
              newModels: A,
              existingRanking: Le,
              onProgress: ({
                model: se,
                task: oe,
                done: M,
                score: q,
                error: re,
              }) => {
                if (!M) {
                  se !== we &&
                    (we &&
                      process.stdout.write(`
`),
                    (we = se),
                    process.stdout.write(`${a.cyan}${se}${a.reset}  `));
                  return;
                }
                let Y = re
                  ? `${a.red}\u2717${a.reset}`
                  : q >= 80
                    ? `${a.green}\xB7${a.reset}`
                    : q >= 40
                      ? `${a.yellow}\xB7${a.reset}`
                      : `${a.red}\xB7${a.reset}`;
                process.stdout.write(Y);
              },
            });
          we &&
            process.stdout.write(`
`);
          try {
            tt.writeFileSync(W, JSON.stringify(fe, null, 2));
          } catch {}
          w(O);
          let G = We.join(process.cwd(), "README.md"),
            z = _(fe, G),
            ne = x(fe),
            { buildCategoryWinners: ae } = Tn(),
            { updateRoutingConfig: R } = Sr(),
            L = ae(fe),
            Z = R(L);
          if (
            (z &&
              console.log(
                `${a.green}README.md benchmark table updated${a.reset}`,
              ),
            ne.updated
              ? console.log(
                  `${a.green}DEFAULT_MODEL: ${ne.previousModel} \u2192 ${ne.newModel}${a.reset}`,
                )
              : ne.reason &&
                console.log(
                  `${a.dim}models.env unchanged: ${ne.reason}${a.reset}`,
                ),
            Z.changes.length > 0)
          ) {
            console.log(`${a.green}Routing updated:${a.reset}`);
            for (let se of Z.changes) console.log(`  ${a.dim}${se}${a.reset}`);
          }
          return (console.log(), !0);
        }
        let { runBenchmark: n, DEFAULT_MODELS: r, QUICK_MODELS: i } = Tn(),
          c = o.includes("--quick"),
          l = o.find(($) => $.startsWith("--models=")),
          u = l
            ? l
                .replace("--models=", "")
                .split(",")
                .map(($) => $.trim())
                .filter(Boolean)
            : [],
          d = c ? 7 : 15,
          f = u.length > 0 ? u : c ? i : r;
        (console.log(`
${a.bold}Starting benchmark${a.reset}  ${a.dim}${d} tasks \xB7 ${f.length} models \xB7 ollama cloud${a.reset}`),
          console.log(`${a.dim}Models: ${f.join(", ")}${a.reset}
`));
        let m = "",
          h = 0,
          p = d * f.length,
          g = await n({
            models: f,
            quick: c,
            onProgress: ({
              model: $,
              task: w,
              done: _,
              score: x,
              error: v,
            }) => {
              if (!_) {
                $ !== m &&
                  (m &&
                    process.stdout.write(`
`),
                  (m = $),
                  process.stdout.write(`${a.cyan}${$}${a.reset}  `));
                return;
              }
              h++;
              let b = v
                ? `${a.red}\u2717${a.reset}`
                : x >= 80
                  ? `${a.green}\xB7${a.reset}`
                  : x >= 40
                    ? `${a.yellow}\xB7${a.reset}`
                    : `${a.red}\xB7${a.reset}`;
              process.stdout.write(b);
            },
          });
        if (
          (m &&
            process.stdout.write(`
`),
          !c && g && g.length > 0)
        ) {
          let { buildCategoryWinners: $ } = Tn(),
            {
              updateRoutingConfig: w,
              updateReadme: _,
              updateModelsEnv: x,
            } = Sr(),
            v = $(g),
            b = w(v);
          if (b.changes.length > 0) {
            console.log(`
${a.bold}Per-category routing saved:${a.reset}`);
            for (let P of b.changes) console.log(`  ${a.dim}${P}${a.reset}`);
          }
          let k = We.join(process.cwd(), "README.md");
          (_(g, k) && console.log(`${a.green}README.md updated${a.reset}`),
            x(g));
          let A = require("os"),
            O = We.join(A.homedir(), ".nex-code", "benchmark-results.json");
          try {
            tt.writeFileSync(O, JSON.stringify(g, null, 2));
          } catch {}
        }
        return !0;
      }
      case "/bench": {
        let { runJarvisBenchmark: n } = Tn(),
          r = o.includes("--dry-run"),
          i = o.find((l) => l.startsWith("--model=")),
          c = i ? i.replace("--model=", "").trim() : void 0;
        return (
          r ||
            console.log(`
${a.bold}Jarvis Benchmark${a.reset}  ${a.dim}5 agentic scenarios \xB7 each run as child process${a.reset}
`),
          await n({
            dryRun: r,
            model: c,
            cwd: vt,
            onProgress: ({ id: l, name: u, done: d, score: f, grade: m }) => {
              if (!d)
                process.stdout.write(`${a.dim}  \u2192 ${u}...${a.reset}`);
              else {
                let h = f >= 8 ? a.green : f >= 6 ? a.yellow : a.red;
                process.stdout.write(` ${h}${f}/10 (${m})${a.reset}
`);
              }
            },
          }),
          !0
        );
      }
      case "/trend": {
        let { showScoreTrend: n } = Tn(),
          r = parseInt(o[0], 10) || 10;
        return (n(r), !0);
      }
      case "/orchestrate": {
        let n = o.join(" ").trim();
        if (!n)
          return (
            console.log(`${a.yellow}Usage: /orchestrate <prompt>${a.reset}`),
            console.log(
              `${a.dim}Example: /orchestrate fix login bug, update docs, add dark mode${a.reset}`,
            ),
            !0
          );
        let { runOrchestrated: r } = js();
        return (await r(n), !0);
      }
      case "/bench-orchestrator": {
        let { runOrchestratorBenchmark: n, printResults: r } = Wp(),
          i = o.find((u) => u.startsWith("--models=")),
          c = i
            ? i
                .replace("--models=", "")
                .split(",")
                .map((u) => u.trim())
            : void 0,
          l = await n({
            models: c,
            onProgress: ({
              model: u,
              scenario: d,
              done: f,
              score: m,
              error: h,
            }) => {
              f
                ? h
                  ? process.stdout.write(` ${a.red}ERR${a.reset}
`)
                  : process.stdout.write(` ${a.green}${m}/10${a.reset}
`)
                : process.stdout.write(
                    `${a.dim}  \u2192 ${u}: ${d}...${a.reset}`,
                  );
            },
          });
        return (r(l), !0);
      }
      case "/exit":
      case "/quit":
        (process.stdout.write("\x1B[r\x1B[H\x1B[2J\x1B[3J"), process.exit(0));
      default:
        if (Ux(t)) return !0;
        {
          let n = [...eo, ...Ar()].map((l) => l.cmd.split(" ")[0]),
            r = (l, u) => {
              let d = l.length,
                f = u.length,
                m = Array.from({ length: d + 1 }, (h, p) =>
                  Array.from({ length: f + 1 }, (g, $) =>
                    p === 0 ? $ : $ === 0 ? p : 0,
                  ),
                );
              for (let h = 1; h <= d; h++)
                for (let p = 1; p <= f; p++)
                  m[h][p] =
                    l[h - 1] === u[p - 1]
                      ? m[h - 1][p - 1]
                      : 1 + Math.min(m[h - 1][p], m[h][p - 1], m[h - 1][p - 1]);
              return m[d][f];
            },
            i = null,
            c = 3;
          for (let l of n) {
            let u = r(s, l);
            u < c && ((c = u), (i = l));
          }
          console.log(
            i
              ? `${a.red}Unknown command: ${s}.${a.reset} ${a.dim}Did you mean ${a.reset}${a.cyan}${i}${a.reset}${a.dim}? Type /help for all commands.${a.reset}`
              : `${a.red}Unknown command: ${s}. Type /help${a.reset}`,
          );
        }
        return !0;
    }
  }
  var Qa = 1e3;
  function Za() {
    return We.join(process.cwd(), ".nex", "repl_history");
  }
  function nm() {
    try {
      let t = Za();
      if (tt.existsSync(t))
        return tt
          .readFileSync(t, "utf-8")
          .split(
            `
`,
          )
          .filter(Boolean)
          .slice(-Qa);
    } catch {}
    return [];
  }
  function Cr(t) {
    try {
      let e = Za(),
        s = We.dirname(e);
      (tt.existsSync(s) || tt.mkdirSync(s, { recursive: !0 }),
        tt.appendFileSync(
          e,
          t +
            `
`,
        ));
    } catch {}
  }
  function $t() {
    return `${a.bold}${a.cyan}>${a.reset} `;
  }
  function Qs() {
    if (!global._nexFooter) return;
    let { isPlanMode: t, getAutonomyLevel: e } = Pt(),
      { getAutoConfirm: s } = Ye(),
      o = [];
    t() && o.push("plan");
    let n = e();
    (n === "semi-auto" && o.push("semi"),
      n === "autonomous" && o.push("auto"),
      s() && o.push("always"),
      global._nexFooter.setStatusInfo({ mode: o.join(" \xB7 ") }));
  }
  var ec = "\x1B[200~",
    tc = "\x1B[201~";
  function Kx(t) {
    return typeof t == "string" && t.includes(ec);
  }
  function Yx(t) {
    return typeof t == "string" && t.includes(tc);
  }
  function Zs(t) {
    return typeof t != "string" ? t : t.split(ec).join("").split(tc).join("");
  }
  async function zx() {
    if (!qx("local")) return !1;
    try {
      let { exec: e } = require("child_process"),
        { promisify: s } = require("util");
      return (
        await s(e)("curl -s --max-time 1 http://localhost:11434/api/tags"),
        Va("local:llama3"),
        !0
      );
    } catch {
      return !1;
    }
  }
  async function Xx() {
    let {
      setAbortSignalGetter: t,
      getConversationLength: e,
      processInput: s,
    } = ve();
    t(Xp);
    let n = Ja().some((M) => M.configured),
      r = (async () => {
        Fx();
        let M = Yt(),
          q = Rn();
        return { model: M, providerName: q };
      })(),
      i = (async () =>
        n
          ? !0
          : (await zx())
            ? (console.log(
                `${a.green}\u2713 Local Ollama detected \u2014 using local models${a.reset}`,
              ),
              console.log(`${a.dim}Tip: Set API keys for cloud providers for more model options (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)${a.reset}
`),
              !0)
            : !1)(),
      c = (async () => {
        if (process.env.NEX_DISABLE_UPDATE_CHECK === "1")
          return { hasNewVersion: !1 };
        try {
          let { checkForNewVersion: M } = Gp();
          return await M();
        } catch {
          return { hasNewVersion: !1 };
        }
      })(),
      [l, u, d] = await Promise.all([r, i, c]);
    !u &&
      !n &&
      (console.error(`
${a.red}\u2717 No provider configured and no local Ollama detected.${a.reset}
`),
      process.exit(1));
    let { loadPersistedHistory: f, pruneHistory: m } = Ft();
    (f().then((M) => {}), m().catch(() => {}));
    let h = nm(),
      p = Px.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: $t(),
        completer: Qp,
        history: h,
        historySize: Qa,
      });
    Wx(p);
    let { setAskUserHandler: g } = St();
    g(async (M, q) => {
      let re = "\x1B[0m",
        Y = "\x1B[1m",
        Q = "\x1B[2m",
        pe = "\x1B[36m";
      return (
        process.stdout.write(`
  ${Y}\x1B[33m\u2753${re}  ${Y}${M}${re}

`),
        q.forEach((ge, $e) => {
          process.stdout.write(`  ${pe}${$e + 1}${re}  ${ge}
`);
        }),
        process.stdout
          .write(`  ${Q}${q.length + 1}${re}  ${Q}Eigene Antwort\u2026${re}
`),
        process.stdout.write(`
  ${pe}[1-${q.length + 1}]${re} \u203A `),
        new Promise((ge) => {
          (p.resume(),
            p.once("line", ($e) => {
              let je = $e.trim(),
                Be = parseInt(je);
              Be >= 1 && Be <= q.length
                ? (process.stdout.write(`
`),
                  ge(q[Be - 1]))
                : Be === q.length + 1 || je === ""
                  ? (process.stdout.write(`  ${pe}\u203A${re} `),
                    p.once("line", (zt) => {
                      (process.stdout.write(`
`),
                        ge(zt.trim() || ""));
                    }))
                  : (process.stdout.write(`
`),
                    ge(je));
            }));
        })
      );
    });
    let $ = new Gx();
    ($.activate(p),
      (global._nexFooter = $),
      (global._nexRawWrite = (M) => $.rawWrite(M)),
      Hx(() => Qs()),
      process.stdout.isTTY && process.stdout.write("\x1B[H\x1B[2J\x1B[3J"));
    let w =
      l.providerName === "ollama"
        ? l.model.id
        : `${l.providerName}:${l.model.id}`;
    Ix(w, vt, { yolo: za() });
    {
      $.setStatusInfo({ model: w, branch: "", project: We.basename(vt) });
      let { execFile: M } = require("child_process");
      M(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        { encoding: "utf8" },
        (q, re) => {
          !q &&
            re &&
            $.setStatusInfo({
              model: w,
              branch: re.trim(),
              project: We.basename(vt),
            });
        },
      );
    }
    (d.hasNewVersion &&
      console.log(`${a.yellow}\u{1F4A1} New version available!${a.reset} Run ${a.cyan}npm update -g nex-code${a.reset} to upgrade from ${a.dim}${d.currentVersion}${a.reset} to ${a.green}${d.latestVersion}${a.reset}
`),
      await zp(vt));
    let _ = !1,
      x = 0,
      v = !1,
      b = null;
    function k() {
      (Yp(),
        $.deactivate(),
        Kp(),
        process.stdin.isTTY && process.stdout.write("\x1B[?2004l"),
        process.stdout.write("\x1B[r\x1B[H\x1B[2J\x1B[3J"),
        process.exit(0));
    }
    (process.on("SIGTERM", k),
      process.on("exit", () => {
        Yp();
      }),
      p.on("SIGINT", () => {
        if ((Kp(), x++, x >= 2)) {
          k();
          return;
        }
        if (_) {
          Kt && Kt.abort();
          let { cancelPendingAskUser: M } = St();
          (M(),
            console.log(`
${a.yellow}  Task cancelled. Press Ctrl+C again to exit.${a.reset}`),
            (_ = !1),
            p.setPrompt($t()),
            p.prompt());
        } else
          (console.log(`${a.dim}  (Press Ctrl+C again to exit)${a.reset}`),
            p.setPrompt($t()),
            p.prompt(),
            b && clearTimeout(b),
            (b = setTimeout(() => {
              ((x = 0), (b = null));
            }, 2e3)));
      }),
      process.on("SIGINT", () => {
        process.stdin.isTTY ? (x++, x >= 2 && k()) : k();
      }));
    let A = !1,
      O = [],
      P = 0,
      W = {},
      Le = !1;
    function we() {
      let M = O.join(
        `
`,
      )
        .replace(/\r/g, "")
        .trim();
      if (((O = []), (A = !1), !M)) return !0;
      (P++, (Le = !0));
      let q = P;
      W[q] = M;
      let re = M.split(`
`).length,
        Y =
          re > 1
            ? `[Pasted content #${q} \u2014 ${re} lines]`
            : `[Pasted content #${q}]`,
        Q = p.line || "",
        pe = Q && !Q.endsWith(" ") ? " " : "",
        ce = Q + pe + Y;
      return (
        p.setPrompt($t()),
        p.prompt(),
        (p.line = ce),
        (p.cursor = ce.length),
        p._refreshLine(),
        !0
      );
    }
    function fe(M) {
      return M.replace(
        /\[Pasted content #(\d+)(?:[^\]]*)\]/g,
        (q, re) => W[Number(re)] || "",
      );
    }
    function G() {
      ((P = 0), (W = {}), (Le = !1));
    }
    if (process.stdin.isTTY) {
      process.stdout.write("\x1B[?2004h");
      let M = process.stdin.emit.bind(process.stdin);
      process.stdin.emit = function (q, ...re) {
        if (q !== "data") return M.call(process.stdin, q, ...re);
        let Y = re[0];
        if (
          (Buffer.isBuffer(Y) && (Y = Y.toString("utf8")), typeof Y != "string")
        )
          return M.call(process.stdin, q, ...re);
        let Q = Y.includes(ec),
          pe = Y.includes(tc);
        if (Q && pe) {
          let ce = Zs(Y);
          return (
            ce &&
              O.push(
                ...ce.split(`
`),
              ),
            we()
          );
        }
        if (Q) {
          ((A = !0), (O = []));
          let ce = Zs(Y);
          return (
            ce &&
              O.push(
                ...ce.split(`
`),
              ),
            !0
          );
        }
        if (pe) {
          let ce = Zs(Y);
          return (
            ce &&
              O.push(
                ...ce.split(`
`),
              ),
            we()
          );
        }
        if (A) {
          let ce = Zs(Y);
          return (
            ce &&
              O.push(
                ...ce.split(`
`),
              ),
            !0
          );
        }
        return Y.includes(`
`) &&
          Y.length > 40 &&
          !A
          ? (O.push(
              ...Y.replace(/\r/g, "").split(`
`),
            ),
            we())
          : M.call(process.stdin, q, ...re);
      };
    }
    let z = 0;
    function ne() {
      if (z > 0) {
        let M = $._scrollEnd,
          q = "\x1B7";
        for (let re = 0; re < z; re++) q += `\x1B[${M - z + 1 + re};1H\x1B[2K`;
        ((q += "\x1B8"), $.rawWrite(q), (z = 0));
      }
    }
    function ae(M) {
      let q = [...eo, ...Ar()].filter(($e) => $e.cmd.startsWith(M));
      if (!q.length || (q.length === 1 && q[0].cmd === M)) return;
      let re = $._scrollEnd,
        Y = Math.min(10, re - 2);
      if (Y < 1) return;
      let Q = q.slice(0, Y),
        pe = Math.max(...Q.map(($e) => $e.cmd.length));
      ((z = Q.length), q.length > Y && z++);
      let ce = re - z + 1,
        ge = "\x1B7";
      for (let $e = 0; $e < Q.length; $e++) {
        let { cmd: je, desc: Be } = Q[$e],
          zt = je.substring(0, M.length),
          jt = je.substring(M.length),
          Or = " ".repeat(Math.max(0, pe - je.length + 2));
        ge += `\x1B[${ce + $e};1H\x1B[2K  ${a.cyan}${zt}${a.reset}${a.dim}${jt}${Or}${Be}${a.reset}`;
      }
      (q.length > Y &&
        (ge += `\x1B[${ce + Q.length};1H\x1B[2K  ${a.dim}\u2026 +${q.length - Y} more${a.reset}`),
        (ge += "\x1B8"),
        $.rawWrite(ge));
    }
    process.stdin.isTTY &&
      process.stdin.on("keypress", (M, q) => {
        (ne(),
          !(q && (q.name === "tab" || q.name === "return")) &&
            setImmediate(() => {
              p.line && p.line.startsWith("/") && ae(p.line);
            }));
      });
    let R = null,
      L = `${a.dim}...${a.reset} `;
    function Z(M) {
      return (M.match(/[^\s\d](\d{1,2})\.\s+\S/g) || []).length < 2
        ? M
        : M.replace(
            /([^\s\d])(\d{1,2})\.\s+/g,
            (re, Y, Q) => `${Y}
${Q}. `,
          ).trim();
    }
    let { loadSession: se } = Rt(),
      { setConversationMessages: oe } = ve();
    if (e() === 0) {
      let M = se("_autosave");
      if (
        M &&
        M.messages &&
        M.messages.length > 0 &&
        Date.now() - new Date(M.updatedAt).getTime() < 1440 * 60 * 1e3
      ) {
        let { confirm: re } = Ye();
        if (await re("Previous session found. Resume?")) {
          let pe = M.messages,
            ce = pe.length > 20 ? pe.slice(-20) : pe;
          oe(ce);
          let { getUsage: ge, forceCompress: $e } = Je();
          if (ge(ce, []).percentage >= 30) {
            let { messages: Be } = $e(ce, []);
            oe(Be);
          }
        }
      }
    }
    (p.setPrompt($t()),
      p.prompt(),
      p.on("line", async (M) => {
        if (
          (ne(),
          Object.keys(W).length > 0 && ((M = fe(M)), G(), p.setPrompt($t())),
          _)
        ) {
          let Q = M.trim();
          if (Q) {
            let { injectMidRunNote: pe } = ve();
            (pe(Q),
              process.stdout
                .write(`${a.cyan}  \u270E Queued \u2014 will be applied in the next step${a.reset}
`),
              p.prompt());
          }
          return;
        }
        if (R !== null) {
          if (R._mode === "triple") {
            if (M.trim() === '"""') {
              let Q = R.join(
                `
`,
              ).trim();
              if (((R = null), Q)) {
                (Cr(Q.replace(/\n/g, "\\n")),
                  (_ = !0),
                  p.prompt(),
                  (x = 0),
                  (v = !1),
                  b && (clearTimeout(b), (b = null)),
                  (Kt = new AbortController()));
                try {
                  await s(Q);
                } catch (ce) {
                  if (!Kt?.signal?.aborted) {
                    let ge =
                      ce.message?.split(`
`)[0] || "An unexpected error occurred";
                    console.log(`${a.red}Error: ${ge}${a.reset}`);
                  }
                }
                _ = !1;
                let pe = re();
                pe > 0 &&
                  process.stdout.write(`${a.gray}[${pe} messages] ${a.reset}`);
              }
              (p.setPrompt($t()), p.prompt());
              return;
            }
            (R.push(M), p.setPrompt(L), p.prompt());
            return;
          }
          if (M.endsWith("\\")) R.push(M.slice(0, -1));
          else {
            R.push(M);
            let Q = R.join(
              `
`,
            ).trim();
            if (((R = null), Q)) {
              (Cr(Q.replace(/\n/g, "\\n")),
                (_ = !0),
                p.prompt(),
                (x = 0),
                (v = !1),
                b && (clearTimeout(b), (b = null)),
                (Kt = new AbortController()));
              try {
                await s(Q);
              } catch (ge) {
                if (!Kt?.signal?.aborted) {
                  let $e =
                    ge.message?.split(`
`)[0] || "An unexpected error occurred";
                  console.log(`${a.red}Error: ${$e}${a.reset}`);
                }
              }
              let { getConversationLength: pe } = ve();
              _ = !1;
              let ce = pe();
              ce > 0 &&
                process.stdout.write(`${a.gray}[${ce} messages] ${a.reset}`);
            }
            (p.setPrompt($t()), p.prompt());
            return;
          }
          (p.setPrompt(L), p.prompt());
          return;
        }
        if (M.trim() === '"""' || M.trim().startsWith('"""')) {
          let Q = M.trim().substring(3);
          ((R = Q ? [Q] : []),
            (R._mode = "triple"),
            p.setPrompt(L),
            p.prompt());
          return;
        }
        if (M.endsWith("\\")) {
          ((R = [M.slice(0, -1)]),
            (R._mode = "backslash"),
            p.setPrompt(L),
            p.prompt());
          return;
        }
        let q = Z(M.trim());
        if (!q) {
          (p.setPrompt($t()), p.prompt());
          return;
        }
        if ((Cr(q), q === "/")) {
          (Jp(), p.setPrompt($t()), p.prompt());
          return;
        }
        if (q.startsWith("/")) {
          (await tm(q, p), p.setPrompt($t()), p.prompt());
          return;
        }
        {
          let Q = Lx ? "\x1B[48;5;237m" : "\x1B[48;2;220;225;235m",
            pe = process.stdout.columns || 80;
          q.split(
            `
`,
          ).forEach((ge, $e) => {
            let je = $e === 0 ? "\x1B[1;36m\u203A\x1B[22;39m" : " ",
              Be = 2 + ge.length,
              zt = " ".repeat(Math.max(0, pe - Be));
            console.log(`${Q}${je} ${ge}${zt}\x1B[0m`);
          });
        }
        if (process.env.NEX_AUTO_PLAN !== "0" && !za()) {
          let { isPlanMode: Q, setPlanMode: pe } = Pt(),
            { invalidateSystemPromptCache: ce } = ve(),
            ge = /\b(implement|refactor|migrate|redesign)\b/i,
            $e = /\b(create|build|add|write|introduce|develop|set\s+up)\b/i,
            je =
              /^(how|what|why|when|where|which|explain|show|list|tell|describe|can\s+you|could\s+you|do\s+you)\b/i,
            Be = /\b(spawn[_\s]?agents?|swarm)\b/i;
          !je.test(q) &&
            !Be.test(q) &&
            (ge.test(q) || ($e.test(q) && q.split(/\s+/).length >= 5)) &&
            !Q() &&
            (pe(!0),
            ce(),
            console.log(
              `${a.cyan}${a.bold}\u2387  Auto Plan Mode${a.reset}${a.dim} \u2014 implementation task detected \xB7 read-only until /plan approve${a.reset}`,
            ));
        }
        {
          let { getConversationLength: Q } = ve();
          if (Q() === 0)
            try {
              let { detectCategory: pe, getModelForCategory: ce } = Ua(),
                ge = pe(q);
              if (ge && ge.id !== "coding") {
                let $e = ce(ge.id),
                  je = Yt();
                if ($e && $e !== je?.id && Va($e)) {
                  let Be = Yt();
                  (console.log(
                    `${a.dim}\u21B3 ${ge.icon} ${ge.label} task \u2014 routing to ${Be?.name || $e}${a.reset}`,
                  ),
                    global._nexFooter &&
                      global._nexFooter.setStatusInfo({
                        model: Be?.name || $e,
                      }));
                }
              }
            } catch {}
        }
        ((_ = !0),
          p.prompt(),
          (x = 0),
          (v = !1),
          b && (clearTimeout(b), (b = null)),
          (Kt = new AbortController()));
        try {
          await s(q);
        } catch (Q) {
          if (!Kt?.signal?.aborted) {
            let pe =
              Q.message?.split(`
`)[0] || "An unexpected error occurred";
            console.log(`${a.red}Error: ${pe}${a.reset}`);
          }
        }
        _ = !1;
        let { getConversationLength: re } = ve(),
          Y = re();
        (Y > 0 && process.stdout.write(`${a.gray}[${Y} messages] ${a.reset}`),
          p.setPrompt($t()),
          p.prompt());
      }),
      p.on("close", () => {
        (process.stdin.isTTY && process.stdout.write("\x1B[?2004l"),
          process.stdout.write("\x1B[r\x1B[H\x1B[2J\x1B[3J"),
          process.exit(0));
      }));
  }
  sm.exports = {
    startREPL: Xx,
    getPrompt: $t,
    loadHistory: nm,
    appendHistory: Cr,
    getHistoryPath: Za,
    HISTORY_MAX: Qa,
    showCommandList: Jp,
    completer: Qp,
    completeFilePath: Vp,
    handleSlashCommand: tm,
    showProviders: Xa,
    showHelp: Zp,
    renderBar: em,
    hasPasteStart: Kx,
    hasPasteEnd: Yx,
    stripPasteSequences: Zs,
    getAbortSignal: Xp,
  };
});
var rc = require("path");
require("dotenv").config({ path: rc.join(__dirname, "..", ".env") });
require("dotenv").config();
var _e = process.argv.slice(2);
(_e.includes("--help") || _e.includes("-h")) &&
  (console.log(`Usage: nex-code [options]

Options:
  --task <prompt>          Run a single task and exit (headless mode)
  --prompt <prompt>        Alias for --task
  --prompt-file <path>     Read prompt from file and run headless (avoids shell escaping)
  --delete-prompt-file     Delete the prompt file after reading (use with --prompt-file)
  --auto                   Skip all confirmations (implies --task / --prompt-file)
  --yolo, -yolo            Skip all confirmations (interactive YOLO mode)
  --server                 Start JSON-lines IPC server (used by VS Code extension)
  --model <spec>           Set model (e.g. openai:gpt-4o)
  --max-turns <n>          Max agentic loop iterations (default: 50)
  --orchestrate            Use multi-agent orchestrator (with --task)
  --orchestrator-model <m> Model for orchestrator (default: kimi-k2.5)
  --json                   Output result as JSON (for CI parsing)
  -h, --help               Show this help
  -v, --version            Show version
`),
  process.exit(0));
if (_e.includes("-v") || _e.includes("--version")) {
  let t = Cn();
  (console.log(t.version), process.exit(0));
}
var am = _e.includes("--yolo") || _e.includes("-yolo");
if (am) {
  let { setAutoConfirm: t } = Ye();
  t(!0);
}
if (!am)
  try {
    let t = require("fs"),
      e = rc.join(process.cwd(), ".nex", "config.json");
    if (t.existsSync(e) && JSON.parse(t.readFileSync(e, "utf-8")).yolo === !0) {
      let { setAutoConfirm: o } = Ye();
      o(!0);
    }
  } catch {}
var nc = _e.indexOf("--model");
if (nc !== -1 && _e[nc + 1]) {
  let { setActiveModel: t } = Ae();
  t(_e[nc + 1]);
}
var sc = _e.indexOf("--max-turns");
if (sc !== -1 && _e[sc + 1]) {
  let t = parseInt(_e[sc + 1], 10);
  if (t > 0) {
    let { setMaxIterations: e } = ve();
    e(t);
  }
} else
  try {
    let t = require("fs"),
      e = rc.join(process.cwd(), ".nex", "config.json");
    if (t.existsSync(e)) {
      let s = JSON.parse(t.readFileSync(e, "utf-8")),
        o = parseInt(s.maxIterations, 10);
      if (o > 0) {
        let { setMaxIterations: n } = ve();
        n(o);
      }
    }
  } catch {}
function oc() {
  if (process.platform === "darwin")
    try {
      let { spawn: t } = require("child_process"),
        e = t("caffeinate", ["-i", "-m"], { stdio: "ignore", detached: !1 });
      e.unref();
      let s = () => {
        try {
          e.kill();
        } catch {}
      };
      (process.on("exit", s),
        process.on("SIGINT", s),
        process.on("SIGTERM", s));
    } catch {}
}
async function Jx() {
  let { runSetupWizard: t } = Ia();
  await t();
}
function rm(t) {
  if (_e.includes("--auto")) {
    let { setAutoConfirm: n } = Ye();
    n(!0);
  }
  if (!_e.includes("--model")) {
    let { setActiveModel: n } = Ae(),
      r = process.env.HEADLESS_MODEL || "devstral-small-2:24b";
    n(r);
  }
  let { processInput: s, getConversationMessages: o } = ve();
  s(t)
    .then(() => {
      if (_e.includes("--json")) {
        let r = o()
          .filter((i) => i.role === "assistant")
          .pop();
        console.log(
          JSON.stringify({ success: !0, response: r?.content || "" }),
        );
      }
      process.exit(0);
    })
    .catch((n) => {
      (_e.includes("--json")
        ? console.log(JSON.stringify({ success: !1, error: n.message }))
        : console.error(n.message),
        process.exit(1));
    });
}
if (_e.includes("--server")) {
  let { setAutoConfirm: t } = Ye();
  (t(!0), Zf().startServerMode());
  return;
}
var im = _e.indexOf("--prompt-file");
if (im !== -1) {
  let t = _e[im + 1];
  (!t || t.startsWith("--")) &&
    (console.error("--prompt-file requires a file path"), process.exit(1));
  let e = require("fs"),
    s;
  try {
    s = e.readFileSync(t, "utf-8").trim();
  } catch (o) {
    (console.error(`--prompt-file: cannot read file: ${o.message}`),
      process.exit(1));
  }
  if (
    (s || (console.error("--prompt-file: file is empty"), process.exit(1)),
    _e.includes("--delete-prompt-file"))
  )
    try {
      e.unlinkSync(t);
    } catch {}
  (oc(), rm(s));
} else {
  let t =
    _e.indexOf("--task") !== -1 ? _e.indexOf("--task") : _e.indexOf("--prompt");
  if (t !== -1) {
    let e = _e[t + 1];
    if (
      ((!e || e.startsWith("--")) &&
        (console.error("--task/--prompt requires a prompt"), process.exit(1)),
      oc(),
      _e.includes("--orchestrate"))
    ) {
      let s = _e.indexOf("--orchestrator-model"),
        o = s !== -1 ? _e[s + 1] : void 0,
        { runOrchestrated: n } = js();
      n(e, { orchestratorModel: o })
        .then(() => {
          process.exit(0);
        })
        .catch((r) => {
          (console.error(`Orchestrator error: ${r.message}`), process.exit(1));
        });
    } else rm(e);
  } else
    Jx().then(() => {
      oc();
      let { startREPL: e } = om();
      e();
    });
}

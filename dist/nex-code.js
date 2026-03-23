#!/usr/bin/env node
var H = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports);
var Nn = H((wk, Om) => {
  Om.exports = {
    name: "nex-code",
    version: "0.4.7",
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
    devDependencies: {
      esbuild: "^0.27.3",
      jest: "^29.7.0",
      prettier: "^3.8.1",
    },
    jest: {
      coverageThreshold: {
        global: { lines: 45, functions: 30, branches: 35 },
        "./cli/sub-agent.js": { lines: 70, functions: 60, branches: 55 },
      },
    },
  };
});
var fn = H((bk, Ec) => {
  "use strict";
  var bc = "\x1B[0m",
    _c = "\x1B[1m",
    Mn = "\x1B[2m";
  function q(t, e, n) {
    return `\x1B[38;2;${t};${e};${n}m`;
  }
  function Nm() {
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
        s = t("python3", ["-c", e], {
          encoding: "buffer",
          timeout: 400,
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString("utf8")
          .match(/rgb:([0-9a-fA-F]+)\/([0-9a-fA-F]+)\/([0-9a-fA-F]+)/);
      if (s) {
        let r = parseInt(s[1].slice(0, 2), 16),
          i = parseInt(s[2].slice(0, 2), 16),
          a = parseInt(s[3].slice(0, 2), 16);
        return 0.299 * r + 0.587 * i + 0.114 * a < 128;
      }
    } catch {}
    return null;
  }
  function xc() {
    let t = require("os");
    return require("path").join(t.homedir(), ".nex-code", ".theme_cache.json");
  }
  function Mm(t) {
    try {
      let n = require("fs").readFileSync(xc(), "utf8"),
        o = JSON.parse(n);
      if (o && typeof o[t] == "boolean") return o[t];
    } catch {}
    return null;
  }
  function Pm(t, e) {
    try {
      let n = require("fs"),
        o = require("path"),
        s = xc(),
        r = o.dirname(s),
        i = {};
      try {
        i = JSON.parse(n.readFileSync(s, "utf8"));
      } catch {}
      i[t] = e;
      let a = Object.keys(i);
      (a.length > 50 && a.slice(0, a.length - 50).forEach((l) => delete i[l]),
        n.existsSync(r) || n.mkdirSync(r, { recursive: !0 }),
        n.writeFileSync(s, JSON.stringify(i), "utf8"));
    } catch {}
  }
  function Im() {
    let t = (process.env.NEX_THEME || "").toLowerCase();
    if (t === "light") return !1;
    if (t === "dark") return !0;
    let e = process.env.COLORFGBG;
    if (e) {
      let i = e.split(";"),
        a = parseInt(i[i.length - 1], 10);
      if (!isNaN(a)) return a < 8;
    }
    let n = process.env.TERM_SESSION_ID || "default",
      o = Mm(n);
    if (o !== null) return o;
    let s = Nm(),
      r = s !== null ? s : !0;
    return (Pm(n, r), r);
  }
  var kc = Im(),
    vc = {
      reset: bc,
      bold: _c,
      dim: Mn,
      primary: q(80, 190, 255),
      secondary: q(60, 170, 190),
      success: q(80, 210, 120),
      warning: q(245, 175, 50),
      error: q(230, 80, 80),
      muted: Mn,
      subtle: q(130, 130, 145),
      tool_read: q(80, 190, 255),
      tool_write: q(245, 165, 55),
      tool_exec: q(185, 100, 235),
      tool_search: q(70, 185, 190),
      tool_git: q(90, 210, 100),
      tool_web: q(100, 215, 250),
      tool_sysadmin: q(225, 150, 75),
      tool_default: q(100, 205, 115),
      syn_keyword: q(185, 100, 235),
      syn_string: q(90, 210, 120),
      syn_number: q(245, 175, 50),
      syn_comment: Mn,
      syn_key: q(80, 190, 255),
      diff_add: q(80, 210, 120),
      diff_rem: q(230, 80, 80),
      banner_logo: q(80, 200, 255),
      banner_name: q(80, 200, 255),
      banner_version: Mn,
      banner_model: Mn,
      banner_yolo: q(245, 175, 50),
      footer_sep: Mn,
      footer_model: q(80, 175, 235),
      footer_branch: q(80, 210, 100),
      footer_project: q(130, 130, 145),
      footer_divider: q(80, 80, 95),
      footer_mode: q(210, 150, 50),
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
    Sc = {
      reset: bc,
      bold: _c,
      dim: q(110, 110, 120),
      primary: q(0, 110, 190),
      secondary: q(0, 125, 148),
      success: q(0, 148, 62),
      warning: q(168, 92, 0),
      error: q(188, 32, 32),
      muted: q(110, 110, 120),
      subtle: q(155, 155, 165),
      tool_read: q(0, 110, 190),
      tool_write: q(168, 92, 0),
      tool_exec: q(128, 42, 188),
      tool_search: q(0, 122, 148),
      tool_git: q(0, 138, 62),
      tool_web: q(0, 112, 178),
      tool_sysadmin: q(168, 82, 0),
      tool_default: q(0, 138, 62),
      syn_keyword: q(128, 42, 188),
      syn_string: q(0, 138, 62),
      syn_number: q(168, 92, 0),
      syn_comment: q(135, 135, 148),
      syn_key: q(0, 110, 190),
      diff_add: q(0, 148, 62),
      diff_rem: q(188, 32, 32),
      banner_logo: q(0, 122, 205),
      banner_name: q(0, 122, 205),
      banner_version: q(100, 100, 118),
      banner_model: q(100, 100, 118),
      banner_yolo: q(168, 62, 0),
      footer_sep: q(168, 168, 178),
      footer_model: q(0, 102, 175),
      footer_branch: q(0, 138, 62),
      footer_project: q(135, 135, 148),
      footer_divider: q(168, 168, 178),
      footer_mode: q(148, 88, 0),
      white: q(40, 40, 52),
      red: q(188, 32, 32),
      green: q(0, 148, 62),
      yellow: q(168, 92, 0),
      blue: q(0, 110, 190),
      magenta: q(128, 42, 188),
      cyan: q(0, 125, 148),
      gray: q(132, 132, 142),
      bgRed: "\x1B[41m",
      bgGreen: "\x1B[42m",
      diff_add_bg: "\x1B[48;2;215;245;220m",
      diff_rem_bg: "\x1B[48;2;255;215;215m",
      brightCyan: q(0, 158, 182),
      brightMagenta: q(158, 52, 208),
      brightBlue: q(0, 112, 208),
    },
    Lm = kc ? vc : Sc;
  Ec.exports = { T: Lm, isDark: kc, DARK: vc, LIGHT: Sc };
});
var In = H((_k, Rc) => {
  var { T: K } = fn(),
    po = 5,
    Pn = (() => {
      let t = [];
      for (let e = 0; e < po; e++) t.push(e);
      for (let e = po - 2; e >= 1; e--) t.push(e);
      return t;
    })(),
    Tc = ["\u273D", "\u2726", "\u2727", "\u2726"],
    Kr = class {
      constructor(e = "Thinking...") {
        ((this.text = e),
          (this.frame = 0),
          (this.interval = null),
          (this.startTime = null));
      }
      _render() {
        if (this._stopped) return;
        let e = Pn[this.frame % Pn.length],
          n = "";
        for (let s = 0; s < po; s++)
          n += s === e ? `${K.cyan}\u25CF${K.reset}` : " ";
        let o = "";
        if (this.startTime) {
          let s = Math.floor((Date.now() - this.startTime) / 1e3);
          if (s >= 60) {
            let r = Math.floor(s / 60),
              i = s % 60;
            o = ` ${K.dim}${r}m ${String(i).padStart(2, "0")}s${K.reset}`;
          } else s >= 1 && (o = ` ${K.dim}${s}s${K.reset}`);
        }
        (process.stderr.write(
          `\x1B[2K\r${n} ${K.dim}${this.text}${K.reset}${o}`,
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
    Yr = class {
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
        let n = Math.floor(e / 60),
          o = e % 60;
        return n > 0 ? `${n}m ${String(o).padStart(2, "0")}s` : `${o}s`;
      }
      _render() {
        if (this._stopped) return;
        let e = Pn[this.frame % Pn.length],
          n = `${K.cyan}\u25CF${K.reset}`,
          o = `${K.dim}\u25CB${K.reset}`,
          s = this._formatElapsed(),
          r = s ? ` ${K.dim}${s}${K.reset}` : "",
          i = "";
        for (let a = 0; a < this.labels.length; a++) {
          let l, u;
          switch (this.statuses[a]) {
            case "done":
              ((l = `${K.green}\u2713${K.reset}`), (u = K.dim));
              break;
            case "error":
              ((l = `${K.red}\u2717${K.reset}`), (u = K.dim));
              break;
            default:
              ((l = a === e ? n : " "), (u = ""));
          }
          let d = a === this.labels.length - 1 ? r : "";
          i += `\x1B[2K  ${l} ${u}${this.labels[a]}${K.reset}${d}
`;
        }
        (this.lineCount > 0 && (i += `\x1B[${this.lineCount}A`),
          process.stderr.write(i),
          this.frame++);
      }
      start() {
        ((this._stopped = !1), (this.startTime = Date.now()));
        let e = "\x1B[?25l";
        for (let n = 0; n < this.lineCount; n++)
          e += `
`;
        (this.lineCount > 0 && (e += `\x1B[${this.lineCount}A`),
          process.stderr.write(e),
          this._render(),
          (this.interval = setInterval(() => this._render(), 100)));
      }
      update(e, n) {
        e >= 0 && e < this.statuses.length && (this.statuses[e] = n);
      }
      stop(e = {}) {
        if (
          ((this._stopped = !0),
          this.interval &&
            (clearInterval(this.interval), (this.interval = null)),
          !e.silent)
        )
          this._renderFinal();
        else {
          let n = "";
          for (let o = 0; o < this.lineCount; o++)
            n += `\x1B[2K
`;
          (this.lineCount > 0 && (n += `\x1B[${this.lineCount}A`),
            process.stderr.write(n));
        }
        process.stderr.write("\x1B[?25h");
      }
      _renderFinal() {
        let e = this._formatElapsed(),
          n = e ? ` ${K.dim}${e}${K.reset}` : "",
          o = "";
        for (let s = 0; s < this.labels.length; s++) {
          let r;
          switch (this.statuses[s]) {
            case "done":
              r = `${K.green}\u2713${K.reset}`;
              break;
            case "error":
              r = `${K.red}\u2717${K.reset}`;
              break;
            default:
              r = `${K.yellow}\u25CB${K.reset}`;
          }
          let i = s === this.labels.length - 1 ? n : "";
          o += `\x1B[2K  ${r} ${K.dim}${this.labels[s]}${K.reset}${i}
`;
        }
        process.stderr.write(o);
      }
    },
    uo = {
      done: "\u2714",
      in_progress: "\u25FC",
      pending: "\u25FB",
      failed: "\u2717",
    },
    fo = { done: K.green, in_progress: K.cyan, pending: K.dim, failed: K.red },
    Vt = null,
    zr = class {
      constructor(e, n) {
        ((this.name = e),
          (this.tasks = n.map((o) => ({
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
        let n = Math.floor(e / 60),
          o = e % 60;
        return n > 0 ? `${n}m ${String(o).padStart(2, "0")}s` : `${o}s`;
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
        let e = Tc[this.frame % Tc.length],
          n = this._formatElapsed(),
          o = this._formatTokens(),
          s = [n, o ? `\u2193 ${o} tokens` : ""].filter(Boolean).join(" \xB7 "),
          r = s ? ` ${K.dim}(${s})${K.reset}` : "",
          i = `\x1B[2K${K.cyan}${e}${K.reset} ${this.name}\u2026${r}
`;
        for (let a = 0; a < this.tasks.length; a++) {
          let l = this.tasks[a],
            u = a === 0 ? "\u23BF" : " ",
            d = uo[l.status] || uo.pending,
            f = fo[l.status] || fo.pending,
            m =
              l.description.length > 55
                ? l.description.substring(0, 52) + "..."
                : l.description;
          i += `\x1B[2K  ${K.dim}${u}${K.reset}  ${f}${d}${K.reset} ${m}
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
        for (let n = 0; n < this.lineCount; n++)
          e += `
`;
        ((e += `\x1B[${this.lineCount}A`),
          process.stderr.write(e),
          this._render(),
          (this.interval = setInterval(() => this._render(), 120)),
          (Vt = this));
      }
      stop() {
        ((this._stopped = !0),
          this.interval &&
            (clearInterval(this.interval), (this.interval = null)),
          this._paused || this._renderFinal(),
          process.stderr.write("\x1B[?25h"),
          (this._paused = !1),
          Vt === this && (Vt = null));
      }
      pause() {
        if (this._paused) return;
        this.interval && (clearInterval(this.interval), (this.interval = null));
        let e = "";
        for (let n = 0; n < this.lineCount; n++)
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
        for (let n = 0; n < this.lineCount; n++)
          e += `
`;
        ((e += `\x1B[${this.lineCount}A`),
          process.stderr.write(e),
          this._render(),
          (this.interval = setInterval(() => this._render(), 120)));
      }
      updateTask(e, n) {
        let o = this.tasks.find((s) => s.id === e);
        o && (o.status = n);
      }
      setStats({ tokens: e }) {
        e !== void 0 && (this.tokens = e);
      }
      isActive() {
        return this.interval !== null || this._paused;
      }
      _renderFinal() {
        let e = this._formatElapsed(),
          n = this.tasks.filter((a) => a.status === "done").length,
          o = this.tasks.filter((a) => a.status === "failed").length,
          s = this.tasks.length,
          r = o > 0 ? `${n}/${s} done, ${o} failed` : `${n}/${s} done`,
          i = `\x1B[2K${K.green}\u2714${K.reset} ${this.name} ${K.dim}(${e} \xB7 ${r})${K.reset}
`;
        for (let a = 0; a < this.tasks.length; a++) {
          let l = this.tasks[a],
            u = a === 0 ? "\u23BF" : " ",
            d = uo[l.status] || uo.pending,
            f = fo[l.status] || fo.pending,
            m =
              l.description.length > 55
                ? l.description.substring(0, 52) + "..."
                : l.description;
          i += `\x1B[2K  ${K.dim}${u}${K.reset}  ${f}${d}${K.reset} ${K.dim}${m}${K.reset}
`;
        }
        process.stderr.write(i);
      }
    },
    Xr = class {
      constructor(e, n) {
        ((this.toolName = e),
          (this.message = n || `Running ${e}...`),
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
        let e = Pn[this.frame % Pn.length],
          n = "";
        for (let r = 0; r < po; r++)
          n += r === e ? `${K.cyan}\u25CF${K.reset}` : " ";
        let o = this.message;
        this.count > 0 &&
          ((o += ` ${K.cyan}${this.count}${K.reset}`),
          this.total && (o += `/${this.total}`),
          this.detail && (o += ` ${K.dim}${this.detail}${K.reset}`));
        let s = "";
        if (this.startTime) {
          let r = Math.floor((Date.now() - this.startTime) / 1e3);
          r >= 1 && (s = ` ${K.dim}${r}s${K.reset}`);
        }
        (process.stderr.write(`\x1B[2K\r${n} ${K.dim}${o}${K.reset}${s}`),
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
  function Dm(t) {
    Vt = t;
  }
  function jm() {
    return Vt;
  }
  function qm() {
    (Vt && (Vt.stop(), (Vt = null)),
      process.stderr.write("\x1B[?25h\x1B[2K\r"));
  }
  Rc.exports = {
    C: K,
    Spinner: Kr,
    MultiProgress: Yr,
    TaskProgress: zr,
    ToolProgress: Xr,
    setActiveTaskProgress: Dm,
    getActiveTaskProgress: jm,
    cleanupTerminal: qm,
  };
});
var Oc = H((xk, Ac) => {
  var { T: A } = fn(),
    ot = A;
  function Cc(t) {
    if (!t) return "";
    let e = t.replace(/^\.\//, "").split("/");
    return e.length > 1 ? e.slice(-2).join("/") : e[0];
  }
  var Fm = {
      read_file: A.tool_read,
      list_directory: A.tool_read,
      write_file: A.tool_write,
      edit_file: A.tool_write,
      patch_file: A.tool_write,
      bash: A.tool_exec,
      grep: A.tool_search,
      search_files: A.tool_search,
      glob: A.tool_search,
      git_commit: A.tool_git,
      git_push: A.tool_git,
      git_pull: A.tool_git,
      git_status: A.tool_git,
      git_diff: A.tool_git,
      git_log: A.tool_git,
      git_branch: A.tool_git,
      git_stash: A.tool_git,
      web_fetch: A.tool_web,
      web_search: A.tool_web,
      sysadmin: A.tool_sysadmin,
      ssh_exec: A.tool_sysadmin,
      ssh_upload: A.tool_sysadmin,
      ssh_download: A.tool_sysadmin,
      deploy: A.tool_sysadmin,
    },
    Jr = {
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
  function mo(t, e = !1, n = null) {
    if (e) return `${A.error}\u25CF${A.reset}`;
    let o = Fm[t] || A.tool_default;
    return n === "blink"
      ? `${o}\x1B[5m\u25CF\x1B[25m${A.reset}`
      : `${o}${n !== null ? n : "\u25CF"}${A.reset}`;
  }
  function Um(t, e, n = !1, o = null) {
    let s = (t || []).filter((l) => l && l.canExecute !== !1);
    if (s.length === 0) return `${mo("", n, o)} Step ${e}`;
    if (s.length === 1) {
      let l = s[0],
        u = l.args || {},
        d = Jr[l.fnName] || l.fnName.replace(/_/g, " "),
        f = "";
      u.path
        ? (f = Cc(u.path))
        : u.command
          ? (f = String(u.command).substring(0, 60))
          : u.query
            ? (f = String(u.query).substring(0, 50))
            : u.pattern && (f = String(u.pattern).substring(0, 50));
      let m = f ? `${ot.dim}(${f})${ot.reset}` : "";
      return `${mo(l.fnName, n, o)} ${ot.bold}${d}${ot.reset} ${m}`;
    }
    let r = s[0].fnName,
      i = [
        ...new Set(s.map((l) => Jr[l.fnName] || l.fnName.replace(/_/g, " "))),
      ],
      a = i.length <= 3 ? i.join(" \xB7 ") : `${s.length} actions`;
    return `${mo(r, n, o)} ${a}`;
  }
  function Wm(t, e) {
    let n;
    switch (t) {
      case "write_file":
      case "edit_file":
      case "patch_file":
      case "read_file":
      case "list_directory":
        n = Cc(e.path);
        break;
      case "bash":
      case "ssh_exec":
        n = (e.command || "").substring(0, 80);
        break;
      case "grep":
      case "search_files":
        n = e.pattern ? `"${e.pattern}"${e.path ? ` in ${e.path}` : ""}` : "";
        break;
      case "glob":
        n = e.pattern || "";
        break;
      case "web_fetch":
        n = (e.url || "").substring(0, 60);
        break;
      case "web_search":
        n = (e.query || "").substring(0, 50);
        break;
      default:
        n = JSON.stringify(e).substring(0, 80);
    }
    let o = Jr[t] || t.replace(/_/g, " "),
      s = n ? ` ${ot.dim}(${n})${ot.reset}` : "";
    return `${mo(t)} ${ot.bold}${o}${ot.reset}${s}`;
  }
  function Bm(t, e = 8) {
    let n = t.split(`
`),
      o = n.slice(0, e),
      s = n.length - e,
      r = `${A.muted}  \u2514  ${A.reset}`,
      i = "     ",
      a = o.map((l, u) => `${u === 0 ? r : i}${A.success}${l}${A.reset}`).join(`
`);
    return (
      s > 0 &&
        (a += `
${A.subtle}     \u2026 +${s} lines${A.reset}`),
      a
    );
  }
  function Hm(t, e) {
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
        let n = e.server && e.server !== "local" ? ` [${e.server}]` : "";
        switch (e.action) {
          case "audit":
            return `Sysadmin${n}: full audit...`;
          case "disk_usage":
            return `Sysadmin${n}: disk usage ${e.path || "/"}...`;
          case "process_list":
            return `Sysadmin${n}: top processes (${e.sort_by || "cpu"})...`;
          case "network_status":
            return `Sysadmin${n}: network status...`;
          case "ssl_check":
            return `Sysadmin${n}: SSL check ${e.domain || e.cert_path || ""}...`;
          case "log_tail":
            return `Sysadmin${n}: tail ${e.path || "log"}...`;
          case "find_large":
            return `Sysadmin${n}: find large files in ${e.path || "/"}...`;
          case "service":
            return `Sysadmin${n}: service ${e.service_action || ""} ${e.service_name || ""}...`;
          case "kill_process":
            return `Sysadmin${n}: kill PID ${e.pid || e.process_name || "?"}...`;
          case "journalctl":
            return `Sysadmin${n}: journal ${e.unit ? `[${e.unit}]` : ""}${e.since ? ` since ${e.since}` : ""}...`;
          case "package":
            return `Sysadmin${n}: package ${e.package_action || ""} ${(e.packages || []).join(" ")}...`;
          case "firewall":
            return `Sysadmin${n}: firewall ${e.firewall_action || ""}...`;
          case "user_manage":
            return `Sysadmin${n}: user ${e.user_action || ""} ${e.user || ""}...`;
          case "cron":
            return `Sysadmin${n}: cron ${e.cron_action || ""}...`;
          default:
            return `Sysadmin${n}: ${e.action}...`;
        }
      }
      default:
        return `Running: ${t}`;
    }
  }
  function Gm(t, e, n, o) {
    let s = String(n || "");
    if (o) {
      let a = s
          .split(
            `
`,
          )[0]
          .replace(/^ERROR:\s*/i, "")
          .substring(0, 80),
        l = s.match(/\nHINT: (.+)/),
        u = l
          ? `
     ${A.muted}${l[1].substring(0, 100)}${A.reset}`
          : "";
      return `  ${A.error}\u2514 ${a}${A.reset}${u}`;
    }
    let r;
    switch (t) {
      case "read_file": {
        let l = s
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
          p = h ? ` ${A.muted}from ${h}${A.reset}` : "";
        m && f > u
          ? (r = `Read lines ${e.line_start || 1}\u2013${f}${p}`)
          : (r = `Read ${u} line${u !== 1 ? "s" : ""}${p}`);
        break;
      }
      case "write_file": {
        let a = (e.content || "").split(`
`),
          l = a.length,
          u = e.path ? require("path").basename(e.path) : null,
          d = u
            ? `Wrote ${u} \xB7 ${l} line${l !== 1 ? "s" : ""}`
            : `Wrote ${l} line${l !== 1 ? "s" : ""}`,
          f = 40,
          m = 8;
        if (l <= f) {
          let h = a.map((p) => `     ${A.muted}${p}${A.reset}`).join(`
`);
          r = `${d}
${h}`;
        } else {
          let h = a.slice(0, m).map((p) => `     ${A.muted}${p}${A.reset}`)
            .join(`
`);
          r = `${d}
${h}
     ${A.subtle}\u2026 +${l - m} lines${A.reset}`;
        }
        break;
      }
      case "edit_file": {
        let a = (e.old_text || "").split(`
`),
          l = (e.new_text || "").split(`
`),
          u = a.length,
          d = l.length,
          f = e.path ? require("path").basename(e.path) : null,
          m = f ? `  ${A.muted}${f}${A.reset}` : "",
          h = a.find((y) => y.trim()),
          p = l.find((y) => y.trim()),
          g = [];
        (h &&
          g.push(
            `    ${A.diff_rem}- ${A.reset}${A.muted}${h.trimEnd().substring(0, 72)}${A.reset}`,
          ),
          p &&
            g.push(
              `    ${A.diff_add}+ ${A.reset}${A.muted}${p.trimEnd().substring(0, 72)}${A.reset}`,
            ),
          (r =
            `${A.diff_rem}\u2212${u}${A.reset}  ${A.diff_add}+${d}${A.reset}${m}` +
            (g.length > 0
              ? `
` +
                g.join(`
`)
              : "")));
        break;
      }
      case "patch_file": {
        let a = e.patches || [],
          l = a.reduce(
            (d, f) =>
              d +
              (f.old_text || "").split(`
`).length,
            0,
          ),
          u = a.reduce(
            (d, f) =>
              d +
              (f.new_text || "").split(`
`).length,
            0,
          );
        r = `${A.reset}${a.length} patch${a.length !== 1 ? "es" : ""}  ${A.diff_rem}\u2212${l}${A.reset}  ${A.diff_add}+${u}${A.reset}`;
        break;
      }
      case "bash": {
        let l = s.match(/^EXIT (\d+)/),
          u = s
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
              ? `${A.success}\u2713${A.reset}`
              : `${A.error}\u2717 Exit ${l[1]}${A.reset}`
            : `${A.success}\u2713${A.reset}`,
          f = s.match(/\nHINT: (.+)/);
        if (f) r = `${d} ${A.muted}\u2014 ${f[1].substring(0, 100)}${A.reset}`;
        else if (u.length === 0) r = d;
        else {
          let m = l && l[1] !== "0",
            h = m ? u.slice(-3) : u.slice(0, 3),
            p = u.length - 3,
            g = h.map((y, w) =>
              w === 0
                ? `${d} ${A.muted}${y.substring(0, 120)}${A.reset}`
                : `    ${A.muted}${y.substring(0, 120)}${A.reset}`,
            );
          if (p > 0) {
            let y = m
              ? `    ${A.subtle}${p} lines above\u2026${A.reset}`
              : `    ${A.subtle}\u2026 +${p} lines${A.reset}`;
            m ? g.unshift(y) : g.push(y);
          }
          r = g.join(`
`);
        }
        break;
      }
      case "grep":
      case "search_files": {
        if (s.includes("(no matches)") || s === "no matches")
          r = `No matches${e.pattern ? ` ${A.muted}"${String(e.pattern).substring(0, 40)}"${A.reset}` : ""}`;
        else {
          let p = function (w) {
            let k = w.indexOf(":");
            if (k === -1) return `${A.muted}${w.substring(0, 90)}${A.reset}`;
            let R = w.substring(0, k),
              x = w.substring(k + 1),
              _ = x.match(/^(\d+)[:-](.*)/s),
              b = _ ? `:${_[1]}` : "",
              O = (_ ? _[2] : x).trim(),
              N = `${A.subtle}${a.basename(R)}${b}${A.reset}`,
              C = `${A.muted}${O.substring(0, 80)}${O.length > 80 ? "\u2026" : ""}${A.reset}`;
            return `${N}  ${C}`;
          };
          var i = p;
          let a = require("path"),
            l = s
              .split(
                `
`,
              )
              .filter(Boolean),
            u = l.length,
            f = new Set(l.map((w) => w.split(":")[0]).filter(Boolean)).size,
            m = e.pattern
              ? ` ${A.muted}"${String(e.pattern).substring(0, 40)}"${A.reset}`
              : "",
            h =
              f > 1
                ? `${u} match${u !== 1 ? "es" : ""} in ${f} files${m}`
                : `${u} match${u !== 1 ? "es" : ""}${m}`,
            g = l.slice(0, 3).map((w, k) =>
              k === 0
                ? `${h}
    ${p(w)}`
                : `    ${p(w)}`,
            ),
            y = l.length - 3;
          (y > 0 && g.push(`    ${A.subtle}\u2026 +${y} lines${A.reset}`),
            (r = g.join(`
`)));
        }
        break;
      }
      case "glob": {
        let a = e.pattern
          ? ` ${A.muted}${String(e.pattern).substring(0, 50)}${A.reset}`
          : "";
        if (s === "(no matches)") r = `No files found${a}`;
        else {
          let l = require("path"),
            u = s
              .split(
                `
`,
              )
              .filter(Boolean),
            d = u.length,
            f = u.slice(0, 5).map((p) => l.basename(p)),
            m = d - f.length,
            h = f.join(", ") + (m > 0 ? `, +${m} more` : "");
          r = `${d} file${d !== 1 ? "s" : ""}${a} \u2014 ${A.muted}${h}${A.reset}`;
        }
        break;
      }
      case "list_directory": {
        if (s === "(empty)") r = "0 entries";
        else {
          let a = s
              .split(
                `
`,
              )
              .filter(Boolean),
            l = a.length,
            u = a.slice(0, 6).join(", "),
            d = l - 6;
          r =
            d > 0
              ? `${l} entries \u2014 ${A.muted}${u}, +${d} more${A.reset}`
              : `${l} entr${l !== 1 ? "ies" : "y"} \u2014 ${A.muted}${u}${A.reset}`;
        }
        break;
      }
      case "git_status": {
        let a = s.match(/Branch:\s*(\S+)/),
          l = s
            .split(
              `
`,
            )
            .filter((u) => /^\s*[MADRCU?!]/.test(u)).length;
        r = a ? `${a[1]} \xB7 ${l} change${l !== 1 ? "s" : ""}` : "Done";
        break;
      }
      case "git_diff": {
        let a = (s.match(/^\+[^+]/gm) || []).length,
          l = (s.match(/^-[^-]/gm) || []).length;
        r = a || l ? `+${a} \u2212${l} lines` : "No diff";
        break;
      }
      case "git_log": {
        let a = s
            .split(
              `
`,
            )
            .filter((f) => /^commit\s+[0-9a-f]{7}/.test(f)),
          l = a.length,
          u = a[0] ? a[0].replace(/^commit\s+/, "").substring(0, 7) : null,
          d = (() => {
            let f = s.indexOf(a[0] || "\0");
            return f === -1
              ? null
              : s
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
          let f = l > 1 ? ` ${A.muted}+${l - 1} more${A.reset}` : "";
          r = `${u} ${A.muted}${d.trim().substring(0, 60)}${A.reset}${f}`;
        } else r = `${l} commit${l !== 1 ? "s" : ""}`;
        break;
      }
      case "git_commit": {
        let a = s.match(/\[[\w./\-]+ ([0-9a-f]{7,})\]/),
          l = s.match(/\[[\w./\-]+ [0-9a-f]+\]\s+(.+)/);
        r = a
          ? `${a[1]}${l ? ` \u2014 ${l[1].substring(0, 55)}` : ""}`
          : "Committed";
        break;
      }
      case "git_push": {
        let a = s.match(/(?:->|→)\s*(\S+)/);
        r = a ? `\u2192 ${a[1]}` : "Pushed";
        break;
      }
      case "git_pull": {
        if (/Already up.to.date/i.test(s)) r = "Already up to date";
        else {
          let a = (s.match(/^\+/gm) || []).length;
          r = a > 0 ? `Pulled \xB7 +${a} lines` : "Pulled";
        }
        break;
      }
      case "web_fetch": {
        let a = s.match(/<title[^>]*>([^<]{1,80})<\/title>/i),
          l = s.match(/^#\s+(.{1,80})/m),
          u = e.url || "",
          d = "";
        try {
          d = new URL(u).hostname;
        } catch {
          d = u.substring(0, 60);
        }
        let f = a ? a[1].trim() : l ? l[1].trim() : null;
        r = f
          ? `${d} \u2014 ${A.muted}${f.substring(0, 70)}${A.reset}`
          : `Fetched ${d}`;
        break;
      }
      case "web_search": {
        let a = s
            .split(
              `

`,
            )
            .filter(Boolean),
          l = a.length,
          u = a[0]
            ? a[0]
                .split(
                  `
`,
                )[0]
                .replace(/^\d+\.\s*/, "")
                .trim()
            : null,
          d = u ? ` ${A.muted}\u2014 ${u.substring(0, 70)}${A.reset}` : "";
        r = `${l} result${l !== 1 ? "s" : ""}${d}`;
        break;
      }
      case "task_list":
        r = "Done";
        break;
      case "spawn_agents": {
        let a = (s.match(/✓ Agent/g) || []).length,
          l = (s.match(/✗ Agent/g) || []).length;
        r =
          l > 0
            ? `${a} done, ${l} failed`
            : `${a} agent${a !== 1 ? "s" : ""} done`;
        break;
      }
      case "switch_model": {
        let a = s.match(/Switched to (.+)/);
        r = a ? `\u2192 ${a[1]}` : "Done";
        break;
      }
      case "ssh_exec": {
        let l = s.startsWith("EXIT ") || s.startsWith("Command failed"),
          u = s
            .split(
              `
`,
            )
            .filter((f) => f.trim() && !f.startsWith("EXIT ")),
          d = l ? `${A.error}\u2717${A.reset}` : `${A.success}\u2713${A.reset}`;
        if (u.length === 0) r = d;
        else {
          if (u.length > 2 && u.every((g) => /^\[/.test(g.trim()))) {
            r = `${d} ${u.length} log lines`;
            break;
          }
          let m = l ? u.slice(-3) : u.slice(0, 3),
            h = u.length - 3,
            p = m.map((g, y) =>
              y === 0
                ? `${d} ${A.muted}${g.substring(0, 120)}${A.reset}`
                : `    ${A.muted}${g.substring(0, 120)}${A.reset}`,
            );
          if (h > 0) {
            let g = l
              ? `    ${A.subtle}${h} lines above\u2026${A.reset}`
              : `    ${A.subtle}\u2026 +${h} lines${A.reset}`;
            l ? p.unshift(g) : p.push(g);
          }
          r = p.join(`
`);
        }
        break;
      }
      default: {
        let a = s
          .split(
            `
`,
          )
          .filter(
            (l) => l.trim() && !l.startsWith("EXIT ") && !l.startsWith("HINT:"),
          );
        if (a.length > 0) {
          let l = a[0].trim().substring(0, 90),
            u =
              a.length > 1
                ? ` ${A.subtle}\u2026 +${a.length - 1} lines${A.reset}`
                : "";
          r = `${A.muted}${l}${A.reset}${u}`;
        } else r = "Done";
      }
    }
    return `  ${A.muted}\u2514 ${r}${A.reset}`;
  }
  function Km(t, e, n, o, s, r) {
    let i = [...n.values()].reduce((d, f) => d + f, 0),
      a = Math.round(o / 1e3),
      l = a >= 60 ? `${Math.floor(a / 60)}m ${a % 60}s` : `${a}s`,
      u = `
${A.success}\u25C6${ot.reset} ${ot.bold}${t}${ot.reset}`;
    return (
      (u += `${ot.dim} \xB7 ${e} step${e !== 1 ? "s" : ""}`),
      (u += ` \xB7 ${i} tool${i !== 1 ? "s" : ""}`),
      (u += ` \xB7 ${l}`),
      r.size > 0 &&
        (u += ` \xB7 ${r.size} file${r.size !== 1 ? "s" : ""} modified`),
      (u += ot.reset),
      u
    );
  }
  Ac.exports = {
    C: ot,
    formatToolCall: Wm,
    formatResult: Bm,
    getToolSpinnerText: Hm,
    formatToolSummary: Gm,
    formatSectionHeader: Um,
    formatMilestone: Km,
  };
});
var Ae = H((kk, Mc) => {
  var { T: pn } = fn(),
    Vr = pn,
    Nc = [
      "01100110",
      "01111110",
      "01111110",
      "01011010",
      "01111110",
      "00111100",
    ];
  function Ym(t, e) {
    let n = [];
    for (let o = 0; o < t.length; o += 2) {
      let s = "";
      for (let r = 0; r < t[0].length; r++) {
        let i = t[o][r] === "1",
          a = o + 1 < t.length && t[o + 1][r] === "1";
        i && a
          ? (s += `${e}\u2588\x1B[0m`)
          : i && !a
            ? (s += `${e}\u2580\x1B[0m`)
            : !i && a
              ? (s += `${e}\u2584\x1B[0m`)
              : (s += " ");
      }
      n.push(s);
    }
    return n;
  }
  function zm(t, e, n = {}) {
    let o = Vr.bold,
      s = Vr.reset,
      r = Ym(Nc, pn.banner_logo),
      i = n.yolo ? `  ${o}${pn.banner_yolo}\u26A1 YOLO${s}` : "",
      a = Nn().version,
      l = [
        `  ${pn.banner_name}${o}nex-code${s}  ${pn.banner_version}v${a}${s}`,
        `  ${pn.banner_model}${t}${s}  ${pn.muted}\xB7  /help${s}${i}`,
        "",
      ],
      u = Math.max(r.length, l.length),
      d = Math.floor((u - r.length) / 2),
      f = Math.floor((u - l.length) / 2),
      m = Nc[0].length,
      h = [];
    for (let p = 0; p < u; p++) {
      let g = r[p - d] ?? " ".repeat(m),
        y = l[p - f] ?? "";
      h.push(g + y);
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
      Spinner: Xm,
      MultiProgress: Jm,
      TaskProgress: Vm,
      ToolProgress: Qm,
      setActiveTaskProgress: Zm,
      getActiveTaskProgress: eh,
      cleanupTerminal: th,
    } = In(),
    {
      formatToolCall: nh,
      formatResult: sh,
      getToolSpinnerText: oh,
      formatToolSummary: rh,
      formatSectionHeader: ih,
      formatMilestone: ah,
    } = Oc();
  Mc.exports = {
    C: Vr,
    banner: zm,
    Spinner: Xm,
    MultiProgress: Jm,
    TaskProgress: Vm,
    ToolProgress: Qm,
    setActiveTaskProgress: Zm,
    getActiveTaskProgress: eh,
    cleanupTerminal: th,
    formatToolCall: nh,
    formatResult: sh,
    getToolSpinnerText: oh,
    formatToolSummary: rh,
    formatSectionHeader: ih,
    formatMilestone: ah,
  };
});
var Xe = H((vk, qc) => {
  var ch = require("readline"),
    { C: It } = Ae(),
    ei = [
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
    Pc = [
      ...ei,
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
  function lh(t) {
    for (let e of Pc) if (e.test(t)) return e;
    return null;
  }
  var Ic = [
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
    uh = /\b(?:rm|rmdir|unlink|truncate|shred|mv|cp)\b/,
    Qr = [
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
  function Lc(t) {
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
    let s = (r) => {
      let i = r.replace(/^sudo\s+(?:-[ugCD]\s+\S+\s+|-[A-Za-z]+\s+)*/, "");
      if (/^\s*(?:echo|printf)\s/.test(i)) return !0;
      if (/^\s*for\s/.test(r) || /^\s*while\s/.test(r)) {
        let a = r.match(/\bdo\s+([\s\S]*?)\s*(?:done|$)/)?.[1];
        return a
          ? a
              .split(/\s*;\s*/)
              .map((u) => u.trim())
              .filter(Boolean)
              .every((u) => s(u))
          : Qr.some((l) => l.test(r));
      }
      return /^\w+=\$?\(/.test(i) || /^\w+=["']/.test(i) || /^\w+=\S/.test(i)
        ? !0
        : Qr.some((a) => a.test(i));
    };
    return o.every(s);
  }
  var ti = [
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
    Dc = [
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
    jc = [...ti, ...Dc],
    ni = !1,
    mn = null,
    Zr = null;
  function dh(t) {
    ni = t;
  }
  function fh(t) {
    Zr = t;
  }
  function ph() {
    return ni;
  }
  function mh(t) {
    mn = t;
  }
  function hh(t) {
    for (let e of ei) if (e.test(t)) return e;
    return null;
  }
  function gh(t) {
    if (/ssh\s/.test(t) && Lc(t)) return !1;
    for (let e of jc) if (e.test(t)) return !0;
    return !1;
  }
  function $h(t) {
    for (let e of ti) if (e.test(t)) return !0;
    return !1;
  }
  function yh(t) {
    if (process.env.NEX_UNPROTECT === "1" || !uh.test(t)) return null;
    for (let e of Ic) if (e.test(t)) return e;
    return null;
  }
  function wh(t, e = {}) {
    if (ni) return Promise.resolve(!0);
    if (Zr) return Zr(t, e);
    if (!process.stdout.isTTY || !process.stdin.isTTY) return bh(t, e);
    let n = e.toolName ? ["Yes", "No", "Always allow"] : ["Yes", "No"];
    return new Promise((o) => {
      let s = 0;
      mn && mn.pause();
      let r = global._nexRawWrite || ((f) => process.stdout.write(f)),
        i = () => {
          let f = process.stdout.rows || 24;
          return Math.max(1, f - n.length - 2);
        },
        a = () => {
          let f = i(),
            m = `\x1B[${f};1H\x1B[2K${It.yellow}${t}${It.reset}`;
          for (let h = 0; h < n.length; h++) {
            let p = h === s,
              g = p ? `${It.yellow}\u276F${It.reset}` : " ",
              y = p ? `${It.yellow}${n[h]}${It.reset}` : n[h];
            m += `\x1B[${f + 1 + h};1H\x1B[2K  ${g} ${y}`;
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
          for (let g = 0; g < n.length + 1; g++) p += `\x1B[${h + g};1H\x1B[2K`;
          (m(p),
            global._nexFooter && global._nexFooter.drawFooter(),
            mn && mn.resume(),
            o(f));
        },
        u = (f) => {
          if (f === 1) {
            l(!1);
            return;
          }
          (f === 2 && e.toolName && ho(e.toolName), l(!0));
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
            u(s);
            return;
          }
          if (m === "\x1B[A") {
            ((s = (s - 1 + n.length) % n.length), a());
            return;
          }
          if (m === "\x1B[B") {
            ((s = (s + 1) % n.length), a());
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
            (ho(e.toolName), l(!0));
            return;
          }
        };
      (a(),
        process.stdin.setRawMode(!0),
        process.stdin.resume(),
        process.stdin.on("data", d));
    });
  }
  function bh(t, e) {
    let n = e.toolName ? "[Y/n/a] " : "[Y/n] ";
    return new Promise((o) => {
      let s = (r) => {
        let i = r.trim().toLowerCase();
        i === "a" && e.toolName ? (ho(e.toolName), o(!0)) : o(i !== "n");
      };
      if (mn) mn.question(`${It.yellow}${t} ${n}${It.reset}`, s);
      else {
        let r = ch.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        r.question(`${It.yellow}${t} ${n}${It.reset}`, (i) => {
          (r.close(), s(i));
        });
      }
    });
  }
  var ho = () => {};
  function _h(t) {
    ho = t;
  }
  qc.exports = {
    FORBIDDEN_PATTERNS: ei,
    SSH_FORBIDDEN_PATTERNS: Pc,
    BASH_PROTECTED_PATHS: Ic,
    SSH_SAFE_PATTERNS: Qr,
    isSSHReadOnly: Lc,
    DANGEROUS_BASH: jc,
    CRITICAL_BASH: ti,
    NOTABLE_BASH: Dc,
    isForbidden: hh,
    isSSHForbidden: lh,
    isDangerous: gh,
    isCritical: $h,
    isBashPathForbidden: yh,
    confirm: wh,
    setAutoConfirm: dh,
    getAutoConfirm: ph,
    setConfirmHook: fh,
    setReadlineInterface: mh,
    setAllowAlwaysHandler: _h,
  };
});
var Ln = H((Sk, Fc) => {
  async function xh(t, e) {
    if (!t.response?.data) return t.message;
    let n = t.response.data;
    if (typeof n == "object" && n !== null && typeof n.pipe != "function")
      return e(n) || t.message;
    try {
      let o = await new Promise((r, i) => {
          let a = [];
          (n.on("data", (l) => a.push(l)),
            n.on("end", () => r(Buffer.concat(a).toString("utf8"))),
            n.on("error", i));
        }),
        s = JSON.parse(o);
      return e(s) || o || t.message;
    } catch {
      return t.message;
    }
  }
  var si = class t {
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
    async chat(e, n, o = {}) {
      throw new Error(`${this.name}: chat() not implemented`);
    }
    async stream(e, n, o = {}) {
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
  Fc.exports = { BaseProvider: si, readStreamErrorBody: xh };
});
var Bc = H((Ek, Wc) => {
  var go = require("axios"),
    kh = require("http"),
    vh = require("https"),
    { BaseProvider: Sh, readStreamErrorBody: Eh } = Ln(),
    $o = new kh.Agent({ keepAlive: !0, maxSockets: 6, timeout: 6e4 }),
    yo = new vh.Agent({ keepAlive: !0, maxSockets: 6, timeout: 6e4 }),
    Uc = {
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
    oi = class extends Sh {
      constructor(e = {}) {
        (super({
          name: "ollama",
          baseUrl: e.baseUrl || "https://ollama.com",
          models: e.models || Uc,
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
            go.get(`${this.baseUrl}/api/tags`, {
              timeout: 5e3,
              headers: this._getHeaders(),
              httpAgent: $o,
              httpsAgent: yo,
            })
              .then((e) => {
                let n = e.data?.models || [];
                for (let o of n) {
                  let s = (o.name || o.model || "").replace(/:latest$/, "");
                  !s ||
                    this.models[s] ||
                    (this.models[s] = {
                      id: s,
                      name: o.name || s,
                      maxTokens: 16384,
                      contextWindow: 131072,
                    });
                }
              })
              .catch(() => {});
            return;
          }
          try {
            let n =
              (
                await go.get(`${this.baseUrl}/api/tags`, {
                  timeout: 5e3,
                  headers: this._getHeaders(),
                  httpAgent: $o,
                  httpsAgent: yo,
                })
              ).data?.models || [];
            for (let o of n) {
              let s = (o.name || o.model || "").replace(/:latest$/, "");
              !s ||
                this.models[s] ||
                (this.models[s] = {
                  id: s,
                  name: o.name || s,
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
        return e.map((n) => {
          if (n.role === "user" && Array.isArray(n.content)) {
            let o = [],
              s = [];
            for (let i of n.content)
              i.type === "text"
                ? o.push(i.text ?? "")
                : i.type === "image" && i.data && s.push(i.data);
            let r = {
              role: "user",
              content: o.join(`
`),
            };
            return (s.length > 0 && (r.images = s), r);
          }
          return n;
        });
      }
      async chat(e, n, o = {}) {
        await this.discoverModels();
        let s = o.model || this.defaultModel,
          r = this.getModel(s),
          i = o.maxTokens || r?.maxTokens || 16384,
          a;
        try {
          a = await go.post(
            `${this.baseUrl}/api/chat`,
            {
              model: s,
              messages: this._formatMessages(e),
              tools: n && n.length > 0 ? n : void 0,
              stream: !1,
              options: {
                temperature: o.temperature ?? this.temperature,
                num_predict: i,
              },
            },
            {
              timeout: o.timeout || this.timeout,
              headers: this._getHeaders(),
              httpAgent: $o,
              httpsAgent: yo,
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
        return this.normalizeResponse(a.data);
      }
      async stream(e, n, o = {}) {
        await this.discoverModels();
        let s = o.model || this.defaultModel,
          r = this.getModel(s),
          i = o.maxTokens || r?.maxTokens || 16384,
          a = o.onToken || (() => {}),
          l = o.onThinkingToken || (() => {}),
          u;
        try {
          u = await go.post(
            `${this.baseUrl}/api/chat`,
            {
              model: s,
              messages: this._formatMessages(e),
              tools: n && n.length > 0 ? n : void 0,
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
              httpAgent: $o,
              httpsAgent: yo,
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
            m = await Eh(d, (h) => h?.error);
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
              let y = p.split(`
`);
              p = y.pop() || "";
              for (let w of y) {
                if (!w.trim()) continue;
                let k;
                try {
                  k = JSON.parse(w);
                } catch {
                  continue;
                }
                if (
                  (k.message?.thinking && l(k.message.thinking),
                  k.message?.content &&
                    (a(k.message.content), (m += k.message.content)),
                  k.message?.tool_calls && (h = h.concat(k.message.tool_calls)),
                  k.done)
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
                      (a(g.message.content), (m += g.message.content)),
                    g.message?.tool_calls &&
                      (h = h.concat(g.message.tool_calls)));
                } catch {}
              d({ content: m, tool_calls: this._normalizeToolCalls(h) });
            }));
        });
      }
      normalizeResponse(e) {
        let n = e.message || {};
        return {
          content: n.content || "",
          tool_calls: this._normalizeToolCalls(n.tool_calls || []),
        };
      }
      _normalizeToolCalls(e) {
        return e.map((n, o) => ({
          id: n.id || `ollama-${Date.now()}-${o}`,
          function: {
            name: n.function?.name || n.name || "unknown",
            arguments: n.function?.arguments || n.arguments || {},
          },
        }));
      }
    };
  Wc.exports = { OllamaProvider: oi, OLLAMA_MODELS: Uc };
});
var Xc = H((Tk, zc) => {
  var { callChat: Th } = Oe(),
    { estimateTokens: ri } = Qe(),
    Hc = process.env.NEX_COMPACTION !== "false",
    Gc = 6,
    Kc = 500,
    Rh = `Summarize this conversation history concisely. Focus on:
- What files were read, created, or modified
- Key decisions made and their rationale
- Current state of the task (what's done, what's pending)
- Any errors encountered and how they were resolved
Be factual and brief. Use bullet points. Max 300 words.`;
  async function Ch(t) {
    if (!Hc || t.length < Gc) return null;
    let e = [
      { role: "system", content: Rh },
      { role: "user", content: Yc(t) },
    ];
    try {
      let o = (
        (await Th(e, [], { temperature: 0, maxTokens: Kc })).content || ""
      ).trim();
      if (!o) return null;
      let s = t.reduce(
          (i, a) =>
            i +
            ri(a.content || "") +
            (a.tool_calls ? ri(JSON.stringify(a.tool_calls)) : 0),
          0,
        ),
        r = ri(o);
      return r >= s * 0.8
        ? null
        : {
            message: {
              role: "system",
              content: `[Conversation Summary \u2014 ${t.length} messages compacted]
${o}`,
              _compacted: !0,
              _originalCount: t.length,
            },
            tokensRemoved: s - r,
          };
    } catch {
      return null;
    }
  }
  function Yc(t) {
    return t.map((e) => {
      let n = e.role === "tool" ? "tool_result" : e.role,
        o = (e.content || "").substring(0, 500);
      if (e.tool_calls) {
        let s = e.tool_calls.map((r) => r.function?.name).join(", ");
        return `[${n}] ${o}
  tools: ${s}`;
      }
      return `[${n}] ${o}`;
    }).join(`

`);
  }
  zc.exports = {
    compactMessages: Ch,
    formatMessagesForSummary: Yc,
    COMPACTION_ENABLED: Hc,
    COMPACTION_MIN_MESSAGES: Gc,
    COMPACTION_SUMMARY_BUDGET: Kc,
  };
});
var Qe = H((Rk, ol) => {
  var Ah = require("path");
  function Vc() {
    return Oe().getActiveModel();
  }
  var Oh = { anthropic: 3.5, openai: 4, gemini: 4, ollama: 4, local: 4 },
    hn = new Map(),
    Jc = 1e3,
    ii = new WeakMap(),
    us = null;
  function Nh() {
    if (us !== null) return us;
    try {
      let e = Vc()?.provider || "ollama";
      return ((us = Oh[e] || 4), us);
    } catch {
      return 4;
    }
  }
  function Mh() {
    us = null;
  }
  function gn(t) {
    if (!t) return 0;
    typeof t != "string" && (t = JSON.stringify(t));
    let e =
        t.length <= 80
          ? t
          : `${t.length}:${t.substring(0, 60)}:${t.substring(t.length - 20)}`,
      n = hn.get(e);
    if (n !== void 0) return (hn.delete(e), hn.set(e, n), n);
    let o = Math.ceil(t.length / Nh());
    if (hn.size >= Jc) {
      let s = Jc >> 1,
        r = hn.keys();
      for (let i = 0; i < s; i++) hn.delete(r.next().value);
    }
    return (hn.set(e, o), o);
  }
  function Ph(t) {
    if (ii.has(t)) return ii.get(t);
    let e = JSON.stringify(t);
    return (ii.set(t, e), e);
  }
  function jn(t) {
    let n = 4;
    if ((t.content && (n += gn(t.content)), t.tool_calls))
      for (let o of t.tool_calls) {
        ((n += 4), (n += gn(o.function?.name || "")));
        let s = o.function?.arguments;
        typeof s == "string" ? (n += gn(s)) : s && (n += gn(JSON.stringify(s)));
      }
    return n;
  }
  function _t(t) {
    let e = 0;
    for (let n of t) e += jn(n);
    return e;
  }
  function Ih(t, e) {
    if (t && t.length === e.length) {
      let r = !1;
      for (let i = 0; i < e.length; i++)
        if (t[i] !== e[i]) {
          r = !0;
          break;
        }
      if (!r) return 0;
    }
    let n = t ? t.length : 0,
      o = e.length,
      s = 0;
    for (let r = n; r < o; r++) s += jn(e[r]);
    return s;
  }
  function wo(t) {
    return !t || t.length === 0 ? 0 : gn(JSON.stringify(t));
  }
  function bo() {
    return Vc()?.contextWindow || 32768;
  }
  function Lh(t, e) {
    let n = _t(t),
      o = wo(e),
      s = n + o,
      r = bo(),
      i = r > 0 ? (s / r) * 100 : 0,
      a = 0,
      l = 0,
      u = 0;
    for (let d of t) {
      let f = jn(d);
      d.role === "system" ? (a += f) : d.role === "tool" ? (u += f) : (l += f);
    }
    return {
      used: s,
      limit: r,
      percentage: Math.round(i * 10) / 10,
      breakdown: {
        system: a,
        conversation: l,
        toolResults: u,
        toolDefinitions: o,
      },
      messageCount: t.length,
    };
  }
  var Qc = parseFloat(process.env.NEX_COMPRESSION_THRESHOLD) || 0.75,
    Zc = parseFloat(process.env.NEX_SAFETY_MARGIN) || 0.1,
    el = parseInt(process.env.NEX_KEEP_RECENT, 10) || 10,
    Dh = 200,
    jh = 500;
  function tl(t, e) {
    if (!t || t.length <= e) return t;
    let o = /^(ERROR|EXIT|BLOCKED|CANCELLED)/i.test(t) ? e * 3 : e;
    if (t.length <= o) return t;
    let s = t.split(`
`);
    if (s.length <= 10) {
      let p = Math.floor(o * 0.6),
        g = Math.floor(o * 0.4),
        y = t.substring(0, p),
        w = t.substring(t.length - g);
      return (
        y +
        `
...(${t.length} chars total)...
` +
        w
      );
    }
    let r = Math.floor(s.length * 0.4),
      i = Math.floor(s.length * 0.4),
      a = [],
      l = 0,
      u = Math.floor(o * 0.4);
    for (let p = 0; p < r && l < u; p++)
      if (l + s[p].length + 1 > u && s[p].trim().startsWith("```")) {
        (a.push(s[p]), (l += s[p].length + 1));
        let g = p + 1;
        for (; g < s.length && l < u * 1.5 && !s[g].trim().startsWith("```"); )
          (a.push(s[g]), (l += s[g].length + 1), g++);
        (g < s.length &&
          s[g].trim().startsWith("```") &&
          (a.push(s[g]), (l += s[g].length + 1)),
          (p = g));
      } else (a.push(s[p]), (l += s[p].length + 1));
    let d = [],
      f = 0,
      m = Math.floor(o * 0.4);
    for (let p = s.length - 1; p >= s.length - i && f < m; p--)
      if (f + s[p].length + 1 > m && s[p].trim().startsWith("```")) {
        (d.push(s[p]), (f += s[p].length + 1));
        let g = p - 1;
        for (; g >= 0 && f < m * 1.5 && !s[g].trim().startsWith("```"); )
          (d.push(s[g]), (f += s[g].length + 1), g--);
        (g >= 0 &&
          s[g].trim().startsWith("```") &&
          (d.push(s[g]), (f += s[g].length + 1)),
          (p = g));
      } else (d.push(s[p]), (f += s[p].length + 1));
    d.reverse();
    let h = s.length - a.length - d.length;
    return (
      a.join(`
`) +
      `
...(${h} lines omitted, ${s.length} total)...
` +
      d.join(`
`)
    );
  }
  function Dn(t, e = "light") {
    let n = e === "aggressive" ? 100 : e === "medium" ? 200 : jh,
      o = e === "aggressive" ? 50 : e === "medium" ? 100 : Dh;
    if (t.role === "tool") {
      let s =
        typeof t.content == "string" ? t.content : JSON.stringify(t.content);
      return s.length > o ? { ...t, content: tl(s, o) } : t;
    }
    if (t.role === "assistant") {
      let s = { ...t };
      return (
        s.content &&
          s.content.length > n &&
          (s.content =
            s.content.substring(0, n) +
            `
...(truncated)`),
        s.tool_calls &&
          e === "aggressive" &&
          (s.tool_calls = s.tool_calls.map((r) => ({
            ...r,
            function: {
              name: r.function.name,
              arguments:
                typeof r.function.arguments == "string"
                  ? r.function.arguments.substring(0, 50)
                  : r.function.arguments,
            },
          }))),
        s
      );
    }
    return t;
  }
  function nl(t, e, n, o) {
    let s = 0;
    if (t.role === "system") return 100;
    if (t.role === "user") s += 35;
    else if (t.role === "tool") {
      let i =
        typeof t.content == "string"
          ? t.content
          : JSON.stringify(t.content || "");
      /^(ERROR|BLOCKED|CANCELLED)/i.test(i) ? (s += 30) : (s += 15);
    } else t.role === "assistant" && (s += t.tool_calls ? 20 : 10);
    let r = n > 1 ? e / (n - 1) : 1;
    if (((s += Math.round(r * 30)), o && o.size > 0)) {
      let i =
          typeof t.content == "string"
            ? t.content
            : JSON.stringify(t.content || ""),
        a = 0;
      for (let l of o) (i.includes(l) || i.includes(Ah.basename(l))) && a++;
      s += Math.min(30, a * 10);
    }
    return Math.min(100, s);
  }
  function sl(t, e = 10) {
    let n = new Set(),
      o = t.slice(-e),
      s = /(?:\/[\w.-]+)+\.\w+/g;
    for (let r of o) {
      let a = (
        typeof r.content == "string"
          ? r.content
          : JSON.stringify(r.content || "")
      ).match(s);
      a && a.forEach((l) => n.add(l));
    }
    return n;
  }
  async function qh(t, e, n = {}) {
    let o = n.threshold ?? Qc,
      s = n.safetyMargin ?? Zc,
      r = n.keepRecent ?? el,
      i = bo(),
      a = wo(e),
      l = Math.floor(i * (o - s)),
      u = l - a,
      d = _t(t),
      f = d + a;
    if (f <= l)
      return { messages: t, compressed: !1, compacted: !1, tokensRemoved: 0 };
    let m = d,
      h = null,
      p = 0;
    t.length > 0 && t[0].role === "system" && ((h = t[0]), (p = 1));
    let g = Math.max(p, t.length - r),
      y = t.slice(p, g),
      w = t.slice(g),
      k = y.filter((C) => !C._compacted);
    if (k.length >= 6)
      try {
        let { compactMessages: C } = Xc(),
          L = await C(k);
        if (L) {
          let me = [...y.filter((oe) => oe._compacted), L.message],
            le = Qt(h, me, w),
            ie = _t(le);
          if (ie + a <= l)
            return {
              messages: le,
              compressed: !0,
              compacted: !0,
              tokensRemoved: m - ie,
            };
          y = me;
        }
      } catch (C) {
        process.env.NEX_DEBUG &&
          console.error("[context-engine] LLM compacting failed:", C.message);
      }
    let R = (f - l) / l,
      x = y.map((C) => Dn(C, "light")),
      _ = Qt(h, x, w),
      b = _t(_);
    if (b + a <= l)
      return {
        messages: _,
        compressed: !0,
        compacted: !1,
        tokensRemoved: m - b,
      };
    if (
      ((x = y.map((C) => Dn(C, "medium"))),
      (_ = Qt(h, x, w)),
      (b = _t(_)),
      b + a <= l)
    )
      return {
        messages: _,
        compressed: !0,
        compacted: !1,
        tokensRemoved: m - b,
      };
    if (
      ((x = y.map((C) => Dn(C, "aggressive"))),
      (_ = Qt(h, x, w)),
      (b = _t(_)),
      b + a <= l)
    )
      return {
        messages: _,
        compressed: !0,
        compacted: !1,
        tokensRemoved: m - b,
      };
    let O = sl([...x, ...w]),
      N = x.map((C, L) => ({
        msg: C,
        score: nl(C, L, x.length, O),
        tokens: jn(C),
      }));
    for (; N.length > 0 && b > u; ) {
      let C = 0;
      for (let L = 1; L < N.length; L++) N[L].score < N[C].score && (C = L);
      ((b -= N[C].tokens), N.splice(C, 1));
    }
    return (
      (x = N.map((C) => C.msg)),
      (_ = Qt(h, x, w)),
      (b = _t(_)),
      { messages: _, compressed: !0, compacted: !1, tokensRemoved: m - b }
    );
  }
  function Qt(t, e, n) {
    let o = [];
    return (t && o.push(t), o.push(...e, ...n), o);
  }
  function Fh(t, e) {
    if (!t) return "";
    if (gn(t) <= e) return t;
    let o = e * 4,
      s = t.split(`
`),
      r = Math.floor(o * 0.6),
      i = Math.floor(o * 0.4),
      a = "",
      l = 0;
    for (let h of s) {
      if (a.length + h.length + 1 > r) break;
      ((a +=
        (a
          ? `
`
          : "") + h),
        l++);
    }
    let u = "",
      d = 0;
    for (let h = s.length - 1; h >= l; h--) {
      let p =
        s[h] +
        (u
          ? `
`
          : "") +
        u;
      if (p.length > i) break;
      ((u = p), d++);
    }
    let m = `

... (${s.length - l - d} lines omitted, ${s.length} total) ...

`;
    return a + m + u;
  }
  var Uh = 6;
  function Wh(t, e, n = !1) {
    let o = bo(),
      s = wo(e),
      r = Math.floor(o * (n ? 0.35 : 0.5)) - s,
      i = _t(t),
      a = Math.floor(i * (n ? 0.5 : 0.8));
    r > a && (r = a);
    let l = null,
      u = 0;
    t.length > 0 && t[0].role === "system" && ((l = t[0]), (u = 1));
    let d = n ? 2 : Uh,
      f = Math.max(u, t.length - d),
      m = t.slice(u, f),
      h = t.slice(f),
      p = m.map((_) => Dn(_, "aggressive"));
    n && (h = h.map((_) => Dn(_, "aggressive")));
    let g = Qt(l, p, h),
      y = _t(g);
    for (; p.length > 0 && y > r; ) {
      let _ = p.shift();
      y -= jn(_);
    }
    (n &&
      y > r &&
      ((h = h.filter((b) => b.role === "user").slice(-1)),
      (g = Qt(l, [], h)),
      (y = _t(g))),
      (g = Qt(l, p, h)));
    let w = t.filter((_) => _.role === "user"),
      k = (_) => {
        let b = typeof _.content == "string" ? _.content : "";
        return (
          b.startsWith("[SYSTEM WARNING]") ||
          b.startsWith("[SYSTEM:") ||
          b.startsWith("BLOCKED:")
        );
      },
      R = w.find((_) => !k(_)),
      x = [...w].reverse().find((_) => !k(_));
    if (R && !g.find((_) => _ === R)) {
      let _ = g.findIndex((O) => O.role === "system"),
        b = _ >= 0 ? _ + 1 : 0;
      g.splice(b, 0, R);
    }
    return (
      x && x !== R && !g.find((_) => _ === x) && g.push(x),
      { messages: g, tokensRemoved: i - _t(g) }
    );
  }
  ol.exports = {
    estimateTokens: gn,
    estimateMessageTokens: jn,
    estimateMessagesTokens: _t,
    estimateDeltaTokens: Ih,
    estimateToolsTokens: wo,
    serializeMessage: Ph,
    getContextWindow: bo,
    getUsage: Lh,
    compressMessage: Dn,
    compressToolResult: tl,
    scoreMessageRelevance: nl,
    extractActiveFiles: sl,
    fitToContext: qh,
    forceCompress: Wh,
    truncateFileContent: Fh,
    invalidateTokenRatioCache: Mh,
    COMPRESSION_THRESHOLD: Qc,
    SAFETY_MARGIN: Zc,
    KEEP_RECENT: el,
  };
});
var cl = H((Ak, al) => {
  var rl = require("axios"),
    { BaseProvider: Bh, readStreamErrorBody: Hh } = Ln(),
    { serializeMessage: Ck } = Qe(),
    il = {
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
    ai = class extends Bh {
      constructor(e = {}) {
        (super({
          name: "openai",
          baseUrl: e.baseUrl || "https://api.openai.com/v1",
          models: e.models || il,
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
        let n = [];
        for (let o of e) {
          if (this._messageFormatCache.has(o)) {
            n.push(this._messageFormatCache.get(o));
            continue;
          }
          let s = this._getMessageCacheKey(o);
          if (this._messageStringCache.has(s)) {
            let i = this._messageStringCache.get(s);
            (this._messageFormatCache.set(o, i), n.push(i));
            continue;
          }
          let r = this._formatSingleMessage(o);
          (this._messageStringCache.size < this._maxCacheSize &&
            this._messageStringCache.set(s, r),
            this._messageFormatCache.set(o, r),
            n.push(r));
        }
        return { messages: n };
      }
      _getMessageCacheKey(e) {
        let n = e.role || "",
          o = typeof e.content == "string" ? e.content.substring(0, 100) : "",
          s = e.tool_calls ? e.tool_calls.length : 0;
        return `${n}:${o.length}:${s}`;
      }
      _formatSingleMessage(e) {
        if (e.role === "assistant" && e.tool_calls)
          return {
            role: "assistant",
            content: e.content || null,
            tool_calls: e.tool_calls.map((n) => ({
              id: n.id || `call-${Date.now()}`,
              type: "function",
              function: {
                name: n.function.name,
                arguments:
                  typeof n.function.arguments == "string"
                    ? n.function.arguments
                    : JSON.stringify(n.function.arguments),
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
          let n = [];
          for (let o of e.content)
            if (o.type === "text") n.push({ type: "text", text: o.text ?? "" });
            else if (o.type === "image" && o.data) {
              let s = o.data.startsWith("data:")
                ? o.data
                : `data:${o.media_type || "image/png"};base64,${o.data}`;
              n.push({
                type: "image_url",
                image_url: { url: s, detail: "auto" },
              });
            }
          return { role: "user", content: n };
        }
        return { role: e.role, content: e.content };
      }
      async chat(e, n, o = {}) {
        let s = o.model || this.defaultModel,
          r = this.getModel(s),
          i = o.maxTokens || r?.maxTokens || 16384,
          { messages: a } = this.formatMessages(e),
          l = {
            model: s,
            messages: a,
            max_tokens: i,
            temperature: o.temperature ?? this.temperature,
          };
        n && n.length > 0 && (l.tools = n);
        let u;
        try {
          u = await rl.post(`${this.baseUrl}/chat/completions`, l, {
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
      async stream(e, n, o = {}) {
        let s = o.model || this.defaultModel,
          r = this.getModel(s),
          i = o.maxTokens || r?.maxTokens || 16384,
          a = o.onToken || (() => {}),
          { messages: l } = this.formatMessages(e),
          u = {
            model: s,
            messages: l,
            max_tokens: i,
            temperature: o.temperature ?? this.temperature,
            stream: !0,
          };
        n && n.length > 0 && (u.tools = n);
        let d;
        try {
          d = await rl.post(`${this.baseUrl}/chat/completions`, u, {
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
            h = await Hh(f, (p) => p?.error?.message || p?.error);
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
            d.data.on("data", (y) => {
              g += y.toString();
              let w = g.split(`
`);
              g = w.pop() || "";
              for (let k of w) {
                let R = k.trim();
                if (!R || !R.startsWith("data: ")) continue;
                let x = R.slice(6);
                if (x === "[DONE]") {
                  f({ content: h, tool_calls: this._buildToolCalls(p) });
                  return;
                }
                let _;
                try {
                  _ = JSON.parse(x);
                } catch {
                  continue;
                }
                let b = _.choices?.[0]?.delta;
                if (
                  b &&
                  (b.content && (a(b.content), (h += b.content)), b.tool_calls)
                )
                  for (let O of b.tool_calls) {
                    let N = O.index ?? 0;
                    (p[N] ||
                      (p[N] = { id: O.id || "", name: "", arguments: "" }),
                      O.id && (p[N].id = O.id),
                      O.function?.name && (p[N].name += O.function.name),
                      O.function?.arguments &&
                        (p[N].arguments += O.function.arguments));
                  }
              }
            }),
            d.data.on("error", (y) => {
              o.signal?.aborted || m(new Error(`Stream error: ${y.message}`));
            }),
            d.data.on("end", () => {
              f({ content: h, tool_calls: this._buildToolCalls(p) });
            }));
        });
      }
      normalizeResponse(e) {
        let n = e.choices?.[0]?.message || {},
          o = (n.tool_calls || []).map((s) => ({
            id: s.id,
            function: {
              name: s.function.name,
              arguments: s.function.arguments,
            },
          }));
        return { content: n.content || "", tool_calls: o };
      }
      _buildToolCalls(e) {
        return Object.values(e)
          .filter((n) => n.name)
          .map((n) => ({
            id: n.id || `openai-${Date.now()}`,
            function: { name: n.name, arguments: n.arguments },
          }));
      }
    };
  al.exports = { OpenAIProvider: ai, OPENAI_MODELS: il };
});
var fl = H((Nk, dl) => {
  var ll = require("axios"),
    { BaseProvider: Gh, readStreamErrorBody: Kh } = Ln(),
    { serializeMessage: Ok } = Qe(),
    ul = {
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
    Yh = "2023-06-01",
    ci = class extends Gh {
      constructor(e = {}) {
        (super({
          name: "anthropic",
          baseUrl: e.baseUrl || "https://api.anthropic.com/v1",
          models: e.models || ul,
          defaultModel: e.defaultModel || "claude-sonnet",
          ...e,
        }),
          (this.timeout = e.timeout || 18e4),
          (this.temperature = e.temperature ?? 0.2),
          (this.apiVersion = e.apiVersion || Yh));
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
        let n = "",
          o = [];
        for (let s of e) {
          if (s.role === "system") {
            n +=
              (n
                ? `

`
                : "") + s.content;
            continue;
          }
          if (
            s.role !== "system" &&
            s.role !== "tool" &&
            this._messageFormatCache.has(s)
          ) {
            o.push(this._messageFormatCache.get(s));
            continue;
          }
          let r = this._formatSingleMessage(s, o);
          if (r) {
            if (
              s.role !== "system" &&
              s.role !== "tool" &&
              this._messageStringCache.size < this._maxCacheSize
            ) {
              let i = this._getMessageCacheKey(s);
              (this._messageStringCache.set(i, r),
                this._messageFormatCache.set(s, r));
            }
            o.push(r);
          }
        }
        for (let s = o.length - 1; s > 0; s--)
          o[s].role === "user" &&
            o[s - 1].role === "user" &&
            o.splice(s, 0, {
              role: "assistant",
              content: [{ type: "text", text: "[continuing]" }],
            });
        return { messages: o, system: n };
      }
      _getMessageCacheKey(e) {
        let n = e.role || "",
          o = typeof e.content == "string" ? e.content.substring(0, 100) : "",
          s = e.tool_calls ? e.tool_calls.length : 0;
        return `${n}:${o.length}:${s}`;
      }
      _formatSingleMessage(e, n = []) {
        if (e.role === "assistant") {
          let o = [];
          if (
            (e.content && o.push({ type: "text", text: e.content }),
            e.tool_calls)
          )
            for (let s of e.tool_calls)
              o.push({
                type: "tool_use",
                id: s.id || `toolu-${Date.now()}`,
                name: s.function.name,
                input:
                  typeof s.function.arguments == "string"
                    ? JSON.parse(s.function.arguments || "{}")
                    : s.function.arguments || {},
              });
          return {
            role: "assistant",
            content: o.length > 0 ? o : [{ type: "text", text: "" }],
          };
        }
        if (e.role === "tool") {
          let o = n[n.length - 1],
            s = {
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
            ? (o.content.push(s), null)
            : { role: "user", content: [s] };
        }
        if (Array.isArray(e.content)) {
          let o = [];
          for (let s of e.content)
            s.type === "text"
              ? o.push({ type: "text", text: s.text ?? "" })
              : s.type === "image" &&
                s.data &&
                o.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: s.media_type || "image/png",
                    data: s.data,
                  },
                });
          return { role: "user", content: o };
        }
        return { role: "user", content: e.content };
      }
      formatTools(e) {
        return !e || e.length === 0
          ? []
          : e.map((n) => ({
              name: n.function.name,
              description: n.function.description || "",
              input_schema: n.function.parameters || {
                type: "object",
                properties: {},
              },
            }));
      }
      _resolveModelId(e) {
        return this.getModel(e)?.id || e;
      }
      async chat(e, n, o = {}) {
        let s = o.model || this.defaultModel,
          r = this._resolveModelId(s),
          i = this.getModel(s),
          a = o.maxTokens || i?.maxTokens || 8192,
          { messages: l, system: u } = this.formatMessages(e),
          d = {
            model: r,
            messages: l,
            max_tokens: a,
            temperature: o.temperature ?? this.temperature,
          };
        u && (d.system = u);
        let f = this.formatTools(n);
        f.length > 0 && (d.tools = f);
        let m;
        try {
          m = await ll.post(`${this.baseUrl}/messages`, d, {
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
      async stream(e, n, o = {}) {
        let s = o.model || this.defaultModel,
          r = this._resolveModelId(s),
          i = this.getModel(s),
          a = o.maxTokens || i?.maxTokens || 8192,
          l = o.onToken || (() => {}),
          { messages: u, system: d } = this.formatMessages(e),
          f = {
            model: r,
            messages: u,
            max_tokens: a,
            temperature: o.temperature ?? this.temperature,
            stream: !0,
          };
        d && (f.system = d);
        let m = this.formatTools(n);
        m.length > 0 && (f.tools = m);
        let h;
        try {
          h = await ll.post(`${this.baseUrl}/messages`, f, {
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
            y = await Kh(p, (w) => w?.error?.message || w?.error);
          throw new Error(`API Error${g}: ${y}`);
        }
        return new Promise((p, g) => {
          let y = "",
            w = [],
            k = -1,
            R = "";
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
            h.data.on("data", (x) => {
              R += x.toString();
              let _ = R.split(`
`);
              R = _.pop() || "";
              for (let b of _) {
                let O = b.trim();
                if (O.startsWith("data: ")) {
                  let N = O.slice(6),
                    C;
                  try {
                    C = JSON.parse(N);
                  } catch {
                    continue;
                  }
                  switch (C.type) {
                    case "content_block_start": {
                      let L = C.content_block;
                      L?.type === "tool_use" &&
                        ((k = w.length),
                        w.push({ id: L.id, name: L.name, inputJson: "" }));
                      break;
                    }
                    case "content_block_delta": {
                      let L = C.delta;
                      (L?.type === "text_delta" &&
                        L.text &&
                        (l(L.text), (y += L.text)),
                        L?.type === "input_json_delta" &&
                          L.partial_json !== void 0 &&
                          k >= 0 &&
                          (w[k].inputJson += L.partial_json));
                      break;
                    }
                    case "content_block_stop":
                      k = -1;
                      break;
                    case "message_stop":
                      p({ content: y, tool_calls: this._buildToolCalls(w) });
                      return;
                  }
                }
              }
            }),
            h.data.on("error", (x) => {
              o.signal?.aborted || g(new Error(`Stream error: ${x.message}`));
            }),
            h.data.on("end", () => {
              p({ content: y, tool_calls: this._buildToolCalls(w) });
            }));
        });
      }
      normalizeResponse(e) {
        let n = "",
          o = [];
        for (let s of e.content || [])
          s.type === "text"
            ? (n += s.text)
            : s.type === "tool_use" &&
              o.push({
                id: s.id,
                function: { name: s.name, arguments: s.input },
              });
        return { content: n, tool_calls: o };
      }
      _buildToolCalls(e) {
        return e
          .filter((n) => n.name)
          .map((n) => {
            let o = {};
            if (n.inputJson)
              try {
                o = JSON.parse(n.inputJson);
              } catch {
                o = n.inputJson;
              }
            return {
              id: n.id || `anthropic-${Date.now()}`,
              function: { name: n.name, arguments: o },
            };
          });
      }
    };
  dl.exports = { AnthropicProvider: ci, ANTHROPIC_MODELS: ul };
});
var gl = H((Pk, hl) => {
  var pl = require("axios"),
    { BaseProvider: zh, readStreamErrorBody: Xh } = Ln(),
    { serializeMessage: Mk } = Qe(),
    ml = {
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
    li = class extends zh {
      constructor(e = {}) {
        (super({
          name: "gemini",
          baseUrl:
            e.baseUrl ||
            "https://generativelanguage.googleapis.com/v1beta/openai",
          models: e.models || ml,
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
        let n = [];
        for (let o of e) {
          if (this._messageFormatCache.has(o)) {
            n.push(this._messageFormatCache.get(o));
            continue;
          }
          let s = this._getMessageCacheKey(o);
          if (this._messageStringCache.has(s)) {
            let i = this._messageStringCache.get(s);
            (this._messageFormatCache.set(o, i), n.push(i));
            continue;
          }
          let r = this._formatSingleMessage(o);
          (this._messageStringCache.size < this._maxCacheSize &&
            this._messageStringCache.set(s, r),
            this._messageFormatCache.set(o, r),
            n.push(r));
        }
        return { messages: n };
      }
      _getMessageCacheKey(e) {
        let n = e.role || "",
          o = typeof e.content == "string" ? e.content.substring(0, 100) : "",
          s = e.tool_calls ? e.tool_calls.length : 0;
        return `${n}:${o.length}:${s}`;
      }
      _formatSingleMessage(e) {
        if (e.role === "assistant" && e.tool_calls)
          return {
            role: "assistant",
            content: e.content || "",
            tool_calls: e.tool_calls.map((n) => ({
              id: n.id || `call-${Date.now()}`,
              type: "function",
              function: {
                name: n.function.name,
                arguments:
                  typeof n.function.arguments == "string"
                    ? n.function.arguments
                    : JSON.stringify(n.function.arguments),
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
          let n = [];
          for (let o of e.content)
            if (o.type === "text") n.push({ type: "text", text: o.text ?? "" });
            else if (o.type === "image" && o.data) {
              let s = o.data.startsWith("data:")
                ? o.data
                : `data:${o.media_type || "image/png"};base64,${o.data}`;
              n.push({
                type: "image_url",
                image_url: { url: s, detail: "auto" },
              });
            }
          return { role: "user", content: n };
        }
        return { role: e.role, content: e.content };
      }
      async chat(e, n, o = {}) {
        let s = o.model || this.defaultModel,
          r = this.getModel(s),
          i = o.maxTokens || r?.maxTokens || 8192,
          { messages: a } = this.formatMessages(e),
          l = {
            model: s,
            messages: a,
            max_tokens: i,
            temperature: o.temperature ?? this.temperature,
          };
        n && n.length > 0 && (l.tools = n);
        let u;
        try {
          u = await pl.post(`${this.baseUrl}/chat/completions`, l, {
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
      async stream(e, n, o = {}) {
        let s = o.model || this.defaultModel,
          r = this.getModel(s),
          i = o.maxTokens || r?.maxTokens || 8192,
          a = o.onToken || (() => {}),
          { messages: l } = this.formatMessages(e),
          u = {
            model: s,
            messages: l,
            max_tokens: i,
            temperature: o.temperature ?? this.temperature,
            stream: !0,
          };
        n && n.length > 0 && (u.tools = n);
        let d;
        try {
          d = await pl.post(`${this.baseUrl}/chat/completions`, u, {
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
            h = await Xh(f, (p) => p?.error?.message || p?.error);
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
            d.data.on("data", (y) => {
              g += y.toString();
              let w = g.split(`
`);
              g = w.pop() || "";
              for (let k of w) {
                let R = k.trim();
                if (!R || !R.startsWith("data: ")) continue;
                let x = R.slice(6);
                if (x === "[DONE]") {
                  f({ content: h, tool_calls: this._buildToolCalls(p) });
                  return;
                }
                let _;
                try {
                  _ = JSON.parse(x);
                } catch {
                  continue;
                }
                let b = _.choices?.[0]?.delta;
                if (
                  b &&
                  (b.content && (a(b.content), (h += b.content)), b.tool_calls)
                )
                  for (let O of b.tool_calls) {
                    let N = O.index ?? 0;
                    (p[N] ||
                      (p[N] = { id: O.id || "", name: "", arguments: "" }),
                      O.id && (p[N].id = O.id),
                      O.function?.name && (p[N].name += O.function.name),
                      O.function?.arguments &&
                        (p[N].arguments += O.function.arguments));
                  }
              }
            }),
            d.data.on("error", (y) => {
              o.signal?.aborted || m(new Error(`Stream error: ${y.message}`));
            }),
            d.data.on("end", () => {
              f({ content: h, tool_calls: this._buildToolCalls(p) });
            }));
        });
      }
      normalizeResponse(e) {
        let n = e.choices?.[0]?.message || {},
          o = (n.tool_calls || []).map((s) => ({
            id: s.id,
            function: {
              name: s.function.name,
              arguments: s.function.arguments,
            },
          }));
        return { content: n.content || "", tool_calls: o };
      }
      _buildToolCalls(e) {
        return Object.values(e)
          .filter((n) => n.name)
          .map((n) => ({
            id:
              n.id ||
              `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            function: { name: n.name, arguments: n.arguments },
          }));
      }
    };
  hl.exports = { GeminiProvider: li, GEMINI_MODELS: ml };
});
var wl = H((Ik, yl) => {
  var _o = require("axios"),
    { BaseProvider: Jh, readStreamErrorBody: Vh } = Ln(),
    $l = "http://localhost:11434",
    ui = class extends Jh {
      constructor(e = {}) {
        (super({
          name: "local",
          baseUrl:
            e.baseUrl ||
            process.env.OLLAMA_HOST ||
            process.env.OLLAMA_LOCAL_URL ||
            $l,
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
          let n =
            (await _o.get(`${this.baseUrl}/api/tags`, { timeout: 5e3 })).data
              ?.models || [];
          this.models = {};
          for (let o of n) {
            let s = o.name || o.model;
            if (!s) continue;
            let r = s.replace(/:latest$/, ""),
              i = 32768;
            try {
              let a = await _o.post(
                  `${this.baseUrl}/api/show`,
                  { name: s },
                  { timeout: 5e3 },
                ),
                l = a.data?.model_info || a.data?.details || {};
              i =
                l["general.context_length"] ||
                l["llama.context_length"] ||
                this._parseContextFromModelfile(a.data?.modelfile) ||
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
        return e.map((n) => {
          if (n.role === "user" && Array.isArray(n.content)) {
            let o = [],
              s = [];
            for (let i of n.content)
              i.type === "text"
                ? o.push(i.text ?? "")
                : i.type === "image" && i.data && s.push(i.data);
            let r = {
              role: "user",
              content: o.join(`
`),
            };
            return (s.length > 0 && (r.images = s), r);
          }
          return n;
        });
      }
      async chat(e, n, o = {}) {
        this._modelsLoaded || (await this.loadModels());
        let s = o.model || this.defaultModel;
        if (!s) throw new Error("No local model available. Is Ollama running?");
        let r;
        try {
          r = await _o.post(
            `${this.baseUrl}/api/chat`,
            {
              model: s,
              messages: this._formatMessages(e),
              tools: n && n.length > 0 ? n : void 0,
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
          let a = i.response?.status ? ` [HTTP ${i.response.status}]` : "",
            l = i.response?.data?.error || i.message;
          throw new Error(`API Error${a}: ${l}`);
        }
        return this.normalizeResponse(r.data);
      }
      async stream(e, n, o = {}) {
        this._modelsLoaded || (await this.loadModels());
        let s = o.model || this.defaultModel;
        if (!s) throw new Error("No local model available. Is Ollama running?");
        let r = o.onToken || (() => {}),
          i;
        try {
          i = await _o.post(
            `${this.baseUrl}/api/chat`,
            {
              model: s,
              messages: this._formatMessages(e),
              tools: n && n.length > 0 ? n : void 0,
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
        } catch (a) {
          if (
            a.name === "CanceledError" ||
            a.name === "AbortError" ||
            a.code === "ERR_CANCELED"
          )
            throw a;
          let l = a.response?.status ? ` [HTTP ${a.response.status}]` : "",
            u = await Vh(a, (d) => d?.error);
          throw new Error(`API Error${l}: ${u}`);
        }
        return new Promise((a, l) => {
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
                  a({ content: u, tool_calls: this._normalizeToolCalls(d) });
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
              a({ content: u, tool_calls: this._normalizeToolCalls(d) });
            }));
        });
      }
      normalizeResponse(e) {
        let n = e.message || {};
        return {
          content: n.content || "",
          tool_calls: this._normalizeToolCalls(n.tool_calls || []),
        };
      }
      _parseContextFromModelfile(e) {
        if (!e) return null;
        let n = e.match(/PARAMETER\s+num_ctx\s+(\d+)/i);
        return n ? parseInt(n[1], 10) : null;
      }
      _normalizeToolCalls(e) {
        return e.map((n, o) => ({
          id: n.id || `local-${Date.now()}-${o}`,
          function: {
            name: n.function?.name || n.name || "unknown",
            arguments: n.function?.arguments || n.arguments || {},
          },
        }));
      }
    };
  yl.exports = { LocalProvider: ui, DEFAULT_LOCAL_URL: $l };
});
var Zt = H((Lk, _l) => {
  "use strict";
  var mt = require("fs"),
    bl = require("path");
  function Qh(t) {
    if (!t || isNaN(t)) return !1;
    try {
      return (process.kill(t, 0), !0);
    } catch (e) {
      return e.code === "EPERM";
    }
  }
  function Zh(t) {
    try {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, t);
    } catch {
      let e = Date.now() + t;
      for (; Date.now() < e; );
    }
  }
  function eg(t, e) {
    let n = bl.dirname(t),
      o = bl.join(n, `.nex-tmp.${process.pid}.${Date.now()}`);
    try {
      (mt.existsSync(n) || mt.mkdirSync(n, { recursive: !0 }),
        mt.writeFileSync(o, e, "utf-8"),
        mt.renameSync(o, t));
    } catch (s) {
      try {
        mt.unlinkSync(o);
      } catch {}
      throw s;
    }
  }
  function tg(t, e, { timeout: n = 5e3, retryMs: o = 50 } = {}) {
    let s = t + ".lock",
      r = Date.now() + n;
    for (;;) {
      let i = -1;
      try {
        ((i = mt.openSync(s, "wx")),
          mt.writeSync(i, Buffer.from(String(process.pid))),
          mt.closeSync(i),
          (i = -1));
        try {
          return e();
        } finally {
          try {
            mt.unlinkSync(s);
          } catch {}
        }
      } catch (a) {
        if (i !== -1)
          try {
            mt.closeSync(i);
          } catch {}
        if (a.code !== "EEXIST") throw a;
        try {
          let l = mt.readFileSync(s, "utf-8").trim(),
            u = parseInt(l, 10);
          if (!Qh(u)) {
            try {
              mt.unlinkSync(s);
            } catch {}
            continue;
          }
        } catch (l) {
          if (l.code && l.code !== "ENOENT") throw l;
          continue;
        }
        if (Date.now() >= r) {
          try {
            mt.unlinkSync(s);
          } catch {}
          return e();
        }
        Zh(o);
      }
    }
  }
  _l.exports = { atomicWrite: eg, withFileLockSync: tg };
});
var Fn = H((Dk, Rl) => {
  var qn = require("fs"),
    di = require("path"),
    { atomicWrite: ng, withFileLockSync: sg } = Zt(),
    xl = {
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
    xo = [],
    en = {};
  function og(t, e, n, o) {
    if (
      (xo.push({ provider: t, model: e, input: n, output: o }),
      en[t] !== void 0)
    ) {
      let s = El(t);
      s.allowed ||
        process.stderr
          .write(`\x1B[33m\u26A0 Budget limit reached for ${t}: $${s.spent.toFixed(2)} / $${s.limit.toFixed(2)}\x1B[0m
`);
    }
  }
  function fi(t, e) {
    let n = xl[t];
    return n ? n[e] || { input: 0, output: 0 } : { input: 0, output: 0 };
  }
  function kl(t) {
    let e = fi(t.provider, t.model);
    return (t.input * e.input + t.output * e.output) / 1e6;
  }
  function vl() {
    let t = {};
    for (let r of xo) {
      let i = `${r.provider}:${r.model}`;
      (t[i] ||
        (t[i] = { provider: r.provider, model: r.model, input: 0, output: 0 }),
        (t[i].input += r.input),
        (t[i].output += r.output));
    }
    let e = Object.values(t).map((r) => ({ ...r, cost: kl(r) })),
      n = e.reduce((r, i) => r + i.cost, 0),
      o = e.reduce((r, i) => r + i.input, 0),
      s = e.reduce((r, i) => r + i.output, 0);
    return { totalCost: n, totalInput: o, totalOutput: s, breakdown: e };
  }
  function rg() {
    let { totalCost: t, totalInput: e, totalOutput: n, breakdown: o } = vl();
    if (o.length === 0) return "No token usage recorded this session.";
    let s = [];
    (s.push("Session Token Usage:"), s.push(""));
    for (let r of o) {
      let i = r.cost > 0 ? `$${r.cost.toFixed(4)}` : "free";
      (s.push(`  ${r.provider}:${r.model}`),
        s.push(`    Input:  ${r.input.toLocaleString()} tokens`),
        s.push(`    Output: ${r.output.toLocaleString()} tokens`),
        s.push(`    Cost:   ${i}`));
    }
    return (
      s.push(""),
      s.push(
        `  Total: ${e.toLocaleString()} in + ${n.toLocaleString()} out = $${t.toFixed(4)}`,
      ),
      s.join(`
`)
    );
  }
  function ig(t) {
    return !t || typeof t != "string" ? 0 : Math.ceil(t.length / 4);
  }
  function ag(t, e, n, o) {
    let s = fi(t, e),
      r = (n * s.input + o * s.output) / 1e6;
    return r <= 0 ? "" : `[~$${r.toFixed(4)}]`;
  }
  function cg() {
    xo = [];
  }
  function lg(t, e) {
    en[t] = e;
  }
  function ug(t) {
    delete en[t];
  }
  function dg() {
    return { ...en };
  }
  function Sl(t) {
    let e = 0;
    for (let n of xo) n.provider === t && (e += kl(n));
    return e;
  }
  function El(t) {
    let e = Sl(t),
      n = en[t];
    if (n === void 0)
      return { allowed: !0, spent: e, limit: null, remaining: null };
    let o = Math.max(0, n - e);
    return { allowed: e < n, spent: e, limit: n, remaining: o };
  }
  function Tl() {
    let t = di.join(process.cwd(), ".nex", "config.json");
    if (qn.existsSync(t))
      try {
        let e = JSON.parse(qn.readFileSync(t, "utf-8"));
        e.costLimits &&
          typeof e.costLimits == "object" &&
          (en = { ...e.costLimits });
      } catch {}
  }
  function fg() {
    let t = di.join(process.cwd(), ".nex"),
      e = di.join(t, "config.json");
    (qn.existsSync(t) || qn.mkdirSync(t, { recursive: !0 }),
      sg(e, () => {
        let n = {};
        if (qn.existsSync(e))
          try {
            n = JSON.parse(qn.readFileSync(e, "utf-8"));
          } catch {
            n = {};
          }
        ((n.costLimits = en), ng(e, JSON.stringify(n, null, 2)));
      }));
  }
  function pg() {
    en = {};
  }
  Tl();
  Rl.exports = {
    PRICING: xl,
    trackUsage: og,
    getSessionCosts: vl,
    formatCosts: rg,
    formatCostHint: ag,
    resetCosts: cg,
    getPricing: fi,
    setCostLimit: lg,
    removeCostLimit: ug,
    getCostLimits: dg,
    getProviderSpend: Sl,
    checkBudget: El,
    loadCostLimits: Tl,
    saveCostLimits: fg,
    resetCostLimits: pg,
    estimateTokens: ig,
  };
});
var mi = H((jk, Cl) => {
  function pi() {
    return process.env.NEX_DEBUG === "true" || process.argv.includes("--debug");
  }
  var mg = pi();
  function hg(...t) {
    pi() && console.log(...t);
  }
  function gg(...t) {
    pi() && console.warn(...t);
  }
  Cl.exports = { DEBUG: mg, debugLog: hg, warnLog: gg };
});
var Nl = H((qk, Ol) => {
  "use strict";
  var $g = new Set([
      "read_file",
      "grep",
      "glob",
      "search_files",
      "list_directory",
    ]),
    yg = new Set(["write_file", "edit_file", "patch_file"]),
    wg = new Set(["bash"]),
    bg = new Set(["web_search", "web_fetch", "perplexity_search"]);
  function Al(t, e) {
    let n = 0,
      o = 0,
      s = 0,
      r = 0,
      i = 0;
    for (let [a, l] of t)
      ((i += l),
        $g.has(a) && (n += l),
        yg.has(a) && (o += l),
        wg.has(a) && (s += l),
        bg.has(a) && (r += l));
    return i === 0
      ? `Phase ${e}`
      : r / i > 0.5
        ? "Research"
        : n / i > 0.5
          ? "Exploration"
          : o / i > 0.3
            ? "Implementation"
            : s / i > 0.3 && o / i < 0.15
              ? "Verification"
              : `Phase ${e}`;
  }
  var hi = class {
    constructor(e) {
      ((this._N = e),
        (this._disabled = e <= 0),
        (this._phaseNum = 0),
        (this._stepsThisPhase = 0),
        (this._phaseCounts = new Map()),
        (this._phaseStart = Date.now()));
    }
    record(e, n, o, s) {
      if (this._disabled) return null;
      this._stepsThisPhase++;
      for (let i of n)
        this._phaseCounts.set(i, (this._phaseCounts.get(i) || 0) + 1);
      if (this._stepsThisPhase < this._N) return null;
      this._phaseNum++;
      let r = {
        phaseNum: this._phaseNum,
        phaseName: Al(this._phaseCounts, this._phaseNum),
        stepCount: this._stepsThisPhase,
        toolCounts: new Map(this._phaseCounts),
        elapsed: Date.now() - this._phaseStart,
        filesRead: new Set(o),
        filesModified: new Set(s),
      };
      return (
        (this._stepsThisPhase = 0),
        (this._phaseCounts = new Map()),
        (this._phaseStart = Date.now()),
        r
      );
    }
  };
  Ol.exports = { MilestoneTracker: hi, _phaseName: Al };
});
var Un = H((Fk, Ml) => {
  var ds = Oe(),
    _g = {
      "kimi-k2.5": { id: "kimi-k2.5", name: "Kimi K2.5", max_tokens: 16384 },
      "qwen3-coder:480b": {
        id: "qwen3-coder:480b",
        name: "Qwen3 Coder 480B",
        max_tokens: 16384,
      },
    };
  function xg() {
    return ds.getActiveModel();
  }
  function kg(t) {
    return ds.setActiveModel(t);
  }
  function vg() {
    return ds.getModelNames();
  }
  function Sg(t) {
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
    let n = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (n)
      try {
        return JSON.parse(n[1].trim());
      } catch {}
    return null;
  }
  async function Eg(t, e) {
    let { C: n } = Ae(),
      { Spinner: o } = Ae(),
      s = new o("Thinking...");
    s.start();
    let r = !0,
      i = "";
    try {
      let a = await ds.callStream(t, e, {
        onToken: (l) => {
          (r && (s.stop(), process.stdout.write(`${n.blue}`), (r = !1)),
            process.stdout.write(l),
            (i += l));
        },
      });
      return (
        r
          ? s.stop()
          : process.stdout.write(`${n.reset}
`),
        a
      );
    } catch (a) {
      throw (s.stop(), a);
    }
  }
  async function Tg(t, e) {
    return ds.callChat(t, e);
  }
  Ml.exports = {
    MODELS: _g,
    getActiveModel: xg,
    setActiveModel: kg,
    getModelNames: vg,
    callOllamaStream: Eg,
    callOllama: Tg,
    parseToolArgs: Sg,
  };
});
var Ll = H((Wk, Il) => {
  var ko = require("path"),
    { C: P } = Ae(),
    { T: gi, isDark: Uk } = fn(),
    { confirm: Rg, getAutoConfirm: Cg } = Xe(),
    Pl = 2e3;
  function fs(t, e) {
    let n = t.split(`
`),
      o = e.split(`
`),
      s = [],
      r = n.length,
      i = o.length;
    if (r > Pl || i > Pl) {
      for (let f of n) s.push({ type: "remove", line: f });
      for (let f of o) s.push({ type: "add", line: f });
      return s;
    }
    let a = Array.from({ length: r + 1 }, () => new Array(i + 1).fill(0));
    for (let f = 1; f <= r; f++)
      for (let m = 1; m <= i; m++)
        n[f - 1] === o[m - 1]
          ? (a[f][m] = a[f - 1][m - 1] + 1)
          : (a[f][m] = Math.max(a[f - 1][m], a[f][m - 1]));
    let l = r,
      u = i,
      d = [];
    for (; l > 0 || u > 0; )
      l > 0 && u > 0 && n[l - 1] === o[u - 1]
        ? (d.unshift({ type: "same", line: n[l - 1] }), l--, u--)
        : u > 0 && (l === 0 || a[l][u - 1] >= a[l - 1][u])
          ? (d.unshift({ type: "add", line: o[u - 1] }), u--)
          : (d.unshift({ type: "remove", line: n[l - 1] }), l--);
    return d;
  }
  function Ag(t, e, n, o = 3) {
    console.log(`
${P.bold}${P.cyan}  Diff: ${t}${P.reset}`);
    let s = fs(e, n),
      r = [];
    if (
      (s.forEach((l, u) => {
        l.type !== "same" && r.push(u);
      }),
      r.length === 0)
    ) {
      console.log(`${P.gray}    (no changes)${P.reset}`);
      return;
    }
    let i = Math.max(0, r[0] - o),
      a = Math.min(s.length, r[r.length - 1] + o + 1);
    i > 0 && console.log(`${P.gray}    ...${P.reset}`);
    for (let l = i; l < a; l++) {
      let u = s[l];
      switch (u.type) {
        case "remove":
          console.log(`${P.red}  - ${u.line}${P.reset}`);
          break;
        case "add":
          console.log(`${P.green}  + ${u.line}${P.reset}`);
          break;
        default:
          console.log(`${P.gray}    ${u.line}${P.reset}`);
      }
    }
    (a < s.length && console.log(`${P.gray}    ...${P.reset}`), console.log());
  }
  function Og(t, e, n) {
    console.log(`
${P.bold}${P.cyan}  File exists \u2014 showing changes: ${t}${P.reset}`);
    let o = fs(e, n),
      s = 0;
    for (let i of o) i.type !== "same" && s++;
    if (s === 0) {
      console.log(`${P.gray}    (identical content)${P.reset}`);
      return;
    }
    let r = 0;
    for (let i of o) {
      if (r >= 30) {
        console.log(`${P.gray}    ...(${s - r} more changes)${P.reset}`);
        break;
      }
      switch (i.type) {
        case "remove":
          (console.log(`${P.red}  - ${i.line}${P.reset}`), r++);
          break;
        case "add":
          (console.log(`${P.green}  + ${i.line}${P.reset}`), r++);
          break;
        default:
          r > 0 && console.log(`${P.gray}    ${i.line}${P.reset}`);
      }
    }
    console.log();
  }
  function Ng(t, e) {
    console.log(`
${P.bold}${P.cyan}  New file: ${t}${P.reset}`);
    let n = e.split(`
`),
      o = n.slice(0, 20);
    for (let s of o) console.log(`${P.green}  + ${s}${P.reset}`);
    (n.length > 20 &&
      console.log(`${P.gray}    ...+${n.length - 20} more lines${P.reset}`),
      console.log());
  }
  async function Mg(t) {
    return Cg() ? !0 : Rg(`  ${t}?`);
  }
  function Pg(t, e, n, o) {
    let s = o || process.stdout.columns || 80,
      r = Math.floor((s - 3) / 2);
    (console.log(`
${P.bold}${P.cyan}  Side-by-side: ${t}${P.reset}`),
      console.log(
        `  ${P.dim}${"\u2500".repeat(r)}\u252C${"\u2500".repeat(r)}${P.reset}`,
      ));
    let i = fs(e, n),
      a = [],
      l = 0;
    for (; l < i.length; )
      if (i[l].type === "same")
        (a.push({ left: i[l].line, right: i[l].line, type: "same" }), l++);
      else if (i[l].type === "remove") {
        let h = [];
        for (; l < i.length && i[l].type === "remove"; )
          (h.push(i[l].line), l++);
        let p = [];
        for (; l < i.length && i[l].type === "add"; ) (p.push(i[l].line), l++);
        let g = Math.max(h.length, p.length);
        for (let y = 0; y < g; y++)
          a.push({
            left: y < h.length ? h[y] : "",
            right: y < p.length ? p[y] : "",
            type: "changed",
          });
      } else
        i[l].type === "add" &&
          (a.push({ left: "", right: i[l].line, type: "changed" }), l++);
    let u = a.map((h, p) => (h.type !== "same" ? p : -1)).filter((h) => h >= 0);
    if (u.length === 0) {
      console.log(`  ${P.gray}(no changes)${P.reset}`);
      return;
    }
    let d = Math.max(0, u[0] - 2),
      f = Math.min(a.length, u[u.length - 1] + 3),
      m = (h, p) => {
        let g = h.replace(/\x1b\[[0-9;]*m/g, "");
        return g.length >= p ? h.substring(0, p) : h + " ".repeat(p - g.length);
      };
    d > 0 &&
      console.log(
        `  ${P.dim}${"\xB7".repeat(r)}\u250A${"\xB7".repeat(r)}${P.reset}`,
      );
    for (let h = d; h < f; h++) {
      let p = a[h];
      if (p.type === "same")
        console.log(
          `  ${P.gray}${m(p.left, r)}${P.reset}\u2502${P.gray}${m(p.right, r)}${P.reset}`,
        );
      else {
        let g = p.left ? `${P.red}${m(p.left, r)}${P.reset}` : `${m("", r)}`,
          y = p.right ? `${P.green}${m(p.right, r)}${P.reset}` : `${m("", r)}`;
        console.log(`  ${g}\u2502${y}`);
      }
    }
    (f < a.length &&
      console.log(
        `  ${P.dim}${"\xB7".repeat(r)}\u250A${"\xB7".repeat(r)}${P.reset}`,
      ),
      console.log(`  ${P.dim}${"\u2500".repeat(r)}\u2534${"\u2500".repeat(r)}${P.reset}
`));
  }
  function Ig(t, e, n, o = {}) {
    let s = o.label || "Update",
      r = o.context || 3,
      i = o.annotations || [],
      a = ko.isAbsolute(t) ? ko.relative(process.cwd(), t) : t,
      l = fs(e, n),
      u = 1,
      d = 1;
    for (let b of l)
      b.type === "same"
        ? ((b.oldLine = u++), (b.newLine = d++))
        : b.type === "remove"
          ? ((b.oldLine = u++), (b.newLine = null))
          : ((b.oldLine = null), (b.newLine = d++));
    let f = 0,
      m = 0;
    for (let b of l) b.type === "add" ? f++ : b.type === "remove" && m++;
    if (
      (console.log(`
${P.green}\u25CF${P.reset} ${P.bold}${s}(${a})${P.reset}`),
      f === 0 && m === 0)
    ) {
      console.log(`  ${P.dim}\u2514  (no changes)${P.reset}
`);
      return;
    }
    let h = [];
    if (
      (f > 0 && h.push(`Added ${f} line${f !== 1 ? "s" : ""}`),
      m > 0 && h.push(`removed ${m} line${m !== 1 ? "s" : ""}`),
      i.length > 0)
    ) {
      let b = i.filter((L) => L.severity === "error").length,
        O = i.filter((L) => L.severity === "warn").length,
        N = i.filter((L) => L.severity === "info").length,
        C = [];
      (b > 0 && C.push(`${P.red}${b} error${b !== 1 ? "s" : ""}${P.dim}`),
        O > 0 && C.push(`${P.yellow}${O} warning${O !== 1 ? "s" : ""}${P.dim}`),
        N > 0 && C.push(`${P.cyan}${N} info${N !== 1 ? "s" : ""}${P.dim}`),
        h.push(`found ${C.join(", ")}`));
    }
    console.log(`  ${P.dim}\u2514  ${h.join(", ")}${P.reset}`);
    let g = [];
    l.forEach((b, O) => {
      b.type !== "same" && g.push(O);
    });
    let y = [],
      w = null,
      k = null;
    for (let b of g) {
      let O = Math.max(0, b - r),
        N = Math.min(l.length - 1, b + r);
      w === null
        ? ((w = O), (k = N))
        : (O <= k + 1 || (y.push([w, k]), (w = O)), (k = N));
    }
    w !== null && y.push([w, k]);
    let R = "      ",
      x = process.stdout.columns || 120;
    function _(b, O, N) {
      let C = N.replace(/\x1b\[[0-9;]*m/g, ""),
        L = N + " ".repeat(Math.max(0, x - C.length));
      return `${b}${O}${L}${P.reset}`;
    }
    for (let b = 0; b < y.length; b++) {
      b > 0 && console.log(`${R}${P.dim}\xB7\xB7\xB7${P.reset}`);
      let [O, N] = y[b];
      for (let C = O; C <= N; C++) {
        let L = l[C],
          Ee = L.newLine != null ? L.newLine : L.oldLine,
          me = String(Ee).padStart(4),
          le =
            L.type !== "remove" ? i.filter((ie) => ie.line === L.newLine) : [];
        L.type === "remove"
          ? console.log(_(gi.diff_rem_bg, P.red, `${R}${me} - ${L.line}`))
          : L.type === "add"
            ? console.log(_(gi.diff_add_bg, P.green, `${R}${me} + ${L.line}`))
            : console.log(`${R}${P.dim}${me}  ${P.reset}${L.line}`);
        for (let ie of le) {
          let oe = P.cyan,
            ce = "\u2139";
          (ie.severity === "error"
            ? ((oe = P.red), (ce = "\u2716"))
            : ie.severity === "warn" && ((oe = P.yellow), (ce = "\u26A0")),
            console.log(`${R}     ${oe}${ce} ${ie.message}${P.reset}`));
        }
      }
    }
    console.log();
  }
  function Lg(t, e, n = {}) {
    let o = ko.isAbsolute(t) ? ko.relative(process.cwd(), t) : t,
      s = e.split(`
`),
      r = n.annotations || [];
    console.log(`
${P.green}\u25CF${P.reset} ${P.bold}Create(${o})${P.reset}`);
    let i = [`${s.length} line${s.length !== 1 ? "s" : ""}`];
    if (r.length > 0) {
      let f = r.filter((g) => g.severity === "error").length,
        m = r.filter((g) => g.severity === "warn").length,
        h = r.filter((g) => g.severity === "info").length,
        p = [];
      (f > 0 && p.push(`${P.red}${f} error${f !== 1 ? "s" : ""}${P.dim}`),
        m > 0 && p.push(`${P.yellow}${m} warning${m !== 1 ? "s" : ""}${P.dim}`),
        h > 0 && p.push(`${P.cyan}${h} info${h !== 1 ? "s" : ""}${P.dim}`),
        i.push(`found ${p.join(", ")}`));
    }
    console.log(`  ${P.dim}\u2514  ${i.join(", ")}${P.reset}`);
    let l = "      ",
      u = process.stdout.columns || 120,
      d = Math.min(s.length, 20);
    for (let f = 0; f < d; f++) {
      let m = String(f + 1).padStart(4),
        h = f + 1,
        p = r.filter((k) => k.line === h),
        g = `${l}${m} + ${s[f]}`,
        y = g.replace(/\x1b\[[0-9;]*m/g, ""),
        w = g + " ".repeat(Math.max(0, u - y.length));
      console.log(`${gi.diff_add_bg}${P.green}${w}${P.reset}`);
      for (let k of p) {
        let R = P.cyan,
          x = "\u2139";
        (k.severity === "error"
          ? ((R = P.red), (x = "\u2716"))
          : k.severity === "warn" && ((R = P.yellow), (x = "\u26A0")),
          console.log(`${l}     ${R}${x} ${k.message}${P.reset}`));
      }
    }
    (s.length > 20 &&
      console.log(`${l}${P.dim}   ...+${s.length - 20} more lines${P.reset}`),
      console.log());
  }
  Il.exports = {
    diffLines: fs,
    showEditDiff: Ag,
    showWriteDiff: Og,
    showNewFilePreview: Ng,
    confirmFileChange: Mg,
    showSideBySideDiff: Pg,
    showClaudeDiff: Ig,
    showClaudeNewFile: Lg,
  };
});
var tn = H((Bk, ql) => {
  var Dl = require("util").promisify(require("child_process").exec),
    Dg = require("util").promisify(require("child_process").execFile),
    { C: Me } = Ae();
  async function $i(t) {
    try {
      let { stdout: e } = await Dl(t, { cwd: process.cwd(), timeout: 3e4 });
      return e.trim();
    } catch {
      return null;
    }
  }
  async function vo(...t) {
    try {
      let { stdout: e } = await Dg("git", t, {
        cwd: process.cwd(),
        timeout: 3e4,
      });
      return e.trim();
    } catch {
      return null;
    }
  }
  async function jg() {
    return (await $i("git rev-parse --is-inside-work-tree")) === "true";
  }
  async function qg() {
    return await $i("git branch --show-current");
  }
  async function yi() {
    try {
      let { stdout: t } = await Dl("git status --porcelain", {
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
              let n = e.substring(0, 2).trim(),
                o = e.substring(3);
              return { status: n, file: o };
            });
    } catch {
      return [];
    }
  }
  async function So(t = !1) {
    return (await $i(`git diff ${t ? "--cached" : ""}`)) || "";
  }
  async function wi() {
    return (await yi()).map((e) => e.file);
  }
  async function jl() {
    let t = await wi();
    if (t.length === 0) return null;
    let e = await So(),
      o = (await So(!0)) || e,
      s = 0,
      r = 0;
    if (o) {
      let d = o.split(`
`);
      for (let f of d)
        (f.startsWith("+") && !f.startsWith("+++") && s++,
          f.startsWith("-") && !f.startsWith("---") && r++);
    } else s = t.length;
    let i = "chore",
      a = t.join(" ").toLowerCase();
    a.includes("test")
      ? (i = "test")
      : a.includes("readme") || a.includes("doc")
        ? (i = "docs")
        : s > r * 2
          ? (i = "feat")
          : r > s
            ? (i = "refactor")
            : (i = "fix");
    let l = t.slice(0, 3).map((d) => d.split("/").pop());
    return {
      summary: `${i}: update ${l.join(", ")}${t.length > 3 ? ` (+${t.length - 3} more)` : ""}`,
      type: i,
      files: t,
      stats: { additions: s, deletions: r },
    };
  }
  async function Fg(t) {
    let n = `feat/${t
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50)}`;
    return (await vo("checkout", "-b", n)) !== null ? n : null;
  }
  async function Ug(t) {
    return (
      await vo("add", "-A"),
      (await vo("commit", "-m", t))
        ? await vo("rev-parse", "--short", "HEAD")
        : null
    );
  }
  async function Wg() {
    let t = await jl();
    if (!t) return `${Me.dim}No changes${Me.reset}`;
    let e = [];
    (e.push(`
${Me.bold}${Me.cyan}Git Diff Summary:${Me.reset}`),
      e.push(
        `  ${Me.green}+${t.stats.additions}${Me.reset} ${Me.red}-${t.stats.deletions}${Me.reset} in ${t.files.length} file(s)`,
      ),
      e.push(`
${Me.bold}${Me.cyan}Files:${Me.reset}`));
    for (let n of t.files.slice(0, 20)) e.push(`  ${Me.dim}${n}${Me.reset}`);
    return (
      t.files.length > 20 &&
        e.push(`  ${Me.dim}...+${t.files.length - 20} more${Me.reset}`),
      e.push(`
${Me.bold}${Me.cyan}Suggested message:${Me.reset}`),
      e.push(`  ${Me.cyan}${t.summary}${Me.reset}
`),
      e.join(`
`)
    );
  }
  async function Bg() {
    return (await yi()).filter(
      (e) => e.status === "UU" || e.status === "AA" || e.status === "DD",
    );
  }
  async function Hg() {
    let t = await wi();
    if (t.length === 0) return "";
    let e = [`CHANGED FILES (${t.length}):`];
    for (let o of t.slice(0, 10)) e.push(`  ${o}`);
    let n = await So();
    if (n) {
      let o =
        n.length > 5e3
          ? n.substring(0, 5e3) +
            `
...(truncated)`
          : n;
      e.push(`
DIFF:
${o}`);
    }
    return e.join(`
`);
  }
  ql.exports = {
    isGitRepo: jg,
    getCurrentBranch: qg,
    getStatus: yi,
    getDiff: So,
    getChangedFiles: wi,
    analyzeDiff: jl,
    createBranch: Fg,
    commit: Ug,
    formatDiffSummary: Wg,
    getDiffContext: Hg,
    getMergeConflicts: Bg,
  };
});
var Wt = H((Gk, Gl) => {
  var Ke = require("fs").promises,
    Hk = require("fs"),
    xt = require("path"),
    Gg = require("crypto"),
    { execSync: ps } = require("child_process"),
    Kg = 100 * 1024,
    Wl = 50,
    rt = [],
    Wn = [];
  function Yg(t, e, n, o) {
    for (
      rt.push({
        tool: t,
        filePath: e,
        oldContent: n,
        newContent: o,
        timestamp: Date.now(),
      });
      rt.length > Wl;
    )
      rt.shift();
    ((Wn.length = 0), Bl(rt[rt.length - 1]).catch(() => {}));
  }
  async function zg() {
    if (rt.length === 0) return null;
    let t = rt.pop();
    if (t.oldContent === null)
      try {
        await Ke.unlink(t.filePath);
      } catch {}
    else await Ke.writeFile(t.filePath, t.oldContent, "utf-8");
    return (
      Wn.push(t),
      { tool: t.tool, filePath: t.filePath, wasCreated: t.oldContent === null }
    );
  }
  async function Xg() {
    if (Wn.length === 0) return null;
    let t = Wn.pop();
    return (
      await Ke.writeFile(t.filePath, t.newContent, "utf-8"),
      rt.push(t),
      { tool: t.tool, filePath: t.filePath }
    );
  }
  function Jg(t = 10) {
    return rt
      .slice(-t)
      .reverse()
      .map((e) => ({
        tool: e.tool,
        filePath: e.filePath,
        timestamp: e.timestamp,
      }));
  }
  function Vg() {
    return rt.length;
  }
  function Qg() {
    return Wn.length;
  }
  function Zg({ diskToo: t = !0 } = {}) {
    if (((rt.length = 0), (Wn.length = 0), t)) {
      let e = To();
      Ke.readdir(e)
        .then((n) => {
          for (let o of n)
            o.endsWith(".json") && Ke.unlink(xt.join(e, o)).catch(() => {});
        })
        .catch(() => {});
    }
  }
  function To() {
    return xt.join(process.cwd(), ".nex", "history");
  }
  async function Fl(t, e) {
    if (t == null) return { inline: !0, content: t };
    if (Buffer.byteLength(t, "utf-8") <= Kg) return { inline: !0, content: t };
    let n = Gg.createHash("sha256").update(t, "utf-8").digest("hex"),
      o = xt.join(e, "blobs");
    return (
      await Ke.mkdir(o, { recursive: !0 }),
      await Ke.writeFile(xt.join(o, n), t, "utf-8"),
      { inline: !1, hash: n }
    );
  }
  async function Bl(t) {
    let e = To();
    await Ke.mkdir(e, { recursive: !0 });
    let n = xt.basename(t.filePath).replace(/[^a-zA-Z0-9]/g, "-"),
      o = `${t.timestamp}-${n}.json`,
      s = await Fl(t.oldContent, e),
      r = await Fl(t.newContent, e),
      i = {
        tool: t.tool,
        filePath: t.filePath,
        timestamp: t.timestamp,
        oldContent: s.inline
          ? { inline: !0, content: s.content }
          : { inline: !1, hash: s.hash },
        newContent: r.inline
          ? { inline: !0, content: r.content }
          : { inline: !1, hash: r.hash },
      };
    await Ke.writeFile(xt.join(e, o), JSON.stringify(i), "utf-8");
  }
  async function Ul(t, e) {
    if (!t) return null;
    if (t.inline) return t.content;
    let n = xt.join(e, "blobs", t.hash);
    return Ke.readFile(n, "utf-8");
  }
  async function e$() {
    let t = To(),
      e;
    try {
      e = await Ke.readdir(t);
    } catch {
      return 0;
    }
    let n = e.filter((s) => s.endsWith(".json")).sort(),
      o = 0;
    for (let s of n)
      try {
        let r = await Ke.readFile(xt.join(t, s), "utf-8"),
          i = JSON.parse(r),
          a = await Ul(i.oldContent, t),
          l = await Ul(i.newContent, t);
        (rt.push({
          tool: i.tool,
          filePath: i.filePath,
          timestamp: i.timestamp,
          oldContent: a,
          newContent: l,
        }),
          o++);
      } catch {}
    for (; rt.length > Wl; ) rt.shift();
    return o;
  }
  async function t$(t = 7) {
    let e = To(),
      n;
    try {
      n = await Ke.readdir(e);
    } catch {
      return 0;
    }
    let o = Date.now() - t * 24 * 60 * 60 * 1e3,
      s = n.filter((u) => u.endsWith(".json")),
      r = 0,
      i = new Set(),
      a = [];
    for (let u of s)
      try {
        let d = await Ke.readFile(xt.join(e, u), "utf-8"),
          f = JSON.parse(d);
        f.timestamp < o
          ? (a.push(u), r++)
          : (f.oldContent &&
              !f.oldContent.inline &&
              f.oldContent.hash &&
              i.add(f.oldContent.hash),
            f.newContent &&
              !f.newContent.inline &&
              f.newContent.hash &&
              i.add(f.newContent.hash));
      } catch {}
    for (let u of a)
      try {
        await Ke.unlink(xt.join(e, u));
      } catch {}
    let l = xt.join(e, "blobs");
    try {
      let u = await Ke.readdir(l);
      for (let d of u)
        if (!i.has(d))
          try {
            await Ke.unlink(xt.join(l, d));
          } catch {}
    } catch {}
    return r;
  }
  var Eo = "nex-snapshot";
  function n$(t, e = process.cwd()) {
    let n = t
      ? `${Eo}-${t.replace(/[^a-zA-Z0-9_-]/g, "-")}`
      : `${Eo}-${Date.now()}`;
    try {
      return ps("git status --porcelain", { cwd: e, timeout: 1e4 })
        .toString()
        .trim()
        ? (ps(`git stash push -u -m "${n}"`, { cwd: e, timeout: 15e3 }),
          ps("git stash pop", { cwd: e, timeout: 1e4 }),
          { name: n, label: n, ok: !0 })
        : {
            name: n,
            label: n,
            ok: !1,
            error: "No changes to snapshot (working tree clean)",
          };
    } catch (o) {
      return { name: n, label: n, ok: !1, error: o.message };
    }
  }
  function Hl(t = process.cwd()) {
    try {
      let e = ps("git stash list", { cwd: t, timeout: 1e4 }).toString().trim();
      return e
        ? e
            .split(
              `
`,
            )
            .map((n) => {
              let o = n.match(
                /^stash@\{(\d+)\}:\s+(?:WIP on [^:]+:\s+\S+\s+|On \S+:\s+)(.*)/,
              );
              if (!o) return null;
              let s = o[2].trim();
              return s.startsWith(Eo)
                ? {
                    index: parseInt(o[1], 10),
                    label: s,
                    shortName: s.replace(`${Eo}-`, ""),
                    date: n,
                  }
                : null;
            })
            .filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }
  function s$(t, e = process.cwd()) {
    try {
      let n = Hl(e);
      if (n.length === 0) return { ok: !1, error: "No snapshots found" };
      let o;
      return (
        t === void 0 || t === "last"
          ? (o = n[0])
          : typeof t == "number"
            ? (o = n.find((s) => s.index === t))
            : (o = n.find(
                (s) =>
                  s.label === t ||
                  s.shortName === t ||
                  s.shortName.includes(String(t)),
              )),
        o
          ? (ps(`git stash apply stash@{${o.index}}`, {
              cwd: e,
              timeout: 15e3,
            }),
            { ok: !0, label: o.label })
          : { ok: !1, error: `Snapshot not found: ${t}` }
      );
    } catch (n) {
      return { ok: !1, error: n.message };
    }
  }
  Gl.exports = {
    recordChange: Yg,
    undo: zg,
    redo: Xg,
    getHistory: Jg,
    getUndoCount: Vg,
    getRedoCount: Qg,
    clearHistory: Zg,
    persistEntry: Bl,
    loadPersistedHistory: e$,
    pruneHistory: t$,
    createSnapshot: n$,
    listSnapshots: Hl,
    restoreSnapshot: s$,
  };
});
var nn = H((Kk, Jl) => {
  var Te = require("fs"),
    it = require("path"),
    { atomicWrite: o$, withFileLockSync: r$ } = Zt(),
    at = [];
  function ms() {
    return it.join(process.cwd(), ".nex", "skills");
  }
  function Kl() {
    return it.join(process.cwd(), ".nex", "config.json");
  }
  function Yl() {
    let t = ms();
    return (Te.existsSync(t) || Te.mkdirSync(t, { recursive: !0 }), t);
  }
  function xi() {
    let t = Kl();
    if (!Te.existsSync(t)) return [];
    try {
      let e = JSON.parse(Te.readFileSync(t, "utf-8"));
      return e.skills && Array.isArray(e.skills.disabled)
        ? e.skills.disabled
        : [];
    } catch {
      return [];
    }
  }
  function zl(t) {
    let e = Kl(),
      n = it.dirname(e);
    (Te.existsSync(n) || Te.mkdirSync(n, { recursive: !0 }),
      r$(e, () => {
        let o = {};
        if (Te.existsSync(e))
          try {
            o = JSON.parse(Te.readFileSync(e, "utf-8"));
          } catch {
            o = {};
          }
        (o.skills || (o.skills = {}),
          (o.skills.disabled = t),
          o$(e, JSON.stringify(o, null, 2)));
      }));
  }
  function Xl(t, e) {
    let n = [];
    if (typeof t != "object" || t === null)
      return { valid: !1, errors: ["Module must export an object"] };
    if (
      (t.name !== void 0 &&
        typeof t.name != "string" &&
        n.push("name must be a string"),
      t.description !== void 0 &&
        typeof t.description != "string" &&
        n.push("description must be a string"),
      t.instructions !== void 0 &&
        typeof t.instructions != "string" &&
        n.push("instructions must be a string"),
      t.commands !== void 0)
    )
      if (!Array.isArray(t.commands)) n.push("commands must be an array");
      else
        for (let o = 0; o < t.commands.length; o++) {
          let s = t.commands[o];
          ((!s.cmd || typeof s.cmd != "string") &&
            n.push(`commands[${o}].cmd must be a non-empty string`),
            s.handler !== void 0 &&
              typeof s.handler != "function" &&
              n.push(`commands[${o}].handler must be a function`));
        }
    if (t.tools !== void 0)
      if (!Array.isArray(t.tools)) n.push("tools must be an array");
      else
        for (let o = 0; o < t.tools.length; o++) {
          let s = t.tools[o];
          ((!s.function ||
            !s.function.name ||
            typeof s.function.name != "string") &&
            n.push(`tools[${o}].function.name must be a non-empty string`),
            s.execute !== void 0 &&
              typeof s.execute != "function" &&
              n.push(`tools[${o}].execute must be a function`));
        }
    return { valid: n.length === 0, errors: n };
  }
  function bi(t) {
    try {
      let e = Te.readFileSync(t, "utf-8").trim();
      return e
        ? {
            name: it.basename(t, ".md"),
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
  function _i(t) {
    try {
      let e = require(t),
        { valid: n, errors: o } = Xl(e, t);
      return n
        ? {
            name: e.name || it.basename(t, ".js"),
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
  function ki() {
    at = [];
    let t = xi(),
      e = ms(),
      n = [];
    if (Te.existsSync(e))
      try {
        n = Te.readdirSync(e);
      } catch {
        n = [];
      }
    for (let s of n) {
      let r = it.join(e, s),
        i;
      try {
        i = Te.statSync(r);
      } catch {
        continue;
      }
      if (!i.isFile()) continue;
      let a = null;
      (s.endsWith(".md") ? (a = bi(r)) : s.endsWith(".js") && (a = _i(r)),
        a && ((a.enabled = !t.includes(a.name)), at.push(a)));
    }
    let o = it.join(__dirname, "skills");
    if (!process.env.NEX_SKIP_BUILTIN_SKILLS && Te.existsSync(o)) {
      let s;
      try {
        s = Te.readdirSync(o).filter(
          (r) => r.endsWith(".md") || r.endsWith(".js"),
        );
      } catch {
        s = [];
      }
      for (let r of s) {
        let i = it.join(o, r),
          a = it.basename(r, it.extname(r));
        if (at.some((d) => d.name === a)) continue;
        let l;
        try {
          l = Te.statSync(i);
        } catch {
          continue;
        }
        if (!l.isFile()) continue;
        let u = r.endsWith(".md") ? bi(i) : _i(i);
        u && ((u._builtin = !0), (u.enabled = !t.includes(u.name)), at.push(u));
      }
    }
    return at;
  }
  function i$() {
    let t = [];
    for (let e of at)
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
  function a$() {
    let t = [];
    for (let e of at)
      if (e.enabled)
        for (let n of e.commands)
          t.push({ cmd: n.cmd, desc: n.desc || `[skill: ${e.name}]` });
    return t;
  }
  function c$() {
    let t = [];
    for (let e of at)
      if (e.enabled)
        for (let n of e.tools)
          t.push({
            type: "function",
            function: {
              name: `skill_${n.function.name}`,
              description: `[Skill:${e.name}] ${n.function.description}`,
              parameters: n.function.parameters,
            },
          });
    return t;
  }
  async function l$(t, e) {
    if (!t.startsWith("skill_")) return null;
    let n = t.substring(6);
    for (let o of at)
      if (o.enabled) {
        for (let s of o.tools)
          if (s.function.name === n && s.execute)
            try {
              let r = await s.execute(e);
              return typeof r == "string" ? r : JSON.stringify(r);
            } catch (r) {
              return `ERROR: Skill tool '${n}' failed: ${r.message}`;
            }
      }
    return `ERROR: Skill tool '${n}' not found`;
  }
  function u$(t) {
    let [e, ...n] = t.split(/\s+/),
      o = n.join(" ").trim();
    for (let s of at)
      if (s.enabled) {
        for (let r of s.commands)
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
  function d$() {
    return at.map((t) => ({
      name: t.name,
      type: t.type,
      enabled: t.enabled,
      description: t.description || "",
      commands: t.commands.length,
      tools: t.tools.length,
      filePath: t.filePath,
    }));
  }
  function f$(t) {
    let e = at.find((o) => o.name === t);
    if (!e) return !1;
    e.enabled = !0;
    let n = xi().filter((o) => o !== t);
    return (zl(n), !0);
  }
  function p$(t) {
    let e = at.find((o) => o.name === t);
    if (!e) return !1;
    e.enabled = !1;
    let n = xi();
    return (n.includes(t) || (n.push(t), zl(n)), !0);
  }
  function m$() {
    return at;
  }
  async function h$(t, e = {}) {
    let { execSync: n } = require("child_process"),
      o = Yl(),
      s = t;
    /^[\w-]+\/[\w.-]+$/.test(t) && (s = `https://github.com/${t}.git`);
    let r = e.name || it.basename(s, ".git").replace(/^nex-skill-/, ""),
      i = it.join(o, r);
    if (Te.existsSync(i))
      return {
        ok: !1,
        name: r,
        error: `Skill "${r}" is already installed at ${i}. Remove it first to reinstall.`,
      };
    try {
      n(`git clone --depth 1 ${s} ${i}`, { timeout: 3e4, stdio: "pipe" });
    } catch (d) {
      return {
        ok: !1,
        name: r,
        error: `Git clone failed: ${d.stderr?.toString().trim() || d.message}`,
      };
    }
    let a = it.join(i, "skill.json"),
      l = Te.existsSync(a),
      u = Te.readdirSync(i).some(
        (d) => (d.endsWith(".md") || d.endsWith(".js")) && !d.startsWith("."),
      );
    if (!l && !u) {
      try {
        Te.rmSync(i, { recursive: !0, force: !0 });
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
        let d = JSON.parse(Te.readFileSync(a, "utf-8"));
        d.name || (d.name = r);
      } catch {
        try {
          Te.rmSync(i, { recursive: !0, force: !0 });
        } catch {}
        return {
          ok: !1,
          name: r,
          error: "Invalid skill.json \u2014 not valid JSON",
        };
      }
    return (ki(), { ok: !0, name: r });
  }
  async function g$(t) {
    let e = require("axios");
    try {
      let n = encodeURIComponent(`nex-skill ${t} OR nex-code-skill ${t}`);
      return (
        (
          await e.get(
            `https://api.github.com/search/repositories?q=${n}&sort=stars&per_page=10`,
            {
              timeout: 1e4,
              headers: { Accept: "application/vnd.github.v3+json" },
            },
          )
        ).data.items || []
      ).map((s) => ({
        name: s.name.replace(/^nex-skill-/, ""),
        description: s.description || "(no description)",
        url: s.clone_url,
        stars: s.stargazers_count,
        owner: s.owner.login,
      }));
    } catch (n) {
      return [
        {
          name: "error",
          description: `Search failed: ${n.message}`,
          url: "",
          stars: 0,
          owner: "",
        },
      ];
    }
  }
  function $$(t) {
    let e = it.join(ms(), t);
    if (!Te.existsSync(e))
      return { ok: !1, error: `Skill "${t}" not found in ${ms()}` };
    try {
      return (Te.rmSync(e, { recursive: !0, force: !0 }), ki(), { ok: !0 });
    } catch (n) {
      return { ok: !1, error: n.message };
    }
  }
  Jl.exports = {
    initSkillsDir: Yl,
    loadAllSkills: ki,
    getSkillInstructions: i$,
    getSkillCommands: a$,
    getSkillToolDefinitions: c$,
    routeSkillCall: l$,
    handleSkillCommand: u$,
    listSkills: d$,
    enableSkill: f$,
    disableSkill: p$,
    getLoadedSkills: m$,
    installSkill: h$,
    searchSkills: g$,
    removeSkill: $$,
    _getSkillsDir: ms,
    _validateScriptSkill: Xl,
    _loadMarkdownSkill: bi,
    _loadScriptSkill: _i,
  };
});
var Co = H((Yk, nu) => {
  var { spawn: y$ } = require("child_process"),
    w$ = require("path"),
    Vl = require("fs"),
    Bt = new Map();
  function b$() {
    return w$.join(process.cwd(), ".nex", "config.json");
  }
  function vi() {
    let t = b$();
    if (!Vl.existsSync(t)) return {};
    try {
      return JSON.parse(Vl.readFileSync(t, "utf-8")).mcpServers || {};
    } catch {
      return {};
    }
  }
  function Ro(t, e, n = {}, o = 1e4) {
    return new Promise((s, r) => {
      let i = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        a =
          JSON.stringify({ jsonrpc: "2.0", id: i, method: e, params: n }) +
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
                    : s(g.result));
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
        t.stdin.write(a);
      } catch (m) {
        (f(), r(new Error(`MCP write failed: ${m.message}`)));
      }
    });
  }
  async function Ql(t, e) {
    if (Bt.has(t)) return Bt.get(t);
    let n = ["PATH", "HOME", "USER", "SHELL", "LANG", "TERM", "NODE_ENV"],
      o = {};
    for (let i of n) process.env[i] && (o[i] = process.env[i]);
    let s = y$(e.command, e.args || [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...o, ...(e.env || {}) },
      }),
      r = { name: t, proc: s, tools: [], config: e };
    try {
      await Ro(s, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "nex-code", version: "0.2.0" },
      });
      let i = await Ro(s, "tools/list", {});
      return ((r.tools = (i && i.tools) || []), Bt.set(t, r), r);
    } catch (i) {
      throw (
        s.kill(),
        new Error(`Failed to connect MCP server '${t}': ${i.message}`)
      );
    }
  }
  function Zl(t) {
    let e = Bt.get(t);
    if (!e) return !1;
    try {
      e.proc.kill();
    } catch {}
    return (Bt.delete(t), !0);
  }
  function _$() {
    for (let [t] of Bt) Zl(t);
  }
  async function eu(t, e, n = {}) {
    let o = Bt.get(t);
    if (!o) throw new Error(`MCP server not connected: ${t}`);
    let s = await Ro(o.proc, "tools/call", { name: e, arguments: n });
    return s && Array.isArray(s.content)
      ? s.content.filter((r) => r.type === "text").map((r) => r.text).join(`
`)
      : JSON.stringify(s);
  }
  function tu() {
    let t = [];
    for (let [e, n] of Bt)
      for (let o of n.tools)
        t.push({
          server: e,
          name: o.name,
          description: o.description || "",
          inputSchema: o.inputSchema || { type: "object", properties: {} },
        });
    return t;
  }
  function x$() {
    return tu().map((t) => ({
      type: "function",
      function: {
        name: `mcp_${t.server}_${t.name}`,
        description: `[MCP:${t.server}] ${t.description}`,
        parameters: t.inputSchema,
      },
    }));
  }
  async function k$(t, e) {
    if (!t.startsWith("mcp_")) return null;
    let n = t.substring(4).split("_");
    if (n.length < 2) return null;
    let o = n[0],
      s = n.slice(1).join("_");
    return eu(o, s, e);
  }
  function v$() {
    let t = vi();
    return Object.entries(t).map(([e, n]) => {
      let o = Bt.get(e);
      return {
        name: e,
        command: n.command,
        connected: !!o,
        toolCount: o ? o.tools.length : 0,
      };
    });
  }
  async function S$() {
    let t = vi(),
      e = [];
    for (let [n, o] of Object.entries(t))
      try {
        let s = await Ql(n, o);
        e.push({ name: n, tools: s.tools.length });
      } catch (s) {
        e.push({ name: n, tools: 0, error: s.message });
      }
    return e;
  }
  nu.exports = {
    loadMCPConfig: vi,
    sendRequest: Ro,
    connectServer: Ql,
    disconnectServer: Zl,
    disconnectAll: _$,
    callTool: eu,
    getAllTools: tu,
    getMCPToolDefinitions: x$,
    routeMCPCall: k$,
    listServers: v$,
    connectAll: S$,
  };
});
var Oo = H((zk, iu) => {
  var su = require("fs"),
    Si = require("path"),
    Ao = [],
    hs = [],
    $n = {},
    gs = [
      "onToolResult",
      "onModelResponse",
      "onSessionStart",
      "onSessionEnd",
      "onFileChange",
      "beforeToolExec",
      "afterToolExec",
    ];
  function ou(t, e) {
    if (!t || !t.function || !t.function.name)
      return { ok: !1, error: "Tool definition must have function.name" };
    if (typeof e != "function")
      return { ok: !1, error: "Handler must be a function" };
    let n = t.function.name;
    return hs.some((o) => o.definition.function.name === n)
      ? { ok: !1, error: `Tool "${n}" is already registered` }
      : (hs.push({ definition: { type: "function", ...t }, handler: e }),
        { ok: !0 });
  }
  function ru(t, e) {
    return gs.includes(t)
      ? typeof e != "function"
        ? { ok: !1, error: "Handler must be a function" }
        : ($n[t] || ($n[t] = []), $n[t].push(e), { ok: !0 })
      : { ok: !1, error: `Unknown event "${t}". Available: ${gs.join(", ")}` };
  }
  async function Ei(t, e) {
    let n = $n[t] || [],
      o = e;
    for (let s of n)
      try {
        let r = await s(o);
        r !== void 0 && (o = r);
      } catch (r) {
        process.env.NEX_DEBUG &&
          console.error(`[plugin] Hook error on ${t}: ${r.message}`);
      }
    return o;
  }
  function E$() {
    let t = Si.join(process.cwd(), ".nex", "plugins"),
      e = [];
    if (!su.existsSync(t)) return { loaded: 0, errors: [] };
    let n = su.readdirSync(t).filter((s) => s.endsWith(".js")),
      o = { registerTool: ou, registerHook: ru, EVENTS: gs };
    for (let s of n) {
      let r = Si.join(t, s);
      try {
        let i = require(r);
        if (typeof i == "function") i(o);
        else if (typeof i.setup == "function") i.setup(o);
        else {
          e.push(`${s}: Plugin must export a function or { setup: function }`);
          continue;
        }
        Ao.push({ name: i.name || Si.basename(s, ".js"), filePath: r });
      } catch (i) {
        e.push(`${s}: ${i.message}`);
      }
    }
    return { loaded: Ao.length, errors: e };
  }
  function T$() {
    return hs.map((t) => t.definition);
  }
  async function R$(t, e, n = {}) {
    let o = hs.find((a) => a.definition.function.name === t);
    if (!o) return null;
    let s = await Ei("beforeToolExec", { name: t, args: e, options: n }),
      r = await o.handler(s.args || e, n);
    return (
      (await Ei("afterToolExec", { name: t, args: e, result: r })).result || r
    );
  }
  function C$() {
    return [...Ao];
  }
  function A$() {
    let t = {};
    for (let e of gs) t[e] = ($n[e] || []).length;
    return t;
  }
  function O$() {
    ((Ao.length = 0), (hs.length = 0));
    for (let t of Object.keys($n)) delete $n[t];
  }
  iu.exports = {
    registerTool: ou,
    registerHook: ru,
    emit: Ei,
    loadPlugins: E$,
    getPluginToolDefinitions: T$,
    executePluginTool: R$,
    getLoadedPlugins: C$,
    getHookCounts: A$,
    clearPlugins: O$,
    EVENTS: gs,
  };
});
var Ti = H((Xk, uu) => {
  var { getSkillToolDefinitions: N$ } = nn(),
    { getMCPToolDefinitions: M$ } = Co(),
    { getPluginToolDefinitions: P$ } = Oo(),
    No = new Map();
  function au() {
    let { TOOL_DEFINITIONS: t } = Et();
    return [...t, ...N$(), ...M$(), ...P$()];
  }
  function cu(t) {
    if (No.has(t)) return No.get(t);
    let n = au().find((s) => s.function.name === t);
    if (!n) return null;
    let o = n.function.parameters;
    return (No.set(t, o), o);
  }
  function I$() {
    No.clear();
  }
  function Mo(t, e) {
    if (!t || e.length === 0) return null;
    let n = null,
      o = 1 / 0;
    for (let s of e) {
      let r = lu(t.toLowerCase(), s.toLowerCase());
      r < o && ((o = r), (n = s));
    }
    return o <= Math.ceil(t.length / 2) ? n : null;
  }
  function lu(t, e) {
    let n = t.length,
      o = e.length,
      s = Array.from({ length: n + 1 }, () => Array(o + 1).fill(0));
    for (let r = 0; r <= n; r++) s[r][0] = r;
    for (let r = 0; r <= o; r++) s[0][r] = r;
    for (let r = 1; r <= n; r++)
      for (let i = 1; i <= o; i++)
        s[r][i] =
          t[r - 1] === e[i - 1]
            ? s[r - 1][i - 1]
            : 1 + Math.min(s[r - 1][i], s[r][i - 1], s[r - 1][i - 1]);
    return s[n][o];
  }
  function L$(t, e) {
    let n = cu(t);
    if (n === null) {
      let d = au().map((m) => m.function.name),
        f = Mo(t, d);
      return {
        valid: !1,
        error: `Unknown tool "${t}".${f ? ` Did you mean "${f}"?` : ""}
Available tools: ${d.join(", ")}`,
      };
    }
    if (!n || !n.properties) return { valid: !0 };
    let o = n.required || [],
      s = Object.keys(n.properties),
      r = Object.keys(e),
      i = [],
      a = { ...e },
      l = !1;
    for (let u of o)
      if (!(u in e) || e[u] === void 0 || e[u] === null) {
        let d = Mo(u, r);
        d && !s.includes(d)
          ? ((a[u] = e[d]), delete a[d], (l = !0))
          : i.push(
              `Missing required parameter "${u}" (${n.properties[u]?.description || n.properties[u]?.type || "unknown"})`,
            );
      }
    for (let u of r)
      if (!s.includes(u)) {
        let d = Mo(u, s);
        d && !(d in a)
          ? ((a[d] = e[u]), delete a[u], (l = !0))
          : l ||
            i.push(
              `Unknown parameter "${u}".${d ? ` Did you mean "${d}"?` : ""}`,
            );
      }
    for (let u of Object.keys(a)) {
      if (!n.properties[u]) continue;
      let d = n.properties[u].type,
        f = typeof a[u];
      d === "string" && f === "number"
        ? ((a[u] = String(a[u])), (l = !0))
        : d === "number" && f === "string" && !isNaN(a[u])
          ? ((a[u] = Number(a[u])), (l = !0))
          : d === "boolean" &&
            f === "string" &&
            ((a[u] = a[u] === "true"), (l = !0));
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

Expected parameters: ${JSON.stringify(n.properties, null, 2)}`,
        }
      : { valid: !0, corrected: l ? a : null };
  }
  function D$(t, e) {
    let n = [],
      o = { ...t };
    if (!o.function && !o.name)
      return (
        n.push('Tool call missing both "function" and "name" fields'),
        { valid: !1, normalized: o, errors: n }
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
      let s = o.function.arguments;
      if (s.trim() === "") o.function.arguments = {};
      else
        try {
          o.function.arguments = JSON.parse(s);
        } catch (r) {
          return (
            n.push(
              `Invalid JSON in arguments${e ? ` (${e})` : ""}: ${r.message}`,
            ),
            { valid: !1, normalized: o, errors: n }
          );
        }
    }
    return o.function && typeof o.function.arguments != "object"
      ? (n.push(
          `Arguments must be an object, got ${typeof o.function.arguments}`,
        ),
        { valid: !1, normalized: o, errors: n })
      : !o.function.name || typeof o.function.name != "string"
        ? (n.push("Tool call function name must be a non-empty string"),
          { valid: !1, normalized: o, errors: n })
        : { valid: n.length === 0, normalized: o, errors: n };
  }
  uu.exports = {
    validateToolArgs: L$,
    validateToolCallFormat: D$,
    closestMatch: Mo,
    levenshtein: lu,
    getCachedSchema: cu,
    clearSchemaCache: I$,
  };
});
var mu = H((Jk, pu) => {
  var { levenshtein: Po } = Ti(),
    j$ = 200,
    q$ = 0.3,
    F$ = 2;
  function Ri(t) {
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
      .replace(/\t/g, " ".repeat(F$))
      .split(
        `
`,
      )
      .map((e) => {
        let n = e.replace(/\s+$/, ""),
          o = n.match(/^(\s*)(.*)/);
        if (!o) return n;
        let [, s, r] = o;
        return s + r.replace(/ {2,}/g, " ");
      }).join(`
`);
  }
  function U$(t, e) {
    if (t.includes(e)) return e;
    if (e.length < 10) return null;
    let n = Ri(t),
      o = Ri(e);
    if (!n.includes(o)) return null;
    let s = t.split(`
`),
      r = n.split(`
`),
      i = o.split(`
`),
      a = i[0],
      l = i[i.length - 1];
    for (let u = 0; u <= r.length - i.length; u++) {
      let d = !0;
      for (let f = 0; f < i.length; f++)
        if (r[u + f] !== i[f]) {
          d = !1;
          break;
        }
      if (d)
        return s.slice(u, u + i.length).join(`
`);
    }
    if (i.length === 1) {
      for (let u = 0; u < r.length; u++)
        if (r[u].indexOf(o) !== -1) return s[u];
    }
    return null;
  }
  function W$(t, e) {
    if (!t || !e) return null;
    let n = t.split(`
`),
      s = e.split(`
`).length;
    return n.length === 0 || s === 0 ? null : s === 1 ? B$(n, e) : G$(n, e, s);
  }
  function du(t) {
    return Math.max(1, Math.floor(t / j$));
  }
  function fu(t, e) {
    return t <= Math.ceil(e * q$);
  }
  function B$(t, e) {
    let n = e.trim(),
      o = du(t.length),
      s = null,
      r = 1 / 0;
    for (let i = 0; i < t.length; i += o) {
      let a = t[i];
      if (!a.trim()) continue;
      let l = Po(a.trim(), n);
      l < r && ((r = l), (s = { text: a, distance: l, line: i + 1 }));
    }
    return (
      s && o > 1 && ((s = H$(t, n, s, o) || s), (r = s.distance)),
      fu(r, e.length) ? s : null
    );
  }
  function H$(t, e, n, o) {
    let s = n.line - 1,
      r = Math.max(0, s - o),
      i = Math.min(t.length - 1, s + o),
      a = n.distance,
      l = null;
    for (let u = r; u <= i; u++) {
      let d = t[u];
      if (!d.trim()) continue;
      let f = Po(d.trim(), e);
      f < a && ((a = f), (l = { text: d, distance: f, line: u + 1 }));
    }
    return l;
  }
  function G$(t, e, n) {
    let o = t.length - n + 1;
    if (o <= 0) return null;
    let s = du(o),
      r = null,
      i = 1 / 0;
    for (let a = 0; a < o; a += s) {
      let l = t.slice(a, a + n).join(`
`),
        u = Po(l, e);
      u < i && ((i = u), (r = { text: l, distance: u, line: a + 1 }));
    }
    return (
      r && s > 1 && ((r = K$(t, e, r, s, n, o) || r), (i = r.distance)),
      fu(i, e.length) ? r : null
    );
  }
  function K$(t, e, n, o, s, r) {
    let i = n.line - 1,
      a = Math.max(0, i - o),
      l = Math.min(r - 1, i + o),
      u = n.distance,
      d = null;
    for (let f = a; f <= l; f++) {
      let m = t.slice(f, f + s).join(`
`),
        h = Po(m, e);
      h < u && ((u = h), (d = { text: m, distance: h, line: f + 1 }));
    }
    return d;
  }
  pu.exports = {
    normalizeWhitespace: Ri,
    fuzzyFindText: U$,
    findMostSimilar: W$,
  };
});
var gu = H((Qk, hu) => {
  var { C: Vk } = Ae(),
    Y$ = [
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
    z$ = [
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
  function X$(t, e) {
    let n = e.split(`
`),
      o = [],
      s = t ? `.${t.split(".").pop()}` : "";
    for (let r = 0; r < n.length; r++) {
      let i = n[r],
        a = r + 1;
      for (let l of Y$)
        l.regex.test(i) &&
          o.push({
            line: a,
            message: `Potential secret detected: ${l.name}`,
            severity: "error",
          });
      for (let l of z$)
        (l.ext && !l.ext.includes(s)) ||
          (l.regex.test(i) &&
            o.push({
              line: a,
              message: l.message || `Found ${l.name}`,
              severity: l.severity || "warn",
            }));
    }
    return (
      n.length > 500 &&
        o.push({
          line: 0,
          message: `Large file detected (${n.length} lines). Consider refactoring.`,
          severity: "info",
        }),
      o
    );
  }
  function J$() {
    let t = process.memoryUsage();
    return {
      rss: Math.round((t.rss / 1024 / 1024) * 100) / 100,
      heapUsed: Math.round((t.heapUsed / 1024 / 1024) * 100) / 100,
    };
  }
  hu.exports = { runDiagnostics: X$, getMemoryUsage: J$ };
});
var Mi = H((Zk, xu) => {
  var Bn = require("fs").promises,
    Hn = require("path"),
    { exec: V$ } = require("util").promisify(require("child_process").exec),
    Gn = [],
    Ni = null,
    Io = !1,
    Ai = 0,
    Q$ = 6e4;
  function yu(t) {
    return !(Gn.length === 0 || Ni !== t || Date.now() - Ai > Q$);
  }
  async function wu(t) {
    if (!Io && !yu(t)) {
      ((Io = !0), (Ni = t));
      try {
        try {
          let { stdout: o } = await V$("rg --files", { cwd: t, timeout: 5e3 });
          ((Gn = o
            .split(
              `
`,
            )
            .filter(Boolean)),
            (Ai = Date.now()),
            (Io = !1));
          return;
        } catch {}
        let e = [],
          n = async (o, s) => {
            let r;
            try {
              r = await Bn.readdir(o, { withFileTypes: !0 });
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
              let a = s ? `${s}/${i.name}` : i.name;
              i.isDirectory() ? await n(Hn.join(o, i.name), a) : e.push(a);
            }
          };
        (await n(t, ""), (Gn = e), (Ai = Date.now()));
      } catch (e) {
        console.error(`Index error: ${e.message}`);
      } finally {
        Io = !1;
      }
    }
  }
  function Oi() {
    return Gn;
  }
  function Z$() {
    return Ni;
  }
  function ey(t) {
    return Gn.filter((e) => Hn.basename(e) === t);
  }
  function ty(t) {
    let e = t.toLowerCase();
    return Gn.filter((n) => n.toLowerCase().includes(e)).slice(0, 20);
  }
  var Ci = null,
    $u = 0,
    ny = 12e4,
    sy = new Set([
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
  function bu(t, e) {
    let n = [],
      o = t.split(`
`);
    for (let s = 0; s < o.length; s++) {
      let r = o[s],
        i = s + 1;
      if ([".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"].includes(e)) {
        let a = r.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        a && n.push({ type: "function", name: a[1], line: i });
        let l = r.match(/(?:export\s+)?class\s+(\w+)/);
        l && n.push({ type: "class", name: l[1], line: i });
        let u = r.match(
          /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/,
        );
        u && n.push({ type: "function", name: u[1], line: i });
        let d = r.match(/module\.exports\s*=\s*\{([^}]+)\}/);
        if (d) {
          let m = d[1]
            .split(",")
            .map((h) => h.trim().split(":")[0].trim())
            .filter(Boolean);
          for (let h of m)
            /^\w+$/.test(h) && n.push({ type: "export", name: h, line: i });
        }
        let f = r.match(
          /(?:require\(['"]([^'"]+)['"]\)|from\s+['"]([^'"]+)['"])/,
        );
        if (f) {
          let m = f[1] || f[2];
          n.push({ type: "import", name: m, line: i });
        }
      }
      if (e === ".py") {
        let a = r.match(/^(?:async\s+)?def\s+(\w+)/);
        a && n.push({ type: "function", name: a[1], line: i });
        let l = r.match(/^class\s+(\w+)/);
        l && n.push({ type: "class", name: l[1], line: i });
        let u = r.match(/^(?:from\s+(\S+)\s+)?import\s+(\S+)/);
        u && n.push({ type: "import", name: u[1] || u[2], line: i });
      }
      if (e === ".go") {
        let a = r.match(/^func\s+(?:\([^)]+\)\s+)?(\w+)/);
        a && n.push({ type: "function", name: a[1], line: i });
        let l = r.match(/^type\s+(\w+)\s+struct/);
        l && n.push({ type: "class", name: l[1], line: i });
      }
    }
    return n;
  }
  async function _u(t) {
    t = t || process.cwd();
    let e = Hn.join(t, ".nex", "index", "content-index.json"),
      n = {};
    if (Ci && Date.now() - $u < ny) return Ci;
    try {
      let i = await Bn.readFile(e, "utf-8");
      n = JSON.parse(i);
    } catch {
      n = { files: {} };
    }
    Oi().length === 0 && (await wu(t));
    let s = { files: {} },
      r = !1;
    for (let i of Oi()) {
      let a = Hn.extname(i);
      if (!sy.has(a)) continue;
      let l = Hn.join(t, i);
      try {
        let d = (await Bn.stat(l)).mtimeMs;
        if (n.files[i] && n.files[i].mtime === d) {
          s.files[i] = n.files[i];
          continue;
        }
        let f = await Bn.readFile(l, "utf-8"),
          m = bu(f, a);
        ((s.files[i] = { defs: m, mtime: d }), (r = !0));
      } catch {}
    }
    if (r) {
      let i = Hn.join(t, ".nex", "index");
      (await Bn.mkdir(i, { recursive: !0 }),
        await Bn.writeFile(e, JSON.stringify(s), "utf-8"));
    }
    return ((Ci = s), ($u = Date.now()), s);
  }
  async function oy(t, e) {
    let n = await _u(),
      o = [],
      s = t.toLowerCase();
    for (let [r, i] of Object.entries(n.files))
      for (let a of i.defs)
        (e && a.type !== e) ||
          (a.name.toLowerCase().includes(s) &&
            o.push({ file: r, type: a.type, name: a.name, line: a.line }));
    return (
      o.sort((r, i) => {
        let a = r.name.toLowerCase() === s ? 0 : 1,
          l = i.name.toLowerCase() === s ? 0 : 1;
        if (a !== l) return a - l;
        let u = r.name.toLowerCase().startsWith(s) ? 0 : 1,
          d = i.name.toLowerCase().startsWith(s) ? 0 : 1;
        return u - d;
      }),
      o.slice(0, 50)
    );
  }
  xu.exports = {
    refreshIndex: wu,
    getFileIndex: Oi,
    getIndexedCwd: Z$,
    findFileInIndex: ey,
    searchIndex: ty,
    isIndexValid: yu,
    buildContentIndex: _u,
    searchContentIndex: oy,
    extractDefinitions: bu,
  };
});
var Kn = H((ev, Eu) => {
  var Lo = require("fs"),
    jo = require("path"),
    qo = require("os"),
    { execFile: ry } = require("child_process"),
    { promisify: iy } = require("util"),
    Pi = iy(ry),
    ay = jo.join(qo.homedir(), ".nex", "servers.json"),
    Do = jo.join(qo.tmpdir(), "nex-ssh-sockets");
  function cy() {
    return jo.join(process.cwd(), ".nex", "servers.json");
  }
  function ku() {
    let t = (o) => {
        if (!Lo.existsSync(o)) return {};
        try {
          return JSON.parse(Lo.readFileSync(o, "utf-8"));
        } catch {
          return {};
        }
      },
      e = t(ay),
      n = t(cy());
    return { ...e, ...n };
  }
  function ly(t) {
    let e = ku();
    if (e[t]) return { ...e[t], _name: t };
    if (
      /^[\w.-]+@[\w.-]+$/.test(t) ||
      /[\w-]+\.[\w.-]+/.test(t) ||
      t === "localhost"
    ) {
      let [s, r] = t.includes("@") ? t.split("@") : [void 0, t];
      return { host: r, user: s };
    }
    let n = Object.keys(e),
      o = n.length
        ? `Available profiles: ${n.join(", ")}`
        : "No profiles configured. Create .nex/servers.json (project) or ~/.nex/servers.json (global)";
    throw new Error(`Unknown server: "${t}". ${o}`);
  }
  function uy() {
    Lo.existsSync(Do) || Lo.mkdirSync(Do, { recursive: !0 });
  }
  function vu(t) {
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
    (t.key && e.push("-i", t.key.replace(/^~/, qo.homedir())),
      t.port && Number(t.port) !== 22 && e.push("-p", String(t.port)),
      uy());
    let n = t.user ? `${t.user}@${t.host}` : t.host,
      o = jo.join(Do, n.replace(/[@.:]/g, "_"));
    return (
      e.push(
        "-o",
        "ControlMaster=auto",
        "-o",
        `ControlPath=${o}`,
        "-o",
        "ControlPersist=120",
      ),
      e.push(n),
      { args: e, target: n }
    );
  }
  function Su(t) {
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
      t.key && e.push("-i", t.key.replace(/^~/, qo.homedir())),
      t.port && Number(t.port) !== 22 && e.push("-P", String(t.port)),
      e
    );
  }
  async function dy(t, e, { timeout: n = 3e4, sudo: o = !1 } = {}) {
    let { args: s } = vu(t),
      r = o && t.sudo ? `sudo sh -c ${JSON.stringify(e)}` : e;
    try {
      let { stdout: i, stderr: a } = await Pi("ssh", [...s, r], {
        timeout: n,
        maxBuffer: 4194304,
      });
      return { stdout: i || "", stderr: a || "", exitCode: 0 };
    } catch (i) {
      let a = typeof i.code == "number" ? i.code : 1,
        l = (i.stderr || i.message || "").toString();
      return {
        stdout: (i.stdout || "").toString(),
        stderr: l,
        exitCode: a,
        error: Fo(l, t),
      };
    }
  }
  async function fy(t, e, n, { timeout: o = 12e4 } = {}) {
    let s = Su(t),
      r = t.user ? `${t.user}@${t.host}` : t.host;
    s.push(e, `${r}:${n}`);
    try {
      let { stdout: i, stderr: a } = await Pi("scp", s, {
        timeout: o,
        maxBuffer: 1048576,
      });
      return i || a || `Uploaded ${e} \u2192 ${r}:${n}`;
    } catch (i) {
      let a = (i.stderr || i.message || "").toString();
      throw new Error(Fo(a, t) || a);
    }
  }
  async function py(t, e, n, { timeout: o = 12e4 } = {}) {
    let s = Su(t),
      r = t.user ? `${t.user}@${t.host}` : t.host;
    s.push(`${r}:${e}`, n);
    try {
      let { stdout: i, stderr: a } = await Pi("scp", s, {
        timeout: o,
        maxBuffer: 1048576,
      });
      return i || a || `Downloaded ${r}:${e} \u2192 ${n}`;
    } catch (i) {
      let a = (i.stderr || i.message || "").toString();
      throw new Error(Fo(a, t) || a);
    }
  }
  function Fo(t, e) {
    if (!t) return "";
    if (/connection refused/i.test(t)) {
      let n = e.port || 22;
      return `${t}
HINT: Connection refused on ${e.host}:${n}. Check: server is running, SSH service is active (systemctl status sshd), firewall allows port ${n} (firewall-cmd --list-ports).`;
    }
    if (/permission denied/i.test(t)) {
      let n = e.key ? `key: ${e.key}` : "SSH agent";
      return `${t}
HINT: Auth failed using ${n} as user "${e.user || "root"}". Check: authorized_keys on server, correct username, key passphrase.`;
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
  function my(t, e) {
    let n = e.user ? `${e.user}@${e.host}` : e.host,
      o = e.port && Number(e.port) !== 22 ? `:${e.port}` : "",
      s = e.os ? ` [${e.os}]` : "",
      r = e.key ? ` key:${e.key}` : "",
      i = e.sudo ? " sudo:yes" : "";
    return `${t}: ${n}${o}${s}${r}${i}`;
  }
  Eu.exports = {
    loadServerProfiles: ku,
    resolveProfile: ly,
    buildSSHArgs: vu,
    sshExec: dy,
    scpUpload: fy,
    scpDownload: py,
    enrichSSHError: Fo,
    formatProfile: my,
    SSH_SOCKET_DIR: Do,
  };
});
var Di = H((tv, Ru) => {
  var $s = require("fs"),
    Ii = require("path"),
    hy = Ii.join(".nex", "deploy.json");
  function Li() {
    return Ii.join(process.cwd(), hy);
  }
  function Tu() {
    let t = Li();
    if (!$s.existsSync(t)) return {};
    try {
      return JSON.parse($s.readFileSync(t, "utf-8"));
    } catch {
      return {};
    }
  }
  function gy(t) {
    let e = Tu();
    if (e[t]) return { ...e[t], _name: t };
    let n = Object.keys(e),
      o = n.length
        ? `Available: ${n.join(", ")}`
        : "No deploy configs found. Create .nex/deploy.json or use explicit params.";
    throw new Error(`Unknown deploy config: "${t}". ${o}`);
  }
  function $y(t) {
    let e = Ii.join(process.cwd(), ".nex");
    ($s.existsSync(e) || $s.mkdirSync(e, { recursive: !0 }),
      $s.writeFileSync(
        Li(),
        JSON.stringify(t, null, 2) +
          `
`,
        "utf-8",
      ));
  }
  Ru.exports = {
    loadDeployConfigs: Tu,
    resolveDeployConfig: gy,
    saveDeployConfigs: $y,
    getDeployConfigPath: Li,
  };
});
var Uo = H((nv, Ou) => {
  var { getActiveModel: yy, getActiveProviderName: wy } = Oe(),
    ys = {
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
    ws = {
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
    bs = {
      ollama: "full",
      openai: "full",
      anthropic: "full",
      gemini: "full",
      local: "essential",
    },
    Lt = {};
  function Au() {
    try {
      let t = require("fs"),
        n = require("path").join(process.cwd(), ".nex", "config.json");
      t.existsSync(n) &&
        (Lt = JSON.parse(t.readFileSync(n, "utf-8")).toolTiers || {});
    } catch {
      Lt = {};
    }
  }
  Au();
  function ji() {
    let e = yy()?.id,
      n = wy();
    return e && Lt[e]
      ? Lt[e]
      : n && Lt[`${n}:*`]
        ? Lt[`${n}:*`]
        : e && ws[e]
          ? ws[e]
          : n && bs[n]
            ? bs[n]
            : "full";
  }
  var by = new Set([
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
    Cu = {
      anthropic: "strict",
      openai: "strict",
      gemini: "strict",
      ollama: "fuzzy",
      local: "fuzzy",
    };
  function _y(t, e) {
    return t && (by.has(t) || t.startsWith("claude-"))
      ? "strict"
      : e && Cu[e]
        ? Cu[e]
        : "fuzzy";
  }
  function xy(t, e) {
    return t && Lt[t]
      ? Lt[t]
      : e && Lt[`${e}:*`]
        ? Lt[`${e}:*`]
        : t && ws[t]
          ? ws[t]
          : e && bs[e]
            ? bs[e]
            : "full";
  }
  function ky(t, e) {
    let n = e || ji();
    if (n === "full" || !ys[n]) return t;
    let o = new Set(ys[n]);
    return t.filter((s) => o.has(s.function.name));
  }
  function vy() {
    let t = ji(),
      e = ys[t] ? ys[t].length : "all";
    return { tier: t, toolCount: e };
  }
  Ou.exports = {
    filterToolsForModel: ky,
    getActiveTier: ji,
    getModelTier: xy,
    getEditMode: _y,
    getTierInfo: vy,
    TIERS: ys,
    MODEL_TIERS: ws,
    PROVIDER_DEFAULT_TIER: bs,
    loadConfigOverrides: Au,
  };
});
var xs = H((sv, Pu) => {
  var qi = null,
    Ht = null,
    _s = null,
    Nu = `Playwright is not installed. Install with:
  npm install playwright && npx playwright install chromium
Then restart nex-code.`;
  function Mu() {
    if (_s !== null) return _s;
    try {
      (require("playwright"), (_s = !0));
    } catch {
      _s = !1;
    }
    return _s;
  }
  async function Wo() {
    if (!Mu()) throw new Error(Nu);
    return (
      qi || (qi = require("playwright")),
      (!Ht || !Ht.isConnected()) &&
        (Ht = await qi.chromium.launch({ headless: !0 })),
      Ht
    );
  }
  async function Sy() {
    if (Ht) {
      try {
        await Ht.close();
      } catch {}
      Ht = null;
    }
  }
  process.on("exit", () => {
    if (Ht)
      try {
        Ht.close();
      } catch {}
  });
  async function Ey(
    t,
    { timeout: e = 3e4, waitFor: n = "domcontentloaded" } = {},
  ) {
    let s = await (await Wo()).newPage();
    try {
      await s.goto(t, { waitUntil: n, timeout: e });
      let r = await s.title(),
        i = await s.evaluate(
          () => (
            document
              .querySelectorAll(
                "script,style,nav,footer,header,aside,[role=navigation]",
              )
              .forEach((u) => u.remove()),
            document.body?.innerText || ""
          ),
        ),
        a = await s.evaluate(() =>
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
        url: s.url(),
        text:
          i.substring(0, 8e3) +
          (i.length > 8e3
            ? `
...(truncated)`
            : ""),
        links: a.slice(0, 20),
      };
    } finally {
      await s.close();
    }
  }
  async function Ty(
    t,
    {
      width: e = 1280,
      height: n = 800,
      fullPage: o = !1,
      timeout: s = 3e4,
    } = {},
  ) {
    let i = await (await Wo()).newPage();
    try {
      (await i.setViewportSize({ width: e, height: n }),
        await i.goto(t, { waitUntil: "networkidle", timeout: s }));
      let a = await i.screenshot({ type: "png", fullPage: o }),
        l = require("os"),
        u = require("path"),
        d = require("fs"),
        f = u.join(l.tmpdir(), `nex-screenshot-${Date.now()}.png`);
      return (
        d.writeFileSync(f, a),
        {
          path: f,
          base64: a.toString("base64"),
          media_type: "image/png",
          title: await i.title(),
          url: i.url(),
        }
      );
    } finally {
      await i.close();
    }
  }
  async function Ry(t, { selector: e, text: n, timeout: o = 3e4 } = {}) {
    if (!e && !n) throw new Error("selector or text is required");
    let r = await (await Wo()).newPage();
    try {
      (await r.goto(t, { waitUntil: "domcontentloaded", timeout: o }),
        n
          ? await r.getByText(n, { exact: !1 }).first().click({ timeout: 1e4 })
          : await r.locator(e).first().click({ timeout: 1e4 }),
        await r.waitForLoadState("domcontentloaded"));
      let i = await r.title();
      return `Clicked \u2014 now at: ${r.url()} (${i})`;
    } finally {
      await r.close();
    }
  }
  async function Cy(
    t,
    { selector: e, value: n, submit: o = !1, timeout: s = 3e4 } = {},
  ) {
    if (!e || n === void 0) throw new Error("selector and value are required");
    let i = await (await Wo()).newPage();
    try {
      return (
        await i.goto(t, { waitUntil: "domcontentloaded", timeout: s }),
        await i.fill(e, String(n)),
        o &&
          (await i.keyboard.press("Enter"),
          await i.waitForLoadState("domcontentloaded")),
        `Filled "${e}" with value. ${o ? `Submitted \u2192 ${i.url()}` : "Not submitted."}`
      );
    } finally {
      await i.close();
    }
  }
  Pu.exports = {
    isPlaywrightAvailable: Mu,
    browserNavigate: Ey,
    browserScreenshot: Ty,
    browserClick: Ry,
    browserFill: Cy,
    closeBrowser: Sy,
    INSTALL_MSG: Nu,
  };
});
var Bo = H((ov, Iu) => {
  var { C: Re } = Ae(),
    vs = "",
    Ze = [],
    ks = 0,
    yn = null;
  function Ay(t) {
    yn = t;
  }
  function Oy(t, e) {
    ((vs = t), (Ze = []), (ks = 0));
    for (let o of e) {
      ks++;
      let s = `t${ks}`;
      Ze.push({
        id: s,
        description:
          o.description || o.title || o.name || o.task || `Task ${ks}`,
        status: "pending",
        dependsOn: o.depends_on || [],
        result: null,
      });
    }
    let n = Ze.map((o) => ({ ...o }));
    return (yn && yn("create", { name: t, tasks: n }), n);
  }
  function Ny(t, e, n) {
    let o = Ze.find((s) => s.id === t);
    return o
      ? ((o.status = e),
        n !== void 0 && (o.result = n),
        yn && yn("update", { id: t, status: e, result: n }),
        { ...o })
      : null;
  }
  function My() {
    return { name: vs, tasks: Ze.map((t) => ({ ...t })) };
  }
  function Py() {
    ((vs = ""), (Ze = []), (ks = 0), yn && yn("clear", {}));
  }
  function Iy() {
    return Ze.filter((t) =>
      t.status !== "pending"
        ? !1
        : t.dependsOn.length === 0
          ? !0
          : t.dependsOn.every((e) => {
              let n = Ze.find((o) => o.id === e);
              return n && n.status === "done";
            }),
    );
  }
  function Ly() {
    if (Ze.length === 0) return `${Re.dim}No active tasks${Re.reset}`;
    let t = [];
    vs &&
      (t.push(`  ${Re.bold}${Re.cyan}Tasks: ${vs}${Re.reset}`),
      t.push(`  ${Re.dim}${"\u2500".repeat(40)}${Re.reset}`));
    for (let s of Ze) {
      let r, i;
      switch (s.status) {
        case "done":
          ((r = "\u2713"), (i = Re.green));
          break;
        case "in_progress":
          ((r = "\u2192"), (i = Re.cyan));
          break;
        case "failed":
          ((r = "\u2717"), (i = Re.red));
          break;
        default:
          ((r = "\xB7"), (i = Re.dim));
      }
      let a =
          s.dependsOn.length > 0
            ? ` ${Re.dim}(after: ${s.dependsOn.join(", ")})${Re.reset}`
            : "",
        l = `[${s.status}]`,
        u =
          s.description.length > 50
            ? s.description.substring(0, 47) + "..."
            : s.description;
      if (
        (t.push(
          `  ${i}${r}${Re.reset} ${Re.bold}${s.id}${Re.reset}  ${u.padEnd(40)} ${i}${l}${Re.reset}${a}`,
        ),
        s.result && s.status === "done")
      ) {
        let d =
          s.result.length > 60 ? s.result.substring(0, 57) + "..." : s.result;
        t.push(`       ${Re.dim}\u2192 ${d}${Re.reset}`);
      }
    }
    let e = Ze.filter((s) => s.status === "done").length,
      n = Ze.filter((s) => s.status === "failed").length,
      o = Ze.length;
    return (
      t.push(`  ${Re.dim}${"\u2500".repeat(40)}${Re.reset}`),
      t.push(
        `  ${Re.dim}${e}/${o} done${n > 0 ? `, ${n} failed` : ""}${Re.reset}`,
      ),
      t.join(`
`)
    );
  }
  function Dy() {
    return (
      Ze.length > 0 &&
      Ze.some((t) => t.status === "pending" || t.status === "in_progress")
    );
  }
  Iu.exports = {
    createTasks: Oy,
    updateTask: Ny,
    getTaskList: My,
    clearTasks: Py,
    getReadyTasks: Iy,
    renderTaskList: Ly,
    setOnChange: Ay,
    hasActiveTasks: Dy,
  };
});
var Yo = H((iv, td) => {
  var {
      callStream: jy,
      getActiveProviderName: Go,
      getActiveModelId: qy,
      getConfiguredProviders: Fy,
      getProvider: Lu,
      getActiveProvider: Du,
      parseModelSpec: ju,
    } = Oe(),
    { parseToolArgs: qu } = Un(),
    { filterToolsForModel: Uy, getModelTier: Ho } = Uo(),
    { trackUsage: Fu, estimateTokens: Uu } = Fn(),
    { MultiProgress: Wy, C: rv } = Ae();
  function Wu(t) {
    return !t || typeof t != "string"
      ? 0
      : typeof Uu == "function"
        ? Uu(t)
        : Math.ceil(t.length / 4);
  }
  var Gu = 15,
    By = 5,
    Bu = 3,
    Ku = 8,
    Hy = 2,
    Ko = new Map(),
    Yu = 600 * 1e3;
  function Gy(t, e) {
    let n = Ko.get(t);
    return n && n.agentId !== e && Date.now() - n.timestamp < Yu
      ? !1
      : (Ko.set(t, { agentId: e, timestamp: Date.now() }), !0);
  }
  function Ss(t) {
    Ko.delete(t);
  }
  function Fi() {
    Ko.clear();
  }
  function zu(t) {
    let e = t.message || "",
      n = t.code || "";
    return !!(
      e.includes("429") ||
      e.includes("500") ||
      e.includes("502") ||
      e.includes("503") ||
      e.includes("504") ||
      n === "ECONNRESET" ||
      n === "ECONNABORTED" ||
      n === "ETIMEDOUT" ||
      n === "ECONNREFUSED" ||
      e.includes("socket disconnected") ||
      e.includes("TLS") ||
      e.includes("ECONNRESET") ||
      e.includes("fetch failed") ||
      e.includes("ETIMEDOUT") ||
      e.includes("ENOTFOUND")
    );
  }
  async function Xu(t, e, n) {
    let o;
    for (let s = 0; s <= Bu; s++)
      try {
        return await jy(t, e, n);
      } catch (r) {
        if (((o = r), s < Bu && zu(r))) {
          let a = (r.message || "").includes("429")
            ? Math.min(2e3 * Math.pow(2, s), 15e3)
            : Math.min(500 * Math.pow(2, s), 4e3);
          await new Promise((l) => setTimeout(l, a).unref());
          continue;
        }
        throw r;
      }
    throw o;
  }
  var Hu = new Set(["ask_user", "task_list"]);
  function Ju(t) {
    return t >= 2 ? new Set([...Hu, "spawn_agents"]) : Hu;
  }
  var Ky = new Set(["write_file", "edit_file", "patch_file"]),
    Yy = /\b(read|summarize|search|find|list|check|count|inspect|scan)\b/i,
    zy =
      /\b(refactor|rewrite|implement|create|architect|design|generate|migrate)\b/i;
  function Vu(t) {
    return zy.test(t) ? "full" : Yy.test(t) ? "essential" : "standard";
  }
  function Qu(t) {
    let e = Fy(),
      n = Go(),
      o = [...e].sort(
        (s, r) => (s.name === n ? -1 : 1) - (r.name === n ? -1 : 1),
      );
    for (let s of o)
      for (let r of s.models)
        if (Ho(r.id, s.name) === t) return { provider: s.name, model: r.id };
    return null;
  }
  var Xy = {
    essential: process.env.NEX_FAST_MODEL || null,
    standard: process.env.NEX_STANDARD_MODEL || null,
    full: process.env.NEX_HEAVY_MODEL || null,
  };
  function Ui(t) {
    if (t.model) {
      let { provider: s, model: r } = ju(t.model),
        i = s ? Lu(s) : Du(),
        a = s || Go();
      if (i && i.isConfigured() && (i.getModel(r) || a === "local")) {
        let l = Ho(r, a);
        return { provider: a, model: r, tier: l };
      }
    }
    let e = Vu(t.task),
      n = Xy[e];
    if (n) {
      let { provider: s, model: r } = ju(n),
        i = s ? Lu(s) : Du(),
        a = s || Go();
      if (i && i.isConfigured() && (i.getModel(r) || a === "local")) {
        let l = Ho(r, a);
        return { provider: a, model: r, tier: l };
      }
    }
    let o = Qu(e);
    if (o) {
      let s = Ho(o.model, o.provider);
      return { provider: o.provider, model: o.model, tier: s };
    }
    return { provider: null, model: null, tier: null };
  }
  async function Zu(t, e = {}, n = 0) {
    let o = n === 0 ? Gu : Ku,
      s = Math.min(t.max_iterations || 10, o),
      r = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      i = [],
      a = { input: 0, output: 0 },
      l = new Set(),
      u = new Map(),
      f = [
        {
          role: "system",
          content:
            t._systemPrompt ||
            `You are a focused sub-agent. Complete this specific task efficiently.

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
    let m = Ui(t),
      h = m.provider,
      p = m.model,
      g = m.tier,
      { TOOL_DEFINITIONS: y, executeTool: w } = Et(),
      k = Ju(n),
      R = Uy(
        y.filter((_) => !k.has(_.function.name)),
        g,
      );
    if (p && !t._skipLog) {
      let _ = g ? ` (${g})` : "";
      process.stderr.write(`  [sub-agent: ${h}:${p}${_}]
`);
    }
    let x = {};
    (h && (x.provider = h), p && (x.model = p));
    try {
      for (let b = 0; b < s; b++) {
        let O = await Xu(f, R, x);
        if (!O || typeof O != "object")
          throw new Error("Empty or invalid response from provider");
        {
          let le = h || Go(),
            ie = p || qy();
          if (O.usage) {
            let oe = O.usage.prompt_tokens || 0,
              ce = O.usage.completion_tokens || 0;
            ((a.input += oe), (a.output += ce), Fu(le, ie, oe, ce));
          } else {
            let oe = O.content || "",
              ce = f
                .map((M) =>
                  typeof M.content == "string"
                    ? M.content
                    : Array.isArray(M.content)
                      ? M.content
                          .map((U) => (typeof U == "string" ? U : U.text || ""))
                          .join("")
                      : "",
                )
                .join(" "),
              Q = Wu(ce),
              E = Wu(oe);
            ((a.input += Q),
              (a.output += E),
              (a._estimated = !0),
              Fu(le, ie, Q, E));
          }
        }
        let N = O.content || "",
          C = O.tool_calls,
          L = { role: "assistant", content: N || "" };
        if (
          (C && C.length > 0 && (L.tool_calls = C),
          f.push(L),
          !C || C.length === 0)
        ) {
          for (let le of l) Ss(le);
          return {
            task: t.task,
            status: "done",
            result: N || "(no response)",
            toolsUsed: i,
            tokensUsed: a,
            modelSpec: h && p ? `${h}:${p}` : null,
          };
        }
        let Ee = C.map((le) => {
            let ie = le.function.name,
              oe = qu(le.function.arguments),
              ce =
                le.id ||
                `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            if (!oe)
              return Promise.resolve({
                role: "tool",
                content: `ERROR: Malformed tool arguments for ${ie}`,
                tool_call_id: ce,
              });
            let Q = null;
            if (Ky.has(ie) && oe.path) {
              let M = require("path"),
                U = M.isAbsolute(oe.path)
                  ? oe.path
                  : M.resolve(process.cwd(), oe.path);
              if (l.has(U) || !Gy(U, r))
                return Promise.resolve({
                  role: "tool",
                  content: `ERROR: File '${oe.path}' is locked by another operation. Try a different approach or skip this file.`,
                  tool_call_id: ce,
                });
              (l.add(U), (Q = U));
            }
            return (
              i.push(ie),
              e.onUpdate &&
                e.onUpdate({ type: "tool_call", tool: ie, agentId: r }),
              (ie === "spawn_agents"
                ? ed(oe, n + 1)
                : w(ie, oe, { autoConfirm: !0, silent: !0 })
              )
                .then((M) => {
                  Q && (Ss(Q), l.delete(Q));
                  let U = String(M ?? "");
                  return {
                    role: "tool",
                    content:
                      U.length > 2e4
                        ? U.substring(0, 2e4) +
                          `
...(truncated)`
                        : U,
                    tool_call_id: ce,
                  };
                })
                .catch(
                  (M) => (
                    Q && (Ss(Q), l.delete(Q)),
                    {
                      role: "tool",
                      content: `ERROR: ${M.message}`,
                      tool_call_id: ce,
                    }
                  ),
                )
            );
          }),
          me = await Promise.all(Ee);
        f.push(...me);
        for (let le = 0; le < C.length; le++) {
          let ie = C[le];
          if (ie.function.name === "bash_exec") {
            let oe = qu(ie.function.arguments);
            if (
              (me[le]?.content || "").startsWith("ERROR") &&
              oe &&
              oe.command
            ) {
              let Q = oe.command.replace(/\s+/g, " ").trim().slice(0, 100);
              u.set(Q, (u.get(Q) || 0) + 1);
            }
          }
        }
        e.onUpdate && e.onUpdate(`step ${b + 1}/${s}`);
      }
      for (let b of l) Ss(b);
      let _ = [...u.entries()]
        .filter(([, b]) => b >= 3)
        .sort((b, O) => O[1] - b[1])
        .slice(0, 3)
        .map(([b, O]) => `"${b}" (failed ${O}\xD7)`);
      return {
        task: t.task,
        status: "truncated",
        abortReason: "iteration_limit",
        repeatedFailures: _,
        result: f[f.length - 1]?.content || "(max iterations reached)",
        toolsUsed: i,
        tokensUsed: a,
        modelSpec: h && p ? `${h}:${p}` : null,
      };
    } catch (_) {
      for (let b of l) Ss(b);
      return {
        task: t.task,
        status: "failed",
        result: `Error: ${_.message}`,
        toolsUsed: i,
        tokensUsed: a,
        modelSpec: h && p ? `${h}:${p}` : null,
      };
    }
  }
  async function ed(t, e = 0) {
    if (e >= 2)
      return "ERROR: max agent nesting depth (2) reached \u2014 reviewer agents cannot spawn further agents.";
    let n = e === 0 ? By : Hy,
      o = e === 0 ? Gu : Ku,
      s = (t.agents || []).slice(0, n);
    if (s.length === 0) return "ERROR: No agents specified";
    let r = e > 0 ? "  \u21B3 " : "",
      i = e > 0 ? 38 : 44,
      a = s.map((d) => Ui(d)),
      l = s.map((d, f) => {
        let m = a[f],
          h = m.model ? ` [${m.model}]` : "",
          p = d.task.substring(0, i - h.length);
        return `${r}Agent ${f + 1}${h}: ${p}${d.task.length > p.length ? "..." : ""}`;
      }),
      u = new Wy(l);
    u.start();
    try {
      let d = s.map((g, y) => {
          let w = a[y],
            k = Math.min(g.max_iterations || o, o),
            R = w.model
              ? {
                  ...g,
                  model: `${w.provider}:${w.model}`,
                  _skipLog: !0,
                  max_iterations: k,
                }
              : { ...g, _skipLog: !0, max_iterations: k };
          return Zu(R, { onUpdate: () => {} }, e)
            .then(
              (x) => (u.update(y, x.status === "failed" ? "error" : "done"), x),
            )
            .catch(
              (x) => (
                u.update(y, "error"),
                {
                  task: g.task,
                  status: "failed",
                  result: `Error: ${x.message}`,
                  toolsUsed: [],
                  tokensUsed: { input: 0, output: 0 },
                }
              ),
            );
        }),
        f = await Promise.all(d);
      (u.stop(), Fi());
      let m = ["Sub-agent results:", ""],
        h = 0,
        p = 0;
      for (let g = 0; g < f.length; g++) {
        let y = f[g],
          w =
            y.status === "done"
              ? "\u2713"
              : y.status === "truncated"
                ? "\u26A0"
                : "\u2717",
          k = y.modelSpec ? ` [${y.modelSpec}]` : "";
        (m.push(`${w} Agent ${g + 1}${k}: ${y.task}`),
          m.push(`  Status: ${y.status}`),
          m.push(
            `  Tools used: ${y.toolsUsed.length > 0 ? y.toolsUsed.join(", ") : "none"}`,
          ),
          m.push(`  Result: ${y.result}`),
          y.repeatedFailures &&
            y.repeatedFailures.length > 0 &&
            m.push(`  Repeated failures: ${y.repeatedFailures.join("; ")}`),
          m.push(""),
          (h += y.tokensUsed.input),
          (p += y.tokensUsed.output));
      }
      return (
        m.push(`Total sub-agent tokens: ${h} input + ${p} output`),
        m.join(`
`)
      );
    } catch (d) {
      return (
        u.stop(),
        Fi(),
        `ERROR: Sub-agent execution failed: ${d.message}`
      );
    }
  }
  td.exports = {
    runSubAgent: Zu,
    executeSpawnAgents: ed,
    clearAllLocks: Fi,
    classifyTask: Vu,
    pickModelForTier: Qu,
    resolveSubAgentModel: Ui,
    isRetryableError: zu,
    callWithRetry: Xu,
    getExcludedTools: Ju,
    LOCK_TIMEOUT_MS: Yu,
  };
});
var Rs = H((av, hd) => {
  var Le = require("fs"),
    Gt = require("path"),
    { atomicWrite: nd, withFileLockSync: sd } = Zt(),
    Jy = new Set([
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
  function Yn() {
    let t = Gt.join(process.cwd(), ".nex", "brain");
    return (Le.existsSync(t) || Le.mkdirSync(t, { recursive: !0 }), t);
  }
  function Xo() {
    return Gt.join(Yn(), ".brain-index.json");
  }
  function Hi() {
    return Gt.join(Yn(), ".embeddings.json");
  }
  function Es() {
    let t = Gt.join(process.cwd(), ".nex", "brain");
    if (!Le.existsSync(t)) return [];
    try {
      return Le.readdirSync(t)
        .filter((e) => e.endsWith(".md") && !e.startsWith("."))
        .map((e) => {
          let n = Gt.join(t, e),
            o = Le.statSync(n);
          return {
            name: e.replace(/\.md$/, ""),
            path: n,
            size: o.size,
            modified: new Date(o.mtimeMs),
          };
        })
        .sort((e, n) => n.modified - e.modified);
    } catch {
      return [];
    }
  }
  function Ts(t) {
    let e = {},
      n = t,
      o = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (o) {
      let s = o[1].split(`
`);
      for (let r of s) {
        let i = r.match(/^(\w+):\s*(.+)$/);
        if (!i) continue;
        let a = i[1].trim(),
          l = i[2].trim();
        l.startsWith("[") && l.endsWith("]")
          ? (e[a] = l
              .slice(1, -1)
              .split(",")
              .map((u) => u.trim())
              .filter(Boolean))
          : (e[a] = l);
      }
      n = o[2];
    }
    return { frontmatter: e, body: n };
  }
  function od(t) {
    let e = Gt.join(Yn(), `${t}.md`);
    if (!Le.existsSync(e))
      return { name: t, content: "", body: "", frontmatter: {} };
    let n = Le.readFileSync(e, "utf-8"),
      { frontmatter: o, body: s } = Ts(n);
    return { name: t, content: n, body: s, frontmatter: o };
  }
  function Vy(t, e) {
    let n = Gt.join(Yn(), `${t}.md`);
    (nd(n, e), ew(t, e), Qy());
  }
  function Qy() {
    if (process.env.NEX_BRAIN_EMBEDDINGS === "false") return;
    let t = Hi();
    Le.existsSync(t) &&
      setImmediate(async () => {
        try {
          await dd();
        } catch {}
      });
  }
  function Zy(t) {
    let e = Gt.join(Yn(), `${t}.md`);
    return Le.existsSync(e) ? (Le.unlinkSync(e), tw(t), !0) : !1;
  }
  function zo(t) {
    return t
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((e) => e.length > 2 && !Jy.has(e));
  }
  function Gi(t) {
    let e = {},
      { frontmatter: n, body: o } = Ts(t),
      s = Array.isArray(n.tags) ? n.tags : [];
    for (let i of s) {
      let a = i.toLowerCase().replace(/[^a-z0-9-]/g, "");
      a.length > 1 && (e[a] = (e[a] || 0) + 5);
    }
    let r = (o || t).split(`
`);
    for (let i of r)
      if (i.startsWith("#")) {
        let a = i.replace(/^#+\s*/, "");
        for (let l of zo(a)) e[l] = (e[l] || 0) + 3;
      }
    for (let i of zo(o || t)) e[i] = (e[i] || 0) + 1;
    return e;
  }
  function Ki() {
    let t = Xo();
    if (!Le.existsSync(t)) return { documents: {} };
    try {
      return JSON.parse(Le.readFileSync(t, "utf-8"));
    } catch {
      return { documents: {} };
    }
  }
  function Yi(t) {
    nd(Xo(), JSON.stringify(t, null, 2));
  }
  function ew(t, e) {
    sd(Xo(), () => {
      let n = Ki(),
        { frontmatter: o } = Ts(e),
        s = Array.isArray(o.tags) ? o.tags : [];
      ((n.documents[t] = {
        keywords: Gi(e),
        tags: s,
        modified: new Date().toISOString(),
      }),
        Yi(n));
    });
  }
  function tw(t) {
    sd(Xo(), () => {
      let e = Ki();
      (delete e.documents[t], Yi(e));
    });
  }
  function Bi() {
    let t = Es(),
      e = { documents: {} };
    for (let n of t) {
      let o = Le.readFileSync(n.path, "utf-8"),
        { frontmatter: s } = Ts(o),
        r = Array.isArray(s.tags) ? s.tags : [];
      e.documents[n.name] = {
        keywords: Gi(o),
        tags: r,
        modified: n.modified.toISOString(),
      };
    }
    return (Yi(e), e);
  }
  function rd() {
    let t = Ki(),
      e = Es();
    for (let n of e) {
      let o = t.documents[n.name];
      if (!o || new Date(o.modified) < n.modified) return Bi();
    }
    for (let n of Object.keys(t.documents))
      if (!e.some((o) => o.name === n)) return Bi();
    return t;
  }
  function id(t, e = {}) {
    let { topK: n = 3, minScore: o = 0.1 } = e,
      s = zo(t);
    if (s.length === 0) return [];
    let r = rd(),
      i = [];
    for (let [a, l] of Object.entries(r.documents)) {
      let u = 0;
      for (let d of s) {
        l.keywords[d] && (u += l.keywords[d]);
        for (let [f, m] of Object.entries(l.keywords))
          f !== d &&
            f.length > 3 &&
            d.length > 3 &&
            (f.includes(d) || d.includes(f)) &&
            (u += m * 0.3);
      }
      u >= o && i.push({ name: a, score: u });
    }
    return (i.sort((a, l) => l.score - a.score), i.slice(0, n));
  }
  var ad = process.env.NEX_EMBED_MODEL || "nomic-embed-text",
    Wi = 400,
    nw = 50;
  async function cd() {
    if (process.env.NEX_BRAIN_EMBEDDINGS === "false") return !1;
    try {
      let t = process.env.OLLAMA_HOST || "http://localhost:11434",
        e = require("http"),
        n = require("https"),
        o = new URL(`${t}/api/tags`),
        s = o.protocol === "https:" ? n : e;
      return (
        (
          await new Promise((a, l) => {
            let u = s.get(o.toString(), { timeout: 2e3 }, (d) => {
              let f = "";
              (d.on("data", (m) => (f += m)),
                d.on("end", () => {
                  try {
                    a(JSON.parse(f));
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
        .map((a) => a.name)
        .some((a) => a.startsWith(ad.split(":")[0]));
    } catch {
      return !1;
    }
  }
  async function zi(t) {
    let e = process.env.OLLAMA_HOST || "http://localhost:11434",
      n = require("http"),
      o = require("https"),
      s = new URL(`${e}/api/embeddings`),
      r = s.protocol === "https:" ? o : n,
      i = JSON.stringify({ model: ad, prompt: t });
    return new Promise((a, l) => {
      let u = r.request(
        s,
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
                a(JSON.parse(f).embedding || []);
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
  function ld(t, e) {
    if (!t || !e || t.length !== e.length) return 0;
    let n = 0,
      o = 0,
      s = 0;
    for (let i = 0; i < t.length; i++)
      ((n += t[i] * e[i]), (o += t[i] * t[i]), (s += e[i] * e[i]));
    let r = Math.sqrt(o) * Math.sqrt(s);
    return r === 0 ? 0 : n / r;
  }
  function ud(t) {
    let e = t.split(/\s+/),
      n = [],
      o = 0;
    for (; o < e.length; ) {
      let s = e.slice(o, o + Wi).join(" ");
      if ((n.push({ text: s, offset: o }), o + Wi >= e.length)) break;
      o += Wi - nw;
    }
    return n;
  }
  async function dd() {
    let t = Es(),
      e = { documents: {} },
      n = Hi();
    if (Le.existsSync(n))
      try {
        e = JSON.parse(Le.readFileSync(n, "utf-8"));
      } catch {}
    for (let o of t) {
      let s = e.documents[o.name];
      if (s && new Date(s.modified) >= o.modified) continue;
      let r = Le.readFileSync(o.path, "utf-8"),
        i = ud(r),
        a = [];
      for (let l of i) {
        let u = await zi(l.text);
        a.push({ text: l.text, embedding: u, offset: l.offset });
      }
      e.documents[o.name] = { chunks: a, modified: o.modified.toISOString() };
    }
    for (let o of Object.keys(e.documents))
      t.some((s) => s.name === o) || delete e.documents[o];
    return (Le.writeFileSync(n, JSON.stringify(e), "utf-8"), e);
  }
  async function fd(t, e = {}) {
    let { topK: n = 3, minSimilarity: o = 0.3 } = e,
      s = Hi();
    if (!Le.existsSync(s)) return [];
    let r;
    try {
      r = JSON.parse(Le.readFileSync(s, "utf-8"));
    } catch {
      return [];
    }
    let i = await zi(t),
      a = [];
    for (let [l, u] of Object.entries(r.documents || {})) {
      let d = 0,
        f = "";
      for (let m of u.chunks || []) {
        let h = ld(i, m.embedding);
        h > d && ((d = h), (f = m.text));
      }
      d >= o && a.push({ name: l, score: d, bestChunk: f });
    }
    return (a.sort((l, u) => u.score - l.score), a.slice(0, n));
  }
  function pd(t, e, n = {}) {
    let { k: o = 60, topK: s = 3 } = n,
      r = {};
    return (
      t.forEach((i, a) => {
        r[i.name] = (r[i.name] || 0) + 1 / (o + a + 1);
      }),
      e.forEach((i, a) => {
        r[i.name] = (r[i.name] || 0) + 1 / (o + a + 1);
      }),
      Object.entries(r)
        .map(([i, a]) => ({ name: i, score: a }))
        .sort((i, a) => a.score - i.score)
        .slice(0, s)
    );
  }
  async function md(t, e = {}) {
    let { topK: n = 3, minScore: o = 0.1 } = e,
      s = id(t, { topK: n, minScore: o }),
      r = s;
    if (process.env.NEX_BRAIN_EMBEDDINGS !== "false")
      try {
        if (await cd()) {
          let a = await fd(t, { topK: n });
          r = pd(s, a, { topK: n });
        }
      } catch {}
    return r.map((i) => {
      let a = od(i.name),
        l =
          (a.body || a.content || "").slice(0, 300).replace(/\n+/g, " ") +
          "...";
      return { name: i.name, score: i.score, content: a.content, excerpt: l };
    });
  }
  async function sw(t) {
    if (!t || !t.trim()) return "";
    let e = Gt.join(process.cwd(), ".nex", "brain");
    if (!Le.existsSync(e) || Es().length === 0) return "";
    let o;
    try {
      o = await md(t, { topK: 3 });
    } catch {
      return "";
    }
    if (!o || o.length === 0) return "";
    let s;
    try {
      s = Qe().estimateTokens;
    } catch {
      s = (l) => Math.ceil(l.length / 4);
    }
    let r = 25e3,
      i = [],
      a = 0;
    for (let l of o) {
      let u = l.content || "",
        d = s(u);
      if (a + d > r) {
        let m = r - a;
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
        (a += s(u)),
        a >= r)
      )
        break;
    }
    return i.length === 0
      ? ""
      : `KNOWLEDGE BASE (auto-selected):

${i.join(`

`)}`;
  }
  hd.exports = {
    getBrainDir: Yn,
    listDocuments: Es,
    readDocument: od,
    writeDocument: Vy,
    removeDocument: Zy,
    buildIndex: Bi,
    getIndex: rd,
    query: md,
    getBrainContext: sw,
    isEmbeddingAvailable: cd,
    generateEmbedding: zi,
    buildEmbeddingIndex: dd,
    semanticQuery: fd,
    cosineSimilarity: ld,
    _keywordQuery: id,
    _extractKeywords: Gi,
    _chunkText: ud,
    parseFrontmatter: Ts,
    tokenize: zo,
    _fuseResults: pd,
  };
});
var Vi = H((cv, bd) => {
  var Cs = require("fs"),
    Xi = require("path"),
    Ji = process.env.NEX_AUDIT !== "false",
    wn = null;
  function gd() {
    return (
      wn ||
      ((wn = Xi.join(process.cwd(), ".nex", "audit")),
      Cs.existsSync(wn) || Cs.mkdirSync(wn, { recursive: !0 }),
      wn)
    );
  }
  function $d() {
    let t = new Date().toISOString().split("T")[0];
    return Xi.join(gd(), `${t}.jsonl`);
  }
  function ow(t) {
    if (Ji)
      try {
        let e = {
            timestamp: new Date().toISOString(),
            tool: t.tool,
            args: yd(t.args),
            resultLength: typeof t.result == "string" ? t.result.length : 0,
            resultPreview:
              typeof t.result == "string" ? t.result.substring(0, 200) : "",
            duration: t.duration || 0,
            success: t.success !== !1,
            model: t.model || null,
            provider: t.provider || null,
          },
          n =
            JSON.stringify(e) +
            `
`;
        Cs.appendFileSync($d(), n, "utf-8");
      } catch {}
  }
  function yd(t) {
    if (!t || typeof t != "object") return {};
    let e = {};
    for (let [n, o] of Object.entries(t))
      /key|token|password|secret|credential/i.test(n)
        ? (e[n] = "***")
        : typeof o == "string" && o.length > 500
          ? (e[n] = o.substring(0, 500) + `... (${o.length} chars)`)
          : (e[n] = o);
    return e;
  }
  function wd(t = {}) {
    let e = gd(),
      n = t.days || 1,
      o = [];
    for (let s = 0; s < n; s++) {
      let r =
          t.date ||
          new Date(Date.now() - s * 864e5).toISOString().split("T")[0],
        i = Xi.join(e, `${r}.jsonl`);
      if (!Cs.existsSync(i)) continue;
      let a = Cs.readFileSync(i, "utf-8")
        .split(
          `
`,
        )
        .filter((l) => l.trim());
      for (let l of a)
        try {
          let u = JSON.parse(l);
          if (t.tool && u.tool !== t.tool) continue;
          o.push(u);
        } catch {}
      if (t.date) break;
    }
    return o;
  }
  function rw(t = 1) {
    let e = wd({ days: t });
    if (e.length === 0)
      return { totalCalls: 0, byTool: {}, avgDuration: 0, successRate: 1 };
    let n = {},
      o = 0,
      s = 0;
    for (let r of e)
      ((n[r.tool] = (n[r.tool] || 0) + 1),
        (o += r.duration || 0),
        r.success && s++);
    return {
      totalCalls: e.length,
      byTool: n,
      avgDuration: Math.round(o / e.length),
      successRate: s / e.length,
    };
  }
  function iw(t) {
    Ji = t;
  }
  function aw() {
    return Ji;
  }
  function cw() {
    wn = null;
  }
  bd.exports = {
    logToolExecution: ow,
    sanitizeArgs: yd,
    readAuditLog: wd,
    getAuditSummary: rw,
    setAuditEnabled: iw,
    isAuditEnabled: aw,
    getAuditLogPath: $d,
    _reset: cw,
  };
});
var Od = H((dv, Ad) => {
  var De = require("fs").promises,
    _d = require("fs"),
    ke = require("path"),
    ve = require("util").promisify(require("child_process").exec),
    Qi = require("util").promisify(require("child_process").execFile),
    { spawnSync: lw } = require("child_process"),
    Zi = require("axios"),
    {
      isForbidden: uw,
      isSSHForbidden: dw,
      isDangerous: fw,
      isCritical: xd,
      isBashPathForbidden: pw,
      confirm: Tt,
    } = Xe(),
    {
      showClaudeDiff: Jo,
      showClaudeNewFile: mw,
      showEditDiff: lv,
      confirmFileChange: As,
    } = Ll(),
    { C: te, Spinner: hw, getToolSpinnerText: gw } = Ae(),
    { isGitRepo: ea, getCurrentBranch: kd, getStatus: $w, getDiff: yw } = tn(),
    { recordChange: Vo } = Wt(),
    { fuzzyFindText: vd, findMostSimilar: Ms } = mu(),
    { runDiagnostics: Os } = gu(),
    { findFileInIndex: ww, getFileIndex: uv } = Mi(),
    { resolveProfile: kt, sshExec: ct, scpUpload: bw, scpDownload: _w } = Kn(),
    { resolveDeployConfig: xw, loadDeployConfigs: kw } = Di(),
    { getEditMode: Sd } = Uo(),
    vw =
      /^(vim?|nano|emacs|pico|less|more|top|htop|iftop|iotop|glances|telnet\s|screen|tmux|fzf|gum|dialog|whiptail|man\s|node\s*$|python3?\s*$|irb\s*$|rails\s*c|psql\s|mysql\s|redis-cli|mongosh?|sqlite3)\b/,
    Sw = /^ssh\s/,
    Ew = /^ssh(?:\s+-\S+)*\s+\S+@?\S+\s+["']?[^-]/;
  async function ht(t) {
    return De.access(t)
      .then(() => !0)
      .catch(() => !1);
  }
  async function Qo(t) {
    if (!t) return { fixedPath: null, message: "" };
    let e = t
        .replace(/\/+/g, "/")
        .replace(/^~\//, `${require("os").homedir()}/`),
      n = lt(e);
    if (n && (await ht(n)))
      return { fixedPath: n, message: `(auto-fixed path: ${t} \u2192 ${e})` };
    let o = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".json"],
      s = ke.extname(t);
    if (!s)
      for (let i of o) {
        let a = lt(t + i);
        if (a && (await ht(a)))
          return {
            fixedPath: a,
            message: `(auto-fixed: added ${i} extension)`,
          };
      }
    if (s) {
      let i = t.replace(/\.[^.]+$/, "");
      for (let a of o) {
        if (a === s) continue;
        let l = lt(i + a);
        if (l && (await ht(l)))
          return { fixedPath: l, message: `(auto-fixed: ${s} \u2192 ${a})` };
      }
    }
    let r = ke.basename(t);
    if (r && r.length > 2)
      try {
        let i = ww(r).map((a) => lt(a));
        if (i.length === 1)
          return {
            fixedPath: i[0],
            message: `(auto-fixed: found ${r} at ${ke.relative(process.cwd(), i[0])})`,
          };
        if (i.length > 1 && i.length <= 5)
          return {
            fixedPath: null,
            message: `File not found. Did you mean one of:
${i.map((l) => ke.relative(process.cwd(), l)).map((l) => `  - ${l}`).join(`
`)}`,
          };
      } catch {}
    return { fixedPath: null, message: "" };
  }
  function Tw(t) {
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
  function Rd(t, e) {
    let n = [];
    if (/command not found|: not found|not recognized/i.test(t)) {
      let o = e.match(/^(\S+)/),
        s = o ? o[1] : "";
      /^(npx|npm|node|yarn|pnpm|bun)$/.test(s)
        ? n.push(
            "HINT: Node.js/npm may not be in PATH. Check your Node.js installation.",
          )
        : /^(python|python3|pip|pip3)$/.test(s)
          ? n.push(
              "HINT: Python may not be installed. Try: brew install python3 (macOS) or apt install python3 (Linux)",
            )
          : n.push(
              `HINT: "${s}" is not installed. Try installing it with your package manager.`,
            );
    }
    if (/Cannot find module|MODULE_NOT_FOUND/i.test(t)) {
      let o = t.match(/Cannot find module '([^']+)'/),
        s = o ? o[1] : "";
      s && !s.startsWith(".") && !s.startsWith("/")
        ? n.push(`HINT: Missing npm package "${s}". Run: npm install ${s}`)
        : n.push(
            "HINT: Module not found. Check the import path or run npm install.",
          );
    }
    if (
      (/permission denied|EACCES/i.test(t) &&
        n.push(
          "HINT: Permission denied. Check file permissions or try a different approach.",
        ),
      /EADDRINUSE|address already in use/i.test(t))
    ) {
      let o = t.match(/port (\d+)|:(\d+)/),
        s = o ? o[1] || o[2] : "";
      n.push(
        `HINT: Port ${s || ""} is already in use. Kill the process or use a different port.`,
      );
    }
    if (
      (/SyntaxError|Unexpected token/i.test(t) &&
        n.push(
          "HINT: Syntax error in the code. Check the file at the line number shown above.",
        ),
      /TS\d{4}:/i.test(t) &&
        n.push(
          "HINT: TypeScript compilation error. Fix the type issue at the indicated line.",
        ),
      /Test Suites:.*failed|Tests:.*failed/i.test(t) &&
        n.push(
          "HINT: Test failures detected. Read the error output above to identify failing tests.",
        ),
      /fatal: not a git repository/i.test(t) &&
        n.push(
          "HINT: Not inside a git repository. Run git init or cd to a git project.",
        ),
      /^curl\b/.test(e))
    ) {
      let o = t.match(/curl:\s*\((\d+)\)/),
        s = o ? parseInt(o[1], 10) : null;
      s === 6 || /Could not resolve host/i.test(t)
        ? n.push(
            "HINT: Hostname could not be resolved. Check DNS or use an IP address directly.",
          )
        : s === 7 || /Failed to connect|Connection refused/i.test(t)
          ? n.push(
              "HINT: Service not running or port wrong. Check if the service is up and the port is correct.",
            )
          : s === 22 || /HTTP error/i.test(t)
            ? n.push(
                "HINT: HTTP 4xx/5xx response. The endpoint exists but returned an error status.",
              )
            : s === 28 || /timed out/i.test(t)
              ? n.push(
                  "HINT: Request timed out. The host may be unreachable or the service is slow.",
                )
              : (s === 35 || /SSL.*error/i.test(t)) &&
                n.push(
                  "HINT: SSL/TLS handshake failed. Try with --insecure to bypass, or check the certificate.",
                );
    }
    if (/remote port forwarding failed/i.test(t)) {
      let o = t.match(/port (\d+)/),
        s = o ? o[1] : "";
      n.push(
        `HINT: SSH remote port forwarding failed for port ${s}. The port may already be bound on the server. Check with: ssh server "ss -tuln | grep ${s}" and kill any lingering process with that port.`,
      );
    }
    return (
      /bind.*Cannot assign requested address|Address already in use/i.test(t) &&
        n.push(
          "HINT: Port is already in use. Find the process with: ss -tuln | grep <port> and kill it, then retry.",
        ),
      /Connection.*timed out|ssh.*timeout/i.test(t) &&
        /^ssh\b/.test(e) &&
        n.push(
          "HINT: SSH connection timed out. Check if the host is reachable: ping <host> and verify the port with: nc -zv <host> 22",
        ),
      /spawn \/bin\/sh ENOENT|spawn sh ENOENT/i.test(t) &&
        n.push(
          "HINT: The working directory was deleted during this session \u2014 bash cannot execute commands in a non-existent cwd. Previous rm/delete commands succeeded. Use list_directory or glob to verify the state instead of retrying bash.",
        ),
      /cp.*\$f.*\$f\.bak.*sed.*-i\.bak|sed.*-i\.bak.*cp.*\$f.*\$f\.bak/i.test(
        e,
      ) &&
        n.push(
          'HINT: Using both cp with .bak and sed -i.bak creates double backups (.bak.bak). Choose one method: either cp "$f" "$f.bak" OR sed -i.bak, not both.',
        ),
      n.length === 0
        ? t
        : t +
          `

` +
          n.join(`
`)
    );
  }
  function Cd(t, e, n) {
    let o = Ms(t, e);
    if (!o) return null;
    let s = Math.max(2, Math.ceil(e.length * 0.03));
    return o.distance > s
      ? null
      : {
          autoFixed: !0,
          matchText: o.text,
          content: t.split(o.text).join(n),
          distance: o.distance,
          line: o.line,
        };
  }
  var Ed = !1,
    bn = null;
  function Rw() {
    bn && (bn(), (bn = null));
  }
  var na = null;
  function Cw(t) {
    na = t;
  }
  async function ta() {
    if (!Ed) {
      Ed = !0;
      try {
        let { stdout: t } = await ve("git rev-parse --is-inside-work-tree", {
          cwd: process.cwd(),
          timeout: 5e3,
        });
        if (!(t.trim() === "true")) return;
        (await ve(
          'git stash push -m "nex-code-checkpoint" --include-untracked',
          { cwd: process.cwd(), timeout: 1e4 },
        ),
          await ve("git stash pop", { cwd: process.cwd(), timeout: 1e4 }),
          await ve("git tag -f nex-checkpoint", {
            cwd: process.cwd(),
            timeout: 5e3,
          }));
      } catch {}
    }
  }
  var Aw = [
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
  function lt(t) {
    let e = ke.isAbsolute(t) ? ke.resolve(t) : ke.resolve(process.cwd(), t);
    for (let n of Aw) if (n.test(e)) return null;
    return e;
  }
  var Ow = [
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
  function Ns(t, { server: e, context: n } = {}) {
    let o = e ? e.replace(/[^a-zA-Z0-9@._-]/g, "") : null,
      s = n ? n.replace(/[^a-zA-Z0-9._/-]/g, "") : null,
      r = "kubectl";
    if ((s && (r += ` --context ${s}`), (r += ` ${t}`), o)) {
      let i = r.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `ssh -o ConnectTimeout=10 -o BatchMode=yes ${o} "${i}"`;
    }
    return r;
  }
  async function Td(t, e, n = {}) {
    switch (t) {
      case "bash": {
        let o = e.command,
          s = uw(o);
        if (s) {
          let f = Tw(o);
          return `BLOCKED: Command matches forbidden pattern: ${s}${
            f
              ? `
HINT: ${f}`
              : ""
          }`;
        }
        let r = pw(o);
        if (r)
          return `BLOCKED: Destructive operation on protected path: ${r}
HINT: Protected files (.env, credentials, venv, .ssh, etc.) cannot be deleted or moved via bash. Override with NEX_UNPROTECT=1 if intentional.`;
        if (n.autoConfirm ? xd(o) : fw(o)) {
          let f = xd(o) ? "\u26D4" : "\u26A0";
          if (!(await Tt(`  ${f} bash: \`${o}\``, { toolName: "bash" })))
            return "CANCELLED: User declined to execute this command.";
        }
        let a;
        try {
          ((a = process.cwd()), _d.accessSync(a));
        } catch {
          ((a = require("os").homedir()),
            n.silent ||
              console.log(
                `${te.yellow}  \u26A0 Working directory no longer exists \u2014 running in ${a}${te.reset}`,
              ));
        }
        let l = Sw.test(o.trim()) && !Ew.test(o.trim());
        if (vw.test(o.trim()) || l) {
          n.silent ||
            console.log(`${te.dim}  \u25B6 interactive: ${o}${te.reset}`);
          let f = lw("sh", ["-c", o], { stdio: "inherit", cwd: a });
          return f.error
            ? `ERROR: ${f.error.message}`
            : f.status === 0
              ? "(interactive command completed successfully)"
              : `(interactive command exited with code ${f.status})`;
        }
        let { ToolProgress: u } = In(),
          d = n.silent ? null : new u("bash", o.substring(0, 40));
        d && d.start();
        try {
          let { stdout: f, stderr: m } = await ve(o, {
            cwd: a,
            timeout: 9e4,
            maxBuffer: 5242880,
          });
          return (d && d.stop(), f || m || "(no output)");
        } catch (f) {
          d && d.stop();
          let m = (f.stderr || f.stdout || f.message || "")
              .toString()
              .substring(0, 5e3),
            h = Rd(m, o);
          return `EXIT ${f.code || 1}
${h}`;
        }
      }
      case "read_file": {
        let o = lt(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        if (!(await ht(o))) {
          let b = await Qo(e.path);
          if (b.fixedPath)
            ((o = b.fixedPath),
              console.log(
                `${te.dim}  \u2713 auto-fixed path: ${e.path} \u2192 ${ke.relative(process.cwd(), o)}${te.reset}`,
              ));
          else
            return `ERROR: File not found: ${e.path}${
              b.message
                ? `
` + b.message
                : ""
            }`;
        }
        let r = Buffer.alloc(8192),
          i = await _d.promises.open(o, "r"),
          { bytesRead: a } = await i.read(r, 0, 8192, 0);
        await i.close();
        for (let b = 0; b < a; b++)
          if (r[b] === 0)
            return `ERROR: ${o} is a binary file (not readable as text)`;
        let l = await De.readFile(o, "utf-8");
        if (!l && (await De.stat(o)).size > 0)
          return `WARNING: ${o} is empty or unreadable`;
        let u = l.split(`
`),
          d = await De.stat(o),
          f = u.length,
          m = 350,
          h = !e.line_start && !e.line_end,
          p = h && f > m,
          g = (e.line_start || 1) - 1,
          y = p ? m : e.line_end || u.length,
          w = ke.relative(process.cwd(), o),
          k = p
            ? `showing lines 1-${m} of ${f}`
            : e.line_start || e.line_end
              ? `lines ${g + 1}-${y} of ${f}`
              : `${f} lines`,
          R = `File: ${w} (${k}, ${d.size} bytes)`,
          x = u.slice(g, y).map((b, O) => `${g + O + 1}: ${b}`).join(`
`),
          _ = p
            ? `

[File truncated: showing lines 1-${m} of ${f} total. Use line_start/line_end to read other sections, e.g. line_start=${m + 1} line_end=${Math.min(m * 2, f)}]`
            : !h && f > m
              ? `
[Large file (${f} lines total) \u2014 use line_start/line_end for other sections]`
              : "";
        return `${R}
${x}${_}`;
      }
      case "write_file": {
        await ta();
        let o = lt(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        let s = await ht(o),
          r = null;
        if (n.autoConfirm) s && (r = await De.readFile(o, "utf-8"));
        else if (s) {
          r = await De.readFile(o, "utf-8");
          let d = await Os(o, e.content);
          if (
            (Jo(o, r, e.content, { annotations: d }), !(await As("Overwrite")))
          )
            return "CANCELLED: User declined to overwrite file.";
        } else {
          let d = await Os(o, e.content);
          if ((mw(o, e.content, { annotations: d }), !(await As("Create"))))
            return "CANCELLED: User declined to create file.";
        }
        let i = ke.dirname(o);
        ((await ht(i)) || (await De.mkdir(i, { recursive: !0 })),
          await De.writeFile(o, e.content, "utf-8"));
        let l =
          /[/\\]\.git[/\\]hooks[/\\]/.test(o) ||
          o.endsWith(".sh") ||
          e.content.startsWith("#!");
        (l && (await De.chmod(o, 493)), Vo("write_file", o, r, e.content));
        let u = l ? " [chmod +x applied]" : "";
        return `Written: ${o} (${e.content.length} chars)${u}`;
      }
      case "edit_file": {
        await ta();
        let o = lt(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        if (!(await ht(o))) {
          let d = await Qo(e.path);
          if (d.fixedPath)
            ((o = d.fixedPath),
              console.log(
                `${te.dim}  \u2713 auto-fixed path: ${e.path} \u2192 ${ke.relative(process.cwd(), o)}${te.reset}`,
              ));
          else
            return `ERROR: File not found: ${e.path}${
              d.message
                ? `
` + d.message
                : ""
            }`;
        }
        let r = await De.readFile(o, "utf-8"),
          i = e.old_text,
          a = !1,
          l = !1;
        if (!r.includes(e.old_text)) {
          let { getActiveModelId: d, getActiveProviderName: f } = Oe();
          if (Sd(d(), f()) === "strict") {
            let p = Ms(r, e.old_text);
            return p
              ? `ERROR: old_text not found in ${o} (strict mode \u2014 exact match required)
Most similar text (line ${p.line}, distance ${p.distance}):
${p.text}`
              : `ERROR: old_text not found in ${o} (strict mode \u2014 exact match required)`;
          }
          let h = vd(r, e.old_text);
          if (h)
            ((i = h),
              (a = !0),
              console.log(
                `${te.dim}  \u2713 fuzzy whitespace match applied${te.reset}`,
              ));
          else {
            let p = Cd(r, e.old_text, e.new_text);
            if (p) {
              if (!n.autoConfirm) {
                let R = await Os(o, p.content);
                if (
                  (Jo(o, r, p.content, { annotations: R }),
                  !(await As(
                    `Apply (auto-fix, line ${p.line}, distance ${p.distance})`,
                  )))
                )
                  return "CANCELLED: User declined to apply edit.";
              }
              (await De.writeFile(o, p.content, "utf-8"),
                (/[/\\]\.git[/\\]hooks[/\\]/.test(o) ||
                  o.endsWith(".sh") ||
                  p.content.startsWith("#!")) &&
                  (await De.chmod(o, 493)),
                Vo("edit_file", o, r, p.content));
              let k =
                p.matchText.length > 80
                  ? p.matchText.substring(0, 77) + "..."
                  : p.matchText;
              return (
                console.log(
                  `${te.dim}  \u2713 auto-fixed edit: line ${p.line}, distance ${p.distance}${te.reset}`,
                ),
                `Edited: ${o} (auto-fixed, line ${p.line}, distance ${p.distance}, matched: "${k}")`
              );
            }
            let g = Ms(r, e.old_text);
            if (g) {
              let k = r.split(`
`),
                R = Math.max(0, g.line - 6),
                x = Math.min(k.length, g.line + 10),
                _ = k.slice(R, x).map((O, N) => `${R + N + 1}: ${O}`).join(`
`),
                b = `line_start=${Math.max(1, g.line - 5)} line_end=${Math.min(k.length, g.line + 15)}`;
              return `ERROR: old_text not found in ${o} (most similar at line ${g.line}, distance ${g.distance})

Actual file content around line ${g.line} \u2014 use this to correct old_text:
${_}

Fix: update old_text to match the exact lines above, then retry. If you need more context: read_file with ${b}`;
            }
            let y = (e.old_text || "")
                .trim()
                .split(
                  `
`,
                )[0]
                .slice(0, 60),
              w = y
                ? `
Recovery: grep -n "${y.replace(/"/g, '\\"')}" <file> to find the line, then re-read that section with line_start/line_end.`
                : `
Recovery: use grep -n to locate the text, then re-read that section with line_start/line_end.`;
            return `ERROR: old_text not found in ${o}${w}`;
          }
        }
        if (!n.autoConfirm) {
          let d = r.split(i).join(e.new_text),
            f = await Os(o, d);
          if (
            (Jo(o, r, d, { annotations: f }),
            !(await As(a ? "Apply (fuzzy match)" : "Apply")))
          )
            return "CANCELLED: User declined to apply edit.";
        }
        let u = r.split(i).join(e.new_text);
        return (
          await De.writeFile(o, u, "utf-8"),
          (/[/\\]\.git[/\\]hooks[/\\]/.test(o) ||
            o.endsWith(".sh") ||
            u.startsWith("#!")) &&
            (await De.chmod(o, 493)),
          Vo("edit_file", o, r, u),
          a ? `Edited: ${o} (fuzzy match)` : `Edited: ${o}`
        );
      }
      case "list_directory": {
        let o = lt(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        if (!(await ht(o))) {
          let u = e.path
              .replace(/\/+/g, "/")
              .replace(/^~\//, `${require("os").homedir()}/`),
            d = lt(u),
            f = await ht(d);
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
        let a = [],
          l = async (u, d, f) => {
            if (d > r) return;
            let m;
            try {
              m = await De.readdir(u, { withFileTypes: !0 });
            } catch {
              return;
            }
            m = m.filter(
              (h) => !h.name.startsWith(".") && h.name !== "node_modules",
            );
            for (let h of m) {
              if (i && !h.isDirectory() && !i.test(h.name)) continue;
              let p = h.isDirectory() ? "/" : "";
              (a.push(`${f}${h.name}${p}`),
                h.isDirectory() &&
                  (await l(ke.join(u, h.name), d + 1, f + "  ")));
            }
          };
        return (
          await l(o, 1, ""),
          a.join(`
`) || "(empty)"
        );
      }
      case "search_files": {
        let o = lt(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        let s = ["-rn", "--null", "-H"];
        (e.file_pattern && s.push(`--include=${e.file_pattern}`),
          s.push(e.pattern, o));
        try {
          let { stdout: r } = await Qi("grep", s, {
              cwd: process.cwd(),
              timeout: 3e4,
              maxBuffer: 2097152,
            }),
            i = r.split("\0"),
            a = [];
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
              for (let m of f) if ((a.push(`${u}:${m}`), a.length >= 50)) break;
            }
            if (a.length >= 50) break;
          }
          return (
            a.join(`
`) || "(no matches)"
          );
        } catch {
          return "(no matches)";
        }
      }
      case "glob": {
        let s = process.cwd(),
          r = e.path ? lt(e.path) : s,
          i = e.pattern,
          a = (N) => {
            let C = N.replace(/[.+^${}()|[\]\\]/g, "\\$&")
              .replace(/\*\*\//g, "(.*/)?")
              .replace(/\*\*/g, ".*")
              .replace(/\*/g, "[^/]*")
              .replace(/\?/g, ".");
            return new RegExp(`^${C}$`);
          },
          l = a(i),
          u = i.split("/").pop(),
          d = a(u),
          { ToolProgress: f } = In(),
          m = new f("glob", "Finding files...");
        m.start();
        let {
            getFileIndex: h,
            getIndexedCwd: p,
            refreshIndex: g,
            isIndexValid: y,
          } = Mi(),
          w = h(),
          k = p();
        y(r) || (await g(r), (w = h()));
        let R = w
          .filter((N) => l.test(N) || d.test(ke.basename(N)))
          .map((N) => ke.join(r, N));
        if (R.length === 0) return (m.stop(), "(no matches)");
        let x = await Promise.all(
          R.slice(0, 210).map(async (N) => {
            try {
              let C = await De.stat(N);
              return { path: N, mtime: C.mtimeMs };
            } catch {
              return { path: N, mtime: 0 };
            }
          }),
        );
        x.sort((N, C) => C.mtime - N.mtime);
        let _ = x.map((N) => N.path),
          b = R.length > 200,
          O = _.slice(0, 200).join(`
`);
        return (
          m.update({ count: R.length, detail: e.pattern }),
          m.stop(),
          b
            ? `${O}

\u26A0 Results truncated at 200. Use a more specific pattern.`
            : O
        );
      }
      case "grep": {
        let o = e.path ? lt(e.path) : process.cwd();
        if (e.staged) {
          let { getDiff: l } = tn(),
            u = await l(!0);
          if (!u.trim()) return "(no staged changes)";
          let d = new Set(),
            f = u.split(`
`);
          for (let y of f)
            if (y.startsWith("diff --git")) {
              let w = y.match(/diff --git a\/(.+) b\/(.+)/);
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
          let { ToolProgress: h } = In(),
            p = new h("grep", "Searching staged content...");
          p.start();
          let g = [];
          for (let y of d)
            try {
              let w = ke.join(process.cwd(), y);
              if (await ht(w)) {
                let k = [...m];
                k.push(e.pattern, w);
                let { stdout: R } = await Qi("grep", k, {
                  cwd: process.cwd(),
                  timeout: 3e4,
                  maxBuffer: 2 * 1024 * 1024,
                });
                if (
                  e.output_mode === "files_with_matches" ||
                  e.output_mode === "count"
                ) {
                  let x = R.trim()
                    .split(
                      `
`,
                    )
                    .filter((_) => _.trim());
                  g = g.concat(x);
                } else {
                  let x = R.split("\0");
                  for (let _ = 0; _ < x.length; _ += 2) {
                    let b = x[_ + 1];
                    if (b) {
                      let O = b
                        .split(
                          `
`,
                        )
                        .filter((N) => N.trim());
                      for (let N of O) g.push(`${y}:${N}`);
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
        let s = ["-rn", "-E", "--null", "-H"];
        (e.ignore_case && s.push("-i"),
          e.include && s.push(`--include=${e.include}`),
          e.type && s.push(`--include=*.${e.type}`));
        let r = 20;
        (e.context
          ? s.push("-C", String(Math.min(Number(e.context), r)))
          : (e.before_context &&
              s.push("-B", String(Math.min(Number(e.before_context), r))),
            e.after_context &&
              s.push("-A", String(Math.min(Number(e.after_context), r)))),
          e.output_mode === "files_with_matches"
            ? s.push("-l")
            : e.output_mode === "count" && s.push("-c"),
          s.push(
            "--exclude-dir=node_modules",
            "--exclude-dir=.git",
            "--exclude-dir=coverage",
          ),
          s.push(e.pattern, o));
        let { ToolProgress: i } = In(),
          a = new i("grep", "Searching...");
        a.start();
        try {
          let { stdout: l } = await Qi("grep", s, {
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
                let y = g
                  .split(
                    `
`,
                  )
                  .filter((w) => w.trim());
                for (let w of y) u.push(`${p}:${w}`);
              }
            }
          }
          let d = e.offset || 0,
            f =
              e.head_limit ||
              (e.output_mode === "files_with_matches" ? 200 : 100);
          return (
            (u = u.slice(d, d + f)),
            a.update({ count: u.length, detail: `in ${o}` }),
            a.stop(),
            u
              .join(
                `
`,
              )
              .trim() || "(no matches)"
          );
        } catch (l) {
          return (
            a.stop(),
            l.code === 2
              ? `ERROR: Invalid regex pattern: ${e.pattern}`
              : "(no matches)"
          );
        }
      }
      case "patch_file": {
        await ta();
        let o = lt(e.path);
        if (!o)
          return `ERROR: Access denied \u2014 path outside project: ${e.path}`;
        if (!(await ht(o))) {
          let w = await Qo(e.path);
          if (w.fixedPath)
            ((o = w.fixedPath),
              console.log(
                `${te.dim}  \u2713 auto-fixed path: ${e.path} \u2192 ${ke.relative(process.cwd(), o)}${te.reset}`,
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
        let i = await De.readFile(o, "utf-8"),
          { getActiveModelId: a, getActiveProviderName: l } = Oe(),
          u = Sd(a(), l()),
          d = [],
          f = !1,
          m = !1;
        for (let w = 0; w < r.length; w++) {
          let { old_text: k, new_text: R } = r[w];
          if (i.includes(k)) d.push({ old_text: k, new_text: R });
          else if (u === "strict") {
            let x = Ms(i, k);
            return x
              ? `ERROR: Patch ${w + 1} old_text not found in ${o} (strict mode \u2014 exact match required)
Most similar text (line ${x.line}, distance ${x.distance}):
${x.text}`
              : `ERROR: Patch ${w + 1} old_text not found in ${o} (strict mode \u2014 exact match required)`;
          } else {
            let x = vd(i, k);
            if (x) (d.push({ old_text: x, new_text: R }), (f = !0));
            else {
              let _ = Ms(i, k);
              if (_) {
                let b = Math.max(3, Math.ceil(k.length * 0.05));
                if (_.distance <= b)
                  (d.push({ old_text: _.text, new_text: R }), (m = !0));
                else
                  return `ERROR: Patch ${w + 1} old_text not found in ${o}
Most similar text (line ${_.line}, distance ${_.distance}):
${_.text}`;
              } else return `ERROR: Patch ${w + 1} old_text not found in ${o}`;
            }
          }
        }
        let h = i;
        for (let { old_text: w, new_text: k } of d) h = h.split(w).join(k);
        if (!n.autoConfirm) {
          let w = await Os(o, h);
          if (
            (Jo(o, i, h, { annotations: w }),
            !(await As(f ? "Apply patches (fuzzy match)" : "Apply patches")))
          )
            return "CANCELLED: User declined to apply patches.";
        }
        await De.writeFile(o, h, "utf-8");
        let p =
          /[/\\]\.git[/\\]hooks[/\\]/.test(o) ||
          o.endsWith(".sh") ||
          h.startsWith("#!");
        (p && (await De.chmod(o, 493)), Vo("patch_file", o, i, h));
        let g = m ? " (auto-fixed)" : f ? " (fuzzy match)" : "",
          y = p ? " [chmod +x applied]" : "";
        return `Patched: ${o} (${r.length} replacements)${g}${y}`;
      }
      case "web_fetch": {
        let o = e.url,
          s = e.max_length || 1e4;
        try {
          let r = await Zi.get(o, {
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
              .substring(0, s) || "(empty response)"
          );
        } catch (r) {
          return `ERROR: Failed to fetch ${o}: ${r.message}`;
        }
      }
      case "web_search": {
        let o = e.max_results || 5;
        if (process.env.PERPLEXITY_API_KEY)
          try {
            let s = await Zi.post(
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
              r = s.data?.choices?.[0]?.message?.content || "",
              i = s.data?.citations || [],
              a = `[Perplexity grounded search]

${r}`;
            return (
              i.length > 0 &&
                (a +=
                  `

Sources:
` +
                  i.slice(0, o).map((l, u) => `${u + 1}. ${l}`).join(`
`)),
              a
            );
          } catch (s) {
            console.error(
              `${te.dim}  Perplexity search failed (${s.message}), falling back to DuckDuckGo${te.reset}`,
            );
          }
        try {
          let r = (
              await Zi.get("https://html.duckduckgo.com/html/", {
                params: { q: e.query },
                timeout: 1e4,
                responseType: "text",
                headers: { "User-Agent": "nex-code/0.2.0" },
              })
            ).data,
            i = [],
            a =
              /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
            l;
          for (; (l = a.exec(r)) !== null && i.length < o; ) {
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
        let { browserNavigate: o } = xs();
        try {
          let s = await o(e.url, { waitFor: e.wait_for }),
            r =
              s.links.length > 0
                ? `

Links:
` +
                  s.links.map((i) => `  ${i.text} \u2192 ${i.href}`).join(`
`)
                : "";
          return `Title: ${s.title}
URL: ${s.url}

${s.text}${r}`;
        } catch (s) {
          return `ERROR: ${s.message}`;
        }
      }
      case "browser_screenshot": {
        let { browserScreenshot: o } = xs();
        try {
          let s = await o(e.url, {
            width: e.width,
            height: e.height,
            fullPage: e.full_page,
          });
          return `Screenshot saved: ${s.path}
Title: ${s.title}
URL: ${s.url}

To analyze visually, paste the path into your next message: ${s.path}`;
        } catch (s) {
          return `ERROR: ${s.message}`;
        }
      }
      case "browser_click": {
        let { browserClick: o } = xs();
        try {
          return await o(e.url, { selector: e.selector, text: e.text });
        } catch (s) {
          return `ERROR: ${s.message}`;
        }
      }
      case "browser_fill": {
        let { browserFill: o } = xs();
        try {
          return await o(e.url, {
            selector: e.selector,
            value: e.value,
            submit: e.submit,
          });
        } catch (s) {
          return `ERROR: ${s.message}`;
        }
      }
      case "ask_user": {
        let { question: o, options: s = [] } = e;
        return na
          ? new Promise((r) => {
              ((bn = () => r("CANCELLED")),
                na(o, s).then((i) => {
                  ((bn = null), r(i || "User did not answer"));
                }));
            })
          : new Promise((r) => {
              let i = require("readline").createInterface({
                input: process.stdin,
                output: process.stdout,
              });
              bn = () => {
                (i.close(), r("CANCELLED"));
              };
              let a =
                s.length > 0
                  ? `
${s.map((l, u) => `  ${u + 1}. ${l}`).join(`
`)}
`
                  : "";
              (console.log(`
${te.cyan}${te.bold}  ? ${o}${te.reset}${a}`),
                i.question(`${te.cyan}  > ${te.reset}`, (l) => {
                  ((bn = null), i.close(), r(l.trim() || "(no response)"));
                }));
            });
      }
      case "git_status": {
        if (!(await ea())) return "ERROR: Not a git repository";
        let o = (await kd()) || "(detached)",
          s = await $w();
        if (s.length === 0)
          return `Branch: ${o}
Clean working tree (no changes)`;
        let r = [`Branch: ${o}`, `Changed files (${s.length}):`];
        for (let i of s) {
          let a =
            i.status === "M"
              ? "modified"
              : i.status === "A"
                ? "added"
                : i.status === "D"
                  ? "deleted"
                  : i.status === "??"
                    ? "untracked"
                    : i.status;
          r.push(`  ${a}: ${i.file}`);
        }
        return r.join(`
`);
      }
      case "git_diff": {
        if (!(await ea())) return "ERROR: Not a git repository";
        let o;
        if (e.file) {
          let s = ["diff"];
          (e.staged && s.push("--cached"), s.push("--", e.file));
          try {
            o = execFileSync("git", s, {
              cwd: process.cwd(),
              encoding: "utf-8",
              timeout: 15e3,
              stdio: "pipe",
            }).trim();
          } catch {
            o = "";
          }
        } else o = await yw(!!e.staged);
        return o || "(no diff)";
      }
      case "git_log": {
        if (!(await ea())) return "ERROR: Not a git repository";
        let s = ["log", "--oneline", `-${Math.min(e.count || 10, 50)}`];
        e.file && s.push("--", e.file);
        try {
          return (
            execFileSync("git", s, {
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
            updateTask: s,
            getTaskList: r,
            renderTaskList: i,
            hasActiveTasks: a,
          } = Bo(),
          { getActiveTaskProgress: l } = Ae(),
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
              : s(e.task_id, e.status, e.result)
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
        let { executeSpawnAgents: o } = Yo();
        return o(e);
      }
      case "switch_model": {
        let {
          setActiveModel: o,
          getActiveProviderName: s,
          getActiveModelId: r,
        } = Oe();
        return o(e.model)
          ? `Switched to ${s()}:${r()}`
          : `ERROR: Unknown model: ${e.model}. Use /providers to see available models.`;
      }
      case "gh_run_list": {
        let o = Math.min(e.limit || 10, 30),
          s = [
            "run",
            "list",
            "--limit",
            String(o),
            "--json",
            "databaseId,status,conclusion,name,headBranch,createdAt,updatedAt,event",
          ];
        (e.workflow && s.push("--workflow", e.workflow),
          e.branch && s.push("--branch", e.branch),
          e.status && s.push("--status", e.status));
        try {
          let { stdout: r } = await ve(`gh ${s.join(" ")}`, {
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
            let { stdout: i } = await ve(`gh run view ${e.run_id} --log`, {
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
          let { stdout: o } = await ve(
              `gh run view ${e.run_id} --json status,conclusion,name,headBranch,createdAt,updatedAt,jobs`,
              { cwd: process.cwd(), timeout: 3e4 },
            ),
            s = JSON.parse(o),
            r = [
              `Run: ${s.name} [${e.run_id}]`,
              `Branch: ${s.headBranch}  Status: ${s.conclusion || s.status}`,
              `Started: ${s.createdAt}  Finished: ${s.updatedAt || "\u2014"}`,
              "",
              "Jobs:",
            ];
          for (let i of s.jobs || []) {
            let a =
              i.conclusion === "success"
                ? "\u2713"
                : i.conclusion === "failure"
                  ? "\u2717"
                  : "\u25CB";
            r.push(`  ${a} ${i.name} (${i.conclusion || i.status})`);
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
        let { confirm: o } = Xe(),
          s = e.branch || (await kd()) || "main",
          r = e.inputs
            ? Object.entries(e.inputs)
                .map(([l, u]) => `-f ${l}=${u}`)
                .join(" ")
            : "",
          i = `gh workflow run ${e.workflow} --ref ${s} ${r}`.trim();
        if (
          (console.log(`
${te.yellow}  \u26A0 Trigger workflow: ${e.workflow} on ${s}${te.reset}`),
          !(await o("  Trigger?")))
        )
          return "CANCELLED: User declined to trigger workflow.";
        try {
          return (
            await ve(i, { cwd: process.cwd(), timeout: 3e4 }),
            `Workflow "${e.workflow}" triggered on branch "${s}". Check status with gh_run_list.`
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
          s = e.label ? `-l ${e.label}` : "",
          r = Ns(`get pods ${o} ${s} -o wide`.trim(), e);
        try {
          let { stdout: i, stderr: a } = await ve(r, {
            timeout: 3e4,
            maxBuffer: 2097152,
          });
          return (i || a || "(no pods)").trim();
        } catch (i) {
          let a = (i.stderr || i.message || "").toString().split(`
`)[0];
          return a.includes("command not found")
            ? "ERROR: kubectl not found. Install kubectl or provide a server with kubectl."
            : `ERROR: ${a}`;
        }
      }
      case "k8s_logs": {
        if (!e.pod) return "ERROR: pod is required";
        let o = e.namespace || "default",
          s = e.tail || 100,
          r = `logs ${e.pod} -n ${o} --tail=${s}`;
        (e.since && (r += ` --since=${e.since}`),
          e.container && (r += ` -c ${e.container}`));
        let i = Ns(r, e);
        try {
          let { stdout: a, stderr: l } = await ve(i, {
              timeout: 6e4,
              maxBuffer: 5242880,
            }),
            u = (a || l || "(no logs)").trim();
          return (
            u.substring(0, 2e4) +
            (u.length > 2e4
              ? `
...(truncated)`
              : "")
          );
        } catch (a) {
          return `ERROR: ${
            (a.stderr || a.message || "").toString().split(`
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
          !(await Tt("  Execute in pod?")))
        )
          return "CANCELLED: User declined.";
        let r = `exec ${e.pod} -n ${o}`;
        (e.container && (r += ` -c ${e.container}`),
          (r += ` -- sh -c ${JSON.stringify(e.command)}`));
        let i = Ns(r, e);
        try {
          let { stdout: a, stderr: l } = await ve(i, {
            timeout: 6e4,
            maxBuffer: 2097152,
          });
          return (a || l || "(no output)").trim();
        } catch (a) {
          return `ERROR: ${
            (a.stderr || a.message || "").toString().split(`
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
            !(await Tt("  Apply to cluster?")))
          )
            return "CANCELLED: User declined.";
        }
        let s = `apply -f ${e.file}`;
        (e.namespace && (s += ` -n ${e.namespace}`),
          o && (s += " --dry-run=client"));
        let r = Ns(s, e);
        try {
          let { stdout: i, stderr: a } = await ve(r, {
            timeout: 12e4,
            maxBuffer: 2097152,
          });
          return (i || a || "(no output)").trim();
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
          let a =
            e.action === "restart" ? "Rolling restart" : "Rollback (undo)";
          if (
            (console.log(`
${te.yellow}  \u26A0 ${a}: deployment/${e.deployment} (ns: ${o})${te.reset}`),
            !(await Tt(`  ${a}?`)))
          )
            return "CANCELLED: User declined.";
        }
        let r = `rollout ${e.action} deployment/${e.deployment} -n ${o}`,
          i = Ns(r, e);
        try {
          let { stdout: a, stderr: l } = await ve(i, {
            timeout: 12e4,
            maxBuffer: 2097152,
          });
          return (a || l || "(no output)").trim();
        } catch (a) {
          return `ERROR: ${
            (a.stderr || a.message || "").toString().split(`
`)[0]
          }`;
        }
      }
      case "brain_write": {
        if (!e.name) return "ERROR: name is required";
        if (!e.content) return "ERROR: content is required";
        if (!e.mode) return "ERROR: mode is required (create, update, append)";
        let { writeDocument: o, readDocument: s } = Rs(),
          { name: r, content: i, mode: a } = e;
        if (a === "create" && s(r).content)
          return `ERROR: Document "${r}" already exists. Use mode "update" to overwrite.`;
        if (a === "append") {
          let l = s(r),
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
          `${a === "create" ? "Created" : "Updated"} brain document: ${r}.md`
        );
      }
      case "ssh_exec": {
        if (!e.server) return "ERROR: server is required";
        if (!e.command) return "ERROR: command is required";
        let o;
        try {
          o = kt(e.server);
        } catch (b) {
          return `ERROR: ${b.message}`;
        }
        let s = e.command,
          r = !!e.sudo,
          i = (e.timeout || 30) * 1e3,
          a = dw(s);
        if (a)
          return /\bsed\s+-n\s+['"]?\d+,\d+p/.test(s)
            ? `BLOCKED: sed -n line-range is blocked (floods context). To read specific lines from a remote file use:
  grep -n "pattern" /path/to/file -A 50
or to read the whole file:
  cat /path/to/file
NEVER use sed -n again \u2014 it will always be blocked.`
            : `BLOCKED: Remote command matches SSH secret-exposure pattern: ${a}
HINT: Do not read .env, credentials, or private key files via ssh_exec \u2014 secrets would appear in tool output. Reference variable names or file paths instead.`;
        if (
          ((s = s.replace(/(-[BAC])\s*(\d+)/g, (b, O, N) => {
            let C = Math.min(Number(N), 20);
            return `${O} ${C}`;
          })),
          (s = s.replace(
            /(--(?:before|after|context)=)(\d+)/g,
            (b, O, N) => O + Math.min(Number(N), 20),
          )),
          /\b(rm|rmdir|mv|cp|chmod|chown|dd|mkfs|systemctl\s+(start|stop|restart|reload|enable|disable)|dnf\s+(install|remove|update|upgrade)|yum\s+(install|remove)|apt(-get)?\s+(install|remove|purge)|pip\s+install|pip3\s+install|firewall-cmd\s+--permanent|semanage|setsebool|passwd|userdel|useradd|nginx\s+-s\s+(reload|stop)|service\s+\w+\s+(start|stop|restart))\b/.test(
            s,
          ))
        ) {
          let b = o.user ? `${o.user}@${o.host}` : o.host;
          if (
            (console.log(`
${te.yellow}  \u26A0 Remote command on ${b}: ${s}${te.reset}`),
            !(await Tt("  Execute on remote server?")))
          )
            return "CANCELLED: User declined to execute remote command.";
        }
        let {
            stdout: u,
            stderr: d,
            exitCode: f,
            error: m,
          } = await ct(o, s, { timeout: i, sudo: r }),
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
        let p = /\bgrep\b/.test(s),
          g = h;
        p &&
          (g = g
            .split(
              `
`,
            )
            .filter((b) => b !== "--").join(`
`));
        let y = p ? 100 : 200,
          w = g.split(`
`);
        w.length > y &&
          (g =
            `(${w.length - y} earlier lines omitted \u2014 showing last ${y})
` +
            w.slice(-y).join(`
`));
        let k = 4,
          R = g.split(`
`),
          x = [],
          _ = 0;
        for (; _ < R.length; ) {
          let b = _ + 1;
          for (; b < R.length && R[b] === R[_]; ) b++;
          let O = b - _;
          if ((x.push(R[_]), O > k))
            x.push(`... (${O - 1} identical lines omitted)`);
          else for (let N = 1; N < O; N++) x.push(R[_]);
          _ = b;
        }
        return (
          x.join(`
`) || "(command completed, no output)"
        );
      }
      case "ssh_upload": {
        if (!e.server || !e.local_path || !e.remote_path)
          return "ERROR: server, local_path, and remote_path are required";
        let o;
        try {
          o = kt(e.server);
        } catch (i) {
          return `ERROR: ${i.message}`;
        }
        let s = o.user ? `${o.user}@${o.host}` : o.host;
        if (
          (console.log(`
${te.yellow}  \u26A0 Upload: ${e.local_path} \u2192 ${s}:${e.remote_path}${te.reset}`),
          !(await Tt("  Upload to remote server?")))
        )
          return "CANCELLED: User declined upload.";
        try {
          return await bw(o, e.local_path, e.remote_path);
        } catch (i) {
          return `ERROR: ${i.message}`;
        }
      }
      case "ssh_download": {
        if (!e.server || !e.remote_path || !e.local_path)
          return "ERROR: server, remote_path, and local_path are required";
        let o;
        try {
          o = kt(e.server);
        } catch (s) {
          return `ERROR: ${s.message}`;
        }
        try {
          return await _w(o, e.remote_path, e.local_path);
        } catch (s) {
          return `ERROR: ${s.message}`;
        }
      }
      case "remote_agent": {
        let o = require("path").join(process.cwd(), ".nex", "servers.json"),
          s = null;
        try {
          s =
            JSON.parse(require("fs").readFileSync(o, "utf-8"))[e.server] ||
            null;
        } catch {}
        let r = s ? `${s.user || "root"}@${s.host}` : e.server,
          i = s?.key ? ["-i", s.key] : [],
          a = e.project_path || s?.home || "~",
          l = e.model || "",
          d = [
            "TMPFILE=$(mktemp /tmp/nexcode-XXXXXX.txt)",
            `echo "${Buffer.from(e.task).toString("base64")}" | base64 -d > "$TMPFILE"`,
            `cd "${a}" 2>/dev/null || true`,
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
        let s = !e.server || e.server === "local" || e.server === "localhost",
          r = e.action === "status",
          i = null;
        if (!s)
          try {
            i = kt(e.server);
          } catch (l) {
            return `ERROR: ${l.message}`;
          }
        if (!r) {
          let l = s ? "local machine" : i.user ? `${i.user}@${i.host}` : i.host;
          if (
            (console.log(`
${te.yellow}  \u26A0 Service: systemctl ${e.action} ${e.service} on ${l}${te.reset}`),
            !(await Tt("  Execute?")))
          )
            return "CANCELLED: User declined service action.";
        }
        let a = `systemctl ${e.action} ${e.service}`;
        if (s) {
          let u = e.action !== "status" ? `sudo ${a}` : a;
          try {
            let { stdout: d, stderr: f } = await ve(u, { timeout: 15e3 });
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
            } = await ct(i, a, { timeout: 15e3, sudo: !0 }),
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
          s = e.lines || 50,
          r = e.since ? `--since "${e.since}"` : "",
          i = e.follow ? "-f" : "",
          a = `journalctl -u ${e.service} -n ${s} ${r} ${i} --no-pager`
            .trim()
            .replace(/\s+/g, " ");
        if (o)
          try {
            let { stdout: p, stderr: g } = await ve(a, { timeout: 15e3 });
            return (p || g || "(no log output)").trim();
          } catch (p) {
            return `EXIT ${p.code || 1}
${(p.stderr || p.message || "").toString().trim()}`;
          }
        let l;
        try {
          l = kt(e.server);
        } catch (p) {
          return `ERROR: ${p.message}`;
        }
        let {
            stdout: u,
            stderr: d,
            exitCode: f,
            error: m,
          } = await ct(l, a, { timeout: 2e4 }),
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
            let { stdout: m, stderr: h } = await ve(r, { timeout: 1e4 });
            return (m || h || "(no containers)").trim();
          } catch (m) {
            return `EXIT ${m.code || 1}
${(m.stderr || m.message || "").toString().trim()}`;
          }
        let i;
        try {
          i = kt(e.server);
        } catch (m) {
          return `ERROR: ${m.message}`;
        }
        let {
            stdout: a,
            stderr: l,
            exitCode: u,
            error: d,
          } = await ct(i, r, { timeout: 15e3 }),
          f = [a, l]
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
          s = e.lines || 50,
          r = e.since ? `--since "${e.since}"` : "",
          i = `docker logs --tail ${s} ${r} ${e.container} 2>&1`
            .trim()
            .replace(/\s+/g, " ");
        if (o)
          try {
            let { stdout: h, stderr: p } = await ve(i, { timeout: 15e3 });
            return (h || p || "(no log output)").trim();
          } catch (h) {
            return `EXIT ${h.code || 1}
${(h.stderr || h.message || "").toString().trim()}`;
          }
        let a;
        try {
          a = kt(e.server);
        } catch (h) {
          return `ERROR: ${h.message}`;
        }
        let {
            stdout: l,
            stderr: u,
            exitCode: d,
            error: f,
          } = await ct(a, i, { timeout: 2e4 }),
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
          s =
            /^(cat|ls|echo|env|printenv|df|du|ps|id|whoami|uname|hostname|date|pwd|which|find\s|head\s|tail\s|grep\s|curl\s+-[A-Za-z]*G|curl\s+https?:\/\/[^\s]+$)/;
        if (!n.autoConfirm && !s.test(e.command.trim())) {
          let h = o ? "local" : e.server;
          if (
            (console.log(`
${te.yellow}  \u26A0 docker exec in ${e.container} on ${h}: ${e.command}${te.reset}`),
            !(await Tt("  Execute?")))
          )
            return "CANCELLED: User declined.";
        }
        let i = `docker exec ${e.container} sh -c ${JSON.stringify(e.command)}`;
        if (o)
          try {
            let { stdout: h, stderr: p } = await ve(i, { timeout: 3e4 });
            return (h || p || "(no output)").trim();
          } catch (h) {
            return `EXIT ${h.code || 1}
${(h.stderr || h.message || "").toString().trim()}`;
          }
        let a;
        try {
          a = kt(e.server);
        } catch (h) {
          return `ERROR: ${h.message}`;
        }
        let {
            stdout: l,
            stderr: u,
            exitCode: d,
            error: f,
          } = await ct(a, i, { timeout: 35e3 }),
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
        let s = !e.server || e.server === "local" || e.server === "localhost";
        if (!(e.action === "inspect") && !n.autoConfirm) {
          let p = s ? "local" : e.server;
          if (
            (console.log(`
${te.yellow}  \u26A0 docker ${e.action} ${e.container} on ${p}${te.reset}`),
            !(await Tt("  Execute?")))
          )
            return "CANCELLED: User declined.";
        }
        let i = e.action === "remove" ? "rm" : e.action,
          a =
            e.action === "inspect"
              ? `docker inspect ${e.container}`
              : `docker ${i} ${e.container}`;
        if (s)
          try {
            let { stdout: p, stderr: g } = await ve(a, { timeout: 3e4 });
            return (p || g || `docker ${e.action} ${e.container}: OK`).trim();
          } catch (p) {
            return `EXIT ${p.code || 1}
${(p.stderr || p.message || "").toString().trim()}`;
          }
        let l;
        try {
          l = kt(e.server);
        } catch (p) {
          return `ERROR: ${p.message}`;
        }
        let {
            stdout: u,
            stderr: d,
            exitCode: f,
            error: m,
          } = await ct(l, a, { timeout: 35e3 }),
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
            ((e = { ...xw(e.config), ...e }), delete e.config, delete e._name);
          } catch (d) {
            return `ERROR: ${d.message}`;
          }
        if (!e.server)
          return 'ERROR: server is required (or use config: "<name>")';
        if (!e.remote_path) return "ERROR: remote_path is required";
        let o = e.method || "rsync";
        if (o === "rsync" && !e.local_path)
          return "ERROR: local_path is required for rsync method";
        let s;
        try {
          s = kt(e.server);
        } catch (d) {
          return `ERROR: ${d.message}`;
        }
        let r = s.user ? `${s.user}@${s.host}` : s.host;
        if (!e.dry_run && !n.autoConfirm) {
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
            !(await Tt("  Proceed with deployment?")))
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
          } = await ct(s, d, { timeout: 12e4 });
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
          let d = s.key
              ? `-e "ssh -i ${s.key.replace(/^~/, require("os").homedir())}${s.port && Number(s.port) !== 22 ? ` -p ${s.port}` : ""}"`
              : s.port && Number(s.port) !== 22
                ? `-e "ssh -p ${s.port}"`
                : "",
            f = (e.exclude || []).map((g) => `--exclude="${g}"`).join(" "),
            m = e.dry_run ? "--dry-run" : "",
            h = e.local_path.endsWith("/") ? e.local_path : `${e.local_path}/`,
            p = `rsync -avz --delete ${m} ${f} ${d} ${h} ${r}:${e.remote_path}`
              .trim()
              .replace(/\s+/g, " ");
          try {
            let { stdout: g, stderr: y } = await ve(p, { timeout: 12e4 });
            i = (g || y || "").trim();
          } catch (g) {
            return `ERROR (rsync): ${(g.stderr || g.message || "").toString().trim()}`;
          }
          if (e.dry_run)
            return `DRY RUN [rsync]:
${i || "(nothing to sync)"}`;
        }
        let a = "";
        if (e.deploy_script) {
          let {
              stdout: d,
              stderr: f,
              exitCode: m,
              error: h,
            } = await ct(s, e.deploy_script, { timeout: 12e4 }),
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
          a = `

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
                  (o === "git" ? "git pull OK" : "rsync OK") + i + a + l
                );
            } catch (m) {
              return (
                (l = `

Health check FAILED: ${d} \u2192 ${m.message}`),
                (o === "git" ? "git pull OK" : "rsync OK") + i + a + l
              );
            }
          else {
            let {
                stdout: m,
                stderr: h,
                exitCode: p,
              } = await ct(s, d, { timeout: 15e3 }),
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
                (o === "git" ? "git pull OK" : "rsync OK") + i + a + l
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
${i}${a}${l}`.trim();
      }
      case "deployment_status": {
        let o = kw(),
          s = e.config ? [e.config] : Object.keys(o);
        if (s.length === 0)
          return "No deploy configs found. Create .nex/deploy.json to configure deployments.";
        let r = [];
        for (let i of s) {
          let a = o[i];
          if (!a) {
            r.push(`${i}: NOT FOUND`);
            continue;
          }
          try {
            let l = kt(a.server || i),
              d =
                (await ct(l, "echo OK", { timeout: 1e4 })).stdout.trim() ===
                "OK",
              f = "unknown";
            if (d && a.deploy_script) {
              let h = a.deploy_script.match(/systemctl\s+\w+\s+(\S+)/);
              if (h)
                try {
                  f = (
                    await ct(l, `systemctl is-active ${h[1]}`, { timeout: 1e4 })
                  ).stdout.trim();
                } catch {
                  f = "inactive";
                }
            }
            let m = "N/A";
            if (a.health_check) {
              let h = a.health_check.trim();
              if (/^https?:\/\//.test(h))
                try {
                  let p = require("node-fetch"),
                    g = await Promise.race([
                      p(h),
                      new Promise((y, w) =>
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
                    (await ct(l, h, { timeout: 1e4 })).exitCode === 0
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
          s = (e.type || "").toLowerCase(),
          r = [],
          i = async (x, _ = 120) => {
            try {
              let b = ke.isAbsolute(x) ? x : ke.join(o, x),
                N = (await De.readFile(b, "utf8")).split(`
`),
                C = N.slice(0, _).join(`
`);
              return N.length > _
                ? C +
                    `
... (${N.length - _} more lines \u2014 use read_file for full content)`
                : C;
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
            .map((x) => `-not -path "*/${x}/*"`)
            .join(" "),
          u = async (x) => {
            try {
              let { stdout: _ } = await ve(
                `find "${o}" -type f -name "${x}" ${l} 2>/dev/null | head -10`,
                { timeout: 8e3 },
              );
              return _.trim()
                .split(
                  `
`,
                )
                .filter(Boolean);
            } catch {
              return [];
            }
          },
          d = async (x, _) => {
            try {
              let { stdout: b } = await ve(
                `grep -rl "${x}" "${o}" --include="${_}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build 2>/dev/null | head -5`,
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
          };
        r.push(`## STEP 1: Design Tokens
`);
        let f = [
          ...(await u("tailwind.config.js")),
          ...(await u("tailwind.config.ts")),
          ...(await u("tailwind.config.mjs")),
        ];
        if (f.length > 0) {
          let x = await i(f[0], 80);
          x &&
            r.push(`### Tailwind config (${ke.relative(o, f[0])})
\`\`\`js
${x}
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
        for (let x of m) {
          let _ = await u(x);
          for (let b of _) {
            let O = await i(b, 100);
            if (O && O.includes(":root")) {
              (r.push(`### CSS Variables (${ke.relative(o, b)})
\`\`\`css
${O}
\`\`\``),
                (h = !0));
              break;
            }
          }
          if (h) break;
        }
        if (!h) {
          let x = await d(":root", "*.css");
          if (x.length > 0) {
            let _ = await i(x[0], 100);
            (_ &&
              r.push(`### CSS Variables (${ke.relative(o, x[0])})
\`\`\`css
${_}
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
        for (let x of p) {
          let _ = await u(x);
          if (_.length > 0) {
            let b = await i(_[0], 150);
            if (b) {
              (r.push(`### Main layout: ${ke.relative(o, _[0])}
\`\`\`html
${b}
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
        let y = [];
        if (s) {
          for (let x of ["*.html", "*.vue", "*.jsx", "*.tsx"])
            if (((y = await d(s, x)), y.length > 0)) break;
        }
        if (y.length === 0)
          try {
            let { stdout: x } = await ve(
              `find "${o}" -type f \\( -name "*.html" -o -name "*.vue" -o -name "*.jsx" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" -not -name "base.html" -not -name "_base.html" -not -name "layout.html" -not -name "App.vue" -not -name "App.jsx" 2>/dev/null | head -20`,
              { timeout: 8e3 },
            );
            y = x
              .trim()
              .split(
                `
`,
              )
              .filter(Boolean);
          } catch {
            y = [];
          }
        if (y.length > 0) {
          let x = y[0],
            _ = await i(x, 150);
          _
            ? r.push(`### Reference: ${ke.relative(o, x)}
\`\`\`html
${_}
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
          k = await i(ke.join(o, "package.json"), 999);
        if (k) {
          if (
            ((k.includes('"react"') || k.includes("'react'")) &&
              w.push("React"),
            k.includes('"vue"') || k.includes("'vue'"))
          ) {
            let _ = k.match(/"vue":\s*"[\^~]?(\d+)/);
            w.push(_ ? `Vue.js v${_[1]}` : "Vue.js");
          }
          let x = k.match(/"alpinejs":\s*"[\^~]?(\d+)/);
          (x && w.push(`Alpine.js v${x[1]} (\u26A0 v2 vs v3 API differs!)`),
            (k.includes('"htmx') || k.includes("'htmx")) && w.push("HTMX"),
            k.includes('"tailwindcss"') && w.push("Tailwind CSS"),
            k.includes('"bootstrap"') && w.push("Bootstrap"));
        }
        if (
          (((await ht(ke.join(o, "manage.py"))) ||
            ((await i(ke.join(o, "requirements.txt"), 50)) || "").includes(
              "Django",
            )) &&
            w.push("Django (server-rendered templates)"),
          !w.some((x) => x.includes("Alpine")))
        ) {
          let x = await d("alpinejs", "*.html");
          if (x.length > 0) {
            let b = ((await i(x[0], 30)) || "").match(/alpinejs[@/]v?(\d)/);
            w.push(
              b
                ? `Alpine.js v${b[1]} (via CDN \u2014 \u26A0 v2 vs v3 API differs!)`
                : "Alpine.js (via CDN \u2014 check version!)",
            );
          }
        }
        return (
          w.some((x) => x.includes("HTMX")) ||
            ((await d("htmx", "*.html")).length > 0 &&
              w.push("HTMX (via CDN)")),
          w.length > 0
            ? (r.push(
                w.map((x) => `- ${x}`).join(`
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
          s;
        if (!o)
          try {
            s = kt(e.server);
          } catch (l) {
            return `ERROR: ${l.message}`;
          }
        let r = async (l, u = 3e4) => {
          if (o)
            try {
              let { stdout: d, stderr: f } = await ve(l, { timeout: u });
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
              } = await ct(s, l, { timeout: u }),
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
          !n.autoConfirm
        ) {
          let l = o ? "local" : e.server;
          if (!(await Tt(`sysadmin [${e.action}] on ${l} \u2014 proceed?`)))
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
        let { executePluginTool: o } = Oo(),
          s = await o(t, e, n);
        return s !== null ? s : `ERROR: Unknown tool: ${t}`;
      }
    }
  }
  async function Nw(t, e, n = {}) {
    let { emit: o } = Oo(),
      { logToolExecution: s } = Vi(),
      r = Date.now(),
      i = n.silent ? null : gw(t, e);
    if (!i) {
      let l = await Td(t, e, n);
      return (
        s({
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
    let a = new hw(i);
    a.start();
    try {
      let l = await Td(t, e, n);
      return (
        a.stop(),
        s({
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
        a.stop(),
        s({
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
  Ad.exports = {
    TOOL_DEFINITIONS: Ow,
    executeTool: Nw,
    resolvePath: lt,
    autoFixPath: Qo,
    autoFixEdit: Cd,
    enrichBashError: Rd,
    cancelPendingAskUser: Rw,
    setAskUserHandler: Cw,
    fileExists: ht,
  };
});
var Et = H((fv, Nd) => {
  Nd.exports = Od();
});
var oa = H((pv, Md) => {
  var { loadServerProfiles: Zo } = Kn(),
    sa = {
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
  function Mw() {
    let t = Zo();
    if (Object.keys(t).length === 0) return null;
    let n = ["## Remote Servers (.nex/servers.json)"];
    (n.push(""),
      n.push(
        "Available server profiles (use with ssh_exec, ssh_upload, ssh_download, service_manage, service_logs, container_list, container_logs, container_exec, container_manage, deploy):",
      ));
    for (let [s, r] of Object.entries(t)) {
      let i = r.user ? `${r.user}@${r.host}` : r.host,
        a = r.port && Number(r.port) !== 22 ? `:${r.port}` : "",
        l = r.os ? ` \u2014 OS: ${r.os}` : "",
        u = r.sudo ? ", sudo available" : "";
      n.push(`- **${s}**: ${i}${a}${l}${u}`);
    }
    let o = new Set();
    for (let s of Object.values(t)) s.os && sa[s.os] && o.add(s.os);
    if (o.size > 0) {
      n.push("");
      for (let s of o) {
        let r =
          {
            almalinux9: "AlmaLinux 9",
            almalinux8: "AlmaLinux 8",
            ubuntu: "Ubuntu",
            debian: "Debian",
            macos: "macOS",
          }[s] || s;
        n.push(`### ${r} Notes`);
        for (let i of sa[s]) n.push(`- ${i}`);
      }
    }
    return n.join(`
`);
  }
  function Pw(t) {
    let e = Zo();
    return Object.values(e).some((n) => n.os && n.os.startsWith(t));
  }
  function Iw() {
    return Object.keys(Zo());
  }
  function Lw() {
    let t = require("fs"),
      n = require("path").join(process.cwd(), "NEX.md"),
      o = "";
    try {
      o = t.readFileSync(n, "utf-8");
    } catch {}
    let s = Zo(),
      r = Object.keys(s);
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
      a = o.toLowerCase();
    if (!i.some((m) => a.includes(m))) return null;
    let u = r.map((m) => {
        let h = s[m],
          p = h.user ? `${h.user}@${h.host}` : h.host,
          g = h.port && Number(h.port) !== 22 ? `:${h.port}` : "";
        return `  - **${m}**: ${p}${g}${h.os ? ` (${h.os})` : ""}`;
      }).join(`
`),
      d = r.map((m) => s[m].log_path).filter(Boolean),
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
  Md.exports = {
    getServerContext: Mw,
    getDeploymentContextBlock: Lw,
    hasServerOS: Pw,
    getProfileNames: Iw,
    OS_HINTS: sa,
  };
});
var nr = H((mv, Ld) => {
  var Rt = require("fs").promises,
    Pd = require("fs"),
    et = require("path"),
    er = require("util").promisify(require("child_process").exec),
    { C: zn } = Ae(),
    { getMergeConflicts: Id } = tn(),
    { getServerContext: Dw } = oa(),
    jw = new Set([
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
  function qw(t) {
    try {
      return Pd.readFileSync(t, "utf-8")
        .split(
          `
`,
        )
        .map((n) => n.trim())
        .filter((n) => n && !n.startsWith("#") && !n.startsWith("!"))
        .map((n) => n.replace(/\/$/, ""));
    } catch {
      return [];
    }
  }
  function Fw(t, e) {
    for (let n of e)
      if (
        n === t ||
        (n.includes("*") &&
          new RegExp(
            "^" + n.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
          ).test(t))
      )
        return !0;
    return !1;
  }
  function Uw(
    t,
    { maxDepth: e = 3, maxFiles: n = 200, giPatterns: o = [] } = {},
  ) {
    let s = et.join(t, ".gitignore"),
      r = [...o, ...qw(s)],
      i = 0,
      a = [et.basename(t) + "/"];
    function l(u, d, f) {
      if (f > e || i >= n) return;
      let m;
      try {
        m = Pd.readdirSync(u, { withFileTypes: !0 });
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
            jw.has(p.name) ||
            (p.name.startsWith(".") && p.name !== ".env.example") ||
            Fw(p.name, r)
          ),
      );
      for (let p = 0; p < h.length; p++) {
        if (i >= n) {
          a.push(`${d}\u2514\u2500\u2500 \u2026 (truncated)`);
          break;
        }
        let g = h[p],
          y = p === h.length - 1,
          w = y ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ",
          k = d + (y ? "    " : "\u2502   "),
          R = g.isDirectory() ? g.name + "/" : g.name;
        (a.push(`${d}${w}${R}`),
          i++,
          g.isDirectory() && l(et.join(u, g.name), k, f + 1));
      }
    }
    return (
      l(t, "", 1),
      a.join(`
`)
    );
  }
  var ra = new Map(),
    Xn = new Map(),
    tr = null,
    Ww = 3e4;
  async function sn(t) {
    try {
      return await t();
    } catch {
      return null;
    }
  }
  async function Bw() {
    if (!tr || Date.now() > tr) return !1;
    let t = [
      et.join(process.cwd(), "package.json"),
      et.join(process.cwd(), "README.md"),
      et.join(process.cwd(), ".gitignore"),
    ];
    for (let e of t)
      try {
        let n = await Rt.stat(e),
          o = Xn.get(e);
        if (!o || n.mtimeMs !== o) return !1;
      } catch {
        if (Xn.has(e)) return !1;
      }
    try {
      let e = et.join(process.cwd(), ".git", "HEAD"),
        n = await Rt.stat(e),
        o = Xn.get(e);
      if (!o || n.mtimeMs !== o) return !1;
    } catch {}
    return !0;
  }
  async function Hw() {
    let t = [
      et.join(process.cwd(), "package.json"),
      et.join(process.cwd(), "README.md"),
      et.join(process.cwd(), ".gitignore"),
      et.join(process.cwd(), ".git", "HEAD"),
    ];
    for (let e of t)
      try {
        let n = await Rt.stat(e);
        Xn.set(e, n.mtimeMs);
      } catch {
        Xn.delete(e);
      }
  }
  async function Gw(t) {
    let e = "fileContext",
      n = ra.get(e),
      o = !1;
    if ((n && (await Bw()) && (o = !0), !o)) {
      let u = [],
        d = et.join(t, "package.json");
      if (
        await sn(() =>
          Rt.access(d)
            .then(() => !0)
            .catch(() => !1),
        )
      )
        try {
          let y = await Rt.readFile(d, "utf-8"),
            w = JSON.parse(y),
            k = { name: w.name, version: w.version };
          (w.scripts && (k.scripts = Object.keys(w.scripts).slice(0, 15)),
            w.dependencies && (k.deps = Object.keys(w.dependencies).length),
            w.devDependencies &&
              (k.devDeps = Object.keys(w.devDependencies).length),
            u.push(`PACKAGE: ${JSON.stringify(k)}`));
        } catch {}
      let m = et.join(t, "README.md");
      if (
        await sn(() =>
          Rt.access(m)
            .then(() => !0)
            .catch(() => !1),
        )
      ) {
        let w = (await Rt.readFile(m, "utf-8"))
          .split(
            `
`,
          )
          .slice(0, 50);
        u.push(`README (first 50 lines):
${w.join(`
`)}`);
      }
      let p = et.join(t, ".gitignore");
      if (
        await sn(() =>
          Rt.access(p)
            .then(() => !0)
            .catch(() => !1),
        )
      ) {
        let y = await Rt.readFile(p, "utf-8");
        u.push(`GITIGNORE:
${y.trim()}`);
      }
      ((n = u.join(`

`)),
        ra.set(e, n),
        (tr = Date.now() + Ww),
        await Hw());
    }
    let s = [n],
      [r, i, a, l] = await Promise.all([
        sn(async () => {
          let { stdout: u } = await er("git branch --show-current", {
            cwd: t,
            timeout: 5e3,
          });
          return u.trim();
        }),
        sn(async () => {
          let { stdout: u } = await er("git status --short", {
            cwd: t,
            timeout: 5e3,
          });
          return u.trim();
        }),
        sn(async () => {
          let { stdout: u } = await er("git log --oneline -5", {
            cwd: t,
            timeout: 5e3,
          });
          return u.trim();
        }),
        Id(),
      ]);
    if (
      (r && s.push(`GIT BRANCH: ${r}`),
      i &&
        s.push(`GIT STATUS:
${i}`),
      a &&
        s.push(`RECENT COMMITS:
${a}`),
      l && l.length > 0)
    ) {
      let u = l.map((d) => `  ${d.file}`).join(`
`);
      s.push(`MERGE CONFLICTS (resolve before editing these files):
${u}`);
    }
    try {
      let u = Dw();
      u && s.push(u);
    } catch {}
    return s.join(`

`);
  }
  async function Kw(t) {
    let e = et.join(t, "package.json"),
      n = "";
    if (
      await sn(() =>
        Rt.access(e)
          .then(() => !0)
          .catch(() => !1),
      )
    )
      try {
        let i = await Rt.readFile(e, "utf-8"),
          a = JSON.parse(i);
        n = `${a.name || "?"} v${a.version || "?"}`;
      } catch {}
    let [s, r] = await Promise.all([
      sn(async () => {
        let { stdout: i } = await er("git branch --show-current", {
          cwd: t,
          timeout: 5e3,
        });
        return i.trim();
      }),
      Id(),
    ]);
    if (r && r.length > 0) {
      console.log(
        `${zn.red}  \u26A0 ${r.length} unresolved merge conflict(s):${zn.reset}`,
      );
      for (let i of r) console.log(`${zn.red}    ${i.file}${zn.reset}`);
      console.log(
        `${zn.yellow}  \u2192 Resolve conflicts before starting tasks${zn.reset}`,
      );
    }
    console.log();
  }
  Ld.exports = {
    gatherProjectContext: Gw,
    printContext: Kw,
    generateFileTree: Uw,
    _clearContextCache: () => {
      (ra.clear(), Xn.clear(), (tr = null));
    },
  };
});
var At = H((hv, qd) => {
  var Ct = require("fs"),
    sr = require("path"),
    { atomicWrite: Yw } = Zt();
  function Is() {
    return sr.join(process.cwd(), ".nex", "sessions");
  }
  function ia() {
    let t = Is();
    Ct.existsSync(t) || Ct.mkdirSync(t, { recursive: !0 });
  }
  function aa(t) {
    let e = t.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 100);
    return sr.join(Is(), `${e}.json`);
  }
  function ca(t, e, n = {}) {
    ia();
    let o = aa(t),
      s = {
        name: t,
        createdAt: n.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: e.length,
        model: n.model || null,
        provider: n.provider || null,
        messages: e,
      };
    return (Yw(o, JSON.stringify(s, null, 2)), { path: o, name: t });
  }
  function Dd(t) {
    let e = aa(t);
    if (!Ct.existsSync(e)) return null;
    try {
      return JSON.parse(Ct.readFileSync(e, "utf-8"));
    } catch {
      return null;
    }
  }
  function jd() {
    ia();
    let t = Is(),
      e = Ct.readdirSync(t).filter((o) => o.endsWith(".json")),
      n = [];
    for (let o of e)
      try {
        let s = JSON.parse(Ct.readFileSync(sr.join(t, o), "utf-8"));
        n.push({
          name: s.name || o.replace(".json", ""),
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          messageCount: s.messageCount || 0,
          model: s.model,
          provider: s.provider,
          score: s.score != null ? s.score : null,
          scoreGrade: s.scoreGrade || null,
        });
      } catch {}
    return n.sort((o, s) =>
      (s.updatedAt || "").localeCompare(o.updatedAt || ""),
    );
  }
  function zw(t) {
    let e = aa(t);
    return Ct.existsSync(e) ? (Ct.unlinkSync(e), !0) : !1;
  }
  function Xw() {
    let t = jd();
    return t.length === 0 ? null : Dd(t[0].name);
  }
  var _n = null,
    Kt = null,
    Ps = null;
  function Jw(t, e = {}) {
    t.length !== 0 &&
      (_n && clearTimeout(_n),
      (Kt = t),
      (Ps = e || {}),
      (_n = setTimeout(() => {
        (Kt && Kt.length > 0 && ca("_autosave", Kt, Ps),
          (_n = null),
          (Kt = null),
          (Ps = null));
      }, 5e3)));
  }
  function Vw() {
    (_n && (clearTimeout(_n), (_n = null)),
      Kt &&
        Kt.length > 0 &&
        (ca("_autosave", Kt, Ps), (Kt = null), (Ps = null)));
  }
  function Qw() {
    ia();
    let t = Is(),
      e = Ct.readdirSync(t).filter((r) => r.endsWith(".json")),
      n = new Date(),
      o = new Date(n.getTime() - 720 * 60 * 60 * 1e3),
      s = 0;
    for (let r of e) {
      let i = sr.join(t, r);
      try {
        let a = Ct.statSync(i);
        new Date(a.mtime) < o && (Ct.unlinkSync(i), s++);
      } catch {}
    }
    return s;
  }
  qd.exports = {
    saveSession: ca,
    loadSession: Dd,
    listSessions: jd,
    deleteSession: zw,
    getLastSession: Xw,
    autoSave: Jw,
    flushAutoSave: Vw,
    clearOldSessions: Qw,
    _getSessionsDir: Is,
  };
});
var or = H((gv, Yd) => {
  "use strict";
  var Ls = require("fs"),
    Fd = require("path");
  function Ud(t) {
    let e = [];
    return (
      t.forEach((n, o) => {
        n.role === "assistant" &&
          (Array.isArray(n.content) &&
            n.content.forEach((s) => {
              s &&
                s.type === "tool_use" &&
                e.push({ name: s.name || "", input: s.input || {}, index: o });
            }),
          Array.isArray(n.tool_calls) &&
            n.tool_calls.forEach((s) => {
              let r = s.function?.name || s.name || "",
                i = {};
              try {
                i =
                  typeof s.function?.arguments == "string"
                    ? JSON.parse(s.function.arguments)
                    : s.function?.arguments || s.input || {};
              } catch {}
              e.push({ name: r, input: i, index: o });
            }));
      }),
      e
    );
  }
  function Wd(t) {
    let e = [];
    return (
      t.forEach((n, o) => {
        if (
          (n.role === "user" &&
            Array.isArray(n.content) &&
            n.content.forEach((s) => {
              if (s && s.type === "tool_result") {
                let r =
                  typeof s.content == "string"
                    ? s.content
                    : Array.isArray(s.content)
                      ? s.content
                          .map((i) => (typeof i == "string" ? i : i.text || ""))
                          .join("")
                      : JSON.stringify(s.content || "");
                e.push({ content: r, index: o });
              }
            }),
          n.role === "tool")
        ) {
          let s =
            typeof n.content == "string"
              ? n.content
              : JSON.stringify(n.content || "");
          e.push({ content: s, index: o });
        }
      }),
      e
    );
  }
  function Bd(t) {
    for (let e = t.length - 1; e >= 0; e--) {
      let n = t[e];
      if (n.role === "assistant") {
        if (typeof n.content == "string") return n.content.trim();
        if (Array.isArray(n.content)) {
          let o = n.content
            .filter((s) => s && (s.type === "text" || typeof s == "string"))
            .map((s) => (typeof s == "string" ? s : s.text || ""))
            .join("")
            .trim();
          if (o) return o;
        }
      }
    }
    return "";
  }
  function Hd(t, e) {
    let n = [];
    for (let o = t.length - 1; o >= 0 && n.length < e; o--) {
      let s = t[o];
      if (s.role !== "assistant") continue;
      let r = "";
      (typeof s.content == "string"
        ? (r = s.content.trim())
        : Array.isArray(s.content) &&
          (r = s.content
            .filter((i) => i && (i.type === "text" || typeof i == "string"))
            .map((i) => (typeof i == "string" ? i : i.text || ""))
            .join("")
            .trim()),
        r && n.push(r));
    }
    return n;
  }
  function Gd(t) {
    let e = new Map();
    for (let n of t) {
      let o;
      try {
        o = JSON.stringify(n.input);
      } catch {
        o = String(n.input);
      }
      let s = `${n.name}|${o}`;
      e.set(s, (e.get(s) || 0) + 1);
    }
    return e;
  }
  function Kd(t) {
    if (!Array.isArray(t) || t.length === 0)
      return {
        score: 0,
        issues: ["Empty or invalid session \u2014 no messages to analyse"],
        summary: "No messages found",
      };
    let e = 10,
      n = [],
      o = Ud(t),
      s = Wd(t),
      r = o.length;
    t.some(
      (E) =>
        E.role === "user" &&
        typeof E.content == "string" &&
        E.content.startsWith("[SYSTEM WARNING]") &&
        (E.content.includes("edited") ||
          E.content.includes("bash command") ||
          E.content.includes("grep pattern") ||
          E.content.includes("re-read") ||
          E.content.includes("already in your context")),
    ) &&
      ((e -= 2),
      n.push(
        "Loop-warning was fired during session (repeated file edits, bash commands, or re-reads)",
      ));
    let a = o.find((E) => {
      let M = E.input?.command || E.input?.cmd || "";
      return /\bsed\s+-n\b/.test(M);
    });
    if (a) {
      let E = (a.input?.command || a.input?.cmd || "").slice(0, 80);
      ((e -= 1.5), n.push(`sed -n anti-pattern used: ${E}`));
    }
    o.find((E) => {
      if (E.name !== "grep" && E.name !== "bash" && E.name !== "ssh_exec")
        return !1;
      let M = E.input?.command || E.input?.cmd || "",
        U = E.input?.pattern || "",
        G = `${M} ${U}`;
      return (
        /(?:-[CAB]|--context|--after|--before)\s*[=\s]?([2-9][1-9]|\d{3,})/.test(
          G,
        ) || /grep.*-[CAB]\s*([2-9][1-9]|\d{3,})/.test(G)
      );
    }) &&
      ((e -= 1),
      n.push("grep used with >20 context lines (context flood risk)"));
    let u = t.some((E) => E.role === "assistant"),
      d = Bd(t),
      m = Hd(t, 3).some((E) => E.length > 100 && !/^[^.!]{0,40}\?$/.test(E));
    if (u && !m && (d.length < 80 || /^[^.!]{0,40}\?$/.test(d))) {
      e -= 2;
      let E =
        d.length > 0 ? `"${d.slice(0, 60)}..."` : "(no assistant text found)";
      n.push(
        `Session ends without diagnosis \u2014 last response too short or is only a question: ${E}`,
      );
    }
    (r > 40
      ? ((e -= 1.5), n.push(`Excessive tool calls: ${r} (>40 threshold)`))
      : r > 25 &&
        ((e -= 0.5), n.push(`High tool call count: ${r} (>25 threshold)`)),
      t.some((E) => {
        let M =
          typeof E.content == "string"
            ? E.content
            : Array.isArray(E.content)
              ? E.content
                  .map((U) => (typeof U == "string" ? U : U.text || ""))
                  .join("")
              : "";
        return /\[auto-compressed|context compacted|force-compressed/.test(M);
      }) &&
        ((e -= 0.5),
        n.push("Auto-compress triggered (context flood indicator)")));
    let g = Gd(o),
      y = 0,
      w = "";
    for (let [E, M] of g) M > y && ((y = M), (w = E));
    if (y >= 3) {
      let [E] = w.split("|");
      ((e -= 1), n.push(`Same tool call repeated ${y}\xD7 (tool: ${E})`));
    }
    let k = !1;
    for (let E of s)
      if (
        E.content &&
        E.content.includes('"valid":true') &&
        o.filter((U) => U.index > E.index).length > 0
      ) {
        k = !0;
        break;
      }
    k &&
      ((e -= 1.5),
      n.push(
        'Stop-trigger ignored: tool result contained "valid":true but session continued with more tool calls',
      ));
    let R = o.filter((E) => E.name === "ssh_exec");
    if (R.length >= 8) {
      let E = 0,
        M = 1;
      for (let U = 1; U < R.length; U++)
        R[U].index <= R[U - 1].index + 2
          ? M++
          : ((E = Math.max(E, M)), (M = 1));
      ((E = Math.max(E, M)),
        E >= 8 &&
          ((e -= 0.5),
          n.push(`SSH reconnect storm: ${E} consecutive SSH calls`)));
    }
    let x = new Map();
    for (let E of o)
      if (E.name === "read_file" && E.input?.path) {
        let M = E.input.path;
        x.has(M) || x.set(M, { count: 0, ranges: [] });
        let U = x.get(M);
        if ((U.count++, E.input.line_start != null)) {
          let G = E.input.line_start || 1,
            ne = E.input.line_end || G + 350;
          U.ranges.push([G, ne]);
        }
      }
    function _(E, M, U) {
      for (let [G, ne] of U) {
        let I = Math.max(E, G),
          W = Math.min(M, ne);
        if (W > I) {
          let se = W - I,
            X = M - E || 1;
          if (se / X >= 0.7) return !0;
        }
      }
      return !1;
    }
    let b = 0,
      O = "";
    for (let [E, M] of x) {
      if (M.count < 3) continue;
      if (M.ranges.length === M.count) {
        let G = !1,
          ne = [];
        for (let [I, W] of M.ranges) {
          if (ne.length > 0 && _(I, W, ne)) {
            G = !0;
            break;
          }
          ne.push([I, W]);
        }
        if (!G) continue;
      }
      M.count > b && ((b = M.count), (O = E));
    }
    if (b >= 3) {
      e -= 1;
      let E = O.split("/").slice(-2).join("/");
      n.push(`read_file loop: "${E}" read ${b}\xD7 (file already in context)`);
    }
    let N = 0,
      C = "";
    for (let [E, M] of x) {
      if (M.ranges.length < 4) continue;
      let U = [],
        G = !1;
      for (let [ne, I] of M.ranges) {
        if (U.length > 0 && _(ne, I, U)) {
          G = !0;
          break;
        }
        U.push([ne, I]);
      }
      !G && M.ranges.length > N && ((N = M.ranges.length), (C = E));
    }
    if (N >= 4) {
      e -= 0.5;
      let E = C.split("/").slice(-2).join("/");
      n.push(
        `File-scroll pattern: "${E}" read in ${N} sequential sections \u2014 use grep instead`,
      );
    }
    let L = new Map();
    for (let E of o)
      if (E.name === "grep" && E.input?.path && E.input?.pattern) {
        let M = E.input.path;
        (L.has(M) || L.set(M, new Set()), L.get(M).add(E.input.pattern));
      }
    let Ee = 0,
      me = "";
    for (let [E, M] of L) M.size > Ee && ((Ee = M.size), (me = E));
    if (Ee >= 3) {
      e -= 0.75;
      let E = me.split("/").slice(-2).join("/");
      n.push(
        `grep flood on single file: "${E}" searched ${Ee}\xD7 with different patterns (file already in context)`,
      );
    }
    {
      let E = new Set(),
        M = new Set(),
        U = /^(test_|demo_|temp_|tmp_|scratch_)/;
      for (let ne of o) {
        if (ne.name === "write_file" && ne.input?.path) {
          let I = ne.input.path.split("/").pop(),
            W = ne.input.path.includes("/tests/");
          U.test(I) && !W && E.add(ne.input.path);
        }
        if (
          (ne.name === "bash" || ne.name === "ssh_exec") &&
          ne.input?.command
        ) {
          let I = ne.input.command.match(/\brm\s+(?:-\w+\s+)?(\S+)/g);
          if (I)
            for (let W of I) {
              let se = W.split(/\s+/),
                X = se[se.length - 1];
              for (let Z of E)
                (Z.endsWith(X) || X.endsWith(Z.split("/").pop())) && M.add(Z);
            }
        }
      }
      let G = M.size;
      if (G >= 1) {
        let ne = Math.min(G * 0.25, 0.5);
        e -= ne;
        let I = [...M].map((W) => W.split("/").pop()).join(", ");
        n.push(
          `Temp file write-then-delete: ${I} \u2014 write inline logic or use tests/ instead`,
        );
      }
    }
    let le = s.filter((E) => E.content.startsWith("EXIT")).length;
    le >= 10
      ? ((e -= 1),
        n.push(
          `Bash exit-error storm: ${le} tool results started with EXIT (repeated failing commands)`,
        ))
      : le >= 5 &&
        ((e -= 0.5),
        n.push(
          `Repeated bash errors: ${le} tool results with non-zero exit code`,
        ));
    for (let E of t) {
      if (E.role !== "assistant") continue;
      let M = "";
      if (
        (typeof E.content == "string"
          ? (M = E.content)
          : Array.isArray(E.content) &&
            (M = E.content
              .filter((X) => X && (X.type === "text" || typeof X == "string"))
              .map((X) => (typeof X == "string" ? X : X.text || ""))
              .join("")),
        M.length <= 5e3)
      )
        continue;
      let U = M.split(/(?<=\. )/).filter((X) => X.trim().length > 0);
      if (U.length < 6) continue;
      let G = new Map();
      for (let X = 0; X <= U.length - 3; X++) {
        let Z = U.slice(X, X + 3)
          .join("")
          .trim();
        Z.length > 30 && G.set(Z, (G.get(Z) || 0) + 1);
      }
      let ne = 0,
        I = "";
      for (let [X, Z] of G) Z > ne && ((ne = Z), (I = X));
      if (ne < 3) continue;
      let se = (I.length * ne) / M.length;
      if (se >= 0.4 || ne >= 10) {
        ((e -= 1.5),
          n.push(
            `llm output loop: assistant message repeated content detected (${ne}\xD7 same paragraph, ${Math.round(se * 100)}% repeated)`,
          ));
        break;
      }
    }
    {
      let E = new Set([
          "read_file",
          "list_directory",
          "search_files",
          "glob",
          "grep",
        ]),
        M = t.some((G) =>
          Array.isArray(G.tool_calls)
            ? G.tool_calls.some((ne) => E.has(ne.function?.name))
            : Array.isArray(G.content)
              ? G.content.some((ne) => ne.type === "tool_use" && E.has(ne.name))
              : !1,
        );
      t.some(
        (G) =>
          G.role === "assistant" &&
          typeof G.content == "string" &&
          (G.content.includes("## Steps") ||
            G.content.includes("/plan approve")),
      ) &&
        !M &&
        ((e -= 2),
        n.push(
          "plan written without reading any files \u2014 LLM invented data structures from training knowledge (hallucination risk)",
        ));
    }
    let ie = s.filter((E) => E.content.startsWith("BLOCKED:"));
    if (ie.length > 0) {
      let E = Math.min(ie.length * 0.5, 1.5);
      ((e -= E),
        n.push(
          `${ie.length} tool call${ie.length === 1 ? "" : "s"} blocked (agent attempted denied actions)`,
        ));
    }
    let oe = t.filter((E) => {
      let M = typeof E.content == "string" ? E.content : "";
      return /\[SYSTEM WARNING\] Context wiped \d+×/.test(M);
    }).length;
    if (oe > 0) {
      let E = Math.min(oe * 1, 2);
      ((e -= E),
        n.push(
          `Super-nuclear context wipe fired ${oe}\xD7 (context collapse \u2014 task too large or read loops)`,
        ));
    }
    {
      let E = !1,
        M = !1,
        U = !1;
      for (let ne of o) {
        if (ne.name !== "bash") continue;
        let I = (ne.input?.command || ne.input?.cmd || "").trim();
        (!(/cat\s*>/.test(I) || /<</.test(I)) &&
          /\bcat\s+\S/.test(I) &&
          (E = !0),
          /^\s*ls(\s|$)/.test(I) &&
            !/npm|yarn|pnpm|make|git\b/.test(I) &&
            (M = !0),
          /\bfind\s+\S/.test(I) && !/git\b|npm\b|-exec\b/.test(I) && (U = !0));
      }
      let G = [E, M, U].filter(Boolean).length;
      if (G > 0) {
        let ne = Math.min(G * 0.25, 0.75);
        e -= ne;
        let I = [];
        (E && I.push("cat (use read_file)"),
          M && I.push("ls (use list_directory)"),
          U && I.push("find (use glob)"),
          n.push(`bash used instead of dedicated tool: ${I.join(", ")}`));
      }
    }
    ((e = Math.max(0, Math.min(10, e))), (e = Math.round(e * 10) / 10));
    let ce = e >= 9 ? "A" : e >= 8 ? "B" : e >= 7 ? "C" : e >= 6 ? "D" : "F",
      Q =
        n.length === 0
          ? `Clean session \u2014 no quality issues detected (${r} tool calls)`
          : `${n.length} issue${n.length === 1 ? "" : "s"} found \u2014 ${r} tool calls`;
    return { score: e, grade: ce, issues: n, summary: Q };
  }
  function Zw(t) {
    try {
      let { loadSession: e } = At(),
        n = e(t);
      return n ? Kd(n.messages || []) : null;
    } catch {
      return null;
    }
  }
  function e0(t, e = null) {
    let { score: n, grade: o, issues: s, summary: r } = t,
      i = e?.dim || "",
      a = e?.reset || "",
      l = e?.green || "",
      u = e?.yellow || "",
      d = e?.red || "",
      f = e?.cyan || "",
      m = e?.bold || "",
      h = n >= 8 ? l : n >= 6 ? u : d,
      p = `
${i}  Session score: ${a}${m}${h}${n}/10 (${o})${a}`;
    if ((r && (p += `  ${i}${r}${a}`), s.length > 0))
      for (let g of s)
        p += `
  ${u}\u26A0${a} ${i}${g}${a}`;
    return p;
  }
  function t0(t, e = {}) {
    try {
      let n = Fd.join(process.cwd(), ".nex");
      Ls.existsSync(n) || Ls.mkdirSync(n, { recursive: !0 });
      let o = Fd.join(n, "benchmark-history.json"),
        s = [];
      if (Ls.existsSync(o))
        try {
          s = JSON.parse(Ls.readFileSync(o, "utf-8"));
        } catch {
          s = [];
        }
      Array.isArray(s) || (s = []);
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
      (s.push(i),
        s.length > 100 && (s = s.slice(s.length - 100)),
        Ls.writeFileSync(o, JSON.stringify(s, null, 2)));
    } catch {}
  }
  Yd.exports = {
    scoreMessages: Kd,
    scoreSession: Zw,
    formatScore: e0,
    appendScoreHistory: t0,
    _extractToolCalls: Ud,
    _extractToolResults: Wd,
    _getLastAssistantText: Bd,
    _getLastNAssistantTexts: Hd,
    _countDuplicateToolCalls: Gd,
  };
});
var rn = H(($v, ef) => {
  var on = require("fs"),
    rr = require("path"),
    n0 = require("os"),
    { atomicWrite: s0, withFileLockSync: zd } = Zt();
  function la() {
    return rr.join(process.cwd(), ".nex", "memory");
  }
  function Ds() {
    return rr.join(la(), "memory.json");
  }
  function o0() {
    return rr.join(process.cwd(), "NEX.md");
  }
  function Xd() {
    return rr.join(n0.homedir(), ".nex", "NEX.md");
  }
  function ua() {
    let t = la();
    on.existsSync(t) || on.mkdirSync(t, { recursive: !0 });
  }
  function ir() {
    let t = Ds();
    if (!on.existsSync(t)) return {};
    try {
      return JSON.parse(on.readFileSync(t, "utf-8"));
    } catch {
      return {};
    }
  }
  function Jd(t) {
    (ua(), s0(Ds(), JSON.stringify(t, null, 2)));
  }
  function r0(t, e) {
    (ua(),
      zd(Ds(), () => {
        let n = ir();
        ((n[t] = { value: e, updatedAt: new Date().toISOString() }), Jd(n));
      }));
  }
  function i0(t) {
    let e = ir();
    return e[t] ? e[t].value : null;
  }
  function a0(t) {
    return (
      ua(),
      zd(Ds(), () => {
        let e = ir();
        return t in e ? (delete e[t], Jd(e), !0) : !1;
      })
    );
  }
  function Vd() {
    let t = ir();
    return Object.entries(t).map(([e, n]) => ({
      key: e,
      value: n.value,
      updatedAt: n.updatedAt,
    }));
  }
  function Qd() {
    let t = Xd();
    if (!on.existsSync(t)) return "";
    try {
      return on.readFileSync(t, "utf-8").trim();
    } catch {
      return "";
    }
  }
  function Zd() {
    let t = o0();
    if (!on.existsSync(t)) return "";
    try {
      return on.readFileSync(t, "utf-8").trim();
    } catch {
      return "";
    }
  }
  function c0() {
    let t = [],
      e = Qd();
    e &&
      t.push(`GLOBAL INSTRUCTIONS (~/.nex/NEX.md):
${e}`);
    let n = Zd();
    n &&
      t.push(`PROJECT INSTRUCTIONS (NEX.md):
${n}`);
    let o = Vd();
    if (o.length > 0) {
      let s = o.map((r) => `  ${r.key}: ${r.value}`).join(`
`);
      t.push(`PROJECT MEMORY:
${s}`);
    }
    return t.join(`

`);
  }
  ef.exports = {
    remember: r0,
    recall: i0,
    forget: a0,
    listMemories: Vd,
    loadGlobalInstructions: Qd,
    loadProjectInstructions: Zd,
    getMemoryContext: c0,
    _getMemoryDir: la,
    _getMemoryFile: Ds,
    _getGlobalNexMdPath: Xd,
  };
});
var qs = H((wv, rf) => {
  var gt = require("fs"),
    Jn = require("path"),
    { C: yv } = Ae(),
    { atomicWrite: l0, withFileLockSync: u0 } = Zt(),
    ar = {
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
    Vn = { ...ar };
  function tf() {
    let t = Jn.join(process.cwd(), ".nex", "config.json");
    if (gt.existsSync(t))
      try {
        let e = JSON.parse(gt.readFileSync(t, "utf-8"));
        e.permissions && (Vn = { ...ar, ...e.permissions });
      } catch {}
  }
  function d0() {
    let t = Jn.join(process.cwd(), ".nex"),
      e = Jn.join(t, "config.json");
    (gt.existsSync(t) || gt.mkdirSync(t, { recursive: !0 }),
      u0(e, () => {
        let n = {};
        if (gt.existsSync(e))
          try {
            n = JSON.parse(gt.readFileSync(e, "utf-8"));
          } catch {
            n = {};
          }
        ((n.permissions = Vn), l0(e, JSON.stringify(n, null, 2)));
      }));
  }
  function nf(t) {
    return Vn[t] || "ask";
  }
  function f0(t, e) {
    return ["allow", "ask", "deny"].includes(e) ? ((Vn[t] = e), !0) : !1;
  }
  function p0(t) {
    return nf(t);
  }
  function m0() {
    return Object.entries(Vn).map(([t, e]) => ({ tool: t, mode: e }));
  }
  function h0() {
    Vn = { ...ar };
  }
  var js = {
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
  function sf() {
    let t = Jn.join(process.cwd(), ".nex", "config.json");
    try {
      return (
        (gt.existsSync(t) &&
          JSON.parse(gt.readFileSync(t, "utf-8")).teamPermissions) ||
        null
      );
    } catch {
      return null;
    }
  }
  function g0(t) {
    let e = Jn.join(process.cwd(), ".nex"),
      n = Jn.join(e, "config.json");
    gt.existsSync(e) || gt.mkdirSync(e, { recursive: !0 });
    let o = {};
    try {
      gt.existsSync(n) && (o = JSON.parse(gt.readFileSync(n, "utf-8")));
    } catch {
      o = {};
    }
    ((o.teamPermissions = t),
      gt.writeFileSync(n, JSON.stringify(o, null, 2), "utf-8"));
  }
  function of() {
    let t = sf();
    if (!t) return js.admin;
    let e = t.role || "admin",
      n = js[e] || js.admin;
    return {
      ...n,
      ...t.overrides,
      blockedTools: [
        ...(n.blockedTools || []),
        ...(t.overrides?.blockedTools || []),
      ],
    };
  }
  function $0(t) {
    let e = of();
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
  function y0() {
    return Object.entries(js).map(([t, e]) => ({
      name: t,
      description: e.description,
      toolCount: e.allowedTools
        ? `${e.allowedTools.length} allowed`
        : "all allowed",
      blockedCount: e.blockedTools.length,
    }));
  }
  tf();
  rf.exports = {
    getPermission: nf,
    setPermission: f0,
    checkPermission: p0,
    listPermissions: m0,
    loadPermissions: tf,
    savePermissions: d0,
    resetPermissions: h0,
    DEFAULT_PERMISSIONS: ar,
    PERMISSION_PRESETS: js,
    loadPresetConfig: sf,
    savePresetConfig: g0,
    getEffectivePreset: of,
    isToolAllowed: $0,
    listPresets: y0,
  };
});
var Dt = H((_v, df) => {
  var kn = require("fs"),
    cr = require("path"),
    bv = require("readline"),
    { C: xe } = Ae(),
    _e = null,
    fa = !1,
    pa = null,
    af = new Set([
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
  function lr() {
    return cr.join(process.cwd(), ".nex", "plans");
  }
  function cf() {
    let t = lr();
    kn.existsSync(t) || kn.mkdirSync(t, { recursive: !0 });
  }
  function w0(t, e = []) {
    return (
      (_e = {
        name: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        task: t,
        steps: e.map((n) => ({
          description: n.description || n,
          files: n.files || [],
          status: "pending",
        })),
        status: "draft",
        createdAt: new Date().toISOString(),
      }),
      _e
    );
  }
  function b0() {
    return _e;
  }
  function _0(t) {
    fa = t;
  }
  function x0() {
    return fa;
  }
  function k0() {
    return !_e || _e.status !== "draft"
      ? !1
      : ((_e.status = "approved"),
        (_e.updatedAt = new Date().toISOString()),
        !0);
  }
  function v0() {
    return !_e || _e.status !== "approved"
      ? !1
      : ((_e.status = "executing"), !0);
  }
  function da(t, e) {
    return !_e || t < 0 || t >= _e.steps.length
      ? !1
      : ((_e.steps[t].status = e),
        (_e.updatedAt = new Date().toISOString()),
        _e.steps.every((n) => n.status === "done" || n.status === "skipped") &&
          (_e.status = "completed"),
        !0);
  }
  function S0(t) {
    if (!t) return `${xe.dim}No active plan${xe.reset}`;
    let e = {
        draft: `${xe.yellow}DRAFT${xe.reset}`,
        approved: `${xe.green}APPROVED${xe.reset}`,
        executing: `${xe.blue}EXECUTING${xe.reset}`,
        completed: `${xe.green}COMPLETED${xe.reset}`,
      },
      n = [];
    (n.push(`
${xe.bold}${xe.cyan}Plan: ${t.task}${xe.reset}`),
      n.push(`${xe.dim}Status: ${e[t.status] || t.status}${xe.reset}
`));
    for (let o = 0; o < t.steps.length; o++) {
      let s = t.steps[o],
        r;
      switch (s.status) {
        case "done":
          r = `${xe.green}\u2713${xe.reset}`;
          break;
        case "in_progress":
          r = `${xe.blue}\u2192${xe.reset}`;
          break;
        case "skipped":
          r = `${xe.dim}\u25CB${xe.reset}`;
          break;
        default:
          r = `${xe.dim} ${xe.reset}`;
      }
      (n.push(`  ${r} ${xe.bold}Step ${o + 1}:${xe.reset} ${s.description}`),
        s.files.length > 0 &&
          n.push(`    ${xe.dim}Files: ${s.files.join(", ")}${xe.reset}`));
    }
    return (
      n.push(""),
      n.join(`
`)
    );
  }
  function E0(t) {
    if ((t || (t = _e), !t)) return null;
    cf();
    let e = cr.join(lr(), `${t.name}.json`);
    return (kn.writeFileSync(e, JSON.stringify(t, null, 2), "utf-8"), e);
  }
  function T0(t) {
    let e = cr.join(lr(), `${t}.json`);
    if (!kn.existsSync(e)) return null;
    try {
      let n = JSON.parse(kn.readFileSync(e, "utf-8"));
      return ((_e = n), n);
    } catch {
      return null;
    }
  }
  function R0() {
    cf();
    let t = lr(),
      e = kn.readdirSync(t).filter((o) => o.endsWith(".json")),
      n = [];
    for (let o of e)
      try {
        let s = JSON.parse(kn.readFileSync(cr.join(t, o), "utf-8"));
        n.push({
          name: s.name,
          task: s.task,
          status: s.status,
          steps: s.steps ? s.steps.length : 0,
          createdAt: s.createdAt,
        });
      } catch {}
    return n.sort((o, s) =>
      (s.createdAt || "").localeCompare(o.createdAt || ""),
    );
  }
  function C0(t) {
    if (!t) return [];
    let e = [],
      n = t.match(/##\s+Steps?\s*\n([\s\S]*?)(?:\n##|\s*$)/i),
      o = n ? n[1] : t,
      s = /^\s*(\d+)[.)]\s+(.+)/gm,
      r;
    for (; (r = s.exec(o)) !== null; ) {
      let a = r[2]
        .trim()
        .replace(/^\*\*What\*\*:\s*/i, "")
        .replace(/^\*\*\d+\.\*\*\s*/, "")
        .replace(/\*\*/g, "")
        .trim();
      a.length > 3 && e.push({ description: a, files: [], status: "pending" });
    }
    if (e.length === 0) {
      let i = /\*\*Step\s+\d+[:.]\*\*\s*(.+)/gi;
      for (; (r = i.exec(t)) !== null; ) {
        let a = r[1].replace(/\*\*/g, "").trim();
        a.length > 3 &&
          e.push({ description: a, files: [], status: "pending" });
      }
    }
    if (e.length > 0) {
      let i = /\*\*(?:Where|Files?)\*\*:\s*(.+)/gi,
        a = [...t.matchAll(i)];
      for (let l = 0; l < Math.min(e.length, a.length); l++) {
        let u = a[l][1];
        e[l].files = u
          .split(/[,\s]+/)
          .filter((d) => /[./]/.test(d))
          .slice(0, 5);
      }
    }
    return e;
  }
  function A0(t) {
    pa = t;
  }
  function O0() {
    return pa;
  }
  function N0() {
    ((_e = null), (fa = !1), (pa = null), L0());
  }
  function M0() {
    return `
PLAN MODE ACTIVE: You are in analysis-only mode. You MUST NOT execute any changes.

# Allowed Tools (read-only)
You may ONLY use these tools: ${[...af].join(", ")}
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
  var xn = 0;
  function P0() {
    !_e ||
      _e.status !== "executing" ||
      (xn > 0 && da(xn - 1, "done"),
      xn < _e.steps.length && (da(xn, "in_progress"), xn++));
  }
  function I0() {
    if (!_e || _e.status !== "executing" || _e.steps.length === 0) return null;
    let t = Math.min(xn, _e.steps.length),
      e = _e.steps.length,
      n = Math.max(0, t - 1),
      o = _e.steps[n]?.description || "";
    return { current: t, total: e, description: o };
  }
  function L0() {
    xn = 0;
  }
  var lf = ["interactive", "semi-auto", "autonomous"],
    uf = "interactive";
  function D0(t) {
    return lf.includes(t) ? ((uf = t), !0) : !1;
  }
  function j0() {
    return uf;
  }
  df.exports = {
    createPlan: w0,
    getActivePlan: b0,
    setPlanMode: _0,
    isPlanMode: x0,
    approvePlan: k0,
    startExecution: v0,
    updateStep: da,
    formatPlan: S0,
    savePlan: E0,
    loadPlan: T0,
    listPlans: R0,
    clearPlan: N0,
    getPlanModePrompt: M0,
    setPlanContent: A0,
    getPlanContent: O0,
    extractStepsFromText: C0,
    advancePlanStep: P0,
    getPlanStepInfo: I0,
    PLAN_MODE_ALLOWED_TOOLS: af,
    setAutonomyLevel: D0,
    getAutonomyLevel: j0,
    AUTONOMY_LEVELS: lf,
  };
});
var xf = H((xv, _f) => {
  var { C: T } = Ae();
  function ff() {
    return Math.max(10, (process.stdout.columns || 80) - 2);
  }
  function q0(t) {
    if (!t) return "";
    let e = t.split(`
`),
      n = [],
      o = !1,
      s = "";
    for (let r of e) {
      let i = ff();
      if (r.trim().startsWith("```")) {
        if (o)
          (n.push(`${T.dim}${"\u2500".repeat(40)}${T.reset}`),
            (o = !1),
            (s = ""));
        else {
          ((o = !0), (s = r.trim().substring(3).trim()));
          let a = s ? ` ${s} ` : "";
          n.push(
            `${T.dim}${"\u2500".repeat(3)}${a}${"\u2500".repeat(Math.max(0, 37 - a.length))}${T.reset}`,
          );
        }
        continue;
      }
      if (o) {
        n.push(`  ${ha(r, s)}`);
        continue;
      }
      if (r.startsWith("### ")) {
        n.push(`${T.bold}${T.cyan}   ${vn(r.substring(4))}${T.reset}`);
        continue;
      }
      if (r.startsWith("## ")) {
        n.push(`${T.bold}${T.cyan}  ${vn(r.substring(3))}${T.reset}`);
        continue;
      }
      if (r.startsWith("# ")) {
        n.push(`${T.bold}${T.cyan}${vn(r.substring(2))}${T.reset}`);
        continue;
      }
      if (/^\s*[-*]\s/.test(r)) {
        let a = r.match(/^(\s*)/)[1],
          l = r.replace(/^\s*[-*]\s/, ""),
          u = `${a}${T.cyan}\u2022${T.reset} ${Sn(l)}`;
        n.push(En(u, i, a + "  "));
        continue;
      }
      if (/^\s*\d+\.\s/.test(r)) {
        let a = r.match(/^(\s*)(\d+)\.\s(.*)/);
        if (a) {
          let l = a[1],
            u = a[2],
            d = a[3],
            f = `${l}${T.cyan}${u}.${T.reset} ${Sn(d)}`,
            m = l + " ".repeat(u.length + 2);
          n.push(En(f, i, m));
          continue;
        }
      }
      n.push(En(Sn(r), i));
    }
    return n.join(`
`);
  }
  function vn(t) {
    return t
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
  }
  function Sn(t) {
    return t
      ? t
          .replace(/`([^`]+)`/g, `${T.cyan}$1${T.reset}`)
          .replace(/\*\*([^*]+)\*\*/g, `${T.bold}$1${T.reset}`)
          .replace(/\*([^*]+)\*/g, `${T.dim}$1${T.reset}`)
          .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            `${T.cyan}$1${T.reset} ${T.dim}($2)${T.reset}`,
          )
      : "";
  }
  function ha(t, e) {
    return t
      ? ["js", "javascript", "ts", "typescript", "jsx", "tsx"].includes(e) || !e
        ? pf(t)
        : e === "bash" || e === "sh" || e === "shell" || e === "zsh"
          ? mf(t)
          : e === "json" || e === "jsonc"
            ? hf(t)
            : e === "python" || e === "py"
              ? gf(t)
              : e === "go" || e === "golang"
                ? $f(t)
                : e === "rust" || e === "rs"
                  ? yf(t)
                  : e === "css" || e === "scss" || e === "less"
                    ? wf(t)
                    : e === "html" || e === "xml" || e === "svg" || e === "htm"
                      ? bf(t)
                      : t
      : "";
  }
  function pf(t) {
    let e =
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|require|async|await|new|this|throw|try|catch|switch|case|break|default|typeof|instanceof)\b/g,
      n = /(["'`])(?:(?=(\\?))\2.)*?\1/g,
      o = /(\/\/.*$)/,
      s = /\b(\d+\.?\d*)\b/g,
      r = t;
    return (
      (r = r.replace(s, `${T.yellow}$1${T.reset}`)),
      (r = r.replace(e, `${T.magenta}$1${T.reset}`)),
      (r = r.replace(n, `${T.green}$&${T.reset}`)),
      (r = r.replace(o, `${T.dim}$1${T.reset}`)),
      r
    );
  }
  function mf(t) {
    let e = /^(\s*)([\w-]+)/,
      n = /(--?\w[\w-]*)/g,
      o = /(["'])(?:(?=(\\?))\2.)*?\1/g,
      s = /(#.*$)/,
      r = t;
    return (
      (r = r.replace(n, `${T.cyan}$1${T.reset}`)),
      (r = r.replace(e, `$1${T.green}$2${T.reset}`)),
      (r = r.replace(o, `${T.yellow}$&${T.reset}`)),
      (r = r.replace(s, `${T.dim}$1${T.reset}`)),
      r
    );
  }
  function hf(t) {
    let e = /("[\w-]+")\s*:/g,
      n = /:\s*("(?:[^"\\]|\\.)*")/g,
      o = /:\s*(\d+\.?\d*)/g,
      s = /:\s*(true|false|null)/g,
      r = t;
    return (
      (r = r.replace(e, `${T.cyan}$1${T.reset}:`)),
      (r = r.replace(n, `: ${T.green}$1${T.reset}`)),
      (r = r.replace(o, `: ${T.yellow}$1${T.reset}`)),
      (r = r.replace(s, `: ${T.magenta}$1${T.reset}`)),
      r
    );
  }
  function gf(t) {
    let e =
        /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|and|or|not|in|is|None|True|False|self|async|await|nonlocal|global)\b/g,
      n =
        /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
      o = /(#.*$)/,
      s = /\b(\d+\.?\d*)\b/g,
      r = /^(\s*@\w+)/,
      i = t;
    return (
      (i = i.replace(s, `${T.yellow}$1${T.reset}`)),
      (i = i.replace(e, `${T.magenta}$1${T.reset}`)),
      (i = i.replace(r, `${T.cyan}$1${T.reset}`)),
      (i = i.replace(n, `${T.green}$&${T.reset}`)),
      (i = i.replace(o, `${T.dim}$1${T.reset}`)),
      i
    );
  }
  function $f(t) {
    let e =
        /\b(func|package|import|var|const|type|struct|interface|map|chan|go|defer|return|if|else|for|range|switch|case|default|break|continue|select|fallthrough|nil|true|false|make|new|len|cap|append|copy|delete|panic|recover)\b/g,
      n =
        /\b(string|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|bool|byte|rune|error|any)\b/g,
      o = /(["'`])(?:(?=(\\?))\2.)*?\1/g,
      s = /(\/\/.*$)/,
      r = /\b(\d+\.?\d*)\b/g,
      i = t;
    return (
      (i = i.replace(r, `${T.yellow}$1${T.reset}`)),
      (i = i.replace(n, `${T.cyan}$1${T.reset}`)),
      (i = i.replace(e, `${T.magenta}$1${T.reset}`)),
      (i = i.replace(o, `${T.green}$&${T.reset}`)),
      (i = i.replace(s, `${T.dim}$1${T.reset}`)),
      i
    );
  }
  function yf(t) {
    let e =
        /\b(fn|let|mut|const|struct|enum|impl|trait|pub|use|mod|crate|self|super|match|if|else|for|while|loop|return|break|continue|where|as|in|ref|move|async|await|unsafe|extern|type|static|dyn|macro_rules)\b/g,
      n =
        /\b(i8|i16|i32|i64|i128|u8|u16|u32|u64|u128|f32|f64|bool|char|str|String|Vec|Option|Result|Box|Rc|Arc|Self|Some|None|Ok|Err|true|false)\b/g,
      o = /(["'])(?:(?=(\\?))\2.)*?\1/g,
      s = /(\/\/.*$)/,
      r = /\b(\d+\.?\d*)\b/g,
      i = /\b(\w+!)/g,
      a = t;
    return (
      (a = a.replace(r, `${T.yellow}$1${T.reset}`)),
      (a = a.replace(n, `${T.cyan}$1${T.reset}`)),
      (a = a.replace(e, `${T.magenta}$1${T.reset}`)),
      (a = a.replace(i, `${T.yellow}$1${T.reset}`)),
      (a = a.replace(o, `${T.green}$&${T.reset}`)),
      (a = a.replace(s, `${T.dim}$1${T.reset}`)),
      a
    );
  }
  function wf(t) {
    let e = /^(\s*)([\w-]+)\s*:/,
      n = /:\s*([^;]+)/,
      o = /^(\s*[.#@][\w-]+)/,
      s = /\b(\d+\.?\d*(px|em|rem|%|vh|vw|s|ms|deg|fr)?)\b/g,
      r = /(\/\*.*?\*\/|\/\/.*$)/,
      i = /(#[0-9a-fA-F]{3,8})\b/g,
      a = t;
    return (
      (a = a.replace(i, `${T.yellow}$1${T.reset}`)),
      (a = a.replace(s, `${T.yellow}$1${T.reset}`)),
      (a = a.replace(e, `$1${T.cyan}$2${T.reset}:`)),
      (a = a.replace(o, `$1${T.magenta}$&${T.reset}`)),
      (a = a.replace(r, `${T.dim}$1${T.reset}`)),
      a
    );
  }
  function bf(t) {
    let e = /<\/?(\w[\w-]*)/g,
      n = /\s([\w-]+)=/g,
      o = /(["'])(?:(?=(\\?))\2.)*?\1/g,
      s = /(<!--.*?-->)/g,
      r = /(&\w+;)/g,
      i = t;
    return (
      (i = i.replace(s, `${T.dim}$1${T.reset}`)),
      (i = i.replace(o, `${T.green}$&${T.reset}`)),
      (i = i.replace(e, `<${T.magenta}$1${T.reset}`)),
      (i = i.replace(n, ` ${T.cyan}$1${T.reset}=`)),
      (i = i.replace(r, `${T.yellow}$1${T.reset}`)),
      i
    );
  }
  function En(t, e, n = "") {
    if (!e || e < 10) return t;
    let o = "",
      s = 0,
      r = -1,
      i = 0,
      a = 0,
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
      if ((t[i] === " " && (r = i), s++, s > e && r !== -1)) {
        ((o +=
          t.slice(a, r) +
          `
` +
          n),
          (a = r + 1),
          (i = a),
          (s = n.length),
          (r = -1));
        continue;
      }
      (s > e &&
        r === -1 &&
        ((o +=
          t.slice(a, i) +
          `
` +
          n),
        (a = i),
        (s = n.length + 1)),
        i++);
    }
    return ((o += t.slice(a)), o);
  }
  function F0(t, e) {
    if (!t || t.length === 0) return "";
    let n = t.map((i, a) => {
        let l = e.reduce((u, d) => Math.max(u, (d[a] || "").length), 0);
        return Math.max(i.length, l);
      }),
      o = n.map((i) => "\u2500".repeat(i + 2)).join("\u253C"),
      s = t
        .map((i, a) => ` ${T.bold}${i.padEnd(n[a])}${T.reset} `)
        .join("\u2502"),
      r = [];
    (r.push(`${T.dim}\u250C${o.replace(/┼/g, "\u252C")}\u2510${T.reset}`),
      r.push(`${T.dim}\u2502${T.reset}${s}${T.dim}\u2502${T.reset}`),
      r.push(`${T.dim}\u251C${o}\u2524${T.reset}`));
    for (let i of e) {
      let a = t
        .map((l, u) => ` ${(i[u] || "").padEnd(n[u])} `)
        .join(`${T.dim}\u2502${T.reset}`);
      r.push(`${T.dim}\u2502${T.reset}${a}${T.dim}\u2502${T.reset}`);
    }
    return (
      r.push(`${T.dim}\u2514${o.replace(/┼/g, "\u2534")}\u2518${T.reset}`),
      r.join(`
`)
    );
  }
  function U0(t, e, n, o = 30) {
    let s = n > 0 ? Math.round((e / n) * 100) : 0,
      r = Math.round((s / 100) * o),
      i = o - r,
      a = s >= 100 ? T.green : s > 50 ? T.yellow : T.cyan;
    return `  ${t} ${a}${"\u2588".repeat(r)}${T.dim}${"\u2591".repeat(i)}${T.reset} ${s}% (${e}/${n})`;
  }
  var ma = class {
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
      } catch (n) {
        if (n.code !== "EPIPE") throw n;
      }
    }
    _cursorWrite(e) {
      try {
        process.stderr.write(e);
      } catch (n) {
        if (n.code !== "EPIPE") throw n;
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
      let n = [0, 1, 2, 3, 4, 3, 2, 1],
        o = n[this._cursorFrame % n.length],
        s = "";
      for (let r = 0; r < 5; r++) s += r === o ? "\x1B[36m\u25CF\x1B[0m" : " ";
      (this._cursorWrite(`\x1B[2K\r${s}`), this._cursorFrame++);
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
      let n;
      for (
        ;
        (n = this.buffer.indexOf(`
`)) !== -1;
      ) {
        let o = this.buffer.substring(0, n);
        ((this.buffer = this.buffer.substring(n + 1)), this._renderLine(o));
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
          (this._safeWrite(`${T.dim}${"\u2500".repeat(40)}${T.reset}
`),
          (this.inCodeBlock = !1),
          (this.codeBlockLang = "")));
    }
    _renderLine(e) {
      let n = ff();
      if (e.trim().startsWith("```")) {
        if (this.inCodeBlock)
          (this._safeWrite(`${T.dim}${"\u2500".repeat(40)}${T.reset}
`),
            (this.inCodeBlock = !1),
            (this.codeBlockLang = ""));
        else {
          ((this.inCodeBlock = !0),
            (this.codeBlockLang = e.trim().substring(3).trim()));
          let s = this.codeBlockLang ? ` ${this.codeBlockLang} ` : "";
          this
            ._safeWrite(`${T.dim}${"\u2500".repeat(3)}${s}${"\u2500".repeat(Math.max(0, 37 - s.length))}${T.reset}
`);
        }
        return;
      }
      if (this.inCodeBlock) {
        this._safeWrite(`  ${ha(e, this.codeBlockLang)}
`);
        return;
      }
      if (e.startsWith("### ")) {
        this._safeWrite(`${T.bold}${T.cyan}   ${vn(e.substring(4))}${T.reset}
`);
        return;
      }
      if (e.startsWith("## ")) {
        this._safeWrite(`${T.bold}${T.cyan}  ${vn(e.substring(3))}${T.reset}
`);
        return;
      }
      if (e.startsWith("# ")) {
        this._safeWrite(`${T.bold}${T.cyan}${vn(e.substring(2))}${T.reset}
`);
        return;
      }
      if (/^\s*[-*]\s/.test(e)) {
        let s = e.match(/^(\s*)/)[1],
          r = e.replace(/^\s*[-*]\s/, ""),
          i = `${s}${T.cyan}\u2022${T.reset} ${Sn(r)}`,
          a = En(i, n, s + "  ");
        this._safeWrite(`${a}
`);
        return;
      }
      if (/^\s*\d+\.\s/.test(e)) {
        let s = e.match(/^(\s*)(\d+)\.\s(.*)/);
        if (s) {
          let r = s[1],
            i = s[2],
            a = s[3],
            l = `${r}${T.cyan}${i}.${T.reset} ${Sn(a)}`,
            u = r + " ".repeat(i.length + 2),
            d = En(l, n, u);
          this._safeWrite(`${d}
`);
          return;
        }
      }
      let o = En(Sn(e), n);
      this._safeWrite(`${o}
`);
    }
  };
  _f.exports = {
    renderMarkdown: q0,
    renderInline: Sn,
    stripHeadingMarkers: vn,
    highlightCode: ha,
    highlightJS: pf,
    highlightBash: mf,
    highlightJSON: hf,
    highlightPython: gf,
    highlightGo: $f,
    highlightRust: yf,
    highlightCSS: wf,
    highlightHTML: bf,
    renderTable: F0,
    renderProgress: U0,
    wrapAnsi: En,
    StreamRenderer: ma,
  };
});
var ya = H((kv, Ef) => {
  var { execSync: W0 } = require("child_process"),
    ga = require("path"),
    Fs = require("fs"),
    $a = [
      "pre-tool",
      "post-tool",
      "pre-commit",
      "post-response",
      "session-start",
      "session-end",
    ];
  function kf() {
    return ga.join(process.cwd(), ".nex", "hooks");
  }
  function B0() {
    return ga.join(process.cwd(), ".nex", "config.json");
  }
  function vf() {
    let t = B0();
    if (!Fs.existsSync(t)) return {};
    try {
      return JSON.parse(Fs.readFileSync(t, "utf-8")).hooks || {};
    } catch {
      return {};
    }
  }
  function ur(t) {
    if (!$a.includes(t)) return [];
    let e = [],
      n = kf(),
      o = ga.join(n, t);
    Fs.existsSync(o) && e.push(o);
    let s = vf();
    if (s[t]) {
      let r = Array.isArray(s[t]) ? s[t] : [s[t]];
      e.push(...r);
    }
    return e;
  }
  function Sf(t, e = {}, n = 3e4) {
    try {
      return {
        success: !0,
        output: W0(t, {
          cwd: process.cwd(),
          encoding: "utf-8",
          timeout: n,
          env: { ...process.env, ...e },
          stdio: ["pipe", "pipe", "pipe"],
        }).trim(),
      };
    } catch (o) {
      return { success: !1, error: o.stderr ? o.stderr.trim() : o.message };
    }
  }
  function H0(t, e = {}) {
    let n = ur(t);
    if (n.length === 0) return [];
    let o = {};
    for (let [r, i] of Object.entries(e))
      o[`NEX_${r.toUpperCase()}`] = String(i);
    let s = [];
    for (let r of n) {
      let i = Sf(r, o);
      if ((s.push({ command: r, ...i }), !i.success && t.startsWith("pre-")))
        break;
    }
    return s;
  }
  function G0(t) {
    return ur(t).length > 0;
  }
  function K0() {
    let t = [];
    for (let e of $a) {
      let n = ur(e);
      n.length > 0 && t.push({ event: e, commands: n });
    }
    return t;
  }
  function Y0() {
    let t = kf();
    return (Fs.existsSync(t) || Fs.mkdirSync(t, { recursive: !0 }), t);
  }
  Ef.exports = {
    HOOK_EVENTS: $a,
    loadHookConfig: vf,
    getHooksForEvent: ur,
    executeHook: Sf,
    runHooks: H0,
    hasHooks: G0,
    listHooks: K0,
    initHooksDir: Y0,
  };
});
var Us = H((Ev, Df) => {
  "use strict";
  var { callWithRetry: Tf, runSubAgent: z0, clearAllLocks: X0 } = Yo(),
    {
      parseModelSpec: Rf,
      getActiveProviderName: vv,
      getActiveModelId: Sv,
    } = Oe(),
    { MultiProgress: J0, C: ae } = Ae(),
    Cf = 3,
    wa = 4,
    Af = "devstral-2:123b",
    Of = "kimi-k2.5",
    Nf = `You are a task decomposition engine. Given a complex user request, split it into independent, atomic sub-tasks.

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
    Mf = `You are a result synthesis engine. Given the results of multiple sub-agents that worked on parts of a larger task, produce a unified summary.

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
  function Pf(t) {
    let e = 0,
      n = [];
    return function () {
      return new Promise((s) => {
        let r = () => {
          e < t
            ? (e++,
              s(() => {
                (e--, n.length > 0 && n.shift()());
              }))
            : n.push(r);
        };
        r();
      });
    };
  }
  function V0(t) {
    if (!t || typeof t != "string")
      return { isComplex: !1, estimatedGoals: 0, reason: "empty" };
    let e = 0,
      n = [],
      o = t.match(
        /(?:(?:^|\n)\s*|\s)(?:\d+[.)]\s|[(]\d+[)][\s,]|[(][a-z][)][\s,])/g,
      );
    o &&
      o.length >= 2 &&
      ((e = Math.max(e, o.length)), n.push(`${o.length} numbered items`));
    let s = t.match(/(?:^|\n)\s*[-*]\s+\S/g);
    s &&
      s.length >= 3 &&
      ((e = Math.max(e, s.length)), n.push(`${s.length} bullet points`));
    let r = t.split(/;\s*/).filter((u) => u.trim().length > 10);
    r.length >= 3 &&
      ((e = Math.max(e, r.length)),
      n.push(`${r.length} semicolon-separated goals`));
    let i = t.match(
      /\b(also|additionally|and\s+(?:fix|add|update|create|implement|remove|refactor))\b/gi,
    );
    i &&
      i.length >= 2 &&
      ((e = Math.max(e, i.length + 1)),
      n.push(`${i.length} transition keywords`));
    let a = parseInt(process.env.NEX_ORCHESTRATE_THRESHOLD || "3", 10);
    return {
      isComplex: e >= a,
      estimatedGoals: e,
      reason: n.length > 0 ? n.join(", ") : "single goal",
    };
  }
  function ba(t) {
    if (!t || typeof t != "string")
      throw new Error("Empty response from orchestrator model");
    let e = t.trim();
    try {
      return JSON.parse(e);
    } catch {}
    let n = e.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (n)
      try {
        return JSON.parse(n[1].trim());
      } catch {}
    let o = e.search(/[[\{]/);
    if (o >= 0) {
      let s = e.slice(o);
      try {
        return JSON.parse(s);
      } catch {}
    }
    throw new Error(`Could not extract valid JSON from response:
${e.slice(0, 200)}`);
  }
  async function If(t, e, n = {}) {
    let o = n.maxSubTasks || wa,
      r = [
        {
          role: "system",
          content: Nf.replace("{maxSubTasks}", String(o)).replace(
            "{prompt}",
            t,
          ),
        },
        { role: "user", content: t },
      ],
      i = {};
    if (e) {
      let f = Rf(e);
      (f.provider && (i.provider = f.provider), f.model && (i.model = f.model));
    }
    let l = (await Tf(r, [], i)).content || "",
      u = ba(l);
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
  async function Lf(t, e, n) {
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
          content: Mf.replace("{prompt}", e).replace("{results}", o),
        },
        { role: "user", content: "Synthesize the sub-agent results above." },
      ],
      i = {};
    if (n) {
      let d = Rf(n);
      (d.provider && (i.provider = d.provider), d.model && (i.model = d.model));
    }
    let l = (await Tf(r, [], i)).content || "",
      u = ba(l);
    return {
      summary: String(u.summary || ""),
      conflicts: Array.isArray(u.conflicts) ? u.conflicts : [],
      commitMessage: String(u.commitMessage || ""),
      filesChanged: Array.isArray(u.filesChanged) ? u.filesChanged : [],
    };
  }
  async function Q0(t, e = {}) {
    let n = e.orchestratorModel || process.env.NEX_ORCHESTRATOR_MODEL || Of,
      o = e.workerModel || Af,
      s = e.maxParallel || Cf,
      r = e.maxSubTasks || wa,
      i = e.onProgress || (() => {}),
      a = { input: 0, output: 0 };
    (console.log(`
${ae.bold}Orchestrator${ae.reset}  ${ae.dim}model: ${n} | workers: ${o} | max parallel: ${s}${ae.reset}
`),
      i("decomposing"),
      console.log(
        `${ae.dim}Phase 1: Decomposing prompt into sub-tasks...${ae.reset}`,
      ));
    let l;
    try {
      l = await If(t, n, { maxSubTasks: r });
    } catch (C) {
      return (
        console.log(`${ae.red}Decompose failed: ${C.message}${ae.reset}`),
        {
          results: [],
          synthesis: {
            summary: `Decompose failed: ${C.message}`,
            conflicts: [],
            commitMessage: "",
            filesChanged: [],
          },
          totalTokens: a,
        }
      );
    }
    if (l.length === 0)
      return (
        console.log(
          `${ae.yellow}No sub-tasks generated. Prompt may be too simple for orchestration.${ae.reset}`,
        ),
        {
          results: [],
          synthesis: {
            summary: "No sub-tasks generated.",
            conflicts: [],
            commitMessage: "",
            filesChanged: [],
          },
          totalTokens: a,
        }
      );
    console.log(`${ae.green}Decomposed into ${l.length} sub-tasks:${ae.reset}`);
    for (let C of l) {
      console.log(`  ${ae.dim}${C.id}:${ae.reset} ${C.task}`);
      let L = C.scope.filter(Boolean);
      L.length > 0 &&
        console.log(`     ${ae.dim}scope: ${L.join(", ")}${ae.reset}`);
    }
    (console.log(""),
      i("executing"),
      console.log(`${ae.dim}Phase 2: Running ${l.length} sub-agents (max ${s} parallel)...${ae.reset}
`));
    let u = Date.now(),
      d = Pf(s),
      f = { findings: [], _lock: !1 },
      m = l.map(
        (C, L) =>
          `Agent ${L + 1} [${o}]: ${C.task.substring(0, 40)}${C.task.length > 40 ? "..." : ""}`,
      ),
      h = new J0(m);
    h.start();
    let p = `
You are a focused coding agent executing ONE specific sub-task.
Your scope is limited to the files listed in your task definition.

CRITICAL RULE: Do not search for whether something exists before acting.
- If your task says "ensure X is in file Y" \u2192 read Y, add X if missing, done.
- If your task says "document X" \u2192 write the documentation now.
- Searching is only allowed to find WHERE to insert content, not WHETHER to insert.
- After max 3 tool calls: you must write/edit something or you have failed.

RULES:
- NEVER use external CLI tools for analysis (aspell, jq, sed, awk, grep for reading).
  Use read_file + your own reasoning instead.
- Be PROACTIVE: if something is missing, ADD it. Do not just search and report.
- If your task says "fix typos" \u2014 read the file, find typos yourself, edit them.
- If your task says "add X to README" \u2014 add it, don't check if it exists first.
- Max 10 tool calls. If you need more, you are doing too much \u2014 narrow your scope.
- When done: stop calling tools and write a one-line summary of what you changed.
`,
      g = l.map(async (C, L) => {
        let Ee = await d();
        try {
          let me = f.findings
              .filter((ce) => ce.agentId !== C.id)
              .map((ce) => `Agent ${ce.agentId} found: ${ce.summary}`).join(`
`),
            le = [
              me
                ? `Prior agent findings:
${me}
`
                : "",
              C.scope.length > 0 ? `Focus on files: ${C.scope.join(", ")}` : "",
            ].filter(Boolean),
            ie = await z0(
              {
                task: C.task,
                context:
                  le.length > 0
                    ? le.join(`
`)
                    : void 0,
                max_iterations: Math.min(C.estimatedCalls || 10, 15),
                model: o,
                _skipLog: !0,
                _systemPrompt: p,
              },
              {
                onUpdate: (ce) => {
                  if (ce && ce.type === "tool_call" && process.stderr.isTTY) {
                    let Q = `  ${ae.dim}[Agent ${L + 1}] ${ce.tool}${ae.reset}`;
                    process.stderr.write(
                      Q +
                        `
`,
                    );
                  }
                },
              },
            ),
            oe =
              typeof ie.result == "string"
                ? ie.result.slice(0, 200)
                : String(ie.result || "").slice(0, 200);
          return (
            f.findings.push({
              agentId: C.id,
              summary: oe,
              files: Array.isArray(C.scope) ? C.scope : [],
            }),
            h.update(L, ie.status === "failed" ? "error" : "done"),
            (a.input += ie.tokensUsed?.input || 0),
            (a.output += ie.tokensUsed?.output || 0),
            ie.tokensUsed?._estimated && (a._estimated = !0),
            { ...ie, _scope: C.scope, _idx: L }
          );
        } catch (me) {
          return (
            h.update(L, "error"),
            {
              task: C.task,
              status: "failed",
              result: `Error: ${me.message}`,
              toolsUsed: [],
              tokensUsed: { input: 0, output: 0 },
            }
          );
        } finally {
          Ee();
        }
      }),
      y;
    try {
      y = await Promise.all(g);
    } finally {
      (h.stop({ silent: !0 }), X0());
    }
    console.log("");
    let w = Math.round((Date.now() - u) / 1e3),
      k = w >= 60 ? `${Math.floor(w / 60)}m ${w % 60}s` : `${w}s`;
    for (let C = 0; C < y.length; C++) {
      let L = y[C],
        me =
          L.status === "done" ||
          (L.status === "truncated" &&
            L.result &&
            !L.result.startsWith("Error"))
            ? `${ae.green}\u2713${ae.reset}`
            : `${ae.red}\u2717${ae.reset}`,
        le =
          L._scope && L._scope.length > 0
            ? L._scope
                .map((ce) => ce.replace(/^.*\//, "").replace(/\/$/, ""))
                .filter(Boolean)
            : [],
        ie =
          le.length > 0
            ? le.join(", ")
            : L.task.substring(0, 35) + (L.task.length > 35 ? "..." : ""),
        oe = C === y.length - 1;
      console.log(
        `  ${me} Agent ${C + 1}  ${ae.dim}${ie}${ae.reset}${oe ? `   ${ae.dim}${k}${ae.reset}` : ""}`,
      );
    }
    (console.log(""),
      i("synthesizing"),
      console.log(`${ae.dim}Phase 3: Synthesizing results...${ae.reset}`));
    let R;
    try {
      R = await Lf(y, t, n);
    } catch (C) {
      (console.log(
        `${ae.yellow}Synthesize failed: ${C.message} \u2014 using raw results.${ae.reset}`,
      ),
        (R = {
          summary: y.map((L) => L.result).join(`
`),
          conflicts: [],
          commitMessage: "",
          filesChanged: [],
        }));
    }
    let x = f.findings.flatMap((C) => C.files),
      _ = new Map();
    for (let C of x) _.set(C, (_.get(C) || 0) + 1);
    let b = [..._.values()].some((C) => C > 1),
      O =
        f.findings.length > 1 && b
          ? ` ${ae.dim}(agents shared context)${ae.reset}`
          : "";
    if (
      (console.log(`
${ae.bold}Summary:${ae.reset} ${R.summary}${O}`),
      R.conflicts.length > 0)
    ) {
      console.log(`${ae.yellow}Conflicts:${ae.reset}`);
      for (let C of R.conflicts) console.log(`  - ${C}`);
    }
    R.commitMessage &&
      console.log(`${ae.dim}Suggested commit: ${R.commitMessage}${ae.reset}`);
    let N =
      a.input === 0 && a.output === 0
        ? "n/a (provider does not report token counts)"
        : a._estimated
          ? `~${a.input} input / ~${a.output} output (est.)`
          : `${a.input} input + ${a.output} output`;
    return (
      console.log(`${ae.dim}Tokens: ${N}${ae.reset}
`),
      { results: y, synthesis: R, totalTokens: a }
    );
  }
  Df.exports = {
    runOrchestrated: Q0,
    decompose: If,
    synthesize: Lf,
    detectComplexPrompt: V0,
    extractJSON: ba,
    createSemaphore: Pf,
    DECOMPOSE_PROMPT: Nf,
    SYNTHESIZE_PROMPT: Mf,
    DEFAULT_ORCHESTRATOR_MODEL: Of,
    DEFAULT_WORKER_MODEL: Af,
    DEFAULT_MAX_PARALLEL: Cf,
    DEFAULT_MAX_SUBTASKS: wa,
  };
});
var Se = H((Nv, op) => {
  var {
      C: $,
      Spinner: Zn,
      TaskProgress: Z0,
      formatToolCall: eb,
      formatToolSummary: zf,
      formatSectionHeader: _a,
      formatMilestone: tb,
      setActiveTaskProgress: Tv,
    } = Ae(),
    { debugLog: re, warnLog: Rv } = mi(),
    { MilestoneTracker: nb } = Nl(),
    { callStream: sb } = Oe(),
    { parseToolArgs: ob } = Un(),
    { executeTool: rb } = Et(),
    { gatherProjectContext: ib } = nr(),
    {
      fitToContext: ab,
      forceCompress: jt,
      getUsage: Ot,
      estimateTokens: cb,
    } = Qe(),
    { autoSave: lb, flushAutoSave: ub } = At(),
    { scoreMessages: db, formatScore: fb, appendScoreHistory: pb } = or();
  function Ue(t) {
    (lb(t), ub());
  }
  function jf(t) {
    try {
      if (
        !t.some((o) =>
          o.role !== "assistant"
            ? !1
            : !!(
                (Array.isArray(o.content) &&
                  o.content.some((s) => s && s.type === "tool_use")) ||
                (Array.isArray(o.tool_calls) && o.tool_calls.length > 0)
              ),
        )
      )
        return;
      let n = db(t);
      if (!n) return;
      console.log(fb(n, $));
      try {
        let { _getSessionsDir: o } = At(),
          s = require("fs"),
          r = require("path").join(o(), "_autosave.json");
        if (s.existsSync(r)) {
          let i = JSON.parse(s.readFileSync(r, "utf-8"));
          ((i.score = n.score),
            (i.scoreGrade = n.grade),
            (i.scoreIssues = n.issues),
            s.writeFileSync(r, JSON.stringify(i, null, 2)));
        }
      } catch {}
      try {
        let { getActiveModel: o } = Un(),
          s = Nn();
        pb(n.score, {
          version: s.version,
          model: o ? o() : null,
          sessionName: "_autosave",
          issues: n.issues,
        });
      } catch {}
    } catch {}
  }
  var { getMemoryContext: mb } = rn(),
    { getDeploymentContextBlock: hb } = oa(),
    { checkPermission: gb, setPermission: $b, savePermissions: yb } = qs(),
    { confirm: Xf, setAllowAlwaysHandler: wb, getAutoConfirm: bb } = Xe(),
    {
      isPlanMode: Gs,
      getPlanModePrompt: _b,
      PLAN_MODE_ALLOWED_TOOLS: Jf,
      setPlanContent: xb,
      extractStepsFromText: kb,
      createPlan: vb,
      getActivePlan: Cv,
      startExecution: Av,
      advancePlanStep: Sb,
      getPlanStepInfo: Eb,
    } = Dt(),
    { StreamRenderer: Tb } = xf(),
    { runHooks: qf } = ya(),
    { routeMCPCall: Rb, getMCPToolDefinitions: Cb } = Co(),
    {
      getSkillInstructions: Ab,
      getSkillToolDefinitions: Ob,
      routeSkillCall: Nb,
    } = nn(),
    { trackUsage: Ff, estimateTokens: Uf } = Fn();
  function Wf(t) {
    return !t || typeof t != "string"
      ? 0
      : typeof Uf == "function"
        ? Uf(t)
        : Math.ceil(t.length / 4);
  }
  var { validateToolArgs: Mb } = Ti(),
    {
      filterToolsForModel: Bf,
      getModelTier: Pb,
      PROVIDER_DEFAULT_TIER: Ov,
    } = Uo(),
    {
      getConfiguredProviders: Ib,
      getActiveProviderName: es,
      getActiveModelId: Tn,
      setActiveModel: Hf,
      MODEL_EQUIVALENTS: yr,
    } = Oe(),
    Ia = require("fs"),
    La = require("path"),
    Lb = (() => {
      let t = parseInt(process.env.NEX_MILESTONE_STEPS ?? "5", 10);
      return Number.isFinite(t) && t >= 0 ? t : 5;
    })();
  function Db(t) {
    let e = tb(
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
  var Gf =
    /(?:^|\s)((?:~|\.{1,2})?(?:\/[\w.\-@() ]+)+\.(?:png|jpe?g|gif|webp|bmp|tiff?))(?:\s|$)/gi;
  function jb(t) {
    let e = [],
      n;
    for (Gf.lastIndex = 0; (n = Gf.exec(t)) !== null; ) {
      let o = n[1].trim(),
        s = o.startsWith("~")
          ? o.replace("~", process.env.HOME || "")
          : La.resolve(o);
      Ia.existsSync(s) && e.push({ raw: o, abs: s });
    }
    return e;
  }
  function qb(t) {
    let e = Ia.readFileSync(t),
      n = La.extname(t).toLowerCase().replace(".", ""),
      o =
        n === "jpg" || n === "jpeg"
          ? "image/jpeg"
          : n === "png"
            ? "image/png"
            : n === "gif"
              ? "image/gif"
              : n === "webp"
                ? "image/webp"
                : "image/png";
    return { data: e.toString("base64"), media_type: o };
  }
  function Vf(t) {
    let e = jb(t);
    if (e.length === 0) return t;
    let n = [{ type: "text", text: t }];
    for (let o of e)
      try {
        let { data: s, media_type: r } = qb(o.abs);
        n.push({ type: "image", media_type: r, data: s });
      } catch {}
    return n.length > 1 ? n : t;
  }
  function Fb(t) {
    if (!t || t.length < 200) return { text: t, truncated: !1, repeatCount: 0 };
    let n = t.split(/(?<=\. )/).filter((l) => l.trim().length > 0);
    if (n.length < 6) return { text: t, truncated: !1, repeatCount: 0 };
    let o = new Map();
    for (let l = 0; l <= n.length - 3; l++) {
      let u = n
        .slice(l, l + 3)
        .join("")
        .trim();
      u.length > 30 && o.set(u, (o.get(u) || 0) + 1);
    }
    let s = 0,
      r = "";
    for (let [l, u] of o) u > s && ((s = u), (r = l));
    if (s < 3) return { text: t, truncated: !1, repeatCount: s };
    let i = `

[SYSTEM: Output repetition detected \u2014 response truncated (${s}\xD7 repeated paragraph)]`,
      a;
    if (t.length > 8e3) a = t.slice(0, 3e3) + i;
    else {
      let l = 0,
        u = -1,
        d = 0;
      for (; l < 2; ) {
        let f = t.indexOf(r, d);
        if (f === -1) break;
        (l++, (u = f + r.length), (d = f + 1));
      }
      a = u > 0 ? t.slice(0, u) + i : t.slice(0, 3e3) + i;
    }
    return { text: a, truncated: !0, repeatCount: s };
  }
  function Ra(t, e = 5) {
    if (!t || t.length < 40) return { text: t, truncated: !1, repeatCount: 0 };
    let n = t.split(`
`),
      o = new Map();
    for (let f of n) {
      let m = f.trim();
      m.length >= 20 && o.set(m, (o.get(m) || 0) + 1);
    }
    let s = 0,
      r = "";
    for (let [f, m] of o) m > s && ((s = m), (r = f));
    if (s <= e) return { text: t, truncated: !1, repeatCount: s };
    let i = `

\u26A0 [Response truncated: repeated paragraph detected (${s}\xD7)]`,
      a = 0,
      l = -1,
      u = 0;
    for (; a < e; ) {
      let f = t.indexOf(r, u);
      if (f === -1) break;
      (a++, (l = f + r.length), (u = f + 1));
    }
    return {
      text: l > 0 ? t.slice(0, l) + i : t.slice(0, 2e3) + i,
      truncated: !0,
      repeatCount: s,
    };
  }
  var xa = null,
    ka = null,
    va = null;
  function Je() {
    if (xa === null) {
      let { TOOL_DEFINITIONS: t } = Et();
      xa = t;
    }
    return (
      ka === null && (ka = Ob()),
      va === null && (va = Cb()),
      [...xa, ...ka, ...va]
    );
  }
  var Ca = 50;
  function Ub(t) {
    Number.isFinite(t) && t > 0 && (Ca = t);
  }
  var fr = () => null;
  function Wb(t) {
    fr = t;
  }
  var Ws = null,
    Aa = null,
    ts = null,
    pr = new Map(),
    Bb = 1e4,
    Hb = 6e3,
    Gb =
      /\b((?:API|ACCESS|AUTH|BEARER|CLIENT|GITHUB|GITLAB|SLACK|STRIPE|TWILIO|SENDGRID|AWS|GCP|AZURE|OPENAI|ANTHROPIC|GEMINI|OLLAMA)[_A-Z0-9]*(?:KEY|TOKEN|SECRET|PASS(?:WORD)?|CREDENTIAL)[_A-Z0-9]*)\s*=\s*["']?([A-Za-z0-9\-_.+/=]{10,})["']?/g;
  function Kb(t) {
    return !t || typeof t != "string"
      ? t
      : t.replace(Gb, (e, n) => `${n}=***REDACTED***`);
  }
  var Yb = 7e3,
    zb = 4e3;
  function Xb(t, e = null) {
    let n = Kb(t),
      o = cb(n),
      s = e === "read_file" ? Yb : Bb,
      r = e === "read_file" ? zb : Hb;
    if (o > s)
      try {
        let { compressToolResult: i } = Qe();
        return i(n, r);
      } catch {
        return n;
      }
    return n;
  }
  function Qf(t) {
    try {
      let { getActiveModel: e } = Oe(),
        n = e(),
        o = n ? `${n.provider}:${n.id}` : "default";
      if (pr.has(o)) return pr.get(o);
      let s = Bf(t);
      return (pr.set(o, s), s);
    } catch {
      return Bf(t);
    }
  }
  function Jb() {
    pr.clear();
  }
  async function Zf() {
    try {
      let t = require("fs").promises,
        e = require("path"),
        n = [
          e.join(process.cwd(), "package.json"),
          e.join(process.cwd(), ".git", "HEAD"),
          e.join(process.cwd(), "README.md"),
          e.join(process.cwd(), "NEX.md"),
        ],
        s = (
          await Promise.allSettled(
            n.map((r) => t.stat(r).then((i) => `${r}:${i.mtimeMs}`)),
          )
        )
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value);
      try {
        let { getMemoryContextHash: r } = rn(),
          i = r();
        i && s.push(`memory:${i}`);
      } catch {}
      try {
        let r = e.join(process.cwd(), ".nex", "brain");
        if (Ia.existsSync(r)) {
          let i = await t.stat(r);
          s.push(`brain:${i.mtimeMs}`);
        }
      } catch {}
      return s.join("|");
    } catch {
      return `fallback:${Date.now()}`;
    }
  }
  function Oa() {
    ((Ws = null), (Aa = null), (ts = null));
  }
  var Vb = new Set(["spawn_agents"]),
    Sa = 5,
    Ea = 3,
    dr = 2,
    Qb = parseInt(process.env.NEX_STALE_WARN_MS || "60000", 10),
    Kf = parseInt(process.env.NEX_STALE_ABORT_MS || "120000", 10),
    Zb = process.env.NEX_STALE_AUTO_SWITCH !== "0";
  function e_(t) {
    try {
      let e = require("fs"),
        n = require("path"),
        o = n.join(process.cwd(), ".nex", "plans");
      e.existsSync(o) || e.mkdirSync(o, { recursive: !0 });
      let s = n.join(o, "current-plan.md");
      e.writeFileSync(s, t, "utf-8");
    } catch {}
  }
  wb((t) => {
    ($b(t, "allow"),
      yb(),
      console.log(`${$.green}  \u2713 ${t}: always allow${$.reset}`));
  });
  async function t_(t) {
    let e = t.function.name,
      n = ob(t.function.arguments),
      o = t.id || `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (!n) {
      let l = Je().find((d) => d.function.name === e),
        u = l ? JSON.stringify(l.function.parameters, null, 2) : "unknown";
      return (
        re(
          `${$.yellow}  \u26A0 ${e}: malformed arguments, sending schema hint${$.reset}`,
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
    let s = Mb(e, n);
    if (!s.valid)
      return (
        re(
          `${$.yellow}  \u26A0 ${e}: ${
            s.error.split(`
`)[0]
          }${$.reset}`,
        ),
        {
          callId: o,
          fnName: e,
          args: n,
          canExecute: !1,
          errorResult: { role: "tool", content: s.error, tool_call_id: o },
        }
      );
    let r = s.corrected || n;
    if (s.corrected) {
      let a = Object.keys(n),
        l = Object.keys(s.corrected),
        u = a.filter((d) => !l.includes(d));
      u.length &&
        console.log(
          `${$.dim}  \u2713 ${e}: corrected args (${u.join(", ")})${$.reset}`,
        );
    }
    if (Gs() && !Jf.has(e))
      return (
        console.log(`${$.yellow}  \u2717 ${e}: blocked in plan mode${$.reset}`),
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
    let i = gb(e);
    if (i === "deny")
      return (
        console.log(`${$.red}  \u2717 ${e}: denied by permissions${$.reset}`),
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
      let a = `  Allow ${e}?`;
      return (
        e === "bash" &&
          r.command &&
          (a = `  bash: \`${r.command.substring(0, 80)}${r.command.length > 80 ? "\u2026" : ""}\`?`),
        (await Xf(a, { toolName: e }))
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
  async function n_(t, e, n = {}) {
    let o = await Nb(t, e);
    if (o !== null) return o;
    let s = await Rb(t, e);
    return s !== null ? s : rb(t, e, n);
  }
  function s_(t, e) {
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
  async function Ta(t, e = !1) {
    e || console.log(eb(t.fnName, t.args));
    let n = qf("pre-tool", { tool_name: t.fnName });
    if (!e && n.length > 0)
      for (let h of n)
        h.success
          ? console.log(
              `${$.dim}  [hook pre-tool] ${h.command} \u2192 ${h.output || "ok"}${$.reset}`,
            )
          : console.log(
              `${$.yellow}  [hook pre-tool] ${h.command} \u2192 ERROR: ${h.error}${$.reset}`,
            );
    qt?.onToolStart && qt.onToolStart(t.fnName, t.args);
    let o = await n_(t.fnName, t.args, {
        silent: !0,
        autoConfirm: t.confirmedByUser === !0,
      }),
      s = String(o ?? ""),
      r =
        s.length > 5e4
          ? s.substring(0, 5e4) +
            `
...(truncated ${s.length - 5e4} chars)`
          : s,
      i = r.split(`
`)[0],
      a =
        i.startsWith("ERROR") ||
        i.includes("CANCELLED") ||
        i.includes("BLOCKED") ||
        (t.fnName === "spawn_agents" &&
          !/✓ Agent/.test(r) &&
          /✗ Agent/.test(r)),
      l = zf(t.fnName, t.args, r, a);
    (e || console.log(l), qt?.onToolEnd && qt.onToolEnd(t.fnName, l, !a));
    let u = qf("post-tool", { tool_name: t.fnName });
    if (!e && u.length > 0)
      for (let h of u)
        h.success
          ? console.log(
              `${$.dim}  [hook post-tool] ${h.command} \u2192 ${h.output || "ok"}${$.reset}`,
            )
          : console.log(
              `${$.yellow}  [hook post-tool] ${h.command} \u2192 ERROR: ${h.error}${$.reset}`,
            );
    let f = Xb(r, t.fnName);
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
  async function o_(t, e = !1, n = {}) {
    let o = new Array(t.length),
      s = [],
      r = [],
      i = null;
    if (e && !n.skipSpinner) {
      let l = t.filter((u) => u.canExecute);
      if (l.length > 0) {
        let u;
        if (l.length === 1) {
          let d = l[0],
            f = s_(d.fnName, d.args);
          u = `\u25CF ${d.fnName}${f ? `(${f})` : ""}`;
        } else {
          let d = l.map((f) => f.fnName).join(", ");
          u = `\u25CF ${l.length} tools: ${d.length > 60 ? d.substring(0, 57) + "\u2026" : d}`;
        }
        ((i = new Zn(u)), i.start());
      }
    }
    async function a() {
      if (r.length !== 0) {
        if (r.length === 1) {
          let l = r[0],
            { msg: u, summary: d } = await Ta(t[l], e);
          ((o[l] = u), s.push(d));
        } else {
          let l = r.map((d) => Ta(t[d], e)),
            u = await Promise.all(l);
          for (let d = 0; d < r.length; d++)
            ((o[r[d]] = u[d].msg), s.push(u[d].summary));
        }
        r = [];
      }
    }
    for (let l = 0; l < t.length; l++) {
      let u = t[l];
      if (!u.canExecute) {
        (await a(),
          (o[l] = u.errorResult),
          s.push(zf(u.fnName, u.args || {}, u.errorResult.content, !0)));
        continue;
      }
      if (Vb.has(u.fnName)) {
        (await a(), u.fnName === "spawn_agents" && i && (i.stop(), (i = null)));
        let { msg: d, summary: f } = await Ta(u, e);
        ((o[l] = d), s.push(f));
      } else r.push(l);
    }
    if ((await a(), i && i.stop(), e && s.length > 0 && !n.skipSummaries))
      for (let l of s) console.log(l);
    return { results: o, summaries: s };
  }
  var V = [],
    Yf = 300,
    ep = new Map(),
    tp = new Map(),
    Na = new Map(),
    Ma = new Map(),
    Bs = new Map(),
    np = new Map(),
    ns = new Map(),
    ss = new Map(),
    Nt = 0,
    Hs = 0,
    mr = 0,
    Pa = "",
    hr = 0,
    os = !1,
    gr = 0;
  function Qn(t, e) {
    t === Pa
      ? (hr++,
        mi().DEBUG &&
          process.stdout
            .write(`\x1B[1A\x1B[2K${e}  \u26A0 ${t} (\xD7${hr})${$.reset}
`))
      : ((Pa = t), (hr = 1), re(`${e}  \u26A0 ${t}${$.reset}`));
  }
  var $r = [];
  function r_(t) {
    $r.push(t.trim());
  }
  function i_() {
    return $r.length === 0
      ? null
      : $r.splice(0, $r.length).join(`
`);
  }
  function a_() {
    let t = process.env.NEX_LANGUAGE,
      e = process.env.NEX_CODE_LANGUAGE,
      n = process.env.NEX_COMMIT_LANGUAGE,
      o = !t || t === "auto" ? null : t,
      s = [
        `# Language Rules (CRITICAL \u2014 enforce strictly)
`,
      ];
    (o
      ? s.push(
          `RESPONSE LANGUAGE: You MUST always respond in ${o}. This overrides any language defaults from your training. Never output Chinese, Japanese, or any other language in your responses \u2014 even when summarizing or thinking. ${o} only.`,
        )
      : s.push(
          "RESPONSE LANGUAGE: Always respond in the same language as the user's message. If the user writes in German, respond in German; if in English, respond in English; etc.",
        ),
      s.push(
        "CODE EXAMPLES: Always show actual, working code examples \u2014 never pseudocode or placeholder snippets.",
      ),
      s.push("COMPLETENESS RULES:"),
      s.push(
        "  \u2022 ALWAYS show actual code when explaining implementations \u2014 never describe without showing",
      ),
      s.push(
        "  \u2022 FILE CREATION TASKS (Makefile, Dockerfile, config files): paste the COMPLETE file content in a fenced code block in your TEXT RESPONSE \u2014 writing a file with a tool does NOT make it visible. The fenced code block MUST appear in your response, not just via write_file.",
      ),
      s.push(
        "  \u2022 Include complete examples with full context (imports, function signatures, error handling)",
      ),
      s.push(
        '  \u2022 Show alternative approaches when relevant (e.g., "Alternative: use util.promisify instead")',
      ),
      s.push(
        "  \u2022 Include edge cases in explanations (empty input, null values, boundary conditions)",
      ),
      s.push(
        "  \u2022 Provide platform-specific guidance when commands differ by OS (Linux/macOS/Windows)",
      ),
      s.push(
        '  \u2022 For Makefiles, paste the COMPLETE Makefile code DIRECTLY in your text response \u2014 every target, recipe, dependency, and .PHONY line. Writing the Makefile with a tool does NOT count as showing it. The Makefile MUST appear verbatim in your chat text as a code block, even if you also wrote it to a file. Never describe structure without showing the actual code. CRITICAL: use EXACTLY the command specified \u2014 if the task says "runs jest", write "jest" in the recipe, NEVER "npm test". npm test is NOT jest. Recipes need real TAB indentation. ONE .PHONY line listing ALL phony targets.',
      ),
      s.push(
        "  \u2022 For dataclasses, paste the COMPLETE dataclass code DIRECTLY in your text response \u2014 @dataclass decorator, all fields with types and defaults, full __post_init__ validation. Writing the file with a tool does NOT count as showing the code. The code MUST appear verbatim in your chat text, even if you also wrote it to a file.",
      ),
      s.push(
        "  \u2022 For cron expressions, re-read the exact time boundaries in the task before writing. If asked for 8-18h, the range is 8,9,...,18 \u2014 write exactly what was asked, not an approximation.",
      ),
      s.push(
        '  \u2022 When a task explicitly specifies a tool (e.g., "use tsc"), NEVER mention alternatives (e.g., "swc build") \u2014 use exactly what was requested.',
      ),
      s.push(
        '  \u2022 In Makefile prerequisites, NEVER use shell glob patterns like src/**/*.ts \u2014 make does not expand these natively. Keep prerequisite lists explicit or omit them. When a Makefile target says "runs jest", call jest directly in the recipe (not npm test).',
      ),
      s.push(
        "  \u2022 For bash in-place text replacements with backups: use ONLY ONE backup method \u2014 either sed -i.bak (let sed create the backup) OR cp file file.bak followed by sed -i (no extension). Never use both cp and sed -i.bak together \u2014 that produces redundant double backups (file.bak and file.bak.bak).",
      ),
      s.push(
        "  \u2022 For iterative array-flattening (flattenDeep): use push() and reverse() at the end \u2014 NEVER unshift(). unshift is O(n) per call making the whole function O(n^2). The iterative version MUST use a loop (while/for) and an explicit stack array \u2014 zero recursive calls. If a function calls itself, it is recursive regardless of its name. Never label a recursive function as iterative.",
      ),
      s.push(
        "  \u2022 FORBIDDEN: when refactoring callbacks to async/await, NEVER write try { ... } catch(e) { throw e } \u2014 this is an explicit anti-pattern. WRONG: async function f() { try { const d = await readFile(..); await writeFile(.., d); } catch(e) { throw e; } } \u2014 RIGHT: async function f() { const d = await readFile(..); await writeFile(.., d); } \u2014 omit the try-catch entirely, let rejections propagate.",
      ),
      s.push(
        '  \u2022 Docker HEALTHCHECK: always include --start-period=30s (or appropriate startup time) so the container has time to initialise before failures are counted. Also note that curl may not be available in minimal Node.js images \u2014 offer wget or "node -e" as alternatives.',
      ),
      s.push(
        '  \u2022 When fixing a bash word-splitting bug like "for f in $(ls *.txt)": replace the entire $(ls *.txt) with a bare glob directly \u2014 "for f in *.txt". The fix is eliminating the ls command and $() subshell entirely. Emphasise this in the explanation: the glob in the for loop prevents word splitting because the shell expands the glob into separate words before the loop \u2014 there is no subshell output to split. CRITICAL: NEVER suggest "ls -N" or any ls variant as a fix \u2014 ls -N outputs filenames one per line, but word splitting still occurs on each line when used in a subshell expansion. The only correct fix is the bare glob pattern.',
      ));
    let r = e || "English";
    s.push(
      `CODE LANGUAGE: Write all code comments, docstrings, variable descriptions, and inline documentation in ${r}.`,
    );
    let i = n || "English";
    return (
      s.push(`COMMIT MESSAGES: Write all git commit messages in ${i}.`),
      o &&
        s.push(`
This is a hard requirement. Always respond in ${o}. Do NOT switch to any other language \u2014 even if the user writes to you in German, French, or any other language, your reply MUST be in ${o}.`),
      s.join(`
`) +
        `

`
    );
  }
  function c_() {
    if (ts !== null) return ts;
    try {
      let e = Ib().flatMap((s) =>
        s.models.map((r) => ({
          spec: `${s.name}:${r.id}`,
          tier: Pb(r.id, s.name),
          name: r.name,
        })),
      );
      if (e.length < 2) return ((ts = ""), "");
      let n = {
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
      for (let s of e)
        o += `| ${s.spec} | ${s.tier} | ${n[s.tier] || s.tier} |
`;
      return ((ts = o), o);
    } catch (t) {
      return (
        process.env.NEX_DEBUG &&
          console.error("[agent] model routing guide failed:", t.message),
        (ts = ""),
        ""
      );
    }
  }
  async function sp() {
    let t = await Zf();
    if (Ws !== null && t === Aa) return Ws;
    let e = await ib(process.cwd()),
      n = mb(),
      o = Ab(),
      s = Gs() ? _b() : "",
      r = a_(),
      i = hb();
    return (
      (Ws = `You are Nex Code, an expert coding assistant. You help with programming tasks by reading, writing, and editing files, running commands, and answering questions.

WORKING DIRECTORY: ${process.cwd()}
All relative paths resolve from this directory.
PROJECT CONTEXT:
${e}
${
  n
    ? `
${n}
`
    : ""
}${
        o
          ? `
${o}
`
          : ""
      }${
        s
          ? `
${s}
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
        bb()
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
  \u2022 For regex character classes with numeric ranges: after writing the expression, re-read the task requirement and verify each range boundary matches exactly. Common pitfalls: "8 to 18" \u2192 [8-9]|1[0-8] not [8-17]; hour ranges are 0-23, month ranges are 1-12, day ranges are 1-31. Count the values your range covers and compare to the requirement before finalizing.

- Use markdown formatting: **bold** for key points, headers for sections, bullet lists for multiple items, \`code\` for identifiers. The terminal renders markdown with syntax highlighting.
- Structure longer responses with headers (## Section) so the user can scan quickly.

Response patterns by request type:
- **Questions / analysis / "status" / "explain" / "what is"**: Gather data with tools, then respond with a clear, structured summary. NEVER just run tools and stop.
- **Coding tasks (implement, fix, refactor)**: Brief confirmation of what you'll do, then use tools. After changes, summarize what you did and any important details. When diagnosing a bug (memory leak, race condition, logic error): always proceed from diagnosis to concrete fix \u2014 write the corrected code and apply it. Do not stop after identifying the root cause unless the user explicitly asked for analysis only.
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
- MANDATORY FINAL RESPONSE: When your task is complete, you MUST write at least 2 sentences summarizing (1) what you changed, (2) why you changed it, and (3) what the expected impact is. Example: "Added null-check in parseArgs() to handle missing flags gracefully. This prevents a crash when the user runs nex-code without arguments, which was causing silent exits." NEVER end with just "Done", "Done.", "Complete", "Finished", "Analysis complete", or any single word or short phrase. A bare one-liner is a quality failure \u2014 always write a substantive closing paragraph.

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
${c_()}

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
      (Aa = t),
      Ws
    );
  }
  function l_() {
    ((V = []),
      ep.clear(),
      tp.clear(),
      Na.clear(),
      Ma.clear(),
      Bs.clear(),
      np.clear(),
      ns.clear(),
      ss.clear(),
      (Nt = 0),
      (Hs = 0),
      (mr = 0),
      (os = !1),
      (gr = 0),
      (Pa = ""),
      (hr = 0));
  }
  function u_() {
    V.length > Yf && V.splice(0, V.length - Yf);
  }
  function d_() {
    return V.length;
  }
  function f_() {
    return V;
  }
  function p_(t) {
    V = t;
  }
  async function m_() {
    let { execFile: t } = require("child_process"),
      e = require("fs"),
      n = process.cwd(),
      o = (f, m) =>
        new Promise((h) => {
          t(f, m, { cwd: n, timeout: 3e3 }, (p, g) => {
            h(p ? "" : (g || "").trim());
          });
        }),
      [s] = await Promise.all([
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
        s
          ? s.split(`
`)
          : []
      ).filter((f) => {
        let m = f.split(".").pop();
        return r.has(m);
      });
    if (i.length < 3) return null;
    let a = {};
    for (let f of i) {
      let m = f.split(".").pop();
      a[m] = (a[m] || 0) + 1;
    }
    let u = `  \u{1F4C1} ${Object.entries(a)
        .sort((f, m) => m[1] - f[1])
        .slice(0, 4)
        .map(([f, m]) => `${m} .${f}`)
        .join(" \xB7 ")}`,
      d = La.join(n, "package.json");
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
  function h_(t) {
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
  function We(t, e, n, o, s, { suppressHint: r = !1 } = {}) {
    if (t < 1) return;
    let i = [...e.values()].reduce((u, d) => u + d, 0),
      a = `\u2500\u2500 ${t} ${t === 1 ? "step" : "steps"} \xB7 ${i} ${i === 1 ? "tool" : "tools"}`,
      l = 0;
    if (s) {
      let u = Date.now() - s;
      ((l = Math.round(u / 1e3)),
        (a +=
          l >= 60 ? ` \xB7 ${Math.floor(l / 60)}m ${l % 60}s` : ` \xB7 ${l}s`));
    }
    if (
      (n.size > 0 &&
        (a += ` \xB7 ${n.size} ${n.size === 1 ? "file" : "files"} modified`),
      (a += " \u2500\u2500"),
      console.log(`
${$.dim}  ${a}${$.reset}`),
      l >= 30 && process.stdout.isTTY)
    ) {
      let u =
        n.size > 0
          ? `Done \u2014 ${n.size} ${n.size === 1 ? "file" : "files"} modified in ${l}s`
          : `Done \u2014 ${t} ${t === 1 ? "step" : "steps"} in ${l}s`;
      h_(u);
    }
    n.size > 0
      ? console.log(
          `${$.dim}  \u{1F4A1} /diff \xB7 /commit \xB7 /undo${$.reset}`,
        )
      : !r && o.size >= 5 && n.size === 0 && t >= 3
        ? console.log(
            `${$.dim}  \u{1F4A1} Found issues? Say "fix 1" or "apply all fixes"${$.reset}`,
          )
        : o.size > 0 &&
          t >= 2 &&
          console.log(`${$.dim}  \u{1F4A1} /save \xB7 /clear${$.reset}`);
  }
  async function g_() {
    if (!process.stdout.isTTY) return { action: "quit" };
    let t = es(),
      e = Tn(),
      n = yr.fast?.[t],
      o = yr.strong?.[t],
      s = n && n !== e,
      r = o && o !== e && o !== n,
      i = [];
    (i.push({
      key: "r",
      label: `Retry with current model ${$.dim}(${e})${$.reset}`,
    }),
      s &&
        i.push({
          key: "f",
          label: `Switch to ${$.bold}${n}${$.reset} ${$.dim}\u2014 fast, low latency${$.reset}`,
          model: n,
        }),
      r &&
        i.push({
          key: "s",
          label: `Switch to ${$.bold}${o}${$.reset} ${$.dim}\u2014 reliable tool-calling, medium speed${$.reset}`,
          model: o,
        }),
      i.push({ key: "q", label: `${$.dim}Quit${$.reset}` }),
      console.log(),
      console.log(
        `${$.yellow}  Stream stale \u2014 all retries exhausted.${$.reset} What would you like to do?`,
      ));
    for (let a of i) console.log(`  ${$.cyan}[${a.key}]${$.reset} ${a.label}`);
    return (
      process.stdout.write(`  ${$.yellow}> ${$.reset}`),
      new Promise((a) => {
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
              return a({ action: "quit" });
            let p = i.find((g) => g.key === h);
            !p || p.key === "q" || (!p.model && p.key !== "r")
              ? a({ action: "quit" })
              : p.key === "r"
                ? a({ action: "retry" })
                : a({ action: "switch", model: p.model, provider: t });
          };
        l.on("data", f);
      })
    );
  }
  var qt = null;
  async function $_(t, e = null, n = {}) {
    qt = e;
    let o = Vf(t);
    (V.push({ role: "user", content: o }), u_());
    let s = n.autoOrchestrate || process.env.NEX_AUTO_ORCHESTRATE === "true",
      r = parseInt(process.env.NEX_ORCHESTRATE_THRESHOLD || "3", 10);
    try {
      let { detectComplexPrompt: qe, runOrchestrated: Ne } = Us(),
        Fe = qe(typeof t == "string" ? t : "");
      if (s && Fe.isComplex && Fe.estimatedGoals >= r)
        return (
          console.log(
            `${$.yellow}\u26A1 Auto-orchestrate: ${Fe.estimatedGoals} goals \u2192 parallel agents${$.reset}`,
          ),
          await Ne(t, {
            orchestratorModel:
              n.orchestratorModel || process.env.NEX_ORCHESTRATOR_MODEL,
            workerModel: n.model,
          })
        );
      Fe.isComplex &&
        console.log(
          `${$.dim}Hint: ~${Fe.estimatedGoals} goals. Try --auto-orchestrate for parallel execution.${$.reset}`,
        );
    } catch {}
    let { setOnChange: i } = Bo(),
      a = null,
      l = 0;
    i((qe, Ne) => {
      qe === "create"
        ? (a && a.stop(),
          (a = new Z0(Ne.name, Ne.tasks)),
          a.setStats({ tokens: l }),
          a.start())
        : qe === "update" && a
          ? a.updateTask(Ne.id, Ne.status)
          : qe === "clear" && a && (a.stop(), (a = null));
    });
    let u = await sp(),
      d = u;
    try {
      let { getBrainContext: qe } = Rs(),
        Ne = await qe(t);
      Ne &&
        (d =
          u +
          `
` +
          Ne +
          `
`);
    } catch (qe) {
      process.env.NEX_DEBUG &&
        console.error("[agent] brain context failed:", qe.message);
    }
    let f = [{ role: "system", content: d }, ...V],
      m = new Zn("Thinking...");
    m.start();
    let p = V.length === 1 ? m_().catch(() => null) : Promise.resolve(null),
      g = Je(),
      [{ messages: y, compressed: w, compacted: k, tokensRemoved: R }, x] =
        await Promise.all([ab(f, g), p]),
      _ = Ot(f, g);
    if ((m.stop(), x && console.log(`${$.dim}${x}${$.reset}`), k))
      console.log(
        `${$.dim}  [context compacted \u2014 summary (~${R} tokens freed)]${$.reset}`,
      );
    else if (w) {
      let qe = _.limit > 0 ? Math.round((R / _.limit) * 100) : 0;
      re(
        `${$.dim}  [context compressed \u2014 ~${R} tokens freed (${qe}%)]${$.reset}`,
      );
    }
    _.percentage > 85 &&
      re(
        `${$.yellow}  \u26A0 Context ${Math.round(_.percentage)}% used (${Math.round(100 - _.percentage)}% remaining) \u2014 consider /clear or /save + start fresh${$.reset}`,
      );
    let b = y;
    if (Ot(b, Je()).percentage >= 65) {
      let { messages: Ne, tokensRemoved: Fe } = jt(b, Je());
      Fe > 0 &&
        ((b = Ne),
        console.log(
          `${$.dim}  [pre-flight compress \u2014 ${Fe} tokens freed, now ${Math.round(Ot(b, Je()).percentage)}% used]${$.reset}`,
        ));
    }
    let O = 0,
      N = 0,
      C = 0,
      L = 0,
      Ee = 0,
      me = 9,
      le = 0,
      ie = (() => {
        let qe = V.find((Ne) => Ne.role === "user");
        return typeof qe?.content == "string" ? qe.content : "";
      })(),
      oe =
        /set_reminder|google.?auth|cron:|api\.log|jarvis.{0,30}(fehler|error|fail|broken|crash|nicht.{0,10}(funktioniert|läuft)|debug)|(?:fehler|error|crash|broken).{0,30}jarvis/i.test(
          ie,
        ),
      ce = 0,
      Q = 0,
      E = new Map(),
      M = new Set(),
      U = new Set(),
      G = Date.now(),
      ne = new nb(Lb),
      I = np,
      W = 2,
      se = 4,
      X = ep,
      Z = 5,
      he = 8,
      pe = tp,
      we = 4,
      be = 7,
      je = Na,
      Ge = 3,
      Jt = 4,
      On = Ma,
      Pr = 2,
      km = 3,
      cn = 0,
      vm = 6,
      Sm = 10,
      ln = 0,
      dc = 5,
      un = 0,
      Em = 2,
      Tm = 3,
      Ir = 0,
      Lr = 8,
      Rm = 12,
      dt,
      oo = Ca,
      Dr = 0,
      fc = 3,
      jr = !1;
    e: for (;;) {
      for (jr = !1, dt = 0; dt < oo && !fr()?.aborted; dt++) {
        {
          let S = Je(),
            v = Ot(b, S),
            J = Q === 0 ? 65 : 78;
          if (v.percentage >= J) {
            let { messages: j, tokensRemoved: z } = jt(b, S, Q === 0);
            z > 0 &&
              ((b = j),
              z > 50 &&
                console.log(
                  `${$.dim}  [auto-compressed \u2014 ~${z} tokens freed, now ${Math.round(Ot(b, S).percentage)}%]${$.reset}`,
                ));
          }
        }
        let Ne = !0;
        Q > 0 && Sb();
        let Fe = null;
        if (a && a.isActive()) a._paused && a.resume();
        else if (!a) {
          let S,
            v = Eb();
          if (v && v.total > 1) {
            let J =
              v.description.length > 40
                ? v.description.slice(0, 37) + "\u2026"
                : v.description;
            S = `Plan step ${v.current}/${v.total}: ${J}`;
          } else S = Q > 0 ? `Thinking... (step ${Q + 1})` : "Thinking...";
          ((Fe = new Zn(S)), Fe.start());
        }
        let qr = !0,
          Ft = "",
          Fr = !1,
          ft = new Tb(),
          Pt,
          Ur = Date.now(),
          ro = !1,
          Wr = new AbortController(),
          pc = setInterval(() => {
            let S = Date.now() - Ur;
            if (S >= Kf)
              (ft._clearCursorLine(),
                re(
                  `${$.yellow}  \u26A0 Stream stale for ${Math.round(S / 1e3)}s \u2014 aborting and retrying${$.reset}`,
                ),
                Wr.abort());
            else if (S >= Qb && !ro) {
              ((ro = !0), ft._clearCursorLine());
              let v = yr.fast?.[es()],
                J = C > 0 ? ` (retry ${C + 1}/${dr})` : "",
                j = Math.round((Kf - S) / 1e3);
              (re(
                `${$.yellow}  \u26A0 No tokens received for ${Math.round(S / 1e3)}s \u2014 waiting...${J}${$.reset}`,
              ),
                v && v !== Tn()
                  ? console.log(
                      `${$.dim}  \u{1F4A1} Will auto-switch to ${v} in ~${j}s if no tokens arrive${$.reset}`,
                    )
                  : console.log(
                      `${$.dim}  \u{1F4A1} Ctrl+C to abort \xB7 auto-abort in ~${j}s${$.reset}`,
                    ));
            }
          }, 5e3),
          bt = "",
          Ut = null;
        try {
          let S = Qf(Je()),
            v = Gs() ? S.filter((z) => Jf.has(z.function.name)) : S,
            J = fr(),
            j = new AbortController();
          (J && J.addEventListener("abort", () => j.abort(), { once: !0 }),
            Wr.signal.addEventListener("abort", () => j.abort(), { once: !0 }),
            (Pt = await sb(b, v, {
              signal: j.signal,
              onThinkingToken: () => {
                ((Ur = Date.now()),
                  (ro = !1),
                  qt?.onThinkingToken && qt.onThinkingToken());
              },
              onToken: (z) => {
                if (((Ur = Date.now()), (ro = !1), qt?.onToken)) {
                  (qt.onToken(z), (Ft += z));
                  return;
                }
                if (
                  ((Ft += z),
                  !Fr && Ft.length > 400 && Ft.length % 250 < z.length + 1)
                ) {
                  let ue = Ra(Ft, 3);
                  ue.truncated &&
                    ((Fr = !0),
                    ft._clearCursorLine?.(),
                    re(
                      `${$.yellow}  \u26A0 LLM stream loop detected (${ue.repeatCount}\xD7 repeated) \u2014 suppressing display${$.reset}`,
                    ));
                }
                Fr ||
                  ((bt += z),
                  process.stdout.isTTY
                    ? Ut ||
                      (Ut = setTimeout(() => {
                        (bt && ft && ft.push(bt), (bt = ""), (Ut = null));
                      }, 50))
                    : (ft.push(bt), (bt = "")),
                  qr &&
                    (a && !a._paused ? a.pause() : Fe && Fe.stop(),
                    Ne || (Ne = !0),
                    ft.startCursor(),
                    (qr = !1)));
              },
            })));
        } catch (S) {
          if (
            (clearInterval(pc),
            Ut && (clearTimeout(Ut), (Ut = null)),
            bt && ft && (ft.push(bt), (bt = "")),
            a && !a._paused && a.pause(),
            Fe && Fe.stop(),
            ft.stopCursor(),
            Wr.signal.aborted && !fr()?.aborted)
          ) {
            if ((C++, C > dr)) {
              if (L < 1) {
                (L++,
                  Qn(
                    "Stale retries exhausted \u2014 last-resort force-compress...",
                    $.yellow,
                  ));
                let D = Je(),
                  { messages: B, tokensRemoved: ee } = jt(b, D);
                ((b = B),
                  ee > 50 &&
                    re(
                      `${$.dim}  [force-compressed \u2014 ~${ee} tokens freed]${$.reset}`,
                    ),
                  (C = 0),
                  dt--);
                continue;
              }
              a && (a.stop(), (a = null));
              let ue = await g_();
              if (ue.action === "quit") {
                (i(null), We(Q, E, M, U, G), Ue(V));
                break;
              }
              (ue.action === "switch" &&
                (Hf(`${ue.provider}:${ue.model}`),
                console.log(
                  `${$.green}  \u2713 Switched to ${ue.provider}:${ue.model}${$.reset}`,
                )),
                (C = 0),
                dt--);
              continue;
            }
            let j = C === 1 ? 3e3 : 5e3;
            if (C >= 1 && le < 1) {
              (le++,
                Qn(
                  `Stale retry ${C}/${dr} \u2014 force-compressing before retry...`,
                  $.yellow,
                ));
              let ue = Je(),
                { messages: D, tokensRemoved: B } = jt(b, ue, !0);
              if (
                ((b = D),
                B > 0 &&
                  B > 50 &&
                  re(
                    `${$.dim}  [force-compressed \u2014 ~${B} tokens freed]${$.reset}`,
                  ),
                Zb)
              ) {
                let ee = yr.fast?.[es()];
                ee &&
                  ee !== Tn() &&
                  (Hf(`${es()}:${ee}`),
                  console.log(
                    `${$.cyan}  \u26A1 Auto-switched to ${ee} to avoid further stale timeouts${$.reset}`,
                  ),
                  console.log(
                    `${$.dim}  (disable with NEX_STALE_AUTO_SWITCH=0)${$.reset}`,
                  ));
              }
            } else
              re(
                `${$.yellow}  \u26A0 Stale retry ${C}/${dr} \u2014 retrying in ${j / 1e3}s...${$.reset}`,
              );
            let z = new Zn(`Waiting ${j / 1e3}s before retry...`);
            (z.start(),
              await new Promise((ue) => setTimeout(ue, j)),
              z.stop(),
              dt--);
            continue;
          }
          if (
            S.name === "AbortError" ||
            S.name === "CanceledError" ||
            S.message?.includes("canceled") ||
            S.message?.includes("aborted")
          ) {
            (a && (a.stop(), (a = null)), i(null), We(Q, E, M, U, G), Ue(V));
            break;
          }
          let v = S.message;
          if (S.code === "ECONNREFUSED" || S.message.includes("ECONNREFUSED"))
            v =
              "Connection refused \u2014 please check your internet connection or API endpoint";
          else if (S.code === "ENOTFOUND" || S.message.includes("ENOTFOUND"))
            v =
              "Network error \u2014 could not reach the API server. Please check your connection";
          else if (S.code === "ETIMEDOUT" || S.message.includes("timeout"))
            v =
              "Request timed out \u2014 the API server took too long to respond. Please try again";
          else if (
            S.message.includes("401") ||
            S.message.includes("Unauthorized")
          )
            v =
              "Authentication failed \u2014 please check your API key in the .env file";
          else if (S.message.includes("403") || S.message.includes("Forbidden"))
            v =
              "Access denied \u2014 your API key may not have permission for this model";
          else if (S.message.includes("404")) {
            ((v = `Model not found (404): ${Tn ? Tn() : "unknown"} \u2014 check your .env MODEL setting or run /models to list available models`),
              console.log(`${$.red}  \u2717 ${v}${$.reset}`),
              a && (a.stop(), (a = null)),
              i(null),
              We(Q, E, M, U, G),
              Ue(V));
            break;
          } else if (S.message.includes("400")) {
            if (L < 3 && Ee < me) {
              (L++, Ee++);
              let j = Q === 0 && L === 1,
                z = j || L === 3 || le > 0;
              if (j) {
                L = 3;
                let ee = S.message
                  .replace(/^API Error(\s*\[HTTP \d+\])?:\s*/i, "")
                  .slice(0, 150);
                Qn(
                  `Bad request (400) \u2014 ${ee || "system prompt too large"}, compressing...`,
                  $.yellow,
                );
              } else
                Qn(
                  z
                    ? `Bad request (400) \u2014 nuclear compression (attempt ${L}/3, dropping history)...`
                    : `Bad request (400) \u2014 force-compressing and retrying... (attempt ${L}/3)`,
                  $.yellow,
                );
              let ue = Je(),
                { messages: D, tokensRemoved: B } = jt(b, ue, z);
              ((b = D),
                B > 50 &&
                  re(
                    `${$.dim}  [force-compressed \u2014 ~${B} tokens freed]${$.reset}`,
                  ),
                dt--);
              continue;
            }
            {
              let j = b.find((de) => de.role === "system"),
                z = b.find(
                  (de) =>
                    de.role === "user" &&
                    !String(de.content).startsWith("[SYSTEM") &&
                    !String(de.content).startsWith("BLOCKED:"),
                ),
                ue = [j, z].filter(Boolean),
                { getUsage: D } = Qe(),
                B = Qe().estimateMessagesTokens(ue),
                ee = Qe().estimateMessagesTokens(b);
              if (B < ee) {
                let de = [],
                  ge = V.filter(
                    (fe) =>
                      fe.role === "assistant" &&
                      typeof fe.content == "string" &&
                      fe.content.trim().length > 30,
                  )
                    .slice(-3)
                    .map((fe) =>
                      fe.content.trim().slice(0, 120).replace(/\n+/g, " "),
                    );
                ge.length > 0 &&
                  de.push(
                    `Key findings:
` +
                      ge.map((fe) => `- ${fe}`).join(`
`),
                  );
                let Ie = V.filter(
                  (fe) =>
                    fe.role === "tool" &&
                    typeof fe.content == "string" &&
                    !fe.content.startsWith("BLOCKED:") &&
                    fe.content.trim().length > 10,
                )
                  .slice(-3)
                  .map((fe) =>
                    fe.content
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
                  (Ie.length > 0 &&
                    de.push(
                      `Tool results summary:
` +
                        Ie.map((fe) => `- ${fe}`).join(`
`),
                    ),
                  M.size > 0)
                ) {
                  let fe = [...M]
                    .map((pt) => pt.split("/").slice(-2).join("/"))
                    .join(", ");
                  de.unshift(
                    `Already modified: ${fe} \u2014 use edit_file to add missing pieces only, DO NOT use write_file on these files.`,
                  );
                }
                if (de.length > 0) {
                  let fe = {
                    role: "user",
                    content: `[SYSTEM: Findings from investigation before context wipe]
${de.join(`
`)}
Continue implementing the fixes based on these findings.`,
                  };
                  ue.push(fe);
                }
                if (Hs >= 3) {
                  let fe =
                    M.size > 0
                      ? `
Files modified so far: ${[...M].map((pt) => pt.split("/").slice(-1)[0]).join(", ")}`
                      : "";
                  (re(
                    `${$.red}  \u2717 Super-nuclear limit reached (3\xD7) \u2014 aborting to prevent runaway context loop${$.reset}`,
                  ),
                    console.log(
                      `${$.yellow}  \u{1F4A1} Task may exceed model context. Try /clear and break it into smaller steps.${fe ? $.dim + fe : ""}${$.reset}`,
                    ),
                    a && (a.stop(), (a = null)),
                    i(null),
                    We(Q, E, M, U, G, { suppressHint: !0 }),
                    Ue(V));
                  break;
                }
                if (
                  ((b = ue),
                  Hs++,
                  (Nt = 0),
                  (ce = 0),
                  Ma.clear(),
                  ns.clear(),
                  ss.clear(),
                  Na.clear(),
                  Qn(
                    `Super-nuclear compression \u2014 dropped all history, keeping original task only (${ee - B} tokens freed)`,
                    $.yellow,
                  ),
                  Hs >= 1)
                ) {
                  let fe = {
                    role: "user",
                    content: `[SYSTEM WARNING] Context wiped ${Hs}\xD7. SKIP investigation \u2014 implement directly using findings above. Max 5 tool calls total, then finish.

CRITICAL: If you must re-read a file, use line_start/line_end to read ONLY the section you need (e.g. last 50 lines). Never read a full large file again \u2014 that is what caused the context overflow.`,
                  };
                  (V.push(fe), b.push(fe));
                }
                ((L = 0), dt--);
                continue;
              }
            }
            v =
              "Context too large to compress \u2014 use /clear to start fresh";
          } else
            S.message.includes("500") ||
            S.message.includes("502") ||
            S.message.includes("503") ||
            S.message.includes("504")
              ? (v =
                  "API server error \u2014 the provider is experiencing issues. Please try again in a moment")
              : (S.message.includes("fetch failed") ||
                  S.message.includes("fetch")) &&
                (v =
                  "Network request failed \u2014 please check your internet connection");
          if (
            (console.log(`${$.red}  \u2717 ${v}${$.reset}`),
            S.message.includes("429"))
          ) {
            if ((O++, O > Sa)) {
              (console.log(
                `${$.red}  Rate limit: max retries (${Sa}) exceeded. Try again later or use /budget to check your limits.${$.reset}`,
              ),
                a && (a.stop(), (a = null)),
                i(null),
                We(Q, E, M, U, G),
                Ue(V));
              break;
            }
            let j = Math.min(1e4 * Math.pow(2, O - 1), 12e4),
              z = new Zn(
                `Rate limit \u2014 waiting ${Math.round(j / 1e3)}s (retry ${O}/${Sa})`,
              );
            (z.start(), await new Promise((ue) => setTimeout(ue, j)), z.stop());
            continue;
          }
          if (
            S.message.includes("socket disconnected") ||
            S.message.includes("TLS") ||
            S.message.includes("ECONNRESET") ||
            S.message.includes("ECONNABORTED") ||
            S.message.includes("ETIMEDOUT") ||
            S.code === "ECONNRESET" ||
            S.code === "ECONNABORTED"
          ) {
            if ((N++, N > Ea)) {
              (console.log(
                `${$.red}  Network error: max retries (${Ea}) exceeded. Check your connection and try again.${$.reset}`,
              ),
                a && (a.stop(), (a = null)),
                i(null),
                We(Q, E, M, U, G),
                Ue(V));
              break;
            }
            let j = Math.min(2e3 * Math.pow(2, N - 1), 3e4),
              z = new Zn(
                `Network error \u2014 retrying in ${Math.round(j / 1e3)}s (${N}/${Ea})`,
              );
            (z.start(),
              await new Promise((ue) => setTimeout(ue, j)),
              z.stop(),
              dt--);
            continue;
          }
          (a && (a.stop(), (a = null)), i(null), We(Q, E, M, U, G), Ue(V));
          break;
        }
        if (
          (clearInterval(pc),
          (O = 0),
          (N = 0),
          qr && (a && !a._paused && a.pause(), Fe && Fe.stop()),
          Ut && (clearTimeout(Ut), (Ut = null)),
          bt && ft && (ft.push(bt), (bt = "")),
          Ft && ft.flush(),
          (N = 0),
          (C = 0),
          Pt && Pt.usage)
        ) {
          let S = Pt.usage.prompt_tokens || 0,
            v = Pt.usage.completion_tokens || 0;
          (Ff(es(), Tn(), S, v), (l += S + v), a && a.setStats({ tokens: l }));
        } else if (Pt && !Pt.usage) {
          let S = b
              .map((j) =>
                typeof j.content == "string"
                  ? j.content
                  : Array.isArray(j.content)
                    ? j.content
                        .map((z) => (typeof z == "string" ? z : z.text || ""))
                        .join("")
                    : "",
              )
              .join(" "),
            v = Wf(S),
            J = Wf(Pt.content || Ft || "");
          (Ff(es(), Tn(), v, J), (l += v + J), a && a.setStats({ tokens: l }));
        }
        let { content: mc, tool_calls: dn } = Pt,
          io = Ra(mc || ""),
          hc = io.truncated ? io.text : mc;
        io.truncated &&
          re(
            `${$.yellow}  \u26A0 LLM output loop detected (${io.repeatCount}\xD7 repeated paragraph) \u2014 response truncated${$.reset}`,
          );
        let ao = Fb(hc || ""),
          co = ao.truncated ? ao.text : hc;
        ao.truncated &&
          re(
            `${$.yellow}  \u26A0 LLM output loop detected (${ao.repeatCount}\xD7 repeated window) \u2014 response truncated${$.reset}`,
          );
        let Br = { role: "assistant", content: co || "" };
        if (
          (dn && dn.length > 0 && (Br.tool_calls = dn),
          V.push(Br),
          b.push(Br),
          !dn || dn.length === 0)
        ) {
          let S = (co || "").trim().length > 0 || Ft.trim().length > 0,
            v = !1;
          if ((os && S && ((os = !1), (Nt = 0), (v = !0)), v && S)) {
            let J = (co || "").trim();
            if (
              J.endsWith("?") ||
              /\b(Wo |Bitte |Kannst du|Soll ich)\b/.test(J.slice(-200))
            ) {
              let z = {
                role: "user",
                content:
                  "[SYSTEM] Continue. Do not ask questions \u2014 implement the fix yourself using SSH. The server is at 94.130.37.43.",
              };
              (b.push(z), V.push(z));
              continue;
            }
          }
          if (!S && Q > 0 && dt < Ca - 1) {
            let J = {
              role: "user",
              content:
                "[SYSTEM] You ran tools but produced no visible output. The user CANNOT see tool results \u2014 only your text. Please summarize your findings now.",
            };
            (b.push(J), V.push(J));
            continue;
          }
          if (Gs() && S && Q === 0)
            if ((mr++, mr > 2))
              re(
                `${$.yellow}  \u26A0 Plan accepted despite no file reads (rejection loop cap reached)${$.reset}`,
              );
            else {
              let J = {
                role: "user",
                content: `[SYSTEM] You wrote a plan without reading any files. This plan may be based on incorrect assumptions (wrong database type, wrong file structure, etc.).

MANDATORY: Use read_file, glob, or grep to investigate the actual codebase first. Read at least the relevant module file and route file before writing the plan.`,
              };
              (V.push(J),
                b.push(J),
                re(
                  `${$.yellow}  \u26A0 Plan rejected (${mr}/2): no files read \u2014 forcing investigation${$.reset}`,
                ));
              continue;
            }
          if (Gs() && S) {
            let J = (co || Ft || "").trim();
            (xb(J), e_(J));
            let j = kb(J);
            if (j.length > 0) {
              let z = V.find((ee) => ee.role === "user"),
                ue =
                  typeof z?.content == "string"
                    ? z.content.slice(0, 120)
                    : "Task";
              vb(ue, j);
              let D = j.length === 1 ? "step" : "steps",
                B = !1;
              if (process.stdout.isTTY && process.stdin.isTTY) {
                let {
                  approvePlan: ee,
                  startExecution: de,
                  setPlanMode: ge,
                } = Dt();
                process.stdout.write(`
${$.cyan}${$.bold}Plan ready${$.reset} ${$.dim}(${j.length} ${D})${$.reset}  ${$.green}[A]${$.reset}${$.dim}pprove${$.reset}  ${$.yellow}[E]${$.reset}${$.dim}dit${$.reset}  ${$.red}[R]${$.reset}${$.dim}eject${$.reset}  ${$.dim}[\u21B5 = approve]:${$.reset} `);
                let Ie = process.stdin.isRaw,
                  fe = await new Promise((pt) => {
                    try {
                      process.stdin.setRawMode(!0);
                    } catch {}
                    (process.stdin.resume(),
                      process.stdin.once("data", (lo) => {
                        try {
                          process.stdin.setRawMode(Ie || !1);
                        } catch {}
                        let Gr = lo.toString().toLowerCase()[0] || "\r";
                        pt(Gr);
                      }));
                  });
                if (
                  (process.stdout.write(`
`),
                  fe === "r")
                )
                  console.log(
                    `${$.red}Plan rejected.${$.reset} Ask follow-up questions to refine.`,
                  );
                else if (fe === "e")
                  console.log(
                    `${$.yellow}Type /plan edit to open in editor, or give feedback.${$.reset}`,
                  );
                else if (ee()) {
                  (de(),
                    ge(!1),
                    Oa(),
                    console.log(
                      `${$.green}${$.bold}Approved!${$.reset} Executing ${j.length} ${D}...`,
                    ));
                  let pt = `[PLAN APPROVED \u2014 EXECUTE NOW]

Implement the following plan step by step. All tools are now available.

${J}`;
                  (V.push({ role: "user", content: pt }),
                    b.push({ role: "user", content: pt }),
                    (B = !0));
                }
              } else
                console.log(`
${$.cyan}${$.bold}Plan ready${$.reset} ${$.dim}(${j.length} ${D} extracted).${$.reset} Type ${$.cyan}/plan approve${$.reset}${$.dim} to execute, or ${$.reset}${$.cyan}/plan edit${$.reset}${$.dim} to review.${$.reset}`);
              if (B) {
                (a && (a.stop(), (a = null)), dt--);
                continue;
              }
            } else {
              let z = !1;
              if (process.stdout.isTTY && process.stdin.isTTY) {
                let {
                  approvePlan: ue,
                  startExecution: D,
                  setPlanMode: B,
                } = Dt();
                process.stdout.write(`
${$.cyan}${$.bold}Plan ready.${$.reset}  ${$.green}[A]${$.reset}${$.dim}pprove${$.reset}  ${$.red}[R]${$.reset}${$.dim}eject${$.reset}  ${$.dim}[\u21B5 = approve]:${$.reset} `);
                let ee = process.stdin.isRaw,
                  de = await new Promise((ge) => {
                    try {
                      process.stdin.setRawMode(!0);
                    } catch {}
                    (process.stdin.resume(),
                      process.stdin.once("data", (Ie) => {
                        try {
                          process.stdin.setRawMode(ee || !1);
                        } catch {}
                        ge(Ie.toString().toLowerCase()[0] || "\r");
                      }));
                  });
                if (
                  (process.stdout.write(`
`),
                  de === "r")
                )
                  console.log(
                    `${$.red}Plan rejected.${$.reset} Ask follow-up questions to refine.`,
                  );
                else if (ue()) {
                  (D(),
                    B(!1),
                    Oa(),
                    console.log(
                      `${$.green}${$.bold}Approved!${$.reset} Executing...`,
                    ));
                  let Ie = `[PLAN APPROVED \u2014 EXECUTE NOW]

Implement the following plan step by step. All tools are now available.

${getPlanContent() || Pt.content}`;
                  (V.push({ role: "user", content: Ie }),
                    b.push({ role: "user", content: Ie }),
                    (z = !0));
                }
              } else
                console.log(`
${$.cyan}${$.bold}Plan ready.${$.reset} ${$.dim}Type ${$.reset}${$.cyan}/plan approve${$.reset}${$.dim} to execute, or ask follow-up questions to refine.${$.reset}`);
              if (z) {
                (a && (a.stop(), (a = null)), dt--);
                continue;
              }
            }
          }
          (a && (a.stop(), (a = null)),
            i(null),
            We(Q, E, M, U, G),
            Ue(V),
            jf(V));
          return;
        }
        (Q++, Q >= 1 && (Ne = !1));
        for (let S of dn) {
          let v = S.function.name;
          E.set(v, (E.get(v) || 0) + 1);
        }
        let Pe = await Promise.all(dn.map((S) => t_(S)));
        {
          let S = Ot(b, Je()),
            v = S.percentage,
            J = Pe.some(
              (D) =>
                D.canExecute && D.fnName === "read_file" && !D.args?.line_end,
            ),
            j = Pe.filter(
              (D) =>
                D.canExecute &&
                D.fnName === "read_file" &&
                D.args?.path &&
                On.get(D.args.path) >= 1 &&
                !D.args?.line_start,
            ).map((D) => D.args.path.split("/").slice(-2).join("/")),
            z = j.length > 0;
          if ((v >= 70 && J && Ir < 70) || (v >= 85 && Ir < 85) || z) {
            Ir = v;
            let D = v >= 85 ? "URGENT" : "WARNING",
              B;
            z
              ? ((D = "WARNING"),
                (B = `Unbounded re-read of ${j.join(", ")} \u2014 already in context. Use line_start/line_end to read specific sections instead.`))
              : J
                ? (B = `Unbounded read at ${Math.round(v)}% context \u2014 use line_start/line_end to avoid overflow.`)
                : (B = `Context ${Math.round(v)}% used. Avoid large reads, wrap up with what you have.`);
            let ee = {
              role: "user",
              content: `[SYSTEM ${D}] Context ${Math.round(v)}% used (${S.used}/${S.limit} tokens). ${B}`,
            };
            if ((V.push(ee), b.push(ee), v >= 85)) {
              let de = z ? ` (re-read of: ${j.join(", ")})` : "";
              re(
                `${$.yellow}  \u26A0 Context ${Math.round(v)}% used \u2014 agent warned to use targeted reads${de}${$.reset}`,
              );
            }
          }
        }
        for (let S of Pe) {
          if (!S.canExecute || S.fnName !== "read_file") continue;
          let v = S.args?.path;
          if (!v) continue;
          let J = On.get(v) || 0,
            j = S.args?.line_start != null,
            z = ns.get(v) === !0,
            ue = 6;
          if (J >= ue) {
            let D = v.split("/").slice(-2).join("/"),
              B = (ss.get(v) || 0) + 1;
            (ss.set(v, B),
              B === 1 &&
                re(
                  `${$.red}  \u2716 Blocked: "${D}" read ${J}\xD7 \u2014 hard cap (${ue}) reached${$.reset}`,
                ),
              (S.canExecute = !1),
              (S.errorResult = {
                role: "tool",
                content: `BLOCKED: read_file("${v}") denied \u2014 file already read ${J}\xD7 (hard cap: ${ue}). You have seen enough of this file. Use grep to find specific content or proceed with what you know.`,
                tool_call_id: S.callId,
              }));
          } else if (J >= 1 && j)
            if (z) {
              let D = v.split("/").slice(-2).join("/");
              (console.log(
                `${$.cyan}  \u21A9 Targeted re-read: "${D}" (line_start=${S.args.line_start}) \u2014 edit recovery${$.reset}`,
              ),
                ns.delete(v));
            } else {
              let D = S.args.line_start || 1,
                B = S.args.line_end || D + 350,
                ee = Bs.get(v) || [],
                de = !1;
              for (let [ge, Ie] of ee) {
                let fe = Math.max(D, ge),
                  pt = Math.min(B, Ie);
                if (pt > fe) {
                  let lo = pt - fe,
                    Gr = B - D || 1;
                  if (lo / Gr >= 0.7) {
                    let wc = v.split("/").slice(-2).join("/");
                    (re(
                      `${$.red}  \u2716 Blocked duplicate read: "${wc}" lines ${D}-${B} (\u226570% overlap with lines ${ge}-${Ie} already in context)${$.reset}`,
                    ),
                      (S.canExecute = !1),
                      (S.errorResult = {
                        role: "tool",
                        content: `BLOCKED: read_file("${v}", lines ${D}-${B}) is a duplicate \u2014 lines ${ge}-${Ie} are already in your context (\u226570% overlap). Use grep to find specific content instead of re-reading.`,
                        tool_call_id: S.callId,
                      }),
                      (de = !0));
                    break;
                  }
                }
              }
              if (!de) {
                let ge = ee.length,
                  Ie = 2;
                if (ge >= 3) {
                  let pt = v.split("/").slice(-2).join("/");
                  (re(
                    `${$.red}  \u2716 Blocked file-scroll: "${pt}" \u2014 ${ge} sections already read. Use grep to find specific content.${$.reset}`,
                  ),
                    (S.canExecute = !1),
                    (S.errorResult = {
                      role: "tool",
                      content: `BLOCKED: read_file("${v}") denied \u2014 you have already read ${ge} different sections of this file (file-scroll pattern). You have seen most of this file. Use grep_search to find the exact lines you need instead of continuing to scroll.`,
                      tool_call_id: S.callId,
                    }));
                } else
                  ge >= Ie &&
                    (S._scrollWarn = { sectionCount: ge + 1, path: v });
              }
            }
          else if (J >= 1) {
            let D = v.split("/").slice(-2).join("/"),
              B = (ss.get(v) || 0) + 1;
            (ss.set(v, B),
              B === 1 &&
                re(
                  `${$.red}  \u2716 Blocked unbounded re-read: "${D}" \u2014 already in context. Use line_start/line_end for specific sections.${$.reset}`,
                ),
              (S.canExecute = !1),
              (S.errorResult = {
                role: "tool",
                content: `BLOCKED: read_file("${v}") denied \u2014 file already in context (read ${J}\xD7). Use line_start/line_end to read a specific section instead of the full file.`,
                tool_call_id: S.callId,
              }));
          }
        }
        for (let S of Pe)
          S.canExecute &&
            ((S.fnName !== "ssh_exec" && S.fnName !== "bash") ||
              (/\bsed\s+-n\b/.test(S.args?.command || "") &&
                (re(
                  `${$.red}  \u2716 Blocked sed -n: use grep -n "pattern" <file> | head -30 instead${$.reset}`,
                ),
                (S.canExecute = !1),
                (S.errorResult = {
                  role: "tool",
                  content:
                    'BLOCKED: sed -n is forbidden \u2014 it floods context with line ranges. Use grep -n "pattern" <file> | head -30 to read a specific section, or cat <file> for the full file.',
                  tool_call_id: S.callId,
                }))));
        for (let S of Pe) {
          if (!S.canExecute || S.fnName !== "write_file") continue;
          let v = S.args?.path,
            J = S.args?.content || "";
          if (v)
            try {
              let j = require("fs"),
                z = require("path").resolve(process.cwd(), v);
              if (j.existsSync(z)) {
                let ue = j.statSync(z).size,
                  D = Buffer.byteLength(J, "utf8"),
                  B = ue > 0 ? D / ue : 1;
                if (B < 0.6 && ue > 200) {
                  let ee = v.split("/").slice(-2).join("/");
                  (console.log(
                    `${$.red}  \u2716 write_file shrink guard: "${ee}" would shrink to ${Math.round(B * 100)}% of original \u2014 likely context loss${$.reset}`,
                  ),
                    (S.canExecute = !1),
                    (S.errorResult = {
                      role: "tool",
                      content: `BLOCKED: write_file("${v}") denied \u2014 new content is only ${Math.round(B * 100)}% of current file size (${ue} \u2192 ${D} bytes). This looks like a partial rewrite after context loss. Use edit_file/patch_file to add only the new code, or read the file first to see full content before replacing.`,
                      tool_call_id: S.callId,
                    }));
                }
              }
            } catch {}
        }
        for (let S of Pe) {
          if (!S.canExecute || S.fnName !== "grep") continue;
          let v = S.args?.path;
          if (!v) continue;
          let J = je.get(v) || 0;
          if (J >= Jt) {
            let j = v.split("/").slice(-2).join("/");
            (re(
              `${$.red}  \u2716 Blocked grep: "${j}" grepped ${J}\xD7 with different patterns \u2014 flood threshold exceeded${$.reset}`,
            ),
              (S.canExecute = !1),
              (S.errorResult = {
                role: "tool",
                content: `BLOCKED: grep("${v}") denied \u2014 ${J} patterns already tried. Use existing results.`,
                tool_call_id: S.callId,
              }));
          }
        }
        if (os) {
          let S = Pe.filter((j) => j.canExecute && j.fnName === "ssh_exec"),
            v = Pe.some((j) => j.canExecute && j.fnName !== "ssh_exec"),
            J = oe && ce < 3;
          if (S.length > 0 && !v && J && gr < 1)
            ((os = !1),
              gr++,
              (Nt = Math.max(0, Lr - 2)),
              re(
                `${$.dim}  [dual-block deadlock: SSH storm relaxed \u2014 allowing 1 SSH call (relax ${gr}/1)]${$.reset}`,
              ));
          else
            for (let j of S)
              ((j.canExecute = !1),
                (j.errorResult = {
                  role: "tool",
                  content: `BLOCKED: ssh_exec denied \u2014 SSH storm (${Lr}+ calls). Synthesize findings now.`,
                  tool_call_id: j.callId,
                }));
        }
        if (oe && ce < 3) {
          for (let S of Pe)
            if (
              S.canExecute &&
              ["bash", "read_file", "find_files"].includes(S.fnName)
            ) {
              ce++;
              {
                let v = Je(),
                  { messages: J } = jt(b, v);
                b = J;
              }
              (re(
                `${$.yellow}  \u26A0 Jarvis-local guard: blocking local ${S.fnName} \u2014 use ssh_exec on 94.130.37.43${$.reset}`,
              ),
                (S.canExecute = !1),
                (S.errorResult = {
                  role: "tool",
                  content: `BLOCKED: ${S.fnName} denied \u2014 this is a server issue. Use ssh_exec on 94.130.37.43 instead.`,
                  tool_call_id: S.callId,
                }));
              break;
            }
        }
        let ls = a ? { skipSpinner: !0, skipSummaries: !0 } : {},
          Cm = Pe.some((S) => S.fnName === "ask_user"),
          gc = !ls.skipSummaries && !Ne,
          Hr = null;
        (gc && !Cm
          ? ((Ne = !0),
            (ls.skipSpinner = !0),
            process.stdout.isTTY
              ? (process.stdout.write(_a(Pe, Q, !1, "blink")), (Hr = !0))
              : qt ||
                process.stdout.write(
                  _a(Pe, Q, !1) +
                    `
`,
                ))
          : gc && ((Ne = !0), (ls.skipSpinner = !0)),
          a && a._paused && a.resume());
        let { results: $c, summaries: Am } = await o_(Pe, !0, {
          ...ls,
          skipSummaries: !0,
        });
        if (
          (Hr &&
            ((Hr = null),
            process.stdout.write(`\r\x1B[2K${_a(Pe, Q, !1)}
`)),
          !ls.skipSummaries)
        ) {
          let S = Am.filter((j, z) => !(Pe[z] && Pe[z].fnName === "ask_user"));
          for (let j of S) console.log(j);
          console.log("");
          let v = Pe.filter((j) => j && j.fnName !== "ask_user").map(
              (j) => j.fnName,
            ),
            J = ne.record(0, v, U, M);
          J && Db(J);
        }
        for (let S of Pe) {
          if (S.canExecute || !S.errorResult) continue;
          let v =
            typeof S.errorResult.content == "string"
              ? S.errorResult.content
              : "";
          if (
            (v.startsWith("BLOCKED:") || v.startsWith("PLAN MODE:")) &&
            (ln++, ln >= dc)
          ) {
            (re(
              `${$.red}  \u2716 Loop abort: ${ln} consecutive blocked calls (pre-execution) \u2014 model not heeding BLOCKED messages${$.reset}`,
            ),
              a && (a.stop(), (a = null)),
              i(null),
              We(Q, E, M, U, G, { suppressHint: !0 }),
              Ue(V));
            return;
          }
        }
        for (let S = 0; S < Pe.length; S++) {
          let v = Pe[S];
          if (!v.canExecute) continue;
          let J = $c[S].content,
            j = J.split(`
`)[0],
            z =
              !j.startsWith("ERROR") &&
              !j.startsWith("CANCELLED") &&
              !j.startsWith("Command failed") &&
              !j.startsWith("EXIT");
          if (
            (!z &&
              (v.fnName === "edit_file" || v.fnName === "patch_file") &&
              v.args?.path &&
              j.includes("old_text not found") &&
              ns.set(v.args.path, !0),
            z && v.fnName === "write_file" && v.args?.path)
          ) {
            let D = v.args.path.split("/").pop(),
              B =
                v.args.path.includes("/tests/") ||
                v.args.path.includes("\\tests\\");
            if (/^(test_|demo_|temp_|tmp_|scratch_)/.test(D) && !B) {
              re(
                `${$.yellow}  \u26A0 Temp file: "${D}" \u2014 delete with bash rm when done to keep the workspace clean${$.reset}`,
              );
              let de = {
                role: "user",
                content: `[HINT] "${v.args.path}" looks like a temporary test/demo file. Delete it with bash("rm ${v.args.path}") as soon as you're done \u2014 orphaned temp files count against session quality.`,
              };
              (V.push(de), b.push(de));
            }
          }
          if (
            z &&
            ["write_file", "edit_file", "patch_file"].includes(v.fnName) &&
            v.args &&
            v.args.path
          ) {
            (ns.delete(v.args.path), M.add(v.args.path));
            let D = (I.get(v.args.path) || 0) + 1;
            I.set(v.args.path, D);
            let B = v.args.path.split("/").slice(-2).join("/");
            if (D === W) {
              re(
                `${$.yellow}  \u26A0 Loop warning: "${B}" edited ${D}\xD7 \u2014 possible edit loop${$.reset}`,
              );
              let ee = {
                role: "user",
                content: `[SYSTEM WARNING] "${v.args.path}" edited ${D}\xD7. One more edit max, then move on.`,
              };
              (V.push(ee), b.push(ee));
            } else if (D >= se) {
              (re(
                `${$.red}  \u2716 Loop abort: "${B}" edited ${D}\xD7 \u2014 aborting to prevent runaway loop${$.reset}`,
              ),
                a && (a.stop(), (a = null)),
                i(null),
                We(Q, E, M, U, G, { suppressHint: !0 }),
                Ue(V));
              return;
            }
          }
          if (
            (v.fnName === "bash" || v.fnName === "ssh_exec") &&
            v.args &&
            v.args.command
          ) {
            let D = v.args.command
                .replace(/\d+/g, "N")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 100),
              B = (X.get(D) || 0) + 1;
            if ((X.set(D, B), B === Z)) {
              re(
                `${$.yellow}  \u26A0 Loop warning: same bash command run ${B}\xD7 \u2014 possible debug loop${$.reset}`,
              );
              let ee = {
                role: "user",
                content: `[SYSTEM WARNING] Same bash command ${B}\xD7. Debug loop detected \u2014 try a different approach.`,
              };
              (V.push(ee), b.push(ee));
            } else if (B >= he) {
              (re(
                `${$.red}  \u2716 Loop abort: same bash command run ${B}\xD7 \u2014 aborting runaway debug loop${$.reset}`,
              ),
                a && (a.stop(), (a = null)),
                i(null),
                We(Q, E, M, U, G, { suppressHint: !0 }),
                Ue(V));
              return;
            }
          }
          if (v.fnName === "ssh_exec") {
            if ((Nt++, Nt >= Rm)) {
              (re(
                `${$.red}  \u2716 SSH storm abort: ${Nt} consecutive ssh_exec calls \u2014 aborting${$.reset}`,
              ),
                a && (a.stop(), (a = null)),
                i(null),
                We(Q, E, M, U, G, { suppressHint: !0 }),
                Ue(V));
              return;
            } else if (Nt === Lr) {
              {
                let B = Je(),
                  { messages: ee } = jt(b, B);
                b = ee;
              }
              ((os = !0),
                re(
                  `${$.yellow}  \u26A0 SSH storm warning: ${Nt} consecutive ssh_exec calls \u2014 blocking further SSH${$.reset}`,
                ));
              let D = {
                role: "user",
                content: `[SYSTEM WARNING] ${Nt} consecutive SSH calls. Synthesize findings now \u2014 no more SSH.`,
              };
              (V.push(D), b.push(D));
            }
          } else v.canExecute && (Nt = 0);
          if (z && v.fnName === "grep" && v.args && v.args.pattern) {
            let D = `${v.args.pattern}|${v.args.path || ""}`,
              B = (pe.get(D) || 0) + 1;
            if ((pe.set(D, B), B === we)) {
              re(
                `${$.yellow}  \u26A0 Loop warning: grep pattern "${v.args.pattern.slice(0, 40)}" run ${B}\xD7 \u2014 possible search loop${$.reset}`,
              );
              let ee = {
                role: "user",
                content: `[SYSTEM WARNING] Same grep pattern ${B}\xD7. Results unchanged \u2014 use existing data or try different pattern.`,
              };
              (V.push(ee), b.push(ee));
            } else if (B >= be) {
              (re(
                `${$.red}  \u2716 Loop abort: grep pattern run ${B}\xD7 \u2014 aborting runaway search loop${$.reset}`,
              ),
                a && (a.stop(), (a = null)),
                i(null),
                We(Q, E, M, U, G, { suppressHint: !0 }),
                Ue(V));
              return;
            }
            if (v.args.path) {
              let ee = (je.get(v.args.path) || 0) + 1;
              if ((je.set(v.args.path, ee), ee === Ge)) {
                let de = v.args.path.split("/").slice(-2).join("/");
                re(
                  `${$.yellow}  \u26A0 Loop warning: "${de}" grepped ${ee}\xD7 with different patterns \u2014 context flood risk${$.reset}`,
                );
                let ge = {
                  role: "user",
                  content: `[SYSTEM WARNING] "${v.args.path}" grepped ${ee}\xD7 \u2014 file already in context. Use existing data, stop searching.`,
                };
                (V.push(ge), b.push(ge));
              }
            }
          }
          if (
            z &&
            (v.fnName === "bash" || v.fnName === "ssh_exec") &&
            J.includes('"valid":true')
          ) {
            {
              let B = Je();
              if (Ot(b, B).percentage >= 60) {
                let { messages: de, tokensRemoved: ge } = jt(b, B);
                ge > 0 &&
                  ((b = de),
                  console.log(
                    `${$.dim}  [pre-stop-compress \u2014 ~${ge} tokens freed before STOP injection, now ${Math.round(Ot(b, B).percentage)}%]${$.reset}`,
                  ));
              }
            }
            let D = {
              role: "user",
              content:
                '[SYSTEM STOP] Tool result contains {"valid":true}. The token/service is valid and reachable. STOP all further investigation immediately. Report to the user that the token is valid, the service is healthy, and no fix is needed. Do NOT read any more log files.',
            };
            (V.push(D),
              b.push(D),
              console.log(
                `${$.cyan}  \u2713 Health-check stop signal detected \u2014 injecting STOP instruction${$.reset}`,
              ));
          }
          if (J.startsWith("BLOCKED:")) {
            if ((ln++, ln >= dc)) {
              (re(
                `${$.red}  \u2716 Loop abort: ${ln} consecutive blocked calls \u2014 model not heeding BLOCKED messages${$.reset}`,
              ),
                a && (a.stop(), (a = null)),
                i(null),
                We(Q, E, M, U, G, { suppressHint: !0 }),
                Ue(V));
              return;
            }
          } else ln = 0;
          if (z) ((cn = 0), (jr = !0));
          else if ((cn++, cn === vm)) {
            re(
              `${$.yellow}  \u26A0 Loop warning: ${cn} consecutive tool errors \u2014 possible stuck loop${$.reset}`,
            );
            let D = {
              role: "user",
              content: `[SYSTEM WARNING] ${cn} consecutive errors. Stuck loop \u2014 try fundamentally different approach or declare done.`,
            };
            (V.push(D), b.push(D));
          } else if (cn >= Sm) {
            (re(
              `${$.red}  \u2716 Loop abort: ${cn} consecutive errors \u2014 aborting stuck loop${$.reset}`,
            ),
              a && (a.stop(), (a = null)),
              i(null),
              We(Q, E, M, U, G, { suppressHint: !0 }),
              Ue(V));
            return;
          }
          if (z && v.fnName === "read_file" && v.args && v.args.path) {
            U.add(v.args.path);
            let D = (On.get(v.args.path) || 0) + 1;
            if ((On.set(v.args.path, D), v.args.line_start != null)) {
              let de = v.args.line_start || 1,
                ge = v.args.line_end || de + 350;
              (Bs.has(v.args.path) || Bs.set(v.args.path, []),
                Bs.get(v.args.path).push([de, ge]));
            }
            if (v._scrollWarn) {
              let { sectionCount: de, path: ge } = v._scrollWarn,
                Ie = {
                  role: "user",
                  content: `[SYSTEM WARNING] "${ge}" \u2014 you have now read ${de} different sections of this file. This is a file-scroll pattern. Stop reading sections and use grep_search to find the specific lines you need instead.`,
                };
              (V.push(Ie),
                b.push(Ie),
                re(
                  `${$.yellow}  \u26A0 Scroll warning: "${ge.split("/").slice(-2).join("/")}" \u2014 ${de} sections read \u2014 use grep instead${$.reset}`,
                ));
            }
            let B = v.args.path.split("/").slice(-2).join("/"),
              ee = !v.args?.line_start && !v.args?.line_end;
            if (ee && D === Pr) {
              {
                let ge = Je();
                if (Ot(b, ge).percentage >= 60) {
                  let { messages: fe } = jt(b, ge);
                  b = fe;
                }
              }
              re(
                `${$.yellow}  \u26A0 Loop warning: "${B}" read unbounded ${D}\xD7 \u2014 use line_start/line_end${$.reset}`,
              );
              let de = {
                role: "user",
                content: `[SYSTEM WARNING] "${v.args.path}" read ${D}\xD7 without line ranges. Use line_start/line_end to read specific sections \u2014 do not re-read the full file.`,
              };
              (V.push(de), b.push(de));
            } else if (ee && D >= km) {
              (re(
                `${$.red}  \u2716 Loop abort: "${B}" read unbounded ${D}\xD7 \u2014 aborting runaway read loop${$.reset}`,
              ),
                a && (a.stop(), (a = null)),
                i(null),
                We(Q, E, M, U, G, { suppressHint: !0 }),
                Ue(V));
              return;
            }
          }
          if (v.fnName === "spawn_agents") {
            let D = (J.match(/\bStatus: done\b/g) || []).length;
            if (
              (J.match(/\bStatus: truncated\b/g) || []).length > 0 &&
              D === 0
            ) {
              if ((un++, un === Em)) {
                re(
                  `${$.yellow}  \u26A0 Swarm warning: all sub-agents hit iteration limit ${un}\xD7 in a row${$.reset}`,
                );
                let ee = {
                  role: "user",
                  content: `[SYSTEM WARNING] Sub-agents truncated ${un}\xD7 in a row. Stop spawning \u2014 try different approach or report findings.`,
                };
                (V.push(ee), b.push(ee));
              } else if (un >= Tm) {
                (console.log(
                  `${$.red}  \u2716 Swarm abort: all sub-agents hit iteration limit ${un}\xD7 \u2014 aborting stuck swarm${$.reset}`,
                ),
                  a && (a.stop(), (a = null)),
                  i(null),
                  We(Q, E, M, U, G, { suppressHint: !0 }),
                  Ue(V));
                return;
              }
            } else D > 0 && (un = 0);
          }
        }
        for (let S of $c) (V.push(S), b.push(S));
        {
          let S = Je();
          if (Ot(b, S).percentage >= 78) {
            let { messages: J, tokensRemoved: j } = jt(b, S);
            j > 0 &&
              ((b = J),
              console.log(
                `${$.dim}  [auto-compressed \u2014 ~${j} tokens freed, now ${Math.round(Ot(b, S).percentage)}%]${$.reset}`,
              ));
          }
        }
        let yc = i_();
        if (yc) {
          let S = { role: "user", content: `[User note mid-run]: ${yc}` };
          (V.push(S),
            b.push(S),
            console.log(`${$.cyan}  \u270E Context added${$.reset}`));
        }
      }
      if (dt >= oo) {
        (a && (a.stop(), (a = null)), i(null), We(Q, E, M, U, G), Ue(V), jf(V));
        let { getActiveProviderName: qe } = Oe();
        if (qe() === "ollama" && Dr < fc) {
          if (M.size === 0 && !jr) {
            console.log(
              `${$.yellow}  \u26A0 Max iterations reached with no progress. Stopping.${$.reset}`,
            );
            break e;
          }
          (Dr++,
            (oo = 20),
            console.log(
              `${$.dim}  \u2500\u2500 auto-extending (+20 turns, ext ${Dr}/${fc}) \u2500\u2500${$.reset}`,
            ));
          continue e;
        }
        if (
          (console.log(`
${$.yellow}\u26A0 Max iterations reached.${$.reset}`),
          await Xf("  Continue for 20 more turns?"))
        ) {
          oo = 20;
          continue e;
        }
        console.log(
          `${$.dim}  Tip: set "maxIterations" in .nex/config.json or use --max-turns${$.reset}`,
        );
      }
      break e;
    }
  }
  op.exports = {
    processInput: $_,
    clearConversation: l_,
    getConversationLength: d_,
    getConversationMessages: f_,
    setConversationMessages: p_,
    setAbortSignalGetter: Wb,
    setMaxIterations: Ub,
    invalidateSystemPromptCache: Oa,
    clearToolFilterCache: Jb,
    getCachedFilteredTools: Qf,
    buildSystemPrompt: sp,
    getProjectContextHash: Zf,
    buildUserContent: Vf,
    detectAndTruncateLoop: Ra,
    injectMidRunNote: r_,
  };
});
var Oe = H((Mv, lp) => {
  var { OllamaProvider: y_ } = Bc(),
    { OpenAIProvider: w_ } = cl(),
    { AnthropicProvider: b_ } = fl(),
    { GeminiProvider: __ } = gl(),
    { LocalProvider: x_ } = wl(),
    { checkBudget: k_ } = Fn(),
    Da = {
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
    rp = {};
  for (let [t, e] of Object.entries(Da))
    for (let n of Object.values(e)) rp[n] = t;
  function ip(t, e) {
    let n = rp[t];
    return (n && Da[n][e]) || t;
  }
  var Ye = {},
    ut = null,
    Be = null,
    Ks = [];
  function vt() {
    if (Object.keys(Ye).length > 0) return;
    (rs("ollama", new y_()),
      rs("openai", new w_()),
      rs("anthropic", new b_()),
      rs("gemini", new __()),
      rs("local", new x_()));
    let t = process.env.DEFAULT_PROVIDER || "ollama",
      e = process.env.DEFAULT_MODEL || null;
    Ye[t]
      ? ((ut = t), (Be = e || Ye[t].defaultModel))
      : ((ut = "ollama"), (Be = "kimi-k2.5"));
    let n = process.env.FALLBACK_CHAIN;
    n &&
      (Ks = n
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean));
  }
  function rs(t, e) {
    Ye[t] = e;
  }
  function v_(t) {
    return (vt(), Ye[t] || null);
  }
  function ja() {
    return (vt(), Ye[ut] || null);
  }
  function S_() {
    return (vt(), ut);
  }
  function E_() {
    return (vt(), Be);
  }
  function T_() {
    vt();
    let t = ja();
    if (!t) return { id: Be, name: Be, provider: ut };
    let e = t.getModel(Be);
    return e ? { ...e, provider: ut } : { id: Be, name: Be, provider: ut };
  }
  function ap(t) {
    if (!t) return { provider: null, model: null };
    let e = t.indexOf(":");
    if (e > 0) {
      let n = t.slice(0, e);
      if (
        Ye[n] ||
        ["ollama", "openai", "anthropic", "gemini", "local"].includes(n)
      )
        return { provider: n, model: t.slice(e + 1) };
    }
    return { provider: null, model: t };
  }
  function R_(t) {
    vt();
    let { provider: e, model: n } = ap(t);
    if (e) {
      let s = Ye[e];
      return s && (s.getModel(n) || e === "local" || e === "ollama")
        ? ((ut = e), (Be = n), wr(), !0)
        : !1;
    }
    let o = ja();
    if (o && o.getModel(n)) return ((Be = n), wr(), !0);
    for (let [s, r] of Object.entries(Ye))
      if (r.getModel(n)) return ((ut = s), (Be = n), wr(), !0);
    return !1;
  }
  function wr() {
    try {
      let { invalidateSystemPromptCache: t, clearToolFilterCache: e } = Se();
      (t(), e());
    } catch {}
    try {
      let { invalidateTokenRatioCache: t } = Qe();
      t();
    } catch {}
  }
  function C_() {
    vt();
    let t = new Set();
    for (let e of Object.values(Ye)) for (let n of e.getModelNames()) t.add(n);
    return Array.from(t);
  }
  function A_() {
    return (
      vt(),
      Object.entries(Ye).map(([t, e]) => ({
        provider: t,
        configured: e.isConfigured(),
        models: Object.values(e.getModels()).map((n) => ({
          ...n,
          active: t === ut && n.id === Be,
        })),
      }))
    );
  }
  function O_() {
    vt();
    let t = [];
    for (let [e, n] of Object.entries(Ye)) {
      let o = n.isConfigured();
      for (let s of Object.values(n.getModels()))
        t.push({
          spec: `${e}:${s.id}`,
          name: s.name,
          provider: e,
          configured: o,
        });
    }
    return t;
  }
  function N_(t) {
    Ks = Array.isArray(t) ? t : [];
  }
  function M_() {
    return [...Ks];
  }
  function P_(t) {
    let e = t.message || "",
      n = t.code || "";
    return !!(
      e.includes("429") ||
      e.includes("500") ||
      e.includes("502") ||
      e.includes("503") ||
      e.includes("504") ||
      n === "ECONNABORTED" ||
      n === "ETIMEDOUT" ||
      n === "ECONNREFUSED" ||
      n === "ECONNRESET" ||
      n === "EHOSTUNREACH" ||
      n === "ENETUNREACH" ||
      n === "EPIPE" ||
      n === "ERR_SOCKET_CONNECTION_TIMEOUT" ||
      e.includes("socket disconnected") ||
      e.includes("TLS") ||
      e.includes("ECONNRESET") ||
      e.includes("ECONNABORTED") ||
      e.includes("network") ||
      e.includes("ETIMEDOUT")
    );
  }
  async function cp(t) {
    let e = [ut, ...Ks.filter((r) => r !== ut)],
      n,
      o = 0,
      s = 0;
    for (let r = 0; r < e.length; r++) {
      let i = e[r],
        a = Ye[i];
      if (!a || !a.isConfigured()) continue;
      s++;
      let l = k_(i);
      if (!l.allowed) {
        (o++,
          (n = new Error(
            `Budget limit reached for ${i}: $${l.spent.toFixed(2)} / $${l.limit.toFixed(2)}`,
          )));
        continue;
      }
      try {
        let u = r > 0,
          d = u ? ip(Be, i) : Be;
        return (
          u &&
            d !== Be &&
            process.stderr.write(`  [fallback: ${i}:${d}]
`),
          await t(a, i, d)
        );
      } catch (u) {
        if (((n = u), P_(u) && r < e.length - 1)) continue;
        throw u;
      }
    }
    throw o > 0 && o === s
      ? new Error(
          "All providers are over budget. Use /budget to check limits or /budget <provider> off to remove a limit.",
        )
      : s === 0
        ? new Error("No configured provider available")
        : n || new Error("No configured provider available");
  }
  async function I_(t, e, n = {}) {
    return (
      vt(),
      cp((o, s, r) => o.stream(t, e, { model: r, signal: n.signal, ...n }))
    );
  }
  async function L_(t, e, n = {}) {
    if ((vt(), n.provider)) {
      let o = Ye[n.provider];
      if (!o || !o.isConfigured())
        throw new Error(`Provider '${n.provider}' is not available`);
      let s = { model: n.model || Be, ...n };
      try {
        return await o.chat(t, e, s);
      } catch (r) {
        if (typeof o.stream == "function")
          try {
            return await o.stream(t, e, { ...s, onToken: () => {} });
          } catch {}
        throw r;
      }
    }
    return cp(async (o, s, r) => {
      try {
        return await o.chat(t, e, { model: r, ...n });
      } catch (i) {
        if (typeof o.stream == "function")
          try {
            return await o.stream(t, e, { model: r, ...n, onToken: () => {} });
          } catch {}
        throw i;
      }
    });
  }
  function D_() {
    vt();
    let t = [];
    for (let [e, n] of Object.entries(Ye))
      n.isConfigured() &&
        t.push({ name: e, models: Object.values(n.getModels()) });
    return t;
  }
  function j_() {
    for (let t of Object.keys(Ye)) delete Ye[t];
    ((ut = null), (Be = null), (Ks = []));
  }
  lp.exports = {
    registerProvider: rs,
    getProvider: v_,
    getActiveProvider: ja,
    getActiveProviderName: S_,
    getActiveModelId: E_,
    getActiveModel: T_,
    setActiveModel: R_,
    getModelNames: C_,
    parseModelSpec: ap,
    listProviders: A_,
    listAllModels: O_,
    callStream: I_,
    callChat: L_,
    getConfiguredProviders: D_,
    setFallbackChain: N_,
    getFallbackChain: M_,
    resolveModelForProvider: ip,
    MODEL_EQUIVALENTS: Da,
    _reset: j_,
  };
});
var Fa = H((Pv, up) => {
  "use strict";
  var Yt = require("fs"),
    br = require("path"),
    q_ = require("readline"),
    $e = "\x1B[0m",
    _r = "\x1B[1m",
    Ve = "\x1B[2m",
    xr = "\x1B[33m",
    qa = "\x1B[36m",
    Ys = "\x1B[32m";
  function F_(t) {
    return (e, n = "") =>
      new Promise((o) => {
        let s = n ? ` ${Ve}[${n}]${$e}` : "";
        t.question(`  ${qa}${e}${s}${$e}: `, (r) => o(r.trim() || n));
      });
  }
  function zs(t, e) {
    return new Promise((n) => {
      (e && e.pause(), process.stdout.write(`  ${qa}${t}${$e}: `));
      let o = process.stdin,
        s = o.isRaw,
        r = "";
      (o.setRawMode(!0), o.resume(), o.setEncoding("utf8"));
      let i = (a) => {
        a === "\r" ||
        a ===
          `
`
          ? (o.setRawMode(s || !1),
            o.removeListener("data", i),
            process.stdout.write(`
`),
            e && e.resume(),
            n(r))
          : a === ""
            ? (process.stdout.write(`
`),
              process.exit(0))
            : a === "\x7F"
              ? r.length > 0 &&
                ((r = r.slice(0, -1)), process.stdout.write("\b \b"))
              : ((r += a), process.stdout.write("*"));
      };
      o.on("data", i);
    });
  }
  async function U_({ rl: t = null, force: e = !1 } = {}) {
    if (!e) {
      let m =
          Yt.existsSync(br.join(process.cwd(), ".env")) ||
          Yt.existsSync(br.join(__dirname, "..", ".env")),
        h =
          process.env.ANTHROPIC_API_KEY ||
          process.env.OPENAI_API_KEY ||
          process.env.GEMINI_API_KEY ||
          process.env.OPENROUTER_API_KEY,
        p = process.env.DEFAULT_PROVIDER || process.env.DEFAULT_MODEL;
      if (m || h || p) return;
    }
    let n = !t,
      o =
        t ||
        q_.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: !0,
        }),
      s = F_(o),
      r = !e;
    (console.log(),
      console.log(
        r
          ? `${xr}${_r}  \u2726 Welcome to nex-code! No configuration found.${$e}`
          : `${qa}${_r}  \u2726 nex-code \u2014 Provider & API Key Setup${$e}`,
      ),
      console.log(
        `${Ve}  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${$e}`,
      ),
      r &&
        console.log(`  Let's set you up in 60 seconds.
`),
      console.log(`  ${_r}Which AI provider do you want to use?${$e}
`),
      console.log(
        `  ${Ys}1)${$e} ${_r}Ollama Cloud${$e}  ${Ve}recommended \u2014 devstral-2:123b, no API key needed${$e}`,
      ),
      console.log(`  ${Ve}   (also works with a local Ollama server)${$e}`),
      console.log(
        `  ${Ve}2)  Anthropic     Claude (claude-sonnet-4-6 etc.)${$e}`,
      ),
      console.log(`  ${Ve}3)  OpenAI        GPT-4o, GPT-4.1 etc.${$e}`),
      console.log(`  ${Ve}4)  Gemini        Google Gemini 2.x${$e}`),
      console.log(`  ${Ve}5)  Skip / Cancel${$e}`),
      console.log());
    let i = await s("Enter number", "1"),
      a = [];
    if (i === "5") {
      (n && o.close(),
        console.log(`
${Ve}  Cancelled \u2014 no changes made.${$e}
`));
      return;
    }
    if (i === "1") {
      (console.log(),
        console.log(`
  ${Ys}Ollama Cloud${$e} ${Ve}(recommended): uses ollama.com API \u2014 flat-rate, 47+ models.${$e}`),
        console.log(`  ${Ve}Get your API key at: https://ollama.com/settings/api-keys${$e}
`));
      let m = await zs("OLLAMA_API_KEY (leave blank for local)", t),
        h = m
          ? "https://ollama.com"
          : await s("Ollama host", "http://localhost:11434"),
        p = await s("Default model", m ? "devstral-2:123b" : "qwen3-coder");
      (a.push(
        "DEFAULT_PROVIDER=ollama",
        `DEFAULT_MODEL=${p}`,
        `OLLAMA_HOST=${h}`,
      ),
        m && a.push(`OLLAMA_API_KEY=${m}`),
        (process.env.DEFAULT_PROVIDER = "ollama"),
        (process.env.DEFAULT_MODEL = p),
        (process.env.OLLAMA_HOST = h),
        m && (process.env.OLLAMA_API_KEY = m));
    } else if (i === "2") {
      (console.log(),
        console.log(
          `  ${Ve}Get your key: https://console.anthropic.com/settings/keys${$e}`,
        ));
      let m = await zs("ANTHROPIC_API_KEY", t);
      if (!m) {
        (n && o.close(),
          console.log(`
${xr}  No key entered \u2014 cancelled.${$e}
`));
        return;
      }
      let h = await s("Default model", "claude-sonnet-4-6");
      (a.push(
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
          `  ${Ve}Get your key: https://platform.openai.com/api-keys${$e}`,
        ));
      let m = await zs("OPENAI_API_KEY", t);
      if (!m) {
        (n && o.close(),
          console.log(`
${xr}  No key entered \u2014 cancelled.${$e}
`));
        return;
      }
      let h = await s("Default model", "gpt-4o");
      (a.push(
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
          `  ${Ve}Get your key: https://aistudio.google.com/app/apikey${$e}`,
        ));
      let m = await zs("GEMINI_API_KEY", t);
      if (!m) {
        (n && o.close(),
          console.log(`
${xr}  No key entered \u2014 cancelled.${$e}
`));
        return;
      }
      let h = await s("Default model", "gemini-2.0-flash");
      (a.push(
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
        await s("Add Perplexity key for grounded web search? (y/N)", "n")
      ).toLowerCase() === "y")
    ) {
      console.log(
        `  ${Ve}Get your key: https://www.perplexity.ai/settings/api${$e}`,
      );
      let m = await zs("PERPLEXITY_API_KEY", t);
      m &&
        (a.push(`PERPLEXITY_API_KEY=${m}`),
        (process.env.PERPLEXITY_API_KEY = m));
    }
    console.log();
    let u = br.join(process.cwd(), ".env"),
      d = (Yt.existsSync(u), "y"),
      f = await s(`Save to ${u}? (Y/n)`, d);
    if ((n && o.close(), f.toLowerCase() !== "n")) {
      let m = Yt.existsSync(u)
        ? Yt.readFileSync(u, "utf-8").trimEnd() +
          `

`
        : "";
      Yt.writeFileSync(
        u,
        m +
          a.join(`
`) +
          `
`,
      );
      let h = br.join(process.cwd(), ".gitignore");
      (Yt.existsSync(h) &&
        (Yt.readFileSync(h, "utf-8")
          .split(
            `
`,
          )
          .some((g) => g.trim() === ".env") ||
          Yt.appendFileSync(
            h,
            `
.env
`,
          )),
        console.log(`
${Ys}  \u2713 Saved to ${u}${$e}`),
        a.some((p) => p.includes("API_KEY")) &&
          console.log(
            `${Ve}  (key stored locally \u2014 never committed)${$e}`,
          ));
    }
    if (process.env.DEFAULT_PROVIDER)
      try {
        let { setActiveModel: m } = Oe(),
          h = process.env.DEFAULT_MODEL
            ? `${process.env.DEFAULT_PROVIDER}:${process.env.DEFAULT_MODEL}`
            : process.env.DEFAULT_PROVIDER;
        (m(h),
          console.log(`${Ys}  \u2713 Switched to ${h} for this session${$e}`));
      } catch {}
    console.log(`
${Ys}  \u2713 Setup complete!${$e}
`);
  }
  up.exports = { runSetupWizard: U_ };
});
var fp = H((Iv, dp) => {
  "use strict";
  var W_ = require("readline");
  function Rn(t) {
    process.stdout.write(
      JSON.stringify(t) +
        `
`,
    );
  }
  function B_() {
    process.env.NEX_SERVER = "1";
    let t = (...a) =>
      process.stderr.write(
        a.map(String).join(" ") +
          `
`,
      );
    ((console.log = t), (console.warn = t), (console.info = t));
    let { setConfirmHook: e } = Xe(),
      n = new Map(),
      o = 0;
    e((a, l) => {
      let u = "cfm-" + ++o,
        d = l?.toolName || "",
        f = !1;
      try {
        let { isCritical: m } = Xe();
        f = m(a);
      } catch {}
      return (
        Rn({
          type: "confirm_request",
          id: u,
          question: a,
          tool: d,
          critical: f,
        }),
        new Promise((m) => {
          n.set(u, m);
        })
      );
    });
    let s = null,
      r = {
        onToken(a) {
          s && Rn({ type: "token", id: s, text: a });
        },
        onThinkingToken() {},
        onToolStart(a, l) {
          s && Rn({ type: "tool_start", id: s, tool: a, args: l || {} });
        },
        onToolEnd(a, l, u) {
          s &&
            Rn({ type: "tool_end", id: s, tool: a, summary: l || "", ok: !!u });
        },
      },
      i = W_.createInterface({
        input: process.stdin,
        output: null,
        terminal: !1,
      });
    (Rn({ type: "ready" }),
      i.on("line", async (a) => {
        let l = a.trim();
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
            s = d;
            let { processInput: f } = Se();
            try {
              (await f(u.text, r), Rn({ type: "done", id: d }));
            } catch (m) {
              Rn({ type: "error", id: d, message: m?.message || String(m) });
            } finally {
              s = null;
            }
            break;
          }
          case "confirm": {
            let d = n.get(u.id);
            d && (n.delete(u.id), d(!!u.answer));
            break;
          }
          case "cancel": {
            for (let [d, f] of n) (n.delete(d), f(!1));
            break;
          }
          case "clear": {
            let { clearConversation: d } = Se();
            d();
            for (let [f, m] of n) (n.delete(f), m(!1));
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
  dp.exports = { startServerMode: B_ };
});
var gp = H((Lv, hp) => {
  "use strict";
  var kr = require("fs"),
    { T: Mt, isDark: H_ } = fn(),
    $t = "\x1B[0m",
    G_ = !H_,
    K_ = process.env.FOOTER_DEBUG === "1" || process.env.FOOTER_DEBUG === "2",
    Y_ = process.env.FOOTER_DEBUG === "2",
    is = null;
  function an(...t) {
    K_ &&
      (is || (is = kr.openSync("/tmp/footer-debug.log", "w")),
      kr.writeSync(
        is,
        t.join(" ") +
          `
`,
      ));
  }
  function pp(t, e) {
    if (!Y_ || typeof e != "string") return;
    is || (is = kr.openSync("/tmp/footer-debug.log", "w"));
    let n = e
      .replace(/\x1b\[([^a-zA-Z]*)([a-zA-Z])/g, (o, s, r) => `<ESC[${s}${r}>`)
      .replace(/\x1b([^[])/g, (o, s) => `<ESC${s}>`)
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
    kr.writeSync(
      is,
      `${t}: ${n}
`,
    );
  }
  function mp(t) {
    return t.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, "").length;
  }
  var Ua = class {
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
    setStatusInfo({ model: e, branch: n, project: o, mode: s } = {}) {
      (e !== void 0 && (this._statusModel = e),
        n !== void 0 && (this._statusBranch = n),
        o !== void 0 && (this._statusProject = o),
        s !== void 0 && (this._statusMode = s),
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
    _goto(e, n = 1) {
      return `\x1B[${e};${n}H`;
    }
    _statusLine() {
      let e = this._cols,
        n = this._statusModel,
        o = this._statusBranch,
        s = this._statusProject,
        r = this._statusMode;
      if (!n) return Mt.footer_sep + "\u2500".repeat(e) + $t;
      let i = ` ${Mt.footer_divider}\xB7${$t} `,
        a = [];
      (n && a.push(`${Mt.footer_model}${n}${$t}`),
        o && a.push(`${Mt.footer_branch}${o}${$t}`),
        s && a.push(`${Mt.footer_project}${s}${$t}`));
      let l = a.join(i),
        u = [n, o, s].filter(Boolean).join(" \xB7 ").length,
        d = "\u2500 ";
      if (r) {
        let h = r.length,
          p = Math.max(0, e - d.length - u - 1 - 1 - h - 3),
          g = "\u2500".repeat(p);
        return `${Mt.footer_sep}${d}${$t}${l}${Mt.footer_sep} ${g} ${$t}${Mt.footer_mode}${r}${$t}${Mt.footer_sep} \u2500\u2500${$t}`;
      }
      let f = Math.max(0, e - d.length - u - 2),
        m = "\u2500".repeat(f);
      return `${Mt.footer_sep}${d}${$t}${l}${Mt.footer_sep} ${m}${$t}`;
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
      if (G_) return;
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
        pp("RAW", e),
        this._origWrite ? this._origWrite(e) : process.stdout.write(e)
      );
    }
    _relayout(e) {
      if (!this._origWrite) return;
      let n = this._origWrite,
        o = this._rows,
        s = this._cols,
        r = Math.max(1, o - 2);
      (an(
        "RELAYOUT:",
        e,
        "rows=" + o,
        "cols=" + s,
        "scrollEnd=" + r,
        "cursorOnInput=" + this._cursorOnInputRow,
      ),
        (this._prevTermRows = o),
        (this._prevTermCols = s));
      let i = Math.min(this._lastOutputRow + 1, r + 1),
        a = "";
      for (let l = i; l <= o; l++) a += this._goto(l) + "\x1B[2K";
      (n(a),
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
      let n = this,
        o = process.stdout.write.bind(process.stdout);
      ((this._origWrite = o),
        (process.stdout.write = function (p, ...g) {
          if ((pp("PATCH", p), !n._active || typeof p != "string"))
            return o(p, ...g);
          if (n._inRefreshLine) {
            let x = p.replace(/\n/g, "");
            return x ? o(x, ...g) : !0;
          }
          if (n._cursorOnInputRow)
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
                (n._cursorOnInputRow = !1),
                o(n._goto(Math.min(n._lastOutputRow + 1, n._scrollEnd))));
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
                  n._origRefreshLine && n._doRefreshLine(),
                  !0
                );
              {
                let x = p.replace(/\n/g, "");
                return x ? o(x, ...g) : !0;
              }
            }
          let y = n._cols || 80,
            w = 0,
            k = p.split(`
`);
          for (let x = 0; x < k.length; x++) {
            let _ = mp(k[x]);
            _ > 0 && (w += Math.floor((_ - 1) / y));
          }
          let R = k.length - 1;
          return (
            R + w > 0 &&
              (n._lastOutputRow = Math.min(
                n._lastOutputRow + R + w,
                n._scrollEnd,
              )),
            o(p, ...g)
          );
        }),
        (this._cursorOnInputRow = !1),
        (this._origStderrWrite = process.stderr.write.bind(process.stderr)),
        (process.stderr.write = function (p, ...g) {
          if (!n._active) return n._origStderrWrite(p, ...g);
          if (typeof p == "string" && p.includes("\r")) {
            let y = Math.min(n._lastOutputRow + 1, n._scrollEnd);
            if (n._cursorOnInputRow) {
              (n._origWrite("\x1B7"), n._origWrite(n._goto(y)));
              let w = n._origStderrWrite(p, ...g);
              return (n._origWrite("\x1B8"), w);
            }
            n._origWrite(n._goto(y));
          }
          return n._origStderrWrite(p, ...g);
        }),
        (this._origLog = console.log),
        (this._origError = console.error));
      function s(...p) {
        if (!n._active) {
          n._origLog(...p);
          return;
        }
        (n._origWrite(n._goto(Math.min(n._lastOutputRow + 1, n._scrollEnd))),
          (n._cursorOnInputRow = !1),
          n._origLog(...p),
          n.drawFooter(),
          o(n._goto(n._rowInput) + "\x1B[2K"),
          (n._cursorOnInputRow = !0));
      }
      function r(...p) {
        if (!n._active) {
          n._origError(...p);
          return;
        }
        (n._origWrite(n._goto(Math.min(n._lastOutputRow + 1, n._scrollEnd))),
          (n._cursorOnInputRow = !1),
          n._origError(...p),
          n.drawFooter(),
          o(n._goto(n._rowInput) + "\x1B[2K"),
          (n._cursorOnInputRow = !0));
      }
      ((console.log = s),
        (console.error = r),
        (this._origSetPr = e.setPrompt.bind(e)),
        (e.setPrompt = function (p) {
          (n._origSetPr(p), n._active && n.drawFooter(p));
        }),
        (this._origPrompt = e.prompt.bind(e)),
        (e.prompt = function (p) {
          if (!n._active) return n._origPrompt(p);
          (an("PROMPT: goto rowInput=" + n._rowInput),
            (e.prevRows = 0),
            o(n._goto(n._rowInput) + $t + "\x1B[2K"),
            (n._cursorOnInputRow = !0),
            n._origPrompt(p));
        }));
      let i = e.question.bind(e);
      e.question = function (p, g) {
        if (!n._active) return i(p, g);
        (o(n._goto(n._rowInput) + "\x1B[2K"),
          (e.prevRows = 0),
          (n._cursorOnInputRow = !0),
          i(p, (y) => {
            (o(n._goto(n._rowInput) + "\x1B[2K"),
              (n._cursorOnInputRow = !1),
              n.drawFooter(),
              g(y));
          }));
      };
      let a = Object.getPrototypeOf(e),
        l = Object.getOwnPropertySymbols(a).find(
          (p) => p.toString() === "Symbol(_refreshLine)",
        ),
        u = l ? a[l].bind(e) : e._refreshLine ? e._refreshLine.bind(e) : null;
      if (
        ((this._origRefreshLine = u),
        (this._doRefreshLine = function () {
          if (!n._active || !u) return;
          if (n._rows !== n._prevTermRows || n._cols !== n._prevTermCols) {
            n._dirty = !0;
            return;
          }
          ((e.prevRows = 0), o(n._goto(n._rowInput) + $t + "\x1B[2K"));
          let p = n._cols,
            g = e._prompt || "",
            y = mp(g),
            w = p - y - 1;
          n._inRefreshLine = !0;
          try {
            if (e.line.length <= w) {
              (an("REFRESH: short line, len=" + e.line.length), u());
              return;
            }
            an("REFRESH: long line, len=" + e.line.length + ", max=" + w);
            let k = e.line,
              R = e.cursor,
              x = Math.max(1, w - 1),
              _ = Math.max(0, R - x),
              b = (_ > 0 ? "\xAB" : "") + k.slice(_, _ + x + (_ > 0 ? 0 : 1));
            ((e.line = b),
              (e.cursor = b.length),
              u(),
              (e.line = k),
              (e.cursor = R));
          } finally {
            n._inRefreshLine = !1;
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
        n._active &&
          (an("LINE: leaving input row"),
          (n._cursorOnInputRow = !1),
          o(n._goto(n._rowInput) + "\x1B[2K"),
          o(n._goto(Math.min(n._lastOutputRow + 1, n._scrollEnd))),
          n.drawFooter());
      });
      let d = null,
        f = null,
        m = () => {
          ((d = null),
            n._relayout("resize"),
            f && clearTimeout(f),
            (f = setTimeout(() => {
              ((f = null), n._relayout("resize-cleanup"));
            }, 300)));
        },
        h = () => {
          ((n._dirty = !0), d && clearTimeout(d), (d = setTimeout(m, 80)));
        };
      (process.stdout.on("resize", h),
        (this._offResize = () => {
          (process.stdout.off("resize", h),
            d && (clearTimeout(d), (d = null)),
            f && (clearTimeout(f), (f = null)));
        }),
        (this._consistencyTimer = setInterval(() => {
          if (!n._active) return;
          let p = n._rows,
            g = n._cols;
          (n._dirty || p !== n._prevTermRows || g !== n._prevTermCols) &&
            (an(
              "CONSISTENCY: dirty=" +
                n._dirty +
                " rows=" +
                p +
                "/" +
                n._prevTermRows +
                " cols=" +
                g +
                "/" +
                n._prevTermCols,
            ),
            n._relayout("consistency"));
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
          ).find((n) => n.toString() === "Symbol(_refreshLine)");
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
  hp.exports = { StickyFooter: Ua };
});
var wp = H((Dv, yp) => {
  var { C: Ce } = Ae(),
    {
      listProviders: z_,
      getActiveProviderName: X_,
      getActiveModelId: J_,
      setActiveModel: V_,
    } = Oe();
  function $p(t, e, n = {}) {
    let {
      title: o = "Select",
      hint: s = "\u2191\u2193 navigate \xB7 Enter select \xB7 Esc cancel",
    } = n;
    return new Promise((r) => {
      let i = e.map((w, k) => (w.isHeader ? -1 : k)).filter((w) => w >= 0);
      if (i.length === 0) {
        r(null);
        return;
      }
      let a = e.findIndex((w) => w.isCurrent),
        l = a >= 0 ? i.indexOf(a) : 0;
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
          for (let _ = 0; _ < m; _++)
            process.stdout.write(`\x1B[2K
`);
          process.stdout.write(`\x1B[${m}A`);
        }
        let w = [];
        (w.push(`  ${Ce.bold}${Ce.cyan}${o}${Ce.reset}`),
          w.push(`  ${Ce.dim}${s}${Ce.reset}`),
          w.push(""));
        let { start: k, end: R } = f();
        k > 0 && w.push(`  ${Ce.dim}\u2191 more${Ce.reset}`);
        for (let _ = k; _ < R; _++) {
          let b = e[_];
          if (b.isHeader) {
            w.push(`  ${Ce.bold}${Ce.dim}${b.label}${Ce.reset}`);
            continue;
          }
          let O = i[l] === _,
            N = O ? `${Ce.cyan}> ` : "  ",
            C = b.isCurrent ? ` ${Ce.yellow}<current>${Ce.reset}` : "";
          O
            ? w.push(`${N}${Ce.bold}${b.label}${Ce.reset}${C}`)
            : w.push(`${N}${Ce.dim}${b.label}${Ce.reset}${C}`);
        }
        R < e.length && w.push(`  ${Ce.dim}\u2193 more${Ce.reset}`);
        let x = w.join(`
`);
        (process.stdout.write(
          x +
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
        (process.stdin.removeListener("keypress", y),
          process.stdin.isTTY && p !== void 0 && process.stdin.setRawMode(p),
          t.resume());
      }
      function y(w, k) {
        if (k) {
          if (k.name === "up" || (k.ctrl && k.name === "p")) {
            l > 0 && (l--, h());
            return;
          }
          if (k.name === "down" || (k.ctrl && k.name === "n")) {
            l < i.length - 1 && (l++, h());
            return;
          }
          if (k.name === "return") {
            let R = e[i[l]];
            (g(), r(R ? R.value : null));
            return;
          }
          if (k.name === "escape" || (k.ctrl && k.name === "c")) {
            (g(), r(null));
            return;
          }
        }
      }
      (process.stdin.on("keypress", y), h());
    });
  }
  async function Q_(t) {
    let e = z_(),
      n = X_(),
      o = J_(),
      s = [];
    for (let i of e)
      if (i.models.length !== 0) {
        s.push({ label: i.provider, value: null, isHeader: !0 });
        for (let a of i.models) {
          let l = i.provider === n && a.id === o;
          s.push({
            label: `  ${a.name} (${i.provider}:${a.id})`,
            value: `${i.provider}:${a.id}`,
            isCurrent: l,
          });
        }
      }
    let r = await $p(t, s, { title: "Select Model" });
    return r
      ? (V_(r), console.log(`${Ce.green}Switched to ${r}${Ce.reset}`), !0)
      : (console.log(`${Ce.dim}Cancelled${Ce.reset}`), !1);
  }
  yp.exports = { pickFromList: $p, showModelPicker: Q_ };
});
var Ba = H((qv, Tp) => {
  var bp = require("fs"),
    Z_ = require("path"),
    { atomicWrite: ex, withFileLockSync: tx } = Zt(),
    { callChat: _p } = Oe(),
    { remember: nx, listMemories: jv, recall: sx } = rn(),
    Wa = 4,
    ox = `You are a memory optimization agent for an AI coding assistant called nex-code.
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
  function xp(t) {
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
  async function kp(t) {
    if (t.filter((s) => s.role === "user").length < Wa)
      return { memories: [], nex_additions: [], summary: null, skipped: !0 };
    let n = xp(t);
    if (!n.trim())
      return { memories: [], nex_additions: [], summary: null, skipped: !0 };
    let o = [
      { role: "system", content: ox },
      {
        role: "user",
        content: `Conversation to analyze:

${n}`,
      },
    ];
    try {
      let i = (
        (await _p(o, [], { temperature: 0, maxTokens: 800 })).content || ""
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
      let a = JSON.parse(i[0]);
      return {
        memories: Array.isArray(a.memories) ? a.memories : [],
        nex_additions: Array.isArray(a.nex_additions) ? a.nex_additions : [],
        summary: typeof a.summary == "string" ? a.summary : null,
      };
    } catch (s) {
      return {
        memories: [],
        nex_additions: [],
        summary: null,
        error: s.message,
      };
    }
  }
  function vp(t) {
    let e = [];
    for (let { key: n, value: o } of t || []) {
      if (!n || !o || typeof n != "string" || typeof o != "string") continue;
      let s = n.trim().replace(/\s+/g, "-").substring(0, 60),
        r = o.trim().substring(0, 200);
      if (!s || !r) continue;
      let i = sx(s);
      i !== r &&
        (nx(s, r),
        e.push({ key: s, value: r, action: i ? "updated" : "added" }));
    }
    return e;
  }
  function Sp(t) {
    if (!t || t.length === 0) return [];
    let e = Z_.join(process.cwd(), "NEX.md");
    return tx(e, () => {
      let n = "";
      try {
        bp.existsSync(e) && (n = bp.readFileSync(e, "utf-8"));
      } catch {}
      let o = [],
        s = n;
      for (let r of t) {
        if (!r || typeof r != "string") continue;
        let i = r.trim();
        if (!i) continue;
        let a = i.substring(0, 35).toLowerCase();
        n.toLowerCase().includes(a) ||
          (o.push(i),
          (s = s
            ? s.endsWith(`
`)
              ? s + i
              : s +
                `
` +
                i
            : i));
      }
      return (
        o.length > 0 &&
          (s.endsWith(`
`) ||
            (s += `
`),
          ex(e, s)),
        o
      );
    });
  }
  async function rx(t) {
    let e = await kp(t);
    if (e.skipped)
      return { applied: [], nexAdded: [], summary: null, skipped: !0 };
    if (e.error)
      return { applied: [], nexAdded: [], summary: null, error: e.error };
    let n = vp(e.memories),
      o = Sp(e.nex_additions);
    return { applied: n, nexAdded: o, summary: e.summary };
  }
  var ix = `You are a knowledge base agent for an AI coding assistant called nex-code.
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
  async function Ep(t) {
    if (t.filter((s) => s.role === "user").length < Wa)
      return { documents: [], skip_reason: "Session too short" };
    let n = xp(t);
    if (!n.trim()) return { documents: [], skip_reason: "No usable content" };
    let o = [
      { role: "system", content: ix },
      {
        role: "user",
        content: `Conversation to analyze:

${n}`,
      },
    ];
    try {
      let i = (
        (await _p(o, [], { temperature: 0, maxTokens: 2e3 })).content || ""
      )
        .trim()
        .match(/\{[\s\S]*\}/);
      if (!i) return { documents: [], error: "No JSON in response" };
      let a = JSON.parse(i[0]);
      return {
        documents: Array.isArray(a.documents) ? a.documents : [],
        skip_reason: a.skip_reason,
      };
    } catch (s) {
      return { documents: [], error: s.message };
    }
  }
  async function ax(t) {
    let e = await Ep(t);
    if (e.error) return { written: [], skipped: [], error: e.error };
    if (!e.documents || e.documents.length === 0)
      return { written: [], skipped: [], skip_reason: e.skip_reason };
    let { writeDocument: n, readDocument: o } = Rs(),
      s = [],
      r = [];
    for (let i of e.documents) {
      if (!i.name || !i.content) continue;
      let a = i.name
        .trim()
        .replace(/\.md$/, "")
        .replace(/[^a-z0-9-]/g, "-")
        .substring(0, 60);
      if (!a) continue;
      let l = o(a);
      if (l.content) {
        let d = `

## Update ${new Date().toISOString().split("T")[0]}

${i.content}`;
        (n(a, l.content + d),
          s.push({ name: a, reason: i.reason || "", action: "updated" }));
      } else
        (n(a, i.content),
          s.push({ name: a, reason: i.reason || "", action: "created" }));
    }
    return { written: s, skipped: r };
  }
  Tp.exports = {
    learnFromSession: rx,
    learnBrainFromSession: ax,
    reflectOnSession: kp,
    reflectBrain: Ep,
    applyMemories: vp,
    applyNexAdditions: Sp,
    LEARN_MIN_MESSAGES: Wa,
  };
});
var Op = H((Uv, Ap) => {
  var tt = require("fs"),
    cs = require("path"),
    Fv = require("os"),
    cx = require("readline"),
    { C: Y } = Ae(),
    Rp = ".nex",
    Ha = null;
  function lx(t) {
    Ha = t;
  }
  function nt(t, e = "") {
    let n = e ? ` ${Y.dim}[${e}]${Y.reset}` : "",
      o = `  ${Y.cyan}${t}${n}${Y.reset}: `;
    return new Promise((s) => {
      let r = (i) => {
        let a = i.trim() || e;
        s(a);
      };
      if (Ha) Ha.question(o, r);
      else {
        let i = cx.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        i.question(o, (a) => {
          (i.close(), r(a));
        });
      }
    });
  }
  function as(t, e = !0) {
    return nt(`${t} (${e ? "Y/n" : "y/N"})`, e ? "y" : "n").then(
      (o) => o.toLowerCase() !== "n" && o.toLowerCase() !== "no",
    );
  }
  async function Ga(t, e, n) {
    let o = e.map((a, l) => `${Y.dim}${l + 1})${Y.reset} ${a}`).join("  ");
    (console.log(`  ${Y.cyan}${t}${Y.reset}`), console.log(`  ${o}`));
    let s = n ? e.indexOf(n) + 1 : 1,
      r = await nt("Enter number", String(s)),
      i = parseInt(r, 10) - 1;
    return e[Math.max(0, Math.min(i, e.length - 1))];
  }
  async function ux() {
    let t = cs.join(process.cwd(), Rp),
      e = cs.join(t, "servers.json"),
      n = {};
    if (tt.existsSync(e))
      try {
        n = JSON.parse(tt.readFileSync(e, "utf-8"));
      } catch {}
    (console.log(`
${Y.bold}${Y.cyan}\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557${Y.reset}`),
      console.log(
        `${Y.bold}${Y.cyan}\u2551   nex-code Server Setup Wizard       \u2551${Y.reset}`,
      ),
      console.log(`${Y.bold}${Y.cyan}\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D${Y.reset}
`));
    let o = Object.keys(n);
    if (
      o.length > 0 &&
      (console.log(`${Y.dim}Existing profiles: ${o.join(", ")}${Y.reset}`),
      !(await as("Add or update a server profile?", !0)))
    ) {
      console.log(`${Y.dim}No changes made.${Y.reset}
`);
      return;
    }
    let s = { ...n },
      r = !0;
    for (; r; ) {
      console.log(`
${Y.bold}\u2500\u2500\u2500 New Server Profile \u2500\u2500\u2500${Y.reset}`);
      let l = await nt("Profile name (e.g. prod, staging, macbook)");
      if (!l) {
        console.log(`${Y.red}  Name is required.${Y.reset}`);
        continue;
      }
      let u = await nt("Host / IP address");
      if (!u) {
        console.log(`${Y.red}  Host is required.${Y.reset}`);
        continue;
      }
      let d = await nt("SSH user", "root"),
        f = await nt("SSH port", "22"),
        m = parseInt(f, 10) || 22,
        h = await nt("SSH key path (leave empty for SSH agent)", ""),
        p = await Ga(
          "Operating system",
          ["almalinux9", "macos", "ubuntu", "debian", "other"],
          "almalinux9",
        ),
        g = await as("Allow sudo commands?", !0),
        y = { host: u, user: d };
      (m !== 22 && (y.port = m),
        h && (y.key = h),
        p !== "other" && (y.os = p),
        g && (y.sudo = !0),
        (s[l] = y),
        console.log(`
  ${Y.green}\u2713${Y.reset} Profile "${l}" added: ${d}@${u}${m !== 22 ? `:${m}` : ""}${p !== "other" ? ` [${p}]` : ""}`),
        (r = await as(
          `
Add another server?`,
          !1,
        )));
    }
    (tt.existsSync(t) || tt.mkdirSync(t, { recursive: !0 }),
      tt.writeFileSync(
        e,
        JSON.stringify(s, null, 2) +
          `
`,
        "utf-8",
      ),
      console.log(`
${Y.green}\u2713 Saved .nex/servers.json (${Object.keys(s).length} profile${Object.keys(s).length !== 1 ? "s" : ""})${Y.reset}`));
    let i = cs.join(process.cwd(), ".gitignore");
    (tt.existsSync(i) &&
      (tt.readFileSync(i, "utf-8").includes(".nex/") ||
        ((await as("Add .nex/ to .gitignore?", !0)) &&
          (tt.appendFileSync(
            i,
            `
# nex-code server profiles
.nex/
`,
          ),
          console.log(
            `${Y.green}\u2713 Added .nex/ to .gitignore${Y.reset}`,
          )))),
      (await as(
        `
Set up deploy configs (.nex/deploy.json)?`,
        !1,
      )) && (await Cp(s, t)),
      console.log(`
${Y.dim}Use /servers to list profiles, /servers ping to check connectivity.${Y.reset}
`));
  }
  async function Cp(t, e) {
    let n = e || cs.join(process.cwd(), Rp),
      o = cs.join(n, "deploy.json"),
      s = {};
    if (tt.existsSync(o))
      try {
        s = JSON.parse(tt.readFileSync(o, "utf-8"));
      } catch {}
    if (!t) {
      let u = cs.join(n, "servers.json");
      if (tt.existsSync(u))
        try {
          t = JSON.parse(tt.readFileSync(u, "utf-8"));
        } catch {
          t = {};
        }
      else t = {};
    }
    let r = Object.keys(t);
    (console.log(`
${Y.bold}${Y.cyan}\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557${Y.reset}`),
      console.log(
        `${Y.bold}${Y.cyan}\u2551   Deploy Config Wizard               \u2551${Y.reset}`,
      ),
      console.log(`${Y.bold}${Y.cyan}\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D${Y.reset}
`));
    let i = Object.keys(s);
    i.length > 0 &&
      console.log(`${Y.dim}Existing deploy configs: ${i.join(", ")}${Y.reset}`);
    let a = { ...s },
      l = !0;
    for (; l; ) {
      console.log(`
${Y.bold}\u2500\u2500\u2500 New Deploy Config \u2500\u2500\u2500${Y.reset}`);
      let u = await nt("Config name (e.g. prod, staging)");
      if (!u) {
        console.log(`${Y.red}  Name is required.${Y.reset}`);
        continue;
      }
      let d;
      r.length > 0
        ? (d = await Ga("Target server", r, r[0]))
        : (d = await nt("Target server (profile name or user@host)"));
      let f = await Ga("Deploy method", ["rsync", "git"], "rsync"),
        m = "",
        h = [],
        p = "";
      if (f === "rsync") {
        m = await nt("Local path to sync (e.g. dist/ or ./build)", "dist/");
        let x = await nt(
          "Exclude paths (comma-separated, e.g. node_modules,.env)",
          "node_modules,.env",
        );
        h = x
          ? x
              .split(",")
              .map((_) => _.trim())
              .filter(Boolean)
          : [];
      } else
        p = await nt(
          "Branch to pull (leave empty for current remote branch)",
          "main",
        );
      let g = await nt(
        f === "git"
          ? "Remote repo path (e.g. /home/jarvis/my-app)"
          : "Remote destination path (e.g. /var/www/app)",
      );
      if (!g) {
        console.log(`${Y.red}  Remote path is required.${Y.reset}`);
        continue;
      }
      let y = await nt(
          "Command to run on remote after deploy (leave empty to skip)",
          "",
        ),
        w = await nt(
          "Health check URL or remote command (leave empty to skip)",
          "",
        ),
        k = { server: d, method: f, remote_path: g };
      (f === "rsync"
        ? ((k.local_path = m), h.length > 0 && (k.exclude = h))
        : p && (k.branch = p),
        y && (k.deploy_script = y),
        w && (k.health_check = w),
        (a[u] = k));
      let R =
        f === "git"
          ? `${d}:${g}${p ? ` (${p})` : ""}`
          : `${m.endsWith("/") ? m : m + "/"} \u2192 ${d}:${g}`;
      (console.log(`
  ${Y.green}\u2713${Y.reset} Deploy config "${u}": [${f}] ${R}`),
        y && console.log(`  ${Y.dim}  Then: ${y}${Y.reset}`),
        w && console.log(`  ${Y.dim}  Health: ${w}${Y.reset}`),
        (l = await as(
          `
Add another deploy config?`,
          !1,
        )));
    }
    (tt.existsSync(n) || tt.mkdirSync(n, { recursive: !0 }),
      tt.writeFileSync(
        o,
        JSON.stringify(a, null, 2) +
          `
`,
        "utf-8",
      ),
      console.log(`
${Y.green}\u2713 Saved .nex/deploy.json (${Object.keys(a).length} config${Object.keys(a).length !== 1 ? "s" : ""})${Y.reset}`),
      console.log(`${Y.dim}Use: deploy prod  (or with explicit params)${Y.reset}
`));
  }
  Ap.exports = { runServerWizard: ux, runDeployWizard: Cp, setWizardRL: lx };
});
var Ka = H((Wv, Ip) => {
  "use strict";
  var dx = require("os"),
    Np = require("path"),
    Xs = require("fs"),
    Js = Np.join(dx.homedir(), ".nex-code", "model-routing.json"),
    vr = {
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
    Mp = ["agentic", "frontend", "sysadmin", "data", "coding"];
  function fx(t) {
    if (!t || t.length < 8) return null;
    for (let e of Mp) {
      let n = vr[e];
      if (!n.pattern || n.pattern.test(t)) return n;
    }
    return vr.coding;
  }
  function Pp() {
    try {
      if (Xs.existsSync(Js)) return JSON.parse(Xs.readFileSync(Js, "utf-8"));
    } catch {}
    return {};
  }
  function px(t) {
    let e = vr[t];
    return e?.envVar && process.env[e.envVar]
      ? process.env[e.envVar]
      : Pp()[t] || null;
  }
  function mx(t) {
    let e = Np.dirname(Js);
    (Xs.existsSync(e) || Xs.mkdirSync(e, { recursive: !0 }),
      Xs.writeFileSync(Js, JSON.stringify(t, null, 2)));
  }
  Ip.exports = {
    CATEGORIES: vr,
    DETECTION_ORDER: Mp,
    detectCategory: fx,
    getModelForCategory: px,
    saveRoutingConfig: mx,
    loadRoutingConfig: Pp,
    ROUTING_CONFIG_PATH: Js,
  };
});
var Rr = H((Bv, jp) => {
  "use strict";
  var Tr = require("os"),
    Vs = require("path"),
    ze = require("fs"),
    hx = require("axios"),
    gx = require("https"),
    Sr = Vs.join(Tr.homedir(), ".nex-code", "known-models.json"),
    $x = "https://ollama.com/api/tags",
    yx = 60,
    wx = {
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
  function Ya() {
    try {
      if (ze.existsSync(Sr)) return JSON.parse(ze.readFileSync(Sr, "utf-8"));
    } catch {}
    return { benchmarked: [], lastChecked: null };
  }
  function bx(t) {
    let e = Vs.dirname(Sr);
    (ze.existsSync(e) || ze.mkdirSync(e, { recursive: !0 }),
      ze.writeFileSync(Sr, JSON.stringify(t, null, 2)));
  }
  function _x(t) {
    let e = Ya(),
      n = new Set(e.benchmarked);
    for (let o of t) n.add(o);
    ((e.benchmarked = [...n]),
      (e.lastChecked = new Date().toISOString()),
      bx(e));
  }
  async function Lp() {
    let t = process.env.OLLAMA_API_KEY;
    if (!t) throw new Error("OLLAMA_API_KEY not set");
    let e = new gx.Agent({ keepAlive: !0 });
    return (
      (
        await hx.get($x, {
          headers: { Authorization: `Bearer ${t}` },
          timeout: 15e3,
          httpsAgent: e,
        })
      ).data?.models || []
    )
      .map((o) => (o.name || o.model || "").replace(/:latest$/, ""))
      .filter(Boolean);
  }
  async function xx() {
    let t = await Lp(),
      e = Ya(),
      n = new Set(e.benchmarked),
      o = t.filter((s) => !n.has(s));
    return { allCloud: t, newModels: o, store: e };
  }
  var za = "<!-- nex-benchmark-start -->",
    Er = "<!-- nex-benchmark-end -->",
    kx = {
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
  function vx(t) {
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
  function Dp(t, e) {
    let n = ["\u{1F947}", "\u{1F948}", "\u{1F949}"],
      o = (e || new Date().toISOString()).split("T")[0],
      s = t
        .filter((r) => r.score >= yx)
        .map((r, i) => {
          let a = n[i] || "\u2014",
            l = vx(wx[r.model]),
            u = kx[r.model] || "\u2014",
            d = `${(r.avgLatency / 1e3).toFixed(1)}s`,
            f = i === 0 ? `**${r.score}**` : String(r.score);
          return `| ${a} | \`${r.model}\` | ${f} | ${d} | ${l} | ${u} |`;
        }).join(`
`);
    return `${za}
<!-- Updated: ${o} \u2014 run \`/benchmark --discover\` after new Ollama Cloud releases -->

| Rank | Model | Score | Avg Latency | Context | Best For |
|---|---|---|---|---|---|
${s}

> Rankings are nex-code-specific: tool name accuracy, argument validity, schema compliance.
> Toolathon (Minimax SOTA) measures different task types \u2014 run \`/benchmark --discover\` after model releases.
${Er}`;
  }
  function Sx(t, e) {
    if (!ze.existsSync(e)) return !1;
    let n = ze.readFileSync(e, "utf-8"),
      o = n.indexOf(za),
      s = n.indexOf(Er);
    if (o === -1 || s === -1) return !1;
    let r = n.slice(0, o),
      i = n.slice(s + Er.length),
      a = Dp(t);
    return (ze.writeFileSync(e, r + a + i), !0);
  }
  function Ex(t) {
    let e = Vs.join(Tr.homedir(), ".nex-code", "models.env");
    if (!ze.existsSync(e) || t.length === 0)
      return { updated: !1, reason: "models.env not found or empty summary" };
    let n = t[0],
      o = ze.readFileSync(e, "utf-8"),
      r = o.match(/^DEFAULT_MODEL=(\S+)/m)?.[1];
    if (r === n.model) return { updated: !1, reason: "winner unchanged" };
    let i = t.find((l) => l.model === r);
    if (i && n.score - i.score < 5)
      return {
        updated: !1,
        reason: `margin ${(n.score - i.score).toFixed(1)}pts < 5pts threshold`,
      };
    let a = new Date().toISOString().split("T")[0];
    return (
      (o = o
        .replace(/^DEFAULT_MODEL=\S+/m, `DEFAULT_MODEL=${n.model}`)
        .replace(
          /^# Last reviewed:.*$/m,
          `# Last reviewed: ${a} (after /benchmark, ${n.model} wins nex-code tasks)`,
        )),
      ze.writeFileSync(e, o),
      { updated: !0, previousModel: r, newModel: n.model }
    );
  }
  function Tx(t) {
    let { saveRoutingConfig: e } = Ka(),
      n = Vs.join(Tr.homedir(), ".nex-code", "models.env"),
      o = [],
      s = Object.entries(t).filter(([, a]) => a.score > 0);
    if (s.length === 0) return { saved: !1, envUpdated: !1, changes: [] };
    let r = {};
    for (let [a, l] of s)
      ((r[a] = l.model), o.push(`${a}: ${l.model} (${l.score}/100)`));
    e(r);
    let i = !1;
    if (ze.existsSync(n)) {
      let a = ze.readFileSync(n, "utf-8"),
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
      if (a.includes(d)) {
        let m = a.indexOf(d),
          h = a.indexOf(f);
        h !== -1 &&
          (a =
            a.slice(0, m) +
            `${d}
${u}
${f}` +
            a.slice(h + f.length));
      } else
        a += `
${d}
${u}
${f}
`;
      (ze.writeFileSync(n, a), (i = !0));
    }
    return { saved: !0, envUpdated: i, changes: o };
  }
  var Rx = /thinking|reasoning|instruct|planner|orchestrat/i;
  function Cx(t) {
    return Rx.test(t);
  }
  function Ax(t) {
    if (!t || t.length === 0) return { updated: !1 };
    let e = Vs.join(Tr.homedir(), ".nex-code", "models.env");
    if (!ze.existsSync(e)) return { updated: !1 };
    let n = ze.readFileSync(e, "utf-8"),
      o = n.match(/^NEX_ORCHESTRATOR_MODEL=(.+)$/m),
      s = o ? o[1].trim() : null,
      i = [...t].sort((d, f) => f.overall - d.overall)[0],
      a = s ? t.find((d) => d.model === s) : null,
      l = a ? a.overall : 0;
    if (i.model === s) return { updated: !1 };
    if (l > 0 && i.overall < l * 1.05) return { updated: !1 };
    let u = `NEX_ORCHESTRATOR_MODEL=${i.model}`;
    return (
      o
        ? (n = n.replace(/^NEX_ORCHESTRATOR_MODEL=.+$/m, u))
        : (n += `
${u}
`),
      ze.writeFileSync(e, n),
      { updated: !0, previousModel: s, newModel: i.model }
    );
  }
  jp.exports = {
    findNewModels: xx,
    fetchCloudModels: Lp,
    loadKnownModels: Ya,
    markBenchmarked: _x,
    updateReadme: Sx,
    updateModelsEnv: Ex,
    updateRoutingConfig: Tx,
    generateBenchmarkBlock: Dp,
    checkOrchestratorCandidate: Cx,
    updateOrchestratorModel: Ax,
    SENTINEL_START: za,
    SENTINEL_END: Er,
  };
});
var Cn = H((Hv, Kp) => {
  "use strict";
  var { C: F } = Ae(),
    Ox = Oe(),
    { TOOL_DEFINITIONS: qp } = Et(),
    Qs = [
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
          let n = e?.function?.parameters || {},
            o = n.required || [],
            s = Object.keys(n.properties || {});
          return (
            o.every((r) => t[r] !== void 0) &&
            Object.keys(t).every((r) => s.includes(r))
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
    Fp = [
      "minimax-m2.7:cloud",
      "qwen3-coder:480b",
      "kimi-k2:1t",
      "devstral-2:123b",
      "devstral-small-2:24b",
    ],
    Up = ["minimax-m2.7:cloud", "qwen3-coder:480b", "devstral-2:123b"],
    Nx = 7,
    Cr = {
      producedToolCall: 0.2,
      correctTool: 0.35,
      validArgs: 0.3,
      schemaCompliant: 0.15,
    },
    Mx =
      "You are a coding assistant. Use the provided tools to help with file operations, search, and development tasks. Only call a tool when one is clearly needed to answer the request. Do not call a tool for questions you can answer from general knowledge.";
  async function Wp(t, e) {
    let n = {
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
        { role: "system", content: Mx },
        { role: "user", content: t.prompt },
      ],
      s = Date.now();
    try {
      let r = await Ox.callChat(o, qp, {
        provider: "ollama",
        model: e,
        temperature: 0,
        timeout: 9e4,
      });
      n.latencyMs = Date.now() - s;
      let i = r.tool_calls || [];
      if (t.expectedTool === null) {
        let a = i.length === 0;
        ((n.producedToolCall = a),
          (n.correctTool = a),
          (n.validArgs = !0),
          (n.schemaCompliant = !0));
      } else if (i.length > 0) {
        let a = i[0],
          l = a.function?.name || "unknown",
          u = a.function?.arguments || {};
        ((n.producedToolCall = !0), (n.toolCalled = l));
        let d = Array.isArray(t.expectedTool)
          ? t.expectedTool
          : [t.expectedTool];
        if (((n.correctTool = d.includes(l)), n.correctTool)) {
          let f = qp.find((m) => m.function?.name === l);
          if (((n.validArgs = !!t.validateArgs(u, f)), f)) {
            let m = f.function?.parameters || {},
              h = m.required || [],
              p = Object.keys(m.properties || {});
            n.schemaCompliant =
              h.every((g) => u[g] !== void 0) &&
              Object.keys(u).every((g) => p.includes(g));
          }
        }
      }
    } catch (r) {
      ((n.latencyMs = Date.now() - s), (n.error = r.message.slice(0, 120)));
    }
    return n;
  }
  function Zs(t) {
    return t.error
      ? 0
      : ((t.producedToolCall ? Cr.producedToolCall : 0) +
          (t.correctTool ? Cr.correctTool : 0) +
          (t.validArgs ? Cr.validArgs : 0) +
          (t.schemaCompliant ? Cr.schemaCompliant : 0)) *
          100;
  }
  var Px = {
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
  function Xa(t) {
    return Object.entries(t)
      .map(([e, n]) => {
        let o = n.map(Zs),
          s = o.reduce((a, l) => a + l, 0) / o.length,
          r = (a) => Math.round((n.filter(a).length / n.length) * 100),
          i = {};
        for (let a of ["coding", "frontend", "sysadmin", "data", "agentic"]) {
          let l = n.filter((d) => Px[d.category] === a);
          if (l.length === 0) continue;
          let u = l.map(Zs).reduce((d, f) => d + f, 0) / l.length;
          i[a] = Math.round(u * 10) / 10;
        }
        return {
          model: e,
          score: Math.round(s * 10) / 10,
          toolCallRate: r(
            (a) =>
              !a.error && (a.producedToolCall || a.category === "reasoning"),
          ),
          correctRate: r((a) => a.correctTool),
          validArgsRate: r((a) => a.validArgs),
          schemaRate: r((a) => a.schemaCompliant),
          avgLatency: Math.round(
            n.reduce((a, l) => a + l.latencyMs, 0) / n.length,
          ),
          errorCount: n.filter((a) => a.error).length,
          categoryScores: i,
          results: n,
        };
      })
      .sort((e, n) => n.score - e.score);
  }
  function Ix(t) {
    let e = {};
    for (let n of ["coding", "frontend", "sysadmin", "data", "agentic"]) {
      let o = t
        .filter((s) => s.categoryScores[n] !== void 0)
        .sort((s, r) => r.categoryScores[n] - s.categoryScores[n]);
      o.length > 0 &&
        (e[n] = { model: o[0].model, score: o[0].categoryScores[n] });
    }
    return e;
  }
  function Bp(t, e) {
    let n = `nex-code Model Benchmark  (${e} tasks \xB7 ollama cloud)`,
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
      s = o.reduce((u, d) => u + d.width + 1, 0) + 1,
      r = "\u2500".repeat(s);
    (console.log(`
${F.bold}${n}${F.reset}`),
      console.log(r));
    let i = o.map((u) => u.label.padEnd(u.width)).join(" ");
    if (
      (console.log(`${F.dim}${i}${F.reset}`),
      console.log(r),
      t.forEach((u, d) => {
        let f = String(d + 1).padEnd(o[0].width),
          m = u.model.slice(0, o[1].width).padEnd(o[1].width),
          h = String(u.score).padEnd(o[2].width),
          p = `${u.toolCallRate}%`.padEnd(o[3].width),
          g = `${u.correctRate}%`.padEnd(o[4].width),
          y = `${u.validArgsRate}%`.padEnd(o[5].width),
          w = `${u.schemaRate}%`.padEnd(o[6].width),
          k = `${(u.avgLatency / 1e3).toFixed(1)}s`.padEnd(o[7].width),
          R =
            u.errorCount > 0
              ? `${F.red}${u.errorCount}${F.reset}`
              : `${F.dim}0${F.reset}`,
          x = u.score >= 80 ? F.green : u.score >= 60 ? F.yellow : F.red,
          _ = d === 0 ? `${F.yellow}${f}${F.reset}` : `${F.dim}${f}${F.reset}`;
        console.log(
          `${_} ${x}${m}${F.reset} ${F.bold}${x}${h}${F.reset} ${p} ${g} ${y} ${w} ${F.dim}${k}${F.reset} ${R}`,
        );
      }),
      console.log(r),
      t.length > 0)
    ) {
      let u = t[0];
      if (
        (console.log(`
${F.bold}${F.green}Winner: ${u.model}${F.reset}  score ${u.score}/100`),
        t.length > 1)
      ) {
        let d = (u.score - t[1].score).toFixed(1);
        console.log(`${F.dim}+${d} pts over ${t[1].model}${F.reset}`);
      }
    }
    let a = ["coding", "frontend", "sysadmin", "data", "agentic"];
    if (t.some((u) => Object.keys(u.categoryScores).length > 1)) {
      console.log(`
${F.bold}Best model per task type:${F.reset}`);
      for (let u of a) {
        let d = t
          .filter((p) => p.categoryScores[u] !== void 0)
          .sort((p, g) => g.categoryScores[u] - p.categoryScores[u]);
        if (d.length === 0) continue;
        let f = d[0],
          m = f.categoryScores[u],
          h = m >= 80 ? F.green : m >= 60 ? F.yellow : F.red;
        console.log(
          `  ${F.dim}${u.padEnd(10)}${F.reset} ${h}${f.model}${F.reset}  ${F.dim}${m}/100${F.reset}`,
        );
      }
    }
    console.log();
  }
  async function Lx({ models: t, quick: e = !1, onProgress: n } = {}) {
    let o = e ? Qs.slice(0, Nx) : Qs,
      s = t?.length > 0 ? t : e ? Up : Fp,
      r = {};
    for (let a of s) {
      r[a] = [];
      for (let l of o) {
        n?.({ model: a, task: l.id, done: !1 });
        let u = await Wp(l, a);
        (r[a].push(u),
          n?.({
            model: a,
            task: l.id,
            done: !0,
            score: Zs(u),
            error: u.error,
          }));
      }
    }
    let i = Xa(r);
    return (Bp(i, o.length), i);
  }
  async function Dx({
    newModels: t,
    existingRanking: e = [],
    onProgress: n,
  } = {}) {
    if (!t || t.length === 0) return e;
    let o = {};
    for (let i of t) {
      o[i] = [];
      for (let a of Qs) {
        n?.({ model: i, task: a.id, done: !1 });
        let l = await Wp(a, i);
        (o[i].push(l),
          n?.({
            model: i,
            task: a.id,
            done: !0,
            score: Zs(l),
            error: l.error,
          }));
      }
    }
    let r = [...Xa(o)];
    for (let i of e) r.find((a) => a.model === i.model) || r.push(i);
    return (r.sort((i, a) => a.score - i.score), Bp(r, Qs.length), r);
  }
  var Ar = [
    {
      id: "simple_question",
      name: "Simple Convergence",
      prompt: "What is 2+2?",
      maxTurns: 3,
      successCriteria: ["4"],
    },
  ];
  function Hp(t) {
    let e = require("fs"),
      o = require("path").join(
        t || process.cwd(),
        ".nex",
        "benchmark-config.json",
      );
    if (!e.existsSync(o))
      return (
        console.log(`${F.yellow}No scenarios configured.${F.reset} Create ${F.dim}.nex/benchmark-config.json${F.reset} to define your benchmark scenarios.
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
        Ar
      );
    try {
      let s = JSON.parse(e.readFileSync(o, "utf-8"));
      return !Array.isArray(s.scenarios) || s.scenarios.length === 0
        ? (console.log(`${F.yellow}benchmark-config.json has no scenarios \u2014 using defaults.${F.reset}
`),
          Ar)
        : s.scenarios;
    } catch (s) {
      return (
        console.log(`${F.yellow}Failed to parse benchmark-config.json: ${s.message}${F.reset}
`),
        Ar
      );
    }
  }
  function Gp(t, e) {
    let {
        scoreMessages: n,
        _extractToolCalls: o,
        _getLastAssistantText: s,
      } = or(),
      r = n(t),
      i = r.score,
      a = [],
      l = s(t).toLowerCase();
    e.successCriteria.every((m) => l.includes(m.toLowerCase())) &&
      ((i = Math.min(10, i + 1)), a.push("+1.0 all success criteria met"));
    let d = o(t);
    (d.length < e.maxTurns / 2 &&
      ((i = Math.min(10, i + 0.5)),
      a.push(`+0.5 efficient (${d.length} tool calls < ${e.maxTurns / 2})`)),
      (i = Math.round(i * 10) / 10));
    let f = i >= 9 ? "A" : i >= 8 ? "B" : i >= 7 ? "C" : i >= 6 ? "D" : "F";
    return {
      score: i,
      grade: f,
      issues: r.issues,
      summary: r.summary,
      bonuses: a,
    };
  }
  async function jx(t, e = {}) {
    let { spawn: n } = require("child_process"),
      o = require("fs"),
      s = require("path"),
      r = require("os"),
      i = s.join(r.tmpdir(), `nex-bench-${t.id}-${Date.now()}.txt`);
    o.writeFileSync(i, t.prompt, "utf-8");
    let a = s.resolve(__dirname, "..", "bin", "nex-code.js"),
      l = e.cwd || process.cwd(),
      u = [
        a,
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
        let f = n(process.execPath, u, {
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
          let y = s.join(l, ".nex", "sessions", "_autosave.json"),
            w = [];
          if (o.existsSync(y))
            try {
              w = JSON.parse(o.readFileSync(y, "utf-8")).messages || [];
            } catch {}
          d({ messages: w, exitCode: g || 0, timedOut: h });
        }),
          f.stdout.resume(),
          f.stderr.resume());
      })
    );
  }
  function qx(t, e, n) {
    let o =
        t.length > 0
          ? Math.round((t.reduce((l, u) => l + u.score, 0) / t.length) * 10) /
            10
          : 0,
      s = o >= 9 ? "A" : o >= 8 ? "B" : o >= 7 ? "C" : o >= 6 ? "D" : "F",
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
    let a = `Overall: ${o}/10 (${s})  \xB7  v${e}  \xB7  ${n}`;
    (console.log(`\u2502  ${a.substring(0, r - 4).padEnd(r - 4)} \u2502`),
      console.log(`\u2514${"\u2500".repeat(r + 1)}\u2518
`));
  }
  function Fx(t = 10) {
    let e = require("fs"),
      o = require("path").join(process.cwd(), ".nex", "benchmark-history.json");
    if (!e.existsSync(o)) {
      console.log(`${F.yellow}No score history yet. Run a session first.${F.reset}
`);
      return;
    }
    let s = [];
    try {
      s = JSON.parse(e.readFileSync(o, "utf-8"));
    } catch {
      s = [];
    }
    if (!Array.isArray(s) || s.length === 0) {
      console.log(`${F.yellow}Score history is empty.${F.reset}
`);
      return;
    }
    let r = s.slice(-t);
    console.log(`
${F.bold}Score History (last ${r.length} session${r.length === 1 ? "" : "s"}):${F.reset}`);
    for (let i of r) {
      let a = (i.date || "").replace("T", " ").substring(0, 16),
        l = (i.version || "?").padEnd(8),
        u = (i.model || "?").substring(0, 12).padEnd(12),
        d = `${i.score}/10`.padStart(6),
        f = i.grade || "?",
        m =
          i.issues && i.issues.length > 0
            ? `${F.yellow}\u26A0 ${i.issues
                .slice(0, 2)
                .map((p) => p.substring(0, 30))
                .join(", ")}${F.reset}`
            : `${F.green}\u2713${F.reset}`,
        h = i.score >= 8 ? F.green : i.score >= 6 ? F.yellow : F.red;
      console.log(
        `  ${F.dim}${a}${F.reset}  ${F.dim}v${l}${F.reset}  ${F.dim}${u}${F.reset}  ${h}${d}  ${f}${F.reset}  ${m}`,
      );
    }
    console.log();
  }
  async function Ux({ dryRun: t = !1, model: e, cwd: n, onProgress: o } = {}) {
    let s = Nn(),
      r = Hp(n);
    if (t) {
      console.log(`
${F.bold}Jarvis Benchmark \u2014 Scenarios (dry-run):${F.reset}
`);
      for (let l of r)
        (console.log(
          `  ${F.cyan}${l.id.padEnd(20)}${F.reset} ${F.dim}${l.name}${F.reset}  maxTurns=${l.maxTurns}`,
        ),
          console.log(`    ${F.dim}${l.prompt.substring(0, 80)}${F.reset}`));
      return (console.log(), []);
    }
    let i = (() => {
        if (e) return e;
        try {
          let { getActiveModel: l } = Un();
          return (l && l()) || "unknown";
        } catch {
          return "unknown";
        }
      })(),
      a = [];
    for (let l of r) {
      (o?.({ id: l.id, name: l.name, done: !1 }),
        console.log(`
${F.dim}Running scenario: ${l.name}...${F.reset}`));
      let { messages: u, timedOut: d } = await jx(l, { model: i, cwd: n }),
        f;
      d || u.length === 0
        ? (f = {
            score: 0,
            grade: "F",
            issues: [d ? "Scenario timed out" : "No messages produced"],
            summary: "No output",
            bonuses: [],
          })
        : (f = Gp(u, l));
      let m = {
        id: l.id,
        name: l.name,
        score: f.score,
        grade: f.grade,
        issues: f.issues,
        bonuses: f.bonuses,
      };
      (a.push(m),
        o?.({
          id: l.id,
          name: l.name,
          done: !0,
          score: f.score,
          grade: f.grade,
        }));
      try {
        let { appendScoreHistory: h } = or();
        h(f.score, {
          version: s.version,
          model: i,
          sessionName: `bench:${l.id}`,
          issues: f.issues,
        });
      } catch {}
    }
    return (qx(a, s.version, i), a);
  }
  Kp.exports = {
    runBenchmark: Lx,
    runDiscoverBenchmark: Dx,
    buildSummary: Xa,
    buildCategoryWinners: Ix,
    TASKS: Qs,
    scoreResult: Zs,
    DEFAULT_MODELS: Fp,
    QUICK_MODELS: Up,
    runJarvisBenchmark: Ux,
    showScoreTrend: Fx,
    loadScenarios: Hp,
    DEFAULT_SCENARIOS: Ar,
    scoreJarvisScenario: Gp,
  };
});
var tm = H((Gv, em) => {
  "use strict";
  var Wx = require("os"),
    Xp = require("path"),
    Ja = require("fs"),
    { callWithRetry: Yp } = Yo(),
    { parseModelSpec: Bx } = Oe(),
    { extractJSON: zp, DECOMPOSE_PROMPT: Hx, SYNTHESIZE_PROMPT: Gx } = Us(),
    { C: yt } = Ae(),
    Or = Xp.join(Wx.homedir(), ".nex-code", "orchestrator-bench.json"),
    Jp = [
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
  function Vp(t, e) {
    if (!Array.isArray(t)) return 0;
    let n = 0;
    n += 1.5;
    let o = Math.abs(t.length - e.expectedSubTasks);
    (o === 0 ? (n += 3) : o === 1 && (n += 1.5),
      t.every(
        (l) => l.task && typeof l.task == "string" && l.task.length > 0,
      ) && (n += 2));
    let r = t.flatMap((l) => (Array.isArray(l.scope) ? l.scope : [])),
      i = new Set(r);
    return (
      r.length === i.size && (n += 2),
      t.every(
        (l) =>
          typeof l.estimatedCalls == "number" ||
          typeof l.estimatedSshCalls == "number",
      ) && (n += 1.5),
      Math.min(10, Math.round(n * 10) / 10)
    );
  }
  function Qp(t, e) {
    if (!t || typeof t != "object") return 0;
    let n = 0;
    ((n += 1.5),
      t.summary && t.summary.length > 10 && (n += 2),
      t.commitMessage && t.commitMessage.length > 5 && (n += 2));
    let o = Array.isArray(t.conflicts) ? t.conflicts : [];
    return (
      (e.expectedConflicts === 0 && o.length === 0) ||
      (e.expectedConflicts > 0 && o.length > 0)
        ? (n += 2.5)
        : e.expectedConflicts > 0 && o.length === 0 && (n += 0),
      Array.isArray(t.filesChanged) && t.filesChanged.length > 0 && (n += 2),
      Math.min(10, Math.round(n * 10) / 10)
    );
  }
  async function Zp(t, e) {
    let n = {};
    if (e) {
      let s = Bx(e);
      (s.provider && (n.provider = s.provider), s.model && (n.model = s.model));
    }
    let o = Date.now();
    try {
      if (t.type === "decompose") {
        let s = Hx.replace("{maxSubTasks}", String(t.maxSubTasks)).replace(
            "{prompt}",
            t.prompt,
          ),
          r = await Yp(
            [
              { role: "system", content: s },
              { role: "user", content: t.prompt },
            ],
            [],
            n,
          ),
          i = zp(r.content || ""),
          a = Date.now() - o;
        return { score: Vp(i, t), latencyMs: a };
      }
      if (t.type === "synthesize") {
        let s = t.subResults.map((d, f) => {
            let m = d.status === "done" ? "SUCCESS" : "FAILED";
            return `--- Agent ${f + 1} [${m}] ---
Task: ${d.task}
Result: ${d.result}
Tools: ${d.toolsUsed.join(", ")}`;
          }).join(`

`),
          r = Gx.replace("{prompt}", t.prompt).replace("{results}", s),
          i = await Yp(
            [
              { role: "system", content: r },
              {
                role: "user",
                content: "Synthesize the sub-agent results above.",
              },
            ],
            [],
            n,
          ),
          a = zp(i.content || ""),
          l = Date.now() - o;
        return { score: Qp(a, t), latencyMs: l };
      }
      return {
        score: 0,
        latencyMs: 0,
        error: `Unknown scenario type: ${t.type}`,
      };
    } catch (s) {
      return { score: 0, latencyMs: Date.now() - o, error: s.message };
    }
  }
  async function Kx(t = {}) {
    let e = t.models || ["kimi-k2.5", "qwen3.5:397b", "minimax-m2.7:cloud"],
      n = t.onProgress || (() => {}),
      o = [];
    for (let r of e) {
      let i = { model: r, scores: [], latencies: [] },
        a = [],
        l = [];
      for (let h of Jp) {
        n({ model: r, scenario: h.id, done: !1 });
        let p = await Zp(h, r);
        (i.scores.push(p.score),
          i.latencies.push(p.latencyMs),
          h.type === "decompose" && a.push(p.score),
          h.type === "synthesize" && l.push(p.score),
          n({
            model: r,
            scenario: h.id,
            done: !0,
            score: p.score,
            error: p.error,
          }));
      }
      let u = a.length > 0 ? a.reduce((h, p) => h + p, 0) / a.length : 0,
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
    let s = Xp.dirname(Or);
    return (
      Ja.existsSync(s) || Ja.mkdirSync(s, { recursive: !0 }),
      Ja.writeFileSync(
        Or,
        JSON.stringify(
          { date: new Date().toISOString().slice(0, 10), results: o },
          null,
          2,
        ),
      ),
      o
    );
  }
  function Yx(t) {
    console.log(`
${yt.bold}${yt.cyan}Orchestrator Model Benchmark${yt.reset}
`);
    let e = `  ${"Model".padEnd(25)} ${"Decompose".padEnd(10)} ${"Synthesize".padEnd(11)} ${"Speed".padEnd(8)} ${"Score".padEnd(8)}`;
    (console.log(`${yt.dim}${e}${yt.reset}`),
      console.log(`  ${yt.dim}${"\u2500".repeat(65)}${yt.reset}`));
    for (let n of t) {
      let o =
          t.indexOf(n) === 0
            ? "\u{1F947}"
            : t.indexOf(n) === 1
              ? "\u{1F948}"
              : t.indexOf(n) === 2
                ? "\u{1F949}"
                : " ",
        s = `${(n.avgLatency / 1e3).toFixed(1)}s`;
      console.log(
        `${o} ${n.model.padEnd(25)} ${(n.decompose + "/10").padEnd(10)} ${(n.synthesize + "/10").padEnd(11)} ${s.padEnd(8)} ${yt.bold}${n.overall}/10${yt.reset}`,
      );
    }
    t.length > 0 &&
      (console.log(`
  ${yt.green}Best orchestrator: ${t[0].model} (${t[0].overall}/10)${yt.reset}`),
      console.log(`  ${yt.dim}Saved to ${Or}${yt.reset}
`));
  }
  em.exports = {
    runOrchestratorBenchmark: Kx,
    ORCHESTRATOR_SCENARIOS: Jp,
    scoreDecompose: Vp,
    scoreSynthesize: Qp,
    runScenario: Zp,
    printResults: Yx,
    RESULTS_PATH: Or,
  };
});
var om = H((Kv, sm) => {
  var zx = require("axios"),
    eo = require("fs"),
    nm = require("path"),
    Xx = "nex-code",
    Va = nm.join(process.cwd(), ".nex"),
    Qa = nm.join(Va, "last-version-check");
  eo.existsSync(Va) || eo.mkdirSync(Va, { recursive: !0 });
  async function Jx() {
    try {
      let t = Qx(),
        e = Date.now();
      if (t && e - t < 1440 * 60 * 1e3) return { hasNewVersion: !1 };
      Zx(e);
      let n = Vx(),
        s = (
          await zx.get(`https://registry.npmjs.org/${Xx}/latest`, {
            timeout: 5e3,
          })
        ).data.version,
        r = ek(s, n);
      return {
        hasNewVersion: r,
        latestVersion: r ? s : void 0,
        currentVersion: r ? n : void 0,
      };
    } catch {
      return { hasNewVersion: !1 };
    }
  }
  function Vx() {
    return Nn().version;
  }
  function Qx() {
    try {
      if (eo.existsSync(Qa)) {
        let t = eo.readFileSync(Qa, "utf8");
        return parseInt(t, 10);
      }
    } catch {}
    return null;
  }
  function Zx(t) {
    try {
      eo.writeFileSync(Qa, t.toString());
    } catch {}
  }
  function ek(t, e) {
    try {
      let n = t.split(".").map(Number),
        o = e.split(".").map(Number);
      return n[0] > o[0]
        ? !0
        : n[0] < o[0]
          ? !1
          : n[1] > o[1]
            ? !0
            : n[1] < o[1]
              ? !1
              : n[2] > o[2];
    } catch {
      return !1;
    }
  }
  sm.exports = { checkForNewVersion: Jx };
});
var $m = H((zv, gm) => {
  var tk = require("readline"),
    st = require("fs"),
    He = require("path"),
    { C: c, banner: nk, cleanupTerminal: rm } = Ae(),
    { isDark: sk } = fn(),
    {
      listProviders: tc,
      getActiveProviderName: An,
      listAllModels: Yv,
      setFallbackChain: ok,
      getFallbackChain: rk,
      getProvider: ik,
    } = Oe(),
    { flushAutoSave: im } = At(),
    { getActiveModel: Xt, setActiveModel: nc } = Un(),
    { printContext: am } = nr(),
    { loadAllSkills: ak, getSkillCommands: Mr, handleSkillCommand: ck } = nn(),
    {
      setReadlineInterface: lk,
      setAutoConfirm: uk,
      getAutoConfirm: Za,
      setAllowAlwaysHandler: dk,
    } = Xe(),
    { StickyFooter: fk } = gp(),
    St = process.cwd(),
    zt = null;
  function cm() {
    return zt?.signal ?? null;
  }
  var so = [
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
  function lm() {
    let t = Mr(),
      e = [...so, ...t],
      n = Math.max(...e.map((o) => o.cmd.length));
    console.log("");
    for (let { cmd: o, desc: s } of so)
      console.log(
        `  ${c.cyan}${o.padEnd(n + 2)}${c.reset}${c.dim}${s}${c.reset}`,
      );
    for (let { cmd: o, desc: s } of t)
      console.log(
        `  ${c.cyan}${o.padEnd(n + 2)}${c.reset}${c.dim}${s} ${c.yellow}[skill]${c.reset}`,
      );
    console.log(`
${c.dim}Type /help for detailed usage${c.reset}
`);
  }
  function um(t) {
    try {
      let e, n;
      (t.endsWith("/") || t.endsWith(He.sep)
        ? ((e = t), (n = ""))
        : ((e = He.dirname(t)), (n = He.basename(t))),
        e.startsWith("~") &&
          (e = He.join(require("os").homedir(), e.slice(1))));
      let o = He.isAbsolute(e) ? e : He.resolve(St, e);
      if (!st.existsSync(o) || !st.statSync(o).isDirectory()) return [];
      let s = st.readdirSync(o, { withFileTypes: !0 }),
        r = [];
      for (let i of s) {
        if (
          i.name.startsWith(".") ||
          i.name === "node_modules" ||
          (n && !i.name.startsWith(n))
        )
          continue;
        let a = t.endsWith("/") || t.endsWith(He.sep) ? t : He.dirname(t) + "/",
          l = a === "./" && !t.startsWith("./") ? i.name : a + i.name;
        r.push(i.isDirectory() ? l + "/" : l);
      }
      return r;
    } catch {
      return [];
    }
  }
  function dm(t) {
    if (t.startsWith("/")) {
      let o = [...so, ...Mr()],
        s = o.map((r) => r.cmd).filter((r) => r.startsWith(t));
      return [s.length ? s : o.map((r) => r.cmd), t];
    }
    let e = t.split(/\s+/),
      n = e[e.length - 1] || "";
    return n &&
      (n.includes("/") ||
        n.startsWith("./") ||
        n.startsWith("../") ||
        n.startsWith("~"))
      ? [um(n), n]
      : [[], t];
  }
  function fm() {
    console.log(`
${c.bold}${c.cyan}Commands:${c.reset}
  ${c.cyan}/help${c.reset}             ${c.dim}Show this help${c.reset}
  ${c.cyan}/model [spec]${c.reset}     ${c.dim}Show/switch model (e.g. openai:gpt-4o, claude-sonnet)${c.reset}
  ${c.cyan}/providers${c.reset}        ${c.dim}Show available providers and models${c.reset}
  ${c.cyan}/fallback [chain]${c.reset} ${c.dim}Show/set fallback chain (e.g. anthropic,openai,local)${c.reset}
  ${c.cyan}/tokens${c.reset}           ${c.dim}Show token usage and context budget${c.reset}
  ${c.cyan}/costs${c.reset}            ${c.dim}Show session token costs${c.reset}
  ${c.cyan}/budget [prov] [n]${c.reset}${c.dim}Show/set cost limits per provider${c.reset}
  ${c.cyan}/clear${c.reset}            ${c.dim}Clear conversation context${c.reset}
  ${c.cyan}/context${c.reset}          ${c.dim}Show project context${c.reset}
  ${c.cyan}/autoconfirm${c.reset}      ${c.dim}Toggle auto-confirm for file changes${c.reset}

${c.bold}${c.cyan}Sessions:${c.reset}
  ${c.cyan}/save [name]${c.reset}      ${c.dim}Save current session${c.reset}
  ${c.cyan}/load <name>${c.reset}      ${c.dim}Load a saved session${c.reset}
  ${c.cyan}/sessions${c.reset}         ${c.dim}List all saved sessions${c.reset}
  ${c.cyan}/resume${c.reset}           ${c.dim}Resume last session${c.reset}

${c.bold}${c.cyan}Memory:${c.reset}
  ${c.cyan}/remember <text>${c.reset}  ${c.dim}Save a memory (key=value or freeform)${c.reset}
  ${c.cyan}/forget <key>${c.reset}     ${c.dim}Delete a memory${c.reset}
  ${c.cyan}/memory${c.reset}           ${c.dim}Show all memories${c.reset}
  ${c.cyan}/learn${c.reset}            ${c.dim}Reflect on this session and auto-update memory + NEX.md${c.reset}
  ${c.cyan}/optimize${c.reset}         ${c.dim}Show context, memory health, and optimization tips${c.reset}

${c.bold}${c.cyan}Permissions:${c.reset}
  ${c.cyan}/permissions${c.reset}      ${c.dim}Show tool permissions${c.reset}
  ${c.cyan}/allow <tool>${c.reset}     ${c.dim}Auto-allow a tool${c.reset}
  ${c.cyan}/deny <tool>${c.reset}      ${c.dim}Block a tool${c.reset}

${c.bold}${c.cyan}Planning:${c.reset}
  ${c.cyan}/plan [task]${c.reset}      ${c.dim}Enter plan mode (analyze, don't execute)${c.reset}
  ${c.cyan}/plan status${c.reset}      ${c.dim}Show current plan progress${c.reset}
  ${c.cyan}/plan approve${c.reset}     ${c.dim}Approve current plan${c.reset}
  ${c.cyan}/plans${c.reset}            ${c.dim}List saved plans${c.reset}
  ${c.cyan}/auto [level]${c.reset}     ${c.dim}Set autonomy: interactive/semi-auto/autonomous${c.reset}

${c.bold}${c.cyan}Git:${c.reset}
  ${c.cyan}/commit [msg]${c.reset}    ${c.dim}Smart commit (analyze diff, suggest message)${c.reset}
  ${c.cyan}/diff${c.reset}             ${c.dim}Show current diff summary${c.reset}
  ${c.cyan}/branch [name]${c.reset}   ${c.dim}Create feature branch${c.reset}

${c.bold}${c.cyan}Extensibility:${c.reset}
  ${c.cyan}/mcp${c.reset}              ${c.dim}Show MCP servers and tools${c.reset}
  ${c.cyan}/mcp connect${c.reset}      ${c.dim}Connect all configured MCP servers${c.reset}
  ${c.cyan}/hooks${c.reset}            ${c.dim}Show configured hooks${c.reset}
  ${c.cyan}/skills${c.reset}           ${c.dim}List loaded skills${c.reset}
  ${c.cyan}/skills enable${c.reset}    ${c.dim}Enable a skill by name${c.reset}
  ${c.cyan}/skills disable${c.reset}   ${c.dim}Disable a skill by name${c.reset}

${c.bold}${c.cyan}Tasks:${c.reset}
  ${c.cyan}/tasks${c.reset}            ${c.dim}Show current task list${c.reset}
  ${c.cyan}/tasks clear${c.reset}      ${c.dim}Clear all tasks${c.reset}

${c.bold}${c.cyan}Undo / Redo:${c.reset}
  ${c.cyan}/undo${c.reset}             ${c.dim}Undo last file change${c.reset}
  ${c.cyan}/redo${c.reset}             ${c.dim}Redo last undone change${c.reset}
  ${c.cyan}/history${c.reset}          ${c.dim}Show file change history${c.reset}

  ${c.cyan}/benchmark${c.reset}        ${c.dim}Rank Ollama Cloud models on nex-code tool-calling tasks${c.reset}
  ${c.cyan}/benchmark --quick${c.reset}${c.dim}  Fast run: 7 tasks, 3 models${c.reset}
  ${c.cyan}/benchmark --models=a,b${c.reset}${c.dim}  Custom model list${c.reset}

  ${c.cyan}/exit${c.reset}             ${c.dim}Quit${c.reset}
`);
  }
  function pm(t) {
    let n = Math.round((t / 100) * 30),
      o = 30 - n;
    return `  ${t > 80 ? c.red : t > 50 ? c.yellow : c.green}${"\u2588".repeat(n)}${c.dim}${"\u2591".repeat(o)}${c.reset} ${t}%`;
  }
  function ec() {
    let t = tc(),
      e = An(),
      n = Xt();
    console.log(`
${c.bold}${c.cyan}Providers:${c.reset}`);
    for (let o of t) {
      let s = o.provider === e,
        r = o.configured
          ? `${c.green}\u2713${c.reset}`
          : `${c.red}\u2717${c.reset}`,
        i = s ? ` ${c.cyan}(active)${c.reset}` : "";
      console.log(`  ${r} ${c.bold}${o.provider}${c.reset}${i}`);
      for (let a of o.models) {
        let l = a.id === n.id && s ? ` ${c.yellow}\u25C4${c.reset}` : "";
        console.log(`    ${c.dim}${a.id}${c.reset} \u2014 ${a.name}${l}`);
      }
    }
    console.log();
  }
  async function mm(t, e) {
    let [n, ...o] = t.split(/\s+/);
    switch (n) {
      case "/help":
        return (fm(), !0);
      case "/model": {
        let s = o.join(" ").trim();
        if (!s) {
          if (e) {
            let { showModelPicker: r } = wp();
            await r(e);
          } else {
            let r = Xt(),
              i = An();
            (console.log(
              `${c.bold}${c.cyan}Active model:${c.reset} ${c.dim}${i}:${r.id} (${r.name})${c.reset}`,
            ),
              console.log(
                `${c.gray}Use /model <provider:model> to switch. /providers to see all.${c.reset}`,
              ));
          }
          return !0;
        }
        if (s === "list") return (ec(), !0);
        if (nc(s)) {
          let r = Xt(),
            i = An();
          console.log(
            `${c.green}Switched to ${i}:${r.id} (${r.name})${c.reset}`,
          );
        } else
          (console.log(`${c.red}Unknown model: ${s}${c.reset}`),
            console.log(
              `${c.gray}Use /providers to see available models${c.reset}`,
            ));
        return !0;
      }
      case "/providers":
        return (ec(), !0);
      case "/fallback": {
        let s = o.join(" ").trim();
        if (!s) {
          let i = rk();
          return (
            i.length === 0
              ? (console.log(`${c.dim}No fallback chain configured${c.reset}`),
                console.log(
                  `${c.dim}Use /fallback anthropic,openai,local to set${c.reset}`,
                ))
              : console.log(
                  `${c.bold}${c.cyan}Fallback chain:${c.reset} ${i.join(" \u2192 ")}`,
                ),
            !0
          );
        }
        let r = s
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean);
        return (
          ok(r),
          console.log(
            `${c.green}Fallback chain: ${r.join(" \u2192 ")}${c.reset}`,
          ),
          !0
        );
      }
      case "/tokens": {
        let { getConversationMessages: s } = Se(),
          { getUsage: r } = Qe(),
          { TOOL_DEFINITIONS: i } = Et(),
          a = s(),
          l = r(a, i),
          u = Xt(),
          d = An();
        (console.log(`
${c.bold}${c.cyan}Token Usage:${c.reset}`),
          console.log(
            `  ${c.dim}Model:${c.reset} ${d}:${u.id} (${(l.limit / 1e3).toFixed(0)}k context)`,
          ),
          console.log(
            `  ${c.dim}Used:${c.reset}  ${l.used.toLocaleString()} / ${l.limit.toLocaleString()} (${l.percentage}%)`,
          ));
        let f = pm(l.percentage);
        return (
          console.log(`  ${f}`),
          console.log(`
  ${c.dim}Breakdown:${c.reset}`),
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
        let { formatCosts: s, resetCosts: r } = Fn();
        return o.join(" ").trim() === "reset"
          ? (r(), console.log(`${c.green}Cost tracking reset${c.reset}`), !0)
          : (console.log(`
${s()}
`),
            !0);
      }
      case "/budget": {
        let {
            getCostLimits: s,
            getProviderSpend: r,
            checkBudget: i,
            removeCostLimit: a,
            saveCostLimits: l,
            setCostLimit: u,
          } = Fn(),
          d = o[0];
        if (!d) {
          let h = s(),
            p = tc();
          console.log(`
${c.bold}${c.cyan}Cost Limits:${c.reset}`);
          let g = !1;
          for (let y of p) {
            let w = r(y.provider),
              k = h[y.provider];
            if (k !== void 0) {
              g = !0;
              let R = Math.min(100, Math.round((w / k) * 100)),
                x = 10,
                _ = Math.round((R / 100) * x),
                b = x - _,
                N = `${R >= 100 ? c.red : R >= 80 ? c.yellow : c.green}${"\u2588".repeat(_)}${c.dim}${"\u2591".repeat(b)}${c.reset}`;
              console.log(
                `  ${c.bold}${y.provider}:${c.reset}  $${w.toFixed(2)} / $${k.toFixed(2)}  (${R}%)  ${N}`,
              );
            } else
              y.provider === "ollama" || y.provider === "local"
                ? console.log(
                    `  ${c.bold}${y.provider}:${c.reset}  ${c.dim}free (no limit)${c.reset}`,
                  )
                : w > 0 &&
                  console.log(
                    `  ${c.bold}${y.provider}:${c.reset}  $${w.toFixed(2)} ${c.dim}(no limit)${c.reset}`,
                  );
          }
          return (
            g ||
              console.log(
                `  ${c.dim}No limits set. Use /budget <provider> <amount> to set one.${c.reset}`,
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
                  `${c.bold}${d}:${c.reset} $${h.spent.toFixed(2)} / $${h.limit.toFixed(2)} ($${h.remaining.toFixed(2)} remaining)`,
                )
              : console.log(
                  `${c.bold}${d}:${c.reset} $${h.spent.toFixed(2)} ${c.dim}(no limit)${c.reset}`,
                ),
            !0
          );
        }
        if (f === "off" || f === "remove" || f === "clear")
          return (
            a(d),
            l(),
            console.log(`${c.green}Removed cost limit for ${d}${c.reset}`),
            !0
          );
        let m = parseFloat(f);
        return isNaN(m) || m <= 0
          ? (console.log(
              `${c.red}Invalid amount: ${f}. Use a positive number or 'off'.${c.reset}`,
            ),
            !0)
          : (u(d, m),
            l(),
            console.log(
              `${c.green}Set ${d} budget limit: $${m.toFixed(2)}${c.reset}`,
            ),
            !0);
      }
      case "/clear": {
        let { clearConversation: s, getConversationMessages: r } = Se(),
          { clearHistory: i } = Wt(),
          a = r();
        if (a.filter((d) => d.role === "user").length >= 4) {
          process.stdout.write(`${c.dim}Reflecting on session...${c.reset} `);
          let { learnFromSession: d } = Ba();
          d(a)
            .then((f) => {
              if (
                !f.skipped &&
                !f.error &&
                (f.applied.length > 0 || f.nexAdded.length > 0)
              ) {
                let m = f.applied.length + f.nexAdded.length;
                process.stdout.write(`${c.green}${m} learning(s) saved${c.reset}
`);
              } else
                process.stdout.write(`${c.dim}nothing new${c.reset}
`);
            })
            .catch(() =>
              process.stdout.write(`
`),
            );
        }
        (s(), i());
        let { deleteSession: u } = At();
        return (
          u("_autosave"),
          console.log(`${c.green}Conversation cleared${c.reset}`),
          !0
        );
      }
      case "/context":
        return (await am(St), !0);
      case "/tree": {
        let { generateFileTree: s } = nr(),
          r = parseInt(o.join(" ").trim(), 10),
          i = !isNaN(r) && r > 0 ? Math.min(r, 8) : 3,
          a = s(St, { maxDepth: i, maxFiles: 300 });
        return (
          console.log(`
${c.bold}${c.cyan}Project tree${c.reset}${c.dim} (depth ${i})${c.reset}
`),
          console.log(`${c.dim}${a}${c.reset}
`),
          !0
        );
      }
      case "/autoconfirm": {
        let s = !Za();
        return (
          uk(s),
          console.log(`${c.green}Auto-confirm: ${s ? "ON" : "OFF"}${c.reset}`),
          s &&
            console.log(
              `${c.yellow}  \u26A0 File changes will be applied without confirmation${c.reset}`,
            ),
          to(),
          !0
        );
      }
      case "/save": {
        let { saveSession: s } = At(),
          { getConversationMessages: r } = Se(),
          i = o.join(" ").trim() || `session-${Date.now()}`,
          a = r();
        if (a.length === 0)
          return (
            console.log(`${c.yellow}No conversation to save${c.reset}`),
            !0
          );
        let l = Xt(),
          u = An();
        return (
          s(i, a, { model: l.id, provider: u }),
          console.log(
            `${c.green}Session saved: ${i} (${a.length} messages)${c.reset}`,
          ),
          !0
        );
      }
      case "/load": {
        let { loadSession: s } = At(),
          { setConversationMessages: r } = Se(),
          i = o.join(" ").trim();
        if (!i)
          return (console.log(`${c.red}Usage: /load <name>${c.reset}`), !0);
        let a = s(i);
        return a
          ? (r(a.messages),
            console.log(
              `${c.green}Loaded session: ${a.name} (${a.messageCount} messages)${c.reset}`,
            ),
            !0)
          : (console.log(`${c.red}Session not found: ${i}${c.reset}`), !0);
      }
      case "/sessions": {
        let { listSessions: s } = At(),
          r = s();
        if (r.length === 0)
          return (console.log(`${c.dim}No saved sessions${c.reset}`), !0);
        console.log(`
${c.bold}${c.cyan}Sessions:${c.reset}`);
        for (let i of r) {
          let a = i.updatedAt ? new Date(i.updatedAt).toLocaleString() : "?",
            l = i.name === "_autosave" ? ` ${c.dim}(auto)${c.reset}` : "",
            u =
              i.score != null
                ? ` \xB7 score ${i.score}/10${i.scoreGrade ? ` (${i.scoreGrade})` : ""}`
                : "";
          console.log(
            `  ${c.cyan}${i.name}${c.reset}${l} \u2014 ${i.messageCount} msgs, ${a}${c.dim}${u}${c.reset}`,
          );
        }
        return (console.log(), !0);
      }
      case "/resume": {
        let { getLastSession: s } = At(),
          { setConversationMessages: r } = Se(),
          i = s();
        return i
          ? (r(i.messages),
            console.log(
              `${c.green}Resumed: ${i.name} (${i.messageCount} messages)${c.reset}`,
            ),
            !0)
          : (console.log(`${c.yellow}No session to resume${c.reset}`), !0);
      }
      case "/remember": {
        let { remember: s } = rn(),
          r = o.join(" ").trim();
        if (!r)
          return (
            console.log(
              `${c.red}Usage: /remember <key>=<value> or /remember <text>${c.reset}`,
            ),
            !0
          );
        let i = r.indexOf("="),
          a,
          l;
        return (
          i > 0
            ? ((a = r.substring(0, i).trim()), (l = r.substring(i + 1).trim()))
            : ((a = r.substring(0, 40).replace(/\s+/g, "-")), (l = r)),
          s(a, l),
          console.log(`${c.green}Remembered: ${a}${c.reset}`),
          !0
        );
      }
      case "/forget": {
        let { forget: s } = rn(),
          r = o.join(" ").trim();
        return r
          ? (s(r)
              ? console.log(`${c.green}Forgotten: ${r}${c.reset}`)
              : console.log(`${c.red}Memory not found: ${r}${c.reset}`),
            !0)
          : (console.log(`${c.red}Usage: /forget <key>${c.reset}`), !0);
      }
      case "/memory": {
        let { listMemories: s } = rn(),
          r = s();
        if (r.length === 0)
          return (console.log(`${c.dim}No memories saved${c.reset}`), !0);
        console.log(`
${c.bold}${c.cyan}Memory:${c.reset}`);
        for (let i of r)
          console.log(`  ${c.cyan}${i.key}${c.reset} = ${i.value}`);
        return (console.log(), !0);
      }
      case "/brain": {
        let {
            listDocuments: s,
            readDocument: r,
            writeDocument: i,
            removeDocument: a,
            buildIndex: l,
            buildEmbeddingIndex: u,
            isEmbeddingAvailable: d,
            query: f,
          } = Rs(),
          m = o[0],
          h = o.slice(1).join(" ").trim();
        switch (m) {
          case "add": {
            if (!h)
              return (
                console.log(
                  `${c.red}Usage: /brain add <name> [content]${c.reset}`,
                ),
                console.log(
                  `${c.dim}  /brain add api-notes \u2014 creates empty file${c.reset}`,
                ),
                console.log(
                  `${c.dim}  /brain add api-notes This is content \u2014 writes directly${c.reset}`,
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
              (console.log(`${c.green}Created .nex/brain/${h}.md${c.reset}`),
                console.log(`${c.dim}Edit it directly at: ${g}${c.reset}`));
            } else {
              let g = h.substring(0, p),
                y = h.substring(p + 1);
              (i(g, y),
                console.log(`${c.green}Added to brain: ${g}${c.reset}`));
            }
            return !0;
          }
          case "list": {
            let p = s();
            if (p.length === 0)
              return (
                console.log(
                  `${c.dim}No brain documents yet. Use /brain add <name> to create one.${c.reset}`,
                ),
                !0
              );
            console.log(`
${c.bold}${c.cyan}Brain Documents:${c.reset}`);
            let g = Math.max(8, ...p.map((w) => w.name.length)),
              y = 20;
            (console.log(
              `  ${"Name".padEnd(g + 2)}${"Tags".padEnd(y)}${"Size".padStart(7)}  Modified`,
            ),
              console.log(
                `  ${"-".repeat(g + 2)}${"-".repeat(y)}${"-".repeat(7)}  --------`,
              ));
            for (let w of p) {
              let { frontmatter: k } = r(w.name),
                R = Array.isArray(k.tags) ? k.tags.join(", ") : "",
                x =
                  w.size < 1024
                    ? `${w.size}B`
                    : `${(w.size / 1024).toFixed(1)}K`,
                _ = w.modified.toLocaleDateString();
              console.log(
                `  ${c.cyan}${w.name.padEnd(g + 2)}${c.reset}${c.dim}${R.substring(0, y - 1).padEnd(y)}${x.padStart(7)}  ${_}${c.reset}`,
              );
            }
            return (console.log(), !0);
          }
          case "search": {
            if (!h)
              return (
                console.log(`${c.red}Usage: /brain search <query>${c.reset}`),
                !0
              );
            let p = await f(h, { topK: 5 });
            if (p.length === 0)
              return (
                console.log(
                  `${c.dim}No matching brain documents for: ${h}${c.reset}`,
                ),
                !0
              );
            console.log(`
${c.bold}${c.cyan}Brain Search: "${h}"${c.reset}`);
            for (let g of p) {
              let y = typeof g.score == "number" ? g.score.toFixed(2) : g.score;
              (console.log(`
  ${c.cyan}${g.name}${c.reset} ${c.dim}(score: ${y})${c.reset}`),
                console.log(`  ${c.dim}${g.excerpt || ""}${c.reset}`));
            }
            return (console.log(), !0);
          }
          case "show": {
            if (!h)
              return (
                console.log(`${c.red}Usage: /brain show <name>${c.reset}`),
                !0
              );
            let p = r(h);
            return p.content
              ? (console.log(`
${c.bold}${c.cyan}${h}.md${c.reset}
`),
                console.log(p.content),
                !0)
              : (console.log(`${c.red}Document not found: ${h}${c.reset}`), !0);
          }
          case "remove": {
            if (!h)
              return (
                console.log(`${c.red}Usage: /brain remove <name>${c.reset}`),
                !0
              );
            let { confirm: p } = Xe();
            if (!(await p(`Remove brain document "${h}"?`)))
              return (console.log(`${c.dim}Cancelled${c.reset}`), !0);
            let y = a(h);
            return (
              console.log(
                y
                  ? `${c.green}Removed: ${h}.md${c.reset}`
                  : `${c.red}Document not found: ${h}${c.reset}`,
              ),
              !0
            );
          }
          case "rebuild": {
            let p = l(),
              g = Object.keys(p.documents).length;
            return (
              console.log(
                `${c.green}Index rebuilt: ${g} document(s)${c.reset}`,
              ),
              !0
            );
          }
          case "embed": {
            if (!(await d()))
              return (
                console.log(
                  `${c.yellow}Ollama embedding model not available.${c.reset}`,
                ),
                console.log(
                  `${c.dim}Set NEX_EMBED_MODEL env var (default: nomic-embed-text) and ensure Ollama is running.${c.reset}`,
                ),
                !0
              );
            console.log(`${c.dim}Building embedding index...${c.reset}`);
            try {
              let g = await u(),
                y = Object.keys(g.documents || {}).length;
              console.log(
                `${c.green}Embedding index built: ${y} document(s)${c.reset}`,
              );
            } catch (g) {
              console.log(`${c.red}Embedding failed: ${g.message}${c.reset}`);
            }
            return !0;
          }
          case "status": {
            let p = s(),
              g = require("fs"),
              y = require("path"),
              w = y.join(process.cwd(), ".nex", "brain", ".brain-index.json"),
              k = y.join(process.cwd(), ".nex", "brain", ".embeddings.json");
            if (
              (console.log(`
${c.bold}${c.cyan}Brain Status${c.reset}`),
              console.log(`  Documents:  ${p.length}`),
              console.log(
                `  Index:      ${g.existsSync(w) ? c.green + "present" + c.reset : c.dim + "not built" + c.reset}`,
              ),
              console.log(
                `  Embeddings: ${g.existsSync(k) ? c.green + "present" + c.reset : c.dim + "not built (run /brain embed)" + c.reset}`,
              ),
              p.length > 0)
            ) {
              let R = p.reduce((x, _) => x + _.size, 0);
              console.log(
                `  Total size: ${R < 1024 ? R + "B" : (R / 1024).toFixed(1) + "K"}`,
              );
            }
            return (console.log(), !0);
          }
          case "review": {
            let { exec: p } = require("child_process"),
              { promisify: g } = require("util"),
              y = g(p);
            try {
              let { stdout: w } = await y("git diff .nex/brain/", {
                cwd: process.cwd(),
              });
              w.trim()
                ? (console.log(`
${c.bold}${c.cyan}Brain Changes (git diff):${c.reset}
`),
                  console.log(w))
                : console.log(
                    `${c.dim}No pending brain changes (clean git state)${c.reset}`,
                  );
            } catch {
              console.log(`${c.dim}Not a git repo or no brain dir${c.reset}`);
            }
            return !0;
          }
          case "undo": {
            let p = require("fs"),
              y = require("path").join(process.cwd(), ".nex", "brain");
            if (!p.existsSync(y))
              return (
                console.log(`${c.dim}No brain directory found${c.reset}`),
                !0
              );
            let w = s();
            if (w.length === 0)
              return (
                console.log(`${c.dim}No brain documents to undo${c.reset}`),
                !0
              );
            let k = w[0],
              { exec: R } = require("child_process"),
              { promisify: x } = require("util"),
              _ = x(R);
            try {
              (await _(`git checkout -- ".nex/brain/${k.name}.md"`, {
                cwd: process.cwd(),
              }),
                l(),
                console.log(
                  `${c.green}Undone: restored ${k.name}.md from git${c.reset}`,
                ));
            } catch {
              console.log(
                `${c.red}Could not undo \u2014 not tracked in git or no prior version${c.reset}`,
              );
            }
            return !0;
          }
          default: {
            let p = s();
            if (p.length === 0)
              (console.log(`
${c.bold}${c.cyan}Brain Knowledge Base${c.reset}`),
                console.log(
                  `${c.dim}No documents yet. Create with /brain add <name>${c.reset}`,
                ),
                console.log(`
${c.dim}Commands: add \xB7 list \xB7 search \xB7 show \xB7 remove \xB7 rebuild \xB7 embed \xB7 status \xB7 review \xB7 undo${c.reset}
`));
            else {
              console.log(`
${c.bold}${c.cyan}Brain: ${p.length} document(s)${c.reset}`);
              for (let g of p) {
                let { frontmatter: y } = r(g.name),
                  w = Array.isArray(y.tags) ? ` [${y.tags.join(", ")}]` : "";
                console.log(
                  `  ${c.cyan}${g.name}${c.reset}${c.dim}${w}${c.reset}`,
                );
              }
              console.log(`
${c.dim}Use /brain search <query> \xB7 /brain show <name> \xB7 /brain add <name>${c.reset}
`);
            }
            return !0;
          }
        }
      }
      case "/learn": {
        let { learnFromSession: s, learnBrainFromSession: r } = Ba(),
          { getConversationMessages: i } = Se(),
          a = i(),
          l = a.filter((u) => u.role === "user").length;
        if (l < 4)
          return (
            console.log(
              `${c.yellow}Session too short to learn from (need 4+ user messages, have ${l})${c.reset}`,
            ),
            !0
          );
        console.log(`${c.dim}Analyzing session for learnings...${c.reset}`);
        try {
          let [u, d] = await Promise.all([s(a), r(a)]);
          if (u.skipped && (!d.written || d.written.length === 0))
            return (console.log(`${c.dim}Session too short${c.reset}`), !0);
          (u.error &&
            console.log(`${c.red}Reflection error: ${u.error}${c.reset}`),
            console.log(""),
            u.summary &&
              (console.log(
                `${c.bold}Session:${c.reset} ${c.dim}${u.summary}${c.reset}`,
              ),
              console.log("")));
          let f = u.applied && u.applied.length > 0,
            m = u.nexAdded && u.nexAdded.length > 0,
            h = d.written && d.written.length > 0;
          if (!f && !m && !h)
            console.log(
              `${c.dim}No new learnings extracted from this session${c.reset}`,
            );
          else {
            if (f) {
              console.log(`${c.bold}${c.cyan}Memory updates:${c.reset}`);
              for (let { key: p, value: g, action: y } of u.applied) {
                let w =
                  y === "updated"
                    ? `${c.yellow}~${c.reset}`
                    : `${c.green}+${c.reset}`;
                console.log(`  ${w} ${c.bold}${p}${c.reset} = ${g}`);
              }
            }
            if (m) {
              console.log(`${c.bold}${c.cyan}Added to NEX.md:${c.reset}`);
              for (let p of u.nexAdded)
                console.log(`  ${c.green}+${c.reset} ${p}`);
            }
            if (h) {
              console.log(`${c.bold}${c.cyan}Brain documents:${c.reset}`);
              for (let { name: p, reason: g, action: y } of d.written) {
                let w =
                  y === "updated"
                    ? `${c.yellow}~${c.reset}`
                    : `${c.green}+${c.reset}`;
                console.log(
                  `  ${w} ${c.bold}${p}.md${c.reset}${g ? c.dim + " \u2014 " + g + c.reset : ""}`,
                );
              }
            }
          }
          console.log("");
        } catch (u) {
          console.log(`${c.red}Learn failed: ${u.message}${c.reset}`);
        }
        return !0;
      }
      case "/optimize": {
        let { getConversationMessages: s } = Se(),
          { getUsage: r } = Qe(),
          { TOOL_DEFINITIONS: i } = Et(),
          { listMemories: a } = rn(),
          l = s(),
          u = r(l, i),
          d = Xt(),
          f = An(),
          m = a();
        console.log(`
${c.bold}${c.cyan}Optimization Report${c.reset}
`);
        let h =
          u.percentage > 80 ? c.red : u.percentage > 50 ? c.yellow : c.green;
        if (
          (console.log(
            `${c.bold}Context Window:${c.reset} ${h}${u.percentage}%${c.reset} used (${u.used.toLocaleString()} / ${u.limit.toLocaleString()} tokens)`,
          ),
          u.percentage > 75
            ? console.log(
                `  ${c.yellow}\u2192 Tip: Use /clear to free context (auto-learns first)${c.reset}`,
              )
            : u.percentage > 50
              ? console.log(
                  `  ${c.dim}\u2192 Context is filling up, consider /clear soon${c.reset}`,
                )
              : console.log(`  ${c.green}\u2192 Context healthy${c.reset}`),
          console.log(`
${c.bold}Memory:${c.reset} ${m.length} entries`),
          m.length === 0)
        )
          console.log(
            `  ${c.yellow}\u2192 No memories yet. Use /learn after sessions or /remember key=value${c.reset}`,
          );
        else {
          let R = [...m].sort(
              (b, O) => new Date(O.updatedAt) - new Date(b.updatedAt),
            )[0],
            x = R
              ? Math.round((Date.now() - new Date(R.updatedAt)) / 6e4)
              : null,
            _ =
              x !== null
                ? x < 60
                  ? `${x}m ago`
                  : `${Math.round(x / 60)}h ago`
                : "?";
          (console.log(`  ${c.dim}Latest update: ${_}${c.reset}`),
            m.length > 30 &&
              console.log(
                `  ${c.yellow}\u2192 Many memories (${m.length}) \u2014 consider pruning with /forget${c.reset}`,
              ));
        }
        console.log(`
${c.bold}Active Model:${c.reset} ${f}:${d.id}`);
        let p = d.contextWindow || d.maxTokens || 0;
        p > 0 && p < 32e3 && l.length > 10
          ? console.log(
              `  ${c.yellow}\u2192 Small context window (${(p / 1e3).toFixed(0)}k). Consider /model for larger context${c.reset}`,
            )
          : p >= 128e3 &&
            console.log(
              `  ${c.green}\u2192 Large context window (${(p / 1e3).toFixed(0)}k) \u2014 good for long sessions${c.reset}`,
            );
        let g = l.filter((k) => k.role === "user").length;
        (console.log(`
${c.bold}Session:${c.reset} ${g} turns, ${l.length} messages total`),
          g >= 4 &&
            g % 10 === 0 &&
            console.log(
              `  ${c.cyan}\u2192 Good time to /learn and capture session insights${c.reset}`,
            ));
        let y = [],
          w = require("path").join(process.cwd(), "NEX.md");
        if (
          (require("fs").existsSync(w) ||
            y.push(
              "Create NEX.md in project root to give nex-code project-specific instructions",
            ),
          y.length > 0)
        ) {
          console.log(`
${c.bold}Quick Wins:${c.reset}`);
          for (let k of y) console.log(`  ${c.cyan}\u2192${c.reset} ${k}`);
        }
        return (console.log(""), !0);
      }
      case "/plan": {
        let {
            getActivePlan: s,
            approvePlan: r,
            startExecution: i,
            setPlanMode: a,
            getPlanContent: l,
            getPlanContent: u,
            formatPlan: d,
            extractStepsFromText: f,
            createPlan: m,
          } = Dt(),
          { invalidateSystemPromptCache: h } = Se(),
          p = o.join(" ").trim();
        if (p === "status") {
          let g = s();
          return (console.log(d(g)), !0);
        }
        if (p === "edit") {
          let g = l();
          if (!g)
            return (
              console.log(
                `${c.yellow}No plan to edit. Generate a plan first with /plan${c.reset}`,
              ),
              !0
            );
          let y = require("os"),
            w = require("path").join(y.tmpdir(), `nex-plan-${Date.now()}.md`);
          require("fs").writeFileSync(w, g, "utf-8");
          let k = process.env.EDITOR || process.env.VISUAL || "nano",
            { spawnSync: R } = require("child_process");
          if (
            (console.log(
              `${c.dim}Opening plan in ${k}... (save and close to update)${c.reset}`,
            ),
            R(k, [w], { stdio: "inherit" }).status === 0)
          ) {
            let { setPlanContent: _ } = Dt(),
              b = require("fs").readFileSync(w, "utf-8");
            _(b);
            let O = f(b);
            if (O.length > 0) {
              let C = s()?.task || "Task";
              (m(C, O),
                console.log(
                  `${c.green}Plan updated \u2014 ${O.length} steps extracted.${c.reset}`,
                ));
            } else console.log(`${c.green}Plan updated.${c.reset}`);
          } else
            console.log(
              `${c.yellow}Editor exited with error \u2014 plan unchanged.${c.reset}`,
            );
          try {
            require("fs").unlinkSync(w);
          } catch {}
          return !0;
        }
        if (p === "approve") {
          let g = l();
          if (r()) {
            (i(), a(!1), to(), h());
            let w = s()?.steps?.length || 0,
              k = w > 0 ? ` (${w} steps)` : "";
            if (
              (console.log(
                `${c.green}${c.bold}Plan approved!${c.reset}${k} Executing...`,
              ),
              console.log(
                `${c.dim}Plan mode disabled \u2014 all tools now available.${c.reset}`,
              ),
              g)
            ) {
              let { processInput: R } = Se(),
                x = `[PLAN APPROVED \u2014 EXECUTE NOW]

Implement the following plan step by step. All tools are now available.

${g}`;
              try {
                await R(x);
              } catch (_) {
                console.log(
                  `${c.red}Error: ${
                    _.message?.split(`
`)[0]
                  }${c.reset}`,
                );
              }
            }
          } else
            console.log(
              `${c.red}No plan to approve. Enter plan mode first with /plan${c.reset}`,
            );
          return !0;
        }
        return (
          a(!0),
          to(),
          h(),
          console.log(`
${c.cyan}${c.bold}\u250C\u2500 PLAN MODE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510${c.reset}
${c.cyan}${c.bold}\u2502${c.reset}  Analysis only \u2014 no file changes until approved   ${c.cyan}${c.bold}\u2502${c.reset}
${c.cyan}${c.bold}\u2502${c.reset}  ${c.dim}Read-only tools only \xB7 /plan approve to execute${c.reset}  ${c.cyan}${c.bold}\u2502${c.reset}
${c.cyan}${c.bold}\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518${c.reset}`),
          p && console.log(`${c.dim}Task: ${p}${c.reset}`),
          !0
        );
      }
      case "/plans": {
        let { listPlans: s } = Dt(),
          r = s();
        if (r.length === 0)
          return (console.log(`${c.dim}No saved plans${c.reset}`), !0);
        console.log(`
${c.bold}${c.cyan}Plans:${c.reset}`);
        for (let i of r) {
          let a =
            i.status === "completed"
              ? `${c.green}\u2713`
              : i.status === "executing"
                ? `${c.blue}\u2192`
                : `${c.dim}\u25CB`;
          console.log(
            `  ${a} ${c.reset}${c.bold}${i.name}${c.reset} \u2014 ${i.task || "?"} (${i.steps} steps, ${i.status})`,
          );
        }
        return (console.log(), !0);
      }
      case "/auto": {
        let {
            getAutonomyLevel: s,
            setAutonomyLevel: r,
            AUTONOMY_LEVELS: i,
          } = Dt(),
          a = o.join(" ").trim();
        return a
          ? (r(a)
              ? (console.log(`${c.green}Autonomy: ${a}${c.reset}`), to())
              : console.log(
                  `${c.red}Unknown level: ${a}. Use: ${i.join(", ")}${c.reset}`,
                ),
            !0)
          : (console.log(`${c.bold}${c.cyan}Autonomy:${c.reset} ${s()}`),
            console.log(`${c.dim}Levels: ${i.join(", ")}${c.reset}`),
            !0);
      }
      case "/permissions": {
        let { listPermissions: s } = qs(),
          r = s();
        console.log(`
${c.bold}${c.cyan}Tool Permissions:${c.reset}`);
        for (let i of r) {
          let a =
            i.mode === "allow"
              ? `${c.green}\u2713`
              : i.mode === "deny"
                ? `${c.red}\u2717`
                : `${c.yellow}?`;
          console.log(
            `  ${a} ${c.reset}${c.bold}${i.tool}${c.reset} ${c.dim}(${i.mode})${c.reset}`,
          );
        }
        return (
          console.log(`
${c.dim}Use /allow <tool> or /deny <tool> to change${c.reset}
`),
          !0
        );
      }
      case "/allow": {
        let { setPermission: s, savePermissions: r } = qs(),
          i = o.join(" ").trim();
        return i
          ? (s(i, "allow"),
            r(),
            console.log(`${c.green}${i}: allow${c.reset}`),
            !0)
          : (console.log(`${c.red}Usage: /allow <tool>${c.reset}`), !0);
      }
      case "/deny": {
        let { setPermission: s, savePermissions: r } = qs(),
          i = o.join(" ").trim();
        return i
          ? (s(i, "deny"), r(), console.log(`${c.red}${i}: deny${c.reset}`), !0)
          : (console.log(`${c.red}Usage: /deny <tool>${c.reset}`), !0);
      }
      case "/audit": {
        let { getAuditSummary: s, isAuditEnabled: r } = Vi();
        if (!r())
          return (
            console.log(
              `${c.yellow}Audit logging is disabled (set NEX_AUDIT=true to enable)${c.reset}`,
            ),
            !0
          );
        let i = parseInt(o.join(" ").trim()) || 1,
          a = s(i);
        if (
          (console.log(`
${c.bold}${c.cyan}Audit Summary (${i} day${i > 1 ? "s" : ""})${c.reset}
`),
          console.log(`  Total tool calls: ${c.bold}${a.totalCalls}${c.reset}`),
          console.log(`  Avg duration: ${c.dim}${a.avgDuration}ms${c.reset}`),
          console.log(
            `  Success rate: ${a.successRate >= 0.95 ? c.green : c.yellow}${Math.round(a.successRate * 100)}%${c.reset}`,
          ),
          Object.keys(a.byTool).length > 0)
        ) {
          (console.log(`
  ${c.dim}Tool${" ".repeat(25)}Count${c.reset}`),
            console.log(`  ${c.dim}${"\u2500".repeat(35)}${c.reset}`));
          let l = Object.entries(a.byTool).sort((u, d) => d[1] - u[1]);
          for (let [u, d] of l.slice(0, 15))
            console.log(`  ${u.padEnd(30)}${d}`);
        }
        return (console.log(), !0);
      }
      case "/commit": {
        let {
            isGitRepo: s,
            commit: r,
            analyzeDiff: i,
            formatDiffSummary: a,
          } = tn(),
          { confirm: l } = Xe();
        if (!s())
          return (console.log(`${c.red}Not a git repository${c.reset}`), !0);
        let u = o.join(" ").trim();
        if (u) {
          let p = await r(u);
          return (
            console.log(
              p
                ? `${c.green}Committed: ${p} \u2014 ${u}${c.reset}`
                : `${c.red}Commit failed${c.reset}`,
            ),
            !0
          );
        }
        if (!i())
          return (console.log(`${c.yellow}No changes to commit${c.reset}`), !0);
        let f = await a();
        if ((console.log(f), !(await l("  Commit changes?")))) return !0;
        let h = await r("nex-code update");
        return (
          h && console.log(`${c.green}  \u2713 Committed: ${h}${c.reset}`),
          !0
        );
      }
      case "/diff": {
        let { isGitRepo: s, formatDiffSummary: r } = tn();
        return s()
          ? (console.log(r()), !0)
          : (console.log(`${c.red}Not a git repository${c.reset}`), !0);
      }
      case "/review": {
        let { isGitRepo: s, getDiff: r } = tn(),
          { processInput: i } = Se(),
          a = o.join(" ").trim(),
          l = a.includes("--strict"),
          u = a.replace("--strict", "").trim(),
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
          if (!s())
            return (
              console.log(
                `${c.red}Not a git repository \u2014 try /review <file>${c.reset}`,
              ),
              !0
            );
          let [h, p] = await Promise.all([r(!1), r(!0)]),
            g = p || h;
          if (!g || !g.trim())
            return (
              console.log(
                `${c.yellow}No changes to review \u2014 commit something or specify a file: /review <file>${c.reset}`,
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
        let { isGitRepo: s, getCurrentBranch: r, createBranch: i } = tn();
        if (!s())
          return (console.log(`${c.red}Not a git repository${c.reset}`), !0);
        let a = o.join(" ").trim();
        if (!a) {
          let u = r();
          return (
            console.log(
              `${c.bold}${c.cyan}Branch:${c.reset} ${u || "(detached)"}`,
            ),
            !0
          );
        }
        let l = i(a);
        return (
          console.log(
            l
              ? `${c.green}Created and switched to: ${l}${c.reset}`
              : `${c.red}Failed to create branch${c.reset}`,
          ),
          !0
        );
      }
      case "/mcp": {
        let { listServers: s, connectAll: r, disconnectAll: i } = Co(),
          a = o.join(" ").trim();
        if (a === "connect")
          return (
            console.log(`${c.dim}Connecting MCP servers...${c.reset}`),
            r()
              .then((u) => {
                for (let d of u)
                  d.error
                    ? console.log(
                        `  ${c.red}\u2717${c.reset} ${d.name}: ${d.error}`,
                      )
                    : console.log(
                        `  ${c.green}\u2713${c.reset} ${d.name}: ${d.tools} tools`,
                      );
                u.length === 0 &&
                  console.log(
                    `${c.dim}No MCP servers configured in .nex/config.json${c.reset}`,
                  );
              })
              .catch((u) => {
                console.log(
                  `${c.red}MCP connection error: ${u.message}${c.reset}`,
                );
              }),
            !0
          );
        if (a === "disconnect")
          return (
            i(),
            console.log(`${c.green}All MCP servers disconnected${c.reset}`),
            !0
          );
        let l = s();
        if (l.length === 0)
          return (
            console.log(`${c.dim}No MCP servers configured${c.reset}`),
            console.log(
              `${c.dim}Add servers to .nex/config.json under "mcpServers"${c.reset}`,
            ),
            !0
          );
        console.log(`
${c.bold}${c.cyan}MCP Servers:${c.reset}`);
        for (let u of l) {
          let d = u.connected
            ? `${c.green}\u2713 connected${c.reset}`
            : `${c.dim}\u25CB disconnected${c.reset}`;
          console.log(
            `  ${d} ${c.bold}${u.name}${c.reset} (${u.command}) \u2014 ${u.toolCount} tools`,
          );
        }
        return (
          console.log(`
${c.dim}Use /mcp connect to connect all servers${c.reset}
`),
          !0
        );
      }
      case "/hooks": {
        let { listHooks: s } = ya(),
          r = s();
        if (r.length === 0)
          return (
            console.log(`${c.dim}No hooks configured${c.reset}`),
            console.log(
              `${c.dim}Add hooks to .nex/config.json or .nex/hooks/${c.reset}`,
            ),
            !0
          );
        console.log(`
${c.bold}${c.cyan}Hooks:${c.reset}`);
        for (let i of r) {
          console.log(`  ${c.cyan}${i.event}${c.reset}`);
          for (let a of i.commands)
            console.log(`    ${c.dim}\u2192 ${a}${c.reset}`);
        }
        return (console.log(), !0);
      }
      case "/skills": {
        let { listSkills: s, enableSkill: r, disableSkill: i } = nn(),
          a = o.join(" ").trim();
        if (a.startsWith("enable ")) {
          let u = a.substring(7).trim();
          return (
            r(u)
              ? console.log(`${c.green}Skill enabled: ${u}${c.reset}`)
              : console.log(`${c.red}Skill not found: ${u}${c.reset}`),
            !0
          );
        }
        if (a.startsWith("disable ")) {
          let u = a.substring(8).trim();
          return (
            i(u)
              ? console.log(`${c.yellow}Skill disabled: ${u}${c.reset}`)
              : console.log(`${c.red}Skill not found: ${u}${c.reset}`),
            !0
          );
        }
        let l = s();
        if (l.length === 0)
          return (
            console.log(`${c.dim}No skills loaded${c.reset}`),
            console.log(
              `${c.dim}Add .md or .js files to .nex/skills/${c.reset}`,
            ),
            !0
          );
        console.log(`
${c.bold}${c.cyan}Skills:${c.reset}`);
        for (let u of l) {
          let d = u.enabled
              ? `${c.green}\u2713${c.reset}`
              : `${c.red}\u2717${c.reset}`,
            f =
              u.type === "prompt"
                ? `${c.dim}(prompt)${c.reset}`
                : `${c.dim}(script)${c.reset}`,
            m = [];
          (u.commands > 0 && m.push(`${u.commands} cmd`),
            u.tools > 0 && m.push(`${u.tools} tools`));
          let h = m.length > 0 ? ` \u2014 ${m.join(", ")}` : "";
          console.log(`  ${d} ${c.bold}${u.name}${c.reset} ${f}${h}`);
        }
        return (
          console.log(`
${c.dim}Use /skills enable <name> or /skills disable <name>${c.reset}
`),
          !0
        );
      }
      case "/install-skill": {
        let s = o.join(" ").trim();
        if (!s)
          return (
            console.log(
              `${c.yellow}Usage: /install-skill <git-url-or-user/repo>${c.reset}`,
            ),
            !0
          );
        let { installSkill: r } = nn();
        console.log(`${c.dim}Installing skill from ${s}...${c.reset}`);
        let i = await r(s);
        return (
          i.ok
            ? (console.log(
                `${c.green}Skill "${i.name}" installed successfully${c.reset}`,
              ),
              console.log(`${c.dim}Reload with /skills to see it${c.reset}`))
            : console.log(`${c.red}Failed: ${i.error}${c.reset}`),
          !0
        );
      }
      case "/search-skill": {
        let s = o.join(" ").trim();
        if (!s)
          return (
            console.log(`${c.yellow}Usage: /search-skill <query>${c.reset}`),
            !0
          );
        let { searchSkills: r } = nn();
        console.log(`${c.dim}Searching for "${s}"...${c.reset}`);
        let i = await r(s);
        if (i.length === 0)
          console.log(`${c.yellow}No skills found matching "${s}"${c.reset}`);
        else {
          console.log(`
${c.bold}Skills matching "${s}":${c.reset}
`);
          for (let a of i)
            a.name === "error"
              ? console.log(`  ${c.red}${a.description}${c.reset}`)
              : (console.log(
                  `  ${c.cyan}${a.owner}/${a.name}${c.reset} ${c.dim}\u2605${a.stars}${c.reset}`,
                ),
                console.log(`    ${a.description}`),
                console.log(`    ${c.dim}/install-skill ${a.url}${c.reset}
`));
        }
        return !0;
      }
      case "/remove-skill": {
        let s = o.join(" ").trim();
        if (!s)
          return (
            console.log(`${c.yellow}Usage: /remove-skill <name>${c.reset}`),
            !0
          );
        let { removeSkill: r } = nn(),
          i = r(s);
        return (
          i.ok
            ? console.log(`${c.green}Skill "${s}" removed${c.reset}`)
            : console.log(`${c.red}${i.error}${c.reset}`),
          !0
        );
      }
      case "/tasks": {
        let { renderTaskList: s, clearTasks: r } = Bo();
        return o.join(" ").trim() === "clear"
          ? (r(), console.log(`${c.green}Tasks cleared${c.reset}`), !0)
          : (console.log(
              `
` +
                s() +
                `
`,
            ),
            !0);
      }
      case "/undo": {
        let { undo: s, getUndoCount: r } = Wt(),
          i = s();
        if (!i)
          return (console.log(`${c.yellow}Nothing to undo${c.reset}`), !0);
        i.wasCreated
          ? console.log(
              `${c.green}Undone: deleted ${i.filePath} (was created by ${i.tool})${c.reset}`,
            )
          : console.log(
              `${c.green}Undone: restored ${i.filePath} (${i.tool})${c.reset}`,
            );
        let a = r();
        return (
          a > 0 && console.log(`${c.dim}${a} more change(s) to undo${c.reset}`),
          !0
        );
      }
      case "/redo": {
        let { redo: s, getRedoCount: r } = Wt(),
          i = s();
        if (!i)
          return (console.log(`${c.yellow}Nothing to redo${c.reset}`), !0);
        console.log(`${c.green}Redone: ${i.filePath} (${i.tool})${c.reset}`);
        let a = r();
        return (
          a > 0 && console.log(`${c.dim}${a} more change(s) to redo${c.reset}`),
          !0
        );
      }
      case "/history": {
        let { getHistory: s, getUndoCount: r, getRedoCount: i } = Wt(),
          a = s(20);
        if (a.length === 0)
          return (
            console.log(`${c.dim}No file changes in this session${c.reset}`),
            !0
          );
        console.log(`
${c.bold}File Change History${c.reset}
`);
        for (let l of a) {
          let u = new Date(l.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          console.log(
            `  ${c.dim}${u}${c.reset} ${c.yellow}${l.tool}${c.reset} ${l.filePath}`,
          );
        }
        return (
          console.log(`
${c.dim}${r()} undo / ${i()} redo available${c.reset}
`),
          !0
        );
      }
      case "/snapshot": {
        let { createSnapshot: s, listSnapshots: r } = Wt(),
          i = o.join(" ").trim() || void 0;
        if (i === "list") {
          let l = r(St);
          if (l.length === 0)
            console.log(`${c.dim}No snapshots found${c.reset}`);
          else {
            console.log(`
${c.bold}${c.cyan}Snapshots:${c.reset}`);
            for (let u of l)
              console.log(
                `  ${c.cyan}#${u.index}${c.reset}  ${c.bold}${u.shortName}${c.reset}`,
              );
            console.log();
          }
          return !0;
        }
        let a = s(i, St);
        return (
          a.ok
            ? (console.log(`${c.green}Snapshot created:${c.reset} ${a.label}`),
              console.log(`${c.dim}Use /restore to apply it later${c.reset}`))
            : console.log(`${c.yellow}${a.error}${c.reset}`),
          !0
        );
      }
      case "/restore": {
        let { restoreSnapshot: s, listSnapshots: r } = Wt(),
          i = o.join(" ").trim() || "last";
        if (i === "list") {
          let l = r(St);
          if (l.length === 0)
            console.log(`${c.dim}No snapshots available${c.reset}`);
          else {
            console.log(`
${c.bold}${c.cyan}Available snapshots:${c.reset}`);
            for (let u of l)
              console.log(
                `  ${c.cyan}#${u.index}${c.reset}  ${c.bold}${u.shortName}${c.reset}`,
              );
            console.log(`
${c.dim}Usage: /restore <name|last>${c.reset}
`);
          }
          return !0;
        }
        let a = s(i, St);
        return (
          a.ok
            ? (console.log(`${c.green}Restored snapshot:${c.reset} ${a.label}`),
              console.log(
                `${c.dim}Working tree updated. Use /undo for in-session file undos.${c.reset}`,
              ))
            : (console.log(`${c.red}Restore failed:${c.reset} ${a.error}`),
              console.log(
                `${c.dim}Use /snapshot list to see available snapshots${c.reset}`,
              )),
          !0
        );
      }
      case "/k8s": {
        let s = o.join(" ").trim(),
          { exec: r } = require("child_process"),
          { promisify: i } = require("util"),
          a = i(r),
          l = s || null,
          u = l
            ? `ssh -o ConnectTimeout=10 -o BatchMode=yes ${l.replace(/[^a-zA-Z0-9@._-]/g, "")} `
            : "",
          d = (f) => (l ? `${u}"${f.replace(/"/g, '\\"')}"` : f);
        console.log(`
${c.bold}${c.cyan}Kubernetes Overview${c.reset}${l ? c.dim + " (remote: " + l + ")" + c.reset : ""}
`);
        try {
          let { stdout: f } = await a(
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
          console.log(`${c.bold}Namespaces (${m.length}):${c.reset}`);
          for (let h of m) console.log(`  ${c.cyan}${h}${c.reset}`);
          console.log();
        } catch {
          return (
            console.log(`${c.dim}Could not reach cluster \u2014 is kubectl configured?${c.reset}
`),
            !0
          );
        }
        try {
          let { stdout: f } = await a(
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
          console.log(`${c.bold}Pods: ${m.length} total  ${c.green}${h} running${c.reset}  ${c.yellow}${p} pending${c.reset}  ${c.red}${g} unhealthy${c.reset}
`);
          let y = m.filter(
            (w) => !w.includes("Running") && !w.includes("<none>"),
          );
          if (y.length > 0) {
            console.log(`${c.bold}${c.red}Unhealthy Pods:${c.reset}`);
            for (let w of y) console.log(`  ${c.red}${w}${c.reset}`);
            console.log();
          }
          (console.log(
            `${c.dim}Use k8s_pods / k8s_logs / k8s_exec tools for details${c.reset}`,
          ),
            console.log(`${c.dim}Or: /k8s user@host to query a remote cluster${c.reset}
`));
        } catch (f) {
          console.log(`${c.dim}Could not list pods: ${f.message}${c.reset}
`);
        }
        return !0;
      }
      case "/servers": {
        let { loadServerProfiles: s, resolveProfile: r, sshExec: i } = Kn(),
          a = s(),
          l = Object.keys(a);
        if (l.length === 0)
          return (
            console.log(`
${c.dim}No servers configured. Create .nex/servers.json:${c.reset}`),
            console.log(`${c.dim}  { "prod": { "host": "1.2.3.4", "user": "jarvis", "os": "almalinux9" } }${c.reset}
`),
            !0
          );
        if (o[0] === "ping") {
          let f = o[1] ? [o[1]] : l;
          return (
            console.log(`
${c.bold}${c.cyan}Server connectivity:${c.reset}`),
            await Promise.all(
              f.map(async (m) => {
                if (!a[m]) {
                  console.log(
                    `  ${c.red}\u2717${c.reset} ${m} \u2014 unknown profile`,
                  );
                  return;
                }
                try {
                  let h = { ...a[m], _name: m },
                    { exitCode: p } = await i(h, "echo ok", { timeout: 8e3 });
                  console.log(
                    p === 0
                      ? `  ${c.green}\u2713${c.reset} ${m} (${h.user ? h.user + "@" : ""}${h.host})`
                      : `  ${c.red}\u2717${c.reset} ${m} (${h.host}) \u2014 SSH failed (exit ${p})`,
                  );
                } catch (h) {
                  console.log(
                    `  ${c.red}\u2717${c.reset} ${m} \u2014 ${h.message}`,
                  );
                }
              }),
            ),
            console.log(""),
            !0
          );
        }
        let { formatProfile: d } = Kn();
        console.log(`
${c.bold}${c.cyan}Configured servers (${l.length}):${c.reset}`);
        for (let f of l)
          console.log(
            `  ${c.green}${f}${c.reset}  ${c.dim}${d(f, a[f])}${c.reset}`,
          );
        return (
          console.log(`
${c.dim}/servers ping          \u2014 check SSH connectivity for all servers${c.reset}`),
          console.log(`${c.dim}/servers ping <name>   \u2014 check a specific server${c.reset}
`),
          !0
        );
      }
      case "/docker": {
        let { loadServerProfiles: s, sshExec: r } = Kn(),
          { exec: i } = require("child_process"),
          { promisify: a } = require("util"),
          l = a(i),
          u =
            o[0] === "-a" || o[0] === "--all"
              ? 'docker ps -a --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"'
              : 'docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"',
          d = s(),
          f = [["local", null], ...Object.entries(d)];
        console.log(`
${c.bold}${c.cyan}Docker Containers:${c.reset}`);
        for (let [m, h] of f) {
          let p =
            m === "local"
              ? `${c.dim}local${c.reset}`
              : `${c.cyan}${m}${c.reset}`;
          try {
            let g;
            if (m === "local") {
              let { stdout: y } = await l(u, { timeout: 8e3 });
              g = (y || "").trim();
            } else {
              let y = await r(h, u, { timeout: 1e4 });
              if (
                ((g = [y.stdout, y.stderr].filter(Boolean).join("").trim()),
                y.exitCode !== 0)
              ) {
                console.log(
                  `  ${p}: ${c.red}SSH error (${y.exitCode})${c.reset}`,
                );
                continue;
              }
            }
            !g || g === "NAMES	IMAGE	STATUS	PORTS"
              ? console.log(`  ${p}: ${c.dim}(no containers)${c.reset}`)
              : (console.log(`  ${p}:`),
                g
                  .split(
                    `
`,
                  )
                  .forEach((y) => console.log(`    ${c.dim}${y}${c.reset}`)));
          } catch (g) {
            console.log(`  ${p}: ${c.red}${g.message}${c.reset}`);
          }
        }
        return (console.log(""), !0);
      }
      case "/deploy": {
        let { loadDeployConfigs: s } = Di(),
          r = s(),
          i = Object.keys(r),
          a = o[0];
        if (a && i.includes(a)) {
          let l = o.includes("--dry-run") || o.includes("-n"),
            u = r[a],
            { executeTool: d } = Et();
          console.log(`
${c.bold}Running deploy: ${a}${l ? " (dry run)" : ""}${c.reset}`);
          let f = await d("deploy", { ...u, dry_run: l });
          return (console.log(f), !0);
        }
        if (i.length === 0)
          return (
            console.log(`
${c.dim}No deploy configs. Run /init to create .nex/deploy.json${c.reset}
`),
            !0
          );
        console.log(`
${c.bold}${c.cyan}Deploy configs (${i.length}):${c.reset}`);
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
              .map((p) => `  ${c.dim}\u2192 ${p}${c.reset}`)
              .join("");
          console.log(
            `  ${c.green}${l}${c.reset}  ${c.dim}${f} ${m}${c.reset}${h}`,
          );
        }
        return (
          console.log(`
${c.dim}/deploy <name>          \u2014 run a named deploy${c.reset}`),
          console.log(`${c.dim}/deploy <name> --dry-run \u2014 preview without syncing${c.reset}
`),
          !0
        );
      }
      case "/init": {
        let { runServerWizard: s, runDeployWizard: r, setWizardRL: i } = Op();
        return (i(e), o[0] === "deploy" ? await r() : await s(), !0);
      }
      case "/setup": {
        let { runSetupWizard: s } = Fa();
        return (await s({ rl: e, force: !0 }), !0);
      }
      case "/benchmark": {
        if (o.includes("--history")) {
          let y = require("os"),
            w = He.join(
              y.homedir(),
              "Coding",
              "nex-code-benchmarks",
              "results",
            );
          if (!st.existsSync(w)) {
            (console.log(`${c.yellow}No nightly results at ${w}${c.reset}`),
              console.log(
                `${c.dim}Use /benchmark (no flags) to run a live model comparison.${c.reset}`,
              ));
            break;
          }
          let k = st
            .readdirSync(w)
            .filter((x) => x.endsWith(".json"))
            .sort()
            .slice(-7);
          if (k.length === 0) {
            console.log(`${c.yellow}No result files found${c.reset}`);
            break;
          }
          (console.log(`
${c.bold}${c.cyan}OpenClaw Nightly Results (${k.length}-day trend)${c.reset}
`),
            console.log(
              `  ${c.dim}${"Date".padEnd(12)} ${"Model".padEnd(25)} ${"Score".padEnd(8)} ${"Pass".padEnd(8)}${c.reset}`,
            ),
            console.log(`  ${c.dim}${"\u2500".repeat(58)}${c.reset}`));
          let R = [];
          for (let x of k)
            try {
              let _ = JSON.parse(st.readFileSync(He.join(w, x), "utf-8")),
                b = x.replace(".json", ""),
                O = _.tasks?.length || _.total || 0,
                N =
                  _.tasks?.filter((me) => me.passed || me.score >= 0.7)
                    ?.length ||
                  _.passed ||
                  0,
                C =
                  _.score ??
                  _.overall_score ??
                  (O > 0 ? Math.round((N / O) * 100) : "N/A"),
                L = _.model || _.config?.model || "unknown";
              R.push({ date: b, model: L, total: O, passed: N, score: C });
              let Ee =
                typeof C == "number"
                  ? C >= 80
                    ? c.green
                    : C >= 60
                      ? c.yellow
                      : c.red
                  : c.dim;
              console.log(
                `  ${b.padEnd(12)} ${L.substring(0, 24).padEnd(25)} ${Ee}${String(C).padEnd(8)}${c.reset} ${N}/${O}`,
              );
            } catch {}
          if (R.length >= 2) {
            let x = R[0].score,
              _ = R[R.length - 1].score;
            if (typeof x == "number" && typeof _ == "number") {
              let b = _ - x,
                O =
                  b > 0
                    ? `${c.green}\u25B2 +${b}`
                    : b < 0
                      ? `${c.red}\u25BC ${b}`
                      : `${c.dim}\u2192 stable`;
              console.log(`
  ${c.bold}Trend:${c.reset} ${O}${c.reset} over ${R.length} days`);
            }
          }
          console.log();
          break;
        }
        if (o.includes("--discover")) {
          let {
              findNewModels: y,
              markBenchmarked: w,
              updateReadme: k,
              updateModelsEnv: R,
            } = Rr(),
            { runDiscoverBenchmark: x, buildSummary: _ } = Cn();
          console.log(`
${c.bold}Checking Ollama Cloud for new models...${c.reset}`);
          let b;
          try {
            b = await y();
          } catch (G) {
            console.log(`${c.red}Discovery failed: ${G.message}${c.reset}`);
            break;
          }
          let { newModels: O, allCloud: N } = b;
          if (
            (console.log(
              `${c.dim}${N.length} models available on cloud${c.reset}`,
            ),
            O.length === 0)
          ) {
            console.log(`${c.green}No new models since last benchmark run.${c.reset}
`);
            break;
          }
          console.log(`${c.cyan}New models to benchmark (${O.length}):${c.reset} ${O.join(", ")}
`);
          let C = require("os"),
            L = He.join(C.homedir(), ".nex-code", "benchmark-results.json"),
            Ee = [];
          try {
            st.existsSync(L) && (Ee = JSON.parse(st.readFileSync(L, "utf-8")));
          } catch {}
          let me = "",
            le = await x({
              newModels: O,
              existingRanking: Ee,
              onProgress: ({
                model: G,
                task: ne,
                done: I,
                score: W,
                error: se,
              }) => {
                if (!I) {
                  G !== me &&
                    (me &&
                      process.stdout.write(`
`),
                    (me = G),
                    process.stdout.write(`${c.cyan}${G}${c.reset}  `));
                  return;
                }
                let X = se
                  ? `${c.red}\u2717${c.reset}`
                  : W >= 80
                    ? `${c.green}\xB7${c.reset}`
                    : W >= 40
                      ? `${c.yellow}\xB7${c.reset}`
                      : `${c.red}\xB7${c.reset}`;
                process.stdout.write(X);
              },
            });
          me &&
            process.stdout.write(`
`);
          try {
            st.writeFileSync(L, JSON.stringify(le, null, 2));
          } catch {}
          w(N);
          let ie = He.join(process.cwd(), "README.md"),
            oe = k(le, ie),
            ce = R(le),
            { buildCategoryWinners: Q } = Cn(),
            { updateRoutingConfig: E } = Rr(),
            M = Q(le),
            U = E(M);
          if (
            (oe &&
              console.log(
                `${c.green}README.md benchmark table updated${c.reset}`,
              ),
            ce.updated
              ? console.log(
                  `${c.green}DEFAULT_MODEL: ${ce.previousModel} \u2192 ${ce.newModel}${c.reset}`,
                )
              : ce.reason &&
                console.log(
                  `${c.dim}models.env unchanged: ${ce.reason}${c.reset}`,
                ),
            U.changes.length > 0)
          ) {
            console.log(`${c.green}Routing updated:${c.reset}`);
            for (let G of U.changes) console.log(`  ${c.dim}${G}${c.reset}`);
          }
          return (console.log(), !0);
        }
        let { runBenchmark: s, DEFAULT_MODELS: r, QUICK_MODELS: i } = Cn(),
          a = o.includes("--quick"),
          l = o.find((y) => y.startsWith("--models=")),
          u = l
            ? l
                .replace("--models=", "")
                .split(",")
                .map((y) => y.trim())
                .filter(Boolean)
            : [],
          d = a ? 7 : 15,
          f = u.length > 0 ? u : a ? i : r;
        (console.log(`
${c.bold}Starting benchmark${c.reset}  ${c.dim}${d} tasks \xB7 ${f.length} models \xB7 ollama cloud${c.reset}`),
          console.log(`${c.dim}Models: ${f.join(", ")}${c.reset}
`));
        let m = "",
          h = 0,
          p = d * f.length,
          g = await s({
            models: f,
            quick: a,
            onProgress: ({
              model: y,
              task: w,
              done: k,
              score: R,
              error: x,
            }) => {
              if (!k) {
                y !== m &&
                  (m &&
                    process.stdout.write(`
`),
                  (m = y),
                  process.stdout.write(`${c.cyan}${y}${c.reset}  `));
                return;
              }
              h++;
              let _ = x
                ? `${c.red}\u2717${c.reset}`
                : R >= 80
                  ? `${c.green}\xB7${c.reset}`
                  : R >= 40
                    ? `${c.yellow}\xB7${c.reset}`
                    : `${c.red}\xB7${c.reset}`;
              process.stdout.write(_);
            },
          });
        if (
          (m &&
            process.stdout.write(`
`),
          !a && g && g.length > 0)
        ) {
          let { buildCategoryWinners: y } = Cn(),
            {
              updateRoutingConfig: w,
              updateReadme: k,
              updateModelsEnv: R,
            } = Rr(),
            x = y(g),
            _ = w(x);
          if (_.changes.length > 0) {
            console.log(`
${c.bold}Per-category routing saved:${c.reset}`);
            for (let C of _.changes) console.log(`  ${c.dim}${C}${c.reset}`);
          }
          let b = He.join(process.cwd(), "README.md");
          (k(g, b) && console.log(`${c.green}README.md updated${c.reset}`),
            R(g));
          let O = require("os"),
            N = He.join(O.homedir(), ".nex-code", "benchmark-results.json");
          try {
            st.writeFileSync(N, JSON.stringify(g, null, 2));
          } catch {}
        }
        return !0;
      }
      case "/bench": {
        let { runJarvisBenchmark: s } = Cn(),
          r = o.includes("--dry-run"),
          i = o.find((l) => l.startsWith("--model=")),
          a = i ? i.replace("--model=", "").trim() : void 0;
        return (
          r ||
            console.log(`
${c.bold}Jarvis Benchmark${c.reset}  ${c.dim}5 agentic scenarios \xB7 each run as child process${c.reset}
`),
          await s({
            dryRun: r,
            model: a,
            cwd: St,
            onProgress: ({ id: l, name: u, done: d, score: f, grade: m }) => {
              if (!d)
                process.stdout.write(`${c.dim}  \u2192 ${u}...${c.reset}`);
              else {
                let h = f >= 8 ? c.green : f >= 6 ? c.yellow : c.red;
                process.stdout.write(` ${h}${f}/10 (${m})${c.reset}
`);
              }
            },
          }),
          !0
        );
      }
      case "/trend": {
        let { showScoreTrend: s } = Cn(),
          r = parseInt(o[0], 10) || 10;
        return (s(r), !0);
      }
      case "/orchestrate": {
        let s = o.join(" ").trim();
        if (!s)
          return (
            console.log(`${c.yellow}Usage: /orchestrate <prompt>${c.reset}`),
            console.log(
              `${c.dim}Example: /orchestrate fix login bug, update docs, add dark mode${c.reset}`,
            ),
            !0
          );
        let { runOrchestrated: r } = Us();
        return (await r(s), !0);
      }
      case "/bench-orchestrator": {
        let { runOrchestratorBenchmark: s, printResults: r } = tm(),
          i = o.find((u) => u.startsWith("--models=")),
          a = i
            ? i
                .replace("--models=", "")
                .split(",")
                .map((u) => u.trim())
            : void 0,
          l = await s({
            models: a,
            onProgress: ({
              model: u,
              scenario: d,
              done: f,
              score: m,
              error: h,
            }) => {
              f
                ? h
                  ? process.stdout.write(` ${c.red}ERR${c.reset}
`)
                  : process.stdout.write(` ${c.green}${m}/10${c.reset}
`)
                : process.stdout.write(
                    `${c.dim}  \u2192 ${u}: ${d}...${c.reset}`,
                  );
            },
          });
        return (r(l), !0);
      }
      case "/exit":
      case "/quit":
        (process.stdout.write("\x1B[r\x1B[H\x1B[2J\x1B[3J"), process.exit(0));
      default:
        if (ck(t)) return !0;
        {
          let s = [...so, ...Mr()].map((l) => l.cmd.split(" ")[0]),
            r = (l, u) => {
              let d = l.length,
                f = u.length,
                m = Array.from({ length: d + 1 }, (h, p) =>
                  Array.from({ length: f + 1 }, (g, y) =>
                    p === 0 ? y : y === 0 ? p : 0,
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
            a = 3;
          for (let l of s) {
            let u = r(n, l);
            u < a && ((a = u), (i = l));
          }
          console.log(
            i
              ? `${c.red}Unknown command: ${n}.${c.reset} ${c.dim}Did you mean ${c.reset}${c.cyan}${i}${c.reset}${c.dim}? Type /help for all commands.${c.reset}`
              : `${c.red}Unknown command: ${n}. Type /help${c.reset}`,
          );
        }
        return !0;
    }
  }
  var sc = 1e3;
  function oc() {
    return He.join(process.cwd(), ".nex", "repl_history");
  }
  function hm() {
    try {
      let t = oc();
      if (st.existsSync(t))
        return st
          .readFileSync(t, "utf-8")
          .split(
            `
`,
          )
          .filter(Boolean)
          .slice(-sc);
    } catch {}
    return [];
  }
  function Nr(t) {
    try {
      let e = oc(),
        n = He.dirname(e);
      (st.existsSync(n) || st.mkdirSync(n, { recursive: !0 }),
        st.appendFileSync(
          e,
          t +
            `
`,
        ));
    } catch {}
  }
  function wt() {
    return `${c.bold}${c.cyan}>${c.reset} `;
  }
  function to() {
    if (!global._nexFooter) return;
    let { isPlanMode: t, getAutonomyLevel: e } = Dt(),
      { getAutoConfirm: n } = Xe(),
      o = [];
    t() && o.push("plan");
    let s = e();
    (s === "semi-auto" && o.push("semi"),
      s === "autonomous" && o.push("auto"),
      n() && o.push("always"),
      global._nexFooter.setStatusInfo({ mode: o.join(" \xB7 ") }));
  }
  var rc = "\x1B[200~",
    ic = "\x1B[201~";
  function pk(t) {
    return typeof t == "string" && t.includes(rc);
  }
  function mk(t) {
    return typeof t == "string" && t.includes(ic);
  }
  function no(t) {
    return typeof t != "string" ? t : t.split(rc).join("").split(ic).join("");
  }
  async function hk() {
    if (!ik("local")) return !1;
    try {
      let { exec: e } = require("child_process"),
        { promisify: n } = require("util");
      return (
        await n(e)("curl -s --max-time 1 http://localhost:11434/api/tags"),
        nc("local:llama3"),
        !0
      );
    } catch {
      return !1;
    }
  }
  async function gk() {
    let {
      setAbortSignalGetter: t,
      getConversationLength: e,
      processInput: n,
    } = Se();
    t(cm);
    let s = tc().some((I) => I.configured),
      r = (async () => {
        ak();
        let I = Xt(),
          W = An();
        return { model: I, providerName: W };
      })(),
      i = (async () =>
        s
          ? !0
          : (await hk())
            ? (console.log(
                `${c.green}\u2713 Local Ollama detected \u2014 using local models${c.reset}`,
              ),
              console.log(`${c.dim}Tip: Set API keys for cloud providers for more model options (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)${c.reset}
`),
              !0)
            : !1)(),
      a = (async () => {
        if (process.env.NEX_DISABLE_UPDATE_CHECK === "1")
          return { hasNewVersion: !1 };
        try {
          let { checkForNewVersion: I } = om();
          return await I();
        } catch {
          return { hasNewVersion: !1 };
        }
      })(),
      [l, u, d] = await Promise.all([r, i, a]);
    !u &&
      !s &&
      (console.error(`
${c.red}\u2717 No provider configured and no local Ollama detected.${c.reset}
`),
      process.exit(1));
    let { loadPersistedHistory: f, pruneHistory: m } = Wt();
    (f().then((I) => {}), m().catch(() => {}));
    let h = hm(),
      p = tk.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: wt(),
        completer: dm,
        history: h,
        historySize: sc,
      });
    lk(p);
    let { setAskUserHandler: g } = Et();
    g(async (I, W) => {
      let se = "\x1B[0m",
        X = "\x1B[1m",
        Z = "\x1B[2m",
        he = "\x1B[36m";
      return (
        process.stdout.write(`
  ${X}\x1B[33m\u2753${se}  ${X}${I}${se}

`),
        W.forEach((we, be) => {
          process.stdout.write(`  ${he}${be + 1}${se}  ${we}
`);
        }),
        process.stdout
          .write(`  ${Z}${W.length + 1}${se}  ${Z}Eigene Antwort\u2026${se}
`),
        process.stdout.write(`
  ${he}[1-${W.length + 1}]${se} \u203A `),
        new Promise((we) => {
          (p.resume(),
            p.once("line", (be) => {
              let je = be.trim(),
                Ge = parseInt(je);
              Ge >= 1 && Ge <= W.length
                ? (process.stdout.write(`
`),
                  we(W[Ge - 1]))
                : Ge === W.length + 1 || je === ""
                  ? (process.stdout.write(`  ${he}\u203A${se} `),
                    p.once("line", (Jt) => {
                      (process.stdout.write(`
`),
                        we(Jt.trim() || ""));
                    }))
                  : (process.stdout.write(`
`),
                    we(je));
            }));
        })
      );
    });
    let y = new fk();
    (y.activate(p),
      (global._nexFooter = y),
      (global._nexRawWrite = (I) => y.rawWrite(I)),
      dk(() => to()),
      process.stdout.isTTY && process.stdout.write("\x1B[H\x1B[2J\x1B[3J"));
    let w =
      l.providerName === "ollama"
        ? l.model.id
        : `${l.providerName}:${l.model.id}`;
    nk(w, St, { yolo: Za() });
    {
      y.setStatusInfo({ model: w, branch: "", project: He.basename(St) });
      let { execFile: I } = require("child_process");
      I(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        { encoding: "utf8" },
        (W, se) => {
          !W &&
            se &&
            y.setStatusInfo({
              model: w,
              branch: se.trim(),
              project: He.basename(St),
            });
        },
      );
    }
    (d.hasNewVersion &&
      console.log(`${c.yellow}\u{1F4A1} New version available!${c.reset} Run ${c.cyan}npm update -g nex-code${c.reset} to upgrade from ${c.dim}${d.currentVersion}${c.reset} to ${c.green}${d.latestVersion}${c.reset}
`),
      await am(St));
    let k = !1,
      R = 0,
      x = !1,
      _ = null;
    function b() {
      (im(),
        y.deactivate(),
        rm(),
        process.stdin.isTTY && process.stdout.write("\x1B[?2004l"),
        process.stdout.write("\x1B[r\x1B[H\x1B[2J\x1B[3J"),
        process.exit(0));
    }
    (process.on("SIGTERM", b),
      process.on("exit", () => {
        im();
      }),
      p.on("SIGINT", () => {
        if ((rm(), R++, R >= 2)) {
          b();
          return;
        }
        if (k) {
          zt && zt.abort();
          let { cancelPendingAskUser: I } = Et();
          (I(),
            console.log(`
${c.yellow}  Task cancelled. Press Ctrl+C again to exit.${c.reset}`),
            (k = !1),
            p.setPrompt(wt()),
            p.prompt());
        } else
          (console.log(`${c.dim}  (Press Ctrl+C again to exit)${c.reset}`),
            p.setPrompt(wt()),
            p.prompt(),
            _ && clearTimeout(_),
            (_ = setTimeout(() => {
              ((R = 0), (_ = null));
            }, 2e3)));
      }),
      process.on("SIGINT", () => {
        process.stdin.isTTY ? (R++, R >= 2 && b()) : b();
      }));
    let O = !1,
      N = [],
      C = 0,
      L = {},
      Ee = !1;
    function me() {
      let I = N.join(
        `
`,
      )
        .replace(/\r/g, "")
        .trim();
      if (((N = []), (O = !1), !I)) return !0;
      (C++, (Ee = !0));
      let W = C;
      L[W] = I;
      let se = I.split(`
`).length,
        X =
          se > 1
            ? `[Pasted content #${W} \u2014 ${se} lines]`
            : `[Pasted content #${W}]`,
        Z = p.line || "",
        he = Z && !Z.endsWith(" ") ? " " : "",
        pe = Z + he + X;
      return (
        p.setPrompt(wt()),
        p.prompt(),
        (p.line = pe),
        (p.cursor = pe.length),
        p._refreshLine(),
        !0
      );
    }
    function le(I) {
      return I.replace(
        /\[Pasted content #(\d+)(?:[^\]]*)\]/g,
        (W, se) => L[Number(se)] || "",
      );
    }
    function ie() {
      ((C = 0), (L = {}), (Ee = !1));
    }
    if (process.stdin.isTTY) {
      process.stdout.write("\x1B[?2004h");
      let I = process.stdin.emit.bind(process.stdin);
      process.stdin.emit = function (W, ...se) {
        if (W !== "data") return I.call(process.stdin, W, ...se);
        let X = se[0];
        if (
          (Buffer.isBuffer(X) && (X = X.toString("utf8")), typeof X != "string")
        )
          return I.call(process.stdin, W, ...se);
        let Z = X.includes(rc),
          he = X.includes(ic);
        if (Z && he) {
          let pe = no(X);
          return (
            pe &&
              N.push(
                ...pe.split(`
`),
              ),
            me()
          );
        }
        if (Z) {
          ((O = !0), (N = []));
          let pe = no(X);
          return (
            pe &&
              N.push(
                ...pe.split(`
`),
              ),
            !0
          );
        }
        if (he) {
          let pe = no(X);
          return (
            pe &&
              N.push(
                ...pe.split(`
`),
              ),
            me()
          );
        }
        if (O) {
          let pe = no(X);
          return (
            pe &&
              N.push(
                ...pe.split(`
`),
              ),
            !0
          );
        }
        return X.includes(`
`) &&
          X.length > 40 &&
          !O
          ? (N.push(
              ...X.replace(/\r/g, "").split(`
`),
            ),
            me())
          : I.call(process.stdin, W, ...se);
      };
    }
    let oe = 0;
    function ce() {
      if (oe > 0) {
        let I = y._scrollEnd,
          W = "\x1B7";
        for (let se = 0; se < oe; se++)
          W += `\x1B[${I - oe + 1 + se};1H\x1B[2K`;
        ((W += "\x1B8"), y.rawWrite(W), (oe = 0));
      }
    }
    function Q(I) {
      let W = [...so, ...Mr()].filter((be) => be.cmd.startsWith(I));
      if (!W.length || (W.length === 1 && W[0].cmd === I)) return;
      let se = y._scrollEnd,
        X = Math.min(10, se - 2);
      if (X < 1) return;
      let Z = W.slice(0, X),
        he = Math.max(...Z.map((be) => be.cmd.length));
      ((oe = Z.length), W.length > X && oe++);
      let pe = se - oe + 1,
        we = "\x1B7";
      for (let be = 0; be < Z.length; be++) {
        let { cmd: je, desc: Ge } = Z[be],
          Jt = je.substring(0, I.length),
          On = je.substring(I.length),
          Pr = " ".repeat(Math.max(0, he - je.length + 2));
        we += `\x1B[${pe + be};1H\x1B[2K  ${c.cyan}${Jt}${c.reset}${c.dim}${On}${Pr}${Ge}${c.reset}`;
      }
      (W.length > X &&
        (we += `\x1B[${pe + Z.length};1H\x1B[2K  ${c.dim}\u2026 +${W.length - X} more${c.reset}`),
        (we += "\x1B8"),
        y.rawWrite(we));
    }
    process.stdin.isTTY &&
      process.stdin.on("keypress", (I, W) => {
        (ce(),
          !(W && (W.name === "tab" || W.name === "return")) &&
            setImmediate(() => {
              p.line && p.line.startsWith("/") && Q(p.line);
            }));
      });
    let E = null,
      M = `${c.dim}...${c.reset} `;
    function U(I) {
      return (I.match(/[^\s\d](\d{1,2})\.\s+\S/g) || []).length < 2
        ? I
        : I.replace(
            /([^\s\d])(\d{1,2})\.\s+/g,
            (se, X, Z) => `${X}
${Z}. `,
          ).trim();
    }
    let { loadSession: G } = At(),
      { setConversationMessages: ne } = Se();
    if (e() === 0) {
      let I = G("_autosave");
      if (
        I &&
        I.messages &&
        I.messages.length > 0 &&
        Date.now() - new Date(I.updatedAt).getTime() < 1440 * 60 * 1e3
      ) {
        let { confirm: se } = Xe();
        if (await se("Previous session found. Resume?")) {
          let he = I.messages,
            pe = he.length > 20 ? he.slice(-20) : he;
          ne(pe);
          let { getUsage: we, forceCompress: be } = Qe();
          if (we(pe, []).percentage >= 30) {
            let { messages: Ge } = be(pe, []);
            ne(Ge);
          }
        }
      }
    }
    (p.setPrompt(wt()),
      p.prompt(),
      p.on("line", async (I) => {
        if (
          (ce(),
          Object.keys(L).length > 0 && ((I = le(I)), ie(), p.setPrompt(wt())),
          k)
        ) {
          let Z = I.trim();
          if (Z) {
            let { injectMidRunNote: he } = Se();
            (he(Z),
              process.stdout
                .write(`${c.cyan}  \u270E Queued \u2014 will be applied in the next step${c.reset}
`),
              p.prompt());
          }
          return;
        }
        if (E !== null) {
          if (E._mode === "triple") {
            if (I.trim() === '"""') {
              let Z = E.join(
                `
`,
              ).trim();
              if (((E = null), Z)) {
                (Nr(Z.replace(/\n/g, "\\n")),
                  (k = !0),
                  p.prompt(),
                  (R = 0),
                  (x = !1),
                  _ && (clearTimeout(_), (_ = null)),
                  (zt = new AbortController()));
                try {
                  await n(Z);
                } catch (pe) {
                  if (!zt?.signal?.aborted) {
                    let we =
                      pe.message?.split(`
`)[0] || "An unexpected error occurred";
                    console.log(`${c.red}Error: ${we}${c.reset}`);
                  }
                }
                k = !1;
                let he = se();
                he > 0 &&
                  process.stdout.write(`${c.gray}[${he} messages] ${c.reset}`);
              }
              (p.setPrompt(wt()), p.prompt());
              return;
            }
            (E.push(I), p.setPrompt(M), p.prompt());
            return;
          }
          if (I.endsWith("\\")) E.push(I.slice(0, -1));
          else {
            E.push(I);
            let Z = E.join(
              `
`,
            ).trim();
            if (((E = null), Z)) {
              (Nr(Z.replace(/\n/g, "\\n")),
                (k = !0),
                p.prompt(),
                (R = 0),
                (x = !1),
                _ && (clearTimeout(_), (_ = null)),
                (zt = new AbortController()));
              try {
                await n(Z);
              } catch (we) {
                if (!zt?.signal?.aborted) {
                  let be =
                    we.message?.split(`
`)[0] || "An unexpected error occurred";
                  console.log(`${c.red}Error: ${be}${c.reset}`);
                }
              }
              let { getConversationLength: he } = Se();
              k = !1;
              let pe = he();
              pe > 0 &&
                process.stdout.write(`${c.gray}[${pe} messages] ${c.reset}`);
            }
            (p.setPrompt(wt()), p.prompt());
            return;
          }
          (p.setPrompt(M), p.prompt());
          return;
        }
        if (I.trim() === '"""' || I.trim().startsWith('"""')) {
          let Z = I.trim().substring(3);
          ((E = Z ? [Z] : []),
            (E._mode = "triple"),
            p.setPrompt(M),
            p.prompt());
          return;
        }
        if (I.endsWith("\\")) {
          ((E = [I.slice(0, -1)]),
            (E._mode = "backslash"),
            p.setPrompt(M),
            p.prompt());
          return;
        }
        let W = U(I.trim());
        if (!W) {
          (p.setPrompt(wt()), p.prompt());
          return;
        }
        if ((Nr(W), W === "/")) {
          (lm(), p.setPrompt(wt()), p.prompt());
          return;
        }
        if (W.startsWith("/")) {
          (await mm(W, p), p.setPrompt(wt()), p.prompt());
          return;
        }
        {
          let Z = sk ? "\x1B[48;5;237m" : "\x1B[48;2;220;225;235m",
            he = process.stdout.columns || 80;
          W.split(
            `
`,
          ).forEach((we, be) => {
            let je = be === 0 ? "\x1B[1;36m\u203A\x1B[22;39m" : " ",
              Ge = 2 + we.length,
              Jt = " ".repeat(Math.max(0, he - Ge));
            console.log(`${Z}${je} ${we}${Jt}\x1B[0m`);
          });
        }
        if (process.env.NEX_AUTO_PLAN !== "0" && !Za()) {
          let { isPlanMode: Z, setPlanMode: he } = Dt(),
            { invalidateSystemPromptCache: pe } = Se(),
            we = /\b(implement|refactor|migrate|redesign)\b/i,
            be = /\b(create|build|add|write|introduce|develop|set\s+up)\b/i,
            je =
              /^(how|what|why|when|where|which|explain|show|list|tell|describe|can\s+you|could\s+you|do\s+you)\b/i,
            Ge = /\b(spawn[_\s]?agents?|swarm)\b/i;
          !je.test(W) &&
            !Ge.test(W) &&
            (we.test(W) || (be.test(W) && W.split(/\s+/).length >= 5)) &&
            !Z() &&
            (he(!0),
            pe(),
            console.log(
              `${c.cyan}${c.bold}\u2387  Auto Plan Mode${c.reset}${c.dim} \u2014 implementation task detected \xB7 read-only until /plan approve${c.reset}`,
            ));
        }
        {
          let { getConversationLength: Z } = Se();
          if (Z() === 0)
            try {
              let { detectCategory: he, getModelForCategory: pe } = Ka(),
                we = he(W);
              if (we && we.id !== "coding") {
                let be = pe(we.id),
                  je = Xt();
                if (be && be !== je?.id && nc(be)) {
                  let Ge = Xt();
                  (console.log(
                    `${c.dim}\u21B3 ${we.icon} ${we.label} task \u2014 routing to ${Ge?.name || be}${c.reset}`,
                  ),
                    global._nexFooter &&
                      global._nexFooter.setStatusInfo({
                        model: Ge?.name || be,
                      }));
                }
              }
            } catch {}
        }
        ((k = !0),
          p.prompt(),
          (R = 0),
          (x = !1),
          _ && (clearTimeout(_), (_ = null)),
          (zt = new AbortController()));
        try {
          await n(W);
        } catch (Z) {
          if (!zt?.signal?.aborted) {
            let he =
              Z.message?.split(`
`)[0] || "An unexpected error occurred";
            console.log(`${c.red}Error: ${he}${c.reset}`);
          }
        }
        k = !1;
        let { getConversationLength: se } = Se(),
          X = se();
        (X > 0 && process.stdout.write(`${c.gray}[${X} messages] ${c.reset}`),
          p.setPrompt(wt()),
          p.prompt());
      }),
      p.on("close", () => {
        (process.stdin.isTTY && process.stdout.write("\x1B[?2004l"),
          process.stdout.write("\x1B[r\x1B[H\x1B[2J\x1B[3J"),
          process.exit(0));
      }));
  }
  gm.exports = {
    startREPL: gk,
    getPrompt: wt,
    loadHistory: hm,
    appendHistory: Nr,
    getHistoryPath: oc,
    HISTORY_MAX: sc,
    showCommandList: lm,
    completer: dm,
    completeFilePath: um,
    handleSlashCommand: mm,
    showProviders: ec,
    showHelp: fm,
    renderBar: pm,
    hasPasteStart: pk,
    hasPasteEnd: mk,
    stripPasteSequences: no,
    getAbortSignal: cm,
  };
});
var wm = H((Xv, ym) => {
  ym.exports = $m();
});
var uc = require("path");
require("dotenv").config({ path: uc.join(__dirname, "..", ".env") });
require("dotenv").config();
var ye = process.argv.slice(2);
(ye.includes("--help") || ye.includes("-h")) &&
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
  --auto-orchestrate       Automatically use orchestrator when \u22653 goals detected
  --orchestrator-model <m> Model for orchestrator (default: kimi-k2.5)
  --debug                  Show internal diagnostic messages (compression, loop detection, guards)
  --json                   Output result as JSON (for CI parsing)
  -h, --help               Show this help
  -v, --version            Show version
`),
  process.exit(0));
if (ye.includes("-v") || ye.includes("--version")) {
  let t = Nn();
  (console.log(t.version), process.exit(0));
}
var xm = ye.includes("--yolo") || ye.includes("-yolo");
if (xm) {
  let { setAutoConfirm: t } = Xe();
  t(!0);
}
if (!xm)
  try {
    let t = require("fs"),
      e = uc.join(process.cwd(), ".nex", "config.json");
    if (t.existsSync(e) && JSON.parse(t.readFileSync(e, "utf-8")).yolo === !0) {
      let { setAutoConfirm: o } = Xe();
      o(!0);
    }
  } catch {}
var ac = ye.indexOf("--model");
if (ac !== -1 && ye[ac + 1]) {
  let { setActiveModel: t } = Oe();
  t(ye[ac + 1]);
}
var cc = ye.indexOf("--max-turns");
if (cc !== -1 && ye[cc + 1]) {
  let t = parseInt(ye[cc + 1], 10);
  if (t > 0) {
    let { setMaxIterations: e } = Se();
    e(t);
  }
} else
  try {
    let t = require("fs"),
      e = uc.join(process.cwd(), ".nex", "config.json");
    if (t.existsSync(e)) {
      let n = JSON.parse(t.readFileSync(e, "utf-8")),
        o = parseInt(n.maxIterations, 10);
      if (o > 0) {
        let { setMaxIterations: s } = Se();
        s(o);
      }
    }
  } catch {}
function lc() {
  if (process.platform === "darwin")
    try {
      let { spawn: t } = require("child_process"),
        e = t("caffeinate", ["-i", "-m"], { stdio: "ignore", detached: !1 });
      e.unref();
      let n = () => {
        try {
          e.kill();
        } catch {}
      };
      (process.on("exit", n),
        process.on("SIGINT", n),
        process.on("SIGTERM", n));
    } catch {}
}
async function $k() {
  let { runSetupWizard: t } = Fa();
  await t();
}
function bm(t) {
  if (ye.includes("--auto")) {
    let { setAutoConfirm: a } = Xe();
    a(!0);
  }
  if (!ye.includes("--model")) {
    let { setActiveModel: a } = Oe(),
      l = process.env.HEADLESS_MODEL || "devstral-small-2:24b";
    a(l);
  }
  let n =
      ye.includes("--auto-orchestrate") ||
      process.env.NEX_AUTO_ORCHESTRATE === "true",
    o = ye.indexOf("--orchestrator-model"),
    s = o !== -1 ? ye[o + 1] : void 0,
    { processInput: r, getConversationMessages: i } = Se();
  r(t, null, { autoOrchestrate: n, orchestratorModel: s })
    .then(() => {
      if (ye.includes("--json")) {
        let l = i()
          .filter((u) => u.role === "assistant")
          .pop();
        console.log(
          JSON.stringify({ success: !0, response: l?.content || "" }),
        );
      }
      process.exit(0);
    })
    .catch((a) => {
      (ye.includes("--json")
        ? console.log(JSON.stringify({ success: !1, error: a.message }))
        : console.error(a.message),
        process.exit(1));
    });
}
if (ye.includes("--server")) {
  let { setAutoConfirm: t } = Xe();
  (t(!0), fp().startServerMode());
  return;
}
var _m = ye.indexOf("--prompt-file");
if (_m !== -1) {
  let t = ye[_m + 1];
  (!t || t.startsWith("--")) &&
    (console.error("--prompt-file requires a file path"), process.exit(1));
  let e = require("fs"),
    n;
  try {
    n = e.readFileSync(t, "utf-8").trim();
  } catch (o) {
    (console.error(`--prompt-file: cannot read file: ${o.message}`),
      process.exit(1));
  }
  if (
    (n || (console.error("--prompt-file: file is empty"), process.exit(1)),
    ye.includes("--delete-prompt-file"))
  )
    try {
      e.unlinkSync(t);
    } catch {}
  (lc(), bm(n));
} else {
  let t =
    ye.indexOf("--task") !== -1 ? ye.indexOf("--task") : ye.indexOf("--prompt");
  if (t !== -1) {
    let e = ye[t + 1];
    if (
      ((!e || e.startsWith("--")) &&
        (console.error("--task/--prompt requires a prompt"), process.exit(1)),
      lc(),
      ye.includes("--orchestrate"))
    ) {
      let n = ye.indexOf("--orchestrator-model"),
        o = n !== -1 ? ye[n + 1] : void 0,
        { runOrchestrated: s } = Us();
      s(e, { orchestratorModel: o })
        .then(() => {
          process.exit(0);
        })
        .catch((r) => {
          (console.error(`Orchestrator error: ${r.message}`), process.exit(1));
        });
    } else bm(e);
  } else
    $k().then(() => {
      lc();
      let { startREPL: e } = wm();
      e();
    });
}

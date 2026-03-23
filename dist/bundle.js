var _ = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports);
var aa = _(($0, Bd) => {
  Bd.exports = {
    name: "nex-code",
    version: "0.3.5",
    description:
      "Nex Code \u2014 Agentic Coding CLI with Multi-Provider Support",
    bin: { "nex-code": "./bin/nex-code.js" },
    files: ["bin/", "cli/", "README.md", "LICENSE"],
    engines: { node: ">=18.0.0" },
    scripts: {
      start: "node bin/nex-code.js",
      test: "jest --coverage",
      "test:watch": "jest --watch",
      format: "prettier --write .",
      "install-hooks":
        "ln -sf ../../hooks/pre-push .git/hooks/pre-push && chmod +x .git/hooks/pre-push && ln -sf ../../hooks/post-merge .git/hooks/post-merge && chmod +x .git/hooks/post-merge && echo 'Hooks installed (pre-push, post-merge).'",
      prepublishOnly: "npm test",
    },
    keywords: [
      "cli",
      "coding",
      "agent",
      "ai",
      "llm",
      "multi-provider",
      "openai",
      "anthropic",
      "gemini",
      "google",
      "ollama",
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
  };
});
var ua = _((w0, pa) => {
  var P = {
      reset: "\x1B[0m",
      bold: "\x1B[1m",
      dim: "\x1B[2m",
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
      brightCyan: "\x1B[96m",
      brightMagenta: "\x1B[95m",
      brightBlue: "\x1B[94m",
    },
    ra = [
      "\u280B",
      "\u2819",
      "\u2839",
      "\u2838",
      "\u283C",
      "\u2834",
      "\u2826",
      "\u2827",
      "\u2807",
      "\u280F",
    ],
    ca = ["\u273D", "\u2726", "\u2727", "\u2726"],
    Us = class {
      constructor(t = "Thinking...") {
        ((this.text = t),
          (this.frame = 0),
          (this.interval = null),
          (this.startTime = null));
      }
      _render() {
        if (this._stopped) return;
        let t = ra[this.frame % ra.length],
          n = "";
        if (this.startTime) {
          let s = Math.floor((Date.now() - this.startTime) / 1e3);
          if (s >= 60) {
            let o = Math.floor(s / 60),
              i = s % 60;
            n = ` ${P.dim}${o}m ${String(i).padStart(2, "0")}s${P.reset}`;
          } else s >= 1 && (n = ` ${P.dim}${s}s${P.reset}`);
        }
        (process.stderr.write(
          `\x1B[2K\r${P.cyan}${t}${P.reset} ${P.dim}${this.text}${P.reset}${n}`,
        ),
          this.frame++);
      }
      start() {
        ((this._stopped = !1),
          (this.startTime = Date.now()),
          process.stderr.write("\x1B[?25l"),
          this._render(),
          (this.interval = setInterval(() => this._render(), 80)));
      }
      update(t) {
        this.text = t;
      }
      stop() {
        ((this._stopped = !0),
          this.interval &&
            (clearInterval(this.interval), (this.interval = null)),
          process.stderr.write("\x1B[2K\r\x1B[?25h"),
          (this.startTime = null));
      }
    },
    la = [
      "\u280B",
      "\u2819",
      "\u2839",
      "\u2838",
      "\u283C",
      "\u2834",
      "\u2826",
      "\u2827",
      "\u2807",
      "\u280F",
    ],
    Bs = class {
      constructor(t) {
        ((this.labels = t),
          (this.statuses = t.map(() => "running")),
          (this.frame = 0),
          (this.interval = null),
          (this.startTime = null),
          (this.lineCount = t.length));
      }
      _formatElapsed() {
        if (!this.startTime) return "";
        let t = Math.floor((Date.now() - this.startTime) / 1e3);
        if (t < 1) return "";
        let n = Math.floor(t / 60),
          s = t % 60;
        return n > 0 ? `${n}m ${String(s).padStart(2, "0")}s` : `${s}s`;
      }
      _render() {
        if (this._stopped) return;
        let t = la[this.frame % la.length],
          n = this._formatElapsed(),
          s = n ? ` ${P.dim}${n}${P.reset}` : "",
          o = "";
        for (let i = 0; i < this.labels.length; i++) {
          let a, c;
          switch (this.statuses[i]) {
            case "done":
              ((a = `${P.green}\u2713${P.reset}`), (c = P.dim));
              break;
            case "error":
              ((a = `${P.red}\u2717${P.reset}`), (c = P.dim));
              break;
            default:
              ((a = `${P.cyan}${t}${P.reset}`), (c = ""));
          }
          let p = i === this.labels.length - 1 ? s : "";
          o += `\x1B[2K  ${a} ${c}${this.labels[i]}${P.reset}${p}
`;
        }
        (this.lineCount > 0 && (o += `\x1B[${this.lineCount}A`),
          process.stderr.write(o),
          this.frame++);
      }
      start() {
        ((this._stopped = !1), (this.startTime = Date.now()));
        let t = "\x1B[?25l";
        for (let n = 0; n < this.lineCount; n++)
          t += `
`;
        (this.lineCount > 0 && (t += `\x1B[${this.lineCount}A`),
          process.stderr.write(t),
          this._render(),
          (this.interval = setInterval(() => this._render(), 80)));
      }
      update(t, n) {
        t >= 0 && t < this.statuses.length && (this.statuses[t] = n);
      }
      stop() {
        ((this._stopped = !0),
          this.interval &&
            (clearInterval(this.interval), (this.interval = null)),
          this._renderFinal(),
          process.stderr.write("\x1B[?25h"));
      }
      _renderFinal() {
        let t = this._formatElapsed(),
          n = t ? ` ${P.dim}${t}${P.reset}` : "",
          s = "";
        for (let o = 0; o < this.labels.length; o++) {
          let i;
          switch (this.statuses[o]) {
            case "done":
              i = `${P.green}\u2713${P.reset}`;
              break;
            case "error":
              i = `${P.red}\u2717${P.reset}`;
              break;
            default:
              i = `${P.yellow}\u25CB${P.reset}`;
          }
          let a = o === this.labels.length - 1 ? n : "";
          s += `\x1B[2K  ${i} ${P.dim}${this.labels[o]}${P.reset}${a}
`;
        }
        process.stderr.write(s);
      }
    },
    Cn = {
      done: "\u2714",
      in_progress: "\u25FC",
      pending: "\u25FB",
      failed: "\u2717",
    },
    An = { done: P.green, in_progress: P.cyan, pending: P.dim, failed: P.red },
    Qe = null,
    zs = class {
      constructor(t, n) {
        ((this.name = t),
          (this.tasks = n.map((s) => ({
            id: s.id,
            description: s.description,
            status: s.status || "pending",
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
        let t = Math.floor((Date.now() - this.startTime) / 1e3);
        if (t < 1) return "";
        let n = Math.floor(t / 60),
          s = t % 60;
        return n > 0 ? `${n}m ${String(s).padStart(2, "0")}s` : `${s}s`;
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
        let t = ca[this.frame % ca.length],
          n = this._formatElapsed(),
          s = this._formatTokens(),
          o = [n, s ? `\u2193 ${s} tokens` : ""].filter(Boolean).join(" \xB7 "),
          i = o ? ` ${P.dim}(${o})${P.reset}` : "",
          a = `\x1B[2K${P.cyan}${t}${P.reset} ${this.name}\u2026${i}
`;
        for (let c = 0; c < this.tasks.length; c++) {
          let p = this.tasks[c],
            u = c === 0 ? "\u23BF" : " ",
            l = Cn[p.status] || Cn.pending,
            d = An[p.status] || An.pending,
            m =
              p.description.length > 55
                ? p.description.substring(0, 52) + "..."
                : p.description;
          a += `\x1B[2K  ${P.dim}${u}${P.reset}  ${d}${l}${P.reset} ${m}
`;
        }
        ((a += `\x1B[${this.lineCount}A`),
          process.stderr.write(a),
          this.frame++);
      }
      start() {
        ((this._stopped = !1),
          (this.startTime = Date.now()),
          (this._paused = !1));
        let t = "\x1B[?25l";
        for (let n = 0; n < this.lineCount; n++)
          t += `
`;
        ((t += `\x1B[${this.lineCount}A`),
          process.stderr.write(t),
          this._render(),
          (this.interval = setInterval(() => this._render(), 120)),
          (Qe = this));
      }
      stop() {
        ((this._stopped = !0),
          this.interval &&
            (clearInterval(this.interval), (this.interval = null)),
          this._paused || this._renderFinal(),
          process.stderr.write("\x1B[?25h"),
          (this._paused = !1),
          Qe === this && (Qe = null));
      }
      pause() {
        if (this._paused) return;
        this.interval && (clearInterval(this.interval), (this.interval = null));
        let t = "";
        for (let n = 0; n < this.lineCount; n++)
          t += `\x1B[2K
`;
        ((t += `\x1B[${this.lineCount}A`),
          process.stderr.write(t),
          (this._paused = !0));
      }
      resume() {
        if (!this._paused) return;
        this._paused = !1;
        let t = "\x1B[?25l";
        for (let n = 0; n < this.lineCount; n++)
          t += `
`;
        ((t += `\x1B[${this.lineCount}A`),
          process.stderr.write(t),
          this._render(),
          (this.interval = setInterval(() => this._render(), 120)));
      }
      updateTask(t, n) {
        let s = this.tasks.find((o) => o.id === t);
        s && (s.status = n);
      }
      setStats({ tokens: t }) {
        t !== void 0 && (this.tokens = t);
      }
      isActive() {
        return this.interval !== null || this._paused;
      }
      _renderFinal() {
        let t = this._formatElapsed(),
          n = this.tasks.filter((c) => c.status === "done").length,
          s = this.tasks.filter((c) => c.status === "failed").length,
          o = this.tasks.length,
          i = s > 0 ? `${n}/${o} done, ${s} failed` : `${n}/${o} done`,
          a = `\x1B[2K${P.green}\u2714${P.reset} ${this.name} ${P.dim}(${t} \xB7 ${i})${P.reset}
`;
        for (let c = 0; c < this.tasks.length; c++) {
          let p = this.tasks[c],
            u = c === 0 ? "\u23BF" : " ",
            l = Cn[p.status] || Cn.pending,
            d = An[p.status] || An.pending,
            m =
              p.description.length > 55
                ? p.description.substring(0, 52) + "..."
                : p.description;
          a += `\x1B[2K  ${P.dim}${u}${P.reset}  ${d}${l}${P.reset} ${P.dim}${m}${P.reset}
`;
        }
        process.stderr.write(a);
      }
    };
  function zd(e) {
    Qe = e;
  }
  function Wd() {
    return Qe;
  }
  function Hd() {
    (Qe && (Qe.stop(), (Qe = null)),
      process.stderr.write("\x1B[?25h\x1B[2K\r"));
  }
  pa.exports = {
    C: P,
    Spinner: Us,
    MultiProgress: Bs,
    TaskProgress: zs,
    setActiveTaskProgress: zd,
    getActiveTaskProgress: Wd,
    cleanupTerminal: Hd,
  };
});
var ma = _((k0, da) => {
  var ae = {
    reset: "\x1B[0m",
    bold: "\x1B[1m",
    dim: "\x1B[2m",
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
    brightCyan: "\x1B[96m",
    brightMagenta: "\x1B[95m",
    brightBlue: "\x1B[94m",
  };
  function Gd(e, t) {
    let n;
    switch (e) {
      case "write_file":
        n = `path=${t.path} (${(t.content || "").length} chars)`;
        break;
      case "edit_file":
        n = `path=${t.path}`;
        break;
      case "bash":
        n = t.command?.substring(0, 100) || "";
        break;
      default:
        n = JSON.stringify(t).substring(0, 120);
    }
    return `${ae.yellow}  \u25B8 ${e}${ae.reset} ${ae.dim}${n}${ae.reset}`;
  }
  function Kd(e, t = 8) {
    let n = e.split(`
`),
      s = n.slice(0, t),
      o = n.length - t,
      i = s.map((a) => `${ae.green}    ${a}${ae.reset}`).join(`
`);
    return (
      o > 0 &&
        (i += `
${ae.gray}    ...+${o} more lines${ae.reset}`),
      i
    );
  }
  function Jd(e, t) {
    switch (e) {
      case "bash":
      case "ask_user":
      case "write_file":
      case "edit_file":
      case "patch_file":
      case "task_list":
      case "spawn_agents":
        return null;
      case "read_file":
        return `Reading: ${t.path || "file"}`;
      case "list_directory":
        return `Listing: ${t.path || "."}`;
      case "search_files":
        return `Searching: ${t.pattern || "..."}`;
      case "glob":
        return `Glob: ${t.pattern || "..."}`;
      case "grep":
        return `Grep: ${t.pattern || "..."}`;
      case "web_fetch":
        return `Fetching: ${(t.url || "").substring(0, 60)}`;
      case "web_search":
        return `Searching web: ${(t.query || "").substring(0, 50)}`;
      case "git_status":
        return "Git status...";
      case "git_diff":
        return `Git diff${t.file ? `: ${t.file}` : ""}...`;
      case "git_log":
        return `Git log${t.file ? `: ${t.file}` : ""}...`;
      default:
        return `Running: ${e}`;
    }
  }
  function Vd(e, t, n, s) {
    let o = String(n || ""),
      i = s ? `${ae.red}\u2717${ae.reset}` : `${ae.green}\u2713${ae.reset}`;
    if (s) {
      let c = o
        .split(
          `
`,
        )[0]
        .replace(/^ERROR:\s*/i, "")
        .substring(0, 60);
      return `  ${i} ${ae.dim}${e}${ae.reset} ${ae.red}\u2192 ${c}${ae.reset}`;
    }
    let a;
    switch (e) {
      case "read_file": {
        let c = o
            .split(
              `
`,
            )
            .filter(Boolean),
          p = c.length,
          u = c[c.length - 1],
          l = u ? parseInt(u.match(/^(\d+):/)?.[1] || "0") : 0;
        (t.line_start || t.line_end) && l > p
          ? (a = `${t.path || "file"} (lines ${t.line_start || 1}-${l})`)
          : (a = `${t.path || "file"} (${p} lines)`);
        break;
      }
      case "write_file": {
        let c = (t.content || "").length;
        a = `${t.path || "file"} (${c} chars)`;
        break;
      }
      case "edit_file":
        a = `${t.path || "file"} \u2192 edited`;
        break;
      case "patch_file": {
        let c = (t.patches || []).length;
        a = `${t.path || "file"} (${c} patches)`;
        break;
      }
      case "bash": {
        let c = (t.command || "").substring(0, 40),
          p = (t.command || "").length > 40 ? "..." : "",
          u = o.match(/^EXIT (\d+)/);
        u ? (a = `${c}${p} \u2192 exit ${u[1]}`) : (a = `${c}${p} \u2192 ok`);
        break;
      }
      case "grep":
      case "search_files": {
        if (o.includes("(no matches)") || o === "no matches")
          a = `${t.pattern || "..."} \u2192 no matches`;
        else {
          let c = o
            .split(
              `
`,
            )
            .filter(Boolean).length;
          a = `${t.pattern || "..."} \u2192 ${c} matches`;
        }
        break;
      }
      case "glob": {
        if (o === "(no matches)") a = `${t.pattern || "..."} \u2192 no matches`;
        else {
          let c = o
            .split(
              `
`,
            )
            .filter(Boolean).length;
          a = `${t.pattern || "..."} \u2192 ${c} files`;
        }
        break;
      }
      case "list_directory": {
        let c =
          o === "(empty)"
            ? 0
            : o
                .split(
                  `
`,
                )
                .filter(Boolean).length;
        a = `${t.path || "."} \u2192 ${c} entries`;
        break;
      }
      case "git_status": {
        let c = o.match(/Branch:\s*(\S+)/),
          p = o
            .split(
              `
`,
            )
            .filter((u) => /^\s*[MADRCU?!]/.test(u)).length;
        a = c ? `${c[1]}, ${p} changes` : "done";
        break;
      }
      case "git_diff":
      case "git_log":
        a = "done";
        break;
      case "web_fetch":
        a = `${(t.url || "").substring(0, 50)} \u2192 fetched`;
        break;
      case "web_search": {
        let c = o
          .split(
            `

`,
          )
          .filter(Boolean).length;
        a = `${(t.query || "").substring(0, 40)} \u2192 ${c} results`;
        break;
      }
      case "task_list":
        a = `${t.action || "list"} \u2192 done`;
        break;
      case "spawn_agents": {
        let c = (t.agents || []).length,
          p = (o.match(/✓ Agent/g) || []).length,
          u = (o.match(/✗ Agent/g) || []).length;
        u > 0
          ? (a = `${c} agents \u2192 ${p}\u2713 ${u}\u2717`)
          : (a = `${c} agents \u2192 done`);
        break;
      }
      default:
        a = "done";
    }
    return `  ${i} ${ae.dim}${e} ${a}${ae.reset}`;
  }
  da.exports = {
    C: ae,
    formatToolCall: Gd,
    formatResult: Kd,
    getToolSpinnerText: Jd,
    formatToolSummary: Vd,
  };
});
var pe = _((_0, fa) => {
  var Et = {
    reset: "\x1B[0m",
    bold: "\x1B[1m",
    dim: "\x1B[2m",
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
    brightCyan: "\x1B[96m",
    brightMagenta: "\x1B[95m",
    brightBlue: "\x1B[94m",
  };
  function Yd(e, t) {
    return (
      [...e]
        .map((n) => (n === " " ? n : `\x1B[38;2;${t[0]};${t[1]};${t[2]}m${n}`))
        .join("") + Et.reset
    );
  }
  function Xd(e, t) {
    let n = (e.length - 1) * t,
      s = Math.min(Math.floor(n), e.length - 2),
      o = n - s;
    return [
      Math.round(e[s][0] + (e[s + 1][0] - e[s][0]) * o),
      Math.round(e[s][1] + (e[s + 1][1] - e[s][1]) * o),
      Math.round(e[s][2] + (e[s + 1][2] - e[s][2]) * o),
    ];
  }
  function Qd(e, t, n = {}) {
    let s = Et.bold,
      o = Et.dim,
      i = Et.reset,
      a = [
        "\u2588\u2588\u2588\u2557   \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557  \u2588\u2588\u2557  \u2501   \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557",
        "\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u255A\u2588\u2588\u2557\u2588\u2588\u2554\u255D  \u2501  \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D",
        "\u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557   \u255A\u2588\u2588\u2588\u2554\u255D   \u2501  \u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557",
        "\u2588\u2588\u2551\u255A\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D   \u2588\u2588\u2554\u2588\u2588\u2557   \u2501  \u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D",
        "\u2588\u2588\u2551 \u255A\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2554\u255D \u2588\u2588\u2557  \u2501  \u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557",
        "\u255A\u2550\u255D  \u255A\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D  \u2501   \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D",
      ],
      c = [
        [220, 240, 255],
        [80, 200, 255],
        [40, 100, 220],
      ],
      p = a.map((l, d) => {
        let m = d / (a.length - 1 || 1);
        return Yd(l, Xd(c, m));
      }).join(`
`),
      u = n.yolo ? `  ${s}${Et.yellow}\u26A1 YOLO${i}` : "";
    console.log(`
${p}
              ${o}Agentic Coding CLI  v${aa().version}${i}
              ${o}Model: ${e}${i}  ${o}\xB7  /help${i}${u}
`);
  }
  var {
      Spinner: Zd,
      MultiProgress: em,
      TaskProgress: tm,
      setActiveTaskProgress: nm,
      getActiveTaskProgress: sm,
      cleanupTerminal: om,
    } = ua(),
    {
      formatToolCall: im,
      formatResult: am,
      getToolSpinnerText: rm,
      formatToolSummary: cm,
    } = ma();
  fa.exports = {
    C: Et,
    banner: Qd,
    Spinner: Zd,
    MultiProgress: em,
    TaskProgress: tm,
    setActiveTaskProgress: nm,
    getActiveTaskProgress: sm,
    cleanupTerminal: om,
    formatToolCall: im,
    formatResult: am,
    getToolSpinnerText: rm,
    formatToolSummary: cm,
  };
});
var xa = _((S0, ga) => {
  var ha = require("stream").Stream,
    lm = require("util");
  ga.exports = qe;
  function qe() {
    ((this.source = null),
      (this.dataSize = 0),
      (this.maxDataSize = 1024 * 1024),
      (this.pauseStream = !0),
      (this._maxDataSizeExceeded = !1),
      (this._released = !1),
      (this._bufferedEvents = []));
  }
  lm.inherits(qe, ha);
  qe.create = function (e, t) {
    var n = new this();
    t = t || {};
    for (var s in t) n[s] = t[s];
    n.source = e;
    var o = e.emit;
    return (
      (e.emit = function () {
        return (n._handleEmit(arguments), o.apply(e, arguments));
      }),
      e.on("error", function () {}),
      n.pauseStream && e.pause(),
      n
    );
  };
  Object.defineProperty(qe.prototype, "readable", {
    configurable: !0,
    enumerable: !0,
    get: function () {
      return this.source.readable;
    },
  });
  qe.prototype.setEncoding = function () {
    return this.source.setEncoding.apply(this.source, arguments);
  };
  qe.prototype.resume = function () {
    (this._released || this.release(), this.source.resume());
  };
  qe.prototype.pause = function () {
    this.source.pause();
  };
  qe.prototype.release = function () {
    ((this._released = !0),
      this._bufferedEvents.forEach(
        function (e) {
          this.emit.apply(this, e);
        }.bind(this),
      ),
      (this._bufferedEvents = []));
  };
  qe.prototype.pipe = function () {
    var e = ha.prototype.pipe.apply(this, arguments);
    return (this.resume(), e);
  };
  qe.prototype._handleEmit = function (e) {
    if (this._released) {
      this.emit.apply(this, e);
      return;
    }
    (e[0] === "data" &&
      ((this.dataSize += e[1].length), this._checkIfMaxDataSizeExceeded()),
      this._bufferedEvents.push(e));
  };
  qe.prototype._checkIfMaxDataSizeExceeded = function () {
    if (!this._maxDataSizeExceeded && !(this.dataSize <= this.maxDataSize)) {
      this._maxDataSizeExceeded = !0;
      var e =
        "DelayedStream#maxDataSize of " + this.maxDataSize + " bytes exceeded.";
      this.emit("error", new Error(e));
    }
  };
});
var $a = _((E0, ya) => {
  var pm = require("util"),
    va = require("stream").Stream,
    ba = xa();
  ya.exports = X;
  function X() {
    ((this.writable = !1),
      (this.readable = !0),
      (this.dataSize = 0),
      (this.maxDataSize = 2 * 1024 * 1024),
      (this.pauseStreams = !0),
      (this._released = !1),
      (this._streams = []),
      (this._currentStream = null),
      (this._insideLoop = !1),
      (this._pendingNext = !1));
  }
  pm.inherits(X, va);
  X.create = function (e) {
    var t = new this();
    e = e || {};
    for (var n in e) t[n] = e[n];
    return t;
  };
  X.isStreamLike = function (e) {
    return (
      typeof e != "function" &&
      typeof e != "string" &&
      typeof e != "boolean" &&
      typeof e != "number" &&
      !Buffer.isBuffer(e)
    );
  };
  X.prototype.append = function (e) {
    var t = X.isStreamLike(e);
    if (t) {
      if (!(e instanceof ba)) {
        var n = ba.create(e, {
          maxDataSize: 1 / 0,
          pauseStream: this.pauseStreams,
        });
        (e.on("data", this._checkDataSize.bind(this)), (e = n));
      }
      (this._handleErrors(e), this.pauseStreams && e.pause());
    }
    return (this._streams.push(e), this);
  };
  X.prototype.pipe = function (e, t) {
    return (va.prototype.pipe.call(this, e, t), this.resume(), e);
  };
  X.prototype._getNext = function () {
    if (((this._currentStream = null), this._insideLoop)) {
      this._pendingNext = !0;
      return;
    }
    this._insideLoop = !0;
    try {
      do ((this._pendingNext = !1), this._realGetNext());
      while (this._pendingNext);
    } finally {
      this._insideLoop = !1;
    }
  };
  X.prototype._realGetNext = function () {
    var e = this._streams.shift();
    if (typeof e > "u") {
      this.end();
      return;
    }
    if (typeof e != "function") {
      this._pipeNext(e);
      return;
    }
    var t = e;
    t(
      function (n) {
        var s = X.isStreamLike(n);
        (s &&
          (n.on("data", this._checkDataSize.bind(this)), this._handleErrors(n)),
          this._pipeNext(n));
      }.bind(this),
    );
  };
  X.prototype._pipeNext = function (e) {
    this._currentStream = e;
    var t = X.isStreamLike(e);
    if (t) {
      (e.on("end", this._getNext.bind(this)), e.pipe(this, { end: !1 }));
      return;
    }
    var n = e;
    (this.write(n), this._getNext());
  };
  X.prototype._handleErrors = function (e) {
    var t = this;
    e.on("error", function (n) {
      t._emitError(n);
    });
  };
  X.prototype.write = function (e) {
    this.emit("data", e);
  };
  X.prototype.pause = function () {
    this.pauseStreams &&
      (this.pauseStreams &&
        this._currentStream &&
        typeof this._currentStream.pause == "function" &&
        this._currentStream.pause(),
      this.emit("pause"));
  };
  X.prototype.resume = function () {
    (this._released ||
      ((this._released = !0), (this.writable = !0), this._getNext()),
      this.pauseStreams &&
        this._currentStream &&
        typeof this._currentStream.resume == "function" &&
        this._currentStream.resume(),
      this.emit("resume"));
  };
  X.prototype.end = function () {
    (this._reset(), this.emit("end"));
  };
  X.prototype.destroy = function () {
    (this._reset(), this.emit("close"));
  };
  X.prototype._reset = function () {
    ((this.writable = !1), (this._streams = []), (this._currentStream = null));
  };
  X.prototype._checkDataSize = function () {
    if ((this._updateDataSize(), !(this.dataSize <= this.maxDataSize))) {
      var e =
        "DelayedStream#maxDataSize of " + this.maxDataSize + " bytes exceeded.";
      this._emitError(new Error(e));
    }
  };
  X.prototype._updateDataSize = function () {
    this.dataSize = 0;
    var e = this;
    (this._streams.forEach(function (t) {
      t.dataSize && (e.dataSize += t.dataSize);
    }),
      this._currentStream &&
        this._currentStream.dataSize &&
        (this.dataSize += this._currentStream.dataSize));
  };
  X.prototype._emitError = function (e) {
    (this._reset(), this.emit("error", e));
  };
});
var wa = _((T0, um) => {
  um.exports = {
    "application/1d-interleaved-parityfec": { source: "iana" },
    "application/3gpdash-qoe-report+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/3gpp-ims+xml": { source: "iana", compressible: !0 },
    "application/3gpphal+json": { source: "iana", compressible: !0 },
    "application/3gpphalforms+json": { source: "iana", compressible: !0 },
    "application/a2l": { source: "iana" },
    "application/ace+cbor": { source: "iana" },
    "application/activemessage": { source: "iana" },
    "application/activity+json": { source: "iana", compressible: !0 },
    "application/alto-costmap+json": { source: "iana", compressible: !0 },
    "application/alto-costmapfilter+json": { source: "iana", compressible: !0 },
    "application/alto-directory+json": { source: "iana", compressible: !0 },
    "application/alto-endpointcost+json": { source: "iana", compressible: !0 },
    "application/alto-endpointcostparams+json": {
      source: "iana",
      compressible: !0,
    },
    "application/alto-endpointprop+json": { source: "iana", compressible: !0 },
    "application/alto-endpointpropparams+json": {
      source: "iana",
      compressible: !0,
    },
    "application/alto-error+json": { source: "iana", compressible: !0 },
    "application/alto-networkmap+json": { source: "iana", compressible: !0 },
    "application/alto-networkmapfilter+json": {
      source: "iana",
      compressible: !0,
    },
    "application/alto-updatestreamcontrol+json": {
      source: "iana",
      compressible: !0,
    },
    "application/alto-updatestreamparams+json": {
      source: "iana",
      compressible: !0,
    },
    "application/aml": { source: "iana" },
    "application/andrew-inset": { source: "iana", extensions: ["ez"] },
    "application/applefile": { source: "iana" },
    "application/applixware": { source: "apache", extensions: ["aw"] },
    "application/at+jwt": { source: "iana" },
    "application/atf": { source: "iana" },
    "application/atfx": { source: "iana" },
    "application/atom+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["atom"],
    },
    "application/atomcat+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["atomcat"],
    },
    "application/atomdeleted+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["atomdeleted"],
    },
    "application/atomicmail": { source: "iana" },
    "application/atomsvc+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["atomsvc"],
    },
    "application/atsc-dwd+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["dwd"],
    },
    "application/atsc-dynamic-event-message": { source: "iana" },
    "application/atsc-held+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["held"],
    },
    "application/atsc-rdt+json": { source: "iana", compressible: !0 },
    "application/atsc-rsat+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["rsat"],
    },
    "application/atxml": { source: "iana" },
    "application/auth-policy+xml": { source: "iana", compressible: !0 },
    "application/bacnet-xdd+zip": { source: "iana", compressible: !1 },
    "application/batch-smtp": { source: "iana" },
    "application/bdoc": { compressible: !1, extensions: ["bdoc"] },
    "application/beep+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/calendar+json": { source: "iana", compressible: !0 },
    "application/calendar+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xcs"],
    },
    "application/call-completion": { source: "iana" },
    "application/cals-1840": { source: "iana" },
    "application/captive+json": { source: "iana", compressible: !0 },
    "application/cbor": { source: "iana" },
    "application/cbor-seq": { source: "iana" },
    "application/cccex": { source: "iana" },
    "application/ccmp+xml": { source: "iana", compressible: !0 },
    "application/ccxml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["ccxml"],
    },
    "application/cdfx+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["cdfx"],
    },
    "application/cdmi-capability": { source: "iana", extensions: ["cdmia"] },
    "application/cdmi-container": { source: "iana", extensions: ["cdmic"] },
    "application/cdmi-domain": { source: "iana", extensions: ["cdmid"] },
    "application/cdmi-object": { source: "iana", extensions: ["cdmio"] },
    "application/cdmi-queue": { source: "iana", extensions: ["cdmiq"] },
    "application/cdni": { source: "iana" },
    "application/cea": { source: "iana" },
    "application/cea-2018+xml": { source: "iana", compressible: !0 },
    "application/cellml+xml": { source: "iana", compressible: !0 },
    "application/cfw": { source: "iana" },
    "application/city+json": { source: "iana", compressible: !0 },
    "application/clr": { source: "iana" },
    "application/clue+xml": { source: "iana", compressible: !0 },
    "application/clue_info+xml": { source: "iana", compressible: !0 },
    "application/cms": { source: "iana" },
    "application/cnrp+xml": { source: "iana", compressible: !0 },
    "application/coap-group+json": { source: "iana", compressible: !0 },
    "application/coap-payload": { source: "iana" },
    "application/commonground": { source: "iana" },
    "application/conference-info+xml": { source: "iana", compressible: !0 },
    "application/cose": { source: "iana" },
    "application/cose-key": { source: "iana" },
    "application/cose-key-set": { source: "iana" },
    "application/cpl+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["cpl"],
    },
    "application/csrattrs": { source: "iana" },
    "application/csta+xml": { source: "iana", compressible: !0 },
    "application/cstadata+xml": { source: "iana", compressible: !0 },
    "application/csvm+json": { source: "iana", compressible: !0 },
    "application/cu-seeme": { source: "apache", extensions: ["cu"] },
    "application/cwt": { source: "iana" },
    "application/cybercash": { source: "iana" },
    "application/dart": { compressible: !0 },
    "application/dash+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["mpd"],
    },
    "application/dash-patch+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["mpp"],
    },
    "application/dashdelta": { source: "iana" },
    "application/davmount+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["davmount"],
    },
    "application/dca-rft": { source: "iana" },
    "application/dcd": { source: "iana" },
    "application/dec-dx": { source: "iana" },
    "application/dialog-info+xml": { source: "iana", compressible: !0 },
    "application/dicom": { source: "iana" },
    "application/dicom+json": { source: "iana", compressible: !0 },
    "application/dicom+xml": { source: "iana", compressible: !0 },
    "application/dii": { source: "iana" },
    "application/dit": { source: "iana" },
    "application/dns": { source: "iana" },
    "application/dns+json": { source: "iana", compressible: !0 },
    "application/dns-message": { source: "iana" },
    "application/docbook+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["dbk"],
    },
    "application/dots+cbor": { source: "iana" },
    "application/dskpp+xml": { source: "iana", compressible: !0 },
    "application/dssc+der": { source: "iana", extensions: ["dssc"] },
    "application/dssc+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xdssc"],
    },
    "application/dvcs": { source: "iana" },
    "application/ecmascript": {
      source: "iana",
      compressible: !0,
      extensions: ["es", "ecma"],
    },
    "application/edi-consent": { source: "iana" },
    "application/edi-x12": { source: "iana", compressible: !1 },
    "application/edifact": { source: "iana", compressible: !1 },
    "application/efi": { source: "iana" },
    "application/elm+json": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/elm+xml": { source: "iana", compressible: !0 },
    "application/emergencycalldata.cap+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/emergencycalldata.comment+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/emergencycalldata.control+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/emergencycalldata.deviceinfo+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/emergencycalldata.ecall.msd": { source: "iana" },
    "application/emergencycalldata.providerinfo+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/emergencycalldata.serviceinfo+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/emergencycalldata.subscriberinfo+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/emergencycalldata.veds+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/emma+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["emma"],
    },
    "application/emotionml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["emotionml"],
    },
    "application/encaprtp": { source: "iana" },
    "application/epp+xml": { source: "iana", compressible: !0 },
    "application/epub+zip": {
      source: "iana",
      compressible: !1,
      extensions: ["epub"],
    },
    "application/eshop": { source: "iana" },
    "application/exi": { source: "iana", extensions: ["exi"] },
    "application/expect-ct-report+json": { source: "iana", compressible: !0 },
    "application/express": { source: "iana", extensions: ["exp"] },
    "application/fastinfoset": { source: "iana" },
    "application/fastsoap": { source: "iana" },
    "application/fdt+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["fdt"],
    },
    "application/fhir+json": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/fhir+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/fido.trusted-apps+json": { compressible: !0 },
    "application/fits": { source: "iana" },
    "application/flexfec": { source: "iana" },
    "application/font-sfnt": { source: "iana" },
    "application/font-tdpfr": { source: "iana", extensions: ["pfr"] },
    "application/font-woff": { source: "iana", compressible: !1 },
    "application/framework-attributes+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/geo+json": {
      source: "iana",
      compressible: !0,
      extensions: ["geojson"],
    },
    "application/geo+json-seq": { source: "iana" },
    "application/geopackage+sqlite3": { source: "iana" },
    "application/geoxacml+xml": { source: "iana", compressible: !0 },
    "application/gltf-buffer": { source: "iana" },
    "application/gml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["gml"],
    },
    "application/gpx+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["gpx"],
    },
    "application/gxf": { source: "apache", extensions: ["gxf"] },
    "application/gzip": {
      source: "iana",
      compressible: !1,
      extensions: ["gz"],
    },
    "application/h224": { source: "iana" },
    "application/held+xml": { source: "iana", compressible: !0 },
    "application/hjson": { extensions: ["hjson"] },
    "application/http": { source: "iana" },
    "application/hyperstudio": { source: "iana", extensions: ["stk"] },
    "application/ibe-key-request+xml": { source: "iana", compressible: !0 },
    "application/ibe-pkg-reply+xml": { source: "iana", compressible: !0 },
    "application/ibe-pp-data": { source: "iana" },
    "application/iges": { source: "iana" },
    "application/im-iscomposing+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/index": { source: "iana" },
    "application/index.cmd": { source: "iana" },
    "application/index.obj": { source: "iana" },
    "application/index.response": { source: "iana" },
    "application/index.vnd": { source: "iana" },
    "application/inkml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["ink", "inkml"],
    },
    "application/iotp": { source: "iana" },
    "application/ipfix": { source: "iana", extensions: ["ipfix"] },
    "application/ipp": { source: "iana" },
    "application/isup": { source: "iana" },
    "application/its+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["its"],
    },
    "application/java-archive": {
      source: "apache",
      compressible: !1,
      extensions: ["jar", "war", "ear"],
    },
    "application/java-serialized-object": {
      source: "apache",
      compressible: !1,
      extensions: ["ser"],
    },
    "application/java-vm": {
      source: "apache",
      compressible: !1,
      extensions: ["class"],
    },
    "application/javascript": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
      extensions: ["js", "mjs"],
    },
    "application/jf2feed+json": { source: "iana", compressible: !0 },
    "application/jose": { source: "iana" },
    "application/jose+json": { source: "iana", compressible: !0 },
    "application/jrd+json": { source: "iana", compressible: !0 },
    "application/jscalendar+json": { source: "iana", compressible: !0 },
    "application/json": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
      extensions: ["json", "map"],
    },
    "application/json-patch+json": { source: "iana", compressible: !0 },
    "application/json-seq": { source: "iana" },
    "application/json5": { extensions: ["json5"] },
    "application/jsonml+json": {
      source: "apache",
      compressible: !0,
      extensions: ["jsonml"],
    },
    "application/jwk+json": { source: "iana", compressible: !0 },
    "application/jwk-set+json": { source: "iana", compressible: !0 },
    "application/jwt": { source: "iana" },
    "application/kpml-request+xml": { source: "iana", compressible: !0 },
    "application/kpml-response+xml": { source: "iana", compressible: !0 },
    "application/ld+json": {
      source: "iana",
      compressible: !0,
      extensions: ["jsonld"],
    },
    "application/lgr+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["lgr"],
    },
    "application/link-format": { source: "iana" },
    "application/load-control+xml": { source: "iana", compressible: !0 },
    "application/lost+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["lostxml"],
    },
    "application/lostsync+xml": { source: "iana", compressible: !0 },
    "application/lpf+zip": { source: "iana", compressible: !1 },
    "application/lxf": { source: "iana" },
    "application/mac-binhex40": { source: "iana", extensions: ["hqx"] },
    "application/mac-compactpro": { source: "apache", extensions: ["cpt"] },
    "application/macwriteii": { source: "iana" },
    "application/mads+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["mads"],
    },
    "application/manifest+json": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
      extensions: ["webmanifest"],
    },
    "application/marc": { source: "iana", extensions: ["mrc"] },
    "application/marcxml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["mrcx"],
    },
    "application/mathematica": {
      source: "iana",
      extensions: ["ma", "nb", "mb"],
    },
    "application/mathml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["mathml"],
    },
    "application/mathml-content+xml": { source: "iana", compressible: !0 },
    "application/mathml-presentation+xml": { source: "iana", compressible: !0 },
    "application/mbms-associated-procedure-description+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/mbms-deregister+xml": { source: "iana", compressible: !0 },
    "application/mbms-envelope+xml": { source: "iana", compressible: !0 },
    "application/mbms-msk+xml": { source: "iana", compressible: !0 },
    "application/mbms-msk-response+xml": { source: "iana", compressible: !0 },
    "application/mbms-protection-description+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/mbms-reception-report+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/mbms-register+xml": { source: "iana", compressible: !0 },
    "application/mbms-register-response+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/mbms-schedule+xml": { source: "iana", compressible: !0 },
    "application/mbms-user-service-description+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/mbox": { source: "iana", extensions: ["mbox"] },
    "application/media-policy-dataset+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["mpf"],
    },
    "application/media_control+xml": { source: "iana", compressible: !0 },
    "application/mediaservercontrol+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["mscml"],
    },
    "application/merge-patch+json": { source: "iana", compressible: !0 },
    "application/metalink+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["metalink"],
    },
    "application/metalink4+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["meta4"],
    },
    "application/mets+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["mets"],
    },
    "application/mf4": { source: "iana" },
    "application/mikey": { source: "iana" },
    "application/mipc": { source: "iana" },
    "application/missing-blocks+cbor-seq": { source: "iana" },
    "application/mmt-aei+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["maei"],
    },
    "application/mmt-usd+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["musd"],
    },
    "application/mods+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["mods"],
    },
    "application/moss-keys": { source: "iana" },
    "application/moss-signature": { source: "iana" },
    "application/mosskey-data": { source: "iana" },
    "application/mosskey-request": { source: "iana" },
    "application/mp21": { source: "iana", extensions: ["m21", "mp21"] },
    "application/mp4": { source: "iana", extensions: ["mp4s", "m4p"] },
    "application/mpeg4-generic": { source: "iana" },
    "application/mpeg4-iod": { source: "iana" },
    "application/mpeg4-iod-xmt": { source: "iana" },
    "application/mrb-consumer+xml": { source: "iana", compressible: !0 },
    "application/mrb-publish+xml": { source: "iana", compressible: !0 },
    "application/msc-ivr+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/msc-mixer+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/msword": {
      source: "iana",
      compressible: !1,
      extensions: ["doc", "dot"],
    },
    "application/mud+json": { source: "iana", compressible: !0 },
    "application/multipart-core": { source: "iana" },
    "application/mxf": { source: "iana", extensions: ["mxf"] },
    "application/n-quads": { source: "iana", extensions: ["nq"] },
    "application/n-triples": { source: "iana", extensions: ["nt"] },
    "application/nasdata": { source: "iana" },
    "application/news-checkgroups": { source: "iana", charset: "US-ASCII" },
    "application/news-groupinfo": { source: "iana", charset: "US-ASCII" },
    "application/news-transmission": { source: "iana" },
    "application/nlsml+xml": { source: "iana", compressible: !0 },
    "application/node": { source: "iana", extensions: ["cjs"] },
    "application/nss": { source: "iana" },
    "application/oauth-authz-req+jwt": { source: "iana" },
    "application/oblivious-dns-message": { source: "iana" },
    "application/ocsp-request": { source: "iana" },
    "application/ocsp-response": { source: "iana" },
    "application/octet-stream": {
      source: "iana",
      compressible: !1,
      extensions: [
        "bin",
        "dms",
        "lrf",
        "mar",
        "so",
        "dist",
        "distz",
        "pkg",
        "bpk",
        "dump",
        "elc",
        "deploy",
        "exe",
        "dll",
        "deb",
        "dmg",
        "iso",
        "img",
        "msi",
        "msp",
        "msm",
        "buffer",
      ],
    },
    "application/oda": { source: "iana", extensions: ["oda"] },
    "application/odm+xml": { source: "iana", compressible: !0 },
    "application/odx": { source: "iana" },
    "application/oebps-package+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["opf"],
    },
    "application/ogg": {
      source: "iana",
      compressible: !1,
      extensions: ["ogx"],
    },
    "application/omdoc+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["omdoc"],
    },
    "application/onenote": {
      source: "apache",
      extensions: ["onetoc", "onetoc2", "onetmp", "onepkg"],
    },
    "application/opc-nodeset+xml": { source: "iana", compressible: !0 },
    "application/oscore": { source: "iana" },
    "application/oxps": { source: "iana", extensions: ["oxps"] },
    "application/p21": { source: "iana" },
    "application/p21+zip": { source: "iana", compressible: !1 },
    "application/p2p-overlay+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["relo"],
    },
    "application/parityfec": { source: "iana" },
    "application/passport": { source: "iana" },
    "application/patch-ops-error+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xer"],
    },
    "application/pdf": {
      source: "iana",
      compressible: !1,
      extensions: ["pdf"],
    },
    "application/pdx": { source: "iana" },
    "application/pem-certificate-chain": { source: "iana" },
    "application/pgp-encrypted": {
      source: "iana",
      compressible: !1,
      extensions: ["pgp"],
    },
    "application/pgp-keys": { source: "iana", extensions: ["asc"] },
    "application/pgp-signature": { source: "iana", extensions: ["asc", "sig"] },
    "application/pics-rules": { source: "apache", extensions: ["prf"] },
    "application/pidf+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/pidf-diff+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/pkcs10": { source: "iana", extensions: ["p10"] },
    "application/pkcs12": { source: "iana" },
    "application/pkcs7-mime": { source: "iana", extensions: ["p7m", "p7c"] },
    "application/pkcs7-signature": { source: "iana", extensions: ["p7s"] },
    "application/pkcs8": { source: "iana", extensions: ["p8"] },
    "application/pkcs8-encrypted": { source: "iana" },
    "application/pkix-attr-cert": { source: "iana", extensions: ["ac"] },
    "application/pkix-cert": { source: "iana", extensions: ["cer"] },
    "application/pkix-crl": { source: "iana", extensions: ["crl"] },
    "application/pkix-pkipath": { source: "iana", extensions: ["pkipath"] },
    "application/pkixcmp": { source: "iana", extensions: ["pki"] },
    "application/pls+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["pls"],
    },
    "application/poc-settings+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/postscript": {
      source: "iana",
      compressible: !0,
      extensions: ["ai", "eps", "ps"],
    },
    "application/ppsp-tracker+json": { source: "iana", compressible: !0 },
    "application/problem+json": { source: "iana", compressible: !0 },
    "application/problem+xml": { source: "iana", compressible: !0 },
    "application/provenance+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["provx"],
    },
    "application/prs.alvestrand.titrax-sheet": { source: "iana" },
    "application/prs.cww": { source: "iana", extensions: ["cww"] },
    "application/prs.cyn": { source: "iana", charset: "7-BIT" },
    "application/prs.hpub+zip": { source: "iana", compressible: !1 },
    "application/prs.nprend": { source: "iana" },
    "application/prs.plucker": { source: "iana" },
    "application/prs.rdf-xml-crypt": { source: "iana" },
    "application/prs.xsf+xml": { source: "iana", compressible: !0 },
    "application/pskc+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["pskcxml"],
    },
    "application/pvd+json": { source: "iana", compressible: !0 },
    "application/qsig": { source: "iana" },
    "application/raml+yaml": { compressible: !0, extensions: ["raml"] },
    "application/raptorfec": { source: "iana" },
    "application/rdap+json": { source: "iana", compressible: !0 },
    "application/rdf+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["rdf", "owl"],
    },
    "application/reginfo+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["rif"],
    },
    "application/relax-ng-compact-syntax": {
      source: "iana",
      extensions: ["rnc"],
    },
    "application/remote-printing": { source: "iana" },
    "application/reputon+json": { source: "iana", compressible: !0 },
    "application/resource-lists+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["rl"],
    },
    "application/resource-lists-diff+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["rld"],
    },
    "application/rfc+xml": { source: "iana", compressible: !0 },
    "application/riscos": { source: "iana" },
    "application/rlmi+xml": { source: "iana", compressible: !0 },
    "application/rls-services+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["rs"],
    },
    "application/route-apd+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["rapd"],
    },
    "application/route-s-tsid+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["sls"],
    },
    "application/route-usd+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["rusd"],
    },
    "application/rpki-ghostbusters": { source: "iana", extensions: ["gbr"] },
    "application/rpki-manifest": { source: "iana", extensions: ["mft"] },
    "application/rpki-publication": { source: "iana" },
    "application/rpki-roa": { source: "iana", extensions: ["roa"] },
    "application/rpki-updown": { source: "iana" },
    "application/rsd+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["rsd"],
    },
    "application/rss+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["rss"],
    },
    "application/rtf": {
      source: "iana",
      compressible: !0,
      extensions: ["rtf"],
    },
    "application/rtploopback": { source: "iana" },
    "application/rtx": { source: "iana" },
    "application/samlassertion+xml": { source: "iana", compressible: !0 },
    "application/samlmetadata+xml": { source: "iana", compressible: !0 },
    "application/sarif+json": { source: "iana", compressible: !0 },
    "application/sarif-external-properties+json": {
      source: "iana",
      compressible: !0,
    },
    "application/sbe": { source: "iana" },
    "application/sbml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["sbml"],
    },
    "application/scaip+xml": { source: "iana", compressible: !0 },
    "application/scim+json": { source: "iana", compressible: !0 },
    "application/scvp-cv-request": { source: "iana", extensions: ["scq"] },
    "application/scvp-cv-response": { source: "iana", extensions: ["scs"] },
    "application/scvp-vp-request": { source: "iana", extensions: ["spq"] },
    "application/scvp-vp-response": { source: "iana", extensions: ["spp"] },
    "application/sdp": { source: "iana", extensions: ["sdp"] },
    "application/secevent+jwt": { source: "iana" },
    "application/senml+cbor": { source: "iana" },
    "application/senml+json": { source: "iana", compressible: !0 },
    "application/senml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["senmlx"],
    },
    "application/senml-etch+cbor": { source: "iana" },
    "application/senml-etch+json": { source: "iana", compressible: !0 },
    "application/senml-exi": { source: "iana" },
    "application/sensml+cbor": { source: "iana" },
    "application/sensml+json": { source: "iana", compressible: !0 },
    "application/sensml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["sensmlx"],
    },
    "application/sensml-exi": { source: "iana" },
    "application/sep+xml": { source: "iana", compressible: !0 },
    "application/sep-exi": { source: "iana" },
    "application/session-info": { source: "iana" },
    "application/set-payment": { source: "iana" },
    "application/set-payment-initiation": {
      source: "iana",
      extensions: ["setpay"],
    },
    "application/set-registration": { source: "iana" },
    "application/set-registration-initiation": {
      source: "iana",
      extensions: ["setreg"],
    },
    "application/sgml": { source: "iana" },
    "application/sgml-open-catalog": { source: "iana" },
    "application/shf+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["shf"],
    },
    "application/sieve": { source: "iana", extensions: ["siv", "sieve"] },
    "application/simple-filter+xml": { source: "iana", compressible: !0 },
    "application/simple-message-summary": { source: "iana" },
    "application/simplesymbolcontainer": { source: "iana" },
    "application/sipc": { source: "iana" },
    "application/slate": { source: "iana" },
    "application/smil": { source: "iana" },
    "application/smil+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["smi", "smil"],
    },
    "application/smpte336m": { source: "iana" },
    "application/soap+fastinfoset": { source: "iana" },
    "application/soap+xml": { source: "iana", compressible: !0 },
    "application/sparql-query": { source: "iana", extensions: ["rq"] },
    "application/sparql-results+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["srx"],
    },
    "application/spdx+json": { source: "iana", compressible: !0 },
    "application/spirits-event+xml": { source: "iana", compressible: !0 },
    "application/sql": { source: "iana" },
    "application/srgs": { source: "iana", extensions: ["gram"] },
    "application/srgs+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["grxml"],
    },
    "application/sru+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["sru"],
    },
    "application/ssdl+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["ssdl"],
    },
    "application/ssml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["ssml"],
    },
    "application/stix+json": { source: "iana", compressible: !0 },
    "application/swid+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["swidtag"],
    },
    "application/tamp-apex-update": { source: "iana" },
    "application/tamp-apex-update-confirm": { source: "iana" },
    "application/tamp-community-update": { source: "iana" },
    "application/tamp-community-update-confirm": { source: "iana" },
    "application/tamp-error": { source: "iana" },
    "application/tamp-sequence-adjust": { source: "iana" },
    "application/tamp-sequence-adjust-confirm": { source: "iana" },
    "application/tamp-status-query": { source: "iana" },
    "application/tamp-status-response": { source: "iana" },
    "application/tamp-update": { source: "iana" },
    "application/tamp-update-confirm": { source: "iana" },
    "application/tar": { compressible: !0 },
    "application/taxii+json": { source: "iana", compressible: !0 },
    "application/td+json": { source: "iana", compressible: !0 },
    "application/tei+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["tei", "teicorpus"],
    },
    "application/tetra_isi": { source: "iana" },
    "application/thraud+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["tfi"],
    },
    "application/timestamp-query": { source: "iana" },
    "application/timestamp-reply": { source: "iana" },
    "application/timestamped-data": { source: "iana", extensions: ["tsd"] },
    "application/tlsrpt+gzip": { source: "iana" },
    "application/tlsrpt+json": { source: "iana", compressible: !0 },
    "application/tnauthlist": { source: "iana" },
    "application/token-introspection+jwt": { source: "iana" },
    "application/toml": { compressible: !0, extensions: ["toml"] },
    "application/trickle-ice-sdpfrag": { source: "iana" },
    "application/trig": { source: "iana", extensions: ["trig"] },
    "application/ttml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["ttml"],
    },
    "application/tve-trigger": { source: "iana" },
    "application/tzif": { source: "iana" },
    "application/tzif-leap": { source: "iana" },
    "application/ubjson": { compressible: !1, extensions: ["ubj"] },
    "application/ulpfec": { source: "iana" },
    "application/urc-grpsheet+xml": { source: "iana", compressible: !0 },
    "application/urc-ressheet+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["rsheet"],
    },
    "application/urc-targetdesc+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["td"],
    },
    "application/urc-uisocketdesc+xml": { source: "iana", compressible: !0 },
    "application/vcard+json": { source: "iana", compressible: !0 },
    "application/vcard+xml": { source: "iana", compressible: !0 },
    "application/vemmi": { source: "iana" },
    "application/vividence.scriptfile": { source: "apache" },
    "application/vnd.1000minds.decision-model+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["1km"],
    },
    "application/vnd.3gpp-prose+xml": { source: "iana", compressible: !0 },
    "application/vnd.3gpp-prose-pc3ch+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp-v2x-local-service-information": { source: "iana" },
    "application/vnd.3gpp.5gnas": { source: "iana" },
    "application/vnd.3gpp.access-transfer-events+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.bsf+xml": { source: "iana", compressible: !0 },
    "application/vnd.3gpp.gmop+xml": { source: "iana", compressible: !0 },
    "application/vnd.3gpp.gtpc": { source: "iana" },
    "application/vnd.3gpp.interworking-data": { source: "iana" },
    "application/vnd.3gpp.lpp": { source: "iana" },
    "application/vnd.3gpp.mc-signalling-ear": { source: "iana" },
    "application/vnd.3gpp.mcdata-affiliation-command+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcdata-info+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcdata-payload": { source: "iana" },
    "application/vnd.3gpp.mcdata-service-config+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcdata-signalling": { source: "iana" },
    "application/vnd.3gpp.mcdata-ue-config+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcdata-user-profile+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcptt-affiliation-command+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcptt-floor-request+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcptt-info+xml": { source: "iana", compressible: !0 },
    "application/vnd.3gpp.mcptt-location-info+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcptt-mbms-usage-info+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcptt-service-config+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcptt-signed+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcptt-ue-config+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcptt-ue-init-config+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcptt-user-profile+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcvideo-affiliation-command+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcvideo-affiliation-info+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcvideo-info+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcvideo-location-info+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcvideo-mbms-usage-info+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcvideo-service-config+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcvideo-transmission-request+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcvideo-ue-config+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mcvideo-user-profile+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.mid-call+xml": { source: "iana", compressible: !0 },
    "application/vnd.3gpp.ngap": { source: "iana" },
    "application/vnd.3gpp.pfcp": { source: "iana" },
    "application/vnd.3gpp.pic-bw-large": {
      source: "iana",
      extensions: ["plb"],
    },
    "application/vnd.3gpp.pic-bw-small": {
      source: "iana",
      extensions: ["psb"],
    },
    "application/vnd.3gpp.pic-bw-var": { source: "iana", extensions: ["pvb"] },
    "application/vnd.3gpp.s1ap": { source: "iana" },
    "application/vnd.3gpp.sms": { source: "iana" },
    "application/vnd.3gpp.sms+xml": { source: "iana", compressible: !0 },
    "application/vnd.3gpp.srvcc-ext+xml": { source: "iana", compressible: !0 },
    "application/vnd.3gpp.srvcc-info+xml": { source: "iana", compressible: !0 },
    "application/vnd.3gpp.state-and-event-info+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.3gpp.ussd+xml": { source: "iana", compressible: !0 },
    "application/vnd.3gpp2.bcmcsinfo+xml": { source: "iana", compressible: !0 },
    "application/vnd.3gpp2.sms": { source: "iana" },
    "application/vnd.3gpp2.tcap": { source: "iana", extensions: ["tcap"] },
    "application/vnd.3lightssoftware.imagescal": { source: "iana" },
    "application/vnd.3m.post-it-notes": { source: "iana", extensions: ["pwn"] },
    "application/vnd.accpac.simply.aso": {
      source: "iana",
      extensions: ["aso"],
    },
    "application/vnd.accpac.simply.imp": {
      source: "iana",
      extensions: ["imp"],
    },
    "application/vnd.acucobol": { source: "iana", extensions: ["acu"] },
    "application/vnd.acucorp": { source: "iana", extensions: ["atc", "acutc"] },
    "application/vnd.adobe.air-application-installer-package+zip": {
      source: "apache",
      compressible: !1,
      extensions: ["air"],
    },
    "application/vnd.adobe.flash.movie": { source: "iana" },
    "application/vnd.adobe.formscentral.fcdt": {
      source: "iana",
      extensions: ["fcdt"],
    },
    "application/vnd.adobe.fxp": {
      source: "iana",
      extensions: ["fxp", "fxpl"],
    },
    "application/vnd.adobe.partial-upload": { source: "iana" },
    "application/vnd.adobe.xdp+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xdp"],
    },
    "application/vnd.adobe.xfdf": { source: "iana", extensions: ["xfdf"] },
    "application/vnd.aether.imp": { source: "iana" },
    "application/vnd.afpc.afplinedata": { source: "iana" },
    "application/vnd.afpc.afplinedata-pagedef": { source: "iana" },
    "application/vnd.afpc.cmoca-cmresource": { source: "iana" },
    "application/vnd.afpc.foca-charset": { source: "iana" },
    "application/vnd.afpc.foca-codedfont": { source: "iana" },
    "application/vnd.afpc.foca-codepage": { source: "iana" },
    "application/vnd.afpc.modca": { source: "iana" },
    "application/vnd.afpc.modca-cmtable": { source: "iana" },
    "application/vnd.afpc.modca-formdef": { source: "iana" },
    "application/vnd.afpc.modca-mediummap": { source: "iana" },
    "application/vnd.afpc.modca-objectcontainer": { source: "iana" },
    "application/vnd.afpc.modca-overlay": { source: "iana" },
    "application/vnd.afpc.modca-pagesegment": { source: "iana" },
    "application/vnd.age": { source: "iana", extensions: ["age"] },
    "application/vnd.ah-barcode": { source: "iana" },
    "application/vnd.ahead.space": { source: "iana", extensions: ["ahead"] },
    "application/vnd.airzip.filesecure.azf": {
      source: "iana",
      extensions: ["azf"],
    },
    "application/vnd.airzip.filesecure.azs": {
      source: "iana",
      extensions: ["azs"],
    },
    "application/vnd.amadeus+json": { source: "iana", compressible: !0 },
    "application/vnd.amazon.ebook": { source: "apache", extensions: ["azw"] },
    "application/vnd.amazon.mobi8-ebook": { source: "iana" },
    "application/vnd.americandynamics.acc": {
      source: "iana",
      extensions: ["acc"],
    },
    "application/vnd.amiga.ami": { source: "iana", extensions: ["ami"] },
    "application/vnd.amundsen.maze+xml": { source: "iana", compressible: !0 },
    "application/vnd.android.ota": { source: "iana" },
    "application/vnd.android.package-archive": {
      source: "apache",
      compressible: !1,
      extensions: ["apk"],
    },
    "application/vnd.anki": { source: "iana" },
    "application/vnd.anser-web-certificate-issue-initiation": {
      source: "iana",
      extensions: ["cii"],
    },
    "application/vnd.anser-web-funds-transfer-initiation": {
      source: "apache",
      extensions: ["fti"],
    },
    "application/vnd.antix.game-component": {
      source: "iana",
      extensions: ["atx"],
    },
    "application/vnd.apache.arrow.file": { source: "iana" },
    "application/vnd.apache.arrow.stream": { source: "iana" },
    "application/vnd.apache.thrift.binary": { source: "iana" },
    "application/vnd.apache.thrift.compact": { source: "iana" },
    "application/vnd.apache.thrift.json": { source: "iana" },
    "application/vnd.api+json": { source: "iana", compressible: !0 },
    "application/vnd.aplextor.warrp+json": { source: "iana", compressible: !0 },
    "application/vnd.apothekende.reservation+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.apple.installer+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["mpkg"],
    },
    "application/vnd.apple.keynote": { source: "iana", extensions: ["key"] },
    "application/vnd.apple.mpegurl": { source: "iana", extensions: ["m3u8"] },
    "application/vnd.apple.numbers": {
      source: "iana",
      extensions: ["numbers"],
    },
    "application/vnd.apple.pages": { source: "iana", extensions: ["pages"] },
    "application/vnd.apple.pkpass": {
      compressible: !1,
      extensions: ["pkpass"],
    },
    "application/vnd.arastra.swi": { source: "iana" },
    "application/vnd.aristanetworks.swi": {
      source: "iana",
      extensions: ["swi"],
    },
    "application/vnd.artisan+json": { source: "iana", compressible: !0 },
    "application/vnd.artsquare": { source: "iana" },
    "application/vnd.astraea-software.iota": {
      source: "iana",
      extensions: ["iota"],
    },
    "application/vnd.audiograph": { source: "iana", extensions: ["aep"] },
    "application/vnd.autopackage": { source: "iana" },
    "application/vnd.avalon+json": { source: "iana", compressible: !0 },
    "application/vnd.avistar+xml": { source: "iana", compressible: !0 },
    "application/vnd.balsamiq.bmml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["bmml"],
    },
    "application/vnd.balsamiq.bmpr": { source: "iana" },
    "application/vnd.banana-accounting": { source: "iana" },
    "application/vnd.bbf.usp.error": { source: "iana" },
    "application/vnd.bbf.usp.msg": { source: "iana" },
    "application/vnd.bbf.usp.msg+json": { source: "iana", compressible: !0 },
    "application/vnd.bekitzur-stech+json": { source: "iana", compressible: !0 },
    "application/vnd.bint.med-content": { source: "iana" },
    "application/vnd.biopax.rdf+xml": { source: "iana", compressible: !0 },
    "application/vnd.blink-idb-value-wrapper": { source: "iana" },
    "application/vnd.blueice.multipass": {
      source: "iana",
      extensions: ["mpm"],
    },
    "application/vnd.bluetooth.ep.oob": { source: "iana" },
    "application/vnd.bluetooth.le.oob": { source: "iana" },
    "application/vnd.bmi": { source: "iana", extensions: ["bmi"] },
    "application/vnd.bpf": { source: "iana" },
    "application/vnd.bpf3": { source: "iana" },
    "application/vnd.businessobjects": { source: "iana", extensions: ["rep"] },
    "application/vnd.byu.uapi+json": { source: "iana", compressible: !0 },
    "application/vnd.cab-jscript": { source: "iana" },
    "application/vnd.canon-cpdl": { source: "iana" },
    "application/vnd.canon-lips": { source: "iana" },
    "application/vnd.capasystems-pg+json": { source: "iana", compressible: !0 },
    "application/vnd.cendio.thinlinc.clientconf": { source: "iana" },
    "application/vnd.century-systems.tcp_stream": { source: "iana" },
    "application/vnd.chemdraw+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["cdxml"],
    },
    "application/vnd.chess-pgn": { source: "iana" },
    "application/vnd.chipnuts.karaoke-mmd": {
      source: "iana",
      extensions: ["mmd"],
    },
    "application/vnd.ciedi": { source: "iana" },
    "application/vnd.cinderella": { source: "iana", extensions: ["cdy"] },
    "application/vnd.cirpack.isdn-ext": { source: "iana" },
    "application/vnd.citationstyles.style+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["csl"],
    },
    "application/vnd.claymore": { source: "iana", extensions: ["cla"] },
    "application/vnd.cloanto.rp9": { source: "iana", extensions: ["rp9"] },
    "application/vnd.clonk.c4group": {
      source: "iana",
      extensions: ["c4g", "c4d", "c4f", "c4p", "c4u"],
    },
    "application/vnd.cluetrust.cartomobile-config": {
      source: "iana",
      extensions: ["c11amc"],
    },
    "application/vnd.cluetrust.cartomobile-config-pkg": {
      source: "iana",
      extensions: ["c11amz"],
    },
    "application/vnd.coffeescript": { source: "iana" },
    "application/vnd.collabio.xodocuments.document": { source: "iana" },
    "application/vnd.collabio.xodocuments.document-template": {
      source: "iana",
    },
    "application/vnd.collabio.xodocuments.presentation": { source: "iana" },
    "application/vnd.collabio.xodocuments.presentation-template": {
      source: "iana",
    },
    "application/vnd.collabio.xodocuments.spreadsheet": { source: "iana" },
    "application/vnd.collabio.xodocuments.spreadsheet-template": {
      source: "iana",
    },
    "application/vnd.collection+json": { source: "iana", compressible: !0 },
    "application/vnd.collection.doc+json": { source: "iana", compressible: !0 },
    "application/vnd.collection.next+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.comicbook+zip": { source: "iana", compressible: !1 },
    "application/vnd.comicbook-rar": { source: "iana" },
    "application/vnd.commerce-battelle": { source: "iana" },
    "application/vnd.commonspace": { source: "iana", extensions: ["csp"] },
    "application/vnd.contact.cmsg": { source: "iana", extensions: ["cdbcmsg"] },
    "application/vnd.coreos.ignition+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.cosmocaller": { source: "iana", extensions: ["cmc"] },
    "application/vnd.crick.clicker": { source: "iana", extensions: ["clkx"] },
    "application/vnd.crick.clicker.keyboard": {
      source: "iana",
      extensions: ["clkk"],
    },
    "application/vnd.crick.clicker.palette": {
      source: "iana",
      extensions: ["clkp"],
    },
    "application/vnd.crick.clicker.template": {
      source: "iana",
      extensions: ["clkt"],
    },
    "application/vnd.crick.clicker.wordbank": {
      source: "iana",
      extensions: ["clkw"],
    },
    "application/vnd.criticaltools.wbs+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["wbs"],
    },
    "application/vnd.cryptii.pipe+json": { source: "iana", compressible: !0 },
    "application/vnd.crypto-shade-file": { source: "iana" },
    "application/vnd.cryptomator.encrypted": { source: "iana" },
    "application/vnd.cryptomator.vault": { source: "iana" },
    "application/vnd.ctc-posml": { source: "iana", extensions: ["pml"] },
    "application/vnd.ctct.ws+xml": { source: "iana", compressible: !0 },
    "application/vnd.cups-pdf": { source: "iana" },
    "application/vnd.cups-postscript": { source: "iana" },
    "application/vnd.cups-ppd": { source: "iana", extensions: ["ppd"] },
    "application/vnd.cups-raster": { source: "iana" },
    "application/vnd.cups-raw": { source: "iana" },
    "application/vnd.curl": { source: "iana" },
    "application/vnd.curl.car": { source: "apache", extensions: ["car"] },
    "application/vnd.curl.pcurl": { source: "apache", extensions: ["pcurl"] },
    "application/vnd.cyan.dean.root+xml": { source: "iana", compressible: !0 },
    "application/vnd.cybank": { source: "iana" },
    "application/vnd.cyclonedx+json": { source: "iana", compressible: !0 },
    "application/vnd.cyclonedx+xml": { source: "iana", compressible: !0 },
    "application/vnd.d2l.coursepackage1p0+zip": {
      source: "iana",
      compressible: !1,
    },
    "application/vnd.d3m-dataset": { source: "iana" },
    "application/vnd.d3m-problem": { source: "iana" },
    "application/vnd.dart": {
      source: "iana",
      compressible: !0,
      extensions: ["dart"],
    },
    "application/vnd.data-vision.rdz": { source: "iana", extensions: ["rdz"] },
    "application/vnd.datapackage+json": { source: "iana", compressible: !0 },
    "application/vnd.dataresource+json": { source: "iana", compressible: !0 },
    "application/vnd.dbf": { source: "iana", extensions: ["dbf"] },
    "application/vnd.debian.binary-package": { source: "iana" },
    "application/vnd.dece.data": {
      source: "iana",
      extensions: ["uvf", "uvvf", "uvd", "uvvd"],
    },
    "application/vnd.dece.ttml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["uvt", "uvvt"],
    },
    "application/vnd.dece.unspecified": {
      source: "iana",
      extensions: ["uvx", "uvvx"],
    },
    "application/vnd.dece.zip": { source: "iana", extensions: ["uvz", "uvvz"] },
    "application/vnd.denovo.fcselayout-link": {
      source: "iana",
      extensions: ["fe_launch"],
    },
    "application/vnd.desmume.movie": { source: "iana" },
    "application/vnd.dir-bi.plate-dl-nosuffix": { source: "iana" },
    "application/vnd.dm.delegation+xml": { source: "iana", compressible: !0 },
    "application/vnd.dna": { source: "iana", extensions: ["dna"] },
    "application/vnd.document+json": { source: "iana", compressible: !0 },
    "application/vnd.dolby.mlp": { source: "apache", extensions: ["mlp"] },
    "application/vnd.dolby.mobile.1": { source: "iana" },
    "application/vnd.dolby.mobile.2": { source: "iana" },
    "application/vnd.doremir.scorecloud-binary-document": { source: "iana" },
    "application/vnd.dpgraph": { source: "iana", extensions: ["dpg"] },
    "application/vnd.dreamfactory": { source: "iana", extensions: ["dfac"] },
    "application/vnd.drive+json": { source: "iana", compressible: !0 },
    "application/vnd.ds-keypoint": { source: "apache", extensions: ["kpxx"] },
    "application/vnd.dtg.local": { source: "iana" },
    "application/vnd.dtg.local.flash": { source: "iana" },
    "application/vnd.dtg.local.html": { source: "iana" },
    "application/vnd.dvb.ait": { source: "iana", extensions: ["ait"] },
    "application/vnd.dvb.dvbisl+xml": { source: "iana", compressible: !0 },
    "application/vnd.dvb.dvbj": { source: "iana" },
    "application/vnd.dvb.esgcontainer": { source: "iana" },
    "application/vnd.dvb.ipdcdftnotifaccess": { source: "iana" },
    "application/vnd.dvb.ipdcesgaccess": { source: "iana" },
    "application/vnd.dvb.ipdcesgaccess2": { source: "iana" },
    "application/vnd.dvb.ipdcesgpdd": { source: "iana" },
    "application/vnd.dvb.ipdcroaming": { source: "iana" },
    "application/vnd.dvb.iptv.alfec-base": { source: "iana" },
    "application/vnd.dvb.iptv.alfec-enhancement": { source: "iana" },
    "application/vnd.dvb.notif-aggregate-root+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.dvb.notif-container+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.dvb.notif-generic+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.dvb.notif-ia-msglist+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.dvb.notif-ia-registration-request+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.dvb.notif-ia-registration-response+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.dvb.notif-init+xml": { source: "iana", compressible: !0 },
    "application/vnd.dvb.pfr": { source: "iana" },
    "application/vnd.dvb.service": { source: "iana", extensions: ["svc"] },
    "application/vnd.dxr": { source: "iana" },
    "application/vnd.dynageo": { source: "iana", extensions: ["geo"] },
    "application/vnd.dzr": { source: "iana" },
    "application/vnd.easykaraoke.cdgdownload": { source: "iana" },
    "application/vnd.ecdis-update": { source: "iana" },
    "application/vnd.ecip.rlp": { source: "iana" },
    "application/vnd.eclipse.ditto+json": { source: "iana", compressible: !0 },
    "application/vnd.ecowin.chart": { source: "iana", extensions: ["mag"] },
    "application/vnd.ecowin.filerequest": { source: "iana" },
    "application/vnd.ecowin.fileupdate": { source: "iana" },
    "application/vnd.ecowin.series": { source: "iana" },
    "application/vnd.ecowin.seriesrequest": { source: "iana" },
    "application/vnd.ecowin.seriesupdate": { source: "iana" },
    "application/vnd.efi.img": { source: "iana" },
    "application/vnd.efi.iso": { source: "iana" },
    "application/vnd.emclient.accessrequest+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.enliven": { source: "iana", extensions: ["nml"] },
    "application/vnd.enphase.envoy": { source: "iana" },
    "application/vnd.eprints.data+xml": { source: "iana", compressible: !0 },
    "application/vnd.epson.esf": { source: "iana", extensions: ["esf"] },
    "application/vnd.epson.msf": { source: "iana", extensions: ["msf"] },
    "application/vnd.epson.quickanime": { source: "iana", extensions: ["qam"] },
    "application/vnd.epson.salt": { source: "iana", extensions: ["slt"] },
    "application/vnd.epson.ssf": { source: "iana", extensions: ["ssf"] },
    "application/vnd.ericsson.quickcall": { source: "iana" },
    "application/vnd.espass-espass+zip": { source: "iana", compressible: !1 },
    "application/vnd.eszigno3+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["es3", "et3"],
    },
    "application/vnd.etsi.aoc+xml": { source: "iana", compressible: !0 },
    "application/vnd.etsi.asic-e+zip": { source: "iana", compressible: !1 },
    "application/vnd.etsi.asic-s+zip": { source: "iana", compressible: !1 },
    "application/vnd.etsi.cug+xml": { source: "iana", compressible: !0 },
    "application/vnd.etsi.iptvcommand+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.etsi.iptvdiscovery+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.etsi.iptvprofile+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.etsi.iptvsad-bc+xml": { source: "iana", compressible: !0 },
    "application/vnd.etsi.iptvsad-cod+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.etsi.iptvsad-npvr+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.etsi.iptvservice+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.etsi.iptvsync+xml": { source: "iana", compressible: !0 },
    "application/vnd.etsi.iptvueprofile+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.etsi.mcid+xml": { source: "iana", compressible: !0 },
    "application/vnd.etsi.mheg5": { source: "iana" },
    "application/vnd.etsi.overload-control-policy-dataset+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.etsi.pstn+xml": { source: "iana", compressible: !0 },
    "application/vnd.etsi.sci+xml": { source: "iana", compressible: !0 },
    "application/vnd.etsi.simservs+xml": { source: "iana", compressible: !0 },
    "application/vnd.etsi.timestamp-token": { source: "iana" },
    "application/vnd.etsi.tsl+xml": { source: "iana", compressible: !0 },
    "application/vnd.etsi.tsl.der": { source: "iana" },
    "application/vnd.eu.kasparian.car+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.eudora.data": { source: "iana" },
    "application/vnd.evolv.ecig.profile": { source: "iana" },
    "application/vnd.evolv.ecig.settings": { source: "iana" },
    "application/vnd.evolv.ecig.theme": { source: "iana" },
    "application/vnd.exstream-empower+zip": {
      source: "iana",
      compressible: !1,
    },
    "application/vnd.exstream-package": { source: "iana" },
    "application/vnd.ezpix-album": { source: "iana", extensions: ["ez2"] },
    "application/vnd.ezpix-package": { source: "iana", extensions: ["ez3"] },
    "application/vnd.f-secure.mobile": { source: "iana" },
    "application/vnd.familysearch.gedcom+zip": {
      source: "iana",
      compressible: !1,
    },
    "application/vnd.fastcopy-disk-image": { source: "iana" },
    "application/vnd.fdf": { source: "iana", extensions: ["fdf"] },
    "application/vnd.fdsn.mseed": { source: "iana", extensions: ["mseed"] },
    "application/vnd.fdsn.seed": {
      source: "iana",
      extensions: ["seed", "dataless"],
    },
    "application/vnd.ffsns": { source: "iana" },
    "application/vnd.ficlab.flb+zip": { source: "iana", compressible: !1 },
    "application/vnd.filmit.zfc": { source: "iana" },
    "application/vnd.fints": { source: "iana" },
    "application/vnd.firemonkeys.cloudcell": { source: "iana" },
    "application/vnd.flographit": { source: "iana", extensions: ["gph"] },
    "application/vnd.fluxtime.clip": { source: "iana", extensions: ["ftc"] },
    "application/vnd.font-fontforge-sfd": { source: "iana" },
    "application/vnd.framemaker": {
      source: "iana",
      extensions: ["fm", "frame", "maker", "book"],
    },
    "application/vnd.frogans.fnc": { source: "iana", extensions: ["fnc"] },
    "application/vnd.frogans.ltf": { source: "iana", extensions: ["ltf"] },
    "application/vnd.fsc.weblaunch": { source: "iana", extensions: ["fsc"] },
    "application/vnd.fujifilm.fb.docuworks": { source: "iana" },
    "application/vnd.fujifilm.fb.docuworks.binder": { source: "iana" },
    "application/vnd.fujifilm.fb.docuworks.container": { source: "iana" },
    "application/vnd.fujifilm.fb.jfi+xml": { source: "iana", compressible: !0 },
    "application/vnd.fujitsu.oasys": { source: "iana", extensions: ["oas"] },
    "application/vnd.fujitsu.oasys2": { source: "iana", extensions: ["oa2"] },
    "application/vnd.fujitsu.oasys3": { source: "iana", extensions: ["oa3"] },
    "application/vnd.fujitsu.oasysgp": { source: "iana", extensions: ["fg5"] },
    "application/vnd.fujitsu.oasysprs": { source: "iana", extensions: ["bh2"] },
    "application/vnd.fujixerox.art-ex": { source: "iana" },
    "application/vnd.fujixerox.art4": { source: "iana" },
    "application/vnd.fujixerox.ddd": { source: "iana", extensions: ["ddd"] },
    "application/vnd.fujixerox.docuworks": {
      source: "iana",
      extensions: ["xdw"],
    },
    "application/vnd.fujixerox.docuworks.binder": {
      source: "iana",
      extensions: ["xbd"],
    },
    "application/vnd.fujixerox.docuworks.container": { source: "iana" },
    "application/vnd.fujixerox.hbpl": { source: "iana" },
    "application/vnd.fut-misnet": { source: "iana" },
    "application/vnd.futoin+cbor": { source: "iana" },
    "application/vnd.futoin+json": { source: "iana", compressible: !0 },
    "application/vnd.fuzzysheet": { source: "iana", extensions: ["fzs"] },
    "application/vnd.genomatix.tuxedo": { source: "iana", extensions: ["txd"] },
    "application/vnd.gentics.grd+json": { source: "iana", compressible: !0 },
    "application/vnd.geo+json": { source: "iana", compressible: !0 },
    "application/vnd.geocube+xml": { source: "iana", compressible: !0 },
    "application/vnd.geogebra.file": { source: "iana", extensions: ["ggb"] },
    "application/vnd.geogebra.slides": { source: "iana" },
    "application/vnd.geogebra.tool": { source: "iana", extensions: ["ggt"] },
    "application/vnd.geometry-explorer": {
      source: "iana",
      extensions: ["gex", "gre"],
    },
    "application/vnd.geonext": { source: "iana", extensions: ["gxt"] },
    "application/vnd.geoplan": { source: "iana", extensions: ["g2w"] },
    "application/vnd.geospace": { source: "iana", extensions: ["g3w"] },
    "application/vnd.gerber": { source: "iana" },
    "application/vnd.globalplatform.card-content-mgt": { source: "iana" },
    "application/vnd.globalplatform.card-content-mgt-response": {
      source: "iana",
    },
    "application/vnd.gmx": { source: "iana", extensions: ["gmx"] },
    "application/vnd.google-apps.document": {
      compressible: !1,
      extensions: ["gdoc"],
    },
    "application/vnd.google-apps.presentation": {
      compressible: !1,
      extensions: ["gslides"],
    },
    "application/vnd.google-apps.spreadsheet": {
      compressible: !1,
      extensions: ["gsheet"],
    },
    "application/vnd.google-earth.kml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["kml"],
    },
    "application/vnd.google-earth.kmz": {
      source: "iana",
      compressible: !1,
      extensions: ["kmz"],
    },
    "application/vnd.gov.sk.e-form+xml": { source: "iana", compressible: !0 },
    "application/vnd.gov.sk.e-form+zip": { source: "iana", compressible: !1 },
    "application/vnd.gov.sk.xmldatacontainer+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.grafeq": { source: "iana", extensions: ["gqf", "gqs"] },
    "application/vnd.gridmp": { source: "iana" },
    "application/vnd.groove-account": { source: "iana", extensions: ["gac"] },
    "application/vnd.groove-help": { source: "iana", extensions: ["ghf"] },
    "application/vnd.groove-identity-message": {
      source: "iana",
      extensions: ["gim"],
    },
    "application/vnd.groove-injector": { source: "iana", extensions: ["grv"] },
    "application/vnd.groove-tool-message": {
      source: "iana",
      extensions: ["gtm"],
    },
    "application/vnd.groove-tool-template": {
      source: "iana",
      extensions: ["tpl"],
    },
    "application/vnd.groove-vcard": { source: "iana", extensions: ["vcg"] },
    "application/vnd.hal+json": { source: "iana", compressible: !0 },
    "application/vnd.hal+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["hal"],
    },
    "application/vnd.handheld-entertainment+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["zmm"],
    },
    "application/vnd.hbci": { source: "iana", extensions: ["hbci"] },
    "application/vnd.hc+json": { source: "iana", compressible: !0 },
    "application/vnd.hcl-bireports": { source: "iana" },
    "application/vnd.hdt": { source: "iana" },
    "application/vnd.heroku+json": { source: "iana", compressible: !0 },
    "application/vnd.hhe.lesson-player": {
      source: "iana",
      extensions: ["les"],
    },
    "application/vnd.hl7cda+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/vnd.hl7v2+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/vnd.hp-hpgl": { source: "iana", extensions: ["hpgl"] },
    "application/vnd.hp-hpid": { source: "iana", extensions: ["hpid"] },
    "application/vnd.hp-hps": { source: "iana", extensions: ["hps"] },
    "application/vnd.hp-jlyt": { source: "iana", extensions: ["jlt"] },
    "application/vnd.hp-pcl": { source: "iana", extensions: ["pcl"] },
    "application/vnd.hp-pclxl": { source: "iana", extensions: ["pclxl"] },
    "application/vnd.httphone": { source: "iana" },
    "application/vnd.hydrostatix.sof-data": {
      source: "iana",
      extensions: ["sfd-hdstx"],
    },
    "application/vnd.hyper+json": { source: "iana", compressible: !0 },
    "application/vnd.hyper-item+json": { source: "iana", compressible: !0 },
    "application/vnd.hyperdrive+json": { source: "iana", compressible: !0 },
    "application/vnd.hzn-3d-crossword": { source: "iana" },
    "application/vnd.ibm.afplinedata": { source: "iana" },
    "application/vnd.ibm.electronic-media": { source: "iana" },
    "application/vnd.ibm.minipay": { source: "iana", extensions: ["mpy"] },
    "application/vnd.ibm.modcap": {
      source: "iana",
      extensions: ["afp", "listafp", "list3820"],
    },
    "application/vnd.ibm.rights-management": {
      source: "iana",
      extensions: ["irm"],
    },
    "application/vnd.ibm.secure-container": {
      source: "iana",
      extensions: ["sc"],
    },
    "application/vnd.iccprofile": {
      source: "iana",
      extensions: ["icc", "icm"],
    },
    "application/vnd.ieee.1905": { source: "iana" },
    "application/vnd.igloader": { source: "iana", extensions: ["igl"] },
    "application/vnd.imagemeter.folder+zip": {
      source: "iana",
      compressible: !1,
    },
    "application/vnd.imagemeter.image+zip": {
      source: "iana",
      compressible: !1,
    },
    "application/vnd.immervision-ivp": { source: "iana", extensions: ["ivp"] },
    "application/vnd.immervision-ivu": { source: "iana", extensions: ["ivu"] },
    "application/vnd.ims.imsccv1p1": { source: "iana" },
    "application/vnd.ims.imsccv1p2": { source: "iana" },
    "application/vnd.ims.imsccv1p3": { source: "iana" },
    "application/vnd.ims.lis.v2.result+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.ims.lti.v2.toolconsumerprofile+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.ims.lti.v2.toolproxy+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.ims.lti.v2.toolproxy.id+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.ims.lti.v2.toolsettings+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.ims.lti.v2.toolsettings.simple+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.informedcontrol.rms+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.informix-visionary": { source: "iana" },
    "application/vnd.infotech.project": { source: "iana" },
    "application/vnd.infotech.project+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.innopath.wamp.notification": { source: "iana" },
    "application/vnd.insors.igm": { source: "iana", extensions: ["igm"] },
    "application/vnd.intercon.formnet": {
      source: "iana",
      extensions: ["xpw", "xpx"],
    },
    "application/vnd.intergeo": { source: "iana", extensions: ["i2g"] },
    "application/vnd.intertrust.digibox": { source: "iana" },
    "application/vnd.intertrust.nncp": { source: "iana" },
    "application/vnd.intu.qbo": { source: "iana", extensions: ["qbo"] },
    "application/vnd.intu.qfx": { source: "iana", extensions: ["qfx"] },
    "application/vnd.iptc.g2.catalogitem+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.iptc.g2.conceptitem+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.iptc.g2.knowledgeitem+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.iptc.g2.newsitem+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.iptc.g2.newsmessage+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.iptc.g2.packageitem+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.iptc.g2.planningitem+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.ipunplugged.rcprofile": {
      source: "iana",
      extensions: ["rcprofile"],
    },
    "application/vnd.irepository.package+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["irp"],
    },
    "application/vnd.is-xpr": { source: "iana", extensions: ["xpr"] },
    "application/vnd.isac.fcs": { source: "iana", extensions: ["fcs"] },
    "application/vnd.iso11783-10+zip": { source: "iana", compressible: !1 },
    "application/vnd.jam": { source: "iana", extensions: ["jam"] },
    "application/vnd.japannet-directory-service": { source: "iana" },
    "application/vnd.japannet-jpnstore-wakeup": { source: "iana" },
    "application/vnd.japannet-payment-wakeup": { source: "iana" },
    "application/vnd.japannet-registration": { source: "iana" },
    "application/vnd.japannet-registration-wakeup": { source: "iana" },
    "application/vnd.japannet-setstore-wakeup": { source: "iana" },
    "application/vnd.japannet-verification": { source: "iana" },
    "application/vnd.japannet-verification-wakeup": { source: "iana" },
    "application/vnd.jcp.javame.midlet-rms": {
      source: "iana",
      extensions: ["rms"],
    },
    "application/vnd.jisp": { source: "iana", extensions: ["jisp"] },
    "application/vnd.joost.joda-archive": {
      source: "iana",
      extensions: ["joda"],
    },
    "application/vnd.jsk.isdn-ngn": { source: "iana" },
    "application/vnd.kahootz": { source: "iana", extensions: ["ktz", "ktr"] },
    "application/vnd.kde.karbon": { source: "iana", extensions: ["karbon"] },
    "application/vnd.kde.kchart": { source: "iana", extensions: ["chrt"] },
    "application/vnd.kde.kformula": { source: "iana", extensions: ["kfo"] },
    "application/vnd.kde.kivio": { source: "iana", extensions: ["flw"] },
    "application/vnd.kde.kontour": { source: "iana", extensions: ["kon"] },
    "application/vnd.kde.kpresenter": {
      source: "iana",
      extensions: ["kpr", "kpt"],
    },
    "application/vnd.kde.kspread": { source: "iana", extensions: ["ksp"] },
    "application/vnd.kde.kword": { source: "iana", extensions: ["kwd", "kwt"] },
    "application/vnd.kenameaapp": { source: "iana", extensions: ["htke"] },
    "application/vnd.kidspiration": { source: "iana", extensions: ["kia"] },
    "application/vnd.kinar": { source: "iana", extensions: ["kne", "knp"] },
    "application/vnd.koan": {
      source: "iana",
      extensions: ["skp", "skd", "skt", "skm"],
    },
    "application/vnd.kodak-descriptor": { source: "iana", extensions: ["sse"] },
    "application/vnd.las": { source: "iana" },
    "application/vnd.las.las+json": { source: "iana", compressible: !0 },
    "application/vnd.las.las+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["lasxml"],
    },
    "application/vnd.laszip": { source: "iana" },
    "application/vnd.leap+json": { source: "iana", compressible: !0 },
    "application/vnd.liberty-request+xml": { source: "iana", compressible: !0 },
    "application/vnd.llamagraphics.life-balance.desktop": {
      source: "iana",
      extensions: ["lbd"],
    },
    "application/vnd.llamagraphics.life-balance.exchange+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["lbe"],
    },
    "application/vnd.logipipe.circuit+zip": {
      source: "iana",
      compressible: !1,
    },
    "application/vnd.loom": { source: "iana" },
    "application/vnd.lotus-1-2-3": { source: "iana", extensions: ["123"] },
    "application/vnd.lotus-approach": { source: "iana", extensions: ["apr"] },
    "application/vnd.lotus-freelance": { source: "iana", extensions: ["pre"] },
    "application/vnd.lotus-notes": { source: "iana", extensions: ["nsf"] },
    "application/vnd.lotus-organizer": { source: "iana", extensions: ["org"] },
    "application/vnd.lotus-screencam": { source: "iana", extensions: ["scm"] },
    "application/vnd.lotus-wordpro": { source: "iana", extensions: ["lwp"] },
    "application/vnd.macports.portpkg": {
      source: "iana",
      extensions: ["portpkg"],
    },
    "application/vnd.mapbox-vector-tile": {
      source: "iana",
      extensions: ["mvt"],
    },
    "application/vnd.marlin.drm.actiontoken+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.marlin.drm.conftoken+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.marlin.drm.license+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.marlin.drm.mdcf": { source: "iana" },
    "application/vnd.mason+json": { source: "iana", compressible: !0 },
    "application/vnd.maxar.archive.3tz+zip": {
      source: "iana",
      compressible: !1,
    },
    "application/vnd.maxmind.maxmind-db": { source: "iana" },
    "application/vnd.mcd": { source: "iana", extensions: ["mcd"] },
    "application/vnd.medcalcdata": { source: "iana", extensions: ["mc1"] },
    "application/vnd.mediastation.cdkey": {
      source: "iana",
      extensions: ["cdkey"],
    },
    "application/vnd.meridian-slingshot": { source: "iana" },
    "application/vnd.mfer": { source: "iana", extensions: ["mwf"] },
    "application/vnd.mfmp": { source: "iana", extensions: ["mfm"] },
    "application/vnd.micro+json": { source: "iana", compressible: !0 },
    "application/vnd.micrografx.flo": { source: "iana", extensions: ["flo"] },
    "application/vnd.micrografx.igx": { source: "iana", extensions: ["igx"] },
    "application/vnd.microsoft.portable-executable": { source: "iana" },
    "application/vnd.microsoft.windows.thumbnail-cache": { source: "iana" },
    "application/vnd.miele+json": { source: "iana", compressible: !0 },
    "application/vnd.mif": { source: "iana", extensions: ["mif"] },
    "application/vnd.minisoft-hp3000-save": { source: "iana" },
    "application/vnd.mitsubishi.misty-guard.trustweb": { source: "iana" },
    "application/vnd.mobius.daf": { source: "iana", extensions: ["daf"] },
    "application/vnd.mobius.dis": { source: "iana", extensions: ["dis"] },
    "application/vnd.mobius.mbk": { source: "iana", extensions: ["mbk"] },
    "application/vnd.mobius.mqy": { source: "iana", extensions: ["mqy"] },
    "application/vnd.mobius.msl": { source: "iana", extensions: ["msl"] },
    "application/vnd.mobius.plc": { source: "iana", extensions: ["plc"] },
    "application/vnd.mobius.txf": { source: "iana", extensions: ["txf"] },
    "application/vnd.mophun.application": {
      source: "iana",
      extensions: ["mpn"],
    },
    "application/vnd.mophun.certificate": {
      source: "iana",
      extensions: ["mpc"],
    },
    "application/vnd.motorola.flexsuite": { source: "iana" },
    "application/vnd.motorola.flexsuite.adsi": { source: "iana" },
    "application/vnd.motorola.flexsuite.fis": { source: "iana" },
    "application/vnd.motorola.flexsuite.gotap": { source: "iana" },
    "application/vnd.motorola.flexsuite.kmr": { source: "iana" },
    "application/vnd.motorola.flexsuite.ttc": { source: "iana" },
    "application/vnd.motorola.flexsuite.wem": { source: "iana" },
    "application/vnd.motorola.iprm": { source: "iana" },
    "application/vnd.mozilla.xul+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xul"],
    },
    "application/vnd.ms-3mfdocument": { source: "iana" },
    "application/vnd.ms-artgalry": { source: "iana", extensions: ["cil"] },
    "application/vnd.ms-asf": { source: "iana" },
    "application/vnd.ms-cab-compressed": {
      source: "iana",
      extensions: ["cab"],
    },
    "application/vnd.ms-color.iccprofile": { source: "apache" },
    "application/vnd.ms-excel": {
      source: "iana",
      compressible: !1,
      extensions: ["xls", "xlm", "xla", "xlc", "xlt", "xlw"],
    },
    "application/vnd.ms-excel.addin.macroenabled.12": {
      source: "iana",
      extensions: ["xlam"],
    },
    "application/vnd.ms-excel.sheet.binary.macroenabled.12": {
      source: "iana",
      extensions: ["xlsb"],
    },
    "application/vnd.ms-excel.sheet.macroenabled.12": {
      source: "iana",
      extensions: ["xlsm"],
    },
    "application/vnd.ms-excel.template.macroenabled.12": {
      source: "iana",
      extensions: ["xltm"],
    },
    "application/vnd.ms-fontobject": {
      source: "iana",
      compressible: !0,
      extensions: ["eot"],
    },
    "application/vnd.ms-htmlhelp": { source: "iana", extensions: ["chm"] },
    "application/vnd.ms-ims": { source: "iana", extensions: ["ims"] },
    "application/vnd.ms-lrm": { source: "iana", extensions: ["lrm"] },
    "application/vnd.ms-office.activex+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.ms-officetheme": { source: "iana", extensions: ["thmx"] },
    "application/vnd.ms-opentype": { source: "apache", compressible: !0 },
    "application/vnd.ms-outlook": { compressible: !1, extensions: ["msg"] },
    "application/vnd.ms-package.obfuscated-opentype": { source: "apache" },
    "application/vnd.ms-pki.seccat": { source: "apache", extensions: ["cat"] },
    "application/vnd.ms-pki.stl": { source: "apache", extensions: ["stl"] },
    "application/vnd.ms-playready.initiator+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.ms-powerpoint": {
      source: "iana",
      compressible: !1,
      extensions: ["ppt", "pps", "pot"],
    },
    "application/vnd.ms-powerpoint.addin.macroenabled.12": {
      source: "iana",
      extensions: ["ppam"],
    },
    "application/vnd.ms-powerpoint.presentation.macroenabled.12": {
      source: "iana",
      extensions: ["pptm"],
    },
    "application/vnd.ms-powerpoint.slide.macroenabled.12": {
      source: "iana",
      extensions: ["sldm"],
    },
    "application/vnd.ms-powerpoint.slideshow.macroenabled.12": {
      source: "iana",
      extensions: ["ppsm"],
    },
    "application/vnd.ms-powerpoint.template.macroenabled.12": {
      source: "iana",
      extensions: ["potm"],
    },
    "application/vnd.ms-printdevicecapabilities+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.ms-printing.printticket+xml": {
      source: "apache",
      compressible: !0,
    },
    "application/vnd.ms-printschematicket+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.ms-project": {
      source: "iana",
      extensions: ["mpp", "mpt"],
    },
    "application/vnd.ms-tnef": { source: "iana" },
    "application/vnd.ms-windows.devicepairing": { source: "iana" },
    "application/vnd.ms-windows.nwprinting.oob": { source: "iana" },
    "application/vnd.ms-windows.printerpairing": { source: "iana" },
    "application/vnd.ms-windows.wsd.oob": { source: "iana" },
    "application/vnd.ms-wmdrm.lic-chlg-req": { source: "iana" },
    "application/vnd.ms-wmdrm.lic-resp": { source: "iana" },
    "application/vnd.ms-wmdrm.meter-chlg-req": { source: "iana" },
    "application/vnd.ms-wmdrm.meter-resp": { source: "iana" },
    "application/vnd.ms-word.document.macroenabled.12": {
      source: "iana",
      extensions: ["docm"],
    },
    "application/vnd.ms-word.template.macroenabled.12": {
      source: "iana",
      extensions: ["dotm"],
    },
    "application/vnd.ms-works": {
      source: "iana",
      extensions: ["wps", "wks", "wcm", "wdb"],
    },
    "application/vnd.ms-wpl": { source: "iana", extensions: ["wpl"] },
    "application/vnd.ms-xpsdocument": {
      source: "iana",
      compressible: !1,
      extensions: ["xps"],
    },
    "application/vnd.msa-disk-image": { source: "iana" },
    "application/vnd.mseq": { source: "iana", extensions: ["mseq"] },
    "application/vnd.msign": { source: "iana" },
    "application/vnd.multiad.creator": { source: "iana" },
    "application/vnd.multiad.creator.cif": { source: "iana" },
    "application/vnd.music-niff": { source: "iana" },
    "application/vnd.musician": { source: "iana", extensions: ["mus"] },
    "application/vnd.muvee.style": { source: "iana", extensions: ["msty"] },
    "application/vnd.mynfc": { source: "iana", extensions: ["taglet"] },
    "application/vnd.nacamar.ybrid+json": { source: "iana", compressible: !0 },
    "application/vnd.ncd.control": { source: "iana" },
    "application/vnd.ncd.reference": { source: "iana" },
    "application/vnd.nearst.inv+json": { source: "iana", compressible: !0 },
    "application/vnd.nebumind.line": { source: "iana" },
    "application/vnd.nervana": { source: "iana" },
    "application/vnd.netfpx": { source: "iana" },
    "application/vnd.neurolanguage.nlu": {
      source: "iana",
      extensions: ["nlu"],
    },
    "application/vnd.nimn": { source: "iana" },
    "application/vnd.nintendo.nitro.rom": { source: "iana" },
    "application/vnd.nintendo.snes.rom": { source: "iana" },
    "application/vnd.nitf": { source: "iana", extensions: ["ntf", "nitf"] },
    "application/vnd.noblenet-directory": {
      source: "iana",
      extensions: ["nnd"],
    },
    "application/vnd.noblenet-sealer": { source: "iana", extensions: ["nns"] },
    "application/vnd.noblenet-web": { source: "iana", extensions: ["nnw"] },
    "application/vnd.nokia.catalogs": { source: "iana" },
    "application/vnd.nokia.conml+wbxml": { source: "iana" },
    "application/vnd.nokia.conml+xml": { source: "iana", compressible: !0 },
    "application/vnd.nokia.iptv.config+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.nokia.isds-radio-presets": { source: "iana" },
    "application/vnd.nokia.landmark+wbxml": { source: "iana" },
    "application/vnd.nokia.landmark+xml": { source: "iana", compressible: !0 },
    "application/vnd.nokia.landmarkcollection+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.nokia.n-gage.ac+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["ac"],
    },
    "application/vnd.nokia.n-gage.data": {
      source: "iana",
      extensions: ["ngdat"],
    },
    "application/vnd.nokia.n-gage.symbian.install": {
      source: "iana",
      extensions: ["n-gage"],
    },
    "application/vnd.nokia.ncd": { source: "iana" },
    "application/vnd.nokia.pcd+wbxml": { source: "iana" },
    "application/vnd.nokia.pcd+xml": { source: "iana", compressible: !0 },
    "application/vnd.nokia.radio-preset": {
      source: "iana",
      extensions: ["rpst"],
    },
    "application/vnd.nokia.radio-presets": {
      source: "iana",
      extensions: ["rpss"],
    },
    "application/vnd.novadigm.edm": { source: "iana", extensions: ["edm"] },
    "application/vnd.novadigm.edx": { source: "iana", extensions: ["edx"] },
    "application/vnd.novadigm.ext": { source: "iana", extensions: ["ext"] },
    "application/vnd.ntt-local.content-share": { source: "iana" },
    "application/vnd.ntt-local.file-transfer": { source: "iana" },
    "application/vnd.ntt-local.ogw_remote-access": { source: "iana" },
    "application/vnd.ntt-local.sip-ta_remote": { source: "iana" },
    "application/vnd.ntt-local.sip-ta_tcp_stream": { source: "iana" },
    "application/vnd.oasis.opendocument.chart": {
      source: "iana",
      extensions: ["odc"],
    },
    "application/vnd.oasis.opendocument.chart-template": {
      source: "iana",
      extensions: ["otc"],
    },
    "application/vnd.oasis.opendocument.database": {
      source: "iana",
      extensions: ["odb"],
    },
    "application/vnd.oasis.opendocument.formula": {
      source: "iana",
      extensions: ["odf"],
    },
    "application/vnd.oasis.opendocument.formula-template": {
      source: "iana",
      extensions: ["odft"],
    },
    "application/vnd.oasis.opendocument.graphics": {
      source: "iana",
      compressible: !1,
      extensions: ["odg"],
    },
    "application/vnd.oasis.opendocument.graphics-template": {
      source: "iana",
      extensions: ["otg"],
    },
    "application/vnd.oasis.opendocument.image": {
      source: "iana",
      extensions: ["odi"],
    },
    "application/vnd.oasis.opendocument.image-template": {
      source: "iana",
      extensions: ["oti"],
    },
    "application/vnd.oasis.opendocument.presentation": {
      source: "iana",
      compressible: !1,
      extensions: ["odp"],
    },
    "application/vnd.oasis.opendocument.presentation-template": {
      source: "iana",
      extensions: ["otp"],
    },
    "application/vnd.oasis.opendocument.spreadsheet": {
      source: "iana",
      compressible: !1,
      extensions: ["ods"],
    },
    "application/vnd.oasis.opendocument.spreadsheet-template": {
      source: "iana",
      extensions: ["ots"],
    },
    "application/vnd.oasis.opendocument.text": {
      source: "iana",
      compressible: !1,
      extensions: ["odt"],
    },
    "application/vnd.oasis.opendocument.text-master": {
      source: "iana",
      extensions: ["odm"],
    },
    "application/vnd.oasis.opendocument.text-template": {
      source: "iana",
      extensions: ["ott"],
    },
    "application/vnd.oasis.opendocument.text-web": {
      source: "iana",
      extensions: ["oth"],
    },
    "application/vnd.obn": { source: "iana" },
    "application/vnd.ocf+cbor": { source: "iana" },
    "application/vnd.oci.image.manifest.v1+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oftn.l10n+json": { source: "iana", compressible: !0 },
    "application/vnd.oipf.contentaccessdownload+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oipf.contentaccessstreaming+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oipf.cspg-hexbinary": { source: "iana" },
    "application/vnd.oipf.dae.svg+xml": { source: "iana", compressible: !0 },
    "application/vnd.oipf.dae.xhtml+xml": { source: "iana", compressible: !0 },
    "application/vnd.oipf.mippvcontrolmessage+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oipf.pae.gem": { source: "iana" },
    "application/vnd.oipf.spdiscovery+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oipf.spdlist+xml": { source: "iana", compressible: !0 },
    "application/vnd.oipf.ueprofile+xml": { source: "iana", compressible: !0 },
    "application/vnd.oipf.userprofile+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.olpc-sugar": { source: "iana", extensions: ["xo"] },
    "application/vnd.oma-scws-config": { source: "iana" },
    "application/vnd.oma-scws-http-request": { source: "iana" },
    "application/vnd.oma-scws-http-response": { source: "iana" },
    "application/vnd.oma.bcast.associated-procedure-parameter+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.bcast.drm-trigger+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.bcast.imd+xml": { source: "iana", compressible: !0 },
    "application/vnd.oma.bcast.ltkm": { source: "iana" },
    "application/vnd.oma.bcast.notification+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.bcast.provisioningtrigger": { source: "iana" },
    "application/vnd.oma.bcast.sgboot": { source: "iana" },
    "application/vnd.oma.bcast.sgdd+xml": { source: "iana", compressible: !0 },
    "application/vnd.oma.bcast.sgdu": { source: "iana" },
    "application/vnd.oma.bcast.simple-symbol-container": { source: "iana" },
    "application/vnd.oma.bcast.smartcard-trigger+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.bcast.sprov+xml": { source: "iana", compressible: !0 },
    "application/vnd.oma.bcast.stkm": { source: "iana" },
    "application/vnd.oma.cab-address-book+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.cab-feature-handler+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.cab-pcc+xml": { source: "iana", compressible: !0 },
    "application/vnd.oma.cab-subs-invite+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.cab-user-prefs+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.dcd": { source: "iana" },
    "application/vnd.oma.dcdc": { source: "iana" },
    "application/vnd.oma.dd2+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["dd2"],
    },
    "application/vnd.oma.drm.risd+xml": { source: "iana", compressible: !0 },
    "application/vnd.oma.group-usage-list+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.lwm2m+cbor": { source: "iana" },
    "application/vnd.oma.lwm2m+json": { source: "iana", compressible: !0 },
    "application/vnd.oma.lwm2m+tlv": { source: "iana" },
    "application/vnd.oma.pal+xml": { source: "iana", compressible: !0 },
    "application/vnd.oma.poc.detailed-progress-report+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.poc.final-report+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.poc.groups+xml": { source: "iana", compressible: !0 },
    "application/vnd.oma.poc.invocation-descriptor+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.poc.optimized-progress-report+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.push": { source: "iana" },
    "application/vnd.oma.scidm.messages+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oma.xcap-directory+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.omads-email+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/vnd.omads-file+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/vnd.omads-folder+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/vnd.omaloc-supl-init": { source: "iana" },
    "application/vnd.onepager": { source: "iana" },
    "application/vnd.onepagertamp": { source: "iana" },
    "application/vnd.onepagertamx": { source: "iana" },
    "application/vnd.onepagertat": { source: "iana" },
    "application/vnd.onepagertatp": { source: "iana" },
    "application/vnd.onepagertatx": { source: "iana" },
    "application/vnd.openblox.game+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["obgx"],
    },
    "application/vnd.openblox.game-binary": { source: "iana" },
    "application/vnd.openeye.oeb": { source: "iana" },
    "application/vnd.openofficeorg.extension": {
      source: "apache",
      extensions: ["oxt"],
    },
    "application/vnd.openstreetmap.data+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["osm"],
    },
    "application/vnd.opentimestamps.ots": { source: "iana" },
    "application/vnd.openxmlformats-officedocument.custom-properties+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.customxmlproperties+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.drawing+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.drawingml.chart+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.extended-properties+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.comments+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      { source: "iana", compressible: !1, extensions: ["pptx"] },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.presprops+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.slide": {
      source: "iana",
      extensions: ["sldx"],
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slide+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow": {
      source: "iana",
      extensions: ["ppsx"],
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.tags+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.presentationml.template": {
      source: "iana",
      extensions: ["potx"],
    },
    "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      source: "iana",
      compressible: !1,
      extensions: ["xlsx"],
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.template": {
      source: "iana",
      extensions: ["xltx"],
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.theme+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.themeoverride+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-officedocument.vmldrawing": {
      source: "iana",
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      source: "iana",
      compressible: !1,
      extensions: ["docx"],
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template": {
      source: "iana",
      extensions: ["dotx"],
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-package.core-properties+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml":
      { source: "iana", compressible: !0 },
    "application/vnd.openxmlformats-package.relationships+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.oracle.resource+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.orange.indata": { source: "iana" },
    "application/vnd.osa.netdeploy": { source: "iana" },
    "application/vnd.osgeo.mapguide.package": {
      source: "iana",
      extensions: ["mgp"],
    },
    "application/vnd.osgi.bundle": { source: "iana" },
    "application/vnd.osgi.dp": { source: "iana", extensions: ["dp"] },
    "application/vnd.osgi.subsystem": { source: "iana", extensions: ["esa"] },
    "application/vnd.otps.ct-kip+xml": { source: "iana", compressible: !0 },
    "application/vnd.oxli.countgraph": { source: "iana" },
    "application/vnd.pagerduty+json": { source: "iana", compressible: !0 },
    "application/vnd.palm": {
      source: "iana",
      extensions: ["pdb", "pqa", "oprc"],
    },
    "application/vnd.panoply": { source: "iana" },
    "application/vnd.paos.xml": { source: "iana" },
    "application/vnd.patentdive": { source: "iana" },
    "application/vnd.patientecommsdoc": { source: "iana" },
    "application/vnd.pawaafile": { source: "iana", extensions: ["paw"] },
    "application/vnd.pcos": { source: "iana" },
    "application/vnd.pg.format": { source: "iana", extensions: ["str"] },
    "application/vnd.pg.osasli": { source: "iana", extensions: ["ei6"] },
    "application/vnd.piaccess.application-licence": { source: "iana" },
    "application/vnd.picsel": { source: "iana", extensions: ["efif"] },
    "application/vnd.pmi.widget": { source: "iana", extensions: ["wg"] },
    "application/vnd.poc.group-advertisement+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.pocketlearn": { source: "iana", extensions: ["plf"] },
    "application/vnd.powerbuilder6": { source: "iana", extensions: ["pbd"] },
    "application/vnd.powerbuilder6-s": { source: "iana" },
    "application/vnd.powerbuilder7": { source: "iana" },
    "application/vnd.powerbuilder7-s": { source: "iana" },
    "application/vnd.powerbuilder75": { source: "iana" },
    "application/vnd.powerbuilder75-s": { source: "iana" },
    "application/vnd.preminet": { source: "iana" },
    "application/vnd.previewsystems.box": {
      source: "iana",
      extensions: ["box"],
    },
    "application/vnd.proteus.magazine": { source: "iana", extensions: ["mgz"] },
    "application/vnd.psfs": { source: "iana" },
    "application/vnd.publishare-delta-tree": {
      source: "iana",
      extensions: ["qps"],
    },
    "application/vnd.pvi.ptid1": { source: "iana", extensions: ["ptid"] },
    "application/vnd.pwg-multiplexed": { source: "iana" },
    "application/vnd.pwg-xhtml-print+xml": { source: "iana", compressible: !0 },
    "application/vnd.qualcomm.brew-app-res": { source: "iana" },
    "application/vnd.quarantainenet": { source: "iana" },
    "application/vnd.quark.quarkxpress": {
      source: "iana",
      extensions: ["qxd", "qxt", "qwd", "qwt", "qxl", "qxb"],
    },
    "application/vnd.quobject-quoxdocument": { source: "iana" },
    "application/vnd.radisys.moml+xml": { source: "iana", compressible: !0 },
    "application/vnd.radisys.msml+xml": { source: "iana", compressible: !0 },
    "application/vnd.radisys.msml-audit+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-audit-conf+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-audit-conn+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-audit-dialog+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-audit-stream+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-conf+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-dialog+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-dialog-base+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-dialog-fax-detect+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-dialog-fax-sendrecv+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-dialog-group+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-dialog-speech+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.radisys.msml-dialog-transform+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.rainstor.data": { source: "iana" },
    "application/vnd.rapid": { source: "iana" },
    "application/vnd.rar": { source: "iana", extensions: ["rar"] },
    "application/vnd.realvnc.bed": { source: "iana", extensions: ["bed"] },
    "application/vnd.recordare.musicxml": {
      source: "iana",
      extensions: ["mxl"],
    },
    "application/vnd.recordare.musicxml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["musicxml"],
    },
    "application/vnd.renlearn.rlprint": { source: "iana" },
    "application/vnd.resilient.logic": { source: "iana" },
    "application/vnd.restful+json": { source: "iana", compressible: !0 },
    "application/vnd.rig.cryptonote": {
      source: "iana",
      extensions: ["cryptonote"],
    },
    "application/vnd.rim.cod": { source: "apache", extensions: ["cod"] },
    "application/vnd.rn-realmedia": { source: "apache", extensions: ["rm"] },
    "application/vnd.rn-realmedia-vbr": {
      source: "apache",
      extensions: ["rmvb"],
    },
    "application/vnd.route66.link66+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["link66"],
    },
    "application/vnd.rs-274x": { source: "iana" },
    "application/vnd.ruckus.download": { source: "iana" },
    "application/vnd.s3sms": { source: "iana" },
    "application/vnd.sailingtracker.track": {
      source: "iana",
      extensions: ["st"],
    },
    "application/vnd.sar": { source: "iana" },
    "application/vnd.sbm.cid": { source: "iana" },
    "application/vnd.sbm.mid2": { source: "iana" },
    "application/vnd.scribus": { source: "iana" },
    "application/vnd.sealed.3df": { source: "iana" },
    "application/vnd.sealed.csf": { source: "iana" },
    "application/vnd.sealed.doc": { source: "iana" },
    "application/vnd.sealed.eml": { source: "iana" },
    "application/vnd.sealed.mht": { source: "iana" },
    "application/vnd.sealed.net": { source: "iana" },
    "application/vnd.sealed.ppt": { source: "iana" },
    "application/vnd.sealed.tiff": { source: "iana" },
    "application/vnd.sealed.xls": { source: "iana" },
    "application/vnd.sealedmedia.softseal.html": { source: "iana" },
    "application/vnd.sealedmedia.softseal.pdf": { source: "iana" },
    "application/vnd.seemail": { source: "iana", extensions: ["see"] },
    "application/vnd.seis+json": { source: "iana", compressible: !0 },
    "application/vnd.sema": { source: "iana", extensions: ["sema"] },
    "application/vnd.semd": { source: "iana", extensions: ["semd"] },
    "application/vnd.semf": { source: "iana", extensions: ["semf"] },
    "application/vnd.shade-save-file": { source: "iana" },
    "application/vnd.shana.informed.formdata": {
      source: "iana",
      extensions: ["ifm"],
    },
    "application/vnd.shana.informed.formtemplate": {
      source: "iana",
      extensions: ["itp"],
    },
    "application/vnd.shana.informed.interchange": {
      source: "iana",
      extensions: ["iif"],
    },
    "application/vnd.shana.informed.package": {
      source: "iana",
      extensions: ["ipk"],
    },
    "application/vnd.shootproof+json": { source: "iana", compressible: !0 },
    "application/vnd.shopkick+json": { source: "iana", compressible: !0 },
    "application/vnd.shp": { source: "iana" },
    "application/vnd.shx": { source: "iana" },
    "application/vnd.sigrok.session": { source: "iana" },
    "application/vnd.simtech-mindmapper": {
      source: "iana",
      extensions: ["twd", "twds"],
    },
    "application/vnd.siren+json": { source: "iana", compressible: !0 },
    "application/vnd.smaf": { source: "iana", extensions: ["mmf"] },
    "application/vnd.smart.notebook": { source: "iana" },
    "application/vnd.smart.teacher": {
      source: "iana",
      extensions: ["teacher"],
    },
    "application/vnd.snesdev-page-table": { source: "iana" },
    "application/vnd.software602.filler.form+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["fo"],
    },
    "application/vnd.software602.filler.form-xml-zip": { source: "iana" },
    "application/vnd.solent.sdkm+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["sdkm", "sdkd"],
    },
    "application/vnd.spotfire.dxp": { source: "iana", extensions: ["dxp"] },
    "application/vnd.spotfire.sfs": { source: "iana", extensions: ["sfs"] },
    "application/vnd.sqlite3": { source: "iana" },
    "application/vnd.sss-cod": { source: "iana" },
    "application/vnd.sss-dtf": { source: "iana" },
    "application/vnd.sss-ntf": { source: "iana" },
    "application/vnd.stardivision.calc": {
      source: "apache",
      extensions: ["sdc"],
    },
    "application/vnd.stardivision.draw": {
      source: "apache",
      extensions: ["sda"],
    },
    "application/vnd.stardivision.impress": {
      source: "apache",
      extensions: ["sdd"],
    },
    "application/vnd.stardivision.math": {
      source: "apache",
      extensions: ["smf"],
    },
    "application/vnd.stardivision.writer": {
      source: "apache",
      extensions: ["sdw", "vor"],
    },
    "application/vnd.stardivision.writer-global": {
      source: "apache",
      extensions: ["sgl"],
    },
    "application/vnd.stepmania.package": {
      source: "iana",
      extensions: ["smzip"],
    },
    "application/vnd.stepmania.stepchart": {
      source: "iana",
      extensions: ["sm"],
    },
    "application/vnd.street-stream": { source: "iana" },
    "application/vnd.sun.wadl+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["wadl"],
    },
    "application/vnd.sun.xml.calc": { source: "apache", extensions: ["sxc"] },
    "application/vnd.sun.xml.calc.template": {
      source: "apache",
      extensions: ["stc"],
    },
    "application/vnd.sun.xml.draw": { source: "apache", extensions: ["sxd"] },
    "application/vnd.sun.xml.draw.template": {
      source: "apache",
      extensions: ["std"],
    },
    "application/vnd.sun.xml.impress": {
      source: "apache",
      extensions: ["sxi"],
    },
    "application/vnd.sun.xml.impress.template": {
      source: "apache",
      extensions: ["sti"],
    },
    "application/vnd.sun.xml.math": { source: "apache", extensions: ["sxm"] },
    "application/vnd.sun.xml.writer": { source: "apache", extensions: ["sxw"] },
    "application/vnd.sun.xml.writer.global": {
      source: "apache",
      extensions: ["sxg"],
    },
    "application/vnd.sun.xml.writer.template": {
      source: "apache",
      extensions: ["stw"],
    },
    "application/vnd.sus-calendar": {
      source: "iana",
      extensions: ["sus", "susp"],
    },
    "application/vnd.svd": { source: "iana", extensions: ["svd"] },
    "application/vnd.swiftview-ics": { source: "iana" },
    "application/vnd.sycle+xml": { source: "iana", compressible: !0 },
    "application/vnd.syft+json": { source: "iana", compressible: !0 },
    "application/vnd.symbian.install": {
      source: "apache",
      extensions: ["sis", "sisx"],
    },
    "application/vnd.syncml+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
      extensions: ["xsm"],
    },
    "application/vnd.syncml.dm+wbxml": {
      source: "iana",
      charset: "UTF-8",
      extensions: ["bdm"],
    },
    "application/vnd.syncml.dm+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
      extensions: ["xdm"],
    },
    "application/vnd.syncml.dm.notification": { source: "iana" },
    "application/vnd.syncml.dmddf+wbxml": { source: "iana" },
    "application/vnd.syncml.dmddf+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
      extensions: ["ddf"],
    },
    "application/vnd.syncml.dmtnds+wbxml": { source: "iana" },
    "application/vnd.syncml.dmtnds+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
    },
    "application/vnd.syncml.ds.notification": { source: "iana" },
    "application/vnd.tableschema+json": { source: "iana", compressible: !0 },
    "application/vnd.tao.intent-module-archive": {
      source: "iana",
      extensions: ["tao"],
    },
    "application/vnd.tcpdump.pcap": {
      source: "iana",
      extensions: ["pcap", "cap", "dmp"],
    },
    "application/vnd.think-cell.ppttc+json": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.tmd.mediaflex.api+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/vnd.tml": { source: "iana" },
    "application/vnd.tmobile-livetv": { source: "iana", extensions: ["tmo"] },
    "application/vnd.tri.onesource": { source: "iana" },
    "application/vnd.trid.tpt": { source: "iana", extensions: ["tpt"] },
    "application/vnd.triscape.mxs": { source: "iana", extensions: ["mxs"] },
    "application/vnd.trueapp": { source: "iana", extensions: ["tra"] },
    "application/vnd.truedoc": { source: "iana" },
    "application/vnd.ubisoft.webplayer": { source: "iana" },
    "application/vnd.ufdl": { source: "iana", extensions: ["ufd", "ufdl"] },
    "application/vnd.uiq.theme": { source: "iana", extensions: ["utz"] },
    "application/vnd.umajin": { source: "iana", extensions: ["umj"] },
    "application/vnd.unity": { source: "iana", extensions: ["unityweb"] },
    "application/vnd.uoml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["uoml"],
    },
    "application/vnd.uplanet.alert": { source: "iana" },
    "application/vnd.uplanet.alert-wbxml": { source: "iana" },
    "application/vnd.uplanet.bearer-choice": { source: "iana" },
    "application/vnd.uplanet.bearer-choice-wbxml": { source: "iana" },
    "application/vnd.uplanet.cacheop": { source: "iana" },
    "application/vnd.uplanet.cacheop-wbxml": { source: "iana" },
    "application/vnd.uplanet.channel": { source: "iana" },
    "application/vnd.uplanet.channel-wbxml": { source: "iana" },
    "application/vnd.uplanet.list": { source: "iana" },
    "application/vnd.uplanet.list-wbxml": { source: "iana" },
    "application/vnd.uplanet.listcmd": { source: "iana" },
    "application/vnd.uplanet.listcmd-wbxml": { source: "iana" },
    "application/vnd.uplanet.signal": { source: "iana" },
    "application/vnd.uri-map": { source: "iana" },
    "application/vnd.valve.source.material": { source: "iana" },
    "application/vnd.vcx": { source: "iana", extensions: ["vcx"] },
    "application/vnd.vd-study": { source: "iana" },
    "application/vnd.vectorworks": { source: "iana" },
    "application/vnd.vel+json": { source: "iana", compressible: !0 },
    "application/vnd.verimatrix.vcas": { source: "iana" },
    "application/vnd.veritone.aion+json": { source: "iana", compressible: !0 },
    "application/vnd.veryant.thin": { source: "iana" },
    "application/vnd.ves.encrypted": { source: "iana" },
    "application/vnd.vidsoft.vidconference": { source: "iana" },
    "application/vnd.visio": {
      source: "iana",
      extensions: ["vsd", "vst", "vss", "vsw"],
    },
    "application/vnd.visionary": { source: "iana", extensions: ["vis"] },
    "application/vnd.vividence.scriptfile": { source: "iana" },
    "application/vnd.vsf": { source: "iana", extensions: ["vsf"] },
    "application/vnd.wap.sic": { source: "iana" },
    "application/vnd.wap.slc": { source: "iana" },
    "application/vnd.wap.wbxml": {
      source: "iana",
      charset: "UTF-8",
      extensions: ["wbxml"],
    },
    "application/vnd.wap.wmlc": { source: "iana", extensions: ["wmlc"] },
    "application/vnd.wap.wmlscriptc": { source: "iana", extensions: ["wmlsc"] },
    "application/vnd.webturbo": { source: "iana", extensions: ["wtb"] },
    "application/vnd.wfa.dpp": { source: "iana" },
    "application/vnd.wfa.p2p": { source: "iana" },
    "application/vnd.wfa.wsc": { source: "iana" },
    "application/vnd.windows.devicepairing": { source: "iana" },
    "application/vnd.wmc": { source: "iana" },
    "application/vnd.wmf.bootstrap": { source: "iana" },
    "application/vnd.wolfram.mathematica": { source: "iana" },
    "application/vnd.wolfram.mathematica.package": { source: "iana" },
    "application/vnd.wolfram.player": { source: "iana", extensions: ["nbp"] },
    "application/vnd.wordperfect": { source: "iana", extensions: ["wpd"] },
    "application/vnd.wqd": { source: "iana", extensions: ["wqd"] },
    "application/vnd.wrq-hp3000-labelled": { source: "iana" },
    "application/vnd.wt.stf": { source: "iana", extensions: ["stf"] },
    "application/vnd.wv.csp+wbxml": { source: "iana" },
    "application/vnd.wv.csp+xml": { source: "iana", compressible: !0 },
    "application/vnd.wv.ssp+xml": { source: "iana", compressible: !0 },
    "application/vnd.xacml+json": { source: "iana", compressible: !0 },
    "application/vnd.xara": { source: "iana", extensions: ["xar"] },
    "application/vnd.xfdl": { source: "iana", extensions: ["xfdl"] },
    "application/vnd.xfdl.webform": { source: "iana" },
    "application/vnd.xmi+xml": { source: "iana", compressible: !0 },
    "application/vnd.xmpie.cpkg": { source: "iana" },
    "application/vnd.xmpie.dpkg": { source: "iana" },
    "application/vnd.xmpie.plan": { source: "iana" },
    "application/vnd.xmpie.ppkg": { source: "iana" },
    "application/vnd.xmpie.xlim": { source: "iana" },
    "application/vnd.yamaha.hv-dic": { source: "iana", extensions: ["hvd"] },
    "application/vnd.yamaha.hv-script": { source: "iana", extensions: ["hvs"] },
    "application/vnd.yamaha.hv-voice": { source: "iana", extensions: ["hvp"] },
    "application/vnd.yamaha.openscoreformat": {
      source: "iana",
      extensions: ["osf"],
    },
    "application/vnd.yamaha.openscoreformat.osfpvg+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["osfpvg"],
    },
    "application/vnd.yamaha.remote-setup": { source: "iana" },
    "application/vnd.yamaha.smaf-audio": {
      source: "iana",
      extensions: ["saf"],
    },
    "application/vnd.yamaha.smaf-phrase": {
      source: "iana",
      extensions: ["spf"],
    },
    "application/vnd.yamaha.through-ngn": { source: "iana" },
    "application/vnd.yamaha.tunnel-udpencap": { source: "iana" },
    "application/vnd.yaoweme": { source: "iana" },
    "application/vnd.yellowriver-custom-menu": {
      source: "iana",
      extensions: ["cmp"],
    },
    "application/vnd.youtube.yt": { source: "iana" },
    "application/vnd.zul": { source: "iana", extensions: ["zir", "zirz"] },
    "application/vnd.zzazz.deck+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["zaz"],
    },
    "application/voicexml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["vxml"],
    },
    "application/voucher-cms+json": { source: "iana", compressible: !0 },
    "application/vq-rtcpxr": { source: "iana" },
    "application/wasm": {
      source: "iana",
      compressible: !0,
      extensions: ["wasm"],
    },
    "application/watcherinfo+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["wif"],
    },
    "application/webpush-options+json": { source: "iana", compressible: !0 },
    "application/whoispp-query": { source: "iana" },
    "application/whoispp-response": { source: "iana" },
    "application/widget": { source: "iana", extensions: ["wgt"] },
    "application/winhlp": { source: "apache", extensions: ["hlp"] },
    "application/wita": { source: "iana" },
    "application/wordperfect5.1": { source: "iana" },
    "application/wsdl+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["wsdl"],
    },
    "application/wspolicy+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["wspolicy"],
    },
    "application/x-7z-compressed": {
      source: "apache",
      compressible: !1,
      extensions: ["7z"],
    },
    "application/x-abiword": { source: "apache", extensions: ["abw"] },
    "application/x-ace-compressed": { source: "apache", extensions: ["ace"] },
    "application/x-amf": { source: "apache" },
    "application/x-apple-diskimage": { source: "apache", extensions: ["dmg"] },
    "application/x-arj": { compressible: !1, extensions: ["arj"] },
    "application/x-authorware-bin": {
      source: "apache",
      extensions: ["aab", "x32", "u32", "vox"],
    },
    "application/x-authorware-map": { source: "apache", extensions: ["aam"] },
    "application/x-authorware-seg": { source: "apache", extensions: ["aas"] },
    "application/x-bcpio": { source: "apache", extensions: ["bcpio"] },
    "application/x-bdoc": { compressible: !1, extensions: ["bdoc"] },
    "application/x-bittorrent": { source: "apache", extensions: ["torrent"] },
    "application/x-blorb": { source: "apache", extensions: ["blb", "blorb"] },
    "application/x-bzip": {
      source: "apache",
      compressible: !1,
      extensions: ["bz"],
    },
    "application/x-bzip2": {
      source: "apache",
      compressible: !1,
      extensions: ["bz2", "boz"],
    },
    "application/x-cbr": {
      source: "apache",
      extensions: ["cbr", "cba", "cbt", "cbz", "cb7"],
    },
    "application/x-cdlink": { source: "apache", extensions: ["vcd"] },
    "application/x-cfs-compressed": { source: "apache", extensions: ["cfs"] },
    "application/x-chat": { source: "apache", extensions: ["chat"] },
    "application/x-chess-pgn": { source: "apache", extensions: ["pgn"] },
    "application/x-chrome-extension": { extensions: ["crx"] },
    "application/x-cocoa": { source: "nginx", extensions: ["cco"] },
    "application/x-compress": { source: "apache" },
    "application/x-conference": { source: "apache", extensions: ["nsc"] },
    "application/x-cpio": { source: "apache", extensions: ["cpio"] },
    "application/x-csh": { source: "apache", extensions: ["csh"] },
    "application/x-deb": { compressible: !1 },
    "application/x-debian-package": {
      source: "apache",
      extensions: ["deb", "udeb"],
    },
    "application/x-dgc-compressed": { source: "apache", extensions: ["dgc"] },
    "application/x-director": {
      source: "apache",
      extensions: [
        "dir",
        "dcr",
        "dxr",
        "cst",
        "cct",
        "cxt",
        "w3d",
        "fgd",
        "swa",
      ],
    },
    "application/x-doom": { source: "apache", extensions: ["wad"] },
    "application/x-dtbncx+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["ncx"],
    },
    "application/x-dtbook+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["dtb"],
    },
    "application/x-dtbresource+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["res"],
    },
    "application/x-dvi": {
      source: "apache",
      compressible: !1,
      extensions: ["dvi"],
    },
    "application/x-envoy": { source: "apache", extensions: ["evy"] },
    "application/x-eva": { source: "apache", extensions: ["eva"] },
    "application/x-font-bdf": { source: "apache", extensions: ["bdf"] },
    "application/x-font-dos": { source: "apache" },
    "application/x-font-framemaker": { source: "apache" },
    "application/x-font-ghostscript": { source: "apache", extensions: ["gsf"] },
    "application/x-font-libgrx": { source: "apache" },
    "application/x-font-linux-psf": { source: "apache", extensions: ["psf"] },
    "application/x-font-pcf": { source: "apache", extensions: ["pcf"] },
    "application/x-font-snf": { source: "apache", extensions: ["snf"] },
    "application/x-font-speedo": { source: "apache" },
    "application/x-font-sunos-news": { source: "apache" },
    "application/x-font-type1": {
      source: "apache",
      extensions: ["pfa", "pfb", "pfm", "afm"],
    },
    "application/x-font-vfont": { source: "apache" },
    "application/x-freearc": { source: "apache", extensions: ["arc"] },
    "application/x-futuresplash": { source: "apache", extensions: ["spl"] },
    "application/x-gca-compressed": { source: "apache", extensions: ["gca"] },
    "application/x-glulx": { source: "apache", extensions: ["ulx"] },
    "application/x-gnumeric": { source: "apache", extensions: ["gnumeric"] },
    "application/x-gramps-xml": { source: "apache", extensions: ["gramps"] },
    "application/x-gtar": { source: "apache", extensions: ["gtar"] },
    "application/x-gzip": { source: "apache" },
    "application/x-hdf": { source: "apache", extensions: ["hdf"] },
    "application/x-httpd-php": { compressible: !0, extensions: ["php"] },
    "application/x-install-instructions": {
      source: "apache",
      extensions: ["install"],
    },
    "application/x-iso9660-image": { source: "apache", extensions: ["iso"] },
    "application/x-iwork-keynote-sffkey": { extensions: ["key"] },
    "application/x-iwork-numbers-sffnumbers": { extensions: ["numbers"] },
    "application/x-iwork-pages-sffpages": { extensions: ["pages"] },
    "application/x-java-archive-diff": {
      source: "nginx",
      extensions: ["jardiff"],
    },
    "application/x-java-jnlp-file": {
      source: "apache",
      compressible: !1,
      extensions: ["jnlp"],
    },
    "application/x-javascript": { compressible: !0 },
    "application/x-keepass2": { extensions: ["kdbx"] },
    "application/x-latex": {
      source: "apache",
      compressible: !1,
      extensions: ["latex"],
    },
    "application/x-lua-bytecode": { extensions: ["luac"] },
    "application/x-lzh-compressed": {
      source: "apache",
      extensions: ["lzh", "lha"],
    },
    "application/x-makeself": { source: "nginx", extensions: ["run"] },
    "application/x-mie": { source: "apache", extensions: ["mie"] },
    "application/x-mobipocket-ebook": {
      source: "apache",
      extensions: ["prc", "mobi"],
    },
    "application/x-mpegurl": { compressible: !1 },
    "application/x-ms-application": {
      source: "apache",
      extensions: ["application"],
    },
    "application/x-ms-shortcut": { source: "apache", extensions: ["lnk"] },
    "application/x-ms-wmd": { source: "apache", extensions: ["wmd"] },
    "application/x-ms-wmz": { source: "apache", extensions: ["wmz"] },
    "application/x-ms-xbap": { source: "apache", extensions: ["xbap"] },
    "application/x-msaccess": { source: "apache", extensions: ["mdb"] },
    "application/x-msbinder": { source: "apache", extensions: ["obd"] },
    "application/x-mscardfile": { source: "apache", extensions: ["crd"] },
    "application/x-msclip": { source: "apache", extensions: ["clp"] },
    "application/x-msdos-program": { extensions: ["exe"] },
    "application/x-msdownload": {
      source: "apache",
      extensions: ["exe", "dll", "com", "bat", "msi"],
    },
    "application/x-msmediaview": {
      source: "apache",
      extensions: ["mvb", "m13", "m14"],
    },
    "application/x-msmetafile": {
      source: "apache",
      extensions: ["wmf", "wmz", "emf", "emz"],
    },
    "application/x-msmoney": { source: "apache", extensions: ["mny"] },
    "application/x-mspublisher": { source: "apache", extensions: ["pub"] },
    "application/x-msschedule": { source: "apache", extensions: ["scd"] },
    "application/x-msterminal": { source: "apache", extensions: ["trm"] },
    "application/x-mswrite": { source: "apache", extensions: ["wri"] },
    "application/x-netcdf": { source: "apache", extensions: ["nc", "cdf"] },
    "application/x-ns-proxy-autoconfig": {
      compressible: !0,
      extensions: ["pac"],
    },
    "application/x-nzb": { source: "apache", extensions: ["nzb"] },
    "application/x-perl": { source: "nginx", extensions: ["pl", "pm"] },
    "application/x-pilot": { source: "nginx", extensions: ["prc", "pdb"] },
    "application/x-pkcs12": {
      source: "apache",
      compressible: !1,
      extensions: ["p12", "pfx"],
    },
    "application/x-pkcs7-certificates": {
      source: "apache",
      extensions: ["p7b", "spc"],
    },
    "application/x-pkcs7-certreqresp": {
      source: "apache",
      extensions: ["p7r"],
    },
    "application/x-pki-message": { source: "iana" },
    "application/x-rar-compressed": {
      source: "apache",
      compressible: !1,
      extensions: ["rar"],
    },
    "application/x-redhat-package-manager": {
      source: "nginx",
      extensions: ["rpm"],
    },
    "application/x-research-info-systems": {
      source: "apache",
      extensions: ["ris"],
    },
    "application/x-sea": { source: "nginx", extensions: ["sea"] },
    "application/x-sh": {
      source: "apache",
      compressible: !0,
      extensions: ["sh"],
    },
    "application/x-shar": { source: "apache", extensions: ["shar"] },
    "application/x-shockwave-flash": {
      source: "apache",
      compressible: !1,
      extensions: ["swf"],
    },
    "application/x-silverlight-app": { source: "apache", extensions: ["xap"] },
    "application/x-sql": { source: "apache", extensions: ["sql"] },
    "application/x-stuffit": {
      source: "apache",
      compressible: !1,
      extensions: ["sit"],
    },
    "application/x-stuffitx": { source: "apache", extensions: ["sitx"] },
    "application/x-subrip": { source: "apache", extensions: ["srt"] },
    "application/x-sv4cpio": { source: "apache", extensions: ["sv4cpio"] },
    "application/x-sv4crc": { source: "apache", extensions: ["sv4crc"] },
    "application/x-t3vm-image": { source: "apache", extensions: ["t3"] },
    "application/x-tads": { source: "apache", extensions: ["gam"] },
    "application/x-tar": {
      source: "apache",
      compressible: !0,
      extensions: ["tar"],
    },
    "application/x-tcl": { source: "apache", extensions: ["tcl", "tk"] },
    "application/x-tex": { source: "apache", extensions: ["tex"] },
    "application/x-tex-tfm": { source: "apache", extensions: ["tfm"] },
    "application/x-texinfo": {
      source: "apache",
      extensions: ["texinfo", "texi"],
    },
    "application/x-tgif": { source: "apache", extensions: ["obj"] },
    "application/x-ustar": { source: "apache", extensions: ["ustar"] },
    "application/x-virtualbox-hdd": { compressible: !0, extensions: ["hdd"] },
    "application/x-virtualbox-ova": { compressible: !0, extensions: ["ova"] },
    "application/x-virtualbox-ovf": { compressible: !0, extensions: ["ovf"] },
    "application/x-virtualbox-vbox": { compressible: !0, extensions: ["vbox"] },
    "application/x-virtualbox-vbox-extpack": {
      compressible: !1,
      extensions: ["vbox-extpack"],
    },
    "application/x-virtualbox-vdi": { compressible: !0, extensions: ["vdi"] },
    "application/x-virtualbox-vhd": { compressible: !0, extensions: ["vhd"] },
    "application/x-virtualbox-vmdk": { compressible: !0, extensions: ["vmdk"] },
    "application/x-wais-source": { source: "apache", extensions: ["src"] },
    "application/x-web-app-manifest+json": {
      compressible: !0,
      extensions: ["webapp"],
    },
    "application/x-www-form-urlencoded": { source: "iana", compressible: !0 },
    "application/x-x509-ca-cert": {
      source: "iana",
      extensions: ["der", "crt", "pem"],
    },
    "application/x-x509-ca-ra-cert": { source: "iana" },
    "application/x-x509-next-ca-cert": { source: "iana" },
    "application/x-xfig": { source: "apache", extensions: ["fig"] },
    "application/x-xliff+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["xlf"],
    },
    "application/x-xpinstall": {
      source: "apache",
      compressible: !1,
      extensions: ["xpi"],
    },
    "application/x-xz": { source: "apache", extensions: ["xz"] },
    "application/x-zmachine": {
      source: "apache",
      extensions: ["z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8"],
    },
    "application/x400-bp": { source: "iana" },
    "application/xacml+xml": { source: "iana", compressible: !0 },
    "application/xaml+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["xaml"],
    },
    "application/xcap-att+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xav"],
    },
    "application/xcap-caps+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xca"],
    },
    "application/xcap-diff+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xdf"],
    },
    "application/xcap-el+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xel"],
    },
    "application/xcap-error+xml": { source: "iana", compressible: !0 },
    "application/xcap-ns+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xns"],
    },
    "application/xcon-conference-info+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/xcon-conference-info-diff+xml": {
      source: "iana",
      compressible: !0,
    },
    "application/xenc+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xenc"],
    },
    "application/xhtml+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xhtml", "xht"],
    },
    "application/xhtml-voice+xml": { source: "apache", compressible: !0 },
    "application/xliff+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xlf"],
    },
    "application/xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xml", "xsl", "xsd", "rng"],
    },
    "application/xml-dtd": {
      source: "iana",
      compressible: !0,
      extensions: ["dtd"],
    },
    "application/xml-external-parsed-entity": { source: "iana" },
    "application/xml-patch+xml": { source: "iana", compressible: !0 },
    "application/xmpp+xml": { source: "iana", compressible: !0 },
    "application/xop+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xop"],
    },
    "application/xproc+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["xpl"],
    },
    "application/xslt+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["xsl", "xslt"],
    },
    "application/xspf+xml": {
      source: "apache",
      compressible: !0,
      extensions: ["xspf"],
    },
    "application/xv+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["mxml", "xhvml", "xvml", "xvm"],
    },
    "application/yang": { source: "iana", extensions: ["yang"] },
    "application/yang-data+json": { source: "iana", compressible: !0 },
    "application/yang-data+xml": { source: "iana", compressible: !0 },
    "application/yang-patch+json": { source: "iana", compressible: !0 },
    "application/yang-patch+xml": { source: "iana", compressible: !0 },
    "application/yin+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["yin"],
    },
    "application/zip": {
      source: "iana",
      compressible: !1,
      extensions: ["zip"],
    },
    "application/zlib": { source: "iana" },
    "application/zstd": { source: "iana" },
    "audio/1d-interleaved-parityfec": { source: "iana" },
    "audio/32kadpcm": { source: "iana" },
    "audio/3gpp": { source: "iana", compressible: !1, extensions: ["3gpp"] },
    "audio/3gpp2": { source: "iana" },
    "audio/aac": { source: "iana" },
    "audio/ac3": { source: "iana" },
    "audio/adpcm": { source: "apache", extensions: ["adp"] },
    "audio/amr": { source: "iana", extensions: ["amr"] },
    "audio/amr-wb": { source: "iana" },
    "audio/amr-wb+": { source: "iana" },
    "audio/aptx": { source: "iana" },
    "audio/asc": { source: "iana" },
    "audio/atrac-advanced-lossless": { source: "iana" },
    "audio/atrac-x": { source: "iana" },
    "audio/atrac3": { source: "iana" },
    "audio/basic": {
      source: "iana",
      compressible: !1,
      extensions: ["au", "snd"],
    },
    "audio/bv16": { source: "iana" },
    "audio/bv32": { source: "iana" },
    "audio/clearmode": { source: "iana" },
    "audio/cn": { source: "iana" },
    "audio/dat12": { source: "iana" },
    "audio/dls": { source: "iana" },
    "audio/dsr-es201108": { source: "iana" },
    "audio/dsr-es202050": { source: "iana" },
    "audio/dsr-es202211": { source: "iana" },
    "audio/dsr-es202212": { source: "iana" },
    "audio/dv": { source: "iana" },
    "audio/dvi4": { source: "iana" },
    "audio/eac3": { source: "iana" },
    "audio/encaprtp": { source: "iana" },
    "audio/evrc": { source: "iana" },
    "audio/evrc-qcp": { source: "iana" },
    "audio/evrc0": { source: "iana" },
    "audio/evrc1": { source: "iana" },
    "audio/evrcb": { source: "iana" },
    "audio/evrcb0": { source: "iana" },
    "audio/evrcb1": { source: "iana" },
    "audio/evrcnw": { source: "iana" },
    "audio/evrcnw0": { source: "iana" },
    "audio/evrcnw1": { source: "iana" },
    "audio/evrcwb": { source: "iana" },
    "audio/evrcwb0": { source: "iana" },
    "audio/evrcwb1": { source: "iana" },
    "audio/evs": { source: "iana" },
    "audio/flexfec": { source: "iana" },
    "audio/fwdred": { source: "iana" },
    "audio/g711-0": { source: "iana" },
    "audio/g719": { source: "iana" },
    "audio/g722": { source: "iana" },
    "audio/g7221": { source: "iana" },
    "audio/g723": { source: "iana" },
    "audio/g726-16": { source: "iana" },
    "audio/g726-24": { source: "iana" },
    "audio/g726-32": { source: "iana" },
    "audio/g726-40": { source: "iana" },
    "audio/g728": { source: "iana" },
    "audio/g729": { source: "iana" },
    "audio/g7291": { source: "iana" },
    "audio/g729d": { source: "iana" },
    "audio/g729e": { source: "iana" },
    "audio/gsm": { source: "iana" },
    "audio/gsm-efr": { source: "iana" },
    "audio/gsm-hr-08": { source: "iana" },
    "audio/ilbc": { source: "iana" },
    "audio/ip-mr_v2.5": { source: "iana" },
    "audio/isac": { source: "apache" },
    "audio/l16": { source: "iana" },
    "audio/l20": { source: "iana" },
    "audio/l24": { source: "iana", compressible: !1 },
    "audio/l8": { source: "iana" },
    "audio/lpc": { source: "iana" },
    "audio/melp": { source: "iana" },
    "audio/melp1200": { source: "iana" },
    "audio/melp2400": { source: "iana" },
    "audio/melp600": { source: "iana" },
    "audio/mhas": { source: "iana" },
    "audio/midi": {
      source: "apache",
      extensions: ["mid", "midi", "kar", "rmi"],
    },
    "audio/mobile-xmf": { source: "iana", extensions: ["mxmf"] },
    "audio/mp3": { compressible: !1, extensions: ["mp3"] },
    "audio/mp4": {
      source: "iana",
      compressible: !1,
      extensions: ["m4a", "mp4a"],
    },
    "audio/mp4a-latm": { source: "iana" },
    "audio/mpa": { source: "iana" },
    "audio/mpa-robust": { source: "iana" },
    "audio/mpeg": {
      source: "iana",
      compressible: !1,
      extensions: ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"],
    },
    "audio/mpeg4-generic": { source: "iana" },
    "audio/musepack": { source: "apache" },
    "audio/ogg": {
      source: "iana",
      compressible: !1,
      extensions: ["oga", "ogg", "spx", "opus"],
    },
    "audio/opus": { source: "iana" },
    "audio/parityfec": { source: "iana" },
    "audio/pcma": { source: "iana" },
    "audio/pcma-wb": { source: "iana" },
    "audio/pcmu": { source: "iana" },
    "audio/pcmu-wb": { source: "iana" },
    "audio/prs.sid": { source: "iana" },
    "audio/qcelp": { source: "iana" },
    "audio/raptorfec": { source: "iana" },
    "audio/red": { source: "iana" },
    "audio/rtp-enc-aescm128": { source: "iana" },
    "audio/rtp-midi": { source: "iana" },
    "audio/rtploopback": { source: "iana" },
    "audio/rtx": { source: "iana" },
    "audio/s3m": { source: "apache", extensions: ["s3m"] },
    "audio/scip": { source: "iana" },
    "audio/silk": { source: "apache", extensions: ["sil"] },
    "audio/smv": { source: "iana" },
    "audio/smv-qcp": { source: "iana" },
    "audio/smv0": { source: "iana" },
    "audio/sofa": { source: "iana" },
    "audio/sp-midi": { source: "iana" },
    "audio/speex": { source: "iana" },
    "audio/t140c": { source: "iana" },
    "audio/t38": { source: "iana" },
    "audio/telephone-event": { source: "iana" },
    "audio/tetra_acelp": { source: "iana" },
    "audio/tetra_acelp_bb": { source: "iana" },
    "audio/tone": { source: "iana" },
    "audio/tsvcis": { source: "iana" },
    "audio/uemclip": { source: "iana" },
    "audio/ulpfec": { source: "iana" },
    "audio/usac": { source: "iana" },
    "audio/vdvi": { source: "iana" },
    "audio/vmr-wb": { source: "iana" },
    "audio/vnd.3gpp.iufp": { source: "iana" },
    "audio/vnd.4sb": { source: "iana" },
    "audio/vnd.audiokoz": { source: "iana" },
    "audio/vnd.celp": { source: "iana" },
    "audio/vnd.cisco.nse": { source: "iana" },
    "audio/vnd.cmles.radio-events": { source: "iana" },
    "audio/vnd.cns.anp1": { source: "iana" },
    "audio/vnd.cns.inf1": { source: "iana" },
    "audio/vnd.dece.audio": { source: "iana", extensions: ["uva", "uvva"] },
    "audio/vnd.digital-winds": { source: "iana", extensions: ["eol"] },
    "audio/vnd.dlna.adts": { source: "iana" },
    "audio/vnd.dolby.heaac.1": { source: "iana" },
    "audio/vnd.dolby.heaac.2": { source: "iana" },
    "audio/vnd.dolby.mlp": { source: "iana" },
    "audio/vnd.dolby.mps": { source: "iana" },
    "audio/vnd.dolby.pl2": { source: "iana" },
    "audio/vnd.dolby.pl2x": { source: "iana" },
    "audio/vnd.dolby.pl2z": { source: "iana" },
    "audio/vnd.dolby.pulse.1": { source: "iana" },
    "audio/vnd.dra": { source: "iana", extensions: ["dra"] },
    "audio/vnd.dts": { source: "iana", extensions: ["dts"] },
    "audio/vnd.dts.hd": { source: "iana", extensions: ["dtshd"] },
    "audio/vnd.dts.uhd": { source: "iana" },
    "audio/vnd.dvb.file": { source: "iana" },
    "audio/vnd.everad.plj": { source: "iana" },
    "audio/vnd.hns.audio": { source: "iana" },
    "audio/vnd.lucent.voice": { source: "iana", extensions: ["lvp"] },
    "audio/vnd.ms-playready.media.pya": { source: "iana", extensions: ["pya"] },
    "audio/vnd.nokia.mobile-xmf": { source: "iana" },
    "audio/vnd.nortel.vbk": { source: "iana" },
    "audio/vnd.nuera.ecelp4800": { source: "iana", extensions: ["ecelp4800"] },
    "audio/vnd.nuera.ecelp7470": { source: "iana", extensions: ["ecelp7470"] },
    "audio/vnd.nuera.ecelp9600": { source: "iana", extensions: ["ecelp9600"] },
    "audio/vnd.octel.sbc": { source: "iana" },
    "audio/vnd.presonus.multitrack": { source: "iana" },
    "audio/vnd.qcelp": { source: "iana" },
    "audio/vnd.rhetorex.32kadpcm": { source: "iana" },
    "audio/vnd.rip": { source: "iana", extensions: ["rip"] },
    "audio/vnd.rn-realaudio": { compressible: !1 },
    "audio/vnd.sealedmedia.softseal.mpeg": { source: "iana" },
    "audio/vnd.vmx.cvsd": { source: "iana" },
    "audio/vnd.wave": { compressible: !1 },
    "audio/vorbis": { source: "iana", compressible: !1 },
    "audio/vorbis-config": { source: "iana" },
    "audio/wav": { compressible: !1, extensions: ["wav"] },
    "audio/wave": { compressible: !1, extensions: ["wav"] },
    "audio/webm": { source: "apache", compressible: !1, extensions: ["weba"] },
    "audio/x-aac": { source: "apache", compressible: !1, extensions: ["aac"] },
    "audio/x-aiff": { source: "apache", extensions: ["aif", "aiff", "aifc"] },
    "audio/x-caf": { source: "apache", compressible: !1, extensions: ["caf"] },
    "audio/x-flac": { source: "apache", extensions: ["flac"] },
    "audio/x-m4a": { source: "nginx", extensions: ["m4a"] },
    "audio/x-matroska": { source: "apache", extensions: ["mka"] },
    "audio/x-mpegurl": { source: "apache", extensions: ["m3u"] },
    "audio/x-ms-wax": { source: "apache", extensions: ["wax"] },
    "audio/x-ms-wma": { source: "apache", extensions: ["wma"] },
    "audio/x-pn-realaudio": { source: "apache", extensions: ["ram", "ra"] },
    "audio/x-pn-realaudio-plugin": { source: "apache", extensions: ["rmp"] },
    "audio/x-realaudio": { source: "nginx", extensions: ["ra"] },
    "audio/x-tta": { source: "apache" },
    "audio/x-wav": { source: "apache", extensions: ["wav"] },
    "audio/xm": { source: "apache", extensions: ["xm"] },
    "chemical/x-cdx": { source: "apache", extensions: ["cdx"] },
    "chemical/x-cif": { source: "apache", extensions: ["cif"] },
    "chemical/x-cmdf": { source: "apache", extensions: ["cmdf"] },
    "chemical/x-cml": { source: "apache", extensions: ["cml"] },
    "chemical/x-csml": { source: "apache", extensions: ["csml"] },
    "chemical/x-pdb": { source: "apache" },
    "chemical/x-xyz": { source: "apache", extensions: ["xyz"] },
    "font/collection": { source: "iana", extensions: ["ttc"] },
    "font/otf": { source: "iana", compressible: !0, extensions: ["otf"] },
    "font/sfnt": { source: "iana" },
    "font/ttf": { source: "iana", compressible: !0, extensions: ["ttf"] },
    "font/woff": { source: "iana", extensions: ["woff"] },
    "font/woff2": { source: "iana", extensions: ["woff2"] },
    "image/aces": { source: "iana", extensions: ["exr"] },
    "image/apng": { compressible: !1, extensions: ["apng"] },
    "image/avci": { source: "iana", extensions: ["avci"] },
    "image/avcs": { source: "iana", extensions: ["avcs"] },
    "image/avif": { source: "iana", compressible: !1, extensions: ["avif"] },
    "image/bmp": { source: "iana", compressible: !0, extensions: ["bmp"] },
    "image/cgm": { source: "iana", extensions: ["cgm"] },
    "image/dicom-rle": { source: "iana", extensions: ["drle"] },
    "image/emf": { source: "iana", extensions: ["emf"] },
    "image/fits": { source: "iana", extensions: ["fits"] },
    "image/g3fax": { source: "iana", extensions: ["g3"] },
    "image/gif": { source: "iana", compressible: !1, extensions: ["gif"] },
    "image/heic": { source: "iana", extensions: ["heic"] },
    "image/heic-sequence": { source: "iana", extensions: ["heics"] },
    "image/heif": { source: "iana", extensions: ["heif"] },
    "image/heif-sequence": { source: "iana", extensions: ["heifs"] },
    "image/hej2k": { source: "iana", extensions: ["hej2"] },
    "image/hsj2": { source: "iana", extensions: ["hsj2"] },
    "image/ief": { source: "iana", extensions: ["ief"] },
    "image/jls": { source: "iana", extensions: ["jls"] },
    "image/jp2": {
      source: "iana",
      compressible: !1,
      extensions: ["jp2", "jpg2"],
    },
    "image/jpeg": {
      source: "iana",
      compressible: !1,
      extensions: ["jpeg", "jpg", "jpe"],
    },
    "image/jph": { source: "iana", extensions: ["jph"] },
    "image/jphc": { source: "iana", extensions: ["jhc"] },
    "image/jpm": { source: "iana", compressible: !1, extensions: ["jpm"] },
    "image/jpx": {
      source: "iana",
      compressible: !1,
      extensions: ["jpx", "jpf"],
    },
    "image/jxr": { source: "iana", extensions: ["jxr"] },
    "image/jxra": { source: "iana", extensions: ["jxra"] },
    "image/jxrs": { source: "iana", extensions: ["jxrs"] },
    "image/jxs": { source: "iana", extensions: ["jxs"] },
    "image/jxsc": { source: "iana", extensions: ["jxsc"] },
    "image/jxsi": { source: "iana", extensions: ["jxsi"] },
    "image/jxss": { source: "iana", extensions: ["jxss"] },
    "image/ktx": { source: "iana", extensions: ["ktx"] },
    "image/ktx2": { source: "iana", extensions: ["ktx2"] },
    "image/naplps": { source: "iana" },
    "image/pjpeg": { compressible: !1 },
    "image/png": { source: "iana", compressible: !1, extensions: ["png"] },
    "image/prs.btif": { source: "iana", extensions: ["btif"] },
    "image/prs.pti": { source: "iana", extensions: ["pti"] },
    "image/pwg-raster": { source: "iana" },
    "image/sgi": { source: "apache", extensions: ["sgi"] },
    "image/svg+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["svg", "svgz"],
    },
    "image/t38": { source: "iana", extensions: ["t38"] },
    "image/tiff": {
      source: "iana",
      compressible: !1,
      extensions: ["tif", "tiff"],
    },
    "image/tiff-fx": { source: "iana", extensions: ["tfx"] },
    "image/vnd.adobe.photoshop": {
      source: "iana",
      compressible: !0,
      extensions: ["psd"],
    },
    "image/vnd.airzip.accelerator.azv": { source: "iana", extensions: ["azv"] },
    "image/vnd.cns.inf2": { source: "iana" },
    "image/vnd.dece.graphic": {
      source: "iana",
      extensions: ["uvi", "uvvi", "uvg", "uvvg"],
    },
    "image/vnd.djvu": { source: "iana", extensions: ["djvu", "djv"] },
    "image/vnd.dvb.subtitle": { source: "iana", extensions: ["sub"] },
    "image/vnd.dwg": { source: "iana", extensions: ["dwg"] },
    "image/vnd.dxf": { source: "iana", extensions: ["dxf"] },
    "image/vnd.fastbidsheet": { source: "iana", extensions: ["fbs"] },
    "image/vnd.fpx": { source: "iana", extensions: ["fpx"] },
    "image/vnd.fst": { source: "iana", extensions: ["fst"] },
    "image/vnd.fujixerox.edmics-mmr": { source: "iana", extensions: ["mmr"] },
    "image/vnd.fujixerox.edmics-rlc": { source: "iana", extensions: ["rlc"] },
    "image/vnd.globalgraphics.pgb": { source: "iana" },
    "image/vnd.microsoft.icon": {
      source: "iana",
      compressible: !0,
      extensions: ["ico"],
    },
    "image/vnd.mix": { source: "iana" },
    "image/vnd.mozilla.apng": { source: "iana" },
    "image/vnd.ms-dds": { compressible: !0, extensions: ["dds"] },
    "image/vnd.ms-modi": { source: "iana", extensions: ["mdi"] },
    "image/vnd.ms-photo": { source: "apache", extensions: ["wdp"] },
    "image/vnd.net-fpx": { source: "iana", extensions: ["npx"] },
    "image/vnd.pco.b16": { source: "iana", extensions: ["b16"] },
    "image/vnd.radiance": { source: "iana" },
    "image/vnd.sealed.png": { source: "iana" },
    "image/vnd.sealedmedia.softseal.gif": { source: "iana" },
    "image/vnd.sealedmedia.softseal.jpg": { source: "iana" },
    "image/vnd.svf": { source: "iana" },
    "image/vnd.tencent.tap": { source: "iana", extensions: ["tap"] },
    "image/vnd.valve.source.texture": { source: "iana", extensions: ["vtf"] },
    "image/vnd.wap.wbmp": { source: "iana", extensions: ["wbmp"] },
    "image/vnd.xiff": { source: "iana", extensions: ["xif"] },
    "image/vnd.zbrush.pcx": { source: "iana", extensions: ["pcx"] },
    "image/webp": { source: "apache", extensions: ["webp"] },
    "image/wmf": { source: "iana", extensions: ["wmf"] },
    "image/x-3ds": { source: "apache", extensions: ["3ds"] },
    "image/x-cmu-raster": { source: "apache", extensions: ["ras"] },
    "image/x-cmx": { source: "apache", extensions: ["cmx"] },
    "image/x-freehand": {
      source: "apache",
      extensions: ["fh", "fhc", "fh4", "fh5", "fh7"],
    },
    "image/x-icon": { source: "apache", compressible: !0, extensions: ["ico"] },
    "image/x-jng": { source: "nginx", extensions: ["jng"] },
    "image/x-mrsid-image": { source: "apache", extensions: ["sid"] },
    "image/x-ms-bmp": {
      source: "nginx",
      compressible: !0,
      extensions: ["bmp"],
    },
    "image/x-pcx": { source: "apache", extensions: ["pcx"] },
    "image/x-pict": { source: "apache", extensions: ["pic", "pct"] },
    "image/x-portable-anymap": { source: "apache", extensions: ["pnm"] },
    "image/x-portable-bitmap": { source: "apache", extensions: ["pbm"] },
    "image/x-portable-graymap": { source: "apache", extensions: ["pgm"] },
    "image/x-portable-pixmap": { source: "apache", extensions: ["ppm"] },
    "image/x-rgb": { source: "apache", extensions: ["rgb"] },
    "image/x-tga": { source: "apache", extensions: ["tga"] },
    "image/x-xbitmap": { source: "apache", extensions: ["xbm"] },
    "image/x-xcf": { compressible: !1 },
    "image/x-xpixmap": { source: "apache", extensions: ["xpm"] },
    "image/x-xwindowdump": { source: "apache", extensions: ["xwd"] },
    "message/cpim": { source: "iana" },
    "message/delivery-status": { source: "iana" },
    "message/disposition-notification": {
      source: "iana",
      extensions: ["disposition-notification"],
    },
    "message/external-body": { source: "iana" },
    "message/feedback-report": { source: "iana" },
    "message/global": { source: "iana", extensions: ["u8msg"] },
    "message/global-delivery-status": { source: "iana", extensions: ["u8dsn"] },
    "message/global-disposition-notification": {
      source: "iana",
      extensions: ["u8mdn"],
    },
    "message/global-headers": { source: "iana", extensions: ["u8hdr"] },
    "message/http": { source: "iana", compressible: !1 },
    "message/imdn+xml": { source: "iana", compressible: !0 },
    "message/news": { source: "iana" },
    "message/partial": { source: "iana", compressible: !1 },
    "message/rfc822": {
      source: "iana",
      compressible: !0,
      extensions: ["eml", "mime"],
    },
    "message/s-http": { source: "iana" },
    "message/sip": { source: "iana" },
    "message/sipfrag": { source: "iana" },
    "message/tracking-status": { source: "iana" },
    "message/vnd.si.simp": { source: "iana" },
    "message/vnd.wfa.wsc": { source: "iana", extensions: ["wsc"] },
    "model/3mf": { source: "iana", extensions: ["3mf"] },
    "model/e57": { source: "iana" },
    "model/gltf+json": {
      source: "iana",
      compressible: !0,
      extensions: ["gltf"],
    },
    "model/gltf-binary": {
      source: "iana",
      compressible: !0,
      extensions: ["glb"],
    },
    "model/iges": {
      source: "iana",
      compressible: !1,
      extensions: ["igs", "iges"],
    },
    "model/mesh": {
      source: "iana",
      compressible: !1,
      extensions: ["msh", "mesh", "silo"],
    },
    "model/mtl": { source: "iana", extensions: ["mtl"] },
    "model/obj": { source: "iana", extensions: ["obj"] },
    "model/step": { source: "iana" },
    "model/step+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["stpx"],
    },
    "model/step+zip": {
      source: "iana",
      compressible: !1,
      extensions: ["stpz"],
    },
    "model/step-xml+zip": {
      source: "iana",
      compressible: !1,
      extensions: ["stpxz"],
    },
    "model/stl": { source: "iana", extensions: ["stl"] },
    "model/vnd.collada+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["dae"],
    },
    "model/vnd.dwf": { source: "iana", extensions: ["dwf"] },
    "model/vnd.flatland.3dml": { source: "iana" },
    "model/vnd.gdl": { source: "iana", extensions: ["gdl"] },
    "model/vnd.gs-gdl": { source: "apache" },
    "model/vnd.gs.gdl": { source: "iana" },
    "model/vnd.gtw": { source: "iana", extensions: ["gtw"] },
    "model/vnd.moml+xml": { source: "iana", compressible: !0 },
    "model/vnd.mts": { source: "iana", extensions: ["mts"] },
    "model/vnd.opengex": { source: "iana", extensions: ["ogex"] },
    "model/vnd.parasolid.transmit.binary": {
      source: "iana",
      extensions: ["x_b"],
    },
    "model/vnd.parasolid.transmit.text": {
      source: "iana",
      extensions: ["x_t"],
    },
    "model/vnd.pytha.pyox": { source: "iana" },
    "model/vnd.rosette.annotated-data-model": { source: "iana" },
    "model/vnd.sap.vds": { source: "iana", extensions: ["vds"] },
    "model/vnd.usdz+zip": {
      source: "iana",
      compressible: !1,
      extensions: ["usdz"],
    },
    "model/vnd.valve.source.compiled-map": {
      source: "iana",
      extensions: ["bsp"],
    },
    "model/vnd.vtu": { source: "iana", extensions: ["vtu"] },
    "model/vrml": {
      source: "iana",
      compressible: !1,
      extensions: ["wrl", "vrml"],
    },
    "model/x3d+binary": {
      source: "apache",
      compressible: !1,
      extensions: ["x3db", "x3dbz"],
    },
    "model/x3d+fastinfoset": { source: "iana", extensions: ["x3db"] },
    "model/x3d+vrml": {
      source: "apache",
      compressible: !1,
      extensions: ["x3dv", "x3dvz"],
    },
    "model/x3d+xml": {
      source: "iana",
      compressible: !0,
      extensions: ["x3d", "x3dz"],
    },
    "model/x3d-vrml": { source: "iana", extensions: ["x3dv"] },
    "multipart/alternative": { source: "iana", compressible: !1 },
    "multipart/appledouble": { source: "iana" },
    "multipart/byteranges": { source: "iana" },
    "multipart/digest": { source: "iana" },
    "multipart/encrypted": { source: "iana", compressible: !1 },
    "multipart/form-data": { source: "iana", compressible: !1 },
    "multipart/header-set": { source: "iana" },
    "multipart/mixed": { source: "iana" },
    "multipart/multilingual": { source: "iana" },
    "multipart/parallel": { source: "iana" },
    "multipart/related": { source: "iana", compressible: !1 },
    "multipart/report": { source: "iana" },
    "multipart/signed": { source: "iana", compressible: !1 },
    "multipart/vnd.bint.med-plus": { source: "iana" },
    "multipart/voice-message": { source: "iana" },
    "multipart/x-mixed-replace": { source: "iana" },
    "text/1d-interleaved-parityfec": { source: "iana" },
    "text/cache-manifest": {
      source: "iana",
      compressible: !0,
      extensions: ["appcache", "manifest"],
    },
    "text/calendar": { source: "iana", extensions: ["ics", "ifb"] },
    "text/calender": { compressible: !0 },
    "text/cmd": { compressible: !0 },
    "text/coffeescript": { extensions: ["coffee", "litcoffee"] },
    "text/cql": { source: "iana" },
    "text/cql-expression": { source: "iana" },
    "text/cql-identifier": { source: "iana" },
    "text/css": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
      extensions: ["css"],
    },
    "text/csv": { source: "iana", compressible: !0, extensions: ["csv"] },
    "text/csv-schema": { source: "iana" },
    "text/directory": { source: "iana" },
    "text/dns": { source: "iana" },
    "text/ecmascript": { source: "iana" },
    "text/encaprtp": { source: "iana" },
    "text/enriched": { source: "iana" },
    "text/fhirpath": { source: "iana" },
    "text/flexfec": { source: "iana" },
    "text/fwdred": { source: "iana" },
    "text/gff3": { source: "iana" },
    "text/grammar-ref-list": { source: "iana" },
    "text/html": {
      source: "iana",
      compressible: !0,
      extensions: ["html", "htm", "shtml"],
    },
    "text/jade": { extensions: ["jade"] },
    "text/javascript": { source: "iana", compressible: !0 },
    "text/jcr-cnd": { source: "iana" },
    "text/jsx": { compressible: !0, extensions: ["jsx"] },
    "text/less": { compressible: !0, extensions: ["less"] },
    "text/markdown": {
      source: "iana",
      compressible: !0,
      extensions: ["markdown", "md"],
    },
    "text/mathml": { source: "nginx", extensions: ["mml"] },
    "text/mdx": { compressible: !0, extensions: ["mdx"] },
    "text/mizar": { source: "iana" },
    "text/n3": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
      extensions: ["n3"],
    },
    "text/parameters": { source: "iana", charset: "UTF-8" },
    "text/parityfec": { source: "iana" },
    "text/plain": {
      source: "iana",
      compressible: !0,
      extensions: ["txt", "text", "conf", "def", "list", "log", "in", "ini"],
    },
    "text/provenance-notation": { source: "iana", charset: "UTF-8" },
    "text/prs.fallenstein.rst": { source: "iana" },
    "text/prs.lines.tag": { source: "iana", extensions: ["dsc"] },
    "text/prs.prop.logic": { source: "iana" },
    "text/raptorfec": { source: "iana" },
    "text/red": { source: "iana" },
    "text/rfc822-headers": { source: "iana" },
    "text/richtext": { source: "iana", compressible: !0, extensions: ["rtx"] },
    "text/rtf": { source: "iana", compressible: !0, extensions: ["rtf"] },
    "text/rtp-enc-aescm128": { source: "iana" },
    "text/rtploopback": { source: "iana" },
    "text/rtx": { source: "iana" },
    "text/sgml": { source: "iana", extensions: ["sgml", "sgm"] },
    "text/shaclc": { source: "iana" },
    "text/shex": { source: "iana", extensions: ["shex"] },
    "text/slim": { extensions: ["slim", "slm"] },
    "text/spdx": { source: "iana", extensions: ["spdx"] },
    "text/strings": { source: "iana" },
    "text/stylus": { extensions: ["stylus", "styl"] },
    "text/t140": { source: "iana" },
    "text/tab-separated-values": {
      source: "iana",
      compressible: !0,
      extensions: ["tsv"],
    },
    "text/troff": {
      source: "iana",
      extensions: ["t", "tr", "roff", "man", "me", "ms"],
    },
    "text/turtle": { source: "iana", charset: "UTF-8", extensions: ["ttl"] },
    "text/ulpfec": { source: "iana" },
    "text/uri-list": {
      source: "iana",
      compressible: !0,
      extensions: ["uri", "uris", "urls"],
    },
    "text/vcard": { source: "iana", compressible: !0, extensions: ["vcard"] },
    "text/vnd.a": { source: "iana" },
    "text/vnd.abc": { source: "iana" },
    "text/vnd.ascii-art": { source: "iana" },
    "text/vnd.curl": { source: "iana", extensions: ["curl"] },
    "text/vnd.curl.dcurl": { source: "apache", extensions: ["dcurl"] },
    "text/vnd.curl.mcurl": { source: "apache", extensions: ["mcurl"] },
    "text/vnd.curl.scurl": { source: "apache", extensions: ["scurl"] },
    "text/vnd.debian.copyright": { source: "iana", charset: "UTF-8" },
    "text/vnd.dmclientscript": { source: "iana" },
    "text/vnd.dvb.subtitle": { source: "iana", extensions: ["sub"] },
    "text/vnd.esmertec.theme-descriptor": { source: "iana", charset: "UTF-8" },
    "text/vnd.familysearch.gedcom": { source: "iana", extensions: ["ged"] },
    "text/vnd.ficlab.flt": { source: "iana" },
    "text/vnd.fly": { source: "iana", extensions: ["fly"] },
    "text/vnd.fmi.flexstor": { source: "iana", extensions: ["flx"] },
    "text/vnd.gml": { source: "iana" },
    "text/vnd.graphviz": { source: "iana", extensions: ["gv"] },
    "text/vnd.hans": { source: "iana" },
    "text/vnd.hgl": { source: "iana" },
    "text/vnd.in3d.3dml": { source: "iana", extensions: ["3dml"] },
    "text/vnd.in3d.spot": { source: "iana", extensions: ["spot"] },
    "text/vnd.iptc.newsml": { source: "iana" },
    "text/vnd.iptc.nitf": { source: "iana" },
    "text/vnd.latex-z": { source: "iana" },
    "text/vnd.motorola.reflex": { source: "iana" },
    "text/vnd.ms-mediapackage": { source: "iana" },
    "text/vnd.net2phone.commcenter.command": { source: "iana" },
    "text/vnd.radisys.msml-basic-layout": { source: "iana" },
    "text/vnd.senx.warpscript": { source: "iana" },
    "text/vnd.si.uricatalogue": { source: "iana" },
    "text/vnd.sosi": { source: "iana" },
    "text/vnd.sun.j2me.app-descriptor": {
      source: "iana",
      charset: "UTF-8",
      extensions: ["jad"],
    },
    "text/vnd.trolltech.linguist": { source: "iana", charset: "UTF-8" },
    "text/vnd.wap.si": { source: "iana" },
    "text/vnd.wap.sl": { source: "iana" },
    "text/vnd.wap.wml": { source: "iana", extensions: ["wml"] },
    "text/vnd.wap.wmlscript": { source: "iana", extensions: ["wmls"] },
    "text/vtt": {
      source: "iana",
      charset: "UTF-8",
      compressible: !0,
      extensions: ["vtt"],
    },
    "text/x-asm": { source: "apache", extensions: ["s", "asm"] },
    "text/x-c": {
      source: "apache",
      extensions: ["c", "cc", "cxx", "cpp", "h", "hh", "dic"],
    },
    "text/x-component": { source: "nginx", extensions: ["htc"] },
    "text/x-fortran": {
      source: "apache",
      extensions: ["f", "for", "f77", "f90"],
    },
    "text/x-gwt-rpc": { compressible: !0 },
    "text/x-handlebars-template": { extensions: ["hbs"] },
    "text/x-java-source": { source: "apache", extensions: ["java"] },
    "text/x-jquery-tmpl": { compressible: !0 },
    "text/x-lua": { extensions: ["lua"] },
    "text/x-markdown": { compressible: !0, extensions: ["mkd"] },
    "text/x-nfo": { source: "apache", extensions: ["nfo"] },
    "text/x-opml": { source: "apache", extensions: ["opml"] },
    "text/x-org": { compressible: !0, extensions: ["org"] },
    "text/x-pascal": { source: "apache", extensions: ["p", "pas"] },
    "text/x-processing": { compressible: !0, extensions: ["pde"] },
    "text/x-sass": { extensions: ["sass"] },
    "text/x-scss": { extensions: ["scss"] },
    "text/x-setext": { source: "apache", extensions: ["etx"] },
    "text/x-sfv": { source: "apache", extensions: ["sfv"] },
    "text/x-suse-ymp": { compressible: !0, extensions: ["ymp"] },
    "text/x-uuencode": { source: "apache", extensions: ["uu"] },
    "text/x-vcalendar": { source: "apache", extensions: ["vcs"] },
    "text/x-vcard": { source: "apache", extensions: ["vcf"] },
    "text/xml": { source: "iana", compressible: !0, extensions: ["xml"] },
    "text/xml-external-parsed-entity": { source: "iana" },
    "text/yaml": { compressible: !0, extensions: ["yaml", "yml"] },
    "video/1d-interleaved-parityfec": { source: "iana" },
    "video/3gpp": { source: "iana", extensions: ["3gp", "3gpp"] },
    "video/3gpp-tt": { source: "iana" },
    "video/3gpp2": { source: "iana", extensions: ["3g2"] },
    "video/av1": { source: "iana" },
    "video/bmpeg": { source: "iana" },
    "video/bt656": { source: "iana" },
    "video/celb": { source: "iana" },
    "video/dv": { source: "iana" },
    "video/encaprtp": { source: "iana" },
    "video/ffv1": { source: "iana" },
    "video/flexfec": { source: "iana" },
    "video/h261": { source: "iana", extensions: ["h261"] },
    "video/h263": { source: "iana", extensions: ["h263"] },
    "video/h263-1998": { source: "iana" },
    "video/h263-2000": { source: "iana" },
    "video/h264": { source: "iana", extensions: ["h264"] },
    "video/h264-rcdo": { source: "iana" },
    "video/h264-svc": { source: "iana" },
    "video/h265": { source: "iana" },
    "video/iso.segment": { source: "iana", extensions: ["m4s"] },
    "video/jpeg": { source: "iana", extensions: ["jpgv"] },
    "video/jpeg2000": { source: "iana" },
    "video/jpm": { source: "apache", extensions: ["jpm", "jpgm"] },
    "video/jxsv": { source: "iana" },
    "video/mj2": { source: "iana", extensions: ["mj2", "mjp2"] },
    "video/mp1s": { source: "iana" },
    "video/mp2p": { source: "iana" },
    "video/mp2t": { source: "iana", extensions: ["ts"] },
    "video/mp4": {
      source: "iana",
      compressible: !1,
      extensions: ["mp4", "mp4v", "mpg4"],
    },
    "video/mp4v-es": { source: "iana" },
    "video/mpeg": {
      source: "iana",
      compressible: !1,
      extensions: ["mpeg", "mpg", "mpe", "m1v", "m2v"],
    },
    "video/mpeg4-generic": { source: "iana" },
    "video/mpv": { source: "iana" },
    "video/nv": { source: "iana" },
    "video/ogg": { source: "iana", compressible: !1, extensions: ["ogv"] },
    "video/parityfec": { source: "iana" },
    "video/pointer": { source: "iana" },
    "video/quicktime": {
      source: "iana",
      compressible: !1,
      extensions: ["qt", "mov"],
    },
    "video/raptorfec": { source: "iana" },
    "video/raw": { source: "iana" },
    "video/rtp-enc-aescm128": { source: "iana" },
    "video/rtploopback": { source: "iana" },
    "video/rtx": { source: "iana" },
    "video/scip": { source: "iana" },
    "video/smpte291": { source: "iana" },
    "video/smpte292m": { source: "iana" },
    "video/ulpfec": { source: "iana" },
    "video/vc1": { source: "iana" },
    "video/vc2": { source: "iana" },
    "video/vnd.cctv": { source: "iana" },
    "video/vnd.dece.hd": { source: "iana", extensions: ["uvh", "uvvh"] },
    "video/vnd.dece.mobile": { source: "iana", extensions: ["uvm", "uvvm"] },
    "video/vnd.dece.mp4": { source: "iana" },
    "video/vnd.dece.pd": { source: "iana", extensions: ["uvp", "uvvp"] },
    "video/vnd.dece.sd": { source: "iana", extensions: ["uvs", "uvvs"] },
    "video/vnd.dece.video": { source: "iana", extensions: ["uvv", "uvvv"] },
    "video/vnd.directv.mpeg": { source: "iana" },
    "video/vnd.directv.mpeg-tts": { source: "iana" },
    "video/vnd.dlna.mpeg-tts": { source: "iana" },
    "video/vnd.dvb.file": { source: "iana", extensions: ["dvb"] },
    "video/vnd.fvt": { source: "iana", extensions: ["fvt"] },
    "video/vnd.hns.video": { source: "iana" },
    "video/vnd.iptvforum.1dparityfec-1010": { source: "iana" },
    "video/vnd.iptvforum.1dparityfec-2005": { source: "iana" },
    "video/vnd.iptvforum.2dparityfec-1010": { source: "iana" },
    "video/vnd.iptvforum.2dparityfec-2005": { source: "iana" },
    "video/vnd.iptvforum.ttsavc": { source: "iana" },
    "video/vnd.iptvforum.ttsmpeg2": { source: "iana" },
    "video/vnd.motorola.video": { source: "iana" },
    "video/vnd.motorola.videop": { source: "iana" },
    "video/vnd.mpegurl": { source: "iana", extensions: ["mxu", "m4u"] },
    "video/vnd.ms-playready.media.pyv": { source: "iana", extensions: ["pyv"] },
    "video/vnd.nokia.interleaved-multimedia": { source: "iana" },
    "video/vnd.nokia.mp4vr": { source: "iana" },
    "video/vnd.nokia.videovoip": { source: "iana" },
    "video/vnd.objectvideo": { source: "iana" },
    "video/vnd.radgamettools.bink": { source: "iana" },
    "video/vnd.radgamettools.smacker": { source: "iana" },
    "video/vnd.sealed.mpeg1": { source: "iana" },
    "video/vnd.sealed.mpeg4": { source: "iana" },
    "video/vnd.sealed.swf": { source: "iana" },
    "video/vnd.sealedmedia.softseal.mov": { source: "iana" },
    "video/vnd.uvvu.mp4": { source: "iana", extensions: ["uvu", "uvvu"] },
    "video/vnd.vivo": { source: "iana", extensions: ["viv"] },
    "video/vnd.youtube.yt": { source: "iana" },
    "video/vp8": { source: "iana" },
    "video/vp9": { source: "iana" },
    "video/webm": { source: "apache", compressible: !1, extensions: ["webm"] },
    "video/x-f4v": { source: "apache", extensions: ["f4v"] },
    "video/x-fli": { source: "apache", extensions: ["fli"] },
    "video/x-flv": { source: "apache", compressible: !1, extensions: ["flv"] },
    "video/x-m4v": { source: "apache", extensions: ["m4v"] },
    "video/x-matroska": {
      source: "apache",
      compressible: !1,
      extensions: ["mkv", "mk3d", "mks"],
    },
    "video/x-mng": { source: "apache", extensions: ["mng"] },
    "video/x-ms-asf": { source: "apache", extensions: ["asf", "asx"] },
    "video/x-ms-vob": { source: "apache", extensions: ["vob"] },
    "video/x-ms-wm": { source: "apache", extensions: ["wm"] },
    "video/x-ms-wmv": {
      source: "apache",
      compressible: !1,
      extensions: ["wmv"],
    },
    "video/x-ms-wmx": { source: "apache", extensions: ["wmx"] },
    "video/x-ms-wvx": { source: "apache", extensions: ["wvx"] },
    "video/x-msvideo": { source: "apache", extensions: ["avi"] },
    "video/x-sgi-movie": { source: "apache", extensions: ["movie"] },
    "video/x-smv": { source: "apache", extensions: ["smv"] },
    "x-conference/x-cooltalk": { source: "apache", extensions: ["ice"] },
    "x-shader/x-fragment": { compressible: !0 },
    "x-shader/x-vertex": { compressible: !0 },
  };
});
var _a = _((R0, ka) => {
  ka.exports = wa();
});
var Ta = _((_e) => {
  "use strict";
  var On = _a(),
    dm = require("path").extname,
    Sa = /^\s*([^;\s]*)(?:;|\s|$)/,
    mm = /^text\//i;
  _e.charset = Ea;
  _e.charsets = { lookup: Ea };
  _e.contentType = fm;
  _e.extension = hm;
  _e.extensions = Object.create(null);
  _e.lookup = gm;
  _e.types = Object.create(null);
  xm(_e.extensions, _e.types);
  function Ea(e) {
    if (!e || typeof e != "string") return !1;
    var t = Sa.exec(e),
      n = t && On[t[1].toLowerCase()];
    return n && n.charset ? n.charset : t && mm.test(t[1]) ? "UTF-8" : !1;
  }
  function fm(e) {
    if (!e || typeof e != "string") return !1;
    var t = e.indexOf("/") === -1 ? _e.lookup(e) : e;
    if (!t) return !1;
    if (t.indexOf("charset") === -1) {
      var n = _e.charset(t);
      n && (t += "; charset=" + n.toLowerCase());
    }
    return t;
  }
  function hm(e) {
    if (!e || typeof e != "string") return !1;
    var t = Sa.exec(e),
      n = t && _e.extensions[t[1].toLowerCase()];
    return !n || !n.length ? !1 : n[0];
  }
  function gm(e) {
    if (!e || typeof e != "string") return !1;
    var t = dm("x." + e)
      .toLowerCase()
      .substr(1);
    return (t && _e.types[t]) || !1;
  }
  function xm(e, t) {
    var n = ["nginx", "apache", void 0, "iana"];
    Object.keys(On).forEach(function (o) {
      var i = On[o],
        a = i.extensions;
      if (!(!a || !a.length)) {
        e[o] = a;
        for (var c = 0; c < a.length; c++) {
          var p = a[c];
          if (t[p]) {
            var u = n.indexOf(On[t[p]].source),
              l = n.indexOf(i.source);
            if (
              t[p] !== "application/octet-stream" &&
              (u > l || (u === l && t[p].substr(0, 12) === "application/"))
            )
              continue;
          }
          t[p] = o;
        }
      }
    });
  }
});
var Ca = _((A0, Ra) => {
  Ra.exports = bm;
  function bm(e) {
    var t =
      typeof setImmediate == "function"
        ? setImmediate
        : typeof process == "object" && typeof process.nextTick == "function"
          ? process.nextTick
          : null;
    t ? t(e) : setTimeout(e, 0);
  }
});
var Ws = _((O0, Oa) => {
  var Aa = Ca();
  Oa.exports = vm;
  function vm(e) {
    var t = !1;
    return (
      Aa(function () {
        t = !0;
      }),
      function (s, o) {
        t
          ? e(s, o)
          : Aa(function () {
              e(s, o);
            });
      }
    );
  }
});
var Hs = _((j0, ja) => {
  ja.exports = ym;
  function ym(e) {
    (Object.keys(e.jobs).forEach($m.bind(e)), (e.jobs = {}));
  }
  function $m(e) {
    typeof this.jobs[e] == "function" && this.jobs[e]();
  }
});
var Gs = _((P0, Na) => {
  var Pa = Ws(),
    wm = Hs();
  Na.exports = km;
  function km(e, t, n, s) {
    var o = n.keyedList ? n.keyedList[n.index] : n.index;
    n.jobs[o] = _m(t, o, e[o], function (i, a) {
      o in n.jobs &&
        (delete n.jobs[o], i ? wm(n) : (n.results[o] = a), s(i, n.results));
    });
  }
  function _m(e, t, n, s) {
    var o;
    return (e.length == 2 ? (o = e(n, Pa(s))) : (o = e(n, t, Pa(s))), o);
  }
});
var Ks = _((N0, La) => {
  La.exports = Sm;
  function Sm(e, t) {
    var n = !Array.isArray(e),
      s = {
        index: 0,
        keyedList: n || t ? Object.keys(e) : null,
        jobs: {},
        results: n ? {} : [],
        size: n ? Object.keys(e).length : e.length,
      };
    return (
      t &&
        s.keyedList.sort(
          n
            ? t
            : function (o, i) {
                return t(e[o], e[i]);
              },
        ),
      s
    );
  }
});
var Js = _((L0, qa) => {
  var Em = Hs(),
    Tm = Ws();
  qa.exports = Rm;
  function Rm(e) {
    Object.keys(this.jobs).length &&
      ((this.index = this.size), Em(this), Tm(e)(null, this.results));
  }
});
var Fa = _((q0, Ma) => {
  var Cm = Gs(),
    Am = Ks(),
    Om = Js();
  Ma.exports = jm;
  function jm(e, t, n) {
    for (var s = Am(e); s.index < (s.keyedList || e).length; )
      (Cm(e, t, s, function (o, i) {
        if (o) {
          n(o, i);
          return;
        }
        if (Object.keys(s.jobs).length === 0) {
          n(null, s.results);
          return;
        }
      }),
        s.index++);
    return Om.bind(s, n);
  }
});
var Vs = _((M0, jn) => {
  var Ia = Gs(),
    Pm = Ks(),
    Nm = Js();
  jn.exports = Lm;
  jn.exports.ascending = Da;
  jn.exports.descending = qm;
  function Lm(e, t, n, s) {
    var o = Pm(e, n);
    return (
      Ia(e, t, o, function i(a, c) {
        if (a) {
          s(a, c);
          return;
        }
        if ((o.index++, o.index < (o.keyedList || e).length)) {
          Ia(e, t, o, i);
          return;
        }
        s(null, o.results);
      }),
      Nm.bind(o, s)
    );
  }
  function Da(e, t) {
    return e < t ? -1 : e > t ? 1 : 0;
  }
  function qm(e, t) {
    return -1 * Da(e, t);
  }
});
var Ba = _((F0, Ua) => {
  var Mm = Vs();
  Ua.exports = Fm;
  function Fm(e, t, n) {
    return Mm(e, t, null, n);
  }
});
var Wa = _((I0, za) => {
  za.exports = { parallel: Fa(), serial: Ba(), serialOrdered: Vs() };
});
var Ys = _((D0, Ha) => {
  "use strict";
  Ha.exports = Object;
});
var Ka = _((U0, Ga) => {
  "use strict";
  Ga.exports = Error;
});
var Va = _((B0, Ja) => {
  "use strict";
  Ja.exports = EvalError;
});
var Xa = _((z0, Ya) => {
  "use strict";
  Ya.exports = RangeError;
});
var Za = _((W0, Qa) => {
  "use strict";
  Qa.exports = ReferenceError;
});
var tr = _((H0, er) => {
  "use strict";
  er.exports = SyntaxError;
});
var Pn = _((G0, nr) => {
  "use strict";
  nr.exports = TypeError;
});
var or = _((K0, sr) => {
  "use strict";
  sr.exports = URIError;
});
var ar = _((J0, ir) => {
  "use strict";
  ir.exports = Math.abs;
});
var cr = _((V0, rr) => {
  "use strict";
  rr.exports = Math.floor;
});
var pr = _((Y0, lr) => {
  "use strict";
  lr.exports = Math.max;
});
var dr = _((X0, ur) => {
  "use strict";
  ur.exports = Math.min;
});
var fr = _((Q0, mr) => {
  "use strict";
  mr.exports = Math.pow;
});
var gr = _((Z0, hr) => {
  "use strict";
  hr.exports = Math.round;
});
var br = _((ek, xr) => {
  "use strict";
  xr.exports =
    Number.isNaN ||
    function (t) {
      return t !== t;
    };
});
var yr = _((tk, vr) => {
  "use strict";
  var Im = br();
  vr.exports = function (t) {
    return Im(t) || t === 0 ? t : t < 0 ? -1 : 1;
  };
});
var wr = _((nk, $r) => {
  "use strict";
  $r.exports = Object.getOwnPropertyDescriptor;
});
var Xs = _((sk, kr) => {
  "use strict";
  var Nn = wr();
  if (Nn)
    try {
      Nn([], "length");
    } catch {
      Nn = null;
    }
  kr.exports = Nn;
});
var Sr = _((ok, _r) => {
  "use strict";
  var Ln = Object.defineProperty || !1;
  if (Ln)
    try {
      Ln({}, "a", { value: 1 });
    } catch {
      Ln = !1;
    }
  _r.exports = Ln;
});
var Qs = _((ik, Er) => {
  "use strict";
  Er.exports = function () {
    if (
      typeof Symbol != "function" ||
      typeof Object.getOwnPropertySymbols != "function"
    )
      return !1;
    if (typeof Symbol.iterator == "symbol") return !0;
    var t = {},
      n = Symbol("test"),
      s = Object(n);
    if (
      typeof n == "string" ||
      Object.prototype.toString.call(n) !== "[object Symbol]" ||
      Object.prototype.toString.call(s) !== "[object Symbol]"
    )
      return !1;
    var o = 42;
    t[n] = o;
    for (var i in t) return !1;
    if (
      (typeof Object.keys == "function" && Object.keys(t).length !== 0) ||
      (typeof Object.getOwnPropertyNames == "function" &&
        Object.getOwnPropertyNames(t).length !== 0)
    )
      return !1;
    var a = Object.getOwnPropertySymbols(t);
    if (
      a.length !== 1 ||
      a[0] !== n ||
      !Object.prototype.propertyIsEnumerable.call(t, n)
    )
      return !1;
    if (typeof Object.getOwnPropertyDescriptor == "function") {
      var c = Object.getOwnPropertyDescriptor(t, n);
      if (c.value !== o || c.enumerable !== !0) return !1;
    }
    return !0;
  };
});
var Cr = _((ak, Rr) => {
  "use strict";
  var Tr = typeof Symbol < "u" && Symbol,
    Dm = Qs();
  Rr.exports = function () {
    return typeof Tr != "function" ||
      typeof Symbol != "function" ||
      typeof Tr("foo") != "symbol" ||
      typeof Symbol("bar") != "symbol"
      ? !1
      : Dm();
  };
});
var Zs = _((rk, Ar) => {
  "use strict";
  Ar.exports = (typeof Reflect < "u" && Reflect.getPrototypeOf) || null;
});
var eo = _((ck, Or) => {
  "use strict";
  var Um = Ys();
  Or.exports = Um.getPrototypeOf || null;
});
var Nr = _((lk, Pr) => {
  "use strict";
  var Bm = "Function.prototype.bind called on incompatible ",
    zm = Object.prototype.toString,
    Wm = Math.max,
    Hm = "[object Function]",
    jr = function (t, n) {
      for (var s = [], o = 0; o < t.length; o += 1) s[o] = t[o];
      for (var i = 0; i < n.length; i += 1) s[i + t.length] = n[i];
      return s;
    },
    Gm = function (t, n) {
      for (var s = [], o = n || 0, i = 0; o < t.length; o += 1, i += 1)
        s[i] = t[o];
      return s;
    },
    Km = function (e, t) {
      for (var n = "", s = 0; s < e.length; s += 1)
        ((n += e[s]), s + 1 < e.length && (n += t));
      return n;
    };
  Pr.exports = function (t) {
    var n = this;
    if (typeof n != "function" || zm.apply(n) !== Hm)
      throw new TypeError(Bm + n);
    for (
      var s = Gm(arguments, 1),
        o,
        i = function () {
          if (this instanceof o) {
            var l = n.apply(this, jr(s, arguments));
            return Object(l) === l ? l : this;
          }
          return n.apply(t, jr(s, arguments));
        },
        a = Wm(0, n.length - s.length),
        c = [],
        p = 0;
      p < a;
      p++
    )
      c[p] = "$" + p;
    if (
      ((o = Function(
        "binder",
        "return function (" +
          Km(c, ",") +
          "){ return binder.apply(this,arguments); }",
      )(i)),
      n.prototype)
    ) {
      var u = function () {};
      ((u.prototype = n.prototype),
        (o.prototype = new u()),
        (u.prototype = null));
    }
    return o;
  };
});
var Vt = _((pk, Lr) => {
  "use strict";
  var Jm = Nr();
  Lr.exports = Function.prototype.bind || Jm;
});
var qn = _((uk, qr) => {
  "use strict";
  qr.exports = Function.prototype.call;
});
var to = _((dk, Mr) => {
  "use strict";
  Mr.exports = Function.prototype.apply;
});
var Ir = _((mk, Fr) => {
  "use strict";
  Fr.exports = typeof Reflect < "u" && Reflect && Reflect.apply;
});
var Ur = _((fk, Dr) => {
  "use strict";
  var Vm = Vt(),
    Ym = to(),
    Xm = qn(),
    Qm = Ir();
  Dr.exports = Qm || Vm.call(Xm, Ym);
});
var zr = _((hk, Br) => {
  "use strict";
  var Zm = Vt(),
    ef = Pn(),
    tf = qn(),
    nf = Ur();
  Br.exports = function (t) {
    if (t.length < 1 || typeof t[0] != "function")
      throw new ef("a function is required");
    return nf(Zm, tf, t);
  };
});
var Vr = _((gk, Jr) => {
  "use strict";
  var sf = zr(),
    Wr = Xs(),
    Gr;
  try {
    Gr = [].__proto__ === Array.prototype;
  } catch (e) {
    if (
      !e ||
      typeof e != "object" ||
      !("code" in e) ||
      e.code !== "ERR_PROTO_ACCESS"
    )
      throw e;
  }
  var no = !!Gr && Wr && Wr(Object.prototype, "__proto__"),
    Kr = Object,
    Hr = Kr.getPrototypeOf;
  Jr.exports =
    no && typeof no.get == "function"
      ? sf([no.get])
      : typeof Hr == "function"
        ? function (t) {
            return Hr(t == null ? t : Kr(t));
          }
        : !1;
});
var ec = _((xk, Zr) => {
  "use strict";
  var Yr = Zs(),
    Xr = eo(),
    Qr = Vr();
  Zr.exports = Yr
    ? function (t) {
        return Yr(t);
      }
    : Xr
      ? function (t) {
          if (!t || (typeof t != "object" && typeof t != "function"))
            throw new TypeError("getProto: not an object");
          return Xr(t);
        }
      : Qr
        ? function (t) {
            return Qr(t);
          }
        : null;
});
var Mn = _((bk, tc) => {
  "use strict";
  var of = Function.prototype.call,
    af = Object.prototype.hasOwnProperty,
    rf = Vt();
  tc.exports = rf.call(of, af);
});
var cc = _((vk, rc) => {
  "use strict";
  var I,
    cf = Ys(),
    lf = Ka(),
    pf = Va(),
    uf = Xa(),
    df = Za(),
    At = tr(),
    Ct = Pn(),
    mf = or(),
    ff = ar(),
    hf = cr(),
    gf = pr(),
    xf = dr(),
    bf = fr(),
    vf = gr(),
    yf = yr(),
    ic = Function,
    so = function (e) {
      try {
        return ic('"use strict"; return (' + e + ").constructor;")();
      } catch {}
    },
    Yt = Xs(),
    $f = Sr(),
    oo = function () {
      throw new Ct();
    },
    wf = Yt
      ? (function () {
          try {
            return (arguments.callee, oo);
          } catch {
            try {
              return Yt(arguments, "callee").get;
            } catch {
              return oo;
            }
          }
        })()
      : oo,
    Tt = Cr()(),
    ue = ec(),
    kf = eo(),
    _f = Zs(),
    ac = to(),
    Xt = qn(),
    Rt = {},
    Sf = typeof Uint8Array > "u" || !ue ? I : ue(Uint8Array),
    at = {
      __proto__: null,
      "%AggregateError%": typeof AggregateError > "u" ? I : AggregateError,
      "%Array%": Array,
      "%ArrayBuffer%": typeof ArrayBuffer > "u" ? I : ArrayBuffer,
      "%ArrayIteratorPrototype%": Tt && ue ? ue([][Symbol.iterator]()) : I,
      "%AsyncFromSyncIteratorPrototype%": I,
      "%AsyncFunction%": Rt,
      "%AsyncGenerator%": Rt,
      "%AsyncGeneratorFunction%": Rt,
      "%AsyncIteratorPrototype%": Rt,
      "%Atomics%": typeof Atomics > "u" ? I : Atomics,
      "%BigInt%": typeof BigInt > "u" ? I : BigInt,
      "%BigInt64Array%": typeof BigInt64Array > "u" ? I : BigInt64Array,
      "%BigUint64Array%": typeof BigUint64Array > "u" ? I : BigUint64Array,
      "%Boolean%": Boolean,
      "%DataView%": typeof DataView > "u" ? I : DataView,
      "%Date%": Date,
      "%decodeURI%": decodeURI,
      "%decodeURIComponent%": decodeURIComponent,
      "%encodeURI%": encodeURI,
      "%encodeURIComponent%": encodeURIComponent,
      "%Error%": lf,
      "%eval%": eval,
      "%EvalError%": pf,
      "%Float16Array%": typeof Float16Array > "u" ? I : Float16Array,
      "%Float32Array%": typeof Float32Array > "u" ? I : Float32Array,
      "%Float64Array%": typeof Float64Array > "u" ? I : Float64Array,
      "%FinalizationRegistry%":
        typeof FinalizationRegistry > "u" ? I : FinalizationRegistry,
      "%Function%": ic,
      "%GeneratorFunction%": Rt,
      "%Int8Array%": typeof Int8Array > "u" ? I : Int8Array,
      "%Int16Array%": typeof Int16Array > "u" ? I : Int16Array,
      "%Int32Array%": typeof Int32Array > "u" ? I : Int32Array,
      "%isFinite%": isFinite,
      "%isNaN%": isNaN,
      "%IteratorPrototype%": Tt && ue ? ue(ue([][Symbol.iterator]())) : I,
      "%JSON%": typeof JSON == "object" ? JSON : I,
      "%Map%": typeof Map > "u" ? I : Map,
      "%MapIteratorPrototype%":
        typeof Map > "u" || !Tt || !ue ? I : ue(new Map()[Symbol.iterator]()),
      "%Math%": Math,
      "%Number%": Number,
      "%Object%": cf,
      "%Object.getOwnPropertyDescriptor%": Yt,
      "%parseFloat%": parseFloat,
      "%parseInt%": parseInt,
      "%Promise%": typeof Promise > "u" ? I : Promise,
      "%Proxy%": typeof Proxy > "u" ? I : Proxy,
      "%RangeError%": uf,
      "%ReferenceError%": df,
      "%Reflect%": typeof Reflect > "u" ? I : Reflect,
      "%RegExp%": RegExp,
      "%Set%": typeof Set > "u" ? I : Set,
      "%SetIteratorPrototype%":
        typeof Set > "u" || !Tt || !ue ? I : ue(new Set()[Symbol.iterator]()),
      "%SharedArrayBuffer%":
        typeof SharedArrayBuffer > "u" ? I : SharedArrayBuffer,
      "%String%": String,
      "%StringIteratorPrototype%": Tt && ue ? ue(""[Symbol.iterator]()) : I,
      "%Symbol%": Tt ? Symbol : I,
      "%SyntaxError%": At,
      "%ThrowTypeError%": wf,
      "%TypedArray%": Sf,
      "%TypeError%": Ct,
      "%Uint8Array%": typeof Uint8Array > "u" ? I : Uint8Array,
      "%Uint8ClampedArray%":
        typeof Uint8ClampedArray > "u" ? I : Uint8ClampedArray,
      "%Uint16Array%": typeof Uint16Array > "u" ? I : Uint16Array,
      "%Uint32Array%": typeof Uint32Array > "u" ? I : Uint32Array,
      "%URIError%": mf,
      "%WeakMap%": typeof WeakMap > "u" ? I : WeakMap,
      "%WeakRef%": typeof WeakRef > "u" ? I : WeakRef,
      "%WeakSet%": typeof WeakSet > "u" ? I : WeakSet,
      "%Function.prototype.call%": Xt,
      "%Function.prototype.apply%": ac,
      "%Object.defineProperty%": $f,
      "%Object.getPrototypeOf%": kf,
      "%Math.abs%": ff,
      "%Math.floor%": hf,
      "%Math.max%": gf,
      "%Math.min%": xf,
      "%Math.pow%": bf,
      "%Math.round%": vf,
      "%Math.sign%": yf,
      "%Reflect.getPrototypeOf%": _f,
    };
  if (ue)
    try {
      null.error;
    } catch (e) {
      ((nc = ue(ue(e))), (at["%Error.prototype%"] = nc));
    }
  var nc,
    Ef = function e(t) {
      var n;
      if (t === "%AsyncFunction%") n = so("async function () {}");
      else if (t === "%GeneratorFunction%") n = so("function* () {}");
      else if (t === "%AsyncGeneratorFunction%")
        n = so("async function* () {}");
      else if (t === "%AsyncGenerator%") {
        var s = e("%AsyncGeneratorFunction%");
        s && (n = s.prototype);
      } else if (t === "%AsyncIteratorPrototype%") {
        var o = e("%AsyncGenerator%");
        o && ue && (n = ue(o.prototype));
      }
      return ((at[t] = n), n);
    },
    sc = {
      __proto__: null,
      "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
      "%ArrayPrototype%": ["Array", "prototype"],
      "%ArrayProto_entries%": ["Array", "prototype", "entries"],
      "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
      "%ArrayProto_keys%": ["Array", "prototype", "keys"],
      "%ArrayProto_values%": ["Array", "prototype", "values"],
      "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
      "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
      "%AsyncGeneratorPrototype%": [
        "AsyncGeneratorFunction",
        "prototype",
        "prototype",
      ],
      "%BooleanPrototype%": ["Boolean", "prototype"],
      "%DataViewPrototype%": ["DataView", "prototype"],
      "%DatePrototype%": ["Date", "prototype"],
      "%ErrorPrototype%": ["Error", "prototype"],
      "%EvalErrorPrototype%": ["EvalError", "prototype"],
      "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
      "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
      "%FunctionPrototype%": ["Function", "prototype"],
      "%Generator%": ["GeneratorFunction", "prototype"],
      "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
      "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
      "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
      "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
      "%JSONParse%": ["JSON", "parse"],
      "%JSONStringify%": ["JSON", "stringify"],
      "%MapPrototype%": ["Map", "prototype"],
      "%NumberPrototype%": ["Number", "prototype"],
      "%ObjectPrototype%": ["Object", "prototype"],
      "%ObjProto_toString%": ["Object", "prototype", "toString"],
      "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
      "%PromisePrototype%": ["Promise", "prototype"],
      "%PromiseProto_then%": ["Promise", "prototype", "then"],
      "%Promise_all%": ["Promise", "all"],
      "%Promise_reject%": ["Promise", "reject"],
      "%Promise_resolve%": ["Promise", "resolve"],
      "%RangeErrorPrototype%": ["RangeError", "prototype"],
      "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
      "%RegExpPrototype%": ["RegExp", "prototype"],
      "%SetPrototype%": ["Set", "prototype"],
      "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
      "%StringPrototype%": ["String", "prototype"],
      "%SymbolPrototype%": ["Symbol", "prototype"],
      "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
      "%TypedArrayPrototype%": ["TypedArray", "prototype"],
      "%TypeErrorPrototype%": ["TypeError", "prototype"],
      "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
      "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
      "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
      "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
      "%URIErrorPrototype%": ["URIError", "prototype"],
      "%WeakMapPrototype%": ["WeakMap", "prototype"],
      "%WeakSetPrototype%": ["WeakSet", "prototype"],
    },
    Qt = Vt(),
    Fn = Mn(),
    Tf = Qt.call(Xt, Array.prototype.concat),
    Rf = Qt.call(ac, Array.prototype.splice),
    oc = Qt.call(Xt, String.prototype.replace),
    In = Qt.call(Xt, String.prototype.slice),
    Cf = Qt.call(Xt, RegExp.prototype.exec),
    Af =
      /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g,
    Of = /\\(\\)?/g,
    jf = function (t) {
      var n = In(t, 0, 1),
        s = In(t, -1);
      if (n === "%" && s !== "%")
        throw new At("invalid intrinsic syntax, expected closing `%`");
      if (s === "%" && n !== "%")
        throw new At("invalid intrinsic syntax, expected opening `%`");
      var o = [];
      return (
        oc(t, Af, function (i, a, c, p) {
          o[o.length] = c ? oc(p, Of, "$1") : a || i;
        }),
        o
      );
    },
    Pf = function (t, n) {
      var s = t,
        o;
      if ((Fn(sc, s) && ((o = sc[s]), (s = "%" + o[0] + "%")), Fn(at, s))) {
        var i = at[s];
        if ((i === Rt && (i = Ef(s)), typeof i > "u" && !n))
          throw new Ct(
            "intrinsic " +
              t +
              " exists, but is not available. Please file an issue!",
          );
        return { alias: o, name: s, value: i };
      }
      throw new At("intrinsic " + t + " does not exist!");
    };
  rc.exports = function (t, n) {
    if (typeof t != "string" || t.length === 0)
      throw new Ct("intrinsic name must be a non-empty string");
    if (arguments.length > 1 && typeof n != "boolean")
      throw new Ct('"allowMissing" argument must be a boolean');
    if (Cf(/^%?[^%]*%?$/, t) === null)
      throw new At(
        "`%` may not be present anywhere but at the beginning and end of the intrinsic name",
      );
    var s = jf(t),
      o = s.length > 0 ? s[0] : "",
      i = Pf("%" + o + "%", n),
      a = i.name,
      c = i.value,
      p = !1,
      u = i.alias;
    u && ((o = u[0]), Rf(s, Tf([0, 1], u)));
    for (var l = 1, d = !0; l < s.length; l += 1) {
      var m = s[l],
        h = In(m, 0, 1),
        f = In(m, -1);
      if (
        (h === '"' ||
          h === "'" ||
          h === "`" ||
          f === '"' ||
          f === "'" ||
          f === "`") &&
        h !== f
      )
        throw new At("property names with quotes must have matching quotes");
      if (
        ((m === "constructor" || !d) && (p = !0),
        (o += "." + m),
        (a = "%" + o + "%"),
        Fn(at, a))
      )
        c = at[a];
      else if (c != null) {
        if (!(m in c)) {
          if (!n)
            throw new Ct(
              "base intrinsic for " +
                t +
                " exists, but the property is not available.",
            );
          return;
        }
        if (Yt && l + 1 >= s.length) {
          var x = Yt(c, m);
          ((d = !!x),
            d && "get" in x && !("originalValue" in x.get)
              ? (c = x.get)
              : (c = c[m]));
        } else ((d = Fn(c, m)), (c = c[m]));
        d && !p && (at[a] = c);
      }
    }
    return c;
  };
});
var pc = _((yk, lc) => {
  "use strict";
  var Nf = Qs();
  lc.exports = function () {
    return Nf() && !!Symbol.toStringTag;
  };
});
var mc = _(($k, dc) => {
  "use strict";
  var Lf = cc(),
    uc = Lf("%Object.defineProperty%", !0),
    qf = pc()(),
    Mf = Mn(),
    Ff = Pn(),
    Dn = qf ? Symbol.toStringTag : null;
  dc.exports = function (t, n) {
    var s = arguments.length > 2 && !!arguments[2] && arguments[2].force,
      o =
        arguments.length > 2 && !!arguments[2] && arguments[2].nonConfigurable;
    if (
      (typeof s < "u" && typeof s != "boolean") ||
      (typeof o < "u" && typeof o != "boolean")
    )
      throw new Ff(
        "if provided, the `overrideIfSet` and `nonConfigurable` options must be booleans",
      );
    Dn &&
      (s || !Mf(t, Dn)) &&
      (uc
        ? uc(t, Dn, {
            configurable: !o,
            enumerable: !1,
            value: n,
            writable: !1,
          })
        : (t[Dn] = n));
  };
});
var hc = _((wk, fc) => {
  "use strict";
  fc.exports = function (e, t) {
    return (
      Object.keys(t).forEach(function (n) {
        e[n] = e[n] || t[n];
      }),
      e
    );
  };
});
var xc = _((kk, gc) => {
  "use strict";
  var co = $a(),
    If = require("util"),
    io = require("path"),
    Df = require("http"),
    Uf = require("https"),
    Bf = require("url").parse,
    zf = require("fs"),
    Wf = require("stream").Stream,
    Hf = require("crypto"),
    ao = Ta(),
    Gf = Wa(),
    Kf = mc(),
    Ze = Mn(),
    ro = hc();
  function D(e) {
    if (!(this instanceof D)) return new D(e);
    ((this._overheadLength = 0),
      (this._valueLength = 0),
      (this._valuesToMeasure = []),
      co.call(this),
      (e = e || {}));
    for (var t in e) this[t] = e[t];
  }
  If.inherits(D, co);
  D.LINE_BREAK = `\r
`;
  D.DEFAULT_CONTENT_TYPE = "application/octet-stream";
  D.prototype.append = function (e, t, n) {
    ((n = n || {}), typeof n == "string" && (n = { filename: n }));
    var s = co.prototype.append.bind(this);
    if (
      ((typeof t == "number" || t == null) && (t = String(t)), Array.isArray(t))
    ) {
      this._error(new Error("Arrays are not supported."));
      return;
    }
    var o = this._multiPartHeader(e, t, n),
      i = this._multiPartFooter();
    (s(o), s(t), s(i), this._trackLength(o, t, n));
  };
  D.prototype._trackLength = function (e, t, n) {
    var s = 0;
    (n.knownLength != null
      ? (s += Number(n.knownLength))
      : Buffer.isBuffer(t)
        ? (s = t.length)
        : typeof t == "string" && (s = Buffer.byteLength(t)),
      (this._valueLength += s),
      (this._overheadLength += Buffer.byteLength(e) + D.LINE_BREAK.length),
      !(
        !t ||
        (!t.path && !(t.readable && Ze(t, "httpVersion")) && !(t instanceof Wf))
      ) &&
        (n.knownLength || this._valuesToMeasure.push(t)));
  };
  D.prototype._lengthRetriever = function (e, t) {
    Ze(e, "fd")
      ? e.end != null && e.end != 1 / 0 && e.start != null
        ? t(null, e.end + 1 - (e.start ? e.start : 0))
        : zf.stat(e.path, function (n, s) {
            if (n) {
              t(n);
              return;
            }
            var o = s.size - (e.start ? e.start : 0);
            t(null, o);
          })
      : Ze(e, "httpVersion")
        ? t(null, Number(e.headers["content-length"]))
        : Ze(e, "httpModule")
          ? (e.on("response", function (n) {
              (e.pause(), t(null, Number(n.headers["content-length"])));
            }),
            e.resume())
          : t("Unknown stream");
  };
  D.prototype._multiPartHeader = function (e, t, n) {
    if (typeof n.header == "string") return n.header;
    var s = this._getContentDisposition(t, n),
      o = this._getContentType(t, n),
      i = "",
      a = {
        "Content-Disposition": ["form-data", 'name="' + e + '"'].concat(
          s || [],
        ),
        "Content-Type": [].concat(o || []),
      };
    typeof n.header == "object" && ro(a, n.header);
    var c;
    for (var p in a)
      if (Ze(a, p)) {
        if (((c = a[p]), c == null)) continue;
        (Array.isArray(c) || (c = [c]),
          c.length && (i += p + ": " + c.join("; ") + D.LINE_BREAK));
      }
    return "--" + this.getBoundary() + D.LINE_BREAK + i + D.LINE_BREAK;
  };
  D.prototype._getContentDisposition = function (e, t) {
    var n;
    if (
      (typeof t.filepath == "string"
        ? (n = io.normalize(t.filepath).replace(/\\/g, "/"))
        : t.filename || (e && (e.name || e.path))
          ? (n = io.basename(t.filename || (e && (e.name || e.path))))
          : e &&
            e.readable &&
            Ze(e, "httpVersion") &&
            (n = io.basename(e.client._httpMessage.path || "")),
      n)
    )
      return 'filename="' + n + '"';
  };
  D.prototype._getContentType = function (e, t) {
    var n = t.contentType;
    return (
      !n && e && e.name && (n = ao.lookup(e.name)),
      !n && e && e.path && (n = ao.lookup(e.path)),
      !n &&
        e &&
        e.readable &&
        Ze(e, "httpVersion") &&
        (n = e.headers["content-type"]),
      !n &&
        (t.filepath || t.filename) &&
        (n = ao.lookup(t.filepath || t.filename)),
      !n && e && typeof e == "object" && (n = D.DEFAULT_CONTENT_TYPE),
      n
    );
  };
  D.prototype._multiPartFooter = function () {
    return function (e) {
      var t = D.LINE_BREAK,
        n = this._streams.length === 0;
      (n && (t += this._lastBoundary()), e(t));
    }.bind(this);
  };
  D.prototype._lastBoundary = function () {
    return "--" + this.getBoundary() + "--" + D.LINE_BREAK;
  };
  D.prototype.getHeaders = function (e) {
    var t,
      n = {
        "content-type": "multipart/form-data; boundary=" + this.getBoundary(),
      };
    for (t in e) Ze(e, t) && (n[t.toLowerCase()] = e[t]);
    return n;
  };
  D.prototype.setBoundary = function (e) {
    if (typeof e != "string")
      throw new TypeError("FormData boundary must be a string");
    this._boundary = e;
  };
  D.prototype.getBoundary = function () {
    return (this._boundary || this._generateBoundary(), this._boundary);
  };
  D.prototype.getBuffer = function () {
    for (
      var e = new Buffer.alloc(0),
        t = this.getBoundary(),
        n = 0,
        s = this._streams.length;
      n < s;
      n++
    )
      typeof this._streams[n] != "function" &&
        (Buffer.isBuffer(this._streams[n])
          ? (e = Buffer.concat([e, this._streams[n]]))
          : (e = Buffer.concat([e, Buffer.from(this._streams[n])])),
        (typeof this._streams[n] != "string" ||
          this._streams[n].substring(2, t.length + 2) !== t) &&
          (e = Buffer.concat([e, Buffer.from(D.LINE_BREAK)])));
    return Buffer.concat([e, Buffer.from(this._lastBoundary())]);
  };
  D.prototype._generateBoundary = function () {
    this._boundary =
      "--------------------------" + Hf.randomBytes(12).toString("hex");
  };
  D.prototype.getLengthSync = function () {
    var e = this._overheadLength + this._valueLength;
    return (
      this._streams.length && (e += this._lastBoundary().length),
      this.hasKnownLength() ||
        this._error(
          new Error("Cannot calculate proper length in synchronous way."),
        ),
      e
    );
  };
  D.prototype.hasKnownLength = function () {
    var e = !0;
    return (this._valuesToMeasure.length && (e = !1), e);
  };
  D.prototype.getLength = function (e) {
    var t = this._overheadLength + this._valueLength;
    if (
      (this._streams.length && (t += this._lastBoundary().length),
      !this._valuesToMeasure.length)
    ) {
      process.nextTick(e.bind(this, null, t));
      return;
    }
    Gf.parallel(this._valuesToMeasure, this._lengthRetriever, function (n, s) {
      if (n) {
        e(n);
        return;
      }
      (s.forEach(function (o) {
        t += o;
      }),
        e(null, t));
    });
  };
  D.prototype.submit = function (e, t) {
    var n,
      s,
      o = { method: "post" };
    return (
      typeof e == "string"
        ? ((e = Bf(e)),
          (s = ro(
            {
              port: e.port,
              path: e.pathname,
              host: e.hostname,
              protocol: e.protocol,
            },
            o,
          )))
        : ((s = ro(e, o)),
          s.port || (s.port = s.protocol === "https:" ? 443 : 80)),
      (s.headers = this.getHeaders(e.headers)),
      s.protocol === "https:" ? (n = Uf.request(s)) : (n = Df.request(s)),
      this.getLength(
        function (i, a) {
          if (i && i !== "Unknown stream") {
            this._error(i);
            return;
          }
          if ((a && n.setHeader("Content-Length", a), this.pipe(n), t)) {
            var c,
              p = function (u, l) {
                return (
                  n.removeListener("error", p),
                  n.removeListener("response", c),
                  t.call(this, u, l)
                );
              };
            ((c = p.bind(this, null)), n.on("error", p), n.on("response", c));
          }
        }.bind(this),
      ),
      n
    );
  };
  D.prototype._error = function (e) {
    this.error || ((this.error = e), this.pause(), this.emit("error", e));
  };
  D.prototype.toString = function () {
    return "[object FormData]";
  };
  Kf(D.prototype, "FormData");
  gc.exports = D;
});
var vc = _((bc) => {
  "use strict";
  var Jf = require("url").parse,
    Vf = { ftp: 21, gopher: 70, http: 80, https: 443, ws: 80, wss: 443 },
    Yf =
      String.prototype.endsWith ||
      function (e) {
        return (
          e.length <= this.length &&
          this.indexOf(e, this.length - e.length) !== -1
        );
      };
  function Xf(e) {
    var t = typeof e == "string" ? Jf(e) : e || {},
      n = t.protocol,
      s = t.host,
      o = t.port;
    if (
      typeof s != "string" ||
      !s ||
      typeof n != "string" ||
      ((n = n.split(":", 1)[0]),
      (s = s.replace(/:\d*$/, "")),
      (o = parseInt(o) || Vf[n] || 0),
      !Qf(s, o))
    )
      return "";
    var i =
      Ot("npm_config_" + n + "_proxy") ||
      Ot(n + "_proxy") ||
      Ot("npm_config_proxy") ||
      Ot("all_proxy");
    return (i && i.indexOf("://") === -1 && (i = n + "://" + i), i);
  }
  function Qf(e, t) {
    var n = (Ot("npm_config_no_proxy") || Ot("no_proxy")).toLowerCase();
    return n
      ? n === "*"
        ? !1
        : n.split(/[,\s]/).every(function (s) {
            if (!s) return !0;
            var o = s.match(/^(.+):(\d+)$/),
              i = o ? o[1] : s,
              a = o ? parseInt(o[2]) : 0;
            return a && a !== t
              ? !0
              : /^[.*]/.test(i)
                ? (i.charAt(0) === "*" && (i = i.slice(1)), !Yf.call(e, i))
                : e !== i;
          })
      : !0;
  }
  function Ot(e) {
    return process.env[e.toLowerCase()] || process.env[e.toUpperCase()] || "";
  }
  bc.getProxyForUrl = Xf;
});
var $c = _((Sk, yc) => {
  var jt = 1e3,
    Pt = jt * 60,
    Nt = Pt * 60,
    rt = Nt * 24,
    Zf = rt * 7,
    eh = rt * 365.25;
  yc.exports = function (e, t) {
    t = t || {};
    var n = typeof e;
    if (n === "string" && e.length > 0) return th(e);
    if (n === "number" && isFinite(e)) return t.long ? sh(e) : nh(e);
    throw new Error(
      "val is not a non-empty string or a valid number. val=" +
        JSON.stringify(e),
    );
  };
  function th(e) {
    if (((e = String(e)), !(e.length > 100))) {
      var t =
        /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
          e,
        );
      if (t) {
        var n = parseFloat(t[1]),
          s = (t[2] || "ms").toLowerCase();
        switch (s) {
          case "years":
          case "year":
          case "yrs":
          case "yr":
          case "y":
            return n * eh;
          case "weeks":
          case "week":
          case "w":
            return n * Zf;
          case "days":
          case "day":
          case "d":
            return n * rt;
          case "hours":
          case "hour":
          case "hrs":
          case "hr":
          case "h":
            return n * Nt;
          case "minutes":
          case "minute":
          case "mins":
          case "min":
          case "m":
            return n * Pt;
          case "seconds":
          case "second":
          case "secs":
          case "sec":
          case "s":
            return n * jt;
          case "milliseconds":
          case "millisecond":
          case "msecs":
          case "msec":
          case "ms":
            return n;
          default:
            return;
        }
      }
    }
  }
  function nh(e) {
    var t = Math.abs(e);
    return t >= rt
      ? Math.round(e / rt) + "d"
      : t >= Nt
        ? Math.round(e / Nt) + "h"
        : t >= Pt
          ? Math.round(e / Pt) + "m"
          : t >= jt
            ? Math.round(e / jt) + "s"
            : e + "ms";
  }
  function sh(e) {
    var t = Math.abs(e);
    return t >= rt
      ? Un(e, t, rt, "day")
      : t >= Nt
        ? Un(e, t, Nt, "hour")
        : t >= Pt
          ? Un(e, t, Pt, "minute")
          : t >= jt
            ? Un(e, t, jt, "second")
            : e + " ms";
  }
  function Un(e, t, n, s) {
    var o = t >= n * 1.5;
    return Math.round(e / n) + " " + s + (o ? "s" : "");
  }
});
var lo = _((Ek, wc) => {
  function oh(e) {
    ((n.debug = n),
      (n.default = n),
      (n.coerce = p),
      (n.disable = a),
      (n.enable = o),
      (n.enabled = c),
      (n.humanize = $c()),
      (n.destroy = u),
      Object.keys(e).forEach((l) => {
        n[l] = e[l];
      }),
      (n.names = []),
      (n.skips = []),
      (n.formatters = {}));
    function t(l) {
      let d = 0;
      for (let m = 0; m < l.length; m++)
        ((d = (d << 5) - d + l.charCodeAt(m)), (d |= 0));
      return n.colors[Math.abs(d) % n.colors.length];
    }
    n.selectColor = t;
    function n(l) {
      let d,
        m = null,
        h,
        f;
      function x(...b) {
        if (!x.enabled) return;
        let v = x,
          $ = Number(new Date()),
          T = $ - (d || $);
        ((v.diff = T),
          (v.prev = d),
          (v.curr = $),
          (d = $),
          (b[0] = n.coerce(b[0])),
          typeof b[0] != "string" && b.unshift("%O"));
        let w = 0;
        ((b[0] = b[0].replace(/%([a-zA-Z%])/g, (S, E) => {
          if (S === "%%") return "%";
          w++;
          let C = n.formatters[E];
          if (typeof C == "function") {
            let M = b[w];
            ((S = C.call(v, M)), b.splice(w, 1), w--);
          }
          return S;
        })),
          n.formatArgs.call(v, b),
          (v.log || n.log).apply(v, b));
      }
      return (
        (x.namespace = l),
        (x.useColors = n.useColors()),
        (x.color = n.selectColor(l)),
        (x.extend = s),
        (x.destroy = n.destroy),
        Object.defineProperty(x, "enabled", {
          enumerable: !0,
          configurable: !1,
          get: () =>
            m !== null
              ? m
              : (h !== n.namespaces && ((h = n.namespaces), (f = n.enabled(l))),
                f),
          set: (b) => {
            m = b;
          },
        }),
        typeof n.init == "function" && n.init(x),
        x
      );
    }
    function s(l, d) {
      let m = n(this.namespace + (typeof d > "u" ? ":" : d) + l);
      return ((m.log = this.log), m);
    }
    function o(l) {
      (n.save(l), (n.namespaces = l), (n.names = []), (n.skips = []));
      let d = (typeof l == "string" ? l : "")
        .trim()
        .replace(/\s+/g, ",")
        .split(",")
        .filter(Boolean);
      for (let m of d)
        m[0] === "-" ? n.skips.push(m.slice(1)) : n.names.push(m);
    }
    function i(l, d) {
      let m = 0,
        h = 0,
        f = -1,
        x = 0;
      for (; m < l.length; )
        if (h < d.length && (d[h] === l[m] || d[h] === "*"))
          d[h] === "*" ? ((f = h), (x = m), h++) : (m++, h++);
        else if (f !== -1) ((h = f + 1), x++, (m = x));
        else return !1;
      for (; h < d.length && d[h] === "*"; ) h++;
      return h === d.length;
    }
    function a() {
      let l = [...n.names, ...n.skips.map((d) => "-" + d)].join(",");
      return (n.enable(""), l);
    }
    function c(l) {
      for (let d of n.skips) if (i(l, d)) return !1;
      for (let d of n.names) if (i(l, d)) return !0;
      return !1;
    }
    function p(l) {
      return l instanceof Error ? l.stack || l.message : l;
    }
    function u() {
      console.warn(
        "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.",
      );
    }
    return (n.enable(n.load()), n);
  }
  wc.exports = oh;
});
var kc = _((Se, Bn) => {
  Se.formatArgs = ah;
  Se.save = rh;
  Se.load = ch;
  Se.useColors = ih;
  Se.storage = lh();
  Se.destroy = (() => {
    let e = !1;
    return () => {
      e ||
        ((e = !0),
        console.warn(
          "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.",
        ));
    };
  })();
  Se.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33",
  ];
  function ih() {
    if (
      typeof window < "u" &&
      window.process &&
      (window.process.type === "renderer" || window.process.__nwjs)
    )
      return !0;
    if (
      typeof navigator < "u" &&
      navigator.userAgent &&
      navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)
    )
      return !1;
    let e;
    return (
      (typeof document < "u" &&
        document.documentElement &&
        document.documentElement.style &&
        document.documentElement.style.WebkitAppearance) ||
      (typeof window < "u" &&
        window.console &&
        (window.console.firebug ||
          (window.console.exception && window.console.table))) ||
      (typeof navigator < "u" &&
        navigator.userAgent &&
        (e = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) &&
        parseInt(e[1], 10) >= 31) ||
      (typeof navigator < "u" &&
        navigator.userAgent &&
        navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
    );
  }
  function ah(e) {
    if (
      ((e[0] =
        (this.useColors ? "%c" : "") +
        this.namespace +
        (this.useColors ? " %c" : " ") +
        e[0] +
        (this.useColors ? "%c " : " ") +
        "+" +
        Bn.exports.humanize(this.diff)),
      !this.useColors)
    )
      return;
    let t = "color: " + this.color;
    e.splice(1, 0, t, "color: inherit");
    let n = 0,
      s = 0;
    (e[0].replace(/%[a-zA-Z%]/g, (o) => {
      o !== "%%" && (n++, o === "%c" && (s = n));
    }),
      e.splice(s, 0, t));
  }
  Se.log = console.debug || console.log || (() => {});
  function rh(e) {
    try {
      e ? Se.storage.setItem("debug", e) : Se.storage.removeItem("debug");
    } catch {}
  }
  function ch() {
    let e;
    try {
      e = Se.storage.getItem("debug") || Se.storage.getItem("DEBUG");
    } catch {}
    return (
      !e && typeof process < "u" && "env" in process && (e = process.env.DEBUG),
      e
    );
  }
  function lh() {
    try {
      return localStorage;
    } catch {}
  }
  Bn.exports = lo()(Se);
  var { formatters: ph } = Bn.exports;
  ph.j = function (e) {
    try {
      return JSON.stringify(e);
    } catch (t) {
      return "[UnexpectedJSONParseError]: " + t.message;
    }
  };
});
var Sc = _((Tk, _c) => {
  "use strict";
  _c.exports = (e, t = process.argv) => {
    let n = e.startsWith("-") ? "" : e.length === 1 ? "-" : "--",
      s = t.indexOf(n + e),
      o = t.indexOf("--");
    return s !== -1 && (o === -1 || s < o);
  };
});
var Rc = _((Rk, Tc) => {
  "use strict";
  var uh = require("os"),
    Ec = require("tty"),
    Pe = Sc(),
    { env: de } = process,
    et;
  Pe("no-color") || Pe("no-colors") || Pe("color=false") || Pe("color=never")
    ? (et = 0)
    : (Pe("color") || Pe("colors") || Pe("color=true") || Pe("color=always")) &&
      (et = 1);
  "FORCE_COLOR" in de &&
    (de.FORCE_COLOR === "true"
      ? (et = 1)
      : de.FORCE_COLOR === "false"
        ? (et = 0)
        : (et =
            de.FORCE_COLOR.length === 0
              ? 1
              : Math.min(parseInt(de.FORCE_COLOR, 10), 3)));
  function po(e) {
    return e === 0
      ? !1
      : { level: e, hasBasic: !0, has256: e >= 2, has16m: e >= 3 };
  }
  function uo(e, t) {
    if (et === 0) return 0;
    if (Pe("color=16m") || Pe("color=full") || Pe("color=truecolor")) return 3;
    if (Pe("color=256")) return 2;
    if (e && !t && et === void 0) return 0;
    let n = et || 0;
    if (de.TERM === "dumb") return n;
    if (process.platform === "win32") {
      let s = uh.release().split(".");
      return Number(s[0]) >= 10 && Number(s[2]) >= 10586
        ? Number(s[2]) >= 14931
          ? 3
          : 2
        : 1;
    }
    if ("CI" in de)
      return [
        "TRAVIS",
        "CIRCLECI",
        "APPVEYOR",
        "GITLAB_CI",
        "GITHUB_ACTIONS",
        "BUILDKITE",
      ].some((s) => s in de) || de.CI_NAME === "codeship"
        ? 1
        : n;
    if ("TEAMCITY_VERSION" in de)
      return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(de.TEAMCITY_VERSION) ? 1 : 0;
    if (de.COLORTERM === "truecolor") return 3;
    if ("TERM_PROGRAM" in de) {
      let s = parseInt((de.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
      switch (de.TERM_PROGRAM) {
        case "iTerm.app":
          return s >= 3 ? 3 : 2;
        case "Apple_Terminal":
          return 2;
      }
    }
    return /-256(color)?$/i.test(de.TERM)
      ? 2
      : /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(
            de.TERM,
          ) || "COLORTERM" in de
        ? 1
        : n;
  }
  function dh(e) {
    let t = uo(e, e && e.isTTY);
    return po(t);
  }
  Tc.exports = {
    supportsColor: dh,
    stdout: po(uo(!0, Ec.isatty(1))),
    stderr: po(uo(!0, Ec.isatty(2))),
  };
});
var Ac = _((me, Wn) => {
  var mh = require("tty"),
    zn = require("util");
  me.init = yh;
  me.log = xh;
  me.formatArgs = hh;
  me.save = bh;
  me.load = vh;
  me.useColors = fh;
  me.destroy = zn.deprecate(
    () => {},
    "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.",
  );
  me.colors = [6, 2, 3, 4, 5, 1];
  try {
    let e = Rc();
    e &&
      (e.stderr || e).level >= 2 &&
      (me.colors = [
        20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62, 63,
        68, 69, 74, 75, 76, 77, 78, 79, 80, 81, 92, 93, 98, 99, 112, 113, 128,
        129, 134, 135, 148, 149, 160, 161, 162, 163, 164, 165, 166, 167, 168,
        169, 170, 171, 172, 173, 178, 179, 184, 185, 196, 197, 198, 199, 200,
        201, 202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221,
      ]);
  } catch {}
  me.inspectOpts = Object.keys(process.env)
    .filter((e) => /^debug_/i.test(e))
    .reduce((e, t) => {
      let n = t
          .substring(6)
          .toLowerCase()
          .replace(/_([a-z])/g, (o, i) => i.toUpperCase()),
        s = process.env[t];
      return (
        /^(yes|on|true|enabled)$/i.test(s)
          ? (s = !0)
          : /^(no|off|false|disabled)$/i.test(s)
            ? (s = !1)
            : s === "null"
              ? (s = null)
              : (s = Number(s)),
        (e[n] = s),
        e
      );
    }, {});
  function fh() {
    return "colors" in me.inspectOpts
      ? !!me.inspectOpts.colors
      : mh.isatty(process.stderr.fd);
  }
  function hh(e) {
    let { namespace: t, useColors: n } = this;
    if (n) {
      let s = this.color,
        o = "\x1B[3" + (s < 8 ? s : "8;5;" + s),
        i = `  ${o};1m${t} \x1B[0m`;
      ((e[0] =
        i +
        e[0]
          .split(
            `
`,
          )
          .join(
            `
` + i,
          )),
        e.push(o + "m+" + Wn.exports.humanize(this.diff) + "\x1B[0m"));
    } else e[0] = gh() + t + " " + e[0];
  }
  function gh() {
    return me.inspectOpts.hideDate ? "" : new Date().toISOString() + " ";
  }
  function xh(...e) {
    return process.stderr.write(
      zn.formatWithOptions(me.inspectOpts, ...e) +
        `
`,
    );
  }
  function bh(e) {
    e ? (process.env.DEBUG = e) : delete process.env.DEBUG;
  }
  function vh() {
    return process.env.DEBUG;
  }
  function yh(e) {
    e.inspectOpts = {};
    let t = Object.keys(me.inspectOpts);
    for (let n = 0; n < t.length; n++)
      e.inspectOpts[t[n]] = me.inspectOpts[t[n]];
  }
  Wn.exports = lo()(me);
  var { formatters: Cc } = Wn.exports;
  Cc.o = function (e) {
    return (
      (this.inspectOpts.colors = this.useColors),
      zn
        .inspect(e, this.inspectOpts)
        .split(
          `
`,
        )
        .map((t) => t.trim())
        .join(" ")
    );
  };
  Cc.O = function (e) {
    return (
      (this.inspectOpts.colors = this.useColors),
      zn.inspect(e, this.inspectOpts)
    );
  };
});
var Oc = _((Ck, mo) => {
  typeof process > "u" ||
  process.type === "renderer" ||
  process.browser === !0 ||
  process.__nwjs
    ? (mo.exports = kc())
    : (mo.exports = Ac());
});
var Pc = _((Ak, jc) => {
  var Zt;
  jc.exports = function () {
    if (!Zt) {
      try {
        Zt = Oc()("follow-redirects");
      } catch {}
      typeof Zt != "function" && (Zt = function () {});
    }
    Zt.apply(null, arguments);
  };
});
var Fc = _((Ok, So) => {
  var tn = require("url"),
    en = tn.URL,
    $h = require("http"),
    wh = require("https"),
    bo = require("stream").Writable,
    vo = require("assert"),
    Nc = Pc();
  (function () {
    var t = typeof process < "u",
      n = typeof window < "u" && typeof document < "u",
      s = lt(Error.captureStackTrace);
    !t &&
      (n || !s) &&
      console.warn(
        "The follow-redirects package should be excluded from browser builds.",
      );
  })();
  var yo = !1;
  try {
    vo(new en(""));
  } catch (e) {
    yo = e.code === "ERR_INVALID_URL";
  }
  var kh = [
      "auth",
      "host",
      "hostname",
      "href",
      "path",
      "pathname",
      "port",
      "protocol",
      "query",
      "search",
      "hash",
    ],
    $o = ["abort", "aborted", "connect", "error", "socket", "timeout"],
    wo = Object.create(null);
  $o.forEach(function (e) {
    wo[e] = function (t, n, s) {
      this._redirectable.emit(e, t, n, s);
    };
  });
  var ho = nn("ERR_INVALID_URL", "Invalid URL", TypeError),
    go = nn("ERR_FR_REDIRECTION_FAILURE", "Redirected request failed"),
    _h = nn(
      "ERR_FR_TOO_MANY_REDIRECTS",
      "Maximum number of redirects exceeded",
      go,
    ),
    Sh = nn(
      "ERR_FR_MAX_BODY_LENGTH_EXCEEDED",
      "Request body larger than maxBodyLength limit",
    ),
    Eh = nn("ERR_STREAM_WRITE_AFTER_END", "write after end"),
    Th = bo.prototype.destroy || qc;
  function Ee(e, t) {
    (bo.call(this),
      this._sanitizeOptions(e),
      (this._options = e),
      (this._ended = !1),
      (this._ending = !1),
      (this._redirectCount = 0),
      (this._redirects = []),
      (this._requestBodyLength = 0),
      (this._requestBodyBuffers = []),
      t && this.on("response", t));
    var n = this;
    ((this._onNativeResponse = function (s) {
      try {
        n._processResponse(s);
      } catch (o) {
        n.emit("error", o instanceof go ? o : new go({ cause: o }));
      }
    }),
      this._performRequest());
  }
  Ee.prototype = Object.create(bo.prototype);
  Ee.prototype.abort = function () {
    (_o(this._currentRequest),
      this._currentRequest.abort(),
      this.emit("abort"));
  };
  Ee.prototype.destroy = function (e) {
    return (_o(this._currentRequest, e), Th.call(this, e), this);
  };
  Ee.prototype.write = function (e, t, n) {
    if (this._ending) throw new Eh();
    if (!ct(e) && !Ah(e))
      throw new TypeError("data should be a string, Buffer or Uint8Array");
    if ((lt(t) && ((n = t), (t = null)), e.length === 0)) {
      n && n();
      return;
    }
    this._requestBodyLength + e.length <= this._options.maxBodyLength
      ? ((this._requestBodyLength += e.length),
        this._requestBodyBuffers.push({ data: e, encoding: t }),
        this._currentRequest.write(e, t, n))
      : (this.emit("error", new Sh()), this.abort());
  };
  Ee.prototype.end = function (e, t, n) {
    if (
      (lt(e) ? ((n = e), (e = t = null)) : lt(t) && ((n = t), (t = null)), !e)
    )
      ((this._ended = this._ending = !0),
        this._currentRequest.end(null, null, n));
    else {
      var s = this,
        o = this._currentRequest;
      (this.write(e, t, function () {
        ((s._ended = !0), o.end(null, null, n));
      }),
        (this._ending = !0));
    }
  };
  Ee.prototype.setHeader = function (e, t) {
    ((this._options.headers[e] = t), this._currentRequest.setHeader(e, t));
  };
  Ee.prototype.removeHeader = function (e) {
    (delete this._options.headers[e], this._currentRequest.removeHeader(e));
  };
  Ee.prototype.setTimeout = function (e, t) {
    var n = this;
    function s(a) {
      (a.setTimeout(e),
        a.removeListener("timeout", a.destroy),
        a.addListener("timeout", a.destroy));
    }
    function o(a) {
      (n._timeout && clearTimeout(n._timeout),
        (n._timeout = setTimeout(function () {
          (n.emit("timeout"), i());
        }, e)),
        s(a));
    }
    function i() {
      (n._timeout && (clearTimeout(n._timeout), (n._timeout = null)),
        n.removeListener("abort", i),
        n.removeListener("error", i),
        n.removeListener("response", i),
        n.removeListener("close", i),
        t && n.removeListener("timeout", t),
        n.socket || n._currentRequest.removeListener("socket", o));
    }
    return (
      t && this.on("timeout", t),
      this.socket ? o(this.socket) : this._currentRequest.once("socket", o),
      this.on("socket", s),
      this.on("abort", i),
      this.on("error", i),
      this.on("response", i),
      this.on("close", i),
      this
    );
  };
  ["flushHeaders", "getHeader", "setNoDelay", "setSocketKeepAlive"].forEach(
    function (e) {
      Ee.prototype[e] = function (t, n) {
        return this._currentRequest[e](t, n);
      };
    },
  );
  ["aborted", "connection", "socket"].forEach(function (e) {
    Object.defineProperty(Ee.prototype, e, {
      get: function () {
        return this._currentRequest[e];
      },
    });
  });
  Ee.prototype._sanitizeOptions = function (e) {
    if (
      (e.headers || (e.headers = {}),
      e.host && (e.hostname || (e.hostname = e.host), delete e.host),
      !e.pathname && e.path)
    ) {
      var t = e.path.indexOf("?");
      t < 0
        ? (e.pathname = e.path)
        : ((e.pathname = e.path.substring(0, t)),
          (e.search = e.path.substring(t)));
    }
  };
  Ee.prototype._performRequest = function () {
    var e = this._options.protocol,
      t = this._options.nativeProtocols[e];
    if (!t) throw new TypeError("Unsupported protocol " + e);
    if (this._options.agents) {
      var n = e.slice(0, -1);
      this._options.agent = this._options.agents[n];
    }
    var s = (this._currentRequest = t.request(
      this._options,
      this._onNativeResponse,
    ));
    s._redirectable = this;
    for (var o of $o) s.on(o, wo[o]);
    if (
      ((this._currentUrl = /^\//.test(this._options.path)
        ? tn.format(this._options)
        : this._options.path),
      this._isRedirect)
    ) {
      var i = 0,
        a = this,
        c = this._requestBodyBuffers;
      (function p(u) {
        if (s === a._currentRequest)
          if (u) a.emit("error", u);
          else if (i < c.length) {
            var l = c[i++];
            s.finished || s.write(l.data, l.encoding, p);
          } else a._ended && s.end();
      })();
    }
  };
  Ee.prototype._processResponse = function (e) {
    var t = e.statusCode;
    this._options.trackRedirects &&
      this._redirects.push({
        url: this._currentUrl,
        headers: e.headers,
        statusCode: t,
      });
    var n = e.headers.location;
    if (!n || this._options.followRedirects === !1 || t < 300 || t >= 400) {
      ((e.responseUrl = this._currentUrl),
        (e.redirects = this._redirects),
        this.emit("response", e),
        (this._requestBodyBuffers = []));
      return;
    }
    if (
      (_o(this._currentRequest),
      e.destroy(),
      ++this._redirectCount > this._options.maxRedirects)
    )
      throw new _h();
    var s,
      o = this._options.beforeRedirect;
    o &&
      (s = Object.assign(
        { Host: e.req.getHeader("host") },
        this._options.headers,
      ));
    var i = this._options.method;
    (((t === 301 || t === 302) && this._options.method === "POST") ||
      (t === 303 && !/^(?:GET|HEAD)$/.test(this._options.method))) &&
      ((this._options.method = "GET"),
      (this._requestBodyBuffers = []),
      fo(/^content-/i, this._options.headers));
    var a = fo(/^host$/i, this._options.headers),
      c = ko(this._currentUrl),
      p = a || c.host,
      u = /^\w+:/.test(n)
        ? this._currentUrl
        : tn.format(Object.assign(c, { host: p })),
      l = Rh(n, u);
    if (
      (Nc("redirecting to", l.href),
      (this._isRedirect = !0),
      xo(l, this._options),
      ((l.protocol !== c.protocol && l.protocol !== "https:") ||
        (l.host !== p && !Ch(l.host, p))) &&
        fo(/^(?:(?:proxy-)?authorization|cookie)$/i, this._options.headers),
      lt(o))
    ) {
      var d = { headers: e.headers, statusCode: t },
        m = { url: u, method: i, headers: s };
      (o(this._options, d, m), this._sanitizeOptions(this._options));
    }
    this._performRequest();
  };
  function Lc(e) {
    var t = { maxRedirects: 21, maxBodyLength: 10485760 },
      n = {};
    return (
      Object.keys(e).forEach(function (s) {
        var o = s + ":",
          i = (n[o] = e[s]),
          a = (t[s] = Object.create(i));
        function c(u, l, d) {
          return (
            Oh(u)
              ? (u = xo(u))
              : ct(u)
                ? (u = xo(ko(u)))
                : ((d = l), (l = Mc(u)), (u = { protocol: o })),
            lt(l) && ((d = l), (l = null)),
            (l = Object.assign(
              { maxRedirects: t.maxRedirects, maxBodyLength: t.maxBodyLength },
              u,
              l,
            )),
            (l.nativeProtocols = n),
            !ct(l.host) && !ct(l.hostname) && (l.hostname = "::1"),
            vo.equal(l.protocol, o, "protocol mismatch"),
            Nc("options", l),
            new Ee(l, d)
          );
        }
        function p(u, l, d) {
          var m = a.request(u, l, d);
          return (m.end(), m);
        }
        Object.defineProperties(a, {
          request: { value: c, configurable: !0, enumerable: !0, writable: !0 },
          get: { value: p, configurable: !0, enumerable: !0, writable: !0 },
        });
      }),
      t
    );
  }
  function qc() {}
  function ko(e) {
    var t;
    if (yo) t = new en(e);
    else if (((t = Mc(tn.parse(e))), !ct(t.protocol)))
      throw new ho({ input: e });
    return t;
  }
  function Rh(e, t) {
    return yo ? new en(e, t) : ko(tn.resolve(t, e));
  }
  function Mc(e) {
    if (/^\[/.test(e.hostname) && !/^\[[:0-9a-f]+\]$/i.test(e.hostname))
      throw new ho({ input: e.href || e });
    if (/^\[/.test(e.host) && !/^\[[:0-9a-f]+\](:\d+)?$/i.test(e.host))
      throw new ho({ input: e.href || e });
    return e;
  }
  function xo(e, t) {
    var n = t || {};
    for (var s of kh) n[s] = e[s];
    return (
      n.hostname.startsWith("[") && (n.hostname = n.hostname.slice(1, -1)),
      n.port !== "" && (n.port = Number(n.port)),
      (n.path = n.search ? n.pathname + n.search : n.pathname),
      n
    );
  }
  function fo(e, t) {
    var n;
    for (var s in t) e.test(s) && ((n = t[s]), delete t[s]);
    return n === null || typeof n > "u" ? void 0 : String(n).trim();
  }
  function nn(e, t, n) {
    function s(o) {
      (lt(Error.captureStackTrace) &&
        Error.captureStackTrace(this, this.constructor),
        Object.assign(this, o || {}),
        (this.code = e),
        (this.message = this.cause ? t + ": " + this.cause.message : t));
    }
    return (
      (s.prototype = new (n || Error)()),
      Object.defineProperties(s.prototype, {
        constructor: { value: s, enumerable: !1 },
        name: { value: "Error [" + e + "]", enumerable: !1 },
      }),
      s
    );
  }
  function _o(e, t) {
    for (var n of $o) e.removeListener(n, wo[n]);
    (e.on("error", qc), e.destroy(t));
  }
  function Ch(e, t) {
    vo(ct(e) && ct(t));
    var n = e.length - t.length - 1;
    return n > 0 && e[n] === "." && e.endsWith(t);
  }
  function ct(e) {
    return typeof e == "string" || e instanceof String;
  }
  function lt(e) {
    return typeof e == "function";
  }
  function Ah(e) {
    return typeof e == "object" && "length" in e;
  }
  function Oh(e) {
    return en && e instanceof en;
  }
  So.exports = Lc({ http: $h, https: wh });
  So.exports.wrap = Lc;
});
var ft = _((jk, Ol) => {
  "use strict";
  var jh = xc(),
    Ph = require("crypto"),
    Nh = require("url"),
    Lh = vc(),
    qh = require("http"),
    Mh = require("https"),
    Fh = require("http2"),
    Ih = require("util"),
    Dh = Fc(),
    Uh = require("zlib"),
    rl = require("stream"),
    Bh = require("events");
  function Me(e) {
    return e && typeof e == "object" && "default" in e ? e : { default: e };
  }
  var cl = Me(jh),
    zh = Me(Ph),
    Wh = Me(Nh),
    Hh = Me(Lh),
    Gh = Me(qh),
    Kh = Me(Mh),
    ll = Me(Fh),
    Bo = Me(Ih),
    Jh = Me(Dh),
    tt = Me(Uh),
    Ue = Me(rl);
  function pl(e, t) {
    return function () {
      return e.apply(t, arguments);
    };
  }
  var { toString: Vh } = Object.prototype,
    { getPrototypeOf: zo } = Object,
    { iterator: Zn, toStringTag: ul } = Symbol,
    es = ((e) => (t) => {
      let n = Vh.call(t);
      return e[n] || (e[n] = n.slice(8, -1).toLowerCase());
    })(Object.create(null)),
    Fe = (e) => ((e = e.toLowerCase()), (t) => es(t) === e),
    ts = (e) => (t) => typeof t === e,
    { isArray: Dt } = Array,
    qt = ts("undefined");
  function an(e) {
    return (
      e !== null &&
      !qt(e) &&
      e.constructor !== null &&
      !qt(e.constructor) &&
      Te(e.constructor.isBuffer) &&
      e.constructor.isBuffer(e)
    );
  }
  var dl = Fe("ArrayBuffer");
  function Yh(e) {
    let t;
    return (
      typeof ArrayBuffer < "u" && ArrayBuffer.isView
        ? (t = ArrayBuffer.isView(e))
        : (t = e && e.buffer && dl(e.buffer)),
      t
    );
  }
  var Xh = ts("string"),
    Te = ts("function"),
    ml = ts("number"),
    rn = (e) => e !== null && typeof e == "object",
    Qh = (e) => e === !0 || e === !1,
    Gn = (e) => {
      if (es(e) !== "object") return !1;
      let t = zo(e);
      return (
        (t === null ||
          t === Object.prototype ||
          Object.getPrototypeOf(t) === null) &&
        !(ul in e) &&
        !(Zn in e)
      );
    },
    Zh = (e) => {
      if (!rn(e) || an(e)) return !1;
      try {
        return (
          Object.keys(e).length === 0 &&
          Object.getPrototypeOf(e) === Object.prototype
        );
      } catch {
        return !1;
      }
    },
    eg = Fe("Date"),
    tg = Fe("File"),
    ng = Fe("Blob"),
    sg = Fe("FileList"),
    og = (e) => rn(e) && Te(e.pipe),
    ig = (e) => {
      let t;
      return (
        e &&
        ((typeof FormData == "function" && e instanceof FormData) ||
          (Te(e.append) &&
            ((t = es(e)) === "formdata" ||
              (t === "object" &&
                Te(e.toString) &&
                e.toString() === "[object FormData]"))))
      );
    },
    ag = Fe("URLSearchParams"),
    [rg, cg, lg, pg] = ["ReadableStream", "Request", "Response", "Headers"].map(
      Fe,
    ),
    ug = (e) =>
      e.trim ? e.trim() : e.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
  function cn(e, t, { allOwnKeys: n = !1 } = {}) {
    if (e === null || typeof e > "u") return;
    let s, o;
    if ((typeof e != "object" && (e = [e]), Dt(e)))
      for (s = 0, o = e.length; s < o; s++) t.call(null, e[s], s, e);
    else {
      if (an(e)) return;
      let i = n ? Object.getOwnPropertyNames(e) : Object.keys(e),
        a = i.length,
        c;
      for (s = 0; s < a; s++) ((c = i[s]), t.call(null, e[c], c, e));
    }
  }
  function fl(e, t) {
    if (an(e)) return null;
    t = t.toLowerCase();
    let n = Object.keys(e),
      s = n.length,
      o;
    for (; s-- > 0; ) if (((o = n[s]), t === o.toLowerCase())) return o;
    return null;
  }
  var pt =
      typeof globalThis < "u"
        ? globalThis
        : typeof self < "u"
          ? self
          : typeof window < "u"
            ? window
            : global,
    hl = (e) => !qt(e) && e !== pt;
  function Oo() {
    let { caseless: e, skipUndefined: t } = (hl(this) && this) || {},
      n = {},
      s = (o, i) => {
        if (i === "__proto__" || i === "constructor" || i === "prototype")
          return;
        let a = (e && fl(n, i)) || i;
        Gn(n[a]) && Gn(o)
          ? (n[a] = Oo(n[a], o))
          : Gn(o)
            ? (n[a] = Oo({}, o))
            : Dt(o)
              ? (n[a] = o.slice())
              : (!t || !qt(o)) && (n[a] = o);
      };
    for (let o = 0, i = arguments.length; o < i; o++)
      arguments[o] && cn(arguments[o], s);
    return n;
  }
  var dg = (e, t, n, { allOwnKeys: s } = {}) => (
      cn(
        t,
        (o, i) => {
          n && Te(o)
            ? Object.defineProperty(e, i, {
                value: pl(o, n),
                writable: !0,
                enumerable: !0,
                configurable: !0,
              })
            : Object.defineProperty(e, i, {
                value: o,
                writable: !0,
                enumerable: !0,
                configurable: !0,
              });
        },
        { allOwnKeys: s },
      ),
      e
    ),
    mg = (e) => (e.charCodeAt(0) === 65279 && (e = e.slice(1)), e),
    fg = (e, t, n, s) => {
      ((e.prototype = Object.create(t.prototype, s)),
        Object.defineProperty(e.prototype, "constructor", {
          value: e,
          writable: !0,
          enumerable: !1,
          configurable: !0,
        }),
        Object.defineProperty(e, "super", { value: t.prototype }),
        n && Object.assign(e.prototype, n));
    },
    hg = (e, t, n, s) => {
      let o,
        i,
        a,
        c = {};
      if (((t = t || {}), e == null)) return t;
      do {
        for (o = Object.getOwnPropertyNames(e), i = o.length; i-- > 0; )
          ((a = o[i]),
            (!s || s(a, e, t)) && !c[a] && ((t[a] = e[a]), (c[a] = !0)));
        e = n !== !1 && zo(e);
      } while (e && (!n || n(e, t)) && e !== Object.prototype);
      return t;
    },
    gg = (e, t, n) => {
      ((e = String(e)),
        (n === void 0 || n > e.length) && (n = e.length),
        (n -= t.length));
      let s = e.indexOf(t, n);
      return s !== -1 && s === n;
    },
    xg = (e) => {
      if (!e) return null;
      if (Dt(e)) return e;
      let t = e.length;
      if (!ml(t)) return null;
      let n = new Array(t);
      for (; t-- > 0; ) n[t] = e[t];
      return n;
    },
    bg = (
      (e) => (t) =>
        e && t instanceof e
    )(typeof Uint8Array < "u" && zo(Uint8Array)),
    vg = (e, t) => {
      let s = (e && e[Zn]).call(e),
        o;
      for (; (o = s.next()) && !o.done; ) {
        let i = o.value;
        t.call(e, i[0], i[1]);
      }
    },
    yg = (e, t) => {
      let n,
        s = [];
      for (; (n = e.exec(t)) !== null; ) s.push(n);
      return s;
    },
    $g = Fe("HTMLFormElement"),
    wg = (e) =>
      e.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g, function (n, s, o) {
        return s.toUpperCase() + o;
      }),
    Ic = (
      ({ hasOwnProperty: e }) =>
      (t, n) =>
        e.call(t, n)
    )(Object.prototype),
    kg = Fe("RegExp"),
    gl = (e, t) => {
      let n = Object.getOwnPropertyDescriptors(e),
        s = {};
      (cn(n, (o, i) => {
        let a;
        (a = t(o, i, e)) !== !1 && (s[i] = a || o);
      }),
        Object.defineProperties(e, s));
    },
    _g = (e) => {
      gl(e, (t, n) => {
        if (Te(e) && ["arguments", "caller", "callee"].indexOf(n) !== -1)
          return !1;
        let s = e[n];
        if (Te(s)) {
          if (((t.enumerable = !1), "writable" in t)) {
            t.writable = !1;
            return;
          }
          t.set ||
            (t.set = () => {
              throw Error("Can not rewrite read-only method '" + n + "'");
            });
        }
      });
    },
    Sg = (e, t) => {
      let n = {},
        s = (o) => {
          o.forEach((i) => {
            n[i] = !0;
          });
        };
      return (Dt(e) ? s(e) : s(String(e).split(t)), n);
    },
    Eg = () => {},
    Tg = (e, t) => (e != null && Number.isFinite((e = +e)) ? e : t);
  function Rg(e) {
    return !!(e && Te(e.append) && e[ul] === "FormData" && e[Zn]);
  }
  var Cg = (e) => {
      let t = new Array(10),
        n = (s, o) => {
          if (rn(s)) {
            if (t.indexOf(s) >= 0) return;
            if (an(s)) return s;
            if (!("toJSON" in s)) {
              t[o] = s;
              let i = Dt(s) ? [] : {};
              return (
                cn(s, (a, c) => {
                  let p = n(a, o + 1);
                  !qt(p) && (i[c] = p);
                }),
                (t[o] = void 0),
                i
              );
            }
          }
          return s;
        };
      return n(e, 0);
    },
    Ag = Fe("AsyncFunction"),
    Og = (e) => e && (rn(e) || Te(e)) && Te(e.then) && Te(e.catch),
    xl = ((e, t) =>
      e
        ? setImmediate
        : t
          ? ((n, s) => (
              pt.addEventListener(
                "message",
                ({ source: o, data: i }) => {
                  o === pt && i === n && s.length && s.shift()();
                },
                !1,
              ),
              (o) => {
                (s.push(o), pt.postMessage(n, "*"));
              }
            ))(`axios@${Math.random()}`, [])
          : (n) => setTimeout(n))(
      typeof setImmediate == "function",
      Te(pt.postMessage),
    ),
    jg =
      typeof queueMicrotask < "u"
        ? queueMicrotask.bind(pt)
        : (typeof process < "u" && process.nextTick) || xl,
    Pg = (e) => e != null && Te(e[Zn]),
    g = {
      isArray: Dt,
      isArrayBuffer: dl,
      isBuffer: an,
      isFormData: ig,
      isArrayBufferView: Yh,
      isString: Xh,
      isNumber: ml,
      isBoolean: Qh,
      isObject: rn,
      isPlainObject: Gn,
      isEmptyObject: Zh,
      isReadableStream: rg,
      isRequest: cg,
      isResponse: lg,
      isHeaders: pg,
      isUndefined: qt,
      isDate: eg,
      isFile: tg,
      isBlob: ng,
      isRegExp: kg,
      isFunction: Te,
      isStream: og,
      isURLSearchParams: ag,
      isTypedArray: bg,
      isFileList: sg,
      forEach: cn,
      merge: Oo,
      extend: dg,
      trim: ug,
      stripBOM: mg,
      inherits: fg,
      toFlatObject: hg,
      kindOf: es,
      kindOfTest: Fe,
      endsWith: gg,
      toArray: xg,
      forEachEntry: vg,
      matchAll: yg,
      isHTMLForm: $g,
      hasOwnProperty: Ic,
      hasOwnProp: Ic,
      reduceDescriptors: gl,
      freezeMethods: _g,
      toObjectSet: Sg,
      toCamelCase: wg,
      noop: Eg,
      toFiniteNumber: Tg,
      findKey: fl,
      global: pt,
      isContextDefined: hl,
      isSpecCompliantForm: Rg,
      toJSONObject: Cg,
      isAsyncFn: Ag,
      isThenable: Og,
      setImmediate: xl,
      asap: jg,
      isIterable: Pg,
    },
    ve = class e extends Error {
      static from(t, n, s, o, i, a) {
        let c = new e(t.message, n || t.code, s, o, i);
        return ((c.cause = t), (c.name = t.name), a && Object.assign(c, a), c);
      }
      constructor(t, n, s, o, i) {
        (super(t),
          (this.name = "AxiosError"),
          (this.isAxiosError = !0),
          n && (this.code = n),
          s && (this.config = s),
          o && (this.request = o),
          i && ((this.response = i), (this.status = i.status)));
      }
      toJSON() {
        return {
          message: this.message,
          name: this.name,
          description: this.description,
          number: this.number,
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          config: g.toJSONObject(this.config),
          code: this.code,
          status: this.status,
        };
      }
    };
  ve.ERR_BAD_OPTION_VALUE = "ERR_BAD_OPTION_VALUE";
  ve.ERR_BAD_OPTION = "ERR_BAD_OPTION";
  ve.ECONNABORTED = "ECONNABORTED";
  ve.ETIMEDOUT = "ETIMEDOUT";
  ve.ERR_NETWORK = "ERR_NETWORK";
  ve.ERR_FR_TOO_MANY_REDIRECTS = "ERR_FR_TOO_MANY_REDIRECTS";
  ve.ERR_DEPRECATED = "ERR_DEPRECATED";
  ve.ERR_BAD_RESPONSE = "ERR_BAD_RESPONSE";
  ve.ERR_BAD_REQUEST = "ERR_BAD_REQUEST";
  ve.ERR_CANCELED = "ERR_CANCELED";
  ve.ERR_NOT_SUPPORT = "ERR_NOT_SUPPORT";
  ve.ERR_INVALID_URL = "ERR_INVALID_URL";
  var A = ve;
  function jo(e) {
    return g.isPlainObject(e) || g.isArray(e);
  }
  function bl(e) {
    return g.endsWith(e, "[]") ? e.slice(0, -2) : e;
  }
  function Dc(e, t, n) {
    return e
      ? e
          .concat(t)
          .map(function (o, i) {
            return ((o = bl(o)), !n && i ? "[" + o + "]" : o);
          })
          .join(n ? "." : "")
      : t;
  }
  function Ng(e) {
    return g.isArray(e) && !e.some(jo);
  }
  var Lg = g.toFlatObject(g, {}, null, function (t) {
    return /^is[A-Z]/.test(t);
  });
  function ns(e, t, n) {
    if (!g.isObject(e)) throw new TypeError("target must be an object");
    ((t = t || new (cl.default || FormData)()),
      (n = g.toFlatObject(
        n,
        { metaTokens: !0, dots: !1, indexes: !1 },
        !1,
        function (x, b) {
          return !g.isUndefined(b[x]);
        },
      )));
    let s = n.metaTokens,
      o = n.visitor || l,
      i = n.dots,
      a = n.indexes,
      p = (n.Blob || (typeof Blob < "u" && Blob)) && g.isSpecCompliantForm(t);
    if (!g.isFunction(o)) throw new TypeError("visitor must be a function");
    function u(f) {
      if (f === null) return "";
      if (g.isDate(f)) return f.toISOString();
      if (g.isBoolean(f)) return f.toString();
      if (!p && g.isBlob(f))
        throw new A("Blob is not supported. Use a Buffer instead.");
      return g.isArrayBuffer(f) || g.isTypedArray(f)
        ? p && typeof Blob == "function"
          ? new Blob([f])
          : Buffer.from(f)
        : f;
    }
    function l(f, x, b) {
      let v = f;
      if (f && !b && typeof f == "object") {
        if (g.endsWith(x, "{}"))
          ((x = s ? x : x.slice(0, -2)), (f = JSON.stringify(f)));
        else if (
          (g.isArray(f) && Ng(f)) ||
          ((g.isFileList(f) || g.endsWith(x, "[]")) && (v = g.toArray(f)))
        )
          return (
            (x = bl(x)),
            v.forEach(function (T, w) {
              !(g.isUndefined(T) || T === null) &&
                t.append(
                  a === !0 ? Dc([x], w, i) : a === null ? x : x + "[]",
                  u(T),
                );
            }),
            !1
          );
      }
      return jo(f) ? !0 : (t.append(Dc(b, x, i), u(f)), !1);
    }
    let d = [],
      m = Object.assign(Lg, {
        defaultVisitor: l,
        convertValue: u,
        isVisitable: jo,
      });
    function h(f, x) {
      if (!g.isUndefined(f)) {
        if (d.indexOf(f) !== -1)
          throw Error("Circular reference detected in " + x.join("."));
        (d.push(f),
          g.forEach(f, function (v, $) {
            (!(g.isUndefined(v) || v === null) &&
              o.call(t, v, g.isString($) ? $.trim() : $, x, m)) === !0 &&
              h(v, x ? x.concat($) : [$]);
          }),
          d.pop());
      }
    }
    if (!g.isObject(e)) throw new TypeError("data must be an object");
    return (h(e), t);
  }
  function Uc(e) {
    let t = {
      "!": "%21",
      "'": "%27",
      "(": "%28",
      ")": "%29",
      "~": "%7E",
      "%20": "+",
      "%00": "\0",
    };
    return encodeURIComponent(e).replace(/[!'()~]|%20|%00/g, function (s) {
      return t[s];
    });
  }
  function vl(e, t) {
    ((this._pairs = []), e && ns(e, this, t));
  }
  var yl = vl.prototype;
  yl.append = function (t, n) {
    this._pairs.push([t, n]);
  };
  yl.toString = function (t) {
    let n = t
      ? function (s) {
          return t.call(this, s, Uc);
        }
      : Uc;
    return this._pairs
      .map(function (o) {
        return n(o[0]) + "=" + n(o[1]);
      }, "")
      .join("&");
  };
  function qg(e) {
    return encodeURIComponent(e)
      .replace(/%3A/gi, ":")
      .replace(/%24/g, "$")
      .replace(/%2C/gi, ",")
      .replace(/%20/g, "+");
  }
  function Wo(e, t, n) {
    if (!t) return e;
    let s = (n && n.encode) || qg,
      o = g.isFunction(n) ? { serialize: n } : n,
      i = o && o.serialize,
      a;
    if (
      (i
        ? (a = i(t, o))
        : (a = g.isURLSearchParams(t)
            ? t.toString()
            : new vl(t, o).toString(s)),
      a)
    ) {
      let c = e.indexOf("#");
      (c !== -1 && (e = e.slice(0, c)),
        (e += (e.indexOf("?") === -1 ? "?" : "&") + a));
    }
    return e;
  }
  var Po = class {
      constructor() {
        this.handlers = [];
      }
      use(t, n, s) {
        return (
          this.handlers.push({
            fulfilled: t,
            rejected: n,
            synchronous: s ? s.synchronous : !1,
            runWhen: s ? s.runWhen : null,
          }),
          this.handlers.length - 1
        );
      }
      eject(t) {
        this.handlers[t] && (this.handlers[t] = null);
      }
      clear() {
        this.handlers && (this.handlers = []);
      }
      forEach(t) {
        g.forEach(this.handlers, function (s) {
          s !== null && t(s);
        });
      }
    },
    Bc = Po,
    ss = {
      silentJSONParsing: !0,
      forcedJSONParsing: !0,
      clarifyTimeoutError: !1,
      legacyInterceptorReqResOrdering: !0,
    },
    Mg = Wh.default.URLSearchParams,
    Eo = "abcdefghijklmnopqrstuvwxyz",
    zc = "0123456789",
    $l = { DIGIT: zc, ALPHA: Eo, ALPHA_DIGIT: Eo + Eo.toUpperCase() + zc },
    Fg = (e = 16, t = $l.ALPHA_DIGIT) => {
      let n = "",
        { length: s } = t,
        o = new Uint32Array(e);
      zh.default.randomFillSync(o);
      for (let i = 0; i < e; i++) n += t[o[i] % s];
      return n;
    },
    Ig = {
      isNode: !0,
      classes: {
        URLSearchParams: Mg,
        FormData: cl.default,
        Blob: (typeof Blob < "u" && Blob) || null,
      },
      ALPHABET: $l,
      generateString: Fg,
      protocols: ["http", "https", "file", "data"],
    },
    Ho = typeof window < "u" && typeof document < "u",
    No = (typeof navigator == "object" && navigator) || void 0,
    Dg =
      Ho &&
      (!No || ["ReactNative", "NativeScript", "NS"].indexOf(No.product) < 0),
    Ug =
      typeof WorkerGlobalScope < "u" &&
      self instanceof WorkerGlobalScope &&
      typeof self.importScripts == "function",
    Bg = (Ho && window.location.href) || "http://localhost",
    zg = Object.freeze({
      __proto__: null,
      hasBrowserEnv: Ho,
      hasStandardBrowserWebWorkerEnv: Ug,
      hasStandardBrowserEnv: Dg,
      navigator: No,
      origin: Bg,
    }),
    Q = { ...zg, ...Ig };
  function Wg(e, t) {
    return ns(e, new Q.classes.URLSearchParams(), {
      visitor: function (n, s, o, i) {
        return Q.isNode && g.isBuffer(n)
          ? (this.append(s, n.toString("base64")), !1)
          : i.defaultVisitor.apply(this, arguments);
      },
      ...t,
    });
  }
  function Hg(e) {
    return g
      .matchAll(/\w+|\[(\w*)]/g, e)
      .map((t) => (t[0] === "[]" ? "" : t[1] || t[0]));
  }
  function Gg(e) {
    let t = {},
      n = Object.keys(e),
      s,
      o = n.length,
      i;
    for (s = 0; s < o; s++) ((i = n[s]), (t[i] = e[i]));
    return t;
  }
  function wl(e) {
    function t(n, s, o, i) {
      let a = n[i++];
      if (a === "__proto__") return !0;
      let c = Number.isFinite(+a),
        p = i >= n.length;
      return (
        (a = !a && g.isArray(o) ? o.length : a),
        p
          ? (g.hasOwnProp(o, a) ? (o[a] = [o[a], s]) : (o[a] = s), !c)
          : ((!o[a] || !g.isObject(o[a])) && (o[a] = []),
            t(n, s, o[a], i) && g.isArray(o[a]) && (o[a] = Gg(o[a])),
            !c)
      );
    }
    if (g.isFormData(e) && g.isFunction(e.entries)) {
      let n = {};
      return (
        g.forEachEntry(e, (s, o) => {
          t(Hg(s), o, n, 0);
        }),
        n
      );
    }
    return null;
  }
  function Kg(e, t, n) {
    if (g.isString(e))
      try {
        return ((t || JSON.parse)(e), g.trim(e));
      } catch (s) {
        if (s.name !== "SyntaxError") throw s;
      }
    return (n || JSON.stringify)(e);
  }
  var Go = {
    transitional: ss,
    adapter: ["xhr", "http", "fetch"],
    transformRequest: [
      function (t, n) {
        let s = n.getContentType() || "",
          o = s.indexOf("application/json") > -1,
          i = g.isObject(t);
        if ((i && g.isHTMLForm(t) && (t = new FormData(t)), g.isFormData(t)))
          return o ? JSON.stringify(wl(t)) : t;
        if (
          g.isArrayBuffer(t) ||
          g.isBuffer(t) ||
          g.isStream(t) ||
          g.isFile(t) ||
          g.isBlob(t) ||
          g.isReadableStream(t)
        )
          return t;
        if (g.isArrayBufferView(t)) return t.buffer;
        if (g.isURLSearchParams(t))
          return (
            n.setContentType(
              "application/x-www-form-urlencoded;charset=utf-8",
              !1,
            ),
            t.toString()
          );
        let c;
        if (i) {
          if (s.indexOf("application/x-www-form-urlencoded") > -1)
            return Wg(t, this.formSerializer).toString();
          if ((c = g.isFileList(t)) || s.indexOf("multipart/form-data") > -1) {
            let p = this.env && this.env.FormData;
            return ns(
              c ? { "files[]": t } : t,
              p && new p(),
              this.formSerializer,
            );
          }
        }
        return i || o ? (n.setContentType("application/json", !1), Kg(t)) : t;
      },
    ],
    transformResponse: [
      function (t) {
        let n = this.transitional || Go.transitional,
          s = n && n.forcedJSONParsing,
          o = this.responseType === "json";
        if (g.isResponse(t) || g.isReadableStream(t)) return t;
        if (t && g.isString(t) && ((s && !this.responseType) || o)) {
          let a = !(n && n.silentJSONParsing) && o;
          try {
            return JSON.parse(t, this.parseReviver);
          } catch (c) {
            if (a)
              throw c.name === "SyntaxError"
                ? A.from(c, A.ERR_BAD_RESPONSE, this, null, this.response)
                : c;
          }
        }
        return t;
      },
    ],
    timeout: 0,
    xsrfCookieName: "XSRF-TOKEN",
    xsrfHeaderName: "X-XSRF-TOKEN",
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: Q.classes.FormData, Blob: Q.classes.Blob },
    validateStatus: function (t) {
      return t >= 200 && t < 300;
    },
    headers: {
      common: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": void 0,
      },
    },
  };
  g.forEach(["delete", "get", "head", "post", "put", "patch"], (e) => {
    Go.headers[e] = {};
  });
  var Ko = Go,
    Jg = g.toObjectSet([
      "age",
      "authorization",
      "content-length",
      "content-type",
      "etag",
      "expires",
      "from",
      "host",
      "if-modified-since",
      "if-unmodified-since",
      "last-modified",
      "location",
      "max-forwards",
      "proxy-authorization",
      "referer",
      "retry-after",
      "user-agent",
    ]),
    Vg = (e) => {
      let t = {},
        n,
        s,
        o;
      return (
        e &&
          e
            .split(
              `
`,
            )
            .forEach(function (a) {
              ((o = a.indexOf(":")),
                (n = a.substring(0, o).trim().toLowerCase()),
                (s = a.substring(o + 1).trim()),
                !(!n || (t[n] && Jg[n])) &&
                  (n === "set-cookie"
                    ? t[n]
                      ? t[n].push(s)
                      : (t[n] = [s])
                    : (t[n] = t[n] ? t[n] + ", " + s : s)));
            }),
        t
      );
    },
    Wc = Symbol("internals");
  function sn(e) {
    return e && String(e).trim().toLowerCase();
  }
  function Kn(e) {
    return e === !1 || e == null ? e : g.isArray(e) ? e.map(Kn) : String(e);
  }
  function Yg(e) {
    let t = Object.create(null),
      n = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g,
      s;
    for (; (s = n.exec(e)); ) t[s[1]] = s[2];
    return t;
  }
  var Xg = (e) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(e.trim());
  function To(e, t, n, s, o) {
    if (g.isFunction(s)) return s.call(this, t, n);
    if ((o && (t = n), !!g.isString(t))) {
      if (g.isString(s)) return t.indexOf(s) !== -1;
      if (g.isRegExp(s)) return s.test(t);
    }
  }
  function Qg(e) {
    return e
      .trim()
      .toLowerCase()
      .replace(/([a-z\d])(\w*)/g, (t, n, s) => n.toUpperCase() + s);
  }
  function Zg(e, t) {
    let n = g.toCamelCase(" " + t);
    ["get", "set", "has"].forEach((s) => {
      Object.defineProperty(e, s + n, {
        value: function (o, i, a) {
          return this[s].call(this, t, o, i, a);
        },
        configurable: !0,
      });
    });
  }
  var Mt = class {
    constructor(t) {
      t && this.set(t);
    }
    set(t, n, s) {
      let o = this;
      function i(c, p, u) {
        let l = sn(p);
        if (!l) throw new Error("header name must be a non-empty string");
        let d = g.findKey(o, l);
        (!d || o[d] === void 0 || u === !0 || (u === void 0 && o[d] !== !1)) &&
          (o[d || p] = Kn(c));
      }
      let a = (c, p) => g.forEach(c, (u, l) => i(u, l, p));
      if (g.isPlainObject(t) || t instanceof this.constructor) a(t, n);
      else if (g.isString(t) && (t = t.trim()) && !Xg(t)) a(Vg(t), n);
      else if (g.isObject(t) && g.isIterable(t)) {
        let c = {},
          p,
          u;
        for (let l of t) {
          if (!g.isArray(l))
            throw TypeError("Object iterator must return a key-value pair");
          c[(u = l[0])] = (p = c[u])
            ? g.isArray(p)
              ? [...p, l[1]]
              : [p, l[1]]
            : l[1];
        }
        a(c, n);
      } else t != null && i(n, t, s);
      return this;
    }
    get(t, n) {
      if (((t = sn(t)), t)) {
        let s = g.findKey(this, t);
        if (s) {
          let o = this[s];
          if (!n) return o;
          if (n === !0) return Yg(o);
          if (g.isFunction(n)) return n.call(this, o, s);
          if (g.isRegExp(n)) return n.exec(o);
          throw new TypeError("parser must be boolean|regexp|function");
        }
      }
    }
    has(t, n) {
      if (((t = sn(t)), t)) {
        let s = g.findKey(this, t);
        return !!(s && this[s] !== void 0 && (!n || To(this, this[s], s, n)));
      }
      return !1;
    }
    delete(t, n) {
      let s = this,
        o = !1;
      function i(a) {
        if (((a = sn(a)), a)) {
          let c = g.findKey(s, a);
          c && (!n || To(s, s[c], c, n)) && (delete s[c], (o = !0));
        }
      }
      return (g.isArray(t) ? t.forEach(i) : i(t), o);
    }
    clear(t) {
      let n = Object.keys(this),
        s = n.length,
        o = !1;
      for (; s--; ) {
        let i = n[s];
        (!t || To(this, this[i], i, t, !0)) && (delete this[i], (o = !0));
      }
      return o;
    }
    normalize(t) {
      let n = this,
        s = {};
      return (
        g.forEach(this, (o, i) => {
          let a = g.findKey(s, i);
          if (a) {
            ((n[a] = Kn(o)), delete n[i]);
            return;
          }
          let c = t ? Qg(i) : String(i).trim();
          (c !== i && delete n[i], (n[c] = Kn(o)), (s[c] = !0));
        }),
        this
      );
    }
    concat(...t) {
      return this.constructor.concat(this, ...t);
    }
    toJSON(t) {
      let n = Object.create(null);
      return (
        g.forEach(this, (s, o) => {
          s != null &&
            s !== !1 &&
            (n[o] = t && g.isArray(s) ? s.join(", ") : s);
        }),
        n
      );
    }
    [Symbol.iterator]() {
      return Object.entries(this.toJSON())[Symbol.iterator]();
    }
    toString() {
      return Object.entries(this.toJSON()).map(([t, n]) => t + ": " + n).join(`
`);
    }
    getSetCookie() {
      return this.get("set-cookie") || [];
    }
    get [Symbol.toStringTag]() {
      return "AxiosHeaders";
    }
    static from(t) {
      return t instanceof this ? t : new this(t);
    }
    static concat(t, ...n) {
      let s = new this(t);
      return (n.forEach((o) => s.set(o)), s);
    }
    static accessor(t) {
      let s = (this[Wc] = this[Wc] = { accessors: {} }).accessors,
        o = this.prototype;
      function i(a) {
        let c = sn(a);
        s[c] || (Zg(o, a), (s[c] = !0));
      }
      return (g.isArray(t) ? t.forEach(i) : i(t), this);
    }
  };
  Mt.accessor([
    "Content-Type",
    "Content-Length",
    "Accept",
    "Accept-Encoding",
    "User-Agent",
    "Authorization",
  ]);
  g.reduceDescriptors(Mt.prototype, ({ value: e }, t) => {
    let n = t[0].toUpperCase() + t.slice(1);
    return {
      get: () => e,
      set(s) {
        this[n] = s;
      },
    };
  });
  g.freezeMethods(Mt);
  var Re = Mt;
  function Ro(e, t) {
    let n = this || Ko,
      s = t || n,
      o = Re.from(s.headers),
      i = s.data;
    return (
      g.forEach(e, function (c) {
        i = c.call(n, i, o.normalize(), t ? t.status : void 0);
      }),
      o.normalize(),
      i
    );
  }
  function kl(e) {
    return !!(e && e.__CANCEL__);
  }
  var Lo = class extends A {
      constructor(t, n, s) {
        (super(t ?? "canceled", A.ERR_CANCELED, n, s),
          (this.name = "CanceledError"),
          (this.__CANCEL__ = !0));
      }
    },
    dt = Lo;
  function Lt(e, t, n) {
    let s = n.config.validateStatus;
    !n.status || !s || s(n.status)
      ? e(n)
      : t(
          new A(
            "Request failed with status code " + n.status,
            [A.ERR_BAD_REQUEST, A.ERR_BAD_RESPONSE][
              Math.floor(n.status / 100) - 4
            ],
            n.config,
            n.request,
            n,
          ),
        );
  }
  function ex(e) {
    return typeof e != "string" ? !1 : /^([a-z][a-z\d+\-.]*:)?\/\//i.test(e);
  }
  function tx(e, t) {
    return t ? e.replace(/\/?\/$/, "") + "/" + t.replace(/^\/+/, "") : e;
  }
  function Jo(e, t, n) {
    let s = !ex(t);
    return e && (s || n == !1) ? tx(e, t) : t;
  }
  var Yn = "1.13.5";
  function _l(e) {
    let t = /^([-+\w]{1,25})(:?\/\/|:)/.exec(e);
    return (t && t[1]) || "";
  }
  var nx = /^(?:([^;]+);)?(?:[^;]+;)?(base64|),([\s\S]*)$/;
  function sx(e, t, n) {
    let s = (n && n.Blob) || Q.classes.Blob,
      o = _l(e);
    if ((t === void 0 && s && (t = !0), o === "data")) {
      e = o.length ? e.slice(o.length + 1) : e;
      let i = nx.exec(e);
      if (!i) throw new A("Invalid URL", A.ERR_INVALID_URL);
      let a = i[1],
        c = i[2],
        p = i[3],
        u = Buffer.from(decodeURIComponent(p), c ? "base64" : "utf8");
      if (t) {
        if (!s) throw new A("Blob is not supported", A.ERR_NOT_SUPPORT);
        return new s([u], { type: a });
      }
      return u;
    }
    throw new A("Unsupported protocol " + o, A.ERR_NOT_SUPPORT);
  }
  var Co = Symbol("internals"),
    qo = class extends Ue.default.Transform {
      constructor(t) {
        ((t = g.toFlatObject(
          t,
          {
            maxRate: 0,
            chunkSize: 64 * 1024,
            minChunkSize: 100,
            timeWindow: 500,
            ticksRate: 2,
            samplesCount: 15,
          },
          null,
          (s, o) => !g.isUndefined(o[s]),
        )),
          super({ readableHighWaterMark: t.chunkSize }));
        let n = (this[Co] = {
          timeWindow: t.timeWindow,
          chunkSize: t.chunkSize,
          maxRate: t.maxRate,
          minChunkSize: t.minChunkSize,
          bytesSeen: 0,
          isCaptured: !1,
          notifiedBytesLoaded: 0,
          ts: Date.now(),
          bytes: 0,
          onReadCallback: null,
        });
        this.on("newListener", (s) => {
          s === "progress" && (n.isCaptured || (n.isCaptured = !0));
        });
      }
      _read(t) {
        let n = this[Co];
        return (n.onReadCallback && n.onReadCallback(), super._read(t));
      }
      _transform(t, n, s) {
        let o = this[Co],
          i = o.maxRate,
          a = this.readableHighWaterMark,
          c = o.timeWindow,
          p = 1e3 / c,
          u = i / p,
          l = o.minChunkSize !== !1 ? Math.max(o.minChunkSize, u * 0.01) : 0,
          d = (h, f) => {
            let x = Buffer.byteLength(h);
            ((o.bytesSeen += x),
              (o.bytes += x),
              o.isCaptured && this.emit("progress", o.bytesSeen),
              this.push(h)
                ? process.nextTick(f)
                : (o.onReadCallback = () => {
                    ((o.onReadCallback = null), process.nextTick(f));
                  }));
          },
          m = (h, f) => {
            let x = Buffer.byteLength(h),
              b = null,
              v = a,
              $,
              T = 0;
            if (i) {
              let w = Date.now();
              ((!o.ts || (T = w - o.ts) >= c) &&
                ((o.ts = w),
                ($ = u - o.bytes),
                (o.bytes = $ < 0 ? -$ : 0),
                (T = 0)),
                ($ = u - o.bytes));
            }
            if (i) {
              if ($ <= 0)
                return setTimeout(() => {
                  f(null, h);
                }, c - T);
              $ < v && (v = $);
            }
            (v &&
              x > v &&
              x - v > l &&
              ((b = h.subarray(v)), (h = h.subarray(0, v))),
              d(
                h,
                b
                  ? () => {
                      process.nextTick(f, null, b);
                    }
                  : f,
              ));
          };
        m(t, function h(f, x) {
          if (f) return s(f);
          x ? m(x, h) : s(null);
        });
      }
    },
    Hc = qo,
    { asyncIterator: Gc } = Symbol,
    ox = async function* (e) {
      e.stream
        ? yield* e.stream()
        : e.arrayBuffer
          ? yield await e.arrayBuffer()
          : e[Gc]
            ? yield* e[Gc]()
            : yield e;
    },
    Sl = ox,
    ix = Q.ALPHABET.ALPHA_DIGIT + "-_",
    on =
      typeof TextEncoder == "function"
        ? new TextEncoder()
        : new Bo.default.TextEncoder(),
    ut = `\r
`,
    ax = on.encode(ut),
    rx = 2,
    Mo = class {
      constructor(t, n) {
        let { escapeName: s } = this.constructor,
          o = g.isString(n),
          i = `Content-Disposition: form-data; name="${s(t)}"${!o && n.name ? `; filename="${s(n.name)}"` : ""}${ut}`;
        (o
          ? (n = on.encode(String(n).replace(/\r?\n|\r\n?/g, ut)))
          : (i += `Content-Type: ${n.type || "application/octet-stream"}${ut}`),
          (this.headers = on.encode(i + ut)),
          (this.contentLength = o ? n.byteLength : n.size),
          (this.size = this.headers.byteLength + this.contentLength + rx),
          (this.name = t),
          (this.value = n));
      }
      async *encode() {
        yield this.headers;
        let { value: t } = this;
        (g.isTypedArray(t) ? yield t : yield* Sl(t), yield ax);
      }
      static escapeName(t) {
        return String(t).replace(
          /[\r\n"]/g,
          (n) => ({ "\r": "%0D", "\n": "%0A", '"': "%22" })[n],
        );
      }
    },
    cx = (e, t, n) => {
      let {
        tag: s = "form-data-boundary",
        size: o = 25,
        boundary: i = s + "-" + Q.generateString(o, ix),
      } = n || {};
      if (!g.isFormData(e)) throw TypeError("FormData instance required");
      if (i.length < 1 || i.length > 70)
        throw Error("boundary must be 10-70 characters long");
      let a = on.encode("--" + i + ut),
        c = on.encode("--" + i + "--" + ut),
        p = c.byteLength,
        u = Array.from(e.entries()).map(([d, m]) => {
          let h = new Mo(d, m);
          return ((p += h.size), h);
        });
      ((p += a.byteLength * u.length), (p = g.toFiniteNumber(p)));
      let l = { "Content-Type": `multipart/form-data; boundary=${i}` };
      return (
        Number.isFinite(p) && (l["Content-Length"] = p),
        t && t(l),
        rl.Readable.from(
          (async function* () {
            for (let d of u) (yield a, yield* d.encode());
            yield c;
          })(),
        )
      );
    },
    lx = cx,
    Fo = class extends Ue.default.Transform {
      __transform(t, n, s) {
        (this.push(t), s());
      }
      _transform(t, n, s) {
        if (
          t.length !== 0 &&
          ((this._transform = this.__transform), t[0] !== 120)
        ) {
          let o = Buffer.alloc(2);
          ((o[0] = 120), (o[1] = 156), this.push(o, n));
        }
        this.__transform(t, n, s);
      }
    },
    px = Fo,
    ux = (e, t) =>
      g.isAsyncFn(e)
        ? function (...n) {
            let s = n.pop();
            e.apply(this, n).then((o) => {
              try {
                t ? s(null, ...t(o)) : s(null, o);
              } catch (i) {
                s(i);
              }
            }, s);
          }
        : e,
    dx = ux;
  function mx(e, t) {
    e = e || 10;
    let n = new Array(e),
      s = new Array(e),
      o = 0,
      i = 0,
      a;
    return (
      (t = t !== void 0 ? t : 1e3),
      function (p) {
        let u = Date.now(),
          l = s[i];
        (a || (a = u), (n[o] = p), (s[o] = u));
        let d = i,
          m = 0;
        for (; d !== o; ) ((m += n[d++]), (d = d % e));
        if (((o = (o + 1) % e), o === i && (i = (i + 1) % e), u - a < t))
          return;
        let h = l && u - l;
        return h ? Math.round((m * 1e3) / h) : void 0;
      }
    );
  }
  function fx(e, t) {
    let n = 0,
      s = 1e3 / t,
      o,
      i,
      a = (u, l = Date.now()) => {
        ((n = l), (o = null), i && (clearTimeout(i), (i = null)), e(...u));
      };
    return [
      (...u) => {
        let l = Date.now(),
          d = l - n;
        d >= s
          ? a(u, l)
          : ((o = u),
            i ||
              (i = setTimeout(() => {
                ((i = null), a(o));
              }, s - d)));
      },
      () => o && a(o),
    ];
  }
  var Ft = (e, t, n = 3) => {
      let s = 0,
        o = mx(50, 250);
      return fx((i) => {
        let a = i.loaded,
          c = i.lengthComputable ? i.total : void 0,
          p = a - s,
          u = o(p),
          l = a <= c;
        s = a;
        let d = {
          loaded: a,
          total: c,
          progress: c ? a / c : void 0,
          bytes: p,
          rate: u || void 0,
          estimated: u && c && l ? (c - a) / u : void 0,
          event: i,
          lengthComputable: c != null,
          [t ? "download" : "upload"]: !0,
        };
        e(d);
      }, n);
    },
    Xn = (e, t) => {
      let n = e != null;
      return [(s) => t[0]({ lengthComputable: n, total: e, loaded: s }), t[1]];
    },
    Qn =
      (e) =>
      (...t) =>
        g.asap(() => e(...t));
  function hx(e) {
    if (!e || typeof e != "string" || !e.startsWith("data:")) return 0;
    let t = e.indexOf(",");
    if (t < 0) return 0;
    let n = e.slice(5, t),
      s = e.slice(t + 1);
    if (/;base64/i.test(n)) {
      let i = s.length,
        a = s.length;
      for (let m = 0; m < a; m++)
        if (s.charCodeAt(m) === 37 && m + 2 < a) {
          let h = s.charCodeAt(m + 1),
            f = s.charCodeAt(m + 2);
          ((h >= 48 && h <= 57) ||
            (h >= 65 && h <= 70) ||
            (h >= 97 && h <= 102)) &&
            ((f >= 48 && f <= 57) ||
              (f >= 65 && f <= 70) ||
              (f >= 97 && f <= 102)) &&
            ((i -= 2), (m += 2));
        }
      let c = 0,
        p = a - 1,
        u = (m) =>
          m >= 2 &&
          s.charCodeAt(m - 2) === 37 &&
          s.charCodeAt(m - 1) === 51 &&
          (s.charCodeAt(m) === 68 || s.charCodeAt(m) === 100);
      (p >= 0 &&
        (s.charCodeAt(p) === 61 ? (c++, p--) : u(p) && (c++, (p -= 3))),
        c === 1 && p >= 0 && (s.charCodeAt(p) === 61 || u(p)) && c++);
      let d = Math.floor(i / 4) * 3 - (c || 0);
      return d > 0 ? d : 0;
    }
    return Buffer.byteLength(s, "utf8");
  }
  var Kc = {
      flush: tt.default.constants.Z_SYNC_FLUSH,
      finishFlush: tt.default.constants.Z_SYNC_FLUSH,
    },
    gx = {
      flush: tt.default.constants.BROTLI_OPERATION_FLUSH,
      finishFlush: tt.default.constants.BROTLI_OPERATION_FLUSH,
    },
    Jc = g.isFunction(tt.default.createBrotliDecompress),
    { http: xx, https: bx } = Jh.default,
    vx = /https:?/,
    Vc = Q.protocols.map((e) => e + ":"),
    Yc = (e, [t, n]) => (e.on("end", n).on("error", n), t),
    Io = class {
      constructor() {
        this.sessions = Object.create(null);
      }
      getSession(t, n) {
        n = Object.assign({ sessionTimeout: 1e3 }, n);
        let s = this.sessions[t];
        if (s) {
          let l = s.length;
          for (let d = 0; d < l; d++) {
            let [m, h] = s[d];
            if (!m.destroyed && !m.closed && Bo.default.isDeepStrictEqual(h, n))
              return m;
          }
        }
        let o = ll.default.connect(t, n),
          i,
          a = () => {
            if (i) return;
            i = !0;
            let l = s,
              d = l.length,
              m = d;
            for (; m--; )
              if (l[m][0] === o) {
                d === 1 ? delete this.sessions[t] : l.splice(m, 1);
                return;
              }
          },
          c = o.request,
          { sessionTimeout: p } = n;
        if (p != null) {
          let l,
            d = 0;
          o.request = function () {
            let m = c.apply(this, arguments);
            return (
              d++,
              l && (clearTimeout(l), (l = null)),
              m.once("close", () => {
                --d ||
                  (l = setTimeout(() => {
                    ((l = null), a());
                  }, p));
              }),
              m
            );
          };
        }
        o.once("close", a);
        let u = [o, n];
        return (s ? s.push(u) : (s = this.sessions[t] = [u]), o);
      }
    },
    yx = new Io();
  function $x(e, t) {
    (e.beforeRedirects.proxy && e.beforeRedirects.proxy(e),
      e.beforeRedirects.config && e.beforeRedirects.config(e, t));
  }
  function El(e, t, n) {
    let s = t;
    if (!s && s !== !1) {
      let o = Hh.default.getProxyForUrl(n);
      o && (s = new URL(o));
    }
    if (s) {
      if (
        (s.username && (s.auth = (s.username || "") + ":" + (s.password || "")),
        s.auth)
      ) {
        if (!!(s.auth.username || s.auth.password))
          s.auth = (s.auth.username || "") + ":" + (s.auth.password || "");
        else if (typeof s.auth == "object")
          throw new A("Invalid proxy authorization", A.ERR_BAD_OPTION, {
            proxy: s,
          });
        let a = Buffer.from(s.auth, "utf8").toString("base64");
        e.headers["Proxy-Authorization"] = "Basic " + a;
      }
      e.headers.host = e.hostname + (e.port ? ":" + e.port : "");
      let o = s.hostname || s.host;
      ((e.hostname = o),
        (e.host = o),
        (e.port = s.port),
        (e.path = n),
        s.protocol &&
          (e.protocol = s.protocol.includes(":")
            ? s.protocol
            : `${s.protocol}:`));
    }
    e.beforeRedirects.proxy = function (i) {
      El(i, t, i.href);
    };
  }
  var wx = typeof process < "u" && g.kindOf(process) === "process",
    kx = (e) =>
      new Promise((t, n) => {
        let s,
          o,
          i = (p, u) => {
            o || ((o = !0), s && s(p, u));
          },
          a = (p) => {
            (i(p), t(p));
          },
          c = (p) => {
            (i(p, !0), n(p));
          };
        e(a, c, (p) => (s = p)).catch(c);
      }),
    _x = ({ address: e, family: t }) => {
      if (!g.isString(e)) throw TypeError("address must be a string");
      return { address: e, family: t || (e.indexOf(".") < 0 ? 6 : 4) };
    },
    Xc = (e, t) => _x(g.isObject(e) ? e : { address: e, family: t }),
    Sx = {
      request(e, t) {
        let n =
            e.protocol +
            "//" +
            e.hostname +
            ":" +
            (e.port || (e.protocol === "https:" ? 443 : 80)),
          { http2Options: s, headers: o } = e,
          i = yx.getSession(n, s),
          {
            HTTP2_HEADER_SCHEME: a,
            HTTP2_HEADER_METHOD: c,
            HTTP2_HEADER_PATH: p,
            HTTP2_HEADER_STATUS: u,
          } = ll.default.constants,
          l = { [a]: e.protocol.replace(":", ""), [c]: e.method, [p]: e.path };
        g.forEach(o, (m, h) => {
          h.charAt(0) !== ":" && (l[h] = m);
        });
        let d = i.request(l);
        return (
          d.once("response", (m) => {
            let h = d;
            m = Object.assign({}, m);
            let f = m[u];
            (delete m[u], (h.headers = m), (h.statusCode = +f), t(h));
          }),
          d
        );
      },
    },
    Ex =
      wx &&
      function (t) {
        return kx(async function (s, o, i) {
          let {
              data: a,
              lookup: c,
              family: p,
              httpVersion: u = 1,
              http2Options: l,
            } = t,
            { responseType: d, responseEncoding: m } = t,
            h = t.method.toUpperCase(),
            f,
            x = !1,
            b;
          if (((u = +u), Number.isNaN(u)))
            throw TypeError(
              `Invalid protocol version: '${t.httpVersion}' is not a number`,
            );
          if (u !== 1 && u !== 2)
            throw TypeError(`Unsupported protocol version '${u}'`);
          let v = u === 2;
          if (c) {
            let N = dx(c, (O) => (g.isArray(O) ? O : [O]));
            c = (O, U, le) => {
              N(O, U, (H, ke, j) => {
                if (H) return le(H);
                let L = g.isArray(ke) ? ke.map((je) => Xc(je)) : [Xc(ke, j)];
                U.all ? le(H, L) : le(H, L[0].address, L[0].family);
              });
            };
          }
          let $ = new Bh.EventEmitter();
          function T(N) {
            try {
              $.emit("abort", !N || N.type ? new dt(null, t, b) : N);
            } catch (O) {
              console.warn("emit error", O);
            }
          }
          $.once("abort", o);
          let w = () => {
            (t.cancelToken && t.cancelToken.unsubscribe(T),
              t.signal && t.signal.removeEventListener("abort", T),
              $.removeAllListeners());
          };
          ((t.cancelToken || t.signal) &&
            (t.cancelToken && t.cancelToken.subscribe(T),
            t.signal &&
              (t.signal.aborted ? T() : t.signal.addEventListener("abort", T))),
            i((N, O) => {
              if (((f = !0), O)) {
                ((x = !0), w());
                return;
              }
              let { data: U } = N;
              if (
                U instanceof Ue.default.Readable ||
                U instanceof Ue.default.Duplex
              ) {
                let le = Ue.default.finished(U, () => {
                  (le(), w());
                });
              } else w();
            }));
          let R = Jo(t.baseURL, t.url, t.allowAbsoluteUrls),
            S = new URL(R, Q.hasBrowserEnv ? Q.origin : void 0),
            E = S.protocol || Vc[0];
          if (E === "data:") {
            if (t.maxContentLength > -1) {
              let O = String(t.url || R || "");
              if (hx(O) > t.maxContentLength)
                return o(
                  new A(
                    "maxContentLength size of " +
                      t.maxContentLength +
                      " exceeded",
                    A.ERR_BAD_RESPONSE,
                    t,
                  ),
                );
            }
            let N;
            if (h !== "GET")
              return Lt(s, o, {
                status: 405,
                statusText: "method not allowed",
                headers: {},
                config: t,
              });
            try {
              N = sx(t.url, d === "blob", { Blob: t.env && t.env.Blob });
            } catch (O) {
              throw A.from(O, A.ERR_BAD_REQUEST, t);
            }
            return (
              d === "text"
                ? ((N = N.toString(m)),
                  (!m || m === "utf8") && (N = g.stripBOM(N)))
                : d === "stream" && (N = Ue.default.Readable.from(N)),
              Lt(s, o, {
                data: N,
                status: 200,
                statusText: "OK",
                headers: new Re(),
                config: t,
              })
            );
          }
          if (Vc.indexOf(E) === -1)
            return o(new A("Unsupported protocol " + E, A.ERR_BAD_REQUEST, t));
          let C = Re.from(t.headers).normalize();
          C.set("User-Agent", "axios/" + Yn, !1);
          let { onUploadProgress: M, onDownloadProgress: F } = t,
            B = t.maxRate,
            W,
            ne;
          if (g.isSpecCompliantForm(a)) {
            let N = C.getContentType(/boundary=([-_\w\d]{10,70})/i);
            a = lx(
              a,
              (O) => {
                C.set(O);
              },
              { tag: `axios-${Yn}-boundary`, boundary: (N && N[1]) || void 0 },
            );
          } else if (g.isFormData(a) && g.isFunction(a.getHeaders)) {
            if ((C.set(a.getHeaders()), !C.hasContentLength()))
              try {
                let N = await Bo.default.promisify(a.getLength).call(a);
                Number.isFinite(N) && N >= 0 && C.setContentLength(N);
              } catch {}
          } else if (g.isBlob(a) || g.isFile(a))
            (a.size && C.setContentType(a.type || "application/octet-stream"),
              C.setContentLength(a.size || 0),
              (a = Ue.default.Readable.from(Sl(a))));
          else if (a && !g.isStream(a)) {
            if (!Buffer.isBuffer(a))
              if (g.isArrayBuffer(a)) a = Buffer.from(new Uint8Array(a));
              else if (g.isString(a)) a = Buffer.from(a, "utf-8");
              else
                return o(
                  new A(
                    "Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream",
                    A.ERR_BAD_REQUEST,
                    t,
                  ),
                );
            if (
              (C.setContentLength(a.length, !1),
              t.maxBodyLength > -1 && a.length > t.maxBodyLength)
            )
              return o(
                new A(
                  "Request body larger than maxBodyLength limit",
                  A.ERR_BAD_REQUEST,
                  t,
                ),
              );
          }
          let se = g.toFiniteNumber(C.getContentLength());
          (g.isArray(B) ? ((W = B[0]), (ne = B[1])) : (W = ne = B),
            a &&
              (M || W) &&
              (g.isStream(a) ||
                (a = Ue.default.Readable.from(a, { objectMode: !1 })),
              (a = Ue.default.pipeline(
                [a, new Hc({ maxRate: g.toFiniteNumber(W) })],
                g.noop,
              )),
              M && a.on("progress", Yc(a, Xn(se, Ft(Qn(M), !1, 3))))));
          let ge;
          if (t.auth) {
            let N = t.auth.username || "",
              O = t.auth.password || "";
            ge = N + ":" + O;
          }
          if (!ge && S.username) {
            let N = S.username,
              O = S.password;
            ge = N + ":" + O;
          }
          ge && C.delete("authorization");
          let oe;
          try {
            oe = Wo(
              S.pathname + S.search,
              t.params,
              t.paramsSerializer,
            ).replace(/^\?/, "");
          } catch (N) {
            let O = new Error(N.message);
            return ((O.config = t), (O.url = t.url), (O.exists = !0), o(O));
          }
          C.set(
            "Accept-Encoding",
            "gzip, compress, deflate" + (Jc ? ", br" : ""),
            !1,
          );
          let Z = {
            path: oe,
            method: h,
            headers: C.toJSON(),
            agents: { http: t.httpAgent, https: t.httpsAgent },
            auth: ge,
            protocol: E,
            family: p,
            beforeRedirect: $x,
            beforeRedirects: {},
            http2Options: l,
          };
          (!g.isUndefined(c) && (Z.lookup = c),
            t.socketPath
              ? (Z.socketPath = t.socketPath)
              : ((Z.hostname = S.hostname.startsWith("[")
                  ? S.hostname.slice(1, -1)
                  : S.hostname),
                (Z.port = S.port),
                El(
                  Z,
                  t.proxy,
                  E + "//" + S.hostname + (S.port ? ":" + S.port : "") + Z.path,
                )));
          let ce,
            Ge = vx.test(Z.protocol);
          if (
            ((Z.agent = Ge ? t.httpsAgent : t.httpAgent),
            v
              ? (ce = Sx)
              : t.transport
                ? (ce = t.transport)
                : t.maxRedirects === 0
                  ? (ce = Ge ? Kh.default : Gh.default)
                  : (t.maxRedirects && (Z.maxRedirects = t.maxRedirects),
                    t.beforeRedirect &&
                      (Z.beforeRedirects.config = t.beforeRedirect),
                    (ce = Ge ? bx : xx)),
            t.maxBodyLength > -1
              ? (Z.maxBodyLength = t.maxBodyLength)
              : (Z.maxBodyLength = 1 / 0),
            t.insecureHTTPParser &&
              (Z.insecureHTTPParser = t.insecureHTTPParser),
            (b = ce.request(Z, function (O) {
              if (b.destroyed) return;
              let U = [O],
                le = g.toFiniteNumber(O.headers["content-length"]);
              if (F || ne) {
                let L = new Hc({ maxRate: g.toFiniteNumber(ne) });
                (F && L.on("progress", Yc(L, Xn(le, Ft(Qn(F), !0, 3)))),
                  U.push(L));
              }
              let H = O,
                ke = O.req || b;
              if (t.decompress !== !1 && O.headers["content-encoding"])
                switch (
                  ((h === "HEAD" || O.statusCode === 204) &&
                    delete O.headers["content-encoding"],
                  (O.headers["content-encoding"] || "").toLowerCase())
                ) {
                  case "gzip":
                  case "x-gzip":
                  case "compress":
                  case "x-compress":
                    (U.push(tt.default.createUnzip(Kc)),
                      delete O.headers["content-encoding"]);
                    break;
                  case "deflate":
                    (U.push(new px()),
                      U.push(tt.default.createUnzip(Kc)),
                      delete O.headers["content-encoding"]);
                    break;
                  case "br":
                    Jc &&
                      (U.push(tt.default.createBrotliDecompress(gx)),
                      delete O.headers["content-encoding"]);
                }
              H = U.length > 1 ? Ue.default.pipeline(U, g.noop) : U[0];
              let j = {
                status: O.statusCode,
                statusText: O.statusMessage,
                headers: new Re(O.headers),
                config: t,
                request: ke,
              };
              if (d === "stream") ((j.data = H), Lt(s, o, j));
              else {
                let L = [],
                  je = 0;
                (H.on("data", function (G) {
                  (L.push(G),
                    (je += G.length),
                    t.maxContentLength > -1 &&
                      je > t.maxContentLength &&
                      ((x = !0),
                      H.destroy(),
                      T(
                        new A(
                          "maxContentLength size of " +
                            t.maxContentLength +
                            " exceeded",
                          A.ERR_BAD_RESPONSE,
                          t,
                          ke,
                        ),
                      )));
                }),
                  H.on("aborted", function () {
                    if (x) return;
                    let G = new A(
                      "stream has been aborted",
                      A.ERR_BAD_RESPONSE,
                      t,
                      ke,
                    );
                    (H.destroy(G), o(G));
                  }),
                  H.on("error", function (G) {
                    b.destroyed || o(A.from(G, null, t, ke));
                  }),
                  H.on("end", function () {
                    try {
                      let G = L.length === 1 ? L[0] : Buffer.concat(L);
                      (d !== "arraybuffer" &&
                        ((G = G.toString(m)),
                        (!m || m === "utf8") && (G = g.stripBOM(G))),
                        (j.data = G));
                    } catch (G) {
                      return o(A.from(G, null, t, j.request, j));
                    }
                    Lt(s, o, j);
                  }));
              }
              $.once("abort", (L) => {
                H.destroyed || (H.emit("error", L), H.destroy());
              });
            })),
            $.once("abort", (N) => {
              b.close ? b.close() : b.destroy(N);
            }),
            b.on("error", function (O) {
              o(A.from(O, null, t, b));
            }),
            b.on("socket", function (O) {
              O.setKeepAlive(!0, 1e3 * 60);
            }),
            t.timeout)
          ) {
            let N = parseInt(t.timeout, 10);
            if (Number.isNaN(N)) {
              T(
                new A(
                  "error trying to parse `config.timeout` to int",
                  A.ERR_BAD_OPTION_VALUE,
                  t,
                  b,
                ),
              );
              return;
            }
            b.setTimeout(N, function () {
              if (f) return;
              let U = t.timeout
                  ? "timeout of " + t.timeout + "ms exceeded"
                  : "timeout exceeded",
                le = t.transitional || ss;
              (t.timeoutErrorMessage && (U = t.timeoutErrorMessage),
                T(
                  new A(
                    U,
                    le.clarifyTimeoutError ? A.ETIMEDOUT : A.ECONNABORTED,
                    t,
                    b,
                  ),
                ));
            });
          } else b.setTimeout(0);
          if (g.isStream(a)) {
            let N = !1,
              O = !1;
            (a.on("end", () => {
              N = !0;
            }),
              a.once("error", (U) => {
                ((O = !0), b.destroy(U));
              }),
              a.on("close", () => {
                !N && !O && T(new dt("Request stream has been aborted", t, b));
              }),
              a.pipe(b));
          } else (a && b.write(a), b.end());
        });
      },
    Tx = Q.hasStandardBrowserEnv
      ? ((e, t) => (n) => (
          (n = new URL(n, Q.origin)),
          e.protocol === n.protocol &&
            e.host === n.host &&
            (t || e.port === n.port)
        ))(
          new URL(Q.origin),
          Q.navigator && /(msie|trident)/i.test(Q.navigator.userAgent),
        )
      : () => !0,
    Rx = Q.hasStandardBrowserEnv
      ? {
          write(e, t, n, s, o, i, a) {
            if (typeof document > "u") return;
            let c = [`${e}=${encodeURIComponent(t)}`];
            (g.isNumber(n) && c.push(`expires=${new Date(n).toUTCString()}`),
              g.isString(s) && c.push(`path=${s}`),
              g.isString(o) && c.push(`domain=${o}`),
              i === !0 && c.push("secure"),
              g.isString(a) && c.push(`SameSite=${a}`),
              (document.cookie = c.join("; ")));
          },
          read(e) {
            if (typeof document > "u") return null;
            let t = document.cookie.match(
              new RegExp("(?:^|; )" + e + "=([^;]*)"),
            );
            return t ? decodeURIComponent(t[1]) : null;
          },
          remove(e) {
            this.write(e, "", Date.now() - 864e5, "/");
          },
        }
      : {
          write() {},
          read() {
            return null;
          },
          remove() {},
        },
    Qc = (e) => (e instanceof Re ? { ...e } : e);
  function mt(e, t) {
    t = t || {};
    let n = {};
    function s(u, l, d, m) {
      return g.isPlainObject(u) && g.isPlainObject(l)
        ? g.merge.call({ caseless: m }, u, l)
        : g.isPlainObject(l)
          ? g.merge({}, l)
          : g.isArray(l)
            ? l.slice()
            : l;
    }
    function o(u, l, d, m) {
      if (g.isUndefined(l)) {
        if (!g.isUndefined(u)) return s(void 0, u, d, m);
      } else return s(u, l, d, m);
    }
    function i(u, l) {
      if (!g.isUndefined(l)) return s(void 0, l);
    }
    function a(u, l) {
      if (g.isUndefined(l)) {
        if (!g.isUndefined(u)) return s(void 0, u);
      } else return s(void 0, l);
    }
    function c(u, l, d) {
      if (d in t) return s(u, l);
      if (d in e) return s(void 0, u);
    }
    let p = {
      url: i,
      method: i,
      data: i,
      baseURL: a,
      transformRequest: a,
      transformResponse: a,
      paramsSerializer: a,
      timeout: a,
      timeoutMessage: a,
      withCredentials: a,
      withXSRFToken: a,
      adapter: a,
      responseType: a,
      xsrfCookieName: a,
      xsrfHeaderName: a,
      onUploadProgress: a,
      onDownloadProgress: a,
      decompress: a,
      maxContentLength: a,
      maxBodyLength: a,
      beforeRedirect: a,
      transport: a,
      httpAgent: a,
      httpsAgent: a,
      cancelToken: a,
      socketPath: a,
      responseEncoding: a,
      validateStatus: c,
      headers: (u, l, d) => o(Qc(u), Qc(l), d, !0),
    };
    return (
      g.forEach(Object.keys({ ...e, ...t }), function (l) {
        if (l === "__proto__" || l === "constructor" || l === "prototype")
          return;
        let d = g.hasOwnProp(p, l) ? p[l] : o,
          m = d(e[l], t[l], l);
        (g.isUndefined(m) && d !== c) || (n[l] = m);
      }),
      n
    );
  }
  var Tl = (e) => {
      let t = mt({}, e),
        {
          data: n,
          withXSRFToken: s,
          xsrfHeaderName: o,
          xsrfCookieName: i,
          headers: a,
          auth: c,
        } = t;
      if (
        ((t.headers = a = Re.from(a)),
        (t.url = Wo(
          Jo(t.baseURL, t.url, t.allowAbsoluteUrls),
          e.params,
          e.paramsSerializer,
        )),
        c &&
          a.set(
            "Authorization",
            "Basic " +
              btoa(
                (c.username || "") +
                  ":" +
                  (c.password ? unescape(encodeURIComponent(c.password)) : ""),
              ),
          ),
        g.isFormData(n))
      ) {
        if (Q.hasStandardBrowserEnv || Q.hasStandardBrowserWebWorkerEnv)
          a.setContentType(void 0);
        else if (g.isFunction(n.getHeaders)) {
          let p = n.getHeaders(),
            u = ["content-type", "content-length"];
          Object.entries(p).forEach(([l, d]) => {
            u.includes(l.toLowerCase()) && a.set(l, d);
          });
        }
      }
      if (
        Q.hasStandardBrowserEnv &&
        (s && g.isFunction(s) && (s = s(t)), s || (s !== !1 && Tx(t.url)))
      ) {
        let p = o && i && Rx.read(i);
        p && a.set(o, p);
      }
      return t;
    },
    Cx = typeof XMLHttpRequest < "u",
    Ax =
      Cx &&
      function (e) {
        return new Promise(function (n, s) {
          let o = Tl(e),
            i = o.data,
            a = Re.from(o.headers).normalize(),
            { responseType: c, onUploadProgress: p, onDownloadProgress: u } = o,
            l,
            d,
            m,
            h,
            f;
          function x() {
            (h && h(),
              f && f(),
              o.cancelToken && o.cancelToken.unsubscribe(l),
              o.signal && o.signal.removeEventListener("abort", l));
          }
          let b = new XMLHttpRequest();
          (b.open(o.method.toUpperCase(), o.url, !0), (b.timeout = o.timeout));
          function v() {
            if (!b) return;
            let T = Re.from(
                "getAllResponseHeaders" in b && b.getAllResponseHeaders(),
              ),
              R = {
                data:
                  !c || c === "text" || c === "json"
                    ? b.responseText
                    : b.response,
                status: b.status,
                statusText: b.statusText,
                headers: T,
                config: e,
                request: b,
              };
            (Lt(
              function (E) {
                (n(E), x());
              },
              function (E) {
                (s(E), x());
              },
              R,
            ),
              (b = null));
          }
          ("onloadend" in b
            ? (b.onloadend = v)
            : (b.onreadystatechange = function () {
                !b ||
                  b.readyState !== 4 ||
                  (b.status === 0 &&
                    !(b.responseURL && b.responseURL.indexOf("file:") === 0)) ||
                  setTimeout(v);
              }),
            (b.onabort = function () {
              b &&
                (s(new A("Request aborted", A.ECONNABORTED, e, b)), (b = null));
            }),
            (b.onerror = function (w) {
              let R = w && w.message ? w.message : "Network Error",
                S = new A(R, A.ERR_NETWORK, e, b);
              ((S.event = w || null), s(S), (b = null));
            }),
            (b.ontimeout = function () {
              let w = o.timeout
                  ? "timeout of " + o.timeout + "ms exceeded"
                  : "timeout exceeded",
                R = o.transitional || ss;
              (o.timeoutErrorMessage && (w = o.timeoutErrorMessage),
                s(
                  new A(
                    w,
                    R.clarifyTimeoutError ? A.ETIMEDOUT : A.ECONNABORTED,
                    e,
                    b,
                  ),
                ),
                (b = null));
            }),
            i === void 0 && a.setContentType(null),
            "setRequestHeader" in b &&
              g.forEach(a.toJSON(), function (w, R) {
                b.setRequestHeader(R, w);
              }),
            g.isUndefined(o.withCredentials) ||
              (b.withCredentials = !!o.withCredentials),
            c && c !== "json" && (b.responseType = o.responseType),
            u && (([m, f] = Ft(u, !0)), b.addEventListener("progress", m)),
            p &&
              b.upload &&
              (([d, h] = Ft(p)),
              b.upload.addEventListener("progress", d),
              b.upload.addEventListener("loadend", h)),
            (o.cancelToken || o.signal) &&
              ((l = (T) => {
                b &&
                  (s(!T || T.type ? new dt(null, e, b) : T),
                  b.abort(),
                  (b = null));
              }),
              o.cancelToken && o.cancelToken.subscribe(l),
              o.signal &&
                (o.signal.aborted
                  ? l()
                  : o.signal.addEventListener("abort", l))));
          let $ = _l(o.url);
          if ($ && Q.protocols.indexOf($) === -1) {
            s(new A("Unsupported protocol " + $ + ":", A.ERR_BAD_REQUEST, e));
            return;
          }
          b.send(i || null);
        });
      },
    Ox = (e, t) => {
      let { length: n } = (e = e ? e.filter(Boolean) : []);
      if (t || n) {
        let s = new AbortController(),
          o,
          i = function (u) {
            if (!o) {
              ((o = !0), c());
              let l = u instanceof Error ? u : this.reason;
              s.abort(
                l instanceof A ? l : new dt(l instanceof Error ? l.message : l),
              );
            }
          },
          a =
            t &&
            setTimeout(() => {
              ((a = null), i(new A(`timeout of ${t}ms exceeded`, A.ETIMEDOUT)));
            }, t),
          c = () => {
            e &&
              (a && clearTimeout(a),
              (a = null),
              e.forEach((u) => {
                u.unsubscribe
                  ? u.unsubscribe(i)
                  : u.removeEventListener("abort", i);
              }),
              (e = null));
          };
        e.forEach((u) => u.addEventListener("abort", i));
        let { signal: p } = s;
        return ((p.unsubscribe = () => g.asap(c)), p);
      }
    },
    jx = Ox,
    Px = function* (e, t) {
      let n = e.byteLength;
      if (!t || n < t) {
        yield e;
        return;
      }
      let s = 0,
        o;
      for (; s < n; ) ((o = s + t), yield e.slice(s, o), (s = o));
    },
    Nx = async function* (e, t) {
      for await (let n of Lx(e)) yield* Px(n, t);
    },
    Lx = async function* (e) {
      if (e[Symbol.asyncIterator]) {
        yield* e;
        return;
      }
      let t = e.getReader();
      try {
        for (;;) {
          let { done: n, value: s } = await t.read();
          if (n) break;
          yield s;
        }
      } finally {
        await t.cancel();
      }
    },
    Zc = (e, t, n, s) => {
      let o = Nx(e, t),
        i = 0,
        a,
        c = (p) => {
          a || ((a = !0), s && s(p));
        };
      return new ReadableStream(
        {
          async pull(p) {
            try {
              let { done: u, value: l } = await o.next();
              if (u) {
                (c(), p.close());
                return;
              }
              let d = l.byteLength;
              if (n) {
                let m = (i += d);
                n(m);
              }
              p.enqueue(new Uint8Array(l));
            } catch (u) {
              throw (c(u), u);
            }
          },
          cancel(p) {
            return (c(p), o.return());
          },
        },
        { highWaterMark: 2 },
      );
    },
    el = 64 * 1024,
    { isFunction: Hn } = g,
    qx = (({ Request: e, Response: t }) => ({ Request: e, Response: t }))(
      g.global,
    ),
    { ReadableStream: tl, TextEncoder: nl } = g.global,
    sl = (e, ...t) => {
      try {
        return !!e(...t);
      } catch {
        return !1;
      }
    },
    Mx = (e) => {
      e = g.merge.call({ skipUndefined: !0 }, qx, e);
      let { fetch: t, Request: n, Response: s } = e,
        o = t ? Hn(t) : typeof fetch == "function",
        i = Hn(n),
        a = Hn(s);
      if (!o) return !1;
      let c = o && Hn(tl),
        p =
          o &&
          (typeof nl == "function"
            ? (
                (f) => (x) =>
                  f.encode(x)
              )(new nl())
            : async (f) => new Uint8Array(await new n(f).arrayBuffer())),
        u =
          i &&
          c &&
          sl(() => {
            let f = !1,
              x = new n(Q.origin, {
                body: new tl(),
                method: "POST",
                get duplex() {
                  return ((f = !0), "half");
                },
              }).headers.has("Content-Type");
            return f && !x;
          }),
        l = a && c && sl(() => g.isReadableStream(new s("").body)),
        d = { stream: l && ((f) => f.body) };
      o &&
        ["text", "arrayBuffer", "blob", "formData", "stream"].forEach((f) => {
          !d[f] &&
            (d[f] = (x, b) => {
              let v = x && x[f];
              if (v) return v.call(x);
              throw new A(
                `Response type '${f}' is not supported`,
                A.ERR_NOT_SUPPORT,
                b,
              );
            });
        });
      let m = async (f) => {
          if (f == null) return 0;
          if (g.isBlob(f)) return f.size;
          if (g.isSpecCompliantForm(f))
            return (
              await new n(Q.origin, { method: "POST", body: f }).arrayBuffer()
            ).byteLength;
          if (g.isArrayBufferView(f) || g.isArrayBuffer(f)) return f.byteLength;
          if ((g.isURLSearchParams(f) && (f = f + ""), g.isString(f)))
            return (await p(f)).byteLength;
        },
        h = async (f, x) => {
          let b = g.toFiniteNumber(f.getContentLength());
          return b ?? m(x);
        };
      return async (f) => {
        let {
            url: x,
            method: b,
            data: v,
            signal: $,
            cancelToken: T,
            timeout: w,
            onDownloadProgress: R,
            onUploadProgress: S,
            responseType: E,
            headers: C,
            withCredentials: M = "same-origin",
            fetchOptions: F,
          } = Tl(f),
          B = t || fetch;
        E = E ? (E + "").toLowerCase() : "text";
        let W = jx([$, T && T.toAbortSignal()], w),
          ne = null,
          se =
            W &&
            W.unsubscribe &&
            (() => {
              W.unsubscribe();
            }),
          ge;
        try {
          if (
            S &&
            u &&
            b !== "get" &&
            b !== "head" &&
            (ge = await h(C, v)) !== 0
          ) {
            let O = new n(x, { method: "POST", body: v, duplex: "half" }),
              U;
            if (
              (g.isFormData(v) &&
                (U = O.headers.get("content-type")) &&
                C.setContentType(U),
              O.body)
            ) {
              let [le, H] = Xn(ge, Ft(Qn(S)));
              v = Zc(O.body, el, le, H);
            }
          }
          g.isString(M) || (M = M ? "include" : "omit");
          let oe = i && "credentials" in n.prototype,
            Z = {
              ...F,
              signal: W,
              method: b.toUpperCase(),
              headers: C.normalize().toJSON(),
              body: v,
              duplex: "half",
              credentials: oe ? M : void 0,
            };
          ne = i && new n(x, Z);
          let ce = await (i ? B(ne, F) : B(x, Z)),
            Ge = l && (E === "stream" || E === "response");
          if (l && (R || (Ge && se))) {
            let O = {};
            ["status", "statusText", "headers"].forEach((ke) => {
              O[ke] = ce[ke];
            });
            let U = g.toFiniteNumber(ce.headers.get("content-length")),
              [le, H] = (R && Xn(U, Ft(Qn(R), !0))) || [];
            ce = new s(
              Zc(ce.body, el, le, () => {
                (H && H(), se && se());
              }),
              O,
            );
          }
          E = E || "text";
          let N = await d[g.findKey(d, E) || "text"](ce, f);
          return (
            !Ge && se && se(),
            await new Promise((O, U) => {
              Lt(O, U, {
                data: N,
                headers: Re.from(ce.headers),
                status: ce.status,
                statusText: ce.statusText,
                config: f,
                request: ne,
              });
            })
          );
        } catch (oe) {
          throw (
            se && se(),
            oe &&
            oe.name === "TypeError" &&
            /Load failed|fetch/i.test(oe.message)
              ? Object.assign(
                  new A(
                    "Network Error",
                    A.ERR_NETWORK,
                    f,
                    ne,
                    oe && oe.response,
                  ),
                  { cause: oe.cause || oe },
                )
              : A.from(oe, oe && oe.code, f, ne, oe && oe.response)
          );
        }
      };
    },
    Fx = new Map(),
    Rl = (e) => {
      let t = (e && e.env) || {},
        { fetch: n, Request: s, Response: o } = t,
        i = [s, o, n],
        a = i.length,
        c = a,
        p,
        u,
        l = Fx;
      for (; c--; )
        ((p = i[c]),
          (u = l.get(p)),
          u === void 0 && l.set(p, (u = c ? new Map() : Mx(t))),
          (l = u));
      return u;
    };
  Rl();
  var Vo = { http: Ex, xhr: Ax, fetch: { get: Rl } };
  g.forEach(Vo, (e, t) => {
    if (e) {
      try {
        Object.defineProperty(e, "name", { value: t });
      } catch {}
      Object.defineProperty(e, "adapterName", { value: t });
    }
  });
  var ol = (e) => `- ${e}`,
    Ix = (e) => g.isFunction(e) || e === null || e === !1;
  function Dx(e, t) {
    e = g.isArray(e) ? e : [e];
    let { length: n } = e,
      s,
      o,
      i = {};
    for (let a = 0; a < n; a++) {
      s = e[a];
      let c;
      if (
        ((o = s),
        !Ix(s) && ((o = Vo[(c = String(s)).toLowerCase()]), o === void 0))
      )
        throw new A(`Unknown adapter '${c}'`);
      if (o && (g.isFunction(o) || (o = o.get(t)))) break;
      i[c || "#" + a] = o;
    }
    if (!o) {
      let a = Object.entries(i).map(
          ([p, u]) =>
            `adapter ${p} ` +
            (u === !1
              ? "is not supported by the environment"
              : "is not available in the build"),
        ),
        c = n
          ? a.length > 1
            ? `since :
` +
              a.map(ol).join(`
`)
            : " " + ol(a[0])
          : "as no adapter specified";
      throw new A(
        "There is no suitable adapter to dispatch the request " + c,
        "ERR_NOT_SUPPORT",
      );
    }
    return o;
  }
  var Cl = { getAdapter: Dx, adapters: Vo };
  function Ao(e) {
    if (
      (e.cancelToken && e.cancelToken.throwIfRequested(),
      e.signal && e.signal.aborted)
    )
      throw new dt(null, e);
  }
  function il(e) {
    return (
      Ao(e),
      (e.headers = Re.from(e.headers)),
      (e.data = Ro.call(e, e.transformRequest)),
      ["post", "put", "patch"].indexOf(e.method) !== -1 &&
        e.headers.setContentType("application/x-www-form-urlencoded", !1),
      Cl.getAdapter(
        e.adapter || Ko.adapter,
        e,
      )(e).then(
        function (s) {
          return (
            Ao(e),
            (s.data = Ro.call(e, e.transformResponse, s)),
            (s.headers = Re.from(s.headers)),
            s
          );
        },
        function (s) {
          return (
            kl(s) ||
              (Ao(e),
              s &&
                s.response &&
                ((s.response.data = Ro.call(
                  e,
                  e.transformResponse,
                  s.response,
                )),
                (s.response.headers = Re.from(s.response.headers)))),
            Promise.reject(s)
          );
        },
      )
    );
  }
  var os = {};
  ["object", "boolean", "number", "function", "string", "symbol"].forEach(
    (e, t) => {
      os[e] = function (s) {
        return typeof s === e || "a" + (t < 1 ? "n " : " ") + e;
      };
    },
  );
  var al = {};
  os.transitional = function (t, n, s) {
    function o(i, a) {
      return (
        "[Axios v" +
        Yn +
        "] Transitional option '" +
        i +
        "'" +
        a +
        (s ? ". " + s : "")
      );
    }
    return (i, a, c) => {
      if (t === !1)
        throw new A(
          o(a, " has been removed" + (n ? " in " + n : "")),
          A.ERR_DEPRECATED,
        );
      return (
        n &&
          !al[a] &&
          ((al[a] = !0),
          console.warn(
            o(
              a,
              " has been deprecated since v" +
                n +
                " and will be removed in the near future",
            ),
          )),
        t ? t(i, a, c) : !0
      );
    };
  };
  os.spelling = function (t) {
    return (n, s) => (console.warn(`${s} is likely a misspelling of ${t}`), !0);
  };
  function Ux(e, t, n) {
    if (typeof e != "object")
      throw new A("options must be an object", A.ERR_BAD_OPTION_VALUE);
    let s = Object.keys(e),
      o = s.length;
    for (; o-- > 0; ) {
      let i = s[o],
        a = t[i];
      if (a) {
        let c = e[i],
          p = c === void 0 || a(c, i, e);
        if (p !== !0)
          throw new A("option " + i + " must be " + p, A.ERR_BAD_OPTION_VALUE);
        continue;
      }
      if (n !== !0) throw new A("Unknown option " + i, A.ERR_BAD_OPTION);
    }
  }
  var Jn = { assertOptions: Ux, validators: os },
    Ne = Jn.validators,
    It = class {
      constructor(t) {
        ((this.defaults = t || {}),
          (this.interceptors = { request: new Bc(), response: new Bc() }));
      }
      async request(t, n) {
        try {
          return await this._request(t, n);
        } catch (s) {
          if (s instanceof Error) {
            let o = {};
            Error.captureStackTrace
              ? Error.captureStackTrace(o)
              : (o = new Error());
            let i = o.stack ? o.stack.replace(/^.+\n/, "") : "";
            try {
              s.stack
                ? i &&
                  !String(s.stack).endsWith(i.replace(/^.+\n.+\n/, "")) &&
                  (s.stack +=
                    `
` + i)
                : (s.stack = i);
            } catch {}
          }
          throw s;
        }
      }
      _request(t, n) {
        (typeof t == "string" ? ((n = n || {}), (n.url = t)) : (n = t || {}),
          (n = mt(this.defaults, n)));
        let { transitional: s, paramsSerializer: o, headers: i } = n;
        (s !== void 0 &&
          Jn.assertOptions(
            s,
            {
              silentJSONParsing: Ne.transitional(Ne.boolean),
              forcedJSONParsing: Ne.transitional(Ne.boolean),
              clarifyTimeoutError: Ne.transitional(Ne.boolean),
              legacyInterceptorReqResOrdering: Ne.transitional(Ne.boolean),
            },
            !1,
          ),
          o != null &&
            (g.isFunction(o)
              ? (n.paramsSerializer = { serialize: o })
              : Jn.assertOptions(
                  o,
                  { encode: Ne.function, serialize: Ne.function },
                  !0,
                )),
          n.allowAbsoluteUrls !== void 0 ||
            (this.defaults.allowAbsoluteUrls !== void 0
              ? (n.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls)
              : (n.allowAbsoluteUrls = !0)),
          Jn.assertOptions(
            n,
            {
              baseUrl: Ne.spelling("baseURL"),
              withXsrfToken: Ne.spelling("withXSRFToken"),
            },
            !0,
          ),
          (n.method = (
            n.method ||
            this.defaults.method ||
            "get"
          ).toLowerCase()));
        let a = i && g.merge(i.common, i[n.method]);
        (i &&
          g.forEach(
            ["delete", "get", "head", "post", "put", "patch", "common"],
            (f) => {
              delete i[f];
            },
          ),
          (n.headers = Re.concat(a, i)));
        let c = [],
          p = !0;
        this.interceptors.request.forEach(function (x) {
          if (typeof x.runWhen == "function" && x.runWhen(n) === !1) return;
          p = p && x.synchronous;
          let b = n.transitional || ss;
          b && b.legacyInterceptorReqResOrdering
            ? c.unshift(x.fulfilled, x.rejected)
            : c.push(x.fulfilled, x.rejected);
        });
        let u = [];
        this.interceptors.response.forEach(function (x) {
          u.push(x.fulfilled, x.rejected);
        });
        let l,
          d = 0,
          m;
        if (!p) {
          let f = [il.bind(this), void 0];
          for (
            f.unshift(...c), f.push(...u), m = f.length, l = Promise.resolve(n);
            d < m;
          )
            l = l.then(f[d++], f[d++]);
          return l;
        }
        m = c.length;
        let h = n;
        for (; d < m; ) {
          let f = c[d++],
            x = c[d++];
          try {
            h = f(h);
          } catch (b) {
            x.call(this, b);
            break;
          }
        }
        try {
          l = il.call(this, h);
        } catch (f) {
          return Promise.reject(f);
        }
        for (d = 0, m = u.length; d < m; ) l = l.then(u[d++], u[d++]);
        return l;
      }
      getUri(t) {
        t = mt(this.defaults, t);
        let n = Jo(t.baseURL, t.url, t.allowAbsoluteUrls);
        return Wo(n, t.params, t.paramsSerializer);
      }
    };
  g.forEach(["delete", "get", "head", "options"], function (t) {
    It.prototype[t] = function (n, s) {
      return this.request(
        mt(s || {}, { method: t, url: n, data: (s || {}).data }),
      );
    };
  });
  g.forEach(["post", "put", "patch"], function (t) {
    function n(s) {
      return function (i, a, c) {
        return this.request(
          mt(c || {}, {
            method: t,
            headers: s ? { "Content-Type": "multipart/form-data" } : {},
            url: i,
            data: a,
          }),
        );
      };
    }
    ((It.prototype[t] = n()), (It.prototype[t + "Form"] = n(!0)));
  });
  var Vn = It,
    Do = class e {
      constructor(t) {
        if (typeof t != "function")
          throw new TypeError("executor must be a function.");
        let n;
        this.promise = new Promise(function (i) {
          n = i;
        });
        let s = this;
        (this.promise.then((o) => {
          if (!s._listeners) return;
          let i = s._listeners.length;
          for (; i-- > 0; ) s._listeners[i](o);
          s._listeners = null;
        }),
          (this.promise.then = (o) => {
            let i,
              a = new Promise((c) => {
                (s.subscribe(c), (i = c));
              }).then(o);
            return (
              (a.cancel = function () {
                s.unsubscribe(i);
              }),
              a
            );
          }),
          t(function (i, a, c) {
            s.reason || ((s.reason = new dt(i, a, c)), n(s.reason));
          }));
      }
      throwIfRequested() {
        if (this.reason) throw this.reason;
      }
      subscribe(t) {
        if (this.reason) {
          t(this.reason);
          return;
        }
        this._listeners ? this._listeners.push(t) : (this._listeners = [t]);
      }
      unsubscribe(t) {
        if (!this._listeners) return;
        let n = this._listeners.indexOf(t);
        n !== -1 && this._listeners.splice(n, 1);
      }
      toAbortSignal() {
        let t = new AbortController(),
          n = (s) => {
            t.abort(s);
          };
        return (
          this.subscribe(n),
          (t.signal.unsubscribe = () => this.unsubscribe(n)),
          t.signal
        );
      }
      static source() {
        let t;
        return {
          token: new e(function (o) {
            t = o;
          }),
          cancel: t,
        };
      }
    },
    Bx = Do;
  function zx(e) {
    return function (n) {
      return e.apply(null, n);
    };
  }
  function Wx(e) {
    return g.isObject(e) && e.isAxiosError === !0;
  }
  var Uo = {
    Continue: 100,
    SwitchingProtocols: 101,
    Processing: 102,
    EarlyHints: 103,
    Ok: 200,
    Created: 201,
    Accepted: 202,
    NonAuthoritativeInformation: 203,
    NoContent: 204,
    ResetContent: 205,
    PartialContent: 206,
    MultiStatus: 207,
    AlreadyReported: 208,
    ImUsed: 226,
    MultipleChoices: 300,
    MovedPermanently: 301,
    Found: 302,
    SeeOther: 303,
    NotModified: 304,
    UseProxy: 305,
    Unused: 306,
    TemporaryRedirect: 307,
    PermanentRedirect: 308,
    BadRequest: 400,
    Unauthorized: 401,
    PaymentRequired: 402,
    Forbidden: 403,
    NotFound: 404,
    MethodNotAllowed: 405,
    NotAcceptable: 406,
    ProxyAuthenticationRequired: 407,
    RequestTimeout: 408,
    Conflict: 409,
    Gone: 410,
    LengthRequired: 411,
    PreconditionFailed: 412,
    PayloadTooLarge: 413,
    UriTooLong: 414,
    UnsupportedMediaType: 415,
    RangeNotSatisfiable: 416,
    ExpectationFailed: 417,
    ImATeapot: 418,
    MisdirectedRequest: 421,
    UnprocessableEntity: 422,
    Locked: 423,
    FailedDependency: 424,
    TooEarly: 425,
    UpgradeRequired: 426,
    PreconditionRequired: 428,
    TooManyRequests: 429,
    RequestHeaderFieldsTooLarge: 431,
    UnavailableForLegalReasons: 451,
    InternalServerError: 500,
    NotImplemented: 501,
    BadGateway: 502,
    ServiceUnavailable: 503,
    GatewayTimeout: 504,
    HttpVersionNotSupported: 505,
    VariantAlsoNegotiates: 506,
    InsufficientStorage: 507,
    LoopDetected: 508,
    NotExtended: 510,
    NetworkAuthenticationRequired: 511,
    WebServerIsDown: 521,
    ConnectionTimedOut: 522,
    OriginIsUnreachable: 523,
    TimeoutOccurred: 524,
    SslHandshakeFailed: 525,
    InvalidSslCertificate: 526,
  };
  Object.entries(Uo).forEach(([e, t]) => {
    Uo[t] = e;
  });
  var Hx = Uo;
  function Al(e) {
    let t = new Vn(e),
      n = pl(Vn.prototype.request, t);
    return (
      g.extend(n, Vn.prototype, t, { allOwnKeys: !0 }),
      g.extend(n, t, null, { allOwnKeys: !0 }),
      (n.create = function (o) {
        return Al(mt(e, o));
      }),
      n
    );
  }
  var ie = Al(Ko);
  ie.Axios = Vn;
  ie.CanceledError = dt;
  ie.CancelToken = Bx;
  ie.isCancel = kl;
  ie.VERSION = Yn;
  ie.toFormData = ns;
  ie.AxiosError = A;
  ie.Cancel = ie.CanceledError;
  ie.all = function (t) {
    return Promise.all(t);
  };
  ie.spread = zx;
  ie.isAxiosError = Wx;
  ie.mergeConfig = mt;
  ie.AxiosHeaders = Re;
  ie.formToJSON = (e) => wl(g.isHTMLForm(e) ? new FormData(e) : e);
  ie.getAdapter = Cl.getAdapter;
  ie.HttpStatusCode = Hx;
  ie.default = ie;
  Ol.exports = ie;
});
var Ut = _((Pk, jl) => {
  var Yo = class e {
    constructor(t = {}) {
      if (new.target === e)
        throw new Error(
          "BaseProvider is abstract \u2014 use a concrete provider",
        );
      ((this.name = t.name || "unknown"),
        (this.baseUrl = t.baseUrl || ""),
        (this.models = t.models || {}),
        (this.defaultModel = t.defaultModel || null));
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
    getModel(t) {
      return this.models[t] || null;
    }
    async chat(t, n, s = {}) {
      throw new Error(`${this.name}: chat() not implemented`);
    }
    async stream(t, n, s = {}) {
      throw new Error(`${this.name}: stream() not implemented`);
    }
    formatMessages(t) {
      return { messages: t };
    }
    formatTools(t) {
      return t;
    }
    normalizeResponse(t) {
      throw new Error(`${this.name}: normalizeResponse() not implemented`);
    }
  };
  jl.exports = { BaseProvider: Yo };
});
var Ll = _((Nk, Nl) => {
  var Xo = ft(),
    { BaseProvider: Gx } = Ut(),
    Pl = {
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
      "qwen3-next:80b": {
        id: "qwen3-next:80b",
        name: "Qwen3 Next 80B",
        maxTokens: 16384,
        contextWindow: 131072,
      },
      "qwen3.5:397b": {
        id: "qwen3.5:397b",
        name: "Qwen3.5 397B",
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
    Qo = class extends Gx {
      constructor(t = {}) {
        (super({
          name: "ollama",
          baseUrl: t.baseUrl || "https://ollama.com",
          models: t.models || Pl,
          defaultModel: t.defaultModel || "qwen3-coder:480b",
          ...t,
        }),
          (this.timeout = t.timeout || 18e4),
          (this.temperature = t.temperature ?? 0.2),
          (this._discovered = !1));
      }
      async discoverModels() {
        if (!this._discovered) {
          this._discovered = !0;
          try {
            let n =
              (
                await Xo.get(`${this.baseUrl}/api/tags`, {
                  timeout: 5e3,
                  headers: this._getHeaders(),
                })
              ).data?.models || [];
            for (let s of n) {
              let o = (s.name || s.model || "").replace(/:latest$/, "");
              !o ||
                this.models[o] ||
                (this.models[o] = {
                  id: o,
                  name: s.name || o,
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
        let t = this.getApiKey();
        if (!t) throw new Error("OLLAMA_API_KEY not set");
        return { Authorization: `Bearer ${t}` };
      }
      async chat(t, n, s = {}) {
        await this.discoverModels();
        let o = s.model || this.defaultModel,
          i = this.getModel(o),
          a = s.maxTokens || i?.maxTokens || 16384,
          c = await Xo.post(
            `${this.baseUrl}/api/chat`,
            {
              model: o,
              messages: t,
              tools: n && n.length > 0 ? n : void 0,
              stream: !1,
              options: {
                temperature: s.temperature ?? this.temperature,
                num_predict: a,
              },
            },
            { timeout: s.timeout || this.timeout, headers: this._getHeaders() },
          );
        return this.normalizeResponse(c.data);
      }
      async stream(t, n, s = {}) {
        await this.discoverModels();
        let o = s.model || this.defaultModel,
          i = this.getModel(o),
          a = s.maxTokens || i?.maxTokens || 16384,
          c = s.onToken || (() => {}),
          p;
        try {
          p = await Xo.post(
            `${this.baseUrl}/api/chat`,
            {
              model: o,
              messages: t,
              tools: n && n.length > 0 ? n : void 0,
              stream: !0,
              options: {
                temperature: s.temperature ?? this.temperature,
                num_predict: a,
              },
            },
            {
              timeout: s.timeout || this.timeout,
              headers: this._getHeaders(),
              responseType: "stream",
              signal: s.signal,
            },
          );
        } catch (u) {
          if (
            u.name === "CanceledError" ||
            u.name === "AbortError" ||
            u.code === "ERR_CANCELED"
          )
            throw u;
          let l = u.response?.data?.error || u.message;
          throw new Error(`API Error: ${l}`);
        }
        return new Promise((u, l) => {
          let d = "",
            m = [],
            h = "";
          (s.signal &&
            s.signal.addEventListener(
              "abort",
              () => {
                (p.data.destroy(),
                  l(
                    new DOMException("The operation was aborted", "AbortError"),
                  ));
              },
              { once: !0 },
            ),
            p.data.on("data", (f) => {
              h += f.toString();
              let x = h.split(`
`);
              h = x.pop() || "";
              for (let b of x) {
                if (!b.trim()) continue;
                let v;
                try {
                  v = JSON.parse(b);
                } catch {
                  continue;
                }
                if (
                  (v.message?.content &&
                    (c(v.message.content), (d += v.message.content)),
                  v.message?.tool_calls && (m = m.concat(v.message.tool_calls)),
                  v.done)
                ) {
                  u({ content: d, tool_calls: this._normalizeToolCalls(m) });
                  return;
                }
              }
            }),
            p.data.on("error", (f) => {
              s.signal?.aborted || l(new Error(`Stream error: ${f.message}`));
            }),
            p.data.on("end", () => {
              if (h.trim())
                try {
                  let f = JSON.parse(h);
                  (f.message?.content &&
                    (c(f.message.content), (d += f.message.content)),
                    f.message?.tool_calls &&
                      (m = m.concat(f.message.tool_calls)));
                } catch {}
              u({ content: d, tool_calls: this._normalizeToolCalls(m) });
            }));
        });
      }
      normalizeResponse(t) {
        let n = t.message || {};
        return {
          content: n.content || "",
          tool_calls: this._normalizeToolCalls(n.tool_calls || []),
        };
      }
      _normalizeToolCalls(t) {
        return t.map((n, s) => ({
          id: n.id || `ollama-${Date.now()}-${s}`,
          function: {
            name: n.function?.name || n.name || "unknown",
            arguments: n.function?.arguments || n.arguments || {},
          },
        }));
      }
    };
  Nl.exports = { OllamaProvider: Qo, OLLAMA_MODELS: Pl };
});
var Il = _((Lk, Fl) => {
  var ql = ft(),
    { BaseProvider: Kx } = Ut(),
    Ml = {
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
    Zo = class extends Kx {
      constructor(t = {}) {
        (super({
          name: "openai",
          baseUrl: t.baseUrl || "https://api.openai.com/v1",
          models: t.models || Ml,
          defaultModel: t.defaultModel || "gpt-4o",
          ...t,
        }),
          (this.timeout = t.timeout || 18e4),
          (this.temperature = t.temperature ?? 0.2));
      }
      isConfigured() {
        return !!this.getApiKey();
      }
      getApiKey() {
        return process.env.OPENAI_API_KEY || null;
      }
      _getHeaders() {
        let t = this.getApiKey();
        if (!t) throw new Error("OPENAI_API_KEY not set");
        return {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        };
      }
      formatMessages(t) {
        return {
          messages: t.map((n) =>
            n.role === "assistant" && n.tool_calls
              ? {
                  role: "assistant",
                  content: n.content || null,
                  tool_calls: n.tool_calls.map((s) => ({
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
                }
              : n.role === "tool"
                ? {
                    role: "tool",
                    content:
                      typeof n.content == "string"
                        ? n.content
                        : JSON.stringify(n.content),
                    tool_call_id: n.tool_call_id,
                  }
                : { role: n.role, content: n.content },
          ),
        };
      }
      async chat(t, n, s = {}) {
        let o = s.model || this.defaultModel,
          i = this.getModel(o),
          a = s.maxTokens || i?.maxTokens || 16384,
          { messages: c } = this.formatMessages(t),
          p = {
            model: o,
            messages: c,
            max_tokens: a,
            temperature: s.temperature ?? this.temperature,
          };
        n && n.length > 0 && (p.tools = n);
        let u = await ql.post(`${this.baseUrl}/chat/completions`, p, {
          timeout: s.timeout || this.timeout,
          headers: this._getHeaders(),
        });
        return this.normalizeResponse(u.data);
      }
      async stream(t, n, s = {}) {
        let o = s.model || this.defaultModel,
          i = this.getModel(o),
          a = s.maxTokens || i?.maxTokens || 16384,
          c = s.onToken || (() => {}),
          { messages: p } = this.formatMessages(t),
          u = {
            model: o,
            messages: p,
            max_tokens: a,
            temperature: s.temperature ?? this.temperature,
            stream: !0,
          };
        n && n.length > 0 && (u.tools = n);
        let l;
        try {
          l = await ql.post(`${this.baseUrl}/chat/completions`, u, {
            timeout: s.timeout || this.timeout,
            headers: this._getHeaders(),
            responseType: "stream",
            signal: s.signal,
          });
        } catch (d) {
          if (
            d.name === "CanceledError" ||
            d.name === "AbortError" ||
            d.code === "ERR_CANCELED"
          )
            throw d;
          let m = d.response?.data?.error?.message || d.message;
          throw new Error(`API Error: ${m}`);
        }
        return new Promise((d, m) => {
          let h = "",
            f = {},
            x = "";
          (s.signal &&
            s.signal.addEventListener(
              "abort",
              () => {
                (l.data.destroy(),
                  m(
                    new DOMException("The operation was aborted", "AbortError"),
                  ));
              },
              { once: !0 },
            ),
            l.data.on("data", (b) => {
              x += b.toString();
              let v = x.split(`
`);
              x = v.pop() || "";
              for (let $ of v) {
                let T = $.trim();
                if (!T || !T.startsWith("data: ")) continue;
                let w = T.slice(6);
                if (w === "[DONE]") {
                  d({ content: h, tool_calls: this._buildToolCalls(f) });
                  return;
                }
                let R;
                try {
                  R = JSON.parse(w);
                } catch {
                  continue;
                }
                let S = R.choices?.[0]?.delta;
                if (
                  S &&
                  (S.content && (c(S.content), (h += S.content)), S.tool_calls)
                )
                  for (let E of S.tool_calls) {
                    let C = E.index ?? 0;
                    (f[C] ||
                      (f[C] = { id: E.id || "", name: "", arguments: "" }),
                      E.id && (f[C].id = E.id),
                      E.function?.name && (f[C].name += E.function.name),
                      E.function?.arguments &&
                        (f[C].arguments += E.function.arguments));
                  }
              }
            }),
            l.data.on("error", (b) => {
              s.signal?.aborted || m(new Error(`Stream error: ${b.message}`));
            }),
            l.data.on("end", () => {
              d({ content: h, tool_calls: this._buildToolCalls(f) });
            }));
        });
      }
      normalizeResponse(t) {
        let n = t.choices?.[0]?.message || {},
          s = (n.tool_calls || []).map((o) => ({
            id: o.id,
            function: {
              name: o.function.name,
              arguments: o.function.arguments,
            },
          }));
        return { content: n.content || "", tool_calls: s };
      }
      _buildToolCalls(t) {
        return Object.values(t)
          .filter((n) => n.name)
          .map((n) => ({
            id: n.id || `openai-${Date.now()}`,
            function: { name: n.name, arguments: n.arguments },
          }));
      }
    };
  Fl.exports = { OpenAIProvider: Zo, OPENAI_MODELS: Ml };
});
var zl = _((qk, Bl) => {
  var Dl = ft(),
    { BaseProvider: Jx } = Ut(),
    Ul = {
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
    Vx = "2023-06-01",
    ei = class extends Jx {
      constructor(t = {}) {
        (super({
          name: "anthropic",
          baseUrl: t.baseUrl || "https://api.anthropic.com/v1",
          models: t.models || Ul,
          defaultModel: t.defaultModel || "claude-sonnet",
          ...t,
        }),
          (this.timeout = t.timeout || 18e4),
          (this.temperature = t.temperature ?? 0.2),
          (this.apiVersion = t.apiVersion || Vx));
      }
      isConfigured() {
        return !!this.getApiKey();
      }
      getApiKey() {
        return process.env.ANTHROPIC_API_KEY || null;
      }
      _getHeaders() {
        let t = this.getApiKey();
        if (!t) throw new Error("ANTHROPIC_API_KEY not set");
        return {
          "x-api-key": t,
          "anthropic-version": this.apiVersion,
          "Content-Type": "application/json",
        };
      }
      formatMessages(t) {
        let n = "",
          s = [];
        for (let o of t) {
          if (o.role === "system") {
            n +=
              (n
                ? `

`
                : "") + o.content;
            continue;
          }
          if (o.role === "assistant") {
            let i = [];
            if (
              (o.content && i.push({ type: "text", text: o.content }),
              o.tool_calls)
            )
              for (let a of o.tool_calls)
                i.push({
                  type: "tool_use",
                  id: a.id || `toolu-${Date.now()}`,
                  name: a.function.name,
                  input:
                    typeof a.function.arguments == "string"
                      ? JSON.parse(a.function.arguments || "{}")
                      : a.function.arguments || {},
                });
            s.push({
              role: "assistant",
              content: i.length > 0 ? i : [{ type: "text", text: "" }],
            });
            continue;
          }
          if (o.role === "tool") {
            let i = s[s.length - 1],
              a = {
                type: "tool_result",
                tool_use_id: o.tool_call_id,
                content:
                  typeof o.content == "string"
                    ? o.content
                    : JSON.stringify(o.content),
              };
            i &&
            i.role === "user" &&
            Array.isArray(i.content) &&
            i.content[0]?.type === "tool_result"
              ? i.content.push(a)
              : s.push({ role: "user", content: [a] });
            continue;
          }
          s.push({ role: "user", content: o.content });
        }
        return { messages: s, system: n };
      }
      formatTools(t) {
        return !t || t.length === 0
          ? []
          : t.map((n) => ({
              name: n.function.name,
              description: n.function.description || "",
              input_schema: n.function.parameters || {
                type: "object",
                properties: {},
              },
            }));
      }
      _resolveModelId(t) {
        return this.getModel(t)?.id || t;
      }
      async chat(t, n, s = {}) {
        let o = s.model || this.defaultModel,
          i = this._resolveModelId(o),
          a = this.getModel(o),
          c = s.maxTokens || a?.maxTokens || 8192,
          { messages: p, system: u } = this.formatMessages(t),
          l = {
            model: i,
            messages: p,
            max_tokens: c,
            temperature: s.temperature ?? this.temperature,
          };
        u && (l.system = u);
        let d = this.formatTools(n);
        d.length > 0 && (l.tools = d);
        let m = await Dl.post(`${this.baseUrl}/messages`, l, {
          timeout: s.timeout || this.timeout,
          headers: this._getHeaders(),
        });
        return this.normalizeResponse(m.data);
      }
      async stream(t, n, s = {}) {
        let o = s.model || this.defaultModel,
          i = this._resolveModelId(o),
          a = this.getModel(o),
          c = s.maxTokens || a?.maxTokens || 8192,
          p = s.onToken || (() => {}),
          { messages: u, system: l } = this.formatMessages(t),
          d = {
            model: i,
            messages: u,
            max_tokens: c,
            temperature: s.temperature ?? this.temperature,
            stream: !0,
          };
        l && (d.system = l);
        let m = this.formatTools(n);
        m.length > 0 && (d.tools = m);
        let h;
        try {
          h = await Dl.post(`${this.baseUrl}/messages`, d, {
            timeout: s.timeout || this.timeout,
            headers: this._getHeaders(),
            responseType: "stream",
            signal: s.signal,
          });
        } catch (f) {
          if (
            f.name === "CanceledError" ||
            f.name === "AbortError" ||
            f.code === "ERR_CANCELED"
          )
            throw f;
          let x = f.response?.data?.error?.message || f.message;
          throw new Error(`API Error: ${x}`);
        }
        return new Promise((f, x) => {
          let b = "",
            v = [],
            $ = -1,
            T = "";
          (s.signal &&
            s.signal.addEventListener(
              "abort",
              () => {
                (h.data.destroy(),
                  x(
                    new DOMException("The operation was aborted", "AbortError"),
                  ));
              },
              { once: !0 },
            ),
            h.data.on("data", (w) => {
              T += w.toString();
              let R = T.split(`
`);
              T = R.pop() || "";
              for (let S of R) {
                let E = S.trim();
                if (E.startsWith("data: ")) {
                  let C = E.slice(6),
                    M;
                  try {
                    M = JSON.parse(C);
                  } catch {
                    continue;
                  }
                  switch (M.type) {
                    case "content_block_start": {
                      let F = M.content_block;
                      F?.type === "tool_use" &&
                        (($ = v.length),
                        v.push({ id: F.id, name: F.name, inputJson: "" }));
                      break;
                    }
                    case "content_block_delta": {
                      let F = M.delta;
                      (F?.type === "text_delta" &&
                        F.text &&
                        (p(F.text), (b += F.text)),
                        F?.type === "input_json_delta" &&
                          F.partial_json !== void 0 &&
                          $ >= 0 &&
                          (v[$].inputJson += F.partial_json));
                      break;
                    }
                    case "content_block_stop":
                      $ = -1;
                      break;
                    case "message_stop":
                      f({ content: b, tool_calls: this._buildToolCalls(v) });
                      return;
                  }
                }
              }
            }),
            h.data.on("error", (w) => {
              s.signal?.aborted || x(new Error(`Stream error: ${w.message}`));
            }),
            h.data.on("end", () => {
              f({ content: b, tool_calls: this._buildToolCalls(v) });
            }));
        });
      }
      normalizeResponse(t) {
        let n = "",
          s = [];
        for (let o of t.content || [])
          o.type === "text"
            ? (n += o.text)
            : o.type === "tool_use" &&
              s.push({
                id: o.id,
                function: { name: o.name, arguments: o.input },
              });
        return { content: n, tool_calls: s };
      }
      _buildToolCalls(t) {
        return t
          .filter((n) => n.name)
          .map((n) => {
            let s = {};
            if (n.inputJson)
              try {
                s = JSON.parse(n.inputJson);
              } catch {
                s = n.inputJson;
              }
            return {
              id: n.id || `anthropic-${Date.now()}`,
              function: { name: n.name, arguments: s },
            };
          });
      }
    };
  Bl.exports = { AnthropicProvider: ei, ANTHROPIC_MODELS: Ul };
});
var Kl = _((Mk, Gl) => {
  var Wl = ft(),
    { BaseProvider: Yx } = Ut(),
    Hl = {
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
    },
    ti = class extends Yx {
      constructor(t = {}) {
        (super({
          name: "gemini",
          baseUrl:
            t.baseUrl ||
            "https://generativelanguage.googleapis.com/v1beta/openai",
          models: t.models || Hl,
          defaultModel: t.defaultModel || "gemini-2.5-flash",
          ...t,
        }),
          (this.timeout = t.timeout || 18e4),
          (this.temperature = t.temperature ?? 0.2));
      }
      isConfigured() {
        return !!this.getApiKey();
      }
      getApiKey() {
        return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
      }
      _getHeaders() {
        let t = this.getApiKey();
        if (!t) throw new Error("GEMINI_API_KEY not set");
        return {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        };
      }
      formatMessages(t) {
        return {
          messages: t.map((n) =>
            n.role === "assistant" && n.tool_calls
              ? {
                  role: "assistant",
                  content: n.content || null,
                  tool_calls: n.tool_calls.map((s) => ({
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
                }
              : n.role === "tool"
                ? {
                    role: "tool",
                    content:
                      typeof n.content == "string"
                        ? n.content
                        : JSON.stringify(n.content),
                    tool_call_id: n.tool_call_id,
                  }
                : { role: n.role, content: n.content },
          ),
        };
      }
      async chat(t, n, s = {}) {
        let o = s.model || this.defaultModel,
          i = this.getModel(o),
          a = s.maxTokens || i?.maxTokens || 8192,
          { messages: c } = this.formatMessages(t),
          p = {
            model: o,
            messages: c,
            max_tokens: a,
            temperature: s.temperature ?? this.temperature,
          };
        n && n.length > 0 && (p.tools = n);
        let u = await Wl.post(`${this.baseUrl}/chat/completions`, p, {
          timeout: s.timeout || this.timeout,
          headers: this._getHeaders(),
        });
        return this.normalizeResponse(u.data);
      }
      async stream(t, n, s = {}) {
        let o = s.model || this.defaultModel,
          i = this.getModel(o),
          a = s.maxTokens || i?.maxTokens || 8192,
          c = s.onToken || (() => {}),
          { messages: p } = this.formatMessages(t),
          u = {
            model: o,
            messages: p,
            max_tokens: a,
            temperature: s.temperature ?? this.temperature,
            stream: !0,
          };
        n && n.length > 0 && (u.tools = n);
        let l;
        try {
          l = await Wl.post(`${this.baseUrl}/chat/completions`, u, {
            timeout: s.timeout || this.timeout,
            headers: this._getHeaders(),
            responseType: "stream",
            signal: s.signal,
          });
        } catch (d) {
          if (
            d.name === "CanceledError" ||
            d.name === "AbortError" ||
            d.code === "ERR_CANCELED"
          )
            throw d;
          let m = d.response?.data?.error?.message || d.message;
          throw new Error(`API Error: ${m}`);
        }
        return new Promise((d, m) => {
          let h = "",
            f = {},
            x = "";
          (s.signal &&
            s.signal.addEventListener(
              "abort",
              () => {
                (l.data.destroy(),
                  m(
                    new DOMException("The operation was aborted", "AbortError"),
                  ));
              },
              { once: !0 },
            ),
            l.data.on("data", (b) => {
              x += b.toString();
              let v = x.split(`
`);
              x = v.pop() || "";
              for (let $ of v) {
                let T = $.trim();
                if (!T || !T.startsWith("data: ")) continue;
                let w = T.slice(6);
                if (w === "[DONE]") {
                  d({ content: h, tool_calls: this._buildToolCalls(f) });
                  return;
                }
                let R;
                try {
                  R = JSON.parse(w);
                } catch {
                  continue;
                }
                let S = R.choices?.[0]?.delta;
                if (
                  S &&
                  (S.content && (c(S.content), (h += S.content)), S.tool_calls)
                )
                  for (let E of S.tool_calls) {
                    let C = E.index ?? 0;
                    (f[C] ||
                      (f[C] = { id: E.id || "", name: "", arguments: "" }),
                      E.id && (f[C].id = E.id),
                      E.function?.name && (f[C].name += E.function.name),
                      E.function?.arguments &&
                        (f[C].arguments += E.function.arguments));
                  }
              }
            }),
            l.data.on("error", (b) => {
              s.signal?.aborted || m(new Error(`Stream error: ${b.message}`));
            }),
            l.data.on("end", () => {
              d({ content: h, tool_calls: this._buildToolCalls(f) });
            }));
        });
      }
      normalizeResponse(t) {
        let n = t.choices?.[0]?.message || {},
          s = (n.tool_calls || []).map((o) => ({
            id: o.id,
            function: {
              name: o.function.name,
              arguments: o.function.arguments,
            },
          }));
        return { content: n.content || "", tool_calls: s };
      }
      _buildToolCalls(t) {
        return Object.values(t)
          .filter((n) => n.name)
          .map((n) => ({
            id: n.id || `gemini-${Date.now()}`,
            function: { name: n.name, arguments: n.arguments },
          }));
      }
    };
  Gl.exports = { GeminiProvider: ti, GEMINI_MODELS: Hl };
});
var Yl = _((Fk, Vl) => {
  var is = ft(),
    { BaseProvider: Xx } = Ut(),
    Jl = "http://localhost:11434",
    ni = class extends Xx {
      constructor(t = {}) {
        (super({
          name: "local",
          baseUrl:
            t.baseUrl ||
            process.env.OLLAMA_HOST ||
            process.env.OLLAMA_LOCAL_URL ||
            Jl,
          models: t.models || {},
          defaultModel: t.defaultModel || null,
          ...t,
        }),
          (this.timeout = t.timeout || 3e5),
          (this.temperature = t.temperature ?? 0.2),
          (this._modelsLoaded = !1));
      }
      isConfigured() {
        return !0;
      }
      async loadModels() {
        if (this._modelsLoaded) return this.models;
        try {
          let n =
            (await is.get(`${this.baseUrl}/api/tags`, { timeout: 5e3 })).data
              ?.models || [];
          this.models = {};
          for (let s of n) {
            let o = s.name || s.model;
            if (!o) continue;
            let i = o.replace(/:latest$/, ""),
              a = 32768;
            try {
              let c = await is.post(
                  `${this.baseUrl}/api/show`,
                  { name: o },
                  { timeout: 5e3 },
                ),
                p = c.data?.model_info || c.data?.details || {};
              a =
                p["general.context_length"] ||
                p["llama.context_length"] ||
                this._parseContextFromModelfile(c.data?.modelfile) ||
                32768;
            } catch {}
            this.models[i] = {
              id: i,
              name: s.name,
              maxTokens: Math.min(8192, Math.floor(a * 0.1)),
              contextWindow: a,
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
      async chat(t, n, s = {}) {
        this._modelsLoaded || (await this.loadModels());
        let o = s.model || this.defaultModel;
        if (!o) throw new Error("No local model available. Is Ollama running?");
        let i = await is.post(
          `${this.baseUrl}/api/chat`,
          {
            model: o,
            messages: t,
            tools: n && n.length > 0 ? n : void 0,
            stream: !1,
            options: {
              temperature: s.temperature ?? this.temperature,
              num_predict: s.maxTokens || 8192,
            },
          },
          { timeout: s.timeout || this.timeout },
        );
        return this.normalizeResponse(i.data);
      }
      async stream(t, n, s = {}) {
        this._modelsLoaded || (await this.loadModels());
        let o = s.model || this.defaultModel;
        if (!o) throw new Error("No local model available. Is Ollama running?");
        let i = s.onToken || (() => {}),
          a;
        try {
          a = await is.post(
            `${this.baseUrl}/api/chat`,
            {
              model: o,
              messages: t,
              tools: n && n.length > 0 ? n : void 0,
              stream: !0,
              options: {
                temperature: s.temperature ?? this.temperature,
                num_predict: s.maxTokens || 8192,
              },
            },
            {
              timeout: s.timeout || this.timeout,
              responseType: "stream",
              signal: s.signal,
            },
          );
        } catch (c) {
          if (
            c.name === "CanceledError" ||
            c.name === "AbortError" ||
            c.code === "ERR_CANCELED"
          )
            throw c;
          let p = c.response?.data?.error || c.message;
          throw new Error(`API Error: ${p}`);
        }
        return new Promise((c, p) => {
          let u = "",
            l = [],
            d = "";
          (s.signal &&
            s.signal.addEventListener(
              "abort",
              () => {
                (a.data.destroy(),
                  p(
                    new DOMException("The operation was aborted", "AbortError"),
                  ));
              },
              { once: !0 },
            ),
            a.data.on("data", (m) => {
              d += m.toString();
              let h = d.split(`
`);
              d = h.pop() || "";
              for (let f of h) {
                if (!f.trim()) continue;
                let x;
                try {
                  x = JSON.parse(f);
                } catch {
                  continue;
                }
                if (
                  (x.message?.content &&
                    (i(x.message.content), (u += x.message.content)),
                  x.message?.tool_calls && (l = l.concat(x.message.tool_calls)),
                  x.done)
                ) {
                  c({ content: u, tool_calls: this._normalizeToolCalls(l) });
                  return;
                }
              }
            }),
            a.data.on("error", (m) => {
              s.signal?.aborted || p(new Error(`Stream error: ${m.message}`));
            }),
            a.data.on("end", () => {
              if (d.trim())
                try {
                  let m = JSON.parse(d);
                  (m.message?.content &&
                    (i(m.message.content), (u += m.message.content)),
                    m.message?.tool_calls &&
                      (l = l.concat(m.message.tool_calls)));
                } catch {}
              c({ content: u, tool_calls: this._normalizeToolCalls(l) });
            }));
        });
      }
      normalizeResponse(t) {
        let n = t.message || {};
        return {
          content: n.content || "",
          tool_calls: this._normalizeToolCalls(n.tool_calls || []),
        };
      }
      _parseContextFromModelfile(t) {
        if (!t) return null;
        let n = t.match(/PARAMETER\s+num_ctx\s+(\d+)/i);
        return n ? parseInt(n[1], 10) : null;
      }
      _normalizeToolCalls(t) {
        return t.map((n, s) => ({
          id: n.id || `local-${Date.now()}-${s}`,
          function: {
            name: n.function?.name || n.name || "unknown",
            arguments: n.function?.arguments || n.arguments || {},
          },
        }));
      }
    };
  Vl.exports = { LocalProvider: ni, DEFAULT_LOCAL_URL: Jl };
});
var ln = _((Ik, sp) => {
  var ht = require("fs"),
    si = require("path"),
    Xl = {
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
    as = [],
    nt = {};
  function Qx(e, t, n, s) {
    if (
      (as.push({ provider: e, model: t, input: n, output: s }),
      nt[e] !== void 0)
    ) {
      let o = tp(e);
      o.allowed ||
        process.stderr
          .write(`\x1B[33m\u26A0 Budget limit reached for ${e}: $${o.spent.toFixed(2)} / $${o.limit.toFixed(2)}\x1B[0m
`);
    }
  }
  function oi(e, t) {
    let n = Xl[e];
    return n ? n[t] || { input: 0, output: 0 } : { input: 0, output: 0 };
  }
  function Ql(e) {
    let t = oi(e.provider, e.model);
    return (e.input * t.input + e.output * t.output) / 1e6;
  }
  function Zl() {
    let e = {};
    for (let i of as) {
      let a = `${i.provider}:${i.model}`;
      (e[a] ||
        (e[a] = { provider: i.provider, model: i.model, input: 0, output: 0 }),
        (e[a].input += i.input),
        (e[a].output += i.output));
    }
    let t = Object.values(e).map((i) => ({ ...i, cost: Ql(i) })),
      n = t.reduce((i, a) => i + a.cost, 0),
      s = t.reduce((i, a) => i + a.input, 0),
      o = t.reduce((i, a) => i + a.output, 0);
    return { totalCost: n, totalInput: s, totalOutput: o, breakdown: t };
  }
  function Zx() {
    let { totalCost: e, totalInput: t, totalOutput: n, breakdown: s } = Zl();
    if (s.length === 0) return "No token usage recorded this session.";
    let o = [];
    (o.push("Session Token Usage:"), o.push(""));
    for (let i of s) {
      let a = i.cost > 0 ? `$${i.cost.toFixed(4)}` : "free";
      (o.push(`  ${i.provider}:${i.model}`),
        o.push(`    Input:  ${i.input.toLocaleString()} tokens`),
        o.push(`    Output: ${i.output.toLocaleString()} tokens`),
        o.push(`    Cost:   ${a}`));
    }
    return (
      o.push(""),
      o.push(
        `  Total: ${t.toLocaleString()} in + ${n.toLocaleString()} out = $${e.toFixed(4)}`,
      ),
      o.join(`
`)
    );
  }
  function eb(e, t, n, s) {
    let o = oi(e, t),
      i = (n * o.input + s * o.output) / 1e6;
    return i <= 0 ? "" : `[~$${i.toFixed(4)}]`;
  }
  function tb() {
    as = [];
  }
  function nb(e, t) {
    nt[e] = t;
  }
  function sb(e) {
    delete nt[e];
  }
  function ob() {
    return { ...nt };
  }
  function ep(e) {
    let t = 0;
    for (let n of as) n.provider === e && (t += Ql(n));
    return t;
  }
  function tp(e) {
    let t = ep(e),
      n = nt[e];
    if (n === void 0)
      return { allowed: !0, spent: t, limit: null, remaining: null };
    let s = Math.max(0, n - t);
    return { allowed: t < n, spent: t, limit: n, remaining: s };
  }
  function np() {
    let e = si.join(process.cwd(), ".nex", "config.json");
    if (ht.existsSync(e))
      try {
        let t = JSON.parse(ht.readFileSync(e, "utf-8"));
        t.costLimits &&
          typeof t.costLimits == "object" &&
          (nt = { ...t.costLimits });
      } catch {}
  }
  function ib() {
    let e = si.join(process.cwd(), ".nex"),
      t = si.join(e, "config.json"),
      n = {};
    if (ht.existsSync(t))
      try {
        n = JSON.parse(ht.readFileSync(t, "utf-8"));
      } catch {
        n = {};
      }
    ((n.costLimits = nt),
      ht.existsSync(e) || ht.mkdirSync(e, { recursive: !0 }),
      ht.writeFileSync(t, JSON.stringify(n, null, 2), "utf-8"));
  }
  function ab() {
    nt = {};
  }
  np();
  sp.exports = {
    PRICING: Xl,
    trackUsage: Qx,
    getSessionCosts: Zl,
    formatCosts: Zx,
    formatCostHint: eb,
    resetCosts: tb,
    getPricing: oi,
    setCostLimit: nb,
    removeCostLimit: sb,
    getCostLimits: ob,
    getProviderSpend: ep,
    checkBudget: tp,
    loadCostLimits: np,
    saveCostLimits: ib,
    resetCostLimits: ab,
  };
});
var Ie = _((Dk, lp) => {
  var { OllamaProvider: rb } = Ll(),
    { OpenAIProvider: cb } = Il(),
    { AnthropicProvider: lb } = zl(),
    { GeminiProvider: pb } = Kl(),
    { LocalProvider: ub } = Yl(),
    { checkBudget: op } = ln(),
    ip = {
      top: {
        ollama: "kimi-k2.5",
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
    ap = {};
  for (let [e, t] of Object.entries(ip))
    for (let n of Object.values(t)) ap[n] = e;
  function rs(e, t) {
    let n = ap[e];
    return (n && ip[n][t]) || e;
  }
  var fe = {},
    be = null,
    J = null,
    zt = [];
  function Le() {
    if (Object.keys(fe).length > 0) return;
    (Bt("ollama", new rb()),
      Bt("openai", new cb()),
      Bt("anthropic", new lb()),
      Bt("gemini", new pb()),
      Bt("local", new ub()));
    let e = process.env.DEFAULT_PROVIDER || "ollama",
      t = process.env.DEFAULT_MODEL || null;
    fe[e]
      ? ((be = e), (J = t || fe[e].defaultModel))
      : ((be = "ollama"), (J = "kimi-k2.5"));
    let n = process.env.FALLBACK_CHAIN;
    n &&
      (zt = n
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean));
  }
  function Bt(e, t) {
    fe[e] = t;
  }
  function db(e) {
    return (Le(), fe[e] || null);
  }
  function ii() {
    return (Le(), fe[be] || null);
  }
  function mb() {
    return (Le(), be);
  }
  function fb() {
    return (Le(), J);
  }
  function hb() {
    Le();
    let e = ii();
    if (!e) return { id: J, name: J, provider: be };
    let t = e.getModel(J);
    return t ? { ...t, provider: be } : { id: J, name: J, provider: be };
  }
  function rp(e) {
    if (!e) return { provider: null, model: null };
    let t = e.indexOf(":");
    if (t > 0) {
      let n = e.slice(0, t);
      if (
        fe[n] ||
        ["ollama", "openai", "anthropic", "gemini", "local"].includes(n)
      )
        return { provider: n, model: e.slice(t + 1) };
    }
    return { provider: null, model: e };
  }
  function gb(e) {
    Le();
    let { provider: t, model: n } = rp(e);
    if (t) {
      let o = fe[t];
      return o && (o.getModel(n) || t === "local")
        ? ((be = t), (J = n), !0)
        : !1;
    }
    let s = ii();
    if (s && s.getModel(n)) return ((J = n), !0);
    for (let [o, i] of Object.entries(fe))
      if (i.getModel(n)) return ((be = o), (J = n), !0);
    return !1;
  }
  function xb() {
    Le();
    let e = new Set();
    for (let t of Object.values(fe)) for (let n of t.getModelNames()) e.add(n);
    return Array.from(e);
  }
  function bb() {
    return (
      Le(),
      Object.entries(fe).map(([e, t]) => ({
        provider: e,
        configured: t.isConfigured(),
        models: Object.values(t.getModels()).map((n) => ({
          ...n,
          active: e === be && n.id === J,
        })),
      }))
    );
  }
  function vb() {
    Le();
    let e = [];
    for (let [t, n] of Object.entries(fe)) {
      let s = n.isConfigured();
      for (let o of Object.values(n.getModels()))
        e.push({
          spec: `${t}:${o.id}`,
          name: o.name,
          provider: t,
          configured: s,
        });
    }
    return e;
  }
  function yb(e) {
    zt = Array.isArray(e) ? e : [];
  }
  function $b() {
    return [...zt];
  }
  function cp(e) {
    let t = e.message || "",
      n = e.code || "";
    return !!(
      t.includes("429") ||
      t.includes("500") ||
      t.includes("502") ||
      t.includes("503") ||
      t.includes("504") ||
      n === "ECONNABORTED" ||
      n === "ETIMEDOUT" ||
      n === "ECONNREFUSED" ||
      n === "ECONNRESET" ||
      n === "EHOSTUNREACH" ||
      n === "ENETUNREACH" ||
      n === "EPIPE" ||
      n === "ERR_SOCKET_CONNECTION_TIMEOUT" ||
      t.includes("socket disconnected") ||
      t.includes("TLS") ||
      t.includes("ECONNRESET") ||
      t.includes("ECONNABORTED") ||
      t.includes("network") ||
      t.includes("ETIMEDOUT")
    );
  }
  async function wb(e, t, n = {}) {
    Le();
    let s = [be, ...zt.filter((c) => c !== be)],
      o,
      i = 0,
      a = 0;
    for (let c = 0; c < s.length; c++) {
      let p = s[c],
        u = fe[p];
      if (!u || !u.isConfigured()) continue;
      a++;
      let l = op(p);
      if (!l.allowed) {
        (i++,
          (o = new Error(
            `Budget limit reached for ${p}: $${l.spent.toFixed(2)} / $${l.limit.toFixed(2)}`,
          )));
        continue;
      }
      try {
        let d = c > 0,
          m = d ? rs(J, p) : J;
        return (
          d &&
            m !== J &&
            process.stderr.write(`  [fallback: ${p}:${m}]
`),
          await u.stream(e, t, { model: m, signal: n.signal, ...n })
        );
      } catch (d) {
        if (((o = d), cp(d) && c < s.length - 1)) continue;
        throw d;
      }
    }
    throw i > 0 && i === a
      ? new Error(
          "All providers are over budget. Use /budget to check limits or /budget <provider> off to remove a limit.",
        )
      : o || new Error("No configured provider available");
  }
  async function kb(e, t, n = {}) {
    if ((Le(), n.provider)) {
      let c = fe[n.provider];
      if (!c || !c.isConfigured())
        throw new Error(`Provider '${n.provider}' is not available`);
      let p = { model: n.model || J, ...n };
      try {
        return await c.chat(e, t, p);
      } catch (u) {
        if (typeof c.stream == "function")
          try {
            return await c.stream(e, t, { ...p, onToken: () => {} });
          } catch {}
        throw u;
      }
    }
    let s = [be, ...zt.filter((c) => c !== be)],
      o,
      i = 0,
      a = 0;
    for (let c = 0; c < s.length; c++) {
      let p = s[c],
        u = fe[p];
      if (!u || !u.isConfigured()) continue;
      a++;
      let l = op(p);
      if (!l.allowed) {
        (i++,
          (o = new Error(
            `Budget limit reached for ${p}: $${l.spent.toFixed(2)} / $${l.limit.toFixed(2)}`,
          )));
        continue;
      }
      try {
        let d = c > 0,
          m = d ? rs(J, p) : J;
        return (
          d &&
            m !== J &&
            process.stderr.write(`  [fallback: ${p}:${m}]
`),
          await u.chat(e, t, { model: m, ...n })
        );
      } catch (d) {
        let m = c > 0 ? rs(J, p) : J;
        if (typeof u.stream == "function")
          try {
            return await u.stream(e, t, { model: m, ...n, onToken: () => {} });
          } catch {}
        if (((o = d), cp(d) && c < s.length - 1)) continue;
        throw d;
      }
    }
    throw i > 0 && i === a
      ? new Error(
          "All providers are over budget. Use /budget to check limits or /budget <provider> off to remove a limit.",
        )
      : o || new Error("No configured provider available");
  }
  function _b() {
    Le();
    let e = [];
    for (let [t, n] of Object.entries(fe))
      n.isConfigured() &&
        e.push({ name: t, models: Object.values(n.getModels()) });
    return e;
  }
  function Sb() {
    for (let e of Object.keys(fe)) delete fe[e];
    ((be = null), (J = null), (zt = []));
  }
  lp.exports = {
    registerProvider: Bt,
    getProvider: db,
    getActiveProvider: ii,
    getActiveProviderName: mb,
    getActiveModelId: fb,
    getActiveModel: hb,
    setActiveModel: gb,
    getModelNames: xb,
    parseModelSpec: rp,
    listProviders: bb,
    listAllModels: vb,
    callStream: wb,
    callChat: kb,
    getConfiguredProviders: _b,
    setFallbackChain: yb,
    getFallbackChain: $b,
    resolveModelForProvider: rs,
    _reset: Sb,
  };
});
var cs = _((Uk, pp) => {
  var pn = Ie(),
    Eb = {
      "kimi-k2.5": { id: "kimi-k2.5", name: "Kimi K2.5", max_tokens: 16384 },
      "qwen3-coder:480b": {
        id: "qwen3-coder:480b",
        name: "Qwen3 Coder 480B",
        max_tokens: 16384,
      },
    };
  function Tb() {
    return pn.getActiveModel();
  }
  function Rb(e) {
    return pn.setActiveModel(e);
  }
  function Cb() {
    return pn.getModelNames();
  }
  function Ab(e) {
    if (!e) return null;
    if (typeof e == "object") return e;
    try {
      return JSON.parse(e);
    } catch {}
    try {
      let s = e.replace(/,\s*([}\]])/g, "$1").replace(/'/g, '"');
      return JSON.parse(s);
    } catch {}
    let t = e.match(/\{[\s\S]*\}/);
    if (t)
      try {
        return JSON.parse(t[0]);
      } catch {}
    try {
      let s = e.replace(/(\{|,)\s*([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
      return JSON.parse(s);
    } catch {}
    let n = e.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (n)
      try {
        return JSON.parse(n[1].trim());
      } catch {}
    return null;
  }
  async function Ob(e, t) {
    let { C: n } = pe(),
      { Spinner: s } = pe(),
      o = new s("Thinking...");
    o.start();
    let i = !0,
      a = "";
    try {
      let c = await pn.callStream(e, t, {
        onToken: (p) => {
          (i && (o.stop(), process.stdout.write(`${n.blue}`), (i = !1)),
            process.stdout.write(p),
            (a += p));
        },
      });
      return (
        i
          ? o.stop()
          : process.stdout.write(`${n.reset}
`),
        c
      );
    } catch (c) {
      throw (o.stop(), c);
    }
  }
  async function jb(e, t) {
    return pn.callChat(e, t);
  }
  pp.exports = {
    MODELS: Eb,
    getActiveModel: Tb,
    setActiveModel: Rb,
    getModelNames: Cb,
    callOllamaStream: Ob,
    callOllama: jb,
    parseToolArgs: Ab,
  };
});
var un = _((Bk, hp) => {
  var Pb = require("readline"),
    { C: ls } = pe(),
    up = [
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
    ],
    ai = [
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
  function dp(e) {
    let t =
      e.match(/ssh\s+[^"]*"([^"]+)"/)?.[1] ||
      e.match(/ssh\s+[^']*'([^']+)'/)?.[1];
    if (!t) return !1;
    let s = t
      .replace(/\bfor\s[\s\S]*?\bdone\b/g, (i) => i.replace(/;/g, "\0"))
      .replace(/\bwhile\s[\s\S]*?\bdone\b/g, (i) => i.replace(/;/g, "\0"))
      .split(/\s*(?:&&|;)\s*/)
      .map((i) => i.replace(/\x00/g, ";").trim())
      .filter(Boolean);
    if (s.length === 0) return !1;
    let o = (i) => {
      let a = i.replace(/^sudo\s+(?:-[ugCD]\s+\S+\s+|-[A-Za-z]+\s+)*/, "");
      if (/^\s*(?:echo|printf)\s/.test(a)) return !0;
      if (/^\s*for\s/.test(i) || /^\s*while\s/.test(i)) {
        let c = i.match(/\bdo\s+([\s\S]*?)\s*(?:done|$)/)?.[1];
        return c
          ? c
              .split(/\s*;\s*/)
              .map((u) => u.trim())
              .filter(Boolean)
              .every((u) => o(u))
          : ai.some((p) => p.test(i));
      }
      return /^\w+=\$?\(/.test(a) || /^\w+=["']/.test(a) || /^\w+=\S/.test(a)
        ? !0
        : ai.some((c) => c.test(a));
    };
    return s.every(o);
  }
  var mp = [
      /git\s+push/,
      /npm\s+publish/,
      /npx\s+.*publish/,
      /rm\s+-rf\s/,
      /docker\s+rm/,
      /docker\s+system\s+prune/,
      /kubectl\s+delete/,
      /sudo\s/,
      /ssh\s/,
      /wget\s/,
      /curl\s.*-o\s/,
      /pip\s+install/,
      /npm\s+install\s+-g/,
    ],
    ci = !1,
    ri = null;
  function Nb(e) {
    ci = e;
  }
  function Lb() {
    return ci;
  }
  function qb(e) {
    ri = e;
  }
  function Mb(e) {
    for (let t of up) if (t.test(e)) return t;
    return null;
  }
  function Fb(e) {
    if (/ssh\s/.test(e) && dp(e)) return !1;
    for (let t of mp) if (t.test(e)) return !0;
    return !1;
  }
  function Ib(e, t = {}) {
    if (ci) return Promise.resolve(!0);
    let n = t.toolName ? "[Y/n/a] " : "[Y/n] ";
    return new Promise((s) => {
      let o = (i) => {
        let a = i.trim().toLowerCase();
        a === "a" && t.toolName ? (fp(t.toolName), s(!0)) : s(a !== "n");
      };
      if (ri) ri.question(`${ls.yellow}${e} ${n}${ls.reset}`, o);
      else {
        let i = Pb.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        i.question(`${ls.yellow}${e} ${n}${ls.reset}`, (a) => {
          (i.close(), o(a));
        });
      }
    });
  }
  var fp = () => {};
  function Db(e) {
    fp = e;
  }
  hp.exports = {
    FORBIDDEN_PATTERNS: up,
    SSH_SAFE_PATTERNS: ai,
    isSSHReadOnly: dp,
    DANGEROUS_BASH: mp,
    isForbidden: Mb,
    isDangerous: Fb,
    confirm: Ib,
    setAutoConfirm: Nb,
    getAutoConfirm: Lb,
    setReadlineInterface: qb,
    setAllowAlwaysHandler: Db,
  };
});
var bp = _((zk, xp) => {
  var ps = require("path"),
    { C: k } = pe(),
    { confirm: Ub, getAutoConfirm: Bb } = un(),
    gp = 2e3;
  function dn(e, t) {
    let n = e.split(`
`),
      s = t.split(`
`),
      o = [],
      i = n.length,
      a = s.length;
    if (i > gp || a > gp) {
      for (let d of n) o.push({ type: "remove", line: d });
      for (let d of s) o.push({ type: "add", line: d });
      return o;
    }
    let c = Array.from({ length: i + 1 }, () => new Array(a + 1).fill(0));
    for (let d = 1; d <= i; d++)
      for (let m = 1; m <= a; m++)
        n[d - 1] === s[m - 1]
          ? (c[d][m] = c[d - 1][m - 1] + 1)
          : (c[d][m] = Math.max(c[d - 1][m], c[d][m - 1]));
    let p = i,
      u = a,
      l = [];
    for (; p > 0 || u > 0; )
      p > 0 && u > 0 && n[p - 1] === s[u - 1]
        ? (l.unshift({ type: "same", line: n[p - 1] }), p--, u--)
        : u > 0 && (p === 0 || c[p][u - 1] >= c[p - 1][u])
          ? (l.unshift({ type: "add", line: s[u - 1] }), u--)
          : (l.unshift({ type: "remove", line: n[p - 1] }), p--);
    return l;
  }
  function zb(e, t, n, s = 3) {
    console.log(`
${k.bold}${k.cyan}  Diff: ${e}${k.reset}`);
    let o = dn(t, n),
      i = [];
    if (
      (o.forEach((p, u) => {
        p.type !== "same" && i.push(u);
      }),
      i.length === 0)
    ) {
      console.log(`${k.gray}    (no changes)${k.reset}`);
      return;
    }
    let a = Math.max(0, i[0] - s),
      c = Math.min(o.length, i[i.length - 1] + s + 1);
    a > 0 && console.log(`${k.gray}    ...${k.reset}`);
    for (let p = a; p < c; p++) {
      let u = o[p];
      switch (u.type) {
        case "remove":
          console.log(`${k.red}  - ${u.line}${k.reset}`);
          break;
        case "add":
          console.log(`${k.green}  + ${u.line}${k.reset}`);
          break;
        default:
          console.log(`${k.gray}    ${u.line}${k.reset}`);
      }
    }
    (c < o.length && console.log(`${k.gray}    ...${k.reset}`), console.log());
  }
  function Wb(e, t, n) {
    console.log(`
${k.bold}${k.cyan}  File exists \u2014 showing changes: ${e}${k.reset}`);
    let s = dn(t, n),
      o = 0;
    for (let a of s) a.type !== "same" && o++;
    if (o === 0) {
      console.log(`${k.gray}    (identical content)${k.reset}`);
      return;
    }
    let i = 0;
    for (let a of s) {
      if (i >= 30) {
        console.log(`${k.gray}    ...(${o - i} more changes)${k.reset}`);
        break;
      }
      switch (a.type) {
        case "remove":
          (console.log(`${k.red}  - ${a.line}${k.reset}`), i++);
          break;
        case "add":
          (console.log(`${k.green}  + ${a.line}${k.reset}`), i++);
          break;
        default:
          i > 0 && console.log(`${k.gray}    ${a.line}${k.reset}`);
      }
    }
    console.log();
  }
  function Hb(e, t) {
    console.log(`
${k.bold}${k.cyan}  New file: ${e}${k.reset}`);
    let n = t.split(`
`),
      s = n.slice(0, 20);
    for (let o of s) console.log(`${k.green}  + ${o}${k.reset}`);
    (n.length > 20 &&
      console.log(`${k.gray}    ...+${n.length - 20} more lines${k.reset}`),
      console.log());
  }
  async function Gb(e) {
    return Bb() ? !0 : Ub(`  ${e}?`);
  }
  function Kb(e, t, n, s) {
    let o = s || process.stdout.columns || 80,
      i = Math.floor((o - 3) / 2);
    (console.log(`
${k.bold}${k.cyan}  Side-by-side: ${e}${k.reset}`),
      console.log(
        `  ${k.dim}${"\u2500".repeat(i)}\u252C${"\u2500".repeat(i)}${k.reset}`,
      ));
    let a = dn(t, n),
      c = [],
      p = 0;
    for (; p < a.length; )
      if (a[p].type === "same")
        (c.push({ left: a[p].line, right: a[p].line, type: "same" }), p++);
      else if (a[p].type === "remove") {
        let h = [];
        for (; p < a.length && a[p].type === "remove"; )
          (h.push(a[p].line), p++);
        let f = [];
        for (; p < a.length && a[p].type === "add"; ) (f.push(a[p].line), p++);
        let x = Math.max(h.length, f.length);
        for (let b = 0; b < x; b++)
          c.push({
            left: b < h.length ? h[b] : "",
            right: b < f.length ? f[b] : "",
            type: "changed",
          });
      } else
        a[p].type === "add" &&
          (c.push({ left: "", right: a[p].line, type: "changed" }), p++);
    let u = c.map((h, f) => (h.type !== "same" ? f : -1)).filter((h) => h >= 0);
    if (u.length === 0) {
      console.log(`  ${k.gray}(no changes)${k.reset}`);
      return;
    }
    let l = Math.max(0, u[0] - 2),
      d = Math.min(c.length, u[u.length - 1] + 3),
      m = (h, f) => {
        let x = h.replace(/\x1b\[[0-9;]*m/g, "");
        return x.length >= f ? h.substring(0, f) : h + " ".repeat(f - x.length);
      };
    l > 0 &&
      console.log(
        `  ${k.dim}${"\xB7".repeat(i)}\u250A${"\xB7".repeat(i)}${k.reset}`,
      );
    for (let h = l; h < d; h++) {
      let f = c[h];
      if (f.type === "same")
        console.log(
          `  ${k.gray}${m(f.left, i)}${k.reset}\u2502${k.gray}${m(f.right, i)}${k.reset}`,
        );
      else {
        let x = f.left ? `${k.red}${m(f.left, i)}${k.reset}` : `${m("", i)}`,
          b = f.right ? `${k.green}${m(f.right, i)}${k.reset}` : `${m("", i)}`;
        console.log(`  ${x}\u2502${b}`);
      }
    }
    (d < c.length &&
      console.log(
        `  ${k.dim}${"\xB7".repeat(i)}\u250A${"\xB7".repeat(i)}${k.reset}`,
      ),
      console.log(`  ${k.dim}${"\u2500".repeat(i)}\u2534${"\u2500".repeat(i)}${k.reset}
`));
  }
  function Jb(e, t, n, s = {}) {
    let o = s.label || "Update",
      i = s.context || 3,
      a = s.annotations || [],
      c = ps.isAbsolute(e) ? ps.relative(process.cwd(), e) : e,
      p = dn(t, n),
      u = 1,
      l = 1;
    for (let w of p)
      w.type === "same"
        ? ((w.oldLine = u++), (w.newLine = l++))
        : w.type === "remove"
          ? ((w.oldLine = u++), (w.newLine = null))
          : ((w.oldLine = null), (w.newLine = l++));
    let d = 0,
      m = 0;
    for (let w of p) w.type === "add" ? d++ : w.type === "remove" && m++;
    if (
      (console.log(`
${k.cyan}\u23FA${k.reset} ${k.bold}${o}(${c})${k.reset}`),
      d === 0 && m === 0)
    ) {
      console.log(`  ${k.dim}\u23BF  (no changes)${k.reset}
`);
      return;
    }
    let h = [];
    if (
      (d > 0 && h.push(`Added ${d} line${d !== 1 ? "s" : ""}`),
      m > 0 && h.push(`removed ${m} line${m !== 1 ? "s" : ""}`),
      a.length > 0)
    ) {
      let w = a.filter((C) => C.severity === "error").length,
        R = a.filter((C) => C.severity === "warn").length,
        S = a.filter((C) => C.severity === "info").length,
        E = [];
      (w > 0 && E.push(`${k.red}${w} error${w !== 1 ? "s" : ""}${k.dim}`),
        R > 0 && E.push(`${k.yellow}${R} warning${R !== 1 ? "s" : ""}${k.dim}`),
        S > 0 && E.push(`${k.cyan}${S} info${S !== 1 ? "s" : ""}${k.dim}`),
        h.push(`found ${E.join(", ")}`));
    }
    console.log(`  ${k.dim}\u23BF  ${h.join(", ")}${k.reset}`);
    let x = [];
    p.forEach((w, R) => {
      w.type !== "same" && x.push(R);
    });
    let b = [],
      v = null,
      $ = null;
    for (let w of x) {
      let R = Math.max(0, w - i),
        S = Math.min(p.length - 1, w + i);
      v === null
        ? ((v = R), ($ = S))
        : (R <= $ + 1 || (b.push([v, $]), (v = R)), ($ = S));
    }
    v !== null && b.push([v, $]);
    let T = "      ";
    for (let w = 0; w < b.length; w++) {
      w > 0 && console.log(`${T}${k.dim}\xB7\xB7\xB7${k.reset}`);
      let [R, S] = b[w];
      for (let E = R; E <= S; E++) {
        let C = p[E],
          M = C.newLine != null ? C.newLine : C.oldLine,
          F = String(M).padStart(4),
          B = C.type !== "remove" ? a.filter((W) => W.line === C.newLine) : [];
        C.type === "remove"
          ? console.log(`${T}${k.red}${F} -${C.line}${k.reset}`)
          : C.type === "add"
            ? console.log(`${T}${k.green}${F} +${C.line}${k.reset}`)
            : console.log(`${T}${k.dim}${F}${k.reset} ${C.line}`);
        for (let W of B) {
          let ne = k.cyan,
            se = "\u2139";
          (W.severity === "error"
            ? ((ne = k.red), (se = "\u2716"))
            : W.severity === "warn" && ((ne = k.yellow), (se = "\u26A0")),
            console.log(`${T}     ${ne}${se} ${W.message}${k.reset}`));
        }
      }
    }
    console.log();
  }
  function Vb(e, t, n = {}) {
    let s = ps.isAbsolute(e) ? ps.relative(process.cwd(), e) : e,
      o = t.split(`
`),
      i = n.annotations || [];
    console.log(`
${k.cyan}\u23FA${k.reset} ${k.bold}Create(${s})${k.reset}`);
    let a = [`${o.length} line${o.length !== 1 ? "s" : ""}`];
    if (i.length > 0) {
      let l = i.filter((f) => f.severity === "error").length,
        d = i.filter((f) => f.severity === "warn").length,
        m = i.filter((f) => f.severity === "info").length,
        h = [];
      (l > 0 && h.push(`${k.red}${l} error${l !== 1 ? "s" : ""}${k.dim}`),
        d > 0 && h.push(`${k.yellow}${d} warning${d !== 1 ? "s" : ""}${k.dim}`),
        m > 0 && h.push(`${k.cyan}${m} info${m !== 1 ? "s" : ""}${k.dim}`),
        a.push(`found ${h.join(", ")}`));
    }
    console.log(`  ${k.dim}\u23BF  ${a.join(", ")}${k.reset}`);
    let p = "      ",
      u = Math.min(o.length, 20);
    for (let l = 0; l < u; l++) {
      let d = String(l + 1).padStart(4),
        m = l + 1,
        h = i.filter((f) => f.line === m);
      console.log(`${p}${k.green}${d} +${o[l]}${k.reset}`);
      for (let f of h) {
        let x = k.cyan,
          b = "\u2139";
        (f.severity === "error"
          ? ((x = k.red), (b = "\u2716"))
          : f.severity === "warn" && ((x = k.yellow), (b = "\u26A0")),
          console.log(`${p}     ${x}${b} ${f.message}${k.reset}`));
      }
    }
    (o.length > 20 &&
      console.log(`${p}${k.dim}   ...+${o.length - 20} more lines${k.reset}`),
      console.log());
  }
  xp.exports = {
    diffLines: dn,
    showEditDiff: zb,
    showWriteDiff: Wb,
    showNewFilePreview: Hb,
    confirmFileChange: Gb,
    showSideBySideDiff: Kb,
    showClaudeDiff: Jb,
    showClaudeNewFile: Vb,
  };
});
var fs = _((Wk, ui) => {
  var vp = require("util").promisify(require("child_process").exec),
    Yb = require("util").promisify(require("child_process").execFile),
    { C: te } = pe();
  async function li(e) {
    try {
      let { stdout: t } = await vp(e, { cwd: process.cwd(), timeout: 3e4 });
      return t.trim();
    } catch {
      return null;
    }
  }
  async function us(...e) {
    try {
      let { stdout: t } = await Yb("git", e, {
        cwd: process.cwd(),
        timeout: 3e4,
      });
      return t.trim();
    } catch {
      return null;
    }
  }
  async function yp() {
    return (await li("git rev-parse --is-inside-work-tree")) === "true";
  }
  async function $p() {
    return await li("git branch --show-current");
  }
  async function ds() {
    try {
      let { stdout: e } = await vp("git status --porcelain", {
        cwd: process.cwd(),
        timeout: 3e4,
      });
      return !e || !e.trim()
        ? []
        : e
            .split(
              `
`,
            )
            .filter(Boolean)
            .map((t) => {
              let n = t.substring(0, 2).trim(),
                s = t.substring(3);
              return { status: n, file: s };
            });
    } catch {
      return [];
    }
  }
  async function mn(e = !1) {
    return (await li(`git diff ${e ? "--cached" : ""}`)) || "";
  }
  async function ms() {
    return (await ds()).map((t) => t.file);
  }
  async function pi() {
    let e = await ms();
    if (e.length === 0) return null;
    let t = await mn(),
      s = (await mn(!0)) || t,
      o = 0,
      i = 0;
    if (s) {
      let l = s.split(`
`);
      for (let d of l)
        (d.startsWith("+") && !d.startsWith("+++") && o++,
          d.startsWith("-") && !d.startsWith("---") && i++);
    } else o = e.length;
    let a = "chore",
      c = e.join(" ").toLowerCase();
    c.includes("test")
      ? (a = "test")
      : c.includes("readme") || c.includes("doc")
        ? (a = "docs")
        : o > i * 2
          ? (a = "feat")
          : i > o
            ? (a = "refactor")
            : (a = "fix");
    let p = e.slice(0, 3).map((l) => l.split("/").pop());
    return {
      summary: `${a}: update ${p.join(", ")}${e.length > 3 ? ` (+${e.length - 3} more)` : ""}`,
      type: a,
      files: e,
      stats: { additions: o, deletions: i },
    };
  }
  async function wp(e) {
    let n = `feat/${e
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50)}`;
    return (await us("checkout", "-b", n)) !== null ? n : null;
  }
  async function kp(e) {
    return (
      await us("add", "-A"),
      (await us("commit", "-m", e))
        ? await us("rev-parse", "--short", "HEAD")
        : null
    );
  }
  async function _p() {
    let e = await pi();
    if (!e) return `${te.dim}No changes${te.reset}`;
    let t = [];
    (t.push(`
${te.bold}${te.cyan}Git Diff Summary:${te.reset}`),
      t.push(
        `  ${te.green}+${e.stats.additions}${te.reset} ${te.red}-${e.stats.deletions}${te.reset} in ${e.files.length} file(s)`,
      ),
      t.push(`
${te.bold}${te.cyan}Files:${te.reset}`));
    for (let n of e.files.slice(0, 20)) t.push(`  ${te.dim}${n}${te.reset}`);
    return (
      e.files.length > 20 &&
        t.push(`  ${te.dim}...+${e.files.length - 20} more${te.reset}`),
      t.push(`
${te.bold}${te.cyan}Suggested message:${te.reset}`),
      t.push(`  ${te.cyan}${e.summary}${te.reset}
`),
      t.join(`
`)
    );
  }
  async function Sp() {
    return (await ds()).filter(
      (t) => t.status === "UU" || t.status === "AA" || t.status === "DD",
    );
  }
  async function Ep() {
    let e = await ms();
    if (e.length === 0) return "";
    let t = [`CHANGED FILES (${e.length}):`];
    for (let s of e.slice(0, 10)) t.push(`  ${s}`);
    let n = await mn();
    if (n) {
      let s =
        n.length > 5e3
          ? n.substring(0, 5e3) +
            `
...(truncated)`
          : n;
      t.push(`
DIFF:
${s}`);
    }
    return t.join(`
`);
  }
  ui.exports = {
    isGitRepo: yp,
    getCurrentBranch: $p,
    getStatus: ds,
    getDiff: mn,
    getChangedFiles: ms,
    analyzeDiff: pi,
    createBranch: wp,
    commit: kp,
    formatDiffSummary: _p,
    getDiffContext: Ep,
    getMergeConflicts: Sp,
  };
  ui.exports = {
    isGitRepo: yp,
    getCurrentBranch: $p,
    getStatus: ds,
    getDiff: mn,
    getChangedFiles: ms,
    analyzeDiff: pi,
    createBranch: wp,
    commit: kp,
    formatDiffSummary: _p,
    getDiffContext: Ep,
    getMergeConflicts: Sp,
  };
});
var mi = _((Hk, Tp) => {
  var di = require("fs").promises,
    Xb = 50,
    Ke = [],
    Wt = [];
  function Qb(e, t, n, s) {
    for (
      Ke.push({
        tool: e,
        filePath: t,
        oldContent: n,
        newContent: s,
        timestamp: Date.now(),
      });
      Ke.length > Xb;
    )
      Ke.shift();
    Wt.length = 0;
  }
  async function Zb() {
    if (Ke.length === 0) return null;
    let e = Ke.pop();
    if (e.oldContent === null)
      try {
        await di.unlink(e.filePath);
      } catch {}
    else await di.writeFile(e.filePath, e.oldContent, "utf-8");
    return (
      Wt.push(e),
      { tool: e.tool, filePath: e.filePath, wasCreated: e.oldContent === null }
    );
  }
  async function ev() {
    if (Wt.length === 0) return null;
    let e = Wt.pop();
    return (
      await di.writeFile(e.filePath, e.newContent, "utf-8"),
      Ke.push(e),
      { tool: e.tool, filePath: e.filePath }
    );
  }
  function tv(e = 10) {
    return Ke.slice(-e)
      .reverse()
      .map((t) => ({
        tool: t.tool,
        filePath: t.filePath,
        timestamp: t.timestamp,
      }));
  }
  function nv() {
    return Ke.length;
  }
  function sv() {
    return Wt.length;
  }
  function ov() {
    ((Ke.length = 0), (Wt.length = 0));
  }
  Tp.exports = {
    recordChange: Qb,
    undo: Zb,
    redo: ev,
    getHistory: tv,
    getUndoCount: nv,
    getRedoCount: sv,
    clearHistory: ov,
  };
});
var hs = _((Gk, Pp) => {
  var Ae = require("fs"),
    Ht = require("path"),
    Ce = [];
  function fi() {
    return Ht.join(process.cwd(), ".nex", "skills");
  }
  function Rp() {
    return Ht.join(process.cwd(), ".nex", "config.json");
  }
  function iv() {
    let e = fi();
    return (Ae.existsSync(e) || Ae.mkdirSync(e, { recursive: !0 }), e);
  }
  function hi() {
    let e = Rp();
    if (!Ae.existsSync(e)) return [];
    try {
      let t = JSON.parse(Ae.readFileSync(e, "utf-8"));
      return t.skills && Array.isArray(t.skills.disabled)
        ? t.skills.disabled
        : [];
    } catch {
      return [];
    }
  }
  function Cp(e) {
    let t = Rp(),
      n = {};
    if (Ae.existsSync(t))
      try {
        n = JSON.parse(Ae.readFileSync(t, "utf-8"));
      } catch {
        n = {};
      }
    (n.skills || (n.skills = {}), (n.skills.disabled = e));
    let s = Ht.dirname(t);
    (Ae.existsSync(s) || Ae.mkdirSync(s, { recursive: !0 }),
      Ae.writeFileSync(t, JSON.stringify(n, null, 2), "utf-8"));
  }
  function Ap(e, t) {
    let n = [];
    if (typeof e != "object" || e === null)
      return { valid: !1, errors: ["Module must export an object"] };
    if (
      (e.name !== void 0 &&
        typeof e.name != "string" &&
        n.push("name must be a string"),
      e.description !== void 0 &&
        typeof e.description != "string" &&
        n.push("description must be a string"),
      e.instructions !== void 0 &&
        typeof e.instructions != "string" &&
        n.push("instructions must be a string"),
      e.commands !== void 0)
    )
      if (!Array.isArray(e.commands)) n.push("commands must be an array");
      else
        for (let s = 0; s < e.commands.length; s++) {
          let o = e.commands[s];
          ((!o.cmd || typeof o.cmd != "string") &&
            n.push(`commands[${s}].cmd must be a non-empty string`),
            o.handler !== void 0 &&
              typeof o.handler != "function" &&
              n.push(`commands[${s}].handler must be a function`));
        }
    if (e.tools !== void 0)
      if (!Array.isArray(e.tools)) n.push("tools must be an array");
      else
        for (let s = 0; s < e.tools.length; s++) {
          let o = e.tools[s];
          ((!o.function ||
            !o.function.name ||
            typeof o.function.name != "string") &&
            n.push(`tools[${s}].function.name must be a non-empty string`),
            o.execute !== void 0 &&
              typeof o.execute != "function" &&
              n.push(`tools[${s}].execute must be a function`));
        }
    return { valid: n.length === 0, errors: n };
  }
  function Op(e) {
    try {
      let t = Ae.readFileSync(e, "utf-8").trim();
      return t
        ? {
            name: Ht.basename(e, ".md"),
            type: "prompt",
            filePath: e,
            instructions: t,
            commands: [],
            tools: [],
          }
        : null;
    } catch {
      return null;
    }
  }
  function jp(e) {
    try {
      let t = require(e),
        { valid: n, errors: s } = Ap(t, e);
      return n
        ? {
            name: t.name || Ht.basename(e, ".js"),
            type: "script",
            filePath: e,
            description: t.description || "",
            instructions: t.instructions || "",
            commands: (t.commands || []).map((i) => ({
              cmd: i.cmd.startsWith("/") ? i.cmd : `/${i.cmd}`,
              desc: i.desc || i.description || "",
              handler: i.handler || null,
            })),
            tools: (t.tools || []).map((i) => ({
              type: i.type || "function",
              function: {
                name: i.function.name,
                description: i.function.description || "",
                parameters: i.function.parameters || {
                  type: "object",
                  properties: {},
                },
              },
              execute: i.execute || null,
            })),
          }
        : (console.error(`Skill validation failed: ${e}
  ${s.join(`
  `)}`),
          null);
    } catch (t) {
      return (console.error(`Failed to load skill: ${e}: ${t.message}`), null);
    }
  }
  function av() {
    Ce = [];
    let e = fi();
    if (!Ae.existsSync(e)) return Ce;
    let t = hi(),
      n;
    try {
      n = Ae.readdirSync(e);
    } catch {
      return Ce;
    }
    for (let s of n) {
      let o = Ht.join(e, s),
        i;
      try {
        i = Ae.statSync(o);
      } catch {
        continue;
      }
      if (!i.isFile()) continue;
      let a = null;
      (s.endsWith(".md") ? (a = Op(o)) : s.endsWith(".js") && (a = jp(o)),
        a && ((a.enabled = !t.includes(a.name)), Ce.push(a)));
    }
    return Ce;
  }
  function rv() {
    let e = [];
    for (let t of Ce)
      !t.enabled ||
        !t.instructions ||
        e.push(`[Skill: ${t.name}]
${t.instructions}`);
    return e.length === 0
      ? ""
      : `SKILL INSTRUCTIONS:
${e.join(`

`)}`;
  }
  function cv() {
    let e = [];
    for (let t of Ce)
      if (t.enabled)
        for (let n of t.commands)
          e.push({ cmd: n.cmd, desc: n.desc || `[skill: ${t.name}]` });
    return e;
  }
  function lv() {
    let e = [];
    for (let t of Ce)
      if (t.enabled)
        for (let n of t.tools)
          e.push({
            type: "function",
            function: {
              name: `skill_${n.function.name}`,
              description: `[Skill:${t.name}] ${n.function.description}`,
              parameters: n.function.parameters,
            },
          });
    return e;
  }
  async function pv(e, t) {
    if (!e.startsWith("skill_")) return null;
    let n = e.substring(6);
    for (let s of Ce)
      if (s.enabled) {
        for (let o of s.tools)
          if (o.function.name === n && o.execute)
            try {
              let i = await o.execute(t);
              return typeof i == "string" ? i : JSON.stringify(i);
            } catch (i) {
              return `ERROR: Skill tool '${n}' failed: ${i.message}`;
            }
      }
    return `ERROR: Skill tool '${n}' not found`;
  }
  function uv(e) {
    let [t, ...n] = e.split(/\s+/),
      s = n.join(" ").trim();
    for (let o of Ce)
      if (o.enabled) {
        for (let i of o.commands)
          if (i.cmd === t && i.handler) {
            try {
              i.handler(s);
            } catch (a) {
              console.error(`Skill command error (${t}): ${a.message}`);
            }
            return !0;
          }
      }
    return !1;
  }
  function dv() {
    return Ce.map((e) => ({
      name: e.name,
      type: e.type,
      enabled: e.enabled,
      description: e.description || "",
      commands: e.commands.length,
      tools: e.tools.length,
      filePath: e.filePath,
    }));
  }
  function mv(e) {
    let t = Ce.find((s) => s.name === e);
    if (!t) return !1;
    t.enabled = !0;
    let n = hi().filter((s) => s !== e);
    return (Cp(n), !0);
  }
  function fv(e) {
    let t = Ce.find((s) => s.name === e);
    if (!t) return !1;
    t.enabled = !1;
    let n = hi();
    return (n.includes(e) || (n.push(e), Cp(n)), !0);
  }
  function hv() {
    return Ce;
  }
  Pp.exports = {
    initSkillsDir: iv,
    loadAllSkills: av,
    getSkillInstructions: rv,
    getSkillCommands: cv,
    getSkillToolDefinitions: lv,
    routeSkillCall: pv,
    handleSkillCommand: uv,
    listSkills: dv,
    enableSkill: mv,
    disableSkill: fv,
    getLoadedSkills: hv,
    _getSkillsDir: fi,
    _validateScriptSkill: Ap,
    _loadMarkdownSkill: Op,
    _loadScriptSkill: jp,
  };
});
var xs = _((Kk, Ip) => {
  var { spawn: gv } = require("child_process"),
    xv = require("path"),
    Np = require("fs"),
    Je = new Map();
  function bv() {
    return xv.join(process.cwd(), ".nex", "config.json");
  }
  function gi() {
    let e = bv();
    if (!Np.existsSync(e)) return {};
    try {
      return JSON.parse(Np.readFileSync(e, "utf-8")).mcpServers || {};
    } catch {
      return {};
    }
  }
  function gs(e, t, n = {}, s = 1e4) {
    return new Promise((o, i) => {
      let a = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        c =
          JSON.stringify({ jsonrpc: "2.0", id: a, method: t, params: n }) +
          `
`,
        p = "",
        u = setTimeout(() => {
          (d(), i(new Error(`MCP request timeout: ${t}`)));
        }, s);
      function l(m) {
        p += m.toString();
        let h = p.split(`
`);
        for (let f of h)
          if (f.trim())
            try {
              let x = JSON.parse(f);
              if (x.id === a) {
                (d(),
                  x.error
                    ? i(
                        new Error(
                          `MCP error: ${x.error.message || JSON.stringify(x.error)}`,
                        ),
                      )
                    : o(x.result));
                return;
              }
            } catch {}
        p = h[h.length - 1] || "";
      }
      function d() {
        (clearTimeout(u), e.stdout.removeListener("data", l));
      }
      e.stdout.on("data", l);
      try {
        e.stdin.write(c);
      } catch (m) {
        (d(), i(new Error(`MCP write failed: ${m.message}`)));
      }
    });
  }
  async function Lp(e, t) {
    if (Je.has(e)) return Je.get(e);
    let n = ["PATH", "HOME", "USER", "SHELL", "LANG", "TERM", "NODE_ENV"],
      s = {};
    for (let a of n) process.env[a] && (s[a] = process.env[a]);
    let o = gv(t.command, t.args || [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...s, ...(t.env || {}) },
      }),
      i = { name: e, proc: o, tools: [], config: t };
    try {
      await gs(o, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "nex-code", version: "0.2.0" },
      });
      let a = await gs(o, "tools/list", {});
      return ((i.tools = (a && a.tools) || []), Je.set(e, i), i);
    } catch (a) {
      throw (
        o.kill(),
        new Error(`Failed to connect MCP server '${e}': ${a.message}`)
      );
    }
  }
  function qp(e) {
    let t = Je.get(e);
    if (!t) return !1;
    try {
      t.proc.kill();
    } catch {}
    return (Je.delete(e), !0);
  }
  function vv() {
    for (let [e] of Je) qp(e);
  }
  async function Mp(e, t, n = {}) {
    let s = Je.get(e);
    if (!s) throw new Error(`MCP server not connected: ${e}`);
    let o = await gs(s.proc, "tools/call", { name: t, arguments: n });
    return o && Array.isArray(o.content)
      ? o.content.filter((i) => i.type === "text").map((i) => i.text).join(`
`)
      : JSON.stringify(o);
  }
  function Fp() {
    let e = [];
    for (let [t, n] of Je)
      for (let s of n.tools)
        e.push({
          server: t,
          name: s.name,
          description: s.description || "",
          inputSchema: s.inputSchema || { type: "object", properties: {} },
        });
    return e;
  }
  function yv() {
    return Fp().map((e) => ({
      type: "function",
      function: {
        name: `mcp_${e.server}_${e.name}`,
        description: `[MCP:${e.server}] ${e.description}`,
        parameters: e.inputSchema,
      },
    }));
  }
  async function $v(e, t) {
    if (!e.startsWith("mcp_")) return null;
    let n = e.substring(4).split("_");
    if (n.length < 2) return null;
    let s = n[0],
      o = n.slice(1).join("_");
    return Mp(s, o, t);
  }
  function wv() {
    let e = gi();
    return Object.entries(e).map(([t, n]) => {
      let s = Je.get(t);
      return {
        name: t,
        command: n.command,
        connected: !!s,
        toolCount: s ? s.tools.length : 0,
      };
    });
  }
  async function kv() {
    let e = gi(),
      t = [];
    for (let [n, s] of Object.entries(e))
      try {
        let o = await Lp(n, s);
        t.push({ name: n, tools: o.tools.length });
      } catch (o) {
        t.push({ name: n, tools: 0, error: o.message });
      }
    return t;
  }
  Ip.exports = {
    loadMCPConfig: gi,
    sendRequest: gs,
    connectServer: Lp,
    disconnectServer: qp,
    disconnectAll: vv,
    callTool: Mp,
    getAllTools: Fp,
    getMCPToolDefinitions: yv,
    routeMCPCall: $v,
    listServers: wv,
    connectAll: kv,
  };
});
var xi = _((Jk, Up) => {
  var { getSkillToolDefinitions: _v } = hs(),
    { getMCPToolDefinitions: Sv } = xs();
  function bs(e, t) {
    if (!e || t.length === 0) return null;
    let n = null,
      s = 1 / 0;
    for (let o of t) {
      let i = Dp(e.toLowerCase(), o.toLowerCase());
      i < s && ((s = i), (n = o));
    }
    return s <= Math.ceil(e.length / 2) ? n : null;
  }
  function Dp(e, t) {
    let n = e.length,
      s = t.length,
      o = Array.from({ length: n + 1 }, () => Array(s + 1).fill(0));
    for (let i = 0; i <= n; i++) o[i][0] = i;
    for (let i = 0; i <= s; i++) o[0][i] = i;
    for (let i = 1; i <= n; i++)
      for (let a = 1; a <= s; a++)
        o[i][a] =
          e[i - 1] === t[a - 1]
            ? o[i - 1][a - 1]
            : 1 + Math.min(o[i - 1][a], o[i][a - 1], o[i - 1][a - 1]);
    return o[n][s];
  }
  function Ev(e, t) {
    let { TOOL_DEFINITIONS: n } = fn(),
      s = [...n, ..._v(), ...Sv()],
      o = s.find((m) => m.function.name === e);
    if (!o) {
      let m = s.map((f) => f.function.name),
        h = bs(e, m);
      return {
        valid: !1,
        error: `Unknown tool "${e}".${h ? ` Did you mean "${h}"?` : ""}
Available tools: ${m.join(", ")}`,
      };
    }
    let i = o.function.parameters;
    if (!i || !i.properties) return { valid: !0 };
    let a = i.required || [],
      c = Object.keys(i.properties),
      p = Object.keys(t),
      u = [],
      l = { ...t },
      d = !1;
    for (let m of a)
      if (!(m in t) || t[m] === void 0 || t[m] === null) {
        let h = bs(m, p);
        h && !c.includes(h)
          ? ((l[m] = t[h]), delete l[h], (d = !0))
          : u.push(
              `Missing required parameter "${m}" (${i.properties[m]?.description || i.properties[m]?.type || "unknown"})`,
            );
      }
    for (let m of p)
      if (!c.includes(m)) {
        let h = bs(m, c);
        h && !(h in l)
          ? ((l[h] = t[m]), delete l[m], (d = !0))
          : d ||
            u.push(
              `Unknown parameter "${m}".${h ? ` Did you mean "${h}"?` : ""}`,
            );
      }
    for (let m of Object.keys(l)) {
      if (!i.properties[m]) continue;
      let h = i.properties[m].type,
        f = typeof l[m];
      h === "string" && f === "number"
        ? ((l[m] = String(l[m])), (d = !0))
        : h === "number" && f === "string" && !isNaN(l[m])
          ? ((l[m] = Number(l[m])), (d = !0))
          : h === "boolean" &&
            f === "string" &&
            ((l[m] = l[m] === "true"), (d = !0));
    }
    return u.length > 0 && !d
      ? {
          valid: !1,
          error:
            `Tool "${e}" argument errors:
` +
            u.map((m) => `  - ${m}`).join(`
`) +
            `

Expected parameters: ${JSON.stringify(i.properties, null, 2)}`,
        }
      : { valid: !0, corrected: d ? l : null };
  }
  Up.exports = { validateToolArgs: Ev, closestMatch: bs, levenshtein: Dp };
});
var Hp = _((Vk, Wp) => {
  var { levenshtein: vs } = xi(),
    Tv = 200,
    Rv = 0.3,
    Cv = 2;
  function bi(e) {
    return e
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
      .replace(/\t/g, " ".repeat(Cv))
      .split(
        `
`,
      )
      .map((t) => {
        let n = t.replace(/\s+$/, ""),
          s = n.match(/^(\s*)(.*)/);
        if (!s) return n;
        let [, o, i] = s;
        return o + i.replace(/ {2,}/g, " ");
      }).join(`
`);
  }
  function Av(e, t) {
    if (e.includes(t)) return t;
    let n = bi(e),
      s = bi(t);
    if (!n.includes(s)) return null;
    let o = e.split(`
`),
      i = n.split(`
`),
      a = s.split(`
`),
      c = a[0],
      p = a[a.length - 1];
    for (let u = 0; u <= i.length - a.length; u++) {
      let l = !0;
      for (let d = 0; d < a.length; d++)
        if (i[u + d] !== a[d]) {
          l = !1;
          break;
        }
      if (l)
        return o.slice(u, u + a.length).join(`
`);
    }
    if (a.length === 1) {
      for (let u = 0; u < i.length; u++)
        if (i[u].indexOf(s) !== -1) return o[u];
    }
    return null;
  }
  function Ov(e, t) {
    if (!e || !t) return null;
    let n = e.split(`
`),
      o = t.split(`
`).length;
    return n.length === 0 || o === 0 ? null : o === 1 ? jv(n, t) : Nv(n, t, o);
  }
  function Bp(e) {
    return Math.max(1, Math.floor(e / Tv));
  }
  function zp(e, t) {
    return e <= Math.ceil(t * Rv);
  }
  function jv(e, t) {
    let n = t.trim(),
      s = Bp(e.length),
      o = null,
      i = 1 / 0;
    for (let a = 0; a < e.length; a += s) {
      let c = e[a];
      if (!c.trim()) continue;
      let p = vs(c.trim(), n);
      p < i && ((i = p), (o = { text: c, distance: p, line: a + 1 }));
    }
    return (
      o && s > 1 && ((o = Pv(e, n, o, s) || o), (i = o.distance)),
      zp(i, t.length) ? o : null
    );
  }
  function Pv(e, t, n, s) {
    let o = n.line - 1,
      i = Math.max(0, o - s),
      a = Math.min(e.length - 1, o + s),
      c = n.distance,
      p = null;
    for (let u = i; u <= a; u++) {
      let l = e[u];
      if (!l.trim()) continue;
      let d = vs(l.trim(), t);
      d < c && ((c = d), (p = { text: l, distance: d, line: u + 1 }));
    }
    return p;
  }
  function Nv(e, t, n) {
    let s = e.length - n + 1;
    if (s <= 0) return null;
    let o = Bp(s),
      i = null,
      a = 1 / 0;
    for (let c = 0; c < s; c += o) {
      let p = e.slice(c, c + n).join(`
`),
        u = vs(p, t);
      u < a && ((a = u), (i = { text: p, distance: u, line: c + 1 }));
    }
    return (
      i && o > 1 && ((i = Lv(e, t, i, o, n, s) || i), (a = i.distance)),
      zp(a, t.length) ? i : null
    );
  }
  function Lv(e, t, n, s, o, i) {
    let a = n.line - 1,
      c = Math.max(0, a - s),
      p = Math.min(i - 1, a + s),
      u = n.distance,
      l = null;
    for (let d = c; d <= p; d++) {
      let m = e.slice(d, d + o).join(`
`),
        h = vs(m, t);
      h < u && ((u = h), (l = { text: m, distance: h, line: d + 1 }));
    }
    return l;
  }
  Wp.exports = {
    normalizeWhitespace: bi,
    fuzzyFindText: Av,
    findMostSimilar: Ov,
  };
});
var Kp = _((Xk, Gp) => {
  var { C: Yk } = pe(),
    qv = [
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
    Mv = [
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
  function Fv(e, t) {
    let n = t.split(`
`),
      s = [],
      o = e ? `.${e.split(".").pop()}` : "";
    for (let i = 0; i < n.length; i++) {
      let a = n[i],
        c = i + 1;
      for (let p of qv)
        p.regex.test(a) &&
          s.push({
            line: c,
            message: `Potential secret detected: ${p.name}`,
            severity: "error",
          });
      for (let p of Mv)
        (p.ext && !p.ext.includes(o)) ||
          (p.regex.test(a) &&
            s.push({
              line: c,
              message: p.message || `Found ${p.name}`,
              severity: p.severity || "warn",
            }));
    }
    return (
      n.length > 500 &&
        s.push({
          line: 0,
          message: `Large file detected (${n.length} lines). Consider refactoring.`,
          severity: "info",
        }),
      s
    );
  }
  Gp.exports = { runDiagnostics: Fv };
});
var ys = _((Qk, Jp) => {
  var { C: V } = pe(),
    gn = "",
    ye = [],
    hn = 0,
    gt = null;
  function Iv(e) {
    gt = e;
  }
  function Dv(e, t) {
    ((gn = e), (ye = []), (hn = 0));
    for (let s of t) {
      hn++;
      let o = `t${hn}`;
      ye.push({
        id: o,
        description:
          s.description || s.title || s.name || s.task || `Task ${hn}`,
        status: "pending",
        dependsOn: s.depends_on || [],
        result: null,
      });
    }
    let n = ye.map((s) => ({ ...s }));
    return (gt && gt("create", { name: e, tasks: n }), n);
  }
  function Uv(e, t, n) {
    let s = ye.find((o) => o.id === e);
    return s
      ? ((s.status = t),
        n !== void 0 && (s.result = n),
        gt && gt("update", { id: e, status: t, result: n }),
        { ...s })
      : null;
  }
  function Bv() {
    return { name: gn, tasks: ye.map((e) => ({ ...e })) };
  }
  function zv() {
    ((gn = ""), (ye = []), (hn = 0), gt && gt("clear", {}));
  }
  function Wv() {
    return ye.filter((e) =>
      e.status !== "pending"
        ? !1
        : e.dependsOn.length === 0
          ? !0
          : e.dependsOn.every((t) => {
              let n = ye.find((s) => s.id === t);
              return n && n.status === "done";
            }),
    );
  }
  function Hv() {
    if (ye.length === 0) return `${V.dim}No active tasks${V.reset}`;
    let e = [];
    gn &&
      (e.push(`  ${V.bold}${V.cyan}Tasks: ${gn}${V.reset}`),
      e.push(`  ${V.dim}${"\u2500".repeat(40)}${V.reset}`));
    for (let o of ye) {
      let i, a;
      switch (o.status) {
        case "done":
          ((i = "\u2713"), (a = V.green));
          break;
        case "in_progress":
          ((i = "\u2192"), (a = V.cyan));
          break;
        case "failed":
          ((i = "\u2717"), (a = V.red));
          break;
        default:
          ((i = "\xB7"), (a = V.dim));
      }
      let c =
          o.dependsOn.length > 0
            ? ` ${V.dim}(after: ${o.dependsOn.join(", ")})${V.reset}`
            : "",
        p = `[${o.status}]`,
        u =
          o.description.length > 50
            ? o.description.substring(0, 47) + "..."
            : o.description;
      if (
        (e.push(
          `  ${a}${i}${V.reset} ${V.bold}${o.id}${V.reset}  ${u.padEnd(40)} ${a}${p}${V.reset}${c}`,
        ),
        o.result && o.status === "done")
      ) {
        let l =
          o.result.length > 60 ? o.result.substring(0, 57) + "..." : o.result;
        e.push(`       ${V.dim}\u2192 ${l}${V.reset}`);
      }
    }
    let t = ye.filter((o) => o.status === "done").length,
      n = ye.filter((o) => o.status === "failed").length,
      s = ye.length;
    return (
      e.push(`  ${V.dim}${"\u2500".repeat(40)}${V.reset}`),
      e.push(
        `  ${V.dim}${t}/${s} done${n > 0 ? `, ${n} failed` : ""}${V.reset}`,
      ),
      e.join(`
`)
    );
  }
  function Gv() {
    return (
      ye.length > 0 &&
      ye.some((e) => e.status === "pending" || e.status === "in_progress")
    );
  }
  Jp.exports = {
    createTasks: Dv,
    updateTask: Uv,
    getTaskList: Bv,
    clearTasks: zv,
    getReadyTasks: Wv,
    renderTaskList: Hv,
    setOnChange: Iv,
    hasActiveTasks: Gv,
  };
});
var yi = _((Zk, Yp) => {
  var { getActiveModel: Kv, getActiveProviderName: Jv } = Ie(),
    xn = {
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
      ],
      full: null,
    },
    bn = {
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
      "qwen3.5:397b": "full",
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
      "gemini-2.5-pro": "full",
      "gemini-2.5-flash": "full",
      "gemini-2.0-flash": "standard",
      "gemini-2.0-flash-lite": "essential",
    },
    vn = {
      ollama: "standard",
      openai: "full",
      anthropic: "full",
      gemini: "standard",
      local: "essential",
    },
    Be = {};
  function Vp() {
    try {
      let e = require("fs"),
        n = require("path").join(process.cwd(), ".nex", "config.json");
      e.existsSync(n) &&
        (Be = JSON.parse(e.readFileSync(n, "utf-8")).toolTiers || {});
    } catch {
      Be = {};
    }
  }
  Vp();
  function vi() {
    let t = Kv()?.id,
      n = Jv();
    return t && Be[t]
      ? Be[t]
      : n && Be[`${n}:*`]
        ? Be[`${n}:*`]
        : t && bn[t]
          ? bn[t]
          : n && vn[n]
            ? vn[n]
            : "standard";
  }
  function Vv(e, t) {
    return e && Be[e]
      ? Be[e]
      : t && Be[`${t}:*`]
        ? Be[`${t}:*`]
        : e && bn[e]
          ? bn[e]
          : t && vn[t]
            ? vn[t]
            : "standard";
  }
  function Yv(e, t) {
    let n = t || vi();
    if (n === "full" || !xn[n]) return e;
    let s = new Set(xn[n]);
    return e.filter((o) => s.has(o.function.name));
  }
  function Xv() {
    let e = vi(),
      t = xn[e] ? xn[e].length : "all";
    return { tier: e, toolCount: t };
  }
  Yp.exports = {
    filterToolsForModel: Yv,
    getActiveTier: vi,
    getModelTier: Vv,
    getTierInfo: Xv,
    TIERS: xn,
    MODEL_TIERS: bn,
    PROVIDER_DEFAULT_TIER: vn,
    loadConfigOverrides: Vp,
  };
});
var au = _((t_, iu) => {
  var {
      callChat: Qv,
      getActiveProviderName: _i,
      getActiveModelId: Zv,
      getConfiguredProviders: ey,
      getProvider: ty,
      getActiveProvider: ny,
      parseModelSpec: sy,
    } = Ie(),
    { parseToolArgs: oy } = cs(),
    { filterToolsForModel: iy, getModelTier: wi } = yi(),
    { trackUsage: ay } = ln(),
    { MultiProgress: ry, C: e_ } = pe(),
    cy = 15,
    Xp = 5,
    Qp = 3,
    $s = new Map();
  function ly(e, t) {
    let n = $s.get(e);
    return n && n !== t ? !1 : ($s.set(e, t), !0);
  }
  function $i(e) {
    $s.delete(e);
  }
  function ki() {
    $s.clear();
  }
  function Zp(e) {
    let t = e.message || "",
      n = e.code || "";
    return !!(
      t.includes("429") ||
      t.includes("500") ||
      t.includes("502") ||
      t.includes("503") ||
      t.includes("504") ||
      n === "ECONNRESET" ||
      n === "ECONNABORTED" ||
      n === "ETIMEDOUT" ||
      n === "ECONNREFUSED" ||
      t.includes("socket disconnected") ||
      t.includes("TLS") ||
      t.includes("ECONNRESET") ||
      t.includes("fetch failed") ||
      t.includes("ETIMEDOUT") ||
      t.includes("ENOTFOUND")
    );
  }
  async function eu(e, t, n) {
    let s;
    for (let o = 0; o <= Qp; o++)
      try {
        return await Qv(e, t, n);
      } catch (i) {
        if (((s = i), o < Qp && Zp(i))) {
          let a = Math.min(2e3 * Math.pow(2, o), 15e3);
          await new Promise((c) => setTimeout(c, a).unref());
          continue;
        }
        throw i;
      }
    throw s;
  }
  var py = new Set(["ask_user", "task_list", "spawn_agents"]),
    uy = new Set(["write_file", "edit_file", "patch_file"]),
    dy = /\b(read|summarize|search|find|list|check|count|inspect|scan)\b/i,
    my =
      /\b(refactor|rewrite|implement|create|architect|design|generate|migrate)\b/i;
  function tu(e) {
    return my.test(e) ? "full" : dy.test(e) ? "essential" : "standard";
  }
  function nu(e) {
    let t = ey(),
      n = _i(),
      s = [...t].sort(
        (o, i) => (o.name === n ? -1 : 1) - (i.name === n ? -1 : 1),
      );
    for (let o of s)
      for (let i of o.models)
        if (wi(i.id, o.name) === e) return { provider: o.name, model: i.id };
    return null;
  }
  function su(e) {
    if (e.model) {
      let { provider: s, model: o } = sy(e.model),
        i = s ? ty(s) : ny(),
        a = s || _i();
      if (i && i.isConfigured() && (i.getModel(o) || a === "local")) {
        let c = wi(o, a);
        return { provider: a, model: o, tier: c };
      }
    }
    let t = tu(e.task),
      n = nu(t);
    if (n) {
      let s = wi(n.model, n.provider);
      return { provider: n.provider, model: n.model, tier: s };
    }
    return { provider: null, model: null, tier: null };
  }
  async function ou(e, t = {}) {
    let n = Math.min(e.max_iterations || 10, cy),
      s = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      o = [],
      i = { input: 0, output: 0 },
      a = new Set(),
      p = [
        {
          role: "system",
          content: `You are a focused sub-agent. Complete this specific task efficiently.

TASK: ${e.task}
${
  e.context
    ? `
CONTEXT: ${e.context}`
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
    p.push({ role: "user", content: e.task });
    let u = su(e),
      l = u.provider,
      d = u.model,
      m = u.tier,
      { TOOL_DEFINITIONS: h, executeTool: f } = fn(),
      x = iy(
        h.filter((v) => !py.has(v.function.name)),
        m,
      ),
      b = {};
    (l && (b.provider = l), d && (b.model = d));
    try {
      for (let v = 0; v < n; v++) {
        let $ = await eu(p, x, b);
        if (!$ || typeof $ != "object")
          throw new Error("Empty or invalid response from provider");
        if ($.usage) {
          let S = $.usage.prompt_tokens || 0,
            E = $.usage.completion_tokens || 0;
          ((i.input += S), (i.output += E));
          let C = l || _i(),
            M = d || Zv();
          ay(C, M, S, E);
        }
        let T = $.content || "",
          w = $.tool_calls,
          R = { role: "assistant", content: T || "" };
        if (
          (w && w.length > 0 && (R.tool_calls = w),
          p.push(R),
          !w || w.length === 0)
        ) {
          for (let S of a) $i(S);
          return {
            task: e.task,
            status: "done",
            result: T || "(no response)",
            toolsUsed: o,
            tokensUsed: i,
            modelSpec: l && d ? `${l}:${d}` : null,
          };
        }
        for (let S of w) {
          let E = S.function.name,
            C = oy(S.function.arguments),
            M =
              S.id ||
              `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          if (!C) {
            p.push({
              role: "tool",
              content: `ERROR: Malformed tool arguments for ${E}`,
              tool_call_id: M,
            });
            continue;
          }
          if (uy.has(E) && C.path) {
            let F = require("path"),
              B = F.isAbsolute(C.path)
                ? C.path
                : F.resolve(process.cwd(), C.path);
            if (!ly(B, s)) {
              p.push({
                role: "tool",
                content: `ERROR: File '${C.path}' is locked by another sub-agent. Try a different approach or skip this file.`,
                tool_call_id: M,
              });
              continue;
            }
            a.add(B);
          }
          o.push(E);
          try {
            let F = await f(E, C, { autoConfirm: !0, silent: !0 }),
              B = String(F ?? ""),
              W =
                B.length > 2e4
                  ? B.substring(0, 2e4) +
                    `
...(truncated)`
                  : B;
            p.push({ role: "tool", content: W, tool_call_id: M });
          } catch (F) {
            p.push({
              role: "tool",
              content: `ERROR: ${F.message}`,
              tool_call_id: M,
            });
          }
        }
        t.onUpdate && t.onUpdate(`step ${v + 1}/${n}`);
      }
      for (let v of a) $i(v);
      return {
        task: e.task,
        status: "done",
        result: p[p.length - 1]?.content || "(max iterations reached)",
        toolsUsed: o,
        tokensUsed: i,
        modelSpec: l && d ? `${l}:${d}` : null,
      };
    } catch (v) {
      for (let $ of a) $i($);
      return {
        task: e.task,
        status: "failed",
        result: `Error: ${v.message}`,
        toolsUsed: o,
        tokensUsed: i,
        modelSpec: l && d ? `${l}:${d}` : null,
      };
    }
  }
  async function fy(e) {
    let t = e.agents || [];
    if (t.length === 0) return "ERROR: No agents specified";
    if (t.length > Xp)
      return `ERROR: Max ${Xp} parallel agents allowed, got ${t.length}`;
    let n = t.map(
        (o, i) =>
          `Agent ${i + 1}: ${o.task.substring(0, 50)}${o.task.length > 50 ? "..." : ""}`,
      ),
      s = new ry(n);
    s.start();
    try {
      let o = t.map((u, l) =>
          ou(u, { onUpdate: () => {} })
            .then(
              (d) => (s.update(l, d.status === "done" ? "done" : "error"), d),
            )
            .catch(
              (d) => (
                s.update(l, "error"),
                {
                  task: u.task,
                  status: "failed",
                  result: `Error: ${d.message}`,
                  toolsUsed: [],
                  tokensUsed: { input: 0, output: 0 },
                }
              ),
            ),
        ),
        i = await Promise.all(o);
      (s.stop(), ki());
      let a = ["Sub-agent results:", ""],
        c = 0,
        p = 0;
      for (let u = 0; u < i.length; u++) {
        let l = i[u],
          d = l.status === "done" ? "\u2713" : "\u2717",
          m = l.modelSpec ? ` [${l.modelSpec}]` : "";
        (a.push(`${d} Agent ${u + 1}${m}: ${l.task}`),
          a.push(`  Status: ${l.status}`),
          a.push(
            `  Tools used: ${l.toolsUsed.length > 0 ? l.toolsUsed.join(", ") : "none"}`,
          ),
          a.push(`  Result: ${l.result}`),
          a.push(""),
          (c += l.tokensUsed.input),
          (p += l.tokensUsed.output));
      }
      return (
        a.push(`Total sub-agent tokens: ${c} input + ${p} output`),
        a.join(`
`)
      );
    } catch (o) {
      return (
        s.stop(),
        ki(),
        `ERROR: Sub-agent execution failed: ${o.message}`
      );
    }
  }
  iu.exports = {
    runSubAgent: ou,
    executeSpawnAgents: fy,
    clearAllLocks: ki,
    classifyTask: tu,
    pickModelForTier: nu,
    resolveSubAgentModel: su,
    isRetryableError: Zp,
    callChatWithRetry: eu,
  };
});
var fn = _((s_, hu) => {
  var K = require("fs").promises,
    hy = require("fs"),
    $e = require("path"),
    wn = require("util").promisify(require("child_process").exec),
    ru = require("util").promisify(require("child_process").execFile),
    cu = ft(),
    { isForbidden: gy, isDangerous: xy, confirm: by } = un(),
    {
      showClaudeDiff: ws,
      showClaudeNewFile: vy,
      showEditDiff: n_,
      confirmFileChange: yn,
    } = bp(),
    { C: xe, Spinner: du, getToolSpinnerText: yy } = pe(),
    { isGitRepo: Si, getCurrentBranch: $y, getStatus: wy, getDiff: ky } = fs(),
    { recordChange: ks } = mi(),
    { fuzzyFindText: lu, findMostSimilar: Ti } = Hp(),
    { runDiagnostics: $n } = Kp(),
    he = process.cwd();
  async function _s(e) {
    if (!e) return { fixedPath: null, message: "" };
    let t = e
        .replace(/\/+/g, "/")
        .replace(/^~\//, `${require("os").homedir()}/`),
      n = Oe(t);
    if (
      n &&
      (await K.access(n)
        .then(() => !0)
        .catch(() => !1))
    )
      return { fixedPath: n, message: `(auto-fixed path: ${e} \u2192 ${t})` };
    let s = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".json"],
      o = $e.extname(e);
    if (!o)
      for (let a of s) {
        let c = Oe(e + a);
        if (
          c &&
          (await K.access(c)
            .then(() => !0)
            .catch(() => !1))
        )
          return {
            fixedPath: c,
            message: `(auto-fixed: added ${a} extension)`,
          };
      }
    if (o) {
      let a = e.replace(/\.[^.]+$/, "");
      for (let c of s) {
        if (c === o) continue;
        let p = Oe(a + c);
        if (
          p &&
          (await K.access(p)
            .then(() => !0)
            .catch(() => !1))
        )
          return { fixedPath: p, message: `(auto-fixed: ${o} \u2192 ${c})` };
      }
    }
    let i = $e.basename(e);
    if (i && i.length > 2)
      try {
        let a = async (p, u, l = 0) => {
            if (l > 5) return [];
            let d = [],
              m;
            try {
              m = await K.readdir(p, { withFileTypes: !0 });
            } catch {
              return [];
            }
            let h = m.map(async (x) => {
              if (
                x.name === "node_modules" ||
                x.name === ".git" ||
                x.name.startsWith(".")
              )
                return [];
              let b = $e.join(p, x.name);
              return x.isDirectory()
                ? await a(b, u, l + 1)
                : x.name === u
                  ? [b]
                  : [];
            });
            return (await Promise.all(h)).flat();
          },
          c = await a(he, i);
        if (c.length === 1)
          return {
            fixedPath: c[0],
            message: `(auto-fixed: found ${i} at ${$e.relative(he, c[0])})`,
          };
        if (c.length > 1 && c.length <= 5)
          return {
            fixedPath: null,
            message: `File not found. Did you mean one of:
${c.map((u) => $e.relative(he, u)).map((u) => `  - ${u}`).join(`
`)}`,
          };
      } catch {}
    return { fixedPath: null, message: "" };
  }
  function mu(e, t) {
    let n = [];
    if (/command not found|not recognized/i.test(e)) {
      let s = t.match(/^(\S+)/),
        o = s ? s[1] : "";
      /^(npx|npm|node|yarn|pnpm|bun)$/.test(o)
        ? n.push(
            "HINT: Node.js/npm may not be in PATH. Check your Node.js installation.",
          )
        : /^(python|python3|pip|pip3)$/.test(o)
          ? n.push(
              "HINT: Python may not be installed. Try: brew install python3 (macOS) or apt install python3 (Linux)",
            )
          : n.push(
              `HINT: "${o}" is not installed. Try installing it with your package manager.`,
            );
    }
    if (/Cannot find module|MODULE_NOT_FOUND/i.test(e)) {
      let s = e.match(/Cannot find module '([^']+)'/),
        o = s ? s[1] : "";
      o && !o.startsWith(".") && !o.startsWith("/")
        ? n.push(`HINT: Missing npm package "${o}". Run: npm install ${o}`)
        : n.push(
            "HINT: Module not found. Check the import path or run npm install.",
          );
    }
    if (
      (/permission denied|EACCES/i.test(e) &&
        n.push(
          "HINT: Permission denied. Check file permissions or try a different approach.",
        ),
      /EADDRINUSE|address already in use/i.test(e))
    ) {
      let s = e.match(/port (\d+)|:(\d+)/),
        o = s ? s[1] || s[2] : "";
      n.push(
        `HINT: Port ${o || ""} is already in use. Kill the process or use a different port.`,
      );
    }
    return (
      /SyntaxError|Unexpected token/i.test(e) &&
        n.push(
          "HINT: Syntax error in the code. Check the file at the line number shown above.",
        ),
      /TS\d{4}:/i.test(e) &&
        n.push(
          "HINT: TypeScript compilation error. Fix the type issue at the indicated line.",
        ),
      /Test Suites:.*failed|Tests:.*failed/i.test(e) &&
        n.push(
          "HINT: Test failures detected. Read the error output above to identify failing tests.",
        ),
      /fatal: not a git repository/i.test(e) &&
        n.push(
          "HINT: Not inside a git repository. Run git init or cd to a git project.",
        ),
      n.length === 0
        ? e
        : e +
          `

` +
          n.join(`
`)
    );
  }
  function fu(e, t, n) {
    let s = Ti(e, t);
    if (!s) return null;
    let o = Math.max(3, Math.ceil(t.length * 0.05));
    return s.distance > o
      ? null
      : {
          autoFixed: !0,
          matchText: s.text,
          content: e.split(s.text).join(n),
          distance: s.distance,
          line: s.line,
        };
  }
  var pu = !1;
  async function Ei() {
    if (!pu) {
      pu = !0;
      try {
        let { stdout: e } = await wn("git rev-parse --is-inside-work-tree", {
          cwd: he,
          timeout: 5e3,
        });
        if (!(e.trim() === "true")) return;
        (await wn(
          'git stash push -m "nex-code-checkpoint" --include-untracked',
          { cwd: he, timeout: 1e4 },
        ),
          await wn("git stash pop", { cwd: he, timeout: 1e4 }),
          await wn("git tag -f nex-checkpoint", { cwd: he, timeout: 5e3 }));
      } catch {}
    }
  }
  var _y = [
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
  function Oe(e) {
    let t = $e.isAbsolute(e) ? $e.resolve(e) : $e.resolve(he, e);
    for (let n of _y) if (n.test(t)) return null;
    return t;
  }
  var Sy = [
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
          "Read a file's contents with line numbers. Always read a file BEFORE editing it to see exact content. Use line_start/line_end for large files to read specific sections. Prefer this over bash cat/head/tail.",
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
          "Search file contents with regex. Returns matching lines with file paths and line numbers. Use this to find where functions/variables/classes are defined or used. Prefer this over bash grep/rg.",
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
              description: "File filter (e.g. '*.js', '*.ts')",
            },
            ignore_case: {
              type: "boolean",
              description: "Case-insensitive search",
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
          "Search the web using DuckDuckGo. Returns titles and URLs. Use to find documentation, solutions, or current information beyond your knowledge cutoff.",
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
        name: "ask_user",
        description:
          "Ask the user a question and wait for their response. Use when requirements are ambiguous, you need to choose between approaches, or a decision has significant impact. Do not ask unnecessary questions \u2014 proceed if the intent is clear.",
        parameters: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "The question to ask the user",
            },
          },
          required: ["question"],
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
        name: "spawn_agents",
        description:
          "Run multiple independent sub-agents in parallel (max 5). Each agent has its own conversation context. Use when 2+ tasks can run simultaneously \u2014 e.g. reading multiple files, analyzing separate modules, independent research. Do NOT use for tasks that depend on each other or modify the same file. Keep task descriptions specific and self-contained.",
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
  ];
  async function uu(e, t, n = {}) {
    switch (e) {
      case "bash": {
        let s = t.command,
          o = gy(s);
        if (o) return `BLOCKED: Command matches forbidden pattern: ${o}`;
        if (
          xy(s) &&
          !n.autoConfirm &&
          (console.log(`
${xe.yellow}  \u26A0 Dangerous command: ${s}${xe.reset}`),
          !(await by("  Execute?")))
        )
          return "CANCELLED: User declined to execute this command.";
        let i = n.silent
          ? null
          : new du(
              `Running: ${s.substring(0, 60)}${s.length > 60 ? "..." : ""}`,
            );
        i && i.start();
        try {
          let { stdout: a, stderr: c } = await wn(s, {
            cwd: he,
            timeout: 9e4,
            maxBuffer: 5242880,
          });
          return (i && i.stop(), a || c || "(no output)");
        } catch (a) {
          i && i.stop();
          let c = (a.stderr || a.stdout || a.message || "")
              .toString()
              .substring(0, 5e3),
            p = mu(c, s);
          return `EXIT ${a.code || 1}
${p}`;
        }
      }
      case "read_file": {
        let s = Oe(t.path);
        if (!s)
          return `ERROR: Access denied \u2014 path outside project: ${t.path}`;
        if (
          !(await K.access(s)
            .then(() => !0)
            .catch(() => !1))
        ) {
          let m = await _s(t.path);
          if (m.fixedPath)
            ((s = m.fixedPath),
              console.log(
                `${xe.dim}  \u2713 auto-fixed path: ${t.path} \u2192 ${$e.relative(he, s)}${xe.reset}`,
              ));
          else
            return `ERROR: File not found: ${t.path}${
              m.message
                ? `
` + m.message
                : ""
            }`;
        }
        let i = Buffer.alloc(8192),
          a = await hy.promises.open(s, "r"),
          { bytesRead: c } = await a.read(i, 0, 8192, 0);
        await a.close();
        for (let m = 0; m < c; m++)
          if (i[m] === 0)
            return `ERROR: ${s} is a binary file (not readable as text)`;
        let p = await K.readFile(s, "utf-8");
        if (!p && (await K.stat(s)).size > 0)
          return `WARNING: ${s} is empty or unreadable`;
        let u = p.split(`
`),
          l = (t.line_start || 1) - 1,
          d = t.line_end || u.length;
        return u.slice(l, d).map((m, h) => `${l + h + 1}: ${m}`).join(`
`);
      }
      case "write_file": {
        await Ei();
        let s = Oe(t.path);
        if (!s)
          return `ERROR: Access denied \u2014 path outside project: ${t.path}`;
        let o = await K.access(s)
            .then(() => !0)
            .catch(() => !1),
          i = null;
        if (n.autoConfirm) o && (i = await K.readFile(s, "utf-8"));
        else if (o) {
          i = await K.readFile(s, "utf-8");
          let p = await $n(s, t.content);
          if (
            (ws(s, i, t.content, { annotations: p }), !(await yn("Overwrite")))
          )
            return "CANCELLED: User declined to overwrite file.";
        } else {
          let p = await $n(s, t.content);
          if ((vy(s, t.content, { annotations: p }), !(await yn("Create"))))
            return "CANCELLED: User declined to create file.";
        }
        let a = $e.dirname(s);
        return (
          (await K.access(a)
            .then(() => !0)
            .catch(() => !1)) || (await K.mkdir(a, { recursive: !0 })),
          await K.writeFile(s, t.content, "utf-8"),
          ks("write_file", s, i, t.content),
          `Written: ${s} (${t.content.length} chars)`
        );
      }
      case "edit_file": {
        await Ei();
        let s = Oe(t.path);
        if (!s)
          return `ERROR: Access denied \u2014 path outside project: ${t.path}`;
        if (
          !(await K.access(s)
            .then(() => !0)
            .catch(() => !1))
        ) {
          let l = await _s(t.path);
          if (l.fixedPath)
            ((s = l.fixedPath),
              console.log(
                `${xe.dim}  \u2713 auto-fixed path: ${t.path} \u2192 ${$e.relative(he, s)}${xe.reset}`,
              ));
          else
            return `ERROR: File not found: ${t.path}${
              l.message
                ? `
` + l.message
                : ""
            }`;
        }
        let i = await K.readFile(s, "utf-8"),
          a = t.old_text,
          c = !1,
          p = !1;
        if (!i.includes(t.old_text)) {
          let l = lu(i, t.old_text);
          if (l)
            ((a = l),
              (c = !0),
              console.log(
                `${xe.dim}  \u2713 fuzzy whitespace match applied${xe.reset}`,
              ));
          else {
            let d = fu(i, t.old_text, t.new_text);
            if (d) {
              if (!n.autoConfirm) {
                let f = await $n(s, d.content);
                if (
                  (ws(s, i, d.content, { annotations: f }),
                  !(await yn(
                    `Apply (auto-fix, line ${d.line}, distance ${d.distance})`,
                  )))
                )
                  return "CANCELLED: User declined to apply edit.";
              }
              (await K.writeFile(s, d.content, "utf-8"),
                ks("edit_file", s, i, d.content));
              let h =
                d.matchText.length > 80
                  ? d.matchText.substring(0, 77) + "..."
                  : d.matchText;
              return (
                console.log(
                  `${xe.dim}  \u2713 auto-fixed edit: line ${d.line}, distance ${d.distance}${xe.reset}`,
                ),
                `Edited: ${s} (auto-fixed, line ${d.line}, distance ${d.distance}, matched: "${h}")`
              );
            }
            let m = Ti(i, t.old_text);
            return m
              ? `ERROR: old_text not found in ${s}
Most similar text (line ${m.line}, distance ${m.distance}):
${m.text}`
              : `ERROR: old_text not found in ${s}`;
          }
        }
        if (!n.autoConfirm) {
          let l = i.split(a).join(t.new_text),
            d = await $n(s, l);
          if (
            (ws(s, i, l, { annotations: d }),
            !(await yn(c ? "Apply (fuzzy match)" : "Apply")))
          )
            return "CANCELLED: User declined to apply edit.";
        }
        let u = i.split(a).join(t.new_text);
        return (
          await K.writeFile(s, u, "utf-8"),
          ks("edit_file", s, i, u),
          c ? `Edited: ${s} (fuzzy match)` : `Edited: ${s}`
        );
      }
      case "list_directory": {
        let s = Oe(t.path);
        if (!s)
          return `ERROR: Access denied \u2014 path outside project: ${t.path}`;
        if (
          !(await K.access(s)
            .then(() => !0)
            .catch(() => !1))
        ) {
          let u = t.path
              .replace(/\/+/g, "/")
              .replace(/^~\//, `${require("os").homedir()}/`),
            l = Oe(u),
            d = await K.access(l)
              .then(() => !0)
              .catch(() => !1);
          if (l && d) s = l;
          else return `ERROR: Directory not found: ${t.path}`;
        }
        let i = t.max_depth || 2,
          a = null;
        if (t.pattern)
          try {
            let u = t.pattern
              .replace(/[.+^${}()|[\]\\]/g, "\\$&")
              .replace(/\*/g, ".*");
            a = new RegExp(`^${u}$`);
          } catch {
            return `ERROR: Invalid pattern: ${t.pattern}`;
          }
        let c = [],
          p = async (u, l, d) => {
            if (l > i) return;
            let m;
            try {
              m = await K.readdir(u, { withFileTypes: !0 });
            } catch {
              return;
            }
            m = m.filter(
              (h) => !h.name.startsWith(".") && h.name !== "node_modules",
            );
            for (let h of m) {
              if (a && !h.isDirectory() && !a.test(h.name)) continue;
              let f = h.isDirectory() ? "/" : "";
              (c.push(`${d}${h.name}${f}`),
                h.isDirectory() &&
                  (await p($e.join(u, h.name), l + 1, d + "  ")));
            }
          };
        return (
          await p(s, 1, ""),
          c.join(`
`) || "(empty)"
        );
      }
      case "search_files": {
        let s = Oe(t.path);
        if (!s)
          return `ERROR: Access denied \u2014 path outside project: ${t.path}`;
        let o = ["-rn"];
        (t.file_pattern && o.push(`--include=${t.file_pattern}`),
          o.push(t.pattern, s));
        try {
          let { stdout: i } = await ru("grep", o, {
            cwd: he,
            timeout: 3e4,
            maxBuffer: 2097152,
          });
          return (
            i
              .split(
                `
`,
              )
              .slice(0, 50).join(`
`) || "(no matches)"
          );
        } catch {
          return "(no matches)";
        }
      }
      case "glob": {
        let o = t.path ? Oe(t.path) : he,
          i = t.pattern,
          a = (f) => {
            let x = f
              .replace(/[.+^${}()|[\]\\]/g, "\\$&")
              .replace(/\*\*/g, "__DOUBLESTAR__")
              .replace(/\*/g, "[^/]*")
              .replace(/__DOUBLESTAR__/g, ".*")
              .replace(/\?/g, ".");
            return new RegExp(`^${x}$`);
          },
          c = i.replace(/\*\*\//g, "").replace(/\//g, ""),
          p = a(c),
          u = a(i),
          l = [],
          d = !1,
          m = async (f, x) => {
            if (l.length >= 200) {
              d = !0;
              return;
            }
            let b;
            try {
              b = await K.readdir(f, { withFileTypes: !0 });
            } catch {
              return;
            }
            for (let v of b) {
              if (v.name === "node_modules" || v.name === ".git") continue;
              let $ = x ? `${x}/${v.name}` : v.name;
              if (
                (v.isDirectory()
                  ? await m($e.join(f, v.name), $)
                  : (u.test($) || p.test(v.name)) && l.push($e.join(o, $)),
                l.length >= 200)
              ) {
                d = !0;
                return;
              }
            }
          };
        if ((await m(o, ""), l.length === 0)) return "(no matches)";
        let h = l.join(`
`);
        return d
          ? `${h}

\u26A0 Results truncated at 200. Use a more specific pattern to narrow results.`
          : h;
      }
      case "grep": {
        let s = t.path ? Oe(t.path) : he,
          o = ["-rn", "-E"];
        (t.ignore_case && o.push("-i"),
          t.include && o.push(`--include=${t.include}`),
          o.push(
            "--exclude-dir=node_modules",
            "--exclude-dir=.git",
            "--exclude-dir=coverage",
          ),
          o.push(t.pattern, s));
        try {
          let { stdout: i } = await ru("grep", o, {
            cwd: he,
            timeout: 3e4,
            maxBuffer: 2097152,
          });
          return (
            i
              .split(
                `
`,
              )
              .slice(0, 100)
              .join(
                `
`,
              )
              .trim() || "(no matches)"
          );
        } catch (i) {
          return i.code === 2
            ? `ERROR: Invalid regex pattern: ${t.pattern}`
            : "(no matches)";
        }
      }
      case "patch_file": {
        await Ei();
        let s = Oe(t.path);
        if (!s)
          return `ERROR: Access denied \u2014 path outside project: ${t.path}`;
        if (
          !(await K.access(s)
            .then(() => !0)
            .catch(() => !1))
        ) {
          let m = await _s(t.path);
          if (m.fixedPath)
            ((s = m.fixedPath),
              console.log(
                `${xe.dim}  \u2713 auto-fixed path: ${t.path} \u2192 ${$e.relative(he, s)}${xe.reset}`,
              ));
          else
            return `ERROR: File not found: ${t.path}${
              m.message
                ? `
` + m.message
                : ""
            }`;
        }
        let i = t.patches;
        if (!Array.isArray(i) || i.length === 0)
          return "ERROR: No patches provided";
        let a = await K.readFile(s, "utf-8"),
          c = [],
          p = !1,
          u = !1;
        for (let m = 0; m < i.length; m++) {
          let { old_text: h, new_text: f } = i[m];
          if (a.includes(h)) c.push({ old_text: h, new_text: f });
          else {
            let x = lu(a, h);
            if (x) (c.push({ old_text: x, new_text: f }), (p = !0));
            else {
              let b = Ti(a, h);
              if (b) {
                let v = Math.max(3, Math.ceil(h.length * 0.05));
                if (b.distance <= v)
                  (c.push({ old_text: b.text, new_text: f }), (u = !0));
                else
                  return `ERROR: Patch ${m + 1} old_text not found in ${s}
Most similar text (line ${b.line}, distance ${b.distance}):
${b.text}`;
              } else return `ERROR: Patch ${m + 1} old_text not found in ${s}`;
            }
          }
        }
        let l = a;
        for (let { old_text: m, new_text: h } of c) l = l.split(m).join(h);
        if (!n.autoConfirm) {
          let m = await $n(s, l);
          if (
            (ws(s, a, l, { annotations: m }),
            !(await yn(p ? "Apply patches (fuzzy match)" : "Apply patches")))
          )
            return "CANCELLED: User declined to apply patches.";
        }
        (await K.writeFile(s, l, "utf-8"), ks("patch_file", s, a, l));
        let d = u ? " (auto-fixed)" : p ? " (fuzzy match)" : "";
        return `Patched: ${s} (${i.length} replacements)${d}`;
      }
      case "web_fetch": {
        let s = t.url,
          o = t.max_length || 1e4;
        try {
          let i = await cu.get(s, {
            timeout: 15e3,
            maxContentLength: 1048576,
            responseType: "text",
            headers: { "User-Agent": "nex-code/0.2.0" },
          });
          return (
            (typeof i.data == "string" ? i.data : JSON.stringify(i.data))
              .replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .substring(0, o) || "(empty response)"
          );
        } catch (i) {
          return `ERROR: Failed to fetch ${s}: ${i.message}`;
        }
      }
      case "web_search": {
        let s = t.max_results || 5;
        try {
          let i = (
              await cu.get("https://html.duckduckgo.com/html/", {
                params: { q: t.query },
                timeout: 1e4,
                responseType: "text",
                headers: { "User-Agent": "nex-code/0.2.0" },
              })
            ).data,
            a = [],
            c =
              /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
            p;
          for (; (p = c.exec(i)) !== null && a.length < s; ) {
            let u = p[1].replace(/.*uddg=/, "").split("&")[0],
              l = p[2].replace(/<[^>]+>/g, "").trim();
            try {
              a.push({ title: l, url: decodeURIComponent(u) });
            } catch {
              a.push({ title: l, url: u });
            }
          }
          return a.length === 0
            ? "(no results)"
            : a.map(
                (u, l) => `${l + 1}. ${u.title}
   ${u.url}`,
              ).join(`

`);
        } catch {
          return "ERROR: Web search failed";
        }
      }
      case "ask_user": {
        let s = t.question;
        return new Promise((o) => {
          let i = require("readline").createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          (console.log(`
${xe.cyan}${xe.bold}  ? ${s}${xe.reset}`),
            i.question(`${xe.cyan}  > ${xe.reset}`, (a) => {
              (i.close(), o(a.trim() || "(no response)"));
            }));
        });
      }
      case "git_status": {
        if (!Si()) return "ERROR: Not a git repository";
        let s = $y() || "(detached)",
          o = wy();
        if (o.length === 0)
          return `Branch: ${s}
Clean working tree (no changes)`;
        let i = [`Branch: ${s}`, `Changed files (${o.length}):`];
        for (let a of o) {
          let c =
            a.status === "M"
              ? "modified"
              : a.status === "A"
                ? "added"
                : a.status === "D"
                  ? "deleted"
                  : a.status === "??"
                    ? "untracked"
                    : a.status;
          i.push(`  ${c}: ${a.file}`);
        }
        return i.join(`
`);
      }
      case "git_diff": {
        if (!Si()) return "ERROR: Not a git repository";
        let s;
        if (t.file) {
          let o = ["diff"];
          (t.staged && o.push("--cached"), o.push("--", t.file));
          try {
            s = execFileSync("git", o, {
              cwd: he,
              encoding: "utf-8",
              timeout: 15e3,
              stdio: "pipe",
            }).trim();
          } catch {
            s = "";
          }
        } else s = ky(!!t.staged);
        return s || "(no diff)";
      }
      case "git_log": {
        if (!Si()) return "ERROR: Not a git repository";
        let o = ["log", "--oneline", `-${Math.min(t.count || 10, 50)}`];
        t.file && o.push("--", t.file);
        try {
          return (
            execFileSync("git", o, {
              cwd: he,
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
            createTasks: s,
            updateTask: o,
            getTaskList: i,
            renderTaskList: a,
            hasActiveTasks: c,
          } = ys(),
          { getActiveTaskProgress: p } = pe(),
          u = p();
        switch (t.action) {
          case "create": {
            if (!t.name || !t.tasks)
              return "ERROR: task_list create requires name and tasks";
            let l = s(t.name, t.tasks);
            return (
              u ||
                console.log(
                  `
` + a(),
                ),
              `Created task list "${t.name}" with ${l.length} tasks:
` +
                l.map((d) => `  ${d.id}: ${d.description}`).join(`
`)
            );
          }
          case "update":
            return !t.task_id || !t.status
              ? "ERROR: task_list update requires task_id and status"
              : o(t.task_id, t.status, t.result)
                ? (u ||
                    console.log(
                      `
` + a(),
                    ),
                  `Updated ${t.task_id}: ${t.status}${t.result ? " \u2014 " + t.result : ""}`)
                : `ERROR: Task not found: ${t.task_id}`;
          case "get": {
            let l = i();
            return l.tasks.length === 0
              ? "No active tasks"
              : (u ||
                  console.log(
                    `
` + a(),
                  ),
                JSON.stringify(l, null, 2));
          }
          default:
            return `ERROR: Unknown task_list action: ${t.action}. Use: create, update, get`;
        }
      }
      case "spawn_agents": {
        let { executeSpawnAgents: s } = au();
        return s(t);
      }
      default:
        return `ERROR: Unknown tool: ${e}`;
    }
  }
  async function Ey(e, t, n = {}) {
    let s = n.silent ? null : yy(e, t);
    if (!s) return uu(e, t, n);
    let o = new du(s);
    o.start();
    try {
      let i = await uu(e, t, n);
      return (o.stop(), i);
    } catch (i) {
      throw (o.stop(), i);
    }
  }
  hu.exports = {
    TOOL_DEFINITIONS: Sy,
    executeTool: Ey,
    resolvePath: Oe,
    autoFixPath: _s,
    autoFixEdit: fu,
    enrichBashError: mu,
  };
});
var Ri = _((o_, xu) => {
  var st = require("fs").promises,
    Ss = require("path"),
    Es = require("util").promisify(require("child_process").exec),
    { C: ze } = pe(),
    { getMergeConflicts: gu } = fs();
  async function ot(e) {
    try {
      return await e();
    } catch {
      return null;
    }
  }
  async function Ty(e) {
    let t = [],
      n = Ss.join(e, "package.json");
    if (
      await ot(() =>
        st
          .access(n)
          .then(() => !0)
          .catch(() => !1),
      )
    )
      try {
        let m = await st.readFile(n, "utf-8"),
          h = JSON.parse(m),
          f = { name: h.name, version: h.version };
        (h.scripts && (f.scripts = Object.keys(h.scripts).slice(0, 15)),
          h.dependencies && (f.deps = Object.keys(h.dependencies).length),
          h.devDependencies &&
            (f.devDeps = Object.keys(h.devDependencies).length),
          t.push(`PACKAGE: ${JSON.stringify(f)}`));
      } catch {}
    let o = Ss.join(e, "README.md");
    if (
      await ot(() =>
        st
          .access(o)
          .then(() => !0)
          .catch(() => !1),
      )
    ) {
      let h = (await st.readFile(o, "utf-8"))
        .split(
          `
`,
        )
        .slice(0, 50);
      t.push(`README (first 50 lines):
${h.join(`
`)}`);
    }
    let a = await ot(async () => {
      let { stdout: m } = await Es("git branch --show-current", {
        cwd: e,
        timeout: 5e3,
      });
      return m.trim();
    });
    a && t.push(`GIT BRANCH: ${a}`);
    let c = await ot(async () => {
      let { stdout: m } = await Es("git status --short", {
        cwd: e,
        timeout: 5e3,
      });
      return m.trim();
    });
    c &&
      t.push(`GIT STATUS:
${c}`);
    let p = await ot(async () => {
      let { stdout: m } = await Es("git log --oneline -5", {
        cwd: e,
        timeout: 5e3,
      });
      return m.trim();
    });
    p &&
      t.push(`RECENT COMMITS:
${p}`);
    let u = await gu();
    if (u.length > 0) {
      let m = u.map((h) => `  ${h.file}`).join(`
`);
      t.push(`MERGE CONFLICTS (resolve before editing these files):
${m}`);
    }
    let l = Ss.join(e, ".gitignore");
    if (
      await ot(() =>
        st
          .access(l)
          .then(() => !0)
          .catch(() => !1),
      )
    ) {
      let m = await st.readFile(l, "utf-8");
      t.push(`GITIGNORE:
${m.trim()}`);
    }
    return t.join(`

`);
  }
  async function Ry(e) {
    let t = Ss.join(e, "package.json"),
      n = "";
    if (
      await ot(() =>
        st
          .access(t)
          .then(() => !0)
          .catch(() => !1),
      )
    )
      try {
        let a = await st.readFile(t, "utf-8"),
          c = JSON.parse(a);
        n = `${c.name || "?"} v${c.version || "?"}`;
      } catch {}
    let o = await ot(async () => {
      let { stdout: a } = await Es("git branch --show-current", {
        cwd: e,
        timeout: 5e3,
      });
      return a.trim();
    });
    (n && console.log(`${ze.dim}  project: ${n}${ze.reset}`),
      o && console.log(`${ze.dim}  branch: ${o}${ze.reset}`));
    let i = await gu();
    if (i.length > 0) {
      console.log(
        `${ze.red}  \u26A0 ${i.length} unresolved merge conflict(s):${ze.reset}`,
      );
      for (let a of i) console.log(`${ze.red}    ${a.file}${ze.reset}`);
      console.log(
        `${ze.yellow}  \u2192 Resolve conflicts before starting tasks${ze.reset}`,
      );
    }
    console.log();
  }
  xu.exports = { gatherProjectContext: Ty, printContext: Ry };
});
var ku = _((i_, wu) => {
  var { callChat: Cy } = Ie(),
    { estimateTokens: Ci } = Ts(),
    bu = process.env.NEX_COMPACTION !== "false",
    vu = 6,
    yu = 500,
    Ay = `Summarize this conversation history concisely. Focus on:
- What files were read, created, or modified
- Key decisions made and their rationale
- Current state of the task (what's done, what's pending)
- Any errors encountered and how they were resolved
Be factual and brief. Use bullet points. Max 300 words.`;
  async function Oy(e) {
    if (!bu || e.length < vu) return null;
    let t = [
      { role: "system", content: Ay },
      { role: "user", content: $u(e) },
    ];
    try {
      let s = (
        (await Cy(t, [], { temperature: 0, maxTokens: yu })).content || ""
      ).trim();
      if (!s) return null;
      let o = e.reduce(
          (a, c) =>
            a +
            Ci(c.content || "") +
            (c.tool_calls ? Ci(JSON.stringify(c.tool_calls)) : 0),
          0,
        ),
        i = Ci(s);
      return i >= o * 0.8
        ? null
        : {
            message: {
              role: "system",
              content: `[Conversation Summary \u2014 ${e.length} messages compacted]
${s}`,
              _compacted: !0,
              _originalCount: e.length,
            },
            tokensRemoved: o - i,
          };
    } catch {
      return null;
    }
  }
  function $u(e) {
    return e.map((t) => {
      let n = t.role === "tool" ? "tool_result" : t.role,
        s = (t.content || "").substring(0, 500);
      if (t.tool_calls) {
        let o = t.tool_calls.map((i) => i.function?.name).join(", ");
        return `[${n}] ${s}
  tools: ${o}`;
      }
      return `[${n}] ${s}`;
    }).join(`

`);
  }
  wu.exports = {
    compactMessages: Oy,
    formatMessagesForSummary: $u,
    COMPACTION_ENABLED: bu,
    COMPACTION_MIN_MESSAGES: vu,
    COMPACTION_SUMMARY_BUDGET: yu,
  };
});
var Ts = _((a_, Cu) => {
  var { getActiveModel: _u } = Ie(),
    jy = { anthropic: 3.5, openai: 4, gemini: 4, ollama: 4, local: 4 };
  function Py() {
    try {
      let t = _u()?.provider || "ollama";
      return jy[t] || 4;
    } catch {
      return 4;
    }
  }
  function bt(e) {
    return e
      ? (typeof e != "string" && (e = JSON.stringify(e)),
        Math.ceil(e.length / Py()))
      : 0;
  }
  function _n(e) {
    let n = 4;
    if ((e.content && (n += bt(e.content)), e.tool_calls))
      for (let s of e.tool_calls) {
        ((n += 4), (n += bt(s.function?.name || "")));
        let o = s.function?.arguments;
        typeof o == "string" ? (n += bt(o)) : o && (n += bt(JSON.stringify(o)));
      }
    return n;
  }
  function De(e) {
    let t = 0;
    for (let n of e) t += _n(n);
    return t;
  }
  function Rs(e) {
    return !e || e.length === 0 ? 0 : bt(JSON.stringify(e));
  }
  function Cs() {
    return _u()?.contextWindow || 32768;
  }
  function Ny(e, t) {
    let n = De(e),
      s = Rs(t),
      o = n + s,
      i = Cs(),
      a = i > 0 ? (o / i) * 100 : 0,
      c = 0,
      p = 0,
      u = 0;
    for (let l of e) {
      let d = _n(l);
      l.role === "system" ? (c += d) : l.role === "tool" ? (u += d) : (p += d);
    }
    return {
      used: o,
      limit: i,
      percentage: Math.round(a * 10) / 10,
      breakdown: {
        system: c,
        conversation: p,
        toolResults: u,
        toolDefinitions: s,
      },
      messageCount: e.length,
    };
  }
  var Su = 0.75,
    Eu = 0.1,
    Tu = 10,
    Ly = 200,
    qy = 500;
  function Ru(e, t) {
    if (!e || e.length <= t) return e;
    let s = /^(ERROR|EXIT|BLOCKED|CANCELLED)/i.test(e) ? t * 3 : t;
    if (e.length <= s) return e;
    let o = e.split(`
`);
    if (o.length <= 10) {
      let f = Math.floor(s * 0.6),
        x = Math.floor(s * 0.4),
        b = e.substring(0, f),
        v = e.substring(e.length - x);
      return (
        b +
        `
...(${e.length} chars total)...
` +
        v
      );
    }
    let i = Math.floor(o.length * 0.4),
      a = Math.floor(o.length * 0.4),
      c = [],
      p = 0,
      u = Math.floor(s * 0.4);
    for (let f = 0; f < i && p < u; f++) (c.push(o[f]), (p += o[f].length + 1));
    let l = [],
      d = 0,
      m = Math.floor(s * 0.4);
    for (let f = o.length - 1; f >= o.length - a && d < m; f--)
      (l.unshift(o[f]), (d += o[f].length + 1));
    let h = o.length - c.length - l.length;
    return (
      c.join(`
`) +
      `
...(${h} lines omitted, ${o.length} total)...
` +
      l.join(`
`)
    );
  }
  function kn(e, t = "light") {
    let n = t === "aggressive" ? 100 : t === "medium" ? 200 : qy,
      s = t === "aggressive" ? 50 : t === "medium" ? 100 : Ly;
    if (e.role === "tool") {
      let o =
        typeof e.content == "string" ? e.content : JSON.stringify(e.content);
      return o.length > s ? { ...e, content: Ru(o, s) } : e;
    }
    if (e.role === "assistant") {
      let o = { ...e };
      return (
        o.content &&
          o.content.length > n &&
          (o.content =
            o.content.substring(0, n) +
            `
...(truncated)`),
        o.tool_calls &&
          t === "aggressive" &&
          (o.tool_calls = o.tool_calls.map((i) => ({
            ...i,
            function: {
              name: i.function.name,
              arguments:
                typeof i.function.arguments == "string"
                  ? i.function.arguments.substring(0, 50)
                  : i.function.arguments,
            },
          }))),
        o
      );
    }
    return e;
  }
  async function My(e, t, n = {}) {
    let s = n.threshold ?? Su,
      o = n.safetyMargin ?? Eu,
      i = n.keepRecent ?? Tu,
      a = Cs(),
      c = Rs(t),
      p = Math.floor(a * (s - o)),
      u = p - c,
      l = De(e),
      d = l + c;
    if (d <= p)
      return { messages: e, compressed: !1, compacted: !1, tokensRemoved: 0 };
    let m = l,
      h = null,
      f = 0;
    e.length > 0 && e[0].role === "system" && ((h = e[0]), (f = 1));
    let x = Math.max(f, e.length - i),
      b = e.slice(f, x),
      v = e.slice(x),
      $ = b.filter((E) => !E._compacted);
    if ($.length >= 6)
      try {
        let { compactMessages: E } = ku(),
          C = await E($);
        if (C) {
          let F = [...b.filter((ne) => ne._compacted), C.message],
            B = xt(h, F, v),
            W = De(B);
          if (W + c <= p)
            return {
              messages: B,
              compressed: !0,
              compacted: !0,
              tokensRemoved: m - W,
            };
          b = F;
        }
      } catch {}
    let T = (d - p) / p,
      w = b.map((E) => kn(E, "light")),
      R = xt(h, w, v),
      S = De(R);
    if (S + c <= p)
      return {
        messages: R,
        compressed: !0,
        compacted: !1,
        tokensRemoved: m - S,
      };
    if (
      ((w = b.map((E) => kn(E, "medium"))),
      (R = xt(h, w, v)),
      (S = De(R)),
      S + c <= p)
    )
      return {
        messages: R,
        compressed: !0,
        compacted: !1,
        tokensRemoved: m - S,
      };
    if (
      ((w = b.map((E) => kn(E, "aggressive"))),
      (R = xt(h, w, v)),
      (S = De(R)),
      S + c <= p)
    )
      return {
        messages: R,
        compressed: !0,
        compacted: !1,
        tokensRemoved: m - S,
      };
    for (; w.length > 0 && S + c > u; ) {
      let E = w.shift();
      S -= _n(E);
    }
    return (
      (R = xt(h, w, v)),
      (S = De(R)),
      { messages: R, compressed: !0, compacted: !1, tokensRemoved: m - S }
    );
  }
  function xt(e, t, n) {
    let s = [];
    return (e && s.push(e), s.push(...t, ...n), s);
  }
  function Fy(e, t) {
    if (!e) return "";
    if (bt(e) <= t) return e;
    let s = t * 4,
      o = e.split(`
`),
      i = Math.floor(s * 0.6),
      a = Math.floor(s * 0.4),
      c = "",
      p = 0;
    for (let h of o) {
      if (c.length + h.length + 1 > i) break;
      ((c +=
        (c
          ? `
`
          : "") + h),
        p++);
    }
    let u = "",
      l = 0;
    for (let h = o.length - 1; h >= p; h--) {
      let f =
        o[h] +
        (u
          ? `
`
          : "") +
        u;
      if (f.length > a) break;
      ((u = f), l++);
    }
    let m = `

... (${o.length - p - l} lines omitted, ${o.length} total) ...

`;
    return c + m + u;
  }
  var Iy = 6;
  function Dy(e, t) {
    let n = Cs(),
      s = Rs(t),
      o = Math.floor(n * 0.5) - s,
      i = De(e),
      a = null,
      c = 0;
    e.length > 0 && e[0].role === "system" && ((a = e[0]), (c = 1));
    let p = Math.max(c, e.length - Iy),
      u = e.slice(c, p),
      l = e.slice(p),
      d = u.map((f) => kn(f, "aggressive")),
      m = xt(a, d, l),
      h = De(m);
    for (; d.length > 0 && h > o; ) {
      let f = d.shift();
      h -= _n(f);
    }
    return (
      (m = xt(a, d, l)),
      (h = De(m)),
      { messages: m, tokensRemoved: i - h }
    );
  }
  Cu.exports = {
    estimateTokens: bt,
    estimateMessageTokens: _n,
    estimateMessagesTokens: De,
    estimateToolsTokens: Rs,
    getContextWindow: Cs,
    getUsage: Ny,
    compressMessage: kn,
    compressToolResult: Ru,
    fitToContext: My,
    forceCompress: Dy,
    truncateFileContent: Fy,
    COMPRESSION_THRESHOLD: Su,
    SAFETY_MARGIN: Eu,
    KEEP_RECENT: Tu,
  };
});
var ji = _((r_, Nu) => {
  var Ve = require("fs"),
    Ai = require("path");
  function As() {
    return Ai.join(process.cwd(), ".nex", "sessions");
  }
  function Au() {
    let e = As();
    Ve.existsSync(e) || Ve.mkdirSync(e, { recursive: !0 });
  }
  function Oi(e) {
    let t = e.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 100);
    return Ai.join(As(), `${t}.json`);
  }
  function Ou(e, t, n = {}) {
    Au();
    let s = Oi(e),
      o = {
        name: e,
        createdAt: n.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: t.length,
        model: n.model || null,
        provider: n.provider || null,
        messages: t,
      };
    return (
      Ve.writeFileSync(s, JSON.stringify(o, null, 2), "utf-8"),
      { path: s, name: e }
    );
  }
  function ju(e) {
    let t = Oi(e);
    if (!Ve.existsSync(t)) return null;
    try {
      return JSON.parse(Ve.readFileSync(t, "utf-8"));
    } catch {
      return null;
    }
  }
  function Pu() {
    Au();
    let e = As(),
      t = Ve.readdirSync(e).filter((s) => s.endsWith(".json")),
      n = [];
    for (let s of t)
      try {
        let o = JSON.parse(Ve.readFileSync(Ai.join(e, s), "utf-8"));
        n.push({
          name: o.name || s.replace(".json", ""),
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          messageCount: o.messageCount || 0,
          model: o.model,
          provider: o.provider,
        });
      } catch {}
    return n.sort((s, o) =>
      (o.updatedAt || "").localeCompare(s.updatedAt || ""),
    );
  }
  function Uy(e) {
    let t = Oi(e);
    return Ve.existsSync(t) ? (Ve.unlinkSync(t), !0) : !1;
  }
  function By() {
    let e = Pu();
    return e.length === 0 ? null : ju(e[0].name);
  }
  function zy(e, t = {}) {
    e.length !== 0 && Ou("_autosave", e, t);
  }
  Nu.exports = {
    saveSession: Ou,
    loadSession: ju,
    listSessions: Pu,
    deleteSession: Uy,
    getLastSession: By,
    autoSave: zy,
    _getSessionsDir: As,
  };
});
var Li = _((c_, Du) => {
  var Ye = require("fs"),
    Os = require("path"),
    Wy = require("os");
  function Pi() {
    return Os.join(process.cwd(), ".nex", "memory");
  }
  function Ni() {
    return Os.join(Pi(), "memory.json");
  }
  function Hy() {
    return Os.join(process.cwd(), "NEX.md");
  }
  function Lu() {
    return Os.join(Wy.homedir(), ".nex", "NEX.md");
  }
  function Gy() {
    let e = Pi();
    Ye.existsSync(e) || Ye.mkdirSync(e, { recursive: !0 });
  }
  function js() {
    let e = Ni();
    if (!Ye.existsSync(e)) return {};
    try {
      return JSON.parse(Ye.readFileSync(e, "utf-8"));
    } catch {
      return {};
    }
  }
  function qu(e) {
    (Gy(), Ye.writeFileSync(Ni(), JSON.stringify(e, null, 2), "utf-8"));
  }
  function Ky(e, t) {
    let n = js();
    ((n[e] = { value: t, updatedAt: new Date().toISOString() }), qu(n));
  }
  function Jy(e) {
    let t = js();
    return t[e] ? t[e].value : null;
  }
  function Vy(e) {
    let t = js();
    return e in t ? (delete t[e], qu(t), !0) : !1;
  }
  function Mu() {
    let e = js();
    return Object.entries(e).map(([t, n]) => ({
      key: t,
      value: n.value,
      updatedAt: n.updatedAt,
    }));
  }
  function Fu() {
    let e = Lu();
    if (!Ye.existsSync(e)) return "";
    try {
      return Ye.readFileSync(e, "utf-8").trim();
    } catch {
      return "";
    }
  }
  function Iu() {
    let e = Hy();
    if (!Ye.existsSync(e)) return "";
    try {
      return Ye.readFileSync(e, "utf-8").trim();
    } catch {
      return "";
    }
  }
  function Yy() {
    let e = [],
      t = Fu();
    t &&
      e.push(`GLOBAL INSTRUCTIONS (~/.nex/NEX.md):
${t}`);
    let n = Iu();
    n &&
      e.push(`PROJECT INSTRUCTIONS (NEX.md):
${n}`);
    let s = Mu();
    if (s.length > 0) {
      let o = s.map((i) => `  ${i.key}: ${i.value}`).join(`
`);
      e.push(`PROJECT MEMORY:
${o}`);
    }
    return e.join(`

`);
  }
  Du.exports = {
    remember: Ky,
    recall: Jy,
    forget: Vy,
    listMemories: Mu,
    loadGlobalInstructions: Fu,
    loadProjectInstructions: Iu,
    getMemoryContext: Yy,
    _getMemoryDir: Pi,
    _getMemoryFile: Ni,
    _getGlobalNexMdPath: Lu,
  };
});
var Mi = _((p_, zu) => {
  var vt = require("fs"),
    qi = require("path"),
    { C: l_ } = pe(),
    Ps = {
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
    Gt = { ...Ps };
  function Uu() {
    let e = qi.join(process.cwd(), ".nex", "config.json");
    if (vt.existsSync(e))
      try {
        let t = JSON.parse(vt.readFileSync(e, "utf-8"));
        t.permissions && (Gt = { ...Ps, ...t.permissions });
      } catch {}
  }
  function Xy() {
    let e = qi.join(process.cwd(), ".nex"),
      t = qi.join(e, "config.json"),
      n = {};
    if (vt.existsSync(t))
      try {
        n = JSON.parse(vt.readFileSync(t, "utf-8"));
      } catch {
        n = {};
      }
    ((n.permissions = Gt),
      vt.existsSync(e) || vt.mkdirSync(e, { recursive: !0 }),
      vt.writeFileSync(t, JSON.stringify(n, null, 2), "utf-8"));
  }
  function Bu(e) {
    return Gt[e] || "ask";
  }
  function Qy(e, t) {
    return ["allow", "ask", "deny"].includes(t) ? ((Gt[e] = t), !0) : !1;
  }
  function Zy(e) {
    return Bu(e);
  }
  function e$() {
    return Object.entries(Gt).map(([e, t]) => ({ tool: e, mode: t }));
  }
  function t$() {
    Gt = { ...Ps };
  }
  Uu();
  zu.exports = {
    getPermission: Bu,
    setPermission: Qy,
    checkPermission: Zy,
    listPermissions: e$,
    loadPermissions: Uu,
    savePermissions: Xy,
    resetPermissions: t$,
    DEFAULT_PERMISSIONS: Ps,
  };
});
var Ii = _((d_, Ku) => {
  var yt = require("fs"),
    Ns = require("path"),
    u_ = require("readline"),
    { C: z } = pe(),
    re = null,
    Fi = !1;
  function Ls() {
    return Ns.join(process.cwd(), ".nex", "plans");
  }
  function Wu() {
    let e = Ls();
    yt.existsSync(e) || yt.mkdirSync(e, { recursive: !0 });
  }
  function n$(e, t = []) {
    return (
      (re = {
        name: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        task: e,
        steps: t.map((n) => ({
          description: n.description || n,
          files: n.files || [],
          status: "pending",
        })),
        status: "draft",
        createdAt: new Date().toISOString(),
      }),
      re
    );
  }
  function s$() {
    return re;
  }
  function o$(e) {
    Fi = e;
  }
  function i$() {
    return Fi;
  }
  function a$() {
    return !re || re.status !== "draft"
      ? !1
      : ((re.status = "approved"),
        (re.updatedAt = new Date().toISOString()),
        !0);
  }
  function r$() {
    return !re || re.status !== "approved"
      ? !1
      : ((re.status = "executing"), !0);
  }
  function c$(e, t) {
    return !re || e < 0 || e >= re.steps.length
      ? !1
      : ((re.steps[e].status = t),
        (re.updatedAt = new Date().toISOString()),
        re.steps.every((n) => n.status === "done" || n.status === "skipped") &&
          (re.status = "completed"),
        !0);
  }
  function l$(e) {
    if (!e) return `${z.dim}No active plan${z.reset}`;
    let t = {
        draft: `${z.yellow}DRAFT${z.reset}`,
        approved: `${z.green}APPROVED${z.reset}`,
        executing: `${z.blue}EXECUTING${z.reset}`,
        completed: `${z.green}COMPLETED${z.reset}`,
      },
      n = [];
    (n.push(`
${z.bold}${z.cyan}Plan: ${e.task}${z.reset}`),
      n.push(`${z.dim}Status: ${t[e.status] || e.status}${z.reset}
`));
    for (let s = 0; s < e.steps.length; s++) {
      let o = e.steps[s],
        i;
      switch (o.status) {
        case "done":
          i = `${z.green}\u2713${z.reset}`;
          break;
        case "in_progress":
          i = `${z.blue}\u2192${z.reset}`;
          break;
        case "skipped":
          i = `${z.dim}\u25CB${z.reset}`;
          break;
        default:
          i = `${z.dim} ${z.reset}`;
      }
      (n.push(`  ${i} ${z.bold}Step ${s + 1}:${z.reset} ${o.description}`),
        o.files.length > 0 &&
          n.push(`    ${z.dim}Files: ${o.files.join(", ")}${z.reset}`));
    }
    return (
      n.push(""),
      n.join(`
`)
    );
  }
  function p$(e) {
    if ((e || (e = re), !e)) return null;
    Wu();
    let t = Ns.join(Ls(), `${e.name}.json`);
    return (yt.writeFileSync(t, JSON.stringify(e, null, 2), "utf-8"), t);
  }
  function u$(e) {
    let t = Ns.join(Ls(), `${e}.json`);
    if (!yt.existsSync(t)) return null;
    try {
      let n = JSON.parse(yt.readFileSync(t, "utf-8"));
      return ((re = n), n);
    } catch {
      return null;
    }
  }
  function d$() {
    Wu();
    let e = Ls(),
      t = yt.readdirSync(e).filter((s) => s.endsWith(".json")),
      n = [];
    for (let s of t)
      try {
        let o = JSON.parse(yt.readFileSync(Ns.join(e, s), "utf-8"));
        n.push({
          name: o.name,
          task: o.task,
          status: o.status,
          steps: o.steps ? o.steps.length : 0,
          createdAt: o.createdAt,
        });
      } catch {}
    return n.sort((s, o) =>
      (o.createdAt || "").localeCompare(s.createdAt || ""),
    );
  }
  function m$() {
    ((re = null), (Fi = !1));
  }
  function f$() {
    return `
PLAN MODE ACTIVE: You are in analysis-only mode.

# Restrictions
- Use ONLY read operations: read_file, list_directory, search_files, glob, grep
- DO NOT modify any files (no write_file, edit_file, patch_file, bash with write ops)

# Analysis Phase
Investigate before planning:
- Scope: What files and modules are affected?
- Architecture: How does the current code work? What patterns does it follow?
- Dependencies: What depends on the code being changed? What might break?
- Tests: What test coverage exists? What new tests are needed?

# Plan Output Format
For each step, provide:
- **What**: Clear description of the change
- **Where**: Specific files and line ranges
- **How**: Implementation approach (edit, create, delete)
- **Risk**: What could go wrong and how to mitigate

# Rules
- Order steps by dependency \u2014 later steps can depend on earlier ones, not vice versa.
- Flag steps that need tests and specify what to test.
- List any assumptions you're making about the codebase.
- Present the plan to the user and wait for explicit "approve" before executing.`;
  }
  var Hu = ["interactive", "semi-auto", "autonomous"],
    Gu = "interactive";
  function h$(e) {
    return Hu.includes(e) ? ((Gu = e), !0) : !1;
  }
  function g$() {
    return Gu;
  }
  Ku.exports = {
    createPlan: n$,
    getActivePlan: s$,
    setPlanMode: o$,
    isPlanMode: i$,
    approvePlan: a$,
    startExecution: r$,
    updateStep: c$,
    formatPlan: l$,
    savePlan: p$,
    loadPlan: u$,
    listPlans: d$,
    clearPlan: m$,
    getPlanModePrompt: f$,
    setAutonomyLevel: h$,
    getAutonomyLevel: g$,
    AUTONOMY_LEVELS: Hu,
  };
});
var sd = _((m_, nd) => {
  var { C: y } = pe();
  function x$(e) {
    if (!e) return "";
    let t = e.split(`
`),
      n = [],
      s = !1,
      o = "";
    for (let i of t) {
      if (i.trim().startsWith("```")) {
        if (s)
          (n.push(`${y.dim}${"\u2500".repeat(40)}${y.reset}`),
            (s = !1),
            (o = ""));
        else {
          ((s = !0), (o = i.trim().substring(3).trim()));
          let a = o ? ` ${o} ` : "";
          n.push(
            `${y.dim}${"\u2500".repeat(3)}${a}${"\u2500".repeat(Math.max(0, 37 - a.length))}${y.reset}`,
          );
        }
        continue;
      }
      if (s) {
        n.push(`  ${Ui(i, o)}`);
        continue;
      }
      if (i.startsWith("### ")) {
        n.push(`${y.bold}${y.cyan}   ${i.substring(4)}${y.reset}`);
        continue;
      }
      if (i.startsWith("## ")) {
        n.push(`${y.bold}${y.cyan}  ${i.substring(3)}${y.reset}`);
        continue;
      }
      if (i.startsWith("# ")) {
        n.push(`${y.bold}${y.cyan}${i.substring(2)}${y.reset}`);
        continue;
      }
      if (/^\s*[-*]\s/.test(i)) {
        let a = i.match(/^(\s*)/)[1],
          c = i.replace(/^\s*[-*]\s/, "");
        n.push(`${a}${y.cyan}\u2022${y.reset} ${$t(c)}`);
        continue;
      }
      if (/^\s*\d+\.\s/.test(i)) {
        let a = i.match(/^(\s*)(\d+)\.\s(.*)/);
        if (a) {
          n.push(`${a[1]}${y.cyan}${a[2]}.${y.reset} ${$t(a[3])}`);
          continue;
        }
      }
      n.push($t(i));
    }
    return n.join(`
`);
  }
  function $t(e) {
    return e
      ? e
          .replace(/`([^`]+)`/g, `${y.cyan}$1${y.reset}`)
          .replace(/\*\*([^*]+)\*\*/g, `${y.bold}$1${y.reset}`)
          .replace(/\*([^*]+)\*/g, `${y.dim}$1${y.reset}`)
          .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            `${y.cyan}$1${y.reset} ${y.dim}($2)${y.reset}`,
          )
      : "";
  }
  function Ui(e, t) {
    return e
      ? ["js", "javascript", "ts", "typescript", "jsx", "tsx"].includes(t) || !t
        ? Ju(e)
        : t === "bash" || t === "sh" || t === "shell" || t === "zsh"
          ? Vu(e)
          : t === "json" || t === "jsonc"
            ? Yu(e)
            : t === "python" || t === "py"
              ? Xu(e)
              : t === "go" || t === "golang"
                ? Qu(e)
                : t === "rust" || t === "rs"
                  ? Zu(e)
                  : t === "css" || t === "scss" || t === "less"
                    ? ed(e)
                    : t === "html" || t === "xml" || t === "svg" || t === "htm"
                      ? td(e)
                      : e
      : "";
  }
  function Ju(e) {
    let t =
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|require|async|await|new|this|throw|try|catch|switch|case|break|default|typeof|instanceof)\b/g,
      n = /(["'`])(?:(?=(\\?))\2.)*?\1/g,
      s = /(\/\/.*$)/,
      o = /\b(\d+\.?\d*)\b/g,
      i = e;
    return (
      (i = i.replace(o, `${y.yellow}$1${y.reset}`)),
      (i = i.replace(t, `${y.magenta}$1${y.reset}`)),
      (i = i.replace(n, `${y.green}$&${y.reset}`)),
      (i = i.replace(s, `${y.dim}$1${y.reset}`)),
      i
    );
  }
  function Vu(e) {
    let t = /^(\s*)([\w-]+)/,
      n = /(--?\w[\w-]*)/g,
      s = /(["'])(?:(?=(\\?))\2.)*?\1/g,
      o = /(#.*$)/,
      i = e;
    return (
      (i = i.replace(n, `${y.cyan}$1${y.reset}`)),
      (i = i.replace(t, `$1${y.green}$2${y.reset}`)),
      (i = i.replace(s, `${y.yellow}$&${y.reset}`)),
      (i = i.replace(o, `${y.dim}$1${y.reset}`)),
      i
    );
  }
  function Yu(e) {
    let t = /("[\w-]+")\s*:/g,
      n = /:\s*("(?:[^"\\]|\\.)*")/g,
      s = /:\s*(\d+\.?\d*)/g,
      o = /:\s*(true|false|null)/g,
      i = e;
    return (
      (i = i.replace(t, `${y.cyan}$1${y.reset}:`)),
      (i = i.replace(n, `: ${y.green}$1${y.reset}`)),
      (i = i.replace(s, `: ${y.yellow}$1${y.reset}`)),
      (i = i.replace(o, `: ${y.magenta}$1${y.reset}`)),
      i
    );
  }
  function Xu(e) {
    let t =
        /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|and|or|not|in|is|None|True|False|self|async|await|nonlocal|global)\b/g,
      n =
        /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
      s = /(#.*$)/,
      o = /\b(\d+\.?\d*)\b/g,
      i = /^(\s*@\w+)/,
      a = e;
    return (
      (a = a.replace(o, `${y.yellow}$1${y.reset}`)),
      (a = a.replace(t, `${y.magenta}$1${y.reset}`)),
      (a = a.replace(i, `${y.cyan}$1${y.reset}`)),
      (a = a.replace(n, `${y.green}$&${y.reset}`)),
      (a = a.replace(s, `${y.dim}$1${y.reset}`)),
      a
    );
  }
  function Qu(e) {
    let t =
        /\b(func|package|import|var|const|type|struct|interface|map|chan|go|defer|return|if|else|for|range|switch|case|default|break|continue|select|fallthrough|nil|true|false|make|new|len|cap|append|copy|delete|panic|recover)\b/g,
      n =
        /\b(string|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|bool|byte|rune|error|any)\b/g,
      s = /(["'`])(?:(?=(\\?))\2.)*?\1/g,
      o = /(\/\/.*$)/,
      i = /\b(\d+\.?\d*)\b/g,
      a = e;
    return (
      (a = a.replace(i, `${y.yellow}$1${y.reset}`)),
      (a = a.replace(n, `${y.cyan}$1${y.reset}`)),
      (a = a.replace(t, `${y.magenta}$1${y.reset}`)),
      (a = a.replace(s, `${y.green}$&${y.reset}`)),
      (a = a.replace(o, `${y.dim}$1${y.reset}`)),
      a
    );
  }
  function Zu(e) {
    let t =
        /\b(fn|let|mut|const|struct|enum|impl|trait|pub|use|mod|crate|self|super|match|if|else|for|while|loop|return|break|continue|where|as|in|ref|move|async|await|unsafe|extern|type|static|dyn|macro_rules)\b/g,
      n =
        /\b(i8|i16|i32|i64|i128|u8|u16|u32|u64|u128|f32|f64|bool|char|str|String|Vec|Option|Result|Box|Rc|Arc|Self|Some|None|Ok|Err|true|false)\b/g,
      s = /(["'])(?:(?=(\\?))\2.)*?\1/g,
      o = /(\/\/.*$)/,
      i = /\b(\d+\.?\d*)\b/g,
      a = /\b(\w+!)/g,
      c = e;
    return (
      (c = c.replace(i, `${y.yellow}$1${y.reset}`)),
      (c = c.replace(n, `${y.cyan}$1${y.reset}`)),
      (c = c.replace(t, `${y.magenta}$1${y.reset}`)),
      (c = c.replace(a, `${y.yellow}$1${y.reset}`)),
      (c = c.replace(s, `${y.green}$&${y.reset}`)),
      (c = c.replace(o, `${y.dim}$1${y.reset}`)),
      c
    );
  }
  function ed(e) {
    let t = /^(\s*)([\w-]+)\s*:/,
      n = /:\s*([^;]+)/,
      s = /^(\s*[.#@][\w-]+)/,
      o = /\b(\d+\.?\d*(px|em|rem|%|vh|vw|s|ms|deg|fr)?)\b/g,
      i = /(\/\*.*?\*\/|\/\/.*$)/,
      a = /(#[0-9a-fA-F]{3,8})\b/g,
      c = e;
    return (
      (c = c.replace(a, `${y.yellow}$1${y.reset}`)),
      (c = c.replace(o, `${y.yellow}$1${y.reset}`)),
      (c = c.replace(t, `$1${y.cyan}$2${y.reset}:`)),
      (c = c.replace(s, `$1${y.magenta}$&${y.reset}`)),
      (c = c.replace(i, `${y.dim}$1${y.reset}`)),
      c
    );
  }
  function td(e) {
    let t = /<\/?(\w[\w-]*)/g,
      n = /\s([\w-]+)=/g,
      s = /(["'])(?:(?=(\\?))\2.)*?\1/g,
      o = /(<!--.*?-->)/g,
      i = /(&\w+;)/g,
      a = e;
    return (
      (a = a.replace(o, `${y.dim}$1${y.reset}`)),
      (a = a.replace(s, `${y.green}$&${y.reset}`)),
      (a = a.replace(t, `<${y.magenta}$1${y.reset}`)),
      (a = a.replace(n, ` ${y.cyan}$1${y.reset}=`)),
      (a = a.replace(i, `${y.yellow}$1${y.reset}`)),
      a
    );
  }
  function b$(e, t) {
    if (!e || e.length === 0) return "";
    let n = e.map((a, c) => {
        let p = t.reduce((u, l) => Math.max(u, (l[c] || "").length), 0);
        return Math.max(a.length, p);
      }),
      s = n.map((a) => "\u2500".repeat(a + 2)).join("\u253C"),
      o = e
        .map((a, c) => ` ${y.bold}${a.padEnd(n[c])}${y.reset} `)
        .join("\u2502"),
      i = [];
    (i.push(`${y.dim}\u250C${s.replace(/┼/g, "\u252C")}\u2510${y.reset}`),
      i.push(`${y.dim}\u2502${y.reset}${o}${y.dim}\u2502${y.reset}`),
      i.push(`${y.dim}\u251C${s}\u2524${y.reset}`));
    for (let a of t) {
      let c = e
        .map((p, u) => ` ${(a[u] || "").padEnd(n[u])} `)
        .join(`${y.dim}\u2502${y.reset}`);
      i.push(`${y.dim}\u2502${y.reset}${c}${y.dim}\u2502${y.reset}`);
    }
    return (
      i.push(`${y.dim}\u2514${s.replace(/┼/g, "\u2534")}\u2518${y.reset}`),
      i.join(`
`)
    );
  }
  function v$(e, t, n, s = 30) {
    let o = n > 0 ? Math.round((t / n) * 100) : 0,
      i = Math.round((o / 100) * s),
      a = s - i,
      c = o >= 100 ? y.green : o > 50 ? y.yellow : y.cyan;
    return `  ${e} ${c}${"\u2588".repeat(i)}${y.dim}${"\u2591".repeat(a)}${y.reset} ${o}% (${t}/${n})`;
  }
  var Di = class {
    constructor() {
      ((this.buffer = ""),
        (this.inCodeBlock = !1),
        (this.codeBlockLang = ""),
        (this.lineCount = 0),
        (this._cursorTimer = null),
        (this._cursorFrame = 0),
        (this._cursorActive = !1));
    }
    _safeWrite(t) {
      try {
        process.stdout.write(t);
      } catch (n) {
        if (n.code !== "EPIPE") throw n;
      }
    }
    _cursorWrite(t) {
      try {
        process.stderr.write(t);
      } catch (n) {
        if (n.code !== "EPIPE") throw n;
      }
    }
    startCursor() {
      ((this._cursorActive = !0),
        (this._cursorFrame = 0),
        this._cursorWrite("\x1B[?25l"),
        this._renderCursor(),
        (this._cursorTimer = setInterval(() => this._renderCursor(), 80)));
    }
    _renderCursor() {
      let t = [
          "\u280B",
          "\u2819",
          "\u2839",
          "\u2838",
          "\u283C",
          "\u2834",
          "\u2826",
          "\u2827",
          "\u2807",
          "\u280F",
        ],
        n = t[this._cursorFrame % t.length];
      (this._cursorWrite(`\x1B[2K\r\x1B[36m${n}\x1B[0m`), this._cursorFrame++);
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
    push(t) {
      if (!t) return;
      (this._clearCursorLine(), (this.buffer += t));
      let n;
      for (
        ;
        (n = this.buffer.indexOf(`
`)) !== -1;
      ) {
        let s = this.buffer.substring(0, n);
        ((this.buffer = this.buffer.substring(n + 1)), this._renderLine(s));
      }
      this._cursorActive &&
        (this._renderCursor(),
        this._cursorTimer && clearInterval(this._cursorTimer),
        (this._cursorTimer = setInterval(() => this._renderCursor(), 120)));
    }
    flush() {
      (this.stopCursor(),
        this.buffer && (this._renderLine(this.buffer), (this.buffer = "")),
        this.inCodeBlock &&
          (this._safeWrite(`${y.dim}${"\u2500".repeat(40)}${y.reset}
`),
          (this.inCodeBlock = !1),
          (this.codeBlockLang = "")));
    }
    _renderLine(t) {
      if (t.trim().startsWith("```")) {
        if (this.inCodeBlock)
          (this._safeWrite(`${y.dim}${"\u2500".repeat(40)}${y.reset}
`),
            (this.inCodeBlock = !1),
            (this.codeBlockLang = ""));
        else {
          ((this.inCodeBlock = !0),
            (this.codeBlockLang = t.trim().substring(3).trim()));
          let n = this.codeBlockLang ? ` ${this.codeBlockLang} ` : "";
          this
            ._safeWrite(`${y.dim}${"\u2500".repeat(3)}${n}${"\u2500".repeat(Math.max(0, 37 - n.length))}${y.reset}
`);
        }
        return;
      }
      if (this.inCodeBlock) {
        this._safeWrite(`  ${Ui(t, this.codeBlockLang)}
`);
        return;
      }
      if (t.startsWith("### ")) {
        this._safeWrite(`${y.bold}${y.cyan}   ${t.substring(4)}${y.reset}
`);
        return;
      }
      if (t.startsWith("## ")) {
        this._safeWrite(`${y.bold}${y.cyan}  ${t.substring(3)}${y.reset}
`);
        return;
      }
      if (t.startsWith("# ")) {
        this._safeWrite(`${y.bold}${y.cyan}${t.substring(2)}${y.reset}
`);
        return;
      }
      if (/^\s*[-*]\s/.test(t)) {
        let n = t.match(/^(\s*)/)[1],
          s = t.replace(/^\s*[-*]\s/, "");
        this._safeWrite(`${n}${y.cyan}\u2022${y.reset} ${$t(s)}
`);
        return;
      }
      if (/^\s*\d+\.\s/.test(t)) {
        let n = t.match(/^(\s*)(\d+)\.\s(.*)/);
        if (n) {
          this._safeWrite(`${n[1]}${y.cyan}${n[2]}.${y.reset} ${$t(n[3])}
`);
          return;
        }
      }
      this._safeWrite(`${$t(t)}
`);
    }
  };
  nd.exports = {
    renderMarkdown: x$,
    renderInline: $t,
    highlightCode: Ui,
    highlightJS: Ju,
    highlightBash: Vu,
    highlightJSON: Yu,
    highlightPython: Xu,
    highlightGo: Qu,
    highlightRust: Zu,
    highlightCSS: ed,
    highlightHTML: td,
    renderTable: b$,
    renderProgress: v$,
    StreamRenderer: Di,
  };
});
var Wi = _((f_, rd) => {
  var { execSync: y$ } = require("child_process"),
    Bi = require("path"),
    Sn = require("fs"),
    zi = [
      "pre-tool",
      "post-tool",
      "pre-commit",
      "post-response",
      "session-start",
      "session-end",
    ];
  function od() {
    return Bi.join(process.cwd(), ".nex", "hooks");
  }
  function $$() {
    return Bi.join(process.cwd(), ".nex", "config.json");
  }
  function id() {
    let e = $$();
    if (!Sn.existsSync(e)) return {};
    try {
      return JSON.parse(Sn.readFileSync(e, "utf-8")).hooks || {};
    } catch {
      return {};
    }
  }
  function qs(e) {
    if (!zi.includes(e)) return [];
    let t = [],
      n = od(),
      s = Bi.join(n, e);
    Sn.existsSync(s) && t.push(s);
    let o = id();
    if (o[e]) {
      let i = Array.isArray(o[e]) ? o[e] : [o[e]];
      t.push(...i);
    }
    return t;
  }
  function ad(e, t = {}, n = 3e4) {
    try {
      return {
        success: !0,
        output: y$(e, {
          cwd: process.cwd(),
          encoding: "utf-8",
          timeout: n,
          env: { ...process.env, ...t },
          stdio: ["pipe", "pipe", "pipe"],
        }).trim(),
      };
    } catch (s) {
      return { success: !1, error: s.stderr ? s.stderr.trim() : s.message };
    }
  }
  function w$(e, t = {}) {
    let n = qs(e);
    if (n.length === 0) return [];
    let s = {};
    for (let [i, a] of Object.entries(t))
      s[`NEX_${i.toUpperCase()}`] = String(a);
    let o = [];
    for (let i of n) {
      let a = ad(i, s);
      if ((o.push({ command: i, ...a }), !a.success && e.startsWith("pre-")))
        break;
    }
    return o;
  }
  function k$(e) {
    return qs(e).length > 0;
  }
  function _$() {
    let e = [];
    for (let t of zi) {
      let n = qs(t);
      n.length > 0 && e.push({ event: t, commands: n });
    }
    return e;
  }
  function S$() {
    let e = od();
    return (Sn.existsSync(e) || Sn.mkdirSync(e, { recursive: !0 }), e);
  }
  rd.exports = {
    HOOK_EVENTS: zi,
    loadHookConfig: id,
    getHooksForEvent: qs,
    executeHook: ad,
    runHooks: w$,
    hasHooks: k$,
    listHooks: _$,
    initHooksDir: S$,
  };
});
var md = _((x_, dd) => {
  var {
      C: q,
      Spinner: En,
      TaskProgress: E$,
      formatToolCall: T$,
      formatResult: R$,
      formatToolSummary: ud,
      setActiveTaskProgress: h_,
    } = pe(),
    { callStream: C$ } = Ie(),
    { parseToolArgs: A$ } = cs(),
    { TOOL_DEFINITIONS: Tn, executeTool: O$ } = fn(),
    { gatherProjectContext: j$ } = Ri(),
    { fitToContext: P$, forceCompress: N$, getUsage: L$ } = Ts(),
    { autoSave: wt } = ji(),
    { getMemoryContext: q$ } = Li(),
    { checkPermission: M$, setPermission: F$, savePermissions: I$ } = Mi(),
    { confirm: D$, setAllowAlwaysHandler: U$ } = un(),
    { isPlanMode: B$, getPlanModePrompt: z$ } = Ii(),
    { StreamRenderer: W$ } = sd(),
    { runHooks: cd } = Wi(),
    { routeMCPCall: H$, getMCPToolDefinitions: Ji } = xs(),
    {
      getSkillInstructions: G$,
      getSkillToolDefinitions: Vi,
      routeSkillCall: K$,
    } = hs(),
    { trackUsage: J$ } = ln(),
    { validateToolArgs: V$ } = xi(),
    {
      filterToolsForModel: Y$,
      getModelTier: X$,
      PROVIDER_DEFAULT_TIER: g_,
    } = yi(),
    { getConfiguredProviders: Q$ } = Ie(),
    Kt = 50;
  function Z$(e) {
    Number.isFinite(e) && e > 0 && (Kt = e);
  }
  var Ms = () => null;
  function ew(e) {
    Ms = e;
  }
  var tw = new Set([
      "read_file",
      "list_directory",
      "search_files",
      "glob",
      "grep",
      "web_fetch",
      "web_search",
      "git_status",
      "git_diff",
      "git_log",
    ]),
    Hi = 5,
    Gi = 3,
    ld = 2,
    nw = 6e4,
    sw = 12e4,
    pd = process.cwd();
  U$((e) => {
    (F$(e, "allow"),
      I$(),
      console.log(`${q.green}  \u2713 ${e}: always allow${q.reset}`));
  });
  async function ow(e) {
    let t = e.function.name,
      n = A$(e.function.arguments),
      s = e.id || `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (!n) {
      let p = [...Tn, ...Vi(), ...Ji()].find((l) => l.function.name === t),
        u = p ? JSON.stringify(p.function.parameters, null, 2) : "unknown";
      return (
        console.log(
          `${q.yellow}  \u26A0 ${t}: malformed arguments, sending schema hint${q.reset}`,
        ),
        {
          callId: s,
          fnName: t,
          args: null,
          canExecute: !1,
          errorResult: {
            role: "tool",
            content: `ERROR: Malformed tool arguments. Could not parse your arguments as JSON.
Raw input: ${typeof e.function.arguments == "string" ? e.function.arguments.substring(0, 200) : "N/A"}

Expected JSON schema for "${t}":
${u}

Please retry the tool call with valid JSON arguments matching this schema.`,
            tool_call_id: s,
          },
        }
      );
    }
    let o = V$(t, n);
    if (!o.valid)
      return (
        console.log(
          `${q.yellow}  \u26A0 ${t}: ${
            o.error.split(`
`)[0]
          }${q.reset}`,
        ),
        {
          callId: s,
          fnName: t,
          args: n,
          canExecute: !1,
          errorResult: { role: "tool", content: o.error, tool_call_id: s },
        }
      );
    let i = o.corrected || n;
    if (o.corrected) {
      let c = Object.keys(n),
        p = Object.keys(o.corrected),
        u = c.filter((l) => !p.includes(l));
      u.length &&
        console.log(
          `${q.dim}  \u2713 ${t}: corrected args (${u.join(", ")})${q.reset}`,
        );
    }
    let a = M$(t);
    return a === "deny"
      ? (console.log(`${q.red}  \u2717 ${t}: denied by permissions${q.reset}`),
        {
          callId: s,
          fnName: t,
          args: i,
          canExecute: !1,
          errorResult: {
            role: "tool",
            content: `DENIED: Tool '${t}' is blocked by permissions`,
            tool_call_id: s,
          },
        })
      : a === "ask" && !(await D$(`  Allow ${t}?`, { toolName: t }))
        ? {
            callId: s,
            fnName: t,
            args: i,
            canExecute: !1,
            errorResult: {
              role: "tool",
              content: `CANCELLED: User declined ${t}`,
              tool_call_id: s,
            },
          }
        : { callId: s, fnName: t, args: i, canExecute: !0, errorResult: null };
  }
  async function iw(e, t, n = {}) {
    let s = await K$(e, t);
    if (s !== null) return s;
    let o = await H$(e, t);
    return o !== null ? o : O$(e, t, n);
  }
  function aw(e, t) {
    switch (e) {
      case "read_file":
      case "write_file":
      case "edit_file":
      case "patch_file":
      case "list_directory":
        return t.path || "";
      case "bash":
        return (t.command || "").substring(0, 60);
      case "grep":
      case "search_files":
      case "glob":
        return t.pattern || "";
      case "web_fetch":
        return (t.url || "").substring(0, 50);
      case "web_search":
        return (t.query || "").substring(0, 40);
      default:
        return "";
    }
  }
  async function Ki(e, t = !1) {
    (t || console.log(T$(e.fnName, e.args)),
      cd("pre-tool", { tool_name: e.fnName }));
    let n = await iw(e.fnName, e.args, { silent: !0 }),
      s = String(n ?? ""),
      o =
        s.length > 5e4
          ? s.substring(0, 5e4) +
            `
...(truncated ${s.length - 5e4} chars)`
          : s;
    (t || console.log(R$(o)), cd("post-tool", { tool_name: e.fnName }));
    let i = o.split(`
`)[0],
      a =
        i.startsWith("ERROR") ||
        i.includes("CANCELLED") ||
        i.includes("BLOCKED") ||
        (e.fnName === "spawn_agents" &&
          !/✓ Agent/.test(o) &&
          /✗ Agent/.test(o)),
      c = ud(e.fnName, e.args, o, a);
    return {
      msg: { role: "tool", content: o, tool_call_id: e.callId },
      summary: c,
    };
  }
  async function rw(e, t = !1, n = {}) {
    let s = new Array(e.length),
      o = [],
      i = [],
      a = null;
    if (t && !n.skipSpinner) {
      let p = e.filter((u) => u.canExecute);
      if (p.length > 0) {
        let u;
        if (p.length === 1) {
          let l = p[0];
          u = `\u25B8 ${l.fnName} ${aw(l.fnName, l.args)}`;
        } else {
          let l = p.map((d) => d.fnName).join(", ");
          u = `\u25B8 ${p.length} tools: ${l.length > 60 ? l.substring(0, 57) + "..." : l}`;
        }
        ((a = new En(u)), a.start());
      }
    }
    async function c() {
      if (i.length !== 0) {
        if (i.length === 1) {
          let p = i[0],
            { msg: u, summary: l } = await Ki(e[p], t);
          ((s[p] = u), o.push(l));
        } else {
          let p = i.map((l) => Ki(e[l], t)),
            u = await Promise.all(p);
          for (let l = 0; l < i.length; l++)
            ((s[i[l]] = u[l].msg), o.push(u[l].summary));
        }
        i = [];
      }
    }
    for (let p = 0; p < e.length; p++) {
      let u = e[p];
      if (!u.canExecute) {
        (await c(),
          (s[p] = u.errorResult),
          o.push(ud(u.fnName, u.args || {}, u.errorResult.content, !0)));
        continue;
      }
      if (tw.has(u.fnName)) i.push(p);
      else {
        (await c(), u.fnName === "spawn_agents" && a && (a.stop(), (a = null)));
        let { msg: l, summary: d } = await Ki(u, t);
        ((s[p] = l), o.push(d));
      }
    }
    if ((await c(), a && a.stop(), t && o.length > 0 && !n.skipSummaries))
      for (let p of o) console.log(p);
    return s;
  }
  var we = [];
  function cw() {
    try {
      let t = Q$().flatMap((o) =>
        o.models.map((i) => ({
          spec: `${o.name}:${i.id}`,
          tier: X$(i.id, o.name),
          name: i.name,
        })),
      );
      if (t.length < 2) return "";
      let n = {
          full: "complex tasks (refactor, implement, generate)",
          standard: "regular tasks (edit, fix, analyze)",
          essential: "simple tasks (read, search, list)",
        },
        s = `
# Sub-Agent Model Routing

`;
      ((s +=
        'Sub-agents auto-select models by task complexity. Override with `model: "provider:model"` in agent definition.\n\n'),
        (s += `| Model | Tier | Auto-assigned for |
|---|---|---|
`));
      for (let o of t)
        s += `| ${o.spec} | ${o.tier} | ${n[o.tier] || o.tier} |
`;
      return s;
    } catch {
      return "";
    }
  }
  async function lw() {
    let e = await j$(pd),
      t = q$(),
      n = G$(),
      s = B$() ? z$() : "";
    return `You are Nex Code, an expert coding assistant. You help with programming tasks by reading, writing, and editing files, running commands, and answering questions.

WORKING DIRECTORY: ${pd}
All relative paths resolve from this directory.

PROJECT CONTEXT:
${e}
${
  t
    ? `
${t}
`
    : ""
}${
      n
        ? `
${n}
`
        : ""
    }${
      s
        ? `
${s}
`
        : ""
    }
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

- Use markdown formatting: **bold** for key points, headers for sections, bullet lists for multiple items, \`code\` for identifiers. The terminal renders markdown with syntax highlighting.
- Structure longer responses with headers (## Section) so the user can scan quickly.

Response patterns by request type:
- **Questions / analysis / "status" / "explain" / "what is"**: Gather data with tools, then respond with a clear, structured summary. NEVER just run tools and stop.
- **Coding tasks (implement, fix, refactor)**: Brief confirmation of what you'll do, then use tools. After changes, summarize what you did and any important details.
- **Simple questions ("what does X do?")**: Answer directly without tools when you have enough context.
- **Ambiguous requests**: When a request is vague or could be interpreted multiple ways (e.g. "optimize this", "improve performance", "fix the issues", "refactor this"), ALWAYS ask clarifying questions first using ask_user. Do NOT guess scope or intent. Ask about: which specific area, what the expected outcome is, any constraints. Only proceed after the user clarifies.
- **Server/SSH commands**: After running remote commands, ALWAYS present the results: service status, log errors, findings.

After completing multi-step tasks, suggest logical next steps (e.g. "You can run npm test to verify" or "Consider committing with /commit").

# Doing Tasks

- For non-trivial tasks, briefly state your approach before starting (1 sentence). This helps the user know what to expect.
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
${cw()}

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
- edit_file/patch_file "old_text not found": Read the file again with read_file. Compare your old_text with the actual content. The most common cause is stale content \u2014 the file changed since you last read it.
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
- If you encounter unexpected state (unfamiliar files, branches), investigate before modifying.`;
  }
  function pw() {
    we = [];
  }
  function uw() {
    return we.length;
  }
  function dw() {
    return we;
  }
  function mw(e) {
    we = e;
  }
  function kt(e, t, n, s, o) {
    if (e < 1) return;
    let i = [...t.values()].reduce((c, p) => c + p, 0),
      a = `\u2500\u2500 ${e} ${e === 1 ? "step" : "steps"} \xB7 ${i} ${i === 1 ? "tool" : "tools"}`;
    if (
      (n.size > 0 &&
        (a += ` \xB7 ${n.size} ${n.size === 1 ? "file" : "files"} modified`),
      o)
    ) {
      let c = Date.now() - o,
        p = Math.round(c / 1e3);
      a += p >= 60 ? ` \xB7 ${Math.floor(p / 60)}m ${p % 60}s` : ` \xB7 ${p}s`;
    }
    ((a += " \u2500\u2500"),
      console.log(`
${q.dim}  ${a}${q.reset}`),
      n.size > 0
        ? console.log(
            `${q.dim}  \u{1F4A1} /diff \xB7 /commit \xB7 /undo${q.reset}`,
          )
        : s.size > 0 &&
          e >= 2 &&
          console.log(`${q.dim}  \u{1F4A1} /save \xB7 /clear${q.reset}`));
  }
  async function fw(e) {
    we.push({ role: "user", content: e });
    let { setOnChange: t } = ys(),
      n = null,
      s = 0;
    t((C, M) => {
      C === "create"
        ? (n && n.stop(),
          (n = new E$(M.name, M.tasks)),
          n.setStats({ tokens: s }),
          n.start())
        : C === "update" && n
          ? n.updateTask(M.id, M.status)
          : C === "clear" && n && (n.stop(), (n = null));
    });
    let i = [{ role: "system", content: await lw() }, ...we],
      a = new En("Thinking...");
    a.start();
    let {
        messages: c,
        compressed: p,
        compacted: u,
        tokensRemoved: l,
      } = await P$(i, Tn),
      d = L$(i, Tn);
    if ((a.stop(), u))
      console.log(
        `${q.dim}  [context compacted \u2014 summary (~${l} tokens freed)]${q.reset}`,
      );
    else if (p) {
      let C = d.limit > 0 ? Math.round((l / d.limit) * 100) : 0;
      console.log(
        `${q.dim}  [context compressed \u2014 ~${l} tokens freed (${C}%)]${q.reset}`,
      );
    }
    d.percentage > 85 &&
      console.log(
        `${q.yellow}  \u26A0 Context ${Math.round(d.percentage)}% full \u2014 consider /clear or /save + start fresh${q.reset}`,
      );
    let m = c,
      h = 0,
      f = 0,
      x = 0,
      b = 0,
      v = 0,
      $ = new Map(),
      T = new Set(),
      w = new Set(),
      R = Date.now(),
      S;
    for (S = 0; S < Kt; S++) {
      let F = function () {
        M ||
          (console.log(
            `${q.dim}  \u2500\u2500 step ${v} \u2500\u2500${q.reset}`,
          ),
          (M = !0));
      };
      var E = F;
      if (Ms()?.aborted) break;
      let M = !0,
        B = null;
      if (n && n.isActive()) n._paused && n.resume();
      else if (!n) {
        let j = v > 0 ? `Thinking... (step ${v + 1})` : "Thinking...";
        ((B = new En(j)), B.start());
      }
      let W = !0,
        ne = "",
        se = new W$(),
        ge,
        oe = Date.now(),
        Z = !1,
        ce = new AbortController(),
        Ge = setInterval(() => {
          let j = Date.now() - oe;
          j >= sw
            ? (se._clearCursorLine(),
              console.log(
                `${q.yellow}  \u26A0 Stream stale for ${Math.round(j / 1e3)}s \u2014 aborting and retrying${q.reset}`,
              ),
              ce.abort())
            : j >= nw &&
              !Z &&
              ((Z = !0),
              se._clearCursorLine(),
              console.log(
                `${q.yellow}  \u26A0 No tokens received for ${Math.round(j / 1e3)}s \u2014 waiting...${q.reset}`,
              ));
        }, 5e3);
      try {
        let j = Y$([...Tn, ...Vi(), ...Ji()]),
          L = Ms(),
          je = new AbortController();
        (L && L.addEventListener("abort", () => je.abort(), { once: !0 }),
          ce.signal.addEventListener("abort", () => je.abort(), { once: !0 }),
          (ge = await C$(m, j, {
            signal: je.signal,
            onToken: (ee) => {
              ((oe = Date.now()),
                (Z = !1),
                W &&
                  (n && !n._paused ? n.pause() : B && B.stop(),
                  F(),
                  se.startCursor(),
                  (W = !1)),
                (ne += ee),
                se.push(ee));
            },
          })));
      } catch (j) {
        if (
          (clearInterval(Ge),
          n && !n._paused && n.pause(),
          B && B.stop(),
          se.stopCursor(),
          ce.signal.aborted && !Ms()?.aborted)
        ) {
          if ((x++, x > ld)) {
            (console.log(
              `${q.red}  \u2717 Stream stale: max retries (${ld}) exceeded. The model may be overloaded \u2014 try again or switch models.${q.reset}`,
            ),
              n && (n.stop(), (n = null)),
              t(null),
              kt(v, $, T, w, R),
              wt(we));
            break;
          }
          S--;
          continue;
        }
        if (
          j.name === "AbortError" ||
          j.name === "CanceledError" ||
          j.message?.includes("canceled") ||
          j.message?.includes("aborted")
        ) {
          (n && (n.stop(), (n = null)), t(null), kt(v, $, T, w, R), wt(we));
          break;
        }
        let L = j.message;
        if (j.code === "ECONNREFUSED" || j.message.includes("ECONNREFUSED"))
          L =
            "Connection refused \u2014 please check your internet connection or API endpoint";
        else if (j.code === "ENOTFOUND" || j.message.includes("ENOTFOUND"))
          L =
            "Network error \u2014 could not reach the API server. Please check your connection";
        else if (j.code === "ETIMEDOUT" || j.message.includes("timeout"))
          L =
            "Request timed out \u2014 the API server took too long to respond. Please try again";
        else if (
          j.message.includes("401") ||
          j.message.includes("Unauthorized")
        )
          L =
            "Authentication failed \u2014 please check your API key in the .env file";
        else if (j.message.includes("403") || j.message.includes("Forbidden"))
          L =
            "Access denied \u2014 your API key may not have permission for this model";
        else if (j.message.includes("400")) {
          let ee = (j.message || "").toLowerCase(),
            G =
              ee.includes("context") ||
              ee.includes("token") ||
              ee.includes("length") ||
              ee.includes("too long") ||
              ee.includes("too many");
          if (G && b < 1) {
            (b++,
              console.log(
                `${q.yellow}  \u26A0 Context too long \u2014 force-compressing and retrying...${q.reset}`,
              ));
            let Jt = [...Tn, ...Vi(), ...Ji()],
              { messages: Dd, tokensRemoved: Ud } = N$(m, Jt);
            ((m = Dd),
              console.log(
                `${q.dim}  [force-compressed \u2014 ~${Ud} tokens freed]${q.reset}`,
              ),
              S--);
            continue;
          }
          G
            ? (L =
                "Context too long \u2014 force compression exhausted. Use /clear to start fresh")
            : (L =
                "Bad request \u2014 the conversation may be too long or contain unsupported content. Try /clear and retry");
        } else
          j.message.includes("500") ||
          j.message.includes("502") ||
          j.message.includes("503") ||
          j.message.includes("504")
            ? (L =
                "API server error \u2014 the provider is experiencing issues. Please try again in a moment")
            : (j.message.includes("fetch failed") ||
                j.message.includes("fetch")) &&
              (L =
                "Network request failed \u2014 please check your internet connection");
        if (
          (console.log(`${q.red}  \u2717 ${L}${q.reset}`),
          j.message.includes("429"))
        ) {
          if ((h++, h > Hi)) {
            (console.log(
              `${q.red}  Rate limit: max retries (${Hi}) exceeded. Try again later or use /budget to check your limits.${q.reset}`,
            ),
              n && (n.stop(), (n = null)),
              t(null),
              kt(v, $, T, w, R),
              wt(we));
            break;
          }
          let ee = Math.min(1e4 * Math.pow(2, h - 1), 12e4),
            G = new En(
              `Rate limit \u2014 waiting ${Math.round(ee / 1e3)}s (retry ${h}/${Hi})`,
            );
          (G.start(), await new Promise((Jt) => setTimeout(Jt, ee)), G.stop());
          continue;
        }
        if (
          j.message.includes("socket disconnected") ||
          j.message.includes("TLS") ||
          j.message.includes("ECONNRESET") ||
          j.message.includes("ECONNABORTED") ||
          j.message.includes("ETIMEDOUT") ||
          j.code === "ECONNRESET" ||
          j.code === "ECONNABORTED"
        ) {
          if ((f++, f > Gi)) {
            (console.log(
              `${q.red}  Network error: max retries (${Gi}) exceeded. Check your connection and try again.${q.reset}`,
            ),
              n && (n.stop(), (n = null)),
              t(null),
              kt(v, $, T, w, R),
              wt(we));
            break;
          }
          let ee = Math.min(2e3 * Math.pow(2, f - 1), 3e4),
            G = new En(
              `Network error \u2014 retrying in ${Math.round(ee / 1e3)}s (${f}/${Gi})`,
            );
          (G.start(),
            await new Promise((Jt) => setTimeout(Jt, ee)),
            G.stop(),
            S--);
          continue;
        }
        (n && (n.stop(), (n = null)), t(null), kt(v, $, T, w, R), wt(we));
        break;
      }
      if (
        (clearInterval(Ge),
        W && (n && !n._paused && n.pause(), B && B.stop()),
        (f = 0),
        (x = 0),
        ne && se.flush(),
        ge && ge.usage)
      ) {
        let { getActiveProviderName: j, getActiveModelId: L } = Ie();
        (J$(
          j(),
          L(),
          ge.usage.prompt_tokens || 0,
          ge.usage.completion_tokens || 0,
        ),
          (s +=
            (ge.usage.prompt_tokens || 0) + (ge.usage.completion_tokens || 0)),
          n && n.setStats({ tokens: s }));
      }
      let { content: N, tool_calls: O } = ge,
        U = { role: "assistant", content: N || "" };
      if (
        (O && O.length > 0 && (U.tool_calls = O),
        we.push(U),
        m.push(U),
        !O || O.length === 0)
      ) {
        if (
          !((N || "").trim().length > 0 || ne.trim().length > 0) &&
          v > 0 &&
          S < Kt - 1
        ) {
          let L = {
            role: "user",
            content:
              "[SYSTEM] You ran tools but produced no visible output. The user CANNOT see tool results \u2014 only your text. Please summarize your findings now.",
          };
          m.push(L);
          continue;
        }
        (n && (n.stop(), (n = null)), t(null), kt(v, $, T, w, R), wt(we));
        return;
      }
      (v++, v > 1 && (M = !1));
      for (let j of O) {
        let L = j.function.name;
        $.set(L, ($.get(L) || 0) + 1);
      }
      let le = [];
      for (let j of O) le.push(await ow(j));
      let H = n ? { skipSpinner: !0, skipSummaries: !0 } : {};
      (H.skipSummaries || F(), n && n._paused && n.resume());
      let ke = await rw(le, !0, H);
      for (let j = 0; j < le.length; j++) {
        let L = le[j];
        if (!L.canExecute) continue;
        let je = ke[j].content,
          ee = !je.startsWith("ERROR") && !je.includes("CANCELLED");
        (ee &&
          ["write_file", "edit_file", "patch_file"].includes(L.fnName) &&
          L.args &&
          L.args.path &&
          T.add(L.args.path),
          ee &&
            L.fnName === "read_file" &&
            L.args &&
            L.args.path &&
            w.add(L.args.path));
      }
      for (let j of ke) (we.push(j), m.push(j));
    }
    S >= Kt &&
      (n && (n.stop(), (n = null)),
      t(null),
      kt(v, $, T, w, R),
      wt(we),
      console.log(`
${q.yellow}\u26A0 Max iterations (${Kt}) reached. Try ${q.bold}--max-turns ${Kt + 20}${q.reset}${q.yellow} or break into smaller steps.${q.reset}`));
  }
  dd.exports = {
    processInput: fw,
    clearConversation: pw,
    getConversationLength: uw,
    getConversationMessages: dw,
    setConversationMessages: mw,
    setAbortSignalGetter: ew,
    setMaxIterations: Z$,
  };
});
var gd = _((b_, hd) => {
  var { C: Y } = pe(),
    {
      listProviders: hw,
      getActiveProviderName: gw,
      getActiveModelId: xw,
      setActiveModel: bw,
    } = Ie();
  function fd(e, t, n = {}) {
    let {
      title: s = "Select",
      hint: o = "\u2191\u2193 navigate \xB7 Enter select \xB7 Esc cancel",
    } = n;
    return new Promise((i) => {
      let a = t.map((v, $) => (v.isHeader ? -1 : $)).filter((v) => v >= 0);
      if (a.length === 0) {
        i(null);
        return;
      }
      let c = t.findIndex((v) => v.isCurrent),
        p = c >= 0 ? a.indexOf(c) : 0;
      p < 0 && (p = 0);
      let u = process.stdout.rows ? Math.max(process.stdout.rows - 6, 5) : 20,
        l = 0;
      function d() {
        let v = a[p];
        return (
          v < l ? (l = v) : v >= l + u && (l = v - u + 1),
          { start: l, end: Math.min(t.length, l + u) }
        );
      }
      let m = 0;
      function h() {
        if (m > 0) {
          process.stdout.write(`\x1B[${m}A`);
          for (let R = 0; R < m; R++)
            process.stdout.write(`\x1B[2K
`);
          process.stdout.write(`\x1B[${m}A`);
        }
        let v = [];
        (v.push(`  ${Y.bold}${Y.cyan}${s}${Y.reset}`),
          v.push(`  ${Y.dim}${o}${Y.reset}`),
          v.push(""));
        let { start: $, end: T } = d();
        $ > 0 && v.push(`  ${Y.dim}\u2191 more${Y.reset}`);
        for (let R = $; R < T; R++) {
          let S = t[R];
          if (S.isHeader) {
            v.push(`  ${Y.bold}${Y.dim}${S.label}${Y.reset}`);
            continue;
          }
          let E = a[p] === R,
            C = E ? `${Y.cyan}> ` : "  ",
            M = S.isCurrent ? ` ${Y.yellow}<current>${Y.reset}` : "";
          E
            ? v.push(`${C}${Y.bold}${S.label}${Y.reset}${M}`)
            : v.push(`${C}${Y.dim}${S.label}${Y.reset}${M}`);
        }
        T < t.length && v.push(`  ${Y.dim}\u2193 more${Y.reset}`);
        let w = v.join(`
`);
        (process.stdout.write(
          w +
            `
`,
        ),
          (m = v.length));
      }
      e.pause();
      let f = process.stdin.isRaw;
      (process.stdin.isTTY && process.stdin.setRawMode(!0),
        process.stdin.resume());
      function x() {
        (process.stdin.removeListener("keypress", b),
          process.stdin.isTTY && f !== void 0 && process.stdin.setRawMode(f),
          e.resume());
      }
      function b(v, $) {
        if ($) {
          if ($.name === "up" || ($.ctrl && $.name === "p")) {
            p > 0 && (p--, h());
            return;
          }
          if ($.name === "down" || ($.ctrl && $.name === "n")) {
            p < a.length - 1 && (p++, h());
            return;
          }
          if ($.name === "return") {
            let T = t[a[p]];
            (x(), i(T ? T.value : null));
            return;
          }
          if ($.name === "escape" || ($.ctrl && $.name === "c")) {
            (x(), i(null));
            return;
          }
        }
      }
      (process.stdin.on("keypress", b), h());
    });
  }
  async function vw(e) {
    let t = hw(),
      n = gw(),
      s = xw(),
      o = [];
    for (let a of t)
      if (a.models.length !== 0) {
        o.push({ label: a.provider, value: null, isHeader: !0 });
        for (let c of a.models) {
          let p = a.provider === n && c.id === s;
          o.push({
            label: `  ${c.name} (${a.provider}:${c.id})`,
            value: `${a.provider}:${c.id}`,
            isCurrent: p,
          });
        }
      }
    let i = await fd(e, o, { title: "Select Model" });
    return i
      ? (bw(i), console.log(`${Y.green}Switched to ${i}${Y.reset}`), !0)
      : (console.log(`${Y.dim}Cancelled${Y.reset}`), !1);
  }
  hd.exports = { pickFromList: fd, showModelPicker: vw };
});
var yw = require("readline"),
  it = require("fs"),
  He = require("path"),
  { C: r, banner: $w, cleanupTerminal: ww } = pe(),
  {
    processInput: Yi,
    clearConversation: kw,
    getConversationLength: Xi,
    getConversationMessages: xd,
    setConversationMessages: bd,
    setAbortSignalGetter: _w,
  } = md(),
  { getActiveModel: _t, setActiveModel: Rd, getModelNames: v_ } = cs(),
  {
    listProviders: ea,
    getActiveProviderName: St,
    listAllModels: y_,
    setFallbackChain: Sw,
    getFallbackChain: Ew,
    getProvider: Tw,
  } = Ie(),
  { printContext: Cd } = Ri(),
  { setAutoConfirm: Rw, getAutoConfirm: Ad, setReadlineInterface: Cw } = un(),
  { getUsage: Aw } = Ts(),
  { TOOL_DEFINITIONS: Ow } = fn(),
  {
    saveSession: jw,
    loadSession: Pw,
    listSessions: Nw,
    getLastSession: Lw,
  } = ji(),
  { remember: qw, forget: Mw, listMemories: Fw } = Li(),
  { listPermissions: Iw, setPermission: vd, savePermissions: yd } = Mi(),
  {
    createPlan: $_,
    getActivePlan: Dw,
    setPlanMode: $d,
    isPlanMode: Uw,
    approvePlan: Bw,
    startExecution: zw,
    formatPlan: Ww,
    savePlan: w_,
    listPlans: Hw,
    clearPlan: k_,
    setAutonomyLevel: Gw,
    getAutonomyLevel: Od,
    AUTONOMY_LEVELS: wd,
  } = Ii(),
  {
    isGitRepo: Qi,
    getCurrentBranch: Kw,
    formatDiffSummary: kd,
    analyzeDiff: Jw,
    commit: _d,
    createBranch: Vw,
  } = fs(),
  { listServers: Yw, connectAll: Xw, disconnectAll: Qw } = xs(),
  { listHooks: Zw, runHooks: __, HOOK_EVENTS: S_ } = Wi(),
  {
    undo: e0,
    redo: t0,
    getHistory: n0,
    getUndoCount: Sd,
    getRedoCount: Ed,
    clearHistory: s0,
  } = mi(),
  {
    formatCosts: o0,
    resetCosts: i0,
    setCostLimit: a0,
    removeCostLimit: r0,
    getCostLimits: c0,
    checkBudget: l0,
    getProviderSpend: p0,
    saveCostLimits: Td,
  } = ln(),
  {
    loadAllSkills: u0,
    listSkills: d0,
    enableSkill: m0,
    disableSkill: f0,
    getSkillCommands: ta,
    handleSkillCommand: h0,
  } = hs(),
  { showModelPicker: g0 } = gd(),
  Is = process.cwd(),
  Xe = null;
function jd() {
  return Xe?.signal ?? null;
}
var Ds = [
  { cmd: "/help", desc: "Show full help" },
  { cmd: "/model", desc: "Show/switch model" },
  { cmd: "/providers", desc: "List providers and models" },
  { cmd: "/fallback", desc: "Show/set fallback chain" },
  { cmd: "/tokens", desc: "Token usage and context budget" },
  { cmd: "/costs", desc: "Session token costs" },
  { cmd: "/budget", desc: "Show/set cost limits per provider" },
  { cmd: "/clear", desc: "Clear conversation" },
  { cmd: "/context", desc: "Show project context" },
  { cmd: "/autoconfirm", desc: "Toggle auto-confirm" },
  { cmd: "/save", desc: "Save session" },
  { cmd: "/load", desc: "Load a saved session" },
  { cmd: "/sessions", desc: "List saved sessions" },
  { cmd: "/resume", desc: "Resume last session" },
  { cmd: "/remember", desc: "Save a memory" },
  { cmd: "/forget", desc: "Delete a memory" },
  { cmd: "/memory", desc: "Show all memories" },
  { cmd: "/permissions", desc: "Show tool permissions" },
  { cmd: "/allow", desc: "Auto-allow a tool" },
  { cmd: "/deny", desc: "Block a tool" },
  { cmd: "/plan", desc: "Plan mode (analyze before executing)" },
  { cmd: "/plans", desc: "List saved plans" },
  { cmd: "/auto", desc: "Set autonomy level" },
  { cmd: "/commit", desc: "Smart commit (diff + message)" },
  { cmd: "/diff", desc: "Show current diff" },
  { cmd: "/branch", desc: "Create feature branch" },
  { cmd: "/mcp", desc: "MCP servers and tools" },
  { cmd: "/hooks", desc: "Show configured hooks" },
  { cmd: "/skills", desc: "List, enable, disable skills" },
  { cmd: "/tasks", desc: "Show task list" },
  { cmd: "/undo", desc: "Undo last file change" },
  { cmd: "/redo", desc: "Redo last undone change" },
  { cmd: "/history", desc: "Show file change history" },
  { cmd: "/exit", desc: "Quit" },
];
function Pd() {
  let e = ta(),
    t = [...Ds, ...e],
    n = Math.max(...t.map((s) => s.cmd.length));
  console.log("");
  for (let { cmd: s, desc: o } of Ds)
    console.log(
      `  ${r.cyan}${s.padEnd(n + 2)}${r.reset}${r.dim}${o}${r.reset}`,
    );
  for (let { cmd: s, desc: o } of e)
    console.log(
      `  ${r.cyan}${s.padEnd(n + 2)}${r.reset}${r.dim}${o} ${r.yellow}[skill]${r.reset}`,
    );
  console.log(`
${r.dim}Type /help for detailed usage${r.reset}
`);
}
function Nd(e) {
  try {
    let t, n;
    (e.endsWith("/") || e.endsWith(He.sep)
      ? ((t = e), (n = ""))
      : ((t = He.dirname(e)), (n = He.basename(e))),
      t.startsWith("~") && (t = He.join(require("os").homedir(), t.slice(1))));
    let s = He.isAbsolute(t) ? t : He.resolve(Is, t);
    if (!it.existsSync(s) || !it.statSync(s).isDirectory()) return [];
    let o = it.readdirSync(s, { withFileTypes: !0 }),
      i = [];
    for (let a of o) {
      if (
        a.name.startsWith(".") ||
        a.name === "node_modules" ||
        (n && !a.name.startsWith(n))
      )
        continue;
      let c = e.endsWith("/") || e.endsWith(He.sep) ? e : He.dirname(e) + "/",
        p = c === "./" && !e.startsWith("./") ? a.name : c + a.name;
      i.push(a.isDirectory() ? p + "/" : p);
    }
    return i;
  } catch {
    return [];
  }
}
function Ld(e) {
  if (e.startsWith("/")) {
    let s = [...Ds, ...ta()],
      o = s.map((i) => i.cmd).filter((i) => i.startsWith(e));
    return [o.length ? o : s.map((i) => i.cmd), e];
  }
  let t = e.split(/\s+/),
    n = t[t.length - 1] || "";
  return n &&
    (n.includes("/") ||
      n.startsWith("./") ||
      n.startsWith("../") ||
      n.startsWith("~"))
    ? [Nd(n), n]
    : [[], e];
}
function qd() {
  console.log(`
${r.bold}${r.cyan}Commands:${r.reset}
  ${r.cyan}/help${r.reset}             ${r.dim}Show this help${r.reset}
  ${r.cyan}/model [spec]${r.reset}     ${r.dim}Show/switch model (e.g. openai:gpt-4o, claude-sonnet)${r.reset}
  ${r.cyan}/providers${r.reset}        ${r.dim}Show available providers and models${r.reset}
  ${r.cyan}/fallback [chain]${r.reset} ${r.dim}Show/set fallback chain (e.g. anthropic,openai,local)${r.reset}
  ${r.cyan}/tokens${r.reset}           ${r.dim}Show token usage and context budget${r.reset}
  ${r.cyan}/costs${r.reset}            ${r.dim}Show session token costs${r.reset}
  ${r.cyan}/budget [prov] [n]${r.reset}${r.dim}Show/set cost limits per provider${r.reset}
  ${r.cyan}/clear${r.reset}            ${r.dim}Clear conversation context${r.reset}
  ${r.cyan}/context${r.reset}          ${r.dim}Show project context${r.reset}
  ${r.cyan}/autoconfirm${r.reset}      ${r.dim}Toggle auto-confirm for file changes${r.reset}

${r.bold}${r.cyan}Sessions:${r.reset}
  ${r.cyan}/save [name]${r.reset}      ${r.dim}Save current session${r.reset}
  ${r.cyan}/load <name>${r.reset}      ${r.dim}Load a saved session${r.reset}
  ${r.cyan}/sessions${r.reset}         ${r.dim}List all saved sessions${r.reset}
  ${r.cyan}/resume${r.reset}           ${r.dim}Resume last session${r.reset}

${r.bold}${r.cyan}Memory:${r.reset}
  ${r.cyan}/remember <text>${r.reset}  ${r.dim}Save a memory (key=value or freeform)${r.reset}
  ${r.cyan}/forget <key>${r.reset}     ${r.dim}Delete a memory${r.reset}
  ${r.cyan}/memory${r.reset}           ${r.dim}Show all memories${r.reset}

${r.bold}${r.cyan}Permissions:${r.reset}
  ${r.cyan}/permissions${r.reset}      ${r.dim}Show tool permissions${r.reset}
  ${r.cyan}/allow <tool>${r.reset}     ${r.dim}Auto-allow a tool${r.reset}
  ${r.cyan}/deny <tool>${r.reset}      ${r.dim}Block a tool${r.reset}

${r.bold}${r.cyan}Planning:${r.reset}
  ${r.cyan}/plan [task]${r.reset}      ${r.dim}Enter plan mode (analyze, don't execute)${r.reset}
  ${r.cyan}/plan status${r.reset}      ${r.dim}Show current plan progress${r.reset}
  ${r.cyan}/plan approve${r.reset}     ${r.dim}Approve current plan${r.reset}
  ${r.cyan}/plans${r.reset}            ${r.dim}List saved plans${r.reset}
  ${r.cyan}/auto [level]${r.reset}     ${r.dim}Set autonomy: interactive/semi-auto/autonomous${r.reset}

${r.bold}${r.cyan}Git:${r.reset}
  ${r.cyan}/commit [msg]${r.reset}    ${r.dim}Smart commit (analyze diff, suggest message)${r.reset}
  ${r.cyan}/diff${r.reset}             ${r.dim}Show current diff summary${r.reset}
  ${r.cyan}/branch [name]${r.reset}   ${r.dim}Create feature branch${r.reset}

${r.bold}${r.cyan}Extensibility:${r.reset}
  ${r.cyan}/mcp${r.reset}              ${r.dim}Show MCP servers and tools${r.reset}
  ${r.cyan}/mcp connect${r.reset}      ${r.dim}Connect all configured MCP servers${r.reset}
  ${r.cyan}/hooks${r.reset}            ${r.dim}Show configured hooks${r.reset}
  ${r.cyan}/skills${r.reset}           ${r.dim}List loaded skills${r.reset}
  ${r.cyan}/skills enable${r.reset}    ${r.dim}Enable a skill by name${r.reset}
  ${r.cyan}/skills disable${r.reset}   ${r.dim}Disable a skill by name${r.reset}

${r.bold}${r.cyan}Tasks:${r.reset}
  ${r.cyan}/tasks${r.reset}            ${r.dim}Show current task list${r.reset}
  ${r.cyan}/tasks clear${r.reset}      ${r.dim}Clear all tasks${r.reset}

${r.bold}${r.cyan}Undo / Redo:${r.reset}
  ${r.cyan}/undo${r.reset}             ${r.dim}Undo last file change${r.reset}
  ${r.cyan}/redo${r.reset}             ${r.dim}Redo last undone change${r.reset}
  ${r.cyan}/history${r.reset}          ${r.dim}Show file change history${r.reset}

  ${r.cyan}/exit${r.reset}             ${r.dim}Quit${r.reset}
`);
}
function Md(e) {
  let n = Math.round((e / 100) * 30),
    s = 30 - n;
  return `  ${e > 80 ? r.red : e > 50 ? r.yellow : r.green}${"\u2588".repeat(n)}${r.dim}${"\u2591".repeat(s)}${r.reset} ${e}%`;
}
function Zi() {
  let e = ea(),
    t = St(),
    n = _t();
  console.log(`
${r.bold}${r.cyan}Providers:${r.reset}`);
  for (let s of e) {
    let o = s.provider === t,
      i = s.configured
        ? `${r.green}\u2713${r.reset}`
        : `${r.red}\u2717${r.reset}`,
      a = o ? ` ${r.cyan}(active)${r.reset}` : "";
    console.log(`  ${i} ${r.bold}${s.provider}${r.reset}${a}`);
    for (let c of s.models) {
      let p = c.id === n.id && o ? ` ${r.yellow}\u25C4${r.reset}` : "";
      console.log(`    ${r.dim}${c.id}${r.reset} \u2014 ${c.name}${p}`);
    }
  }
  console.log();
}
async function Fd(e, t) {
  let [n, ...s] = e.split(/\s+/);
  switch (n) {
    case "/help":
      return (qd(), !0);
    case "/model": {
      let o = s.join(" ").trim();
      if (!o) {
        if (t) await g0(t);
        else {
          let i = _t(),
            a = St();
          (console.log(
            `${r.bold}${r.cyan}Active model:${r.reset} ${r.dim}${a}:${i.id} (${i.name})${r.reset}`,
          ),
            console.log(
              `${r.gray}Use /model <provider:model> to switch. /providers to see all.${r.reset}`,
            ));
        }
        return !0;
      }
      if (o === "list") return (Zi(), !0);
      if (Rd(o)) {
        let i = _t(),
          a = St();
        console.log(`${r.green}Switched to ${a}:${i.id} (${i.name})${r.reset}`);
      } else
        (console.log(`${r.red}Unknown model: ${o}${r.reset}`),
          console.log(
            `${r.gray}Use /providers to see available models${r.reset}`,
          ));
      return !0;
    }
    case "/providers":
      return (Zi(), !0);
    case "/fallback": {
      let o = s.join(" ").trim();
      if (!o) {
        let a = Ew();
        return (
          a.length === 0
            ? (console.log(`${r.dim}No fallback chain configured${r.reset}`),
              console.log(
                `${r.dim}Use /fallback anthropic,openai,local to set${r.reset}`,
              ))
            : console.log(
                `${r.bold}${r.cyan}Fallback chain:${r.reset} ${a.join(" \u2192 ")}`,
              ),
          !0
        );
      }
      let i = o
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      return (
        Sw(i),
        console.log(
          `${r.green}Fallback chain: ${i.join(" \u2192 ")}${r.reset}`,
        ),
        !0
      );
    }
    case "/tokens": {
      let o = xd(),
        i = Aw(o, Ow),
        a = _t(),
        c = St();
      (console.log(`
${r.bold}${r.cyan}Token Usage:${r.reset}`),
        console.log(
          `  ${r.dim}Model:${r.reset} ${c}:${a.id} (${(i.limit / 1e3).toFixed(0)}k context)`,
        ),
        console.log(
          `  ${r.dim}Used:${r.reset}  ${i.used.toLocaleString()} / ${i.limit.toLocaleString()} (${i.percentage}%)`,
        ));
      let p = Md(i.percentage);
      return (
        console.log(`  ${p}`),
        console.log(`
  ${r.dim}Breakdown:${r.reset}`),
        console.log(
          `    System prompt:    ${i.breakdown.system.toLocaleString()} tokens`,
        ),
        console.log(
          `    Conversation:     ${i.breakdown.conversation.toLocaleString()} tokens`,
        ),
        console.log(
          `    Tool results:     ${i.breakdown.toolResults.toLocaleString()} tokens`,
        ),
        console.log(
          `    Tool definitions: ${i.breakdown.toolDefinitions.toLocaleString()} tokens`,
        ),
        console.log(`    Messages:         ${i.messageCount}`),
        console.log(),
        !0
      );
    }
    case "/costs":
      return s.join(" ").trim() === "reset"
        ? (i0(), console.log(`${r.green}Cost tracking reset${r.reset}`), !0)
        : (console.log(`
${o0()}
`),
          !0);
    case "/budget": {
      let o = s[0];
      if (!o) {
        let c = c0(),
          p = ea();
        console.log(`
${r.bold}${r.cyan}Cost Limits:${r.reset}`);
        let u = !1;
        for (let l of p) {
          let d = p0(l.provider),
            m = c[l.provider];
          if (m !== void 0) {
            u = !0;
            let h = Math.min(100, Math.round((d / m) * 100)),
              f = 10,
              x = Math.round((h / 100) * f),
              b = f - x,
              $ = `${h >= 100 ? r.red : h >= 80 ? r.yellow : r.green}${"\u2588".repeat(x)}${r.dim}${"\u2591".repeat(b)}${r.reset}`;
            console.log(
              `  ${r.bold}${l.provider}:${r.reset}  $${d.toFixed(2)} / $${m.toFixed(2)}  (${h}%)  ${$}`,
            );
          } else
            l.provider === "ollama" || l.provider === "local"
              ? console.log(
                  `  ${r.bold}${l.provider}:${r.reset}  ${r.dim}free (no limit)${r.reset}`,
                )
              : d > 0 &&
                console.log(
                  `  ${r.bold}${l.provider}:${r.reset}  $${d.toFixed(2)} ${r.dim}(no limit)${r.reset}`,
                );
        }
        return (
          u ||
            console.log(
              `  ${r.dim}No limits set. Use /budget <provider> <amount> to set one.${r.reset}`,
            ),
          console.log(),
          !0
        );
      }
      let i = s[1];
      if (!i) {
        let c = l0(o);
        return (
          c.limit !== null
            ? console.log(
                `${r.bold}${o}:${r.reset} $${c.spent.toFixed(2)} / $${c.limit.toFixed(2)} ($${c.remaining.toFixed(2)} remaining)`,
              )
            : console.log(
                `${r.bold}${o}:${r.reset} $${c.spent.toFixed(2)} ${r.dim}(no limit)${r.reset}`,
              ),
          !0
        );
      }
      if (i === "off" || i === "remove" || i === "clear")
        return (
          r0(o),
          Td(),
          console.log(`${r.green}Removed cost limit for ${o}${r.reset}`),
          !0
        );
      let a = parseFloat(i);
      return isNaN(a) || a <= 0
        ? (console.log(
            `${r.red}Invalid amount: ${i}. Use a positive number or 'off'.${r.reset}`,
          ),
          !0)
        : (a0(o, a),
          Td(),
          console.log(
            `${r.green}Set ${o} budget limit: $${a.toFixed(2)}${r.reset}`,
          ),
          !0);
    }
    case "/clear":
      return (
        kw(),
        s0(),
        console.log(`${r.green}Conversation cleared${r.reset}`),
        !0
      );
    case "/context":
      return (await Cd(Is), !0);
    case "/autoconfirm": {
      let o = !Ad();
      return (
        Rw(o),
        console.log(`${r.green}Auto-confirm: ${o ? "ON" : "OFF"}${r.reset}`),
        o &&
          console.log(
            `${r.yellow}  \u26A0 File changes will be applied without confirmation${r.reset}`,
          ),
        !0
      );
    }
    case "/save": {
      let o = s.join(" ").trim() || `session-${Date.now()}`,
        i = xd();
      if (i.length === 0)
        return (
          console.log(`${r.yellow}No conversation to save${r.reset}`),
          !0
        );
      let a = _t(),
        c = St();
      return (
        jw(o, i, { model: a.id, provider: c }),
        console.log(
          `${r.green}Session saved: ${o} (${i.length} messages)${r.reset}`,
        ),
        !0
      );
    }
    case "/load": {
      let o = s.join(" ").trim();
      if (!o) return (console.log(`${r.red}Usage: /load <name>${r.reset}`), !0);
      let i = Pw(o);
      return i
        ? (bd(i.messages),
          console.log(
            `${r.green}Loaded session: ${i.name} (${i.messageCount} messages)${r.reset}`,
          ),
          !0)
        : (console.log(`${r.red}Session not found: ${o}${r.reset}`), !0);
    }
    case "/sessions": {
      let o = Nw();
      if (o.length === 0)
        return (console.log(`${r.dim}No saved sessions${r.reset}`), !0);
      console.log(`
${r.bold}${r.cyan}Sessions:${r.reset}`);
      for (let i of o) {
        let a = i.updatedAt ? new Date(i.updatedAt).toLocaleString() : "?",
          c = i.name === "_autosave" ? ` ${r.dim}(auto)${r.reset}` : "";
        console.log(
          `  ${r.cyan}${i.name}${r.reset}${c} \u2014 ${i.messageCount} msgs, ${a}`,
        );
      }
      return (console.log(), !0);
    }
    case "/resume": {
      let o = Lw();
      return o
        ? (bd(o.messages),
          console.log(
            `${r.green}Resumed: ${o.name} (${o.messageCount} messages)${r.reset}`,
          ),
          !0)
        : (console.log(`${r.yellow}No session to resume${r.reset}`), !0);
    }
    case "/remember": {
      let o = s.join(" ").trim();
      if (!o)
        return (
          console.log(
            `${r.red}Usage: /remember <key>=<value> or /remember <text>${r.reset}`,
          ),
          !0
        );
      let i = o.indexOf("="),
        a,
        c;
      return (
        i > 0
          ? ((a = o.substring(0, i).trim()), (c = o.substring(i + 1).trim()))
          : ((a = o.substring(0, 40).replace(/\s+/g, "-")), (c = o)),
        qw(a, c),
        console.log(`${r.green}Remembered: ${a}${r.reset}`),
        !0
      );
    }
    case "/forget": {
      let o = s.join(" ").trim();
      return o
        ? (Mw(o)
            ? console.log(`${r.green}Forgotten: ${o}${r.reset}`)
            : console.log(`${r.red}Memory not found: ${o}${r.reset}`),
          !0)
        : (console.log(`${r.red}Usage: /forget <key>${r.reset}`), !0);
    }
    case "/memory": {
      let o = Fw();
      if (o.length === 0)
        return (console.log(`${r.dim}No memories saved${r.reset}`), !0);
      console.log(`
${r.bold}${r.cyan}Memory:${r.reset}`);
      for (let i of o)
        console.log(`  ${r.cyan}${i.key}${r.reset} = ${i.value}`);
      return (console.log(), !0);
    }
    case "/plan": {
      let o = s.join(" ").trim();
      if (o === "status") {
        let i = Dw();
        return (console.log(Ww(i)), !0);
      }
      return o === "approve"
        ? (Bw()
            ? (console.log(
                `${r.green}Plan approved! Starting execution...${r.reset}`,
              ),
              zw(),
              $d(!1))
            : console.log(`${r.red}No plan to approve${r.reset}`),
          !0)
        : ($d(!0),
          console.log(`${r.cyan}${r.bold}Plan mode activated${r.reset}`),
          console.log(
            `${r.dim}Analysis only \u2014 no file changes until approved${r.reset}`,
          ),
          o && console.log(`${r.dim}Task: ${o}${r.reset}`),
          !0);
    }
    case "/plans": {
      let o = Hw();
      if (o.length === 0)
        return (console.log(`${r.dim}No saved plans${r.reset}`), !0);
      console.log(`
${r.bold}${r.cyan}Plans:${r.reset}`);
      for (let i of o) {
        let a =
          i.status === "completed"
            ? `${r.green}\u2713`
            : i.status === "executing"
              ? `${r.blue}\u2192`
              : `${r.dim}\u25CB`;
        console.log(
          `  ${a} ${r.reset}${r.bold}${i.name}${r.reset} \u2014 ${i.task || "?"} (${i.steps} steps, ${i.status})`,
        );
      }
      return (console.log(), !0);
    }
    case "/auto": {
      let o = s.join(" ").trim();
      return o
        ? (Gw(o)
            ? console.log(`${r.green}Autonomy: ${o}${r.reset}`)
            : console.log(
                `${r.red}Unknown level: ${o}. Use: ${wd.join(", ")}${r.reset}`,
              ),
          !0)
        : (console.log(`${r.bold}${r.cyan}Autonomy:${r.reset} ${Od()}`),
          console.log(`${r.dim}Levels: ${wd.join(", ")}${r.reset}`),
          !0);
    }
    case "/permissions": {
      let o = Iw();
      console.log(`
${r.bold}${r.cyan}Tool Permissions:${r.reset}`);
      for (let i of o) {
        let a =
          i.mode === "allow"
            ? `${r.green}\u2713`
            : i.mode === "deny"
              ? `${r.red}\u2717`
              : `${r.yellow}?`;
        console.log(
          `  ${a} ${r.reset}${r.bold}${i.tool}${r.reset} ${r.dim}(${i.mode})${r.reset}`,
        );
      }
      return (
        console.log(`
${r.dim}Use /allow <tool> or /deny <tool> to change${r.reset}
`),
        !0
      );
    }
    case "/allow": {
      let o = s.join(" ").trim();
      return o
        ? (vd(o, "allow"),
          yd(),
          console.log(`${r.green}${o}: allow${r.reset}`),
          !0)
        : (console.log(`${r.red}Usage: /allow <tool>${r.reset}`), !0);
    }
    case "/deny": {
      let o = s.join(" ").trim();
      return o
        ? (vd(o, "deny"), yd(), console.log(`${r.red}${o}: deny${r.reset}`), !0)
        : (console.log(`${r.red}Usage: /deny <tool>${r.reset}`), !0);
    }
    case "/commit": {
      if (!Qi())
        return (console.log(`${r.red}Not a git repository${r.reset}`), !0);
      let o = s.join(" ").trim();
      if (o) {
        let u = await _d(o);
        return (
          console.log(
            u
              ? `${r.green}Committed: ${u} \u2014 ${o}${r.reset}`
              : `${r.red}Commit failed${r.reset}`,
          ),
          !0
        );
      }
      if (!Jw())
        return (console.log(`${r.yellow}No changes to commit${r.reset}`), !0);
      let a = await kd();
      if ((console.log(a), !(await confirm("  Commit changes?")))) return !0;
      let p = await _d("nex-code update");
      return (
        p && console.log(`${r.green}  \u2713 Committed: ${p}${r.reset}`),
        !0
      );
    }
    case "/diff":
      return Qi()
        ? (console.log(kd()), !0)
        : (console.log(`${r.red}Not a git repository${r.reset}`), !0);
    case "/branch": {
      if (!Qi())
        return (console.log(`${r.red}Not a git repository${r.reset}`), !0);
      let o = s.join(" ").trim();
      if (!o) {
        let a = Kw();
        return (
          console.log(
            `${r.bold}${r.cyan}Branch:${r.reset} ${a || "(detached)"}`,
          ),
          !0
        );
      }
      let i = Vw(o);
      return (
        console.log(
          i
            ? `${r.green}Created and switched to: ${i}${r.reset}`
            : `${r.red}Failed to create branch${r.reset}`,
        ),
        !0
      );
    }
    case "/mcp": {
      let o = s.join(" ").trim();
      if (o === "connect")
        return (
          console.log(`${r.dim}Connecting MCP servers...${r.reset}`),
          Xw()
            .then((a) => {
              for (let c of a)
                c.error
                  ? console.log(
                      `  ${r.red}\u2717${r.reset} ${c.name}: ${c.error}`,
                    )
                  : console.log(
                      `  ${r.green}\u2713${r.reset} ${c.name}: ${c.tools} tools`,
                    );
              a.length === 0 &&
                console.log(
                  `${r.dim}No MCP servers configured in .nex/config.json${r.reset}`,
                );
            })
            .catch((a) => {
              console.log(
                `${r.red}MCP connection error: ${a.message}${r.reset}`,
              );
            }),
          !0
        );
      if (o === "disconnect")
        return (
          Qw(),
          console.log(`${r.green}All MCP servers disconnected${r.reset}`),
          !0
        );
      let i = Yw();
      if (i.length === 0)
        return (
          console.log(`${r.dim}No MCP servers configured${r.reset}`),
          console.log(
            `${r.dim}Add servers to .nex/config.json under "mcpServers"${r.reset}`,
          ),
          !0
        );
      console.log(`
${r.bold}${r.cyan}MCP Servers:${r.reset}`);
      for (let a of i) {
        let c = a.connected
          ? `${r.green}\u2713 connected${r.reset}`
          : `${r.dim}\u25CB disconnected${r.reset}`;
        console.log(
          `  ${c} ${r.bold}${a.name}${r.reset} (${a.command}) \u2014 ${a.toolCount} tools`,
        );
      }
      return (
        console.log(`
${r.dim}Use /mcp connect to connect all servers${r.reset}
`),
        !0
      );
    }
    case "/hooks": {
      let o = Zw();
      if (o.length === 0)
        return (
          console.log(`${r.dim}No hooks configured${r.reset}`),
          console.log(
            `${r.dim}Add hooks to .nex/config.json or .nex/hooks/${r.reset}`,
          ),
          !0
        );
      console.log(`
${r.bold}${r.cyan}Hooks:${r.reset}`);
      for (let i of o) {
        console.log(`  ${r.cyan}${i.event}${r.reset}`);
        for (let a of i.commands)
          console.log(`    ${r.dim}\u2192 ${a}${r.reset}`);
      }
      return (console.log(), !0);
    }
    case "/skills": {
      let o = s.join(" ").trim();
      if (o.startsWith("enable ")) {
        let a = o.substring(7).trim();
        return (
          m0(a)
            ? console.log(`${r.green}Skill enabled: ${a}${r.reset}`)
            : console.log(`${r.red}Skill not found: ${a}${r.reset}`),
          !0
        );
      }
      if (o.startsWith("disable ")) {
        let a = o.substring(8).trim();
        return (
          f0(a)
            ? console.log(`${r.yellow}Skill disabled: ${a}${r.reset}`)
            : console.log(`${r.red}Skill not found: ${a}${r.reset}`),
          !0
        );
      }
      let i = d0();
      if (i.length === 0)
        return (
          console.log(`${r.dim}No skills loaded${r.reset}`),
          console.log(`${r.dim}Add .md or .js files to .nex/skills/${r.reset}`),
          !0
        );
      console.log(`
${r.bold}${r.cyan}Skills:${r.reset}`);
      for (let a of i) {
        let c = a.enabled
            ? `${r.green}\u2713${r.reset}`
            : `${r.red}\u2717${r.reset}`,
          p =
            a.type === "prompt"
              ? `${r.dim}(prompt)${r.reset}`
              : `${r.dim}(script)${r.reset}`,
          u = [];
        (a.commands > 0 && u.push(`${a.commands} cmd`),
          a.tools > 0 && u.push(`${a.tools} tools`));
        let l = u.length > 0 ? ` \u2014 ${u.join(", ")}` : "";
        console.log(`  ${c} ${r.bold}${a.name}${r.reset} ${p}${l}`);
      }
      return (
        console.log(`
${r.dim}Use /skills enable <name> or /skills disable <name>${r.reset}
`),
        !0
      );
    }
    case "/tasks": {
      let { renderTaskList: o, clearTasks: i } = ys();
      return s.join(" ").trim() === "clear"
        ? (i(), console.log(`${r.green}Tasks cleared${r.reset}`), !0)
        : (console.log(
            `
` +
              o() +
              `
`,
          ),
          !0);
    }
    case "/undo": {
      let o = e0();
      if (!o) return (console.log(`${r.yellow}Nothing to undo${r.reset}`), !0);
      o.wasCreated
        ? console.log(
            `${r.green}Undone: deleted ${o.filePath} (was created by ${o.tool})${r.reset}`,
          )
        : console.log(
            `${r.green}Undone: restored ${o.filePath} (${o.tool})${r.reset}`,
          );
      let i = Sd();
      return (
        i > 0 && console.log(`${r.dim}${i} more change(s) to undo${r.reset}`),
        !0
      );
    }
    case "/redo": {
      let o = t0();
      if (!o) return (console.log(`${r.yellow}Nothing to redo${r.reset}`), !0);
      console.log(`${r.green}Redone: ${o.filePath} (${o.tool})${r.reset}`);
      let i = Ed();
      return (
        i > 0 && console.log(`${r.dim}${i} more change(s) to redo${r.reset}`),
        !0
      );
    }
    case "/history": {
      let o = n0(20);
      if (o.length === 0)
        return (
          console.log(`${r.dim}No file changes in this session${r.reset}`),
          !0
        );
      console.log(`
${r.bold}${r.cyan}File Change History:${r.reset}`);
      for (let i of o) {
        let a = new Date(i.timestamp).toLocaleTimeString();
        console.log(
          `  ${r.dim}${a}${r.reset} ${r.yellow}${i.tool}${r.reset} ${i.filePath}`,
        );
      }
      return (
        console.log(`
${r.dim}${Sd()} undo / ${Ed()} redo available${r.reset}
`),
        !0
      );
    }
    case "/exit":
    case "/quit":
      (console.log(`
${r.gray}Bye!${r.reset}`),
        process.exit(0));
    default:
      return (
        h0(e) ||
          console.log(`${r.red}Unknown command: ${n}. Type /help${r.reset}`),
        !0
      );
  }
}
var na = 1e3;
function sa() {
  return He.join(process.cwd(), ".nex", "repl_history");
}
function Id() {
  try {
    let e = sa();
    if (it.existsSync(e))
      return it
        .readFileSync(e, "utf-8")
        .split(
          `
`,
        )
        .filter(Boolean)
        .slice(-na);
  } catch {}
  return [];
}
function Fs(e) {
  try {
    let t = sa(),
      n = He.dirname(t);
    (it.existsSync(n) || it.mkdirSync(n, { recursive: !0 }),
      it.appendFileSync(
        t,
        e +
          `
`,
      ));
  } catch {}
}
function We() {
  let e = [];
  Uw() && e.push("plan");
  let t = Od();
  t !== "interactive" && e.push(t);
  let n = St(),
    s = _t();
  return (
    e.push(`${n}:${s.id}`),
    `${e.length > 0 ? `${r.dim}[${e.join(" \xB7 ")}]${r.reset} ` : ""}${r.bold}${r.cyan}>${r.reset} `
  );
}
var oa = "\x1B[200~",
  ia = "\x1B[201~";
function x0(e) {
  return typeof e == "string" && e.includes(oa);
}
function b0(e) {
  return typeof e == "string" && e.includes(ia);
}
function Rn(e) {
  return typeof e != "string" ? e : e.split(oa).join("").split(ia).join("");
}
function v0() {
  if ((_w(jd), !ea().some((v) => v.configured))) {
    let v = Tw("local"),
      $ = !1;
    if (v)
      try {
        let { execSync: T } = require("child_process");
        (T("curl -s --max-time 2 http://localhost:11434/api/tags", {
          encoding: "utf-8",
          stdio: "pipe",
        }),
          Rd("local:llama3"),
          console.log(
            `${r.green}\u2713 Local Ollama detected \u2014 using local models${r.reset}`,
          ),
          console.log(`${r.dim}Tip: Set API keys for cloud providers for more model options (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)${r.reset}
`),
          ($ = !0));
      } catch {}
    $ ||
      (console.error(`
${r.red}\u2717 No provider configured and no local Ollama detected.${r.reset}
`),
      console.error(`${r.white}nex-code needs at least one LLM provider to work.${r.reset}
`),
      console.error(
        `${r.white}Option 1 \u2014 Free local models (no API key needed):${r.reset}`,
      ),
      console.error(
        `${r.gray}  Install Ollama:  ${r.cyan}https://ollama.com/download${r.reset}`,
      ),
      console.error(
        `${r.gray}  Pull a model:    ${r.cyan}ollama pull qwen3-coder${r.reset}`,
      ),
      console.error(`${r.gray}  Then restart:    ${r.cyan}nex-code${r.reset}
`),
      console.error(
        `${r.white}Option 2 \u2014 Cloud providers (set one in .env or as env var):${r.reset}`,
      ),
      console.error(
        `${r.gray}  OLLAMA_API_KEY=...     ${r.dim}# Ollama Cloud (free tier available)${r.reset}`,
      ),
      console.error(
        `${r.gray}  OPENAI_API_KEY=...     ${r.dim}# OpenAI${r.reset}`,
      ),
      console.error(
        `${r.gray}  ANTHROPIC_API_KEY=...  ${r.dim}# Anthropic${r.reset}`,
      ),
      console.error(`${r.gray}  GEMINI_API_KEY=...     ${r.dim}# Google Gemini${r.reset}
`),
      console.error(
        `${r.dim}Create a .env file in your project directory or export the variable.${r.reset}`,
      ),
      process.exit(1));
  }
  u0();
  let n = _t(),
    s = St();
  ($w(`${s}:${n.id}`, Is, { yolo: Ad() }), Cd(Is));
  let o = Id(),
    i = yw.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: We(),
      completer: Ld,
      history: o,
      historySize: na,
    });
  Cw(i);
  let a = !1,
    c = 0;
  process.on("SIGINT", () => {
    if ((ww(), a)) {
      (c++,
        c >= 3 &&
          (process.stdin.isTTY && process.stdout.write("\x1B[?2004l"),
          console.log(`
${r.gray}Bye!${r.reset}`),
          process.exit(0)),
        Xe && Xe.abort(),
        console.log(`
${r.yellow}  Cancelled${r.reset}`),
        (a = !1),
        i.setPrompt(We()),
        i.prompt());
      return;
    }
    (process.stdin.isTTY && process.stdout.write("\x1B[?2004l"),
      console.log(`
${r.gray}Bye!${r.reset}`),
      process.exit(0));
  });
  let p = !1,
    u = [],
    l = null;
  function d() {
    let v = u
      .join(
        `
`,
      )
      .trim();
    if (((u = []), (p = !1), !v)) return !0;
    l = v;
    let $ = v.split(`
`),
      T = $.length,
      w = $[0].length > 80 ? $[0].substring(0, 77) + "..." : $[0],
      R = T > 1 ? `[Pasted content \u2014 ${T} lines]` : "[Pasted content]";
    return (
      console.log(`
${r.dim}  ${R}${r.reset}`),
      console.log(`${r.dim}  \u23BF  ${w}${r.reset}`),
      T > 1 &&
        console.log(`${r.dim}  \u23BF  \u2026 +${T - 1} more lines${r.reset}`),
      console.log(`${r.dim}  Press Enter to send${r.reset}`),
      !0
    );
  }
  if (process.stdin.isTTY) {
    process.stdout.write("\x1B[?2004h");
    let v = process.stdin.emit.bind(process.stdin);
    process.stdin.emit = function ($, ...T) {
      if ($ !== "data") return v.call(process.stdin, $, ...T);
      let w = T[0];
      if (
        (Buffer.isBuffer(w) && (w = w.toString("utf8")), typeof w != "string")
      )
        return v.call(process.stdin, $, ...T);
      let R = w.includes(oa),
        S = w.includes(ia);
      if (R && S) {
        let E = Rn(w);
        return (
          E &&
            u.push(
              ...E.split(`
`),
            ),
          d()
        );
      }
      if (R) {
        ((p = !0), (u = []));
        let E = Rn(w);
        return (
          E &&
            u.push(
              ...E.split(`
`),
            ),
          !0
        );
      }
      if (S) {
        let E = Rn(w);
        return (
          E &&
            u.push(
              ...E.split(`
`),
            ),
          d()
        );
      }
      if (p) {
        let E = Rn(w);
        return (
          E &&
            u.push(
              ...E.split(`
`),
            ),
          !0
        );
      }
      return v.call(process.stdin, $, ...T);
    };
  }
  let m = 0;
  function h() {
    if (m > 0) {
      let v = "";
      for (let $ = 0; $ < m; $++) v += "\x1B[1B\x1B[2K";
      ((v += `\x1B[${m}A`), process.stdout.write(v), (m = 0));
    }
  }
  function f(v) {
    let $ = [...Ds, ...ta()].filter((C) => C.cmd.startsWith(v));
    if (!$.length || ($.length === 1 && $[0].cmd === v)) return;
    let T = 10,
      w = $.slice(0, T),
      R = Math.max(...w.map((C) => C.cmd.length)),
      S = "";
    for (let { cmd: C, desc: M } of w) {
      let F = C.substring(0, v.length),
        B = C.substring(v.length),
        W = " ".repeat(Math.max(0, R - C.length + 2));
      S += `
\x1B[2K  ${r.cyan}${F}${r.reset}${r.dim}${B}${W}${M}${r.reset}`;
    }
    ((m = w.length),
      $.length > T &&
        ((S += `
\x1B[2K  ${r.dim}\u2026 +${$.length - T} more${r.reset}`),
        m++));
    let E = i._prompt.replace(/\x1b\[[0-9;]*m/g, "").length;
    ((S += `\x1B[${m}A\x1B[${E + i.cursor + 1}G`), process.stdout.write(S));
  }
  process.stdin.isTTY &&
    process.stdin.on("keypress", (v, $) => {
      (h(),
        !($ && ($.name === "tab" || $.name === "return")) &&
          setImmediate(() => {
            i.line && i.line.startsWith("/") && f(i.line);
          }));
    });
  let x = null,
    b = `${r.dim}...${r.reset} `;
  (i.setPrompt(We()),
    i.prompt(),
    i.on("line", async (v) => {
      if ((h(), a)) {
        l = null;
        return;
      }
      if ((l !== null && ((v = l), (l = null)), x !== null)) {
        if (x._mode === "triple") {
          if (v.trim() === '"""') {
            let w = x
              .join(
                `
`,
              )
              .trim();
            if (((x = null), w)) {
              (Fs(w.replace(/\n/g, "\\n")),
                (a = !0),
                (c = 0),
                (Xe = new AbortController()));
              try {
                await Yi(w);
              } catch (S) {
                if (!Xe?.signal?.aborted) {
                  let E =
                    S.message?.split(`
`)[0] || "An unexpected error occurred";
                  console.log(`${r.red}Error: ${E}${r.reset}`);
                }
              }
              a = !1;
              let R = Xi();
              R > 0 &&
                process.stdout.write(`${r.gray}[${R} messages] ${r.reset}`);
            }
            (i.setPrompt(We()), i.prompt());
            return;
          }
          (x.push(v), i.setPrompt(b), i.prompt());
          return;
        }
        if (v.endsWith("\\")) x.push(v.slice(0, -1));
        else {
          x.push(v);
          let w = x
            .join(
              `
`,
            )
            .trim();
          if (((x = null), w)) {
            (Fs(w.replace(/\n/g, "\\n")),
              (a = !0),
              (c = 0),
              (Xe = new AbortController()));
            try {
              await Yi(w);
            } catch (S) {
              if (!Xe?.signal?.aborted) {
                let E =
                  S.message?.split(`
`)[0] || "An unexpected error occurred";
                console.log(`${r.red}Error: ${E}${r.reset}`);
              }
            }
            a = !1;
            let R = Xi();
            R > 0 &&
              process.stdout.write(`${r.gray}[${R} messages] ${r.reset}`);
          }
          (i.setPrompt(We()), i.prompt());
          return;
        }
        (i.setPrompt(b), i.prompt());
        return;
      }
      if (v.trim() === '"""' || v.trim().startsWith('"""')) {
        let w = v.trim().substring(3);
        ((x = w ? [w] : []), (x._mode = "triple"), i.setPrompt(b), i.prompt());
        return;
      }
      if (v.endsWith("\\")) {
        ((x = [v.slice(0, -1)]),
          (x._mode = "backslash"),
          i.setPrompt(b),
          i.prompt());
        return;
      }
      let $ = v.trim();
      if (!$) {
        (i.setPrompt(We()), i.prompt());
        return;
      }
      if ((Fs($), $ === "/")) {
        (Pd(), i.setPrompt(We()), i.prompt());
        return;
      }
      if ($.startsWith("/")) {
        (await Fd($, i), i.setPrompt(We()), i.prompt());
        return;
      }
      ((a = !0), (c = 0), (Xe = new AbortController()));
      try {
        await Yi($);
      } catch (w) {
        if (!Xe?.signal?.aborted) {
          let R =
            w.message?.split(`
`)[0] || "An unexpected error occurred";
          console.log(`${r.red}Error: ${R}${r.reset}`);
        }
      }
      a = !1;
      let T = Xi();
      (T > 0 && process.stdout.write(`${r.gray}[${T} messages] ${r.reset}`),
        i.setPrompt(We()),
        i.prompt());
    }),
    i.on("close", () => {
      (process.stdin.isTTY && process.stdout.write("\x1B[?2004l"),
        console.log(`
${r.gray}Bye!${r.reset}`),
        process.exit(0));
    }));
}
module.exports = {
  startREPL: v0,
  getPrompt: We,
  loadHistory: Id,
  appendHistory: Fs,
  getHistoryPath: sa,
  HISTORY_MAX: na,
  showCommandList: Pd,
  completer: Ld,
  completeFilePath: Nd,
  handleSlashCommand: Fd,
  showProviders: Zi,
  showHelp: qd,
  renderBar: Md,
  hasPasteStart: x0,
  hasPasteEnd: b0,
  stripPasteSequences: Rn,
  getAbortSignal: jd,
};
/*! Bundled license information:

mime-db/index.js:
  (*!
   * mime-db
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015-2022 Douglas Christopher Wilson
   * MIT Licensed
   *)

mime-types/index.js:
  (*!
   * mime-types
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   *)

axios/dist/node/axios.cjs:
  (*! Axios v1.13.5 Copyright (c) 2026 Matt Zabriskie and contributors *)
*/

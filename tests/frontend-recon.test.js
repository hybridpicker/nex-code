/**
 * tests/frontend-recon.test.js — frontend_recon tool
 *
 * Mocks child_process.exec (same pattern as k8s-tools.test.js) and writes
 * real files to a tmpDir for fs.readFile / fs.access calls.
 * process.cwd() is mocked to point at tmpDir so resolvePath scopes correctly.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── Mock exec (promisify.custom pattern) ─────────────────────
const mockExec = jest.fn();
jest.mock("child_process", () => ({
  ...jest.requireActual("child_process"),
  exec: (cmd, opts, cb) => {
    const resolve = typeof opts === "function" ? opts : cb;
    mockExec(cmd, opts, resolve);
  },
  spawnSync: jest.fn().mockReturnValue({ status: 0, error: null }),
}));

// ─── Standard tool mocks ──────────────────────────────────────
jest.mock("../cli/safety", () => ({
  isForbidden: jest.fn().mockReturnValue(null),
  isDangerous: jest.fn().mockReturnValue(false),
  isCritical: jest.fn().mockReturnValue(false),
  confirm: jest.fn().mockResolvedValue(true),
  getAutoConfirm: jest.fn().mockReturnValue(true),
  setAutoConfirm: jest.fn(),
}));

jest.mock("../cli/file-history", () => ({ recordChange: jest.fn() }));

jest.mock("../cli/diff", () => ({
  showDiff: jest.fn(),
  showNewFile: jest.fn(),
  showEditDiff: jest.fn(),
  confirmFileChange: jest.fn().mockResolvedValue(true),
}));

// ─── Setup ────────────────────────────────────────────────────
let tmpDir;
let cwdSpy;

const { executeTool, TOOL_DEFINITIONS } = require("../cli/tools");

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-frontend-recon-"));
  cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
  mockExec.mockReset();
  // Default: exec returns empty (no files found) unless overridden
  mockExec.mockImplementation((cmd, opts, cb) => {
    const resolve = typeof opts === "function" ? opts : cb;
    resolve(null, { stdout: "", stderr: "" });
  });
});

afterEach(() => {
  cwdSpy.mockRestore();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Helpers ─────────────────────────────────────────────────

/** Write a fixture file into tmpDir. */
function write(relPath, content) {
  const abs = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  return abs;
}

/**
 * Make exec return a file path for find/grep calls that match a keyword.
 * All other exec calls return empty.
 */
function mockFind(keyword, filePath) {
  mockExec.mockImplementation((cmd, opts, cb) => {
    const resolve = typeof opts === "function" ? opts : cb;
    const stdout = cmd.includes(keyword) ? filePath + "\n" : "";
    resolve(null, { stdout, stderr: "" });
  });
}

// ─── Tool registration ────────────────────────────────────────

describe("frontend_recon — registration", () => {
  it("is present in TOOL_DEFINITIONS", () => {
    const tool = TOOL_DEFINITIONS.find(
      (t) => t.function.name === "frontend_recon",
    );
    expect(tool).toBeDefined();
  });

  it("description includes MANDATORY keyword so LLM treats it as required", () => {
    const tool = TOOL_DEFINITIONS.find(
      (t) => t.function.name === "frontend_recon",
    );
    expect(tool.function.description).toMatch(/MANDATORY/);
  });

  it("type parameter is optional (required array is empty)", () => {
    const tool = TOOL_DEFINITIONS.find(
      (t) => t.function.name === "frontend_recon",
    );
    expect(tool.function.parameters.required).toEqual([]);
  });
});

// ─── Step 1: Design Tokens ────────────────────────────────────

describe("frontend_recon — Step 1: Design Tokens", () => {
  it("reports tailwind.config.js content", async () => {
    const cfgPath = write(
      "tailwind.config.js",
      [
        "module.exports = {",
        "  theme: { extend: { colors: { primary: '#3b82f6', accent: '#f59e0b' } } }",
        "}",
      ].join("\n"),
    );
    mockFind("tailwind.config", cfgPath);

    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("tailwind.config");
    expect(result).toContain("primary");
  });

  it("finds :root variables in variables.css", async () => {
    const cssPath = write(
      "variables.css",
      [
        ":root {",
        "  --color-primary: #3b82f6;",
        "  --color-accent: #f59e0b;",
        "}",
      ].join("\n"),
    );
    mockFind("variables.css", cssPath);

    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("CSS Variables");
    expect(result).toContain("--color-primary");
  });

  it("falls back to grep for :root when named file absent", async () => {
    const cssPath = write(
      "static/css/base.css",
      ":root {\n  --primary: #1a1a2e;\n}",
    );
    // No named file found, but grep for ':root' returns it
    mockExec.mockImplementation((cmd, opts, cb) => {
      const resolve = typeof opts === "function" ? opts : cb;
      const stdout = cmd.includes(":root") ? cssPath + "\n" : "";
      resolve(null, { stdout, stderr: "" });
    });

    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("CSS Variables");
    expect(result).toContain("--primary");
  });

  it("reports no-token message gracefully when nothing found", async () => {
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("STEP 1");
    expect(result).not.toMatch(/^ERROR/);
  });
});

// ─── Step 2: Main Layout ──────────────────────────────────────

describe("frontend_recon — Step 2: Main Layout", () => {
  it("finds Django base.html and shows its content", async () => {
    const layoutPath = write(
      "templates/base.html",
      [
        "<!DOCTYPE html><html>",
        "<head><title>{% block title %}{% endblock %}</title></head>",
        "<body>",
        '  <nav class="sidebar">{% block nav %}{% endblock %}</nav>',
        "  <main>{% block content %}{% endblock %}</main>",
        "</body></html>",
      ].join("\n"),
    );
    mockFind("base.html", layoutPath);

    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("Main layout");
    expect(result).toContain("base.html");
    expect(result).toContain("sidebar");
  });

  it("finds Vue App.vue as main layout", async () => {
    const appPath = write(
      "src/App.vue",
      [
        "<template>",
        '  <div class="app-shell"><NavBar /><router-view /></div>',
        "</template>",
        '<script>export default { name: "App" }</script>',
      ].join("\n"),
    );
    mockFind("App.vue", appPath);

    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("Main layout");
    expect(result).toContain("App.vue");
  });

  it("reports not-found message when no layout file exists", async () => {
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("STEP 2");
    expect(result).not.toMatch(/^ERROR/);
  });
});

// ─── Step 3: Reference Component ─────────────────────────────

describe("frontend_recon — Step 3: Reference Component", () => {
  it("finds reference matching type hint", async () => {
    const refPath = write(
      "templates/shopping/index.html",
      [
        '{% extends "base.html" %}',
        "{% block content %}",
        '<div class="list-page px-4 py-6">',
        '  <h1 class="text-xl font-bold">Shopping List</h1>',
        "</div>",
        "{% endblock %}",
      ].join("\n"),
    );
    // grep for 'shopping' returns refPath
    mockExec.mockImplementation((cmd, opts, cb) => {
      const resolve = typeof opts === "function" ? opts : cb;
      const stdout = cmd.includes("shopping") ? refPath + "\n" : "";
      resolve(null, { stdout, stderr: "" });
    });

    const result = await executeTool(
      "frontend_recon",
      { type: "shopping" },
      { silent: true },
    );
    expect(result).toContain("Reference");
    expect(result).toContain("shopping");
  });

  it("falls back to any frontend file when type hint finds nothing", async () => {
    const dashPath = write(
      "templates/dashboard.html",
      '{% extends "base.html" %}\n{% block content %}<div class="dashboard"></div>{% endblock %}',
    );
    // Only the fallback find (no type hint) returns the file
    let callCount = 0;
    mockExec.mockImplementation((cmd, opts, cb) => {
      const resolve = typeof opts === "function" ? opts : cb;
      callCount++;
      // Return a result only for the broad fallback find (contains *.html -o)
      const stdout = cmd.includes("-o -name") ? dashPath + "\n" : "";
      resolve(null, { stdout, stderr: "" });
    });

    const result = await executeTool(
      "frontend_recon",
      { type: "xxxxxxnonexistent" },
      { silent: true },
    );
    expect(result).toContain("Reference");
    expect(result).toContain("dashboard");
  });

  it("reports not-found gracefully in empty project", async () => {
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("STEP 3");
    expect(result).not.toMatch(/^ERROR/);
  });
});

// ─── Step 4: Framework Detection ─────────────────────────────

describe("frontend_recon — Step 4: Framework Detection", () => {
  it("detects Vue.js version from package.json", async () => {
    write(
      "package.json",
      JSON.stringify({
        dependencies: { vue: "^3.4.0", tailwindcss: "^3.0.0" },
      }),
    );
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("Vue.js v3");
    expect(result).toContain("Tailwind CSS");
  });

  it("detects React from package.json", async () => {
    write(
      "package.json",
      JSON.stringify({ dependencies: { react: "^18.0.0" } }),
    );
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("React");
  });

  it("detects Alpine.js version and shows v2/v3 API warning", async () => {
    write(
      "package.json",
      JSON.stringify({ dependencies: { alpinejs: "^3.13.0" } }),
    );
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("Alpine.js v3");
    expect(result).toMatch(/v2 vs v3|API differs/i);
  });

  it("detects HTMX from package.json", async () => {
    write("package.json", JSON.stringify({ dependencies: { htmx: "^1.9.0" } }));
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("HTMX");
  });

  it("detects Bootstrap from package.json", async () => {
    write(
      "package.json",
      JSON.stringify({ dependencies: { bootstrap: "^5.3.0" } }),
    );
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("Bootstrap");
  });

  it("detects Django from manage.py presence", async () => {
    write("manage.py", "#!/usr/bin/env python\nimport django");
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("Django");
  });

  it("detects Alpine.js loaded via CDN script tag", async () => {
    const htmlPath = write(
      "templates/base.html",
      '<html><head><script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js" defer></script></head></html>',
    );
    // grep for 'alpinejs' returns the html file
    mockExec.mockImplementation((cmd, opts, cb) => {
      const resolve = typeof opts === "function" ? opts : cb;
      const stdout = cmd.includes("alpinejs") ? htmlPath + "\n" : "";
      resolve(null, { stdout, stderr: "" });
    });

    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("Alpine.js");
  });

  it("detects HTMX loaded via CDN script tag", async () => {
    const htmlPath = write(
      "templates/base.html",
      '<html><head><script src="https://unpkg.com/htmx.org@1.9.4"></script></head></html>',
    );
    mockExec.mockImplementation((cmd, opts, cb) => {
      const resolve = typeof opts === "function" ? opts : cb;
      const stdout = cmd.includes("htmx") ? htmlPath + "\n" : "";
      resolve(null, { stdout, stderr: "" });
    });

    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("HTMX");
  });

  it("warns not to mix frameworks when stack is detected", async () => {
    write("package.json", JSON.stringify({ dependencies: { vue: "^3.4.0" } }));
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("ONLY");
  });

  it("reports unknown framework gracefully when nothing detected", async () => {
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("STEP 4");
    expect(result).not.toMatch(/^ERROR/);
  });
});

// ─── Output structure ─────────────────────────────────────────

describe("frontend_recon — output structure", () => {
  it("always includes all 4 step headers", async () => {
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("## STEP 1");
    expect(result).toContain("## STEP 2");
    expect(result).toContain("## STEP 3");
    expect(result).toContain("## STEP 4");
  });

  it("ends with completion marker", async () => {
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).toContain("Design recon complete");
  });

  it("never returns a bare ERROR string", async () => {
    const result = await executeTool("frontend_recon", {}, { silent: true });
    expect(result).not.toMatch(/^ERROR/);
  });

  it("full stack project: all 4 sections populated", async () => {
    // Tailwind config
    const tailwindPath = write(
      "tailwind.config.js",
      "module.exports = { theme: { extend: { colors: { brand: '#6366f1' } } } }",
    );
    // CSS vars
    const cssPath = write(
      "static/css/variables.css",
      ":root { --brand: #6366f1; --font-body: Inter; }",
    );
    // Main layout
    const layoutPath = write(
      "templates/base.html",
      '<html><head></head><body class="bg-gray-900">{% block content %}{% endblock %}</body></html>',
    );
    // Reference component
    const refPath = write(
      "templates/shopping.html",
      '{% extends "base.html" %}\n{% block content %}<div class="list px-4"></div>{% endblock %}',
    );
    // Package.json with HTMX
    write("package.json", JSON.stringify({ dependencies: { htmx: "^1.9.0" } }));
    // Django manage.py
    write("manage.py", "import django");

    // Wire up exec: return files based on what find/grep is looking for
    mockExec.mockImplementation((cmd, opts, cb) => {
      const resolve = typeof opts === "function" ? opts : cb;
      let stdout = "";
      if (cmd.includes("tailwind.config")) stdout = tailwindPath + "\n";
      else if (cmd.includes(":root") || cmd.includes("variables.css"))
        stdout = cssPath + "\n";
      else if (cmd.includes("base.html") || cmd.includes("layout.html"))
        stdout = layoutPath + "\n";
      else if (cmd.includes("shopping") || cmd.includes("-o -name"))
        stdout = refPath + "\n";
      resolve(null, { stdout, stderr: "" });
    });

    const result = await executeTool(
      "frontend_recon",
      { type: "shopping" },
      { silent: true },
    );

    expect(result).toContain("tailwind.config");
    expect(result).toContain("--brand");
    expect(result).toContain("base.html");
    expect(result).toContain("shopping.html");
    expect(result).toContain("HTMX");
    expect(result).toContain("Django");
    expect(result).toContain("Design recon complete");
  });
});

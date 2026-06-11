/**
 * tests/shell-jobs.test.js — Background Shell Registry
 */

const {
  startShell,
  readShellOutput,
  killShell,
  listShells,
  killAllShells,
  clearShells,
} = require("../cli/shell-jobs");

/** Poll until cond() is truthy or timeout. */
async function waitFor(cond, timeoutMs = 5000, stepMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return cond();
}

function shellById(id) {
  return listShells().find((s) => s.id === id);
}

describe("shell-jobs", () => {
  afterEach(() => {
    clearShells();
  });

  test("startShell runs a command and readShellOutput returns its output", async () => {
    const { id, error } = startShell("echo hello-background");
    expect(error).toBeUndefined();
    expect(id).toMatch(/^shell-\d+$/);

    await waitFor(() => shellById(id)?.status === "completed");
    const out = readShellOutput(id);
    expect(out).toContain("completed, exit 0");
    expect(out).toContain("hello-background");
  });

  test("readShellOutput is incremental — second read has no new output", async () => {
    const { id } = startShell("echo first-chunk");
    await waitFor(() => shellById(id)?.status === "completed");

    const first = readShellOutput(id);
    expect(first).toContain("first-chunk");
    const second = readShellOutput(id);
    // Body after the --- separator must be empty (header still echoes the command)
    expect(second.split("---")[1]).toContain("(no new output)");
    expect(second.split("---")[1]).not.toContain("first-chunk");
  });

  test("filter returns only matching lines", async () => {
    const { id } = startShell("printf 'info: ok\\nerror: bad\\ninfo: ok2\\n'");
    await waitFor(() => shellById(id)?.status === "completed");

    const out = readShellOutput(id, { filter: "error" });
    expect(out).toContain("error: bad");
    // Body after the --- separator excludes non-matching lines (header echoes the command)
    expect(out.split("---")[1]).not.toContain("info: ok");
  });

  test("invalid filter regex returns ERROR", async () => {
    const { id } = startShell("echo x");
    await waitFor(() => shellById(id)?.status === "completed");
    expect(readShellOutput(id, { filter: "[unclosed" })).toMatch(/^ERROR: Invalid filter regex/);
  });

  test("unknown shell id returns ERROR with known ids", async () => {
    const { id } = startShell("echo known");
    const out = readShellOutput("shell-9999");
    expect(out).toMatch(/^ERROR: No background shell/);
    expect(out).toContain(id);
  });

  test("killShell terminates a running command", async () => {
    const { id } = startShell("sleep 30");
    await waitFor(() => shellById(id)?.status === "running");

    const msg = killShell(id);
    expect(msg).toContain("SIGTERM");
    await waitFor(() => shellById(id)?.status === "killed");
    expect(shellById(id).status).toBe("killed");
    expect(readShellOutput(id)).toContain("killed");
  });

  test("killShell on a finished shell reports it already exited", async () => {
    const { id } = startShell("echo done");
    await waitFor(() => shellById(id)?.status === "completed");
    expect(killShell(id)).toContain("already finished");
  });

  test("non-zero exit is reported as failed with exit code", async () => {
    const { id } = startShell("exit 3");
    await waitFor(() => shellById(id)?.status === "failed");
    expect(readShellOutput(id)).toContain("failed, exit 3");
  });

  test("running shell output includes still-running hint", async () => {
    const { id } = startShell("echo early; sleep 30");
    await waitFor(() => /early/.test(readShellOutput(id)));
    // Previous read consumed "early"; a running shell always hints at polling
    expect(readShellOutput(id)).toContain("still running");
    killShell(id);
  });

  test("caps concurrently running shells", async () => {
    const ids = [];
    for (let i = 0; i < 8; i++) {
      const { id, error } = startShell("sleep 30");
      expect(error).toBeUndefined();
      ids.push(id);
    }
    const over = startShell("sleep 30");
    expect(over.error).toMatch(/Too many background shells/);

    killAllShells();
    await waitFor(() => ids.every((id) => shellById(id)?.status === "killed"));
    // After killing, starting again works
    const retry = startShell("echo ok");
    expect(retry.error).toBeUndefined();
  });

  test("killAllShells marks every running shell as killed", async () => {
    const a = startShell("sleep 30").id;
    const b = startShell("sleep 30").id;
    await waitFor(() => shellById(a)?.status === "running" && shellById(b)?.status === "running");
    killAllShells();
    expect(shellById(a).status).toBe("killed");
    expect(shellById(b).status).toBe("killed");
  });
});

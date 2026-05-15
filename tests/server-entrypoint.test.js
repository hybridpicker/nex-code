"use strict";

const path = require("path");
const { spawn } = require("child_process");

describe("nex-code --server entrypoint", () => {
  test("emits clean JSON ready before flatrate startup output", async () => {
    const child = spawn(process.execPath, [path.join(__dirname, "..", "bin", "nex-code.js"), "--server"], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        NEX_NO_DOTENV: "1",
        OLLAMA_API_KEY: "test-key-that-must-not-print",
        FORCE_COLOR: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.includes("\n")) {
        child.stdin.end();
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error(`server mode did not become ready. stdout=${stdout} stderr=${stderr}`));
      }, 5000);
      child.on("error", reject);
      child.on("exit", (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });

    expect(exitCode).toBe(0);
    expect(stdout.split(/\r?\n/)[0]).toBe('{"type":"ready"}');
    expect(stdout).not.toContain("Flatrate mode");
    expect(stdout).not.toContain("test-key-that-must-not-print");
    expect(stderr).not.toContain("Flatrate mode");
    expect(stderr).not.toContain("test-key-that-must-not-print");
  });
});

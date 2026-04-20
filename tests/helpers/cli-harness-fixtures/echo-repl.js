#!/usr/bin/env node
// Fixture for CliSession tests: a tiny interactive echo REPL.
// Prints a prompt, reads lines, echoes them back. Exits on "quit".
process.stdout.write("ready> ");
process.stdin.setEncoding("utf-8");
let buf = "";
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    if (line.trim() === "quit") {
      process.stdout.write("bye\n");
      process.exit(0);
    }
    process.stdout.write(`echo: ${line}\nready> `);
  }
});
process.stdin.on("end", () => process.exit(0));

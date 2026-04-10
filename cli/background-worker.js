/**
 * cli/background-worker.js — Background Agent Worker Process
 *
 * This script is forked by background-jobs.js. It receives an agent definition
 * over IPC, runs it via runSubAgent, and sends the result back.
 *
 * Must be a standalone entry point — no TTY output, no spinner rendering.
 */

const { runSubAgent } = require("./sub-agent");

process.on("message", async ({ jobId, agentDef }) => {
  try {
    const result = await runSubAgent(
      { ...agentDef, _skipLog: true },
      { onUpdate: () => {} },
      0,
    );
    process.send({ type: "result", jobId, payload: result });
  } catch (err) {
    process.send({ type: "error", jobId, error: err.message });
  } finally {
    // Exit cleanly after sending result — do not linger
    process.exit(0);
  }
});

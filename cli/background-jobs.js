/**
 * cli/background-jobs.js — Background Agent Job Registry
 *
 * Manages non-blocking sub-agent execution via child_process.fork().
 * Results are collected in-memory and drained into the main conversation
 * on each LLM iteration by agent.js.
 */

const { fork } = require("child_process");
const path = require("path");

const WORKER_PATH = path.join(__dirname, "background-worker.js");

/** @type {Map<string, { process: import('child_process').ChildProcess, agentDef: object, startedAt: number }>} */
const runningJobs = new Map();

/** @type {Map<string, { jobId: string, agentDef: object, result: object, finishedAt: number }>} */
const completedJobs = new Map();

/**
 * Generate a unique job ID.
 * @returns {string}
 */
function _makeJobId() {
  return `bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Fork a background worker for the given agent definition.
 * @param {object} agentDef - Agent definition (task, context, model, etc.)
 * @returns {string} jobId
 */
function createJob(agentDef) {
  const jobId = _makeJobId();

  const child = fork(WORKER_PATH, [], {
    silent: true, // suppress child stdio from reaching parent terminal
    env: process.env,
    cwd: process.cwd(),
  });

  // Send the job payload once the child is ready
  child.send({ jobId, agentDef });

  child.on("message", (msg) => {
    if (msg.type === "result") {
      _markCompleted(jobId, agentDef, msg.payload);
    } else if (msg.type === "error") {
      _markCompleted(jobId, agentDef, {
        task: agentDef.task,
        status: "failed",
        result: `Background agent error: ${msg.error}`,
        toolsUsed: [],
        tokensUsed: { input: 0, output: 0 },
      });
    }
  });

  child.on("exit", (code, signal) => {
    // If the job is still running (no result message received), synthesize a failure
    if (runningJobs.has(jobId)) {
      const reason = signal ? `killed (${signal})` : `exit code ${code}`;
      _markCompleted(jobId, agentDef, {
        task: agentDef.task,
        status: "failed",
        result: `Background agent terminated unexpectedly: ${reason}`,
        toolsUsed: [],
        tokensUsed: { input: 0, output: 0 },
      });
    }
  });

  runningJobs.set(jobId, { process: child, agentDef, startedAt: Date.now() });
  return jobId;
}

/**
 * Move a job from running to completed.
 * @param {string} jobId
 * @param {object} agentDef
 * @param {object} result
 */
function _markCompleted(jobId, agentDef, result) {
  runningJobs.delete(jobId);
  completedJobs.set(jobId, { jobId, agentDef, result, finishedAt: Date.now() });
}

/**
 * Drain all completed jobs. Returns them and clears the completed queue.
 * @returns {Array<{ jobId: string, agentDef: object, result: object, finishedAt: number }>}
 */
function getCompletedJobs() {
  if (completedJobs.size === 0) return [];
  const jobs = [...completedJobs.values()];
  completedJobs.clear();
  return jobs;
}

/**
 * Returns true if there are any running or completed-but-not-yet-drained jobs.
 * Used by the post-loop drain to decide whether to process results.
 * @returns {boolean}
 */
function hasPendingOrCompletedJobs() {
  return runningJobs.size > 0 || completedJobs.size > 0;
}

/**
 * Returns a short summary string like "2 bg agents running", or "" if none.
 * @returns {string}
 */
function getPendingJobSummary() {
  const count = runningJobs.size;
  if (count === 0) return "";
  return `${count} bg agent${count === 1 ? "" : "s"} running`;
}

/**
 * Cancel all running background jobs. Called when the session is cleared.
 */
function cancelAllJobs() {
  for (const [jobId, job] of runningJobs) {
    try {
      job.process.kill("SIGTERM");
    } catch (_) {
      // ignore
    }
    runningJobs.delete(jobId);
  }
  completedJobs.clear();
}

module.exports = {
  createJob,
  getCompletedJobs,
  getPendingJobSummary,
  hasPendingOrCompletedJobs,
  cancelAllJobs,
};

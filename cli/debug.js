/**
 * cli/debug.js — Central debug flag for internal diagnostic messages.
 *
 * Internal system messages (compression, loop detection, guards, BLOCKED)
 * are hidden by default. Set --debug flag or NEX_DEBUG=true to show them.
 *
 * DEBUG is evaluated lazily at call time so tests can toggle NEX_DEBUG
 * without needing to reset modules.
 */

/** Whether debug mode is active (checked lazily at each call). */
function isDebug() {
  return process.env.NEX_DEBUG === "true" || process.argv.includes("--debug");
}

/**
 * Static snapshot evaluated at require() time — useful for early guards
 * and the _logCompression process.stdout.write path.
 */
const DEBUG = isDebug();

/**
 * Log an internal diagnostic message — only shown when --debug or NEX_DEBUG=true.
 * @param {...any} args
 */
function debugLog(...args) {
  if (isDebug()) console.log(...args);
}

/**
 * Warn about an internal diagnostic condition — only shown when --debug or NEX_DEBUG=true.
 * @param {...any} args
 */
function warnLog(...args) {
  if (isDebug()) console.warn(...args);
}

module.exports = { DEBUG, debugLog, warnLog };

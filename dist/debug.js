// cli/debug.js
function isDebug() {
  return process.env.NEX_DEBUG === "true" || process.argv.includes("--debug");
}
var DEBUG = isDebug();
function debugLog(...args) {
  if (isDebug()) console.log(...args);
}
function warnLog(...args) {
  if (isDebug()) process.stderr.write(args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ") + "\n");
}
module.exports = { DEBUG, debugLog, warnLog };

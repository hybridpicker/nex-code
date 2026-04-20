/**
 * Stop-condition logic for the nex-code auto-improve daemon.
 *
 * Extracted into its own module so it can be unit-tested without loading
 * the daemon (which starts fs.watch on require).
 *
 * The original daemon only stopped on EXACT score equality, so jittery
 * real-world sequences like 9 → 10 → 8.5 → 5.5 → 6.3 never triggered a
 * stop even though they clearly regressed. This module stops on:
 *   1. Plateau within epsilon — last N scores all within PLATEAU_EPSILON
 *   2. Regression — recent average is REGRESSION_THRESHOLD below the
 *      prior max; continuing to "improve" typically degrades further
 *   3. No new high — last N passes failed to beat the prior max
 */

const DEFAULTS = {
  plateauCount: 2,
  plateauEpsilon: 0.3,
  regressionThreshold: 1.0,
};

/**
 * @param {number[]} scores - chronological score history (one per pass)
 * @param {object} [opts]
 * @returns {string|null} stop reason, or null if the loop should continue
 */
function shouldStopImproving(scores, opts = {}) {
  const { plateauCount, plateauEpsilon, regressionThreshold } = {
    ...DEFAULTS,
    ...opts,
  };
  if (!Array.isArray(scores) || scores.length < plateauCount + 1) return null;

  const last = scores.slice(-plateauCount);
  const max = Math.max(...last);
  const min = Math.min(...last);
  if (max - min <= plateauEpsilon)
    return `score plateau (Δ≤${plateauEpsilon} over last ${plateauCount})`;

  const priorMax = Math.max(...scores.slice(0, -plateauCount));
  const recentAvg = last.reduce((a, b) => a + b, 0) / last.length;
  if (priorMax - recentAvg >= regressionThreshold)
    return `regression (recent avg ${recentAvg.toFixed(2)} < prior max ${priorMax} by ≥${regressionThreshold})`;

  if (last.every((s) => s < priorMax))
    return `no new high for ${plateauCount} passes (cap ${priorMax})`;

  return null;
}

module.exports = { shouldStopImproving, DEFAULTS };

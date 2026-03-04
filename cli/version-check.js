/**
 * cli/version-check.js — Check for new versions of nex-code
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const PACKAGE_NAME = 'nex-code';
const CONFIG_DIR = path.join(process.cwd(), '.nex');
const VERSION_CHECK_FILE = path.join(CONFIG_DIR, 'last-version-check');

// Create config directory if it doesn't exist
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Check if a new version is available
 * @returns {Promise<{hasNewVersion: boolean, latestVersion?: string, currentVersion?: string}>}
 */
async function checkForNewVersion() {
  try {
    // Check if we've checked recently (within last 24 hours)
    const lastCheck = getLastCheckTime();
    const now = Date.now();
    
    // Only check once per day
    if (lastCheck && (now - lastCheck) < 24 * 60 * 60 * 1000) {
      return { hasNewVersion: false };
    }
    
    // Update last check time
    saveLastCheckTime(now);
    
    // Get current version
    const currentVersion = getCurrentVersion();
    
    // Fetch latest version from npm registry
    const response = await axios.get(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, {
      timeout: 5000
    });
    
    const latestVersion = response.data.version;
    
    // Compare versions
    const hasNewVersion = isNewerVersion(latestVersion, currentVersion);
    
    return {
      hasNewVersion,
      latestVersion: hasNewVersion ? latestVersion : undefined,
      currentVersion: hasNewVersion ? currentVersion : undefined
    };
  } catch (error) {
    // Silently fail - don't interrupt the main application
    return { hasNewVersion: false };
  }
}

/**
 * Get current version from package.json
 * @returns {string}
 */
function getCurrentVersion() {
  const pkg = require('../package.json');
  return pkg.version;
}

/**
 * Get last version check time
 * @returns {number|null}
 */
function getLastCheckTime() {
  try {
    if (fs.existsSync(VERSION_CHECK_FILE)) {
      const content = fs.readFileSync(VERSION_CHECK_FILE, 'utf8');
      return parseInt(content, 10);
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

/**
 * Save last version check time
 * @param {number} timestamp
 */
function saveLastCheckTime(timestamp) {
  try {
    fs.writeFileSync(VERSION_CHECK_FILE, timestamp.toString());
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Compare two semantic versions
 * @param {string} latestVersion 
 * @param {string} currentVersion 
 * @returns {boolean}
 */
function isNewerVersion(latestVersion, currentVersion) {
  try {
    const latestParts = latestVersion.split('.').map(Number);
    const currentParts = currentVersion.split('.').map(Number);
    
    // Compare major version
    if (latestParts[0] > currentParts[0]) return true;
    if (latestParts[0] < currentParts[0]) return false;
    
    // Compare minor version
    if (latestParts[1] > currentParts[1]) return true;
    if (latestParts[1] < currentParts[1]) return false;
    
    // Compare patch version
    if (latestParts[2] > currentParts[2]) return true;
    
    return false;
  } catch (error) {
    // If we can't parse versions, assume no update is needed
    return false;
  }
}

module.exports = {
  checkForNewVersion
};
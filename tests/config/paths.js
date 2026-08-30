// tests/config/paths.js -- single centralized path-resolution module.
// No other file may hardcode /mnt/user-data or the Chromium binary path.
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function getCanonicalSourcePath() {
  return process.env.STARTAK_CANONICAL_SOURCE || path.join(REPO_ROOT, 'characterization', 'reference', 'platform-source.jsx');
}

function getGoldBaselinePath() {
  return process.env.STARTAK_GOLD_BASELINE || path.join(REPO_ROOT, 'tests', 'reference', 'RE-GOLD-baseline.json');
}

function findChromiumExecutable() {
  if (process.env.STARTAK_CHROMIUM_EXECUTABLE) {
    if (!fs.existsSync(process.env.STARTAK_CHROMIUM_EXECUTABLE)) {
      throw new Error(`STARTAK_CHROMIUM_EXECUTABLE is set to "${process.env.STARTAK_CHROMIUM_EXECUTABLE}" but that path does not exist`);
    }
    return process.env.STARTAK_CHROMIUM_EXECUTABLE;
  }
  // Automatic discovery, in order of preference:
  const candidates = [];
  // 1. Playwright's own default managed-browser lookup (works if `npx playwright install` succeeded)
  try {
    const { chromium } = require('playwright');
    const pwPath = chromium.executablePath();
    if (pwPath && fs.existsSync(pwPath)) candidates.push(pwPath);
  } catch (e) { /* playwright not installed or executablePath() failed -- fall through */ }
  // 2. Common system-installed Chrome/Chromium locations
  for (const p of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/google/chrome/chrome']) {
    if (fs.existsSync(p)) candidates.push(p);
  }
  if (candidates.length === 0) {
    throw new Error('No Chromium executable found. Set STARTAK_CHROMIUM_EXECUTABLE to an explicit path, or run `npx playwright install chromium`.');
  }
  return candidates[0];
}

module.exports = { REPO_ROOT, getCanonicalSourcePath, getGoldBaselinePath, findChromiumExecutable };

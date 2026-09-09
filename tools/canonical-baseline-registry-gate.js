'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS: REGISTRY_STATUS,
  evaluateCurrentCanonicalBaselineRegistry,
} = require('../src/qualification/canonical-baseline-registry');

const STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  MISSING: 'MISSING',
  MALFORMED: 'MALFORMED',
  REGISTRY_HOLD: 'REGISTRY_HOLD',
});

function verifyCanonicalBaselineRegistryFile({
  filePath = path.join(__dirname, '..', 'config', 'governance', 'canonical-baseline.json'),
  fsModule = fs,
} = {}) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    return Object.freeze({ status: STATUS.MISSING, verified: false, reasonCode: 'CANONICAL_BASELINE_REGISTRY_PATH_REQUIRED' });
  }
  try {
    if (!fsModule.existsSync(filePath) || !fsModule.statSync(filePath).isFile()) {
      return Object.freeze({ status: STATUS.MISSING, verified: false, reasonCode: 'CANONICAL_BASELINE_REGISTRY_FILE_MISSING' });
    }
  } catch (_) {
    return Object.freeze({ status: STATUS.MISSING, verified: false, reasonCode: 'CANONICAL_BASELINE_REGISTRY_FILE_UNAVAILABLE' });
  }

  let parsed;
  try {
    parsed = JSON.parse(fsModule.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return Object.freeze({ status: STATUS.MALFORMED, verified: false, reasonCode: 'CANONICAL_BASELINE_REGISTRY_JSON_INVALID' });
  }

  const evaluated = evaluateCurrentCanonicalBaselineRegistry(parsed);
  if (evaluated.status !== REGISTRY_STATUS.LEGACY_BASELINE_REGISTRY_CONFIRMED) {
    return Object.freeze({
      status: STATUS.REGISTRY_HOLD,
      verified: false,
      reasonCode: 'CANONICAL_BASELINE_REGISTRY_NOT_CONFIRMED',
      blockers: evaluated.blockers || Object.freeze([]),
      activeMode: evaluated.activeMode || null,
      registryHashSha256: evaluated.registryHashSha256 || null,
    });
  }

  return Object.freeze({
    status: STATUS.VERIFIED,
    verified: true,
    reasonCode: null,
    activeMode: evaluated.activeMode,
    registryHashSha256: evaluated.registryHashSha256,
    activationApplied: evaluated.activationApplied,
    canonicalBaselineChanged: evaluated.canonicalBaselineChanged,
  });
}

module.exports = {
  STATUS,
  verifyCanonicalBaselineRegistryFile,
};

'use strict';

const crypto = require('crypto');
const fs = require('fs');

const EXPECTED_CANONICAL_SHA256 = 'ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71';

const CANONICAL_SOURCE_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  NOT_EVALUATED: 'NOT_EVALUATED',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
  MISMATCH: 'MISMATCH',
});

const SHA256_RE = /^[a-f0-9]{64}$/i;

function normalizeExpectedSha256(value) {
  if (typeof value !== 'string' || !SHA256_RE.test(value.trim())) {
    throw new TypeError('expectedSha256 must be a 64-character SHA-256 hex digest');
  }
  return value.trim().toLowerCase();
}

function sourceFileAvailable(filePath, fsModule) {
  if (typeof filePath !== 'string' || filePath.trim() === '') return false;
  try {
    return fsModule.existsSync(filePath) && fsModule.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function evaluateCanonicalSourceEvidence({
  filePath,
  expectedSha256 = EXPECTED_CANONICAL_SHA256,
  requireEvidence = false,
  fsModule = fs,
} = {}) {
  const expected = normalizeExpectedSha256(expectedSha256);
  const sourcePathProvided = typeof filePath === 'string' && filePath.trim() !== '';
  const available = sourceFileAvailable(filePath, fsModule);

  if (!available) {
    return Object.freeze({
      status: requireEvidence ? CANONICAL_SOURCE_STATUS.MISSING_REQUIRED : CANONICAL_SOURCE_STATUS.NOT_EVALUATED,
      evaluated: false,
      verified: false,
      sourcePathProvided,
      expectedSha256: expected,
      computedSha256: null,
      reasonCode: requireEvidence
        ? 'CANONICAL_SOURCE_FILE_REQUIRED_BUT_UNAVAILABLE'
        : 'CANONICAL_SOURCE_FILE_NOT_SUPPLIED_OR_UNAVAILABLE',
    });
  }

  const computed = crypto.createHash('sha256').update(fsModule.readFileSync(filePath)).digest('hex');
  if (computed !== expected) {
    return Object.freeze({
      status: CANONICAL_SOURCE_STATUS.MISMATCH,
      evaluated: true,
      verified: false,
      sourcePathProvided: true,
      expectedSha256: expected,
      computedSha256: computed,
      reasonCode: 'CANONICAL_SOURCE_HASH_MISMATCH',
    });
  }

  return Object.freeze({
    status: CANONICAL_SOURCE_STATUS.VERIFIED,
    evaluated: true,
    verified: true,
    sourcePathProvided: true,
    expectedSha256: expected,
    computedSha256: computed,
    reasonCode: null,
  });
}

module.exports = {
  EXPECTED_CANONICAL_SHA256,
  CANONICAL_SOURCE_STATUS,
  evaluateCanonicalSourceEvidence,
};

'use strict';

const fs = require('fs');
const path = require('path');
const {
  STATUS: GUARD_STATUS,
  evaluateCompositeBaselineCutoverSafetyGuard,
} = require('../src/qualification/composite-baseline-cutover-safety-guard');

const STATUS = Object.freeze({
  NOT_EVALUATED: 'NOT_EVALUATED',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
  HOLD: 'HOLD',
  VERIFIED: 'VERIFIED',
});

const ROOT = path.join(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'config', 'governance', 'canonical-baseline.json');
const MAX_JSON_BYTES = 2 * 1024 * 1024;

const INPUTS = Object.freeze({
  reviewerLifecycle: 'COMPOSITE_CUTOVER_REVIEWER_LIFECYCLE_PATH',
  activationPlan: 'COMPOSITE_CUTOVER_ACTIVATION_PLAN_PATH',
  shadowEvaluation: 'COMPOSITE_CUTOVER_SHADOW_PATH',
  rehearsalResult: 'COMPOSITE_CUTOVER_REHEARSAL_PATH',
});

function safeReadJson(filePath) {
  if (typeof filePath !== 'string' || filePath.trim() === '') throw new Error('INPUT_PATH_INVALID');
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) throw new Error('SYMLINK_INPUT_REJECTED');
  if (!stat.isFile()) throw new Error('INPUT_NOT_REGULAR_FILE');
  if (stat.size > MAX_JSON_BYTES) throw new Error('INPUT_TOO_LARGE');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeResult(status, reasonCode, extra = {}) {
  return Object.freeze({
    schemaVersion: 1,
    status,
    verified: status === STATUS.VERIFIED,
    reasonCode,
    authoritativeMode: 'LEGACY_FILE_SHA256',
    proposedMode: 'GOVERNED_COMPOSITE_BASELINE',
    activationAuthorizationGranted: false,
    activationApplied: false,
    releaseAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    goLiveAuthorized: false,
    transactionAuthorized: false,
    ...extra,
  });
}

function evaluateCompositeBaselineCutoverSafetyFromEnvironment({ env = process.env } = {}) {
  const supplied = Object.entries(INPUTS).filter(([, key]) => typeof env[key] === 'string' && env[key].trim() !== '');
  const required = env.REQUIRE_COMPOSITE_CUTOVER_SAFETY === '1';

  if (supplied.length === 0) {
    return safeResult(
      required ? STATUS.MISSING_REQUIRED : STATUS.NOT_EVALUATED,
      required ? 'COMPOSITE_CUTOVER_SAFETY_INPUTS_REQUIRED' : 'COMPOSITE_CUTOVER_SAFETY_INPUTS_NOT_SUPPLIED',
    );
  }
  if (supplied.length !== Object.keys(INPUTS).length) {
    return safeResult(STATUS.HOLD, 'COMPOSITE_CUTOVER_SAFETY_PARTIAL_INPUT');
  }

  try {
    const currentRegistry = safeReadJson(REGISTRY_PATH);
    const reviewerLifecycle = safeReadJson(env[INPUTS.reviewerLifecycle]);
    const activationPlan = safeReadJson(env[INPUTS.activationPlan]);
    const shadowEvaluation = safeReadJson(env[INPUTS.shadowEvaluation]);
    const rehearsalResult = safeReadJson(env[INPUTS.rehearsalResult]);

    const result = evaluateCompositeBaselineCutoverSafetyGuard({
      currentRegistry,
      reviewerLifecycle,
      activationPlan,
      shadowEvaluation,
      rehearsalResult,
    });

    if (result.status !== GUARD_STATUS.CUTOVER_SAFETY_GUARD_SATISFIED_NOT_ACTIVATED) {
      return safeResult(STATUS.HOLD, 'COMPOSITE_CUTOVER_SAFETY_GUARD_HOLD', {
        blockers: Array.isArray(result.blockers) ? Object.freeze([...result.blockers]) : Object.freeze([]),
      });
    }

    return safeResult(STATUS.VERIFIED, 'COMPOSITE_CUTOVER_SAFETY_GUARD_SATISFIED_NOT_ACTIVATED', {
      cutoverSafetyGuardHashSha256: result.cutoverSafetyGuardHashSha256,
      currentRegistryHashSha256: result.currentRegistryHashSha256,
      reviewerLockHashSha256: result.reviewerLockHashSha256,
      activationPlanHashSha256: result.activationPlanHashSha256,
      shadowEvaluationHashSha256: result.shadowEvaluationHashSha256,
      rehearsalHashSha256: result.rehearsalHashSha256,
      exactRollbackIdentityVerified: result.exactRollbackIdentityVerified,
      safetyPrerequisitesSatisfiedForFutureExplicitReviewedActivationChange: true,
    });
  } catch (error) {
    const known = new Set([
      'INPUT_PATH_INVALID',
      'SYMLINK_INPUT_REJECTED',
      'INPUT_NOT_REGULAR_FILE',
      'INPUT_TOO_LARGE',
    ]);
    return safeResult(STATUS.HOLD, known.has(error.message) ? error.message : 'COMPOSITE_CUTOVER_SAFETY_INPUT_INVALID');
  }
}

module.exports = {
  STATUS,
  INPUTS,
  evaluateCompositeBaselineCutoverSafetyFromEnvironment,
};

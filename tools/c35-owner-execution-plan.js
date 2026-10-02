'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLAN_PATH = path.join(ROOT, 'release', 'evidence', 'c35-owner-execution-plan.json');
const ACQUISITION_MAP_PATH = path.join(ROOT, 'release', 'evidence', 'c32-evidence-acquisition-map.json');
const OWNER_REGISTER_PATH = path.join(ROOT, 'release', 'evidence', 'c34-single-accountable-owner-register.json');

const ALLOWED_STATES = new Set([
  'REVIEWER_REQUIRED',
  'REAL_INPUT_REQUIRED',
  'PREPARED_NOT_EXECUTED',
  'EXECUTION_SCHEDULED_PENDING_WORKFLOW',
  'EXECUTED_CANDIDATE_EVIDENCE_PENDING_REVIEW',
]);

function readJson(filePath) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error('C35_SYMLINK_INPUT_REJECTED');
  if (!stat.isFile()) throw new Error('C35_INPUT_NOT_REGULAR_FILE');
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function requireText(value, code) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}

function validatePlan(plan, acquisitionMap, ownerRegister) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('C35_PLAN_REQUIRED');
  if (plan.schemaVersion !== 1 || plan.scope !== 'C35_OWNER_EXECUTION_WAVE1') throw new Error('C35_PLAN_SCHEMA_INVALID');
  if (!acquisitionMap || !Array.isArray(acquisitionMap.requests) || acquisitionMap.requests.length !== 13) throw new Error('C35_ACQUISITION_MAP_INVALID');
  if (!ownerRegister || !Array.isArray(ownerRegister.items) || ownerRegister.items.length !== 13) throw new Error('C35_OWNER_REGISTER_INVALID');

  const ownerRef = requireText(plan.accountableOwnerRef, 'C35_OWNER_REF_REQUIRED');
  const ownerContactRef = requireText(plan.accountableOwnerContactRef, 'C35_OWNER_CONTACT_REQUIRED');
  if (ownerRef !== ownerRegister.accountableOwnerRef || ownerContactRef !== ownerRegister.accountableOwnerContactRef) {
    throw new Error('C35_OWNER_BINDING_MISMATCH');
  }
  if (plan.assignmentBasis !== 'OWNER_SELF_DECLARATION_AND_GITHUB_ISSUE_ASSIGNMENT') throw new Error('C35_ASSIGNMENT_BASIS_INVALID');
  requireText(plan.c30QualifiedEngineeringSuccessor, 'C35_C30_SUCCESSOR_REQUIRED');
  requireText(plan.rollbackRehearsalPoint, 'C35_ROLLBACK_POINT_REQUIRED');
  if (!Array.isArray(plan.items) || plan.items.length !== 13) throw new Error('C35_ITEM_COUNT_INVALID');

  const expected = new Map(acquisitionMap.requests.map((request) => [request.requestKey, request.issueNumber]));
  const ownerKeys = new Set(ownerRegister.items.map((item) => item.requestKey));
  const actualKeys = plan.items.map((item) => item && item.requestKey);
  if (new Set(actualKeys).size !== 13) throw new Error('C35_DUPLICATE_REQUEST_KEY');
  if (actualKeys.some((key) => !expected.has(key)) || [...expected.keys()].some((key) => !actualKeys.includes(key))) {
    throw new Error('C35_REQUEST_KEY_SET_MISMATCH');
  }
  if (actualKeys.some((key) => !ownerKeys.has(key))) throw new Error('C35_OWNER_REGISTER_KEY_MISMATCH');

  const normalized = plan.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('C35_ITEM_INVALID');
    const requestKey = requireText(item.requestKey, 'C35_REQUEST_KEY_REQUIRED');
    if (item.issueNumber !== expected.get(requestKey)) throw new Error(`C35_ISSUE_NUMBER_MISMATCH:${requestKey}`);
    const executionClass = requireText(item.executionClass, `C35_EXECUTION_CLASS_REQUIRED:${requestKey}`);
    if (!ALLOWED_STATES.has(item.currentState)) throw new Error(`C35_CURRENT_STATE_INVALID:${requestKey}`);
    if (item.ownerCoordinates !== true) throw new Error(`C35_OWNER_COORDINATION_REQUIRED:${requestKey}`);
    if (item.ownerSelfVerificationAllowed !== false) throw new Error(`C35_SELF_VERIFICATION_PROHIBITION_REQUIRED:${requestKey}`);
    const nextAction = requireText(item.nextAction, `C35_NEXT_ACTION_REQUIRED:${requestKey}`);
    return Object.freeze({ requestKey, issueNumber: item.issueNumber, executionClass, currentState: item.currentState, nextAction });
  });

  const rollback = normalized.find((item) => item.requestKey === 'C30:ROLLBACK_OPERATIONAL_VERIFICATION');
  if (!rollback || !['EXECUTION_SCHEDULED_PENDING_WORKFLOW', 'EXECUTED_CANDIDATE_EVIDENCE_PENDING_REVIEW'].includes(rollback.currentState)) {
    throw new Error('C35_ROLLBACK_EXECUTION_STATE_INVALID');
  }
  if (plan.evidenceSatisfiedCount !== 0) throw new Error('C35_FALSE_EVIDENCE_SATISFACTION');

  for (const key of [
    'releaseDecisionAuthorized',
    'canonicalBaselineActivationAuthorized',
    'mergeAuthorized',
    'deploymentAuthorized',
    'commercialGoLiveAuthorized',
    'transactionAuthority',
    'approvalAuthorized',
    'publicAiAuthorized',
  ]) {
    if (plan[key] !== false) throw new Error(`C35_AUTHORITY_ESCALATION:${key}`);
  }

  return Object.freeze({ ownerRef, ownerContactRef, items: Object.freeze(normalized), rollback });
}

function buildExecutionSummary({ plan, acquisitionMap, ownerRegister }) {
  const validated = validatePlan(plan, acquisitionMap, ownerRegister);
  const items = validated.items;
  const reviewerRequiredCount = items.filter((item) => item.currentState === 'REVIEWER_REQUIRED').length;
  const realInputRequiredCount = items.filter((item) => item.currentState === 'REAL_INPUT_REQUIRED').length;
  const preparedNotExecutedCount = items.filter((item) => item.currentState === 'PREPARED_NOT_EXECUTED').length;
  const executionScheduledCount = items.filter((item) => item.currentState === 'EXECUTION_SCHEDULED_PENDING_WORKFLOW').length;
  const candidateEvidencePendingReviewCount = items.filter((item) => item.currentState === 'EXECUTED_CANDIDATE_EVIDENCE_PENDING_REVIEW').length;

  return Object.freeze({
    schemaVersion: 1,
    scope: 'C35_OWNER_EXECUTION_SUMMARY',
    accountableOwnerRef: validated.ownerRef,
    accountableOwnerAssignedCount: 13,
    totalRequiredItems: 13,
    reviewerRequiredCount,
    realInputRequiredCount,
    preparedNotExecutedCount,
    executionScheduledCount,
    candidateEvidencePendingReviewCount,
    evidenceSatisfiedCount: 0,
    programState: candidateEvidencePendingReviewCount > 0
      ? 'OWNER_EXECUTION_IN_PROGRESS_CANDIDATE_EVIDENCE_PENDING_REVIEW'
      : 'OWNER_EXECUTION_READY_REAL_EVIDENCE_REQUIRED',
    rollbackCandidateEvidenceIsFinalAuthorization: false,
    ownerAssignmentIsIndependentReview: false,
    releaseDecisionAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
  });
}

function runCli() {
  const result = buildExecutionSummary({
    plan: readJson(PLAN_PATH),
    acquisitionMap: readJson(ACQUISITION_MAP_PATH),
    ownerRegister: readJson(OWNER_REGISTER_PATH),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  try { runCli(); } catch (error) {
    console.error(`C35_OWNER_EXECUTION_PLAN=FAIL ${error.message}`);
    process.exit(1);
  }
}

module.exports = Object.freeze({
  ALLOWED_STATES,
  validatePlan,
  buildExecutionSummary,
  runCli,
});

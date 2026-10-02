'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ACQUISITION_MAP_PATH = path.join(ROOT, 'release', 'evidence', 'c32-evidence-acquisition-map.json');
const C33_REGISTER_PATH = path.join(ROOT, 'release', 'evidence', 'c33-evidence-outreach-register.json');
const C34_REGISTER_PATH = path.join(ROOT, 'release', 'evidence', 'c34-single-accountable-owner-register.json');

const PROGRAM_STATE = Object.freeze({
  OWNER_ASSIGNED_EVIDENCE_REQUIRED: 'SINGLE_ACCOUNTABLE_OWNER_ASSIGNED_REAL_EVIDENCE_REQUIRED',
  ACTIVITY_IN_PROGRESS: 'OWNER_ASSIGNED_EVIDENCE_ACQUISITION_IN_PROGRESS',
  RECEIVED_PENDING_VALIDATION: 'REAL_EVIDENCE_RECEIVED_PENDING_GOVERNED_VALIDATION',
});

function readJson(filePath) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error('C34_SYMLINK_INPUT_REJECTED');
  if (!stat.isFile()) throw new Error('C34_INPUT_NOT_REGULAR_FILE');
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function requireText(value, code) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

function validateSingleOwnerRegister(register, acquisitionMap, c33Register) {
  if (!register || typeof register !== 'object' || Array.isArray(register)) throw new Error('C34_REGISTER_REQUIRED');
  if (register.schemaVersion !== 1 || register.scope !== 'C34_SINGLE_ACCOUNTABLE_OWNER_REGISTER') throw new Error('C34_REGISTER_SCHEMA_INVALID');
  if (!acquisitionMap || !Array.isArray(acquisitionMap.requests) || acquisitionMap.requests.length !== 13) throw new Error('C34_ACQUISITION_MAP_INVALID');
  if (!c33Register || !Array.isArray(c33Register.items) || c33Register.items.length !== 13) throw new Error('C34_C33_REGISTER_INVALID');

  const ownerRef = requireText(register.accountableOwnerRef, 'C34_ACCOUNTABLE_OWNER_REQUIRED');
  const ownerContactRef = requireText(register.accountableOwnerContactRef, 'C34_OWNER_CONTACT_REQUIRED');
  if (register.assignmentBasis !== 'OWNER_SELF_DECLARATION') throw new Error('C34_ASSIGNMENT_BASIS_INVALID');
  if (register.ownerAcknowledged !== true) throw new Error('C34_OWNER_ACKNOWLEDGEMENT_REQUIRED');
  if (!Array.isArray(register.items) || register.items.length !== 13) throw new Error('C34_ITEM_COUNT_INVALID');

  const expectedKeys = acquisitionMap.requests.map((request) => request.requestKey);
  const c33Keys = c33Register.items.map((item) => item.requestKey);
  const actualKeys = register.items.map((item) => item && item.requestKey);
  if (new Set(actualKeys).size !== 13) throw new Error('C34_DUPLICATE_REQUEST_KEY');
  if (expectedKeys.some((key) => !actualKeys.includes(key)) || actualKeys.some((key) => !expectedKeys.includes(key))) throw new Error('C34_REQUEST_KEY_SET_MISMATCH');
  if (c33Keys.some((key) => !actualKeys.includes(key))) throw new Error('C34_C33_KEY_SET_MISMATCH');

  const normalized = register.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('C34_ITEM_INVALID');
    const requestKey = requireText(item.requestKey, 'C34_REQUEST_KEY_REQUIRED');
    if (item.accountableOwnerRef !== ownerRef) throw new Error(`C34_MULTI_OWNER_CONFLICT:${requestKey}`);
    if (item.accountableOwnerContactRef !== ownerContactRef) throw new Error(`C34_OWNER_CONTACT_MISMATCH:${requestKey}`);

    const evidenceProviderRef = item.evidenceProviderRef == null ? null : requireText(item.evidenceProviderRef, `C34_EVIDENCE_PROVIDER_INVALID:${requestKey}`);
    const independentReviewerRef = item.independentReviewerRef == null ? null : requireText(item.independentReviewerRef, `C34_REVIEWER_INVALID:${requestKey}`);
    const requestSentAt = item.requestSentAt == null ? null : item.requestSentAt;
    const responseReceivedAt = item.responseReceivedAt == null ? null : item.responseReceivedAt;

    if (requestSentAt !== null && !isIsoTimestamp(requestSentAt)) throw new Error(`C34_SENT_TIMESTAMP_INVALID:${requestKey}`);
    if (responseReceivedAt !== null && !isIsoTimestamp(responseReceivedAt)) throw new Error(`C34_RESPONSE_TIMESTAMP_INVALID:${requestKey}`);
    if (responseReceivedAt !== null && requestSentAt === null) throw new Error(`C34_RESPONSE_WITHOUT_SEND:${requestKey}`);
    if (item.evidenceSatisfied === true) throw new Error(`C34_EVIDENCE_CANNOT_BE_SATISFIED_BY_ACCOUNTABILITY_ASSIGNMENT:${requestKey}`);

    return Object.freeze({
      requestKey,
      accountableOwnerRef: ownerRef,
      accountableOwnerContactRef: ownerContactRef,
      evidenceProviderRef,
      independentReviewerRef,
      requestSentAt,
      responseReceivedAt,
      evidenceSatisfied: false,
    });
  });

  return Object.freeze({ ownerRef, ownerContactRef, items: Object.freeze(normalized) });
}

function buildSingleOwnerGovernance({ acquisitionMap, c33Register, c34Register }) {
  const result = validateSingleOwnerRegister(c34Register, acquisitionMap, c33Register);
  const items = result.items;
  const providerAssignedCount = items.filter((item) => item.evidenceProviderRef !== null).length;
  const reviewerAssignedCount = items.filter((item) => item.independentReviewerRef !== null).length;
  const sentCount = items.filter((item) => item.requestSentAt !== null).length;
  const responseReceivedCount = items.filter((item) => item.responseReceivedAt !== null).length;

  let programState = PROGRAM_STATE.OWNER_ASSIGNED_EVIDENCE_REQUIRED;
  if (sentCount > 0 && responseReceivedCount < 13) programState = PROGRAM_STATE.ACTIVITY_IN_PROGRESS;
  if (responseReceivedCount === 13) programState = PROGRAM_STATE.RECEIVED_PENDING_VALIDATION;

  return Object.freeze({
    schemaVersion: 1,
    scope: 'C34_SINGLE_ACCOUNTABLE_OWNER_GOVERNANCE',
    totalRequiredItems: 13,
    singleAccountableOwner: true,
    accountableOwnerRef: result.ownerRef,
    accountableOwnerContactRef: result.ownerContactRef,
    accountableOwnerAssignedCount: 13,
    accountableOwnerAcknowledgedCount: 13,
    requestPacketReadyCount: 13,
    evidenceProviderAssignedCount: providerAssignedCount,
    independentReviewerAssignedCount: reviewerAssignedCount,
    sentCount,
    responseReceivedCount,
    evidenceSatisfiedCount: 0,
    realEvidenceWorkOutstandingCount: 13,
    programState,
    accountabilityAssignmentIsEvidence: false,
    accountabilityAssignmentEstablishesIndependence: false,
    readyForReleaseDecision: false,
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
  const result = buildSingleOwnerGovernance({
    acquisitionMap: readJson(ACQUISITION_MAP_PATH),
    c33Register: readJson(C33_REGISTER_PATH),
    c34Register: readJson(C34_REGISTER_PATH),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  try { runCli(); } catch (error) {
    console.error(`C34_SINGLE_ACCOUNTABLE_OWNER=FAIL ${error.message}`);
    process.exit(1);
  }
}

module.exports = Object.freeze({
  PROGRAM_STATE,
  validateSingleOwnerRegister,
  buildSingleOwnerGovernance,
  runCli,
});

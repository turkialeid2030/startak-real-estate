'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const AUDIT_PATH = path.join(ROOT, 'release/evidence/c39-historical-evidence-reuse-audit.json');

const EXPECTED_BASE_HEAD = '99c154ed5738e9973bc75971b1a54ec32adc9551';
const EXPECTED_CANDIDATE_HEAD = '2f066168f6cdca672d668ff5367ab250fe5cb907';
const EXPECTED_SOURCE_SHA = 'ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71';

const EXPECTED_GATES = Object.freeze([
  ['C30', 'SECURITY_REVIEW_AUTHORIZATION', 545],
  ['C30', 'PRIVACY_REVIEW_AUTHORIZATION', 546],
  ['C30', 'AI_PROVIDER_PRODUCTION_AUTHORIZATION', 547],
  ['C30', 'SOURCE_RIGHTS_AUTHORIZATION', 548],
  ['C30', 'UAT_HUMAN_APPROVAL', 549],
  ['C30', 'HISTORICAL_REPLAY_EVIDENCE', 550],
  ['C30', 'ROLLBACK_OPERATIONAL_VERIFICATION', 551],
  ['C30', 'LEGAL_REGULATORY_APPROVAL', 552],
  ['C31', 'COMPOSITE_BASELINE_SHADOW', 559],
  ['C31', 'FRESH_COMPOSITE_SHADOW', 560],
  ['C31', 'SUCCESSOR_FRESH_COMPOSITE_SHADOW', 561],
  ['C31', 'COMPOSITE_CUTOVER_SAFETY', 562],
  ['C31', 'CANONICAL_SOURCE_HASH', 563],
]);

const ALLOWED_ELIGIBILITY = new Set([
  'ENGINEERING_ONLY_EXTERNAL_REVIEW_NOT_PRESENT',
  'EXTERNAL_REVIEW_PENDING_NO_CURRENT_APPROVAL',
  'PROVIDER_AUTHORIZATION_NOT_PRESENT',
  'PARTIAL_HISTORICAL_CONTEXT_REQUIRES_CURRENT_AUTHORIZATION',
  'ENGINEERING_HARNESS_NOT_HUMAN_EVIDENCE',
  'SYNTHETIC_CAPABILITY_REAL_INPUT_NOT_PRESENT',
  'CURRENT_CANDIDATE_EVIDENCE_PENDING_REQUIRED_REVIEW',
  'CURRENT_REAL_INPUTS_NOT_SUPPLIED',
  'HISTORICAL_SOURCE_BYTES_UNAVAILABLE_CURRENT_SOURCE_NOT_SUPPLIED',
]);

const EXPECTED_SUMMARY = Object.freeze({
  currentSatisfied: 0,
  automaticReuseEligible: 0,
  currentCandidateEvidencePendingRequiredReview: 1,
  externalReviewPendingNoCurrentApproval: 2,
  engineeringOrSyntheticNotExternalEvidence: 3,
  providerAuthorizationNotPresent: 1,
  partialHistoricalContextRequiresCurrentAuthorization: 1,
  currentRealInputsNotSupplied: 4,
  historicalSourceBytesUnavailableCurrentSourceNotSupplied: 1,
});

const AUTHORITY_KEYS = Object.freeze([
  'releaseDecisionAuthorized',
  'canonicalBaselineActivationAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'transactionAuthority',
  'approvalAuthorized',
  'publicAiAuthorized',
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function readAudit() {
  return JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function countEligibility(gates, eligibility) {
  return gates.filter((g) => g.eligibility === eligibility).length;
}

function validate(audit = readAudit()) {
  if (audit.schemaVersion !== 1) fail('C39_SCHEMA_INVALID');
  if (audit.scope !== 'C39_HISTORICAL_EVIDENCE_REUSE_ELIGIBILITY_AUDIT') fail('C39_SCOPE_INVALID');
  if (audit.auditIssue !== 596) fail('C39_AUDIT_ISSUE_INVALID');
  if (audit.auditBaseHeadSha !== EXPECTED_BASE_HEAD) fail('C39_BASE_HEAD_INVALID');
  if (audit.currentQualifiedReleaseCandidateHeadSha !== EXPECTED_CANDIDATE_HEAD) fail('C39_CANDIDATE_HEAD_INVALID');
  if (audit.auditRule !== 'HISTORICAL_CONTEXT_MAY_SUPPORT_NEW_REVIEW_BUT_NEVER_AUTO_SATISFIES_CURRENT_GATE') fail('C39_AUDIT_RULE_INVALID');
  if (audit.automaticReuseAllowed !== false) fail('C39_AUTOMATIC_REUSE_MUST_BE_FALSE');
  if (audit.gateCount !== EXPECTED_GATES.length) fail('C39_GATE_COUNT_DECLARATION_INVALID');
  if (!Array.isArray(audit.gates) || audit.gates.length !== EXPECTED_GATES.length) fail('C39_GATE_COUNT_INVALID');

  const seenGateIds = new Set();
  const seenIssues = new Set();
  let satisfiedCount = 0;
  let automaticReuseCount = 0;

  audit.gates.forEach((gate, index) => {
    const [framework, gateId, currentIssue] = EXPECTED_GATES[index];
    if (!gate || typeof gate !== 'object') fail(`C39_GATE_INVALID:${index + 1}`);
    if (gate.order !== index + 1) fail(`C39_GATE_ORDER_INVALID:${gateId}`);
    if (gate.framework !== framework) fail(`C39_FRAMEWORK_INVALID:${gateId}`);
    if (gate.gateId !== gateId) fail(`C39_GATE_ID_INVALID:${index + 1}`);
    if (gate.currentIssue !== currentIssue) fail(`C39_CURRENT_ISSUE_INVALID:${gateId}`);
    if (seenGateIds.has(gate.gateId)) fail(`C39_DUPLICATE_GATE:${gate.gateId}`);
    if (seenIssues.has(gate.currentIssue)) fail(`C39_DUPLICATE_CURRENT_ISSUE:${gate.currentIssue}`);
    seenGateIds.add(gate.gateId);
    seenIssues.add(gate.currentIssue);

    if (!ALLOWED_ELIGIBILITY.has(gate.eligibility)) fail(`C39_ELIGIBILITY_INVALID:${gateId}`);
    if (gate.currentSatisfied !== false) {
      satisfiedCount += 1;
      fail(`C39_FALSE_CURRENT_SATISFACTION:${gateId}`);
    }
    if (gate.automaticReuse !== false) {
      automaticReuseCount += 1;
      fail(`C39_FALSE_AUTOMATIC_REUSE:${gateId}`);
    }
    if (typeof gate.historicalContextReusable !== 'boolean') fail(`C39_CONTEXT_REUSE_FLAG_INVALID:${gateId}`);
    if (!Array.isArray(gate.historicalRefs) || gate.historicalRefs.length === 0) fail(`C39_HISTORICAL_REFS_MISSING:${gateId}`);
    const refs = new Set();
    for (const ref of gate.historicalRefs) {
      if (!Number.isInteger(ref) || ref <= 0) fail(`C39_HISTORICAL_REF_INVALID:${gateId}`);
      if (refs.has(ref)) fail(`C39_DUPLICATE_HISTORICAL_REF:${gateId}:${ref}`);
      refs.add(ref);
    }
    if (!Array.isArray(gate.reasonCodes) || gate.reasonCodes.length === 0) fail(`C39_REASON_CODES_MISSING:${gateId}`);
    for (const code of gate.reasonCodes) {
      if (typeof code !== 'string' || !/^[A-Z0-9_]+$/.test(code)) fail(`C39_REASON_CODE_INVALID:${gateId}`);
    }
    if (typeof gate.nextAction !== 'string' || !gate.nextAction.trim()) fail(`C39_NEXT_ACTION_MISSING:${gateId}`);

    if (framework === 'C30') {
      if (!['NOT_SUPPLIED', 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW'].includes(gate.currentGateState)) {
        fail(`C39_C30_STATE_ESCALATED:${gateId}`);
      }
    } else if (gate.currentGateState !== 'NOT_EVALUATED') {
      fail(`C39_C31_STATE_ESCALATED:${gateId}`);
    }
  });

  const rollback = audit.gates[6];
  if (rollback.eligibility !== 'CURRENT_CANDIDATE_EVIDENCE_PENDING_REQUIRED_REVIEW') fail('C39_ROLLBACK_CLASSIFICATION_INVALID');
  if (rollback.currentGateState !== 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW') fail('C39_ROLLBACK_STATE_INVALID');

  const canonicalSource = audit.gates[12];
  if (canonicalSource.eligibility !== 'HISTORICAL_SOURCE_BYTES_UNAVAILABLE_CURRENT_SOURCE_NOT_SUPPLIED') fail('C39_CANONICAL_SOURCE_CLASSIFICATION_INVALID');
  if (canonicalSource.expectedSha256 !== EXPECTED_SOURCE_SHA) fail('C39_CANONICAL_SOURCE_EXPECTED_HASH_INVALID');
  if (canonicalSource.historicalContextReusable !== false) fail('C39_CANONICAL_SOURCE_CONTEXT_MUST_NOT_SUBSTITUTE_BYTES');

  const derivedSummary = {
    currentSatisfied: satisfiedCount,
    automaticReuseEligible: automaticReuseCount,
    currentCandidateEvidencePendingRequiredReview: countEligibility(audit.gates, 'CURRENT_CANDIDATE_EVIDENCE_PENDING_REQUIRED_REVIEW'),
    externalReviewPendingNoCurrentApproval: countEligibility(audit.gates, 'EXTERNAL_REVIEW_PENDING_NO_CURRENT_APPROVAL'),
    engineeringOrSyntheticNotExternalEvidence:
      countEligibility(audit.gates, 'ENGINEERING_ONLY_EXTERNAL_REVIEW_NOT_PRESENT') +
      countEligibility(audit.gates, 'ENGINEERING_HARNESS_NOT_HUMAN_EVIDENCE') +
      countEligibility(audit.gates, 'SYNTHETIC_CAPABILITY_REAL_INPUT_NOT_PRESENT'),
    providerAuthorizationNotPresent: countEligibility(audit.gates, 'PROVIDER_AUTHORIZATION_NOT_PRESENT'),
    partialHistoricalContextRequiresCurrentAuthorization: countEligibility(audit.gates, 'PARTIAL_HISTORICAL_CONTEXT_REQUIRES_CURRENT_AUTHORIZATION'),
    currentRealInputsNotSupplied: countEligibility(audit.gates, 'CURRENT_REAL_INPUTS_NOT_SUPPLIED'),
    historicalSourceBytesUnavailableCurrentSourceNotSupplied: countEligibility(audit.gates, 'HISTORICAL_SOURCE_BYTES_UNAVAILABLE_CURRENT_SOURCE_NOT_SUPPLIED'),
  };

  for (const [key, expected] of Object.entries(EXPECTED_SUMMARY)) {
    if (derivedSummary[key] !== expected) fail(`C39_DERIVED_SUMMARY_INVALID:${key}`);
    if (!audit.summary || audit.summary[key] !== expected) fail(`C39_RECORDED_SUMMARY_INVALID:${key}`);
  }
  if (audit.summary.decision !== 'NO_CURRENT_GATE_CAN_BE_AUTO_SATISFIED_FROM_HISTORICAL_REPOSITORY_RECORDS') fail('C39_DECISION_INVALID');

  if (!audit.authority || typeof audit.authority !== 'object') fail('C39_AUTHORITY_BLOCK_MISSING');
  for (const key of AUTHORITY_KEYS) {
    if (audit.authority[key] !== false) fail(`C39_AUTHORITY_ESCALATION:${key}`);
  }

  return {
    schemaVersion: 1,
    scope: 'C39_HISTORICAL_EVIDENCE_REUSE_AUDIT_SUMMARY',
    gateCount: audit.gates.length,
    currentSatisfied: 0,
    automaticReuseEligible: 0,
    currentCandidateEvidencePendingRequiredReview: derivedSummary.currentCandidateEvidencePendingRequiredReview,
    externalReviewPendingNoCurrentApproval: derivedSummary.externalReviewPendingNoCurrentApproval,
    engineeringOrSyntheticNotExternalEvidence: derivedSummary.engineeringOrSyntheticNotExternalEvidence,
    providerAuthorizationNotPresent: derivedSummary.providerAuthorizationNotPresent,
    partialHistoricalContextRequiresCurrentAuthorization: derivedSummary.partialHistoricalContextRequiresCurrentAuthorization,
    currentRealInputsNotSupplied: derivedSummary.currentRealInputsNotSupplied,
    historicalSourceBytesUnavailableCurrentSourceNotSupplied: derivedSummary.historicalSourceBytesUnavailableCurrentSourceNotSupplied,
    rollbackCurrentCandidateEvidencePendingReview: true,
    historicalContextAutoSatisfiesAnyGate: false,
    c30DecisionEffect: 'HOLD',
    c31DecisionEffect: 'HOLD_CANONICAL_INPUTS_REQUIRED',
    releaseDecisionAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    auditArtifactSha256: sha256File(AUDIT_PATH),
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(validate(), null, 2)}\n`);
}

module.exports = {
  validate,
  EXPECTED_GATES,
  ALLOWED_ELIGIBILITY,
  EXPECTED_SUMMARY,
  AUTHORITY_KEYS,
};

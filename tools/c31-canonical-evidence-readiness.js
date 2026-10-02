'use strict';

const {
  STATUS: COMPOSITE_STATUS,
  evaluateCompositeBaselineShadowFromEnvironment,
} = require('./composite-baseline-shadow-release-gate');
const {
  STATUS: FRESH_STATUS,
  evaluateFreshCompositeShadowFromEnvironment,
} = require('./fresh-composite-shadow-release-gate');
const {
  STATUS: SUCCESSOR_STATUS,
  evaluateSuccessorFreshCompositeShadowFromEnvironment,
} = require('./successor-fresh-composite-shadow-release-gate');
const {
  STATUS: CUTOVER_STATUS,
  evaluateCompositeBaselineCutoverSafetyFromEnvironment,
} = require('./composite-baseline-cutover-safety-gate');
const {
  EXPECTED_CANONICAL_SHA256,
  CANONICAL_SOURCE_STATUS,
  evaluateCanonicalSourceEvidence,
} = require('./canonical-source-evidence');

const READINESS_STATE = Object.freeze({
  HOLD: 'HOLD_CANONICAL_INPUTS_REQUIRED',
  NO_GO: 'NO_GO_CANONICAL_REMEDIATION_REQUIRED',
  COMPLETE: 'CANONICAL_EVIDENCE_COMPLETE_AWAITING_INDEPENDENT_ACTIVATION_DECISION',
});

const GATE_IDS = Object.freeze([
  'COMPOSITE_BASELINE_SHADOW',
  'FRESH_COMPOSITE_SHADOW',
  'SUCCESSOR_FRESH_COMPOSITE_SHADOW',
  'COMPOSITE_CUTOVER_SAFETY',
  'CANONICAL_SOURCE_HASH',
]);

function freezeGate(id, result) {
  return Object.freeze({
    gateId: id,
    status: result.status,
    verified: result.verified === true,
    reasonCode: result.reasonCode || null,
  });
}

function summarizeCanonicalGateResults(gates) {
  if (!Array.isArray(gates) || gates.length !== GATE_IDS.length) {
    throw new Error('C31_CANONICAL_GATE_SET_INVALID');
  }
  const ids = gates.map((gate) => gate && gate.gateId);
  if (new Set(ids).size !== GATE_IDS.length || GATE_IDS.some((id) => !ids.includes(id))) {
    throw new Error('C31_CANONICAL_GATE_IDS_INVALID');
  }

  const verifiedCount = gates.filter((gate) => gate.verified === true || gate.status === 'VERIFIED').length;
  const remediationCount = gates.filter((gate) => gate.status === 'HOLD' || gate.status === 'MISMATCH').length;
  const missingCount = gates.filter((gate) => gate.status === 'NOT_EVALUATED' || gate.status === 'MISSING_REQUIRED').length;

  let readinessState = READINESS_STATE.HOLD;
  if (remediationCount > 0) readinessState = READINESS_STATE.NO_GO;
  else if (verifiedCount === GATE_IDS.length) readinessState = READINESS_STATE.COMPLETE;

  return Object.freeze({
    requiredCanonicalGateCount: GATE_IDS.length,
    verifiedCount,
    missingCount,
    remediationCount,
    readinessState,
    readyForIndependentActivationDecision: readinessState === READINESS_STATE.COMPLETE,
    canonicalBaselineActivationAuthorized: false,
    releaseDecisionAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
  });
}

function evaluateCanonicalEvidenceReadiness({ env = process.env } = {}) {
  const composite = evaluateCompositeBaselineShadowFromEnvironment({ env });
  const fresh = evaluateFreshCompositeShadowFromEnvironment({ env });
  const successor = evaluateSuccessorFreshCompositeShadowFromEnvironment({ env });
  const cutover = evaluateCompositeBaselineCutoverSafetyFromEnvironment({ env });
  const canonicalSource = evaluateCanonicalSourceEvidence({
    filePath: env.CANONICAL_ORIGINAL_PATH,
    expectedSha256: EXPECTED_CANONICAL_SHA256,
    requireEvidence: env.REQUIRE_CANONICAL_SOURCE_HASH === '1',
  });

  const gates = Object.freeze([
    freezeGate('COMPOSITE_BASELINE_SHADOW', composite),
    freezeGate('FRESH_COMPOSITE_SHADOW', fresh),
    freezeGate('SUCCESSOR_FRESH_COMPOSITE_SHADOW', successor),
    freezeGate('COMPOSITE_CUTOVER_SAFETY', cutover),
    freezeGate('CANONICAL_SOURCE_HASH', canonicalSource),
  ]);
  const summary = summarizeCanonicalGateResults(gates);

  return Object.freeze({
    schemaVersion: 1,
    scope: 'C31_CANONICAL_EVIDENCE_READINESS_ONLY',
    authoritativeMode: 'LEGACY_FILE_SHA256',
    proposedMode: 'GOVERNED_COMPOSITE_BASELINE',
    expectedCanonicalSourceSha256: EXPECTED_CANONICAL_SHA256,
    gates,
    ...summary,
  });
}

function runCli(env = process.env) {
  const result = evaluateCanonicalEvidenceReadiness({ env });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(`C31_CANONICAL_EVIDENCE_READINESS=FAIL ${error.message}`);
    process.exit(1);
  }
}

module.exports = Object.freeze({
  READINESS_STATE,
  GATE_IDS,
  summarizeCanonicalGateResults,
  evaluateCanonicalEvidenceReadiness,
  runCli,
  COMPOSITE_STATUS,
  FRESH_STATUS,
  SUCCESSOR_STATUS,
  CUTOVER_STATUS,
  CANONICAL_SOURCE_STATUS,
});

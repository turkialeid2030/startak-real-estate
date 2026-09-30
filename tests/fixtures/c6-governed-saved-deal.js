'use strict';

const {
  C3_VALUATION_RECONCILIATION_SCHEMA_VERSION,
  RECONCILIATION_GATE_STATUS,
  VALUATION_VALUE_SCOPE,
} = require('../../src/contracts/valuation-reconciliation');
const {
  computeC3ResultHash,
  buildGovernedDealDecision,
} = require('../../src/decision-intelligence/governed-deal-decision');

function hash(char) {
  return char.repeat(64);
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function buildC6SavedDeal({ now = new Date(), id = 'DEAL-C6-001' } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new TypeError('valid now required');
  const reconciliationAsOf = iso(nowMs - 60 * 60 * 1000);
  const decisionGeneratedAt = iso(nowMs - 30 * 60 * 1000);
  const savedAt = iso(nowMs - 20 * 60 * 1000);
  const valuationDate = iso(Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), new Date(nowMs).getUTCDate()));

  const method = {
    id: 'market-c6',
    approachFamily: 'MARKET',
    valueScope: 'WHOLE_PROPERTY',
    modelVersion: 'WHOLE_PROPERTY_SALES_COMPARISON_1.0',
    sourceStatus: 'WHOLE_PROPERTY_MARKET_VALUE_INDICATION_READY',
    propertyRef: 'PROPERTY-C6-001',
    valuationDate,
    valueSar: 11200000,
    calculationHashSha256: hash('1'),
    sourceResultHashSha256: hash('2'),
    verifiedBy: 'reviewer-c6',
    verificationReference: 'VERIFY-C6',
    verifiedAt: iso(nowMs - 90 * 60 * 1000),
    blockers: [],
  };
  const core = {
    version: 'C3_VALUATION_RECONCILIATION_GOVERNANCE_V1',
    schemaVersion: C3_VALUATION_RECONCILIATION_SCHEMA_VERSION,
    propertyRef: 'PROPERTY-C6-001',
    valuationDate,
    valuationScope: VALUATION_VALUE_SCOPE.WHOLE_PROPERTY,
    asOf: reconciliationAsOf,
    status: RECONCILIATION_GATE_STATUS.READY,
    decisionReady: true,
    reconciliationPolicyId: 'C6-FIXTURE-POLICY',
    dependencyStatus: { c1: 'READY', c2: 'READY' },
    marketContextBinding: { bindingId: 'C6-MARKET-CONTEXT' },
    methodCoverage: {
      eligibleMethodCount: 1,
      eligibleApproachFamilies: ['MARKET'],
      requiredApproachFamilies: ['MARKET'],
      requiredFamilyCoverageRatio: 1,
    },
    eligibleMethodIndications: [method],
    reconciliationInstruction: { instructionId: 'C6-REC' },
    weightedTrace: [],
    candidateWeightedValueSar: 11200000,
    analyticalRangeLowSar: 10800000,
    analyticalRangeHighSar: 11600000,
    spreadRatio: 800000 / 11200000,
    analyticalConfidenceClass: 'MODERATE',
    analyticalValueIndicationSar: 11200000,
    blockers: [],
    warnings: [],
  };
  const reconciliation = {
    ...core,
    resultHashSha256: computeC3ResultHash(core),
    c1ReevaluatedInternally: true,
    c2ReevaluatedInternally: true,
    marketContextBindingRequired: true,
    valuationScopeEnforced: true,
    professionalReconciliationInstructionUsed: true,
    automaticMethodSelection: false,
    automaticReconciliationWeightsGenerated: false,
    statisticalConfidenceClaimed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'C6 regression fixture',
  };

  const decision = buildGovernedDealDecision({
    caseId: 'CASE-C6-001',
    projectId: 'PROJECT-C6-001',
    propertyRef: 'PROPERTY-C6-001',
    valuationDate,
    reconciliation,
    evidenceLineage: {
      c1ResultHashSha256: hash('a'),
      c2ResultHashSha256: hash('b'),
      reconciliationResultHashSha256: reconciliation.resultHashSha256,
      sourceEvidenceHashes: [hash('c')],
      methodSourceResultHashesById: { 'market-c6': hash('2') },
    },
    generatedAt: decisionGeneratedAt,
    maxReconciliationAgeHours: 24,
    humanReview: null,
  });

  return {
    id,
    name: 'C6 governed browser deal',
    mode: 'building',
    inputs: { buildingPrice: 12000000, rentPerSqm: 1500 },
    savedAt,
    valuationCase: {
      schemaVersion: 1,
      projectId: 'PROJECT-C6-001',
      classification: {},
      incomePolicy: {},
    },
    governedDealDecision: decision,
  };
}

module.exports = { buildC6SavedDeal };

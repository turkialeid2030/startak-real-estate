'use strict';

const assert = require('assert');
const {
  C4_DECISION_STATUS,
  C4_REVIEW_RECOMMENDATION,
  C4_REPORT_CLASSIFICATION,
} = require('../../src/contracts/governed-deal-decision');
const {
  C3_VALUATION_RECONCILIATION_SCHEMA_VERSION,
  RECONCILIATION_GATE_STATUS,
  RECONCILIATION_CONFIDENCE_CLASS,
  VALUATION_VALUE_SCOPE,
} = require('../../src/contracts/valuation-reconciliation');
const {
  computeC3ResultHash,
  buildGovernedDealDecision,
  validateGovernedDealDecisionSnapshot,
  buildGovernedDealDecisionReport,
} = require('../../src/decision-intelligence/governed-deal-decision');
const {
  withGovernedDealDecision,
  governedDealDecisionFromSavedDeal,
} = require('../../src/app/valuation-saved-deal-bridge');

function hash(char) {
  return char.repeat(64);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectCode(code, fn) {
  assert.throws(fn, (error) => error && error.code === code, `expected ${code}`);
}

function readyReconciliation() {
  const methods = [
    {
      id: 'market-whole-property',
      approachFamily: 'MARKET',
      valueScope: 'WHOLE_PROPERTY',
      modelVersion: 'WHOLE_PROPERTY_SALES_COMPARISON_1.0',
      sourceStatus: 'WHOLE_PROPERTY_MARKET_VALUE_INDICATION_READY',
      propertyRef: 'PROPERTY-C4-001',
      valuationDate: '2026-09-29T00:00:00.000Z',
      valueSar: 12605000,
      calculationHashSha256: hash('1'),
      sourceResultHashSha256: hash('2'),
      verifiedBy: 'valuation-reviewer-1',
      verificationReference: 'VR-MARKET-001',
      verifiedAt: '2026-09-30T07:00:00.000Z',
      blockers: [],
    },
    {
      id: 'income-direct-cap',
      approachFamily: 'INCOME',
      valueScope: 'WHOLE_PROPERTY',
      modelVersion: 'DIRECT_CAPITALIZATION_1.0',
      sourceStatus: 'DIRECT_CAPITALIZATION_VALUE_INDICATION_READY',
      propertyRef: 'PROPERTY-C4-001',
      valuationDate: '2026-09-29T00:00:00.000Z',
      valueSar: 10000000,
      calculationHashSha256: hash('3'),
      sourceResultHashSha256: hash('4'),
      verifiedBy: 'valuation-reviewer-1',
      verificationReference: 'VR-INCOME-001',
      verifiedAt: '2026-09-30T07:05:00.000Z',
      blockers: [],
    },
    {
      id: 'cost-approach',
      approachFamily: 'COST',
      valueScope: 'WHOLE_PROPERTY',
      modelVersion: 'COST_APPROACH_1.0',
      sourceStatus: 'VALUE_INDICATION_READY_FOR_RECONCILIATION',
      propertyRef: 'PROPERTY-C4-001',
      valuationDate: '2026-09-29T00:00:00.000Z',
      valueSar: 9600000,
      calculationHashSha256: hash('5'),
      sourceResultHashSha256: hash('6'),
      verifiedBy: 'valuation-reviewer-1',
      verificationReference: 'VR-COST-001',
      verifiedAt: '2026-09-30T07:10:00.000Z',
      blockers: [],
    },
  ];

  const core = {
    version: 'C3_VALUATION_RECONCILIATION_GOVERNANCE_V1',
    schemaVersion: C3_VALUATION_RECONCILIATION_SCHEMA_VERSION,
    propertyRef: 'PROPERTY-C4-001',
    valuationDate: '2026-09-29T00:00:00.000Z',
    valuationScope: VALUATION_VALUE_SCOPE.WHOLE_PROPERTY,
    asOf: '2026-09-30T08:00:00.000Z',
    status: RECONCILIATION_GATE_STATUS.READY,
    decisionReady: true,
    reconciliationPolicyId: 'C3-WHOLE-PROPERTY-THREE-APPROACH-POLICY',
    dependencyStatus: { c1: 'READY', c2: 'READY' },
    marketContextBinding: {
      bindingId: 'MCB-C4-001',
      propertyRef: 'PROPERTY-C4-001',
      marketContextId: 'MARKET-C4-001',
      geographyKey: 'RIYADH-C4',
      assetType: 'MIXED_USE',
      boundBy: 'market-context-binder-1',
      bindingReference: 'MCB-REF-001',
      boundAt: '2026-09-30T06:45:00.000Z',
    },
    methodCoverage: {
      eligibleMethodCount: 3,
      eligibleApproachFamilies: ['MARKET', 'INCOME', 'COST'],
      requiredApproachFamilies: ['MARKET', 'INCOME', 'COST'],
      requiredFamilyCoverageRatio: 1,
    },
    eligibleMethodIndications: methods,
    reconciliationInstruction: {
      instructionId: 'REC-C4-001',
      rationale: 'Professionally reviewed three-approach reconciliation fixture.',
      reconciledBy: 'reconciler-1',
      reconciliationReference: 'REC-REF-001',
      reconciledAt: '2026-09-30T07:30:00.000Z',
      weightsByIndicationId: {
        'market-whole-property': 0.3,
        'income-direct-cap': 0.4,
        'cost-approach': 0.3,
      },
      approachWeights: { MARKET: 0.3, INCOME: 0.4, COST: 0.3 },
    },
    weightedTrace: [
      { indicationId: 'market-whole-property', approachFamily: 'MARKET', valueScope: 'WHOLE_PROPERTY', modelVersion: 'WHOLE_PROPERTY_SALES_COMPARISON_1.0', valueSar: 12605000, weight: 0.3, contributionSar: 3781500, calculationHashSha256: hash('1') },
      { indicationId: 'income-direct-cap', approachFamily: 'INCOME', valueScope: 'WHOLE_PROPERTY', modelVersion: 'DIRECT_CAPITALIZATION_1.0', valueSar: 10000000, weight: 0.4, contributionSar: 4000000, calculationHashSha256: hash('3') },
      { indicationId: 'cost-approach', approachFamily: 'COST', valueScope: 'WHOLE_PROPERTY', modelVersion: 'COST_APPROACH_1.0', valueSar: 9600000, weight: 0.3, contributionSar: 2880000, calculationHashSha256: hash('5') },
    ],
    candidateWeightedValueSar: 10661500,
    analyticalRangeLowSar: 9600000,
    analyticalRangeHighSar: 12605000,
    spreadRatio: 3005000 / 10661500,
    analyticalConfidenceClass: RECONCILIATION_CONFIDENCE_CLASS.MODERATE,
    analyticalValueIndicationSar: 10661500,
    blockers: [],
    warnings: [],
  };

  return {
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
    semantics: 'fixture',
  };
}

function lineageFor(reconciliation) {
  return {
    c1ResultHashSha256: hash('a'),
    c2ResultHashSha256: hash('b'),
    reconciliationResultHashSha256: reconciliation.resultHashSha256,
    sourceEvidenceHashes: [hash('c'), hash('d')],
    methodSourceResultHashesById: Object.fromEntries(
      reconciliation.eligibleMethodIndications.map((method) => [method.id, method.sourceResultHashSha256]),
    ),
  };
}

function decisionInput(overrides = {}) {
  const reconciliation = overrides.reconciliation || readyReconciliation();
  return {
    caseId: 'CASE-C4-001',
    projectId: 'PROJECT-C4-001',
    propertyRef: 'PROPERTY-C4-001',
    valuationDate: '2026-09-29T00:00:00.000Z',
    reconciliation,
    evidenceLineage: lineageFor(reconciliation),
    generatedAt: '2026-09-30T09:00:00.000Z',
    maxReconciliationAgeHours: 24,
    humanReview: null,
    ...overrides,
  };
}

(function run() {
  const reconciliation = readyReconciliation();
  assert.strictEqual(reconciliation.resultHashSha256, computeC3ResultHash(reconciliation));

  const pendingReview = buildGovernedDealDecision(decisionInput({ reconciliation }));
  assert.strictEqual(pendingReview.status, C4_DECISION_STATUS.READY_FOR_HUMAN_REVIEW);
  assert.strictEqual(pendingReview.authorityBoundary.commercialGoLive, 'HOLD');
  assert.strictEqual(pendingReview.authorityBoundary.transactionAuthority, false);
  assert.strictEqual(pendingReview.authorityBoundary.publicAi, false);
  assert.strictEqual(pendingReview.authorityBoundary.canonicalBaselineActivationAuthorized, false);
  assert.strictEqual(pendingReview.authorityBoundary.approvalAuthorized, false);
  assert.strictEqual(pendingReview.transactionReady, false);
  assert.strictEqual(pendingReview.humanDecisionRequired, true);
  assert.strictEqual(validateGovernedDealDecisionSnapshot(pendingReview), true);

  const reviewed = buildGovernedDealDecision(decisionInput({
    reconciliation,
    humanReview: {
      reviewerId: 'investment-reviewer-7',
      recommendation: C4_REVIEW_RECOMMENDATION.CONTINUE_DUE_DILIGENCE,
      rationale: 'Continue diligence subject to separate approval authority and unresolved commercial execution gates.',
      reviewedAt: '2026-09-30T08:30:00.000Z',
    },
  }));
  assert.strictEqual(reviewed.status, C4_DECISION_STATUS.REVIEW_RECOMMENDATION_RECORDED);
  assert.strictEqual(reviewed.humanReview.recommendation, C4_REVIEW_RECOMMENDATION.CONTINUE_DUE_DILIGENCE);
  assert.strictEqual(reviewed.humanReview.approvalEstablished, false);
  assert.strictEqual(reviewed.humanReview.transactionAuthorized, false);
  assert.strictEqual(reviewed.authorityBoundary.approvalAuthorized, false);
  assert.strictEqual(validateGovernedDealDecisionSnapshot(reviewed), true);

  const saved = withGovernedDealDecision({ id: 'DEAL-C4-001', mode: 'building' }, reviewed);
  const reloaded = governedDealDecisionFromSavedDeal(saved);
  assert.deepStrictEqual(reloaded, clone(reviewed));
  assert.strictEqual(reloaded.authorityBoundary.transactionAuthority, false);
  assert.strictEqual(reloaded.authorityBoundary.approvalAuthorized, false);

  const report = buildGovernedDealDecisionReport({
    reportId: 'REPORT-C4-001',
    decisionSnapshot: reviewed,
    generatedAt: '2026-09-30T09:05:00.000Z',
  });
  assert.strictEqual(report.classification, C4_REPORT_CLASSIFICATION.NON_AUTHORIZING_ANALYTICAL_OUTPUT);
  assert(report.disclosures.includes('NON_AUTHORIZING_ANALYTICAL_OUTPUT'));
  assert(report.disclosures.includes('NOT_A_FINAL_OR_CERTIFIED_VALUATION'));
  assert(report.disclosures.includes('REVIEWER_RECOMMENDATION_DOES_NOT_EQUAL_APPROVAL'));
  assert.strictEqual(report.approval.status, 'NOT_ESTABLISHED');
  assert.strictEqual(report.approval.authorized, false);
  assert.strictEqual(report.approval.transactionAuthorized, false);
  assert.strictEqual(report.authorityBoundary.transactionAuthority, false);
  assert.strictEqual(report.authorityBoundary.publicAi, false);
  assert.strictEqual(report.authorityBoundary.commercialGoLive, 'HOLD');
  assert.strictEqual(report.reviewerRecommendation.recommendation, C4_REVIEW_RECOMMENDATION.CONTINUE_DUE_DILIGENCE);
  assert(/^[a-f0-9]{64}$/.test(report.reportHashSha256));

  expectCode('C4_PROPERTY_REF_MISMATCH', () => buildGovernedDealDecision(decisionInput({ propertyRef: 'OTHER-PROPERTY' })));
  expectCode('C4_VALUATION_DATE_MISMATCH', () => buildGovernedDealDecision(decisionInput({ valuationDate: '2026-09-28T00:00:00.000Z' })));
  expectCode('C4_RECONCILIATION_STALE', () => buildGovernedDealDecision(decisionInput({ generatedAt: '2026-10-03T09:00:00.000Z', maxReconciliationAgeHours: 24 })));

  const notReady = readyReconciliation();
  notReady.status = RECONCILIATION_GATE_STATUS.HOLD_RECONCILIATION;
  notReady.decisionReady = false;
  expectCode('C4_RECONCILIATION_NOT_READY', () => buildGovernedDealDecision(decisionInput({ reconciliation: notReady, evidenceLineage: lineageFor(notReady) })));

  const tamperedReconciliation = readyReconciliation();
  tamperedReconciliation.analyticalValueIndicationSar += 1;
  expectCode('C4_RECONCILIATION_HASH_MISMATCH', () => buildGovernedDealDecision(decisionInput({ reconciliation: tamperedReconciliation, evidenceLineage: lineageFor(tamperedReconciliation) })));

  const badLineage = lineageFor(reconciliation);
  badLineage.methodSourceResultHashesById['market-whole-property'] = hash('e');
  expectCode('C4_METHOD_SOURCE_HASH_MISMATCH', () => buildGovernedDealDecision(decisionInput({ reconciliation, evidenceLineage: badLineage })));

  const badReconciliationBinding = lineageFor(reconciliation);
  badReconciliationBinding.reconciliationResultHashSha256 = hash('f');
  expectCode('C4_LINEAGE_RECONCILIATION_HASH_MISMATCH', () => buildGovernedDealDecision(decisionInput({ reconciliation, evidenceLineage: badReconciliationBinding })));

  for (const [field, code] of [
    ['finalValuationConclusionEstablished', 'C4_UPSTREAM_FINAL_VALUATION_FORBIDDEN'],
    ['certifiedValuationEstablished', 'C4_UPSTREAM_CERTIFIED_VALUATION_FORBIDDEN'],
    ['transactionAuthorized', 'C4_UPSTREAM_TRANSACTION_AUTHORITY_FORBIDDEN'],
    ['publicAiAuthorized', 'C4_UPSTREAM_PUBLIC_AI_AUTHORITY_FORBIDDEN'],
  ]) {
    const forged = readyReconciliation();
    forged[field] = true;
    expectCode(code, () => buildGovernedDealDecision(decisionInput({ reconciliation: forged, evidenceLineage: lineageFor(forged) })));
  }

  expectCode('C4_REVIEW_AUTHORITY_FIELD_FORBIDDEN', () => buildGovernedDealDecision(decisionInput({
    reconciliation,
    humanReview: {
      reviewerId: 'investment-reviewer-7',
      recommendation: C4_REVIEW_RECOMMENDATION.CONTINUE_DUE_DILIGENCE,
      rationale: 'Attempted approval escalation.',
      reviewedAt: '2026-09-30T08:30:00.000Z',
      approved: true,
    },
  })));

  const tamperedSaved = clone(reviewed);
  tamperedSaved.authorityBoundary.transactionAuthority = true;
  expectCode('C4_AUTHORITY_ESCALATION_FORBIDDEN', () => governedDealDecisionFromSavedDeal({
    id: 'DEAL-C4-TAMPER',
    mode: 'building',
    governedDealDecision: tamperedSaved,
  }));

  const incompleteLineage = clone(reviewed);
  delete incompleteLineage.evidenceLineage.sourceEvidenceHashes;
  expectCode('C4_SOURCE_EVIDENCE_HASHES_REQUIRED', () => buildGovernedDealDecisionReport({
    reportId: 'REPORT-C4-INCOMPLETE',
    decisionSnapshot: incompleteLineage,
    generatedAt: '2026-09-30T09:05:00.000Z',
  }));

  const tamperedSnapshot = clone(reviewed);
  tamperedSnapshot.reconciliationSummary.analyticalValueIndicationSar += 1000;
  expectCode('C4_SNAPSHOT_HASH_MISMATCH', () => validateGovernedDealDecisionSnapshot(tamperedSnapshot));

  const landOnly = readyReconciliation();
  landOnly.valuationScope = VALUATION_VALUE_SCOPE.LAND_ONLY;
  landOnly.resultHashSha256 = computeC3ResultHash(landOnly);
  expectCode('C4_WHOLE_PROPERTY_SCOPE_REQUIRED', () => buildGovernedDealDecision(decisionInput({ reconciliation: landOnly, evidenceLineage: lineageFor(landOnly) })));

  console.log('C4 governed deal decision/report integration: PASS');
})();

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  SUBDIVISION_CHECK_TYPE,
  SUBDIVISION_ASSESSMENT_STATUS,
  REQUIRED_SUBDIVISION_CHECK_TYPES,
  calculateSubdivisionDueDiligenceGate,
} = require('../../src/residential-income-acquisition/subdivision-gate');
const {
  buildResidentialIncomeAiDecisionSnapshot,
} = require('../../src/residential-income-acquisition/ai-assist-contract');

const root = path.join(__dirname, '..', '..');
const apiSource = fs.readFileSync(path.join(root, 'src/residential-income-acquisition/api.js'), 'utf8');

function buildCase(overrides = {}) {
  const evidenceLineage = [];
  const additionalOperatingInputs = [];
  for (const checkType of REQUIRED_SUBDIVISION_CHECK_TYPES) {
    const sourceRef = `src-${checkType}`;
    const adoptionDecisionRef = `adopt-${checkType}`;
    evidenceLineage.push({ refId: sourceRef, kind: 'SOURCE_DOCUMENT' });
    evidenceLineage.push({ refId: adoptionDecisionRef, kind: 'UNDERWRITING_ADOPTION' });
    additionalOperatingInputs.push({
      schemaVersion: 1,
      field: `subdivision.check.${checkType}.outcome`,
      value: 'PASS',
      unit: null,
      sourceRef,
      evidenceType: 'SUBDIVISION_DUE_DILIGENCE',
      effectiveDate: '2026-09-01T00:00:00.000Z',
      verificationStatus: 'VERIFIED_FACT',
      confidence: 1,
      adoptedForUnderwriting: true,
      adoptionDecisionRef,
      assumptionOverride: null,
      lineageRefs: [sourceRef, adoptionDecisionRef],
    });
  }
  return {
    caseId: 'case-subdivision-gate',
    asOfDate: '2026-09-03T00:00:00.000Z',
    evidenceLineage,
    additionalOperatingInputs,
    ...overrides,
  };
}

assert.strictEqual(REQUIRED_SUBDIVISION_CHECK_TYPES.length, 11);
assert.deepStrictEqual(new Set(REQUIRED_SUBDIVISION_CHECK_TYPES), new Set(Object.values(SUBDIVISION_CHECK_TYPE)));

const notAssessed = calculateSubdivisionDueDiligenceGate({
  caseId: 'case-empty',
  asOfDate: '2026-09-03T00:00:00.000Z',
  evidenceLineage: [],
  additionalOperatingInputs: [],
});
assert.strictEqual(notAssessed.status, SUBDIVISION_ASSESSMENT_STATUS.NOT_ASSESSED);
assert.strictEqual(notAssessed.scenarioTestingEligible, false);
assert.strictEqual(notAssessed.missingCount, 11);
assert.strictEqual(notAssessed.automaticFinancializationAllowed, false);
assert.strictEqual(notAssessed.authorityApprovalInferred, false);

const allPass = calculateSubdivisionDueDiligenceGate(buildCase());
assert.strictEqual(allPass.status, SUBDIVISION_ASSESSMENT_STATUS.FEASIBLE_FOR_SCENARIO_TESTING);
assert.strictEqual(allPass.scenarioTestingEligible, true);
assert.strictEqual(allPass.passCount, 11);
assert.strictEqual(allPass.failCount, 0);
assert.strictEqual(allPass.verifiedCheckCount, 11);
assert.strictEqual(allPass.evidenceCoverage, 1);
assert.strictEqual(allPass.legalConclusion, null);
assert.strictEqual(allPass.investmentRecommendation, null);
assert.strictEqual(allPass.transactionAuthorized, false);
assert.strictEqual(allPass.automaticFinancializationAllowed, false);
assert.strictEqual(allPass.authorityApprovalInferred, false);

const missingCase = buildCase();
missingCase.additionalOperatingInputs = missingCase.additionalOperatingInputs.filter((item) => !item.field.includes('PARKING_COMPLIANCE'));
const missing = calculateSubdivisionDueDiligenceGate(missingCase);
assert.strictEqual(missing.status, SUBDIVISION_ASSESSMENT_STATUS.DUE_DILIGENCE_REQUIRED);
assert.strictEqual(missing.scenarioTestingEligible, false);
assert(missing.missingCheckTypes.includes('PARKING_COMPLIANCE'));
assert.strictEqual(missing.automaticFinancializationAllowed, false);

const failedCase = buildCase();
failedCase.additionalOperatingInputs = failedCase.additionalOperatingInputs.map((item) => item.field.includes('ZONING_PERMISSION') ? { ...item, value: 'FAIL' } : item);
const failed = calculateSubdivisionDueDiligenceGate(failedCase);
assert.strictEqual(failed.status, SUBDIVISION_ASSESSMENT_STATUS.NOT_FEASIBLE);
assert.strictEqual(failed.scenarioTestingEligible, false);
assert(failed.failedCheckTypes.includes('ZONING_PERMISSION'));

const assumedCase = buildCase();
assumedCase.additionalOperatingInputs = assumedCase.additionalOperatingInputs.map((item) => item.field.includes('MINIMUM_UNIT_AREA') ? { ...item, verificationStatus: 'ASSUMED' } : item);
const assumed = calculateSubdivisionDueDiligenceGate(assumedCase);
assert.strictEqual(assumed.status, SUBDIVISION_ASSESSMENT_STATUS.DUE_DILIGENCE_REQUIRED);
assert(assumed.dueDiligenceCheckTypes.includes('MINIMUM_UNIT_AREA'));
assert(assumed.issues.some((issue) => issue.code === 'SUBDIVISION_VERIFIED_FACT_REQUIRED'));

const missingSourceCase = buildCase();
missingSourceCase.evidenceLineage = missingSourceCase.evidenceLineage.filter((item) => item.refId !== 'src-STRUCTURAL_FEASIBILITY');
const missingSource = calculateSubdivisionDueDiligenceGate(missingSourceCase);
assert.strictEqual(missingSource.status, SUBDIVISION_ASSESSMENT_STATUS.DUE_DILIGENCE_REQUIRED);
assert(missingSource.issues.some((issue) => issue.code === 'SUBDIVISION_SOURCE_LINEAGE_REQUIRED' && issue.checkType === 'STRUCTURAL_FEASIBILITY'));

const futureCase = buildCase();
futureCase.additionalOperatingInputs = futureCase.additionalOperatingInputs.map((item) => item.field.includes('UTILITY_SEPARATION') ? { ...item, effectiveDate: '2026-10-01T00:00:00.000Z' } : item);
const future = calculateSubdivisionDueDiligenceGate(futureCase);
assert.strictEqual(future.status, SUBDIVISION_ASSESSMENT_STATUS.DUE_DILIGENCE_REQUIRED);
assert(future.issues.some((issue) => issue.code === 'SUBDIVISION_FUTURE_EFFECTIVE_EVIDENCE'));

assert(apiSource.includes("require('./subdivision-gate')"));
assert(apiSource.includes('const subdivisionGate = calculateSubdivisionDueDiligenceGate(operatingCase);'));
assert(apiSource.includes('subdivisionGateCalculated'));
assert(apiSource.includes("intelligenceExtensionStatus: 'LIFECYCLE_LOCATION_UPSIDE_AND_IC_V1'"));
assert(apiSource.includes("subdivisionExtensionStatus: 'SUBDIVISION_DUE_DILIGENCE_GATE_V1'"));

const snapshotResult = buildResidentialIncomeAiDecisionSnapshot({
  apiStatus: 'CASE_LOADED',
  asOfDate: '2026-09-03',
  readinessStatus: 'READY_WITH_ASSUMPTIONS',
  summary: { unitCount: 10, leaseCount: 9, tenantCount: 9, evidenceLineageCount: 30 },
  blockers: [],
  evidenceGaps: [],
  dueDiligence: [],
  acquisitionAnalyticalScore: null,
  lifecycleLocationUpside: {
    lifecycle: {
      status: 'CALCULATED',
      metrics: {
        weightedConditionScore: 77,
        criticalComponentsDueWithin3y: 1,
        knownReplacementCapex3y: 250000,
        knownReplacementCapex5y: 400000,
      },
    },
    location: null,
    forwardAttraction: null,
    upside: null,
  },
  subdivisionGate: allPass,
  reverseUnderwriting: null,
  exitStrategyComparison: null,
  scenarioIntegration: null,
});
assert.strictEqual(snapshotResult.status, 'READY');
assert.strictEqual(snapshotResult.decisionSnapshot.subdivision.status, 'FEASIBLE_FOR_SCENARIO_TESTING');
assert.strictEqual(snapshotResult.decisionSnapshot.subdivision.scenarioTestingEligible, true);
assert.strictEqual(snapshotResult.decisionSnapshot.subdivision.authorityApprovalInferred, false);
assert.strictEqual(snapshotResult.decisionSnapshot.subdivision.automaticFinancializationAllowed, false);
assert.strictEqual(snapshotResult.decisionSnapshot.lifecycle.replacementCapexWithin3y, 250000);
assert.strictEqual(snapshotResult.decisionSnapshot.lifecycle.replacementCapexWithin5y, 400000);
assert.strictEqual(snapshotResult.decisionSnapshot.subdivision.checks, undefined);

console.log('RIAI_SUBDIVISION_DUE_DILIGENCE_GATE_V1=PASS');
console.log('ELEVEN_MANDATORY_CHECKS=PASS');
console.log('VERIFIED_FACT_ONLY=PASS');
console.log('FAIL_CLOSED_SCENARIO_ELIGIBILITY=PASS');
console.log('NO_AUTHORITY_APPROVAL_INFERENCE=PASS');
console.log('NO_AUTOMATIC_FINANCIALIZATION=PASS');
console.log('SANITIZED_AI_SUBDIVISION_SNAPSHOT=PASS');
console.log('LIFECYCLE_AI_CAPEX_FIELD_MAPPING=PASS');

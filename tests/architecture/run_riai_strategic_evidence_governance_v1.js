'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  STRATEGIC_EVIDENCE_STATUS,
  SUBDIVISION_ASSESSMENT_STATUS,
  UPSIDE_TYPE,
  REGULATORY_STATUS,
  assessStrategicEvidenceGovernance,
  calculateLifecycleLocationUpsideIntelligence,
  buildResidentialIncomeAiDecisionSnapshot,
} = require('../../src/residential-income-acquisition');

const AS_OF = '2026-09-03T00:00:00.000Z';
const ADOPTION_REF = 'adopt-strategic';

function input(field, value, overrides = {}) {
  const sourceRef = `source-${field}`;
  return {
    schemaVersion: 1,
    field,
    value,
    unit: null,
    sourceRef,
    evidenceType: 'STRATEGIC_EVIDENCE_REGRESSION',
    effectiveDate: AS_OF,
    verificationStatus: 'VERIFIED_FACT',
    confidence: 0.95,
    adoptedForUnderwriting: true,
    adoptionDecisionRef: ADOPTION_REF,
    assumptionOverride: null,
    lineageRefs: [sourceRef, ADOPTION_REF],
    ...overrides,
  };
}

function lineageFor(inputs) {
  return [
    { refId: ADOPTION_REF, kind: 'UNDERWRITING_ADOPTION' },
    ...inputs.map((item) => ({ refId: item.sourceRef, kind: 'SOURCE_DOCUMENT' })),
  ];
}

const locationInputs = [
  input('location.current.accessibilityScore', 85),
  input('location.current.servicesScore', 80),
];
const validCase = {
  caseId: 'case-strategic-evidence-valid',
  asOfDate: AS_OF,
  additionalOperatingInputs: locationInputs,
  evidenceLineage: lineageFor(locationInputs),
};

const valid = assessStrategicEvidenceGovernance(validCase);
assert.strictEqual(valid.status, STRATEGIC_EVIDENCE_STATUS.COMPLIANT);
assert.strictEqual(valid.evidenceCoverage, 1);
assert.strictEqual(valid.usableAdoptedInputCount, 2);

const missingSourceCase = {
  ...validCase,
  evidenceLineage: validCase.evidenceLineage.filter((item) => item.refId !== locationInputs[0].sourceRef),
};
const missingSource = calculateLifecycleLocationUpsideIntelligence(missingSourceCase);
assert.strictEqual(missingSource.evidenceGovernance.status, STRATEGIC_EVIDENCE_STATUS.REVIEW_REQUIRED);
assert.strictEqual(missingSource.evidenceGovernance.evidenceCoverage, 0.5);
assert(missingSource.evidenceGovernance.issues.some((item) => item.code === 'STRATEGIC_SOURCE_LINEAGE_REQUIRED'));
assert.strictEqual(missingSource.location.dimensions.length, 1);
assert.strictEqual(missingSource.location.dimensions[0].key, 'services');

const missingAdoptionCase = {
  ...validCase,
  evidenceLineage: validCase.evidenceLineage.filter((item) => item.refId !== ADOPTION_REF),
};
const missingAdoption = assessStrategicEvidenceGovernance(missingAdoptionCase);
assert.strictEqual(missingAdoption.status, STRATEGIC_EVIDENCE_STATUS.REVIEW_REQUIRED);
assert.strictEqual(missingAdoption.usableAdoptedInputCount, 0);
assert(missingAdoption.issues.every((item) => item.code === 'STRATEGIC_ADOPTION_LINEAGE_REQUIRED' || item.code === 'STRATEGIC_LINEAGE_REFERENCE_MISSING'));

const futureInput = input('location.current.accessibilityScore', 90, { effectiveDate: '2026-09-04T00:00:00.000Z' });
const future = assessStrategicEvidenceGovernance({
  caseId: 'case-future-strategic-evidence',
  asOfDate: AS_OF,
  additionalOperatingInputs: [futureInput],
  evidenceLineage: lineageFor([futureInput]),
});
assert(future.issues.some((item) => item.code === 'STRATEGIC_FUTURE_EFFECTIVE_EVIDENCE'));
assert.strictEqual(future.evidenceCoverage, 0);

const duplicateInputs = [
  input('location.current.servicesScore', 70),
  input('location.current.servicesScore', 90, { sourceRef: 'source-duplicate' }),
];
const duplicate = assessStrategicEvidenceGovernance({
  caseId: 'case-duplicate-strategic-input',
  asOfDate: AS_OF,
  additionalOperatingInputs: duplicateInputs,
  evidenceLineage: lineageFor(duplicateInputs),
});
assert(duplicate.issues.some((item) => item.code === 'STRATEGIC_INPUT_DUPLICATE_FIELD'));
assert.strictEqual(duplicate.usableAdoptedInputCount, 0);

const subdivisionInputs = [
  input('upside.catalyst.split.type', UPSIDE_TYPE.SUBDIVISION),
  input('upside.catalyst.split.regulatoryStatus', REGULATORY_STATUS.VERIFIED_FEASIBLE),
  input('upside.catalyst.split.capex', 400000),
  input('upside.catalyst.split.executionPeriodYears', 1),
  input('upside.catalyst.split.annualNoiLossDuringExecution', 50000),
  input('upside.catalyst.split.incrementalAnnualNoi', 200000),
  input('upside.catalyst.split.probability', 0.8),
];
const subdivisionCase = {
  caseId: 'case-subdivision-upside-cross-gate',
  asOfDate: AS_OF,
  additionalOperatingInputs: subdivisionInputs,
  evidenceLineage: lineageFor(subdivisionInputs),
};
const noGateBundle = calculateLifecycleLocationUpsideIntelligence(subdivisionCase);
assert.strictEqual(noGateBundle.upside.catalysts[0].effectiveProbability, 0);
assert.strictEqual(noGateBundle.upside.metrics.eligibleCatalystCount, 0);
assert(noGateBundle.upside.issues.some((item) => item.code === 'SUBDIVISION_GATE_REQUIRED_FOR_UPSIDE'));

const passedGate = {
  status: SUBDIVISION_ASSESSMENT_STATUS.FEASIBLE_FOR_SCENARIO_TESTING,
  scenarioTestingEligible: true,
};
const passedBundle = calculateLifecycleLocationUpsideIntelligence(subdivisionCase, { subdivisionGate: passedGate });
assert.strictEqual(passedBundle.upside.catalysts[0].effectiveProbability, 0.8);
assert.strictEqual(passedBundle.upside.metrics.eligibleCatalystCount, 1);
assert.strictEqual(passedBundle.upside.catalysts[0].subdivisionScenarioTestingEligible, true);
assert.strictEqual(passedBundle.upside.catalysts[0].subdivisionGateStatus, SUBDIVISION_ASSESSMENT_STATUS.FEASIBLE_FOR_SCENARIO_TESTING);

const aiSnapshot = buildResidentialIncomeAiDecisionSnapshot({
  apiStatus: 'CASE_LOADED',
  asOfDate: AS_OF,
  readinessStatus: 'READY_WITH_ASSUMPTIONS',
  summary: {},
  blockers: [],
  evidenceGaps: [],
  dueDiligence: [],
  lifecycleLocationUpside: passedBundle,
});
assert.strictEqual(aiSnapshot.status, 'READY');
assert.strictEqual(aiSnapshot.decisionSnapshot.strategicEvidence.status, STRATEGIC_EVIDENCE_STATUS.COMPLIANT);
assert.strictEqual(aiSnapshot.decisionSnapshot.strategicEvidence.evidenceCoverage, 1);
assert.strictEqual(aiSnapshot.decisionSnapshot.strategicEvidence.issueCodes.length, 0);
assert.strictEqual(aiSnapshot.decisionSnapshot.strategicEvidence.assessments, undefined);

const root = path.join(__dirname, '..', '..');
const api = fs.readFileSync(path.join(root, 'src/residential-income-acquisition/api.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src/residential-income-acquisition/index.js'), 'utf8');
assert(api.indexOf('const subdivisionGate = calculateSubdivisionDueDiligenceGate(operatingCase);') < api.indexOf('calculateLifecycleLocationUpsideIntelligence(operatingCase, { subdivisionGate })'));
assert(api.includes("strategicEvidenceExtensionStatus: 'STRATEGIC_EVIDENCE_GOVERNANCE_V1'"));
assert(index.includes("require('./strategic-evidence-governance')"));
assert(index.includes("require('./subdivision-gate')"));

console.log('RIAI_STRATEGIC_EVIDENCE_GOVERNANCE_V1=PASS');
console.log('INVALID_STRATEGIC_EVIDENCE_FAILS_CLOSED=PASS');
console.log('SUBDIVISION_UPSIDE_CROSS_GATE=PASS');
console.log('SANITIZED_AI_STRATEGIC_EVIDENCE_SUMMARY=PASS');

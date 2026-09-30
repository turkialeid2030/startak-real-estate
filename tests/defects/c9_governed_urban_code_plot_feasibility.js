'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  PLANNING_CONSTRAINT_TYPE,
  PLANNING_AUTHORITY_CLASS,
  PLANNING_VERIFICATION_STATUS,
  PLANNING_CARDINALITY,
  PLANNING_EVIDENCE_STATUS,
  createPlanningEvidenceRecord,
  assessPlanningEvidenceSet,
} = require('../../src/planning/planning-evidence');
const {
  PLOT_FEASIBILITY_STATUS,
  createUrbanCodeProfile,
  verifyUrbanCodeProfileIntegrity,
  createSurveyedRectangularPlotGeometry,
  verifySurveyedPlotGeometryIntegrity,
  evaluateGovernedPlotFeasibility,
} = require('../../src/planning/governed-plot-feasibility');
const {
  TITLE_SURVEY_VERIFICATION_STATUS,
} = require('../../src/property/governed-title-survey-verification');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function hashBound(core, hashField) {
  return { ...core, [hashField]: sha256(core) };
}

const CASE_ID = 'CASE-C9-001';
const PROPERTY_REF = 'PROPERTY-C9-001';
const EVALUATED_AT = '2026-09-30T12:00:00Z';

function planningRecord({ id, type, value, unit }) {
  return createPlanningEvidenceRecord({
    evidenceId: id,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    constraintType: type,
    value,
    unit,
    authorityClass: PLANNING_AUTHORITY_CLASS.OFFICIAL_AUTHORITY,
    sourceAuthority: 'SYNTHETIC_OFFICIAL_AUTHORITY',
    sourceRef: `SOURCE-${id}`,
    sourceUrl: `https://example.invalid/${id}`,
    sourceEffectiveDate: '2026-09-01T00:00:00Z',
    validFrom: '2026-09-01T00:00:00Z',
    validTo: '2026-12-31T23:59:59Z',
    verification: {
      status: PLANNING_VERIFICATION_STATUS.VERIFIED,
      verifiedByRef: 'USER:C9-PLANNING-REVIEWER',
      verifiedAt: '2026-09-21T12:00:00Z',
      verificationEvidenceRef: `VERIFY-${id}`,
    },
    capturedAt: '2026-09-20T12:00:00Z',
  });
}

function buildPlanningEvidenceSet() {
  const records = [
    planningRecord({ id: 'PLAN-FAR', type: PLANNING_CONSTRAINT_TYPE.FAR, value: 2, unit: 'ratio' }),
    planningRecord({ id: 'PLAN-BCR', type: PLANNING_CONSTRAINT_TYPE.BCR, value: 0.6, unit: 'ratio' }),
    planningRecord({
      id: 'PLAN-SETBACK',
      type: PLANNING_CONSTRAINT_TYPE.SETBACK,
      value: { front: 5, rear: 3, left: 2, right: 2 },
      unit: 'm',
    }),
  ];
  return assessPlanningEvidenceSet({
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    valuationDate: '2026-09-30T00:00:00Z',
    records,
    requiredConstraintTypes: [
      PLANNING_CONSTRAINT_TYPE.FAR,
      PLANNING_CONSTRAINT_TYPE.BCR,
      PLANNING_CONSTRAINT_TYPE.SETBACK,
    ],
    allowedAuthorityClasses: [PLANNING_AUTHORITY_CLASS.OFFICIAL_AUTHORITY],
    cardinalityByType: {
      [PLANNING_CONSTRAINT_TYPE.FAR]: PLANNING_CARDINALITY.SINGLE,
      [PLANNING_CONSTRAINT_TYPE.BCR]: PLANNING_CARDINALITY.SINGLE,
      [PLANNING_CONSTRAINT_TYPE.SETBACK]: PLANNING_CARDINALITY.SINGLE,
    },
  });
}

function c8Result(overrides = {}) {
  const core = {
    schemaVersion: 1,
    capability: 'C8_GOVERNED_TITLE_SURVEY_PROPERTY_EVIDENCE_V1',
    status: TITLE_SURVEY_VERIFICATION_STATUS.READY_FOR_PROFESSIONAL_REVIEW,
    reasons: [],
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    professionalReviewReady: true,
    legalTitleValidityEstablished: false,
    transactionAuthorized: false,
    ...overrides,
  };
  return hashBound(core, 'resultHashSha256');
}

const planning = buildPlanningEvidenceSet();
check(planning.status === PLANNING_EVIDENCE_STATUS.READY_FOR_HBU_LEGAL_REVIEW, 'fixture planning evidence is governed and ready');
check(/^[a-f0-9]{64}$/.test(planning.planningEvidenceSetHashSha256), 'planning evidence set is hash-bound');

function profile(overrides = {}) {
  return createUrbanCodeProfile({
    profileId: 'PROFILE-C9-001',
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    planningEvidenceSet: planning,
    constraintEvidenceIdsByType: {
      [PLANNING_CONSTRAINT_TYPE.FAR]: ['PLAN-FAR'],
      [PLANNING_CONSTRAINT_TYPE.BCR]: ['PLAN-BCR'],
      [PLANNING_CONSTRAINT_TYPE.SETBACK]: ['PLAN-SETBACK'],
    },
    far: 2,
    bcr: 0.6,
    setbacks: { front: 5, rear: 3, left: 2, right: 2 },
    areaUnit: 'sqm',
    lengthUnit: 'm',
    permittedUses: ['RESIDENTIAL', 'MIXED_USE'],
    heightLimit: { value: 30, unit: 'm' },
    parkingRequirement: { sourceTextRef: 'PARKING-RULE-001' },
    interpretationEvidenceRef: 'INTERPRETATION-C9-001',
    reviewedByRef: 'USER:C9-PROFESSIONAL',
    reviewedAt: '2026-09-29T12:00:00Z',
    ...overrides,
  });
}

function geometry(overrides = {}) {
  return createSurveyedRectangularPlotGeometry({
    geometryId: 'GEOMETRY-C9-001',
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    landArea: 1000,
    width: 25,
    depth: 40,
    areaUnit: 'sqm',
    lengthUnit: 'm',
    evidenceRefs: ['SURVEY-EVIDENCE-001', 'C8-RESULT-001'],
    verifiedByRef: 'USER:C9-SURVEY-REVIEWER',
    verifiedAt: '2026-09-29T10:00:00Z',
    ...overrides,
  });
}

function evaluate({
  planningEvidenceSet = planning,
  titleSurveyVerification = c8Result(),
  urbanCodeProfile = profile(),
  plotGeometry = geometry(),
  geometryAreaTolerance = { absolute: 0 },
  evaluatedAt = EVALUATED_AT,
} = {}) {
  return evaluateGovernedPlotFeasibility({
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    planningEvidenceSet,
    titleSurveyVerification,
    urbanCodeProfile,
    plotGeometry,
    geometryAreaTolerance,
    evaluatedAt,
  });
}

const adoptedProfile = profile();
const surveyedGeometry = geometry();
check(verifyUrbanCodeProfileIntegrity(adoptedProfile) === true, 'urban-code profile integrity verifies');
check(verifySurveyedPlotGeometryIntegrity(surveyedGeometry) === true, 'surveyed plot geometry integrity verifies');
check(Object.isFrozen(adoptedProfile) && Object.isFrozen(adoptedProfile.adoptedConstraints), 'profile is deeply immutable');
check(Object.isFrozen(surveyedGeometry), 'geometry is immutable');

const ready = evaluate({ urbanCodeProfile: adoptedProfile, plotGeometry: surveyedGeometry });
check(ready.status === PLOT_FEASIBILITY_STATUS.READY_FOR_PROFESSIONAL_PLOT_REVIEW, 'complete governed inputs reach professional plot review');
check(ready.professionalPlotReviewReady === true, 'ready state is limited to professional plot review readiness');
check(ready.calculations.rectangleArea === 1000, 'rectangle area calculation is deterministic');
check(ready.calculations.buildableWidth === 21, 'left/right setbacks reduce surveyed width');
check(ready.calculations.buildableDepth === 32, 'front/rear setbacks reduce surveyed depth');
check(ready.calculations.setbackEnvelopeArea === 672, 'setback envelope area is calculated');
check(ready.calculations.bcrFootprintCap === 600, 'BCR footprint cap is calculated from reported land area');
check(ready.calculations.governingFootprintCap === 600, 'governing footprint is the lower of setback and BCR caps');
check(ready.calculations.farGrossFloorAreaCap === 2000, 'FAR gross-floor-area cap is calculated');
check(ready.planningComplianceEstablished === false && ready.buildingPermitEstablished === false, 'C9 never creates planning-compliance or permit authority');
check(ready.legalOpinionEstablished === false && ready.highestBestUseEstablished === false, 'C9 never creates legal opinion or HBU conclusion');
check(ready.financialEngineInputsWritten === false && ready.transactionAuthorized === false, 'C9 never writes financial inputs or authorizes transaction');
check(/^[a-f0-9]{64}$/.test(ready.resultHashSha256), 'C9 output is hash-bound');

const repeated = evaluate({ urbanCodeProfile: adoptedProfile, plotGeometry: surveyedGeometry });
check(repeated.resultHashSha256 === ready.resultHashSha256, 'identical governed inputs produce identical C9 result hash');

const reversedEvidenceGeometry = geometry({ evidenceRefs: ['C8-RESULT-001', 'SURVEY-EVIDENCE-001'] });
check(reversedEvidenceGeometry.plotGeometryHashSha256 === surveyedGeometry.plotGeometryHashSha256, 'geometry evidence references are canonically sorted');

const heldC8 = c8Result({ status: TITLE_SURVEY_VERIFICATION_STATUS.HOLD_EVIDENCE, professionalReviewReady: false });
const c8Hold = evaluate({ titleSurveyVerification: heldC8, urbanCodeProfile: adoptedProfile, plotGeometry: surveyedGeometry });
check(c8Hold.status === PLOT_FEASIBILITY_STATUS.HOLD_UPSTREAM_EVIDENCE, 'C8 hold propagates fail-closed into C9');
check(c8Hold.reasons.some((reason) => reason.startsWith('C8_NOT_READY:')), 'C8 upstream blocker is explicit');

const heldPlanningCore = { ...planning, status: PLANNING_EVIDENCE_STATUS.HOLD_CONFLICT, readyForHbuLegalReview: false };
delete heldPlanningCore.planningEvidenceSetHashSha256;
const heldPlanning = hashBound(heldPlanningCore, 'planningEvidenceSetHashSha256');
const planningHold = evaluate({ planningEvidenceSet: heldPlanning, urbanCodeProfile: adoptedProfile, plotGeometry: surveyedGeometry });
check(planningHold.status === PLOT_FEASIBILITY_STATUS.HOLD_UPSTREAM_EVIDENCE, 'planning-evidence hold propagates into C9');

const tamperedProfile = {
  ...adoptedProfile,
  adoptedConstraints: { ...adoptedProfile.adoptedConstraints, far: 3 },
};
const tamperedProfileResult = evaluate({ urbanCodeProfile: tamperedProfile, plotGeometry: surveyedGeometry });
check(tamperedProfileResult.status === PLOT_FEASIBILITY_STATUS.HOLD_INTEGRITY, 'profile tampering is detected');
check(tamperedProfileResult.reasons.includes('URBAN_CODE_PROFILE_INTEGRITY_FAILED'), 'profile integrity blocker is explicit');

const tamperedGeometry = { ...surveyedGeometry, width: 30 };
const tamperedGeometryResult = evaluate({ urbanCodeProfile: adoptedProfile, plotGeometry: tamperedGeometry });
check(tamperedGeometryResult.status === PLOT_FEASIBILITY_STATUS.HOLD_INTEGRITY, 'survey geometry tampering is detected');

const unitMismatchGeometry = geometry({ areaUnit: 'sqft', lengthUnit: 'ft' });
const unitMismatch = evaluate({ urbanCodeProfile: adoptedProfile, plotGeometry: unitMismatchGeometry });
check(unitMismatch.status === PLOT_FEASIBILITY_STATUS.HOLD_UNIT_COMPATIBILITY, 'unit mismatch fails closed with no silent conversion');

const missingTolerance = evaluate({ urbanCodeProfile: adoptedProfile, plotGeometry: surveyedGeometry, geometryAreaTolerance: null });
check(missingTolerance.status === PLOT_FEASIBILITY_STATUS.HOLD_POLICY, 'explicit geometry-area tolerance is mandatory');

const inconsistentGeometry = geometry({ depth: 41 });
const geometryHold = evaluate({
  urbanCodeProfile: adoptedProfile,
  plotGeometry: inconsistentGeometry,
  geometryAreaTolerance: { absolute: 2 },
});
check(geometryHold.status === PLOT_FEASIBILITY_STATUS.HOLD_GEOMETRY, 'surveyed rectangle outside explicit area tolerance fails closed');
check(geometryHold.calculations.areaDifference === 25 && geometryHold.calculations.allowedAreaDifference === 2, 'geometry discrepancy is quantified without hidden tolerance');

const toleranceReady = evaluate({
  urbanCodeProfile: adoptedProfile,
  plotGeometry: inconsistentGeometry,
  geometryAreaTolerance: { relative: 0.03 },
});
check(toleranceReady.status === PLOT_FEASIBILITY_STATUS.READY_FOR_PROFESSIONAL_PLOT_REVIEW, 'caller-supplied relative tolerance can explicitly admit a geometry discrepancy');

const infeasibleProfile = profile({ setbacks: { front: 5, rear: 3, left: 13, right: 13 } });
const infeasible = evaluate({ urbanCodeProfile: infeasibleProfile, plotGeometry: surveyedGeometry });
check(infeasible.status === PLOT_FEASIBILITY_STATUS.INFEASIBLE_ENVELOPE, 'setbacks consuming the surveyed rectangle produce explicit infeasible envelope state');
check(infeasible.professionalPlotReviewReady === false, 'infeasible envelope is not ready for professional progression');

const zeroBcrProfile = profile({ bcr: 0 });
const zeroBcr = evaluate({ urbanCodeProfile: zeroBcrProfile, plotGeometry: surveyedGeometry });
check(zeroBcr.status === PLOT_FEASIBILITY_STATUS.INFEASIBLE_ENVELOPE, 'zero adopted BCR produces no positive buildable capacity');

let threwBadBcr = false;
try { profile({ bcr: 1.01 }); } catch (error) { threwBadBcr = /ratio between 0 and 1/.test(error.message); }
check(threwBadBcr, 'profile rejects BCR above 1 instead of guessing percent semantics');

let threwBadEvidenceRef = false;
try {
  profile({
    constraintEvidenceIdsByType: {
      [PLANNING_CONSTRAINT_TYPE.FAR]: ['NOT-ELIGIBLE'],
      [PLANNING_CONSTRAINT_TYPE.BCR]: ['PLAN-BCR'],
      [PLANNING_CONSTRAINT_TYPE.SETBACK]: ['PLAN-SETBACK'],
    },
  });
} catch (error) {
  threwBadEvidenceRef = /PLANNING_EVIDENCE_REFERENCE_NOT_ELIGIBLE/.test(error.message);
}
check(threwBadEvidenceRef, 'profile cannot bind to evidence IDs outside eligible planning evidence');

let threwHeldPlanningProfile = false;
try { createUrbanCodeProfile({
  profileId: 'BAD-PROFILE',
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  planningEvidenceSet: heldPlanning,
  constraintEvidenceIdsByType: {
    [PLANNING_CONSTRAINT_TYPE.FAR]: ['PLAN-FAR'],
    [PLANNING_CONSTRAINT_TYPE.BCR]: ['PLAN-BCR'],
    [PLANNING_CONSTRAINT_TYPE.SETBACK]: ['PLAN-SETBACK'],
  },
  far: 2,
  bcr: 0.6,
  setbacks: { front: 5, rear: 3, left: 2, right: 2 },
  areaUnit: 'sqm',
  lengthUnit: 'm',
  interpretationEvidenceRef: 'BAD',
  reviewedByRef: 'USER:BAD',
  reviewedAt: '2026-09-29T12:00:00Z',
}); } catch (error) { threwHeldPlanningProfile = /PLANNING_EVIDENCE_NOT_READY_FOR_PROFILE/.test(error.message); }
check(threwHeldPlanningProfile, 'urban-code profile cannot be created from held planning evidence');

const futureProfile = profile({ reviewedAt: '2026-10-01T12:00:00Z' });
const futureReview = evaluate({ urbanCodeProfile: futureProfile, plotGeometry: surveyedGeometry });
check(futureReview.status === PLOT_FEASIBILITY_STATUS.HOLD_POLICY, 'future professional interpretation review timestamp fails closed');

const wrongCaseC8Core = c8Result();
const wrongCaseCore = { ...wrongCaseC8Core, caseId: 'OTHER-CASE' };
delete wrongCaseCore.resultHashSha256;
const wrongCaseC8 = hashBound(wrongCaseCore, 'resultHashSha256');
const isolation = evaluate({ titleSurveyVerification: wrongCaseC8, urbanCodeProfile: adoptedProfile, plotGeometry: surveyedGeometry });
check(isolation.status === PLOT_FEASIBILITY_STATUS.HOLD_UPSTREAM_EVIDENCE, 'case/property isolation is enforced across upstream evidence');

console.log(`C9_GOVERNED_URBAN_CODE_PLOT_FEASIBILITY=PASS checks=${checks}`);

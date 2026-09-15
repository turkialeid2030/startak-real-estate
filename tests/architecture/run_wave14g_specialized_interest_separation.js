'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  SPECIALIZED_ASSET_CLASS,
  SPECIALIZED_OPERATING_STATE,
  SPECIALIZED_OPERATING_MODEL,
  SPECIALIZED_ANALYSIS_CONTEXT,
  SPECIALIZED_EVIDENCE_EXPECTATION,
  SPECIALIZED_EVIDENCE_ITEM_STATUS,
  expectationMatrix,
  createSpecializedEvidenceItem,
  buildSpecializedAssetEvidencePacket,
} = require('../../src/specialized-assets/specialized-asset-evidence');
const {
  SPECIALIZED_VALUE_COMPONENT,
  SPECIALIZED_VALUATION_PREMISE,
  COMPONENT_TREATMENT,
  COMPONENT_EVIDENCE_STATUS,
  SPECIALIZED_INTEREST_SEPARATION_STATUS,
  requiredComponents,
  createSpecializedComponentTreatment,
  verifySpecializedComponentTreatmentIntegrity,
  premiseConflict,
  buildSpecializedInterestSeparationPacket,
  verifySpecializedInterestSeparationPacketIntegrity,
} = require('../../src/specialized-assets/specialized-interest-separation');

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const eq = (actual, expected, message) => { assert.strictEqual(actual, expected, message); checks += 1; };
const throws = (fn, pattern, message) => { assert.throws(fn, pattern, message); checks += 1; };

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}
const sha256 = (value) => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

function propertyPacket() {
  const core = {
    schemaVersion: 1,
    caseId: 'CASE-14G',
    propertyRef: 'PROP-14G',
    assignmentRef: 'ASSIGN-14G',
    assignmentHashSha256: 'a'.repeat(64),
    inspectionId: 'INSP-14G',
    inspectionHashSha256: 'b'.repeat(64),
    valuationDate: '2026-01-01',
    reportDate: '2026-01-05',
    jurisdiction: 'SAUDI_ARABIA',
    assetType: 'SPECIALIZED_REAL_ESTATE',
    assetLocation: 'Riyadh',
    valuedRights: { interest: 'FREEHOLD' },
    basisOfValue: { basis: 'MARKET_VALUE' },
    purpose: 'PROFESSIONAL_VALUATION',
    evidenceFacts: [{ key: 'specialized_asset', normalizedValue: true }],
    measurements: [],
    propertyDataGateStatus: 'CLEAR',
    measurementGateStatus: 'CLEAR',
  };
  return Object.freeze({ ...core, packetHashSha256: sha256(core), status: 'READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW', reasons: [], professionalValuationWorkflowReady: true, automaticUnderwritingAdoption: false, financialEngineInputsWritten: false, certifiedValuationEstablished: false, transactionAuthorized: false });
}

function evidenceItem(topic) {
  return createSpecializedEvidenceItem({
    evidenceItemId: `SE-${topic}`,
    caseId: 'CASE-14G',
    propertyRef: 'PROP-14G',
    topic,
    status: SPECIALIZED_EVIDENCE_ITEM_STATUS.VERIFIED,
    evidenceRefs: [`REF-${topic}`],
    asOfDate: '2026-01-01',
    rationale: `Verified ${topic}`,
    preparedByRef: 'ANALYST-14G',
    preparedAt: '2026-01-02',
    reviewedByRef: 'REVIEWER-14G',
    reviewedAt: '2026-01-03',
    reviewEvidenceRef: `REVIEW-${topic}`,
  });
}

function specializedPacket(assetClass, operatingModel, state = SPECIALIZED_OPERATING_STATE.OPERATING) {
  const matrix = expectationMatrix(assetClass, state, operatingModel);
  const evidenceItems = [];
  const conditionalApplicability = {};
  for (const [topic, expectation] of Object.entries(matrix)) {
    if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED) evidenceItems.push(evidenceItem(topic));
    if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.CONDITIONAL) conditionalApplicability[topic] = false;
  }
  return buildSpecializedAssetEvidencePacket({
    specializationId: `SPEC-${assetClass}-${operatingModel}`,
    caseId: 'CASE-14G',
    propertyRef: 'PROP-14G',
    assetClass,
    operatingState: state,
    operatingModel,
    analysisContext: SPECIALIZED_ANALYSIS_CONTEXT.PROFESSIONAL_VALUATION,
    propertyEvidencePacket: propertyPacket(),
    evidenceItems,
    conditionalApplicability,
    preparedByRef: 'ANALYST-14G',
    preparedAt: '2026-01-03',
    reviewedByRef: 'REVIEWER-14G-2',
    reviewedAt: '2026-01-04',
    reviewEvidenceRef: 'REVIEW-SPECIALIZED-14G',
  });
}

function treatment(component, treatmentValue, suffix = '', evidenceStatus = COMPONENT_EVIDENCE_STATUS.VERIFIED) {
  return createSpecializedComponentTreatment({
    treatmentId: `CT-${component}${suffix}`,
    caseId: 'CASE-14G',
    propertyRef: 'PROP-14G',
    component,
    treatment: treatmentValue,
    evidenceStatus,
    rationale: `Professional treatment for ${component}`,
    evidenceRefs: [`EV-${component}${suffix}`],
    preparedByRef: 'COMPONENT-ANALYST',
    preparedAt: '2026-01-05',
    reviewedByRef: 'COMPONENT-REVIEWER',
    reviewedAt: '2026-01-06',
    reviewEvidenceRef: `REVIEW-${component}${suffix}`,
  });
}

function treatmentsFor(assetClass, operatingModel, premise) {
  return requiredComponents(assetClass, operatingModel).map((component) => {
    let t = COMPONENT_TREATMENT.EXCLUDED_FROM_PREMISE;
    if (component === SPECIALIZED_VALUE_COMPONENT.REAL_PROPERTY) t = COMPONENT_TREATMENT.INCLUDED_IN_PREMISE;
    if (premise === SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_PLUS_FF_E && component === SPECIALIZED_VALUE_COMPONENT.FF_E) t = COMPONENT_TREATMENT.INCLUDED_IN_PREMISE;
    if (premise === SPECIALIZED_VALUATION_PREMISE.ENTERPRISE_CONTEXT_REQUIRES_SEPARATE_ALLOCATION_REVIEW && component !== SPECIALIZED_VALUE_COMPONENT.REAL_PROPERTY) t = COMPONENT_TREATMENT.SEPARATE_REVIEW_REQUIRED;
    return treatment(component, t);
  });
}

function packetInput(assetClass, operatingModel, premise, overrides = {}) {
  return {
    separationPacketId: `SEP-${assetClass}`,
    caseId: 'CASE-14G',
    propertyRef: 'PROP-14G',
    specializedAssetPacket: specializedPacket(assetClass, operatingModel, assetClass === SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET ? SPECIALIZED_OPERATING_STATE.VACANT : SPECIALIZED_OPERATING_STATE.OPERATING),
    valuationPremise: premise,
    componentTreatments: treatmentsFor(assetClass, operatingModel, premise),
    preparedByRef: 'COMPONENT-ANALYST',
    preparedAt: '2026-01-06',
    reviewedByRef: 'COMPONENT-REVIEWER-2',
    reviewedAt: '2026-01-07',
    reviewEvidenceRef: 'SEPARATION-PACKET-REVIEW',
    ...overrides,
  };
}

const hotelRequired = requiredComponents(SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE, SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT);
check(hotelRequired.includes(SPECIALIZED_VALUE_COMPONENT.REAL_PROPERTY), 'hotel requires real property component');
check(hotelRequired.includes(SPECIALIZED_VALUE_COMPONENT.FF_E), 'hotel requires FF&E component');
check(hotelRequired.includes(SPECIALIZED_VALUE_COMPONENT.OPERATING_BUSINESS), 'hotel requires operating business component');
check(hotelRequired.includes(SPECIALIZED_VALUE_COMPONENT.MANAGEMENT_OR_OPERATOR_CONTRACT), 'managed hotel requires operator contract component');
check(!hotelRequired.includes(SPECIALIZED_VALUE_COMPONENT.INTANGIBLE_BRAND_OR_FRANCHISE), 'management agreement does not automatically require franchise intangible');

const franchiseRequired = requiredComponents(SPECIALIZED_ASSET_CLASS.HOTEL_LIMITED_SERVICE, SPECIALIZED_OPERATING_MODEL.FRANCHISE);
check(franchiseRequired.includes(SPECIALIZED_VALUE_COMPONENT.INTANGIBLE_BRAND_OR_FRANCHISE), 'franchise requires intangible/brand component');

const component = treatment(SPECIALIZED_VALUE_COMPONENT.REAL_PROPERTY, COMPONENT_TREATMENT.INCLUDED_IN_PREMISE);
check(verifySpecializedComponentTreatmentIntegrity(component), 'component treatment integrity verifies');
eq(component.monetaryAllocationPerformed, false, 'component treatment performs no monetary allocation');
check(!verifySpecializedComponentTreatmentIntegrity({ ...component, rationale: 'tampered' }), 'tampered component treatment fails integrity');

const rpOnly = buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT,
  SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY,
));
eq(rpOnly.status, SPECIALIZED_INTEREST_SEPARATION_STATUS.READY_FOR_SPECIALIZED_VALUATION_PREMISE_REVIEW, 'real-property-only hotel premise ready');
check(rpOnly.readyForSpecializedValuationPremiseReview, 'premise review handoff ready');
check(verifySpecializedInterestSeparationPacketIntegrity(rpOnly), 'separation packet integrity verifies');
eq(rpOnly.monetaryAllocationPerformed, false, 'no monetary allocation');
eq(rpOnly.businessEnterpriseValueCalculated, false, 'no business enterprise value');
eq(rpOnly.intangibleValueCalculated, false, 'no intangible valuation');
eq(rpOnly.valuationInputsWritten, false, 'no valuation inputs written');
eq(rpOnly.valuationArithmeticPerformed, false, 'no valuation arithmetic');
eq(rpOnly.finalValuationConclusionEstablished, false, 'no final value conclusion');
eq(rpOnly.certifiedValuationEstablished, false, 'no certified valuation');
eq(rpOnly.transactionAuthorized, false, 'no transaction authority');

const rpFfe = buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.RESORT,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
  SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_PLUS_FF_E,
));
eq(rpFfe.status, SPECIALIZED_INTEREST_SEPARATION_STATUS.READY_FOR_SPECIALIZED_VALUATION_PREMISE_REVIEW, 'real-property-plus-FF&E premise ready');
check(rpFfe.componentTreatments.some((r) => r.component === SPECIALIZED_VALUE_COMPONENT.FF_E && r.treatment === COMPONENT_TREATMENT.INCLUDED_IN_PREMISE), 'FF&E inclusion explicit');

const enterprise = buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
  SPECIALIZED_VALUATION_PREMISE.ENTERPRISE_CONTEXT_REQUIRES_SEPARATE_ALLOCATION_REVIEW,
));
eq(enterprise.status, SPECIALIZED_INTEREST_SEPARATION_STATUS.READY_FOR_SPECIALIZED_VALUATION_PREMISE_REVIEW, 'enterprise-context separation packet ready');
check(enterprise.professionalAllocationRequired, 'enterprise context requires professional allocation review');
check(enterprise.separateReviewComponents.includes(SPECIALIZED_VALUE_COMPONENT.OPERATING_BUSINESS), 'operating business separated for review');

const businessIncluded = treatmentsFor(SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE, SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT, SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY)
  .map((r) => r.component === SPECIALIZED_VALUE_COMPONENT.OPERATING_BUSINESS
    ? treatment(SPECIALIZED_VALUE_COMPONENT.OPERATING_BUSINESS, COMPONENT_TREATMENT.INCLUDED_IN_PREMISE, '-BAD')
    : r);
const premiseHold = buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT,
  SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY,
  { componentTreatments: businessIncluded },
));
eq(premiseHold.status, SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_PREMISE_CONFLICT, 'business cannot be included in real-property-only premise');
check(premiseHold.blockers.some((b) => b.includes('NON_REAL_PROPERTY_COMPONENT_CANNOT_BE_INCLUDED_IN_REAL_PROPERTY_ONLY:OPERATING_BUSINESS')), 'real-property-only conflict explicit');

const ffeExcluded = treatmentsFor(SPECIALIZED_ASSET_CLASS.RESORT, SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED, SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_PLUS_FF_E)
  .map((r) => r.component === SPECIALIZED_VALUE_COMPONENT.FF_E
    ? treatment(SPECIALIZED_VALUE_COMPONENT.FF_E, COMPONENT_TREATMENT.EXCLUDED_FROM_PREMISE, '-BAD')
    : r);
const ffeHold = buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.RESORT,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
  SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_PLUS_FF_E,
  { componentTreatments: ffeExcluded },
));
eq(ffeHold.status, SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_PREMISE_CONFLICT, 'FF&E must be included in RP+FF&E premise');
check(ffeHold.blockers.includes('FF_E_MUST_BE_INCLUDED_IN_REAL_PROPERTY_PLUS_FF_E'), 'FF&E premise conflict explicit');

const missing = treatmentsFor(SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE, SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT, SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY)
  .filter((r) => r.component !== SPECIALIZED_VALUE_COMPONENT.OPERATING_BUSINESS);
const missingHold = buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE,
  SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT,
  SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY,
  { componentTreatments: missing },
));
eq(missingHold.status, SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_COMPONENT_EVIDENCE, 'missing required component fails closed');
check(missingHold.blockers.includes('REQUIRED_VALUE_COMPONENT_MISSING:OPERATING_BUSINESS'), 'missing operating business blocker explicit');

const unverifiedTreatments = treatmentsFor(SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION, SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED, SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY)
  .map((r) => r.component === SPECIALIZED_VALUE_COMPONENT.FF_E
    ? treatment(SPECIALIZED_VALUE_COMPONENT.FF_E, COMPONENT_TREATMENT.EXCLUDED_FROM_PREMISE, '-UNVERIFIED', COMPONENT_EVIDENCE_STATUS.ASSUMED)
    : r);
const unverifiedHold = buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
  SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY,
  { componentTreatments: unverifiedTreatments },
));
eq(unverifiedHold.status, SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_COMPONENT_EVIDENCE, 'assumed required component fails closed');
check(unverifiedHold.blockers.includes('REQUIRED_VALUE_COMPONENT_NOT_VERIFIED:FF_E:ASSUMED'), 'unverified FF&E blocker explicit');

const heritage = buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET,
  SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
  SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY,
));
eq(heritage.status, SPECIALIZED_INTEREST_SEPARATION_STATUS.READY_FOR_SPECIALIZED_VALUATION_PREMISE_REVIEW, 'heritage real-property premise can proceed without fabricated business components');
eq(heritage.requiredComponents.length, 1, 'heritage requires only real property by default');

const tamperedTreatment = { ...component, treatment: COMPONENT_TREATMENT.EXCLUDED_FROM_PREMISE };
const integrityHold = buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET,
  SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
  SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY,
  { componentTreatments: [tamperedTreatment] },
));
eq(integrityHold.status, SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_INTEGRITY, 'tampered component treatment fails closed');

const spec = specializedPacket(SPECIALIZED_ASSET_CLASS.HOTEL_LIMITED_SERVICE, SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED);
const specTamper = { ...spec, operatingModel: SPECIALIZED_OPERATING_MODEL.FRANCHISE };
const specHold = buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HOTEL_LIMITED_SERVICE,
  SPECIALIZED_OPERATING_MODEL.OWNER_OPERATED,
  SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY,
  { specializedAssetPacket: specTamper },
));
eq(specHold.status, SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_SPECIALIZED_PACKET, 'tampered specialized packet fails closed');

const crossCaseTreatment = createSpecializedComponentTreatment({
  treatmentId: 'CT-CROSS', caseId: 'OTHER', propertyRef: 'PROP-14G', component: SPECIALIZED_VALUE_COMPONENT.REAL_PROPERTY,
  treatment: COMPONENT_TREATMENT.INCLUDED_IN_PREMISE, evidenceStatus: COMPONENT_EVIDENCE_STATUS.VERIFIED,
  rationale: 'Cross-case', evidenceRefs: ['EV'], preparedByRef: 'A', preparedAt: '2026-01-05', reviewedByRef: 'R', reviewedAt: '2026-01-06', reviewEvidenceRef: 'REV',
});
throws(() => buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET,
  SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
  SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY,
  { componentTreatments: [crossCaseTreatment] },
)), /CASE_OR_PROPERTY_ISOLATION_VIOLATION:componentTreatment/, 'cross-case component treatment rejected');

const duplicate = treatment(SPECIALIZED_VALUE_COMPONENT.REAL_PROPERTY, COMPONENT_TREATMENT.INCLUDED_IN_PREMISE, '-DUP');
const duplicateHold = buildSpecializedInterestSeparationPacket(packetInput(
  SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET,
  SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE,
  SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY,
  { componentTreatments: [duplicate, duplicate] },
));
eq(duplicateHold.status, SPECIALIZED_INTEREST_SEPARATION_STATUS.HOLD_COMPONENT_EVIDENCE, 'duplicate component treatment fails closed');
check(duplicateHold.blockers.some((b) => b.includes('DUPLICATE_COMPONENT_TREATMENT_ID')), 'duplicate ID blocker explicit');
check(duplicateHold.blockers.some((b) => b.includes('DUPLICATE_COMPONENT_CLASSIFICATION')), 'duplicate component blocker explicit');

check(premiseConflict(SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_ONLY, new Map([[SPECIALIZED_VALUE_COMPONENT.REAL_PROPERTY, component]])).length === 0, 'minimal heritage premise has no conflict');
check(!verifySpecializedInterestSeparationPacketIntegrity({ ...rpOnly, valuationPremise: SPECIALIZED_VALUATION_PREMISE.REAL_PROPERTY_PLUS_FF_E }), 'tampered separation packet fails integrity');
check(Object.isFrozen(rpOnly), 'separation packet immutable');

console.log(`WAVE_14G_SPECIALIZED_INTEREST_SEPARATION=PASS checks=${checks}`);

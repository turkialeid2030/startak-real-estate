'use strict';

const assert = require('assert');
const {
  ESG_PILLAR,
  ESG_FACTOR,
  ESG_SOURCE_CLASS,
  ESG_VERIFICATION_STATUS,
  ESG_EVIDENCE_SET_STATUS,
  ESG_MATERIALITY_OUTCOME,
  ESG_MATERIALITY_STATUS,
  ESG_VALUE_DIRECTION,
  ESG_VALUATION_CONSIDERATION_STATUS,
  createEsgEvidenceRecord,
  verifyEsgEvidenceIntegrity,
  assessEsgEvidenceSet,
  verifyEsgEvidenceSetIntegrity,
  recordEsgMaterialityAssessment,
  verifyEsgMaterialityAssessmentIntegrity,
  buildEsgValuationConsiderationPacket,
} = require('../../src/esg');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}
function throwsWith(fn, fragment, message) {
  let ok = false;
  try { fn(); } catch (error) { ok = String(error.message).includes(fragment); }
  check(ok, message);
}

const CASE_ID = 'CASE-10B-001';
const PROPERTY_REF = 'PROPERTY-10B-001';
const VALUATION_DATE = '2026-09-07T00:00:00Z';
const REQUIRED = [
  ESG_FACTOR.ENERGY_PERFORMANCE,
  ESG_FACTOR.WATER_EFFICIENCY,
  ESG_FACTOR.CLIMATE_PHYSICAL_RISK,
  ESG_FACTOR.ACCESSIBILITY_INCLUSION,
  ESG_FACTOR.GOVERNANCE_COMPLIANCE,
];

function record({
  id,
  pillar,
  factor,
  claimKey,
  value,
  unit = null,
  sourceClass = ESG_SOURCE_CLASS.VERIFIED_TECHNICAL_REPORT,
  sourceDate = '2026-08-01T00:00:00Z',
  validFrom = '2026-01-01T00:00:00Z',
  validTo = null,
  verified = true,
} = {}) {
  return createEsgEvidenceRecord({
    evidenceId: id,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    pillar,
    factor,
    claimKey,
    normalizedValue: value,
    unit,
    observation: `Synthetic observation for ${factor}`,
    sourceClass,
    sourceName: 'SYNTHETIC ESG SOURCE',
    sourceRef: `SOURCE-${id}`,
    sourceDate,
    validFrom,
    validTo,
    verification: verified
      ? {
        status: ESG_VERIFICATION_STATUS.VERIFIED,
        verifiedByRef: 'USER:ESG-REVIEWER',
        verifiedAt: '2026-08-03T10:00:00Z',
        verificationEvidenceRef: `review://${id}`,
      }
      : { status: ESG_VERIFICATION_STATUS.NOT_VERIFIED },
    capturedAt: '2026-08-03T09:00:00Z',
  });
}

const energy = record({
  id: 'ESG-ENERGY', pillar: ESG_PILLAR.ENVIRONMENTAL, factor: ESG_FACTOR.ENERGY_PERFORMANCE,
  claimKey: 'annual_energy_intensity', value: 145, unit: 'kWh/sqm/year',
});
const water = record({
  id: 'ESG-WATER', pillar: ESG_PILLAR.ENVIRONMENTAL, factor: ESG_FACTOR.WATER_EFFICIENCY,
  claimKey: 'annual_water_intensity', value: 0.65, unit: 'm3/sqm/year',
});
const climate = record({
  id: 'ESG-CLIMATE', pillar: ESG_PILLAR.ENVIRONMENTAL, factor: ESG_FACTOR.CLIMATE_PHYSICAL_RISK,
  claimKey: 'physical_risk_class', value: 'MODERATE_HEAT_EXPOSURE',
  sourceClass: ESG_SOURCE_CLASS.OFFICIAL_AUTHORITY,
});
const accessibility = record({
  id: 'ESG-ACCESS', pillar: ESG_PILLAR.SOCIAL, factor: ESG_FACTOR.ACCESSIBILITY_INCLUSION,
  claimKey: 'accessibility_review', value: 'VERIFIED_REVIEW_COMPLETE',
});
const governance = record({
  id: 'ESG-GOV', pillar: ESG_PILLAR.GOVERNANCE, factor: ESG_FACTOR.GOVERNANCE_COMPLIANCE,
  claimKey: 'governance_controls', value: 'DOCUMENTED_CONTROLS_PRESENT',
});
const records = [energy, water, climate, accessibility, governance];

check(records.every(verifyEsgEvidenceIntegrity), 'ESG evidence records have deterministic integrity hashes');
check(records.every((item) => item.automaticValueAdjustmentApplied === false), 'ESG evidence never applies a value adjustment');
check(records.every((item) => item.canonicalEngineInputsWritten === false && item.transactionAuthorized === false), 'ESG evidence does not write engine inputs or authorize transactions');

const readySet = assessEsgEvidenceSet({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  valuationDate: VALUATION_DATE,
  records,
  requiredFactors: REQUIRED,
  allowedSourceClasses: [ESG_SOURCE_CLASS.OFFICIAL_AUTHORITY, ESG_SOURCE_CLASS.VERIFIED_TECHNICAL_REPORT],
  maxAgeDaysByFactor: {
    [ESG_FACTOR.ENERGY_PERFORMANCE]: 365,
    [ESG_FACTOR.WATER_EFFICIENCY]: 365,
    [ESG_FACTOR.CLIMATE_PHYSICAL_RISK]: 365,
  },
});
check(readySet.status === ESG_EVIDENCE_SET_STATUS.READY_FOR_MATERIALITY_REVIEW, 'verified ESG set is ready for professional materiality review');
check(readySet.readyForMaterialityReview === true, 'ESG readiness is a materiality-review handoff only');
check(readySet.esgValueEffectEstablished === false && readySet.automaticValueAdjustmentApplied === false, 'ESG evidence readiness does not establish a value effect');
check(verifyEsgEvidenceSetIntegrity(readySet), 'ESG evidence set hash verifies');

const missingSet = assessEsgEvidenceSet({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  valuationDate: VALUATION_DATE,
  records: records.filter((item) => item.factor !== ESG_FACTOR.WATER_EFFICIENCY),
  requiredFactors: REQUIRED,
  allowedSourceClasses: [ESG_SOURCE_CLASS.OFFICIAL_AUTHORITY, ESG_SOURCE_CLASS.VERIFIED_TECHNICAL_REPORT],
});
check(missingSet.status === ESG_EVIDENCE_SET_STATUS.HOLD_MISSING_EVIDENCE, 'missing configured ESG factor fails closed');
check(missingSet.blockers.includes('MISSING_REQUIRED_ESG_FACTOR:WATER_EFFICIENCY'), 'missing ESG factor blocker is explicit');

const expiredClimate = record({
  id: 'ESG-CLIMATE-EXPIRED', pillar: ESG_PILLAR.ENVIRONMENTAL, factor: ESG_FACTOR.CLIMATE_PHYSICAL_RISK,
  claimKey: 'physical_risk_class', value: 'OLD_RISK_CLASS', sourceClass: ESG_SOURCE_CLASS.OFFICIAL_AUTHORITY,
  validTo: '2026-06-30T00:00:00Z',
});
const temporalSet = assessEsgEvidenceSet({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, valuationDate: VALUATION_DATE,
  records: [...records.filter((item) => item.factor !== ESG_FACTOR.CLIMATE_PHYSICAL_RISK), expiredClimate],
  requiredFactors: REQUIRED,
  allowedSourceClasses: [ESG_SOURCE_CLASS.OFFICIAL_AUTHORITY, ESG_SOURCE_CLASS.VERIFIED_TECHNICAL_REPORT],
});
check(temporalSet.status === ESG_EVIDENCE_SET_STATUS.HOLD_TEMPORAL_VALIDITY, 'expired ESG evidence is not valid for the valuation date');

const unverifiedWater = record({
  id: 'ESG-WATER-UNVERIFIED', pillar: ESG_PILLAR.ENVIRONMENTAL, factor: ESG_FACTOR.WATER_EFFICIENCY,
  claimKey: 'annual_water_intensity', value: 0.7, unit: 'm3/sqm/year',
  sourceClass: ESG_SOURCE_CLASS.CLIENT_PROVIDED, verified: false,
});
const verificationSet = assessEsgEvidenceSet({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, valuationDate: VALUATION_DATE,
  records: [...records.filter((item) => item.factor !== ESG_FACTOR.WATER_EFFICIENCY), unverifiedWater],
  requiredFactors: REQUIRED,
  allowedSourceClasses: [ESG_SOURCE_CLASS.OFFICIAL_AUTHORITY, ESG_SOURCE_CLASS.VERIFIED_TECHNICAL_REPORT],
});
check(verificationSet.status === ESG_EVIDENCE_SET_STATUS.HOLD_VERIFICATION, 'unverified/disallowed ESG evidence cannot satisfy the professional evidence gate');

const staleEnergy = record({
  id: 'ESG-ENERGY-STALE', pillar: ESG_PILLAR.ENVIRONMENTAL, factor: ESG_FACTOR.ENERGY_PERFORMANCE,
  claimKey: 'annual_energy_intensity', value: 150, unit: 'kWh/sqm/year', sourceDate: '2024-01-01T00:00:00Z',
});
const staleSet = assessEsgEvidenceSet({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, valuationDate: VALUATION_DATE,
  records: [...records.filter((item) => item.factor !== ESG_FACTOR.ENERGY_PERFORMANCE), staleEnergy],
  requiredFactors: REQUIRED,
  allowedSourceClasses: [ESG_SOURCE_CLASS.OFFICIAL_AUTHORITY, ESG_SOURCE_CLASS.VERIFIED_TECHNICAL_REPORT],
  maxAgeDaysByFactor: { [ESG_FACTOR.ENERGY_PERFORMANCE]: 365 },
});
check(staleSet.status === ESG_EVIDENCE_SET_STATUS.HOLD_STALE, 'stale ESG evidence fails configured freshness policy');

const conflictingEnergy = record({
  id: 'ESG-ENERGY-CONFLICT', pillar: ESG_PILLAR.ENVIRONMENTAL, factor: ESG_FACTOR.ENERGY_PERFORMANCE,
  claimKey: 'annual_energy_intensity', value: 220, unit: 'kWh/sqm/year',
});
const contradictionSet = assessEsgEvidenceSet({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, valuationDate: VALUATION_DATE,
  records: [...records, conflictingEnergy],
  requiredFactors: REQUIRED,
  allowedSourceClasses: [ESG_SOURCE_CLASS.OFFICIAL_AUTHORITY, ESG_SOURCE_CLASS.VERIFIED_TECHNICAL_REPORT],
});
check(contradictionSet.status === ESG_EVIDENCE_SET_STATUS.HOLD_CONTRADICTION, 'contradictory verified ESG claims fail closed');
check(contradictionSet.blockers.includes('CONTRADICTORY_ESG_CLAIM:ENERGY_PERFORMANCE:annual_energy_intensity'), 'ESG contradiction identifies factor and claim');

const tamperedEnergy = { ...energy, normalizedValue: 999 };
const integritySet = assessEsgEvidenceSet({
  caseId: CASE_ID, propertyRef: PROPERTY_REF, valuationDate: VALUATION_DATE,
  records: [tamperedEnergy, ...records.slice(1)],
  requiredFactors: REQUIRED,
  allowedSourceClasses: [ESG_SOURCE_CLASS.OFFICIAL_AUTHORITY, ESG_SOURCE_CLASS.VERIFIED_TECHNICAL_REPORT],
});
check(integritySet.status === ESG_EVIDENCE_SET_STATUS.HOLD_INTEGRITY, 'tampered ESG evidence hash fails closed');
check(integritySet.blockers.some((item) => item.startsWith('ESG_EVIDENCE_INTEGRITY_FAILED:')), 'ESG integrity blocker is explicit');

throwsWith(() => assessEsgEvidenceSet({
  caseId: 'CASE-OTHER', propertyRef: PROPERTY_REF, valuationDate: VALUATION_DATE,
  records, requiredFactors: REQUIRED,
  allowedSourceClasses: [ESG_SOURCE_CLASS.OFFICIAL_AUTHORITY, ESG_SOURCE_CLASS.VERIFIED_TECHNICAL_REPORT],
}), 'CASE_OR_PROPERTY_ISOLATION_VIOLATION', 'cross-case ESG evidence is rejected');

const materiality = recordEsgMaterialityAssessment({
  assessmentId: 'ESG-MAT-001',
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  evidenceSet: readySet,
  factorReviews: [
    { factor: ESG_FACTOR.ENERGY_PERFORMANCE, outcome: ESG_MATERIALITY_OUTCOME.MATERIAL, rationale: 'Energy performance may affect operating competitiveness and marketability.', evidenceIds: ['ESG-ENERGY'] },
    { factor: ESG_FACTOR.WATER_EFFICIENCY, outcome: ESG_MATERIALITY_OUTCOME.NOT_MATERIAL, rationale: 'No material market differentiation evidenced in this synthetic case.', evidenceIds: ['ESG-WATER'] },
    { factor: ESG_FACTOR.CLIMATE_PHYSICAL_RISK, outcome: ESG_MATERIALITY_OUTCOME.POTENTIALLY_MATERIAL, rationale: 'Physical risk warrants market linkage review.', evidenceIds: ['ESG-CLIMATE'] },
    { factor: ESG_FACTOR.ACCESSIBILITY_INCLUSION, outcome: ESG_MATERIALITY_OUTCOME.NOT_MATERIAL, rationale: 'Verified but not shown material in this synthetic case.', evidenceIds: ['ESG-ACCESS'] },
    { factor: ESG_FACTOR.GOVERNANCE_COMPLIANCE, outcome: ESG_MATERIALITY_OUTCOME.NOT_MATERIAL, rationale: 'No distinct value effect established.', evidenceIds: ['ESG-GOV'] },
  ],
  reviewedByRef: 'USER:ESG-VALUER',
  reviewedAt: '2026-09-07T10:00:00Z',
  reviewEvidenceRef: 'review://esg-materiality',
});
check(materiality.status === ESG_MATERIALITY_STATUS.MATERIALITY_REVIEW_RECORDED, 'professional ESG materiality review is recorded');
check(materiality.materialFactors.includes(ESG_FACTOR.ENERGY_PERFORMANCE), 'material ESG factor is explicit');
check(materiality.potentiallyMaterialFactors.includes(ESG_FACTOR.CLIMATE_PHYSICAL_RISK), 'potentially material ESG factor is explicit');
check(materiality.esgValueEffectEstablished === false && materiality.numericValueAdjustmentProduced === false, 'materiality does not manufacture a numeric value effect');
check(verifyEsgMaterialityAssessmentIntegrity(materiality), 'ESG materiality assessment integrity verifies');

const incompleteMateriality = recordEsgMaterialityAssessment({
  assessmentId: 'ESG-MAT-HOLD', caseId: CASE_ID, propertyRef: PROPERTY_REF, evidenceSet: readySet,
  factorReviews: [{ factor: ESG_FACTOR.ENERGY_PERFORMANCE, outcome: ESG_MATERIALITY_OUTCOME.MATERIAL, rationale: 'Only one review supplied', evidenceIds: ['ESG-ENERGY'] }],
  reviewedByRef: 'USER:ESG-VALUER', reviewedAt: '2026-09-07T10:00:00Z', reviewEvidenceRef: 'review://hold',
});
check(incompleteMateriality.status === ESG_MATERIALITY_STATUS.HOLD_REVIEW, 'missing configured factor materiality reviews fail closed');

const noMarketLink = buildEsgValuationConsiderationPacket({
  packetId: 'ESG-CONS-HOLD', caseId: CASE_ID, propertyRef: PROPERTY_REF, materialityAssessment: materiality,
  considerations: [{ factor: ESG_FACTOR.ENERGY_PERFORMANCE, direction: ESG_VALUE_DIRECTION.UPWARD, rationale: 'Potential premium requires evidence.', marketEvidenceRefs: [] }],
  preparedByRef: 'USER:ESG-VALUER', preparedAt: '2026-09-07T11:00:00Z', packetEvidenceRef: 'packet://hold',
});
check(noMarketLink.status === ESG_VALUATION_CONSIDERATION_STATUS.HOLD_MARKET_LINKAGE, 'ESG factor cannot enter valuation consideration without market linkage');
check(noMarketLink.automaticValueAdjustmentApplied === false, 'missing market linkage never triggers adjustment');

const consideration = buildEsgValuationConsiderationPacket({
  packetId: 'ESG-CONS-001', caseId: CASE_ID, propertyRef: PROPERTY_REF, materialityAssessment: materiality,
  considerations: [
    { factor: ESG_FACTOR.ENERGY_PERFORMANCE, direction: ESG_VALUE_DIRECTION.UPWARD, rationale: 'Directional consideration supported by verified market evidence; any quantitative adoption remains separate professional judgment.', marketEvidenceRefs: ['market://comparable-energy-1', 'market://lease-energy-1'] },
    { factor: ESG_FACTOR.CLIMATE_PHYSICAL_RISK, direction: ESG_VALUE_DIRECTION.DOWNWARD, rationale: 'Directional risk consideration supported by market evidence; no automatic adjustment.', marketEvidenceRefs: ['market://risk-evidence-1'] },
  ],
  preparedByRef: 'USER:ESG-VALUER', preparedAt: '2026-09-07T11:00:00Z', packetEvidenceRef: 'packet://esg-001',
});
check(consideration.status === ESG_VALUATION_CONSIDERATION_STATUS.READY_FOR_PROFESSIONAL_CONSIDERATION, 'market-linked material ESG factors can be handed to professional valuation consideration');
check(consideration.professionalValuationConsiderationReady === true && consideration.explicitProfessionalAdoptionRequired === true, 'ESG packet requires explicit professional adoption');
check(consideration.automaticValueAdjustmentApplied === false && consideration.numericValueAdjustmentProduced === false, 'ESG packet never calculates or applies a value adjustment');
check(consideration.canonicalEngineInputsWritten === false && consideration.certifiedValuationEstablished === false && consideration.transactionAuthorized === false, 'ESG consideration preserves engine/certification/transaction boundaries');
check(/^[a-f0-9]{64}$/.test(consideration.esgValuationConsiderationHashSha256), 'ESG valuation-consideration packet has deterministic SHA-256');

const nonMaterialConsideration = buildEsgValuationConsiderationPacket({
  packetId: 'ESG-CONS-NONMAT', caseId: CASE_ID, propertyRef: PROPERTY_REF, materialityAssessment: materiality,
  considerations: [{ factor: ESG_FACTOR.WATER_EFFICIENCY, direction: ESG_VALUE_DIRECTION.NEUTRAL, rationale: 'Should not enter valuation consideration when reviewed non-material.', marketEvidenceRefs: ['market://water'] }],
  preparedByRef: 'USER:ESG-VALUER', preparedAt: '2026-09-07T11:00:00Z', packetEvidenceRef: 'packet://nonmat',
});
check(nonMaterialConsideration.status === ESG_VALUATION_CONSIDERATION_STATUS.HOLD_MATERIALITY, 'non-material factor is held from valuation consideration');

const tamperedMateriality = { ...materiality, factorReviews: materiality.factorReviews.map((item, index) => index === 0 ? { ...item, rationale: 'TAMPERED' } : item) };
const tamperedPacket = buildEsgValuationConsiderationPacket({
  packetId: 'ESG-CONS-TAMPER', caseId: CASE_ID, propertyRef: PROPERTY_REF, materialityAssessment: tamperedMateriality,
  considerations: [{ factor: ESG_FACTOR.ENERGY_PERFORMANCE, direction: ESG_VALUE_DIRECTION.UPWARD, rationale: 'Tamper check', marketEvidenceRefs: ['market://energy'] }],
  preparedByRef: 'USER:ESG-VALUER', preparedAt: '2026-09-07T11:00:00Z', packetEvidenceRef: 'packet://tamper',
});
check(tamperedPacket.status === ESG_VALUATION_CONSIDERATION_STATUS.HOLD_INTEGRITY, 'tampered ESG materiality assessment fails valuation handoff integrity');

console.log(`WAVE_10B_ESG_EVIDENCE=PASS checks=${checks}`);

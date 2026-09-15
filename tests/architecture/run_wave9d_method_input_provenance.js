'use strict';

const assert = require('assert');
const {
  PROPERTY_EVIDENCE_PACKET_STATUS,
} = require('../../src/property/property-evidence-bridge');
const {
  ADJUSTMENT_ANALYSIS_STATUS,
  LEASE_INCOME_GATE_STATUS,
} = require('../../src/market');
const {
  VALUATION_METHOD,
  RATE_INPUT_TYPE,
  RATE_SOURCE,
  RATE_CONFIDENCE,
  METHOD_INPUT_STATUS,
  createProfessionalRateInput,
  verifyProfessionalRateInputIntegrity,
  createMarketAnalysisSubjectBinding,
  verifyMarketAnalysisSubjectBindingIntegrity,
  buildProfessionalMethodInputPacket,
} = require('../../src/valuation/professional-method-input-provenance');

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

const CASE_ID = 'CASE-9D-001';
const PROPERTY_REF = 'PROPERTY-9D-001';
const VALUATION_DATE = '2026-09-07T00:00:00.000Z';
const PREPARED_AT = '2026-09-07T12:00:00.000Z';

function propertyPacket(overrides = {}) {
  return {
    schemaVersion: 1,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    packetHashSha256: 'a'.repeat(64),
    valuationDate: VALUATION_DATE,
    basisOfValue: 'SYNTHETIC_MARKET_VALUE',
    purpose: 'ACQUISITION_ANALYSIS',
    status: PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW,
    professionalValuationWorkflowReady: true,
    financialEngineInputsWritten: false,
    transactionAuthorized: false,
    ...overrides,
  };
}

function marketAnalysis(overrides = {}) {
  return {
    schemaVersion: 1,
    caseId: CASE_ID,
    analysisHashSha256: 'b'.repeat(64),
    status: ADJUSTMENT_ANALYSIS_STATUS.READY_FOR_RECONCILIATION,
    reconciliationReady: true,
    indications: [
      { comparableId: 'C1', adjustedUnitValueSarPerSqm: 10000, valuationWeight: null },
      { comparableId: 'C2', adjustedUnitValueSarPerSqm: 10200, valuationWeight: null },
    ],
    automaticValuationWeighting: false,
    valuationConclusionProduced: false,
    ...overrides,
  };
}

function incomePacket(overrides = {}) {
  return {
    schemaVersion: 1,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    incomeEvidencePacketHashSha256: 'c'.repeat(64),
    status: LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF,
    readyForIncomeAnalysisHandoff: true,
    activeLeaseCount: 2,
    occupiedAreaSqm: 1000,
    annualContractRentSar: 1050000,
    noiCalculated: false,
    automaticDCFAdoption: false,
    ...overrides,
  };
}

function rate(type, value, id, overrides = {}) {
  return createProfessionalRateInput({
    rateId: id,
    caseId: CASE_ID,
    propertyRef: PROPERTY_REF,
    type,
    value,
    source: RATE_SOURCE.VERIFIED_MARKET_ANALYSIS,
    rationale: `Synthetic professional ${type} rationale`,
    evidenceRefs: [`evidence://${id}/market`, `evidence://${id}/review`],
    asOfDate: '2026-09-01T00:00:00Z',
    preparedByRef: 'USER:VALUER',
    preparedAt: '2026-09-07T09:00:00Z',
    reviewedByRef: 'USER:REVIEWER',
    reviewedAt: '2026-09-07T10:00:00Z',
    reviewEvidenceRef: `review://${id}`,
    confidence: RATE_CONFIDENCE.HIGH,
    ...overrides,
  });
}

const capRate = rate(RATE_INPUT_TYPE.MARKET_CAP_RATE, 0.08, 'RATE-CAP');
const discountRate = rate(RATE_INPUT_TYPE.DISCOUNT_RATE, 0.10, 'RATE-DISCOUNT');
const exitCapRate = rate(RATE_INPUT_TYPE.EXIT_CAP_RATE, 0.085, 'RATE-EXIT');

check(verifyProfessionalRateInputIntegrity(capRate) === true, 'professional cap-rate record passes deterministic integrity verification');
check(capRate.automaticallyDerived === false && capRate.canonicalEngineInputWritten === false, 'rate provenance neither derives nor writes canonical engine input');
check(capRate.value === 0.08 && capRate.evidenceRefs.length === 2, 'rate value and evidence provenance are preserved');

throwsWith(() => rate(RATE_INPUT_TYPE.MARKET_CAP_RATE, 0, 'BAD-ZERO'), 'finite decimal rate', 'zero cap rate fails semantic validation');
throwsWith(() => rate(RATE_INPUT_TYPE.DISCOUNT_RATE, 1.2, 'BAD-RANGE'), 'finite decimal rate', 'rate above 100% fails semantic validation');
throwsWith(() => rate(RATE_INPUT_TYPE.EXIT_CAP_RATE, 0.08, 'BAD-TIME', { reviewedAt: '2026-09-07T08:00:00Z' }), 'RATE_REVIEW_BEFORE_PREPARATION', 'rate review cannot predate rate preparation');
throwsWith(() => rate(RATE_INPUT_TYPE.EXIT_CAP_RATE, 0.08, 'BAD-OTHER', { source: RATE_SOURCE.OTHER, sourceLabel: null }), 'OTHER_RATE_SOURCE_REQUIRES_LABEL', 'OTHER source requires explicit label');

const analysis = marketAnalysis();
const subjectBinding = createMarketAnalysisSubjectBinding({
  bindingId: 'BIND-MARKET-1',
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  marketAdjustmentAnalysis: analysis,
  boundByRef: 'USER:VALUER',
  boundAt: '2026-09-07T11:00:00Z',
  bindingEvidenceRef: 'review://market-subject-binding',
});
check(verifyMarketAnalysisSubjectBindingIntegrity(subjectBinding) === true, 'sales-analysis subject-property binding has deterministic integrity');
check(subjectBinding.subjectPropertyBindingExplicit === true && subjectBinding.automaticallyInferred === false, 'subject property is explicitly bound, never inferred');

const sales = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.SALES_COMPARISON,
  propertyEvidencePacket: propertyPacket(),
  marketAdjustmentAnalysis: analysis,
  marketAnalysisSubjectBinding: subjectBinding,
  rateInputs: [],
  maximumRateAgeDaysByType: {},
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://sales-method-input',
});
check(sales.status === METHOD_INPUT_STATUS.READY_FOR_CANONICAL_ENGINE_ADOPTION_REVIEW, 'sales-comparison method evidence becomes ready for adoption review');
check(sales.methodEvidence.adjustedComparableIndications.length === 2, 'sales packet preserves adjusted indications');
check(sales.methodEvidence.adjustedComparableIndications.every((item) => item.valuationWeight === null), 'sales method packet manufactures no valuation weight');
check(Object.keys(sales.candidateCanonicalRateBindings).length === 0, 'sales comparison does not create unrelated canonical rate bindings');
check(sales.automaticMethodSelection === false && sales.valuationConclusionProduced === false, 'method packet neither chooses method nor concludes value');

const forgedBinding = { ...subjectBinding, propertyRef: 'OTHER-PROPERTY' };
throwsWith(() => buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.SALES_COMPARISON,
  propertyEvidencePacket: propertyPacket(),
  marketAdjustmentAnalysis: analysis,
  marketAnalysisSubjectBinding: forgedBinding,
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://bad-binding',
}), 'CASE_OR_PROPERTY_ISOLATION_VIOLATION:marketAnalysisSubjectBinding', 'sales subject binding cannot point to another property');

const tamperedBinding = { ...subjectBinding, marketAdjustmentAnalysisHashSha256: 'd'.repeat(64) };
const tamperedBindingHold = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.SALES_COMPARISON,
  propertyEvidencePacket: propertyPacket(),
  marketAdjustmentAnalysis: analysis,
  marketAnalysisSubjectBinding: tamperedBinding,
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://tampered-binding',
});
check(tamperedBindingHold.status === METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, 'tampered market subject binding fails closed');
check(tamperedBindingHold.reasons.includes('MARKET_ANALYSIS_SUBJECT_BINDING_INTEGRITY_FAILED'), 'binding integrity failure is explicit');

const directCap = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.DIRECT_CAPITALIZATION,
  propertyEvidencePacket: propertyPacket(),
  incomeEvidencePacket: incomePacket(),
  rateInputs: [capRate],
  maximumRateAgeDaysByType: { MARKET_CAP_RATE: 30 },
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://direct-cap-input',
});
check(directCap.status === METHOD_INPUT_STATUS.READY_FOR_CANONICAL_ENGINE_ADOPTION_REVIEW, 'direct capitalization becomes ready only with income evidence and reviewed cap rate');
check(directCap.candidateCanonicalRateBindings.marketCapRate === 0.08, 'direct-cap packet exposes reviewed cap rate as candidate canonical binding');
check(directCap.methodEvidence.noi === null, 'method-input provenance layer does not calculate NOI');
check(directCap.canonicalEngineInputWriteAuthorized === false && directCap.financialEngineInputsWritten === false, 'candidate cap-rate binding never writes canonical engine automatically');

const directMissing = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.DIRECT_CAPITALIZATION,
  propertyEvidencePacket: propertyPacket(),
  incomeEvidencePacket: incomePacket(),
  rateInputs: [],
  maximumRateAgeDaysByType: {},
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://direct-missing',
});
check(directMissing.status === METHOD_INPUT_STATUS.HOLD_INPUT_COMPLETENESS, 'direct-cap method holds when cap rate is missing');
check(directMissing.reasons.includes('REQUIRED_RATE_INPUT_MISSING:MARKET_CAP_RATE'), 'missing direct cap rate reason is explicit');

const dcf = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.DISCOUNTED_CASH_FLOW,
  propertyEvidencePacket: propertyPacket(),
  incomeEvidencePacket: incomePacket(),
  rateInputs: [discountRate, exitCapRate],
  maximumRateAgeDaysByType: { DISCOUNT_RATE: 30, EXIT_CAP_RATE: 30 },
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://dcf-input',
});
check(dcf.status === METHOD_INPUT_STATUS.READY_FOR_CANONICAL_ENGINE_ADOPTION_REVIEW, 'DCF becomes ready with explicit reviewed discount and exit cap rates');
check(dcf.candidateCanonicalRateBindings.discountRate === 0.10, 'DCF packet preserves explicit reviewed discount rate');
check(dcf.candidateCanonicalRateBindings.exitCapRate === 0.085, 'DCF packet preserves explicit reviewed exit cap rate');
check(!Object.prototype.hasOwnProperty.call(dcf.candidateCanonicalRateBindings, 'marketCapRate'), 'DCF candidate bindings do not introduce market cap rate');
check(dcf.rateProvenance.length === 2 && dcf.rateProvenance.every((item) => item.rateInputHashSha256), 'DCF packet preserves complete rate provenance hashes');
check(/^[a-f0-9]{64}$/.test(dcf.methodInputPacketHashSha256), 'method-input packet has deterministic SHA-256');
check(dcf.explicitHumanAdoptionRequired === true && dcf.canonicalCalculationEngineRemainsAuthoritative === true, 'canonical-engine boundary is explicit');

const noExitSubstitution = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.DISCOUNTED_CASH_FLOW,
  propertyEvidencePacket: propertyPacket(),
  incomeEvidencePacket: incomePacket(),
  rateInputs: [discountRate, capRate],
  maximumRateAgeDaysByType: { DISCOUNT_RATE: 30, MARKET_CAP_RATE: 30 },
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://dcf-no-exit',
});
check(noExitSubstitution.status === METHOD_INPUT_STATUS.HOLD_INPUT_COMPLETENESS, 'DCF fails closed when explicit exit cap is absent even if market cap exists');
check(noExitSubstitution.reasons.includes('EXPLICIT_EXIT_CAP_RATE_REQUIRED'), 'DCF emits explicit exit-cap requirement');
check(!Object.prototype.hasOwnProperty.call(noExitSubstitution.candidateCanonicalRateBindings, 'exitCapRate'), 'missing exit cap is never derived from market cap');

const missingFreshness = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.DIRECT_CAPITALIZATION,
  propertyEvidencePacket: propertyPacket(),
  incomeEvidencePacket: incomePacket(),
  rateInputs: [capRate],
  maximumRateAgeDaysByType: {},
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://freshness-missing',
});
check(missingFreshness.status === METHOD_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'required rate cannot proceed without explicit freshness policy');
check(missingFreshness.reasons.includes('RATE_FRESHNESS_POLICY_REQUIRED:MARKET_CAP_RATE'), 'missing rate freshness policy is explicit');

const staleCap = rate(RATE_INPUT_TYPE.MARKET_CAP_RATE, 0.08, 'RATE-STALE', {
  asOfDate: '2025-01-01T00:00:00Z',
  preparedAt: '2026-09-07T09:00:00Z',
  reviewedAt: '2026-09-07T10:00:00Z',
});
const staleHold = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.DIRECT_CAPITALIZATION,
  propertyEvidencePacket: propertyPacket(),
  incomeEvidencePacket: incomePacket(),
  rateInputs: [staleCap],
  maximumRateAgeDaysByType: { MARKET_CAP_RATE: 90 },
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://stale-rate',
});
check(staleHold.status === METHOD_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'stale rate provenance fails closed');
check(staleHold.reasons.some((item) => item.startsWith('RATE_PROVENANCE_STALE:MARKET_CAP_RATE:')), 'stale rate hold quantifies age policy breach');

const duplicateCap = rate(RATE_INPUT_TYPE.MARKET_CAP_RATE, 0.081, 'RATE-CAP-2');
const duplicateHold = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.DIRECT_CAPITALIZATION,
  propertyEvidencePacket: propertyPacket(),
  incomeEvidencePacket: incomePacket(),
  rateInputs: [capRate, duplicateCap],
  maximumRateAgeDaysByType: { MARKET_CAP_RATE: 30 },
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://duplicate-rate',
});
check(duplicateHold.status === METHOD_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'duplicate professional rate type fails closed');
check(duplicateHold.reasons.includes('DUPLICATE_RATE_TYPE:MARKET_CAP_RATE'), 'duplicate rate type blocker is explicit');

const tamperedRate = { ...capRate, value: 0.25 };
const tamperedRateHold = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.DIRECT_CAPITALIZATION,
  propertyEvidencePacket: propertyPacket(),
  incomeEvidencePacket: incomePacket(),
  rateInputs: [tamperedRate],
  maximumRateAgeDaysByType: { MARKET_CAP_RATE: 30 },
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://tampered-rate',
});
check(tamperedRateHold.status === METHOD_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'tampered rate provenance fails integrity gate');
check(tamperedRateHold.reasons.includes('RATE_INPUT_INTEGRITY_FAILED:RATE-CAP'), 'rate integrity failure is explicit');

const notReadyProperty = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.DIRECT_CAPITALIZATION,
  propertyEvidencePacket: propertyPacket({ status: PROPERTY_EVIDENCE_PACKET_STATUS.HOLD_EVIDENCE, professionalValuationWorkflowReady: false }),
  incomeEvidencePacket: incomePacket(),
  rateInputs: [capRate],
  maximumRateAgeDaysByType: { MARKET_CAP_RATE: 30 },
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://bad-property',
});
check(notReadyProperty.status === METHOD_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, 'method input cannot bypass property evidence readiness');

const notReadyIncome = buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.DIRECT_CAPITALIZATION,
  propertyEvidencePacket: propertyPacket(),
  incomeEvidencePacket: incomePacket({ status: LEASE_INCOME_GATE_STATUS.HOLD_RECONCILIATION, readyForIncomeAnalysisHandoff: false }),
  rateInputs: [capRate],
  maximumRateAgeDaysByType: { MARKET_CAP_RATE: 30 },
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://bad-income',
});
check(notReadyIncome.status === METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, 'income method cannot bypass lease-income evidence reconciliation');

throwsWith(() => buildProfessionalMethodInputPacket({
  caseId: CASE_ID,
  propertyRef: PROPERTY_REF,
  method: VALUATION_METHOD.DIRECT_CAPITALIZATION,
  propertyEvidencePacket: propertyPacket(),
  incomeEvidencePacket: incomePacket(),
  rateInputs: [{ ...capRate, caseId: 'CASE-OTHER' }],
  maximumRateAgeDaysByType: { MARKET_CAP_RATE: 30 },
  preparedByRef: 'USER:VALUER',
  preparedAt: PREPARED_AT,
  preparationEvidenceRef: 'review://cross-case',
}), 'CASE_OR_PROPERTY_ISOLATION_VIOLATION:rateInput', 'cross-case rate input is rejected');

console.log(`WAVE_9D_METHOD_INPUT_PROVENANCE=PASS checks=${checks}`);

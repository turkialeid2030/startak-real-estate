'use strict';

const crypto = require('crypto');
const { verifyProfessionalNoiResultIntegrity } = require('../valuation/direct-capitalization-input');
const { verifyProfessionalDcfResultIntegrity } = require('./professional-dcf-result-verifier');

const INVESTMENT_BASIS_TYPE = Object.freeze({
  ACQUISITION_COST: 'ACQUISITION_COST',
  TOTAL_PROJECT_COST: 'TOTAL_PROJECT_COST',
  OTHER_EXPLICIT_BASIS: 'OTHER_EXPLICIT_BASIS',
});

const COLLATERAL_VALUE_BASIS_TYPE = Object.freeze({
  EXTERNAL_APPRAISED_VALUE: 'EXTERNAL_APPRAISED_VALUE',
  LENDER_VALUE: 'LENDER_VALUE',
  PROFESSIONAL_DCF_METHOD_INDICATION: 'PROFESSIONAL_DCF_METHOD_INDICATION',
  OTHER_EXPLICIT_VALUE_BASIS: 'OTHER_EXPLICIT_VALUE_BASIS',
});

const ANALYSIS_SOURCE = Object.freeze({
  VERIFIED_TRANSACTION_DOCUMENT: 'VERIFIED_TRANSACTION_DOCUMENT',
  VERIFIED_COST_PLAN: 'VERIFIED_COST_PLAN',
  VERIFIED_LENDER_DOCUMENT: 'VERIFIED_LENDER_DOCUMENT',
  PROFESSIONAL_METHOD_INDICATION: 'PROFESSIONAL_METHOD_INDICATION',
  EXTERNAL_PROFESSIONAL_REPORT: 'EXTERNAL_PROFESSIONAL_REPORT',
  CLIENT_PROVIDED_VERIFIED: 'CLIENT_PROVIDED_VERIFIED',
  PROFESSIONAL_JUDGMENT: 'PROFESSIONAL_JUDGMENT',
  OTHER_VERIFIED: 'OTHER_VERIFIED',
});

const DSCR_NUMERATOR_BASIS = Object.freeze({
  PROFESSIONAL_NOI: 'PROFESSIONAL_NOI',
  UNLEVERED_PROPERTY_CASH_FLOW: 'UNLEVERED_PROPERTY_CASH_FLOW',
});

const GRACE_TYPE = Object.freeze({
  INTEREST_ONLY: 'INTEREST_ONLY',
  CAPITALIZED: 'CAPITALIZED',
});

const INVESTMENT_FINANCING_INPUT_STATUS = Object.freeze({
  READY_FOR_CANONICAL_INVESTMENT_FINANCING_METRICS: 'READY_FOR_CANONICAL_INVESTMENT_FINANCING_METRICS',
  HOLD_DCF: 'HOLD_DCF',
  HOLD_NOI: 'HOLD_NOI',
  HOLD_INVESTMENT_BASIS: 'HOLD_INVESTMENT_BASIS',
  HOLD_RETURN_RATES: 'HOLD_RETURN_RATES',
  HOLD_FINANCING: 'HOLD_FINANCING',
  HOLD_COLLATERAL_VALUE: 'HOLD_COLLATERAL_VALUE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function assertNonEmpty(value, field) { if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`); }
function assertEnum(value, enumeration, field) { if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`); }
function iso(value, field) {
  assertNonEmpty(value, field);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return d.toISOString();
}
function finiteNonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be finite and non-negative`);
}
function finitePositive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be finite and positive`);
}
function finiteRate(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new TypeError(`${field} must be a finite decimal rate between 0 and 1`);
}
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function validSha(value) { return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value); }
function daysBetween(earlier, later) { return Math.floor((Date.parse(later) - Date.parse(earlier)) / 86400000); }
function normalizeEvidenceRefs(values) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !nonEmpty(value))) throw new TypeError('evidenceRefs must be a non-empty array');
  return [...new Set(values.map((value) => value.trim()))];
}
function provenance({ source, rationale, evidenceRefs, asOfDate, preparedByRef, preparedAt, reviewedByRef, reviewedAt, reviewEvidenceRef }) {
  assertEnum(source, ANALYSIS_SOURCE, 'source');
  for (const [field, value] of [['rationale', rationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef]]) assertNonEmpty(value, field);
  const asOfDateIso = iso(asOfDate, 'asOfDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(preparedAtIso) < Date.parse(asOfDateIso)) throw new TypeError('ANALYSIS_INPUT_PREPARATION_BEFORE_AS_OF_DATE');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('ANALYSIS_INPUT_REVIEW_BEFORE_PREPARATION');
  return {
    source,
    rationale: rationale.trim(),
    evidenceRefs: normalizeEvidenceRefs(evidenceRefs),
    asOfDate: asOfDateIso,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
}
function verifyRecordHash(record, hashField) {
  if (!record || !validSha(record[hashField])) return false;
  const payload = { ...record };
  delete payload[hashField];
  return sha256(payload) === record[hashField].toLowerCase();
}

function createInvestmentBasisInput({ basisId, caseId, propertyRef, type, amountSar, ...prov } = {}) {
  for (const [field, value] of [['basisId', basisId], ['caseId', caseId], ['propertyRef', propertyRef]]) assertNonEmpty(value, field);
  assertEnum(type, INVESTMENT_BASIS_TYPE, 'type');
  finitePositive(amountSar, 'amountSar');
  const record = {
    schemaVersion: 1,
    basisId: basisId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    type,
    amountSar,
    ...provenance(prov),
    valuationAmount: false,
    automaticallyDerived: false,
  };
  record.investmentBasisHashSha256 = sha256(record);
  return deepFreeze(record);
}

function createCollateralValueBasisInput({
  valueBasisId,
  caseId,
  propertyRef,
  type,
  amountSar,
  professionalDcfCalculationHashSha256 = null,
  ...prov
} = {}) {
  for (const [field, value] of [['valueBasisId', valueBasisId], ['caseId', caseId], ['propertyRef', propertyRef]]) assertNonEmpty(value, field);
  assertEnum(type, COLLATERAL_VALUE_BASIS_TYPE, 'type');
  finitePositive(amountSar, 'amountSar');
  if (type === COLLATERAL_VALUE_BASIS_TYPE.PROFESSIONAL_DCF_METHOD_INDICATION) {
    if (!validSha(professionalDcfCalculationHashSha256)) throw new TypeError('professionalDcfCalculationHashSha256 is required for PROFESSIONAL_DCF_METHOD_INDICATION');
    if (prov.source !== ANALYSIS_SOURCE.PROFESSIONAL_METHOD_INDICATION) throw new TypeError('PROFESSIONAL_DCF_METHOD_INDICATION_REQUIRES_PROFESSIONAL_METHOD_INDICATION_SOURCE');
  }
  const record = {
    schemaVersion: 1,
    valueBasisId: valueBasisId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    type,
    amountSar,
    professionalDcfCalculationHashSha256: type === COLLATERAL_VALUE_BASIS_TYPE.PROFESSIONAL_DCF_METHOD_INDICATION ? professionalDcfCalculationHashSha256.toLowerCase() : null,
    ...provenance(prov),
    selectedForLtvAnalysis: true,
    creditApprovalEstablished: false,
    certifiedValuationEstablished: false,
    automaticallyDerived: false,
  };
  record.collateralValueBasisHashSha256 = sha256(record);
  return deepFreeze(record);
}

function createReturnAnalysisRateInput({
  rateSetId,
  caseId,
  propertyRef,
  npvDiscountRate,
  mirrFinanceRate,
  mirrReinvestmentRate,
  ...prov
} = {}) {
  for (const [field, value] of [['rateSetId', rateSetId], ['caseId', caseId], ['propertyRef', propertyRef]]) assertNonEmpty(value, field);
  finiteRate(npvDiscountRate, 'npvDiscountRate');
  finiteRate(mirrFinanceRate, 'mirrFinanceRate');
  finiteRate(mirrReinvestmentRate, 'mirrReinvestmentRate');
  const record = {
    schemaVersion: 1,
    rateSetId: rateSetId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    npvDiscountRate,
    mirrFinanceRate,
    mirrReinvestmentRate,
    ...provenance(prov),
    valuationDiscountRateAdoptedAutomatically: false,
    automaticallyDerived: false,
  };
  record.returnAnalysisRateHashSha256 = sha256(record);
  return deepFreeze(record);
}

function createDebtTermsInput({
  debtId,
  caseId,
  propertyRef,
  principalSar,
  annualRate,
  tenorYears,
  gracePeriodMonths = 0,
  graceType = GRACE_TYPE.INTEREST_ONLY,
  balloonPct = 0,
  financingFeesSar = 0,
  financingModelLabel,
  ...prov
} = {}) {
  for (const [field, value] of [['debtId', debtId], ['caseId', caseId], ['propertyRef', propertyRef], ['financingModelLabel', financingModelLabel]]) assertNonEmpty(value, field);
  finitePositive(principalSar, 'principalSar');
  finiteRate(annualRate, 'annualRate');
  finitePositive(tenorYears, 'tenorYears');
  const tenorMonths = Math.round(tenorYears * 12);
  if (tenorMonths < 1) throw new TypeError('tenorYears resolves to less than one month');
  if (!Number.isInteger(gracePeriodMonths) || gracePeriodMonths < 0 || gracePeriodMonths >= tenorMonths) throw new TypeError('gracePeriodMonths must be an integer from 0 to tenorMonths-1');
  assertEnum(graceType, GRACE_TYPE, 'graceType');
  finiteRate(balloonPct, 'balloonPct');
  finiteNonNegative(financingFeesSar, 'financingFeesSar');
  const record = {
    schemaVersion: 1,
    debtId: debtId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    principalSar,
    annualRate,
    tenorYears,
    tenorMonths,
    gracePeriodMonths,
    graceType,
    balloonPct,
    financingFeesSar,
    financingModelLabel: financingModelLabel.trim(),
    ...provenance(prov),
    automaticallySized: false,
    lenderApprovalEstablished: false,
    creditDecisionMade: false,
  };
  record.debtTermsHashSha256 = sha256(record);
  return deepFreeze(record);
}

function verifyInvestmentBasisIntegrity(value) { return verifyRecordHash(value, 'investmentBasisHashSha256'); }
function verifyCollateralValueBasisIntegrity(value) { return verifyRecordHash(value, 'collateralValueBasisHashSha256'); }
function verifyReturnAnalysisRateIntegrity(value) { return verifyRecordHash(value, 'returnAnalysisRateHashSha256'); }
function verifyDebtTermsIntegrity(value) { return verifyRecordHash(value, 'debtTermsHashSha256'); }

function provenanceGate(record, valuationDateIso, packetPreparedAtIso, maximumAgeDays, label) {
  const blockers = [];
  if (!Number.isInteger(maximumAgeDays) || maximumAgeDays < 0) throw new TypeError(`${label} maximumAgeDays must be a non-negative integer`);
  if (Date.parse(record.asOfDate) > Date.parse(valuationDateIso)) blockers.push(`${label}_AS_OF_AFTER_VALUATION_DATE`);
  if (Date.parse(record.reviewedAt) > Date.parse(packetPreparedAtIso)) blockers.push(`${label}_REVIEW_AFTER_PACKET_PREPARATION`);
  const ageDays = daysBetween(record.asOfDate, valuationDateIso);
  if (ageDays < 0 || ageDays > maximumAgeDays) blockers.push(`${label}_STALE:${ageDays}/${maximumAgeDays}`);
  return { blockers, ageDays };
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    valuationDate: context.valuationDate || null,
    status,
    blockers,
    readyForCanonicalInvestmentFinancingMetrics: false,
    professionalDcfCalculationHashSha256: context.professionalDcfCalculationHashSha256 || null,
    professionalNoiCalculationHashSha256: context.professionalNoiCalculationHashSha256 || null,
    financingEnabled: context.financingEnabled ?? null,
    automaticDebtSizing: false,
    creditDecisionMade: false,
    valuationChangedByFinancing: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildInvestmentFinancingMetricsInputPacket({
  packetId,
  caseId,
  propertyRef,
  valuationDate,
  professionalDcfResult,
  professionalNoiResult,
  investmentBasisInput,
  returnAnalysisRateInput,
  financingEnabled,
  debtTermsInput = null,
  collateralValueBasisInput = null,
  dscrNumeratorBasis = null,
  maximumInvestmentBasisAgeDays,
  maximumReturnRateAgeDays,
  maximumDebtTermsAgeDays = null,
  maximumCollateralValueAgeDays = null,
  preparedByRef,
  preparedAt,
  evidenceRef,
} = {}) {
  for (const [field, value] of [['packetId', packetId], ['caseId', caseId], ['propertyRef', propertyRef], ['preparedByRef', preparedByRef], ['evidenceRef', evidenceRef]]) assertNonEmpty(value, field);
  if (typeof financingEnabled !== 'boolean') throw new TypeError('financingEnabled must be boolean');
  const valuationDateIso = iso(valuationDate, 'valuationDate');
  const packetPreparedAtIso = iso(preparedAt, 'preparedAt');
  if (Date.parse(packetPreparedAtIso) < Date.parse(valuationDateIso)) throw new TypeError('INVESTMENT_PACKET_PREPARED_BEFORE_VALUATION_DATE');
  const context = {
    caseId,
    propertyRef,
    valuationDate: valuationDateIso,
    financingEnabled,
    professionalDcfCalculationHashSha256: professionalDcfResult?.calculationHashSha256 || null,
    professionalNoiCalculationHashSha256: professionalNoiResult?.calculationHashSha256 || null,
  };

  if (!professionalDcfResult || professionalDcfResult.caseId !== caseId || professionalDcfResult.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:professionalDcfResult');
  if (!verifyProfessionalDcfResultIntegrity(professionalDcfResult)) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_INTEGRITY, ['PROFESSIONAL_DCF_RESULT_INTEGRITY_FAILED'], context);
  if (iso(professionalDcfResult.valuationDate, 'professionalDcfResult.valuationDate') !== valuationDateIso) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_DCF, ['PROFESSIONAL_DCF_VALUATION_DATE_MISMATCH'], context);

  if (!professionalNoiResult || professionalNoiResult.caseId !== caseId || professionalNoiResult.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:professionalNoiResult');
  if (!verifyProfessionalNoiResultIntegrity(professionalNoiResult)) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_INTEGRITY, ['PROFESSIONAL_NOI_RESULT_INTEGRITY_FAILED'], context);
  if (professionalNoiResult.calculationHashSha256 !== professionalDcfResult.professionalNoiCalculationHashSha256) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_NOI, ['PROFESSIONAL_NOI_DCF_BINDING_MISMATCH'], context);
  if (iso(professionalNoiResult.valuationDate, 'professionalNoiResult.valuationDate') !== valuationDateIso) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_NOI, ['PROFESSIONAL_NOI_VALUATION_DATE_MISMATCH'], context);

  if (!investmentBasisInput || investmentBasisInput.caseId !== caseId || investmentBasisInput.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:investmentBasisInput');
  if (!verifyInvestmentBasisIntegrity(investmentBasisInput)) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_INTEGRITY, ['INVESTMENT_BASIS_INTEGRITY_FAILED'], context);
  const basisGate = provenanceGate(investmentBasisInput, valuationDateIso, packetPreparedAtIso, maximumInvestmentBasisAgeDays, 'INVESTMENT_BASIS');
  if (basisGate.blockers.length) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_INVESTMENT_BASIS, basisGate.blockers, context);

  if (!returnAnalysisRateInput || returnAnalysisRateInput.caseId !== caseId || returnAnalysisRateInput.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:returnAnalysisRateInput');
  if (!verifyReturnAnalysisRateIntegrity(returnAnalysisRateInput)) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_INTEGRITY, ['RETURN_ANALYSIS_RATE_INTEGRITY_FAILED'], context);
  const returnGate = provenanceGate(returnAnalysisRateInput, valuationDateIso, packetPreparedAtIso, maximumReturnRateAgeDays, 'RETURN_ANALYSIS_RATE');
  if (returnGate.blockers.length) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_RETURN_RATES, returnGate.blockers, context);

  const operatingPropertyCashFlows = [];
  const periodBlockers = [];
  [...professionalDcfResult.operatingPresentValueTrace].sort((a, b) => a.periodIndex - b.periodIndex).forEach((period, index) => {
    const expected = index + 1;
    if (!period || period.periodIndex !== expected) periodBlockers.push(`INVESTMENT_PERIOD_INDEX_NOT_CONTIGUOUS:${period?.periodIndex || 'UNKNOWN'}/${expected}`);
    if (![period?.selectedNoiSar, period?.unleveredPropertyCashFlowSar].every(Number.isFinite)) periodBlockers.push(`INVESTMENT_PERIOD_NON_FINITE:${period?.periodId || expected}`);
    if (period) operatingPropertyCashFlows.push({
      periodId: period.periodId,
      periodIndex: period.periodIndex,
      selectedNoiSar: period.selectedNoiSar,
      unleveredPropertyCashFlowSar: period.unleveredPropertyCashFlowSar,
    });
  });
  if (periodBlockers.length) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_DCF, periodBlockers, context);
  if (!Number.isFinite(professionalDcfResult.netTerminalValueSar)) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_DCF, ['NET_TERMINAL_VALUE_NON_FINITE'], context);

  let debtTerms = null;
  let collateralValueBasis = null;
  let debtAgeDays = null;
  let collateralAgeDays = null;
  if (financingEnabled) {
    assertEnum(dscrNumeratorBasis, DSCR_NUMERATOR_BASIS, 'dscrNumeratorBasis');
    if (!debtTermsInput || debtTermsInput.caseId !== caseId || debtTermsInput.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:debtTermsInput');
    if (!verifyDebtTermsIntegrity(debtTermsInput)) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_INTEGRITY, ['DEBT_TERMS_INTEGRITY_FAILED'], context);
    const debtGate = provenanceGate(debtTermsInput, valuationDateIso, packetPreparedAtIso, maximumDebtTermsAgeDays, 'DEBT_TERMS');
    if (debtGate.blockers.length) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_FINANCING, debtGate.blockers, context);
    debtAgeDays = debtGate.ageDays;

    if (!collateralValueBasisInput || collateralValueBasisInput.caseId !== caseId || collateralValueBasisInput.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:collateralValueBasisInput');
    if (!verifyCollateralValueBasisIntegrity(collateralValueBasisInput)) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_INTEGRITY, ['COLLATERAL_VALUE_BASIS_INTEGRITY_FAILED'], context);
    const collateralGate = provenanceGate(collateralValueBasisInput, valuationDateIso, packetPreparedAtIso, maximumCollateralValueAgeDays, 'COLLATERAL_VALUE_BASIS');
    if (collateralGate.blockers.length) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_COLLATERAL_VALUE, collateralGate.blockers, context);
    collateralAgeDays = collateralGate.ageDays;

    if (collateralValueBasisInput.type === COLLATERAL_VALUE_BASIS_TYPE.PROFESSIONAL_DCF_METHOD_INDICATION) {
      if (collateralValueBasisInput.professionalDcfCalculationHashSha256 !== professionalDcfResult.calculationHashSha256) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_COLLATERAL_VALUE, ['DCF_METHOD_INDICATION_HASH_MISMATCH'], context);
      if (collateralValueBasisInput.amountSar !== professionalDcfResult.valueIndicationSar) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_COLLATERAL_VALUE, ['DCF_METHOD_INDICATION_AMOUNT_MISMATCH'], context);
    }
    const explicitUsesSar = investmentBasisInput.amountSar + debtTermsInput.financingFeesSar;
    if (debtTermsInput.principalSar > explicitUsesSar) return hold(INVESTMENT_FINANCING_INPUT_STATUS.HOLD_FINANCING, ['DEBT_PRINCIPAL_EXCEEDS_EXPLICIT_USES'], context);
    debtTerms = debtTermsInput;
    collateralValueBasis = collateralValueBasisInput;
  } else {
    if (debtTermsInput !== null || collateralValueBasisInput !== null || dscrNumeratorBasis !== null) throw new TypeError('FINANCING_DISABLED_REQUIRES_NULL_DEBT_COLLATERAL_AND_DSCR_INPUTS');
  }

  const core = {
    schemaVersion: 1,
    packetId: packetId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: valuationDateIso,
    professionalDcfCalculationHashSha256: professionalDcfResult.calculationHashSha256,
    professionalDcfStatus: professionalDcfResult.status,
    professionalDcfValueIndicationSar: professionalDcfResult.valueIndicationSar,
    professionalNoiCalculationHashSha256: professionalNoiResult.calculationHashSha256,
    stabilizedProfessionalNoiSar: professionalNoiResult.stabilizedNoiSar,
    investmentBasisInput,
    investmentBasisAgeDays: basisGate.ageDays,
    returnAnalysisRateInput,
    returnRateAgeDays: returnGate.ageDays,
    operatingPropertyCashFlows,
    netTerminalValueSar: professionalDcfResult.netTerminalValueSar,
    financingEnabled,
    debtTermsInput: debtTerms,
    debtTermsAgeDays: debtAgeDays,
    collateralValueBasisInput: collateralValueBasis,
    collateralValueAgeDays: collateralAgeDays,
    dscrNumeratorBasis: financingEnabled ? dscrNumeratorBasis : null,
    preparedByRef: preparedByRef.trim(),
    preparedAt: packetPreparedAtIso,
    evidenceRef: evidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    investmentFinancingMetricsInputHashSha256: sha256(core),
    status: INVESTMENT_FINANCING_INPUT_STATUS.READY_FOR_CANONICAL_INVESTMENT_FINANCING_METRICS,
    blockers: [],
    readyForCanonicalInvestmentFinancingMetrics: true,
    professionalValueUsedAsInvestmentBasisAutomatically: false,
    automaticDebtSizing: false,
    lenderApprovalEstablished: false,
    creditDecisionMade: false,
    valuationChangedByFinancing: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet separates professional property valuation from investment and financing analysis. It binds verified DCF/NOI outputs to an explicit investment basis and explicit return assumptions. Financing, when enabled, is based only on explicit reviewed debt terms and an explicit LTV value basis. It does not size debt, approve credit, alter the professional value indication, certify a valuation or authorize a transaction.',
  });
}

function verifyInvestmentFinancingMetricsInputIntegrity(packet) {
  if (!packet || !validSha(packet.investmentFinancingMetricsInputHashSha256)) return false;
  const core = { ...packet };
  [
    'investmentFinancingMetricsInputHashSha256', 'status', 'blockers', 'readyForCanonicalInvestmentFinancingMetrics',
    'professionalValueUsedAsInvestmentBasisAutomatically', 'automaticDebtSizing', 'lenderApprovalEstablished',
    'creditDecisionMade', 'valuationChangedByFinancing', 'finalValuationConclusionEstablished',
    'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.investmentFinancingMetricsInputHashSha256.toLowerCase();
}

module.exports = {
  INVESTMENT_BASIS_TYPE,
  COLLATERAL_VALUE_BASIS_TYPE,
  ANALYSIS_SOURCE,
  DSCR_NUMERATOR_BASIS,
  GRACE_TYPE,
  INVESTMENT_FINANCING_INPUT_STATUS,
  createInvestmentBasisInput,
  createCollateralValueBasisInput,
  createReturnAnalysisRateInput,
  createDebtTermsInput,
  verifyInvestmentBasisIntegrity,
  verifyCollateralValueBasisIntegrity,
  verifyReturnAnalysisRateIntegrity,
  verifyDebtTermsIntegrity,
  buildInvestmentFinancingMetricsInputPacket,
  verifyInvestmentFinancingMetricsInputIntegrity,
};

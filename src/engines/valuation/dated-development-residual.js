'use strict';

const crypto = require('node:crypto');
const {
  calculateDevelopmentResidualLandValue,
  DEVELOPMENT_RESIDUAL_RESULT_STATUS,
} = require('./residual-land-value');

const MODEL_VERSION = 'C55_DATED_DEVELOPMENT_RESIDUAL_V1';
const STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_REVIEW: 'READY_FOR_PROFESSIONAL_REVIEW',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  HOLD: 'HOLD',
});
const RETURN_TREATMENT = Object.freeze({
  EXPLICIT_DEVELOPER_RETURN: 'EXPLICIT_DEVELOPER_RETURN',
  RISK_INCLUDED_IN_DISCOUNT_RATE: 'RISK_INCLUDED_IN_DISCOUNT_RATE',
});
const DISCOUNT_CONVENTION = Object.freeze({
  TIME_VALUE_ONLY: 'TIME_VALUE_ONLY',
  RISK_ADJUSTED_UNLEVERED: 'RISK_ADJUSTED_UNLEVERED',
});
const YEAR_DAYS = 365.2425;
const DAY_MS = 86400000;

function freeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    for (const value of Object.values(obj)) freeze(value);
    Object.freeze(obj);
  }
  return obj;
}
function stable(obj) {
  if (Array.isArray(obj)) return obj.map(stable);
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.keys(obj).sort().map(key => [key, stable(obj[key])]));
}
function hash(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(obj))).digest('hex');
}
function parseUtcDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return date;
}
function plusMonths(base, months) {
  const y = base.getUTCFullYear(), m = base.getUTCMonth(), d = base.getUTCDate();
  const monthStart = new Date(Date.UTC(y, m + months, 1));
  const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(),
    Math.min(d, lastDay), base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds()));
}
function hold(blockers, context = {}) {
  return freeze({
    modelVersion: MODEL_VERSION, status: STATUS.HOLD, blockers,
    residualLandValueSar: null, residualLandValuePerSqm: null,
    finalValuationConclusionEstablished: false, certifiedValuationEstablished: false,
    transactionAuthorized: false, ...context,
  });
}
function addBlocker(blockers, cond, reason) { if (cond) blockers.push(reason); }

/**
 * Independent versioned discounted overlay over the unchanged Wave 11C nominal model.
 * Every inflow and deduction is discounted on its own dated event. No leverage is modeled.
 * The required developer return is deducted OR captured by a risk-adjusted discount rate,
 * but never both.
 */
function calculateDatedDevelopmentResidual(packet, policy) {
  const nominal = calculateDevelopmentResidualLandValue(packet);
  if (![DEVELOPMENT_RESIDUAL_RESULT_STATUS.RESIDUAL_LAND_VALUE_INDICATION_READY,
    DEVELOPMENT_RESIDUAL_RESULT_STATUS.REVIEW_REQUIRED].includes(nominal.status)) {
    return hold(['UPSTREAM_NOMINAL_RESIDUAL_NOT_READY'], { upstreamStatus: nominal.status });
  }
  const blockers = [];
  const valuationDate = parseUtcDate(nominal.valuationDate);
  const startDate = parseUtcDate(nominal.developmentStartDate);
  if (!valuationDate || !startDate) blockers.push('VALUATION_OR_DEVELOPMENT_DATE_INVALID');
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return hold(['EXPLICIT_DISCOUNT_POLICY_REQUIRED'], { nominalResultHashSha256: nominal.calculationHashSha256 });
  }
  const { discountRate, returnTreatment, discountConvention, discountRateEvidence, financingTreatment } = policy;
  addBlocker(blockers, !(typeof discountRate === 'number' && Number.isFinite(discountRate) && discountRate >= 0 && discountRate < 1),
    'DISCOUNT_RATE_INVALID');
  addBlocker(blockers, !Object.values(RETURN_TREATMENT).includes(returnTreatment),
    'DEVELOPER_RETURN_TREATMENT_REQUIRED');
  addBlocker(blockers, !Object.values(DISCOUNT_CONVENTION).includes(discountConvention),
    'DISCOUNT_CONVENTION_REQUIRED');
  addBlocker(blockers, financingTreatment !== 'UNLEVERED_NO_EXPLICIT_FINANCING',
    'UNLEVERED_FINANCING_TREATMENT_REQUIRED');
  addBlocker(blockers, nominal.totalFinanceCostsSar !== 0 || packet.financeCostComponents.length > 0,
    'FINANCE_COSTS_MUST_BE_REMOVED_FROM_UNLEVERED_DCF');
  if (returnTreatment === RETURN_TREATMENT.EXPLICIT_DEVELOPER_RETURN) {
    addBlocker(blockers, discountConvention !== DISCOUNT_CONVENTION.TIME_VALUE_ONLY,
      'DEVELOPER_RETURN_DISCOUNT_RATE_DOUBLE_COUNT');
  }
  if (returnTreatment === RETURN_TREATMENT.RISK_INCLUDED_IN_DISCOUNT_RATE) {
    addBlocker(blockers, discountConvention !== DISCOUNT_CONVENTION.RISK_ADJUSTED_UNLEVERED,
      'DEVELOPER_RETURN_DISCOUNT_RATE_DOUBLE_COUNT');
    addBlocker(blockers, discountRate === 0, 'RISK_ADJUSTED_DISCOUNT_RATE_MUST_BE_POSITIVE');
  }
  if (!discountRateEvidence || typeof discountRateEvidence !== 'object'
    || ['sourceRef', 'methodologyRef', 'reviewedByRef', 'reviewEvidenceRef'].some(k =>
      typeof discountRateEvidence[k] !== 'string' || !discountRateEvidence[k].trim())
    || !parseUtcDate(discountRateEvidence.reviewedAt)) {
    blockers.push('INDEPENDENT_DISCOUNT_RATE_REVIEW_EVIDENCE_REQUIRED');
  }
  if (!Number.isInteger(nominal.terminalMonth) || nominal.terminalMonth < 1) {
    blockers.push('TERMINAL_MONTH_INVALID');
  }
  if (blockers.length) return hold(blockers, { nominalResultHashSha256: nominal.calculationHashSha256 });

  const schedule = [];
  for (const row of nominal.nominalSchedule) {
    if (!Number.isInteger(row.month) || row.month < 0 || row.month > nominal.terminalMonth) {
      blockers.push('SCHEDULE_MONTH_OUT_OF_RANGE');
      break;
    }
    const date = plusMonths(startDate, row.month);
    const elapsedYears = (date.getTime() - valuationDate.getTime()) / (YEAR_DAYS * DAY_MS);
    if (!Number.isFinite(elapsedYears) || elapsedYears < 0) {
      blockers.push('HISTORICAL_OR_INVALID_CASHFLOW_REQUIRES_SEPARATE_TREATMENT');
      break;
    }
    const discountFactor = Math.pow(1 + discountRate, -elapsedYears);
    const developerReturnIncluded = returnTreatment === RETURN_TREATMENT.EXPLICIT_DEVELOPER_RETURN
      ? row.developerReturnSar : 0;
    const grossNetSar = row.gdvInflowsSar - row.developmentCostsSar - row.feesSar
      - developerReturnIncluded;
    const pvSar = grossNetSar * discountFactor;
    if (![grossNetSar, discountFactor, pvSar].every(Number.isFinite)) {
      blockers.push('DISCOUNTED_ARITHMETIC_NOT_FINITE');
      break;
    }
    schedule.push({
      month: row.month, date: date.toISOString(), elapsedYears,
      gdvInflowsSar: row.gdvInflowsSar, developmentCostsSar: row.developmentCostsSar,
      feesSar: row.feesSar, developerReturnDeductedSar: developerReturnIncluded,
      discountFactor, nominalNetSar: grossNetSar, presentValueSar: pvSar,
    });
  }
  if (blockers.length) return hold(blockers, { nominalResultHashSha256: nominal.calculationHashSha256 });
  const discounted = schedule.reduce((sum, row) => sum + row.presentValueSar, 0);
  const areaSqm = nominal.subjectLandAreaSqm;
  if (!Number.isFinite(discounted) || !Number.isFinite(areaSqm) || areaSqm <= 0) {
    return hold(['DISCOUNTED_RESIDUAL_OR_LAND_AREA_INVALID']);
  }
  const reviewFlags = [];
  if (discounted <= 0) reviewFlags.push('NON_POSITIVE_DISCOUNTED_RESIDUAL_REVIEW_REQUIRED');
  const core = {
    modelVersion: MODEL_VERSION,
    caseId: nominal.caseId, propertyRef: nominal.propertyRef,
    valuationDate: nominal.valuationDate, developmentStartDate: nominal.developmentStartDate,
    scenarioId: nominal.developmentScenarioId,
    nominalResultHashSha256: nominal.calculationHashSha256,
    inputPacketHashSha256: nominal.inputPacketHashSha256,
    discountRate, discountConvention, returnTreatment, financingTreatment,
    discountRateEvidence: { ...discountRateEvidence },
    requiredDeveloperReturnSar: nominal.requiredDeveloperReturnSar,
    developerReturnDeducted: returnTreatment === RETURN_TREATMENT.EXPLICIT_DEVELOPER_RETURN,
    subjectLandAreaSqm: areaSqm,
    discountedSchedule: schedule,
    residualLandValueSar: discounted,
    residualLandValuePerSqm: discounted / areaSqm,
  };
  return freeze({
    ...core, resultHashSha256: hash(core),
    status: reviewFlags.length ? STATUS.REVIEW_REQUIRED : STATUS.READY_FOR_PROFESSIONAL_REVIEW,
    blockers: [], reviewFlags,
    discountingApplied: true,
    professionalJudgmentRequired: true,
    sourceAuthenticityIndependentlyVerified: false,
    saudiMarketAccuracyEstablished: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'C55 provides an unlevered dated residual indication with individually discounted receipts, costs and fees. Explicit developer return may be deducted ONLY with time-value discounting; alternatively return is represented by a risk-adjusted discount rate without explicit profit deduction. Financing charges are prohibited to avoid double counting. This is not certified valuation or approval.',
  });
}

module.exports = { MODEL_VERSION, STATUS, RETURN_TREATMENT, DISCOUNT_CONVENTION, calculateDatedDevelopmentResidual };

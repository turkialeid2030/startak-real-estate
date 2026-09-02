'use strict';

const {
  OPERATING_INPUT_STATUS,
  UNIT_OPERATING_STATUS,
  deepFreeze,
  createEvidenceAwareValue,
} = require('./contracts');
const { OPERATING_UNDERWRITING_STATUS, assessOperatingUnderwritingReadiness } = require('./readiness');
const { OPERATING_METRICS_STATUS, calculateOperatingMetrics } = require('./operating-metrics');
const { PROPERTY_COST_STATUS, calculatePropertyCosts } = require('./property-costs');

const INCOME_ANALYSIS_STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  CALCULATED_WITH_ASSUMPTIONS: 'CALCULATED_WITH_ASSUMPTIONS',
  NOT_CALCULABLE: 'NOT_CALCULABLE',
});

const STABILIZED_INCOME_INPUT_TYPE = Object.freeze({
  VACANCY_LOSS_RATE: 'VACANCY_LOSS_RATE',
  CREDIT_LOSS_RATE: 'CREDIT_LOSS_RATE',
  ANNUAL_CONCESSIONS: 'ANNUAL_CONCESSIONS',
  ANNUAL_OTHER_OPERATING_INCOME: 'ANNUAL_OTHER_OPERATING_INCOME',
});

const STABILIZED_INCOME_INPUT_DEFINITION = Object.freeze({
  [STABILIZED_INCOME_INPUT_TYPE.VACANCY_LOSS_RATE]: Object.freeze({
    field: 'income.stabilizedVacancyLossRate',
    unit: 'ratio',
  }),
  [STABILIZED_INCOME_INPUT_TYPE.CREDIT_LOSS_RATE]: Object.freeze({
    field: 'income.stabilizedCreditLossRate',
    unit: 'ratio',
  }),
  [STABILIZED_INCOME_INPUT_TYPE.ANNUAL_CONCESSIONS]: Object.freeze({
    field: 'income.annualConcessions',
    unit: 'SAR/year',
  }),
  [STABILIZED_INCOME_INPUT_TYPE.ANNUAL_OTHER_OPERATING_INCOME]: Object.freeze({
    field: 'income.annualOtherOperatingIncome',
    unit: 'SAR/year',
  }),
});

const MARK_TO_MARKET_CLASS = Object.freeze({
  POSITIVE_REVERSION: 'POSITIVE_REVERSION',
  AT_MARKET: 'AT_MARKET',
  OVER_RENTED: 'OVER_RENTED',
  VACANT_MARKET_OPPORTUNITY: 'VACANT_MARKET_OPPORTUNITY',
  OFFLINE_MARKET_POTENTIAL: 'OFFLINE_MARKET_POTENTIAL',
});

const ADOPTABLE_STATUSES = new Set([
  OPERATING_INPUT_STATUS.VERIFIED_FACT,
  OPERATING_INPUT_STATUS.ASSUMED,
]);

const BLOCKING_READINESS_STATUSES = new Set([
  OPERATING_UNDERWRITING_STATUS.DECISION_BLOCKED,
  OPERATING_UNDERWRITING_STATUS.INSUFFICIENT_EVIDENCE,
]);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function unitAnnualMarketRentField(unitId) {
  return `unit.${requiredString(unitId, 'unitId')}.annualMarketRent`;
}

function createUnitAnnualMarketRentInput({
  unitId,
  value = null,
  sourceRef = null,
  evidenceType,
  effectiveDate = null,
  verificationStatus = OPERATING_INPUT_STATUS.UNVERIFIED,
  confidence = null,
  adoptedForUnderwriting = false,
  adoptionDecisionRef = null,
  assumptionOverride = null,
  lineageRefs = [],
}) {
  return createEvidenceAwareValue({
    field: unitAnnualMarketRentField(unitId),
    value,
    unit: 'SAR/year',
    sourceRef,
    evidenceType,
    effectiveDate,
    verificationStatus,
    confidence,
    adoptedForUnderwriting,
    adoptionDecisionRef,
    assumptionOverride,
    lineageRefs,
  });
}

function createStabilizedIncomeInput({
  type,
  value = null,
  sourceRef = null,
  evidenceType,
  effectiveDate = null,
  verificationStatus = OPERATING_INPUT_STATUS.UNVERIFIED,
  confidence = null,
  adoptedForUnderwriting = false,
  adoptionDecisionRef = null,
  assumptionOverride = null,
  lineageRefs = [],
}) {
  const definition = STABILIZED_INCOME_INPUT_DEFINITION[type];
  if (!definition) throw new TypeError(`type is invalid: ${type}`);
  return createEvidenceAwareValue({
    field: definition.field,
    value,
    unit: definition.unit,
    sourceRef,
    evidenceType,
    effectiveDate,
    verificationStatus,
    confidence,
    adoptedForUnderwriting,
    adoptionDecisionRef,
    assumptionOverride,
    lineageRefs,
  });
}

function addIssue(issues, code, field, refId = null) {
  if (!issues.some((item) => item.code === code && item.field === field && item.refId === refId)) {
    issues.push({ code, field, refId });
  }
}

function adoptedFiniteNumber(input) {
  return Boolean(
    input
    && input.adoptedForUnderwriting === true
    && ADOPTABLE_STATUSES.has(input.verificationStatus)
    && typeof input.value === 'number'
    && Number.isFinite(input.value),
  );
}

function findUniqueInput(operatingCase, field, issues) {
  const matches = operatingCase.additionalOperatingInputs.filter((input) => input.field === field);
  if (matches.length === 0) {
    addIssue(issues, 'ADOPTED_INCOME_INPUT_REQUIRED', field);
    return null;
  }
  if (matches.length > 1) {
    addIssue(issues, 'DUPLICATE_INCOME_INPUT', field);
    return null;
  }
  return matches[0];
}

function validateInput(input, { field, unit, kind, asOfDate }, issues) {
  if (!input) return false;
  if (input.unit !== unit) {
    addIssue(issues, 'INCOME_INPUT_UNIT_MISMATCH', field, input.sourceRef);
    return false;
  }
  if (!adoptedFiniteNumber(input)) {
    addIssue(
      issues,
      input.verificationStatus === OPERATING_INPUT_STATUS.NOT_AVAILABLE
        ? 'INCOME_INPUT_NOT_AVAILABLE'
        : 'ADOPTED_INCOME_INPUT_REQUIRED',
      field,
      input.sourceRef,
    );
    return false;
  }
  if (input.value < 0) {
    addIssue(issues, 'INCOME_INPUT_MUST_BE_NON_NEGATIVE', field, input.sourceRef);
    return false;
  }
  if (kind === 'ratio' && input.value > 1) {
    addIssue(issues, 'INCOME_RATIO_OUT_OF_RANGE', field, input.sourceRef);
    return false;
  }
  if (input.effectiveDate && new Date(input.effectiveDate).getTime() > asOfDate.getTime()) {
    addIssue(issues, 'FUTURE_EFFECTIVE_INCOME_INPUT', field, input.sourceRef);
    return false;
  }
  return true;
}

function emptyResult(operatingCase, issues, readinessStatus) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status: INCOME_ANALYSIS_STATUS.NOT_CALCULABLE,
    readinessStatus,
    issues,
    markToMarket: null,
    stabilizedIncome: null,
    financialCalculationExecuted: false,
    stabilizedNoiCalculated: false,
    valuationCalculated: false,
    acquisitionPriceCalculated: false,
    investmentDecision: null,
    semantics: 'Mark-to-market and stabilized NOI were not calculated because the adopted market-rent, loss, other-income, operating-readiness, or normalized-OPEX gates did not pass.',
  });
}

function classifyRow(row) {
  if (row.operatingStatus === UNIT_OPERATING_STATUS.VACANT) return MARK_TO_MARKET_CLASS.VACANT_MARKET_OPPORTUNITY;
  if (row.operatingStatus === UNIT_OPERATING_STATUS.OFFLINE) return MARK_TO_MARKET_CLASS.OFFLINE_MARKET_POTENTIAL;
  const tolerance = Math.max(1, Math.abs(row.annualMarketRent) * 0.001);
  if (Math.abs(row.headlineAnnualRentDelta) <= tolerance) return MARK_TO_MARKET_CLASS.AT_MARKET;
  return row.headlineAnnualRentDelta > 0
    ? MARK_TO_MARKET_CLASS.POSITIVE_REVERSION
    : MARK_TO_MARKET_CLASS.OVER_RENTED;
}

function calculateIncomeAnalysis(
  operatingCase,
  suppliedOperatingMetrics = null,
  suppliedPropertyCosts = null,
  suppliedReadiness = null,
) {
  if (!operatingCase || operatingCase.contractType !== 'RESIDENTIAL_INCOME_OPERATING_CASE_V1') {
    throw new TypeError('operatingCase must be created by createResidentialIncomeOperatingCase');
  }

  const issues = [];
  const asOfDate = new Date(operatingCase.asOfDate);
  const readiness = suppliedReadiness || assessOperatingUnderwritingReadiness(operatingCase);
  const operatingMetrics = suppliedOperatingMetrics || calculateOperatingMetrics(operatingCase);
  const propertyCosts = suppliedPropertyCosts || calculatePropertyCosts(operatingCase, operatingMetrics);

  if (BLOCKING_READINESS_STATUSES.has(readiness.status)) {
    addIssue(issues, 'OPERATING_READINESS_GATE_NOT_PASSED', 'operatingUnderwritingReadiness');
  }
  if (operatingMetrics.status !== OPERATING_METRICS_STATUS.CALCULATED) {
    addIssue(issues, 'OPERATING_METRICS_REQUIRED', 'operatingMetrics');
  }
  const normalizedAnnualOpex = propertyCosts.operatingExpenses.totalsByBasis.normalizedAnnualOpex;
  if (propertyCosts.operatingExpenses.status === PROPERTY_COST_STATUS.NOT_CALCULABLE || normalizedAnnualOpex === null) {
    addIssue(issues, 'COMPLETE_NORMALIZED_OPEX_REQUIRED', 'operatingExpenses.NORMALIZED');
  }

  const marketRentInputs = new Map();
  const expectedMarketRentFields = new Set(operatingCase.units.map((unit) => unitAnnualMarketRentField(unit.unitId)));
  for (const input of operatingCase.additionalOperatingInputs) {
    if (/^unit\..+\.annualMarketRent$/.test(input.field) && !expectedMarketRentFields.has(input.field)) {
      addIssue(issues, 'MARKET_RENT_UNIT_REFERENCE_MISSING', input.field, input.sourceRef);
    }
  }
  for (const unit of operatingCase.units) {
    const field = unitAnnualMarketRentField(unit.unitId);
    const input = findUniqueInput(operatingCase, field, issues);
    if (validateInput(input, { field, unit: 'SAR/year', kind: 'amount', asOfDate }, issues)) {
      marketRentInputs.set(unit.unitId, input);
    }
  }

  const stabilizedInputs = {};
  for (const [type, definition] of Object.entries(STABILIZED_INCOME_INPUT_DEFINITION)) {
    const input = findUniqueInput(operatingCase, definition.field, issues);
    if (validateInput(input, {
      field: definition.field,
      unit: definition.unit,
      kind: definition.unit === 'ratio' ? 'ratio' : 'amount',
      asOfDate,
    }, issues)) {
      stabilizedInputs[type] = input;
    }
  }

  const vacancy = stabilizedInputs[STABILIZED_INCOME_INPUT_TYPE.VACANCY_LOSS_RATE];
  const credit = stabilizedInputs[STABILIZED_INCOME_INPUT_TYPE.CREDIT_LOSS_RATE];
  if (vacancy && credit && vacancy.value + credit.value > 1) {
    addIssue(issues, 'COMBINED_INCOME_LOSS_RATE_EXCEEDS_ONE', 'income.stabilizedLossRates');
  }
  if (issues.length) return emptyResult(operatingCase, issues, readiness.status);

  const rentRollByUnit = new Map(operatingMetrics.rentRoll.rows.map((row) => [row.unitId, row]));
  const rows = operatingCase.units.map((unit) => {
    const rentRollRow = rentRollByUnit.get(unit.unitId);
    const annualMarketRent = marketRentInputs.get(unit.unitId).value;
    const currentAnnualContractRent = rentRollRow.currentAnnualContractRent;
    const headlineAnnualRentDelta = annualMarketRent - currentAnnualContractRent;
    const row = {
      unitId: unit.unitId,
      buildingId: unit.buildingId,
      operatingStatus: unit.operatingStatus.value,
      rentableAreaSqm: unit.rentableArea.value,
      currentAnnualContractRent,
      annualMarketRent,
      headlineAnnualRentDelta,
      headlineMarkToMarketRatio: currentAnnualContractRent > 0
        ? headlineAnnualRentDelta / currentAnnualContractRent
        : null,
      marketRentSourceRef: marketRentInputs.get(unit.unitId).sourceRef,
    };
    return { ...row, classification: classifyRow(row) };
  });

  const totalAnnualContractRent = rows.reduce((sum, row) => sum + row.currentAnnualContractRent, 0);
  const totalAnnualMarketRent = rows.reduce((sum, row) => sum + row.annualMarketRent, 0);
  const headlineAnnualRentDelta = totalAnnualMarketRent - totalAnnualContractRent;
  const countsByClass = Object.values(MARK_TO_MARKET_CLASS).reduce((result, value) => ({ ...result, [value]: 0 }), {});
  for (const row of rows) countsByClass[row.classification] += 1;

  const vacancyLossRate = vacancy.value;
  const creditLossRate = credit.value;
  const annualConcessions = stabilizedInputs[STABILIZED_INCOME_INPUT_TYPE.ANNUAL_CONCESSIONS].value;
  const annualOtherOperatingIncome = stabilizedInputs[STABILIZED_INCOME_INPUT_TYPE.ANNUAL_OTHER_OPERATING_INCOME].value;
  const vacancyLoss = totalAnnualMarketRent * vacancyLossRate;
  const creditLoss = totalAnnualMarketRent * creditLossRate;
  const effectiveGrossIncome = totalAnnualMarketRent - vacancyLoss - creditLoss - annualConcessions + annualOtherOperatingIncome;
  if (effectiveGrossIncome < 0) {
    addIssue(issues, 'EFFECTIVE_GROSS_INCOME_NEGATIVE', 'income.effectiveGrossIncome');
    return emptyResult(operatingCase, issues, readiness.status);
  }
  const stabilizedNoi = effectiveGrossIncome - normalizedAnnualOpex;
  const assumedInputCount = [...marketRentInputs.values(), ...Object.values(stabilizedInputs)]
    .filter((input) => input.verificationStatus === OPERATING_INPUT_STATUS.ASSUMED).length;
  const status = assumedInputCount > 0
    ? INCOME_ANALYSIS_STATUS.CALCULATED_WITH_ASSUMPTIONS
    : INCOME_ANALYSIS_STATUS.CALCULATED;

  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status,
    readinessStatus: readiness.status,
    issues: [],
    assumedInputCount,
    markToMarket: {
      rows,
      totals: {
        totalAnnualContractRent,
        totalAnnualMarketRent,
        headlineAnnualRentDelta,
        headlineMarkToMarketRatio: totalAnnualContractRent > 0
          ? headlineAnnualRentDelta / totalAnnualContractRent
          : null,
      },
      countsByClass,
      realizableAnnualRentDelta: null,
      realizableMarkToMarketStatus: 'NOT_CALCULABLE_WITHOUT_LEASE_EXPIRY_DOWNTIME_TI_COMMISSION_RENT_FREE_AND_RENEWAL_INPUTS',
    },
    stabilizedIncome: {
      potentialGrossIncome: totalAnnualMarketRent,
      vacancyLossRate,
      vacancyLoss,
      creditLossRate,
      creditLoss,
      annualConcessions,
      annualOtherOperatingIncome,
      effectiveGrossIncome,
      normalizedAnnualOpex,
      stabilizedNoi,
      stabilizedNoiMargin: effectiveGrossIncome > 0 ? stabilizedNoi / effectiveGrossIncome : null,
      excludedFromNoi: ['DEBT_SERVICE', 'DEPRECIATION', 'INCOME_TAX', 'ACQUISITION_COST', 'CAPITAL_IMPROVEMENTS'],
      ratioDenominatorPolicy: 'Vacancy and credit-loss ratios are each applied to potential gross income; concessions are a separate annual amount.',
    },
    financialCalculationExecuted: true,
    stabilizedNoiCalculated: true,
    valuationCalculated: false,
    acquisitionPriceCalculated: false,
    investmentDecision: null,
    semantics: 'Evidence-gated headline mark-to-market and stabilized NOI only. Realizable reversion, value, price, returns, legal conclusions, and investment or transaction decisions are outside this calculation.',
  });
}

module.exports = {
  INCOME_ANALYSIS_STATUS,
  STABILIZED_INCOME_INPUT_TYPE,
  STABILIZED_INCOME_INPUT_DEFINITION,
  MARK_TO_MARKET_CLASS,
  unitAnnualMarketRentField,
  createUnitAnnualMarketRentInput,
  createStabilizedIncomeInput,
  calculateIncomeAnalysis,
};

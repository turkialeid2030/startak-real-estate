'use strict';

const {
  PROPERTY_INTEREST_TYPE,
  OPERATING_INPUT_STATUS,
  deepFreeze,
  createEvidenceAwareValue,
} = require('./contracts');
const { OPERATING_UNDERWRITING_STATUS, assessOperatingUnderwritingReadiness } = require('./readiness');
const { calculateOperatingMetrics } = require('./operating-metrics');
const { calculatePropertyCosts } = require('./property-costs');
const { calculateIncomeAnalysis } = require('./income-analysis');
const { calculateAcquisitionBasis } = require('./acquisition-basis');
const {
  computeIRR,
  buildMonthlyDebtPlan,
  minimumDscr,
} = require('../engines/financial');

const REVERSE_UNDERWRITING_STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  CALCULATED_WITH_ASSUMPTIONS: 'CALCULATED_WITH_ASSUMPTIONS',
  NOT_CALCULABLE: 'NOT_CALCULABLE',
});

const REVERSE_UNDERWRITING_OUTCOME = Object.freeze({
  CURRENT_PRICE_WITHIN_ALL_LIMITS: 'CURRENT_PRICE_WITHIN_ALL_LIMITS',
  CURRENT_PRICE_EXCEEDS_MAXIMUM: 'CURRENT_PRICE_EXCEEDS_MAXIMUM',
  NO_FEASIBLE_PURCHASE_PRICE: 'NO_FEASIBLE_PURCHASE_PRICE',
});

const PRICE_LIMIT_STATUS = Object.freeze({
  SOLVED: 'SOLVED',
  NO_FEASIBLE_PRICE: 'NO_FEASIBLE_PRICE',
  TECHNICAL_BOUND_REACHED: 'TECHNICAL_BOUND_REACHED',
});

const REVERSE_UNDERWRITING_INPUT_TYPE = Object.freeze({
  MIN_UNLEVERED_IRR: 'MIN_UNLEVERED_IRR',
  MIN_EQUITY_MULTIPLE: 'MIN_EQUITY_MULTIPLE',
  MIN_CASH_ON_CASH: 'MIN_CASH_ON_CASH',
  MIN_DSCR: 'MIN_DSCR',
  TARGET_LTV: 'TARGET_LTV',
  MAX_LTV: 'MAX_LTV',
  MAX_EQUITY_COMMITMENT: 'MAX_EQUITY_COMMITMENT',
  MIN_STABILIZED_YIELD: 'MIN_STABILIZED_YIELD',
  HOLD_PERIOD_YEARS: 'HOLD_PERIOD_YEARS',
  ANNUAL_NOI_GROWTH_RATE: 'ANNUAL_NOI_GROWTH_RATE',
  EXIT_CAP_RATE: 'EXIT_CAP_RATE',
  CONTRACTUAL_TERMINAL_VALUE: 'CONTRACTUAL_TERMINAL_VALUE',
  SELLING_COST_RATE: 'SELLING_COST_RATE',
  ANNUAL_DEBT_RATE: 'ANNUAL_DEBT_RATE',
  DEBT_AMORTIZATION_YEARS: 'DEBT_AMORTIZATION_YEARS',
});

const REVERSE_UNDERWRITING_INPUT_DEFINITION = Object.freeze({
  [REVERSE_UNDERWRITING_INPUT_TYPE.MIN_UNLEVERED_IRR]: Object.freeze({ field: 'reverse.minUnleveredIrr', unit: 'ratio', kind: 'positiveRatio' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.MIN_EQUITY_MULTIPLE]: Object.freeze({ field: 'reverse.minEquityMultiple', unit: 'multiple', kind: 'positive' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.MIN_CASH_ON_CASH]: Object.freeze({ field: 'reverse.minCashOnCash', unit: 'ratio', kind: 'nonNegativeRatio' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.MIN_DSCR]: Object.freeze({ field: 'reverse.minDscr', unit: 'ratio', kind: 'positive' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.TARGET_LTV]: Object.freeze({ field: 'reverse.targetLtv', unit: 'ratio', kind: 'openRatio' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.MAX_LTV]: Object.freeze({ field: 'reverse.maxLtv', unit: 'ratio', kind: 'openRatio' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.MAX_EQUITY_COMMITMENT]: Object.freeze({ field: 'reverse.maxEquityCommitment', unit: 'SAR', kind: 'positive' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.MIN_STABILIZED_YIELD]: Object.freeze({ field: 'reverse.minStabilizedYield', unit: 'ratio', kind: 'positiveRatio' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.HOLD_PERIOD_YEARS]: Object.freeze({ field: 'reverse.holdPeriodYears', unit: 'years', kind: 'positiveInteger' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.ANNUAL_NOI_GROWTH_RATE]: Object.freeze({ field: 'reverse.annualNoiGrowthRate', unit: 'ratio', kind: 'growthRate' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.EXIT_CAP_RATE]: Object.freeze({ field: 'reverse.exitCapRate', unit: 'ratio', kind: 'positiveRatio' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.CONTRACTUAL_TERMINAL_VALUE]: Object.freeze({ field: 'reverse.contractualTerminalValue', unit: 'SAR', kind: 'nonNegative' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.SELLING_COST_RATE]: Object.freeze({ field: 'reverse.sellingCostRate', unit: 'ratio', kind: 'closedRatio' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.ANNUAL_DEBT_RATE]: Object.freeze({ field: 'reverse.annualDebtRate', unit: 'ratio', kind: 'closedRatio' }),
  [REVERSE_UNDERWRITING_INPUT_TYPE.DEBT_AMORTIZATION_YEARS]: Object.freeze({ field: 'reverse.debtAmortizationYears', unit: 'years', kind: 'positiveInteger' }),
});

const REQUIRED_COMMON_INPUTS = Object.freeze([
  REVERSE_UNDERWRITING_INPUT_TYPE.MIN_UNLEVERED_IRR,
  REVERSE_UNDERWRITING_INPUT_TYPE.MIN_EQUITY_MULTIPLE,
  REVERSE_UNDERWRITING_INPUT_TYPE.MIN_CASH_ON_CASH,
  REVERSE_UNDERWRITING_INPUT_TYPE.MIN_DSCR,
  REVERSE_UNDERWRITING_INPUT_TYPE.TARGET_LTV,
  REVERSE_UNDERWRITING_INPUT_TYPE.MAX_LTV,
  REVERSE_UNDERWRITING_INPUT_TYPE.MAX_EQUITY_COMMITMENT,
  REVERSE_UNDERWRITING_INPUT_TYPE.MIN_STABILIZED_YIELD,
  REVERSE_UNDERWRITING_INPUT_TYPE.HOLD_PERIOD_YEARS,
  REVERSE_UNDERWRITING_INPUT_TYPE.ANNUAL_NOI_GROWTH_RATE,
  REVERSE_UNDERWRITING_INPUT_TYPE.SELLING_COST_RATE,
  REVERSE_UNDERWRITING_INPUT_TYPE.ANNUAL_DEBT_RATE,
  REVERSE_UNDERWRITING_INPUT_TYPE.DEBT_AMORTIZATION_YEARS,
]);

const ADOPTABLE_STATUSES = new Set([
  OPERATING_INPUT_STATUS.VERIFIED_FACT,
  OPERATING_INPUT_STATUS.ASSUMED,
]);

const BLOCKING_READINESS_STATUSES = new Set([
  OPERATING_UNDERWRITING_STATUS.DECISION_BLOCKED,
  OPERATING_UNDERWRITING_STATUS.INSUFFICIENT_EVIDENCE,
]);

const LIMIT_DEFINITION = Object.freeze([
  Object.freeze({ code: 'MAX_PRICE_BY_STABILIZED_YIELD', metric: 'stabilizedYield', operator: 'GTE', inputType: REVERSE_UNDERWRITING_INPUT_TYPE.MIN_STABILIZED_YIELD }),
  Object.freeze({ code: 'MAX_PRICE_BY_UNLEVERED_IRR', metric: 'unleveredIrr', operator: 'GTE', inputType: REVERSE_UNDERWRITING_INPUT_TYPE.MIN_UNLEVERED_IRR }),
  Object.freeze({ code: 'MAX_PRICE_BY_EQUITY_MULTIPLE', metric: 'equityMultiple', operator: 'GTE', inputType: REVERSE_UNDERWRITING_INPUT_TYPE.MIN_EQUITY_MULTIPLE }),
  Object.freeze({ code: 'MAX_PRICE_BY_CASH_ON_CASH', metric: 'cashOnCash', operator: 'GTE', inputType: REVERSE_UNDERWRITING_INPUT_TYPE.MIN_CASH_ON_CASH }),
  Object.freeze({ code: 'MAX_PRICE_BY_DSCR', metric: 'dscr', operator: 'GTE', inputType: REVERSE_UNDERWRITING_INPUT_TYPE.MIN_DSCR }),
  Object.freeze({ code: 'MAX_PRICE_BY_LTV_AND_EQUITY_CAP', metric: 'minimumEquityAtMaxLtv', operator: 'LTE', inputType: REVERSE_UNDERWRITING_INPUT_TYPE.MAX_EQUITY_COMMITMENT }),
]);

function createReverseUnderwritingInput({
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
  const definition = REVERSE_UNDERWRITING_INPUT_DEFINITION[type];
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

function validateValue(value, kind) {
  if (kind === 'positive') return value > 0;
  if (kind === 'nonNegative') return value >= 0;
  if (kind === 'positiveInteger') return Number.isInteger(value) && value > 0 && value <= 100;
  if (kind === 'positiveRatio') return value > 0 && value <= 1;
  if (kind === 'nonNegativeRatio') return value >= 0 && value <= 1;
  if (kind === 'openRatio') return value > 0 && value < 1;
  if (kind === 'closedRatio') return value >= 0 && value <= 1;
  if (kind === 'growthRate') return value > -1 && value <= 1;
  return false;
}

function findAndValidateInput(operatingCase, type, asOfDate, issues) {
  const definition = REVERSE_UNDERWRITING_INPUT_DEFINITION[type];
  const matches = operatingCase.additionalOperatingInputs.filter((input) => input.field === definition.field);
  if (matches.length === 0) {
    addIssue(issues, 'ADOPTED_REVERSE_UNDERWRITING_INPUT_REQUIRED', definition.field);
    return null;
  }
  if (matches.length > 1) {
    addIssue(issues, 'DUPLICATE_REVERSE_UNDERWRITING_INPUT', definition.field);
    return null;
  }
  const input = matches[0];
  if (input.unit !== definition.unit) {
    addIssue(issues, 'REVERSE_UNDERWRITING_INPUT_UNIT_MISMATCH', definition.field, input.sourceRef);
    return null;
  }
  if (!adoptedFiniteNumber(input)) {
    addIssue(
      issues,
      input.verificationStatus === OPERATING_INPUT_STATUS.NOT_AVAILABLE
        ? 'REVERSE_UNDERWRITING_INPUT_NOT_AVAILABLE'
        : 'ADOPTED_REVERSE_UNDERWRITING_INPUT_REQUIRED',
      definition.field,
      input.sourceRef,
    );
    return null;
  }
  if (!validateValue(input.value, definition.kind)) {
    addIssue(issues, 'REVERSE_UNDERWRITING_INPUT_OUT_OF_RANGE', definition.field, input.sourceRef);
    return null;
  }
  if (input.effectiveDate && new Date(input.effectiveDate).getTime() > asOfDate.getTime()) {
    addIssue(issues, 'FUTURE_EFFECTIVE_REVERSE_UNDERWRITING_INPUT', definition.field, input.sourceRef);
    return null;
  }
  return input;
}

function emptyResult(operatingCase, issues, readinessStatus) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status: REVERSE_UNDERWRITING_STATUS.NOT_CALCULABLE,
    readinessStatus,
    outcome: null,
    issues,
    policy: null,
    currentPriceAnalysis: null,
    priceLimits: null,
    maximumJustifiedPurchasePrice: null,
    bindingConstraint: null,
    reverseUnderwritingCalculated: false,
    acquisitionPriceCalculated: false,
    valuationCalculated: false,
    investmentDecision: null,
    transactionAuthorized: false,
    semantics: 'Reverse underwriting was not calculated because adopted policy, income, acquisition-basis, tenure, or operating-readiness gates did not pass.',
  });
}

function yearsBetween(start, end) {
  return (end.getTime() - start.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
}

function annualNoiSequence(stabilizedNoi, growthRate, holdPeriodYears) {
  return Array.from({ length: holdPeriodYears }, (_, index) => stabilizedNoi * ((1 + growthRate) ** index));
}

function remainingBalanceAtHold(plan, holdPeriodYears) {
  const row = plan.annualSchedule.find((item) => item.year === holdPeriodYears);
  if (row) return row.balance;
  const final = plan.annualSchedule[plan.annualSchedule.length - 1];
  return final && holdPeriodYears < final.year ? final.balance : 0;
}

function calculateTerminalValue({
  interestType,
  contractualTerminalValue,
  stabilizedNoi,
  growthRate,
  holdPeriodYears,
  exitCapRate,
  sellingCostRate,
}) {
  const gross = interestType === PROPERTY_INTEREST_TYPE.FREEHOLD
    ? (stabilizedNoi * ((1 + growthRate) ** holdPeriodYears)) / exitCapRate
    : contractualTerminalValue;
  return {
    gross,
    sellingCosts: gross * sellingCostRate,
    net: gross * (1 - sellingCostRate),
    basis: interestType === PROPERTY_INTEREST_TYPE.FREEHOLD
      ? 'FORWARD_NOI_CAPITALIZATION'
      : 'ADOPTED_CONTRACTUAL_TERMINAL_VALUE',
  };
}

function evaluatePurchasePrice(price, context) {
  const allInBasis = price + context.nonPriceBasis;
  const initialDebt = allInBasis * context.targetLtv;
  const initialEquity = allInBasis - initialDebt;
  const debtPlan = buildMonthlyDebtPlan(initialDebt, context.annualDebtRate, context.debtAmortizationYears);
  const annualDebtService = context.annualNoi.map((_, index) => debtPlan.annualDebtService[index] || 0);
  const dscr = minimumDscr(context.annualNoi, annualDebtService);
  const remainingDebt = remainingBalanceAtHold(debtPlan, context.holdPeriodYears);
  const unleveredCashflows = [-allInBasis, ...context.annualNoi];
  unleveredCashflows[unleveredCashflows.length - 1] += context.terminalValue.net;
  const equityCashflows = [-initialEquity];
  for (let index = 0; index < context.annualNoi.length; index += 1) {
    let cashflow = context.annualNoi[index] - annualDebtService[index];
    if (index === context.annualNoi.length - 1) cashflow += context.terminalValue.net - remainingDebt;
    equityCashflows.push(cashflow);
  }
  const positiveDistributions = equityCashflows.slice(1).reduce((sum, value) => sum + Math.max(0, value), 0);
  const additionalEquityContributions = equityCashflows.slice(1).reduce((sum, value) => sum + Math.max(0, -value), 0);
  const totalEquityContributions = initialEquity + additionalEquityContributions;
  const rawUnleveredIrr = computeIRR(unleveredCashflows);
  return {
    purchasePrice: price,
    allInBasis,
    initialDebt,
    initialEquity,
    minimumEquityAtMaxLtv: allInBasis * (1 - context.maxLtv),
    actualLtv: allInBasis > 0 ? initialDebt / allInBasis : null,
    stabilizedYield: allInBasis > 0 ? context.stabilizedNoi / allInBasis : null,
    unleveredIrr: Number.isFinite(rawUnleveredIrr) ? rawUnleveredIrr : Number.NEGATIVE_INFINITY,
    equityMultiple: totalEquityContributions > 0 ? positiveDistributions / totalEquityContributions : null,
    cashOnCash: initialEquity > 0 ? (context.annualNoi[0] - annualDebtService[0]) / initialEquity : null,
    dscr,
    remainingDebtAtExit: remainingDebt,
    annualDebtService,
    unleveredCashflows,
    equityCashflows,
  };
}

function metricPasses(evaluation, definition, threshold) {
  const actual = evaluation[definition.metric];
  if (!Number.isFinite(actual)) return false;
  return definition.operator === 'GTE' ? actual >= threshold : actual <= threshold;
}

function solvePriceLimit(context, definition, threshold, currentPrice, tolerance = 1) {
  const evaluate = (price) => evaluatePurchasePrice(price, context);
  const atZero = evaluate(0);
  if (!metricPasses(atZero, definition, threshold)) {
    return {
      code: definition.code,
      metric: definition.metric,
      operator: definition.operator,
      threshold,
      status: PRICE_LIMIT_STATUS.NO_FEASIBLE_PRICE,
      maximumPurchasePrice: 0,
      actualAtMaximum: atZero[definition.metric],
    };
  }

  let lo = 0;
  let hi = Math.max(1, currentPrice, context.stabilizedNoi);
  const technicalCeiling = 1e15;
  while (metricPasses(evaluate(hi), definition, threshold) && hi < technicalCeiling) hi *= 2;
  if (hi >= technicalCeiling && metricPasses(evaluate(technicalCeiling), definition, threshold)) {
    return {
      code: definition.code,
      metric: definition.metric,
      operator: definition.operator,
      threshold,
      status: PRICE_LIMIT_STATUS.TECHNICAL_BOUND_REACHED,
      maximumPurchasePrice: null,
      actualAtMaximum: null,
    };
  }

  let iterations = 0;
  while ((hi - lo) > tolerance && iterations < 100) {
    const mid = (lo + hi) / 2;
    if (metricPasses(evaluate(mid), definition, threshold)) lo = mid;
    else hi = mid;
    iterations += 1;
  }
  const atMaximum = evaluate(lo);
  const aboveMaximum = evaluate(hi);
  return {
    code: definition.code,
    metric: definition.metric,
    operator: definition.operator,
    threshold,
    status: PRICE_LIMIT_STATUS.SOLVED,
    maximumPurchasePrice: lo,
    firstKnownInfeasiblePrice: hi,
    actualAtMaximum: atMaximum[definition.metric],
    actualAboveMaximum: aboveMaximum[definition.metric],
    tolerance,
    iterations,
  };
}

function calculateReverseUnderwriting(
  operatingCase,
  suppliedIncomeAnalysis = null,
  suppliedAcquisitionBasis = null,
  suppliedReadiness = null,
) {
  if (!operatingCase || operatingCase.contractType !== 'RESIDENTIAL_INCOME_OPERATING_CASE_V1') {
    throw new TypeError('operatingCase must be created by createResidentialIncomeOperatingCase');
  }

  const issues = [];
  const asOfDate = new Date(operatingCase.asOfDate);
  const readiness = suppliedReadiness || assessOperatingUnderwritingReadiness(operatingCase);
  const operatingMetrics = calculateOperatingMetrics(operatingCase);
  const propertyCosts = calculatePropertyCosts(operatingCase, operatingMetrics);
  const incomeAnalysis = suppliedIncomeAnalysis || calculateIncomeAnalysis(operatingCase, operatingMetrics, propertyCosts, readiness);
  const acquisitionBasis = suppliedAcquisitionBasis || calculateAcquisitionBasis(operatingCase, propertyCosts, readiness);

  if (BLOCKING_READINESS_STATUSES.has(readiness.status)) {
    addIssue(issues, 'OPERATING_READINESS_GATE_NOT_PASSED', 'operatingUnderwritingReadiness');
  }
  if (!incomeAnalysis.stabilizedNoiCalculated || !incomeAnalysis.stabilizedIncome || incomeAnalysis.stabilizedIncome.stabilizedNoi <= 0) {
    addIssue(issues, 'POSITIVE_STABILIZED_NOI_REQUIRED', 'incomeAnalysis.stabilizedIncome.stabilizedNoi');
  }
  if (!acquisitionBasis.acquisitionBasisCalculated || !acquisitionBasis.bases || !acquisitionBasis.components) {
    addIssue(issues, 'ACQUISITION_BASIS_REQUIRED', 'acquisitionBasis');
  }

  const interest = operatingCase.propertyInterest;
  if (!interest) addIssue(issues, 'PROPERTY_INTEREST_REQUIRED', 'propertyInterest');

  const requiredTypes = [...REQUIRED_COMMON_INPUTS];
  if (interest && interest.interestType === PROPERTY_INTEREST_TYPE.FREEHOLD) {
    requiredTypes.push(REVERSE_UNDERWRITING_INPUT_TYPE.EXIT_CAP_RATE);
  } else {
    requiredTypes.push(REVERSE_UNDERWRITING_INPUT_TYPE.CONTRACTUAL_TERMINAL_VALUE);
  }
  const inputs = {};
  for (const type of requiredTypes) {
    const input = findAndValidateInput(operatingCase, type, asOfDate, issues);
    if (input) inputs[type] = input;
  }
  if (issues.length) return emptyResult(operatingCase, issues, readiness.status);

  const value = (type) => inputs[type].value;
  const targetLtv = value(REVERSE_UNDERWRITING_INPUT_TYPE.TARGET_LTV);
  const maxLtv = value(REVERSE_UNDERWRITING_INPUT_TYPE.MAX_LTV);
  if (targetLtv > maxLtv) {
    addIssue(issues, 'TARGET_LTV_EXCEEDS_MAX_LTV_POLICY', 'reverse.targetLtv', inputs[REVERSE_UNDERWRITING_INPUT_TYPE.TARGET_LTV].sourceRef);
  }
  const holdPeriodYears = value(REVERSE_UNDERWRITING_INPUT_TYPE.HOLD_PERIOD_YEARS);
  if (interest.isTimeLimited) {
    if (!interest.expiryDate) {
      addIssue(issues, 'TIME_LIMITED_INTEREST_EXPIRY_REQUIRED', 'propertyInterest.expiryDate');
    } else if (holdPeriodYears > yearsBetween(asOfDate, new Date(interest.expiryDate)) + 1e-9) {
      addIssue(issues, 'HOLD_PERIOD_EXCEEDS_PROPERTY_INTEREST_TERM', 'reverse.holdPeriodYears', interest.interestEvidenceRef);
    }
  }
  if (issues.length) return emptyResult(operatingCase, issues, readiness.status);

  const stabilizedNoi = incomeAnalysis.stabilizedIncome.stabilizedNoi;
  const growthRate = value(REVERSE_UNDERWRITING_INPUT_TYPE.ANNUAL_NOI_GROWTH_RATE);
  const contractualTerminalValue = interest.interestType === PROPERTY_INTEREST_TYPE.FREEHOLD
    ? null
    : value(REVERSE_UNDERWRITING_INPUT_TYPE.CONTRACTUAL_TERMINAL_VALUE);
  const exitCapRate = interest.interestType === PROPERTY_INTEREST_TYPE.FREEHOLD
    ? value(REVERSE_UNDERWRITING_INPUT_TYPE.EXIT_CAP_RATE)
    : null;
  const terminalValue = calculateTerminalValue({
    interestType: interest.interestType,
    contractualTerminalValue,
    stabilizedNoi,
    growthRate,
    holdPeriodYears,
    exitCapRate,
    sellingCostRate: value(REVERSE_UNDERWRITING_INPUT_TYPE.SELLING_COST_RATE),
  });
  const context = {
    stabilizedNoi,
    nonPriceBasis: acquisitionBasis.components.nonPriceBasis,
    targetLtv,
    maxLtv,
    holdPeriodYears,
    annualNoi: annualNoiSequence(stabilizedNoi, growthRate, holdPeriodYears),
    annualDebtRate: value(REVERSE_UNDERWRITING_INPUT_TYPE.ANNUAL_DEBT_RATE),
    debtAmortizationYears: value(REVERSE_UNDERWRITING_INPUT_TYPE.DEBT_AMORTIZATION_YEARS),
    terminalValue,
  };
  const currentPurchasePrice = acquisitionBasis.components.purchasePrice;
  const currentEvaluation = evaluatePurchasePrice(currentPurchasePrice, context);
  const limits = LIMIT_DEFINITION.map((definition) => {
    const policyInput = inputs[definition.inputType];
    return {
      ...solvePriceLimit(context, definition, policyInput.value, currentPurchasePrice),
      policyInputField: policyInput.field,
      policySourceRef: policyInput.sourceRef,
      policyAdoptionDecisionRef: policyInput.adoptionDecisionRef,
    };
  });
  if (limits.some((limit) => limit.status === PRICE_LIMIT_STATUS.TECHNICAL_BOUND_REACHED)) {
    addIssue(issues, 'REVERSE_UNDERWRITING_TECHNICAL_BOUND_REACHED', 'reverse.priceSolver');
    return emptyResult(operatingCase, issues, readiness.status);
  }
  const bindingConstraint = [...limits].sort((a, b) => a.maximumPurchasePrice - b.maximumPurchasePrice)[0];
  const maximumJustifiedPurchasePrice = bindingConstraint.maximumPurchasePrice;
  const outcome = maximumJustifiedPurchasePrice <= 0
    ? REVERSE_UNDERWRITING_OUTCOME.NO_FEASIBLE_PURCHASE_PRICE
    : currentPurchasePrice <= maximumJustifiedPurchasePrice + 1
      ? REVERSE_UNDERWRITING_OUTCOME.CURRENT_PRICE_WITHIN_ALL_LIMITS
      : REVERSE_UNDERWRITING_OUTCOME.CURRENT_PRICE_EXCEEDS_MAXIMUM;
  const currentConstraintEvaluations = LIMIT_DEFINITION.map((definition) => {
    const threshold = value(definition.inputType);
    const actual = currentEvaluation[definition.metric];
    return {
      code: definition.code,
      metric: definition.metric,
      operator: definition.operator,
      threshold,
      actual: Number.isFinite(actual) ? actual : null,
      passed: metricPasses(currentEvaluation, definition, threshold),
    };
  });
  const assumedInputCount = Object.values(inputs)
    .filter((input) => input.verificationStatus === OPERATING_INPUT_STATUS.ASSUMED).length;
  const status = assumedInputCount > 0
    ? REVERSE_UNDERWRITING_STATUS.CALCULATED_WITH_ASSUMPTIONS
    : REVERSE_UNDERWRITING_STATUS.CALCULATED;

  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status,
    readinessStatus: readiness.status,
    outcome,
    issues: [],
    assumedInputCount,
    policy: {
      minUnleveredIrr: value(REVERSE_UNDERWRITING_INPUT_TYPE.MIN_UNLEVERED_IRR),
      minEquityMultiple: value(REVERSE_UNDERWRITING_INPUT_TYPE.MIN_EQUITY_MULTIPLE),
      minCashOnCash: value(REVERSE_UNDERWRITING_INPUT_TYPE.MIN_CASH_ON_CASH),
      minDscr: value(REVERSE_UNDERWRITING_INPUT_TYPE.MIN_DSCR),
      targetLtv,
      maxLtv,
      maxEquityCommitment: value(REVERSE_UNDERWRITING_INPUT_TYPE.MAX_EQUITY_COMMITMENT),
      minStabilizedYield: value(REVERSE_UNDERWRITING_INPUT_TYPE.MIN_STABILIZED_YIELD),
      holdPeriodYears,
      annualNoiGrowthRate: growthRate,
      exitCapRate,
      contractualTerminalValue,
      sellingCostRate: value(REVERSE_UNDERWRITING_INPUT_TYPE.SELLING_COST_RATE),
      annualDebtRate: value(REVERSE_UNDERWRITING_INPUT_TYPE.ANNUAL_DEBT_RATE),
      debtAmortizationYears: value(REVERSE_UNDERWRITING_INPUT_TYPE.DEBT_AMORTIZATION_YEARS),
      inputLineageRefs: [...new Set(Object.values(inputs).flatMap((input) => input.lineageRefs))],
    },
    terminalValue,
    currentPriceAnalysis: {
      purchasePrice: currentPurchasePrice,
      maximumJustifiedPurchasePrice,
      priceHeadroom: maximumJustifiedPurchasePrice - currentPurchasePrice,
      priceHeadroomRatio: currentPurchasePrice > 0
        ? (maximumJustifiedPurchasePrice - currentPurchasePrice) / currentPurchasePrice
        : null,
      metrics: currentEvaluation,
      constraintEvaluations: currentConstraintEvaluations,
      allConstraintsPassed: currentConstraintEvaluations.every((item) => item.passed),
    },
    priceLimits: limits,
    maximumJustifiedPurchasePrice,
    bindingConstraint,
    reverseUnderwritingCalculated: true,
    acquisitionPriceCalculated: true,
    valuationCalculated: false,
    investmentDecision: null,
    transactionAuthorized: false,
    semantics: 'Evidence-gated analytical maximum purchase price under explicit human-adopted policy constraints. It is not a certified valuation, financing approval, legal opinion, investment recommendation, or transaction authorization.',
  });
}

module.exports = {
  REVERSE_UNDERWRITING_STATUS,
  REVERSE_UNDERWRITING_OUTCOME,
  PRICE_LIMIT_STATUS,
  REVERSE_UNDERWRITING_INPUT_TYPE,
  REVERSE_UNDERWRITING_INPUT_DEFINITION,
  createReverseUnderwritingInput,
  calculateReverseUnderwriting,
};

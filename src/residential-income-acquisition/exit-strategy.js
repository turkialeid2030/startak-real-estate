'use strict';

const {
  PROPERTY_INTEREST_TYPE,
  OPERATING_INPUT_STATUS,
  EXIT_STRATEGY_TYPE,
  EXIT_STRATEGY_INPUT_TYPE,
  EXIT_STRATEGY_INPUT_DEFINITION,
  deepFreeze,
} = require('./contracts');
const { OPERATING_UNDERWRITING_STATUS, assessOperatingUnderwritingReadiness } = require('./readiness');
const { calculateOperatingMetrics } = require('./operating-metrics');
const { calculatePropertyCosts } = require('./property-costs');
const { calculateIncomeAnalysis } = require('./income-analysis');
const { calculateAcquisitionBasis } = require('./acquisition-basis');
const { computeIRR } = require('../engines/financial');

const EXIT_STRATEGY_COMPARISON_STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  CALCULATED_WITH_ASSUMPTIONS: 'CALCULATED_WITH_ASSUMPTIONS',
  NOT_CALCULABLE: 'NOT_CALCULABLE',
});

const REQUIRED_COMMON_INPUTS = Object.freeze([
  EXIT_STRATEGY_INPUT_TYPE.HOLD_PERIOD_YEARS,
  EXIT_STRATEGY_INPUT_TYPE.STRATEGY_CAPEX,
  EXIT_STRATEGY_INPUT_TYPE.EXECUTION_PERIOD_YEARS,
  EXIT_STRATEGY_INPUT_TYPE.YEAR_ONE_NOI_RETENTION_RATE,
  EXIT_STRATEGY_INPUT_TYPE.STABILIZED_NOI_DELTA,
  EXIT_STRATEGY_INPUT_TYPE.ANNUAL_NOI_GROWTH_RATE,
  EXIT_STRATEGY_INPUT_TYPE.ANNUAL_HOLDING_COST,
  EXIT_STRATEGY_INPUT_TYPE.SELLING_COST_RATE,
  EXIT_STRATEGY_INPUT_TYPE.DISCOUNT_RATE,
]);

const ADOPTABLE_STATUSES = new Set([
  OPERATING_INPUT_STATUS.VERIFIED_FACT,
  OPERATING_INPUT_STATUS.ASSUMED,
]);

const BLOCKING_READINESS_STATUSES = new Set([
  OPERATING_UNDERWRITING_STATUS.DECISION_BLOCKED,
  OPERATING_UNDERWRITING_STATUS.INSUFFICIENT_EVIDENCE,
]);

const PASSIVE_STRATEGIES = new Set([
  EXIT_STRATEGY_TYPE.HOLD_AS_IS,
  EXIT_STRATEGY_TYPE.SELL_AS_IS,
  EXIT_STRATEGY_TYPE.HOLD_TO_INTEREST_EXPIRY,
]);

function addIssue(issues, code, field, refId = null, scenarioId = null) {
  if (!issues.some((item) => item.code === code && item.field === field && item.refId === refId && item.scenarioId === scenarioId)) {
    issues.push({ code, field, refId, scenarioId });
  }
}

function fieldFor(scenarioId, type) {
  return `exit.${scenarioId}.${EXIT_STRATEGY_INPUT_DEFINITION[type].key}`;
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

function validateValue(value, type) {
  if (type === EXIT_STRATEGY_INPUT_TYPE.HOLD_PERIOD_YEARS) return Number.isInteger(value) && value > 0 && value <= 50;
  if (type === EXIT_STRATEGY_INPUT_TYPE.EXECUTION_PERIOD_YEARS) return Number.isInteger(value) && value >= 0 && value <= 50;
  if ([EXIT_STRATEGY_INPUT_TYPE.STRATEGY_CAPEX, EXIT_STRATEGY_INPUT_TYPE.ANNUAL_HOLDING_COST, EXIT_STRATEGY_INPUT_TYPE.CONTRACTUAL_TERMINAL_VALUE].includes(type)) return value >= 0;
  if ([EXIT_STRATEGY_INPUT_TYPE.YEAR_ONE_NOI_RETENTION_RATE, EXIT_STRATEGY_INPUT_TYPE.SELLING_COST_RATE].includes(type)) return value >= 0 && value <= 1;
  if ([EXIT_STRATEGY_INPUT_TYPE.EXIT_CAP_RATE, EXIT_STRATEGY_INPUT_TYPE.DISCOUNT_RATE].includes(type)) return value > 0 && value <= 1;
  if (type === EXIT_STRATEGY_INPUT_TYPE.ANNUAL_NOI_GROWTH_RATE) return value > -1 && value <= 1;
  if (type === EXIT_STRATEGY_INPUT_TYPE.STABILIZED_NOI_DELTA) return Number.isFinite(value);
  return false;
}

function findAndValidateInput(scenario, type, asOfDate, issues) {
  const definition = EXIT_STRATEGY_INPUT_DEFINITION[type];
  const input = scenario.inputs[definition.key];
  const expectedField = fieldFor(scenario.scenarioId, type);
  if (!input) {
    addIssue(issues, 'ADOPTED_EXIT_STRATEGY_INPUT_REQUIRED', expectedField, null, scenario.scenarioId);
    return null;
  }
  if (input.field !== expectedField) {
    addIssue(issues, 'EXIT_STRATEGY_INPUT_FIELD_MISMATCH', expectedField, input.sourceRef, scenario.scenarioId);
    return null;
  }
  if (input.unit !== definition.unit) {
    addIssue(issues, 'EXIT_STRATEGY_INPUT_UNIT_MISMATCH', expectedField, input.sourceRef, scenario.scenarioId);
    return null;
  }
  if (!adoptedFiniteNumber(input)) {
    addIssue(
      issues,
      input.verificationStatus === OPERATING_INPUT_STATUS.NOT_AVAILABLE
        ? 'EXIT_STRATEGY_INPUT_NOT_AVAILABLE'
        : 'ADOPTED_EXIT_STRATEGY_INPUT_REQUIRED',
      expectedField,
      input.sourceRef,
      scenario.scenarioId,
    );
    return null;
  }
  if (!validateValue(input.value, type)) {
    addIssue(issues, 'EXIT_STRATEGY_INPUT_OUT_OF_RANGE', expectedField, input.sourceRef, scenario.scenarioId);
    return null;
  }
  if (input.effectiveDate && new Date(input.effectiveDate).getTime() > asOfDate.getTime()) {
    addIssue(issues, 'FUTURE_EFFECTIVE_EXIT_STRATEGY_INPUT', expectedField, input.sourceRef, scenario.scenarioId);
    return null;
  }
  return input;
}

function yearsBetween(start, end) {
  return (end.getTime() - start.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
}

function emptyResult(operatingCase, issues, readinessStatus) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status: EXIT_STRATEGY_COMPARISON_STATUS.NOT_CALCULABLE,
    readinessStatus,
    issues,
    benchmarkScenarioId: null,
    scenarioResults: null,
    ranking: null,
    highestModeledNpvScenario: null,
    exitStrategyComparisonCalculated: false,
    financialCalculationExecuted: false,
    valuationCalculated: false,
    recommendedStrategy: null,
    investmentDecision: null,
    transactionAuthorized: false,
    semantics: 'Exit-strategy comparison was not calculated because evidence, operating readiness, acquisition basis, scenario comparability, or property-interest gates did not pass.',
  });
}

function calculateNpv(cashflows, discountRate) {
  return cashflows.reduce((sum, cashflow, year) => sum + (cashflow / ((1 + discountRate) ** year)), 0);
}

function calculatePaybackYear(cashflows) {
  let cumulative = cashflows[0];
  if (cumulative >= 0) return 0;
  for (let year = 1; year < cashflows.length; year += 1) {
    const prior = cumulative;
    cumulative += cashflows[year];
    if (cumulative >= 0) {
      const recoveredWithinYear = cashflows[year] > 0 ? (-prior / cashflows[year]) : 1;
      return (year - 1) + recoveredWithinYear;
    }
  }
  return null;
}

function annualNoiSequence(baseNoi, inputs) {
  const holdPeriodYears = inputs.holdPeriodYears.value;
  const executionPeriodYears = inputs.executionPeriodYears.value;
  const targetNoi = baseNoi + inputs.stabilizedNoiDelta.value;
  const growthRate = inputs.annualNoiGrowthRate.value;
  return Array.from({ length: holdPeriodYears }, (_, index) => {
    const year = index + 1;
    const progress = executionPeriodYears === 0 ? 1 : Math.min(year / executionPeriodYears, 1);
    const preGrowthNoi = baseNoi + (inputs.stabilizedNoiDelta.value * progress);
    const retention = year === 1 ? inputs.yearOneNoiRetentionRate.value : 1;
    return (preGrowthNoi * ((1 + growthRate) ** index) * retention) - inputs.annualHoldingCost.value;
  });
}

function terminalValue(interestType, targetNoi, inputs) {
  const holdPeriodYears = inputs.holdPeriodYears.value;
  const forwardNoi = targetNoi * ((1 + inputs.annualNoiGrowthRate.value) ** holdPeriodYears);
  const gross = interestType === PROPERTY_INTEREST_TYPE.FREEHOLD
    ? forwardNoi / inputs.exitCapRate.value
    : inputs.contractualTerminalValue.value;
  const sellingCosts = gross * inputs.sellingCostRate.value;
  return {
    gross,
    sellingCosts,
    net: gross - sellingCosts,
    forwardNoi: interestType === PROPERTY_INTEREST_TYPE.FREEHOLD ? forwardNoi : null,
    basis: interestType === PROPERTY_INTEREST_TYPE.FREEHOLD
      ? 'FORWARD_NOI_CAPITALIZATION'
      : 'ADOPTED_CONTRACTUAL_TERMINAL_VALUE',
  };
}

function projectInputLineage(inputs) {
  return Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, {
    field: input.field,
    value: input.value,
    unit: input.unit,
    sourceRef: input.sourceRef,
    verificationStatus: input.verificationStatus,
    effectiveDate: input.effectiveDate,
    adoptionDecisionRef: input.adoptionDecisionRef,
    lineageRefs: input.lineageRefs,
  }]));
}

function evaluateScenario(scenario, inputs, interestType, baseNoi, allInBasis) {
  const targetNoi = baseNoi + inputs.stabilizedNoiDelta.value;
  const annualNoi = annualNoiSequence(baseNoi, inputs);
  const exit = terminalValue(interestType, targetNoi, inputs);
  const initialOutlay = allInBasis + inputs.strategyCapex.value;
  const cashflows = [-initialOutlay, ...annualNoi];
  cashflows[cashflows.length - 1] += exit.net;
  const rawIrr = computeIRR(cashflows);
  const positiveDistributions = cashflows.slice(1).reduce((sum, value) => sum + Math.max(0, value), 0);
  const additionalCapital = cashflows.slice(1).reduce((sum, value) => sum + Math.max(0, -value), 0);
  const totalCapital = initialOutlay + additionalCapital;
  const totalNetCash = cashflows.reduce((sum, value) => sum + value, 0);
  const grossInflows = cashflows.slice(1).reduce((sum, value) => sum + Math.max(0, value), 0);
  return {
    scenarioId: scenario.scenarioId,
    strategyType: scenario.strategyType,
    label: scenario.label,
    isBenchmark: scenario.isBenchmark,
    holdPeriodYears: inputs.holdPeriodYears.value,
    calculationBasis: 'UNLEVERED_ANNUAL_CASH_FLOW',
    inputLineage: projectInputLineage(inputs),
    initialOutlay,
    allInAcquisitionBasis: allInBasis,
    strategyCapex: inputs.strategyCapex.value,
    baseStabilizedNoi: baseNoi,
    targetStabilizedNoi: targetNoi,
    annualNoi,
    terminalValue: exit,
    cashflows,
    metrics: {
      unleveredIrr: Number.isFinite(rawIrr) ? rawIrr : null,
      npv: calculateNpv(cashflows, inputs.discountRate.value),
      distributionMultiple: totalCapital > 0 ? positiveDistributions / totalCapital : null,
      totalNetCash,
      profitOnCost: initialOutlay > 0 ? totalNetCash / initialOutlay : null,
      paybackYear: calculatePaybackYear(cashflows),
      terminalValueShareOfGrossInflows: grossInflows > 0 ? exit.net / grossInflows : null,
      strategyCapexToBaseNoi: baseNoi > 0 ? inputs.strategyCapex.value / baseNoi : null,
    },
    valueCreationVsBenchmarkNpv: null,
    analyticalRank: null,
    recommendedStrategy: null,
    investmentDecision: null,
    transactionAuthorized: false,
  };
}

function calculateExitStrategyComparison(
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
  const scenarios = operatingCase.exitScenarios || [];
  const validatedBaseNoi = incomeAnalysis.stabilizedNoiCalculated && incomeAnalysis.stabilizedIncome
    ? incomeAnalysis.stabilizedIncome.stabilizedNoi
    : null;

  if (BLOCKING_READINESS_STATUSES.has(readiness.status)) {
    addIssue(issues, 'OPERATING_READINESS_GATE_NOT_PASSED', 'operatingUnderwritingReadiness');
  }
  if (!incomeAnalysis.stabilizedNoiCalculated || !incomeAnalysis.stabilizedIncome || incomeAnalysis.stabilizedIncome.stabilizedNoi <= 0) {
    addIssue(issues, 'POSITIVE_STABILIZED_NOI_REQUIRED', 'incomeAnalysis.stabilizedIncome.stabilizedNoi');
  }
  if (!acquisitionBasis.acquisitionBasisCalculated || !acquisitionBasis.bases) {
    addIssue(issues, 'ACQUISITION_BASIS_REQUIRED', 'acquisitionBasis');
  }
  if (scenarios.length < 2) addIssue(issues, 'AT_LEAST_TWO_EXIT_SCENARIOS_REQUIRED', 'exitScenarios');
  const benchmarks = scenarios.filter((scenario) => scenario.isBenchmark === true);
  if (benchmarks.length !== 1) addIssue(issues, 'EXACTLY_ONE_EXIT_BENCHMARK_REQUIRED', 'exitScenarios.isBenchmark');
  const interest = operatingCase.propertyInterest;
  if (!interest) addIssue(issues, 'PROPERTY_INTEREST_REQUIRED', 'propertyInterest');

  const validated = [];
  for (const scenario of scenarios) {
    const types = [...REQUIRED_COMMON_INPUTS];
    if (interest && interest.interestType === PROPERTY_INTEREST_TYPE.FREEHOLD) types.push(EXIT_STRATEGY_INPUT_TYPE.EXIT_CAP_RATE);
    else types.push(EXIT_STRATEGY_INPUT_TYPE.CONTRACTUAL_TERMINAL_VALUE);
    const inputs = {};
    for (const type of types) {
      const input = findAndValidateInput(scenario, type, asOfDate, issues);
      if (input) inputs[EXIT_STRATEGY_INPUT_DEFINITION[type].key] = input;
    }
    if (Object.keys(inputs).length !== types.length) continue;
    if (inputs.executionPeriodYears.value > inputs.holdPeriodYears.value) {
      addIssue(issues, 'EXECUTION_PERIOD_EXCEEDS_HOLD_PERIOD', inputs.executionPeriodYears.field, inputs.executionPeriodYears.sourceRef, scenario.scenarioId);
    }
    const targetNoi = validatedBaseNoi === null ? null : validatedBaseNoi + inputs.stabilizedNoiDelta.value;
    if (targetNoi !== null && targetNoi <= 0) {
      addIssue(issues, 'TARGET_STABILIZED_NOI_MUST_BE_POSITIVE', inputs.stabilizedNoiDelta.field, inputs.stabilizedNoiDelta.sourceRef, scenario.scenarioId);
    }
    if (PASSIVE_STRATEGIES.has(scenario.strategyType)
      && (inputs.strategyCapex.value !== 0 || inputs.stabilizedNoiDelta.value !== 0 || inputs.executionPeriodYears.value !== 0)) {
      addIssue(issues, 'PASSIVE_EXIT_STRATEGY_CANNOT_CARRY_ACTION_UPSIDE', `exit.${scenario.scenarioId}`, null, scenario.scenarioId);
    }
    if (!PASSIVE_STRATEGIES.has(scenario.strategyType)
      && inputs.strategyCapex.value === 0 && inputs.stabilizedNoiDelta.value === 0) {
      addIssue(issues, 'ACTIVE_EXIT_STRATEGY_REQUIRES_EXPLICIT_ACTION_DRIVER', `exit.${scenario.scenarioId}`, null, scenario.scenarioId);
    }
    if (scenario.strategyType === EXIT_STRATEGY_TYPE.HOLD_TO_INTEREST_EXPIRY && interest && !interest.isTimeLimited) {
      addIssue(issues, 'HOLD_TO_INTEREST_EXPIRY_REQUIRES_TIME_LIMITED_INTEREST', `exit.${scenario.scenarioId}.strategyType`, interest.interestEvidenceRef, scenario.scenarioId);
    }
    if (interest && interest.isTimeLimited) {
      if (!interest.expiryDate) {
        addIssue(issues, 'TIME_LIMITED_INTEREST_EXPIRY_REQUIRED', 'propertyInterest.expiryDate', interest.interestEvidenceRef, scenario.scenarioId);
      } else if (inputs.holdPeriodYears.value > yearsBetween(asOfDate, new Date(interest.expiryDate)) + 1e-9) {
        addIssue(issues, 'EXIT_HOLD_PERIOD_EXCEEDS_PROPERTY_INTEREST_TERM', inputs.holdPeriodYears.field, interest.interestEvidenceRef, scenario.scenarioId);
      }
    }
    validated.push({ scenario, inputs });
  }
  const discountRates = new Set(validated.map(({ inputs }) => inputs.discountRate && inputs.discountRate.value));
  if (discountRates.size > 1) {
    addIssue(issues, 'EXIT_SCENARIOS_REQUIRE_COMMON_DISCOUNT_RATE', 'exitScenarios.inputs.discountRate');
  }
  if (issues.length) return emptyResult(operatingCase, issues, readiness.status);

  const baseNoi = validatedBaseNoi;
  const allInBasis = acquisitionBasis.bases.allInBasis;
  const rawResults = validated.map(({ scenario, inputs }) => evaluateScenario(
    scenario,
    inputs,
    interest.interestType,
    baseNoi,
    allInBasis,
  ));
  const benchmark = rawResults.find((result) => result.isBenchmark);
  const ranked = [...rawResults].sort((a, b) => (b.metrics.npv - a.metrics.npv) || a.scenarioId.localeCompare(b.scenarioId));
  const rankById = new Map(ranked.map((result, index) => [result.scenarioId, index + 1]));
  const scenarioResults = rawResults.map((result) => ({
    ...result,
    valueCreationVsBenchmarkNpv: result.metrics.npv - benchmark.metrics.npv,
    analyticalRank: rankById.get(result.scenarioId),
  }));
  const ranking = ranked.map((result, index) => ({
    analyticalRank: index + 1,
    scenarioId: result.scenarioId,
    strategyType: result.strategyType,
    npv: result.metrics.npv,
    valueCreationVsBenchmarkNpv: result.metrics.npv - benchmark.metrics.npv,
  }));
  const scenarioAssumptions = validated.flatMap(({ inputs }) => Object.values(inputs))
    .filter((input) => input.verificationStatus === OPERATING_INPUT_STATUS.ASSUMED).length;
  const dependencyAssumptions = (incomeAnalysis.assumedInputCount || 0) + (acquisitionBasis.assumedInputCount || 0);
  const assumedInputCount = scenarioAssumptions + dependencyAssumptions;
  const status = assumedInputCount > 0
    ? EXIT_STRATEGY_COMPARISON_STATUS.CALCULATED_WITH_ASSUMPTIONS
    : EXIT_STRATEGY_COMPARISON_STATUS.CALCULATED;
  const highest = ranking[0];

  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status,
    readinessStatus: readiness.status,
    issues: [],
    assumedInputCount,
    dependencyAssumedInputCount: dependencyAssumptions,
    benchmarkScenarioId: benchmark.scenarioId,
    calculationBasis: 'UNLEVERED_ANNUAL_CASH_FLOW',
    scenarioResults,
    ranking,
    highestModeledNpvScenario: {
      scenarioId: highest.scenarioId,
      strategyType: highest.strategyType,
      npv: highest.npv,
      valueCreationVsBenchmarkNpv: highest.valueCreationVsBenchmarkNpv,
    },
    exitStrategyComparisonCalculated: true,
    financialCalculationExecuted: true,
    valuationCalculated: false,
    recommendedStrategy: null,
    investmentDecision: null,
    transactionAuthorized: false,
    semantics: 'Evidence-gated, unlevered annual cash-flow comparison of explicitly supplied exit scenarios. Analytical ranking reflects modeled NPV only; it is not a certified valuation, strategy recommendation, legal opinion, financing approval, investment decision, or transaction authorization.',
  });
}

module.exports = {
  EXIT_STRATEGY_COMPARISON_STATUS,
  calculateExitStrategyComparison,
};

'use strict';

const {
  OPERATING_EXPENSE_BASIS,
  OPERATING_INPUT_STATUS,
  CAPEX_SEVERITY,
  deepFreeze,
} = require('./contracts');
const { OPERATING_METRICS_STATUS, calculateOperatingMetrics } = require('./operating-metrics');

const PROPERTY_COST_STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  CALCULATED_WITH_GAPS: 'CALCULATED_WITH_GAPS',
  NOT_CALCULABLE: 'NOT_CALCULABLE',
});

const ADOPTABLE_STATUSES = new Set([
  OPERATING_INPUT_STATUS.VERIFIED_FACT,
  OPERATING_INPUT_STATUS.ASSUMED,
]);

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

function blankBasisTotals() {
  return {
    [OPERATING_EXPENSE_BASIS.ACTUAL]: 0,
    [OPERATING_EXPENSE_BASIS.BUDGET]: 0,
    [OPERATING_EXPENSE_BASIS.NORMALIZED]: 0,
    [OPERATING_EXPENSE_BASIS.BENCHMARK]: 0,
  };
}

function buildOperatingExpenseAnalysis(operatingCase, operatingMetrics) {
  const issues = [];
  const totals = blankBasisTotals();
  const knownCounts = blankBasisTotals();
  const unresolvedCounts = blankBasisTotals();
  const byCategory = {};

  if (operatingCase.operatingExpenses.length === 0) {
    addIssue(issues, 'OPERATING_EXPENSE_INVENTORY_REQUIRED', 'operatingExpenses');
  }

  for (const expense of operatingCase.operatingExpenses) {
    const field = `operatingExpense.${expense.expenseId}.annualAmount`;
    if (!byCategory[expense.category]) byCategory[expense.category] = blankBasisTotals();
    if (expense.annualAmount.unit !== 'SAR/year') {
      unresolvedCounts[expense.basis] += 1;
      addIssue(issues, 'OPEX_ANNUAL_AMOUNT_UNIT_REQUIRED', field, expense.annualAmount.sourceRef);
      continue;
    }
    if (!adoptedFiniteNumber(expense.annualAmount) || expense.annualAmount.value < 0) {
      unresolvedCounts[expense.basis] += 1;
      addIssue(
        issues,
        expense.annualAmount.verificationStatus === OPERATING_INPUT_STATUS.NOT_AVAILABLE
          ? 'OPEX_AMOUNT_NOT_AVAILABLE'
          : 'ADOPTED_OPEX_AMOUNT_REQUIRED',
        field,
        expense.annualAmount.sourceRef,
      );
      continue;
    }
    totals[expense.basis] += expense.annualAmount.value;
    byCategory[expense.category][expense.basis] += expense.annualAmount.value;
    knownCounts[expense.basis] += 1;
  }

  const normalizedComplete = knownCounts.NORMALIZED > 0 && unresolvedCounts.NORMALIZED === 0;
  const benchmarkComplete = knownCounts.BENCHMARK > 0 && unresolvedCounts.BENCHMARK === 0;
  const normalizedAnnualOpex = normalizedComplete ? totals.NORMALIZED : null;
  const benchmarkAnnualOpex = benchmarkComplete ? totals.BENCHMARK : null;
  if (!normalizedComplete) addIssue(issues, 'COMPLETE_NORMALIZED_OPEX_REQUIRED', 'operatingExpenses.NORMALIZED');

  const rentableAreaSqm = operatingMetrics?.status === OPERATING_METRICS_STATUS.CALCULATED
    ? operatingMetrics.rentRoll.totals.totalRentableAreaSqm
    : null;
  const unitCount = operatingMetrics?.status === OPERATING_METRICS_STATUS.CALCULATED
    ? operatingMetrics.rentRoll.totals.unitCount
    : null;
  const annualContractRent = operatingMetrics?.status === OPERATING_METRICS_STATUS.CALCULATED
    ? operatingMetrics.rentRoll.totals.totalAnnualContractRent
    : null;

  const totalKnownCount = Object.values(knownCounts).reduce((sum, value) => sum + value, 0);
  let status = PROPERTY_COST_STATUS.NOT_CALCULABLE;
  if (normalizedComplete && issues.length === 0) status = PROPERTY_COST_STATUS.CALCULATED;
  else if (totalKnownCount > 0) status = PROPERTY_COST_STATUS.CALCULATED_WITH_GAPS;

  return {
    status,
    issues,
    recordCount: operatingCase.operatingExpenses.length,
    totalsByBasis: {
      actualAnnualOpex: knownCounts.ACTUAL > 0 && unresolvedCounts.ACTUAL === 0 ? totals.ACTUAL : null,
      budgetAnnualOpex: knownCounts.BUDGET > 0 && unresolvedCounts.BUDGET === 0 ? totals.BUDGET : null,
      normalizedAnnualOpex,
      benchmarkAnnualOpex,
    },
    countsByBasis: { known: knownCounts, unresolved: unresolvedCounts },
    byCategory,
    normalizedMetrics: {
      opexToContractRent: normalizedAnnualOpex !== null && annualContractRent > 0 ? normalizedAnnualOpex / annualContractRent : null,
      opexPerRentableSqm: normalizedAnnualOpex !== null && rentableAreaSqm > 0 ? normalizedAnnualOpex / rentableAreaSqm : null,
      opexPerUnit: normalizedAnnualOpex !== null && unitCount > 0 ? normalizedAnnualOpex / unitCount : null,
      varianceToBenchmark: normalizedAnnualOpex !== null && benchmarkAnnualOpex !== null ? normalizedAnnualOpex - benchmarkAnnualOpex : null,
      varianceToBenchmarkRatio: normalizedAnnualOpex !== null && benchmarkAnnualOpex > 0
        ? (normalizedAnnualOpex - benchmarkAnnualOpex) / benchmarkAnnualOpex
        : null,
    },
    noiCalculated: false,
  };
}

function buildCapexAnalysis(operatingCase) {
  const issues = [];
  let knownImmediateCapex = 0;
  let knownDeferredCapex = 0;
  let knownCostCount = 0;
  let unknownCostCount = 0;
  let criticalUnknownCostCount = 0;
  let lifeSafetyUnknownCostCount = 0;
  let criticalOrLifeSafetyUnknownCostCount = 0;
  const byCategory = {};
  const bySeverity = {};

  if (operatingCase.capexItems.length === 0) addIssue(issues, 'TECHNICAL_CAPEX_ASSESSMENT_REQUIRED', 'capexItems');

  for (const item of operatingCase.capexItems) {
    const field = `capexItem.${item.capexItemId}.estimatedCost`;
    if (!byCategory[item.category]) byCategory[item.category] = { knownCost: 0, knownCount: 0, unknownCount: 0 };
    if (!bySeverity[item.severity]) bySeverity[item.severity] = { knownCost: 0, knownCount: 0, unknownCount: 0 };
    const unitValid = item.estimatedCost.unit === 'SAR';
    const costKnown = unitValid && adoptedFiniteNumber(item.estimatedCost) && item.estimatedCost.value >= 0;

    if (!costKnown) {
      unknownCostCount += 1;
      byCategory[item.category].unknownCount += 1;
      bySeverity[item.severity].unknownCount += 1;
      if (item.severity === CAPEX_SEVERITY.CRITICAL) criticalUnknownCostCount += 1;
      if (item.lifeSafety) lifeSafetyUnknownCostCount += 1;
      if (item.severity === CAPEX_SEVERITY.CRITICAL || item.lifeSafety) criticalOrLifeSafetyUnknownCostCount += 1;
      addIssue(
        issues,
        !unitValid
          ? 'CAPEX_COST_UNIT_REQUIRED'
          : (item.estimatedCost.verificationStatus === OPERATING_INPUT_STATUS.NOT_AVAILABLE
            ? 'CAPEX_COST_NOT_AVAILABLE'
            : 'ADOPTED_CAPEX_COST_REQUIRED'),
        field,
        item.estimatedCost.sourceRef,
      );
      if (item.severity === CAPEX_SEVERITY.CRITICAL || item.lifeSafety) {
        addIssue(issues, 'CRITICAL_OR_LIFE_SAFETY_COST_DUE_DILIGENCE_REQUIRED', field, item.estimatedCost.sourceRef);
      }
      continue;
    }

    knownCostCount += 1;
    byCategory[item.category].knownCost += item.estimatedCost.value;
    byCategory[item.category].knownCount += 1;
    bySeverity[item.severity].knownCost += item.estimatedCost.value;
    bySeverity[item.severity].knownCount += 1;
    if (item.immediate) knownImmediateCapex += item.estimatedCost.value;
    else knownDeferredCapex += item.estimatedCost.value;
  }

  let status = PROPERTY_COST_STATUS.NOT_CALCULABLE;
  if (operatingCase.capexItems.length > 0 && unknownCostCount === 0) status = PROPERTY_COST_STATUS.CALCULATED;
  else if (knownCostCount > 0 || unknownCostCount > 0) status = PROPERTY_COST_STATUS.CALCULATED_WITH_GAPS;

  return {
    status,
    issues,
    itemCount: operatingCase.capexItems.length,
    knownCostCount,
    unknownCostCount,
    criticalUnknownCostCount,
    lifeSafetyUnknownCostCount,
    criticalOrLifeSafetyUnknownCostCount,
    knownImmediateCapex,
    knownDeferredCapex,
    knownTotalCapex: knownImmediateCapex + knownDeferredCapex,
    completeTotalCapex: operatingCase.capexItems.length > 0 && unknownCostCount === 0
      ? knownImmediateCapex + knownDeferredCapex
      : null,
    acquisitionBasisAdjustment: operatingCase.capexItems.length > 0 && unknownCostCount === 0
      ? knownImmediateCapex
      : null,
    byCategory,
    bySeverity,
  };
}

function calculatePropertyCosts(operatingCase, suppliedOperatingMetrics = null) {
  if (!operatingCase || operatingCase.contractType !== 'RESIDENTIAL_INCOME_OPERATING_CASE_V1') {
    throw new TypeError('operatingCase must be created by createResidentialIncomeOperatingCase');
  }
  const operatingMetrics = suppliedOperatingMetrics || calculateOperatingMetrics(operatingCase);
  const operatingExpenses = buildOperatingExpenseAnalysis(operatingCase, operatingMetrics);
  const capex = buildCapexAnalysis(operatingCase);
  const issues = [...operatingExpenses.issues, ...capex.issues];

  let status = PROPERTY_COST_STATUS.CALCULATED;
  if (operatingExpenses.status === PROPERTY_COST_STATUS.NOT_CALCULABLE && capex.status === PROPERTY_COST_STATUS.NOT_CALCULABLE) {
    status = PROPERTY_COST_STATUS.NOT_CALCULABLE;
  } else if (operatingExpenses.status !== PROPERTY_COST_STATUS.CALCULATED || capex.status !== PROPERTY_COST_STATUS.CALCULATED) {
    status = PROPERTY_COST_STATUS.CALCULATED_WITH_GAPS;
  }

  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status,
    issues,
    operatingExpenses,
    capex,
    financialCalculationExecuted: false,
    stabilizedNoiCalculated: false,
    acquisitionPriceCalculated: false,
    investmentDecision: null,
    semantics: 'Property costs summarize adopted OPEX bases and known technical CAPEX. Unknown costs remain null, prevent a complete CAPEX total and acquisition-basis adjustment, and are never inferred as zero.',
  });
}

module.exports = {
  PROPERTY_COST_STATUS,
  calculatePropertyCosts,
};

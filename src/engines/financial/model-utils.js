'use strict';

const { requireFiniteIntermediate } = require('../../validation/numeric-safety');

function finiteOr(value, fallback = 0, field = 'financialModelValue') {
  if (value === undefined || value === null) return fallback;
  return requireFiniteIntermediate(field, value);
}

function positiveOrNull(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function leaseUpFactorFromMonths(months) {
  if (!Number.isFinite(months)) return 1;
  return clamp01(1 - Math.max(0, months) / 12);
}

function computeCumulativePaybackYears(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) return null;
  let cumulative = finiteOr(cashflows[0], 0, 'cashflows[0]');
  if (cumulative >= 0) return 0;

  for (let year = 1; year < cashflows.length; year += 1) {
    const flow = finiteOr(cashflows[year], 0, `cashflows[${year}]`);
    const before = cumulative;
    cumulative += flow;
    requireFiniteIntermediate(`cumulativeCashflow[${year}]`, cumulative);
    if (cumulative >= 0 && flow > 0) {
      const fraction = Math.min(1, Math.max(0, -before / flow));
      return (year - 1) + fraction;
    }
  }
  return null;
}

function buildExpenseModel({
  revenue,
  netLeasableArea,
  replacementValue,
  fixedOpexPerSqm = 0,
  variableOpexRate = 0,
  managementFeeRate = 0,
  insuranceRateOnReplacementCost = 0,
  replacementReservePerSqm = 0,
}) {
  const normalizedArea = finiteOr(netLeasableArea, 0, 'netLeasableArea');
  const normalizedRevenue = finiteOr(revenue, 0, 'revenue');
  const normalizedReplacementValue = finiteOr(replacementValue, 0, 'replacementValue');
  const normalizedFixedOpexPerSqm = finiteOr(fixedOpexPerSqm, 0, 'fixedOpexPerSqm');
  const normalizedVariableOpexRate = finiteOr(variableOpexRate, 0, 'variableOpexRate');
  const normalizedManagementFeeRate = finiteOr(managementFeeRate, 0, 'managementFeeRate');
  const normalizedInsuranceRate = finiteOr(insuranceRateOnReplacementCost, 0, 'insuranceRateOnReplacementCost');
  const normalizedReplacementReserve = finiteOr(replacementReservePerSqm, 0, 'replacementReservePerSqm');

  const fixedOperatingExpense = Math.max(0, normalizedArea * Math.max(0, normalizedFixedOpexPerSqm));
  const variableOperatingExpense = Math.max(0, normalizedRevenue * Math.max(0, normalizedVariableOpexRate));
  const managementFeeAmount = Math.max(0, normalizedRevenue * Math.max(0, normalizedManagementFeeRate));
  const insuranceAmount = Math.max(0, normalizedReplacementValue * Math.max(0, normalizedInsuranceRate));
  const replacementReserveAmount = Math.max(0, normalizedArea * Math.max(0, normalizedReplacementReserve));
  const operatingExpensesBeforeReserve = fixedOperatingExpense + variableOperatingExpense + managementFeeAmount + insuranceAmount;
  const totalEconomicExpenses = operatingExpensesBeforeReserve + replacementReserveAmount;
  const noiBeforeReserve = normalizedRevenue - operatingExpensesBeforeReserve;
  const noiAfterReserve = noiBeforeReserve - replacementReserveAmount;

  [
    ['fixedOperatingExpense', fixedOperatingExpense],
    ['variableOperatingExpense', variableOperatingExpense],
    ['managementFeeAmount', managementFeeAmount],
    ['insuranceAmount', insuranceAmount],
    ['replacementReserveAmount', replacementReserveAmount],
    ['operatingExpensesBeforeReserve', operatingExpensesBeforeReserve],
    ['totalEconomicExpenses', totalEconomicExpenses],
    ['noiBeforeReserve', noiBeforeReserve],
    ['noiAfterReserve', noiAfterReserve],
  ].forEach(([field, value]) => requireFiniteIntermediate(field, value));

  return {
    fixedOperatingExpense,
    variableOperatingExpense,
    managementFeeAmount,
    insuranceAmount,
    replacementReserveAmount,
    operatingExpensesBeforeReserve,
    totalEconomicExpenses,
    noiBeforeReserve,
    noiAfterReserve,
  };
}

function grow(value, rate, periods) {
  const normalizedValue = finiteOr(value, 0, 'growthBaseValue');
  const normalizedRate = finiteOr(rate, 0, 'growthRate');
  const result = normalizedValue * Math.pow(1 + normalizedRate, Math.max(0, periods));
  return requireFiniteIntermediate('grownValue', result);
}

module.exports = {
  finiteOr,
  positiveOrNull,
  leaseUpFactorFromMonths,
  computeCumulativePaybackYears,
  buildExpenseModel,
  grow,
};

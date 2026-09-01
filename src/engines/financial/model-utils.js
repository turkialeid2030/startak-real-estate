'use strict';

function finiteOr(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
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
  let cumulative = finiteOr(cashflows[0]);
  if (cumulative >= 0) return 0;

  for (let year = 1; year < cashflows.length; year += 1) {
    const flow = finiteOr(cashflows[year]);
    const before = cumulative;
    cumulative += flow;
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
  const fixedOperatingExpense = Math.max(0, finiteOr(netLeasableArea) * Math.max(0, finiteOr(fixedOpexPerSqm)));
  const variableOperatingExpense = Math.max(0, finiteOr(revenue) * Math.max(0, finiteOr(variableOpexRate)));
  const managementFeeAmount = Math.max(0, finiteOr(revenue) * Math.max(0, finiteOr(managementFeeRate)));
  const insuranceAmount = Math.max(0, finiteOr(replacementValue) * Math.max(0, finiteOr(insuranceRateOnReplacementCost)));
  const replacementReserveAmount = Math.max(0, finiteOr(netLeasableArea) * Math.max(0, finiteOr(replacementReservePerSqm)));
  const operatingExpensesBeforeReserve = fixedOperatingExpense + variableOperatingExpense + managementFeeAmount + insuranceAmount;
  const totalEconomicExpenses = operatingExpensesBeforeReserve + replacementReserveAmount;
  const noiBeforeReserve = finiteOr(revenue) - operatingExpensesBeforeReserve;
  const noiAfterReserve = noiBeforeReserve - replacementReserveAmount;

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
  return finiteOr(value) * Math.pow(1 + finiteOr(rate), Math.max(0, periods));
}

module.exports = {
  finiteOr,
  positiveOrNull,
  leaseUpFactorFromMonths,
  computeCumulativePaybackYears,
  buildExpenseModel,
  grow,
};

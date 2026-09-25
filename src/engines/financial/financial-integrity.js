'use strict';

const FINANCIAL_INTEGRITY_VERSION = 'FINANCIAL_INTEGRITY_P0_1.0';

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  return value;
}

function nonNegative(value, name) {
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must be >= 0`);
  return value;
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be > 0`);
  return value;
}

function ratio(numerator, denominator, numeratorName = 'numerator', denominatorName = 'denominator') {
  finite(numerator, numeratorName);
  positive(denominator, denominatorName);
  const value = numerator / denominator;
  if (!Number.isFinite(value)) throw new RangeError('ratio produced a non-finite result');
  return value;
}

function normalizedNoiWaterfall(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('NOI input must be an object');

  const potentialBaseRentSar = nonNegative(input.potentialBaseRentSar ?? 0, 'potentialBaseRentSar');
  const otherPotentialIncomeSar = nonNegative(input.otherPotentialIncomeSar ?? 0, 'otherPotentialIncomeSar');
  const vacancyLossSar = nonNegative(input.vacancyLossSar ?? 0, 'vacancyLossSar');
  const collectionLossSar = nonNegative(input.collectionLossSar ?? 0, 'collectionLossSar');
  const concessionsSar = nonNegative(input.concessionsSar ?? 0, 'concessionsSar');
  const otherOperatingIncomeSar = nonNegative(input.otherOperatingIncomeSar ?? 0, 'otherOperatingIncomeSar');
  const serviceChargeRecoveriesSar = nonNegative(input.serviceChargeRecoveriesSar ?? 0, 'serviceChargeRecoveriesSar');
  const recoverableOperatingExpensesSar = nonNegative(input.recoverableOperatingExpensesSar ?? 0, 'recoverableOperatingExpensesSar');
  const nonRecoverableOperatingExpensesSar = nonNegative(input.nonRecoverableOperatingExpensesSar ?? 0, 'nonRecoverableOperatingExpensesSar');
  const otherOperatingExpensesSar = nonNegative(input.otherOperatingExpensesSar ?? 0, 'otherOperatingExpensesSar');

  const gpiSar = potentialBaseRentSar + otherPotentialIncomeSar;
  const totalEconomicLossSar = vacancyLossSar + collectionLossSar + concessionsSar;
  if (totalEconomicLossSar > gpiSar) throw new RangeError('vacancy, collection loss and concessions cannot exceed GPI');

  const egiSar = gpiSar - totalEconomicLossSar + otherOperatingIncomeSar + serviceChargeRecoveriesSar;
  const operatingExpensesSar = recoverableOperatingExpensesSar + nonRecoverableOperatingExpensesSar + otherOperatingExpensesSar;
  const noiSar = egiSar - operatingExpensesSar;
  const netServiceChargeContributionSar = serviceChargeRecoveriesSar - recoverableOperatingExpensesSar;

  const warnings = [];
  if (potentialBaseRentSar > 0 && totalEconomicLossSar === 0) warnings.push('ZERO_ECONOMIC_VACANCY_OR_CREDIT_LOSS_REQUIRES_EVIDENCE');
  if (operatingExpensesSar === 0) warnings.push('ZERO_OPEX_REQUIRES_EVIDENCE');
  if (serviceChargeRecoveriesSar > 0 && recoverableOperatingExpensesSar === 0) warnings.push('SERVICE_CHARGE_RECOVERY_WITHOUT_MATCHED_RECOVERABLE_OPEX');

  return Object.freeze({
    modelVersion: FINANCIAL_INTEGRITY_VERSION,
    potentialBaseRentSar,
    otherPotentialIncomeSar,
    gpiSar,
    vacancyLossSar,
    collectionLossSar,
    concessionsSar,
    totalEconomicLossSar,
    otherOperatingIncomeSar,
    serviceChargeRecoveriesSar,
    egiSar,
    recoverableOperatingExpensesSar,
    nonRecoverableOperatingExpensesSar,
    otherOperatingExpensesSar,
    operatingExpensesSar,
    netServiceChargeContributionSar,
    noiSar,
    warnings: Object.freeze(warnings),
  });
}

function directCapitalizationValue(stabilizedNoiSar, marketCapRate) {
  return ratio(stabilizedNoiSar, marketCapRate, 'stabilizedNoiSar', 'marketCapRate');
}

function marketCapRate(stabilizedNoiSar, marketValueSar) {
  return ratio(stabilizedNoiSar, marketValueSar, 'stabilizedNoiSar', 'marketValueSar');
}

function yieldOnCost(stabilizedNoiSar, totalDevelopmentCostSar) {
  return ratio(stabilizedNoiSar, totalDevelopmentCostSar, 'stabilizedNoiSar', 'totalDevelopmentCostSar');
}

function dscr(approvedNumeratorSar, debtServiceSar) {
  return ratio(approvedNumeratorSar, debtServiceSar, 'approvedNumeratorSar', 'debtServiceSar');
}

function ltv(loanAmountSar, collateralValueSar) {
  return ratio(loanAmountSar, collateralValueSar, 'loanAmountSar', 'collateralValueSar');
}

function ltc(loanAmountSar, totalDevelopmentCostSar) {
  return ratio(loanAmountSar, totalDevelopmentCostSar, 'loanAmountSar', 'totalDevelopmentCostSar');
}

function debtYield(stabilizedNoiSar, loanBalanceSar) {
  return ratio(stabilizedNoiSar, loanBalanceSar, 'stabilizedNoiSar', 'loanBalanceSar');
}

function breakEvenOccupancy({ operatingExpensesSar, debtServiceSar = 0, otherIncomeSar = 0, grossPotentialRentSar }) {
  nonNegative(operatingExpensesSar, 'operatingExpensesSar');
  nonNegative(debtServiceSar, 'debtServiceSar');
  nonNegative(otherIncomeSar, 'otherIncomeSar');
  positive(grossPotentialRentSar, 'grossPotentialRentSar');
  return (operatingExpensesSar + debtServiceSar - otherIncomeSar) / grossPotentialRentSar;
}

function normalizeDatedCashflows(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) throw new TypeError('dated cashflows must contain at least two entries');
  const rows = cashflows.map((row, index) => {
    if (!row || typeof row !== 'object') throw new TypeError(`cashflow[${index}] must be an object`);
    const amount = finite(row.amount, `cashflow[${index}].amount`);
    const date = new Date(row.date);
    if (!Number.isFinite(date.getTime())) throw new TypeError(`cashflow[${index}].date is invalid`);
    return { amount, date };
  }).sort((a, b) => a.date - b.date);
  if (!rows.some((row) => row.amount < 0) || !rows.some((row) => row.amount > 0)) throw new RangeError('dated cashflows require at least one negative and one positive cashflow');
  return rows;
}

function xnpv(rate, cashflows) {
  finite(rate, 'rate');
  if (rate <= -1) throw new RangeError('rate must be > -1');
  const rows = normalizeDatedCashflows(cashflows);
  const base = rows[0].date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return rows.reduce((sum, row) => {
    const years = (row.date.getTime() - base) / dayMs / 365;
    return sum + row.amount / Math.pow(1 + rate, years);
  }, 0);
}

function xirr(cashflows, options = {}) {
  const rows = normalizeDatedCashflows(cashflows);
  const tolerance = options.tolerance ?? 1e-9;
  const maxIterations = options.maxIterations ?? 250;
  let low = options.low ?? -0.999999;
  let high = options.high ?? 10;
  let fLow = xnpv(low, rows);
  let fHigh = xnpv(high, rows);

  for (let expansion = 0; fLow * fHigh > 0 && expansion < 20; expansion += 1) {
    high *= 2;
    fHigh = xnpv(high, rows);
  }
  if (fLow * fHigh > 0) return null;

  for (let i = 0; i < maxIterations; i += 1) {
    const mid = (low + high) / 2;
    const fMid = xnpv(mid, rows);
    if (Math.abs(fMid) <= tolerance || Math.abs(high - low) <= tolerance) return mid;
    if (fLow * fMid <= 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }
  return (low + high) / 2;
}

module.exports = {
  FINANCIAL_INTEGRITY_VERSION,
  normalizedNoiWaterfall,
  directCapitalizationValue,
  marketCapRate,
  yieldOnCost,
  dscr,
  ltv,
  ltc,
  debtYield,
  breakEvenOccupancy,
  xnpv,
  xirr,
};

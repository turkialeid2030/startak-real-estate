'use strict';

const { buildMonthlyDebtPlan, minimumDscr, normalizeTenorMonths } = require('./monthly-debt');

function requireFinite(name, value) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
}

function normalizeConstructionMonths(constructionYears) {
  requireFinite('constructionYears', constructionYears);
  if (constructionYears <= 0) throw new RangeError('constructionYears must be > 0');
  const months = Math.round(constructionYears * 12);
  if (months < 1) throw new RangeError('constructionYears resolves to less than one month');
  return months;
}

function simulateConstructionFacility({
  landCost,
  constructionCost,
  debtFraction,
  annualRate,
  constructionYears,
}) {
  [
    ['landCost', landCost], ['constructionCost', constructionCost],
    ['debtFraction', debtFraction], ['annualRate', annualRate],
  ].forEach(([name, value]) => requireFinite(name, value));
  if (landCost < 0 || constructionCost < 0) throw new RangeError('costs must be >= 0');
  if (debtFraction < 0 || debtFraction > 1) throw new RangeError('debtFraction must be between 0 and 1');
  if (annualRate < 0) throw new RangeError('annualRate must be >= 0');

  const constructionMonths = normalizeConstructionMonths(constructionYears);
  const monthlyRate = annualRate / 12;
  const landDebtDraw = landCost * debtFraction;
  const constructionDebtPrincipal = constructionCost * debtFraction;
  const monthlyConstructionDraw = constructionMonths > 0 ? constructionDebtPrincipal / constructionMonths : 0;
  let balance = landDebtDraw;
  let capitalizedInterest = 0;
  const schedule = [];

  for (let month = 1; month <= constructionMonths; month += 1) {
    balance += monthlyConstructionDraw;
    const interest = balance * monthlyRate;
    balance += interest;
    capitalizedInterest += interest;
    schedule.push({
      month,
      constructionDebtDraw: monthlyConstructionDraw,
      capitalizedInterest: interest,
      balance,
    });
  }

  const principalDebtDraws = landDebtDraw + constructionDebtPrincipal;
  return {
    constructionMonths,
    landDebtDraw,
    constructionDebtPrincipal,
    monthlyConstructionDraw,
    principalDebtDraws,
    capitalizedInterest,
    completionBalance: balance,
    schedule,
  };
}

function buildAnnualConstructionDebtDraws(facility) {
  const annual = [];
  for (const row of facility.schedule) {
    const year = Math.ceil(row.month / 12);
    if (!annual[year - 1]) {
      annual[year - 1] = { year, debtDraw: 0, capitalizedInterest: 0, endingBalance: row.balance };
    }
    annual[year - 1].debtDraw += row.constructionDebtDraw;
    annual[year - 1].capitalizedInterest += row.capitalizedInterest;
    annual[year - 1].endingBalance = row.balance;
  }
  return annual;
}

function extendAnnualNoi(annualNoi, tenorYears) {
  if (!Array.isArray(annualNoi) || annualNoi.length === 0) return [];
  const years = Math.max(1, Math.ceil(tenorYears));
  const out = annualNoi.slice(0, years);
  while (out.length < years) out.push(out[out.length - 1]);
  return out;
}

function sizeConstructionFacilityByLtcAndDscr({
  landCost,
  constructionCost,
  maxDebtFraction,
  annualRate,
  constructionYears,
  termTenorYears,
  annualNoi,
  minDscrThreshold,
  termOptions = {},
}) {
  [
    ['maxDebtFraction', maxDebtFraction], ['minDscrThreshold', minDscrThreshold],
    ['termTenorYears', termTenorYears],
  ].forEach(([name, value]) => requireFinite(name, value));
  if (maxDebtFraction < 0 || maxDebtFraction > 1) throw new RangeError('maxDebtFraction must be between 0 and 1');
  if (minDscrThreshold <= 0) throw new RangeError('minDscrThreshold must be > 0');
  normalizeTenorMonths(termTenorYears);

  const sizingNoi = extendAnnualNoi(annualNoi, termTenorYears);
  if (sizingNoi.length === 0 || sizingNoi.some((noi) => !Number.isFinite(noi) || noi <= 0)) {
    const facility = simulateConstructionFacility({ landCost, constructionCost, debtFraction: 0, annualRate, constructionYears });
    return {
      maxDebtFraction,
      debtFraction: 0,
      bindingConstraint: 'DSCR',
      dscrAtDebtFraction: null,
      facility,
      termPlan: buildMonthlyDebtPlan(0, annualRate, termTenorYears, termOptions),
    };
  }

  const evaluate = (debtFraction) => {
    const facility = simulateConstructionFacility({ landCost, constructionCost, debtFraction, annualRate, constructionYears });
    const termPlan = buildMonthlyDebtPlan(facility.completionBalance, annualRate, termTenorYears, termOptions);
    const dscr = minimumDscr(sizingNoi, termPlan.annualDebtService);
    return { facility, termPlan, dscr };
  };

  const maxEval = evaluate(maxDebtFraction);
  if (maxEval.dscr !== null && maxEval.dscr >= minDscrThreshold) {
    return {
      maxDebtFraction,
      debtFraction: maxDebtFraction,
      bindingConstraint: 'LTC',
      dscrAtDebtFraction: maxEval.dscr,
      facility: maxEval.facility,
      termPlan: maxEval.termPlan,
    };
  }

  let lo = 0;
  let hi = maxDebtFraction;
  let best = 0;
  let bestEval = evaluate(0);
  for (let i = 0; i < 70; i += 1) {
    const mid = (lo + hi) / 2;
    const current = evaluate(mid);
    if (current.dscr !== null && current.dscr >= minDscrThreshold) {
      best = mid;
      bestEval = current;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return {
    maxDebtFraction,
    debtFraction: best,
    bindingConstraint: 'DSCR',
    dscrAtDebtFraction: bestEval.dscr,
    facility: bestEval.facility,
    termPlan: bestEval.termPlan,
  };
}

module.exports = {
  normalizeConstructionMonths,
  simulateConstructionFacility,
  buildAnnualConstructionDebtDraws,
  extendAnnualNoi,
  sizeConstructionFacilityByLtcAndDscr,
};

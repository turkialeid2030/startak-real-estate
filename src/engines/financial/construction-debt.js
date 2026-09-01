'use strict';

const { buildMonthlyDebtPlan, minimumDscr, normalizeTenorMonths } = require('./monthly-debt');
const {
  RATE_SCALE,
  toMoney,
  fromMoney,
  toRate,
  fromRate,
  rateDivInt,
  roundDiv,
  moneyMulRate,
  allocateMoney,
} = require('./precision');

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
  const monthlyRate = rateDivInt(annualRate, 12);
  const landDebtDraw = moneyMulRate(landCost, debtFraction);
  const constructionDebtPrincipal = moneyMulRate(constructionCost, debtFraction);
  const monthlyDraws = allocateMoney(constructionDebtPrincipal, constructionMonths);
  const monthlyConstructionDraw = constructionDebtPrincipal / constructionMonths;
  let balance = toMoney(landDebtDraw);
  let capitalizedInterest = 0n;
  const schedule = [];

  for (let month = 1; month <= constructionMonths; month += 1) {
    const draw = toMoney(monthlyDraws[month - 1]);
    balance += draw;
    const interest = roundDiv(balance * monthlyRate, RATE_SCALE);
    balance += interest;
    capitalizedInterest += interest;
    schedule.push({
      month,
      constructionDebtDraw: fromMoney(draw),
      capitalizedInterest: fromMoney(interest),
      balance: fromMoney(balance),
    });
  }

  const principalDebtDraws = fromMoney(toMoney(landDebtDraw) + toMoney(constructionDebtPrincipal));
  return {
    precisionMode: 'FIXED_POINT_HALALA_RATE_1E12',
    constructionMonths,
    landDebtDraw,
    constructionDebtPrincipal,
    monthlyConstructionDraw,
    principalDebtDraws,
    capitalizedInterest: fromMoney(capitalizedInterest),
    completionBalance: fromMoney(balance),
    schedule,
  };
}

function buildAnnualConstructionDebtDraws(facility) {
  const annual = [];
  for (const row of facility.schedule) {
    const year = Math.ceil(row.month / 12);
    if (!annual[year - 1]) {
      annual[year - 1] = {
        year,
        debtDrawMoney: 0n,
        capitalizedInterestMoney: 0n,
        endingBalance: row.balance,
      };
    }
    annual[year - 1].debtDrawMoney += toMoney(row.constructionDebtDraw);
    annual[year - 1].capitalizedInterestMoney += toMoney(row.capitalizedInterest);
    annual[year - 1].endingBalance = row.balance;
  }
  return annual.map((row) => ({
    year: row.year,
    debtDraw: fromMoney(row.debtDrawMoney),
    capitalizedInterest: fromMoney(row.capitalizedInterestMoney),
    endingBalance: fromMoney(toMoney(row.endingBalance)),
  }));
}

function extendAnnualNoi(annualNoi, tenorYears) {
  if (!Array.isArray(annualNoi) || annualNoi.length === 0) return [];
  const years = Math.max(1, Math.ceil(tenorYears));
  const out = annualNoi.slice(0, years).map((noi) => fromMoney(toMoney(noi)));
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
    const normalizedFraction = fromRate(toRate(debtFraction));
    const facility = simulateConstructionFacility({ landCost, constructionCost, debtFraction: normalizedFraction, annualRate, constructionYears });
    const termPlan = buildMonthlyDebtPlan(facility.completionBalance, annualRate, termTenorYears, termOptions);
    const dscr = minimumDscr(sizingNoi, termPlan.annualDebtService);
    return { debtFraction: normalizedFraction, facility, termPlan, dscr };
  };

  const maxEval = evaluate(maxDebtFraction);
  if (maxEval.dscr !== null && maxEval.dscr >= minDscrThreshold) {
    return {
      maxDebtFraction,
      debtFraction: maxEval.debtFraction,
      bindingConstraint: 'LTC',
      dscrAtDebtFraction: maxEval.dscr,
      facility: maxEval.facility,
      termPlan: maxEval.termPlan,
    };
  }

  let lo = 0n;
  let hi = toRate(maxDebtFraction);
  let best = 0n;
  let bestEval = evaluate(0);
  while (lo <= hi) {
    const mid = (lo + hi) / 2n;
    const current = evaluate(fromRate(mid));
    if (current.dscr !== null && current.dscr >= minDscrThreshold) {
      best = mid;
      bestEval = current;
      lo = mid + 1n;
    } else {
      hi = mid - 1n;
    }
  }

  return {
    maxDebtFraction,
    debtFraction: fromRate(best),
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

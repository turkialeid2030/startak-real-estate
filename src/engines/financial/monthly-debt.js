'use strict';

// Financial Engine Remediation Wave B + Precision C1.
// Production debt cash flows are calculated in integer halalas with fixed-point
// rates. Public inputs/outputs remain Number for API compatibility.
const {
  RATE_SCALE,
  toMoney,
  fromMoney,
  toRate,
  rateDivInt,
  roundDiv,
  moneyMulRate,
  fixedPointAnnuityPayment,
} = require('./precision');

function requireFinite(name, value) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
}

function normalizeTenorMonths(tenorYears) {
  requireFinite('tenorYears', tenorYears);
  if (tenorYears <= 0) throw new RangeError('tenorYears must be > 0');
  const months = Math.round(tenorYears * 12);
  if (months < 1) throw new RangeError('tenorYears resolves to less than one month');
  return months;
}

function classifyFinancingModel(label) {
  const value = String(label || '').trim();
  if (value.includes('مرابحة') || /murabaha/i.test(value)) {
    return {
      modelType: 'MURABAHA_RATE_PROXY_MONTHLY',
      exactContractModel: false,
      boundary: 'Indicative rate-based proxy only; exact Murabaha sale-price, profit, fees and payment terms require the executed term sheet.',
    };
  }
  if (value.includes('إجارة') || /ijara/i.test(value)) {
    return {
      modelType: 'IJARA_RATE_PROXY_MONTHLY',
      exactContractModel: false,
      boundary: 'Indicative rate-based proxy only; exact Ijarah rental, ownership-transfer and fee terms require the executed term sheet.',
    };
  }
  return {
    modelType: 'AMORTIZING_DEBT_MONTHLY',
    exactContractModel: false,
    boundary: 'Generic monthly amortizing debt model; lender-specific fees, covenants and repricing require the executed term sheet.',
  };
}

function monthlyAmortizationSchedule(principal, annualRate, tenorYears, options = {}) {
  requireFinite('principal', principal);
  requireFinite('annualRate', annualRate);
  if (principal < 0) throw new RangeError('principal must be >= 0');
  if (annualRate < 0) throw new RangeError('annualRate must be >= 0');

  const months = normalizeTenorMonths(tenorYears);
  const graceMonths = options.gracePeriodMonths == null ? 0 : options.gracePeriodMonths;
  if (!Number.isInteger(graceMonths) || graceMonths < 0 || graceMonths >= months) {
    throw new RangeError('gracePeriodMonths must be an integer from 0 to tenorMonths-1');
  }
  const graceType = options.graceType || 'INTEREST_ONLY';
  if (!['INTEREST_ONLY', 'CAPITALIZED'].includes(graceType)) {
    throw new RangeError('graceType must be INTEREST_ONLY or CAPITALIZED');
  }
  const balloonPct = options.balloonPct == null ? 0 : options.balloonPct;
  requireFinite('balloonPct', balloonPct);
  if (balloonPct < 0 || balloonPct > 1) throw new RangeError('balloonPct must be between 0 and 1');

  const principalMoney = toMoney(principal);
  if (principalMoney === 0n) {
    return {
      precisionMode: 'FIXED_POINT_HALALA_RATE_1E12',
      tenorMonths: months,
      scheduledMonthlyPayment: 0,
      schedule: [],
      totalInterest: 0,
      totalPayments: 0,
      balloonAmount: 0,
    };
  }

  const monthlyRate = rateDivInt(annualRate, 12);
  const balloonTarget = roundDiv(principalMoney * toRate(balloonPct), RATE_SCALE);
  let balance = principalMoney;
  const schedule = [];
  let totalInterest = 0n;
  let totalPayments = 0n;

  for (let month = 1; month <= graceMonths; month += 1) {
    const interest = roundDiv(balance * monthlyRate, RATE_SCALE);
    let totalPayment = 0n;
    if (graceType === 'INTEREST_ONLY') {
      totalPayment = interest;
    } else {
      balance += interest;
    }
    totalInterest += interest;
    totalPayments += totalPayment;
    schedule.push({
      month,
      phase: 'GRACE',
      scheduledPayment: fromMoney(totalPayment),
      totalPayment: fromMoney(totalPayment),
      interest: fromMoney(interest),
      principal: 0,
      balloon: 0,
      balance: fromMoney(balance),
    });
  }

  const amortizingMonths = months - graceMonths;
  const scheduledMonthlyPaymentNumber = Math.max(0, fixedPointAnnuityPayment({
    balance: fromMoney(balance),
    annualRate,
    months: amortizingMonths,
    balloon: fromMoney(balloonTarget),
  }));
  const scheduledMonthlyPayment = toMoney(scheduledMonthlyPaymentNumber);

  for (let i = 1; i <= amortizingMonths; i += 1) {
    const month = graceMonths + i;
    const interest = roundDiv(balance * monthlyRate, RATE_SCALE);
    let principalPortion = scheduledMonthlyPayment > interest ? scheduledMonthlyPayment - interest : 0n;
    const availablePrincipal = balance > balloonTarget ? balance - balloonTarget : 0n;
    if (principalPortion > availablePrincipal) principalPortion = availablePrincipal;
    const isFinal = i === amortizingMonths;

    balance -= principalPortion;
    let balloon = 0n;
    let totalPayment;
    let phase = 'AMORTIZING';
    if (isFinal) {
      phase = 'MATURITY';
      balloon = balance;
      totalPayment = interest + principalPortion + balloon;
      balance = 0n;
    } else {
      totalPayment = interest + principalPortion;
    }

    totalInterest += interest;
    totalPayments += totalPayment;
    schedule.push({
      month,
      phase,
      scheduledPayment: fromMoney(interest + principalPortion),
      totalPayment: fromMoney(totalPayment),
      interest: fromMoney(interest),
      principal: fromMoney(principalPortion),
      balloon: fromMoney(balloon),
      balance: fromMoney(balance),
    });
  }

  return {
    precisionMode: 'FIXED_POINT_HALALA_RATE_1E12',
    tenorMonths: months,
    scheduledMonthlyPayment: fromMoney(scheduledMonthlyPayment),
    schedule,
    totalInterest: fromMoney(totalInterest),
    totalPayments: fromMoney(totalPayments),
    balloonAmount: fromMoney(balloonTarget),
  };
}

function annualizeMonthlySchedule(monthlySchedule) {
  const annual = [];
  for (const row of monthlySchedule) {
    const year = Math.ceil(row.month / 12);
    if (!annual[year - 1]) {
      annual[year - 1] = {
        year,
        paymentMoney: 0n,
        interestMoney: 0n,
        principalMoney: 0n,
        balloonMoney: 0n,
        balance: row.balance,
      };
    }
    const out = annual[year - 1];
    out.paymentMoney += toMoney(row.totalPayment);
    out.interestMoney += toMoney(row.interest);
    out.principalMoney += toMoney(row.principal);
    out.balloonMoney += toMoney(row.balloon);
    out.balance = row.balance;
  }
  return annual.map((row) => ({
    year: row.year,
    payment: fromMoney(row.paymentMoney),
    interest: fromMoney(row.interestMoney),
    principal: fromMoney(row.principalMoney),
    balloon: fromMoney(row.balloonMoney),
    balance: fromMoney(toMoney(row.balance)),
  }));
}

function minimumDscr(annualNoi, annualDebtService) {
  let min = Infinity;
  let evaluated = 0;
  const count = Math.min(annualNoi.length, annualDebtService.length);
  for (let i = 0; i < count; i += 1) {
    const ds = fromMoney(toMoney(annualDebtService[i] || 0));
    if (ds <= 0) continue;
    const noi = annualNoi[i];
    if (!Number.isFinite(noi)) return null;
    const normalizedNoi = fromMoney(toMoney(noi));
    min = Math.min(min, normalizedNoi / ds);
    evaluated += 1;
  }
  return evaluated === 0 ? null : min;
}

function buildMonthlyDebtPlan(principal, annualRate, tenorYears, options = {}) {
  const monthly = monthlyAmortizationSchedule(principal, annualRate, tenorYears, options);
  const annualSchedule = annualizeMonthlySchedule(monthly.schedule);
  return {
    ...monthly,
    annualSchedule,
    annualDebtService: annualSchedule.map((row) => row.payment),
  };
}

function sizeDebtByLtvAndDscr({
  costBase,
  ltv,
  annualNoi,
  minDscrThreshold,
  annualRate,
  tenorYears,
  options = {},
}) {
  [
    ['costBase', costBase], ['ltv', ltv], ['minDscrThreshold', minDscrThreshold],
    ['annualRate', annualRate], ['tenorYears', tenorYears],
  ].forEach(([name, value]) => requireFinite(name, value));
  if (costBase < 0) throw new RangeError('costBase must be >= 0');
  if (ltv < 0 || ltv > 1) throw new RangeError('ltv must be between 0 and 1');
  if (minDscrThreshold <= 0) throw new RangeError('minDscrThreshold must be > 0');
  if (!Array.isArray(annualNoi) || annualNoi.length === 0) throw new RangeError('annualNoi must be a non-empty array');

  const ltvLimit = moneyMulRate(costBase, ltv);
  if (ltvLimit <= 0 || annualNoi.some((noi) => !Number.isFinite(noi) || noi <= 0)) {
    return {
      ltvLimit,
      dscrLimit: 0,
      loanAmount: 0,
      bindingConstraint: 'DSCR',
      dscrAtLoanAmount: null,
      plan: buildMonthlyDebtPlan(0, annualRate, tenorYears, options),
    };
  }

  const evaluate = (principal) => {
    const normalizedPrincipal = fromMoney(toMoney(principal));
    const plan = buildMonthlyDebtPlan(normalizedPrincipal, annualRate, tenorYears, options);
    const dscr = minimumDscr(annualNoi, plan.annualDebtService);
    return { principal: normalizedPrincipal, plan, dscr };
  };

  const atLtv = evaluate(ltvLimit);
  if (atLtv.dscr !== null && atLtv.dscr >= minDscrThreshold) {
    return {
      ltvLimit,
      dscrLimit: ltvLimit,
      loanAmount: ltvLimit,
      bindingConstraint: 'LTV',
      dscrAtLoanAmount: atLtv.dscr,
      plan: atLtv.plan,
    };
  }

  let lo = 0n;
  let hi = toMoney(ltvLimit);
  let best = 0n;
  let bestEval = evaluate(0);
  while (lo <= hi) {
    const mid = (lo + hi) / 2n;
    const current = evaluate(fromMoney(mid));
    if (current.dscr !== null && current.dscr >= minDscrThreshold) {
      best = mid;
      bestEval = current;
      lo = mid + 1n;
    } else {
      hi = mid - 1n;
    }
  }

  const dscrLimit = fromMoney(best);
  return {
    ltvLimit,
    dscrLimit,
    loanAmount: dscrLimit,
    bindingConstraint: 'DSCR',
    dscrAtLoanAmount: bestEval.dscr,
    plan: bestEval.plan,
  };
}

module.exports = {
  normalizeTenorMonths,
  classifyFinancingModel,
  monthlyAmortizationSchedule,
  annualizeMonthlySchedule,
  minimumDscr,
  buildMonthlyDebtPlan,
  sizeDebtByLtvAndDscr,
};

'use strict';

// Financial Engine Remediation Wave B.
// Deterministic monthly debt mechanics. This module does not claim to reproduce
// a bank term sheet or a Sharia board-approved structure. Murabaha/Ijarah labels
// are classified as indicative rate-based proxies unless exact contract cash
// flows are supplied by a caller in a future adapter.

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

  if (principal === 0) {
    return {
      tenorMonths: months,
      scheduledMonthlyPayment: 0,
      schedule: [],
      totalInterest: 0,
      totalPayments: 0,
      balloonAmount: 0,
    };
  }

  const monthlyRate = annualRate / 12;
  let balance = principal;
  const schedule = [];
  let totalInterest = 0;
  let totalPayments = 0;

  for (let month = 1; month <= graceMonths; month += 1) {
    const interest = balance * monthlyRate;
    let totalPayment = 0;
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
      scheduledPayment: totalPayment,
      totalPayment,
      interest,
      principal: 0,
      balloon: 0,
      balance,
    });
  }

  const amortizingMonths = months - graceMonths;
  const balloonTarget = principal * balloonPct;
  let scheduledMonthlyPayment;
  if (monthlyRate === 0) {
    scheduledMonthlyPayment = Math.max(0, (balance - balloonTarget) / amortizingMonths);
  } else {
    const pvBalloon = balloonTarget / Math.pow(1 + monthlyRate, amortizingMonths);
    scheduledMonthlyPayment = Math.max(
      0,
      ((balance - pvBalloon) * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -amortizingMonths)),
    );
  }

  for (let i = 1; i <= amortizingMonths; i += 1) {
    const month = graceMonths + i;
    const interest = balance * monthlyRate;
    let principalPortion = Math.max(0, scheduledMonthlyPayment - interest);
    const isFinal = i === amortizingMonths;

    if (!isFinal) {
      principalPortion = Math.min(principalPortion, Math.max(0, balance - balloonTarget));
      balance = Math.max(balloonTarget, balance - principalPortion);
      const totalPayment = interest + principalPortion;
      totalInterest += interest;
      totalPayments += totalPayment;
      schedule.push({
        month,
        phase: 'AMORTIZING',
        scheduledPayment: totalPayment,
        totalPayment,
        interest,
        principal: principalPortion,
        balloon: 0,
        balance,
      });
      continue;
    }

    principalPortion = Math.min(principalPortion, Math.max(0, balance - balloonTarget));
    balance = Math.max(balloonTarget, balance - principalPortion);
    const balloon = balance;
    const totalPayment = interest + principalPortion + balloon;
    totalInterest += interest;
    totalPayments += totalPayment;
    schedule.push({
      month,
      phase: 'MATURITY',
      scheduledPayment: interest + principalPortion,
      totalPayment,
      interest,
      principal: principalPortion,
      balloon,
      balance: 0,
    });
    balance = 0;
  }

  return {
    tenorMonths: months,
    scheduledMonthlyPayment,
    schedule,
    totalInterest,
    totalPayments,
    balloonAmount: balloonTarget,
  };
}

function annualizeMonthlySchedule(monthlySchedule) {
  const annual = [];
  for (const row of monthlySchedule) {
    const year = Math.ceil(row.month / 12);
    if (!annual[year - 1]) {
      annual[year - 1] = { year, payment: 0, interest: 0, principal: 0, balloon: 0, balance: row.balance };
    }
    const out = annual[year - 1];
    out.payment += row.totalPayment;
    out.interest += row.interest;
    out.principal += row.principal;
    out.balloon += row.balloon;
    out.balance = row.balance;
  }
  return annual;
}

function minimumDscr(annualNoi, annualDebtService) {
  let min = Infinity;
  let evaluated = 0;
  const count = Math.min(annualNoi.length, annualDebtService.length);
  for (let i = 0; i < count; i += 1) {
    const ds = annualDebtService[i] || 0;
    if (ds <= 0) continue;
    const noi = annualNoi[i];
    if (!Number.isFinite(noi)) return null;
    min = Math.min(min, noi / ds);
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

  const ltvLimit = costBase * ltv;
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
    const plan = buildMonthlyDebtPlan(principal, annualRate, tenorYears, options);
    const dscr = minimumDscr(annualNoi, plan.annualDebtService);
    return { plan, dscr };
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

  let lo = 0;
  let hi = ltvLimit;
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
    ltvLimit,
    dscrLimit: best,
    loanAmount: best,
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

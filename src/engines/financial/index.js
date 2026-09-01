// src/engines/financial/index.js -- canonical financial primitives.
function computeNPV(rate, cashflows) {
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

function computeIRR(cashflows, guess = 0.1) {
  const npvFn = (r) => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
  const dnpvFn = (r) => cashflows.reduce((acc, cf, t) => acc - (t * cf) / Math.pow(1 + r, t + 1), 0);
  let rate = guess;
  let converged = false;
  for (let i = 0; i < 100; i++) {
    const val = npvFn(rate);
    const d = dnpvFn(rate);
    if (Math.abs(d) < 1e-10) break;
    const newRate = rate - val / d;
    if (!isFinite(newRate)) break;
    if (Math.abs(newRate - rate) < 1e-9) { rate = newRate; converged = true; break; }
    rate = newRate;
  }
  if (!converged || !isFinite(rate) || rate < -0.999) {
    let lo = -0.99, hi = 10;
    let nLo = npvFn(lo), nHi = npvFn(hi);
    if (nLo * nHi > 0) return NaN;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const nMid = npvFn(mid);
      if (Math.abs(nMid) < 1e-6) return mid;
      if (nLo * nMid < 0) { hi = mid; nHi = nMid; } else { lo = mid; nLo = nMid; }
    }
    return (lo + hi) / 2;
  }
  return rate;
}

// Retained for frozen/raw-engine compatibility. Production leveraged cases are
// remediated through the monthly financing overlay in src/engines/financing.
function amortizationSchedule(principal, rate, years) {
  const n = Math.max(1, Math.round(years));
  if (principal <= 0) return { payment: 0, schedule: [] };
  const payment = rate === 0 ? principal / n : (principal * rate) / (1 - Math.pow(1 + rate, -n));
  let balance = principal;
  const schedule = [];
  for (let y = 1; y <= n; y++) {
    const interest = balance * rate;
    const principalPortion = Math.min(balance, payment - interest);
    balance = Math.max(0, balance - principalPortion);
    schedule.push({ year: y, payment, interest, principal: principalPortion, balance });
  }
  return { payment, schedule };
}

const monthlyDebt = require('./monthly-debt');
const constructionDebt = require('./construction-debt');

module.exports = {
  computeNPV,
  computeIRR,
  amortizationSchedule,
  ...monthlyDebt,
  ...constructionDebt,
};

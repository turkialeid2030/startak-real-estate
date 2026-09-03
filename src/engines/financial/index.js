'use strict';

// src/engines/financial/index.js -- canonical financial primitives.
// Precision C1 routes NPV and IRR through fixed-point money/rate arithmetic.
const precision = require('./precision');

function computeNPV(rate, cashflows) {
  return precision.preciseNPV(rate, cashflows);
}

function computeIRR(cashflows) {
  return precision.preciseIRR(cashflows);
}

// Retained for frozen/raw-engine compatibility. Production leveraged cases are
// remediated through the monthly financing overlay in src/engines/financing.
// This annual schedule remains a compatibility path and is not the production
// financing model introduced in Wave B.
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
const irrDiagnostics = require('./irr-diagnostics');
const constructionDebt = require('./construction-debt');

module.exports = {
  computeNPV,
  computeIRR,
  amortizationSchedule,
  precision,
  ...irrDiagnostics,
  ...monthlyDebt,
  ...constructionDebt,
};

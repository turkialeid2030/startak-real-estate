'use strict';

// src/engines/financial/index.js -- canonical financial primitives.
// Precision C1 routes NPV and IRR through fixed-point money/rate arithmetic.
const precision = require('./precision');
const irrDiagnostics = require('./irr-diagnostics');
const { requireFiniteIntermediate, requireFiniteArray } = require('../../validation/numeric-safety');

function computeNPV(rate, cashflows) {
  requireFiniteIntermediate('npvRate', rate);
  requireFiniteArray('npvCashflows', cashflows);
  const result = precision.preciseNPV(rate, cashflows);
  return requireFiniteIntermediate('npv', result);
}

function computeIRR(cashflows) {
  requireFiniteArray('irrCashflows', cashflows);

  // A NaN IRR is not always numeric corruption. The existing diagnostic
  // contract explicitly distinguishes the mathematically legitimate no-root
  // case (no cash-flow sign change) from solver/non-finite failures. Preserve
  // that semantic distinction rather than treating every NaN result alike.
  const diagnostic = irrDiagnostics.analyzeIRR(cashflows);
  if (
    diagnostic.reliability === irrDiagnostics.IRR_RELIABILITY.NOT_COMPUTABLE
    && diagnostic.reasonCode === 'NO_SIGN_CHANGE_NO_IRR_EXISTS'
  ) {
    return diagnostic.irr;
  }

  if (diagnostic.irr === null || diagnostic.irr === undefined) return diagnostic.irr;
  return requireFiniteIntermediate('irr', diagnostic.irr);
}

// Retained for frozen/raw-engine compatibility. Production leveraged cases are
// remediated through the monthly financing overlay in src/engines/financing.
// This annual schedule remains a compatibility path and is not the production
// financing model introduced in Wave B.
function amortizationSchedule(principal, rate, years) {
  const n = Math.max(1, Math.round(years));
  if (principal <= 0) return { payment: 0, schedule: [] };
  const payment = rate === 0 ? principal / n : (principal * rate) / (1 - Math.pow(1 + rate, -n));
  requireFiniteIntermediate('amortizationPayment', payment);
  let balance = principal;
  const schedule = [];
  for (let y = 1; y <= n; y++) {
    const interest = balance * rate;
    const principalPortion = Math.min(balance, payment - interest);
    balance = Math.max(0, balance - principalPortion);
    requireFiniteIntermediate(`amortizationInterest[${y}]`, interest);
    requireFiniteIntermediate(`amortizationPrincipal[${y}]`, principalPortion);
    requireFiniteIntermediate(`amortizationBalance[${y}]`, balance);
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
  precision,
  ...irrDiagnostics,
  ...monthlyDebt,
  ...constructionDebt,
};

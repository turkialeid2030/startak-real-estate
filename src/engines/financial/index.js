'use strict';

// src/engines/financial/index.js -- canonical financial primitives.
// Precision C1 routes NPV and IRR through fixed-point money/rate arithmetic.
const precision = require('./precision');
const irrDiagnostics = require('./irr-diagnostics');
const financialIntegrity = require('./financial-integrity');
const formulaRegistry = require('./formula-registry');
const { requireFiniteIntermediate, requireFiniteArray } = require('../../validation/numeric-safety');

function computeNPV(rate, cashflows) {
  requireFiniteIntermediate('npvRate', rate);
  requireFiniteArray('npvCashflows', cashflows);
  const result = precision.preciseNPV(rate, cashflows);
  return requireFiniteIntermediate('npv', result);
}

function computeIRR(cashflows) {
  requireFiniteArray('irrCashflows', cashflows);

  // The diagnostic layer owns the semantic distinction between a reliable IRR
  // and legitimate non-computable/non-unique solver outcomes. Because the
  // cash-flow array has already passed the canonical finite-number guard above,
  // a diagnostic NaN here is not input-number corruption: it is governed model
  // state (for example no root, a root outside the bounded solver bracket, or a
  // non-conventional stream whose selected IRR cannot be represented reliably).
  // Returning that governed state keeps hard decision gates fail-closed without
  // converting a mathematically valid "IRR unavailable" condition into a runtime
  // exception. This also removes Node-runtime sensitivity at extreme brackets.
  const diagnostic = irrDiagnostics.analyzeIRR(cashflows);
  if (diagnostic.irr === null || diagnostic.irr === undefined) return diagnostic.irr;

  if (diagnostic.reliability !== irrDiagnostics.IRR_RELIABILITY.RELIABLE) {
    return diagnostic.irr;
  }

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
  ...financialIntegrity,
  ...formulaRegistry,
};

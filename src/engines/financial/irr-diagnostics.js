'use strict';

const precision = require('./precision');

const IRR_RELIABILITY = Object.freeze({
  RELIABLE: 'RELIABLE',
  NOT_COMPUTABLE: 'NOT_COMPUTABLE',
  MULTIPLE_ROOT_RISK: 'MULTIPLE_ROOT_RISK',
  OUT_OF_SOLVER_RANGE: 'OUT_OF_SOLVER_RANGE',
});

function finiteNumbers(cashflows) {
  return Array.isArray(cashflows) && cashflows.length >= 2
    && cashflows.every((value) => Number.isFinite(value));
}

function countSignChanges(cashflows) {
  if (!Array.isArray(cashflows)) return 0;
  let changes = 0;
  let previousSign = 0;
  for (const value of cashflows) {
    if (!Number.isFinite(value) || value === 0) continue;
    const sign = value > 0 ? 1 : -1;
    if (previousSign !== 0 && sign !== previousSign) changes += 1;
    previousSign = sign;
  }
  return changes;
}

function computeMIRR(cashflows, { financeRate, reinvestRate } = {}) {
  if (!finiteNumbers(cashflows)) return NaN;
  const fRate = Number.isFinite(financeRate) ? financeRate : 0;
  const rRate = Number.isFinite(reinvestRate) ? reinvestRate : fRate;
  if (fRate <= -1 || rRate <= -1) return NaN;
  const n = cashflows.length - 1;
  if (n < 1) return NaN;

  let pvNegative = 0;
  let fvPositive = 0;
  for (let t = 0; t <= n; t += 1) {
    const flow = cashflows[t];
    if (flow < 0) pvNegative += flow / Math.pow(1 + fRate, t);
    else if (flow > 0) fvPositive += flow * Math.pow(1 + rRate, n - t);
  }
  if (pvNegative === 0 || fvPositive <= 0) return NaN;
  const ratio = fvPositive / -pvNegative;
  if (!Number.isFinite(ratio) || ratio <= 0) return NaN;
  return Math.pow(ratio, 1 / n) - 1;
}

function analyzeIRR(cashflows, { financeRate, reinvestRate } = {}) {
  const signChanges = countSignChanges(cashflows);
  const mirr = computeMIRR(cashflows, { financeRate, reinvestRate });

  if (!finiteNumbers(cashflows) || signChanges === 0) {
    return Object.freeze({
      schemaVersion: 1,
      irr: NaN,
      mirr: Number.isFinite(mirr) ? mirr : NaN,
      signChanges,
      multipleRootRisk: false,
      reliability: IRR_RELIABILITY.NOT_COMPUTABLE,
      presentationMetric: null,
      reasonCode: signChanges === 0 ? 'NO_SIGN_CHANGE_NO_IRR_EXISTS' : 'NON_FINITE_CASHFLOWS',
    });
  }

  let irr;
  try { irr = precision.preciseIRR(cashflows); } catch (_) { irr = NaN; }
  const multipleRootRisk = signChanges > 1;

  if (multipleRootRisk) {
    return Object.freeze({
      schemaVersion: 1,
      irr: Number.isFinite(irr) ? irr : NaN,
      mirr,
      signChanges,
      multipleRootRisk: true,
      reliability: IRR_RELIABILITY.MULTIPLE_ROOT_RISK,
      presentationMetric: Number.isFinite(mirr) ? 'MIRR' : null,
      reasonCode: 'NON_CONVENTIONAL_CASHFLOW_MULTIPLE_IRR_POSSIBLE',
    });
  }

  if (!Number.isFinite(irr)) {
    return Object.freeze({
      schemaVersion: 1,
      irr: NaN,
      mirr,
      signChanges,
      multipleRootRisk: false,
      reliability: IRR_RELIABILITY.OUT_OF_SOLVER_RANGE,
      presentationMetric: Number.isFinite(mirr) ? 'MIRR' : null,
      reasonCode: 'IRR_OUTSIDE_SOLVER_BRACKET',
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    irr,
    mirr,
    signChanges,
    multipleRootRisk: false,
    reliability: IRR_RELIABILITY.RELIABLE,
    presentationMetric: 'IRR',
    reasonCode: null,
  });
}

module.exports = { IRR_RELIABILITY, countSignChanges, computeMIRR, analyzeIRR };

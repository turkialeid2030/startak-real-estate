'use strict';
const { computeCumulativePaybackYears } = require('../engines/financial/model-utils');
const finite = x => typeof x === 'number' && Number.isFinite(x) ? x : null;
const flowsValid = x => Array.isArray(x) && x.length > 1 && x.every(n => finite(n) !== null);
function paybackDisclosure(mode, results) {
  const r = results || {};
  const cost = mode === 'building' ? finite(r.totalPurchaseCost) : finite(r.totalProjectCost);
  const firstNoi = mode === 'building' ? finite(r.firstYearNOI) : finite(r.firstOperatingYearNOI);
  const operatingFlows = mode === 'building'
    ? (cost !== null && Array.isArray(r.operatingNoiCashflows) ? [-cost, ...r.operatingNoiCashflows] : null)
    : r.paybackCashflows;
  const horizon = mode === 'building' ? finite(r.paybackHorizonYears) : finite(r.constructionYears + r.operatingYears);
  const value = mode === 'building' ? finite(r.cumulativePaybackOnCost) : finite(r.cumulativeProjectPaybackYears);
  const operatingWithinStudy = flowsValid(operatingFlows) ? computeCumulativePaybackYears(operatingFlows) : null;
  // Terminal sale is a discrete end-of-year event, not a fraction of annual NOI.
  // When recovery depends on sale, report the actual sale year (no interpolation).
  let recoveryWithSale = operatingWithinStudy;
  const saleModeled = r.cashflowsIncludeTerminalValue === true
    || (mode === 'land' && finite(r.terminalNetExitValue) !== null);
  if (recoveryWithSale === null && flowsValid(r.cashflows) && saleModeled) {
    let cumulative = r.cashflows[0];
    for (let y = 1; y < r.cashflows.length; y += 1) {
      cumulative += r.cashflows[y];
      if (cumulative >= 0) { recoveryWithSale = y; break; }
    }
  }
  return Object.freeze({
    simpleCostOverFirstOperatingNoiYears: cost !== null && firstNoi > 0 ? cost / firstNoi : null,
    engineCumulativeOperatingYears: value,
    engineOperatingHorizonYears: horizon,
    studyHorizonYears: flowsValid(operatingFlows) ? operatingFlows.length - 1 : null,
    cumulativeOperatingWithinStudyYears: operatingWithinStudy,
    cumulativeWithTerminalSaleYears: recoveryWithSale,
    enginePaybackIncludesTerminalSale: false,
    terminalSaleAtEndOfYear: true,
  });
}
module.exports = { paybackDisclosure };

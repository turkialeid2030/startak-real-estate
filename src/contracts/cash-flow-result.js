// src/contracts/cash-flow-result.js -- maps ACTUAL cash-flow array shapes.
// No aggregation formula -- pure structural description of the two array fields.
const CASH_FLOW_RESULT_FIELDS = Object.freeze({
  cashflows: {
    present: 'BOTH', type: 'number[]',
    note_existing_building: 't0=-totalPurchaseCost, t1..t(holdPeriod-1)=NOI, t(holdPeriod)=NOI+netSaleProceeds (length = holdPeriod+1)',
    note_land_development: 't0=-totalLandAcquisitionCost, t1..t(constructionYears)=-perYearConstructionDraw, then operating years NOI with exit in final year (length = 1+constructionYears+operatingYears)',
  },
  leveredCashflows: {
    present: 'BOTH_WHEN_LEVERED', type: 'number[]',
    note: 'same period structure as cashflows, but t0=-equityRequired and each period nets out debtService (and remaining loan balance in the final period)',
  },
});
module.exports = { CASH_FLOW_RESULT_FIELDS };

'use strict';

const CASH_FLOW_RESULT_FIELDS = Object.freeze({
  cashflows: {
    present: 'BOTH', type: 'number[]',
    note_existing_building: 't0=-totalPurchaseCost; operating years use year-specific NOI; final period adds net terminal sale proceeds based on stabilized forward NOI and exit cap.',
    note_land_development: 't0=-land acquisition; construction draws follow; operating years use year-specific NOI; final period adds net exit value.',
  },
  operatingNoiCashflows: {
    present: 'BOTH', type: 'number[]',
    note: 'unlevered operating NOI sequence before terminal sale proceeds; first operating year may include one-time lease-up.',
  },
  paybackCashflows: {
    present: 'LAND_DEVELOPMENT_ONLY', type: 'number[]',
    note: 'cash-flow sequence used for cumulative project payback; excludes terminal sale proceeds.',
  },
  leveredCashflows: {
    present: 'BOTH_WHEN_LEVERED', type: 'number[]',
    note: 'same project period structure but after debt service and remaining-balance repayment; financing model remains annual until Wave B.',
  },
});
module.exports = { CASH_FLOW_RESULT_FIELDS };

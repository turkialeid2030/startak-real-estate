'use strict';

module.exports = {
  ...require('./contracts'),
  ...require('./market-comparables'),
  ...require('./income-capitalization'),
  ...require('./cost-approach'),
  ...require('./residual-approach'),
  ...require('./reconciliation'),
  ...require('./planner'),
  ...require('./evidence-quality'),
  ...require('./reason-codes'),
  ...require('./valuation-request'),
  ...require('./orchestrator'),
  ...require('./adapters/industrial-logistics'),
};

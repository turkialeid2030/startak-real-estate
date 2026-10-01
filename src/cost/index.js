'use strict';

const costApproachInputs = require('./cost-approach-inputs');
const governedRegulatoryCarryCost = require('./governed-regulatory-carry-cost');

module.exports = Object.assign({}, costApproachInputs, governedRegulatoryCarryCost, {
  costApproachInputs,
  governedRegulatoryCarryCost,
});

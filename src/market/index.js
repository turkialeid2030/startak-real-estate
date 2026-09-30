'use strict';

const comparableEvidence = require('./comparable-evidence');
const comparableAdjustments = require('./comparable-adjustments');
const leaseIncomeEvidence = require('./lease-income-evidence');
const governedMarketInterpretation = require('./governed-market-interpretation');

module.exports = Object.assign({}, comparableEvidence, comparableAdjustments, leaseIncomeEvidence, governedMarketInterpretation, {
  comparableEvidence,
  comparableAdjustments,
  leaseIncomeEvidence,
  governedMarketInterpretation,
});

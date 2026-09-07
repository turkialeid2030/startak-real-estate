'use strict';

const comparableEvidence = require('./comparable-evidence');
const comparableAdjustments = require('./comparable-adjustments');
const leaseIncomeEvidence = require('./lease-income-evidence');

module.exports = Object.assign({}, comparableEvidence, comparableAdjustments, leaseIncomeEvidence, {
  comparableEvidence,
  comparableAdjustments,
  leaseIncomeEvidence,
});

'use strict';

const comparableEvidence = require('./comparable-evidence');
const comparableAdjustments = require('./comparable-adjustments');

module.exports = Object.assign({}, comparableEvidence, comparableAdjustments, {
  comparableEvidence,
  comparableAdjustments,
});

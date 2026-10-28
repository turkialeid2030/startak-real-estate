'use strict';

const comparableEvidence = require('./comparable-evidence');
const comparableAdjustments = require('./comparable-adjustments');
const leaseIncomeEvidence = require('./lease-income-evidence');
const appraisalAssurance = require('./appraisal-assurance');

module.exports = Object.assign({}, comparableEvidence, comparableAdjustments, leaseIncomeEvidence, appraisalAssurance, {
  comparableEvidence,
  comparableAdjustments,
  leaseIncomeEvidence,
  appraisalAssurance,
});

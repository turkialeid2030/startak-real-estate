'use strict';

const contracts = require('./contracts');
const readiness = require('./readiness');
const operatingMetrics = require('./operating-metrics');
const propertyCosts = require('./property-costs');
const incomeAnalysis = require('./income-analysis');
const acquisitionBasis = require('./acquisition-basis');
const reverseUnderwriting = require('./reverse-underwriting');
const exitStrategy = require('./exit-strategy');
const operatingCaseSnapshot = require('./operating-case-snapshot');
const api = require('./api');

module.exports = Object.assign({}, contracts, readiness, operatingMetrics, propertyCosts, incomeAnalysis, acquisitionBasis, reverseUnderwriting, exitStrategy, operatingCaseSnapshot, api, {
  contracts,
  readiness,
  operatingMetrics,
  propertyCosts,
  incomeAnalysis,
  acquisitionBasis,
  reverseUnderwriting,
  exitStrategy,
  operatingCaseSnapshot,
  api,
});

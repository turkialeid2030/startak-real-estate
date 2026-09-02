'use strict';

const contracts = require('./contracts');
const readiness = require('./readiness');
const operatingMetrics = require('./operating-metrics');
const propertyCosts = require('./property-costs');
const incomeAnalysis = require('./income-analysis');
const operatingCaseSnapshot = require('./operating-case-snapshot');
const api = require('./api');

module.exports = Object.assign({}, contracts, readiness, operatingMetrics, propertyCosts, incomeAnalysis, operatingCaseSnapshot, api, {
  contracts,
  readiness,
  operatingMetrics,
  propertyCosts,
  incomeAnalysis,
  operatingCaseSnapshot,
  api,
});

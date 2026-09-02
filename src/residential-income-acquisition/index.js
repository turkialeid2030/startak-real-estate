'use strict';

const contracts = require('./contracts');
const readiness = require('./readiness');
const operatingMetrics = require('./operating-metrics');
const propertyCosts = require('./property-costs');
const api = require('./api');

module.exports = Object.assign({}, contracts, readiness, operatingMetrics, propertyCosts, api, {
  contracts,
  readiness,
  operatingMetrics,
  propertyCosts,
  api,
});

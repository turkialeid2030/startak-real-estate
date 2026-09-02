'use strict';

const contracts = require('./contracts');
const readiness = require('./readiness');
const operatingMetrics = require('./operating-metrics');
const api = require('./api');

module.exports = Object.assign({}, contracts, readiness, operatingMetrics, api, { contracts, readiness, operatingMetrics, api });

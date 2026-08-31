'use strict';

const contracts = require('./contracts');
const pipeline = require('./pipeline');
const reconciliation = require('./reconciliation');
const readiness = require('./readiness');

module.exports = Object.assign({}, contracts, pipeline, reconciliation, readiness);

'use strict';

const contracts = require('./contracts');
const pipeline = require('./pipeline');
const reconciliation = require('./reconciliation');
const readiness = require('./readiness');
const parsers = require('./parsers');

module.exports = Object.assign({}, contracts, pipeline, reconciliation, readiness, parsers, { parsers });

'use strict';

const contracts = require('./contracts');
const pipeline = require('./pipeline');
const reconciliation = require('./reconciliation');
const readiness = require('./readiness');
const parsers = require('./parsers');
const semantics = require('./semantics');

module.exports = Object.assign({}, contracts, pipeline, reconciliation, readiness, parsers, semantics, { parsers, semantics });

'use strict';

const contracts = require('./contracts');
const readiness = require('./readiness');
const api = require('./api');

module.exports = Object.assign({}, contracts, readiness, api, { contracts, readiness, api });

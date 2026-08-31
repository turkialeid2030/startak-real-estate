'use strict';

const registry = require('./registry');
const mapper = require('./mapper');

module.exports = Object.assign({}, registry, mapper);

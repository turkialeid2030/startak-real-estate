'use strict';

const profile = require('./project-profile');
const evidencePlan = require('./evidence-plan');
const engineRouter = require('./engine-router');

module.exports = Object.assign({}, profile, evidencePlan, engineRouter);

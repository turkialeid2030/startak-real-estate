'use strict';

const profile = require('./project-profile');
const evidencePlan = require('./evidence-plan');
const engineRouter = require('./engine-router');
const semanticCoverage = require('./semantic-coverage');
const orchestrator = require('./universal-evidence-orchestrator');
const decisionControl = require('./decision-control-orchestrator');

module.exports = Object.assign({}, profile, evidencePlan, engineRouter, semanticCoverage, orchestrator, decisionControl);

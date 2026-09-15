'use strict';

const inspectionLifecycle = require('./inspection-lifecycle');
const measurementGovernance = require('./measurement-governance');

module.exports = Object.assign({}, inspectionLifecycle, measurementGovernance, {
  inspectionLifecycle,
  measurementGovernance,
});

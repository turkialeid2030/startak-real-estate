'use strict';

const planningEvidence = require('./planning-evidence');
const governedPlotFeasibility = require('./governed-plot-feasibility');

module.exports = Object.assign({}, planningEvidence, governedPlotFeasibility, {
  planningEvidence,
  governedPlotFeasibility,
});
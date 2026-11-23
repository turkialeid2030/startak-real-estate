'use strict';

const planningEvidence = require('./planning-evidence');
const plotEnvelope = require('./guarded-plot-envelope');

module.exports = Object.assign({}, planningEvidence, plotEnvelope, {
  planningEvidence,
});

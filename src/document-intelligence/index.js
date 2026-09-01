'use strict';

const contracts = require('./contracts');
const pipeline = require('./pipeline');
const reconciliation = require('./reconciliation');
const readiness = require('./readiness');
const parsers = require('./parsers');
const semantics = require('./semantics');
const parsedEvidenceQualification = require('./parsed-evidence-qualification');
const evidenceVerificationReadiness = require('./evidence-verification-readiness');
const underwritingInputAdoption = require('./underwriting-input-adoption');
const evidenceToCalculationTraceability = require('./evidence-to-calculation-traceability');

module.exports = Object.assign(
  {},
  contracts,
  pipeline,
  reconciliation,
  readiness,
  parsers,
  semantics,
  parsedEvidenceQualification,
  evidenceVerificationReadiness,
  underwritingInputAdoption,
  evidenceToCalculationTraceability,
  {
    parsers,
    semantics,
    parsedEvidenceQualification,
    evidenceVerificationReadiness,
    underwritingInputAdoption,
    evidenceToCalculationTraceability,
  },
);

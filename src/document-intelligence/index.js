'use strict';

const contracts = require('./contracts');
const pipeline = require('./pipeline');
const reconciliation = require('./reconciliation');
const readiness = require('./readiness');
const parsers = require('./parsers');
const semantics = require('./semantics');
const parsedEvidenceQualification = require('./parsed-evidence-qualification');
const evidenceVerificationReadiness = require('./evidence-verification-readiness');

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
  { parsers, semantics, parsedEvidenceQualification, evidenceVerificationReadiness },
);

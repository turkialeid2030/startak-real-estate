'use strict';

const contracts = require('./contracts');
const readiness = require('./readiness');
const operatingMetrics = require('./operating-metrics');
const collectionsReconciliation = require('./collections-reconciliation');
const propertyCosts = require('./property-costs');
const incomeAnalysis = require('./income-analysis');
const acquisitionBasis = require('./acquisition-basis');
const reverseUnderwriting = require('./reverse-underwriting');
const exitStrategy = require('./exit-strategy');
const lifecycleLocationUpside = require('./lifecycle-location-upside');
const subdivisionGate = require('./subdivision-gate');
const strategicEvidenceGovernance = require('./strategic-evidence-governance');
const decisionLayer = require('./decision-layer');
const aiAssistContract = require('./ai-assist-contract');
const aiAssistClient = require('./ai-assist-client');
const operatingCaseSnapshot = require('./operating-case-snapshot');
const operatingCaseEditor = require('./operating-case-editor');
const api = require('./api');

module.exports = Object.assign({}, contracts, readiness, operatingMetrics, collectionsReconciliation, propertyCosts, incomeAnalysis, acquisitionBasis, reverseUnderwriting, exitStrategy, lifecycleLocationUpside, subdivisionGate, strategicEvidenceGovernance, decisionLayer, aiAssistContract, aiAssistClient, operatingCaseSnapshot, operatingCaseEditor, api, {
  contracts,
  readiness,
  operatingMetrics,
  collectionsReconciliation,
  propertyCosts,
  incomeAnalysis,
  acquisitionBasis,
  reverseUnderwriting,
  exitStrategy,
  lifecycleLocationUpside,
  subdivisionGate,
  strategicEvidenceGovernance,
  decisionLayer,
  aiAssistContract,
  aiAssistClient,
  operatingCaseSnapshot,
  operatingCaseEditor,
  api,
});

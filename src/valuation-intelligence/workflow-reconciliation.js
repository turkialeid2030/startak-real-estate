'use strict';

const {
  RECONCILED_DIRECT_CAP_STATUS,
  calculateReconciledEvidenceBackedDirectCapitalization,
} = require('./reconciled-direct-capitalization');
const {
  GOVERNED_DCF_STATUS,
  calculateGovernedDcf,
} = require('./governed-dcf');

const WORKFLOW_RECONCILIATION_VERSION = 'WORKFLOW_RECONCILIATION_V1';
const WORKFLOW_RECONCILIATION_STATUS = Object.freeze({
  QUALIFIED: 'QUALIFIED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  HOLD: 'HOLD',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizeTransactionCosts(costs = {}) {
  if (!costs || typeof costs !== 'object' || Array.isArray(costs)) throw new TypeError('transactionCosts must be an object');
  const fields = [
    'rettSar',
    'vatSar',
    'brokerageSar',
    'legalSar',
    'dueDiligenceSar',
    'financingSar',
    'otherAcquisitionSar',
    'disposalSar',
  ];
  const normalized = {};
  for (const field of fields) {
    const value = costs[field] === undefined ? 0 : costs[field];
    if (!finiteNonNegative(value)) throw new TypeError(`transactionCosts.${field} must be a finite number >= 0`);
    normalized[field] = value;
  }
  normalized.acquisitionTotalSar = fields
    .filter((field) => field !== 'disposalSar')
    .reduce((sum, field) => sum + normalized[field], 0);
  normalized.totalSar = normalized.acquisitionTotalSar + normalized.disposalSar;
  return normalized;
}

function hold(blockers, directCap, dcf, transactionCosts, warnings = []) {
  return deepFreeze({
    version: WORKFLOW_RECONCILIATION_VERSION,
    status: WORKFLOW_RECONCILIATION_STATUS.HOLD,
    directCap,
    dcf,
    transactionCosts,
    reconciliation: null,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    readyForDecisionControl: false,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    semantics: 'P5 workflow reconciliation keeps transaction costs outside property NOI and does not create an investment approval, transaction authority, lender decision, or certified valuation.',
  });
}

function reconcileGovernedAcquisitionValuation({
  directCapInput,
  dcfInput,
  transactionCosts = {},
  materialVarianceThreshold = null,
} = {}) {
  let costs;
  try {
    costs = normalizeTransactionCosts(transactionCosts);
  } catch (error) {
    return hold([`TRANSACTION_COSTS_INVALID:${error.message}`], null, null, null);
  }

  if (typeof materialVarianceThreshold !== 'number' || !Number.isFinite(materialVarianceThreshold) || materialVarianceThreshold < 0) {
    return hold(['MATERIAL_VARIANCE_THRESHOLD_REQUIRED'], null, null, costs);
  }

  const directCap = calculateReconciledEvidenceBackedDirectCapitalization(directCapInput || {});
  const dcf = calculateGovernedDcf(dcfInput || {});
  const blockers = [];
  const warnings = [];

  if (![RECONCILED_DIRECT_CAP_STATUS.QUALIFIED, RECONCILED_DIRECT_CAP_STATUS.REVIEW_REQUIRED].includes(directCap.status)) {
    blockers.push('DIRECT_CAP_NOT_QUALIFIED', ...(directCap.blockers || []));
  }
  if (![GOVERNED_DCF_STATUS.QUALIFIED, GOVERNED_DCF_STATUS.REVIEW_REQUIRED].includes(dcf.status)) {
    blockers.push('DCF_NOT_QUALIFIED', ...(dcf.blockers || []));
  }
  if (blockers.length) return hold(blockers, directCap, dcf, costs, [...(directCap.warnings || []), ...(dcf.warnings || [])]);

  const directCapValueSar = directCap.valuationIndication.value;
  const dcfValueSar = dcf.valuationIndicationSar;
  const absoluteVarianceSar = Math.abs(directCapValueSar - dcfValueSar);
  const midpointSar = (Math.abs(directCapValueSar) + Math.abs(dcfValueSar)) / 2;
  const percentageVariance = midpointSar > 1e-12 ? absoluteVarianceSar / midpointSar : 0;

  if (directCap.status === RECONCILED_DIRECT_CAP_STATUS.REVIEW_REQUIRED) warnings.push('DIRECT_CAP_REVIEW_REQUIRED');
  if (dcf.status === GOVERNED_DCF_STATUS.REVIEW_REQUIRED) warnings.push('DCF_REVIEW_REQUIRED');
  if (percentageVariance > materialVarianceThreshold) warnings.push('MATERIAL_METHOD_VARIANCE_REVIEW_REQUIRED');

  const status = warnings.length ? WORKFLOW_RECONCILIATION_STATUS.REVIEW_REQUIRED : WORKFLOW_RECONCILIATION_STATUS.QUALIFIED;
  return deepFreeze({
    version: WORKFLOW_RECONCILIATION_VERSION,
    status,
    directCap,
    dcf,
    transactionCosts: costs,
    reconciliation: {
      directCapValueSar,
      dcfValueSar,
      absoluteVarianceSar,
      percentageVariance,
      materialVarianceThreshold,
      withinThreshold: percentageVariance <= materialVarianceThreshold,
      reconciledValueSar: null,
      weightingApplied: false,
      semantics: 'P5 compares qualified method indications but deliberately does not silently average or weight them into a final value.',
    },
    blockers: [],
    warnings: [...new Set([...(directCap.warnings || []), ...(dcf.warnings || []), ...warnings])],
    readyForDecisionControl: status === WORKFLOW_RECONCILIATION_STATUS.QUALIFIED,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    semantics: 'P5 workflow reconciliation keeps transaction costs outside property NOI and does not create an investment approval, transaction authority, lender decision, or certified valuation.',
  });
}

module.exports = {
  WORKFLOW_RECONCILIATION_VERSION,
  WORKFLOW_RECONCILIATION_STATUS,
  normalizeTransactionCosts,
  reconcileGovernedAcquisitionValuation,
};

'use strict';

const { ASSUMPTION_MODEL_VERSION, normalizeAssumptionModelVersion } = require('../../assumptions/assumption-model');

const LEASE_ROLL_FORWARD_STATUS = Object.freeze({
  CONTRACT_COVERS_HOLD: 'CONTRACT_COVERS_HOLD',
  LEGACY_UNMODELED_ROLLOVER: 'LEGACY_UNMODELED_ROLLOVER',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
});

function assessLeaseRollForward(inputs, { assumptionModelVersion } = {}) {
  const version = normalizeAssumptionModelVersion(assumptionModelVersion);
  const leaseYears = Number(inputs && inputs.leaseYears);
  const holdPeriod = Number(inputs && inputs.holdPeriod);
  const contractCoversHoldPeriod = Number.isFinite(leaseYears)
    && Number.isFinite(holdPeriod)
    && leaseYears >= holdPeriod;

  if (contractCoversHoldPeriod) {
    return Object.freeze({
      status: LEASE_ROLL_FORWARD_STATUS.CONTRACT_COVERS_HOLD,
      contractCoversHoldPeriod: true,
      leaseSupportedThroughYear: holdPeriod,
      leaseRollForwardModeled: false,
      leaseDependentAnalyticsReady: true,
      requiresVisibleDisclosure: false,
    });
  }

  if (version === ASSUMPTION_MODEL_VERSION.LEGACY) {
    return Object.freeze({
      status: LEASE_ROLL_FORWARD_STATUS.LEGACY_UNMODELED_ROLLOVER,
      contractCoversHoldPeriod: false,
      leaseSupportedThroughYear: leaseYears,
      leaseRollForwardModeled: false,
      leaseDependentAnalyticsReady: false,
      requiresVisibleDisclosure: true,
    });
  }

  return Object.freeze({
    status: LEASE_ROLL_FORWARD_STATUS.MISSING_REQUIRED,
    contractCoversHoldPeriod: false,
    leaseSupportedThroughYear: leaseYears,
    leaseRollForwardModeled: false,
    leaseDependentAnalyticsReady: false,
    requiresVisibleDisclosure: true,
  });
}

function withLeaseMetadata(result, assessment) {
  return {
    ...result,
    leaseRollForwardStatus: assessment.status,
    contractCoversHoldPeriod: assessment.contractCoversHoldPeriod,
    leaseSupportedThroughYear: assessment.leaseSupportedThroughYear,
    leaseRollForwardModeled: assessment.leaseRollForwardModeled,
    leaseDependentAnalyticsReady: assessment.leaseDependentAnalyticsReady,
    leaseRollForwardRequiresVisibleDisclosure: assessment.requiresVisibleDisclosure,
  };
}

function holdUnsupportedPostExpiryAnalytics(result, assessment) {
  const supportedOperatingNoi = Array.isArray(result.operatingNoiCashflows)
    ? result.operatingNoiCashflows.slice(0, Math.max(0, Math.floor(assessment.leaseSupportedThroughYear || 0)))
    : [];
  const supportedCashflows = Number.isFinite(result.totalPurchaseCost)
    ? [-result.totalPurchaseCost, ...supportedOperatingNoi]
    : null;
  const incompleteInputs = Array.from(new Set([
    ...(Array.isArray(result.incompleteInputs) ? result.incompleteInputs : []),
    'leaseRollForwardAssumptions',
  ]));

  return {
    ...withLeaseMetadata(result, assessment),
    financialModelStatus: 'INCOMPLETE_INPUTS',
    incompleteInputs,
    cashflowsIncludeTerminalValue: false,
    cashflows: supportedCashflows,
    terminalSaleValue: null,
    terminalNetSaleProceeds: null,
    irr: null,
    npv: null,
    irrDiagnostics: null,
    irrReliability: null,
    irrMultipleRootRisk: null,
    irrSignChanges: null,
    mirr: null,
    leveredCashflows: null,
    leveredIRR: null,
    leveredNPV: null,
    leveredIrrDiagnostics: null,
    leveredMirr: null,
    leveredIrrReliability: null,
    cumulativePaybackOnCost: null,
    cumulativePaybackOnPrice: null,
    paybackOnCost: null,
    paybackOnPrice: null,
    maxJustifiedPrice: null,
    c2: null,
    c3: null,
    c6: null,
    c7: null,
    criteriaDetail: [],
    metCount: 0,
    totalCriteria: 0,
    verdict: 'INCOMPLETE_INPUTS',
    decisionStatus: 'INCOMPLETE_INPUTS',
    failedHardGates: [],
    failedSoftCriteria: [],
  };
}

/**
 * P23 / #456 safe interim governance.
 *
 * The Wave-A Existing Building engine does not yet model contractual lease
 * rollover. It projects the same operating framework beyond `leaseYears`.
 * LEGACY keeps those historical economics for compatibility but discloses the
 * unsupported rollover. V2 fails closed whenever the contractual lease ends
 * before the hold period. No renewal probability, downtime, market reset, TI,
 * free rent, leasing commission or credit-loss assumption is invented here.
 */
function applyExistingBuildingLeaseRollForwardGovernance({ inputs, engineResult, assumptionModelVersion }) {
  if (!engineResult || typeof engineResult !== 'object' || Array.isArray(engineResult)) {
    throw new TypeError('engineResult is required');
  }
  const assessment = assessLeaseRollForward(inputs, { assumptionModelVersion });

  if (assessment.status === LEASE_ROLL_FORWARD_STATUS.MISSING_REQUIRED) {
    return holdUnsupportedPostExpiryAnalytics(engineResult, assessment);
  }
  return withLeaseMetadata(engineResult, assessment);
}

module.exports = {
  LEASE_ROLL_FORWARD_STATUS,
  assessLeaseRollForward,
  applyExistingBuildingLeaseRollForwardGovernance,
};

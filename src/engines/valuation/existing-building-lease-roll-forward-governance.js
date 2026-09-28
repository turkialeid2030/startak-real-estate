'use strict';

const { ASSUMPTION_MODEL_VERSION, normalizeAssumptionModelVersion } = require('../../assumptions/assumption-model');

const LEASE_ROLL_FORWARD_STATUS = Object.freeze({
  CONTRACT_COVERS_HOLD_AND_FORWARD_NOI: 'CONTRACT_COVERS_HOLD_AND_FORWARD_NOI',
  LEGACY_UNMODELED_ROLLOVER: 'LEGACY_UNMODELED_ROLLOVER',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
});

function assessLeaseRollForward(inputs, { assumptionModelVersion } = {}) {
  const version = normalizeAssumptionModelVersion(assumptionModelVersion);
  const leaseYears = Number(inputs && inputs.leaseYears);
  const holdPeriod = Number(inputs && inputs.holdPeriod);
  const forwardTerminalNoiYear = Number.isFinite(holdPeriod) ? holdPeriod + 1 : null;
  const contractCoversHoldPeriod = Number.isFinite(leaseYears)
    && Number.isFinite(holdPeriod)
    && leaseYears >= holdPeriod;
  const contractCoversForwardTerminalNoi = Number.isFinite(leaseYears)
    && Number.isFinite(forwardTerminalNoiYear)
    && leaseYears >= forwardTerminalNoiYear;
  const leaseSupportedThroughYear = Number.isFinite(leaseYears) && Number.isFinite(holdPeriod)
    ? Math.min(leaseYears, holdPeriod)
    : leaseYears;

  if (contractCoversForwardTerminalNoi) {
    return Object.freeze({
      status: LEASE_ROLL_FORWARD_STATUS.CONTRACT_COVERS_HOLD_AND_FORWARD_NOI,
      contractCoversHoldPeriod: true,
      contractCoversForwardTerminalNoi: true,
      forwardTerminalNoiYear,
      contractualCoverageThroughYear: leaseYears,
      leaseSupportedThroughYear,
      leaseRollForwardModeled: false,
      leaseDependentAnalyticsReady: true,
      requiresVisibleDisclosure: false,
    });
  }

  const incompleteAssessment = {
    contractCoversHoldPeriod,
    contractCoversForwardTerminalNoi: false,
    forwardTerminalNoiYear,
    contractualCoverageThroughYear: leaseYears,
    leaseSupportedThroughYear,
    leaseRollForwardModeled: false,
    leaseDependentAnalyticsReady: false,
    requiresVisibleDisclosure: true,
  };

  if (version === ASSUMPTION_MODEL_VERSION.LEGACY) {
    return Object.freeze({
      status: LEASE_ROLL_FORWARD_STATUS.LEGACY_UNMODELED_ROLLOVER,
      ...incompleteAssessment,
    });
  }

  return Object.freeze({
    status: LEASE_ROLL_FORWARD_STATUS.MISSING_REQUIRED,
    ...incompleteAssessment,
  });
}

function withLeaseMetadata(result, assessment) {
  return {
    ...result,
    leaseRollForwardStatus: assessment.status,
    contractCoversHoldPeriod: assessment.contractCoversHoldPeriod,
    contractCoversForwardTerminalNoi: assessment.contractCoversForwardTerminalNoi,
    forwardTerminalNoiYear: assessment.forwardTerminalNoiYear,
    contractualCoverageThroughYear: assessment.contractualCoverageThroughYear,
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
    operatingNoiCashflows: supportedOperatingNoi,
    paybackNoiCashflows: supportedOperatingNoi,
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
 * The Wave-A Existing Building engine does not model contractual lease rollover.
 * In addition, terminal value capitalizes forward Year-(N+1) NOI, so a lease
 * that merely reaches the end of the hold period is still insufficient for a
 * decisionable terminal value unless it also covers that forward NOI year.
 *
 * LEGACY keeps historical economics for compatibility but discloses the gap.
 * V2 fails closed whenever contractual coverage does not extend through the
 * forward terminal-NOI year. No renewal probability, downtime, market reset,
 * TI, free rent, leasing commission or credit-loss assumption is invented.
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

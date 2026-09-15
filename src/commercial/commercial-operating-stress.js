'use strict';

const crypto = require('crypto');
const { SCENARIO_KIND } = require('../scenario-risk');
const { LEASE_INCOME_GATE_STATUS } = require('../market/lease-income-evidence');
const {
  COMMERCIAL_OPERATING_METRICS_STATUS,
  verifyRentRollSnapshotIntegrity,
  verifyIncomeEvidencePacketIntegrity,
  aggregateTenants,
  verifyCommercialOperatingMetricsIntegrity,
} = require('./commercial-operating-metrics');

const COMMERCIAL_STRESS_MODE = Object.freeze({
  SELECTED_TENANT_EXIT: 'SELECTED_TENANT_EXIT',
  SELECTED_LEASE_EXIT: 'SELECTED_LEASE_EXIT',
  EXPIRY_NON_RENEWAL_WINDOW: 'EXPIRY_NON_RENEWAL_WINDOW',
  COMBINED: 'COMBINED',
});

const COMMERCIAL_STRESS_ASSUMPTION_ORIGIN = Object.freeze({
  USER_ENTERED: 'USER_ENTERED',
  PROFESSIONAL_JUDGMENT: 'PROFESSIONAL_JUDGMENT',
});

const COMMERCIAL_OPERATING_STRESS_STATUS = Object.freeze({
  READY: 'READY',
  NOT_APPLICABLE_NO_LEASE_PORTFOLIO: 'NOT_APPLICABLE_NO_LEASE_PORTFOLIO',
  HOLD_SOURCE_METRICS: 'HOLD_SOURCE_METRICS',
  HOLD_SOURCE_INTEGRITY: 'HOLD_SOURCE_INTEGRITY',
  HOLD_SCENARIO_ASSUMPTIONS: 'HOLD_SCENARIO_ASSUMPTIONS',
});

const ALLOWED_STRESS_KINDS = Object.freeze([
  SCENARIO_KIND.DOWNSIDE,
  SCENARIO_KIND.SEVERE_DOWNSIDE,
  SCENARIO_KIND.CUSTOM,
]);

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365.25;

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function iso(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty date/time`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}
function normalizeRefs(values, field, allowEmpty = true) {
  if (!Array.isArray(values) || values.some((value) => !nonEmpty(value))) throw new TypeError(`${field} must be an array of non-empty strings`);
  const normalized = [...new Set(values.map((value) => value.trim()))].sort();
  if (!allowEmpty && normalized.length === 0) throw new TypeError(`${field} must contain at least one reference`);
  return normalized;
}
function topShare(aggregates, field, count, denominator) {
  if (!(denominator > 0)) return null;
  return aggregates
    .slice()
    .sort((a, b) => (b[field] - a[field]) || a.tenantRef.localeCompare(b.tenantRef))
    .slice(0, count)
    .reduce((sum, item) => sum + item[field], 0) / denominator;
}
function yearsRemaining(expiryDate, asOfMs) {
  const expiryMs = Date.parse(expiryDate);
  if (!Number.isFinite(expiryMs)) throw new TypeError('ACTIVE_LEASE_EXPIRY_DATE_INVALID');
  return Math.max(0, (expiryMs - asOfMs) / DAY_MS / YEAR_DAYS);
}

function createCommercialStressScenario({
  scenarioId,
  kind,
  label,
  mode,
  selectedTenantRefs = [],
  selectedLeaseIds = [],
  expiryWindowYears = null,
  assumptionOrigin,
  rationale,
  assumptionRefs,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['scenarioId', scenarioId], ['label', label], ['rationale', rationale],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
  if (!ALLOWED_STRESS_KINDS.includes(kind)) throw new TypeError(`commercial stress kind must be DOWNSIDE, SEVERE_DOWNSIDE or CUSTOM: ${kind}`);
  if (!Object.values(COMMERCIAL_STRESS_MODE).includes(mode)) throw new TypeError(`invalid commercial stress mode: ${mode}`);
  if (!Object.values(COMMERCIAL_STRESS_ASSUMPTION_ORIGIN).includes(assumptionOrigin)) throw new TypeError(`invalid assumptionOrigin: ${assumptionOrigin}`);
  const tenants = normalizeRefs(selectedTenantRefs, 'selectedTenantRefs');
  const leases = normalizeRefs(selectedLeaseIds, 'selectedLeaseIds');
  const refs = normalizeRefs(assumptionRefs, 'assumptionRefs', false);
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('COMMERCIAL_STRESS_REVIEW_BEFORE_PREPARATION');

  let windowYears = null;
  if (expiryWindowYears !== null) {
    if (typeof expiryWindowYears !== 'number' || !Number.isFinite(expiryWindowYears) || expiryWindowYears <= 0 || expiryWindowYears > 20) {
      throw new TypeError('expiryWindowYears must be > 0 and <= 20 when provided');
    }
    windowYears = expiryWindowYears;
  }

  if (mode === COMMERCIAL_STRESS_MODE.SELECTED_TENANT_EXIT && (tenants.length === 0 || leases.length > 0 || windowYears !== null)) {
    throw new TypeError('SELECTED_TENANT_EXIT requires tenant refs only');
  }
  if (mode === COMMERCIAL_STRESS_MODE.SELECTED_LEASE_EXIT && (leases.length === 0 || tenants.length > 0 || windowYears !== null)) {
    throw new TypeError('SELECTED_LEASE_EXIT requires lease ids only');
  }
  if (mode === COMMERCIAL_STRESS_MODE.EXPIRY_NON_RENEWAL_WINDOW && (windowYears === null || tenants.length > 0 || leases.length > 0)) {
    throw new TypeError('EXPIRY_NON_RENEWAL_WINDOW requires expiryWindowYears only');
  }
  if (mode === COMMERCIAL_STRESS_MODE.COMBINED && tenants.length === 0 && leases.length === 0 && windowYears === null) {
    throw new TypeError('COMBINED requires at least one explicit stress assumption');
  }

  const core = {
    schemaVersion: 1,
    scenarioId: scenarioId.trim(),
    kind,
    label: label.trim(),
    mode,
    selectedTenantRefs: tenants,
    selectedLeaseIds: leases,
    expiryWindowYears: windowYears,
    assumptionOrigin,
    rationale: rationale.trim(),
    assumptionRefs: refs,
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    scenarioAssumptionHashSha256: sha256(core),
    probabilityAssigned: false,
    tenantCreditEventPredicted: false,
    legalLeaseInterpretationPerformed: false,
  });
}

function verifyCommercialStressScenarioIntegrity(scenario) {
  if (!scenario || !nonEmpty(scenario.scenarioAssumptionHashSha256) || !/^[a-f0-9]{64}$/i.test(scenario.scenarioAssumptionHashSha256)) return false;
  const core = { ...scenario };
  ['scenarioAssumptionHashSha256', 'probabilityAssigned', 'tenantCreditEventPredicted', 'legalLeaseInterpretationPerformed'].forEach((key) => delete core[key]);
  return sha256(core) === scenario.scenarioAssumptionHashSha256.toLowerCase();
}

function scenarioSelection(activeLeases, scenario, asOfMs) {
  const tenantUniverse = new Set(activeLeases.map((lease) => lease.tenantRef));
  const leaseUniverse = new Set(activeLeases.map((lease) => lease.leaseId));
  const blockers = [];
  for (const tenantRef of scenario.selectedTenantRefs) if (!tenantUniverse.has(tenantRef)) blockers.push(`UNKNOWN_ACTIVE_TENANT_REF:${tenantRef}`);
  for (const leaseId of scenario.selectedLeaseIds) if (!leaseUniverse.has(leaseId)) blockers.push(`UNKNOWN_ACTIVE_LEASE_ID:${leaseId}`);
  if (blockers.length) return { blockers, affected: [] };

  const tenantSet = new Set(scenario.selectedTenantRefs);
  const leaseSet = new Set(scenario.selectedLeaseIds);
  const affected = [];
  for (const lease of activeLeases) {
    const causes = [];
    if (tenantSet.has(lease.tenantRef)) causes.push('SELECTED_TENANT_EXIT');
    if (leaseSet.has(lease.leaseId)) causes.push('SELECTED_LEASE_EXIT');
    if (scenario.expiryWindowYears !== null && yearsRemaining(lease.expiryDate, asOfMs) <= scenario.expiryWindowYears) causes.push('EXPIRY_NON_RENEWAL_WINDOW');
    if (causes.length) affected.push({ lease, causes });
  }
  if (affected.length === 0) blockers.push('SCENARIO_SELECTS_NO_ACTIVE_LEASES');
  return { blockers, affected };
}

function evaluateScenario({ scenario, activeLeases, totalLettableAreaSqm, baseOccupiedAreaSqm, baseAnnualContractRentSar, asOfDate }) {
  const asOfMs = Date.parse(asOfDate);
  const selection = scenarioSelection(activeLeases, scenario, asOfMs);
  if (selection.blockers.length) return { blockers: selection.blockers, result: null };

  const affectedIds = new Set(selection.affected.map(({ lease }) => lease.leaseId));
  const remainingLeases = activeLeases.filter((lease) => !affectedIds.has(lease.leaseId));
  const affectedAreaSqm = selection.affected.reduce((sum, { lease }) => sum + lease.areaSqm, 0);
  const annualContractRentRemovedSar = selection.affected.reduce((sum, { lease }) => sum + lease.contractedAnnualRentSarAsOfDate, 0);
  const stressedOccupiedAreaSqm = remainingLeases.reduce((sum, lease) => sum + lease.areaSqm, 0);
  const stressedAnnualContractRentSar = remainingLeases.reduce((sum, lease) => sum + lease.contractedAnnualRentSarAsOfDate, 0);
  const remainingTenantAggregates = aggregateTenants(remainingLeases);
  const affectedTenantRefs = [...new Set(selection.affected.map(({ lease }) => lease.tenantRef))].sort();

  const result = {
    scenarioId: scenario.scenarioId,
    scenarioAssumptionHashSha256: scenario.scenarioAssumptionHashSha256,
    kind: scenario.kind,
    label: scenario.label,
    mode: scenario.mode,
    assumptionOrigin: scenario.assumptionOrigin,
    rationale: scenario.rationale,
    assumptionRefs: scenario.assumptionRefs,
    base: {
      activeLeaseCount: activeLeases.length,
      occupiedAreaSqm: baseOccupiedAreaSqm,
      totalLettableAreaSqm,
      occupancyRate: baseOccupiedAreaSqm / totalLettableAreaSqm,
      annualContractRentSar: baseAnnualContractRentSar,
    },
    stressed: {
      activeLeaseCount: remainingLeases.length,
      tenantCount: remainingTenantAggregates.length,
      occupiedAreaSqm: stressedOccupiedAreaSqm,
      occupancyRate: stressedOccupiedAreaSqm / totalLettableAreaSqm,
      annualContractRentSar: stressedAnnualContractRentSar,
      rentRetentionRate: baseAnnualContractRentSar > 0 ? stressedAnnualContractRentSar / baseAnnualContractRentSar : null,
      occupiedAreaRetentionRate: baseOccupiedAreaSqm > 0 ? stressedOccupiedAreaSqm / baseOccupiedAreaSqm : null,
      topTenantRentConcentration: {
        top1: topShare(remainingTenantAggregates, 'annualContractRentSar', 1, stressedAnnualContractRentSar),
        top3: topShare(remainingTenantAggregates, 'annualContractRentSar', 3, stressedAnnualContractRentSar),
        top5: topShare(remainingTenantAggregates, 'annualContractRentSar', 5, stressedAnnualContractRentSar),
      },
      topTenantAreaConcentration: {
        top1: topShare(remainingTenantAggregates, 'areaSqm', 1, stressedOccupiedAreaSqm),
        top3: topShare(remainingTenantAggregates, 'areaSqm', 3, stressedOccupiedAreaSqm),
        top5: topShare(remainingTenantAggregates, 'areaSqm', 5, stressedOccupiedAreaSqm),
      },
    },
    impact: {
      affectedLeaseCount: selection.affected.length,
      affectedTenantCount: affectedTenantRefs.length,
      affectedTenantRefs,
      affectedAreaSqm,
      occupancyRateDelta: (stressedOccupiedAreaSqm - baseOccupiedAreaSqm) / totalLettableAreaSqm,
      annualContractRentRemovedSar,
      annualContractRentDeltaSar: stressedAnnualContractRentSar - baseAnnualContractRentSar,
    },
    affectedLeases: selection.affected.map(({ lease, causes }) => ({
      leaseId: lease.leaseId,
      tenantRef: lease.tenantRef,
      areaSqm: lease.areaSqm,
      annualContractRentSar: lease.contractedAnnualRentSarAsOfDate,
      expiryDate: lease.expiryDate,
      causes,
    })),
  };
  return { blockers: [], result };
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers,
    warnings: [],
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    commercialOperatingMetricsHashSha256: context.commercialOperatingMetricsHashSha256 || null,
    incomeEvidencePacketHashSha256: context.incomeEvidencePacketHashSha256 || null,
    rentRollHashSha256: context.rentRollHashSha256 || null,
    scenarioResults: null,
    scenarioAnalysisOnly: true,
    probabilitiesAssigned: false,
    tenantCreditRatingProduced: false,
    defaultProbabilityEstimated: false,
    contractualRenewalPredicted: false,
    legalLeaseInterpretationPerformed: false,
    valuationInputsWritten: false,
    valuationArithmeticPerformed: false,
    noiForecastProduced: false,
    investmentRecommendationProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildCommercialOperatingStressPacket({
  stressPacketId,
  caseId,
  propertyRef,
  operatingMetricsPacket,
  incomeEvidencePacket,
  rentRollSnapshot,
  scenarios,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['stressPacketId', stressPacketId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('COMMERCIAL_STRESS_PACKET_REVIEW_BEFORE_PREPARATION');
  if (!Array.isArray(scenarios) || scenarios.length === 0) throw new TypeError('scenarios must be a non-empty array');

  if (!operatingMetricsPacket || operatingMetricsPacket.caseId !== caseId || operatingMetricsPacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:operatingMetricsPacket');
  }
  if (operatingMetricsPacket.status === COMMERCIAL_OPERATING_METRICS_STATUS.NOT_APPLICABLE_NO_LEASE_PORTFOLIO
      && verifyCommercialOperatingMetricsIntegrity(operatingMetricsPacket)) {
    return hold(COMMERCIAL_OPERATING_STRESS_STATUS.NOT_APPLICABLE_NO_LEASE_PORTFOLIO, [], {
      caseId, propertyRef, commercialOperatingMetricsHashSha256: operatingMetricsPacket.commercialOperatingMetricsHashSha256,
    });
  }
  if (operatingMetricsPacket.status !== COMMERCIAL_OPERATING_METRICS_STATUS.READY
      || !verifyCommercialOperatingMetricsIntegrity(operatingMetricsPacket)) {
    return hold(COMMERCIAL_OPERATING_STRESS_STATUS.HOLD_SOURCE_METRICS, ['COMMERCIAL_OPERATING_METRICS_NOT_READY_OR_INTEGRITY_FAILED'], {
      caseId, propertyRef, commercialOperatingMetricsHashSha256: operatingMetricsPacket.commercialOperatingMetricsHashSha256 || null,
    });
  }

  if (!incomeEvidencePacket || !rentRollSnapshot
      || incomeEvidencePacket.caseId !== caseId || incomeEvidencePacket.propertyRef !== propertyRef
      || rentRollSnapshot.caseId !== caseId || rentRollSnapshot.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:stressSourceEvidence');
  }
  const sourceHashesMatch = operatingMetricsPacket.incomeEvidencePacketHashSha256 === incomeEvidencePacket.incomeEvidencePacketHashSha256
    && operatingMetricsPacket.rentRollHashSha256 === rentRollSnapshot.rentRollHashSha256
    && incomeEvidencePacket.rentRollHashSha256 === rentRollSnapshot.rentRollHashSha256;
  if (!sourceHashesMatch || !verifyIncomeEvidencePacketIntegrity(incomeEvidencePacket) || !verifyRentRollSnapshotIntegrity(rentRollSnapshot)) {
    return hold(COMMERCIAL_OPERATING_STRESS_STATUS.HOLD_SOURCE_INTEGRITY, ['STRESS_SOURCE_EVIDENCE_INTEGRITY_OR_HASH_BINDING_FAILED'], {
      caseId, propertyRef,
      commercialOperatingMetricsHashSha256: operatingMetricsPacket.commercialOperatingMetricsHashSha256,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256 || null,
      rentRollHashSha256: rentRollSnapshot.rentRollHashSha256 || null,
    });
  }
  if (incomeEvidencePacket.status !== LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF
      || incomeEvidencePacket.readyForIncomeAnalysisHandoff !== true
      || !Array.isArray(incomeEvidencePacket.activeLeases) || incomeEvidencePacket.activeLeases.length === 0) {
    return hold(COMMERCIAL_OPERATING_STRESS_STATUS.HOLD_SOURCE_INTEGRITY, ['STRESS_SOURCE_LEASE_EVIDENCE_NOT_READY'], {
      caseId, propertyRef,
      commercialOperatingMetricsHashSha256: operatingMetricsPacket.commercialOperatingMetricsHashSha256,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
      rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
    });
  }
  if (Date.parse(operatingMetricsPacket.asOfDate) !== Date.parse(incomeEvidencePacket.asOfDate)
      || Date.parse(incomeEvidencePacket.asOfDate) !== Date.parse(rentRollSnapshot.asOfDate)) {
    return hold(COMMERCIAL_OPERATING_STRESS_STATUS.HOLD_SOURCE_INTEGRITY, ['STRESS_SOURCE_AS_OF_DATE_MISMATCH'], {
      caseId, propertyRef,
      commercialOperatingMetricsHashSha256: operatingMetricsPacket.commercialOperatingMetricsHashSha256,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
      rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
    });
  }

  const scenarioIds = new Set();
  const blockers = [];
  for (const scenario of scenarios) {
    if (!verifyCommercialStressScenarioIntegrity(scenario)) {
      blockers.push(`COMMERCIAL_STRESS_SCENARIO_INTEGRITY_FAILED:${scenario?.scenarioId || 'UNKNOWN'}`);
      continue;
    }
    if (scenarioIds.has(scenario.scenarioId)) blockers.push(`DUPLICATE_COMMERCIAL_STRESS_SCENARIO_ID:${scenario.scenarioId}`);
    scenarioIds.add(scenario.scenarioId);
    if (Date.parse(scenario.reviewedAt) > Date.parse(reviewed)) blockers.push(`SCENARIO_REVIEW_AFTER_STRESS_PACKET_REVIEW:${scenario.scenarioId}`);
  }
  if (blockers.length) return hold(COMMERCIAL_OPERATING_STRESS_STATUS.HOLD_SCENARIO_ASSUMPTIONS, blockers, {
    caseId, propertyRef,
    commercialOperatingMetricsHashSha256: operatingMetricsPacket.commercialOperatingMetricsHashSha256,
    incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
    rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
  });

  const scenarioResults = [];
  for (const scenario of scenarios) {
    const evaluation = evaluateScenario({
      scenario,
      activeLeases: incomeEvidencePacket.activeLeases,
      totalLettableAreaSqm: rentRollSnapshot.totalLettableAreaSqm,
      baseOccupiedAreaSqm: incomeEvidencePacket.occupiedAreaSqm,
      baseAnnualContractRentSar: incomeEvidencePacket.annualContractRentSar,
      asOfDate: incomeEvidencePacket.asOfDate,
    });
    if (evaluation.blockers.length) blockers.push(...evaluation.blockers.map((blocker) => `${scenario.scenarioId}:${blocker}`));
    else scenarioResults.push(evaluation.result);
  }
  if (blockers.length) return hold(COMMERCIAL_OPERATING_STRESS_STATUS.HOLD_SCENARIO_ASSUMPTIONS, blockers, {
    caseId, propertyRef,
    commercialOperatingMetricsHashSha256: operatingMetricsPacket.commercialOperatingMetricsHashSha256,
    incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
    rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
  });

  const core = {
    schemaVersion: 1,
    stressPacketId: stressPacketId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    asOfDate: operatingMetricsPacket.asOfDate,
    commercialOperatingMetricsHashSha256: operatingMetricsPacket.commercialOperatingMetricsHashSha256,
    incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
    rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
    scenarios,
    scenarioResults,
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    commercialOperatingStressHashSha256: sha256(core),
    status: COMMERCIAL_OPERATING_STRESS_STATUS.READY,
    blockers: [],
    warnings: [],
    scenarioAnalysisOnly: true,
    probabilitiesAssigned: false,
    tenantCreditRatingProduced: false,
    defaultProbabilityEstimated: false,
    contractualRenewalPredicted: false,
    legalLeaseInterpretationPerformed: false,
    valuationInputsWritten: false,
    valuationArithmeticPerformed: false,
    noiForecastProduced: false,
    investmentRecommendationProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet applies explicit reviewed scenario assumptions to the integrity-bound active lease evidence for operational stress analysis only. Selected tenant/lease exits and expiry-window non-renewal are hypothetical assumptions, not predicted credit events, probabilities, legal interpretations or renewal forecasts. Outputs do not write valuation inputs, perform NOI/valuation arithmetic, make investment recommendations, certify a valuation or authorize a transaction.',
  });
}

function verifyCommercialOperatingStressIntegrity(packet) {
  if (!packet || !nonEmpty(packet.commercialOperatingStressHashSha256) || !/^[a-f0-9]{64}$/i.test(packet.commercialOperatingStressHashSha256)) return false;
  const core = { ...packet };
  [
    'commercialOperatingStressHashSha256', 'status', 'blockers', 'warnings', 'scenarioAnalysisOnly',
    'probabilitiesAssigned', 'tenantCreditRatingProduced', 'defaultProbabilityEstimated', 'contractualRenewalPredicted',
    'legalLeaseInterpretationPerformed', 'valuationInputsWritten', 'valuationArithmeticPerformed', 'noiForecastProduced',
    'investmentRecommendationProduced', 'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.commercialOperatingStressHashSha256.toLowerCase();
}

module.exports = {
  COMMERCIAL_STRESS_MODE,
  COMMERCIAL_STRESS_ASSUMPTION_ORIGIN,
  COMMERCIAL_OPERATING_STRESS_STATUS,
  createCommercialStressScenario,
  verifyCommercialStressScenarioIntegrity,
  evaluateScenario,
  buildCommercialOperatingStressPacket,
  verifyCommercialOperatingStressIntegrity,
};

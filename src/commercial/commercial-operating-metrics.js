'use strict';

const crypto = require('crypto');
const {
  OCCUPANCY_STRUCTURE,
  COMMERCIAL_EVIDENCE_TOPIC,
  EVIDENCE_ITEM_STATUS,
  COMMERCIAL_SPECIALIZATION_STATUS,
  verifyCommercialSpecializationPacketIntegrity,
} = require('./commercial-specialization');
const { LEASE_INCOME_GATE_STATUS } = require('../market/lease-income-evidence');

const COMMERCIAL_OPERATING_METRICS_STATUS = Object.freeze({
  READY: 'READY',
  NOT_APPLICABLE_NO_LEASE_PORTFOLIO: 'NOT_APPLICABLE_NO_LEASE_PORTFOLIO',
  HOLD_SPECIALIZATION_PACKET: 'HOLD_SPECIALIZATION_PACKET',
  HOLD_LEASE_EVIDENCE: 'HOLD_LEASE_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_OCCUPANCY_STRUCTURE_CONFLICT: 'HOLD_OCCUPANCY_STRUCTURE_CONFLICT',
});

const EXPIRY_BUCKET = Object.freeze({
  WITHIN_1_YEAR: 'WITHIN_1_YEAR',
  ONE_TO_THREE_YEARS: 'ONE_TO_THREE_YEARS',
  THREE_TO_FIVE_YEARS: 'THREE_TO_FIVE_YEARS',
  OVER_FIVE_YEARS: 'OVER_FIVE_YEARS',
});

const LEASE_APPLICABLE_OCCUPANCIES = Object.freeze([
  OCCUPANCY_STRUCTURE.SINGLE_TENANT,
  OCCUPANCY_STRUCTURE.MULTI_TENANT,
  OCCUPANCY_STRUCTURE.MIXED,
]);

const QUALIFIED_COMMERCIAL_EVIDENCE = Object.freeze([
  EVIDENCE_ITEM_STATUS.VERIFIED,
  EVIDENCE_ITEM_STATUS.PROFESSIONAL_REVIEWED,
]);

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365.25;

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function validSha(value) { return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value); }
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
function finiteNonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number`);
}

function verifyRentRollSnapshotIntegrity(snapshot) {
  if (!snapshot || !validSha(snapshot.rentRollHashSha256)) return false;
  const { rentRollHashSha256, ...core } = snapshot;
  return sha256(core) === rentRollHashSha256.toLowerCase();
}

function verifyIncomeEvidencePacketIntegrity(packet) {
  if (!packet || !validSha(packet.incomeEvidencePacketHashSha256)) return false;
  const { incomeEvidencePacketHashSha256, ...core } = packet;
  return sha256(core) === incomeEvidencePacketHashSha256.toLowerCase();
}

function leaseEvidenceTopicQualified(specializationPacket) {
  const item = (Array.isArray(specializationPacket?.evidenceItems) ? specializationPacket.evidenceItems : [])
    .find((entry) => entry?.topic === COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL);
  return Boolean(item && QUALIFIED_COMMERCIAL_EVIDENCE.includes(item.status));
}

function aggregateTenants(activeLeases) {
  const tenantMap = new Map();
  for (const lease of activeLeases) {
    if (!nonEmpty(lease.tenantRef)) throw new TypeError(`ACTIVE_LEASE_TENANT_REF_REQUIRED:${lease.leaseId || 'UNKNOWN'}`);
    finiteNonNegative(lease.areaSqm, `lease.areaSqm:${lease.leaseId}`);
    finiteNonNegative(lease.contractedAnnualRentSarAsOfDate, `lease.contractedAnnualRentSarAsOfDate:${lease.leaseId}`);
    const current = tenantMap.get(lease.tenantRef) || { tenantRef: lease.tenantRef, leaseCount: 0, areaSqm: 0, annualContractRentSar: 0 };
    current.leaseCount += 1;
    current.areaSqm += lease.areaSqm;
    current.annualContractRentSar += lease.contractedAnnualRentSarAsOfDate;
    tenantMap.set(lease.tenantRef, current);
  }
  return [...tenantMap.values()].sort((a, b) => {
    const rentDelta = b.annualContractRentSar - a.annualContractRentSar;
    if (Math.abs(rentDelta) > 1e-9) return rentDelta;
    return a.tenantRef.localeCompare(b.tenantRef);
  });
}

function topShare(tenantAggregates, field, count, denominator) {
  if (!(denominator > 0)) return null;
  return tenantAggregates
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

function expiryBucketFor(years) {
  if (years <= 1) return EXPIRY_BUCKET.WITHIN_1_YEAR;
  if (years <= 3) return EXPIRY_BUCKET.ONE_TO_THREE_YEARS;
  if (years <= 5) return EXPIRY_BUCKET.THREE_TO_FIVE_YEARS;
  return EXPIRY_BUCKET.OVER_FIVE_YEARS;
}

function buildExpiryProfile(activeLeases, asOfMs, totalRent, totalArea) {
  const buckets = Object.fromEntries(Object.values(EXPIRY_BUCKET).map((bucket) => [bucket, {
    bucket,
    leaseCount: 0,
    areaSqm: 0,
    annualContractRentSar: 0,
    areaShare: totalArea > 0 ? 0 : null,
    rentShare: totalRent > 0 ? 0 : null,
  }]));
  for (const lease of activeLeases) {
    const bucket = expiryBucketFor(yearsRemaining(lease.expiryDate, asOfMs));
    buckets[bucket].leaseCount += 1;
    buckets[bucket].areaSqm += lease.areaSqm;
    buckets[bucket].annualContractRentSar += lease.contractedAnnualRentSarAsOfDate;
  }
  for (const bucket of Object.values(buckets)) {
    bucket.areaShare = totalArea > 0 ? bucket.areaSqm / totalArea : null;
    bucket.rentShare = totalRent > 0 ? bucket.annualContractRentSar / totalRent : null;
  }
  return Object.values(buckets);
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    status,
    blockers,
    warnings: context.warnings || [],
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    commercialSpecializationHashSha256: context.commercialSpecializationHashSha256 || null,
    incomeEvidencePacketHashSha256: context.incomeEvidencePacketHashSha256 || null,
    rentRollHashSha256: context.rentRollHashSha256 || null,
    metrics: null,
    factualOperatingAnalyticsOnly: true,
    creditRatingProduced: false,
    defaultProbabilityEstimated: false,
    valuationInputAdopted: false,
    valuationArithmeticPerformed: false,
    investmentRecommendationProduced: false,
    legalLeaseInterpretationPerformed: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildCommercialOperatingMetrics({
  metricsPacketId,
  caseId,
  propertyRef,
  specializationPacket,
  incomeEvidencePacket = null,
  rentRollSnapshot = null,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['metricsPacketId', metricsPacketId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('COMMERCIAL_METRICS_REVIEW_BEFORE_PREPARATION');

  if (!specializationPacket || specializationPacket.caseId !== caseId || specializationPacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:specializationPacket');
  }
  const specializationReady = specializationPacket.status === COMMERCIAL_SPECIALIZATION_STATUS.READY_FOR_PROFESSIONAL_METHOD_WORKFLOW
    && specializationPacket.readyForProfessionalMethodWorkflow === true
    && verifyCommercialSpecializationPacketIntegrity(specializationPacket);
  if (!specializationReady) {
    return hold(COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_SPECIALIZATION_PACKET, ['COMMERCIAL_SPECIALIZATION_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], {
      caseId, propertyRef, commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256 || null,
    });
  }

  const leaseApplicable = LEASE_APPLICABLE_OCCUPANCIES.includes(specializationPacket.occupancyStructure);
  if (!leaseApplicable) {
    if (incomeEvidencePacket || rentRollSnapshot) {
      return hold(COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_OCCUPANCY_STRUCTURE_CONFLICT, ['LEASE_PORTFOLIO_PROVIDED_FOR_NON_LEASE_OCCUPANCY_STRUCTURE'], {
        caseId, propertyRef, commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
      });
    }
    const core = {
      schemaVersion: 1,
      metricsPacketId: metricsPacketId.trim(),
      caseId: caseId.trim(),
      propertyRef: propertyRef.trim(),
      asOfDate: specializationPacket.valuationDate,
      occupancyStructure: specializationPacket.occupancyStructure,
      commercialAssetClass: specializationPacket.commercialAssetClass,
      commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
      preparedByRef: preparedByRef.trim(),
      preparedAt: preparedAtIso,
      reviewedByRef: reviewedByRef.trim(),
      reviewedAt: reviewedAtIso,
      reviewEvidenceRef: reviewEvidenceRef.trim(),
      metrics: null,
    };
    return deepFreeze({
      ...core,
      commercialOperatingMetricsHashSha256: sha256(core),
      status: COMMERCIAL_OPERATING_METRICS_STATUS.NOT_APPLICABLE_NO_LEASE_PORTFOLIO,
      blockers: [],
      warnings: [],
      factualOperatingAnalyticsOnly: true,
      creditRatingProduced: false,
      defaultProbabilityEstimated: false,
      valuationInputAdopted: false,
      valuationArithmeticPerformed: false,
      investmentRecommendationProduced: false,
      legalLeaseInterpretationPerformed: false,
      certifiedValuationEstablished: false,
      transactionAuthorized: false,
      semantics: 'Lease concentration and expiry metrics are not applicable to the selected non-lease occupancy structure. No zero values are fabricated and no valuation, credit or transaction conclusion is produced.',
    });
  }

  if (!leaseEvidenceTopicQualified(specializationPacket)) {
    return hold(COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_LEASE_EVIDENCE, ['COMMERCIAL_LEASE_AND_RENT_ROLL_EVIDENCE_NOT_QUALIFIED'], {
      caseId, propertyRef, commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
    });
  }
  if (!incomeEvidencePacket || !rentRollSnapshot) {
    return hold(COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_LEASE_EVIDENCE, ['INCOME_EVIDENCE_PACKET_AND_RENT_ROLL_SNAPSHOT_REQUIRED'], {
      caseId, propertyRef, commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
    });
  }
  if (incomeEvidencePacket.caseId !== caseId || incomeEvidencePacket.propertyRef !== propertyRef
      || rentRollSnapshot.caseId !== caseId || rentRollSnapshot.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:leaseEvidence');
  }
  if (!verifyIncomeEvidencePacketIntegrity(incomeEvidencePacket) || !verifyRentRollSnapshotIntegrity(rentRollSnapshot)) {
    return hold(COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_INTEGRITY, ['LEASE_OR_RENT_ROLL_PACKET_INTEGRITY_FAILED'], {
      caseId, propertyRef,
      commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256 || null,
      rentRollHashSha256: rentRollSnapshot.rentRollHashSha256 || null,
    });
  }
  if (incomeEvidencePacket.status !== LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF
      || incomeEvidencePacket.readyForIncomeAnalysisHandoff !== true) {
    return hold(COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_LEASE_EVIDENCE, ['LEASE_INCOME_EVIDENCE_NOT_READY'], {
      caseId, propertyRef,
      commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
      rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
    });
  }
  if (incomeEvidencePacket.rentRollHashSha256 !== rentRollSnapshot.rentRollHashSha256) {
    return hold(COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_INTEGRITY, ['INCOME_EVIDENCE_RENT_ROLL_HASH_MISMATCH'], {
      caseId, propertyRef,
      commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
      rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
    });
  }

  const asOfDateIso = iso(incomeEvidencePacket.asOfDate, 'incomeEvidencePacket.asOfDate');
  if (Date.parse(asOfDateIso) !== Date.parse(rentRollSnapshot.asOfDate)) throw new TypeError('LEASE_EVIDENCE_AS_OF_DATE_MISMATCH');
  if (specializationPacket.valuationDate && Date.parse(asOfDateIso) !== Date.parse(specializationPacket.valuationDate)) {
    return hold(COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_LEASE_EVIDENCE, ['LEASE_ANALYTICS_AS_OF_DATE_MUST_MATCH_VALUATION_DATE'], {
      caseId, propertyRef,
      commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
      rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
    });
  }

  if (!Array.isArray(incomeEvidencePacket.activeLeases) || incomeEvidencePacket.activeLeases.length === 0) {
    return hold(COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_LEASE_EVIDENCE, ['ACTIVE_VERIFIED_LEASES_REQUIRED_FOR_LEASE_ANALYTICS'], {
      caseId, propertyRef,
      commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
      rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
    });
  }

  finiteNonNegative(incomeEvidencePacket.occupiedAreaSqm, 'incomeEvidencePacket.occupiedAreaSqm');
  finiteNonNegative(incomeEvidencePacket.annualContractRentSar, 'incomeEvidencePacket.annualContractRentSar');
  if (typeof rentRollSnapshot.totalLettableAreaSqm !== 'number' || !Number.isFinite(rentRollSnapshot.totalLettableAreaSqm) || rentRollSnapshot.totalLettableAreaSqm <= 0) {
    return hold(COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_LEASE_EVIDENCE, ['TOTAL_LETTABLE_AREA_INVALID'], {
      caseId, propertyRef,
      commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
      rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
    });
  }
  if (incomeEvidencePacket.occupiedAreaSqm > rentRollSnapshot.totalLettableAreaSqm + 1e-9) {
    return hold(COMMERCIAL_OPERATING_METRICS_STATUS.HOLD_OCCUPANCY_STRUCTURE_CONFLICT, ['LEASE_DERIVED_OCCUPIED_AREA_EXCEEDS_TOTAL_LETTABLE_AREA'], {
      caseId, propertyRef,
      commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
      rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
    });
  }

  const activeLeases = incomeEvidencePacket.activeLeases;
  const asOfMs = Date.parse(asOfDateIso);
  const tenantAggregates = aggregateTenants(activeLeases);
  const totalArea = incomeEvidencePacket.occupiedAreaSqm;
  const totalRent = incomeEvidencePacket.annualContractRentSar;

  const rentWeightedWaleYears = totalRent > 0
    ? activeLeases.reduce((sum, lease) => sum + yearsRemaining(lease.expiryDate, asOfMs) * lease.contractedAnnualRentSarAsOfDate, 0) / totalRent
    : null;
  const areaWeightedWaleYears = totalArea > 0
    ? activeLeases.reduce((sum, lease) => sum + yearsRemaining(lease.expiryDate, asOfMs) * lease.areaSqm, 0) / totalArea
    : null;
  const expiryProfile = buildExpiryProfile(activeLeases, asOfMs, totalRent, totalArea);

  const metrics = {
    activeLeaseCount: activeLeases.length,
    tenantCount: tenantAggregates.length,
    occupiedAreaSqm: totalArea,
    totalLettableAreaSqm: rentRollSnapshot.totalLettableAreaSqm,
    leaseDerivedOccupancyRate: totalArea / rentRollSnapshot.totalLettableAreaSqm,
    annualContractRentSar: totalRent,
    weightedAverageContractRentSarPerSqmYear: totalArea > 0 ? totalRent / totalArea : null,
    rentWeightedWaleYears,
    areaWeightedWaleYears,
    topTenantRentConcentration: {
      top1: topShare(tenantAggregates, 'annualContractRentSar', 1, totalRent),
      top3: topShare(tenantAggregates, 'annualContractRentSar', 3, totalRent),
      top5: topShare(tenantAggregates, 'annualContractRentSar', 5, totalRent),
    },
    topTenantAreaConcentration: {
      top1: topShare(tenantAggregates, 'areaSqm', 1, totalArea),
      top3: topShare(tenantAggregates, 'areaSqm', 3, totalArea),
      top5: topShare(tenantAggregates, 'areaSqm', 5, totalArea),
    },
    tenantAggregates,
    leaseExpiryProfile: expiryProfile,
  };

  const core = {
    schemaVersion: 1,
    metricsPacketId: metricsPacketId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    asOfDate: asOfDateIso,
    commercialAssetClass: specializationPacket.commercialAssetClass,
    occupancyStructure: specializationPacket.occupancyStructure,
    commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
    incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
    rentRollHashSha256: rentRollSnapshot.rentRollHashSha256,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    metrics,
  };

  return deepFreeze({
    ...core,
    commercialOperatingMetricsHashSha256: sha256(core),
    status: COMMERCIAL_OPERATING_METRICS_STATUS.READY,
    blockers: [],
    warnings: [],
    factualOperatingAnalyticsOnly: true,
    contractualExpiryOnly: true,
    automaticRenewalOrBreakExercise: false,
    creditRatingProduced: false,
    tenantRiskGradeProduced: false,
    defaultProbabilityEstimated: false,
    valuationInputAdopted: false,
    valuationArithmeticPerformed: false,
    investmentRecommendationProduced: false,
    legalLeaseInterpretationPerformed: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'These metrics are deterministic factual analytics derived only from an integrity-verified qualified commercial specialization packet and the reconciled active lease evidence/rent-roll snapshot at the same valuation date. Concentration and WALE use contractual rent, area and contractual expiry only. They are not a tenant credit rating, default probability, risk grade, valuation input, investment recommendation, legal lease interpretation, certified valuation or transaction authorization.',
  });
}

function verifyCommercialOperatingMetricsIntegrity(packet) {
  if (!packet || !validSha(packet.commercialOperatingMetricsHashSha256)) return false;
  const core = { ...packet };
  [
    'commercialOperatingMetricsHashSha256', 'status', 'blockers', 'warnings', 'factualOperatingAnalyticsOnly',
    'contractualExpiryOnly', 'automaticRenewalOrBreakExercise', 'creditRatingProduced', 'tenantRiskGradeProduced',
    'defaultProbabilityEstimated', 'valuationInputAdopted', 'valuationArithmeticPerformed', 'investmentRecommendationProduced',
    'legalLeaseInterpretationPerformed', 'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.commercialOperatingMetricsHashSha256.toLowerCase();
}

module.exports = {
  COMMERCIAL_OPERATING_METRICS_STATUS,
  EXPIRY_BUCKET,
  verifyRentRollSnapshotIntegrity,
  verifyIncomeEvidencePacketIntegrity,
  leaseEvidenceTopicQualified,
  aggregateTenants,
  buildCommercialOperatingMetrics,
  verifyCommercialOperatingMetricsIntegrity,
};

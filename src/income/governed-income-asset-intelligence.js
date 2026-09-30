'use strict';

const crypto = require('crypto');
const {
  LEASE_INCOME_GATE_STATUS,
  LEASE_VERIFICATION_STATUS,
} = require('../market/lease-income-evidence');

const CAPABILITY = 'C11_GOVERNED_INCOME_ASSET_INTELLIGENCE_V1';
const POLICY_VERSION = 'C11_INCOME_ASSET_REVIEW_POLICY_V1';

const INCOME_ASSET_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW: 'READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW',
  HOLD_UPSTREAM_EVIDENCE: 'HOLD_UPSTREAM_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_TENANT_EVIDENCE: 'HOLD_TENANT_EVIDENCE',
  HOLD_METRICS: 'HOLD_METRICS',
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function clean(value) {
  return nonEmpty(value) ? value.trim() : '';
}

function iso(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function sha256(value) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
  } catch (_) {
    return null;
  }
}

function validSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function without(record, fields) {
  const result = { ...record };
  fields.forEach((field) => delete result[field]);
  return result;
}

function verifyIncomeEvidencePacketIntegrity(packet) {
  if (!packet || !validSha(packet.incomeEvidencePacketHashSha256)) return false;
  return sha256(without(packet, ['incomeEvidencePacketHashSha256'])) === packet.incomeEvidencePacketHashSha256.toLowerCase();
}

function verifyRentRollSnapshotIntegrity(snapshot) {
  if (!snapshot || !validSha(snapshot.rentRollHashSha256)) return false;
  return sha256(without(snapshot, ['rentRollHashSha256'])) === snapshot.rentRollHashSha256.toLowerCase();
}

function computeTenantStrengthAssessmentHash(assessment) {
  if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) return null;
  return sha256(without(assessment, ['assessmentHashSha256']));
}

function verifyTenantStrengthAssessmentIntegrity(assessment) {
  if (!assessment || !validSha(assessment.assessmentHashSha256)) return false;
  const computed = computeTenantStrengthAssessmentHash(assessment);
  return !!computed && computed === assessment.assessmentHashSha256.toLowerCase();
}

function createGovernedTenantStrengthAssessment({
  assessmentId,
  caseId,
  propertyRef,
  tenantRef,
  strengthBand,
  methodologyRef,
  evidenceRefs,
  assessedByRef,
  assessedAt,
  validUntil,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['assessmentId', assessmentId],
    ['caseId', caseId],
    ['propertyRef', propertyRef],
    ['tenantRef', tenantRef],
    ['strengthBand', strengthBand],
    ['methodologyRef', methodologyRef],
    ['assessedByRef', assessedByRef],
    ['reviewEvidenceRef', reviewEvidenceRef],
  ]) {
    if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
  }
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((item) => !nonEmpty(item))) {
    throw new TypeError('evidenceRefs must contain at least one non-empty evidence reference');
  }
  const assessedAtIso = iso(assessedAt, 'assessedAt');
  const validUntilIso = iso(validUntil, 'validUntil');
  if (Date.parse(validUntilIso) < Date.parse(assessedAtIso)) throw new TypeError('TENANT_ASSESSMENT_VALID_UNTIL_BEFORE_ASSESSED_AT');

  const core = {
    schemaVersion: 1,
    assessmentId: assessmentId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    tenantRef: tenantRef.trim(),
    strengthBand: strengthBand.trim(),
    methodologyRef: methodologyRef.trim(),
    evidenceRefs: [...new Set(evidenceRefs.map((item) => item.trim()))].sort(),
    assessedByRef: assessedByRef.trim(),
    assessedAt: assessedAtIso,
    validUntil: validUntilIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    professionalAssessmentSupplied: true,
    automaticallyScored: false,
    financialThresholdsInferred: false,
  };
  return deepFreeze({
    ...core,
    assessmentHashSha256: sha256(core),
  });
}

function tenantAssessmentBindings(assessments) {
  if (!Array.isArray(assessments)) return [];
  return assessments
    .map((assessment) => ({
      tenantRef: clean(assessment?.tenantRef) || null,
      assessmentHashSha256: clean(assessment?.assessmentHashSha256).toLowerCase() || null,
    }))
    .sort((a, b) => String(a.tenantRef).localeCompare(String(b.tenantRef)));
}

function computeIncomeAssetReviewPolicyHash(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return null;
  return sha256(without(policy, ['policyHashSha256']));
}

function finiteRatio(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function addUtcMonthsClamped(isoDate, months) {
  const source = new Date(isoDate);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return new Date(Date.UTC(
    targetYear,
    normalizedMonth,
    targetDay,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  )).toISOString();
}

function validatePolicy(policy, context) {
  const blockers = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return { blockers: ['C11_GOVERNED_POLICY_OBJECT_REQUIRED'], expiryRules: [] };
  }
  if (clean(policy.version) !== POLICY_VERSION) blockers.push('C11_POLICY_VERSION_MISMATCH');
  if (clean(policy.policyId) !== context.policyId) blockers.push('C11_POLICY_ID_MISMATCH');
  if (clean(policy.caseId) !== context.caseId) blockers.push('C11_POLICY_CASE_MISMATCH');
  if (clean(policy.propertyRef) !== context.propertyRef) blockers.push('C11_POLICY_PROPERTY_MISMATCH');

  let policyAsOf = null;
  try { policyAsOf = iso(policy.asOfDate, 'policy.asOfDate'); } catch (_) { blockers.push('C11_POLICY_AS_OF_INVALID'); }
  if (policyAsOf && policyAsOf !== context.asOfDate) blockers.push('C11_POLICY_AS_OF_MISMATCH');

  if (!validSha(policy.incomeEvidencePacketHashSha256)
      || policy.incomeEvidencePacketHashSha256.toLowerCase() !== context.incomeEvidencePacketHashSha256) {
    blockers.push('C11_POLICY_INCOME_EVIDENCE_HASH_MISMATCH');
  }
  if (!validSha(policy.rentRollHashSha256)
      || policy.rentRollHashSha256.toLowerCase() !== context.rentRollHashSha256) {
    blockers.push('C11_POLICY_RENT_ROLL_HASH_MISMATCH');
  }

  const expectedBindings = JSON.stringify(context.tenantAssessmentBindings);
  const actualBindings = JSON.stringify(tenantAssessmentBindings(policy.tenantAssessmentBindings));
  if (actualBindings !== expectedBindings) blockers.push('C11_POLICY_TENANT_ASSESSMENT_BINDINGS_MISMATCH');

  if (!finiteRatio(policy.minimumOccupancyRatio)) blockers.push('C11_POLICY_MINIMUM_OCCUPANCY_RATIO_INVALID');
  if (!finiteRatio(policy.maximumTopTenantRentShare)) blockers.push('C11_POLICY_MAX_TOP_TENANT_RENT_SHARE_INVALID');
  if (!finiteRatio(policy.maximumTopThreeTenantRentShare)) blockers.push('C11_POLICY_MAX_TOP_THREE_TENANT_RENT_SHARE_INVALID');

  const expiryRules = [];
  const seenHorizons = new Set();
  if (!Array.isArray(policy.expiryConcentrationRules) || policy.expiryConcentrationRules.length === 0) {
    blockers.push('C11_POLICY_EXPIRY_RULES_REQUIRED');
  } else {
    policy.expiryConcentrationRules.forEach((rule, index) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
        blockers.push(`C11_POLICY_EXPIRY_RULE_OBJECT_REQUIRED:${index}`);
        return;
      }
      const horizonMonths = rule.horizonMonths;
      if (!Number.isInteger(horizonMonths) || horizonMonths <= 0) {
        blockers.push(`C11_POLICY_EXPIRY_HORIZON_INVALID:${index}`);
        return;
      }
      if (seenHorizons.has(horizonMonths)) blockers.push(`C11_POLICY_EXPIRY_HORIZON_DUPLICATE:${horizonMonths}`);
      seenHorizons.add(horizonMonths);
      if (!finiteRatio(rule.maximumRentShare)) blockers.push(`C11_POLICY_EXPIRY_MAX_RENT_SHARE_INVALID:${horizonMonths}`);
      expiryRules.push({ horizonMonths, maximumRentShare: rule.maximumRentShare });
    });
  }
  expiryRules.sort((a, b) => a.horizonMonths - b.horizonMonths);

  if (!nonEmpty(policy.reviewedByRef)) blockers.push('C11_POLICY_REVIEWER_REQUIRED');
  if (!nonEmpty(policy.reviewEvidenceRef)) blockers.push('C11_POLICY_REVIEW_EVIDENCE_REQUIRED');
  let reviewedAt = null;
  try { reviewedAt = iso(policy.reviewedAt, 'policy.reviewedAt'); } catch (_) { blockers.push('C11_POLICY_REVIEWED_AT_INVALID'); }
  if (reviewedAt && Date.parse(reviewedAt) < Date.parse(context.asOfDate)) blockers.push('C11_POLICY_REVIEW_BEFORE_AS_OF');

  const computedHash = computeIncomeAssetReviewPolicyHash(policy);
  if (!validSha(policy.policyHashSha256) || !computedHash || computedHash !== policy.policyHashSha256.toLowerCase()) {
    blockers.push('C11_POLICY_INTEGRITY_HASH_MISMATCH');
  }

  return { blockers, expiryRules };
}

function baseResult({ status, blockers, context = {}, metrics = null, tenants = [], expiryConcentration = [], riskFlags = [] }) {
  return deepFreeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status,
    professionalIncomeAssetReviewReady: status === INCOME_ASSET_STATUS.READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    asOfDate: context.asOfDate || null,
    incomeEvidencePacketHashSha256: context.incomeEvidencePacketHashSha256 || null,
    rentRollHashSha256: context.rentRollHashSha256 || null,
    reviewPolicyId: context.policyId || null,
    metrics,
    tenants: Object.freeze(tenants),
    expiryConcentration: Object.freeze(expiryConcentration),
    riskFlags: Object.freeze(riskFlags),
    blockers: Object.freeze([...new Set(blockers)]),
    tenantStrengthAutomaticallyScored: false,
    marketRentApplied: false,
    leaseOptionsAutomaticallyExercised: false,
    noiForecastGenerated: false,
    capitalizationPerformed: false,
    dcfPerformed: false,
    capRateDerived: false,
    discountRateDerived: false,
    certifiedValuationEstablished: false,
    automaticUnderwritingAdoption: false,
    automaticAcquisitionRecommendation: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    decisionBinding: false,
    productionAuthorityGranted: false,
    publicAiAuthorized: false,
    commercialGoLiveAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    semantics: 'C11 derives deterministic contractual income-asset and concentration metrics only from an integrity-valid reconciled lease-income packet and its exact verified rent-roll snapshot. Tenant strength bands and review thresholds must be explicitly professionally supplied and integrity-bound. C11 does not infer credit scores, market rent, cap rates, discount rates, NOI forecasts, valuation conclusions, underwriting adoption, transaction authority or production authority.',
  });
}

function evaluateGovernedIncomeAssetIntelligence({
  incomeEvidencePacket,
  rentRollSnapshot,
  tenantStrengthAssessments,
  reviewPolicyId,
  governedReviewPolicies = {},
} = {}) {
  const context = {
    caseId: clean(incomeEvidencePacket?.caseId) || null,
    propertyRef: clean(incomeEvidencePacket?.propertyRef) || null,
    asOfDate: null,
    incomeEvidencePacketHashSha256: clean(incomeEvidencePacket?.incomeEvidencePacketHashSha256).toLowerCase() || null,
    rentRollHashSha256: clean(rentRollSnapshot?.rentRollHashSha256).toLowerCase() || null,
    policyId: clean(reviewPolicyId) || null,
  };

  try { context.asOfDate = iso(incomeEvidencePacket?.asOfDate, 'incomeEvidencePacket.asOfDate'); } catch (_) {}

  if (!incomeEvidencePacket
      || incomeEvidencePacket.status !== LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF
      || incomeEvidencePacket.readyForIncomeAnalysisHandoff !== true) {
    return baseResult({
      status: INCOME_ASSET_STATUS.HOLD_UPSTREAM_EVIDENCE,
      blockers: ['C11_INCOME_EVIDENCE_PACKET_NOT_READY'],
      context,
    });
  }
  if (!verifyIncomeEvidencePacketIntegrity(incomeEvidencePacket)) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_INTEGRITY, blockers: ['C11_INCOME_EVIDENCE_PACKET_INTEGRITY_FAILED'], context });
  }
  if (!rentRollSnapshot || !verifyRentRollSnapshotIntegrity(rentRollSnapshot)) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_INTEGRITY, blockers: ['C11_RENT_ROLL_INTEGRITY_FAILED'], context });
  }
  if (clean(rentRollSnapshot.caseId) !== context.caseId || clean(rentRollSnapshot.propertyRef) !== context.propertyRef) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_INTEGRITY, blockers: ['C11_CASE_OR_PROPERTY_ISOLATION_VIOLATION'], context });
  }
  let snapshotAsOf;
  try { snapshotAsOf = iso(rentRollSnapshot.asOfDate, 'rentRollSnapshot.asOfDate'); } catch (_) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_INTEGRITY, blockers: ['C11_RENT_ROLL_AS_OF_INVALID'], context });
  }
  if (snapshotAsOf !== context.asOfDate) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_INTEGRITY, blockers: ['C11_RENT_ROLL_AS_OF_MISMATCH'], context });
  }
  if (context.rentRollHashSha256 !== clean(incomeEvidencePacket.rentRollHashSha256).toLowerCase()) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_INTEGRITY, blockers: ['C11_RENT_ROLL_PACKET_HASH_MISMATCH'], context });
  }

  const activeLeases = Array.isArray(incomeEvidencePacket.activeLeases) ? incomeEvidencePacket.activeLeases : [];
  if (activeLeases.length === 0) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_UPSTREAM_EVIDENCE, blockers: ['C11_ACTIVE_LEASES_REQUIRED'], context });
  }

  const metricBlockers = [];
  const totalLettableAreaSqm = rentRollSnapshot.totalLettableAreaSqm;
  const occupiedAreaSqm = incomeEvidencePacket.occupiedAreaSqm;
  const annualContractRentSar = incomeEvidencePacket.annualContractRentSar;
  if (!(Number.isFinite(totalLettableAreaSqm) && totalLettableAreaSqm > 0)) metricBlockers.push('C11_TOTAL_LETTABLE_AREA_INVALID');
  if (!(Number.isFinite(occupiedAreaSqm) && occupiedAreaSqm >= 0)) metricBlockers.push('C11_OCCUPIED_AREA_INVALID');
  if (!(Number.isFinite(annualContractRentSar) && annualContractRentSar >= 0)) metricBlockers.push('C11_ANNUAL_CONTRACT_RENT_INVALID');
  if (Number.isFinite(totalLettableAreaSqm) && Number.isFinite(occupiedAreaSqm) && occupiedAreaSqm > totalLettableAreaSqm) metricBlockers.push('C11_OCCUPIED_AREA_EXCEEDS_TOTAL');

  const leaseArea = activeLeases.reduce((sum, lease) => sum + (Number.isFinite(lease?.areaSqm) ? lease.areaSqm : Number.NaN), 0);
  const leaseRent = activeLeases.reduce((sum, lease) => sum + (Number.isFinite(lease?.contractedAnnualRentSarAsOfDate) ? lease.contractedAnnualRentSarAsOfDate : Number.NaN), 0);
  if (!Number.isFinite(leaseArea) || leaseArea !== occupiedAreaSqm) metricBlockers.push('C11_ACTIVE_LEASE_AREA_RECONCILIATION_FAILED');
  if (!Number.isFinite(leaseRent) || leaseRent !== annualContractRentSar) metricBlockers.push('C11_ACTIVE_LEASE_RENT_RECONCILIATION_FAILED');
  if (activeLeases.some((lease) => lease?.verification?.status !== LEASE_VERIFICATION_STATUS.VERIFIED)) metricBlockers.push('C11_ACTIVE_LEASE_VERIFICATION_REQUIRED');
  if (metricBlockers.length) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_METRICS, blockers: metricBlockers, context });
  }

  if (!Array.isArray(tenantStrengthAssessments)) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_TENANT_EVIDENCE, blockers: ['C11_TENANT_ASSESSMENTS_REQUIRED'], context });
  }
  const assessmentMap = new Map();
  const tenantBlockers = [];
  for (const assessment of tenantStrengthAssessments) {
    const tenantRef = clean(assessment?.tenantRef);
    if (!tenantRef) { tenantBlockers.push('C11_TENANT_ASSESSMENT_TENANT_REF_REQUIRED'); continue; }
    if (assessmentMap.has(tenantRef)) { tenantBlockers.push(`C11_DUPLICATE_TENANT_ASSESSMENT:${tenantRef}`); continue; }
    if (!verifyTenantStrengthAssessmentIntegrity(assessment)) { tenantBlockers.push(`C11_TENANT_ASSESSMENT_INTEGRITY_FAILED:${tenantRef}`); continue; }
    if (clean(assessment.caseId) !== context.caseId || clean(assessment.propertyRef) !== context.propertyRef) {
      tenantBlockers.push(`C11_TENANT_ASSESSMENT_ISOLATION_MISMATCH:${tenantRef}`); continue;
    }
    const assessedAtMs = Date.parse(assessment.assessedAt);
    const validUntilMs = Date.parse(assessment.validUntil);
    const asOfMs = Date.parse(context.asOfDate);
    if (!Number.isFinite(assessedAtMs) || !Number.isFinite(validUntilMs)) { tenantBlockers.push(`C11_TENANT_ASSESSMENT_DATE_INVALID:${tenantRef}`); continue; }
    if (assessedAtMs > asOfMs) { tenantBlockers.push(`C11_TENANT_ASSESSMENT_AFTER_AS_OF:${tenantRef}`); continue; }
    if (validUntilMs < asOfMs) { tenantBlockers.push(`C11_TENANT_ASSESSMENT_EXPIRED:${tenantRef}`); continue; }
    if (assessment.professionalAssessmentSupplied !== true || assessment.automaticallyScored !== false) {
      tenantBlockers.push(`C11_TENANT_ASSESSMENT_AUTHORITY_INVALID:${tenantRef}`); continue;
    }
    assessmentMap.set(tenantRef, assessment);
  }

  const activeTenantRefs = [...new Set(activeLeases.map((lease) => clean(lease.tenantRef)).filter(Boolean))].sort();
  activeTenantRefs.forEach((tenantRef) => {
    if (!assessmentMap.has(tenantRef)) tenantBlockers.push(`C11_ACTIVE_TENANT_ASSESSMENT_MISSING:${tenantRef}`);
  });
  for (const tenantRef of assessmentMap.keys()) {
    if (!activeTenantRefs.includes(tenantRef)) tenantBlockers.push(`C11_INACTIVE_TENANT_ASSESSMENT_NOT_ALLOWED:${tenantRef}`);
  }
  if (tenantBlockers.length) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_TENANT_EVIDENCE, blockers: tenantBlockers, context });
  }

  context.tenantAssessmentBindings = tenantAssessmentBindings(tenantStrengthAssessments);
  if (!context.policyId) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_POLICY, blockers: ['C11_GOVERNED_POLICY_ID_REQUIRED'], context });
  }
  if (!governedReviewPolicies || typeof governedReviewPolicies !== 'object' || Array.isArray(governedReviewPolicies)) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_POLICY, blockers: ['C11_GOVERNED_POLICY_REGISTRY_REQUIRED'], context });
  }
  const policy = governedReviewPolicies[context.policyId];
  if (!policy) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_POLICY, blockers: [`C11_GOVERNED_POLICY_NOT_FOUND:${context.policyId}`], context });
  }
  const policyValidation = validatePolicy(policy, context);
  if (policyValidation.blockers.some((item) => item.includes('_HASH_MISMATCH') || item.includes('INTEGRITY_HASH'))) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_INTEGRITY, blockers: policyValidation.blockers, context });
  }
  if (policyValidation.blockers.length) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_POLICY, blockers: policyValidation.blockers, context });
  }

  const tenantAggregates = new Map();
  for (const lease of activeLeases) {
    const tenantRef = clean(lease.tenantRef);
    const existing = tenantAggregates.get(tenantRef) || { tenantRef, annualContractRentSar: 0, occupiedAreaSqm: 0, leaseIds: [], leaseEvidenceHashes: [] };
    existing.annualContractRentSar += lease.contractedAnnualRentSarAsOfDate;
    existing.occupiedAreaSqm += lease.areaSqm;
    existing.leaseIds.push(lease.leaseId);
    existing.leaseEvidenceHashes.push(lease.leaseEvidenceHashSha256);
    tenantAggregates.set(tenantRef, existing);
  }

  const tenants = [...tenantAggregates.values()].map((tenant) => {
    const assessment = assessmentMap.get(tenant.tenantRef);
    return {
      tenantRef: tenant.tenantRef,
      annualContractRentSar: tenant.annualContractRentSar,
      occupiedAreaSqm: tenant.occupiedAreaSqm,
      rentShare: annualContractRentSar > 0 ? tenant.annualContractRentSar / annualContractRentSar : 0,
      occupiedAreaShare: occupiedAreaSqm > 0 ? tenant.occupiedAreaSqm / occupiedAreaSqm : 0,
      leaseIds: tenant.leaseIds.sort(),
      leaseEvidenceHashes: tenant.leaseEvidenceHashes.sort(),
      strengthBand: assessment.strengthBand,
      tenantStrengthAssessmentId: assessment.assessmentId,
      tenantStrengthAssessmentHashSha256: assessment.assessmentHashSha256,
      tenantStrengthMethodologyRef: assessment.methodologyRef,
      tenantStrengthEvidenceRefs: assessment.evidenceRefs,
      tenantStrengthAssessedByRef: assessment.assessedByRef,
      tenantStrengthAssessedAt: assessment.assessedAt,
      tenantStrengthValidUntil: assessment.validUntil,
    };
  }).sort((a, b) => b.annualContractRentSar - a.annualContractRentSar || a.tenantRef.localeCompare(b.tenantRef));

  const occupancyRatio = occupiedAreaSqm / totalLettableAreaSqm;
  const vacantAreaSqm = totalLettableAreaSqm - occupiedAreaSqm;
  const annualRentPerOccupiedSqmSar = occupiedAreaSqm > 0 ? annualContractRentSar / occupiedAreaSqm : null;
  const topTenantRentShare = tenants.length ? tenants[0].rentShare : 0;
  const topThreeTenantRentShare = tenants.slice(0, 3).reduce((sum, tenant) => sum + tenant.rentShare, 0);
  const tenantRentHhi = tenants.reduce((sum, tenant) => sum + tenant.rentShare ** 2, 0);

  const expiryConcentration = policyValidation.expiryRules.map((rule) => {
    const horizonEnd = addUtcMonthsClamped(context.asOfDate, rule.horizonMonths);
    const leases = activeLeases.filter((lease) => Date.parse(lease.expiryDate) <= Date.parse(horizonEnd));
    const expiringAnnualRentSar = leases.reduce((sum, lease) => sum + lease.contractedAnnualRentSarAsOfDate, 0);
    const rentShare = annualContractRentSar > 0 ? expiringAnnualRentSar / annualContractRentSar : 0;
    return {
      horizonMonths: rule.horizonMonths,
      horizonEnd,
      expiringAnnualRentSar,
      rentShare,
      maximumRentShare: rule.maximumRentShare,
      leaseIds: leases.map((lease) => lease.leaseId).sort(),
      boundarySemantics: 'expiryDate <= calendar-month-clamped horizonEnd',
    };
  });

  const values = [occupancyRatio, vacantAreaSqm, annualRentPerOccupiedSqmSar, topTenantRentShare, topThreeTenantRentShare, tenantRentHhi, ...expiryConcentration.map((item) => item.rentShare)];
  if (values.some((value) => value !== null && !Number.isFinite(value))) {
    return baseResult({ status: INCOME_ASSET_STATUS.HOLD_METRICS, blockers: ['C11_NON_FINITE_DERIVED_METRIC'], context });
  }

  const riskFlags = [];
  if (occupancyRatio < policy.minimumOccupancyRatio) {
    riskFlags.push(`OCCUPANCY_BELOW_POLICY_MINIMUM:${occupancyRatio}:${policy.minimumOccupancyRatio}`);
  }
  if (topTenantRentShare > policy.maximumTopTenantRentShare) {
    riskFlags.push(`TOP_TENANT_RENT_SHARE_ABOVE_POLICY_MAXIMUM:${topTenantRentShare}:${policy.maximumTopTenantRentShare}`);
  }
  if (topThreeTenantRentShare > policy.maximumTopThreeTenantRentShare) {
    riskFlags.push(`TOP_THREE_TENANT_RENT_SHARE_ABOVE_POLICY_MAXIMUM:${topThreeTenantRentShare}:${policy.maximumTopThreeTenantRentShare}`);
  }
  expiryConcentration.forEach((item) => {
    if (item.rentShare > item.maximumRentShare) {
      riskFlags.push(`LEASE_EXPIRY_RENT_SHARE_ABOVE_POLICY_MAXIMUM:${item.horizonMonths}:${item.rentShare}:${item.maximumRentShare}`);
    }
  });

  const metrics = deepFreeze({
    totalLettableAreaSqm,
    occupiedAreaSqm,
    vacantAreaSqm,
    occupancyRatio,
    annualContractRentSar,
    annualRentPerOccupiedSqmSar,
    activeLeaseCount: activeLeases.length,
    activeTenantCount: tenants.length,
    topTenantRentShare,
    topThreeTenantRentShare,
    tenantRentHhi,
    hhiSemantics: 'sum of squared contractual annual-rent shares; mathematical concentration only, no automatic risk interpretation',
    sourceLineage: {
      incomeEvidencePacketHashSha256: context.incomeEvidencePacketHashSha256,
      rentRollHashSha256: context.rentRollHashSha256,
      activeLeaseEvidenceHashes: activeLeases.map((lease) => lease.leaseEvidenceHashSha256).sort(),
      tenantAssessmentBindings: context.tenantAssessmentBindings,
    },
  });

  return baseResult({
    status: INCOME_ASSET_STATUS.READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW,
    blockers: [],
    context,
    metrics,
    tenants,
    expiryConcentration,
    riskFlags,
  });
}

module.exports = {
  CAPABILITY,
  POLICY_VERSION,
  INCOME_ASSET_STATUS,
  createGovernedTenantStrengthAssessment,
  computeTenantStrengthAssessmentHash,
  verifyTenantStrengthAssessmentIntegrity,
  tenantAssessmentBindings,
  computeIncomeAssetReviewPolicyHash,
  verifyIncomeEvidencePacketIntegrity,
  verifyRentRollSnapshotIntegrity,
  evaluateGovernedIncomeAssetIntelligence,
};

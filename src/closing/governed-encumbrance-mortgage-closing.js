'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C13_GOVERNED_ENCUMBRANCE_MORTGAGE_CLOSING_V1';
const POLICY_VERSION = 'C13_CLOSING_REVIEW_POLICY_V1';

const CLOSING_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_CLOSING_REVIEW: 'READY_FOR_PROFESSIONAL_CLOSING_REVIEW',
  HOLD_CONTEXT: 'HOLD_CONTEXT',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_CALCULATION: 'HOLD_CALCULATION',
});

const EVIDENCE_CLASS = Object.freeze({
  MORTGAGE_OR_SECURITY_INTEREST: 'MORTGAGE_OR_SECURITY_INTEREST',
  LIEN_OR_ENCUMBRANCE: 'LIEN_OR_ENCUMBRANCE',
  EASEMENT_OR_RESTRICTION: 'EASEMENT_OR_RESTRICTION',
  PAYOFF_OR_RELEASE_REQUIREMENT: 'PAYOFF_OR_RELEASE_REQUIREMENT',
  CLOSING_CONDITION: 'CLOSING_CONDITION',
});

const PROFESSIONAL_STATUS = Object.freeze({
  OPEN: 'OPEN',
  SETTLEMENT_OR_RELEASE_DOCUMENTED: 'SETTLEMENT_OR_RELEASE_DOCUMENTED',
  VERIFIED_CLEARED: 'VERIFIED_CLEARED',
  NOT_APPLICABLE_BY_PROFESSIONAL_REVIEW: 'NOT_APPLICABLE_BY_PROFESSIONAL_REVIEW',
});

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';
const validSha = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v);
const finiteNN = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function iso(v, field) {
  if (!nonEmpty(v) || !Number.isFinite(Date.parse(v))) throw new TypeError(`${field} must be a valid date/time`);
  return new Date(v).toISOString();
}

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (!v || typeof v !== 'object') return v;
  return Object.keys(v).sort().reduce((out, key) => {
    out[key] = stable(v[key]);
    return out;
  }, {});
}

function sha256(v) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
  } catch (_) {
    return null;
  }
}

function without(v, fields) {
  const out = { ...v };
  fields.forEach((field) => delete out[field]);
  return out;
}

function freeze(v) {
  if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v;
  Object.values(v).forEach(freeze);
  return Object.freeze(v);
}

function computeClosingEvidenceHash(record) {
  return record && typeof record === 'object' && !Array.isArray(record)
    ? sha256(without(record, ['closingEvidenceHashSha256']))
    : null;
}

function verifyClosingEvidenceIntegrity(record) {
  return !!record
    && validSha(record.closingEvidenceHashSha256)
    && computeClosingEvidenceHash(record) === record.closingEvidenceHashSha256.toLowerCase();
}

function createGovernedClosingEvidence(x = {}) {
  const requiredStrings = [
    'recordId', 'caseId', 'propertyRef', 'evidenceClass', 'professionalStatus',
    'sourceAuthority', 'sourceRef', 'sourceEvidenceRef',
    'professionalReviewerRef', 'reviewEvidenceRef',
  ];
  requiredStrings.forEach((field) => {
    if (!nonEmpty(x[field])) throw new TypeError(`${field} must be a non-empty string`);
  });
  if (!Object.values(EVIDENCE_CLASS).includes(x.evidenceClass)) throw new TypeError('C13_EVIDENCE_CLASS_UNSUPPORTED');
  if (!Object.values(PROFESSIONAL_STATUS).includes(x.professionalStatus)) throw new TypeError('C13_PROFESSIONAL_STATUS_UNSUPPORTED');
  if ((x.currency || 'SAR') !== 'SAR') throw new TypeError('C13_PHASE0_REQUIRES_SAR');
  if (!validSha(x.sourceVersionHashSha256)) throw new TypeError('C13_SOURCE_VERSION_HASH_REQUIRED');
  if (!validSha(x.reviewEvidenceHashSha256)) throw new TypeError('C13_REVIEW_EVIDENCE_HASH_REQUIRED');

  const sourceVerifiedAt = iso(x.sourceVerifiedAt, 'sourceVerifiedAt');
  const sourceReviewAfter = iso(x.sourceReviewAfter, 'sourceReviewAfter');
  const reviewedAt = iso(x.reviewedAt, 'reviewedAt');
  const validUntil = iso(x.validUntil, 'validUntil');
  if (Date.parse(sourceReviewAfter) < Date.parse(sourceVerifiedAt)) throw new TypeError('C13_SOURCE_REVIEW_AFTER_BEFORE_VERIFIED_AT');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C13_VALID_UNTIL_BEFORE_REVIEWED_AT');

  let settlementAmountSar = null;
  if (x.settlementAmountSar != null) {
    if (!finiteNN(x.settlementAmountSar)) throw new TypeError('C13_SETTLEMENT_AMOUNT_SAR_INVALID');
    settlementAmountSar = x.settlementAmountSar;
  }
  let payoffValidUntil = null;
  if (x.payoffValidUntil != null) {
    payoffValidUntil = iso(x.payoffValidUntil, 'payoffValidUntil');
  }
  if (payoffValidUntil && settlementAmountSar == null) throw new TypeError('C13_PAYOFF_VALIDITY_WITHOUT_SETTLEMENT_AMOUNT');

  const core = {
    schemaVersion: 1,
    recordId: x.recordId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    evidenceClass: x.evidenceClass,
    professionalStatus: x.professionalStatus,
    currency: 'SAR',
    settlementAmountSar,
    payoffValidUntil,
    sourceAuthority: x.sourceAuthority.trim(),
    sourceRef: x.sourceRef.trim(),
    sourceEvidenceRef: x.sourceEvidenceRef.trim(),
    sourceVersionHashSha256: x.sourceVersionHashSha256.toLowerCase(),
    sourceVerifiedAt,
    sourceReviewAfter,
    professionalReviewerRef: x.professionalReviewerRef.trim(),
    reviewedAt,
    validUntil,
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewEvidenceHashSha256: x.reviewEvidenceHashSha256.toLowerCase(),
    statusExternallyDetermined: true,
    legalTitleValidityEstablishedBySoftware: false,
    lienPriorityDeterminedBySoftware: false,
    releaseEffectivenessDeterminedBySoftware: false,
    legalInterpretationPerformedBySoftware: false,
  };
  return freeze({ ...core, closingEvidenceHashSha256: sha256(core) });
}

function closingEvidenceBindings(records) {
  if (!Array.isArray(records)) return [];
  return records.map((record) => ({
    recordId: clean(record?.recordId) || null,
    closingEvidenceHashSha256: clean(record?.closingEvidenceHashSha256).toLowerCase() || null,
  })).sort((a, b) => String(a.recordId).localeCompare(String(b.recordId)));
}

function computeClosingReviewPolicyHash(policy) {
  return policy && typeof policy === 'object' && !Array.isArray(policy)
    ? sha256(without(policy, ['policyHashSha256']))
    : null;
}

function validatePolicy(policy, context) {
  const blockers = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return ['C13_GOVERNED_POLICY_OBJECT_REQUIRED'];
  if (clean(policy.version) !== POLICY_VERSION) blockers.push('C13_POLICY_VERSION_MISMATCH');
  if (clean(policy.policyId) !== context.policyId) blockers.push('C13_POLICY_ID_MISMATCH');
  if (clean(policy.caseId) !== context.caseId) blockers.push('C13_POLICY_CASE_MISMATCH');
  if (clean(policy.propertyRef) !== context.propertyRef) blockers.push('C13_POLICY_PROPERTY_MISMATCH');

  for (const [field, label, expected] of [
    ['asOfDate', 'AS_OF_DATE', context.asOfDate],
    ['targetClosingDate', 'TARGET_CLOSING_DATE', context.targetClosingDate],
  ]) {
    let actual = null;
    try { actual = iso(policy[field], `policy.${field}`); } catch (_) { blockers.push(`C13_POLICY_${label}_INVALID`); }
    if (actual && actual !== expected) blockers.push(`C13_POLICY_${label}_MISMATCH`);
  }

  if (JSON.stringify(closingEvidenceBindings(policy.evidenceBindings)) !== JSON.stringify(context.evidenceBindings)) {
    blockers.push('C13_POLICY_EVIDENCE_BINDINGS_MISMATCH');
  }

  const allowedClasses = Array.isArray(policy.allowedEvidenceClasses) ? [...new Set(policy.allowedEvidenceClasses)] : [];
  const requiredClasses = Array.isArray(policy.requiredEvidenceClasses) ? [...new Set(policy.requiredEvidenceClasses)] : [];
  const unresolvedStatuses = Array.isArray(policy.unresolvedStatuses) ? [...new Set(policy.unresolvedStatuses)] : [];
  if (!allowedClasses.length || allowedClasses.some((x) => !Object.values(EVIDENCE_CLASS).includes(x))) blockers.push('C13_POLICY_ALLOWED_CLASSES_INVALID');
  if (requiredClasses.some((x) => !allowedClasses.includes(x))) blockers.push('C13_POLICY_REQUIRED_CLASS_NOT_ALLOWED');
  if (unresolvedStatuses.some((x) => !Object.values(PROFESSIONAL_STATUS).includes(x))) blockers.push('C13_POLICY_UNRESOLVED_STATUSES_INVALID');
  if (typeof policy.allowUnknownSettlementAmounts !== 'boolean') blockers.push('C13_POLICY_UNKNOWN_SETTLEMENT_RULE_REQUIRED');
  if (!nonEmpty(policy.reviewedByRef)) blockers.push('C13_POLICY_REVIEWER_REQUIRED');
  if (!nonEmpty(policy.reviewEvidenceRef)) blockers.push('C13_POLICY_REVIEW_EVIDENCE_REQUIRED');
  let reviewedAt = null;
  try { reviewedAt = iso(policy.reviewedAt, 'policy.reviewedAt'); } catch (_) { blockers.push('C13_POLICY_REVIEWED_AT_INVALID'); }
  if (reviewedAt && Date.parse(reviewedAt) > Date.parse(context.asOfDate)) blockers.push('C13_POLICY_REVIEW_AFTER_AS_OF');
  const hash = computeClosingReviewPolicyHash(policy);
  if (!validSha(policy.policyHashSha256) || !hash || hash !== policy.policyHashSha256.toLowerCase()) blockers.push('C13_POLICY_INTEGRITY_HASH_MISMATCH');
  return blockers;
}

function result(status, blockers, context = {}, records = [], riskFlags = [], knownSettlementTotalSar = null, unknownSettlementRecordIds = []) {
  const ready = status === CLOSING_STATUS.READY_FOR_PROFESSIONAL_CLOSING_REVIEW;
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status,
    professionalClosingReviewReady: ready,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    asOfDate: context.asOfDate || null,
    targetClosingDate: context.targetClosingDate || null,
    reviewPolicyId: context.policyId || null,
    reviewPolicyHashSha256: context.policyHashSha256 || null,
    evidenceBindings: context.evidenceBindings || [],
    records,
    knownSettlementTotalSar: ready ? knownSettlementTotalSar : null,
    unknownSettlementRecordIds: ready ? unknownSettlementRecordIds : [],
    riskFlags,
    blockers: [...new Set(blockers)],
    legalTitleOpinionEstablished: false,
    lienPriorityDetermined: false,
    mortgageReleaseLegallyConfirmed: false,
    easementOrRestrictionLegallyInterpreted: false,
    lenderPayoffGenerated: false,
    acquisitionTransactionCostCalculated: false,
    exitTransactionCostCalculated: false,
    regulatoryCarryCostCalculated: false,
    valuationCalculated: false,
    npvCalculated: false,
    irrCalculated: false,
    automaticUnderwritingAdoption: false,
    automaticClosingRecommendation: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    decisionBinding: false,
    productionAuthorityGranted: false,
    publicAiAuthorized: false,
    commercialGoLiveAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    semantics: 'C13 organizes explicit professional closing evidence and aggregates only explicit known SAR settlement amounts. It does not determine title validity, lien priority, legal effect of releases, legal interpretation, lender payoff, transfer authority, transaction approval, or production authority.',
  });
}

function evaluateGovernedClosingIntelligence(x = {}) {
  const context = {
    caseId: clean(x.caseId) || null,
    propertyRef: clean(x.propertyRef) || null,
    asOfDate: null,
    targetClosingDate: null,
    policyId: clean(x.reviewPolicyId) || null,
    evidenceBindings: [],
  };
  const contextBlockers = [];
  if (!context.caseId) contextBlockers.push('C13_CASE_ID_REQUIRED');
  if (!context.propertyRef) contextBlockers.push('C13_PROPERTY_REF_REQUIRED');
  try { context.asOfDate = iso(x.asOfDate, 'asOfDate'); } catch (_) { contextBlockers.push('C13_AS_OF_DATE_INVALID'); }
  try { context.targetClosingDate = iso(x.targetClosingDate, 'targetClosingDate'); } catch (_) { contextBlockers.push('C13_TARGET_CLOSING_DATE_INVALID'); }
  if (context.asOfDate && context.targetClosingDate && Date.parse(context.targetClosingDate) < Date.parse(context.asOfDate)) contextBlockers.push('C13_TARGET_CLOSING_BEFORE_AS_OF');
  if (contextBlockers.length) return result(CLOSING_STATUS.HOLD_CONTEXT, contextBlockers, context);

  if (!Array.isArray(x.closingEvidence) || !x.closingEvidence.length) {
    return result(CLOSING_STATUS.HOLD_EVIDENCE, ['C13_CLOSING_EVIDENCE_REQUIRED'], context);
  }

  const evidenceBlockers = [];
  const seen = new Set();
  const records = [];
  const asOf = Date.parse(context.asOfDate);
  const targetClosing = Date.parse(context.targetClosingDate);

  for (const record of x.closingEvidence) {
    const id = clean(record?.recordId);
    if (!id) { evidenceBlockers.push('C13_RECORD_ID_REQUIRED'); continue; }
    if (seen.has(id)) { evidenceBlockers.push(`C13_DUPLICATE_RECORD_ID:${id}`); continue; }
    seen.add(id);
    if (!verifyClosingEvidenceIntegrity(record)) { evidenceBlockers.push(`C13_EVIDENCE_INTEGRITY_FAILED:${id}`); continue; }
    if (clean(record.caseId) !== context.caseId || clean(record.propertyRef) !== context.propertyRef) { evidenceBlockers.push(`C13_EVIDENCE_CONTEXT_MISMATCH:${id}`); continue; }
    if (!Object.values(EVIDENCE_CLASS).includes(record.evidenceClass) || !Object.values(PROFESSIONAL_STATUS).includes(record.professionalStatus)) { evidenceBlockers.push(`C13_EVIDENCE_CLASS_OR_STATUS_INVALID:${id}`); continue; }
    if (record.currency !== 'SAR') { evidenceBlockers.push(`C13_EVIDENCE_CURRENCY_INVALID:${id}`); continue; }
    const sv = Date.parse(record.sourceVerifiedAt);
    const sr = Date.parse(record.sourceReviewAfter);
    const rv = Date.parse(record.reviewedAt);
    const vu = Date.parse(record.validUntil);
    if (![sv, sr, rv, vu].every(Number.isFinite)) { evidenceBlockers.push(`C13_EVIDENCE_DATES_INVALID:${id}`); continue; }
    if (sv > asOf || sr < asOf || sr < sv) { evidenceBlockers.push(`C13_SOURCE_STALE_OR_FUTURE:${id}`); continue; }
    if (rv > asOf) { evidenceBlockers.push(`C13_REVIEW_AFTER_AS_OF:${id}`); continue; }
    if (vu < targetClosing) { evidenceBlockers.push(`C13_EVIDENCE_EXPIRES_BEFORE_TARGET_CLOSING:${id}`); continue; }
    if (!validSha(record.sourceVersionHashSha256) || !validSha(record.reviewEvidenceHashSha256)) { evidenceBlockers.push(`C13_SOURCE_OR_REVIEW_HASH_INVALID:${id}`); continue; }
    if (record.statusExternallyDetermined !== true || record.legalTitleValidityEstablishedBySoftware !== false || record.lienPriorityDeterminedBySoftware !== false || record.releaseEffectivenessDeterminedBySoftware !== false) { evidenceBlockers.push(`C13_EVIDENCE_AUTHORITY_INVALID:${id}`); continue; }
    if (record.settlementAmountSar != null && !finiteNN(record.settlementAmountSar)) { evidenceBlockers.push(`C13_SETTLEMENT_AMOUNT_INVALID:${id}`); continue; }
    if (record.payoffValidUntil != null) {
      const pv = Date.parse(record.payoffValidUntil);
      if (!Number.isFinite(pv) || record.settlementAmountSar == null) { evidenceBlockers.push(`C13_PAYOFF_VALIDITY_INVALID:${id}`); continue; }
      if (pv < targetClosing) { evidenceBlockers.push(`C13_PAYOFF_EXPIRES_BEFORE_TARGET_CLOSING:${id}`); continue; }
    }
    records.push(record);
  }
  if (evidenceBlockers.length) return result(CLOSING_STATUS.HOLD_INTEGRITY, evidenceBlockers, context);

  context.evidenceBindings = closingEvidenceBindings(records);
  if (!context.policyId) return result(CLOSING_STATUS.HOLD_POLICY, ['C13_GOVERNED_POLICY_ID_REQUIRED'], context);
  if (!x.governedReviewPolicies || typeof x.governedReviewPolicies !== 'object' || Array.isArray(x.governedReviewPolicies)) {
    return result(CLOSING_STATUS.HOLD_POLICY, ['C13_GOVERNED_POLICY_REGISTRY_REQUIRED'], context);
  }
  const policy = x.governedReviewPolicies[context.policyId];
  if (!policy) return result(CLOSING_STATUS.HOLD_POLICY, [`C13_GOVERNED_POLICY_NOT_FOUND:${context.policyId}`], context);
  const policyBlockers = validatePolicy(policy, context);
  if (policyBlockers.some((b) => b.includes('INTEGRITY_HASH') || b.includes('BINDINGS_MISMATCH'))) return result(CLOSING_STATUS.HOLD_INTEGRITY, policyBlockers, context);
  if (policyBlockers.length) return result(CLOSING_STATUS.HOLD_POLICY, policyBlockers, context);
  context.policyHashSha256 = policy.policyHashSha256.toLowerCase();

  const allowedClasses = new Set(policy.allowedEvidenceClasses);
  const policyRuleBlockers = [];
  for (const record of records) {
    if (!allowedClasses.has(record.evidenceClass)) policyRuleBlockers.push(`C13_EVIDENCE_CLASS_NOT_ALLOWED:${record.recordId}:${record.evidenceClass}`);
  }
  const observedClasses = new Set(records.map((record) => record.evidenceClass));
  for (const requiredClass of policy.requiredEvidenceClasses || []) {
    if (!observedClasses.has(requiredClass)) policyRuleBlockers.push(`C13_REQUIRED_EVIDENCE_CLASS_MISSING:${requiredClass}`);
  }
  const unknownSettlementRecordIds = records
    .filter((record) => record.settlementAmountSar == null && policy.unresolvedStatuses.includes(record.professionalStatus))
    .map((record) => record.recordId)
    .sort();
  if (!policy.allowUnknownSettlementAmounts && unknownSettlementRecordIds.length) {
    policyRuleBlockers.push(`C13_UNKNOWN_SETTLEMENT_AMOUNTS_NOT_ALLOWED:${unknownSettlementRecordIds.join(',')}`);
  }
  if (policyRuleBlockers.length) return result(CLOSING_STATUS.HOLD_POLICY, policyRuleBlockers, context);

  const knownSettlementTotalSar = records.reduce((sum, record) => sum + (record.settlementAmountSar == null ? 0 : record.settlementAmountSar), 0);
  if (!finiteNN(knownSettlementTotalSar)) return result(CLOSING_STATUS.HOLD_CALCULATION, ['C13_KNOWN_SETTLEMENT_TOTAL_INVALID'], context);

  const riskFlags = records
    .filter((record) => policy.unresolvedStatuses.includes(record.professionalStatus))
    .map((record) => `UNRESOLVED_BY_GOVERNED_POLICY:${record.recordId}:${record.professionalStatus}`)
    .sort();

  const summaries = records.map((record) => ({
    recordId: record.recordId,
    evidenceClass: record.evidenceClass,
    professionalStatus: record.professionalStatus,
    currency: record.currency,
    settlementAmountSar: record.settlementAmountSar,
    payoffValidUntil: record.payoffValidUntil,
    sourceAuthority: record.sourceAuthority,
    sourceRef: record.sourceRef,
    sourceEvidenceRef: record.sourceEvidenceRef,
    sourceVersionHashSha256: record.sourceVersionHashSha256,
    sourceVerifiedAt: record.sourceVerifiedAt,
    sourceReviewAfter: record.sourceReviewAfter,
    professionalReviewerRef: record.professionalReviewerRef,
    reviewedAt: record.reviewedAt,
    validUntil: record.validUntil,
    reviewEvidenceRef: record.reviewEvidenceRef,
    reviewEvidenceHashSha256: record.reviewEvidenceHashSha256,
    closingEvidenceHashSha256: record.closingEvidenceHashSha256,
  })).sort((a, b) => a.recordId.localeCompare(b.recordId));

  return result(
    CLOSING_STATUS.READY_FOR_PROFESSIONAL_CLOSING_REVIEW,
    [],
    context,
    summaries,
    riskFlags,
    knownSettlementTotalSar,
    unknownSettlementRecordIds,
  );
}

module.exports = {
  CAPABILITY,
  POLICY_VERSION,
  CLOSING_STATUS,
  EVIDENCE_CLASS,
  PROFESSIONAL_STATUS,
  createGovernedClosingEvidence,
  computeClosingEvidenceHash,
  verifyClosingEvidenceIntegrity,
  closingEvidenceBindings,
  computeClosingReviewPolicyHash,
  evaluateGovernedClosingIntelligence,
};
'use strict';

const crypto = require('crypto');
const { LEASE_INCOME_GATE_STATUS } = require('../market/lease-income-evidence');
const { verifyIncomeEvidencePacketIntegrity } = require('../income/governed-income-asset-intelligence');

const CAPABILITY = 'C15_GOVERNED_RENTAL_REGULATION_INTELLIGENCE_V1';
const POLICY_VERSION = 'C15_RENTAL_REGULATION_REVIEW_POLICY_V1';

const RENTAL_REGULATION_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_RENTAL_REGULATION_REVIEW: 'READY_FOR_PROFESSIONAL_RENTAL_REGULATION_REVIEW',
  HOLD_UPSTREAM_EVIDENCE: 'HOLD_UPSTREAM_EVIDENCE',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_APPLICABILITY: 'HOLD_APPLICABILITY',
  HOLD_AMBIGUITY: 'HOLD_AMBIGUITY',
  HOLD_CALCULATION: 'HOLD_CALCULATION',
});

const RENTAL_ACTION_TYPE = Object.freeze({
  ANNUAL_RENT_CHANGE: 'ANNUAL_RENT_CHANGE',
  NOTICE_EVENT: 'NOTICE_EVENT',
  RENEWAL_EVENT: 'RENEWAL_EVENT',
  TERMINATION_EVENT: 'TERMINATION_EVENT',
  REGISTRATION_OR_DOCUMENTATION_EVENT: 'REGISTRATION_OR_DOCUMENTATION_EVENT',
});

const RENTAL_RULE_CLASS = Object.freeze({
  RENT_ADJUSTMENT: 'RENT_ADJUSTMENT',
  NOTICE_PERIOD: 'NOTICE_PERIOD',
  RENEWAL_OR_TERM: 'RENEWAL_OR_TERM',
  REGISTRATION_OR_DOCUMENTATION: 'REGISTRATION_OR_DOCUMENTATION',
  OTHER_RENTAL_REGULATION: 'OTHER_RENTAL_REGULATION',
});

const NUMERIC_BASIS = Object.freeze({
  NO_NUMERIC_CONSTRAINT: 'NO_NUMERIC_CONSTRAINT',
  NO_RENT_INCREASE: 'NO_RENT_INCREASE',
  MAX_INCREASE_RATE_FROM_CURRENT_CONTRACT_RENT: 'MAX_INCREASE_RATE_FROM_CURRENT_CONTRACT_RENT',
  MAX_ANNUAL_RENT_SAR: 'MAX_ANNUAL_RENT_SAR',
  MIN_NOTICE_DAYS: 'MIN_NOTICE_DAYS',
});

const APPLICABILITY_STATUS = Object.freeze({
  APPLIES: 'APPLIES',
  DOES_NOT_APPLY: 'DOES_NOT_APPLY',
  UNRESOLVED: 'UNRESOLVED',
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

function normalizeNumericValue(basis, value) {
  if (basis === NUMERIC_BASIS.NO_NUMERIC_CONSTRAINT || basis === NUMERIC_BASIS.NO_RENT_INCREASE) {
    if (value != null) throw new TypeError(`C15_NUMERIC_VALUE_NOT_ALLOWED:${basis}`);
    return null;
  }
  if (basis === NUMERIC_BASIS.MAX_INCREASE_RATE_FROM_CURRENT_CONTRACT_RENT) {
    if (!finiteNN(value) || value > 1) throw new TypeError('C15_MAX_INCREASE_RATE_INVALID');
    return value;
  }
  if (basis === NUMERIC_BASIS.MAX_ANNUAL_RENT_SAR) {
    if (!finiteNN(value)) throw new TypeError('C15_MAX_ANNUAL_RENT_INVALID');
    return value;
  }
  if (basis === NUMERIC_BASIS.MIN_NOTICE_DAYS) {
    if (!Number.isInteger(value) || value < 0) throw new TypeError('C15_MIN_NOTICE_DAYS_INVALID');
    return value;
  }
  throw new TypeError(`C15_NUMERIC_BASIS_UNSUPPORTED:${basis}`);
}

function validateRuleClassBasis(ruleClass, basis) {
  if (!Object.values(RENTAL_RULE_CLASS).includes(ruleClass)) throw new TypeError(`C15_RULE_CLASS_UNSUPPORTED:${ruleClass}`);
  if (!Object.values(NUMERIC_BASIS).includes(basis)) throw new TypeError(`C15_NUMERIC_BASIS_UNSUPPORTED:${basis}`);
  const allowed = {
    [RENTAL_RULE_CLASS.RENT_ADJUSTMENT]: new Set([
      NUMERIC_BASIS.NO_NUMERIC_CONSTRAINT,
      NUMERIC_BASIS.NO_RENT_INCREASE,
      NUMERIC_BASIS.MAX_INCREASE_RATE_FROM_CURRENT_CONTRACT_RENT,
      NUMERIC_BASIS.MAX_ANNUAL_RENT_SAR,
    ]),
    [RENTAL_RULE_CLASS.NOTICE_PERIOD]: new Set([
      NUMERIC_BASIS.NO_NUMERIC_CONSTRAINT,
      NUMERIC_BASIS.MIN_NOTICE_DAYS,
    ]),
    [RENTAL_RULE_CLASS.RENEWAL_OR_TERM]: new Set([NUMERIC_BASIS.NO_NUMERIC_CONSTRAINT]),
    [RENTAL_RULE_CLASS.REGISTRATION_OR_DOCUMENTATION]: new Set([NUMERIC_BASIS.NO_NUMERIC_CONSTRAINT]),
    [RENTAL_RULE_CLASS.OTHER_RENTAL_REGULATION]: new Set([NUMERIC_BASIS.NO_NUMERIC_CONSTRAINT]),
  };
  if (!allowed[ruleClass].has(basis)) throw new TypeError(`C15_RULE_CLASS_NUMERIC_BASIS_MISMATCH:${ruleClass}:${basis}`);
}

function computeRentalRegulationEvidenceHash(record) {
  return record && typeof record === 'object' && !Array.isArray(record)
    ? sha256(without(record, ['regulationEvidenceHashSha256']))
    : null;
}

function verifyRentalRegulationEvidenceIntegrity(record) {
  return !!record
    && validSha(record.regulationEvidenceHashSha256)
    && computeRentalRegulationEvidenceHash(record) === record.regulationEvidenceHashSha256.toLowerCase();
}

function createGovernedRentalRegulationEvidence(x = {}) {
  const required = [
    'ruleId', 'caseId', 'propertyRef', 'leaseId', 'sourceAuthority', 'sourceRef', 'sourceEvidenceRef',
    'professionalReviewerRef', 'applicabilityEvidenceRef', 'reviewEvidenceRef',
  ];
  required.forEach((field) => {
    if (!nonEmpty(x[field])) throw new TypeError(`${field} must be a non-empty string`);
  });
  if (!validSha(x.leaseEvidenceHashSha256)) throw new TypeError('C15_LEASE_EVIDENCE_HASH_REQUIRED');
  if (!validSha(x.sourceVersionHashSha256)) throw new TypeError('C15_SOURCE_VERSION_HASH_REQUIRED');
  if (!validSha(x.reviewEvidenceHashSha256)) throw new TypeError('C15_REVIEW_EVIDENCE_HASH_REQUIRED');
  if (!Object.values(APPLICABILITY_STATUS).includes(x.applicabilityStatus)) {
    throw new TypeError(`C15_APPLICABILITY_STATUS_UNSUPPORTED:${x.applicabilityStatus}`);
  }
  const numericBasis = x.numericBasis || NUMERIC_BASIS.NO_NUMERIC_CONSTRAINT;
  validateRuleClassBasis(x.ruleClass, numericBasis);
  const numericValue = normalizeNumericValue(numericBasis, x.numericValue);

  const sourceVerifiedAt = iso(x.sourceVerifiedAt, 'sourceVerifiedAt');
  const sourceReviewAfter = iso(x.sourceReviewAfter, 'sourceReviewAfter');
  const effectiveFrom = iso(x.effectiveFrom, 'effectiveFrom');
  const effectiveUntil = iso(x.effectiveUntil, 'effectiveUntil');
  const applicabilityReviewedAt = iso(x.applicabilityReviewedAt, 'applicabilityReviewedAt');
  const applicabilityValidUntil = iso(x.applicabilityValidUntil, 'applicabilityValidUntil');
  if (Date.parse(sourceReviewAfter) < Date.parse(sourceVerifiedAt)) throw new TypeError('C15_SOURCE_REVIEW_AFTER_BEFORE_VERIFIED_AT');
  if (Date.parse(effectiveUntil) < Date.parse(effectiveFrom)) throw new TypeError('C15_RULE_EFFECTIVE_UNTIL_BEFORE_FROM');
  if (Date.parse(applicabilityValidUntil) < Date.parse(applicabilityReviewedAt)) throw new TypeError('C15_APPLICABILITY_VALID_UNTIL_BEFORE_REVIEWED_AT');

  const core = {
    schemaVersion: 1,
    ruleId: x.ruleId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    leaseId: x.leaseId.trim(),
    leaseEvidenceHashSha256: x.leaseEvidenceHashSha256.toLowerCase(),
    ruleClass: x.ruleClass,
    numericBasis,
    numericValue,
    sourceAuthority: x.sourceAuthority.trim(),
    sourceRef: x.sourceRef.trim(),
    sourceEvidenceRef: x.sourceEvidenceRef.trim(),
    sourceVersionHashSha256: x.sourceVersionHashSha256.toLowerCase(),
    sourceVerifiedAt,
    sourceReviewAfter,
    effectiveFrom,
    effectiveUntil,
    professionalReviewerRef: x.professionalReviewerRef.trim(),
    applicabilityStatus: x.applicabilityStatus,
    applicabilityEvidenceRef: x.applicabilityEvidenceRef.trim(),
    applicabilityReviewedAt,
    applicabilityValidUntil,
    reviewEvidenceRef: x.reviewEvidenceRef.trim(),
    reviewEvidenceHashSha256: x.reviewEvidenceHashSha256.toLowerCase(),
    statutoryRuleInventedBySoftware: false,
    legalApplicabilityDeterminedBySoftware: false,
    leaseEnforceabilityDeterminedBySoftware: false,
  };
  return freeze({ ...core, regulationEvidenceHashSha256: sha256(core) });
}

function computeRentalActionProposalHash(proposal) {
  return proposal && typeof proposal === 'object' && !Array.isArray(proposal)
    ? sha256(without(proposal, ['proposalHashSha256']))
    : null;
}

function verifyRentalActionProposalIntegrity(proposal) {
  return !!proposal
    && validSha(proposal.proposalHashSha256)
    && computeRentalActionProposalHash(proposal) === proposal.proposalHashSha256.toLowerCase();
}

function createGovernedRentalActionProposal(x = {}) {
  const required = ['proposalId', 'caseId', 'propertyRef', 'leaseId', 'evidenceRef', 'createdByRef'];
  required.forEach((field) => {
    if (!nonEmpty(x[field])) throw new TypeError(`${field} must be a non-empty string`);
  });
  if (!validSha(x.leaseEvidenceHashSha256)) throw new TypeError('C15_PROPOSAL_LEASE_EVIDENCE_HASH_REQUIRED');
  if (!Object.values(RENTAL_ACTION_TYPE).includes(x.actionType)) throw new TypeError(`C15_ACTION_TYPE_UNSUPPORTED:${x.actionType}`);
  const proposedEffectiveDate = iso(x.proposedEffectiveDate, 'proposedEffectiveDate');
  const createdAt = iso(x.createdAt, 'createdAt');
  let proposedAnnualRentSar = null;
  let noticeGivenDate = null;
  if (x.actionType === RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE) {
    if (!finiteNN(x.proposedAnnualRentSar)) throw new TypeError('C15_PROPOSED_ANNUAL_RENT_INVALID');
    proposedAnnualRentSar = x.proposedAnnualRentSar;
    if (x.noticeGivenDate != null) noticeGivenDate = iso(x.noticeGivenDate, 'noticeGivenDate');
  } else if (x.actionType === RENTAL_ACTION_TYPE.NOTICE_EVENT) {
    noticeGivenDate = iso(x.noticeGivenDate, 'noticeGivenDate');
    if (Date.parse(noticeGivenDate) > Date.parse(proposedEffectiveDate)) throw new TypeError('C15_NOTICE_AFTER_PROPOSED_EFFECTIVE_DATE');
    if (x.proposedAnnualRentSar != null) throw new TypeError('C15_PROPOSED_ANNUAL_RENT_NOT_ALLOWED_FOR_ACTION');
  } else {
    if (x.proposedAnnualRentSar != null || x.noticeGivenDate != null) {
      throw new TypeError('C15_NUMERIC_PROPOSAL_FIELDS_NOT_ALLOWED_FOR_ACTION');
    }
  }
  const core = {
    schemaVersion: 1,
    proposalId: x.proposalId.trim(),
    caseId: x.caseId.trim(),
    propertyRef: x.propertyRef.trim(),
    leaseId: x.leaseId.trim(),
    leaseEvidenceHashSha256: x.leaseEvidenceHashSha256.toLowerCase(),
    actionType: x.actionType,
    proposedEffectiveDate,
    proposedAnnualRentSar,
    noticeGivenDate,
    evidenceRef: x.evidenceRef.trim(),
    createdByRef: x.createdByRef.trim(),
    createdAt,
    executedAction: false,
    legalComplianceDeterminedBySoftware: false,
  };
  return freeze({ ...core, proposalHashSha256: sha256(core) });
}

function regulationBindings(records) {
  if (!Array.isArray(records)) return [];
  return records.map((r) => ({
    ruleId: clean(r?.ruleId) || null,
    regulationEvidenceHashSha256: clean(r?.regulationEvidenceHashSha256).toLowerCase() || null,
  })).sort((a, b) => String(a.ruleId).localeCompare(String(b.ruleId)));
}

function proposalBindings(records) {
  if (!Array.isArray(records)) return [];
  return records.map((r) => ({
    proposalId: clean(r?.proposalId) || null,
    proposalHashSha256: clean(r?.proposalHashSha256).toLowerCase() || null,
  })).sort((a, b) => String(a.proposalId).localeCompare(String(b.proposalId)));
}

function computeRentalRegulationPolicyHash(policy) {
  return policy && typeof policy === 'object' && !Array.isArray(policy)
    ? sha256(without(policy, ['policyHashSha256']))
    : null;
}

function normalizeUniqueEnumArray(values, enumeration, code) {
  if (!Array.isArray(values) || !values.length || values.some((v) => !Object.values(enumeration).includes(v))) return { values: [], blocker: code };
  return { values: [...new Set(values)].sort(), blocker: null };
}

function normalizeRequiredClassMap(map, allowedActions) {
  const blockers = [];
  const normalized = {};
  if (!map || typeof map !== 'object' || Array.isArray(map)) return { normalized, blockers: ['C15_POLICY_REQUIRED_RULE_MAP_INVALID'] };
  for (const actionType of allowedActions) {
    const value = map[actionType];
    if (!Array.isArray(value) || !value.length || value.some((v) => !Object.values(RENTAL_RULE_CLASS).includes(v))) {
      blockers.push(`C15_POLICY_REQUIRED_RULE_CLASSES_INVALID:${actionType}`);
      continue;
    }
    normalized[actionType] = [...new Set(value)].sort();
  }
  const unexpected = Object.keys(map).filter((key) => !allowedActions.includes(key));
  if (unexpected.length) blockers.push(`C15_POLICY_REQUIRED_RULE_MAP_UNEXPECTED_ACTION:${unexpected.sort().join(',')}`);
  return { normalized, blockers };
}

function validatePolicy(policy, context) {
  const blockers = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return { blockers: ['C15_GOVERNED_POLICY_OBJECT_REQUIRED'], allowedActions: [], allowedRuleClasses: [], requiredClassMap: {} };
  if (clean(policy.version) !== POLICY_VERSION) blockers.push('C15_POLICY_VERSION_MISMATCH');
  if (clean(policy.policyId) !== context.policyId) blockers.push('C15_POLICY_ID_MISMATCH');
  if (clean(policy.caseId) !== context.caseId) blockers.push('C15_POLICY_CASE_MISMATCH');
  if (clean(policy.propertyRef) !== context.propertyRef) blockers.push('C15_POLICY_PROPERTY_MISMATCH');
  let policyAsOf = null;
  try { policyAsOf = iso(policy.asOfDate, 'policy.asOfDate'); } catch (_) { blockers.push('C15_POLICY_AS_OF_INVALID'); }
  if (policyAsOf && policyAsOf !== context.asOfDate) blockers.push('C15_POLICY_AS_OF_MISMATCH');
  if (!validSha(policy.incomeEvidencePacketHashSha256) || policy.incomeEvidencePacketHashSha256.toLowerCase() !== context.incomeEvidencePacketHashSha256) {
    blockers.push('C15_POLICY_UPSTREAM_PACKET_HASH_MISMATCH');
  }
  if (JSON.stringify(regulationBindings(policy.regulationBindings)) !== JSON.stringify(context.regulationBindings)) {
    blockers.push('C15_POLICY_REGULATION_BINDINGS_MISMATCH');
  }
  if (JSON.stringify(proposalBindings(policy.proposalBindings)) !== JSON.stringify(context.proposalBindings)) {
    blockers.push('C15_POLICY_PROPOSAL_BINDINGS_MISMATCH');
  }

  const actionNorm = normalizeUniqueEnumArray(policy.allowedActionTypes, RENTAL_ACTION_TYPE, 'C15_POLICY_ALLOWED_ACTION_TYPES_INVALID');
  const ruleNorm = normalizeUniqueEnumArray(policy.allowedRuleClasses, RENTAL_RULE_CLASS, 'C15_POLICY_ALLOWED_RULE_CLASSES_INVALID');
  if (actionNorm.blocker) blockers.push(actionNorm.blocker);
  if (ruleNorm.blocker) blockers.push(ruleNorm.blocker);
  const classMap = normalizeRequiredClassMap(policy.requiredRuleClassByActionType, actionNorm.values);
  blockers.push(...classMap.blockers);

  if (policy.allowUnresolvedApplicability !== false) blockers.push('C15_PHASE0_REQUIRES_UNRESOLVED_APPLICABILITY_FALSE');
  if (!nonEmpty(policy.reviewedByRef)) blockers.push('C15_POLICY_REVIEWER_REQUIRED');
  if (!nonEmpty(policy.reviewEvidenceRef)) blockers.push('C15_POLICY_REVIEW_EVIDENCE_REQUIRED');
  let reviewedAt = null;
  try { reviewedAt = iso(policy.reviewedAt, 'policy.reviewedAt'); } catch (_) { blockers.push('C15_POLICY_REVIEWED_AT_INVALID'); }
  if (reviewedAt && Date.parse(reviewedAt) > Date.parse(context.asOfDate)) blockers.push('C15_POLICY_REVIEW_AFTER_AS_OF');

  const hash = computeRentalRegulationPolicyHash(policy);
  if (!validSha(policy.policyHashSha256) || !hash || hash !== policy.policyHashSha256.toLowerCase()) blockers.push('C15_POLICY_INTEGRITY_HASH_MISMATCH');
  return { blockers, allowedActions: actionNorm.values, allowedRuleClasses: ruleNorm.values, requiredClassMap: classMap.normalized };
}

function baseResult(status, blockers, context = {}, reviews = [], riskFlags = []) {
  const ready = status === RENTAL_REGULATION_STATUS.READY_FOR_PROFESSIONAL_RENTAL_REGULATION_REVIEW;
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status,
    professionalRentalRegulationReviewReady: ready,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    asOfDate: context.asOfDate || null,
    incomeEvidencePacketHashSha256: context.incomeEvidencePacketHashSha256 || null,
    reviewPolicyId: context.policyId || null,
    reviewPolicyHashSha256: context.policyHashSha256 || null,
    regulationBindings: context.regulationBindings || [],
    proposalBindings: context.proposalBindings || [],
    reviews: ready ? reviews : [],
    riskFlags: ready ? riskFlags : [],
    blockers: [...new Set(blockers)],
    legalAdviceProduced: false,
    statutoryRuleInferred: false,
    legalApplicabilityDetermined: false,
    legalComplianceDetermined: false,
    leaseEnforceabilityDetermined: false,
    leaseAmended: false,
    ejarOrRegistryFiled: false,
    automaticRentSettingRecommendation: false,
    marketRentInferred: false,
    noiCalculated: false,
    valuationCalculated: false,
    dcfPerformed: false,
    npvCalculated: false,
    irrCalculated: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    decisionBinding: false,
    productionAuthorityGranted: false,
    publicAiAuthorized: false,
    commercialGoLiveAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    semantics: 'C15 preserves professionally supplied rental-regulation applicability and performs only explicit arithmetic checks against professionally supplied numeric bases. It does not infer statutes, decide legal applicability/compliance/enforceability, amend leases, file registrations, set rent, value property or authorize transactions.',
  });
}

function validateRuleShape(rule) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return 'C15_RULE_OBJECT_REQUIRED';
  if (!Object.values(RENTAL_RULE_CLASS).includes(rule.ruleClass)) return `C15_RULE_CLASS_UNSUPPORTED:${clean(rule.ruleId)}`;
  if (!Object.values(NUMERIC_BASIS).includes(rule.numericBasis)) return `C15_NUMERIC_BASIS_UNSUPPORTED:${clean(rule.ruleId)}`;
  if (!Object.values(APPLICABILITY_STATUS).includes(rule.applicabilityStatus)) return `C15_APPLICABILITY_STATUS_UNSUPPORTED:${clean(rule.ruleId)}`;
  try {
    validateRuleClassBasis(rule.ruleClass, rule.numericBasis);
    normalizeNumericValue(rule.numericBasis, rule.numericValue);
  } catch (_) {
    return `C15_RULE_NUMERIC_SHAPE_INVALID:${clean(rule.ruleId)}`;
  }
  return null;
}

function validateProposalShape(proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return 'C15_PROPOSAL_OBJECT_REQUIRED';
  if (!Object.values(RENTAL_ACTION_TYPE).includes(proposal.actionType)) return `C15_ACTION_TYPE_UNSUPPORTED:${clean(proposal.proposalId)}`;
  if (proposal.actionType === RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE && !finiteNN(proposal.proposedAnnualRentSar)) return `C15_PROPOSED_ANNUAL_RENT_INVALID:${clean(proposal.proposalId)}`;
  if (proposal.actionType === RENTAL_ACTION_TYPE.NOTICE_EVENT && !Number.isFinite(Date.parse(proposal.noticeGivenDate))) return `C15_NOTICE_DATE_INVALID:${clean(proposal.proposalId)}`;
  return null;
}

function evaluateGovernedRentalRegulation(x = {}) {
  const packet = x.incomeEvidencePacket;
  const context = {
    caseId: clean(packet?.caseId) || null,
    propertyRef: clean(packet?.propertyRef) || null,
    asOfDate: null,
    incomeEvidencePacketHashSha256: clean(packet?.incomeEvidencePacketHashSha256).toLowerCase() || null,
    policyId: clean(x.reviewPolicyId) || null,
    regulationBindings: [],
    proposalBindings: [],
  };
  try { context.asOfDate = iso(packet?.asOfDate, 'incomeEvidencePacket.asOfDate'); } catch (_) {}

  if (!packet || packet.status !== LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF || packet.readyForIncomeAnalysisHandoff !== true) {
    return baseResult(RENTAL_REGULATION_STATUS.HOLD_UPSTREAM_EVIDENCE, ['C15_UPSTREAM_INCOME_EVIDENCE_PACKET_NOT_READY'], context);
  }
  if (!verifyIncomeEvidencePacketIntegrity(packet)) {
    return baseResult(RENTAL_REGULATION_STATUS.HOLD_INTEGRITY, ['C15_UPSTREAM_INCOME_EVIDENCE_PACKET_INTEGRITY_FAILED'], context);
  }
  if (!context.caseId || !context.propertyRef || !context.asOfDate || !validSha(context.incomeEvidencePacketHashSha256)) {
    return baseResult(RENTAL_REGULATION_STATUS.HOLD_INTEGRITY, ['C15_UPSTREAM_CONTEXT_INVALID'], context);
  }
  if (!Array.isArray(packet.activeLeases) || !packet.activeLeases.length) {
    return baseResult(RENTAL_REGULATION_STATUS.HOLD_UPSTREAM_EVIDENCE, ['C15_UPSTREAM_ACTIVE_LEASES_REQUIRED'], context);
  }

  const leaseMap = new Map();
  for (const lease of packet.activeLeases) {
    if (!nonEmpty(lease?.leaseId) || !validSha(lease?.leaseEvidenceHashSha256) || !finiteNN(lease?.contractedAnnualRentSarAsOfDate)) {
      return baseResult(RENTAL_REGULATION_STATUS.HOLD_INTEGRITY, ['C15_UPSTREAM_ACTIVE_LEASE_SHAPE_INVALID'], context);
    }
    if (leaseMap.has(lease.leaseId)) return baseResult(RENTAL_REGULATION_STATUS.HOLD_INTEGRITY, [`C15_DUPLICATE_UPSTREAM_LEASE_ID:${lease.leaseId}`], context);
    leaseMap.set(lease.leaseId, lease);
  }

  if (!Array.isArray(x.regulationEvidence) || !x.regulationEvidence.length || !Array.isArray(x.proposals) || !x.proposals.length) {
    return baseResult(RENTAL_REGULATION_STATUS.HOLD_EVIDENCE, ['C15_REGULATION_EVIDENCE_AND_PROPOSALS_REQUIRED'], context);
  }

  const asOf = Date.parse(context.asOfDate);
  const integrityBlockers = [];
  const ruleIds = new Set();
  const rules = [];
  for (const rule of x.regulationEvidence) {
    const ruleId = clean(rule?.ruleId);
    if (!ruleId) { integrityBlockers.push('C15_RULE_ID_REQUIRED'); continue; }
    if (ruleIds.has(ruleId)) { integrityBlockers.push(`C15_DUPLICATE_RULE_ID:${ruleId}`); continue; }
    ruleIds.add(ruleId);
    if (!verifyRentalRegulationEvidenceIntegrity(rule)) { integrityBlockers.push(`C15_RULE_INTEGRITY_FAILED:${ruleId}`); continue; }
    const shapeError = validateRuleShape(rule);
    if (shapeError) { integrityBlockers.push(shapeError); continue; }
    const lease = leaseMap.get(rule.leaseId);
    if (!lease || rule.caseId !== context.caseId || rule.propertyRef !== context.propertyRef || rule.leaseEvidenceHashSha256 !== lease.leaseEvidenceHashSha256) {
      integrityBlockers.push(`C15_RULE_LEASE_BINDING_MISMATCH:${ruleId}`); continue;
    }
    const requiredStrings = [rule.sourceAuthority, rule.sourceRef, rule.sourceEvidenceRef, rule.professionalReviewerRef, rule.applicabilityEvidenceRef, rule.reviewEvidenceRef];
    if (requiredStrings.some((v) => !nonEmpty(v)) || !validSha(rule.sourceVersionHashSha256) || !validSha(rule.reviewEvidenceHashSha256)) {
      integrityBlockers.push(`C15_RULE_SOURCE_OR_REVIEW_METADATA_INVALID:${ruleId}`); continue;
    }
    const dates = ['sourceVerifiedAt', 'sourceReviewAfter', 'effectiveFrom', 'effectiveUntil', 'applicabilityReviewedAt', 'applicabilityValidUntil'];
    const parsed = Object.fromEntries(dates.map((field) => [field, Date.parse(rule[field])]));
    if (Object.values(parsed).some((v) => !Number.isFinite(v))) { integrityBlockers.push(`C15_RULE_DATES_INVALID:${ruleId}`); continue; }
    if (parsed.sourceVerifiedAt > asOf || parsed.sourceReviewAfter < asOf || parsed.sourceReviewAfter < parsed.sourceVerifiedAt) {
      integrityBlockers.push(`C15_RULE_SOURCE_STALE_OR_FUTURE:${ruleId}`); continue;
    }
    if (parsed.applicabilityReviewedAt > asOf || parsed.applicabilityValidUntil < asOf || parsed.applicabilityValidUntil < parsed.applicabilityReviewedAt) {
      integrityBlockers.push(`C15_RULE_APPLICABILITY_REVIEW_STALE_OR_FUTURE:${ruleId}`); continue;
    }
    if (parsed.effectiveUntil < parsed.effectiveFrom) { integrityBlockers.push(`C15_RULE_EFFECTIVE_WINDOW_INVALID:${ruleId}`); continue; }
    if (rule.statutoryRuleInventedBySoftware !== false || rule.legalApplicabilityDeterminedBySoftware !== false || rule.leaseEnforceabilityDeterminedBySoftware !== false) {
      integrityBlockers.push(`C15_RULE_AUTHORITY_FLAGS_INVALID:${ruleId}`); continue;
    }
    rules.push(rule);
  }

  const proposalIds = new Set();
  const proposals = [];
  for (const proposal of x.proposals) {
    const proposalId = clean(proposal?.proposalId);
    if (!proposalId) { integrityBlockers.push('C15_PROPOSAL_ID_REQUIRED'); continue; }
    if (proposalIds.has(proposalId)) { integrityBlockers.push(`C15_DUPLICATE_PROPOSAL_ID:${proposalId}`); continue; }
    proposalIds.add(proposalId);
    if (!verifyRentalActionProposalIntegrity(proposal)) { integrityBlockers.push(`C15_PROPOSAL_INTEGRITY_FAILED:${proposalId}`); continue; }
    const shapeError = validateProposalShape(proposal);
    if (shapeError) { integrityBlockers.push(shapeError); continue; }
    const lease = leaseMap.get(proposal.leaseId);
    if (!lease || proposal.caseId !== context.caseId || proposal.propertyRef !== context.propertyRef || proposal.leaseEvidenceHashSha256 !== lease.leaseEvidenceHashSha256) {
      integrityBlockers.push(`C15_PROPOSAL_LEASE_BINDING_MISMATCH:${proposalId}`); continue;
    }
    const proposedEffective = Date.parse(proposal.proposedEffectiveDate);
    const createdAt = Date.parse(proposal.createdAt);
    if (!Number.isFinite(proposedEffective) || !Number.isFinite(createdAt) || createdAt > asOf || proposedEffective < asOf) {
      integrityBlockers.push(`C15_PROPOSAL_DATES_INVALID:${proposalId}`); continue;
    }
    if (proposal.actionType === RENTAL_ACTION_TYPE.NOTICE_EVENT) {
      const notice = Date.parse(proposal.noticeGivenDate);
      if (!Number.isFinite(notice) || notice > proposedEffective) { integrityBlockers.push(`C15_NOTICE_DATE_INVALID:${proposalId}`); continue; }
    }
    if (proposal.executedAction !== false || proposal.legalComplianceDeterminedBySoftware !== false) {
      integrityBlockers.push(`C15_PROPOSAL_AUTHORITY_FLAGS_INVALID:${proposalId}`); continue;
    }
    proposals.push(proposal);
  }

  if (integrityBlockers.length) return baseResult(RENTAL_REGULATION_STATUS.HOLD_INTEGRITY, integrityBlockers, context);

  context.regulationBindings = regulationBindings(rules);
  context.proposalBindings = proposalBindings(proposals);
  if (!context.policyId) return baseResult(RENTAL_REGULATION_STATUS.HOLD_POLICY, ['C15_GOVERNED_POLICY_ID_REQUIRED'], context);
  if (!x.governedReviewPolicies || typeof x.governedReviewPolicies !== 'object' || Array.isArray(x.governedReviewPolicies)) {
    return baseResult(RENTAL_REGULATION_STATUS.HOLD_POLICY, ['C15_GOVERNED_POLICY_REGISTRY_REQUIRED'], context);
  }
  const policy = x.governedReviewPolicies[context.policyId];
  if (!policy) return baseResult(RENTAL_REGULATION_STATUS.HOLD_POLICY, [`C15_GOVERNED_POLICY_NOT_FOUND:${context.policyId}`], context);
  const policyValidation = validatePolicy(policy, context);
  if (policyValidation.blockers.some((b) => b.includes('INTEGRITY_HASH') || b.includes('BINDINGS_MISMATCH'))) {
    return baseResult(RENTAL_REGULATION_STATUS.HOLD_INTEGRITY, policyValidation.blockers, context);
  }
  if (policyValidation.blockers.length) return baseResult(RENTAL_REGULATION_STATUS.HOLD_POLICY, policyValidation.blockers, context);
  context.policyHashSha256 = policy.policyHashSha256.toLowerCase();

  const allowedActions = new Set(policyValidation.allowedActions);
  const allowedRuleClasses = new Set(policyValidation.allowedRuleClasses);
  const policyBlockers = [];
  for (const proposal of proposals) if (!allowedActions.has(proposal.actionType)) policyBlockers.push(`C15_ACTION_NOT_ALLOWED_BY_POLICY:${proposal.proposalId}:${proposal.actionType}`);
  for (const rule of rules) if (!allowedRuleClasses.has(rule.ruleClass)) policyBlockers.push(`C15_RULE_CLASS_NOT_ALLOWED_BY_POLICY:${rule.ruleId}:${rule.ruleClass}`);
  if (policyBlockers.length) return baseResult(RENTAL_REGULATION_STATUS.HOLD_POLICY, policyBlockers, context);

  const applicabilityBlockers = [];
  const ambiguityBlockers = [];
  const reviews = [];
  const riskFlags = [];

  for (const proposal of [...proposals].sort((a, b) => a.proposalId.localeCompare(b.proposalId))) {
    const lease = leaseMap.get(proposal.leaseId);
    const effectiveMs = Date.parse(proposal.proposedEffectiveDate);
    const matched = rules.filter((rule) =>
      rule.leaseId === proposal.leaseId
      && Date.parse(rule.effectiveFrom) <= effectiveMs
      && Date.parse(rule.effectiveUntil) >= effectiveMs
      && Date.parse(rule.applicabilityValidUntil) >= effectiveMs);
    const requiredClasses = policyValidation.requiredClassMap[proposal.actionType] || [];
    for (const requiredClass of requiredClasses) {
      const inClass = matched.filter((rule) => rule.ruleClass === requiredClass);
      if (!inClass.length) applicabilityBlockers.push(`C15_REQUIRED_RULE_CLASS_MISSING:${proposal.proposalId}:${requiredClass}`);
      if (inClass.some((rule) => rule.applicabilityStatus === APPLICABILITY_STATUS.UNRESOLVED)) {
        applicabilityBlockers.push(`C15_UNRESOLVED_APPLICABILITY:${proposal.proposalId}:${requiredClass}`);
      }
    }

    const applicable = matched.filter((rule) => rule.applicabilityStatus === APPLICABILITY_STATUS.APPLIES);
    let numericCandidates = [];
    if (proposal.actionType === RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE) {
      numericCandidates = applicable.filter((rule) => rule.ruleClass === RENTAL_RULE_CLASS.RENT_ADJUSTMENT && rule.numericBasis !== NUMERIC_BASIS.NO_NUMERIC_CONSTRAINT);
    } else if (proposal.actionType === RENTAL_ACTION_TYPE.NOTICE_EVENT) {
      numericCandidates = applicable.filter((rule) => rule.ruleClass === RENTAL_RULE_CLASS.NOTICE_PERIOD && rule.numericBasis === NUMERIC_BASIS.MIN_NOTICE_DAYS);
    }
    if (numericCandidates.length > 1) {
      ambiguityBlockers.push(`C15_AMBIGUOUS_NUMERIC_RULES:${proposal.proposalId}:${numericCandidates.map((r) => r.ruleId).sort().join(',')}`);
      continue;
    }

    let numericCheck = null;
    const numericRule = numericCandidates[0] || null;
    if (numericRule && proposal.actionType === RENTAL_ACTION_TYPE.ANNUAL_RENT_CHANGE) {
      const currentRent = lease.contractedAnnualRentSarAsOfDate;
      let maximumAnnualRentSar;
      if (numericRule.numericBasis === NUMERIC_BASIS.NO_RENT_INCREASE) maximumAnnualRentSar = currentRent;
      else if (numericRule.numericBasis === NUMERIC_BASIS.MAX_INCREASE_RATE_FROM_CURRENT_CONTRACT_RENT) maximumAnnualRentSar = currentRent * (1 + numericRule.numericValue);
      else if (numericRule.numericBasis === NUMERIC_BASIS.MAX_ANNUAL_RENT_SAR) maximumAnnualRentSar = numericRule.numericValue;
      if (!Number.isFinite(maximumAnnualRentSar)) {
        return baseResult(RENTAL_REGULATION_STATUS.HOLD_CALCULATION, [`C15_NON_FINITE_RENT_BOUND:${proposal.proposalId}`], context);
      }
      const arithmeticWithinSuppliedBound = proposal.proposedAnnualRentSar <= maximumAnnualRentSar;
      numericCheck = {
        dimension: 'ANNUAL_RENT_SAR',
        ruleId: numericRule.ruleId,
        ruleEvidenceHashSha256: numericRule.regulationEvidenceHashSha256,
        numericBasis: numericRule.numericBasis,
        numericValue: numericRule.numericValue,
        currentContractedAnnualRentSar: currentRent,
        proposedAnnualRentSar: proposal.proposedAnnualRentSar,
        maximumProfessionallySuppliedAnnualRentSar: maximumAnnualRentSar,
        arithmeticWithinSuppliedBound,
        semantics: 'Arithmetic comparison only; not a legal-compliance or enforceability conclusion.',
      };
      if (!arithmeticWithinSuppliedBound) riskFlags.push(`PROPOSED_RENT_EXCEEDS_PROFESSIONALLY_SUPPLIED_NUMERIC_BOUND:${proposal.proposalId}:${numericRule.ruleId}`);
    } else if (numericRule && proposal.actionType === RENTAL_ACTION_TYPE.NOTICE_EVENT) {
      const elapsedNoticeDays = (Date.parse(proposal.proposedEffectiveDate) - Date.parse(proposal.noticeGivenDate)) / 86400000;
      if (!Number.isFinite(elapsedNoticeDays)) {
        return baseResult(RENTAL_REGULATION_STATUS.HOLD_CALCULATION, [`C15_NON_FINITE_NOTICE_INTERVAL:${proposal.proposalId}`], context);
      }
      const arithmeticWithinSuppliedBound = elapsedNoticeDays >= numericRule.numericValue;
      numericCheck = {
        dimension: 'NOTICE_INTERVAL_DAYS',
        ruleId: numericRule.ruleId,
        ruleEvidenceHashSha256: numericRule.regulationEvidenceHashSha256,
        numericBasis: numericRule.numericBasis,
        minimumProfessionallySuppliedNoticeDays: numericRule.numericValue,
        elapsedNoticeDays,
        arithmeticWithinSuppliedBound,
        boundarySemantics: 'Exact elapsed UTC 24-hour days; no legal calendar-day interpretation is performed.',
        semantics: 'Arithmetic comparison only; not a legal-compliance or enforceability conclusion.',
      };
      if (!arithmeticWithinSuppliedBound) riskFlags.push(`NOTICE_INTERVAL_BELOW_PROFESSIONALLY_SUPPLIED_MINIMUM:${proposal.proposalId}:${numericRule.ruleId}`);
    }

    reviews.push({
      proposalId: proposal.proposalId,
      proposalHashSha256: proposal.proposalHashSha256,
      leaseId: proposal.leaseId,
      leaseEvidenceHashSha256: proposal.leaseEvidenceHashSha256,
      actionType: proposal.actionType,
      proposedEffectiveDate: proposal.proposedEffectiveDate,
      currentContractedAnnualRentSar: lease.contractedAnnualRentSarAsOfDate,
      matchedRuleIds: matched.map((r) => r.ruleId).sort(),
      applicableRuleIds: applicable.map((r) => r.ruleId).sort(),
      doesNotApplyRuleIds: matched.filter((r) => r.applicabilityStatus === APPLICABILITY_STATUS.DOES_NOT_APPLY).map((r) => r.ruleId).sort(),
      requiredRuleClasses: [...requiredClasses],
      numericCheck,
      legalComplianceConclusion: null,
    });
  }

  if (applicabilityBlockers.length) return baseResult(RENTAL_REGULATION_STATUS.HOLD_APPLICABILITY, applicabilityBlockers, context);
  if (ambiguityBlockers.length) return baseResult(RENTAL_REGULATION_STATUS.HOLD_AMBIGUITY, ambiguityBlockers, context);
  reviews.sort((a, b) => a.proposalId.localeCompare(b.proposalId));
  riskFlags.sort();

  return baseResult(
    RENTAL_REGULATION_STATUS.READY_FOR_PROFESSIONAL_RENTAL_REGULATION_REVIEW,
    [],
    context,
    reviews,
    riskFlags,
  );
}

module.exports = {
  CAPABILITY,
  POLICY_VERSION,
  RENTAL_REGULATION_STATUS,
  RENTAL_ACTION_TYPE,
  RENTAL_RULE_CLASS,
  NUMERIC_BASIS,
  APPLICABILITY_STATUS,
  createGovernedRentalRegulationEvidence,
  computeRentalRegulationEvidenceHash,
  verifyRentalRegulationEvidenceIntegrity,
  createGovernedRentalActionProposal,
  computeRentalActionProposalHash,
  verifyRentalActionProposalIntegrity,
  regulationBindings,
  proposalBindings,
  computeRentalRegulationPolicyHash,
  evaluateGovernedRentalRegulation,
};

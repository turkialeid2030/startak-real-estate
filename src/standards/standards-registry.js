'use strict';

const crypto = require('crypto');

const STANDARD_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  FUTURE: 'FUTURE',
  DRAFT: 'DRAFT',
  SUPERSEDED: 'SUPERSEDED',
  RETIRED: 'RETIRED',
  SUSPENDED: 'SUSPENDED',
  UNDER_REVIEW: 'UNDER_REVIEW',
});

const MANDATORY_OR_GUIDANCE = Object.freeze({
  MANDATORY: 'MANDATORY',
  GUIDANCE: 'GUIDANCE',
});

const LEGAL_REVIEW_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PROFESSIONAL_REVIEWED: 'PROFESSIONAL_REVIEWED',
  LEGAL_REVIEWED: 'LEGAL_REVIEWED',
  LEGAL_AND_PROFESSIONAL_REVIEWED: 'LEGAL_AND_PROFESSIONAL_REVIEWED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const DRAFT_ALLOWED_USES = Object.freeze([
  'GAP_ANALYSIS',
  'FUTURE_READINESS',
  'IMPACT_ASSESSMENT',
  'DEVELOPMENT_PLANNING',
]);

const ACTIVATION_GATE_KEYS = Object.freeze([
  'sourceVerified',
  'legalProfessionalReviewCompleted',
  'impactAnalysisCompleted',
  'codeUpdated',
  'regressionTestsPassed',
  'standardsConformancePassed',
  'reportTemplatesUpdated',
  'releaseApproved',
]);

const REQUIRED_KEYS = Object.freeze([
  'standard_id',
  'title_ar',
  'title_en',
  'issuer',
  'jurisdiction',
  'category',
  'version',
  'publication_date',
  'effective_date',
  'expiry_date',
  'status',
  'source_url',
  'official_source',
  'last_verified',
  'next_review',
  'supersedes',
  'superseded_by',
  'applicable_asset_classes',
  'applicable_purposes',
  'mandatory_or_guidance',
  'rule_version_hash',
  'reviewer',
  'legal_review_status',
]);

const OPTIONAL_APPLICABILITY_ARRAY_KEYS = Object.freeze([
  'applicable_reporting_frameworks',
  'applicable_regulated_entity_statuses',
  'applicable_transaction_contexts',
  'applicable_financing_contexts',
  'applicable_intended_uses',
  'applicable_intended_users',
]);

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

function dateMs(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function validateStandardRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return Object.freeze({ valid: false, errors: Object.freeze(['STANDARD_RECORD_MUST_BE_OBJECT']) });
  }

  for (const key of REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) errors.push(`MISSING_FIELD:${key}`);
  }

  const requiredStrings = [
    'standard_id', 'title_ar', 'title_en', 'issuer', 'jurisdiction', 'category', 'version',
    'publication_date', 'effective_date', 'source_url', 'last_verified', 'next_review',
    'rule_version_hash', 'legal_review_status', 'mandatory_or_guidance', 'status',
  ];
  for (const key of requiredStrings) {
    if (Object.prototype.hasOwnProperty.call(record, key) && !isNonEmptyString(record[key])) {
      errors.push(`INVALID_STRING:${key}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(record, 'official_source') && typeof record.official_source !== 'boolean') {
    errors.push('INVALID_BOOLEAN:official_source');
  }

  const arrayKeys = ['supersedes', 'superseded_by', 'applicable_asset_classes', 'applicable_purposes', ...OPTIONAL_APPLICABILITY_ARRAY_KEYS];
  for (const key of arrayKeys) {
    if (Object.prototype.hasOwnProperty.call(record, key) && !Array.isArray(record[key])) errors.push(`INVALID_ARRAY:${key}`);
  }

  if (record.expiry_date !== null && record.expiry_date !== undefined && record.expiry_date !== '' && !isNonEmptyString(record.expiry_date)) {
    errors.push('INVALID_DATE_FIELD:expiry_date');
  }
  if (record.reviewer !== null && record.reviewer !== undefined && !isNonEmptyString(record.reviewer)) {
    errors.push('INVALID_REVIEWER');
  }

  if (!Object.values(STANDARD_STATUS).includes(record.status)) errors.push(`INVALID_STATUS:${record.status}`);
  if (!Object.values(MANDATORY_OR_GUIDANCE).includes(record.mandatory_or_guidance)) {
    errors.push(`INVALID_MANDATORY_OR_GUIDANCE:${record.mandatory_or_guidance}`);
  }
  if (!Object.values(LEGAL_REVIEW_STATUS).includes(record.legal_review_status)) {
    errors.push(`INVALID_LEGAL_REVIEW_STATUS:${record.legal_review_status}`);
  }

  const publication = dateMs(record.publication_date);
  const effective = dateMs(record.effective_date);
  const expiry = dateMs(record.expiry_date);
  const lastVerified = dateMs(record.last_verified);
  const nextReview = dateMs(record.next_review);

  for (const [key, parsed] of [['publication_date', publication], ['effective_date', effective], ['last_verified', lastVerified], ['next_review', nextReview]]) {
    if (!Number.isFinite(parsed)) errors.push(`INVALID_DATE:${key}`);
  }
  if (Number.isNaN(expiry)) errors.push('INVALID_DATE:expiry_date');
  if (Number.isFinite(publication) && Number.isFinite(effective) && publication > effective) errors.push('DATE_ORDER:publication_after_effective');
  if (Number.isFinite(effective) && Number.isFinite(expiry) && effective > expiry) errors.push('DATE_ORDER:effective_after_expiry');
  if (Number.isFinite(lastVerified) && Number.isFinite(nextReview) && lastVerified > nextReview) errors.push('DATE_ORDER:last_verified_after_next_review');

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

function matchesList(recordValues, contextValue) {
  const values = Array.isArray(recordValues) ? recordValues : [];
  if (values.length === 0) return true;
  if (contextValue === null || contextValue === undefined || contextValue === '') return false;
  return values.includes(String(contextValue));
}

function evaluateProductionApplicability(record, {
  as_of_date,
  jurisdiction,
  purpose,
  asset_class,
  reporting_framework,
  regulated_entity_status,
  transaction_context,
  financing_context,
  intended_use,
  intended_user,
} = {}) {
  const validation = validateStandardRecord(record);
  const reasons = [...validation.errors];
  const asOf = dateMs(as_of_date);
  const effective = dateMs(record?.effective_date);
  const expiry = dateMs(record?.expiry_date);
  const nextReview = dateMs(record?.next_review);

  if (!Number.isFinite(asOf)) reasons.push('INVALID_AS_OF_DATE');
  if (record?.status !== STANDARD_STATUS.ACTIVE) reasons.push(`NON_ACTIVE_STATUS:${record?.status || 'MISSING'}`);
  if (Number.isFinite(asOf) && Number.isFinite(effective) && asOf < effective) reasons.push('BEFORE_EFFECTIVE_DATE');
  if (Number.isFinite(asOf) && Number.isFinite(expiry) && asOf > expiry) reasons.push('AFTER_EXPIRY_DATE');
  if (jurisdiction && record?.jurisdiction !== jurisdiction) reasons.push('JURISDICTION_MISMATCH');
  if (!matchesList(record?.applicable_purposes, purpose)) reasons.push('PURPOSE_MISMATCH');
  if (!matchesList(record?.applicable_asset_classes, asset_class)) reasons.push('ASSET_CLASS_MISMATCH');
  if (!matchesList(record?.applicable_reporting_frameworks, reporting_framework)) reasons.push('REPORTING_FRAMEWORK_MISMATCH');
  if (!matchesList(record?.applicable_regulated_entity_statuses, regulated_entity_status)) reasons.push('REGULATED_ENTITY_STATUS_MISMATCH');
  if (!matchesList(record?.applicable_transaction_contexts, transaction_context)) reasons.push('TRANSACTION_CONTEXT_MISMATCH');
  if (!matchesList(record?.applicable_financing_contexts, financing_context)) reasons.push('FINANCING_CONTEXT_MISMATCH');
  if (!matchesList(record?.applicable_intended_uses, intended_use)) reasons.push('INTENDED_USE_MISMATCH');
  if (!matchesList(record?.applicable_intended_users, intended_user)) reasons.push('INTENDED_USER_MISMATCH');

  const stale = Number.isFinite(asOf) && Number.isFinite(nextReview) && asOf > nextReview;
  return Object.freeze({
    standard_id: record?.standard_id || null,
    version: record?.version || null,
    enforceable_in_production: reasons.length === 0,
    stale,
    warning_code: stale ? 'STANDARD_VERIFICATION_STALE' : null,
    reasons: Object.freeze(reasons),
    legal_approval_established: false,
    transaction_authorized: false,
  });
}

function selectProductionStandards(records, context = {}) {
  const evaluated = (Array.isArray(records) ? records : []).map((record) => ({
    record,
    evaluation: evaluateProductionApplicability(record, context),
  }));
  const selected = evaluated.filter((item) => item.evaluation.enforceable_in_production).map((item) => item.record);
  const excluded = evaluated.filter((item) => !item.evaluation.enforceable_in_production).map((item) => Object.freeze({
    standard_id: item.record?.standard_id || null,
    version: item.record?.version || null,
    status: item.record?.status || null,
    reasons: item.evaluation.reasons,
  }));
  return Object.freeze({
    selected: Object.freeze(selected.map((record) => Object.freeze({ ...record }))),
    excluded: Object.freeze(excluded),
    warnings: Object.freeze(evaluated.filter((item) => item.evaluation.stale).map((item) => Object.freeze({
      standard_id: item.record.standard_id,
      version: item.record.version,
      code: 'STANDARD_VERIFICATION_STALE',
    }))),
    transaction_authorized: false,
    legal_approval_established: false,
  });
}

function assertNoNonActiveProductionStandards(records) {
  const violations = (Array.isArray(records) ? records : []).filter((record) => record?.status !== STANDARD_STATUS.ACTIVE);
  if (violations.length) {
    const error = new Error(`NON_ACTIVE_STANDARD_ENFORCED:${violations.map((record) => `${record.standard_id}@${record.version}`).join(',')}`);
    error.code = 'NON_ACTIVE_STANDARD_ENFORCED';
    error.violations = violations.map((record) => ({ standard_id: record.standard_id, version: record.version, status: record.status }));
    throw error;
  }
  return true;
}

function activateFutureStandard(record, gates = {}, as_of_date) {
  const validation = validateStandardRecord(record);
  if (!validation.valid) {
    const error = new Error(`INVALID_STANDARD_RECORD:${validation.errors.join('|')}`);
    error.code = 'INVALID_STANDARD_RECORD';
    throw error;
  }
  if (record.status !== STANDARD_STATUS.FUTURE) {
    const error = new Error(`ACTIVATION_REQUIRES_FUTURE_STATUS:${record.status}`);
    error.code = 'ACTIVATION_REQUIRES_FUTURE_STATUS';
    throw error;
  }

  const asOf = dateMs(as_of_date);
  const effective = dateMs(record.effective_date);
  if (!Number.isFinite(asOf) || asOf < effective) {
    const error = new Error('FUTURE_STANDARD_NOT_YET_EFFECTIVE');
    error.code = 'FUTURE_STANDARD_NOT_YET_EFFECTIVE';
    throw error;
  }

  const missingGates = ACTIVATION_GATE_KEYS.filter((key) => gates[key] !== true);
  if (missingGates.length) {
    const error = new Error(`STANDARD_ACTIVATION_GATES_INCOMPLETE:${missingGates.join(',')}`);
    error.code = 'STANDARD_ACTIVATION_GATES_INCOMPLETE';
    error.missingGates = missingGates;
    throw error;
  }

  const activationEvidence = Object.freeze({
    activated_at: String(as_of_date),
    gates: Object.freeze(Object.fromEntries(ACTIVATION_GATE_KEYS.map((key) => [key, true]))),
  });
  return Object.freeze({
    ...record,
    status: STANDARD_STATUS.ACTIVE,
    activation_evidence: activationEvidence,
    activation_evidence_hash: sha256(activationEvidence),
  });
}

function supersedeStandard(activeRecord, replacementRecord) {
  if (activeRecord?.status !== STANDARD_STATUS.ACTIVE || replacementRecord?.status !== STANDARD_STATUS.ACTIVE) {
    const error = new Error('SUPERSESSION_REQUIRES_ACTIVE_RECORDS');
    error.code = 'SUPERSESSION_REQUIRES_ACTIVE_RECORDS';
    throw error;
  }
  if (activeRecord.standard_id !== replacementRecord.standard_id) {
    const error = new Error('SUPERSESSION_STANDARD_ID_MISMATCH');
    error.code = 'SUPERSESSION_STANDARD_ID_MISMATCH';
    throw error;
  }
  return Object.freeze({
    ...activeRecord,
    status: STANDARD_STATUS.SUPERSEDED,
    superseded_by: Object.freeze([`${replacementRecord.standard_id}@${replacementRecord.version}`]),
  });
}

function createStandardsSnapshot(records, context = {}) {
  const routing = selectProductionStandards(records, context);
  assertNoNonActiveProductionStandards(routing.selected);
  const selected = routing.selected
    .map((record) => Object.freeze({
      standard_id: record.standard_id,
      version: record.version,
      status: record.status,
      effective_date: record.effective_date,
      expiry_date: record.expiry_date,
      rule_version_hash: record.rule_version_hash,
      source_url: record.source_url,
      last_verified: record.last_verified,
      next_review: record.next_review,
    }))
    .sort((a, b) => `${a.standard_id}@${a.version}`.localeCompare(`${b.standard_id}@${b.version}`));

  const payload = {
    schema_version: 1,
    as_of_date: context.as_of_date || null,
    jurisdiction: context.jurisdiction || null,
    purpose: context.purpose || null,
    asset_class: context.asset_class || null,
    selected,
  };
  return Object.freeze({
    ...payload,
    standards_snapshot_version: sha256(payload),
    warnings: routing.warnings,
    historical_reproduction_required: true,
    automatic_recalculation_on_new_standard: false,
    legal_approval_established: false,
    transaction_authorized: false,
  });
}

function resolveStandardConflict(left, right) {
  const bothMandatory = left?.mandatory_or_guidance === MANDATORY_OR_GUIDANCE.MANDATORY
    && right?.mandatory_or_guidance === MANDATORY_OR_GUIDANCE.MANDATORY;
  const leftSaudi = left?.jurisdiction === 'SAUDI_ARABIA';
  const rightSaudi = right?.jurisdiction === 'SAUDI_ARABIA';

  if (bothMandatory && leftSaudi !== rightSaudi) {
    const winner = leftSaudi ? left : right;
    const loser = leftSaudi ? right : left;
    return Object.freeze({
      resolution: 'SAUDI_MANDATORY_REQUIREMENT_PREVAILS',
      winner: Object.freeze({ standard_id: winner.standard_id, version: winner.version }),
      loser: Object.freeze({ standard_id: loser.standard_id, version: loser.version }),
      human_review_required: false,
      legal_approval_established: false,
    });
  }

  return Object.freeze({
    resolution: 'HUMAN_REVIEW_REQUIRED',
    winner: null,
    loser: null,
    human_review_required: true,
    legal_approval_established: false,
  });
}

module.exports = {
  STANDARD_STATUS,
  MANDATORY_OR_GUIDANCE,
  LEGAL_REVIEW_STATUS,
  DRAFT_ALLOWED_USES,
  ACTIVATION_GATE_KEYS,
  REQUIRED_KEYS,
  OPTIONAL_APPLICABILITY_ARRAY_KEYS,
  validateStandardRecord,
  evaluateProductionApplicability,
  selectProductionStandards,
  assertNoNonActiveProductionStandards,
  activateFutureStandard,
  supersedeStandard,
  createStandardsSnapshot,
  resolveStandardConflict,
  stableStringify,
  sha256,
};

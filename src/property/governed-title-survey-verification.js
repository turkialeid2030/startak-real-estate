'use strict';

const crypto = require('crypto');
const {
  EVIDENCE_SOURCE_ROLE,
  ADMISSIBILITY_TARGET,
  ADMISSIBILITY_STATUS,
  validateProfessionalEvidenceChainIntegrity,
  assessProfessionalEvidenceAdmissibility,
} = require('../document-intelligence/professional-evidence-chain');
const { reconcileEvidenceFacts } = require('../document-intelligence/reconciliation');
const { RECONCILIATION_STATUS } = require('../document-intelligence/contracts');

const TITLE_SURVEY_VERIFICATION_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_REVIEW: 'READY_FOR_PROFESSIONAL_REVIEW',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  HOLD_FRESHNESS: 'HOLD_FRESHNESS',
  MATERIAL_PROPERTY_DATA_CONFLICT: 'MATERIAL_PROPERTY_DATA_CONFLICT',
  HOLD_MATERIAL_FINDING: 'HOLD_MATERIAL_FINDING',
});

const PROPERTY_EVIDENCE_CLASS = Object.freeze({
  PROPERTY_IDENTITY: 'PROPERTY_IDENTITY',
  OWNER: 'OWNER',
  PARCEL: 'PARCEL',
  PLOT: 'PLOT',
  PLAN: 'PLAN',
  LAND_AREA: 'LAND_AREA',
  RESTRICTION: 'RESTRICTION',
  ENCUMBRANCE: 'ENCUMBRANCE',
  EASEMENT: 'EASEMENT',
  OTHER: 'OTHER',
});

const FINDING_CLASSES = new Set([
  PROPERTY_EVIDENCE_CLASS.RESTRICTION,
  PROPERTY_EVIDENCE_CLASS.ENCUMBRANCE,
  PROPERTY_EVIDENCE_CLASS.EASEMENT,
]);

const CAPABILITY = 'C8_GOVERNED_TITLE_SURVEY_PROPERTY_EVIDENCE_V1';
const DAY_MS = 24 * 60 * 60 * 1000;

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function stableString(value) {
  return JSON.stringify(stableClone(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(stableString(value)).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalIso(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a valid ISO-compatible date/time`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid ISO-compatible date/time`);
  return parsed.toISOString();
}

function uniqueSortedStrings(values, field, { allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    throw new TypeError(`${field} must be ${allowEmpty ? 'an array' : 'a non-empty array'}`);
  }
  const normalized = values.map((value, index) => {
    if (!nonEmpty(value)) throw new TypeError(`${field}[${index}] must be a non-empty string`);
    return value.trim();
  });
  return [...new Set(normalized)].sort();
}

function normalizeTolerance(value, field, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new TypeError(`${field} requires an explicit numeric tolerance`);
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  const hasAbsolute = Object.prototype.hasOwnProperty.call(value, 'absolute');
  const hasRelative = Object.prototype.hasOwnProperty.call(value, 'relative');
  if (!hasAbsolute && !hasRelative) throw new TypeError(`${field} must explicitly provide absolute and/or relative tolerance`);
  const out = {};
  if (hasAbsolute) {
    if (typeof value.absolute !== 'number' || !Number.isFinite(value.absolute) || value.absolute < 0) {
      throw new TypeError(`${field}.absolute must be a finite non-negative number`);
    }
    out.absolute = value.absolute;
  }
  if (hasRelative) {
    if (typeof value.relative !== 'number' || !Number.isFinite(value.relative) || value.relative < 0) {
      throw new TypeError(`${field}.relative must be a finite non-negative number`);
    }
    out.relative = value.relative;
  }
  return out;
}

function normalizePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new TypeError('policy is required');
  if (!nonEmpty(policy.policyId)) throw new TypeError('policy.policyId is required');
  if (!nonEmpty(policy.version)) throw new TypeError('policy.version is required');

  const requiredSourceRoles = uniqueSortedStrings(policy.requiredSourceRoles, 'policy.requiredSourceRoles');
  for (const role of requiredSourceRoles) {
    if (!Object.values(EVIDENCE_SOURCE_ROLE).includes(role)) throw new TypeError(`unsupported required source role: ${role}`);
  }

  const requiredKeys = uniqueSortedStrings(policy.requiredKeys, 'policy.requiredKeys');
  if (!policy.keyClassByKey || typeof policy.keyClassByKey !== 'object' || Array.isArray(policy.keyClassByKey)) {
    throw new TypeError('policy.keyClassByKey is required');
  }
  const keyClassByKey = {};
  for (const [key, evidenceClass] of Object.entries(policy.keyClassByKey)) {
    if (!nonEmpty(key)) throw new TypeError('policy.keyClassByKey contains an empty key');
    if (!Object.values(PROPERTY_EVIDENCE_CLASS).includes(evidenceClass)) {
      throw new TypeError(`unsupported property evidence class for ${key}: ${evidenceClass}`);
    }
    keyClassByKey[key] = evidenceClass;
  }
  for (const key of requiredKeys) {
    if (!keyClassByKey[key]) throw new TypeError(`policy.keyClassByKey missing required key: ${key}`);
  }

  if (!policy.maxAgeDaysBySourceRole || typeof policy.maxAgeDaysBySourceRole !== 'object' || Array.isArray(policy.maxAgeDaysBySourceRole)) {
    throw new TypeError('policy.maxAgeDaysBySourceRole is required');
  }
  const maxAgeDaysBySourceRole = {};
  for (const [role, days] of Object.entries(policy.maxAgeDaysBySourceRole)) {
    if (!Object.values(EVIDENCE_SOURCE_ROLE).includes(role)) throw new TypeError(`unsupported freshness source role: ${role}`);
    if (typeof days !== 'number' || !Number.isFinite(days) || days < 0) {
      throw new TypeError(`policy.maxAgeDaysBySourceRole.${role} must be a finite non-negative number`);
    }
    maxAgeDaysBySourceRole[role] = days;
  }
  for (const role of requiredSourceRoles) {
    if (!Object.prototype.hasOwnProperty.call(maxAgeDaysBySourceRole, role)) {
      throw new TypeError(`freshness policy missing for required source role: ${role}`);
    }
  }

  if (!policy.minimumIndependentSourcesByKey || typeof policy.minimumIndependentSourcesByKey !== 'object' || Array.isArray(policy.minimumIndependentSourcesByKey)) {
    throw new TypeError('policy.minimumIndependentSourcesByKey is required');
  }
  const minimumIndependentSourcesByKey = {};
  for (const key of requiredKeys) {
    const minimum = policy.minimumIndependentSourcesByKey[key];
    if (!Number.isInteger(minimum) || minimum < 1) {
      throw new TypeError(`policy.minimumIndependentSourcesByKey.${key} must be a positive integer`);
    }
    minimumIndependentSourcesByKey[key] = minimum;
  }

  const numericToleranceByKey = {};
  const suppliedTolerances = policy.numericToleranceByKey || {};
  if (!suppliedTolerances || typeof suppliedTolerances !== 'object' || Array.isArray(suppliedTolerances)) {
    throw new TypeError('policy.numericToleranceByKey must be an object');
  }
  for (const key of requiredKeys) {
    const requiresExplicitTolerance = keyClassByKey[key] === PROPERTY_EVIDENCE_CLASS.LAND_AREA;
    const normalized = normalizeTolerance(suppliedTolerances[key], `policy.numericToleranceByKey.${key}`, {
      required: requiresExplicitTolerance,
    });
    if (normalized) numericToleranceByKey[key] = normalized;
  }

  const blockingFindingValuesByKey = {};
  const suppliedBlocking = policy.blockingFindingValuesByKey || {};
  if (!suppliedBlocking || typeof suppliedBlocking !== 'object' || Array.isArray(suppliedBlocking)) {
    throw new TypeError('policy.blockingFindingValuesByKey must be an object');
  }
  for (const [key, values] of Object.entries(suppliedBlocking)) {
    if (!keyClassByKey[key] || !FINDING_CLASSES.has(keyClassByKey[key])) {
      throw new TypeError(`blocking finding key must map to RESTRICTION, ENCUMBRANCE or EASEMENT: ${key}`);
    }
    if (!Array.isArray(values) || values.length === 0) {
      throw new TypeError(`policy.blockingFindingValuesByKey.${key} must be a non-empty array`);
    }
    blockingFindingValuesByKey[key] = values.map(stableClone);
  }

  return deepFreeze({
    policyId: policy.policyId.trim(),
    version: policy.version.trim(),
    requiredSourceRoles,
    requiredKeys,
    keyClassByKey: stableClone(keyClassByKey),
    maxAgeDaysBySourceRole: stableClone(maxAgeDaysBySourceRole),
    minimumIndependentSourcesByKey: stableClone(minimumIndependentSourcesByKey),
    numericToleranceByKey: stableClone(numericToleranceByKey),
    blockingFindingValuesByKey: stableClone(blockingFindingValuesByKey),
  });
}

function projectedFactFromRecordFact(fact) {
  if (!fact || typeof fact !== 'object') return null;
  try {
    return {
      factId: fact.factId,
      caseId: fact.caseId,
      documentId: fact.documentId,
      documentHashSha256: typeof fact.documentHashSha256 === 'string' ? fact.documentHashSha256.toLowerCase() : fact.documentHashSha256,
      key: fact.key,
      valueType: fact.valueType,
      unit: fact.unit ?? null,
      normalizedValueHashSha256: sha256({ value: fact.normalizedValue, unit: fact.unit ?? null, valueType: fact.valueType }),
      sourceLocator: fact.sourceLocator,
      extractionMethod: fact.extraction?.method || null,
      extractionConfidence: fact.extraction?.confidence ?? null,
      truthStatus: fact.truthStatus,
      verificationStatus: fact.verification?.status || null,
      verificationReference: fact.verification?.reference || null,
      verifiedAt: fact.verification?.verifiedAt || null,
      authorityClass: fact.authorityClass || null,
      authorityVerified: Boolean(fact.authorityVerified),
      capturedAt: canonicalIso(fact.capturedAt, 'fact.capturedAt'),
    };
  } catch (_) {
    return null;
  }
}

function validateFactProjectionBinding(record) {
  if (!record || typeof record !== 'object' || !record.factProjection) return false;
  const expected = projectedFactFromRecordFact(record.fact);
  return expected !== null && stableString(expected) === stableString(record.factProjection);
}

function evidenceSortKey(record) {
  return [record?.sourceRole || '', record?.recordId || '', record?.fact?.factId || '', record?.fact?.documentHashSha256 || ''].join('|');
}

function sortedEvidence(records) {
  return [...records].sort((a, b) => evidenceSortKey(a).localeCompare(evidenceSortKey(b), 'en'));
}

function sourceCoverage(policy, records) {
  return policy.requiredSourceRoles.map((role) => ({
    sourceRole: role,
    recordCount: records.filter((record) => record?.sourceRole === role).length,
  }));
}

function evidenceLineage(records) {
  return records.map((record) => ({
    recordId: record.recordId || null,
    sourceRole: record.sourceRole || null,
    sourceReference: record.sourceReference || null,
    evidenceLink: record.evidenceLink || null,
    chainHashSha256: record.chainHashSha256 || null,
    factId: record.fact?.factId || null,
    key: record.fact?.key || null,
    documentId: record.fact?.documentId || null,
    documentHashSha256: record.fact?.documentHashSha256 || null,
    verificationReference: record.fact?.verification?.reference || null,
    verifiedAt: record.fact?.verification?.verifiedAt || null,
    authorityClass: record.fact?.authorityClass || null,
    authorityVerified: Boolean(record.fact?.authorityVerified),
    professionalReviewRef: record.professionalReview?.reviewEvidenceRef || null,
  }));
}

function classConflictCode(evidenceClass, reconciliationStatus) {
  if (reconciliationStatus === RECONCILIATION_STATUS.UNIT_MISMATCH && evidenceClass === PROPERTY_EVIDENCE_CLASS.LAND_AREA) {
    return 'LAND_AREA_UNIT_MISMATCH';
  }
  const map = {
    PROPERTY_IDENTITY: 'PROPERTY_IDENTITY_MISMATCH',
    OWNER: 'OWNER_MISMATCH',
    PARCEL: 'PARCEL_MISMATCH',
    PLOT: 'PLOT_MISMATCH',
    PLAN: 'PLAN_MISMATCH',
    LAND_AREA: 'LAND_AREA_MISMATCH',
  };
  return map[evidenceClass] || 'MATERIAL_PROPERTY_DATA_CONFLICT';
}

function sameGovernedValue(left, right) {
  return stableString(left) === stableString(right);
}

function finalizeResult(core) {
  const authority = {
    legalTitleValidityEstablished: false,
    certifiedValuationEstablished: false,
    automaticUnderwritingAdoption: false,
    financialEngineInputsWritten: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    decisionBinding: false,
  };
  const resultWithoutHash = { ...core, ...authority };
  return deepFreeze({
    ...resultWithoutHash,
    resultHashSha256: sha256(resultWithoutHash),
  });
}

function baseResult({ status, reasons, caseId = null, propertyRef = null, asOf = null, policy = null, records = [], coverage = [], reconciliationChecks = [], findings = [] }) {
  return finalizeResult({
    schemaVersion: 1,
    capability: CAPABILITY,
    status,
    reasons: [...new Set(reasons)].sort(),
    caseId,
    propertyRef,
    asOf,
    policy: policy ? {
      policyId: policy.policyId,
      version: policy.version,
      policyHashSha256: sha256(policy),
    } : null,
    evidenceLineage: evidenceLineage(records),
    sourceCoverage: coverage,
    reconciliationChecks,
    findings,
    professionalReviewReady: status === TITLE_SURVEY_VERIFICATION_STATUS.READY_FOR_PROFESSIONAL_REVIEW,
    semantics: status === TITLE_SURVEY_VERIFICATION_STATUS.READY_FOR_PROFESSIONAL_REVIEW
      ? 'Supplied title/survey/property evidence passed the explicit C8 evidence policy for professional review. This is an evidence-consistency/readiness state only; it is not a legal title opinion, certified valuation, transaction approval, or financial-engine authorization.'
      : 'C8 failed closed under the explicit evidence policy. No source winner, legal conclusion, automatic financial input, transaction authority, or approval is created.',
  });
}

function verifyGovernedTitleSurveyPropertyEvidence({ caseId, propertyRef, evidenceRecords, policy, asOf } = {}) {
  const safeCaseId = nonEmpty(caseId) ? caseId.trim() : null;
  const safePropertyRef = nonEmpty(propertyRef) ? propertyRef.trim() : null;
  if (!safeCaseId || !safePropertyRef) {
    return baseResult({
      status: TITLE_SURVEY_VERIFICATION_STATUS.HOLD_POLICY,
      reasons: ['CASE_AND_PROPERTY_IDENTITY_REQUIRED'],
      caseId: safeCaseId,
      propertyRef: safePropertyRef,
    });
  }

  let normalizedPolicy;
  let canonicalAsOf;
  try {
    normalizedPolicy = normalizePolicy(policy);
    canonicalAsOf = canonicalIso(asOf, 'asOf');
  } catch (error) {
    return baseResult({
      status: TITLE_SURVEY_VERIFICATION_STATUS.HOLD_POLICY,
      reasons: [`POLICY_OR_CONTROL_INPUT_INVALID:${error.message}`],
      caseId: safeCaseId,
      propertyRef: safePropertyRef,
    });
  }

  if (!Array.isArray(evidenceRecords) || evidenceRecords.length === 0) {
    return baseResult({
      status: TITLE_SURVEY_VERIFICATION_STATUS.HOLD_EVIDENCE,
      reasons: ['PROPERTY_EVIDENCE_REQUIRED'],
      caseId: safeCaseId,
      propertyRef: safePropertyRef,
      asOf: canonicalAsOf,
      policy: normalizedPolicy,
    });
  }

  const records = sortedEvidence(evidenceRecords);
  const policyCoverage = sourceCoverage(normalizedPolicy, records);
  const policyReasons = [];
  const integrityReasons = [];
  const evidenceReasons = [];
  const freshnessReasons = [];
  const asOfMs = Date.parse(canonicalAsOf);

  for (const record of records) {
    const recordId = nonEmpty(record?.recordId) ? record.recordId : 'UNKNOWN';
    if (!record || typeof record !== 'object') {
      integrityReasons.push(`EVIDENCE_RECORD_MALFORMED:${recordId}`);
      continue;
    }
    if (record.caseId !== safeCaseId || record.fact?.caseId !== safeCaseId) {
      evidenceReasons.push(`CASE_ISOLATION_VIOLATION:${recordId}`);
    }
    if (!Object.values(EVIDENCE_SOURCE_ROLE).includes(record.sourceRole)) {
      evidenceReasons.push(`UNSUPPORTED_EVIDENCE_SOURCE_ROLE:${recordId}`);
    } else if (!Object.prototype.hasOwnProperty.call(normalizedPolicy.maxAgeDaysBySourceRole, record.sourceRole)) {
      policyReasons.push(`SOURCE_ROLE_FRESHNESS_POLICY_MISSING:${record.sourceRole}`);
    }
    if (!validateProfessionalEvidenceChainIntegrity(record) || !validateFactProjectionBinding(record)) {
      integrityReasons.push(`EVIDENCE_CHAIN_OR_FACT_BINDING_FAILED:${recordId}`);
      continue;
    }
    const admissibility = assessProfessionalEvidenceAdmissibility({
      record,
      target: ADMISSIBILITY_TARGET.PROFESSIONAL_REPORT,
    });
    if (admissibility.status !== ADMISSIBILITY_STATUS.READY) {
      evidenceReasons.push(`EVIDENCE_NOT_ADMISSIBLE:${recordId}:${admissibility.status}`);
    }

    const verifiedAt = record.fact?.verification?.verifiedAt;
    let verifiedMs = Number.NaN;
    if (nonEmpty(verifiedAt)) verifiedMs = Date.parse(verifiedAt);
    if (!Number.isFinite(verifiedMs)) {
      freshnessReasons.push(`EVIDENCE_VERIFICATION_TIMESTAMP_MISSING_OR_INVALID:${recordId}`);
    } else if (verifiedMs > asOfMs) {
      freshnessReasons.push(`EVIDENCE_VERIFICATION_TIMESTAMP_IN_FUTURE:${recordId}`);
    } else if (Object.prototype.hasOwnProperty.call(normalizedPolicy.maxAgeDaysBySourceRole, record.sourceRole)) {
      const ageDays = (asOfMs - verifiedMs) / DAY_MS;
      if (ageDays > normalizedPolicy.maxAgeDaysBySourceRole[record.sourceRole]) {
        freshnessReasons.push(`EVIDENCE_STALE:${recordId}:${record.sourceRole}`);
      }
    }
  }

  if (policyReasons.length) {
    return baseResult({ status: TITLE_SURVEY_VERIFICATION_STATUS.HOLD_POLICY, reasons: policyReasons, caseId: safeCaseId, propertyRef: safePropertyRef, asOf: canonicalAsOf, policy: normalizedPolicy, records, coverage: policyCoverage });
  }
  if (integrityReasons.length) {
    return baseResult({ status: TITLE_SURVEY_VERIFICATION_STATUS.HOLD_INTEGRITY, reasons: integrityReasons, caseId: safeCaseId, propertyRef: safePropertyRef, asOf: canonicalAsOf, policy: normalizedPolicy, records: [], coverage: policyCoverage });
  }
  if (evidenceReasons.length) {
    return baseResult({ status: TITLE_SURVEY_VERIFICATION_STATUS.HOLD_EVIDENCE, reasons: evidenceReasons, caseId: safeCaseId, propertyRef: safePropertyRef, asOf: canonicalAsOf, policy: normalizedPolicy, records, coverage: policyCoverage });
  }
  if (freshnessReasons.length) {
    return baseResult({ status: TITLE_SURVEY_VERIFICATION_STATUS.HOLD_FRESHNESS, reasons: freshnessReasons, caseId: safeCaseId, propertyRef: safePropertyRef, asOf: canonicalAsOf, policy: normalizedPolicy, records, coverage: policyCoverage });
  }

  const missingRoles = policyCoverage.filter((item) => item.recordCount === 0).map((item) => `REQUIRED_SOURCE_ROLE_MISSING:${item.sourceRole}`);
  if (missingRoles.length) {
    return baseResult({ status: TITLE_SURVEY_VERIFICATION_STATUS.HOLD_EVIDENCE, reasons: missingRoles, caseId: safeCaseId, propertyRef: safePropertyRef, asOf: canonicalAsOf, policy: normalizedPolicy, records, coverage: policyCoverage });
  }

  const reconciliations = reconcileEvidenceFacts(records.map((record) => record.fact), {
    caseId: safeCaseId,
    keys: normalizedPolicy.requiredKeys,
    numericToleranceByKey: normalizedPolicy.numericToleranceByKey,
  });
  const reconciliationChecks = reconciliations.map((result) => ({
    key: result.key,
    evidenceClass: normalizedPolicy.keyClassByKey[result.key],
    status: result.status,
    factCount: result.factCount,
    independentSourceCount: result.independentSourceCount,
    requiredIndependentSources: normalizedPolicy.minimumIndependentSourcesByKey[result.key],
    consensusValue: result.consensusValue,
    consensusUnit: result.consensusUnit,
  }));

  const missingKeyReasons = [];
  const conflictReasons = [];
  for (const result of reconciliations) {
    const evidenceClass = normalizedPolicy.keyClassByKey[result.key];
    if (result.status === RECONCILIATION_STATUS.MISSING) {
      missingKeyReasons.push(`REQUIRED_PROPERTY_KEY_MISSING:${result.key}`);
      continue;
    }
    if (result.independentSourceCount < normalizedPolicy.minimumIndependentSourcesByKey[result.key]) {
      missingKeyReasons.push(`INDEPENDENT_EVIDENCE_INSUFFICIENT:${result.key}`);
    }
    if (result.status === RECONCILIATION_STATUS.CONFLICT || result.status === RECONCILIATION_STATUS.UNIT_MISMATCH) {
      conflictReasons.push(`${classConflictCode(evidenceClass, result.status)}:${result.key}`);
    }
  }

  const findings = records
    .filter((record) => FINDING_CLASSES.has(normalizedPolicy.keyClassByKey[record.fact.key]))
    .map((record) => ({
      evidenceClass: normalizedPolicy.keyClassByKey[record.fact.key],
      key: record.fact.key,
      normalizedValue: stableClone(record.fact.normalizedValue),
      unit: record.fact.unit ?? null,
      sourceRole: record.sourceRole,
      sourceReference: record.sourceReference,
      recordId: record.recordId,
      factId: record.fact.factId,
      documentId: record.fact.documentId,
      documentHashSha256: record.fact.documentHashSha256,
      verificationReference: record.fact.verification?.reference || null,
      verifiedAt: record.fact.verification?.verifiedAt || null,
      chainHashSha256: record.chainHashSha256,
    }));

  if (conflictReasons.length) {
    return baseResult({ status: TITLE_SURVEY_VERIFICATION_STATUS.MATERIAL_PROPERTY_DATA_CONFLICT, reasons: conflictReasons, caseId: safeCaseId, propertyRef: safePropertyRef, asOf: canonicalAsOf, policy: normalizedPolicy, records, coverage: policyCoverage, reconciliationChecks, findings });
  }
  if (missingKeyReasons.length) {
    return baseResult({ status: TITLE_SURVEY_VERIFICATION_STATUS.HOLD_EVIDENCE, reasons: missingKeyReasons, caseId: safeCaseId, propertyRef: safePropertyRef, asOf: canonicalAsOf, policy: normalizedPolicy, records, coverage: policyCoverage, reconciliationChecks, findings });
  }

  const findingBlockers = [];
  for (const finding of findings) {
    const blockingValues = normalizedPolicy.blockingFindingValuesByKey[finding.key] || [];
    if (blockingValues.some((value) => sameGovernedValue(value, finding.normalizedValue))) {
      findingBlockers.push(`BLOCKING_MATERIAL_FINDING:${finding.evidenceClass}:${finding.key}`);
    }
  }
  if (findingBlockers.length) {
    return baseResult({ status: TITLE_SURVEY_VERIFICATION_STATUS.HOLD_MATERIAL_FINDING, reasons: findingBlockers, caseId: safeCaseId, propertyRef: safePropertyRef, asOf: canonicalAsOf, policy: normalizedPolicy, records, coverage: policyCoverage, reconciliationChecks, findings });
  }

  return baseResult({
    status: TITLE_SURVEY_VERIFICATION_STATUS.READY_FOR_PROFESSIONAL_REVIEW,
    reasons: [],
    caseId: safeCaseId,
    propertyRef: safePropertyRef,
    asOf: canonicalAsOf,
    policy: normalizedPolicy,
    records,
    coverage: policyCoverage,
    reconciliationChecks,
    findings,
  });
}

module.exports = {
  CAPABILITY,
  TITLE_SURVEY_VERIFICATION_STATUS,
  PROPERTY_EVIDENCE_CLASS,
  normalizePolicy,
  validateFactProjectionBinding,
  verifyGovernedTitleSurveyPropertyEvidence,
};

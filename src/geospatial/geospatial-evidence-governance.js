'use strict';

const crypto = require('crypto');
const {
  C1_GEOSPATIAL_EVIDENCE_SCHEMA_VERSION,
  GEOSPATIAL_EVIDENCE_TYPE,
  GEOSPATIAL_VERIFICATION_STATUS,
  GEOSPATIAL_RESOLUTION_METHOD,
  GEOSPATIAL_GATE_STATUS,
  C1_DEFAULT_REQUIRED_DECISION_EVIDENCE,
} = require('../contracts/geospatial-evidence');
const {
  OFFICIAL_GEOSPATIAL_SOURCE_REGISTRY_VERSION,
  getOfficialSource,
  sourceSupportsEvidenceType,
  officialUrlMatchesSource,
} = require('./official-source-registry');

const C1_GEOSPATIAL_EVIDENCE_GOVERNANCE_VERSION = 'C1_GEOSPATIAL_EVIDENCE_GOVERNANCE_V1';
const KNOWN_EVIDENCE_TYPES = Object.freeze(Object.values(GEOSPATIAL_EVIDENCE_TYPE));

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toTimestamp(value) {
  const text = cleanString(value);
  if (!text) return null;
  const ms = new Date(text).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isJsonSafe(value, seen = new Set()) {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;

  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonSafe(item, seen))
    : Object.keys(value).every((key) => isJsonSafe(value[key], seen));
  seen.delete(value);
  return valid;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function valueHash(value) {
  if (!isJsonSafe(value)) return null;
  try {
    const serialized = JSON.stringify(canonicalize(value));
    if (typeof serialized !== 'string') return null;
    return crypto.createHash('sha256').update(serialized).digest('hex');
  } catch (_) {
    return null;
  }
}

function unique(values) {
  return [...new Set(values)];
}

function evaluateRecord(record, { asOfMs, requiredEvidenceTypes }) {
  const evidenceType = cleanString(record && record.evidenceType);
  const critical = !!(record && record.critical === true) || requiredEvidenceTypes.includes(evidenceType);
  const blockers = [];
  const warnings = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { eligible: false, critical: true, evidenceType: null, blockers: ['C1_EVIDENCE_RECORD_OBJECT_REQUIRED'], warnings, normalized: null };
  }

  const id = cleanString(record.id);
  const subjectId = cleanString(record.subjectId);
  const sourceId = cleanString(record.sourceId);
  const sourceReference = cleanString(record.sourceReference);
  const sourceUrl = cleanString(record.sourceUrl);
  const freshnessPolicyId = cleanString(record.freshnessPolicyId);
  const resolutionMethod = cleanString(record.resolutionMethod);
  const verificationStatus = cleanString(record.verificationStatus);
  const observedAtMs = toTimestamp(record.observedAt);
  const validUntilMs = toTimestamp(record.validUntil);

  if (!id) blockers.push('C1_EVIDENCE_ID_REQUIRED');
  if (!subjectId) blockers.push('C1_EVIDENCE_SUBJECT_REQUIRED');
  if (!KNOWN_EVIDENCE_TYPES.includes(evidenceType)) blockers.push(`C1_EVIDENCE_TYPE_UNSUPPORTED:${evidenceType || 'MISSING'}`);

  const source = getOfficialSource(sourceId);
  if (!source) blockers.push(`C1_OFFICIAL_SOURCE_NOT_REGISTERED:${sourceId || 'MISSING'}`);
  if (source && evidenceType && !sourceSupportsEvidenceType(sourceId, evidenceType)) {
    blockers.push(`C1_SOURCE_SCOPE_MISMATCH:${sourceId}:${evidenceType}`);
  }
  if (!sourceReference) blockers.push(`C1_SOURCE_REFERENCE_REQUIRED:${evidenceType || 'UNKNOWN'}`);
  if (!officialUrlMatchesSource(sourceId, sourceUrl)) blockers.push(`C1_OFFICIAL_SOURCE_URL_REQUIRED:${sourceId || 'MISSING'}`);

  if (verificationStatus !== GEOSPATIAL_VERIFICATION_STATUS.VERIFIED) {
    blockers.push(`C1_VERIFIED_EVIDENCE_REQUIRED:${evidenceType || 'UNKNOWN'}`);
  }

  if (!Object.values(GEOSPATIAL_RESOLUTION_METHOD).includes(resolutionMethod)) {
    blockers.push(`C1_RESOLUTION_METHOD_REQUIRED:${evidenceType || 'UNKNOWN'}`);
  } else if (critical && resolutionMethod === GEOSPATIAL_RESOLUTION_METHOD.USER_SUPPLIED) {
    blockers.push(`C1_OFFICIAL_RESOLUTION_REQUIRED:${evidenceType || 'UNKNOWN'}`);
  }

  if (observedAtMs === null) blockers.push(`C1_OBSERVED_AT_REQUIRED:${evidenceType || 'UNKNOWN'}`);
  else if (observedAtMs > asOfMs) blockers.push(`C1_FUTURE_EVIDENCE_TIMESTAMP:${evidenceType || 'UNKNOWN'}`);

  if (critical) {
    if (!freshnessPolicyId) blockers.push(`C1_FRESHNESS_POLICY_REQUIRED:${evidenceType || 'UNKNOWN'}`);
    if (validUntilMs === null) blockers.push(`C1_VALID_UNTIL_REQUIRED:${evidenceType || 'UNKNOWN'}`);
    else {
      if (observedAtMs !== null && validUntilMs < observedAtMs) blockers.push(`C1_INVALID_VALIDITY_WINDOW:${evidenceType || 'UNKNOWN'}`);
      if (validUntilMs < asOfMs) blockers.push(`C1_EVIDENCE_STALE:${evidenceType || 'UNKNOWN'}`);
    }
  } else if (record.validUntil !== undefined && record.validUntil !== null && validUntilMs === null) {
    warnings.push(`C1_OPTIONAL_VALID_UNTIL_INVALID:${evidenceType || 'UNKNOWN'}`);
  }

  const hasNormalizedValue = Object.prototype.hasOwnProperty.call(record, 'normalizedValue')
    && record.normalizedValue !== undefined
    && record.normalizedValue !== null;
  const normalizedValueHash = hasNormalizedValue ? valueHash(record.normalizedValue) : null;
  if (!hasNormalizedValue) blockers.push(`C1_NORMALIZED_VALUE_REQUIRED:${evidenceType || 'UNKNOWN'}`);
  else if (!normalizedValueHash) blockers.push(`C1_NORMALIZED_VALUE_JSON_REQUIRED:${evidenceType || 'UNKNOWN'}`);

  const normalized = {
    id: id || null,
    subjectId: subjectId || null,
    evidenceType: evidenceType || null,
    normalizedValue: hasNormalizedValue ? record.normalizedValue : null,
    normalizedValueHash,
    sourceId: sourceId || null,
    sourceReference: sourceReference || null,
    sourceUrl: sourceUrl || null,
    authorityScope: source ? source.authorityScope : null,
    observedAt: observedAtMs === null ? null : new Date(observedAtMs).toISOString(),
    validUntil: validUntilMs === null ? null : new Date(validUntilMs).toISOString(),
    freshnessPolicyId: freshnessPolicyId || null,
    resolutionMethod: resolutionMethod || null,
    verificationStatus: verificationStatus || null,
    critical,
    blockers: Object.freeze(blockers),
    warnings: Object.freeze(warnings),
  };

  return {
    eligible: blockers.length === 0,
    critical,
    evidenceType: evidenceType || null,
    blockers,
    warnings,
    normalized: Object.freeze(normalized),
  };
}

function evaluateGeospatialEvidenceBundle({
  evidenceRecords,
  asOf = new Date(),
  requiredEvidenceTypes = C1_DEFAULT_REQUIRED_DECISION_EVIDENCE,
} = {}) {
  const asOfMs = new Date(asOf).getTime();
  if (!Number.isFinite(asOfMs)) throw new TypeError('asOf must be a valid date');
  if (!Array.isArray(requiredEvidenceTypes) || requiredEvidenceTypes.some((type) => !KNOWN_EVIDENCE_TYPES.includes(type))) {
    throw new TypeError('requiredEvidenceTypes must contain only supported geospatial evidence types');
  }

  const records = Array.isArray(evidenceRecords) ? evidenceRecords : [];
  const findings = records.map((record) => evaluateRecord(record, { asOfMs, requiredEvidenceTypes }));
  const decisionBlockers = [];
  const warnings = [];

  if (!Array.isArray(evidenceRecords)) decisionBlockers.push('C1_EVIDENCE_RECORDS_ARRAY_REQUIRED');

  findings.forEach((finding) => {
    warnings.push(...finding.warnings);
    if (finding.critical) decisionBlockers.push(...finding.blockers);
  });

  const resolvedEvidence = {};
  for (const evidenceType of unique([...requiredEvidenceTypes, ...findings.map((item) => item.evidenceType).filter(Boolean)])) {
    const eligible = findings.filter((item) => item.evidenceType === evidenceType && item.eligible);
    const hashes = unique(eligible.map((item) => item.normalized.normalizedValueHash));
    const isCriticalType = requiredEvidenceTypes.includes(evidenceType) || eligible.some((item) => item.critical);

    if (isCriticalType && eligible.length === 0) {
      decisionBlockers.push(`C1_REQUIRED_EVIDENCE_MISSING:${evidenceType}`);
      continue;
    }

    if (hashes.length > 1) {
      const code = `C1_EVIDENCE_CONFLICT:${evidenceType}`;
      if (isCriticalType) decisionBlockers.push(code);
      else warnings.push(code);
      continue;
    }

    if (eligible.length > 0) {
      resolvedEvidence[evidenceType] = Object.freeze({
        evidenceType,
        normalizedValue: eligible[0].normalized.normalizedValue,
        normalizedValueHash: hashes[0],
        sourceCount: eligible.length,
        sourceIds: Object.freeze(unique(eligible.map((item) => item.normalized.sourceId))),
        evidenceIds: Object.freeze(eligible.map((item) => item.normalized.id)),
        crossSourceConfirmed: unique(eligible.map((item) => item.normalized.sourceId)).length > 1,
      });
    }
  }

  const blockers = unique(decisionBlockers);
  const status = blockers.length > 0 ? GEOSPATIAL_GATE_STATUS.HOLD_EVIDENCE : GEOSPATIAL_GATE_STATUS.READY;

  return Object.freeze({
    version: C1_GEOSPATIAL_EVIDENCE_GOVERNANCE_VERSION,
    schemaVersion: C1_GEOSPATIAL_EVIDENCE_SCHEMA_VERSION,
    sourceRegistryVersion: OFFICIAL_GEOSPATIAL_SOURCE_REGISTRY_VERSION,
    asOf: new Date(asOfMs).toISOString(),
    status,
    decisionReady: status === GEOSPATIAL_GATE_STATUS.READY,
    requiredEvidenceTypes: Object.freeze([...requiredEvidenceTypes]),
    resolvedEvidence: Object.freeze(resolvedEvidence),
    records: Object.freeze(findings.map((item) => item.normalized).filter(Boolean)),
    blockers: Object.freeze(blockers),
    warnings: Object.freeze(unique(warnings)),
    evidenceFirst: true,
    bindingZoningDetermination: false,
    professionalValuationOpinion: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'C1 evaluates provenance, source scope, temporal validity and conflicts for official geospatial evidence. It does not infer missing parcel/zoning facts, create a legal or professional determination, or authorize a transaction.',
  });
}

module.exports = {
  C1_GEOSPATIAL_EVIDENCE_GOVERNANCE_VERSION,
  evaluateGeospatialEvidenceBundle,
};

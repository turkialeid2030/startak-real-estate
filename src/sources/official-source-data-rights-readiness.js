'use strict';

const crypto = require('crypto');
const { SAUDI_OFFICIAL_SOURCE_CATALOG } = require('./saudi-official-source-catalog');

const CAPABILITY = 'C49_INTERNAL_OFFICIAL_SOURCE_DATA_RIGHTS_READINESS_V1';
const POLICY_VERSION = 'C49_SOURCE_RIGHTS_AUTHORIZATION_PREP_V1';
const GATE_ID = '548';
const EVIDENCE_ID = 'SOURCE_RIGHTS_AUTHORIZATION';

const STATUS = Object.freeze({
  READY_FOR_INDEPENDENT_SOURCE_RIGHTS_REVIEW: 'READY_FOR_INDEPENDENT_SOURCE_RIGHTS_REVIEW',
  READY_FOR_C30_GATE_INGESTION: 'READY_FOR_C30_GATE_INGESTION',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_CONFIGURATION: 'HOLD_CONFIGURATION',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_EXTERNAL_RIGHTS_AUTHORIZATION: 'HOLD_EXTERNAL_RIGHTS_AUTHORIZATION',
  REJECTED: 'REJECTED',
});

const EXTERNAL_STATUS = Object.freeze({
  NOT_SUPPLIED: 'NOT_SUPPLIED',
  SUPPLIED_VERIFIED: 'SUPPLIED_VERIFIED',
  REJECTED: 'REJECTED',
});

const HASH_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const SECRET_FIELD_TOKENS = ['apikey', 'password', 'privatekey', 'credentialvalue', 'accesstoken', 'bearertoken', 'secretvalue'];
const RIGHT_FIELDS = Object.freeze(['accessBasisRef', 'processingBasisRef', 'storageBasisRef', 'derivedUseBasisRef', 'redistributionBasisRef']);
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const clean = (value) => nonEmpty(value) ? value.trim() : '';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function without(value, fields) { const out = { ...value }; fields.forEach((field) => delete out[field]); return out; }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
function iso(value, field) {
  if (!nonEmpty(value) || !Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be a valid date/time`);
  return new Date(value).toISOString();
}
function requireHash(value, field) {
  const normalized = clean(value).toLowerCase();
  if (!HASH_RE.test(normalized)) throw new TypeError(`${field} must be SHA-256`);
  return normalized;
}
function requireCommit(value, field) {
  const normalized = clean(value).toLowerCase();
  if (!COMMIT_RE.test(normalized)) throw new TypeError(`${field} must be a 40-character Git commit SHA`);
  return normalized;
}
function assertNoSecrets(input, path = 'record') {
  if (!input || typeof input !== 'object') return;
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedKey === 'secret' || SECRET_FIELD_TOKENS.some((token) => normalizedKey.includes(token))) {
      throw new TypeError(`C49_SECRET_MATERIAL_FIELD_FORBIDDEN:${path}.${key}`);
    }
    if (value && typeof value === 'object') assertNoSecrets(value, `${path}.${key}`);
  }
}
function integrity(record, hashField) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const hash = clean(record[hashField]).toLowerCase();
  return HASH_RE.test(hash) && sha256(without(record, [hashField])) === hash;
}
function canonicalSource(sourceId) {
  return SAUDI_OFFICIAL_SOURCE_CATALOG.find((source) => source.id === sourceId) || null;
}
function canonicalSourceIds() {
  return SAUDI_OFFICIAL_SOURCE_CATALOG.map((source) => source.id).sort();
}

function createRequiredSourceUniverse(input = {}) {
  assertNoSecrets(input);
  const candidateHeadSha = requireCommit(input.candidateHeadSha, 'candidateHeadSha');
  if (!nonEmpty(input.releaseScopeRef)) throw new TypeError('releaseScopeRef must be a non-empty string');
  if (!Array.isArray(input.requiredSourceIds)) throw new TypeError('requiredSourceIds must be an array');
  const sourceIds = [...new Set(input.requiredSourceIds.map(clean))].sort();
  if (sourceIds.some((id) => !canonicalSource(id))) throw new TypeError('C49_NON_CANONICAL_SOURCE_ID');
  const expected = canonicalSourceIds();
  if (JSON.stringify(sourceIds) !== JSON.stringify(expected)) throw new TypeError('C49_REQUIRED_SOURCE_UNIVERSE_INCOMPLETE');
  const reviewedAt = iso(input.reviewedAt, 'reviewedAt');
  const validUntil = iso(input.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C49_SOURCE_UNIVERSE_VALIDITY_INVALID');
  if (!nonEmpty(input.reviewedByRef)) throw new TypeError('reviewedByRef must be a non-empty string');
  const core = {
    schemaVersion: 1,
    candidateHeadSha,
    releaseScopeRef: input.releaseScopeRef.trim(),
    requiredSourceIds: sourceIds,
    reviewedByRef: input.reviewedByRef.trim(),
    reviewedAt,
    validUntil,
    sourceRightsAuthorized: false,
    sourceUseAuthorized: false,
    redistributionAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
  };
  return freeze({ ...core, universeHashSha256: sha256(core) });
}

function verifyRequiredSourceUniverse(record) { return integrity(record, 'universeHashSha256'); }

function createExternalSourceRightsRecord(input = {}) {
  assertNoSecrets(input);
  if (!Object.values(EXTERNAL_STATUS).includes(input.status)) throw new TypeError('C49_EXTERNAL_STATUS_INVALID');
  if (input.evidenceId !== EVIDENCE_ID) throw new TypeError('C49_EVIDENCE_ID_INVALID');
  const source = canonicalSource(clean(input.sourceId));
  if (!source) throw new TypeError('C49_NON_CANONICAL_SOURCE_ID');
  const core = {
    schemaVersion: 1,
    evidenceId: EVIDENCE_ID,
    gateId: GATE_ID,
    candidateHeadSha: requireCommit(input.candidateHeadSha, 'candidateHeadSha'),
    sourceId: source.id,
    authority: source.authority,
    officialDomain: source.officialDomain,
    status: input.status,
    accessBasisRef: null,
    processingBasisRef: null,
    storageBasisRef: null,
    derivedUseBasisRef: null,
    redistributionBasisRef: null,
    licenceTermsRef: null,
    restrictionsRef: null,
    evidenceRef: null,
    evidenceHashSha256: null,
    verifiedByRef: null,
    verifiedAt: null,
    validUntil: null,
    reasonCode: null,
    independentAuthorizationClaimedByEngineering: false,
  };

  if (input.status === EXTERNAL_STATUS.NOT_SUPPLIED) {
    const forbidden = [...RIGHT_FIELDS, 'licenceTermsRef', 'restrictionsRef', 'evidenceRef', 'evidenceHashSha256', 'verifiedByRef', 'verifiedAt', 'validUntil'];
    if (forbidden.some((field) => input[field] != null && input[field] !== '')) {
      throw new TypeError('C49_NOT_SUPPLIED_MUST_NOT_CARRY_SYNTHETIC_RIGHTS_EVIDENCE');
    }
    if (!nonEmpty(input.reasonCode)) throw new TypeError('C49_NOT_SUPPLIED_REASON_REQUIRED');
    core.reasonCode = input.reasonCode.trim();
  } else {
    for (const field of [...RIGHT_FIELDS, 'licenceTermsRef', 'restrictionsRef', 'evidenceRef', 'verifiedByRef', 'verifiedAt']) {
      if (!nonEmpty(input[field])) throw new TypeError(`C49_EXTERNAL_${field}_REQUIRED`);
    }
    RIGHT_FIELDS.forEach((field) => { core[field] = input[field].trim(); });
    core.licenceTermsRef = input.licenceTermsRef.trim();
    core.restrictionsRef = input.restrictionsRef.trim();
    core.evidenceRef = input.evidenceRef.trim();
    core.evidenceHashSha256 = requireHash(input.evidenceHashSha256, 'evidenceHashSha256');
    core.verifiedByRef = input.verifiedByRef.trim();
    core.verifiedAt = iso(input.verifiedAt, 'verifiedAt');
    core.validUntil = input.validUntil ? iso(input.validUntil, 'validUntil') : null;
    if (core.validUntil && Date.parse(core.validUntil) < Date.parse(core.verifiedAt)) throw new TypeError('C49_EXTERNAL_RIGHTS_VALIDITY_INVALID');
    if (input.status === EXTERNAL_STATUS.REJECTED) {
      if (!nonEmpty(input.reasonCode)) throw new TypeError('C49_EXTERNAL_REJECTION_REASON_REQUIRED');
      core.reasonCode = input.reasonCode.trim();
    }
  }
  return freeze({ ...core, recordHashSha256: sha256(core) });
}

function verifyExternalSourceRightsRecord(record) { return integrity(record, 'recordHashSha256'); }

function evaluateInternalSourceRightsReadiness({ sourceUniverse, asOf } = {}) {
  const at = iso(asOf, 'asOf');
  const blockers = [];
  if (!verifyRequiredSourceUniverse(sourceUniverse)) blockers.push('C49_INTEGRITY_SOURCE_UNIVERSE');
  else {
    if (Date.parse(sourceUniverse.reviewedAt) > Date.parse(at)) blockers.push('C49_WINDOW_SOURCE_UNIVERSE_FUTURE');
    if (Date.parse(sourceUniverse.validUntil) < Date.parse(at)) blockers.push('C49_WINDOW_SOURCE_UNIVERSE_EXPIRED');
    if (JSON.stringify([...sourceUniverse.requiredSourceIds].sort()) !== JSON.stringify(canonicalSourceIds())) blockers.push('C49_CONFIGURATION_REQUIRED_SOURCE_UNIVERSE_INCOMPLETE');
    if (sourceUniverse.sourceRightsAuthorized !== false || sourceUniverse.sourceUseAuthorized !== false || sourceUniverse.redistributionAuthorized !== false) blockers.push('C49_CONFIGURATION_AUTHORITY_INJECTION');
  }
  const unique = [...new Set(blockers)].sort();
  let status = STATUS.READY_FOR_INDEPENDENT_SOURCE_RIGHTS_REVIEW;
  if (unique.some((item) => item.startsWith('C49_INTEGRITY_'))) status = STATUS.HOLD_INTEGRITY;
  else if (unique.some((item) => item.startsWith('C49_WINDOW_'))) status = STATUS.HOLD_WINDOW;
  else if (unique.length) status = STATUS.HOLD_CONFIGURATION;
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status,
    internalEngineeringReady: unique.length === 0,
    blockers: unique,
    asOf: at,
    externalGateId: GATE_ID,
    sourceRightsAuthorizationSupplied: false,
    sourceUseAuthorized: false,
    redistributionAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
  });
}

function evaluateExternalSourceRightsForGateIngestion({ sourceUniverse, sourceRightsRecords, asOf } = {}) {
  const at = iso(asOf, 'asOf');
  const internal = evaluateInternalSourceRightsReadiness({ sourceUniverse, asOf: at });
  const blockers = [...internal.blockers];
  const records = Array.isArray(sourceRightsRecords) ? sourceRightsRecords : [];
  const bySource = new Map();

  for (const record of records) {
    if (!verifyExternalSourceRightsRecord(record)) {
      blockers.push('C49_INTEGRITY_EXTERNAL_RIGHTS_RECORD');
      continue;
    }
    if (bySource.has(record.sourceId)) blockers.push(`C49_EXTERNAL_DUPLICATE_SOURCE:${record.sourceId}`);
    bySource.set(record.sourceId, record);
    if (record.candidateHeadSha !== sourceUniverse.candidateHeadSha) blockers.push(`C49_EXTERNAL_BINDING_MISMATCH:${record.sourceId}:candidateHeadSha`);
    if (record.gateId !== GATE_ID || record.evidenceId !== EVIDENCE_ID) blockers.push(`C49_EXTERNAL_WRONG_GATE:${record.sourceId}`);
    if (record.status === EXTERNAL_STATUS.NOT_SUPPLIED) blockers.push(`C49_EXTERNAL_RIGHTS_NOT_SUPPLIED:${record.sourceId}`);
    if (record.status === EXTERNAL_STATUS.REJECTED) blockers.push(`C49_EXTERNAL_RIGHTS_REJECTED:${record.sourceId}:${record.reasonCode || 'UNSPECIFIED'}`);
    if (record.status === EXTERNAL_STATUS.SUPPLIED_VERIFIED) {
      for (const field of [...RIGHT_FIELDS, 'licenceTermsRef', 'restrictionsRef', 'evidenceRef', 'evidenceHashSha256', 'verifiedByRef', 'verifiedAt']) {
        if (!record[field]) blockers.push(`C49_EXTERNAL_RIGHTS_EVIDENCE_INCOMPLETE:${record.sourceId}:${field}`);
      }
      if (Date.parse(record.verifiedAt) > Date.parse(at)) blockers.push(`C49_EXTERNAL_RIGHTS_FUTURE:${record.sourceId}`);
      if (record.validUntil && Date.parse(record.validUntil) < Date.parse(at)) blockers.push(`C49_EXTERNAL_RIGHTS_EXPIRED:${record.sourceId}`);
    }
  }

  if (verifyRequiredSourceUniverse(sourceUniverse)) {
    for (const sourceId of sourceUniverse.requiredSourceIds) {
      if (!bySource.has(sourceId)) blockers.push(`C49_EXTERNAL_REQUIRED_SOURCE_MISSING:${sourceId}`);
    }
  }

  const unique = [...new Set(blockers)].sort();
  const rejected = unique.some((item) => item.startsWith('C49_EXTERNAL_RIGHTS_REJECTED:'));
  const complete = unique.length === 0 && sourceUniverse.requiredSourceIds.every((sourceId) => bySource.get(sourceId)?.status === EXTERNAL_STATUS.SUPPLIED_VERIFIED);
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status: rejected ? STATUS.REJECTED : complete ? STATUS.READY_FOR_C30_GATE_INGESTION : STATUS.HOLD_EXTERNAL_RIGHTS_AUTHORIZATION,
    readyForC30GateIngestion: complete,
    blockers: unique,
    asOf: at,
    externalGateId: GATE_ID,
    requiredSourceCount: verifyRequiredSourceUniverse(sourceUniverse) ? sourceUniverse.requiredSourceIds.length : 0,
    structurallyVerifiedSourceCount: [...bySource.values()].filter((record) => record.status === EXTERNAL_STATUS.SUPPLIED_VERIFIED).length,
    independentAuthorityStillMustBeValidatedByC30: true,
    sourceRightsAuthorized: false,
    sourceUseAuthorized: false,
    redistributionAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
  });
}

function evaluateProductionSourceUseAuthorization(input = {}) {
  const gate = evaluateExternalSourceRightsForGateIngestion(input);
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status: STATUS.HOLD_EXTERNAL_RIGHTS_AUTHORIZATION,
    blockers: [...new Set([...gate.blockers, 'C49_C30_GATE_AUTHORITY_NOT_CONSUMED', 'C49_PRODUCTION_SOURCE_USE_REQUIRES_SEPARATE_ACTIVATION'])].sort(),
    asOf: gate.asOf,
    sourceRightsAuthorized: false,
    sourceUseAuthorized: false,
    redistributionAuthorized: false,
    productionSourceUseAllowed: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
  });
}

module.exports = Object.freeze({
  CAPABILITY,
  POLICY_VERSION,
  GATE_ID,
  EVIDENCE_ID,
  STATUS,
  EXTERNAL_STATUS,
  RIGHT_FIELDS,
  canonicalSourceIds,
  createRequiredSourceUniverse,
  verifyRequiredSourceUniverse,
  createExternalSourceRightsRecord,
  verifyExternalSourceRightsRecord,
  evaluateInternalSourceRightsReadiness,
  evaluateExternalSourceRightsForGateIngestion,
  evaluateProductionSourceUseAuthorization,
});

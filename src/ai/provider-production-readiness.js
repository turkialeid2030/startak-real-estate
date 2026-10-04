'use strict';

const crypto = require('crypto');

const CAPABILITY = 'C48_INTERNAL_AI_PROVIDER_PRODUCTION_READINESS_V1';
const POLICY_VERSION = 'C48_PROVIDER_PRODUCTION_AUTHORIZATION_PREP_V1';

const STATUS = Object.freeze({
  READY_FOR_INDEPENDENT_PROVIDER_AUTHORIZATION_REVIEW: 'READY_FOR_INDEPENDENT_PROVIDER_AUTHORIZATION_REVIEW',
  READY_FOR_C30_GATE_INGESTION: 'READY_FOR_C30_GATE_INGESTION',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_CONFIGURATION: 'HOLD_CONFIGURATION',
  HOLD_WINDOW: 'HOLD_WINDOW',
  HOLD_EXTERNAL_AUTHORIZATION: 'HOLD_EXTERNAL_AUTHORIZATION',
  REJECTED: 'REJECTED',
});

const EXTERNAL_AUTH_STATUS = Object.freeze({
  NOT_SUPPLIED: 'NOT_SUPPLIED',
  SUPPLIED_VERIFIED: 'SUPPLIED_VERIFIED',
  REJECTED: 'REJECTED',
});

const HASH_RE = /^[a-f0-9]{64}$/i;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const FORBIDDEN_SECRET_KEY_RE = /(api[_-]?key|secret|password|token|credentialvalue|privatekey)/i;
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const clean = (value) => nonEmpty(value) ? value.trim() : '';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}
function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
function without(value, fields) {
  const out = { ...value };
  fields.forEach((field) => delete out[field]);
  return out;
}
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
    if (FORBIDDEN_SECRET_KEY_RE.test(key)) throw new TypeError(`C48_SECRET_MATERIAL_FIELD_FORBIDDEN:${path}.${key}`);
    if (value && typeof value === 'object') assertNoSecrets(value, `${path}.${key}`);
  }
}
function integrity(record, hashField) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const hash = clean(record[hashField]).toLowerCase();
  return HASH_RE.test(hash) && sha256(without(record, [hashField])) === hash;
}
function uniqueHashes(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const hashes = values.map((value) => requireHash(value, field));
  if (new Set(hashes).size !== hashes.length) throw new TypeError(`${field} contains duplicate hashes`);
  return [...hashes].sort();
}

function createProductionProviderConfiguration(input = {}) {
  assertNoSecrets(input);
  const required = [
    'configurationId', 'useCaseId', 'providerId', 'modelId', 'modelVersionRef',
    'credentialIsolationEvidenceRef', 'dataHandlingEvidenceRef', 'retentionEvidenceRef',
    'trainingUseEvidenceRef', 'dataResidencyEvidenceRef', 'loggingEvidenceRef',
    'dlpEvidenceRef', 'promptRegistryRef', 'roleAuthorizationRef',
    'environmentAuthorizationRef', 'killSwitchRef', 'reviewedByRef',
  ];
  required.forEach((field) => {
    if (!nonEmpty(input[field])) throw new TypeError(`${field} must be a non-empty string`);
  });

  const candidateHeadSha = requireCommit(input.candidateHeadSha, 'candidateHeadSha');
  const evidenceHashesSha256 = uniqueHashes(input.evidenceHashesSha256 || [], 'evidenceHashesSha256');
  if (evidenceHashesSha256.length < 10) throw new TypeError('C48_MINIMUM_CONTROL_EVIDENCE_HASHES_REQUIRED');
  if (input.productionCredentialsSeparated !== true) throw new TypeError('C48_PRODUCTION_CREDENTIAL_ISOLATION_REQUIRED');
  if (input.trainingUseCustomerData !== false) throw new TypeError('C48_CUSTOMER_DATA_TRAINING_MUST_BE_FALSE');
  if (input.secretsStoredInConfiguration !== false) throw new TypeError('C48_SECRETS_MUST_NOT_BE_STORED_IN_CONFIGURATION');
  if (input.killSwitchValidated !== true) throw new TypeError('C48_KILL_SWITCH_VALIDATION_REQUIRED');
  if (input.dlpEnforced !== true) throw new TypeError('C48_DLP_ENFORCEMENT_REQUIRED');
  if (input.productionProviderUseAuthorized === true || input.publicAiAuthorized === true || input.productionInvocationAuthorized === true) {
    throw new TypeError('C48_INTERNAL_CONFIGURATION_CANNOT_GRANT_EXTERNAL_PRODUCTION_AUTHORITY');
  }

  const reviewedAt = iso(input.reviewedAt, 'reviewedAt');
  const validUntil = iso(input.validUntil, 'validUntil');
  if (Date.parse(validUntil) < Date.parse(reviewedAt)) throw new TypeError('C48_CONFIGURATION_VALIDITY_INVALID');

  const core = {
    schemaVersion: 1,
    configurationId: input.configurationId.trim(),
    candidateHeadSha,
    useCaseId: input.useCaseId.trim(),
    providerId: input.providerId.trim(),
    modelId: input.modelId.trim(),
    modelVersionRef: input.modelVersionRef.trim(),
    productionCredentialsSeparated: true,
    secretsStoredInConfiguration: false,
    trainingUseCustomerData: false,
    killSwitchValidated: true,
    dlpEnforced: true,
    credentialIsolationEvidenceRef: input.credentialIsolationEvidenceRef.trim(),
    dataHandlingEvidenceRef: input.dataHandlingEvidenceRef.trim(),
    retentionEvidenceRef: input.retentionEvidenceRef.trim(),
    trainingUseEvidenceRef: input.trainingUseEvidenceRef.trim(),
    dataResidencyEvidenceRef: input.dataResidencyEvidenceRef.trim(),
    loggingEvidenceRef: input.loggingEvidenceRef.trim(),
    dlpEvidenceRef: input.dlpEvidenceRef.trim(),
    promptRegistryRef: input.promptRegistryRef.trim(),
    roleAuthorizationRef: input.roleAuthorizationRef.trim(),
    environmentAuthorizationRef: input.environmentAuthorizationRef.trim(),
    killSwitchRef: input.killSwitchRef.trim(),
    evidenceHashesSha256,
    reviewedByRef: input.reviewedByRef.trim(),
    reviewedAt,
    validUntil,
    productionProviderUseAuthorized: false,
    publicAiAuthorized: false,
    productionInvocationAuthorized: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
  };
  return freeze({ ...core, configurationHashSha256: sha256(core) });
}

function verifyProductionProviderConfiguration(record) {
  return integrity(record, 'configurationHashSha256');
}

function createExternalProductionAuthorizationEvidence(input = {}) {
  assertNoSecrets(input);
  if (!Object.values(EXTERNAL_AUTH_STATUS).includes(input.status)) throw new TypeError('C48_EXTERNAL_AUTH_STATUS_INVALID');
  const required = ['evidenceId', 'candidateHeadSha', 'useCaseId', 'providerId', 'modelId', 'modelVersionRef'];
  required.forEach((field) => {
    if (!nonEmpty(input[field])) throw new TypeError(`${field} must be a non-empty string`);
  });
  const candidateHeadSha = requireCommit(input.candidateHeadSha, 'candidateHeadSha');
  const core = {
    schemaVersion: 1,
    evidenceId: input.evidenceId.trim(),
    gateId: '547',
    candidateHeadSha,
    useCaseId: input.useCaseId.trim(),
    providerId: input.providerId.trim(),
    modelId: input.modelId.trim(),
    modelVersionRef: input.modelVersionRef.trim(),
    status: input.status,
    evidenceRef: null,
    evidenceHashSha256: null,
    verifiedByRef: null,
    verifiedAt: null,
    validUntil: null,
    reasonCode: null,
    independentAuthorizationClaimedByEngineering: false,
  };

  if (input.status === EXTERNAL_AUTH_STATUS.NOT_SUPPLIED) {
    if ([input.evidenceRef, input.evidenceHashSha256, input.verifiedByRef, input.verifiedAt].some((value) => value != null && value !== '')) {
      throw new TypeError('C48_NOT_SUPPLIED_MUST_NOT_CARRY_SYNTHETIC_APPROVAL_EVIDENCE');
    }
  } else {
    ['evidenceRef', 'verifiedByRef', 'verifiedAt'].forEach((field) => {
      if (!nonEmpty(input[field])) throw new TypeError(`C48_EXTERNAL_${field}_REQUIRED`);
    });
    core.evidenceRef = input.evidenceRef.trim();
    core.evidenceHashSha256 = requireHash(input.evidenceHashSha256, 'evidenceHashSha256');
    core.verifiedByRef = input.verifiedByRef.trim();
    core.verifiedAt = iso(input.verifiedAt, 'verifiedAt');
    core.validUntil = input.validUntil ? iso(input.validUntil, 'validUntil') : null;
    if (core.validUntil && Date.parse(core.validUntil) < Date.parse(core.verifiedAt)) throw new TypeError('C48_EXTERNAL_AUTH_VALIDITY_INVALID');
    if (input.status === EXTERNAL_AUTH_STATUS.REJECTED) {
      if (!nonEmpty(input.reasonCode)) throw new TypeError('C48_EXTERNAL_REJECTION_REASON_REQUIRED');
      core.reasonCode = input.reasonCode.trim();
    }
  }
  return freeze({ ...core, recordHashSha256: sha256(core) });
}

function verifyExternalProductionAuthorizationEvidence(record) {
  return integrity(record, 'recordHashSha256');
}

function evaluateInternalProductionReadiness(input = {}) {
  const asOf = iso(input.asOf, 'asOf');
  const configuration = input.configuration;
  const blockers = [];
  if (!verifyProductionProviderConfiguration(configuration)) {
    blockers.push('C48_INTEGRITY_CONFIGURATION');
  } else {
    if (Date.parse(configuration.reviewedAt) > Date.parse(asOf)) blockers.push('C48_WINDOW_CONFIGURATION_FUTURE');
    if (Date.parse(configuration.validUntil) < Date.parse(asOf)) blockers.push('C48_WINDOW_CONFIGURATION_EXPIRED');
    if (configuration.productionCredentialsSeparated !== true) blockers.push('C48_CONFIGURATION_CREDENTIAL_ISOLATION');
    if (configuration.trainingUseCustomerData !== false) blockers.push('C48_CONFIGURATION_CUSTOMER_TRAINING');
    if (configuration.secretsStoredInConfiguration !== false) blockers.push('C48_CONFIGURATION_SECRET_STORAGE');
    if (configuration.killSwitchValidated !== true) blockers.push('C48_CONFIGURATION_KILL_SWITCH');
    if (configuration.dlpEnforced !== true) blockers.push('C48_CONFIGURATION_DLP');
    if (configuration.productionProviderUseAuthorized !== false || configuration.publicAiAuthorized !== false || configuration.productionInvocationAuthorized !== false) blockers.push('C48_CONFIGURATION_AUTHORITY_INJECTION');
  }
  const unique = [...new Set(blockers)].sort();
  const status = unique.length === 0
    ? STATUS.READY_FOR_INDEPENDENT_PROVIDER_AUTHORIZATION_REVIEW
    : unique.some((item) => item.startsWith('C48_INTEGRITY_'))
      ? STATUS.HOLD_INTEGRITY
      : unique.some((item) => item.startsWith('C48_WINDOW_'))
        ? STATUS.HOLD_WINDOW
        : STATUS.HOLD_CONFIGURATION;
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status,
    internalEngineeringReady: unique.length === 0,
    blockers: unique,
    asOf,
    externalGateId: '547',
    externalAuthorizationSupplied: false,
    publicAiAuthorized: false,
    productionProviderUseAuthorized: false,
    productionInvocationAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
  });
}

function evaluateExternalAuthorizationForGateIngestion(input = {}) {
  const asOf = iso(input.asOf, 'asOf');
  const configuration = input.configuration;
  const externalAuthorization = input.externalAuthorization;
  const internal = evaluateInternalProductionReadiness({ configuration, asOf });
  const blockers = [...internal.blockers];

  if (!verifyExternalProductionAuthorizationEvidence(externalAuthorization)) {
    blockers.push('C48_INTEGRITY_EXTERNAL_AUTHORIZATION_RECORD');
  } else if (verifyProductionProviderConfiguration(configuration)) {
    const bindingFields = ['candidateHeadSha', 'useCaseId', 'providerId', 'modelId', 'modelVersionRef'];
    for (const field of bindingFields) {
      if (externalAuthorization[field] !== configuration[field]) blockers.push(`C48_EXTERNAL_AUTH_BINDING_MISMATCH:${field}`);
    }
    if (externalAuthorization.gateId !== '547') blockers.push('C48_EXTERNAL_AUTH_WRONG_GATE');
    if (externalAuthorization.status === EXTERNAL_AUTH_STATUS.NOT_SUPPLIED) blockers.push('C48_EXTERNAL_AUTHORIZATION_NOT_SUPPLIED');
    if (externalAuthorization.status === EXTERNAL_AUTH_STATUS.REJECTED) blockers.push(`C48_EXTERNAL_AUTHORIZATION_REJECTED:${externalAuthorization.reasonCode || 'UNSPECIFIED'}`);
    if (externalAuthorization.status === EXTERNAL_AUTH_STATUS.SUPPLIED_VERIFIED) {
      if (!externalAuthorization.evidenceRef || !externalAuthorization.evidenceHashSha256 || !externalAuthorization.verifiedByRef || !externalAuthorization.verifiedAt) blockers.push('C48_EXTERNAL_AUTHORIZATION_EVIDENCE_INCOMPLETE');
      if (Date.parse(externalAuthorization.verifiedAt) > Date.parse(asOf)) blockers.push('C48_EXTERNAL_AUTHORIZATION_FUTURE');
      if (externalAuthorization.validUntil && Date.parse(externalAuthorization.validUntil) < Date.parse(asOf)) blockers.push('C48_EXTERNAL_AUTHORIZATION_EXPIRED');
    }
  }

  const unique = [...new Set(blockers)].sort();
  const rejected = unique.some((item) => item.startsWith('C48_EXTERNAL_AUTHORIZATION_REJECTED:'));
  const readyForIngestion = unique.length === 0 && externalAuthorization.status === EXTERNAL_AUTH_STATUS.SUPPLIED_VERIFIED;
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status: rejected ? STATUS.REJECTED : readyForIngestion ? STATUS.READY_FOR_C30_GATE_INGESTION : STATUS.HOLD_EXTERNAL_AUTHORIZATION,
    readyForC30GateIngestion: readyForIngestion,
    blockers: unique,
    asOf,
    externalGateId: '547',
    externalAuthorizationRecordStructurallyComplete: readyForIngestion,
    independentAuthorityStillMustBeValidatedByC30: true,
    publicAiAuthorized: false,
    productionProviderUseAuthorized: false,
    productionInvocationAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
  });
}

function evaluateProductionInvocationAuthorization(input = {}) {
  const asOf = iso(input.asOf, 'asOf');
  const gate = evaluateExternalAuthorizationForGateIngestion(input);
  const blockers = [...gate.blockers, 'C48_RUNTIME_PRODUCTION_INVOCATION_PATH_NOT_IMPLEMENTED', 'C48_C30_GATE_AUTHORITY_NOT_CONSUMED'];
  return freeze({
    capability: CAPABILITY,
    policyVersion: POLICY_VERSION,
    status: STATUS.HOLD_EXTERNAL_AUTHORIZATION,
    blockers: [...new Set(blockers)].sort(),
    asOf,
    publicAiAuthorized: false,
    productionProviderUseAuthorized: false,
    productionInvocationAuthorized: false,
    providerCallAllowed: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
  });
}

module.exports = Object.freeze({
  CAPABILITY,
  POLICY_VERSION,
  STATUS,
  EXTERNAL_AUTH_STATUS,
  createProductionProviderConfiguration,
  verifyProductionProviderConfiguration,
  createExternalProductionAuthorizationEvidence,
  verifyExternalProductionAuthorizationEvidence,
  evaluateInternalProductionReadiness,
  evaluateExternalAuthorizationForGateIngestion,
  evaluateProductionInvocationAuthorization,
});

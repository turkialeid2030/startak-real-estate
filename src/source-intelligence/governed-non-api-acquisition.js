'use strict';

const crypto = require('crypto');
const { SOURCE_TIER } = require('../contracts/source-intelligence');
const { getCanonicalSourceProvider } = require('./source-provider-registry');

const CAPABILITY = 'C2N_GOVERNED_NON_API_SOURCE_ACQUISITION_V1';

const ACQUISITION_METHOD = Object.freeze({
  OFFICIAL_OPEN_DATA_FILE_DOWNLOAD: 'OFFICIAL_OPEN_DATA_FILE_DOWNLOAD',
  OFFICIAL_REPORT_DOWNLOAD: 'OFFICIAL_REPORT_DOWNLOAD',
  PUBLIC_BROWSER_RENDERED_CAPTURE: 'PUBLIC_BROWSER_RENDERED_CAPTURE',
  USER_AUTHORIZED_BROWSER_EXPORT: 'USER_AUTHORIZED_BROWSER_EXPORT',
  MANUAL_GOVERNED_UPLOAD: 'MANUAL_GOVERNED_UPLOAD',
});

const EXTRACTION_METHOD = Object.freeze({
  STRUCTURED_FILE_PARSE: 'STRUCTURED_FILE_PARSE',
  DOCUMENT_TEXT_EXTRACTION: 'DOCUMENT_TEXT_EXTRACTION',
  HTML_TABLE_EXTRACTION: 'HTML_TABLE_EXTRACTION',
  BROWSER_RENDERED_SNAPSHOT_EXTRACTION: 'BROWSER_RENDERED_SNAPSHOT_EXTRACTION',
  MANUAL_VERIFIED_TRANSCRIPTION: 'MANUAL_VERIFIED_TRANSCRIPTION',
});

const RIGHTS_MODE = Object.freeze({
  PUBLISHED_OPEN_DATA_REUSE: 'PUBLISHED_OPEN_DATA_REUSE',
  VERIFIED_RIGHTS_REQUIRED: 'VERIFIED_RIGHTS_REQUIRED',
  WRITTEN_PERMISSION_REQUIRED: 'WRITTEN_PERMISSION_REQUIRED',
  TERMS_UNVERIFIED: 'TERMS_UNVERIFIED',
});

const NON_API_ACQUISITION_STATUS = Object.freeze({
  READY_FOR_C2S_PROVENANCE_EVALUATION: 'READY_FOR_C2S_PROVENANCE_EVALUATION',
  HOLD_SOURCE: 'HOLD_SOURCE',
  HOLD_POLICY: 'HOLD_POLICY',
  HOLD_RIGHTS: 'HOLD_RIGHTS',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
  HOLD_TEMPORAL: 'HOLD_TEMPORAL',
});

const SOURCE_ACQUISITION_PROFILES = Object.freeze({
  BALADY_OPEN_DATA_DOWNLOADS: Object.freeze({
    profileId: 'BALADY_OPEN_DATA_DOWNLOADS',
    sourceProvider: 'BALADY_URBAN_MAPS',
    allowedHosts: Object.freeze(['balady.gov.sa', 'www.balady.gov.sa', 'open.data.gov.sa']),
    allowedMethods: Object.freeze([
      ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,
      ACQUISITION_METHOD.OFFICIAL_REPORT_DOWNLOAD,
      ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD,
    ]),
    allowedAutomatedMethods: Object.freeze([
      ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,
      ACQUISITION_METHOD.OFFICIAL_REPORT_DOWNLOAD,
    ]),
    rightsMode: RIGHTS_MODE.PUBLISHED_OPEN_DATA_REUSE,
    attributionRequired: true,
    browserAutomationAllowed: false,
  }),
  MADINAH_OPEN_DATA_DOWNLOADS: Object.freeze({
    profileId: 'MADINAH_OPEN_DATA_DOWNLOADS',
    sourceProvider: 'MADINAH_MUNICIPALITY_GEOSPATIAL',
    allowedHosts: Object.freeze([
      'amana-md.gov.sa', 'www.amana-md.gov.sa', 'services.amana-md.gov.sa', 'open.data.gov.sa',
    ]),
    allowedMethods: Object.freeze([
      ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,
      ACQUISITION_METHOD.OFFICIAL_REPORT_DOWNLOAD,
      ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD,
    ]),
    allowedAutomatedMethods: Object.freeze([
      ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,
      ACQUISITION_METHOD.OFFICIAL_REPORT_DOWNLOAD,
    ]),
    rightsMode: RIGHTS_MODE.PUBLISHED_OPEN_DATA_REUSE,
    attributionRequired: true,
    browserAutomationAllowed: false,
  }),
  RIYADH_OPEN_DATA_DOWNLOADS: Object.freeze({
    profileId: 'RIYADH_OPEN_DATA_DOWNLOADS',
    sourceProvider: 'RIYADH_MUNICIPALITY_GEOSPATIAL',
    allowedHosts: Object.freeze([
      'alriyadh.gov.sa', 'www.alriyadh.gov.sa', 'rmp.alriyadh.gov.sa', 'open.data.gov.sa',
    ]),
    allowedMethods: Object.freeze([
      ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,
      ACQUISITION_METHOD.OFFICIAL_REPORT_DOWNLOAD,
      ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD,
    ]),
    allowedAutomatedMethods: Object.freeze([
      ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,
      ACQUISITION_METHOD.OFFICIAL_REPORT_DOWNLOAD,
    ]),
    rightsMode: RIGHTS_MODE.PUBLISHED_OPEN_DATA_REUSE,
    attributionRequired: true,
    browserAutomationAllowed: false,
  }),
  RIYADH_MAP_PORTAL_RESTRICTED: Object.freeze({
    profileId: 'RIYADH_MAP_PORTAL_RESTRICTED',
    sourceProvider: 'RIYADH_MUNICIPALITY_GEOSPATIAL',
    allowedHosts: Object.freeze(['maps.alriyadh.gov.sa']),
    allowedMethods: Object.freeze([ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD]),
    allowedAutomatedMethods: Object.freeze([]),
    rightsMode: RIGHTS_MODE.WRITTEN_PERMISSION_REQUIRED,
    attributionRequired: true,
    browserAutomationAllowed: false,
  }),
  JEDDAH_MAP_PORTAL_UNVERIFIED: Object.freeze({
    profileId: 'JEDDAH_MAP_PORTAL_UNVERIFIED',
    sourceProvider: 'JEDDAH_MUNICIPALITY_GEOSPATIAL',
    allowedHosts: Object.freeze(['jeddah.gov.sa', 'www.jeddah.gov.sa', 'smartmap.jeddah.gov.sa', 'maps.jeddah.gov.sa']),
    allowedMethods: Object.freeze([ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD]),
    allowedAutomatedMethods: Object.freeze([]),
    rightsMode: RIGHTS_MODE.TERMS_UNVERIFIED,
    attributionRequired: true,
    browserAutomationAllowed: false,
  }),
  REGA_OPEN_DATA_DOWNLOADS: Object.freeze({
    profileId: 'REGA_OPEN_DATA_DOWNLOADS',
    sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
    allowedHosts: Object.freeze(['rega.gov.sa', 'www.rega.gov.sa', 'open.data.gov.sa']),
    allowedMethods: Object.freeze([
      ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,
      ACQUISITION_METHOD.OFFICIAL_REPORT_DOWNLOAD,
      ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD,
    ]),
    allowedAutomatedMethods: Object.freeze([]),
    rightsMode: RIGHTS_MODE.VERIFIED_RIGHTS_REQUIRED,
    attributionRequired: true,
    browserAutomationAllowed: false,
  }),
  REGA_INDICATOR_WEB_UI_RESTRICTED: Object.freeze({
    profileId: 'REGA_INDICATOR_WEB_UI_RESTRICTED',
    sourceProvider: 'REGA_REAL_ESTATE_INDICATORS',
    allowedHosts: Object.freeze(['rei.rega.gov.sa']),
    allowedMethods: Object.freeze([ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD]),
    allowedAutomatedMethods: Object.freeze([]),
    rightsMode: RIGHTS_MODE.WRITTEN_PERMISSION_REQUIRED,
    attributionRequired: true,
    browserAutomationAllowed: false,
  }),
  EARTH_COMMERCIAL_RESTRICTED: Object.freeze({
    profileId: 'EARTH_COMMERCIAL_RESTRICTED',
    sourceProvider: 'EARTHAPP_COMMERCIAL_INTELLIGENCE',
    allowedHosts: Object.freeze(['earthapp.com.sa', 'www.earthapp.com.sa', 'map.earthapp.com.sa']),
    allowedMethods: Object.freeze([
      ACQUISITION_METHOD.USER_AUTHORIZED_BROWSER_EXPORT,
      ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD,
    ]),
    allowedAutomatedMethods: Object.freeze([]),
    rightsMode: RIGHTS_MODE.VERIFIED_RIGHTS_REQUIRED,
    attributionRequired: true,
    browserAutomationAllowed: false,
  }),
  TATHMIN_AVM_RESTRICTED: Object.freeze({
    profileId: 'TATHMIN_AVM_RESTRICTED',
    sourceProvider: 'TATHMIN_INDICATIVE_AVM',
    allowedHosts: Object.freeze(['tathmin.online', 'www.tathmin.online']),
    allowedMethods: Object.freeze([
      ACQUISITION_METHOD.USER_AUTHORIZED_BROWSER_EXPORT,
      ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD,
    ]),
    allowedAutomatedMethods: Object.freeze([]),
    rightsMode: RIGHTS_MODE.TERMS_UNVERIFIED,
    attributionRequired: true,
    browserAutomationAllowed: false,
  }),
});

const HASH_RE = /^[a-f0-9]{64}$/i;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const clean = (v) => nonEmpty(v) ? v.trim() : '';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function sha256(value) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
  } catch (_) {
    return null;
  }
}

function without(value, fields) {
  const out = { ...value };
  for (const field of fields) delete out[field];
  return out;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function parseIso(value) {
  if (!nonEmpty(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function urlHost(value) {
  if (!nonEmpty(value)) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:') return null;
    return parsed.hostname.toLowerCase();
  } catch (_) {
    return null;
  }
}

function getAcquisitionProfile(profileId) {
  return SOURCE_ACQUISITION_PROFILES[profileId] || null;
}

function buildGovernedNonApiAcquisitionPlan({ profileId, sourceUrl, preferredMethod } = {}) {
  const profile = getAcquisitionProfile(profileId);
  if (!profile) return freeze({ status: NON_API_ACQUISITION_STATUS.HOLD_POLICY, blockers: ['C2N_PROFILE_NOT_GOVERNED'] });
  const host = urlHost(sourceUrl);
  const blockers = [];
  if (!host || !profile.allowedHosts.includes(host)) blockers.push('C2N_SOURCE_URL_NOT_ALLOWED_BY_PROFILE');
  if (!Object.values(ACQUISITION_METHOD).includes(preferredMethod)) blockers.push('C2N_ACQUISITION_METHOD_UNSUPPORTED');
  else if (!profile.allowedMethods.includes(preferredMethod)) blockers.push('C2N_ACQUISITION_METHOD_NOT_ALLOWED_BY_PROFILE');
  const automated = profile.allowedAutomatedMethods.includes(preferredMethod);
  return freeze({
    capability: CAPABILITY,
    profileId,
    sourceProvider: profile.sourceProvider,
    sourceUrl: nonEmpty(sourceUrl) ? sourceUrl.trim() : null,
    preferredMethod: Object.values(ACQUISITION_METHOD).includes(preferredMethod) ? preferredMethod : null,
    automatedRetrievalEligible: blockers.length === 0 && automated,
    browserAutomationAllowed: profile.browserAutomationAllowed,
    rightsMode: profile.rightsMode,
    requiresRightsVerification: profile.rightsMode !== RIGHTS_MODE.PUBLISHED_OPEN_DATA_REUSE,
    attributionRequired: profile.attributionRequired,
    noApi: true,
    hiddenEndpointDiscoveryAllowed: false,
    credentialBypassAllowed: false,
    captchaBypassAllowed: false,
    accessControlEvasionAllowed: false,
    rateLimitEvasionAllowed: false,
    blockers: freeze([...new Set(blockers)].sort()),
  });
}

function computeNonApiAcquisitionRecordHash(record) {
  return record && typeof record === 'object' && !Array.isArray(record)
    ? sha256(without(record, ['acquisitionRecordHashSha256']))
    : null;
}

function verifyNonApiAcquisitionRecordIntegrity(record) {
  return !!record
    && HASH_RE.test(clean(record.acquisitionRecordHashSha256))
    && computeNonApiAcquisitionRecordHash(record) === clean(record.acquisitionRecordHashSha256).toLowerCase();
}

function createGovernedNonApiAcquisitionRecord(x = {}) {
  const required = [
    'acquisitionId', 'profileId', 'sourceProvider', 'sourceUrl', 'artifactMimeType', 'artifactFormat',
    'extractorVersion', 'termsEvidenceRef',
  ];
  required.forEach((field) => {
    if (!nonEmpty(x[field])) throw new TypeError(`${field} must be a non-empty string`);
  });
  if (!Object.values(ACQUISITION_METHOD).includes(x.acquisitionMethod)) throw new TypeError('C2N_ACQUISITION_METHOD_UNSUPPORTED');
  if (!Object.values(EXTRACTION_METHOD).includes(x.extractionMethod)) throw new TypeError('C2N_EXTRACTION_METHOD_UNSUPPORTED');
  if (!HASH_RE.test(clean(x.artifactHashSha256))) throw new TypeError('C2N_ARTIFACT_HASH_REQUIRED');
  if (x.extractedPayload === undefined) throw new TypeError('C2N_EXTRACTED_PAYLOAD_REQUIRED');
  const extractedPayloadHashSha256 = sha256(x.extractedPayload);
  if (!extractedPayloadHashSha256) throw new TypeError('C2N_EXTRACTED_PAYLOAD_JSON_REQUIRED');
  if (x.extractedPayloadHashSha256 != null && clean(x.extractedPayloadHashSha256).toLowerCase() !== extractedPayloadHashSha256) {
    throw new TypeError('C2N_EXTRACTED_PAYLOAD_HASH_MISMATCH');
  }
  const retrievedAt = parseIso(x.retrievedAt);
  if (!retrievedAt) throw new TypeError('C2N_RETRIEVED_AT_REQUIRED');
  const sourceEffectiveAt = x.sourceEffectiveAt == null ? null : parseIso(x.sourceEffectiveAt);
  if (x.sourceEffectiveAt != null && !sourceEffectiveAt) throw new TypeError('C2N_SOURCE_EFFECTIVE_AT_INVALID');
  const rightsVerifiedAt = x.rightsVerifiedAt == null ? null : parseIso(x.rightsVerifiedAt);
  if (x.rightsVerifiedAt != null && !rightsVerifiedAt) throw new TypeError('C2N_RIGHTS_VERIFIED_AT_INVALID');

  const core = {
    schemaVersion: 1,
    acquisitionId: x.acquisitionId.trim(),
    profileId: x.profileId.trim(),
    sourceProvider: x.sourceProvider.trim(),
    sourceUrl: x.sourceUrl.trim(),
    acquisitionMethod: x.acquisitionMethod,
    automatedRetrieval: x.automatedRetrieval === true,
    retrievedAt,
    sourceEffectiveAt,
    artifactMimeType: x.artifactMimeType.trim(),
    artifactFormat: x.artifactFormat.trim(),
    artifactHashSha256: x.artifactHashSha256.trim().toLowerCase(),
    extractionMethod: x.extractionMethod,
    extractorVersion: x.extractorVersion.trim(),
    extractedPayload: x.extractedPayload,
    extractedPayloadHashSha256,
    termsEvidenceRef: x.termsEvidenceRef.trim(),
    licenseReference: nonEmpty(x.licenseReference) ? x.licenseReference.trim() : null,
    attributionText: nonEmpty(x.attributionText) ? x.attributionText.trim() : null,
    rightsVerified: x.rightsVerified === true,
    rightsVerifiedByRef: nonEmpty(x.rightsVerifiedByRef) ? x.rightsVerifiedByRef.trim() : null,
    rightsVerifiedAt,
    rightsEvidenceRef: nonEmpty(x.rightsEvidenceRef) ? x.rightsEvidenceRef.trim() : null,
    browserSessionAuthorizationRef: nonEmpty(x.browserSessionAuthorizationRef) ? x.browserSessionAuthorizationRef.trim() : null,
    provenanceVerificationRef: nonEmpty(x.provenanceVerificationRef) ? x.provenanceVerificationRef.trim() : null,
    hiddenEndpointDiscoveryUsed: x.hiddenEndpointDiscoveryUsed === true,
    credentialBypassUsed: x.credentialBypassUsed === true,
    captchaBypassUsed: x.captchaBypassUsed === true,
    accessControlEvasionUsed: x.accessControlEvasionUsed === true,
    rateLimitEvasionUsed: x.rateLimitEvasionUsed === true,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLiveAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
  };
  return freeze({ ...core, acquisitionRecordHashSha256: sha256(core) });
}

function baseResult(status, blockers, record, profile) {
  const provider = profile ? getCanonicalSourceProvider(profile.sourceProvider) : null;
  const ready = status === NON_API_ACQUISITION_STATUS.READY_FOR_C2S_PROVENANCE_EVALUATION;
  const sourceTier = provider ? provider.sourceTier : null;
  return freeze({
    capability: CAPABILITY,
    status,
    blockers: freeze([...new Set(blockers)].sort()),
    acquisitionId: record?.acquisitionId || null,
    profileId: record?.profileId || null,
    sourceProvider: record?.sourceProvider || null,
    sourceTier,
    acquisitionMethod: record?.acquisitionMethod || null,
    artifactHashSha256: record?.artifactHashSha256 || null,
    extractedPayloadHashSha256: record?.extractedPayloadHashSha256 || null,
    readyForC2SProvenanceEvaluation: ready,
    authoritativeEvidenceEstablished: false,
    corroborationOnly: sourceTier === SOURCE_TIER.B_COMMERCIAL_CORROBORATION,
    avmBenchmarkOnly: sourceTier === SOURCE_TIER.C_INDICATIVE_AVM,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    commercialGoLiveAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
  });
}

function evaluateGovernedNonApiAcquisition(record, { asOf, trustedRightsVerifierIds = [] } = {}) {
  const blockers = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return baseResult(NON_API_ACQUISITION_STATUS.HOLD_INTEGRITY, ['C2N_RECORD_OBJECT_REQUIRED'], record, null);
  }
  const profile = getAcquisitionProfile(record.profileId);
  if (!profile) return baseResult(NON_API_ACQUISITION_STATUS.HOLD_POLICY, ['C2N_PROFILE_NOT_GOVERNED'], record, null);
  const provider = getCanonicalSourceProvider(profile.sourceProvider);
  if (!provider) return baseResult(NON_API_ACQUISITION_STATUS.HOLD_SOURCE, ['C2N_PROVIDER_NOT_GOVERNED'], record, profile);

  if (!verifyNonApiAcquisitionRecordIntegrity(record)) blockers.push('C2N_ACQUISITION_RECORD_INTEGRITY_FAILED');
  if (record.sourceProvider !== profile.sourceProvider) blockers.push('C2N_PROVIDER_PROFILE_MISMATCH');
  const host = urlHost(record.sourceUrl);
  if (!host || !profile.allowedHosts.includes(host)) blockers.push('C2N_SOURCE_URL_NOT_ALLOWED_BY_PROFILE');
  if (!profile.allowedMethods.includes(record.acquisitionMethod)) blockers.push('C2N_ACQUISITION_METHOD_NOT_ALLOWED_BY_PROFILE');
  if (record.automatedRetrieval && !profile.allowedAutomatedMethods.includes(record.acquisitionMethod)) {
    blockers.push('C2N_AUTOMATED_RETRIEVAL_NOT_ALLOWED');
  }
  if (record.acquisitionMethod === ACQUISITION_METHOD.PUBLIC_BROWSER_RENDERED_CAPTURE && !profile.browserAutomationAllowed) {
    blockers.push('C2N_BROWSER_AUTOMATION_NOT_ALLOWED');
  }
  if (record.acquisitionMethod === ACQUISITION_METHOD.USER_AUTHORIZED_BROWSER_EXPORT && !record.browserSessionAuthorizationRef) {
    blockers.push('C2N_BROWSER_SESSION_AUTHORIZATION_REQUIRED');
  }
  if (record.hiddenEndpointDiscoveryUsed) blockers.push('C2N_HIDDEN_ENDPOINT_DISCOVERY_FORBIDDEN');
  if (record.credentialBypassUsed) blockers.push('C2N_CREDENTIAL_BYPASS_FORBIDDEN');
  if (record.captchaBypassUsed) blockers.push('C2N_CAPTCHA_BYPASS_FORBIDDEN');
  if (record.accessControlEvasionUsed) blockers.push('C2N_ACCESS_CONTROL_EVASION_FORBIDDEN');
  if (record.rateLimitEvasionUsed) blockers.push('C2N_RATE_LIMIT_EVASION_FORBIDDEN');

  if (!HASH_RE.test(clean(record.artifactHashSha256))) blockers.push('C2N_ARTIFACT_HASH_INVALID');
  const extractedHash = sha256(record.extractedPayload);
  if (!extractedHash || extractedHash !== clean(record.extractedPayloadHashSha256).toLowerCase()) blockers.push('C2N_EXTRACTED_PAYLOAD_HASH_INVALID');
  if (!nonEmpty(record.termsEvidenceRef)) blockers.push('C2N_TERMS_EVIDENCE_REQUIRED');
  if (profile.attributionRequired && !nonEmpty(record.attributionText)) blockers.push('C2N_ATTRIBUTION_REQUIRED');

  const asOfIso = parseIso(asOf);
  const retrievedAtIso = parseIso(record.retrievedAt);
  if (!asOfIso) blockers.push('C2N_AS_OF_REQUIRED');
  if (!retrievedAtIso) blockers.push('C2N_RETRIEVED_AT_INVALID');
  if (asOfIso && retrievedAtIso && Date.parse(retrievedAtIso) > Date.parse(asOfIso)) blockers.push('C2N_RETRIEVED_AT_FUTURE');
  if (record.sourceEffectiveAt && retrievedAtIso && Date.parse(record.sourceEffectiveAt) > Date.parse(retrievedAtIso)) {
    blockers.push('C2N_SOURCE_EFFECTIVE_AFTER_RETRIEVAL');
  }

  if (profile.rightsMode === RIGHTS_MODE.PUBLISHED_OPEN_DATA_REUSE) {
    if (!nonEmpty(record.licenseReference)) blockers.push('C2N_OPEN_DATA_LICENSE_REFERENCE_REQUIRED');
  } else {
    if (!record.rightsVerified) blockers.push('C2N_RIGHTS_VERIFICATION_REQUIRED');
    if (!nonEmpty(record.rightsVerifiedByRef)) blockers.push('C2N_RIGHTS_VERIFIER_REQUIRED');
    else if (!trustedRightsVerifierIds.includes(record.rightsVerifiedByRef)) blockers.push('C2N_RIGHTS_VERIFIER_UNTRUSTED');
    if (!record.rightsVerifiedAt) blockers.push('C2N_RIGHTS_VERIFIED_AT_REQUIRED');
    else if (asOfIso && Date.parse(record.rightsVerifiedAt) > Date.parse(asOfIso)) blockers.push('C2N_RIGHTS_VERIFIED_AT_FUTURE');
    if (!nonEmpty(record.rightsEvidenceRef)) blockers.push('C2N_RIGHTS_EVIDENCE_REQUIRED');
  }

  if (profile.rightsMode === RIGHTS_MODE.WRITTEN_PERMISSION_REQUIRED && !record.rightsVerified) blockers.push('C2N_WRITTEN_PERMISSION_NOT_VERIFIED');
  if (profile.rightsMode === RIGHTS_MODE.TERMS_UNVERIFIED && record.automatedRetrieval) blockers.push('C2N_TERMS_UNVERIFIED_AUTOMATION_BLOCKED');

  const integrityCodes = blockers.filter((b) => b.includes('INTEGRITY') || b.includes('HASH'));
  if (integrityCodes.length) return baseResult(NON_API_ACQUISITION_STATUS.HOLD_INTEGRITY, blockers, record, profile);
  const temporalCodes = blockers.filter((b) => b.includes('FUTURE') || b.includes('AFTER_RETRIEVAL') || b === 'C2N_AS_OF_REQUIRED');
  if (temporalCodes.length) return baseResult(NON_API_ACQUISITION_STATUS.HOLD_TEMPORAL, blockers, record, profile);
  const rightsCodes = blockers.filter((b) => b.includes('RIGHTS') || b.includes('LICENSE') || b.includes('ATTRIBUTION') || b.includes('TERMS') || b.includes('WRITTEN_PERMISSION'));
  if (rightsCodes.length) return baseResult(NON_API_ACQUISITION_STATUS.HOLD_RIGHTS, blockers, record, profile);
  const sourceCodes = blockers.filter((b) => b.includes('SOURCE_URL') || b.includes('PROVIDER'));
  if (sourceCodes.length) return baseResult(NON_API_ACQUISITION_STATUS.HOLD_SOURCE, blockers, record, profile);
  if (blockers.length) return baseResult(NON_API_ACQUISITION_STATUS.HOLD_POLICY, blockers, record, profile);
  return baseResult(NON_API_ACQUISITION_STATUS.READY_FOR_C2S_PROVENANCE_EVALUATION, [], record, profile);
}

module.exports = {
  CAPABILITY,
  ACQUISITION_METHOD,
  EXTRACTION_METHOD,
  RIGHTS_MODE,
  NON_API_ACQUISITION_STATUS,
  SOURCE_ACQUISITION_PROFILES,
  getAcquisitionProfile,
  buildGovernedNonApiAcquisitionPlan,
  createGovernedNonApiAcquisitionRecord,
  computeNonApiAcquisitionRecordHash,
  verifyNonApiAcquisitionRecordIntegrity,
  evaluateGovernedNonApiAcquisition,
};

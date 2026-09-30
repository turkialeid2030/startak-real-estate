'use strict';

const crypto = require('crypto');
const {
  C2S_SOURCE_INTELLIGENCE_SCHEMA_VERSION,
  SOURCE_TIER,
  SOURCE_PROVIDER_KIND,
  SOURCE_LICENSING_STATUS,
  SOURCE_USAGE_ROLE,
  SOURCE_PROVENANCE_GATE_STATUS,
  PROFESSIONAL_LICENSE_AUTHORITY,
} = require('../contracts/source-intelligence');
const {
  SOURCE_PROVIDER_REGISTRY_VERSION,
  getCanonicalSourceProvider,
  sourceUrlMatchesProvider,
} = require('./source-provider-registry');

const C2S_SOURCE_PROVENANCE_GOVERNANCE_VERSION = 'C2S_SOURCE_PROVENANCE_GOVERNANCE_V1';
const HASH_RE = /^[a-f0-9]{64}$/i;
const KNOWN_TIERS = Object.freeze(Object.values(SOURCE_TIER));
const KNOWN_LICENSING_STATUSES = Object.freeze(Object.values(SOURCE_LICENSING_STATUS));

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
    }, Object.create(null));
  }
  return value;
}

function hashValue(value) {
  if (!isJsonSafe(value)) return null;
  try {
    return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
  } catch (_) {
    return null;
  }
}

function normalizeHashes(value, fieldName, blockers) {
  if (!Array.isArray(value)) {
    blockers.push(`${fieldName}_ARRAY_REQUIRED`);
    return [];
  }
  const out = [];
  for (const item of value) {
    const hash = cleanString(item).toLowerCase();
    if (!HASH_RE.test(hash)) blockers.push(`${fieldName}_HASH_INVALID`);
    else out.push(hash);
  }
  return [...new Set(out)];
}

function normalizeTrustedIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanString).filter(Boolean))];
}

function normalizeProfessionalProvider(providerId, registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return null;
  const entry = registry[providerId];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const officialDomains = Array.isArray(entry.officialDomains)
    ? [...new Set(entry.officialDomains.map((value) => cleanString(value).toLowerCase()).filter(Boolean))]
    : [];
  return Object.freeze({
    id: cleanString(entry.id) || providerId,
    organization: cleanString(entry.organization),
    sourceTier: cleanString(entry.sourceTier),
    providerKind: cleanString(entry.providerKind),
    officialDomains: Object.freeze(officialDomains),
    licenseAuthority: cleanString(entry.licenseAuthority),
    productionAdapterEnabled: entry.productionAdapterEnabled === true,
  });
}

function resolveProvider(sourceProvider, governedProfessionalProviders) {
  const canonical = getCanonicalSourceProvider(sourceProvider);
  if (canonical) return canonical;
  return normalizeProfessionalProvider(sourceProvider, governedProfessionalProviders);
}

function normalizeVerifiedOfficialEvidenceRecords(value) {
  if (!Array.isArray(value)) return [];
  return value.map((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    const evidenceHashSha256 = cleanString(record.evidenceHashSha256).toLowerCase();
    if (!HASH_RE.test(evidenceHashSha256)) return null;
    return Object.freeze({
      evidenceHashSha256,
      sourceProvider: cleanString(record.sourceProvider) || null,
      underlyingAuthority: cleanString(record.underlyingAuthority) || null,
    });
  }).filter(Boolean);
}

function evaluateOfficialCorroboration(corroboratedBy, claimedUnderlyingAuthority, verifiedOfficialEvidenceRecords) {
  const claimedAuthority = cleanString(claimedUnderlyingAuthority);
  const corroborationHashes = new Set(Array.isArray(corroboratedBy) ? corroboratedBy : []);
  const officialRecords = normalizeVerifiedOfficialEvidenceRecords(verifiedOfficialEvidenceRecords);
  const hashMatchedRecords = officialRecords.filter((record) => corroborationHashes.has(record.evidenceHashSha256));
  const authorityMatchedRecords = hashMatchedRecords.filter((record) => (
    record.sourceProvider === claimedAuthority || record.underlyingAuthority === claimedAuthority
  ));
  return Object.freeze({
    anyVerifiedOfficialHashMatched: hashMatchedRecords.length > 0,
    claimedAuthorityMatched: authorityMatchedRecords.length > 0,
    matchedOfficialEvidenceHashes: Object.freeze(authorityMatchedRecords.map((record) => record.evidenceHashSha256)),
  });
}

function evaluateLicenseVerification(record, provider, context) {
  const blockers = [];
  const verification = record.licenseVerification;
  if (!verification || typeof verification !== 'object' || Array.isArray(verification)) {
    return { blockers: ['C2S_PROFESSIONAL_LICENSE_VERIFICATION_REQUIRED'], normalized: null };
  }
  const licenseAuthority = cleanString(verification.licenseAuthority);
  const licenseId = cleanString(verification.licenseId);
  const licensedEntity = cleanString(verification.licensedEntity);
  const verifiedBy = cleanString(verification.verifiedBy);
  const verificationReference = cleanString(verification.verificationReference);
  const verifiedAtMs = toTimestamp(verification.verifiedAt);
  const validUntilMs = toTimestamp(verification.validUntil);

  if (licenseAuthority !== PROFESSIONAL_LICENSE_AUTHORITY.TAQEEM_LICENSE_FRAMEWORK) {
    blockers.push(`C2S_PROFESSIONAL_LICENSE_AUTHORITY_INVALID:${licenseAuthority || 'MISSING'}`);
  }
  if (provider && cleanString(provider.licenseAuthority) !== PROFESSIONAL_LICENSE_AUTHORITY.TAQEEM_LICENSE_FRAMEWORK) {
    blockers.push('C2S_PROFESSIONAL_PROVIDER_LICENSE_AUTHORITY_NOT_GOVERNED');
  }
  if (!licenseId) blockers.push('C2S_PROFESSIONAL_LICENSE_ID_REQUIRED');
  if (!licensedEntity) blockers.push('C2S_PROFESSIONAL_LICENSED_ENTITY_REQUIRED');
  if (provider && provider.organization && licensedEntity !== provider.organization) blockers.push('C2S_PROFESSIONAL_LICENSED_ENTITY_MISMATCH');
  if (!verifiedBy) blockers.push('C2S_PROFESSIONAL_LICENSE_VERIFIER_REQUIRED');
  else if (!context.trustedLicenseVerifierIds.includes(verifiedBy)) blockers.push(`C2S_PROFESSIONAL_LICENSE_VERIFIER_UNTRUSTED:${verifiedBy}`);
  if (!verificationReference) blockers.push('C2S_PROFESSIONAL_LICENSE_VERIFICATION_REFERENCE_REQUIRED');
  if (verifiedAtMs === null) blockers.push('C2S_PROFESSIONAL_LICENSE_VERIFIED_AT_REQUIRED');
  else if (context.asOfMs !== null && verifiedAtMs > context.asOfMs) blockers.push('C2S_PROFESSIONAL_LICENSE_VERIFICATION_FUTURE');
  if (validUntilMs === null) blockers.push('C2S_PROFESSIONAL_LICENSE_VALID_UNTIL_REQUIRED');
  else if (context.asOfMs !== null && validUntilMs < context.asOfMs) blockers.push('C2S_PROFESSIONAL_LICENSE_EXPIRED');

  return {
    blockers,
    normalized: Object.freeze({
      licenseAuthority: licenseAuthority || null,
      licenseId: licenseId || null,
      licensedEntity: licensedEntity || null,
      verifiedBy: verifiedBy || null,
      verificationReference: verificationReference || null,
      verifiedAt: verifiedAtMs === null ? null : new Date(verifiedAtMs).toISOString(),
      validUntil: validUntilMs === null ? null : new Date(validUntilMs).toISOString(),
    }),
  };
}

function evaluateSourceProvenanceRecord(record, {
  asOfMs,
  governedProfessionalProviders = {},
  trustedProvenanceVerifierIds = [],
  trustedLicenseVerifierIds = [],
  verifiedOfficialEvidenceRecords = [],
} = {}) {
  const blockers = [];
  const warnings = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { blockers: ['C2S_SOURCE_RECORD_OBJECT_REQUIRED'], warnings, normalized: null };
  }

  const evaluationAsOfMs = Number.isFinite(asOfMs) ? asOfMs : null;
  const trustedProvenanceVerifiers = normalizeTrustedIds(trustedProvenanceVerifierIds);
  const trustedLicenseVerifiers = normalizeTrustedIds(trustedLicenseVerifierIds);
  if (evaluationAsOfMs === null) blockers.push('C2S_AS_OF_REQUIRED');

  const id = cleanString(record.id);
  const sourceProvider = cleanString(record.sourceProvider);
  const sourceTier = cleanString(record.sourceTier);
  const licensingStatus = cleanString(record.licensingStatus);
  const sourceUrl = cleanString(record.sourceUrl);
  const originalSourceReference = cleanString(record.originalSourceReference);
  const methodologyVersion = cleanString(record.methodologyVersion);
  const retrievedAtMs = toTimestamp(record.retrievedAt);
  const effectiveAtMs = toTimestamp(record.effectiveAt);
  const validUntilMs = toTimestamp(record.validUntil);
  const evidenceHashSha256 = cleanString(record.evidenceHashSha256).toLowerCase();
  const hasUnderlyingAuthority = Object.prototype.hasOwnProperty.call(record, 'underlyingAuthority');
  const underlyingAuthority = record.underlyingAuthority === null ? null : cleanString(record.underlyingAuthority);
  const hasProvenanceVerified = Object.prototype.hasOwnProperty.call(record, 'provenanceVerified');
  const provenanceVerified = record.provenanceVerified === true;
  const provenanceVerifiedBy = cleanString(record.provenanceVerifiedBy);
  const provenanceVerificationReference = cleanString(record.provenanceVerificationReference);
  const provenanceVerifiedAtMs = toTimestamp(record.provenanceVerifiedAt);
  const corroboratedBy = normalizeHashes(record.corroboratedBy, 'C2S_CORROBORATED_BY', blockers);
  const provider = resolveProvider(sourceProvider, governedProfessionalProviders);
  const evidencePayloadHash = Object.prototype.hasOwnProperty.call(record, 'evidencePayload')
    ? hashValue(record.evidencePayload)
    : null;

  if (!id) blockers.push('C2S_SOURCE_RECORD_ID_REQUIRED');
  if (!sourceProvider) blockers.push('C2S_SOURCE_PROVIDER_REQUIRED');
  if (!provider) blockers.push(`C2S_SOURCE_PROVIDER_NOT_GOVERNED:${sourceProvider || 'MISSING'}`);
  if (!KNOWN_TIERS.includes(sourceTier)) blockers.push(`C2S_SOURCE_TIER_UNSUPPORTED:${sourceTier || 'MISSING'}`);
  if (provider && sourceTier !== provider.sourceTier) blockers.push(`C2S_SOURCE_TIER_PROVIDER_MISMATCH:${sourceProvider}`);
  if (!KNOWN_LICENSING_STATUSES.includes(licensingStatus)) blockers.push(`C2S_LICENSING_STATUS_UNSUPPORTED:${licensingStatus || 'MISSING'}`);
  if (!sourceUrl) blockers.push('C2S_SOURCE_URL_REQUIRED');
  else if (provider && !sourceUrlMatchesProvider(provider, sourceUrl)) blockers.push(`C2S_SOURCE_URL_PROVIDER_MISMATCH:${sourceProvider}`);
  if (!originalSourceReference) blockers.push('C2S_ORIGINAL_SOURCE_REFERENCE_REQUIRED');
  if (!methodologyVersion) blockers.push('C2S_METHODOLOGY_VERSION_REQUIRED');
  if (!hasUnderlyingAuthority) blockers.push('C2S_UNDERLYING_AUTHORITY_FIELD_REQUIRED');
  if (!hasProvenanceVerified || typeof record.provenanceVerified !== 'boolean') blockers.push('C2S_PROVENANCE_VERIFIED_BOOLEAN_REQUIRED');

  if (provenanceVerified) {
    if (!provenanceVerifiedBy) blockers.push(`C2S_PROVENANCE_VERIFIER_REQUIRED:${id || 'UNKNOWN'}`);
    else if (!trustedProvenanceVerifiers.includes(provenanceVerifiedBy)) blockers.push(`C2S_PROVENANCE_VERIFIER_UNTRUSTED:${id || 'UNKNOWN'}:${provenanceVerifiedBy}`);
    if (!provenanceVerificationReference) blockers.push(`C2S_PROVENANCE_VERIFICATION_REFERENCE_REQUIRED:${id || 'UNKNOWN'}`);
    if (provenanceVerifiedAtMs === null) blockers.push(`C2S_PROVENANCE_VERIFIED_AT_REQUIRED:${id || 'UNKNOWN'}`);
    else if (evaluationAsOfMs !== null && provenanceVerifiedAtMs > evaluationAsOfMs) blockers.push(`C2S_PROVENANCE_VERIFIED_AT_FUTURE:${id || 'UNKNOWN'}`);
  }

  if (retrievedAtMs === null) blockers.push('C2S_RETRIEVED_AT_REQUIRED');
  else if (evaluationAsOfMs !== null && retrievedAtMs > evaluationAsOfMs) blockers.push('C2S_RETRIEVED_AT_FUTURE');
  if (effectiveAtMs === null) blockers.push('C2S_EFFECTIVE_AT_REQUIRED');
  else if (evaluationAsOfMs !== null && effectiveAtMs > evaluationAsOfMs) blockers.push('C2S_EFFECTIVE_AT_FUTURE');
  if (retrievedAtMs !== null && effectiveAtMs !== null && effectiveAtMs > retrievedAtMs) blockers.push('C2S_EFFECTIVE_AFTER_RETRIEVAL');
  if (validUntilMs === null) blockers.push('C2S_VALID_UNTIL_REQUIRED');
  else {
    if (retrievedAtMs !== null && validUntilMs < retrievedAtMs) blockers.push('C2S_INVALID_VALIDITY_WINDOW');
    if (evaluationAsOfMs !== null && validUntilMs < evaluationAsOfMs) blockers.push('C2S_SOURCE_EVIDENCE_STALE');
  }

  if (!Object.prototype.hasOwnProperty.call(record, 'evidencePayload')) blockers.push('C2S_EVIDENCE_PAYLOAD_REQUIRED');
  else if (!evidencePayloadHash) blockers.push('C2S_EVIDENCE_PAYLOAD_JSON_REQUIRED');
  if (!HASH_RE.test(evidenceHashSha256)) blockers.push('C2S_EVIDENCE_HASH_REQUIRED');
  else if (evidencePayloadHash && evidenceHashSha256 !== evidencePayloadHash) blockers.push('C2S_EVIDENCE_HASH_MISMATCH');

  for (const authorityFlag of ['finalValuationConclusionEstablished', 'certifiedValuationEstablished', 'transactionAuthorized', 'publicAiAuthorized']) {
    if (record[authorityFlag] === true) blockers.push(`C2S_AUTHORITY_INJECTION_ATTEMPT:${authorityFlag}`);
  }

  let usageRole = null;
  let authoritativeEvidenceEligible = false;
  let professionalValuationOpinionEligible = false;
  let officialUnderlyingProvenanceCorroborated = false;
  let matchedOfficialEvidenceHashes = [];
  let licenseVerification = null;

  if (sourceTier === SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE) {
    if (licensingStatus !== SOURCE_LICENSING_STATUS.NOT_APPLICABLE_OFFICIAL) blockers.push('C2S_OFFICIAL_LICENSING_STATUS_INVALID');
    if (!provenanceVerified) blockers.push('C2S_OFFICIAL_PROVENANCE_VERIFICATION_REQUIRED');
    if (!underlyingAuthority) blockers.push('C2S_OFFICIAL_UNDERLYING_AUTHORITY_REQUIRED');
    else if (!provider || !Array.isArray(provider.allowedUnderlyingAuthorities)
      || !provider.allowedUnderlyingAuthorities.includes(underlyingAuthority)) {
      blockers.push(`C2S_OFFICIAL_UNDERLYING_AUTHORITY_NOT_GOVERNED:${underlyingAuthority || 'MISSING'}`);
    }
    usageRole = SOURCE_USAGE_ROLE.AUTHORITATIVE_EVIDENCE;
  } else if (sourceTier === SOURCE_TIER.B_COMMERCIAL_CORROBORATION) {
    if (![SOURCE_LICENSING_STATUS.TERMS_OR_LICENSE_NOT_VERIFIED, SOURCE_LICENSING_STATUS.COMMERCIAL_ACCESS_VERIFIED].includes(licensingStatus)) {
      blockers.push('C2S_COMMERCIAL_LICENSING_STATUS_INVALID');
    }
    usageRole = SOURCE_USAGE_ROLE.CORROBORATION_ONLY;
    if (provenanceVerified) {
      const underlying = getCanonicalSourceProvider(underlyingAuthority);
      if (!underlying || underlying.sourceTier !== SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE) {
        blockers.push(`C2S_COMMERCIAL_UNDERLYING_AUTHORITY_INVALID:${underlyingAuthority || 'MISSING'}`);
      }
      const corroboration = evaluateOfficialCorroboration(corroboratedBy, underlyingAuthority, verifiedOfficialEvidenceRecords);
      officialUnderlyingProvenanceCorroborated = corroboration.claimedAuthorityMatched;
      matchedOfficialEvidenceHashes = corroboration.matchedOfficialEvidenceHashes;
      if (!officialUnderlyingProvenanceCorroborated) {
        blockers.push(corroboration.anyVerifiedOfficialHashMatched
          ? 'C2S_COMMERCIAL_OFFICIAL_PROVENANCE_AUTHORITY_MISMATCH'
          : 'C2S_COMMERCIAL_OFFICIAL_PROVENANCE_UNCORROBORATED');
      }
    } else if (underlyingAuthority) {
      warnings.push('C2S_COMMERCIAL_UNVERIFIED_UNDERLYING_AUTHORITY_CLAIM_IGNORED');
    }
  } else if (sourceTier === SOURCE_TIER.C_INDICATIVE_AVM) {
    if (![SOURCE_LICENSING_STATUS.TERMS_OR_LICENSE_NOT_VERIFIED, SOURCE_LICENSING_STATUS.AVM_USE_RIGHTS_VERIFIED].includes(licensingStatus)) {
      blockers.push('C2S_AVM_LICENSING_STATUS_INVALID');
    }
    usageRole = SOURCE_USAGE_ROLE.AVM_BENCHMARK_ONLY;
    if (provenanceVerified) {
      const underlying = getCanonicalSourceProvider(underlyingAuthority);
      if (!underlying || underlying.sourceTier !== SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE) {
        blockers.push(`C2S_AVM_UNDERLYING_AUTHORITY_INVALID:${underlyingAuthority || 'MISSING'}`);
      }
      const corroboration = evaluateOfficialCorroboration(corroboratedBy, underlyingAuthority, verifiedOfficialEvidenceRecords);
      officialUnderlyingProvenanceCorroborated = corroboration.claimedAuthorityMatched;
      matchedOfficialEvidenceHashes = corroboration.matchedOfficialEvidenceHashes;
      if (!officialUnderlyingProvenanceCorroborated) {
        blockers.push(corroboration.anyVerifiedOfficialHashMatched
          ? 'C2S_AVM_OFFICIAL_PROVENANCE_AUTHORITY_MISMATCH'
          : 'C2S_AVM_OFFICIAL_PROVENANCE_UNCORROBORATED');
      }
    }
  } else if (sourceTier === SOURCE_TIER.D_LICENSED_PROFESSIONAL) {
    if (!provider || provider.providerKind !== SOURCE_PROVIDER_KIND.LICENSED_PROFESSIONAL_FIRM) blockers.push('C2S_PROFESSIONAL_PROVIDER_REGISTRY_REQUIRED');
    if (licensingStatus !== SOURCE_LICENSING_STATUS.PROFESSIONAL_LICENSE_VERIFIED) blockers.push('C2S_PROFESSIONAL_LICENSE_STATUS_INVALID');
    if (!provenanceVerified) blockers.push('C2S_PROFESSIONAL_PROVENANCE_VERIFICATION_REQUIRED');
    if (underlyingAuthority !== PROFESSIONAL_LICENSE_AUTHORITY.TAQEEM_LICENSE_FRAMEWORK) blockers.push('C2S_PROFESSIONAL_UNDERLYING_AUTHORITY_INVALID');
    const license = evaluateLicenseVerification(record, provider, {
      asOfMs: evaluationAsOfMs,
      trustedLicenseVerifierIds: trustedLicenseVerifiers,
    });
    blockers.push(...license.blockers);
    licenseVerification = license.normalized;
    usageRole = SOURCE_USAGE_ROLE.PROFESSIONAL_VALUATION_OPINION;
  }

  const eligible = blockers.length === 0;
  if (eligible && usageRole === SOURCE_USAGE_ROLE.AUTHORITATIVE_EVIDENCE) authoritativeEvidenceEligible = true;
  if (eligible && usageRole === SOURCE_USAGE_ROLE.PROFESSIONAL_VALUATION_OPINION) professionalValuationOpinionEligible = true;

  const core = {
    id: id || null,
    sourceProvider: sourceProvider || null,
    underlyingAuthority: underlyingAuthority || null,
    provenanceVerified,
    provenanceVerifiedBy: provenanceVerifiedBy || null,
    provenanceVerificationReference: provenanceVerificationReference || null,
    provenanceVerifiedAt: provenanceVerifiedAtMs === null ? null : new Date(provenanceVerifiedAtMs).toISOString(),
    sourceTier: sourceTier || null,
    licensingStatus: licensingStatus || null,
    sourceUrl: sourceUrl || null,
    retrievedAt: retrievedAtMs === null ? null : new Date(retrievedAtMs).toISOString(),
    effectiveAt: effectiveAtMs === null ? null : new Date(effectiveAtMs).toISOString(),
    validUntil: validUntilMs === null ? null : new Date(validUntilMs).toISOString(),
    originalSourceReference: originalSourceReference || null,
    methodologyVersion: methodologyVersion || null,
    corroboratedBy,
    matchedOfficialEvidenceHashes,
    evidenceHashSha256: HASH_RE.test(evidenceHashSha256) ? evidenceHashSha256 : null,
    licenseVerification,
  };
  const sourceRecordHashSha256 = hashValue(core);

  return {
    blockers,
    warnings,
    normalized: Object.freeze({
      ...core,
      sourceRecordHashSha256,
      usageRole,
      authoritativeEvidenceEligible,
      professionalValuationOpinionEligible,
      officialUnderlyingProvenanceCorroborated,
      finalValuationConclusionEstablished: false,
      certifiedValuationEstablished: false,
      transactionAuthorized: false,
      publicAiAuthorized: false,
      blockers: Object.freeze([...blockers]),
      warnings: Object.freeze([...warnings]),
    }),
  };
}

function evaluateSourceProvenanceBundle({
  records,
  asOf = new Date(),
  governedProfessionalProviders = {},
  trustedProvenanceVerifierIds = [],
  trustedLicenseVerifierIds = [],
} = {}) {
  const asOfMs = new Date(asOf).getTime();
  if (!Number.isFinite(asOfMs)) throw new TypeError('asOf must be a valid date');
  if (!Array.isArray(trustedProvenanceVerifierIds)) throw new TypeError('trustedProvenanceVerifierIds must be an array');
  if (!Array.isArray(trustedLicenseVerifierIds)) throw new TypeError('trustedLicenseVerifierIds must be an array');
  const trustedProvenanceVerifiers = normalizeTrustedIds(trustedProvenanceVerifierIds);
  const trustedLicenseVerifiers = normalizeTrustedIds(trustedLicenseVerifierIds);
  const sourceRecords = Array.isArray(records) ? records : [];

  const officialPass = sourceRecords
    .filter((record) => record && record.sourceTier === SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE)
    .map((record) => evaluateSourceProvenanceRecord(record, {
      asOfMs,
      governedProfessionalProviders,
      trustedProvenanceVerifierIds: trustedProvenanceVerifiers,
      trustedLicenseVerifierIds: trustedLicenseVerifiers,
      verifiedOfficialEvidenceRecords: [],
    }))
    .filter((finding) => finding.normalized && finding.blockers.length === 0 && finding.normalized.authoritativeEvidenceEligible);

  const verifiedOfficialEvidenceRecords = officialPass.map((finding) => Object.freeze({
    evidenceHashSha256: finding.normalized.evidenceHashSha256,
    sourceProvider: finding.normalized.sourceProvider,
    underlyingAuthority: finding.normalized.underlyingAuthority,
  }));
  const verifiedOfficialEvidenceHashes = [...new Set(verifiedOfficialEvidenceRecords.map((record) => record.evidenceHashSha256).filter(Boolean))];

  const findings = sourceRecords.map((record) => evaluateSourceProvenanceRecord(record, {
    asOfMs,
    governedProfessionalProviders,
    trustedProvenanceVerifierIds: trustedProvenanceVerifiers,
    trustedLicenseVerifierIds: trustedLicenseVerifiers,
    verifiedOfficialEvidenceRecords,
  }));

  const blockers = [];
  const warnings = [];
  if (!Array.isArray(records)) blockers.push('C2S_SOURCE_RECORDS_ARRAY_REQUIRED');
  findings.forEach((finding) => {
    blockers.push(...finding.blockers);
    warnings.push(...finding.warnings);
  });
  const normalizedRecords = findings.map((finding) => finding.normalized).filter(Boolean);
  const recordIdCounts = new Map();
  for (const record of normalizedRecords) {
    if (!record.id) continue;
    recordIdCounts.set(record.id, (recordIdCounts.get(record.id) || 0) + 1);
  }
  for (const [recordId, count] of recordIdCounts.entries()) {
    if (count > 1) blockers.push(`C2S_DUPLICATE_SOURCE_RECORD_ID:${recordId}`);
  }

  const uniqueBlockers = [...new Set(blockers)];
  const status = uniqueBlockers.length ? SOURCE_PROVENANCE_GATE_STATUS.HOLD_EVIDENCE : SOURCE_PROVENANCE_GATE_STATUS.READY;
  const recordHashes = normalizedRecords
    .map((record) => ({ id: record.id, hash: record.sourceRecordHashSha256 }))
    .sort((a, b) => `${a.id}:${a.hash}`.localeCompare(`${b.id}:${b.hash}`));
  const bundleHashSha256 = hashValue({
    schemaVersion: C2S_SOURCE_INTELLIGENCE_SCHEMA_VERSION,
    registryVersion: SOURCE_PROVIDER_REGISTRY_VERSION,
    asOf: new Date(asOfMs).toISOString(),
    records: recordHashes,
  });

  const authoritativeEvidence = normalizedRecords.filter((record) => record.authoritativeEvidenceEligible);
  const commercialCorroboration = normalizedRecords.filter((record) => record.usageRole === SOURCE_USAGE_ROLE.CORROBORATION_ONLY && record.blockers.length === 0);
  const avmBenchmarks = normalizedRecords.filter((record) => record.usageRole === SOURCE_USAGE_ROLE.AVM_BENCHMARK_ONLY && record.blockers.length === 0);
  const professionalValuationOpinions = normalizedRecords.filter((record) => record.professionalValuationOpinionEligible);

  return Object.freeze({
    version: C2S_SOURCE_PROVENANCE_GOVERNANCE_VERSION,
    schemaVersion: C2S_SOURCE_INTELLIGENCE_SCHEMA_VERSION,
    sourceProviderRegistryVersion: SOURCE_PROVIDER_REGISTRY_VERSION,
    asOf: new Date(asOfMs).toISOString(),
    status,
    provenanceClassificationReady: status === SOURCE_PROVENANCE_GATE_STATUS.READY,
    decisionReady: false,
    authoritativeEvidenceReady: status === SOURCE_PROVENANCE_GATE_STATUS.READY && authoritativeEvidence.length > 0,
    verifiedOfficialEvidenceHashes: Object.freeze(verifiedOfficialEvidenceHashes),
    verifiedOfficialEvidenceRecords: Object.freeze(verifiedOfficialEvidenceRecords),
    records: Object.freeze(normalizedRecords),
    authoritativeEvidence: Object.freeze(authoritativeEvidence),
    commercialCorroboration: Object.freeze(commercialCorroboration),
    avmBenchmarks: Object.freeze(avmBenchmarks),
    professionalValuationOpinions: Object.freeze(professionalValuationOpinions),
    bundleHashSha256,
    blockers: Object.freeze(uniqueBlockers),
    warnings: Object.freeze([...new Set(warnings)]),
    authoritativeElevationFromCommercial: false,
    avmCanEstablishCertifiedValuation: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'C2S classifies source provenance independently from valuation arithmetic and never makes the downstream property decision ready by itself. Official sources may support authoritative evidence only when their provider, underlying authority, trusted provenance verifier, timestamps and evidence hash pass. Commercial intelligence can corroborate but cannot self-elevate to official authority. A commercial or AVM claim of official provenance must be linked by evidence hash to an independently verified official record whose source provider or declared underlying authority matches the claimed authority. External AVMs are benchmark/challenger inputs only. Licensed-professional opinions require a governed provider, trusted provenance verification and trusted license verification and still do not by themselves authorize a transaction, public AI, canonical activation or a final/certified Startak valuation.',
  });
}

module.exports = {
  C2S_SOURCE_PROVENANCE_GOVERNANCE_VERSION,
  evaluateSourceProvenanceRecord,
  evaluateSourceProvenanceBundle,
  hashValue,
};

'use strict';

const INGESTION_MODE = Object.freeze({
  MANUAL_REFERENCE_ONLY: 'MANUAL_REFERENCE_ONLY',
  USER_SUPPLIED_DOCUMENT: 'USER_SUPPLIED_DOCUMENT',
  USER_SUPPLIED_URL_SNAPSHOT: 'USER_SUPPLIED_URL_SNAPSHOT',
});

const INGESTION_STATUS = Object.freeze({
  ACCEPTED_REFERENCE: 'ACCEPTED_REFERENCE',
  HOLD_SOURCE_METADATA: 'HOLD_SOURCE_METADATA',
  HOLD_PROVENANCE: 'HOLD_PROVENANCE',
  REJECT_LIVE_INTEGRATION_CLAIM: 'REJECT_LIVE_INTEGRATION_CLAIM',
});

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function assertAllowedMode(mode) {
  if (!Object.values(INGESTION_MODE).includes(mode)) {
    throw new Error(`UNSUPPORTED_INGESTION_MODE: ${mode}`);
  }
}

function createManualReferenceRecord({
  sourceId,
  sourceName,
  sourceUrl = null,
  mode = INGESTION_MODE.MANUAL_REFERENCE_ONLY,
  retrievedAt,
  suppliedBy,
  documentRef = null,
  contentHash = null,
  effectiveDate = null,
  lastVerifiedDate = null,
  authorityClass = 'UNCLASSIFIED_REFERENCE',
  notes = null,
  liveConnected = false,
  officialApiUsed = false,
} = {}) {
  assertAllowedMode(mode);

  if (liveConnected || officialApiUsed) {
    return Object.freeze({
      status: INGESTION_STATUS.REJECT_LIVE_INTEGRATION_CLAIM,
      reasonCodes: Object.freeze(['MANUAL_PATH_CANNOT_ASSERT_LIVE_OR_OFFICIAL_API']),
      liveConnected: false,
      officialApiUsed: false,
      transactionAuthorized: false,
    });
  }

  const missingMetadata = [];
  if (!clean(sourceId)) missingMetadata.push('sourceId');
  if (!clean(sourceName)) missingMetadata.push('sourceName');
  if (!clean(retrievedAt)) missingMetadata.push('retrievedAt');
  if (!clean(suppliedBy)) missingMetadata.push('suppliedBy');

  if (missingMetadata.length) {
    return Object.freeze({
      status: INGESTION_STATUS.HOLD_SOURCE_METADATA,
      reasonCodes: Object.freeze(missingMetadata.map((k) => `MISSING_${k.toUpperCase()}`)),
      liveConnected: false,
      officialApiUsed: false,
      transactionAuthorized: false,
    });
  }

  const provenancePresent = Boolean(clean(documentRef) || clean(sourceUrl) || clean(contentHash));
  if (!provenancePresent) {
    return Object.freeze({
      status: INGESTION_STATUS.HOLD_PROVENANCE,
      reasonCodes: Object.freeze(['MISSING_SOURCE_URL_DOCUMENT_REF_OR_CONTENT_HASH']),
      liveConnected: false,
      officialApiUsed: false,
      transactionAuthorized: false,
    });
  }

  return Object.freeze({
    status: INGESTION_STATUS.ACCEPTED_REFERENCE,
    sourceId: clean(sourceId),
    sourceName: clean(sourceName),
    sourceUrl: clean(sourceUrl) || null,
    mode,
    retrievedAt: clean(retrievedAt),
    suppliedBy: clean(suppliedBy),
    documentRef: clean(documentRef) || null,
    contentHash: clean(contentHash) || null,
    effectiveDate: clean(effectiveDate) || null,
    lastVerifiedDate: clean(lastVerifiedDate) || null,
    authorityClass: clean(authorityClass) || 'UNCLASSIFIED_REFERENCE',
    notes: clean(notes) || null,
    liveConnected: false,
    officialApiUsed: false,
    claimBoundary: Object.freeze({
      isOfficialIntegration: false,
      isLiveDataFeed: false,
      mayBeUsedAsReferenceEvidence: true,
      requiresIndependentVerificationForRegulatedOrLegalConclusion: true,
    }),
    transactionAuthorized: false,
  });
}

function qualifyReferenceForDecision({ record, requiredFreshnessDate = null, requireEffectiveDate = false } = {}) {
  if (!record || record.status !== INGESTION_STATUS.ACCEPTED_REFERENCE) {
    return Object.freeze({ qualified: false, status: 'HOLD_REFERENCE_NOT_ACCEPTED' });
  }
  if (requireEffectiveDate && !record.effectiveDate) {
    return Object.freeze({ qualified: false, status: 'HOLD_EFFECTIVE_DATE' });
  }
  if (requiredFreshnessDate) {
    const verified = record.lastVerifiedDate || record.retrievedAt;
    if (!verified || String(verified) < String(requiredFreshnessDate)) {
      return Object.freeze({ qualified: false, status: 'HOLD_STALE_REFERENCE' });
    }
  }
  return Object.freeze({
    qualified: true,
    status: 'REFERENCE_QUALIFIED_FOR_ANALYTICAL_USE',
    liveConnected: false,
    officialApiUsed: false,
  });
}

module.exports = {
  INGESTION_MODE,
  INGESTION_STATUS,
  createManualReferenceRecord,
  qualifyReferenceForDecision,
};

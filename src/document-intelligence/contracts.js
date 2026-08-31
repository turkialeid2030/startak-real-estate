'use strict';

const DOCUMENT_TYPE = Object.freeze({
  TITLE_DEED: 'TITLE_DEED',
  SURVEY: 'SURVEY',
  VALUATION: 'VALUATION',
  LEASE: 'LEASE',
  FINANCIAL_MODEL: 'FINANCIAL_MODEL',
  PRESENTATION: 'PRESENTATION',
  BUILDING_PERMIT: 'BUILDING_PERMIT',
  ZONING: 'ZONING',
  DUE_DILIGENCE: 'DUE_DILIGENCE',
  UNKNOWN: 'UNKNOWN',
});

const AUTHORITY_CLASS = Object.freeze({
  OFFICIAL_PRIMARY: 'OFFICIAL_PRIMARY',
  LICENSED_PROFESSIONAL: 'LICENSED_PROFESSIONAL',
  CONTRACTUAL: 'CONTRACTUAL',
  INTERNAL_MODEL: 'INTERNAL_MODEL',
  PRESENTATION: 'PRESENTATION',
  UNKNOWN: 'UNKNOWN',
});

const TRUTH_STATUS = Object.freeze({
  DOCUMENT_ONLY: 'DOCUMENT_ONLY',
  EXTRACTED_EVIDENCE: 'EXTRACTED_EVIDENCE',
  VERIFIED_FACT: 'VERIFIED_FACT',
});

const VERIFICATION_STATUS = Object.freeze({
  NOT_VERIFIED: 'NOT_VERIFIED',
  VERIFIED: 'VERIFIED',
});

const LOCATOR_KIND = Object.freeze({
  PAGE: 'PAGE',
  CELL: 'CELL',
  SLIDE: 'SLIDE',
  SECTION: 'SECTION',
  DOCUMENT_METADATA: 'DOCUMENT_METADATA',
});

const RECONCILIATION_STATUS = Object.freeze({
  MISSING: 'MISSING',
  SINGLE_SOURCE_UNCORROBORATED: 'SINGLE_SOURCE_UNCORROBORATED',
  AGREEMENT: 'AGREEMENT',
  CONFLICT: 'CONFLICT',
  UNIT_MISMATCH: 'UNIT_MISMATCH',
});

const READINESS_STATUS = Object.freeze({
  HOLD_EVIDENCE: 'HOLD_EVIDENCE',
  READY_FOR_UNDERWRITING_INPUT: 'READY_FOR_UNDERWRITING_INPUT',
});

const MATERIALITY = Object.freeze({
  MATERIAL: 'MATERIAL',
  SUPPORTING: 'SUPPORTING',
});

const INGEST_STATUS = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  DUPLICATE_CONTENT: 'DUPLICATE_CONTENT',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertEnum(value, allowed, field) {
  if (!Object.values(allowed).includes(value)) {
    throw new TypeError(`${field} must be one of: ${Object.values(allowed).join(', ')}`);
  }
}

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function normalizeIsoTimestamp(value, field) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function validateSourceLocator(locator) {
  if (!locator || typeof locator !== 'object') throw new TypeError('sourceLocator is required');
  assertEnum(locator.kind, LOCATOR_KIND, 'sourceLocator.kind');

  const positionFields = {
    [LOCATOR_KIND.PAGE]: 'page',
    [LOCATOR_KIND.CELL]: 'cell',
    [LOCATOR_KIND.SLIDE]: 'slide',
    [LOCATOR_KIND.SECTION]: 'section',
    [LOCATOR_KIND.DOCUMENT_METADATA]: 'field',
  };
  const positionField = positionFields[locator.kind];
  const positionValue = locator[positionField];
  if (positionValue === undefined || positionValue === null || String(positionValue).trim() === '') {
    throw new TypeError(`sourceLocator.${positionField} is required for ${locator.kind}`);
  }

  return deepFreeze({ ...locator });
}

function createDocumentRecord({
  documentId,
  caseId,
  fileName,
  mimeType = 'application/octet-stream',
  sizeBytes,
  contentHashSha256,
  documentType = DOCUMENT_TYPE.UNKNOWN,
  authorityClass = AUTHORITY_CLASS.UNKNOWN,
  receivedAt,
  ingestStatus = INGEST_STATUS.ACCEPTED,
  duplicateOfDocumentId = null,
}) {
  assertNonEmptyString(documentId, 'documentId');
  assertNonEmptyString(caseId, 'caseId');
  assertNonEmptyString(fileName, 'fileName');
  assertNonEmptyString(mimeType, 'mimeType');
  if (!Number.isInteger(sizeBytes) || sizeBytes < 0) throw new TypeError('sizeBytes must be a non-negative integer');
  if (typeof contentHashSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(contentHashSha256)) {
    throw new TypeError('contentHashSha256 must be a 64-character SHA-256 hex digest');
  }
  assertEnum(documentType, DOCUMENT_TYPE, 'documentType');
  assertEnum(authorityClass, AUTHORITY_CLASS, 'authorityClass');
  assertEnum(ingestStatus, INGEST_STATUS, 'ingestStatus');

  return deepFreeze({
    schemaVersion: 1,
    documentId,
    caseId,
    fileName,
    mimeType,
    sizeBytes,
    contentHashSha256: contentHashSha256.toLowerCase(),
    documentType,
    authorityClass,
    authorityVerified: false,
    receivedAt: normalizeIsoTimestamp(receivedAt, 'receivedAt'),
    ingestStatus,
    duplicateOfDocumentId,
    truthStatus: TRUTH_STATUS.DOCUMENT_ONLY,
  });
}

function createEvidenceFact({
  factId,
  caseId,
  document,
  key,
  rawValue,
  normalizedValue,
  valueType,
  unit = null,
  sourceLocator,
  extractionMethod,
  extractionConfidence,
  materiality = MATERIALITY.SUPPORTING,
  capturedAt,
}) {
  assertNonEmptyString(factId, 'factId');
  assertNonEmptyString(caseId, 'caseId');
  if (!document || typeof document !== 'object') throw new TypeError('document is required');
  assertNonEmptyString(document.documentId, 'document.documentId');
  assertNonEmptyString(document.caseId, 'document.caseId');
  assertNonEmptyString(document.contentHashSha256, 'document.contentHashSha256');
  if (document.caseId !== caseId) {
    throw new TypeError(`CASE_ISOLATION_VIOLATION: evidence caseId ${caseId} does not match document caseId ${document.caseId}`);
  }
  assertNonEmptyString(key, 'key');
  assertNonEmptyString(valueType, 'valueType');
  assertNonEmptyString(extractionMethod, 'extractionMethod');
  if (typeof extractionConfidence !== 'number' || extractionConfidence < 0 || extractionConfidence > 1) {
    throw new TypeError('extractionConfidence must be a number between 0 and 1');
  }
  assertEnum(materiality, MATERIALITY, 'materiality');

  return deepFreeze({
    schemaVersion: 1,
    factId,
    caseId,
    documentId: document.documentId,
    documentHashSha256: document.contentHashSha256,
    documentType: document.documentType,
    authorityClass: document.authorityClass,
    authorityVerified: Boolean(document.authorityVerified),
    key,
    rawValue,
    normalizedValue,
    valueType,
    unit,
    sourceLocator: validateSourceLocator(sourceLocator),
    extraction: {
      method: extractionMethod,
      confidence: extractionConfidence,
      note: 'Extraction confidence is not a probability that the fact is true.',
    },
    materiality,
    truthStatus: TRUTH_STATUS.EXTRACTED_EVIDENCE,
    verification: {
      status: VERIFICATION_STATUS.NOT_VERIFIED,
      method: null,
      verifierType: null,
      reference: null,
      verifiedAt: null,
    },
    capturedAt: normalizeIsoTimestamp(capturedAt, 'capturedAt'),
  });
}

function verifyEvidenceFact(fact, { verificationMethod, verifierType, verificationReference, verifiedAt }) {
  if (!fact || fact.truthStatus !== TRUTH_STATUS.EXTRACTED_EVIDENCE) {
    throw new TypeError('Only EXTRACTED_EVIDENCE facts can be promoted to VERIFIED_FACT');
  }
  assertNonEmptyString(verificationMethod, 'verificationMethod');
  assertNonEmptyString(verifierType, 'verifierType');
  assertNonEmptyString(verificationReference, 'verificationReference');

  return deepFreeze({
    ...fact,
    truthStatus: TRUTH_STATUS.VERIFIED_FACT,
    verification: {
      status: VERIFICATION_STATUS.VERIFIED,
      method: verificationMethod,
      verifierType,
      reference: verificationReference,
      verifiedAt: normalizeIsoTimestamp(verifiedAt, 'verifiedAt'),
    },
  });
}

module.exports = {
  DOCUMENT_TYPE,
  AUTHORITY_CLASS,
  TRUTH_STATUS,
  VERIFICATION_STATUS,
  LOCATOR_KIND,
  RECONCILIATION_STATUS,
  READINESS_STATUS,
  MATERIALITY,
  INGEST_STATUS,
  deepFreeze,
  createDocumentRecord,
  createEvidenceFact,
  verifyEvidenceFact,
  validateSourceLocator,
};

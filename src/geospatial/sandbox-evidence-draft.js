'use strict';

const {
  GEOSPATIAL_VERIFICATION_STATUS,
  GEOSPATIAL_RESOLUTION_METHOD,
} = require('../contracts/geospatial-evidence');
const {
  getOfficialSource,
  sourceSupportsEvidenceType,
  officialUrlMatchesSource,
} = require('./official-source-registry');

const C1_SANDBOX_EVIDENCE_DRAFT_VERSION = 'C1_SANDBOX_EVIDENCE_DRAFT_V1';
const RESERVED_TRUST_FIELDS = Object.freeze([
  'verificationStatus',
  'verifiedBy',
  'verificationReference',
  'resolutionMethod',
  'decisionReady',
  'transactionAuthorized',
  'publicAiAuthorized',
  'productionEligible',
]);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createSandboxGeospatialEvidenceDraft(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('sandbox geospatial evidence draft input must be an object');
  }

  const attemptedReservedFields = RESERVED_TRUST_FIELDS.filter((field) => (
    Object.prototype.hasOwnProperty.call(raw, field)
  ));
  if (attemptedReservedFields.length > 0) {
    throw new TypeError(`sandbox input cannot set trust/authority fields: ${attemptedReservedFields.join(',')}`);
  }

  const sourceId = cleanString(raw.sourceId);
  const source = getOfficialSource(sourceId);
  if (!source) throw new TypeError(`unregistered official geospatial source: ${sourceId || 'MISSING'}`);
  if (!sourceSupportsEvidenceType(sourceId, raw.evidenceType)) {
    throw new TypeError(`source ${sourceId} does not support evidence type ${raw.evidenceType || 'MISSING'}`);
  }
  if (!officialUrlMatchesSource(sourceId, raw.sourceUrl)) {
    throw new TypeError(`source URL does not match registered official domains for ${sourceId}`);
  }

  return Object.freeze({
    draftVersion: C1_SANDBOX_EVIDENCE_DRAFT_VERSION,
    id: cleanString(raw.id) || null,
    subjectId: cleanString(raw.subjectId) || null,
    evidenceType: raw.evidenceType || null,
    normalizedValue: raw.normalizedValue === undefined ? null : raw.normalizedValue,
    sourceId,
    sourceReference: cleanString(raw.sourceReference) || null,
    sourceUrl: cleanString(raw.sourceUrl) || null,
    observedAt: cleanString(raw.observedAt) || null,
    validUntil: cleanString(raw.validUntil) || null,
    freshnessPolicyId: cleanString(raw.freshnessPolicyId) || null,
    // A sandbox/manual capture cannot assert that it was resolved through an
    // official query path. That fact may only be established by a later trusted
    // verification process outside this draft adapter.
    resolutionMethod: GEOSPATIAL_RESOLUTION_METHOD.USER_SUPPLIED,
    critical: raw.critical === true,
    verificationStatus: GEOSPATIAL_VERIFICATION_STATUS.UNVERIFIED,
    verifiedBy: null,
    verificationReference: null,
    sandboxOnly: true,
    productionConnectorUsed: false,
    decisionReady: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    professionalValuationOpinion: false,
    semantics: 'Sandbox draft only. Source labels and normalized values are captured for review; official resolution, verification and decision authority cannot be created by this adapter.',
  });
}

module.exports = {
  C1_SANDBOX_EVIDENCE_DRAFT_VERSION,
  RESERVED_TRUST_FIELDS,
  createSandboxGeospatialEvidenceDraft,
};

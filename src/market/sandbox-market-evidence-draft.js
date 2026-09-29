'use strict';

const {
  MARKET_EVIDENCE_TYPE,
  MARKET_VERIFICATION_STATUS,
  MARKET_RESOLUTION_METHOD,
  expectedEvidenceClassForType,
} = require('../contracts/market-evidence');
const {
  getOfficialMarketSource,
  marketSourceSupportsEvidenceType,
  officialMarketUrlMatchesSource,
} = require('./official-market-source-registry');

const C2_SANDBOX_MARKET_EVIDENCE_DRAFT_VERSION = 'C2_SANDBOX_MARKET_EVIDENCE_DRAFT_V1';
const AUTHORITATIVE_TYPES = Object.freeze([
  MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
  MARKET_EVIDENCE_TYPE.CLOSED_RENT_TRANSACTION,
  MARKET_EVIDENCE_TYPE.SALE_PRICE_INDEX,
  MARKET_EVIDENCE_TYPE.RENT_INDEX,
  MARKET_EVIDENCE_TYPE.MARKET_LIQUIDITY_INDICATOR,
]);
const RESERVED_TRUST_FIELDS = Object.freeze([
  'evidenceClass',
  'verificationStatus',
  'verifiedBy',
  'verificationReference',
  'resolutionMethod',
  'decisionReady',
  'professionalValuationOpinion',
  'transactionAuthorized',
  'publicAiAuthorized',
  'productionEligible',
  'corroboratingSourceIds',
]);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createSandboxMarketEvidenceDraft(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('sandbox market evidence draft input must be an object');
  }

  const attemptedReservedFields = RESERVED_TRUST_FIELDS.filter((field) => (
    Object.prototype.hasOwnProperty.call(raw, field)
  ));
  if (attemptedReservedFields.length > 0) {
    throw new TypeError(`sandbox input cannot set trust/authority fields: ${attemptedReservedFields.join(',')}`);
  }

  const evidenceType = cleanString(raw.evidenceType);
  const evidenceClass = expectedEvidenceClassForType(evidenceType);
  if (!evidenceClass) throw new TypeError(`unsupported market evidence type: ${evidenceType || 'MISSING'}`);

  const sourceId = cleanString(raw.sourceId);
  if (AUTHORITATIVE_TYPES.includes(evidenceType)) {
    const source = getOfficialMarketSource(sourceId);
    if (!source) throw new TypeError(`unregistered official market source: ${sourceId || 'MISSING'}`);
    if (!marketSourceSupportsEvidenceType(sourceId, evidenceType)) {
      throw new TypeError(`source ${sourceId} does not support evidence type ${evidenceType}`);
    }
    if (!officialMarketUrlMatchesSource(sourceId, raw.sourceUrl)) {
      throw new TypeError(`source URL does not match registered official domains for ${sourceId}`);
    }
  }

  return Object.freeze({
    draftVersion: C2_SANDBOX_MARKET_EVIDENCE_DRAFT_VERSION,
    id: cleanString(raw.id) || null,
    marketContextId: cleanString(raw.marketContextId) || null,
    geographyKey: cleanString(raw.geographyKey) || null,
    assetType: cleanString(raw.assetType) || null,
    evidenceType,
    evidenceClass,
    normalizedValue: raw.normalizedValue === undefined ? null : raw.normalizedValue,
    sourceId: sourceId || null,
    sourceReference: cleanString(raw.sourceReference) || null,
    sourceUrl: cleanString(raw.sourceUrl) || null,
    transactionKey: cleanString(raw.transactionKey) || null,
    seriesKey: cleanString(raw.seriesKey) || null,
    observedAt: cleanString(raw.observedAt) || null,
    validUntil: cleanString(raw.validUntil) || null,
    freshnessPolicyId: cleanString(raw.freshnessPolicyId) || null,
    resolutionMethod: MARKET_RESOLUTION_METHOD.USER_SUPPLIED,
    verificationStatus: MARKET_VERIFICATION_STATUS.UNVERIFIED,
    verifiedBy: null,
    verificationReference: null,
    sandboxOnly: true,
    productionConnectorUsed: false,
    decisionReady: false,
    professionalValuationOpinion: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'Sandbox draft only. Source labels, market context and normalized values are captured for later review. A sandbox capture cannot create official transaction resolution, trusted verification, comparable sufficiency, valuation authority or transaction authority.',
  });
}

module.exports = {
  C2_SANDBOX_MARKET_EVIDENCE_DRAFT_VERSION,
  RESERVED_TRUST_FIELDS,
  createSandboxMarketEvidenceDraft,
};

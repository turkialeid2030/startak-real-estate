'use strict';

const crypto = require('node:crypto');
const {
  BASIS_OF_VALUE, INPUT_STATUS, EVIDENCE_GRADE, createEvidenceRecord, createValuationIndication,
} = require('../valuation-intelligence/contracts');
const {
  TRANSACTION_STATUS, calculateMarketComparableIndication,
} = require('../valuation-intelligence/market-comparables');
const {
  MARKET_TRANSACTION_TYPE, MARKET_EVIDENCE_LEVEL, MARKET_VERIFICATION_STATUS,
} = require('./comparable-evidence');

const VERSION = 'C58_COMPARABLE_PROVENANCE_CHAIN_V1';
const STATUS = Object.freeze({
  HOLD: 'HOLD_SOURCE_AUTHENTICITY_OR_PROVENANCE',
  READY_FOR_INDEPENDENT_SOURCE_AUTHENTICATION: 'READY_FOR_INDEPENDENT_SOURCE_AUTHENTICATION',
});
const HEX64 = /^[a-f0-9]{64}$/i;
function filled(s) { return typeof s === 'string' && s.trim().length > 0; }
function sha(v) {
  const stable = x => Array.isArray(x) ? x.map(stable) :
    x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, stable(x[k])])) : x;
  return crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
}
function validDate(v) {
  return filled(v) && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v.slice(0, 10);
}
function freeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.values(v).forEach(freeze); Object.freeze(v);
  }
  return v;
}
function blocked(blockers, details=[]) {
  return freeze({
    version: VERSION,
    status: blockers.length ? STATUS.HOLD : STATUS.READY_FOR_INDEPENDENT_SOURCE_AUTHENTICATION,
    blockers: [...new Set(blockers)], details,
    independentSourceAuthenticityEstablished: false,
    sourceRightsIndependentlyAuthenticated: false,
    professionallyQualifiedComparablesEstablished: false,
    productionDecisionAuthorized: false,
    certifiedValuationEstablished: false,
  });
}
function recordedIntegrity(record) {
  if (!record || !HEX64.test(record.comparableHashSha256 || '')) return false;
  const copy = { ...record };
  delete copy.comparableHashSha256;
  return sha(copy) === record.comparableHashSha256;
}
function receiptIntegrity(receipt) {
  if (!receipt || !HEX64.test(receipt.receiptHashSha256 || '')) return false;
  const copy = {...receipt};
  delete copy.receiptHashSha256;
  return sha(copy) === receipt.receiptHashSha256;
}
function sourceRightValid(right, sourceRef, date, asOf) {
  return right && right.sourceRef === sourceRef &&
    filled(right.providerRef) && filled(right.rightsDocumentRef) &&
    HEX64.test(right.rightsArtifactSha256 || '') &&
    filled(right.reviewedByRef) && filled(right.reviewEvidenceRef) &&
    validDate(right.reviewedAt) && Date.parse(right.reviewedAt) <= Date.parse(asOf) &&
    validDate(right.validFrom) && validDate(right.validUntil) &&
    Date.parse(right.validFrom) <= Date.parse(date) &&
    Date.parse(right.validUntil) >= Date.parse(asOf) &&
    Array.isArray(right.allowedUses) && right.allowedUses.includes('INTERNAL_VALUATION') &&
    right.prohibitedUses && !right.prohibitedUses.includes?.('INTERNAL_VALUATION') &&
    right.suspended !== true;
}

/**
 * C58 proves only integrity and self-consistency of source records, captures
 * and permission evidence. It deliberately cannot prove that issuer documents
 * really correspond to official transactions: independent evidence review is
 * an external gate and no caller assertion can override it here.
 */
function evaluateComparableProvenanceChain({
  caseId, basis, valuationDate, subjectAssetType, subjectCity,
  comparables, evidenceRecords, sourceReceipts, sourceRights,
  asOf,
} = {}) {
  const blockers = [], details = [];
  if (!filled(caseId) || !filled(subjectAssetType) || !filled(subjectCity)) blockers.push('SUBJECT_CASE_ASSET_CITY_REQUIRED');
  if (!validDate(valuationDate) || !validDate(asOf) || (validDate(valuationDate) && validDate(asOf) &&
      Date.parse(asOf) < Date.parse(valuationDate))) blockers.push('VALUATION_AND_ASOF_DATES_REQUIRED');
  if (![BASIS_OF_VALUE.MARKET_VALUE,BASIS_OF_VALUE.FAIR_VALUE,BASIS_OF_VALUE.MARKET_RENT].includes(basis)) blockers.push('BASIS_INVALID');
  if (![comparables,evidenceRecords,sourceReceipts,sourceRights].every(Array.isArray)) {
    return blocked([...blockers,'COMPLETE_SOURCE_CHAIN_COLLECTIONS_REQUIRED']);
  }
  const expectedStatus = basis === BASIS_OF_VALUE.MARKET_RENT
    ? TRANSACTION_STATUS.EXECUTED_LEASE : TRANSACTION_STATUS.EXECUTED_SALE;
  const expectedRecordTransaction = basis === BASIS_OF_VALUE.MARKET_RENT
    ? MARKET_TRANSACTION_TYPE.RENT : MARKET_TRANSACTION_TYPE.SALE;
  const allowedEvidence = basis === BASIS_OF_VALUE.MARKET_RENT
    ? [MARKET_EVIDENCE_LEVEL.OFFICIAL_REGISTERED_TRANSACTION, MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION, MARKET_EVIDENCE_LEVEL.CONFIRMED_TRANSACTION]
    : [MARKET_EVIDENCE_LEVEL.OFFICIAL_REGISTERED_TRANSACTION, MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION];
  const byId = new Map(), byReceipt = new Map(), byRight = new Map();
  const marketTruthIdentities = new Set();
  const duplicateComparableIds = new Set();
  for (const item of evidenceRecords) {
    if (!item || !filled(item.comparableId) || byId.has(item.comparableId)) {
      blockers.push('EVIDENCE_RECORD_DUPLICATED_OR_INVALID');
    } else byId.set(item.comparableId,item);
  }
  for (const item of sourceReceipts) {
    if (!item || !filled(item.comparableId) || byReceipt.has(item.comparableId)) {
      blockers.push('SOURCE_RECEIPT_DUPLICATED_OR_INVALID');
    } else byReceipt.set(item.comparableId,item);
  }
  for (const right of sourceRights) {
    if (!right || !filled(right.sourceRef) || byRight.has(right.sourceRef)) {
      blockers.push('SOURCE_RIGHTS_DUPLICATED_OR_INVALID');
    } else byRight.set(right.sourceRef,right);
  }
  for (const cmp of comparables) {
    const id=cmp && cmp.comparableId;
    const reasons=[];
    if (!filled(id) || duplicateComparableIds.has(id)) reasons.push('COMPARABLE_ID_DUPLICATED_OR_INVALID');
    if (filled(id)) duplicateComparableIds.add(id);
    const record=byId.get(id);
    const receipt=byReceipt.get(id);
    if (!cmp || cmp.transactionStatus!==expectedStatus) reasons.push('NOT_EXECUTED_OR_WRONG_TRANSACTION_BASIS');
    if (!record || !recordedIntegrity(record)) reasons.push('WAVE9A_RECORD_HASH_INVALID');
    if (!receipt || !receiptIntegrity(receipt)) reasons.push('CAPTURE_RECEIPT_HASH_INVALID');
    if (record) {
      if (record.caseId!==caseId || record.assetType!==subjectAssetType ||
          record.location?.city!==subjectCity) reasons.push('ASSET_IDENTITY_CITY_CASE_MISMATCH');
      if (record.transactionType!==expectedRecordTransaction ||
          !allowedEvidence.includes(record.evidenceLevel) ||
          record.verification?.status!==MARKET_VERIFICATION_STATUS.VERIFIED ||
          record.abnormalTransaction) reasons.push('EXECUTED_TRANSACTION_QUALITY_NOT_ESTABLISHED');
      if (!validDate(record.transactionDate) || !validDate(record.sourceDate) ||
          !validDate(record.capturedAt) ||
          (validDate(valuationDate) && (Date.parse(record.transactionDate)>Date.parse(valuationDate) ||
          Date.parse(record.sourceDate)>Date.parse(valuationDate))) ||
          (validDate(asOf) && Date.parse(record.capturedAt)>Date.parse(asOf))) reasons.push('MARKET_CHRONOLOGY_INVALID');
      if (cmp && (cmp.sourceRef!==record.sourceRef ||
          !validDate(cmp.transactionDate) ||
          Date.parse(cmp.transactionDate)!==Date.parse(record.transactionDate) ||
          !Number.isFinite(cmp.unitValue) ||
          Math.abs(cmp.unitValue-record.unitValueSarPerSqm)>Math.max(0.000001,record.unitValueSarPerSqm*1e-10))) {
        reasons.push('C54_COMPARABLE_SOURCE_DATE_PRICE_MISMATCH');
      }
      const correspondingRight=byRight.get(record.sourceRef);
      if (!validDate(asOf) || !validDate(valuationDate) ||
          !sourceRightValid(correspondingRight,record.sourceRef,valuationDate,asOf)) reasons.push('SOURCE_RIGHTS_DOCUMENT_NOT_QUALIFIED');
      if (!receipt || receipt.sourceRef!==record.sourceRef ||
          receipt.recordHashSha256!==record.comparableHashSha256 ||
          receipt.sourcePropertyRef!==record.sourcePropertyRef ||
          !filled(receipt.transactionIdentityRef) ||
          !filled(receipt.sourceDocumentRef) ||
          !HEX64.test(receipt.sourceArtifactSha256||'') ||
          !filled(receipt.capturedByRef) ||
          !validDate(receipt.capturedAt) ||
          Date.parse(receipt.capturedAt)!==Date.parse(record.capturedAt)) reasons.push('CAPTURE_BINDING_OR_DIGEST_MISMATCH');
      if (receipt && filled(receipt.transactionIdentityRef)) {
        const key=record.transactionType+'|'+receipt.transactionIdentityRef;
        if (marketTruthIdentities.has(key)) reasons.push('DUPLICATE_UNDERLYING_TRANSACTION');
        marketTruthIdentities.add(key);
      }
    }
    if (reasons.length) blockers.push(...reasons.map(s=>id+':'+s));
    details.push({comparableId:id||null,structurallyQualified:reasons.length===0,reasons});
  }
  if (comparables.length<2) blockers.push('MINIMUM_TWO_COMPARABLES_REQUIRED');
  if (byId.size!==comparables.length || byReceipt.size!==comparables.length)
    blockers.push('UNMATCHED_OR_EXTRA_PROVENANCE_RECORD');
  if (byRight.size!==new Set(evidenceRecords.filter(x=>x&&filled(x.sourceRef)).map(x=>x.sourceRef)).size)
    blockers.push('MISSING_OR_EXTRA_RIGHTS_RECORD');
  return blocked(blockers,details);
}

/**
 * A bounded adapter that cannot silently convert mere self-declared source
 * documents to authenticated evidence. Same numerical arithmetic as C54, with
 * an explicit conflict added until independent authentication is ingested.
 */
function calculateSourceBoundMarketIndication({provenance, ...request} = {}) {
  const preliminary = calculateMarketComparableIndication(request);
  const gate = evaluateComparableProvenanceChain({...provenance,comparables:request.comparables,basis:request.basis,valuationDate:request.valuationDate});
  const evidence = [...preliminary.evidence,createEvidenceRecord({
    field:'C58_independent_source_authentication',
    grade:EVIDENCE_GRADE.G_EXPERT_ASSUMPTION,
    status:INPUT_STATUS.CONFLICT,
    sourceType:'C58_SOURCE_PROVENANCE_HARD_GATE',
    note:gate.blockers.length ? gate.blockers.join('; ').slice(0,2500) : 'SOURCE_AUTHENTICITY_AND_RIGHTS_REQUIRE_INDEPENDENT_EXTERNAL_VERIFICATION',
  })];
  return createValuationIndication({
    method:preliminary.method,basis:preliminary.basis,value:preliminary.value,currency:preliminary.currency,
    valuationDate:preliminary.valuationDate,evidence,
    warnings:[...preliminary.warnings,'C58_UNAUTHENTICATED_SOURCE_PRELIMINARY_ONLY'],
    assumptions:preliminary.assumptions,
    components:{...preliminary.components,sourceProvenanceGate:gate,independentSourceAuthenticityEstablished:false},
  });
}

module.exports = {VERSION,STATUS,evaluateComparableProvenanceChain,calculateSourceBoundMarketIndication};

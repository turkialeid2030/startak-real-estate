'use strict';

const crypto = require('node:crypto');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {
  PROPERTY_EVIDENCE_PACKET_STATUS,
} = require('../property/property-evidence-bridge');
const {
  ADJUSTMENT_ANALYSIS_STATUS,
  LEASE_INCOME_GATE_STATUS,
} = require('../market');

const VALUATION_METHOD = Object.freeze({
  SALES_COMPARISON: 'SALES_COMPARISON',
  DIRECT_CAPITALIZATION: 'DIRECT_CAPITALIZATION',
  DISCOUNTED_CASH_FLOW: 'DISCOUNTED_CASH_FLOW',
});

const RATE_INPUT_TYPE = Object.freeze({
  MARKET_CAP_RATE: 'MARKET_CAP_RATE',
  DISCOUNT_RATE: 'DISCOUNT_RATE',
  EXIT_CAP_RATE: 'EXIT_CAP_RATE',
});

const RATE_SOURCE = Object.freeze({
  VERIFIED_MARKET_ANALYSIS: 'VERIFIED_MARKET_ANALYSIS',
  PROFESSIONAL_JUDGMENT: 'PROFESSIONAL_JUDGMENT',
  EXTERNAL_PROFESSIONAL_REPORT: 'EXTERNAL_PROFESSIONAL_REPORT',
  OTHER: 'OTHER',
});

const RATE_CONFIDENCE = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
});

const METHOD_INPUT_STATUS = Object.freeze({
  READY_FOR_CANONICAL_ENGINE_ADOPTION_REVIEW: 'READY_FOR_CANONICAL_ENGINE_ADOPTION_REVIEW',
  HOLD_PROPERTY_EVIDENCE: 'HOLD_PROPERTY_EVIDENCE',
  HOLD_METHOD_EVIDENCE: 'HOLD_METHOD_EVIDENCE',
  HOLD_RATE_PROVENANCE: 'HOLD_RATE_PROVENANCE',
  HOLD_INPUT_COMPLETENESS: 'HOLD_INPUT_COMPLETENESS',
});

const REQUIRED_RATE_TYPES_BY_METHOD = Object.freeze({
  [VALUATION_METHOD.SALES_COMPARISON]: Object.freeze([]),
  [VALUATION_METHOD.DIRECT_CAPITALIZATION]: Object.freeze([RATE_INPUT_TYPE.MARKET_CAP_RATE]),
  [VALUATION_METHOD.DISCOUNTED_CASH_FLOW]: Object.freeze([RATE_INPUT_TYPE.DISCOUNT_RATE, RATE_INPUT_TYPE.EXIT_CAP_RATE]),
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}

function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`);
}

function iso(value, field) {
  assertNonEmpty(value, field);
  const date = new Date(strictCalendarDateMs(value));
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return date.toISOString();
}

function assertSha256(value, field) {
  if (!nonEmpty(value) || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be a SHA-256 digest`);
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    if(['__proto__','constructor','prototype'].includes(key))throw TypeError('METHOD_INPUT_UNSAFE_KEY');
    out[key] = stableClone(value[key]);
    return out;
  }, {});
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function daysBetween(earlier, later) {
  return Math.floor((Date.parse(later) - Date.parse(earlier)) / 86400000);
}

function verifyProfessionalRateInputIntegrity(rate) {
  if (!rate || typeof rate !== 'object' || !/^[a-f0-9]{64}$/i.test(String(rate.rateInputHashSha256 || ''))) return false;
  try{
    const {rateInputHashSha256,...payload}=rate;
    return sha256(payload)===rateInputHashSha256&&createProfessionalRateInput(rate).rateInputHashSha256===rateInputHashSha256;
  }catch{return false;}
}

function verifyMarketAnalysisSubjectBindingIntegrity(binding) {
  if (!binding || typeof binding !== 'object' || !/^[a-f0-9]{64}$/i.test(String(binding.bindingHashSha256 || ''))) return false;
  try{
    const {bindingHashSha256,...payload}=binding;
    const replay=createMarketAnalysisSubjectBinding({...binding,marketAdjustmentAnalysis:{caseId:binding.caseId,analysisHashSha256:binding.marketAdjustmentAnalysisHashSha256}});
    return sha256(payload)===bindingHashSha256&&replay.bindingHashSha256===bindingHashSha256;
  }catch{return false;}
}

function createProfessionalRateInput({
  rateId,
  caseId,
  propertyRef,
  type,
  value,
  source,
  sourceLabel = null,
  rationale,
  evidenceRefs,
  asOfDate,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
  confidence,
} = {}) {
  for (const [field, item] of [
    ['rateId', rateId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['rationale', rationale], ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef],
    ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(item, field);
  assertEnum(type, RATE_INPUT_TYPE, 'type');
  assertEnum(source, RATE_SOURCE, 'source');
  assertEnum(confidence, RATE_CONFIDENCE, 'confidence');
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
    throw new TypeError('value must be a finite decimal rate > 0 and <= 1');
  }
  if (source === RATE_SOURCE.OTHER && !nonEmpty(sourceLabel)) throw new TypeError('OTHER_RATE_SOURCE_REQUIRES_LABEL');
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !nonEmpty(ref))) {
    throw new TypeError('evidenceRefs must contain at least one non-empty reference');
  }

  const asOfDateIso = iso(asOfDate, 'asOfDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  const reviewedAtIso = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(preparedAtIso) < Date.parse(asOfDateIso)) throw new TypeError('RATE_PREPARATION_BEFORE_AS_OF_DATE');
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError('RATE_REVIEW_BEFORE_PREPARATION');

  const record = {
    schemaVersion: 1,
    rateId: rateId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    type,
    value,
    source,
    sourceLabel: sourceLabel ? sourceLabel.trim() : null,
    rationale: rationale.trim(),
    evidenceRefs: [...new Set(evidenceRefs.map((ref) => ref.trim()))],
    asOfDate: asOfDateIso,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    confidence,
    professionalJudgmentExplicit: true,
    automaticallyDerived: false,
    canonicalEngineInputWritten: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
  record.rateInputHashSha256 = sha256(record);
  return deepFreeze(record);
}

function createMarketAnalysisSubjectBinding({
  bindingId,
  caseId,
  propertyRef,
  marketAdjustmentAnalysis,
  boundByRef,
  boundAt,
  bindingEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['bindingId', bindingId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['boundByRef', boundByRef], ['bindingEvidenceRef', bindingEvidenceRef],
  ]) assertNonEmpty(value, field);
  if (!marketAdjustmentAnalysis || typeof marketAdjustmentAnalysis !== 'object') throw new TypeError('marketAdjustmentAnalysis is required');
  if (marketAdjustmentAnalysis.caseId !== caseId) throw new TypeError('CASE_ISOLATION_VIOLATION:marketAdjustmentAnalysis');
  assertSha256(marketAdjustmentAnalysis.analysisHashSha256, 'marketAdjustmentAnalysis.analysisHashSha256');
  const binding = {
    schemaVersion: 1,
    bindingId: bindingId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    marketAdjustmentAnalysisHashSha256: marketAdjustmentAnalysis.analysisHashSha256,
    boundByRef: boundByRef.trim(),
    boundAt: iso(boundAt, 'boundAt'),
    bindingEvidenceRef: bindingEvidenceRef.trim(),
    subjectPropertyBindingExplicit: true,
    automaticallyInferred: false,
  };
  binding.bindingHashSha256 = sha256(binding);
  return deepFreeze(binding);
}

function hold(status, reasons, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    method: context.method || null,
    status,
    reasons,
    candidateCanonicalRateBindings: Object.freeze({}),
    readyForCanonicalEngineAdoptionReview: false,
    explicitHumanAdoptionRequired: true,
    canonicalCalculationEngineRemainsAuthoritative: true,
    canonicalEngineInputWriteAuthorized: false,
    financialEngineInputsWritten: false,
    automaticMethodSelection: false,
    automaticValuationWeighting: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function assertUpstreamIdentity(packet, caseId, propertyRef, kind) {
  if (!packet || typeof packet !== 'object') throw new TypeError(`${kind} is required`);
  if (packet.caseId !== caseId || packet.propertyRef !== propertyRef) {
    throw new TypeError(`CASE_OR_PROPERTY_ISOLATION_VIOLATION:${kind}`);
  }
}

function verifyWholeRecordHash(record,key){
 try{const {[key]:digest,...payload}=record;return typeof digest==='string'&&/^[a-f0-9]{64}$/.test(digest)&&sha256(payload)===digest;}catch{return false;}
}
const PROPERTY_PACKET_RESULT_FIELDS=['status','reasons','professionalValuationWorkflowReady','automaticUnderwritingAdoption','financialEngineInputsWritten','certifiedValuationEstablished','transactionAuthorized','semantics'];
function verifyPropertyPacketContent(packet){
 try{
  if(!Array.isArray(packet.reasons)||packet.reasons.length!==0||
    ['automaticUnderwritingAdoption','financialEngineInputsWritten','certifiedValuationEstablished','transactionAuthorized'].some(k=>packet[k]!==false))return false;
  const core=Object.fromEntries(Object.entries(packet).filter(([k])=>k!=='packetHashSha256'&&!PROPERTY_PACKET_RESULT_FIELDS.includes(k)));
  return sha256(core)===packet.packetHashSha256;
 }catch{return false;}
}
function validatePropertyEvidencePacket(propertyEvidencePacket, caseId, propertyRef) {
  assertUpstreamIdentity(propertyEvidencePacket, caseId, propertyRef, 'propertyEvidencePacket');
  assertSha256(propertyEvidencePacket.packetHashSha256, 'propertyEvidencePacket.packetHashSha256');
  return propertyEvidencePacket.status === PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW
    && propertyEvidencePacket.professionalValuationWorkflowReady === true
    && verifyPropertyPacketContent(propertyEvidencePacket);
}

function buildProfessionalMethodInputCandidate({
  caseId,
  propertyRef,
  method,
  propertyEvidencePacket,
  marketAdjustmentAnalysis = null,
  marketAnalysisSubjectBinding = null,
  incomeEvidencePacket = null,
  rateInputs = [],
  maximumRateAgeDaysByType = {},
  preparedByRef,
  preparedAt,
  preparationEvidenceRef,
} = {}) {
  assertNonEmpty(caseId, 'caseId');
  assertNonEmpty(propertyRef, 'propertyRef');
  assertEnum(method, VALUATION_METHOD, 'method');
  assertNonEmpty(preparedByRef, 'preparedByRef');
  assertNonEmpty(preparationEvidenceRef, 'preparationEvidenceRef');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  if (!Array.isArray(rateInputs)||rateInputs.length>50) throw new TypeError('rateInputs must be a bounded array');
  if (!maximumRateAgeDaysByType || typeof maximumRateAgeDaysByType !== 'object' || Array.isArray(maximumRateAgeDaysByType)) {
    throw new TypeError('maximumRateAgeDaysByType must be an object');
  }

  if (!validatePropertyEvidencePacket(propertyEvidencePacket, caseId, propertyRef)) {
    return hold(METHOD_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, ['PROPERTY_EVIDENCE_PACKET_NOT_READY'], { caseId, propertyRef, method });
  }
  const valuationDateIso = iso(propertyEvidencePacket.valuationDate, 'propertyEvidencePacket.valuationDate');
  if (Date.parse(preparedAtIso) < Date.parse(valuationDateIso)) throw new TypeError('METHOD_INPUT_PREPARATION_BEFORE_VALUATION_DATE');

  if (method === VALUATION_METHOD.SALES_COMPARISON) {
    if (!marketAdjustmentAnalysis || typeof marketAdjustmentAnalysis !== 'object') throw new TypeError('marketAdjustmentAnalysis is required');
    if (marketAdjustmentAnalysis.caseId !== caseId) throw new TypeError('CASE_ISOLATION_VIOLATION:marketAdjustmentAnalysis');
    assertSha256(marketAdjustmentAnalysis.analysisHashSha256, 'marketAdjustmentAnalysis.analysisHashSha256');
    assertUpstreamIdentity(marketAnalysisSubjectBinding, caseId, propertyRef, 'marketAnalysisSubjectBinding');
    if (!verifyMarketAnalysisSubjectBindingIntegrity(marketAnalysisSubjectBinding)) {
      return hold(METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, ['MARKET_ANALYSIS_SUBJECT_BINDING_INTEGRITY_FAILED'], { caseId, propertyRef, method });
    }
    if (marketAnalysisSubjectBinding.marketAdjustmentAnalysisHashSha256 !== marketAdjustmentAnalysis.analysisHashSha256) {
      return hold(METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, ['MARKET_ANALYSIS_SUBJECT_BINDING_HASH_MISMATCH'], { caseId, propertyRef, method });
    }
    if (Date.parse(marketAnalysisSubjectBinding.boundAt) > Date.parse(preparedAtIso)) {
      return hold(METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, ['MARKET_ANALYSIS_SUBJECT_BINDING_AFTER_METHOD_INPUT_PREPARATION'], { caseId, propertyRef, method });
    }
    if (marketAdjustmentAnalysis.status !== ADJUSTMENT_ANALYSIS_STATUS.READY_FOR_RECONCILIATION
        || marketAdjustmentAnalysis.reconciliationReady !== true||!verifyWholeRecordHash(marketAdjustmentAnalysis,'analysisHashSha256')||
        marketAdjustmentAnalysis.automaticValuationWeighting!==false||marketAdjustmentAnalysis.valuationConclusionProduced!==false||marketAdjustmentAnalysis.transactionAuthorized!==false||
        !Array.isArray(marketAdjustmentAnalysis.indications)||marketAdjustmentAnalysis.indications.length===0||marketAdjustmentAnalysis.indications.length>5000||
        new Set(marketAdjustmentAnalysis.indications.map(x=>x?.comparableId)).size!==marketAdjustmentAnalysis.indications.length||
        marketAdjustmentAnalysis.indications.some(x=>!nonEmpty(x?.comparableId)||!Number.isFinite(x.adjustedUnitValueSarPerSqm)||x.adjustedUnitValueSarPerSqm<=0)) {
      return hold(METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, ['MARKET_ADJUSTMENT_ANALYSIS_NOT_READY'], { caseId, propertyRef, method });
    }
  }

  if ([VALUATION_METHOD.DIRECT_CAPITALIZATION, VALUATION_METHOD.DISCOUNTED_CASH_FLOW].includes(method)) {
    assertUpstreamIdentity(incomeEvidencePacket, caseId, propertyRef, 'incomeEvidencePacket');
    assertSha256(incomeEvidencePacket.incomeEvidencePacketHashSha256, 'incomeEvidencePacket.incomeEvidencePacketHashSha256');
    if (incomeEvidencePacket.status !== LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF
        || incomeEvidencePacket.readyForIncomeAnalysisHandoff !== true||!verifyWholeRecordHash(incomeEvidencePacket,'incomeEvidencePacketHashSha256')||
        incomeEvidencePacket.noiCalculated!==false||incomeEvidencePacket.automaticDCFAdoption!==false||incomeEvidencePacket.financialEngineInputsWritten!==false||incomeEvidencePacket.transactionAuthorized!==false||
        !Number.isSafeInteger(incomeEvidencePacket.activeLeaseCount)||incomeEvidencePacket.activeLeaseCount<0||
        ![incomeEvidencePacket.occupiedAreaSqm,incomeEvidencePacket.annualContractRentSar].every(x=>Number.isFinite(x)&&x>=0)) {
      return hold(METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE, ['INCOME_EVIDENCE_PACKET_NOT_READY'], { caseId, propertyRef, method });
    }
  }

  const requiredRateTypes = REQUIRED_RATE_TYPES_BY_METHOD[method];
  const byType = new Map();
  const seenRateIds = new Set();
  const provenanceReasons = [];
  for (const rate of rateInputs) {
    if (!rate || rate.caseId !== caseId || rate.propertyRef !== propertyRef) {
      throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:rateInput');
    }
    assertEnum(rate.type, RATE_INPUT_TYPE, 'rateInput.type');
    if (!verifyProfessionalRateInputIntegrity(rate)) {
      provenanceReasons.push(`RATE_INPUT_INTEGRITY_FAILED:${rate.rateId || 'UNKNOWN'}`);
      continue;
    }
    if (seenRateIds.has(rate.rateId)) provenanceReasons.push(`DUPLICATE_RATE_ID:${rate.rateId}`);
    seenRateIds.add(rate.rateId);
    if (byType.has(rate.type)) provenanceReasons.push(`DUPLICATE_RATE_TYPE:${rate.type}`);
    else byType.set(rate.type, rate);
  }

  const completenessReasons = [];
  for (const type of requiredRateTypes) {
    const rate = byType.get(type);
    if (!rate) {
      completenessReasons.push(type === RATE_INPUT_TYPE.EXIT_CAP_RATE
        ? 'EXPLICIT_EXIT_CAP_RATE_REQUIRED'
        : `REQUIRED_RATE_INPUT_MISSING:${type}`);
      continue;
    }
    if (Date.parse(rate.reviewedAt) > Date.parse(preparedAtIso)) provenanceReasons.push(`RATE_REVIEW_AFTER_METHOD_INPUT_PREPARATION:${type}`);
    if (Date.parse(rate.asOfDate) > Date.parse(valuationDateIso)) provenanceReasons.push(`RATE_AS_OF_DATE_AFTER_VALUATION_DATE:${type}`);
    const maxAge = maximumRateAgeDaysByType[type];
    if (!Number.isInteger(maxAge) || maxAge < 0) {
      provenanceReasons.push(`RATE_FRESHNESS_POLICY_REQUIRED:${type}`);
    } else {
      const ageDays = daysBetween(rate.asOfDate, valuationDateIso);
      if (ageDays < 0 || ageDays > maxAge) provenanceReasons.push(`RATE_PROVENANCE_STALE:${type}:${ageDays}/${maxAge}`);
    }
  }

  if (provenanceReasons.length) {
    return hold(METHOD_INPUT_STATUS.HOLD_RATE_PROVENANCE, provenanceReasons, { caseId, propertyRef, method });
  }
  if (completenessReasons.length) {
    return hold(METHOD_INPUT_STATUS.HOLD_INPUT_COMPLETENESS, completenessReasons, { caseId, propertyRef, method });
  }

  const candidateCanonicalRateBindings = {};
  if (method === VALUATION_METHOD.DIRECT_CAPITALIZATION) {
    candidateCanonicalRateBindings.marketCapRate = byType.get(RATE_INPUT_TYPE.MARKET_CAP_RATE).value;
  } else if (method === VALUATION_METHOD.DISCOUNTED_CASH_FLOW) {
    candidateCanonicalRateBindings.discountRate = byType.get(RATE_INPUT_TYPE.DISCOUNT_RATE).value;
    candidateCanonicalRateBindings.exitCapRate = byType.get(RATE_INPUT_TYPE.EXIT_CAP_RATE).value;
  }

  const methodEvidence = method === VALUATION_METHOD.SALES_COMPARISON
    ? {
      marketAdjustmentAnalysisHashSha256: marketAdjustmentAnalysis.analysisHashSha256,
      marketAnalysisSubjectBindingHashSha256: marketAnalysisSubjectBinding.bindingHashSha256,
      adjustedComparableIndications: marketAdjustmentAnalysis.indications.map((item) => ({
        comparableId: item.comparableId,
        adjustedUnitValueSarPerSqm: item.adjustedUnitValueSarPerSqm,
        valuationWeight: null,
      })),
    }
    : {
      incomeEvidencePacketHashSha256: incomeEvidencePacket.incomeEvidencePacketHashSha256,
      activeLeaseCount: incomeEvidencePacket.activeLeaseCount,
      occupiedAreaSqm: incomeEvidencePacket.occupiedAreaSqm,
      annualContractRentSar: incomeEvidencePacket.annualContractRentSar,
      noi: null,
    };

  const rateProvenance = requiredRateTypes.map((type) => {
    const rate = byType.get(type);
    return {
      type,
      rateId: rate.rateId,
      value: rate.value,
      rateInputHashSha256: rate.rateInputHashSha256,
      source: rate.source,
      sourceLabel: rate.sourceLabel,
      rationale: rate.rationale,
      evidenceRefs: rate.evidenceRefs,
      asOfDate: rate.asOfDate,
      confidence: rate.confidence,
      reviewedByRef: rate.reviewedByRef,
      reviewedAt: rate.reviewedAt,
      reviewEvidenceRef: rate.reviewEvidenceRef,
      maximumAgeDays: maximumRateAgeDaysByType[type],
    };
  });

  const core = {
    schemaVersion: 1,
    caseId,
    propertyRef,
    method,
    propertyEvidencePacketHashSha256: propertyEvidencePacket.packetHashSha256,
    valuationDate: valuationDateIso,
    basisOfValue: propertyEvidencePacket.basisOfValue,
    purpose: propertyEvidencePacket.purpose,
    methodEvidence,
    rateProvenance,
    candidateCanonicalRateBindings,
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    preparationEvidenceRef: preparationEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    methodInputPacketHashSha256: sha256(core),
    status: METHOD_INPUT_STATUS.READY_FOR_CANONICAL_ENGINE_ADOPTION_REVIEW,
    sourceReplayEstablished:false,
    independentlyAuthenticatedSources:false,
    reasons: [],
    readyForCanonicalEngineAdoptionReview: true,
    explicitHumanAdoptionRequired: true,
    canonicalCalculationEngineRemainsAuthoritative: true,
    canonicalEngineInputWriteAuthorized: false,
    financialEngineInputsWritten: false,
    automaticMethodSelection: false,
    automaticValuationWeighting: false,
    valuationConclusionProduced: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet binds professionally reviewed evidence and rate provenance into candidate method inputs only. It does not write the canonical engine, derive missing rates, substitute marketCapRate for exitCapRate, infer the sales-analysis subject property, select a valuation method, weight indications, calculate a final value, certify a valuation, or authorize a transaction.',
  });
}


/** Strict handoff: regenerate all upstream calculations from supplied normalized source records.
 * This establishes semantic replay, not independent authentication or adoption authority. */
function buildProfessionalMethodInputPacket(options={}){
 const {caseId,propertyRef,method,propertyEvidencePacket,sourceInputs,preparedAt}=options;
 const context={caseId,propertyRef,method};
 const deny=(status,code)=>hold(status,[code],context);
 const propertyHold=code=>deny(METHOD_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE,code);
 const methodHold=code=>deny(METHOD_INPUT_STATUS.HOLD_METHOD_EVIDENCE,code);
 const market=require('../market');
 const {buildPropertyEvidencePacket}=require('../property/property-evidence-bridge');
 const equal=(a,b)=>sha256(a)===sha256(b);
 const bounded=a=>Array.isArray(a)&&a.length<=5000;
 const cutoff=strictCalendarDateMs(preparedAt);
 const known=d=>Number.isFinite(strictCalendarDateMs(d))&&strictCalendarDateMs(d)<=cutoff;
 const validDate=d=>Number.isFinite(strictCalendarDateMs(d));
 const p=sourceInputs?.property;
 if(!p||!bounded(p.evidenceRecords)||!bounded(p.measurementRecords)||p.caseId!==caseId||p.propertyRef!==propertyRef)
  return propertyHold('ORIGINAL_PROPERTY_SOURCE_INPUTS_REQUIRED');
 try{
  if(!Number.isFinite(cutoff)||!known(p.inspection?.completedAt)||!known(p.assignment?.report_date)||
     p.evidenceRecords.some(r=>!known(r.createdAt)||!known(r.fact?.capturedAt)||!known(r.fact?.verification?.verifiedAt)||!known(r.professionalReview?.reviewedAt))||
     p.measurementRecords.some(r=>!known(r.measuredAt)))return propertyHold('PROPERTY_SOURCES_NOT_KNOWN_AT_PREPARATION');
  const replay=buildPropertyEvidencePacket(p);
  if(replay.status!==PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW||!equal(replay,propertyEvidencePacket))return propertyHold('PROPERTY_SOURCE_REPLAY_MISMATCH');
 }catch{return propertyHold('PROPERTY_SOURCE_REPLAY_INVALID');}
 const valuationMs=strictCalendarDateMs(propertyEvidencePacket.valuationDate);
 let sourcePolicy;
 try{
  if(method===VALUATION_METHOD.SALES_COMPARISON){
   const m=sourceInputs?.market;
   if(!m||!bounded(m.records)||!bounded(m.adjustmentRecords)||!m.qualityPolicy||!m.selectionInput||!m.adjustmentPolicy)return methodHold('ORIGINAL_MARKET_SOURCE_INPUTS_REQUIRED');
   const q=m.qualityPolicy,s=m.selectionInput,ap=m.adjustmentPolicy;
   if(strictCalendarDateMs(q.asOfDate)!==valuationMs||q.targetTransactionType!=='SALE'||q.targetAssetType!==propertyEvidencePacket.assetType||!nonEmpty(q.targetCity)||
     !Number.isSafeInteger(q.minimumComparableCount)||q.minimumComparableCount<2||!Number.isSafeInteger(s.minimumSelectedCount)||s.minimumSelectedCount<2||
     ![market.MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION,market.MARKET_EVIDENCE_LEVEL.CONFIRMED_TRANSACTION].filter(Boolean).includes(q.minimumEvidenceLevel)||
     !known(s.selectedAt)||!known(options.marketAnalysisSubjectBinding?.boundAt)||strictCalendarDateMs(options.marketAnalysisSubjectBinding.boundAt)<strictCalendarDateMs(s.selectedAt))
    return methodHold('MARKET_SOURCE_SCOPE_OR_POLICY_INVALID');
   for(const r of m.records){
    market.assertComparableRecordIntegrity(r);
    const location={...r.location};if(location.lat===null)delete location.lat;if(location.long===null)delete location.long;
    if(!equal(r,market.createComparableEvidenceRecord({...r,location}))||!known(r.capturedAt)||!validDate(r.transactionDate)||!validDate(r.sourceDate)||
       strictCalendarDateMs(r.capturedAt)>strictCalendarDateMs(s.selectedAt)||r.sourcePropertyRef===propertyRef)return methodHold('MARKET_SOURCE_RECORD_INVALID');
   }
   for(const r of m.adjustmentRecords){
    if(!equal(r,market.createComparableAdjustmentRecord(r))||!known(r.reviewedAt)||!validDate(r.preparedAt)||
      strictCalendarDateMs(r.preparedAt)<strictCalendarDateMs(s.selectedAt)||strictCalendarDateMs(r.reviewedAt)>strictCalendarDateMs(options.marketAnalysisSubjectBinding.boundAt))return methodHold('MARKET_ADJUSTMENT_SOURCE_INVALID');
   }
   const quality=market.evaluateComparableSetQuality({...q,caseId,records:m.records});
   const selection=market.recordProfessionalComparableSelection({...s,caseId,records:m.records,qualityGate:quality});
   const analysis=market.buildComparableAdjustmentAnalysis({...ap,caseId,selection,records:m.records,adjustmentRecords:m.adjustmentRecords});
   if(analysis.status!==ADJUSTMENT_ANALYSIS_STATUS.READY_FOR_RECONCILIATION||!equal(analysis,options.marketAdjustmentAnalysis))return methodHold('MARKET_SOURCE_REPLAY_MISMATCH');
   sourcePolicy={qualityPolicy:q,selectionInput:s,adjustmentPolicy:ap};
  }else if([VALUATION_METHOD.DIRECT_CAPITALIZATION,VALUATION_METHOD.DISCOUNTED_CASH_FLOW].includes(method)){
   const l=sourceInputs?.income;
   if(!l||!bounded(l.leaseRecords)||!l.rentRollSnapshot||!l.policy)return methodHold('ORIGINAL_INCOME_SOURCE_INPUTS_REQUIRED');
   const q=l.policy;
   if(strictCalendarDateMs(q.asOfDate)!==valuationMs||q.requireVerifiedActiveLeases!==true||
     ![q.annualRentToleranceSar,q.occupiedAreaToleranceSqm].every(x=>Number.isFinite(x)&&x>=0))return methodHold('INCOME_SOURCE_SCOPE_OR_POLICY_INVALID');
   if(!equal(l.rentRollSnapshot,market.createVerifiedRentRollSnapshot(l.rentRollSnapshot))||!known(l.rentRollSnapshot.capturedAt)||!known(l.rentRollSnapshot.verification?.verifiedAt))return methodHold('RENT_ROLL_SOURCE_INVALID');
   for(const r of l.leaseRecords)if(!equal(r,market.createLeaseEvidenceRecord(r))||!known(r.capturedAt)||
    !validDate(r.startDate)||!validDate(r.expiryDate)||(r.verification.status==='VERIFIED'&&!known(r.verification.verifiedAt)))return methodHold('LEASE_SOURCE_INVALID');
   const replay=market.reconcileLeaseIncomeEvidence({...q,caseId,propertyRef,leaseRecords:l.leaseRecords,rentRollSnapshot:l.rentRollSnapshot});
   if(replay.status!==LEASE_INCOME_GATE_STATUS.READY_FOR_INCOME_ANALYSIS_HANDOFF||!equal(replay,options.incomeEvidencePacket))return methodHold('INCOME_SOURCE_REPLAY_MISMATCH');
   sourcePolicy=q;
  }else return methodHold('METHOD_SOURCE_REPLAY_UNSUPPORTED');
 }catch{return methodHold('METHOD_SOURCE_REPLAY_INVALID');}
 const candidate=buildProfessionalMethodInputCandidate(options);
 if(!candidate.readyForCanonicalEngineAdoptionReview)return candidate;
 try{
  const verified={...candidate,sourceReplayEstablished:true,sourceReplayPolicyHashSha256:sha256(sourcePolicy),sourceReplayInputHashSha256:sha256(sourceInputs),independentlyAuthenticatedSources:false};
  return deepFreeze({...verified,sourceReplayBindingSha256:sha256(verified)});
 }catch{return methodHold('METHOD_SOURCE_BINDING_INVALID');}
}

module.exports = {
  VALUATION_METHOD,
  RATE_INPUT_TYPE,
  RATE_SOURCE,
  RATE_CONFIDENCE,
  METHOD_INPUT_STATUS,
  REQUIRED_RATE_TYPES_BY_METHOD,
  createProfessionalRateInput,
  verifyProfessionalRateInputIntegrity,
  createMarketAnalysisSubjectBinding,
  verifyMarketAnalysisSubjectBindingIntegrity,
  buildProfessionalMethodInputPacket,
  buildProfessionalMethodInputCandidate,
};

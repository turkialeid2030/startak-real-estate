'use strict';
const {isPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {toHalalas,fromHalalas}=require('../validation/governed-sar-halala');
function plainObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v)&&isPlainJson(v);}
function immutableSnapshot(v){if(Array.isArray(v))return Object.freeze(v.map(immutableSnapshot));if(v&&typeof v==='object')return Object.freeze(Object.fromEntries(Object.keys(v).map(k=>[k,immutableSnapshot(v[k])])));return v;}
function weightUnits(v){if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>1)return null;const n=Math.round(v*1000000);return n/1000000===v&&n>0?n:null;}

const {
  RECOGNIZED_METHOD_MODELS_BY_VERSION,
} = require('../contracts/valuation-reconciliation');

const C3_SANDBOX_VALUATION_RECONCILIATION_DRAFT_VERSION = 'C3_SANDBOX_VALUATION_RECONCILIATION_DRAFT_V1';

const METHOD_RESERVED_TRUST_FIELDS = Object.freeze([
  'verifiedBy',
  'verificationReference',
  'verifiedAt',
  'eligible',
  'decisionReady',
  'certifiedValuationEstablished',
  'transactionAuthorized',
  'publicAiAuthorized',
]);

const INSTRUCTION_RESERVED_TRUST_FIELDS = Object.freeze([
  'reconciledBy',
  'reconciliationReference',
  'reconciledAt',
  'decisionReady',
  'certifiedValuationEstablished',
  'transactionAuthorized',
  'publicAiAuthorized',
]);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function rejectReserved(raw, reserved, label) {
  const attempted = reserved.filter((field) => Object.prototype.hasOwnProperty.call(raw, field));
  if (attempted.length) throw new TypeError(`${label} cannot set trust/authority fields: ${attempted.join(',')}`);
}

function createSandboxMethodIndicationDraft(raw = {}) {
  if (!plainObject(raw)) throw new TypeError('sandbox method indication draft input must be an object');
  rejectReserved(raw, METHOD_RESERVED_TRUST_FIELDS, 'sandbox method indication');

  const sourceResult = raw.sourceResult;
  if (!sourceResult || typeof sourceResult !== 'object' || Array.isArray(sourceResult)) {
    throw new TypeError('sandbox method indication requires sourceResult');
  }
  const modelVersion = cleanString(sourceResult.modelVersion);
  const model = RECOGNIZED_METHOD_MODELS_BY_VERSION[modelVersion];
  if (!model) throw new TypeError(`unsupported method model version: ${modelVersion || 'MISSING'}`);

  return Object.freeze({
    draftVersion: C3_SANDBOX_VALUATION_RECONCILIATION_DRAFT_VERSION,
    id: cleanString(raw.id) || null,
    sourceResult: immutableSnapshot(sourceResult),
    recognizedApproachFamily: model.approachFamily,
    recognizedValueScope: model.valueScope,
    recognizedModelVersion: modelVersion,
    verifiedBy: null,
    verificationReference: null,
    verifiedAt: null,
    sandboxOnly: true,
    eligible: false,
    decisionReady: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'Sandbox method draft only. Recognition of a model version and value scope does not verify the result, its source hash, its evidence dependencies or its professional suitability for reconciliation.',
  });
}

function createSandboxReconciliationInstructionDraft(raw = {}) {
  if (!plainObject(raw)) throw new TypeError('sandbox reconciliation instruction draft input must be an object');
  rejectReserved(raw, INSTRUCTION_RESERVED_TRUST_FIELDS, 'sandbox reconciliation instruction');

  const weights = raw.weightsByIndicationId;
  if (weights !== undefined && (!plainObject(weights)||Object.keys(weights).length>100||Object.entries(weights).some(([id,w])=>!id.trim()||weightUnits(w)===null))) {
    throw new TypeError('weightsByIndicationId must be an object when supplied');
  }

  return Object.freeze({
    draftVersion: C3_SANDBOX_VALUATION_RECONCILIATION_DRAFT_VERSION,
    instructionId: cleanString(raw.instructionId) || null,
    rationale: cleanString(raw.rationale) || null,
    weightsByIndicationId: weights ? Object.freeze({ ...weights }) : Object.freeze({}),
    proposedByRef: cleanString(raw.proposedByRef) || null,
    reconciledBy: null,
    reconciliationReference: null,
    reconciledAt: null,
    sandboxOnly: true,
    decisionReady: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    publicAiAuthorized: false,
    semantics: 'Sandbox reconciliation instruction draft only. Proposed weights and rationale remain unverified and cannot create professional reconciliation authority or decision readiness.',
  });
}

// Only an explicit hypothetical preview; never promotes draft trust.
function previewSandboxReconciliation(input={}){
 const result=(issues,value=null,trace=[])=>immutableSnapshot({status:issues.length?'HOLD_SANDBOX_PREVIEW':'SANDBOX_PREVIEW_ONLY',issues,weightedHypotheticalValueSar:value,trace,sandboxOnly:true,sourceAuthenticityIndependentlyVerified:false,automaticWeightsGenerated:false,decisionReady:false,eligible:false,certifiedValuationEstablished:false,transactionAuthorized:false,publicAiAuthorized:false});
 if(!plainObject(input))return result(['C3_SANDBOX_INPUT_INVALID']);
 const {propertyRef,valuationDate,methodDrafts,instructionDraft}=input;
 if(!cleanString(propertyRef)||!Number.isFinite(strictCalendarDateMs(valuationDate))||strictCalendarDateMs(valuationDate)>Date.now())return result(['C3_SANDBOX_SCOPE_REQUIRED']);
 if(!Array.isArray(methodDrafts)||methodDrafts.length<2||methodDrafts.length>100||!plainObject(instructionDraft))return result(['C3_SANDBOX_METHODS_AND_INSTRUCTION_REQUIRED']);
 if(instructionDraft.sandboxOnly!==true||instructionDraft.decisionReady!==false||instructionDraft.transactionAuthorized!==false||instructionDraft.certifiedValuationEstablished!==false||instructionDraft.publicAiAuthorized!==false||instructionDraft.reconciledBy!==null||instructionDraft.reconciliationReference!==null||instructionDraft.reconciledAt!==null||!cleanString(instructionDraft.rationale)||!plainObject(instructionDraft.weightsByIndicationId))return result(['C3_SANDBOX_INSTRUCTION_INVALID']);
 const weights=instructionDraft.weightsByIndicationId,seen=new Set(),families=new Set(),scopes=new Set(),trace=[];
 let sum=0,weighted=0n;
 for(const d of methodDrafts){
   if(!plainObject(d)||d.sandboxOnly!==true||d.eligible!==false||d.decisionReady!==false||d.transactionAuthorized!==false||d.certifiedValuationEstablished!==false||d.publicAiAuthorized!==false||d.verifiedBy!==null||d.verificationReference!==null||d.verifiedAt!==null||!cleanString(d.id)||seen.has(d.id))return result(['C3_SANDBOX_METHOD_DRAFT_INVALID']);
   const x=d.sourceResult,model=x&&RECOGNIZED_METHOD_MODELS_BY_VERSION[x.modelVersion];
   if(!model||d.recognizedModelVersion!==x.modelVersion||d.recognizedApproachFamily!==model.approachFamily||d.recognizedValueScope!==model.valueScope||!model.acceptedStatuses.includes(x.status)||x[model.indicationTypeField]!==model.expectedIndicationType||x.propertyRef!==propertyRef||strictCalendarDateMs(x.valuationDate)!==strictCalendarDateMs(valuationDate)||x.finalValuationConclusionEstablished!==false||x.certifiedValuationEstablished!==false||x.transactionAuthorized!==false)return result(['C3_SANDBOX_METHOD_SCOPE_OR_STATUS_INVALID']);
   if(!Object.hasOwn(weights,d.id))return result(['C3_SANDBOX_EXPLICIT_WEIGHT_REQUIRED']);
   const n=toHalalas(x[model.valueField]),w=weightUnits(weights[d.id]);
   if(n===null||n===0||w===null)return result(['C3_SANDBOX_VALUE_OR_WEIGHT_INVALID']);
   seen.add(d.id);families.add(model.approachFamily);scopes.add(model.valueScope);sum+=w;weighted+=BigInt(n)*BigInt(w);
   trace.push({id:d.id,approachFamily:model.approachFamily,valueScope:model.valueScope,valueSar:x[model.valueField],weight:weights[d.id]});
 }
 if(Object.keys(weights).length!==seen.size||sum!==1000000||families.size<2||scopes.size!==1)return result(['C3_SANDBOX_WEIGHTS_OR_SCOPE_NOT_COMPARABLE']);
 const value=fromHalalas(Number((weighted+500000n)/1000000n));
 return value===null?result(['C3_SANDBOX_UNSAFE_TOTAL']):result([],value,trace);
}
module.exports = {
  previewSandboxReconciliation,
  C3_SANDBOX_VALUATION_RECONCILIATION_DRAFT_VERSION,
  METHOD_RESERVED_TRUST_FIELDS,
  INSTRUCTION_RESERVED_TRUST_FIELDS,
  createSandboxMethodIndicationDraft,
  createSandboxReconciliationInstructionDraft,
};

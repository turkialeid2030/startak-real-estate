'use strict';
const {assertPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {createEvidenceAwareValue,createEvidenceLineageRecord}=require('./contracts');
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
function sameCanonicalStrategicValue(a,b){try{assertPlainJson(a);assertPlainJson(b);return JSON.stringify(stable(a))===JSON.stringify(stable(b));}catch{return false;}}
const same=sameCanonicalStrategicValue;
function isSafeStrategicCase(x){try{assertPlainJson(x,{maxNodes:500000});return !!x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.caseId==='string'&&!!x.caseId.trim()&&Array.isArray(x.additionalOperatingInputs)&&x.additionalOperatingInputs.length<=5000&&Array.isArray(x.evidenceLineage)&&x.evidenceLineage.length<=10000;}catch{return false;}}
function lineageIssues(operatingCase){
 const issues=[],seen=new Set(),cutoff=strictCalendarDateMs(operatingCase.asOfDate),canonical=operatingCase.contractType==='RESIDENTIAL_INCOME_OPERATING_CASE_V1';
 if(!Number.isFinite(cutoff)||cutoff>Date.now())issues.push({code:'STRATEGIC_AS_OF_INVALID'});
 for(const x of operatingCase.evidenceLineage){
   if(!x||typeof x.refId!=='string'||!x.refId.trim()||seen.has(x.refId)){issues.push({code:'STRATEGIC_LINEAGE_DUPLICATE_OR_INVALID',refId:x?.refId??null});continue;}seen.add(x.refId);
   if((canonical||Object.hasOwn(x,'caseId'))&&x.caseId!==operatingCase.caseId)issues.push({code:'STRATEGIC_LINEAGE_CASE_MISMATCH',refId:x.refId});
   if(canonical||Object.hasOwn(x,'recordedAt')){const dt=strictCalendarDateMs(x.recordedAt);if(!Number.isFinite(dt)||dt>cutoff)issues.push({code:'STRATEGIC_LINEAGE_WINDOW_INVALID',refId:x.refId});}
   if(canonical){try{if(!same(x,createEvidenceLineageRecord(x)))throw Error();}catch{issues.push({code:'STRATEGIC_LINEAGE_CANONICAL_MISMATCH',refId:x.refId});}}
 }
 return issues;
}

const STRATEGIC_EVIDENCE_STATUS = Object.freeze({
  NOT_ASSESSED: 'NOT_ASSESSED',
  COMPLIANT: 'COMPLIANT',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});

const STRATEGIC_INPUT_PREFIXES = Object.freeze([
  'lifecycle.',
  'location.',
  'forward.',
  'upside.',
]);

const ADOPTABLE_STATUSES = new Set(['VERIFIED_FACT', 'OBSERVED', 'ASSUMED']);
const SOURCE_LINEAGE_KINDS = new Set([
  'SOURCE_DOCUMENT',
  'EVIDENCE_FACT',
  'HUMAN_VERIFICATION',
  'POLICY',
  'ANALYTICAL_ASSESSMENT',
  'LEGAL_REVIEW',
  'OTHER',
]);
const ADOPTION_LINEAGE_KIND = 'UNDERWRITING_ADOPTION';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStrategicField(field) {
  return typeof field === 'string' && STRATEGIC_INPUT_PREFIXES.some((prefix) => field.startsWith(prefix));
}

function buildLineageMap(operatingCase) {
  const map = new Map();
  const records = Array.isArray(operatingCase && operatingCase.evidenceLineage)
    ? operatingCase.evidenceLineage
    : [];
  for (const record of records) {
    if (record && typeof record.refId === 'string' && !map.has(record.refId)) map.set(record.refId, record);
  }
  return map;
}

function groupByField(inputs) {
  const groups = new Map();
  for (const input of inputs) {
    if (!groups.has(input.field)) groups.set(input.field, []);
    groups.get(input.field).push(input);
  }
  return groups;
}

function assessAdoptedInput(input, lineageByRef, asOfDate, duplicate,canonical=false) {
  const issues = [];
  const field = input.field;
  if (duplicate) issues.push({ code: 'STRATEGIC_INPUT_DUPLICATE_FIELD', field });
  if(canonical){try{if(!same(input,createEvidenceAwareValue(input)))throw Error();}catch{issues.push({code:'STRATEGIC_INPUT_CANONICAL_MISMATCH',field});}}
  if (!ADOPTABLE_STATUSES.has(input.verificationStatus)) {
    issues.push({ code: 'STRATEGIC_INPUT_VERIFICATION_STATUS_INVALID', field, verificationStatus: input.verificationStatus || null });
  }
  if (!finite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    issues.push({ code: 'STRATEGIC_INPUT_CONFIDENCE_INVALID', field });
  }

  const source = input.sourceRef ? lineageByRef.get(input.sourceRef) : null;
  if (!source || !SOURCE_LINEAGE_KINDS.has(source.kind)) {
    issues.push({ code: 'STRATEGIC_SOURCE_LINEAGE_REQUIRED', field, refId: input.sourceRef || null });
  }

  const adoption = input.adoptionDecisionRef ? lineageByRef.get(input.adoptionDecisionRef) : null;
  if (!adoption || adoption.kind !== ADOPTION_LINEAGE_KIND) {
    issues.push({ code: 'STRATEGIC_ADOPTION_LINEAGE_REQUIRED', field, refId: input.adoptionDecisionRef || null });
  }

  for (const refId of Array.isArray(input.lineageRefs) ? input.lineageRefs : []) {
    if (!lineageByRef.has(refId)) {
      issues.push({ code: 'STRATEGIC_LINEAGE_REFERENCE_MISSING', field, refId });
    }
  }

  if(input.verificationStatus==='ASSUMED'){
    const a=input.assumptionOverride;
    if(!a||typeof a.reason!=='string'||!a.reason.trim()||lineageByRef.get(a.approvedByRef)?.kind!=='HUMAN_IDENTITY'||lineageByRef.get(a.policyRef)?.kind!=='POLICY')issues.push({code:'STRATEGIC_ASSUMPTION_REVIEW_REQUIRED',field});
  }
  if (input.effectiveDate) {
    const effectiveTime = strictCalendarDateMs(input.effectiveDate);
    if (!Number.isFinite(effectiveTime)) {
      issues.push({ code: 'STRATEGIC_EFFECTIVE_DATE_INVALID', field });
    } else if (asOfDate) {
      const asOfTime = strictCalendarDateMs(asOfDate);
      if (Number.isFinite(asOfTime) && effectiveTime > asOfTime) {
        issues.push({ code: 'STRATEGIC_FUTURE_EFFECTIVE_EVIDENCE', field });
      }
    }
  }else issues.push({code:'STRATEGIC_EFFECTIVE_DATE_REQUIRED',field});

  return {
    field,
    usable: issues.length === 0,
    verificationStatus: input.verificationStatus || null,
    confidence: finite(input.confidence) ? input.confidence : null,
    sourceRef: input.sourceRef || null,
    adoptionDecisionRef: input.adoptionDecisionRef || null,
    issues,
  };
}

function assessStrategicEvidenceGovernance(operatingCase) {
  if(!isSafeStrategicCase(operatingCase))return deepFreeze({schemaVersion:1,caseId:null,asOfDate:null,status:STRATEGIC_EVIDENCE_STATUS.REVIEW_REQUIRED,strategicInputCount:0,adoptedInputCount:0,usableAdoptedInputCount:0,evidenceCoverage:0,invalidInputFields:[],assessments:[],issues:[{code:'STRATEGIC_CASE_JSON_OR_SCOPE_INVALID'}],caseIntegrityReady:false,automaticFinancializationAllowed:false,legalConclusion:null,investmentRecommendation:null});
  const globalIssues=lineageIssues(operatingCase);
  const inputs = (Array.isArray(operatingCase.additionalOperatingInputs) ? operatingCase.additionalOperatingInputs : [])
    .filter((input) => input && isStrategicField(input.field));
  if (!inputs.length) {
    return deepFreeze({
      schemaVersion: 1,
      caseId: operatingCase.caseId || null,
      asOfDate: operatingCase.asOfDate || null,
      status: STRATEGIC_EVIDENCE_STATUS.NOT_ASSESSED,
      strategicInputCount: 0,
      adoptedInputCount: 0,
      usableAdoptedInputCount: 0,
      evidenceCoverage: 0,
      invalidInputFields: [],
      assessments: [],
      issues: [{ code: 'STRATEGIC_EVIDENCE_NOT_ASSESSED', field: 'lifecycle.|location.|forward.|upside.*' }],
      automaticFinancializationAllowed: false,
      legalConclusion: null,
      investmentRecommendation: null,
      semantics: 'No strategic operating inputs were supplied. No lifecycle, location, forward-attraction, or upside signal may be treated as evidence-governed.',
    });
  }

  const adoptedInputs = inputs.filter((input) => input.adoptedForUnderwriting === true);
  const lineageByRef = buildLineageMap(operatingCase);
  const groups = groupByField(inputs);
  const assessments = adoptedInputs.map((input) => assessAdoptedInput(
    input,
    lineageByRef,
    operatingCase.asOfDate || null,
    (groups.get(input.field) || []).length > 1,
    operatingCase.contractType==='RESIDENTIAL_INCOME_OPERATING_CASE_V1',
  ));
  if(globalIssues.length)for(const a of assessments){a.usable=false;a.issues.push({code:'STRATEGIC_CASE_INTEGRITY_REQUIRED',field:a.field});}
  const issues = [...globalIssues,...assessments.flatMap((assessment) => assessment.issues)];
  const usable = assessments.filter((assessment) => assessment.usable);
  const invalidInputFields = [...new Set(assessments.filter((assessment) => !assessment.usable).map((assessment) => assessment.field))];

  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId || null,
    asOfDate: operatingCase.asOfDate || null,
    status: issues.length === 0 && adoptedInputs.length > 0
      ? STRATEGIC_EVIDENCE_STATUS.COMPLIANT
      : STRATEGIC_EVIDENCE_STATUS.REVIEW_REQUIRED,
    caseIntegrityReady:globalIssues.length===0,
    sourceAuthenticityIndependentlyVerified:false,
    strategicInputCount: inputs.length,
    adoptedInputCount: adoptedInputs.length,
    usableAdoptedInputCount: usable.length,
    evidenceCoverage: adoptedInputs.length > 0 ? usable.length / adoptedInputs.length : 0,
    invalidInputFields,
    assessments,
    issues,
    automaticFinancializationAllowed: false,
    legalConclusion: null,
    investmentRecommendation: null,
    semantics: 'Only adopted strategic inputs with valid source lineage, explicit underwriting-adoption lineage, valid confidence, non-future effective dates, and no duplicate field can enter the strategic analytical engines. Invalid inputs fail closed and contribute no score or modeled upside.',
  });
}

function createEvidenceGovernedStrategicCase(operatingCase, _claimedGovernance) {
  // Recompute governance; no caller-provided COMPLIANT result can bypass checks.
  const governance=assessStrategicEvidenceGovernance(operatingCase);
  if(!isSafeStrategicCase(operatingCase))return {caseId:null,asOfDate:null,additionalOperatingInputs:[],evidenceLineage:[]};
  const invalid = new Set(governance.invalidInputFields || []);
  if (!invalid.size) return operatingCase;
  return {
    ...operatingCase,
    additionalOperatingInputs: (operatingCase.additionalOperatingInputs || []).map((input) => (
      input && invalid.has(input.field)
        ? { ...input, adoptedForUnderwriting: false }
        : input
    )),
  };
}

module.exports = {
  STRATEGIC_EVIDENCE_STATUS,
  STRATEGIC_INPUT_PREFIXES,
  isSafeStrategicCase,lineageIssues,sameCanonicalStrategicValue,
  assessStrategicEvidenceGovernance,
  createEvidenceGovernedStrategicCase,
};

'use strict';

const crypto=require('crypto');
const CAPABILITY='C51_INTERNAL_HISTORICAL_REPLAY_READINESS_V1';
const POLICY_VERSION='C51_HISTORICAL_REPLAY_EVIDENCE_PREP_V1';
const GATE_ID='550';
const EVIDENCE_ID='HISTORICAL_REPLAY_EVIDENCE';
const STATUS=Object.freeze({READY_FOR_INDEPENDENT_HISTORICAL_REPLAY:'READY_FOR_INDEPENDENT_HISTORICAL_REPLAY',READY_FOR_C30_GATE_INGESTION:'READY_FOR_C30_GATE_INGESTION',HOLD_INTEGRITY:'HOLD_INTEGRITY',HOLD_CONFIGURATION:'HOLD_CONFIGURATION',HOLD_WINDOW:'HOLD_WINDOW',HOLD_EXTERNAL_HISTORICAL_REPLAY:'HOLD_EXTERNAL_HISTORICAL_REPLAY',REJECTED:'REJECTED'});
const EXTERNAL_STATUS=Object.freeze({NOT_SUPPLIED:'NOT_SUPPLIED',SUPPLIED_VERIFIED:'SUPPLIED_VERIFIED',REJECTED:'REJECTED'});
const HASH_RE=/^[a-f0-9]{64}$/i, COMMIT_RE=/^[a-f0-9]{40}$/i;
const nonEmpty=v=>typeof v==='string'&&v.trim().length>0, clean=v=>nonEmpty(v)?v.trim():'';
function stable(v){if(Array.isArray(v))return v.map(stable);if(!v||typeof v!=='object')return v;return Object.keys(v).sort().reduce((o,k)=>{o[k]=stable(v[k]);return o;},{});} function sha256(v){return crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');}
function frozen(v){if(!v||typeof v!=='object'||Object.isFrozen(v))return v;Object.values(v).forEach(frozen);return Object.freeze(v);} function iso(v,f){if(!nonEmpty(v)||!Number.isFinite(Date.parse(v)))throw new TypeError(`${f} must be a valid date/time`);return new Date(v).toISOString();}
function commit(v,f){const x=clean(v).toLowerCase();if(!COMMIT_RE.test(x))throw new TypeError(`${f} must be a 40-character Git commit SHA`);return x;} function hash(v,f){const x=clean(v).toLowerCase();if(!HASH_RE.test(x))throw new TypeError(`${f} must be SHA-256`);return x;}
function integrity(v,f){if(!v||typeof v!=='object')return false;const h=clean(v[f]).toLowerCase();if(!HASH_RE.test(h))return false;const o={...v};delete o[f];return sha256(o)===h;}

function createHistoricalReplayPlan(input={}){
  const candidateHeadSha=commit(input.candidateHeadSha,'candidateHeadSha');
  if(!nonEmpty(input.productScopeRef)||!nonEmpty(input.replayMethodRef))throw new TypeError('C51_PLAN_SCOPE_AND_METHOD_REQUIRED');
  if(!Array.isArray(input.predeclaredMeasures)||input.predeclaredMeasures.length<1||input.predeclaredMeasures.some(m=>!nonEmpty(m.measureId)||!nonEmpty(m.definitionRef)))throw new TypeError('C51_PREDECLARED_MEASURES_REQUIRED');
  const measures=input.predeclaredMeasures.map(m=>({measureId:m.measureId.trim(),definitionRef:m.definitionRef.trim()})).sort((a,b)=>a.measureId.localeCompare(b.measureId));
  if(new Set(measures.map(m=>m.measureId)).size!==measures.length)throw new TypeError('C51_DUPLICATE_MEASURE_ID');
  const preparedAt=iso(input.preparedAt,'preparedAt'),validUntil=iso(input.validUntil,'validUntil');if(Date.parse(validUntil)<Date.parse(preparedAt))throw new TypeError('C51_PLAN_VALIDITY_INVALID');
  const core={schemaVersion:1,candidateHeadSha,productScopeRef:input.productScopeRef.trim(),replayMethodRef:input.replayMethodRef.trim(),predeclaredMeasures:measures,preparedAt,validUntil,syntheticCasesAcceptedAsHistoricalEvidence:false,historicalReplayApproved:false,deploymentAuthorized:false,commercialGoLiveAuthorized:false};
  return frozen({...core,planHashSha256:sha256(core)});
}
function verifyHistoricalReplayPlan(v){return integrity(v,'planHashSha256');}

function createExternalHistoricalReplayRecord(input={}){
  if(!Object.values(EXTERNAL_STATUS).includes(input.status))throw new TypeError('C51_EXTERNAL_STATUS_INVALID'); if(input.evidenceId!==EVIDENCE_ID)throw new TypeError('C51_EVIDENCE_ID_INVALID');
  const core={schemaVersion:1,evidenceId:EVIDENCE_ID,gateId:GATE_ID,candidateHeadSha:commit(input.candidateHeadSha,'candidateHeadSha'),status:input.status,evidenceRef:null,evidenceHashSha256:null,verifiedByRef:null,verifiedAt:null,validUntil:null,replayMethodRef:null,predeclaredMeasuresRef:null,cases:[],materialDeviationDispositionRef:null,reasonCode:null,syntheticHarnessTreatedAsHistoricalEvidence:false};
  if(input.status===EXTERNAL_STATUS.NOT_SUPPLIED){if(['evidenceRef','evidenceHashSha256','verifiedByRef','verifiedAt'].some(f=>input[f]))throw new TypeError('C51_NOT_SUPPLIED_MUST_NOT_CARRY_SYNTHETIC_REPLAY_EVIDENCE');if(!nonEmpty(input.reasonCode))throw new TypeError('C51_NOT_SUPPLIED_REASON_REQUIRED');core.reasonCode=input.reasonCode.trim();}
  else{
    for(const f of ['evidenceRef','verifiedByRef','verifiedAt','replayMethodRef','predeclaredMeasuresRef','materialDeviationDispositionRef'])if(!nonEmpty(input[f]))throw new TypeError(`C51_${f}_REQUIRED`);
    if(!Array.isArray(input.cases)||input.cases.length<1)throw new TypeError('C51_REAL_HISTORICAL_CASES_REQUIRED');
    const cases=input.cases.map(c=>{if(!c||!nonEmpty(c.caseId)||!nonEmpty(c.provenanceRef)||!nonEmpty(c.historicalObservationDate)||!nonEmpty(c.historicalTruthOutcomeRef)||!nonEmpty(c.systemReplayResultRef)||!nonEmpty(c.deviationReviewRef)||c.synthetic!==false)throw new TypeError('C51_REAL_CASE_FIELDS_REQUIRED');return {caseId:c.caseId.trim(),provenanceRef:c.provenanceRef.trim(),historicalObservationDate:iso(c.historicalObservationDate,'historicalObservationDate'),historicalTruthOutcomeRef:c.historicalTruthOutcomeRef.trim(),systemReplayResultRef:c.systemReplayResultRef.trim(),deviationReviewRef:c.deviationReviewRef.trim(),synthetic:false};}).sort((a,b)=>a.caseId.localeCompare(b.caseId));
    if(new Set(cases.map(c=>c.caseId)).size!==cases.length)throw new TypeError('C51_DUPLICATE_CASE_ID');
    core.evidenceRef=input.evidenceRef.trim();core.evidenceHashSha256=hash(input.evidenceHashSha256,'evidenceHashSha256');core.verifiedByRef=input.verifiedByRef.trim();core.verifiedAt=iso(input.verifiedAt,'verifiedAt');core.validUntil=input.validUntil?iso(input.validUntil,'validUntil'):null;if(core.validUntil&&Date.parse(core.validUntil)<Date.parse(core.verifiedAt))throw new TypeError('C51_EXTERNAL_VALIDITY_INVALID');
    core.replayMethodRef=input.replayMethodRef.trim();core.predeclaredMeasuresRef=input.predeclaredMeasuresRef.trim();core.cases=cases;core.materialDeviationDispositionRef=input.materialDeviationDispositionRef.trim();
    if(input.status===EXTERNAL_STATUS.REJECTED){if(!nonEmpty(input.reasonCode))throw new TypeError('C51_REJECTION_REASON_REQUIRED');core.reasonCode=input.reasonCode.trim();}
  }
  return frozen({...core,recordHashSha256:sha256(core)});
}
function verifyExternalHistoricalReplayRecord(v){return integrity(v,'recordHashSha256');}

function evaluateInternalHistoricalReplayReadiness({replayPlan,asOf}={}){const at=iso(asOf,'asOf'),blockers=[];if(!verifyHistoricalReplayPlan(replayPlan))blockers.push('C51_INTEGRITY_REPLAY_PLAN');else{if(Date.parse(replayPlan.preparedAt)>Date.parse(at))blockers.push('C51_WINDOW_PLAN_FUTURE');if(Date.parse(replayPlan.validUntil)<Date.parse(at))blockers.push('C51_WINDOW_PLAN_EXPIRED');if(replayPlan.syntheticCasesAcceptedAsHistoricalEvidence!==false||replayPlan.historicalReplayApproved!==false)blockers.push('C51_CONFIGURATION_AUTHORITY_INJECTION');}const u=[...new Set(blockers)].sort();const status=u.some(x=>x.startsWith('C51_INTEGRITY_'))?STATUS.HOLD_INTEGRITY:u.some(x=>x.startsWith('C51_WINDOW_'))?STATUS.HOLD_WINDOW:u.length?STATUS.HOLD_CONFIGURATION:STATUS.READY_FOR_INDEPENDENT_HISTORICAL_REPLAY;return frozen({capability:CAPABILITY,policyVersion:POLICY_VERSION,status,internalEngineeringReady:u.length===0,blockers:u,externalGateId:GATE_ID,historicalReplayApproved:false,deploymentAuthorized:false,commercialGoLiveAuthorized:false});}

function evaluateExternalHistoricalReplayForGateIngestion({replayPlan,replayRecord,asOf}={}){const at=iso(asOf,'asOf'),internal=evaluateInternalHistoricalReplayReadiness({replayPlan,asOf:at}),blockers=[...internal.blockers];if(!verifyExternalHistoricalReplayRecord(replayRecord))blockers.push('C51_INTEGRITY_EXTERNAL_REPLAY_RECORD');else{if(replayRecord.candidateHeadSha!==replayPlan.candidateHeadSha)blockers.push('C51_EXTERNAL_BINDING_MISMATCH:candidateHeadSha');if(replayRecord.gateId!==GATE_ID||replayRecord.evidenceId!==EVIDENCE_ID)blockers.push('C51_EXTERNAL_WRONG_GATE');if(replayRecord.status===EXTERNAL_STATUS.NOT_SUPPLIED)blockers.push('C51_EXTERNAL_HISTORICAL_REPLAY_NOT_SUPPLIED');if(replayRecord.status===EXTERNAL_STATUS.REJECTED)blockers.push(`C51_EXTERNAL_HISTORICAL_REPLAY_REJECTED:${replayRecord.reasonCode||'UNSPECIFIED'}`);if(replayRecord.status===EXTERNAL_STATUS.SUPPLIED_VERIFIED){if(replayRecord.replayMethodRef!==replayPlan.replayMethodRef)blockers.push('C51_EXTERNAL_METHOD_MISMATCH');if(replayRecord.cases.some(c=>c.synthetic!==false))blockers.push('C51_EXTERNAL_SYNTHETIC_CASE_PRESENT');if(Date.parse(replayRecord.verifiedAt)>Date.parse(at))blockers.push('C51_EXTERNAL_REPLAY_FUTURE');if(replayRecord.validUntil&&Date.parse(replayRecord.validUntil)<Date.parse(at))blockers.push('C51_EXTERNAL_REPLAY_EXPIRED');}}
  const u=[...new Set(blockers)].sort(),rejected=u.some(x=>x.startsWith('C51_EXTERNAL_HISTORICAL_REPLAY_REJECTED:')),complete=u.length===0&&replayRecord.status===EXTERNAL_STATUS.SUPPLIED_VERIFIED;return frozen({capability:CAPABILITY,policyVersion:POLICY_VERSION,status:rejected?STATUS.REJECTED:complete?STATUS.READY_FOR_C30_GATE_INGESTION:STATUS.HOLD_EXTERNAL_HISTORICAL_REPLAY,readyForC30GateIngestion:complete,blockers:u,externalGateId:GATE_ID,independentAuthorityStillMustBeValidatedByC30:true,historicalReplayApproved:false,deploymentAuthorized:false,commercialGoLiveAuthorized:false});}

module.exports=Object.freeze({CAPABILITY,POLICY_VERSION,GATE_ID,EVIDENCE_ID,STATUS,EXTERNAL_STATUS,createHistoricalReplayPlan,verifyHistoricalReplayPlan,createExternalHistoricalReplayRecord,verifyExternalHistoricalReplayRecord,evaluateInternalHistoricalReplayReadiness,evaluateExternalHistoricalReplayForGateIngestion});

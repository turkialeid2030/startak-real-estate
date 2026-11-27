'use strict';
// C9 planning evidence -> a *non-authoritative* rectangular plot envelope.
// This module never authenticates an issuer, grants a permit, selects HBU,
// certifies a valuation or writes any financial engine input.
const crypto = require('node:crypto');
const { strictCalendarDateMs } = require('../validation/strict-calendar-instant');
const {assertPlainJson}=require('../validation/plain-json-boundary');
const { assessTitleCrossDocumentConsistency } = require('../title-intelligence/cross-document-consistency');
const {
  PLANNING_CONSTRAINT_TYPE: TYPE,
  PLANNING_EVIDENCE_STATUS, PLANNING_AUTHORITY_CLASS, assessPlanningEvidenceSet,
} = require('./planning-evidence');

const STATUS=Object.freeze({
  CANDIDATE_FOR_INDEPENDENT_PLANNING_REVIEW:'CANDIDATE_FOR_INDEPENDENT_PLANNING_REVIEW',
  HOLD_UPSTREAM:'HOLD_UPSTREAM',
  HOLD_BINDING:'HOLD_BINDING',
  HOLD_CONSTRAINTS:'HOLD_CONSTRAINTS',
  HOLD_GEOMETRY:'HOLD_GEOMETRY',
  HOLD_TITLE:'HOLD_TITLE',
  INFEASIBLE:'INFEASIBLE',
});
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
}
function sha(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function validDate(s){return Number.isFinite(strictCalendarDateMs(s));}
function positive(v){return typeof v==='number'&&Number.isFinite(v)&&v>0;}
function nonnegative(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0;}
function freeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
function output(status,caseId,propertyRef,reasons,calculations=null,sourceRefs=[]){
  return freeze({
    schemaVersion:1,status,caseId,propertyRef,
    blockers:[...new Set(reasons)].sort(),calculations,sourceRefs,
    verifiedDataSourceRights:false,officialPlanningApproval:false,
    surveyedGeometryIndependentlyVerified:false,
    professionalHbuApproval:false,buildingPermitEstablished:false,
    certifiedValuationEstablished:false,financialEngineInputsWritten:false,
    transactionAuthorized:false,
    semantics:'Illustrative plot-envelope arithmetic from caller-supplied, provenance-labelled evidence. It cannot authenticate a municipal code, surveyed parcel or professional approval.',
  });
}
function assessGuardedPlotEnvelope(input={}){
  try{assertPlainJson(input,{maxNodes:500000});if(!input||typeof input!=='object'||Array.isArray(input))throw Error('root');}catch{return output(STATUS.HOLD_BINDING,null,null,['PLOT_INPUT_JSON_INVALID']);}
  const {caseId,propertyRef,planningEvidenceSet,geometry,evaluatedAt,maxAreaDifferenceSqm,titleFacts,titleFreshnessPolicy,geometryMaxAgeDays,planningRecords}=input;
  if(typeof caseId!=='string'||!caseId.trim()||
     typeof propertyRef!=='string'||!propertyRef.trim())throw Error('CASE_PROPERTY_ID_REQUIRED');
  if(!validDate(evaluatedAt))throw Error('EVALUATION_DATE_REQUIRED');
  if(strictCalendarDateMs(evaluatedAt)>Date.now())return output(STATUS.HOLD_BINDING,caseId,propertyRef,['EVALUATION_DATE_IN_FUTURE']);
  if(!nonnegative(maxAreaDifferenceSqm))throw Error('EXPLICIT_AREA_TOLERANCE_REQUIRED');
  if(!nonnegative(geometryMaxAgeDays)||!Number.isFinite(geometryMaxAgeDays*86400000))throw Error('EXPLICIT_GEOMETRY_FRESHNESS_POLICY_REQUIRED');
  const bad=(status,...reasons)=>output(status,caseId,propertyRef,reasons);
  if(!planningEvidenceSet||typeof planningEvidenceSet!=='object'||
     planningEvidenceSet.caseId!==caseId||planningEvidenceSet.propertyRef!==propertyRef)
    return bad(STATUS.HOLD_BINDING,'PLANNING_CASE_OR_PROPERTY_MISMATCH');
  const {planningEvidenceSetHashSha256,...payload}=planningEvidenceSet;
  if(typeof planningEvidenceSetHashSha256!=='string'||
     !/^[a-f0-9]{64}$/i.test(planningEvidenceSetHashSha256)||
     sha(payload)!==planningEvidenceSetHashSha256.toLowerCase())
    return bad(STATUS.HOLD_BINDING,'PLANNING_SET_HASH_MISMATCH');
  if(planningEvidenceSet.status!==PLANNING_EVIDENCE_STATUS.READY_FOR_HBU_LEGAL_REVIEW||
     planningEvidenceSet.readyForHbuLegalReview!==true)
    return bad(STATUS.HOLD_UPSTREAM,'PLANNING_EVIDENCE_NOT_READY');
  if(!validDate(planningEvidenceSet.valuationDate)||
     strictCalendarDateMs(planningEvidenceSet.valuationDate)!==strictCalendarDateMs(evaluatedAt))
    return bad(STATUS.HOLD_BINDING,'PLANNING_VALUATION_DATE_MISMATCH');
  const required=[TYPE.FAR,TYPE.BCR,TYPE.SETBACK];
  if(!Array.isArray(planningEvidenceSet.requiredConstraintTypes)||!required.every(type=>planningEvidenceSet.requiredConstraintTypes.includes(type)))
    return bad(STATUS.HOLD_CONSTRAINTS,'MANDATORY_PLANNING_CONSTRAINT_NOT_REQUIRED');
  if(!Array.isArray(planningEvidenceSet.trace))return bad(STATUS.HOLD_CONSTRAINTS,'PLANNING_TRACE_INVALID');
  const picks={},sourceRefs=[];
  for(const type of required){
    const traces=(planningEvidenceSet.trace||[]).filter(x=>x.type===type);
    if(traces.length!==1||!Array.isArray(traces[0].values)||traces[0].values.length!==1)
      return bad(STATUS.HOLD_CONSTRAINTS,'MISSING_OR_AMBIGUOUS_CONSTRAINT:'+type);
    const x=traces[0].values[0];
    if(!x||typeof x.evidenceId!=='string'||!x.evidenceId||
       typeof x.sourceRef!=='string'||!x.sourceRef)
      return bad(STATUS.HOLD_CONSTRAINTS,'SOURCE_PROVENANCE_MISSING:'+type);
    picks[type]=x;sourceRefs.push({type,evidenceId:x.evidenceId,sourceRef:x.sourceRef});
  }
  const far=picks[TYPE.FAR],bcr=picks[TYPE.BCR],setback=picks[TYPE.SETBACK];
  if(far.unit!=='ratio'||bcr.unit!=='ratio'||setback.unit!=='m'||
     !positive(far.value)||!nonnegative(bcr.value)||bcr.value>1)
    return bad(STATUS.HOLD_CONSTRAINTS,'RATIOS_OR_UNITS_INVALID');
  const sb=setback.value;
  if(!sb||typeof sb!=='object'||!['front','rear','left','right'].every(k=>nonnegative(sb[k])))
    return bad(STATUS.HOLD_CONSTRAINTS,'EXPLICIT_FOUR_SIDE_SETBACKS_REQUIRED');
  if(!geometry||geometry.caseId!==caseId||geometry.propertyRef!==propertyRef||
     typeof geometry.sourceRef!=='string'||!geometry.sourceRef.trim()||
     !validDate(geometry.observedAt)||strictCalendarDateMs(geometry.observedAt)>strictCalendarDateMs(evaluatedAt)||
     !positive(geometry.widthM)||!positive(geometry.depthM)||!positive(geometry.landAreaSqm))
    return bad(STATUS.HOLD_GEOMETRY,'SURVEYED_RECTANGLE_INPUTS_MISSING_OR_INVALID');
  if((strictCalendarDateMs(evaluatedAt)-strictCalendarDateMs(geometry.observedAt))>
     geometryMaxAgeDays*86400000)
    return bad(STATUS.HOLD_GEOMETRY,'SURVEY_GEOMETRY_SOURCE_STALE');
  const area=geometry.widthM*geometry.depthM;
  if(!Number.isFinite(area)||Math.abs(area-geometry.landAreaSqm)>maxAreaDifferenceSqm)
    return bad(STATUS.HOLD_GEOMETRY,'RECTANGLE_AREA_DIFFERS_FROM_DECLARED_AREA');
  // The historic C9 contract must not ignore identity and deed/survey
  // differences. Reuse the modern guarded C8 consistency function; its
  // qualified labels remain caller assertions, never professional proof.
  if(!Array.isArray(titleFacts)||!titleFreshnessPolicy||
     typeof titleFreshnessPolicy!=='object'||Array.isArray(titleFreshnessPolicy))
    return bad(STATUS.HOLD_TITLE,'TITLE_SOURCE_PAIR_REQUIRED');
  let title;
  try {
    title=assessTitleCrossDocumentConsistency({
      caseId,propertyId:propertyRef,facts:titleFacts,
      asOf:evaluatedAt,maxAgeDaysBySourceType:titleFreshnessPolicy,
    });
  } catch (_) {
    return bad(STATUS.HOLD_TITLE,'TITLE_SOURCE_PAIR_INVALID');
  }
  if(title.status!=='CANDIDATE_FOR_INDEPENDENT_REVIEW')
    return bad(STATUS.HOLD_TITLE,'DEED_SURVEY_IDENTITY_UNRESOLVED:'+title.status);
  // The geometry must come from one survey ref covering BOTH parcel identity
  // and area. Matching an additional area-only survey ref is insufficient.
  const surveyAreaRefs=new Set(titleFacts.filter(f=>
    f.key==='propertyAreaSqm'&&f.sourceType==='SURVEY'&&
    f.status==='VERIFIED').map(f=>f.sourceRef));
  const surveyParcelRefs=new Set(titleFacts.filter(f=>
    f.key==='parcelOrPlotId'&&f.sourceType==='SURVEY'&&
    f.status==='VERIFIED').map(f=>f.sourceRef));
  if(!surveyAreaRefs.has(geometry.sourceRef)||
     !surveyParcelRefs.has(geometry.sourceRef))
    return bad(STATUS.HOLD_GEOMETRY,'SURVEY_GEOMETRY_SOURCE_REFERENCE_MISMATCH');
  const matchedSurvey=titleFacts.filter(f=>f.sourceType==='SURVEY'&&f.sourceRef===geometry.sourceRef&&f.status==='VERIFIED'&&['propertyAreaSqm','parcelOrPlotId'].includes(f.key));
  if(matchedSurvey.some(f=>strictCalendarDateMs(f.observedAt)<strictCalendarDateMs(geometry.observedAt)))return bad(STATUS.HOLD_GEOMETRY,'SURVEY_REFERENCE_PREDATES_GEOMETRY');
  const titleAreas=titleFacts.filter(f=>f.key==='propertyAreaSqm'&&
      f.status==='VERIFIED').map(f=>f.value);
  if(titleAreas.length<2||!titleAreas.every(v=>positive(v)&&
      Math.abs(v-geometry.landAreaSqm)<=maxAreaDifferenceSqm))
    return bad(STATUS.HOLD_TITLE,'DEED_SURVEY_AREA_GEOMETRY_MISMATCH');
  // A hash of a submitted READY set alone cannot prove its semantic validity.
  // Recompute from the original normalized records, never trust a rehashed trace.
  if(!Array.isArray(planningRecords)||planningRecords.length<3||planningRecords.length>5000)
    return bad(STATUS.HOLD_BINDING,'ORIGINAL_PLANNING_RECORDS_REQUIRED');
  try{
    const allowed=planningEvidenceSet.allowedAuthorityClasses;
    if(!Array.isArray(allowed)||allowed.some(a=>![PLANNING_AUTHORITY_CLASS.OFFICIAL_AUTHORITY,PLANNING_AUTHORITY_CLASS.VERIFIED_PROFESSIONAL].includes(a)))
      return bad(STATUS.HOLD_UPSTREAM,'PLANNING_AUTHORITY_POLICY_NOT_ELIGIBLE');
    const replay=assessPlanningEvidenceSet({caseId,propertyRef,valuationDate:evaluatedAt,records:planningRecords,
      requiredConstraintTypes:planningEvidenceSet.requiredConstraintTypes,
      allowedAuthorityClasses:allowed,cardinalityByType:planningEvidenceSet.cardinalityByType});
    if(replay.planningEvidenceSetHashSha256!==planningEvidenceSetHashSha256||!replay.readyForHbuLegalReview)
      return bad(STATUS.HOLD_BINDING,'PLANNING_EVIDENCE_SET_REPLAY_MISMATCH');
    const selected=new Set(sourceRefs.map(x=>x.evidenceId));
    if(planningRecords.some(r=>selected.has(r.evidenceId)&&
        (!validDate(r.capturedAt)||!validDate(r.verification?.verifiedAt)||
         strictCalendarDateMs(r.capturedAt)>strictCalendarDateMs(evaluatedAt)||
         strictCalendarDateMs(r.verification.verifiedAt)>strictCalendarDateMs(evaluatedAt))))
      return bad(STATUS.HOLD_UPSTREAM,'PLANNING_EVIDENCE_NOT_KNOWN_AT_EVALUATION');
  }catch{return bad(STATUS.HOLD_BINDING,'PLANNING_EVIDENCE_REPLAY_INVALID');}
  const width=geometry.widthM-sb.left-sb.right;
  const depth=geometry.depthM-sb.front-sb.rear;
  const setbackFootprint=Math.max(0,width)*Math.max(0,depth);
  // Tolerance permits review of minor differences, never an increase in capacity.
  const conservativeArea=Math.min(area,geometry.landAreaSqm,...titleAreas);
  const bcrFootprint=conservativeArea*bcr.value;
  const cappedFootprint=Math.min(setbackFootprint,bcrFootprint);
  const farArea=conservativeArea*far.value;
  const values=[width,depth,setbackFootprint,bcrFootprint,cappedFootprint,farArea];
  if(!values.every(Number.isFinite))return bad(STATUS.HOLD_GEOMETRY,'NUMERIC_OVERFLOW');
  const calculations={rectangleAreaSqm:area,declaredAreaSqm:geometry.landAreaSqm,governingAreaSqm:conservativeArea,
    buildableWidthM:width,buildableDepthM:depth,setbackFootprintSqm:setbackFootprint,
    bcrFootprintCapSqm:bcrFootprint,governingFootprintSqm:cappedFootprint,
    farGrossFloorAreaCapSqm:farArea};
  const resultStatus=width>0&&depth>0&&cappedFootprint>0&&farArea>0
    ?STATUS.CANDIDATE_FOR_INDEPENDENT_PLANNING_REVIEW:STATUS.INFEASIBLE;
  return output(resultStatus,caseId,propertyRef,
    resultStatus===STATUS.INFEASIBLE?['NO_POSITIVE_BUILDABLE_CAPACITY']:[],
    calculations,[...sourceRefs,{type:'RECTANGULAR_GEOMETRY',sourceRef:geometry.sourceRef},{type:'SOURCE_INPUT_REPLAY_BINDING',sourceRef:sha({caseId,propertyRef,evaluatedAt,planningEvidenceSetHashSha256,geometry,titleFacts,titleFreshnessPolicy,maxAreaDifferenceSqm,geometryMaxAgeDays})}]);
}
module.exports={STATUS,assessGuardedPlotEnvelope};

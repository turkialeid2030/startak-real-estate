'use strict';
// C9 planning evidence -> a *non-authoritative* rectangular plot envelope.
// This module never authenticates an issuer, grants a permit, selects HBU,
// certifies a valuation or writes any financial engine input.
const crypto = require('node:crypto');
const { assessTitleCrossDocumentConsistency } = require('../title-intelligence/cross-document-consistency');
const {
  PLANNING_CONSTRAINT_TYPE: TYPE,
  PLANNING_EVIDENCE_STATUS,
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
function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(s)&&Number.isFinite(Date.parse(s));}
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
function assessGuardedPlotEnvelope({
  caseId,propertyRef,planningEvidenceSet,geometry,evaluatedAt,maxAreaDifferenceSqm,
  titleFacts,titleFreshnessPolicy,
}={}){
  if(typeof caseId!=='string'||!caseId.trim()||
     typeof propertyRef!=='string'||!propertyRef.trim())throw Error('CASE_PROPERTY_ID_REQUIRED');
  if(!validDate(evaluatedAt))throw Error('EVALUATION_DATE_REQUIRED');
  if(!nonnegative(maxAreaDifferenceSqm))throw Error('EXPLICIT_AREA_TOLERANCE_REQUIRED');
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
     Date.parse(planningEvidenceSet.valuationDate)!==Date.parse(evaluatedAt))
    return bad(STATUS.HOLD_BINDING,'PLANNING_VALUATION_DATE_MISMATCH');
  const required=[TYPE.FAR,TYPE.BCR,TYPE.SETBACK];
  if(!required.every(type=>planningEvidenceSet.requiredConstraintTypes?.includes(type)))
    return bad(STATUS.HOLD_CONSTRAINTS,'MANDATORY_PLANNING_CONSTRAINT_NOT_REQUIRED');
  const picks={},sourceRefs=[];
  for(const type of required){
    const traces=(planningEvidenceSet.trace||[]).filter(x=>x.type===type);
    if(traces.length!==1||!Array.isArray(traces[0].values)||traces[0].values.length!==1)
      return bad(STATUS.HOLD_CONSTRAINTS,'MISSING_OR_AMBIGUOUS_CONSTRAINT:'+type);
    const x=traces[0].values[0];
    if(typeof x.evidenceId!=='string'||!x.evidenceId||
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
     !validDate(geometry.observedAt)||Date.parse(geometry.observedAt)>Date.parse(evaluatedAt)||
     !positive(geometry.widthM)||!positive(geometry.depthM)||!positive(geometry.landAreaSqm))
    return bad(STATUS.HOLD_GEOMETRY,'SURVEYED_RECTANGLE_INPUTS_MISSING_OR_INVALID');
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
  const titleAreas=titleFacts.filter(f=>f.key==='propertyAreaSqm'&&
      f.status==='VERIFIED').map(f=>f.value);
  if(titleAreas.length<2||!titleAreas.every(v=>positive(v)&&
      Math.abs(v-geometry.landAreaSqm)<=maxAreaDifferenceSqm))
    return bad(STATUS.HOLD_TITLE,'DEED_SURVEY_AREA_GEOMETRY_MISMATCH');
  const width=geometry.widthM-sb.left-sb.right;
  const depth=geometry.depthM-sb.front-sb.rear;
  const setbackFootprint=Math.max(0,width)*Math.max(0,depth);
  const bcrFootprint=geometry.landAreaSqm*bcr.value;
  const cappedFootprint=Math.min(setbackFootprint,bcrFootprint);
  const farArea=geometry.landAreaSqm*far.value;
  const values=[width,depth,setbackFootprint,bcrFootprint,cappedFootprint,farArea];
  if(!values.every(Number.isFinite))return bad(STATUS.HOLD_GEOMETRY,'NUMERIC_OVERFLOW');
  const calculations={rectangleAreaSqm:area,declaredAreaSqm:geometry.landAreaSqm,
    buildableWidthM:width,buildableDepthM:depth,setbackFootprintSqm:setbackFootprint,
    bcrFootprintCapSqm:bcrFootprint,governingFootprintSqm:cappedFootprint,
    farGrossFloorAreaCapSqm:farArea};
  const resultStatus=width>0&&depth>0&&cappedFootprint>0&&farArea>0
    ?STATUS.CANDIDATE_FOR_INDEPENDENT_PLANNING_REVIEW:STATUS.INFEASIBLE;
  return output(resultStatus,caseId,propertyRef,
    resultStatus===STATUS.INFEASIBLE?['NO_POSITIVE_BUILDABLE_CAPACITY']:[],
    calculations,[...sourceRefs,{type:'RECTANGULAR_GEOMETRY',sourceRef:geometry.sourceRef}]);
}
module.exports={STATUS,assessGuardedPlotEnvelope};

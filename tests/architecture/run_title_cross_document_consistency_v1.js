'use strict';
const assert = require('node:assert/strict');
const { TITLE_FACT_STATUS, createTitleFact } = require('../../src/title-intelligence');
const { STATUS, assessTitleCrossDocumentConsistency } = require('../../src/title-intelligence/cross-document-consistency');
const ctx = {caseId:'CASE-SYNTHETIC-1',propertyId:'PLOT-SYNTHETIC-1'};
const now = '2026-11-23T00:00:00.000Z';
const limits = {DEED:90,SURVEY:90};
function f(key,value,{role='DEED',ref='DEED-A',day='2026-11-20',status=TITLE_FACT_STATUS.VERIFIED,caseId=ctx.caseId}={}) {
  return createTitleFact({caseId,propertyId:ctx.propertyId,key,value,status,
    sourceType:role,sourceRef:ref,observedAt:day});
}
const deed = [
  f('documentId','DEED-001'),
  f('ownerName','Test Owner'),
  f('propertyAreaSqm',1000),
  f('city','الرياض'),
  f('parcelOrPlotId','PLOT-1'),
];
const survey = [
  f('propertyAreaSqm',1000,{role:'SURVEY',ref:'SURVEY-B'}),
  f('parcelOrPlotId','PLOT-1',{role:'SURVEY',ref:'SURVEY-B'}),
];
function run(facts,options={}) {
  return assessTitleCrossDocumentConsistency({...ctx,facts,asOf:now,
    maxAgeDaysBySourceType:limits,...options});
}
let total=0;
function check(name, fn) {fn();total++;console.log('C8_CROSS_DOCUMENT_'+name+'=PASS');}
check('CONSISTENT_ONLY_AS_CANDIDATE',()=>{
  const a=run([...deed,...survey]);
  assert.equal(a.status,STATUS.CANDIDATE_FOR_INDEPENDENT_REVIEW);
  assert.equal(a.verifiedSourceRights,false);
  assert.equal(a.independentlyAuthenticatedSources,false);
  assert.equal(a.legalTitleValidityEstablished,false);
  assert.equal(a.valuationCertified,false);
  assert.equal(a.transactionAuthorized,false);
  assert.equal(a.automaticallyAdoptIntoFinancialEngine,false);
  assert.ok(Object.isFrozen(a));
});
check('MISSING_SURVEY_HOLD',()=>{
  const a=run(deed);
  assert.equal(a.status,STATUS.HOLD_SOURCE_REQUIREMENTS);
  assert.ok(a.blockers.some(x=>x.includes('INDEPENDENT_DEED_SURVEY_PAIR_REQUIRED')));
});
check('SAME_REFERENCE_NO_INDEPENDENCE',()=>{
  const a=run([...deed,...survey.map(x=>f(x.key,x.value,{role:'SURVEY',ref:'DEED-A'}))]);
  assert.equal(a.status,STATUS.HOLD_SOURCE_REQUIREMENTS);
  assert.ok(a.blockers.some(x=>x.includes('SOURCE_REFERENCE_NOT_INDEPENDENT')));
});
check('DIFFERENT_AREA_CONFLICT',()=>{
  const a=run([...deed,f('propertyAreaSqm',1001,{role:'SURVEY',ref:'SURVEY-B'}),survey[1]]);
  assert.equal(a.status,STATUS.HOLD_CROSS_DOCUMENT_CONFLICT);
  assert.ok(a.blockers.some(x=>x.includes('UNRESOLVED_TITLE_FACT_CONFLICT')));
});
check('SURVEY_STALE_HOLD',()=>{
  const a=run([...deed,...survey.map(x=>f(x.key,x.value,{role:'SURVEY',ref:'SURVEY-B',day:'2025-11-20'}))]);
  assert.equal(a.status,STATUS.HOLD_TEMPORAL_EVIDENCE);
});
check('FUTURE_DEED_HOLD',()=>{
  const a=run([...deed.map(x=>f(x.key,x.value,{day:'2026-11-25'})),...survey]);
  assert.equal(a.status,STATUS.HOLD_TEMPORAL_EVIDENCE);
});
check('UNVERIFIED_SOURCE_HOLD',()=>{
  const a=run([...deed,...survey.map(x=>f(x.key,x.value,{role:'SURVEY',ref:'SURVEY-B',status:TITLE_FACT_STATUS.UNVERIFIED}))]);
  assert.equal(a.status,STATUS.HOLD_SOURCE_REQUIREMENTS);
});
check('LEGAL_MORTGAGE_HOLD',()=>{
  const a=run([...deed,...survey,f('mortgageDetected',true)]);
  assert.equal(a.status,STATUS.HOLD_LEGAL_REVIEW);
  assert.ok(a.blockers.some(x=>x.includes('mortgageDetected')));
});
check('UNKNOWN_SOURCE_ROLE_HOLD',()=>{
  const a=run([...deed,...survey,f('supplementalNote','No legal proof',{role:'UNKNOWN',ref:'X'})]);
  assert.equal(a.status,STATUS.HOLD_SOURCE_REQUIREMENTS);
});
check('REQUIRED_BASE_FACTS_NOT_OPTIONAL',()=>{
  const a=run([...deed.filter(x=>x.key!=='ownerName'),...survey]);
  assert.equal(a.status,STATUS.HOLD_CORE_TITLE_FACTS);
});
check('CROSS_PROPERTY_ISOLATION',()=>{
  assert.throws(()=>run([...deed,...survey,f('documentId','X',{caseId:'OTHER-CASE'})]),
    /PROPERTY_OR_CASE_ISOLATION_VIOLATION/);
});
check('NO_SILENT_FRESHNESS_DEFAULT',()=>{
  assert.throws(()=>run([...deed,...survey],{maxAgeDaysBySourceType:{DEED:90}}),
    /SOURCE_FRESHNESS_DAYS_INVALID:SURVEY/);
});
check('MALFORMED_ASOF_REJECTED',()=>{
  assert.throws(()=>run([...deed,...survey],{asOf:'not a date'}),/VALUATION_DATE_REQUIRED/);
});
check('CALENDAR_INVALID_ASOF_REJECTED',()=>{
 assert.throws(()=>run([...deed,...survey],{asOf:'2026-02-30'}),/VALUATION_DATE_REQUIRED/);
});
check('CALENDAR_INVALID_SOURCE_REJECTED',()=>{
 const invalid=[...deed,...survey.map(x=>f(x.key,x.value,{role:'SURVEY',ref:'SURVEY-B',day:'2026-02-30'}))];
 assert.equal(run(invalid).status,STATUS.HOLD_TEMPORAL_EVIDENCE);
});
check('TIMESTAMP_REQUIRES_TIMEZONE',()=>{
 assert.throws(()=>run([...deed,...survey],{asOf:'2026-11-23T00:00:00'}),/VALUATION_DATE_REQUIRED/);
});
check('LEAP_DAY_ALLOWED',()=>{
 assert.equal(run([...deed,...survey],{asOf:'2028-02-29T00:00:00Z',
  maxAgeDaysBySourceType:{DEED:1000,SURVEY:1000}}).status,STATUS.CANDIDATE_FOR_INDEPENDENT_REVIEW);
});
check('OBSERVED_CORE_OWNER_NOT_VERIFIED_HOLD',()=>{
  const observedOwner=deed.map(x=>x.key==='ownerName'?f(x.key,x.value,{status:TITLE_FACT_STATUS.OBSERVED}):x);
  const a=run([...observedOwner,...survey]);
  assert.equal(a.status,STATUS.HOLD_SOURCE_REQUIREMENTS);
  assert.ok(a.blockers.some(x=>x.includes('VERIFIED_DEED_CORE_FACT_REQUIRED:ownerName')));
});
check('SURVEY_ONLY_OWNER_NOT_DEED_HOLD',()=>{
  const withoutOwner=deed.filter(x=>x.key!=='ownerName');
  const foreignOwner=f('ownerName','Test Owner',{role:'SURVEY',ref:'SURVEY-B'});
  const a=run([...withoutOwner,foreignOwner,...survey]);
  assert.equal(a.status,STATUS.HOLD_SOURCE_REQUIREMENTS);
  assert.ok(a.blockers.some(x=>x.includes('VERIFIED_DEED_CORE_FACT_REQUIRED:ownerName')));
});
check('SURVEY_PARCEL_AND_AREA_MUST_SHARE_SOURCE_REF',()=>{
  const independentParcel=f('parcelOrPlotId','PLOT-1',{role:'SURVEY',ref:'SURVEY-C'});
  const a=run([...deed,survey[0],independentParcel]);
  assert.equal(a.status,STATUS.HOLD_SOURCE_REQUIREMENTS);
  assert.ok(a.blockers.includes('CROSS_KEY_VERIFIED_SOURCE_REQUIRED:SURVEY'));
});
check('CROSS_ROLE_SOURCE_COLLISION_ACROSS_KEYS_HOLD',()=>{
  const mixedDeed=deed.map(x=>x.key==='parcelOrPlotId'
    ?f(x.key,x.value,{ref:'SURVEY-B'}):x);
  const mixedSurvey=[
   f('propertyAreaSqm',1000,{role:'SURVEY',ref:'SURVEY-B'}),
   f('parcelOrPlotId','PLOT-1',{role:'SURVEY',ref:'SURVEY-C'}),
  ];
  const a=run([...mixedDeed,...mixedSurvey]);
  assert.equal(a.status,STATUS.HOLD_SOURCE_REQUIREMENTS);
  assert.ok(a.blockers.includes('DEED_SURVEY_GLOBAL_REFERENCE_COLLISION'));
});
check('EXTRA_DEED_SURVEY_COLLISION_REJECTED',()=>{
  const foreign=f('extraNote','synthetic',{role:'SURVEY',ref:'DEED-A'});
  const a=run([...deed,...survey,foreign]);
  assert.equal(a.status,STATUS.HOLD_SOURCE_REQUIREMENTS);
  assert.ok(a.blockers.includes('DEED_SURVEY_GLOBAL_REFERENCE_COLLISION'));
});
console.log('TITLE_CROSS_DOCUMENT_CONSISTENCY_V1=PASS checks='+total+
  ' synthetic_only=true production_source_rights=false legal_opinion=false');

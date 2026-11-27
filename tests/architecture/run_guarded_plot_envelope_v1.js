'use strict';
const assert=require('node:assert/strict');
const {
  PLANNING_CONSTRAINT_TYPE:TYPE,
  PLANNING_AUTHORITY_CLASS:AUTH,
  PLANNING_VERIFICATION_STATUS:VER,
  PLANNING_CARDINALITY:CARD,
  createPlanningEvidenceRecord,assessPlanningEvidenceSet,
  assessGuardedPlotEnvelope,
}=require('../../src/planning');
const {STATUS}=require('../../src/planning/guarded-plot-envelope');
const {createTitleFact,TITLE_FACT_STATUS}=require('../../src/title-intelligence');
const caseId='SYNTHETIC-C9',propertyRef='SYNTHETIC-LOT',evaluatedAt='2026-11-23T00:00:00.000Z';
const required=[TYPE.FAR,TYPE.BCR,TYPE.SETBACK];
const values={
 [TYPE.FAR]:[2,'ratio'],[TYPE.BCR]:[0.5,'ratio'],
 [TYPE.SETBACK]:[{front:5,rear:5,left:3,right:3},'m'],
};
function records(overrides={}){
 return required.map(type=>createPlanningEvidenceRecord({
  evidenceId:'EV-'+type,caseId,propertyRef,constraintType:type,
  value:overrides[type]?.[0]??values[type][0],
  unit:overrides[type]?.[1]??values[type][1],
  authorityClass:AUTH.OFFICIAL_AUTHORITY,
  sourceAuthority:'SYNTHETIC-PLANNING',sourceRef:'SYNTHETIC-'+type,
  sourceEffectiveDate:'2026-01-01',validFrom:'2026-01-01',
  capturedAt:'2026-11-01',
  verification:{status:VER.VERIFIED,verifiedByRef:'SYNTHETIC-REVIEWER',
   verifiedAt:'2026-11-02',verificationEvidenceRef:'SYNTHETIC-RECEIPT'},
 }));
}
const originalRecords=new WeakMap();
function plan(input=records(),opt={}){
 const set=assessPlanningEvidenceSet({caseId,propertyRef,valuationDate:evaluatedAt,
 records:input,requiredConstraintTypes:opt.required||required,
 allowedAuthorityClasses:[AUTH.OFFICIAL_AUTHORITY],
 cardinalityByType:Object.fromEntries((opt.required||required).map(x=>[x,CARD.SINGLE]))});
 originalRecords.set(set,input);return set;
}
const geometry={caseId,propertyRef,sourceRef:'SYNTHETIC-SURVEY',observedAt:'2026-11-03',
 widthM:40,depthM:50,landAreaSqm:2000};
function fact(key,value,role='DEED',sourceRef='SYNTHETIC-DEED',day='2026-11-20'){
 return createTitleFact({caseId,propertyId:propertyRef,key,value,
   sourceType:role,sourceRef,observedAt:day,status:TITLE_FACT_STATUS.VERIFIED});
}
const deedFacts=[
 fact('documentId','SYNTHETIC-001'),fact('ownerName','Synthetic Owner'),
 fact('propertyAreaSqm',2000),fact('city','Riyadh'),
 fact('parcelOrPlotId','SYNTHETIC-PARCEL'),
];
const surveyFacts=[
 fact('propertyAreaSqm',2000,'SURVEY','SYNTHETIC-SURVEY'),
 fact('parcelOrPlotId','SYNTHETIC-PARCEL','SURVEY','SYNTHETIC-SURVEY'),
];
const titleFacts=[...deedFacts,...surveyFacts];
const titleFreshnessPolicy={DEED:90,SURVEY:90};
function run(overrides={}){
 const set=overrides.planningEvidenceSet||plan();
 return assessGuardedPlotEnvelope({caseId,propertyRef,planningEvidenceSet:set,planningRecords:originalRecords.get(set),geometry,
 evaluatedAt,maxAreaDifferenceSqm:0.5,titleFacts,titleFreshnessPolicy,
 geometryMaxAgeDays:90,...overrides});
}
let count=0;function test(name,fn){fn();count++;console.log('C9_GUARDED_'+name+'=PASS');}
test('CALCULATIONS_AND_AUTHORITY_BOUNDARY',()=>{
 const r=run();assert.equal(r.status,STATUS.CANDIDATE_FOR_INDEPENDENT_PLANNING_REVIEW);
 assert.equal(r.calculations.setbackFootprintSqm,1360);
 assert.equal(r.calculations.bcrFootprintCapSqm,1000);
 assert.equal(r.calculations.governingFootprintSqm,1000);
 assert.equal(r.calculations.farGrossFloorAreaCapSqm,4000);
 for(const key of ['verifiedDataSourceRights','officialPlanningApproval',
 'surveyedGeometryIndependentlyVerified','professionalHbuApproval',
 'buildingPermitEstablished','certifiedValuationEstablished',
 'financialEngineInputsWritten','transactionAuthorized'])assert.equal(r[key],false);
 assert.ok(Object.isFrozen(r));
});
test('MISSING_PLANNING_HOLD',()=>{
 assert.equal(run({planningEvidenceSet:plan(records().slice(0,2))}).status,STATUS.HOLD_UPSTREAM);
});
test('MISSING_REQUIRED_CONSTRAINT_HOLD',()=>{
 const subset=[TYPE.FAR,TYPE.BCR];
 assert.equal(run({planningEvidenceSet:plan(records().slice(0,2),{required:subset})}).status,STATUS.HOLD_CONSTRAINTS);
});
test('CASE_ISOLATION',()=>{
 assert.equal(run({geometry:{...geometry,caseId:'OTHER'}}).status,STATUS.HOLD_GEOMETRY);
});
test('PLANNING_CASE_ISOLATION',()=>{
 assert.equal(run({caseId:'OTHER'}).status,STATUS.HOLD_BINDING);
});
test('TAMPERED_PLANNING_SET_HOLD',()=>{
 assert.equal(run({planningEvidenceSet:{...plan(),status:'READY_FOR_HBU_LEGAL_REVIEW',readyForHbuLegalReview:true,
 trace:[{type:'FAR',values:[{evidenceId:'EV-FAR',sourceRef:'FAKE',value:9,unit:'ratio'}]}]}}).status,STATUS.HOLD_BINDING);
});
test('MISMATCHED_VALUATION_DATE',()=>{
 assert.equal(run({evaluatedAt:'2026-11-22'}).status,STATUS.HOLD_BINDING);
});
test('AREA_MISMATCH',()=>{
 assert.equal(run({geometry:{...geometry,landAreaSqm:1800}}).status,STATUS.HOLD_GEOMETRY);
});
test('EXPLICIT_TOLERANCE',()=>{
 assert.throws(()=>assessGuardedPlotEnvelope({caseId,propertyRef,planningEvidenceSet:plan(),
 geometry,evaluatedAt,titleFacts,titleFreshnessPolicy}),/EXPLICIT_AREA_TOLERANCE_REQUIRED/);
});
test('FOUR_SIDED_SETBACKS',()=>{
 assert.equal(run({planningEvidenceSet:plan(records({
 [TYPE.SETBACK]:[{front:5,rear:5,left:3},'m'],
 }))}).status,STATUS.HOLD_CONSTRAINTS);
});
test('BCR_OUTSIDE_0_TO_1',()=>{
 assert.equal(run({planningEvidenceSet:plan(records({[TYPE.BCR]:[1.5,'ratio']}))}).status,STATUS.HOLD_CONSTRAINTS);
});
test('INFEASIBLE_SETBACKS',()=>{
 const r=run({planningEvidenceSet:plan(records({
 [TYPE.SETBACK]:[{front:30,rear:30,left:3,right:3},'m'],
 }))});
 assert.equal(r.status,STATUS.INFEASIBLE);assert.equal(r.transactionAuthorized,false);
});
test('FUTURE_SURVEY_HOLD',()=>{
 assert.equal(run({geometry:{...geometry,observedAt:'2026-11-26'}}).status,STATUS.HOLD_GEOMETRY);
});
test('INVALID_UNIT_HOLD',()=>{
 assert.equal(run({planningEvidenceSet:plan(records({[TYPE.FAR]:[2,'percent']}))}).status,STATUS.HOLD_CONSTRAINTS);
});
test('NO_TITLE_EVIDENCE_HOLD',()=>{
 assert.equal(run({titleFacts:[]}).status,STATUS.HOLD_TITLE);
});
test('DEED_SURVEY_AREA_DISAGREEMENT_HOLD',()=>{
 const changed=surveyFacts.map(x=>x.key==='propertyAreaSqm'
  ? fact('propertyAreaSqm',2100,'SURVEY','SYNTHETIC-SURVEY'):x);
 assert.equal(run({titleFacts:[...deedFacts,...changed]}).status,STATUS.HOLD_TITLE);
});
test('DEED_AND_SURVEY_MATCH_EACH_OTHER_BUT_NOT_GEOMETRY',()=>{
 const deed=deedFacts.map(x=>x.key==='propertyAreaSqm'?fact('propertyAreaSqm',1800):x);
 const survey=surveyFacts.map(x=>x.key==='propertyAreaSqm'
  ?fact('propertyAreaSqm',1800,'SURVEY','SYNTHETIC-SURVEY'):x);
 assert.equal(run({titleFacts:[...deed,...survey]}).status,STATUS.HOLD_TITLE);
});
test('UNVERIFIED_SOURCE_IDENTITY_HOLD',()=>{
 assert.equal(run({titleFacts:[...deedFacts,...surveyFacts.map(x=>({...x,status:'UNVERIFIED'}))]}).status,STATUS.HOLD_TITLE);
});
test('GEOMETRY_FRESHNESS_POLICY_REQUIRED',()=>{
 const set=plan();
 assert.throws(()=>assessGuardedPlotEnvelope({caseId,propertyRef,planningEvidenceSet:set,planningRecords:originalRecords.get(set),geometry,evaluatedAt,maxAreaDifferenceSqm:0.5,titleFacts,titleFreshnessPolicy}),/EXPLICIT_GEOMETRY_FRESHNESS_POLICY_REQUIRED/);
 const rejected=run({geometryMaxAgeDays:undefined});
 assert.equal(rejected.status,STATUS.HOLD_BINDING);assert.ok(rejected.blockers.includes('PLOT_INPUT_JSON_INVALID'));assert.equal(rejected.transactionAuthorized,false);
});
test('STALE_GEOMETRY_REJECTED',()=>{
 assert.equal(run({geometry:{...geometry,observedAt:'2025-11-03'}}).status,STATUS.HOLD_GEOMETRY);
});
test('INVALID_CALENDAR_GEOMETRY_REJECTED',()=>{
 assert.equal(run({geometry:{...geometry,observedAt:'2026-02-30'}}).status,STATUS.HOLD_GEOMETRY);
});
test('GEOMETRY_REF_MUST_MATCH_C8_SURVEY',()=>{
 assert.equal(run({geometry:{...geometry,sourceRef:'ANOTHER_SURVEY'}}).status,STATUS.HOLD_GEOMETRY);
});
test('INVALID_CALENDAR_ASOF_REJECTED',()=>{
 assert.throws(()=>run({evaluatedAt:'2026-02-30'}),/EVALUATION_DATE_REQUIRED/);
});
test('SURVEY_SOURCE_MIXED_PAIR_CANNOT_FEED_PLOT',()=>{
 const wrongSurvey=[surveyFacts[0],fact('parcelOrPlotId','SYNTHETIC-PARCEL','SURVEY','SECOND-SURVEY')];
 const result=run({titleFacts:[...deedFacts,...wrongSurvey]});
 assert.equal(result.status,STATUS.HOLD_TITLE);
 assert.equal(result.financialEngineInputsWritten,false);
});
test('OBSERVED_OWNER_CANNOT_FEED_PLOT',()=>{
 const owner=deedFacts.map(x=>x.key==='ownerName'
  ?{...x,status:TITLE_FACT_STATUS.OBSERVED}:x);
 assert.equal(run({titleFacts:[...owner,...surveyFacts]}).status,STATUS.HOLD_TITLE);
});
test('GEOMETRY_AREA_ONLY_SURVEY_REF_REJECTED',()=>{
 const altArea=fact('propertyAreaSqm',2000,'SURVEY','SURVEY-ALT');
 const result=run({titleFacts:[...titleFacts,altArea],
   geometry:{...geometry,sourceRef:'SURVEY-ALT'}});
 assert.equal(result.status,STATUS.HOLD_GEOMETRY);
 assert.ok(result.blockers.includes('SURVEY_GEOMETRY_SOURCE_REFERENCE_MISMATCH'));
});
test('ORIGINAL_RECORDS_REQUIRED',()=>{assert.equal(run({planningRecords:undefined}).status,STATUS.HOLD_BINDING);});
test('REHASHED_TRACE_REJECTED',()=>{
 const set=plan(),fake=JSON.parse(JSON.stringify(set));delete fake.planningEvidenceSetHashSha256;
 fake.trace.find(x=>x.type===TYPE.FAR).values[0].value=20;
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 fake.planningEvidenceSetHashSha256=require('node:crypto').createHash('sha256').update(JSON.stringify(stable(fake))).digest('hex');
 assert.equal(run({planningEvidenceSet:fake,planningRecords:originalRecords.get(set)}).status,STATUS.HOLD_BINDING);
});
test('FUTURE_VERIFICATION_REJECTED',()=>{
 const future=records().map(r=>createPlanningEvidenceRecord({...r,verification:{...r.verification,verifiedAt:'2026-11-24'}}));
 assert.equal(run({planningEvidenceSet:plan(future)}).status,STATUS.HOLD_UPSTREAM);
});
test('REHASHED_AUTHORITY_INJECTION_REJECTED',()=>{
 const invalid=records().map(r=>{const v={...r,transactionAuthorized:true};delete v.planningEvidenceHashSha256;
 const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
 v.planningEvidenceHashSha256=require('node:crypto').createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');return v;});
 assert.equal(plan(invalid).status,'HOLD_CONFLICT');
});
test('FRAGMENTED_DEED_CORE_REJECTED',()=>{
 const fragment=deedFacts.map(f=>f.key==='ownerName'?{...f,sourceRef:'SECOND-DEED'}:f);
 assert.equal(run({titleFacts:[...fragment,...surveyFacts]}).status,STATUS.HOLD_TITLE);
});
test('UNVERIFIED_OR_STRING_LEGAL_FINDING_REJECTED',()=>{
 for(const finding of [{...fact('mortgageDetected',false),status:'UNVERIFIED'},fact('mortgageDetected','false'),fact('easementDetected',null)]){
  const r=run({titleFacts:[...titleFacts,finding]});assert.equal(r.status,STATUS.HOLD_TITLE);
  assert.equal(r.transactionAuthorized,false);
 }
});
test('DEED_REFERENCE_WHITESPACE_REJECTED',()=>{
 const bad=titleFacts.map(f=>f.key==='ownerName'?{...f,sourceRef:' '+f.sourceRef}:f);
 assert.equal(run({titleFacts:bad}).status,STATUS.HOLD_TITLE);
});
test('NO_LEGAL_CLEARANCE_INFERRED',()=>{
 const review=require('../../src/title-intelligence').assessTitleCrossDocumentConsistency({caseId,propertyId:propertyRef,facts:titleFacts,asOf:evaluatedAt,maxAgeDaysBySourceType:titleFreshnessPolicy});
 assert.equal(review.absenceOfEncumbrancesEstablished,false);assert.equal(review.professionalEvidenceChainIndependentlyVerified,false);
});
test('FUTURE_EVALUATION_HOLD',()=>{assert.equal(run({evaluatedAt:'2099-01-01'}).status,STATUS.HOLD_BINDING);});
test('DUPLICATE_DEED_FACT_HOLD',()=>{assert.equal(run({titleFacts:[...titleFacts,deedFacts[0]]}).status,STATUS.HOLD_TITLE);});
test('SURVEY_REFERENCE_MUST_NOT_PREDATE_GEOMETRY',()=>{
 const old=surveyFacts.map(f=>({...f,observedAt:'2026-11-01'}));
 const r=run({titleFacts:[...deedFacts,...old]});
 assert.equal(r.status,STATUS.HOLD_GEOMETRY);assert.ok(r.blockers.includes('SURVEY_REFERENCE_PREDATES_GEOMETRY'));
});
test('TOLERANCE_NEVER_INCREASES_CAPACITY',()=>{
 const r=run({geometry:{...geometry,landAreaSqm:2000.4}});
 assert.equal(r.status,STATUS.CANDIDATE_FOR_INDEPENDENT_PLANNING_REVIEW);
 assert.equal(r.calculations.governingAreaSqm,2000);assert.equal(r.calculations.farGrossFloorAreaCapSqm,4000);assert.equal(r.calculations.bcrFootprintCapSqm,1000);
 assert.match(r.sourceRefs.find(x=>x.type==='SOURCE_INPUT_REPLAY_BINDING').sourceRef,/^[0-9a-f]{64}$/);
});
console.log('GUARDED_PLOT_ENVELOPE_V1=PASS checks='+count+' synthetic=true license_proven=false');

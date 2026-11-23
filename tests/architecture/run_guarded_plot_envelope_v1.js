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
function plan(input=records(),opt={}){
 return assessPlanningEvidenceSet({caseId,propertyRef,valuationDate:evaluatedAt,
 records:input,requiredConstraintTypes:opt.required||required,
 allowedAuthorityClasses:[AUTH.OFFICIAL_AUTHORITY],
 cardinalityByType:Object.fromEntries((opt.required||required).map(x=>[x,CARD.SINGLE]))});
}
const geometry={caseId,propertyRef,sourceRef:'SYNTHETIC-SURVEY',observedAt:'2026-11-03',
 widthM:40,depthM:50,landAreaSqm:2000};
function run(overrides={}){
 return assessGuardedPlotEnvelope({caseId,propertyRef,planningEvidenceSet:plan(),geometry,
 evaluatedAt,maxAreaDifferenceSqm:0.5,...overrides});
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
 geometry,evaluatedAt}),/EXPLICIT_AREA_TOLERANCE_REQUIRED/);
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
console.log('GUARDED_PLOT_ENVELOPE_V1=PASS checks='+count+' synthetic=true license_proven=false');

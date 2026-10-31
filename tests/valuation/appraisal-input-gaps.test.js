'use strict';
// Synthetic inputs only. No customer report, parcel, owner or document digest.
const assert=require('node:assert/strict');
const {auditAppraisal,reviewAppraisalInputs,compareVersions}=require('../../src/market/appraisal-assurance');
const {bindReview,evaluateBoundReview}=require('../../src/market/appraisal-study-binding');
const {calculateDirectCapitalization,EXPENSE_TREATMENT}=require('../../src/valuation-intelligence/income-capitalization');
const {EVIDENCE_GRADE,INPUT_STATUS}=require('../../src/valuation-intelligence/contracts');
let checks=0;
const check=(label,fn)=>{fn();checks++;console.log('PASS '+label);};
const base=()=>({valuationDate:'2026-01-01',property:{assetType:'COMMERCIAL_COMPLEX',areaSqm:'١٢٬٠٠٠',
 builtAreaSqm:'10000',netLeasableAreaSqm:'8000',rightType:'LEASED_FEE',improvementOwner:'PROPERTY_OWNER'},
 income:{annualNoiSar:10800000,operatingExpensesSar:1200000,capitalizationRatePct:6,leaseTermYearsRemaining:12}});
const has=(result,code)=>result.issues.some(x=>x.code===code);
check('an unknown built area is never inferred from a leasable area',()=>{
 const input=base();delete input.property.builtAreaSqm;
 const before=JSON.stringify(input);const r=auditAppraisal(input);
 assert.equal(r.metrics.inputReview.status,'INCOMPLETE_INPUTS');
 assert.equal(r.metrics.inputReview.rows.find(x=>x.field==='builtArea').status,'MISSING_VALUE');
 assert.equal(JSON.stringify(input),before);assert.equal(r.certification,'NOT_AUTHORIZED');
});
check('a supplied building area is separate from a multi-floor land area',()=>{
 const input=base();input.property.builtAreaSqm=15000;input.property.netLeasableAreaSqm=13000;
 assert.ok(!has(auditAppraisal(input),'INDOOR_LEASABLE_AREA_EXCEEDS_BUILT_AREA'));
});
check('indoor area greater than built area blocks with Arabic numerals',()=>{
 const input=base();input.property.netLeasableAreaSqm='١١٬٠٠٠';
 assert.ok(has(auditAppraisal(input),'INDOOR_LEASABLE_AREA_EXCEEDS_BUILT_AREA'));
 assert.equal(auditAppraisal(input).status,'HOLD');
});
check('zero invalid or ambiguous built area is not accepted as an unknown',()=>{
 for(const amount of [0,-1,'١٠٫٠٫٠',Infinity]){
  const input=base();input.property.builtAreaSqm=amount;
  assert.ok(has(auditAppraisal(input),'APPRAISAL_INPUT_CONFLICT'));
 }
});
check('land-only review does not require building evidence',()=>{
 const r=reviewAppraisalInputs({property:{assetType:'LAND',areaSqm:1000,rightType:'FREEHOLD'}});
 assert.deepEqual(r.rows.map(x=>x.field),['landArea','rights']);
});
check('selecting a right does not prove a legal right or close its source gap',()=>{
 const r=reviewAppraisalInputs(base());
 assert.equal(r.rows.find(x=>x.field==='rights').status,'SOURCE_REVIEW_REQUIRED');
 assert.equal(r.professionalValuationAuthorized,false);
});
check('lease term is required for a leased interest without inventing a duration',()=>{
 const input=base();delete input.income.leaseTermYearsRemaining;
 assert.equal(reviewAppraisalInputs(input).rows.find(x=>x.field==='lease').status,'MISSING_VALUE');
});
check('reviewed source plus a value remains a declaration and never independent verification',()=>{
 const input=base();input.inputEvidence={};
 for(const row of reviewAppraisalInputs(input).rows)
  input.inputEvidence[row.field]={status:'OBSERVED',sourceRef:'SYNTHETIC SOURCE page 1'};
 const r=reviewAppraisalInputs(input);assert.equal(r.status,'REVIEW_REQUIRED');
 assert.ok(r.rows.every(x=>x.status==='DOCUMENT_REVIEWED_NOT_VERIFIED'&&!x.independentlyVerified));
 assert.equal(auditAppraisal(input).approvedForPublication,false);
});
check('an assumed value with a source remains an exploratory assumption',()=>{
 const input=base();input.inputEvidence={builtArea:{status:'ASSUMED',sourceRef:'SYNTHETIC hypothesis'}};
 assert.equal(reviewAppraisalInputs(input).rows.find(x=>x.field==='builtArea').status,'ASSUMED');
 assert.equal(reviewAppraisalInputs(input).status,'INCOMPLETE_INPUTS');
});
check('forged verified status cannot grant professional authority or close a gap',()=>{
 const input=base();input.inputEvidence={rights:{status:'VERIFIED',sourceRef:'UNVERIFIED synthetic claim'}};
 assert.equal(reviewAppraisalInputs(input).rows.find(x=>x.field==='rights').status,'SOURCE_REVIEW_REQUIRED');
 assert.equal(auditAppraisal(input).approvedForPublication,false);
});
check('explicit source conflict blocks even if arithmetic is correct',()=>{
 const input=base();input.inputEvidence={rights:{status:'CONFLICT',sourceRef:'SYNTHETIC conflicting records'}};
 assert.equal(auditAppraisal(input).status,'HOLD');
});
check('a missing cost component cannot disappear behind reviewed totals',()=>{
 const input=base();input.cost={depreciatedImprovementValueSar:15000000,indicatedTotalSar:115000000};
 assert.equal(reviewAppraisalInputs(input).rows.find(x=>x.field==='costLand').status,'MISSING_VALUE');
});
check('entering a cap rate cannot hide missing NOI and owner expense inputs',()=>{
 const input=base();delete input.income.annualNoiSar;delete input.income.operatingExpensesSar;
 const r=reviewAppraisalInputs(input);
 for(const field of ['income','expenses'])assert.equal(r.rows.find(x=>x.field===field).status,'MISSING_VALUE');
});
check('declared conflicting evidence remains a blocker even when its value is missing',()=>{
 const input=base();delete input.property.areaSqm;input.inputEvidence={landArea:{status:'CONFLICT'}};
 assert.ok(has(auditAppraisal(input),'APPRAISAL_INPUT_CONFLICT'));
});
check('cost totals reconcile without adding income value to the asset',()=>{
 const input=base();input.cost={landValueSar:100000000,depreciatedImprovementValueSar:15000000,indicatedTotalSar:115000000};
 const r=auditAppraisal(input);assert.equal(r.metrics.recalculatedCostValueSar,115000000);
 assert.ok(!has(r,'COST_TOTAL_MISMATCH'));assert.equal(r.metrics.capitalizedIncomeValueSar,180000000);
 assert.equal(r.metrics.reconciledValueSar,undefined);
});
check('incorrect cost total blocks',()=>{
 const input=base();input.cost={landValueSar:100000000,depreciatedImprovementValueSar:15000000,indicatedTotalSar:180000000};
 assert.ok(has(auditAppraisal(input),'COST_TOTAL_MISMATCH'));
});
check('tenant mixed and unknown improvement ownership cannot substantiate an additive owner value',()=>{
 for(const owner of ['TENANT','MIXED','']){
  const input=base();input.property.improvementOwner=owner;
  input.cost={landValueSar:100000000,depreciatedImprovementValueSar:15000000,indicatedTotalSar:115000000};
  assert.ok(has(auditAppraisal(input),'IMPROVEMENT_RIGHTS_UNRESOLVED'));
 }
});
check('zero improvement value does not falsely assign a tenant building to owner',()=>{
 const input=base();input.property.improvementOwner='TENANT';
 input.cost={landValueSar:100000000,depreciatedImprovementValueSar:0,indicatedTotalSar:100000000};
 assert.ok(!has(auditAppraisal(input),'IMPROVEMENT_RIGHTS_UNRESOLVED'));
});
check('new blockers cannot be forged into an exportable review-only session link',()=>{
 const subject={name:'Synthetic case',assetType:'COMMERCIAL_COMPLEX',landArea:12000,valuationDate:'2026-01-01'};
 const input=base();input.reportId='SYNTHETIC';input.property.name=subject.name;
 const link=bindReview({subject,appraisal:input,documentDigest:'a'.repeat(64),confirmed:true,review:{status:'REVIEW_REQUIRED',issues:[]}}).link;
 for(const code of ['APPRAISAL_INPUT_CONFLICT','INDOOR_LEASABLE_AREA_EXCEEDS_BUILT_AREA','COST_TOTAL_MISMATCH','IMPROVEMENT_RIGHTS_UNRESOLVED'])
  assert.equal(evaluateBoundReview({subject,link:{...link,issues:[code]}}).blockExport,true);
});
check('changes in evidence ownership and areas appear in version comparison',()=>{
 const previous={reportId:'SYNTHETIC',...base()},current=JSON.parse(JSON.stringify(previous));
 current.property.improvementOwner='TENANT';current.inputEvidence={builtArea:{status:'ASSUMED',sourceRef:'SYNTHETIC'}};
 const paths=compareVersions(previous,current).changed.map(x=>x.path);
 assert.ok(paths.includes('property.improvementOwner'));assert.ok(paths.includes('inputEvidence.builtArea.status'));
});
check('existing income engine supports explicit expense scenarios without certifying market inputs',()=>{
 const evidence={grade:EVIDENCE_GRADE.G_EXPERT_ASSUMPTION,status:INPUT_STATUS.ASSUMED,sourceType:'SYNTHETIC_SCENARIO'};
 for(const [amount,expected] of [[1200000,180000000],[600000,190000000],[0,200000000]]){
  const result=calculateDirectCapitalization({effectiveGrossIncome:12000000,operatingExpenses:amount,capitalizationRate:.06,
   expenseTreatment:amount===0?EXPENSE_TREATMENT.TENANT_BORNE_ASSUMED:EXPENSE_TREATMENT.MARKET_ESTIMATE,
   incomeEvidence:evidence,expenseEvidence:evidence,capRateEvidence:evidence});
  assert.ok(Math.abs(result.value-expected)<.01);
  assert.ok(result.warnings.includes('CAP_RATE_NOT_VERIFIED_MARKET_EVIDENCE'));
 }
});
console.log('APPRAISAL_INPUT_GAPS=PASS cases='+checks);

'use strict';
const assert=require('node:assert/strict');
const {evaluateEfficiency,reviewEfficiencyText}=require('../../src/engines/financial/asset-efficiency-review');
const scope={caseId:'SYNTH-EFF',propertyRef:'SYNTH-PROP',marketScopeRef:'SYNTH-SCOPE',asOfDate:'2026-10-31'};
function fixture(){
 const periodStart='2026-09-01',periodEnd='2026-09-30',measurementBasisRef='SYNTH-MONTHLY-BASIS';
 const group=(sourceRef,values)=>({...scope,sourceRef,values,reviewedAt:'2026-10-10',periodStart,periodEnd,measurementBasisRef});
 return {...scope,periodStart,periodEnd,measurementBasisRef,groups:{
 financial:group('SYNTH-GL',{effectiveRevenueSar:1000000,operatingExpensesSar:300000,budgetRevenueSar:950000,budgetOperatingExpensesSar:280000,receivablesDueSar:800000,collectionsAgainstDueSar:760000,cashAvailableForDebtServiceSar:600000,debtServiceSar:400000}),
 operational:group('SYNTH-OPS',{availableAreaDays:30000,occupiedAreaDays:24000,maintenanceDue:100,maintenanceOnTime:90,maintenanceExpenseSar:60000}),
 productivity:group('SYNTH-TIMESHEETS',{maintenanceCompleted:100,maintenanceLaborHours:200,qualityEligibleCompleted:80,reopenedWithinReviewWindow:4,adminCompleted:80,adminLaborHours:40}),
 administrative:group('SYNTH-CONTROLS',{adminDue:100,adminOnTime:95,controlsDue:20,controlsCompletedOnTime:18})
 },targets:{collectionRate:{value:.96,sourceRef:'SYNTH-PLAN',approvedAt:'2026-08-31'},expenseVariance:{value:0,sourceRef:'SYNTH-PLAN',approvedAt:'2026-08-31'},occupancy:{value:.8,sourceRef:'SYNTH-PLAN',approvedAt:'2026-08-31'},maintenanceReopenRate:{value:.06,sourceRef:'SYNTH-PLAN',approvedAt:'2026-08-31'}}};
}
const expectedValues=[700000,.7,.3,50000,20000,.95,1.5,.8,.9,2,.5,.05,2,.95,.9];
if(require.main===module){
 const x=fixture(),r=evaluateEfficiency(x,scope),get=id=>r.metrics.find(m=>m.id===id);
 assert.equal(r.status,'COMPLETE_RESEARCH_REVIEW');assert.deepEqual(r.metrics.map(m=>m.value),expectedValues);
 assert.equal(get('collectionRate').status,'OFF_TARGET');assert.equal(get('expenseVariance').status,'OFF_TARGET');assert.equal(get('occupancy').status,'ON_TARGET');assert.equal(get('maintenanceReopenRate').status,'ON_TARGET');
 assert.deepEqual(r.coverage,{available:15,total:15,targeted:4});
 assert.equal(r.valuationChanged,false);assert.equal(r.spendingAuthorized,false);
 assert.deepEqual(reviewEfficiencyText({text:JSON.stringify({...x,report:{spendingAuthorized:true}}),...scope}),r);
 const cases=[
  y=>y.propertyRef='OTHER',y=>y.periodEnd='2026-11-01',y=>y.periodStart='2026-02-30',
  y=>y.groups.financial.reviewedAt='2026-09-01',y=>y.groups.financial.reviewedAt='2026-11-01',
  y=>y.groups.operational.propertyRef='OTHER',y=>y.groups.operational.caseId='OTHER',y=>y.groups.operational.marketScopeRef='OTHER',y=>y.groups.operational.measurementBasisRef='OTHER',y=>y.groups.operational.periodEnd='2026-09-29',
  y=>y.groups.financial.values.collectionsAgainstDueSar=900000,y=>y.groups.operational.values.occupiedAreaDays=30001,
  y=>y.groups.operational.values.maintenanceOnTime=101,y=>y.groups.productivity.values.reopenedWithinReviewWindow=81,
  y=>y.groups.productivity.values.qualityEligibleCompleted=101,y=>y.groups.productivity.values.maintenanceLaborHours=0,
  y=>y.groups.administrative.values.adminOnTime=101,y=>y.groups.administrative.values.controlsCompletedOnTime=21,
  y=>y.groups.administrative.values.adminDue=1.5,y=>y.groups.financial.values.operatingExpensesSar=-1,
  y=>y.groups.financial.values.effectiveRevenueSar='1000000',y=>y.groups.financial.values.unexpected=1,
  y=>y.targets.collectionRate.approvedAt='2026-09-02',y=>y.targets.collectionRate.value=1.1,
  y=>y.targets.fake={value:1,sourceRef:'SYNTH',approvedAt:'2026-08-31'}
 ];
 for(const change of cases){const y=fixture();change(y);const h=evaluateEfficiency(y,scope);assert.equal(h.status,'HOLD');assert.deepEqual(h.metrics,[]);}
 const partial=fixture();delete partial.groups.financial;delete partial.groups.productivity.values.reopenedWithinReviewWindow;
 const p=evaluateEfficiency(partial,scope);assert.equal(p.status,'PARTIAL_RESEARCH_REVIEW');assert.equal(p.metrics.find(m=>m.id==='operatingSurplus').value,null);assert.ok(p.warnings.includes('PRODUCTIVITY_WITHOUT_QUALITY_GUARDRAIL'));
 const zero=fixture();zero.groups.financial.values.debtServiceSar=0;zero.groups.financial.values.effectiveRevenueSar=0;
 const z=evaluateEfficiency(zero,scope);assert.equal(z.metrics.find(m=>m.id==='cashDebtCoverage').value,null);assert.equal(z.metrics.find(m=>m.id==='surplusMargin').value,null);assert.equal(z.metrics.find(m=>m.id==='operatingSurplus').value,-300000);
 assert.equal(reviewEfficiencyText({text:'{"__proto__":{}}',...scope}).status,'HOLD');
 assert.equal(reviewEfficiencyText({text:' '.repeat(262145),...scope}).status,'HOLD');
 console.log('ASSET_EFFICIENCY_FOUR_AXIS=PASS synthetic_only=true negative_cases='+cases.length);
}
module.exports={fixture,scope,expectedValues};

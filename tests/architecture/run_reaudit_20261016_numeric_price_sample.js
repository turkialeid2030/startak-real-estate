'use strict';
const assert=require('node:assert/strict');
const {parseNumericText}=require('../../src/validation/numeric-text');
const {normalizeExtractedValue}=require('../../src/document-intelligence/pipeline');
const {parseLedgerAmount}=require('../../src/residential-income-acquisition/receivables-ledger');
const {parseOptionalPercentInput}=require('../../src/assumptions/ui-assumption-governance');
const {calcExistingBuilding}=require('../../src/engines/valuation/existing-building');
const {calculateInvestmentCase,STUDY_TYPE}=require('../../src/engines');
const {V2_APPROVED_ASSUMPTIONS}=require('../../src/assumptions/assumption-model');
const {evaluateExternalValuationValidation:evaluate}=require('../../src/validation/external-valuation-validation');
const gold=require('../reference/RE-GOLD-baseline.json');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=(v,msg)=>{assert.ok(v,msg);checks++;};
for(const raw of ['1800.5','1800٫5','١٨٠٠٫٥','١٬٨٠٠٫٥','۱٬۸۰۰٫۵','1,800.5',' ١٨٠٠.٥ ']){
 eq(parseNumericText(raw).value,1800.5);eq(normalizeExtractedValue(raw,'NUMBER'),1800.5);eq(parseLedgerAmount(raw),180050);
}
for(const raw of ['1e3','1E3','abc1800','1800a5','1,5','1,80,000','١٬٨٠','1٫2.3','1,234٬567','--1','1-2','+1','',null,[],{},true,'١٨٠٠٫٥ ريال','1 800','Infinity','NaN','9007199254740992'])eq(parseNumericText(raw).ok,false);
eq(parseNumericText('−1').value,-1);eq(parseNumericText('۰').value,0);eq(parseNumericText('.5').value,.5);eq(parseNumericText('0.').value,0);
for(const raw of ['9.5','٩٫٥','۹٫۵'])eq(parseOptionalPercentInput(raw).value,.095);
eq(normalizeExtractedValue('١٤٠٬٠٠٠٬٠٠٠ ريال','NUMBER'),140000000);
eq(normalizeExtractedValue('۹۵٫۵٪','NUMBER'),95.5);
for(const raw of ['1e3%','oops 1200 SAR','1800.5 garbage']){assert.throws(()=>normalizeExtractedValue(raw,'NUMBER'));checks++;}
const base=gold['RE-GOLD-002_existing_building'].inputs;
const audited={...base,...V2_APPROVED_ASSUMPTIONS,exitCapRate:.075,exitTransferFeeRate:0,leaseYears:6};
const run=inputs=>calculateInvestmentCase({studyType:STUDY_TYPE.EXISTING_BUILDING,inputs,assumptionModelVersion:'V2'});
const result=run(audited),at=run({...audited,buildingPrice:result.maxJustifiedPrice});
ok(Math.abs(result.maxJustifiedPrice-125920419.13)<.011,'audited ceiling matches independent ten-year recovery, conservatively truncated');
eq(at.c2,true);eq(at.metCount,6);eq(at.totalCriteria,6);eq(at.maxPriceConstraint.bindingConstraint,'CUMULATIVE_PAYBACK');
eq(run({...audited,buildingPrice:result.maxJustifiedPrice+1}).c2,false);
const old=run({...audited,buildingPrice:126333879.07});ok(Math.abs(old.paybackOnCost-10.032943)<.000001,'old ceiling reproduces the documented failure');eq(old.c2,false);
for(const rentGrowthRate of [-.03,0,.04])for(const opexGrowthRate of [0,.05])for(const occupancyRate of [.7,1])for(const maxPaybackThreshold of [2.5,10,35]){
 const inputs={...base,rentGrowthRate,opexGrowthRate,occupancyRate,maxPaybackThreshold,fixedOpexPerSqm:25,leaseStatus:'3 أشهر'};
 const original=calcExistingBuilding(inputs),price=original.maxJustifiedPrice;
 if(price<=0)continue;
 const boundary=calcExistingBuilding({...inputs,buildingPrice:price});
 ok(boundary.c1&&boundary.c2,'ceiling satisfies both stated constraints under changed growth, lease-up and fractional horizon');
 const above=calcExistingBuilding({...inputs,buildingPrice:price+1});ok(!above.c1||!above.c2,'a material increase violates a binding constraint');
 eq(boundary.NOI,original.NOI);eq(boundary.paybackNoiCashflows,original.paybackNoiCashflows);
}
const policy={minObservations:3,maxDateGapDays:60,maxMedianAbsolutePercentageError:.1,maxAbsoluteMedianSignedPercentageError:.1};
const observation={caseId:'C1',projectId:'P1',startakValue:102,comparatorValue:100,comparatorType:'ACTUAL_TRANSACTION',currency:'SAR',basis:'MARKET_VALUE',startakAsOf:'2026-10-01',comparatorAsOf:'2026-10-01',startakEvidenceRef:'S1',comparatorEvidenceRef:'T1',reviewerRef:'R1'};
const sample=[1,2,3].map(n=>({...observation,caseId:`C${n}`,projectId:`P${n}`,comparatorEvidenceRef:`T${n}`}));
eq(evaluate({observations:sample,policy}).validationPolicyPassed,true);
for(const observations of [[observation,observation,observation],sample.map(x=>({...x,caseId:'C1'})),sample.map(x=>({...x,projectId:'P1'})),sample.map(x=>({...x,comparatorEvidenceRef:' T1 '}))]){
 const x=evaluate({observations,policy});eq(x.validationPolicyPassed,false);eq(x.status,'HOLD_EVIDENCE');ok(x.failures.some(x=>x.reason==='DUPLICATE_OR_DEPENDENT_OBSERVATION'));
}
eq(evaluate({observations:[{...observation,startakAsOf:'2026-02-30'}],policy}).status,'HOLD_EVIDENCE');
const unsafe=evaluate({observations:[{...observation,startakValue:Number.MAX_VALUE,comparatorValue:1e-300}],policy});eq(unsafe.status,'HOLD_EVIDENCE');eq(unsafe.metrics,null);
const extreme=evaluate({observations:sample.map(x=>({...x,startakValue:Number.MAX_VALUE,comparatorValue:1})),policy});
eq(extreme.validationPolicyPassed,false);ok(Number.isFinite(extreme.metrics.meanAbsolutePercentageError));
console.log(`REAUDIT_NUMERIC_PRICE_SAMPLE=PASS checks=${checks}`);

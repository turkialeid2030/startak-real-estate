'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const gold=require('../reference/RE-GOLD-baseline.json');
const {calcLandDevelopment}=require('../../src/engines/valuation/land-development');
const {calcExistingBuilding}=require('../../src/engines/valuation/existing-building');
const {validateEngineInputs,ValidationError}=require('../../src/validation/numeric-safety');
const {calculateInvestmentCase,STUDY_TYPE}=require('../../src/engines');
const {V2_APPROVED_ASSUMPTIONS}=require('../../src/assumptions/assumption-model');
const rawLand=gold['RE-GOLD-001_land_development'].inputs;
const land={...rawLand,...V2_APPROVED_ASSUMPTIONS};
const building=gold['RE-GOLD-002_existing_building'].inputs;
let checks=0;
function ok(x,msg){assert.ok(x,msg);checks++;}
function eq(a,b,msg){assert.deepEqual(a,b,msg);checks++;}
function rejects(fn,field,msg){
 assert.throws(fn,e=>e?.name==='ValidationError'&&e.field===field,msg);checks++;
}
const approx=(a,b,t)=>Math.abs(a-b)<=t;
(function F01_negative_price_fails_closed(){
 const app=fs.readFileSync(path.resolve(__dirname,'../../src/app/App.jsx'),'utf8');
 ok(!app.includes('onChange(min !== undefined ? Math.max(min, parsed) : parsed)'),
   'no UI silently coerces -1 into 0.01 or other positive floors');
 ok(app.includes('onChange(parsed);'),'UI hands original parsed numeric value to validator');
 for(const value of [-1,0,-0.01]){
  rejects(()=>calcExistingBuilding({...building,buildingPrice:value}),
   'buildingPrice','building negative or zero rejects before financial metrics');
  rejects(()=>calculateInvestmentCase({
   studyType:STUDY_TYPE.EXISTING_BUILDING,
   inputs:{...building,buildingPrice:value},
  }),'buildingPrice','canonical engine rejects invalid building price');
 }
 rejects(()=>calcLandDevelopment({...land,landPricePerSqm:-1}),
   'landPricePerSqm','land input negative price rejects');
 // No historic validation exception is weakened.
 rejects(()=>validateEngineInputs({...building,buildingPrice:0.00}),
   'buildingPrice','zero still rejected');
})();
(function F02_max_price_must_derive_from_actual_calendar_cashflows(){
 const result=calcLandDevelopment(land);
 console.log('AUDIT_F02_REFERENCE_VALUES',JSON.stringify({payback:result.cumulativeProjectPaybackYears,ceiling:result.maxJustifiedLandPricePerSqm,firstOperatingNOI:result.firstOperatingYearNOI,stableNOI:result.stabilizedNOI,constructionYears:result.constructionYears}));
 ok(result.cumulativeProjectPaybackYears>land.maxPaybackThreshold,
   'reference 20,000 SAR/sqm correctly misses nine-year calendar payback');
 const max=result.maxJustifiedLandPricePerSqm;
 ok(Number.isFinite(max)&&max>13000&&max<14500,
   'reference corrected maximum SAR/sqm is near independently audited 13,603');
 const at=calcLandDevelopment({...land,landPricePerSqm:max});
 const above=calcLandDevelopment({...land,landPricePerSqm:max+0.01});
 const visiblyAbove=calcLandDevelopment({...land,landPricePerSqm:max+1});
 ok(at.cumulativeProjectPaybackYears!==null&&
   at.cumulativeProjectPaybackYears<=land.maxPaybackThreshold,
   'quoted max price itself meets the displayed calendar-time limit');
 ok(above.cumulativeProjectPaybackYears===null||
   above.cumulativeProjectPaybackYears>land.maxPaybackThreshold,
   'one cent beyond max violates the displayed condition');
 ok(visiblyAbove.cumulativeProjectPaybackYears===null||
   visiblyAbove.cumulativeProjectPaybackYears>land.maxPaybackThreshold,
   '1 SAR beyond max violates the displayed condition');
 ok(max<land.landPricePerSqm,'unaffordable 20,000 price not framed as acceptable threshold');
 ok(approx(result.irr,at.irr,0.25) && Number.isFinite(at.npv),
   'the existing IRR/NPV calculation remains implemented, but changes with purchase cost');
 ok(at.maxJustifiedLandPricePerSqm===max,
   'quoted maximum independent of chosen initial land purchase price');
 const legacy=calcLandDevelopment(rawLand);
 const legacyPrice=legacy.maxJustifiedLandPricePerSqm;
 ok(Number.isFinite(legacyPrice)&&legacyPrice>0,
   'legacy economics have a separately calculated ceiling, not substituted V2');
 const legacyAt=calcLandDevelopment({...rawLand,landPricePerSqm:legacyPrice});
 ok(legacyAt.cumulativeProjectPaybackYears!==null&&
 legacyAt.cumulativeProjectPaybackYears<=rawLand.maxPaybackThreshold,
  'legacy payback floor verifies against its own unmodified legacy cashflows');
 const delayed=calcLandDevelopment({...land,constructionPeriod:3});
 ok(delayed.maxJustifiedLandPricePerSqm<max,
   'one extra construction year reduces nine-year calendar payback capacity');
 if(delayed.maxJustifiedLandPricePerSqm!==null){
  const test=calcLandDevelopment({...land,constructionPeriod:3,
   landPricePerSqm:delayed.maxJustifiedLandPricePerSqm});
  ok(test.cumulativeProjectPaybackYears<=land.maxPaybackThreshold,
   'longer construction variant meets its own price boundary');
 }
 const tooShort=calcLandDevelopment({...land,maxPaybackThreshold:1});
 eq(tooShort.maxJustifiedLandPricePerSqm,null,
   'when construction prevents payback even with zero land price, do not fabricate zero maximum');
 const longer=calcLandDevelopment({...land,maxPaybackThreshold:11});
 ok(longer.maxJustifiedLandPricePerSqm>max,
   'extra calendar time genuinely permits higher land cost');
})();
console.log('AUDIT_20261010_F01_F02=PASS checks='+checks);
console.log('F01_PRICE_NEGATIVE_FAIL_CLOSED=TRUE');
console.log('F02_BOUNDARY_RECOMPUTED_ON_ACTUAL_CALENDAR_CASHFLOWS=TRUE');

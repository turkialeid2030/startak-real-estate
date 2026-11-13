#!/usr/bin/env node
// Private-source residual intake characterization for STARTAK Real Estate.
// This tool NEVER reads a fixture unless supplied by the owner via --fixture.
import {readFile} from 'node:fs/promises';

const mark=(s)=>console.log('STARTAK_PRIVATE_RESIDUAL_'+s);
const fail=code=>{throw Error(code);};
const finite=(n,code)=>{if(typeof n!=='number'||!Number.isFinite(n))fail(code);return n;};
const nonneg=(n,code)=>{const v=finite(n,code);if(v<0)fail(code);return v;};
const positive=(n,code)=>{const v=finite(n,code);if(v<=0)fail(code);return v;};
const within=(n,max,code)=>{if(nonneg(n,code)>max)fail(code);return n;};
const exact=(got,expected,code)=>{
 if(!Number.isSafeInteger(expected)||got!==expected)fail(code);
};
function validateHotel(c){
 if(!Array.isArray(c.seasons)||c.seasons.length<1
    ||!Array.isArray(c.roomTypes)||c.roomTypes.length<1)fail('HOTEL_STRUCTURE_INVALID');
 const periods=c.seasons.map(s=>{
  const days=positive(s.days,'HOTEL_DAYS_INVALID');
  if(!Number.isSafeInteger(days))fail('HOTEL_DAYS_INVALID');
  return {days,occPct:within(s.occPct,100,'HOTEL_OCCUPANCY_INVALID')};
 });
 const days=periods.reduce((v,s)=>v+s.days,0);
 if(days!==365)fail('HOTEL_YEAR_NOT_365_DAYS');
 const gross=Math.round(c.roomTypes.reduce((sum,r)=>{
  const count=positive(r.count,'HOTEL_ROOM_COUNT_INVALID');
  if(!Number.isSafeInteger(count)||!Array.isArray(r.adr)||r.adr.length!==periods.length)
   fail('HOTEL_ADR_STRUCTURE_INVALID');
  return sum+periods.reduce((v,s,i)=>v+count*s.days*(s.occPct/100)*nonneg(r.adr[i],'HOTEL_ADR_INVALID'),0);
 },0));
 const opexPct=within(c.opexPct,100,'HOTEL_OPEX_INVALID');
 const capRate=positive(c.capRatePct,'HOTEL_CAP_RATE_INVALID')/100;
 if(capRate>1)fail('HOTEL_CAP_RATE_INVALID');
 const noi=Math.round(gross*(1-opexPct/100));
 const gdv=Math.round(noi/capRate);
 const cost=nonneg(c.scenario?.dev,'HOTEL_DEV_INVALID')
  *(1+within(c.scenario?.othPct,100,'HOTEL_OTHER_PCT_INVALID')/100);
 const discount=within(c.discountPct,100,'HOTEL_DISCOUNT_INVALID')/100;
 const years=positive(c.periodYears,'HOTEL_PERIOD_INVALID');
 const pv=Math.round((gdv-cost)/Math.pow(1+discount,years));
 const area=positive(c.residualArea,'HOTEL_AREA_INVALID');
 const step=positive(c.roundStep,'HOTEL_ROUND_STEP_INVALID');
 const rate=Math.round(pv/area/step)*step;
 exact(gross,c.expected?.grossIncome,'HOTEL_GROSS_MISMATCH');
 if(c.expected?.noi!==undefined)exact(noi,c.expected.noi,'HOTEL_NOI_MISMATCH');
 exact(gdv,c.expected?.gdv,'HOTEL_GDV_MISMATCH');
 exact(pv,c.expected?.presentValue,'HOTEL_PV_MISMATCH');
 exact(rate,c.expected?.residualRate,'HOTEL_RATE_MISMATCH');
}
function validateIncomeCompound(c){
 if(!Array.isArray(c.units)||!c.units.length)fail('COMPOUND_UNITS_REQUIRED');
 const gross=Math.round(c.units.reduce((sum,row)=>{
  const count=positive(row.count,'UNIT_COUNT_INVALID');
  if(!Number.isSafeInteger(count))fail('UNIT_COUNT_INVALID');
  return sum+count*nonneg(row.annualRent,'UNIT_RENT_INVALID')
    *within(row.occPct,100,'UNIT_OCCUPANCY_INVALID')/100;
 },0));
 const noi=Math.round(gross*(1-within(c.opexPct,100,'UNIT_OPEX_INVALID')/100));
 const cap=positive(c.capRatePct,'UNIT_CAP_RATE_INVALID')/100;
 if(cap>1)fail('UNIT_CAP_RATE_INVALID');
 const value=Math.round(noi/cap);
 exact(gross,c.expected?.grossIncome,'COMPOUND_GROSS_MISMATCH');
 exact(noi,c.expected?.noi,'COMPOUND_NOI_MISMATCH');
 exact(value,c.expected?.incomeValue,'COMPOUND_INCOME_VALUE_MISMATCH');
}
function validateCommercialRollup(c){
 // The private source supplies scenarioLand expectations, but does NOT
 // document their complete GDV/cost/profit methodology. Do NOT invent it.
 if(!Array.isArray(c.scenarios)||c.scenarios.length<1
  ||!Array.isArray(c.expected?.scenarioLand)
  ||c.expected.scenarioLand.length!==c.scenarios.length)fail('COMM_SCENARIO_STRUCTURE_INVALID');
 let weight=0,weighted=0;
 for(let i=0;i<c.scenarios.length;i++){
  const x=c.scenarios[i];
  for(const key of ['gdv','dev','othPct','mktPct','contPct','profPct'])
   nonneg(x[key],'COMM_SCENARIO_INPUT_INVALID');
  const w=within(x.weightPct,100,'COMM_WEIGHT_INVALID');
  weight+=w;
  weighted+=nonneg(c.expected.scenarioLand[i],'COMM_SOURCE_SCENARIO_VALUE_INVALID')*w/100;
 }
 if(Math.abs(weight-100)>1e-9)fail('COMM_WEIGHT_SUM_INVALID');
 const years=positive(c.periodYears,'COMM_PERIOD_INVALID');
 const discount=within(c.discountPct,100,'COMM_DISCOUNT_INVALID')/100;
 const pv=Math.round(weighted/Math.pow(1+discount,years));
 const area=positive(c.residualArea,'COMM_AREA_INVALID');
 const step=positive(c.roundStep,'COMM_STEP_INVALID');
 const residualRate=Math.round(pv/area/step)*step;
 const marketWeight=within(c.marketWeightPct,100,'COMM_MARKET_WEIGHT_INVALID')/100;
 const adoptedRate=Math.round(residualRate*(1-marketWeight)
   +nonneg(c.marketLandRate,'COMM_MARKET_RATE_INVALID')*marketWeight);
 exact(pv,c.expected.presentValue,'COMM_WEIGHTED_PV_MISMATCH');
 exact(residualRate,c.expected.residualRate,'COMM_RATE_MISMATCH');
 exact(adoptedRate,c.expected.adoptedLandRate,'COMM_ADOPTED_LAND_RATE_MISMATCH');
}
const args=process.argv.slice(2);
if(args.length!==1 || !args[0].startsWith('--fixture=')){
 mark('SOURCE=BLOCKED_NOT_SUPPLIED');
 process.exit(2);
}
try {
 const source=JSON.parse(await readFile(args[0].slice('--fixture='.length),'utf8'));
 if(!Array.isArray(source?.residualCases)||source.residualCases.length!==4)
  fail('EXPECTED_FOUR_RESIDUAL_CASES');
 const ids=new Set();let hotels=0,compounds=0,commercials=0;
 for(const c of source.residualCases){
  if(typeof c.id!=='string'||!c.id.trim()||ids.has(c.id))fail('CASE_IDS_INVALID');
  ids.add(c.id);
  if(Array.isArray(c.scenarios)){commercials++;validateCommercialRollup(c);}
  else if(Array.isArray(c.seasons)&&Array.isArray(c.roomTypes)){hotels++;validateHotel(c);}
  else if(Array.isArray(c.units)){compounds++;validateIncomeCompound(c);}
  else fail('UNKNOWN_RESIDUAL_METHOD');
 }
 if(hotels!==2||compounds!==1||commercials!==1)fail('RESIDUAL_METHOD_COUNTS_INVALID');
 mark('SUBMETHOD_REFERENCE=PASS cases=4 source_self_consistency=true');
 mark('COMM_SCENARIO_FORMULA=BLOCKED_NOT_SPECIFIED');
 mark('PRIVATE_SOURCE_AUTHENTICITY=NOT_INDEPENDENTLY_VERIFIED');
 mark('OVERALL=HOLD independently_replayed_engine_and_signed_report_required');
 process.exit(2);
} catch(e){
 mark('OVERALL=FAIL reason='+String(e?.message||'INVALID').replace(/[^A-Z0-9_]/g,'').slice(0,65));
 process.exit(1);
}

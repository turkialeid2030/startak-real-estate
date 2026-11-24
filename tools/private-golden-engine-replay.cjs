'use strict';
// Private replay adapter: invokes current STARTAK valuation modules, not a
// substitute reference engine. Never logs fixture values, identifiers or files.
// The intake fixture does not establish executed transaction status, source
// authenticity or market rent. Outputs are limited to numerical parity counts.
const {calculateDepreciatedReplacementCost,deriveAgeLifeDepreciation}=require('../src/valuation-intelligence/cost-approach');
const {createComparable,calculateMarketComparableIndication,TRANSACTION_STATUS}=require('../src/valuation-intelligence/market-comparables');
const {calculateDirectCapitalization,EXPENSE_TREATMENT}=require('../src/valuation-intelligence/income-capitalization');
const {calculateResidualLandValue}=require('../src/valuation-intelligence/residual-approach');
const {EVIDENCE_GRADE,INPUT_STATUS}=require('../src/valuation-intelligence/contracts');
const {verifyResidualCases}=require('./private-golden-residual-reference.cjs');
const evidence=Object.freeze({grade:EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED,status:INPUT_STATUS.UNVERIFIED,sourceType:'PRIVATE_FIXTURE_ARITHMETIC_ONLY'});
const fail=code=>{throw Error(code);};
function number(x, min=0, max=1e15){
 if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)fail('PRIVATE_REPLAY_NUMERIC_INVALID');
 return x;
}
const positive=x=>number(x,Number.MIN_VALUE);
const pct=x=>number(x,0,100)/100;
const round=(x,step)=>Math.round(x/positive(step))*step;
const matches=(a,b)=>typeof b==='number'&&Number.isFinite(b)&&Math.abs(a-b)<=1e-6;
const soft=['professional','utilities','management','finance','contractorProfit'];
function replayPropertyCase(row){
 if(!row||typeof row!=='object'||!row.expected||!Array.isArray(row.components))fail('PRIVATE_REPLAY_CASE_INVALID');
 const area=positive(row.landArea);
 let landRate,landComparisonInvoked=false;
 if(row.adoptedLandRate!==null&&row.adoptedLandRate!==undefined){
  landRate=number(row.adoptedLandRate);
 }else{
  if(!Array.isArray(row.landComparables)||row.landComparables.length<2)fail('PRIVATE_REPLAY_COMPARABLES_REQUIRED');
  // ASKING_SALE is a conservative computational placeholder ONLY because
  // the historical fixture does not encode transaction status. Do not pass
  // any such rows to the canonical executed-comparables decision pipeline.
  const comparables=row.landComparables.map((x,i)=>createComparable({
   comparableId:'PRIVATE-REPLAY-'+i,unitValue:positive(x.price),
   transactionStatus:TRANSACTION_STATUS.ASKING_SALE,
   evidenceGrade:EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED,
   adjustments:[{factor:'SUPPLIED_NET_ADJUSTMENT',percent:number(x.netAdjPct,-99.999,99.999)/100}],
   weight:positive(x.weightPct)/100,
  }));
  const result=calculateMarketComparableIndication({comparables,subjectArea:area});
  landRate=round(result.components.weightedUnitValue,row.roundStep);
  landComparisonInvoked=true;
 }
 const direct=row.components.reduce((a,x)=>a+number(x.area)*number(x.rate),0);
 const depreciation=deriveAgeLifeDepreciation({effectiveAge:number(row.effectiveAge),totalEconomicLife:positive(row.usefulLife)});
 if(!row.softCostsPct||typeof row.softCostsPct!=='object')fail('PRIVATE_REPLAY_SOFT_COSTS_REQUIRED');
 const indirect=soft.map(label=>({label,amount:direct*pct(row.softCostsPct[label])}));
 let indicated=landRate*area;
 const costInvoked=direct>0;
 if(costInvoked){
  const result=calculateDepreciatedReplacementCost({landValue:indicated,directReplacementCost:direct,indirectCosts:indirect,
   depreciationRate:depreciation,landEvidence:evidence,replacementCostEvidence:evidence,depreciationEvidence:evidence});
  indicated=result.value;
 }
 // An adopted land rate with no improvements is valid in older fixtures,
 // but neither valuation engine has run. Preserve the arithmetic result
 // separately from module execution; never count it as an engine match.
 const value=round(indicated,1000);
 const derivedRent=value*number(row.rentalYieldPct,0,100)/100;
 return Object.freeze({valueMatches:matches(value,row.expected.marketValue),
  derivedRentMatches:matches(derivedRent,row.expected.marketRent),costInvoked,landComparisonInvoked,
  moduleExecuted:costInvoked||landComparisonInvoked});
}
function capitalise(gross,opexPct,capPct){
 const opex=gross*pct(opexPct);
 return calculateDirectCapitalization({effectiveGrossIncome:gross,operatingExpenses:opex,
  capitalizationRate:pct(capPct),expenseTreatment:EXPENSE_TREATMENT.MARKET_ESTIMATE,
  incomeEvidence:evidence,expenseEvidence:evidence,capRateEvidence:evidence});
}
function replayAuxiliaryCase(row){
 const expected=row.expected||{};
 if(Array.isArray(row.roomTypes)){
  const gross=row.roomTypes.reduce((a,room)=>{
   if(!Array.isArray(room.adr)||room.adr.length!==row.seasons.length)fail('PRIVATE_REPLAY_ADR_LENGTH');
   return a+number(room.count)*row.seasons.reduce((s,season,i)=>s+number(season.days)*pct(season.occPct)*number(room.adr[i]),0);
  },0);
  const cap=capitalise(gross,row.opexPct,row.capRatePct);
  const gdv=Math.round(cap.value);
  const dev=number(row.scenario.dev);
  const residual=calculateResidualLandValue({completedAssetValue:gdv,developmentCosts:dev*(1+pct(row.scenario.othPct)),
   developmentYears:number(row.periodYears),discountRate:pct(row.discountPct),
   completedValueEvidence:evidence,developmentCostEvidence:evidence,discountRateEvidence:evidence});
  const present=Math.round(residual.value),rate=round(present/positive(row.residualArea),row.roundStep);
  return {kind:'HOTEL',matches:matches(gross,expected.grossIncome)&&
    (!Object.hasOwn(expected,'noi')||matches(cap.components.netOperatingIncome,expected.noi))&&
    matches(gdv,expected.gdv)&&matches(present,expected.presentValue)&&matches(rate,expected.residualRate)};
 }
 if(Array.isArray(row.units)){
  const gross=row.units.reduce((s,u)=>s+number(u.count)*number(u.annualRent)*pct(u.occPct),0);
  const cap=capitalise(gross,row.opexPct,row.capRatePct);
  return {kind:'UNITS',matches:matches(gross,expected.grossIncome)&&matches(cap.components.netOperatingIncome,expected.noi)&&matches(Math.round(cap.value),expected.incomeValue)};
 }
 if(Array.isArray(row.scenarios))return {kind:'COMMERCIAL',matches:false,blocked:true};
 fail('PRIVATE_REPLAY_AUXILIARY_KIND_INVALID');
}
function replayPrivateFixture(fixture){
 if(!fixture||!Array.isArray(fixture.cases)||fixture.cases.length!==17||!Array.isArray(fixture.residualCases)||fixture.residualCases.length!==4)
  fail('PRIVATE_REPLAY_EXPECTED_17_PLUS_4');
 const ids=[...fixture.cases,...fixture.residualCases].map(x=>x.id);
 if(ids.some(x=>typeof x!=='string'||!x.trim())||new Set(ids).size!==ids.length)fail('PRIVATE_REPLAY_IDS_INVALID');
 const report={propertyCases:17,valueMatches:0,derivedRentMatches:0,costModuleCases:0,landComparableModuleCases:0,
  auxiliaryCases:4,auxiliaryEngineMatches:0,commercialScenarioBasisBlocked:0,propertyModuleCases:0,adoptedLandOnlyCases:0,caseMismatchOrdinals:[],auxiliaryMismatchOrdinals:[]};
 for(const [i,row] of fixture.cases.entries()){
  const v=replayPropertyCase(row);
  report.valueMatches+=Number(v.valueMatches);report.derivedRentMatches+=Number(v.derivedRentMatches);
  report.costModuleCases+=Number(v.costInvoked);report.landComparableModuleCases+=Number(v.landComparisonInvoked);
  report.propertyModuleCases+=Number(v.moduleExecuted);report.adoptedLandOnlyCases+=Number(!v.moduleExecuted);
  if(!v.valueMatches||!v.derivedRentMatches)report.caseMismatchOrdinals.push(i+1);
 }
 for(const [i,row] of fixture.residualCases.entries()){
  const v=replayAuxiliaryCase(row);
  report.auxiliaryEngineMatches+=Number(v.matches);
  report.commercialScenarioBasisBlocked+=Number(v.blocked===true);
  if(!v.matches&&!v.blocked)report.auxiliaryMismatchOrdinals.push(i+1);
 }
 // Verify the historical reference's limited downstream commercial scenario
 // arithmetic separately. This is NOT upstream GDV or engine parity.
 const auxReference=verifyResidualCases(fixture);
 return Object.freeze({...report,auxiliaryReferenceCases:auxReference.cases,
  rentalEvidenceIndependent:false,transactionClassificationVerified:false,
  rawSourceAuthenticityVerified:false,browserJourneyVerified:false,professionalApproval:false,
  exactFixtureEngineParityEstablished:false,releaseAuthorized:false});
}
module.exports={replayPropertyCase,replayAuxiliaryCase,replayPrivateFixture};

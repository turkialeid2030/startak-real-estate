'use strict';
// Synthetic, fail-closed coverage. This is NOT a real transaction data replay,
// source license, live AI call, professional appraisal or go-live authorization.
const assert=require('node:assert/strict');
const {ALL_SECTORS}=require('../../src/governance/personal-asset-universe');
const {ASSET_CLASS}=require('../../src/project-model/project-profile');
const {STATUS,MARKET_UNITS,evaluatePersonalSectorScenarios:evaluate}=
 require('../../src/valuation-intelligence/personal-sector-scenario-workbench');
const {EXPENSE_TREATMENT}=require('../../src/valuation-intelligence/income-capitalization');
const {TRANSACTION_STATUS}=require('../../src/valuation-intelligence/market-comparables');
const {assessLimitedPropertyInterest,RIGHTS,STATUS:RIGHTS_STATUS}=
 require('../../src/valuation-intelligence/personal-limited-interest-dcf');
const {assessPersonalPhasedDevelopment,STATUS:LAND_STATUS}=
 require('../../src/valuation-intelligence/personal-phased-development-dcf');
const {AI_ROLE,AI_STAGE_STATUS,buildAiExpertStage,validateAiRoleOutput}=
 require('../../src/decision-intelligence/ai-expert-orchestrator');
const {requestResidentialIncomeAiAssist,AI_ASSIST_CLIENT_STATUS}=
 require('../../src/residential-income-acquisition/ai-assist-client');

let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const ok=(x,msg)=>{assert.ok(x,msg);checks++};
function blocked(o,why){eq(o.status,STATUS.HOLD,why);eq(o.transactionAuthorized,false,why+' authority');eq(o.professionalValuationCertified,false,why+' certificate');eq(o.provisionalReconciledAmountSar,null,why+' no blend');}
function noAuthority(o,why){
 eq(o.transactionAuthorized,false,why+' no purchase authorization');
 eq(o.professionalValuationCertified,false,why+' no licensed appraisal');
 eq(o.marketSalesIndependentlyVerified,false,why+' comps not verified');
 eq(o.capRateIndependentlyVerified,false,why+' cap source not verified');
 eq(o.commercialReportAuthorized,false,why+' no official report');
}
function base(assetClass){return {assetClass,city:'Riyadh',propertySubtype:'synthetic-subtype',
 subjectDistrict:'SyntheticDistrict',valuationDate:'2026-10-25',subjectAreaSqm:500,propertyRight:'FREEHOLD'};}
const income=()=>({
 annualEffectivePropertyIncome:1200000,annualPropertyOperatingExpenses:240000,
 capRate:0.08,expenseTreatment:EXPENSE_TREATMENT.ACTUAL_LANDLORD_OPEX,
 realEstateOnlyConfirmed:true,groundLeaseEvidenceConfirmed:true,
 sharedCostsAllocated:true,
});
const cost=()=>({landValue:3000000,replacementBuildingCost:7000000,depreciationRate:0.2,
 businessEquipmentExcluded:true});
const market=(assetClass)=>({
 unitOfComparison:MARKET_UNITS[assetClass][0],subjectQuantity:20,
 businessAssetsExcluded:true,mixedUseComparableAllocationConfirmed:true,
 comparables:[1,2,3].map(i=>({
  comparableId:'SYN-'+assetClass+'-'+i,city:'Riyadh',district:'SyntheticDistrict',
  assetClass,propertySubtype:'synthetic-subtype',propertyRight:'FREEHOLD',
  unitOfComparison:MARKET_UNITS[assetClass][0],
  transactionDate:'2026-08-0'+i,
  transactionStatus:TRANSACTION_STATUS.EXECUTED_SALE,
  unitValue:12000+i*100,sourceRef:'SYNTHETIC-UNVERIFIED-'+i,
 })),
});
async function main(){
 const sectors=Object.keys(ALL_SECTORS);
 eq(sectors.length,13,'must cover 13 sector classifications');
 eq(new Set(sectors).size,13,'unique asset classes');
 eq(new Set(Object.values(ASSET_CLASS)).size,13,'canonical project classes consistent');
 let incomeCount=0,costCount=0,salesCount=0;
 for(const assetClass of sectors){
  const row=base(assetClass);
  blocked(evaluate(row),assetClass+' blank HOLD');
  blocked(evaluate({...row,propertyRight:'WAQF_RESTRICTED',income:income()}),assetClass+' restricted waqf HOLD');
  const i=evaluate({...row,income:income()});
  eq(i.status,STATUS.PARTIAL,assetClass+' income private scenario');
  eq(i.methods.length,1,assetClass+' exactly income method');
  ok(Math.abs(i.methods[0].scenarioAmountSar-12000000)<.001,assetClass+' independent NOI/cap value');
  noAuthority(i,assetClass+' income');incomeCount++;
  if(assetClass!=='LAND'){
   const c=evaluate({...row,cost:cost()});
   eq(c.status,STATUS.PARTIAL,assetClass+' cost private scenario');
   eq(c.methods.length,1,assetClass+' cost method only');
   ok(Math.abs(c.methods[0].scenarioAmountSar-8600000)<.001,assetClass+' independent cost/depreciation');
   noAuthority(c,assetClass+' cost');costCount++;
  }else{
   const c=evaluate({...row,cost:cost()});
   blocked(c,'LAND cannot use building replacement');
   ok(c.reasonCodes.includes('LAND_ONLY_REQUIRES_LAND_METHOD_NOT_BUILDING_REPLACEMENT'),'LAND cost explicit reason');
  }
  if((MARKET_UNITS[assetClass]||[]).length>0){
   const m=evaluate({...row,market:market(assetClass)});
   eq(m.status,STATUS.PARTIAL,assetClass+' sales private scenario');
   eq(m.methods.length,1,assetClass+' sales method only');
   ok(m.methods[0].scenarioAmountSar>0,assetClass+' sales nonzero indication');
   noAuthority(m,assetClass+' sales');salesCount++;
   const bad=market(assetClass);bad.comparables[1].comparableId=bad.comparables[0].comparableId;
   const rejected=evaluate({...row,market:bad});
   blocked(rejected,assetClass+' duplicate sale rejected');
   ok(rejected.reasonCodes.includes('MARKET_COMPARABLE_IDENTITY_DATE_OR_STATUS_INVALID'),'duplicate detected');
   const offer=market(assetClass);offer.comparables[0].transactionStatus=TRANSACTION_STATUS.ASKING_SALE;
   blocked(evaluate({...row,market:offer}),assetClass+' asking sale is not executed');
   const future=market(assetClass);future.comparables[0].transactionDate='2026-12-02';
   blocked(evaluate({...row,market:future}),assetClass+' future sale not accepted');
  }else{
   blocked(evaluate({...row,market:{...market('LAND'),unitOfComparison:'SQM'}}),'OTHER no comparable unit authorized');
  }
  const failedCap=evaluate({...row,income:{...income(),capRate:0}});
  blocked(failedCap,assetClass+' cap zero');
  const impossibleNoi=evaluate({...row,income:{...income(),annualPropertyOperatingExpenses:1200000}});
  blocked(impossibleNoi,assetClass+' OPEX at income');
 }
 eq(incomeCount,13,'all sectors have arithmetic private income routes (not specialist certification)');
 eq(costCount,12,'all building-like classes expose purely arithmetic replacement scenario');
 eq(salesCount,12,'all supported compare units are synthetic research only');
 const three=evaluate({...base('RESIDENTIAL'),income:income(),cost:cost(),market:market('RESIDENTIAL')});
 eq(three.methods.length,3,'all 3 research approaches calculate together');
 eq(three.status,STATUS.PARTIAL,'three methods without policy still partial');
 noAuthority(three,'three-method missing weights');
 const rightsBase=(assetClass)=>({
  assetClass,propertyRight:RIGHTS.USUFRUCT,valuationDate:'2026-10-25',termYears:5,
  annualPropertyIncomeSar:1200000,annualPropertyOperatingExpenseSar:200000,
  annualGroundRentSar:180000,annualSustainingCapexSar:20000,
  incomeEscalationRate:0.02,operatingExpenseEscalationRate:0.02,
  groundRentEscalationRate:0.02,nominalDiscountRate:0.1,
  upfrontRightConsiderationSar:1500000,
  termsCheckedAgainstContract:true,propertyOnlyCashflowsConfirmed:true,
  improvementOwnershipAtTermEnd:false,assignabilityRequiresConsent:false,
  consentDocumentUserDeclared:false,
 });
 for(const assetClass of sectors){
  const r=assessLimitedPropertyInterest(rightsBase(assetClass));
  eq(r.status,RIGHTS_STATUS.RESEARCH,assetClass+' limited term research');
  eq(r.termYears,5,assetClass+' explicit contract term');
  eq(r.periods.length,5,assetClass+' cash flow per year');
  eq(r.purchaseAuthorized,false,assetClass+' legal no transaction');
  eq(r.professionalValuationCertified,false,assetClass+' no accredited valuation');
  eq(r.terminalReversionAssumed,false,assetClass+' no fictitious residual title');
  eq(r.legalTransferabilityIndependentlyVerified,false,assetClass+' legal source HOLD');
  eq(assessLimitedPropertyInterest({...rightsBase(assetClass),propertyRight:RIGHTS.WAQF_RESTRICTED}).status,RIGHTS_STATUS.HOLD,assetClass+' restricted waqf');
  eq(assessLimitedPropertyInterest({...rightsBase(assetClass),improvementOwnershipAtTermEnd:true}).status,RIGHTS_STATUS.HOLD,assetClass+' reversion not assumed');
 }
 const development={
  assetClass:'LAND',propertyRight:'FREEHOLD',valuationDate:'2026-10-25',landAreaSqm:1000,
  annualDiscountRate:0.12,periods:[
   {month:0,gdvReceiptsSar:0,constructionCostsSar:300000,otherDevelopmentCostsSar:0},
   {month:12,gdvReceiptsSar:1500000,constructionCostsSar:500000,otherDevelopmentCostsSar:50000},
   {month:24,gdvReceiptsSar:1300000,constructionCostsSar:200000,otherDevelopmentCostsSar:60000},
  ],riskAndDeveloperReturnIncludedInDiscountRate:true,
  noSeparateDeveloperProfitOrRiskSpread:true,
  noFinancingCostsOrDebtServiceIncluded:true,
  nonRealtyBusinessAndEquipmentExcluded:true,documentedTimingReviewed:true,
 };
 const d=assessPersonalPhasedDevelopment(development);
 eq(d.status,LAND_STATUS.RESEARCH,'phased development research only');
 const reference=-300000+(1500000-500000-50000)/1.12+(1300000-200000-60000)/(1.12**2);
 ok(Math.abs(d.landResidualPvSar-reference)<0.001,'independent month 0, 12, 24 discounted reference');
 eq(d.transactionAuthorized,false,'phased development cannot authorize acquisition');
 eq(d.officialValuationCertified,false,'phased development cannot certify');
 eq(assessPersonalPhasedDevelopment({...development,noFinancingCostsOrDebtServiceIncluded:false}).status,LAND_STATUS.HOLD,
  'finance interest and risk cannot be double counted');
 eq(assessPersonalPhasedDevelopment({...development,periods:development.periods.map(p=>({...p,gdvReceiptsSar:0}))}).status,LAND_STATUS.HOLD,
  'no sales revenue is HOLD');
 const quality={
  caseId:'SYN_CASE',projectId:'SYN_PROJECT',status:'RESEARCH_ONLY',
  reliability:{overallReliability:'HIGH'},feedback:{},dueDiligence:{nextBestAction:'VERIFY_SOURCE'},
 };
 const dossier={caseId:'SYN_CASE',projectId:'SYN_PROJECT',dossierStatus:'RESEARCH_ONLY',
  aiNarrativeContext:{factRefs:[{ref:'SYN_FACT',key:'noi',value:960000,unit:'SAR'}]}};
 const stageParams={role:AI_ROLE.ANALYST,caseId:'SYN_CASE',projectId:'SYN_PROJECT',
  contextVersionId:'VERSION1',evidenceHash:'SYN_HASH',decisionQuality:quality,dossier};
 for(const role of Object.values(AI_ROLE)){
  const stage=buildAiExpertStage({...stageParams,role});
  eq(stage.status,AI_STAGE_STATUS.READY_FOR_MODEL_CALL,role+' stage is input contract only');
  eq(stage.modelCallExecuted,false,role+' never pretends LLM was called');
  eq(stage.transactionAuthorized,false,role+' no transaction');
  eq(stage.mayOverrideDeterministicOutputs,false,role+' no model override');
  const legitimate={caseId:'SYN_CASE',projectId:'SYN_PROJECT',contextVersionId:'VERSION1',
   evidenceHash:'SYN_HASH',role,narrative:'The assumptions require separate source review.',
   citedEvidenceRefs:['SYN_FACT'],financialClaims:[{ref:'SYN_FACT',key:'noi',value:960000,unit:'SAR'}]};
  const valid=validateAiRoleOutput({stage,output:legitimate});
  eq(valid.accepted,true,role+' exact numeric copy with source identifier accepted as narrative');
  eq(valid.transactionAuthorized,false,role+' accepted narrative cannot buy');
  eq(valid.numericConfidence,null,role+' uncalibrated probability never claimed');
  function rejected(x,reason){const k=validateAiRoleOutput({stage,output:{...legitimate,...x}});
   eq(k.accepted,false,role+' rejected: '+reason);
   ok(k.reasonCodes.includes(reason),role+' rejection reason');}
  rejected({narrative:'Please buy this building.'},'PROHIBITED_DECISION_LANGUAGE');
  rejected({narrative:'يجب الشراء الآن'},'PROHIBITED_DECISION_LANGUAGE');
  rejected({narrative:'This property is worth 10 million.'},'UNSTRUCTURED_NUMERIC_CLAIM');
  rejected({financialClaims:[{ref:'SYN_FACT',key:'noi',value:999999,unit:'SAR'}]},'NUMERIC_CLAIM_NOT_BOUND_TO_SNAPSHOT');
  rejected({citedEvidenceRefs:['FORGED_REF']},'UNKNOWN_EVIDENCE_REFERENCE');
  rejected({numericConfidence:.99},'UNCALIBRATED_NUMERIC_CONFIDENCE_NOT_ALLOWED');
  rejected({certifiedValuationProduced:true},'CERTIFIED_VALUATION_NOT_ALLOWED');
  rejected({transactionAuthorized:true},'TRANSACTION_AUTHORIZATION_NOT_ALLOWED');
  rejected({evidenceHash:'OLD_HASH'},'STALE_OR_MISMATCHED_CONTEXT');
 }
 for(const fin of ['INCOMPLETE_INPUTS']){
  const st=buildAiExpertStage({...stageParams,financialModelStatus:fin});
  eq(st.status,AI_STAGE_STATUS.HOLD_INCOMPLETE_INPUTS,'incomplete model blocks model call');
  eq(st.modelCallExecuted,false,'no hallucinated invocation on HOLD');
 }
 const stale=buildAiExpertStage({...stageParams,decisionQuality:{
  ...quality,feedback:{materialUpstreamChange:true,aiOpinion:{status:'STALE_REANALYSIS_REQUIRED'}}}});
 eq(stale.status,AI_STAGE_STATUS.HOLD_STALE_CONTEXT,'stale AI context remains HOLD');
 eq(validateAiRoleOutput({stage:stale,output:{
  caseId:'SYN_CASE',projectId:'SYN_PROJECT',role:'ANALYST',narrative:'No decision',
 }}).accepted,false,'stale output rejected');
 const low=buildAiExpertStage({...stageParams,decisionQuality:{
  ...quality,reliability:{overallReliability:'LOW'}}});
 eq(low.status,AI_STAGE_STATUS.HOLD_RELIABILITY,'unreliable AI stage blocks model calls');
 const pro=buildAiExpertStage({...stageParams,dossier:{...dossier,dossierStatus:'PROFESSIONAL_REVIEW_REQUIRED'}});
 eq(pro.status,AI_STAGE_STATUS.HOLD_PROFESSIONAL_REVIEW,'licensed professional review gate');
 const noCase=await requestResidentialIncomeAiAssist(null);
 eq(noCase.status,AI_ASSIST_CLIENT_STATUS.NOT_READY,'AI assistant uninitialized state no model call');
 eq(noCase.aiModelUsed,false,'no live LLM erroneously claimed');
 console.log('FULL_STARTAK_SYNTHETIC_SIMULATION=PASS checks='+checks+
  ' sectors=13 income='+incomeCount+' cost='+costCount+' market='+salesCount+
  ' limitedRights=13 modelRoles=3 liveMarketSources=0 liveProviderCalls=0');
}
main().catch(e=>{console.error('FULL_STARTAK_SYNTHETIC_SIMULATION=FAIL',e);process.exitCode=1;});

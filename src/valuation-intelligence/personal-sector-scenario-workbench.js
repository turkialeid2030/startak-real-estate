'use strict';

const {ASSET_CLASS}=require('../project-model/project-profile');
const {ALL_SECTORS}=require('../governance/personal-asset-universe');
const {calculateDirectCapitalization,EXPENSE_TREATMENT}=require('./income-capitalization');
const {calculateDepreciatedReplacementCost}=require('./cost-approach');
const {createComparable,calculateMarketComparableIndication,TRANSACTION_STATUS,WEIGHTING_POLICY}=require('./market-comparables');
const {reconcileValuationIndications,RECONCILIATION_STATUS}=require('./reconciliation');
const {EVIDENCE_GRADE,INPUT_STATUS,VALUATION_METHOD}=require('./contracts');

const VERSION='PERSONAL_SECTOR_RESEARCH_SCENARIOS_V1';
const STATUS=Object.freeze({
 HOLD:'HOLD_INPUT_OR_SECTOR_POLICY',
 PARTIAL:'INDIVIDUAL_METHOD_SCENARIOS_ONLY',
 RECONCILED:'MULTI_METHOD_RESEARCH_ONLY',
});
const EXCLUSION_CLASSES=new Set([
 ASSET_CLASS.INDUSTRIAL_LOGISTICS,ASSET_CLASS.HOSPITALITY,ASSET_CLASS.HEALTHCARE,
 ASSET_CLASS.EDUCATION,ASSET_CLASS.PARKING,ASSET_CLASS.DATA_CENTER,
 ASSET_CLASS.MIXED_USE,ASSET_CLASS.SPECIAL_PURPOSE,ASSET_CLASS.OTHER,
]);
const MONEY_MAX=1e13;
function positive(n,max=MONEY_MAX){return typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=max;}
function nonNegative(n,max=MONEY_MAX){return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;}
function properDate(x){if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
 const d=new Date(x+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===x;}
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const y of Object.values(x))freeze(y);Object.freeze(x);}return x;}
const unverified=(sourceRef)=>({
 grade:EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED,
 status:INPUT_STATUS.UNVERIFIED,sourceType:'OWNER_RESEARCH_INPUT',
 sourceRef:sourceRef||null,
});
function result(status,reasonCodes,methodIndications=[],reconciliation=null){
 return freeze({
  version:VERSION,status,reasonCodes:[...new Set(reasonCodes)],
  methods:methodIndications.map(x=>({
   method:x.method,scenarioAmountSar:x.value,
   netOperatingIncomeSar:x.components?.netOperatingIncome??null,
   status:'USER_ASSUMPTION_SCENARIO_NOT_A_CERTIFIED_VALUE',
  })),
  reconciliationStatus:reconciliation?.status||null,
  // Always research only, even if a mathematical reconciliation returns QUALIFIED.
  provisionalReconciledAmountSar:reconciliation?.status===RECONCILIATION_STATUS.QUALIFIED
   ? reconciliation.reconciledValue:null,
  marketSalesIndependentlyVerified:false,
  capRateIndependentlyVerified:false,
  inputsIndependentlyVerified:false,
  professionalValuationCertified:false,transactionAuthorized:false,
  bankFinancingDecisionAuthorized:false,automaticPurchasePriceRecommendation:false,
  commercialReportAuthorized:false,
  semantics:'A private numerical research scenario, not a verified Saudi market value, sector appraisal, approved price or purchase authorization.',
 });
}
function evaluatePersonalSectorScenarios({
 assetClass,city,propertySubtype,valuationDate,subjectAreaSqm,propertyRight,
 income=null,cost=null,market=null,reconciliationPolicy=null,
}={}){
 const blockers=[];
 if(!ALL_SECTORS[assetClass])blockers.push('UNKNOWN_ASSET_CLASS');
 if(typeof city!=='string'||!city.trim()||city.length>130)blockers.push('CITY_REQUIRED');
 if(typeof propertySubtype!=='string'||!propertySubtype.trim()||propertySubtype.length>140)blockers.push('PROPERTY_SUBTYPE_REQUIRED');
 if(!properDate(valuationDate))blockers.push('VALUATION_DATE_INVALID');
 if(!positive(subjectAreaSqm,1e9))blockers.push('SUBJECT_AREA_REQUIRED');
 if(!['FREEHOLD','LEASEHOLD','USUFRUCT','WAQF_RESTRICTED'].includes(propertyRight))
  blockers.push('PROPERTY_RIGHT_UNDEFINED');
 else if(propertyRight!=='FREEHOLD')
  blockers.push('RESTRICTED_PROPERTY_INTEREST_REQUIRES_SPECIFIC_CASHFLOW_MODEL');
 if(!income&&!cost&&!market)blockers.push('AT_LEAST_ONE_METHOD_REQUIRED');
 if(blockers.length)return result(STATUS.HOLD,blockers);
 const indications=[];
 if(income){
  // Direct capitalization is a scenario only when the owner explicitly
  // separates the real-estate income from commercial/clinical/IT operations.
  if(assetClass===ASSET_CLASS.LAND&&income.groundLeaseEvidenceConfirmed!==true)
   blockers.push('GROUND_RENT_INSTEAD_OF_BUILDING_NOI_REQUIRED');
  if(EXCLUSION_CLASSES.has(assetClass)&&income.realEstateOnlyConfirmed!==true)
   blockers.push('OPERATING_BUSINESS_NOI_NOT_SEPARATED');
  if(assetClass===ASSET_CLASS.MIXED_USE&&income.sharedCostsAllocated!==true)
   blockers.push('MIXED_USE_SHARED_COSTS_UNALLOCATED');
  if(!positive(income.annualEffectivePropertyIncome)||!nonNegative(income.annualPropertyOperatingExpenses)||
    income.annualPropertyOperatingExpenses>=income.annualEffectivePropertyIncome)
   blockers.push('PROPERTY_NOI_INPUTS_INVALID');
  if(!positive(income.capRate,0.5)||income.capRate>=0.5)
   blockers.push('CAP_RATE_MISSING_OR_OUT_OF_BOUNDS');
  if(!Object.values(EXPENSE_TREATMENT).includes(income.expenseTreatment))
   blockers.push('OPERATING_EXPENSE_POLICY_REQUIRED');
  if(income.annualPropertyOperatingExpenses===0&&
    ![EXPENSE_TREATMENT.TENANT_BORNE_CONFIRMED,EXPENSE_TREATMENT.TENANT_BORNE_ASSUMED].includes(income.expenseTreatment))
   blockers.push('ZERO_OPEX_NO_TENANT_POLICY');
  if(!blockers.length){
   indications.push(calculateDirectCapitalization({
    effectiveGrossIncome:income.annualEffectivePropertyIncome,
    operatingExpenses:income.annualPropertyOperatingExpenses,
    capitalizationRate:income.capRate,expenseTreatment:income.expenseTreatment,
    incomeEvidence:unverified(income.incomeSourceRef),
    expenseEvidence:unverified(income.expenseSourceRef),
    capRateEvidence:unverified(income.rateSourceRef),
    valuationDate,currency:'SAR',
   }));
  }
 }
 if(cost){
  if(!nonNegative(cost.landValue)||!positive(cost.replacementBuildingCost)||
     !nonNegative(cost.depreciationRate,1)||cost.depreciationRate>1)
    blockers.push('REPLACEMENT_COST_INPUTS_INVALID');
  if(assetClass===ASSET_CLASS.LAND)blockers.push('LAND_ONLY_REQUIRES_LAND_METHOD_NOT_BUILDING_REPLACEMENT');
  if(EXCLUSION_CLASSES.has(assetClass)&&cost.businessEquipmentExcluded!==true)
   blockers.push('NON_REAL_ESTATE_COMPONENTS_NOT_EXCLUDED_FROM_COST');
  if(!blockers.length){
   indications.push(calculateDepreciatedReplacementCost({
    landValue:cost.landValue,directReplacementCost:cost.replacementBuildingCost,
    depreciationRate:cost.depreciationRate,valuationDate,currency:'SAR',
    landEvidence:unverified(cost.landEvidenceRef),
    replacementCostEvidence:unverified(cost.replacementEvidenceRef),
    depreciationEvidence:unverified(cost.depreciationEvidenceRef),
   }));
  }
 }
 if(market){
  if(!Array.isArray(market.comparables)||market.comparables.length<3||
     market.comparables.length>20) blockers.push('AT_LEAST_THREE_EXECUTED_COMPARABLES_REQUIRED');
  const ids=new Set();
  if(!blockers.length){
   const normalized=[];
   for(const x of market.comparables){
    const sameCity=typeof x?.city==='string'&&x.city.trim()===city.trim();
    const sameAsset=x?.assetClass===assetClass&&x?.propertySubtype===propertySubtype&&
      x?.propertyRight===propertyRight;
    const dated=properDate(x?.transactionDate)&&x.transactionDate<=valuationDate;
    const ref=typeof x?.sourceRef==='string'&&x.sourceRef.trim().length>0;
    const id=typeof x?.comparableId==='string'&&x.comparableId.trim();
    if(!id||ids.has(id)||!sameCity||!sameAsset||!dated||!ref||
       x.transactionStatus!==TRANSACTION_STATUS.EXECUTED_SALE||
       !positive(x.unitValue,1e11)){
     blockers.push('MARKET_COMPARABLE_IDENTITY_DATE_OR_STATUS_INVALID');break;
    }
    ids.add(id);
    normalized.push(createComparable({
      comparableId:id,unitValue:x.unitValue,
      transactionStatus:TRANSACTION_STATUS.EXECUTED_SALE,
      evidenceGrade:EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED,
      transactionDate:x.transactionDate,sourceRef:x.sourceRef,weight:null,
    }));
   }
   if(!blockers.length){
    indications.push(calculateMarketComparableIndication({
     comparables:normalized,subjectArea:subjectAreaSqm,
     weightingPolicy:WEIGHTING_POLICY.EQUAL,valuationDate,currency:'SAR',
    }));
   }
  }
 }
 if(blockers.length)return result(STATUS.HOLD,blockers);
 if(indications.length<2)return result(STATUS.PARTIAL,['SECOND_INDEPENDENT_METHOD_NOT_PROVIDED'],indications);
 if(!reconciliationPolicy||!nonNegative(reconciliationPolicy.maxDispersion,1)||
    !reconciliationPolicy.methodWeights){
  return result(STATUS.PARTIAL,['RECONCILIATION_POLICY_REQUIRED'],indications);
 }
 try{
  const rec=reconcileValuationIndications({
    indications,methodWeights:reconciliationPolicy.methodWeights,
    dispersionThreshold:reconciliationPolicy.maxDispersion,
  });
  if(rec.status!==RECONCILIATION_STATUS.QUALIFIED){
   return result(STATUS.PARTIAL,[rec.status],indications,rec);
  }
  return result(STATUS.RECONCILED,['INDEPENDENT_MARKET_AND_SPECIALIST_EVIDENCE_STILL_REQUIRED'],indications,rec);
 }catch(e){
  return result(STATUS.PARTIAL,['RECONCILIATION_POLICY_INVALID'],indications);
 }
}
module.exports={VERSION,STATUS,evaluatePersonalSectorScenarios};

'use strict';

// C55 owner-only monthly development cashflow research. Additive to, and
// deliberately separate from, the unchanged nominal and terminal residuals.
const MODEL_VERSION='PERSONAL_PHASED_DEVELOPMENT_DCF_V1';
const STATUS=Object.freeze({HOLD:'HOLD_METHOD_OR_EVIDENCE',RESEARCH:'OWNER_ONLY_TIME_SCHEDULED_RESEARCH'});
const MAX_MONTH=120,MAX_ROWS=24,MAX_AMOUNT=1e13;
function dateOK(s){
 if(typeof s!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s))return false;
 const d=new Date(s+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
}
function amount(n){return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=MAX_AMOUNT;}
function deepFreeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){for(const v of Object.values(o))deepFreeze(v);Object.freeze(o);}return o;}
function hold(reasons,rows=[]){return deepFreeze({
 modelVersion:MODEL_VERSION,status:STATUS.HOLD,reasonCodes:[...new Set(reasons)],
 landResidualPvSar:null,landResidualPvPerSqmSar:null,nominalNetBeforeLandSar:null,
 periods:rows,financeCostsAutomaticallyEstimated:false,independentMarketEvidenceVerified:false,
 officialValuationCertified:false,transactionAuthorized:false,professionalReviewRequired:true,
});}
function assessPersonalPhasedDevelopment({
 assetClass,propertyRight,valuationDate,landAreaSqm,annualDiscountRate,periods,
 riskAndDeveloperReturnIncludedInDiscountRate=false,
 noSeparateDeveloperProfitOrRiskSpread=true,
 noFinancingCostsOrDebtServiceIncluded=true,
 nonRealtyBusinessAndEquipmentExcluded=false,
 documentedTimingReviewed=false,
}={}){
 const reasons=[];
 if(assetClass!=='LAND')reasons.push('LAND_DEVELOPMENT_ONLY');
 if(propertyRight!=='FREEHOLD')reasons.push('LEGAL_PROPERTY_RIGHT_REQUIRES_SEPARATE_MODEL');
 if(!dateOK(valuationDate))reasons.push('VALUATION_DATE_INVALID');
 if(!amount(landAreaSqm)||landAreaSqm===0)reasons.push('LAND_AREA_REQUIRED');
 if(typeof annualDiscountRate!=='number'||!Number.isFinite(annualDiscountRate)||
    annualDiscountRate<0||annualDiscountRate>0.75)reasons.push('DISCOUNT_RATE_INVALID');
 if(!riskAndDeveloperReturnIncludedInDiscountRate)reasons.push('RISK_AND_DEVELOPER_RETURN_TREATMENT_REQUIRED');
 if(!noSeparateDeveloperProfitOrRiskSpread)reasons.push('DEVELOPER_RETURN_DOUBLE_COUNT_RISK');
 if(!noFinancingCostsOrDebtServiceIncluded)reasons.push('FINANCING_AND_DISCOUNT_DOUBLE_COUNT_RISK');
 if(!nonRealtyBusinessAndEquipmentExcluded)reasons.push('NON_REALTY_GDV_NOT_EXCLUDED');
 if(!documentedTimingReviewed)reasons.push('DATED_PHASES_NOT_REVIEWED');
 if(!Array.isArray(periods)||periods.length<2||periods.length>MAX_ROWS)
  reasons.push('PHASES_2_TO_24_REQUIRED');
 const normalized=[];
 if(Array.isArray(periods)&&periods.length<=MAX_ROWS){
  const months=new Set();
  for(const row of periods){
   if(!row||typeof row!=='object'||Array.isArray(row)){
    reasons.push('PHASE_ROW_INVALID');continue;
   }
   const {month,gdvReceiptsSar,constructionCostsSar,otherDevelopmentCostsSar}=row;
   if(!Number.isSafeInteger(month)||month<0||month>MAX_MONTH){
    reasons.push('PHASE_MONTH_INVALID');continue;
   }
   if(months.has(month))reasons.push('DUPLICATE_MONTH');months.add(month);
   if(![gdvReceiptsSar,constructionCostsSar,otherDevelopmentCostsSar].every(amount)){
    reasons.push('PHASE_AMOUNT_INVALID');continue;
   }
   if(gdvReceiptsSar+constructionCostsSar+otherDevelopmentCostsSar===0)reasons.push('EMPTY_PHASE');
   normalized.push({month,gdvReceiptsSar,constructionCostsSar,otherDevelopmentCostsSar});
  }
 }
 const latest=normalized.length?Math.max(...normalized.map(x=>x.month)):0;
 if(latest<=0)reasons.push('FUTURE_PERIOD_REQUIRED');
 if(!normalized.some(x=>x.gdvReceiptsSar>0))reasons.push('DATED_GDV_REQUIRED');
 if(!normalized.some(x=>x.constructionCostsSar>0))reasons.push('DATED_CONSTRUCTION_COST_REQUIRED');
 if(annualDiscountRate===0&&latest>0)reasons.push('ZERO_RATE_WITH_FUTURE_DEVELOPMENT_HOLD');
 if(reasons.length)return hold(reasons);
 const sorted=normalized.sort((a,b)=>a.month-b.month);
 let pv=0,nominal=0;
 const dated=[];
 for(const r of sorted){
  // MONTH-END convention: 0 = valuation date, month 12 = exactly one year.
  const factor=Math.pow(1+annualDiscountRate,r.month/12);
  const net=r.gdvReceiptsSar-r.constructionCostsSar-r.otherDevelopmentCostsSar;
  const discountedNet=net/factor;
  if(!Number.isFinite(net)||!Number.isFinite(factor)||!Number.isFinite(discountedNet)||
     Math.abs(net)>1e15||Math.abs(discountedNet)>1e15)return hold(['OVERFLOW']);
  pv+=discountedNet;nominal+=net;
  dated.push({...r,nominalNetSar:net,discountFactor:factor,discountedNetSar:discountedNet});
 }
 if(!Number.isFinite(pv)||!Number.isFinite(nominal)||Math.abs(pv)>1e15)
  return hold(['OVERFLOW']);
 // Negative residual is an infeasible project, never an owner buying recommendation.
 if(pv<=0)return hold(['NON_POSITIVE_RESIDUAL_LAND_VALUE'],dated);
 return deepFreeze({
  modelVersion:MODEL_VERSION,status:STATUS.RESEARCH,
  reasonCodes:['USER_DECLARED_SCHEDULE_NOT_INDEPENDENTLY_VERIFIED',
   'SAUDI_LAND_RIGHTS_PLANNING_AND_PERMITS_UNVERIFIED','PROFESSIONAL_REVIEW_REQUIRED'],
  valuationDate,assetClass,propertyRight,annualDiscountRate,landAreaSqm,
  periods:dated,nominalNetBeforeLandSar:nominal,
  landResidualPvSar:pv,landResidualPvPerSqmSar:pv/landAreaSqm,
  discountConvention:'EFFECTIVE_ANNUAL_RATE_MONTH_END_EXPONENT_MONTH_OVER_12',
  developerReturnTreatment:'IN_ANNUAL_DISCOUNT_RATE_NO_SEPARATE_PROFIT_OR_RISK_SPREAD',
  financingTreatment:'UNLEVERED_EXCLUDES_FINANCE_COSTS_AND_DEBT_SERVICE',
  landPriceTreatment:'LAND_ACQUISITION_OUTLAY_EXCLUDED_RESULT_IS_PRELIMINARY_RESIDUAL_CEILING_BEFORE_PURCHASE_COSTS',
  sourceAssumptionsUserDeclared:true,financeCostsAutomaticallyEstimated:false,
  independentMarketEvidenceVerified:false,officialValuationCertified:false,
  transactionAuthorized:false,professionalReviewRequired:true,
  semantics:'Owner-only phased monthly research; not the unchanged nominal residual model, not approved Saudi market land value or a certified acquisition ceiling.',
 });
}
module.exports={MODEL_VERSION,STATUS,MAX_ROWS,assessPersonalPhasedDevelopment};

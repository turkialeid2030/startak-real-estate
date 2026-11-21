'use strict';
// Auditable, non-certified cross-method valuation and market-rent checks.
// Pure functions; no client valuation inputs, source reports or personal data.
// Use the canonical strict Arabic/English numeric parser. The exploratory
// location engine intentionally strips arbitrary commas/whitespace; using it
// for financial audits silently reinterpreted "1,2" as 12 SAR or "1 2" as 12.
const {parseNumericText}=require('../validation/numeric-text');
const valid=(v,min=0,max=1e15)=>{
  const parsed=parseNumericText(v);
  const n=parsed.ok?parsed.value:null;
  return n!==null&&Number.isFinite(n)&&n>=min&&n<=max?n:null;
};
const supplied=v=>v!==undefined&&v!==null&&v!=='';
const money=v=>Math.round((v+Number.EPSILON)*100)/100;
const gap=(a,b)=>a>0&&b>0?Math.abs(a-b)/Math.max(a,b):null;
function detailedReplacementCost({landArea,landPricePerSqm,components,
  feeRatesPct={},effectiveAgeYears,buildingLifeYears,depreciationPct,
  finalRoundingStep=1000}={}){
  const errors=[],warnings=[];
  const land=valid(landArea,0.0001),landUnit=valid(landPricePerSqm,0.0001);
  if(land===null||landUnit===null)errors.push('LAND_COST_INPUTS_REQUIRED');
  const componentRows=Array.isArray(components)&&components.length>0&&components.length<=30
    ?components:[];
  if(!componentRows.length)errors.push('BUILDING_COMPONENTS_REQUIRED');
  let buildingDirectCost=0;
  for(const [i,row] of componentRows.entries()){
    // A malformed row must produce a governed INCOMPLETE result rather than
    // an uncaught TypeError during customer-facing cost-study calculations.
    if(!row||typeof row!=='object'||Array.isArray(row)){
      errors.push('BUILDING_COMPONENT_INVALID_'+i);continue;
    }
    const area=valid(row.area,0.0001),rate=valid(row.ratePerSqm,0.0001);
    if(area===null||rate===null){errors.push('BUILDING_COMPONENT_INVALID_'+i);continue;}
    buildingDirectCost+=area*rate;
  }
  const fees={};let totalExtraRate=0;
  if(!feeRatesPct||typeof feeRatesPct!=='object'||Array.isArray(feeRatesPct))
    errors.push('FEES_INVALID');
  else for(const [k,v] of Object.entries(feeRatesPct)){
    const pct=valid(v,0,100);
    if(pct===null)errors.push('FEE_INVALID_'+k);
    else {fees[k]=pct;totalExtraRate+=pct;}
  }
  if(totalExtraRate>100)errors.push('FEES_EXCESSIVE_REVIEW');
  let depreciation=depreciationPct===undefined?null:valid(depreciationPct,0,100);
  if(depreciationPct===undefined){
    const age=valid(effectiveAgeYears,0,500),life=valid(buildingLifeYears,0.0001,500);
    if(age===null||life===null)errors.push('DEPRECIATION_AGE_DATA_REQUIRED');
    else depreciation=Math.min(100,age/life*100);
  }
  if(depreciation===null)errors.push('DEPRECIATION_INVALID');
  const rounding=valid(finalRoundingStep,1,1e6);
  if(rounding===null)errors.push('FINAL_ROUNDING_INVALID');
  if(errors.length)return {status:'INCOMPLETE',issues:errors,valueSar:null,certified:false};
  const landValue=land*landUnit;
  const extraCosts=buildingDirectCost*totalExtraRate/100;
  const grossBuilding=buildingDirectCost+extraCosts;
  const depreciationAmount=grossBuilding*depreciation/100;
  const buildingAfterDepreciation=grossBuilding-depreciationAmount;
  const unroundedValue=landValue+buildingAfterDepreciation;
  // Individually finite fields can still overflow when multiplied. Neither
  // Infinity nor economically meaningless oversized totals may become a
  // displayed SAR amount or a comparable valuation indication.
  if([landValue,buildingDirectCost,extraCosts,grossBuilding,
      depreciationAmount,buildingAfterDepreciation,unroundedValue].some(
        value=>!Number.isFinite(value)||value<0||value>1e15)){
    return {status:'INCOMPLETE',issues:['COST_TOTAL_OUT_OF_RANGE'],
      valueSar:null,certified:false};
  }
  if(depreciation>=60)warnings.push('HIGH_DEPRECIATION_REQUIRES_CONDITION_REPORT');
  if(totalExtraRate>25)warnings.push('SOFT_COST_RATE_REQUIRES_EVIDENCE');
  return {
    status:'ILLUSTRATIVE_UNVERIFIED',
    landValueSar:money(landValue),directBuildingCostSar:money(buildingDirectCost),
    extraCostsSar:money(extraCosts),grossBuildingBeforeDepreciationSar:money(grossBuilding),
    depreciationPct:money(depreciation),depreciationSar:money(depreciationAmount),
    netBuildingValueSar:money(buildingAfterDepreciation),
    unroundedValueSar:money(unroundedValue),
    valueSar:Math.round(unroundedValue/rounding)*rounding,
    finalRoundingStep:rounding,warnings,issues:[],certified:false,
  };
}
function reconcileValuationMethods({marketValueSar,costValueSar,incomeValueSar,
 annualNoiSar,capitalizationRatePct,marketRentPerSqmYear,rentableArea,
 annualRentFromValueSar,annualRentPctOfValue,baseValueSar,
 operatingExpenseRatio,fullBuildingArea,sourceStatus='UNVERIFIED'}={}){
  const issues=[],metrics={}; const rawMethods={};
  const incoming={market:marketValueSar,cost:costValueSar,income:incomeValueSar};
  for(const [k,v] of Object.entries(incoming)){
    const n=valid(v,0.0001);
    if(n!==null)rawMethods[k]=n;
    else if(v!==undefined&&v!==null&&v!=='')issues.push('METHOD_VALUE_INVALID_'+k);
  }
  const noi=valid(annualNoiSar,0),cap=valid(capitalizationRatePct,0.000001,100);
  if(supplied(annualNoiSar)&&noi===null)issues.push('ANNUAL_NOI_INVALID');
  if(supplied(capitalizationRatePct)&&cap===null)issues.push('CAPITALIZATION_RATE_INVALID');
  if(noi!==null&&cap!==null){
    const derived=noi/(cap/100);
    // A zero NOI cannot support a positive income indication, and a tiny
    // cap-rate must not turn bounded inputs into an unbounded SAR estimate.
    if(!Number.isFinite(derived)||derived<=0||derived>1e15){
      issues.push('CAPITALIZED_INCOME_VALUE_INVALID_OR_OUT_OF_RANGE');
    }else{
      metrics.impliedIncomeValueSar=money(derived);
      if(rawMethods.income!==undefined){
        metrics.incomeCalculationErrorSar=money(rawMethods.income-derived);
        if(gap(rawMethods.income,derived)>0.000001)
          issues.push('CAPITALIZED_INCOME_ARITHMETIC_MISMATCH');
      }else rawMethods.income=derived;
    }
  }
  const pairs=[];
  const entries=Object.entries(rawMethods);
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const [aName,a]=entries[i],[bName,b]=entries[j];
    const pct=gap(a,b);
    pairs.push({first:aName,second:bName,absoluteGapSar:money(Math.abs(a-b)),
      gapPctOfHigher:money(pct*100)});
    if(pct>=.20)issues.push('MATERIAL_VALUATION_METHOD_GAP_20PCT');
    else if(pct>=.10)issues.push('VALUATION_METHOD_GAP_10PCT');
  }
  const nla=valid(rentableArea,0.0001),rentRate=valid(marketRentPerSqmYear,0.0001);
  if(supplied(rentableArea)&&nla===null)issues.push('RENTABLE_AREA_INVALID');
  if(supplied(marketRentPerSqmYear)&&rentRate===null)issues.push('MARKET_RENT_PER_SQM_INVALID');
  if(nla!==null&&rentRate!==null){
    const annualRent=nla*rentRate;
    if(!Number.isFinite(annualRent)||annualRent>1e15)
      issues.push('MARKET_ANNUAL_RENT_OUT_OF_RANGE');
    else metrics.comparableMarketAnnualRentSar=money(annualRent);
  }
  let rentFromValue=valid(annualRentFromValueSar,0.0001);
  const valueForRent=valid(baseValueSar,0.0001);
  const rentPct=valid(annualRentPctOfValue,0,100);
  if(supplied(annualRentFromValueSar)&&rentFromValue===null)
    issues.push('ANNUAL_RENT_FROM_VALUE_INVALID');
  if(supplied(baseValueSar)&&valueForRent===null)
    issues.push('BASE_VALUE_FOR_RENT_INVALID');
  if(supplied(annualRentPctOfValue)&&rentPct===null)
    issues.push('ANNUAL_RENT_PERCENTAGE_INVALID');
  // Never silently replace an explicitly invalid rent amount with a
  // percentage-derived estimate. A blank input may request the fallback.
  if(!supplied(annualRentFromValueSar)&&rentFromValue===null&&
      valueForRent!==null&&rentPct!==null)
    rentFromValue=valueForRent*rentPct/100;
  if(rentFromValue!==null)metrics.valuePercentageAnnualRentSar=money(rentFromValue);
  if(rentFromValue!==null&&nla!==null){
    const impliedRate=rentFromValue/nla;
    if(!Number.isFinite(impliedRate)||impliedRate>1e15)
      issues.push('IMPLIED_RENT_RATE_OUT_OF_RANGE');
    else metrics.impliedRentSarPerSqmYear=money(impliedRate);
  }
  if(rentFromValue!==null&&metrics.comparableMarketAnnualRentSar!==undefined){
    const amount=metrics.comparableMarketAnnualRentSar;
    metrics.annualRentGapSar=money(rentFromValue-amount);
    metrics.annualRentGapPctOfComparable=amount>0?money((rentFromValue-amount)/amount*100):null;
    if(gap(rentFromValue,amount)>=.05)issues.push('RENT_METHODOLOGY_GAP_REQUIRES_RECONCILIATION');
  }
  const oer=valid(operatingExpenseRatio,0,1),gfa=valid(fullBuildingArea,0.0001);
  if(supplied(operatingExpenseRatio)&&oer===null)
    issues.push('OPERATING_EXPENSE_RATIO_INVALID');
  if(supplied(fullBuildingArea)&&gfa===null)
    issues.push('FULL_BUILDING_AREA_INVALID');
  if(oer===0&&rawMethods.income!==undefined)issues.push('ZERO_OPEX_NEEDS_TRIPLE_NET_LEASE_EVIDENCE');
  if(nla!==null&&gfa!==null){
    const efficiency=nla/gfa;
    metrics.rentableEfficiencyPct=money(efficiency*100);
    if(efficiency>1)issues.push('NLA_EXCEEDS_GFA');
    if(efficiency<.5)issues.push('LOW_NLA_EFFICIENCY_REQUIRES_SURVEY');
  }
  if(sourceStatus!=='VERIFIED_INDEPENDENTLY')issues.push('SOURCE_EVIDENCE_NOT_INDEPENDENTLY_VERIFIED');
  const severe=issues.some(x=>/MATERIAL_|ARITHMETIC_MISMATCH|NLA_EXCEEDS|OUT_OF_RANGE|(?:^METHOD_VALUE_INVALID_|_INVALID$)/.test(x));
  return {
    status:severe?'RECONCILIATION_HOLD':entries.length<2?'INSUFFICIENT_METHODS':'REVIEW_REQUIRED',
    methodsSar:Object.fromEntries(entries.map(([k,v])=>[k,money(v)])),
    differences:pairs,metrics,issues:[...new Set(issues)],
    certified:false,automaticPrimaryValueSar:null,
    methodDecision:'Independent methods are not averaged or arbitrarily weighted; source validity, rights, economic assumptions and reconciled professional rationale are required.',
  };
}
module.exports={detailedReplacementCost,reconcileValuationMethods};

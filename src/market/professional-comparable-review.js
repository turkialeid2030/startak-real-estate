// Professional report-method comparison worksheet for STARTAK personal study.
// Contains no client, property, or appraisal report data.
// Do not imply a report to which users lack use rights is training ground truth.
'use strict';
const { number } = require('./instant-market-study');
const ADJUSTMENT_KEYS=Object.freeze([
  'financingPct','marketConditionsPct','transactionTypePct','areaPct',
  'accessPct','frontagePct','roadWidthPct','topographyPct','usePct',
  'buildabilityPct','otherPct',
]);
const round2=v=>Math.round((v+Number.EPSILON)*100)/100;
function clampFiniteNumber(value,min,max){
  const result=number(value);
  return result!==null&&Number.isFinite(result)&&result>=min&&result<=max?result:null;
}
function compareAdjustments({subjectArea,comparables=[],asOf=new Date(),
   basis='LAND_SQM',minimumExecuted=3}={}) {
  const errors=[],warnings=[];
  const area=clampFiniteNumber(subjectArea,0.01,1e10);
  if(area===null)errors.push('SUBJECT_AREA_INVALID');
  if(!['LAND_SQM','BUILT_SQM','RENTABLE_SQM'].includes(basis))errors.push('BASIS_INVALID');
  const now=asOf instanceof Date?asOf:new Date(asOf);
  if(!Number.isFinite(now.getTime()))errors.push('AS_OF_INVALID');
  if(!Array.isArray(comparables)||comparables.length<3||comparables.length>20)errors.push('COMPARABLE_COUNT_3_TO_20');
  const seen=new Set();let totalWeight=0;let executed=0,offers=0;
  const analysed=(Array.isArray(comparables)?comparables:[]).map((row,i)=>{
    const id=String(row.id||'').trim();
    const source=String(row.sourceUrl||'').trim();
    const price=clampFiniteNumber(row.pricePerSqm,0.01,1e8);
    const weightPct=clampFiniteNumber(row.weightPct,0,100);
    const status=row.transactionStatus;
    const problems=[];
    if(!id||seen.has(id))problems.push('COMPARABLE_ID_REQUIRED_UNIQUE');
    if(id)seen.add(id);
    if(!source.startsWith('https://')||source.includes('@'))problems.push('SOURCE_URL_REQUIRED');
    if(price===null)problems.push('PRICE_PER_SQM_INVALID');
    if(weightPct===null)problems.push('WEIGHT_INVALID');
    if(!['EXECUTED','OFFER'].includes(status))problems.push('EVIDENCE_KIND_INVALID');
    else if(status==='EXECUTED')executed++;
    else {offers++;warnings.push('OFFERS_NOT_EXECUTED');}
    if(row.basis!==basis)problems.push('AREA_BASIS_MISMATCH');
    const date=String(row.date||'');
    const t=/^\d{4}-\d{2}-\d{2}$/.test(date)?Date.parse(date+'T00:00:00Z'):NaN;
    if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==date||t>now.getTime())
      problems.push('COMPARABLE_DATE_INVALID');
    else if(now.getTime()-t>365*86400000)warnings.push('COMPARABLE_OLDER_THAN_365_DAYS');
    const adjustmentPct={};let otherTotal=0;
    for(const k of ADJUSTMENT_KEYS){
      const raw=row[k]===''||row[k]===undefined||row[k]===null?0:clampFiniteNumber(row[k],-50,50);
      if(raw===null){problems.push('ADJUSTMENT_INVALID_'+k);adjustmentPct[k]=null;}
      else {adjustmentPct[k]=raw;if(k!=='financingPct'&&k!=='marketConditionsPct'&&k!=='transactionTypePct')otherTotal+=raw;}
    }
    if(problems.length||errors.length&&area===null)return {
      id,problems,transactionStatus:status,weightPct,
      adjustedPricePerSqm:null,weightedPricePerSqm:null,
      adjustments:adjustmentPct,
    };
    // Reproduce a transparent report-style two-stage additive grid:
    // Stage 1: financing + market conditions + type of transaction (explicit).
    // Stage 2: cumulative property adjustments * stage-1 price.
    // A professional may calibrate adjustments; never infer them from a PDF.
    const stage1Factor=1+(adjustmentPct.financingPct+
      adjustmentPct.marketConditionsPct+adjustmentPct.transactionTypePct)/100;
    const stage2Factor=1+otherTotal/100;
    if(stage1Factor<=0||stage2Factor<=0)problems.push('ADJUSTMENT_NEGATIVE_PRICE');
    const adjusted=problems.length?null:round2(price*stage1Factor*stage2Factor);
    if(weightPct!==null)totalWeight+=weightPct;
    return {id,problems,transactionStatus:status,sourceUrl:source,
      date,originalPricePerSqm:price,weightPct,adjustments:adjustmentPct,
      stage1PricePerSqm:problems.length?null:round2(price*stage1Factor),
      stage2OtherAdjustmentsPct:round2(otherTotal),
      adjustedPricePerSqm:adjusted,
      weightedPricePerSqm:adjusted===null?null:adjusted*weightPct/100,
    };
  });
  if(Math.abs(totalWeight-100)>.00001)errors.push('WEIGHTS_MUST_SUM_TO_100');
  for(const a of analysed)if(a.problems.length)errors.push('ROW_INVALID_'+a.id);
  if(executed<minimumExecuted)warnings.push('INSUFFICIENT_EXECUTED_COMPARABLES');
  if(offers)warnings.push('OFFERS_REQUIRE_NEGOTIATION_AND_SOURCE_REVIEW');
  // Demonstration calculations can be displayed, but not promoted to an unqualified market price.
  const canCalculate=errors.length===0&&analysed.every(x=>x.adjustedPricePerSqm!==null);
  const rawWeighted=canCalculate?analysed.reduce((acc,x)=>acc+x.weightedPricePerSqm,0):null;
  // Explicit unit-value rounding before multiplying by asset area mirrors report methodology.
  const weightedPricePerSqm=canCalculate?round2(rawWeighted):null;
  const scenarioValueSar=canCalculate&&area!==null?round2(weightedPricePerSqm*area):null;
  const evidenceQualified=canCalculate&&executed>=minimumExecuted&&offers===0;
  return {
    status:errors.length?'INVALID':
      evidenceQualified?'CALCULATION_POSSIBLE_UNVERIFIED':'ILLUSTRATIVE_HUMAN_REVIEW_REQUIRED',
    weightedPricePerSqm,unroundedWeightedPricePerSqm:rawWeighted,scenarioValueSar,
    executedComparableCount:executed,offerComparableCount:offers,
    analysed,errors:[...new Set(errors)],warnings:[...new Set(warnings)],
    independentlyVerified:false,appraisalCertified:false,
    evidenceQualifiedForAutomaticPublication:false,
    rule:'Compare actual matched asset rights and units; transparent staged grid; weights 100%; round weighted unit price to 2 decimals BEFORE multiplying by subject area. Offer scenarios are never registered-sales evidence.',
  };
}
function costReplacementScenario({landArea,landMarketSarPerSqm,grossBuiltArea,replacementCostSarPerBuiltSqm,
   physicalDepreciationPct=0,functionalObsolescencePct=0,economicObsolescencePct=0}={}){
  const input=[landArea,landMarketSarPerSqm,grossBuiltArea,replacementCostSarPerBuiltSqm].map(v=>clampFiniteNumber(v,.00001,1e12));
  const deduct=[physicalDepreciationPct,functionalObsolescencePct,economicObsolescencePct].map(v=>clampFiniteNumber(v,0,100));
  const issues=[];
  if(input.some(x=>x===null))issues.push('COST_INPUTS_REQUIRED');
  if(deduct.some(x=>x===null)||deduct.reduce((a,b)=>a+(b||0),0)>100)issues.push('DEPRECIATION_INVALID');
  if(issues.length)return {status:'INCOMPLETE',valueSar:null,issues};
  const [area,landUnit,builtArea,replacementUnit]=input;
  const landValue=area*landUnit,buildingReplacement=builtArea*replacementUnit;
  const depreciationAmount=buildingReplacement*deduct.reduce((a,b)=>a+b,0)/100;
  return {status:'ILLUSTRATIVE_UNVERIFIED',valueSar:round2(landValue+buildingReplacement-depreciationAmount),
    landValueSar:round2(landValue),buildingReplacementSar:round2(buildingReplacement),
    depreciationSar:round2(depreciationAmount),issues,
    requiresEvidence:true,certified:false};
}
module.exports={ADJUSTMENT_KEYS,compareAdjustments,costReplacementScenario};

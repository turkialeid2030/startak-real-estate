'use strict';
// Transcribed external report review only. No market evidence admission or
// changes to canonical valuation formulas. Source records remain local.
const P=require('../engines/financial/precision');
const {sha256Hex}=require('../crypto/sha256');
const VERSION='EXTERNAL_REPORT_REVIEW_V1';
const plain=v=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12&&P.money(v)===v;
const signed=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1&&P.fromRate(P.toRate(v))===v;
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e9&&P.fromRate(P.toRate(v))===v;
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function fail(code){throw Error(code);}
function reviewExternalReport(x){
 if(!exact(x,['reportRef','valuationDate','landAreaSqm','comparables','adoptedLandRateSar','roundingReason','components','declaredBuildingCostSar','effectiveAge','economicLife','declaredPhysicalRate','declaredDepreciationSar','declaredFinalValueSar','sourcePage','identityConflict','incomeEvidenceAvailable'])||
 !text(x.reportRef)||!day(x.valuationDate)||!positive(x.landAreaSqm)||!money(x.adoptedLandRateSar)||x.adoptedLandRateSar===0||typeof x.roundingReason!=='string'||x.roundingReason.length>200||
 !['declaredBuildingCostSar','declaredDepreciationSar','declaredFinalValueSar'].every(k=>money(x[k]))||!Number.isInteger(x.effectiveAge)||x.effectiveAge<0||!Number.isInteger(x.economicLife)||x.economicLife<1||x.economicLife>200||x.effectiveAge>x.economicLife||!signed(x.declaredPhysicalRate)||x.declaredPhysicalRate<0||
 !Number.isInteger(x.sourcePage)||x.sourcePage<1||x.sourcePage>10000||typeof x.identityConflict!=='boolean'||typeof x.incomeEvidenceAvailable!=='boolean')fail('REVIEW_INPUT_INVALID');
 if(!Array.isArray(x.comparables)||x.comparables.length<1||x.comparables.length>100||!Array.isArray(x.components)||x.components.length<1||x.components.length>200)fail('REVIEW_ROW_LIMIT');
 const issues=[],add=(code,severity,ref)=>issues.push({code,severity,ref});
 if(x.identityConflict)add('IDENTITY_CONFLICT_DECLARED','CRITICAL','identity');
 if(!x.incomeEvidenceAvailable)add('INCOME_EVIDENCE_MISSING','WARNING','income');
 const ids=new Set();
 const comps=x.comparables.map(c=>{
  if(!exact(c,['id','date','areaSqm','rawRateSar','firstAdjustment','secondAdjustment','weight','transactionStatus','page'])||!text(c.id)||ids.has(c.id)||!day(c.date)||!positive(c.areaSqm)||!money(c.rawRateSar)||c.rawRateSar<=0||!signed(c.firstAdjustment)||!signed(c.secondAdjustment)||!signed(c.weight)||c.weight<=0||!['EXECUTED','ASKING','UNKNOWN'].includes(c.transactionStatus)||!Number.isInteger(c.page)||c.page<1||c.page>10000)fail('REVIEW_COMPARABLE_INVALID');
  ids.add(c.id);
  const ageDays=(Date.parse(x.valuationDate)-Date.parse(c.date))/86400000,ratio=c.areaSqm/x.landAreaSqm;
  if(ageDays<0)add('FUTURE_COMPARABLE','CRITICAL',c.id);
  if(ageDays>365)add('STALE_COMPARABLE_REVIEW','WARNING',c.id);
  if(ratio<.5||ratio>2)add('AREA_COMPARABILITY_REVIEW','WARNING',c.id);
  if(c.transactionStatus!=='EXECUTED')add('NOT_EXECUTED','WARNING',c.id);
  const first=P.moneyMulRate(c.rawRateSar,1+c.firstAdjustment),adjusted=P.moneyMulRate(first,1+c.secondAdjustment);
  return {...c,ageDays,areaRatio:ratio,firstRateSar:first,adjustedRateSar:adjusted,contributionSar:P.moneyMulRate(adjusted,c.weight)};
 });
 const weight=comps.reduce((s,c)=>s+P.toRate(c.weight),0n);
 if(weight!==P.RATE_SCALE)fail('REVIEW_WEIGHT_SUM_INVALID');
 // Preserve the pre-round weighted numerator; never sum rounded display contributions.
 const weightedNumerator=comps.reduce((sum,c)=>sum+P.toMoney(c.adjustedRateSar)*P.toRate(c.weight),0n);
 const weighted=P.fromMoney(P.roundDiv(weightedNumerator,P.RATE_SCALE));
 const weightedBeforeFinalRoundingSar=Number(weightedNumerator)/Number(P.RATE_SCALE)/100;
 const landDelta=P.fromMoney(P.roundDiv((P.toMoney(x.adoptedLandRateSar)*P.RATE_SCALE-weightedNumerator)*P.toRate(x.landAreaSqm),P.RATE_SCALE*P.RATE_SCALE));
 if(landDelta!==0)add(x.roundingReason.trim()?'ADOPTED_RATE_DIFF_DOCUMENTED_UNVERIFIED':'ADOPTED_RATE_DIFF_UNEXPLAINED',x.roundingReason.trim()?'WARNING':'CRITICAL','land');
 const componentIds=new Set();
 const components=x.components.map(c=>{
  if(!exact(c,['id','kind','quantity','unit','unitCostSar','page'])||!text(c.id)||componentIds.has(c.id)||!['FLOOR','ANNEX','WALL','POOL','OTHER'].includes(c.kind)||!positive(c.quantity)||!['SQM','LINEAR_M','ITEM'].includes(c.unit)||!money(c.unitCostSar)||!Number.isInteger(c.page)||c.page<1||c.page>10000||(['FLOOR','ANNEX'].includes(c.kind)&&c.unit!=='SQM'))fail('REVIEW_COMPONENT_INVALID');
  componentIds.add(c.id);const costSar=P.moneyMulRate(c.unitCostSar,c.quantity);if(!money(costSar))fail('REVIEW_RANGE_INVALID');return {...c,costSar};
 });
 const cost=P.moneyAdd(...components.map(c=>c.costSar));
 if(!money(cost))fail('REVIEW_RANGE_INVALID');
 if(cost!==x.declaredBuildingCostSar)add('BUILDING_COST_MISMATCH','CRITICAL','cost');
 const physicalRatio=x.effectiveAge/x.economicLife;
 const fullDep=P.fromMoney(P.roundDiv(P.toMoney(cost)*BigInt(x.effectiveAge),BigInt(x.economicLife)));
 const roundedDep=P.moneyMulRate(cost,x.declaredPhysicalRate);
 if(roundedDep!==x.declaredDepreciationSar)add('DECLARED_DEPRECIATION_MISMATCH','CRITICAL','depreciation');
 if(fullDep!==roundedDep)add('AGE_LIFE_PRECISION_DIFFERENCE','WARNING','depreciation');
 const land=P.moneyMulRate(x.adoptedLandRateSar,x.landAreaSqm);
 const replay=P.moneyAdd(land,cost,-x.declaredDepreciationSar);
 if(!money(land)||!money(replay)||!Number.isFinite(landDelta)||Math.abs(landDelta)>1e12)fail('REVIEW_RANGE_INVALID');
 if(x.declaredDepreciationSar>cost)add('DEPRECIATION_EXCEEDS_COST','CRITICAL','depreciation');
 if(replay!==x.declaredFinalValueSar)add('FINAL_VALUE_MISMATCH','CRITICAL','final');
 const out={version:VERSION,scope:'TRANSCRIBED_EXTERNAL_REPORT_ARITHMETIC_ONLY',reportRef:x.reportRef,valuationDate:x.valuationDate,sourcePage:x.sourcePage,comparables:comps,components,weightedRateSar:weighted,weightedBeforeFinalRoundingSar,roundingPolicy:'ROUND_EACH_ADJUSTED_RATE_TO_HALALA; WEIGHT_BEFORE_FINAL_RATE_ROUNDING; LAND_IMPACT_USES_UNROUNDED_WEIGHTED_RATE',adoptedRateSar:x.adoptedLandRateSar,roundingReason:x.roundingReason,landRateImpactSar:landDelta,landValueSar:land,componentCostSar:cost,buildingFloorAreaSqm:components.filter(c=>['FLOOR','ANNEX'].includes(c.kind)).reduce((s,c)=>s+c.quantity,0),physicalRatio,fullPrecisionPhysicalDepSar:fullDep,declaredRatePhysicalDepSar:roundedDep,declaredDepreciationSar:x.declaredDepreciationSar,replayedFinalValueSar:replay,declaredFinalValueSar:x.declaredFinalValueSar,issues,sourceAuthenticated:false,professionalValuationCertified:false,transactionAuthorized:false,canonicalModelUpdated:false};
 return {...out,reviewHashSha256:sha256Hex(JSON.stringify(out))};
}
module.exports={VERSION,reviewExternalReport};

'use strict';
// Diagnostic replay of a vacant-land report. No fabricated building or rent inputs.
const P=require('../engines/financial/precision');
const {sha256Hex}=require('../crypto/sha256');
const VERSION='VACANT_LAND_REPORT_REVIEW_V1';
const exact=(v,ks)=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
const note=v=>typeof v==='string'&&v.length<=200;
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12&&P.money(v)===v;
const rate=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&P.fromRate(P.toRate(v))===v;
const page=v=>Number.isInteger(v)&&v>=1&&v<=10000;
const CATEGORIES=Object.freeze(['TIME','FINANCE','MARKET_CONDITIONS','AREA','LOCATION','NEGOTIATION','USE','STREET_WIDTH','FRONTAGES','BUILDING_RIGHTS','OTHER']);
const fail=code=>{throw Error(code);};
function reviewVacantLand(x){
 if(!exact(x,['version','reportRef','valuationDate','inspectionDate','issueDate','worksheetDate','limitationsDate','landAreaSqm','adoptedLandRateSar','roundingReason','declaredFinalValueSar','planningEvidence','planningRef','assumedFloors','uncertaintyFraction','uncertaintyRef','comparables','sourcePage'])||x.version!==VERSION||!text(x.reportRef)||![x.valuationDate,x.inspectionDate,x.issueDate,x.worksheetDate,x.limitationsDate].every(day)||!rate(x.landAreaSqm,.000001,1e9)||!money(x.adoptedLandRateSar)||x.adoptedLandRateSar===0||!money(x.declaredFinalValueSar)||!note(x.roundingReason)||!['AUTHORITY_DOCUMENT_DECLARED','CLIENT_ASSUMPTION','UNKNOWN'].includes(x.planningEvidence)||!note(x.planningRef)||!(x.assumedFloors===null||rate(x.assumedFloors,.5,200))||!rate(x.uncertaintyFraction,0,1)||!text(x.uncertaintyRef)||!page(x.sourcePage)||!Array.isArray(x.comparables)||x.comparables.length<1||x.comparables.length>100)fail('LAND_REVIEW_INPUT_INVALID');
 const issues=[],add=(code,severity,ref)=>issues.push({code,severity,ref});
 if(x.inspectionDate>x.valuationDate||x.issueDate<x.valuationDate)add('REPORT_CHRONOLOGY_CONFLICT','CRITICAL','dates');
 if(x.worksheetDate!==x.valuationDate||x.limitationsDate!==x.valuationDate)add('VALUATION_DATE_CONFLICT','CRITICAL','dates');
 if(x.planningEvidence!=='AUTHORITY_DOCUMENT_DECLARED'||!text(x.planningRef))add('BUILDING_RIGHTS_UNVERIFIED','CRITICAL','planning');
 // Even a declared official document is not authenticated here.
 const ids=new Set();
 const comparables=x.comparables.map(c=>{
  if(!exact(c,['id','date','observedDate','areaSqm','rawRateSar','weight','transactionStatus','sourceRef','page','adjustments'])||!text(c.id)||ids.has(c.id)||!day(c.date)||!(c.observedDate===null||day(c.observedDate))||!rate(c.areaSqm,.000001,1e9)||!money(c.rawRateSar)||c.rawRateSar<=0||!rate(c.weight,.000001,1)||!['EXECUTED','ASKING','UNKNOWN'].includes(c.transactionStatus)||!text(c.sourceRef)||!page(c.page)||!Array.isArray(c.adjustments)||c.adjustments.length>22)fail('LAND_COMPARABLE_INVALID');
  ids.add(c.id);
  const seen=new Set(),stages=[0n,0n];
  for(const a of c.adjustments){
   if(!exact(a,['category','stage','fraction','evidenceRef'])||!CATEGORIES.includes(a.category)||seen.has(a.category)||![1,2].includes(a.stage)||!rate(a.fraction,-1,1)||!note(a.evidenceRef))fail('LAND_ADJUSTMENT_INVALID_OR_DUPLICATE');
   seen.add(a.category);
   if(a.fraction!==0&&!text(a.evidenceRef))add('ADJUSTMENT_BASIS_MISSING','WARNING',c.id+':'+a.category);
   if(a.category==='NEGOTIATION'&&c.transactionStatus==='EXECUTED'&&a.fraction!==0)add('EXECUTED_NEGOTIATION_REVIEW','WARNING',c.id);
   stages[a.stage-1]+=P.toRate(a.fraction);
  }
  if(stages.some(v=>v< -P.RATE_SCALE||v>P.RATE_SCALE))fail('LAND_STAGE_RANGE_INVALID');
  const ageDays=(Date.parse(x.valuationDate)-Date.parse(c.date))/86400000;
  if(ageDays<0)add('FUTURE_COMPARABLE','CRITICAL',c.id);
  if(ageDays>365)add('STALE_COMPARABLE_REVIEW','WARNING',c.id);
  if(c.observedDate===null)add('OBSERVATION_DATE_UNKNOWN','WARNING',c.id);
  else if(c.observedDate>x.valuationDate)add('POST_VALUATION_OBSERVATION','WARNING',c.id);
  if(c.observedDate!==null&&c.observedDate<c.date)add('OBSERVATION_BEFORE_RECORD_DATE','CRITICAL',c.id);
  const areaRatio=c.areaSqm/x.landAreaSqm;
  if(areaRatio<.5||areaRatio>2)add('AREA_COMPARABILITY_REVIEW','WARNING',c.id);
  if(c.transactionStatus!=='EXECUTED')add('NOT_EXECUTED','WARNING',c.id);
  const firstRateSar=P.moneyMulRate(c.rawRateSar,P.fromRate(P.RATE_SCALE+stages[0]));
  const adjustedRateSar=P.moneyMulRate(firstRateSar,P.fromRate(P.RATE_SCALE+stages[1]));
  if(!money(firstRateSar)||!money(adjustedRateSar))fail('LAND_RANGE_INVALID');
  return {...c,ageDays,areaRatio,firstRateSar,adjustedRateSar,firstAdjustment:P.fromRate(stages[0]),secondAdjustment:P.fromRate(stages[1]),contributionSar:P.moneyMulRate(adjustedRateSar,c.weight)};
 });
 if(comparables.reduce((s,c)=>s+P.toRate(c.weight),0n)!==P.RATE_SCALE)fail('LAND_WEIGHT_SUM_INVALID');
 if(comparables.every(c=>c.transactionStatus!=='EXECUTED'))add('NO_EXECUTED_COMPARABLES','CRITICAL','market');
 const numerator=comparables.reduce((s,c)=>s+P.toMoney(c.adjustedRateSar)*P.toRate(c.weight),0n);
 const weightedRateSar=P.fromMoney(P.roundDiv(numerator,P.RATE_SCALE));
 const weightedBeforeFinalRoundingSar=Number(numerator)/Number(P.RATE_SCALE)/100;
 const weightedLandValueSar=P.fromMoney(P.roundDiv(numerator*P.toRate(x.landAreaSqm),P.RATE_SCALE*P.RATE_SCALE));
 const replayedFinalValueSar=P.moneyMulRate(x.adoptedLandRateSar,x.landAreaSqm);
 const landRateImpactSar=P.fromMoney(P.roundDiv((P.toMoney(x.adoptedLandRateSar)*P.RATE_SCALE-numerator)*P.toRate(x.landAreaSqm),P.RATE_SCALE*P.RATE_SCALE));
 if(![weightedRateSar,weightedLandValueSar,replayedFinalValueSar].every(money)||!Number.isFinite(landRateImpactSar)||Math.abs(landRateImpactSar)>1e12)fail('LAND_RANGE_INVALID');
 if(landRateImpactSar!==0)add(x.roundingReason.trim()?'ADOPTED_RATE_DIFF_DOCUMENTED_UNVERIFIED':'ADOPTED_RATE_DIFF_UNEXPLAINED',x.roundingReason.trim()?'WARNING':'CRITICAL','land');
 if(replayedFinalValueSar!==x.declaredFinalValueSar)add('FINAL_VALUE_MISMATCH','CRITICAL','final');
 const uncertainty={kind:'DECLARED_SYMMETRIC_SENSITIVITY_NOT_CONFIDENCE_INTERVAL',fraction:x.uncertaintyFraction,sourceRef:x.uncertaintyRef,baseSar:x.declaredFinalValueSar,lowSar:P.moneyMulRate(x.declaredFinalValueSar,P.fromRate(P.RATE_SCALE-P.toRate(x.uncertaintyFraction))),highSar:P.moneyMulRate(x.declaredFinalValueSar,P.fromRate(P.RATE_SCALE+P.toRate(x.uncertaintyFraction)))};
 if(!money(uncertainty.lowSar)||!money(uncertainty.highSar))fail('LAND_RANGE_INVALID');
 const out={version:VERSION,scope:'VACANT_LAND_DIAGNOSTIC_ONLY',reportRef:x.reportRef,valuationDate:x.valuationDate,inspectionDate:x.inspectionDate,issueDate:x.issueDate,worksheetDate:x.worksheetDate,limitationsDate:x.limitationsDate,sourcePage:x.sourcePage,landAreaSqm:x.landAreaSqm,planningEvidence:x.planningEvidence,planningRef:x.planningRef,assumedFloors:x.assumedFloors,comparables,weightedRateSar,weightedBeforeFinalRoundingSar,weightedLandValueSar,adoptedRateSar:x.adoptedLandRateSar,roundingReason:x.roundingReason,landRateImpactSar,replayedFinalValueSar,declaredFinalValueSar:x.declaredFinalValueSar,uncertainty,issues,sourceAuthenticated:false,professionalValuationCertified:false,transactionAuthorized:false,canonicalModelUpdated:false};
 return {...out,reviewHashSha256:sha256Hex(JSON.stringify(out))};
}
module.exports={VERSION,CATEGORIES,reviewVacantLand};

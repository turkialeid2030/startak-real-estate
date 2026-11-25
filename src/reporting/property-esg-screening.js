'use strict';
// Browser-only declared screening. Professional ESG evidence and authority stay in esg-evidence.js.
const {ESG_FACTOR,ESG_PILLAR,ESG_SOURCE_CLASS}=require('../esg/esg-taxonomy');
const {sha256Hex}=require('../crypto/sha256');
const VERSION='PROPERTY_ESG_SCREENING_V1';
const STATES=Object.freeze(['UNKNOWN','NOT_APPLICABLE','NOT_MATERIAL','POTENTIALLY_MATERIAL','MATERIAL']);
const CHANNELS=Object.freeze(['RENT','OCCUPANCY','OWNER_OPEX','CAPEX','MARKETABILITY','LEGAL_OR_SAFETY_RISK','OTHER']);
const FACTORS=Object.freeze({
 ENERGY_PERFORMANCE:'ENVIRONMENTAL',WATER_EFFICIENCY:'ENVIRONMENTAL',GHG_EMISSIONS:'ENVIRONMENTAL',
 CLIMATE_PHYSICAL_RISK:'ENVIRONMENTAL',RESILIENCE_ADAPTATION:'ENVIRONMENTAL',
 INDOOR_ENVIRONMENT_QUALITY:'SOCIAL',ACCESSIBILITY_INCLUSION:'SOCIAL',HEALTH_SAFETY:'SOCIAL',COMMUNITY_IMPACT:'SOCIAL',
 GOVERNANCE_COMPLIANCE:'GOVERNANCE',CERTIFICATION_RATING:'GOVERNANCE'
});
const exact=(v,k)=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=500&&!/[\u0000-\u001f\u007f]/.test(v);
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function screenEsg(x){
 if(!exact(x,['version','propertyRef','valuationDate','factors'])||x.version!==VERSION||!text(x.propertyRef)||!day(x.valuationDate)||!Array.isArray(x.factors)||x.factors.length>12)throw Error('ESG_SCREEN_SCOPE_INVALID');
 const issues=[],seen=new Set(),byFactor=new Map(),add=(code,severity,ref)=>issues.push({code,severity,ref});
 for(const f of x.factors){
  if(!exact(f,['factor','pillar','outcome','rationale','sourceClass','sourceRef','sourceDate','validTo','impactChannels'])||!Object.values(ESG_FACTOR).includes(f.factor)||!Object.values(ESG_PILLAR).includes(f.pillar)||seen.has(f.factor)||!STATES.includes(f.outcome)||!text(f.rationale)||!Array.isArray(f.impactChannels)||f.impactChannels.length>CHANNELS.length||f.impactChannels.some(c=>!CHANNELS.includes(c))||new Set(f.impactChannels).size!==f.impactChannels.length)throw Error('ESG_SCREEN_FACTOR_INVALID');
  if(f.factor!=='OTHER'&&FACTORS[f.factor]!==f.pillar)throw Error('ESG_SCREEN_PILLAR_MISMATCH');
  seen.add(f.factor);
  const noSource=f.sourceClass===null&&f.sourceRef===null&&f.sourceDate===null&&f.validTo===null;
  if(!noSource&&(!Object.values(ESG_SOURCE_CLASS).includes(f.sourceClass)||!text(f.sourceRef)||!day(f.sourceDate)||!(f.validTo===null||day(f.validTo))||(f.validTo!==null&&f.validTo<f.sourceDate)))throw Error('ESG_SCREEN_SOURCE_INVALID');
  if(f.outcome!=='UNKNOWN'&&noSource)throw Error('ESG_SCREEN_SOURCE_REQUIRED');
  if(['NOT_APPLICABLE','NOT_MATERIAL','UNKNOWN'].includes(f.outcome)&&f.impactChannels.length)throw Error('ESG_SCREEN_CHANNEL_MISMATCH');
  if(['MATERIAL','POTENTIALLY_MATERIAL'].includes(f.outcome)&&!f.impactChannels.length)throw Error('ESG_SCREEN_CHANNEL_REQUIRED');
  const ageDays=noSource?null:(Date.parse(x.valuationDate)-Date.parse(f.sourceDate))/86400000;
  let reviewRequired=['UNKNOWN','MATERIAL','POTENTIALLY_MATERIAL'].includes(f.outcome);
  if(ageDays!==null&&ageDays<0){add('ESG_FUTURE_SOURCE','CRITICAL',f.factor);reviewRequired=true;}
  if(ageDays!==null&&ageDays>365){add('ESG_STALE_SOURCE_REVIEW','WARNING',f.factor);reviewRequired=true;}
  if(f.validTo!==null&&f.validTo<x.valuationDate){add('ESG_EXPIRED_SOURCE','CRITICAL',f.factor);reviewRequired=true;}
  if(f.sourceClass==='ASSUMED'){add('ESG_ASSUMED_SOURCE','WARNING',f.factor);reviewRequired=true;}
  if(f.outcome==='UNKNOWN')add('ESG_UNKNOWN_FACTOR','WARNING',f.factor);
  if(['MATERIAL','POTENTIALLY_MATERIAL'].includes(f.outcome))add('ESG_MATERIALITY_REVIEW_REQUIRED','WARNING',f.factor);
  byFactor.set(f.factor,{...f,impactChannels:[...f.impactChannels],ageDays,reviewRequired,sourceAuthenticated:false});
 }
 for(const [factor,pillar] of Object.entries(FACTORS))if(!seen.has(factor)){
  add('ESG_MISSING_FACTOR','WARNING',factor);
  byFactor.set(factor,{factor,pillar,outcome:'UNKNOWN',rationale:null,sourceClass:null,sourceRef:null,sourceDate:null,validTo:null,impactChannels:[],ageDays:null,reviewRequired:true,sourceAuthenticated:false});
 }
 const factors=[...Object.keys(FACTORS),...(seen.has('OTHER')?['OTHER']:[])].map(f=>byFactor.get(f));
 const counts=Object.fromEntries(STATES.map(s=>[s,factors.filter(f=>f.outcome===s).length]));
 const out={version:VERSION,scope:'DECLARED_ESG_SCREENING_ONLY',propertyRef:x.propertyRef,valuationDate:x.valuationDate,factors,counts,requiredFactorCount:Object.keys(FACTORS).length,missingFactorCount:Object.keys(FACTORS).filter(f=>!seen.has(f)).length,reviewRequiredCount:factors.filter(f=>f.reviewRequired).length,screeningAgeDays:365,issues,sourceAuthenticated:false,professionalValuationCertified:false,transactionAuthorized:false,canonicalModelUpdated:false,automaticValueAdjustmentApplied:false,numericValueAdjustmentProduced:false,professionalMaterialityEstablished:false,complianceEstablished:false,esgScore:null};
 return {...out,reviewHashSha256:sha256Hex(JSON.stringify(out))};
}
module.exports={VERSION,STATES,CHANNELS,FACTORS,screenEsg};

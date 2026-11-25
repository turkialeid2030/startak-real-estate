'use strict';
const assert=require('node:assert/strict');
const {VERSION,FACTORS,STATES,screenEsg}=require('../../src/reporting/property-esg-screening');
const {ESG_FACTOR,ESG_PILLAR}=require('../../src/esg/esg-taxonomy');
const {renderExternalReview}=require('../../src/reporting/reporting-studio');
let cases=0,checks=0;
function eq(a,b){assert.equal(a,b);checks++;}
function ok(a){assert.ok(a);checks++;}
function denied(fn){assert.throws(fn);cases++;checks++;}
const base={version:VERSION,propertyRef:'SYNTH-P',valuationDate:'2026-01-05',factors:[]};
const evidence={factor:'ENERGY_PERFORMANCE',pillar:'ENVIRONMENTAL',outcome:'MATERIAL',rationale:'Synthetic materiality declaration',sourceClass:'CLIENT_PROVIDED',sourceRef:'SYNTH-REF',sourceDate:'2026-01-01',validTo:null,impactChannels:['OWNER_OPEX']};
function run(x){cases++;const r=screenEsg(x);for(const k of ['sourceAuthenticated','professionalValuationCertified','transactionAuthorized','canonicalModelUpdated','automaticValueAdjustmentApplied','numericValueAdjustmentProduced','professionalMaterialityEstablished','complianceEstablished'])eq(r[k],false);eq(r.esgScore,null);eq(Object.values(r.counts).reduce((s,v)=>s+v,0),r.factors.length);return r;}
const blank=run(base);eq(blank.counts.UNKNOWN,11);eq(blank.missingFactorCount,11);eq(blank.reviewRequiredCount,11);
for(const [factor,pillar] of Object.entries(FACTORS)){
 ok(Object.hasOwn(ESG_FACTOR,factor));ok(Object.hasOwn(ESG_PILLAR,pillar));
 for(const outcome of STATES){
  const f={...evidence,factor,pillar,outcome,impactChannels:['MATERIAL','POTENTIALLY_MATERIAL'].includes(outcome)?['OWNER_OPEX']:[]};
  const v=run({...base,factors:[f]});eq(v.factors.find(x=>x.factor===factor).outcome,outcome);eq(v.missingFactorCount,10);eq(v.factors.length,11);eq(v.factors.find(x=>x.factor===factor).sourceAuthenticated,false);
 }
}
const complete=run({...base,factors:Object.entries(FACTORS).map(([factor,pillar])=>({...evidence,factor,pillar,outcome:'NOT_MATERIAL',impactChannels:[]}))});eq(complete.missingFactorCount,0);eq(complete.counts.NOT_MATERIAL,11);eq(complete.professionalMaterialityEstablished,false);
for(const [patch,code] of [[{sourceDate:'2026-01-06'},'ESG_FUTURE_SOURCE'],[{sourceDate:'2024-01-01'},'ESG_STALE_SOURCE_REVIEW'],[{validTo:'2026-01-02'},'ESG_EXPIRED_SOURCE'],[{sourceClass:'ASSUMED'},'ESG_ASSUMED_SOURCE']]){
 const v=run({...base,factors:[{...evidence,...patch}]});ok(v.issues.some(i=>i.code===code));eq(v.factors[0].reviewRequired,true);
}
const unknown=run({...base,factors:[{...evidence,outcome:'UNKNOWN',sourceClass:null,sourceRef:null,sourceDate:null,validTo:null,impactChannels:[]}]});eq(unknown.counts.UNKNOWN,11);eq(unknown.missingFactorCount,10);
const extra=run({...base,factors:[{...evidence,factor:'OTHER'}]});eq(extra.factors.length,12);
for(const patch of [{factor:'INVALID'},{pillar:'SOCIAL'},{outcome:'APPROVED'},{rationale:''},{sourceRef:''},{sourceDate:'2026-02-30'},{sourceClass:'VERIFIED'},{validTo:'2025-01-01'},{impactChannels:[]},{impactChannels:['RENT','RENT']},{impactChannels:['INVALID']},{outcome:'NOT_MATERIAL'},{outcome:'NOT_APPLICABLE'},{sourceClass:null,sourceRef:null,sourceDate:null,validTo:null},{numericValueAdjustment:100000}])denied(()=>screenEsg({...base,factors:[{...evidence,...patch}]}));
for(const patch of [{propertyRef:''},{valuationDate:'2026-02-30'},{factors:[evidence,evidence]},{factors:null},{professionalMaterialityEstablished:true}])denied(()=>screenEsg({...base,...patch}));
for(const locale of ['ar-SA','en']){const out=renderExternalReview({...base,propertyRef:'<script>bad</script>',factors:[{...evidence,rationale:'<img src=x onerror=bad>'}]},{locale});cases++;ok(out.html.includes('&lt;script&gt;'));ok(out.html.includes('&lt;img'));ok(!out.html.includes('<script>'));ok(!out.html.includes('<img'));ok(out.html.includes(locale==='en'?'dir="ltr"':'dir="rtl"'));eq(out.report.automaticValueAdjustmentApplied,false);}
console.log('PROPERTY_ESG_SCREENING=PASS cases='+cases+' checks='+checks);

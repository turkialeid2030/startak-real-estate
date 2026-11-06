'use strict';
const assert=require('node:assert/strict');
const {saveResearchSidecar,loadResearchSidecar,sidecarKey}=require('../../src/market/saved-deal-study-sidecar');
const {bindReview}=require('../../src/market/appraisal-study-binding');
const sha='b'.repeat(64);
const deal={id:'SYN-DEAL-01',name:'أصل اختبار مستقل',mode:'building',inputs:{}};
const subject={name:deal.name,assetType:'RESIDENTIAL_COMPOUND',landArea:'1440.75',valuationDate:'2026-03-01',
 city:'الرياض',location:'24.7,46.7'};
const appraisal={reportId:'SYN-REPORT-55',valuationDate:subject.valuationDate,property:{
 name:subject.name,assetType:subject.assetType,areaSqm:'١٬٤٤٠٫٧٥'}};
const study=(s=subject)=>JSON.stringify({kind:'STARTAK_PERSONAL_MARKET_STUDY',
 subject:s,assumptions:{occupancy:'0.9',expenseRatio:'0.2',capRate:'0.07'},
 sales:[],rentals:[],projects:[],marketOffers:[],unitMix:[],leaseComparables:[],
 rentAssumptions:{expenseRatio:'0.2',stabilizedOccupancy:'0.9'}});
const makeStorage=()=>{
 const map=new Map([['deals-index',JSON.stringify([{id:deal.id,name:deal.name}])],['deal:'+deal.id,JSON.stringify(deal)]]);
 return {map,storage:{get:async k=>map.has(k)?map.get(k):null,set:async(k,v)=>map.set(k,v)}};
};
const bind=(status='HOLD')=>bindReview({subject,appraisal,documentDigest:sha,
 review:{status,issues:status==='HOLD'?[{code:'CIRCULAR_VALUATION'}]:[]},confirmed:true}).link;
let n=0;const check=async(label,fn)=>{await fn();n++;console.log('PASS '+label);};
(async()=>{
 await check('legacy personal research sidecar remains available when report is not linked',async()=>{
  const {storage}=makeStorage();
  const saved=await saveResearchSidecar({storage,dealId:deal.id,studyJson:study(),identityConfirmed:true});
  assert.equal(saved.appraisalReviewStatus,'NOT_LINKED');
 });
 await check('linked arithmetic HOLD is rejected at persistence boundary, not merely button UI',async()=>{
  const {storage,map}=makeStorage();
  await assert.rejects(()=>saveResearchSidecar({storage,dealId:deal.id,studyJson:study(),
    identityConfirmed:true,appraisalLink:bind('HOLD')}),/SIDECAR_APPRAISAL_HOLD_OR_STALE/);
  assert.equal(map.has(sidecarKey(deal.id)),false);
 });
 await check('stale link cannot be reused with another subject or later reverted subject',async()=>{
  const {storage,map}=makeStorage();
  await assert.rejects(()=>saveResearchSidecar({storage,dealId:deal.id,
    studyJson:study({...subject,valuationDate:'2026-03-02'}),
    identityConfirmed:true,appraisalLink:bind('REVIEW_REQUIRED')}),/SIDECAR_APPRAISAL_HOLD_OR_STALE/);
  await assert.rejects(()=>saveResearchSidecar({storage,dealId:deal.id,studyJson:study(),
    identityConfirmed:true,appraisalLink:{...bind('REVIEW_REQUIRED'),invalidated:true}}),/SIDECAR_APPRAISAL_HOLD_OR_STALE/);
  assert.equal(map.has(sidecarKey(deal.id)),false);
 });
 await check('appraisal for another property cannot save to similarly typed Saved Deal',async()=>{
  const {storage,map}=makeStorage();
  map.set('deals-index',JSON.stringify([{id:'SYN-WRONG-02',name:'عقار آخر'}]));
  map.set('deal:SYN-WRONG-02',JSON.stringify({id:'SYN-WRONG-02',name:'عقار آخر',mode:'building',inputs:{}}));
  await assert.rejects(()=>saveResearchSidecar({storage,dealId:'SYN-WRONG-02',studyJson:study(),
    identityConfirmed:true,appraisalLink:bind('REVIEW_REQUIRED')}),/SIDECAR_APPRAISAL_SAVED_DEAL_NAME_MISMATCH/);
  assert.equal(map.has(sidecarKey('SYN-WRONG-02')),false);
 });
 await check('linked REVIEW_REQUIRED may save inputs only, never authorization or report audit payload',async()=>{
  const {storage,map}=makeStorage();
  const v=await saveResearchSidecar({storage,dealId:deal.id,studyJson:study(),
    identityConfirmed:true,appraisalLink:bind('REVIEW_REQUIRED')});
  assert.equal(v.appraisalReviewStatus,'LINKED_REVIEW_REQUIRED_NOT_AUTHORIZED');
  assert.equal(v.canonicalDealUntouched,true);
  const serialized=map.get(sidecarKey(deal.id));
  assert.ok(!serialized.includes('SYN-REPORT-55'));
  assert.ok(!serialized.includes(sha));
  assert.ok(!serialized.includes('professionalUseAuthorized'));
  assert.equal(JSON.parse(serialized).certification,'NOT_AUTHORIZED');
  assert.equal((await loadResearchSidecar({storage,dealId:deal.id})).certification,'NOT_AUTHORIZED');
 });
 await check('invalid link object is rejected rather than silently treated as absent',async()=>{
  const {storage}=makeStorage();
  await assert.rejects(()=>saveResearchSidecar({storage,dealId:deal.id,studyJson:study(),
    identityConfirmed:true,appraisalLink:{kind:'INVALID'}}),/SIDECAR_APPRAISAL_HOLD_OR_STALE/);
 });
 console.log('SIDECAR_APPRAISAL_GATE='+n+'/'+n);
})().catch(error=>{console.error(error);process.exitCode=1;});

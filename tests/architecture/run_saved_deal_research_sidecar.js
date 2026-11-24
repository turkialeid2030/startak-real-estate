'use strict';
const assert=require('node:assert/strict');
const {
 listCanonicalDeals,sidecarKey,saveResearchSidecar,loadResearchSidecar,
}=require('../../src/market/saved-deal-study-sidecar');
const {encodeNationalStudyRegister,decodeNationalStudyRegister}=require('../../src/market/market-study-state');
const {marketEvidenceSubjectKey}=require('../../src/market/owner-market-evidence-scope');
const {captureReference}=require('../../src/market/no-api-source-bridge');
const store=new Map();
const storage={
 get:async k=>store.has(k)?store.get(k):null,
 set:async(k,v)=>{store.set(k,v);},
 delete:async k=>{store.delete(k);},
};
const landDeal={id:'DEAL-LAND-01',name:'Synthetic land',mode:'land',inputs:{}};
const buildingDeal={id:'DEAL-BUILD-02',name:'Synthetic compound',mode:'building',inputs:{}};
const createStudy=(assetType)=>JSON.stringify({
 kind:'STARTAK_PERSONAL_MARKET_STUDY',
 subject:{assetType,name:assetType==='LAND'?landDeal.name:buildingDeal.name,city:'الرياض',district:'الملقا',
 location:'24.75,46.65',landArea:'2000',unitCount:'10',builtArea:'3500'},
 assumptions:{occupancy:'0.90',expenseRatio:'0.20',capRate:'0.075'},
 sales:[],rentals:[],projects:[],marketOffers:[],unitMix:[],leaseComparables:[],
 rentAssumptions:{expenseRatio:'0.20',stabilizedOccupancy:'0.95'},
 report:{todayValueScenarioSar:2500000000,approved:true},
 appraisalQuality:{certifiedReportExportAllowed:true},authorizationStatus:'GO',
});
(async()=>{
 store.set('deals-index',JSON.stringify([{id:landDeal.id,name:landDeal.name},{id:buildingDeal.id,name:buildingDeal.name}]));
 store.set('deal:'+landDeal.id,JSON.stringify(landDeal));
 store.set('deal:'+buildingDeal.id,JSON.stringify(buildingDeal));
 const beforeLand=store.get('deal:'+landDeal.id),beforeBuilding=store.get('deal:'+buildingDeal.id),beforeIndex=store.get('deals-index');
 const list=await listCanonicalDeals(storage);
 assert.equal(list.length,2);
 await assert.rejects(
  ()=>saveResearchSidecar({storage,dealId:buildingDeal.id,studyJson:createStudy('RESIDENTIAL_COMPOUND')}),
  /SAME_PROPERTY_ATTESTATION_REQUIRED/
 );

 await assert.rejects(
  ()=>saveResearchSidecar({storage,dealId:landDeal.id,studyJson:createStudy('RESIDENTIAL_COMPOUND'),identityConfirmed:true}),
  /SAVED_DEAL_SUBJECT_TYPE_MISMATCH/
 );
 const linked=await saveResearchSidecar({storage,dealId:buildingDeal.id,
  studyJson:createStudy('RESIDENTIAL_COMPOUND'),identityConfirmed:true,
  clock:()=>new Date('2026-10-28T08:00:00Z')});
 assert.equal(linked.canonicalDealUntouched,true);
 assert.equal(JSON.parse(store.get(sidecarKey(buildingDeal.id))).samePropertyAttestation,'USER_ATTESTED_UNVERIFIED');

 assert.equal(linked.savedAt,'2026-10-28T08:00:00.000Z');
 assert.equal(store.get('deal:'+landDeal.id),beforeLand);
 assert.equal(store.get('deal:'+buildingDeal.id),beforeBuilding);
 assert.equal(store.get('deals-index'),beforeIndex);
 const restored=await loadResearchSidecar({storage,dealId:buildingDeal.id});
 assert.equal(restored.study.subject.assetType,'RESIDENTIAL_COMPOUND');
 assert.equal(restored.study.rentAssumptions.stabilizedOccupancy,'0.95');
 assert.equal(restored.recalculateRequired,true);
 assert.equal(Object.hasOwn(restored.study,'report'),false);
 assert.equal(Object.hasOwn(restored.study,'appraisalQuality'),false);
 const withRegister=JSON.parse(createStudy('RESIDENTIAL_COMPOUND'));
 const reference=captureReference({sourceId:'REGA_DEALS',city:'الرياض',district:'الملقا',observedOn:'2026-10-27'});
 withRegister.nationalResearch=encodeNationalStudyRegister(withRegister.subject,
   {subjectKey:marketEvidenceSubjectKey(withRegister.subject),records:[],references:[reference]});
 await saveResearchSidecar({storage,dealId:buildingDeal.id,studyJson:JSON.stringify(withRegister),
   identityConfirmed:true,overwrite:true});
 const restoredRegisterStudy=(await loadResearchSidecar({storage,dealId:buildingDeal.id})).study;
 assert.deepEqual(restoredRegisterStudy.nationalResearch,withRegister.nationalResearch);
 assert.equal(decodeNationalStudyRegister(restoredRegisterStudy.subject,restoredRegisterStudy.nationalResearch).references[0].decisionReady,false);
 assert.equal(store.get('deal:'+buildingDeal.id),beforeBuilding);
 const tampered=JSON.parse(store.get(sidecarKey(buildingDeal.id)));
 tampered.studyInputs.nationalResearch.subjectKey='other property';
 store.set(sidecarKey(buildingDeal.id),JSON.stringify(tampered));
 await assert.rejects(()=>loadResearchSidecar({storage,dealId:buildingDeal.id}),/STUDY_NATIONAL_SUBJECT_MISMATCH/);
 await assert.rejects(()=>saveResearchSidecar({storage,dealId:buildingDeal.id,
  studyJson:createStudy('RESIDENTIAL_COMPOUND'),identityConfirmed:true}),/SIDECAR_EXISTS_CONFIRM_OVERWRITE/);
 await saveResearchSidecar({storage,dealId:buildingDeal.id,
  studyJson:createStudy('RESIDENTIAL_COMPOUND'),identityConfirmed:true,overwrite:true});
 const landLinked=await saveResearchSidecar({storage,dealId:landDeal.id,studyJson:createStudy('LAND'),identityConfirmed:true});
 assert.equal(landLinked.dealMode,'land');
 assert.equal((await loadResearchSidecar({storage,dealId:landDeal.id})).study.subject.assetType,'LAND');
 store.delete('deal:'+buildingDeal.id);
 await assert.rejects(()=>loadResearchSidecar({storage,dealId:buildingDeal.id}),/SAVED_DEAL_NOT_FOUND/);
 store.set('deal:'+buildingDeal.id,JSON.stringify({...buildingDeal,mode:'land'}));
 await assert.rejects(()=>loadResearchSidecar({storage,dealId:buildingDeal.id}),/SIDECAR_ID_OR_MODE_MISMATCH/);
 await assert.rejects(()=>saveResearchSidecar({storage,dealId:'../bad',studyJson:createStudy('LAND'),identityConfirmed:true}),/SAVED_DEAL_ID_INVALID/);
 await assert.rejects(()=>loadResearchSidecar({storage,dealId:'MISSING-ID'}),/SAVED_DEAL_NOT_IN_INDEX/);
 assert.equal(sidecarKey(landDeal.id),'market-study-sidecar:v1:'+landDeal.id);
 console.log('STARTAK_SAVED_DEAL_RESEARCH_SIDECAR: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});

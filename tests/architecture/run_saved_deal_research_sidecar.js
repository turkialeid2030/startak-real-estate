'use strict';
const assert=require('node:assert/strict');
const {
 listCanonicalDeals,sidecarKey,saveResearchSidecar,loadResearchSidecar,
}=require('../../src/market/saved-deal-study-sidecar');
const {encodeNationalStudyRegister,decodeNationalStudyRegister}=require('../../src/market/market-study-state');
const {marketEvidenceSubjectKey}=require('../../src/market/owner-market-evidence-scope');
const {captureReference}=require('../../src/market/no-api-source-bridge');
const {encodeSupplementalStudyRegister,decodeSupplementalStudyRegister}=require('../../src/market/supplemental-study-register');
const {parsePersonalMarketStudy,MAX_BYTES}=require('../../src/market/market-study-state');
const {toPublicSample,parseResearchCsv}=require('../../src/market/suhail-national-neighborhood-research');
const {importEarthResearchCsv}=require('../../src/market/earth-national-research');
const {parseListingResearchCsv}=require('../../src/market/saudi-listing-source-research');
const {hasCapturedOwnerResearch}=require('../../src/market/owner-market-evidence-scope');
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
 const observedOn='2026-10-28', asOf='2026-10-29';
 const suhail= parseResearchCsv('city,district,transferCount,totalValueSar,residentialSarSqm\nالرياض,الملقا,2,1500000,5000',{observedOn}).records;
 const earth=importEarthResearchCsv('city,district,recordId,eventDate,amountSar,areaSqm\nالرياض,الملقا,EARTH-1,2026-10-27,5000000,1000',{featureId:'TRANSACTION_TABLE',observedOn,asOf}).records;
 const listings=parseListingResearchCsv('source,city,district,kind,priceSar,areaSqm,listingUrl,listingId,assetType,listingDate\nAQAR,الرياض,الملقا,SALE_OFFER,1500000,300,https://sa.aqar.fm/a/100,100,RESIDENTIAL_VILLA,2026-10-26',{observedOn,asOf}).records;
 assert.equal(suhail.length,1);assert.equal(earth.length,1);assert.equal(listings.length,1);
 const feeds={suhail:[...toPublicSample(),...suhail],earth,listings};
 const boundKey=marketEvidenceSubjectKey(withRegister.subject);
 assert.equal(hasCapturedOwnerResearch({suhail:toPublicSample()}),false);
 assert.equal(hasCapturedOwnerResearch({suhail:feeds.suhail}),true);
 const envelope=encodeSupplementalStudyRegister(withRegister.subject,feeds,boundKey);
 withRegister.supplementalResearch=envelope;
 assert.equal(envelope.suhail.length,1);
 assert.deepEqual(decodeSupplementalStudyRegister(withRegister.subject,envelope),feeds);
 assert.equal(encodeSupplementalStudyRegister(withRegister.subject,{suhail:toPublicSample()},boundKey),undefined);
 assert.equal(decodeSupplementalStudyRegister(withRegister.subject,undefined).suhail.length,10);
 assert.throws(()=>encodeSupplementalStudyRegister({...withRegister.subject,name:'OTHER'},feeds,boundKey),/STUDY_SUPPLEMENTAL_SUBJECT_MISMATCH/);
 assert.throws(()=>parsePersonalMarketStudy('ع'.repeat(MAX_BYTES/2+1)),/STUDY_SIZE_LIMIT/);
 for(const mutate of [
  e=>{e.subjectKey='other';},e=>{e.schemaVersion=2;},
  e=>{e.suhail[0].recordClass='NEIGHBORHOOD_AGGREGATE_INDEXED_UNVERIFIED';},
  e=>{e.suhail[0].transferCount=-1;},e=>{e.suhail[0].sourceUrl='https://suhail.ai/?token=secret';},
  e=>{e.earth[0].officialRegistryVerified=true;},e=>{e.earth[0].evidenceKind='ASKING_OFFER';},
  e=>{e.listings[0].professionalReportAuthorized=true;},e=>{e.listings[0].listingUrl='https://example.com/123';},
  e=>{e.listings[0].unknownField='secret';},e=>{e.listings.push(e.listings[0]);},
 ]) {
  const changed=structuredClone(envelope);mutate(changed);
  assert.throws(()=>decodeSupplementalStudyRegister(withRegister.subject,changed),/STUDY_SUPPLEMENTAL_/);
 }
 const reference=captureReference({sourceId:'REGA_DEALS',city:'الرياض',district:'الملقا',observedOn:'2026-10-27'});
 withRegister.nationalResearch=encodeNationalStudyRegister(withRegister.subject,
   {subjectKey:marketEvidenceSubjectKey(withRegister.subject),records:[],references:[reference]});
 await saveResearchSidecar({storage,dealId:buildingDeal.id,studyJson:JSON.stringify(withRegister),
   identityConfirmed:true,overwrite:true});
 const restoredRegisterStudy=(await loadResearchSidecar({storage,dealId:buildingDeal.id})).study;
 assert.deepEqual(restoredRegisterStudy.nationalResearch,withRegister.nationalResearch);
 assert.deepEqual(restoredRegisterStudy.supplementalResearch,envelope);
 assert.deepEqual(decodeSupplementalStudyRegister(restoredRegisterStudy.subject,restoredRegisterStudy.supplementalResearch),feeds);
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

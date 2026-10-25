'use strict';
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {VERSION,MAX_ARCHIVE_BYTES,canonicalState,
 createPersonalSectorCaseArchive,verifyPersonalSectorCaseArchive}=
 require('../../src/valuation-intelligence/personal-sector-case-archive');
const subtle=webcrypto.subtle;
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const reject=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);checks++};
const state={
 assetClass:'HOSPITALITY',
 subject:{city:'الرياض',district:'العليا',subtype:'فندق 4 نجوم',date:'2026-10-25',area:'15000',right:'FREEHOLD'},
 methods:{income:true,cost:true,market:true},
 inc:{gross:'16000000',opex:'4000000',cap:'0.09',expenseTreatment:'ACTUAL_LANDLORD_OPEX',realEstateOnly:true,groundLease:false,sharedCosts:false},
 cost:{land:'60000000',replacement:'90000000',depreciation:'0.2',excludesBusiness:true},
 comparables:Array.from({length:3},(_,i)=>({id:'SALE-'+i,city:'الرياض',district:'العليا',
   subtype:'فندق 4 نجوم',right:'FREEHOLD',date:'2026-09-05',unitValue:'1100000',source:'export-'+i,unit:'ROOM_KEY'})),
 marketOptions:{unit:'ROOM_KEY',quantity:'110',businessExcluded:true,mixedAllocated:false},
 policy:{maxDispersion:'0.2',incomeWeight:'0.4',costWeight:'0.3',marketWeight:'0.3'},
};
(async()=>{
 eq(VERSION,'PERSONAL_SECTOR_CASE_ARCHIVE_V1');
 eq(MAX_ARCHIVE_BYTES,65536);
 const created=await createPersonalSectorCaseArchive(state,{subtle,createdAt:'2026-10-25T12:00:00.000Z'});
 eq(created.sha256.length,64);
 eq(created.state.assetClass,'HOSPITALITY');
 eq(created.state.inc.realEstateOnly,true);
 eq(JSON.stringify(created).includes('scenarioAmountSar'),false);
 const restored=await verifyPersonalSectorCaseArchive(JSON.parse(JSON.stringify(created)),{subtle,expectedAssetClass:'HOSPITALITY'});
 eq(restored,state);
 const changed=structuredClone(created);
 changed.state.cost.replacement='90000001';
 await reject(()=>verifyPersonalSectorCaseArchive(changed,{subtle}),'ARCHIVE_SHA256_MISMATCH');
 const changedRights=structuredClone(created);
 changedRights.state.subject.right='WAQF_RESTRICTED';
 await reject(()=>verifyPersonalSectorCaseArchive(changedRights,{subtle}),'ARCHIVE_SHA256_MISMATCH');
 const changeComputed=structuredClone(created);changeComputed.results={status:'CERTIFIED',value:9e12};
 await reject(()=>verifyPersonalSectorCaseArchive(changeComputed,{subtle}),'INVALID_ARCHIVE_STRUCTURE');
 await reject(()=>verifyPersonalSectorCaseArchive(created,{subtle,expectedAssetClass:'OFFICE'}),'ASSET_CLASS_MISMATCH');
 const downgraded=structuredClone(created);downgraded.version='UNSAFE_V0';
 await reject(()=>verifyPersonalSectorCaseArchive(downgraded,{subtle}),'ARCHIVE_VERSION_DATE_OR_HASH_INVALID');
 const wrongType=structuredClone(created);wrongType.state.inc.realEstateOnly='true';
 await reject(()=>verifyPersonalSectorCaseArchive(wrongType,{subtle}),'WRONG_INC_FIELD_TYPE');
 const fakeSector=structuredClone(created);fakeSector.state.assetClass='FICTITIOUS';
 await reject(()=>verifyPersonalSectorCaseArchive(fakeSector,{subtle}),'UNKNOWN_ASSET_CLASS');
 const badComp=structuredClone(created);badComp.state.comparables.pop();
 await reject(()=>verifyPersonalSectorCaseArchive(badComp,{subtle}),'INVALID_COMPARABLE_COUNT');
 const corrupt=structuredClone(created);corrupt.sha256='0'.repeat(64);
 await reject(()=>verifyPersonalSectorCaseArchive(corrupt,{subtle}),'ARCHIVE_SHA256_MISMATCH');
 const dangerous=structuredClone(created);dangerous.state.comparables[0].source='<script>alert(1)</script>';
 await reject(()=>verifyPersonalSectorCaseArchive(dangerous,{subtle}),'ARCHIVE_SHA256_MISMATCH');
 const big=structuredClone(state);big.subject.city='R'.repeat(1000);
 await reject(()=>createPersonalSectorCaseArchive(big,{subtle}),'UNSAFE_SUBJECT_FIELD');
 await reject(()=>createPersonalSectorCaseArchive(state,{subtle:null}),'WEBCRYPTO_SHA256_REQUIRED');
 const extra=structuredClone(state);extra.finalValue=12345;
 assert.throws(()=>canonicalState(extra),e=>e.code==='UNKNOWN_STATE_FIELDS');checks++;
 const ui=fs.readFileSync(path.resolve(__dirname,'../../src/components/PersonalSectorValuationWorkbench.jsx'),'utf8');
 assert.match(ui,/data-testid="personal-sector-export-case"/);checks++;
 assert.match(ui,/data-testid="personal-sector-import-case"/);checks++;
 assert.match(ui,/new TextDecoder\('utf-8',\{fatal:true\}\)/);checks++;
 assert.match(ui,/setOutput\(null\)/);checks++;
 assert.match(ui,/expectedAssetClass:assetClass/);checks++;
 console.log('PERSONAL_SECTOR_CASE_ARCHIVE_INTEGRITY=PASS checks='+checks);
 console.log('ARCHIVED_VALUATION_OUTPUT_OR_AUTHORITY=NONE');
})().catch(e=>{console.error(e);process.exitCode=1;});

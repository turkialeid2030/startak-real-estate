'use strict';
const assert=require('node:assert/strict');
const {ownerMarketEvidenceGuidance:guide}=require('../../src/market/owner-market-evidence-guidance');
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const absent=guide(null,'ar-SA');
check(absent.available===false,'unavailable until canonical summary materializes');
check(absent.items.length===0,'no invented evidence items');
check(absent.unverified===true,'no source authenticity inferred');
const raw={
 identityIssues:['MARKET_PURPOSE_REQUIRED','PROPERTY_RIGHT_DECLARATION_REQUIRED'],
 issues:['NO_EXECUTED_SALE_COMPARABLES','LOCATION_EVIDENCE_MISSING','SPECIALIST_METHOD_REQUIRED'],
 notices:['SOURCE_INDEPENDENCE_NOT_VERIFIED','DISTRICT_APPROXIMATION_USED','NO_EXECUTED_SALE_COMPARABLES'],
 marketDataIndependentlyVerified:false
};
const ar=guide(raw,'ar-SA'),en=guide(raw,'en');
check(ar.available===true,'canonical review available');
check(ar.unverified===true,'unverified stays unverified');
check(ar.items.length===7,'deduplicated issue and notice counts');
check(ar.items[0].description.includes('غرض'),'identity details shown first in Arabic');
check(ar.items.find(x=>x.key==='NO_EXECUTED_SALE_COMPARABLES').description.includes('ثلاث'),'engine threshold preserved');
check(ar.items.find(x=>x.key==='SOURCE_INDEPENDENCE_NOT_VERIFIED').kind==='review','unverified source is review note not fabricated automatic fail');
check(en.items[0].description.includes('purpose'),'English market mandate');
check(en.items.find(x=>x.key==='SPECIALIST_METHOD_REQUIRED').description.includes('specialist'),'specialist gap bilingual');
check(!JSON.stringify(ar.items.map(x=>x.description)).includes('NO_EXECUTED'),'no raw codes leaked to user');
const novel=guide({issues:['UNEXPECTED_FUTURE_GATE'],notices:[]},'en');
check(novel.items.length===1,'unexpected upstream gate still visible');
check(novel.items[0].description.includes('Additional market review'),'never silently drop unknown hard gate');
check(!novel.items[0].description.includes('UNEXPECTED_FUTURE_GATE'),'never show cryptic internal code');
console.log('OWNER_MARKET_EVIDENCE_GUIDANCE=PASS assertions='+checks+' synthetic_only=true');

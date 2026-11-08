'use strict';
const assert=require('node:assert/strict');
const {marketEvidenceSubjectKey:subjectKey,hasResearchComparables:entered}=require('../../src/market/owner-market-evidence-scope');
let count=0;const check=(value,why)=>{assert.ok(value,why);count++};
const original={name:'SYNTHETIC A',assetType:'RESIDENTIAL_COMPOUND',city:'الرياض',district:'افتراضي',
 location:'24.7136,46.6753',propertyRight:'FULL_OWNERSHIP',valuationDate:'2026-10-15'};
const key=subjectKey(original);
check(typeof key==='string'&&key.length>30,'stable key exists');
check(subjectKey({...original,valuationDate:'2026-09-15'})===key,'date change must not rebind an unrelated parcel');
check(subjectKey({...original,name:' SYNTHETIC   A '})===key,'normalize accidental spacing');
check(subjectKey({...original,name:'SYNTHETIC B'})!==key,'different property name must not silently reuse comparables');
check(subjectKey({...original,city:'جدة'})!==key,'city switch changes subject');
check(subjectKey({...original,district:'آخر'})!==key,'district switch changes subject');
check(subjectKey({...original,location:'24.7145,46.6753'})!==key,'parcel location switch changes subject');
check(subjectKey({...original,assetType:'OFFICE_TOWER'})!==key,'asset class switch changes subject');
check(subjectKey({...original,propertyRight:'USUFRUCT'})!==key,'property right switch changes subject');
check(subjectKey({...original,location:'https://www.google.com/maps/@24.7136,46.6753,17z'})===key,
 'equivalent precise map coordinates map to same subject');
check(!entered([{status:'ASKING',sourceRecordId:'',assetType:'',price:'',location:''}],[]),
 'blank UI row must not bind subject');
check(entered([{sourceRecordId:'SYNTH-CASE'}],[]),'entered market source binds subject');
check(entered([], [{annualRent:'500000'}]),'entered rental binds subject');
check(entered([{assetType:'RESIDENTIAL_COMPOUND'}],[]),'partially entered comparison binds subject conservatively');
check(!entered([{status:'ASKING'}],[]),'ASKING default alone is not user research');
console.log('OWNER_MARKET_EVIDENCE_SCOPE=PASS assertions='+count+' synthetic_only=true');

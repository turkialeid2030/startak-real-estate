'use strict';
// Characterization of the owner market presentation gate only.
// No asserted property right can substitute professional title verification.
const assert=require('node:assert/strict');
const {marketIdentityGate}=require('../../src/market/owner-market-identity-gate');
const at=new Date('2026-11-06T20:00:00.000Z');
const valid={name:'SYNTHETIC PROPERTY',valuationPurpose:'ACQUISITION',
 valuationDate:'2026-11-06',propertyRight:'FULL_OWNERSHIP'};
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
function refused(mod,reason){
 const result=marketIdentityGate({...valid,...mod},at);
 check(result.allow===false,'must fail closed: '+reason);
 check(result.issues.includes(reason),'specific issue: '+reason);
}
check(marketIdentityGate(valid,at).allow,'complete synthetic research mandate');
for(const purpose of ['ACQUISITION','SALE_STUDY','PORTFOLIO_REVIEW','RENT_STUDY','FINANCING_REVIEW','OTHER']){
 check(marketIdentityGate({...valid,valuationPurpose:purpose},at).allow,'documented market purpose '+purpose);
}
for(const right of ['FULL_OWNERSHIP','USUFRUCT','LONG_LEASE','OTHER']){
 check(marketIdentityGate({...valid,propertyRight:right},at).allow,'declared right '+right);
}
refused({valuationPurpose:''},'MARKET_PURPOSE_REQUIRED');
refused({valuationPurpose:'SALE_OR_CERTIFIED_VALUATION'},'MARKET_PURPOSE_REQUIRED');
// Research purpose is supported, but a certified/transaction authorization claim is not.
check(marketIdentityGate({...valid,valuationPurpose:'SALE_STUDY'},at).allow,
 'SALE_STUDY is a declared, non-certified market-research purpose');
refused({valuationDate:''},'VALUATION_DATE_REQUIRED_OR_INVALID');
refused({valuationDate:'2026-02-30'},'VALUATION_DATE_REQUIRED_OR_INVALID');
refused({valuationDate:'2026-11-07'},'FUTURE_VALUATION_DATE_NOT_SUPPORTED');
refused({propertyRight:'UNKNOWN'},'PROPERTY_RIGHT_DECLARATION_REQUIRED');
refused({propertyRight:''},'PROPERTY_RIGHT_DECLARATION_REQUIRED');
refused({name:''},'MARKET_SUBJECT_NAME_REQUIRED');
refused({name:'   '},'MARKET_SUBJECT_NAME_REQUIRED');
check(!marketIdentityGate(null,at).allow,'missing subject');
check(marketIdentityGate(valid,new Date('2026-11-06T20:00:00Z')).allow,
 'Saudi calendar day accepted even when UTC clock is already previous-day boundary');
assert.throws(()=>marketIdentityGate(valid,new Date(NaN)),/MARKET_IDENTITY_CLOCK_INVALID/);checks++;
console.log('OWNER_MARKET_IDENTITY_GATE=PASS assertions='+checks+' synthetic_only=true');

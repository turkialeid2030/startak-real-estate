'use strict';
const assert = require('node:assert/strict');
const {operatingCase, collectionRecord, verified, AS_OF}=require('../fixtures/synthetic-collections-case');
const {addVerifiedRentCollection,updateVerifiedLeaseTerms,calculateOperatingMetrics,createRentCollectionRecord,buildResidentialIncomeOperatingCaseEnvelope,parseResidentialIncomeOperatingCaseEnvelope}=require('../../src/residential-income-acquisition');
const {calculateCollectionsReconciliation}=require('../../src/residential-income-acquisition/collections-reconciliation');
let checks=0;
function check(fn){fn();checks++;}
const base=operatingCase({collections:[]});
const draft={collectionId:'COLL-NEW',leaseId:'LEASE-1',periodStart:'2026-01-01',periodEnd:AS_OF,contractualRentDue:100,collectedRent:90,potentialGrossRent:120,concessions:0,sourceRef:'source://test',adoptionDecisionRef:'adoption://test',confirmed:true};
for(const field of ['contractualRentDue','collectedRent','potentialGrossRent','concessions']){
 for(const value of ['', ' ',null,undefined,false,true,[],{},'0x10','1e3','Infinity',NaN,-1,'-1'])check(()=>assert.throws(()=>addVerifiedRentCollection(base,{...draft,[field]:value})));
 check(()=>assert.equal(addVerifiedRentCollection(base,{...draft,[field]:0}).rentCollections[0][field].value,0));
 check(()=>assert.equal(addVerifiedRentCollection(base,{...draft,[field]:'١٢٣٫٤٥'}).rentCollections[0][field].value,123.45));
}
for(const value of ['',null,false,[],{},'0x10','1e3',-1])check(()=>assert.throws(()=>updateVerifiedLeaseTerms(base,{leaseId:'LEASE-1',baseRent:value,endDate:'2027-01-01',sourceRef:'source://lease',adoptionDecisionRef:'adoption://lease',confirmed:true})));
for(const value of ['2026-02-30','2026-13-01','01/02/2026','not-a-date']){
 check(()=>assert.throws(()=>addVerifiedRentCollection(base,{...draft,periodEnd:value})));
 check(()=>assert.throws(()=>collectionRecord({periodEnd:value})));
}
check(()=>assert.throws(()=>addVerifiedRentCollection(base,{...draft,periodEnd:'2026-09-02'}),/COLLECTION_PERIOD_ENDS_AFTER_AS_OF_DATE/));
check(()=>assert.throws(()=>addVerifiedRentCollection(base,{...draft,confirmed:false}),/EXPLICIT_VERIFICATION_CONFIRMATION_REQUIRED/));
const first=collectionRecord({collectionId:'FIRST',periodStart:'2026-01-01',periodEnd:'2026-02-01'});
const second=collectionRecord({collectionId:'SECOND',periodStart:'2026-02-01',periodEnd:AS_OF});
const make=(row,collected)=>createRentCollectionRecord({...row,collectedRent:verified(row.collectedRent.field,collected,'SAR',row.collectedRent.sourceRef)});
const scenario=operatingCase({collections:[make(first,140000),make(second,60000)]});
const result=calculateOperatingMetrics(scenario).collectionsReconciliation;
check(()=>assert.equal(result.collectionRate,1));
check(()=>assert.equal(result.totals.creditLoss,40000));
check(()=>assert.equal(result.totals.uncollectedContractualRent,40000));
check(()=>assert.equal(result.totals.excessCollectionsRequiringAllocation,40000));
check(()=>assert.equal(result.totals.economicLoss,60000));
check(()=>assert.equal(result.totals.contractualRentDue-result.totals.rentCollected,result.totals.uncollectedContractualRent-result.totals.excessCollectionsRequiringAllocation));
check(()=>assert.ok(result.issues.some(x=>x.code==='EXCESS_COLLECTION_REQUIRES_ALLOCATION_REVIEW')));
check(()=>assert.equal(result.stabilizedNoiCalculated,false));
const restored=parseResidentialIncomeOperatingCaseEnvelope(JSON.stringify(buildResidentialIncomeOperatingCaseEnvelope(scenario)));
check(()=>assert.deepEqual(calculateOperatingMetrics(restored).collectionsReconciliation,result));
const copy=JSON.parse(JSON.stringify(scenario));copy.rentCollections[0].collectedRent.effectiveDate='bad-date';
check(()=>assert.equal(calculateCollectionsReconciliation(copy).collectionRate,null));
copy.asOfDate='bad-date';check(()=>assert.equal(calculateCollectionsReconciliation(copy).collectionRate,null));
for(let a=0;a<=200;a+=25)for(let b=0;b<=200;b+=25){
 const r=calculateOperatingMetrics(operatingCase({collections:[make(first,a*1000),make(second,b*1000)]})).collectionsReconciliation;
 check(()=>assert.equal(r.totals.uncollectedContractualRent,Math.max(0,100000-a*1000)+Math.max(0,100000-b*1000)));
 check(()=>assert.equal(r.totals.contractualRentDue-r.totals.rentCollected,r.totals.uncollectedContractualRent-r.totals.excessCollectionsRequiringAllocation));
}
console.log(`AUDIT_COLLECTIONS_INTEGRITY=PASS checks=${checks}`);

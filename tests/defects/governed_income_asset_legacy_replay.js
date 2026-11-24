'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {args,caseId,propertyRef,asOfDate,leaseRecords,rentRollSnapshot,incomeEvidencePacket,tenantStrengthAssessments,assessment,makeLease,verification,evaluate,S}=require('../fixtures/synthetic-income-asset');
const result=evaluate(args());
assert.equal(result.status,S.READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW,JSON.stringify(result.blockers));
assert.equal(result.metrics.occupancyRatio,.8);assert.equal(result.metrics.vacantAreaSqm,200);
assert.equal(result.metrics.annualContractRentSar,1000000);assert.equal(result.metrics.annualRentPerOccupiedSqmSar,1250);
assert.equal(result.metrics.activeLeaseCount,3);assert.equal(result.metrics.activeTenantCount,2);
assert.equal(result.metrics.topTenantRentShare,.7);assert.equal(result.metrics.topThreeTenantRentShare,1);
assert.ok(Math.abs(result.metrics.tenantRentHhi-.58)<1e-12);
assert.equal(result.expiryConcentration[0].horizonEnd,'2027-04-30T00:00:00.000Z');assert.equal(result.expiryConcentration[0].rentShare,.6);
assert.equal(result.expiryConcentration[1].rentShare,.9);assert.equal(result.riskFlags.length,5);
for(const k of ['sourceAuthenticityIndependentlyVerified','tenantStrengthAutomaticallyScored','noiForecastGenerated','dcfPerformed','transactionAuthorized','approvalAuthorized','productionAuthorityGranted'])assert.equal(result[k],false);
function stable(v){if(Array.isArray(v))return v.map(stable);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));}
function rehash(v,key){const x={...v};delete x[key];x[key]=crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');return x;}
const forged=rehash({...incomeEvidencePacket,annualContractRentSar:2000000,activeLeases:incomeEvidencePacket.activeLeases.map(l=>({...l,contractedAnnualRentSarAsOfDate:l.contractedAnnualRentSarAsOfDate*2}))},'incomeEvidencePacketHashSha256');
const wrongLease=rehash({...leaseRecords[0],propertyRef:'OTHER'},'leaseEvidenceHashSha256');
const futureLease=makeLease('L1','A',400,600000,'2027-04-30',{capturedAt:'2026-11-01',verification:{...verification,verifiedAt:'2026-11-02'}});
const failures=[
 args({leaseRecords:[]}),
 args({leaseRecords:[...leaseRecords,leaseRecords[0]]}),
 args({leaseRecords:[wrongLease,...leaseRecords.slice(1)]}),
 args({leaseRecords:[futureLease,...leaseRecords.slice(1)]}),
 args({incomeEvidencePacket:forged}),
 args({rentRollSnapshot:{...rentRollSnapshot,annualContractRentSar:1}}),
 args({tenantStrengthAssessments:[assessment('A')]}),
 args({tenantStrengthAssessments:[assessment('A',{validUntil:'2026-10-26'}),assessment('B')]}),
 args({tenantStrengthAssessments:[assessment('A',{propertyRef:'OTHER'}),assessment('B')]}),
 args({}, {expiryConcentrationRules:[{horizonMonths:121,maximumRentShare:.5}]}),
 args({}, {minimumOccupancyRatio:1.1}),
];
for(const x of failures){const held=evaluate(x);assert.notEqual(held.status,S.READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW);assert.equal(held.metrics,null);assert.equal(held.transactionAuthorized,false);}
assert.throws(()=>assessment('A',{assessedAt:'2026-02-30'}),/valid UTC/);
console.log('C11_INCOME_ASSET_LEGACY_REPLAY=PASS synthetic_only=true negative_cases='+failures.length);

const {reviewLocalIncomeAsset}=require('../../src/income/local-income-asset-review');
(async()=>{
 const opts={expectedCaseId:caseId,expectedPropertyRef:propertyRef,asOfDate};
 const local=await reviewLocalIncomeAsset({...opts,text:JSON.stringify({...args(),report:{transactionAuthorized:true}})});
 assert.equal(local.status,result.status,JSON.stringify(local.blockers));
 assert.deepEqual(local.metrics,result.metrics);
 assert.deepEqual(local.tenants,result.tenants);
 assert.deepEqual(local.expiryConcentration,result.expiryConcentration);
 assert.deepEqual(local.riskFlags,result.riskFlags);
 assert.equal(local.transactionAuthorized,false);
 for(const x of failures){
  const h=await reviewLocalIncomeAsset({...opts,text:JSON.stringify(x)});
  assert.notEqual(h.status,S.READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW);
  assert.equal(h.metrics,null);
  assert.equal(h.transactionAuthorized,false);
 }
 const wrong=await reviewLocalIncomeAsset({...opts,expectedPropertyRef:'OTHER',text:JSON.stringify(args())});
 assert.equal(wrong.blockers[0],'C11_EXPECTED_SCOPE_OR_DATE_MISMATCH');
 console.log('C11_NATIVE_WEBCRYPTO_PARITY=PASS synthetic_only=true actual_browser_pending=true');
})().catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createLeaseEvidenceRecord,createVerifiedRentRollSnapshot,reconcileLeaseIncomeEvidence}=require('../../src/market/lease-income-evidence');
const {INCOME_ASSET_STATUS:S,POLICY_VERSION,createGovernedTenantStrengthAssessment,tenantAssessmentBindings,computeIncomeAssetReviewPolicyHash,evaluateGovernedIncomeAssetIntelligence:evaluate}=require('../../src/income/contractual-income-asset-review');
const caseId='SYNTH-C11',propertyRef='SYNTH-PROPERTY',asOfDate='2026-10-31';
const verification={status:'VERIFIED',verifiedByRef:'SYNTH-REVIEWER',verifiedAt:'2026-10-25',evidenceRef:'SYNTH-REVIEW'};
const makeLease=(leaseId,tenantRef,areaSqm,rent,expiryDate,patch={})=>createLeaseEvidenceRecord({leaseId,caseId,propertyRef,unitRef:'UNIT-'+leaseId,tenantRef,leaseInterestRef:'INTEREST-'+leaseId,areaSqm,baseAnnualRentSar:rent,contractedAnnualRentSarAsOfDate:rent,startDate:'2025-01-01',expiryDate,escalation:{type:'NONE'},sourceClass:'VERIFIED_EXECUTED_LEASE',sourceRef:'SYNTH-SOURCE',sourceDocumentHashSha256:'a'.repeat(64),verification,capturedAt:'2026-10-20',...patch});
const leaseRecords=[makeLease('L1','A',400,600000,'2027-04-30'),makeLease('L2','A',100,100000,'2028-01-01'),makeLease('L3','B',300,300000,'2027-10-31')];
const rentRollSnapshot=createVerifiedRentRollSnapshot({snapshotId:'ROLL',caseId,propertyRef,asOfDate,totalLettableAreaSqm:1000,occupiedAreaSqm:800,annualContractRentSar:1000000,activeLeaseCount:3,sourceRef:'SYNTH-ROLL',sourceDocumentHashSha256:'b'.repeat(64),verification,capturedAt:'2026-10-24'});
const incomeEvidencePacket=reconcileLeaseIncomeEvidence({caseId,propertyRef,asOfDate,leaseRecords,rentRollSnapshot});
const assessment=(tenantRef,patch={})=>createGovernedTenantStrengthAssessment({assessmentId:'ASSESS-'+tenantRef,caseId,propertyRef,tenantRef,strengthBand:'SYNTH-REVIEWED',methodologyRef:'SYNTH-METHOD',evidenceRefs:['SYNTH-DOC'],assessedByRef:'SYNTH-REVIEWER',assessedAt:'2026-10-25',validUntil:'2026-12-31',reviewEvidenceRef:'SYNTH-REVIEW',...patch});
const tenantStrengthAssessments=[assessment('A'),assessment('B')];
function args(overrides={},policyPatch={}){
 const input={leaseRecords,rentRollSnapshot,incomeEvidencePacket,tenantStrengthAssessments,reviewPolicyId:'POLICY',...overrides};
 const policy={version:POLICY_VERSION,policyId:'POLICY',caseId,propertyRef,asOfDate,incomeEvidencePacketHashSha256:input.incomeEvidencePacket.incomeEvidencePacketHashSha256,rentRollHashSha256:input.rentRollSnapshot.rentRollHashSha256,tenantAssessmentBindings:tenantAssessmentBindings(input.tenantStrengthAssessments),minimumOccupancyRatio:.85,maximumTopTenantRentShare:.6,maximumTopThreeTenantRentShare:.95,expiryConcentrationRules:[{horizonMonths:6,maximumRentShare:.5},{horizonMonths:12,maximumRentShare:.8}],reviewedByRef:'SYNTH-REVIEWER',reviewEvidenceRef:'SYNTH-POLICY',reviewedAt:'2026-10-31',...policyPatch};
 policy.policyHashSha256=computeIncomeAssetReviewPolicyHash(policy);
 return {...input,governedReviewPolicies:{POLICY:policy}};
}
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

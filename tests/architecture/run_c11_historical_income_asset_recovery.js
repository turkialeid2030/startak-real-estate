'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const c=require('../../src/income/governed-income-asset-intelligence'),l=require('../../src/market/lease-income-evidence');
const S=c.INCOME_ASSET_STATUS,READY=S.READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW;
const H='a'.repeat(64),scope={caseId:'SYNTH-CASE',propertyRef:'SYNTH-PROPERTY'},asOfDate='2026-09-10T12:00:00Z',past='2026-09-09T09:00:00Z',future='2027-09-20T00:00:00Z',verification={status:'VERIFIED',verifiedByRef:'R',verifiedAt:past,evidenceRef:'E'};
function lease(id='A',patch={}){return l.createLeaseEvidenceRecord({...scope,leaseId:id,unitRef:'U-'+id,tenantRef:'T-'+id,leaseInterestRef:'I-'+id,areaSqm:40,baseAnnualRentSar:600,contractedAnnualRentSarAsOfDate:600,startDate:'2026-01-01T00:00:00Z',expiryDate:'2026-11-10T12:00:00Z',escalation:{type:'NONE'},sourceClass:'VERIFIED_EXECUTED_LEASE',sourceRef:'L-'+id,sourceDocumentHashSha256:H,verification,capturedAt:past,...patch});}
function assessment(id='A',patch={}){return c.createGovernedTenantStrengthAssessment({...scope,assessmentId:'A-'+id,tenantRef:'T-'+id,strengthBand:'EXTERNAL',methodologyRef:'M',evidenceRefs:['E'],assessedByRef:'R',assessedAt:past,validUntil:future,reviewEvidenceRef:'R-E',...patch});}
function fixture(records=[lease(),lease('B',{areaSqm:20,baseAnnualRentSar:400,contractedAnnualRentSarAsOfDate:400,expiryDate:future})],assessments=[assessment(),assessment('B')],patch={},snapshotPatch={}){
 const snapshot=l.createVerifiedRentRollSnapshot({...scope,snapshotId:'S',asOfDate,totalLettableAreaSqm:100,occupiedAreaSqm:60,annualContractRentSar:1000,activeLeaseCount:2,sourceRef:'RR',sourceDocumentHashSha256:H,verification,capturedAt:past,...snapshotPatch});
 const packet=l.reconcileLeaseIncomeEvidence({...scope,asOfDate,leaseRecords:records,rentRollSnapshot:snapshot});
 const p={version:c.POLICY_VERSION,policyId:'POL',...scope,asOfDate,incomeEvidencePacketHashSha256:packet.incomeEvidencePacketHashSha256,rentRollHashSha256:snapshot.rentRollHashSha256,tenantAssessmentBindings:c.tenantAssessmentBindings(assessments),minimumOccupancyRatio:0.8,maximumTopTenantRentShare:0.5,maximumTopThreeTenantRentShare:0.9,expiryConcentrationRules:[{horizonMonths:2,maximumRentShare:0.5}],reviewedByRef:'R',reviewEvidenceRef:'PE',reviewedAt:'2026-09-10T11:00:00Z',...patch};p.policyHashSha256=c.computeIncomeAssetReviewPolicyHash(p);
 return {incomeEvidencePacket:packet,rentRollSnapshot:snapshot,leaseRecords:records,tenantStrengthAssessments:assessments,reviewPolicyId:'POL',governedReviewPolicies:{POL:p}};
}
let checks=0;function run(input,status){const o=c.evaluateGovernedIncomeAssetIntelligence(input);assert.equal(o.status,status,JSON.stringify(o.blockers));for(const k of ['sourceAuthenticityIndependentlyVerified','tenantStrengthAutomaticallyScored','noiForecastGenerated','automaticUnderwritingAdoption','transactionAuthorized','productionAuthorityGranted'])assert.equal(o[k],false);if(status!==READY)assert.equal(o.metrics,null);checks++;return o;}
const valid=fixture(),ok=run(valid,READY);
assert.equal(ok.metrics.occupancyRatio,0.6);assert.equal(ok.metrics.vacantAreaSqm,40);assert.equal(ok.metrics.annualContractRentSar,1000);assert.equal(ok.metrics.topTenantRentShare,0.6);assert.equal(ok.metrics.topThreeTenantRentShare,1);assert.equal(ok.metrics.tenantRentHhi,0.52);assert.equal(ok.expiryConcentration[0].expiringAnnualRentSar,600);assert.equal(ok.riskFlags.length,4);
assert.deepEqual(run(JSON.parse(JSON.stringify(valid)),READY),ok);
run({...valid,leaseRecords:[]},S.HOLD_UPSTREAM_EVIDENCE);
run({...valid,leaseRecords:[...valid.leaseRecords].reverse()},S.HOLD_INTEGRITY);
run({...valid,leaseRecords:[{...valid.leaseRecords[0],areaSqm:41},valid.leaseRecords[1]]},S.HOLD_INTEGRITY);
run({...valid,rentRollSnapshot:{...valid.rentRollSnapshot,occupiedAreaSqm:70}},S.HOLD_INTEGRITY);
run(fixture(undefined,[assessment()]),S.HOLD_TENANT_EVIDENCE);
run(fixture(undefined,[assessment(),assessment('B',{validUntil:past})]),S.HOLD_TENANT_EVIDENCE);
run(fixture(undefined,[assessment(),assessment('B'),assessment('C')]),S.HOLD_TENANT_EVIDENCE);
run(fixture(undefined,[assessment(),assessment('B',{propertyRef:'OTHER'})]),S.HOLD_TENANT_EVIDENCE);
run(fixture(undefined,[assessment(),assessment('B',{assessedAt:'2026-09-11T00:00:00Z'})]),S.HOLD_TENANT_EVIDENCE);
run(fixture(undefined,undefined,{reviewedAt:'2026-09-11T00:00:00Z'}),S.HOLD_POLICY);
run(fixture(undefined,undefined,{reviewedAt:'2026-09-08T00:00:00Z'}),S.HOLD_POLICY);
run(fixture(undefined,undefined,{expiryConcentrationRules:[{horizonMonths:1201,maximumRentShare:0.5}]}),S.HOLD_POLICY);
run(fixture(undefined,undefined,{tenantAssessmentBindings:[]}),S.HOLD_INTEGRITY);
run({...valid,reviewPolicyId:'MISSING'},S.HOLD_POLICY);
run(fixture(undefined,undefined,{}, {verification:{...verification,verifiedAt:'2026-09-11T00:00:00Z'}}),S.HOLD_INTEGRITY);
run(fixture([lease('A',{sourceClass:'CLIENT_PROVIDED'}),valid.leaseRecords[1]]),S.HOLD_INTEGRITY);
run(fixture([lease('A',{unitRef:'U-B'}),valid.leaseRecords[1]]),S.HOLD_UPSTREAM_EVIDENCE);
const changed={...assessment(),financialThresholdsInferred:true};changed.assessmentHashSha256=c.computeTenantStrengthAssessmentHash(changed);run(fixture(undefined,[changed,assessment('B')]),S.HOLD_TENANT_EVIDENCE);
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const forged={...valid.incomeEvidencePacket,annualContractRentSar:999};delete forged.incomeEvidencePacketHashSha256;forged.incomeEvidencePacketHashSha256=crypto.createHash('sha256').update(JSON.stringify(stable(forged))).digest('hex');run({...valid,incomeEvidencePacket:forged},S.HOLD_INTEGRITY);
let reads=0;run(Object.defineProperty({...valid},'leaseRecords',{enumerable:true,get(){reads++;return valid.leaseRecords;}}),S.HOLD_INTEGRITY);assert.equal(reads,0);
run(null,S.HOLD_INTEGRITY);
assert.throws(()=>c.createGovernedTenantStrengthAssessment(Object.defineProperty({},'tenantRef',{enumerable:true,get(){reads++;return 'X';}})),/C11_INPUT_JSON_INVALID/);assert.equal(reads,0);
console.log('C11_HISTORICAL_INCOME_ASSET_RECOVERY=PASS cases='+checks+' synthetic=true financialAuthority=false');

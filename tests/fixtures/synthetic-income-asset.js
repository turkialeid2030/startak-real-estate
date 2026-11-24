'use strict';
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
module.exports={args,caseId,propertyRef,asOfDate,leaseRecords,rentRollSnapshot,incomeEvidencePacket,tenantStrengthAssessments,assessment,makeLease,verification,evaluate,S};

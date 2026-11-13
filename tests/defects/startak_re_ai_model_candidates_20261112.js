'use strict';
const assert=require('node:assert/strict');
const {CANDIDATES,TASK,DATA_CLASS,listResearchCandidates,assessActivation}=require('../../src/ai/real-estate-model-candidates');
assert(CANDIDATES.length>=10);
assert(CANDIDATES.some(m=>m.id==='gpt-6-luna'&&m.tasks.includes(TASK.BOUNDED_HIGH_VOLUME_CLASSIFICATION)));
assert(CANDIDATES.some(m=>m.id==='claude-fable-5-2'&&m.tasks.includes(TASK.FINANCIAL_CHALLENGE)));
const fable=CANDIDATES.find(m=>m.id==='claude-fable-5-2');
assert.equal(fable.documentedModelReleaseDate,'2026-11-09');
assert.equal(fable.zeroDataRetentionNotAvailableByDefault,true);
assert.equal(fable.minimumDocumentedRetentionDays,30);
assert.equal(new Set(CANDIDATES.map(x=>x.id)).size,CANDIDATES.length);
assert(CANDIDATES.every(x=>x.sourceUrl.startsWith('https://')&&x.productionEnabled===false));
assert(CANDIDATES.every(x=>x.saudiInferenceResidencyVerified===false && x.benchmarkQualified===false));
assert(listResearchCandidates(TASK.FINANCIAL_CHALLENGE).some(x=>x.id==='gpt-6-astra'));
assert(listResearchCandidates(TASK.EVIDENCE_AND_DOCUMENT_REVIEW).some(x=>x.id==='claude-opus-5-5'));
assert.deepEqual(listResearchCandidates('UNDEFINED_TASK'),[]);
for(const m of CANDIDATES){
 const result=assessActivation({
  modelId:m.id,task:m.tasks[0],dataClass:DATA_CLASS.PUBLIC_SYNTHETIC,
  verifiedRights:true,independentEvaluatorApproved:true,
  contractualNoTraining:true,regionEvidenceVerified:true,
  piiDlpApproved:true,ownerApproved:true
 });
 assert.equal(result.status,'HOLD_NOT_AUTHORIZED');
 assert.equal(result.externalProviderCallAuthorized,false);
 assert.equal(result.transactionAuthority,false);
 assert(result.blockerCodes.includes('PRODUCTION_PROVIDER_ACTIVATION_OUTSIDE_CATALOG_SCOPE'));
}
const regulated=assessActivation({modelId:'gpt-6.1-sol',task:TASK.FINANCIAL_CHALLENGE,dataClass:DATA_CLASS.PERSONAL_OR_REGULATED});
assert(regulated.blockerCodes.includes('DLP_AND_PRIVACY_NOT_APPROVED'));
assert(regulated.blockerCodes.includes('PROCESSING_REGION_NOT_VERIFIED'));
const forged=assessActivation({modelId:'invented-unlisted-model',task:TASK.FINANCIAL_CHALLENGE,dataClass:DATA_CLASS.PUBLIC_SYNTHETIC});
assert(forged.blockerCodes.includes('MODEL_ID_NOT_IN_VERIFIED_CANDIDATE_CATALOG'));
const preview=assessActivation({modelId:'gemini-3.1-pro-preview',task:TASK.FINANCIAL_CHALLENGE,dataClass:DATA_CLASS.PUBLIC_SYNTHETIC});
assert(preview.blockerCodes.includes('PREVIEW_MODEL_NOT_STABLE_FOR_PRODUCTION'));
const fableZeroRetention=assessActivation({
 modelId:'claude-fable-5-2',task:TASK.FINANCIAL_CHALLENGE,
 dataClass:DATA_CLASS.PERSONAL_OR_REGULATED,
 verifiedRights:true,independentEvaluatorApproved:true,contractualNoTraining:true,
 regionEvidenceVerified:true,piiDlpApproved:true,ownerApproved:true
});
assert(fableZeroRetention.blockerCodes.includes('ZERO_DATA_RETENTION_UNAVAILABLE_WITHOUT_VENDOR_EXCEPTION'));
assert.equal(fableZeroRetention.externalProviderCallAuthorized,false);
const fableWithEvidence=assessActivation({
 modelId:'claude-fable-5-2',task:TASK.FINANCIAL_CHALLENGE,
 dataClass:DATA_CLASS.PUBLIC_SYNTHETIC,
 verifiedRights:true,independentEvaluatorApproved:true,contractualNoTraining:true,
 regionEvidenceVerified:true,piiDlpApproved:true,ownerApproved:true,
 vendorRetentionExceptionVerified:true
});
assert.equal(fableWithEvidence.externalProviderCallAuthorized,false);
assert.equal(fableWithEvidence.status,'HOLD_NOT_AUTHORIZED');
assert(fableWithEvidence.blockerCodes.includes('PRODUCTION_PROVIDER_ACTIVATION_OUTSIDE_CATALOG_SCOPE'));
console.log('STARTAK_RE_AI_MODEL_CANDIDATES_HOLD=PASS');

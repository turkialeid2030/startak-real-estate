'use strict';
// STARTAK REAL ESTATE ONLY. Research candidates, not a live-provider router.
const POLICY_VERSION = 'STARTAK_RE_AI_CANDIDATES_20261112_V1';
const PROVIDER = Object.freeze({OPENAI:'OPENAI',ANTHROPIC:'ANTHROPIC',GOOGLE:'GOOGLE'});
const TASK = Object.freeze({
  FINANCIAL_CHALLENGE:'FINANCIAL_CHALLENGE',
  EVIDENCE_AND_DOCUMENT_REVIEW:'EVIDENCE_AND_DOCUMENT_REVIEW',
  SOURCE_SUMMARIZATION:'SOURCE_SUMMARIZATION',
  BOUNDED_HIGH_VOLUME_CLASSIFICATION:'BOUNDED_HIGH_VOLUME_CLASSIFICATION'
});
const DATA_CLASS = Object.freeze({
  PUBLIC_SYNTHETIC:'PUBLIC_SYNTHETIC',
  INTERNAL_CONFIDENTIAL:'INTERNAL_CONFIDENTIAL',
  PERSONAL_OR_REGULATED:'PERSONAL_OR_REGULATED'
});
const source = Object.freeze({
  OPENAI:'https://developers.openai.com/api/docs/models',
  ANTHROPIC:'https://platform.claude.com/docs/en/models/overview',
  GOOGLE:'https://ai.google.dev/gemini-api/docs/models'
});
const entry=(id,provider,tasks,sourceUrl,preview=false)=>Object.freeze({
 id,provider,tasks:Object.freeze(tasks),sourceUrl,preview,
 modelExistenceVerifiedInPublicDocs:true,
 customerAccountAvailabilityVerified:false,
 saudiInferenceResidencyVerified:false,
 trainingAndRetentionContractVerified:false,
 permittedProcessingRegionVerified:false,
 benchmarkQualified:false,
 productionEnabled:false
});
const CANDIDATES=Object.freeze([
 entry('gpt-6-astra',PROVIDER.OPENAI,[TASK.FINANCIAL_CHALLENGE,TASK.EVIDENCE_AND_DOCUMENT_REVIEW],source.OPENAI),
 entry('gpt-6.1-sol',PROVIDER.OPENAI,[TASK.FINANCIAL_CHALLENGE,TASK.SOURCE_SUMMARIZATION],source.OPENAI),
 entry('gpt-6.1-terra',PROVIDER.OPENAI,[TASK.EVIDENCE_AND_DOCUMENT_REVIEW,TASK.SOURCE_SUMMARIZATION],source.OPENAI),
 entry('claude-opus-5-5',PROVIDER.ANTHROPIC,[TASK.FINANCIAL_CHALLENGE,TASK.EVIDENCE_AND_DOCUMENT_REVIEW],source.ANTHROPIC),
 entry('claude-sonnet-5-5',PROVIDER.ANTHROPIC,[TASK.EVIDENCE_AND_DOCUMENT_REVIEW,TASK.SOURCE_SUMMARIZATION],source.ANTHROPIC),
 entry('claude-haiku-5-5',PROVIDER.ANTHROPIC,[TASK.BOUNDED_HIGH_VOLUME_CLASSIFICATION],source.ANTHROPIC),
 entry('gemini-3.8-flash',PROVIDER.GOOGLE,[TASK.EVIDENCE_AND_DOCUMENT_REVIEW,TASK.BOUNDED_HIGH_VOLUME_CLASSIFICATION],source.GOOGLE),
 entry('gemini-3.1-pro-preview',PROVIDER.GOOGLE,[TASK.FINANCIAL_CHALLENGE],source.GOOGLE,true)
]);
function listResearchCandidates(task){
  if(!Object.values(TASK).includes(task))return Object.freeze([]);
  return Object.freeze(CANDIDATES.filter(m=>m.tasks.includes(task)));
}
function assessActivation({modelId,task,dataClass,verifiedRights=false,
 independentEvaluatorApproved=false,contractualNoTraining=false,
 regionEvidenceVerified=false,piiDlpApproved=false,ownerApproved=false}={}){
 const candidate=CANDIDATES.find(m=>m.id===modelId);
 const blockers=[];
 if(!candidate)blockers.push('MODEL_ID_NOT_IN_VERIFIED_CANDIDATE_CATALOG');
 if(!Object.values(TASK).includes(task))blockers.push('TASK_CLASS_UNSUPPORTED');
 if(candidate&&!candidate.tasks.includes(task))blockers.push('MODEL_TASK_NOT_BENCHMARKED');
 if(!Object.values(DATA_CLASS).includes(dataClass))blockers.push('DATA_CLASS_REQUIRED');
 if(!verifiedRights)blockers.push('SOURCE_RIGHTS_NOT_VERIFIED');
 if(!independentEvaluatorApproved)blockers.push('MODEL_BENCHMARK_NOT_INDEPENDENTLY_APPROVED');
 if(!contractualNoTraining)blockers.push('PROVIDER_NO_TRAINING_CONTRACT_NOT_VERIFIED');
 if(!regionEvidenceVerified)blockers.push('PROCESSING_REGION_NOT_VERIFIED');
 if(!piiDlpApproved)blockers.push('DLP_AND_PRIVACY_NOT_APPROVED');
 if(!ownerApproved)blockers.push('OWNER_APPROVAL_NOT_VERIFIED');
 if(candidate?.preview)blockers.push('PREVIEW_MODEL_NOT_STABLE_FOR_PRODUCTION');
 // No production invocation path is activated by this advisory-only catalog.
 blockers.push('PRODUCTION_PROVIDER_ACTIVATION_OUTSIDE_CATALOG_SCOPE');
 return Object.freeze({
  policyVersion:POLICY_VERSION,
  modelId:candidate?.id||null,task:task||null,dataClass:dataClass||null,
  status:'HOLD_NOT_AUTHORIZED',
  externalProviderCallAuthorized:false,
  transactionAuthority:false,valuationCertificateAuthorized:false,
  deterministicEngineRemainsAuthoritative:true,
  blockerCodes:Object.freeze([...new Set(blockers)])
 });
}
module.exports=Object.freeze({POLICY_VERSION,PROVIDER,TASK,DATA_CLASS,CANDIDATES,listResearchCandidates,assessActivation});

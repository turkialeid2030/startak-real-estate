'use strict';
// C56 / AI production / C73.3 readiness dashboard: never confuses a submitted
// assertion or a synthetically passing cohort with independently audited facts.
// Browser-safe: inject server-only cohort evaluator; never bundle node:crypto into React.
const VERSION='THREE_EXTERNAL_QUALIFICATION_GATES_V1';
const STATUS=Object.freeze({HOLD:'HOLD',EXTERNAL_REVIEW_REQUIRED:'EXTERNAL_REVIEW_REQUIRED'});
const REQUIRED=Object.freeze({
 market:Object.freeze([
  'executedTransactionsOriginalEvidence','sourceDisplayAndReuseRights',
  'sealedProtocolTimestampProof','independentAssetIdentityReview',
  'independentCohortReview','qualifiedValuerReview',
 ]),
 ai:Object.freeze([
  'liveProviderRoundTrip','providerModelAndRequestReceipt',
  'actualCredentialAndEnvironmentAuthorization','privacyAndPromptIsolationReview',
  'quotaCostAndTimeoutTelemetry','rateLimitAndAbuseTest',
  'auditIntegrityAndRetentionTest','promptInjectionAndNumericHallucinationTest',
  'fallbackAndIncidentExercise','independentOperatorReview',
 ]),
 compliance:Object.freeze([
  'independentIdentityAndRolePenTest','saudiCloudAndCustodyArchitectureReview',
  'encryptedVaultAndKeyRotationEvidence','malwareAndContentScanningEvidence',
  'tenantIsolationAndRevocationExercise','pdplControllerProcessorLegalReview',
  'transborderAndRetentionLegalReview','officialSourceUsageRights',
  'licensedRealEstateValuerApproval','independentArabicReportReview',
  'accessibleHumanUatAndDisasterRecovery','authorizedBoardProductionDecision',
 ]),
});
const labels=Object.freeze({
 market:'دقة التقييم في الصفقات السعودية الحقيقية',
 ai:'تشغيل الذكاء الاصطناعي الفعلي والضوابط',
 compliance:'الاعتماد المهني والأمني والنظامي',
});
function validExternalRef(v){
 return typeof v==='string'&&v.length>=12&&v.length<=512&&v.trim()===v&&
  !/[\r\n\u0000-\u001f<>]/.test(v)&&!/(?:token|password|secret|apikey)\s*[:=]/i.test(v);
}
function output(field,reasonCodes,extra={}){
 const reasons=[...new Set(reasonCodes)];
 const dossier=Object.freeze({
  name:field,labelAr:labels[field],
  status:reasons.length?STATUS.HOLD:STATUS.EXTERNAL_REVIEW_REQUIRED,
  reasonCodes:Object.freeze(reasons), ...extra,
  externalEvidenceIndependentlyAuthenticated:false,
  professionalOrRegulatoryApproved:false,transactionAuthorized:false,
  productionAuthorized:false,
 });
 return dossier;
}
function evidenceGapCodes(field,packet){
 return REQUIRED[field].filter(id=>!validExternalRef(packet?.evidenceRefs?.[id]))
  .map(id=>'EVIDENCE_REQUIRED_'+id.toUpperCase());
}
function evaluateExternalQualification({market=null,ai=null,compliance=null,evaluateHoldout=null}={}){
 const marketCodes=evidenceGapCodes('market',market);
 let actualCohort=null;
 if(!market?.protocol||!Array.isArray(market?.observations)||market.observations.length===0){
  marketCodes.push('SEALED_REAL_SAUDI_HOLDOUT_NOT_PROVIDED');
 }else if(typeof evaluateHoldout==='function'){
  try{
   actualCohort=evaluateHoldout({protocol:market.protocol,observations:market.observations});
   if(!actualCohort||typeof actualCohort!=='object'||typeof actualCohort.status!=='string')
    throw new Error('INVALID_COHORT_RESULT');
   if(actualCohort.status!=='CALCULATED_WITHIN_REGISTERED_THRESHOLDS')
    marketCodes.push('PRE_REGISTERED_HOLDOUT_'+actualCohort.status);
   else marketCodes.push('COHORT_MATH_IS_NOT_EXTERNAL_SOURCE_AUTHENTICATION');
  }catch(_){marketCodes.push('COHORT_EVALUATION_INVALID');}
 }else marketCodes.push('SERVER_SIDE_HOLDOUT_VALIDATOR_REQUIRED');
 const marketGate=output('market',marketCodes,{
  sampleMetricsWithinProtocol:actualCohort?.sampleMetricsWithinProtocol===true,
  observedSampleSize:Array.isArray(market?.observations)?market.observations.length:0,
  cohortStatus:actualCohort?.status??null,
  protocolDigestSha256:actualCohort?.protocolDigestSha256??null,
  metrics:actualCohort?.metrics??null,
 });
 const aiCodes=evidenceGapCodes('ai',ai);
 if(ai?.providerRoundTripStatus!=='SUCCESS'||ai?.aiModelUsed!==true||
    ai?.advisoryOnly!==true||ai?.deterministicScoreRemainsAuthoritative!==true){
  aiCodes.push('ACTUAL_PRODUCTION_AI_RESPONSE_NOT_INDEPENDENTLY_REPLAYED');
 }
 if(ai?.productionRequestAuthorized!==true)aiCodes.push('PRODUCTION_MODEL_ACCESS_NOT_APPROVED');
 if(ai?.scopedPrivacyAndIsolationTestPassed!==true)aiCodes.push('AI_PRIVACY_AND_SCOPE_HOLD');
 const aiGate=output('ai',aiCodes,{
  liveProviderInvocationProven:false,independentModelEvaluationPassed:false,
  numericMarketPriceAuthority:false,
 });
 const complianceCodes=evidenceGapCodes('compliance',compliance);
 if(compliance?.signedIndependentAuditPacket!==true)
  complianceCodes.push('INDEPENDENT_SIGNED_AUDIT_PACKET_NOT_VERIFIED');
 if(compliance?.legalReviewSigned!==true)complianceCodes.push('PDPL_AND_LICENSING_LEGAL_REVIEW_HOLD');
 const complianceGate=output('compliance',complianceCodes,{
  licensedReportIssuanceAuthorized:false,realCustomerDataStorageAuthorized:false,
 });
 const gates=Object.freeze({market:marketGate,ai:aiGate,compliance:complianceGate});
 return Object.freeze({
  version:VERSION,status:STATUS.HOLD,gates,
  evidenceGaps:gates.market.reasonCodes.length+gates.ai.reasonCodes.length+
    gates.compliance.reasonCodes.length,
  completedExternalIndependentApprovals:0,
  independentMarketAccuracyCertified:false,
  productionAiAuthorized:false,professionalReportsAuthorized:false,
  userIdentityAndTenantVaultAuthorized:false,
  certifiedValuationEstablished:false,commercialGoLiveAuthorized:false,
  transactionAuthorized:false,
  semantics:'Three distinct submitted evidence packets are not authentic proof. Independent source-rights, live model, Saudi PDPL, licensed valuation, security and human approvals must be verified outside this unauthenticated research UI. A passing cohort math result never enables professional, commercial or financial authority.',
 });
}
module.exports={VERSION,STATUS,REQUIRED,validExternalRef,evaluateExternalQualification};

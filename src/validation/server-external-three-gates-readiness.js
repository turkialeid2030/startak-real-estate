'use strict';
// SERVER-ONLY: Node SHA256/reviewer signature never enter React/browser bundle.
// C56 external evidence refs cannot prove time-forward preregistration. A
// separate operator-pinned reviewer public key is required for that claim.
const {evaluateTimeForwardHoldout,STATUS}=require('./time-forward-valuation-holdout');
const {verifyIndependentPreRegistration}=require('./independent-pre-registration-witness');
const {evaluateExternalQualification}=require('../governance/external-three-gates-readiness');
function evaluateServerExternalQualification(args={},operatorConfig={}){
 const evaluateHoldout=({protocol,observations})=>{
  const result=evaluateTimeForwardHoldout({protocol,observations});
  // Preserve existing authoritative format/numeric errors, rather than
  // disguising malformed candidate files as a signature failure.
  if(result.status===STATUS.HOLD_PROTOCOL)return result;
  const witness=verifyIndependentPreRegistration({
   protocol,witness:args?.market?.preRegistrationWitness,
   operatorTrust:operatorConfig.pinnedIndependentReviewer,
  });
  if(!witness.signatureCryptographicallyVerified){
   return {status:'HOLD_INDEPENDENT_PROTOCOL_SEAL',
    reasons:witness.reasonCodes,metrics:null,sliceMetrics:[],
    sampleMetricsWithinProtocol:false,protocolDigestSha256:null,
    independentMarketEvidenceVerified:false,sourceRightsVerified:false,
    licensedValuerApproved:false,productionDecisionAuthorized:false};
  }
  // Crypto validity is only one prerequisite. Numeric diagnostics remain
  // non-authoritative until original executed transactions and rights are
  // independently authenticated by a qualified reviewer.
  return result;
 };
 return evaluateExternalQualification({...args,evaluateHoldout});
}
module.exports={evaluateServerExternalQualification};

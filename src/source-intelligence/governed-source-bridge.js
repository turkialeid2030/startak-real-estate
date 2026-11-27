'use strict';
// Structural bridge only. No network retrieval or independent rights verification.
const crypto=require('node:crypto');
const {isPlainJson}=require('../validation/plain-json-boundary');
const {strictCalendarDateMs}=require('../validation/strict-calendar-instant');
const {evaluateSourceOperationalReadiness}=require('./governed-source-operational-readiness');
const {evaluateSourceProvenanceBundle,hashValue}=require('./source-provenance-governance');
const {getCanonicalSourceProvider}=require('./source-provider-registry');
const REF=/^[A-Za-z0-9_.:-]{2,128}$/;
const validRef=x=>typeof x==='string'&&REF.test(x);
function evaluateGovernedSourceBridge({artifactBytes,acquisitionRecord,operationalRecord,provenanceRecord,caseId,scopeRef,asOf,trustedRightsVerifierIds=[],trustedProvenanceVerifierIds=[],trustedLicenseVerifierIds=[]}={}){
 const hold=reason=>Object.freeze({status:'HOLD_SOURCE_BRIDGE',reason,preproductionClassificationReady:false,classification:null,sourceAuthenticityIndependentlyVerified:false,sourceRightsIndependentlyAuthenticated:false,productionUseAuthorized:false,decisionReady:false});
 try{
  if(!validRef(caseId)||!validRef(scopeRef)||!Number.isFinite(strictCalendarDateMs(asOf))||strictCalendarDateMs(asOf)>Date.now()||!Buffer.isBuffer(artifactBytes)||!artifactBytes.length||artifactBytes.length>15*1024*1024||![acquisitionRecord,operationalRecord,provenanceRecord].every(x=>x&&isPlainJson(x)))return hold('SOURCE_BRIDGE_INPUT_INVALID');
  const a=acquisitionRecord,o=operationalRecord,p=provenanceRecord;
  const artifactHashSha256=crypto.createHash('sha256').update(artifactBytes).digest('hex');
  if(artifactHashSha256!==a.artifactHashSha256||artifactHashSha256!==o.artifactHashSha256)return hold('SOURCE_BRIDGE_ARTIFACT_MISMATCH');
  const readiness=evaluateSourceOperationalReadiness({asOf,acquisitionRecord:a,operationalRecord:o,trustedRightsVerifierIds});
  if(!readiness.preproductionSourceReady)return hold('SOURCE_BRIDGE_OPERATIONAL_HOLD');
  const provider=getCanonicalSourceProvider(a.sourceProvider);
  const expiry=Math.min(strictCalendarDateMs(o.validUntil),strictCalendarDateMs(o.freshnessValidUntil));
  const review=strictCalendarDateMs(p.provenanceVerifiedAt);
  if(!provider||p.caseId!==caseId||p.scopeRef!==scopeRef||p.sourceProvider!==a.sourceProvider||p.sourceTier!==provider.sourceTier||p.sourceUrl!==a.sourceUrl||p.originalSourceReference!==a.acquisitionId||p.methodologyVersion!==a.extractorVersion||strictCalendarDateMs(p.retrievedAt)!==strictCalendarDateMs(a.retrievedAt)||!a.sourceEffectiveAt||strictCalendarDateMs(p.effectiveAt)!==strictCalendarDateMs(a.sourceEffectiveAt)||!Number.isFinite(expiry)||!Number.isFinite(strictCalendarDateMs(p.validUntil))||strictCalendarDateMs(p.validUntil)>expiry||p.provenanceVerified!==true||!Number.isFinite(review)||review<strictCalendarDateMs(o.reviewedAt)||p.provenanceVerificationReference!==a.provenanceVerificationRef)return hold('SOURCE_BRIDGE_PROVENANCE_BINDING_MISMATCH');
  if(!a.provenanceVerificationRef||!p.evidencePayload||hashValue(p.evidencePayload)!==hashValue(a.extractedPayload)||p.evidenceHashSha256!==hashValue(a.extractedPayload))return hold('SOURCE_BRIDGE_PAYLOAD_MISMATCH');
  const classification=evaluateSourceProvenanceBundle({records:[p],asOf,caseId,scopeRef,trustedProvenanceVerifierIds,trustedLicenseVerifierIds});
  if(!classification.provenanceClassificationReady)return hold('SOURCE_BRIDGE_PROVENANCE_HOLD');
  return Object.freeze({status:'PREPRODUCTION_SOURCE_CLASSIFICATION_MATCHED',reason:null,preproductionClassificationReady:true,caseId,scopeRef,artifactHashSha256,acquisitionRecordHashSha256:a.acquisitionRecordHashSha256,operationalRecordHashSha256:o.operationalRecordHashSha256,classification,sourceAuthenticityIndependentlyVerified:false,sourceRightsIndependentlyAuthenticated:false,productionUseAuthorized:false,decisionReady:false});
 }catch{return hold('SOURCE_BRIDGE_VERIFICATION_FAILED');}
}
module.exports={evaluateGovernedSourceBridge};

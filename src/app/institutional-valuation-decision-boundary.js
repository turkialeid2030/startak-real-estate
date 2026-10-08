'use strict';

const crypto=require('node:crypto');
const {VALUATION_METHOD}=require('../valuation-intelligence/contracts');
const {METHOD_STATE}=require('../valuation-intelligence/reason-codes');
const {evaluateComparableProvenanceChain}=require('../market/comparable-provenance-chain');
const {assessCostDepreciationAttribution}=require('../cost/depreciation-attribution-gate');
const {assessMarketRateProvenance}=require('../valuation-intelligence/market-rate-provenance');
const {calculateDatedDevelopmentResidual}=require('../engines/valuation/dated-development-residual');
const {evaluateSpecializedAssetEvidence}=require('../specialized-assets/specialist-operational-gate');
const {ASSET_CLASS}=require('../project-model/project-profile');

const VERSION='C62_LIVE_VALUATION_INSTITUTIONAL_EVIDENCE_BOUNDARY_V1';
const STATUS=Object.freeze({HOLD:'HOLD_EXTERNAL_EVIDENCE_AND_DECISION_AUTHORITY'});
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function stable(v){return Array.isArray(v)?v.map(stable):v&&typeof v==='object'?
 Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;}
function sha(v){return crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');}
function getMethodInput(request,method){return request.methodInputs?.[method]||null;}
function check(method,request,claims,assetClass){
 const input=getMethodInput(request,method),pack=claims?.[method];
 if(!input)return {method,status:'NOT_SUBMITTED',blockers:['METHOD_NOT_PROPOSED']};
 if(!pack||typeof pack!=='object'||Array.isArray(pack))
   return {method,status:'HOLD',blockers:['C62_SIGNED_METHOD_EVIDENCE_PACKET_REQUIRED']};
 try{
   let state;
   if(method===VALUATION_METHOD.MARKET_COMPARABLE){
     state=evaluateComparableProvenanceChain({
       ...pack,caseId:request.caseId,basis:input.basis,valuationDate:input.valuationDate,
       comparables:input.comparables,
       subjectAssetType:assetClass,subjectCity:request.projectProfile.jurisdiction?.city,
     });
   }else if(method===VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION){
     state=assessMarketRateProvenance({
       ...pack,assetClass,city:request.projectProfile.jurisdiction?.city,
       valuationDate:input.valuationDate,
       entryCapRate:input.capitalizationRate,
     });
   }else if(method===VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT){
     state=assessCostDepreciationAttribution(pack);
     // Never silently reconcile an unrelated Wave11A packet to this V1 cost input.
     const vals=state;
     if(vals.costApproachValueIndicationSar!==undefined){
       const nominal=Number(input.landValue)+Number(input.directReplacementCost)+
         (Array.isArray(input.indirectCosts)?input.indirectCosts.reduce((n,c)=>n+Number(c.amount),0):0);
       const expected=nominal-(Number(input.directReplacementCost)+
         (Array.isArray(input.indirectCosts)?input.indirectCosts.reduce((n,c)=>n+Number(c.amount),0):0))*input.depreciationRate;
       if(!Number.isFinite(expected)||Math.abs(expected-vals.costApproachValueIndicationSar)>0.01)
         return {method,status:'HOLD',blockers:['C62_C59_COST_ENGINE_VALUE_MISMATCH']};
     }
   }else if(method===VALUATION_METHOD.RESIDUAL){
     state=calculateDatedDevelopmentResidual(pack.packet,pack.discountPolicy);
     // Legacy terminal-discount residual is not interchangeable with C55.
     return {method,status:'HOLD',blockers:['C62_LEGACY_RESIDUAL_TIMING_METHOD_MISMATCH'],
       candidateEngineState:state.status,modelVersion:state.modelVersion||null};
   }else return {method,status:'HOLD',blockers:['C62_METHOD_EXECUTOR_UNSUPPORTED']};
   return {method,status:state.status||'HOLD',blockers:Array.isArray(state.blockers)?[...state.blockers]:[],
     independentAuthenticationEstablished:false,
     artifactHashSha256:state.resultHashSha256||state.ratePackageHashSha256||null};
 }catch(error){
   return {method,status:'HOLD',blockers:['C62_METHOD_EVIDENCE_VALIDATION_ERROR'],
     errorName:error?.name||'Error'};
 }
}
/**
 * Unconditionally called from the live existing-building Valuation V1 runtime.
 * It CANNOT upgrade unverified self-declared source/rights/reviewer metadata,
 * and it never reuses the old READY_FOR_DECISION_CONTROL as public authority.
 * Legacy numerical indications remain separate and unchanged for diagnostics.
 */
function assessInstitutionalValuationDecisionBoundary({request,stage,institutionalEvidence=null}={}){
 if(!request||!stage||!request.projectProfile||!Array.isArray(stage.methods)){
   return freeze({version:VERSION,status:STATUS.HOLD,blockers:['C62_LIVE_RUNTIME_INPUT_REQUIRED'],
     readyForInstitutionalDecision:false,finalValueSar:null,publicValuationReportExportAuthorized:false});
 }
 const classes=request.projectProfile.assetClasses||[];
 const candidateMethods=stage.methods.filter(m=>m.state===METHOD_STATE.AVAILABLE);
 const methodChecks=candidateMethods.map(m=>check(m.method,request,institutionalEvidence,classes[0]));
 const required=classes.some(c=>[ASSET_CLASS.HOSPITALITY,ASSET_CLASS.INDUSTRIAL_LOGISTICS].includes(c));
 let specialist=null;
 if(required){
   if(!institutionalEvidence?.specialist)specialist={status:'HOLD',blockers:['C62_SPECIALIST_EVIDENCE_REQUIRED']};
   else{
     try { specialist=evaluateSpecializedAssetEvidence(institutionalEvidence.specialist);}
     catch {specialist={status:'HOLD',blockers:['C62_SPECIALIST_EVIDENCE_ERROR']};}
   }
 }
 const blockers=['C62_INDEPENDENT_SOURCE_AND_PROFESSIONAL_AUTHORITY_NOT_ESTABLISHED'];
 if(stage.readyForDecisionControl!==true)blockers.push('C62_UNDERLYING_VALUATION_STAGE_NOT_READY');
 if(!candidateMethods.length)blockers.push('C62_NO_AVAILABLE_METHOD');
 for(const row of methodChecks){
   if(row.blockers.length)blockers.push(...row.blockers.map(s=>row.method+':'+s));
   if(row.independentAuthenticationEstablished!==true)blockers.push(row.method+':C62_EXTERNAL_SOURCE_AUTHENTICITY_NOT_PROVEN');
 }
 if(specialist?.status!=='READY_FOR_EXTERNAL_SPECIALIST_REVIEW'&&required)
   blockers.push(...(specialist?.blockers||[]));
 if(specialist&&required)blockers.push('C62_REAL_SPECIALIST_EVIDENCE_NOT_EXTERNALLY_AUTHENTICATED');
 if(!institutionalEvidence||!institutionalEvidence.authoritativeReview ||
   institutionalEvidence.authoritativeReview.approved===true)
   blockers.push('C62_AUTHORITY_CANNOT_BE_SELF_DECLARED');
 const core={
   version:VERSION,status:STATUS.HOLD,
   caseId:request.caseId,projectId:request.projectId,
   arithmeticPreliminaryValueSar:stage.readyForDecisionControl&&Number.isFinite(stage.finalValue)?stage.finalValue:null,
   methodChecks,specialistStatus:specialist?.status||null,
   blockers:[...new Set(blockers)],
   readyForInstitutionalDecision:false,finalValueSar:null,
   realSaudiMarketAccuracyIndependentlyValidated:false,
   independentSourceAuthenticityVerified:false,
   humanAppraisalApprovalEstablished:false,
   publicValuationReportExportAuthorized:false,
   transactionAuthorized:false,
   semantics:'C62 is the live runtime institutional-evidence boundary. Existing V1 calculations remain diagnostic. No self-declared rights, hashes, reviewer references, or old V1 READY state establish independent real transaction authenticity or public/professional investment authority.',
 };
 return freeze({...core,decisionEvidenceHashSha256:sha(core)});
}
function buildInstitutionalValuationReportExport(decision){
 if(!decision||decision.readyForInstitutionalDecision!==true||
   decision.publicValuationReportExportAuthorized!==true){
   const error=new Error('C62_GOVERNED_REPORT_EXPORT_BLOCKED');
   error.code='C62_GOVERNED_REPORT_EXPORT_BLOCKED';throw error;
 }
 // Deliberate negative capability until a separately authorized, audited
 // external verifier/report path exists; no self-declared flags bypass the gate.
 const error=new Error('C62_EXTERNAL_AUTHORIZED_REPORT_PIPELINE_NOT_IMPLEMENTED');
 error.code='C62_EXTERNAL_AUTHORIZED_REPORT_PIPELINE_NOT_IMPLEMENTED';throw error;
}
module.exports={VERSION,STATUS,assessInstitutionalValuationDecisionBoundary,buildInstitutionalValuationReportExport};

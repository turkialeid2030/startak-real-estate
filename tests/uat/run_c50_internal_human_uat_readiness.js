'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {STATUS,EXTERNAL_STATUS,createUatPlan,verifyUatPlan,createExternalUatRecord,verifyExternalUatRecord,evaluateInternalUatReadiness,evaluateExternalUatForGateIngestion}=require('../../src/uat/human-uat-readiness');
const ROOT=path.join(__dirname,'..','..'); const SHA='1234567890abcdef1234567890abcdef12345678'; const AS_OF='2026-10-04T12:00:00.000Z'; let checks=0;
function check(fn){fn();checks++;} function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
const scenarios=[
  {scenarioId:'UAT-DECISION-REVIEW',userRole:'AUTHORIZED_REAL_ESTATE_REVIEWER',expectedOutcomeRef:'EXPECTED-GOVERNED-DECISION-REVIEW'},
  {scenarioId:'UAT-EVIDENCE-GAPS',userRole:'AUTHORIZED_REAL_ESTATE_REVIEWER',expectedOutcomeRef:'EXPECTED-FAIL-CLOSED-EVIDENCE-GAPS'},
  {scenarioId:'UAT-REPORT-EXPORT',userRole:'AUTHORIZED_REAL_ESTATE_REVIEWER',expectedOutcomeRef:'EXPECTED-GOVERNED-REPORT-EXPORT'}
];
function plan(o={}){return createUatPlan({candidateHeadSha:SHA,productScopeRef:'STARTAK-REAL-ESTATE-C50-SCOPE',scenarios,preparedAt:'2026-10-04T08:00:00Z',validUntil:'2026-10-11T08:00:00Z',...o});}
function record(status,o={}){
  const x={evidenceId:'UAT_HUMAN_APPROVAL',candidateHeadSha:SHA,status};
  if(status===EXTERNAL_STATUS.NOT_SUPPLIED) x.reasonCode='AUTHORIZED_HUMAN_UAT_NOT_SUPPLIED';
  else Object.assign(x,{evidenceRef:'STRUCTURAL-TEST-UAT-ARTIFACT',evidenceHashSha256:'a'.repeat(64),verifiedByRef:'STRUCTURAL-TEST-AUTHORIZED-UAT-OWNER',verifiedAt:'2026-10-04T10:00:00Z',validUntil:'2026-10-10T10:00:00Z',reviewers:[{nameRef:'STRUCTURAL-TEST-REVIEWER-1',role:'AUTHORIZED_REAL_ESTATE_REVIEWER'}],scenarioResults:scenarios.map(s=>({scenarioId:s.scenarioId,actualObservationRef:`OBS-${s.scenarioId}`,passed:true})),materialDefectsDispositionRef:'STRUCTURAL-TEST-DEFECT-DISPOSITION',usabilityWorkflowIssuesRef:'STRUCTURAL-TEST-USABILITY-OBSERVATIONS',signOffRef:'STRUCTURAL-TEST-SIGNOFF',unresolvedBlocker:false});
  if(status===EXTERNAL_STATUS.REJECTED)x.reasonCode='HUMAN_UAT_REJECTED'; return createExternalUatRecord({...x,...o});
}
const p=plan(); check(()=>assert(verifyUatPlan(p))); check(()=>assert.strictEqual(p.humanUatApproved,false)); check(()=>assert.strictEqual(p.deploymentAuthorized,false));
const i=evaluateInternalUatReadiness({uatPlan:p,asOf:AS_OF}); check(()=>assert.strictEqual(i.status,STATUS.READY_FOR_INDEPENDENT_HUMAN_UAT)); check(()=>assert.strictEqual(i.internalEngineeringReady,true)); check(()=>assert.strictEqual(i.humanUatApproved,false));
check(()=>assert.throws(()=>plan({candidateHeadSha:'bad'}),/40-character/)); check(()=>assert.throws(()=>plan({scenarios:[]}),/non-empty/)); check(()=>assert.throws(()=>plan({scenarios:[scenarios[0],scenarios[0]]}),/DUPLICATE/));
const stale=plan({validUntil:'2026-10-04T09:00:00Z'}); check(()=>assert.strictEqual(evaluateInternalUatReadiness({uatPlan:stale,asOf:AS_OF}).status,STATUS.HOLD_WINDOW));
const tampered={...p,productScopeRef:'TAMPERED'}; check(()=>assert.strictEqual(evaluateInternalUatReadiness({uatPlan:tampered,asOf:AS_OF}).status,STATUS.HOLD_INTEGRITY));
const ns=record(EXTERNAL_STATUS.NOT_SUPPLIED); check(()=>assert(verifyExternalUatRecord(ns))); const nr=evaluateExternalUatForGateIngestion({uatPlan:p,uatRecord:ns,asOf:AS_OF}); check(()=>assert.strictEqual(nr.status,STATUS.HOLD_EXTERNAL_HUMAN_UAT)); check(()=>assert.strictEqual(nr.readyForC30GateIngestion,false)); check(()=>assert.strictEqual(nr.humanUatApproved,false));
check(()=>assert.throws(()=>record(EXTERNAL_STATUS.NOT_SUPPLIED,{evidenceRef:'FAKE'}),/MUST_NOT_CARRY/));
const supplied=record(EXTERNAL_STATUS.SUPPLIED_VERIFIED); check(()=>assert(verifyExternalUatRecord(supplied))); const sr=evaluateExternalUatForGateIngestion({uatPlan:p,uatRecord:supplied,asOf:AS_OF}); check(()=>assert.strictEqual(sr.status,STATUS.READY_FOR_C30_GATE_INGESTION)); check(()=>assert.strictEqual(sr.readyForC30GateIngestion,true)); check(()=>assert.strictEqual(sr.independentAuthorityStillMustBeValidatedByC30,true)); check(()=>assert.strictEqual(sr.humanUatApproved,false)); check(()=>assert.strictEqual(sr.deploymentAuthorized,false)); check(()=>assert.strictEqual(sr.commercialGoLiveAuthorized,false));
const partial=record(EXTERNAL_STATUS.SUPPLIED_VERIFIED,{scenarioResults:[{scenarioId:scenarios[0].scenarioId,actualObservationRef:'OBS',passed:true}]}); const pr=evaluateExternalUatForGateIngestion({uatPlan:p,uatRecord:partial,asOf:AS_OF}); check(()=>assert(pr.blockers.includes('C50_EXTERNAL_SCENARIO_COVERAGE_MISMATCH'))); check(()=>assert.strictEqual(pr.readyForC30GateIngestion,false));
const failed=record(EXTERNAL_STATUS.SUPPLIED_VERIFIED,{scenarioResults:scenarios.map((s,n)=>({scenarioId:s.scenarioId,actualObservationRef:`OBS-${n}`,passed:n!==0}))}); const fr=evaluateExternalUatForGateIngestion({uatPlan:p,uatRecord:failed,asOf:AS_OF}); check(()=>assert(fr.blockers.includes('C50_EXTERNAL_SCENARIO_FAILURE_PRESENT'))); check(()=>assert.strictEqual(fr.readyForC30GateIngestion,false));
check(()=>assert.throws(()=>record(EXTERNAL_STATUS.SUPPLIED_VERIFIED,{unresolvedBlocker:true}),/UNRESOLVED_BLOCKER/));
const rejected=record(EXTERNAL_STATUS.REJECTED); const rr=evaluateExternalUatForGateIngestion({uatPlan:p,uatRecord:rejected,asOf:AS_OF}); check(()=>assert.strictEqual(rr.status,STATUS.REJECTED)); check(()=>assert.strictEqual(rr.humanUatApproved,false));
const mismatch=record(EXTERNAL_STATUS.SUPPLIED_VERIFIED,{candidateHeadSha:'abcdefabcdefabcdefabcdefabcdefabcdefabcd'}); const mr=evaluateExternalUatForGateIngestion({uatPlan:p,uatRecord:mismatch,asOf:AS_OF}); check(()=>assert(mr.blockers.includes('C50_EXTERNAL_BINDING_MISMATCH:candidateHeadSha')));
const evidence=JSON.parse(read('release/evidence/c50-internal-human-uat-readiness.json')); ['humanUatApprovalSupplied','gate549Satisfied','humanUatApproved','deploymentAuthorized','commercialGoLiveAuthorized'].forEach(f=>check(()=>assert.strictEqual(evidence[f],false)));
const docs=read('docs/C50_INTERNAL_HUMAN_UAT_READINESS.md'); check(()=>assert(docs.includes('Playwright/Chromium is not human UAT'))); check(()=>assert(docs.includes('does not satisfy external gate #549'))); check(()=>assert(docs.includes('C30 remains HOLD')));
const workflow=read('.github/workflows/c50-internal-human-uat-readiness.yml'); const immutable=/^\s*-?\s*uses:\s*[^\s@]+@[a-f0-9]{40}\s*$/i; workflow.split(/\r?\n/).filter(l=>/^\s*-?\s*uses:/.test(l)).forEach(l=>check(()=>assert(immutable.test(l)))); check(()=>assert(workflow.includes('C50_GATE_549_SATISFIED=FALSE'))); check(()=>assert(workflow.includes('C50_HUMAN_UAT_APPROVED=FALSE')));
console.log(`C50_INTERNAL_HUMAN_UAT_READINESS=PASS checks=${checks}`); console.log('C50_READY_FOR_INDEPENDENT_HUMAN_UAT=PASS'); console.log('C50_GATE_549_SATISFIED=FALSE'); console.log('C50_HUMAN_UAT_APPROVED=FALSE'); console.log('C50_DEPLOYMENT_AUTHORIZED=FALSE'); console.log('C50_COMMERCIAL_GO_LIVE_AUTHORIZED=FALSE');

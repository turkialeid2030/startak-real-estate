'use strict';
const assert=require('node:assert/strict');
const {FRESHNESS_STATUS,evaluateDataFreshness,assertMaterialMarketIndicatorSource}=
 require('../../src/decision-governance/data-freshness');
const {evaluateValuationEvidenceFreshness}=require('../../src/decision-governance/valuation-data-freshness');
const {evaluateGovernedValuationReportReadiness,buildGovernedValuationReport}=
 require('../../src/decision-governance/valuation-report-export');
const {buildGuidedUiStatus}=require('../../src/decision-governance/guided-ui-status');
const at='2026-11-12T09:00:00.000Z';
const runtime=Object.freeze({
 caseId:'SYNTHETIC-CASE-RE',mode:'building',projectId:'SYNTHETIC-ORG',
 stage:{status:'REVIEW_REQUIRED',readyForDecisionControl:false,
   evidenceGaps:[],humanDecisionRequired:true,reasonCodes:['NON_AUTHORIZING_TEST']}
});
const evidence=(date)=>({
 caseId:'SYNTHETIC-CASE-RE',
 projectId:'SYNTHETIC-ORG',
 evidence:{saleComparable:{
  sourceType:'SYNTHETIC_EXECUTED_SALE_PROVENANCE',
  sourceRef:'SYNTHETIC_SOURCE_NOT_EXTERNAL_AUTHENTICATION',
  observedAt:date,grade:'B',status:'VERIFIED'
 }}
});
const valid=evidence('2026-11-09T10:00:00.000Z');
const current=evaluateValuationEvidenceFreshness(valid,{asOf:at});
assert.equal(current.status,FRESHNESS_STATUS.CURRENT);
assert.equal(current.evidenceCount,1);
assert.equal(current.allMaterialSourcesDated,true);
assert.equal(evaluateGovernedValuationReportReadiness({runtime,valuationCase:valid,asOf:at}).ready,true);
const out=buildGovernedValuationReport({runtime,valuationCase:valid,generatedAt:at});
assert.equal(out.formalValuationAuthority,false);
assert.equal(out.transactionAuthority,'ANALYSIS_ONLY');
assert(out.localAuditEvent);
const flow=buildGuidedUiStatus({runtime,valuationCase:valid,financialResultPresent:true});
assert.equal(flow.buyRejectDecisionAllowed,false);
const stale=evidence('2026-01-05T10:00:00.000Z');
assert.equal(evaluateValuationEvidenceFreshness(stale,{asOf:at}).status,FRESHNESS_STATUS.STALE);
assert.equal(evaluateGovernedValuationReportReadiness({runtime,valuationCase:stale,asOf:at}).reasonCode,'REPORT_STALE_MARKET_SOURCE');
assert.throws(()=>buildGovernedValuationReport({runtime,valuationCase:stale,generatedAt:at}),
 e=>e&&e.code==='REPORT_STALE_MARKET_SOURCE');
const future=evidence('2026-12-09T10:00:00.000Z');
assert.equal(evaluateValuationEvidenceFreshness(future,{asOf:at}).status,FRESHNESS_STATUS.UNKNOWN);
assert.equal(evaluateGovernedValuationReportReadiness({runtime,valuationCase:future,asOf:at}).reasonCode,'REPORT_SOURCE_DATE_UNVERIFIED_OR_FUTURE');
assert.throws(()=>buildGovernedValuationReport({runtime,valuationCase:future,generatedAt:at}),
 e=>e&&e.code==='REPORT_SOURCE_DATE_UNVERIFIED_OR_FUTURE');
const noDate=evidence(null);
assert.equal(evaluateGovernedValuationReportReadiness({runtime,valuationCase:noDate,asOf:at}).ready,false);
const noEvidence={caseId:'SYNTHETIC-CASE-RE',evidence:{}};
assert.equal(evaluateGovernedValuationReportReadiness({runtime,valuationCase:noEvidence,asOf:at}).reasonCode,'VALUATION_EVIDENCE_REQUIRED');
assert.equal(evaluateGovernedValuationReportReadiness({runtime:null,valuationCase:valid,asOf:at}).reasonCode,'VALUATION_RUNTIME_REQUIRED');
// Cross-property or cross-tenant reuse of perfectly dated, "VERIFIED" records
// is still invalid and cannot create an apparently source-backed report.
const changedCase={...valid,caseId:'ANOTHER-CASE'};
assert.equal(evaluateGovernedValuationReportReadiness({runtime,valuationCase:changedCase,asOf:at}).reasonCode,
 'REPORT_CASE_BINDING_MISMATCH');
assert.throws(()=>buildGovernedValuationReport({runtime,valuationCase:changedCase,generatedAt:at}),
 e=>e?.code==='REPORT_CASE_BINDING_MISMATCH');
const changedProject={...valid,projectId:'ANOTHER-TENANT'};
assert.equal(evaluateGovernedValuationReportReadiness({runtime,valuationCase:changedProject,asOf:at}).reasonCode,
 'REPORT_PROJECT_BINDING_MISMATCH');
assert.throws(()=>buildGovernedValuationReport({runtime,valuationCase:changedProject,generatedAt:at}),
 e=>e?.code==='REPORT_PROJECT_BINDING_MISMATCH');
assert.equal(evaluateGovernedValuationReportReadiness({
 runtime,valuationCase:{...valid,caseId:''},asOf:at
}).reasonCode,'REPORT_CASE_BINDING_REQUIRED');
assert.equal(evaluateGovernedValuationReportReadiness({
 runtime,valuationCase:{...valid,projectId:undefined},asOf:at
}).reasonCode,'REPORT_PROJECT_BINDING_REQUIRED');
const replaceSource=(changes)=>({...valid,evidence:{
 saleComparable:{...valid.evidence.saleComparable,...changes}
}});
assert.equal(evaluateGovernedValuationReportReadiness({
 runtime,valuationCase:replaceSource({sourceType:''}),asOf:at
}).reasonCode,'REPORT_EVIDENCE_SOURCE_PROVENANCE_REQUIRED');
assert.equal(evaluateGovernedValuationReportReadiness({
 runtime,valuationCase:replaceSource({sourceRef:'  '}),asOf:at
}).reasonCode,'REPORT_EVIDENCE_SOURCE_PROVENANCE_REQUIRED');
assert.equal(evaluateGovernedValuationReportReadiness({
 runtime,valuationCase:replaceSource({status:'UNVERIFIED'}),asOf:at
}).reasonCode,'REPORT_EVIDENCE_STATUS_NOT_VERIFIED');
assert.equal(evaluateGovernedValuationReportReadiness({
 runtime,valuationCase:replaceSource({status:'VERIFIED_BY_USER_ONLY'}),asOf:at
}).reasonCode,'REPORT_EVIDENCE_STATUS_NOT_VERIFIED');
assert.equal(evaluateGovernedValuationReportReadiness({
 runtime,valuationCase:{...valid,evidence:{
  ...valid.evidence,malformedRecord:'record as string, not typed source'
 }},asOf:at
}).reasonCode,'REPORT_EVIDENCE_DESCRIPTOR_INVALID');
const secondUnverified={...valid,evidence:{
 ...valid.evidence,second:{...valid.evidence.saleComparable,status:'PENDING'}
}};
assert.equal(evaluateGovernedValuationReportReadiness({runtime,valuationCase:secondUnverified,asOf:at}).reasonCode,
 'REPORT_EVIDENCE_STATUS_NOT_VERIFIED');
const sourceMissingName=evaluateDataFreshness({sourceDate:'2026-11-09T10:00:00.000Z'},{asOf:at});
assert.equal(sourceMissingName.materialMarketIndicatorAllowed,false);
const futureNamed=evaluateDataFreshness({sourceName:'Synthetic future',sourceDate:'2026-12-09T10:00:00.000Z'},{asOf:at});
assert.equal(futureNamed.materialMarketIndicatorAllowed,false);
assert.throws(()=>assertMaterialMarketIndicatorSource({
 sourceName:'Synthetic future',sourceDate:'2026-12-09T10:00:00.000Z'
},{asOf:at}),e=>e?.code==='MATERIAL_MARKET_SOURCE_DATE_REQUIRED');
assert.deepEqual(valid,evidence('2026-11-09T10:00:00.000Z')); // all tests non-mutating
console.log('STARTAK_RE_GOVERNED_REPORT_FRESHNESS_GUARD=PASS');

'use strict';
const assert=require('node:assert/strict');
const gold=require('../reference/RE-GOLD-baseline.json');
const {calculateInvestmentCase,STUDY_TYPE}=require('../../src/engines');
const {evaluateExistingBuildingValuation}=require('../../src/app/existing-building-valuation-runtime');
const {buildPersonalResearchReport,verifyPersonalResearchReport,htmlReport,STATE}
 =require('../../src/app/personal-investment-research-report');
const legacyInput=gold['RE-GOLD-002_existing_building'].inputs;
const legacyResult=calculateInvestmentCase({
 studyType:STUDY_TYPE.EXISTING_BUILDING,inputs:legacyInput,leverageEnabled:false,
});
const config={
 schemaVersion:1,projectId:'PERS-CASE-001',
 classification:{assetClass:'OFFICE',lifecycleStage:'STABILIZED',
  investmentStrategy:'CORE_INCOME',incomeModel:'LEASE_INCOME'},
 incomePolicy:{expenseTreatment:'ACTUAL_LANDLORD_OPEX',basis:'MARKET_VALUE',
  currency:'SAR',valuationDate:'2026-10-09'},
};
const stamp=new Date('2026-10-09T10:00:00.000Z');
let checks=0;
function yes(x,n){assert.ok(x,n);checks++;}
function equals(a,b,n){assert.deepEqual(a,b,n);checks++;}
const options=(runtime,valuationCase=config)=>({runtime,valuationCase,generatedAt:stamp});
const report=(runtime,valuationCase=config)=>buildPersonalResearchReport(options(runtime,valuationCase));
(function noConfigCanExportPersonalDraft(){
 const runtime=evaluateExistingBuildingValuation({
  caseId:'CASE-PERSONAL-NONE',legacyInput,legacyResult,valuationCase:null,
 });
 const r=report(runtime,null);
 equals(r.reportStatus,STATE.INPUTS_REQUIRED,'no V1 policy is still exportable as personal draft');
 equals(r.preliminaryValue,null,'no hidden legacy value promoted into certified appraisal');
 yes(r.warnings.includes('PERSONAL_VALUATION_CONFIGURATION_REQUIRED'),'missing configuration explicitly recorded');
 yes(verifyPersonalResearchReport(r),'draft has self-consistent export hash');
 yes(htmlReport(r).includes('دراسة استثمار عقاري شخصية'),'Arabic report available with no governance token');
})();
(function realComputedValuationIsExportableWithoutP0Approval(){
 // The real estate computational engine runs; the C62 institutional HOLD
 // must NOT prevent user's personal study export.
 const runtime=evaluateExistingBuildingValuation({
  caseId:'CASE-PERSONAL-V1',legacyInput,legacyResult,valuationCase:config,
 });
 const r=report(runtime);
 yes(r.reportHashSha256.length===64,'computed draft has deterministic hash');
 yes(r.evidenceVerificationStatus.includes('NOT_INDEPENDENTLY_VERIFIED'),'sources not silently upgraded');
 equals(r.professionalAppraisalClaim,false,'no professional appraisal claim');
 equals(r.transactionAuthorityClaim,false,'no transaction authorization claim');
 equals(r.externalGoLiveGateRequiredForPersonalExport,false,'commercial gates not blocking personal export');
 yes(verifyPersonalResearchReport(r),'real model draft export integrity');
 yes(!htmlReport(r,{locale:'en'}).includes('<script>'),'export contains no embedded scripts');
})();
(function stageHoldDoesNotCreateFakeFinalValue(){
 const runtime={mode:'VALUATION_V1',caseId:'CASE-STAGE-HOLD',projectId:config.projectId,
  stage:{status:'HOLD_POLICY',readyForDecisionControl:false,finalValue:9850000,
   reasonCodes:['RECONCILIATION_POLICY_REQUIRED'],evidenceGaps:['LEASE_EVIDENCE_MISSING'],
   methods:[{method:'INCOME_DIRECT_CAPITALIZATION',state:'AVAILABLE',
    indication:{value:9850000,weakestEvidenceGrade:'H_CLIENT_SUPPLIED_UNVERIFIED'}}]}};
 const r=report(runtime);
 equals(r.reportStatus,STATE.METHOD_INDICATIONS,'method-only stage not disguised as final');
 equals(r.preliminaryValue,null,'HOLD disables final even if raw final present');
 equals(r.methods[0].diagnosticValue,9850000,'valid individual numeric diagnostic exposed');
 yes(r.warnings.includes('RECONCILIATION_POLICY_REQUIRED')&&
  r.warnings.includes('LEASE_EVIDENCE_MISSING'),'real gaps retained');
 yes(htmlReport(r).includes('9850000')===false || htmlReport(r).includes('9,850,000') ||
  htmlReport(r).includes('٩٬٨٥٠٬٠٠٠'),'HTML diagnostic evidence can be printed');
})();
(function misleadingHoldMethodNumericNeverPresentedAsQualified(){
 const r=report({caseId:'C',stage:{status:'HOLD_EVIDENCE',readyForDecisionControl:false,
  finalValue:99999999,reasonCodes:[],evidenceGaps:[],
  methods:[{method:'MARKET_COMPARABLE',state:'HOLD_INPUTS',
   indication:{value:99999999}}]}});
 equals(r.preliminaryValue,null,'stage HOLD never grants final value');
 equals(r.methods[0].diagnosticValue,null,'unqualified method never grants a value');
 equals(r.reportStatus,STATE.INPUTS_REQUIRED,'deficient stage reports missing inputs');
})();
(function specialistModeExportsDraftWithNoInventedMethod(){
 const v={...config,classification:{...config.classification,assetClass:'HOSPITALITY'}};
 const runtime=evaluateExistingBuildingValuation({
  caseId:'HOTEL-PERSONAL-1',legacyInput,legacyResult,valuationCase:v,
 });
 const r=report(runtime,v);
 equals(r.reportStatus,STATE.SPECIALIST_INPUTS,'hotel personal intake allowed');
 equals(r.preliminaryValue,null,'no office lease adapter used as hotel appraiser');
 yes(r.warnings.includes('C69_SPECIALIZED_VALUATION_ADAPTER_NOT_IMPLEMENTED'),
  'specialized model gap still visible');
 yes(htmlReport(r).includes('C69_SPECIALIZED_VALUATION_ADAPTER_NOT_IMPLEMENTED'),
  'specialized warnings survive in personal HTML');
})();
(function validPreliminaryValueOnlyWhenStageReady(){
 const runtime={caseId:'CASE-FINAL',projectId:'PERS-CASE-001',
  stage:{status:'READY_FOR_DECISION_CONTROL',readyForDecisionControl:true,
   finalValue:1234567.89,reasonCodes:[],evidenceGaps:[],
   methods:[{method:'INCOME_DIRECT_CAPITALIZATION',state:'AVAILABLE',
    indication:{value:1234567.89}}]}};
 const r=report(runtime);
 equals(r.reportStatus,STATE.PRELIMINARY_VALUE,'eligible deterministic final figure');
 equals(r.preliminaryValue,1234567.89,'value faithfully follows stage not generated');
 yes(verifyPersonalResearchReport(r),'calculations included in export hash');
 const changed={...r,preliminaryValue:1234567.88};
 yes(!verifyPersonalResearchReport(changed),'manual edits to numeric value detected');
 const forged={...r,professionalAppraisalClaim:true};
 yes(!verifyPersonalResearchReport(forged),'cannot turn personal study into professional appraisal');
 const imported={...r,transactionAuthorityClaim:true};
 yes(!verifyPersonalResearchReport(imported),'cannot claim transaction authority');
})();
(function htmlSafelyEscapesUntrustedFields(){
 const v={...config,projectId:'PROJECT-<img src=x onerror=alert(1)>'};
 const r=report({caseId:'CASE-<script>alert(1)</script>',stage:null},v);
 const h=htmlReport(r);
 yes(!h.includes('<img src=x onerror=alert(1)>')&&!h.includes('<script>alert(1)</script>'),
  'unsafe project/case strings never run as HTML');
 yes(h.includes('&lt;img')&&h.includes('&lt;script'),'visible escaped untrusted HTML');
 yes(h.includes('Content-Security-Policy'),'exported report also ships CSP');
})();
(function reportNeverMutatesRuntimeOrEconomicInput(){
 const before=JSON.stringify(config),n=legacyResult.NOI;
 const r=report({caseId:'C',stage:null});
 yes(Object.isFrozen(r)&&Object.isFrozen(r.methods)&&Object.isFrozen(r.warnings),
  'report immutable snapshot');
 equals(JSON.stringify(config),before,'case economic inputs unchanged');
 equals(legacyResult.NOI,n,'base financial calculation unaffected');
 assert.throws(()=>buildPersonalResearchReport({runtime:'invalid',generatedAt:stamp}),/C75_RUNTIME_INVALID/);
 checks++;
 assert.throws(()=>buildPersonalResearchReport({runtime:null,generatedAt:'invalid-date'}),/C75_GENERATED_DATE_INVALID/);
 checks++;
})();
console.log('C75_PERSONAL_ANALYTICAL_DRAFT_EXPORT=PASS checks='+checks);
console.log('C75_PERSONAL_CAN_EXPORT_WITHOUT_ENTERPRISE_P0_APPROVAL=TRUE');
console.log('C75_OFFICIAL_APPRAISAL_CLAIM=FALSE');

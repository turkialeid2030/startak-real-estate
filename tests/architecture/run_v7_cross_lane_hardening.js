'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const op=require('../../src/operator/governed-operator-workspace');
const ai=require('../../src/ai/proof-grounded-ai-runtime');
const forecast=require('../../src/income/professional-income-forecast');
const {rebuildCanonicalForecastPeriod}=require('../../src/valuation-reconciliation/source-input-replay');
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
function rehash(x,key){const material={...x};delete material[key];return {...material,[key]:crypto.createHash('sha256').update(JSON.stringify(stable(material))).digest('hex')};}
const scope={caseId:'SYNTH-CASE',propertyRef:'SYNTH-PROPERTY',periodIndex:1};
const prov={source:forecast.INCOME_FORECAST_SOURCE.VERIFIED_LEASE_EVIDENCE,sourceRef:'SYNTH-LEASE',rationale:'synthetic review',evidenceRefs:['SYNTH-EVIDENCE'],asOfDate:'2026-09-01',preparedByRef:'SYNTH-PREPARER',preparedAt:'2026-09-02',reviewedByRef:'SYNTH-REVIEWER',reviewedAt:'2026-09-03',reviewEvidenceRef:'SYNTH-REVIEW'};
const income=forecast.createIncomeForecastLine({...scope,...prov,lineId:'SYNTH-INCOME',type:forecast.INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT,amountSar:120000});
const vacancy=forecast.createVacancyCollectionLossAssumption({...scope,...prov,assumptionId:'SYNTH-VACANCY',method:forecast.NOI_CALCULATION_METHOD.PERCENT_OF_PGI,value:0.05});
const expense=forecast.createOperatingExpenseForecastLine({...scope,...prov,expenseId:'SYNTH-EXPENSE',category:Object.values(forecast.NOI_EXPENSE_CATEGORY)[0],method:forecast.NOI_CALCULATION_METHOD.AMOUNT_SAR,value:10000});
const draft={...scope,periodId:'SYNTH-PERIOD',label:'Year 1',startDate:'2026-09-01',endDate:'2027-09-01',isStabilized:true,incomeLines:[income],vacancyCollectionLoss:vacancy,operatingExpenseLines:[expense],periodRationale:'synthetic period',preparedByRef:prov.preparedByRef,preparedAt:prov.preparedAt,reviewedByRef:prov.reviewedByRef,reviewedAt:prov.reviewedAt,reviewEvidenceRef:prov.reviewEvidenceRef};
const period=forecast.createIncomeForecastPeriod(draft);
assert.deepEqual(rebuildCanonicalForecastPeriod(period),period);
for(const patch of [{incomeLines:[rehash({...income,financialEngineInputsWritten:true},'incomeForecastLineHashSha256')]},{vacancyCollectionLoss:rehash({...vacancy,value:2},'vacancyCollectionLossHashSha256')},{operatingExpenseLines:[rehash({...expense,debtServiceIncluded:true},'operatingExpenseLineHashSha256')]}]){
 const forged=forecast.createIncomeForecastPeriod({...draft,...patch});
 assert.throws(()=>rebuildCanonicalForecastPeriod(forged),/FORECAST_/);
}
const sessionDraft={sessionId:'SYNTH-SESSION',userRef:'SYNTH-USER',role:op.ROLE.VIEWER,caseId:scope.caseId,propertyRef:scope.propertyRef,issuedAt:'2026-09-01',validUntil:'2026-09-05',authenticationEvidenceRef:'SYNTH-AUTH',authenticationEvidenceHashSha256:'a'.repeat(64),mfaVerified:true};
const session=op.createOperatorSession(sessionDraft);
const action=op.createWorkspaceAction({actionId:'SYNTH-ACTION',sessionHashSha256:session.sessionHashSha256,caseId:scope.caseId,propertyRef:scope.propertyRef,action:op.ACTION.VIEW_CASE,requestedAt:'2026-09-02'});
const caseSnapshot={caseId:scope.caseId,propertyRef:scope.propertyRef,status:'HOLD',resultHashSha256:'b'.repeat(64)};
assert.equal(op.evaluateOperatorWorkspaceAction({session,workspaceAction:action,caseSnapshot,asOf:'2026-09-03'}).actionAllowed,true);
assert.throws(()=>op.createOperatorSession({...sessionDraft,issuedAt:'2026-02-30'}),/C26_ISSUED_AT_INVALID/);
let reads=0;const getter=Object.defineProperty({},'request',{enumerable:true,get(){reads++;return {};}});
assert.throws(()=>op.createOperatorSession(Object.defineProperty({...sessionDraft},'role',{enumerable:true,get(){reads++;return op.ROLE.VIEWER;}})));
const badPayload=Object.defineProperty({},'note',{enumerable:true,get(){reads++;return 'bad';}});
assert.throws(()=>op.createWorkspaceAction({...action,payload:badPayload}),/C26_PAYLOAD_/);
const rejected=op.evaluateOperatorWorkspaceAction({session,workspaceAction:{...action,payload:badPayload},caseSnapshot,asOf:'2026-09-03'});
assert.equal(rejected.status,op.STATUS.HOLD_INTEGRITY);assert.equal(rejected.actionAllowed,false);assert.equal(rejected.auditEvent,null);assert.equal(rejected.resultHashSha256,null);
assert.equal(ai.evaluateProofGroundedProviderReadiness(getter).status,'HOLD_INTEGRITY');
assert.equal(ai.validateProofGroundedProviderResponse(getter).status,'HOLD_INTEGRITY');
(async()=>{const out=await ai.executeProofGroundedProviderGateway(getter);assert.equal(out.providerCalled,false);assert.equal(reads,0);console.log('V7_CROSS_LANE_HARDENING=PASS synthetic=true production=false');})().catch(e=>{console.error(e);process.exitCode=1;});

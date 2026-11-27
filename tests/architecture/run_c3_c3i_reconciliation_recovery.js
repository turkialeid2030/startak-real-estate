'use strict';
const assert=require('node:assert/strict');
const c=require('../../src/valuation-reconciliation/valuation-reconciliation-governance'),i=require('../../src/valuation-reconciliation/c3i-c2s-governed-reconciliation'),r=require('../../src/valuation-reconciliation/canonical-method-replay');
const scope={caseId:'SYNTH-C',propertyRef:'SYNTH-P',valuationDate:'2026-09-01',asOf:'2026-09-10'};
for(const v of [null,[],{},scope,{...scope,asOf:'2026-02-30'},{...scope,methodIndications:[],methodInputPacketsByIndicationId:{}}]){
 for(const fn of [c.evaluateValuationReconciliation,i.evaluateC3IC2SGovernedReconciliation]){
  const o=fn(v);assert.equal(o.decisionReady,false);assert.equal(o.status,'HOLD_EVIDENCE');assert.equal(o.analyticalValueIndicationSar,null);assert.equal(o.candidateWeightedValueSar,null);assert.equal(o.transactionAuthorized,false);
 }
 assert.equal(r.evaluateCanonicalMethodReplay(v).status,'HOLD_METHOD_REPLAY');
}
const fake={...scope,methodIndications:[{id:'M',sourceResult:{caseId:scope.caseId,propertyRef:scope.propertyRef,valuationDate:scope.valuationDate,modelVersion:'DIRECT_CAPITALIZATION_1.0',valueIndicationSar:1000000}}],methodInputPacketsByIndicationId:{M:{caseId:scope.caseId,propertyRef:scope.propertyRef,valuationDate:scope.valuationDate,preparedAt:'2026-09-02'}}};
assert.equal(r.evaluateCanonicalMethodReplay(fake).status,'HOLD_METHOD_REPLAY');
assert.ok(c.evaluateValuationReconciliation(fake).blockers.includes('C3_CANONICAL_METHOD_REPLAY_REQUIRED'));
let reads=0;const malformed=Object.defineProperty({},'propertyRef',{enumerable:true,get(){reads++;return 'P';}});
assert.equal(c.evaluateValuationReconciliation(malformed).status,'HOLD_EVIDENCE');assert.equal(i.evaluateC3IC2SGovernedReconciliation(malformed).status,'HOLD_EVIDENCE');assert.equal(r.evaluateCanonicalMethodReplay(malformed).status,'HOLD_METHOD_REPLAY');assert.equal(reads,0);
assert.equal(i.evaluateC3IC2SGovernedReconciliation({...scope,sourceProvenance:{records:[]}}).status,'HOLD_EVIDENCE');
const sr=require('../../src/valuation-reconciliation/source-input-replay');
for(const v of [null,[],{},scope,fake,malformed]){const o=sr.evaluateSourceInputReplay(v);assert.equal(o.status,'HOLD_SOURCE_INPUT_REPLAY');assert.equal(o.decisionReady,false);assert.equal(o.traces.length,0);}
assert.equal(reads,0);
console.log('C3_C3I_RECONCILIATION_RECOVERY=PASS synthetic=true sourceAuthority=false');
